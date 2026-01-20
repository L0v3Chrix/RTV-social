# Build Prompt: S3-D3 — Retry Logic

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S3-D3 |
| Sprint | 3 — Scheduling + Publishing |
| Agent | D — Publish Verification System |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1.5 days |
| Dependencies | S3-D1, S3-D4 |
| Blocks | None |

---

## Context

### What We're Building
A retry logic system with exponential backoff and jitter for handling transient failures in publishing and verification. The system intelligently decides when to retry, how long to wait, and when to give up based on failure classification. This ensures resilient operation without overwhelming platform APIs.

### Why It Matters
- **Resilience**: Handle temporary failures without manual intervention
- **Rate Limit Compliance**: Respect platform API limits with backoff
- **Cost Efficiency**: Avoid wasted retries on permanent failures
- **User Experience**: Recover gracefully from network issues
- **Observability**: Track retry patterns for debugging

### Spec References
- `docs/01-architecture/system-architecture-v3.md` — Error handling patterns
- `docs/03-agents-tools/agent-recursion-contracts.md` — Retry budgets
- `docs/05-policy-safety/compliance-safety-framework.md` — Rate limiting
- `docs/06-reliability-ops/slo-error-budget.md` — Error budget policies

---

## Prerequisites

### Completed Tasks
- [x] S3-D1: Post Verification API
- [x] S3-D4: Failure Classification (can be done in parallel)

### Required Packages
```json
{
  "dependencies": {
    "@rtv/core": "workspace:*",
    "@rtv/telemetry": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^1.2.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests BEFORE implementation.

#### 1.1 Retry Policy Tests
```typescript
// packages/verification/src/__tests__/retry-policy.test.ts
import { describe, it, expect } from 'vitest';
import {
  RetryPolicy,
  createRetryPolicy,
  calculateDelay,
  shouldRetry,
  ExponentialBackoff,
  LinearBackoff,
  ConstantBackoff,
} from '../retry-policy';

