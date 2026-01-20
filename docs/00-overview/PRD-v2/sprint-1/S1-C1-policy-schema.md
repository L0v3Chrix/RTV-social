# Build Prompt: S1-C1 — Policy Definition Schema

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-C1 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | C — Policy Engine |
| **Complexity** | High |
| **Estimated Effort** | 4-5 hours |
| **Dependencies** | S0-A3 |
| **Blocks** | S1-C2, S1-C3, S1-C4, S1-C5 |

---

## Context

### What We're Building

The Policy Definition Schema provides a declarative way to define rules that govern agent behavior. Policies define what actions are allowed, under what conditions, and with what constraints. This is the foundation of the "policy engine" that enforces safety and compliance rules.

### Why This Matters

- **Safety**: Prevent harmful or unauthorized actions
- **Compliance**: Enforce platform and legal requirements
- **Flexibility**: Configure rules without code changes
- **Auditability**: All policy decisions are traceable

### Spec References

- `/docs/05-policy-safety/multi-tenant-isolation.md` — Tenant policies
- `/docs/05-policy-safety/ai-safety-guardrails.md` — Content safety
- `/docs/03-agents-tools/agent-recursion-contracts.md` — Action constraints

**Critical Pattern (from multi-tenant-isolation.md):**
> Every action must pass through the policy engine. Policies are evaluated in order: deny rules first, then allow rules. Default is deny unless explicitly allowed.

---

## Prerequisites

### Completed Tasks

- [x] S0-A3: Core packages scaffold (@rtv/types)

### Required Packages

```bash
pnpm add zod nanoid date-fns
pnpm add -D vitest @types/node
```

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/policy/src/__tests__/schema.test.ts`**

```typescript
import { describe, test, expect } from 'vitest';
import {
  PolicySchema,
  PolicyRuleSchema,
  PolicyConditionSchema,
  createPolicy,
  validatePolicy,
  type Policy,
  type PolicyRule,
  type PolicyCondition,
  type PolicyEffect,
} from '../schema';

