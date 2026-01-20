# Build Prompt: S1-A3 — KnowledgeBase Entity Model

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-A3 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | A — Core Domain Models |
| **Complexity** | High |
| **Estimated Effort** | 3-4 hours |
| **Dependencies** | S1-A1 |
| **Blocks** | S1-A5 |

---

## Context

### What We're Building

Create the KnowledgeBase entity model that stores structured FAQs, resources, source documents, and supports chunk-based retrieval for RLM external memory integration.

### Why This Matters

- **RLM External Memory**: KnowledgeBase is THE core external memory for agents
- **Span-based retrieval**: Content stored as indexed spans for RLM inspection
- **Dense task support**: Enables agents to work with large knowledge without context overflow
- **Grounding**: Provides evidence/citations for agent responses

### Spec References

- `/docs/01-architecture/system-architecture-v3.md#5.2-brand-knowledge`
- `/docs/01-architecture/rlm-integration-spec.md#4.2-external-memory`
- `/docs/rlm-repository-documentation.md` (RLM span indexing)

**Critical Requirement (from rlm-integration-spec.md):**
> External memory is the canonical source (DB/files), not the prompt. LLM only sees slices (retrieved evidence) at any time.

**Critical Requirement (from RLM documentation):**
> When a prompt is ingested: store raw text as immutable blob, compute hashes + length metadata, chunk into spans (4-16KB), write span index (span_id, start_byte, end_byte, hash)

---

## Prerequisites

### Completed Tasks

