/**
 * OpenTelemetry metrics
 *
 * Provides metrics collection and export for the RTV platform.
 * Includes standard HTTP metrics and business metrics for publishing and episodes.
 */

import {
  metrics,
  type Meter,
  type Counter,
  type Histogram,
  type ObservableGauge,
  type Attributes,
} from '@opentelemetry/api';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

/**
 * Configuration for metrics initialization
 */
export interface MetricsConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  otlpEndpoint?: string;
  enableConsole?: boolean;
  exportIntervalMs?: number;
}

// Module state
let meterProvider: MeterProvider | null = null;
let meter: Meter | null = null;
let isInitialized = false;

// Standard metrics registry
let httpRequestsTotal: Counter | null = null;
let httpRequestDurationMs: Histogram | null = null;
let errorsTotal: Counter | null = null;

// Business metrics
let publishTotal: Counter | null = null;
let publishDurationMs: Histogram | null = null;
let episodesTotal: Counter | null = null;
let episodeDurationMs: Histogram | null = null;

/**
 * Initialize metrics with OpenTelemetry MeterProvider
 */
export function initMetrics(config: MetricsConfig): void {
  if (isInitialized) {
    console.warn('Metrics already initialized');
    return;
  }

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion ?? '0.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment ?? 'development',
  });

  const metricReaders = [];

  // OTLP exporter (for production)
  if (config.otlpEndpoint) {
    const otlpExporter = new OTLPMetricExporter({
      url: config.otlpEndpoint,
    });
    metricReaders.push(
      new PeriodicExportingMetricReader({
        exporter: otlpExporter,
        exportIntervalMillis: config.exportIntervalMs ?? 60000,
      })
    );
  }

  // Console exporter (for development)
  if (config.enableConsole) {
    metricReaders.push(
      new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: config.exportIntervalMs ?? 10000,
      })
    );
  }

  // Create MeterProvider
  if (metricReaders.length > 0) {
    meterProvider = new MeterProvider({
      resource,
      readers: metricReaders,
    });
  } else {
    meterProvider = new MeterProvider({
      resource,
    });
  }

  // Set as global provider
  metrics.setGlobalMeterProvider(meterProvider);

  // Get meter instance
  meter = meterProvider.getMeter(config.serviceName);

  // Initialize standard metrics
  initializeStandardMetrics();

  isInitialized = true;
  console.log('OpenTelemetry metrics initialized');
}

/**
 * Initialize standard metrics registry
 */
function initializeStandardMetrics(): void {
  if (!meter) return;

  // HTTP metrics
  httpRequestsTotal = meter.createCounter('http_requests_total', {
    description: 'Total number of HTTP requests',
    unit: '1',
  });

  httpRequestDurationMs = meter.createHistogram('http_request_duration_ms', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
  });

  errorsTotal = meter.createCounter('errors_total', {
    description: 'Total number of errors',
    unit: '1',
  });

  // Business metrics - Publishing
  publishTotal = meter.createCounter('publish_total', {
    description: 'Total number of publish operations',
    unit: '1',
  });

  publishDurationMs = meter.createHistogram('publish_duration_ms', {
    description: 'Publish operation duration in milliseconds',
    unit: 'ms',
  });

  // Business metrics - Episodes
  episodesTotal = meter.createCounter('episodes_total', {
    description: 'Total number of agent episodes',
    unit: '1',
  });

  episodeDurationMs = meter.createHistogram('episode_duration_ms', {
    description: 'Agent episode duration in milliseconds',
    unit: 'ms',
  });
}

/**
 * Shutdown metrics (call on process exit)
 */
export async function shutdownMetrics(): Promise<void> {
  if (meterProvider) {
    await meterProvider.shutdown();
    meterProvider = null;
    meter = null;
    isInitialized = false;

    // Reset metric references
    httpRequestsTotal = null;
    httpRequestDurationMs = null;
    errorsTotal = null;
    publishTotal = null;
    publishDurationMs = null;
    episodesTotal = null;
    episodeDurationMs = null;
  }
}

/**
 * Get the meter instance
 */
export function getMeter(): Meter {
  if (!meter) {
    // Return a no-op meter if not initialized
    return metrics.getMeter('rtv-social-noop');
  }
  return meter;
}

/**
 * Create a counter metric
 */
export function createCounter(
  name: string,
  description?: string,
  unit?: string
): Counter {
  const options: { description?: string; unit?: string } = {
    unit: unit ?? '1',
  };
  if (description) {
    options.description = description;
  }
  return getMeter().createCounter(name, options);
}

/**
 * Create a histogram metric
 */
