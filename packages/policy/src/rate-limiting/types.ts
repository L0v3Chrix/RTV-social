/**
 * Rate Limiting Type Definitions
 *
 * Per-platform cadence enforcement for social media operations.
 */

import { z } from 'zod';

// =====================
// Rate Limit Strategy
// =====================

export const RateLimitStrategySchema = z.enum([
  'sliding_window',
  'fixed_window',
  'token_bucket',
]);
export type RateLimitStrategy = z.infer<typeof RateLimitStrategySchema>;

// =====================
// Rate Limit Scope
// =====================

export const RateLimitScopeSchema = z.enum(['global', 'client', 'platform']);
export type RateLimitScope = z.infer<typeof RateLimitScopeSchema>;

// =====================
// Platform Type
// =====================

export const PlatformSchema = z.enum([
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'x',
  'skool',
]);
export type Platform = z.infer<typeof PlatformSchema>;

// =====================
// Action Type
// =====================

export const RateLimitedActionSchema = z.enum([
  'publish',
  'engage',
  'api_call',
  'upload',
  'schedule',
]);
export type RateLimitedAction = z.infer<typeof RateLimitedActionSchema>;

// =====================
// Rate Limit Configuration
// =====================

export const RateLimitConfigSchema = z.object({
  /** Maximum requests allowed in the window */
  maxRequests: z.number().int().positive(),

  /** Window size in milliseconds */
  windowMs: z.number().int().positive(),

  /** Rate limiting strategy */
  strategy: RateLimitStrategySchema.default('sliding_window'),

  /** Burst allowance (for token bucket) */
  burstAllowance: z.number().int().nonnegative().optional(),
});

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

// =====================
// Rate Limit Policy
// =====================

export const RateLimitPolicySchema = z.object({
  /** Unique ID */
  id: z.string(),

  /** Human-readable name */
  name: z.string(),

  /** Policy scope */
  scope: RateLimitScopeSchema,

  /** Client ID (required for client scope) */
  clientId: z.string().nullable(),

  /** Platform (optional - if null, applies to all platforms) */
  platform: PlatformSchema.nullable(),

  /** Action type (optional - if null, applies to all actions) */
  action: RateLimitedActionSchema.nullable(),

  /** Rate limit configuration */
  config: RateLimitConfigSchema,

  /** Whether this policy is active */
  isActive: z.boolean(),

  /** Priority (lower = higher priority) */
  priority: z.number().int().default(0),

  /** Timestamps */
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RateLimitPolicy = z.infer<typeof RateLimitPolicySchema>;

// =====================
// Check Context
// =====================

export interface RateLimitCheckContext {
  /** Client ID */
  clientId: string;

  /** Platform */
  platform: Platform;

  /** Action being performed */
  action: RateLimitedAction;

  /** Number of tokens to consume (default: 1) */
  tokens?: number;
}

// =====================
// Check Result
// =====================

export interface RateLimitCheckResult {
  /** Whether the request is allowed */
  allowed: boolean;

  /** Matching policy (if any) */
  policy: {
    id: string;
    name: string;
    scope: RateLimitScope;
    config: RateLimitConfig;
  } | null;

  /** Current usage stats */
  usage: {
    current: number;
    limit: number;
    remaining: number;
    resetAt: number;
  };

  /** Retry after milliseconds (if not allowed) */
  retryAfterMs: number | null;

  /** Check duration */
  checkDurationMs: number;
}

// =====================
// Usage Record
// =====================

export interface UsageRecord {
  timestamp: number;
  tokens: number;
  action: RateLimitedAction;
}

// =====================
// Input Types
// =====================

export interface CreateRateLimitPolicyInput {
  name: string;
  scope: RateLimitScope;
  clientId?: string;
  platform?: Platform;
  action?: RateLimitedAction;
  config: RateLimitConfig;
  priority?: number;
  createdBy: string;
}

export interface UpdateRateLimitPolicyInput {
  id: string;
  name?: string;
  config?: Partial<RateLimitConfig>;
  isActive?: boolean;
  priority?: number;
  updatedBy: string;
}

export interface ListPoliciesOptions {
  scope?: RateLimitScope;
  clientId?: string;
  platform?: Platform;
  action?: RateLimitedAction;
  activeOnly?: boolean;
}

// =====================
// Service Interface
// =====================

export interface RateLimiterService {
  /** Check if an action is allowed under rate limits */
  check(context: RateLimitCheckContext): Promise<RateLimitCheckResult>;

  /** Record a consumed action (call after successful action) */
  consume(context: RateLimitCheckContext): Promise<void>;

  /** Get current usage for a context */
  getUsage(context: RateLimitCheckContext): Promise<RateLimitCheckResult['usage']>;

  /** Create a new rate limit policy */
  createPolicy(input: CreateRateLimitPolicyInput): Promise<RateLimitPolicy>;

  /** Update a rate limit policy */
  updatePolicy(input: UpdateRateLimitPolicyInput): Promise<RateLimitPolicy>;

  /** Delete a rate limit policy */
  deletePolicy(id: string): Promise<void>;

  /** List rate limit policies */
  listPolicies(options?: ListPoliciesOptions): Promise<RateLimitPolicy[]>;

  /** Get policy by ID */
  getPolicyById(id: string): Promise<RateLimitPolicy | null>;

  /** Reset usage for a specific context (admin only) */
  resetUsage(context: RateLimitCheckContext): Promise<void>;
}

// =====================
// Default Platform Limits
// =====================

/** Default rate limits per platform (per minute) */
export const DEFAULT_PLATFORM_LIMITS: Record<Platform, number> = {
  facebook: 30,
  instagram: 30,
  tiktok: 20,
  youtube: 10,
  linkedin: 20,
  x: 50,
  skool: 10,
};
