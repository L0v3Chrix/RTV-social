/**
 * Base Schema Utilities
 *
 * Common column definitions and utilities for all schemas.
 * Enforces multi-tenant patterns and audit trails.
 */
import { pgTable, uuid, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * Standard timestamp columns for all tables
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
};

/**
 * Standard ID column (UUID v7 for sortability)
 */
export const idColumn = {
  id: uuid('id').primaryKey().defaultRandom(),
};

/**
 * Client ID column for multi-tenant isolation
 * Every query MUST filter by client_id
 */
export const clientIdColumn = {
  clientId: uuid('client_id').notNull(),
};

/**
 * Example: Base table schema pattern
 *
 * All domain tables should follow this pattern:
 *
 * export const myTable = pgTable('my_table', {
 *   ...idColumn,
 *   ...clientIdColumn,
 *   // domain-specific columns
 *   name: varchar('name', { length: 255 }).notNull(),
 *   ...timestamps,
 * });
 */

/**
 * Health check table for connection testing
 */
export const healthCheck = pgTable('health_check', {
  id: uuid('id').primaryKey().defaultRandom(),
  checkedAt: timestamp('checked_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  status: varchar('status', { length: 50 }).notNull().default('ok'),
});

// Re-export drizzle-orm types for convenience
export {
  pgTable,
  uuid,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export { relations, sql } from 'drizzle-orm';
