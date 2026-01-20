/**
 * @rtv/policy - Policy Helper Functions
 *
 * Utility functions for creating, validating, and manipulating policies.
 */

import { nanoid } from 'nanoid';
import {
  PolicySchema,
  PolicyInputSchema,
} from './index.js';
import type {
  Policy,
  PolicyInput,
  PolicyRule,
  PolicyRuleInput,
  PolicyValidationResult,
  PolicyValidationError,
  PolicyValidationWarning,
  PolicyCondition,
} from './types.js';

// ============================================================================
// Policy Creation
// ============================================================================

/**
 * Creates a new policy with defaults and generated IDs.
 *
 * @param input - Partial policy input
 * @returns Complete policy with all required fields
 */
export function createPolicy(input: PolicyInput): Policy {
  const now = new Date();

  // Generate rule IDs for any rules without them
  const rules: PolicyRule[] = (input.rules ?? []).map((ruleInput) =>
    createPolicyRule(ruleInput)
  );

  const policy: Policy = {
    id: input.id ?? `pol_${nanoid(12)}`,
    name: input.name,
    description: input.description,
    version: input.version ?? 1,
    status: input.status ?? 'draft',
    scope: input.scope ?? 'global',
    clientId: input.clientId,
    agentId: input.agentId,
    rules,
    defaultEffect: input.defaultEffect ?? 'deny',
    createdAt: now,
    updatedAt: now,
  };

  return policy;
}

/**
 * Creates a policy rule with defaults and generated ID.
 *
 * @param input - Partial rule input
 * @returns Complete rule with all required fields
 */
export function createPolicyRule(input: PolicyRuleInput): PolicyRule {
  return {
    id: input.id ?? `rule_${nanoid(12)}`,
    name: input.name,
    description: input.description,
    effect: input.effect,
    actions: input.actions,
    resources: input.resources,
    conditions: input.conditions ?? [],
    constraints: input.constraints,
    priority: input.priority ?? 0,
    enabled: input.enabled ?? true,
  };
}

// ============================================================================
// Policy Validation
// ============================================================================

/**
 * Validates a policy against the schema and checks for semantic issues.
 *
 * @param policy - Policy to validate
 * @returns Validation result with errors and warnings
 */
