# S1-B6: Memory Priority Schema

## Task Metadata

```json
{
  "task_id": "S1-B6",
  "name": "Memory Priority Schema",
  "sprint": 1,
  "agent": "B",
  "status": "pending",
  "tests_status": "not_written",
  "dependencies": ["S1-B3"],
  "blocks": ["S1-B7", "S1-B8"],
  "estimated_complexity": "medium",
  "estimated_hours": 3,
  "spec_references": [
    "/docs/02-schemas/external-memory-schema.md",
    "/docs/adr/ADR-0001-tesla-mixed-precision-patterns.md"
  ],
  "acceptance_criteria": [
    "MemoryPriority enum defined with 4 levels",
    "MemoryEntry interface extended with priority fields",
    "Drizzle schema migration created",
    "Priority validation functions implemented",
    "Unit tests cover all priority levels"
  ],
  "test_files": [
    "packages/db/src/__tests__/memory-priority.test.ts"
  ],
  "created_files": [
    "packages/db/src/schemas/memory-priority.ts",
    "packages/db/src/migrations/XXXX_add_memory_priority.ts",
    "packages/core/src/memory/priority.ts"
  ]
}
```

---

## Context

This task implements the Memory Priority Schema, inspired by Tesla's "attention sink" pattern from patent US20260017019A1. The pattern ensures critical context (brand voice, compliance rules) is never accidentally evicted from working memory.

### Background: Why Priority-Based Memory?

In Tesla's autonomous systems, "attention sink" tokens are pinned permanently to prevent neural network destabilization during long operations. Similarly, our RLM (Recursive Language Model) architecture needs to ensure critical business context survives memory pressure.

**Problem**: Without priority-based eviction, critical context may be lost:
- Brand voice guidelines evicted → off-brand responses
- Compliance rules evicted → policy violations
- Active campaign objectives evicted → incoherent content

**Solution**: Implement attention-sink-inspired priority levels.

---

## Pre-Implementation Checklist

- [ ] Read: `docs/02-schemas/external-memory-schema.md`
- [ ] Read: `docs/adr/ADR-0001-tesla-mixed-precision-patterns.md`
- [ ] Read: `docs/01-architecture/rlm-integration-spec.md`
- [ ] Verify S1-B3 (Reference System) is complete
- [ ] Review existing MemoryEntry interface

---

## TDD Methodology

### Phase 1: RED — Write Failing Tests First

