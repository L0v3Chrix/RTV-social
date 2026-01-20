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
import {
  ConsoleSpanExporter,
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

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

  // Create SDK with appropriate span processor
  const baseConfig = {
    resource,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
      }),
    ],
  };

  // Add span processor if any exporters are configured
  if (spanProcessors.length > 0 && spanProcessors[0]) {
    sdk = new NodeSDK({
      ...baseConfig,
      spanProcessor: spanProcessors[0],
    });
  } else {
    sdk = new NodeSDK(baseConfig);
  }

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
    const result = await context.with(
      trace.setSpan(context.active(), span),
      () => fn(span)
    );
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add attributes to the current span
 */
export function addSpanAttributes(
  attributes: Record<string, string | number | boolean>
): void {
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
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
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

// Re-export SpanStatusCode for convenience
export { SpanStatusCode };
