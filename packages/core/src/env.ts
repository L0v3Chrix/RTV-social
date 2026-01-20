/**
 * Environment Variable Management
 *
 * Provides Zod-based validation for environment variables with type safety.
 */

import { z } from 'zod';

/**
 * Environment variable schema definition
 *
 * Required variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - OTEL_SERVICE_NAME: OpenTelemetry service name
 *
 * Optional variables (with defaults):
 * - NODE_ENV: development | production | test (default: development)
 * - LOG_LEVEL: debug | info | warn | error (default: info)
 * - REDIS_URL: Redis connection string (optional)
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OpenTelemetry collector endpoint (optional)
 */
export const envSchema = z.object({
  // Node environment - defaults to 'development'
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database connection string (required)
  DATABASE_URL: z.url({
    message: 'DATABASE_URL must be a valid PostgreSQL connection URL',
  }),

  // Logging level - defaults to 'info'
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Redis connection string (optional)
  REDIS_URL: z.url().optional(),

  // OpenTelemetry service name (required for observability)
  OTEL_SERVICE_NAME: z.string().min(1, {
    message: 'OTEL_SERVICE_NAME is required for observability',
  }),

  // OpenTelemetry collector endpoint (optional)
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
});

/**
 * Type-safe environment variables
 * Inferred from the envSchema
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables against the schema
 *
 * @returns Validated and typed environment variables
 * @throws ZodError if validation fails
 *
 * @example
 * ```typescript
 * import { validateEnv } from '@rtv/core/env';
 *
 * const env = validateEnv();
 * console.log(env.DATABASE_URL); // Type-safe access
 * ```
 */
export function validateEnv(): Env {
  return envSchema.parse(process.env);
}

/**
 * Safely validate environment variables
 *
 * @returns Result object with success status and data or error
 *
 * @example
 * ```typescript
 * import { safeValidateEnv } from '@rtv/core/env';
 *
 * const result = safeValidateEnv();
 * if (result.success) {
 *   console.log(result.data.DATABASE_URL);
 * } else {
 *   console.error('Invalid environment:', result.error.issues);
 * }
 * ```
 */
export function safeValidateEnv() {
  return envSchema.safeParse(process.env);
}

/**
 * Get a formatted error message for environment validation failures
 *
 * @param error - Zod error from validation
 * @returns Formatted error message with all validation issues
 */
export function formatEnvError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `  - ${path}: ${issue.message}`;
  });

  return `Environment validation failed:\n${issues.join('\n')}`;
}