export function createHistogram(
  name: string,
  description?: string,
  unit?: string
): Histogram {
  const options: { description?: string; unit?: string } = {
    unit: unit ?? 'ms',
  };
  if (description) {
    options.description = description;
  }
  return getMeter().createHistogram(name, options);
}

/**
 * Create an observable gauge metric
 */
export function createGauge(
  name: string,
  callback: () => number,
  description?: string,
  unit?: string
): ObservableGauge {
  const options: { description?: string; unit?: string } = {
    unit: unit ?? '1',
  };
  if (description) {
    options.description = description;
  }
  const gauge = getMeter().createObservableGauge(name, options);

  gauge.addCallback((observableResult) => {
    observableResult.observe(callback());
  });

  return gauge;
}

// ============================================================================
// Helper Functions for Recording Metrics
// ============================================================================

/**
 * Record an HTTP request
 */
export function recordHttpRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number
): void {
  const attributes: Attributes = {
    method: method.toUpperCase(),
    path: normalizePath(path),
    status_code: String(statusCode),
    status_class: `${Math.floor(statusCode / 100)}xx`,
  };

  httpRequestsTotal?.add(1, attributes);
  httpRequestDurationMs?.record(durationMs, attributes);

  // Track errors (4xx and 5xx)
  if (statusCode >= 400) {
    errorsTotal?.add(1, {
      type: 'http',
      status_code: String(statusCode),
    });
  }
}

/**
 * Record a publish operation
 */
export function recordPublish(
  platform: string,
  success: boolean,
  durationMs: number,
  clientId?: string
): void {
  const attributes: Attributes = {
    platform,
    success: String(success),
    ...(clientId && { client_id: clientId }),
  };

  publishTotal?.add(1, attributes);
  publishDurationMs?.record(durationMs, attributes);

  if (!success) {
    errorsTotal?.add(1, {
      type: 'publish',
      platform,
    });
  }
}

/**
 * Record an agent episode
 */
export function recordEpisode(
  agentType: string,
  outcome: 'success' | 'failure' | 'timeout' | 'cancelled',
  durationMs: number,
  tokenCount?: number
): void {
  const attributes: Attributes = {
    agent_type: agentType,
    outcome,
    ...(tokenCount !== undefined && { token_bucket: getTokenBucket(tokenCount) }),
  };

  episodesTotal?.add(1, attributes);
  episodeDurationMs?.record(durationMs, attributes);

  if (outcome === 'failure' || outcome === 'timeout') {
    errorsTotal?.add(1, {
      type: 'episode',
      agent_type: agentType,
      outcome,
    });
  }
}

// ============================================================================
// Timing Utilities
// ============================================================================

/**
 * Measure the duration of an async function and record it
 */
export async function measureDuration<T>(
  metricName: string,
  fn: () => Promise<T>,
  attributes?: Attributes
): Promise<T> {
  const histogram = getMeter().createHistogram(metricName, {
    unit: 'ms',
  });

  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    histogram.record(duration, { ...attributes, success: 'true' });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    histogram.record(duration, { ...attributes, success: 'false' });
    throw error;
  }
}

/**
 * Start a timer and return a function that returns elapsed milliseconds
 */
export function startTimer(): () => number {
  const start = performance.now();
  return () => performance.now() - start;
}

// ============================================================================
// Helper Utilities
// ============================================================================

/**
 * Normalize path to avoid high cardinality
 * Replaces UUIDs, numbers, and other dynamic segments with placeholders
 */
function normalizePath(path: string): string {
  const pathWithoutQuery = path.split('?')[0];
  if (!pathWithoutQuery) {
    return '/';
  }
  return pathWithoutQuery
    // Replace UUIDs
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id'
    )
    // Replace numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Normalize trailing slash
    .replace(/\/$/, '') || '/';
}

/**
 * Get token count bucket to avoid high cardinality
 */
function getTokenBucket(tokenCount: number): string {
  if (tokenCount < 100) return '0-100';
  if (tokenCount < 500) return '100-500';
  if (tokenCount < 1000) return '500-1000';
  if (tokenCount < 5000) return '1000-5000';
  if (tokenCount < 10000) return '5000-10000';
  return '10000+';
}

// ============================================================================
// Legacy exports for backward compatibility
// ============================================================================

/**
 * @deprecated Use recordHttpRequest instead
 */
export const requestCounter = {
  add: (value: number, attributes?: Record<string, string>) => {
    httpRequestsTotal?.add(value, attributes);
  },
};

/**
 * @deprecated Use recordHttpRequest instead
 */
export const requestDuration = {
  record: (value: number, attributes?: Record<string, string>) => {
    httpRequestDurationMs?.record(value, attributes);
  },
};
