import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-D3: Audit Event Framework', () => {
  const rootDir = resolve(__dirname, '..');
  const obsDir = resolve(rootDir, 'packages', 'observability');

  describe('Audit Module Structure', () => {
    test('audit.ts exists', () => {
      expect(existsSync(resolve(obsDir, 'src', 'audit.ts'))).toBe(true);
    });
  });

  describe('Audit Types', () => {
    test('AuditActorType is exported', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('export type AuditActorType');
    });

    test('AuditActorType includes user, agent, system, webhook', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain("'user'");
      expect(content).toContain("'agent'");
      expect(content).toContain("'system'");
      expect(content).toContain("'webhook'");
    });

    test('AuditOutcome is exported', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('export type AuditOutcome');
    });

    test('AuditOutcome includes success, failure, partial, pending', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain("'success'");
      expect(content).toContain("'failure'");
      expect(content).toContain("'partial'");
      expect(content).toContain("'pending'");
    });

    test('AuditProof interface is exported', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('export interface AuditProof');
    });

    test('AuditProof includes type field with proof types', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain("'screenshot'");
      expect(content).toContain("'api_response'");
      expect(content).toContain("'hash'");
      expect(content).toContain("'url'");
      expect(content).toContain("'none'");
    });

    test('AuditEventInput interface is exported', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('export interface AuditEventInput');
    });

    test('AuditEventInput includes required fields', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('clientId');
      expect(content).toContain('actionType');
      expect(content).toContain('actorType');
      expect(content).toContain('actorId');
      expect(content).toContain('targetType');
      expect(content).toContain('targetId');
      expect(content).toContain('outcome');
    });

    test('AuditEventResult interface is exported', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('export interface AuditEventResult');
    });

    test('AuditEventResult includes id and createdAt', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      // Look for the result interface fields
      expect(content).toMatch(/AuditEventResult[\s\S]*?id:/);
      expect(content).toMatch(/AuditEventResult[\s\S]*?createdAt:/);
    });
  });

  describe('AuditEmitter Class', () => {
    test('AuditEmitter class is exported', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('export class AuditEmitter');
    });

    test('AuditEmitter has emit method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('emit(');
      expect(content).toContain('AuditEventInput');
      expect(content).toContain('Promise<AuditEventResult>');
    });

    test('AuditEmitter has forClient builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('forClient(');
    });

    test('AuditEmitter has action builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('action(');
    });

    test('AuditEmitter has actor builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('actor(');
    });

    test('AuditEmitter has target builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('target(');
    });

    test('AuditEmitter has succeeded builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('succeeded(');
    });

    test('AuditEmitter has failed builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('failed(');
    });

    test('AuditEmitter has partial builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('partial(');
    });

    test('AuditEmitter has pending builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('pending(');
    });

    test('AuditEmitter has withProof builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('withProof(');
    });

    test('AuditEmitter has withApiProof builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('withApiProof(');
    });

    test('AuditEmitter has withScreenshotProof builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('withScreenshotProof(');
    });

    test('AuditEmitter has withMetadata builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('withMetadata(');
    });

    test('AuditEmitter has withCorrelation builder method', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('withCorrelation(');
    });
  });

  describe('Factory Functions', () => {
    test('createAuditEmitter function is exported', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('export function createAuditEmitter');
    });

    test('getAuditEmitter function is exported', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('export function getAuditEmitter');
    });

    test('emitAuditEvent function is exported', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('export async function emitAuditEvent');
    });

    test('audit convenience function is exported', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('export function audit');
    });
  });

  describe('Trace Context Integration', () => {
    test('audit.ts imports from tracing', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain("from './tracing");
    });

    test('audit.ts gets correlation ID from trace context', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain('getCurrentSpan');
    });
  });

  describe('Logging Integration', () => {
    test('audit.ts imports from logging', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      expect(content).toContain("from './logging");
    });

    test('audit.ts logs events to console', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      // Should log audit events
      expect(content).toMatch(/logger\.(info|debug)/);
    });
  });

  describe('Package Exports', () => {
    test('index.ts exports AuditEmitter', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('AuditEmitter');
    });

    test('index.ts exports createAuditEmitter', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('createAuditEmitter');
    });

    test('index.ts exports getAuditEmitter', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('getAuditEmitter');
    });

    test('index.ts exports emitAuditEvent', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('emitAuditEvent');
    });

    test('index.ts exports audit convenience function', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('audit');
    });

    test('index.ts exports AuditEventInput type', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('AuditEventInput');
    });

    test('index.ts exports AuditEventResult type', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('AuditEventResult');
    });

    test('index.ts exports AuditProof type', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('AuditProof');
    });

    test('index.ts exports AuditActorType type', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('AuditActorType');
    });

    test('index.ts exports AuditOutcome type', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('AuditOutcome');
    });
  });

  describe('UUID Generation', () => {
    test('audit.ts generates unique IDs for events', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'audit.ts'),
        'utf-8'
      );
      // Should use crypto randomUUID or similar for ID generation
      expect(content).toMatch(/randomUUID|uuid|nanoid/);
    });
  });
});
