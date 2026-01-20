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
  SpanStatusCode,
  type TracingConfig,
} from './tracing.js';

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
} from './logging.js';

// Metrics
export {
  // Initialization
  initMetrics,
  shutdownMetrics,
  getMeter,
  // Metric creation
  createCounter,
  createHistogram,
  createGauge,
  // Helper functions for recording
  recordHttpRequest,
  recordPublish,
  recordEpisode,
  // Timing utilities
  measureDuration,
  startTimer,
  // Legacy exports (deprecated)
  requestCounter,
  requestDuration,
  // Types
  type MetricsConfig,
} from './metrics.js';

// Audit
export {
  AuditEmitter,
  createAuditEmitter,
  getAuditEmitter,
  emitAuditEvent,
  audit,
  type AuditEventInput,
  type AuditEventResult,
  type AuditProof,
  type AuditActorType,
  type AuditOutcome,
} from './audit.js';

// Errors
export {
  ErrorClassification,
  classifyError,
  isTransientError,
  isPermanentError,
  createErrorContext,
  captureError,
  wrapWithErrorHandling,
  createErrorHandler,
  safeExecute,
  getRetryDelay,
  shouldRetry,
  type ErrorContext,
  type CapturedError,
  type CreateErrorContextParams,
} from './errors.js';

// Re-export common OTEL types
export { SpanKind } from '@opentelemetry/api';
