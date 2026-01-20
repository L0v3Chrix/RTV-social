/**
 * @rtv/db - PostgreSQL Row-Level Security (RLS) Helpers
 *
 * Provides utilities for managing RLS context in PostgreSQL sessions.
 * RLS adds an additional layer of security at the database level,
 * complementing the application-level tenant scoping in tenant.ts.
 *
 * RLS requires:
 * 1. RLS policies to be created on tables (see migrations/0002_rls_policies.sql)
 * 2. Session context to be set before queries (setTenantContext)
 *
 * Key Functions:
 * - setTenantContext(clientId) - Sets session variable for RLS
 * - clearTenantContext() - Clears session variable
 * - withRlsContext(clientId, fn) - Executes function with RLS context
 */

import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { TenantAccessError } from './tenant.js';
import { randomUUID } from 'crypto';

/**
 * Session variable name for tenant context
 * This is used by RLS policies to filter rows
 */
export const RLS_TENANT_VAR = 'app.current_client_id';

/**
 * RLS context configuration
 */
export interface RlsContextConfig {
  /**
   * The client ID for tenant isolation
   */
  clientId: string;

  /**
   * Optional correlation ID for tracing
   */
  correlationId?: string;

  /**
   * Whether to validate clientId format (default: true)
   */
  validateClientId?: boolean;
}

/**
 * Result of RLS context operations
 */
export interface RlsContextResult {
  /**
   * Whether the context was set successfully
   */
  success: boolean;

  /**
   * The client ID that was set
   */
  clientId: string;

  /**
   * Correlation ID for tracing
   */
  correlationId: string;
}

/**
 * Set the tenant context for the current database session
 * This sets a session variable that RLS policies can reference
 *
 * @param db Database instance
 * @param config RLS context configuration
 * @returns Result of the operation
 * @throws TenantAccessError if clientId is invalid
 *
 * @example
 * ```typescript
 * await setTenantContext(db, { clientId: 'client-123' });
 *
 * // Now all queries in this session will be filtered by RLS
 * const results = await db.select().from(brandKitsTable);
 * // Only returns rows where client_id = 'client-123'
 * ```
 */
export async function setTenantContext(
  db: PostgresJsDatabase,
  config: RlsContextConfig
): Promise<RlsContextResult> {
  const { clientId, correlationId = randomUUID(), validateClientId = true } = config;

  // Validate client ID if enabled
  if (validateClientId && !isValidUuid(clientId)) {
    throw new TenantAccessError(
      'Invalid client ID format - expected UUID',
      clientId,
      'rls_context',
      undefined,
      correlationId
    );
  }

  // Set the session variable
  // Using parameterized query to prevent SQL injection
  await db.execute(
    sql`SELECT set_config(${RLS_TENANT_VAR}, ${clientId}, false)`
  );

  return {
    success: true,
    clientId,
    correlationId,
  };
}

/**
 * Clear the tenant context for the current database session
 * This removes the session variable used by RLS policies
 *
 * @param db Database instance
 *
 * @example
 * ```typescript
 * await clearTenantContext(db);
 * // RLS policies will now deny all row access
 * ```
 */
export async function clearTenantContext(
  db: PostgresJsDatabase
): Promise<void> {
  await db.execute(
    sql`SELECT set_config(${RLS_TENANT_VAR}, '', false)`
  );
}

/**
 * Get the current tenant context from the database session
 *
 * @param db Database instance
 * @returns The current client ID or null if not set
 */
export async function getTenantContext(
  db: PostgresJsDatabase
): Promise<string | null> {
  const result = await db.execute(
    sql`SELECT current_setting(${RLS_TENANT_VAR}, true) as client_id`
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientId = (result as any)[0]?.client_id;
  return clientId && clientId !== '' ? clientId : null;
}

/**
 * Execute a function with RLS context
 * Automatically sets and clears the tenant context
 *
 * @param db Database instance
 * @param clientId The tenant client ID
 * @param fn Function to execute with RLS context
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const brandKits = await withRlsContext(db, 'client-123', async () => {
 *   return db.select().from(brandKitsTable);
 * });
 * // brandKits only contains rows for client-123
 * // RLS context is automatically cleared after execution
 * ```
 */
export async function withRlsContext<T>(
  db: PostgresJsDatabase,
  clientId: string,
  fn: () => Promise<T>
): Promise<T> {
  const correlationId = randomUUID();

  try {
    await setTenantContext(db, { clientId, correlationId });
    return await fn();
  } finally {
    await clearTenantContext(db);
  }
}

/**
 * Execute a function with RLS context within a transaction
 * The context is set at the beginning and cleared at the end
 * Rolls back on error
 *
 * @param db Database instance
 * @param clientId The tenant client ID
 * @param fn Function to execute within transaction with RLS context
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * await withRlsTransaction(db, 'client-123', async (tx) => {
 *   await tx.insert(brandKitsTable).values({ ... });
 *   await tx.update(knowledgeBasesTable).set({ ... });
 * });
 * // Both operations are atomic and scoped to client-123
 * ```
 */
export async function withRlsTransaction<T>(
  db: PostgresJsDatabase,
  clientId: string,
  fn: (tx: PostgresJsDatabase) => Promise<T>
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any).transaction(async (tx: PostgresJsDatabase) => {
    await setTenantContext(tx, { clientId });
    try {
      return await fn(tx);
    } finally {
      await clearTenantContext(tx);
    }
  });
}

