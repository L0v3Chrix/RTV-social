# Build Prompt: S1-D5 — Checkpoint and Resume

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S1-D5 |
| Sprint | 1 |
| Agent | D (Runner Skeleton) |
| Complexity | High |
| Status | pending |
| Estimated Tokens | 5,500 |
| Depends On | S1-D1, S1-D4 |
| Blocks | S2-D1 |

---

## Context

### What We're Building

The checkpoint and resume system enables episodes to be suspended mid-execution and resumed later without losing progress. This supports budget exhaustion recovery, human-in-the-loop approvals, and system restarts while maintaining execution continuity.

### Why It Matters

Long-running agent episodes may need to pause for various reasons:
- Budget warnings requiring human approval to continue
- External approvals needed before proceeding
- System maintenance or restarts
- Rate limit cooldowns

The checkpoint system captures execution state so episodes can resume exactly where they left off.

### Spec References

- Architecture: `/docs/01-architecture/system-architecture-v3.md` (Checkpoints)
- RLM Integration: `/docs/01-architecture/rlm-integration-spec.md` (Episode Persistence)
- Engineering: `/docs/07-engineering-process/engineering-handbook.md`

---

## Prerequisites

### Completed Tasks
- [x] S1-D1: Episode lifecycle service
- [x] S1-D4: Runner state machine

### Required Packages
```bash
pnpm add zod nanoid
pnpm add -D vitest @types/node
```

### Required Knowledge
- Episode state machine
- Serialization strategies
- External memory patterns

---

## Instructions

### Phase 1: Test First (TDD)

Create the test file BEFORE implementation.

