# Build Prompt: S1-A2 — BrandKit Entity Model

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-A2 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | A — Core Domain Models |
| **Complexity** | Medium |
| **Estimated Effort** | 2-3 hours |
| **Dependencies** | S1-A1 |
| **Blocks** | S1-A4, S1-A5 |

---

## Context

### What We're Building

Create the BrandKit entity model that stores voice/tone, ICP (Ideal Customer Profile), compliance rules, and visual tokens for each client.

### Why This Matters

- **Brand consistency**: Ensures all generated content matches brand voice
- **Agent context**: Provides capsule data for planning and creation agents
- **Visual identity**: Stores colors, fonts, and design tokens
- **Compliance**: Defines industry-specific rules and restrictions

### Spec References

- `/docs/01-architecture/system-architecture-v3.md#5.2-brand-knowledge`
- `/docs/01-architecture/rlm-integration-spec.md#4.2-external-memory`

**Critical Requirement (from system-architecture-v3.md):**
> BrandKit: voice/tone, ICP, offers, compliance, visual tokens — id, client_id, voice_style (json), offers (json), compliance_rules (json), visual_tokens (json), updated_at

---

## Prerequisites

### Completed Tasks

- [x] S1-A1: Client entity model

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/domain/src/__tests__/brandkit.test.ts`**

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, cleanupTestDb, type TestDb } from '@rtv/db/testing';
import { createClient } from '../client';
import {
  createBrandKit,
  getBrandKit,
  getBrandKitByClientId,
  updateBrandKit,
  updateVoiceStyle,
  updateVisualTokens,
  updateComplianceRules,
  type CreateBrandKitInput,
  type VoiceStyle,
  type VisualTokens,
} from '../brandkit';

describe('BrandKit Entity', () => {
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

  describe('createBrandKit', () => {
    test('creates a brandkit with required fields', async () => {
      const input: CreateBrandKitInput = {
        clientId,
        voiceStyle: {
          tone: 'professional',
          personality: ['friendly', 'knowledgeable'],
          writingStyle: 'conversational',
        },
      };

      const brandkit = await createBrandKit(db, input);

      expect(brandkit.id).toBeDefined();
      expect(brandkit.clientId).toBe(clientId);
      expect(brandkit.voiceStyle.tone).toBe('professional');
      expect(brandkit.createdAt).toBeInstanceOf(Date);
    });

    test('creates with full voice style', async () => {
      const voiceStyle: VoiceStyle = {
        tone: 'casual',
        personality: ['witty', 'approachable', 'expert'],
        writingStyle: 'short-form',
        vocabulary: {
          preferred: ['innovative', 'transform', 'elevate'],
          avoided: ['cheap', 'basic', 'simple'],
        },
        examples: [
          { context: 'headline', example: 'Transform your morning routine' },
        ],
      };

      const brandkit = await createBrandKit(db, { clientId, voiceStyle });

      expect(brandkit.voiceStyle.vocabulary?.preferred).toContain('innovative');
      expect(brandkit.voiceStyle.examples).toHaveLength(1);
    });

    test('creates with visual tokens', async () => {
      const visualTokens: VisualTokens = {
        colors: {
          primary: '#1a73e8',
          secondary: '#34a853',
          accent: '#fbbc04',
          background: '#ffffff',
          text: '#202124',
        },
        typography: {
          headingFont: 'Montserrat',
          bodyFont: 'Open Sans',
          baseSize: 16,
        },
        logoUrls: {
          primary: 'https://storage.example.com/logo.png',
          icon: 'https://storage.example.com/icon.png',
        },
      };

      const brandkit = await createBrandKit(db, {
        clientId,
        voiceStyle: { tone: 'professional' },
        visualTokens,
      });

      expect(brandkit.visualTokens?.colors.primary).toBe('#1a73e8');
      expect(brandkit.visualTokens?.typography.headingFont).toBe('Montserrat');
    });

    test('creates with compliance rules', async () => {
      const complianceRules = {
        industry: 'healthcare',
        restrictions: [
          'No medical claims without disclaimer',
          'Must include license number',
        ],
        requiredDisclosures: ['HIPAA compliant'],
        prohibitedTopics: ['competitor comparisons', 'pricing guarantees'],
      };

      const brandkit = await createBrandKit(db, {
        clientId,
        voiceStyle: { tone: 'professional' },
        complianceRules,
      });

      expect(brandkit.complianceRules?.industry).toBe('healthcare');
      expect(brandkit.complianceRules?.restrictions).toHaveLength(2);
    });

    test('creates with ICP definition', async () => {
      const icp = {
        demographics: {
          ageRange: { min: 25, max: 45 },
          gender: 'all',
          income: 'middle-upper',
          location: ['USA', 'Canada'],
        },
        psychographics: {
          interests: ['fitness', 'health', 'productivity'],
          values: ['quality', 'convenience', 'sustainability'],
          painPoints: ['lack of time', 'information overload'],
        },
        behaviors: {
          platforms: ['Instagram', 'LinkedIn'],
          contentPreferences: ['video', 'infographics'],
          purchaseDrivers: ['social proof', 'expert endorsement'],
        },
      };

      const brandkit = await createBrandKit(db, {
        clientId,
        voiceStyle: { tone: 'professional' },
        icp,
      });

      expect(brandkit.icp?.demographics.ageRange.min).toBe(25);
      expect(brandkit.icp?.psychographics.interests).toContain('fitness');
    });

    test('prevents duplicate brandkit per client', async () => {
      await createBrandKit(db, {
        clientId,
        voiceStyle: { tone: 'professional' },
      });

      await expect(
        createBrandKit(db, {
          clientId,
          voiceStyle: { tone: 'casual' },
        })
      ).rejects.toThrow('BrandKit already exists for this client');
    });

    test('validates client exists', async () => {
      await expect(
        createBrandKit(db, {
          clientId: 'non-existent',
          voiceStyle: { tone: 'professional' },
        })
      ).rejects.toThrow('Client not found');
    });
  });

  describe('getBrandKit', () => {
    test('retrieves brandkit by id', async () => {
      const created = await createBrandKit(db, {
        clientId,
        voiceStyle: { tone: 'professional' },
      });

      const retrieved = await getBrandKit(db, created.id);

      expect(retrieved).toEqual(created);
    });

    test('returns null for non-existent brandkit', async () => {
      const result = await getBrandKit(db, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getBrandKitByClientId', () => {
    test('retrieves brandkit by client id', async () => {
      const created = await createBrandKit(db, {
        clientId,
        voiceStyle: { tone: 'professional' },
      });

      const retrieved = await getBrandKitByClientId(db, clientId);

      expect(retrieved?.id).toBe(created.id);
    });

    test('returns null for client without brandkit', async () => {
      const result = await getBrandKitByClientId(db, clientId);

      expect(result).toBeNull();
    });
  });

  describe('updateBrandKit', () => {
    test('updates brandkit fields', async () => {
      const created = await createBrandKit(db, {
        clientId,
        voiceStyle: { tone: 'professional' },
      });

      const updated = await updateBrandKit(db, created.id, {
        voiceStyle: { tone: 'casual', personality: ['friendly'] },
      });

      expect(updated.voiceStyle.tone).toBe('casual');
      expect(updated.voiceStyle.personality).toContain('friendly');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });
  });

  describe('updateVoiceStyle', () => {
    test('partially updates voice style', async () => {
      const created = await createBrandKit(db, {
        clientId,
        voiceStyle: {
          tone: 'professional',
          personality: ['knowledgeable'],
          writingStyle: 'formal',
        },
      });

      const updated = await updateVoiceStyle(db, created.id, {
        tone: 'friendly',
      });

      expect(updated.voiceStyle.tone).toBe('friendly');
      expect(updated.voiceStyle.personality).toContain('knowledgeable');
      expect(updated.voiceStyle.writingStyle).toBe('formal');
    });
  });

  describe('updateVisualTokens', () => {
    test('updates visual tokens', async () => {
      const created = await createBrandKit(db, {
        clientId,
        voiceStyle: { tone: 'professional' },
        visualTokens: {
          colors: { primary: '#000000' },
        },
      });

      const updated = await updateVisualTokens(db, created.id, {
        colors: { primary: '#ffffff', secondary: '#000000' },
      });

      expect(updated.visualTokens?.colors.primary).toBe('#ffffff');
      expect(updated.visualTokens?.colors.secondary).toBe('#000000');
    });
  });

  describe('updateComplianceRules', () => {
    test('updates compliance rules', async () => {
      const created = await createBrandKit(db, {
        clientId,
        voiceStyle: { tone: 'professional' },
      });

      const updated = await updateComplianceRules(db, created.id, {
        industry: 'finance',
        restrictions: ['Must include risk disclaimer'],
      });

      expect(updated.complianceRules?.industry).toBe('finance');
      expect(updated.complianceRules?.restrictions).toHaveLength(1);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create BrandKit Types

**File: `packages/domain/src/brandkit/types.ts`**

```bash
mkdir -p packages/domain/src/brandkit

