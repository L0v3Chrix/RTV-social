/**
 * @rtv/db - Multi-tenant Database Utilities
 *
 * Provides application-level tenant isolation for all database operations.
 * Every query automatically scopes to a specific client_id.
 *
 * Key Functions:
 * - withTenantScope(db, clientId) - Creates a scoped database wrapper
 * - scopedQuery(table) - Auto-filters by client_id
 * - scopedInsert(table, values) - Auto-adds client_id
 * - scopedUpdate(table, values, where) - Scopes updates
 * - scopedDelete(table, where) - Scopes deletes
 * - assertTenantOwnership(record, clientId, resourceType) - Validates ownership
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

/**
 * Error thrown when tenant access is violated
 */
export class TenantAccessError extends Error {
  public readonly code = 'TENANT_ACCESS_ERROR';
  public readonly clientId: string;
  public readonly resourceType: string;
  public readonly resourceId: string | undefined;
  public readonly correlationId: string;

  constructor(
    message: string,
    clientId: string,
    resourceType: string,
    resourceId?: string,
    correlationId?: string
  ) {
    super(message);
    this.name = 'TenantAccessError';
    this.clientId = clientId;
    this.resourceType = resourceType;
    this.resourceId = resourceId;
    this.correlationId = correlationId ?? randomUUID();
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      clientId: this.clientId,
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      correlationId: this.correlationId,
    };
  }
}

/**
 * Type for tables with clientId column
 * Uses a more permissive type to work with Drizzle's complex generics
 */
export type TenantTable = PgTable & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientId: PgColumn<any, object, object>;
};

/**
 * Type for records that have a clientId field
 */
export interface TenantRecord {
  clientId: string;
  [key: string]: unknown;
}

/**
 * Context for scoped tenant operations
 */
export interface TenantContext {
  clientId: string;
  correlationId: string;
}

/**
 * Scoped database wrapper for tenant-isolated operations
 */
export interface ScopedDatabase {
  /**
   * The underlying database instance
   */
  db: PostgresJsDatabase;

  /**
   * The tenant context
   */
  context: TenantContext;

