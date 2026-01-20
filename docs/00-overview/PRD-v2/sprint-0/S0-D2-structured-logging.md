# Build Prompt: S0-D2 — Structured Logging Setup

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-D2 |
| **Sprint** | 0 — Foundation |
| **Agent** | D — Observability Baseline |
| **Complexity** | Medium |
| **Estimated Effort** | 2-3 hours |
| **Dependencies** | S0-D1 |
| **Blocks** | S0-D3, S0-D4 |

---

## Context

### What We're Building

Create a structured logging system that outputs JSON logs with consistent format, correlation IDs, and trace context integration.

### Why This Matters

- **Searchability**: JSON logs can be queried in log aggregators
- **Correlation**: Connect logs to traces and requests
- **Consistency**: Same format across all services
- **Debugging**: Rich context for troubleshooting

### Spec References

- `/docs/06-reliability-ops/observability-dashboard.md#2-logging`
- `/docs/07-engineering-process/engineering-handbook.md#8-logging-standards`

**Critical Requirement (from observability-dashboard.md):**
> All logs must be JSON formatted with: timestamp, level, message, correlation_id, client_id (if applicable), and any additional context.

---

## Prerequisites

### Completed Tasks

- [x] S0-D1: OpenTelemetry instrumentation

### Required Packages

- pino (fast JSON logger)
- pino-pretty (development formatting)

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/observability/src/__tests__/logging.test.ts`**

```typescript
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLogger,
  getLogger,
  withLogContext,
  type LogContext,
} from '../logging';

describe('Structured Logging', () => {
  let logOutput: string[] = [];
  const originalStdout = process.stdout.write;

  beforeEach(() => {
    logOutput = [];
    // Capture log output
    process.stdout.write = vi.fn((chunk: string) => {
      logOutput.push(chunk);
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalStdout;
  });

  test('createLogger returns a logger instance', () => {
    const logger = createLogger({ name: 'test' });
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  test('logger outputs JSON format', () => {
    const logger = createLogger({ name: 'json-test', prettyPrint: false });
    logger.info('test message');

    const output = logOutput[0];
    expect(() => JSON.parse(output)).not.toThrow();

    const parsed = JSON.parse(output);
    expect(parsed.msg).toBe('test message');
    expect(parsed.level).toBeDefined();
    expect(parsed.time).toBeDefined();
  });

  test('logger includes service name', () => {
    const logger = createLogger({ name: 'my-service', prettyPrint: false });
    logger.info('test');

    const parsed = JSON.parse(logOutput[0]);
    expect(parsed.name).toBe('my-service');
  });

  test('logger can add context', () => {
    const logger = createLogger({ name: 'context-test', prettyPrint: false });
    logger.info({ userId: '123', action: 'login' }, 'User logged in');

    const parsed = JSON.parse(logOutput[0]);
    expect(parsed.userId).toBe('123');
    expect(parsed.action).toBe('login');
    expect(parsed.msg).toBe('User logged in');
  });

  test('withLogContext creates child logger', () => {
    const logger = createLogger({ name: 'parent', prettyPrint: false });
    const childLogger = withLogContext(logger, { requestId: 'req-123' });

    childLogger.info('child message');

    const parsed = JSON.parse(logOutput[0]);
    expect(parsed.requestId).toBe('req-123');
    expect(parsed.msg).toBe('child message');
  });

  test('logger has all log levels', () => {
    const logger = createLogger({ name: 'levels', prettyPrint: false });

    expect(typeof logger.trace).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.fatal).toBe('function');
  });
});
```

### Phase 2: Implementation

#### Step 1: Add Dependencies

```bash
cd packages/observability
pnpm add pino pino-pretty
pnpm add -D @types/pino
```

#### Step 2: Create Logging Module

**File: `packages/observability/src/logging.ts`**

```bash
cat > packages/observability/src/logging.ts << 'EOF'
/**
 * Structured logging with pino
 *
 * Provides JSON-formatted logs with correlation ID and trace context.
 */

import pino, { type Logger, type LoggerOptions } from 'pino';
import { getCurrentSpan } from './tracing';

/**
 * Log context type
 */
export interface LogContext {
  correlationId?: string;
  clientId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  name: string;
  level?: string;
  prettyPrint?: boolean;
  context?: LogContext;
}

// Default logger instance
let defaultLogger: Logger | null = null;

/**
 * Create a new logger instance
 */
export function createLogger(config: LoggerConfig): Logger {
  const options: LoggerOptions = {
    name: config.name,
    level: config.level ?? process.env['LOG_LEVEL'] ?? 'info',
    base: {
      pid: process.pid,
      ...config.context,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        name: bindings.name,
        pid: bindings.pid,
        hostname: bindings.hostname,
      }),
    },
    // Add trace context to every log
    mixin: () => {
      const span = getCurrentSpan();
      if (span) {
        const spanContext = span.spanContext();
        return {
          traceId: spanContext.traceId,
          spanId: spanContext.spanId,
        };
      }
      return {};
    },
  };

  // Use pretty printing in development
  const usePretty = config.prettyPrint ?? process.env['NODE_ENV'] !== 'production';

  if (usePretty) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(options);
}

/**
 * Get or create the default logger
 */
export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger({ name: 'rtv-social' });
  }
  return defaultLogger;
}

