import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  initTracing,
  shutdownTracing,
  createSpan,
  withSpan,
  getTracer,
  getCurrentSpan,
} from '../tracing';

describe('OpenTelemetry Tracing', () => {
  beforeEach(async () => {
    await initTracing({ serviceName: 'test-service', enableConsole: false });
  });

  afterEach(async () => {
    await shutdownTracing();
  });

  test('getTracer returns a valid tracer', () => {
    const tracer = getTracer();
    expect(tracer).toBeDefined();
  });

  test('createSpan creates a span with attributes', async () => {
    const span = createSpan('test-operation', {
      attributes: {
        'test.key': 'test-value',
      },
    });

    expect(span).toBeDefined();
    expect(span.isRecording()).toBe(true);

    span.end();
  });

  test('withSpan executes function within span context', async () => {
    const result = await withSpan('test-span', async (span) => {
      span.setAttribute('custom.attr', 'value');
      return 'success';
    });

    expect(result).toBe('success');
  });

  test('withSpan captures errors', async () => {
    await expect(
      withSpan('error-span', async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');
  });

  test('getCurrentSpan returns active span', async () => {
    await withSpan('outer-span', async () => {
      const current = getCurrentSpan();
      expect(current).toBeDefined();
      expect(current?.isRecording()).toBe(true);
    });
  });
});