- [x] S1-A1: Client entity model

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/domain/src/__tests__/knowledgebase.test.ts`**

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDb } from '@rtv/db/testing';
import { createClient } from '../client';
import {
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
  searchKnowledgeBase,
  getSpanContent,
  type CreateKnowledgeBaseInput,
  type SourceDocument,
  type FAQEntry,
  type KBSearchResult,
} from '../knowledgebase';

describe('KnowledgeBase Entity', () => {
  let db: TestDb;
  let clientId: string;

  beforeEach(async () => {
    db = await createTestDb();
    const client = await createClient(db, { name: 'Test Brand' });
    clientId = client.id;
  });

  afterEach(async () => {
    await cleanupTestDb(db);
  });

  describe('createKnowledgeBase', () => {
    test('creates a knowledgebase with required fields', async () => {
      const input: CreateKnowledgeBaseInput = {
        clientId,
      };

      const kb = await createKnowledgeBase(db, input);

      expect(kb.id).toBeDefined();
      expect(kb.clientId).toBe(clientId);
      expect(kb.faqs).toEqual([]);
      expect(kb.resources).toEqual([]);
      expect(kb.sourceDocuments).toEqual([]);
    });

    test('creates with initial FAQs', async () => {
      const faqs: FAQEntry[] = [
        {
          id: 'faq-1',
          question: 'What are your business hours?',
          answer: 'We are open Monday-Friday 9am-5pm',
          category: 'general',
          tags: ['hours', 'availability'],
        },
      ];

      const kb = await createKnowledgeBase(db, { clientId, faqs });

      expect(kb.faqs).toHaveLength(1);
      expect(kb.faqs[0].question).toBe('What are your business hours?');
    });

    test('creates with retrieval config', async () => {
      const retrievalConfig = {
        chunkSize: 512,
        chunkOverlap: 64,
        maxResults: 10,
        similarityThreshold: 0.7,
        reranking: true,
      };

      const kb = await createKnowledgeBase(db, { clientId, retrievalConfig });

      expect(kb.retrievalConfig.chunkSize).toBe(512);
      expect(kb.retrievalConfig.reranking).toBe(true);
    });

    test('prevents duplicate knowledgebase per client', async () => {
      await createKnowledgeBase(db, { clientId });

      await expect(
        createKnowledgeBase(db, { clientId })
      ).rejects.toThrow('KnowledgeBase already exists for this client');
    });
  });

  describe('Source Documents (RLM Span Storage)', () => {
    let kbId: string;

    beforeEach(async () => {
      const kb = await createKnowledgeBase(db, { clientId });
      kbId = kb.id;
    });

    test('adds a source document with span indexing', async () => {
      const content = 'This is the full content of the document. '.repeat(100);

      const doc: Omit<SourceDocument, 'id' | 'spans' | 'createdAt' | 'updatedAt'> = {
        title: 'Brand Guidelines',
        type: 'document',
        sourceUrl: 'https://storage.example.com/brand-guide.pdf',
        content,
        contentHash: '', // Will be computed
        metadata: { pageCount: 10 },
      };

      const kb = await addSourceDocument(db, kbId, doc);

      expect(kb.sourceDocuments).toHaveLength(1);
      expect(kb.sourceDocuments[0].id).toBeDefined();
      expect(kb.sourceDocuments[0].contentHash).toBeDefined();
      expect(kb.sourceDocuments[0].spans).toBeDefined();
      expect(kb.sourceDocuments[0].spans.length).toBeGreaterThan(0);
    });

    test('spans have proper structure for RLM retrieval', async () => {
      const content = 'A'.repeat(2000); // ~2KB content

      const kb = await addSourceDocument(db, kbId, {
        title: 'Test Doc',
        type: 'document',
        content,
        contentHash: '',
      });

      const span = kb.sourceDocuments[0].spans[0];

      expect(span.id).toBeDefined();
      expect(span.startByte).toBe(0);
      expect(span.endByte).toBeGreaterThan(0);
      expect(span.hash).toBeDefined();
      expect(typeof span.hash).toBe('string');
    });

    test('retrieves span content by ID', async () => {
      const content = 'Hello World! This is test content for span retrieval.';

      const kb = await addSourceDocument(db, kbId, {
        title: 'Test Doc',
        type: 'document',
        content,
        contentHash: '',
      });

      const spanId = kb.sourceDocuments[0].spans[0].id;
      const spanContent = await getSpanContent(db, kbId, spanId);

      expect(spanContent).toBe(content);
    });

    test('updates a source document', async () => {
      await addSourceDocument(db, kbId, {
        title: 'Original Title',
        type: 'document',
        content: 'Original content',
        contentHash: '',
      });

      const kb = await getKnowledgeBase(db, kbId);
      const docId = kb!.sourceDocuments[0].id;

      const updated = await updateSourceDocument(db, kbId, docId, {
        title: 'Updated Title',
        content: 'Updated content with new information',
      });

      expect(updated.sourceDocuments[0].title).toBe('Updated Title');
      // Spans should be recomputed
      expect(updated.sourceDocuments[0].spans[0].hash).not.toBe(
        kb!.sourceDocuments[0].spans[0].hash
      );
    });

    test('removes a source document', async () => {
      await addSourceDocument(db, kbId, {
        title: 'To Remove',
        type: 'document',
        content: 'Content',
        contentHash: '',
      });

      const kb = await getKnowledgeBase(db, kbId);
      const docId = kb!.sourceDocuments[0].id;

      const updated = await removeSourceDocument(db, kbId, docId);

      expect(updated.sourceDocuments).toHaveLength(0);
    });
  });

  describe('FAQ Management', () => {
    let kbId: string;

    beforeEach(async () => {
      const kb = await createKnowledgeBase(db, { clientId });
      kbId = kb.id;
    });

    test('adds an FAQ entry', async () => {
      const faq: Omit<FAQEntry, 'id'> = {
        question: 'What is your return policy?',
        answer: 'We offer 30-day returns on all items.',
        category: 'policies',
        tags: ['returns', 'refunds'],
      };

      const kb = await addFAQEntry(db, kbId, faq);

      expect(kb.faqs).toHaveLength(1);
      expect(kb.faqs[0].question).toBe('What is your return policy?');
    });

    test('updates an FAQ entry', async () => {
      const kb = await addFAQEntry(db, kbId, {
        question: 'Original Q?',
        answer: 'Original A',
        category: 'general',
      });

      const updated = await updateFAQEntry(db, kbId, kb.faqs[0].id, {
        answer: 'Updated answer with more detail',
      });

      expect(updated.faqs[0].answer).toBe('Updated answer with more detail');
      expect(updated.faqs[0].question).toBe('Original Q?');
    });

    test('removes an FAQ entry', async () => {
      const kb = await addFAQEntry(db, kbId, {
        question: 'To Remove?',
        answer: 'Will be removed',
        category: 'temp',
      });

      const updated = await removeFAQEntry(db, kbId, kb.faqs[0].id);

      expect(updated.faqs).toHaveLength(0);
    });
  });

  describe('Search (RLM Retrieval)', () => {
    let kbId: string;

    beforeEach(async () => {
      const kb = await createKnowledgeBase(db, { clientId });
      kbId = kb.id;

      // Add content for searching
      await addSourceDocument(db, kbId, {
        title: 'Product Guide',
        type: 'document',
        content: 'Our premium widgets are made from high-quality materials. They come with a lifetime warranty.',
        contentHash: '',
      });

      await addFAQEntry(db, kbId, {
        question: 'What warranty do you offer?',
        answer: 'We offer a lifetime warranty on all premium products.',
        category: 'warranty',
        tags: ['warranty', 'guarantee'],
      });
    });

    test('searches across documents and FAQs', async () => {
      const results = await searchKnowledgeBase(db, kbId, 'warranty');

      expect(results.length).toBeGreaterThan(0);
    });

    test('returns results with span references', async () => {
      const results = await searchKnowledgeBase(db, kbId, 'warranty');

      const docResult = results.find(r => r.sourceType === 'document');
      expect(docResult?.spanId).toBeDefined();
      expect(docResult?.score).toBeDefined();
    });

    test('returns results with relevance scores', async () => {
      const results = await searchKnowledgeBase(db, kbId, 'warranty premium');

      expect(results[0].score).toBeGreaterThanOrEqual(results[results.length - 1].score);
    });

    test('respects limit parameter', async () => {
      const results = await searchKnowledgeBase(db, kbId, 'warranty', { limit: 1 });

      expect(results).toHaveLength(1);
    });

    test('filters by source type', async () => {
      const docResults = await searchKnowledgeBase(db, kbId, 'warranty', {
        sourceTypes: ['document'],
      });

      expect(docResults.every(r => r.sourceType === 'document')).toBe(true);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create KnowledgeBase Types

**File: `packages/domain/src/knowledgebase/types.ts`**

```bash
mkdir -p packages/domain/src/knowledgebase

