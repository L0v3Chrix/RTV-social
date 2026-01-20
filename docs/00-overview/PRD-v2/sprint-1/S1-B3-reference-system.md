# Build Prompt: S1-B3 — Reference System

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-B3 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | B — External Memory Layer |
| **Complexity** | Medium |
| **Estimated Effort** | 3-4 hours |
| **Dependencies** | S1-B1 |
| **Blocks** | S1-B5 |

---

## Context

### What We're Building

The Reference System provides lightweight pointers to full content stored elsewhere. References are the core navigation mechanism in RLM — they tell agents what content exists and where to find it, without including the content itself. This enables unbounded context through indirection.

### Why This Matters

- **Indirection**: Agents see references, not full content
- **Navigation**: References form a graph of related content
- **Freshness**: References can point to latest versions
- **Efficiency**: Only fetch content when needed

### Spec References

- `/docs/01-architecture/rlm-integration-spec.md` — Reference patterns
- `/docs/02-schemas/external-memory-schema.md` — Reference schema
- `/docs/03-agents-tools/agent-recursion-contracts.md` — Reference contracts

**Critical Pattern (from rlm-integration-spec.md):**
> References are "symbolic links" in the memory graph. An agent reads a reference to understand what exists, then decides whether to dereference (fetch the actual content) based on relevance.

---

## Prerequisites

### Completed Tasks

- [x] S1-B1: RLMEnv interface definition

### Required Packages

