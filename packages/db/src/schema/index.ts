/**
 * @rtv/db Schema Exports
 *
 * Central export point for all database schemas.
 * Schemas are organized by domain and follow multi-tenant patterns.
 *
 * All tables include:
 * - client_id: Tenant isolation
 * - created_at: Record creation timestamp
 * - updated_at: Record modification timestamp
 */

// Base schema types and utilities
export * from './base.js';

// Core tables
export * from './clients.js';
export * from './brand-kits.js';
export * from './knowledge-bases.js';
export * from './offers.js';
export * from './audit-events.js';
export * from './episodes.js';
export * from './memory-priority.js';
export * from './checkpoints.js';

// Table references for Drizzle queries
import { clients } from './clients.js';
import { brandKits } from './brand-kits.js';
import { knowledgeBases, knowledgeChunks } from './knowledge-bases.js';
import { offers } from './offers.js';
import { auditEvents } from './audit-events.js';
import { episodes, episodeTransitions } from './episodes.js';
import { memoryEntries, memoryAccessLog, pinnedBudgetUsage } from './memory-priority.js';
import { checkpoints } from './checkpoints.js';

export const schema = {
  clients,
  brandKits,
  knowledgeBases,
  knowledgeChunks,
  offers,
  auditEvents,
  episodes,
  episodeTransitions,
  memoryEntries,
  memoryAccessLog,
  pinnedBudgetUsage,
  checkpoints,
};
