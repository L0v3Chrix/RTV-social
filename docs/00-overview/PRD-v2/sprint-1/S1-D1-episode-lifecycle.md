# Build Prompt: S1-D1 — Episode Lifecycle Management

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-D1 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | D — Runner Skeleton |
| **Task Name** | Episode Lifecycle Management |
| **Complexity** | High |
| **Estimated Effort** | 6-7 hours |
| **Dependencies** | S1-B1, S1-C5 |
| **Blocks** | S1-D2, S1-D3, S1-D4, S1-D5, S2-* |
| **Status** | pending |

---

## Context

### What This Builds

An **Episode** is a bounded unit of autonomous work. It represents a single execution session where an agent performs a task with defined budgets (tokens, time, retries) and produces observable outputs. The episode lifecycle manages creation, execution, suspension, resumption, and completion.

### Why It Matters

Episodes are the foundation of the RLM (Recursive Language Model) pattern:

- **Bounded Execution**: Every autonomous action has limits
- **Auditability**: Complete history of what happened
- **Resumability**: Can pause and continue work
- **Observability**: Clear start, progress, and end states
- **Budget Enforcement**: Prevents runaway costs

### Episode States

```
                                ┌──────────┐
                                │  CREATED │
                                └────┬─────┘
                                     │ start()
                                     ▼
                           ┌─────────────────┐
                           │    RUNNING      │
                           └────────┬────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
   ┌────────────┐           ┌────────────┐           ┌────────────┐
   │ SUSPENDED  │           │ COMPLETED  │           │  FAILED    │
   └──────┬─────┘           └────────────┘           └────────────┘
          │                                                   │
          │ resume()                                          │
          └───────────────────────────────────────────────────┘
                                    │
                              retry allowed?
                                    │
                                    ▼
                           ┌─────────────────┐
                           │    RUNNING      │
                           └─────────────────┘
```

### Reference Specs

| Document | Section | Relevance |
|----------|---------|-----------|
| `/docs/01-architecture/rlm-integration-spec.md` | Episode Model | Core requirements |
| `/docs/01-architecture/system-architecture-v3.md` | Agent Execution | Integration |
| `/docs/03-agents-tools/agent-recursion-contracts.md` | Episode Contracts | Constraints |
| `/docs/02-schemas/external-memory-schema.md` | Episode Storage | Schema |
| `/docs/06-reliability-ops/slo-error-budget.md` | Episode SLOs | Performance |

---

## Prerequisites

### Completed Tasks

- [x] **S0-B2**: Core schema migrations (for episodes table)
- [x] **S0-B4**: Audit event schema (for episode events)
- [x] **S0-D3**: Audit event framework (for event emission)
- [x] **S1-B1**: RLM environment interface (for memory access)
- [x] **S1-C5**: Policy evaluation engine (for action authorization)

### Required Packages

```json
{
  "dependencies": {
    "drizzle-orm": "^0.30.0",
    "zod": "^3.22.0",
    "nanoid": "^5.0.0",
    "@opentelemetry/api": "^1.7.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create comprehensive tests BEFORE implementation.

#### 1.1 Create Episode Types Tests

**File:** `packages/runner/src/episode/__tests__/types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  EpisodeConfigSchema,
  EpisodeBudgetSchema,
  EpisodeStatusSchema,
  EpisodeSchema,
} from '../types';