**File:** `packages/runner/src/checkpoint/checkpoint-service.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CheckpointService,
  Checkpoint,
  CheckpointData,
  CheckpointStrategy,
} from './checkpoint-service';
import { db } from '@rtv/db';

// Mock database
vi.mock('@rtv/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'cp_test123' }]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
  checkpoints: {},
}));

describe('CheckpointService', () => {
  let service: CheckpointService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CheckpointService();
  });

  describe('create', () => {
    it('should create a checkpoint for an episode', async () => {
      const data: CheckpointData = {
        episodeId: 'ep_test123',
        phase: 'planning',
        progress: { step: 5, total: 10 },
        loopCount: 3,
        context: { lastQuery: 'test query' },
        budgetState: {
          tokens: { used: 5000, limit: 10000 },
          time: { used: 30000, limit: 60000 },
        },
      };

      const checkpoint = await service.create(data);

      expect(checkpoint).toBeDefined();
      expect(checkpoint.episodeId).toBe('ep_test123');
      expect(db.insert).toHaveBeenCalled();
    });

    it('should serialize complex data structures', async () => {
      const data: CheckpointData = {
        episodeId: 'ep_test123',
        phase: 'acting',
        progress: {
          pendingTools: ['tool1', 'tool2'],
          completedTools: ['tool3'],
        },
        loopCount: 5,
        context: {
          planGraph: {
            nodes: [{ id: 'n1' }, { id: 'n2' }],
            edges: [{ from: 'n1', to: 'n2' }],
          },
        },
      };

      await service.create(data);

      expect(db.insert).toHaveBeenCalled();
      // Data should be JSON serializable
      const insertCall = vi.mocked(db.insert).mock.calls[0];
      expect(insertCall).toBeDefined();
    });

    it('should include timestamp on checkpoint', async () => {
      const beforeCreate = new Date();

      const checkpoint = await service.create({
        episodeId: 'ep_test123',
        phase: 'planning',
        progress: {},
        loopCount: 0,
      });

      expect(new Date(checkpoint.createdAt).getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime()
      );
    });

    it('should generate unique checkpoint IDs', async () => {
      vi.mocked(db.returning)
        .mockResolvedValueOnce([{ id: 'cp_abc123' }])
        .mockResolvedValueOnce([{ id: 'cp_def456' }]);

      const checkpoint1 = await service.create({
        episodeId: 'ep_test123',
        phase: 'planning',
        progress: {},
        loopCount: 0,
      });

      const checkpoint2 = await service.create({
        episodeId: 'ep_test123',
        phase: 'acting',
        progress: {},
        loopCount: 1,
      });

      expect(checkpoint1.id).not.toBe(checkpoint2.id);
    });
  });

  describe('getLatest', () => {
    it('should return the latest checkpoint for an episode', async () => {
      const mockCheckpoint = {
        id: 'cp_latest',
        episodeId: 'ep_test123',
        phase: 'observing',
        progress: { step: 8 },
        loopCount: 4,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(db.limit).mockResolvedValueOnce([mockCheckpoint]);

      const checkpoint = await service.getLatest('ep_test123');

      expect(checkpoint).toBeDefined();
      expect(checkpoint?.phase).toBe('observing');
    });

    it('should return null if no checkpoint exists', async () => {
      vi.mocked(db.limit).mockResolvedValueOnce([]);

      const checkpoint = await service.getLatest('ep_nonexistent');

      expect(checkpoint).toBeNull();
    });

    it('should order checkpoints by creation time descending', async () => {
      await service.getLatest('ep_test123');

      expect(db.orderBy).toHaveBeenCalled();
    });
  });

  describe('getByEpisode', () => {
    it('should return all checkpoints for an episode', async () => {
      const mockCheckpoints = [
        { id: 'cp_1', phase: 'planning', loopCount: 0 },
        { id: 'cp_2', phase: 'acting', loopCount: 1 },
        { id: 'cp_3', phase: 'observing', loopCount: 2 },
      ];

      vi.mocked(db.where).mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(mockCheckpoints),
      } as any);

      const checkpoints = await service.getByEpisode('ep_test123');

      expect(checkpoints).toHaveLength(3);
    });

    it('should return empty array if no checkpoints exist', async () => {
      vi.mocked(db.where).mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      } as any);

      const checkpoints = await service.getByEpisode('ep_nonexistent');

      expect(checkpoints).toEqual([]);
    });
  });

  describe('restore', () => {
    it('should restore checkpoint data from ID', async () => {
      const mockCheckpoint = {
        id: 'cp_test123',
        episodeId: 'ep_test123',
        phase: 'planning',
        progress: JSON.stringify({ step: 5 }),
        context: JSON.stringify({ lastQuery: 'test' }),
        loopCount: 3,
        budgetState: JSON.stringify({ tokens: { used: 5000 } }),
        createdAt: new Date().toISOString(),
      };

      vi.mocked(db.limit).mockResolvedValueOnce([mockCheckpoint]);

      const restored = await service.restore('cp_test123');

      expect(restored).toBeDefined();
      expect(restored?.phase).toBe('planning');
      expect(restored?.progress).toEqual({ step: 5 });
    });

    it('should deserialize JSON fields correctly', async () => {
      const mockCheckpoint = {
        id: 'cp_test123',
        episodeId: 'ep_test123',
        phase: 'acting',
        progress: JSON.stringify({
          pendingTools: ['tool1'],
          results: [{ success: true }],
        }),
        context: JSON.stringify({
          planGraph: { nodes: [{ id: 'n1' }] },
        }),
        loopCount: 2,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(db.limit).mockResolvedValueOnce([mockCheckpoint]);

      const restored = await service.restore('cp_test123');

      expect(restored?.progress.pendingTools).toEqual(['tool1']);
      expect(restored?.context?.planGraph?.nodes).toHaveLength(1);
    });

    it('should return null for nonexistent checkpoint', async () => {
      vi.mocked(db.limit).mockResolvedValueOnce([]);

      const restored = await service.restore('cp_nonexistent');

      expect(restored).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a checkpoint by ID', async () => {
      await service.delete('cp_test123');

      expect(db.delete).toHaveBeenCalled();
    });

    it('should delete all checkpoints for an episode', async () => {
      await service.deleteByEpisode('ep_test123');

      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('pruning', () => {
    it('should prune old checkpoints beyond retention limit', async () => {
      const oldCheckpoints = [
        { id: 'cp_old1', createdAt: new Date(Date.now() - 86400000 * 8).toISOString() },
        { id: 'cp_old2', createdAt: new Date(Date.now() - 86400000 * 10).toISOString() },
      ];

      vi.mocked(db.where).mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(oldCheckpoints),
      } as any);

      const deleted = await service.prune({ maxAgeDays: 7 });

      expect(deleted).toBeGreaterThan(0);
    });

    it('should keep recent checkpoints', async () => {
      vi.mocked(db.where).mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      } as any);

      const deleted = await service.prune({ maxAgeDays: 7 });

      expect(deleted).toBe(0);
    });

    it('should prune checkpoints per episode beyond count limit', async () => {
      const manyCheckpoints = Array.from({ length: 15 }, (_, i) => ({
        id: `cp_${i}`,
        episodeId: 'ep_test123',
        createdAt: new Date(Date.now() - i * 1000).toISOString(),
      }));

      vi.mocked(db.where).mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(manyCheckpoints),
      } as any);

      const deleted = await service.pruneByEpisode('ep_test123', { maxCount: 10 });

      expect(deleted).toBe(5);
    });
  });
});

describe('CheckpointStrategy', () => {
  describe('shouldCheckpoint', () => {
    it('should checkpoint on phase completion', () => {
      const strategy = new CheckpointStrategy({ onPhaseComplete: true });

      expect(strategy.shouldCheckpoint({ event: 'PLAN_COMPLETE' })).toBe(true);
      expect(strategy.shouldCheckpoint({ event: 'ACT_COMPLETE' })).toBe(true);
      expect(strategy.shouldCheckpoint({ event: 'OBSERVE_COMPLETE' })).toBe(true);
    });

    it('should checkpoint on loop completion', () => {
      const strategy = new CheckpointStrategy({ onLoopComplete: true });

      expect(
        strategy.shouldCheckpoint({ event: 'OBSERVE_COMPLETE', isLoopEnd: true })
      ).toBe(true);
    });

    it('should checkpoint on budget warning', () => {
      const strategy = new CheckpointStrategy({ onBudgetWarning: true });

      expect(strategy.shouldCheckpoint({ event: 'BUDGET_WARNING' })).toBe(true);
    });

    it('should checkpoint at interval', () => {
      const strategy = new CheckpointStrategy({ intervalMs: 30000 });

      expect(
        strategy.shouldCheckpoint({
          event: 'ACT_COMPLETE',
          lastCheckpointAt: Date.now() - 35000,
        })
      ).toBe(true);

      expect(
        strategy.shouldCheckpoint({
          event: 'ACT_COMPLETE',
          lastCheckpointAt: Date.now() - 10000,
        })
      ).toBe(false);
    });

    it('should combine multiple conditions', () => {
      const strategy = new CheckpointStrategy({
        onPhaseComplete: true,
        onBudgetWarning: true,
        intervalMs: 60000,
      });

      expect(strategy.shouldCheckpoint({ event: 'PLAN_COMPLETE' })).toBe(true);
      expect(strategy.shouldCheckpoint({ event: 'BUDGET_WARNING' })).toBe(true);
      expect(
        strategy.shouldCheckpoint({
          event: 'ACT',
          lastCheckpointAt: Date.now() - 65000,
        })
      ).toBe(true);
    });
  });
});

describe('CheckpointManager', () => {
  let manager: CheckpointManager;
  let mockService: CheckpointService;
  let mockStrategy: CheckpointStrategy;

  beforeEach(() => {
    mockService = {
      create: vi.fn().mockResolvedValue({ id: 'cp_test123' }),
      getLatest: vi.fn().mockResolvedValue(null),
      restore: vi.fn().mockResolvedValue(null),
    } as unknown as CheckpointService;

    mockStrategy = {
      shouldCheckpoint: vi.fn().mockReturnValue(false),
    } as unknown as CheckpointStrategy;

    manager = new CheckpointManager({
      service: mockService,
      strategy: mockStrategy,
    });
  });

  it('should create checkpoint when strategy allows', async () => {
    vi.mocked(mockStrategy.shouldCheckpoint).mockReturnValue(true);

    await manager.maybeCheckpoint({
      episodeId: 'ep_test123',
      event: 'PLAN_COMPLETE',
      state: { phase: 'planning', progress: {}, loopCount: 1 },
    });

    expect(mockService.create).toHaveBeenCalled();
  });

  it('should skip checkpoint when strategy denies', async () => {
    vi.mocked(mockStrategy.shouldCheckpoint).mockReturnValue(false);

    await manager.maybeCheckpoint({
      episodeId: 'ep_test123',
      event: 'PLAN_COMPLETE',
      state: { phase: 'planning', progress: {}, loopCount: 1 },
    });

    expect(mockService.create).not.toHaveBeenCalled();
  });

  it('should track last checkpoint time', async () => {
    vi.mocked(mockStrategy.shouldCheckpoint).mockReturnValue(true);

    await manager.maybeCheckpoint({
      episodeId: 'ep_test123',
      event: 'PLAN_COMPLETE',
      state: { phase: 'planning', progress: {}, loopCount: 1 },
    });

    expect(manager.lastCheckpointAt).toBeDefined();
  });

  it('should restore from latest checkpoint', async () => {
    const mockCheckpoint = {
      id: 'cp_test123',
      phase: 'acting',
      progress: { step: 3 },
      loopCount: 2,
    };

    vi.mocked(mockService.getLatest).mockResolvedValue(mockCheckpoint as any);
    vi.mocked(mockService.restore).mockResolvedValue(mockCheckpoint as any);

    const restored = await manager.restoreLatest('ep_test123');

    expect(restored).toBeDefined();
    expect(restored?.phase).toBe('acting');
  });
});

// Import for manager tests
import { CheckpointManager } from './checkpoint-manager';
```

