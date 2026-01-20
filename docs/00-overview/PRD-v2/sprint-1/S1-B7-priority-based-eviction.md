# S1-B7: Priority-Based Eviction Engine

## Task Metadata

```json
{
  "task_id": "S1-B7",
  "name": "Priority-Based Eviction Engine",
  "sprint": 1,
  "agent": "B",
  "status": "pending",
  "tests_status": "not_written",
  "dependencies": ["S1-B6"],
  "blocks": ["S1-B8", "S2-A6"],
  "estimated_complexity": "high",
  "estimated_hours": 4,
  "spec_references": [
    "/docs/02-schemas/external-memory-schema.md",
    "/docs/adr/ADR-0001-tesla-mixed-precision-patterns.md",
    "/docs/01-architecture/rlm-integration-spec.md"
  ],
  "acceptance_criteria": [
    "Eviction engine respects priority ordering",
    "PINNED entries never evicted regardless of pressure",
    "SESSION entries evicted only on session termination",
    "SLIDING entries use LRU with access frequency weighting",
    "EPHEMERAL entries evicted first under any pressure",
    "Eviction runs within 100ms for up to 10k entries",
    "Audit trail emitted for all evictions"
  ],
  "test_files": [
    "packages/core/src/memory/__tests__/eviction-engine.test.ts"
  ],
  "created_files": [
    "packages/core/src/memory/eviction-engine.ts",
    "packages/core/src/memory/eviction-strategies.ts",
    "packages/core/src/memory/eviction-events.ts"
  ]
}
```

---

## Context

This task implements the Priority-Based Eviction Engine, the runtime component that manages memory pressure by intelligently evicting entries based on their priority level.

### Background: Why Smart Eviction?

Standard LRU (Least Recently Used) eviction treats all entries equally. This is dangerous for AI systems where some context is critical:

**Without Priority Eviction:**
```
Memory full → Evict oldest entry → Brand voice guidelines removed → AI goes off-brand
```

**With Priority Eviction:**
```
Memory full → Check priorities → Evict oldest EPHEMERAL → Brand voice preserved
```

---

## Pre-Implementation Checklist

- [ ] Read: `docs/adr/ADR-0001-tesla-mixed-precision-patterns.md`
- [ ] Read: `docs/01-architecture/rlm-integration-spec.md`
- [ ] Verify S1-B6 (Memory Priority Schema) is complete
- [ ] Review eviction score calculation from S1-B6

---

## TDD Methodology

### Phase 1: RED — Write Failing Tests First

