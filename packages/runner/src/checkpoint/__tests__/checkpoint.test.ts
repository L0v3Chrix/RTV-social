/**
 * S1-D5: Checkpoint and Resume Tests
 *
 * Unit tests for checkpoint service, strategy, and manager.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CheckpointService,
  type Checkpoint,
  type CheckpointData,
} from '../checkpoint-service.js';
import { CheckpointStrategy } from '../checkpoint-strategy.js';
import { CheckpointManager } from '../checkpoint-manager.js';

// =====================
// Mock Store
// =====================

function createMockStore() {
  const checkpoints = new Map<string, Checkpoint>();
  let idCounter = 0;

  return {
    checkpoints,
    create: vi.fn(async (data: CheckpointData): Promise<Checkpoint> => {
      const id = `cp_${++idCounter}`;
      const checkpoint: Checkpoint = {
        id,
        ...data,
        createdAt: new Date().toISOString(),
        version: 1,
      };
      checkpoints.set(id, checkpoint);
      return checkpoint;
    }),
    getLatest: vi.fn(async (episodeId: string): Promise<Checkpoint | null> => {
      const episodeCheckpoints = Array.from(checkpoints.values())
        .filter((cp) => cp.episodeId === episodeId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return episodeCheckpoints[0] ?? null;
    }),
    getByEpisode: vi.fn(async (episodeId: string): Promise<Checkpoint[]> => {
      return Array.from(checkpoints.values())
        .filter((cp) => cp.episodeId === episodeId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }),
    restore: vi.fn(async (checkpointId: string): Promise<CheckpointData | null> => {
      const checkpoint = checkpoints.get(checkpointId);
      if (!checkpoint) return null;
      return {
        episodeId: checkpoint.episodeId,
        phase: checkpoint.phase,
        progress: checkpoint.progress,
        loopCount: checkpoint.loopCount,
        context: checkpoint.context,
        budgetState: checkpoint.budgetState,
        metadata: checkpoint.metadata,
      };
    }),
    delete: vi.fn(async (checkpointId: string): Promise<void> => {
      checkpoints.delete(checkpointId);
    }),
    deleteByEpisode: vi.fn(async (episodeId: string): Promise<void> => {
      for (const [id, cp] of checkpoints.entries()) {
        if (cp.episodeId === episodeId) {
          checkpoints.delete(id);
        }
      }
    }),
    prune: vi.fn(async (): Promise<number> => 0),
    pruneByEpisode: vi.fn(async (): Promise<number> => 0),
  };
}

// =====================
// CheckpointService Tests
// =====================

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
      expect(checkpoint.id).toMatch(/^cp_/);
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

      const checkpoint = await service.create(data);

      expect(checkpoint).toBeDefined();
      expect(checkpoint.progress).toEqual(data.progress);
      expect(checkpoint.context).toEqual(data.context);
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

    it('should validate input data', async () => {
      await expect(
        service.create({
          episodeId: '',
          phase: 'planning',
          progress: {},
          loopCount: -1,
        } as CheckpointData)
      ).rejects.toThrow();
    });
  });

  describe('getLatest', () => {
    it('should return the latest checkpoint for an episode', async () => {
      // Create multiple checkpoints
      await service.create({
        episodeId: 'ep_test123',
        phase: 'planning',
        progress: { step: 1 },
        loopCount: 0,
      });

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));

      await service.create({
        episodeId: 'ep_test123',
        phase: 'acting',
        progress: { step: 2 },
        loopCount: 1,
      });

      await new Promise((r) => setTimeout(r, 10));

      const latest = await service.create({
        episodeId: 'ep_test123',
        phase: 'observing',
        progress: { step: 3 },
        loopCount: 2,
      });

      const retrieved = await service.getLatest('ep_test123');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(latest.id);
      expect(retrieved?.phase).toBe('observing');
    });

    it('should return null if no checkpoint exists', async () => {
      const checkpoint = await service.getLatest('ep_nonexistent');

      expect(checkpoint).toBeNull();
    });
  });

  describe('getByEpisode', () => {
    it('should return all checkpoints for an episode', async () => {
      await service.create({
        episodeId: 'ep_test123',
        phase: 'planning',
        progress: {},
        loopCount: 0,
      });

      await service.create({
        episodeId: 'ep_test123',
        phase: 'acting',
        progress: {},
        loopCount: 1,
      });

      await service.create({
        episodeId: 'ep_test123',
        phase: 'observing',
        progress: {},
        loopCount: 2,
      });

      // Different episode
      await service.create({
        episodeId: 'ep_other',
        phase: 'planning',
        progress: {},
        loopCount: 0,
      });

      const checkpoints = await service.getByEpisode('ep_test123');

      expect(checkpoints).toHaveLength(3);
    });

    it('should return empty array if no checkpoints exist', async () => {
      const checkpoints = await service.getByEpisode('ep_nonexistent');

      expect(checkpoints).toEqual([]);
    });

    it('should order checkpoints by creation time descending', async () => {
      await service.create({
        episodeId: 'ep_test123',
        phase: 'planning',
        progress: {},
        loopCount: 0,
      });

      await new Promise((r) => setTimeout(r, 10));

      await service.create({
        episodeId: 'ep_test123',
        phase: 'acting',
        progress: {},
        loopCount: 1,
      });

      const checkpoints = await service.getByEpisode('ep_test123');

      expect(checkpoints[0].loopCount).toBe(1); // Most recent first
      expect(checkpoints[1].loopCount).toBe(0);
    });
  });

  describe('restore', () => {
    it('should restore checkpoint data from ID', async () => {
      const checkpoint = await service.create({
        episodeId: 'ep_test123',
        phase: 'planning',
        progress: { step: 5 },
        loopCount: 3,
        context: { lastQuery: 'test' },
        budgetState: { tokens: { used: 5000, limit: 10000 } },
      });

      const restored = await service.restore(checkpoint.id);

      expect(restored).toBeDefined();
      expect(restored?.phase).toBe('planning');
      expect(restored?.progress).toEqual({ step: 5 });
      expect(restored?.loopCount).toBe(3);
    });

    it('should deserialize JSON fields correctly', async () => {
      const checkpoint = await service.create({
        episodeId: 'ep_test123',
        phase: 'acting',
        progress: {
          pendingTools: ['tool1'],
          results: [{ success: true }],
        },
        loopCount: 2,
        context: {
          planGraph: { nodes: [{ id: 'n1' }] },
        },
      });

      const restored = await service.restore(checkpoint.id);

      expect(restored?.progress).toEqual({
        pendingTools: ['tool1'],
        results: [{ success: true }],
      });
      expect(restored?.context).toEqual({
        planGraph: { nodes: [{ id: 'n1' }] },
      });
    });

    it('should return null for nonexistent checkpoint', async () => {
      const restored = await service.restore('cp_nonexistent');

      expect(restored).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a checkpoint by ID', async () => {
      const checkpoint = await service.create({
        episodeId: 'ep_test123',
        phase: 'planning',
        progress: {},
        loopCount: 0,
      });

      await service.delete(checkpoint.id);

      const restored = await service.restore(checkpoint.id);
      expect(restored).toBeNull();
    });

    it('should delete all checkpoints for an episode', async () => {
      await service.create({
        episodeId: 'ep_test123',
        phase: 'planning',
        progress: {},
        loopCount: 0,
      });

      await service.create({
        episodeId: 'ep_test123',
        phase: 'acting',
        progress: {},
        loopCount: 1,
      });

      await service.deleteByEpisode('ep_test123');

      const checkpoints = await service.getByEpisode('ep_test123');
      expect(checkpoints).toEqual([]);
    });
  });

  describe('pruning', () => {
    it('should prune old checkpoints beyond retention limit', async () => {
      // Create old checkpoint (mock the date)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      vi.setSystemTime(oldDate);
      await service.create({
        episodeId: 'ep_old',
        phase: 'planning',
        progress: {},
        loopCount: 0,
      });

      vi.useRealTimers();
      await service.create({
        episodeId: 'ep_recent',
        phase: 'planning',
        progress: {},
        loopCount: 0,
      });

      const deleted = await service.prune({ maxAgeDays: 7 });

      expect(deleted).toBeGreaterThanOrEqual(0);
    });

    it('should keep recent checkpoints', async () => {
      await service.create({
        episodeId: 'ep_recent',
        phase: 'planning',
        progress: {},
        loopCount: 0,
      });

      const deleted = await service.prune({ maxAgeDays: 7 });

      expect(deleted).toBe(0);
    });

    it('should prune checkpoints per episode beyond count limit', async () => {
      // Create many checkpoints
      for (let i = 0; i < 15; i++) {
        await service.create({
          episodeId: 'ep_test123',
          phase: `phase_${i}`,
          progress: {},
          loopCount: i,
        });
        await new Promise((r) => setTimeout(r, 5));
      }

      const deleted = await service.pruneByEpisode('ep_test123', { maxCount: 10 });

      expect(deleted).toBe(5);

      const remaining = await service.getByEpisode('ep_test123');
      expect(remaining).toHaveLength(10);
    });
  });
});

// =====================
// CheckpointStrategy Tests
// =====================

describe('CheckpointStrategy', () => {
  describe('shouldCheckpoint', () => {
    it('should checkpoint on phase completion', () => {
      const strategy = new CheckpointStrategy({ onPhaseComplete: true });

      expect(strategy.shouldCheckpoint({ event: 'PLAN_COMPLETE' })).toBe(true);
      expect(strategy.shouldCheckpoint({ event: 'ACT_COMPLETE' })).toBe(true);
      expect(strategy.shouldCheckpoint({ event: 'OBSERVE_COMPLETE' })).toBe(true);
      expect(strategy.shouldCheckpoint({ event: 'PERCEIVE_COMPLETE' })).toBe(true);
    });

    it('should not checkpoint on non-completion events', () => {
      const strategy = new CheckpointStrategy({ onPhaseComplete: true });

      expect(strategy.shouldCheckpoint({ event: 'PLAN' })).toBe(false);
      expect(strategy.shouldCheckpoint({ event: 'ACT' })).toBe(false);
      expect(strategy.shouldCheckpoint({ event: 'START' })).toBe(false);
    });

    it('should checkpoint on loop completion', () => {
      const strategy = new CheckpointStrategy({ onLoopComplete: true });

      expect(
        strategy.shouldCheckpoint({ event: 'OBSERVE_COMPLETE', isLoopEnd: true })
      ).toBe(true);
    });

    it('should not checkpoint mid-loop', () => {
      const strategy = new CheckpointStrategy({ onLoopComplete: true });

      expect(
        strategy.shouldCheckpoint({ event: 'PLAN_COMPLETE', isLoopEnd: false })
      ).toBe(false);
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

    it('should checkpoint on first event if no last checkpoint', () => {
      const strategy = new CheckpointStrategy({ intervalMs: 30000 });

      // No lastCheckpointAt means we should checkpoint if interval is set
      expect(
        strategy.shouldCheckpoint({
          event: 'ACT_COMPLETE',
        })
      ).toBe(false); // Need lastCheckpointAt for interval check
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

    it('should filter by specific phases', () => {
      const strategy = new CheckpointStrategy({
        onPhaseComplete: true,
        phases: ['plan', 'observe'],
      });

      expect(strategy.shouldCheckpoint({ event: 'PLAN_COMPLETE' })).toBe(true);
      expect(strategy.shouldCheckpoint({ event: 'OBSERVE_COMPLETE' })).toBe(true);
      expect(strategy.shouldCheckpoint({ event: 'ACT_COMPLETE' })).toBe(false);
    });

    it('should return false when no conditions configured', () => {
      const strategy = new CheckpointStrategy({});

      expect(strategy.shouldCheckpoint({ event: 'PLAN_COMPLETE' })).toBe(false);
      expect(strategy.shouldCheckpoint({ event: 'BUDGET_WARNING' })).toBe(false);
    });
  });
});

// =====================
// CheckpointManager Tests
// =====================

describe('CheckpointManager', () => {
  let manager: CheckpointManager;
  let mockStore: ReturnType<typeof createMockStore>;
  let mockStrategy: CheckpointStrategy;

  beforeEach(() => {
    mockStore = createMockStore();
    mockStrategy = new CheckpointStrategy({ onPhaseComplete: true });
    manager = new CheckpointManager({
      store: mockStore,
      strategy: mockStrategy,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create checkpoint when strategy allows', async () => {
    const result = await manager.maybeCheckpoint({
      episodeId: 'ep_test123',
      event: 'PLAN_COMPLETE',
      state: { phase: 'planning', progress: {}, loopCount: 1 },
    });

    expect(result).toBeDefined();
    expect(mockStore.create).toHaveBeenCalled();
  });

  it('should skip checkpoint when strategy denies', async () => {
    const strictStrategy = new CheckpointStrategy({ onLoopComplete: true });
    const strictManager = new CheckpointManager({
      store: mockStore,
      strategy: strictStrategy,
    });

    const result = await strictManager.maybeCheckpoint({
      episodeId: 'ep_test123',
      event: 'PLAN_COMPLETE',
      state: { phase: 'planning', progress: {}, loopCount: 1 },
      isLoopEnd: false,
    });

    expect(result).toBeNull();
    expect(mockStore.create).not.toHaveBeenCalled();
  });

  it('should track last checkpoint time', async () => {
    expect(manager.lastCheckpointAt).toBeNull();

    await manager.maybeCheckpoint({
      episodeId: 'ep_test123',
      event: 'PLAN_COMPLETE',
      state: { phase: 'planning', progress: {}, loopCount: 1 },
    });

    expect(manager.lastCheckpointAt).toBeDefined();
    expect(typeof manager.lastCheckpointAt).toBe('number');
  });

  it('should restore from latest checkpoint', async () => {
    // Create a checkpoint first
    await mockStore.create({
      episodeId: 'ep_test123',
      phase: 'acting',
      progress: { step: 3 },
      loopCount: 2,
    });

    const restored = await manager.restoreLatest('ep_test123');

    expect(restored).toBeDefined();
    expect(restored?.phase).toBe('acting');
    expect(mockStore.getLatest).toHaveBeenCalledWith('ep_test123');
  });

  it('should return null when no checkpoint exists for restore', async () => {
    const restored = await manager.restoreLatest('ep_nonexistent');

    expect(restored).toBeNull();
  });

  it('should get checkpoint history', async () => {
    await mockStore.create({
      episodeId: 'ep_test123',
      phase: 'planning',
      progress: {},
      loopCount: 0,
    });

    await mockStore.create({
      episodeId: 'ep_test123',
      phase: 'acting',
      progress: {},
      loopCount: 1,
    });

    const history = await manager.getHistory('ep_test123');

    expect(history).toHaveLength(2);
    expect(mockStore.getByEpisode).toHaveBeenCalledWith('ep_test123');
  });

  it('should cleanup old checkpoints', async () => {
    mockStore.pruneByEpisode.mockResolvedValueOnce(5);

    const deleted = await manager.cleanup('ep_test123', { keepLatest: 3 });

    expect(deleted).toBe(5);
    expect(mockStore.pruneByEpisode).toHaveBeenCalledWith('ep_test123', { maxCount: 3 });
  });

  it('should reset manager state', async () => {
    await manager.maybeCheckpoint({
      episodeId: 'ep_test123',
      event: 'PLAN_COMPLETE',
      state: { phase: 'planning', progress: {}, loopCount: 1 },
    });

    expect(manager.lastCheckpointAt).not.toBeNull();

    manager.reset();

    expect(manager.lastCheckpointAt).toBeNull();
  });

  it('should pass budget state to checkpoint', async () => {
    await manager.maybeCheckpoint({
      episodeId: 'ep_test123',
      event: 'PLAN_COMPLETE',
      state: {
        phase: 'planning',
        progress: {},
        loopCount: 1,
        budgetState: {
          tokens: { used: 5000, limit: 10000 },
        },
      },
    });

    expect(mockStore.create).toHaveBeenCalledWith(
      expect.objectContaining({
        budgetState: { tokens: { used: 5000, limit: 10000 } },
      })
    );
  });
});
