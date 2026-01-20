# Build Prompt: S0-B5 — Seed Data Scripts

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-B5 |
| **Sprint** | 0 — Foundation |
| **Agent** | B — Database Schema |
| **Complexity** | Low |
| **Estimated Effort** | 1-2 hours |
| **Dependencies** | S0-B2, S0-B3, S0-B4 |
| **Blocks** | Sprint 1 development |

---

## Context

### What We're Building

Create seed data scripts that populate the development and test databases with realistic sample data for testing and development.

### Why This Matters

- **Development velocity**: Developers have data to work with immediately
- **Consistent testing**: Everyone works with the same baseline data
- **Feature development**: Test features without manual data entry
- **Demo readiness**: Can demo the system with realistic content

### Spec References

- `/docs/02-schemas/onboarding-brand-kit-schema.md` — Brand kit structure
- `/docs/07-engineering-process/testing-strategy.md#5-test-data`

---

## Prerequisites

### Completed Tasks

- [x] S0-B2: Core schema migrations
- [x] S0-B3: Multi-tenant schema
- [x] S0-B4: Audit event schema

### Required Files

- All schema files in `packages/db/src/schema/`

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/db/src/__tests__/seed.test.ts`**

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { db, closeConnection } from '../connection';
import { clients, brandKits, knowledgeBases } from '../schema';
import { seed, clearSeedData, SEED_CLIENTS } from '../seed';
import { eq, inArray } from 'drizzle-orm';

describe('Seed Data', () => {
  beforeAll(async () => {
    // Clear any existing seed data
    await clearSeedData();
  });

  afterAll(async () => {
    await clearSeedData();
    await closeConnection();
  });

  test('seed creates expected clients', async () => {
    await seed();

    const seededClients = await db
      .select()
      .from(clients)
      .where(inArray(clients.slug, SEED_CLIENTS.map(c => c.slug)));

    expect(seededClients.length).toBe(SEED_CLIENTS.length);
  });

  test('seed creates brand kits for each client', async () => {
    const seededClients = await db
      .select()
      .from(clients)
      .where(inArray(clients.slug, SEED_CLIENTS.map(c => c.slug)));

    for (const client of seededClients) {
      const kits = await db
        .select()
        .from(brandKits)
        .where(eq(brandKits.clientId, client.id));

      expect(kits.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('seed creates knowledge bases for each client', async () => {
    const seededClients = await db
      .select()
      .from(clients)
      .where(inArray(clients.slug, SEED_CLIENTS.map(c => c.slug)));

    for (const client of seededClients) {
      const kbs = await db
        .select()
        .from(knowledgeBases)
        .where(eq(knowledgeBases.clientId, client.id));

      expect(kbs.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('clearSeedData removes all seed data', async () => {
    await seed();
    await clearSeedData();

    const remainingClients = await db
      .select()
      .from(clients)
      .where(inArray(clients.slug, SEED_CLIENTS.map(c => c.slug)));

    expect(remainingClients.length).toBe(0);
  });

  test('seed is idempotent', async () => {
    await seed();
    await seed(); // Run twice

    const seededClients = await db
      .select()
      .from(clients)
      .where(inArray(clients.slug, SEED_CLIENTS.map(c => c.slug)));

    // Should still only have the expected number of clients
    expect(seededClients.length).toBe(SEED_CLIENTS.length);
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Seed Data Definitions

**File: `packages/db/src/seed/data.ts`**

```bash
mkdir -p packages/db/src/seed

cat > packages/db/src/seed/data.ts << 'EOF'
/**
 * Seed data definitions
 *
 * Realistic sample data for development and testing.
 */

import type { NewClient, ClientSettings } from '../schema/clients';
import type { NewBrandKit, BrandTone, BrandColors } from '../schema/brand-kits';
import type { NewKnowledgeBase, KnowledgeSourceType } from '../schema/knowledge-bases';

/**
 * Seed client definitions
 */
export interface SeedClient {
  slug: string;
  name: string;
  settings: ClientSettings;
  brandKit: Omit<NewBrandKit, 'clientId'>;
  knowledgeBases: Omit<NewKnowledgeBase, 'clientId'>[];
}

