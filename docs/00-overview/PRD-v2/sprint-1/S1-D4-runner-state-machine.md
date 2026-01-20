# Build Prompt: S1-D4 — Runner State Machine

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S1-D4 |
| Sprint | 1 |
| Agent | D (Runner Skeleton) |
| Complexity | High |
| Status | pending |
| Estimated Tokens | 6,000 |
| Depends On | S1-D1, S1-D2, S1-D3 |
| Blocks | S1-D5 |

---

## Context

### What We're Building

The runner state machine orchestrates episode execution by coordinating the lifecycle, budget enforcement, tool wrapper, and policy engine. It implements the core RLM loop: perceive → plan → act → observe, with bounded execution and checkpoint support.

### Why It Matters

The runner is the execution engine for all agent episodes. It must:
- Execute agent logic within bounded episodes
- Enforce budgets before each operation
- Check policies before side effects
- Handle suspensions and resumptions
- Emit events for observability
- Maintain consistent state across failures

### Spec References

- Architecture: `/docs/01-architecture/system-architecture-v3.md` (Runner section)
- RLM Integration: `/docs/01-architecture/rlm-integration-spec.md` (Episodes)
- Agent Contracts: `/docs/03-agents-tools/agent-recursion-contracts.md`
- Engineering: `/docs/07-engineering-process/engineering-handbook.md`

---

## Prerequisites

### Completed Tasks
- [x] S1-D1: Episode lifecycle service
- [x] S1-D2: Budget enforcement components
- [x] S1-D3: Tool wrapper abstraction

### Required Packages
```bash
pnpm add zod nanoid eventemitter3
pnpm add -D vitest @types/node
```

### Required Knowledge
- Episode state machine transitions
- Budget enforcement patterns
- Tool wrapper integration
- Policy evaluation flow

---

## Instructions

### Phase 1: Test First (TDD)

Create the test file BEFORE implementation.