describe('Episode Types', () => {
  describe('EpisodeBudgetSchema', () => {
    it('should validate budget with all fields', () => {
      const budget = {
        maxTokens: 100000,
        maxTimeMs: 300000,
        maxRetries: 3,
        maxSubcalls: 10,
        maxToolCalls: 50,
      };

      const result = EpisodeBudgetSchema.safeParse(budget);
      expect(result.success).toBe(true);
    });

    it('should require positive values', () => {
      const budget = {
        maxTokens: -100,
        maxTimeMs: 300000,
        maxRetries: 3,
      };

      const result = EpisodeBudgetSchema.safeParse(budget);
      expect(result.success).toBe(false);
    });

    it('should allow partial budget', () => {
      const budget = {
        maxTokens: 100000,
      };

      const result = EpisodeBudgetSchema.safeParse(budget);
      expect(result.success).toBe(true);
    });
  });

  describe('EpisodeConfigSchema', () => {
    it('should validate full config', () => {
      const config = {
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
          context: { platform: 'meta' },
        },
        parentEpisodeId: 'ep_parent',
      };

      const result = EpisodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should require agentId, taskType, clientId', () => {
      const config = {
        budget: { maxTokens: 100000 },
      };

      const result = EpisodeConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('EpisodeStatusSchema', () => {
    it('should accept valid statuses', () => {
      const statuses = ['created', 'running', 'suspended', 'completed', 'failed'];

      for (const status of statuses) {
        const result = EpisodeStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const result = EpisodeStatusSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });
});
```

#### 1.2 Create Episode Service Tests

**File:** `packages/runner/src/episode/__tests__/episode-service.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEpisodeService, EpisodeService } from '../episode-service';
import { createMockDb, createMockAudit, createMockRlmEnv } from '@rtv/testing';
import { EpisodeConfig } from '../types';

describe('EpisodeService', () => {
  let service: EpisodeService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockAudit: ReturnType<typeof createMockAudit>;
  let mockRlmEnv: ReturnType<typeof createMockRlmEnv>;

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
    mockDb = createMockDb();
    mockAudit = createMockAudit();
    mockRlmEnv = createMockRlmEnv();

    service = createEpisodeService({
      db: mockDb,
      audit: mockAudit,
      rlmEnv: mockRlmEnv,
    });
  });

  describe('create', () => {
    it('should create episode with CREATED status', async () => {
      mockDb.insert.mockResolvedValue([{
        id: 'ep_test',
        status: 'created',
        ...defaultConfig,
      }]);

      const episode = await service.create(defaultConfig);

      expect(episode.id).toMatch(/^ep_/);
      expect(episode.status).toBe('created');
      expect(episode.agentId).toBe('agent_copy');
    });

    it('should emit EPISODE_CREATED audit event', async () => {
      mockDb.insert.mockResolvedValue([{ id: 'ep_test', status: 'created' }]);

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
      mockDb.insert.mockResolvedValue([{
        id: 'ep_test',
        status: 'created',
        budgetState: {
          tokensUsed: 0,
          timeElapsedMs: 0,
          retriesUsed: 0,
          subcallsUsed: 0,
          toolCallsUsed: 0,
        },
      }]);

      const episode = await service.create(defaultConfig);

      expect(episode.budgetState.tokensUsed).toBe(0);
    });

    it('should link to parent episode if provided', async () => {
      const configWithParent = {
        ...defaultConfig,
        parentEpisodeId: 'ep_parent',
      };

      mockDb.insert.mockResolvedValue([{
        id: 'ep_child',
        status: 'created',
        parentEpisodeId: 'ep_parent',
      }]);

      const episode = await service.create(configWithParent);

      expect(episode.parentEpisodeId).toBe('ep_parent');
    });
  });

  describe('start', () => {
    it('should transition from CREATED to RUNNING', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_test',
        status: 'created',
      }]);
      mockDb.update.mockResolvedValue([{
        id: 'ep_test',
        status: 'running',
        startedAt: new Date(),
      }]);

      const episode = await service.start('ep_test');

      expect(episode.status).toBe('running');
      expect(episode.startedAt).toBeDefined();
    });

    it('should reject start if not CREATED', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_test',
        status: 'running',
      }]);

      await expect(service.start('ep_test'))
        .rejects.toThrow('Cannot start episode in status: running');
    });

    it('should create RLM session', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_test',
        status: 'created',
        budget: defaultConfig.budget,
        clientId: 'client_abc',
      }]);
      mockDb.update.mockResolvedValue([{
        id: 'ep_test',
        status: 'running',
      }]);

      await service.start('ep_test');

      expect(mockRlmEnv.createSession).toHaveBeenCalledWith({
        episodeId: 'ep_test',
        clientId: 'client_abc',
        budget: expect.objectContaining({
          maxTokens: 100000,
        }),
      });
    });

    it('should emit EPISODE_STARTED audit event', async () => {
      mockDb.query.mockResolvedValue([{ id: 'ep_test', status: 'created' }]);
      mockDb.update.mockResolvedValue([{ id: 'ep_test', status: 'running' }]);

      await service.start('ep_test');

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'EPISODE_STARTED',
        actor: 'system',
        target: 'ep_test',
        metadata: expect.any(Object),
      });
    });
  });

  describe('suspend', () => {
    it('should transition from RUNNING to SUSPENDED', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_test',
        status: 'running',
        startedAt: new Date(Date.now() - 60000),
      }]);
      mockDb.update.mockResolvedValue([{
        id: 'ep_test',
        status: 'suspended',
        suspendedAt: new Date(),
      }]);

      const episode = await service.suspend('ep_test', 'Awaiting human approval');

      expect(episode.status).toBe('suspended');
      expect(episode.suspendedAt).toBeDefined();
    });

    it('should save checkpoint before suspending', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_test',
        status: 'running',
      }]);
      mockDb.update.mockResolvedValue([{ id: 'ep_test', status: 'suspended' }]);

      await service.suspend('ep_test', 'Awaiting approval', {
        currentStep: 3,
        intermediateResults: ['draft caption'],
      });

      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          checkpoint: {
            currentStep: 3,
            intermediateResults: ['draft caption'],
          },
        })
      );
    });
  });

  describe('resume', () => {
    it('should transition from SUSPENDED to RUNNING', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_test',
        status: 'suspended',
        checkpoint: { currentStep: 3 },
      }]);
      mockDb.update.mockResolvedValue([{
        id: 'ep_test',
        status: 'running',
        resumedAt: new Date(),
      }]);

      const episode = await service.resume('ep_test');

      expect(episode.status).toBe('running');
      expect(episode.checkpoint).toEqual({ currentStep: 3 });
    });

    it('should restore RLM session on resume', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_test',
        status: 'suspended',
        budget: defaultConfig.budget,
        budgetState: { tokensUsed: 5000 },
        clientId: 'client_abc',
      }]);
      mockDb.update.mockResolvedValue([{ id: 'ep_test', status: 'running' }]);

      await service.resume('ep_test');

      expect(mockRlmEnv.restoreSession).toHaveBeenCalledWith({
        episodeId: 'ep_test',
        clientId: 'client_abc',
        budgetState: { tokensUsed: 5000 },
      });
    });
  });

  describe('complete', () => {
    it('should transition from RUNNING to COMPLETED', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_test',
        status: 'running',
        startedAt: new Date(Date.now() - 60000),
      }]);
      mockDb.update.mockResolvedValue([{
        id: 'ep_test',
        status: 'completed',
        completedAt: new Date(),
      }]);

      const episode = await service.complete('ep_test', {
        outputs: { caption: 'Generated caption' },
        artifacts: ['artifact_123'],
      });

      expect(episode.status).toBe('completed');
      expect(episode.completedAt).toBeDefined();
    });

    it('should record final budget state', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_test',
        status: 'running',
      }]);
      mockRlmEnv.getSession.mockResolvedValue({
        budgetState: {
          tokensUsed: 50000,
          timeElapsedMs: 120000,
        },
      });
      mockDb.update.mockResolvedValue([{ id: 'ep_test', status: 'completed' }]);

      await service.complete('ep_test', { outputs: {} });

      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetState: expect.objectContaining({
            tokensUsed: 50000,
          }),
        })
      );
    });

    it('should close RLM session', async () => {
      mockDb.query.mockResolvedValue([{ id: 'ep_test', status: 'running' }]);
      mockDb.update.mockResolvedValue([{ id: 'ep_test', status: 'completed' }]);

      await service.complete('ep_test', { outputs: {} });

      expect(mockRlmEnv.closeSession).toHaveBeenCalledWith('ep_test');
    });
  });

  describe('fail', () => {
    it('should transition to FAILED with error', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_test',
        status: 'running',
      }]);
      mockDb.update.mockResolvedValue([{
        id: 'ep_test',
        status: 'failed',
        error: { message: 'LLM timeout', code: 'TIMEOUT' },
      }]);

      const episode = await service.fail('ep_test', {
        message: 'LLM timeout',
        code: 'TIMEOUT',
      });

      expect(episode.status).toBe('failed');
      expect(episode.error?.code).toBe('TIMEOUT');
    });

    it('should emit EPISODE_FAILED audit event', async () => {
      mockDb.query.mockResolvedValue([{ id: 'ep_test', status: 'running' }]);
      mockDb.update.mockResolvedValue([{ id: 'ep_test', status: 'failed' }]);

      await service.fail('ep_test', { message: 'Error', code: 'ERR' });

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'EPISODE_FAILED',
        actor: 'system',
        target: 'ep_test',
        metadata: expect.objectContaining({
          errorCode: 'ERR',
        }),
      });
    });
  });

  describe('retry', () => {
    it('should create new episode from failed one', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_failed',
        status: 'failed',
        agentId: 'agent_copy',
        taskType: 'generate_caption',
        clientId: 'client_abc',
        budget: defaultConfig.budget,
        budgetState: { retriesUsed: 1, maxRetries: 3 },
        input: { planNodeId: 'pn_123' },
      }]);
      mockDb.insert.mockResolvedValue([{
        id: 'ep_retry',
        status: 'created',
        parentEpisodeId: 'ep_failed',
      }]);

      const newEpisode = await service.retry('ep_failed');

      expect(newEpisode.id).not.toBe('ep_failed');
      expect(newEpisode.parentEpisodeId).toBe('ep_failed');
    });

    it('should reject retry if max retries exceeded', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_failed',
        status: 'failed',
        budget: { maxRetries: 3 },
        budgetState: { retriesUsed: 3 },
      }]);

      await expect(service.retry('ep_failed'))
        .rejects.toThrow('Max retries exceeded');
    });

    it('should increment retry count', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_failed',
        status: 'failed',
        budget: { maxRetries: 3 },
        budgetState: { retriesUsed: 1 },
        agentId: 'agent_copy',
        taskType: 'test',
        clientId: 'client_abc',
        input: {},
      }]);
      mockDb.insert.mockResolvedValue([{
        id: 'ep_retry',
        budgetState: { retriesUsed: 2 },
      }]);

      const newEpisode = await service.retry('ep_failed');

      expect(newEpisode.budgetState.retriesUsed).toBe(2);
    });
  });

  describe('getById', () => {
    it('should return episode by ID', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_test',
        status: 'running',
        agentId: 'agent_copy',
      }]);

      const episode = await service.getById('ep_test');

      expect(episode?.id).toBe('ep_test');
    });

    it('should return null for unknown ID', async () => {
      mockDb.query.mockResolvedValue([]);

      const episode = await service.getById('ep_unknown');

      expect(episode).toBeNull();
    });
  });

  describe('listByClient', () => {
    it('should list episodes for client', async () => {
      mockDb.query.mockResolvedValue([
        { id: 'ep_1', clientId: 'client_abc' },
        { id: 'ep_2', clientId: 'client_abc' },
      ]);

      const episodes = await service.listByClient('client_abc');

      expect(episodes).toHaveLength(2);
    });

    it('should filter by status', async () => {
      mockDb.query.mockResolvedValue([
        { id: 'ep_1', status: 'running' },
      ]);

      const episodes = await service.listByClient('client_abc', {
        status: 'running',
      });

      expect(episodes[0].status).toBe('running');
    });
  });

  describe('updateBudgetState', () => {
    it('should update budget consumption', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'ep_test',
        status: 'running',
        budgetState: { tokensUsed: 10000 },
      }]);
      mockDb.update.mockResolvedValue([{
        id: 'ep_test',
        budgetState: { tokensUsed: 15000 },
      }]);

      await service.updateBudgetState('ep_test', {
        tokensUsed: 5000,
      });

      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetState: expect.objectContaining({
            tokensUsed: 15000,
          }),
        })
      );
    });
  });
});
```

#### 1.3 Create Episode State Machine Tests

**File:** `packages/runner/src/episode/__tests__/state-machine.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createEpisodeStateMachine, isValidTransition } from '../state-machine';
import { EpisodeStatus } from '../types';