/**
 * Sample clients with full data
 */
export const SEED_CLIENTS: SeedClient[] = [
  {
    slug: 'rtv-house-account',
    name: 'Raize The Vibe (House)',
    settings: {
      timezone: 'America/New_York',
      defaultLanguage: 'en',
      features: {
        publishing: true,
        engagement: true,
        browserLane: true,
      },
      limits: {
        maxPlatformAccounts: 10,
        maxBrandKits: 5,
        maxKnowledgeBases: 20,
      },
    },
    brandKit: {
      name: 'RTV Primary Brand',
      description: 'Main brand identity for Raize The Vibe',
      tone: {
        voice: 'friendly',
        personality: ['innovative', 'helpful', 'approachable'],
        doList: [
          'Use conversational language',
          'Include actionable tips',
          'Share real examples',
          'Be encouraging',
        ],
        dontList: [
          'Use corporate jargon',
          'Be condescending',
          'Make false promises',
          'Use excessive exclamation marks',
        ],
        examplePhrases: [
          "Let's build something amazing together",
          'Here\'s a quick tip that actually works',
          'We\'ve been there - here\'s what helped us',
        ],
      },
      colors: {
        primary: '#6366F1',
        secondary: '#8B5CF6',
        accent: '#EC4899',
        background: '#F9FAFB',
        text: '#111827',
      },
      logoRefs: [
        {
          type: 'primary',
          url: '/assets/logos/rtv-primary.svg',
          format: 'svg',
        },
      ],
      fonts: {
        heading: 'Inter',
        body: 'Inter',
      },
      isDefault: true,
      isActive: true,
    },
    knowledgeBases: [
      {
        name: 'Company Overview',
        description: 'Core information about Raize The Vibe',
        sourceType: 'document',
        sourceRef: '/docs/company-overview.md',
        isActive: true,
        isProcessed: true,
        chunkCount: 15,
        tokenCount: 3500,
      },
      {
        name: 'Product FAQ',
        description: 'Frequently asked questions',
        sourceType: 'faq',
        isActive: true,
        isProcessed: true,
        chunkCount: 25,
        tokenCount: 5000,
      },
    ],
  },
  {
    slug: 'acme-fitness',
    name: 'Acme Fitness Studio',
    settings: {
      timezone: 'America/Los_Angeles',
      defaultLanguage: 'en',
      features: {
        publishing: true,
        engagement: true,
        browserLane: false,
      },
    },
    brandKit: {
      name: 'Acme Fitness Brand',
      description: 'Energetic fitness brand identity',
      tone: {
        voice: 'playful',
        personality: ['energetic', 'motivating', 'fun'],
        doList: [
          'Use action words',
          'Celebrate achievements',
          'Include fitness tips',
          'Be inclusive',
        ],
        dontList: [
          'Body shame',
          'Use extreme diet language',
          'Make unrealistic promises',
        ],
      },
      colors: {
        primary: '#EF4444',
        secondary: '#F97316',
        accent: '#FBBF24',
        background: '#FFFFFF',
        text: '#1F2937',
      },
      logoRefs: [],
      isDefault: true,
      isActive: true,
    },
    knowledgeBases: [
      {
        name: 'Class Schedule',
        description: 'Weekly fitness class information',
        sourceType: 'document',
        isActive: true,
        isProcessed: true,
        chunkCount: 10,
        tokenCount: 2000,
      },
    ],
  },
  {
    slug: 'green-thumb-landscaping',
    name: 'Green Thumb Landscaping',
    settings: {
      timezone: 'America/Chicago',
      defaultLanguage: 'en',
      features: {
        publishing: true,
        engagement: false,
        browserLane: false,
      },
    },
    brandKit: {
      name: 'Green Thumb Brand',
      description: 'Professional landscaping brand',
      tone: {
        voice: 'professional',
        personality: ['reliable', 'knowledgeable', 'trustworthy'],
        doList: [
          'Share seasonal tips',
          'Showcase work quality',
          'Educate homeowners',
        ],
        dontList: [
          'Use overly casual language',
          'Make environmental claims without backing',
        ],
      },
      colors: {
        primary: '#059669',
        secondary: '#34D399',
        accent: '#A78BFA',
        background: '#F0FDF4',
        text: '#1E293B',
      },
      logoRefs: [],
      isDefault: true,
      isActive: true,
    },
    knowledgeBases: [
      {
        name: 'Service Offerings',
        description: 'Landscaping services and pricing',
        sourceType: 'document',
        isActive: true,
        isProcessed: true,
        chunkCount: 12,
        tokenCount: 2800,
      },
      {
        name: 'Seasonal Guide',
        description: 'Year-round lawn care tips',
        sourceType: 'manual',
        isActive: true,
        isProcessed: true,
        chunkCount: 20,
        tokenCount: 4500,
      },
    ],
  },
];