**File:** `packages/runner/src/state-machine/runner-state-machine.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RunnerStateMachine, RunnerState, RunnerEvent, RunnerContext } from './runner-state-machine';
import { EpisodeService } from '../episode/episode-service';
import { BudgetGuard } from '../budget/budget-guard';
import { ToolWrapper } from '../tools/tool-wrapper';
import { PolicyEngine } from '@rtv/policy';
import { RLMSession } from '@rtv/memory';

describe('RunnerStateMachine', () => {
  let stateMachine: RunnerStateMachine;
  let mockEpisodeService: EpisodeService;
  let mockBudgetGuard: BudgetGuard;
  let mockToolWrapper: ToolWrapper;
  let mockPolicyEngine: PolicyEngine;
  let mockRLMSession: RLMSession;

  beforeEach(() => {
    mockEpisodeService = {
      create: vi.fn(),
      start: vi.fn(),
      suspend: vi.fn(),
      resume: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    } as unknown as EpisodeService;

    mockBudgetGuard = {
      withBudgetCheck: vi.fn((req, fn) => fn()),
      guardLLMCall: vi.fn((fn) => fn()),
      guardToolCall: vi.fn((name, fn) => fn()),
    } as unknown as BudgetGuard;

    mockToolWrapper = {
      invoke: vi.fn(),
      registerHandler: vi.fn(),
    } as unknown as ToolWrapper;

    mockPolicyEngine = {
      evaluate: vi.fn().mockResolvedValue({ decision: 'allow' }),
    } as unknown as PolicyEngine;

    mockRLMSession = {
      query: vi.fn(),
      upsert: vi.fn(),
    } as unknown as RLMSession;

    stateMachine = new RunnerStateMachine({
      episodeService: mockEpisodeService,
      budgetGuard: mockBudgetGuard,
      toolWrapper: mockToolWrapper,
      policyEngine: mockPolicyEngine,
    });
  });

  describe('initialization', () => {
    it('should start in idle state', () => {
      expect(stateMachine.state).toBe('idle');
    });

    it('should have no current episode when idle', () => {
      expect(stateMachine.currentEpisode).toBeNull();
    });
  });

  describe('start', () => {
    it('should transition from idle to initializing on START event', async () => {
      const episode = {
        id: 'ep_test123',
        agentType: 'planner',
        clientId: 'client_123',
        status: 'created',
      };

      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({ ...episode, status: 'running' } as any);

      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });

      expect(stateMachine.state).toBe('running');
      expect(mockEpisodeService.create).toHaveBeenCalled();
      expect(mockEpisodeService.start).toHaveBeenCalled();
    });

    it('should emit state change events', async () => {
      const events: RunnerState[] = [];
      stateMachine.on('stateChange', (state) => events.push(state));

      const episode = { id: 'ep_test123', agentType: 'planner', status: 'created' };
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue({ ...episode, status: 'running' } as any);

      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });

      expect(events).toContain('initializing');
      expect(events).toContain('running');
    });

    it('should reject START when not in idle state', async () => {
      // Start once
      const episode = { id: 'ep_test123', status: 'running' };
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue(episode as any);
      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });

      // Try to start again
      await expect(
        stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } })
      ).rejects.toThrow('Invalid transition');
    });
  });

  describe('perceive phase', () => {
    beforeEach(async () => {
      const episode = { id: 'ep_test123', status: 'running' };
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue(episode as any);
      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });
    });

    it('should transition to perceiving on PERCEIVE event', async () => {
      await stateMachine.send({ type: 'PERCEIVE', payload: { session: mockRLMSession } });
      expect(stateMachine.state).toBe('perceiving');
    });

    it('should query external memory during perceive', async () => {
      vi.mocked(mockRLMSession.query).mockResolvedValue({ results: [], totalCount: 0 });

      await stateMachine.send({ type: 'PERCEIVE', payload: { session: mockRLMSession, query: 'test query' } });
      await stateMachine.send({ type: 'PERCEIVE_COMPLETE', payload: {} });

      expect(mockRLMSession.query).toHaveBeenCalled();
    });
  });

  describe('plan phase', () => {
    beforeEach(async () => {
      const episode = { id: 'ep_test123', status: 'running' };
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue(episode as any);
      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });
    });

    it('should transition to planning on PLAN event', async () => {
      await stateMachine.send({ type: 'PLAN', payload: { prompt: 'Generate a plan' } });
      expect(stateMachine.state).toBe('planning');
    });

    it('should guard LLM calls with budget', async () => {
      vi.mocked(mockBudgetGuard.guardLLMCall).mockImplementation(async (fn) => {
        return fn();
      });

      await stateMachine.send({ type: 'PLAN', payload: { prompt: 'Generate a plan' } });

      expect(mockBudgetGuard.guardLLMCall).toHaveBeenCalled();
    });
  });

  describe('act phase', () => {
    beforeEach(async () => {
      const episode = { id: 'ep_test123', status: 'running' };
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue(episode as any);
      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });
    });

    it('should transition to acting on ACT event', async () => {
      vi.mocked(mockToolWrapper.invoke).mockResolvedValue({ success: true, output: {} });

      await stateMachine.send({
        type: 'ACT',
        payload: { toolId: 'memory.query', input: { query: 'test' } },
      });

      expect(stateMachine.state).toBe('acting');
    });

    it('should invoke tool through wrapper', async () => {
      vi.mocked(mockToolWrapper.invoke).mockResolvedValue({ success: true, output: {} });

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
      vi.mocked(mockPolicyEngine.evaluate).mockResolvedValue({ decision: 'allow' });
      vi.mocked(mockToolWrapper.invoke).mockResolvedValue({ success: true, output: {} });

      await stateMachine.send({
        type: 'ACT',
        payload: { toolId: 'social.publish', input: { content: 'test' } },
      });

      expect(mockPolicyEngine.evaluate).toHaveBeenCalled();
    });

    it('should deny action when policy rejects', async () => {
      vi.mocked(mockPolicyEngine.evaluate).mockResolvedValue({
        decision: 'deny',
        reason: 'Kill switch active',
      });

      await expect(
        stateMachine.send({
          type: 'ACT',
          payload: { toolId: 'social.publish', input: { content: 'test' } },
        })
      ).rejects.toThrow('Policy denied');
    });
  });

  describe('observe phase', () => {
    beforeEach(async () => {
      const episode = { id: 'ep_test123', status: 'running' };
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue(episode as any);
      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });
    });

    it('should transition to observing on OBSERVE event', async () => {
      await stateMachine.send({ type: 'OBSERVE', payload: { result: { success: true } } });
      expect(stateMachine.state).toBe('observing');
    });

    it('should write observations to external memory', async () => {
      vi.mocked(mockRLMSession.upsert).mockResolvedValue(undefined);

      await stateMachine.send({
        type: 'OBSERVE',
        payload: { session: mockRLMSession, result: { success: true } },
      });
      await stateMachine.send({ type: 'OBSERVE_COMPLETE', payload: {} });

      expect(mockRLMSession.upsert).toHaveBeenCalled();
    });
  });

  describe('suspend and resume', () => {
    beforeEach(async () => {
      const episode = { id: 'ep_test123', status: 'running' };
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue(episode as any);
      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });
    });

    it('should transition to suspended on SUSPEND event', async () => {
      vi.mocked(mockEpisodeService.suspend).mockResolvedValue({
        id: 'ep_test123',
        status: 'suspended',
      } as any);

      await stateMachine.send({ type: 'SUSPEND', payload: { reason: 'budget_warning' } });

      expect(stateMachine.state).toBe('suspended');
      expect(mockEpisodeService.suspend).toHaveBeenCalled();
    });

    it('should capture checkpoint on suspend', async () => {
      vi.mocked(mockEpisodeService.suspend).mockResolvedValue({
        id: 'ep_test123',
        status: 'suspended',
      } as any);

      await stateMachine.send({
        type: 'SUSPEND',
        payload: {
          reason: 'budget_warning',
          checkpoint: { phase: 'planning', progress: { step: 5 } },
        },
      });

      expect(mockEpisodeService.suspend).toHaveBeenCalledWith(
        'ep_test123',
        'budget_warning',
        expect.objectContaining({ phase: 'planning' })
      );
    });

    it('should transition from suspended to running on RESUME event', async () => {
      vi.mocked(mockEpisodeService.suspend).mockResolvedValue({
        id: 'ep_test123',
        status: 'suspended',
      } as any);
      await stateMachine.send({ type: 'SUSPEND', payload: { reason: 'budget_warning' } });

      vi.mocked(mockEpisodeService.resume).mockResolvedValue({
        id: 'ep_test123',
        status: 'running',
      } as any);
      await stateMachine.send({ type: 'RESUME', payload: {} });

      expect(stateMachine.state).toBe('running');
    });
  });

  describe('completion', () => {
    beforeEach(async () => {
      const episode = { id: 'ep_test123', status: 'running' };
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue(episode as any);
      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });
    });

    it('should transition to completed on COMPLETE event', async () => {
      vi.mocked(mockEpisodeService.complete).mockResolvedValue({
        id: 'ep_test123',
        status: 'completed',
      } as any);

      await stateMachine.send({ type: 'COMPLETE', payload: { outputs: { result: 'success' } } });

      expect(stateMachine.state).toBe('completed');
    });

    it('should write final outputs to episode', async () => {
      vi.mocked(mockEpisodeService.complete).mockResolvedValue({
        id: 'ep_test123',
        status: 'completed',
      } as any);

      const outputs = { planGraph: { nodes: [], edges: [] } };
      await stateMachine.send({ type: 'COMPLETE', payload: { outputs } });

      expect(mockEpisodeService.complete).toHaveBeenCalledWith('ep_test123', outputs);
    });
  });

  describe('failure', () => {
    beforeEach(async () => {
      const episode = { id: 'ep_test123', status: 'running' };
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue(episode as any);
      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });
    });

    it('should transition to failed on FAIL event', async () => {
      vi.mocked(mockEpisodeService.fail).mockResolvedValue({
        id: 'ep_test123',
        status: 'failed',
      } as any);

      await stateMachine.send({
        type: 'FAIL',
        payload: { error: { code: 'BUDGET_EXCEEDED', message: 'Token budget exceeded' } },
      });

      expect(stateMachine.state).toBe('failed');
    });

    it('should record error details on failure', async () => {
      vi.mocked(mockEpisodeService.fail).mockResolvedValue({
        id: 'ep_test123',
        status: 'failed',
      } as any);

      const error = { code: 'BUDGET_EXCEEDED', message: 'Token budget exceeded' };
      await stateMachine.send({ type: 'FAIL', payload: { error } });

      expect(mockEpisodeService.fail).toHaveBeenCalledWith('ep_test123', error);
    });
  });

  describe('budget exhaustion', () => {
    it('should suspend when budget warning is received', async () => {
      const episode = { id: 'ep_test123', status: 'running' };
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.suspend).mockResolvedValue({
        id: 'ep_test123',
        status: 'suspended',
      } as any);

      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });
      await stateMachine.send({ type: 'BUDGET_WARNING', payload: { type: 'tokens', usage: 8000, limit: 10000 } });

      expect(stateMachine.state).toBe('suspended');
    });

    it('should fail when budget is exceeded', async () => {
      const episode = { id: 'ep_test123', status: 'running' };
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.fail).mockResolvedValue({
        id: 'ep_test123',
        status: 'failed',
      } as any);

      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });
      await stateMachine.send({ type: 'BUDGET_EXCEEDED', payload: { type: 'tokens' } });

      expect(stateMachine.state).toBe('failed');
    });
  });

  describe('loop execution', () => {
    it('should support full perceive-plan-act-observe loop', async () => {
      const episode = { id: 'ep_test123', status: 'running' };
      vi.mocked(mockEpisodeService.create).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.start).mockResolvedValue(episode as any);
      vi.mocked(mockEpisodeService.complete).mockResolvedValue({
        id: 'ep_test123',
        status: 'completed',
      } as any);
      vi.mocked(mockRLMSession.query).mockResolvedValue({ results: [], totalCount: 0 });
      vi.mocked(mockRLMSession.upsert).mockResolvedValue(undefined);
      vi.mocked(mockToolWrapper.invoke).mockResolvedValue({ success: true, output: {} });

      // Start
      await stateMachine.send({ type: 'START', payload: { agentType: 'planner', clientId: 'client_123' } });
      expect(stateMachine.state).toBe('running');

      // Perceive
      await stateMachine.send({ type: 'PERCEIVE', payload: { session: mockRLMSession } });
      await stateMachine.send({ type: 'PERCEIVE_COMPLETE', payload: {} });

      // Plan
      await stateMachine.send({ type: 'PLAN', payload: { prompt: 'Create plan' } });
      await stateMachine.send({ type: 'PLAN_COMPLETE', payload: { plan: [] } });

      // Act
      await stateMachine.send({ type: 'ACT', payload: { toolId: 'memory.query', input: {} } });
      await stateMachine.send({ type: 'ACT_COMPLETE', payload: {} });

      // Observe
      await stateMachine.send({ type: 'OBSERVE', payload: { session: mockRLMSession, result: {} } });
      await stateMachine.send({ type: 'OBSERVE_COMPLETE', payload: {} });

      // Complete
      await stateMachine.send({ type: 'COMPLETE', payload: { outputs: {} } });
      expect(stateMachine.state).toBe('completed');
    });
  });
});
```

