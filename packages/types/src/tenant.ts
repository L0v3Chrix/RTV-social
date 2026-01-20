/**
 * Multi-tenant context types
 */

import type { ClientId, UserId, PlatformAccountId } from './common.js';

/**
 * Tenant context required for all operations
 * @see /docs/05-policy-safety/multi-tenant-isolation.md#5-tenant-context
 */
export interface TenantContext {
  /** The client (tenant) ID - always required */
  readonly clientId: ClientId;

  /** The user performing the action - required for audit */
  readonly userId: UserId;

  /** Platform account ID - required for platform operations */
  readonly platformAccountId?: PlatformAccountId | undefined;

  /** Execution lane: api or browser */
  readonly lane: 'api' | 'browser';

  /** Request correlation ID for tracing */
  readonly correlationId: string;
}

/**
 * Create a TenantContext from raw values
 */
export function createTenantContext(params: {
  clientId: string;
  userId: string;
  platformAccountId?: string;
  lane: 'api' | 'browser';
  correlationId?: string;
}): TenantContext {
  return {
    clientId: params.clientId as ClientId,
    userId: params.userId as UserId,
    platformAccountId: params.platformAccountId as PlatformAccountId | undefined,
    lane: params.lane,
    correlationId: params.correlationId ?? crypto.randomUUID(),
  };
}