cat > packages/domain/src/brandkit/types.ts << 'EOF'
/**
 * BrandKit entity types
 */

import { z } from 'zod';

/**
 * Voice style schema
 */
export const voiceStyleSchema = z.object({
  tone: z.string().min(1),
  personality: z.array(z.string()).optional(),
  writingStyle: z.string().optional(),
  vocabulary: z.object({
    preferred: z.array(z.string()),
    avoided: z.array(z.string()),
  }).optional(),
  examples: z.array(z.object({
    context: z.string(),
    example: z.string(),
  })).optional(),
});

export type VoiceStyle = z.infer<typeof voiceStyleSchema>;

/**
 * Visual tokens schema
 */
export const visualTokensSchema = z.object({
  colors: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    background: z.string().optional(),
    text: z.string().optional(),
  }).catchall(z.string()),
  typography: z.object({
    headingFont: z.string().optional(),
    bodyFont: z.string().optional(),
    baseSize: z.number().optional(),
  }).optional(),
  logoUrls: z.object({
    primary: z.string().url().optional(),
    icon: z.string().url().optional(),
    dark: z.string().url().optional(),
    light: z.string().url().optional(),
  }).optional(),
  spacing: z.object({
    base: z.number().optional(),
    scale: z.number().optional(),
  }).optional(),
}).optional();