Run the tests to confirm they fail:

```bash
cd packages/runner
pnpm test src/checkpoint/checkpoint-service.test.ts
```

### Phase 2: Implementation

**File:** `packages/runner/src/checkpoint/types.ts`

```typescript
import { z } from 'zod';

// Checkpoint data schema
export const CheckpointDataSchema = z.object({
  episodeId: z.string(),
  phase: z.string(),
  progress: z.record(z.unknown()),
  loopCount: z.number(),
  context: z.record(z.unknown()).optional(),
  budgetState: z
    .object({
      tokens: z.object({ used: z.number(), limit: z.number() }).optional(),
      time: z.object({ used: z.number(), limit: z.number() }).optional(),
      retries: z.object({ used: z.number(), limit: z.number() }).optional(),
      subcalls: z.object({ used: z.number(), limit: z.number() }).optional(),
      toolCalls: z.object({ used: z.number(), limit: z.number() }).optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CheckpointData = z.infer<typeof CheckpointDataSchema>;

// Stored checkpoint
export interface Checkpoint extends CheckpointData {
  id: string;
  createdAt: string;
  version: number;
}

// Strategy options
export interface CheckpointStrategyOptions {
  onPhaseComplete?: boolean;
  onLoopComplete?: boolean;
  onBudgetWarning?: boolean;
  intervalMs?: number;
  phases?: string[];
}

// Strategy check context
export interface CheckpointCheckContext {
  event: string;
  isLoopEnd?: boolean;
  lastCheckpointAt?: number;
  phase?: string;
}

// Prune options
export interface PruneOptions {
  maxAgeDays?: number;
  maxCount?: number;
}

// Manager options
export interface CheckpointManagerOptions {
  service: unknown;
  strategy: unknown;
}
```

