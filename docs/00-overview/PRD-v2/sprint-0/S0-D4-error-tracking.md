# Build Prompt: S0-D4 — Error Tracking Setup

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-D4 |
| **Sprint** | 0 — Foundation |
| **Agent** | D — Observability Baseline |
| **Complexity** | Medium |
| **Estimated Effort** | 2-3 hours |
| **Dependencies** | S0-D1, S0-D2 |
| **Blocks** | Sprint 1 |

---

## Context

### What We're Building

Create a centralized error tracking system that captures errors with full context, correlates them with traces and logs, and provides utilities for error classification and handling.

### Why This Matters

- **Visibility**: Know when errors happen in production
- **Context**: Understand what led to the error
- **Classification**: Distinguish transient from permanent failures
- **Alerting**: Get notified of critical errors

### Spec References

- `/docs/06-reliability-ops/observability-dashboard.md#3-error-tracking`
- `/docs/06-reliability-ops/incident-runbooks-postmortem.md`

**Critical Requirement (from observability-dashboard.md):**
> All errors must be captured with: stack trace, correlation_id, client_id, operation context, and error classification (transient/permanent).

---

## Prerequisites

### Completed Tasks

- [x] S0-D1: OpenTelemetry instrumentation
- [x] S0-D2: Structured logging

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/observability/src/__tests__/errors.test.ts`**

```typescript
import { describe, test, expect, vi } from 'vitest';
import {
  captureError,
  classifyError,
  ErrorClassification,
  createErrorContext,
  isTransientError,
  wrapWithErrorHandling,
} from '../errors';