describe('Episode State Machine', () => {
  describe('isValidTransition', () => {
    const validTransitions: [EpisodeStatus, EpisodeStatus][] = [
      ['created', 'running'],
      ['running', 'suspended'],
      ['running', 'completed'],
      ['running', 'failed'],
      ['suspended', 'running'],
      ['suspended', 'failed'],
      ['failed', 'created'], // retry creates new episode
    ];

    it.each(validTransitions)('should allow %s -> %s', (from, to) => {
      expect(isValidTransition(from, to)).toBe(true);
    });

    const invalidTransitions: [EpisodeStatus, EpisodeStatus][] = [
      ['created', 'completed'],
      ['created', 'suspended'],
      ['completed', 'running'],
      ['completed', 'failed'],
      ['failed', 'running'],
      ['suspended', 'completed'],
    ];

    it.each(invalidTransitions)('should reject %s -> %s', (from, to) => {
      expect(isValidTransition(from, to)).toBe(false);
    });
  });

  describe('createEpisodeStateMachine', () => {
    it('should start in CREATED state', () => {
      const machine = createEpisodeStateMachine();
      expect(machine.currentState).toBe('created');
    });

    it('should transition through valid states', () => {
      const machine = createEpisodeStateMachine();

      machine.transition('running');
      expect(machine.currentState).toBe('running');

      machine.transition('suspended');
      expect(machine.currentState).toBe('suspended');

      machine.transition('running');
      expect(machine.currentState).toBe('running');

      machine.transition('completed');
      expect(machine.currentState).toBe('completed');
    });

    it('should throw on invalid transition', () => {
      const machine = createEpisodeStateMachine();

      expect(() => machine.transition('completed'))
        .toThrow('Invalid transition from created to completed');
    });

    it('should track transition history', () => {
      const machine = createEpisodeStateMachine();

      machine.transition('running');
      machine.transition('completed');

      expect(machine.history).toEqual([
        { from: 'created', to: 'running', timestamp: expect.any(Number) },
        { from: 'running', to: 'completed', timestamp: expect.any(Number) },
      ]);
    });

    it('should support canTransition check', () => {
      const machine = createEpisodeStateMachine();

      expect(machine.canTransition('running')).toBe(true);
      expect(machine.canTransition('completed')).toBe(false);
    });
  });
});
```

#### 1.4 Run Tests (Expect Failures)

```bash
cd packages/runner
pnpm test:watch src/episode/
```

---

### Phase 2: Implementation

#### 2.1 Create Episode Types

**File:** `packages/runner/src/episode/types.ts`

```typescript
import { z } from 'zod';

