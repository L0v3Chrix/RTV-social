/**
 * Clients table schema
 *
 * The root entity for multi-tenancy. Every other entity
 * references a client.
 */

import { pgTable, varchar, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { idColumn, timestamps } from './base.js';

/**
 * Client settings type
 */
export interface ClientSettings {
  timezone?: string | undefined;
  defaultLanguage?: string | undefined;
  features?: {
    publishing?: boolean | undefined;
    engagement?: boolean | undefined;
    browserLane?: boolean | undefined;
  } | undefined;
  limits?: {
    maxPlatformAccounts?: number | undefined;
    maxBrandKits?: number | undefined;
    maxKnowledgeBases?: number | undefined;
  } | undefined;
}

/**
 * Clients table
 */
export const clients = pgTable('clients', {
  ...idColumn,

  // Basic info
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Settings (JSONB for flexibility)
  settings: jsonb('settings').$type<ClientSettings>().default({}).notNull(),

  // Metadata
  ...timestamps,
}, (table) => ({
  // Indexes
  slugIdx: index('clients_slug_idx').on(table.slug),
  activeIdx: index('clients_active_idx').on(table.isActive),
}));

/**
 * Client insert type
 */
export type NewClient = typeof clients.$inferInsert;

/**
 * Client select type
 */
export type Client = typeof clients.$inferSelect;
