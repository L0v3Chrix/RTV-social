import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-B4: Audit Event Schema', () => {
  const rootDir = resolve(__dirname, '..');
  const dbDir = resolve(rootDir, 'packages', 'db');
  const schemaDir = resolve(dbDir, 'src', 'schema');

  describe('Schema Files', () => {
    test('audit-events.ts schema exists', () => {
      expect(existsSync(resolve(schemaDir, 'audit-events.ts'))).toBe(true);
    });
  });

  describe('Audit Events Schema', () => {
    test('audit-events schema exports auditEvents table', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('export const auditEvents = pgTable');
    });

    test('audit-events table uses idColumn from base', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('...idColumn');
    });

    test('audit-events table uses clientIdColumn from base', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('...clientIdColumn');
    });

    test('audit-events table has actor_id column', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('actorId:');
      expect(content).toContain("uuid('actor_id')");
    });

    test('audit-events table has action column', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('action:');
      expect(content).toContain("varchar('action'");
    });

    test('audit-events table has resource_type column', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('resourceType:');
      expect(content).toContain("varchar('resource_type'");
    });

    test('audit-events table has resource_id column', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('resourceId:');
      expect(content).toContain("uuid('resource_id')");
    });

    test('audit-events table has payload jsonb column', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('payload:');
      expect(content).toContain("jsonb('payload')");
    });

    test('audit-events table has created_at column', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('createdAt:');
      expect(content).toContain("timestamp('created_at'");
    });
  });

  describe('Audit Events Indexes', () => {
    test('audit-events has composite index on (client_id, resource_type)', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('clientResourceTypeIdx');
      expect(content).toContain('.on(table.clientId, table.resourceType)');
    });

    test('audit-events has composite index on (client_id, created_at)', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('clientCreatedAtIdx');
      expect(content).toContain('.on(table.clientId, table.createdAt)');
    });
  });

  describe('Type Exports', () => {
    test('audit-events exports NewAuditEvent type', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('export type NewAuditEvent');
    });

    test('audit-events exports AuditEvent type', () => {
      const content = readFileSync(resolve(schemaDir, 'audit-events.ts'), 'utf-8');
      expect(content).toContain('export type AuditEvent');
    });
  });

  describe('Schema Index', () => {
    test('index.ts exports audit-events schema', () => {
      const content = readFileSync(resolve(schemaDir, 'index.ts'), 'utf-8');
      expect(content).toContain("'./audit-events.js'");
    });

    test('schema object includes auditEvents', () => {
      const content = readFileSync(resolve(schemaDir, 'index.ts'), 'utf-8');
      expect(content).toContain('auditEvents');
    });
  });
});
