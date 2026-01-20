/**
 * Policy Engine Service
 *
 * Main orchestration service that evaluates policies by coordinating:
 * 1. Kill Switch checks (immediate deny if tripped)
 * 2. Rate Limit checks (deny if exceeded)
 * 3. Rule Evaluation (match rules by priority)
 * 4. Approval Gate checks (if rule requires approval)
 *
 * Follows fail-closed pattern: errors result in deny.
 */

import type { Policy, PolicyRule, PolicyConstraints } from '../schema/types.js';
import type { KillSwitchService, KillSwitchCheckResult } from '../kill-switch/types.js';
import type {
  RateLimiterService,
  RateLimitCheckResult,
  RateLimitCheckContext,
  Platform,
  RateLimitedAction,
} from '../rate-limiting/types.js';
import type {
  ApprovalGate,
  ApprovalStatus,
} from '../approval-gates/types.js';
import type {
  PolicyEngine,
  PolicyEngineConfig,
  PolicyProvider,
  PolicyDecision,
  EvaluationContext,
  PolicyEngineMetrics,
  DecisionReason,
  PolicyCacheEntry,
  PolicyAuditEvent,
} from './types.js';
import {
  DEFAULT_ENGINE_CONFIG,
  EvaluationContextSchema,
} from './types.js';
import {
  createRuleEvaluator,
} from './rule-evaluator.js';

// ============================================================================
// Policy Engine Implementation
// ============================================================================

/**
 * Creates a new policy engine instance.
 */
