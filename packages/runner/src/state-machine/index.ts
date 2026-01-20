/**
 * @rtv/runner State Machine Module
 *
 * Runner state machine for orchestrating episode execution
 * through the perceive-plan-act-observe loop.
 */

export {
  // Types
  type RunnerState,
  type RunnerEvent,
  type RunnerContext,
  type RunnerPhase,
  // Schemas
  RunnerStates,
  RunnerEventSchema,
  StartEventSchema,
  PerceiveEventSchema,
  PerceiveCompleteEventSchema,
  PlanEventSchema,
  PlanCompleteEventSchema,
  ActEventSchema,
  ActCompleteEventSchema,
  ObserveEventSchema,
  ObserveCompleteEventSchema,
  SuspendEventSchema,
  ResumeEventSchema,
  CompleteEventSchema,
  FailEventSchema,
  BudgetWarningEventSchema,
  BudgetExceededEventSchema,
  // Utilities
  ValidTransitions,
  HighRiskToolPrefixes,
  isHighRiskTool,
} from './types.js';

export {
  RunnerStateMachine,
  type RunnerStateMachineConfig,
  type RunnerPolicyEngine,
  type RunnerPolicyResult,
  type RLMSession,
} from './runner-state-machine.js';