Create `packages/core/src/memory/__tests__/eviction-engine.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EvictionEngine,
  EvictionConfig,
  EvictionResult,
  EvictionStrategy
} from '../eviction-engine';
import { MemoryPriority } from '../priority';
import { MemoryStore } from '../store';

describe('S1-B7: Priority-Based Eviction Engine', () => {
  let engine: EvictionEngine;
  let store: MemoryStore;
  let auditEvents: any[];

  beforeEach(() => {
    auditEvents = [];
    store = createMockStore();
    engine = new EvictionEngine({
      store,
      maxEntries: 100,
      maxTokens: 10000,
      onEvict: (event) => auditEvents.push(event)
    });
  });

  describe('Priority Ordering', () => {
    it('should never evict PINNED entries', async () => {
      // Fill store with pinned entries
      await store.insert([
        { id: '1', priority: MemoryPriority.PINNED, tokens: 1000 },
        { id: '2', priority: MemoryPriority.PINNED, tokens: 1000 },
      ]);

      // Trigger eviction
      const result = await engine.evict({ targetTokens: 500 });

      expect(result.evictedIds).toHaveLength(0);
      expect(result.evictedTokens).toBe(0);
      expect(result.skipped.pinned).toBe(2);
    });

    it('should evict EPHEMERAL entries first', async () => {
      await store.insert([
        { id: 'pinned-1', priority: MemoryPriority.PINNED, tokens: 100 },
        { id: 'sliding-1', priority: MemoryPriority.SLIDING, tokens: 100 },
        { id: 'ephemeral-1', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
        { id: 'ephemeral-2', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
      ]);

      const result = await engine.evict({ targetTokens: 150 });

      expect(result.evictedIds).toContain('ephemeral-1');
      expect(result.evictedIds).toContain('ephemeral-2');
      expect(result.evictedIds).not.toContain('sliding-1');
      expect(result.evictedIds).not.toContain('pinned-1');
    });

    it('should evict SLIDING before SESSION when session active', async () => {
      await store.insert([
        { id: 'session-1', priority: MemoryPriority.SESSION, tokens: 100 },
        { id: 'sliding-1', priority: MemoryPriority.SLIDING, tokens: 100 },
        { id: 'sliding-2', priority: MemoryPriority.SLIDING, tokens: 100 },
      ]);

      const result = await engine.evict({ 
        targetTokens: 150,
        sessionActive: true 
      });

      expect(result.evictedIds).toContain('sliding-1');
      expect(result.evictedIds).toContain('sliding-2');
      expect(result.evictedIds).not.toContain('session-1');
    });

    it('should evict SESSION entries when session ends', async () => {
      await store.insert([
        { id: 'session-1', priority: MemoryPriority.SESSION, tokens: 100 },
        { id: 'session-2', priority: MemoryPriority.SESSION, tokens: 100 },
      ]);

      const result = await engine.evict({ 
        targetTokens: 150,
        sessionActive: false 
      });

      expect(result.evictedIds).toContain('session-1');
      expect(result.evictedIds).toContain('session-2');
    });
  });

  describe('Eviction Score Calculation', () => {
    it('should prioritize low-access-count entries within same priority', async () => {
      const now = Date.now();
      await store.insert([
        { id: 'low-access', priority: MemoryPriority.SLIDING, tokens: 100, accessCount: 1, lastAccessed: now },
        { id: 'high-access', priority: MemoryPriority.SLIDING, tokens: 100, accessCount: 100, lastAccessed: now },
      ]);

      const result = await engine.evict({ targetTokens: 100 });

      expect(result.evictedIds[0]).toBe('low-access');
    });

    it('should prioritize old entries within same priority', async () => {
      const now = Date.now();
      const hourAgo = now - (60 * 60 * 1000);
      
      await store.insert([
        { id: 'recent', priority: MemoryPriority.SLIDING, tokens: 100, accessCount: 1, lastAccessed: now },
        { id: 'old', priority: MemoryPriority.SLIDING, tokens: 100, accessCount: 1, lastAccessed: hourAgo },
      ]);

      const result = await engine.evict({ targetTokens: 100 });

      expect(result.evictedIds[0]).toBe('old');
    });

    it('should balance access count and recency', async () => {
      const now = Date.now();
      const dayAgo = now - (24 * 60 * 60 * 1000);
      
      await store.insert([
        // Recent but rarely accessed
        { id: 'recent-rare', priority: MemoryPriority.SLIDING, tokens: 100, accessCount: 1, lastAccessed: now },
        // Old but frequently accessed
        { id: 'old-frequent', priority: MemoryPriority.SLIDING, tokens: 100, accessCount: 50, lastAccessed: dayAgo },
      ]);

      // The scoring algorithm should keep the frequently accessed one
      const result = await engine.evict({ targetTokens: 100 });

      expect(result.evictedIds[0]).toBe('recent-rare');
    });
  });

  describe('Eviction Targets', () => {
    it('should evict until target tokens reached', async () => {
      await store.insert([
        { id: '1', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
        { id: '2', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
        { id: '3', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
        { id: '4', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
      ]);

      const result = await engine.evict({ targetTokens: 250 });

      expect(result.evictedTokens).toBeGreaterThanOrEqual(250);
      expect(result.evictedIds.length).toBeGreaterThanOrEqual(3);
    });

    it('should evict until target count reached', async () => {
      await store.insert([
        { id: '1', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
        { id: '2', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
        { id: '3', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
      ]);

      const result = await engine.evict({ targetCount: 2 });

      expect(result.evictedIds).toHaveLength(2);
    });

    it('should stop when no more evictable entries', async () => {
      await store.insert([
        { id: 'pinned-1', priority: MemoryPriority.PINNED, tokens: 1000 },
        { id: 'ephemeral-1', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
      ]);

      const result = await engine.evict({ targetTokens: 2000 });

      expect(result.evictedTokens).toBe(100);
      expect(result.insufficientEvictable).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should evict 10k entries within 100ms', async () => {
      // Generate 10k entries
      const entries = Array.from({ length: 10000 }, (_, i) => ({
        id: `entry-${i}`,
        priority: MemoryPriority.SLIDING,
        tokens: 10,
        accessCount: Math.floor(Math.random() * 100),
        lastAccessed: Date.now() - Math.floor(Math.random() * 86400000)
      }));
      
      await store.insert(entries);

      const start = performance.now();
      const result = await engine.evict({ targetTokens: 50000 });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      expect(result.evictedTokens).toBeGreaterThanOrEqual(50000);
    });

    it('should use batch operations for efficiency', async () => {
      const deleteSpy = vi.spyOn(store, 'deleteBatch');
      
      await store.insert(
        Array.from({ length: 100 }, (_, i) => ({
          id: `entry-${i}`,
          priority: MemoryPriority.EPHEMERAL,
          tokens: 10
        }))
      );

      await engine.evict({ targetTokens: 500 });

      // Should use batch delete, not individual deletes
      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy.mock.calls[0][0].length).toBeGreaterThan(1);
    });
  });

  describe('Audit Trail', () => {
    it('should emit eviction event for each evicted entry', async () => {
      await store.insert([
        { id: '1', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
        { id: '2', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
      ]);

      await engine.evict({ targetTokens: 200 });

      expect(auditEvents).toHaveLength(2);
      expect(auditEvents[0]).toMatchObject({
        type: 'memory.evicted',
        entryId: expect.any(String),
        priority: MemoryPriority.EPHEMERAL,
        reason: expect.any(String)
      });
    });

    it('should include eviction reason in audit event', async () => {
      await store.insert([
        { id: '1', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
      ]);

      await engine.evict({ 
        targetTokens: 100,
        reason: 'token_budget_exceeded'
      });

      expect(auditEvents[0].reason).toBe('token_budget_exceeded');
    });

    it('should include eviction score in audit event', async () => {
      await store.insert([
        { id: '1', priority: MemoryPriority.SLIDING, tokens: 100, accessCount: 5 },
      ]);

      await engine.evict({ targetTokens: 100 });

      expect(auditEvents[0]).toHaveProperty('evictionScore');
      expect(typeof auditEvents[0].evictionScore).toBe('number');
    });
  });

  describe('Client Isolation', () => {
    it('should only evict entries for specified client', async () => {
      await store.insert([
        { id: '1', clientId: 'client-a', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
        { id: '2', clientId: 'client-b', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
      ]);

      const result = await engine.evict({ 
        targetTokens: 100,
        clientId: 'client-a'
      });

      expect(result.evictedIds).toContain('1');
      expect(result.evictedIds).not.toContain('2');
    });

    it('should respect client-specific pinned budgets', async () => {
      engine = new EvictionEngine({
        store,
        maxTokens: 10000,
        clientBudgets: {
          'premium-client': { maxPinned: 5000 },
          'basic-client': { maxPinned: 1000 }
        }
      });

      // Premium client can pin more
      const premiumResult = await engine.canPin('premium-client', 3000);
      expect(premiumResult.allowed).toBe(true);

      // Basic client cannot
      const basicResult = await engine.canPin('basic-client', 3000);
      expect(basicResult.allowed).toBe(false);
    });
  });

  describe('Eviction Strategies', () => {
    it('should support LRU strategy for SLIDING entries', async () => {
      const lruEngine = new EvictionEngine({
        store,
        strategy: EvictionStrategy.LRU
      });

      await store.insert([
        { id: 'old', priority: MemoryPriority.SLIDING, lastAccessed: Date.now() - 10000 },
        { id: 'new', priority: MemoryPriority.SLIDING, lastAccessed: Date.now() },
      ]);

      const result = await lruEngine.evict({ targetCount: 1 });
      expect(result.evictedIds[0]).toBe('old');
    });

    it('should support LFU strategy for SLIDING entries', async () => {
      const lfuEngine = new EvictionEngine({
        store,
        strategy: EvictionStrategy.LFU
      });

      await store.insert([
        { id: 'rare', priority: MemoryPriority.SLIDING, accessCount: 1 },
        { id: 'frequent', priority: MemoryPriority.SLIDING, accessCount: 100 },
      ]);

      const result = await lfuEngine.evict({ targetCount: 1 });
      expect(result.evictedIds[0]).toBe('rare');
    });

    it('should support FIFO strategy for EPHEMERAL entries', async () => {
      const fifoEngine = new EvictionEngine({
        store,
        strategy: EvictionStrategy.FIFO
      });

      await store.insert([
        { id: 'first', priority: MemoryPriority.EPHEMERAL, createdAt: Date.now() - 10000 },
        { id: 'second', priority: MemoryPriority.EPHEMERAL, createdAt: Date.now() },
      ]);

      const result = await fifoEngine.evict({ targetCount: 1 });
      expect(result.evictedIds[0]).toBe('first');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty store gracefully', async () => {
      const result = await engine.evict({ targetTokens: 1000 });

      expect(result.evictedIds).toHaveLength(0);
      expect(result.evictedTokens).toBe(0);
    });

    it('should handle zero target gracefully', async () => {
      await store.insert([
        { id: '1', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
      ]);

      const result = await engine.evict({ targetTokens: 0 });

      expect(result.evictedIds).toHaveLength(0);
    });

    it('should handle concurrent eviction requests', async () => {
      await store.insert(
        Array.from({ length: 100 }, (_, i) => ({
          id: `entry-${i}`,
          priority: MemoryPriority.EPHEMERAL,
          tokens: 10
        }))
      );

      // Fire multiple evictions concurrently
      const results = await Promise.all([
        engine.evict({ targetTokens: 200 }),
        engine.evict({ targetTokens: 200 }),
        engine.evict({ targetTokens: 200 }),
      ]);

      // Should not double-evict entries
      const allEvicted = results.flatMap(r => r.evictedIds);
      const uniqueEvicted = [...new Set(allEvicted)];
      expect(allEvicted.length).toBe(uniqueEvicted.length);
    });
  });
});

// Helper to create mock store
function createMockStore(): MemoryStore {
  const entries = new Map();
  
  return {
    insert: async (items) => {
      for (const item of Array.isArray(items) ? items : [items]) {
        entries.set(item.id, { ...item, createdAt: Date.now() });
      }
    },
    getEvictable: async (options) => {
      return Array.from(entries.values())
        .filter(e => {
          if (options?.clientId && e.clientId !== options.clientId) return false;
          if (e.priority === MemoryPriority.PINNED) return false;
          if (e.priority === MemoryPriority.SESSION && options?.sessionActive) return false;
          return true;
        })
        .sort((a, b) => (a.evictionScore ?? 0) - (b.evictionScore ?? 0));
    },
    deleteBatch: async (ids) => {
      for (const id of ids) {
        entries.delete(id);
      }
    },
    count: async () => entries.size,
    totalTokens: async () => 
      Array.from(entries.values()).reduce((sum, e) => sum + (e.tokens ?? 0), 0)
  };
}
```