/**
 * Validate UUID format
 * @param value String to validate
 * @returns true if valid UUID format
 */
function isValidUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * SQL helpers for creating RLS policies
 * These are used in migrations to set up RLS
 */
export const rlsPolicySql = {
  /**
   * Enable RLS on a table
   */
  enableRls: (tableName: string) =>
    sql.raw(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`),

  /**
   * Force RLS even for table owners
   */
  forceRls: (tableName: string) =>
    sql.raw(`ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY`),

  /**
   * Create a SELECT policy that filters by client_id
   */
  createSelectPolicy: (tableName: string, policyName: string) =>
    sql.raw(`
      CREATE POLICY ${policyName} ON ${tableName}
        FOR SELECT
        USING (client_id::text = current_setting('${RLS_TENANT_VAR}', true))
    `),

  /**
   * Create an INSERT policy that requires matching client_id
   */
  createInsertPolicy: (tableName: string, policyName: string) =>
    sql.raw(`
      CREATE POLICY ${policyName} ON ${tableName}
        FOR INSERT
        WITH CHECK (client_id::text = current_setting('${RLS_TENANT_VAR}', true))
    `),

  /**
   * Create an UPDATE policy that filters and validates client_id
   */
  createUpdatePolicy: (tableName: string, policyName: string) =>
    sql.raw(`
      CREATE POLICY ${policyName} ON ${tableName}
        FOR UPDATE
        USING (client_id::text = current_setting('${RLS_TENANT_VAR}', true))
        WITH CHECK (client_id::text = current_setting('${RLS_TENANT_VAR}', true))
    `),

  /**
   * Create a DELETE policy that filters by client_id
   */
  createDeletePolicy: (tableName: string, policyName: string) =>
    sql.raw(`
      CREATE POLICY ${policyName} ON ${tableName}
        FOR DELETE
        USING (client_id::text = current_setting('${RLS_TENANT_VAR}', true))
    `),

  /**
   * Create all CRUD policies for a tenant table
   */
  createAllPolicies: (tableName: string) => [
    sql.raw(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`),
    sql.raw(`ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY`),
    sql.raw(`
      CREATE POLICY ${tableName}_tenant_select ON ${tableName}
        FOR SELECT
        USING (client_id::text = current_setting('${RLS_TENANT_VAR}', true))
    `),
    sql.raw(`
      CREATE POLICY ${tableName}_tenant_insert ON ${tableName}
        FOR INSERT
        WITH CHECK (client_id::text = current_setting('${RLS_TENANT_VAR}', true))
    `),
    sql.raw(`
      CREATE POLICY ${tableName}_tenant_update ON ${tableName}
        FOR UPDATE
        USING (client_id::text = current_setting('${RLS_TENANT_VAR}', true))
        WITH CHECK (client_id::text = current_setting('${RLS_TENANT_VAR}', true))
    `),
    sql.raw(`
      CREATE POLICY ${tableName}_tenant_delete ON ${tableName}
        FOR DELETE
        USING (client_id::text = current_setting('${RLS_TENANT_VAR}', true))
    `),
  ],

  /**
   * Drop all policies for a tenant table
   */
  dropAllPolicies: (tableName: string) => [
    sql.raw(`DROP POLICY IF EXISTS ${tableName}_tenant_select ON ${tableName}`),
    sql.raw(`DROP POLICY IF EXISTS ${tableName}_tenant_insert ON ${tableName}`),
    sql.raw(`DROP POLICY IF EXISTS ${tableName}_tenant_update ON ${tableName}`),
    sql.raw(`DROP POLICY IF EXISTS ${tableName}_tenant_delete ON ${tableName}`),
    sql.raw(`ALTER TABLE ${tableName} DISABLE ROW LEVEL SECURITY`),
  ],
};
