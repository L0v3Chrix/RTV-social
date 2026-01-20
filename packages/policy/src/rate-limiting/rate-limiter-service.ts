/**
 * Rate Limiter Service Implementation
 *
 * In-memory implementation for rate limiting.
 * Production would use Redis for distributed rate limiting.
 */

import { nanoid } from 'nanoid';
import {
  type RateLimiterService,
  type RateLimitPolicy,
  type RateLimitCheckContext,
  type RateLimitCheckResult,
  type CreateRateLimitPolicyInput,
  type UpdateRateLimitPolicyInput,
  type ListPoliciesOptions,
  type UsageRecord,
  type Platform,
  type RateLimitedAction,
  DEFAULT_PLATFORM_LIMITS,
} from './types.js';

export interface RateLimiterServiceConfig {
  /** Callback for audit events */
  onAudit?: (event: {
    type: string;
    actor: string;
    target: string;
    metadata: Record<string, unknown>;
  }) => void;

  /** Use default platform policies */
  useDefaultPolicies?: boolean;
}

/**
 * Generate a usage key for tracking
 */
function getUsageKey(
  clientId: string,
  platform: Platform,
  action: RateLimitedAction
): string {
  return `${clientId}:${platform}:${action}`;
}

/**
 * Create a new Rate Limiter Service
 */