export type VisualTokens = z.infer<typeof visualTokensSchema>;

/**
 * Compliance rules schema
 */
export const complianceRulesSchema = z.object({
  industry: z.string().optional(),
  restrictions: z.array(z.string()).optional(),
  requiredDisclosures: z.array(z.string()).optional(),
  prohibitedTopics: z.array(z.string()).optional(),
  platformSpecific: z.record(z.object({
    restrictions: z.array(z.string()).optional(),
    requirements: z.array(z.string()).optional(),
  })).optional(),
}).optional();

export type ComplianceRules = z.infer<typeof complianceRulesSchema>;

/**
 * ICP (Ideal Customer Profile) schema
 */
export const icpSchema = z.object({
  demographics: z.object({
    ageRange: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
    gender: z.string().optional(),
    income: z.string().optional(),
    location: z.array(z.string()).optional(),
    education: z.string().optional(),
    occupation: z.array(z.string()).optional(),
  }).optional(),
  psychographics: z.object({
    interests: z.array(z.string()).optional(),
    values: z.array(z.string()).optional(),
    painPoints: z.array(z.string()).optional(),
    goals: z.array(z.string()).optional(),
    fears: z.array(z.string()).optional(),
  }).optional(),
  behaviors: z.object({
    platforms: z.array(z.string()).optional(),
    contentPreferences: z.array(z.string()).optional(),
    purchaseDrivers: z.array(z.string()).optional(),
    mediaConsumption: z.array(z.string()).optional(),
  }).optional(),
}).optional();

export type ICP = z.infer<typeof icpSchema>;

/**
 * BrandKit entity
 */
export interface BrandKit {
  readonly id: string;
  readonly clientId: string;
  readonly voiceStyle: VoiceStyle;
  readonly visualTokens: VisualTokens | null;
  readonly complianceRules: ComplianceRules | null;
  readonly icp: ICP | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Create brandkit input
 */
export const createBrandKitInputSchema = z.object({
  clientId: z.string().min(1),
  voiceStyle: voiceStyleSchema,
  visualTokens: visualTokensSchema.optional(),
  complianceRules: complianceRulesSchema.optional(),
  icp: icpSchema.optional(),
});

export type CreateBrandKitInput = z.infer<typeof createBrandKitInputSchema>;

/**
 * Update brandkit input
 */
export const updateBrandKitInputSchema = z.object({
  voiceStyle: voiceStyleSchema.optional(),
  visualTokens: visualTokensSchema.optional(),
  complianceRules: complianceRulesSchema.optional(),
  icp: icpSchema.optional(),
});

export type UpdateBrandKitInput = z.infer<typeof updateBrandKitInputSchema>;
EOF
```

#### Step 2: Create BrandKit Repository

**File: `packages/domain/src/brandkit/repository.ts`**

```bash
cat > packages/domain/src/brandkit/repository.ts << 'EOF'
/**
 * BrandKit repository - database operations
 */

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DbType } from '@rtv/db';
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
} from './types';

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
  db: DbType,
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
      voiceStyle: validated.voiceStyle,
      visualTokens: validated.visualTokens ?? null,
      complianceRules: validated.complianceRules ?? null,
      icp: validated.icp ?? null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ brandKitId: id, clientId: validated.clientId }, 'BrandKit created');

  return mapToBrandKit(inserted);
}

/**
 * Get a brandkit by ID
 */
export async function getBrandKit(
  db: DbType,
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
  db: DbType,
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
  db: DbType,
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
    updateData.voiceStyle = validated.voiceStyle;
  }
  if (validated.visualTokens !== undefined) {
    updateData.visualTokens = validated.visualTokens;
  }
  if (validated.complianceRules !== undefined) {
    updateData.complianceRules = validated.complianceRules;
  }
  if (validated.icp !== undefined) {
    updateData.icp = validated.icp;
  }

  const [updated] = await db
    .update(brandKits)
    .set(updateData)
    .where(eq(brandKits.id, id))
    .returning();

  logger.info({ brandKitId: id, version: updated.version }, 'BrandKit updated');

  return mapToBrandKit(updated);
}

