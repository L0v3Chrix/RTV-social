# Build Prompt: S1-B1 — RLMEnv Interface Definition

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-B1 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | B — External Memory Layer |
| **Complexity** | High |
| **Estimated Effort** | 4-5 hours |
| **Dependencies** | S0-D1 |
| **Blocks** | S1-B2, S1-B3, S1-B4, S1-B5 |

---

## Context

### What We're Building

The RLMEnv (Recursive Language Model Environment) interface is the foundational abstraction for external memory in the platform. This implements the RLM pattern where the LLM queries an external environment rather than holding entire context in the prompt. The environment provides span-indexed content, manages retrieval budgets, and tracks access patterns.

### Why This Matters

- **Unbounded Context**: LLM operates over references, not full content
- **Budget Enforcement**: Token/time limits prevent runaway inference
- **Auditability**: Every memory access is logged for debugging
- **Composability**: Agents can share memory through the environment

### Spec References

- `/docs/01-architecture/rlm-integration-spec.md` — Full RLM specification
- `/docs/02-schemas/external-memory-schema.md` — Memory data structures
- `/docs/03-agents-tools/agent-recursion-contracts.md` — Agent contracts

**Critical Pattern (from rlm-integration-spec.md):**
> RLM treats inference as interaction with an external environment. The LLM doesn't hold state — the environment does. Each step: (1) LLM emits action, (2) Environment executes, (3) Environment returns observation, (4) Loop until terminal.

---

## Prerequisites

### Completed Tasks

- [x] S0-D1: OpenTelemetry instrumentation (for tracing memory access)

### Required Packages

```bash
pnpm add nanoid zod
pnpm add -D vitest @types/node
```

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/memory/src/__tests__/rlm-env.test.ts`**

```typescript
import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  createRlmEnv,
  type RlmEnv,
  type RlmSession,
  type RetrievalBudget,
  type Span,
  type SpanRef,
} from '../rlm-env';