```bash
pnpm add nanoid zod
pnpm add -D vitest @types/node
```

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/memory/src/__tests__/references.test.ts`**

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import {
  createReferenceRegistry,
  type ReferenceRegistry,
  type Reference,
  type ReferenceType,
} from '../references';

describe('Reference System', () => {
  let registry: ReferenceRegistry;

  beforeEach(() => {
    registry = createReferenceRegistry();
  });

  describe('Reference Creation', () => {
    test('creates reference with required fields', async () => {
      const ref = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'Product FAQ',
        description: 'Frequently asked questions about our products',
      });

      expect(ref.id).toBeDefined();
      expect(ref.type).toBe('knowledge_base');
      expect(ref.targetId).toBe('kb-456');
      expect(ref.label).toBe('Product FAQ');
    });

    test('creates reference with span pointer', async () => {
      const ref = await registry.createReference({
        clientId: 'client-123',
        type: 'span',
        targetId: 'span-789',
        spanPointer: {
          spanId: 'span-789',
          startByte: 0,
          endByte: 1000,
          tokenEstimate: 250,
        },
        label: 'Pricing section',
      });

      expect(ref.spanPointer).toBeDefined();
      expect(ref.spanPointer?.tokenEstimate).toBe(250);
    });

    test('creates reference with metadata', async () => {
      const ref = await registry.createReference({
        clientId: 'client-123',
        type: 'thread',
        targetId: 'thread-123',
        label: 'Support conversation',
        metadata: {
          platform: 'instagram',
          sentiment: 'positive',
          messageCount: 15,
        },
      });

      expect(ref.metadata?.platform).toBe('instagram');
      expect(ref.metadata?.messageCount).toBe(15);
    });
  });

  describe('Reference Retrieval', () => {
    test('gets reference by ID', async () => {
      const created = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'Product FAQ',
      });

      const retrieved = await registry.getReference(created.id);

      expect(retrieved).toEqual(created);
    });

    test('gets references by target', async () => {
      await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'Ref 1',
      });

      await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'Ref 2',
      });

      const refs = await registry.getReferencesByTarget('client-123', 'kb-456');

      expect(refs).toHaveLength(2);
    });

    test('lists references by client and type', async () => {
      await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-1',
        label: 'KB 1',
      });

      await registry.createReference({
        clientId: 'client-123',
        type: 'thread',
        targetId: 'thread-1',
        label: 'Thread 1',
      });

      await registry.createReference({
        clientId: 'client-other',
        type: 'knowledge_base',
        targetId: 'kb-2',
        label: 'KB 2',
      });

      const kbRefs = await registry.listReferences({
        clientId: 'client-123',
        type: 'knowledge_base',
      });

      expect(kbRefs).toHaveLength(1);
      expect(kbRefs[0].type).toBe('knowledge_base');
    });
  });

  describe('Reference Links', () => {
    test('creates bidirectional links between references', async () => {
      const ref1 = await registry.createReference({
        clientId: 'client-123',
        type: 'thread',
        targetId: 'thread-1',
        label: 'Support thread',
      });

      const ref2 = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-1',
        label: 'Related FAQ',
      });

      await registry.linkReferences(ref1.id, ref2.id, 'related_to');

      const linkedFrom1 = await registry.getLinkedReferences(ref1.id);
      const linkedFrom2 = await registry.getLinkedReferences(ref2.id);

      expect(linkedFrom1.some((r) => r.id === ref2.id)).toBe(true);
      expect(linkedFrom2.some((r) => r.id === ref1.id)).toBe(true);
    });

    test('creates directional links', async () => {
      const parent = await registry.createReference({
        clientId: 'client-123',
        type: 'plan',
        targetId: 'plan-1',
        label: 'Main plan',
      });

      const child = await registry.createReference({
        clientId: 'client-123',
        type: 'plan',
        targetId: 'plan-2',
        label: 'Sub plan',
      });

      await registry.linkReferences(parent.id, child.id, 'parent_of', {
        bidirectional: false,
      });

      const childrenOfParent = await registry.getLinkedReferences(parent.id, {
        linkType: 'parent_of',
      });
      const parentsOfChild = await registry.getLinkedReferences(child.id, {
        linkType: 'parent_of',
      });

      expect(childrenOfParent.some((r) => r.id === child.id)).toBe(true);
      expect(parentsOfChild).toHaveLength(0);
    });
  });

  describe('Reference Resolution', () => {
    test('resolves reference to content location', async () => {
      const ref = await registry.createReference({
        clientId: 'client-123',
        type: 'span',
        targetId: 'span-123',
        spanPointer: {
          spanId: 'span-123',
          startByte: 100,
          endByte: 500,
          tokenEstimate: 100,
        },
        label: 'Content section',
      });

      const location = await registry.resolveReference(ref.id);

      expect(location.spanId).toBe('span-123');
      expect(location.startByte).toBe(100);
      expect(location.endByte).toBe(500);
    });

    test('tracks reference access', async () => {
      const ref = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'FAQ',
      });

      await registry.recordAccess(ref.id, {
        sessionId: 'session-123',
        operation: 'read',
      });

      const stats = await registry.getAccessStats(ref.id);

      expect(stats.accessCount).toBe(1);
      expect(stats.lastAccessedAt).toBeDefined();
    });
  });

  describe('Reference Versioning', () => {
    test('creates new version of reference', async () => {
      const v1 = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'FAQ v1',
      });

      const v2 = await registry.createVersion(v1.id, {
        label: 'FAQ v2',
        description: 'Updated FAQ content',
      });

      expect(v2.version).toBe(2);
      expect(v2.previousVersionId).toBe(v1.id);
      expect(v2.label).toBe('FAQ v2');
    });

    test('lists version history', async () => {
      const v1 = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'FAQ v1',
      });

      await registry.createVersion(v1.id, { label: 'FAQ v2' });
      await registry.createVersion(v1.id, { label: 'FAQ v3' });

      const history = await registry.getVersionHistory(v1.id);

      expect(history).toHaveLength(3);
      expect(history[0].label).toBe('FAQ v1');
      expect(history[2].label).toBe('FAQ v3');
    });
  });

  describe('Reference Serialization', () => {
    test('toCompactForm generates minimal representation', async () => {
      const ref = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'Product FAQ',
        description: 'Long description here',
        metadata: { category: 'support' },
      });

      const compact = registry.toCompactForm(ref);

      expect(compact).toContain('knowledge_base');
      expect(compact).toContain('Product FAQ');
      expect(compact.length).toBeLessThan(200);
    });

    test('toCompactForm array generates reference list', async () => {
      const refs = await Promise.all([
        registry.createReference({
          clientId: 'client-123',
          type: 'knowledge_base',
          targetId: 'kb-1',
          label: 'FAQ 1',
        }),
        registry.createReference({
          clientId: 'client-123',
          type: 'thread',
          targetId: 'thread-1',
          label: 'Thread 1',
        }),
      ]);

      const compact = registry.toCompactFormArray(refs);

      expect(compact).toContain('FAQ 1');
      expect(compact).toContain('Thread 1');
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Reference Types

**File: `packages/memory/src/references/types.ts`**

```typescript
/**
 * Reference Type Definitions
 *
 * References are lightweight pointers to content in external memory.
 */

