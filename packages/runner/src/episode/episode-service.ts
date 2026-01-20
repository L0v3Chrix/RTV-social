/**
 * Episode Service
 *
 * Manages episode lifecycle: creation, execution, suspension, and completion.
 * Coordinates between state machine, storage, sessions, and audit logging.
 */

import { nanoid } from 'nanoid';
import {
  type Episode,
  type EpisodeConfig,
  type EpisodeStatus,
  type EpisodeError,
  type EpisodeCheckpoint,
  type EpisodeOutputs,
  type EpisodeListOptions,
  type BudgetUpdate,
  type BudgetState,
  type EpisodeServiceDeps,
  EpisodeConfigSchema,
  EpisodeOutputsSchema,
} from './types.js';
import { isValidTransition } from './state-machine.js';

/**
 * Episode Service interface
 */
export interface EpisodeService {
  create(config: EpisodeConfig): Promise<Episode>;
  start(episodeId: string): Promise<Episode>;
  suspend(episodeId: string, reason: string, checkpoint?: EpisodeCheckpoint): Promise<Episode>;
  resume(episodeId: string): Promise<Episode>;
  complete(episodeId: string, outputs: EpisodeOutputs): Promise<Episode>;
  fail(episodeId: string, error: EpisodeError): Promise<Episode>;
  retry(episodeId: string): Promise<Episode>;
  getById(episodeId: string): Promise<Episode | null>;
  listByClient(clientId: string, options?: EpisodeListOptions): Promise<Episode[]>;
  updateBudgetState(episodeId: string, update: BudgetUpdate): Promise<void>;
}

/**
 * Create an Episode Service instance
 */