describe('Policy Schema', () => {
  describe('PolicyCondition', () => {
    test('validates field comparison condition', () => {
      const condition: PolicyCondition = {
        type: 'field',
        field: 'client.tier',
        operator: 'equals',
        value: 'premium',
      };

      const result = PolicyConditionSchema.safeParse(condition);
      expect(result.success).toBe(true);
    });

    test('validates array membership condition', () => {
      const condition: PolicyCondition = {
        type: 'field',
        field: 'action.platform',
        operator: 'in',
        value: ['instagram', 'facebook', 'tiktok'],
      };

      const result = PolicyConditionSchema.safeParse(condition);
      expect(result.success).toBe(true);
    });

    test('validates time-based condition', () => {
      const condition: PolicyCondition = {
        type: 'time',
        field: 'request.timestamp',
        operator: 'between',
        value: { start: '09:00', end: '17:00', timezone: 'America/New_York' },
      };

      const result = PolicyConditionSchema.safeParse(condition);
      expect(result.success).toBe(true);
    });

    test('validates compound AND condition', () => {
      const condition: PolicyCondition = {
        type: 'compound',
        operator: 'and',
        conditions: [
          { type: 'field', field: 'client.tier', operator: 'equals', value: 'premium' },
          { type: 'field', field: 'action.type', operator: 'equals', value: 'publish' },
        ],
      };

      const result = PolicyConditionSchema.safeParse(condition);
      expect(result.success).toBe(true);
    });

    test('validates compound OR condition', () => {
      const condition: PolicyCondition = {
        type: 'compound',
        operator: 'or',
        conditions: [
          { type: 'field', field: 'client.id', operator: 'equals', value: 'client-vip' },
          { type: 'field', field: 'client.tier', operator: 'equals', value: 'enterprise' },
        ],
      };

      const result = PolicyConditionSchema.safeParse(condition);
      expect(result.success).toBe(true);
    });

    test('validates NOT condition', () => {
      const condition: PolicyCondition = {
        type: 'compound',
        operator: 'not',
        conditions: [
          { type: 'field', field: 'client.status', operator: 'equals', value: 'suspended' },
        ],
      };

      const result = PolicyConditionSchema.safeParse(condition);
      expect(result.success).toBe(true);
    });

    test('rejects invalid operator', () => {
      const condition = {
        type: 'field',
        field: 'client.tier',
        operator: 'invalid_op',
        value: 'premium',
      };

      const result = PolicyConditionSchema.safeParse(condition);
      expect(result.success).toBe(false);
    });
  });

  describe('PolicyRule', () => {
    test('validates allow rule', () => {
      const rule: PolicyRule = {
        id: 'rule-1',
        name: 'Allow premium publishing',
        description: 'Premium clients can publish to all platforms',
        effect: 'allow',
        actions: ['publish'],
        resources: ['platform:*'],
        conditions: [
          { type: 'field', field: 'client.tier', operator: 'equals', value: 'premium' },
        ],
        priority: 100,
      };

      const result = PolicyRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
    });

    test('validates deny rule', () => {
      const rule: PolicyRule = {
        id: 'rule-2',
        name: 'Deny suspended clients',
        effect: 'deny',
        actions: ['*'],
        resources: ['*'],
        conditions: [
          { type: 'field', field: 'client.status', operator: 'equals', value: 'suspended' },
        ],
        priority: 1000, // High priority for deny rules
      };

      const result = PolicyRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
    });

    test('validates rule with rate limit constraint', () => {
      const rule: PolicyRule = {
        id: 'rule-3',
        name: 'Rate limit basic tier',
        effect: 'allow',
        actions: ['publish'],
        resources: ['platform:*'],
        conditions: [
          { type: 'field', field: 'client.tier', operator: 'equals', value: 'basic' },
        ],
        constraints: {
          rateLimit: {
            maxRequests: 10,
            windowMs: 3600000, // 1 hour
          },
        },
        priority: 50,
      };

      const result = PolicyRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
    });

    test('validates rule with approval requirement', () => {
      const rule: PolicyRule = {
        id: 'rule-4',
        name: 'Require approval for high-risk content',
        effect: 'allow',
        actions: ['publish'],
        resources: ['content:*'],
        conditions: [
          { type: 'field', field: 'content.risk_score', operator: 'gte', value: 0.7 },
        ],
        constraints: {
          requireApproval: {
            approverRole: 'content_moderator',
            timeoutMs: 86400000, // 24 hours
          },
        },
        priority: 80,
      };

      const result = PolicyRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
    });
  });

  describe('Policy', () => {
    test('validates complete policy', () => {
      const policy: Policy = {
        id: 'policy-1',
        name: 'Content Publishing Policy',
        description: 'Rules governing content publishing across platforms',
        version: 1,
        status: 'active',
        clientId: 'client-123',
        rules: [
          {
            id: 'rule-1',
            name: 'Allow all for premium',
            effect: 'allow',
            actions: ['publish', 'schedule'],
            resources: ['platform:*'],
            conditions: [
              { type: 'field', field: 'client.tier', operator: 'equals', value: 'premium' },
            ],
            priority: 100,
          },
        ],
        defaultEffect: 'deny',
        metadata: {
          createdBy: 'admin',
          lastReviewedAt: new Date().toISOString(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = PolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    });

    test('validates global policy (no clientId)', () => {
      const policy: Policy = {
        id: 'policy-global-1',
        name: 'Global Safety Policy',
        description: 'Platform-wide safety rules',
        version: 1,
        status: 'active',
        scope: 'global',
        rules: [
          {
            id: 'rule-1',
            name: 'Block harmful content',
            effect: 'deny',
            actions: ['publish'],
            resources: ['content:*'],
            conditions: [
              { type: 'field', field: 'content.is_harmful', operator: 'equals', value: true },
            ],
            priority: 10000,
          },
        ],
        defaultEffect: 'allow',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = PolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    });
  });

  describe('createPolicy helper', () => {
    test('creates policy with defaults', () => {
      const policy = createPolicy({
        name: 'Test Policy',
        rules: [
          {
            name: 'Test Rule',
            effect: 'allow',
            actions: ['test'],
            resources: ['test:*'],
            conditions: [],
            priority: 50,
          },
        ],
      });

      expect(policy.id).toBeDefined();
      expect(policy.version).toBe(1);
      expect(policy.status).toBe('draft');
      expect(policy.defaultEffect).toBe('deny');
    });
  });

  describe('validatePolicy', () => {
    test('validates policy structure', () => {
      const policy = createPolicy({
        name: 'Test Policy',
        rules: [
          {
            name: 'Test Rule',
            effect: 'allow',
            actions: ['test'],
            resources: ['test:*'],
            conditions: [],
            priority: 50,
          },
        ],
      });

      const result = validatePolicy(policy);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detects conflicting rules', () => {
      const policy = createPolicy({
        name: 'Conflicting Policy',
        rules: [
          {
            name: 'Allow all',
            effect: 'allow',
            actions: ['publish'],
            resources: ['platform:instagram'],
            conditions: [],
            priority: 50,
          },
          {
            name: 'Deny all',
            effect: 'deny',
            actions: ['publish'],
            resources: ['platform:instagram'],
            conditions: [],
            priority: 50, // Same priority = conflict
          },
        ],
      });

      const result = validatePolicy(policy);
      expect(result.warnings?.some((w) => w.includes('conflict'))).toBe(true);
    });

    test('warns about unreachable rules', () => {
      const policy = createPolicy({
        name: 'Unreachable Rule Policy',
        rules: [
          {
            name: 'Deny all first',
            effect: 'deny',
            actions: ['*'],
            resources: ['*'],
            conditions: [],
            priority: 1000,
          },
          {
            name: 'Allow specific (unreachable)',
            effect: 'allow',
            actions: ['publish'],
            resources: ['platform:instagram'],
            conditions: [],
            priority: 50,
          },
        ],
      });

      const result = validatePolicy(policy);
      expect(result.warnings?.some((w) => w.includes('unreachable'))).toBe(true);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Policy Types

**File: `packages/policy/src/schema/types.ts`**

```typescript
/**
 * Policy Schema Type Definitions
 *
 * Declarative policy definitions for the policy engine.
 */

import { z } from 'zod';

// =====================
// Operators
// =====================

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
  'not_contains',
  'starts_with',
  'ends_with',
  'matches', // regex
  'between',
]);

export type ComparisonOperator = z.infer<typeof ComparisonOperatorSchema>;

export const CompoundOperatorSchema = z.enum(['and', 'or', 'not']);
export type CompoundOperator = z.infer<typeof CompoundOperatorSchema>;

// =====================
// Conditions
// =====================

export const FieldConditionSchema = z.object({
  type: z.literal('field'),
  field: z.string(), // Dot notation: "client.tier", "action.platform"
  operator: ComparisonOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.record(z.unknown())]),
});

export type FieldCondition = z.infer<typeof FieldConditionSchema>;

export const TimeConditionSchema = z.object({
  type: z.literal('time'),
  field: z.string().default('request.timestamp'),
  operator: z.enum(['between', 'after', 'before', 'day_of_week']),
  value: z.union([
    z.object({
      start: z.string(),
      end: z.string(),
      timezone: z.string().optional(),
    }),
    z.string(),
    z.array(z.number()), // Days of week [0-6]
  ]),
});

export type TimeCondition = z.infer<typeof TimeConditionSchema>;

export const RateLimitConditionSchema = z.object({
  type: z.literal('rate_limit'),
  key: z.string(), // "client.id", "client.id:action.type"
  maxRequests: z.number().int().positive(),
  windowMs: z.number().int().positive(),
});

export type RateLimitCondition = z.infer<typeof RateLimitConditionSchema>;

// Forward declaration for recursive type
export const CompoundConditionSchema: z.ZodType<CompoundCondition> = z.lazy(() =>
  z.object({
    type: z.literal('compound'),
    operator: CompoundOperatorSchema,
    conditions: z.array(PolicyConditionSchema),
  })
);

export interface CompoundCondition {
  type: 'compound';
  operator: CompoundOperator;
  conditions: PolicyCondition[];
}

export const PolicyConditionSchema = z.union([
  FieldConditionSchema,
  TimeConditionSchema,
  RateLimitConditionSchema,
  CompoundConditionSchema,
]);

export type PolicyCondition = z.infer<typeof PolicyConditionSchema>;

// =====================
// Effects
// =====================

export const PolicyEffectSchema = z.enum(['allow', 'deny']);
export type PolicyEffect = z.infer<typeof PolicyEffectSchema>;

// =====================
// Constraints
// =====================

export const RateLimitConstraintSchema = z.object({
  maxRequests: z.number().int().positive(),
  windowMs: z.number().int().positive(),
  keyTemplate: z.string().optional(), // "{client.id}:{action.type}"
});

export const ApprovalConstraintSchema = z.object({
  approverRole: z.string(),
  timeoutMs: z.number().int().positive(),
  autoApprove: z.boolean().optional(),
  notifyChannels: z.array(z.string()).optional(),
});

export const BudgetConstraintSchema = z.object({
  maxTokens: z.number().int().positive().optional(),
  maxCost: z.number().positive().optional(),
  maxDuration: z.number().int().positive().optional(),
});

export const PolicyConstraintsSchema = z.object({
  rateLimit: RateLimitConstraintSchema.optional(),
  requireApproval: ApprovalConstraintSchema.optional(),
  budget: BudgetConstraintSchema.optional(),
  cooldown: z.number().int().positive().optional(), // Minimum time between actions
});

export type PolicyConstraints = z.infer<typeof PolicyConstraintsSchema>;

// =====================
// Rules
// =====================

export const PolicyRuleSchema = z.object({
  /** Unique rule identifier */
  id: z.string().optional(),

  /** Human-readable name */
  name: z.string(),

  /** Description of what this rule does */
  description: z.string().optional(),

  /** Effect when rule matches */
  effect: PolicyEffectSchema,

  /** Actions this rule applies to (glob patterns allowed) */
  actions: z.array(z.string()),

  /** Resources this rule applies to (glob patterns allowed) */
  resources: z.array(z.string()),

  /** Conditions that must be true for rule to apply */
  conditions: z.array(PolicyConditionSchema),

  /** Additional constraints when rule allows */
  constraints: PolicyConstraintsSchema.optional(),

  /** Priority (higher = evaluated first) */
  priority: z.number().int().min(0).max(10000),

  /** Whether rule is currently active */
  enabled: z.boolean().default(true),

  /** Metadata for tracking */
  metadata: z.record(z.unknown()).optional(),
});

export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

// =====================
// Policy
// =====================

export const PolicyStatusSchema = z.enum(['draft', 'active', 'deprecated', 'archived']);
export type PolicyStatus = z.infer<typeof PolicyStatusSchema>;

export const PolicyScopeSchema = z.enum(['global', 'client', 'agent']);
export type PolicyScope = z.infer<typeof PolicyScopeSchema>;

export const PolicySchema = z.object({
  /** Unique policy identifier */
  id: z.string(),

  /** Human-readable name */
  name: z.string(),

  /** Description of policy purpose */
  description: z.string().optional(),

  /** Version number (increments on update) */
  version: z.number().int().positive(),

  /** Current status */
  status: PolicyStatusSchema,

  /** Scope of policy */
  scope: PolicyScopeSchema.default('client'),

  /** Client ID (for client-scoped policies) */
  clientId: z.string().optional(),

  /** Agent types this policy applies to */
  agentTypes: z.array(z.string()).optional(),

  /** Policy rules */
  rules: z.array(PolicyRuleSchema),

  /** Default effect when no rules match */
  defaultEffect: PolicyEffectSchema,

  /** Inherit from these policies */
  inherits: z.array(z.string()).optional(),

  /** Policy metadata */
  metadata: z.record(z.unknown()).optional(),

  /** Creation timestamp */
  createdAt: z.date(),

  /** Last update timestamp */
  updatedAt: z.date(),

  /** Effective date (when policy becomes active) */
  effectiveAt: z.date().optional(),

  /** Expiration date */
  expiresAt: z.date().optional(),
});

export type Policy = z.infer<typeof PolicySchema>;

// =====================
// Input Types
// =====================

export type CreatePolicyInput = Omit<
  Policy,
  'id' | 'version' | 'status' | 'createdAt' | 'updatedAt'
> & {
  rules: Array<Omit<PolicyRule, 'id'>>;
};

export type UpdatePolicyInput = Partial<Omit<Policy, 'id' | 'createdAt'>>;

// =====================
// Validation Result
// =====================

export interface PolicyValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}
```

#### Step 2: Implement Policy Helpers

**File: `packages/policy/src/schema/helpers.ts`**

```typescript
/**
 * Policy Schema Helpers
 *
 * Utility functions for creating and validating policies.
 */

import { nanoid } from 'nanoid';
import {
  PolicySchema,
  type Policy,
  type PolicyRule,
  type CreatePolicyInput,
  type PolicyValidationResult,
} from './types';

/**
 * Create a new policy with defaults
 */
export function createPolicy(input: Partial<CreatePolicyInput> & { name: string; rules: Array<Omit<PolicyRule, 'id'>> }): Policy {
  const now = new Date();

  // Add IDs to rules
  const rulesWithIds: PolicyRule[] = input.rules.map((rule, index) => ({
    ...rule,
    id: rule.id ?? `rule-${nanoid(8)}`,
    enabled: rule.enabled ?? true,
  }));

  return {
    id: `policy-${nanoid()}`,
    name: input.name,
    description: input.description,
    version: 1,
    status: 'draft',
    scope: input.scope ?? 'client',
    clientId: input.clientId,
    agentTypes: input.agentTypes,
    rules: rulesWithIds,
    defaultEffect: input.defaultEffect ?? 'deny',
    inherits: input.inherits,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
    effectiveAt: input.effectiveAt,
    expiresAt: input.expiresAt,
  };
}

/**
 * Validate a policy for correctness and potential issues
 */
export function validatePolicy(policy: Policy): PolicyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate against schema
  const schemaResult = PolicySchema.safeParse(policy);
  if (!schemaResult.success) {
    errors.push(...schemaResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
    return { valid: false, errors, warnings };
  }

  // Check for empty rules
  if (policy.rules.length === 0) {
    warnings.push('Policy has no rules; default effect will always apply');
  }

  // Check for conflicting rules (same priority, same conditions, different effects)
  const rulesByPriority = new Map<number, PolicyRule[]>();
  for (const rule of policy.rules) {
    const existing = rulesByPriority.get(rule.priority) ?? [];
    existing.push(rule);
    rulesByPriority.set(rule.priority, existing);
  }

  for (const [priority, rules] of rulesByPriority) {
    if (rules.length > 1) {
      // Check for overlapping actions/resources
      for (let i = 0; i < rules.length; i++) {
        for (let j = i + 1; j < rules.length; j++) {
          const r1 = rules[i];
          const r2 = rules[j];

          const actionsOverlap = hasOverlap(r1.actions, r2.actions);
          const resourcesOverlap = hasOverlap(r1.resources, r2.resources);

          if (actionsOverlap && resourcesOverlap && r1.effect !== r2.effect) {
            warnings.push(
              `Potential conflict between rules "${r1.name}" and "${r2.name}" at priority ${priority}`
            );
          }
        }
      }
    }
  }

  // Check for unreachable rules
  const sortedRules = [...policy.rules].sort((a, b) => b.priority - a.priority);
  for (let i = 1; i < sortedRules.length; i++) {
    const higherRule = sortedRules[i - 1];
    const lowerRule = sortedRules[i];

    // If a higher priority rule denies all with no conditions, lower rules may be unreachable
    if (
      higherRule.effect === 'deny' &&
      higherRule.actions.includes('*') &&
      higherRule.resources.includes('*') &&
      higherRule.conditions.length === 0
    ) {
      warnings.push(
        `Rule "${lowerRule.name}" may be unreachable due to higher priority rule "${higherRule.name}"`
      );
    }
  }

  // Check for missing conditions on allow rules
  for (const rule of policy.rules) {
    if (rule.effect === 'allow' && rule.conditions.length === 0) {
      if (rule.actions.includes('*') || rule.resources.includes('*')) {
        warnings.push(
          `Rule "${rule.name}" allows broad access without conditions; consider adding constraints`
        );
      }
    }
  }

  // Check client-scoped policy has clientId
  if (policy.scope === 'client' && !policy.clientId) {
    warnings.push('Client-scoped policy should have clientId set');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Check if two pattern arrays have overlap
 */
function hasOverlap(patterns1: string[], patterns2: string[]): boolean {
  for (const p1 of patterns1) {
    for (const p2 of patterns2) {
      if (patternsMatch(p1, p2)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if two patterns can match the same value
 */
function patternsMatch(p1: string, p2: string): boolean {
  // Wildcard matches everything
  if (p1 === '*' || p2 === '*') return true;

  // Exact match
  if (p1 === p2) return true;

  // Prefix wildcards
  if (p1.endsWith('*') && p2.startsWith(p1.slice(0, -1))) return true;
  if (p2.endsWith('*') && p1.startsWith(p2.slice(0, -1))) return true;

  return false;
}

/**
 * Merge multiple policies (for inheritance)
 */
export function mergePolicies(base: Policy, override: Policy): Policy {
  // Override rules replace base rules with same ID
  const baseRulesById = new Map(base.rules.map((r) => [r.id, r]));

  for (const rule of override.rules) {
    if (rule.id) {
      baseRulesById.set(rule.id, rule);
    }
  }

  return {
    ...base,
    ...override,
    rules: Array.from(baseRulesById.values()),
    inherits: [...(base.inherits ?? []), base.id],
    version: override.version,
    updatedAt: new Date(),
  };
}

/**
 * Clone a policy for editing
 */
export function clonePolicy(policy: Policy): Policy {
  return {
    ...policy,
    id: `policy-${nanoid()}`,
    version: 1,
    status: 'draft',
    rules: policy.rules.map((rule) => ({
      ...rule,
      id: `rule-${nanoid(8)}`,
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
```

#### Step 3: Create Module Index

**File: `packages/policy/src/schema/index.ts`**

```typescript
/**
 * Policy Schema
 *
 * Declarative policy definitions for the policy engine.
 */

export {
  // Schemas
  PolicySchema,
  PolicyRuleSchema,
  PolicyConditionSchema,
  PolicyEffectSchema,
  PolicyStatusSchema,
  PolicyScopeSchema,
  PolicyConstraintsSchema,
  FieldConditionSchema,
  TimeConditionSchema,
  RateLimitConditionSchema,
  CompoundConditionSchema,
  ComparisonOperatorSchema,
  CompoundOperatorSchema,
} from './types';

export type {
  // Core types
  Policy,
  PolicyRule,
  PolicyCondition,
  PolicyEffect,
  PolicyStatus,
  PolicyScope,
  PolicyConstraints,

  // Condition types
  FieldCondition,
  TimeCondition,
  RateLimitCondition,
  CompoundCondition,
  ComparisonOperator,
  CompoundOperator,

  // Input types
  CreatePolicyInput,
  UpdatePolicyInput,

  // Validation
  PolicyValidationResult,
} from './types';

export {
  createPolicy,
  validatePolicy,
  mergePolicies,
  clonePolicy,
} from './helpers';
```

#### Step 4: Create Main Package Index

**File: `packages/policy/src/index.ts`**

```typescript
/**
 * @rtv/policy - Policy Engine
 *
 * Declarative policy definitions, evaluation, and enforcement.
 */

export * from './schema';
```

#### Step 5: Package Configuration

**File: `packages/policy/package.json`**

```json
{
  "name": "@rtv/policy",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "nanoid": "^5.0.0",
    "zod": "^3.22.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@rtv/tsconfig": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

### Phase 3: Verification

```bash
cd packages/policy

# Install dependencies
pnpm install

# Build
pnpm build

# Typecheck
pnpm typecheck

# Run tests
pnpm test

# Manual verification
cat > verify-schema.ts << 'EOF'
import { createPolicy, validatePolicy, type Policy } from './src/schema';

// Create a policy
const policy = createPolicy({
  name: 'Content Publishing Policy',
  description: 'Rules for content publishing',
  clientId: 'client-123',
  rules: [
    {
      name: 'Deny suspended clients',
      effect: 'deny',
      actions: ['*'],
      resources: ['*'],
      conditions: [
        { type: 'field', field: 'client.status', operator: 'equals', value: 'suspended' },
      ],
      priority: 1000,
    },
    {
      name: 'Allow premium publishing',
      effect: 'allow',
      actions: ['publish', 'schedule'],
      resources: ['platform:*'],
      conditions: [
        { type: 'field', field: 'client.tier', operator: 'equals', value: 'premium' },
      ],
      priority: 100,
    },
    {
      name: 'Rate limit basic tier',
      effect: 'allow',
      actions: ['publish'],
      resources: ['platform:*'],
      conditions: [
        { type: 'field', field: 'client.tier', operator: 'equals', value: 'basic' },
      ],
      constraints: {
        rateLimit: {
          maxRequests: 10,
          windowMs: 3600000,
        },
      },
      priority: 50,
    },
  ],
  defaultEffect: 'deny',
});

console.log('Created policy:', policy.id);
console.log('Rules:', policy.rules.length);

// Validate
const validation = validatePolicy(policy);
console.log('\nValidation:', validation.valid ? 'PASSED' : 'FAILED');
if (validation.errors.length) console.log('Errors:', validation.errors);
if (validation.warnings?.length) console.log('Warnings:', validation.warnings);
EOF

npx tsx verify-schema.ts
rm verify-schema.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/policy/package.json` | Package configuration |
| Create | `packages/policy/src/index.ts` | Main exports |
| Create | `packages/policy/src/schema/types.ts` | Type definitions |
| Create | `packages/policy/src/schema/helpers.ts` | Helper functions |
| Create | `packages/policy/src/schema/index.ts` | Module exports |
| Create | `packages/policy/src/__tests__/schema.test.ts` | Unit tests |

---

## Acceptance Criteria

- [ ] `PolicyConditionSchema` validates all condition types
- [ ] `PolicyRuleSchema` validates rules with effects and constraints
- [ ] `PolicySchema` validates complete policies
- [ ] `createPolicy()` generates policy with defaults
- [ ] `validatePolicy()` detects schema errors
- [ ] `validatePolicy()` warns about conflicts
- [ ] `validatePolicy()` warns about unreachable rules
- [ ] Compound conditions (AND/OR/NOT) work correctly
- [ ] Tests pass with >80% coverage

---

## Test Requirements

### Unit Tests

- All condition types
- Rule validation
- Policy validation
- Conflict detection
- Unreachable rule detection

### Integration Tests

- Policy inheritance (mergePolicies)
- Policy cloning

---

## Security & Safety Checklist

- [ ] No secrets in policy definitions
- [ ] Deny rules evaluated before allow
- [ ] Default effect is deny
- [ ] Rate limits enforced at schema level

---

## JSON Task Block

```json
{
  "task_id": "S1-C1",
  "name": "Policy Definition Schema",
  "sprint": 1,
  "agent": "C",
  "status": "pending",
  "complexity": "high",
  "estimated_hours": 5,
  "dependencies": ["S0-A3"],
  "blocks": ["S1-C2", "S1-C3", "S1-C4", "S1-C5"],
  "tags": ["policy", "schema", "security"],
  "acceptance_criteria": [
    "all condition types validated",
    "rule validation",
    "policy validation",
    "conflict detection",
    "unreachable rule detection"
  ],
  "created_at": "2025-01-16T00:00:00Z",
  "updated_at": null,
  "completed_at": null
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "agent_id": null,
  "decisions": [],
  "artifacts": [],
  "notes": []
}
```

---

## Next Steps

After completing this task:

1. **S1-C2**: Implement approval gate framework
2. **S1-C3**: Build kill switch infrastructure
3. **S1-C4**: Add rate limiting policies