export function validatePolicy(policy: unknown): PolicyValidationResult {
  const errors: PolicyValidationError[] = [];
  const warnings: PolicyValidationWarning[] = [];

  // Schema validation using Zod safeParse
  const parseResult = PolicySchema.safeParse(policy);

  if (!parseResult.success) {
    // Convert Zod errors to our error format
    for (const issue of parseResult.error.issues) {
      errors.push({
        path: issue.path.join('.') || '$',
        message: issue.message,
        code: `SCHEMA_${issue.code.toUpperCase()}`,
      });
    }

    return {
      valid: false,
      errors,
      warnings,
    };
  }

  // Semantic validation on the parsed policy
  // Cast to Policy type since we've validated the schema
  const validPolicy = parseResult.data as unknown as Policy;

  // Check for rule conflicts
  const ruleConflicts = detectRuleConflicts(validPolicy.rules);
  warnings.push(...ruleConflicts);

  // Check for unreachable rules
  const unreachableRules = detectUnreachableRules(validPolicy.rules);
  warnings.push(...unreachableRules);

  // Check for duplicate rule names
  const duplicateNames = detectDuplicateRuleNames(validPolicy.rules);
  warnings.push(...duplicateNames);

  // Check for empty conditions with broad patterns
  const broadPatterns = detectBroadPatterns(validPolicy.rules);
  warnings.push(...broadPatterns);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Detects potential conflicts between rules with the same priority.
 */
function detectRuleConflicts(rules: PolicyRule[]): PolicyValidationWarning[] {
  const warnings: PolicyValidationWarning[] = [];

  // Group rules by priority
  const rulesByPriority = new Map<number, PolicyRule[]>();
  for (const rule of rules) {
    const existing = rulesByPriority.get(rule.priority) ?? [];
    existing.push(rule);
    rulesByPriority.set(rule.priority, existing);
  }

  // Check for conflicts at each priority level
  for (const [priority, rulesAtPriority] of rulesByPriority) {
    if (rulesAtPriority.length < 2) continue;

    // Check for overlapping action/resource patterns with different effects
    for (let i = 0; i < rulesAtPriority.length; i++) {
      for (let j = i + 1; j < rulesAtPriority.length; j++) {
        const rule1 = rulesAtPriority[i];
        const rule2 = rulesAtPriority[j];

        if (!rule1 || !rule2) continue;

        if (
          rule1.effect !== rule2.effect &&
          patternsOverlap(rule1.actions, rule2.actions) &&
          patternsOverlap(rule1.resources, rule2.resources)
        ) {
          warnings.push({
            path: `rules`,
            message: `Potential conflict between rules "${rule1.name}" and "${rule2.name}" at priority ${priority}: overlapping patterns with different effects`,
            code: 'RULE_CONFLICT',
          });
        }
      }
    }
  }

  return warnings;
}

/**
 * Detects rules that may be unreachable due to higher-priority rules.
 */
function detectUnreachableRules(rules: PolicyRule[]): PolicyValidationWarning[] {
  const warnings: PolicyValidationWarning[] = [];

  // Sort rules by priority (descending)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (let i = 0; i < sortedRules.length; i++) {
    const rule = sortedRules[i];
    if (!rule) continue;

    // Check if any higher-priority rule would always match first
    for (let j = 0; j < i; j++) {
      const higherRule = sortedRules[j];
      if (!higherRule) continue;

      // A rule is unreachable if a higher-priority rule has:
      // - Same or broader action patterns
      // - Same or broader resource patterns
      // - Same effect (deny/allow)
      // - No conditions (always matches) or subset conditions
      if (
        rule.effect === higherRule.effect &&
        patternSubset(rule.actions, higherRule.actions) &&
        patternSubset(rule.resources, higherRule.resources) &&
        higherRule.conditions.length === 0
      ) {
        warnings.push({
          path: `rules[${rules.indexOf(rule)}]`,
          message: `Rule "${rule.name}" may be unreachable: higher-priority rule "${higherRule.name}" would match first`,
          code: 'UNREACHABLE_RULE',
        });
      }
    }
  }

  return warnings;
}

/**
 * Detects duplicate rule names.
 */
function detectDuplicateRuleNames(rules: PolicyRule[]): PolicyValidationWarning[] {
  const warnings: PolicyValidationWarning[] = [];
  const seenNames = new Map<string, number>();

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;

    const prevIndex = seenNames.get(rule.name);
    if (prevIndex !== undefined) {
      warnings.push({
        path: `rules[${i}].name`,
        message: `Duplicate rule name "${rule.name}" (also at rules[${prevIndex}])`,
        code: 'DUPLICATE_RULE_NAME',
      });
    }
    seenNames.set(rule.name, i);
  }

  return warnings;
}

/**
 * Detects rules with broad patterns (wildcards) and no conditions.
 */
function detectBroadPatterns(rules: PolicyRule[]): PolicyValidationWarning[] {
  const warnings: PolicyValidationWarning[] = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;

    const hasWildcardAction = rule.actions.some((a) => a === '*' || a.includes('*'));
    const hasWildcardResource = rule.resources.some((r) => r === '*' || r.includes('*'));
    const hasNoConditions = rule.conditions.length === 0;

    if (hasWildcardAction && hasWildcardResource && hasNoConditions) {
      warnings.push({
        path: `rules[${i}]`,
        message: `Rule "${rule.name}" uses wildcards for both actions and resources with no conditions - consider adding conditions to narrow scope`,
        code: 'BROAD_PATTERN',
      });
    }
  }

  return warnings;
}

/**
 * Checks if two pattern arrays have any overlap.
 */