cat > packages/domain/src/knowledgebase/types.ts << 'EOF'
/**
 * KnowledgeBase entity types
 *
 * Implements RLM external memory patterns with span-indexed content
 * for efficient retrieval without context overflow.
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
  hash: z.string(), // Content hash for caching/deduplication
  tokenCount: z.number().int().optional(), // Estimated token count
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
  content: z.string(), // Full content (stored externally in production)
  contentHash: z.string(), // Hash of full content
  summary: z.string().optional(), // AI-generated summary
  spans: z.array(spanSchema), // Indexed spans for RLM retrieval
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
  chunkSize: z.number().int().min(256).max(16384).default(4096), // bytes
  chunkOverlap: z.number().int().min(0).max(2048).default(256),
  maxResults: z.number().int().min(1).max(100).default(10),
  similarityThreshold: z.number().min(0).max(1).default(0.5),
  reranking: z.boolean().default(false),
  maxTokensPerRetrieval: z.number().int().default(4000), // Budget per retrieval
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
  spanId?: string; // For documents - specific span
  title: string;
  snippet: string; // Relevant excerpt
  score: number; // Relevance score
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
EOF
```

#### Step 2: Create Span Utilities

**File: `packages/domain/src/knowledgebase/spans.ts`**

```bash
cat > packages/domain/src/knowledgebase/spans.ts << 'EOF'
/**
 * Span utilities for RLM content indexing
 *
 * Per RLM spec: "store raw text as immutable blob, compute hashes + length metadata,
 * chunk into spans (4-16KB), write span index (span_id, start_byte, end_byte, hash)"
 */

