# Build Prompt: S1-A4 — Offer Entity Model

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-A4 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | A — Core Domain Models |
| **Complexity** | Medium |
| **Estimated Effort** | 2-3 hours |
| **Dependencies** | S1-A2 |
| **Blocks** | S1-A5 |

---

## Context

### What We're Building

Create the Offer entity model that represents active promotions, products, and services with CTAs for content generation.

### Why This Matters

- **Content context**: Offers drive what gets promoted in content
- **CTA generation**: Provides call-to-action templates
- **Scheduling**: Offers have active periods for seasonal content
- **Planning input**: Planner agent uses offers to propose content

### Spec References

- `/docs/01-architecture/system-architecture-v3.md#5.2-brand-knowledge`

**Critical Requirement (from system-architecture-v3.md):**
> BrandKit: voice/tone, ICP, **offers**, compliance, visual tokens

---

## Prerequisites

### Completed Tasks

- [x] S1-A2: BrandKit entity model

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/domain/src/__tests__/offer.test.ts`**

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDb } from '@rtv/db/testing';
import { createClient } from '../client';
import {
  createOffer,
  getOffer,
  listOffers,
  listActiveOffers,
  updateOffer,
  deleteOffer,
  activateOffer,
  deactivateOffer,
  type CreateOfferInput,
  type Offer,
  OfferStatus,
  OfferType,
} from '../offer';

describe('Offer Entity', () => {
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

  describe('createOffer', () => {
    test('creates an offer with required fields', async () => {
      const input: CreateOfferInput = {
        clientId,
        name: 'Summer Sale',
        type: OfferType.PROMOTION,
        headline: 'Save 20% this summer!',
        description: 'Get 20% off all products during our summer sale event.',
      };

      const offer = await createOffer(db, input);

      expect(offer.id).toBeDefined();
      expect(offer.clientId).toBe(clientId);
      expect(offer.name).toBe('Summer Sale');
      expect(offer.status).toBe(OfferStatus.DRAFT);
    });

    test('creates with CTA configuration', async () => {
      const offer = await createOffer(db, {
        clientId,
        name: 'Free Consultation',
        type: OfferType.SERVICE,
        headline: 'Book your free consultation',
        description: 'Get expert advice at no cost.',
        cta: {
          primary: {
            text: 'Book Now',
            url: 'https://example.com/book',
            action: 'calendar_booking',
          },
          secondary: {
            text: 'Learn More',
            url: 'https://example.com/services',
            action: 'link',
          },
        },
      });

      expect(offer.cta?.primary.text).toBe('Book Now');
      expect(offer.cta?.primary.action).toBe('calendar_booking');
    });

    test('creates with active period', async () => {
      const startDate = new Date('2025-06-01');
      const endDate = new Date('2025-08-31');

      const offer = await createOffer(db, {
        clientId,
        name: 'Summer Special',
        type: OfferType.PROMOTION,
        headline: 'Limited time offer',
        description: 'Available summer only.',
        activePeriod: { startDate, endDate },
      });

      expect(offer.activePeriod?.startDate).toEqual(startDate);
      expect(offer.activePeriod?.endDate).toEqual(endDate);
    });

    test('creates with pricing information', async () => {
      const offer = await createOffer(db, {
        clientId,
        name: 'Premium Package',
        type: OfferType.PRODUCT,
        headline: 'Get our premium package',
        description: 'Best value for your money.',
        pricing: {
          originalPrice: 199.99,
          salePrice: 149.99,
          currency: 'USD',
          discountPercent: 25,
        },
      });

      expect(offer.pricing?.salePrice).toBe(149.99);
      expect(offer.pricing?.discountPercent).toBe(25);
    });

    test('creates with platform targeting', async () => {
      const offer = await createOffer(db, {
        clientId,
        name: 'Instagram Exclusive',
        type: OfferType.PROMOTION,
        headline: 'Instagram followers special',
        description: 'Exclusive for our Instagram community.',
        platformTargeting: ['instagram', 'facebook'],
      });

      expect(offer.platformTargeting).toContain('instagram');
      expect(offer.platformTargeting).not.toContain('tiktok');
    });
  });

  describe('listOffers', () => {
    beforeEach(async () => {
      await createOffer(db, {
        clientId,
        name: 'Offer 1',
        type: OfferType.PRODUCT,
        headline: 'H1',
        description: 'D1',
      });
      await createOffer(db, {
        clientId,
        name: 'Offer 2',
        type: OfferType.SERVICE,
        headline: 'H2',
        description: 'D2',
      });
    });

    test('lists all offers for client', async () => {
      const result = await listOffers(db, clientId);

      expect(result.items).toHaveLength(2);
    });

    test('filters by type', async () => {
      const result = await listOffers(db, clientId, { type: OfferType.SERVICE });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe(OfferType.SERVICE);
    });

    test('filters by status', async () => {
      const offers = await listOffers(db, clientId);
      await activateOffer(db, offers.items[0].id);

      const activeResult = await listOffers(db, clientId, { status: OfferStatus.ACTIVE });
      expect(activeResult.items).toHaveLength(1);
    });
  });

  describe('listActiveOffers', () => {
    test('returns only active offers within date range', async () => {
      const now = new Date();
      const pastStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const futureEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const offer1 = await createOffer(db, {
        clientId,
        name: 'Current Offer',
        type: OfferType.PROMOTION,
        headline: 'Available now',
        description: 'Active offer',
        activePeriod: { startDate: pastStart, endDate: futureEnd },
      });
      await activateOffer(db, offer1.id);

      const offer2 = await createOffer(db, {
        clientId,
        name: 'Future Offer',
        type: OfferType.PROMOTION,
        headline: 'Coming soon',
        description: 'Not yet active',
        activePeriod: {
          startDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
          endDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        },
      });
      await activateOffer(db, offer2.id);

      const active = await listActiveOffers(db, clientId);

      expect(active).toHaveLength(1);
      expect(active[0].name).toBe('Current Offer');
    });
  });

  describe('updateOffer', () => {
    test('updates offer fields', async () => {
      const offer = await createOffer(db, {
        clientId,
        name: 'Original',
        type: OfferType.PRODUCT,
        headline: 'Original headline',
        description: 'Original description',
      });

      const updated = await updateOffer(db, offer.id, {
        name: 'Updated',
        headline: 'New headline',
      });

      expect(updated.name).toBe('Updated');
      expect(updated.headline).toBe('New headline');
      expect(updated.description).toBe('Original description');
    });
  });

  describe('activateOffer / deactivateOffer', () => {
    test('activates a draft offer', async () => {
      const offer = await createOffer(db, {
        clientId,
        name: 'Draft Offer',
        type: OfferType.PRODUCT,
        headline: 'H',
        description: 'D',
      });

      expect(offer.status).toBe(OfferStatus.DRAFT);

      const activated = await activateOffer(db, offer.id);

      expect(activated.status).toBe(OfferStatus.ACTIVE);
    });

    test('deactivates an active offer', async () => {
      const offer = await createOffer(db, {
        clientId,
        name: 'Active Offer',
        type: OfferType.PRODUCT,
        headline: 'H',
        description: 'D',
      });
      await activateOffer(db, offer.id);

      const deactivated = await deactivateOffer(db, offer.id);

      expect(deactivated.status).toBe(OfferStatus.INACTIVE);
    });
  });

  describe('deleteOffer', () => {
    test('soft deletes an offer', async () => {
      const offer = await createOffer(db, {
        clientId,
        name: 'To Delete',
        type: OfferType.PRODUCT,
        headline: 'H',
        description: 'D',
      });

      await deleteOffer(db, offer.id);

      const retrieved = await getOffer(db, offer.id);
      expect(retrieved?.status).toBe(OfferStatus.DELETED);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Offer Types

**File: `packages/domain/src/offer/types.ts`**

```bash
mkdir -p packages/domain/src/offer

