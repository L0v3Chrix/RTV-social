/**
 * S1-D2: Budget Checker
 *
 * Pure functions for checking budget constraints.
 * Validates whether operations can proceed within budget limits.
 */

import type { EpisodeBudget, BudgetState } from '../episode/types.js';

/**
 * Result of a token budget check.
 */
export interface TokenCheckResult {
  allowed: boolean;
  remaining: number;
  wouldExceedBy?: number;
}

/**
 * Result of a time budget check.
 */
export interface TimeCheckResult {
  allowed: boolean;
  remaining: number;
  exceededBy?: number;
  deadline?: number;
}

/**
 * Result of a retry budget check.
 */
export interface RetryCheckResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Result of a subcall budget check.
 */
export interface SubcallCheckResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Result of a tool call budget check.
 */
export interface ToolCallCheckResult {
  allowed: boolean;
  remaining: number;
  wouldExceedBy?: number;
}

/**
 * Budget type for violations.
 */
export type BudgetType = 'tokens' | 'time' | 'retries' | 'subcalls' | 'toolCalls';

/**
 * Detail for a specific budget type.
 */
export interface BudgetDetail {
  allowed: boolean;
  used: number;
  max: number | undefined;
  remaining?: number;
  exceededBy?: number;
  wouldExceedBy?: number;
}

/**
 * Result of checking all budgets.
 */
export interface CheckAllResult {
  allowed: boolean;
  violations: BudgetType[];
  details: {
    tokens: BudgetDetail;
    time: BudgetDetail;
    retries: BudgetDetail;
    subcalls: BudgetDetail;
    toolCalls: BudgetDetail;
  };
}

/**
 * Options for subcall budget calculation.
 */
export interface SubcallBudgetOptions {
  fraction: number;
  minTokens?: number;
  minTimeMs?: number;
}

/**
 * Budget checker interface.
 */
export interface BudgetChecker {
  checkTokenBudget(
    budget: EpisodeBudget,
    state: BudgetState,
    requestedTokens: number
  ): TokenCheckResult;
  checkTimeBudget(
    budget: EpisodeBudget,
    state: BudgetState,
    startTime?: number
  ): TimeCheckResult;
  checkRetryBudget(budget: EpisodeBudget, state: BudgetState): RetryCheckResult;
  checkSubcallBudget(budget: EpisodeBudget, state: BudgetState): SubcallCheckResult;
  checkToolCallBudget(
    budget: EpisodeBudget,
    state: BudgetState,
    requestedCalls?: number
  ): ToolCallCheckResult;
  checkAll(budget: EpisodeBudget, state: BudgetState): CheckAllResult;
  calculateSubcallBudget(
    parentBudget: EpisodeBudget,
    parentState: BudgetState,
    options: SubcallBudgetOptions
  ): EpisodeBudget;
}

/**
 * Create a budget checker instance.
 */