**File:** `packages/runner/src/checkpoint/checkpoint-service.ts`

```typescript
import { nanoid } from 'nanoid';
import { db, checkpoints } from '@rtv/db';
import { eq, desc, lt, and } from 'drizzle-orm';
import {
  Checkpoint,
  CheckpointData,
  CheckpointDataSchema,
  PruneOptions,
} from './types';

export class CheckpointService {
  async create(data: CheckpointData): Promise<Checkpoint> {
    // Validate input
    const validated = CheckpointDataSchema.parse(data);

    const id = `cp_${nanoid(12)}`;
    const now = new Date().toISOString();

    const record = {
      id,
      episodeId: validated.episodeId,
      phase: validated.phase,
      progress: JSON.stringify(validated.progress),
      loopCount: validated.loopCount,
      context: validated.context ? JSON.stringify(validated.context) : null,
      budgetState: validated.budgetState
        ? JSON.stringify(validated.budgetState)
        : null,
      metadata: validated.metadata ? JSON.stringify(validated.metadata) : null,
      version: 1,
      createdAt: now,
    };

    await db.insert(checkpoints).values(record);

    return {
      id,
      ...validated,
      createdAt: now,
      version: 1,
    };
  }

  async getLatest(episodeId: string): Promise<Checkpoint | null> {
    const results = await db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.episodeId, episodeId))
      .orderBy(desc(checkpoints.createdAt))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return this.deserialize(results[0]);
  }

  async getByEpisode(episodeId: string): Promise<Checkpoint[]> {
    const results = await db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.episodeId, episodeId))
      .orderBy(desc(checkpoints.createdAt));

    return results.map((r) => this.deserialize(r));
  }

  async restore(checkpointId: string): Promise<CheckpointData | null> {
    const results = await db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.id, checkpointId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const checkpoint = this.deserialize(results[0]);

    return {
      episodeId: checkpoint.episodeId,
      phase: checkpoint.phase,
      progress: checkpoint.progress,
      loopCount: checkpoint.loopCount,
      context: checkpoint.context,
      budgetState: checkpoint.budgetState,
      metadata: checkpoint.metadata,
    };
  }

  async delete(checkpointId: string): Promise<void> {
    await db.delete(checkpoints).where(eq(checkpoints.id, checkpointId));
  }

  async deleteByEpisode(episodeId: string): Promise<void> {
    await db.delete(checkpoints).where(eq(checkpoints.episodeId, episodeId));
  }

  async prune(options: PruneOptions): Promise<number> {
    const { maxAgeDays = 7 } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const oldCheckpoints = await db
      .select()
      .from(checkpoints)
      .where(lt(checkpoints.createdAt, cutoffDate.toISOString()))
      .orderBy(checkpoints.createdAt);

    for (const cp of oldCheckpoints) {
      await this.delete(cp.id);
    }

    return oldCheckpoints.length;
  }

  async pruneByEpisode(episodeId: string, options: PruneOptions): Promise<number> {
    const { maxCount = 10 } = options;

    const allCheckpoints = await db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.episodeId, episodeId))
      .orderBy(desc(checkpoints.createdAt));

    if (allCheckpoints.length <= maxCount) {
      return 0;
    }

    const toDelete = allCheckpoints.slice(maxCount);

    for (const cp of toDelete) {
      await this.delete(cp.id);
    }

    return toDelete.length;
  }

  private deserialize(record: Record<string, unknown>): Checkpoint {
    return {
      id: record.id as string,
      episodeId: record.episodeId as string,
      phase: record.phase as string,
      progress: this.parseJSON(record.progress as string, {}),
      loopCount: record.loopCount as number,
      context: record.context ? this.parseJSON(record.context as string, undefined) : undefined,
      budgetState: record.budgetState
        ? this.parseJSON(record.budgetState as string, undefined)
        : undefined,
      metadata: record.metadata ? this.parseJSON(record.metadata as string, undefined) : undefined,
      createdAt: record.createdAt as string,
      version: record.version as number,
    };
  }

  private parseJSON<T>(value: string, defaultValue: T): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }
}

export { Checkpoint, CheckpointData };
```

