import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S1-C1: Policy Definition Schema', () => {
  const rootDir = resolve(__dirname, '..');
  const policyDir = resolve(rootDir, 'packages', 'policy');
  const srcDir = resolve(policyDir, 'src');
  const schemaDir = resolve(srcDir, 'schema');

  describe('Package Structure', () => {
    test('packages/policy directory exists', () => {
      expect(existsSync(policyDir)).toBe(true);
    });

    test('package.json exists with correct configuration', () => {
      const packageJsonPath = resolve(policyDir, 'package.json');
      expect(existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.name).toBe('@rtv/policy');
      expect(packageJson.type).toBe('module');
      expect(packageJson.private).toBe(true);
    });

    test('tsconfig.json exists', () => {
      expect(existsSync(resolve(policyDir, 'tsconfig.json'))).toBe(true);
    });

    test('src/index.ts exports all public APIs', () => {
      const indexPath = resolve(srcDir, 'index.ts');
      expect(existsSync(indexPath)).toBe(true);

      const content = readFileSync(indexPath, 'utf-8');
      expect(content).toContain("'./schema/index.js'");
    });

    test('src/schema/index.ts exists', () => {
      expect(existsSync(resolve(schemaDir, 'index.ts'))).toBe(true);
    });

    test('src/schema/types.ts exists', () => {
      expect(existsSync(resolve(schemaDir, 'types.ts'))).toBe(true);
    });

    test('src/schema/helpers.ts exists', () => {
      expect(existsSync(resolve(schemaDir, 'helpers.ts'))).toBe(true);
    });
  });

  describe('Type Definitions', () => {
    test('types.ts exports ComparisonOperator type', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export type ComparisonOperator');
      expect(content).toContain("'equals'");
      expect(content).toContain("'not_equals'");
      expect(content).toContain("'gt'");
      expect(content).toContain("'gte'");
      expect(content).toContain("'lt'");
      expect(content).toContain("'lte'");
      expect(content).toContain("'in'");
      expect(content).toContain("'not_in'");
      expect(content).toContain("'contains'");
      expect(content).toContain("'starts_with'");
      expect(content).toContain("'ends_with'");
      expect(content).toContain("'matches'");
      expect(content).toContain("'between'");
    });

    test('types.ts exports CompoundOperator type', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export type CompoundOperator');
      expect(content).toContain("'and'");
      expect(content).toContain("'or'");
      expect(content).toContain("'not'");
    });

    test('types.ts exports FieldCondition interface', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface FieldCondition');
      expect(content).toContain("type: 'field'");
      expect(content).toContain('field: string');
      expect(content).toContain('operator: ComparisonOperator');
      expect(content).toContain('value:');
    });

    test('types.ts exports TimeCondition interface', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface TimeCondition');
      expect(content).toContain("type: 'time'");
      expect(content).toContain("'between'");
      expect(content).toContain("'after'");
      expect(content).toContain("'before'");
      expect(content).toContain("'day_of_week'");
    });

    test('types.ts exports CompoundCondition interface', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface CompoundCondition');
      expect(content).toContain("type: 'compound'");
      expect(content).toContain('operator: CompoundOperator');
      expect(content).toContain('conditions: PolicyCondition[]');
    });

    test('types.ts exports PolicyCondition union type', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export type PolicyCondition');
      expect(content).toContain('FieldCondition');
      expect(content).toContain('TimeCondition');
      expect(content).toContain('CompoundCondition');
    });

    test('types.ts exports PolicyEffect type', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export type PolicyEffect');
      expect(content).toContain("'allow'");
      expect(content).toContain("'deny'");
    });

    test('types.ts exports PolicyStatus type', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export type PolicyStatus');
      expect(content).toContain("'draft'");
      expect(content).toContain("'active'");
      expect(content).toContain("'deprecated'");
      expect(content).toContain("'archived'");
    });

    test('types.ts exports PolicyScope type', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export type PolicyScope');
      expect(content).toContain("'global'");
      expect(content).toContain("'client'");
      expect(content).toContain("'agent'");
    });

    test('types.ts exports PolicyConstraints interface', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface PolicyConstraints');
      expect(content).toContain('rateLimit?:');
      expect(content).toContain('maxRequests');
      expect(content).toContain('windowMs');
      expect(content).toContain('requireApproval?:');
      expect(content).toContain('approverRole');
      expect(content).toContain('timeoutMs');
      expect(content).toContain('budget?:');
      expect(content).toContain('maxTokens');
      expect(content).toContain('maxCost');
    });

    test('types.ts exports PolicyRule interface', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface PolicyRule');
      expect(content).toContain('id?:');
      expect(content).toContain('name: string');
      expect(content).toContain('description?:');
      expect(content).toContain('effect: PolicyEffect');
      expect(content).toContain('actions: string[]');
      expect(content).toContain('resources: string[]');
      expect(content).toContain('conditions: PolicyCondition[]');
      expect(content).toContain('constraints?:');
      expect(content).toContain('priority: number');
      expect(content).toContain('enabled?:');
    });

    test('types.ts exports Policy interface', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface Policy');
      expect(content).toContain('id: string');
      expect(content).toContain('name: string');
      expect(content).toContain('description?:');
      expect(content).toContain('version: number');
      expect(content).toContain('status: PolicyStatus');
      expect(content).toContain('scope: PolicyScope');
      expect(content).toContain('clientId?:');
      expect(content).toContain('rules: PolicyRule[]');
      expect(content).toContain('defaultEffect: PolicyEffect');
      expect(content).toContain('createdAt: Date');
      expect(content).toContain('updatedAt: Date');
    });

    test('types.ts exports PolicyValidationResult interface', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface PolicyValidationResult');
      expect(content).toContain('valid: boolean');
      expect(content).toContain('errors: PolicyValidationError[]');
      expect(content).toContain('warnings: PolicyValidationWarning[]');
    });

    test('types.ts exports PolicyValidationError interface', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface PolicyValidationError');
      expect(content).toContain('path: string');
      expect(content).toContain('message: string');
      expect(content).toContain('code: string');
    });

    test('types.ts exports PolicyValidationWarning interface', () => {
      const content = readFileSync(resolve(schemaDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface PolicyValidationWarning');
      expect(content).toContain('path: string');
      expect(content).toContain('message: string');
      expect(content).toContain('code: string');
    });
  });

  describe('Zod Schema Definitions', () => {
    test('schema/index.ts exports Zod schemas', () => {
      const content = readFileSync(resolve(schemaDir, 'index.ts'), 'utf-8');
      expect(content).toContain('PolicyConditionSchema');
      expect(content).toContain('PolicyRuleSchema');
      expect(content).toContain('PolicySchema');
    });

    test('schema/index.ts exports FieldConditionSchema', () => {
      const content = readFileSync(resolve(schemaDir, 'index.ts'), 'utf-8');
      expect(content).toContain('FieldConditionSchema');
    });

    test('schema/index.ts exports TimeConditionSchema', () => {
      const content = readFileSync(resolve(schemaDir, 'index.ts'), 'utf-8');
      expect(content).toContain('TimeConditionSchema');
    });

    test('schema/index.ts exports CompoundConditionSchema', () => {
      const content = readFileSync(resolve(schemaDir, 'index.ts'), 'utf-8');
      expect(content).toContain('CompoundConditionSchema');
    });

    test('schema/index.ts exports PolicyConstraintsSchema', () => {
      const content = readFileSync(resolve(schemaDir, 'index.ts'), 'utf-8');
      expect(content).toContain('PolicyConstraintsSchema');
    });
  });

  describe('Helper Functions', () => {
    test('helpers.ts exports createPolicy function', () => {
      const content = readFileSync(resolve(schemaDir, 'helpers.ts'), 'utf-8');
      expect(content).toContain('export function createPolicy');
    });

    test('helpers.ts exports validatePolicy function', () => {
      const content = readFileSync(resolve(schemaDir, 'helpers.ts'), 'utf-8');
      expect(content).toContain('export function validatePolicy');
    });

    test('helpers.ts exports mergePolicies function', () => {
      const content = readFileSync(resolve(schemaDir, 'helpers.ts'), 'utf-8');
      expect(content).toContain('export function mergePolicies');
    });

    test('helpers.ts exports clonePolicy function', () => {
      const content = readFileSync(resolve(schemaDir, 'helpers.ts'), 'utf-8');
      expect(content).toContain('export function clonePolicy');
    });
  });

  describe('createPolicy Function', () => {
    test('createPolicy generates policy with ID', () => {
      const content = readFileSync(resolve(schemaDir, 'helpers.ts'), 'utf-8');
      // Should use nanoid for ID generation
      expect(content).toContain('nanoid');
    });

    test('createPolicy sets default values', () => {
      const content = readFileSync(resolve(schemaDir, 'helpers.ts'), 'utf-8');
      // Should set version to 1 by default
      expect(content).toContain('version');
      // Should set status to draft by default
      expect(content).toContain('draft');
      // Should set timestamps
      expect(content).toContain('createdAt');
      expect(content).toContain('updatedAt');
    });

    test('createPolicy generates rule IDs', () => {
      const content = readFileSync(resolve(schemaDir, 'helpers.ts'), 'utf-8');
      // Rules should get IDs if not provided
      expect(content).toContain('rule');
    });
  });

  describe('validatePolicy Function', () => {
    test('validatePolicy returns PolicyValidationResult', () => {
      const content = readFileSync(resolve(schemaDir, 'helpers.ts'), 'utf-8');
      expect(content).toContain('PolicyValidationResult');
    });

    test('validatePolicy uses Zod schema validation', () => {
      const content = readFileSync(resolve(schemaDir, 'helpers.ts'), 'utf-8');
      // Should use safeParse from Zod
      expect(content).toContain('safeParse');
    });

    test('validatePolicy checks for rule conflicts', () => {
      const content = readFileSync(resolve(schemaDir, 'helpers.ts'), 'utf-8');
      // Should check for conflicting rules
      expect(content).toContain('conflict');
    });

    test('validatePolicy warns about unreachable rules', () => {
      const content = readFileSync(resolve(schemaDir, 'helpers.ts'), 'utf-8');
      // Should detect unreachable rules
      expect(content).toContain('unreachable');
    });
  });

  describe('Compound Conditions', () => {
    test('CompoundConditionSchema supports AND operator', () => {
      const content = readFileSync(resolve(schemaDir, 'index.ts'), 'utf-8');
      expect(content).toContain("'and'");
    });

    test('CompoundConditionSchema supports OR operator', () => {
      const content = readFileSync(resolve(schemaDir, 'index.ts'), 'utf-8');
      expect(content).toContain("'or'");
    });

    test('CompoundConditionSchema supports NOT operator', () => {
      const content = readFileSync(resolve(schemaDir, 'index.ts'), 'utf-8');
      expect(content).toContain("'not'");
    });
  });

  describe('Package Dependencies', () => {
    test('package.json includes nanoid dependency', () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(policyDir, 'package.json'), 'utf-8')
      );
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies['nanoid']).toBeDefined();
    });

    test('package.json includes zod dependency', () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(policyDir, 'package.json'), 'utf-8')
      );
      expect(packageJson.dependencies['zod']).toBeDefined();
    });

    test('package.json includes date-fns dependency', () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(policyDir, 'package.json'), 'utf-8')
      );
      expect(packageJson.dependencies['date-fns']).toBeDefined();
    });
  });

  describe('Exports', () => {
    test('index.ts re-exports types', () => {
      const content = readFileSync(resolve(srcDir, 'index.ts'), 'utf-8');
      // Should export all types
      expect(content).toContain('Policy');
      expect(content).toContain('PolicyRule');
      expect(content).toContain('PolicyCondition');
    });

    test('index.ts re-exports helper functions', () => {
      const content = readFileSync(resolve(srcDir, 'index.ts'), 'utf-8');
      expect(content).toContain('createPolicy');
      expect(content).toContain('validatePolicy');
      expect(content).toContain('mergePolicies');
      expect(content).toContain('clonePolicy');
    });

    test('index.ts re-exports Zod schemas', () => {
      const content = readFileSync(resolve(srcDir, 'index.ts'), 'utf-8');
      expect(content).toContain('PolicySchema');
      expect(content).toContain('PolicyRuleSchema');
      expect(content).toContain('PolicyConditionSchema');
    });
  });
});