export function createRateLimiterService(
  config: RateLimiterServiceConfig = {}
): RateLimiterService {
  const policies = new Map<string, RateLimitPolicy>();

  // Usage tracking: Map<usageKey, UsageRecord[]>
  const usageRecords = new Map<string, UsageRecord[]>();

  function emitAudit(
    type: string,
    actor: string,
    target: string,
    metadata: Record<string, unknown>
  ): void {
    config.onAudit?.({ type, actor, target, metadata });
  }

  /**
   * Initialize default policies for all platforms
   */
  if (config.useDefaultPolicies) {
    const platforms: Platform[] = [
      'facebook',
      'instagram',
      'tiktok',
      'youtube',
      'linkedin',
      'x',
      'skool',
    ];

    for (const platform of platforms) {
      const id = `rl_default_${platform}`;
      const now = new Date();
      policies.set(id, {
        id,
        name: `Default ${platform} Rate Limit`,
        scope: 'global',
        clientId: null,
        platform,
        action: null,
        config: {
          maxRequests: DEFAULT_PLATFORM_LIMITS[platform],
          windowMs: 60_000, // 1 minute
          strategy: 'sliding_window',
        },
        isActive: true,
        priority: 1000, // Low priority (default)
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /**
   * Clean expired records from usage array
   */
  function cleanExpired(records: UsageRecord[], windowMs: number, now: number): UsageRecord[] {
    const windowStart = now - windowMs;
    return records.filter((r) => r.timestamp >= windowStart);
  }

  /**
   * Find matching policy for context
   */
  function findMatchingPolicy(context: RateLimitCheckContext): RateLimitPolicy | null {
    const matching: RateLimitPolicy[] = [];

    for (const policy of policies.values()) {
      if (!policy.isActive) continue;

      // Check scope/clientId match
      if (policy.scope === 'client' && policy.clientId !== context.clientId) {
        continue;
      }

      // Check platform match
      if (policy.platform !== null && policy.platform !== context.platform) {
        continue;
      }

      // Check action match
      if (policy.action !== null && policy.action !== context.action) {
        continue;
      }

      matching.push(policy);
    }

    if (matching.length === 0) {
      return null;
    }

    // Sort by priority (lower = higher priority) and specificity
    matching.sort((a, b) => {
      // First by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by specificity (more specific = higher priority)
      const specificityA =
        (a.clientId ? 4 : 0) + (a.platform ? 2 : 0) + (a.action ? 1 : 0);
      const specificityB =
        (b.clientId ? 4 : 0) + (b.platform ? 2 : 0) + (b.action ? 1 : 0);
      return specificityB - specificityA;
    });

    return matching[0] ?? null;
  }

  /**
   * Calculate current usage within window
   */
  function calculateUsage(
    usageKey: string,
    windowMs: number,
    now: number
  ): { current: number; records: UsageRecord[] } {
    const records = usageRecords.get(usageKey) || [];
    const cleaned = cleanExpired(records, windowMs, now);

    // Update stored records
    usageRecords.set(usageKey, cleaned);

    const current = cleaned.reduce((sum, r) => sum + r.tokens, 0);
    return { current, records: cleaned };
  }

  const service: RateLimiterService = {
    async check(context: RateLimitCheckContext): Promise<RateLimitCheckResult> {
      const startTime = Date.now();
      const tokens = context.tokens ?? 1;
      const usageKey = getUsageKey(context.clientId, context.platform, context.action);

      // Find matching policy
      const policy = findMatchingPolicy(context);

      // If no policy, allow by default
      if (!policy) {
        return {
          allowed: true,
          policy: null,
          usage: {
            current: 0,
            limit: Infinity,
            remaining: Infinity,
            resetAt: Date.now(),
          },
          retryAfterMs: null,
          checkDurationMs: Date.now() - startTime,
        };
      }

      const now = Date.now();
      const { current, records } = calculateUsage(usageKey, policy.config.windowMs, now);
      const limit = policy.config.maxRequests;
      const remaining = Math.max(0, limit - current);

      // Calculate reset time (when oldest record expires)
      let resetAt = now + policy.config.windowMs;
      if (records.length > 0) {
        const oldestTimestamp = Math.min(...records.map((r) => r.timestamp));
        resetAt = oldestTimestamp + policy.config.windowMs;
      }

      // Check if allowed
      const allowed = current + tokens <= limit;
      let retryAfterMs: number | null = null;

      if (!allowed) {
        // Calculate when enough capacity will be available
        // Find how many tokens need to expire
        const tokensNeeded = current + tokens - limit;
        let tokensFreed = 0;
        const sortedRecords = [...records].sort((a, b) => a.timestamp - b.timestamp);

        for (const record of sortedRecords) {
          tokensFreed += record.tokens;
          if (tokensFreed >= tokensNeeded) {
            retryAfterMs = record.timestamp + policy.config.windowMs - now;
            break;
          }
        }

        // Ensure retryAfterMs is at least 1ms
        if (retryAfterMs !== null && retryAfterMs < 1) {
          retryAfterMs = 1;
        }
      }

      return {
        allowed,
        policy: {
          id: policy.id,
          name: policy.name,
          scope: policy.scope,
          config: policy.config,
        },
        usage: {
          current,
          limit,
          remaining,
          resetAt,
        },
        retryAfterMs,
        checkDurationMs: Date.now() - startTime,
      };
    },

    async consume(context: RateLimitCheckContext): Promise<void> {
      const tokens = context.tokens ?? 1;
      const usageKey = getUsageKey(context.clientId, context.platform, context.action);
      const now = Date.now();

      // Get or create records array
      let records = usageRecords.get(usageKey);
      if (!records) {
        records = [];
        usageRecords.set(usageKey, records);
      }

      // Add new record
      records.push({
        timestamp: now,
        tokens,
        action: context.action,
      });
    },

    async getUsage(
      context: RateLimitCheckContext
    ): Promise<RateLimitCheckResult['usage']> {
      const usageKey = getUsageKey(context.clientId, context.platform, context.action);
      const policy = findMatchingPolicy(context);

      if (!policy) {
        return {
          current: 0,
          limit: Infinity,
          remaining: Infinity,
          resetAt: Date.now(),
        };
      }

      const now = Date.now();
      const { current, records } = calculateUsage(usageKey, policy.config.windowMs, now);
      const limit = policy.config.maxRequests;
      const remaining = Math.max(0, limit - current);

      let resetAt = now + policy.config.windowMs;
      if (records.length > 0) {
        const oldestTimestamp = Math.min(...records.map((r) => r.timestamp));
        resetAt = oldestTimestamp + policy.config.windowMs;
      }

      return {
        current,
        limit,
        remaining,
        resetAt,
      };
    },

    async createPolicy(input: CreateRateLimitPolicyInput): Promise<RateLimitPolicy> {
      // Validate scope/clientId combination
      if (input.scope === 'client' && !input.clientId) {
        throw new Error('Client scope requires clientId');
      }
      if (input.scope === 'global' && input.clientId) {
        throw new Error('Global scope cannot have clientId');
      }

      const now = new Date();
      const id = `rl_${nanoid()}`;

      const policy: RateLimitPolicy = {
        id,
        name: input.name,
        scope: input.scope,
        clientId: input.clientId ?? null,
        platform: input.platform ?? null,
        action: input.action ?? null,
        config: {
          ...input.config,
          strategy: input.config.strategy ?? 'sliding_window',
        },
        isActive: true,
        priority: input.priority ?? 0,
        createdAt: now,
        updatedAt: now,
      };

      policies.set(id, policy);

      emitAudit('RATE_LIMIT_POLICY_CREATED', input.createdBy, id, {
        name: input.name,
        scope: input.scope,
        clientId: input.clientId,
        platform: input.platform,
        action: input.action,
        config: input.config,
      });

      return policy;
    },

    async updatePolicy(input: UpdateRateLimitPolicyInput): Promise<RateLimitPolicy> {
      const policy = policies.get(input.id);
      if (!policy) {
        throw new Error(`Rate limit policy not found: ${input.id}`);
      }

      const now = new Date();

      if (input.name !== undefined) {
        policy.name = input.name;
      }
      if (input.config !== undefined) {
        policy.config = {
          ...policy.config,
          ...input.config,
        };
      }
      if (input.isActive !== undefined) {
        policy.isActive = input.isActive;
      }
      if (input.priority !== undefined) {
        policy.priority = input.priority;
      }
      policy.updatedAt = now;

      emitAudit('RATE_LIMIT_POLICY_UPDATED', input.updatedBy, input.id, {
        changes: {
          name: input.name,
          config: input.config,
          isActive: input.isActive,
          priority: input.priority,
        },
      });

      return policy;
    },

    async deletePolicy(id: string): Promise<void> {
      const policy = policies.get(id);
      if (!policy) {
        throw new Error(`Rate limit policy not found: ${id}`);
      }

      policies.delete(id);

      emitAudit('RATE_LIMIT_POLICY_DELETED', 'system', id, {
        name: policy.name,
        scope: policy.scope,
      });
    },

    async listPolicies(options?: ListPoliciesOptions): Promise<RateLimitPolicy[]> {
      const results: RateLimitPolicy[] = [];

      for (const policy of policies.values()) {
        if (options?.activeOnly && !policy.isActive) continue;
        if (options?.scope && policy.scope !== options.scope) continue;
        if (options?.platform && policy.platform !== options.platform) continue;
        if (options?.action && policy.action !== options.action) continue;

        // For clientId, match if null (global) or matches
        if (options?.clientId) {
          if (policy.clientId !== null && policy.clientId !== options.clientId) {
            continue;
          }
        }

        results.push(policy);
      }

      // Sort by priority
      results.sort((a, b) => a.priority - b.priority);

      return results;
    },

    async getPolicyById(id: string): Promise<RateLimitPolicy | null> {
      return policies.get(id) ?? null;
    },

    async resetUsage(context: RateLimitCheckContext): Promise<void> {
      const usageKey = getUsageKey(context.clientId, context.platform, context.action);
      usageRecords.delete(usageKey);

      emitAudit('RATE_LIMIT_USAGE_RESET', 'system', usageKey, {
        clientId: context.clientId,
        platform: context.platform,
        action: context.action,
      });
    },
  };

  return service;
}

// Re-export types for convenience
export type { RateLimiterService } from './types.js';
