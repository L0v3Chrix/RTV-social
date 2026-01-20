/**
 * KnowledgeBase repository - database operations
 *
 * Implements RLM external memory with span-indexed content
 */

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { knowledgeBases, clients } from '@rtv/db/schema';
import { createModuleLogger } from '@rtv/observability';
import {
  type KnowledgeBase,
  type CreateKnowledgeBaseInput,
  type UpdateKnowledgeBaseInput,
  type SourceDocument,
  type FAQEntry,
  type Resource,
  type KBSearchResult,
  type KBSearchOptions,
  type RetrievalConfig,
  createKnowledgeBaseInputSchema,
  updateKnowledgeBaseInputSchema,
  retrievalConfigSchema,
} from './types.js';
import {
  createSpans,
  computeContentHash,
  getSpanContentFromDocument,
  scoreSpanRelevance,
  defaultRetrievalConfig,
} from './spans.js';

const logger = createModuleLogger('knowledgebase-repository');

/**
 * Map database row to KnowledgeBase entity
 */
function mapToKnowledgeBase(row: typeof knowledgeBases.$inferSelect): KnowledgeBase {
  return {
    id: row.id,
    clientId: row.clientId,
    faqs: (row.faqs ?? []) as FAQEntry[],
    resources: (row.resources ?? []) as Resource[],
    sourceDocuments: (row.sourceDocuments ?? []) as SourceDocument[],
    retrievalConfig: retrievalConfigSchema.parse(row.retrievalConfig ?? defaultRetrievalConfig),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Create a new knowledgebase
 */
export async function createKnowledgeBase(
  db: PostgresJsDatabase,
  input: CreateKnowledgeBaseInput
): Promise<KnowledgeBase> {
  const validated = createKnowledgeBaseInputSchema.parse(input);

  // Verify client exists
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, validated.clientId))
    .limit(1);

  if (!client) {
    throw new Error('Client not found');
  }

  // Check for existing knowledgebase
  const [existing] = await db
    .select({ id: knowledgeBases.id })
    .from(knowledgeBases)
    .where(eq(knowledgeBases.clientId, validated.clientId))
    .limit(1);

  if (existing) {
    throw new Error('KnowledgeBase already exists for this client');
  }

  const id = nanoid();
  const now = new Date();

  // Add IDs to FAQs and resources
  const faqs: FAQEntry[] = (validated.faqs ?? []).map(faq => ({
    id: nanoid(),
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
    tags: faq.tags,
    metadata: faq.metadata,
  }));

  const resources: Resource[] = (validated.resources ?? []).map(resource => ({
    id: nanoid(),
    title: resource.title,
    url: resource.url,
    type: resource.type,
    description: resource.description,
    tags: resource.tags,
  }));

  const [inserted] = await db
    .insert(knowledgeBases)
    .values({
      id,
      clientId: validated.clientId,
      faqs: faqs as typeof knowledgeBases.$inferInsert['faqs'],
      resources: resources as typeof knowledgeBases.$inferInsert['resources'],
      sourceDocuments: [] as typeof knowledgeBases.$inferInsert['sourceDocuments'],
      retrievalConfig: (validated.retrievalConfig ?? defaultRetrievalConfig) as typeof knowledgeBases.$inferInsert['retrievalConfig'],
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!inserted) {
    throw new Error('Failed to create knowledgebase');
  }

  logger.info({ kbId: id, clientId: validated.clientId }, 'KnowledgeBase created');

  return mapToKnowledgeBase(inserted);
}

/**
 * Get a knowledgebase by ID
 */
export async function getKnowledgeBase(
  db: PostgresJsDatabase,
  id: string
): Promise<KnowledgeBase | null> {
  const [row] = await db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.id, id))
    .limit(1);

  return row ? mapToKnowledgeBase(row) : null;
}

/**
 * Get knowledgebase by client ID
 */
export async function getKnowledgeBaseByClientId(
  db: PostgresJsDatabase,
  clientId: string
): Promise<KnowledgeBase | null> {
  const [row] = await db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.clientId, clientId))
    .limit(1);

  return row ? mapToKnowledgeBase(row) : null;
}

