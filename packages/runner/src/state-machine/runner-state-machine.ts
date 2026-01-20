/**
 * S1-D4: Runner State Machine
 *
 * Orchestrates episode execution through the perceive-plan-act-observe loop.
 * Coordinates lifecycle, budget enforcement, tool wrapper, and policy engine.
 */

import { EventEmitter } from 'eventemitter3';
import {
  type RunnerState,
  type RunnerEvent,
  type RunnerContext,
  ValidTransitions,
  isHighRiskTool,
} from './types.js';
import type { EpisodeService } from '../episode/episode-service.js';
import type { BudgetGuard } from '../budget/budget-guard.js';
import type { ToolWrapper } from '../tools/tool-wrapper.js';
import type { Episode, EpisodeCheckpoint } from '../episode/types.js';

// =====================
// Policy Engine Interface
// =====================

/**
 * Policy evaluation result for runner.
 */
export interface RunnerPolicyResult {
  decision: {
    effect: 'allow' | 'deny';
    reason: string;
    deniedBy?: string;
    checkedAt: number;
    evaluationMs: number;
  };
  checks: {
    killSwitch: 'passed' | 'skipped' | 'denied';
    rateLimit: 'passed' | 'skipped' | 'denied';
    rules: 'passed' | 'skipped' | 'denied';
    approval: 'passed' | 'skipped' | 'denied' | 'not_required';
  };
}

/**
 * Policy engine interface for runner authorization checks.
 */
export interface RunnerPolicyEngine {
  evaluate(context: {
    clientId: string;
    action: string;
    resource: unknown;
    episodeId: string;
  }): Promise<RunnerPolicyResult>;
}

// =====================
// RLM Session Interface
// =====================

/**
 * RLM Session interface for memory operations.
 */
export interface RLMSession {
  query(q: string): Promise<{ results: unknown[]; totalCount: number }>;
  upsert(data: unknown): Promise<void>;
}

// =====================
// Configuration
// =====================

/**
 * Configuration for the runner state machine.
 */
export interface RunnerStateMachineConfig {
  episodeService: EpisodeService;
  budgetGuard: BudgetGuard;
  toolWrapper: ToolWrapper;
  policyEngine: RunnerPolicyEngine;
  maxLoops?: number;
  suspendOnBudgetWarning?: boolean;
}

// =====================
// Event Types
// =====================

interface RunnerStateMachineEvents {
  stateChange: (state: RunnerState, previousState: RunnerState) => void;
  episodeCreated: (episode: Episode) => void;
  phaseStart: (phase: string) => void;
  phaseComplete: (phase: string, result: unknown) => void;
  error: (error: Error) => void;
}

// =====================
// State Machine Implementation
// =====================

/**
 * Runner state machine for episode execution.
 */
export class RunnerStateMachine extends EventEmitter<RunnerStateMachineEvents> {
  private _state: RunnerState = 'idle';
  private _context: RunnerContext = {
    episode: null,
    currentPhase: null,
    phaseData: {},
    loopCount: 0,
    lastError: null,
  };

  private episodeService: EpisodeService;
  private budgetGuard: BudgetGuard;
  private toolWrapper: ToolWrapper;
  private policyEngine: RunnerPolicyEngine;
  private maxLoops: number;
  private suspendOnBudgetWarning: boolean;

  constructor(config: RunnerStateMachineConfig) {
    super();
    this.episodeService = config.episodeService;
    this.budgetGuard = config.budgetGuard;
    this.toolWrapper = config.toolWrapper;
    this.policyEngine = config.policyEngine;
    this.maxLoops = config.maxLoops ?? 100;
    this.suspendOnBudgetWarning = config.suspendOnBudgetWarning ?? true;
  }

  /**
   * Get current state.
   */
  get state(): RunnerState {
    return this._state;
  }

  /**
   * Get current episode, throwing if not initialized.
   * @throws Error if episode is not initialized
   */
  private get episode(): Episode {
    if (!this._context.episode) {
      throw new Error('Episode not initialized - START event must complete first');
    }
    return this._context.episode;
  }

  /**
   * Get current context.
   */
  get context(): RunnerContext {
    return { ...this._context };
  }

  /**
   * Get current episode.
   */
  get currentEpisode(): Episode | null {
    return this._context.episode;
  }

