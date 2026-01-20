/**
 * Episodes Table Schema
 *
 * Stores episode records for bounded autonomous work units.
 * Episodes track agent execution with budgets, checkpoints, and outputs.
 */

import { pgTable, varchar, jsonb, timestamp, index, uuid } from 'drizzle-orm/pg-core';
import { idColumn, clientIdColumn, timestamps } from './base.js';

/**
 * Episode Status type
 */
export type EpisodeStatusDb = 'created' | 'running' | 'suspended' | 'completed' | 'failed';

/**
 * Episode Budget type (mirrors @rtv/runner types)
 */
export interface EpisodeBudgetDb {
  maxTokens?: number;
  maxTimeMs?: number;
  maxRetries?: number;
  maxSubcalls?: number;
  maxToolCalls?: number;
}

/**
 * Budget State type
 */
export interface BudgetStateDb {
  tokensUsed: number;
  timeElapsedMs: number;
  retriesUsed: number;
  subcallsUsed: number;
  toolCallsUsed: number;
}

/**
 * Episode Checkpoint type
 */
export interface EpisodeCheckpointDb {
  currentStep: number;
  intermediateResults?: unknown[];
  toolState?: Record<string, unknown>;
  memoryReferences?: string[];
  customData?: Record<string, unknown>;
}

/**
 * Episode Error type
 */
export interface EpisodeErrorDb {
  message: string;
  code: string;
  stack?: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

/**
 * Episodes Table
 */
export const episodes = pgTable(
  'episodes',
  {
    // Identity
    ...idColumn,
    ...clientIdColumn,
    agentId: varchar('agent_id', { length: 100 }).notNull(),
    taskType: varchar('task_type', { length: 100 }).notNull(),

    // Hierarchy
    parentEpisodeId: uuid('parent_episode_id'),

    // State
    status: varchar('status', { length: 20 }).notNull().$type<EpisodeStatusDb>(),
    budget: jsonb('budget').$type<EpisodeBudgetDb>().notNull(),
    budgetState: jsonb('budget_state').$type<BudgetStateDb>().notNull(),

    // Input/Output
    input: jsonb('input').notNull(),
    outputs: jsonb('outputs'),
    artifacts: jsonb('artifacts').$type<string[]>().default([]),

    // Suspension
    checkpoint: jsonb('checkpoint').$type<EpisodeCheckpointDb>(),

    // Error handling
    error: jsonb('error').$type<EpisodeErrorDb>(),

    // Timestamps
    ...timestamps,
    startedAt: timestamp('started_at', { withTimezone: true }),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    resumedAt: timestamp('resumed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),

    // Metadata
    metadata: jsonb('metadata').default({}),
  },
  (table) => ({
    clientIdx: index('episodes_client_idx').on(table.clientId),
    statusIdx: index('episodes_status_idx').on(table.status),
    agentIdx: index('episodes_agent_idx').on(table.agentId),
    parentIdx: index('episodes_parent_idx').on(table.parentEpisodeId),
    createdAtIdx: index('episodes_created_at_idx').on(table.createdAt),
    clientStatusIdx: index('episodes_client_status_idx').on(table.clientId, table.status),
  })
);

/**
 * Episode Transitions Table (audit trail)
 *
 * Records all state transitions for debugging and compliance.
 */
export const episodeTransitions = pgTable(
  'episode_transitions',
  {
    ...idColumn,
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id),
    fromStatus: varchar('from_status', { length: 20 }).notNull().$type<EpisodeStatusDb>(),
    toStatus: varchar('to_status', { length: 20 }).notNull().$type<EpisodeStatusDb>(),
    reason: varchar('reason', { length: 500 }),
    metadata: jsonb('metadata'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    episodeIdx: index('episode_transitions_episode_idx').on(table.episodeId),
    occurredAtIdx: index('episode_transitions_occurred_at_idx').on(table.occurredAt),
  })
);

// Type exports
export type EpisodeRow = typeof episodes.$inferSelect;
export type NewEpisodeRow = typeof episodes.$inferInsert;
export type EpisodeTransitionRow = typeof episodeTransitions.$inferSelect;
export type NewEpisodeTransitionRow = typeof episodeTransitions.$inferInsert;
