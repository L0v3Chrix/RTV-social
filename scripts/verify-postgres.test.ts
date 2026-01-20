import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-B1: PostgreSQL Connection Pool', () => {
  const rootDir = resolve(__dirname, '..');
  const dbDir = resolve(rootDir, 'packages', 'db');

  describe('Package Configuration', () => {
    test('package.json has drizzle-orm dependency', () => {
      const packagePath = resolve(dbDir, 'package.json');
      const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));

      expect(pkg.dependencies['drizzle-orm']).toBeDefined();
    });

    test('package.json has postgres driver dependency', () => {
      const packagePath = resolve(dbDir, 'package.json');
      const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));

      expect(pkg.dependencies['postgres']).toBeDefined();
    });

    test('package.json has drizzle-kit devDependency', () => {
      const packagePath = resolve(dbDir, 'package.json');
      const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));

      expect(pkg.devDependencies['drizzle-kit']).toBeDefined();
    });

    test('package.json exports schema subpath', () => {
      const packagePath = resolve(dbDir, 'package.json');
      const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));

      expect(pkg.exports['./schema']).toBeDefined();
    });

    test('package.json exports migrations subpath', () => {
      const packagePath = resolve(dbDir, 'package.json');
      const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));

      expect(pkg.exports['./migrations']).toBeDefined();
    });
  });

  describe('Connection Module', () => {
    test('connection.ts exists', () => {
      const connectionPath = resolve(dbDir, 'src', 'connection.ts');
      expect(existsSync(connectionPath)).toBe(true);
    });

    test('connection.ts exports initializeConnection', () => {
      const connectionPath = resolve(dbDir, 'src', 'connection.ts');
      const content = readFileSync(connectionPath, 'utf-8');

      expect(content).toContain('export function initializeConnection');
    });

    test('connection.ts exports getDb', () => {
      const connectionPath = resolve(dbDir, 'src', 'connection.ts');
      const content = readFileSync(connectionPath, 'utf-8');

      expect(content).toContain('export function getDb');
    });

    test('connection.ts exports testConnection', () => {
      const connectionPath = resolve(dbDir, 'src', 'connection.ts');
      const content = readFileSync(connectionPath, 'utf-8');

      expect(content).toContain('export async function testConnection');
    });

    test('connection.ts exports closeConnection', () => {
      const connectionPath = resolve(dbDir, 'src', 'connection.ts');
      const content = readFileSync(connectionPath, 'utf-8');

      expect(content).toContain('export async function closeConnection');
    });

    test('connection.ts uses DATABASE_URL environment variable', () => {
      const connectionPath = resolve(dbDir, 'src', 'connection.ts');
      const content = readFileSync(connectionPath, 'utf-8');

      expect(content).toContain("process.env['DATABASE_URL']");
    });
  });

  describe('Schema Structure', () => {
    test('schema directory exists', () => {
      const schemaDir = resolve(dbDir, 'src', 'schema');
      expect(existsSync(schemaDir)).toBe(true);
    });

    test('schema/index.ts exists', () => {
      const schemaIndexPath = resolve(dbDir, 'src', 'schema', 'index.ts');
      expect(existsSync(schemaIndexPath)).toBe(true);
    });

    test('schema/base.ts exists with multi-tenant utilities', () => {
      const basePath = resolve(dbDir, 'src', 'schema', 'base.ts');
      expect(existsSync(basePath)).toBe(true);

      const content = readFileSync(basePath, 'utf-8');
      expect(content).toContain('clientIdColumn');
      expect(content).toContain('timestamps');
    });
  });

  describe('Migrations Structure', () => {
    test('migrations directory exists', () => {
      const migrationsDir = resolve(dbDir, 'src', 'migrations');
      expect(existsSync(migrationsDir)).toBe(true);
    });

    test('migrations/index.ts exists', () => {
      const migrationsIndexPath = resolve(dbDir, 'src', 'migrations', 'index.ts');
      expect(existsSync(migrationsIndexPath)).toBe(true);
    });

    test('migrations/index.ts exports runMigrations', () => {
      const migrationsIndexPath = resolve(dbDir, 'src', 'migrations', 'index.ts');
      const content = readFileSync(migrationsIndexPath, 'utf-8');

      expect(content).toContain('export async function runMigrations');
    });
  });

  describe('Drizzle Configuration', () => {
    test('drizzle.config.ts exists', () => {
      const configPath = resolve(dbDir, 'drizzle.config.ts');
      expect(existsSync(configPath)).toBe(true);
    });

    test('drizzle.config.ts uses postgresql dialect', () => {
      const configPath = resolve(dbDir, 'drizzle.config.ts');
      const content = readFileSync(configPath, 'utf-8');

      expect(content).toContain("dialect: 'postgresql'");
    });

    test('.env.example exists', () => {
      const envExamplePath = resolve(dbDir, '.env.example');
      expect(existsSync(envExamplePath)).toBe(true);
    });
  });

  describe('TypeScript Configuration', () => {
    test('tsconfig.json extends tsconfig.node.json', () => {
      const tsconfigPath = resolve(dbDir, 'tsconfig.json');
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

      expect(tsconfig.extends).toContain('tsconfig.node.json');
    });

    test('tsconfig.json has noEmit: false for compilation', () => {
      const tsconfigPath = resolve(dbDir, 'tsconfig.json');
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

      expect(tsconfig.compilerOptions.noEmit).toBe(false);
    });
  });
});
