/**
 * Span utilities for RLM content indexing
 *
 * Per RLM spec: "store raw text as immutable blob, compute hashes + length metadata,
 * chunk into spans (4-16KB), write span index (span_id, start_byte, end_byte, hash)"
 */

import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import type { Span, RetrievalConfig } from './types.js';

/**
 * Default retrieval configuration
 */
export const defaultRetrievalConfig: RetrievalConfig = {
  chunkSize: 4096, // 4KB default
  chunkOverlap: 256,
  maxResults: 10,
  similarityThreshold: 0.5,
  reranking: false,
  maxTokensPerRetrieval: 4000,
};

/**
 * Compute content hash
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Create spans from content
 *
 * Chunks content into overlapping spans for RLM retrieval
 */
export function createSpans(
  content: string,
  config: Partial<RetrievalConfig> = {}
): Span[] {
  const chunkSize = config.chunkSize ?? defaultRetrievalConfig.chunkSize;
  const chunkOverlap = config.chunkOverlap ?? defaultRetrievalConfig.chunkOverlap;

  const spans: Span[] = [];
  const contentBytes = Buffer.from(content, 'utf-8');
  const totalBytes = contentBytes.length;

  if (totalBytes === 0) {
    return [];
  }

  // If content is smaller than chunk size, return single span
  if (totalBytes <= chunkSize) {
    return [{
      id: nanoid(),
      startByte: 0,
      endByte: totalBytes,
      hash: computeContentHash(content),
      tokenCount: estimateTokenCount(content),
    }];
  }

  let startByte = 0;

  while (startByte < totalBytes) {
    const endByte = Math.min(startByte + chunkSize, totalBytes);
    const chunkContent = contentBytes.slice(startByte, endByte).toString('utf-8');

    spans.push({
      id: nanoid(),
      startByte,
      endByte,
      hash: computeContentHash(chunkContent),
      tokenCount: estimateTokenCount(chunkContent),
    });

    // Move start forward, accounting for overlap
    const step = chunkSize - chunkOverlap;
    startByte += step;

    // Prevent infinite loop if overlap >= chunkSize
    if (step <= 0) {
      break;
    }
  }

  return spans;
}

/**
 * Get content for a specific span
 */
export function getSpanContentFromDocument(
  content: string,
  span: Span
): string {
  const contentBytes = Buffer.from(content, 'utf-8');
  return contentBytes.slice(span.startByte, span.endByte).toString('utf-8');
}

/**
 * Find spans that contain a search term
 */
export function findSpansContaining(
  content: string,
  spans: Span[],
  searchTerm: string
): Span[] {
  const lowerSearch = searchTerm.toLowerCase();

  return spans.filter(span => {
    const spanContent = getSpanContentFromDocument(content, span);
    return spanContent.toLowerCase().includes(lowerSearch);
  });
}

/**
 * Score span relevance to a query (simple keyword matching)
 */
export function scoreSpanRelevance(
  content: string,
  span: Span,
  query: string
): number {
  const spanContent = getSpanContentFromDocument(content, span).toLowerCase();
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  if (queryTerms.length === 0) return 0;

  let matches = 0;
  for (const term of queryTerms) {
    if (spanContent.includes(term)) {
      matches++;
    }
  }

  return matches / queryTerms.length;
}
