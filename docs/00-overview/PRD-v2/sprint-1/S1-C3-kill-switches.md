# Build Prompt: S1-C3 — Kill Switch Infrastructure

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-C3 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | C — Policy Engine |
| **Task Name** | Kill Switch Infrastructure |
| **Complexity** | High |
| **Estimated Effort** | 5-6 hours |
| **Dependencies** | S1-C1 |
| **Blocks** | S1-C5, S3-C1, S5-C1 through S5-C5 |
| **Status** | pending |

---

## Context

### What This Builds

Kill switches are emergency controls that immediately halt autonomous operations. Unlike policies that evaluate rules, kill switches are binary circuit breakers — when tripped, they block ALL actions of a specific type, regardless of other policies.

### Why It Matters

When something goes wrong (compromised account, AI hallucination, compliance issue), we need to stop everything FAST. Kill switches provide:

- **Instant halt**: No evaluation, no exceptions — just stop
- **Granular control**: Global, per-client, per-platform, per-action levels
- **Audit trail**: Who flipped the switch, when, why
- **Automatic triggers**: Trip based on error rates, not just manual action

### Architectural Position

```
Action Request
     │
     ▼
┌─────────────────┐
│  Kill Switch    │  ← Check FIRST (before policy evaluation)
│    Check        │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
 TRIPPED    OPEN
    │         │
    ▼         ▼
  BLOCK    Continue to
           Policy Engine
```

### Reference Specs

| Document | Section | Relevance |
|----------|---------|-----------|
| `/docs/05-policy-safety/policy-engine.md` | Kill Switch Design | Requirements |
| `/docs/05-policy-safety/security-rbac-spec.md` | Emergency Controls | RBAC for switches |
| `/docs/01-architecture/system-architecture-v3.md` | Safety Architecture | Integration points |
| `/docs/06-reliability-ops/incident-management.md` | Emergency Response | Trigger conditions |
| `/docs/runbooks/RB-03-account-compromise.md` | Response Procedures | Usage patterns |

---

## Prerequisites

### Completed Tasks

- [x] **S0-B2**: Core schema migrations (for kill_switches table)
- [x] **S0-B3**: Multi-tenant schema (client_id scoping)
- [x] **S0-B4**: Audit event schema (for switch events)
- [x] **S0-D3**: Audit event framework (for event emission)
- [x] **S1-C1**: Policy definition schema (for integration)

### Required Packages

```json
{
  "dependencies": {
    "drizzle-orm": "^0.30.0",
    "zod": "^3.22.0",
    "nanoid": "^5.0.0",
    "ioredis": "^5.3.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### Environment Setup

```bash
# Packages must be initialized
packages/policy/    # Kill switch lives here
packages/db/        # Schema definitions
packages/audit/     # Event emission
```

---

## Instructions

### Phase 1: Test First (TDD)

Create comprehensive tests BEFORE implementation.

#### 1.1 Create Kill Switch Schema Tests

**File:** `packages/db/src/schema/__tests__/kill-switches.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { killSwitches, killSwitchHistory } from '../kill-switches';
import { eq, and } from 'drizzle-orm';

