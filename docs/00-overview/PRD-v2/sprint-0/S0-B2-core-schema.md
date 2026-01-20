# Build Prompt: S0-B2 — Core Schema Migrations

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-B2 |
| **Sprint** | 0 — Foundation |
| **Agent** | B — Database Schema |
| **Complexity** | High |
| **Estimated Effort** | 3-4 hours |
| **Dependencies** | S0-B1 |
| **Blocks** | S0-B3, S0-B4 |

---

## Context

### What We're Building

Create the core database schema with `clients`, `brand_kits`, and `knowledge_bases` tables using Drizzle ORM migrations.

### Why This Matters

- **Foundation tables**: These are the root entities of the system
- **Tenant root**: `clients` table is the tenant anchor for multi-tenancy
- **Brand context**: `brand_kits` provide voice/tone for all AI operations
- **Knowledge base**: RAG-ready storage for client knowledge

### Spec References

- `/docs/01-architecture/system-architecture-v3.md#5-data-model`
- `/docs/02-schemas/onboarding-brand-kit-schema.md`
- `/docs/02-schemas/external-memory-schema.md#knowledge-base`

**Schema Definition (from system-architecture-v3.md):**
> - `clients`: id, name, slug, settings, created_at, updated_at
> - `brand_kits`: id, client_id, tone, colors, logo_refs, kb_refs
> - `knowledge_bases`: id, client_id, chunks[], embeddings[]

---

## Prerequisites

### Completed Tasks

- [x] S0-B1: Postgres connection setup

### Required Files

- `packages/db/src/connection.ts` exists
- `packages/db/drizzle.config.ts` exists

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/db/src/__tests__/schema.test.ts`**

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { db, closeConnection } from '../connection';
import { clients, brandKits, knowledgeBases } from '../schema';
import { eq } from 'drizzle-orm';

describe('Core Schema', () => {
  afterAll(async () => {
    await closeConnection();
  });

  describe('clients table', () => {
    test('clients table has required columns', () => {
      expect(clients.id).toBeDefined();
      expect(clients.name).toBeDefined();
      expect(clients.slug).toBeDefined();
      expect(clients.settings).toBeDefined();
      expect(clients.createdAt).toBeDefined();
      expect(clients.updatedAt).toBeDefined();
    });

    test('can insert and retrieve client', async () => {
      const testClient = {
        name: 'Test Client',
        slug: 'test-client-' + Date.now(),
        settings: { timezone: 'America/New_York' },
      };

      const [inserted] = await db.insert(clients).values(testClient).returning();
      expect(inserted.id).toBeDefined();
      expect(inserted.name).toBe(testClient.name);

      // Cleanup
      await db.delete(clients).where(eq(clients.id, inserted.id));
    });
  });

  describe('brand_kits table', () => {
    test('brand_kits table has required columns', () => {
      expect(brandKits.id).toBeDefined();
      expect(brandKits.clientId).toBeDefined();
      expect(brandKits.name).toBeDefined();
      expect(brandKits.tone).toBeDefined();
      expect(brandKits.colors).toBeDefined();
      expect(brandKits.logoRefs).toBeDefined();
    });

    test('brand_kit references client', async () => {
      // Create client first
      const [client] = await db.insert(clients).values({
        name: 'Brand Test Client',
        slug: 'brand-test-' + Date.now(),
        settings: {},
      }).returning();

      // Create brand kit
      const [kit] = await db.insert(brandKits).values({
        clientId: client.id,
        name: 'Primary Brand',
        tone: { voice: 'professional', personality: ['friendly'] },
        colors: { primary: '#007bff', secondary: '#6c757d' },
        logoRefs: [],
      }).returning();

      expect(kit.clientId).toBe(client.id);

      // Cleanup
      await db.delete(brandKits).where(eq(brandKits.id, kit.id));
      await db.delete(clients).where(eq(clients.id, client.id));
    });
  });

  describe('knowledge_bases table', () => {
    test('knowledge_bases table has required columns', () => {
      expect(knowledgeBases.id).toBeDefined();
      expect(knowledgeBases.clientId).toBeDefined();
      expect(knowledgeBases.name).toBeDefined();
      expect(knowledgeBases.sourceType).toBeDefined();
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Common Schema Utilities

**File: `packages/db/src/schema/common.ts`**

```bash
cat > packages/db/src/schema/common.ts << 'EOF'
/**
 * Common schema utilities and base columns
 */

import { timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';

/**
 * Standard ID column (UUID v4)
 */
export const idColumn = () => uuid('id').defaultRandom().primaryKey();

/**
 * Standard timestamps
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

/**
 * Client ID for multi-tenant tables
 */
export const clientIdColumn = () => uuid('client_id').notNull();

/**
 * Generic JSONB column with type
 */
export const typedJsonb = <T>(name: string) => jsonb(name).$type<T>();
EOF
```

#### Step 2: Create Clients Schema

**File: `packages/db/src/schema/clients.ts`**

```bash
cat > packages/db/src/schema/clients.ts << 'EOF'
/**
 * Clients table schema
 *
 * The root entity for multi-tenancy. Every other entity
 * references a client.
 */

import { pgTable, text, varchar, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { idColumn, timestamps } from './common';

/**
 * Client settings type
 */
export interface ClientSettings {
  timezone?: string;
  defaultLanguage?: string;
  features?: {
    publishing?: boolean;
    engagement?: boolean;
    browserLane?: boolean;
  };
  limits?: {
    maxPlatformAccounts?: number;
    maxBrandKits?: number;
    maxKnowledgeBases?: number;
  };
}

/**
 * Clients table
 */
export const clients = pgTable('clients', {
  id: idColumn(),

  // Basic info
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Settings (JSONB for flexibility)
  settings: jsonb('settings').$type<ClientSettings>().default({}).notNull(),

  // Metadata
  ...timestamps,
}, (table) => ({
  // Indexes
  slugIdx: index('clients_slug_idx').on(table.slug),
  activeIdx: index('clients_active_idx').on(table.isActive),
}));

/**
 * Client insert type
 */
export type NewClient = typeof clients.$inferInsert;

/**
 * Client select type
 */
export type Client = typeof clients.$inferSelect;
EOF
```

#### Step 3: Create Brand Kits Schema

**File: `packages/db/src/schema/brand-kits.ts`**

```bash
cat > packages/db/src/schema/brand-kits.ts << 'EOF'
/**
 * Brand Kits table schema
 *
 * Defines brand voice, colors, and visual identity for a client.
 * Used by AI agents to maintain consistent brand messaging.
 */

import { pgTable, varchar, jsonb, boolean, index, foreignKey } from 'drizzle-orm/pg-core';
import { idColumn, timestamps, clientIdColumn } from './common';
import { clients } from './clients';

/**
 * Brand tone configuration
 */
export interface BrandTone {
  voice: 'professional' | 'casual' | 'friendly' | 'authoritative' | 'playful';
  personality: string[];
  doList: string[];
  dontList: string[];
  examplePhrases?: string[];
}

/**
 * Brand colors configuration
 */
export interface BrandColors {
  primary: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
  [key: string]: string | undefined;
}

/**
 * Logo reference
 */
export interface LogoRef {
  type: 'primary' | 'secondary' | 'icon' | 'wordmark';
  url: string;
  format: 'png' | 'svg' | 'jpg';
  dimensions?: { width: number; height: number };
}

/**
 * Brand Kits table
 */
export const brandKits = pgTable('brand_kits', {
  id: idColumn(),
  clientId: clientIdColumn(),

  // Basic info
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 1000 }),

  // Brand elements
  tone: jsonb('tone').$type<BrandTone>().notNull(),
  colors: jsonb('colors').$type<BrandColors>().notNull(),
  logoRefs: jsonb('logo_refs').$type<LogoRef[]>().default([]).notNull(),

  // Typography (optional)
  fonts: jsonb('fonts').$type<{
    heading?: string;
    body?: string;
    accent?: string;
  }>(),

  // Status
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Metadata
  ...timestamps,
}, (table) => ({
  // Foreign key
  clientFk: foreignKey({
    columns: [table.clientId],
    foreignColumns: [clients.id],
    name: 'brand_kits_client_id_fk',
  }).onDelete('cascade'),

  // Indexes
  clientIdx: index('brand_kits_client_id_idx').on(table.clientId),
  defaultIdx: index('brand_kits_default_idx').on(table.clientId, table.isDefault),
}));

/**
 * Brand Kit insert type
 */
export type NewBrandKit = typeof brandKits.$inferInsert;

/**
 * Brand Kit select type
 */
export type BrandKit = typeof brandKits.$inferSelect;
EOF
```

#### Step 4: Create Knowledge Bases Schema

**File: `packages/db/src/schema/knowledge-bases.ts`**

```bash
cat > packages/db/src/schema/knowledge-bases.ts << 'EOF'
/**
 * Knowledge Bases table schema
 *
 * Stores chunked content with embeddings for RAG-based retrieval.
 * Used by AI agents to access client-specific knowledge.
 */

