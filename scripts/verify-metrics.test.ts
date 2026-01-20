import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-D5: Metrics Collection', () => {
  const rootDir = resolve(__dirname, '..');
  const obsDir = resolve(rootDir, 'packages', 'observability');

  describe('Metrics Module Structure', () => {
    test('metrics.ts exists', () => {
      expect(existsSync(resolve(obsDir, 'src', 'metrics.ts'))).toBe(true);
    });

    test('package.json has @opentelemetry/sdk-metrics dependency', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(obsDir, 'package.json'), 'utf-8')
      );
      expect(pkgJson.dependencies['@opentelemetry/sdk-metrics']).toBeDefined();
    });

    test('package.json has @opentelemetry/exporter-metrics-otlp-http dependency', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(obsDir, 'package.json'), 'utf-8')
      );
      expect(
        pkgJson.dependencies['@opentelemetry/exporter-metrics-otlp-http']
      ).toBeDefined();
    });
  });

  describe('Metrics Initialization', () => {
    test('metrics.ts exports initMetrics with config parameter', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export function initMetrics');
      expect(content).toContain('MetricsConfig');
    });

    test('metrics.ts exports shutdownMetrics', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export async function shutdownMetrics');
    });

    test('metrics.ts exports getMeter', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export function getMeter');
    });

    test('MetricsConfig interface includes required fields', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('interface MetricsConfig');
      expect(content).toContain('serviceName');
      expect(content).toContain('serviceVersion');
      expect(content).toContain('environment');
      expect(content).toContain('otlpEndpoint');
    });
  });

  describe('Metric Creation Functions', () => {
    test('metrics.ts exports createCounter', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export function createCounter');
    });

    test('metrics.ts exports createHistogram', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export function createHistogram');
    });

    test('metrics.ts exports createGauge', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export function createGauge');
    });
  });

  describe('Standard HTTP Metrics', () => {
    test('metrics.ts defines http_requests_total counter', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('http_requests_total');
    });

    test('metrics.ts defines http_request_duration_ms histogram', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('http_request_duration_ms');
    });

    test('metrics.ts defines errors_total counter', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('errors_total');
    });
  });

  describe('Business Metrics', () => {
    test('metrics.ts defines publish_total counter', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('publish_total');
    });

    test('metrics.ts defines publish_duration_ms histogram', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('publish_duration_ms');
    });

    test('metrics.ts defines episodes_total counter', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('episodes_total');
    });

    test('metrics.ts defines episode_duration_ms histogram', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('episode_duration_ms');
    });
  });

  describe('Helper Functions', () => {
    test('metrics.ts exports recordHttpRequest', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export function recordHttpRequest');
    });

    test('metrics.ts exports recordPublish', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export function recordPublish');
    });

    test('metrics.ts exports recordEpisode', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export function recordEpisode');
    });
  });

  describe('Timing Utilities', () => {
    test('metrics.ts exports measureDuration', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export async function measureDuration');
    });

    test('metrics.ts exports startTimer', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain('export function startTimer');
    });
  });

  describe('Package Exports', () => {
    test('index.ts exports initMetrics', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('initMetrics');
    });

    test('index.ts exports shutdownMetrics', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('shutdownMetrics');
    });

    test('index.ts exports createGauge', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('createGauge');
    });

    test('index.ts exports recordHttpRequest', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('recordHttpRequest');
    });

    test('index.ts exports recordPublish', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('recordPublish');
    });

    test('index.ts exports recordEpisode', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('recordEpisode');
    });

    test('index.ts exports measureDuration', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('measureDuration');
    });

    test('index.ts exports startTimer', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('startTimer');
    });

    test('index.ts exports MetricsConfig type', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('MetricsConfig');
    });
  });

  describe('MeterProvider Integration', () => {
    test('metrics.ts imports MeterProvider from sdk-metrics', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain("from '@opentelemetry/sdk-metrics'");
      expect(content).toContain('MeterProvider');
    });

    test('metrics.ts imports OTLPMetricExporter', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain(
        "from '@opentelemetry/exporter-metrics-otlp-http'"
      );
    });

    test('metrics.ts uses Resource for service identification', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'metrics.ts'),
        'utf-8'
      );
      expect(content).toContain("from '@opentelemetry/resources'");
      expect(content).toContain('Resource');
    });
  });
});
