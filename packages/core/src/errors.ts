/**
 * Custom error classes for the platform
 */

/**
 * Base error class for all platform errors
 */
export class RTVError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RTVError';
  }
}

/**
 * Error thrown when tenant context is missing or invalid
 */
export class TenantContextError extends RTVError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TENANT_CONTEXT_ERROR', details);
    this.name = 'TenantContextError';
  }
}

/**
 * Error thrown when a policy check fails
 */
export class PolicyError extends RTVError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'POLICY_ERROR', details);
    this.name = 'PolicyError';
  }
}

/**
 * Error thrown when budget is exceeded
 */
export class BudgetExceededError extends RTVError {
  constructor(
    budgetType: 'tokens' | 'time' | 'retries' | 'tool_calls',
    limit: number,
    used: number
  ) {
    super(
      `Budget exceeded: ${budgetType} (used ${String(used)}/${String(limit)})`,
      'BUDGET_EXCEEDED',
      { budgetType, limit, used }
    );
    this.name = 'BudgetExceededError';
  }
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends RTVError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', { resource, id });
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when a platform operation fails
 */
export class PlatformError extends RTVError {
  constructor(
    platform: string,
    operation: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Platform error (${platform}/${operation}): ${message}`,
      'PLATFORM_ERROR',
      { platform, operation, ...details }
    );
    this.name = 'PlatformError';
  }
}