export function createEpisodeService(deps: EpisodeServiceDeps): EpisodeService {
  const { store, audit, sessionManager } = deps;

  /**
   * Get episode by ID or throw
   */
  async function getEpisodeOrThrow(episodeId: string): Promise<Episode> {
    const episode = await store.getById(episodeId);
    if (!episode) {
      throw new Error(`Episode not found: ${episodeId}`);
    }
    return episode;
  }

  /**
   * Validate and perform state transition
   */
  async function transitionEpisode(
    episodeId: string,
    toStatus: EpisodeStatus,
    updates: Partial<Episode>
  ): Promise<Episode> {
    const episode = await getEpisodeOrThrow(episodeId);

    if (!isValidTransition(episode.status, toStatus)) {
      throw new Error(`Cannot transition episode from ${episode.status} to ${toStatus}`);
    }

    return store.update(episodeId, {
      status: toStatus,
      ...updates,
    });
  }

  return {
    async create(config: EpisodeConfig): Promise<Episode> {
      const validated = EpisodeConfigSchema.parse(config);
      const id = `ep_${nanoid()}`;
      const now = new Date();

      const initialBudgetState: BudgetState = {
        tokensUsed: 0,
        timeElapsedMs: 0,
        retriesUsed: 0,
        subcallsUsed: 0,
        toolCallsUsed: 0,
      };

      const episode: Episode = {
        id,
        agentId: validated.agentId,
        taskType: validated.taskType,
        clientId: validated.clientId,
        parentEpisodeId: validated.parentEpisodeId || null,
        childEpisodeIds: [],
        status: 'created',
        budget: validated.budget,
        budgetState: initialBudgetState,
        input: validated.input,
        outputs: null,
        artifacts: [],
        checkpoint: null,
        error: null,
        createdAt: now,
        startedAt: null,
        suspendedAt: null,
        resumedAt: null,
        completedAt: null,
        failedAt: null,
        metadata: validated.metadata || {},
      };

      const created = await store.insert(episode);

      await audit.emit({
        type: 'EPISODE_CREATED',
        actor: 'system',
        target: id,
        metadata: {
          agentId: validated.agentId,
          taskType: validated.taskType,
          clientId: validated.clientId,
          parentEpisodeId: validated.parentEpisodeId,
        },
      });

      return created;
    },

    async start(episodeId: string): Promise<Episode> {
      const episode = await getEpisodeOrThrow(episodeId);

      if (episode.status !== 'created') {
        throw new Error(`Cannot start episode in status: ${episode.status}`);
      }

      // Create session for this episode
      await sessionManager.createSession({
        episodeId,
        clientId: episode.clientId,
        budget: episode.budget,
      });

      const now = new Date();
      const updated = await transitionEpisode(episodeId, 'running', {
        startedAt: now,
      });

      await audit.emit({
        type: 'EPISODE_STARTED',
        actor: 'system',
        target: episodeId,
        metadata: {
          agentId: episode.agentId,
          taskType: episode.taskType,
        },
      });

      return updated;
    },

    async suspend(
      episodeId: string,
      reason: string,
      checkpoint?: EpisodeCheckpoint
    ): Promise<Episode> {
      const episode = await getEpisodeOrThrow(episodeId);

      if (episode.status !== 'running') {
        throw new Error(`Cannot suspend episode in status: ${episode.status}`);
      }

      const now = new Date();
      const updated = await transitionEpisode(episodeId, 'suspended', {
        suspendedAt: now,
        checkpoint: checkpoint || null,
      });

      await audit.emit({
        type: 'EPISODE_SUSPENDED',
        actor: 'system',
        target: episodeId,
        metadata: {
          reason,
          hasCheckpoint: !!checkpoint,
        },
      });

      return updated;
    },

    async resume(episodeId: string): Promise<Episode> {
      const episode = await getEpisodeOrThrow(episodeId);

      if (episode.status !== 'suspended') {
        throw new Error(`Cannot resume episode in status: ${episode.status}`);
      }

      // Restore session
      await sessionManager.restoreSession({
        episodeId,
        clientId: episode.clientId,
        budgetState: episode.budgetState,
      });

      const now = new Date();
      const updated = await transitionEpisode(episodeId, 'running', {
        resumedAt: now,
      });

      await audit.emit({
        type: 'EPISODE_RESUMED',
        actor: 'system',
        target: episodeId,
        metadata: {
          hasCheckpoint: !!episode.checkpoint,
        },
      });

      return updated;
    },

    async complete(episodeId: string, outputs: EpisodeOutputs): Promise<Episode> {
      const episode = await getEpisodeOrThrow(episodeId);

      if (episode.status !== 'running') {
        throw new Error(`Cannot complete episode in status: ${episode.status}`);
      }

      const validated = EpisodeOutputsSchema.parse(outputs);

      // Get final budget state from session
      const session = await sessionManager.getSession(episodeId);
      const finalBudgetState: BudgetState = {
        tokensUsed: session?.budgetState?.tokensUsed ?? episode.budgetState.tokensUsed,
        timeElapsedMs: session?.budgetState?.timeElapsedMs ?? episode.budgetState.timeElapsedMs,
        retriesUsed: episode.budgetState.retriesUsed,
        subcallsUsed: session?.budgetState?.subcallsUsed ?? episode.budgetState.subcallsUsed,
        toolCallsUsed: session?.budgetState?.toolCallsUsed ?? episode.budgetState.toolCallsUsed,
      };

      // Close session
      await sessionManager.closeSession(episodeId);

      const now = new Date();
      const updated = await transitionEpisode(episodeId, 'completed', {
        completedAt: now,
        outputs: validated.outputs,
        artifacts: validated.artifacts || [],
        budgetState: finalBudgetState,
      });

      await audit.emit({
        type: 'EPISODE_COMPLETED',
        actor: 'system',
        target: episodeId,
        metadata: {
          outputCount: Object.keys(validated.outputs).length,
          artifactCount: validated.artifacts?.length || 0,
          budgetState: finalBudgetState,
        },
      });

      return updated;
    },

    async fail(episodeId: string, error: EpisodeError): Promise<Episode> {
      const episode = await getEpisodeOrThrow(episodeId);

      if (episode.status !== 'running' && episode.status !== 'suspended') {
        throw new Error(`Cannot fail episode in status: ${episode.status}`);
      }

      // Try to close session
      try {
        await sessionManager.closeSession(episodeId);
      } catch {
        // Ignore errors when closing session on failure
      }

      const now = new Date();
      const updated = await transitionEpisode(episodeId, 'failed', {
        failedAt: now,
        error,
      });

      await audit.emit({
        type: 'EPISODE_FAILED',
        actor: 'system',
        target: episodeId,
        metadata: {
          errorCode: error.code,
          errorMessage: error.message,
          retryable: error.retryable,
        },
      });

      return updated;
    },

    async retry(episodeId: string): Promise<Episode> {
      const episode = await getEpisodeOrThrow(episodeId);

      if (episode.status !== 'failed') {
        throw new Error(`Cannot retry episode in status: ${episode.status}`);
      }

      const maxRetries = episode.budget.maxRetries ?? 0;
      const retriesUsed = episode.budgetState.retriesUsed;

      if (retriesUsed >= maxRetries) {
        throw new Error(`Max retries exceeded (${retriesUsed}/${maxRetries})`);
      }

      // Create new episode based on failed one
      const newEpisode = await this.create({
        agentId: episode.agentId,
        taskType: episode.taskType,
        clientId: episode.clientId,
        budget: episode.budget,
        input: episode.input,
        parentEpisodeId: episode.id,
        metadata: {
          ...episode.metadata,
          retryOf: episode.id,
          retryAttempt: retriesUsed + 1,
        },
      });

      // Update budget state with incremented retry count
      const updatedWithRetries = await store.update(newEpisode.id, {
        budgetState: {
          ...newEpisode.budgetState,
          retriesUsed: retriesUsed + 1,
        },
      });

      await audit.emit({
        type: 'EPISODE_RETRIED',
        actor: 'system',
        target: newEpisode.id,
        metadata: {
          originalEpisodeId: episode.id,
          retryAttempt: retriesUsed + 1,
        },
      });

      return updatedWithRetries;
    },

    async getById(episodeId: string): Promise<Episode | null> {
      return store.getById(episodeId);
    },

    async listByClient(clientId: string, options?: EpisodeListOptions): Promise<Episode[]> {
      return store.listByClient(clientId, options);
    },

    async updateBudgetState(episodeId: string, update: BudgetUpdate): Promise<void> {
      const episode = await getEpisodeOrThrow(episodeId);

      const newBudgetState: BudgetState = {
        tokensUsed: episode.budgetState.tokensUsed + (update.tokensUsed || 0),
        timeElapsedMs: episode.budgetState.timeElapsedMs + (update.timeElapsedMs || 0),
        retriesUsed: episode.budgetState.retriesUsed,
        subcallsUsed: episode.budgetState.subcallsUsed + (update.subcallsUsed || 0),
        toolCallsUsed: episode.budgetState.toolCallsUsed + (update.toolCallsUsed || 0),
      };

      await store.update(episodeId, { budgetState: newBudgetState });

      // Also update session if active
      try {
        await sessionManager.updateBudgetState(episodeId, update);
      } catch {
        // Session might not exist if episode not running
      }
    },
  };
}