import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import type { Span, RetrievalConfig } from './types';

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
  const { chunkSize, chunkOverlap } = { ...defaultRetrievalConfig, ...config };

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
EOF
```

#### Step 3: Create KnowledgeBase Repository

**File: `packages/domain/src/knowledgebase/repository.ts`**

```bash
cat > packages/domain/src/knowledgebase/repository.ts << 'EOF'
/**
 * KnowledgeBase repository - database operations
 *
 * Implements RLM external memory with span-indexed content
 */

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DbType } from '@rtv/db';
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
} from './types';
import {
  createSpans,
  computeContentHash,
  getSpanContentFromDocument,
  scoreSpanRelevance,
  defaultRetrievalConfig,
} from './spans';

const logger = createModuleLogger('knowledgebase-repository');

/**
 * Map database row to KnowledgeBase entity
 */
function mapToKnowledgeBase(row: typeof knowledgeBases.$inferSelect): KnowledgeBase {
  return {
    id: row.id,
    clientId: row.clientId,
    faqs: (row.faqs as FAQEntry[]) ?? [],
    resources: (row.resources as Resource[]) ?? [],
    sourceDocuments: (row.sourceDocuments as SourceDocument[]) ?? [],
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
  db: DbType,
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
  const faqs = (validated.faqs ?? []).map(faq => ({
    ...faq,
    id: nanoid(),
  }));

  const resources = (validated.resources ?? []).map(resource => ({
    ...resource,
    id: nanoid(),
  }));

  const [inserted] = await db
    .insert(knowledgeBases)
    .values({
      id,
      clientId: validated.clientId,
      faqs,
      resources,
      sourceDocuments: [],
      retrievalConfig: validated.retrievalConfig ?? defaultRetrievalConfig,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ kbId: id, clientId: validated.clientId }, 'KnowledgeBase created');

  return mapToKnowledgeBase(inserted);
}

/**
 * Get a knowledgebase by ID
 */
export async function getKnowledgeBase(
  db: DbType,
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
  db: DbType,
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
  db: DbType,
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
    updateData.faqs = validated.faqs;
  }
  if (validated.resources !== undefined) {
    updateData.resources = validated.resources;
  }
  if (validated.retrievalConfig !== undefined) {
    updateData.retrievalConfig = {
      ...existing.retrievalConfig,
      ...validated.retrievalConfig,
    };
  }

  const [updated] = await db
    .update(knowledgeBases)
    .set(updateData)
    .where(eq(knowledgeBases.id, id))
    .returning();

  logger.info({ kbId: id, version: updated.version }, 'KnowledgeBase updated');

  return mapToKnowledgeBase(updated);
}

/**
 * Add a source document with span indexing
 */
export async function addSourceDocument(
  db: DbType,
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
    ...doc,
    id: nanoid(),
    contentHash,
    spans,
    createdAt: now,
    updatedAt: now,
  };

  const sourceDocuments = [...existing.sourceDocuments, newDoc];

  const [updated] = await db
    .update(knowledgeBases)
    .set({
      sourceDocuments,
      updatedAt: now,
      version: existing.version + 1,
    })
    .where(eq(knowledgeBases.id, kbId))
    .returning();

  logger.info({ kbId, docId: newDoc.id, spanCount: spans.length }, 'Source document added');

  return mapToKnowledgeBase(updated);
}

/**
 * Update a source document
 */