/**
 * Update a knowledgebase
 */
export async function updateKnowledgeBase(
  db: PostgresJsDatabase,
  id: string,
  input: UpdateKnowledgeBaseInput
): Promise<KnowledgeBase> {
  const validated = updateKnowledgeBaseInputSchema.parse(input);

  const existing = await getKnowledgeBase(db, id);
  if (!existing) {
    throw new Error('KnowledgeBase not found');
  }

  const updateData: Partial<typeof knowledgeBases.$inferInsert> = {
    updatedAt: new Date(),
    version: existing.version + 1,
  };

  if (validated.faqs !== undefined) {
    updateData.faqs = validated.faqs as typeof knowledgeBases.$inferInsert['faqs'];
  }
  if (validated.resources !== undefined) {
    updateData.resources = validated.resources as typeof knowledgeBases.$inferInsert['resources'];
  }
  if (validated.retrievalConfig !== undefined) {
    const merged: RetrievalConfig = {
      chunkSize: validated.retrievalConfig.chunkSize ?? existing.retrievalConfig.chunkSize,
      chunkOverlap: validated.retrievalConfig.chunkOverlap ?? existing.retrievalConfig.chunkOverlap,
      maxResults: validated.retrievalConfig.maxResults ?? existing.retrievalConfig.maxResults,
      similarityThreshold: validated.retrievalConfig.similarityThreshold ?? existing.retrievalConfig.similarityThreshold,
      reranking: validated.retrievalConfig.reranking ?? existing.retrievalConfig.reranking,
      maxTokensPerRetrieval: validated.retrievalConfig.maxTokensPerRetrieval ?? existing.retrievalConfig.maxTokensPerRetrieval,
    };
    updateData.retrievalConfig = merged as typeof knowledgeBases.$inferInsert['retrievalConfig'];
  }

  const [updated] = await db
    .update(knowledgeBases)
    .set(updateData)
    .where(eq(knowledgeBases.id, id))
    .returning();

  if (!updated) {
    throw new Error('Failed to update knowledgebase');
  }

  logger.info({ kbId: id, version: updated.version }, 'KnowledgeBase updated');

  return mapToKnowledgeBase(updated);
}

/**
 * Add a source document with span indexing
 */
export async function addSourceDocument(
  db: PostgresJsDatabase,
  kbId: string,
  doc: Omit<SourceDocument, 'id' | 'spans' | 'createdAt' | 'updatedAt'>
): Promise<KnowledgeBase> {
  const existing = await getKnowledgeBase(db, kbId);
  if (!existing) {
    throw new Error('KnowledgeBase not found');
  }

  const now = new Date();
  const contentHash = computeContentHash(doc.content);
  const spans = createSpans(doc.content, existing.retrievalConfig);

  const newDoc: SourceDocument = {
    id: nanoid(),
    title: doc.title,
    type: doc.type,
    sourceUrl: doc.sourceUrl,
    content: doc.content,
    contentHash,
    summary: doc.summary,
    spans,
    metadata: doc.metadata,
    createdAt: now,
    updatedAt: now,
  };

  const sourceDocuments = [...existing.sourceDocuments, newDoc];

  const [updated] = await db
    .update(knowledgeBases)
    .set({
      sourceDocuments: sourceDocuments as typeof knowledgeBases.$inferInsert['sourceDocuments'],
      updatedAt: now,
      version: existing.version + 1,
    })
    .where(eq(knowledgeBases.id, kbId))
    .returning();

  if (!updated) {
    throw new Error('Failed to add source document');
  }

  logger.info({ kbId, docId: newDoc.id, spanCount: spans.length }, 'Source document added');

  return mapToKnowledgeBase(updated);
}

/**
 * Update a source document
 */
