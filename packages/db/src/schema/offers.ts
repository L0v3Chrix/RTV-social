/**
 * Offers table schema
 *
 * Stores active promotions, products, and services with CTAs for content generation.
 * Used by the planner agent to propose content and by content generators for CTAs.
 */

import { pgTable, varchar, text, jsonb, integer, timestamp, index, foreignKey } from 'drizzle-orm/pg-core';
import { idColumn, timestamps, clientIdColumn } from './base.js';
import { clients } from './clients.js';

/**
 * CTA button configuration
 */
export interface CTAButton {
  text: string;
  url?: string;
  action: 'link' | 'calendar_booking' | 'form' | 'dm' | 'phone' | 'email';
  metadata?: Record<string, unknown>;
}

/**
 * CTA configuration
 */
export interface CTAConfig {
  primary: CTAButton;
  secondary?: CTAButton;
}

/**
 * Active period
 */
export interface ActivePeriod {
  startDate: string; // ISO date string
  endDate?: string;  // ISO date string
}

/**
 * Pricing information
 */
export interface Pricing {
  originalPrice?: number;
  salePrice?: number;
  currency: string;
  discountPercent?: number;
  priceText?: string;
}

/**
 * Offers table
 */
export const offers = pgTable('offers', {
  ...idColumn,
  ...clientIdColumn,

  // Basic info
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // product, service, promotion, event, content
  status: varchar('status', { length: 50 }).notNull().default('draft'), // draft, active, inactive, deleted
  headline: varchar('headline', { length: 500 }).notNull(),
  description: text('description').notNull(),

  // CTA configuration
  cta: jsonb('cta').$type<CTAConfig | null>(),

  // Scheduling
  activePeriod: jsonb('active_period').$type<ActivePeriod | null>(),

  // Pricing
  pricing: jsonb('pricing').$type<Pricing | null>(),

  // Targeting
  platformTargeting: jsonb('platform_targeting').$type<string[] | null>(),

  // Categorization
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),

  // Priority (0-100, higher = more important)
  priority: integer('priority').default(50).notNull(),

  // Soft delete
  deletedAt: timestamp('deleted_at', { withTimezone: true }),

  // Timestamps
  ...timestamps,
}, (table) => ({
  // Foreign key
  clientFk: foreignKey({
    columns: [table.clientId],
    foreignColumns: [clients.id],
    name: 'offers_client_id_fk',
  }).onDelete('cascade'),

  // Indexes
  clientIdx: index('offers_client_id_idx').on(table.clientId),
  statusIdx: index('offers_status_idx').on(table.status),
  typeIdx: index('offers_type_idx').on(table.type),
  priorityIdx: index('offers_priority_idx').on(table.priority),
}));

/**
 * Offer insert type
 */
export type NewOffer = typeof offers.$inferInsert;

/**
 * Offer select type
 */
export type OfferRow = typeof offers.$inferSelect;