describe('Kill Switch Schema', () => {
  let db: ReturnType<typeof drizzle>;
  let sql: ReturnType<typeof postgres>;

  beforeEach(async () => {
    sql = postgres(process.env.TEST_DATABASE_URL!);
    db = drizzle(sql);
    await migrate(db, { migrationsFolder: './drizzle' });
    // Clean up test data
    await db.delete(killSwitchHistory);
    await db.delete(killSwitches);
  });

  afterEach(async () => {
    await sql.end();
  });

  describe('Kill Switch Table', () => {
    it('should create global kill switch (no client_id)', async () => {
      const [ks] = await db.insert(killSwitches).values({
        id: 'ks_test_001',
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        isActive: false,
        reason: null,
        activatedBy: null,
        activatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      expect(ks.scope).toBe('global');
      expect(ks.clientId).toBeNull();
      expect(ks.isActive).toBe(false);
    });

    it('should create client-scoped kill switch', async () => {
      const [ks] = await db.insert(killSwitches).values({
        id: 'ks_test_002',
        clientId: 'client_abc',
        scope: 'client',
        targetType: 'platform',
        targetValue: 'meta',
        isActive: false,
        reason: null,
        activatedBy: null,
        activatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      expect(ks.scope).toBe('client');
      expect(ks.clientId).toBe('client_abc');
    });

    it('should enforce unique constraint on scope+target+client', async () => {
      await db.insert(killSwitches).values({
        id: 'ks_test_003',
        clientId: 'client_abc',
        scope: 'client',
        targetType: 'action',
        targetValue: 'publish',
        isActive: false,
        reason: null,
        activatedBy: null,
        activatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Duplicate should fail
      await expect(
        db.insert(killSwitches).values({
          id: 'ks_test_004',
          clientId: 'client_abc',
          scope: 'client',
          targetType: 'action',
          targetValue: 'publish',
          isActive: false,
          reason: null,
          activatedBy: null,
          activatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ).rejects.toThrow();
    });

    it('should track activation metadata', async () => {
      const activatedAt = new Date();
      const [ks] = await db.insert(killSwitches).values({
        id: 'ks_test_005',
        scope: 'global',
        targetType: 'platform',
        targetValue: 'tiktok',
        isActive: true,
        reason: 'API outage detected',
        activatedBy: 'user_admin_001',
        activatedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      expect(ks.isActive).toBe(true);
      expect(ks.reason).toBe('API outage detected');
      expect(ks.activatedBy).toBe('user_admin_001');
      expect(ks.activatedAt).toEqual(activatedAt);
    });
  });

  describe('Kill Switch History', () => {
    it('should record switch state changes', async () => {
      const [ks] = await db.insert(killSwitches).values({
        id: 'ks_test_006',
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        isActive: false,
        reason: null,
        activatedBy: null,
        activatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      // Record activation
      await db.insert(killSwitchHistory).values({
        id: 'ksh_001',
        killSwitchId: ks.id,
        action: 'activated',
        previousState: false,
        newState: true,
        reason: 'Emergency stop',
        performedBy: 'user_admin_001',
        performedAt: new Date(),
        metadata: { trigger: 'manual', incident_id: 'INC-001' },
      });

      const history = await db.select()
        .from(killSwitchHistory)
        .where(eq(killSwitchHistory.killSwitchId, ks.id));

      expect(history).toHaveLength(1);
      expect(history[0].action).toBe('activated');
      expect(history[0].metadata).toEqual({ trigger: 'manual', incident_id: 'INC-001' });
    });
  });
});
```

#### 1.2 Create Kill Switch Service Tests

**File:** `packages/policy/src/kill-switch/__tests__/kill-switch-service.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createKillSwitchService, KillSwitchService } from '../kill-switch-service';
import { createMockDb, createMockRedis, createMockAudit } from '@rtv/testing';

describe('KillSwitchService', () => {
  let service: KillSwitchService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockAudit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockRedis = createMockRedis();
    mockAudit = createMockAudit();

    service = createKillSwitchService({
      db: mockDb,
      redis: mockRedis,
      audit: mockAudit,
    });
  });

  describe('isTripped', () => {
    it('should return false when no switches are active', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue([]);

      const result = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client_abc',
      });

      expect(result.tripped).toBe(false);
    });

    it('should return true when global switch is active', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        id: 'ks_global',
        isActive: true,
        reason: 'System maintenance',
        activatedAt: new Date().toISOString(),
      }));

      const result = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client_abc',
      });

      expect(result.tripped).toBe(true);
      expect(result.switch?.id).toBe('ks_global');
      expect(result.reason).toBe('System maintenance');
    });

    it('should check in priority order: global > client > platform > action', async () => {
      // Simulate cache misses for global and client, hit on platform
      mockRedis.get
        .mockResolvedValueOnce(null) // global:all:*
        .mockResolvedValueOnce(null) // client:client_abc:all:*
        .mockResolvedValueOnce(JSON.stringify({
          id: 'ks_platform_meta',
          isActive: true,
          reason: 'Meta API issue',
          activatedAt: new Date().toISOString(),
        })); // global:platform:meta

      const result = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client_abc',
      });

      expect(result.tripped).toBe(true);
      expect(result.switch?.id).toBe('ks_platform_meta');
    });

    it('should check database when cache misses', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue([{
        id: 'ks_db',
        scope: 'client',
        targetType: 'action',
        targetValue: 'publish',
        clientId: 'client_abc',
        isActive: true,
        reason: 'Client requested pause',
        activatedAt: new Date(),
      }]);

      const result = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client_abc',
      });

      expect(result.tripped).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled(); // Should cache result
    });
  });

  describe('activate', () => {
    it('should activate switch and emit audit event', async () => {
      const switchId = 'ks_test';
      const existingSwitch = {
        id: switchId,
        scope: 'global',
        targetType: 'platform',
        targetValue: 'tiktok',
        isActive: false,
        reason: null,
        activatedBy: null,
        activatedAt: null,
      };

      mockDb.query.mockResolvedValue([existingSwitch]);
      mockDb.update.mockResolvedValue([{ ...existingSwitch, isActive: true }]);

      await service.activate({
        id: switchId,
        reason: 'API instability',
        activatedBy: 'user_admin_001',
        incidentId: 'INC-001',
      });

      // Should update database
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          reason: 'API instability',
          activatedBy: 'user_admin_001',
        })
      );

      // Should invalidate cache
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining('kill_switch:')
      );

      // Should emit audit event
      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'KILL_SWITCH_ACTIVATED',
        actor: 'user_admin_001',
        target: switchId,
        metadata: expect.objectContaining({
          reason: 'API instability',
          incidentId: 'INC-001',
          previousState: false,
          newState: true,
        }),
      });
    });

    it('should not emit if already active', async () => {
      const switchId = 'ks_test';
      mockDb.query.mockResolvedValue([{
        id: switchId,
        isActive: true, // Already active
      }]);

      await service.activate({
        id: switchId,
        reason: 'Duplicate activation',
        activatedBy: 'user_admin_001',
      });

      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockAudit.emit).not.toHaveBeenCalled();
    });

    it('should throw if switch does not exist', async () => {
      mockDb.query.mockResolvedValue([]);

      await expect(
        service.activate({
          id: 'nonexistent',
          reason: 'Test',
          activatedBy: 'user_admin_001',
        })
      ).rejects.toThrow('Kill switch not found: nonexistent');
    });
  });

  describe('deactivate', () => {
    it('should deactivate switch and emit audit event', async () => {
      const switchId = 'ks_test';
      const existingSwitch = {
        id: switchId,
        scope: 'global',
        targetType: 'platform',
        targetValue: 'tiktok',
        isActive: true,
        reason: 'API instability',
        activatedBy: 'user_admin_001',
        activatedAt: new Date(),
      };

      mockDb.query.mockResolvedValue([existingSwitch]);
      mockDb.update.mockResolvedValue([{ ...existingSwitch, isActive: false }]);

      await service.deactivate({
        id: switchId,
        reason: 'Issue resolved',
        deactivatedBy: 'user_admin_002',
      });

      // Should update database
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        })
      );

      // Should invalidate cache
      expect(mockRedis.del).toHaveBeenCalled();

      // Should emit audit event
      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'KILL_SWITCH_DEACTIVATED',
        actor: 'user_admin_002',
        target: switchId,
        metadata: expect.objectContaining({
          reason: 'Issue resolved',
          previousState: true,
          newState: false,
          activeDuration: expect.any(Number),
        }),
      });
    });
  });

  describe('create', () => {
    it('should create new kill switch', async () => {
      mockDb.insert.mockResolvedValue([{
        id: 'ks_new',
        scope: 'client',
        targetType: 'action',
        targetValue: 'engage',
        clientId: 'client_abc',
        isActive: false,
      }]);

      const result = await service.create({
        scope: 'client',
        targetType: 'action',
        targetValue: 'engage',
        clientId: 'client_abc',
        createdBy: 'user_admin_001',
      });

      expect(result.id).toMatch(/^ks_/);
      expect(result.scope).toBe('client');
      expect(result.isActive).toBe(false);
    });

    it('should validate scope requires clientId for client scope', async () => {
      await expect(
        service.create({
          scope: 'client',
          targetType: 'action',
          targetValue: 'engage',
          // Missing clientId
          createdBy: 'user_admin_001',
        })
      ).rejects.toThrow('Client scope requires clientId');
    });

    it('should reject clientId for global scope', async () => {
      await expect(
        service.create({
          scope: 'global',
          targetType: 'all',
          targetValue: '*',
          clientId: 'client_abc', // Should not be present
          createdBy: 'user_admin_001',
        })
      ).rejects.toThrow('Global scope cannot have clientId');
    });
  });

  describe('listActive', () => {
    it('should list all active switches', async () => {
      mockDb.query.mockResolvedValue([
        { id: 'ks_1', scope: 'global', targetType: 'all', isActive: true },
        { id: 'ks_2', scope: 'client', targetType: 'platform', isActive: true },
      ]);

      const result = await service.listActive();

      expect(result).toHaveLength(2);
    });

    it('should filter by scope', async () => {
      mockDb.query.mockResolvedValue([
        { id: 'ks_1', scope: 'global', targetType: 'all', isActive: true },
      ]);

      const result = await service.listActive({ scope: 'global' });

      expect(result).toHaveLength(1);
      expect(result[0].scope).toBe('global');
    });

    it('should filter by clientId', async () => {
      mockDb.query.mockResolvedValue([
        { id: 'ks_2', scope: 'client', clientId: 'client_abc', isActive: true },
      ]);

      const result = await service.listActive({ clientId: 'client_abc' });

      expect(result).toHaveLength(1);
      expect(result[0].clientId).toBe('client_abc');
    });
  });
});
```

#### 1.3 Create Auto-Trip Tests

**File:** `packages/policy/src/kill-switch/__tests__/auto-trip.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createAutoTripMonitor, AutoTripMonitor } from '../auto-trip';
import { createMockKillSwitchService, createMockMetrics } from '@rtv/testing';