/**
 * Set the default logger
 */
export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * Create a child logger with additional context
 */
export function withLogContext(logger: Logger, context: LogContext): Logger {
  return logger.child(context);
}

/**
 * Create a logger with tenant context
 */
export function withTenantLogger(
  logger: Logger,
  clientId: string,
  userId?: string
): Logger {
  return logger.child({
    clientId,
    ...(userId && { userId }),
  });
}

/**
 * Create a logger with request context
 */
export function withRequestLogger(
  logger: Logger,
  requestId: string,
  correlationId?: string
): Logger {
  return logger.child({
    requestId,
    ...(correlationId && { correlationId }),
  });
}

/**
 * Log levels
 */
export const LogLevel = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
} as const;

export type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * Helper to create a scoped logger for a module
 */
export function createModuleLogger(moduleName: string): Logger {
  return getLogger().child({ module: moduleName });
}

/**
 * Helper to log operation start/end
 */
export function logOperation(
  logger: Logger,
  operationName: string,
  fn: () => Promise<void>
): Promise<void>;
export function logOperation<T>(
  logger: Logger,
  operationName: string,
  fn: () => Promise<T>
): Promise<T>;
export async function logOperation<T>(
  logger: Logger,
  operationName: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  logger.info({ operation: operationName }, `Starting ${operationName}`);

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;
    logger.info(
      { operation: operationName, durationMs, success: true },
      `Completed ${operationName}`
    );
    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error(
      {
        operation: operationName,
        durationMs,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      `Failed ${operationName}`
    );
    throw error;
  }
}

/**
 * Redact sensitive fields from log objects
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'cookie',
];

export function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((f) => lowerKey.includes(f))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactSensitive(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// Re-export pino types
export type { Logger } from 'pino';
EOF
```

#### Step 3: Update Package Index

**File: `packages/observability/src/index.ts`** (update)

```bash
cat > packages/observability/src/index.ts << 'EOF'
/**
 * @rtv/observability - Observability package
 *
 * Provides tracing, metrics, and logging for the RTV platform.
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

# Test logging manually
cat > test-logging.ts << 'EOF'
import { createLogger, withLogContext, logOperation } from './src/logging';

const logger = createLogger({ name: 'test-service' });

logger.info('Simple message');
logger.info({ userId: '123' }, 'Message with context');

const childLogger = withLogContext(logger, { requestId: 'req-456' });
childLogger.warn('Warning from child logger');

async function testOperation() {
  await logOperation(logger, 'database-query', async () => {
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 100));
  });
}

testOperation().catch(console.error);
EOF

npx tsx test-logging.ts
rm test-logging.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/observability/src/logging.ts` | Logging module |
| Modify | `packages/observability/src/index.ts` | Export logging |
| Create | `packages/observability/src/__tests__/logging.test.ts` | Logging tests |
| Modify | `packages/observability/package.json` | Add pino deps |

---

## Acceptance Criteria

- [ ] Logs output in JSON format (production)
- [ ] Logs output in pretty format (development)
- [ ] Correlation ID included in logs
- [ ] Trace context (traceId, spanId) included
- [ ] Child loggers inherit context
- [ ] `withTenantLogger` adds client_id
- [ ] `logOperation` helper tracks duration
- [ ] Sensitive fields redacted
- [ ] Logging tests pass

---

## Test Requirements

### Unit Tests

- Logger outputs JSON format
- Context is included in logs
- Child loggers work correctly
- All log levels exist

### Integration Tests

- Logs correlate with traces
- Pretty printing works in dev

---

## Security & Safety Checklist

- [ ] Passwords and tokens redacted
- [ ] API keys redacted
- [ ] No PII in log messages
- [ ] Sensitive fields list maintained

---

## JSON Task Block

```json
{
  "task_id": "S0-D2",
  "name": "Structured Logging Setup",
  "sprint": 0,
  "agent": "D",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 3,
  "dependencies": ["S0-D1"],
  "blocks": ["S0-D3", "S0-D4"],
  "tags": ["observability", "logging", "pino"],
  "acceptance_criteria": [
    "JSON log format",
    "trace context included",
    "tenant context support",
    "sensitive fields redacted"
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

1. **S0-D3**: Implement audit event framework
2. **S0-D4**: Set up error tracking