/**
 * Update voice style (partial)
 */
export async function updateVoiceStyle(
  db: DbType,
  id: string,
  voiceStyleUpdate: Partial<VoiceStyle>
): Promise<BrandKit> {
  const existing = await getBrandKit(db, id);
  if (!existing) {
    throw new Error('BrandKit not found');
  }

  const mergedVoiceStyle: VoiceStyle = {
    ...existing.voiceStyle,
    ...voiceStyleUpdate,
  };

  return updateBrandKit(db, id, { voiceStyle: mergedVoiceStyle });
}

/**
 * Update visual tokens (partial)
 */
export async function updateVisualTokens(
  db: DbType,
  id: string,
  visualTokensUpdate: Partial<NonNullable<VisualTokens>>
): Promise<BrandKit> {
  const existing = await getBrandKit(db, id);
  if (!existing) {
    throw new Error('BrandKit not found');
  }

  const mergedVisualTokens: VisualTokens = {
    colors: {
      ...existing.visualTokens?.colors,
      ...visualTokensUpdate.colors,
    },
    typography: {
      ...existing.visualTokens?.typography,
      ...visualTokensUpdate.typography,
    },
    logoUrls: {
      ...existing.visualTokens?.logoUrls,
      ...visualTokensUpdate.logoUrls,
    },
    spacing: {
      ...existing.visualTokens?.spacing,
      ...visualTokensUpdate.spacing,
    },
  };

  return updateBrandKit(db, id, { visualTokens: mergedVisualTokens });
}

/**
 * Update compliance rules
 */
export async function updateComplianceRules(
  db: DbType,
  id: string,
  complianceRules: ComplianceRules
): Promise<BrandKit> {
  return updateBrandKit(db, id, { complianceRules });
}

/**
 * Update ICP
 */
export async function updateICP(
  db: DbType,
  id: string,
  icp: ICP
): Promise<BrandKit> {
  return updateBrandKit(db, id, { icp });
}
EOF
```

#### Step 3: Create BrandKit Index

**File: `packages/domain/src/brandkit/index.ts`**

```bash
cat > packages/domain/src/brandkit/index.ts << 'EOF'
/**
 * BrandKit entity module
 */

export {
  createBrandKit,
  getBrandKit,
  getBrandKitByClientId,
  updateBrandKit,
  updateVoiceStyle,
  updateVisualTokens,
  updateComplianceRules,
  updateICP,
} from './repository';

export {
  voiceStyleSchema,
  visualTokensSchema,
  complianceRulesSchema,
  icpSchema,
  createBrandKitInputSchema,
  updateBrandKitInputSchema,
  type BrandKit,
  type VoiceStyle,
  type VisualTokens,
  type ComplianceRules,
  type ICP,
  type CreateBrandKitInput,
  type UpdateBrandKitInput,
} from './types';
EOF
```

#### Step 4: Update Package Index

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
| Create | `packages/domain/src/brandkit/types.ts` | BrandKit types |
| Create | `packages/domain/src/brandkit/repository.ts` | BrandKit CRUD |
| Create | `packages/domain/src/brandkit/index.ts` | BrandKit exports |
| Modify | `packages/domain/src/index.ts` | Add BrandKit export |
| Create | `packages/domain/src/__tests__/brandkit.test.ts` | BrandKit tests |

---

## Acceptance Criteria

- [ ] `createBrandKit()` creates with validation
- [ ] `getBrandKitByClientId()` retrieves for client
- [ ] `updateBrandKit()` updates all fields
- [ ] `updateVoiceStyle()` partial update
- [ ] `updateVisualTokens()` partial update
- [ ] `updateComplianceRules()` update
- [ ] One brandkit per client enforced
- [ ] Version incremented on update
- [ ] All tests pass

---

## Test Requirements

### Unit Tests

- CRUD operations work
- Partial updates merge correctly
- Validation errors thrown
- One-per-client constraint works

---

## Security & Safety Checklist

- [ ] No credentials in brandkit
- [ ] Logo URLs validated
- [ ] Compliance rules are text-only (no executable)
- [ ] Version history preserved

---

## JSON Task Block

```json
{
  "task_id": "S1-A2",
  "name": "BrandKit Entity Model",
  "sprint": 1,
  "agent": "A",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 3,
  "dependencies": ["S1-A1"],
  "blocks": ["S1-A4", "S1-A5"],
  "tags": ["domain", "entity", "brandkit"],
  "acceptance_criteria": [
    "CRUD operations work",
    "partial updates work",
    "one per client enforced",
    "versioning works"
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

1. **S1-A3**: Create KnowledgeBase entity model
2. **S1-A4**: Create Offer entity model