describe('AutoTripMonitor', () => {
  let monitor: AutoTripMonitor;
  let mockService: ReturnType<typeof createMockKillSwitchService>;
  let mockMetrics: ReturnType<typeof createMockMetrics>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockService = createMockKillSwitchService();
    mockMetrics = createMockMetrics();

    monitor = createAutoTripMonitor({
      killSwitchService: mockService,
      metrics: mockMetrics,
      config: {
        windowMs: 60_000, // 1 minute window
        thresholds: {
          'platform:meta': { errorRate: 0.5, minSamples: 10 },
          'platform:tiktok': { errorRate: 0.3, minSamples: 5 },
          'action:publish': { errorRate: 0.25, minSamples: 20 },
        },
        checkIntervalMs: 10_000, // Check every 10 seconds
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    monitor.stop();
  });

  describe('error rate tracking', () => {
    it('should track errors per target', async () => {
      await monitor.recordResult({
        target: 'platform:meta',
        success: false,
        clientId: 'client_abc',
      });

      await monitor.recordResult({
        target: 'platform:meta',
        success: true,
        clientId: 'client_abc',
      });

      const stats = monitor.getStats('platform:meta');
      expect(stats.errors).toBe(1);
      expect(stats.total).toBe(2);
      expect(stats.errorRate).toBe(0.5);
    });

    it('should expire old samples', async () => {
      await monitor.recordResult({
        target: 'platform:meta',
        success: false,
        clientId: 'client_abc',
      });

      // Advance past window
      vi.advanceTimersByTime(61_000);

      const stats = monitor.getStats('platform:meta');
      expect(stats.total).toBe(0);
    });
  });

  describe('auto-trip behavior', () => {
    it('should trip switch when threshold exceeded', async () => {
      // Record enough failures to exceed 50% threshold with 10+ samples
      for (let i = 0; i < 8; i++) {
        await monitor.recordResult({
          target: 'platform:meta',
          success: false,
          clientId: 'client_abc',
        });
      }
      for (let i = 0; i < 2; i++) {
        await monitor.recordResult({
          target: 'platform:meta',
          success: true,
          clientId: 'client_abc',
        });
      }

      // Trigger check
      vi.advanceTimersByTime(10_000);

      expect(mockService.activate).toHaveBeenCalledWith({
        id: expect.any(String),
        reason: expect.stringContaining('Auto-tripped'),
        activatedBy: 'system:auto_trip',
        metadata: expect.objectContaining({
          errorRate: 0.8,
          threshold: 0.5,
          samples: 10,
        }),
      });
    });

    it('should not trip if below min samples', async () => {
      // Only 5 samples (meta threshold requires 10)
      for (let i = 0; i < 5; i++) {
        await monitor.recordResult({
          target: 'platform:meta',
          success: false,
          clientId: 'client_abc',
        });
      }

      vi.advanceTimersByTime(10_000);

      expect(mockService.activate).not.toHaveBeenCalled();
    });

    it('should not trip if error rate below threshold', async () => {
      // 20% error rate (meta threshold is 50%)
      for (let i = 0; i < 2; i++) {
        await monitor.recordResult({
          target: 'platform:meta',
          success: false,
          clientId: 'client_abc',
        });
      }
      for (let i = 0; i < 8; i++) {
        await monitor.recordResult({
          target: 'platform:meta',
          success: true,
          clientId: 'client_abc',
        });
      }

      vi.advanceTimersByTime(10_000);

      expect(mockService.activate).not.toHaveBeenCalled();
    });

    it('should track per-client thresholds separately', async () => {
      // Client A has high error rate
      for (let i = 0; i < 10; i++) {
        await monitor.recordResult({
          target: 'platform:meta',
          success: false,
          clientId: 'client_a',
        });
      }

      // Client B has low error rate
      for (let i = 0; i < 10; i++) {
        await monitor.recordResult({
          target: 'platform:meta',
          success: true,
          clientId: 'client_b',
        });
      }

      vi.advanceTimersByTime(10_000);

      // Should activate client-scoped switch, not global
      expect(mockService.activate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            clientId: 'client_a',
          }),
        })
      );
    });
  });

  describe('cooldown behavior', () => {
    it('should not re-trip during cooldown', async () => {
      // First trip
      for (let i = 0; i < 10; i++) {
        await monitor.recordResult({
          target: 'platform:meta',
          success: false,
          clientId: 'client_abc',
        });
      }
      vi.advanceTimersByTime(10_000);
      expect(mockService.activate).toHaveBeenCalledTimes(1);

      // Reset call count
      mockService.activate.mockClear();

      // More failures during cooldown
      for (let i = 0; i < 10; i++) {
        await monitor.recordResult({
          target: 'platform:meta',
          success: false,
          clientId: 'client_abc',
        });
      }
      vi.advanceTimersByTime(10_000);

      // Should not trip again
      expect(mockService.activate).not.toHaveBeenCalled();
    });
  });
});
```

#### 1.4 Run Tests (Expect Failures)

```bash
cd packages/policy
pnpm test:watch src/kill-switch/
```

---

### Phase 2: Implementation

#### 2.1 Create Kill Switch Schema

**File:** `packages/db/src/schema/kill-switches.ts`

```typescript
import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  text,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Kill Switch Scope Hierarchy:
 *
 * global > client > platform > action
 *
 * - global: Affects ALL operations across ALL clients
 * - client: Affects ALL operations for a specific client
 * - platform: Affects ALL operations on a specific platform (optionally scoped to client)
 * - action: Affects specific action type (optionally scoped to client and/or platform)
 */