describe('RlmEnv', () => {
  let env: RlmEnv;

  beforeEach(() => {
    env = createRlmEnv({
      clientId: 'client-123',
      defaultBudget: {
        maxTokens: 10000,
        maxTimeMs: 30000,
        maxRetries: 3,
      },
    });
  });

  describe('Session Management', () => {
    test('startSession creates new session with budget', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      expect(session.id).toBeDefined();
      expect(session.budget.remainingTokens).toBe(10000);
      expect(session.status).toBe('active');
    });

    test('session tracks token consumption', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      // Simulate retrieval
      await session.retrieve({
        query: 'test query',
        maxTokens: 500,
      });

      expect(session.budget.remainingTokens).toBeLessThan(10000);
      expect(session.budget.tokensUsed).toBeGreaterThan(0);
    });

    test('session fails when budget exhausted', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
        budget: { maxTokens: 100, maxTimeMs: 30000, maxRetries: 3 },
      });

      // Try to retrieve more than budget allows
      await expect(
        session.retrieve({ query: 'test', maxTokens: 500 })
      ).rejects.toThrow('Budget exhausted');
    });

    test('endSession marks session complete', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      const result = await session.end('success');

      expect(result.status).toBe('completed');
      expect(result.outcome).toBe('success');
      expect(result.totalTokensUsed).toBeDefined();
    });
  });

  describe('Span Operations', () => {
    test('registerSpan stores span metadata', async () => {
      const span: Span = {
        id: 'span-1',
        sourceType: 'knowledge_base',
        sourceId: 'kb-123',
        startByte: 0,
        endByte: 1000,
        hash: 'abc123',
        tokenCount: 250,
      };

      await env.registerSpan(span);

      const retrieved = await env.getSpan('span-1');
      expect(retrieved).toEqual(span);
    });

    test('getSpanContent retrieves content by span', async () => {
      const span: Span = {
        id: 'span-1',
        sourceType: 'knowledge_base',
        sourceId: 'kb-123',
        startByte: 0,
        endByte: 100,
        hash: 'abc123',
        tokenCount: 25,
      };

      // Register span with content
      await env.registerSpan(span, 'This is the span content for testing.');

      const content = await env.getSpanContent('span-1');
      expect(content).toBe('This is the span content for testing.');
    });
  });

  describe('Retrieval', () => {
    test('retrieve returns spans matching query', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      // Register some test spans
      await env.registerSpan(
        {
          id: 'span-1',
          sourceType: 'knowledge_base',
          sourceId: 'kb-123',
          startByte: 0,
          endByte: 100,
          hash: 'abc123',
          tokenCount: 25,
        },
        'Information about product pricing and features.'
      );

      const results = await session.retrieve({
        query: 'pricing',
        maxTokens: 500,
      });

      expect(results.spans.length).toBeGreaterThan(0);
      expect(results.tokensUsed).toBeLessThanOrEqual(500);
    });

    test('retrieve respects maxTokens limit', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      const results = await session.retrieve({
        query: 'test',
        maxTokens: 100,
      });

      expect(results.tokensUsed).toBeLessThanOrEqual(100);
    });

    test('peek retrieves without consuming budget', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      const initialBudget = session.budget.remainingTokens;

      await session.peek({ spanId: 'span-1' });

      // Peek should not consume budget
      expect(session.budget.remainingTokens).toBe(initialBudget);
    });
  });

  describe('Access Logging', () => {
    test('all operations are logged', async () => {
      const accessLog: any[] = [];
      const loggedEnv = createRlmEnv({
        clientId: 'client-123',
        onAccess: (entry) => accessLog.push(entry),
      });

      const session = await loggedEnv.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      await session.retrieve({ query: 'test', maxTokens: 100 });

      expect(accessLog.length).toBeGreaterThan(0);
      expect(accessLog[0].operation).toBeDefined();
      expect(accessLog[0].sessionId).toBe(session.id);
    });
  });

  describe('Subcall', () => {
    test('subcall creates child session with reduced budget', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
        budget: { maxTokens: 10000, maxTimeMs: 30000, maxRetries: 3 },
      });

      const childSession = await session.subcall({
        agentType: 'qa-agent',
        budgetFraction: 0.2, // 20% of parent budget
      });

      expect(childSession.budget.remainingTokens).toBe(2000);
      expect(childSession.parentSessionId).toBe(session.id);
    });

    test('subcall budget cannot exceed parent remaining', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
        budget: { maxTokens: 1000, maxTimeMs: 30000, maxRetries: 3 },
      });

      // Use some budget
      await session.retrieve({ query: 'test', maxTokens: 800 });

      const childSession = await session.subcall({
        agentType: 'qa-agent',
        budgetFraction: 0.5,
      });

      // Child gets 50% of REMAINING, not original
      expect(childSession.budget.remainingTokens).toBeLessThanOrEqual(100);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Types

**File: `packages/memory/src/rlm-env/types.ts`**

```typescript
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
```

#### Step 2: Implement RlmEnv

**File: `packages/memory/src/rlm-env/env.ts`**