cat > packages/domain/src/offer/types.ts << 'EOF'
/**
 * Offer entity types
 */

import { z } from 'zod';

/**
 * Offer status
 */
export const OfferStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DELETED: 'deleted',
} as const;

export type OfferStatusType = (typeof OfferStatus)[keyof typeof OfferStatus];

/**
 * Offer type
 */
export const OfferType = {
  PRODUCT: 'product',
  SERVICE: 'service',
  PROMOTION: 'promotion',
  EVENT: 'event',
  CONTENT: 'content',
} as const;

export type OfferTypeType = (typeof OfferType)[keyof typeof OfferType];

/**
 * CTA action types
 */
export const CTAAction = {
  LINK: 'link',
  CALENDAR_BOOKING: 'calendar_booking',
  FORM: 'form',
  DM: 'dm',
  PHONE: 'phone',
  EMAIL: 'email',
} as const;

export type CTAActionType = (typeof CTAAction)[keyof typeof CTAAction];

/**
 * CTA button schema
 */
export const ctaButtonSchema = z.object({
  text: z.string().min(1).max(50),
  url: z.string().url().optional(),
  action: z.nativeEnum(CTAAction),
  metadata: z.record(z.unknown()).optional(),
});

export type CTAButton = z.infer<typeof ctaButtonSchema>;