Create `packages/db/src/__tests__/memory-priority.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  MemoryPriority, 
  isValidPriority,
  getPriorityWeight,
  canEvict,
  validatePinnedBudget
} from '../schemas/memory-priority';
import { db } from '../connection';
import { memoryEntries } from '../schemas';

describe('S1-B6: Memory Priority Schema', () => {
  describe('MemoryPriority Enum', () => {
    it('should define PINNED priority level', () => {
      expect(MemoryPriority.PINNED).toBe('pinned');
    });

    it('should define SESSION priority level', () => {
      expect(MemoryPriority.SESSION).toBe('session');
    });

    it('should define SLIDING priority level', () => {
      expect(MemoryPriority.SLIDING).toBe('sliding');
    });

    it('should define EPHEMERAL priority level', () => {
      expect(MemoryPriority.EPHEMERAL).toBe('ephemeral');
    });

    it('should have exactly 4 priority levels', () => {
      const values = Object.values(MemoryPriority);
      expect(values).toHaveLength(4);
    });
  });

  describe('Priority Validation', () => {
    it('should validate correct priority values', () => {
      expect(isValidPriority('pinned')).toBe(true);
      expect(isValidPriority('session')).toBe(true);
      expect(isValidPriority('sliding')).toBe(true);
      expect(isValidPriority('ephemeral')).toBe(true);
    });

    it('should reject invalid priority values', () => {
      expect(isValidPriority('invalid')).toBe(false);
      expect(isValidPriority('')).toBe(false);
      expect(isValidPriority(null as any)).toBe(false);
      expect(isValidPriority(undefined as any)).toBe(false);
    });
  });

  describe('Priority Weight Calculation', () => {
    it('should return highest weight for PINNED', () => {
      expect(getPriorityWeight(MemoryPriority.PINNED)).toBe(1000);
    });

    it('should return high weight for SESSION', () => {
      expect(getPriorityWeight(MemoryPriority.SESSION)).toBe(100);
    });

    it('should return medium weight for SLIDING', () => {
      expect(getPriorityWeight(MemoryPriority.SLIDING)).toBe(10);
    });

    it('should return lowest weight for EPHEMERAL', () => {
      expect(getPriorityWeight(MemoryPriority.EPHEMERAL)).toBe(1);
    });

    it('should maintain weight ordering: PINNED > SESSION > SLIDING > EPHEMERAL', () => {
      const pinned = getPriorityWeight(MemoryPriority.PINNED);
      const session = getPriorityWeight(MemoryPriority.SESSION);
      const sliding = getPriorityWeight(MemoryPriority.SLIDING);
      const ephemeral = getPriorityWeight(MemoryPriority.EPHEMERAL);
      
      expect(pinned).toBeGreaterThan(session);
      expect(session).toBeGreaterThan(sliding);
      expect(sliding).toBeGreaterThan(ephemeral);
    });
  });

  describe('Eviction Rules', () => {
    it('should never allow eviction of PINNED entries', () => {
      expect(canEvict(MemoryPriority.PINNED)).toBe(false);
    });

    it('should allow eviction of SESSION entries only on session end', () => {
      expect(canEvict(MemoryPriority.SESSION, { sessionActive: true })).toBe(false);
      expect(canEvict(MemoryPriority.SESSION, { sessionActive: false })).toBe(true);
    });

    it('should allow eviction of SLIDING entries based on age', () => {
      expect(canEvict(MemoryPriority.SLIDING)).toBe(true);
    });

    it('should always allow eviction of EPHEMERAL entries', () => {
      expect(canEvict(MemoryPriority.EPHEMERAL)).toBe(true);
    });
  });

  describe('Pinned Budget Validation', () => {
    it('should enforce maximum pinned token budget per client', async () => {
      const clientId = 'test-client-123';
      const maxPinnedTokens = 2000;
      
      // Attempt to pin content exceeding budget
      const result = await validatePinnedBudget(clientId, {
        content: 'x'.repeat(3000), // Exceeds 2000 token budget
        priority: MemoryPriority.PINNED
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('pinned token budget');
    });

    it('should allow pinning within budget', async () => {
      const clientId = 'test-client-456';
      
      const result = await validatePinnedBudget(clientId, {
        content: 'Brand voice: Professional and friendly',
        priority: MemoryPriority.PINNED
      });
      
      expect(result.valid).toBe(true);
    });

    it('should track cumulative pinned usage', async () => {
      const clientId = 'test-client-789';
      
      // Pin first entry
      await validatePinnedBudget(clientId, {
        content: 'First pinned entry',
        priority: MemoryPriority.PINNED
      });
      
      // Get remaining budget
      const usage = await getPinnedBudgetUsage(clientId);
      expect(usage.used).toBeGreaterThan(0);
      expect(usage.remaining).toBeLessThan(usage.total);
    });
  });

  describe('Database Schema', () => {
    beforeAll(async () => {
      // Run migrations
    });

    afterAll(async () => {
      // Cleanup test data
    });

    it('should store priority field in memory_entries table', async () => {
      const entry = await db.insert(memoryEntries).values({
        id: 'test-entry-1',
        client_id: 'test-client',
        content: 'Test content',
        priority: MemoryPriority.SLIDING,
        created_at: new Date(),
        updated_at: new Date()
      }).returning();

      expect(entry[0].priority).toBe(MemoryPriority.SLIDING);
    });

    it('should default priority to SLIDING if not specified', async () => {
      const entry = await db.insert(memoryEntries).values({
        id: 'test-entry-2',
        client_id: 'test-client',
        content: 'Test content without priority',
        created_at: new Date(),
        updated_at: new Date()
      }).returning();

      expect(entry[0].priority).toBe(MemoryPriority.SLIDING);
    });

    it('should index priority column for efficient queries', async () => {
      // Verify index exists
      const indexes = await db.execute(sql`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'memory_entries' 
        AND indexname LIKE '%priority%'
      `);
      
      expect(indexes.rows.length).toBeGreaterThan(0);
    });

    it('should support compound index on (client_id, priority)', async () => {
      // Query should use index
      const explain = await db.execute(sql`
        EXPLAIN SELECT * FROM memory_entries 
        WHERE client_id = 'test' AND priority = 'pinned'
      `);
      
      expect(explain.rows[0]['QUERY PLAN']).toContain('Index');
    });
  });

  describe('Priority Metadata', () => {
    it('should track eviction_score for SLIDING entries', async () => {
      const entry = await db.insert(memoryEntries).values({
        id: 'test-entry-3',
        client_id: 'test-client',
        content: 'Sliding content',
        priority: MemoryPriority.SLIDING,
        eviction_score: 0.5,
        access_count: 3,
        last_accessed: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      }).returning();

      expect(entry[0].eviction_score).toBe(0.5);
      expect(entry[0].access_count).toBe(3);
    });

    it('should update last_accessed on retrieval', async () => {
      const before = new Date();
      
      // Simulate retrieval
      await db.update(memoryEntries)
        .set({ 
          last_accessed: new Date(),
          access_count: sql`access_count + 1`
        })
        .where(eq(memoryEntries.id, 'test-entry-3'));
      
      const entry = await db.query.memoryEntries.findFirst({
        where: eq(memoryEntries.id, 'test-entry-3')
      });
      
      expect(entry!.last_accessed!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry!.access_count).toBe(4);
    });
  });
});
```