```typescript
/**
 * RLMEnv Implementation
 *
 * The environment manages external memory, sessions, and retrieval.
 * All content is stored as spans that can be efficiently retrieved.
 */

import { nanoid } from 'nanoid';
import {
  type RlmEnv,
  type RlmEnvConfig,
  type RlmSession,
  type StartSessionParams,
  type Span,
  type SpanRef,
  type SearchSpansParams,
  type RetrievalBudget,
  type BudgetState,
  type AccessLogEntry,
  type RetrieveParams,
  type RetrievalResult,
  type PeekParams,
  type PeekResult,
  type SubcallParams,
  type WriteParams,
  type WriteResult,
  type SessionResult,
  type SessionOutcome,
  type SessionStatus,
} from './types';

const DEFAULT_BUDGET: RetrievalBudget = {
  maxTokens: 10000,
  maxTimeMs: 60000, // 1 minute
  maxRetries: 3,
};

/**
 * Create a new RLM Environment
 */
export function createRlmEnv(config: RlmEnvConfig): RlmEnv {
  const spans = new Map<string, { span: Span; content?: string }>();
  const sessions = new Map<string, RlmSessionImpl>();

  const defaultBudget = config.defaultBudget ?? DEFAULT_BUDGET;

  function logAccess(entry: Omit<AccessLogEntry, 'timestamp'>): void {
    if (config.onAccess) {
      config.onAccess({ ...entry, timestamp: new Date() });
    }
  }

  async function searchSpans(params: SearchSpansParams): Promise<SpanRef[]> {
    const results: SpanRef[] = [];
    const query = params.query.toLowerCase();

    for (const [, { span, content }] of spans) {
      // Simple text matching (production would use embeddings)
      if (content && content.toLowerCase().includes(query)) {
        // Filter by source types
        if (params.sourceTypes && !params.sourceTypes.includes(span.sourceType)) {
          continue;
        }

        // Filter by source IDs
        if (params.sourceIds && !params.sourceIds.includes(span.sourceId)) {
          continue;
        }

        results.push({
          spanId: span.id,
          sourceType: span.sourceType,
          sourceId: span.sourceId,
          tokenCount: span.tokenCount,
          relevanceScore: 0.8, // Placeholder score
        });
      }
    }

    // Sort by relevance and limit
    return results
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
      .slice(0, params.limit ?? 10);
  }

  const env: RlmEnv = {
    clientId: config.clientId,

    async startSession(params: StartSessionParams): Promise<RlmSession> {
      const startTime = Date.now();
      const sessionId = `session-${nanoid()}`;
      const budget = params.budget ?? defaultBudget;

      const session = new RlmSessionImpl({
        id: sessionId,
        clientId: config.clientId,
        agentType: params.agentType,
        episodeId: params.episodeId,
        parentSessionId: params.parentSessionId,
        budget,
        env,
        logAccess,
      });

      sessions.set(sessionId, session);

      logAccess({
        sessionId,
        operation: 'start',
        params: { agentType: params.agentType, episodeId: params.episodeId },
        durationMs: Date.now() - startTime,
      });

      return session;
    },

    async getSession(sessionId: string): Promise<RlmSession | null> {
      return sessions.get(sessionId) ?? null;
    },

    async registerSpan(span: Span, content?: string): Promise<void> {
      spans.set(span.id, { span, content });
    },

    async getSpan(spanId: string): Promise<Span | null> {
      return spans.get(spanId)?.span ?? null;
    },

    async getSpanContent(spanId: string): Promise<string | null> {
      return spans.get(spanId)?.content ?? null;
    },

    async registerSpans(items: Array<{ span: Span; content?: string }>): Promise<void> {
      for (const item of items) {
        spans.set(item.span.id, item);
      }
    },

    searchSpans,
  };

  return env;
}

/**
 * RlmSession Implementation
 */
class RlmSessionImpl implements RlmSession {
  readonly id: string;
  readonly clientId: string;
  readonly agentType: string;
  readonly episodeId: string;
  readonly parentSessionId?: string;
  readonly startedAt: Date;

  private _status: SessionStatus = 'active';
  private _budgetState: BudgetState;
  private _retrievalCount = 0;
  private _writeCount = 0;
  private readonly _env: RlmEnv;
  private readonly _logAccess: (entry: Omit<AccessLogEntry, 'timestamp'>) => void;
  private readonly _initialBudget: RetrievalBudget;

  constructor(params: {
    id: string;
    clientId: string;
    agentType: string;
    episodeId: string;
    parentSessionId?: string;
    budget: RetrievalBudget;
    env: RlmEnv;
    logAccess: (entry: Omit<AccessLogEntry, 'timestamp'>) => void;
  }) {
    this.id = params.id;
    this.clientId = params.clientId;
    this.agentType = params.agentType;
    this.episodeId = params.episodeId;
    this.parentSessionId = params.parentSessionId;
    this.startedAt = new Date();
    this._env = params.env;
    this._logAccess = params.logAccess;
    this._initialBudget = params.budget;

    this._budgetState = {
      remainingTokens: params.budget.maxTokens,
      tokensUsed: 0,
      remainingTimeMs: params.budget.maxTimeMs,
      elapsedTimeMs: 0,
      remainingRetries: params.budget.maxRetries,
      retriesUsed: 0,
    };
  }

  get status(): SessionStatus {
    return this._status;
  }

  get budget(): BudgetState {
    // Update elapsed time
    const elapsed = Date.now() - this.startedAt.getTime();
    return {
      ...this._budgetState,
      elapsedTimeMs: elapsed,
      remainingTimeMs: Math.max(0, this._initialBudget.maxTimeMs - elapsed),
    };
  }

  async retrieve(params: RetrieveParams): Promise<RetrievalResult> {
    const startTime = Date.now();

    this.checkBudget(params.maxTokens);

    try {
      // Search for matching spans
      const spanRefs = await this._env.searchSpans({
        query: params.query,
        clientId: this.clientId,
        sourceTypes: params.sourceTypes,
        sourceIds: params.sourceIds,
        limit: 20,
        minRelevance: params.minRelevance,
      });

      // Fetch content for spans within budget
      const results: Array<SpanRef & { content: string }> = [];
      let tokensUsed = 0;

      for (const ref of spanRefs) {
        if (tokensUsed + ref.tokenCount > params.maxTokens) {
          break;
        }

        const content = await this._env.getSpanContent(ref.spanId);
        if (content) {
          results.push({ ...ref, content });
          tokensUsed += ref.tokenCount;
        }
      }

      // Consume budget
      this._budgetState.tokensUsed += tokensUsed;
      this._budgetState.remainingTokens -= tokensUsed;
      this._retrievalCount++;

      this._logAccess({
        sessionId: this.id,
        operation: 'retrieve',
        params: { query: params.query, maxTokens: params.maxTokens },
        tokensConsumed: tokensUsed,
        durationMs: Date.now() - startTime,
      });

      return {
        spans: results,
        tokensUsed,
        hasMore: spanRefs.length > results.length,
      };
    } catch (error) {
      this._logAccess({
        sessionId: this.id,
        operation: 'retrieve',
        params: { query: params.query },
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async peek(params: PeekParams): Promise<PeekResult> {
    const startTime = Date.now();

    try {
      const span = await this._env.getSpan(params.spanId);
      if (!span) {
        throw new Error(`Span not found: ${params.spanId}`);
      }

      let content: string | undefined;
      if (params.includeContent) {
        content = (await this._env.getSpanContent(params.spanId)) ?? undefined;
      }

      this._logAccess({
        sessionId: this.id,
        operation: 'peek',
        params: { spanId: params.spanId },
        durationMs: Date.now() - startTime,
      });

      return { span, content };
    } catch (error) {
      this._logAccess({
        sessionId: this.id,
        operation: 'peek',
        params: { spanId: params.spanId },
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async subcall(params: SubcallParams): Promise<RlmSession> {
    const startTime = Date.now();

    // Calculate child budget as fraction of remaining
    const childTokens = Math.floor(
      params.fixedBudget?.maxTokens ??
        this._budgetState.remainingTokens * params.budgetFraction
    );
    const childTimeMs = Math.floor(
      params.fixedBudget?.maxTimeMs ??
        this.budget.remainingTimeMs * params.budgetFraction
    );
    const childRetries =
      params.fixedBudget?.maxRetries ??
      Math.floor(this._budgetState.remainingRetries * params.budgetFraction);

    const childSession = await this._env.startSession({
      agentType: params.agentType,
      episodeId: this.episodeId,
      parentSessionId: this.id,
      budget: {
        maxTokens: childTokens,
        maxTimeMs: childTimeMs,
        maxRetries: childRetries,
      },
    });

    this._logAccess({
      sessionId: this.id,
      operation: 'subcall',
      params: {
        childAgentType: params.agentType,
        budgetFraction: params.budgetFraction,
        childSessionId: childSession.id,
      },
      durationMs: Date.now() - startTime,
    });

    return childSession;
  }

  async write(params: WriteParams): Promise<WriteResult> {
    const startTime = Date.now();

    // Create spans from content
    const contentSpans = createSpansFromContent(
      params.content,
      params.type,
      this.clientId
    );

    // Register spans
    await this._env.registerSpans(contentSpans);

    this._writeCount++;

    const result: WriteResult = {
      id: `write-${nanoid()}`,
      spans: contentSpans.map((s) => s.span),
    };

    this._logAccess({
      sessionId: this.id,
      operation: 'write',
      params: { type: params.type, contentLength: params.content.length },
      durationMs: Date.now() - startTime,
    });

    return result;
  }

  async end(outcome: SessionOutcome): Promise<SessionResult> {
    const startTime = Date.now();

    this._status = outcome === 'success' ? 'completed' : 'failed';

    const result: SessionResult = {
      status: this._status === 'completed' ? 'completed' : 'failed',
      outcome,
      totalTokensUsed: this._budgetState.tokensUsed,
      totalTimeMs: Date.now() - this.startedAt.getTime(),
      retrievalCount: this._retrievalCount,
      writeCount: this._writeCount,
    };

    this._logAccess({
      sessionId: this.id,
      operation: 'end',
      params: { outcome },
      durationMs: Date.now() - startTime,
    });

    return result;
  }

  private checkBudget(tokensRequested: number): void {
    if (this._budgetState.remainingTokens < tokensRequested) {
      throw new Error(
        `Budget exhausted: requested ${tokensRequested}, remaining ${this._budgetState.remainingTokens}`
      );
    }

    if (this.budget.remainingTimeMs <= 0) {
      this._status = 'timeout';
      throw new Error('Session timeout: time budget exhausted');
    }
  }
}

/**
 * Helper to create spans from content
 */
function createSpansFromContent(
  content: string,
  type: string,
  clientId: string
): Array<{ span: Span; content: string }> {
  const CHUNK_SIZE = 1000;
  const OVERLAP = 100;
  const spans: Array<{ span: Span; content: string }> = [];

  let startByte = 0;
  while (startByte < content.length) {
    const endByte = Math.min(startByte + CHUNK_SIZE, content.length);
    const chunkContent = content.slice(startByte, endByte);

    spans.push({
      span: {
        id: `span-${nanoid()}`,
        sourceType: type === 'summary' ? 'thread_summary' : 'episode_log',
        sourceId: `${type}-${nanoid()}`,
        startByte,
        endByte,
        hash: simpleHash(chunkContent),
        tokenCount: Math.ceil(chunkContent.length / 4), // Rough estimate
      },
      content: chunkContent,
    });

    startByte = endByte - OVERLAP;
    if (startByte >= content.length - OVERLAP) break;
  }

  return spans;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
```