/**
 * Get seed client by slug
 */
export function getSeedClient(slug: string): SeedClient | undefined {
  return SEED_CLIENTS.find(c => c.slug === slug);
}
EOF
```

#### Step 2: Create Seed Script

**File: `packages/db/src/seed/index.ts`**

```bash
cat > packages/db/src/seed/index.ts << 'EOF'
/**
 * Database seed script
 *
 * Populates the database with sample data for development.
 */

import { db } from '../connection';
import { clients, brandKits, knowledgeBases } from '../schema';
import { SEED_CLIENTS, type SeedClient } from './data';
import { eq, inArray } from 'drizzle-orm';

export { SEED_CLIENTS, getSeedClient } from './data';

/**
 * Check if seed data already exists
 */
async function seedDataExists(): Promise<boolean> {
  const existing = await db
    .select()
    .from(clients)
    .where(inArray(clients.slug, SEED_CLIENTS.map(c => c.slug)))
    .limit(1);

  return existing.length > 0;
}

/**
 * Seed a single client with all related data
 */
async function seedClient(seedData: SeedClient): Promise<void> {
  // Check if client already exists
  const existing = await db
    .select()
    .from(clients)
    .where(eq(clients.slug, seedData.slug))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  Skipping ${seedData.slug} (already exists)`);
    return;
  }

  // Create client
  const [client] = await db.insert(clients).values({
    name: seedData.name,
    slug: seedData.slug,
    settings: seedData.settings,
  }).returning();

  console.log(`  Created client: ${client.name} (${client.id})`);

  // Create brand kit
  await db.insert(brandKits).values({
    ...seedData.brandKit,
    clientId: client.id,
  });
  console.log(`    + Brand kit: ${seedData.brandKit.name}`);

  // Create knowledge bases
  for (const kb of seedData.knowledgeBases) {
    await db.insert(knowledgeBases).values({
      ...kb,
      clientId: client.id,
    });
    console.log(`    + Knowledge base: ${kb.name}`);
  }
}

/**
 * Seed the database with sample data
 */
export async function seed(): Promise<void> {
  console.log('🌱 Seeding database...');

  for (const seedData of SEED_CLIENTS) {
    await seedClient(seedData);
  }

  console.log('✅ Seed complete!');
}

/**
 * Clear all seed data
 */
export async function clearSeedData(): Promise<void> {
  console.log('🧹 Clearing seed data...');

  const seedSlugs = SEED_CLIENTS.map(c => c.slug);

  // Get client IDs
  const seedClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(inArray(clients.slug, seedSlugs));

  const clientIds = seedClients.map(c => c.id);

  if (clientIds.length === 0) {
    console.log('  No seed data to clear');
    return;
  }

  // Delete in order (respecting foreign keys)
  await db.delete(knowledgeBases).where(inArray(knowledgeBases.clientId, clientIds));
  await db.delete(brandKits).where(inArray(brandKits.clientId, clientIds));
  await db.delete(clients).where(inArray(clients.id, clientIds));

  console.log(`✅ Cleared ${clientIds.length} seed clients`);
}

/**
 * Reset and re-seed (useful for development)
 */
export async function reseed(): Promise<void> {
  await clearSeedData();
  await seed();
}
EOF
```

#### Step 3: Create CLI Script

**File: `packages/db/src/seed/cli.ts`**

```bash
cat > packages/db/src/seed/cli.ts << 'EOF'
#!/usr/bin/env node
/**
 * Seed CLI
 *
 * Usage:
 *   pnpm db:seed          # Seed the database
 *   pnpm db:seed:clear    # Clear seed data
 *   pnpm db:seed:reset    # Clear and re-seed
 */

import { seed, clearSeedData, reseed } from './index';
import { closeConnection } from '../connection';

async function main() {
  const command = process.argv[2] ?? 'seed';

  try {
    switch (command) {
      case 'seed':
        await seed();
        break;
      case 'clear':
        await clearSeedData();
        break;
      case 'reset':
        await reseed();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.log('Usage: seed [seed|clear|reset]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

main();
EOF
```

#### Step 4: Update Package.json Scripts

```bash
# Add seed scripts to package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('packages/db/package.json', 'utf-8'));
pkg.scripts['db:seed'] = 'tsx src/seed/cli.ts seed';
pkg.scripts['db:seed:clear'] = 'tsx src/seed/cli.ts clear';
pkg.scripts['db:seed:reset'] = 'tsx src/seed/cli.ts reset';
fs.writeFileSync('packages/db/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Add tsx as dev dependency
cd packages/db && pnpm add -D tsx
```

#### Step 5: Update Package Index

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

// Seed (for development)
export { seed, clearSeedData, reseed, SEED_CLIENTS, getSeedClient } from './seed';
EOF
```

### Phase 3: Verification

```bash
cd packages/db

# Build
pnpm build

# Run seed
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rtv_dev" pnpm db:seed

# Verify data
psql $DATABASE_URL -c "SELECT id, name, slug FROM clients WHERE slug LIKE '%seed%' OR slug IN ('rtv-house-account', 'acme-fitness', 'green-thumb-landscaping');"

# Clear seed data
pnpm db:seed:clear

# Run tests
pnpm test

# Reset (clear + seed)
pnpm db:seed:reset
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/db/src/seed/data.ts` | Seed data definitions |
| Create | `packages/db/src/seed/index.ts` | Seed functions |
| Create | `packages/db/src/seed/cli.ts` | CLI script |
| Modify | `packages/db/package.json` | Add seed scripts |
| Modify | `packages/db/src/index.ts` | Export seed functions |
| Create | `packages/db/src/__tests__/seed.test.ts` | Seed tests |

---

## Acceptance Criteria

- [ ] `pnpm db:seed` creates sample data
- [ ] `pnpm db:seed:clear` removes seed data
- [ ] `pnpm db:seed:reset` clears and re-seeds
- [ ] Seed is idempotent (running twice doesn't duplicate)
- [ ] 3+ sample clients with brand kits and knowledge bases
- [ ] Seed tests pass
- [ ] RTV house account included for internal testing

---

## Test Requirements

### Unit Tests

- Seed creates expected number of clients
- Each client has brand kit
- Each client has knowledge bases
- Clear removes all seed data
- Idempotent operation

### Integration Tests

- Seed works on fresh database
- Seed works on database with existing data
- Clear doesn't affect non-seed data

---

## Security & Safety Checklist

- [ ] No real credentials in seed data
- [ ] No real customer data
- [ ] Seed slugs are clearly identifiable
- [ ] Won't run in production (check NODE_ENV)

---

## JSON Task Block

```json
{
  "task_id": "S0-B5",
  "name": "Seed Data Scripts",
  "sprint": 0,
  "agent": "B",
  "status": "pending",
  "complexity": "low",
  "estimated_hours": 2,
  "dependencies": ["S0-B2", "S0-B3", "S0-B4"],
  "blocks": [],
  "tags": ["database", "seed", "development", "testing"],
  "acceptance_criteria": [
    "pnpm db:seed works",
    "3+ sample clients created",
    "seed is idempotent",
    "seed tests pass"
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

Agent B (Database Schema) tasks are complete.

Continue with:
- Agent C: CI/CD Pipeline tasks
- Agent D: Observability tasks
