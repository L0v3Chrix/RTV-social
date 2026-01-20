# Build Prompt: S0-D5 — Basic Metrics Collection

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-D5 |
| **Sprint** | 0 — Foundation |
| **Agent** | D — Observability Baseline |
| **Complexity** | Medium |
| **Estimated Effort** | 2-3 hours |
| **Dependencies** | S0-D1 |
| **Blocks** | Sprint 1 |

---

## Context

### What We're Building

Implement basic metrics collection using OpenTelemetry metrics, including request counters, duration histograms, and custom business metrics.

### Why This Matters

- **Performance monitoring**: Track request latency and throughput
- **SLO measurement**: Quantify service reliability
- **Capacity planning**: Understand resource usage
- **Alerting**: Trigger alerts on metric thresholds

### Spec References

- `/docs/06-reliability-ops/slo-error-budget.md`
- `/docs/06-reliability-ops/observability-dashboard.md#5-metrics`

**Critical Metrics (from slo-error-budget.md):**
> - Request duration (p50, p95, p99)
> - Error rate
> - Publish success rate
> - Episode completion rate

---

## Prerequisites

### Completed Tasks

- [x] S0-D1: OpenTelemetry instrumentation

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/observability/src/__tests__/metrics.test.ts`**

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  initMetrics,
  getMeter,
  createCounter,
  createHistogram,
  recordDuration,
  incrementCounter,
  getMetricsRegistry,
} from '../metrics';

describe('Metrics Collection', () => {
  beforeEach(() => {
    initMetrics('test-service');
  });

  test('getMeter returns a valid meter', () => {
    const meter = getMeter();
    expect(meter).toBeDefined();
  });

  test('createCounter returns a counter', () => {
    const counter = createCounter('test_counter', 'A test counter');
    expect(counter).toBeDefined();
    expect(typeof counter.add).toBe('function');
  });

  test('createHistogram returns a histogram', () => {
    const histogram = createHistogram('test_histogram', 'A test histogram');
    expect(histogram).toBeDefined();
    expect(typeof histogram.record).toBe('function');
  });

  test('incrementCounter increases value', () => {
    incrementCounter('request_count', { method: 'GET', path: '/api/test' });
    // Metrics are collected asynchronously, so we just verify no errors
  });

  test('recordDuration records a value', () => {
    recordDuration('request_duration', 150, { method: 'GET' });
    // Metrics are collected asynchronously
  });

  test('getMetricsRegistry returns defined metrics', () => {
    const registry = getMetricsRegistry();
    expect(registry).toBeDefined();
    expect(registry.requestCount).toBeDefined();
    expect(registry.requestDuration).toBeDefined();
  });
});
```

### Phase 2: Implementation

#### Step 1: Expand Metrics Module

**File: `packages/observability/src/metrics.ts`** (replace)