#### Step 3: Create Package Index

**File: `packages/memory/src/rlm-env/index.ts`**

```typescript
/**
 * RLMEnv - Recursive Language Model Environment
 *
 * External memory management for LLM agents.
 */

export { createRlmEnv } from './env';

export type {
  // Environment
  RlmEnv,
  RlmEnvConfig,

  // Session
  RlmSession,
  SessionStatus,
  SessionOutcome,
  SessionResult,
  StartSessionParams,

  // Spans
  Span,
  SpanRef,

  // Budget
  RetrievalBudget,
  BudgetState,

  // Operations
  RetrieveParams,
  RetrievalResult,
  PeekParams,
  PeekResult,
  SubcallParams,
  WriteParams,
  WriteResult,

  // Logging
  AccessLogEntry,
  SearchSpansParams,
} from './types';

export { SpanSchema, SpanRefSchema, RetrievalBudgetSchema, BudgetStateSchema } from './types';
```

#### Step 4: Create Main Package Index

**File: `packages/memory/src/index.ts`**

```typescript
/**
 * @rtv/memory - External Memory Layer
 *
 * Provides RLM (Recursive Language Model) environment for agents.
 * Manages span-indexed content, retrieval budgets, and access logging.
 */

export * from './rlm-env';
```

#### Step 5: Package Configuration

