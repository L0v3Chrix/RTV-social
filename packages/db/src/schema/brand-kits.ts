/**
 * Brand Kits table schema
 *
 * Defines brand voice, colors, and visual identity for a client.
 * Used by AI agents to maintain consistent brand messaging.
 */

import { pgTable, varchar, jsonb, boolean, index, foreignKey } from 'drizzle-orm/pg-core';
import { idColumn, timestamps, clientIdColumn } from './base.js';
import { clients } from './clients.js';

/**
 * Brand tone configuration
 */
export interface BrandTone {
  voice: 'professional' | 'casual' | 'friendly' | 'authoritative' | 'playful';
  personality: string[];
  doList: string[];
  dontList: string[];
  examplePhrases?: string[] | undefined;
}

/**
 * Brand colors configuration
 */
export interface BrandColors {
  primary: string;
  secondary?: string | undefined;
  accent?: string | undefined;
  background?: string | undefined;
  text?: string | undefined;
  [key: string]: string | undefined;
}

/**
 * Logo reference
 */
export interface LogoRef {
  type: 'primary' | 'secondary' | 'icon' | 'wordmark';
  url: string;
  format: 'png' | 'svg' | 'jpg';
  dimensions?: { width: number; height: number } | undefined;
}

/**
 * Brand Kits table
 */
export const brandKits = pgTable('brand_kits', {
  ...idColumn,
  ...clientIdColumn,

  // Basic info
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 1000 }),

  // Brand elements
  tone: jsonb('tone').$type<BrandTone>().notNull(),
  colors: jsonb('colors').$type<BrandColors>().notNull(),
  logoRefs: jsonb('logo_refs').$type<LogoRef[]>().default([]).notNull(),

  // Typography (optional)
  fonts: jsonb('fonts').$type<{
    heading?: string | undefined;
    body?: string | undefined;
    accent?: string | undefined;
  }>(),

  // Status
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Metadata
  ...timestamps,
}, (table) => ({
  // Foreign key
  clientFk: foreignKey({
    columns: [table.clientId],
    foreignColumns: [clients.id],
    name: 'brand_kits_client_id_fk',
  }).onDelete('cascade'),

  // Indexes
  clientIdx: index('brand_kits_client_id_idx').on(table.clientId),
  defaultIdx: index('brand_kits_default_idx').on(table.clientId, table.isDefault),
}));

/**
 * Brand Kit insert type
 */
export type NewBrandKit = typeof brandKits.$inferInsert;

/**
 * Brand Kit select type
 */
export type BrandKit = typeof brandKits.$inferSelect;