describe('Error Tracking', () => {
  test('captureError logs error with context', () => {
    const error = new Error('Test error');
    const context = { operation: 'test', clientId: 'client-123' };

    // Should not throw
    expect(() => captureError(error, context)).not.toThrow();
  });

  test('classifyError identifies transient errors', () => {
    const networkError = new Error('ECONNRESET');
    const classification = classifyError(networkError);

    expect(classification).toBe(ErrorClassification.TRANSIENT);
  });

  test('classifyError identifies permanent errors', () => {
    const validationError = new Error('Invalid input: email is required');
    validationError.name = 'ValidationError';
    const classification = classifyError(validationError);

    expect(classification).toBe(ErrorClassification.PERMANENT);
  });

  test('classifyError identifies rate limit errors', () => {
    const rateLimitError = new Error('Rate limit exceeded');
    rateLimitError.name = 'RateLimitError';
    const classification = classifyError(rateLimitError);

    expect(classification).toBe(ErrorClassification.RATE_LIMITED);
  });

  test('isTransientError returns true for transient errors', () => {
    const error = new Error('Connection timeout');
    expect(isTransientError(error)).toBe(true);
  });

  test('createErrorContext builds context object', () => {
    const context = createErrorContext({
      operation: 'publish',
      clientId: 'client-123',
      platform: 'instagram',
    });

    expect(context.operation).toBe('publish');
    expect(context.clientId).toBe('client-123');
    expect(context.timestamp).toBeDefined();
  });

  test('wrapWithErrorHandling catches and captures errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Test error'));

    await expect(
      wrapWithErrorHandling('test-op', fn, { clientId: 'client-123' })
    ).rejects.toThrow('Test error');

    expect(fn).toHaveBeenCalled();
  });

  test('wrapWithErrorHandling returns result on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await wrapWithErrorHandling('test-op', fn, {});
    expect(result).toBe('success');
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Error Types

**File: `packages/observability/src/errors.ts`**

```bash
cat > packages/observability/src/errors.ts << 'EOF'
/**
 * Error tracking and classification
 *
 * Provides utilities for capturing, classifying, and handling errors
 * with full observability context.
 */

import { getCurrentSpan } from './tracing';
import { getLogger } from './logging';
import type { Logger } from 'pino';

/**
 * Error classification
 */
export enum ErrorClassification {
  /** Error is likely temporary, retry may succeed */
  TRANSIENT = 'transient',
  /** Error is permanent, do not retry */
  PERMANENT = 'permanent',
  /** Rate limited, retry with backoff */
  RATE_LIMITED = 'rate_limited',
  /** Unknown classification */
  UNKNOWN = 'unknown',
}

/**
 * Error context for tracking
 */
export interface ErrorContext {
  operation: string;
  clientId?: string;
  userId?: string;
  platform?: string;
  targetType?: string;
  targetId?: string;
  requestId?: string;
  correlationId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Captured error with full context
 */
export interface CapturedError {
  error: Error;
  context: ErrorContext;
  classification: ErrorClassification;
  traceId?: string;
  spanId?: string;
}

// Patterns for classifying errors
const TRANSIENT_PATTERNS = [
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /timeout/i,
  /network/i,
  /connection/i,
  /temporarily unavailable/i,
  /service unavailable/i,
  /503/,
  /502/,
  /504/,
];

const RATE_LIMIT_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /429/,
  /quota exceeded/i,
  /throttl/i,
];

const PERMANENT_ERROR_NAMES = [
  'ValidationError',
  'TypeError',
  'SyntaxError',
  'AuthenticationError',
  'AuthorizationError',
  'NotFoundError',
  'BadRequestError',
];

let logger: Logger | null = null;

function getErrorLogger(): Logger {
  if (!logger) {
    logger = getLogger().child({ module: 'error-tracking' });
  }
  return logger;
}

/**
 * Classify an error as transient, permanent, or rate-limited
 */
export function classifyError(error: Error): ErrorClassification {
  const message = error.message || '';
  const name = error.name || '';

  // Check for rate limiting first
  if (name === 'RateLimitError' || RATE_LIMIT_PATTERNS.some((p) => p.test(message))) {
    return ErrorClassification.RATE_LIMITED;
  }

  // Check for known permanent error types
  if (PERMANENT_ERROR_NAMES.includes(name)) {
    return ErrorClassification.PERMANENT;
  }

  // Check for transient patterns
  if (TRANSIENT_PATTERNS.some((p) => p.test(message))) {
    return ErrorClassification.TRANSIENT;
  }

  // Default to unknown
  return ErrorClassification.UNKNOWN;
}

/**
 * Check if an error is transient (retriable)
 */
export function isTransientError(error: Error): boolean {
  const classification = classifyError(error);
  return (
    classification === ErrorClassification.TRANSIENT ||
    classification === ErrorClassification.RATE_LIMITED
  );
}

/**
 * Check if an error is permanent (should not retry)
 */
export function isPermanentError(error: Error): boolean {
  return classifyError(error) === ErrorClassification.PERMANENT;
}

/**
 * Create error context
 */
export function createErrorContext(
  params: Omit<ErrorContext, 'timestamp'>
): ErrorContext {
  return {
    ...params,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Capture an error with full context
 */
export function captureError(
  error: Error,
  contextParams?: Partial<Omit<ErrorContext, 'timestamp' | 'operation'>> & {
    operation?: string;
  }
): CapturedError {
  const log = getErrorLogger();
  const span = getCurrentSpan();
  const classification = classifyError(error);

  const context: ErrorContext = {
    operation: contextParams?.operation ?? 'unknown',
    ...contextParams,
    timestamp: new Date().toISOString(),
  };

  // Add trace context
  let traceId: string | undefined;
  let spanId: string | undefined;
  if (span) {
    const spanContext = span.spanContext();
    traceId = spanContext.traceId;
    spanId = spanContext.spanId;
    context.correlationId = traceId;
  }

  // Log the error
  log.error(
    {
      err: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      context,
      classification,
      traceId,
      spanId,
    },
    `Error in ${context.operation}: ${error.message}`
  );

  // Record on span
  if (span) {
    span.recordException(error);
    span.setAttribute('error.classification', classification);
  }

  return {
    error,
    context,
    classification,
    traceId,
    spanId,
  };
}

/**
 * Wrap a function with error handling
 */
export async function wrapWithErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
  contextParams?: Omit<ErrorContext, 'timestamp' | 'operation'>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    captureError(error instanceof Error ? error : new Error(String(error)), {
      operation,
      ...contextParams,
    });
    throw error;
  }
}

/**
 * Create an error handler for a specific operation
 */
export function createErrorHandler(
  operation: string,
  defaultContext?: Omit<ErrorContext, 'timestamp' | 'operation'>
) {
  return (error: Error, additionalContext?: Record<string, unknown>) => {
    return captureError(error, {
      operation,
      ...defaultContext,
      metadata: { ...defaultContext?.metadata, ...additionalContext },
    });
  };
}

/**
 * Safe wrapper that catches errors and returns a result
 */
export async function safeExecute<T>(
  operation: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    captureError(error instanceof Error ? error : new Error(String(error)), {
      operation,
    });
    return fallback;
  }
}

/**
 * Get retry delay based on error classification
 */
export function getRetryDelay(
  error: Error,
  attempt: number,
  baseDelayMs = 1000
): number {
  const classification = classifyError(error);

  switch (classification) {
    case ErrorClassification.RATE_LIMITED:
      // Longer backoff for rate limits
      return Math.min(baseDelayMs * Math.pow(3, attempt), 60000);
    case ErrorClassification.TRANSIENT:
      // Standard exponential backoff
      return Math.min(baseDelayMs * Math.pow(2, attempt), 30000);
    default:
      // No retry for permanent errors
      return 0;
  }
}

/**
 * Check if an error should be retried
 */
export function shouldRetry(error: Error, attempt: number, maxAttempts = 3): boolean {
  if (attempt >= maxAttempts) {
    return false;
  }

  const classification = classifyError(error);
  return (
    classification === ErrorClassification.TRANSIENT ||
    classification === ErrorClassification.RATE_LIMITED
  );
}
EOF
```

#### Step 2: Update Package Index

**File: `packages/observability/src/index.ts`** (update)

```bash
cat > packages/observability/src/index.ts << 'EOF'
/**
 * @rtv/observability - Observability package
 *
 * Provides tracing, metrics, logging, auditing, and error tracking
 * for the RTV platform.
 */

// Tracing
export {
  initTracing,
  shutdownTracing,
  getTracer,
  getCurrentSpan,
  getCurrentContext,
  createSpan,
  withSpan,
  addSpanAttributes,
  addSpanEvent,
  setTenantContext,
  type TracingConfig,
} from './tracing';

// Logging
export {
  createLogger,
  getLogger,
  setDefaultLogger,
  withLogContext,
  withTenantLogger,
  withRequestLogger,
  createModuleLogger,
  logOperation,
  redactSensitive,
  LogLevel,
  type Logger,
  type LogContext,
  type LoggerConfig,
  type LogLevelType,
} from './logging';

// Auditing
export {
  AuditEmitter,
  createAuditEmitter,
  getAuditEmitter,
  emitAuditEvent,
  audit,
  type AuditEventInput,
  type AuditEventResult,
  type AuditProof,
  type AuditMetadata,
  type AuditActorType,
  type AuditOutcome,
  type AuditEmitterConfig,
} from './audit';

// Error Tracking
export {
  ErrorClassification,
  captureError,
  classifyError,
  isTransientError,
  isPermanentError,
  createErrorContext,
  wrapWithErrorHandling,
  createErrorHandler,
  safeExecute,
  getRetryDelay,
  shouldRetry,
  type ErrorContext,
  type CapturedError,
} from './errors';

// Metrics
export {
  initMetrics,
  getMeter,
  createCounter,
  createHistogram,
} from './metrics';

// Re-export common OTEL types
export { SpanStatusCode, SpanKind } from '@opentelemetry/api';
EOF
```

### Phase 3: Verification

```bash
cd packages/observability

# Build
pnpm build

# Typecheck
pnpm typecheck

# Run tests
pnpm test

# Test error tracking manually
cat > test-errors.ts << 'EOF'
import { captureError, classifyError, ErrorClassification, wrapWithErrorHandling } from './src/errors';
import { createLogger, setDefaultLogger } from './src/logging';

setDefaultLogger(createLogger({ name: 'test' }));

// Test classification
console.log('Testing error classification...');
console.log('ECONNRESET:', classifyError(new Error('ECONNRESET')));
console.log('Validation:', classifyError(Object.assign(new Error('Invalid'), { name: 'ValidationError' })));
console.log('Rate limit:', classifyError(new Error('Rate limit exceeded')));

// Test capture
console.log('\nTesting error capture...');
captureError(new Error('Test error'), {
  operation: 'test',
  clientId: 'client-123',
});

// Test wrapper
console.log('\nTesting wrapper...');
wrapWithErrorHandling('test-op', async () => {
  throw new Error('Wrapped error');
}, { clientId: 'client-123' }).catch(() => console.log('Caught wrapped error'));
EOF

npx tsx test-errors.ts
rm test-errors.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/observability/src/errors.ts` | Error tracking |
| Modify | `packages/observability/src/index.ts` | Export errors |
| Create | `packages/observability/src/__tests__/errors.test.ts` | Error tests |

---

## Acceptance Criteria

- [ ] `captureError()` logs errors with full context
- [ ] `classifyError()` identifies transient/permanent/rate-limited
- [ ] `isTransientError()` returns correct boolean
- [ ] `wrapWithErrorHandling()` captures and re-throws
- [ ] Errors correlated with traces
- [ ] `getRetryDelay()` provides appropriate backoff
- [ ] Error tests pass

---

## Test Requirements

### Unit Tests

- Classification works for all error types
- Context building includes timestamp
- Wrapper catches and captures errors

### Integration Tests

- Errors appear in logs with correlation
- Errors recorded on spans

---

## Security & Safety Checklist

- [ ] Stack traces don't expose secrets
- [ ] Error messages sanitized
- [ ] No PII in error context
- [ ] Rate limit info doesn't leak

---

## JSON Task Block

```json
{
  "task_id": "S0-D4",
  "name": "Error Tracking Setup",
  "sprint": 0,
  "agent": "D",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 3,
  "dependencies": ["S0-D1", "S0-D2"],
  "blocks": [],
  "tags": ["observability", "errors", "debugging"],
  "acceptance_criteria": [
    "captureError works",
    "classification correct",
    "correlation with traces",
    "retry helpers work"
  ],
  "created_at": "2025-01-16T00:00:00Z",
  "updated_at": null,
  "completed_at": null
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "agent_id": null,
  "decisions": [],
  "artifacts": [],
  "notes": []
}
```

---

## Next Steps

After completing this task:

1. **S0-D5**: Implement basic metrics collection
