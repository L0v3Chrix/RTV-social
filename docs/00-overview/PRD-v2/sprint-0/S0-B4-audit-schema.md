# Build Prompt: S0-B4 — Audit Event Schema

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-B4 |
| **Sprint** | 0 — Foundation |
| **Agent** | B — Database Schema |
| **Complexity** | Medium |
| **Estimated Effort** | 2-3 hours |
| **Dependencies** | S0-B2, S0-B3 |
| **Blocks** | S0-D3 (Audit Framework) |

---

## Context

### What We're Building

Create the `audit_events` table that stores an immutable log of all significant system actions, especially side effects like publishing, API calls, and data modifications.

### Why This Matters

- **Accountability**: Know who did what and when
- **Debugging**: Trace issues back to their source
- **Compliance**: Maintain audit trail for security reviews
- **Proof**: Store evidence of actions (screenshots, API responses)

### Spec References

- `/docs/01-architecture/system-architecture-v3.md#7-audit-trail`
- `/docs/05-policy-safety/side-effect-safety-spec.md#3-proof-capture`
- `/docs/06-reliability-ops/observability-dashboard.md#4-audit-events`

**Critical Constraint (from side-effect-safety-spec.md):**
> Every side effect MUST emit an AuditEvent with:
> - `action_type`: The operation performed
> - `target_ref`: What was affected
> - `proof`: Evidence the action completed (screenshot, API response)
> - `outcome`: success | failure | partial

---

## Prerequisites

### Completed Tasks

- [x] S0-B2: Core schema migrations
- [x] S0-B3: Multi-tenant schema

### Required Files

- `packages/db/src/schema/` exists
- Tenant utilities created

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/db/src/__tests__/audit.test.ts`**

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { db, closeConnection } from '../connection';
import { clients, auditEvents } from '../schema';
import { eq } from 'drizzle-orm';

describe('Audit Events Schema', () => {
  let testClient: { id: string };

  beforeAll(async () => {
    [testClient] = await db.insert(clients).values({
      name: 'Audit Test Client',
      slug: 'audit-test-' + Date.now(),
      settings: {},
    }).returning();
  });

  afterAll(async () => {
    await db.delete(auditEvents).where(eq(auditEvents.clientId, testClient.id));
    await db.delete(clients).where(eq(clients.id, testClient.id));
    await closeConnection();
  });

  test('auditEvents table has required columns', () => {
    expect(auditEvents.id).toBeDefined();
    expect(auditEvents.clientId).toBeDefined();
    expect(auditEvents.actionType).toBeDefined();
    expect(auditEvents.targetType).toBeDefined();
    expect(auditEvents.targetId).toBeDefined();
    expect(auditEvents.outcome).toBeDefined();
    expect(auditEvents.proof).toBeDefined();
  });

  test('can insert audit event', async () => {
    const [event] = await db.insert(auditEvents).values({
      clientId: testClient.id,
      actionType: 'content.publish',
      actorType: 'system',
      actorId: 'runner-123',
      targetType: 'post',
      targetId: 'post-456',
      outcome: 'success',
      proof: {
        type: 'api_response',
        data: { postId: 'ig_123', url: 'https://instagram.com/p/xyz' },
      },
      metadata: {
        platform: 'instagram',
        durationMs: 1234,
      },
    }).returning();

    expect(event.id).toBeDefined();
    expect(event.actionType).toBe('content.publish');
    expect(event.outcome).toBe('success');
    expect(event.proof.type).toBe('api_response');
  });

  test('audit events are immutable (no update)', async () => {
    const [event] = await db.insert(auditEvents).values({
      clientId: testClient.id,
      actionType: 'test.event',
      actorType: 'user',
      actorId: 'user-123',
      targetType: 'test',
      targetId: 'test-1',
      outcome: 'success',
    }).returning();

    // Attempting to update should be prevented by policy/trigger
    // For now, we test that the schema doesn't have updatedAt
    expect((auditEvents as any).updatedAt).toBeUndefined();

    // Cleanup
    await db.delete(auditEvents).where(eq(auditEvents.id, event.id));
  });

  test('can query audit events by action type', async () => {
    await db.insert(auditEvents).values([
      {
        clientId: testClient.id,
        actionType: 'content.create',
        actorType: 'agent',
        actorId: 'copy-agent',
        targetType: 'asset',
        targetId: 'asset-1',
        outcome: 'success',
      },
      {
        clientId: testClient.id,
        actionType: 'content.publish',
        actorType: 'agent',
        actorId: 'publisher-agent',
        targetType: 'post',
        targetId: 'post-1',
        outcome: 'success',
      },
    ]);

    const publishEvents = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.actionType, 'content.publish'));

    expect(publishEvents.length).toBeGreaterThanOrEqual(1);
    expect(publishEvents.every(e => e.actionType === 'content.publish')).toBe(true);
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Audit Events Schema

**File: `packages/db/src/schema/audit-events.ts`**

```bash
cat > packages/db/src/schema/audit-events.ts << 'EOF'
/**
 * Audit Events table schema
 *
 * Immutable log of all significant system actions.
 * Every side effect must emit an audit event with proof.
 *
 * @see /docs/05-policy-safety/side-effect-safety-spec.md
 */

