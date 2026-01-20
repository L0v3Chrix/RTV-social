/**
 * Memory Priority Table Schema
 *
 * Stores memory entries with Tesla-inspired priority levels for
 * eviction management and context window optimization.
 */

import {
  pgTable,
  varchar,
  jsonb,
  timestamp,
  index,
  uuid,
  integer,
  text,
  real,
} from 'drizzle-orm/pg-core';
import { idColumn, clientIdColumn, timestamps } from './base.js';

/**
 * Memory Priority type
 *
 * PINNED: Never evicted - brand voice, compliance rules
 * SESSION: Kept for campaign duration - active objectives
 * SLIDING: Normal LRU eviction - general history
 * EPHEMERAL: Single-use - discarded after task completion
 */
export type MemoryPriorityDb = 'pinned' | 'session' | 'sliding' | 'ephemeral';

/**
 * Memory Category type
 *
 * Categories help determine default priority levels.
 */
export type MemoryCategoryDb =
  // PINNED categories
  | 'brand_voice'
  | 'compliance_rules'
  | 'prohibited_topics'
  | 'tone_guidelines'
  | 'legal_disclaimers'
  // SESSION categories
  | 'campaign_objectives'
  | 'active_threads'
  | 'current_offers'
  | 'session_context'
  // SLIDING categories
  | 'engagement_history'
  | 'post_performance'
  | 'audience_insights'
  | 'conversation_summaries'
  // EPHEMERAL categories
  | 'intermediate_drafts'
  | 'tool_outputs'
  | 'temporary_calculations'
  | 'debug_context'
  // Generic
  | 'other';

/**
 * Memory Entries Table
 *
 * Stores contextual memory with priority-based eviction.
 */
export const memoryEntries = pgTable(
  'memory_entries',
  {
    // Identity
    ...idColumn,
    ...clientIdColumn,

    // Content
    key: varchar('key', { length: 255 }).notNull(),
    content: text('content').notNull(),
    category: varchar('category', { length: 50 }).notNull().$type<MemoryCategoryDb>(),

    // Priority & Eviction
    priority: varchar('priority', { length: 20 }).notNull().$type<MemoryPriorityDb>(),
    evictionScore: real('eviction_score').notNull().default(0),
    accessCount: integer('access_count').notNull().default(0),
    tokenCount: integer('token_count').notNull().default(0),

    // Session binding (for SESSION priority)
    sessionId: uuid('session_id'),

    // Timestamps
    ...timestamps,
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Metadata
    metadata: jsonb('metadata').default({}),
  },
  (table) => ({
    // Primary lookup indexes
    clientIdx: index('memory_entries_client_idx').on(table.clientId),
    keyIdx: index('memory_entries_key_idx').on(table.clientId, table.key),

    // Priority-based indexes for eviction queries
    priorityIdx: index('memory_entries_priority_idx').on(table.priority),
    clientPriorityIdx: index('memory_entries_client_priority_idx').on(
      table.clientId,
      table.priority
    ),

    // Eviction score for LRU selection (lower scores evicted first)
    evictionScoreIdx: index('memory_entries_eviction_score_idx').on(table.evictionScore),

    // Access patterns
    lastAccessedIdx: index('memory_entries_last_accessed_idx').on(table.lastAccessedAt),

    // Session binding for SESSION priority entries
    sessionIdx: index('memory_entries_session_idx').on(table.sessionId),

    // Category lookup
    categoryIdx: index('memory_entries_category_idx').on(table.clientId, table.category),

    // Composite index for efficient eviction queries
    // (find lowest priority entries with lowest scores for a client)
    clientPriorityScoreIdx: index('memory_entries_client_priority_score_idx').on(
      table.clientId,
      table.priority,
      table.evictionScore
    ),

    // Expiration cleanup
    expiresAtIdx: index('memory_entries_expires_at_idx').on(table.expiresAt),
  })
);

/**
 * Memory Access Log Table
 *
 * Tracks access patterns for priority optimization.
 */
export const memoryAccessLog = pgTable(
  'memory_access_log',
  {
    ...idColumn,
    memoryEntryId: uuid('memory_entry_id')
      .notNull()
      .references(() => memoryEntries.id),
    accessedAt: timestamp('accessed_at', { withTimezone: true }).notNull().defaultNow(),
    accessType: varchar('access_type', { length: 20 })
      .notNull()
      .$type<'read' | 'write' | 'update'>(),
    context: jsonb('context'),
  },
  (table) => ({
    entryIdx: index('memory_access_log_entry_idx').on(table.memoryEntryId),
    accessedAtIdx: index('memory_access_log_accessed_at_idx').on(table.accessedAt),
  })
);

/**
 * Pinned Budget Tracking Table
 *
 * Tracks pinned token usage per client for budget enforcement.
 */
export const pinnedBudgetUsage = pgTable(
  'pinned_budget_usage',
  {
    ...idColumn,
    ...clientIdColumn,

    // Budget tracking
    totalTokens: integer('total_tokens').notNull().default(0),
    maxTokens: integer('max_tokens').notNull().default(2000),
    entryCount: integer('entry_count').notNull().default(0),

    // Timestamps
    ...timestamps,
    lastCalculatedAt: timestamp('last_calculated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    clientIdx: index('pinned_budget_usage_client_idx').on(table.clientId),
  })
);

// Type exports
export type MemoryEntryRow = typeof memoryEntries.$inferSelect;
export type NewMemoryEntryRow = typeof memoryEntries.$inferInsert;
export type MemoryAccessLogRow = typeof memoryAccessLog.$inferSelect;
export type NewMemoryAccessLogRow = typeof memoryAccessLog.$inferInsert;
export type PinnedBudgetUsageRow = typeof pinnedBudgetUsage.$inferSelect;
export type NewPinnedBudgetUsageRow = typeof pinnedBudgetUsage.$inferInsert;
