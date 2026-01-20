/**
 * Brand Kits table schema
 *
 * Defines brand voice, ICP, compliance, and visual identity for a client.
 * Used by AI agents to maintain consistent brand messaging.
 */

import { pgTable, varchar, jsonb, integer, index, foreignKey, unique } from 'drizzle-orm/pg-core';
import { idColumn, timestamps, clientIdColumn } from './base.js';
import { clients } from './clients.js';

/**
 * Voice style configuration
 */
export interface VoiceStyle {
  tone: string;
  personality?: string[];
  writingStyle?: string;
  vocabulary?: {
    preferred: string[];
    avoided: string[];
  };
  examples?: Array<{
    context: string;
    example: string;
  }>;
}

/**
 * Visual tokens configuration
 */
export interface VisualTokens {
  colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    [key: string]: string | undefined;
  };
  typography?: {
    headingFont?: string;
    bodyFont?: string;
    baseSize?: number;
  };
  logoUrls?: {
    primary?: string;
    icon?: string;
    dark?: string;
    light?: string;
  };
  spacing?: {
    base?: number;
    scale?: number;
  };
}

/**
 * Compliance rules configuration
 */
export interface ComplianceRules {
  industry?: string;
  restrictions?: string[];
  requiredDisclosures?: string[];
  prohibitedTopics?: string[];
  platformSpecific?: Record<string, {
    restrictions?: string[];
    requirements?: string[];
  }>;
}

/**
 * ICP (Ideal Customer Profile) configuration
 */
export interface ICP {
  demographics?: {
    ageRange?: { min?: number; max?: number };
    gender?: string;
    income?: string;
    location?: string[];
    education?: string;
    occupation?: string[];
  };
  psychographics?: {
    interests?: string[];
    values?: string[];
    painPoints?: string[];
    goals?: string[];
    fears?: string[];
  };
  behaviors?: {
    platforms?: string[];
    contentPreferences?: string[];
    purchaseDrivers?: string[];
    mediaConsumption?: string[];
  };
}

/**
 * Brand Kits table
 */
export const brandKits = pgTable('brand_kits', {
  ...idColumn,
  ...clientIdColumn,

  // Brand elements as JSON
  voiceStyle: jsonb('voice_style').$type<VoiceStyle>().notNull(),
  visualTokens: jsonb('visual_tokens').$type<VisualTokens | null>(),
  complianceRules: jsonb('compliance_rules').$type<ComplianceRules | null>(),
  icp: jsonb('icp').$type<ICP | null>(),

  // Versioning
  version: integer('version').default(1).notNull(),

  // Metadata
  ...timestamps,
}, (table) => ({
  // Foreign key
  clientFk: foreignKey({
    columns: [table.clientId],
    foreignColumns: [clients.id],
    name: 'brand_kits_client_id_fk',
  }).onDelete('cascade'),

  // Unique constraint: one brandkit per client
  clientUnique: unique('brand_kits_client_id_unique').on(table.clientId),

  // Indexes
  clientIdx: index('brand_kits_client_id_idx').on(table.clientId),
}));

/**
 * Brand Kit insert type
 */
export type NewBrandKit = typeof brandKits.$inferInsert;

/**
 * Brand Kit select type
 */
export type BrandKit = typeof brandKits.$inferSelect;