/**
 * Episode Status
 */
export const EpisodeStatusSchema = z.enum([
  'created',
  'running',
  'suspended',
  'completed',
  'failed',
]);
export type EpisodeStatus = z.infer<typeof EpisodeStatusSchema>;

/**
 * Episode Budget Definition
 */
export const EpisodeBudgetSchema = z.object({
  maxTokens: z.number().int().positive().optional(),
  maxTimeMs: z.number().int().positive().optional(),
  maxRetries: z.number().int().min(0).optional(),
  maxSubcalls: z.number().int().min(0).optional(),
  maxToolCalls: z.number().int().min(0).optional(),
});
export type EpisodeBudget = z.infer<typeof EpisodeBudgetSchema>;

/**
 * Budget State (consumption tracking)
 */
export const BudgetStateSchema = z.object({
  tokensUsed: z.number().int().min(0).default(0),
  timeElapsedMs: z.number().int().min(0).default(0),
  retriesUsed: z.number().int().min(0).default(0),
  subcallsUsed: z.number().int().min(0).default(0),
  toolCallsUsed: z.number().int().min(0).default(0),
});
export type BudgetState = z.infer<typeof BudgetStateSchema>;

/**
 * Episode Configuration (for creation)
 */
export const EpisodeConfigSchema = z.object({
  agentId: z.string(),
  taskType: z.string(),
  clientId: z.string(),
  budget: EpisodeBudgetSchema,
  input: z.record(z.unknown()),
  parentEpisodeId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type EpisodeConfig = z.infer<typeof EpisodeConfigSchema>;

/**
 * Episode Error
 */
export const EpisodeErrorSchema = z.object({
  message: z.string(),
  code: z.string(),
  stack: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  retryable: z.boolean().default(false),
});
export type EpisodeError = z.infer<typeof EpisodeErrorSchema>;

/**
 * Episode Checkpoint (for suspension/resumption)
 */
export const EpisodeCheckpointSchema = z.object({
  currentStep: z.number().int().min(0),
  intermediateResults: z.array(z.unknown()).optional(),
  toolState: z.record(z.unknown()).optional(),
  memoryReferences: z.array(z.string()).optional(),
  customData: z.record(z.unknown()).optional(),
});
export type EpisodeCheckpoint = z.infer<typeof EpisodeCheckpointSchema>;

/**
 * Episode Outputs (for completion)
 */
export const EpisodeOutputsSchema = z.object({
  outputs: z.record(z.unknown()),
  artifacts: z.array(z.string()).optional(),
  summaries: z.array(z.object({
    type: z.string(),
    content: z.string(),
    refId: z.string().optional(),
  })).optional(),
});
export type EpisodeOutputs = z.infer<typeof EpisodeOutputsSchema>;

/**
 * Full Episode Entity
 */
export const EpisodeSchema = z.object({
  // Identity
  id: z.string(),
  agentId: z.string(),
  taskType: z.string(),
  clientId: z.string(),

  // Hierarchy
  parentEpisodeId: z.string().nullable(),
  childEpisodeIds: z.array(z.string()),

  // State
  status: EpisodeStatusSchema,
  budget: EpisodeBudgetSchema,
  budgetState: BudgetStateSchema,

  // Input/Output
  input: z.record(z.unknown()),
  outputs: z.record(z.unknown()).nullable(),
  artifacts: z.array(z.string()),

  // Suspension
  checkpoint: EpisodeCheckpointSchema.nullable(),

  // Error handling
  error: EpisodeErrorSchema.nullable(),

  // Timestamps
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  suspendedAt: z.date().nullable(),
  resumedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  failedAt: z.date().nullable(),

  // Metadata
  metadata: z.record(z.unknown()),
});
export type Episode = z.infer<typeof EpisodeSchema>;

/**
 * Episode List Options
 */
export const EpisodeListOptionsSchema = z.object({
  status: EpisodeStatusSchema.optional(),
  agentId: z.string().optional(),
  taskType: z.string().optional(),
  parentEpisodeId: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  limit: z.number().int().positive().default(100),
  offset: z.number().int().min(0).default(0),
});
export type EpisodeListOptions = z.infer<typeof EpisodeListOptionsSchema>;

/**
 * Budget Update
 */
export const BudgetUpdateSchema = z.object({
  tokensUsed: z.number().int().min(0).optional(),
  timeElapsedMs: z.number().int().min(0).optional(),
  subcallsUsed: z.number().int().min(0).optional(),
  toolCallsUsed: z.number().int().min(0).optional(),
});
export type BudgetUpdate = z.infer<typeof BudgetUpdateSchema>;
```

#### 2.2 Create State Machine

**File:** `packages/runner/src/episode/state-machine.ts`

```typescript
import { EpisodeStatus } from './types';

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<EpisodeStatus, EpisodeStatus[]> = {
  created: ['running'],
  running: ['suspended', 'completed', 'failed'],
  suspended: ['running', 'failed'],
  completed: [], // Terminal state
  failed: ['created'], // Retry creates new episode
};

/**
 * Check if a transition is valid
 */
export function isValidTransition(from: EpisodeStatus, to: EpisodeStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Transition history entry
 */
export interface TransitionHistoryEntry {
  from: EpisodeStatus;
  to: EpisodeStatus;
  timestamp: number;
  reason?: string;
}

/**
 * Episode State Machine
 */
export interface EpisodeStateMachine {
  currentState: EpisodeStatus;
  history: TransitionHistoryEntry[];
  canTransition(to: EpisodeStatus): boolean;
  transition(to: EpisodeStatus, reason?: string): void;
  getValidTransitions(): EpisodeStatus[];
}

/**
 * Create a new episode state machine
 */
export function createEpisodeStateMachine(initialState: EpisodeStatus = 'created'): EpisodeStateMachine {
  let currentState = initialState;
  const history: TransitionHistoryEntry[] = [];

  return {
    get currentState() {
      return currentState;
    },

    get history() {
      return [...history];
    },

    canTransition(to: EpisodeStatus): boolean {
      return isValidTransition(currentState, to);
    },

    transition(to: EpisodeStatus, reason?: string): void {
      if (!isValidTransition(currentState, to)) {
        throw new Error(`Invalid transition from ${currentState} to ${to}`);
      }

      history.push({
        from: currentState,
        to,
        timestamp: Date.now(),
        reason,
      });

      currentState = to;
    },

    getValidTransitions(): EpisodeStatus[] {
      return VALID_TRANSITIONS[currentState];
    },
  };
}

/**
 * Terminal states (no further transitions possible)
 */
export function isTerminalState(status: EpisodeStatus): boolean {
  return status === 'completed'; // failed can retry
}

/**
 * Active states (episode is consuming resources)
 */
export function isActiveState(status: EpisodeStatus): boolean {
  return status === 'running';
}
```

#### 2.3 Create Episode Schema

**File:** `packages/db/src/schema/episodes.ts`

```typescript
import {
  pgTable,
  varchar,
  timestamp,
  jsonb,
  index,
  integer,
} from 'drizzle-orm/pg-core';
import {
  EpisodeStatus,
  EpisodeBudget,
  BudgetState,
  EpisodeCheckpoint,
  EpisodeError,
} from '@rtv/runner';

/**
 * Episodes Table
 */
export const episodes = pgTable('episodes', {
  // Identity
  id: varchar('id', { length: 36 }).primaryKey(),
  agentId: varchar('agent_id', { length: 100 }).notNull(),
  taskType: varchar('task_type', { length: 100 }).notNull(),
  clientId: varchar('client_id', { length: 36 }).notNull(),

  // Hierarchy
  parentEpisodeId: varchar('parent_episode_id', { length: 36 }),

  // State
  status: varchar('status', { length: 20 }).notNull().$type<EpisodeStatus>(),
  budget: jsonb('budget').$type<EpisodeBudget>().notNull(),
  budgetState: jsonb('budget_state').$type<BudgetState>().notNull(),

  // Input/Output
  input: jsonb('input').notNull(),
  outputs: jsonb('outputs'),
  artifacts: jsonb('artifacts').$type<string[]>().default([]),

  // Suspension
  checkpoint: jsonb('checkpoint').$type<EpisodeCheckpoint>(),

  // Error handling
  error: jsonb('error').$type<EpisodeError>(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  resumedAt: timestamp('resumed_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),

  // Metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  clientIdx: index('episodes_client_idx').on(table.clientId),
  statusIdx: index('episodes_status_idx').on(table.status),
  agentIdx: index('episodes_agent_idx').on(table.agentId),
  parentIdx: index('episodes_parent_idx').on(table.parentEpisodeId),
  createdAtIdx: index('episodes_created_at_idx').on(table.createdAt),
}));

/**
 * Episode Transitions Table (audit trail)
 */
export const episodeTransitions = pgTable('episode_transitions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  episodeId: varchar('episode_id', { length: 36 }).notNull()
    .references(() => episodes.id),
  fromStatus: varchar('from_status', { length: 20 }).notNull().$type<EpisodeStatus>(),
  toStatus: varchar('to_status', { length: 20 }).notNull().$type<EpisodeStatus>(),
  reason: varchar('reason', { length: 500 }),
  metadata: jsonb('metadata'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  episodeIdx: index('episode_transitions_episode_idx').on(table.episodeId),
}));

// Type exports
export type EpisodeRow = typeof episodes.$inferSelect;
export type NewEpisodeRow = typeof episodes.$inferInsert;
export type EpisodeTransitionRow = typeof episodeTransitions.$inferSelect;
```

#### 2.4 Create Episode Service

**File:** `packages/runner/src/episode/episode-service.ts`

```typescript
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  Episode,
  EpisodeConfig,
  EpisodeStatus,
  EpisodeError,
  EpisodeCheckpoint,
  EpisodeOutputs,
  EpisodeListOptions,
  BudgetUpdate,
  BudgetState,
  EpisodeConfigSchema,
  EpisodeOutputsSchema,
} from './types';
import { isValidTransition, createEpisodeStateMachine } from './state-machine';
import type { RlmEnv } from '@rtv/memory';
import type { AuditEmitter } from '@rtv/audit';
import { episodes, episodeTransitions } from '@rtv/db';

const tracer = trace.getTracer('episode-service');

interface EpisodeServiceDeps {
  db: {
    select: () => any;
    insert: (table: any) => any;
    update: (table: any) => any;
  };
  audit: AuditEmitter;
  rlmEnv: RlmEnv;
}

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

export function createEpisodeService(deps: EpisodeServiceDeps): EpisodeService {
  const { db, audit, rlmEnv } = deps;

  /**
   * Record a state transition
   */
  async function recordTransition(
    episodeId: string,
    from: EpisodeStatus,
    to: EpisodeStatus,
    reason?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await db.insert(episodeTransitions).values({
      id: `et_${nanoid()}`,
      episodeId,
      fromStatus: from,
      toStatus: to,
      reason,
      metadata,
      occurredAt: new Date(),
    });
  }

  /**
   * Get episode by ID with validation
   */
  async function getEpisodeOrThrow(episodeId: string): Promise<Episode> {
    const [episode] = await db.select().from(episodes).where(eq(episodes.id, episodeId));
    if (!episode) {
      throw new Error(`Episode not found: ${episodeId}`);
    }
    return episode as Episode;
  }

  /**
   * Update episode and record transition
   */
  async function transitionEpisode(
    episodeId: string,
    toStatus: EpisodeStatus,
    updates: Partial<Episode>,
    reason?: string
  ): Promise<Episode> {
    const episode = await getEpisodeOrThrow(episodeId);

    if (!isValidTransition(episode.status, toStatus)) {
      throw new Error(`Cannot transition episode from ${episode.status} to ${toStatus}`);
    }

    const now = new Date();
    const [updated] = await db
      .update(episodes)
      .set({
        status: toStatus,
        ...updates,
      })
      .where(eq(episodes.id, episodeId))
      .returning();

    await recordTransition(episodeId, episode.status, toStatus, reason);

    return updated as Episode;
  }

  return {
    async create(config: EpisodeConfig): Promise<Episode> {
      return tracer.startActiveSpan('episode.create', async (span) => {
        try {
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

          const [episode] = await db.insert(episodes).values({
            id,
            agentId: validated.agentId,
            taskType: validated.taskType,
            clientId: validated.clientId,
            parentEpisodeId: validated.parentEpisodeId || null,
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
          }).returning();

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

          span.setStatus({ code: SpanStatusCode.OK });
          return episode as Episode;
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
          throw error;
        } finally {
          span.end();
        }
      });
    },

    async start(episodeId: string): Promise<Episode> {
      return tracer.startActiveSpan('episode.start', async (span) => {
        span.setAttribute('episode.id', episodeId);

        try {
          const episode = await getEpisodeOrThrow(episodeId);

          if (episode.status !== 'created') {
            throw new Error(`Cannot start episode in status: ${episode.status}`);
          }

          // Create RLM session
          await rlmEnv.createSession({
            episodeId,
            clientId: episode.clientId,
            budget: episode.budget,
          });

          const now = new Date();
          const updated = await transitionEpisode(
            episodeId,
            'running',
            { startedAt: now },
            'Episode started'
          );

          await audit.emit({
            type: 'EPISODE_STARTED',
            actor: 'system',
            target: episodeId,
            metadata: {
              agentId: episode.agentId,
              taskType: episode.taskType,
            },
          });

          span.setStatus({ code: SpanStatusCode.OK });
          return updated;
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
          throw error;
        } finally {
          span.end();
        }
      });
    },

    async suspend(episodeId: string, reason: string, checkpoint?: EpisodeCheckpoint): Promise<Episode> {
      return tracer.startActiveSpan('episode.suspend', async (span) => {
        span.setAttribute('episode.id', episodeId);

        try {
          const episode = await getEpisodeOrThrow(episodeId);

          const now = new Date();
          const updated = await transitionEpisode(
            episodeId,
            'suspended',
            {
              suspendedAt: now,
              checkpoint: checkpoint || null,
            },
            reason
          );

          await audit.emit({
            type: 'EPISODE_SUSPENDED',
            actor: 'system',
            target: episodeId,
            metadata: {
              reason,
              hasCheckpoint: !!checkpoint,
            },
          });

          span.setStatus({ code: SpanStatusCode.OK });
          return updated;
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
          throw error;
        } finally {
          span.end();
        }
      });
    },

    async resume(episodeId: string): Promise<Episode> {
      return tracer.startActiveSpan('episode.resume', async (span) => {
        span.setAttribute('episode.id', episodeId);

        try {
          const episode = await getEpisodeOrThrow(episodeId);

          // Restore RLM session
          await rlmEnv.restoreSession({
            episodeId,
            clientId: episode.clientId,
            budgetState: episode.budgetState,
          });

          const now = new Date();
          const updated = await transitionEpisode(
            episodeId,
            'running',
            { resumedAt: now },
            'Episode resumed'
          );

          await audit.emit({
            type: 'EPISODE_RESUMED',
            actor: 'system',
            target: episodeId,
            metadata: {
              hasCheckpoint: !!episode.checkpoint,
            },
          });

          span.setStatus({ code: SpanStatusCode.OK });
          return updated;
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
          throw error;
        } finally {
          span.end();
        }
      });
    },

    async complete(episodeId: string, outputs: EpisodeOutputs): Promise<Episode> {
      return tracer.startActiveSpan('episode.complete', async (span) => {
        span.setAttribute('episode.id', episodeId);

        try {
          const validated = EpisodeOutputsSchema.parse(outputs);

          // Get final budget state from RLM session
          const session = await rlmEnv.getSession(episodeId);
          const finalBudgetState = session?.budgetState;

          // Close RLM session
          await rlmEnv.closeSession(episodeId);

          const now = new Date();
          const updated = await transitionEpisode(
            episodeId,
            'completed',
            {
              completedAt: now,
              outputs: validated.outputs,
              artifacts: validated.artifacts || [],
              budgetState: finalBudgetState,
            },
            'Episode completed'
          );

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

          span.setStatus({ code: SpanStatusCode.OK });
          return updated;
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
          throw error;
        } finally {
          span.end();
        }
      });
    },

    async fail(episodeId: string, error: EpisodeError): Promise<Episode> {
      return tracer.startActiveSpan('episode.fail', async (span) => {
        span.setAttribute('episode.id', episodeId);
        span.setAttribute('error.code', error.code);

        try {
          // Try to close RLM session
          try {
            await rlmEnv.closeSession(episodeId);
          } catch {
            // Ignore errors closing session
          }

          const now = new Date();
          const updated = await transitionEpisode(
            episodeId,
            'failed',
            {
              failedAt: now,
              error,
            },
            `Failed: ${error.code}`
          );

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

          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          return updated;
        } catch (err) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
          throw err;
        } finally {
          span.end();
        }
      });
    },

    async retry(episodeId: string): Promise<Episode> {
      return tracer.startActiveSpan('episode.retry', async (span) => {
        span.setAttribute('episode.id', episodeId);

        try {
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
          await db.update(episodes)
            .set({
              budgetState: {
                ...newEpisode.budgetState,
                retriesUsed: retriesUsed + 1,
              },
            })
            .where(eq(episodes.id, newEpisode.id));

          await audit.emit({
            type: 'EPISODE_RETRIED',
            actor: 'system',
            target: newEpisode.id,
            metadata: {
              originalEpisodeId: episode.id,
              retryAttempt: retriesUsed + 1,
            },
          });

          span.setStatus({ code: SpanStatusCode.OK });
          return { ...newEpisode, budgetState: { ...newEpisode.budgetState, retriesUsed: retriesUsed + 1 } };
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
          throw error;
        } finally {
          span.end();
        }
      });
    },

    async getById(episodeId: string): Promise<Episode | null> {
      const [episode] = await db.select().from(episodes).where(eq(episodes.id, episodeId));
      return episode as Episode || null;
    },

    async listByClient(clientId: string, options?: EpisodeListOptions): Promise<Episode[]> {
      let query = db.select().from(episodes).where(eq(episodes.clientId, clientId));

      if (options?.status) {
        query = query.where(eq(episodes.status, options.status));
      }
      if (options?.agentId) {
        query = query.where(eq(episodes.agentId, options.agentId));
      }
      if (options?.taskType) {
        query = query.where(eq(episodes.taskType, options.taskType));
      }
      if (options?.parentEpisodeId) {
        query = query.where(eq(episodes.parentEpisodeId, options.parentEpisodeId));
      }
      if (options?.createdAfter) {
        query = query.where(gte(episodes.createdAt, options.createdAfter));
      }
      if (options?.createdBefore) {
        query = query.where(lte(episodes.createdAt, options.createdBefore));
      }

      query = query
        .orderBy(desc(episodes.createdAt))
        .limit(options?.limit || 100)
        .offset(options?.offset || 0);

      return query as Promise<Episode[]>;
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

      await db.update(episodes)
        .set({ budgetState: newBudgetState })
        .where(eq(episodes.id, episodeId));
    },
  };
}
```

#### 2.5 Create Module Index

**File:** `packages/runner/src/episode/index.ts`

```typescript
export * from './types';
export * from './state-machine';
export * from './episode-service';
```

---

### Phase 3: Verification

#### 3.1 Run Tests

```bash
# Run all episode tests
cd packages/runner
pnpm test src/episode/

# Run with coverage
pnpm test:coverage src/episode/
```

#### 3.2 Type Check

```bash
pnpm typecheck
```

#### 3.3 Lint

```bash
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/runner/src/episode/types.ts` | Type definitions |
| Create | `packages/runner/src/episode/state-machine.ts` | State machine |
| Create | `packages/runner/src/episode/episode-service.ts` | Episode service |
| Create | `packages/runner/src/episode/index.ts` | Module exports |
| Create | `packages/db/src/schema/episodes.ts` | Database schema |
| Modify | `packages/db/src/schema/index.ts` | Export episodes |
| Create | `packages/runner/src/episode/__tests__/types.test.ts` | Type tests |
| Create | `packages/runner/src/episode/__tests__/episode-service.test.ts` | Service tests |
| Create | `packages/runner/src/episode/__tests__/state-machine.test.ts` | State machine tests |

---

## Acceptance Criteria

- [ ] Episode creation with initial CREATED status
- [ ] State transitions validated by state machine
- [ ] Start creates RLM session with budget
- [ ] Suspend saves checkpoint for resumption
- [ ] Resume restores RLM session
- [ ] Complete records outputs and closes session
- [ ] Fail records error with retryable flag
- [ ] Retry creates new episode if budget allows
- [ ] Budget state tracked throughout lifecycle
- [ ] Transition history recorded in database
- [ ] Audit events emitted for all transitions
- [ ] All tests pass with >80% coverage
- [ ] TypeScript compiles with no errors

---

## Test Requirements

### Unit Tests

- State machine transitions (valid/invalid)
- Budget state calculation
- Checkpoint serialization
- Error handling

### Integration Tests

- Full lifecycle: create → start → complete
- Suspend/resume with checkpoint
- Retry with budget check
- RLM session management

### Performance Tests

- Episode creation <50ms
- State transition <20ms
- Query performance with indexes

---

## Security & Safety Checklist

- [ ] Client isolation: episodes scoped to client
- [ ] Budget enforcement: cannot exceed limits
- [ ] Audit trail: all transitions logged
- [ ] No secrets in episode data
- [ ] Checkpoint data validated before storage

---

## JSON Task Block

```json
{
  "task_id": "S1-D1",
  "name": "Episode Lifecycle Management",
  "status": "pending",
  "complexity": "high",
  "sprint": 1,
  "agent": "D",
  "dependencies": ["S1-B1", "S1-C5"],
  "blocks": ["S1-D2", "S1-D3", "S1-D4", "S1-D5", "S2-A1"],
  "estimated_hours": 7,
  "actual_hours": null,
  "files": [
    "packages/runner/src/episode/types.ts",
    "packages/runner/src/episode/state-machine.ts",
    "packages/runner/src/episode/episode-service.ts",
    "packages/runner/src/episode/index.ts",
    "packages/db/src/schema/episodes.ts"
  ],
  "test_files": [
    "packages/runner/src/episode/__tests__/types.test.ts",
    "packages/runner/src/episode/__tests__/episode-service.test.ts",
    "packages/runner/src/episode/__tests__/state-machine.test.ts"
  ],
  "acceptance_criteria": [
    "Episode state machine with valid transitions",
    "Full lifecycle management",
    "Budget tracking",
    "Checkpoint/resume support",
    "RLM session integration"
  ]
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "artifacts": {
    "files_created": [],
    "tests_passed": null,
    "coverage_percent": null
  },
  "learnings": [],
  "blockers_encountered": []
}
```
