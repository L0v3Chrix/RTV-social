import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EvictionEngine,
  EvictionStrategy,
  type EvictionEvent,
} from '../eviction-engine.js';
import { MemoryPriority } from '../priority.js';
import { InMemoryStore, type MemoryEntry } from '../types.js';

describe('S1-B7: Priority-Based Eviction Engine', () => {
  let engine: EvictionEngine;
  let store: InMemoryStore;
  let auditEvents: EvictionEvent[];

  beforeEach(() => {
    auditEvents = [];
    store = new InMemoryStore();
    engine = new EvictionEngine({
      store,
      maxEntries: 100,
      maxTokens: 10000,
      onEvict: (event) => auditEvents.push(event),
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
        sessionActive: true,
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
        sessionActive: false,
      });

      expect(result.evictedIds).toContain('session-1');
      expect(result.evictedIds).toContain('session-2');
    });
  });

  describe('Eviction Score Calculation', () => {
    it('should prioritize low-access-count entries within same priority', async () => {
      const now = new Date();
      await store.insert([
        {
          id: 'low-access',
          priority: MemoryPriority.SLIDING,
          tokens: 100,
          accessCount: 1,
          lastAccessed: now,
          evictionScore: 10, // Lower score = evict first
        },
        {
          id: 'high-access',
          priority: MemoryPriority.SLIDING,
          tokens: 100,
          accessCount: 100,
          lastAccessed: now,
          evictionScore: 100, // Higher score = keep longer
        },
      ]);

      const result = await engine.evict({ targetTokens: 100 });

      expect(result.evictedIds[0]).toBe('low-access');
    });

    it('should prioritize old entries within same priority', async () => {
      const now = new Date();
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

      await store.insert([
        {
          id: 'recent',
          priority: MemoryPriority.SLIDING,
          tokens: 100,
          accessCount: 1,
          lastAccessed: now,
          evictionScore: 100, // Recent has higher score
        },
        {
          id: 'old',
          priority: MemoryPriority.SLIDING,
          tokens: 100,
          accessCount: 1,
          lastAccessed: hourAgo,
          evictionScore: 50, // Old has lower score
        },
      ]);

      const result = await engine.evict({ targetTokens: 100 });

      expect(result.evictedIds[0]).toBe('old');
    });

    it('should balance access count and recency', async () => {
      const now = new Date();
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await store.insert([
        // Recent but rarely accessed
        {
          id: 'recent-rare',
          priority: MemoryPriority.SLIDING,
          tokens: 100,
          accessCount: 1,
          lastAccessed: now,
          evictionScore: 10, // Low score despite recency
        },
        // Old but frequently accessed
        {
          id: 'old-frequent',
          priority: MemoryPriority.SLIDING,
          tokens: 100,
          accessCount: 50,
          lastAccessed: dayAgo,
          evictionScore: 100, // High score due to frequency
        },
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
      const entries: MemoryEntry[] = Array.from({ length: 10000 }, (_, i) => ({
        id: `entry-${i}`,
        priority: MemoryPriority.SLIDING,
        tokens: 10,
        accessCount: Math.floor(Math.random() * 100),
        lastAccessed: new Date(Date.now() - Math.floor(Math.random() * 86400000)),
        evictionScore: Math.random() * 100,
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
          tokens: 10,
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
        reason: expect.any(String),
      });
    });

    it('should include eviction reason in audit event', async () => {
      await store.insert([
        { id: '1', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
      ]);

      await engine.evict({
        targetTokens: 100,
        reason: 'token_budget_exceeded',
      });

      expect(auditEvents[0].reason).toBe('token_budget_exceeded');
    });

    it('should include eviction score in audit event', async () => {
      await store.insert([
        {
          id: '1',
          priority: MemoryPriority.SLIDING,
          tokens: 100,
          accessCount: 5,
          evictionScore: 42,
        },
      ]);

      await engine.evict({ targetTokens: 100 });

      expect(auditEvents[0]).toHaveProperty('evictionScore');
      expect(typeof auditEvents[0].evictionScore).toBe('number');
    });
  });

  describe('Client Isolation', () => {
    it('should only evict entries for specified client', async () => {
      await store.insert([
        {
          id: '1',
          clientId: 'client-a',
          priority: MemoryPriority.EPHEMERAL,
          tokens: 100,
        },
        {
          id: '2',
          clientId: 'client-b',
          priority: MemoryPriority.EPHEMERAL,
          tokens: 100,
        },
      ]);

      const result = await engine.evict({
        targetTokens: 100,
        clientId: 'client-a',
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
          'basic-client': { maxPinned: 1000 },
        },
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
        strategy: EvictionStrategy.LRU,
      });

      await store.insert([
        {
          id: 'old',
          priority: MemoryPriority.SLIDING,
          lastAccessed: new Date(Date.now() - 10000),
          tokens: 100,
        },
        {
          id: 'new',
          priority: MemoryPriority.SLIDING,
          lastAccessed: new Date(),
          tokens: 100,
        },
      ]);

      const result = await lruEngine.evict({ targetCount: 1 });
      expect(result.evictedIds[0]).toBe('old');
    });

    it('should support LFU strategy for SLIDING entries', async () => {
      const lfuEngine = new EvictionEngine({
        store,
        strategy: EvictionStrategy.LFU,
      });

      await store.insert([
        {
          id: 'rare',
          priority: MemoryPriority.SLIDING,
          accessCount: 1,
          tokens: 100,
        },
        {
          id: 'frequent',
          priority: MemoryPriority.SLIDING,
          accessCount: 100,
          tokens: 100,
        },
      ]);

      const result = await lfuEngine.evict({ targetCount: 1 });
      expect(result.evictedIds[0]).toBe('rare');
    });

    it('should support FIFO strategy for EPHEMERAL entries', async () => {
      const fifoEngine = new EvictionEngine({
        store,
        strategy: EvictionStrategy.FIFO,
      });

      await store.insert([
        {
          id: 'first',
          priority: MemoryPriority.EPHEMERAL,
          createdAt: new Date(Date.now() - 10000),
          tokens: 100,
        },
        {
          id: 'second',
          priority: MemoryPriority.EPHEMERAL,
          createdAt: new Date(),
          tokens: 100,
        },
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
          tokens: 10,
        }))
      );

      // Fire multiple evictions concurrently
      const results = await Promise.all([
        engine.evict({ targetTokens: 200 }),
        engine.evict({ targetTokens: 200 }),
        engine.evict({ targetTokens: 200 }),
      ]);

      // Due to lock, only one should actually evict
      const totalEvicted = results.reduce((sum, r) => sum + r.evictedIds.length, 0);
      // At least 20 entries (200 tokens / 10 tokens each)
      expect(totalEvicted).toBeGreaterThanOrEqual(20);

      // Should not double-evict entries (lock prevents concurrent execution)
      const allEvicted = results.flatMap((r) => r.evictedIds);
      const uniqueEvicted = [...new Set(allEvicted)];
      expect(allEvicted.length).toBe(uniqueEvicted.length);
    });
  });

  describe('Auto Eviction', () => {
    it('should not evict when under limits', async () => {
      await store.insert([
        { id: '1', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
      ]);

      const result = await engine.autoEvict();

      expect(result).toBeNull();
    });

    it('should auto-evict when over token limit', async () => {
      engine = new EvictionEngine({
        store,
        maxTokens: 500,
        onEvict: (event) => auditEvents.push(event),
      });

      await store.insert([
        { id: '1', priority: MemoryPriority.EPHEMERAL, tokens: 300 },
        { id: '2', priority: MemoryPriority.EPHEMERAL, tokens: 300 },
      ]);

      const result = await engine.autoEvict();

      expect(result).not.toBeNull();
      expect(result!.evictedIds.length).toBeGreaterThan(0);
    });
  });

  describe('Needs Eviction Check', () => {
    it('should return false when under all limits', async () => {
      await store.insert([
        { id: '1', priority: MemoryPriority.EPHEMERAL, tokens: 100 },
      ]);

      const result = await engine.needsEviction();

      expect(result.needed).toBe(false);
    });

    it('should return true when over entry limit', async () => {
      engine = new EvictionEngine({
        store,
        maxEntries: 5,
      });

      await store.insert(
        Array.from({ length: 10 }, (_, i) => ({
          id: `entry-${i}`,
          priority: MemoryPriority.EPHEMERAL,
          tokens: 10,
        }))
      );

      const result = await engine.needsEviction();

      expect(result.needed).toBe(true);
      expect(result.reason).toContain('Entry count');
    });

    it('should return true when over token limit', async () => {
      engine = new EvictionEngine({
        store,
        maxTokens: 500,
      });

      await store.insert([
        { id: '1', priority: MemoryPriority.EPHEMERAL, tokens: 600 },
      ]);

      const result = await engine.needsEviction();

      expect(result.needed).toBe(true);
      expect(result.reason).toContain('Token count');
    });
  });
});