describe('RetryPolicy', () => {
  describe('createRetryPolicy', () => {
    it('should create policy with default values', () => {
      const policy = createRetryPolicy();

      expect(policy.maxAttempts).toBe(3);
      expect(policy.baseDelayMs).toBe(1000);
      expect(policy.maxDelayMs).toBe(30000);
      expect(policy.backoffStrategy).toBe('exponential');
    });

    it('should create policy with custom values', () => {
      const policy = createRetryPolicy({
        maxAttempts: 5,
        baseDelayMs: 500,
        maxDelayMs: 60000,
        backoffStrategy: 'linear',
        jitterFactor: 0.2,
      });

      expect(policy.maxAttempts).toBe(5);
      expect(policy.baseDelayMs).toBe(500);
      expect(policy.backoffStrategy).toBe('linear');
      expect(policy.jitterFactor).toBe(0.2);
    });

    it('should validate max attempts is positive', () => {
      expect(() => createRetryPolicy({ maxAttempts: 0 })).toThrow();
      expect(() => createRetryPolicy({ maxAttempts: -1 })).toThrow();
    });

    it('should validate base delay is positive', () => {
      expect(() => createRetryPolicy({ baseDelayMs: 0 })).toThrow();
      expect(() => createRetryPolicy({ baseDelayMs: -100 })).toThrow();
    });
  });

  describe('ExponentialBackoff', () => {
    const backoff = new ExponentialBackoff({
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      factor: 2,
    });

    it('should calculate exponential delays', () => {
      expect(backoff.getDelay(1)).toBe(1000);  // base * 2^0
      expect(backoff.getDelay(2)).toBe(2000);  // base * 2^1
      expect(backoff.getDelay(3)).toBe(4000);  // base * 2^2
      expect(backoff.getDelay(4)).toBe(8000);  // base * 2^3
    });

    it('should cap delay at maxDelayMs', () => {
      expect(backoff.getDelay(10)).toBe(30000);
      expect(backoff.getDelay(100)).toBe(30000);
    });

    it('should apply jitter when specified', () => {
      const backoffWithJitter = new ExponentialBackoff({
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        factor: 2,
        jitterFactor: 0.1,
      });

      const delay = backoffWithJitter.getDelay(2);
      // With 10% jitter, delay should be between 1800 and 2200
      expect(delay).toBeGreaterThanOrEqual(1800);
      expect(delay).toBeLessThanOrEqual(2200);
    });
  });

  describe('LinearBackoff', () => {
    const backoff = new LinearBackoff({
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      increment: 1000,
    });

    it('should calculate linear delays', () => {
      expect(backoff.getDelay(1)).toBe(1000);
      expect(backoff.getDelay(2)).toBe(2000);
      expect(backoff.getDelay(3)).toBe(3000);
      expect(backoff.getDelay(4)).toBe(4000);
    });

    it('should cap delay at maxDelayMs', () => {
      expect(backoff.getDelay(20)).toBe(10000);
    });
  });

  describe('ConstantBackoff', () => {
    const backoff = new ConstantBackoff({
      delayMs: 5000,
    });

    it('should return constant delay', () => {
      expect(backoff.getDelay(1)).toBe(5000);
      expect(backoff.getDelay(5)).toBe(5000);
      expect(backoff.getDelay(100)).toBe(5000);
    });
  });

  describe('shouldRetry', () => {
    const policy = createRetryPolicy({
      maxAttempts: 3,
      retryableErrors: ['RATE_LIMITED', 'TIMEOUT', 'NETWORK_ERROR'],
    });

    it('should return true for retryable error under max attempts', () => {
      expect(shouldRetry(policy, 'RATE_LIMITED', 1)).toBe(true);
      expect(shouldRetry(policy, 'TIMEOUT', 2)).toBe(true);
    });

    it('should return false when max attempts reached', () => {
      expect(shouldRetry(policy, 'RATE_LIMITED', 3)).toBe(false);
      expect(shouldRetry(policy, 'TIMEOUT', 4)).toBe(false);
    });

    it('should return false for non-retryable error', () => {
      expect(shouldRetry(policy, 'INVALID_CREDENTIALS', 1)).toBe(false);
      expect(shouldRetry(policy, 'CONTENT_POLICY_VIOLATION', 1)).toBe(false);
    });
  });
});
```

#### 1.2 Retry Executor Tests
```typescript
// packages/verification/src/__tests__/retry-executor.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryExecutor, RetryResult } from '../retry-executor';
import { createRetryPolicy } from '../retry-policy';

