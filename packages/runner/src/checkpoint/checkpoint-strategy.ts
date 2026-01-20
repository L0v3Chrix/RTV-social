/**
 * S1-D5: Checkpoint Strategy
 *
 * Determines when checkpoints should be created based on
 * configured conditions and event context.
 */

import type { CheckpointStrategyOptions, CheckpointCheckContext } from './types.js';

/**
 * Events that indicate phase completion.
 */
const PHASE_COMPLETE_EVENTS = [
  'PERCEIVE_COMPLETE',
  'PLAN_COMPLETE',
  'ACT_COMPLETE',
  'OBSERVE_COMPLETE',
] as const;

/**
 * Mapping from completion events to phase names.
 */
const EVENT_TO_PHASE: Record<string, string> = {
  PERCEIVE_COMPLETE: 'perceive',
  PLAN_COMPLETE: 'plan',
  ACT_COMPLETE: 'act',
  OBSERVE_COMPLETE: 'observe',
};

/**
 * Checkpoint strategy that determines when to create checkpoints.
 *
 * Supports multiple triggering conditions:
 * - On phase completion
 * - On loop completion
 * - On budget warning
 * - At time intervals
 * - Filtered by specific phases
 */
export class CheckpointStrategy {
  private options: Required<
    Pick<
      CheckpointStrategyOptions,
      'onPhaseComplete' | 'onLoopComplete' | 'onBudgetWarning'
    >
  > &
    Pick<CheckpointStrategyOptions, 'intervalMs' | 'phases'>;

  constructor(options: CheckpointStrategyOptions = {}) {
    // Build options object, only adding optional properties if they have values
    const opts: typeof this.options = {
      onPhaseComplete: options.onPhaseComplete ?? false,
      onLoopComplete: options.onLoopComplete ?? false,
      onBudgetWarning: options.onBudgetWarning ?? false,
    };

    if (options.intervalMs !== undefined) {
      opts.intervalMs = options.intervalMs;
    }
    if (options.phases !== undefined) {
      opts.phases = options.phases;
    }

    this.options = opts;
  }

  /**
   * Determine if a checkpoint should be created.
   */
  shouldCheckpoint(context: CheckpointCheckContext): boolean {
    // Check phase completion
    if (this.options.onPhaseComplete && this.isPhaseCompleteEvent(context.event)) {
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
    if (this.options.intervalMs !== undefined && context.lastCheckpointAt !== undefined) {
      const elapsed = Date.now() - context.lastCheckpointAt;
      if (elapsed >= this.options.intervalMs) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if an event is a phase completion event.
   */
  private isPhaseCompleteEvent(event: string): boolean {
    return (PHASE_COMPLETE_EVENTS as readonly string[]).includes(event);
  }

  /**
   * Extract the phase name from a completion event.
   */
  private extractPhaseFromEvent(event: string): string {
    return EVENT_TO_PHASE[event] ?? 'unknown';
  }
}

// Re-export types for convenience
export type { CheckpointStrategyOptions, CheckpointCheckContext };