export function createBudgetChecker(): BudgetChecker {
  return {
    checkTokenBudget(
      budget: EpisodeBudget,
      state: BudgetState,
      requestedTokens: number
    ): TokenCheckResult {
      if (budget.maxTokens === undefined) {
        return { allowed: true, remaining: Infinity };
      }

      const remaining = budget.maxTokens - state.tokensUsed;
      const wouldUse = state.tokensUsed + requestedTokens;

      if (wouldUse > budget.maxTokens) {
        return {
          allowed: false,
          remaining: Math.max(0, remaining),
          wouldExceedBy: wouldUse - budget.maxTokens,
        };
      }

      return {
        allowed: true,
        remaining: budget.maxTokens - wouldUse,
      };
    },

    checkTimeBudget(
      budget: EpisodeBudget,
      state: BudgetState,
      startTime?: number
    ): TimeCheckResult {
      if (budget.maxTimeMs === undefined) {
        return { allowed: true, remaining: Infinity };
      }

      const remaining = budget.maxTimeMs - state.timeElapsedMs;

      // Time at or exceeded budget is not allowed
      if (state.timeElapsedMs >= budget.maxTimeMs) {
        return {
          allowed: false,
          remaining: Math.max(0, remaining),
          exceededBy: state.timeElapsedMs - budget.maxTimeMs,
        };
      }

      const result: TimeCheckResult = {
        allowed: true,
        remaining,
      };

      // Calculate deadline if start time provided
      if (startTime !== undefined) {
        result.deadline = startTime + budget.maxTimeMs;
      }

      return result;
    },

    checkRetryBudget(budget: EpisodeBudget, state: BudgetState): RetryCheckResult {
      if (budget.maxRetries === undefined) {
        return { allowed: true, remaining: Infinity };
      }

      const remaining = budget.maxRetries - state.retriesUsed;

      return {
        allowed: remaining > 0,
        remaining: Math.max(0, remaining),
      };
    },

    checkSubcallBudget(budget: EpisodeBudget, state: BudgetState): SubcallCheckResult {
      if (budget.maxSubcalls === undefined) {
        return { allowed: true, remaining: Infinity };
      }

      const remaining = budget.maxSubcalls - state.subcallsUsed;

      return {
        allowed: remaining > 0,
        remaining: Math.max(0, remaining),
      };
    },

    checkToolCallBudget(
      budget: EpisodeBudget,
      state: BudgetState,
      requestedCalls = 0
    ): ToolCallCheckResult {
      if (budget.maxToolCalls === undefined) {
        return { allowed: true, remaining: Infinity };
      }

      const remaining = budget.maxToolCalls - state.toolCallsUsed;

      // If no specific request, just return current state
      if (requestedCalls === 0) {
        return {
          allowed: remaining > 0,
          remaining: Math.max(0, remaining),
        };
      }

      const wouldUse = state.toolCallsUsed + requestedCalls;

      if (wouldUse > budget.maxToolCalls) {
        return {
          allowed: false,
          remaining: Math.max(0, remaining),
          wouldExceedBy: wouldUse - budget.maxToolCalls,
        };
      }

      return {
        allowed: true,
        remaining: budget.maxToolCalls - wouldUse,
      };
    },

    checkAll(budget: EpisodeBudget, state: BudgetState): CheckAllResult {
      const violations: BudgetType[] = [];
      const details: CheckAllResult['details'] = {
        tokens: {
          allowed: true,
          used: state.tokensUsed,
          max: budget.maxTokens,
        },
        time: {
          allowed: true,
          used: state.timeElapsedMs,
          max: budget.maxTimeMs,
        },
        retries: {
          allowed: true,
          used: state.retriesUsed,
          max: budget.maxRetries,
        },
        subcalls: {
          allowed: true,
          used: state.subcallsUsed,
          max: budget.maxSubcalls,
        },
        toolCalls: {
          allowed: true,
          used: state.toolCallsUsed,
          max: budget.maxToolCalls,
        },
      };

      // Check tokens
      if (budget.maxTokens !== undefined && state.tokensUsed > budget.maxTokens) {
        violations.push('tokens');
        details.tokens.allowed = false;
        details.tokens.exceededBy = state.tokensUsed - budget.maxTokens;
      }

      // Check time
      if (budget.maxTimeMs !== undefined && state.timeElapsedMs >= budget.maxTimeMs) {
        violations.push('time');
        details.time.allowed = false;
        details.time.exceededBy = state.timeElapsedMs - budget.maxTimeMs;
      }

      // Check retries
      if (budget.maxRetries !== undefined && state.retriesUsed >= budget.maxRetries) {
        violations.push('retries');
        details.retries.allowed = false;
      }

      // Check subcalls
      if (budget.maxSubcalls !== undefined && state.subcallsUsed >= budget.maxSubcalls) {
        violations.push('subcalls');
        details.subcalls.allowed = false;
      }

      // Check tool calls
      if (budget.maxToolCalls !== undefined && state.toolCallsUsed >= budget.maxToolCalls) {
        violations.push('toolCalls');
        details.toolCalls.allowed = false;
      }

      return {
        allowed: violations.length === 0,
        violations,
        details,
      };
    },

    calculateSubcallBudget(
      parentBudget: EpisodeBudget,
      parentState: BudgetState,
      options: SubcallBudgetOptions
    ): EpisodeBudget {
      const { fraction, minTokens, minTimeMs } = options;
      const subcallBudget: EpisodeBudget = {};

      // Tokens: allocate fraction of remaining
      if (parentBudget.maxTokens !== undefined) {
        const remaining = parentBudget.maxTokens - parentState.tokensUsed;
        const allocated = Math.floor(remaining * fraction);
        subcallBudget.maxTokens = minTokens ? Math.max(allocated, minTokens) : allocated;
      }

      // Time: allocate fraction of remaining
      if (parentBudget.maxTimeMs !== undefined) {
        const remaining = parentBudget.maxTimeMs - parentState.timeElapsedMs;
        const allocated = Math.floor(remaining * fraction);
        subcallBudget.maxTimeMs = minTimeMs ? Math.max(allocated, minTimeMs) : allocated;
      }

      // Retries: pass through (not cascaded)
      if (parentBudget.maxRetries !== undefined) {
        subcallBudget.maxRetries = parentBudget.maxRetries;
      }

      // Subcalls: allocate fraction of remaining (minus 1 for the current call)
      if (parentBudget.maxSubcalls !== undefined) {
        const remaining = parentBudget.maxSubcalls - parentState.subcallsUsed - 1;
        subcallBudget.maxSubcalls = Math.max(0, Math.floor(remaining * fraction));
      }

      // Tool calls: allocate fraction of remaining
      if (parentBudget.maxToolCalls !== undefined) {
        const remaining = parentBudget.maxToolCalls - parentState.toolCallsUsed;
        subcallBudget.maxToolCalls = Math.floor(remaining * fraction);
      }

      return subcallBudget;
    },
  };
}
