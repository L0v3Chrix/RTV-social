/**
 * S1-D5: Checkpoint and Resume Types
 *
 * Type definitions for the checkpoint system that enables
 * episode suspension and resumption.
 */

import { z } from 'zod';

// =====================
// Budget State Schema
// =====================

/**
 * Budget usage state for a single budget type.
 */
export const CheckpointBudgetUsageSchema = z.object({
  used: z.number(),
  limit: z.number(),
});

/**
 * Complete budget state across all budget types.
 */
export const CheckpointBudgetStateSchema = z.object({
  tokens: CheckpointBudgetUsageSchema.optional(),
  time: CheckpointBudgetUsageSchema.optional(),
  retries: CheckpointBudgetUsageSchema.optional(),
  subcalls: CheckpointBudgetUsageSchema.optional(),
  toolCalls: CheckpointBudgetUsageSchema.optional(),
});

export type CheckpointBudgetUsage = z.infer<typeof CheckpointBudgetUsageSchema>;
export type CheckpointBudgetState = z.infer<typeof CheckpointBudgetStateSchema>;

// =====================
// Checkpoint Data Schema
// =====================

/**
 * Data required to create a checkpoint.
 */
export const CheckpointDataSchema = z.object({
  episodeId: z.string(),
  phase: z.string(),
  progress: z.record(z.unknown()),
  loopCount: z.number(),
  context: z.record(z.unknown()).optional(),
  budgetState: CheckpointBudgetStateSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CheckpointData = z.infer<typeof CheckpointDataSchema>;

// =====================
// Stored Checkpoint
// =====================

/**
 * Full checkpoint record with system fields.
 */
export interface Checkpoint extends CheckpointData {
  id: string;
  createdAt: string;
  version: number;
}

// =====================
// Strategy Types
// =====================

/**
 * Options for configuring checkpoint strategy.
 */
export interface CheckpointStrategyOptions {
  /** Create checkpoint after each phase completes */
  onPhaseComplete?: boolean;
  /** Create checkpoint after each full loop */
  onLoopComplete?: boolean;
  /** Create checkpoint on budget warning */
  onBudgetWarning?: boolean;
  /** Create checkpoint at this interval (milliseconds) */
  intervalMs?: number;
  /** Only checkpoint on specific phases */
  phases?: string[];
}

/**
 * Context for checkpoint decision.
 */
export interface CheckpointCheckContext {
  /** The event that triggered the check */
  event: string;
  /** Whether this is the end of a perceive-plan-act-observe loop */
  isLoopEnd?: boolean;
  /** Timestamp of last checkpoint */
  lastCheckpointAt?: number;
  /** Current phase */
  phase?: string;
}

// =====================
// Prune Options
// =====================

/**
 * Options for pruning old checkpoints.
 */
export interface PruneOptions {
  /** Maximum age in days for checkpoints */
  maxAgeDays?: number;
  /** Maximum number of checkpoints per episode */
  maxCount?: number;
}

// =====================
// Manager Types
// =====================

/**
 * Input for the maybeCheckpoint method.
 */
export interface MaybeCheckpointInput {
  episodeId: string;
  event: string;
  state: {
    phase: string;
    progress: Record<string, unknown>;
    loopCount: number;
    context?: Record<string, unknown>;
    budgetState?: CheckpointBudgetState;
  };
  isLoopEnd?: boolean;
}

// =====================
// Service Interface
// =====================

/**
 * Interface for checkpoint storage operations.
 */
export interface CheckpointStore {
  create(data: CheckpointData): Promise<Checkpoint>;
  getLatest(episodeId: string): Promise<Checkpoint | null>;
  getByEpisode(episodeId: string): Promise<Checkpoint[]>;
  restore(checkpointId: string): Promise<CheckpointData | null>;
  delete(checkpointId: string): Promise<void>;
  deleteByEpisode(episodeId: string): Promise<void>;
  prune(options: PruneOptions): Promise<number>;
  pruneByEpisode(episodeId: string, options: PruneOptions): Promise<number>;
}