/**
 * CTA configuration
 */
export const ctaConfigSchema = z.object({
  primary: ctaButtonSchema,
  secondary: ctaButtonSchema.optional(),
});

export type CTAConfig = z.infer<typeof ctaConfigSchema>;

/**
 * Active period
 */
export const activePeriodSchema = z.object({
  startDate: z.date(),
  endDate: z.date().optional(),
});

export type ActivePeriod = z.infer<typeof activePeriodSchema>;

/**
 * Pricing information
 */
export const pricingSchema = z.object({
  originalPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  discountPercent: z.number().min(0).max(100).optional(),
  priceText: z.string().optional(), // For custom pricing display
});

export type Pricing = z.infer<typeof pricingSchema>;

/**
 * Offer entity
 */
export interface Offer {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly type: OfferTypeType;
  readonly status: OfferStatusType;
  readonly headline: string;
  readonly description: string;
  readonly cta: CTAConfig | null;
  readonly activePeriod: ActivePeriod | null;
  readonly pricing: Pricing | null;
  readonly platformTargeting: string[] | null;
  readonly tags: string[];
  readonly metadata: Record<string, unknown>;
  readonly priority: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

/**
 * Create offer input
 */
export const createOfferInputSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(255),
  type: z.nativeEnum(OfferType),
  headline: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  cta: ctaConfigSchema.optional(),
  activePeriod: activePeriodSchema.optional(),
  pricing: pricingSchema.optional(),
  platformTargeting: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

export type CreateOfferInput = z.infer<typeof createOfferInputSchema>;

/**
 * Update offer input
 */
export const updateOfferInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.nativeEnum(OfferType).optional(),
  headline: z.string().min(1).max(500).optional(),
  description: z.string().min(1).max(5000).optional(),
  cta: ctaConfigSchema.nullable().optional(),
  activePeriod: activePeriodSchema.nullable().optional(),
  pricing: pricingSchema.nullable().optional(),
  platformTargeting: z.array(z.string()).nullable().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

export type UpdateOfferInput = z.infer<typeof updateOfferInputSchema>;

/**
 * List offers options
 */
export interface ListOffersOptions {
  limit?: number;
  cursor?: string;
  type?: OfferTypeType;
  status?: OfferStatusType;
  tags?: string[];
}
EOF
```

#### Step 2: Create Offer Repository

**File: `packages/domain/src/offer/repository.ts`**

```bash
cat > packages/domain/src/offer/repository.ts << 'EOF'
/**
 * Offer repository - database operations
 */

import { eq, and, ne, desc, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DbType } from '@rtv/db';
import { offers, clients } from '@rtv/db/schema';
import { createModuleLogger } from '@rtv/observability';
import type { PaginatedResult } from '../client/types';
import {
  type Offer,
  type CreateOfferInput,
  type UpdateOfferInput,
  type ListOffersOptions,
  OfferStatus,
  createOfferInputSchema,
  updateOfferInputSchema,
} from './types';

const logger = createModuleLogger('offer-repository');

/**
 * Map database row to Offer entity
 */
function mapToOffer(row: typeof offers.$inferSelect): Offer {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    type: row.type as Offer['type'],
    status: row.status as Offer['status'],
    headline: row.headline,
    description: row.description,
    cta: row.cta as Offer['cta'],
    activePeriod: row.activePeriod ? {
      startDate: new Date((row.activePeriod as any).startDate),
      endDate: (row.activePeriod as any).endDate ? new Date((row.activePeriod as any).endDate) : undefined,
    } : null,
    pricing: row.pricing as Offer['pricing'],
    platformTargeting: row.platformTargeting as string[] | null,
    tags: (row.tags as string[]) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    priority: row.priority,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/**
 * Create a new offer
 */
export async function createOffer(
  db: DbType,
  input: CreateOfferInput
): Promise<Offer> {
  const validated = createOfferInputSchema.parse(input);

  // Verify client exists
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, validated.clientId))
    .limit(1);

