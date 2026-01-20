# Build Prompt: S1-A1 — Client Entity Model

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-A1 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | A — Core Domain Models |
| **Complexity** | Medium |
| **Estimated Effort** | 2-3 hours |
| **Dependencies** | S0-B2 |
| **Blocks** | S1-A2, S1-A3, S1-A4, S1-A5 |

---

## Context

### What We're Building

Create the Client entity model with full CRUD operations, validation, and domain events. The Client is the root tenant entity that all other domain objects reference.

### Why This Matters

- **Tenant isolation**: All data is scoped to a client
- **Business entity**: Represents a managed brand in the system
- **Event source**: Client changes trigger downstream processing
- **Foundation**: All other domain models depend on Client

### Spec References

- `/docs/01-architecture/system-architecture-v3.md#5-data-model`
- `/docs/05-policy-safety/multi-tenant-isolation.md`

**Critical Requirement (from system-architecture-v3.md):**
> Client: managed brand — id (uuid), name, status, created_at

---

## Prerequisites

### Completed Tasks

- [x] S0-B2: Core schema migrations

### Required Packages

- @rtv/db (from Sprint 0)
- @rtv/types (from Sprint 0)

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/domain/src/__tests__/client.test.ts`**

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDb } from '@rtv/db/testing';
import {
  createClient,
  getClient,
  getClientByName,
  updateClient,
  deleteClient,
  listClients,
  activateClient,
  suspendClient,
  type CreateClientInput,
  type UpdateClientInput,
  ClientStatus,
} from '../client';

describe('Client Entity', () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await cleanupTestDb(db);
  });

  describe('createClient', () => {
    test('creates a client with required fields', async () => {
      const input: CreateClientInput = {
        name: 'Test Brand',
      };

      const client = await createClient(db, input);

      expect(client.id).toBeDefined();
      expect(client.name).toBe('Test Brand');
      expect(client.status).toBe(ClientStatus.ACTIVE);
      expect(client.createdAt).toBeInstanceOf(Date);
      expect(client.updatedAt).toBeInstanceOf(Date);
    });

    test('creates a client with optional fields', async () => {
      const input: CreateClientInput = {
        name: 'Full Brand',
        slug: 'full-brand',
        description: 'A complete brand setup',
        settings: { timezone: 'America/New_York' },
      };

      const client = await createClient(db, input);

      expect(client.slug).toBe('full-brand');
      expect(client.description).toBe('A complete brand setup');
      expect(client.settings.timezone).toBe('America/New_York');
    });

    test('auto-generates slug from name if not provided', async () => {
      const client = await createClient(db, { name: 'My Awesome Brand' });

      expect(client.slug).toBe('my-awesome-brand');
    });

    test('rejects duplicate names', async () => {
      await createClient(db, { name: 'Unique Brand' });

      await expect(
        createClient(db, { name: 'Unique Brand' })
      ).rejects.toThrow('Client with this name already exists');
    });

    test('validates name is not empty', async () => {
      await expect(
        createClient(db, { name: '' })
      ).rejects.toThrow('Client name is required');
    });

    test('validates name length', async () => {
      await expect(
        createClient(db, { name: 'a'.repeat(256) })
      ).rejects.toThrow('Client name must be 255 characters or less');
    });
  });

  describe('getClient', () => {
    test('retrieves an existing client by id', async () => {
      const created = await createClient(db, { name: 'Get Test' });
      const retrieved = await getClient(db, created.id);

      expect(retrieved).toEqual(created);
    });

    test('returns null for non-existent client', async () => {
      const result = await getClient(db, 'non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getClientByName', () => {
    test('retrieves client by exact name', async () => {
      const created = await createClient(db, { name: 'Named Client' });
      const retrieved = await getClientByName(db, 'Named Client');

      expect(retrieved?.id).toBe(created.id);
    });

    test('returns null for non-existent name', async () => {
      const result = await getClientByName(db, 'Does Not Exist');

      expect(result).toBeNull();
    });
  });

  describe('updateClient', () => {
    test('updates client fields', async () => {
      const created = await createClient(db, { name: 'Original Name' });

      const updated = await updateClient(db, created.id, {
        name: 'Updated Name',
        description: 'New description',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('New description');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });

    test('throws for non-existent client', async () => {
      await expect(
        updateClient(db, 'non-existent', { name: 'New Name' })
      ).rejects.toThrow('Client not found');
    });

    test('prevents duplicate names on update', async () => {
      const client1 = await createClient(db, { name: 'Client One' });
      await createClient(db, { name: 'Client Two' });

      await expect(
        updateClient(db, client1.id, { name: 'Client Two' })
      ).rejects.toThrow('Client with this name already exists');
    });
  });

  describe('deleteClient', () => {
    test('soft deletes a client', async () => {
      const created = await createClient(db, { name: 'To Delete' });

      await deleteClient(db, created.id);

      const retrieved = await getClient(db, created.id);
      expect(retrieved?.status).toBe(ClientStatus.DELETED);
      expect(retrieved?.deletedAt).toBeInstanceOf(Date);
    });

    test('throws for non-existent client', async () => {
      await expect(
        deleteClient(db, 'non-existent')
      ).rejects.toThrow('Client not found');
    });
  });

  describe('listClients', () => {
    test('returns paginated list of active clients', async () => {
      await createClient(db, { name: 'Client A' });
      await createClient(db, { name: 'Client B' });
      await createClient(db, { name: 'Client C' });

      const result = await listClients(db, { limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBeDefined();
    });

    test('filters by status', async () => {
      const active = await createClient(db, { name: 'Active Client' });
      const suspended = await createClient(db, { name: 'Suspended Client' });
      await suspendClient(db, suspended.id);

      const result = await listClients(db, { status: ClientStatus.SUSPENDED });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(suspended.id);
    });

    test('excludes deleted clients by default', async () => {
      await createClient(db, { name: 'Active' });
      const toDelete = await createClient(db, { name: 'To Delete' });
      await deleteClient(db, toDelete.id);

      const result = await listClients(db);

      expect(result.items).toHaveLength(1);
      expect(result.items.every(c => c.status !== ClientStatus.DELETED)).toBe(true);
    });
  });

  describe('activateClient', () => {
    test('activates a suspended client', async () => {
      const client = await createClient(db, { name: 'Suspended' });
      await suspendClient(db, client.id);

      const activated = await activateClient(db, client.id);

      expect(activated.status).toBe(ClientStatus.ACTIVE);
    });
  });

  describe('suspendClient', () => {
    test('suspends an active client', async () => {
      const client = await createClient(db, { name: 'Active' });

      const suspended = await suspendClient(db, client.id);

      expect(suspended.status).toBe(ClientStatus.SUSPENDED);
    });

    test('records suspension reason', async () => {
      const client = await createClient(db, { name: 'Active' });

      const suspended = await suspendClient(db, client.id, 'Payment overdue');

      expect(suspended.suspensionReason).toBe('Payment overdue');
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Domain Package

```bash
mkdir -p packages/domain/src

