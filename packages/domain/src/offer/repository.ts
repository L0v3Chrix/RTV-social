/**
 * Offer repository - database operations
 */

import { eq, and, ne, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { offers, clients } from '@rtv/db/schema';
import { createModuleLogger } from '@rtv/observability';
import {
  type Offer,
  type CreateOfferInput,
  type UpdateOfferInput,
  type ListOffersOptions,
  type OfferPaginatedResult,
  type ActivePeriod,
  OfferStatus,
  createOfferInputSchema,
  updateOfferInputSchema,
} from './types.js';

const logger = createModuleLogger('offer-repository');

/**
 * Map database row to Offer entity
 */
function mapToOffer(row: typeof offers.$inferSelect): Offer {
  let activePeriod: ActivePeriod | null = null;
  if (row.activePeriod) {
    const ap = row.activePeriod as { startDate: string; endDate?: string };
    activePeriod = {
      startDate: new Date(ap.startDate),
      endDate: ap.endDate ? new Date(ap.endDate) : undefined,
    };
  }

  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    type: row.type as Offer['type'],
    status: row.status as Offer['status'],
    headline: row.headline,
    description: row.description,
    cta: row.cta as Offer['cta'],
    activePeriod,
    pricing: row.pricing as Offer['pricing'],
    platformTargeting: row.platformTargeting as string[] | null,
    tags: (row.tags ?? []) as string[],
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
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
  db: PostgresJsDatabase,
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

  let activePeriodValue: { startDate: string; endDate?: string } | null = null;
  if (validated.activePeriod) {
    activePeriodValue = {
      startDate: validated.activePeriod.startDate.toISOString(),
    };
    if (validated.activePeriod.endDate) {
      activePeriodValue.endDate = validated.activePeriod.endDate.toISOString();
    }
  }

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
      cta: (validated.cta ?? null) as typeof offers.$inferInsert['cta'],
      activePeriod: activePeriodValue as typeof offers.$inferInsert['activePeriod'],
      pricing: (validated.pricing ?? null) as typeof offers.$inferInsert['pricing'],
      platformTargeting: (validated.platformTargeting ?? null) as typeof offers.$inferInsert['platformTargeting'],
      tags: (validated.tags ?? []) as typeof offers.$inferInsert['tags'],
      metadata: (validated.metadata ?? {}) as typeof offers.$inferInsert['metadata'],
      priority: validated.priority ?? 50,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!inserted) {
    throw new Error('Failed to create offer');
  }

  logger.info({ offerId: id, clientId: validated.clientId, name: validated.name }, 'Offer created');

  return mapToOffer(inserted);
}

/**
 * Get an offer by ID
 */
export async function getOffer(
  db: PostgresJsDatabase,
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
  db: PostgresJsDatabase,
  clientId: string,
  options: ListOffersOptions = {}
): Promise<OfferPaginatedResult<Offer>> {
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
  db: PostgresJsDatabase,
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
  db: PostgresJsDatabase,
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

  if (validated.name !== undefined) {
    updateData.name = validated.name;
  }
  if (validated.type !== undefined) {
    updateData.type = validated.type;
  }
  if (validated.headline !== undefined) {
    updateData.headline = validated.headline;
  }
  if (validated.description !== undefined) {
    updateData.description = validated.description;
  }
  if (validated.cta !== undefined) {
    updateData.cta = validated.cta as typeof offers.$inferInsert['cta'];
  }
  if (validated.activePeriod !== undefined) {
    if (validated.activePeriod === null) {
      updateData.activePeriod = null;
    } else {
      const period: { startDate: string; endDate?: string } = {
        startDate: validated.activePeriod.startDate.toISOString(),
      };
      if (validated.activePeriod.endDate) {
        period.endDate = validated.activePeriod.endDate.toISOString();
      }
      updateData.activePeriod = period as typeof offers.$inferInsert['activePeriod'];
    }
  }
  if (validated.pricing !== undefined) {
    updateData.pricing = validated.pricing as typeof offers.$inferInsert['pricing'];
  }
  if (validated.platformTargeting !== undefined) {
    updateData.platformTargeting = validated.platformTargeting as typeof offers.$inferInsert['platformTargeting'];
  }
  if (validated.tags !== undefined) {
    updateData.tags = validated.tags as typeof offers.$inferInsert['tags'];
  }
  if (validated.metadata !== undefined) {
    updateData.metadata = validated.metadata as typeof offers.$inferInsert['metadata'];
  }
  if (validated.priority !== undefined) {
    updateData.priority = validated.priority;
  }

  const [updated] = await db
    .update(offers)
    .set(updateData)
    .where(eq(offers.id, id))
    .returning();

  if (!updated) {
    throw new Error('Failed to update offer');
  }

  logger.info({ offerId: id }, 'Offer updated');

  return mapToOffer(updated);
}

/**
 * Activate an offer
 */
export async function activateOffer(
  db: PostgresJsDatabase,
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
  db: PostgresJsDatabase,
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
  db: PostgresJsDatabase,
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
