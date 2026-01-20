/**
 * @rtv/policy - Policy Definition Schema Types
 *
 * Type definitions for the policy engine that governs agent behavior.
 */

// ============================================================================
// Operators
// ============================================================================

/**
 * Comparison operators for field conditions.
 */
export type ComparisonOperator =
  | 'equals'
  | 'not_equals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches'
  | 'between';

/**
 * Logical operators for combining conditions.
 */
export type CompoundOperator = 'and' | 'or' | 'not';

// ============================================================================
// Condition Types
// ============================================================================

/**
 * Condition that evaluates a field value against a comparison operator.
 */
export interface FieldCondition {
  type: 'field';
  field: string;
  operator: ComparisonOperator;
  value: string | number | boolean | string[] | Record<string, unknown>;
}

/**
 * Time value for time-based conditions.
 */
export interface TimeRangeValue {
  start: string;
  end: string;
  timezone?: string | undefined;
}

/**
 * Condition that evaluates time-based rules.
 */
export interface TimeCondition {
  type: 'time';
  field: string;
  operator: 'between' | 'after' | 'before' | 'day_of_week';
  value: TimeRangeValue | string | number[];
}

/**
 * Condition that combines multiple conditions with a logical operator.
 */
export interface CompoundCondition {
  type: 'compound';
  operator: CompoundOperator;
  conditions: PolicyCondition[];
}

/**
 * Union type of all condition types.
 */
export type PolicyCondition = FieldCondition | TimeCondition | CompoundCondition;

// ============================================================================
// Policy Effects & Status
// ============================================================================

/**
 * The effect of a policy rule when matched.
 */
export type PolicyEffect = 'allow' | 'deny';

/**
 * Lifecycle status of a policy.
 */
export type PolicyStatus = 'draft' | 'active' | 'deprecated' | 'archived';

/**
 * Scope at which a policy applies.
 */
export type PolicyScope = 'global' | 'client' | 'agent';

// ============================================================================
// Constraints
// ============================================================================

/**
 * Rate limiting constraint configuration.
 */
export interface RateLimitConstraint {
  maxRequests: number;
  windowMs: number;
}

/**
 * Approval requirement constraint configuration.
 */
export interface ApprovalConstraint {
  approverRole: string;
  timeoutMs: number;
}

/**
 * Budget constraint configuration.
 */
export interface BudgetConstraint {
  maxTokens?: number | undefined;
  maxCost?: number | undefined;
}

/**
 * Constraints that can be applied to policy rules.
 */
export interface PolicyConstraints {
  rateLimit?: RateLimitConstraint | undefined;
  requireApproval?: ApprovalConstraint | undefined;
  budget?: BudgetConstraint | undefined;
}

// ============================================================================
// Policy Rule
// ============================================================================

/**
 * A single rule within a policy that defines behavior for specific actions.
 */
export interface PolicyRule {
  /** Unique identifier for the rule (auto-generated if not provided) */
  id?: string | undefined;
  /** Human-readable name for the rule */
  name: string;
  /** Optional description of what this rule does */
  description?: string | undefined;
  /** The effect when this rule matches (allow/deny) */
  effect: PolicyEffect;
  /** Action patterns this rule applies to (supports wildcards) */
  actions: string[];
  /** Resource patterns this rule applies to (supports wildcards) */
  resources: string[];
  /** Conditions that must be true for this rule to match */
  conditions: PolicyCondition[];
  /** Optional constraints to apply when rule matches */
  constraints?: PolicyConstraints | undefined;
  /** Priority for rule ordering (higher = evaluated first) */
  priority: number;
  /** Whether this rule is currently enabled */
  enabled?: boolean | undefined;
}

// ============================================================================
// Policy
// ============================================================================

/**
 * A complete policy definition containing rules that govern agent behavior.
 */
export interface Policy {
  /** Unique identifier for the policy */
  id: string;
  /** Human-readable name for the policy */
  name: string;
  /** Optional description of what this policy does */
  description?: string | undefined;
  /** Version number for the policy (incremented on updates) */
  version: number;
  /** Lifecycle status of the policy */
  status: PolicyStatus;
  /** Scope at which this policy applies */
  scope: PolicyScope;
  /** Client ID if this is a client-scoped policy */
  clientId?: string | undefined;
  /** Agent ID if this is an agent-scoped policy */
  agentId?: string | undefined;
  /** Rules that make up this policy */
  rules: PolicyRule[];
  /** Default effect when no rules match */
  defaultEffect: PolicyEffect;
  /** When the policy was created */
  createdAt: Date;
  /** When the policy was last updated */
  updatedAt: Date;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Error detected during policy validation.
 */
export interface PolicyValidationError {
  /** JSONPath-style path to the error location */
  path: string;
  /** Human-readable error message */
  message: string;
  /** Machine-readable error code */
  code: string;
}

/**
 * Warning detected during policy validation.
 */
export interface PolicyValidationWarning {
  /** JSONPath-style path to the warning location */
  path: string;
  /** Human-readable warning message */
  message: string;
  /** Machine-readable warning code */
  code: string;
}

/**
 * Result of validating a policy.
 */
export interface PolicyValidationResult {
  /** Whether the policy is valid (no errors) */
  valid: boolean;
  /** Schema and semantic errors */
  errors: PolicyValidationError[];
  /** Non-blocking warnings (conflicts, unreachable rules, etc.) */
  warnings: PolicyValidationWarning[];
}

// ============================================================================
// Input Types for Creating Policies
// ============================================================================

/**
 * Input for creating a new policy rule (some fields optional).
 */
export interface PolicyRuleInput {
  id?: string | undefined;
  name: string;
  description?: string | undefined;
  effect: PolicyEffect;
  actions: string[];
  resources: string[];
  conditions?: PolicyCondition[] | undefined;
  constraints?: PolicyConstraints | undefined;
  priority?: number | undefined;
  enabled?: boolean | undefined;
}

/**
 * Input for creating a new policy (some fields optional with defaults).
 */
export interface PolicyInput {
  id?: string | undefined;
  name: string;
  description?: string | undefined;
  version?: number | undefined;
  status?: PolicyStatus | undefined;
  scope?: PolicyScope | undefined;
  clientId?: string | undefined;
  agentId?: string | undefined;
  rules?: PolicyRuleInput[] | undefined;
  defaultEffect?: PolicyEffect | undefined;
}
