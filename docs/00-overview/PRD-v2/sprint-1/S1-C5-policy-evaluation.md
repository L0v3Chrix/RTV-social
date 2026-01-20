# Build Prompt: S1-C5 — Policy Evaluation Engine

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-C5 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | C — Policy Engine |
| **Task Name** | Policy Evaluation Engine |
| **Complexity** | High |
| **Estimated Effort** | 6-8 hours |
| **Dependencies** | S1-C1, S1-C2, S1-C3, S1-C4 |
| **Blocks** | S1-D1, S2-*, S3-*, S4-* |
| **Status** | pending |

---

## Context

### What This Builds

The Policy Evaluation Engine is the central decision point that determines whether an action is allowed. It orchestrates all policy components (kill switches, approval gates, rate limits, rules) into a single, unified evaluation flow.

### Why It Matters

Every autonomous action must pass through policy evaluation. This is where we enforce:

- **Safety**: Kill switches halt dangerous operations
- **Compliance**: Platform-specific rules are enforced
- **Control**: Human approval gates pause for review
- **Fairness**: Rate limits prevent abuse
- **Auditability**: Every decision is logged with reasoning

### Evaluation Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Policy Evaluation Engine                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Action Request                                                       │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────┐                                                     │
│  │ Kill Switch │ ─── TRIPPED ──▶ DENY (immediate)                   │
│  │   Check     │                                                     │
│  └──────┬──────┘                                                     │
│         │ OPEN                                                       │
│         ▼                                                            │
│  ┌─────────────┐                                                     │
│  │ Rate Limit  │ ─── EXCEEDED ──▶ DENY (with retry-after)           │
│  │   Check     │                                                     │
│  └──────┬──────┘                                                     │
│         │ OK                                                         │
│         ▼                                                            │
│  ┌─────────────┐                                                     │
│  │   Policy    │ ─── DENY ──▶ DENY (with reason)                    │
│  │   Rules     │                                                     │
│  └──────┬──────┘                                                     │
│         │ ALLOW                                                      │
│         ▼                                                            │
│  ┌─────────────┐                                                     │
│  │  Approval   │ ─── REQUIRED ──▶ PENDING (wait for human)          │
│  │    Gate     │                                                     │
│  └──────┬──────┘                                                     │
│         │ NOT_REQUIRED or APPROVED                                   │
│         ▼                                                            │
│      ALLOW                                                           │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Reference Specs

| Document | Section | Relevance |
|----------|---------|-----------|
| `/docs/05-policy-safety/policy-engine.md` | Full Specification | Complete requirements |
| `/docs/05-policy-safety/compliance-safety.md` | Safety Requirements | Compliance rules |
| `/docs/01-architecture/system-architecture-v3.md` | Policy Integration | Architecture |
| `/docs/03-agents-tools/agent-recursion-contracts.md` | Policy in Agents | Agent integration |
| `/docs/06-reliability-ops/slo-error-budget.md` | Evaluation SLOs | Performance targets |

---

## Prerequisites

### Completed Tasks

- [x] **S1-C1**: Policy definition schema (rule structures)
- [x] **S1-C2**: Approval gate framework (pending approval handling)
- [x] **S1-C3**: Kill switch infrastructure (fast-path blocking)
- [x] **S1-C4**: Rate limiting policies (quota enforcement)

### Required Packages

```json
{
  "dependencies": {
    "drizzle-orm": "^0.30.0",
    "zod": "^3.22.0",
    "nanoid": "^5.0.0",
    "ioredis": "^5.3.0",
    "@opentelemetry/api": "^1.7.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create comprehensive tests BEFORE implementation.

#### 1.1 Create Policy Engine Types Tests

**File:** `packages/policy/src/engine/__tests__/types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  PolicyEvaluationContextSchema,
  PolicyEvaluationResultSchema,
  PolicyDecisionSchema,
} from '../types';

describe('Policy Engine Types', () => {
  describe('PolicyEvaluationContextSchema', () => {
    it('should validate minimal context', () => {
      const context = {
        action: 'publish',
        resource: 'post',
        clientId: 'client_abc',
        actorType: 'agent',
        actorId: 'agent_copy',
      };

      const result = PolicyEvaluationContextSchema.safeParse(context);
      expect(result.success).toBe(true);
    });

    it('should validate full context', () => {
      const context = {
        action: 'publish',
        resource: 'post',
        clientId: 'client_abc',
        actorType: 'agent',
        actorId: 'agent_copy',
        platform: 'meta',
        accountId: 'account_123',
        resourceId: 'post_456',
        attributes: {
          hasMedia: true,
          contentLength: 280,
          mentionCount: 3,
        },
        requestId: 'req_789',
        episodeId: 'ep_012',
      };

      const result = PolicyEvaluationContextSchema.safeParse(context);
      expect(result.success).toBe(true);
    });

    it('should require client ID', () => {
      const context = {
        action: 'publish',
        resource: 'post',
        actorType: 'agent',
        actorId: 'agent_copy',
      };

      const result = PolicyEvaluationContextSchema.safeParse(context);
      expect(result.success).toBe(false);
    });
  });

  describe('PolicyDecisionSchema', () => {
    it('should validate ALLOW decision', () => {
      const decision = {
        effect: 'allow',
        reason: 'All checks passed',
        checkedAt: Date.now(),
        evaluationMs: 5,
      };

      const result = PolicyDecisionSchema.safeParse(decision);
      expect(result.success).toBe(true);
    });

    it('should validate DENY decision with details', () => {
      const decision = {
        effect: 'deny',
        reason: 'Rate limit exceeded',
        deniedBy: 'rate_limit',
        retryAfter: 30000,
        checkedAt: Date.now(),
        evaluationMs: 3,
      };

      const result = PolicyDecisionSchema.safeParse(decision);
      expect(result.success).toBe(true);
    });

    it('should validate PENDING decision', () => {
      const decision = {
        effect: 'pending',
        reason: 'Awaiting approval',
        approvalRequestId: 'apr_123',
        checkedAt: Date.now(),
        evaluationMs: 8,
      };

      const result = PolicyDecisionSchema.safeParse(decision);
      expect(result.success).toBe(true);
    });
  });
});
```

#### 1.2 Create Rule Evaluator Tests

**File:** `packages/policy/src/engine/__tests__/rule-evaluator.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createRuleEvaluator, RuleEvaluator } from '../rule-evaluator';
import { PolicyRule, PolicyEvaluationContext } from '../types';

