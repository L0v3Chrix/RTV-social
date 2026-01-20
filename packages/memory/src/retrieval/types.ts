/**
 * Memory Retrieval API Types
 *
 * Unified interface for querying external memory.
 */

import { z } from 'zod';
import type { RlmEnv } from '../rlm-env/index.js';
import type { SummaryStore } from '../summaries/index.js';
import type { ReferenceRegistry } from '../references/index.js';
import type { TokenCounter, ContextSection } from '../context-window/index.js';

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
  snippet: string | undefined;

  /** Additional metadata */
  metadata: Record<string, unknown> | undefined;
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

export interface RetrievalPeekResult {
  /** Item ID */
  id: string;

  /** Source type */
  sourceType: SourceType;

  /** Source ID */
  sourceId: string;

  /** Full label */
  label: string;

  /** Full description (optional) */
  description: string | undefined;

  /** All metadata */
  metadata: Record<string, unknown>;

  /** Related item IDs */
  relatedIds: string[];

  /** Token estimate for full content */
  tokenEstimate: number;

  /** Content location info */
  location:
    | {
        spanId?: string;
        startByte?: number;
        endByte?: number;
      }
    | undefined;
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
  header: string | undefined;
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
  peek(id: string): Promise<RetrievalPeekResult | null>;

  // Chunk (retrieve content, consumes budget)
  chunk(id: string, options: ChunkOptions): Promise<ChunkResult>;

  // Context building
  createContext(options: CreateContextOptions): Promise<RetrievalContext>;
  addToContext(ctx: RetrievalContext, id: string): Promise<boolean>;
  composeContext(ctx: RetrievalContext): string;
}
