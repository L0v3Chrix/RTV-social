import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-D4: Error Tracking Setup', () => {
  const rootDir = resolve(__dirname, '..');
  const obsDir = resolve(rootDir, 'packages', 'observability');

  describe('Error Module Structure', () => {
    test('errors.ts exists', () => {
      expect(existsSync(resolve(obsDir, 'src', 'errors.ts'))).toBe(true);
    });
  });

  describe('ErrorClassification Enum', () => {
    test('errors.ts exports ErrorClassification enum', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export enum ErrorClassification');
    });

    test('ErrorClassification has TRANSIENT value', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain("TRANSIENT = 'transient'");
    });

    test('ErrorClassification has PERMANENT value', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain("PERMANENT = 'permanent'");
    });

    test('ErrorClassification has RATE_LIMITED value', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain("RATE_LIMITED = 'rate_limited'");
    });

    test('ErrorClassification has UNKNOWN value', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain("UNKNOWN = 'unknown'");
    });
  });

  describe('Error Classification Functions', () => {
    test('errors.ts exports classifyError function', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export function classifyError');
    });

    test('errors.ts exports isTransientError function', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export function isTransientError');
    });

    test('errors.ts exports isPermanentError function', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export function isPermanentError');
    });
  });

  describe('Error Classification Patterns', () => {
    test('errors.ts handles TRANSIENT patterns (ECONNRESET, ECONNREFUSED, ETIMEDOUT)', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('ECONNRESET');
      expect(content).toContain('ECONNREFUSED');
      expect(content).toContain('ETIMEDOUT');
    });

    test('errors.ts handles TRANSIENT patterns (timeout, network, connection)', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('timeout');
      expect(content).toContain('network');
      expect(content).toContain('connection');
    });

    test('errors.ts handles TRANSIENT HTTP status codes (502, 503, 504)', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('502');
      expect(content).toContain('503');
      expect(content).toContain('504');
    });

    test('errors.ts handles RATE_LIMITED patterns', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('rate limit');
      expect(content).toContain('429');
    });

    test('errors.ts handles PERMANENT error types', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('ValidationError');
      expect(content).toContain('TypeError');
      expect(content).toContain('SyntaxError');
    });
  });

  describe('Error Context Types', () => {
    test('errors.ts exports ErrorContext interface', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export interface ErrorContext');
    });

    test('ErrorContext has operation field', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('operation: string');
    });

    test('ErrorContext has timestamp field', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('timestamp: string');
    });

    test('ErrorContext has optional clientId field', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('clientId?:');
    });

    test('ErrorContext has optional userId field', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('userId?:');
    });

    test('ErrorContext has optional platform field', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('platform?:');
    });

    test('ErrorContext has optional correlationId field', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('correlationId?:');
    });
  });

  describe('CapturedError Type', () => {
    test('errors.ts exports CapturedError interface', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export interface CapturedError');
    });

    test('CapturedError has error field', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('error: Error');
    });

    test('CapturedError has context field', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('context: ErrorContext');
    });

    test('CapturedError has classification field', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('classification: ErrorClassification');
    });

    test('CapturedError has optional traceId field', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('traceId?:');
    });

    test('CapturedError has optional spanId field', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('spanId?:');
    });
  });

  describe('Error Capture Functions', () => {
    test('errors.ts exports createErrorContext function', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export function createErrorContext');
    });

    test('errors.ts exports captureError function', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export function captureError');
    });
  });

  describe('Error Handling Utilities', () => {
    test('errors.ts exports wrapWithErrorHandling function', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export async function wrapWithErrorHandling');
    });

    test('errors.ts exports createErrorHandler function', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export function createErrorHandler');
    });

    test('errors.ts exports safeExecute function', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export async function safeExecute');
    });
  });

  describe('Retry Logic Functions', () => {
    test('errors.ts exports getRetryDelay function', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export function getRetryDelay');
    });

    test('errors.ts exports shouldRetry function', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('export function shouldRetry');
    });
  });

  describe('Trace Context Integration', () => {
    test('errors.ts imports getCurrentSpan from tracing', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain('getCurrentSpan');
      expect(content).toContain("from './tracing");
    });

    test('captureError correlates with traces', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      // Should use getCurrentSpan to get trace context
      expect(content).toContain('spanContext');
    });
  });

  describe('Logging Integration', () => {
    test('errors.ts imports logger from logging', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      expect(content).toContain("from './logging");
    });

    test('captureError logs errors with context', () => {
      const content = readFileSync(
        resolve(obsDir, 'src', 'errors.ts'),
        'utf-8'
      );
      // Should log errors when captured
      expect(content).toContain('.error(');
    });
  });

  describe('Package Exports', () => {
    test('index.ts exports ErrorClassification', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('ErrorClassification');
    });

    test('index.ts exports captureError', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('captureError');
    });

    test('index.ts exports classifyError', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('classifyError');
    });

    test('index.ts exports isTransientError', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('isTransientError');
    });

    test('index.ts exports isPermanentError', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('isPermanentError');
    });

    test('index.ts exports createErrorContext', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('createErrorContext');
    });

    test('index.ts exports wrapWithErrorHandling', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('wrapWithErrorHandling');
    });

    test('index.ts exports createErrorHandler', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('createErrorHandler');
    });

    test('index.ts exports safeExecute', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('safeExecute');
    });

    test('index.ts exports getRetryDelay', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('getRetryDelay');
    });

    test('index.ts exports shouldRetry', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('shouldRetry');
    });

    test('index.ts exports ErrorContext type', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('ErrorContext');
    });

    test('index.ts exports CapturedError type', () => {
      const content = readFileSync(resolve(obsDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain('CapturedError');
    });
  });
});