describe('RuleEvaluator', () => {
  let evaluator: RuleEvaluator;

  const baseContext: PolicyEvaluationContext = {
    action: 'publish',
    resource: 'post',
    clientId: 'client_abc',
    actorType: 'agent',
    actorId: 'agent_copy',
    platform: 'meta',
  };

  beforeEach(() => {
    evaluator = createRuleEvaluator();
  });

  describe('evaluateRule', () => {
    it('should match simple action rule', () => {
      const rule: PolicyRule = {
        id: 'rule_1',
        name: 'Allow publishing',
        effect: 'allow',
        actions: ['publish'],
        resources: ['post'],
        conditions: [],
        priority: 100,
      };

      const result = evaluator.evaluateRule(rule, baseContext);

      expect(result.matched).toBe(true);
      expect(result.effect).toBe('allow');
    });

    it('should match wildcard action', () => {
      const rule: PolicyRule = {
        id: 'rule_2',
        name: 'Allow all actions',
        effect: 'allow',
        actions: ['*'],
        resources: ['post'],
        conditions: [],
        priority: 100,
      };

      const result = evaluator.evaluateRule(rule, baseContext);
      expect(result.matched).toBe(true);
    });

    it('should not match different action', () => {
      const rule: PolicyRule = {
        id: 'rule_3',
        name: 'Allow delete only',
        effect: 'allow',
        actions: ['delete'],
        resources: ['post'],
        conditions: [],
        priority: 100,
      };

      const result = evaluator.evaluateRule(rule, baseContext);
      expect(result.matched).toBe(false);
    });

    it('should evaluate field conditions', () => {
      const rule: PolicyRule = {
        id: 'rule_4',
        name: 'Allow Meta only',
        effect: 'allow',
        actions: ['publish'],
        resources: ['post'],
        conditions: [
          {
            type: 'field',
            field: 'platform',
            operator: 'equals',
            value: 'meta',
          },
        ],
        priority: 100,
      };

      const result = evaluator.evaluateRule(rule, baseContext);
      expect(result.matched).toBe(true);

      const tiktokContext = { ...baseContext, platform: 'tiktok' };
      const result2 = evaluator.evaluateRule(rule, tiktokContext);
      expect(result2.matched).toBe(false);
    });

    it('should evaluate compound AND conditions', () => {
      const rule: PolicyRule = {
        id: 'rule_5',
        name: 'Complex rule',
        effect: 'allow',
        actions: ['publish'],
        resources: ['post'],
        conditions: [
          {
            type: 'compound',
            operator: 'AND',
            conditions: [
              { type: 'field', field: 'platform', operator: 'equals', value: 'meta' },
              { type: 'field', field: 'actorType', operator: 'equals', value: 'agent' },
            ],
          },
        ],
        priority: 100,
      };

      const result = evaluator.evaluateRule(rule, baseContext);
      expect(result.matched).toBe(true);

      const humanContext = { ...baseContext, actorType: 'human' as const };
      const result2 = evaluator.evaluateRule(rule, humanContext);
      expect(result2.matched).toBe(false);
    });

    it('should evaluate compound OR conditions', () => {
      const rule: PolicyRule = {
        id: 'rule_6',
        name: 'Meta or TikTok',
        effect: 'allow',
        actions: ['publish'],
        resources: ['post'],
        conditions: [
          {
            type: 'compound',
            operator: 'OR',
            conditions: [
              { type: 'field', field: 'platform', operator: 'equals', value: 'meta' },
              { type: 'field', field: 'platform', operator: 'equals', value: 'tiktok' },
            ],
          },
        ],
        priority: 100,
      };

      expect(evaluator.evaluateRule(rule, { ...baseContext, platform: 'meta' }).matched).toBe(true);
      expect(evaluator.evaluateRule(rule, { ...baseContext, platform: 'tiktok' }).matched).toBe(true);
      expect(evaluator.evaluateRule(rule, { ...baseContext, platform: 'linkedin' }).matched).toBe(false);
    });

    it('should evaluate NOT conditions', () => {
      const rule: PolicyRule = {
        id: 'rule_7',
        name: 'Not Meta',
        effect: 'allow',
        actions: ['publish'],
        resources: ['post'],
        conditions: [
          {
            type: 'compound',
            operator: 'NOT',
            conditions: [
              { type: 'field', field: 'platform', operator: 'equals', value: 'meta' },
            ],
          },
        ],
        priority: 100,
      };

      expect(evaluator.evaluateRule(rule, { ...baseContext, platform: 'meta' }).matched).toBe(false);
      expect(evaluator.evaluateRule(rule, { ...baseContext, platform: 'tiktok' }).matched).toBe(true);
    });

    it('should evaluate attribute conditions', () => {
      const rule: PolicyRule = {
        id: 'rule_8',
        name: 'Max content length',
        effect: 'deny',
        actions: ['publish'],
        resources: ['post'],
        conditions: [
          {
            type: 'field',
            field: 'attributes.contentLength',
            operator: 'greater_than',
            value: 280,
          },
        ],
        priority: 100,
      };

      const contextWithAttrs = {
        ...baseContext,
        attributes: { contentLength: 300 },
      };

      expect(evaluator.evaluateRule(rule, contextWithAttrs).matched).toBe(true);

      const contextUnder = {
        ...baseContext,
        attributes: { contentLength: 200 },
      };

      expect(evaluator.evaluateRule(rule, contextUnder).matched).toBe(false);
    });

    it('should evaluate time conditions', () => {
      const rule: PolicyRule = {
        id: 'rule_9',
        name: 'Business hours only',
        effect: 'deny',
        actions: ['publish'],
        resources: ['post'],
        conditions: [
          {
            type: 'time',
            timezone: 'America/New_York',
            daysOfWeek: [0, 6], // Weekend
          },
        ],
        priority: 100,
      };

      // Time conditions need current time evaluation
      const result = evaluator.evaluateRule(rule, baseContext);
      // Result depends on current day
      expect(result).toBeDefined();
    });
  });

  describe('evaluateRules', () => {
    it('should return first matching DENY rule', () => {
      const rules: PolicyRule[] = [
        {
          id: 'rule_allow',
          name: 'Allow all',
          effect: 'allow',
          actions: ['*'],
          resources: ['*'],
          conditions: [],
          priority: 50, // Lower priority
        },
        {
          id: 'rule_deny',
          name: 'Deny Meta',
          effect: 'deny',
          actions: ['publish'],
          resources: ['post'],
          conditions: [
            { type: 'field', field: 'platform', operator: 'equals', value: 'meta' },
          ],
          priority: 100, // Higher priority
        },
      ];

      const result = evaluator.evaluateRules(rules, baseContext);

      expect(result.effect).toBe('deny');
      expect(result.matchedRule?.id).toBe('rule_deny');
    });

    it('should respect priority order', () => {
      const rules: PolicyRule[] = [
        {
          id: 'low_priority',
          name: 'Low priority allow',
          effect: 'allow',
          actions: ['publish'],
          resources: ['post'],
          conditions: [],
          priority: 10,
        },
        {
          id: 'high_priority',
          name: 'High priority deny',
          effect: 'deny',
          actions: ['publish'],
          resources: ['post'],
          conditions: [],
          priority: 100,
        },
      ];

      const result = evaluator.evaluateRules(rules, baseContext);

      expect(result.matchedRule?.id).toBe('high_priority');
    });

    it('should default to DENY when no rules match', () => {
      const rules: PolicyRule[] = [
        {
          id: 'rule_1',
          name: 'Allow delete',
          effect: 'allow',
          actions: ['delete'],
          resources: ['post'],
          conditions: [],
          priority: 100,
        },
      ];

      const result = evaluator.evaluateRules(rules, baseContext); // action is 'publish'

      expect(result.effect).toBe('deny');
      expect(result.reason).toContain('No matching rule');
    });
  });
});
```

#### 1.3 Create Policy Engine Tests

**File:** `packages/policy/src/engine/__tests__/policy-engine.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPolicyEngine, PolicyEngine } from '../policy-engine';
import {
  createMockKillSwitchService,
  createMockRateLimitService,
  createMockApprovalGate,
  createMockAudit,
  createMockDb,
} from '@rtv/testing';
import { PolicyRule } from '../types';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;
  let mockKillSwitch: ReturnType<typeof createMockKillSwitchService>;
  let mockRateLimit: ReturnType<typeof createMockRateLimitService>;
  let mockApprovalGate: ReturnType<typeof createMockApprovalGate>;
  let mockAudit: ReturnType<typeof createMockAudit>;
  let mockDb: ReturnType<typeof createMockDb>;

  const defaultRules: PolicyRule[] = [
    {
      id: 'rule_allow_all',
      name: 'Allow all',
      effect: 'allow',
      actions: ['*'],
      resources: ['*'],
      conditions: [],
      priority: 1,
    },
  ];

  const baseContext = {
    action: 'publish',
    resource: 'post',
    clientId: 'client_abc',
    actorType: 'agent' as const,
    actorId: 'agent_copy',
    platform: 'meta',
  };

  beforeEach(() => {
    mockKillSwitch = createMockKillSwitchService();
    mockRateLimit = createMockRateLimitService();
    mockApprovalGate = createMockApprovalGate();
    mockAudit = createMockAudit();
    mockDb = createMockDb();

    // Default: all checks pass
    mockKillSwitch.isTripped.mockResolvedValue({ tripped: false, switch: null, reason: null, checkDurationMs: 1 });
    mockRateLimit.check.mockResolvedValue({ allowed: true, limit: 100, remaining: 99, current: 0, resetAt: Date.now() + 60000, retryAfter: null });
    mockApprovalGate.checkRequired.mockResolvedValue({ required: false });
    mockDb.query.mockResolvedValue(defaultRules);

    engine = createPolicyEngine({
      killSwitchService: mockKillSwitch,
      rateLimitService: mockRateLimit,
      approvalGate: mockApprovalGate,
      audit: mockAudit,
      db: mockDb,
      defaultRules,
    });
  });

  describe('evaluate', () => {
    it('should ALLOW when all checks pass', async () => {
      const result = await engine.evaluate(baseContext);

      expect(result.decision.effect).toBe('allow');
      expect(result.checks.killSwitch).toBe('passed');
      expect(result.checks.rateLimit).toBe('passed');
      expect(result.checks.rules).toBe('passed');
      expect(result.checks.approval).toBe('not_required');
    });

    it('should DENY when kill switch is tripped', async () => {
      mockKillSwitch.isTripped.mockResolvedValue({
        tripped: true,
        switch: { id: 'ks_1', scope: 'global', targetType: 'all', targetValue: '*', clientId: null, reason: 'Emergency stop', activatedAt: new Date(), activatedBy: 'admin' },
        reason: 'Emergency stop',
        checkDurationMs: 1,
      });

      const result = await engine.evaluate(baseContext);

      expect(result.decision.effect).toBe('deny');
      expect(result.decision.deniedBy).toBe('kill_switch');
      expect(result.checks.killSwitch).toBe('tripped');
      // Should not check other components
      expect(mockRateLimit.check).not.toHaveBeenCalled();
    });

    it('should DENY when rate limit exceeded', async () => {
      mockRateLimit.check.mockResolvedValue({
        allowed: false,
        limit: 100,
        remaining: 0,
        current: 100,
        resetAt: Date.now() + 30000,
        retryAfter: 30000,
      });

      const result = await engine.evaluate(baseContext);

      expect(result.decision.effect).toBe('deny');
      expect(result.decision.deniedBy).toBe('rate_limit');
      expect(result.decision.retryAfter).toBe(30000);
      expect(result.checks.rateLimit).toBe('exceeded');
    });

    it('should DENY when policy rules deny', async () => {
      const denyRules: PolicyRule[] = [
        {
          id: 'rule_deny_meta',
          name: 'Deny Meta',
          effect: 'deny',
          actions: ['publish'],
          resources: ['post'],
          conditions: [
            { type: 'field', field: 'platform', operator: 'equals', value: 'meta' },
          ],
          priority: 100,
        },
      ];

      mockDb.query.mockResolvedValue(denyRules);

      const result = await engine.evaluate(baseContext);

      expect(result.decision.effect).toBe('deny');
      expect(result.decision.deniedBy).toBe('policy_rule');
      expect(result.checks.rules).toBe('denied');
    });

    it('should return PENDING when approval required', async () => {
      mockApprovalGate.checkRequired.mockResolvedValue({
        required: true,
        gateId: 'gate_publish',
        approvers: ['admin'],
        timeout: 3600000,
      });

      mockApprovalGate.createRequest.mockResolvedValue({
        id: 'apr_123',
        status: 'pending',
        gateId: 'gate_publish',
        requestedBy: 'agent_copy',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      });

      const result = await engine.evaluate(baseContext);

      expect(result.decision.effect).toBe('pending');
      expect(result.decision.approvalRequestId).toBe('apr_123');
      expect(result.checks.approval).toBe('pending');
    });

    it('should ALLOW when approval already granted', async () => {
      mockApprovalGate.checkRequired.mockResolvedValue({
        required: true,
        gateId: 'gate_publish',
        existingApproval: {
          id: 'apr_123',
          status: 'approved',
          decision: { approved: true, approvedBy: 'admin', approvedAt: new Date() },
        },
      });

      const result = await engine.evaluate(baseContext);

      expect(result.decision.effect).toBe('allow');
      expect(result.checks.approval).toBe('approved');
    });

    it('should emit audit event for all decisions', async () => {
      await engine.evaluate(baseContext);

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'POLICY_EVALUATED',
        actor: 'agent_copy',
        target: 'client_abc',
        metadata: expect.objectContaining({
          action: 'publish',
          resource: 'post',
          decision: 'allow',
        }),
      });
    });

    it('should cache client rules', async () => {
      // First evaluation
      await engine.evaluate(baseContext);
      // Second evaluation for same client
      await engine.evaluate(baseContext);

      // Should only query DB once
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('evaluateWithProof', () => {
    it('should return detailed proof of evaluation', async () => {
      const result = await engine.evaluateWithProof(baseContext);

      expect(result.proof).toBeDefined();
      expect(result.proof.killSwitchCheck).toBeDefined();
      expect(result.proof.rateLimitCheck).toBeDefined();
      expect(result.proof.rulesEvaluated).toBeDefined();
      expect(result.proof.approvalCheck).toBeDefined();
      expect(result.proof.timeline).toBeDefined();
    });

    it('should include all evaluated rules in proof', async () => {
      const multiRules: PolicyRule[] = [
        { id: 'rule_1', name: 'Rule 1', effect: 'allow', actions: ['*'], resources: ['*'], conditions: [], priority: 1 },
        { id: 'rule_2', name: 'Rule 2', effect: 'deny', actions: ['delete'], resources: ['*'], conditions: [], priority: 2 },
      ];

      mockDb.query.mockResolvedValue(multiRules);

      const result = await engine.evaluateWithProof(baseContext);

      expect(result.proof.rulesEvaluated).toHaveLength(2);
    });
  });

  describe('batch evaluation', () => {
    it('should evaluate multiple contexts efficiently', async () => {
      const contexts = [
        { ...baseContext, action: 'publish' },
        { ...baseContext, action: 'engage' },
        { ...baseContext, action: 'delete' },
      ];

      const results = await engine.evaluateBatch(contexts);

      expect(results).toHaveLength(3);
      // Kill switch and rules should be checked once per unique client
      expect(mockKillSwitch.isTripped).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('should DENY on kill switch service error', async () => {
      mockKillSwitch.isTripped.mockRejectedValue(new Error('Service unavailable'));

      const result = await engine.evaluate(baseContext);

      expect(result.decision.effect).toBe('deny');
      expect(result.decision.reason).toContain('Policy evaluation error');
    });

    it('should DENY on rate limit service error', async () => {
      mockRateLimit.check.mockRejectedValue(new Error('Redis down'));

      const result = await engine.evaluate(baseContext);

      expect(result.decision.effect).toBe('deny');
    });
  });

  describe('observability', () => {
    it('should report evaluation timing', async () => {
      const result = await engine.evaluate(baseContext);

      expect(result.decision.evaluationMs).toBeDefined();
      expect(result.decision.evaluationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include request ID in result', async () => {
      const contextWithRequestId = {
        ...baseContext,
        requestId: 'req_123',
      };

      const result = await engine.evaluate(contextWithRequestId);

      expect(result.requestId).toBe('req_123');
    });
  });
});
```

#### 1.4 Run Tests (Expect Failures)

```bash
cd packages/policy
pnpm test:watch src/engine/
```

---

### Phase 2: Implementation

#### 2.1 Create Policy Engine Types

**File:** `packages/policy/src/engine/types.ts`

```typescript
import { z } from 'zod';

/**
 * Actor types that can request policy evaluation
 */
export const ActorTypeSchema = z.enum(['agent', 'human', 'system', 'webhook']);
export type ActorType = z.infer<typeof ActorTypeSchema>;

/**
 * Policy evaluation context - what we're evaluating
 */
export const PolicyEvaluationContextSchema = z.object({
  // Core identifiers
  action: z.string(),
  resource: z.string(),
  clientId: z.string(),

  // Actor information
  actorType: ActorTypeSchema,
  actorId: z.string(),

  // Optional targeting
  platform: z.string().optional(),
  accountId: z.string().optional(),
  resourceId: z.string().optional(),

  // Arbitrary attributes for rule evaluation
  attributes: z.record(z.unknown()).optional(),

  // Request tracking
  requestId: z.string().optional(),
  episodeId: z.string().optional(),
  parentRequestId: z.string().optional(),
});
export type PolicyEvaluationContext = z.infer<typeof PolicyEvaluationContextSchema>;

/**
 * Decision effects
 */
export const PolicyEffectSchema = z.enum(['allow', 'deny', 'pending']);
export type PolicyEffect = z.infer<typeof PolicyEffectSchema>;

/**
 * Policy decision
 */
export const PolicyDecisionSchema = z.object({
  effect: PolicyEffectSchema,
  reason: z.string(),

  // For DENY decisions
  deniedBy: z.enum(['kill_switch', 'rate_limit', 'policy_rule', 'approval_denied', 'error']).optional(),
  retryAfter: z.number().nullable().optional(), // ms until retry allowed

  // For PENDING decisions
  approvalRequestId: z.string().optional(),

  // Timing
  checkedAt: z.number(),
  evaluationMs: z.number(),
});
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

/**
 * Check status for each component
 */
export const CheckStatusSchema = z.enum([
  'passed',
  'tripped',
  'exceeded',
  'denied',
  'pending',
  'approved',
  'not_required',
  'skipped',
  'error',
]);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

/**
 * Full evaluation result
 */
export const PolicyEvaluationResultSchema = z.object({
  decision: PolicyDecisionSchema,
  checks: z.object({
    killSwitch: CheckStatusSchema,
    rateLimit: CheckStatusSchema,
    rules: CheckStatusSchema,
    approval: CheckStatusSchema,
  }),
  requestId: z.string().optional(),
  clientId: z.string(),
});
export type PolicyEvaluationResult = z.infer<typeof PolicyEvaluationResultSchema>;

/**
 * Condition types for policy rules
 */
export const FieldConditionSchema = z.object({
  type: z.literal('field'),
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'greater_than',
    'less_than',
    'greater_than_or_equal',
    'less_than_or_equal',
    'in',
    'not_in',
    'exists',
    'not_exists',
  ]),
  value: z.unknown(),
});

export const TimeConditionSchema = z.object({
  type: z.literal('time'),
  timezone: z.string().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  hoursOfDay: z.object({
    start: z.number().min(0).max(23),
    end: z.number().min(0).max(23),
  }).optional(),
  dateRange: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional(),
});

export const CompoundConditionSchema: z.ZodType<CompoundCondition> = z.lazy(() =>
  z.object({
    type: z.literal('compound'),
    operator: z.enum(['AND', 'OR', 'NOT']),
    conditions: z.array(PolicyConditionSchema),
  })
);

export const PolicyConditionSchema = z.discriminatedUnion('type', [
  FieldConditionSchema,
  TimeConditionSchema,
  CompoundConditionSchema as any,
]);
export type PolicyCondition = z.infer<typeof PolicyConditionSchema>;

interface CompoundCondition {
  type: 'compound';
  operator: 'AND' | 'OR' | 'NOT';
  conditions: PolicyCondition[];
}

/**
 * Policy rule
 */
export const PolicyRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  effect: z.enum(['allow', 'deny']),
  actions: z.array(z.string()), // e.g., ['publish', 'engage'] or ['*']
  resources: z.array(z.string()), // e.g., ['post', 'comment'] or ['*']
  conditions: z.array(PolicyConditionSchema),
  constraints: z.object({
    maxDailyCount: z.number().int().positive().optional(),
    requireApproval: z.boolean().optional(),
    approvalGateId: z.string().optional(),
  }).optional(),
  priority: z.number().int(),
  enabled: z.boolean().default(true),
  clientId: z.string().nullable().optional(), // null = global rule
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

/**
 * Rule evaluation result
 */
export interface RuleEvaluationResult {
  matched: boolean;
  effect?: PolicyEffect;
  rule?: PolicyRule;
  conditionResults?: Array<{
    condition: PolicyCondition;
    matched: boolean;
    reason?: string;
  }>;
}

/**
 * Rules evaluation result
 */
export interface RulesEvaluationResult {
  effect: PolicyEffect;
  reason: string;
  matchedRule: PolicyRule | null;
  evaluatedRules: Array<{
    rule: PolicyRule;
    matched: boolean;
    reason?: string;
  }>;
}

/**
 * Evaluation proof for debugging/audit
 */
export interface EvaluationProof {
  killSwitchCheck: {
    checked: boolean;
    tripped: boolean;
    switchId?: string;
    reason?: string;
    durationMs: number;
  };
  rateLimitCheck: {
    checked: boolean;
    allowed: boolean;
    current?: number;
    limit?: number;
    remaining?: number;
    durationMs: number;
  };
  rulesEvaluated: Array<{
    ruleId: string;
    ruleName: string;
    matched: boolean;
    effect: string;
    reason?: string;
  }>;
  approvalCheck: {
    checked: boolean;
    required: boolean;
    status?: string;
    requestId?: string;
    durationMs: number;
  };
  timeline: Array<{
    step: string;
    startedAt: number;
    completedAt: number;
    durationMs: number;
    result: string;
  }>;
}

/**
 * Evaluation result with proof
 */
export interface PolicyEvaluationResultWithProof extends PolicyEvaluationResult {
  proof: EvaluationProof;
}
```

#### 2.2 Create Rule Evaluator

**File:** `packages/policy/src/engine/rule-evaluator.ts`

```typescript
import {
  PolicyRule,
  PolicyCondition,
  PolicyEvaluationContext,
  RuleEvaluationResult,
  RulesEvaluationResult,
  PolicyEffect,
} from './types';

export interface RuleEvaluator {
  evaluateRule(rule: PolicyRule, context: PolicyEvaluationContext): RuleEvaluationResult;
  evaluateRules(rules: PolicyRule[], context: PolicyEvaluationContext): RulesEvaluationResult;
  evaluateCondition(condition: PolicyCondition, context: PolicyEvaluationContext): boolean;
}

export function createRuleEvaluator(): RuleEvaluator {
  /**
   * Get a nested value from an object using dot notation
   */
  function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Check if action matches (supports wildcards)
   */
  function matchesAction(ruleActions: string[], contextAction: string): boolean {
    return ruleActions.some(a => a === '*' || a === contextAction);
  }

  /**
   * Check if resource matches (supports wildcards)
   */
  function matchesResource(ruleResources: string[], contextResource: string): boolean {
    return ruleResources.some(r => r === '*' || r === contextResource);
  }

  /**
   * Evaluate a field condition
   */
  function evaluateFieldCondition(
    condition: { field: string; operator: string; value: unknown },
    context: PolicyEvaluationContext
  ): boolean {
    const contextValue = getNestedValue(context as unknown as Record<string, unknown>, condition.field);

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;

      case 'not_equals':
        return contextValue !== condition.value;

      case 'contains':
        if (typeof contextValue === 'string' && typeof condition.value === 'string') {
          return contextValue.includes(condition.value);
        }
        if (Array.isArray(contextValue)) {
          return contextValue.includes(condition.value);
        }
        return false;

      case 'not_contains':
        if (typeof contextValue === 'string' && typeof condition.value === 'string') {
          return !contextValue.includes(condition.value);
        }
        if (Array.isArray(contextValue)) {
          return !contextValue.includes(condition.value);
        }
        return true;

      case 'starts_with':
        return typeof contextValue === 'string' &&
          typeof condition.value === 'string' &&
          contextValue.startsWith(condition.value);

      case 'ends_with':
        return typeof contextValue === 'string' &&
          typeof condition.value === 'string' &&
          contextValue.endsWith(condition.value);

      case 'greater_than':
        return typeof contextValue === 'number' &&
          typeof condition.value === 'number' &&
          contextValue > condition.value;

      case 'less_than':
        return typeof contextValue === 'number' &&
          typeof condition.value === 'number' &&
          contextValue < condition.value;

      case 'greater_than_or_equal':
        return typeof contextValue === 'number' &&
          typeof condition.value === 'number' &&
          contextValue >= condition.value;

      case 'less_than_or_equal':
        return typeof contextValue === 'number' &&
          typeof condition.value === 'number' &&
          contextValue <= condition.value;

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(contextValue);

      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(contextValue);

      case 'exists':
        return contextValue !== undefined && contextValue !== null;

      case 'not_exists':
        return contextValue === undefined || contextValue === null;

      default:
        return false;
    }
  }

  /**
   * Evaluate a time condition
   */
  function evaluateTimeCondition(
    condition: {
      timezone?: string;
      daysOfWeek?: number[];
      hoursOfDay?: { start: number; end: number };
      dateRange?: { start?: string; end?: string };
    }
  ): boolean {
    const now = new Date();

    // Get time in specified timezone
    const options: Intl.DateTimeFormatOptions = {
      timeZone: condition.timezone || 'UTC',
      hour: 'numeric',
      weekday: 'short',
    };

    const formatter = new Intl.DateTimeFormat('en-US', {
      ...options,
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);

    // Check day of week
    if (condition.daysOfWeek) {
      const day = now.getDay();
      if (condition.daysOfWeek.includes(day)) {
        return true; // Match = condition applies
      }
    }

    // Check hours of day
    if (condition.hoursOfDay) {
      const { start, end } = condition.hoursOfDay;
      if (start <= end) {
        if (hour >= start && hour < end) {
          return true;
        }
      } else {
        // Wraps around midnight
        if (hour >= start || hour < end) {
          return true;
        }
      }
    }

    // Check date range
    if (condition.dateRange) {
      if (condition.dateRange.start) {
        const start = new Date(condition.dateRange.start);
        if (now < start) return false;
      }
      if (condition.dateRange.end) {
        const end = new Date(condition.dateRange.end);
        if (now > end) return false;
      }
      return true;
    }

    return false;
  }

  return {
    evaluateCondition(condition: PolicyCondition, context: PolicyEvaluationContext): boolean {
      switch (condition.type) {
        case 'field':
          return evaluateFieldCondition(condition, context);

        case 'time':
          return evaluateTimeCondition(condition);

        case 'compound': {
          const results = condition.conditions.map(c =>
            this.evaluateCondition(c, context)
          );

          switch (condition.operator) {
            case 'AND':
              return results.every(r => r);
            case 'OR':
              return results.some(r => r);
            case 'NOT':
              return !results[0];
            default:
              return false;
          }
        }

        default:
          return false;
      }
    },

    evaluateRule(rule: PolicyRule, context: PolicyEvaluationContext): RuleEvaluationResult {
      // Check if rule is enabled
      if (rule.enabled === false) {
        return { matched: false };
      }

      // Check action match
      if (!matchesAction(rule.actions, context.action)) {
        return { matched: false };
      }

      // Check resource match
      if (!matchesResource(rule.resources, context.resource)) {
        return { matched: false };
      }

      // Check all conditions
      const conditionResults = rule.conditions.map(condition => ({
        condition,
        matched: this.evaluateCondition(condition, context),
      }));

      // All conditions must match
      const allConditionsMatch = conditionResults.every(r => r.matched);

      if (!allConditionsMatch) {
        return {
          matched: false,
          conditionResults,
        };
      }

      return {
        matched: true,
        effect: rule.effect as PolicyEffect,
        rule,
        conditionResults,
      };
    },

    evaluateRules(rules: PolicyRule[], context: PolicyEvaluationContext): RulesEvaluationResult {
      // Sort rules by priority (higher priority first)
      const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

      const evaluatedRules: RulesEvaluationResult['evaluatedRules'] = [];

      for (const rule of sortedRules) {
        const result = this.evaluateRule(rule, context);

        evaluatedRules.push({
          rule,
          matched: result.matched,
          reason: result.matched
            ? `Matched with effect: ${rule.effect}`
            : 'Conditions not met',
        });

        if (result.matched) {
          return {
            effect: result.effect!,
            reason: `Rule "${rule.name}" matched`,
            matchedRule: rule,
            evaluatedRules,
          };
        }
      }

      // Default deny when no rules match
      return {
        effect: 'deny',
        reason: 'No matching rule found (default deny)',
        matchedRule: null,
        evaluatedRules,
      };
    },
  };
}
```

#### 2.3 Create Policy Engine

**File:** `packages/policy/src/engine/policy-engine.ts`

```typescript
import { nanoid } from 'nanoid';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  PolicyEvaluationResultWithProof,
  PolicyRule,
  PolicyDecision,
  CheckStatus,
  EvaluationProof,
  PolicyEvaluationContextSchema,
} from './types';
import { createRuleEvaluator, RuleEvaluator } from './rule-evaluator';
import type { KillSwitchService } from '../kill-switch';
import type { RateLimitService } from '../rate-limit';
import type { ApprovalGate } from '../approval-gate';
import type { AuditEmitter } from '@rtv/audit';