describe('RetryExecutor', () => {
  let executor: RetryExecutor;

  beforeEach(() => {
    executor = new RetryExecutor({
      policy: createRetryPolicy({
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
      }),
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('execute', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const resultPromise = executor.execute(operation);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient failure and succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce({ code: 'RATE_LIMITED' })
        .mockRejectedValueOnce({ code: 'TIMEOUT' })
        .mockResolvedValue('success');

      const resultPromise = executor.execute(operation, {
        isRetryable: (err) => ['RATE_LIMITED', 'TIMEOUT'].includes(err.code),
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
      expect(result.attempts).toBe(3);
    });

    it('should fail after max attempts', async () => {
      const operation = vi
        .fn()
        .mockRejectedValue({ code: 'RATE_LIMITED', message: 'Too many requests' });

      const resultPromise = executor.execute(operation, {
        isRetryable: (err) => err.code === 'RATE_LIMITED',
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMITED');
      expect(result.attempts).toBe(3);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValue({ code: 'INVALID_CREDENTIALS' });

      const resultPromise = executor.execute(operation, {
        isRetryable: (err) => err.code === 'RATE_LIMITED',
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should wait between retries with exponential backoff', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce({ code: 'RATE_LIMITED' })
        .mockRejectedValueOnce({ code: 'RATE_LIMITED' })
        .mockResolvedValue('success');

      const delays: number[] = [];
      const originalSetTimeout = setTimeout;

      vi.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
        delays.push(delay as number);
        return originalSetTimeout(fn, 0);
      });

      const resultPromise = executor.execute(operation, {
        isRetryable: () => true,
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      // Exponential backoff: 100ms, 200ms
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
    });

    it('should call onRetry callback', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce({ code: 'TIMEOUT' })
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      const resultPromise = executor.execute(operation, {
        isRetryable: () => true,
        onRetry,
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          error: { code: 'TIMEOUT' },
          nextDelayMs: expect.any(Number),
        })
      );
    });

    it('should respect timeout per attempt', async () => {
      const operation = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const resultPromise = executor.execute(operation, {
        timeoutMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });
  });

  describe('executeWithCircuitBreaker', () => {
    it('should open circuit after consecutive failures', async () => {
      const operation = vi.fn().mockRejectedValue({ code: 'SERVICE_UNAVAILABLE' });

      // Fail 5 times to open circuit
      for (let i = 0; i < 5; i++) {
        const resultPromise = executor.executeWithCircuitBreaker(operation, {
          circuitBreaker: {
            threshold: 5,
            resetTimeMs: 30000,
          },
          isRetryable: () => true,
        });
        await vi.runAllTimersAsync();
        await resultPromise;
      }

      // Next call should fail immediately
      const resultPromise = executor.executeWithCircuitBreaker(operation, {
        circuitBreaker: {
          threshold: 5,
          resetTimeMs: 30000,
        },
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CIRCUIT_OPEN');
      expect(operation).toHaveBeenCalledTimes(15); // 5 attempts * 3 retries
    });
  });
});
```

#### 1.3 Platform-Specific Retry Tests
```typescript
// packages/verification/src/__tests__/platform-retry-policies.test.ts
import { describe, it, expect } from 'vitest';
import {
  getPlatformRetryPolicy,
  FACEBOOK_RETRY_POLICY,
  INSTAGRAM_RETRY_POLICY,
  TIKTOK_RETRY_POLICY,
  YOUTUBE_RETRY_POLICY,
  LINKEDIN_RETRY_POLICY,
  X_RETRY_POLICY,
} from '../platform-retry-policies';

describe('Platform Retry Policies', () => {
  describe('FACEBOOK_RETRY_POLICY', () => {
    it('should have appropriate limits for Facebook', () => {
      expect(FACEBOOK_RETRY_POLICY.maxAttempts).toBe(5);
      expect(FACEBOOK_RETRY_POLICY.baseDelayMs).toBe(1000);
      expect(FACEBOOK_RETRY_POLICY.retryableErrors).toContain(190); // Token expired
      expect(FACEBOOK_RETRY_POLICY.retryableErrors).toContain(17); // Rate limit
    });
  });

  describe('INSTAGRAM_RETRY_POLICY', () => {
    it('should have appropriate limits for Instagram', () => {
      expect(INSTAGRAM_RETRY_POLICY.maxAttempts).toBe(5);
      expect(INSTAGRAM_RETRY_POLICY.retryableErrors).toContain(4); // Rate limit
      expect(INSTAGRAM_RETRY_POLICY.retryableErrors).toContain(190); // Token expired
    });
  });

  describe('TIKTOK_RETRY_POLICY', () => {
    it('should have appropriate limits for TikTok', () => {
      expect(TIKTOK_RETRY_POLICY.maxAttempts).toBe(3);
      expect(TIKTOK_RETRY_POLICY.retryableErrors).toContain('spam_risk_too_many_pending_share');
      expect(TIKTOK_RETRY_POLICY.retryableErrors).toContain('rate_limit_exceeded');
    });
  });

  describe('YOUTUBE_RETRY_POLICY', () => {
    it('should have longer delays for YouTube', () => {
      expect(YOUTUBE_RETRY_POLICY.baseDelayMs).toBeGreaterThan(1000);
      expect(YOUTUBE_RETRY_POLICY.retryableErrors).toContain('quotaExceeded');
      expect(YOUTUBE_RETRY_POLICY.retryableErrors).toContain('rateLimitExceeded');
    });
  });

  describe('LINKEDIN_RETRY_POLICY', () => {
    it('should handle LinkedIn rate limits', () => {
      expect(LINKEDIN_RETRY_POLICY.retryableErrors).toContain(429);
      expect(LINKEDIN_RETRY_POLICY.retryableErrors).toContain('TRANSIENT');
    });
  });

  describe('X_RETRY_POLICY', () => {
    it('should handle X rate limits', () => {
      expect(X_RETRY_POLICY.retryableErrors).toContain(429);
      expect(X_RETRY_POLICY.retryableErrors).toContain(503);
      expect(X_RETRY_POLICY.retryableErrors).toContain('Too Many Requests');
    });
  });

  describe('getPlatformRetryPolicy', () => {
    it('should return correct policy for each platform', () => {
      expect(getPlatformRetryPolicy('facebook')).toBe(FACEBOOK_RETRY_POLICY);
      expect(getPlatformRetryPolicy('instagram')).toBe(INSTAGRAM_RETRY_POLICY);
      expect(getPlatformRetryPolicy('tiktok')).toBe(TIKTOK_RETRY_POLICY);
      expect(getPlatformRetryPolicy('youtube')).toBe(YOUTUBE_RETRY_POLICY);
      expect(getPlatformRetryPolicy('linkedin')).toBe(LINKEDIN_RETRY_POLICY);
      expect(getPlatformRetryPolicy('x')).toBe(X_RETRY_POLICY);
    });

    it('should return default policy for unknown platform', () => {
      const policy = getPlatformRetryPolicy('unknown' as any);
      expect(policy.maxAttempts).toBe(3);
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Create Retry Policy
```typescript
// packages/verification/src/retry-policy.ts
import { Platform } from './types';

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffStrategy: 'exponential' | 'linear' | 'constant';
  jitterFactor: number;
  retryableErrors: (string | number)[];
}

interface CreateRetryPolicyParams {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffStrategy?: 'exponential' | 'linear' | 'constant';
  jitterFactor?: number;
  retryableErrors?: (string | number)[];
}

export function createRetryPolicy(params: CreateRetryPolicyParams = {}): RetryPolicy {
  const maxAttempts = params.maxAttempts ?? 3;
  const baseDelayMs = params.baseDelayMs ?? 1000;

  if (maxAttempts <= 0) {
    throw new Error('maxAttempts must be positive');
  }

  if (baseDelayMs <= 0) {
    throw new Error('baseDelayMs must be positive');
  }

  return {
    maxAttempts,
    baseDelayMs,
    maxDelayMs: params.maxDelayMs ?? 30000,
    backoffStrategy: params.backoffStrategy ?? 'exponential',
    jitterFactor: params.jitterFactor ?? 0,
    retryableErrors: params.retryableErrors ?? [],
  };
}

export function shouldRetry(
  policy: RetryPolicy,
  errorCode: string | number,
  attempt: number
): boolean {
  if (attempt >= policy.maxAttempts) {
    return false;
  }

  if (policy.retryableErrors.length === 0) {
    return true;
  }

  return policy.retryableErrors.includes(errorCode);
}

interface BackoffConfig {
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor?: number;
}

export class ExponentialBackoff {
  private config: BackoffConfig & { factor: number };

  constructor(config: BackoffConfig & { factor?: number }) {
    this.config = {
      ...config,
      factor: config.factor ?? 2,
      jitterFactor: config.jitterFactor ?? 0,
    };
  }

  getDelay(attempt: number): number {
    const exponentialDelay =
      this.config.baseDelayMs * Math.pow(this.config.factor, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);

    if (this.config.jitterFactor && this.config.jitterFactor > 0) {
      const jitter = cappedDelay * this.config.jitterFactor;
      return cappedDelay + (Math.random() * 2 - 1) * jitter;
    }

    return cappedDelay;
  }
}

export class LinearBackoff {
  private config: BackoffConfig & { increment: number };

  constructor(config: BackoffConfig & { increment?: number }) {
    this.config = {
      ...config,
      increment: config.increment ?? config.baseDelayMs,
    };
  }

  getDelay(attempt: number): number {
    const linearDelay = this.config.baseDelayMs + this.config.increment * (attempt - 1);
    return Math.min(linearDelay, this.config.maxDelayMs);
  }
}

export class ConstantBackoff {
  private delayMs: number;

  constructor(config: { delayMs: number }) {
    this.delayMs = config.delayMs;
  }

  getDelay(_attempt: number): number {
    return this.delayMs;
  }
}

export function calculateDelay(
  policy: RetryPolicy,
  attempt: number
): number {
  switch (policy.backoffStrategy) {
    case 'exponential':
      return new ExponentialBackoff({
        baseDelayMs: policy.baseDelayMs,
        maxDelayMs: policy.maxDelayMs,
        jitterFactor: policy.jitterFactor,
      }).getDelay(attempt);

    case 'linear':
      return new LinearBackoff({
        baseDelayMs: policy.baseDelayMs,
        maxDelayMs: policy.maxDelayMs,
      }).getDelay(attempt);

    case 'constant':
      return new ConstantBackoff({
        delayMs: policy.baseDelayMs,
      }).getDelay(attempt);

    default:
      return policy.baseDelayMs;
  }
}
```

#### 2.2 Create Retry Executor
```typescript
// packages/verification/src/retry-executor.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { RetryPolicy, calculateDelay, shouldRetry } from './retry-policy';

const tracer = trace.getTracer('retry-executor');

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: { code: string; message: string };
  attempts: number;
  totalTimeMs: number;
}

interface ExecuteOptions<E = unknown> {
  isRetryable?: (error: E) => boolean;
  onRetry?: (info: RetryInfo) => void;
  timeoutMs?: number;
}

interface RetryInfo {
  attempt: number;
  error: unknown;
  nextDelayMs: number;
}

interface CircuitBreakerOptions {
  threshold: number;
  resetTimeMs: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number | null;
  isOpen: boolean;
}

interface RetryExecutorConfig {
  policy: RetryPolicy;
}

export class RetryExecutor {
  private policy: RetryPolicy;
  private circuitState: Map<string, CircuitBreakerState> = new Map();

  constructor(config: RetryExecutorConfig) {
    this.policy = config.policy;
  }

  async execute<T, E = unknown>(
    operation: () => Promise<T>,
    options: ExecuteOptions<E> = {}
  ): Promise<RetryResult<T>> {
    return tracer.startActiveSpan('retryExecute', async (span) => {
      const startTime = Date.now();
      let attempts = 0;
      let lastError: any = null;

      while (attempts < this.policy.maxAttempts) {
        attempts++;
        span.setAttributes({ 'retry.attempt': attempts });

        try {
          const value = await this.executeWithTimeout(
            operation,
            options.timeoutMs
          );

          span.setStatus({ code: SpanStatusCode.OK });
          span.end();

          return {
            success: true,
            value,
            attempts,
            totalTimeMs: Date.now() - startTime,
          };
        } catch (error: any) {
          lastError = error;

          const errorCode = error.code || error.status || 'UNKNOWN';
          const isRetryable = options.isRetryable
            ? options.isRetryable(error as E)
            : shouldRetry(this.policy, errorCode, attempts);

          if (!isRetryable || attempts >= this.policy.maxAttempts) {
            break;
          }

          const delay = calculateDelay(this.policy, attempts);

          if (options.onRetry) {
            options.onRetry({
              attempt: attempts,
              error,
              nextDelayMs: delay,
            });
          }

          await this.sleep(delay);
        }
      }

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: lastError?.message || 'Max retries exceeded',
      });
      span.end();

      return {
        success: false,
        error: {
          code: lastError?.code || 'UNKNOWN',
          message: lastError?.message || 'Operation failed',
        },
        attempts,
        totalTimeMs: Date.now() - startTime,
      };
    });
  }

  async executeWithCircuitBreaker<T, E = unknown>(
    operation: () => Promise<T>,
    options: ExecuteOptions<E> & { circuitBreaker?: CircuitBreakerOptions } = {}
  ): Promise<RetryResult<T>> {
    const circuitKey = 'default';
    const state = this.getCircuitState(circuitKey);

    if (options.circuitBreaker) {
      // Check if circuit is open
      if (state.isOpen) {
        const timeSinceLastFailure = Date.now() - (state.lastFailure || 0);
        if (timeSinceLastFailure < options.circuitBreaker.resetTimeMs) {
          return {
            success: false,
            error: { code: 'CIRCUIT_OPEN', message: 'Circuit breaker is open' },
            attempts: 0,
            totalTimeMs: 0,
          };
        }
        // Reset circuit for half-open state
        state.isOpen = false;
        state.failures = 0;
      }
    }

    const result = await this.execute(operation, options);

    if (options.circuitBreaker && !result.success) {
      state.failures++;
      state.lastFailure = Date.now();
      if (state.failures >= options.circuitBreaker.threshold) {
        state.isOpen = true;
      }
      this.circuitState.set(circuitKey, state);
    } else if (result.success) {
      // Reset on success
      state.failures = 0;
      state.isOpen = false;
      this.circuitState.set(circuitKey, state);
    }

    return result;
  }

  private getCircuitState(key: string): CircuitBreakerState {
    if (!this.circuitState.has(key)) {
      this.circuitState.set(key, {
        failures: 0,
        lastFailure: null,
        isOpen: false,
      });
    }
    return this.circuitState.get(key)!;
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (!timeoutMs) {
      return operation();
    }

    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject({ code: 'TIMEOUT', message: 'Operation timed out' }),
          timeoutMs
        )
      ),
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

#### 2.3 Create Platform-Specific Policies
```typescript
// packages/verification/src/platform-retry-policies.ts
import { RetryPolicy, createRetryPolicy } from './retry-policy';
import { Platform } from './types';

export const FACEBOOK_RETRY_POLICY = createRetryPolicy({
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  backoffStrategy: 'exponential',
  jitterFactor: 0.1,
  retryableErrors: [
    17,   // Rate limit
    190,  // Token expired (can refresh)
    368,  // Temporarily blocked
    1,    // Unknown error
    2,    // Service temporarily unavailable
  ],
});

export const INSTAGRAM_RETRY_POLICY = createRetryPolicy({
  maxAttempts: 5,
  baseDelayMs: 2000,
  maxDelayMs: 120000,
  backoffStrategy: 'exponential',
  jitterFactor: 0.2,
  retryableErrors: [
    4,    // Rate limit
    190,  // Token expired
    1,    // Unknown error
    2,    // Service temporarily unavailable
  ],
});

export const TIKTOK_RETRY_POLICY = createRetryPolicy({
  maxAttempts: 3,
  baseDelayMs: 5000,
  maxDelayMs: 60000,
  backoffStrategy: 'exponential',
  jitterFactor: 0.1,
  retryableErrors: [
    'spam_risk_too_many_pending_share',
    'rate_limit_exceeded',
    'internal_error',
  ],
});

export const YOUTUBE_RETRY_POLICY = createRetryPolicy({
  maxAttempts: 5,
  baseDelayMs: 5000,
  maxDelayMs: 300000, // 5 minutes max for quota
  backoffStrategy: 'exponential',
  jitterFactor: 0.2,
  retryableErrors: [
    'quotaExceeded',
    'rateLimitExceeded',
    'backendError',
    'serviceUnavailable',
  ],
});

export const LINKEDIN_RETRY_POLICY = createRetryPolicy({
  maxAttempts: 3,
  baseDelayMs: 2000,
  maxDelayMs: 60000,
  backoffStrategy: 'exponential',
  jitterFactor: 0.1,
  retryableErrors: [
    429,  // Rate limit
    500,  // Internal error
    502,  // Bad gateway
    503,  // Service unavailable
    'TRANSIENT',
  ],
});

export const X_RETRY_POLICY = createRetryPolicy({
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 900000, // 15 minutes for rate limit window
  backoffStrategy: 'exponential',
  jitterFactor: 0.1,
  retryableErrors: [
    429,  // Rate limit
    500,  // Internal error
    502,  // Bad gateway
    503,  // Service unavailable
    'Too Many Requests',
    'Service Unavailable',
  ],
});

const DEFAULT_RETRY_POLICY = createRetryPolicy({
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffStrategy: 'exponential',
});

const PLATFORM_POLICIES: Record<Platform, RetryPolicy> = {
  facebook: FACEBOOK_RETRY_POLICY,
  instagram: INSTAGRAM_RETRY_POLICY,
  tiktok: TIKTOK_RETRY_POLICY,
  youtube: YOUTUBE_RETRY_POLICY,
  linkedin: LINKEDIN_RETRY_POLICY,
  x: X_RETRY_POLICY,
  skool: DEFAULT_RETRY_POLICY,
};

export function getPlatformRetryPolicy(platform: Platform): RetryPolicy {
  return PLATFORM_POLICIES[platform] || DEFAULT_RETRY_POLICY;
}
```

### Phase 3: Verification

```bash
# Run tests
cd packages/verification && pnpm test

# Run with coverage
pnpm test:coverage

# Verify types
pnpm typecheck

# Lint
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/verification/src/retry-policy.ts` | Retry policy and backoff strategies |
| Create | `packages/verification/src/retry-executor.ts` | Retry execution engine |
| Create | `packages/verification/src/platform-retry-policies.ts` | Platform-specific policies |
| Create | `packages/verification/src/__tests__/retry-policy.test.ts` | Policy tests |
| Create | `packages/verification/src/__tests__/retry-executor.test.ts` | Executor tests |
| Create | `packages/verification/src/__tests__/platform-retry-policies.test.ts` | Platform policy tests |
| Modify | `packages/verification/src/index.ts` | Export retry module |

---

## Acceptance Criteria

- [ ] Exponential, linear, and constant backoff strategies implemented
- [ ] Jitter support for avoiding thundering herd
- [ ] Platform-specific retry policies with appropriate error codes
- [ ] Circuit breaker pattern for cascading failure prevention
- [ ] Per-attempt timeout support
- [ ] onRetry callback for telemetry
- [ ] Unit tests achieve 90%+ coverage

---

## Test Requirements

### Unit Tests
- Backoff calculation (all strategies)
- shouldRetry logic
- RetryExecutor success/failure paths
- Circuit breaker state transitions
- Platform policy error code matching

### Integration Tests
- End-to-end retry with mocked operations
- Timeout handling
- Concurrent retry operations

---

## Security & Safety Checklist

- [ ] No secrets in retry logic
- [ ] Retry delays respect platform rate limits
- [ ] Circuit breaker prevents API abuse
- [ ] Telemetry tracks retry patterns (no sensitive data)
- [ ] Max attempts prevent infinite loops

---

## JSON Task Block

```json
{
  "task_id": "S3-D3",
  "name": "Retry Logic",
  "description": "Exponential backoff and platform-specific retry policies for handling transient failures",
  "status": "pending",
  "priority": "medium",
  "complexity": "medium",
  "sprint": 3,
  "agent": "D",
  "dependencies": ["S3-D1", "S3-D4"],
  "blocks": [],
  "estimated_hours": 12,
  "actual_hours": null,
  "tags": ["verification", "retry", "backoff", "circuit-breaker", "tdd"],
  "package": "@rtv/verification",
  "files": {
    "create": [
      "packages/verification/src/retry-policy.ts",
      "packages/verification/src/retry-executor.ts",
      "packages/verification/src/platform-retry-policies.ts"
    ],
    "modify": [
      "packages/verification/src/index.ts"
    ],
    "delete": []
  },
  "acceptance_criteria": [
    "Exponential, linear, constant backoff",
    "Jitter for thundering herd prevention",
    "Platform-specific retry policies",
    "Circuit breaker pattern",
    "90%+ test coverage"
  ]
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "key_decisions": [],
  "patterns_discovered": [],
  "references_used": [],
  "artifacts_created": [],
  "retry_configurations": {},
  "next_task_hints": [
    "Integrate with VerificationService",
    "Add platform-specific error handling"
  ]
}
```