**Run tests — they MUST fail:**
```bash
pnpm test packages/db/src/__tests__/memory-priority.test.ts
```

---

### Phase 2: GREEN — Implement Minimum Code

#### 2.1 Create Priority Type Definitions

Create `packages/core/src/memory/priority.ts`:

```typescript
/**
 * Memory Priority System
 * 
 * Inspired by Tesla's "attention sink" pattern from US20260017019A1.
 * Ensures critical context survives memory pressure.
 */

/**
 * Priority levels for memory entries.
 * 
 * PINNED: Never evicted. Used for brand voice, compliance rules.
 * SESSION: Kept for campaign duration. Used for active objectives.
 * SLIDING: Normal LRU eviction. Used for general history.
 * EPHEMERAL: Single-use. Discarded after task completion.
 */
export enum MemoryPriority {
  PINNED = 'pinned',
  SESSION = 'session',
  SLIDING = 'sliding',
  EPHEMERAL = 'ephemeral'
}

/**
 * Priority weights for eviction scoring.
 * Higher weight = less likely to be evicted.
 */
const PRIORITY_WEIGHTS: Record<MemoryPriority, number> = {
  [MemoryPriority.PINNED]: 1000,
  [MemoryPriority.SESSION]: 100,
  [MemoryPriority.SLIDING]: 10,
  [MemoryPriority.EPHEMERAL]: 1
};

/**
 * Default pinned token budget per client (tokens).
 */
export const DEFAULT_PINNED_BUDGET = 2000;

/**
 * Validates if a string is a valid MemoryPriority value.
 */
export function isValidPriority(value: unknown): value is MemoryPriority {
  if (typeof value !== 'string') return false;
  return Object.values(MemoryPriority).includes(value as MemoryPriority);
}

/**
 * Returns the eviction weight for a priority level.
 * Higher weight = less likely to be evicted.
 */
export function getPriorityWeight(priority: MemoryPriority): number {
  return PRIORITY_WEIGHTS[priority];
}

/**
 * Eviction context for conditional eviction rules.
 */
export interface EvictionContext {
  sessionActive?: boolean;
  memoryPressure?: 'low' | 'medium' | 'high';
  entryAge?: number; // milliseconds
}

/**
 * Determines if a memory entry can be evicted based on its priority.
 */
export function canEvict(
  priority: MemoryPriority, 
  context: EvictionContext = {}
): boolean {
  switch (priority) {
    case MemoryPriority.PINNED:
      // Never evict pinned entries
      return false;
    
    case MemoryPriority.SESSION:
      // Only evict when session ends
      return context.sessionActive === false;
    
    case MemoryPriority.SLIDING:
      // Always evictable (LRU)
      return true;
    
    case MemoryPriority.EPHEMERAL:
      // Always evictable
      return true;
    
    default:
      // Unknown priority - allow eviction
      return true;
  }
}

/**
 * Calculates eviction score for a memory entry.
 * Lower score = more likely to be evicted.
 * 
 * Formula: weight × recency_factor × access_factor
 */
export function calculateEvictionScore(
  priority: MemoryPriority,
  lastAccessed: Date,
  accessCount: number
): number {
  const weight = getPriorityWeight(priority);
  const ageMs = Date.now() - lastAccessed.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  
  // Recency factor: decays over time (half-life of 24 hours)
  const recencyFactor = Math.pow(0.5, ageHours / 24);
  
  // Access factor: logarithmic to prevent runaway scores
  const accessFactor = Math.log2(accessCount + 1) + 1;
  
  return weight * recencyFactor * accessFactor;
}

/**
 * Pinned budget validation result.
 */
export interface PinnedBudgetResult {
  valid: boolean;
  error?: string;
  tokensUsed?: number;
  tokensRemaining?: number;
}

/**
 * Pinned budget usage summary.
 */
export interface PinnedBudgetUsage {
  total: number;
  used: number;
  remaining: number;
  entries: number;
}

/**
 * Validates that pinning new content won't exceed budget.
 * 
 * @param clientId - Client identifier
 * @param entry - Entry to be pinned
 * @param getCurrentUsage - Function to get current pinned token count
 * @param estimateTokens - Function to estimate tokens in content
 */
export async function validatePinnedBudget(
  clientId: string,
  entry: { content: string; priority: MemoryPriority },
  getCurrentUsage: (clientId: string) => Promise<number>,
  estimateTokens: (content: string) => number,
  maxBudget: number = DEFAULT_PINNED_BUDGET
): Promise<PinnedBudgetResult> {
  // Only validate for PINNED priority
  if (entry.priority !== MemoryPriority.PINNED) {
    return { valid: true };
  }

  const currentUsage = await getCurrentUsage(clientId);
  const newTokens = estimateTokens(entry.content);
  const totalAfter = currentUsage + newTokens;

  if (totalAfter > maxBudget) {
    return {
      valid: false,
      error: `Exceeds pinned token budget: ${totalAfter}/${maxBudget} tokens`,
      tokensUsed: currentUsage,
      tokensRemaining: maxBudget - currentUsage
    };
  }

  return {
    valid: true,
    tokensUsed: totalAfter,
    tokensRemaining: maxBudget - totalAfter
  };
}

/**
 * Categories of content typically assigned to each priority.
 */
export const PRIORITY_CATEGORIES: Record<MemoryPriority, string[]> = {
  [MemoryPriority.PINNED]: [
    'brand_voice',
    'compliance_rules',
    'prohibited_topics',
    'tone_guidelines',
    'legal_disclaimers'
  ],
  [MemoryPriority.SESSION]: [
    'campaign_objectives',
    'active_threads',
    'current_offers',
    'session_context'
  ],
  [MemoryPriority.SLIDING]: [
    'engagement_history',
    'post_performance',
    'audience_insights',
    'conversation_summaries'
  ],
  [MemoryPriority.EPHEMERAL]: [
    'intermediate_drafts',
    'tool_outputs',
    'temporary_calculations',
    'debug_context'
  ]
};

/**
 * Suggests a priority level based on content category.
 */
export function suggestPriority(category: string): MemoryPriority {
  for (const [priority, categories] of Object.entries(PRIORITY_CATEGORIES)) {
    if (categories.includes(category)) {
      return priority as MemoryPriority;
    }
  }
  return MemoryPriority.SLIDING; // Default
}
```

