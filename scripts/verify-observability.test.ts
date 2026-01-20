import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-D1: OpenTelemetry Instrumentation', () => {
  const rootDir = resolve(__dirname, '..');
  const obsDir = resolve(rootDir, 'packages', 'observability');

  describe('Package Structure', () => {
    test('observability package directory exists', () => {
      expect(existsSync(obsDir)).toBe(true);
    });

    test('package.json exists', () => {
      expect(existsSync(resolve(obsDir, 'package.json'))).toBe(true);
    });

    test('package.json has correct name', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(obsDir, 'package.json'), 'utf-8')
      );
      expect(pkgJson.name).toBe('@rtv/observability');
    });

    test('tsconfig.json extends base config', () => {
      const tsconfig = JSON.parse(
        readFileSync(resolve(obsDir, 'tsconfig.json'), 'utf-8')
      );
      expect(tsconfig.extends).toMatch(/tsconfig\.(base|node)\.json/);
    });
  });

  describe('OpenTelemetry Dependencies', () => {
    test('has @opentelemetry/api dependency', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(obsDir, 'package.json'), 'utf-8')
      );
      expect(pkgJson.dependencies['@opentelemetry/api']).toBeDefined();
    });

    test('has @opentelemetry/sdk-node dependency', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(obsDir, 'package.json'), 'utf-8')
      );
      expect(pkgJson.dependencies['@opentelemetry/sdk-node']).toBeDefined();
    });

    test('has auto-instrumentations dependency', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(obsDir, 'package.json'), 'utf-8')
      );
      expect(
        pkgJson.dependencies['@opentelemetry/auto-instrumentations-node']
      ).toBeDefined();
    });

    test('has OTLP exporter dependency', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(obsDir, 'package.json'), 'utf-8')
      );
      expect(
        pkgJson.dependencies['@opentelemetry/exporter-trace-otlp-http']
      ).toBeDefined();
    });
  });

  describe('Tracing Module', () => {
    test('tracing.ts exists', () => {
      expect(existsSync(resolve(obsDir, 'src', 'tracing.ts'))).toBe(true);
    });

    test('tracing.ts exports initTracing', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'tracing.ts'),
        'utf-8'
      );
      expect(content).toContain('export async function initTracing');
    });

    test('tracing.ts exports shutdownTracing', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'tracing.ts'),
        'utf-8'
      );
      expect(content).toContain('export async function shutdownTracing');
    });

    test('tracing.ts exports withSpan', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'tracing.ts'),
        'utf-8'
      );
      expect(content).toContain('export async function withSpan');
    });

    test('tracing.ts exports getTracer', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'tracing.ts'),
        'utf-8'
      );
      expect(content).toContain('export function getTracer');
    });

    test('tracing.ts exports setTenantContext', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'tracing.ts'),
        'utf-8'
      );
      expect(content).toContain('export function setTenantContext');
    });
  });

  describe('Metrics Module', () => {
    test('metrics.ts exists', () => {
      expect(existsSync(resolve(obsDir, 'src', 'metrics.ts'))).toBe(true);
    });

    test('metrics.ts exports initMetrics', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export function initMetrics');
    });

    test('metrics.ts exports getMeter', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export function getMeter');
    });
  });

  describe('Package Exports', () => {
    test('index.ts exists', () => {
      expect(existsSync(resolve(obsDir, 'src', 'index.ts'))).toBe(true);
    });

    test('package.json exports tracing subpath', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(obsDir, 'package.json'), 'utf-8')
      );
      expect(pkgJson.exports['./tracing']).toBeDefined();
    });

    test('package.json exports metrics subpath', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(obsDir, 'package.json'), 'utf-8')
      );
      expect(pkgJson.exports['./metrics']).toBeDefined();
    });
  });
});
