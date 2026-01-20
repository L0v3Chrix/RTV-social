# Build Prompt: S5-C3 — Per-Platform Kill Switch

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-C3 |
| Sprint | 5 - Gated Rollout |
| Agent | C - Kill Switch Implementation |
| Task Name | Per-Platform Kill Switch |
| Complexity | Medium |
| Status | pending |
| Dependencies | S5-C1 |
| Blocked By | None |

---

## Context

### What This Builds

The PlatformKillSwitch that halts operations for a specific platform (Meta, TikTok, YouTube, etc.) across ALL clients. Essential for responding to platform-specific outages, API changes, or rate limit issues.

### Why It Matters

- **Platform Isolation**: Issues on one platform don't affect others
- **API Outage Response**: Halt when platform APIs are down
- **Rate Limit Recovery**: Pause during rate limit windows
- **Compliance**: Quick response to platform policy changes
- **Targeted Recovery**: Resume one platform at a time

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Platform Connectors | Platform architecture |
| `docs/09-platform-playbooks/` | All | Platform-specific operations |
| `docs/runbooks/RB-04-platform-outage.md` | Response | Outage procedures |

---

## Prerequisites

### Completed Tasks

- [x] S5-C1: Global kill switch (provides base patterns)
- [x] S3-B1 through S3-B6: Platform API connectors (defines platforms)

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/safety/kill-switch/src/__tests__/platform-kill-switch.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlatformKillSwitch, Platform } from '../platform-kill-switch';