export function createPolicyEngine(
  options: CreatePolicyEngineOptions
): PolicyEngine {
  const config: PolicyEngineConfig = {
    ...DEFAULT_ENGINE_CONFIG,
    ...options.config,
  };

  const ruleEvaluator = createRuleEvaluator();
  const policyCache = new Map<string, PolicyCacheEntry>();
  const evaluationDurations: number[] = [];
  const maxDurationSamples = 1000;

  // Metrics tracking
  const metrics: InternalMetrics = {
    totalEvaluations: 0,
    allowed: 0,
    denied: 0,
    errors: 0,
    byReason: {} as Record<DecisionReason, number>,
    cacheHits: 0,
    cacheMisses: 0,
    killSwitchTrips: 0,
    rateLimitBlocks: 0,
    approvalGateTriggers: 0,
  };

  // Audit callback
  const onAudit = options.onAudit;

  // Services (optional - engine works without them)
  const { policyProvider, killSwitchService, rateLimiterService, approvalGate } =
    options;

  /**
   * Main evaluation function.
   */
  async function evaluate(context: EvaluationContext): Promise<PolicyDecision> {
    const startTime = performance.now();
    metrics.totalEvaluations++;

    try {
      // Validate context
      const parseResult = EvaluationContextSchema.safeParse(context);
      if (!parseResult.success) {
        return createErrorDecision(
          'Invalid evaluation context',
          startTime,
          context
        );
      }

      // Step 1: Check Kill Switches
      if (config.enableKillSwitch && killSwitchService) {
        const killSwitchResult = await checkKillSwitch(context);
        if (killSwitchResult.tripped) {
          metrics.killSwitchTrips++;
          return createDecision({
            allowed: false,
            effect: 'deny',
            reason: 'kill_switch_tripped',
            message: killSwitchResult.reason ?? 'Kill switch is tripped',
            killSwitch: killSwitchResult,
            startTime,
            context,
          });
        }
      }

      // Step 2: Check Rate Limits
      if (config.enableRateLimit && rateLimiterService) {
        const rateLimitResult = await checkRateLimit(context);
        if (!rateLimitResult.allowed) {
          metrics.rateLimitBlocks++;
          return createDecision({
            allowed: false,
            effect: 'deny',
            reason: 'rate_limit_exceeded',
            message: `Rate limit exceeded. Retry after ${rateLimitResult.retryAfterMs}ms`,
            rateLimit: rateLimitResult,
            startTime,
            context,
          });
        }
      }

      // Step 3: Get Policies
      const policies = await getPolicies(context);
      if (policies.length === 0) {
        return createDecision({
          allowed: config.defaultEffect === 'allow',
          effect: config.defaultEffect,
          reason: 'no_matching_rules',
          message: 'No policies found for context',
          startTime,
          context,
        });
      }

      // Step 4: Evaluate Rules
      const matchedRules: Array<{
        ruleId: string;
        ruleName: string;
        effect: 'allow' | 'deny';
        matched: boolean;
        policyId: string;
      }> = [];

      for (const policy of policies) {
        // Skip inactive policies
        if (policy.status !== 'active') continue;

        // Find matching rule in this policy
        const matchResult = ruleEvaluator.findMatchingRule(
          policy.rules,
          context
        );

        if (matchResult && matchResult.matched) {
          const rule = matchResult.rule;

          matchedRules.push({
            ruleId: rule.id ?? 'unknown',
            ruleName: rule.name,
            effect: rule.effect,
            matched: true,
            policyId: policy.id,
          });

          // Step 5: Check Approval Gates (if required)
          if (
            config.enableApprovalGates &&
            approvalGate &&
            rule.constraints?.requireApproval
          ) {
            const approvalResult = await checkApprovalGate(
              context,
              policy,
              rule
            );

            metrics.approvalGateTriggers++;

            if (approvalResult.status === 'pending') {
              return createDecision({
                allowed: false,
                effect: 'deny',
                reason: 'approval_pending',
                message: `Approval pending: ${approvalResult.requestId}`,
                policyId: policy.id,
                ruleId: rule.id ?? 'unknown',
                ruleName: rule.name,
                ...(approvalResult.requestId && { approvalRequestId: approvalResult.requestId }),
                approvalStatus: approvalResult.status as ApprovalStatus,
                startTime,
                context,
              });
            }

            if (approvalResult.status === 'denied') {
              return createDecision({
                allowed: false,
                effect: 'deny',
                reason: 'approval_denied',
                message: 'Approval was denied',
                policyId: policy.id,
                ruleId: rule.id ?? 'unknown',
                ruleName: rule.name,
                ...(approvalResult.requestId && { approvalRequestId: approvalResult.requestId }),
                approvalStatus: approvalResult.status as ApprovalStatus,
                startTime,
                context,
              });
            }
          }

          // Rule matched - return decision
          const decision = createDecision({
            allowed: rule.effect === 'allow',
            effect: rule.effect,
            reason: rule.effect === 'allow' ? 'rule_allowed' : 'rule_denied',
            message: `Matched rule: ${rule.name}`,
            policyId: policy.id,
            ruleId: rule.id ?? 'unknown',
            ruleName: rule.name,
            constraints: rule.constraints ? buildConstraintsFromPolicy(rule.constraints) : null,
            startTime,
            context,
          });

          // Emit audit event
          emitAuditEvent(context, decision, matchedRules);

          return decision;
        }
      }

      // No rules matched - use default effect
      const decision = createDecision({
        allowed: config.defaultEffect === 'allow',
        effect: config.defaultEffect,
        reason: 'default_effect',
        message: 'No matching rules, using default effect',
        startTime,
        context,
      });

      emitAuditEvent(context, decision, matchedRules);

      return decision;
    } catch (error: unknown) {
      metrics.errors++;

      // Fail closed
      if (config.failClosed) {
        return createErrorDecision(
          error instanceof Error ? error.message : 'Unknown error',
          startTime,
          context
        );
      }

      throw error;
    }
  }

  /**
   * Quick check if an action is allowed.
   */
  async function isAllowed(context: EvaluationContext): Promise<boolean> {
    const decision = await evaluate(context);
    return decision.allowed;
  }

  /**
   * Batch evaluate multiple contexts.
   */
  async function evaluateBatch(
    contexts: EvaluationContext[]
  ): Promise<PolicyDecision[]> {
    return Promise.all(contexts.map((ctx) => evaluate(ctx)));
  }

  /**
   * Invalidate cache for a client.
   */
  function invalidateCache(clientId: string): void {
    for (const [key, entry] of policyCache.entries()) {
      if (entry.policy.clientId === clientId) {
        policyCache.delete(key);
      }
    }

    // Also notify provider if it has cache invalidation
    policyProvider?.invalidateCache?.(clientId);
  }

  /**
   * Get engine metrics.
   */
  function getMetrics(): PolicyEngineMetrics {
    const durations = [...evaluationDurations].sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    return {
      totalEvaluations: metrics.totalEvaluations,
      evaluationsByResult: {
        allowed: metrics.allowed,
        denied: metrics.denied,
        error: metrics.errors,
      },
      evaluationsByReason: { ...metrics.byReason },
      avgEvaluationDurationMs:
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0,
      p95EvaluationDurationMs: durations[p95Index] ?? 0,
      p99EvaluationDurationMs: durations[p99Index] ?? 0,
      cache: {
        hits: metrics.cacheHits,
        misses: metrics.cacheMisses,
        hitRate:
          metrics.cacheHits + metrics.cacheMisses > 0
            ? metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)
            : 0,
        size: policyCache.size,
      },
      killSwitchTrips: metrics.killSwitchTrips,
      rateLimitBlocks: metrics.rateLimitBlocks,
      approvalGateTriggers: metrics.approvalGateTriggers,
    };
  }

  // ========================================================================
  // Helper Functions
  // ========================================================================

  /**
   * Checks kill switch for the context.
   */
  async function checkKillSwitch(
    context: EvaluationContext
  ): Promise<KillSwitchCheckResult> {
    if (!killSwitchService) {
      return { tripped: false, switch: null, reason: null, checkDurationMs: 0 };
    }

    return killSwitchService.isTripped({
      clientId: context.clientId,
      action: context.action,
      platform: context.platform,
    });
  }

  /**
   * Checks rate limit for the context.
   */
  async function checkRateLimit(
    context: EvaluationContext
  ): Promise<RateLimitCheckResult> {
    if (!rateLimiterService) {
      return {
        allowed: true,
        policy: null,
        usage: { current: 0, limit: 0, remaining: 0, resetAt: 0 },
        retryAfterMs: null,
        checkDurationMs: 0,
      };
    }

    // Map context to rate limit check context
    const rateLimitContext: RateLimitCheckContext = {
      clientId: context.clientId,
      platform: mapPlatform(context.platform),
      action: mapAction(context.action),
    };

    return rateLimiterService.check(rateLimitContext);
  }

  /**
   * Maps a platform string to the Platform enum.
   */
  function mapPlatform(platform?: string): Platform {
    const platformMap: Record<string, Platform> = {
      facebook: 'facebook',
      instagram: 'instagram',
      tiktok: 'tiktok',
      youtube: 'youtube',
      linkedin: 'linkedin',
      x: 'x',
      twitter: 'x',
      skool: 'skool',
    };

    return platformMap[platform?.toLowerCase() ?? ''] ?? 'facebook';
  }

  /**
   * Maps an action string to the RateLimitedAction enum.
   */
  function mapAction(action: string): RateLimitedAction {
    // Extract action type from action pattern (e.g., 'post:publish' -> 'publish')
    const actionPart = action.split(':')[1] ?? action;

    const actionMap: Record<string, RateLimitedAction> = {
      publish: 'publish',
      engage: 'engage',
      api_call: 'api_call',
      upload: 'upload',
      schedule: 'schedule',
    };

    return actionMap[actionPart.toLowerCase()] ?? 'api_call';
  }

  /**
   * Gets policies for the context.
   */
  async function getPolicies(context: EvaluationContext): Promise<Policy[]> {
    if (!policyProvider) {
      return [];
    }

    // Check cache first
    const cacheKey = `${context.clientId}:${context.agentId ?? ''}`;

    if (config.cache.enabled) {
      const cached = policyCache.get(cacheKey);
      if (cached && cached.expiresAt > new Date()) {
        metrics.cacheHits++;
        cached.hitCount++;
        // Return the single policy as an array for consistency
        return [cached.policy];
      }
      metrics.cacheMisses++;
    }

    // Fetch from provider
    const policies = await policyProvider.getPoliciesForContext(context);

    // Cache the policies
    if (config.cache.enabled && policies.length > 0) {
      const now = new Date();
      for (const policy of policies) {
        const key = `${policy.clientId ?? 'global'}:${policy.agentId ?? ''}`;
        policyCache.set(key, {
          policy,
          cachedAt: now,
          expiresAt: new Date(now.getTime() + config.cache.ttlMs),
          hitCount: 0,
        });
      }

      // Enforce max cache size
      while (policyCache.size > config.cache.maxSize) {
        // Remove oldest entry
        const firstKey = policyCache.keys().next().value;
        if (firstKey) {
          policyCache.delete(firstKey);
        }
      }
    }

    return policies;
  }

  /**
   * Checks approval gate for a rule.
   */
  async function checkApprovalGate(
    context: EvaluationContext,
    policy: Policy,
    rule: PolicyRule
  ): Promise<{ status: string; requestId: string | null }> {
    if (!approvalGate || !rule.constraints?.requireApproval) {
      return { status: 'not_required', requestId: null };
    }

    const approval = rule.constraints.requireApproval;

    // Check for existing pending request
    const pendingRequests = await approvalGate.listPendingRequests({
      clientId: context.clientId,
      actionType: context.action,
    });

    // Find matching pending request
    const existingRequest = pendingRequests.find(
      (req) =>
        req.clientId === context.clientId &&
        req.actionType === context.action &&
        req.resourceId === context.resource
    );

    if (existingRequest) {
      return {
        status: existingRequest.status,
        requestId: existingRequest.id,
      };
    }

    // Create new approval request
    const request = await approvalGate.createRequest({
      clientId: context.clientId,
      actionType: context.action,
      resourceId: context.resource,
      reason: `Rule "${rule.name}" requires approval`,
      requiredRole: approval.approverRole,
      timeoutMs: approval.timeoutMs,
      context: {
        policyId: policy.id,
        ruleId: rule.id,
        ruleName: rule.name,
        ...context.fields,
      },
      ...(context.episodeId !== undefined && { episodeId: context.episodeId }),
    });

    return {
      status: request.status,
      requestId: request.id,
    };
  }

  /**
   * Creates a policy decision.
   */
  function createDecision(params: CreateDecisionParams): PolicyDecision {
    const duration = performance.now() - params.startTime;

    // Track metrics
    if (params.allowed) {
      metrics.allowed++;
    } else {
      metrics.denied++;
    }

    metrics.byReason[params.reason] =
      (metrics.byReason[params.reason] ?? 0) + 1;

    // Track duration
    evaluationDurations.push(duration);
    if (evaluationDurations.length > maxDurationSamples) {
      evaluationDurations.shift();
    }

    return {
      allowed: params.allowed,
      effect: params.effect,
      reason: params.reason,
      message: params.message,
      policyId: params.policyId ?? null,
      ruleId: params.ruleId ?? null,
      ruleName: params.ruleName ?? null,
      killSwitch: params.killSwitch ?? null,
      rateLimit: params.rateLimit ?? null,
      approvalRequestId: params.approvalRequestId ?? null,
      approvalStatus: params.approvalStatus ?? null,
      constraints: params.constraints ?? null,
      evaluationDurationMs: duration,
      decidedAt: new Date(),
      trace: {
        ...(params.context.requestId !== undefined && { requestId: params.context.requestId }),
        ...(params.context.episodeId !== undefined && { episodeId: params.context.episodeId }),
      },
    };
  }

  /**
   * Creates an error decision (fail-closed).
   */
  function createErrorDecision(
    message: string,
    startTime: number,
    context: EvaluationContext
  ): PolicyDecision {
    return createDecision({
      allowed: false,
      effect: 'deny',
      reason: 'evaluation_error',
      message: `Evaluation error: ${message}`,
      startTime,
      context,
    });
  }

  /**
   * Builds constraints object for the decision from PolicyConstraints.
   */
  function buildConstraintsFromPolicy(constraints: PolicyConstraints): PolicyDecision['constraints'] {
    const result: {
      rateLimit?: { maxRequests: number; windowMs: number };
      budget?: { maxTokens?: number; maxCost?: number };
    } = {};

    if (constraints.rateLimit !== undefined) {
      result.rateLimit = {
        maxRequests: constraints.rateLimit.maxRequests,
        windowMs: constraints.rateLimit.windowMs,
      };
    }

    if (constraints.budget !== undefined) {
      const budget: { maxTokens?: number; maxCost?: number } = {};
      if (constraints.budget.maxTokens !== undefined) {
        budget.maxTokens = constraints.budget.maxTokens;
      }
      if (constraints.budget.maxCost !== undefined) {
        budget.maxCost = constraints.budget.maxCost;
      }
      if (Object.keys(budget).length > 0) {
        result.budget = budget;
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Emits an audit event.
   */
  function emitAuditEvent(
    context: EvaluationContext,
    decision: PolicyDecision,
    matchedRules: Array<{
      ruleId: string;
      ruleName: string;
      effect: 'allow' | 'deny';
      matched: boolean;
    }>
  ): void {
    if (!onAudit) return;

    const event: PolicyAuditEvent = {
      type: 'policy_evaluation',
      timestamp: new Date(),
      context,
      decision,
      matchedRules,
    };

    try {
      onAudit(event);
    } catch {
      // Ignore audit errors
    }
  }

  // Return the engine interface
  return {
    config,
    evaluate,
    isAllowed,
    evaluateBatch,
    invalidateCache,
    getMetrics,
  };
}

// ============================================================================
// Types
// ============================================================================

/**
 * Options for creating a policy engine.
 */
export interface CreatePolicyEngineOptions {
  /** Policy provider (required for rule evaluation) */
  policyProvider?: PolicyProvider;

  /** Kill switch service (optional) */
  killSwitchService?: KillSwitchService;

  /** Rate limiter service (optional) */
  rateLimiterService?: RateLimiterService;

  /** Approval gate (optional) */
  approvalGate?: ApprovalGate;

  /** Engine configuration (optional - uses defaults) */
  config?: Partial<PolicyEngineConfig>;

  /** Audit callback (optional) */
  onAudit?: (event: PolicyAuditEvent) => void;
}

/**
 * Internal metrics tracking.
 */
interface InternalMetrics {
  totalEvaluations: number;
  allowed: number;
  denied: number;
  errors: number;
  byReason: Record<DecisionReason, number>;
  cacheHits: number;
  cacheMisses: number;
  killSwitchTrips: number;
  rateLimitBlocks: number;
  approvalGateTriggers: number;
}

/**
 * Parameters for creating a decision.
 */
interface CreateDecisionParams {
  allowed: boolean;
  effect: 'allow' | 'deny';
  reason: DecisionReason;
  message: string;
  policyId?: string;
  ruleId?: string;
  ruleName?: string;
  killSwitch?: KillSwitchCheckResult;
  rateLimit?: RateLimitCheckResult;
  approvalRequestId?: string;
  approvalStatus?: ApprovalStatus;
  constraints?: {
    rateLimit?: { maxRequests: number; windowMs: number };
    budget?: { maxTokens?: number; maxCost?: number };
  } | null;
  startTime: number;
  context: EvaluationContext;
}