export const killSwitchScopeEnum = ['global', 'client', 'platform', 'action'] as const;
export type KillSwitchScope = typeof killSwitchScopeEnum[number];

export const killSwitchTargetTypeEnum = ['all', 'platform', 'action'] as const;
export type KillSwitchTargetType = typeof killSwitchTargetTypeEnum[number];

/**
 * Kill Switches Table
 *
 * Stores circuit breaker configurations that can immediately halt operations.
 * Checked BEFORE policy evaluation for fast-path blocking.
 */
export const killSwitches = pgTable('kill_switches', {
  // Primary key
  id: varchar('id', { length: 36 }).primaryKey(),

  // Scope and targeting
  clientId: varchar('client_id', { length: 36 }), // null for global switches
  scope: varchar('scope', { length: 20 }).notNull().$type<KillSwitchScope>(),
  targetType: varchar('target_type', { length: 20 }).notNull().$type<KillSwitchTargetType>(),
  targetValue: varchar('target_value', { length: 100 }).notNull(), // e.g., 'meta', 'publish', '*'

  // Optional additional targeting
  platform: varchar('platform', { length: 50 }), // For action-level switches scoped to platform

  // State
  isActive: boolean('is_active').notNull().default(false),
  reason: text('reason'),

  // Activation tracking
  activatedBy: varchar('activated_by', { length: 100 }), // user_id or 'system:auto_trip'
  activatedAt: timestamp('activated_at', { withTimezone: true }),

  // Metadata
  autoTripConfig: jsonb('auto_trip_config').$type<{
    enabled: boolean;
    errorRateThreshold: number;
    minSamples: number;
    windowMs: number;
    cooldownMs: number;
  }>(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: only one switch per scope+target+client combination
  uniqueScopeTarget: unique('kill_switches_scope_target_unique').on(
    table.clientId,
    table.scope,
    table.targetType,
    table.targetValue,
    table.platform
  ),
  // Index for fast lookups
  activeIdx: index('kill_switches_active_idx').on(table.isActive),
  clientIdx: index('kill_switches_client_idx').on(table.clientId),
  scopeIdx: index('kill_switches_scope_idx').on(table.scope),
}));

/**
 * Kill Switch History Table
 *
 * Audit trail of all state changes.
 */
export const killSwitchHistory = pgTable('kill_switch_history', {
  id: varchar('id', { length: 36 }).primaryKey(),
  killSwitchId: varchar('kill_switch_id', { length: 36 }).notNull()
    .references(() => killSwitches.id),

  // Change details
  action: varchar('action', { length: 20 }).notNull(), // 'activated', 'deactivated', 'created', 'updated'
  previousState: boolean('previous_state'),
  newState: boolean('new_state'),

  // Context
  reason: text('reason'),
  performedBy: varchar('performed_by', { length: 100 }).notNull(),
  performedAt: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),

  // Additional metadata
  metadata: jsonb('metadata').$type<{
    trigger?: 'manual' | 'auto_trip' | 'incident' | 'api';
    incidentId?: string;
    errorRate?: number;
    threshold?: number;
    samples?: number;
    activeDuration?: number; // ms, for deactivation events
  }>(),
}, (table) => ({
  killSwitchIdx: index('kill_switch_history_ks_idx').on(table.killSwitchId),
  performedAtIdx: index('kill_switch_history_performed_at_idx').on(table.performedAt),
}));

// Type exports
export type KillSwitch = typeof killSwitches.$inferSelect;
export type NewKillSwitch = typeof killSwitches.$inferInsert;
export type KillSwitchHistoryEntry = typeof killSwitchHistory.$inferSelect;
export type NewKillSwitchHistoryEntry = typeof killSwitchHistory.$inferInsert;
```

#### 2.2 Create Kill Switch Types

**File:** `packages/policy/src/kill-switch/types.ts`

```typescript
import { z } from 'zod';

/**
 * Kill Switch Scopes
 */
export const KillSwitchScopeSchema = z.enum(['global', 'client', 'platform', 'action']);
export type KillSwitchScope = z.infer<typeof KillSwitchScopeSchema>;

export const KillSwitchTargetTypeSchema = z.enum(['all', 'platform', 'action']);
export type KillSwitchTargetType = z.infer<typeof KillSwitchTargetTypeSchema>;

/**
 * Check Context - What we're checking against kill switches
 */
export const KillSwitchCheckContextSchema = z.object({
  action: z.string(),
  platform: z.string().optional(),
  clientId: z.string(),
});
export type KillSwitchCheckContext = z.infer<typeof KillSwitchCheckContextSchema>;

/**
 * Check Result
 */
export const KillSwitchCheckResultSchema = z.object({
  tripped: z.boolean(),
  switch: z.object({
    id: z.string(),
    scope: KillSwitchScopeSchema,
    targetType: KillSwitchTargetTypeSchema,
    targetValue: z.string(),
    clientId: z.string().nullable(),
    reason: z.string().nullable(),
    activatedAt: z.date().nullable(),
    activatedBy: z.string().nullable(),
  }).nullable(),
  reason: z.string().nullable(),
  checkDurationMs: z.number(),
});
export type KillSwitchCheckResult = z.infer<typeof KillSwitchCheckResultSchema>;

/**
 * Activation Input
 */
