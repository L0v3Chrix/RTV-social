/**
 * Audit Events table schema
 *
 * Immutable action logging for compliance and debugging.
 * Every side effect in the system creates an audit event.
 * This table is append-only - records are never updated or deleted.
 */

import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { idColumn, clientIdColumn } from './base.js';

/**
 * Audit event payload type
 * Flexible JSON structure for storing action-specific data
 */
export interface AuditEventPayload {
  /** Previous state before the action (for updates) */
  before?: Record<string, unknown> | undefined;
  /** New state after the action (for creates/updates) */
  after?: Record<string, unknown> | undefined;
  /** Additional context about the action */
  context?: Record<string, unknown> | undefined;
  /** Error details if the action failed */
  error?: {
    code: string;
    message: string;
    stack?: string | undefined;
  } | undefined;
  /** Any other action-specific data */
  [key: string]: unknown;
}

/**
 * Audit Events table
 *
 * Immutable log of all actions in the system.
 * Used for compliance, debugging, and observability.
 */
export const auditEvents = pgTable('audit_events', {
  ...idColumn,
  ...clientIdColumn,

  /**
   * Actor who performed the action
   * Can be a user ID, system ID, or agent ID
   */
  actorId: uuid('actor_id').notNull(),

  /**
   * Action name (e.g., 'create', 'update', 'delete', 'publish', 'schedule')
   */
  action: varchar('action', { length: 100 }).notNull(),

  /**
   * Type of resource being acted upon (e.g., 'post', 'campaign', 'brand_kit')
   */
  resourceType: varchar('resource_type', { length: 100 }).notNull(),

  /**
   * ID of the resource being acted upon
   */
  resourceId: uuid('resource_id').notNull(),

  /**
   * Flexible JSON payload for action-specific data
   */
  payload: jsonb('payload').$type<AuditEventPayload>().default({}).notNull(),

  /**
   * Timestamp when the event was created (immutable)
   */
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  /**
   * Composite index for querying by client and resource type
   * Supports queries like: "Show all post-related events for client X"
   */
  clientResourceTypeIdx: index('audit_events_client_resource_type_idx')
    .on(table.clientId, table.resourceType),

  /**
   * Composite index for querying by client and time
   * Supports queries like: "Show recent events for client X"
   */
  clientCreatedAtIdx: index('audit_events_client_created_at_idx')
    .on(table.clientId, table.createdAt),
}));

/**
 * Audit Event insert type
 */
export type NewAuditEvent = typeof auditEvents.$inferInsert;

/**
 * Audit Event select type
 */
export type AuditEvent = typeof auditEvents.$inferSelect;