#### 2.2 Create Database Schema Extension

Create `packages/db/src/schemas/memory-priority.ts`:

```typescript
import { pgEnum, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * PostgreSQL enum for memory priority levels.
 */
export const memoryPriorityEnum = pgEnum('memory_priority', [
  'pinned',
  'session',
  'sliding',
  'ephemeral'
]);

/**
 * Additional columns for memory_entries table.
 * To be added via migration.
 */
export const memoryPriorityColumns = {
  priority: memoryPriorityEnum('priority').default('sliding').notNull(),
  eviction_score: sql`numeric(10, 4)`.default(sql`0`),
  access_count: sql`integer`.default(sql`0`).notNull(),
  last_accessed: sql`timestamp with time zone`.default(sql`now()`),
};

/**
 * Indexes for efficient priority-based queries.
 */
export const memoryPriorityIndexes = (table: any) => ({
  // Index for finding all pinned entries for a client
  clientPriorityIdx: index('idx_memory_client_priority')
    .on(table.client_id, table.priority),
  
  // Index for eviction queries (lowest score first)
  evictionScoreIdx: index('idx_memory_eviction_score')
    .on(table.eviction_score),
  
  // Index for LRU queries on sliding entries
  lastAccessedIdx: index('idx_memory_last_accessed')
    .on(table.last_accessed)
    .where(sql`priority = 'sliding'`)
});

// Re-export core types
export { 
  MemoryPriority, 
  isValidPriority, 
  getPriorityWeight,
  canEvict,
  calculateEvictionScore,
  validatePinnedBudget,
  suggestPriority,
  PRIORITY_CATEGORIES,
  DEFAULT_PINNED_BUDGET
} from '@rtv/core/memory/priority';
```

