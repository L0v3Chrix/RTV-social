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
} from './types.js';

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

      const sessionParams: {
        id: string;
        clientId: string;
        agentType: string;
        episodeId: string;
        parentSessionId?: string;
        budget: RetrievalBudget;
        env: RlmEnv;
        logAccess: (entry: Omit<AccessLogEntry, 'timestamp'>) => void;
      } = {
        id: sessionId,
        clientId: config.clientId,
        agentType: params.agentType,
        episodeId: params.episodeId,
        budget,
        env,
        logAccess,
      };
      if (params.parentSessionId) {
        sessionParams.parentSessionId = params.parentSessionId;
      }
      const session = new RlmSessionImpl(sessionParams);

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
      const entry: { span: Span; content?: string } = { span };
      if (content !== undefined) {
        entry.content = content;
      }
      spans.set(span.id, entry);
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
    if (params.parentSessionId) {
      this.parentSessionId = params.parentSessionId;
    }
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
      const searchParams: SearchSpansParams = {
        query: params.query,
        clientId: this.clientId,
        limit: 20,
      };
      if (params.sourceTypes) {
        searchParams.sourceTypes = params.sourceTypes;
      }
      if (params.sourceIds) {
        searchParams.sourceIds = params.sourceIds;
      }
      if (params.minRelevance !== undefined) {
        searchParams.minRelevance = params.minRelevance;
      }
      const spanRefs = await this._env.searchSpans(searchParams);

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

      this._logAccess({
        sessionId: this.id,
        operation: 'peek',
        params: { spanId: params.spanId },
        durationMs: Date.now() - startTime,
      });

      const result: PeekResult = { span };
      if (params.includeContent) {
        const content = await this._env.getSpanContent(params.spanId);
        if (content !== null) {
          result.content = content;
        }
      }

      return result;
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
  _clientId: string
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
