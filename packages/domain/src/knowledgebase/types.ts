/**
 * KnowledgeBase entity types
 *
 * Implements RLM external memory patterns with span-indexed content
 * for efficient retrieval without context overflow.
 *
 * Per RLM spec: "External memory is the canonical source (DB/files), not the prompt.
 * LLM only sees slices (retrieved evidence) at any time."
 */

import { z } from 'zod';

/**
 * Span - indexed slice of content for RLM retrieval
 * Per RLM spec: "chunk into spans (4-16KB), write span index (span_id, start_byte, end_byte, hash)"
 */
export const spanSchema = z.object({
  id: z.string(),
  startByte: z.number().int().min(0),
  endByte: z.number().int().min(0),
  hash: z.string(),
  tokenCount: z.number().int().optional(),
});

export type Span = z.infer<typeof spanSchema>;

/**
 * Source document - external content indexed for RLM
 */
export const sourceDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['document', 'webpage', 'transcript', 'notes', 'other']),
  sourceUrl: z.string().url().optional(),
  content: z.string(),
  contentHash: z.string(),
  summary: z.string().optional(),
  spans: z.array(spanSchema),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SourceDocument = z.infer<typeof sourceDocumentSchema>;

/**
 * FAQ entry
 */
export const faqEntrySchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  answer: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type FAQEntry = z.infer<typeof faqEntrySchema>;

/**
 * Resource link
 */
export const resourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  type: z.enum(['link', 'video', 'pdf', 'image', 'other']),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type Resource = z.infer<typeof resourceSchema>;

/**
 * Retrieval configuration - RLM retrieval settings
 */
export const retrievalConfigSchema = z.object({
  chunkSize: z.number().int().min(256).max(16384).default(4096),
  chunkOverlap: z.number().int().min(0).max(2048).default(256),
  maxResults: z.number().int().min(1).max(100).default(10),
  similarityThreshold: z.number().min(0).max(1).default(0.5),
  reranking: z.boolean().default(false),
  maxTokensPerRetrieval: z.number().int().default(4000),
});

export type RetrievalConfig = z.infer<typeof retrievalConfigSchema>;

/**
 * KnowledgeBase entity
 */
export interface KnowledgeBase {
  readonly id: string;
  readonly clientId: string;
  readonly faqs: FAQEntry[];
  readonly resources: Resource[];
  readonly sourceDocuments: SourceDocument[];
  readonly retrievalConfig: RetrievalConfig;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Create knowledgebase input
 */
export const createKnowledgeBaseInputSchema = z.object({
  clientId: z.string().min(1),
  faqs: z.array(faqEntrySchema.omit({ id: true })).optional(),
  resources: z.array(resourceSchema.omit({ id: true })).optional(),
  retrievalConfig: retrievalConfigSchema.optional(),
});

export type CreateKnowledgeBaseInput = z.infer<typeof createKnowledgeBaseInputSchema>;

/**
 * Update knowledgebase input
 */
export const updateKnowledgeBaseInputSchema = z.object({
  faqs: z.array(faqEntrySchema).optional(),
  resources: z.array(resourceSchema).optional(),
  retrievalConfig: retrievalConfigSchema.partial().optional(),
});

export type UpdateKnowledgeBaseInput = z.infer<typeof updateKnowledgeBaseInputSchema>;

/**
 * Search result - RLM retrieval result with span reference
 */
export interface KBSearchResult {
  id: string;
  sourceType: 'document' | 'faq' | 'resource';
  sourceId: string;
  spanId?: string;
  title: string;
  snippet: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Search options
 */
export interface KBSearchOptions {
  limit?: number;
  offset?: number;
  sourceTypes?: Array<'document' | 'faq' | 'resource'>;
  categories?: string[];
  tags?: string[];
  minScore?: number;
}
