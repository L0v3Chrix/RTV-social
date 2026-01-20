# Build Prompt: S1-B5 — Memory Retrieval API

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-B5 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | B — External Memory Layer |
| **Complexity** | Medium |
| **Estimated Effort** | 3-4 hours |
| **Dependencies** | S1-B1, S1-B2, S1-B3, S1-B4 |
| **Blocks** | Sprint 2 |

---

## Context

### What We're Building

The Memory Retrieval API is the unified interface for agents to query external memory. It combines all previous components (RlmEnv, summaries, references, context window) into a cohesive API that agents use to navigate and retrieve relevant content. This is the "query layer" that sits atop the storage layer.

### Why This Matters

- **Unified Interface**: Single API for all memory operations
- **Relevance Ranking**: Best content surfaced first
- **Budget-Aware**: Retrieval respects token budgets
- **Multi-Source**: Query across summaries, references, and raw content

### Spec References

- `/docs/01-architecture/rlm-integration-spec.md` — Retrieval patterns
- `/docs/02-schemas/external-memory-schema.md` — Query schemas
- `/docs/03-agents-tools/agent-recursion-contracts.md` — Retrieval contracts

**Critical Pattern (from rlm-integration-spec.md):**
> The retrieval API implements "search → peek → chunk" pattern: First search to find relevant references, peek to inspect metadata, then chunk to retrieve actual content within budget.

---

## Prerequisites

### Completed Tasks

- [x] S1-B1: RLMEnv interface definition
- [x] S1-B2: Summary storage system
- [x] S1-B3: Reference system
- [x] S1-B4: Context window management

### Required Packages