**File: `packages/memory/package.json`**

```json
{
  "name": "@rtv/memory",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "nanoid": "^5.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@rtv/tsconfig": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

### Phase 3: Verification

```bash
cd packages/memory

# Install dependencies
pnpm install

# Build
pnpm build

# Typecheck
pnpm typecheck

# Run tests
pnpm test

# Verify exports
cat > verify-exports.ts << 'EOF'
import {
  createRlmEnv,
  type RlmEnv,
  type RlmSession,
  type Span,
  type RetrievalBudget,
} from './src/index';

const env = createRlmEnv({
  clientId: 'test-client',
  defaultBudget: {
    maxTokens: 5000,
    maxTimeMs: 30000,
    maxRetries: 3,
  },
});

console.log('RlmEnv created for client:', env.clientId);
console.log('Exports verified successfully');
EOF

npx tsx verify-exports.ts
rm verify-exports.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/memory/package.json` | Package configuration |
| Create | `packages/memory/src/index.ts` | Main exports |
| Create | `packages/memory/src/rlm-env/types.ts` | Type definitions |
| Create | `packages/memory/src/rlm-env/env.ts` | RlmEnv implementation |
| Create | `packages/memory/src/rlm-env/index.ts` | Module exports |
| Create | `packages/memory/src/__tests__/rlm-env.test.ts` | Unit tests |

---

## Acceptance Criteria

- [ ] `createRlmEnv()` creates environment with client isolation
- [ ] `startSession()` creates session with budget tracking
- [ ] `session.retrieve()` returns spans and consumes budget
- [ ] `session.peek()` returns span without consuming budget
- [ ] `session.subcall()` creates child session with reduced budget
- [ ] `session.write()` creates spans from content
- [ ] `session.end()` returns usage statistics
- [ ] Budget exhaustion throws appropriate error
- [ ] All operations are logged via onAccess callback
- [ ] Tests pass with >80% coverage

---

## Test Requirements

### Unit Tests

- Session lifecycle (start, operations, end)
- Budget enforcement and exhaustion
- Span registration and retrieval
- Subcall budget inheritance
- Access logging completeness

### Integration Tests

- Multi-session isolation
- Concurrent session handling
- Large content spanning

---

## Security & Safety Checklist

- [ ] Client ID scopes all operations (tenant isolation)
- [ ] No content logged directly (only span refs)
- [ ] Budget limits prevent resource exhaustion
- [ ] Session IDs are unpredictable (nanoid)
- [ ] Hash verification available for content integrity

---

## JSON Task Block

```json
{
  "task_id": "S1-B1",
  "name": "RLMEnv Interface Definition",
  "sprint": 1,
  "agent": "B",
  "status": "pending",
  "complexity": "high",
  "estimated_hours": 5,
  "dependencies": ["S0-D1"],
  "blocks": ["S1-B2", "S1-B3", "S1-B4", "S1-B5"],
  "tags": ["rlm", "memory", "infrastructure"],
  "acceptance_criteria": [
    "environment created with client isolation",
    "sessions track budget consumption",
    "retrieval consumes budget",
    "peek does not consume budget",
    "subcall inherits fraction of budget",
    "all operations logged"
  ],
  "created_at": "2025-01-16T00:00:00Z",
  "updated_at": null,
  "completed_at": null
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "agent_id": null,
  "decisions": [],
  "artifacts": [],
  "notes": []
}
```

---

## Next Steps

After completing this task:

1. **S1-B2**: Implement summary storage system (ThreadSummary, PlanSummary)
2. **S1-B3**: Build reference system for span pointers
3. **S1-B4**: Add context window management with token counting
