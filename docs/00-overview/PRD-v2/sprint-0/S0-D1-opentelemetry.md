# Build Prompt: S0-D1 — OpenTelemetry Instrumentation

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-D1 |
| **Sprint** | 0 — Foundation |
| **Agent** | D — Observability Baseline |
| **Complexity** | High |
| **Estimated Effort** | 3-4 hours |
| **Dependencies** | S0-A1, S0-A3 |
| **Blocks** | S0-D2, S0-D3, S0-D4, S0-D5 |

---

## Context

### What We're Building

Set up OpenTelemetry (OTEL) instrumentation for distributed tracing and metrics collection across all services.

### Why This Matters

- **Visibility**: See exactly what's happening in the system
- **Debugging**: Trace requests across service boundaries
- **Performance**: Identify bottlenecks and slow operations
- **Correlation**: Connect logs, traces, and metrics

### Spec References

- `/docs/06-reliability-ops/observability-dashboard.md`
- `/docs/06-reliability-ops/slo-error-budget.md#3-measurement`

**Critical Requirement (from observability-dashboard.md):**
> Every operation must have a trace. Traces must include: correlation_id, client_id, operation_name, duration_ms, outcome.

---

## Prerequisites

### Completed Tasks

- [x] S0-A1: Monorepo scaffold
- [x] S0-A3: Core packages

### Required Tools

- OpenTelemetry SDK packages
- OTEL Collector (for production) or Jaeger (for development)

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/observability/src/__tests__/tracing.test.ts`**

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  initTracing,
  shutdownTracing,
  createSpan,
  withSpan,
  getTracer,
  getCurrentSpan,
} from '../tracing';
import { SpanStatusCode } from '@opentelemetry/api';

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
```

### Phase 2: Implementation

#### Step 1: Create Observability Package

```bash
mkdir -p packages/observability/src

cat > packages/observability/package.json << 'EOF'
{
  "name": "@rtv/observability",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./tracing": {
      "types": "./dist/tracing.d.ts",
      "import": "./dist/tracing.js"
    },
    "./metrics": {
      "types": "./dist/metrics.d.ts",
      "import": "./dist/metrics.js"
    },
    "./logging": {
      "types": "./dist/logging.d.ts",
      "import": "./dist/logging.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist .turbo",
    "dev": "tsc --watch",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/auto-instrumentations-node": "^0.41.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.48.0",
    "@opentelemetry/exporter-metrics-otlp-http": "^0.48.0",
    "@opentelemetry/instrumentation": "^0.48.0",
    "@opentelemetry/resources": "^1.21.0",
    "@opentelemetry/sdk-metrics": "^1.21.0",
    "@opentelemetry/sdk-node": "^0.48.0",
    "@opentelemetry/sdk-trace-base": "^1.21.0",
    "@opentelemetry/sdk-trace-node": "^1.21.0",
    "@opentelemetry/semantic-conventions": "^1.21.0",
    "@rtv/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "vitest": "^1.2.0"
  }
}
EOF
```

#### Step 2: Create TypeScript Config

```bash
cat > packages/observability/tsconfig.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  "references": [
    { "path": "../types" }
  ]
}
EOF
```

#### Step 3: Create Tracing Module

**File: `packages/observability/src/tracing.ts`**

```bash
cat > packages/observability/src/tracing.ts << 'EOF'
/**
 * OpenTelemetry tracing setup
 *
 * Provides distributed tracing across all services.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import {
  trace,
  context,
  SpanStatusCode,
  type Span,
  type SpanOptions,
  type Tracer,
  type Context,
} from '@opentelemetry/api';
import { ConsoleSpanExporter, BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

let sdk: NodeSDK | null = null;

/**
 * Tracing configuration options
 */
export interface TracingConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  otlpEndpoint?: string;
  enableConsole?: boolean;
}

/**
 * Initialize OpenTelemetry tracing
 */
export async function initTracing(config: TracingConfig): Promise<void> {
  if (sdk) {
    console.warn('Tracing already initialized');
    return;
  }

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion ?? '0.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment ?? 'development',
  });

  // Configure exporters
  const spanProcessors = [];

  // OTLP exporter (for production)
  if (config.otlpEndpoint) {
    const otlpExporter = new OTLPTraceExporter({
      url: config.otlpEndpoint,
    });
    spanProcessors.push(new BatchSpanProcessor(otlpExporter));
  }

  // Console exporter (for development)
  if (config.enableConsole) {
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  sdk = new NodeSDK({
    resource,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
      }),
    ],
    spanProcessors,
  });

  await sdk.start();
  console.log('OpenTelemetry tracing initialized');
}

/**
 * Shutdown tracing (call on process exit)
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

/**
 * Get the default tracer
 */
export function getTracer(name = 'rtv-social'): Tracer {
  return trace.getTracer(name);
}

/**
 * Get the currently active span
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Get the current context
 */
export function getCurrentContext(): Context {
  return context.active();
}

/**
 * Create a new span
 */
export function createSpan(name: string, options?: SpanOptions): Span {
  const tracer = getTracer();
  return tracer.startSpan(name, options);
}

/**
 * Execute a function within a span context
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: SpanOptions
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(name, options);

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add attributes to the current span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = getCurrentSpan();
  if (span) {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
  }
}

/**
 * Add an event to the current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
  const span = getCurrentSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set tenant context on the current span
 */
export function setTenantContext(clientId: string, userId?: string): void {
  addSpanAttributes({
    'tenant.client_id': clientId,
    ...(userId && { 'tenant.user_id': userId }),
  });
}
EOF
```

