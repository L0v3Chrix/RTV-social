/**
 * Knowledge Bases table schema
 *
 * Stores chunked content with embeddings for RAG-based retrieval.
 * Used by AI agents to access client-specific knowledge.
 */

import { pgTable, varchar, text, jsonb, boolean, integer, index, foreignKey, uuid } from 'drizzle-orm/pg-core';
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
 * Chunk metadata
 */
export interface ChunkMetadata {
  sourceUrl?: string | undefined;
  pageNumber?: number | undefined;
  section?: string | undefined;
  tags?: string[] | undefined;
}

/**
 * Knowledge Bases table
 */
export const knowledgeBases = pgTable('knowledge_bases', {
  ...idColumn,
  ...clientIdColumn,

  // Basic info
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 1000 }),
  sourceType: varchar('source_type', { length: 50 }).$type<KnowledgeSourceType>().notNull(),

  // Source reference
  sourceRef: varchar('source_ref', { length: 500 }), // URL, file path, etc.

  // Status
  isActive: boolean('is_active').default(true).notNull(),
  isProcessed: boolean('is_processed').default(false).notNull(),

  // Statistics
  chunkCount: integer('chunk_count').default(0).notNull(),
  tokenCount: integer('token_count').default(0).notNull(),

  // Metadata
  ...timestamps,
}, (table) => ({
  // Foreign key
  clientFk: foreignKey({
    columns: [table.clientId],
    foreignColumns: [clients.id],
    name: 'knowledge_bases_client_id_fk',
  }).onDelete('cascade'),

  // Indexes
  clientIdx: index('knowledge_bases_client_id_idx').on(table.clientId),
  sourceTypeIdx: index('knowledge_bases_source_type_idx').on(table.sourceType),
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
export type KnowledgeBase = typeof knowledgeBases.$inferSelect;

/**
 * Knowledge Chunk insert type
 */
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;

/**
 * Knowledge Chunk select type
 */
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