```bash
# All dependencies from previous B tasks
pnpm add nanoid zod
pnpm add -D vitest @types/node
```

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/memory/src/__tests__/retrieval.test.ts`**

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import {
  createMemoryRetriever,
  type MemoryRetriever,
  type SearchQuery,
  type SearchResult,
  type RetrievalContext,
} from '../retrieval';
import { createRlmEnv } from '../rlm-env';
import { createSummaryStore } from '../summaries';
import { createReferenceRegistry } from '../references';
import { createContextWindow, createTokenCounter } from '../context-window';

describe('Memory Retrieval API', () => {
  let retriever: MemoryRetriever;

  beforeEach(async () => {
    // Set up dependencies
    const env = createRlmEnv({ clientId: 'client-123' });
    const summaryStore = createSummaryStore();
    const referenceRegistry = createReferenceRegistry();
    const tokenCounter = createTokenCounter('gpt-4');

    // Seed some test data
    await summaryStore.createThreadSummary({
      clientId: 'client-123',
      threadId: 'thread-1',
      platform: 'instagram',
      participantCount: 2,
      messageCount: 10,
      keyPoints: ['User asked about pricing', 'Interested in premium plan'],
      sentiment: 'positive',
      lastActivityAt: new Date(),
    });

    await summaryStore.createPlanSummary({
      clientId: 'client-123',
      planId: 'plan-1',
      planType: 'content_calendar',
      totalNodes: 10,
      completedNodes: 5,
      pendingNodes: 5,
      failedNodes: 0,
      keyMilestones: ['Week 1 complete'],
      currentPhase: 'execution',
    });

    await referenceRegistry.createReference({
      clientId: 'client-123',
      type: 'knowledge_base',
      targetId: 'kb-1',
      label: 'Product FAQ',
      description: 'Frequently asked questions about pricing and features',
      importance: 0.9,
    });

    retriever = createMemoryRetriever({
      clientId: 'client-123',
      env,
      summaryStore,
      referenceRegistry,
      tokenCounter,
    });
  });

  describe('Search', () => {
    test('searches across all memory types', async () => {
      const results = await retriever.search({
        query: 'pricing',
        maxResults: 10,
      });

      expect(results.items.length).toBeGreaterThan(0);
      expect(results.totalCount).toBeGreaterThanOrEqual(results.items.length);
    });

    test('filters by source type', async () => {
      const results = await retriever.search({
        query: 'pricing',
        sourceTypes: ['thread_summary'],
        maxResults: 10,
      });

      expect(results.items.every((r) => r.sourceType === 'thread_summary')).toBe(true);
    });

    test('respects token budget', async () => {
      const results = await retriever.search({
        query: 'pricing',
        maxTokens: 100,
        maxResults: 10,
      });

      expect(results.tokensUsed).toBeLessThanOrEqual(100);
    });

    test('returns relevance scores', async () => {
      const results = await retriever.search({
        query: 'pricing',
        maxResults: 10,
      });

      expect(results.items[0].relevance).toBeDefined();
      expect(results.items[0].relevance).toBeGreaterThan(0);
    });
  });

  describe('Peek', () => {
    test('returns metadata without content', async () => {
      const searchResults = await retriever.search({
        query: 'pricing',
        maxResults: 1,
      });

      const peek = await retriever.peek(searchResults.items[0].id);

      expect(peek).toBeDefined();
      expect(peek.id).toBe(searchResults.items[0].id);
      expect(peek.metadata).toBeDefined();
    });

    test('does not consume retrieval budget', async () => {
      const ctx = await retriever.createContext({ maxTokens: 1000 });
      const initialBudget = ctx.remainingTokens;

      const searchResults = await retriever.search({
        query: 'pricing',
        maxResults: 1,
      });

      await retriever.peek(searchResults.items[0].id);

      expect(ctx.remainingTokens).toBe(initialBudget);
    });
  });

  describe('Chunk', () => {
    test('retrieves content within token limit', async () => {
      const searchResults = await retriever.search({
        query: 'pricing',
        maxResults: 1,
      });

      const chunk = await retriever.chunk(searchResults.items[0].id, {
        maxTokens: 200,
      });

      expect(chunk.content).toBeDefined();
      expect(chunk.tokenCount).toBeLessThanOrEqual(200);
    });

    test('truncates content if exceeds limit', async () => {
      const searchResults = await retriever.search({
        query: 'pricing',
        maxResults: 1,
      });

      const fullChunk = await retriever.chunk(searchResults.items[0].id, {
        maxTokens: 1000,
      });

      const limitedChunk = await retriever.chunk(searchResults.items[0].id, {
        maxTokens: 50,
      });

      expect(limitedChunk.tokenCount).toBeLessThanOrEqual(50);
      expect(limitedChunk.truncated).toBe(fullChunk.tokenCount > 50);
    });
  });

  describe('Context Building', () => {
    test('createContext initializes retrieval context', async () => {
      const ctx = await retriever.createContext({
        maxTokens: 5000,
        systemPrompt: 'You are a helpful assistant.',
      });

      expect(ctx.remainingTokens).toBeLessThan(5000);
      expect(ctx.sections.length).toBeGreaterThan(0);
    });

    test('addToContext respects budget', async () => {
      const ctx = await retriever.createContext({ maxTokens: 500 });

      const searchResults = await retriever.search({
        query: 'pricing',
        maxResults: 5,
      });

      for (const result of searchResults.items) {
        await retriever.addToContext(ctx, result.id);
      }

      expect(ctx.remainingTokens).toBeGreaterThanOrEqual(0);
    });

    test('composeContext returns formatted string', async () => {
      const ctx = await retriever.createContext({
        maxTokens: 2000,
        systemPrompt: 'You are a helpful assistant.',
      });

      const searchResults = await retriever.search({
        query: 'pricing',
        maxResults: 3,
      });

      for (const result of searchResults.items) {
        await retriever.addToContext(ctx, result.id);
      }

      const composed = retriever.composeContext(ctx);

      expect(composed).toContain('You are a helpful assistant');
      expect(typeof composed).toBe('string');
    });
  });

  describe('Recency and Relevance', () => {
    test('sorts by recency when specified', async () => {
      const results = await retriever.search({
        query: '*',
        sortBy: 'recency',
        maxResults: 10,
      });

      // Results should be sorted by date (most recent first)
      for (let i = 1; i < results.items.length; i++) {
        const prev = results.items[i - 1].metadata?.lastActivityAt;
        const curr = results.items[i].metadata?.lastActivityAt;
        if (prev && curr) {
          expect(new Date(prev as string).getTime()).toBeGreaterThanOrEqual(
            new Date(curr as string).getTime()
          );
        }
      }
    });

    test('combines relevance and importance', async () => {
      const results = await retriever.search({
        query: 'pricing',
        sortBy: 'combined',
        maxResults: 10,
      });

      // High importance items should rank higher for equal relevance
      expect(results.items[0].combinedScore).toBeDefined();
    });
  });

  describe('Multi-hop Retrieval', () => {
    test('follows references to related content', async () => {
      const results = await retriever.searchWithHops({
        query: 'pricing',
        maxHops: 2,
        maxResults: 10,
      });

      expect(results.items.length).toBeGreaterThan(0);
      // Some results should come from following links
      expect(results.hopsUsed).toBeGreaterThanOrEqual(0);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Types

**File: `packages/memory/src/retrieval/types.ts`**

```typescript
/**
 * Memory Retrieval API Types
 *
 * Unified interface for querying external memory.
 */