#### Step 4: Create Metrics Module Placeholder

**File: `packages/observability/src/metrics.ts`**

```bash
cat > packages/observability/src/metrics.ts << 'EOF'
/**
 * OpenTelemetry metrics
 *
 * Provides metrics collection and export.
 * Full implementation in S0-D5.
 */

import { metrics, type Meter, type Counter, type Histogram } from '@opentelemetry/api';

let meter: Meter | null = null;

/**
 * Initialize metrics
 */
export function initMetrics(serviceName: string): void {
  meter = metrics.getMeter(serviceName);
}

/**
 * Get the meter instance
 */
export function getMeter(): Meter {
  if (!meter) {
    throw new Error('Metrics not initialized. Call initMetrics first.');
  }
  return meter;
}

/**
 * Create a counter metric
 */
export function createCounter(name: string, description?: string): Counter {
  return getMeter().createCounter(name, { description });
}

/**
 * Create a histogram metric
 */
export function createHistogram(name: string, description?: string): Histogram {
  return getMeter().createHistogram(name, { description });
}

// Placeholder exports - full implementation in S0-D5
export const requestCounter = {
  add: (_value: number, _attributes?: Record<string, string>) => {},
};

export const requestDuration = {
  record: (_value: number, _attributes?: Record<string, string>) => {},
};
EOF
```

#### Step 5: Create Package Index

**File: `packages/observability/src/index.ts`**

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

#### Step 6: Install Dependencies

```bash
cd packages/observability
pnpm install
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

# Verify in a test script
cat > test-tracing.ts << 'EOF'
import { initTracing, withSpan, shutdownTracing } from './src/tracing';

async function main() {
  await initTracing({
    serviceName: 'test-service',
    enableConsole: true,
  });

  await withSpan('test-operation', async (span) => {
    span.setAttribute('test.key', 'test-value');
    console.log('Inside span');
  });

  await shutdownTracing();
}

main().catch(console.error);
EOF

npx tsx test-tracing.ts
rm test-tracing.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/observability/package.json` | Package manifest |
| Create | `packages/observability/tsconfig.json` | TypeScript config |
| Create | `packages/observability/src/tracing.ts` | Tracing module |
| Create | `packages/observability/src/metrics.ts` | Metrics placeholder |
| Create | `packages/observability/src/index.ts` | Package exports |
| Create | `packages/observability/src/__tests__/tracing.test.ts` | Tracing tests |

---

## Acceptance Criteria

- [ ] `@rtv/observability` package exists
- [ ] `initTracing()` initializes OpenTelemetry SDK
- [ ] `withSpan()` creates spans with automatic error handling
- [ ] `getTracer()` returns a valid tracer
- [ ] Auto-instrumentation for HTTP, Express, PG enabled
- [ ] Console exporter works for development
- [ ] OTLP exporter configured for production
- [ ] Tracing tests pass

---

## Test Requirements

### Unit Tests

- Tracer can be retrieved
- Spans can be created
- withSpan handles success and error
- Attributes can be added to spans

### Integration Tests

- Traces appear in console output
- Traces export to OTLP collector (manual verification)

---

## Security & Safety Checklist

- [ ] No sensitive data in span attributes
- [ ] client_id is safe to include in traces
- [ ] OTLP endpoint from environment variable
- [ ] fs instrumentation disabled (noisy)

---

## JSON Task Block

```json
{
  "task_id": "S0-D1",
  "name": "OpenTelemetry Instrumentation",
  "sprint": 0,
  "agent": "D",
  "status": "pending",
  "complexity": "high",
  "estimated_hours": 4,
  "dependencies": ["S0-A1", "S0-A3"],
  "blocks": ["S0-D2", "S0-D3", "S0-D4", "S0-D5"],
  "tags": ["observability", "tracing", "opentelemetry"],
  "acceptance_criteria": [
    "@rtv/observability package exists",
    "tracing initialized",
    "spans created correctly",
    "auto-instrumentation enabled"
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

1. **S0-D2**: Set up structured logging
2. **S0-D3**: Implement audit event framework
3. **S0-D4**: Set up error tracking
4. **S0-D5**: Implement basic metrics collection