import { pgTable, varchar, text, jsonb, boolean, integer, real, index, foreignKey } from 'drizzle-orm/pg-core';
import { idColumn, timestamps, clientIdColumn } from './common';
import { clients } from './clients';

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
  sourceUrl?: string;
  pageNumber?: number;
  section?: string;
  tags?: string[];
}

/**
 * Knowledge Bases table
 */
export const knowledgeBases = pgTable('knowledge_bases', {
  id: idColumn(),
  clientId: clientIdColumn(),

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
  id: idColumn(),
  knowledgeBaseId: varchar('knowledge_base_id', { length: 36 }).notNull(),
  clientId: clientIdColumn(), // Denormalized for query efficiency

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
EOF
```

#### Step 5: Update Schema Index

**File: `packages/db/src/schema/index.ts`**

```bash
cat > packages/db/src/schema/index.ts << 'EOF'
/**
 * Database schema exports
 *
 * All table definitions are exported from here.
 */

// Common utilities
export * from './common';

// Core tables
export * from './clients';
export * from './brand-kits';
export * from './knowledge-bases';

// Table references for Drizzle queries
import { clients } from './clients';
import { brandKits } from './brand-kits';
import { knowledgeBases, knowledgeChunks } from './knowledge-bases';

export const schema = {
  clients,
  brandKits,
  knowledgeBases,
  knowledgeChunks,
};
EOF
```

#### Step 6: Generate Migration

```bash
cd packages/db

# Generate migration from schema
pnpm db:generate

# Review generated migration file in src/migrations/
ls -la src/migrations/
```

#### Step 7: Update Package Index

**File: `packages/db/src/index.ts`**

```bash
cat > packages/db/src/index.ts << 'EOF'
/**
 * @rtv/db - Database package
 *
 * Provides database connection, schema, and migrations
 * for the RTV Social Automation Platform.
 */

export { db, testConnection, closeConnection, getPoolStats } from './connection';
export * from './schema';
EOF
```

### Phase 3: Verification

```bash
cd packages/db

# Build the package
pnpm build

# Typecheck
pnpm typecheck

# Generate migration (if not already done)
pnpm db:generate

# Run migration (requires running DB)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rtv_dev" pnpm db:migrate

# Run tests
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rtv_test" pnpm test

# Verify schema in Drizzle Studio
pnpm db:studio
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/db/src/schema/common.ts` | Common schema utilities |
| Create | `packages/db/src/schema/clients.ts` | Clients table |
| Create | `packages/db/src/schema/brand-kits.ts` | Brand kits table |
| Create | `packages/db/src/schema/knowledge-bases.ts` | Knowledge bases + chunks |
| Modify | `packages/db/src/schema/index.ts` | Export all schemas |
| Modify | `packages/db/src/index.ts` | Export schema from package |
| Create | `packages/db/src/__tests__/schema.test.ts` | Schema tests |
| Generate | `packages/db/src/migrations/*.sql` | Migration files |

---

## Acceptance Criteria

- [ ] `clients` table created with all columns
- [ ] `brand_kits` table created with FK to clients
- [ ] `knowledge_bases` table created with FK to clients
- [ ] `knowledge_chunks` table created for RAG storage
- [ ] All tables have proper indexes
- [ ] Migration generated and runs successfully
- [ ] TypeScript types exported for all tables
- [ ] Schema tests pass

---

## Test Requirements

### Unit Tests

- Table schemas have correct columns
- Type definitions are accurate
- Indexes are defined

### Integration Tests

- Can insert/select from all tables
- Foreign key constraints work
- Cascade deletes work

---

## Security & Safety Checklist

- [ ] No sensitive data in default values
- [ ] client_id present on tenant tables
- [ ] Proper foreign key constraints
- [ ] Index on client_id for all tenant tables

---

## JSON Task Block

```json
{
  "task_id": "S0-B2",
  "name": "Core Schema Migrations",
  "sprint": 0,
  "agent": "B",
  "status": "pending",
  "complexity": "high",
  "estimated_hours": 4,
  "dependencies": ["S0-B1"],
  "blocks": ["S0-B3", "S0-B4"],
  "tags": ["database", "schema", "migrations", "drizzle"],
  "acceptance_criteria": [
    "clients table exists",
    "brand_kits table exists",
    "knowledge_bases table exists",
    "migrations run successfully",
    "schema tests pass"
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

1. **S0-B3**: Add multi-tenant schema enhancements
2. **S0-B4**: Create audit event schema
3. **S0-B5**: Write seed data scripts
