/**
 * Policy Engine Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPolicyEngine } from '../policy-engine.js';
import type { PolicyProvider, EvaluationContext, PolicyAuditEvent } from '../types.js';
import type { Policy, PolicyRule } from '../../schema/types.js';
import type { KillSwitchService, KillSwitchCheckResult } from '../../kill-switch/types.js';
import type { RateLimiterService, RateLimitCheckResult } from '../../rate-limiting/types.js';
import type { ApprovalGate, ApprovalRequest, ApprovalStatus } from '../../approval-gates/types.js';

describe('Policy Engine', () => {
  describe('basic evaluation', () => {
    it('should allow action when rule allows', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({
            name: 'Allow all publishing',
            effect: 'allow',
            actions: ['post:*'],
            resources: ['*'],
          }),
        ],
      });

      const provider = createMockProvider([policy]);
      const engine = createPolicyEngine({ policyProvider: provider });

      const decision = await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      expect(decision.allowed).toBe(true);
      expect(decision.effect).toBe('allow');
      expect(decision.reason).toBe('rule_allowed');
      expect(decision.ruleName).toBe('Allow all publishing');
    });

    it('should deny action when rule denies', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({
            name: 'Deny all',
            effect: 'deny',
            actions: ['*'],
            resources: ['*'],
          }),
        ],
      });

      const provider = createMockProvider([policy]);
      const engine = createPolicyEngine({ policyProvider: provider });

      const decision = await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      expect(decision.allowed).toBe(false);
      expect(decision.effect).toBe('deny');
      expect(decision.reason).toBe('rule_denied');
    });

    it('should use default effect when no rules match', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({
            actions: ['engage:*'], // Won't match 'post:publish'
            resources: ['*'],
          }),
        ],
        defaultEffect: 'deny',
      });

      const provider = createMockProvider([policy]);
      const engine = createPolicyEngine({
        policyProvider: provider,
        config: { defaultEffect: 'deny' },
      });

      const decision = await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('default_effect');
    });

    it('should use allow as default when configured', async () => {
      const policy = createTestPolicy({
        rules: [],
        defaultEffect: 'allow',
      });

      const provider = createMockProvider([policy]);
      const engine = createPolicyEngine({
        policyProvider: provider,
        config: { defaultEffect: 'allow' },
      });

      const decision = await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe('default_effect');
    });
  });

  describe('rule priority', () => {
    it('should evaluate higher priority rules first', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({
            name: 'Low priority allow',
            priority: 10,
            effect: 'allow',
            actions: ['*'],
            resources: ['*'],
          }),
          createTestRule({
            name: 'High priority deny',
            priority: 100,
            effect: 'deny',
            actions: ['*'],
            resources: ['*'],
          }),
        ],
      });

      const provider = createMockProvider([policy]);
      const engine = createPolicyEngine({ policyProvider: provider });

      const decision = await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      expect(decision.allowed).toBe(false);
      expect(decision.ruleName).toBe('High priority deny');
    });
  });

  describe('kill switch integration', () => {
    it('should deny when kill switch is tripped', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({ effect: 'allow', actions: ['*'], resources: ['*'] }),
        ],
      });

      const provider = createMockProvider([policy]);
      const killSwitchService = createMockKillSwitch({ tripped: true });

      const engine = createPolicyEngine({
        policyProvider: provider,
        killSwitchService,
      });

      const decision = await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('kill_switch_tripped');
      expect(decision.killSwitch).toBeTruthy();
    });

    it('should continue evaluation when kill switch is not tripped', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({ effect: 'allow', actions: ['*'], resources: ['*'] }),
        ],
      });

      const provider = createMockProvider([policy]);
      const killSwitchService = createMockKillSwitch({ tripped: false });

      const engine = createPolicyEngine({
        policyProvider: provider,
        killSwitchService,
      });

      const decision = await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe('rule_allowed');
    });
  });

  describe('rate limit integration', () => {
    it('should deny when rate limit is exceeded', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({ effect: 'allow', actions: ['*'], resources: ['*'] }),
        ],
      });

      const provider = createMockProvider([policy]);
      const rateLimiterService = createMockRateLimiter({ allowed: false });

      const engine = createPolicyEngine({
        policyProvider: provider,
        rateLimiterService,
      });

      const decision = await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
        platform: 'facebook',
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('rate_limit_exceeded');
      expect(decision.rateLimit).toBeTruthy();
    });

    it('should continue evaluation when under rate limit', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({ effect: 'allow', actions: ['*'], resources: ['*'] }),
        ],
      });

      const provider = createMockProvider([policy]);
      const rateLimiterService = createMockRateLimiter({ allowed: true });

      const engine = createPolicyEngine({
        policyProvider: provider,
        rateLimiterService,
      });

      const decision = await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
        platform: 'facebook',
      });

      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe('rule_allowed');
    });
  });

  describe('fail-closed behavior', () => {
    it('should deny on provider error when failClosed is true', async () => {
      const provider: PolicyProvider = {
        getPoliciesForContext: vi.fn().mockRejectedValue(new Error('DB error')),
        getPolicyById: vi.fn().mockResolvedValue(null),
      };

      const engine = createPolicyEngine({
        policyProvider: provider,
        config: { failClosed: true },
      });

      const decision = await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('evaluation_error');
    });

    it('should throw error when failClosed is false', async () => {
      const provider: PolicyProvider = {
        getPoliciesForContext: vi.fn().mockRejectedValue(new Error('DB error')),
        getPolicyById: vi.fn().mockResolvedValue(null),
      };

      const engine = createPolicyEngine({
        policyProvider: provider,
        config: { failClosed: false },
      });

      await expect(
        engine.evaluate({
          clientId: 'client_123',
          action: 'post:publish',
          resource: 'social:meta',
        })
      ).rejects.toThrow('DB error');
    });
  });

  describe('isAllowed convenience method', () => {
    it('should return true when allowed', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({ effect: 'allow', actions: ['*'], resources: ['*'] }),
        ],
      });

      const provider = createMockProvider([policy]);
      const engine = createPolicyEngine({ policyProvider: provider });

      const allowed = await engine.isAllowed({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      expect(allowed).toBe(true);
    });

    it('should return false when denied', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({ effect: 'deny', actions: ['*'], resources: ['*'] }),
        ],
      });

      const provider = createMockProvider([policy]);
      const engine = createPolicyEngine({ policyProvider: provider });

      const allowed = await engine.isAllowed({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      expect(allowed).toBe(false);
    });
  });

  describe('batch evaluation', () => {
    it('should evaluate multiple contexts', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({
            effect: 'allow',
            actions: ['post:*'],
            resources: ['*'],
          }),
          createTestRule({
            effect: 'deny',
            actions: ['engage:*'],
            resources: ['*'],
          }),
        ],
      });

      const provider = createMockProvider([policy]);
      const engine = createPolicyEngine({ policyProvider: provider });

      const decisions = await engine.evaluateBatch([
        { clientId: 'client_123', action: 'post:publish', resource: 'social:meta' },
        { clientId: 'client_123', action: 'engage:reply', resource: 'social:meta' },
      ]);

      expect(decisions).toHaveLength(2);
      expect(decisions[0]?.allowed).toBe(true);
      expect(decisions[1]?.allowed).toBe(false);
    });
  });

  describe('metrics tracking', () => {
    it('should track evaluation metrics', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({ effect: 'allow', actions: ['*'], resources: ['*'] }),
        ],
      });

      const provider = createMockProvider([policy]);
      const engine = createPolicyEngine({ policyProvider: provider });

      await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      const metrics = engine.getMetrics();

      expect(metrics.totalEvaluations).toBe(1);
      expect(metrics.evaluationsByResult.allowed).toBe(1);
      expect(metrics.evaluationsByReason['rule_allowed']).toBe(1);
    });

    it('should track kill switch trips', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({ effect: 'allow', actions: ['*'], resources: ['*'] }),
        ],
      });

      const provider = createMockProvider([policy]);
      const killSwitchService = createMockKillSwitch({ tripped: true });

      const engine = createPolicyEngine({
        policyProvider: provider,
        killSwitchService,
      });

      await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      const metrics = engine.getMetrics();
      expect(metrics.killSwitchTrips).toBe(1);
    });
  });

  describe('audit events', () => {
    it('should emit audit events on evaluation', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({
            name: 'Allow rule',
            effect: 'allow',
            actions: ['*'],
            resources: ['*'],
          }),
        ],
      });

      const provider = createMockProvider([policy]);
      const auditEvents: PolicyAuditEvent[] = [];

      const engine = createPolicyEngine({
        policyProvider: provider,
        onAudit: (event) => auditEvents.push(event),
      });

      await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]?.type).toBe('policy_evaluation');
      expect(auditEvents[0]?.decision.allowed).toBe(true);
      expect(auditEvents[0]?.matchedRules[0]?.ruleName).toBe('Allow rule');
    });
  });

  describe('cache', () => {
    it('should cache policies', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({ effect: 'allow', actions: ['*'], resources: ['*'] }),
        ],
      });

      const provider = createMockProvider([policy]);
      const engine = createPolicyEngine({
        policyProvider: provider,
        config: { cache: { enabled: true, ttlMs: 60000, maxSize: 100 } },
      });

      // First call
      await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      // Second call (should use cache)
      await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      const metrics = engine.getMetrics();
      expect(metrics.cache.hits).toBeGreaterThan(0);
    });

    it('should invalidate cache', async () => {
      const policy = createTestPolicy({
        clientId: 'client_123',
        rules: [
          createTestRule({ effect: 'allow', actions: ['*'], resources: ['*'] }),
        ],
      });

      const provider = createMockProvider([policy]);
      const engine = createPolicyEngine({
        policyProvider: provider,
        config: { cache: { enabled: true, ttlMs: 60000, maxSize: 100 } },
      });

      // First call
      await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      });

      // Invalidate
      engine.invalidateCache('client_123');

      // Get metrics after invalidation
      const metrics = engine.getMetrics();
      expect(metrics.cache.size).toBe(0);
    });
  });

  describe('context with conditions', () => {
    it('should evaluate rules with field conditions', async () => {
      const policy = createTestPolicy({
        rules: [
          createTestRule({
            effect: 'deny',
            actions: ['*'],
            resources: ['*'],
            conditions: [
              { type: 'field', field: 'platform', operator: 'equals', value: 'tiktok' },
            ],
          }),
          createTestRule({
            effect: 'allow',
            actions: ['*'],
            resources: ['*'],
            priority: -1, // Lower priority
          }),
        ],
      });

      const provider = createMockProvider([policy]);
      const engine = createPolicyEngine({ policyProvider: provider });

      // Should deny for TikTok
      const tiktokDecision = await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:tiktok',
        platform: 'tiktok',
      });

      expect(tiktokDecision.allowed).toBe(false);

      // Should allow for Facebook
      const facebookDecision = await engine.evaluate({
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
        platform: 'facebook',
      });

      expect(facebookDecision.allowed).toBe(true);
    });
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

function createTestPolicy(overrides: Partial<Policy> = {}): Policy {
  const now = new Date();
  return {
    id: `pol_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Policy',
    version: 1,
    status: 'active',
    scope: 'client',
    clientId: 'client_123',
    rules: [],
    defaultEffect: 'deny',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createTestRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    id: `rule_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Rule',
    effect: 'allow',
    actions: ['*'],
    resources: ['*'],
    conditions: [],
    priority: 0,
    enabled: true,
    ...overrides,
  };
}

function createMockProvider(policies: Policy[]): PolicyProvider {
  return {
    getPoliciesForContext: vi.fn().mockResolvedValue(policies),
    getPolicyById: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(policies.find((p) => p.id === id) ?? null)
    ),
  };
}

function createMockKillSwitch(options: { tripped: boolean }): KillSwitchService {
  const result: KillSwitchCheckResult = {
    tripped: options.tripped,
    switch: options.tripped
      ? {
          id: 'ks_123',
          scope: 'global',
          targetType: 'all',
          targetValue: '*',
          clientId: null,
          reason: 'Emergency shutdown',
          activatedAt: new Date(),
          activatedBy: 'system',
        }
      : null,
    reason: options.tripped ? 'Emergency shutdown' : null,
    checkDurationMs: 1,
  };

  return {
    isTripped: vi.fn().mockResolvedValue(result),
    activate: vi.fn().mockResolvedValue(undefined),
    deactivate: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({} as any),
    listActive: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
  };
}

function createMockRateLimiter(options: { allowed: boolean }): RateLimiterService {
  const result: RateLimitCheckResult = {
    allowed: options.allowed,
    policy: options.allowed
      ? null
      : {
          id: 'rl_123',
          name: 'Default Rate Limit',
          scope: 'client',
          config: { maxRequests: 10, windowMs: 60000, strategy: 'sliding_window' },
        },
    usage: {
      current: options.allowed ? 5 : 10,
      limit: 10,
      remaining: options.allowed ? 5 : 0,
      resetAt: Date.now() + 60000,
    },
    retryAfterMs: options.allowed ? null : 30000,
    checkDurationMs: 1,
  };

  return {
    check: vi.fn().mockResolvedValue(result),
    consume: vi.fn().mockResolvedValue(undefined),
    getUsage: vi.fn().mockResolvedValue(result.usage),
    createPolicy: vi.fn().mockResolvedValue({} as any),
    updatePolicy: vi.fn().mockResolvedValue({} as any),
    deletePolicy: vi.fn().mockResolvedValue(undefined),
    listPolicies: vi.fn().mockResolvedValue([]),
    getPolicyById: vi.fn().mockResolvedValue(null),
    resetUsage: vi.fn().mockResolvedValue(undefined),
  };
}