  /**
   * Create a scoped select query that auto-filters by client_id
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scopedSelect: <T extends TenantTable>(table: T, additionalConditions?: SQL) => any;

  /**
   * Create a scoped insert that auto-adds client_id
   */
  scopedInsert: <T extends TenantTable>(
    table: T,
    data: Record<string, unknown> | Record<string, unknown>[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any;

  /**
   * Create a scoped update that filters by client_id
   */
  scopedUpdate: <T extends TenantTable>(
    table: T,
    data: Record<string, unknown>,
    additionalConditions?: SQL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any;

  /**
   * Create a scoped delete that filters by client_id
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scopedDelete: <T extends TenantTable>(table: T, additionalConditions?: SQL) => any;

  /**
   * Execute operations within a transaction
   */
  transaction: <TResult>(fn: (tx: ScopedDatabase) => Promise<TResult>) => Promise<TResult>;
}

/**
 * Create a scoped database wrapper for tenant-isolated operations
 *
 * @param db The database instance
 * @param clientId The tenant client ID
 * @param correlationId Optional correlation ID for tracing
 * @returns Scoped database wrapper
 *
 * @example
 * ```typescript
 * const scopedDb = withTenantScope(db, 'client-123');
 *
 * // All queries automatically scoped to client-123
 * const brandKits = await scopedDb.scopedSelect(brandKitsTable);
 *
 * // Inserts auto-add client_id
 * await scopedDb.scopedInsert(brandKitsTable, { name: 'New Kit', tone: {...}, colors: {...} });
 * ```
 */
export function withTenantScope(
  db: PostgresJsDatabase,
  clientId: string,
  correlationId?: string
): ScopedDatabase {
  if (!clientId) {
    throw new TenantAccessError(
      'Client ID is required for tenant-scoped operations',
      '',
      'tenant_context',
      undefined,
      correlationId
    );
  }

  const context: TenantContext = {
    clientId,
    correlationId: correlationId ?? randomUUID(),
  };

  const createScopedDb = (database: PostgresJsDatabase): ScopedDatabase => ({
    db: database,
    context,

    scopedSelect: <T extends TenantTable>(table: T, additionalConditions?: SQL) => {
      const baseCondition = eq(table.clientId, clientId);
      const condition = additionalConditions
        ? and(baseCondition, additionalConditions)
        : baseCondition;

      return database.select().from(table).where(condition!);
    },

    scopedInsert: <T extends TenantTable>(
      table: T,
      data: Record<string, unknown> | Record<string, unknown>[]
    ) => {
      const dataArray = Array.isArray(data) ? data : [data];
      const valuesWithClientId = dataArray.map((item) => ({
        ...item,
        clientId,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return database.insert(table).values(valuesWithClientId as any);
    },

    scopedUpdate: <T extends TenantTable>(
      table: T,
      data: Record<string, unknown>,
      additionalConditions?: SQL
    ) => {
      const baseCondition = eq(table.clientId, clientId);
      const condition = additionalConditions
        ? and(baseCondition, additionalConditions)
        : baseCondition;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return database.update(table).set(data as any).where(condition!);
    },

    scopedDelete: <T extends TenantTable>(table: T, additionalConditions?: SQL) => {
      const baseCondition = eq(table.clientId, clientId);
      const condition = additionalConditions
        ? and(baseCondition, additionalConditions)
        : baseCondition;

      return database.delete(table).where(condition!);
    },

    transaction: async <TResult>(
      fn: (tx: ScopedDatabase) => Promise<TResult>
    ): Promise<TResult> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (database as any).transaction(async (tx: PostgresJsDatabase) => {
        const scopedTx = createScopedDb(tx);
        return fn(scopedTx);
      });
    },
  });

  return createScopedDb(db);
}

/**
 * Standalone function to create a scoped query
 * Auto-filters by client_id
 *
 * @param db Database instance
 * @param table Table to query
 * @param clientId Tenant client ID
 * @param additionalConditions Optional additional WHERE conditions
 */
export function scopedQuery<T extends TenantTable>(
  db: PostgresJsDatabase,
  table: T,
  clientId: string,
  additionalConditions?: SQL
) {
  const baseCondition = eq(table.clientId, clientId);
  const condition = additionalConditions
    ? and(baseCondition, additionalConditions)
    : baseCondition;

  return db.select().from(table).where(condition!);
}

/**
 * Standalone function to create a scoped insert
 * Auto-adds client_id to values
 *
 * @param db Database instance
 * @param table Table to insert into
 * @param clientId Tenant client ID
 * @param values Values to insert (client_id will be added)
 */
export function scopedInsert<T extends TenantTable>(
  db: PostgresJsDatabase,
  table: T,
  clientId: string,
  values: Record<string, unknown> | Record<string, unknown>[]
) {
  const dataArray = Array.isArray(values) ? values : [values];
  const valuesWithClientId = dataArray.map((item) => ({
    ...item,
    clientId,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.insert(table).values(valuesWithClientId as any);
}

/**
 * Standalone function to create a scoped update
 * Auto-filters by client_id
 *
 * @param db Database instance
 * @param table Table to update
 * @param clientId Tenant client ID
 * @param values Values to update
 * @param additionalConditions Optional additional WHERE conditions
 */
export function scopedUpdate<T extends TenantTable>(
  db: PostgresJsDatabase,
  table: T,
  clientId: string,
  values: Record<string, unknown>,
  additionalConditions?: SQL
) {
  const baseCondition = eq(table.clientId, clientId);
  const condition = additionalConditions
    ? and(baseCondition, additionalConditions)
    : baseCondition;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.update(table).set(values as any).where(condition!);
}

/**
 * Standalone function to create a scoped delete
 * Auto-filters by client_id
 *
 * @param db Database instance
 * @param table Table to delete from
 * @param clientId Tenant client ID
 * @param additionalConditions Optional additional WHERE conditions
 */
export function scopedDelete<T extends TenantTable>(
  db: PostgresJsDatabase,
  table: T,
  clientId: string,
  additionalConditions?: SQL
) {
  const baseCondition = eq(table.clientId, clientId);
  const condition = additionalConditions
    ? and(baseCondition, additionalConditions)
    : baseCondition;

  return db.delete(table).where(condition!);
}

/**
 * Assert that a record belongs to the specified tenant
 * Throws TenantAccessError if ownership validation fails
 *
 * @param record The record to validate
 * @param clientId The expected client ID
 * @param resourceType The type of resource (for error messages)
 * @param correlationId Optional correlation ID for tracing
 * @throws TenantAccessError if record doesn't belong to the client
 *
 * @example
 * ```typescript
 * const brandKit = await db.select().from(brandKitsTable).where(eq(brandKitsTable.id, id));
 *
 * assertTenantOwnership(brandKit[0], 'client-123', 'BrandKit');
 * // Throws if brandKit.clientId !== 'client-123'
 * ```
 */
export function assertTenantOwnership<T extends TenantRecord>(
  record: T | null | undefined,
  clientId: string,
  resourceType: string,
  correlationId?: string
): asserts record is T {
  if (!record) {
    throw new TenantAccessError(
      `${resourceType} not found or access denied`,
      clientId,
      resourceType,
      undefined,
      correlationId
    );
  }

  if (record.clientId !== clientId) {
    // Get the resource ID if available
    const resourceId = typeof record['id'] === 'string' ? record['id'] : undefined;

    throw new TenantAccessError(
      `Access denied: ${resourceType} does not belong to this tenant`,
      clientId,
      resourceType,
      resourceId,
      correlationId
    );
  }
}

/**
 * Check if a record belongs to the specified tenant
 * Returns boolean instead of throwing
 *
 * @param record The record to validate
 * @param clientId The expected client ID
 * @returns true if record belongs to the client, false otherwise
 */
export function checkTenantOwnership<T extends TenantRecord>(
  record: T | null | undefined,
  clientId: string
): record is T {
  return record != null && record.clientId === clientId;
}

/**
 * Validate that a client ID is in valid UUID format
 *
 * @param clientId The client ID to validate
 * @returns true if valid UUID format
 */
export function isValidClientId(clientId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(clientId);
}

/**
 * Generate a correlation ID for request tracing
 *
 * @returns UUID v4 correlation ID
 */
export function generateCorrelationId(): string {
  return randomUUID();
}