export const ActivateKillSwitchInputSchema = z.object({
  id: z.string(),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  activatedBy: z.string(),
  incidentId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ActivateKillSwitchInput = z.infer<typeof ActivateKillSwitchInputSchema>;

/**
 * Deactivation Input
 */
export const DeactivateKillSwitchInputSchema = z.object({
  id: z.string(),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  deactivatedBy: z.string(),
  metadata: z.record(z.unknown()).optional(),
});
export type DeactivateKillSwitchInput = z.infer<typeof DeactivateKillSwitchInputSchema>;

/**
 * Create Kill Switch Input
 */
export const CreateKillSwitchInputSchema = z.object({
  scope: KillSwitchScopeSchema,
  targetType: KillSwitchTargetTypeSchema,
  targetValue: z.string(),
  clientId: z.string().optional(),
  platform: z.string().optional(),
  createdBy: z.string(),
  autoTripConfig: z.object({
    enabled: z.boolean(),
    errorRateThreshold: z.number().min(0).max(1),
    minSamples: z.number().int().positive(),
    windowMs: z.number().int().positive(),
    cooldownMs: z.number().int().positive(),
  }).optional(),
}).refine(
  (data) => {
    // Client scope requires clientId
    if (data.scope === 'client' && !data.clientId) {
      return false;
    }
    // Global scope cannot have clientId
    if (data.scope === 'global' && data.clientId) {
      return false;
    }
    return true;
  },
  {
    message: 'Invalid scope/clientId combination',
  }
);
export type CreateKillSwitchInput = z.infer<typeof CreateKillSwitchInputSchema>;

/**
 * Auto-Trip Configuration
 */
export const AutoTripConfigSchema = z.object({
  enabled: z.boolean().default(true),
  errorRateThreshold: z.number().min(0).max(1).default(0.5),
  minSamples: z.number().int().positive().default(10),
  windowMs: z.number().int().positive().default(60_000),
  cooldownMs: z.number().int().positive().default(300_000), // 5 min cooldown
});
export type AutoTripConfig = z.infer<typeof AutoTripConfigSchema>;

/**
 * Auto-Trip Result Record
 */
export const AutoTripResultSchema = z.object({
  target: z.string(),
  success: z.boolean(),
  clientId: z.string(),
  timestamp: z.number().optional(),
  errorType: z.string().optional(),
});
export type AutoTripResult = z.infer<typeof AutoTripResultSchema>;

/**
 * Auto-Trip Stats
 */
export interface AutoTripStats {
  errors: number;
  total: number;
  errorRate: number;
  windowStart: number;
  windowEnd: number;
}

/**
 * List Active Options
 */
export const ListActiveOptionsSchema = z.object({
  scope: KillSwitchScopeSchema.optional(),
  clientId: z.string().optional(),
  targetType: KillSwitchTargetTypeSchema.optional(),
  platform: z.string().optional(),
});
export type ListActiveOptions = z.infer<typeof ListActiveOptionsSchema>;
```

#### 2.3 Create Kill Switch Service

**File:** `packages/policy/src/kill-switch/kill-switch-service.ts`

```typescript
import { eq, and, isNull, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Redis } from 'ioredis';
import {
  KillSwitchCheckContext,
  KillSwitchCheckResult,
  ActivateKillSwitchInput,
  DeactivateKillSwitchInput,
  CreateKillSwitchInput,
  ListActiveOptions,
  ActivateKillSwitchInputSchema,
  DeactivateKillSwitchInputSchema,
  CreateKillSwitchInputSchema,
} from './types';
import type { KillSwitch, killSwitches, killSwitchHistory } from '@rtv/db';
import type { AuditEmitter } from '@rtv/audit';

const CACHE_PREFIX = 'kill_switch:';
const CACHE_TTL_SECONDS = 60; // 1 minute cache

interface KillSwitchServiceDeps {
  db: {
    select: () => any;
    insert: (table: any) => any;
    update: (table: any) => any;
    delete: (table: any) => any;
  };
  redis: Redis;
  audit: AuditEmitter;
}

export interface KillSwitchService {
  /**
   * Check if any kill switch is tripped for the given context.
   * Checks in priority order: global > client > platform > action
   */
  isTripped(context: KillSwitchCheckContext): Promise<KillSwitchCheckResult>;

  /**
   * Activate a kill switch
   */
  activate(input: ActivateKillSwitchInput): Promise<void>;

  /**
   * Deactivate a kill switch
   */
  deactivate(input: DeactivateKillSwitchInput): Promise<void>;

  /**
   * Create a new kill switch
   */
  create(input: CreateKillSwitchInput): Promise<KillSwitch>;

  /**
   * List all active kill switches
   */
  listActive(options?: ListActiveOptions): Promise<KillSwitch[]>;

  /**
   * Get a kill switch by ID
   */
  getById(id: string): Promise<KillSwitch | null>;

  /**
   * Invalidate cache for a specific switch or pattern
   */
  invalidateCache(pattern?: string): Promise<void>;
}

export function createKillSwitchService(deps: KillSwitchServiceDeps): KillSwitchService {
  const { db, redis, audit } = deps;

  /**
   * Build cache keys for a context, in priority order
   */
  function buildCacheKeys(context: KillSwitchCheckContext): string[] {
    const keys: string[] = [];

    // 1. Global all (highest priority)
    keys.push(`${CACHE_PREFIX}global:all:*`);

    // 2. Client all
    keys.push(`${CACHE_PREFIX}client:${context.clientId}:all:*`);

    // 3. Global platform
    if (context.platform) {
      keys.push(`${CACHE_PREFIX}global:platform:${context.platform}`);
    }

    // 4. Client platform
    if (context.platform) {
      keys.push(`${CACHE_PREFIX}client:${context.clientId}:platform:${context.platform}`);
    }

    // 5. Global action
    keys.push(`${CACHE_PREFIX}global:action:${context.action}`);

    // 6. Client action
    keys.push(`${CACHE_PREFIX}client:${context.clientId}:action:${context.action}`);

    // 7. Platform-scoped action (if platform specified)
    if (context.platform) {
      keys.push(`${CACHE_PREFIX}global:action:${context.action}:${context.platform}`);
      keys.push(`${CACHE_PREFIX}client:${context.clientId}:action:${context.action}:${context.platform}`);
    }

    return keys;
  }

  /**
   * Build cache key for a specific switch
   */
  function buildSwitchCacheKey(sw: KillSwitch): string {
    const clientPart = sw.clientId ? `client:${sw.clientId}` : 'global';
    const platformPart = sw.platform ? `:${sw.platform}` : '';
    return `${CACHE_PREFIX}${clientPart}:${sw.targetType}:${sw.targetValue}${platformPart}`;
  }

  /**
   * Check cache for an active switch
   */
  async function checkCache(key: string): Promise<KillSwitch | null> {
    const cached = await redis.get(key);
    if (cached) {
      const sw = JSON.parse(cached);
      if (sw.isActive) {
        return {
          ...sw,
          activatedAt: sw.activatedAt ? new Date(sw.activatedAt) : null,
          createdAt: new Date(sw.createdAt),
          updatedAt: new Date(sw.updatedAt),
        };
      }
    }
    return null;
  }

  /**
   * Cache a switch state
   */
  async function cacheSwitch(sw: KillSwitch): Promise<void> {
    const key = buildSwitchCacheKey(sw);
    await redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(sw));
  }

  return {
    async isTripped(context: KillSwitchCheckContext): Promise<KillSwitchCheckResult> {
      const startTime = Date.now();
      const cacheKeys = buildCacheKeys(context);

      // Check cache first (in priority order)
      for (const key of cacheKeys) {
        const cached = await checkCache(key);
        if (cached) {
          return {
            tripped: true,
            switch: {
              id: cached.id,
              scope: cached.scope as any,
              targetType: cached.targetType as any,
              targetValue: cached.targetValue,
              clientId: cached.clientId,
              reason: cached.reason,
              activatedAt: cached.activatedAt,
              activatedBy: cached.activatedBy,
            },
            reason: cached.reason,
            checkDurationMs: Date.now() - startTime,
          };
        }
      }

      // Cache miss - check database
      const activeSwitches = await db.select()
        .from(killSwitches)
        .where(
          and(
            eq(killSwitches.isActive, true),
            or(
              isNull(killSwitches.clientId),
              eq(killSwitches.clientId, context.clientId)
            )
          )
        );

      // Check each switch against context
      for (const sw of activeSwitches) {
        let matches = false;

        switch (sw.scope) {
          case 'global':
            if (sw.targetType === 'all') {
              matches = true;
            } else if (sw.targetType === 'platform' && sw.targetValue === context.platform) {
              matches = true;
            } else if (sw.targetType === 'action' && sw.targetValue === context.action) {
              if (!sw.platform || sw.platform === context.platform) {
                matches = true;
              }
            }
            break;

          case 'client':
            if (sw.clientId === context.clientId) {
              if (sw.targetType === 'all') {
                matches = true;
              } else if (sw.targetType === 'platform' && sw.targetValue === context.platform) {
                matches = true;
              } else if (sw.targetType === 'action' && sw.targetValue === context.action) {
                if (!sw.platform || sw.platform === context.platform) {
                  matches = true;
                }
              }
            }
            break;
        }

        if (matches) {
          // Cache the hit
          await cacheSwitch(sw);

          return {
            tripped: true,
            switch: {
              id: sw.id,
              scope: sw.scope as any,
              targetType: sw.targetType as any,
              targetValue: sw.targetValue,
              clientId: sw.clientId,
              reason: sw.reason,
              activatedAt: sw.activatedAt,
              activatedBy: sw.activatedBy,
            },
            reason: sw.reason,
            checkDurationMs: Date.now() - startTime,
          };
        }
      }

      return {
        tripped: false,
        switch: null,
        reason: null,
        checkDurationMs: Date.now() - startTime,
      };
    },

    async activate(input: ActivateKillSwitchInput): Promise<void> {
      const validated = ActivateKillSwitchInputSchema.parse(input);

      // Get current state
      const [existing] = await db.select()
        .from(killSwitches)
        .where(eq(killSwitches.id, validated.id));

      if (!existing) {
        throw new Error(`Kill switch not found: ${validated.id}`);
      }

      if (existing.isActive) {
        // Already active, no-op
        return;
      }

      const now = new Date();

      // Update state
      await db.update(killSwitches)
        .set({
          isActive: true,
          reason: validated.reason,
          activatedBy: validated.activatedBy,
          activatedAt: now,
          updatedAt: now,
        })
        .where(eq(killSwitches.id, validated.id));

      // Record history
      await db.insert(killSwitchHistory).values({
        id: `ksh_${nanoid()}`,
        killSwitchId: validated.id,
        action: 'activated',
        previousState: false,
        newState: true,
        reason: validated.reason,
        performedBy: validated.activatedBy,
        performedAt: now,
        metadata: {
          trigger: validated.activatedBy.startsWith('system:') ? 'auto_trip' : 'manual',
          incidentId: validated.incidentId,
          ...validated.metadata,
        },
      });

      // Invalidate cache
      await this.invalidateCache();

      // Emit audit event
      await audit.emit({
        type: 'KILL_SWITCH_ACTIVATED',
        actor: validated.activatedBy,
        target: validated.id,
        metadata: {
          reason: validated.reason,
          incidentId: validated.incidentId,
          previousState: false,
          newState: true,
          scope: existing.scope,
          targetType: existing.targetType,
          targetValue: existing.targetValue,
          clientId: existing.clientId,
        },
      });
    },

    async deactivate(input: DeactivateKillSwitchInput): Promise<void> {
      const validated = DeactivateKillSwitchInputSchema.parse(input);

      // Get current state
      const [existing] = await db.select()
        .from(killSwitches)
        .where(eq(killSwitches.id, validated.id));

      if (!existing) {
        throw new Error(`Kill switch not found: ${validated.id}`);
      }

      if (!existing.isActive) {
        // Already inactive, no-op
        return;
      }

      const now = new Date();
      const activeDuration = existing.activatedAt
        ? now.getTime() - existing.activatedAt.getTime()
        : null;

      // Update state
      await db.update(killSwitches)
        .set({
          isActive: false,
          updatedAt: now,
        })
        .where(eq(killSwitches.id, validated.id));

      // Record history
      await db.insert(killSwitchHistory).values({
        id: `ksh_${nanoid()}`,
        killSwitchId: validated.id,
        action: 'deactivated',
        previousState: true,
        newState: false,
        reason: validated.reason,
        performedBy: validated.deactivatedBy,
        performedAt: now,
        metadata: {
          trigger: 'manual',
          activeDuration,
          ...validated.metadata,
        },
      });

      // Invalidate cache
      await this.invalidateCache();

      // Emit audit event
      await audit.emit({
        type: 'KILL_SWITCH_DEACTIVATED',
        actor: validated.deactivatedBy,
        target: validated.id,
        metadata: {
          reason: validated.reason,
          previousState: true,
          newState: false,
          activeDuration,
          scope: existing.scope,
          targetType: existing.targetType,
          targetValue: existing.targetValue,
          clientId: existing.clientId,
        },
      });
    },

    async create(input: CreateKillSwitchInput): Promise<KillSwitch> {
      const validated = CreateKillSwitchInputSchema.parse(input);

      // Additional validation
      if (validated.scope === 'client' && !validated.clientId) {
        throw new Error('Client scope requires clientId');
      }
      if (validated.scope === 'global' && validated.clientId) {
        throw new Error('Global scope cannot have clientId');
      }

      const now = new Date();
      const id = `ks_${nanoid()}`;

      const [created] = await db.insert(killSwitches).values({
        id,
        scope: validated.scope,
        targetType: validated.targetType,
        targetValue: validated.targetValue,
        clientId: validated.clientId || null,
        platform: validated.platform || null,
        isActive: false,
        reason: null,
        activatedBy: null,
        activatedAt: null,
        autoTripConfig: validated.autoTripConfig || null,
        createdAt: now,
        updatedAt: now,
      }).returning();

      // Record history
      await db.insert(killSwitchHistory).values({
        id: `ksh_${nanoid()}`,
        killSwitchId: id,
        action: 'created',
        previousState: null,
        newState: false,
        reason: 'Kill switch created',
        performedBy: validated.createdBy,
        performedAt: now,
        metadata: {},
      });

      // Emit audit event
      await audit.emit({
        type: 'KILL_SWITCH_CREATED',
        actor: validated.createdBy,
        target: id,
        metadata: {
          scope: validated.scope,
          targetType: validated.targetType,
          targetValue: validated.targetValue,
          clientId: validated.clientId,
          platform: validated.platform,
        },
      });

      return created;
    },

    async listActive(options?: ListActiveOptions): Promise<KillSwitch[]> {
      let query = db.select().from(killSwitches).where(eq(killSwitches.isActive, true));

      if (options?.scope) {
        query = query.where(eq(killSwitches.scope, options.scope));
      }
      if (options?.clientId) {
        query = query.where(
          or(
            isNull(killSwitches.clientId),
            eq(killSwitches.clientId, options.clientId)
          )
        );
      }
      if (options?.targetType) {
        query = query.where(eq(killSwitches.targetType, options.targetType));
      }
      if (options?.platform) {
        query = query.where(
          or(
            isNull(killSwitches.platform),
            eq(killSwitches.platform, options.platform)
          )
        );
      }

      return query;
    },

    async getById(id: string): Promise<KillSwitch | null> {
      const [sw] = await db.select()
        .from(killSwitches)
        .where(eq(killSwitches.id, id));
      return sw || null;
    },

    async invalidateCache(pattern?: string): Promise<void> {
      const keyPattern = pattern || `${CACHE_PREFIX}*`;
      const keys = await redis.keys(keyPattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    },
  };
}
```

#### 2.4 Create Auto-Trip Monitor

**File:** `packages/policy/src/kill-switch/auto-trip.ts`

```typescript
import type { KillSwitchService } from './kill-switch-service';
import type { AutoTripResult, AutoTripStats, AutoTripConfig } from './types';

interface AutoTripThreshold {
  errorRate: number;
  minSamples: number;
}

interface AutoTripMonitorConfig {
  windowMs: number;
  thresholds: Record<string, AutoTripThreshold>;
  checkIntervalMs: number;
  cooldownMs?: number;
}

interface AutoTripMonitorDeps {
  killSwitchService: KillSwitchService;
  metrics?: {
    increment(name: string, tags?: Record<string, string>): void;
    gauge(name: string, value: number, tags?: Record<string, string>): void;
  };
  config: AutoTripMonitorConfig;
}

interface ResultRecord {
  success: boolean;
  timestamp: number;
  clientId: string;
  errorType?: string;
}

export interface AutoTripMonitor {
  /**
   * Record a result for auto-trip calculation
   */
  recordResult(result: AutoTripResult): Promise<void>;

  /**
   * Get current stats for a target
   */
  getStats(target: string, clientId?: string): AutoTripStats;

  /**
   * Start the monitor
   */
  start(): void;

  /**
   * Stop the monitor
   */
  stop(): void;
}

export function createAutoTripMonitor(deps: AutoTripMonitorDeps): AutoTripMonitor {
  const { killSwitchService, metrics, config } = deps;

  // In-memory sliding window storage
  // Map<target, Map<clientId, ResultRecord[]>>
  const results = new Map<string, Map<string, ResultRecord[]>>();

  // Cooldown tracking
  const cooldowns = new Map<string, number>(); // target:clientId -> timestamp

  let checkInterval: NodeJS.Timeout | null = null;

  /**
   * Clean expired records from a results array
   */
  function cleanExpired(records: ResultRecord[], now: number): ResultRecord[] {
    const windowStart = now - config.windowMs;
    return records.filter(r => r.timestamp >= windowStart);
  }

  /**
   * Calculate stats for a target/client combination
   */
  function calculateStats(records: ResultRecord[], now: number): AutoTripStats {
    const cleaned = cleanExpired(records, now);
    const errors = cleaned.filter(r => !r.success).length;
    const total = cleaned.length;

    return {
      errors,
      total,
      errorRate: total > 0 ? errors / total : 0,
      windowStart: now - config.windowMs,
      windowEnd: now,
    };
  }

  /**
   * Check if a target should be tripped
   */
  async function checkTrip(target: string, clientId: string, stats: AutoTripStats): Promise<void> {
    const threshold = config.thresholds[target];
    if (!threshold) return;

    // Check minimum samples
    if (stats.total < threshold.minSamples) return;

    // Check error rate
    if (stats.errorRate < threshold.errorRate) return;

    // Check cooldown
    const cooldownKey = `${target}:${clientId}`;
    const lastTrip = cooldowns.get(cooldownKey);
    if (lastTrip && Date.now() - lastTrip < (config.cooldownMs || 300_000)) {
      return;
    }

    // Find or create the kill switch for this target
    // Parse target to determine scope
    const [targetType, targetValue] = target.split(':');

    // Try to find existing switch
    const activeSwitches = await killSwitchService.listActive({
      targetType: targetType as any,
      clientId,
    });

    // Find matching switch or use a default
    let switchId: string | null = null;
    for (const sw of activeSwitches) {
      if (sw.targetValue === targetValue) {
        // Already active, update cooldown and return
        cooldowns.set(cooldownKey, Date.now());
        return;
      }
    }

    // Need to create and activate a switch
    // For now, log and emit metrics - actual creation would need switch ID
    console.warn(`[AutoTrip] Would trip switch for ${target} (client: ${clientId})`, {
      errorRate: stats.errorRate,
      threshold: threshold.errorRate,
      samples: stats.total,
    });

    metrics?.increment('auto_trip.triggered', {
      target,
      client_id: clientId,
    });

    // Update cooldown
    cooldowns.set(cooldownKey, Date.now());
  }

  /**
   * Check all targets for potential trips
   */
  async function checkAllTargets(): Promise<void> {
    const now = Date.now();

    for (const [target, clientMap] of results.entries()) {
      for (const [clientId, records] of clientMap.entries()) {
        const stats = calculateStats(records, now);
        await checkTrip(target, clientId, stats);
      }
    }
  }

  return {
    async recordResult(result: AutoTripResult): Promise<void> {
      const now = result.timestamp || Date.now();

      // Get or create target map
      let clientMap = results.get(result.target);
      if (!clientMap) {
        clientMap = new Map();
        results.set(result.target, clientMap);
      }

      // Get or create client array
      let records = clientMap.get(result.clientId);
      if (!records) {
        records = [];
        clientMap.set(result.clientId, records);
      }

      // Add record
      records.push({
        success: result.success,
        timestamp: now,
        clientId: result.clientId,
        errorType: result.errorType,
      });

      // Clean expired
      const cleaned = cleanExpired(records, now);
      clientMap.set(result.clientId, cleaned);

      // Update metrics
      metrics?.increment('auto_trip.result', {
        target: result.target,
        success: String(result.success),
        client_id: result.clientId,
      });
    },

    getStats(target: string, clientId?: string): AutoTripStats {
      const now = Date.now();
      const clientMap = results.get(target);

      if (!clientMap) {
        return { errors: 0, total: 0, errorRate: 0, windowStart: now - config.windowMs, windowEnd: now };
      }

      if (clientId) {
        const records = clientMap.get(clientId) || [];
        return calculateStats(records, now);
      }

      // Aggregate across all clients
      let totalErrors = 0;
      let totalRecords = 0;

      for (const records of clientMap.values()) {
        const cleaned = cleanExpired(records, now);
        totalErrors += cleaned.filter(r => !r.success).length;
        totalRecords += cleaned.length;
      }

      return {
        errors: totalErrors,
        total: totalRecords,
        errorRate: totalRecords > 0 ? totalErrors / totalRecords : 0,
        windowStart: now - config.windowMs,
        windowEnd: now,
      };
    },

    start(): void {
      if (checkInterval) return;

      checkInterval = setInterval(() => {
        checkAllTargets().catch(err => {
          console.error('[AutoTrip] Check failed:', err);
        });
      }, config.checkIntervalMs);
    },

    stop(): void {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    },
  };
}
```

#### 2.5 Create Module Index

**File:** `packages/policy/src/kill-switch/index.ts`

```typescript
export * from './types';
export * from './kill-switch-service';
export * from './auto-trip';
```

---

### Phase 3: Verification

#### 3.1 Run Tests

```bash
# Run all kill switch tests
cd packages/policy
pnpm test src/kill-switch/

# Run with coverage
pnpm test:coverage src/kill-switch/
```

#### 3.2 Type Check

```bash
pnpm typecheck
```

#### 3.3 Lint

```bash
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/db/src/schema/kill-switches.ts` | Kill switch and history tables |
| Modify | `packages/db/src/schema/index.ts` | Export kill switch schema |
| Create | `packages/db/drizzle/XXXX_add_kill_switches.sql` | Migration file |
| Create | `packages/policy/src/kill-switch/types.ts` | Type definitions |
| Create | `packages/policy/src/kill-switch/kill-switch-service.ts` | Core service |
| Create | `packages/policy/src/kill-switch/auto-trip.ts` | Auto-trip monitor |
| Create | `packages/policy/src/kill-switch/index.ts` | Module exports |
| Create | `packages/db/src/schema/__tests__/kill-switches.test.ts` | Schema tests |
| Create | `packages/policy/src/kill-switch/__tests__/kill-switch-service.test.ts` | Service tests |
| Create | `packages/policy/src/kill-switch/__tests__/auto-trip.test.ts` | Auto-trip tests |

---

## Acceptance Criteria

- [ ] Kill switch schema defined with all required fields
- [ ] Unique constraint on scope+target+client combination
- [ ] Kill switch history tracks all state changes
- [ ] `isTripped()` checks in priority order: global > client > platform > action
- [ ] Cache layer (Redis) with TTL for fast checks
- [ ] Database fallback when cache misses
- [ ] `activate()` updates state and emits audit event
- [ ] `deactivate()` updates state and tracks duration
- [ ] Auto-trip monitor tracks error rates in sliding window
- [ ] Auto-trip triggers based on configurable thresholds
- [ ] Cooldown prevents repeated auto-trips
- [ ] All tests pass with >80% coverage
- [ ] TypeScript compiles with no errors

---

## Test Requirements

### Unit Tests

- Kill switch schema constraints
- Cache key building
- Priority order checking
- Activation/deactivation state transitions
- History recording
- Auto-trip threshold calculation
- Cooldown enforcement

### Integration Tests

- Full check flow: cache → database → match
- Concurrent activation handling
- Cache invalidation
- History queries

### Performance Tests

- Check latency <5ms (cache hit)
- Check latency <50ms (cache miss)
- 10K checks/second throughput

---

## Security & Safety Checklist

- [ ] No hardcoded secrets
- [ ] Client isolation: switches scoped to client cannot affect other clients
- [ ] Audit trail: all state changes logged
- [ ] Authorization: activation requires appropriate permissions
- [ ] Reason required: no activation without documented reason
- [ ] Cache TTL: prevents stale switch states

---

## JSON Task Block

```json
{
  "task_id": "S1-C3",
  "name": "Kill Switch Infrastructure",
  "status": "pending",
  "complexity": "high",
  "sprint": 1,
  "agent": "C",
  "dependencies": ["S1-C1"],
  "blocks": ["S1-C5", "S3-C1", "S5-C1", "S5-C2", "S5-C3", "S5-C4", "S5-C5"],
  "estimated_hours": 6,
  "actual_hours": null,
  "files": [
    "packages/db/src/schema/kill-switches.ts",
    "packages/policy/src/kill-switch/types.ts",
    "packages/policy/src/kill-switch/kill-switch-service.ts",
    "packages/policy/src/kill-switch/auto-trip.ts",
    "packages/policy/src/kill-switch/index.ts"
  ],
  "test_files": [
    "packages/db/src/schema/__tests__/kill-switches.test.ts",
    "packages/policy/src/kill-switch/__tests__/kill-switch-service.test.ts",
    "packages/policy/src/kill-switch/__tests__/auto-trip.test.ts"
  ],
  "acceptance_criteria": [
    "Kill switch schema with unique constraints",
    "isTripped() checks priority order",
    "Redis cache with database fallback",
    "Auto-trip based on error rate thresholds",
    "Full audit trail of state changes"
  ]
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "artifacts": {
    "files_created": [],
    "tests_passed": null,
    "coverage_percent": null
  },
  "learnings": [],
  "blockers_encountered": []
}
```