export async function updateSourceDocument(
  db: PostgresJsDatabase,
  kbId: string,
  docId: string,
  updates: Partial<Pick<SourceDocument, 'title' | 'content' | 'sourceUrl' | 'summary' | 'metadata'>>
): Promise<KnowledgeBase> {
  const existing = await getKnowledgeBase(db, kbId);
  if (!existing) {
    throw new Error('KnowledgeBase not found');
  }

  const existingDoc = existing.sourceDocuments.find(d => d.id === docId);
  if (!existingDoc) {
    throw new Error('Source document not found');
  }

  const docIndex = existing.sourceDocuments.findIndex(d => d.id === docId);
  const now = new Date();

  // Recompute spans if content changed
  let spans = existingDoc.spans;
  let contentHash = existingDoc.contentHash;
  const content = updates.content ?? existingDoc.content;

  if (updates.content !== undefined) {
    contentHash = computeContentHash(content);
    spans = createSpans(content, existing.retrievalConfig);
  }

  const updatedDoc: SourceDocument = {
    id: existingDoc.id,
    title: updates.title ?? existingDoc.title,
    type: existingDoc.type,
    sourceUrl: updates.sourceUrl ?? existingDoc.sourceUrl,
    content,
    contentHash,
    summary: updates.summary ?? existingDoc.summary,
    spans,
    metadata: updates.metadata ?? existingDoc.metadata,
    createdAt: existingDoc.createdAt,
    updatedAt: now,
  };

  const sourceDocuments = [...existing.sourceDocuments];
  sourceDocuments[docIndex] = updatedDoc;

  const [updated] = await db
    .update(knowledgeBases)
    .set({
      sourceDocuments: sourceDocuments as typeof knowledgeBases.$inferInsert['sourceDocuments'],
      updatedAt: now,
      version: existing.version + 1,
    })
    .where(eq(knowledgeBases.id, kbId))
    .returning();

  if (!updated) {
    throw new Error('Failed to update source document');
  }

  logger.info({ kbId, docId }, 'Source document updated');

  return mapToKnowledgeBase(updated);
}

/**
 * Remove a source document
 */
export async function removeSourceDocument(
  db: PostgresJsDatabase,
  kbId: string,
  docId: string
): Promise<KnowledgeBase> {
  const existing = await getKnowledgeBase(db, kbId);
  if (!existing) {
    throw new Error('KnowledgeBase not found');
  }

  const sourceDocuments = existing.sourceDocuments.filter(d => d.id !== docId);

  const [updated] = await db
    .update(knowledgeBases)
    .set({
      sourceDocuments: sourceDocuments as typeof knowledgeBases.$inferInsert['sourceDocuments'],
      updatedAt: new Date(),
      version: existing.version + 1,
    })
    .where(eq(knowledgeBases.id, kbId))
    .returning();

  if (!updated) {
    throw new Error('Failed to remove source document');
  }

  logger.info({ kbId, docId }, 'Source document removed');

  return mapToKnowledgeBase(updated);
}

/**
 * Get span content by ID
 */
export async function getSpanContent(
  db: PostgresJsDatabase,
  kbId: string,
  spanId: string
): Promise<string | null> {
  const kb = await getKnowledgeBase(db, kbId);
  if (!kb) {
    return null;
  }

  for (const doc of kb.sourceDocuments) {
    const span = doc.spans.find(s => s.id === spanId);
    if (span) {
      return getSpanContentFromDocument(doc.content, span);
    }
  }

  return null;
}

/**
 * Add an FAQ entry
 */
export async function addFAQEntry(
  db: PostgresJsDatabase,
  kbId: string,
  faq: Omit<FAQEntry, 'id'>
): Promise<KnowledgeBase> {
  const existing = await getKnowledgeBase(db, kbId);
  if (!existing) {
    throw new Error('KnowledgeBase not found');
  }

  const newFAQ: FAQEntry = {
    id: nanoid(),
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
    tags: faq.tags,
    metadata: faq.metadata,
  };

  const faqs = [...existing.faqs, newFAQ];

  const [updated] = await db
    .update(knowledgeBases)
    .set({
      faqs: faqs as typeof knowledgeBases.$inferInsert['faqs'],
      updatedAt: new Date(),
      version: existing.version + 1,
    })
    .where(eq(knowledgeBases.id, kbId))
    .returning();

  if (!updated) {
    throw new Error('Failed to add FAQ entry');
  }

  return mapToKnowledgeBase(updated);
}

/**
 * Update an FAQ entry
 */