import { z } from 'zod';

// =====================
// Reference Types
// =====================

export const ReferenceTypeSchema = z.enum([
  'knowledge_base',
  'thread',
  'plan',
  'episode',
  'brand_kit',
  'offer',
  'span',
  'summary',
  'artifact',
]);

export type ReferenceType = z.infer<typeof ReferenceTypeSchema>;

// =====================
// Span Pointer
// =====================

export const SpanPointerSchema = z.object({
  /** Span ID for direct retrieval */
  spanId: z.string(),

  /** Byte offset start */
  startByte: z.number().int().nonnegative(),

  /** Byte offset end */
  endByte: z.number().int().positive(),

  /** Estimated token count */
  tokenEstimate: z.number().int().positive(),

  /** Content hash for validation */
  contentHash: z.string().optional(),
});

export type SpanPointer = z.infer<typeof SpanPointerSchema>;

// =====================
// Reference
// =====================

export const ReferenceSchema = z.object({
  /** Unique reference identifier */
  id: z.string(),

  /** Client ID for tenant isolation */
  clientId: z.string(),

  /** Type of content being referenced */
  type: ReferenceTypeSchema,

  /** Target entity ID */
  targetId: z.string(),

  /** Human-readable label */
  label: z.string(),

  /** Optional description */
  description: z.string().optional(),

  /** Optional span pointer for direct content access */
  spanPointer: SpanPointerSchema.optional(),

  /** Flexible metadata */
  metadata: z.record(z.unknown()).optional(),

  /** Version number */
  version: z.number().int().positive(),

  /** Previous version reference ID */
  previousVersionId: z.string().optional(),

  /** Importance score (0-1) for ranking */
  importance: z.number().min(0).max(1).optional(),

  /** Creation timestamp */
  createdAt: z.date(),

  /** Last update timestamp */
  updatedAt: z.date(),
});

export type Reference = z.infer<typeof ReferenceSchema>;

// =====================
// Reference Links
// =====================

export const LinkTypeSchema = z.enum([
  'related_to',
  'parent_of',
  'child_of',
  'derived_from',
  'references',
  'supersedes',
]);

export type LinkType = z.infer<typeof LinkTypeSchema>;

export const ReferenceLinkSchema = z.object({
  /** Source reference ID */
  sourceId: z.string(),

  /** Target reference ID */
  targetId: z.string(),

  /** Link type */
  linkType: LinkTypeSchema,

  /** Link metadata */
  metadata: z.record(z.unknown()).optional(),

  /** Creation timestamp */
  createdAt: z.date(),
});

export type ReferenceLink = z.infer<typeof ReferenceLinkSchema>;

// =====================
// Access Tracking
// =====================

export interface AccessRecord {
  referenceId: string;
  sessionId: string;
  operation: 'read' | 'dereference' | 'link';
  timestamp: Date;
}

export interface AccessStats {
  referenceId: string;
  accessCount: number;
  lastAccessedAt: Date | null;
  dereferenceCount: number;
}

// =====================
// Input Types
// =====================

export type CreateReferenceInput = Omit<
  Reference,
  'id' | 'version' | 'createdAt' | 'updatedAt'
>;

export type UpdateReferenceInput = Partial<
  Omit<Reference, 'id' | 'clientId' | 'createdAt'>