import { z } from 'zod';
import type { RlmEnv } from '../rlm-env';
import type { SummaryStore } from '../summaries';
import type { ReferenceRegistry } from '../references';
import type { TokenCounter, ContextSection } from '../context-window';

// =====================
// Source Types
// =====================

export const SourceTypeSchema = z.enum([
  'thread_summary',
  'plan_summary',
  'knowledge_base',
  'brand_kit',
  'offer',
  'span',
  'reference',
]);

export type SourceType = z.infer<typeof SourceTypeSchema>;

// =====================
// Search
// =====================

export const SearchQuerySchema = z.object({
  /** Search query string (use '*' for all) */
  query: z.string(),

  /** Filter by source types */
  sourceTypes: z.array(SourceTypeSchema).optional(),

  /** Filter by source IDs */
  sourceIds: z.array(z.string()).optional(),

  /** Maximum results to return */
  maxResults: z.number().int().positive().default(10),

  /** Maximum tokens for all results */
  maxTokens: z.number().int().positive().optional(),

  /** Minimum relevance score (0-1) */
  minRelevance: z.number().min(0).max(1).optional(),

  /** Sort order */
  sortBy: z.enum(['relevance', 'recency', 'importance', 'combined']).default('relevance'),

  /** Filter by recency */
  since: z.date().optional(),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export interface SearchResultItem {
  /** Result ID */
  id: string;

  /** Source type */
  sourceType: SourceType;

  /** Source ID */
  sourceId: string;

  /** Display label */
  label: string;

  /** Relevance score (0-1) */
  relevance: number;

  /** Importance score (0-1) */
  importance: number;

  /** Combined score */
  combinedScore: number;

  /** Estimated token count */
  tokenEstimate: number;

  /** Snippet of content */
  snippet?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  /** Search result items */
  items: SearchResultItem[];

  /** Total matching items (may be more than returned) */
  totalCount: number;

  /** Tokens used for snippets */
  tokensUsed: number;

  /** Query that was executed */
  query: SearchQuery;
}

// =====================
// Peek
// =====================

export interface PeekResult {
  /** Item ID */
  id: string;

  /** Source type */
  sourceType: SourceType;

  /** Source ID */
  sourceId: string;

  /** Full label */
  label: string;

  /** Full description */
  description?: string;

  /** All metadata */
  metadata: Record<string, unknown>;

  /** Related item IDs */
  relatedIds: string[];

  /** Token estimate for full content */
  tokenEstimate: number;

  /** Content location info */
  location?: {
    spanId?: string;
    startByte?: number;
    endByte?: number;
  };
}

// =====================
// Chunk
// =====================

export interface ChunkOptions {
  /** Maximum tokens to retrieve */
  maxTokens: number;

  /** Truncation strategy if content exceeds limit */
  truncationStrategy?: 'end' | 'sentence' | 'middle';

  /** Include metadata header */
  includeHeader?: boolean;
}

export interface ChunkResult {
  /** Item ID */
  id: string;

  /** Retrieved content */
  content: string;

  /** Actual token count */
  tokenCount: number;

  /** Whether content was truncated */
  truncated: boolean;

  /** Header if included */
  header?: string;
}

// =====================
// Context
// =====================

export interface RetrievalContext {
  /** Context ID */
  id: string;

  /** Maximum tokens for context */
  maxTokens: number;

  /** Tokens remaining */
  remainingTokens: number;

  /** Sections added to context */
  sections: ContextSection[];

  /** Items already retrieved */
  retrievedIds: Set<string>;
}

export interface CreateContextOptions {
  /** Maximum tokens for full context */
  maxTokens: number;

  /** System prompt to include */
  systemPrompt?: string;

  /** Reserved tokens for response */
  reservedForResponse?: number;
}

// =====================
// Multi-hop
// =====================

export interface SearchWithHopsOptions extends SearchQuery {
  /** Maximum hops to follow */
  maxHops: number;

  /** Link types to follow */
  linkTypes?: string[];
}

export interface SearchWithHopsResult extends SearchResult {
  /** Number of hops used */
  hopsUsed: number;

  /** Hop paths for debugging */
  hopPaths?: Array<{
    from: string;
    to: string;
    linkType: string;
  }>;
}

// =====================
// Configuration
// =====================

export interface MemoryRetrieverConfig {
  /** Client ID for tenant isolation */
  clientId: string;

  /** RLM Environment */
  env: RlmEnv;

  /** Summary store */
  summaryStore: SummaryStore;

  /** Reference registry */
  referenceRegistry: ReferenceRegistry;

  /** Token counter */
  tokenCounter: TokenCounter;

  /** Default max results */
  defaultMaxResults?: number;

  /** Default max tokens per chunk */
  defaultMaxTokensPerChunk?: number;
}

// =====================
// Main Interface
// =====================

export interface MemoryRetriever {
  /** Configuration */
  readonly config: MemoryRetrieverConfig;

  // Search
  search(query: SearchQuery): Promise<SearchResult>;
  searchWithHops(options: SearchWithHopsOptions): Promise<SearchWithHopsResult>;

  // Peek (metadata only, no budget impact)
  peek(id: string): Promise<PeekResult | null>;

  // Chunk (retrieve content, consumes budget)
  chunk(id: string, options: ChunkOptions): Promise<ChunkResult>;

  // Context building
  createContext(options: CreateContextOptions): Promise<RetrievalContext>;
  addToContext(ctx: RetrievalContext, id: string): Promise<boolean>;
  composeContext(ctx: RetrievalContext): string;
}
```

#### Step 2: Implement Memory Retriever

**File: `packages/memory/src/retrieval/retriever.ts`**

```typescript
/**
 * Memory Retriever Implementation
 *
 * Unified search and retrieval across all memory sources.
 */

import { nanoid } from 'nanoid';
import type {
  MemoryRetriever,
  MemoryRetrieverConfig,
  SearchQuery,
  SearchResult,
  SearchResultItem,
  SearchWithHopsOptions,
  SearchWithHopsResult,
  PeekResult,
  ChunkOptions,
  ChunkResult,
  RetrievalContext,
  CreateContextOptions,
  SourceType,
} from './types';
import type { ThreadSummary, PlanSummary } from '../summaries';
import type { Reference } from '../references';

/**
 * Create a Memory Retriever
 */
export function createMemoryRetriever(config: MemoryRetrieverConfig): MemoryRetriever {
  const { clientId, summaryStore, referenceRegistry, tokenCounter } = config;

  // Helper to create search result item
  function toSearchResultItem(
    item: ThreadSummary | PlanSummary | Reference,
    type: SourceType,
    relevance: number
  ): SearchResultItem {
    const importance = 'importance' in item ? (item.importance ?? 0.5) : 0.5;

    if ('threadId' in item) {
      // ThreadSummary
      const summary = item as ThreadSummary;
      return {
        id: summary.id,
        sourceType: 'thread_summary',
        sourceId: summary.threadId,
        label: `Thread: ${summary.platform} (${summary.messageCount} messages)`,
        relevance,
        importance,
        combinedScore: relevance * 0.7 + importance * 0.3,
        tokenEstimate: summary.tokenCount,
        snippet: summary.keyPoints.slice(0, 2).join('. '),
        metadata: {
          platform: summary.platform,
          sentiment: summary.sentiment,
          lastActivityAt: summary.lastActivityAt,
        },
      };
    }

    if ('planId' in item) {
      // PlanSummary
      const summary = item as PlanSummary;
      const progress = summary.totalNodes > 0
        ? Math.round((summary.completedNodes / summary.totalNodes) * 100)
        : 0;
      return {
        id: summary.id,
        sourceType: 'plan_summary',
        sourceId: summary.planId,
        label: `Plan: ${summary.planType} (${progress}% complete)`,
        relevance,
        importance,
        combinedScore: relevance * 0.7 + importance * 0.3,
        tokenEstimate: summary.tokenCount,
        snippet: summary.keyMilestones.slice(0, 2).join('. '),
        metadata: {
          planType: summary.planType,
          currentPhase: summary.currentPhase,
          completedNodes: summary.completedNodes,
          totalNodes: summary.totalNodes,
        },
      };
    }

    // Reference
    const ref = item as Reference;
    return {
      id: ref.id,
      sourceType: ref.type as SourceType,
      sourceId: ref.targetId,
      label: ref.label,
      relevance,
      importance: ref.importance ?? 0.5,
      combinedScore: relevance * 0.7 + (ref.importance ?? 0.5) * 0.3,
      tokenEstimate: ref.spanPointer?.tokenEstimate ?? 100,
      snippet: ref.description,
      metadata: ref.metadata,
    };
  }

  // Simple text matching for relevance
  function calculateRelevance(text: string, query: string): number {
    if (query === '*') return 0.5; // Neutral for wildcard
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/);

    let matches = 0;
    for (const word of words) {
      if (lowerText.includes(word)) matches++;
    }

    return words.length > 0 ? matches / words.length : 0;
  }

  const retriever: MemoryRetriever = {
    config,

    // Search
    async search(query: SearchQuery): Promise<SearchResult> {
      const results: SearchResultItem[] = [];
      let tokensUsed = 0;

      // Search thread summaries
      if (!query.sourceTypes || query.sourceTypes.includes('thread_summary')) {
        const threads = await summaryStore.listThreadSummaries({
          clientId,
          since: query.since,
          limit: query.maxResults * 2,
        });

        for (const thread of threads) {
          const searchText = [
            thread.platform,
            ...thread.keyPoints,
            thread.sentiment,
          ].join(' ');
          const relevance = calculateRelevance(searchText, query.query);

          if (relevance >= (query.minRelevance ?? 0)) {
            results.push(toSearchResultItem(thread, 'thread_summary', relevance));
          }
        }
      }

      // Search plan summaries
      if (!query.sourceTypes || query.sourceTypes.includes('plan_summary')) {
        const plans = await summaryStore.listPlanSummaries({
          clientId,
          since: query.since,
          limit: query.maxResults * 2,
        });

        for (const plan of plans) {
          const searchText = [
            plan.planType,
            plan.currentPhase,
            ...plan.keyMilestones,
          ].join(' ');
          const relevance = calculateRelevance(searchText, query.query);

          if (relevance >= (query.minRelevance ?? 0)) {
            results.push(toSearchResultItem(plan, 'plan_summary', relevance));
          }
        }
      }

      // Search references
      const refTypes = query.sourceTypes?.filter(
        (t) => !['thread_summary', 'plan_summary'].includes(t)
      );
      if (!query.sourceTypes || refTypes?.length) {
        const refs = await referenceRegistry.listReferences({
          clientId,
          type: refTypes?.[0] as any,
          limit: query.maxResults * 2,
        });

        for (const ref of refs) {
          const searchText = [ref.label, ref.description ?? ''].join(' ');
          const relevance = calculateRelevance(searchText, query.query);

          if (relevance >= (query.minRelevance ?? 0)) {
            results.push(toSearchResultItem(ref, ref.type as SourceType, relevance));
          }
        }
      }

      // Sort results
      switch (query.sortBy) {
        case 'relevance':
          results.sort((a, b) => b.relevance - a.relevance);
          break;
        case 'recency':
          results.sort((a, b) => {
            const aTime = a.metadata?.lastActivityAt
              ? new Date(a.metadata.lastActivityAt as string).getTime()
              : 0;
            const bTime = b.metadata?.lastActivityAt
              ? new Date(b.metadata.lastActivityAt as string).getTime()
              : 0;
            return bTime - aTime;
          });
          break;
        case 'importance':
          results.sort((a, b) => b.importance - a.importance);
          break;
        case 'combined':
        default:
          results.sort((a, b) => b.combinedScore - a.combinedScore);
      }

      // Apply token limit
      let limitedResults = results;
      if (query.maxTokens) {
        limitedResults = [];
        for (const item of results) {
          if (tokensUsed + item.tokenEstimate > query.maxTokens) break;
          limitedResults.push(item);
          tokensUsed += item.tokenEstimate;
        }
      } else {
        limitedResults = results.slice(0, query.maxResults);
        tokensUsed = limitedResults.reduce((sum, r) => sum + r.tokenEstimate, 0);
      }

      return {
        items: limitedResults.slice(0, query.maxResults),
        totalCount: results.length,
        tokensUsed,
        query,
      };
    },

    async searchWithHops(options: SearchWithHopsOptions): Promise<SearchWithHopsResult> {
      // First search
      const initialResults = await retriever.search(options);

      if (options.maxHops === 0) {
        return { ...initialResults, hopsUsed: 0 };
      }

      // Follow references
      const seenIds = new Set(initialResults.items.map((r) => r.id));
      const hopPaths: Array<{ from: string; to: string; linkType: string }> = [];
      let hopsUsed = 0;

      for (let hop = 0; hop < options.maxHops; hop++) {
        const newItems: SearchResultItem[] = [];

        for (const item of initialResults.items) {
          const linked = await referenceRegistry.getLinkedReferences(item.id);

          for (const ref of linked) {
            if (!seenIds.has(ref.id)) {
              seenIds.add(ref.id);
              newItems.push(toSearchResultItem(ref, ref.type as SourceType, 0.5));
              hopPaths.push({
                from: item.id,
                to: ref.id,
                linkType: 'related_to',
              });
            }
          }
        }

        if (newItems.length > 0) {
          initialResults.items.push(...newItems);
          hopsUsed = hop + 1;
        } else {
          break;
        }
      }

      // Re-sort and limit
      initialResults.items.sort((a, b) => b.combinedScore - a.combinedScore);
      initialResults.items = initialResults.items.slice(0, options.maxResults);

      return {
        ...initialResults,
        totalCount: seenIds.size,
        hopsUsed,
        hopPaths,
      };
    },

    // Peek
    async peek(id: string): Promise<PeekResult | null> {
      // Try thread summary
      const thread = await summaryStore.getThreadSummary(id);
      if (thread) {
        return {
          id: thread.id,
          sourceType: 'thread_summary',
          sourceId: thread.threadId,
          label: `Thread: ${thread.platform}`,
          description: thread.keyPoints.join('. '),
          metadata: {
            platform: thread.platform,
            sentiment: thread.sentiment,
            participantCount: thread.participantCount,
            messageCount: thread.messageCount,
            lastActivityAt: thread.lastActivityAt,
          },
          relatedIds: thread.contentSpanIds ?? [],
          tokenEstimate: thread.tokenCount,
        };
      }

      // Try plan summary
      const plan = await summaryStore.getPlanSummary(id);
      if (plan) {
        return {
          id: plan.id,
          sourceType: 'plan_summary',
          sourceId: plan.planId,
          label: `Plan: ${plan.planType}`,
          description: plan.keyMilestones.join('. '),
          metadata: {
            planType: plan.planType,
            currentPhase: plan.currentPhase,
            completedNodes: plan.completedNodes,
            totalNodes: plan.totalNodes,
          },
          relatedIds: plan.contentSpanIds ?? [],
          tokenEstimate: plan.tokenCount,
        };
      }

      // Try reference
      const ref = await referenceRegistry.getReference(id);
      if (ref) {
        const linked = await referenceRegistry.getLinkedReferences(id);
        return {
          id: ref.id,
          sourceType: ref.type as SourceType,
          sourceId: ref.targetId,
          label: ref.label,
          description: ref.description,
          metadata: ref.metadata ?? {},
          relatedIds: linked.map((l) => l.id),
          tokenEstimate: ref.spanPointer?.tokenEstimate ?? 100,
          location: ref.spanPointer
            ? {
                spanId: ref.spanPointer.spanId,
                startByte: ref.spanPointer.startByte,
                endByte: ref.spanPointer.endByte,
              }
            : undefined,
        };
      }

      return null;
    },

    // Chunk
    async chunk(id: string, options: ChunkOptions): Promise<ChunkResult> {
      const peek = await retriever.peek(id);
      if (!peek) {
        throw new Error(`Item not found: ${id}`);
      }

      // Get content based on source type
      let content = '';

      if (peek.sourceType === 'thread_summary') {
        const thread = await summaryStore.getThreadSummary(id);
        if (thread) {
          content = summaryStore.toPromptText(thread);
        }
      } else if (peek.sourceType === 'plan_summary') {
        const plan = await summaryStore.getPlanSummary(id);
        if (plan) {
          content = summaryStore.toPromptText(plan);
        }
      } else {
        // Reference - use description as content
        content = peek.description ?? peek.label;
      }

      // Add header if requested
      let header = '';
      if (options.includeHeader) {
        header = `[${peek.sourceType}: ${peek.label}]\n`;
      }

      // Calculate tokens
      const headerTokens = header ? tokenCounter.count(header) : 0;
      const availableTokens = options.maxTokens - headerTokens;
      const contentTokens = tokenCounter.count(content);

      let finalContent = content;
      let truncated = false;

      if (contentTokens > availableTokens) {
        // Truncate content
        truncated = true;
        const ratio = availableTokens / contentTokens;
        const cutIndex = Math.floor(content.length * ratio);

        switch (options.truncationStrategy) {
          case 'sentence':
            const sentences = content.slice(0, cutIndex).match(/[^.!?]+[.!?]+/g);
            finalContent = sentences ? sentences.join('') + '...' : content.slice(0, cutIndex) + '...';
            break;
          case 'middle':
            const startLen = Math.floor(cutIndex * 0.6);
            const endLen = cutIndex - startLen;
            finalContent =
              content.slice(0, startLen) +
              ' [...] ' +
              content.slice(-endLen);
            break;
          case 'end':
          default:
            finalContent = content.slice(0, cutIndex) + '...';
        }
      }

      const fullContent = header + finalContent;

      return {
        id,
        content: fullContent,
        tokenCount: tokenCounter.count(fullContent),
        truncated,
        header: header || undefined,
      };
    },

    // Context building
    async createContext(options: CreateContextOptions): Promise<RetrievalContext> {
      const ctx: RetrievalContext = {
        id: `ctx-${nanoid()}`,
        maxTokens: options.maxTokens,
        remainingTokens: options.maxTokens - (options.reservedForResponse ?? 500),
        sections: [],
        retrievedIds: new Set(),
      };

      // Add system prompt if provided
      if (options.systemPrompt) {
        const tokens = tokenCounter.count(options.systemPrompt);
        ctx.sections.push({
          id: 'system',
          type: 'system',
          content: options.systemPrompt,
          priority: 100,
          tokenCount: tokens,
        });
        ctx.remainingTokens -= tokens;
      }

      return ctx;
    },

    async addToContext(ctx: RetrievalContext, id: string): Promise<boolean> {
      if (ctx.retrievedIds.has(id)) return true; // Already added

      const chunk = await retriever.chunk(id, {
        maxTokens: Math.min(ctx.remainingTokens, 500),
        includeHeader: true,
      });

      if (chunk.tokenCount > ctx.remainingTokens) {
        return false; // Doesn't fit
      }

      ctx.sections.push({
        id,
        type: 'retrieved',
        content: chunk.content,
        priority: 50,
        tokenCount: chunk.tokenCount,
      });

      ctx.remainingTokens -= chunk.tokenCount;
      ctx.retrievedIds.add(id);

      return true;
    },

    composeContext(ctx: RetrievalContext): string {
      // Sort by priority
      const sorted = [...ctx.sections].sort((a, b) => b.priority - a.priority);
      return sorted.map((s) => s.content).join('\n\n');
    },
  };

  return retriever;
}
```

#### Step 3: Create Module Index

**File: `packages/memory/src/retrieval/index.ts`**

```typescript
/**
 * Memory Retrieval API
 *
 * Unified interface for querying external memory.
 */

export { createMemoryRetriever } from './retriever';

export type {
  // Search
  SearchQuery,
  SearchResult,
  SearchResultItem,
  SearchWithHopsOptions,
  SearchWithHopsResult,
  SourceType,

  // Peek
  PeekResult,

  // Chunk
  ChunkOptions,
  ChunkResult,

  // Context
  RetrievalContext,
  CreateContextOptions,

  // Configuration
  MemoryRetrieverConfig,

  // Main interface
  MemoryRetriever,
} from './types';

export { SearchQuerySchema, SourceTypeSchema } from './types';
```

#### Step 4: Update Main Package Index

**File: `packages/memory/src/index.ts`** (final)

```typescript
/**
 * @rtv/memory - External Memory Layer
 *
 * Provides RLM (Recursive Language Model) environment for agents.
 * Manages span-indexed content, retrieval budgets, and access logging.
 */

// Core RLM Environment
export * from './rlm-env';

// Summary Storage
export * from './summaries';

// Reference System
export * from './references';

// Context Window
export * from './context-window';

// Retrieval API
export * from './retrieval';
```

### Phase 3: Verification

```bash
cd packages/memory

# Build
pnpm build

# Typecheck
pnpm typecheck

# Run tests
pnpm test

# Manual verification
cat > verify-retrieval.ts << 'EOF'
import { createMemoryRetriever } from './src/retrieval';
import { createRlmEnv } from './src/rlm-env';
import { createSummaryStore } from './src/summaries';
import { createReferenceRegistry } from './src/references';
import { createTokenCounter } from './src/context-window';

async function main() {
  const env = createRlmEnv({ clientId: 'client-123' });
  const summaryStore = createSummaryStore();
  const referenceRegistry = createReferenceRegistry();
  const tokenCounter = createTokenCounter('gpt-4');

  // Seed data
  await summaryStore.createThreadSummary({
    clientId: 'client-123',
    threadId: 'thread-1',
    platform: 'instagram',
    participantCount: 2,
    messageCount: 10,
    keyPoints: ['User asked about pricing', 'Interested in premium'],
    sentiment: 'positive',
    lastActivityAt: new Date(),
  });

  await referenceRegistry.createReference({
    clientId: 'client-123',
    type: 'knowledge_base',
    targetId: 'kb-1',
    label: 'Pricing FAQ',
    description: 'Common questions about pricing and plans',
    importance: 0.9,
  });

  const retriever = createMemoryRetriever({
    clientId: 'client-123',
    env,
    summaryStore,
    referenceRegistry,
    tokenCounter,
  });

  // Search
  console.log('Searching for "pricing"...');
  const results = await retriever.search({
    query: 'pricing',
    maxResults: 5,
  });
  console.log('Results:', results.items.map(r => r.label));

  // Build context
  console.log('\nBuilding context...');
  const ctx = await retriever.createContext({
    maxTokens: 2000,
    systemPrompt: 'You are a helpful assistant.',
  });

  for (const item of results.items) {
    await retriever.addToContext(ctx, item.id);
  }

  const composed = retriever.composeContext(ctx);
  console.log('\nComposed context:');
  console.log(composed);
  console.log('\nRemaining tokens:', ctx.remainingTokens);
}

main();
EOF

npx tsx verify-retrieval.ts
rm verify-retrieval.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/memory/src/retrieval/types.ts` | Type definitions |
| Create | `packages/memory/src/retrieval/retriever.ts` | Retriever implementation |
| Create | `packages/memory/src/retrieval/index.ts` | Module exports |
| Modify | `packages/memory/src/index.ts` | Add retrieval export |
| Create | `packages/memory/src/__tests__/retrieval.test.ts` | Unit tests |

---

## Acceptance Criteria

- [ ] `search()` queries all memory sources
- [ ] `search()` filters by source type
- [ ] `search()` respects token budget
- [ ] `search()` sorts by relevance/recency/importance
- [ ] `peek()` returns metadata without content
- [ ] `chunk()` retrieves content within token limit
- [ ] `createContext()` initializes with system prompt
- [ ] `addToContext()` respects remaining budget
- [ ] `composeContext()` assembles formatted output
- [ ] `searchWithHops()` follows references
- [ ] Tests pass with >80% coverage

---

## Test Requirements

### Unit Tests

- Search across all source types
- Filtering and sorting
- Token budget enforcement
- Peek without budget impact
- Chunk with truncation
- Context building

### Integration Tests

- Full search → peek → chunk workflow
- Multi-hop retrieval
- Large result set handling

---

## Security & Safety Checklist

- [ ] Client ID scopes all queries (tenant isolation)
- [ ] No raw content in logs
- [ ] Token limits enforced strictly
- [ ] No cross-tenant data leakage in multi-hop

---

## JSON Task Block

```json
{
  "task_id": "S1-B5",
  "name": "Memory Retrieval API",
  "sprint": 1,
  "agent": "B",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 4,
  "dependencies": ["S1-B1", "S1-B2", "S1-B3", "S1-B4"],
  "blocks": [],
  "tags": ["rlm", "memory", "retrieval", "api"],
  "acceptance_criteria": [
    "search across all sources",
    "filtering and sorting",
    "peek without budget",
    "chunk with truncation",
    "context building",
    "multi-hop retrieval"
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

## Agent B Complete

All External Memory Layer tasks are complete:

- **S1-B1**: RLMEnv interface definition
- **S1-B2**: Summary storage system
- **S1-B3**: Reference system
- **S1-B4**: Context window management
- **S1-B5**: Memory retrieval API

The `@rtv/memory` package now provides:
- Span-indexed content storage
- Session-based retrieval with budgets
- Thread and plan summaries
- Reference graph with linking
- Token counting and context management
- Unified retrieval API

**Next:** Agent C (Policy Engine) or Agent D (Runner Skeleton)
