/**
 * RTV Task Orchestrator - Public API
 */

// Export types from types.ts (primary type definitions)
export {
  type TaskStatus,
  type TestStatus,
  type Sprint,
  type Agent,
  type Complexity,
  type Task,
  type TaskGraph,
  type SprintStatus,
  type AgentAssignment,
  type OrchestratorState,
  type HistoryEntry,
  type DispatchResult,
  type ValidationResult,
  SPRINT_NAMES,
  AGENT_TRACKS,
} from './types.js';

// Export task registry (excluding conflicting types)
export {
  type TaskTrack,
  type TaskDefinition,
  TASK_DEFINITIONS,
} from './task-registry.js';

// Export orchestrator
export * from './orchestrator.js';
