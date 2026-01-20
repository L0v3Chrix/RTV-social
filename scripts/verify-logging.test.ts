import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-D2: Structured Logging', () => {
  const rootDir = resolve(__dirname, '..');
  const obsDir = resolve(rootDir, 'packages', 'observability');

  describe('Logging Module', () => {
    test('logging.ts exists', () => {
      expect(existsSync(resolve(obsDir, 'src', 'logging.ts'))).toBe(true);
    });

    test('logging.ts exports createLogger', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'logging.ts'),
        'utf-8'
      );
      expect(content).toContain('export function createLogger');
    });

    test('logging.ts exports getLogger', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'logging.ts'),
        'utf-8'
      );
      expect(content).toContain('export function getLogger');
    });

    test('logging.ts exports withLogContext', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'logging.ts'),
        'utf-8'
      );
      expect(content).toContain('export function withLogContext');
    });

    test('logging.ts exports withTenantLogger', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'logging.ts'),
        'utf-8'
      );
      expect(content).toContain('export function withTenantLogger');
    });

    test('logging.ts exports logOperation', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'logging.ts'),
        'utf-8'
      );
      expect(content).toContain('export function logOperation');
      expect(content).toContain('export async function logOperation');
    });

    test('logging.ts exports redactSensitive', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'logging.ts'),
        'utf-8'
      );
      expect(content).toContain('export function redactSensitive');
    });
  });

  describe('Pino Integration', () => {
    test('logging.ts uses pino', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'logging.ts'),
        'utf-8'
      );
      expect(content).toContain("from 'pino'");
    });

    test('package.json has pino dependency', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(obsDir, 'package.json'), 'utf-8')
      );
      expect(pkgJson.dependencies['pino']).toBeDefined();
    });

    test('package.json has pino-pretty dependency', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(obsDir, 'package.json'), 'utf-8')
      );
      expect(pkgJson.dependencies['pino-pretty']).toBeDefined();
    });
  });

  describe('Trace Context Integration', () => {
    test('logging.ts imports from tracing', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'logging.ts'),
        'utf-8'
      );
      expect(content).toContain("from './tracing");
    });

    test('logging.ts includes trace context mixin', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'logging.ts'),
        'utf-8'
      );
      expect(content).toContain('traceId');
      expect(content).toContain('spanId');
    });
  });

  describe('Security Features', () => {
    test('logging.ts has SENSITIVE_FIELDS list', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'logging.ts'),
        'utf-8'
      );
      expect(content).toContain('SENSITIVE_FIELDS');
      expect(content).toContain('password');
      expect(content).toContain('token');
      expect(content).toContain('apiKey');
    });
  });

  describe('Package Exports', () => {
    test('index.ts exports logging functions', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('createLogger');
      expect(content).toContain('getLogger');
      expect(content).toContain('withLogContext');
      expect(content).toContain('logOperation');
    });
  });
});