>;

export interface ListReferencesOptions {
  clientId: string;
  type?: ReferenceType;
  targetId?: string;
  minImportance?: number;
  limit?: number;
}

export interface LinkOptions {
  bidirectional?: boolean;
  metadata?: Record<string, unknown>;
}

export interface GetLinkedOptions {
  linkType?: LinkType;
  direction?: 'outgoing' | 'incoming' | 'both';
}

// =====================
// Resolved Location
// =====================

export interface ResolvedLocation {
  referenceId: string;
  targetId: string;
  spanId?: string;
  startByte?: number;
  endByte?: number;
  tokenEstimate?: number;
}

// =====================
// Registry Interface
// =====================

export interface ReferenceRegistry {
  // CRUD
  createReference(input: CreateReferenceInput): Promise<Reference>;
  getReference(id: string): Promise<Reference | null>;
  updateReference(id: string, input: UpdateReferenceInput): Promise<Reference>;
  deleteReference(id: string): Promise<void>;

  // Query
  getReferencesByTarget(clientId: string, targetId: string): Promise<Reference[]>;
  listReferences(options: ListReferencesOptions): Promise<Reference[]>;

  // Links
  linkReferences(
    sourceId: string,
    targetId: string,
    linkType: LinkType,
    options?: LinkOptions
  ): Promise<void>;
  unlinkReferences(sourceId: string, targetId: string): Promise<void>;
  getLinkedReferences(id: string, options?: GetLinkedOptions): Promise<Reference[]>;

  // Resolution
  resolveReference(id: string): Promise<ResolvedLocation>;

  // Access tracking
  recordAccess(
    referenceId: string,
    access: { sessionId: string; operation: AccessRecord['operation'] }
  ): Promise<void>;
  getAccessStats(referenceId: string): Promise<AccessStats>;

  // Versioning
  createVersion(id: string, updates: UpdateReferenceInput): Promise<Reference>;
  getVersionHistory(id: string): Promise<Reference[]>;

  // Serialization
  toCompactForm(ref: Reference): string;
  toCompactFormArray(refs: Reference[]): string;
}
```

#### Step 2: Implement Reference Registry

**File: `packages/memory/src/references/registry.ts`**

```typescript
/**
 * Reference Registry Implementation
 *
 * In-memory registry for reference management.
 */

import { nanoid } from 'nanoid';
import type {
  ReferenceRegistry,
  Reference,
  ReferenceLink,
  CreateReferenceInput,
  UpdateReferenceInput,
  ListReferencesOptions,
  LinkType,
  LinkOptions,
  GetLinkedOptions,
  ResolvedLocation,
  AccessRecord,
  AccessStats,
} from './types';

/**
 * Create a new Reference Registry
 */