import { pgTable, varchar, jsonb, timestamp, index, foreignKey, pgEnum } from 'drizzle-orm/pg-core';
import { idColumn, clientIdColumn } from './common';
import { clients } from './clients';

/**
 * Audit action types
 */
export const auditActionTypes = [
  // Content lifecycle
  'content.plan',
  'content.create',
  'content.approve',
  'content.schedule',
  'content.publish',
  'content.verify',
  'content.delete',

  // Engagement
  'engagement.receive',
  'engagement.draft',
  'engagement.send',
  'engagement.escalate',

  // System
  'system.config_change',
  'system.kill_switch',
  'system.policy_violation',

  // Auth
  'auth.login',
  'auth.logout',
  'auth.permission_change',

  // Data
  'data.export',
  'data.import',
  'data.delete',
] as const;

export type AuditActionType = (typeof auditActionTypes)[number] | string;

/**
 * Actor types
 */
export type AuditActorType = 'user' | 'agent' | 'system' | 'webhook';

/**
 * Outcome types
 */
export const outcomeEnum = pgEnum('audit_outcome', ['success', 'failure', 'partial', 'pending']);

/**
 * Proof of action completion
 */
export interface AuditProof {
  type: 'screenshot' | 'api_response' | 'hash' | 'url' | 'none';
  data?: Record<string, unknown>;
  url?: string;
  hash?: string;
  capturedAt?: string;
}

/**
 * Audit event metadata
 */
export interface AuditMetadata {
  platform?: string;
  lane?: 'api' | 'browser';
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
  episodeId?: string;
  [key: string]: unknown;
}

/**
 * Audit Events table
 *
 * This table is append-only. Events cannot be updated or deleted
 * (enforced by application code and optionally by triggers).
 */