Run the tests to confirm they fail:

```bash
cd packages/runner
pnpm test src/state-machine/runner-state-machine.test.ts
```

### Phase 2: Implementation

**File:** `packages/runner/src/state-machine/types.ts`

```typescript
import { z } from 'zod';
import { Episode, EpisodeBudget, EpisodeCheckpoint } from '../episode/types';

// Runner States
export const RunnerStates = [
  'idle',
  'initializing',
  'running',
  'perceiving',
  'planning',
  'acting',
  'observing',
  'suspended',
  'completed',
  'failed',
] as const;

export type RunnerState = typeof RunnerStates[number];

// Runner Events
export const RunnerEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('START'),
    payload: z.object({
      agentType: z.string(),
      clientId: z.string(),
      parentEpisodeId: z.string().optional(),
      budget: z.custom<EpisodeBudget>().optional(),
      inputs: z.record(z.unknown()).optional(),
    }),
  }),
  z.object({
    type: z.literal('PERCEIVE'),
    payload: z.object({
      session: z.unknown(),
      query: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('PERCEIVE_COMPLETE'),
    payload: z.object({
      context: z.unknown().optional(),
    }),
  }),
  z.object({
    type: z.literal('PLAN'),
    payload: z.object({
      prompt: z.string(),
      context: z.unknown().optional(),
    }),
  }),
  z.object({
    type: z.literal('PLAN_COMPLETE'),
    payload: z.object({
      plan: z.array(z.unknown()),
    }),
  }),
  z.object({
    type: z.literal('ACT'),
    payload: z.object({
      toolId: z.string(),
      input: z.record(z.unknown()),
    }),
  }),
  z.object({
    type: z.literal('ACT_COMPLETE'),
    payload: z.object({
      result: z.unknown().optional(),
    }),
  }),
  z.object({
    type: z.literal('OBSERVE'),
    payload: z.object({
      session: z.unknown().optional(),
      result: z.unknown(),
    }),
  }),
  z.object({
    type: z.literal('OBSERVE_COMPLETE'),
    payload: z.object({
      observation: z.unknown().optional(),
    }),
  }),
  z.object({
    type: z.literal('SUSPEND'),
    payload: z.object({
      reason: z.string(),
      checkpoint: z.custom<EpisodeCheckpoint>().optional(),
    }),
  }),
  z.object({
    type: z.literal('RESUME'),
    payload: z.object({
      fromCheckpoint: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal('COMPLETE'),
    payload: z.object({
      outputs: z.record(z.unknown()),
    }),
  }),
  z.object({
    type: z.literal('FAIL'),
    payload: z.object({
      error: z.object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
      }),
    }),
  }),
  z.object({
    type: z.literal('BUDGET_WARNING'),
    payload: z.object({
      type: z.enum(['tokens', 'time', 'retries', 'subcalls', 'toolCalls']),
      usage: z.number(),
      limit: z.number(),
    }),
  }),
  z.object({
    type: z.literal('BUDGET_EXCEEDED'),
    payload: z.object({
      type: z.enum(['tokens', 'time', 'retries', 'subcalls', 'toolCalls']),
    }),
  }),
]);

export type RunnerEvent = z.infer<typeof RunnerEventSchema>;

// Runner Context
export interface RunnerContext {
  episode: Episode | null;
  currentPhase: 'perceive' | 'plan' | 'act' | 'observe' | null;
  phaseData: Record<string, unknown>;
  loopCount: number;
  lastError: { code: string; message: string } | null;
}

// State Transitions
export const ValidTransitions: Record<RunnerState, RunnerEvent['type'][]> = {
  idle: ['START'],
  initializing: ['PERCEIVE', 'FAIL'],
  running: ['PERCEIVE', 'PLAN', 'ACT', 'OBSERVE', 'SUSPEND', 'COMPLETE', 'FAIL', 'BUDGET_WARNING', 'BUDGET_EXCEEDED'],
  perceiving: ['PERCEIVE_COMPLETE', 'SUSPEND', 'FAIL', 'BUDGET_WARNING', 'BUDGET_EXCEEDED'],
  planning: ['PLAN_COMPLETE', 'SUSPEND', 'FAIL', 'BUDGET_WARNING', 'BUDGET_EXCEEDED'],
  acting: ['ACT_COMPLETE', 'SUSPEND', 'FAIL', 'BUDGET_WARNING', 'BUDGET_EXCEEDED'],
  observing: ['OBSERVE_COMPLETE', 'SUSPEND', 'FAIL', 'BUDGET_WARNING', 'BUDGET_EXCEEDED'],
  suspended: ['RESUME', 'FAIL'],
  completed: [],
  failed: [],
};

// High-risk tool categories
export const HighRiskToolCategories = ['social.publish', 'social.reply', 'payment', 'data.delete'] as const;

// Runner configuration
export interface RunnerConfig {
  episodeService: unknown;
  budgetGuard: unknown;
  toolWrapper: unknown;
  policyEngine: unknown;
  auditService?: unknown;
  maxLoops?: number;
  suspendOnBudgetWarning?: boolean;
}
```