cat > packages/domain/package.json << 'EOF'
{
  "name": "@rtv/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./client": {
      "types": "./dist/client.d.ts",
      "import": "./dist/client.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist .turbo",
    "dev": "tsc --watch",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@rtv/db": "workspace:*",
    "@rtv/types": "workspace:*",
    "@rtv/observability": "workspace:*",
    "nanoid": "^5.0.0",
    "slugify": "^1.6.6",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "vitest": "^1.2.0"
  }
}
EOF
```

#### Step 2: Create TypeScript Config

```bash
cat > packages/domain/tsconfig.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  "references": [
    { "path": "../types" },
    { "path": "../db" },
    { "path": "../observability" }
  ]
}
EOF
```

#### Step 3: Create Client Types

**File: `packages/domain/src/client/types.ts`**

```bash
mkdir -p packages/domain/src/client

cat > packages/domain/src/client/types.ts << 'EOF'
/**
 * Client entity types
 */

import { z } from 'zod';

/**
 * Client status enum
 */
export const ClientStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
  PENDING: 'pending',
} as const;

export type ClientStatusType = (typeof ClientStatus)[keyof typeof ClientStatus];

/**
 * Client settings schema
 */
export const clientSettingsSchema = z.object({
  timezone: z.string().default('UTC'),
  defaultLanguage: z.string().default('en'),
  features: z.record(z.boolean()).default({}),
  notifications: z.object({
    email: z.boolean().default(true),
    slack: z.boolean().default(false),
  }).default({}),
}).default({});

export type ClientSettings = z.infer<typeof clientSettingsSchema>;

/**
 * Client entity
 */
export interface Client {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: ClientStatusType;
  readonly settings: ClientSettings;
  readonly suspensionReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

/**
 * Create client input
 */
export const createClientInputSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(255, 'Client name must be 255 characters or less'),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  settings: clientSettingsSchema.optional(),
});

export type CreateClientInput = z.infer<typeof createClientInputSchema>;

/**
 * Update client input
 */
export const updateClientInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  settings: clientSettingsSchema.partial().optional(),
});

export type UpdateClientInput = z.infer<typeof updateClientInputSchema>;

/**
 * List clients options
 */