**File:** `packages/runner/src/checkpoint/checkpoint-strategy.ts`

```typescript
import { CheckpointStrategyOptions, CheckpointCheckContext } from './types';

const PHASE_COMPLETE_EVENTS = [
  'PERCEIVE_COMPLETE',
  'PLAN_COMPLETE',
  'ACT_COMPLETE',
  'OBSERVE_COMPLETE',
];

export class CheckpointStrategy {
  private options: CheckpointStrategyOptions;

  constructor(options: CheckpointStrategyOptions = {}) {
    this.options = {
      onPhaseComplete: false,
      onLoopComplete: false,
      onBudgetWarning: false,
      ...options,
    };
  }

  shouldCheckpoint(context: CheckpointCheckContext): boolean {
    // Check phase completion
    if (this.options.onPhaseComplete && PHASE_COMPLETE_EVENTS.includes(context.event)) {
      // If specific phases are configured, check them
      if (this.options.phases) {
        const phase = this.extractPhaseFromEvent(context.event);
        if (!this.options.phases.includes(phase)) {
          return false;
        }
      }
      return true;
    }

    // Check loop completion
    if (this.options.onLoopComplete && context.isLoopEnd) {
      return true;
    }

    // Check budget warning
    if (this.options.onBudgetWarning && context.event === 'BUDGET_WARNING') {
      return true;
    }

    // Check interval
    if (this.options.intervalMs && context.lastCheckpointAt) {
      const elapsed = Date.now() - context.lastCheckpointAt;
      if (elapsed >= this.options.intervalMs) {
        return true;
      }
    }

    return false;
  }

  private extractPhaseFromEvent(event: string): string {
    const mapping: Record<string, string> = {
      PERCEIVE_COMPLETE: 'perceive',
      PLAN_COMPLETE: 'plan',
      ACT_COMPLETE: 'act',
      OBSERVE_COMPLETE: 'observe',
    };
    return mapping[event] ?? 'unknown';
  }
}
```