export async function updateFAQEntry(
  db: PostgresJsDatabase,
  kbId: string,
  faqId: string,
  updates: Partial<Omit<FAQEntry, 'id'>>
): Promise<KnowledgeBase> {
  const existing = await getKnowledgeBase(db, kbId);
  if (!existing) {
    throw new Error('KnowledgeBase not found');
  }

  const faqs = existing.faqs.map(faq => {
    if (faq.id !== faqId) return faq;
    return {
      id: faq.id,
      question: updates.question ?? faq.question,
      answer: updates.answer ?? faq.answer,
      category: updates.category ?? faq.category,
      tags: updates.tags ?? faq.tags,
      metadata: updates.metadata ?? faq.metadata,
    };
  });

  const [updated] = await db
    .update(knowledgeBases)
    .set({
      faqs: faqs as typeof knowledgeBases.$inferInsert['faqs'],
      updatedAt: new Date(),
      version: existing.version + 1,
    })
    .where(eq(knowledgeBases.id, kbId))
    .returning();

  if (!updated) {
    throw new Error('Failed to update FAQ entry');
  }

  return mapToKnowledgeBase(updated);
}

/**
 * Remove an FAQ entry
 */
export async function removeFAQEntry(
  db: PostgresJsDatabase,
  kbId: string,
  faqId: string
): Promise<KnowledgeBase> {
  const existing = await getKnowledgeBase(db, kbId);
  if (!existing) {
    throw new Error('KnowledgeBase not found');
  }

  const faqs = existing.faqs.filter(f => f.id !== faqId);

  const [updated] = await db
    .update(knowledgeBases)
    .set({
      faqs: faqs as typeof knowledgeBases.$inferInsert['faqs'],
      updatedAt: new Date(),
      version: existing.version + 1,
    })
    .where(eq(knowledgeBases.id, kbId))
    .returning();

  if (!updated) {
    throw new Error('Failed to remove FAQ entry');
  }

  return mapToKnowledgeBase(updated);
}

/**
 * Search knowledgebase (RLM retrieval)
 */
export async function searchKnowledgeBase(
  db: PostgresJsDatabase,
  kbId: string,
  query: string,
  options: KBSearchOptions = {}
): Promise<KBSearchResult[]> {
  const kb = await getKnowledgeBase(db, kbId);
  if (!kb) {
    throw new Error('KnowledgeBase not found');
  }

  const limit = options.limit ?? kb.retrievalConfig.maxResults;
  const sourceTypes = options.sourceTypes ?? ['document', 'faq', 'resource'];
  const minScore = options.minScore ?? kb.retrievalConfig.similarityThreshold;

  const results: KBSearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  // Search documents (with span-level results)
  if (sourceTypes.includes('document')) {
    for (const doc of kb.sourceDocuments) {
      for (const span of doc.spans) {
        const score = scoreSpanRelevance(doc.content, span, query);
        if (score >= minScore) {
          const snippet = getSpanContentFromDocument(doc.content, span).slice(0, 200);
          const result: KBSearchResult = {
            id: `${doc.id}:${span.id}`,
            sourceType: 'document',
            sourceId: doc.id,
            spanId: span.id,
            title: doc.title,
            snippet: snippet + (snippet.length >= 200 ? '...' : ''),
            score,
          };
          if (doc.metadata !== undefined) {
            result.metadata = doc.metadata;
          }
          results.push(result);
        }
      }
    }
  }

  // Search FAQs
  if (sourceTypes.includes('faq')) {
    for (const faq of kb.faqs) {
      const text = `${faq.question} ${faq.answer}`.toLowerCase();
      const queryTerms = lowerQuery.split(/\s+/).filter(t => t.length > 2);
      const matches = queryTerms.filter(t => text.includes(t)).length;
      const score = queryTerms.length > 0 ? matches / queryTerms.length : 0;

      if (score >= minScore) {
        results.push({
          id: faq.id,
          sourceType: 'faq',
          sourceId: faq.id,
          title: faq.question,
          snippet: faq.answer.slice(0, 200),
          score,
          metadata: { category: faq.category, tags: faq.tags },
        });
      }
    }
  }

  // Sort by score descending and limit
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