export const auditEvents = pgTable('audit_events', {
  id: idColumn(),
  clientId: clientIdColumn(),

  // What happened
  actionType: varchar('action_type', { length: 100 }).notNull(),

  // Who did it
  actorType: varchar('actor_type', { length: 50 }).$type<AuditActorType>().notNull(),
  actorId: varchar('actor_id', { length: 255 }).notNull(),

  // What was affected
  targetType: varchar('target_type', { length: 100 }).notNull(),
  targetId: varchar('target_id', { length: 255 }).notNull(),

  // Result
  outcome: outcomeEnum('outcome').notNull(),

  // Evidence
  proof: jsonb('proof').$type<AuditProof>().default({ type: 'none' }).notNull(),

  // Additional context
  metadata: jsonb('metadata').$type<AuditMetadata>().default({}).notNull(),

  // Correlation
  correlationId: varchar('correlation_id', { length: 100 }),
  parentEventId: varchar('parent_event_id', { length: 36 }),

  // Timing (no updatedAt - immutable)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Foreign key to clients
  clientFk: foreignKey({
    columns: [table.clientId],
    foreignColumns: [clients.id],
    name: 'audit_events_client_id_fk',
  }),

  // Indexes for common queries
  clientIdx: index('audit_events_client_id_idx').on(table.clientId),
  actionTypeIdx: index('audit_events_action_type_idx').on(table.actionType),
  actorIdx: index('audit_events_actor_idx').on(table.actorType, table.actorId),
  targetIdx: index('audit_events_target_idx').on(table.targetType, table.targetId),
  outcomeIdx: index('audit_events_outcome_idx').on(table.outcome),
  createdAtIdx: index('audit_events_created_at_idx').on(table.createdAt),
  correlationIdx: index('audit_events_correlation_idx').on(table.correlationId),
}));

/**
 * Audit Event insert type
 */
export type NewAuditEvent = typeof auditEvents.$inferInsert;

/**
 * Audit Event select type
 */
export type AuditEvent = typeof auditEvents.$inferSelect;
EOF
```

#### Step 2: Create Audit Event Helpers

**File: `packages/db/src/audit.ts`**

```bash
cat > packages/db/src/audit.ts << 'EOF'
/**
 * Audit event creation helpers
 *
 * Provides type-safe methods for creating audit events.
 */

import { db } from './connection';
import { auditEvents, type NewAuditEvent, type AuditProof, type AuditMetadata, type AuditActorType } from './schema/audit-events';

/**
 * Options for creating an audit event
 */
export interface CreateAuditEventOptions {
  clientId: string;
  actionType: string;
  actorType: AuditActorType;
  actorId: string;
  targetType: string;
  targetId: string;
  outcome: 'success' | 'failure' | 'partial' | 'pending';
  proof?: AuditProof;
  metadata?: AuditMetadata;
  correlationId?: string;
  parentEventId?: string;
}

/**
 * Create an audit event
 */
export async function createAuditEvent(options: CreateAuditEventOptions) {
  const event: NewAuditEvent = {
    clientId: options.clientId,
    actionType: options.actionType,
    actorType: options.actorType,
    actorId: options.actorId,
    targetType: options.targetType,
    targetId: options.targetId,
    outcome: options.outcome,
    proof: options.proof ?? { type: 'none' },
    metadata: options.metadata ?? {},
    correlationId: options.correlationId,
    parentEventId: options.parentEventId,
  };

  const [created] = await db.insert(auditEvents).values(event).returning();
  return created;
}

/**
 * Builder pattern for creating audit events
 */
export class AuditEventBuilder {
  private event: Partial<CreateAuditEventOptions> = {};

  forClient(clientId: string): this {
    this.event.clientId = clientId;
    return this;
  }

  action(actionType: string): this {
    this.event.actionType = actionType;
    return this;
  }

  actor(type: AuditActorType, id: string): this {
    this.event.actorType = type;
    this.event.actorId = id;
    return this;
  }

  target(type: string, id: string): this {
    this.event.targetType = type;
    this.event.targetId = id;
    return this;
  }

  succeeded(): this {
    this.event.outcome = 'success';
    return this;
  }

  failed(errorCode?: string, errorMessage?: string): this {
    this.event.outcome = 'failure';
    this.event.metadata = {
      ...this.event.metadata,
      errorCode,
      errorMessage,
    };
    return this;
  }

  partial(): this {
    this.event.outcome = 'partial';
    return this;
  }

  withProof(proof: AuditProof): this {
    this.event.proof = proof;
    return this;
  }

  withApiProof(data: Record<string, unknown>): this {
    this.event.proof = { type: 'api_response', data };
    return this;
  }

  withScreenshotProof(url: string): this {
    this.event.proof = { type: 'screenshot', url, capturedAt: new Date().toISOString() };
    return this;
  }