**File:** `packages/runner/src/checkpoint/checkpoint-manager.ts`

```typescript
import { CheckpointService, Checkpoint, CheckpointData } from './checkpoint-service';
import { CheckpointStrategy } from './checkpoint-strategy';
import { CheckpointManagerOptions, CheckpointCheckContext } from './types';

export interface MaybeCheckpointInput {
  episodeId: string;
  event: string;
  state: {
    phase: string;
    progress: Record<string, unknown>;
    loopCount: number;
    context?: Record<string, unknown>;
    budgetState?: CheckpointData['budgetState'];
  };
  isLoopEnd?: boolean;
}

export class CheckpointManager {
  private service: CheckpointService;
  private strategy: CheckpointStrategy;
  private _lastCheckpointAt: number | null = null;

  constructor(options: CheckpointManagerOptions) {
    this.service = options.service as CheckpointService;
    this.strategy = options.strategy as CheckpointStrategy;
  }

  get lastCheckpointAt(): number | null {
    return this._lastCheckpointAt;
  }

  async maybeCheckpoint(input: MaybeCheckpointInput): Promise<Checkpoint | null> {
    const context: CheckpointCheckContext = {
      event: input.event,
      isLoopEnd: input.isLoopEnd,
      lastCheckpointAt: this._lastCheckpointAt ?? undefined,
      phase: input.state.phase,
    };

    if (!this.strategy.shouldCheckpoint(context)) {
      return null;
    }

    const checkpoint = await this.service.create({
      episodeId: input.episodeId,
      phase: input.state.phase,
      progress: input.state.progress,
      loopCount: input.state.loopCount,
      context: input.state.context,
      budgetState: input.state.budgetState,
    });

    this._lastCheckpointAt = Date.now();

    return checkpoint;
  }

  async restoreLatest(episodeId: string): Promise<CheckpointData | null> {
    const latest = await this.service.getLatest(episodeId);

    if (!latest) {
      return null;
    }

    return this.service.restore(latest.id);
  }

  async getHistory(episodeId: string): Promise<Checkpoint[]> {
    return this.service.getByEpisode(episodeId);
  }

  async cleanup(episodeId: string, options?: { keepLatest?: number }): Promise<number> {
    const keepLatest = options?.keepLatest ?? 1;
    return this.service.pruneByEpisode(episodeId, { maxCount: keepLatest });
  }

  reset(): void {
    this._lastCheckpointAt = null;
  }
}
```

**File:** `packages/runner/src/checkpoint/index.ts`

```typescript
export * from './types';
export * from './checkpoint-service';
export * from './checkpoint-strategy';
export * from './checkpoint-manager';
```

**File:** `packages/db/src/schema/checkpoints.ts`

```typescript
import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { episodes } from './episodes';

export const checkpoints = pgTable('checkpoints', {
  id: text('id').primaryKey(),
  episodeId: text('episode_id')
    .notNull()
    .references(() => episodes.id, { onDelete: 'cascade' }),
  phase: text('phase').notNull(),
  progress: jsonb('progress').notNull(),
  loopCount: integer('loop_count').notNull().default(0),
  context: jsonb('context'),
  budgetState: jsonb('budget_state'),
  metadata: jsonb('metadata'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Indexes for efficient queries
export const checkpointsIndexes = {
  episodeIdx: 'CREATE INDEX idx_checkpoints_episode ON checkpoints(episode_id)',
  createdAtIdx: 'CREATE INDEX idx_checkpoints_created_at ON checkpoints(created_at DESC)',
};
```

### Phase 3: Verification