#### 2.3 Create Migration

Create `packages/db/src/migrations/0003_add_memory_priority.ts`:

```typescript
import { sql } from 'drizzle-orm';
import { pgEnum } from 'drizzle-orm/pg-core';

export async function up(db: any) {
  // Create enum type
  await db.execute(sql`
    CREATE TYPE memory_priority AS ENUM (
      'pinned', 
      'session', 
      'sliding', 
      'ephemeral'
    );
  `);

  // Add columns to memory_entries
  await db.execute(sql`
    ALTER TABLE memory_entries 
    ADD COLUMN priority memory_priority NOT NULL DEFAULT 'sliding',
    ADD COLUMN eviction_score numeric(10, 4) DEFAULT 0,
    ADD COLUMN access_count integer NOT NULL DEFAULT 0,
    ADD COLUMN last_accessed timestamp with time zone DEFAULT now();
  `);

  // Create indexes
  await db.execute(sql`
    CREATE INDEX idx_memory_client_priority 
    ON memory_entries (client_id, priority);
  `);

  await db.execute(sql`
    CREATE INDEX idx_memory_eviction_score 
    ON memory_entries (eviction_score);
  `);

  await db.execute(sql`
    CREATE INDEX idx_memory_last_accessed 
    ON memory_entries (last_accessed) 
    WHERE priority = 'sliding';
  `);

  // Add constraint for pinned budget (enforced at application level)
  await db.execute(sql`
    COMMENT ON COLUMN memory_entries.priority IS 
    'Memory priority level: pinned (never evict), session (campaign duration), sliding (LRU), ephemeral (single-use)';
  `);
}

export async function down(db: any) {
  // Remove indexes
  await db.execute(sql`DROP INDEX IF EXISTS idx_memory_last_accessed;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_memory_eviction_score;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_memory_client_priority;`);

  // Remove columns
  await db.execute(sql`
    ALTER TABLE memory_entries 
    DROP COLUMN IF EXISTS priority,
    DROP COLUMN IF EXISTS eviction_score,
    DROP COLUMN IF EXISTS access_count,
    DROP COLUMN IF EXISTS last_accessed;
  `);

  // Drop enum type
  await db.execute(sql`DROP TYPE IF EXISTS memory_priority;`);
}
```

---

### Phase 3: REFACTOR — Clean Up

After tests pass:

1. Add JSDoc documentation to all exports
2. Extract magic numbers to named constants
3. Add input validation at function boundaries
4. Ensure consistent error handling patterns

---

## Acceptance Criteria Checklist

- [ ] `MemoryPriority` enum defined with 4 levels (PINNED, SESSION, SLIDING, EPHEMERAL)
- [ ] `MemoryEntry` interface extended with `priority`, `eviction_score`, `access_count`, `last_accessed`
- [ ] Drizzle schema migration created and tested
- [ ] `isValidPriority()` validates priority values
- [ ] `getPriorityWeight()` returns correct weights
- [ ] `canEvict()` implements priority-based eviction rules
- [ ] `calculateEvictionScore()` computes scores correctly
- [ ] `validatePinnedBudget()` enforces per-client budget
- [ ] `suggestPriority()` maps categories to priorities
- [ ] Database indexes created for efficient queries
- [ ] All unit tests passing

---

## Security Considerations

- [ ] Priority cannot be escalated without authorization
- [ ] Pinned budget enforced server-side (not client-trusted)
- [ ] tenant_id scoped in all queries
- [ ] No cross-tenant priority manipulation

---

## Dependencies

| Task ID | Name | Status |
|---------|------|--------|
| S1-B3 | Reference System | Required |

## Blocks

| Task ID | Name | Reason |
|---------|------|--------|
| S1-B7 | Priority-Based Eviction | Needs priority schema |
| S1-B8 | Pinned Context Manager | Needs priority system |

---

## Estimated Time

| Phase | Hours |
|-------|-------|
| RED (Tests) | 1 |
| GREEN (Implementation) | 1.5 |
| REFACTOR | 0.5 |
| **Total** | **3** |

---

## On Completion

```bash
# Run full test suite
pnpm test packages/db/src/__tests__/memory-priority.test.ts

# Run migration
pnpm db:migrate

# Verify typecheck
pnpm typecheck

# Mark complete
cd tools/orchestrator && pnpm tsx src/cli.ts complete S1-B6
```
