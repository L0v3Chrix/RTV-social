/**
 * KnowledgeBase entity module
 *
 * Implements RLM external memory with span-indexed content
 */

export {
  createKnowledgeBase,
  getKnowledgeBase,
  getKnowledgeBaseByClientId,
  updateKnowledgeBase,
  addSourceDocument,
  updateSourceDocument,
  removeSourceDocument,
  addFAQEntry,
  updateFAQEntry,
  removeFAQEntry,
  getSpanContent,
  searchKnowledgeBase,
} from './repository.js';

export {
  createSpans,
  computeContentHash,
  getSpanContentFromDocument,
  findSpansContaining,
  scoreSpanRelevance,
  defaultRetrievalConfig,
} from './spans.js';

export {
  spanSchema,
  sourceDocumentSchema,
  faqEntrySchema,
  resourceSchema,
  retrievalConfigSchema,
  createKnowledgeBaseInputSchema,
  updateKnowledgeBaseInputSchema,
  type Span,
  type SourceDocument,
  type FAQEntry,
  type Resource,
  type RetrievalConfig,
  type KnowledgeBase,
  type CreateKnowledgeBaseInput,
  type UpdateKnowledgeBaseInput,
  type KBSearchResult,
  type KBSearchOptions,
} from './types.js';
