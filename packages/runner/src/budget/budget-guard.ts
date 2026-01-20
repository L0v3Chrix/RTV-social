/**
 * S1-D2: Budget Guard
 *
 * Wraps operations with budget checks to prevent exceeding limits.
 * Provides guards for LLM calls, tool calls, and subcall allocation.
 */

import type { BudgetTracker } from './budget-tracker.js';
import type { EpisodeBudget } from '../episode/types.js';

/**
 * Error thrown when budget is exceeded.
 */
export class BudgetExceededError extends Error {
  override name = 'BudgetExceededError';
  violations: string[];
  details: Record<string, unknown>;

  constructor(violations: string[], details: Record<string, unknown> = {}) {
    super(`Budget exceeded: ${violations.join(', ')}`);
    this.violations = violations;
    this.details = details;
  }
}

/**
 * Budget check request.
 */
export interface BudgetCheckRequest {
  tokens?: number;
}

/**
 * Options for budget check with actual usage.
 */
export interface BudgetCheckOptions {
  actualTokens?: number;
}

/**
 * Options for guarding LLM calls.
 */
export interface LLMGuardOptions {
  estimatedTokens: number;
  model?: string;
}

/**
 * LLM response with usage.
 */
export interface LLMResponse {
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Options for allocating subcall budget.
 */
export interface SubcallBudgetOptions {
  fraction: number;
  minTokens?: number;
  minTimeMs?: number;
}

/**
 * Remaining budget info.
 */
export interface RemainingBudget {
  tokens: number;
  timeMs: number;
  subcalls: number;
  toolCalls: number;
}

/**
 * Budget guard configuration.
 */
export interface BudgetGuardConfig {
  tracker: BudgetTracker;
  onExceeded?: (error: BudgetExceededError) => void;
}

/**
 * Budget guard interface.
 */
export interface BudgetGuard {
  withBudgetCheck<T>(
    request: BudgetCheckRequest,
    fn: () => Promise<T>,
    options?: BudgetCheckOptions
  ): Promise<T>;
  guardLLMCall<T extends LLMResponse>(
    fn: () => Promise<T>,
    options: LLMGuardOptions
  ): Promise<T>;
  guardToolCall<T>(toolName: string, fn: () => Promise<T>): Promise<T>;
  allocateSubcallBudget(options: SubcallBudgetOptions): Promise<EpisodeBudget>;
  getRemainingBudget(): RemainingBudget;
}

/**
 * Create a budget guard instance.
 */
export function createBudgetGuard(config: BudgetGuardConfig): BudgetGuard {
  const { tracker, onExceeded } = config;

  /**
   * Handle budget exceeded error.
   */
  function handleExceeded(error: BudgetExceededError): void {
    if (onExceeded) {
      onExceeded(error);
    }
  }

  return {
    async withBudgetCheck<T>(
      request: BudgetCheckRequest,
      fn: () => Promise<T>,
      options?: BudgetCheckOptions
    ): Promise<T> {
      // Check before execution
      const checkRequest: { tokens?: number } = {};
      if (request.tokens !== undefined) {
        checkRequest.tokens = request.tokens;
      }
      const checkResult = tracker.checkBefore(checkRequest);

      if (!checkResult.allowed) {
        const error = new BudgetExceededError(checkResult.violations, checkResult.details ?? {});
        handleExceeded(error);
        throw error;
      }

      // Execute the function
      const result = await fn();

      // Record actual usage (or estimated if not provided)
      const tokensUsed = options?.actualTokens ?? request.tokens ?? 0;
      if (tokensUsed > 0) {
        tracker.recordTokens(tokensUsed);
      }

      return result;
    },

    async guardLLMCall<T extends LLMResponse>(
      fn: () => Promise<T>,
      options: LLMGuardOptions
    ): Promise<T> {
      const { estimatedTokens, model } = options;

      // Check before execution
      const checkResult = tracker.checkBefore({
        tokens: estimatedTokens,
      });

      if (!checkResult.allowed) {
        const error = new BudgetExceededError(checkResult.violations, checkResult.details ?? {});
        handleExceeded(error);
        throw error;
      }

      // Execute the LLM call
      const result = await fn();

      // Calculate actual tokens from usage or use estimate
      let actualTokens = estimatedTokens;
      if (result.usage) {
        actualTokens = result.usage.input_tokens + result.usage.output_tokens;
      }

      // Record token usage with model context
      const recordOptions: { type: 'input' | 'output' | 'total'; model?: string } = { type: 'total' };
      if (model !== undefined) {
        recordOptions.model = model;
      }
      tracker.recordTokens(actualTokens, recordOptions);

      return result;
    },

    async guardToolCall<T>(toolName: string, fn: () => Promise<T>): Promise<T> {
      // Check before execution
      const checkResult = tracker.checkBefore({
        toolCalls: 1,
      });

      if (!checkResult.allowed) {
        const error = new BudgetExceededError(checkResult.violations, checkResult.details ?? {});
        handleExceeded(error);
        throw error;
      }

      // Record tool call before execution (to track attempts)
      tracker.recordToolCall(toolName);

      // Execute the tool
      return fn();
    },

    // eslint-disable-next-line @typescript-eslint/require-await
    async allocateSubcallBudget(options: SubcallBudgetOptions): Promise<EpisodeBudget> {
      const { fraction, minTokens, minTimeMs } = options;

      // Check if subcall is allowed
      const checkResult = tracker.checkBefore({
        subcalls: 1,
      });

      if (!checkResult.allowed) {
        const error = new BudgetExceededError(checkResult.violations, checkResult.details ?? {});
        handleExceeded(error);
        throw error;
      }

      // Record the subcall
      tracker.recordSubcall(`subcall_${Date.now()}`);

      // Get current state and budget
      const state = tracker.getState();
      const budget = tracker.getBudget();

      // Calculate subcall budget
      const subcallBudget: EpisodeBudget = {};

      // Tokens: allocate fraction of remaining
      if (budget.maxTokens !== undefined) {
        const remaining = budget.maxTokens - state.tokensUsed;
        const allocated = Math.floor(remaining * fraction);
        subcallBudget.maxTokens = minTokens !== undefined ? Math.max(allocated, minTokens) : allocated;
      }

      // Time: allocate fraction of remaining
      if (budget.maxTimeMs !== undefined) {
        const remaining = budget.maxTimeMs - state.timeElapsedMs;
        const allocated = Math.floor(remaining * fraction);
        subcallBudget.maxTimeMs = minTimeMs !== undefined ? Math.max(allocated, minTimeMs) : allocated;
      }

      // Retries: pass through
      if (budget.maxRetries !== undefined) {
        subcallBudget.maxRetries = budget.maxRetries;
      }

      // Subcalls: allocate fraction of remaining (already decremented by 1)
      if (budget.maxSubcalls !== undefined) {
        const remaining = budget.maxSubcalls - state.subcallsUsed;
        subcallBudget.maxSubcalls = Math.floor(remaining * fraction);
      }

      // Tool calls: allocate fraction of remaining
      if (budget.maxToolCalls !== undefined) {
        const remaining = budget.maxToolCalls - state.toolCallsUsed;
        subcallBudget.maxToolCalls = Math.floor(remaining * fraction);
      }

      return subcallBudget;
    },

    getRemainingBudget(): RemainingBudget {
      const state = tracker.getState();
      const budget = tracker.getBudget();

      return {
        tokens:
          budget.maxTokens !== undefined ? budget.maxTokens - state.tokensUsed : Infinity,
        timeMs:
          budget.maxTimeMs !== undefined ? budget.maxTimeMs - state.timeElapsedMs : Infinity,
        subcalls:
          budget.maxSubcalls !== undefined ? budget.maxSubcalls - state.subcallsUsed : Infinity,
        toolCalls:
          budget.maxToolCalls !== undefined
            ? budget.maxToolCalls - state.toolCallsUsed
            : Infinity,
      };
    },
  };
}
