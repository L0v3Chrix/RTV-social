import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-B2: Core Schema Tables', () => {
  const rootDir = resolve(__dirname, '..');
  const dbDir = resolve(rootDir, 'packages', 'db');
  const schemaDir = resolve(dbDir, 'src', 'schema');

  describe('Schema Files', () => {
    test('base.ts schema utilities exist', () => {
      expect(existsSync(resolve(schemaDir, 'base.ts'))).toBe(true);
    });

    test('clients.ts schema exists', () => {
      expect(existsSync(resolve(schemaDir, 'clients.ts'))).toBe(true);
    });

    test('brand-kits.ts schema exists', () => {
      expect(existsSync(resolve(schemaDir, 'brand-kits.ts'))).toBe(true);
    });

    test('knowledge-bases.ts schema exists', () => {
      expect(existsSync(resolve(schemaDir, 'knowledge-bases.ts'))).toBe(true);
    });
  });

  describe('Clients Schema', () => {
    test('clients schema exports clients table', () => {
      const content = readFileSync(resolve(schemaDir, 'clients.ts'), 'utf-8');
      expect(content).toContain('export const clients = pgTable');
    });

    test('clients table has id column', () => {
      const content = readFileSync(resolve(schemaDir, 'clients.ts'), 'utf-8');
      expect(content).toContain('...idColumn');
    });

    test('clients table has name column', () => {
      const content = readFileSync(resolve(schemaDir, 'clients.ts'), 'utf-8');
      expect(content).toContain("name:");
    });

    test('clients table has slug column', () => {
      const content = readFileSync(resolve(schemaDir, 'clients.ts'), 'utf-8');
      expect(content).toContain("slug:");
    });

    test('clients table has settings column', () => {
      const content = readFileSync(resolve(schemaDir, 'clients.ts'), 'utf-8');
      expect(content).toContain("settings:");
    });

    test('clients exports type definitions', () => {
      const content = readFileSync(resolve(schemaDir, 'clients.ts'), 'utf-8');
      expect(content).toContain('export type NewClient');
      expect(content).toContain('export type Client');
    });
  });

  describe('Brand Kits Schema', () => {
    test('brand-kits schema exports brandKits table', () => {
      const content = readFileSync(resolve(schemaDir, 'brand-kits.ts'), 'utf-8');
      expect(content).toContain('export const brandKits = pgTable');
    });

    test('brand-kits table has clientId column', () => {
      const content = readFileSync(resolve(schemaDir, 'brand-kits.ts'), 'utf-8');
      // Schema uses spread syntax from base.ts for consistency
      expect(content).toContain('...clientIdColumn');
    });

    test('brand-kits table has tone column', () => {
      const content = readFileSync(resolve(schemaDir, 'brand-kits.ts'), 'utf-8');
      expect(content).toContain('tone:');
    });

    test('brand-kits table has colors column', () => {
      const content = readFileSync(resolve(schemaDir, 'brand-kits.ts'), 'utf-8');
      expect(content).toContain('colors:');
    });

    test('brand-kits has foreign key to clients', () => {
      const content = readFileSync(resolve(schemaDir, 'brand-kits.ts'), 'utf-8');
      expect(content).toContain('foreignKey');
      expect(content).toContain('clients');
    });
  });

  describe('Knowledge Bases Schema', () => {
    test('knowledge-bases schema exports knowledgeBases table', () => {
      const content = readFileSync(resolve(schemaDir, 'knowledge-bases.ts'), 'utf-8');
      expect(content).toContain('export const knowledgeBases = pgTable');
    });

    test('knowledge-bases schema exports knowledgeChunks table', () => {
      const content = readFileSync(resolve(schemaDir, 'knowledge-bases.ts'), 'utf-8');
      expect(content).toContain('export const knowledgeChunks = pgTable');
    });

    test('knowledge-bases table has sourceType column', () => {
      const content = readFileSync(resolve(schemaDir, 'knowledge-bases.ts'), 'utf-8');
      expect(content).toContain('sourceType:');
    });

    test('knowledge-chunks table has embedding column', () => {
      const content = readFileSync(resolve(schemaDir, 'knowledge-bases.ts'), 'utf-8');
      expect(content).toContain('embedding:');
    });
  });

  describe('Schema Index', () => {
    test('index.ts exports all schemas', () => {
      const content = readFileSync(resolve(schemaDir, 'index.ts'), 'utf-8');
      expect(content).toContain("'./clients.js'");
      expect(content).toContain("'./brand-kits.js'");
      expect(content).toContain("'./knowledge-bases.js'");
    });

    test('index.ts exports schema object', () => {
      const content = readFileSync(resolve(schemaDir, 'index.ts'), 'utf-8');
      expect(content).toContain('export const schema');
    });
  });
});