export async function updateSourceDocument(
  db: DbType,
  kbId: string,
  docId: string,
  updates: Partial<Pick<SourceDocument, 'title' | 'content' | 'sourceUrl' | 'summary' | 'metadata'>>
): Promise<KnowledgeBase> {
  const existing = await getKnowledgeBase(db, kbId);
  if (!existing) {
    throw new Error('KnowledgeBase not found');
  }

  const docIndex = existing.sourceDocuments.findIndex(d => d.id === docId);
  if (docIndex === -1) {
    throw new Error('Source document not found');
  }

  const existingDoc = existing.sourceDocuments[docIndex];
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
    ...existingDoc,
    ...updates,
    content,
    contentHash,
    spans,
    updatedAt: now,
  };

  const sourceDocuments = [...existing.sourceDocuments];
  sourceDocuments[docIndex] = updatedDoc;

  const [updated] = await db
    .update(knowledgeBases)
    .set({
      sourceDocuments,
      updatedAt: now,
      version: existing.version + 1,
    })
    .where(eq(knowledgeBases.id, kbId))
    .returning();

  logger.info({ kbId, docId }, 'Source document updated');

  return mapToKnowledgeBase(updated);
}

/**
 * Remove a source document
 */
export async function removeSourceDocument(
  db: DbType,
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
      sourceDocuments,
      updatedAt: new Date(),
      version: existing.version + 1,
    })
    .where(eq(knowledgeBases.id, kbId))
    .returning();

  logger.info({ kbId, docId }, 'Source document removed');

  return mapToKnowledgeBase(updated);
}

/**
 * Get span content by ID
 */
export async function getSpanContent(
  db: DbType,
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
  db: DbType,
  kbId: string,
  faq: Omit<FAQEntry, 'id'>
): Promise<KnowledgeBase> {
  const existing = await getKnowledgeBase(db, kbId);
  if (!existing) {
    throw new Error('KnowledgeBase not found');
  }

  const newFAQ: FAQEntry = {
    ...faq,
    id: nanoid(),
  };

  const faqs = [...existing.faqs, newFAQ];

  const [updated] = await db
    .update(knowledgeBases)
    .set({
      faqs,
      updatedAt: new Date(),
      version: existing.version + 1,
    })
    .where(eq(knowledgeBases.id, kbId))
    .returning();

  return mapToKnowledgeBase(updated);
}

/**
 * Update an FAQ entry
 */
export async function updateFAQEntry(
  db: DbType,
  kbId: string,
  faqId: string,
  updates: Partial<Omit<FAQEntry, 'id'>>
): Promise<KnowledgeBase> {
  const existing = await getKnowledgeBase(db, kbId);
  if (!existing) {
    throw new Error('KnowledgeBase not found');
  }

  const faqs = existing.faqs.map(faq =>
    faq.id === faqId ? { ...faq, ...updates } : faq
  );

  const [updated] = await db
    .update(knowledgeBases)
    .set({
      faqs,
      updatedAt: new Date(),
      version: existing.version + 1,
    })
    .where(eq(knowledgeBases.id, kbId))
    .returning();

  return mapToKnowledgeBase(updated);
}

/**
 * Remove an FAQ entry
 */
export async function removeFAQEntry(
  db: DbType,
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
      faqs,
      updatedAt: new Date(),
      version: existing.version + 1,
    })
    .where(eq(knowledgeBases.id, kbId))
    .returning();

  return mapToKnowledgeBase(updated);
}

/**
 * Search knowledgebase (RLM retrieval)
 */