  withMetadata(metadata: AuditMetadata): this {
    this.event.metadata = { ...this.event.metadata, ...metadata };
    return this;
  }

  withCorrelation(correlationId: string): this {
    this.event.correlationId = correlationId;
    return this;
  }

  childOf(parentEventId: string): this {
    this.event.parentEventId = parentEventId;
    return this;
  }

  async emit() {
    if (!this.event.clientId) throw new Error('clientId is required');
    if (!this.event.actionType) throw new Error('actionType is required');
    if (!this.event.actorType) throw new Error('actorType is required');
    if (!this.event.actorId) throw new Error('actorId is required');
    if (!this.event.targetType) throw new Error('targetType is required');
    if (!this.event.targetId) throw new Error('targetId is required');
    if (!this.event.outcome) throw new Error('outcome is required');

    return createAuditEvent(this.event as CreateAuditEventOptions);
  }
}

/**
 * Start building an audit event
 */
export function auditEvent(): AuditEventBuilder {
  return new AuditEventBuilder();
}
EOF
```

#### Step 3: Update Schema Index

**File: `packages/db/src/schema/index.ts`** (update)

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

// Audit
export * from './audit-events';

// Table references for Drizzle queries
import { clients } from './clients';
import { brandKits } from './brand-kits';
import { knowledgeBases, knowledgeChunks } from './knowledge-bases';
import { auditEvents } from './audit-events';

export const schema = {
  clients,
  brandKits,
  knowledgeBases,
  knowledgeChunks,
  auditEvents,
};
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

// Audit
export {
  createAuditEvent,
  auditEvent,
  AuditEventBuilder,
  type CreateAuditEventOptions,
} from './audit';
EOF
```

#### Step 5: Generate Migration

```bash
cd packages/db
pnpm db:generate
```

### Phase 3: Verification

```bash
cd packages/db

# Build
pnpm build

# Typecheck
pnpm typecheck

# Run migration
pnpm db:migrate

# Run tests
pnpm test

# Verify table exists
psql $DATABASE_URL -c "\d audit_events"

# Verify indexes
psql $DATABASE_URL -c "\di audit_events*"
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/db/src/schema/audit-events.ts` | Audit events table |
| Create | `packages/db/src/audit.ts` | Audit event helpers |
| Modify | `packages/db/src/schema/index.ts` | Export audit schema |
| Modify | `packages/db/src/index.ts` | Export audit helpers |
| Create | `packages/db/src/__tests__/audit.test.ts` | Audit tests |
| Generate | `packages/db/src/migrations/*.sql` | Migration |

---

## Acceptance Criteria

- [ ] `audit_events` table created with all columns
- [ ] Outcome enum: success, failure, partial, pending
- [ ] Proof JSONB column for evidence storage
- [ ] Indexes on client_id, action_type, target, created_at
- [ ] `auditEvent()` builder helper works
- [ ] No `updatedAt` column (immutable)
- [ ] Audit tests pass

---

## Test Requirements

### Unit Tests

- Table has required columns
- Can insert audit events
- Builder pattern works

### Integration Tests

- Events can be queried by action type
- Events can be queried by time range
- Correlation queries work

---

## Security & Safety Checklist

- [ ] No PII in proof data
- [ ] client_id required
- [ ] No update capability
- [ ] Indexes for efficient querying
- [ ] Proof captures evidence

---

## JSON Task Block

```json
{
  "task_id": "S0-B4",
  "name": "Audit Event Schema",
  "sprint": 0,
  "agent": "B",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 3,
  "dependencies": ["S0-B2", "S0-B3"],
  "blocks": ["S0-D3"],
  "tags": ["database", "audit", "logging", "compliance"],
  "acceptance_criteria": [
    "audit_events table exists",
    "proof column captures evidence",
    "auditEvent builder works",
    "audit tests pass"
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

1. **S0-B5**: Write seed data scripts
2. **S0-D3**: Implement audit event framework (uses this schema)
