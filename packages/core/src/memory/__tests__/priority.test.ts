import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MemoryPriority,
  isValidPriority,
  getPriorityWeight,
  canEvict,
  calculateEvictionScore,
  validatePinnedBudget,
  getPinnedBudgetUsage,
  suggestPriority,
  PRIORITY_CATEGORIES,
  DEFAULT_PINNED_BUDGET,
} from '../priority.js';

describe('S1-B6: Memory Priority Schema', () => {
  describe('MemoryPriority Enum', () => {
    it('should define PINNED priority level', () => {
      expect(MemoryPriority.PINNED).toBe('pinned');
    });

    it('should define SESSION priority level', () => {
      expect(MemoryPriority.SESSION).toBe('session');
    });

    it('should define SLIDING priority level', () => {
      expect(MemoryPriority.SLIDING).toBe('sliding');
    });

    it('should define EPHEMERAL priority level', () => {
      expect(MemoryPriority.EPHEMERAL).toBe('ephemeral');
    });

    it('should have exactly 4 priority levels', () => {
      const values = Object.values(MemoryPriority);
      expect(values).toHaveLength(4);
    });
  });

  describe('Priority Validation', () => {
    it('should validate correct priority values', () => {
      expect(isValidPriority('pinned')).toBe(true);
      expect(isValidPriority('session')).toBe(true);
      expect(isValidPriority('sliding')).toBe(true);
      expect(isValidPriority('ephemeral')).toBe(true);
    });

    it('should reject invalid priority values', () => {
      expect(isValidPriority('invalid')).toBe(false);
      expect(isValidPriority('')).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(isValidPriority(null as any)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(isValidPriority(undefined as any)).toBe(false);
    });

    it('should reject non-string values', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(isValidPriority(123 as any)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(isValidPriority({} as any)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(isValidPriority([] as any)).toBe(false);
    });
  });

  describe('Priority Weight Calculation', () => {
    it('should return highest weight for PINNED', () => {
      expect(getPriorityWeight(MemoryPriority.PINNED)).toBe(1000);
    });

    it('should return high weight for SESSION', () => {
      expect(getPriorityWeight(MemoryPriority.SESSION)).toBe(100);
    });

    it('should return medium weight for SLIDING', () => {
      expect(getPriorityWeight(MemoryPriority.SLIDING)).toBe(10);
    });

    it('should return lowest weight for EPHEMERAL', () => {
      expect(getPriorityWeight(MemoryPriority.EPHEMERAL)).toBe(1);
    });

    it('should maintain weight ordering: PINNED > SESSION > SLIDING > EPHEMERAL', () => {
      const pinned = getPriorityWeight(MemoryPriority.PINNED);
      const session = getPriorityWeight(MemoryPriority.SESSION);
      const sliding = getPriorityWeight(MemoryPriority.SLIDING);
      const ephemeral = getPriorityWeight(MemoryPriority.EPHEMERAL);

      expect(pinned).toBeGreaterThan(session);
      expect(session).toBeGreaterThan(sliding);
      expect(sliding).toBeGreaterThan(ephemeral);
    });
  });

  describe('Eviction Rules', () => {
    it('should never allow eviction of PINNED entries', () => {
      expect(canEvict(MemoryPriority.PINNED)).toBe(false);
      expect(canEvict(MemoryPriority.PINNED, { sessionActive: false })).toBe(false);
      expect(canEvict(MemoryPriority.PINNED, { memoryPressure: 'high' })).toBe(false);
    });

    it('should allow eviction of SESSION entries only on session end', () => {
      expect(canEvict(MemoryPriority.SESSION, { sessionActive: true })).toBe(false);
      expect(canEvict(MemoryPriority.SESSION, { sessionActive: false })).toBe(true);
    });

    it('should not evict SESSION entries when sessionActive is undefined', () => {
      // Default behavior: session is considered active
      expect(canEvict(MemoryPriority.SESSION)).toBe(false);
    });

    it('should allow eviction of SLIDING entries', () => {
      expect(canEvict(MemoryPriority.SLIDING)).toBe(true);
      expect(canEvict(MemoryPriority.SLIDING, { sessionActive: true })).toBe(true);
    });

    it('should always allow eviction of EPHEMERAL entries', () => {
      expect(canEvict(MemoryPriority.EPHEMERAL)).toBe(true);
      expect(canEvict(MemoryPriority.EPHEMERAL, { sessionActive: true })).toBe(true);
    });
  });

  describe('Eviction Score Calculation', () => {
    it('should return higher score for PINNED than SESSION', () => {
      const now = new Date();
      const pinnedScore = calculateEvictionScore(MemoryPriority.PINNED, now, 1);
      const sessionScore = calculateEvictionScore(MemoryPriority.SESSION, now, 1);

      expect(pinnedScore).toBeGreaterThan(sessionScore);
    });

    it('should decrease score as entry ages', () => {
      const recentDate = new Date();
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

      const recentScore = calculateEvictionScore(MemoryPriority.SLIDING, recentDate, 1);
      const oldScore = calculateEvictionScore(MemoryPriority.SLIDING, oldDate, 1);

      expect(recentScore).toBeGreaterThan(oldScore);
    });

    it('should increase score with more accesses', () => {
      const now = new Date();
      const lowAccessScore = calculateEvictionScore(MemoryPriority.SLIDING, now, 1);
      const highAccessScore = calculateEvictionScore(MemoryPriority.SLIDING, now, 10);

      expect(highAccessScore).toBeGreaterThan(lowAccessScore);
    });

    it('should return positive score for all valid inputs', () => {
      const now = new Date();
      const priorities = Object.values(MemoryPriority);

      for (const priority of priorities) {
        const score = calculateEvictionScore(priority, now, 0);
        expect(score).toBeGreaterThan(0);
      }
    });
  });

  describe('Pinned Budget Validation', () => {
    const mockGetUsage = vi.fn();
    const mockEstimateTokens = vi.fn();

    beforeEach(() => {
      mockGetUsage.mockReset();
      mockEstimateTokens.mockReset();
    });

    it('should skip validation for non-PINNED entries', async () => {
      const result = await validatePinnedBudget(
        'client-123',
        { content: 'test', priority: MemoryPriority.SLIDING },
        mockGetUsage,
        mockEstimateTokens
      );

      expect(result.valid).toBe(true);
      expect(mockGetUsage).not.toHaveBeenCalled();
    });

    it('should allow pinning within budget', async () => {
      mockGetUsage.mockResolvedValue(500);
      mockEstimateTokens.mockReturnValue(100);

      const result = await validatePinnedBudget(
        'client-123',
        { content: 'Brand voice guidelines', priority: MemoryPriority.PINNED },
        mockGetUsage,
        mockEstimateTokens
      );

      expect(result.valid).toBe(true);
      expect(result.tokensUsed).toBe(600);
      expect(result.tokensRemaining).toBe(1400);
    });

    it('should reject pinning that exceeds budget', async () => {
      mockGetUsage.mockResolvedValue(1900);
      mockEstimateTokens.mockReturnValue(200);

      const result = await validatePinnedBudget(
        'client-123',
        { content: 'Large content', priority: MemoryPriority.PINNED },
        mockGetUsage,
        mockEstimateTokens
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('pinned token budget');
      expect(result.tokensUsed).toBe(1900);
      expect(result.tokensRemaining).toBe(100);
    });

    it('should use custom budget when provided', async () => {
      mockGetUsage.mockResolvedValue(0);
      mockEstimateTokens.mockReturnValue(150);

      const result = await validatePinnedBudget(
        'client-123',
        { content: 'test', priority: MemoryPriority.PINNED },
        mockGetUsage,
        mockEstimateTokens,
        100 // Custom budget of 100
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('150/100');
    });
  });

  describe('Pinned Budget Usage', () => {
    it('should return correct usage summary', async () => {
      const mockGetUsage = vi.fn().mockResolvedValue(500);
      const mockGetCount = vi.fn().mockResolvedValue(3);

      const usage = await getPinnedBudgetUsage(
        'client-123',
        mockGetUsage,
        mockGetCount
      );

      expect(usage.total).toBe(DEFAULT_PINNED_BUDGET);
      expect(usage.used).toBe(500);
      expect(usage.remaining).toBe(1500);
      expect(usage.entries).toBe(3);
    });
  });

  describe('Priority Categories', () => {
    it('should define categories for all priority levels', () => {
      expect(PRIORITY_CATEGORIES[MemoryPriority.PINNED]).toBeDefined();
      expect(PRIORITY_CATEGORIES[MemoryPriority.SESSION]).toBeDefined();
      expect(PRIORITY_CATEGORIES[MemoryPriority.SLIDING]).toBeDefined();
      expect(PRIORITY_CATEGORIES[MemoryPriority.EPHEMERAL]).toBeDefined();
    });

    it('should include brand_voice in PINNED categories', () => {
      expect(PRIORITY_CATEGORIES[MemoryPriority.PINNED]).toContain('brand_voice');
    });

    it('should include campaign_objectives in SESSION categories', () => {
      expect(PRIORITY_CATEGORIES[MemoryPriority.SESSION]).toContain('campaign_objectives');
    });
  });

  describe('Priority Suggestion', () => {
    it('should suggest PINNED for brand_voice', () => {
      expect(suggestPriority('brand_voice')).toBe(MemoryPriority.PINNED);
    });

    it('should suggest SESSION for campaign_objectives', () => {
      expect(suggestPriority('campaign_objectives')).toBe(MemoryPriority.SESSION);
    });

    it('should suggest SLIDING for engagement_history', () => {
      expect(suggestPriority('engagement_history')).toBe(MemoryPriority.SLIDING);
    });

    it('should suggest EPHEMERAL for tool_outputs', () => {
      expect(suggestPriority('tool_outputs')).toBe(MemoryPriority.EPHEMERAL);
    });

    it('should default to SLIDING for unknown categories', () => {
      expect(suggestPriority('unknown_category')).toBe(MemoryPriority.SLIDING);
      expect(suggestPriority('')).toBe(MemoryPriority.SLIDING);
    });
  });

  describe('Constants', () => {
    it('should have DEFAULT_PINNED_BUDGET of 2000', () => {
      expect(DEFAULT_PINNED_BUDGET).toBe(2000);
    });
  });
});
