/**
 * Structured logging with pino
 *
 * Provides JSON-formatted logs with correlation ID and trace context.
 */

import pino from 'pino';
import type { Logger, LoggerOptions } from 'pino';
import { getCurrentSpan } from './tracing.js';

/**
 * Log context type
 */
export interface LogContext {
  correlationId?: string | undefined;
  clientId?: string | undefined;
  userId?: string | undefined;
  requestId?: string | undefined;
  [key: string]: unknown;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  name: string;
  level?: string | undefined;
  prettyPrint?: boolean | undefined;
  context?: LogContext | undefined;
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
        name: bindings['name'],
        pid: bindings['pid'],
        hostname: bindings['hostname'],
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
    ...(userId !== undefined && { userId }),
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
    ...(correlationId !== undefined && { correlationId }),
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
