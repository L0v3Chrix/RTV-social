# Build Prompt: S0-B3 — Multi-Tenant Schema

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-B3 |
| **Sprint** | 0 — Foundation |
| **Agent** | B — Database Schema |
| **Complexity** | High |
| **Estimated Effort** | 3-4 hours |
| **Dependencies** | S0-B2 |
| **Blocks** | S0-B4, Sprint 1 |

---

## Context

### What We're Building

Implement Row-Level Security (RLS) and tenant isolation at the database level. This ensures that queries can never accidentally access another tenant's data.

### Why This Matters

- **Security**: Defense-in-depth at the data layer
- **Compliance**: Data isolation is non-negotiable
- **Bug prevention**: Wrong tenant access is impossible
- **Audit**: Clear tenant boundaries for logging

### Spec References

- `/docs/05-policy-safety/multi-tenant-isolation.md`
- `/docs/01-architecture/system-architecture-v3.md#6-isolation-model`

**Critical Constraint (from multi-tenant-isolation.md §2.1):**
> Deny-by-default: missing tenant context = operation fails closed. Every request, job, tool call, and side-effect must be scoped by:
> - `tenant_id` (required)
> - `platform_account_id` (required for platform actions)
> - `lane` (api|browser)

---

## Prerequisites

### Completed Tasks

- [x] S0-B1: Postgres connection setup
- [x] S0-B2: Core schema migrations

### Required Files

- All tables from S0-B2 exist
- `packages/db/src/schema/` populated

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/db/src/__tests__/multi-tenant.test.ts`**

```typescript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db, closeConnection } from '../connection';
import { clients, brandKits } from '../schema';
import { eq, and } from 'drizzle-orm';
import { withTenantScope, TenantScopedDb } from '../tenant';

