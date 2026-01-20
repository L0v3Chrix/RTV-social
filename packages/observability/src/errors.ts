/**
 * Error tracking module
 *
 * Provides centralized error classification, capture, and handling utilities
 * with full trace context integration.
 */

import { getCurrentSpan } from './tracing.js';
import { getLogger } from './logging.js';

/**
 * Error classification categories
 */
export enum ErrorClassification {
  TRANSIENT = 'transient',      // Retry may succeed
  PERMANENT = 'permanent',       // Do not retry
  RATE_LIMITED = 'rate_limited', // Retry with backoff
  UNKNOWN = 'unknown',           // Unknown classification
}

/**
 * Error context for captured errors
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

/**
 * Parameters for creating error context
 */
export interface CreateErrorContextParams {
  operation: string;
  clientId?: string;
  userId?: string;
  platform?: string;
  targetType?: string;
  targetId?: string;
  requestId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

// Patterns for classifying transient errors
const TRANSIENT_PATTERNS = [
  // Node.js system error codes
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'ECONNABORTED',
  'EPIPE',
  // Generic patterns
  'timeout',
  'network',
  'connection',
  'socket hang up',
  'ESOCKETTIMEDOUT',
  // HTTP status codes for transient failures
  '502',
  '503',
  '504',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
];

// Patterns for rate-limited errors
const RATE_LIMITED_PATTERNS = [
  'rate limit',
  'rate-limit',
  'ratelimit',
  'too many requests',
  '429',
  'quota exceeded',
  'throttle',
  'throttled',
];

// Patterns for permanent errors
const PERMANENT_ERROR_NAMES = [
  'ValidationError',
  'TypeError',
  'SyntaxError',
  'ReferenceError',
  'RangeError',
  'AuthenticationError',
  'AuthorizationError',
  'NotFoundError',
  'ForbiddenError',
  'BadRequestError',
];

/**
 * Classify an error based on its type and message
 */
export function classifyError(error: Error): ErrorClassification {
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name;
  const errorCode = (error as NodeJS.ErrnoException).code?.toLowerCase() ?? '';

  // Check for rate-limited errors first (most specific)
  for (const pattern of RATE_LIMITED_PATTERNS) {
    if (
      errorMessage.includes(pattern.toLowerCase()) ||
      errorCode.includes(pattern.toLowerCase())
    ) {
      return ErrorClassification.RATE_LIMITED;
    }
  }

  // Check for permanent errors
  if (PERMANENT_ERROR_NAMES.includes(errorName)) {
    return ErrorClassification.PERMANENT;
  }

  // Check for transient errors
  for (const pattern of TRANSIENT_PATTERNS) {
    if (
      errorMessage.includes(pattern.toLowerCase()) ||
      errorCode.includes(pattern.toLowerCase())
    ) {
      return ErrorClassification.TRANSIENT;
    }
  }

  // Check HTTP status codes in error objects
  const statusCode = (error as { statusCode?: number; status?: number }).statusCode
    ?? (error as { statusCode?: number; status?: number }).status;

  if (statusCode) {
    if (statusCode === 429) {
      return ErrorClassification.RATE_LIMITED;
    }
    if (statusCode >= 500 && statusCode < 600) {
      return ErrorClassification.TRANSIENT;
    }
    if (statusCode >= 400 && statusCode < 500) {
      return ErrorClassification.PERMANENT;
    }
  }

  return ErrorClassification.UNKNOWN;
}

/**
 * Check if an error is transient (may succeed on retry)
 */
export function isTransientError(error: Error): boolean {
  const classification = classifyError(error);
  return classification === ErrorClassification.TRANSIENT;
}

/**
 * Check if an error is permanent (should not retry)
 */
export function isPermanentError(error: Error): boolean {
  const classification = classifyError(error);
  return classification === ErrorClassification.PERMANENT;
}

/**
 * Create an error context with timestamp
 */
export function createErrorContext(params: CreateErrorContextParams): ErrorContext {
  const context: ErrorContext = {
    operation: params.operation,
    timestamp: new Date().toISOString(),
  };

  // Only add optional fields if they are defined
  if (params.clientId !== undefined) context.clientId = params.clientId;
  if (params.userId !== undefined) context.userId = params.userId;
  if (params.platform !== undefined) context.platform = params.platform;
  if (params.targetType !== undefined) context.targetType = params.targetType;
  if (params.targetId !== undefined) context.targetId = params.targetId;
  if (params.requestId !== undefined) context.requestId = params.requestId;
  if (params.correlationId !== undefined) context.correlationId = params.correlationId;
  if (params.metadata !== undefined) context.metadata = params.metadata;

  return context;
}

/**
 * Capture an error with full context and trace correlation
 */
export function captureError(
  error: Error,
  context: ErrorContext
): CapturedError {
  const logger = getLogger();
  const classification = classifyError(error);

  // Get trace context from current span
  const span = getCurrentSpan();
  let traceId: string | undefined;
  let spanId: string | undefined;

  if (span) {
    const spanContext = span.spanContext();
    traceId = spanContext.traceId;
    spanId = spanContext.spanId;
  }

  const capturedError: CapturedError = {
    error,
    context,
    classification,
  };

  // Only add trace context if available
  if (traceId !== undefined) capturedError.traceId = traceId;
  if (spanId !== undefined) capturedError.spanId = spanId;

  // Log the error with full context
  logger.error({
    err: error,
    operation: context.operation,
    classification,
    clientId: context.clientId,
    userId: context.userId,
    platform: context.platform,
    targetType: context.targetType,
    targetId: context.targetId,
    requestId: context.requestId,
    correlationId: context.correlationId,
    traceId,
    spanId,
    timestamp: context.timestamp,
    metadata: context.metadata,
  }, `Error captured: ${error.message}`);

  return capturedError;
}

/**
 * Wrap an async function with error handling
 * Catches errors, captures them with context, and re-throws
 */
export async function wrapWithErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
  contextParams?: Omit<CreateErrorContextParams, 'operation'>
): Promise<T> {
  const context = createErrorContext({
    operation,
    ...contextParams,
  });

  try {
    return await fn();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    captureError(err, context);
    throw err;
  }
}