**File:** `packages/runner/src/state-machine/runner-state-machine.ts`

```typescript
import { EventEmitter } from 'eventemitter3';
import {
  RunnerState,
  RunnerEvent,
  RunnerContext,
  ValidTransitions,
  RunnerConfig,
  HighRiskToolCategories,
} from './types';
import { EpisodeService } from '../episode/episode-service';
import { BudgetGuard } from '../budget/budget-guard';
import { ToolWrapper, ToolInvocation } from '../tools/tool-wrapper';
import { PolicyEngine, PolicyEvaluationContext } from '@rtv/policy';
import { AuditService, AuditEventType } from '@rtv/audit';
import { Episode, EpisodeCheckpoint } from '../episode/types';

interface RunnerStateMachineEvents {
  stateChange: (state: RunnerState, previousState: RunnerState) => void;
  episodeCreated: (episode: Episode) => void;
  phaseStart: (phase: string) => void;
  phaseComplete: (phase: string, result: unknown) => void;
  error: (error: Error) => void;
}

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
  private policyEngine: PolicyEngine;
  private auditService?: AuditService;
  private maxLoops: number;
  private suspendOnBudgetWarning: boolean;

  constructor(config: RunnerConfig) {
    super();
    this.episodeService = config.episodeService as EpisodeService;
    this.budgetGuard = config.budgetGuard as BudgetGuard;
    this.toolWrapper = config.toolWrapper as ToolWrapper;
    this.policyEngine = config.policyEngine as PolicyEngine;
    this.auditService = config.auditService as AuditService | undefined;
    this.maxLoops = config.maxLoops ?? 100;
    this.suspendOnBudgetWarning = config.suspendOnBudgetWarning ?? true;
  }

  get state(): RunnerState {
    return this._state;
  }

  get context(): RunnerContext {
    return { ...this._context };
  }

  get currentEpisode(): Episode | null {
    return this._context.episode;
  }

  async send(event: RunnerEvent): Promise<void> {
    // Validate transition
    const validEvents = ValidTransitions[this._state];
    if (!validEvents.includes(event.type)) {
      throw new Error(
        `Invalid transition: cannot process ${event.type} in state ${this._state}`
      );
    }

    const previousState = this._state;

    try {
      await this.processEvent(event);
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }

    if (this._state !== previousState) {
      this.emit('stateChange', this._state, previousState);
    }
  }

  private async processEvent(event: RunnerEvent): Promise<void> {
    switch (event.type) {
      case 'START':
        await this.handleStart(event.payload);
        break;

      case 'PERCEIVE':
        await this.handlePerceive(event.payload);
        break;

      case 'PERCEIVE_COMPLETE':
        await this.handlePerceiveComplete(event.payload);
        break;

      case 'PLAN':
        await this.handlePlan(event.payload);
        break;

      case 'PLAN_COMPLETE':
        await this.handlePlanComplete(event.payload);
        break;

      case 'ACT':
        await this.handleAct(event.payload);
        break;

      case 'ACT_COMPLETE':
        await this.handleActComplete(event.payload);
        break;

      case 'OBSERVE':
        await this.handleObserve(event.payload);
        break;

      case 'OBSERVE_COMPLETE':
        await this.handleObserveComplete(event.payload);
        break;

      case 'SUSPEND':
        await this.handleSuspend(event.payload);
        break;

      case 'RESUME':
        await this.handleResume(event.payload);
        break;

      case 'COMPLETE':
        await this.handleComplete(event.payload);
        break;

      case 'FAIL':
        await this.handleFail(event.payload);
        break;

      case 'BUDGET_WARNING':
        await this.handleBudgetWarning(event.payload);
        break;

      case 'BUDGET_EXCEEDED':
        await this.handleBudgetExceeded(event.payload);
        break;
    }
  }

  private async handleStart(payload: {
    agentType: string;
    clientId: string;
    parentEpisodeId?: string;
    budget?: Episode['budget'];
    inputs?: Record<string, unknown>;
  }): Promise<void> {
    this.transition('initializing');

    // Create episode
    const episode = await this.episodeService.create({
      agentType: payload.agentType,
      clientId: payload.clientId,
      parentEpisodeId: payload.parentEpisodeId,
      budget: payload.budget,
      inputs: payload.inputs,
    });

    this._context.episode = episode;
    this.emit('episodeCreated', episode);

    // Start episode
    const startedEpisode = await this.episodeService.start(episode.id);
    this._context.episode = startedEpisode;

    this.transition('running');

    // Audit
    await this.audit('episode.started', {
      episodeId: episode.id,
      agentType: payload.agentType,
    });
  }

  private async handlePerceive(payload: {
    session: unknown;
    query?: string;
  }): Promise<void> {
    this.transition('perceiving');
    this._context.currentPhase = 'perceive';
    this.emit('phaseStart', 'perceive');

    // Query external memory
    const session = payload.session as { query: (q: string) => Promise<unknown> };
    if (payload.query && session.query) {
      const results = await session.query(payload.query);
      this._context.phaseData.perceiveResults = results;
    }
  }

  private async handlePerceiveComplete(payload: {
    context?: unknown;
  }): Promise<void> {
    this.emit('phaseComplete', 'perceive', this._context.phaseData.perceiveResults);
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
      async () => {
        // LLM planning logic would go here
        // This is called by the agent implementation
        return null;
      },
      { estimatedTokens: 1000 }
    );
  }

  private async handlePlanComplete(payload: { plan: unknown[] }): Promise<void> {
    this._context.phaseData.plan = payload.plan;
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
    const isHighRisk = HighRiskToolCategories.some((cat) =>
      payload.toolId.startsWith(cat)
    );

    if (isHighRisk) {
      const policyContext: PolicyEvaluationContext = {
        clientId: this._context.episode!.clientId,
        action: payload.toolId,
        resource: payload.input,
        episodeId: this._context.episode!.id,
      };

      const result = await this.policyEngine.evaluate(policyContext);

      if (result.decision !== 'allow') {
        throw new Error(`Policy denied: ${result.reason}`);
      }
    }

    // Invoke tool through wrapper
    const invocation: ToolInvocation = {
      toolId: payload.toolId,
      episodeId: this._context.episode!.id,
      clientId: this._context.episode!.clientId,
      input: payload.input,
    };

    const result = await this.toolWrapper.invoke(invocation);
    this._context.phaseData.actResult = result;
  }

  private async handleActComplete(payload: { result?: unknown }): Promise<void> {
    this.emit('phaseComplete', 'act', this._context.phaseData.actResult);
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
    const session = payload.session as { upsert: (data: unknown) => Promise<void> } | undefined;
    if (session?.upsert) {
      await session.upsert({
        type: 'observation',
        episodeId: this._context.episode!.id,
        result: payload.result,
        timestamp: new Date().toISOString(),
      });
    }

    this._context.phaseData.observation = payload.result;
  }

  private async handleObserveComplete(payload: {
    observation?: unknown;
  }): Promise<void> {
    this.emit('phaseComplete', 'observe', this._context.phaseData.observation);
    this._context.currentPhase = null;
    this.transition('running');
  }

  private async handleSuspend(payload: {
    reason: string;
    checkpoint?: EpisodeCheckpoint;
  }): Promise<void> {
    const checkpoint: EpisodeCheckpoint = payload.checkpoint ?? {
      phase: this._context.currentPhase ?? 'unknown',
      progress: this._context.phaseData,
      loopCount: this._context.loopCount,
    };

    const suspendedEpisode = await this.episodeService.suspend(
      this._context.episode!.id,
      payload.reason,
      checkpoint
    );

    this._context.episode = suspendedEpisode;
    this.transition('suspended');

    await this.audit('episode.suspended', {
      episodeId: this._context.episode!.id,
      reason: payload.reason,
    });
  }

  private async handleResume(payload: { fromCheckpoint?: boolean }): Promise<void> {
    const resumedEpisode = await this.episodeService.resume(
      this._context.episode!.id
    );

    this._context.episode = resumedEpisode;

    // Restore from checkpoint if available
    if (payload.fromCheckpoint && resumedEpisode.checkpoint) {
      this._context.phaseData = resumedEpisode.checkpoint.progress as Record<string, unknown>;
      this._context.loopCount = resumedEpisode.checkpoint.loopCount ?? 0;
    }

    this.transition('running');

    await this.audit('episode.resumed', {
      episodeId: this._context.episode!.id,
    });
  }

  private async handleComplete(payload: {
    outputs: Record<string, unknown>;
  }): Promise<void> {
    const completedEpisode = await this.episodeService.complete(
      this._context.episode!.id,
      payload.outputs
    );

    this._context.episode = completedEpisode;
    this.transition('completed');

    await this.audit('episode.completed', {
      episodeId: this._context.episode!.id,
      outputs: Object.keys(payload.outputs),
    });
  }

  private async handleFail(payload: {
    error: { code: string; message: string; details?: unknown };
  }): Promise<void> {
    this._context.lastError = {
      code: payload.error.code,
      message: payload.error.message,
    };

    const failedEpisode = await this.episodeService.fail(
      this._context.episode!.id,
      payload.error
    );

    this._context.episode = failedEpisode;
    this.transition('failed');

    await this.audit('episode.failed', {
      episodeId: this._context.episode!.id,
      error: payload.error,
    });
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
            phase: this._context.currentPhase ?? 'unknown',
            progress: this._context.phaseData,
            loopCount: this._context.loopCount,
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

  private transition(newState: RunnerState): void {
    this._state = newState;
  }

  private async audit(
    eventType: AuditEventType,
    details: Record<string, unknown>
  ): Promise<void> {
    if (this.auditService) {
      await this.auditService.emit({
        type: eventType,
        clientId: this._context.episode?.clientId ?? 'system',
        actorId: 'runner',
        actorType: 'system',
        details,
        timestamp: new Date(),
      });
    }
  }

  // Reset state machine for reuse
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
}

export { RunnerState, RunnerEvent, RunnerContext };
```

