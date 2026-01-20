/**
 * S1-D2: Budget Tracker
 *
 * Real-time budget tracking that monitors consumption during episode execution.
 * Emits events for warnings and exceeded thresholds.
 */

import { EventEmitter } from 'events';
import type { EpisodeBudget, BudgetState } from '../episode/types.js';

/**
 * Warning event emitted when budget usage crosses threshold.
 */
export interface BudgetWarningEvent {
  type: 'tokens' | 'time' | 'subcalls' | 'toolCalls' | 'retries';
  used: number;
  max: number;
  percentage: number;
}

/**
 * Exceeded event emitted when budget limit is exceeded.
 */
export interface BudgetExceededEvent {
  type: 'tokens' | 'time' | 'subcalls' | 'toolCalls' | 'retries';
  used: number;
  max: number;
  exceededBy: number;
}

/**
 * Options for recording tokens.
 */
export interface RecordTokensOptions {
  type?: 'input' | 'output' | 'total';
  model?: string;
}

/**
 * Budget check request.
 */
export interface BudgetCheckRequest {
  tokens?: number;
  toolCalls?: number;
  subcalls?: number;
}

/**
 * Result of a budget check.
 */
export interface BudgetCheckResult {
  allowed: boolean;
  violations: string[];
  details?: Record<string, unknown>;
}

/**
 * Budget tracker configuration.
 */
export interface BudgetTrackerConfig {
  episodeId: string;
  budget: EpisodeBudget;
  initialState?: Partial<BudgetState>;
  warningThreshold?: number;
}

/**
 * Budget tracker interface.
 */
export interface BudgetTracker extends EventEmitter {
  recordTokens(count: number, options?: RecordTokensOptions): void;
  recordToolCall(toolName: string): void;
  recordSubcall(episodeId: string): void;
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  getState(): BudgetState;
  getBudget(): EpisodeBudget;
  snapshot(): BudgetState;
  checkBefore(request: BudgetCheckRequest): BudgetCheckResult;
  getChildEpisodes(): string[];
  getToolCallCounts(): Record<string, number>;
}

/**
 * Create a budget tracker instance.
 */