/**
 * Create an error handler function for a specific operation
 */
export function createErrorHandler(
  operation: string,
  contextParams?: Omit<CreateErrorContextParams, 'operation'>
): (error: unknown) => CapturedError {
  return (error: unknown): CapturedError => {
    const err = error instanceof Error ? error : new Error(String(error));
    const context = createErrorContext({
      operation,
      ...contextParams,
    });
    return captureError(err, context);
  };
}

/**
 * Safely execute a function, catching errors and returning a fallback value
 */
export async function safeExecute<T>(
  operation: string,
  fn: () => Promise<T>,
  fallback: T,
  contextParams?: Omit<CreateErrorContextParams, 'operation'>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const context = createErrorContext({
      operation,
      ...contextParams,
    });
    captureError(err, context);
    return fallback;
  }
}

/**
 * Calculate retry delay with exponential backoff
 * For rate-limited errors, uses longer delays
 */
export function getRetryDelay(
  error: Error,
  attempt: number,
  baseDelay = 1000
): number {
  const classification = classifyError(error);

  // Extract retry-after header if present
  const retryAfter = (error as { retryAfter?: number }).retryAfter;
  if (retryAfter && retryAfter > 0) {
    return retryAfter * 1000; // Convert seconds to milliseconds
  }

  // Exponential backoff: baseDelay * 2^attempt
  let delay = baseDelay * Math.pow(2, attempt);

  // Rate-limited errors get longer delays
  if (classification === ErrorClassification.RATE_LIMITED) {
    delay = delay * 2;
  }

  // Add jitter (10-20% random variation)
  const jitter = delay * (0.1 + Math.random() * 0.1);
  delay = delay + jitter;

  // Cap at 5 minutes
  const maxDelay = 5 * 60 * 1000;
  return Math.min(delay, maxDelay);
}

/**
 * Determine if an error should be retried
 */
export function shouldRetry(
  error: Error,
  attempt: number,
  maxAttempts = 3
): boolean {
  // Never retry if max attempts reached
  if (attempt >= maxAttempts) {
    return false;
  }

  const classification = classifyError(error);

  // Permanent errors should never be retried
  if (classification === ErrorClassification.PERMANENT) {
    return false;
  }

  // Transient and rate-limited errors should be retried
  if (
    classification === ErrorClassification.TRANSIENT ||
    classification === ErrorClassification.RATE_LIMITED
  ) {
    return true;
  }

  // Unknown errors: retry up to 1 time (conservative approach)
  // classification is UNKNOWN at this point since we've already checked PERMANENT, TRANSIENT, RATE_LIMITED
  return attempt < 1;
}