describe('Multi-Tenant Isolation', () => {
  let clientA: { id: string };
  let clientB: { id: string };

  beforeAll(async () => {
    // Create two test clients
    [clientA] = await db.insert(clients).values({
      name: 'Client A',
      slug: 'client-a-' + Date.now(),
      settings: {},
    }).returning();

    [clientB] = await db.insert(clients).values({
      name: 'Client B',
      slug: 'client-b-' + Date.now(),
      settings: {},
    }).returning();

    // Create brand kits for each
    await db.insert(brandKits).values([
      {
        clientId: clientA.id,
        name: 'Brand A',
        tone: { voice: 'professional', personality: [] },
        colors: { primary: '#ff0000' },
        logoRefs: [],
      },
      {
        clientId: clientB.id,
        name: 'Brand B',
        tone: { voice: 'casual', personality: [] },
        colors: { primary: '#00ff00' },
        logoRefs: [],
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(brandKits).where(eq(brandKits.clientId, clientA.id));
    await db.delete(brandKits).where(eq(brandKits.clientId, clientB.id));
    await db.delete(clients).where(eq(clients.id, clientA.id));
    await db.delete(clients).where(eq(clients.id, clientB.id));
    await closeConnection();
  });

  test('withTenantScope only returns data for specified client', async () => {
    const scopedDb = withTenantScope(db, clientA.id);

    const kits = await scopedDb
      .select()
      .from(brandKits)
      .where(eq(brandKits.clientId, clientA.id));

    // Should only see Client A's brand kit
    expect(kits.length).toBe(1);
    expect(kits[0]?.name).toBe('Brand A');
  });

  test('scopedQuery helper adds client_id filter automatically', async () => {
    const { scopedQuery } = withTenantScope(db, clientA.id);

    const kits = await scopedQuery(brandKits);

    expect(kits.length).toBe(1);
    expect(kits.every(k => k.clientId === clientA.id)).toBe(true);
  });

  test('different tenants see different data', async () => {
    const dbA = withTenantScope(db, clientA.id);
    const dbB = withTenantScope(db, clientB.id);

    const kitsA = await dbA.scopedQuery(brandKits);
    const kitsB = await dbB.scopedQuery(brandKits);

    expect(kitsA[0]?.name).toBe('Brand A');
    expect(kitsB[0]?.name).toBe('Brand B');
  });

  test('insert automatically adds client_id', async () => {
    const scopedDb = withTenantScope(db, clientA.id);

    const [inserted] = await scopedDb.scopedInsert(brandKits, {
      name: 'Auto-scoped Brand',
      tone: { voice: 'friendly', personality: [] },
      colors: { primary: '#0000ff' },
      logoRefs: [],
    });

    expect(inserted.clientId).toBe(clientA.id);

    // Cleanup
    await db.delete(brandKits).where(eq(brandKits.id, inserted.id));
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Tenant Scope Utilities

**File: `packages/db/src/tenant.ts`**

```bash
cat > packages/db/src/tenant.ts << 'EOF'
/**
 * Multi-tenant database utilities
 *
 * Provides scoped database access that automatically filters by client_id.
 * This is the primary mechanism for tenant isolation at the data layer.
 *
 * @see /docs/05-policy-safety/multi-tenant-isolation.md
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { db as DbType } from './connection';

/**
 * Tenant context for database operations
 */
export interface TenantContext {
  clientId: string;
  userId?: string;
  correlationId?: string;
}

/**
 * Table with client_id column (required for tenant scoping)
 */
export interface TenantTable extends PgTable {
  clientId: PgColumn<{
    name: 'client_id';
    dataType: 'string';
    columnType: 'PgUUID';
    data: string;
    driverParam: string;
    notNull: true;
    hasDefault: false;
    enumValues: undefined;
    baseColumn: never;
  }>;
}

/**
 * Check if a table has a client_id column
 */
export function isTenantTable(table: PgTable): table is TenantTable {
  return 'clientId' in table && table.clientId !== undefined;
}

/**
 * Create a tenant-scoped database wrapper
 *
 * All queries through this wrapper are automatically filtered by client_id.
 *
 * @example
 * ```ts
 * const scopedDb = withTenantScope(db, 'client-123');
 * const brandKits = await scopedDb.scopedQuery(brandKits);
 * // Automatically filtered to client-123
 * ```
 */
export function withTenantScope(
  database: typeof DbType,
  clientId: string,
  options?: { userId?: string; correlationId?: string }
) {
  const context: TenantContext = {
    clientId,
    userId: options?.userId,
    correlationId: options?.correlationId ?? crypto.randomUUID(),
  };

  return {
    // Pass through the original db for raw operations
    db: database,

    // Tenant context
    context,

    /**
     * Query a tenant table with automatic client_id filtering
     */
    async scopedQuery<T extends TenantTable>(
      table: T,
      additionalWhere?: SQL
    ): Promise<T['$inferSelect'][]> {
      const baseWhere = eq(table.clientId, clientId);
      const where = additionalWhere
        ? and(baseWhere, additionalWhere)
        : baseWhere;

      return database
        .select()
        .from(table)
        .where(where) as Promise<T['$inferSelect'][]>;
    },

    /**
     * Insert into a tenant table with automatic client_id injection
     */
    async scopedInsert<T extends TenantTable>(
      table: T,
      values: Omit<T['$inferInsert'], 'clientId'>
    ): Promise<T['$inferSelect'][]> {
      const valuesWithClient = {
        ...values,
        clientId,
      } as T['$inferInsert'];

      return database
        .insert(table)
        .values(valuesWithClient)
        .returning() as Promise<T['$inferSelect'][]>;
    },

    /**
     * Update a tenant table with automatic client_id scoping
     */
    async scopedUpdate<T extends TenantTable>(
      table: T,
      values: Partial<Omit<T['$inferInsert'], 'clientId'>>,
      additionalWhere: SQL
    ): Promise<T['$inferSelect'][]> {
      const where = and(eq(table.clientId, clientId), additionalWhere);

      return database
        .update(table)
        .set(values as any)
        .where(where)
        .returning() as Promise<T['$inferSelect'][]>;
    },

    /**
     * Delete from a tenant table with automatic client_id scoping
     */
    async scopedDelete<T extends TenantTable>(
      table: T,
      additionalWhere: SQL
    ): Promise<T['$inferSelect'][]> {
      const where = and(eq(table.clientId, clientId), additionalWhere);

      return database
        .delete(table)
        .where(where)
        .returning() as Promise<T['$inferSelect'][]>;
    },

    /**
     * Execute a raw query with tenant context in transaction
     * The context is available for audit logging
     */
    async scopedTransaction<R>(
      callback: (tx: typeof database, ctx: TenantContext) => Promise<R>
    ): Promise<R> {
      return database.transaction(async (tx) => {
        return callback(tx as typeof database, context);
      });
    },
  };
}

/**
 * Type alias for scoped database
 */
export type TenantScopedDb = ReturnType<typeof withTenantScope>;

/**
 * Validate that a query result belongs to the expected tenant
 * Use this for defense-in-depth when working with raw queries
 */
export function assertTenantOwnership<T extends { clientId: string }>(
  record: T | null | undefined,
  expectedClientId: string,
  resourceType: string
): asserts record is T {
  if (!record) {
    throw new TenantAccessError(`${resourceType} not found`);
  }
  if (record.clientId !== expectedClientId) {
    throw new TenantAccessError(
      `${resourceType} does not belong to tenant ${expectedClientId}`
    );
  }
}

/**
 * Error thrown when tenant access is violated
 */
export class TenantAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantAccessError';
  }
}
EOF
```

#### Step 2: Create RLS Policies Migration

**File: `packages/db/src/migrations/rls-policies.sql`**

```bash
cat > packages/db/src/migrations/0002_rls_policies.sql << 'EOF'
-- Enable Row-Level Security on tenant tables
-- This provides database-level isolation as defense-in-depth

-- Note: RLS requires setting the current tenant context via session variables
-- SET app.current_tenant_id = 'uuid-here';

-- Enable RLS on brand_kits
ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY brand_kits_tenant_isolation ON brand_kits
  USING (client_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (client_id = current_setting('app.current_tenant_id', true)::uuid);

-- Enable RLS on knowledge_bases
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_bases_tenant_isolation ON knowledge_bases
  USING (client_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (client_id = current_setting('app.current_tenant_id', true)::uuid);

-- Enable RLS on knowledge_chunks
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_chunks_tenant_isolation ON knowledge_chunks
  USING (client_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (client_id = current_setting('app.current_tenant_id', true)::uuid);

-- Create a function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id::text, false);
END;
$$ LANGUAGE plpgsql;

-- Create a function to get current tenant
CREATE OR REPLACE FUNCTION get_current_tenant()
RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true)::uuid;
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON POLICY brand_kits_tenant_isolation ON brand_kits IS
  'Ensures brand_kits can only be accessed by the current tenant';
COMMENT ON POLICY knowledge_bases_tenant_isolation ON knowledge_bases IS
  'Ensures knowledge_bases can only be accessed by the current tenant';
COMMENT ON POLICY knowledge_chunks_tenant_isolation ON knowledge_chunks IS
  'Ensures knowledge_chunks can only be accessed by the current tenant';
EOF
```

#### Step 3: Create RLS Helper Functions

**File: `packages/db/src/rls.ts`**

```bash
cat > packages/db/src/rls.ts << 'EOF'
/**
 * Row-Level Security helpers
 *
 * These functions set the PostgreSQL session variables that RLS policies use.
 */

import { db, queryClient } from './connection';

/**
 * Set the current tenant context in the database session
 * Required for RLS policies to work
 */
export async function setTenantContext(clientId: string): Promise<void> {
  await queryClient`SELECT set_config('app.current_tenant_id', ${clientId}, false)`;
}

/**
 * Clear the current tenant context
 */
export async function clearTenantContext(): Promise<void> {
  await queryClient`SELECT set_config('app.current_tenant_id', '', false)`;
}

/**
 * Get the current tenant ID from session
 */
export async function getCurrentTenant(): Promise<string | null> {
  const result = await queryClient`SELECT current_setting('app.current_tenant_id', true) as tenant_id`;
  const tenantId = result[0]?.tenant_id;
  return tenantId && tenantId !== '' ? tenantId : null;
}

/**
 * Execute a function with tenant context set
 * Automatically clears context after execution
 */
export async function withRlsContext<T>(
  clientId: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    await setTenantContext(clientId);
    return await fn();
  } finally {
    await clearTenantContext();
  }
}

/**
 * Verify that RLS is enabled on a table
 */
export async function isRlsEnabled(tableName: string): Promise<boolean> {
  const result = await queryClient`
    SELECT relrowsecurity
    FROM pg_class
    WHERE relname = ${tableName}
  `;
  return result[0]?.relrowsecurity === true;
}
EOF
```

#### Step 4: Update Package Index

**File: `packages/db/src/index.ts`** (update)

```bash
cat > packages/db/src/index.ts << 'EOF'
/**
 * @rtv/db - Database package
 *
 * Provides database connection, schema, and tenant isolation
 * for the RTV Social Automation Platform.
 */

// Connection
export { db, testConnection, closeConnection, getPoolStats } from './connection';

// Schema
export * from './schema';

// Multi-tenancy
export {
  withTenantScope,
  assertTenantOwnership,
  TenantAccessError,
  type TenantContext,
  type TenantScopedDb,
} from './tenant';

// RLS helpers
export {
  setTenantContext,
  clearTenantContext,
  getCurrentTenant,
  withRlsContext,
  isRlsEnabled,
} from './rls';
EOF
```

### Phase 3: Verification

```bash
cd packages/db

# Build
pnpm build

# Typecheck
pnpm typecheck

# Run migration (if using drizzle-kit)
# Or apply the SQL manually:
# psql $DATABASE_URL -f src/migrations/0002_rls_policies.sql

# Run tests
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rtv_test" pnpm test

# Verify RLS is enabled
psql $DATABASE_URL -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('brand_kits', 'knowledge_bases', 'knowledge_chunks');"
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/db/src/tenant.ts` | Tenant scoping utilities |
| Create | `packages/db/src/rls.ts` | RLS helper functions |
| Create | `packages/db/src/migrations/0002_rls_policies.sql` | RLS policies |
| Modify | `packages/db/src/index.ts` | Export tenant utilities |
| Create | `packages/db/src/__tests__/multi-tenant.test.ts` | Isolation tests |

---

## Acceptance Criteria

- [ ] `withTenantScope()` function created
- [ ] All tenant queries automatically filtered by `client_id`
- [ ] RLS policies created for all tenant tables
- [ ] `setTenantContext()` and `clearTenantContext()` work
- [ ] `assertTenantOwnership()` validates ownership
- [ ] Multi-tenant tests pass
- [ ] Different tenants cannot see each other's data

---

## Test Requirements

### Unit Tests

- `withTenantScope` filters correctly
- `scopedInsert` adds client_id
- `assertTenantOwnership` throws on mismatch

### Integration Tests

- RLS policies block cross-tenant access
- Transaction maintains tenant context
- Concurrent requests for different tenants work

---

## Security & Safety Checklist

- [ ] RLS enabled on all tenant tables
- [ ] client_id cannot be omitted on insert
- [ ] Cross-tenant access throws error
- [ ] Audit events include tenant context
- [ ] No raw queries bypass scoping

---

## JSON Task Block

```json
{
  "task_id": "S0-B3",
  "name": "Multi-Tenant Schema",
  "sprint": 0,
  "agent": "B",
  "status": "pending",
  "complexity": "high",
  "estimated_hours": 4,
  "dependencies": ["S0-B2"],
  "blocks": ["S0-B4"],
  "tags": ["database", "multi-tenant", "rls", "security"],
  "acceptance_criteria": [
    "withTenantScope function exists",
    "RLS policies on all tenant tables",
    "cross-tenant access blocked",
    "multi-tenant tests pass"
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

1. **S0-B4**: Create audit event schema
2. **S0-B5**: Write seed data scripts
