/**
 * Policy Engine
 *
 * Main orchestration service for policy evaluation.
 * Coordinates kill switches, rate limits, rules, and approval gates.
 */

// Export types
export * from './types.js';

// Export rule evaluator
export {
  createRuleEvaluator,
  evaluateRule,
  findMatchingRule,
  findAllMatchingRules,
  sortByPriority,
  matchPattern,
  evaluateCondition,
  getFieldValue,
  type RuleEvaluator,
} from './rule-evaluator.js';

// Export policy engine
export {
  createPolicyEngine,
  type CreatePolicyEngineOptions,
} from './policy-engine.js';
