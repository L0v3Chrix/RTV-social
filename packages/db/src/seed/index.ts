/**
 * @rtv/db Seed Functions
 *
 * Functions to seed, clear, and reset the database with sample data.
 * All operations are idempotent - running twice won't duplicate data.
 */

import { eq } from 'drizzle-orm';
import { getDb, initializeConnection } from '../connection.js';
import { clients } from '../schema/clients.js';
import { brandKits } from '../schema/brand-kits.js';
import { knowledgeBases } from '../schema/knowledge-bases.js';
import { SEED_CLIENTS, type SeedClient } from './data.js';

/**
 * Seed result for tracking what was created
 */
export interface SeedResult {
  created: {
    clients: number;
    brandKits: number;
    knowledgeBases: number;
  };
  skipped: {
    clients: number;
  };
  errors: string[];
}

/**
 * Seed a single client with its brand kit and knowledge bases
 *
 * Uses slug-based idempotency: if client with slug exists, skip creation.
 */
async function seedClient(
  seedData: SeedClient,
  result: SeedResult
): Promise<string | null> {
  const db = getDb();

  // Check if client with this slug already exists (idempotency check)
  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.slug, seedData.slug))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  Skipping existing client: ${seedData.slug}`);
    result.skipped.clients++;
    return existing[0]?.id ?? null;
  }

  try {
    // Insert client
    const [newClient] = await db
      .insert(clients)
      .values({
        name: seedData.name,
        slug: seedData.slug,
        settings: seedData.settings,
        isActive: true,
      })
      .returning({ id: clients.id });

    if (!newClient) {
      result.errors.push(`Failed to create client: ${seedData.slug}`);
      return null;
    }

    const clientId = newClient.id;
    result.created.clients++;

    // Insert brand kit with new schema
    await db.insert(brandKits).values({
      clientId,
      voiceStyle: seedData.brandKit.voiceStyle,
      visualTokens: seedData.brandKit.visualTokens ?? null,
      complianceRules: seedData.brandKit.complianceRules ?? null,
      icp: seedData.brandKit.icp ?? null,
      version: 1,
    });
    result.created.brandKits++;

    // Insert knowledge base (one per client, new RLM schema)
    const { nanoid } = await import('nanoid');
    const faqs = seedData.knowledgeBase.faqs.map(faq => ({
      ...faq,
      id: nanoid(),
    }));
    const resources = seedData.knowledgeBase.resources.map(resource => ({
      ...resource,
      id: nanoid(),
    }));

    await db.insert(knowledgeBases).values({
      clientId,
      faqs,
      resources,
      sourceDocuments: [],
      retrievalConfig: {
        chunkSize: seedData.knowledgeBase.retrievalConfig?.chunkSize ?? 4096,
        chunkOverlap: seedData.knowledgeBase.retrievalConfig?.chunkOverlap ?? 256,
        maxResults: seedData.knowledgeBase.retrievalConfig?.maxResults ?? 10,
        similarityThreshold: seedData.knowledgeBase.retrievalConfig?.similarityThreshold ?? 0.5,
        reranking: seedData.knowledgeBase.retrievalConfig?.reranking ?? false,
        maxTokensPerRetrieval: seedData.knowledgeBase.retrievalConfig?.maxTokensPerRetrieval ?? 4000,
      },
      version: 1,
    });
    result.created.knowledgeBases++;

    console.log(`  Created client: ${seedData.slug}`);
    return clientId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Error seeding ${seedData.slug}: ${message}`);
    return null;
  }
}

/**
 * Seed the database with sample data
 *
 * Idempotent: Running multiple times won't duplicate data.
 * Checks for existing clients by slug before creating.
 */
export async function seed(): Promise<SeedResult> {
  console.log('Starting database seed...');

  initializeConnection();

  const result: SeedResult = {
    created: { clients: 0, brandKits: 0, knowledgeBases: 0 },
    skipped: { clients: 0 },
    errors: [],
  };

  for (const seedData of SEED_CLIENTS) {
    await seedClient(seedData, result);
  }

  console.log('\nSeed complete!');
  console.log(`  Created: ${result.created.clients} clients, ${result.created.brandKits} brand kits, ${result.created.knowledgeBases} knowledge bases`);
  console.log(`  Skipped: ${result.skipped.clients} existing clients`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((err) => console.log(`  - ${err}`));
  }

  return result;
}

/**
 * Clear all seed data from the database
 *
 * Removes all clients with slugs matching SEED_CLIENTS.
 * Cascades to delete related brand kits and knowledge bases.
 */
export async function clearSeedData(): Promise<{
  deleted: { clients: number };
  errors: string[];
}> {
  console.log('Clearing seed data...');

  initializeConnection();
  const db = getDb();

  const result = {
    deleted: { clients: 0 },
    errors: [] as string[],
  };

  const seedSlugs = SEED_CLIENTS.map((c) => c.slug);

  for (const slug of seedSlugs) {
    try {
      const deleted = await db
        .delete(clients)
        .where(eq(clients.slug, slug))
        .returning({ id: clients.id });

      if (deleted.length > 0) {
        result.deleted.clients++;
        console.log(`  Deleted client: ${slug}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error deleting ${slug}: ${message}`);
    }
  }

  console.log(`\nClear complete! Deleted ${result.deleted.clients} clients`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((err) => console.log(`  - ${err}`));
  }

  return result;
}

/**
 * Reset seed data (clear and re-seed)
 *
 * Combines clearSeedData and seed in a single operation.
 * Useful for resetting to a known state.
 */
export async function reseed(): Promise<{
  clearResult: Awaited<ReturnType<typeof clearSeedData>>;
  seedResult: SeedResult;
}> {
  console.log('Resetting seed data...\n');

  const clearResult = await clearSeedData();
  console.log(''); // blank line between operations
  const seedResult = await seed();

  return { clearResult, seedResult };
}

/**
 * Export seed data for external use
 */
export { SEED_CLIENTS, type SeedClient } from './data.js';
export { getSeedClientBySlug, getSeedClientSlugs } from './data.js';
