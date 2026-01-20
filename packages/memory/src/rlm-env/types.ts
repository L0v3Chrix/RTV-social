/**
 * RLMEnv Type Definitions
 *
 * Core types for the Recursive Language Model Environment.
 * The RLM pattern treats inference as interaction with an external
 * environment that manages memory, budgets, and retrieval.
 */

import { z } from 'zod';

// =====================
// Span Types
// =====================

/**
 * Span represents an indexed chunk of content in external memory.
 * Spans are the atomic unit of retrieval in the RLM pattern.
 */
export const SpanSchema = z.object({
  /** Unique span identifier */
  id: z.string(),

  /** Source type (knowledge_base, thread, plan, etc.) */
  sourceType: z.enum([
    'knowledge_base',
    'thread_summary',
    'plan_summary',
    'episode_log',
    'brand_kit',
    'offer',
  ]),

  /** Source entity ID */
  sourceId: z.string(),

  /** Byte offset start in source content */
  startByte: z.number().int().nonnegative(),

  /** Byte offset end in source content */
  endByte: z.number().int().positive(),

  /** Content hash for integrity verification */
  hash: z.string(),

  /** Estimated token count for budget tracking */
  tokenCount: z.number().int().positive(),

  /** Optional metadata for search ranking */
  metadata: z
    .object({
      importance: z.number().min(0).max(1).optional(),
      recency: z.number().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export type Span = z.infer<typeof SpanSchema>;

/**
 * SpanRef is a lightweight reference to a span without content.
 * Used in retrieval results before content is fetched.
 */
export const SpanRefSchema = z.object({
  spanId: z.string(),
  sourceType: SpanSchema.shape.sourceType,
  sourceId: z.string(),
  tokenCount: z.number().int().positive(),
  relevanceScore: z.number().min(0).max(1).optional(),
});

export type SpanRef = z.infer<typeof SpanRefSchema>;

// =====================
// Budget Types
// =====================

/**
 * RetrievalBudget defines resource limits for a session.
 * Budgets prevent runaway inference and ensure fair resource allocation.
 */
export const RetrievalBudgetSchema = z.object({
  /** Maximum tokens that can be retrieved */
  maxTokens: z.number().int().positive(),

  /** Maximum wall-clock time in milliseconds */
  maxTimeMs: z.number().int().positive(),

  /** Maximum retry attempts for failed operations */
  maxRetries: z.number().int().nonnegative(),
});

export type RetrievalBudget = z.infer<typeof RetrievalBudgetSchema>;

/**
 * BudgetState tracks current budget consumption.
 */
export const BudgetStateSchema = z.object({
  /** Tokens remaining in budget */
  remainingTokens: z.number().int().nonnegative(),

  /** Tokens consumed so far */
  tokensUsed: z.number().int().nonnegative(),

  /** Time remaining in milliseconds */
  remainingTimeMs: z.number().int().nonnegative(),

  /** Time elapsed in milliseconds */
  elapsedTimeMs: z.number().int().nonnegative(),

  /** Retries remaining */
  remainingRetries: z.number().int().nonnegative(),

  /** Retries used */
  retriesUsed: z.number().int().nonnegative(),
});

export type BudgetState = z.infer<typeof BudgetStateSchema>;

// =====================
// Session Types
// =====================

export type SessionStatus = 'active' | 'completed' | 'failed' | 'timeout';
export type SessionOutcome = 'success' | 'failure' | 'timeout' | 'budget_exhausted';

/**
 * RlmSession represents an active interaction with the environment.
 * Sessions track budget, access patterns, and provide retrieval methods.
 */
export interface RlmSession {
  /** Unique session identifier */
  readonly id: string;

  /** Client ID for tenant isolation */
  readonly clientId: string;

  /** Agent type that owns this session */
  readonly agentType: string;

  /** Episode ID this session belongs to */
  readonly episodeId: string;

  /** Parent session ID if this is a subcall */
  readonly parentSessionId?: string;

  /** Current session status */
  readonly status: SessionStatus;

  /** Current budget state */
  readonly budget: BudgetState;

  /** Session start timestamp */
  readonly startedAt: Date;

  /**
   * Retrieve spans matching a query.
   * Consumes budget based on tokens retrieved.
   */
  retrieve(params: RetrieveParams): Promise<RetrievalResult>;

  /**
   * Peek at a specific span without consuming budget.
   * Used for navigation and inspection.
   */
  peek(params: PeekParams): Promise<PeekResult>;

  /**
   * Create a child session for delegated work.
   * Child inherits fraction of parent's remaining budget.
   */
  subcall(params: SubcallParams): Promise<RlmSession>;

  /**
   * Write data to external memory.
   * Used for summaries, logs, and other outputs.
   */
  write(params: WriteParams): Promise<WriteResult>;

  /**
   * End the session with an outcome.
   */
  end(outcome: SessionOutcome): Promise<SessionResult>;
}

// =====================
// Operation Parameters
// =====================

export interface RetrieveParams {
  /** Query string or embedding vector */
  query: string;

  /** Maximum tokens to retrieve */
  maxTokens: number;

  /** Filter by source types */
  sourceTypes?: Span['sourceType'][];

  /** Filter by source IDs */
  sourceIds?: string[];

  /** Minimum relevance score (0-1) */
  minRelevance?: number;

  /** Sort order */
  sortBy?: 'relevance' | 'recency' | 'importance';
}

export interface RetrievalResult {
  /** Retrieved spans with content */
  spans: Array<SpanRef & { content: string }>;

  /** Total tokens consumed */
  tokensUsed: number;

  /** Whether more results are available */
  hasMore: boolean;

  /** Continuation token for pagination */
  cursor?: string;
}

export interface PeekParams {
  /** Span ID to peek */
  spanId: string;

  /** Include content in response */
  includeContent?: boolean;
}

export interface PeekResult {
  span: Span;
  content?: string;
}

export interface SubcallParams {
  /** Agent type for child session */
  agentType: string;

  /** Fraction of remaining budget (0-1) */
  budgetFraction: number;

  /** Optional fixed budget (overrides fraction) */
  fixedBudget?: Partial<RetrievalBudget>;
}

export interface WriteParams {
  /** Type of content being written */
  type: 'summary' | 'log' | 'artifact';

  /** Content to write */
  content: string;

  /** Metadata for indexing */
  metadata?: Record<string, unknown>;
}

export interface WriteResult {
  /** ID of written content */
  id: string;

  /** Spans created from content */
  spans: Span[];
}

export interface SessionResult {
  /** Final session status */
  status: 'completed' | 'failed';

  /** Outcome of the session */
  outcome: SessionOutcome;

  /** Total tokens consumed */
  totalTokensUsed: number;

  /** Total time elapsed */
  totalTimeMs: number;

  /** Number of retrieval operations */
  retrievalCount: number;

  /** Number of write operations */
  writeCount: number;
}

// =====================
// Environment Types
// =====================

export interface RlmEnvConfig {
  /** Client ID for tenant isolation */
  clientId: string;

  /** Default budget for new sessions */
  defaultBudget?: RetrievalBudget;

  /** Callback for access logging */
  onAccess?: (entry: AccessLogEntry) => void;

  /** Maximum concurrent sessions */
  maxConcurrentSessions?: number;
}

export interface AccessLogEntry {
  /** Timestamp of access */
  timestamp: Date;

  /** Session ID */
  sessionId: string;

  /** Operation type */
  operation: 'retrieve' | 'peek' | 'write' | 'subcall' | 'start' | 'end';

  /** Operation parameters (sanitized) */
  params: Record<string, unknown>;

  /** Tokens consumed (if applicable) */
  tokensConsumed?: number;

  /** Duration in milliseconds */
  durationMs: number;

  /** Error if operation failed */
  error?: string;
}

/**
 * RlmEnv is the main environment interface.
 */
export interface RlmEnv {
  /** Client ID this environment serves */
  readonly clientId: string;

  /** Start a new session */
  startSession(params: StartSessionParams): Promise<RlmSession>;

  /** Get an existing session by ID */
  getSession(sessionId: string): Promise<RlmSession | null>;

  /** Register a span in the environment */
  registerSpan(span: Span, content?: string): Promise<void>;

  /** Get span metadata */
  getSpan(spanId: string): Promise<Span | null>;

  /** Get span content */
  getSpanContent(spanId: string): Promise<string | null>;

  /** Bulk register spans */
  registerSpans(spans: Array<{ span: Span; content?: string }>): Promise<void>;

  /** Search spans (used internally by sessions) */
  searchSpans(params: SearchSpansParams): Promise<SpanRef[]>;
}

export interface StartSessionParams {
  /** Agent type starting the session */
  agentType: string;

  /** Episode ID for correlation */
  episodeId: string;

  /** Optional custom budget */
  budget?: RetrievalBudget;

  /** Parent session for subcalls */
  parentSessionId?: string;
}

export interface SearchSpansParams {
  query: string;
  clientId: string;
  sourceTypes?: Span['sourceType'][];
  sourceIds?: string[];
  limit?: number;
  minRelevance?: number;
}
