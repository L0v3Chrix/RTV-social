/**
 * @rtv/policy - Policy Schema Definitions
 *
 * Zod schemas for validating policy definitions.
 */

import { z } from 'zod';

// ============================================================================
// Operator Schemas
// ============================================================================

/**
 * Schema for comparison operators used in field conditions.
 */
export const ComparisonOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'not_in',
  'contains',
  'starts_with',
  'ends_with',
  'matches',
  'between',
]);

/**
 * Schema for compound operators used to combine conditions.
 */
export const CompoundOperatorSchema = z.enum(['and', 'or', 'not']);

// ============================================================================
// Condition Schemas
// ============================================================================

/**
 * Schema for field-based conditions.
 */
export const FieldConditionSchema = z.object({
  type: z.literal('field'),
  field: z.string().min(1, 'Field name is required'),
  operator: ComparisonOperatorSchema,
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.record(z.unknown()),
  ]),
});

/**
 * Schema for time range values.
 */
export const TimeRangeValueSchema = z.object({
  start: z.string(),
  end: z.string(),
  timezone: z.string().optional(),
});

/**
 * Schema for time-based conditions.
 */
export const TimeConditionSchema = z.object({
  type: z.literal('time'),
  field: z.string().min(1, 'Field name is required'),
  operator: z.enum(['between', 'after', 'before', 'day_of_week']),
  value: z.union([
    TimeRangeValueSchema,
    z.string(),
    z.array(z.number().int().min(0).max(6)),
  ]),
});

/**
 * Schema for compound conditions (recursive).
 * Uses z.lazy() to handle recursive condition nesting.
 */
export const CompoundConditionSchema: z.ZodType<{
  type: 'compound';
  operator: 'and' | 'or' | 'not';
  conditions: Array<
    | z.infer<typeof FieldConditionSchema>
    | z.infer<typeof TimeConditionSchema>
    | { type: 'compound'; operator: 'and' | 'or' | 'not'; conditions: unknown[] }
  >;
}> = z.lazy(() =>
  z.object({
    type: z.literal('compound'),
    operator: CompoundOperatorSchema,
    conditions: z.array(PolicyConditionSchema).min(1, 'At least one condition is required'),
  })
);

/**
 * Union schema for all condition types.
 */
export const PolicyConditionSchema: z.ZodType<
  | z.infer<typeof FieldConditionSchema>
  | z.infer<typeof TimeConditionSchema>
  | z.infer<typeof CompoundConditionSchema>
> = z.lazy(() =>
  z.discriminatedUnion('type', [
    FieldConditionSchema,
    TimeConditionSchema,
    z.object({
      type: z.literal('compound'),
      operator: CompoundOperatorSchema,
      conditions: z.array(
        z.lazy(() => PolicyConditionSchema)
      ).min(1, 'At least one condition is required'),
    }),
  ])
);

// ============================================================================
// Effect & Status Schemas
// ============================================================================

/**
 * Schema for policy effects.
 */
export const PolicyEffectSchema = z.enum(['allow', 'deny']);

/**
 * Schema for policy status.
 */
export const PolicyStatusSchema = z.enum(['draft', 'active', 'deprecated', 'archived']);

/**
 * Schema for policy scope.
 */
export const PolicyScopeSchema = z.enum(['global', 'client', 'agent']);

// ============================================================================
// Constraint Schemas
// ============================================================================

/**
 * Schema for rate limit constraints.
 */
export const RateLimitConstraintSchema = z.object({
  maxRequests: z.number().int().positive('Max requests must be positive'),
  windowMs: z.number().int().positive('Window must be positive'),
});

/**
 * Schema for approval constraints.
 */
export const ApprovalConstraintSchema = z.object({
  approverRole: z.string().min(1, 'Approver role is required'),
  timeoutMs: z.number().int().positive('Timeout must be positive'),
});

/**
 * Schema for budget constraints.
 */
export const BudgetConstraintSchema = z.object({
  maxTokens: z.number().int().positive('Max tokens must be positive').optional(),
  maxCost: z.number().positive('Max cost must be positive').optional(),
}).refine(
  (data) => data.maxTokens !== undefined || data.maxCost !== undefined,
  { message: 'At least one of maxTokens or maxCost is required' }
);

/**
 * Schema for policy constraints.
 */
export const PolicyConstraintsSchema = z.object({
  rateLimit: RateLimitConstraintSchema.optional(),
  requireApproval: ApprovalConstraintSchema.optional(),
  budget: z.object({
    maxTokens: z.number().int().positive().optional(),
    maxCost: z.number().positive().optional(),
  }).optional(),
});

// ============================================================================
// Rule Schema
// ============================================================================

/**
 * Schema for a single policy rule.
 */
export const PolicyRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().optional(),
  effect: PolicyEffectSchema,
  actions: z.array(z.string().min(1)).min(1, 'At least one action is required'),
  resources: z.array(z.string().min(1)).min(1, 'At least one resource is required'),
  conditions: z.array(PolicyConditionSchema).default([]),
  constraints: PolicyConstraintsSchema.optional(),
  priority: z.number().int().default(0),
  enabled: z.boolean().default(true),
});

/**
 * Schema for rule input (for creating rules).
 */
export const PolicyRuleInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().optional(),
  effect: PolicyEffectSchema,
  actions: z.array(z.string().min(1)).min(1, 'At least one action is required'),
  resources: z.array(z.string().min(1)).min(1, 'At least one resource is required'),
  conditions: z.array(PolicyConditionSchema).optional().default([]),
  constraints: PolicyConstraintsSchema.optional(),
  priority: z.number().int().optional().default(0),
  enabled: z.boolean().optional().default(true),
});

// ============================================================================
// Policy Schema
// ============================================================================

/**
 * Schema for a complete policy.
 */
export const PolicySchema = z.object({
  id: z.string().min(1, 'Policy ID is required'),
  name: z.string().min(1, 'Policy name is required'),
  description: z.string().optional(),
  version: z.number().int().positive('Version must be positive'),
  status: PolicyStatusSchema,
  scope: PolicyScopeSchema,
  clientId: z.string().optional(),
  agentId: z.string().optional(),
  rules: z.array(PolicyRuleSchema),
  defaultEffect: PolicyEffectSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
}).refine(
  (data) => {
    // Client-scoped policies must have clientId
    if (data.scope === 'client' && !data.clientId) {
      return false;
    }
    // Agent-scoped policies must have agentId (and optionally clientId)
    if (data.scope === 'agent' && !data.agentId) {
      return false;
    }
    return true;
  },
  {
    message: 'Client-scoped policies require clientId; agent-scoped policies require agentId',
    path: ['scope'],
  }
);

/**
 * Schema for policy input (for creating policies).
 */
export const PolicyInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Policy name is required'),
  description: z.string().optional(),
  version: z.number().int().positive().optional(),
  status: PolicyStatusSchema.optional(),
  scope: PolicyScopeSchema.optional(),
  clientId: z.string().optional(),
  agentId: z.string().optional(),
  rules: z.array(PolicyRuleInputSchema).optional(),
  defaultEffect: PolicyEffectSchema.optional(),
});

// ============================================================================
// Re-export types
// ============================================================================

export * from './types.js';
export * from './helpers.js';
