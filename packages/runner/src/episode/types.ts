/**
 * Episode Lifecycle Types
 *
 * An Episode is a bounded unit of autonomous work representing a single
 * execution session where an agent performs a task with defined budgets.
 */

import { z } from 'zod';

// =====================
// Episode Status
// =====================

export const EpisodeStatusSchema = z.enum([
  'created',
  'running',
  'suspended',
  'completed',
  'failed',
]);
export type EpisodeStatus = z.infer<typeof EpisodeStatusSchema>;

// =====================
// Episode Budget
// =====================

/**
 * Budget limits for an episode
 */
export const EpisodeBudgetSchema = z.object({
  /** Maximum tokens that can be consumed */
  maxTokens: z.number().int().positive().optional(),
  /** Maximum wall-clock time in milliseconds */
  maxTimeMs: z.number().int().positive().optional(),
  /** Maximum retry attempts */
  maxRetries: z.number().int().min(0).optional(),
  /** Maximum subcall depth */
  maxSubcalls: z.number().int().min(0).optional(),
  /** Maximum tool call count */
  maxToolCalls: z.number().int().min(0).optional(),
});
export type EpisodeBudget = z.infer<typeof EpisodeBudgetSchema>;

/**
 * Budget consumption state
 */
export const BudgetStateSchema = z.object({
  tokensUsed: z.number().int().min(0).default(0),
  timeElapsedMs: z.number().int().min(0).default(0),
  retriesUsed: z.number().int().min(0).default(0),
  subcallsUsed: z.number().int().min(0).default(0),
  toolCallsUsed: z.number().int().min(0).default(0),
});
export type BudgetState = z.infer<typeof BudgetStateSchema>;

// =====================
// Episode Configuration
// =====================

/**
 * Configuration for creating an episode
 */
export const EpisodeConfigSchema = z.object({
  /** Agent identifier */
  agentId: z.string(),
  /** Task type being performed */
  taskType: z.string(),
  /** Client ID for tenant isolation */
  clientId: z.string(),
  /** Budget limits */
  budget: EpisodeBudgetSchema,
  /** Input data for the task */
  input: z.record(z.unknown()),
  /** Parent episode ID for nested execution */
  parentEpisodeId: z.string().optional(),
  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});
export type EpisodeConfig = z.infer<typeof EpisodeConfigSchema>;

// =====================
// Episode Error
// =====================

/**
 * Episode failure information
 */
export const EpisodeErrorSchema = z.object({
  /** Error message */
  message: z.string(),
  /** Error code for programmatic handling */
  code: z.string(),
  /** Stack trace (if available) */
  stack: z.string().optional(),
  /** Additional error details */
  details: z.record(z.unknown()).optional(),
  /** Whether the error is retryable */
  retryable: z.boolean().default(false),
});
export type EpisodeError = z.infer<typeof EpisodeErrorSchema>;

// =====================
// Episode Checkpoint
// =====================

/**
 * Checkpoint for suspension/resumption
 */
export const EpisodeCheckpointSchema = z.object({
  /** Current step index */
  currentStep: z.number().int().min(0),
  /** Intermediate results accumulated */
  intermediateResults: z.array(z.unknown()).optional(),
  /** Tool-specific state */
  toolState: z.record(z.unknown()).optional(),
  /** Memory references accessed */
  memoryReferences: z.array(z.string()).optional(),
  /** Custom data for agent-specific state */
  customData: z.record(z.unknown()).optional(),
});
export type EpisodeCheckpoint = z.infer<typeof EpisodeCheckpointSchema>;

// =====================
// Episode Outputs
// =====================

/**
 * Outputs produced by completed episode
 */
export const EpisodeOutputsSchema = z.object({
  /** Primary outputs */
  outputs: z.record(z.unknown()),
  /** Artifact IDs produced */
  artifacts: z.array(z.string()).optional(),
  /** Summaries generated */
  summaries: z
    .array(
      z.object({
        type: z.string(),
        content: z.string(),
        refId: z.string().optional(),
      })
    )
    .optional(),
});
export type EpisodeOutputs = z.infer<typeof EpisodeOutputsSchema>;

// =====================
// Full Episode Entity
// =====================

/**
 * Complete Episode record
 */
export const EpisodeSchema = z.object({
  // Identity
  id: z.string(),
  agentId: z.string(),
  taskType: z.string(),
  clientId: z.string(),

  // Hierarchy
  parentEpisodeId: z.string().nullable(),
  childEpisodeIds: z.array(z.string()),

  // State
  status: EpisodeStatusSchema,
  budget: EpisodeBudgetSchema,
  budgetState: BudgetStateSchema,

  // Input/Output
  input: z.record(z.unknown()),
  outputs: z.record(z.unknown()).nullable(),
  artifacts: z.array(z.string()),

  // Suspension
  checkpoint: EpisodeCheckpointSchema.nullable(),

  // Error handling
  error: EpisodeErrorSchema.nullable(),

  // Timestamps
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  suspendedAt: z.date().nullable(),
  resumedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  failedAt: z.date().nullable(),

  // Metadata
  metadata: z.record(z.unknown()),
});
export type Episode = z.infer<typeof EpisodeSchema>;

// =====================
// List Options
// =====================

/**
 * Options for listing episodes
 */
export const EpisodeListOptionsSchema = z.object({
  status: EpisodeStatusSchema.optional(),
  agentId: z.string().optional(),
  taskType: z.string().optional(),
  parentEpisodeId: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  limit: z.number().int().positive().default(100),
  offset: z.number().int().min(0).default(0),
});
export type EpisodeListOptions = z.infer<typeof EpisodeListOptionsSchema>;

// =====================
// Budget Update
// =====================

/**
 * Incremental budget update
 */
export const BudgetUpdateSchema = z.object({
  tokensUsed: z.number().int().min(0).optional(),
  timeElapsedMs: z.number().int().min(0).optional(),
  subcallsUsed: z.number().int().min(0).optional(),
  toolCallsUsed: z.number().int().min(0).optional(),
});
export type BudgetUpdate = z.infer<typeof BudgetUpdateSchema>;

// =====================
// Dependencies Interfaces
// =====================

/**
 * Episode storage interface
 */
export interface EpisodeStore {
  insert(episode: Episode): Promise<Episode>;
  update(id: string, updates: Partial<Episode>): Promise<Episode>;
  getById(id: string): Promise<Episode | null>;
  listByClient(clientId: string, options?: EpisodeListOptions): Promise<Episode[]>;
}

/**
 * Audit event emitter interface
 */
export interface AuditEmitter {
  emit(event: {
    type: string;
    actor: string;
    target: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

/**
 * Session manager interface (adapts RlmEnv)
 */
export interface SessionManager {
  createSession(params: {
    episodeId: string;
    clientId: string;
    budget: EpisodeBudget;
  }): Promise<{ episodeId: string; budgetState: Partial<BudgetState> }>;

  getSession(episodeId: string): Promise<{ budgetState: Partial<BudgetState> } | null>;

  restoreSession(params: {
    episodeId: string;
    clientId: string;
    budgetState: BudgetState;
  }): Promise<{ episodeId: string; budgetState: BudgetState }>;

  closeSession(episodeId: string): Promise<void>;

  updateBudgetState(episodeId: string, update: BudgetUpdate): Promise<void>;
}

/**
 * Episode service dependencies
 */
export interface EpisodeServiceDeps {
  store: EpisodeStore;
  audit: AuditEmitter;
  sessionManager: SessionManager;
}
