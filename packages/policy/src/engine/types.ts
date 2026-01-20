/**
 * Policy Engine Type Definitions
 *
 * Core types for the policy evaluation engine that orchestrates
 * kill switches, rate limits, rules, and approval gates.
 */

import { z } from 'zod';
import type {
  Policy,
  PolicyRule,
  PolicyEffect,
  PolicyCondition,
} from '../schema/types.js';
import type { KillSwitchCheckResult } from '../kill-switch/types.js';
import type { RateLimitCheckResult } from '../rate-limiting/types.js';
import type { ApprovalStatus } from '../approval-gates/types.js';

// ============================================================================
// Evaluation Context
// ============================================================================

/**
 * Schema for evaluation context - the input to policy evaluation.
 */
export const EvaluationContextSchema = z.object({
  /** Client ID for tenant isolation */
  clientId: z.string(),

  /** Agent ID if agent-scoped evaluation */
  agentId: z.string().optional(),

  /** Action being performed (e.g., 'post:publish', 'engage:reply') */
  action: z.string(),

  /** Resource being acted upon (e.g., 'social:meta', 'content:123') */
  resource: z.string(),

  /** Platform for platform-specific checks */
  platform: z.string().optional(),

  /** Timestamp for time-based conditions */
  timestamp: z.date().optional(),

  /** Additional context fields for condition evaluation */
  fields: z.record(z.unknown()).optional(),

  /** Episode ID for tracing */
  episodeId: z.string().optional(),

  /** Request ID for tracing */
  requestId: z.string().optional(),
});

export type EvaluationContext = z.infer<typeof EvaluationContextSchema>;

// ============================================================================
// Decision Reasons
// ============================================================================

/**
 * Reason for a policy decision.
 */
export type DecisionReason =
  | 'kill_switch_tripped'
  | 'rate_limit_exceeded'
  | 'rule_denied'
  | 'rule_allowed'
  | 'approval_required'
  | 'approval_pending'
  | 'approval_denied'
  | 'default_effect'
  | 'no_matching_rules'
  | 'evaluation_error';

/**
 * Schema for decision reasons.
 */
export const DecisionReasonSchema = z.enum([
  'kill_switch_tripped',
  'rate_limit_exceeded',
  'rule_denied',
  'rule_allowed',
  'approval_required',
  'approval_pending',
  'approval_denied',
  'default_effect',
  'no_matching_rules',
  'evaluation_error',
]);

// ============================================================================
// Policy Decision
// ============================================================================

/**
 * Detailed policy decision result.
 */
export interface PolicyDecision {
  /** Whether the action is allowed */
  allowed: boolean;

  /** Primary effect (allow/deny) */
  effect: PolicyEffect;

  /** Reason for the decision */
  reason: DecisionReason;

  /** Human-readable explanation */
  message: string;

  /** The policy that made the decision (if applicable) */
  policyId: string | null;

  /** The rule that matched (if applicable) */
  ruleId: string | null;

  /** Rule name for debugging */
  ruleName: string | null;

  /** Kill switch result (if checked) */
  killSwitch: KillSwitchCheckResult | null;

  /** Rate limit result (if checked) */
  rateLimit: RateLimitCheckResult | null;

  /** Approval request ID (if approval required) */
  approvalRequestId: string | null;

  /** Approval status (if approval gate was involved) */
  approvalStatus: ApprovalStatus | null;

  /** Constraints to apply (if any) */
  constraints: {
    /** Rate limit constraint from matching rule */
    rateLimit?: {
      maxRequests: number;
      windowMs: number;
    };
    /** Budget constraint from matching rule */
    budget?: {
      maxTokens?: number;
      maxCost?: number;
    };
  } | null;

  /** Evaluation duration in milliseconds */
  evaluationDurationMs: number;

  /** Timestamp of the decision */
  decidedAt: Date;

  /** Trace context */
  trace: {
    requestId?: string;
    episodeId?: string;
  };
}

/**
 * Schema for policy decision (for serialization).
 */
export const PolicyDecisionSchema = z.object({
  allowed: z.boolean(),
  effect: z.enum(['allow', 'deny']),
  reason: DecisionReasonSchema,
  message: z.string(),
  policyId: z.string().nullable(),
  ruleId: z.string().nullable(),
  ruleName: z.string().nullable(),
  killSwitch: z.unknown().nullable(),
  rateLimit: z.unknown().nullable(),
  approvalRequestId: z.string().nullable(),
  approvalStatus: z.string().nullable(),
  constraints: z
    .object({
      rateLimit: z
        .object({
          maxRequests: z.number(),
          windowMs: z.number(),
        })
        .optional(),
      budget: z
        .object({
          maxTokens: z.number().optional(),
          maxCost: z.number().optional(),
        })
        .optional(),
    })
    .nullable(),
  evaluationDurationMs: z.number(),
  decidedAt: z.date(),
  trace: z.object({
    requestId: z.string().optional(),
    episodeId: z.string().optional(),
  }),
});

// ============================================================================
// Rule Match Result
// ============================================================================

/**
 * Result of matching a rule against context.
 */
export interface RuleMatchResult {
  /** Whether the rule matched */
  matched: boolean;

  /** The rule that was evaluated */
  rule: PolicyRule;

  /** Action pattern that matched (if any) */
  matchedAction: string | null;

  /** Resource pattern that matched (if any) */
  matchedResource: string | null;