**File:** `packages/runner/src/state-machine/index.ts`

```typescript
export * from './types';
export * from './runner-state-machine';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/runner
pnpm test src/state-machine/

# Type check
pnpm typecheck

# Lint
pnpm lint

# Verify exports
pnpm build
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/runner/src/state-machine/types.ts` | State machine types and transitions |
| Create | `packages/runner/src/state-machine/runner-state-machine.ts` | State machine implementation |
| Create | `packages/runner/src/state-machine/runner-state-machine.test.ts` | Unit tests |
| Create | `packages/runner/src/state-machine/index.ts` | Module exports |
| Modify | `packages/runner/src/index.ts` | Add state machine exports |

---

## Acceptance Criteria

- [ ] Runner state machine handles all 10 states: idle, initializing, running, perceiving, planning, acting, observing, suspended, completed, failed
- [ ] State transitions are validated before processing
- [ ] Invalid transitions throw descriptive errors
- [ ] START event creates and starts episode
- [ ] PERCEIVE queries external memory through RLM session
- [ ] PLAN guards LLM calls with budget
- [ ] ACT checks policy for high-risk tools before invocation
- [ ] OBSERVE writes observations to external memory
- [ ] SUSPEND captures checkpoint and suspends episode
- [ ] RESUME restores from checkpoint
- [ ] COMPLETE writes outputs and marks episode completed
- [ ] FAIL records error and marks episode failed
- [ ] BUDGET_WARNING suspends execution (configurable)
- [ ] BUDGET_EXCEEDED fails episode
- [ ] State change events emitted for observability
- [ ] Full perceive-plan-act-observe loop executes correctly
- [ ] All unit tests pass with >90% coverage