**Run tests — they MUST fail:**
```bash
pnpm test packages/core/src/memory/__tests__/eviction-engine.test.ts
```

---

### Phase 2: GREEN — Implement Minimum Code

#### 2.1 Create Eviction Engine

Create `packages/core/src/memory/eviction-engine.ts`:

```typescript
import { MemoryPriority, canEvict, calculateEvictionScore } from './priority';
import type { MemoryStore, MemoryEntry } from './store';

/**
 * Eviction strategies for SLIDING/EPHEMERAL entries.
 */
export enum EvictionStrategy {
  /** Least Recently Used - evict oldest accessed first */
  LRU = 'lru',
  /** Least Frequently Used - evict least accessed first */
  LFU = 'lfu',
  /** First In First Out - evict oldest created first */
  FIFO = 'fifo',
  /** Weighted score combining recency, frequency, and priority */
  WEIGHTED = 'weighted'
}

/**
 * Configuration for the eviction engine.
 */
export interface EvictionConfig {
  store: MemoryStore;
  maxEntries?: number;
  maxTokens?: number;
  strategy?: EvictionStrategy;
  clientBudgets?: Record<string, { maxPinned: number }>;
  onEvict?: (event: EvictionEvent) => void;
}

/**
 * Options for an eviction operation.
 */
export interface EvictionOptions {
  /** Target number of tokens to free */
  targetTokens?: number;
  /** Target number of entries to evict */
  targetCount?: number;
  /** Limit eviction to specific client */
  clientId?: string;
  /** Whether a session is currently active */
  sessionActive?: boolean;
  /** Reason for eviction (for audit) */
  reason?: string;
}

/**
 * Result of an eviction operation.
 */
export interface EvictionResult {
  /** IDs of evicted entries */
  evictedIds: string[];
  /** Total tokens freed */
  evictedTokens: number;
  /** Time taken in ms */
  durationMs: number;
  /** Entries skipped by priority */
  skipped: {
    pinned: number;
    session: number;
  };
  /** True if target couldn't be met */
  insufficientEvictable: boolean;
}

/**
 * Audit event emitted on eviction.
 */
export interface EvictionEvent {
  type: 'memory.evicted';
  entryId: string;
  clientId?: string;
  priority: MemoryPriority;
  tokens: number;
  evictionScore: number;
  reason: string;
  timestamp: Date;
}

/**
 * Priority-Based Eviction Engine
 * 
 * Manages memory pressure by intelligently evicting entries based on
 * their priority level, access patterns, and age.
 * 
 * Inspired by Tesla's attention sink pattern (US20260017019A1).
 */
export class EvictionEngine {
  private store: MemoryStore;
  private maxEntries: number;
  private maxTokens: number;
  private strategy: EvictionStrategy;
  private clientBudgets: Record<string, { maxPinned: number }>;
  private onEvict?: (event: EvictionEvent) => void;
  private evictionLock = false;

  constructor(config: EvictionConfig) {
    this.store = config.store;
    this.maxEntries = config.maxEntries ?? Infinity;
    this.maxTokens = config.maxTokens ?? Infinity;
    this.strategy = config.strategy ?? EvictionStrategy.WEIGHTED;
    this.clientBudgets = config.clientBudgets ?? {};
    this.onEvict = config.onEvict;
  }

  /**
   * Evict entries to meet target tokens or count.
   */
  async evict(options: EvictionOptions): Promise<EvictionResult> {
    const start = performance.now();
    
    // Prevent concurrent evictions
    if (this.evictionLock) {
      return {
        evictedIds: [],
        evictedTokens: 0,
        durationMs: 0,
        skipped: { pinned: 0, session: 0 },
        insufficientEvictable: false
      };
    }

    this.evictionLock = true;

    try {
      return await this.performEviction(options, start);
    } finally {
      this.evictionLock = false;
    }
  }

  private async performEviction(
    options: EvictionOptions, 
    startTime: number
  ): Promise<EvictionResult> {
    const { 
      targetTokens = 0, 
      targetCount = 0, 
      clientId, 
      sessionActive = true,
      reason = 'memory_pressure'
    } = options;

    // Early exit if no target
    if (targetTokens <= 0 && targetCount <= 0) {
      return {
        evictedIds: [],
        evictedTokens: 0,
        durationMs: performance.now() - startTime,
        skipped: { pinned: 0, session: 0 },
        insufficientEvictable: false
      };
    }

    // Get all evictable entries sorted by eviction score
    const entries = await this.store.getEvictable({
      clientId,
      sessionActive
    });

    // Sort by priority tier, then by eviction score within tier
    const sorted = this.sortByEvictionOrder(entries, sessionActive);

    const evictedIds: string[] = [];
    let evictedTokens = 0;
    let skippedPinned = 0;
    let skippedSession = 0;

    for (const entry of sorted) {
      // Check if we've met our target
      if (targetTokens > 0 && evictedTokens >= targetTokens) break;
      if (targetCount > 0 && evictedIds.length >= targetCount) break;

      // Check if entry can be evicted
      if (!canEvict(entry.priority, { sessionActive })) {
        if (entry.priority === MemoryPriority.PINNED) skippedPinned++;
        if (entry.priority === MemoryPriority.SESSION) skippedSession++;
        continue;
      }

      // Mark for eviction
      evictedIds.push(entry.id);
      evictedTokens += entry.tokens ?? 0;

      // Emit audit event
      if (this.onEvict) {
        this.onEvict({
          type: 'memory.evicted',
          entryId: entry.id,
          clientId: entry.clientId,
          priority: entry.priority,
          tokens: entry.tokens ?? 0,
          evictionScore: entry.evictionScore ?? 0,
          reason,
          timestamp: new Date()
        });
      }
    }

    // Batch delete evicted entries
    if (evictedIds.length > 0) {
      await this.store.deleteBatch(evictedIds);
    }

    const insufficientEvictable = 
      (targetTokens > 0 && evictedTokens < targetTokens) ||
      (targetCount > 0 && evictedIds.length < targetCount);

    return {
      evictedIds,
      evictedTokens,
      durationMs: performance.now() - startTime,
      skipped: {
        pinned: skippedPinned,
        session: skippedSession
      },
      insufficientEvictable
    };
  }

  /**
   * Sort entries by eviction order:
   * 1. EPHEMERAL first (always evictable)
   * 2. SLIDING second (LRU/LFU/weighted)
   * 3. SESSION third (only if session inactive)
   * 4. PINNED never
   */
  private sortByEvictionOrder(
    entries: MemoryEntry[], 
    sessionActive: boolean
  ): MemoryEntry[] {
    // Group by priority
    const ephemeral: MemoryEntry[] = [];
    const sliding: MemoryEntry[] = [];
    const session: MemoryEntry[] = [];

    for (const entry of entries) {
      switch (entry.priority) {
        case MemoryPriority.EPHEMERAL:
          ephemeral.push(entry);
          break;
        case MemoryPriority.SLIDING:
          sliding.push(entry);
          break;
        case MemoryPriority.SESSION:
          if (!sessionActive) session.push(entry);
          break;
        // PINNED entries excluded
      }
    }

    // Sort within each group by strategy
    const sortFn = this.getSortFunction();
    ephemeral.sort(sortFn);
    sliding.sort(sortFn);
    session.sort(sortFn);

    // Concatenate in eviction order
    return [...ephemeral, ...sliding, ...session];
  }

  /**
   * Get sort function based on eviction strategy.
   */
  private getSortFunction(): (a: MemoryEntry, b: MemoryEntry) => number {
    switch (this.strategy) {
      case EvictionStrategy.LRU:
        return (a, b) => 
          (a.lastAccessed?.getTime() ?? 0) - (b.lastAccessed?.getTime() ?? 0);
      
      case EvictionStrategy.LFU:
        return (a, b) => 
          (a.accessCount ?? 0) - (b.accessCount ?? 0);
      
      case EvictionStrategy.FIFO:
        return (a, b) => 
          (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
      
      case EvictionStrategy.WEIGHTED:
      default:
        // Lower score = evict first
        return (a, b) => 
          (a.evictionScore ?? 0) - (b.evictionScore ?? 0);
    }
  }

  /**
   * Check if client can pin more content.
   */
  async canPin(
    clientId: string, 
    tokensToPin: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const budget = this.clientBudgets[clientId]?.maxPinned ?? 2000;
    const currentPinned = await this.store.getPinnedTokens(clientId);
    
    if (currentPinned + tokensToPin > budget) {
      return {
        allowed: false,
        reason: `Would exceed pinned budget: ${currentPinned + tokensToPin}/${budget}`
      };
    }

    return { allowed: true };
  }

  /**
   * Check if eviction is needed based on current usage.
   */
  async needsEviction(): Promise<{ needed: boolean; reason?: string }> {
    const [count, tokens] = await Promise.all([
      this.store.count(),
      this.store.totalTokens()
    ]);

    if (count > this.maxEntries) {
      return { 
        needed: true, 
        reason: `Entry count ${count} exceeds max ${this.maxEntries}` 
      };
    }

    if (tokens > this.maxTokens) {
      return { 
        needed: true, 
        reason: `Token count ${tokens} exceeds max ${this.maxTokens}` 
      };
    }

    return { needed: false };
  }

  /**
   * Auto-evict if needed, returns eviction result or null.
   */
  async autoEvict(clientId?: string): Promise<EvictionResult | null> {
    const { needed, reason } = await this.needsEviction();
    
    if (!needed) return null;

    const tokens = await this.store.totalTokens();
    const targetTokens = tokens - this.maxTokens + (this.maxTokens * 0.1); // Free 10% extra

    return this.evict({
      targetTokens,
      clientId,
      reason: reason ?? 'auto_eviction'
    });
  }
}
```

---

### Phase 3: REFACTOR — Clean Up

After tests pass:
1. Extract sorting strategies to separate file
2. Add metrics for eviction operations
3. Add OpenTelemetry tracing for eviction spans

---

## Acceptance Criteria Checklist

- [ ] Eviction engine respects priority ordering (PINNED > SESSION > SLIDING > EPHEMERAL)
- [ ] PINNED entries never evicted regardless of memory pressure
- [ ] SESSION entries evicted only when session terminates
- [ ] SLIDING entries use configurable LRU/LFU/weighted strategies
- [ ] EPHEMERAL entries always evicted first
- [ ] Performance: 10k entries evicted within 100ms
- [ ] Batch operations used for efficiency
- [ ] Audit events emitted for all evictions
- [ ] Client isolation enforced
- [ ] Concurrent eviction requests handled safely

---

## On Completion

```bash
pnpm test packages/core/src/memory/__tests__/eviction-engine.test.ts
pnpm typecheck
cd tools/orchestrator && pnpm tsx src/cli.ts complete S1-B7
```