```bash
cat > packages/observability/src/metrics.ts << 'EOF'
/**
 * OpenTelemetry metrics collection
 *
 * Provides counters, histograms, and gauges for monitoring.
 */

import {
  metrics,
  type Meter,
  type Counter,
  type Histogram,
  type ObservableGauge,
  type Attributes,
} from '@opentelemetry/api';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let meter: Meter | null = null;
let meterProvider: MeterProvider | null = null;

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  otlpEndpoint?: string;
  exportIntervalMs?: number;
}

/**
 * Initialize metrics collection
 */
export function initMetrics(serviceNameOrConfig: string | MetricsConfig): void {
  const config: MetricsConfig =
    typeof serviceNameOrConfig === 'string'
      ? { serviceName: serviceNameOrConfig }
      : serviceNameOrConfig;

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion ?? '0.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment ?? 'development',
  });

  // Configure exporter if OTLP endpoint provided
  const readers = [];
  if (config.otlpEndpoint) {
    const exporter = new OTLPMetricExporter({
      url: config.otlpEndpoint,
    });
    readers.push(
      new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: config.exportIntervalMs ?? 60000,
      })
    );
  }

  meterProvider = new MeterProvider({
    resource,
    readers,
  });

  metrics.setGlobalMeterProvider(meterProvider);
  meter = metrics.getMeter(config.serviceName);

  // Initialize standard metrics
  initStandardMetrics();
}

/**
 * Shutdown metrics (flush and close)
 */
export async function shutdownMetrics(): Promise<void> {
  if (meterProvider) {
    await meterProvider.shutdown();
    meterProvider = null;
    meter = null;
  }
}

/**
 * Get the meter instance
 */
export function getMeter(): Meter {
  if (!meter) {
    // Create a default meter if not initialized
    meter = metrics.getMeter('rtv-social');
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

/**
 * Create an observable gauge
 */
export function createGauge(
  name: string,
  callback: () => number,
  description?: string
): ObservableGauge {
  const gauge = getMeter().createObservableGauge(name, { description });
  gauge.addCallback((result) => {
    result.observe(callback());
  });
  return gauge;
}

// =====================
// Standard Metrics
// =====================

interface MetricsRegistry {
  requestCount: Counter;
  requestDuration: Histogram;
  errorCount: Counter;
  publishCount: Counter;
  publishDuration: Histogram;
  episodeCount: Counter;
  episodeDuration: Histogram;
}

let metricsRegistry: MetricsRegistry | null = null;

function initStandardMetrics(): void {
  const m = getMeter();

  metricsRegistry = {
    // HTTP metrics
    requestCount: m.createCounter('http_requests_total', {
      description: 'Total HTTP requests',
    }),
    requestDuration: m.createHistogram('http_request_duration_ms', {
      description: 'HTTP request duration in milliseconds',
    }),
    errorCount: m.createCounter('errors_total', {
      description: 'Total errors',
    }),

    // Business metrics
    publishCount: m.createCounter('publish_total', {
      description: 'Total publish operations',
    }),
    publishDuration: m.createHistogram('publish_duration_ms', {
      description: 'Publish operation duration in milliseconds',
    }),
    episodeCount: m.createCounter('episodes_total', {
      description: 'Total episodes executed',
    }),
    episodeDuration: m.createHistogram('episode_duration_ms', {
      description: 'Episode duration in milliseconds',
    }),
  };
}

/**
 * Get the metrics registry
 */
export function getMetricsRegistry(): MetricsRegistry {
  if (!metricsRegistry) {
    initStandardMetrics();
  }
  return metricsRegistry!;
}

// =====================
// Convenience Functions
// =====================

/**
 * Increment a counter
 */
export function incrementCounter(
  name: keyof MetricsRegistry | string,
  attributes?: Attributes
): void {
  const registry = getMetricsRegistry();
  const counter = (registry as Record<string, Counter>)[name];
  if (counter && typeof counter.add === 'function') {
    counter.add(1, attributes);
  } else {
    // Create ad-hoc counter
    createCounter(name).add(1, attributes);
  }
}

/**
 * Record a duration value
 */
export function recordDuration(
  name: keyof MetricsRegistry | string,
  durationMs: number,
  attributes?: Attributes
): void {
  const registry = getMetricsRegistry();
  const histogram = (registry as Record<string, Histogram>)[name];
  if (histogram && typeof histogram.record === 'function') {
    histogram.record(durationMs, attributes);
  } else {
    createHistogram(name).record(durationMs, attributes);
  }
}

/**
 * Record HTTP request metrics
 */
export function recordHttpRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number
): void {
  const registry = getMetricsRegistry();
  const attributes = { method, path, status_code: statusCode.toString() };

  registry.requestCount.add(1, attributes);
  registry.requestDuration.record(durationMs, attributes);

  if (statusCode >= 500) {
    registry.errorCount.add(1, { ...attributes, error_type: 'server_error' });
  } else if (statusCode >= 400) {
    registry.errorCount.add(1, { ...attributes, error_type: 'client_error' });
  }
}

/**
 * Record publish operation metrics
 */
export function recordPublish(
  platform: string,
  success: boolean,
  durationMs: number,
  clientId?: string
): void {
  const registry = getMetricsRegistry();
  const attributes: Attributes = {
    platform,
    success: success.toString(),
    ...(clientId && { client_id: clientId }),
  };

  registry.publishCount.add(1, attributes);
  registry.publishDuration.record(durationMs, attributes);

  if (!success) {
    registry.errorCount.add(1, { platform, error_type: 'publish_failure' });
  }
}

/**
 * Record episode metrics
 */
export function recordEpisode(
  agentType: string,
  outcome: 'success' | 'failure' | 'timeout',
  durationMs: number,
  tokenCount?: number
): void {
  const registry = getMetricsRegistry();
  const attributes: Attributes = {
    agent_type: agentType,
    outcome,
    ...(tokenCount !== undefined && { tokens: tokenCount.toString() }),
  };

  registry.episodeCount.add(1, attributes);
  registry.episodeDuration.record(durationMs, attributes);

  if (outcome === 'failure') {
    registry.errorCount.add(1, { agent_type: agentType, error_type: 'episode_failure' });
  }
}

/**
 * Measure execution time and record metrics
 */
export async function measureDuration<T>(
  metricName: string,
  fn: () => Promise<T>,
  attributes?: Attributes
): Promise<T> {
  const startTime = Date.now();
  try {
    return await fn();
  } finally {
    const durationMs = Date.now() - startTime;
    recordDuration(metricName, durationMs, attributes);
  }
}

/**
 * Create a timer for manual measurement
 */
export function startTimer(): () => number {
  const startTime = Date.now();
  return () => Date.now() - startTime;
}
EOF
```