export function createReferenceRegistry(): ReferenceRegistry {
  const references = new Map<string, Reference>();
  const links = new Map<string, ReferenceLink[]>();
  const accessRecords = new Map<string, AccessRecord[]>();
  const versionChains = new Map<string, string[]>(); // rootId -> [v1Id, v2Id, ...]

  const registry: ReferenceRegistry = {
    // CRUD
    async createReference(input: CreateReferenceInput): Promise<Reference> {
      const now = new Date();
      const ref: Reference = {
        ...input,
        id: `ref-${nanoid()}`,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };

      references.set(ref.id, ref);

      // Initialize version chain
      versionChains.set(ref.id, [ref.id]);

      return ref;
    },

    async getReference(id: string): Promise<Reference | null> {
      return references.get(id) ?? null;
    },

    async updateReference(id: string, input: UpdateReferenceInput): Promise<Reference> {
      const existing = references.get(id);
      if (!existing) {
        throw new Error(`Reference not found: ${id}`);
      }

      const updated: Reference = {
        ...existing,
        ...input,
        updatedAt: new Date(),
      };

      references.set(id, updated);
      return updated;
    },

    async deleteReference(id: string): Promise<void> {
      references.delete(id);

      // Remove all links involving this reference
      for (const [key, refLinks] of links.entries()) {
        const filtered = refLinks.filter(
          (l) => l.sourceId !== id && l.targetId !== id
        );
        if (filtered.length === 0) {
          links.delete(key);
        } else {
          links.set(key, filtered);
        }
      }
    },

    // Query
    async getReferencesByTarget(
      clientId: string,
      targetId: string
    ): Promise<Reference[]> {
      const results: Reference[] = [];
      for (const ref of references.values()) {
        if (ref.clientId === clientId && ref.targetId === targetId) {
          results.push(ref);
        }
      }
      return results;
    },

    async listReferences(options: ListReferencesOptions): Promise<Reference[]> {
      const results: Reference[] = [];

      for (const ref of references.values()) {
        if (ref.clientId !== options.clientId) continue;
        if (options.type && ref.type !== options.type) continue;
        if (options.targetId && ref.targetId !== options.targetId) continue;
        if (
          options.minImportance !== undefined &&
          (ref.importance ?? 0) < options.minImportance
        ) {
          continue;
        }

        results.push(ref);
      }

      // Sort by importance (descending), then by creation date
      results.sort((a, b) => {
        const impDiff = (b.importance ?? 0) - (a.importance ?? 0);
        if (impDiff !== 0) return impDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      if (options.limit) {
        return results.slice(0, options.limit);
      }

      return results;
    },

    // Links
    async linkReferences(
      sourceId: string,
      targetId: string,
      linkType: LinkType,
      options?: LinkOptions
    ): Promise<void> {
      const now = new Date();

      // Create forward link
      const forwardLink: ReferenceLink = {
        sourceId,
        targetId,
        linkType,
        metadata: options?.metadata,
        createdAt: now,
      };

      const sourceLinks = links.get(sourceId) ?? [];
      sourceLinks.push(forwardLink);
      links.set(sourceId, sourceLinks);

      // Create reverse link if bidirectional (default: true)
      if (options?.bidirectional !== false) {
        const reverseLink: ReferenceLink = {
          sourceId: targetId,
          targetId: sourceId,
          linkType: getReverseLinkType(linkType),
          metadata: options?.metadata,
          createdAt: now,
        };

        const targetLinks = links.get(targetId) ?? [];
        targetLinks.push(reverseLink);
        links.set(targetId, targetLinks);
      }
    },

    async unlinkReferences(sourceId: string, targetId: string): Promise<void> {
      // Remove forward link
      const sourceLinks = links.get(sourceId) ?? [];
      links.set(
        sourceId,
        sourceLinks.filter((l) => l.targetId !== targetId)
      );

      // Remove reverse link
      const targetLinks = links.get(targetId) ?? [];
      links.set(
        targetId,
        targetLinks.filter((l) => l.targetId !== sourceId)
      );
    },

    async getLinkedReferences(
      id: string,
      options?: GetLinkedOptions
    ): Promise<Reference[]> {
      const direction = options?.direction ?? 'both';
      const linkedIds = new Set<string>();

      // Get outgoing links
      if (direction === 'outgoing' || direction === 'both') {
        const outgoing = links.get(id) ?? [];
        for (const link of outgoing) {
          if (!options?.linkType || link.linkType === options.linkType) {
            linkedIds.add(link.targetId);
          }
        }
      }

      // Get incoming links
      if (direction === 'incoming' || direction === 'both') {
        for (const [sourceId, sourceLinks] of links.entries()) {
          if (sourceId === id) continue;
          for (const link of sourceLinks) {
            if (link.targetId === id) {
              if (!options?.linkType || link.linkType === options.linkType) {
                linkedIds.add(sourceId);
              }
            }
          }
        }
      }

      // Resolve to references
      const results: Reference[] = [];
      for (const linkedId of linkedIds) {
        const ref = references.get(linkedId);
        if (ref) results.push(ref);
      }

      return results;
    },

    // Resolution
    async resolveReference(id: string): Promise<ResolvedLocation> {
      const ref = references.get(id);
      if (!ref) {
        throw new Error(`Reference not found: ${id}`);
      }

      const location: ResolvedLocation = {
        referenceId: id,
        targetId: ref.targetId,
      };

      if (ref.spanPointer) {
        location.spanId = ref.spanPointer.spanId;
        location.startByte = ref.spanPointer.startByte;
        location.endByte = ref.spanPointer.endByte;
        location.tokenEstimate = ref.spanPointer.tokenEstimate;
      }

      return location;
    },

    // Access tracking
    async recordAccess(
      referenceId: string,
      access: { sessionId: string; operation: AccessRecord['operation'] }
    ): Promise<void> {
      const record: AccessRecord = {
        referenceId,
        sessionId: access.sessionId,
        operation: access.operation,
        timestamp: new Date(),
      };

      const records = accessRecords.get(referenceId) ?? [];
      records.push(record);
      accessRecords.set(referenceId, records);
    },

    async getAccessStats(referenceId: string): Promise<AccessStats> {
      const records = accessRecords.get(referenceId) ?? [];

      return {
        referenceId,
        accessCount: records.length,
        lastAccessedAt: records.length > 0 ? records[records.length - 1].timestamp : null,
        dereferenceCount: records.filter((r) => r.operation === 'dereference').length,
      };
    },

    // Versioning
    async createVersion(
      id: string,
      updates: UpdateReferenceInput
    ): Promise<Reference> {
      const existing = references.get(id);
      if (!existing) {
        throw new Error(`Reference not found: ${id}`);
      }

      // Find the root version
      let rootId = id;
      for (const [root, chain] of versionChains.entries()) {
        if (chain.includes(id)) {
          rootId = root;
          break;
        }
      }

      const chain = versionChains.get(rootId) ?? [id];
      const latestId = chain[chain.length - 1];
      const latest = references.get(latestId)!;

      const now = new Date();
      const newVersion: Reference = {
        ...latest,
        ...updates,
        id: `ref-${nanoid()}`,
        version: latest.version + 1,
        previousVersionId: latestId,
        createdAt: now,
        updatedAt: now,
      };

      references.set(newVersion.id, newVersion);
      chain.push(newVersion.id);
      versionChains.set(rootId, chain);

      return newVersion;
    },

    async getVersionHistory(id: string): Promise<Reference[]> {
      // Find the root version
      let rootId = id;
      for (const [root, chain] of versionChains.entries()) {
        if (chain.includes(id)) {
          rootId = root;
          break;
        }
      }

      const chain = versionChains.get(rootId) ?? [id];
      const history: Reference[] = [];

      for (const versionId of chain) {
        const ref = references.get(versionId);
        if (ref) history.push(ref);
      }

      return history;
    },

    // Serialization
    toCompactForm(ref: Reference): string {
      const parts = [
        `[${ref.type}]`,
        ref.label,
        ref.spanPointer ? `(~${ref.spanPointer.tokenEstimate} tokens)` : '',
      ].filter(Boolean);

      return parts.join(' ');
    },

    toCompactFormArray(refs: Reference[]): string {
      return refs.map((ref, i) => `${i + 1}. ${registry.toCompactForm(ref)}`).join('\n');
    },
  };

  return registry;
}

/**
 * Get the reverse link type for bidirectional linking
 */
function getReverseLinkType(linkType: LinkType): LinkType {
  switch (linkType) {
    case 'parent_of':
      return 'child_of';
    case 'child_of':
      return 'parent_of';
    case 'supersedes':
      return 'derived_from';
    case 'derived_from':
      return 'supersedes';
    default:
      return linkType;
  }
}
```

#### Step 3: Create Module Index

**File: `packages/memory/src/references/index.ts`**

```typescript
/**
 * Reference System
 *
 * Lightweight pointers to content in external memory.
 */

export { createReferenceRegistry } from './registry';

export type {
  // Core types
  Reference,
  ReferenceType,
  SpanPointer,
  ReferenceLink,
  LinkType,

  // Input types
  CreateReferenceInput,
  UpdateReferenceInput,
  ListReferencesOptions,
  LinkOptions,
  GetLinkedOptions,

  // Resolution
  ResolvedLocation,

  // Access tracking
  AccessRecord,
  AccessStats,

  // Registry
  ReferenceRegistry,
} from './types';

export {
  ReferenceSchema,
  ReferenceTypeSchema,
  SpanPointerSchema,
  ReferenceLinkSchema,
  LinkTypeSchema,
} from './types';
```

#### Step 4: Update Main Package Index

**File: `packages/memory/src/index.ts`** (update)

```typescript
/**
 * @rtv/memory - External Memory Layer
 *
 * Provides RLM (Recursive Language Model) environment for agents.
 * Manages span-indexed content, retrieval budgets, and access logging.
 */

export * from './rlm-env';
export * from './summaries';
export * from './references';
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
cat > verify-references.ts << 'EOF'
import { createReferenceRegistry } from './src/references';

async function main() {
  const registry = createReferenceRegistry();

  // Create references
  const kbRef = await registry.createReference({
    clientId: 'client-123',
    type: 'knowledge_base',
    targetId: 'kb-456',
    label: 'Product FAQ',
    description: 'Frequently asked questions',
    importance: 0.9,
  });

  const threadRef = await registry.createReference({
    clientId: 'client-123',
    type: 'thread',
    targetId: 'thread-789',
    label: 'Support conversation',
    spanPointer: {
      spanId: 'span-123',
      startByte: 0,
      endByte: 1000,
      tokenEstimate: 250,
    },
  });

  // Link them
  await registry.linkReferences(threadRef.id, kbRef.id, 'references');

  // Get linked
  const linked = await registry.getLinkedReferences(threadRef.id);
  console.log('Linked references:', linked.map(r => r.label));

  // Resolve
  const location = await registry.resolveReference(threadRef.id);
  console.log('Resolved location:', location);

  // Compact form
  console.log('\nCompact form:');
  console.log(registry.toCompactFormArray([kbRef, threadRef]));
}

main();
EOF

npx tsx verify-references.ts
rm verify-references.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/memory/src/references/types.ts` | Type definitions |
| Create | `packages/memory/src/references/registry.ts` | Registry implementation |
| Create | `packages/memory/src/references/index.ts` | Module exports |
| Modify | `packages/memory/src/index.ts` | Add references export |
| Create | `packages/memory/src/__tests__/references.test.ts` | Unit tests |

---

## Acceptance Criteria

- [ ] `createReference()` creates reference with all fields
- [ ] `getReference()` retrieves by ID
- [ ] `listReferences()` filters by client, type, importance
- [ ] `linkReferences()` creates bidirectional links
- [ ] `getLinkedReferences()` returns connected references
- [ ] `resolveReference()` returns content location
- [ ] `createVersion()` maintains version chain
- [ ] `toCompactForm()` generates minimal representation
- [ ] Access tracking records operations
- [ ] Tests pass with >80% coverage

---

## Test Requirements

### Unit Tests

- Reference CRUD operations
- Link creation and traversal
- Version history
- Access tracking
- Serialization

### Integration Tests

- Reference integration with RlmEnv
- Multi-hop link traversal

---

## Security & Safety Checklist

- [ ] Client ID scopes all queries (tenant isolation)
- [ ] No sensitive data in labels/descriptions
- [ ] Access tracking doesn't leak session info
- [ ] Version history respects tenant boundaries

---

## JSON Task Block

```json
{
  "task_id": "S1-B3",
  "name": "Reference System",
  "sprint": 1,
  "agent": "B",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 4,
  "dependencies": ["S1-B1"],
  "blocks": ["S1-B5"],
  "tags": ["rlm", "memory", "references"],
  "acceptance_criteria": [
    "reference CRUD operations",
    "bidirectional linking",
    "version history",
    "resolution to content location",
    "compact serialization"
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

## Next Steps

After completing this task:

1. **S1-B4**: Add context window management with token counting
2. **S1-B5**: Implement memory retrieval API
