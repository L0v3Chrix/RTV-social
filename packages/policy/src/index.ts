/**
 * @rtv/policy - Policy Definition Schema
 *
 * This package provides the policy engine schema and utilities for
 * defining rules that govern agent behavior in the RTV Social Automation Platform.
 *
 * @example
 * ```typescript
 * import {
 *   createPolicy,
 *   validatePolicy,
 *   mergePolicies,
 *   clonePolicy,
 *   Policy,
 *   PolicyRule,
 *   PolicyCondition,
 *   PolicySchema,
 *   PolicyRuleSchema,
 *   PolicyConditionSchema,
 * } from '@rtv/policy';
 *
 * // Create a new policy
 * const policy = createPolicy({
 *   name: 'Social Media Posting Policy',
 *   scope: 'client',
 *   clientId: 'client_123',
 *   rules: [
 *     {
 *       name: 'Allow scheduled posts',
 *       effect: 'allow',
 *       actions: ['post:create', 'post:schedule'],
 *       resources: ['social:*'],
 *       conditions: [],
 *       priority: 100,
 *     },
 *     {
 *       name: 'Deny after hours',
 *       effect: 'deny',
 *       actions: ['post:publish'],
 *       resources: ['social:*'],
 *       conditions: [
 *         {
 *           type: 'time',
 *           field: 'current_time',
 *           operator: 'between',
 *           value: { start: '22:00', end: '06:00', timezone: 'America/New_York' },
 *         },
 *       ],
 *       priority: 200,
 *     },
 *   ],
 * });
 *
 * // Validate the policy
 * const result = validatePolicy(policy);
 * if (!result.valid) {
 *   console.error('Policy errors:', result.errors);
 * }
 * if (result.warnings.length > 0) {
 *   console.warn('Policy warnings:', result.warnings);
 * }
 * ```
 */

// Re-export everything from schema
export * from './schema/index.js';

// Re-export approval gates
export * from './approval-gates/index.js';

// Re-export kill switch infrastructure
export * from './kill-switch/index.js';

// Re-export rate limiting
export * from './rate-limiting/index.js';

// Re-export policy engine
export * from './engine/index.js';

// Version
export const VERSION = '0.0.0';