#### Step 2: Update Package Index (Final)

**File: `packages/observability/src/index.ts`** (final)

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
  shutdownMetrics,
  getMeter,
  createCounter,
  createHistogram,
  createGauge,
  getMetricsRegistry,
  incrementCounter,
  recordDuration,
  recordHttpRequest,
  recordPublish,
  recordEpisode,
  measureDuration,
  startTimer,
  type MetricsConfig,
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

# Test metrics manually
cat > test-metrics.ts << 'EOF'
import {
  initMetrics,
  recordHttpRequest,
  recordPublish,
  recordEpisode,
  measureDuration,
  startTimer,
} from './src/metrics';

initMetrics('test-service');

// Record HTTP request
recordHttpRequest('GET', '/api/posts', 200, 45);
recordHttpRequest('POST', '/api/posts', 201, 120);
recordHttpRequest('GET', '/api/posts', 500, 10);

// Record publish
recordPublish('instagram', true, 2500, 'client-123');
recordPublish('tiktok', false, 5000, 'client-123');

// Record episode
recordEpisode('copy-agent', 'success', 15000, 5000);
recordEpisode('publisher-agent', 'failure', 3000);

// Measure duration
async function testMeasure() {
  await measureDuration('custom_operation', async () => {
    await new Promise(r => setTimeout(r, 100));
    return 'done';
  }, { operation: 'test' });
}

// Use timer
const getElapsed = startTimer();
setTimeout(() => {
  console.log('Elapsed:', getElapsed(), 'ms');
}, 50);

testMeasure().then(() => console.log('Metrics recorded'));
EOF

npx tsx test-metrics.ts
rm test-metrics.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `packages/observability/src/metrics.ts` | Full metrics impl |
| Modify | `packages/observability/src/index.ts` | Export metrics |
| Create | `packages/observability/src/__tests__/metrics.test.ts` | Metrics tests |

---

## Acceptance Criteria

- [ ] `initMetrics()` sets up metrics provider
- [ ] Standard metrics: request_count, request_duration, error_count
- [ ] Business metrics: publish_count, episode_count
- [ ] `recordHttpRequest()` helper works
- [ ] `recordPublish()` helper works
- [ ] `recordEpisode()` helper works
- [ ] `measureDuration()` convenience function works
- [ ] OTLP export configured (optional)
- [ ] Metrics tests pass

---

## Test Requirements

### Unit Tests

- Counter creation works
- Histogram creation works
- Standard metrics initialized
- Helper functions work

### Integration Tests

- Metrics export to OTLP collector (manual)

---

## Security & Safety Checklist

- [ ] No PII in metric attributes
- [ ] client_id safe to include
- [ ] High cardinality avoided (no unbounded labels)
- [ ] Metric names follow naming conventions

---

## JSON Task Block

```json
{
  "task_id": "S0-D5",
  "name": "Basic Metrics Collection",
  "sprint": 0,
  "agent": "D",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 3,
  "dependencies": ["S0-D1"],
  "blocks": [],
  "tags": ["observability", "metrics", "monitoring"],
  "acceptance_criteria": [
    "metrics provider initialized",
    "standard metrics defined",
    "helper functions work",
    "OTLP export configured"
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

## Sprint 0 Complete

All Agent D (Observability Baseline) tasks are complete.

**Sprint 0 Summary:**
- ✅ Agent A: Repository & Core Packages (5 tasks)
- ✅ Agent B: Database Schema (5 tasks)
- ✅ Agent C: CI/CD Pipeline (5 tasks)
- ✅ Agent D: Observability Baseline (5 tasks)

**Total: 20 tasks**

**Next:** Sprint 1 — Core Infrastructure
