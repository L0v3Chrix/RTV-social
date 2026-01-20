/**
 * Rule Evaluator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRuleEvaluator,
  evaluateRule,
  matchPattern,
  sortByPriority,
  findMatchingRule,
  getFieldValue,
} from '../rule-evaluator.js';
import type { PolicyRule } from '../../schema/types.js';
import type { EvaluationContext } from '../types.js';

describe('Rule Evaluator', () => {
  describe('matchPattern', () => {
    it('should match exact patterns', () => {
      expect(matchPattern('post:publish', 'post:publish')).toBe(true);
      expect(matchPattern('post:publish', 'post:create')).toBe(false);
    });

    it('should match universal wildcard', () => {
      expect(matchPattern('anything', '*')).toBe(true);
      expect(matchPattern('post:publish', '*')).toBe(true);
    });

    it('should match glob patterns with *', () => {
      expect(matchPattern('post:publish', 'post:*')).toBe(true);
      expect(matchPattern('post:create', 'post:*')).toBe(true);
      expect(matchPattern('engage:reply', 'post:*')).toBe(false);
      expect(matchPattern('social:meta:publish', 'social:*')).toBe(true);
    });

    it('should match glob patterns with ?', () => {
      expect(matchPattern('post1', 'post?')).toBe(true);
      expect(matchPattern('post12', 'post?')).toBe(false);
    });

    it('should match complex glob patterns', () => {
      expect(matchPattern('social:meta:publish', 'social:*:publish')).toBe(
        true
      );
      expect(matchPattern('social:meta:create', 'social:*:publish')).toBe(
        false
      );
    });
  });

  describe('sortByPriority', () => {
    it('should sort rules by priority descending', () => {
      const rules: PolicyRule[] = [
        createRule({ name: 'low', priority: 10 }),
        createRule({ name: 'high', priority: 100 }),
        createRule({ name: 'medium', priority: 50 }),
      ];

      const sorted = sortByPriority(rules);

      expect(sorted[0]?.name).toBe('high');
      expect(sorted[1]?.name).toBe('medium');
      expect(sorted[2]?.name).toBe('low');
    });

    it('should not mutate the original array', () => {
      const rules: PolicyRule[] = [
        createRule({ name: 'low', priority: 10 }),
        createRule({ name: 'high', priority: 100 }),
      ];

      sortByPriority(rules);

      expect(rules[0]?.name).toBe('low');
    });
  });

  describe('getFieldValue', () => {
    const context: EvaluationContext = {
      clientId: 'client_123',
      agentId: 'agent_456',
      action: 'post:publish',
      resource: 'social:meta',
      platform: 'facebook',
      fields: {
        author: 'john',
        nested: { deep: { value: 42 } },
      },
    };

    it('should get top-level context fields', () => {
      expect(getFieldValue('clientId', context)).toBe('client_123');
      expect(getFieldValue('agentId', context)).toBe('agent_456');
      expect(getFieldValue('action', context)).toBe('post:publish');
      expect(getFieldValue('platform', context)).toBe('facebook');
    });

    it('should get fields from the fields map', () => {
      expect(getFieldValue('author', context)).toBe('john');
    });

    it('should get nested fields with dot notation', () => {
      expect(getFieldValue('nested.deep.value', context)).toBe(42);
    });

    it('should return undefined for missing fields', () => {
      expect(getFieldValue('nonexistent', context)).toBeUndefined();
      expect(getFieldValue('nested.nonexistent', context)).toBeUndefined();
    });
  });

  describe('evaluateRule', () => {
    const baseContext: EvaluationContext = {
      clientId: 'client_123',
      action: 'post:publish',
      resource: 'social:meta',
      platform: 'facebook',
    };

    it('should match rule with matching action and resource', () => {
      const rule = createRule({
        actions: ['post:publish'],
        resources: ['social:meta'],
      });

      const result = evaluateRule(rule, baseContext);

      expect(result.matched).toBe(true);
      expect(result.matchedAction).toBe('post:publish');
      expect(result.matchedResource).toBe('social:meta');
    });

    it('should not match rule with non-matching action', () => {
      const rule = createRule({
        actions: ['post:create'],
        resources: ['social:meta'],
      });

      const result = evaluateRule(rule, baseContext);

      expect(result.matched).toBe(false);
      expect(result.matchedAction).toBe(null);
    });

    it('should not match disabled rules', () => {
      const rule = createRule({
        actions: ['post:publish'],
        resources: ['social:meta'],
        enabled: false,
      });

      const result = evaluateRule(rule, baseContext);

      expect(result.matched).toBe(false);
    });

    it('should match rules with wildcards', () => {
      const rule = createRule({
        actions: ['post:*'],
        resources: ['social:*'],
      });

      const result = evaluateRule(rule, baseContext);

      expect(result.matched).toBe(true);
    });

    describe('field conditions', () => {
      it('should evaluate equals condition', () => {
        const rule = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            { type: 'field', field: 'platform', operator: 'equals', value: 'facebook' },
          ],
        });

        const result = evaluateRule(rule, baseContext);
        expect(result.matched).toBe(true);
      });

      it('should evaluate not_equals condition', () => {
        const rule = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            { type: 'field', field: 'platform', operator: 'not_equals', value: 'instagram' },
          ],
        });

        const result = evaluateRule(rule, baseContext);
        expect(result.matched).toBe(true);
      });

      it('should evaluate in condition', () => {
        const rule = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            {
              type: 'field',
              field: 'platform',
              operator: 'in',
              value: ['facebook', 'instagram'],
            },
          ],
        });

        const result = evaluateRule(rule, baseContext);
        expect(result.matched).toBe(true);
      });

      it('should evaluate contains condition', () => {
        const context: EvaluationContext = {
          ...baseContext,
          fields: { content: 'Hello world!' },
        };

        const rule = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            { type: 'field', field: 'content', operator: 'contains', value: 'world' },
          ],
        });

        const result = evaluateRule(rule, context);
        expect(result.matched).toBe(true);
      });

      it('should evaluate matches (regex) condition', () => {
        const context: EvaluationContext = {
          ...baseContext,
          fields: { email: 'test@example.com' },
        };

        const rule = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            {
              type: 'field',
              field: 'email',
              operator: 'matches',
              value: '^[a-z]+@example\\.com$',
            },
          ],
        });

        const result = evaluateRule(rule, context);
        expect(result.matched).toBe(true);
      });

      it('should evaluate numeric comparison conditions', () => {
        const context: EvaluationContext = {
          ...baseContext,
          fields: { count: 50 },
        };

        const ruleGt = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            { type: 'field', field: 'count', operator: 'gt', value: 25 },
          ],
        });

        const ruleLt = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            { type: 'field', field: 'count', operator: 'lt', value: 100 },
          ],
        });

        expect(evaluateRule(ruleGt, context).matched).toBe(true);
        expect(evaluateRule(ruleLt, context).matched).toBe(true);
      });
    });

    describe('time conditions', () => {
      it('should evaluate between time condition', () => {
        const context: EvaluationContext = {
          ...baseContext,
          timestamp: new Date('2024-01-15T14:30:00'), // 14:30
        };

        const rule = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            {
              type: 'time',
              field: 'current_time',
              operator: 'between',
              value: { start: '09:00', end: '17:00' },
            },
          ],
        });

        const result = evaluateRule(rule, context);
        expect(result.matched).toBe(true);
      });

      it('should evaluate overnight time range', () => {
        const lateNight: EvaluationContext = {
          ...baseContext,
          timestamp: new Date('2024-01-15T23:30:00'), // 23:30
        };

        const earlyMorning: EvaluationContext = {
          ...baseContext,
          timestamp: new Date('2024-01-15T04:30:00'), // 04:30
        };

        const rule = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            {
              type: 'time',
              field: 'current_time',
              operator: 'between',
              value: { start: '22:00', end: '06:00' },
            },
          ],
        });

        expect(evaluateRule(rule, lateNight).matched).toBe(true);
        expect(evaluateRule(rule, earlyMorning).matched).toBe(true);
      });

      it('should evaluate day_of_week condition', () => {
        const monday: EvaluationContext = {
          ...baseContext,
          timestamp: new Date('2024-01-15T12:00:00'), // Monday (with time to avoid timezone issues)
        };

        const rule = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            {
              type: 'time',
              field: 'day_of_week',
              operator: 'day_of_week',
              value: [1, 2, 3, 4, 5], // Weekdays
            },
          ],
        });

        const result = evaluateRule(rule, monday);
        expect(result.matched).toBe(true);
      });
    });

    describe('compound conditions', () => {
      it('should evaluate AND conditions', () => {
        const context: EvaluationContext = {
          ...baseContext,
          fields: { tier: 'premium', active: true },
        };

        const rule = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            {
              type: 'compound',
              operator: 'and',
              conditions: [
                { type: 'field', field: 'tier', operator: 'equals', value: 'premium' },
                { type: 'field', field: 'active', operator: 'equals', value: true },
              ],
            },
          ],
        });

        const result = evaluateRule(rule, context);
        expect(result.matched).toBe(true);
      });

      it('should evaluate OR conditions', () => {
        const context: EvaluationContext = {
          ...baseContext,
          fields: { tier: 'free' },
        };

        const rule = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            {
              type: 'compound',
              operator: 'or',
              conditions: [
                { type: 'field', field: 'tier', operator: 'equals', value: 'premium' },
                { type: 'field', field: 'tier', operator: 'equals', value: 'free' },
              ],
            },
          ],
        });

        const result = evaluateRule(rule, context);
        expect(result.matched).toBe(true);
      });

      it('should evaluate NOT conditions', () => {
        const context: EvaluationContext = {
          ...baseContext,
          fields: { blocked: false },
        };

        const rule = createRule({
          actions: ['*'],
          resources: ['*'],
          conditions: [
            {
              type: 'compound',
              operator: 'not',
              conditions: [
                { type: 'field', field: 'blocked', operator: 'equals', value: true },
              ],
            },
          ],
        });

        const result = evaluateRule(rule, context);
        expect(result.matched).toBe(true);
      });
    });
  });

  describe('findMatchingRule', () => {
    it('should return first matching rule by priority', () => {
      const rules: PolicyRule[] = [
        createRule({
          name: 'low-priority-allow',
          priority: 10,
          effect: 'allow',
          actions: ['*'],
          resources: ['*'],
        }),
        createRule({
          name: 'high-priority-deny',
          priority: 100,
          effect: 'deny',
          actions: ['*'],
          resources: ['*'],
        }),
      ];

      const context: EvaluationContext = {
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      };

      const result = findMatchingRule(rules, context);

      expect(result?.rule.name).toBe('high-priority-deny');
      expect(result?.rule.effect).toBe('deny');
    });

    it('should return null when no rules match', () => {
      const rules: PolicyRule[] = [
        createRule({
          actions: ['engage:*'],
          resources: ['*'],
        }),
      ];

      const context: EvaluationContext = {
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      };

      const result = findMatchingRule(rules, context);

      expect(result).toBeNull();
    });
  });

  describe('createRuleEvaluator', () => {
    it('should create a rule evaluator with all methods', () => {
      const evaluator = createRuleEvaluator();

      expect(evaluator.evaluateRule).toBeDefined();
      expect(evaluator.findMatchingRule).toBeDefined();
      expect(evaluator.findAllMatchingRules).toBeDefined();
      expect(evaluator.sortByPriority).toBeDefined();
    });
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

function createRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
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
