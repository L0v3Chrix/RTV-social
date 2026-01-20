import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-B5: Seed Data Scripts', () => {
  const rootDir = resolve(__dirname, '..');
  const dbDir = resolve(rootDir, 'packages', 'db');
  const seedDir = resolve(dbDir, 'src', 'seed');

  describe('Seed Module Files', () => {
    test('seed directory exists', () => {
      expect(existsSync(seedDir)).toBe(true);
    });

    test('data.ts seed data file exists', () => {
      expect(existsSync(resolve(seedDir, 'data.ts'))).toBe(true);
    });

    test('index.ts seed functions file exists', () => {
      expect(existsSync(resolve(seedDir, 'index.ts'))).toBe(true);
    });

    test('cli.ts CLI script exists', () => {
      expect(existsSync(resolve(seedDir, 'cli.ts'))).toBe(true);
    });
  });

  describe('SEED_CLIENTS Data', () => {
    test('data.ts exports SEED_CLIENTS array', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('export const SEED_CLIENTS');
    });

    test('SEED_CLIENTS has 3+ clients', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      // Count client slugs - each client should have a slug property
      const slugMatches = content.match(/slug:\s*['"`]/g) || [];
      expect(slugMatches.length).toBeGreaterThanOrEqual(3);
    });

    test('includes RTV house account (rtv-house-account)', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('rtv-house-account');
    });

    test('includes Acme Fitness client (acme-fitness)', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('acme-fitness');
    });

    test('includes Green Thumb Landscaping client (green-thumb-landscaping)', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('green-thumb-landscaping');
    });
  });

  describe('Seed Client Structure', () => {
    test('each client has slug property', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('slug:');
    });

    test('each client has name property', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('name:');
    });

    test('each client has settings with timezone', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('timezone:');
    });

    test('each client has settings with defaultLanguage', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('defaultLanguage:');
    });

    test('each client has settings with features', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('features:');
    });

    test('each client has brandKit with tone', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('brandKit:');
      expect(content).toContain('tone:');
    });

    test('each client has brandKit with colors', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('colors:');
    });

    test('each client has brandKit with logoRefs', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('logoRefs:');
    });

    test('each client has knowledgeBases array', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('knowledgeBases:');
    });
  });

  describe('Seed Functions', () => {
    test('index.ts exports seed function', () => {
      const content = readFileSync(resolve(seedDir, 'index.ts'), 'utf-8');
      expect(content).toContain('export async function seed');
    });

    test('index.ts exports clearSeedData function', () => {
      const content = readFileSync(resolve(seedDir, 'index.ts'), 'utf-8');
      expect(content).toContain('export async function clearSeedData');
    });

    test('index.ts exports reseed function', () => {
      const content = readFileSync(resolve(seedDir, 'index.ts'), 'utf-8');
      expect(content).toContain('export async function reseed');
    });

    test('seed function handles idempotency', () => {
      const content = readFileSync(resolve(seedDir, 'index.ts'), 'utf-8');
      // Should check for existing records or use upsert pattern
      expect(content.match(/onConflictDoNothing|findFirst|existing|upsert|where.*slug/i)).toBeTruthy();
    });
  });

  describe('CLI Script', () => {
    test('cli.ts handles seed command', () => {
      const content = readFileSync(resolve(seedDir, 'cli.ts'), 'utf-8');
      expect(content).toContain("'seed'");
    });

    test('cli.ts handles clear command', () => {
      const content = readFileSync(resolve(seedDir, 'cli.ts'), 'utf-8');
      expect(content).toContain("'clear'");
    });

    test('cli.ts handles reset command', () => {
      const content = readFileSync(resolve(seedDir, 'cli.ts'), 'utf-8');
      expect(content).toContain("'reset'");
    });

    test('cli.ts imports seed functions', () => {
      const content = readFileSync(resolve(seedDir, 'cli.ts'), 'utf-8');
      expect(content).toContain('import');
      expect(content).toContain('seed');
      expect(content).toContain('clearSeedData');
      expect(content).toContain('reseed');
    });
  });

  describe('Package.json Scripts', () => {
    test('db:seed script is defined', () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(dbDir, 'package.json'), 'utf-8')
      );
      expect(packageJson.scripts).toHaveProperty('db:seed');
      expect(packageJson.scripts['db:seed']).toContain('seed');
    });

    test('db:seed:clear script is defined', () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(dbDir, 'package.json'), 'utf-8')
      );
      expect(packageJson.scripts).toHaveProperty('db:seed:clear');
      expect(packageJson.scripts['db:seed:clear']).toContain('clear');
    });

    test('db:seed:reset script is defined', () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(dbDir, 'package.json'), 'utf-8')
      );
      expect(packageJson.scripts).toHaveProperty('db:seed:reset');
      expect(packageJson.scripts['db:seed:reset']).toContain('reset');
    });

    test('tsx is added as dev dependency for CLI execution', () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(dbDir, 'package.json'), 'utf-8')
      );
      expect(packageJson.devDependencies).toHaveProperty('tsx');
    });
  });

  describe('Type Safety', () => {
    test('data.ts imports types from schema', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain("from '../schema");
    });

    test('data.ts uses SeedClient interface', () => {
      const content = readFileSync(resolve(seedDir, 'data.ts'), 'utf-8');
      expect(content).toContain('interface SeedClient');
    });

    test('index.ts imports database utilities', () => {
      const content = readFileSync(resolve(seedDir, 'index.ts'), 'utf-8');
      expect(content).toContain("from '../connection");
    });

    test('index.ts imports schema tables', () => {
      const content = readFileSync(resolve(seedDir, 'index.ts'), 'utf-8');
      expect(content).toContain('clients');
      expect(content).toContain('brandKits');
      expect(content).toContain('knowledgeBases');
    });
  });
});
