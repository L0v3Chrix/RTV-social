/**
 * Episode Lifecycle Module
 *
 * Provides bounded units of autonomous work with:
 * - State machine for lifecycle management
 * - Budget tracking and enforcement
 * - Suspension and resumption support
 * - Audit trail for all transitions
 */

// Types
export {
  // Status
  EpisodeStatusSchema,
  type EpisodeStatus,

  // Budget
  EpisodeBudgetSchema,
  type EpisodeBudget,
  BudgetStateSchema,
  type BudgetState,
  BudgetUpdateSchema,
  type BudgetUpdate,

  // Configuration
  EpisodeConfigSchema,
  type EpisodeConfig,

  // Error handling
  EpisodeErrorSchema,
  type EpisodeError,

  // Checkpoint
  EpisodeCheckpointSchema,
  type EpisodeCheckpoint,

  // Outputs
  EpisodeOutputsSchema,
  type EpisodeOutputs,

  // Full entity
  EpisodeSchema,
  type Episode,

  // List options
  EpisodeListOptionsSchema,
  type EpisodeListOptions,

  // Dependencies
  type EpisodeStore,
  type AuditEmitter,
  type SessionManager,
  type EpisodeServiceDeps,
} from './types.js';

// State Machine
export {
  createEpisodeStateMachine,
  isValidTransition,
  isTerminalState,
  isActiveState,
  isWorkableState,
  canResume,
  canRetry,
  VALID_TRANSITIONS,
  type EpisodeStateMachine,
  type TransitionHistoryEntry,
} from './state-machine.js';

// Service
export { createEpisodeService, type EpisodeService } from './episode-service.js';