  /**
   * Send an event to the state machine.
   */
  async send(event: RunnerEvent): Promise<void> {
    // Validate transition
    const validEvents = ValidTransitions[this._state];
    if (!validEvents.includes(event.type)) {
      const error = new Error(
        `Invalid transition: cannot process ${event.type} in state ${this._state}`
      );
      this.emit('error', error);
      throw error;
    }

    try {
      await this.processEvent(event);
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Reset state machine to idle.
   */
  reset(): void {
    this._state = 'idle';
    this._context = {
      episode: null,
      currentPhase: null,
      phaseData: {},
      loopCount: 0,
      lastError: null,
    };
  }

  // =====================
  // Event Processing
  // =====================

  private async processEvent(event: RunnerEvent): Promise<void> {
    // Note: Type assertions are safe here because the switch statement
    // narrows the discriminated union, guaranteeing the payload type matches.
    // The assertions work around exactOptionalPropertyTypes interactions.
    switch (event.type) {
      case 'START':
        await this.handleStart(event.payload as Parameters<typeof this.handleStart>[0]);
        break;
      case 'PERCEIVE':
        await this.handlePerceive(event.payload as Parameters<typeof this.handlePerceive>[0]);
        break;
      case 'PERCEIVE_COMPLETE':
        this.handlePerceiveComplete(event.payload as Parameters<typeof this.handlePerceiveComplete>[0]);
        break;
      case 'PLAN':
        await this.handlePlan(event.payload as Parameters<typeof this.handlePlan>[0]);
        break;
      case 'PLAN_COMPLETE':
        this.handlePlanComplete(event.payload as Parameters<typeof this.handlePlanComplete>[0]);
        break;
      case 'ACT':
        await this.handleAct(event.payload as Parameters<typeof this.handleAct>[0]);
        break;
      case 'ACT_COMPLETE':
        this.handleActComplete(event.payload as Parameters<typeof this.handleActComplete>[0]);
        break;
      case 'OBSERVE':
        await this.handleObserve(event.payload as Parameters<typeof this.handleObserve>[0]);
        break;
      case 'OBSERVE_COMPLETE':
        this.handleObserveComplete(event.payload as Parameters<typeof this.handleObserveComplete>[0]);
        break;
      case 'SUSPEND':
        await this.handleSuspend(event.payload as Parameters<typeof this.handleSuspend>[0]);
        break;
      case 'RESUME':
        await this.handleResume(event.payload as Parameters<typeof this.handleResume>[0]);
        break;
      case 'COMPLETE':
        await this.handleComplete(event.payload as Parameters<typeof this.handleComplete>[0]);
        break;
      case 'FAIL':
        await this.handleFail(event.payload as Parameters<typeof this.handleFail>[0]);
        break;
      case 'BUDGET_WARNING':
        await this.handleBudgetWarning(event.payload as Parameters<typeof this.handleBudgetWarning>[0]);
        break;
      case 'BUDGET_EXCEEDED':
        await this.handleBudgetExceeded(event.payload as Parameters<typeof this.handleBudgetExceeded>[0]);
        break;
    }
  }

  // =====================
  // Event Handlers
  // =====================

  private async handleStart(payload: {
    agentType: string;
    taskType: string;
    clientId: string;
    parentEpisodeId?: string;
    budget?: Episode['budget'];
    inputs?: Record<string, unknown>;
  }): Promise<void> {
    this.transition('initializing');

    // Build config with optional properties set conditionally
    const config: {
      agentId: string;
      taskType: string;
      clientId: string;
      budget: Episode['budget'];
      input: Record<string, unknown>;
      parentEpisodeId?: string;
    } = {
      agentId: payload.agentType,
      taskType: payload.taskType,
      clientId: payload.clientId,
      budget: payload.budget ?? { maxTokens: 10000, maxTimeMs: 60000 },
      input: payload.inputs ?? {},
    };
    if (payload.parentEpisodeId !== undefined) {
      config.parentEpisodeId = payload.parentEpisodeId;
    }

    // Create episode
    const episode = await this.episodeService.create(config);

    this._context.episode = episode;
    this.emit('episodeCreated', episode);

    // Start episode
    const startedEpisode = await this.episodeService.start(episode.id);
    this._context.episode = startedEpisode;

    this.transition('running');
  }

  private async handlePerceive(payload: {
    session: unknown;
    query?: string;
  }): Promise<void> {
    this.transition('perceiving');
    this._context.currentPhase = 'perceive';
    this.emit('phaseStart', 'perceive');

    // Query external memory if provided
    const session = payload.session as RLMSession | undefined;
    if (payload.query && session?.query) {
      const results = await session.query(payload.query);
      this._context.phaseData['perceiveResults'] = results;
    }
  }

  private handlePerceiveComplete(_payload: { context?: unknown }): void {
    this.emit('phaseComplete', 'perceive', this._context.phaseData['perceiveResults']);
    this._context.currentPhase = null;
    this.transition('running');
  }

  private async handlePlan(payload: {
    prompt: string;
    context?: unknown;
  }): Promise<void> {
    this.transition('planning');
    this._context.currentPhase = 'plan';
    this.emit('phaseStart', 'plan');

    // Guard LLM call with budget
    await this.budgetGuard.guardLLMCall(
      () => {
        // LLM planning logic would be provided by the agent
        // This just ensures budget is checked
        return Promise.resolve({ content: '', usage: { input_tokens: 0, output_tokens: 0 } });
      },
      { estimatedTokens: 1000 }
    );

    this._context.phaseData['planPrompt'] = payload.prompt;
    this._context.phaseData['planContext'] = payload.context;
  }

  private handlePlanComplete(payload: { plan: unknown[] }): void {
    this._context.phaseData['plan'] = payload.plan;
    this.emit('phaseComplete', 'plan', payload.plan);
    this._context.currentPhase = null;
    this.transition('running');
  }

  private async handleAct(payload: {
    toolId: string;
    input: Record<string, unknown>;
  }): Promise<void> {
    this.transition('acting');
    this._context.currentPhase = 'act';
    this.emit('phaseStart', 'act');

    // Check policy for high-risk actions
    if (isHighRiskTool(payload.toolId)) {
      const policyResult = await this.policyEngine.evaluate({
        clientId: this.episode.clientId,
        action: payload.toolId,
        resource: payload.input,
        episodeId: this.episode.id,
      });

      if (policyResult.decision.effect !== 'allow') {
        throw new Error(`Policy denied: ${policyResult.decision.reason}`);
      }
    }

    // Invoke tool through wrapper
    const result = await this.toolWrapper.invoke({
      toolId: payload.toolId,
      input: payload.input,
      context: {
        episodeId: this.episode.id,
        clientId: this.episode.clientId,
        agentId: this.episode.agentId,
      },
    });

    this._context.phaseData['actResult'] = result;
  }

  private handleActComplete(_payload: { result?: unknown }): void {
    this.emit('phaseComplete', 'act', this._context.phaseData['actResult']);
    this._context.currentPhase = null;
    this._context.loopCount++;
    this.transition('running');
  }

  private async handleObserve(payload: {
    session?: unknown;
    result: unknown;
  }): Promise<void> {
    this.transition('observing');
    this._context.currentPhase = 'observe';
    this.emit('phaseStart', 'observe');

    // Write observations to external memory
    const session = payload.session as RLMSession | undefined;
    if (session?.upsert) {
      await session.upsert({
        type: 'observation',
        episodeId: this.episode.id,
        result: payload.result,
        timestamp: new Date().toISOString(),
      });
    }

    this._context.phaseData['observation'] = payload.result;
  }

  private handleObserveComplete(_payload: { observation?: unknown }): void {
    this.emit('phaseComplete', 'observe', this._context.phaseData['observation']);
    this._context.currentPhase = null;
    this.transition('running');
  }

  private async handleSuspend(payload: {
    reason: string;
    checkpoint?: EpisodeCheckpoint;
  }): Promise<void> {
    const checkpoint: EpisodeCheckpoint = payload.checkpoint ?? {
      currentStep: this._context.loopCount,
      intermediateResults: Object.values(this._context.phaseData),
      customData: {
        phase: this._context.currentPhase,
        loopCount: this._context.loopCount,
      },
    };

    const suspendedEpisode = await this.episodeService.suspend(
      this.episode.id,
      payload.reason,
      checkpoint
    );

    this._context.episode = suspendedEpisode;
    this.transition('suspended');
  }

  private async handleResume(payload: { fromCheckpoint?: boolean }): Promise<void> {
    const resumedEpisode = await this.episodeService.resume(this.episode.id);

    this._context.episode = resumedEpisode;

    // Restore from checkpoint if requested and available
    if (payload.fromCheckpoint && resumedEpisode.checkpoint) {
      this._context.phaseData['checkpoint'] = resumedEpisode.checkpoint;
      const customData = resumedEpisode.checkpoint.customData as
        | { loopCount?: number }
        | undefined;
      if (customData?.loopCount !== undefined) {
        this._context.loopCount = customData.loopCount;
      }
    }

    this.transition('running');
  }

  private async handleComplete(payload: {
    outputs: Record<string, unknown>;
  }): Promise<void> {
    const completedEpisode = await this.episodeService.complete(this.episode.id, {
      outputs: payload.outputs,
    });

    this._context.episode = completedEpisode;
    this.transition('completed');
  }

  private async handleFail(payload: {
    error: { code: string; message: string; details?: unknown };
  }): Promise<void> {
    this._context.lastError = {
      code: payload.error.code,
      message: payload.error.message,
    };

    const failedEpisode = await this.episodeService.fail(this.episode.id, {
      code: payload.error.code,
      message: payload.error.message,
      retryable: false,
    });

    this._context.episode = failedEpisode;
    this.transition('failed');
  }

  private async handleBudgetWarning(payload: {
    type: string;
    usage: number;
    limit: number;
  }): Promise<void> {
    if (this.suspendOnBudgetWarning) {
      await this.send({
        type: 'SUSPEND',
        payload: {
          reason: `budget_warning:${payload.type}`,
          checkpoint: {
            currentStep: this._context.loopCount,
            intermediateResults: Object.values(this._context.phaseData),
            customData: {
              budgetWarning: payload,
              phase: this._context.currentPhase,
              loopCount: this._context.loopCount,
            },
          },
        },
      });
    }
  }

  private async handleBudgetExceeded(payload: { type: string }): Promise<void> {
    await this.send({
      type: 'FAIL',
      payload: {
        error: {
          code: 'BUDGET_EXCEEDED',
          message: `${payload.type} budget exceeded`,
        },
      },
    });
  }

  // =====================
  // State Transition
  // =====================

  private transition(newState: RunnerState): void {
    const previousState = this._state;
    this._state = newState;
    if (newState !== previousState) {
      this.emit('stateChange', newState, previousState);
    }
  }
}

export { RunnerState, RunnerEvent, RunnerContext };