  /** Condition evaluation results */
  conditionResults: ConditionResult[];

  /** Match duration in milliseconds */
  matchDurationMs: number;
}

/**
 * Result of evaluating a single condition.
 */
export interface ConditionResult {
  /** The condition that was evaluated */
  condition: PolicyCondition;

  /** Whether the condition passed */
  passed: boolean;

  /** Actual value from context */
  actualValue: unknown;

  /** Expected value from condition */
  expectedValue: unknown;

  /** Error if evaluation failed */
  error?: string;
}

// ============================================================================
// Policy Cache
// ============================================================================

/**
 * Cache entry for a policy.
 */
export interface PolicyCacheEntry {
  /** The cached policy */
  policy: Policy;

  /** When the entry was cached */
  cachedAt: Date;

  /** When the entry expires */
  expiresAt: Date;

  /** Cache hit count */
  hitCount: number;
}

/**
 * Cache configuration.
 */
export interface PolicyCacheConfig {
  /** Time-to-live in milliseconds */
  ttlMs: number;

  /** Maximum cache size */
  maxSize: number;

  /** Whether caching is enabled */
  enabled: boolean;
}

/**
 * Default cache configuration.
 */
export const DEFAULT_CACHE_CONFIG: PolicyCacheConfig = {
  ttlMs: 60_000, // 1 minute
  maxSize: 1000,
  enabled: true,
};

// ============================================================================
// Engine Configuration
// ============================================================================

/**
 * Policy engine configuration.
 */
export interface PolicyEngineConfig {
  /** Whether to fail closed (deny on error) - default true */
  failClosed: boolean;

  /** Default effect when no rules match */
  defaultEffect: PolicyEffect;

  /** Cache configuration */
  cache: PolicyCacheConfig;

  /** Whether to check kill switches */
  enableKillSwitch: boolean;

  /** Whether to check rate limits */
  enableRateLimit: boolean;

  /** Whether to check approval gates */
  enableApprovalGates: boolean;

  /** OpenTelemetry tracing enabled */
  enableTracing: boolean;

  /** Maximum evaluation time before timeout (ms) */
  evaluationTimeoutMs: number;
}

/**
 * Default engine configuration.
 */
export const DEFAULT_ENGINE_CONFIG: PolicyEngineConfig = {
  failClosed: true,
  defaultEffect: 'deny',
  cache: DEFAULT_CACHE_CONFIG,
  enableKillSwitch: true,
  enableRateLimit: true,
  enableApprovalGates: true,
  enableTracing: true,
  evaluationTimeoutMs: 5000,
};

// ============================================================================
// Policy Provider
// ============================================================================

/**
 * Interface for providing policies to the engine.
 */
export interface PolicyProvider {
  /** Get policies for a given context */
  getPoliciesForContext(context: EvaluationContext): Promise<Policy[]>;

  /** Get a policy by ID */
  getPolicyById(id: string): Promise<Policy | null>;

  /** Invalidate cached policies for a client */
  invalidateCache?(clientId: string): void;
}

// ============================================================================
// Policy Engine Interface
// ============================================================================

/**
 * Main policy engine interface.
 */
export interface PolicyEngine {
  /** Engine configuration */
  readonly config: PolicyEngineConfig;

  /**
   * Evaluate a policy decision for a given context.
   * This is the main entry point for policy checks.
   */
  evaluate(context: EvaluationContext): Promise<PolicyDecision>;

  /**
   * Check if an action is allowed without full evaluation.
   * Quick check that returns boolean only.
   */
  isAllowed(context: EvaluationContext): Promise<boolean>;

  /**
   * Batch evaluate multiple contexts.
   */
  evaluateBatch(contexts: EvaluationContext[]): Promise<PolicyDecision[]>;

  /**
   * Invalidate policy cache for a client.
   */
  invalidateCache(clientId: string): void;

  /**
   * Get engine metrics.
   */
  getMetrics(): PolicyEngineMetrics;
}

// ============================================================================
// Metrics
// ============================================================================

/**
 * Policy engine metrics for observability.
 */
export interface PolicyEngineMetrics {
  /** Total evaluations */
  totalEvaluations: number;

  /** Evaluations by result */
  evaluationsByResult: {
    allowed: number;
    denied: number;
    error: number;
  };

  /** Evaluations by reason */
  evaluationsByReason: Record<DecisionReason, number>;

  /** Average evaluation duration in milliseconds */
  avgEvaluationDurationMs: number;

  /** P95 evaluation duration */
  p95EvaluationDurationMs: number;

  /** P99 evaluation duration */
  p99EvaluationDurationMs: number;

  /** Cache statistics */
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };

  /** Kill switch trips */
  killSwitchTrips: number;

  /** Rate limit blocks */
  rateLimitBlocks: number;

  /** Approval gate triggers */
  approvalGateTriggers: number;
}

// ============================================================================
// Audit Event
// ============================================================================

/**
 * Audit event for policy decisions.
 */
export interface PolicyAuditEvent {
  /** Event type */
  type: 'policy_evaluation';

  /** Timestamp */
  timestamp: Date;

  /** Evaluation context */
  context: EvaluationContext;

  /** Decision result */
  decision: PolicyDecision;

  /** Matched rules (for debugging) */
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
    effect: PolicyEffect;
    matched: boolean;
  }>;
}
