/**
 * Checkpoints Table Schema
 *
 * Stores checkpoint records for episode suspension and resume.
 * Enables long-running episodes to be paused and continued later.
 */

import { uuid, varchar, integer, jsonb, timestamp, index, pgTable } from 'drizzle-orm/pg-core';
import { idColumn } from './base.js';
import { episodes } from './episodes.js';

/**
 * Checkpoint Progress type
 */
export interface CheckpointProgressDb {
  currentStep?: number;
  total?: number;
  pendingTools?: string[];
  completedTools?: string[];
  [key: string]: unknown;
}

/**
 * Checkpoint Budget State type
 */
export interface CheckpointBudgetStateDb {
  tokens?: { used: number; limit: number };
  time?: { used: number; limit: number };
  retries?: { used: number; limit: number };
  subcalls?: { used: number; limit: number };
  toolCalls?: { used: number; limit: number };
}

/**
 * Checkpoints Table
 */
export const checkpoints = pgTable(
  'checkpoints',
  {
    ...idColumn,
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    phase: varchar('phase', { length: 50 }).notNull(),
    progress: jsonb('progress').$type<CheckpointProgressDb>().notNull(),
    loopCount: integer('loop_count').notNull().default(0),
    context: jsonb('context').$type<Record<string, unknown>>(),
    budgetState: jsonb('budget_state').$type<CheckpointBudgetStateDb>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    episodeIdx: index('checkpoints_episode_idx').on(table.episodeId),
    createdAtIdx: index('checkpoints_created_at_idx').on(table.createdAt),
    episodeCreatedAtIdx: index('checkpoints_episode_created_at_idx').on(
      table.episodeId,
      table.createdAt
    ),
  })
);

// Type exports
export type CheckpointRow = typeof checkpoints.$inferSelect;
export type NewCheckpointRow = typeof checkpoints.$inferInsert;
