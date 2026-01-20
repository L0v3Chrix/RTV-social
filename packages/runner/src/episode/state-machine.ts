/**
 * Episode State Machine
 *
 * Manages valid state transitions for episodes and tracks transition history.
 */

import type { EpisodeStatus } from './types.js';

/**
 * Valid state transitions map
 *
 * Defines which states can transition to which other states:
 * - created → running (start)
 * - running → suspended (pause) | completed (success) | failed (error)
 * - suspended → running (resume) | failed (abort)
 * - completed → (terminal, no transitions)
 * - failed → created (retry creates new episode)
 */
export const VALID_TRANSITIONS: Record<EpisodeStatus, EpisodeStatus[]> = {
  created: ['running'],
  running: ['suspended', 'completed', 'failed'],
  suspended: ['running', 'failed'],
  completed: [], // Terminal state - no further transitions
  failed: ['created'], // Retry creates new episode
};

/**
 * Check if a transition is valid
 */
export function isValidTransition(from: EpisodeStatus, to: EpisodeStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Transition history entry
 */
export interface TransitionHistoryEntry {
  from: EpisodeStatus;
  to: EpisodeStatus;
  timestamp: number;
  reason: string | undefined;
}

/**
 * Episode State Machine interface
 */
export interface EpisodeStateMachine {
  /** Current state */
  readonly currentState: EpisodeStatus;

  /** History of all transitions */
  readonly history: TransitionHistoryEntry[];

  /** Check if a transition to the given state is valid */
  canTransition(to: EpisodeStatus): boolean;

  /** Perform a state transition */
  transition(to: EpisodeStatus, reason?: string): void;

  /** Get list of valid next states */
  getValidTransitions(): EpisodeStatus[];
}

/**
 * Create a new episode state machine
 */
export function createEpisodeStateMachine(
  initialState: EpisodeStatus = 'created'
): EpisodeStateMachine {
  let currentState = initialState;
  const history: TransitionHistoryEntry[] = [];

  return {
    get currentState() {
      return currentState;
    },

    get history() {
      return [...history];
    },

    canTransition(to: EpisodeStatus): boolean {
      return isValidTransition(currentState, to);
    },

    transition(to: EpisodeStatus, reason?: string): void {
      if (!isValidTransition(currentState, to)) {
        throw new Error(`Invalid transition from ${currentState} to ${to}`);
      }

      history.push({
        from: currentState,
        to,
        timestamp: Date.now(),
        reason,
      });

      currentState = to;
    },

    getValidTransitions(): EpisodeStatus[] {
      return [...VALID_TRANSITIONS[currentState]];
    },
  };
}

/**
 * Check if state is terminal (no further transitions except retry)
 */
export function isTerminalState(status: EpisodeStatus): boolean {
  // Only completed is truly terminal - failed can retry
  return status === 'completed';
}

/**
 * Check if state is active (episode is consuming resources)
 */
export function isActiveState(status: EpisodeStatus): boolean {
  return status === 'running';
}

/**
 * Check if state allows work to be done
 */
export function isWorkableState(status: EpisodeStatus): boolean {
  return status === 'running';
}

/**
 * Check if episode can be resumed
 */
export function canResume(status: EpisodeStatus): boolean {
  return status === 'suspended';
}

/**
 * Check if episode can be retried
 */
export function canRetry(status: EpisodeStatus): boolean {
  return status === 'failed';
}
