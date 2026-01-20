/**
 * S1-D4: Runner State Machine Tests
 *
 * Tests for the runner state machine that orchestrates episode execution
 * through the perceive-plan-act-observe loop.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RunnerStateMachine,
  type RunnerStateMachineConfig,
} from './runner-state-machine.js';
import type { EpisodeService } from '../episode/episode-service.js';
import type { BudgetGuard } from '../budget/budget-guard.js';
import type { ToolWrapper } from '../tools/tool-wrapper.js';
import type { Episode } from '../episode/types.js';

// =====================
// Mock Factories
// =====================

function createMockEpisodeService(): EpisodeService {
  return {
    create: vi.fn(),
    start: vi.fn(),
    suspend: vi.fn(),
    resume: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    retry: vi.fn(),
    getById: vi.fn(),
    listByClient: vi.fn(),
    updateBudgetState: vi.fn(),
  };
}

function createMockBudgetGuard(): BudgetGuard {
  return {
    withBudgetCheck: vi.fn((req, fn) => fn()),
    guardLLMCall: vi.fn((fn) => fn()),
    guardToolCall: vi.fn((name, fn) => fn()),
    allocateSubcallBudget: vi.fn(),
    getRemainingBudget: vi.fn().mockReturnValue({
      tokens: Infinity,
      timeMs: Infinity,
      subcalls: Infinity,
      toolCalls: Infinity,
    }),
  };
}

function createMockToolWrapper(): ToolWrapper {
  return {
    invoke: vi.fn().mockResolvedValue({
      success: true,
      output: {},
      error: null,
      metadata: {
        toolId: 'test.tool',
        invocationId: 'inv_123',
        startedAt: Date.now(),
        completedAt: Date.now(),
        durationMs: 10,
        retryCount: 0,
      },
    }),
    registerHandler: vi.fn(),
    unregisterHandler: vi.fn(),
  };
}

function createMockPolicyEngine() {
  return {
    evaluate: vi.fn().mockResolvedValue({
      decision: { effect: 'allow', reason: 'Allowed', checkedAt: Date.now(), evaluationMs: 1 },
      checks: { killSwitch: 'passed', rateLimit: 'passed', rules: 'passed', approval: 'not_required' },
    }),
  };
}

function createMockRLMSession() {
  return {
    query: vi.fn().mockResolvedValue({ results: [], totalCount: 0 }),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: 'ep_test123',
    agentId: 'planner',
    taskType: 'planning',
    clientId: 'client_123',
    parentEpisodeId: null,
    childEpisodeIds: [],
    status: 'created',
    budget: { maxTokens: 10000, maxTimeMs: 60000 },
    budgetState: {
      tokensUsed: 0,
      timeElapsedMs: 0,
      retriesUsed: 0,
      subcallsUsed: 0,
      toolCallsUsed: 0,
    },
    input: {},
    outputs: null,
    artifacts: [],
    checkpoint: null,
    error: null,
    createdAt: new Date(),
    startedAt: null,
    suspendedAt: null,
    resumedAt: null,
    completedAt: null,
    failedAt: null,
    metadata: {},
    ...overrides,
  };
}

// =====================
// Test Suite
// =====================

describe('RunnerStateMachine', () => {
  let stateMachine: RunnerStateMachine;
  let mockEpisodeService: EpisodeService;
  let mockBudgetGuard: BudgetGuard;
  let mockToolWrapper: ToolWrapper;
  let mockPolicyEngine: ReturnType<typeof createMockPolicyEngine>;
  let mockRLMSession: ReturnType<typeof createMockRLMSession>;

  beforeEach(() => {
    mockEpisodeService = createMockEpisodeService();
    mockBudgetGuard = createMockBudgetGuard();
    mockToolWrapper = createMockToolWrapper();
    mockPolicyEngine = createMockPolicyEngine();
    mockRLMSession = createMockRLMSession();

    const config: RunnerStateMachineConfig = {
      episodeService: mockEpisodeService,
      budgetGuard: mockBudgetGuard,
      toolWrapper: mockToolWrapper,
      policyEngine: mockPolicyEngine,
    };

    stateMachine = new RunnerStateMachine(config);
  });

  describe('initialization', () => {
    it('should start in idle state', () => {
      expect(stateMachine.state).toBe('idle');
    });

    it('should have no current episode when idle', () => {
      expect(stateMachine.currentEpisode).toBeNull();
    });

    it('should have empty context when idle', () => {
      const context = stateMachine.context;
      expect(context.episode).toBeNull();
      expect(context.currentPhase).toBeNull();
      expect(context.loopCount).toBe(0);
    });
  });

  describe('start', () => {
    it('should transition from idle to initializing on START event', async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });

      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });

      expect(stateMachine.state).toBe('running');
      expect(mockEpisodeService.create).toHaveBeenCalled();
      expect(mockEpisodeService.start).toHaveBeenCalled();
    });

    it('should emit state change events', async () => {
      const events: string[] = [];
      stateMachine.on('stateChange', (state) => events.push(state));

      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });

      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });

      expect(events).toContain('initializing');
      expect(events).toContain('running');
    });

    it('should reject START when not in idle state', async () => {
      // Start once
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });
      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });

      // Try to start again
      await expect(
        stateMachine.send({
          type: 'START',
          payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
        })
      ).rejects.toThrow('Invalid transition');
    });

    it('should set current episode after start', async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });

      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });

      expect(stateMachine.currentEpisode).not.toBeNull();
      expect(stateMachine.currentEpisode?.id).toBe('ep_test123');
    });
  });

  describe('perceive phase', () => {
    beforeEach(async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });
      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });
    });

    it('should transition to perceiving on PERCEIVE event', async () => {
      await stateMachine.send({ type: 'PERCEIVE', payload: { session: mockRLMSession } });
      expect(stateMachine.state).toBe('perceiving');
    });

    it('should query external memory during perceive', async () => {
      await stateMachine.send({
        type: 'PERCEIVE',
        payload: { session: mockRLMSession, query: 'test query' },
      });
      await stateMachine.send({ type: 'PERCEIVE_COMPLETE', payload: {} });

      expect(mockRLMSession.query).toHaveBeenCalledWith('test query');
    });

    it('should set current phase to perceive', async () => {
      await stateMachine.send({ type: 'PERCEIVE', payload: { session: mockRLMSession } });
      expect(stateMachine.context.currentPhase).toBe('perceive');
    });

    it('should emit phaseStart event', async () => {
      const phases: string[] = [];
      stateMachine.on('phaseStart', (phase) => phases.push(phase));

      await stateMachine.send({ type: 'PERCEIVE', payload: { session: mockRLMSession } });

      expect(phases).toContain('perceive');
    });
  });

  describe('plan phase', () => {
    beforeEach(async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });
      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });
    });

    it('should transition to planning on PLAN event', async () => {
      await stateMachine.send({ type: 'PLAN', payload: { prompt: 'Generate a plan' } });
      expect(stateMachine.state).toBe('planning');
    });

    it('should guard LLM calls with budget', async () => {
      await stateMachine.send({ type: 'PLAN', payload: { prompt: 'Generate a plan' } });

      expect(mockBudgetGuard.guardLLMCall).toHaveBeenCalled();
    });

    it('should set current phase to plan', async () => {
      await stateMachine.send({ type: 'PLAN', payload: { prompt: 'Generate a plan' } });
      expect(stateMachine.context.currentPhase).toBe('plan');
    });

    it('should complete plan phase and return to running', async () => {
      await stateMachine.send({ type: 'PLAN', payload: { prompt: 'Generate a plan' } });
      await stateMachine.send({ type: 'PLAN_COMPLETE', payload: { plan: ['step1', 'step2'] } });

      expect(stateMachine.state).toBe('running');
      expect(stateMachine.context.currentPhase).toBeNull();
    });
  });

  describe('act phase', () => {
    beforeEach(async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });
      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });
    });

    it('should transition to acting on ACT event', async () => {
      await stateMachine.send({
        type: 'ACT',
        payload: { toolId: 'memory.query', input: { query: 'test' } },
      });

      expect(stateMachine.state).toBe('acting');
    });

    it('should invoke tool through wrapper', async () => {
      await stateMachine.send({
        type: 'ACT',
        payload: { toolId: 'memory.query', input: { query: 'test' } },
      });
      await stateMachine.send({ type: 'ACT_COMPLETE', payload: {} });

      expect(mockToolWrapper.invoke).toHaveBeenCalledWith(
        expect.objectContaining({ toolId: 'memory.query' })
      );
    });

    it('should check policy before high-risk actions', async () => {
      await stateMachine.send({
        type: 'ACT',
        payload: { toolId: 'social.publish', input: { content: 'test' } },
      });

      expect(mockPolicyEngine.evaluate).toHaveBeenCalled();
    });

    it('should deny action when policy rejects', async () => {
      vi.mocked(mockPolicyEngine.evaluate).mockResolvedValue({
        decision: { effect: 'deny', reason: 'Kill switch active', checkedAt: Date.now(), evaluationMs: 1 },
        checks: { killSwitch: 'denied', rateLimit: 'passed', rules: 'passed', approval: 'not_required' },
      });

      await expect(
        stateMachine.send({
          type: 'ACT',
          payload: { toolId: 'social.publish', input: { content: 'test' } },
        })
      ).rejects.toThrow('Policy denied');
    });

    it('should increment loop count after act complete', async () => {
      const initialLoopCount = stateMachine.context.loopCount;

      await stateMachine.send({
        type: 'ACT',
        payload: { toolId: 'memory.query', input: {} },
      });
      await stateMachine.send({ type: 'ACT_COMPLETE', payload: {} });

      expect(stateMachine.context.loopCount).toBe(initialLoopCount + 1);
    });
  });

  describe('observe phase', () => {
    beforeEach(async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });
      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });
    });

    it('should transition to observing on OBSERVE event', async () => {
      await stateMachine.send({ type: 'OBSERVE', payload: { result: { success: true } } });
      expect(stateMachine.state).toBe('observing');
    });

    it('should write observations to external memory', async () => {
      await stateMachine.send({
        type: 'OBSERVE',
        payload: { session: mockRLMSession, result: { success: true } },
      });
      await stateMachine.send({ type: 'OBSERVE_COMPLETE', payload: {} });

      expect(mockRLMSession.upsert).toHaveBeenCalled();
    });

    it('should set current phase to observe', async () => {
      await stateMachine.send({ type: 'OBSERVE', payload: { result: {} } });
      expect(stateMachine.context.currentPhase).toBe('observe');
    });
  });

  describe('suspend and resume', () => {
    beforeEach(async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });
      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });
    });

    it('should transition to suspended on SUSPEND event', async () => {
      vi.mocked(mockEpisodeService.suspend).mockResolvedValue(
        createMockEpisode({ status: 'suspended', suspendedAt: new Date() })
      );

      await stateMachine.send({ type: 'SUSPEND', payload: { reason: 'budget_warning' } });

      expect(stateMachine.state).toBe('suspended');
      expect(mockEpisodeService.suspend).toHaveBeenCalled();
    });

    it('should capture checkpoint on suspend', async () => {
      vi.mocked(mockEpisodeService.suspend).mockResolvedValue(
        createMockEpisode({ status: 'suspended', suspendedAt: new Date() })
      );

      await stateMachine.send({
        type: 'SUSPEND',
        payload: {
          reason: 'budget_warning',
          checkpoint: { currentStep: 5, intermediateResults: ['result1'] },
        },
      });

      expect(mockEpisodeService.suspend).toHaveBeenCalledWith(
        'ep_test123',
        'budget_warning',
        expect.objectContaining({ currentStep: 5 })
      );
    });

    it('should transition from suspended to running on RESUME event', async () => {
      vi.mocked(mockEpisodeService.suspend).mockResolvedValue(
        createMockEpisode({ status: 'suspended', suspendedAt: new Date() })
      );
      await stateMachine.send({ type: 'SUSPEND', payload: { reason: 'budget_warning' } });

      vi.mocked(mockEpisodeService.resume).mockResolvedValue(
        createMockEpisode({ status: 'running', resumedAt: new Date() })
      );
      await stateMachine.send({ type: 'RESUME', payload: {} });

      expect(stateMachine.state).toBe('running');
    });

    it('should restore checkpoint on resume when available', async () => {
      const checkpointEpisode = createMockEpisode({
        status: 'running',
        checkpoint: {
          currentStep: 5,
          intermediateResults: ['result1'],
        },
      });

      vi.mocked(mockEpisodeService.suspend).mockResolvedValue(
        createMockEpisode({ status: 'suspended' })
      );
      await stateMachine.send({ type: 'SUSPEND', payload: { reason: 'test' } });

      vi.mocked(mockEpisodeService.resume).mockResolvedValue(checkpointEpisode);
      await stateMachine.send({ type: 'RESUME', payload: { fromCheckpoint: true } });

      expect(stateMachine.context.phaseData.checkpoint).toBeDefined();
    });
  });

  describe('completion', () => {
    beforeEach(async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });
      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });
    });

    it('should transition to completed on COMPLETE event', async () => {
      vi.mocked(mockEpisodeService.complete).mockResolvedValue(
        createMockEpisode({ status: 'completed', completedAt: new Date() })
      );

      await stateMachine.send({ type: 'COMPLETE', payload: { outputs: { result: 'success' } } });

      expect(stateMachine.state).toBe('completed');
    });

    it('should write final outputs to episode', async () => {
      vi.mocked(mockEpisodeService.complete).mockResolvedValue(
        createMockEpisode({ status: 'completed' })
      );

      const outputs = { planGraph: { nodes: [], edges: [] } };
      await stateMachine.send({ type: 'COMPLETE', payload: { outputs } });

      expect(mockEpisodeService.complete).toHaveBeenCalledWith(
        'ep_test123',
        expect.objectContaining({ outputs })
      );
    });

    it('should not accept new events after completion', async () => {
      vi.mocked(mockEpisodeService.complete).mockResolvedValue(
        createMockEpisode({ status: 'completed' })
      );
      await stateMachine.send({ type: 'COMPLETE', payload: { outputs: {} } });

      await expect(
        stateMachine.send({ type: 'PERCEIVE', payload: { session: mockRLMSession } })
      ).rejects.toThrow('Invalid transition');
    });
  });

  describe('failure', () => {
    beforeEach(async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });
      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });
    });

    it('should transition to failed on FAIL event', async () => {
      vi.mocked(mockEpisodeService.fail).mockResolvedValue(
        createMockEpisode({ status: 'failed', failedAt: new Date() })
      );

      await stateMachine.send({
        type: 'FAIL',
        payload: { error: { code: 'BUDGET_EXCEEDED', message: 'Token budget exceeded' } },
      });

      expect(stateMachine.state).toBe('failed');
    });

    it('should record error details on failure', async () => {
      vi.mocked(mockEpisodeService.fail).mockResolvedValue(
        createMockEpisode({ status: 'failed' })
      );

      const error = { code: 'BUDGET_EXCEEDED', message: 'Token budget exceeded' };
      await stateMachine.send({ type: 'FAIL', payload: { error } });

      expect(mockEpisodeService.fail).toHaveBeenCalledWith('ep_test123', expect.objectContaining(error));
    });

    it('should store error in context', async () => {
      vi.mocked(mockEpisodeService.fail).mockResolvedValue(
        createMockEpisode({ status: 'failed' })
      );

      const error = { code: 'TEST_ERROR', message: 'Test error' };
      await stateMachine.send({ type: 'FAIL', payload: { error } });

      expect(stateMachine.context.lastError).toEqual(error);
    });

    it('should not accept new events after failure', async () => {
      vi.mocked(mockEpisodeService.fail).mockResolvedValue(
        createMockEpisode({ status: 'failed' })
      );
      await stateMachine.send({
        type: 'FAIL',
        payload: { error: { code: 'TEST', message: 'Test' } },
      });

      await expect(
        stateMachine.send({ type: 'PERCEIVE', payload: { session: mockRLMSession } })
      ).rejects.toThrow('Invalid transition');
    });
  });

  describe('budget exhaustion', () => {
    beforeEach(async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });
      vi.mocked(mockEpisodeService.suspend).mockResolvedValue(
        createMockEpisode({ status: 'suspended' })
      );
      vi.mocked(mockEpisodeService.fail).mockResolvedValue(
        createMockEpisode({ status: 'failed' })
      );
    });

    it('should suspend when budget warning is received', async () => {
      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });

      await stateMachine.send({
        type: 'BUDGET_WARNING',
        payload: { type: 'tokens', usage: 8000, limit: 10000 },
      });

      expect(stateMachine.state).toBe('suspended');
    });

    it('should fail when budget is exceeded', async () => {
      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });

      await stateMachine.send({
        type: 'BUDGET_EXCEEDED',
        payload: { type: 'tokens' },
      });

      expect(stateMachine.state).toBe('failed');
    });

    it('should not suspend on budget warning when configured to continue', async () => {
      const configWithoutSuspend: RunnerStateMachineConfig = {
        episodeService: mockEpisodeService,
        budgetGuard: mockBudgetGuard,
        toolWrapper: mockToolWrapper,
        policyEngine: mockPolicyEngine,
        suspendOnBudgetWarning: false,
      };

      const sm = new RunnerStateMachine(configWithoutSuspend);

      await sm.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });

      await sm.send({
        type: 'BUDGET_WARNING',
        payload: { type: 'tokens', usage: 8000, limit: 10000 },
      });

      expect(sm.state).toBe('running');
    });
  });

  describe('loop execution', () => {
    it('should support full perceive-plan-act-observe loop', async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });
      vi.mocked(mockEpisodeService.complete).mockResolvedValue(
        createMockEpisode({ status: 'completed' })
      );

      // Start
      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });
      expect(stateMachine.state).toBe('running');

      // Perceive
      await stateMachine.send({ type: 'PERCEIVE', payload: { session: mockRLMSession } });
      expect(stateMachine.state).toBe('perceiving');
      await stateMachine.send({ type: 'PERCEIVE_COMPLETE', payload: {} });
      expect(stateMachine.state).toBe('running');

      // Plan
      await stateMachine.send({ type: 'PLAN', payload: { prompt: 'Create plan' } });
      expect(stateMachine.state).toBe('planning');
      await stateMachine.send({ type: 'PLAN_COMPLETE', payload: { plan: [] } });
      expect(stateMachine.state).toBe('running');

      // Act
      await stateMachine.send({ type: 'ACT', payload: { toolId: 'memory.query', input: {} } });
      expect(stateMachine.state).toBe('acting');
      await stateMachine.send({ type: 'ACT_COMPLETE', payload: {} });
      expect(stateMachine.state).toBe('running');

      // Observe
      await stateMachine.send({
        type: 'OBSERVE',
        payload: { session: mockRLMSession, result: {} },
      });
      expect(stateMachine.state).toBe('observing');
      await stateMachine.send({ type: 'OBSERVE_COMPLETE', payload: {} });
      expect(stateMachine.state).toBe('running');

      // Complete
      await stateMachine.send({ type: 'COMPLETE', payload: { outputs: {} } });
      expect(stateMachine.state).toBe('completed');
    });

    it('should track loop count across iterations', async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });

      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });

      // First loop
      await stateMachine.send({ type: 'ACT', payload: { toolId: 'test', input: {} } });
      await stateMachine.send({ type: 'ACT_COMPLETE', payload: {} });
      expect(stateMachine.context.loopCount).toBe(1);

      // Second loop
      await stateMachine.send({ type: 'ACT', payload: { toolId: 'test', input: {} } });
      await stateMachine.send({ type: 'ACT_COMPLETE', payload: {} });
      expect(stateMachine.context.loopCount).toBe(2);
    });
  });

  describe('reset', () => {
    it('should reset state machine to idle', async () => {
      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });
      vi.mocked(mockEpisodeService.complete).mockResolvedValue(
        createMockEpisode({ status: 'completed' })
      );

      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });
      await stateMachine.send({ type: 'COMPLETE', payload: { outputs: {} } });

      stateMachine.reset();

      expect(stateMachine.state).toBe('idle');
      expect(stateMachine.currentEpisode).toBeNull();
      expect(stateMachine.context.loopCount).toBe(0);
    });
  });

  describe('event emission', () => {
    it('should emit episodeCreated event', async () => {
      const episodes: Episode[] = [];
      stateMachine.on('episodeCreated', (ep) => episodes.push(ep));

      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });

      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });

      expect(episodes.length).toBe(1);
      expect(episodes[0].id).toBe('ep_test123');
    });

    it('should emit error event on failure', async () => {
      const errors: Error[] = [];
      stateMachine.on('error', (err) => errors.push(err));

      // Try to perform invalid transition
      await expect(
        stateMachine.send({ type: 'COMPLETE', payload: { outputs: {} } })
      ).rejects.toThrow();

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should emit phaseComplete event', async () => {
      const phases: Array<{ phase: string; result: unknown }> = [];
      stateMachine.on('phaseComplete', (phase, result) => phases.push({ phase, result }));

      const episode = createMockEpisode();
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({
        ...episode,
        status: 'running',
        startedAt: new Date(),
      });

      await stateMachine.send({
        type: 'START',
        payload: { agentType: 'planner', taskType: 'planning', clientId: 'client_123' },
      });

      await stateMachine.send({ type: 'PLAN', payload: { prompt: 'test' } });
      await stateMachine.send({ type: 'PLAN_COMPLETE', payload: { plan: ['step1'] } });

      expect(phases).toContainEqual(expect.objectContaining({ phase: 'plan' }));
    });
  });
});