---

## Test Requirements

### Unit Tests
- State transition validation
- Event processing for each state
- Budget integration
- Policy evaluation
- Error handling
- Event emission

### Integration Tests
- Full loop execution
- Checkpoint/resume cycle
- Multi-episode orchestration

---

## Security & Safety Checklist

- [ ] No hardcoded secrets or credentials
- [ ] Episode scoped to client_id
- [ ] Policy check before high-risk actions
- [ ] Budget enforcement prevents runaway execution
- [ ] Audit events for all state transitions
- [ ] Error details sanitized in logs

---

## JSON Task Block

```json
{
  "task_id": "S1-D4",
  "name": "Runner State Machine",
  "sprint": 1,
  "agent": "D",
  "status": "pending",
  "complexity": "high",
  "estimated_tokens": 6000,
  "dependencies": ["S1-D1", "S1-D2", "S1-D3"],
  "blocks": ["S1-D5"],
  "spec_refs": [
    "/docs/01-architecture/system-architecture-v3.md",
    "/docs/01-architecture/rlm-integration-spec.md",
    "/docs/03-agents-tools/agent-recursion-contracts.md"
  ],
  "acceptance_criteria": [
    "runner_handles_10_states",
    "state_transitions_validated",
    "perceive_plan_act_observe_loop",
    "budget_enforcement_integrated",
    "policy_check_on_high_risk",
    "checkpoint_resume_works",
    "audit_events_emitted"
  ],
  "outputs": {
    "files": [
      "packages/runner/src/state-machine/types.ts",
      "packages/runner/src/state-machine/runner-state-machine.ts",
      "packages/runner/src/state-machine/runner-state-machine.test.ts",
      "packages/runner/src/state-machine/index.ts"
    ],
    "exports": ["RunnerStateMachine", "RunnerState", "RunnerEvent", "RunnerContext"]
  }
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "last_checkpoint": null,
  "execution_notes": [],
  "blockers_encountered": [],
  "decisions_made": []
}
```

---

## Hints for AI Agent

1. **State Validation**: Use ValidTransitions map to check transitions before processing
2. **Event Emission**: Emit stateChange events for observability
3. **Budget Integration**: Connect to BudgetGuard for LLM and tool calls
4. **Policy Checks**: Only check policy for high-risk tool categories
5. **Checkpoint Data**: Capture current phase and progress on suspend
6. **Loop Count**: Track iterations through the perceive-plan-act-observe loop
7. **Error Propagation**: Re-throw errors after handling for caller awareness