describe('PlatformKillSwitch', () => {
  let killSwitch: PlatformKillSwitch;
  let mockStore: any;
  let mockAudit: any;
  let mockNotifier: any;

  beforeEach(() => {
    mockStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      scan: vi.fn().mockResolvedValue([]),
    };

    mockAudit = { emit: vi.fn() };
    mockNotifier = { notifyOperators: vi.fn(), notifyOncall: vi.fn() };

    killSwitch = new PlatformKillSwitch({
      store: mockStore,
      audit: mockAudit,
      notifier: mockNotifier,
    });
  });

  describe('activateForPlatform', () => {
    it('should activate kill switch for specific platform', async () => {
      await killSwitch.activateForPlatform('meta', {
        reason: 'Meta API outage detected',
        activatedBy: 'operator_1',
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        'kill_switch:platform:meta',
        expect.objectContaining({
          active: true,
          platform: 'meta',
          reason: 'Meta API outage detected',
        })
      );
    });

    it('should validate platform is in allowed list', async () => {
      await expect(
        killSwitch.activateForPlatform('invalid_platform' as Platform, {
          reason: 'Test',
          activatedBy: 'operator_1',
        })
      ).rejects.toThrow('Invalid platform');
    });

    it('should emit platform-specific audit event', async () => {
      await killSwitch.activateForPlatform('tiktok', {
        reason: 'Rate limit exceeded',
        activatedBy: 'operator_1',
      });

      expect(mockAudit.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'kill_switch.platform.activated',
          details: expect.objectContaining({ platform: 'tiktok' }),
        })
      );
    });
  });

  describe('deactivateForPlatform', () => {
    it('should deactivate platform kill switch', async () => {
      mockStore.get.mockResolvedValue({ active: true, platform: 'meta' });

      await killSwitch.deactivateForPlatform('meta', {
        reason: 'API restored',
        deactivatedBy: 'operator_1',
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        'kill_switch:platform:meta',
        expect.objectContaining({
          active: false,
          deactivatedAt: expect.any(String),
        })
      );
    });
  });

  describe('isActiveForPlatform', () => {
    it('should return true when platform switch is active', async () => {
      mockStore.get.mockResolvedValue({ active: true });

      const result = await killSwitch.isActiveForPlatform('youtube');

      expect(result).toBe(true);
    });

    it('should return false when platform switch is not active', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await killSwitch.isActiveForPlatform('youtube');

      expect(result).toBe(false);
    });
  });

  describe('checkBeforeAction', () => {
    it('should throw when platform switch is active', async () => {
      mockStore.get.mockResolvedValue({ active: true, reason: 'Outage' });

      await expect(
        killSwitch.checkBeforeAction('meta')
      ).rejects.toThrow('Kill switch active for platform meta');
    });

    it('should pass when platform switch is not active', async () => {
      mockStore.get.mockResolvedValue(null);

      await expect(
        killSwitch.checkBeforeAction('meta')
      ).resolves.not.toThrow();
    });
  });

  describe('listActivePlatforms', () => {
    it('should return all platforms with active kill switches', async () => {
      mockStore.scan.mockResolvedValue([
        { key: 'kill_switch:platform:meta', value: { active: true, platform: 'meta' } },
        { key: 'kill_switch:platform:tiktok', value: { active: true, platform: 'tiktok' } },
      ]);

      const result = await killSwitch.listActivePlatforms();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.platform)).toContain('meta');
      expect(result.map(p => p.platform)).toContain('tiktok');
    });
  });

  describe('getAllPlatformStatuses', () => {
    it('should return status for all known platforms', async () => {
      mockStore.get
        .mockResolvedValueOnce({ active: true, platform: 'meta' }) // meta
        .mockResolvedValueOnce(null) // tiktok
        .mockResolvedValueOnce(null) // youtube
        .mockResolvedValueOnce(null) // linkedin
        .mockResolvedValueOnce(null) // x
        .mockResolvedValueOnce(null); // skool

      const statuses = await killSwitch.getAllPlatformStatuses();

      expect(statuses.meta.active).toBe(true);
      expect(statuses.tiktok.active).toBe(false);
    });
  });

  describe('activateForClientPlatform', () => {
    it('should activate for specific client+platform combination', async () => {
      await killSwitch.activateForClientPlatform('client_123', 'meta', {
        reason: 'Client-specific Meta issue',
        activatedBy: 'operator_1',
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        'kill_switch:client_platform:client_123:meta',
        expect.objectContaining({
          active: true,
          clientId: 'client_123',
          platform: 'meta',
        })
      );
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/safety/kill-switch/src/platform-kill-switch.ts`

```typescript
import { z } from 'zod';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('kill-switch');

export const PLATFORMS = ['meta', 'tiktok', 'youtube', 'linkedin', 'x', 'skool'] as const;
export type Platform = typeof PLATFORMS[number];

export const PlatformActivationSchema = z.object({
  reason: z.string().min(5),
  activatedBy: z.string(),
  severity: z.enum(['warning', 'high', 'critical']).default('high'),
  estimatedRecovery: z.string().optional(),
  platformIncidentUrl: z.string().url().optional(),
});

export const PlatformDeactivationSchema = z.object({
  reason: z.string().min(5),
  deactivatedBy: z.string(),
});

export interface PlatformKillSwitchState {
  active: boolean;
  platform: Platform;
  activatedAt: string;
  activatedBy: string;
  reason: string;
  severity: string;
  estimatedRecovery?: string;
  platformIncidentUrl?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  deactivationReason?: string;
}

export interface ClientPlatformKillSwitchState extends PlatformKillSwitchState {
  clientId: string;
}

export interface PlatformKillSwitchConfig {
  store: any;
  audit: any;
  notifier: any;
}

export class PlatformKillSwitch {
  private store: any;
  private audit: any;
  private notifier: any;

  private readonly PLATFORM_PREFIX = 'kill_switch:platform:';
  private readonly CLIENT_PLATFORM_PREFIX = 'kill_switch:client_platform:';
  private readonly HISTORY_PREFIX = 'kill_switch:platform:history:';

  constructor(config: PlatformKillSwitchConfig) {
    this.store = config.store;
    this.audit = config.audit;
    this.notifier = config.notifier;
  }

  async activateForPlatform(
    platform: Platform,
    input: z.infer<typeof PlatformActivationSchema>
  ): Promise<void> {
    return tracer.startActiveSpan('PlatformKillSwitch.activateForPlatform', async (span) => {
      try {
        if (!PLATFORMS.includes(platform)) {
          throw new Error(`Invalid platform: ${platform}`);
        }

        span.setAttributes({ 'platform': platform });
        const validated = PlatformActivationSchema.parse(input);

        const state: PlatformKillSwitchState = {
          active: true,
          platform,
          activatedAt: new Date().toISOString(),
          activatedBy: validated.activatedBy,
          reason: validated.reason,
          severity: validated.severity,
          estimatedRecovery: validated.estimatedRecovery,
          platformIncidentUrl: validated.platformIncidentUrl,
        };

        await this.store.set(`${this.PLATFORM_PREFIX}${platform}`, state);

        // Record in history
        await this.appendPlatformHistory(platform, state);

        // Emit audit event
        await this.audit.emit({
          eventType: 'kill_switch.platform.activated',
          actor: validated.activatedBy,
          details: {
            platform,
            reason: validated.reason,
            severity: validated.severity,
            estimatedRecovery: validated.estimatedRecovery,
          },
        });

        // Notify on-call for critical issues
        if (validated.severity === 'critical') {
          await this.notifier.notifyOncall({
            type: 'PLATFORM_KILL_SWITCH_ACTIVATED',
            platform,
            severity: validated.severity,
            message: `Kill switch activated for ${platform}: ${validated.reason}`,
            activatedBy: validated.activatedBy,
          });
        } else {
          await this.notifier.notifyOperators({
            type: 'PLATFORM_KILL_SWITCH_ACTIVATED',
            platform,
            severity: validated.severity,
            message: `Kill switch activated for ${platform}: ${validated.reason}`,
          });
        }
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async deactivateForPlatform(
    platform: Platform,
    input: z.infer<typeof PlatformDeactivationSchema>
  ): Promise<void> {
    return tracer.startActiveSpan('PlatformKillSwitch.deactivateForPlatform', async (span) => {
      try {
        span.setAttributes({ 'platform': platform });
        const validated = PlatformDeactivationSchema.parse(input);

        const current = await this.store.get(`${this.PLATFORM_PREFIX}${platform}`);
        if (!current?.active) {
          return;
        }

        const state: PlatformKillSwitchState = {
          ...current,
          active: false,
          deactivatedAt: new Date().toISOString(),
          deactivatedBy: validated.deactivatedBy,
          deactivationReason: validated.reason,
        };

        await this.store.set(`${this.PLATFORM_PREFIX}${platform}`, state);

        // Update history
        await this.updatePlatformHistoryEntry(platform, current.activatedAt, {
          deactivatedAt: state.deactivatedAt,
          deactivatedBy: state.deactivatedBy,
          deactivationReason: state.deactivationReason,
        });

        // Emit audit event
        await this.audit.emit({
          eventType: 'kill_switch.platform.deactivated',
          actor: validated.deactivatedBy,
          details: {
            platform,
            reason: validated.reason,
          },
        });

        await this.notifier.notifyOperators({
          type: 'PLATFORM_KILL_SWITCH_DEACTIVATED',
          platform,
          severity: 'info',
          message: `Kill switch deactivated for ${platform}: ${validated.reason}`,
        });
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async isActiveForPlatform(platform: Platform): Promise<boolean> {
    const state = await this.store.get(`${this.PLATFORM_PREFIX}${platform}`);
    return state?.active === true;
  }

  async getStateForPlatform(platform: Platform): Promise<PlatformKillSwitchState | null> {
    return this.store.get(`${this.PLATFORM_PREFIX}${platform}`);
  }

  async checkBeforeAction(platform: Platform): Promise<void> {
    const state = await this.store.get(`${this.PLATFORM_PREFIX}${platform}`);
    if (state?.active) {
      throw new Error(`Kill switch active for platform ${platform}: ${state.reason}`);
    }
  }

  async listActivePlatforms(): Promise<PlatformKillSwitchState[]> {
    const results = await this.store.scan(`${this.PLATFORM_PREFIX}*`);
    return results
      .map((r: any) => r.value)
      .filter((s: PlatformKillSwitchState) => s.active);
  }

  async getAllPlatformStatuses(): Promise<Record<Platform, { active: boolean; state?: PlatformKillSwitchState }>> {
    const statuses: Record<string, { active: boolean; state?: PlatformKillSwitchState }> = {};

    for (const platform of PLATFORMS) {
      const state = await this.store.get(`${this.PLATFORM_PREFIX}${platform}`);
      statuses[platform] = {
        active: state?.active === true,
        state: state || undefined,
      };
    }

    return statuses as Record<Platform, { active: boolean; state?: PlatformKillSwitchState }>;
  }

  // Client-specific platform kill switch
  async activateForClientPlatform(
    clientId: string,
    platform: Platform,
    input: z.infer<typeof PlatformActivationSchema>
  ): Promise<void> {
    if (!PLATFORMS.includes(platform)) {
      throw new Error(`Invalid platform: ${platform}`);
    }

    const validated = PlatformActivationSchema.parse(input);

    const state: ClientPlatformKillSwitchState = {
      active: true,
      clientId,
      platform,
      activatedAt: new Date().toISOString(),
      activatedBy: validated.activatedBy,
      reason: validated.reason,
      severity: validated.severity,
      estimatedRecovery: validated.estimatedRecovery,
    };

    await this.store.set(`${this.CLIENT_PLATFORM_PREFIX}${clientId}:${platform}`, state);

    await this.audit.emit({
      eventType: 'kill_switch.client_platform.activated',
      clientId,
      actor: validated.activatedBy,
      details: {
        platform,
        reason: validated.reason,
      },
    });
  }

  async deactivateForClientPlatform(
    clientId: string,
    platform: Platform,
    input: z.infer<typeof PlatformDeactivationSchema>
  ): Promise<void> {
    const validated = PlatformDeactivationSchema.parse(input);
    const current = await this.store.get(`${this.CLIENT_PLATFORM_PREFIX}${clientId}:${platform}`);

    if (!current?.active) {
      return;
    }

    await this.store.set(`${this.CLIENT_PLATFORM_PREFIX}${clientId}:${platform}`, {
      ...current,
      active: false,
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: validated.deactivatedBy,
      deactivationReason: validated.reason,
    });

    await this.audit.emit({
      eventType: 'kill_switch.client_platform.deactivated',
      clientId,
      actor: validated.deactivatedBy,
      details: { platform, reason: validated.reason },
    });
  }

  async isActiveForClientPlatform(clientId: string, platform: Platform): Promise<boolean> {
    const state = await this.store.get(`${this.CLIENT_PLATFORM_PREFIX}${clientId}:${platform}`);
    return state?.active === true;
  }

  async checkBeforeClientPlatformAction(clientId: string, platform: Platform): Promise<void> {
    // Check global platform first
    await this.checkBeforeAction(platform);

    // Then check client-specific
    const state = await this.store.get(`${this.CLIENT_PLATFORM_PREFIX}${clientId}:${platform}`);
    if (state?.active) {
      throw new Error(`Kill switch active for client ${clientId} platform ${platform}: ${state.reason}`);
    }
  }

  async getPlatformHistory(
    platform: Platform,
    options?: { limit?: number }
  ): Promise<PlatformKillSwitchState[]> {
    const history = await this.store.get(`${this.HISTORY_PREFIX}${platform}`) || [];
    const limit = options?.limit ?? 50;
    return history.slice(-limit);
  }

  private async appendPlatformHistory(
    platform: Platform,
    state: PlatformKillSwitchState
  ): Promise<void> {
    const history = await this.store.get(`${this.HISTORY_PREFIX}${platform}`) || [];
    history.push(state);
    if (history.length > 50) {
      history.shift();
    }
    await this.store.set(`${this.HISTORY_PREFIX}${platform}`, history);
  }

  private async updatePlatformHistoryEntry(
    platform: Platform,
    activatedAt: string,
    update: Partial<PlatformKillSwitchState>
  ): Promise<void> {
    const history = await this.store.get(`${this.HISTORY_PREFIX}${platform}`) || [];
    const index = history.findIndex((h: PlatformKillSwitchState) => h.activatedAt === activatedAt);
    if (index >= 0) {
      history[index] = { ...history[index], ...update };
      await this.store.set(`${this.HISTORY_PREFIX}${platform}`, history);
    }
  }
}
```

---

## Acceptance Criteria

- [ ] Per-platform kill switch halts that platform only
- [ ] All supported platforms enumerated (meta, tiktok, youtube, linkedin, x, skool)
- [ ] Platform validation prevents invalid platform names
- [ ] Client+platform combination switch for granular control
- [ ] Platform status dashboard data available
- [ ] History tracking per platform
- [ ] Estimated recovery time support

---

## JSON Task Block

```json
{
  "task_id": "S5-C3",
  "name": "Per-Platform Kill Switch",
  "description": "PlatformKillSwitch for platform-specific operation halt",
  "status": "pending",
  "dependencies": ["S5-C1"],
  "blocks": ["S5-C5"],
  "agent": "C",
  "sprint": 5,
  "complexity": "medium"
}
```