  if (!client) {
    throw new Error('Client not found');
  }

  const id = nanoid();
  const now = new Date();

  const [inserted] = await db
    .insert(offers)
    .values({
      id,
      clientId: validated.clientId,
      name: validated.name,
      type: validated.type,
      status: OfferStatus.DRAFT,
      headline: validated.headline,
      description: validated.description,
      cta: validated.cta ?? null,
      activePeriod: validated.activePeriod ? {
        startDate: validated.activePeriod.startDate.toISOString(),
        endDate: validated.activePeriod.endDate?.toISOString(),
      } : null,
      pricing: validated.pricing ?? null,
      platformTargeting: validated.platformTargeting ?? null,
      tags: validated.tags ?? [],
      metadata: validated.metadata ?? {},
      priority: validated.priority ?? 50,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ offerId: id, clientId: validated.clientId, name: validated.name }, 'Offer created');

  return mapToOffer(inserted);
}

/**
 * Get an offer by ID
 */
export async function getOffer(
  db: DbType,
  id: string
): Promise<Offer | null> {
  const [row] = await db
    .select()
    .from(offers)
    .where(eq(offers.id, id))
    .limit(1);

  return row ? mapToOffer(row) : null;
}

/**
 * List offers for a client
 */
export async function listOffers(
  db: DbType,
  clientId: string,
  options: ListOffersOptions = {}
): Promise<PaginatedResult<Offer>> {
  const { limit = 20, cursor, type, status } = options;

  const conditions = [
    eq(offers.clientId, clientId),
    ne(offers.status, OfferStatus.DELETED),
  ];

  if (type) {
    conditions.push(eq(offers.type, type));
  }

  if (status) {
    conditions.push(eq(offers.status, status));
  }

  if (cursor) {
    conditions.push(sql`${offers.createdAt} < ${new Date(cursor)}`);
  }

  const rows = await db
    .select()
    .from(offers)
    .where(and(...conditions))
    .orderBy(desc(offers.priority), desc(offers.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(mapToOffer);
  const lastItem = items[items.length - 1];

  return {
    items,
    hasMore,
    cursor: hasMore && lastItem ? lastItem.createdAt.toISOString() : null,
  };
}

/**
 * List active offers for a client (within date range)
 */
export async function listActiveOffers(
  db: DbType,
  clientId: string,
  asOfDate: Date = new Date()
): Promise<Offer[]> {
  // Get all active offers for client
  const rows = await db
    .select()
    .from(offers)
    .where(
      and(
        eq(offers.clientId, clientId),
        eq(offers.status, OfferStatus.ACTIVE)
      )
    )
    .orderBy(desc(offers.priority));

  // Filter by date range in application code
  return rows
    .map(mapToOffer)
    .filter(offer => {
      if (!offer.activePeriod) return true;

      const { startDate, endDate } = offer.activePeriod;
      if (startDate > asOfDate) return false;
      if (endDate && endDate < asOfDate) return false;

      return true;
    });
}

/**
 * Update an offer
 */
export async function updateOffer(
  db: DbType,
  id: string,
  input: UpdateOfferInput
): Promise<Offer> {
  const validated = updateOfferInputSchema.parse(input);

  const existing = await getOffer(db, id);
  if (!existing) {
    throw new Error('Offer not found');
  }

  const updateData: Partial<typeof offers.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.type !== undefined) updateData.type = validated.type;
  if (validated.headline !== undefined) updateData.headline = validated.headline;
  if (validated.description !== undefined) updateData.description = validated.description;
  if (validated.cta !== undefined) updateData.cta = validated.cta;
  if (validated.activePeriod !== undefined) {
    updateData.activePeriod = validated.activePeriod ? {
      startDate: validated.activePeriod.startDate.toISOString(),
      endDate: validated.activePeriod.endDate?.toISOString(),
    } : null;
  }
  if (validated.pricing !== undefined) updateData.pricing = validated.pricing;
  if (validated.platformTargeting !== undefined) updateData.platformTargeting = validated.platformTargeting;
  if (validated.tags !== undefined) updateData.tags = validated.tags;
  if (validated.metadata !== undefined) updateData.metadata = validated.metadata;
  if (validated.priority !== undefined) updateData.priority = validated.priority;

  const [updated] = await db
    .update(offers)
    .set(updateData)
    .where(eq(offers.id, id))
    .returning();

  logger.info({ offerId: id }, 'Offer updated');

  return mapToOffer(updated);
}

/**
 * Activate an offer
 */
export async function activateOffer(
  db: DbType,
  id: string
): Promise<Offer> {
  const [updated] = await db
    .update(offers)
    .set({
      status: OfferStatus.ACTIVE,
      updatedAt: new Date(),
    })
    .where(eq(offers.id, id))
    .returning();

  if (!updated) {
    throw new Error('Offer not found');
  }

  logger.info({ offerId: id }, 'Offer activated');

  return mapToOffer(updated);
}

/**
 * Deactivate an offer
 */
export async function deactivateOffer(
  db: DbType,
  id: string
): Promise<Offer> {
  const [updated] = await db
    .update(offers)
    .set({
      status: OfferStatus.INACTIVE,
      updatedAt: new Date(),
    })
    .where(eq(offers.id, id))
    .returning();

  if (!updated) {
    throw new Error('Offer not found');
  }

  logger.info({ offerId: id }, 'Offer deactivated');

  return mapToOffer(updated);
}

/**
 * Soft delete an offer
 */
export async function deleteOffer(
  db: DbType,
  id: string
): Promise<Offer> {
  const now = new Date();

  const [updated] = await db
    .update(offers)
    .set({
      status: OfferStatus.DELETED,
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(offers.id, id))
    .returning();

  if (!updated) {
    throw new Error('Offer not found');
  }

  logger.info({ offerId: id }, 'Offer deleted');

  return mapToOffer(updated);
}
EOF
```

#### Step 3: Create Offer Index

**File: `packages/domain/src/offer/index.ts`**

```bash
cat > packages/domain/src/offer/index.ts << 'EOF'
/**
 * Offer entity module
 */

export {
  createOffer,
  getOffer,
  listOffers,
  listActiveOffers,
  updateOffer,
  activateOffer,
  deactivateOffer,
  deleteOffer,
} from './repository';

export {
  OfferStatus,
  OfferType,
  CTAAction,
  ctaButtonSchema,
  ctaConfigSchema,
  activePeriodSchema,
  pricingSchema,
  createOfferInputSchema,
  updateOfferInputSchema,
  type Offer,
  type OfferStatusType,
  type OfferTypeType,
  type CTAActionType,
  type CTAButton,
  type CTAConfig,
  type ActivePeriod,
  type Pricing,
  type CreateOfferInput,
  type UpdateOfferInput,
  type ListOffersOptions,
} from './types';
EOF
```

#### Step 4: Update Package Index

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

// Offer
export * from './offer';
EOF
```

### Phase 3: Verification

```bash
cd packages/domain
pnpm build && pnpm typecheck && pnpm test
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/domain/src/offer/types.ts` | Offer types |
| Create | `packages/domain/src/offer/repository.ts` | Offer CRUD |
| Create | `packages/domain/src/offer/index.ts` | Offer exports |
| Modify | `packages/domain/src/index.ts` | Add Offer export |
| Create | `packages/domain/src/__tests__/offer.test.ts` | Offer tests |

---

## Acceptance Criteria

- [ ] `createOffer()` creates with validation
- [ ] `listOffers()` filters by type/status
- [ ] `listActiveOffers()` respects date ranges
- [ ] `activateOffer()` / `deactivateOffer()` work
- [ ] CTA configuration stored correctly
- [ ] Pricing information stored correctly
- [ ] Platform targeting works
- [ ] All tests pass

---

## JSON Task Block

```json
{
  "task_id": "S1-A4",
  "name": "Offer Entity Model",
  "sprint": 1,
  "agent": "A",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 3,
  "dependencies": ["S1-A2"],
  "blocks": ["S1-A5"],
  "tags": ["domain", "entity", "offer"],
  "acceptance_criteria": [
    "CRUD operations work",
    "status transitions work",
    "date filtering works",
    "CTA configuration stored"
  ],
  "created_at": "2025-01-16T00:00:00Z"
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
