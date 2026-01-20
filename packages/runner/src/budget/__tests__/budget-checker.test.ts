/**
 * S1-D2: Budget Checker Tests
 *
 * Tests for budget checking logic that validates operations
 * against available budgets.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createBudgetChecker, BudgetChecker } from '../budget-checker.js';
import type { EpisodeBudget, BudgetState } from '../../episode/types.js';

describe('BudgetChecker', () => {
  let checker: BudgetChecker;

  const fullBudget: EpisodeBudget = {
    maxTokens: 100000,
    maxTimeMs: 300000,
    maxRetries: 3,
    maxSubcalls: 10,
    maxToolCalls: 50,
  };

  const emptyState: BudgetState = {
    tokensUsed: 0,
    timeElapsedMs: 0,
    retriesUsed: 0,
    subcallsUsed: 0,
    toolCallsUsed: 0,
  };

  beforeEach(() => {
    checker = createBudgetChecker();
  });

  describe('checkTokenBudget', () => {
    it('should allow when under budget', () => {
      const state = { ...emptyState, tokensUsed: 50000 };
      const result = checker.checkTokenBudget(fullBudget, state, 10000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(40000);
    });

    it('should deny when would exceed budget', () => {
      const state = { ...emptyState, tokensUsed: 95000 };
      const result = checker.checkTokenBudget(fullBudget, state, 10000);

      expect(result.allowed).toBe(false);
      expect(result.wouldExceedBy).toBe(5000);
    });

    it('should allow exactly at limit', () => {
      const state = { ...emptyState, tokensUsed: 90000 };
      const result = checker.checkTokenBudget(fullBudget, state, 10000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should return unlimited when no maxTokens set', () => {
      const noBudget: EpisodeBudget = {};
      const result = checker.checkTokenBudget(noBudget, emptyState, 1000000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });

    it('should handle zero requested tokens', () => {
      const state = { ...emptyState, tokensUsed: 50000 };
      const result = checker.checkTokenBudget(fullBudget, state, 0);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(50000);
    });
  });

  describe('checkTimeBudget', () => {
    it('should allow when under time limit', () => {
      const state = { ...emptyState, timeElapsedMs: 120000 };
      const result = checker.checkTimeBudget(fullBudget, state);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(180000);
    });

    it('should deny when time exceeded', () => {
      const state = { ...emptyState, timeElapsedMs: 350000 };
      const result = checker.checkTimeBudget(fullBudget, state);

      expect(result.allowed).toBe(false);
      expect(result.exceededBy).toBe(50000);
    });

    it('should include deadline', () => {
      const state = { ...emptyState, timeElapsedMs: 100000 };
      const startTime = Date.now() - 100000;
      const result = checker.checkTimeBudget(fullBudget, state, startTime);

      expect(result.deadline).toBeDefined();
      expect(result.deadline).toBeGreaterThan(Date.now());
    });

    it('should return unlimited when no maxTimeMs set', () => {
      const noBudget: EpisodeBudget = {};
      const result = checker.checkTimeBudget(noBudget, emptyState);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });

    it('should deny at exactly time limit', () => {
      const state = { ...emptyState, timeElapsedMs: 300000 };
      const result = checker.checkTimeBudget(fullBudget, state);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('checkRetryBudget', () => {
    it('should allow when under retry limit', () => {
      const state = { ...emptyState, retriesUsed: 1 };
      const result = checker.checkRetryBudget(fullBudget, state);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should deny when retries exhausted', () => {
      const state = { ...emptyState, retriesUsed: 3 };
      const result = checker.checkRetryBudget(fullBudget, state);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return unlimited when no maxRetries set', () => {
      const noBudget: EpisodeBudget = {};
      const result = checker.checkRetryBudget(noBudget, emptyState);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });
  });

  describe('checkSubcallBudget', () => {
    it('should allow when under limit', () => {
      const state = { ...emptyState, subcallsUsed: 5 };
      const result = checker.checkSubcallBudget(fullBudget, state);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it('should deny when at limit', () => {
      const state = { ...emptyState, subcallsUsed: 10 };
      const result = checker.checkSubcallBudget(fullBudget, state);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return unlimited when no maxSubcalls set', () => {
      const noBudget: EpisodeBudget = {};
      const result = checker.checkSubcallBudget(noBudget, emptyState);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });
  });

  describe('checkToolCallBudget', () => {
    it('should allow when under limit', () => {
      const state = { ...emptyState, toolCallsUsed: 25 };
      const result = checker.checkToolCallBudget(fullBudget, state);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(25);
    });

    it('should deny when would exceed', () => {
      const state = { ...emptyState, toolCallsUsed: 48 };
      const result = checker.checkToolCallBudget(fullBudget, state, 5);

      expect(result.allowed).toBe(false);
      expect(result.wouldExceedBy).toBe(3);
    });

    it('should return unlimited when no maxToolCalls set', () => {
      const noBudget: EpisodeBudget = {};
      const result = checker.checkToolCallBudget(noBudget, emptyState);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });

    it('should allow exactly at limit', () => {
      const state = { ...emptyState, toolCallsUsed: 49 };
      const result = checker.checkToolCallBudget(fullBudget, state, 1);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });
  });

  describe('checkAll', () => {
    it('should return OK when all budgets pass', () => {
      const state: BudgetState = {
        tokensUsed: 50000,
        timeElapsedMs: 100000,
        retriesUsed: 1,
        subcallsUsed: 3,
        toolCallsUsed: 20,
      };

      const result = checker.checkAll(fullBudget, state);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should return violations when any budget fails', () => {
      const state: BudgetState = {
        tokensUsed: 110000, // Over
        timeElapsedMs: 100000,
        retriesUsed: 1,
        subcallsUsed: 15, // Over
        toolCallsUsed: 20,
      };

      const result = checker.checkAll(fullBudget, state);

      expect(result.allowed).toBe(false);
      expect(result.violations).toContain('tokens');
      expect(result.violations).toContain('subcalls');
    });

    it('should include all budget details', () => {
      const result = checker.checkAll(fullBudget, emptyState);

      expect(result.details).toMatchObject({
        tokens: { allowed: true, used: 0, max: 100000 },
        time: { allowed: true, used: 0, max: 300000 },
        retries: { allowed: true, used: 0, max: 3 },
        subcalls: { allowed: true, used: 0, max: 10 },
        toolCalls: { allowed: true, used: 0, max: 50 },
      });
    });

    it('should handle empty budget (all allowed)', () => {
      const noBudget: EpisodeBudget = {};
      const result = checker.checkAll(noBudget, emptyState);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect multiple violations', () => {
      const state: BudgetState = {
        tokensUsed: 150000,
        timeElapsedMs: 400000,
        retriesUsed: 5,
        subcallsUsed: 15,
        toolCallsUsed: 60,
      };

      const result = checker.checkAll(fullBudget, state);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(5);
      expect(result.violations).toContain('tokens');
      expect(result.violations).toContain('time');
      expect(result.violations).toContain('retries');
      expect(result.violations).toContain('subcalls');
      expect(result.violations).toContain('toolCalls');
    });
  });

  describe('calculateSubcallBudget', () => {
    it('should allocate fraction of remaining budget', () => {
      const parentState: BudgetState = {
        tokensUsed: 30000,
        timeElapsedMs: 100000,
        retriesUsed: 0,
        subcallsUsed: 2,
        toolCallsUsed: 10,
      };

      const subcallBudget = checker.calculateSubcallBudget(fullBudget, parentState, {
        fraction: 0.5,
      });

      // Half of remaining tokens: (100000 - 30000) * 0.5 = 35000
      expect(subcallBudget.maxTokens).toBe(35000);
      // Half of remaining time: (300000 - 100000) * 0.5 = 100000
      expect(subcallBudget.maxTimeMs).toBe(100000);
      // Subcalls decremented: (10 - 2 - 1) * 0.5 = 3.5 -> 3
      expect(subcallBudget.maxSubcalls).toBeLessThan(fullBudget.maxSubcalls!);
    });

    it('should respect minimum allocations', () => {
      const parentState: BudgetState = {
        tokensUsed: 99000, // Almost exhausted
        timeElapsedMs: 290000,
        retriesUsed: 0,
        subcallsUsed: 0,
        toolCallsUsed: 0,
      };

      const subcallBudget = checker.calculateSubcallBudget(fullBudget, parentState, {
        fraction: 0.5,
        minTokens: 5000,
        minTimeMs: 30000,
      });

      expect(subcallBudget.maxTokens).toBe(5000);
      expect(subcallBudget.maxTimeMs).toBe(30000);
    });

    it('should handle undefined budget limits', () => {
      const noBudget: EpisodeBudget = {};

      const subcallBudget = checker.calculateSubcallBudget(noBudget, emptyState, {
        fraction: 0.5,
      });

      expect(subcallBudget.maxTokens).toBeUndefined();
      expect(subcallBudget.maxTimeMs).toBeUndefined();
      expect(subcallBudget.maxSubcalls).toBeUndefined();
    });

    it('should pass through retries (not cascaded)', () => {
      const subcallBudget = checker.calculateSubcallBudget(fullBudget, emptyState, {
        fraction: 0.5,
      });

      expect(subcallBudget.maxRetries).toBe(fullBudget.maxRetries);
    });

    it('should calculate tool call allocation', () => {
      const parentState: BudgetState = {
        tokensUsed: 0,
        timeElapsedMs: 0,
        retriesUsed: 0,
        subcallsUsed: 0,
        toolCallsUsed: 20,
      };

      const subcallBudget = checker.calculateSubcallBudget(fullBudget, parentState, {
        fraction: 0.5,
      });

      // Half of remaining: (50 - 20) * 0.5 = 15
      expect(subcallBudget.maxToolCalls).toBe(15);
    });
  });
});