```bash
# Run tests
cd packages/runner
pnpm test src/checkpoint/

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
| Create | `packages/runner/src/checkpoint/types.ts` | Checkpoint types and schemas |
| Create | `packages/runner/src/checkpoint/checkpoint-service.ts` | Checkpoint CRUD operations |
| Create | `packages/runner/src/checkpoint/checkpoint-strategy.ts` | Checkpointing strategy |
| Create | `packages/runner/src/checkpoint/checkpoint-manager.ts` | High-level checkpoint manager |
| Create | `packages/runner/src/checkpoint/checkpoint-service.test.ts` | Unit tests |
| Create | `packages/runner/src/checkpoint/index.ts` | Module exports |
| Create | `packages/db/src/schema/checkpoints.ts` | Database schema |
| Modify | `packages/db/src/schema/index.ts` | Add checkpoint exports |
| Modify | `packages/runner/src/index.ts` | Add checkpoint exports |

---

## Acceptance Criteria

- [ ] CheckpointService creates checkpoints with unique IDs
- [ ] Complex data structures serialize/deserialize correctly (JSON)
- [ ] getLatest returns most recent checkpoint for episode
- [ ] restore deserializes checkpoint data correctly
- [ ] delete removes individual checkpoints
- [ ] deleteByEpisode removes all checkpoints for an episode
- [ ] prune removes checkpoints older than maxAgeDays
- [ ] pruneByEpisode keeps only maxCount recent checkpoints
- [ ] CheckpointStrategy evaluates onPhaseComplete correctly
- [ ] CheckpointStrategy evaluates onLoopComplete correctly
- [ ] CheckpointStrategy evaluates onBudgetWarning correctly
- [ ] CheckpointStrategy evaluates intervalMs correctly
- [ ] CheckpointManager conditionally creates checkpoints
- [ ] CheckpointManager restores from latest checkpoint
- [ ] All unit tests pass with >90% coverage

---

## Test Requirements

### Unit Tests
- Checkpoint creation and serialization
- Retrieval (latest, by episode)
- Restoration and deserialization
- Deletion (single, by episode)
- Pruning (by age, by count)
- Strategy evaluation
- Manager integration

### Integration Tests
- Full checkpoint/restore cycle
- Runner state machine integration
- Multi-checkpoint history

---

## Security & Safety Checklist

- [ ] No hardcoded secrets in checkpoint data
- [ ] Checkpoint scoped to episode (which is scoped to client)
- [ ] Sensitive context excluded from checkpoints
- [ ] JSON parsing handles malformed data gracefully
- [ ] Pruning prevents unbounded storage growth

---

## JSON Task Block

```json
{
  "task_id": "S1-D5",
  "name": "Checkpoint and Resume",
  "sprint": 1,
  "agent": "D",
  "status": "pending",
  "complexity": "high",
  "estimated_tokens": 5500,
  "dependencies": ["S1-D1", "S1-D4"],
  "blocks": ["S2-D1"],
  "spec_refs": [
    "/docs/01-architecture/system-architecture-v3.md",
    "/docs/01-architecture/rlm-integration-spec.md"
  ],
  "acceptance_criteria": [
    "checkpoint_creation_works",
    "serialization_deserialization_correct",
    "latest_retrieval_works",
    "restore_works",
    "pruning_works",
    "strategy_evaluation_correct",
    "manager_integration_works"
  ],
  "outputs": {
    "files": [
      "packages/runner/src/checkpoint/types.ts",
      "packages/runner/src/checkpoint/checkpoint-service.ts",
      "packages/runner/src/checkpoint/checkpoint-strategy.ts",
      "packages/runner/src/checkpoint/checkpoint-manager.ts",
      "packages/runner/src/checkpoint/checkpoint-service.test.ts",
      "packages/runner/src/checkpoint/index.ts",
      "packages/db/src/schema/checkpoints.ts"
    ],
    "exports": [
      "CheckpointService",
      "CheckpointStrategy",
      "CheckpointManager",
      "Checkpoint",
      "CheckpointData"
    ]
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

1. **JSON Serialization**: Use JSON.stringify/parse for complex objects
2. **Null Handling**: Context, budgetState, metadata are optional
3. **Pruning Strategy**: Consider both age-based and count-based pruning
4. **Strategy Composition**: Multiple conditions can trigger checkpoints
5. **Manager State**: Track lastCheckpointAt for interval-based checkpointing
6. **Error Recovery**: Handle JSON parse errors gracefully with defaults
7. **Index Usage**: episodeId and createdAt indexes are critical for performance