function patternsOverlap(patterns1: string[], patterns2: string[]): boolean {
  for (const p1 of patterns1) {
    for (const p2 of patterns2) {
      if (patternMatches(p1, p2) || patternMatches(p2, p1)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if pattern1 is a subset of pattern2 (pattern2 is broader).
 */
function patternSubset(patterns1: string[], patterns2: string[]): boolean {
  return patterns1.every((p1) =>
    patterns2.some((p2) => patternMatches(p1, p2))
  );
}

/**
 * Checks if a specific pattern matches against a potentially broader pattern.
 * Simple wildcard matching: * matches anything.
 */
function patternMatches(specific: string, broad: string): boolean {
  if (broad === '*') return true;
  if (specific === broad) return true;

  // Handle glob-style wildcards
  const regex = new RegExp(
    '^' + broad.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  );
  return regex.test(specific);
}

// ============================================================================
// Policy Manipulation
// ============================================================================

/**
 * Merges two policies, with the override policy taking precedence.
 * Rules are combined with override rules added at higher priority.
 *
 * @param base - Base policy
 * @param override - Override policy (takes precedence)
 * @returns Merged policy
 */
export function mergePolicies(base: Policy, override: Partial<PolicyInput>): Policy {
  const now = new Date();

  // Calculate max priority from base rules
  const maxBasePriority = base.rules.reduce(
    (max, rule) => Math.max(max, rule.priority),
    0
  );

  // Create override rules with adjusted priorities
  const overrideRules: PolicyRule[] = (override.rules ?? []).map((ruleInput, index) =>
    createPolicyRule({
      ...ruleInput,
      priority: ruleInput.priority ?? maxBasePriority + index + 1,
    })
  );

  // Merge rules: override rules first (higher priority), then base rules
  const mergedRules = [...overrideRules, ...base.rules];

  return {
    ...base,
    name: override.name ?? base.name,
    description: override.description ?? base.description,
    version: base.version + 1,
    status: override.status ?? base.status,
    scope: override.scope ?? base.scope,
    clientId: override.clientId ?? base.clientId,
    agentId: override.agentId ?? base.agentId,
    rules: mergedRules,
    defaultEffect: override.defaultEffect ?? base.defaultEffect,
    updatedAt: now,
  };
}

/**
 * Creates a deep clone of a policy, optionally with a new ID.
 *
 * @param policy - Policy to clone
 * @param newId - Optional new ID for the clone
 * @returns Cloned policy
 */
export function clonePolicy(policy: Policy, newId?: string): Policy {
  const now = new Date();

  // Deep clone rules with new IDs
  const clonedRules: PolicyRule[] = policy.rules.map((rule) => ({
    ...rule,
    id: `rule_${nanoid(12)}`,
    conditions: deepCloneConditions(rule.conditions),
    constraints: rule.constraints ? { ...rule.constraints } : undefined,
  }));

  return {
    ...policy,
    id: newId ?? `pol_${nanoid(12)}`,
    version: 1,
    status: 'draft',
    rules: clonedRules,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Deep clones an array of conditions.
 */
function deepCloneConditions(conditions: PolicyCondition[]): PolicyCondition[] {
  return conditions.map((condition) => {
    if (condition.type === 'compound') {
      return {
        ...condition,
        conditions: deepCloneConditions(condition.conditions),
      };
    }
    return { ...condition };
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validates policy input before creation.
 *
 * @param input - Policy input to validate
 * @returns Validation result
 */
export function validatePolicyInput(input: unknown): PolicyValidationResult {
  const errors: PolicyValidationError[] = [];
  const warnings: PolicyValidationWarning[] = [];

  const parseResult = PolicyInputSchema.safeParse(input);

  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        path: issue.path.join('.') || '$',
        message: issue.message,
        code: `SCHEMA_${issue.code.toUpperCase()}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sorts policy rules by priority (descending).
 *
 * @param rules - Rules to sort
 * @returns Sorted rules
 */
export function sortRulesByPriority(rules: PolicyRule[]): PolicyRule[] {
  return [...rules].sort((a, b) => b.priority - a.priority);
}

/**
 * Filters enabled rules only.
 *
 * @param rules - Rules to filter
 * @returns Only enabled rules
 */
export function getEnabledRules(rules: PolicyRule[]): PolicyRule[] {
  return rules.filter((rule) => rule.enabled !== false);
}