export function createBudgetTracker(config: BudgetTrackerConfig): BudgetTracker {
  const { budget, initialState, warningThreshold = 0.8 } = config;

  const emitter = new EventEmitter();

  // State
  let tokensUsed = initialState?.tokensUsed ?? 0;
  let timeElapsedMs = initialState?.timeElapsedMs ?? 0;
  const retriesUsed = initialState?.retriesUsed ?? 0;
  let subcallsUsed = initialState?.subcallsUsed ?? 0;
  let toolCallsUsed = initialState?.toolCallsUsed ?? 0;

  // Tracking
  const childEpisodes: string[] = [];
  const toolCallCounts: Record<string, number> = {};

  // Time tracking
  let startTime: number | null = null;
  let pausedTime: number | null = null;
  let accumulatedTime = initialState?.timeElapsedMs ?? 0;
  let timeCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Warning tracking (only emit once per type)
  const warningsEmitted = new Set<string>();
  // Exceeded tracking (only emit once per type)
  const exceededEmitted = new Set<string>();

  /**
   * Check and emit warning if threshold crossed.
   */
  function checkWarning(type: string, used: number, max: number | undefined): void {
    if (max === undefined) return;
    if (warningsEmitted.has(type)) return;

    const percentage = (used / max) * 100;
    if (percentage >= warningThreshold * 100) {
      warningsEmitted.add(type);
      emitter.emit('warning', {
        type,
        used,
        max,
        percentage,
      } as BudgetWarningEvent);
    }
  }

  /**
   * Check and emit exceeded event.
   */
  function checkExceeded(type: string, used: number, max: number | undefined): void {
    if (max === undefined) return;
    if (exceededEmitted.has(type)) return;
    if (used > max) {
      exceededEmitted.add(type);
      emitter.emit('exceeded', {
        type,
        used,
        max,
        exceededBy: used - max,
      } as BudgetExceededEvent);
    }
  }

  /**
   * Check and emit time exceeded event (uses >= because at limit means exhausted).
   */
  function checkTimeExceeded(used: number, max: number | undefined): void {
    if (max === undefined) return;
    if (exceededEmitted.has('time')) return;
    if (used >= max) {
      exceededEmitted.add('time');
      emitter.emit('exceeded', {
        type: 'time',
        used,
        max,
        exceededBy: Math.max(0, used - max),
      } as BudgetExceededEvent);
    }
  }

  /**
   * Update time elapsed.
   */
  function updateTimeElapsed(): void {
    if (startTime === null || pausedTime !== null) return;
    timeElapsedMs = accumulatedTime + (Date.now() - startTime);
  }

  /**
   * Check time periodically.
   */
  function checkTime(): void {
    updateTimeElapsed();
    checkWarning('time', timeElapsedMs, budget.maxTimeMs);
    checkTimeExceeded(timeElapsedMs, budget.maxTimeMs);
  }

  const tracker: BudgetTracker = Object.assign(emitter, {
    recordTokens(count: number, _options?: RecordTokensOptions): void {
      tokensUsed += count;
      checkWarning('tokens', tokensUsed, budget.maxTokens);
      checkExceeded('tokens', tokensUsed, budget.maxTokens);
    },

    recordToolCall(toolName: string): void {
      toolCallsUsed += 1;
      toolCallCounts[toolName] = (toolCallCounts[toolName] ?? 0) + 1;
      checkWarning('toolCalls', toolCallsUsed, budget.maxToolCalls);
      checkExceeded('toolCalls', toolCallsUsed, budget.maxToolCalls);
    },

    recordSubcall(childEpisodeId: string): void {
      subcallsUsed += 1;
      childEpisodes.push(childEpisodeId);
      checkWarning('subcalls', subcallsUsed, budget.maxSubcalls);
      checkExceeded('subcalls', subcallsUsed, budget.maxSubcalls);
    },

    start(): void {
      if (startTime !== null) return;
      startTime = Date.now();
      pausedTime = null;
      // Check time every 100ms
      timeCheckInterval = setInterval(checkTime, 100);
    },

    stop(): void {
      if (timeCheckInterval) {
        clearInterval(timeCheckInterval);
        timeCheckInterval = null;
      }
      if (startTime !== null && pausedTime === null) {
        accumulatedTime += Date.now() - startTime;
        timeElapsedMs = accumulatedTime;
      }
      startTime = null;
      pausedTime = null;
    },

    pause(): void {
      if (startTime === null || pausedTime !== null) return;
      pausedTime = Date.now();
      accumulatedTime += pausedTime - startTime;
      timeElapsedMs = accumulatedTime;
    },

    resume(): void {
      if (pausedTime === null) return;
      startTime = Date.now();
      pausedTime = null;
    },

    getState(): BudgetState {
      updateTimeElapsed();
      return {
        tokensUsed,
        timeElapsedMs,
        retriesUsed,
        subcallsUsed,
        toolCallsUsed,
      };
    },

    getBudget(): EpisodeBudget {
      return { ...budget };
    },

    snapshot(): BudgetState {
      updateTimeElapsed();
      return {
        tokensUsed,
        timeElapsedMs,
        retriesUsed,
        subcallsUsed,
        toolCallsUsed,
      };
    },

    checkBefore(request: BudgetCheckRequest): BudgetCheckResult {
      const violations: string[] = [];
      const details: Record<string, unknown> = {};

      // Check tokens
      if (request.tokens !== undefined && budget.maxTokens !== undefined) {
        const wouldUse = tokensUsed + request.tokens;
        if (wouldUse > budget.maxTokens) {
          violations.push('tokens');
          details['tokens'] = { wouldExceedBy: wouldUse - budget.maxTokens };
        }
      }

      // Check tool calls
      if (request.toolCalls !== undefined && budget.maxToolCalls !== undefined) {
        const wouldUse = toolCallsUsed + request.toolCalls;
        if (wouldUse > budget.maxToolCalls) {
          violations.push('toolCalls');
          details['toolCalls'] = { wouldExceedBy: wouldUse - budget.maxToolCalls };
        }
      }

      // Check subcalls
      if (request.subcalls !== undefined && budget.maxSubcalls !== undefined) {
        const wouldUse = subcallsUsed + request.subcalls;
        if (wouldUse > budget.maxSubcalls) {
          violations.push('subcalls');
          details['subcalls'] = { wouldExceedBy: wouldUse - budget.maxSubcalls };
        }
      }

      const hasDetails = Object.keys(details).length > 0;
      if (hasDetails) {
        return {
          allowed: violations.length === 0,
          violations,
          details,
        };
      }
      return {
        allowed: violations.length === 0,
        violations,
      };
    },

    getChildEpisodes(): string[] {
      return [...childEpisodes];
    },

    getToolCallCounts(): Record<string, number> {
      return { ...toolCallCounts };
    },
  });

  return tracker;
}