const tracer = trace.getTracer('policy-engine');

interface PolicyEngineDeps {
  killSwitchService: KillSwitchService;
  rateLimitService: RateLimitService;
  approvalGate: ApprovalGate;
  audit: AuditEmitter;
  db: {
    query: (sql: any) => Promise<PolicyRule[]>;
  };
  defaultRules: PolicyRule[];
}

export interface PolicyEngine {
  /**
   * Evaluate a policy context and return the decision
   */
  evaluate(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult>;

  /**
   * Evaluate with detailed proof for debugging
   */
  evaluateWithProof(context: PolicyEvaluationContext): Promise<PolicyEvaluationResultWithProof>;

  /**
   * Batch evaluate multiple contexts
   */
  evaluateBatch(contexts: PolicyEvaluationContext[]): Promise<PolicyEvaluationResult[]>;

  /**
   * Load rules for a client (cached)
   */
  loadRules(clientId: string): Promise<PolicyRule[]>;

  /**
   * Invalidate rule cache for a client
   */
  invalidateCache(clientId?: string): void;
}

export function createPolicyEngine(deps: PolicyEngineDeps): PolicyEngine {
  const { killSwitchService, rateLimitService, approvalGate, audit, db, defaultRules } = deps;

  const ruleEvaluator: RuleEvaluator = createRuleEvaluator();

  // Cache for client rules
  const ruleCache = new Map<string, { rules: PolicyRule[]; loadedAt: number }>();
  const CACHE_TTL_MS = 60_000; // 1 minute

  /**
   * Get rules for a client (with caching)
   */
  async function getRules(clientId: string): Promise<PolicyRule[]> {
    const cached = ruleCache.get(clientId);
    const now = Date.now();

    if (cached && now - cached.loadedAt < CACHE_TTL_MS) {
      return cached.rules;
    }

    // Load from database
    const clientRules = await db.query({
      // This would be a proper Drizzle query
      clientId,
    });

    // Combine with default rules
    const allRules = [...defaultRules, ...clientRules];

    ruleCache.set(clientId, { rules: allRules, loadedAt: now });

    return allRules;
  }

  return {
    async evaluate(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
      return tracer.startActiveSpan('policy.evaluate', async (span) => {
        const startTime = Date.now();
        const validated = PolicyEvaluationContextSchema.parse(context);
        const requestId = validated.requestId || `req_${nanoid()}`;

        span.setAttributes({
          'policy.action': validated.action,
          'policy.resource': validated.resource,
          'policy.client_id': validated.clientId,
          'policy.actor_type': validated.actorType,
          'policy.request_id': requestId,
        });

        const checks: PolicyEvaluationResult['checks'] = {
          killSwitch: 'skipped',
          rateLimit: 'skipped',
          rules: 'skipped',
          approval: 'skipped',
        };

        try {
          // Step 1: Check kill switches (fast path)
          const killSwitchResult = await killSwitchService.isTripped({
            action: validated.action,
            platform: validated.platform,
            clientId: validated.clientId,
          });

          if (killSwitchResult.tripped) {
            checks.killSwitch = 'tripped';
            const decision: PolicyDecision = {
              effect: 'deny',
              reason: killSwitchResult.reason || 'Kill switch activated',
              deniedBy: 'kill_switch',
              retryAfter: null,
              checkedAt: Date.now(),
              evaluationMs: Date.now() - startTime,
            };

            await this.emitAuditEvent(validated, decision, requestId);
            span.setStatus({ code: SpanStatusCode.OK });

            return { decision, checks, requestId, clientId: validated.clientId };
          }

          checks.killSwitch = 'passed';

          // Step 2: Check rate limits
          const rateLimitResult = await rateLimitService.check({
            resource: `${validated.platform || 'default'}:${validated.action}`,
            clientId: validated.clientId,
            accountId: validated.accountId,
          });

          if (!rateLimitResult.allowed) {
            checks.rateLimit = 'exceeded';
            const decision: PolicyDecision = {
              effect: 'deny',
              reason: `Rate limit exceeded (${rateLimitResult.current}/${rateLimitResult.limit})`,
              deniedBy: 'rate_limit',
              retryAfter: rateLimitResult.retryAfter,
              checkedAt: Date.now(),
              evaluationMs: Date.now() - startTime,
            };

            await this.emitAuditEvent(validated, decision, requestId);
            span.setStatus({ code: SpanStatusCode.OK });

            return { decision, checks, requestId, clientId: validated.clientId };
          }

          checks.rateLimit = 'passed';

          // Step 3: Evaluate policy rules
          const rules = await getRules(validated.clientId);
          const rulesResult = ruleEvaluator.evaluateRules(rules, validated);

          if (rulesResult.effect === 'deny') {
            checks.rules = 'denied';
            const decision: PolicyDecision = {
              effect: 'deny',
              reason: rulesResult.reason,
              deniedBy: 'policy_rule',
              retryAfter: null,
              checkedAt: Date.now(),
              evaluationMs: Date.now() - startTime,
            };

            await this.emitAuditEvent(validated, decision, requestId);
            span.setStatus({ code: SpanStatusCode.OK });

            return { decision, checks, requestId, clientId: validated.clientId };
          }

          checks.rules = 'passed';

          // Step 4: Check approval requirements
          const approvalRequired = await approvalGate.checkRequired({
            action: validated.action,
            resource: validated.resource,
            clientId: validated.clientId,
            actorType: validated.actorType,
            rule: rulesResult.matchedRule,
          });

          if (approvalRequired.required) {
            // Check for existing approval
            if (approvalRequired.existingApproval?.status === 'approved') {
              checks.approval = 'approved';
            } else {
              // Create approval request
              const approvalRequest = await approvalGate.createRequest({
                gateId: approvalRequired.gateId!,
                context: validated,
                requestedBy: validated.actorId,
              });

              checks.approval = 'pending';
              const decision: PolicyDecision = {
                effect: 'pending',
                reason: 'Awaiting approval',
                approvalRequestId: approvalRequest.id,
                checkedAt: Date.now(),
                evaluationMs: Date.now() - startTime,
              };

              await this.emitAuditEvent(validated, decision, requestId);
              span.setStatus({ code: SpanStatusCode.OK });

              return { decision, checks, requestId, clientId: validated.clientId };
            }
          } else {
            checks.approval = 'not_required';
          }

          // All checks passed
          const decision: PolicyDecision = {
            effect: 'allow',
            reason: rulesResult.reason,
            checkedAt: Date.now(),
            evaluationMs: Date.now() - startTime,
          };

          await this.emitAuditEvent(validated, decision, requestId);
          span.setStatus({ code: SpanStatusCode.OK });

          return { decision, checks, requestId, clientId: validated.clientId };

        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
          span.recordException(error as Error);

          // Fail closed on errors
          const decision: PolicyDecision = {
            effect: 'deny',
            reason: `Policy evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            deniedBy: 'error',
            retryAfter: null,
            checkedAt: Date.now(),
            evaluationMs: Date.now() - startTime,
          };

          await this.emitAuditEvent(validated, decision, requestId);

          return {
            decision,
            checks: { killSwitch: 'error', rateLimit: 'error', rules: 'error', approval: 'error' },
            requestId,
            clientId: validated.clientId,
          };
        } finally {
          span.end();
        }
      });
    },

    async evaluateWithProof(context: PolicyEvaluationContext): Promise<PolicyEvaluationResultWithProof> {
      const startTime = Date.now();
      const validated = PolicyEvaluationContextSchema.parse(context);
      const requestId = validated.requestId || `req_${nanoid()}`;

      const proof: EvaluationProof = {
        killSwitchCheck: { checked: false, tripped: false, durationMs: 0 },
        rateLimitCheck: { checked: false, allowed: true, durationMs: 0 },
        rulesEvaluated: [],
        approvalCheck: { checked: false, required: false, durationMs: 0 },
        timeline: [],
      };

      const timeline = proof.timeline;

      // Kill switch check
      const ksStart = Date.now();
      const killSwitchResult = await killSwitchService.isTripped({
        action: validated.action,
        platform: validated.platform,
        clientId: validated.clientId,
      });
      const ksEnd = Date.now();

      proof.killSwitchCheck = {
        checked: true,
        tripped: killSwitchResult.tripped,
        switchId: killSwitchResult.switch?.id,
        reason: killSwitchResult.reason || undefined,
        durationMs: ksEnd - ksStart,
      };

      timeline.push({
        step: 'kill_switch_check',
        startedAt: ksStart,
        completedAt: ksEnd,
        durationMs: ksEnd - ksStart,
        result: killSwitchResult.tripped ? 'tripped' : 'passed',
      });

      if (killSwitchResult.tripped) {
        const result = await this.evaluate(context);
        return { ...result, proof };
      }

      // Rate limit check
      const rlStart = Date.now();
      const rateLimitResult = await rateLimitService.check({
        resource: `${validated.platform || 'default'}:${validated.action}`,
        clientId: validated.clientId,
        accountId: validated.accountId,
      });
      const rlEnd = Date.now();

      proof.rateLimitCheck = {
        checked: true,
        allowed: rateLimitResult.allowed,
        current: rateLimitResult.current,
        limit: rateLimitResult.limit || undefined,
        remaining: rateLimitResult.remaining,
        durationMs: rlEnd - rlStart,
      };

      timeline.push({
        step: 'rate_limit_check',
        startedAt: rlStart,
        completedAt: rlEnd,
        durationMs: rlEnd - rlStart,
        result: rateLimitResult.allowed ? 'passed' : 'exceeded',
      });

      // Rules evaluation
      const rulesStart = Date.now();
      const rules = await getRules(validated.clientId);
      const rulesResult = ruleEvaluator.evaluateRules(rules, validated);
      const rulesEnd = Date.now();

      proof.rulesEvaluated = rulesResult.evaluatedRules.map(r => ({
        ruleId: r.rule.id,
        ruleName: r.rule.name,
        matched: r.matched,
        effect: r.rule.effect,
        reason: r.reason,
      }));

      timeline.push({
        step: 'rules_evaluation',
        startedAt: rulesStart,
        completedAt: rulesEnd,
        durationMs: rulesEnd - rulesStart,
        result: rulesResult.effect,
      });

      // Approval check
      const approvalStart = Date.now();
      const approvalRequired = await approvalGate.checkRequired({
        action: validated.action,
        resource: validated.resource,
        clientId: validated.clientId,
        actorType: validated.actorType,
        rule: rulesResult.matchedRule,
      });
      const approvalEnd = Date.now();

      proof.approvalCheck = {
        checked: true,
        required: approvalRequired.required,
        status: approvalRequired.existingApproval?.status,
        requestId: approvalRequired.existingApproval?.id,
        durationMs: approvalEnd - approvalStart,
      };

      timeline.push({
        step: 'approval_check',
        startedAt: approvalStart,
        completedAt: approvalEnd,
        durationMs: approvalEnd - approvalStart,
        result: approvalRequired.required
          ? (approvalRequired.existingApproval?.status || 'pending')
          : 'not_required',
      });

      const result = await this.evaluate(context);
      return { ...result, proof };
    },

    async evaluateBatch(contexts: PolicyEvaluationContext[]): Promise<PolicyEvaluationResult[]> {
      // Evaluate in parallel with Promise.all
      return Promise.all(contexts.map(ctx => this.evaluate(ctx)));
    },

    async loadRules(clientId: string): Promise<PolicyRule[]> {
      return getRules(clientId);
    },

    invalidateCache(clientId?: string): void {
      if (clientId) {
        ruleCache.delete(clientId);
      } else {
        ruleCache.clear();
      }
    },

    // Private helper
    async emitAuditEvent(
      context: PolicyEvaluationContext,
      decision: PolicyDecision,
      requestId: string
    ): Promise<void> {
      await audit.emit({
        type: 'POLICY_EVALUATED',
        actor: context.actorId,
        target: context.clientId,
        metadata: {
          requestId,
          action: context.action,
          resource: context.resource,
          platform: context.platform,
          decision: decision.effect,
          reason: decision.reason,
          deniedBy: decision.deniedBy,
          evaluationMs: decision.evaluationMs,
        },
      });
    },
  } as PolicyEngine & {
    emitAuditEvent: (
      context: PolicyEvaluationContext,
      decision: PolicyDecision,
      requestId: string
    ) => Promise<void>;
  };
}
```

#### 2.4 Create Policy Engine Factory

**File:** `packages/policy/src/engine/factory.ts`

```typescript
import type { Redis } from 'ioredis';
import { createPolicyEngine, PolicyEngine } from './policy-engine';
import { createKillSwitchService } from '../kill-switch';
import { createRateLimitService } from '../rate-limit';
import { createApprovalGate } from '../approval-gate';
import { defaultRateLimitConfigs } from '../rate-limit/default-configs';
import type { PolicyRule } from './types';
import type { AuditEmitter } from '@rtv/audit';

interface PolicyEngineFactoryOptions {
  db: any; // Drizzle instance
  redis: Redis;
  audit: AuditEmitter;
  defaultRules?: PolicyRule[];
  rateLimitConfigs?: typeof defaultRateLimitConfigs;
}

/**
 * Factory function to create a fully configured PolicyEngine
 */
export function createConfiguredPolicyEngine(options: PolicyEngineFactoryOptions): PolicyEngine {
  const { db, redis, audit, defaultRules = [], rateLimitConfigs = defaultRateLimitConfigs } = options;

  // Create kill switch service
  const killSwitchService = createKillSwitchService({
    db,
    redis,
    audit,
  });

  // Create rate limit service
  const rateLimitService = createRateLimitService({
    db,
    redis,
    audit,
    configs: rateLimitConfigs,
  });

  // Create approval gate
  const approvalGate = createApprovalGate({
    db,
    audit,
  });

  // Create policy engine
  return createPolicyEngine({
    killSwitchService,
    rateLimitService,
    approvalGate,
    audit,
    db,
    defaultRules,
  });
}

/**
 * Default policy rules for the platform
 */
export const defaultPolicyRules: PolicyRule[] = [
  // Global allow for system operations
  {
    id: 'rule_system_allow',
    name: 'Allow system operations',
    effect: 'allow',
    actions: ['*'],
    resources: ['*'],
    conditions: [
      { type: 'field', field: 'actorType', operator: 'equals', value: 'system' },
    ],
    priority: 1000,
    enabled: true,
    clientId: null,
  },

  // Require approval for delete operations
  {
    id: 'rule_delete_approval',
    name: 'Require approval for deletes',
    effect: 'allow',
    actions: ['delete'],
    resources: ['*'],
    conditions: [],
    constraints: {
      requireApproval: true,
      approvalGateId: 'gate_destructive_actions',
    },
    priority: 500,
    enabled: true,
    clientId: null,
  },

  // Default allow for agents
  {
    id: 'rule_agent_allow',
    name: 'Allow agent operations',
    effect: 'allow',
    actions: ['*'],
    resources: ['*'],
    conditions: [
      { type: 'field', field: 'actorType', operator: 'equals', value: 'agent' },
    ],
    priority: 100,
    enabled: true,
    clientId: null,
  },

  // Default allow for humans
  {
    id: 'rule_human_allow',
    name: 'Allow human operations',
    effect: 'allow',
    actions: ['*'],
    resources: ['*'],
    conditions: [
      { type: 'field', field: 'actorType', operator: 'equals', value: 'human' },
    ],
    priority: 100,
    enabled: true,
    clientId: null,
  },

  // Catch-all deny (lowest priority)
  {
    id: 'rule_default_deny',
    name: 'Default deny',
    effect: 'deny',
    actions: ['*'],
    resources: ['*'],
    conditions: [],
    priority: 0,
    enabled: true,
    clientId: null,
  },
];
```

#### 2.5 Create Module Index

**File:** `packages/policy/src/engine/index.ts`

```typescript
export * from './types';
export * from './rule-evaluator';
export * from './policy-engine';
export * from './factory';
```

#### 2.6 Update Package Index

**File:** `packages/policy/src/index.ts`

```typescript
// Kill switch
export * from './kill-switch';

// Rate limiting
export * from './rate-limit';

// Approval gates
export * from './approval-gate';

// Policy engine (main export)
export * from './engine';
```

---

### Phase 3: Verification

#### 3.1 Run Tests

```bash
# Run all policy engine tests
cd packages/policy
pnpm test src/engine/

# Run full policy package tests
pnpm test

# Run with coverage
pnpm test:coverage
```

#### 3.2 Type Check

```bash
pnpm typecheck
```

#### 3.3 Lint

```bash
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/policy/src/engine/types.ts` | Type definitions |
| Create | `packages/policy/src/engine/rule-evaluator.ts` | Rule evaluation logic |
| Create | `packages/policy/src/engine/policy-engine.ts` | Main engine |
| Create | `packages/policy/src/engine/factory.ts` | Factory and defaults |
| Create | `packages/policy/src/engine/index.ts` | Module exports |
| Modify | `packages/policy/src/index.ts` | Package exports |
| Create | `packages/policy/src/engine/__tests__/types.test.ts` | Type tests |
| Create | `packages/policy/src/engine/__tests__/rule-evaluator.test.ts` | Rule evaluator tests |
| Create | `packages/policy/src/engine/__tests__/policy-engine.test.ts` | Engine tests |

---

## Acceptance Criteria

- [ ] Evaluation flow: kill switch → rate limit → rules → approval
- [ ] Kill switch check short-circuits on tripped
- [ ] Rate limit exceeded returns retryAfter
- [ ] Policy rules evaluated with priority order
- [ ] Compound conditions (AND/OR/NOT) work correctly
- [ ] Field conditions support all operators
- [ ] Time conditions evaluate correctly
- [ ] Approval gates create pending requests
- [ ] Rule caching improves performance
- [ ] Fail-closed on errors (deny by default)
- [ ] Audit events emitted for all decisions
- [ ] OpenTelemetry tracing integrated
- [ ] Batch evaluation works efficiently
- [ ] All tests pass with >80% coverage
- [ ] TypeScript compiles with no errors

---

## Test Requirements

### Unit Tests

- Field condition operators (all 14)
- Time condition evaluation
- Compound condition logic
- Rule matching (action, resource, conditions)
- Priority ordering
- Default deny behavior

### Integration Tests

- Full evaluation flow
- Cache invalidation
- Concurrent evaluations
- Error handling

### Performance Tests

- Evaluation latency <10ms (no approval)
- 1K evaluations/second throughput
- Cache hit rate >90%

---

## Security & Safety Checklist

- [ ] Fail-closed on errors
- [ ] No secrets in rules or conditions
- [ ] Client isolation in rule loading
- [ ] Audit trail for all decisions
- [ ] Authorization checked before rule changes
- [ ] Rate limiting on evaluation endpoint itself

---

## JSON Task Block

```json
{
  "task_id": "S1-C5",
  "name": "Policy Evaluation Engine",
  "status": "pending",
  "complexity": "high",
  "sprint": 1,
  "agent": "C",
  "dependencies": ["S1-C1", "S1-C2", "S1-C3", "S1-C4"],
  "blocks": ["S1-D1", "S2-A1", "S2-B1", "S3-A1", "S4-A1"],
  "estimated_hours": 7,
  "actual_hours": null,
  "files": [
    "packages/policy/src/engine/types.ts",
    "packages/policy/src/engine/rule-evaluator.ts",
    "packages/policy/src/engine/policy-engine.ts",
    "packages/policy/src/engine/factory.ts",
    "packages/policy/src/engine/index.ts",
    "packages/policy/src/index.ts"
  ],
  "test_files": [
    "packages/policy/src/engine/__tests__/types.test.ts",
    "packages/policy/src/engine/__tests__/rule-evaluator.test.ts",
    "packages/policy/src/engine/__tests__/policy-engine.test.ts"
  ],
  "acceptance_criteria": [
    "Evaluation flow orchestrates all components",
    "Kill switch short-circuits evaluation",
    "Rule conditions fully evaluated",
    "Approval gates integrated",
    "Fail-closed on errors",
    "Full audit trail"
  ]
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "artifacts": {
    "files_created": [],
    "tests_passed": null,
    "coverage_percent": null
  },
  "learnings": [],
  "blockers_encountered": []
}
```
