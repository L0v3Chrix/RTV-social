/**
 * Episode Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEpisodeService, type EpisodeService } from '../episode-service.js';
import type { EpisodeConfig, EpisodeStore, AuditEmitter, SessionManager } from '../types.js';

// Mock implementations
function createMockStore(): EpisodeStore {
  const episodes = new Map<string, any>();

  return {
    insert: vi.fn(async (episode) => {
      episodes.set(episode.id, { ...episode });
      return { ...episode };
    }),
    update: vi.fn(async (id, updates) => {
      const existing = episodes.get(id);
      if (!existing) throw new Error(`Episode not found: ${id}`);
      const updated = { ...existing, ...updates };
      episodes.set(id, updated);
      return updated;
    }),
    getById: vi.fn(async (id) => {
      return episodes.get(id) || null;
    }),
    listByClient: vi.fn(async (clientId, options) => {
      return Array.from(episodes.values()).filter((e) => e.clientId === clientId);
    }),
  };
}

function createMockAudit(): AuditEmitter {
  return {
    emit: vi.fn(async () => {}),
  };
}

function createMockSessionManager(): SessionManager {
  const sessions = new Map<string, any>();

  return {
    createSession: vi.fn(async (params) => {
      const session = {
        episodeId: params.episodeId,
        clientId: params.clientId,
        budgetState: { tokensUsed: 0, timeElapsedMs: 0 },
      };
      sessions.set(params.episodeId, session);
      return session;
    }),
    getSession: vi.fn(async (episodeId) => {
      return sessions.get(episodeId) || null;
    }),
    restoreSession: vi.fn(async (params) => {
      const session = {
        episodeId: params.episodeId,
        clientId: params.clientId,
        budgetState: params.budgetState,
      };
      sessions.set(params.episodeId, session);
      return session;
    }),
    closeSession: vi.fn(async (episodeId) => {
      sessions.delete(episodeId);
    }),
    updateBudgetState: vi.fn(async (episodeId, update) => {
      const session = sessions.get(episodeId);
      if (session) {
        session.budgetState = { ...session.budgetState, ...update };
      }
    }),
  };
}

describe('EpisodeService', () => {
  let service: EpisodeService;
  let mockStore: ReturnType<typeof createMockStore>;
  let mockAudit: ReturnType<typeof createMockAudit>;
  let mockSessionManager: ReturnType<typeof createMockSessionManager>;

  const defaultConfig: EpisodeConfig = {
    agentId: 'agent_copy',
    taskType: 'generate_caption',
    clientId: 'client_abc',
    budget: {
      maxTokens: 100000,
      maxTimeMs: 300000,
      maxRetries: 3,
    },
    input: {
      planNodeId: 'pn_123',
    },
  };

  beforeEach(() => {
    mockStore = createMockStore();
    mockAudit = createMockAudit();
    mockSessionManager = createMockSessionManager();

    service = createEpisodeService({
      store: mockStore,
      audit: mockAudit,
      sessionManager: mockSessionManager,
    });
  });

  describe('create', () => {
    it('should create episode with CREATED status', async () => {
      const episode = await service.create(defaultConfig);

      expect(episode.id).toMatch(/^ep_/);
      expect(episode.status).toBe('created');
      expect(episode.agentId).toBe('agent_copy');
      expect(episode.taskType).toBe('generate_caption');
      expect(episode.clientId).toBe('client_abc');
    });

    it('should emit EPISODE_CREATED audit event', async () => {
      await service.create(defaultConfig);

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'EPISODE_CREATED',
        actor: 'system',
        target: expect.stringMatching(/^ep_/),
        metadata: expect.objectContaining({
          agentId: 'agent_copy',
          taskType: 'generate_caption',
          clientId: 'client_abc',
        }),
      });
    });

    it('should initialize budget state', async () => {
      const episode = await service.create(defaultConfig);

      expect(episode.budgetState.tokensUsed).toBe(0);
      expect(episode.budgetState.timeElapsedMs).toBe(0);
      expect(episode.budgetState.retriesUsed).toBe(0);
      expect(episode.budgetState.subcallsUsed).toBe(0);
      expect(episode.budgetState.toolCallsUsed).toBe(0);
    });

    it('should link to parent episode if provided', async () => {
      const configWithParent = {
        ...defaultConfig,
        parentEpisodeId: 'ep_parent',
      };

      const episode = await service.create(configWithParent);

      expect(episode.parentEpisodeId).toBe('ep_parent');
    });

    it('should store metadata if provided', async () => {
      const configWithMetadata = {
        ...defaultConfig,
        metadata: { source: 'test', priority: 'high' },
      };

      const episode = await service.create(configWithMetadata);

      expect(episode.metadata).toEqual({ source: 'test', priority: 'high' });
    });
  });

  describe('start', () => {
    it('should transition from CREATED to RUNNING', async () => {
      const created = await service.create(defaultConfig);
      const started = await service.start(created.id);

      expect(started.status).toBe('running');
      expect(started.startedAt).toBeInstanceOf(Date);
    });

    it('should reject start if not CREATED', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);

      await expect(service.start(created.id)).rejects.toThrow(
        'Cannot start episode in status: running'
      );
    });

    it('should create session via session manager', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);

      expect(mockSessionManager.createSession).toHaveBeenCalledWith({
        episodeId: created.id,
        clientId: 'client_abc',
        budget: expect.objectContaining({
          maxTokens: 100000,
        }),
      });
    });

    it('should emit EPISODE_STARTED audit event', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'EPISODE_STARTED',
        actor: 'system',
        target: created.id,
        metadata: expect.any(Object),
      });
    });
  });

  describe('suspend', () => {
    it('should transition from RUNNING to SUSPENDED', async () => {
      const created = await service.create(defaultConfig);
      const started = await service.start(created.id);
      const suspended = await service.suspend(started.id, 'Awaiting human approval');

      expect(suspended.status).toBe('suspended');
      expect(suspended.suspendedAt).toBeInstanceOf(Date);
    });

    it('should save checkpoint before suspending', async () => {
      const created = await service.create(defaultConfig);
      const started = await service.start(created.id);

      const checkpoint = {
        currentStep: 3,
        intermediateResults: ['draft caption'],
      };

      const suspended = await service.suspend(started.id, 'Awaiting approval', checkpoint);

      expect(suspended.checkpoint).toEqual(checkpoint);
    });

    it('should reject suspend if not RUNNING', async () => {
      const created = await service.create(defaultConfig);

      await expect(service.suspend(created.id, 'Test reason')).rejects.toThrow(
        'Cannot suspend episode in status: created'
      );
    });

    it('should emit EPISODE_SUSPENDED audit event', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);
      await service.suspend(created.id, 'Awaiting approval');

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'EPISODE_SUSPENDED',
        actor: 'system',
        target: created.id,
        metadata: expect.objectContaining({
          reason: 'Awaiting approval',
        }),
      });
    });
  });

  describe('resume', () => {
    it('should transition from SUSPENDED to RUNNING', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);
      await service.suspend(created.id, 'Awaiting approval');
      const resumed = await service.resume(created.id);

      expect(resumed.status).toBe('running');
      expect(resumed.resumedAt).toBeInstanceOf(Date);
    });

    it('should restore session on resume', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);
      await service.suspend(created.id, 'Awaiting approval');
      await service.resume(created.id);

      expect(mockSessionManager.restoreSession).toHaveBeenCalledWith(
        expect.objectContaining({
          episodeId: created.id,
          clientId: 'client_abc',
        })
      );
    });

    it('should preserve checkpoint after resume', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);

      const checkpoint = { currentStep: 3 };
      await service.suspend(created.id, 'Awaiting approval', checkpoint);
      const resumed = await service.resume(created.id);

      expect(resumed.checkpoint).toEqual(checkpoint);
    });

    it('should reject resume if not SUSPENDED', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);

      await expect(service.resume(created.id)).rejects.toThrow(
        'Cannot resume episode in status: running'
      );
    });
  });

  describe('complete', () => {
    it('should transition from RUNNING to COMPLETED', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);
      const completed = await service.complete(created.id, {
        outputs: { caption: 'Generated caption' },
        artifacts: ['artifact_123'],
      });

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(completed.outputs).toEqual({ caption: 'Generated caption' });
    });

    it('should record final budget state', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);

      // Simulate budget usage via session
      mockSessionManager.getSession = vi.fn().mockResolvedValue({
        budgetState: {
          tokensUsed: 50000,
          timeElapsedMs: 120000,
        },
      });

      const completed = await service.complete(created.id, { outputs: {} });

      expect(completed.budgetState.tokensUsed).toBe(50000);
    });

    it('should close session', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);
      await service.complete(created.id, { outputs: {} });

      expect(mockSessionManager.closeSession).toHaveBeenCalledWith(created.id);
    });

    it('should emit EPISODE_COMPLETED audit event', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);
      await service.complete(created.id, { outputs: { result: 'test' } });

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'EPISODE_COMPLETED',
        actor: 'system',
        target: created.id,
        metadata: expect.objectContaining({
          outputCount: 1,
        }),
      });
    });
  });

  describe('fail', () => {
    it('should transition to FAILED with error', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);
      const failed = await service.fail(created.id, {
        message: 'LLM timeout',
        code: 'TIMEOUT',
      });

      expect(failed.status).toBe('failed');
      expect(failed.error?.code).toBe('TIMEOUT');
      expect(failed.error?.message).toBe('LLM timeout');
      expect(failed.failedAt).toBeInstanceOf(Date);
    });

    it('should emit EPISODE_FAILED audit event', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);
      await service.fail(created.id, { message: 'Error', code: 'ERR' });

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'EPISODE_FAILED',
        actor: 'system',
        target: created.id,
        metadata: expect.objectContaining({
          errorCode: 'ERR',
        }),
      });
    });

    it('should close session on failure', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);
      await service.fail(created.id, { message: 'Error', code: 'ERR' });

      expect(mockSessionManager.closeSession).toHaveBeenCalledWith(created.id);
    });
  });

  describe('retry', () => {
    it('should create new episode from failed one', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);
      await service.fail(created.id, { message: 'Error', code: 'ERR' });

      const retried = await service.retry(created.id);

      expect(retried.id).not.toBe(created.id);
      expect(retried.parentEpisodeId).toBe(created.id);
      expect(retried.status).toBe('created');
    });

    it('should reject retry if max retries exceeded', async () => {
      const configWithLowRetries = {
        ...defaultConfig,
        budget: { ...defaultConfig.budget, maxRetries: 1 },
      };

      const created = await service.create(configWithLowRetries);
      await service.start(created.id);
      await service.fail(created.id, { message: 'Error', code: 'ERR' });

      // First retry should work
      const retry1 = await service.retry(created.id);
      await service.start(retry1.id);
      await service.fail(retry1.id, { message: 'Error', code: 'ERR' });

      // Second retry should fail
      await expect(service.retry(retry1.id)).rejects.toThrow('Max retries exceeded');
    });

    it('should increment retry count', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);
      await service.fail(created.id, { message: 'Error', code: 'ERR' });

      const retried = await service.retry(created.id);

      expect(retried.budgetState.retriesUsed).toBe(1);
    });

    it('should reject retry if not FAILED', async () => {
      const created = await service.create(defaultConfig);

      await expect(service.retry(created.id)).rejects.toThrow(
        'Cannot retry episode in status: created'
      );
    });

    it('should emit EPISODE_RETRIED audit event', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);
      await service.fail(created.id, { message: 'Error', code: 'ERR' });
      await service.retry(created.id);

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'EPISODE_RETRIED',
        actor: 'system',
        target: expect.stringMatching(/^ep_/),
        metadata: expect.objectContaining({
          originalEpisodeId: created.id,
        }),
      });
    });
  });

  describe('getById', () => {
    it('should return episode by ID', async () => {
      const created = await service.create(defaultConfig);
      const found = await service.getById(created.id);

      expect(found?.id).toBe(created.id);
      expect(found?.agentId).toBe('agent_copy');
    });

    it('should return null for unknown ID', async () => {
      const episode = await service.getById('ep_unknown');

      expect(episode).toBeNull();
    });
  });

  describe('listByClient', () => {
    it('should list episodes for client', async () => {
      await service.create(defaultConfig);
      await service.create({ ...defaultConfig, taskType: 'task2' });

      const episodes = await service.listByClient('client_abc');

      expect(episodes).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const ep1 = await service.create(defaultConfig);
      await service.create(defaultConfig);
      await service.start(ep1.id);

      mockStore.listByClient = vi.fn().mockResolvedValue([{ id: ep1.id, status: 'running' }]);

      const episodes = await service.listByClient('client_abc', { status: 'running' });

      expect(mockStore.listByClient).toHaveBeenCalledWith('client_abc', { status: 'running' });
    });
  });

  describe('updateBudgetState', () => {
    it('should update budget consumption', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);

      await service.updateBudgetState(created.id, {
        tokensUsed: 5000,
        toolCallsUsed: 2,
      });

      const updated = await service.getById(created.id);
      expect(updated?.budgetState.tokensUsed).toBe(5000);
      expect(updated?.budgetState.toolCallsUsed).toBe(2);
    });

    it('should accumulate budget usage', async () => {
      const created = await service.create(defaultConfig);
      await service.start(created.id);

      await service.updateBudgetState(created.id, { tokensUsed: 5000 });
      await service.updateBudgetState(created.id, { tokensUsed: 3000 });

      const updated = await service.getById(created.id);
      expect(updated?.budgetState.tokensUsed).toBe(8000);
    });
  });
});
