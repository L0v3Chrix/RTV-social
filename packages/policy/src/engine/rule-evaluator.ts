/**
 * Rule Evaluator
 *
 * Evaluates policy rules against evaluation contexts.
 * Handles pattern matching, condition evaluation, and priority sorting.
 */

import type {
  PolicyRule,
  PolicyCondition,
  FieldCondition,
  TimeCondition,
  CompoundCondition,
  TimeRangeValue,
  ComparisonOperator,
} from '../schema/types.js';
import type {
  EvaluationContext,
  RuleMatchResult,
  ConditionResult,
} from './types.js';

// ============================================================================
// Rule Evaluator Interface
// ============================================================================

/**
 * Rule evaluator interface for testing and dependency injection.
 */
export interface RuleEvaluator {
  /**
   * Evaluate a rule against a context.
   */
  evaluateRule(rule: PolicyRule, context: EvaluationContext): RuleMatchResult;

  /**
   * Find the first matching rule from a list (sorted by priority).
   */
  findMatchingRule(
    rules: PolicyRule[],
    context: EvaluationContext
  ): RuleMatchResult | null;

  /**
   * Find all matching rules from a list (sorted by priority).
   */
  findAllMatchingRules(
    rules: PolicyRule[],
    context: EvaluationContext
  ): RuleMatchResult[];

  /**
   * Sort rules by priority (highest first).
   */
  sortByPriority(rules: PolicyRule[]): PolicyRule[];
}

// ============================================================================
// Rule Evaluator Implementation
// ============================================================================

/**
 * Creates a new rule evaluator instance.
 */
export function createRuleEvaluator(): RuleEvaluator {
  return {
    evaluateRule,
    findMatchingRule,
    findAllMatchingRules,
    sortByPriority,
  };
}

/**
 * Evaluates a single rule against a context.
 */
function evaluateRule(
  rule: PolicyRule,
  context: EvaluationContext
): RuleMatchResult {
  const startTime = performance.now();

  // Skip disabled rules
  if (rule.enabled === false) {
    return {
      matched: false,
      rule,
      matchedAction: null,
      matchedResource: null,
      conditionResults: [],
      matchDurationMs: performance.now() - startTime,
    };
  }

  // Check action patterns
  const matchedAction = findMatchingPattern(context.action, rule.actions);
  if (!matchedAction) {
    return {
      matched: false,
      rule,
      matchedAction: null,
      matchedResource: null,
      conditionResults: [],
      matchDurationMs: performance.now() - startTime,
    };
  }

  // Check resource patterns
  const matchedResource = findMatchingPattern(context.resource, rule.resources);
  if (!matchedResource) {
    return {
      matched: false,
      rule,
      matchedAction,
      matchedResource: null,
      conditionResults: [],
      matchDurationMs: performance.now() - startTime,
    };
  }

  // Evaluate conditions
  const conditionResults: ConditionResult[] = [];
  let allConditionsPassed = true;

  for (const condition of rule.conditions) {
    const result = evaluateCondition(condition, context);
    conditionResults.push(result);
    if (!result.passed) {
      allConditionsPassed = false;
      // Continue evaluating for debugging purposes
    }
  }

  return {
    matched: allConditionsPassed,
    rule,
    matchedAction,
    matchedResource,
    conditionResults,
    matchDurationMs: performance.now() - startTime,
  };
}

/**
 * Finds the first matching rule from a sorted list.
 */
function findMatchingRule(
  rules: PolicyRule[],
  context: EvaluationContext
): RuleMatchResult | null {
  const sortedRules = sortByPriority(rules);

  for (const rule of sortedRules) {
    const result = evaluateRule(rule, context);
    if (result.matched) {
      return result;
    }
  }

  return null;
}

/**
 * Finds all matching rules from a list.
 */
function findAllMatchingRules(
  rules: PolicyRule[],
  context: EvaluationContext
): RuleMatchResult[] {
  const sortedRules = sortByPriority(rules);
  const matches: RuleMatchResult[] = [];

  for (const rule of sortedRules) {
    const result = evaluateRule(rule, context);
    if (result.matched) {
      matches.push(result);
    }
  }

  return matches;
}

/**
 * Sorts rules by priority (highest priority first).
 */
function sortByPriority(rules: PolicyRule[]): PolicyRule[] {
  return [...rules].sort((a, b) => b.priority - a.priority);
}