export async function searchKnowledgeBase(
  db: DbType,
  kbId: string,
  query: string,
  options: KBSearchOptions = {}
): Promise<KBSearchResult[]> {
  const kb = await getKnowledgeBase(db, kbId);
  if (!kb) {
    throw new Error('KnowledgeBase not found');
  }

  const {
    limit = kb.retrievalConfig.maxResults,
    sourceTypes = ['document', 'faq', 'resource'],
    minScore = kb.retrievalConfig.similarityThreshold,
  } = options;

  const results: KBSearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  // Search documents (with span-level results)
  if (sourceTypes.includes('document')) {
    for (const doc of kb.sourceDocuments) {
      for (const span of doc.spans) {
        const score = scoreSpanRelevance(doc.content, span, query);
        if (score >= minScore) {
          const snippet = getSpanContentFromDocument(doc.content, span).slice(0, 200);
          results.push({
            id: `${doc.id}:${span.id}`,
            sourceType: 'document',
            sourceId: doc.id,
            spanId: span.id,
            title: doc.title,
            snippet: snippet + (snippet.length >= 200 ? '...' : ''),
            score,
            metadata: doc.metadata,
          });
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
EOF
```

#### Step 4: Create KnowledgeBase Index

**File: `packages/domain/src/knowledgebase/index.ts`**

```bash
cat > packages/domain/src/knowledgebase/index.ts << 'EOF'
/**
 * KnowledgeBase entity module
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
} from './repository';

export {
  createSpans,
  computeContentHash,
  getSpanContentFromDocument,
  findSpansContaining,
  scoreSpanRelevance,
  defaultRetrievalConfig,
} from './spans';

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
} from './types';
EOF
```

#### Step 5: Update Package Index

**File: `packages/domain/src/index.ts`** (update)

```bash
cat > packages/domain/src/index.ts << 'EOF'
/**
 * @rtv/domain - Domain models and business logic
 */

// Client
export * from './client';

// BrandKit
export * from './brandkit';

// KnowledgeBase (RLM External Memory)
export * from './knowledgebase';
EOF
```

### Phase 3: Verification

```bash
cd packages/domain

# Build
pnpm build

# Typecheck
pnpm typecheck

# Run tests
pnpm test
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/domain/src/knowledgebase/types.ts` | KB types + spans |
| Create | `packages/domain/src/knowledgebase/spans.ts` | RLM span utilities |
| Create | `packages/domain/src/knowledgebase/repository.ts` | KB CRUD + search |
| Create | `packages/domain/src/knowledgebase/index.ts` | KB exports |
| Modify | `packages/domain/src/index.ts` | Add KB export |
| Create | `packages/domain/src/__tests__/knowledgebase.test.ts` | KB tests |

---

## Acceptance Criteria

- [ ] `createKnowledgeBase()` creates with config
- [ ] `addSourceDocument()` creates span index
- [ ] Spans have id, startByte, endByte, hash
- [ ] `getSpanContent()` retrieves span slice
- [ ] `searchKnowledgeBase()` returns results with spanId
- [ ] Search scores are computed correctly
- [ ] FAQ CRUD operations work
- [ ] One knowledgebase per client enforced
- [ ] All tests pass

---

## Test Requirements

### Unit Tests

- Span creation works correctly
- Overlapping spans generated
- Content hash computed
- Search returns relevant results
- CRUD operations work

### Integration Tests

- Large document span indexing
- Search performance acceptable

---

## Security & Safety Checklist

- [ ] No secrets in knowledgebase content
- [ ] Source URLs validated
- [ ] Content hashes for integrity
- [ ] Span IDs are not guessable

---

## JSON Task Block

```json
{
  "task_id": "S1-A3",
  "name": "KnowledgeBase Entity Model",
  "sprint": 1,
  "agent": "A",
  "status": "pending",
  "complexity": "high",
  "estimated_hours": 4,
  "dependencies": ["S1-A1"],
  "blocks": ["S1-A5"],
  "tags": ["domain", "entity", "knowledgebase", "rlm", "external-memory"],
  "acceptance_criteria": [
    "span indexing works",
    "retrieval returns span references",
    "CRUD operations work",
    "search with scoring"
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
  "notes": ["RLM span indexing implemented per spec"]
}
```

---

## Next Steps

After completing this task:

1. **S1-A4**: Create Offer entity model
2. **S1-A5**: Create domain event emission
