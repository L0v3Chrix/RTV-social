/**
 * Knowledge Bases table schema
 *
 * Stores structured FAQs, resources, source documents with span-indexed content.
 * Implements RLM external memory patterns for efficient retrieval without context overflow.
 *
 * Per RLM spec: "External memory is the canonical source (DB/files), not the prompt.
 * LLM only sees slices (retrieved evidence) at any time."
 */

import { pgTable, varchar, text, jsonb, integer, index, foreignKey, uuid, unique } from 'drizzle-orm/pg-core';
import { idColumn, timestamps, clientIdColumn } from './base.js';
import { clients } from './clients.js';

/**
 * Source type for knowledge base content
 */
export type KnowledgeSourceType =
  | 'document'    // PDF, DOCX, etc.
  | 'website'     // Crawled web content
  | 'faq'         // Q&A pairs
  | 'product'     // Product information
  | 'manual'      // Manual entry
  | 'transcript'; // Video/audio transcripts

/**
 * Chunk metadata (for legacy knowledgeChunks table)
 */
export interface ChunkMetadata {
  sourceUrl?: string | undefined;
  pageNumber?: number | undefined;
  section?: string | undefined;
  tags?: string[] | undefined;
}

/**
 * Span - indexed slice of content for RLM retrieval
 * Per RLM spec: "chunk into spans (4-16KB), write span index (span_id, start_byte, end_byte, hash)"
 */
export interface Span {
  id: string;
  startByte: number;
  endByte: number;
  hash: string;
  tokenCount?: number;
}

/**
 * Source document with span indexing
 */
export interface SourceDocument {
  id: string;
  title: string;
  type: 'document' | 'webpage' | 'transcript' | 'notes' | 'other';
  sourceUrl?: string;
  content: string;
  contentHash: string;
  summary?: string;
  spans: Span[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * FAQ entry
 */
export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Resource link
 */
export interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'link' | 'video' | 'pdf' | 'image' | 'other';
  description?: string;
  tags?: string[];
}

/**
 * Retrieval configuration
 */
export interface RetrievalConfig {
  chunkSize: number;      // bytes (256-16384)
  chunkOverlap: number;   // bytes (0-2048)
  maxResults: number;     // (1-100)
  similarityThreshold: number; // (0-1)
  reranking: boolean;
  maxTokensPerRetrieval: number;
}

/**
 * Knowledge Bases table
 */
export const knowledgeBases = pgTable('knowledge_bases', {
  ...idColumn,
  ...clientIdColumn,

  // RLM External Memory - structured content
  faqs: jsonb('faqs').$type<FAQEntry[]>().default([]).notNull(),
  resources: jsonb('resources').$type<Resource[]>().default([]).notNull(),
  sourceDocuments: jsonb('source_documents').$type<SourceDocument[]>().default([]).notNull(),

  // Retrieval configuration
  retrievalConfig: jsonb('retrieval_config').$type<RetrievalConfig>(),

  // Version tracking
  version: integer('version').default(1).notNull(),

  // Metadata
  ...timestamps,
}, (table) => ({
  // Foreign key
  clientFk: foreignKey({
    columns: [table.clientId],
    foreignColumns: [clients.id],
    name: 'knowledge_bases_client_id_fk',
  }).onDelete('cascade'),

  // One knowledgebase per client
  clientUnique: unique('knowledge_bases_client_id_unique').on(table.clientId),

  // Indexes
  clientIdx: index('knowledge_bases_client_id_idx').on(table.clientId),
}));

/**
 * Knowledge Chunks table (related to knowledge base)
 */
export const knowledgeChunks = pgTable('knowledge_chunks', {
  ...idColumn,
  knowledgeBaseId: uuid('knowledge_base_id').notNull(),
  ...clientIdColumn, // Denormalized for query efficiency

  // Content
  content: text('content').notNull(),

  // Embedding (stored as array of floats)
  // Note: For production, consider pgvector extension
  embedding: jsonb('embedding').$type<number[]>(),
  embeddingModel: varchar('embedding_model', { length: 100 }),

  // Chunk metadata
  chunkIndex: integer('chunk_index').notNull(),
  tokenCount: integer('token_count').notNull(),
  metadata: jsonb('metadata').$type<ChunkMetadata>().default({}).notNull(),

  // Metadata
  ...timestamps,
}, (table) => ({
  // Foreign key
  kbFk: foreignKey({
    columns: [table.knowledgeBaseId],
    foreignColumns: [knowledgeBases.id],
    name: 'knowledge_chunks_kb_id_fk',
  }).onDelete('cascade'),

  // Indexes
  clientIdx: index('knowledge_chunks_client_id_idx').on(table.clientId),
  kbIdx: index('knowledge_chunks_kb_id_idx').on(table.knowledgeBaseId),
}));

/**
 * Knowledge Base insert type
 */
export type NewKnowledgeBase = typeof knowledgeBases.$inferInsert;

/**
 * Knowledge Base select type
 */
export type KnowledgeBaseRow = typeof knowledgeBases.$inferSelect;

/**
 * Knowledge Chunk insert type
 */
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;

/**
 * Knowledge Chunk select type
 */
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