export interface ListClientsOptions {
  limit?: number;
  cursor?: string;
  status?: ClientStatusType;
  includeDeleted?: boolean;
}

/**
 * Paginated list result
 */
export interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  cursor: string | null;
  total?: number;
}
EOF
```

#### Step 4: Create Client Repository

**File: `packages/domain/src/client/repository.ts`**

```bash
cat > packages/domain/src/client/repository.ts << 'EOF'
/**
 * Client repository - database operations
 */

import { eq, and, ne, isNull, sql, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import slugify from 'slugify';
import type { DbType } from '@rtv/db';
import { clients } from '@rtv/db/schema';
import { createModuleLogger } from '@rtv/observability';
import {
  type Client,
  type CreateClientInput,
  type UpdateClientInput,
  type ListClientsOptions,
  type PaginatedResult,
  ClientStatus,
  createClientInputSchema,
  updateClientInputSchema,
  clientSettingsSchema,
} from './types';

const logger = createModuleLogger('client-repository');

/**
 * Map database row to Client entity
 */
function mapToClient(row: typeof clients.$inferSelect): Client {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status as Client['status'],
    settings: clientSettingsSchema.parse(row.settings ?? {}),
    suspensionReason: row.suspensionReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/**
 * Generate a unique slug from name
 */
function generateSlug(name: string): string {
  return slugify(name, { lower: true, strict: true });
}

/**
 * Create a new client
 */
export async function createClient(
  db: DbType,
  input: CreateClientInput
): Promise<Client> {
  const validated = createClientInputSchema.parse(input);
  const slug = validated.slug ?? generateSlug(validated.name);

  // Check for duplicate name
  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.name, validated.name),
        ne(clients.status, ClientStatus.DELETED)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error('Client with this name already exists');
  }

  const id = nanoid();
  const now = new Date();

  const [inserted] = await db
    .insert(clients)
    .values({
      id,
      name: validated.name,
      slug,
      description: validated.description ?? null,
      status: ClientStatus.ACTIVE,
      settings: validated.settings ?? {},
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ clientId: id, name: validated.name }, 'Client created');

  return mapToClient(inserted);
}

/**
 * Get a client by ID
 */
export async function getClient(
  db: DbType,
  id: string
): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  return row ? mapToClient(row) : null;
}

/**
 * Get a client by name
 */
export async function getClientByName(
  db: DbType,
  name: string
): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.name, name),
        ne(clients.status, ClientStatus.DELETED)
      )
    )
    .limit(1);

  return row ? mapToClient(row) : null;
}

/**
 * Get a client by slug
 */
export async function getClientBySlug(
  db: DbType,
  slug: string
): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.slug, slug),
        ne(clients.status, ClientStatus.DELETED)
      )
    )
    .limit(1);

  return row ? mapToClient(row) : null;
}

/**
 * Update a client
 */
export async function updateClient(
  db: DbType,
  id: string,
  input: UpdateClientInput
): Promise<Client> {
  const validated = updateClientInputSchema.parse(input);

  // Check client exists
  const existing = await getClient(db, id);
  if (!existing) {
    throw new Error('Client not found');
  }

  // Check for duplicate name if name is being changed
  if (validated.name && validated.name !== existing.name) {
    const duplicate = await db
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          eq(clients.name, validated.name),
          ne(clients.id, id),
          ne(clients.status, ClientStatus.DELETED)
        )
      )
      .limit(1);

    if (duplicate.length > 0) {
      throw new Error('Client with this name already exists');
    }
  }

  const updateData: Partial<typeof clients.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.slug !== undefined) updateData.slug = validated.slug;
  if (validated.description !== undefined) updateData.description = validated.description;
  if (validated.settings !== undefined) {
    updateData.settings = { ...existing.settings, ...validated.settings };
  }

  const [updated] = await db
    .update(clients)
    .set(updateData)
    .where(eq(clients.id, id))
    .returning();

  logger.info({ clientId: id }, 'Client updated');

  return mapToClient(updated);
}

/**
 * Soft delete a client
 */
