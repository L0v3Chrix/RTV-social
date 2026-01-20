/**
 * BrandKit repository - database operations
 */

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { brandKits, clients } from '@rtv/db/schema';
import { createModuleLogger } from '@rtv/observability';
import {
  type BrandKit,
  type CreateBrandKitInput,
  type UpdateBrandKitInput,
  type VoiceStyle,
  type VisualTokens,
  type ComplianceRules,
  type ICP,
  createBrandKitInputSchema,
  updateBrandKitInputSchema,
  voiceStyleSchema,
} from './types.js';

const logger = createModuleLogger('brandkit-repository');

/**
 * Map database row to BrandKit entity
 */
function mapToBrandKit(row: typeof brandKits.$inferSelect): BrandKit {
  return {
    id: row.id,
    clientId: row.clientId,
    voiceStyle: voiceStyleSchema.parse(row.voiceStyle ?? { tone: 'professional' }),
    visualTokens: row.visualTokens as VisualTokens | null,
    complianceRules: row.complianceRules as ComplianceRules | null,
    icp: row.icp as ICP | null,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Create a new brandkit
 */
export async function createBrandKit(
  db: PostgresJsDatabase,
  input: CreateBrandKitInput
): Promise<BrandKit> {
  const validated = createBrandKitInputSchema.parse(input);

  // Verify client exists
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, validated.clientId))
    .limit(1);

  if (!client) {
    throw new Error('Client not found');
  }

  // Check for existing brandkit
  const [existing] = await db
    .select({ id: brandKits.id })
    .from(brandKits)
    .where(eq(brandKits.clientId, validated.clientId))
    .limit(1);

  if (existing) {
    throw new Error('BrandKit already exists for this client');
  }

  const id = nanoid();
  const now = new Date();

  const [inserted] = await db
    .insert(brandKits)
    .values({
      id,
      clientId: validated.clientId,
      voiceStyle: validated.voiceStyle as typeof brandKits.$inferInsert['voiceStyle'],
      visualTokens: (validated.visualTokens ?? null) as typeof brandKits.$inferInsert['visualTokens'],
      complianceRules: (validated.complianceRules ?? null) as typeof brandKits.$inferInsert['complianceRules'],
      icp: (validated.icp ?? null) as typeof brandKits.$inferInsert['icp'],
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!inserted) {
    throw new Error('Failed to create brandkit');
  }

  logger.info({ brandKitId: id, clientId: validated.clientId }, 'BrandKit created');

  return mapToBrandKit(inserted);
}

/**
 * Get a brandkit by ID
 */
export async function getBrandKit(
  db: PostgresJsDatabase,
  id: string
): Promise<BrandKit | null> {
  const [row] = await db
    .select()
    .from(brandKits)
    .where(eq(brandKits.id, id))
    .limit(1);

  return row ? mapToBrandKit(row) : null;
}

/**
 * Get brandkit by client ID
 */
export async function getBrandKitByClientId(
  db: PostgresJsDatabase,
  clientId: string
): Promise<BrandKit | null> {
  const [row] = await db
    .select()
    .from(brandKits)
    .where(eq(brandKits.clientId, clientId))
    .limit(1);

  return row ? mapToBrandKit(row) : null;
}

/**
 * Update a brandkit
 */
export async function updateBrandKit(
  db: PostgresJsDatabase,
  id: string,
  input: UpdateBrandKitInput
): Promise<BrandKit> {
  const validated = updateBrandKitInputSchema.parse(input);

  const existing = await getBrandKit(db, id);
  if (!existing) {
    throw new Error('BrandKit not found');
  }

  const updateData: Partial<typeof brandKits.$inferInsert> = {
    updatedAt: new Date(),
    version: existing.version + 1,
  };

  if (validated.voiceStyle !== undefined) {
    updateData.voiceStyle = validated.voiceStyle as typeof brandKits.$inferInsert['voiceStyle'];
  }
  if (validated.visualTokens !== undefined) {
    updateData.visualTokens = validated.visualTokens as typeof brandKits.$inferInsert['visualTokens'];
  }
  if (validated.complianceRules !== undefined) {
    updateData.complianceRules = validated.complianceRules as typeof brandKits.$inferInsert['complianceRules'];
  }
  if (validated.icp !== undefined) {
    updateData.icp = validated.icp as typeof brandKits.$inferInsert['icp'];
  }

  const [updated] = await db
    .update(brandKits)
    .set(updateData)
    .where(eq(brandKits.id, id))
    .returning();

  if (!updated) {
    throw new Error('Failed to update brandkit');
  }

  logger.info({ brandKitId: id, version: updated.version }, 'BrandKit updated');

  return mapToBrandKit(updated);
}

/**
 * Update voice style (partial)
 */
export async function updateVoiceStyle(
  db: PostgresJsDatabase,
  id: string,
  voiceStyleUpdate: Partial<VoiceStyle>
): Promise<BrandKit> {
  const existing = await getBrandKit(db, id);
  if (!existing) {
    throw new Error('BrandKit not found');
  }

  const mergedVoiceStyle: VoiceStyle = {
    tone: voiceStyleUpdate.tone ?? existing.voiceStyle.tone,
    personality: voiceStyleUpdate.personality ?? existing.voiceStyle.personality,
    writingStyle: voiceStyleUpdate.writingStyle ?? existing.voiceStyle.writingStyle,
    vocabulary: voiceStyleUpdate.vocabulary ?? existing.voiceStyle.vocabulary,
    examples: voiceStyleUpdate.examples ?? existing.voiceStyle.examples,
  };

  return updateBrandKit(db, id, { voiceStyle: mergedVoiceStyle });
}

/**
 * Update visual tokens (partial)
 */
export async function updateVisualTokens(
  db: PostgresJsDatabase,
  id: string,
  visualTokensUpdate: Partial<NonNullable<VisualTokens>>
): Promise<BrandKit> {
  const existing = await getBrandKit(db, id);
  if (!existing) {
    throw new Error('BrandKit not found');
  }

  const mergedVisualTokens: NonNullable<VisualTokens> = {
    colors: {
      ...(existing.visualTokens?.colors ?? {}),
      ...(visualTokensUpdate.colors ?? {}),
    },
    typography: visualTokensUpdate.typography ?? existing.visualTokens?.typography,
    logoUrls: visualTokensUpdate.logoUrls ?? existing.visualTokens?.logoUrls,
    spacing: visualTokensUpdate.spacing ?? existing.visualTokens?.spacing,
  };

  return updateBrandKit(db, id, { visualTokens: mergedVisualTokens });
}

/**
 * Update compliance rules
 */
export async function updateComplianceRules(
  db: PostgresJsDatabase,
  id: string,
  complianceRules: ComplianceRules
): Promise<BrandKit> {
  return updateBrandKit(db, id, { complianceRules });
}

/**
 * Update ICP
 */
export async function updateICP(
  db: PostgresJsDatabase,
  id: string,
  icp: ICP
): Promise<BrandKit> {
  return updateBrandKit(db, id, { icp });
}