// ============================================================================
// Pattern Matching
// ============================================================================

/**
 * Finds the first matching pattern from a list of patterns.
 * Supports glob-style wildcards (* for any sequence, ? for single char).
 */
function findMatchingPattern(
  value: string,
  patterns: string[]
): string | null {
  for (const pattern of patterns) {
    if (matchPattern(value, pattern)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Matches a value against a glob pattern.
 */
function matchPattern(value: string, pattern: string): boolean {
  // Exact match
  if (pattern === value) {
    return true;
  }

  // Universal wildcard
  if (pattern === '*') {
    return true;
  }

  // Convert glob to regex
  const regexStr =
    '^' +
    pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*') // * matches any sequence
      .replace(/\?/g, '.') + // ? matches single char
    '$';

  try {
    const regex = new RegExp(regexStr);
    return regex.test(value);
  } catch {
    // Invalid pattern, fall back to exact match
    return pattern === value;
  }
}

// ============================================================================
// Condition Evaluation
// ============================================================================

/**
 * Evaluates a condition against a context.
 */
function evaluateCondition(
  condition: PolicyCondition,
  context: EvaluationContext
): ConditionResult {
  switch (condition.type) {
    case 'field':
      return evaluateFieldCondition(condition, context);
    case 'time':
      return evaluateTimeCondition(condition, context);
    case 'compound':
      return evaluateCompoundCondition(condition, context);
    default:
      return {
        condition,
        passed: false,
        actualValue: undefined,
        expectedValue: undefined,
        error: `Unknown condition type: ${(condition as PolicyCondition).type}`,
      };
  }
}

/**
 * Evaluates a field condition.
 */
function evaluateFieldCondition(
  condition: FieldCondition,
  context: EvaluationContext
): ConditionResult {
  const actualValue = getFieldValue(condition.field, context);

  try {
    const passed = evaluateComparison(
      actualValue,
      condition.operator,
      condition.value
    );

    return {
      condition,
      passed,
      actualValue,
      expectedValue: condition.value,
    };
  } catch (error) {
    return {
      condition,
      passed: false,
      actualValue,
      expectedValue: condition.value,
      error: error instanceof Error ? error.message : 'Comparison failed',
    };
  }
}

/**
 * Gets a field value from the context.
 */
function getFieldValue(field: string, context: EvaluationContext): unknown {
  // Check top-level context fields first
  if (field === 'clientId') return context.clientId;
  if (field === 'agentId') return context.agentId;
  if (field === 'action') return context.action;
  if (field === 'resource') return context.resource;
  if (field === 'platform') return context.platform;
  if (field === 'timestamp') return context.timestamp;

  // Check fields map
  if (context.fields && field in context.fields) {
    return context.fields[field];
  }

  // Support nested field access with dot notation
  if (field.includes('.') && context.fields) {
    const parts = field.split('.');
    let value: unknown = context.fields;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  return undefined;
}

/**
 * Evaluates a comparison operation.
 */
function evaluateComparison(
  actual: unknown,
  operator: ComparisonOperator,
  expected: unknown
): boolean {
  switch (operator) {
    case 'equals':
      return actual === expected;

    case 'not_equals':
      return actual !== expected;

    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number'
        ? actual > expected
        : String(actual) > String(expected);

    case 'gte':
      return typeof actual === 'number' && typeof expected === 'number'
        ? actual >= expected
        : String(actual) >= String(expected);

    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number'
        ? actual < expected
        : String(actual) < String(expected);

    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number'
        ? actual <= expected
        : String(actual) <= String(expected);

    case 'in':
      return Array.isArray(expected) && expected.includes(actual);

    case 'not_in':
      return Array.isArray(expected) && !expected.includes(actual);

    case 'contains':
      return (
        typeof actual === 'string' &&
        typeof expected === 'string' &&
        actual.includes(expected)
      );

    case 'starts_with':
      return (
        typeof actual === 'string' &&
        typeof expected === 'string' &&
        actual.startsWith(expected)
      );

    case 'ends_with':
      return (
        typeof actual === 'string' &&
        typeof expected === 'string' &&
        actual.endsWith(expected)
      );

    case 'matches':
      if (typeof actual !== 'string' || typeof expected !== 'string') {
        return false;
      }
      try {
        const regex = new RegExp(expected);
        return regex.test(actual);
      } catch {
        return false;
      }

    case 'between':
      if (
        typeof expected === 'object' &&
        expected !== null &&
        'start' in expected &&
        'end' in expected
      ) {
        const { start, end } = expected as { start: unknown; end: unknown };
        if (
          typeof actual === 'number' &&
          typeof start === 'number' &&
          typeof end === 'number'
        ) {
          return actual >= start && actual <= end;
        }
        const actualStr = String(actual);
        return actualStr >= String(start) && actualStr <= String(end);
      }
      return false;

    default:
      return false;
  }
}

// ============================================================================
// Time Condition Evaluation
// ============================================================================

/**
 * Evaluates a time condition.
 */
function evaluateTimeCondition(
  condition: TimeCondition,
  context: EvaluationContext
): ConditionResult {
  const timestamp = context.timestamp ?? new Date();
  const actualValue = getTimeFieldValue(condition.field, timestamp);

  try {
    const passed = evaluateTimeComparison(
      timestamp,
      condition.operator,
      condition.value
    );

    return {
      condition,
      passed,
      actualValue,
      expectedValue: condition.value,
    };
  } catch (error) {
    return {
      condition,
      passed: false,
      actualValue,
      expectedValue: condition.value,
      error: error instanceof Error ? error.message : 'Time comparison failed',
    };
  }
}

/**
 * Gets a time field value from the timestamp.
 */
function getTimeFieldValue(field: string, timestamp: Date): string | number {
  switch (field) {
    case 'current_time':
    case 'time':
      return formatTime(timestamp);
    case 'current_date':
    case 'date':
      return timestamp.toISOString().split('T')[0] ?? '';
    case 'day_of_week':
      return timestamp.getDay();
    case 'hour':
      return timestamp.getHours();
    case 'minute':
      return timestamp.getMinutes();
    default:
      return formatTime(timestamp);
  }
}

/**
 * Formats a timestamp as HH:MM time string.
 */
function formatTime(timestamp: Date): string {
  const hours = timestamp.getHours().toString().padStart(2, '0');
  const minutes = timestamp.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Evaluates a time comparison.
 */
function evaluateTimeComparison(
  timestamp: Date,
  operator: 'between' | 'after' | 'before' | 'day_of_week',
  value: TimeRangeValue | string | number[]
): boolean {
  switch (operator) {
    case 'between': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
      }
      const rangeValue = value as TimeRangeValue;
      const currentTime = formatTime(timestamp);
      const { start, end } = rangeValue;

      // Handle overnight ranges (e.g., 22:00 to 06:00)
      if (start > end) {
        return currentTime >= start || currentTime <= end;
      }
      return currentTime >= start && currentTime <= end;
    }

    case 'after': {
      if (typeof value !== 'string') return false;
      const currentTime = formatTime(timestamp);
      return currentTime > value;
    }

    case 'before': {
      if (typeof value !== 'string') return false;
      const currentTime = formatTime(timestamp);
      return currentTime < value;
    }

    case 'day_of_week': {
      if (!Array.isArray(value)) return false;
      const dayOfWeek = timestamp.getDay();
      return value.includes(dayOfWeek);
    }

    default:
      return false;
  }
}

// ============================================================================
// Compound Condition Evaluation
// ============================================================================

/**
 * Evaluates a compound condition (AND, OR, NOT).
 */
function evaluateCompoundCondition(
  condition: CompoundCondition,
  context: EvaluationContext
): ConditionResult {
  const childResults: ConditionResult[] = [];

  for (const childCondition of condition.conditions) {
    childResults.push(evaluateCondition(childCondition, context));
  }

  let passed: boolean;

  switch (condition.operator) {
    case 'and':
      passed = childResults.every((r) => r.passed);
      break;
    case 'or':
      passed = childResults.some((r) => r.passed);
      break;
    case 'not':
      // NOT applies to the first condition only
      passed = childResults.length > 0 ? !childResults[0]!.passed : false;
      break;
    default:
      passed = false;
  }

  return {
    condition,
    passed,
    actualValue: childResults.map((r) => r.passed),
    expectedValue: condition.operator,
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  evaluateRule,
  findMatchingRule,
  findAllMatchingRules,
  sortByPriority,
  matchPattern,
  evaluateCondition,
  getFieldValue,
};
