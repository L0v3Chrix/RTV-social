/**
 * Memory Retrieval API
 *
 * Unified interface for querying external memory.
 */

export { createMemoryRetriever } from './retriever.js';

export type {
  // Search
  SearchQuery,
  SearchResult,
  SearchResultItem,
  SearchWithHopsOptions,
  SearchWithHopsResult,
  SourceType,

  // Peek
  RetrievalPeekResult,

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
} from './types.js';

export { SearchQuerySchema, SourceTypeSchema } from './types.js';