export async function deleteClient(
  db: DbType,
  id: string
): Promise<Client> {
  const existing = await getClient(db, id);
  if (!existing) {
    throw new Error('Client not found');
  }

  const now = new Date();

  const [deleted] = await db
    .update(clients)
    .set({
      status: ClientStatus.DELETED,
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(clients.id, id))
    .returning();

  logger.info({ clientId: id }, 'Client deleted');

  return mapToClient(deleted);
}

/**
 * List clients with pagination
 */
export async function listClients(
  db: DbType,
  options: ListClientsOptions = {}
): Promise<PaginatedResult<Client>> {
  const { limit = 20, cursor, status, includeDeleted = false } = options;

  const conditions = [];

  if (!includeDeleted) {
    conditions.push(ne(clients.status, ClientStatus.DELETED));
  }

  if (status) {
    conditions.push(eq(clients.status, status));
  }

  if (cursor) {
    conditions.push(sql`${clients.createdAt} < ${new Date(cursor)}`);
  }

  const rows = await db
    .select()
    .from(clients)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(clients.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(mapToClient);
  const lastItem = items[items.length - 1];

  return {
    items,
    hasMore,
    cursor: hasMore && lastItem ? lastItem.createdAt.toISOString() : null,
  };
}

/**
 * Activate a client
 */
export async function activateClient(
  db: DbType,
  id: string
): Promise<Client> {
  const existing = await getClient(db, id);
  if (!existing) {
    throw new Error('Client not found');
  }

  const [activated] = await db
    .update(clients)
    .set({
      status: ClientStatus.ACTIVE,
      suspensionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, id))
    .returning();

  logger.info({ clientId: id }, 'Client activated');

  return mapToClient(activated);
}

/**
 * Suspend a client
 */
export async function suspendClient(
  db: DbType,
  id: string,
  reason?: string
): Promise<Client> {
  const existing = await getClient(db, id);
  if (!existing) {
    throw new Error('Client not found');
  }

  const [suspended] = await db
    .update(clients)
    .set({
      status: ClientStatus.SUSPENDED,
      suspensionReason: reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, id))
    .returning();

  logger.info({ clientId: id, reason }, 'Client suspended');

  return mapToClient(suspended);
}
EOF
```

#### Step 5: Create Client Index

**File: `packages/domain/src/client/index.ts`**

```bash
cat > packages/domain/src/client/index.ts << 'EOF'
/**
 * Client entity module
 */

export {
  createClient,
  getClient,
  getClientByName,
  getClientBySlug,
  updateClient,
  deleteClient,
  listClients,
  activateClient,
  suspendClient,
} from './repository';

export {
  ClientStatus,
  clientSettingsSchema,
  createClientInputSchema,
  updateClientInputSchema,
  type Client,
  type ClientStatusType,
  type ClientSettings,
  type CreateClientInput,
  type UpdateClientInput,
  type ListClientsOptions,
  type PaginatedResult,
} from './types';
EOF
```

#### Step 6: Create Package Index

**File: `packages/domain/src/index.ts`**

```bash
cat > packages/domain/src/index.ts << 'EOF'
/**
 * @rtv/domain - Domain models and business logic
 */

// Client
export * from './client';
EOF
```

### Phase 3: Verification

```bash
cd packages/domain

# Install dependencies
pnpm install

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
| Create | `packages/domain/package.json` | Package manifest |
| Create | `packages/domain/tsconfig.json` | TypeScript config |
| Create | `packages/domain/src/client/types.ts` | Client types |
| Create | `packages/domain/src/client/repository.ts` | Client CRUD |
| Create | `packages/domain/src/client/index.ts` | Client exports |
| Create | `packages/domain/src/index.ts` | Package exports |
| Create | `packages/domain/src/__tests__/client.test.ts` | Client tests |

---

## Acceptance Criteria

- [ ] `createClient()` creates with validation
- [ ] `getClient()` retrieves by ID
- [ ] `updateClient()` updates with validation
- [ ] `deleteClient()` soft deletes
- [ ] `listClients()` paginated with filters
- [ ] `activateClient()` / `suspendClient()` status changes
- [ ] Duplicate name prevention
- [ ] Auto-slug generation
- [ ] All tests pass

---

## Test Requirements

### Unit Tests

- CRUD operations work correctly
- Validation errors thrown
- Duplicate prevention works
- Pagination works
- Status transitions work

### Integration Tests

- Database constraints enforced
- Concurrent operations safe

---

## Security & Safety Checklist

- [ ] No sensitive data in client settings
- [ ] Slug sanitized for URL safety
- [ ] Soft delete preserves audit trail
- [ ] Deletion reason logged

---

## JSON Task Block

```json
{
  "task_id": "S1-A1",
  "name": "Client Entity Model",
  "sprint": 1,
  "agent": "A",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 3,
  "dependencies": ["S0-B2"],
  "blocks": ["S1-A2", "S1-A3", "S1-A4", "S1-A5"],
  "tags": ["domain", "entity", "client"],
  "acceptance_criteria": [
    "CRUD operations work",
    "validation enforced",
    "pagination works",
    "status management works"
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

1. **S1-A2**: Create BrandKit entity model
2. **S1-A3**: Create KnowledgeBase entity model
3. **S1-A4**: Create Offer entity model
