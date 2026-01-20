# Build Prompt: S5-C5 — Kill Switch Dashboard

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-C5 |
| Sprint | 5 - Gated Rollout |
| Agent | C - Kill Switch Implementation |
| Task Name | Kill Switch Dashboard |
| Complexity | Medium |
| Status | pending |
| Dependencies | S5-C1, S5-C2, S5-C3, S5-C4 |
| Blocked By | None |

---

## Context

### What This Builds

The KillSwitchDashboard API that provides a unified view of all kill switches across all dimensions (global, client, platform, action). Enables quick access for operators to view status and activate/deactivate switches.

### Why It Matters

- **Visibility**: See all switch states at a glance
- **Quick Access**: One-click activation for emergencies
- **Audit Trail**: Complete history of all switch operations
- **Coordination**: Understand which switches are active and why
- **Operational Safety**: Clear status prevents confusion

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Operator Dashboard | Dashboard architecture |
| `docs/runbooks/RB-03-emergency-response.md` | Dashboard | Operational procedures |
| `docs/06-reliability-ops/slo-error-budget.md` | Observability | Metrics requirements |

---

## Prerequisites

### Completed Tasks

- [x] S5-C1: Global kill switch
- [x] S5-C2: Per-client kill switch
- [x] S5-C3: Per-platform kill switch
- [x] S5-C4: Per-action kill switch

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/safety/kill-switch/src/__tests__/kill-switch-dashboard.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KillSwitchDashboard } from '../kill-switch-dashboard';

describe('KillSwitchDashboard', () => {
  let dashboard: KillSwitchDashboard;
  let mockGlobalSwitch: any;
  let mockClientSwitch: any;
  let mockPlatformSwitch: any;
  let mockActionSwitch: any;

  beforeEach(() => {
    mockGlobalSwitch = {
      isActive: vi.fn().mockResolvedValue(false),
      getState: vi.fn().mockResolvedValue(null),
      getHistory: vi.fn().mockResolvedValue([]),
      activate: vi.fn(),
      deactivate: vi.fn(),
    };

    mockClientSwitch = {
      listActiveClients: vi.fn().mockResolvedValue([]),
      isActiveForClient: vi.fn().mockResolvedValue(false),
      getClientHistory: vi.fn().mockResolvedValue([]),
      activateForClient: vi.fn(),
      deactivateForClient: vi.fn(),
    };

    mockPlatformSwitch = {
      getAllPlatformStatuses: vi.fn().mockResolvedValue({
        meta: { active: false },
        tiktok: { active: false },
        youtube: { active: false },
        linkedin: { active: false },
        x: { active: false },
        skool: { active: false },
      }),
      getPlatformHistory: vi.fn().mockResolvedValue([]),
      activateForPlatform: vi.fn(),
      deactivateForPlatform: vi.fn(),
    };

    mockActionSwitch = {
      getAllActionStatuses: vi.fn().mockResolvedValue({
        publish: { active: false },
        engage: { active: false },
        delete: { active: false },
        schedule: { active: false },
        draft: { active: false },
        read: { active: false },
      }),
      getActionHistory: vi.fn().mockResolvedValue([]),
      activateForAction: vi.fn(),
      deactivateForAction: vi.fn(),
    };

    dashboard = new KillSwitchDashboard({
      globalSwitch: mockGlobalSwitch,
      clientSwitch: mockClientSwitch,
      platformSwitch: mockPlatformSwitch,
      actionSwitch: mockActionSwitch,
    });
  });

  describe('getOverview', () => {
    it('should return complete system overview', async () => {
      const overview = await dashboard.getOverview();

      expect(overview).toHaveProperty('global');
      expect(overview).toHaveProperty('clients');
      expect(overview).toHaveProperty('platforms');
      expect(overview).toHaveProperty('actions');
      expect(overview).toHaveProperty('summary');
    });

    it('should calculate correct summary counts', async () => {
      mockGlobalSwitch.isActive.mockResolvedValue(true);
      mockClientSwitch.listActiveClients.mockResolvedValue([{ clientId: 'c1' }]);
      mockPlatformSwitch.getAllPlatformStatuses.mockResolvedValue({
        meta: { active: true },
        tiktok: { active: true },
        youtube: { active: false },
        linkedin: { active: false },
        x: { active: false },
        skool: { active: false },
      });
      mockActionSwitch.getAllActionStatuses.mockResolvedValue({
        publish: { active: true },
        engage: { active: false },
        delete: { active: false },
        schedule: { active: false },
        draft: { active: false },
        read: { active: false },
      });

      const overview = await dashboard.getOverview();

      expect(overview.summary.globalActive).toBe(true);
      expect(overview.summary.clientsAffected).toBe(1);
      expect(overview.summary.platformsAffected).toBe(2);
      expect(overview.summary.actionsAffected).toBe(1);
      expect(overview.summary.totalActiveCount).toBe(5); // 1 global + 1 client + 2 platforms + 1 action
    });
  });

  describe('getSystemHealth', () => {
    it('should return healthy when no switches active', async () => {
      const health = await dashboard.getSystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.activeKillSwitches).toBe(0);
    });

    it('should return degraded when some switches active', async () => {
      mockPlatformSwitch.getAllPlatformStatuses.mockResolvedValue({
        meta: { active: true },
        tiktok: { active: false },
        youtube: { active: false },
        linkedin: { active: false },
        x: { active: false },
        skool: { active: false },
      });

      const health = await dashboard.getSystemHealth();

      expect(health.status).toBe('degraded');
    });

    it('should return critical when global switch active', async () => {
      mockGlobalSwitch.isActive.mockResolvedValue(true);

      const health = await dashboard.getSystemHealth();

      expect(health.status).toBe('critical');
    });
  });

  describe('quickActivate', () => {
    it('should activate global switch', async () => {
      await dashboard.quickActivate('global', null, {
        reason: 'Emergency',
        activatedBy: 'operator_1',
        severity: 'critical',
      });

      expect(mockGlobalSwitch.activate).toHaveBeenCalled();
    });

    it('should activate client switch', async () => {
      await dashboard.quickActivate('client', 'client_123', {
        reason: 'Client issue',
        activatedBy: 'operator_1',
        severity: 'high',
      });

      expect(mockClientSwitch.activateForClient).toHaveBeenCalledWith(
        'client_123',
        expect.any(Object)
      );
    });

    it('should activate platform switch', async () => {
      await dashboard.quickActivate('platform', 'meta', {
        reason: 'Meta outage',
        activatedBy: 'operator_1',
        severity: 'high',
      });

      expect(mockPlatformSwitch.activateForPlatform).toHaveBeenCalledWith(
        'meta',
        expect.any(Object)
      );
    });

    it('should activate action switch', async () => {
      await dashboard.quickActivate('action', 'publish', {
        reason: 'Publishing errors',
        activatedBy: 'operator_1',
        severity: 'high',
      });

      expect(mockActionSwitch.activateForAction).toHaveBeenCalledWith(
        'publish',
        expect.any(Object)
      );
    });
  });

  describe('quickDeactivate', () => {
    it('should deactivate global switch', async () => {
      await dashboard.quickDeactivate('global', null, {
        reason: 'Resolved',
        deactivatedBy: 'operator_1',
        confirmation: 'CONFIRM_DEACTIVATE',
      });

      expect(mockGlobalSwitch.deactivate).toHaveBeenCalled();
    });
  });

  describe('getRecentHistory', () => {
    it('should return combined history from all switch types', async () => {
      mockGlobalSwitch.getHistory.mockResolvedValue([
        { activatedAt: '2025-01-01T00:00:00Z', type: 'global' },
      ]);
      mockPlatformSwitch.getPlatformHistory
        .mockResolvedValueOnce([{ activatedAt: '2025-01-02T00:00:00Z', platform: 'meta' }]);

      const history = await dashboard.getRecentHistory({ limit: 10 });

      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('checkAllBeforeAction', () => {
    it('should check all relevant switches before action', async () => {
      await expect(
        dashboard.checkAllBeforeAction({
          clientId: 'client_123',
          platform: 'meta',
          action: 'publish',
        })
      ).resolves.not.toThrow();

      expect(mockGlobalSwitch.isActive).toHaveBeenCalled();
      expect(mockClientSwitch.isActiveForClient).toHaveBeenCalledWith('client_123');
      expect(mockPlatformSwitch.getAllPlatformStatuses).toHaveBeenCalled();
      expect(mockActionSwitch.getAllActionStatuses).toHaveBeenCalled();
    });

    it('should throw when any relevant switch is active', async () => {
      mockGlobalSwitch.isActive.mockResolvedValue(true);
      mockGlobalSwitch.getState.mockResolvedValue({ reason: 'Emergency' });

      await expect(
        dashboard.checkAllBeforeAction({
          clientId: 'client_123',
          platform: 'meta',
          action: 'publish',
        })
      ).rejects.toThrow('Kill switch active');
    });
  });

  describe('emergencyHalt', () => {
    it('should activate global and all platform switches', async () => {
      await dashboard.emergencyHalt({
        reason: 'Critical system failure',
        activatedBy: 'operator_1',
      });

      expect(mockGlobalSwitch.activate).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
        })
      );
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/safety/kill-switch/src/kill-switch-dashboard.ts`

```typescript
import { z } from 'zod';
import { trace } from '@opentelemetry/api';
import { GlobalKillSwitch } from './global-kill-switch';
import { ClientKillSwitch } from './client-kill-switch';
import { PlatformKillSwitch, Platform, PLATFORMS } from './platform-kill-switch';
import { ActionKillSwitch, ActionType, ACTIONS } from './action-kill-switch';

const tracer = trace.getTracer('kill-switch-dashboard');

export type SwitchType = 'global' | 'client' | 'platform' | 'action';

export interface DashboardOverview {
  global: {
    active: boolean;
    state: any | null;
  };
  clients: {
    activeCount: number;
    activeList: any[];
  };
  platforms: Record<Platform, { active: boolean; state?: any }>;
  actions: Record<ActionType, { active: boolean; state?: any }>;
  summary: {
    globalActive: boolean;
    clientsAffected: number;
    platformsAffected: number;
    actionsAffected: number;
    totalActiveCount: number;
  };
  timestamp: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  activeKillSwitches: number;
  details: string[];
}

export interface QuickActivateInput {
  reason: string;
  activatedBy: string;
  severity: 'warning' | 'high' | 'critical';
  incidentId?: string;
}

export interface QuickDeactivateInput {
  reason: string;
  deactivatedBy: string;
  confirmation?: 'CONFIRM_DEACTIVATE';
}

export interface ActionContext {
  clientId: string;
  platform: Platform;
  action: ActionType;
}

export interface KillSwitchDashboardConfig {
  globalSwitch: GlobalKillSwitch;
  clientSwitch: ClientKillSwitch;
  platformSwitch: PlatformKillSwitch;
  actionSwitch: ActionKillSwitch;
}

export class KillSwitchDashboard {
  private globalSwitch: GlobalKillSwitch;
  private clientSwitch: ClientKillSwitch;
  private platformSwitch: PlatformKillSwitch;
  private actionSwitch: ActionKillSwitch;

  constructor(config: KillSwitchDashboardConfig) {
    this.globalSwitch = config.globalSwitch;
    this.clientSwitch = config.clientSwitch;
    this.platformSwitch = config.platformSwitch;
    this.actionSwitch = config.actionSwitch;
  }

  async getOverview(): Promise<DashboardOverview> {
    return tracer.startActiveSpan('KillSwitchDashboard.getOverview', async (span) => {
      try {
        const [globalActive, globalState, activeClients, platformStatuses, actionStatuses] = await Promise.all([
          this.globalSwitch.isActive(),
          this.globalSwitch.getState(),
          this.clientSwitch.listActiveClients(),
          this.platformSwitch.getAllPlatformStatuses(),
          this.actionSwitch.getAllActionStatuses(),
        ]);

        const platformsAffected = Object.values(platformStatuses).filter(p => p.active).length;
        const actionsAffected = Object.values(actionStatuses).filter(a => a.active).length;

        const overview: DashboardOverview = {
          global: {
            active: globalActive,
            state: globalState,
          },
          clients: {
            activeCount: activeClients.length,
            activeList: activeClients,
          },
          platforms: platformStatuses,
          actions: actionStatuses,
          summary: {
            globalActive,
            clientsAffected: activeClients.length,
            platformsAffected,
            actionsAffected,
            totalActiveCount: (globalActive ? 1 : 0) + activeClients.length + platformsAffected + actionsAffected,
          },
          timestamp: new Date().toISOString(),
        };

        span.setAttributes({
          'dashboard.global_active': globalActive,
          'dashboard.clients_affected': activeClients.length,
          'dashboard.platforms_affected': platformsAffected,
          'dashboard.actions_affected': actionsAffected,
        });

        return overview;
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const overview = await this.getOverview();
    const details: string[] = [];

    if (overview.global.active) {
      details.push('Global kill switch is ACTIVE');
    }
    if (overview.clients.activeCount > 0) {
      details.push(`${overview.clients.activeCount} client(s) halted`);
    }
    if (overview.summary.platformsAffected > 0) {
      const activePlatforms = Object.entries(overview.platforms)
        .filter(([_, v]) => v.active)
        .map(([k]) => k);
      details.push(`Platform(s) halted: ${activePlatforms.join(', ')}`);
    }
    if (overview.summary.actionsAffected > 0) {
      const activeActions = Object.entries(overview.actions)
        .filter(([_, v]) => v.active)
        .map(([k]) => k);
      details.push(`Action(s) halted: ${activeActions.join(', ')}`);
    }

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (overview.global.active) {
      status = 'critical';
    } else if (overview.summary.totalActiveCount > 0) {
      status = 'degraded';
    }

    return {
      status,
      activeKillSwitches: overview.summary.totalActiveCount,
      details,
    };
  }

  async quickActivate(
    type: SwitchType,
    target: string | null,
    input: QuickActivateInput
  ): Promise<void> {
    return tracer.startActiveSpan('KillSwitchDashboard.quickActivate', async (span) => {
      try {
        span.setAttributes({ 'switch.type': type, 'switch.target': target || 'all' });

        switch (type) {
          case 'global':
            await this.globalSwitch.activate({
              reason: input.reason,
              activatedBy: input.activatedBy,
              severity: input.severity,
              incidentId: input.incidentId,
            });
            break;

          case 'client':
            if (!target) throw new Error('Client ID required');
            await this.clientSwitch.activateForClient(target, {
              reason: input.reason,
              activatedBy: input.activatedBy,
              severity: input.severity,
            });
            break;

          case 'platform':
            if (!target) throw new Error('Platform required');
            await this.platformSwitch.activateForPlatform(target as Platform, {
              reason: input.reason,
              activatedBy: input.activatedBy,
              severity: input.severity,
            });
            break;

          case 'action':
            if (!target) throw new Error('Action type required');
            await this.actionSwitch.activateForAction(target as ActionType, {
              reason: input.reason,
              activatedBy: input.activatedBy,
              severity: input.severity,
            });
            break;

          default:
            throw new Error(`Invalid switch type: ${type}`);
        }
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async quickDeactivate(
    type: SwitchType,
    target: string | null,
    input: QuickDeactivateInput
  ): Promise<void> {
    return tracer.startActiveSpan('KillSwitchDashboard.quickDeactivate', async (span) => {
      try {
        span.setAttributes({ 'switch.type': type, 'switch.target': target || 'all' });

        switch (type) {
          case 'global':
            await this.globalSwitch.deactivate({
              reason: input.reason,
              deactivatedBy: input.deactivatedBy,
              confirmation: input.confirmation,
            });
            break;

          case 'client':
            if (!target) throw new Error('Client ID required');
            await this.clientSwitch.deactivateForClient(target, {
              reason: input.reason,
              deactivatedBy: input.deactivatedBy,
            });
            break;

          case 'platform':
            if (!target) throw new Error('Platform required');
            await this.platformSwitch.deactivateForPlatform(target as Platform, {
              reason: input.reason,
              deactivatedBy: input.deactivatedBy,
            });
            break;

          case 'action':
            if (!target) throw new Error('Action type required');
            await this.actionSwitch.deactivateForAction(target as ActionType, {
              reason: input.reason,
              deactivatedBy: input.deactivatedBy,
            });
            break;

          default:
            throw new Error(`Invalid switch type: ${type}`);
        }
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getRecentHistory(options?: { limit?: number }): Promise<any[]> {
    const limit = options?.limit ?? 50;
    const allHistory: any[] = [];

    // Gather history from all sources
    const [globalHistory, ...platformHistories] = await Promise.all([
      this.globalSwitch.getHistory({ limit: Math.ceil(limit / 4) }),
      ...PLATFORMS.map(p => this.platformSwitch.getPlatformHistory(p, { limit: Math.ceil(limit / 4 / PLATFORMS.length) })),
    ]);

    allHistory.push(...globalHistory.map(h => ({ ...h, type: 'global' })));

    for (let i = 0; i < PLATFORMS.length; i++) {
      allHistory.push(...platformHistories[i].map((h: any) => ({ ...h, type: 'platform', platform: PLATFORMS[i] })));
    }

    // Sort by activation time descending
    allHistory.sort((a, b) => new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime());

    return allHistory.slice(0, limit);
  }

  async checkAllBeforeAction(context: ActionContext): Promise<void> {
    return tracer.startActiveSpan('KillSwitchDashboard.checkAllBeforeAction', async (span) => {
      try {
        span.setAttributes({
          'context.client_id': context.clientId,
          'context.platform': context.platform,
          'context.action': context.action,
        });

        // Check global switch first (most critical)
        const globalActive = await this.globalSwitch.isActive();
        if (globalActive) {
          const state = await this.globalSwitch.getState();
          throw new Error(`Kill switch active: Global - ${state?.reason || 'Unknown reason'}`);
        }

        // Check client switch
        const clientActive = await this.clientSwitch.isActiveForClient(context.clientId);
        if (clientActive) {
          throw new Error(`Kill switch active: Client ${context.clientId}`);
        }

        // Check platform switch
        const platformStatuses = await this.platformSwitch.getAllPlatformStatuses();
        if (platformStatuses[context.platform]?.active) {
          throw new Error(`Kill switch active: Platform ${context.platform}`);
        }

        // Check action switch
        const actionStatuses = await this.actionSwitch.getAllActionStatuses();
        if (actionStatuses[context.action]?.active) {
          throw new Error(`Kill switch active: Action ${context.action}`);
        }

        span.setAttributes({ 'check.passed': true });
      } catch (error) {
        span.setAttributes({ 'check.passed': false });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async emergencyHalt(input: { reason: string; activatedBy: string }): Promise<void> {
    return tracer.startActiveSpan('KillSwitchDashboard.emergencyHalt', async (span) => {
      try {
        span.setAttributes({ 'emergency': true });

        await this.globalSwitch.activate({
          reason: input.reason,
          activatedBy: input.activatedBy,
          severity: 'critical',
        });

        span.addEvent('emergency_halt_complete');
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  // Get status for a specific client (useful for client-facing dashboards)
  async getClientStatus(clientId: string): Promise<{
    clientHalted: boolean;
    globalHalted: boolean;
    haltedPlatforms: Platform[];
    haltedActions: ActionType[];
    canOperate: boolean;
  }> {
    const [globalActive, clientActive, platformStatuses, actionStatuses] = await Promise.all([
      this.globalSwitch.isActive(),
      this.clientSwitch.isActiveForClient(clientId),
      this.platformSwitch.getAllPlatformStatuses(),
      this.actionSwitch.getAllActionStatuses(),
    ]);

    const haltedPlatforms = Object.entries(platformStatuses)
      .filter(([_, v]) => v.active)
      .map(([k]) => k as Platform);

    const haltedActions = Object.entries(actionStatuses)
      .filter(([_, v]) => v.active)
      .map(([k]) => k as ActionType);

    return {
      clientHalted: clientActive,
      globalHalted: globalActive,
      haltedPlatforms,
      haltedActions,
      canOperate: !globalActive && !clientActive,
    };
  }
}
```

### Phase 3: API Routes

**File:** `packages/safety/kill-switch/src/api.ts`

```typescript
import { z } from 'zod';
import { KillSwitchDashboard, SwitchType } from './kill-switch-dashboard';

export function createKillSwitchRoutes(dashboard: KillSwitchDashboard) {
  return {
    // GET /api/kill-switches/overview
    async getOverview() {
      return dashboard.getOverview();
    },

    // GET /api/kill-switches/health
    async getHealth() {
      return dashboard.getSystemHealth();
    },

    // POST /api/kill-switches/activate
    async activate(body: {
      type: SwitchType;
      target?: string;
      reason: string;
      severity: 'warning' | 'high' | 'critical';
      operatorId: string;
    }) {
      await dashboard.quickActivate(body.type, body.target || null, {
        reason: body.reason,
        activatedBy: body.operatorId,
        severity: body.severity,
      });
      return { success: true };
    },

    // POST /api/kill-switches/deactivate
    async deactivate(body: {
      type: SwitchType;
      target?: string;
      reason: string;
      operatorId: string;
      confirmation?: 'CONFIRM_DEACTIVATE';
    }) {
      await dashboard.quickDeactivate(body.type, body.target || null, {
        reason: body.reason,
        deactivatedBy: body.operatorId,
        confirmation: body.confirmation,
      });
      return { success: true };
    },

    // GET /api/kill-switches/history
    async getHistory(query: { limit?: number }) {
      return dashboard.getRecentHistory({ limit: query.limit });
    },

    // POST /api/kill-switches/emergency-halt
    async emergencyHalt(body: { reason: string; operatorId: string }) {
      await dashboard.emergencyHalt({
        reason: body.reason,
        activatedBy: body.operatorId,
      });
      return { success: true, halted: true };
    },

    // GET /api/kill-switches/client/:clientId
    async getClientStatus(clientId: string) {
      return dashboard.getClientStatus(clientId);
    },

    // POST /api/kill-switches/check
    async checkBeforeAction(body: {
      clientId: string;
      platform: string;
      action: string;
    }) {
      try {
        await dashboard.checkAllBeforeAction({
          clientId: body.clientId,
          platform: body.platform as any,
          action: body.action as any,
        });
        return { allowed: true };
      } catch (error) {
        return { allowed: false, reason: (error as Error).message };
      }
    },
  };
}
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/safety/kill-switch/src/__tests__/kill-switch-dashboard.test.ts` | Unit tests |
| Create | `packages/safety/kill-switch/src/kill-switch-dashboard.ts` | Dashboard implementation |
| Create | `packages/safety/kill-switch/src/api.ts` | API routes |
| Modify | `packages/safety/kill-switch/src/index.ts` | Export dashboard |

---

## Acceptance Criteria

- [ ] Unified overview of all kill switch states
- [ ] System health calculation (healthy/degraded/critical)
- [ ] Quick activate/deactivate from dashboard
- [ ] Combined history from all switch types
- [ ] Check all switches before action helper
- [ ] Emergency halt one-click activation
- [ ] Client-specific status endpoint
- [ ] API routes for frontend integration

---

## JSON Task Block

```json
{
  "task_id": "S5-C5",
  "name": "Kill Switch Dashboard",
  "description": "KillSwitchDashboard for unified kill switch management",
  "status": "pending",
  "dependencies": ["S5-C1", "S5-C2", "S5-C3", "S5-C4"],
  "blocks": [],
  "agent": "C",
  "sprint": 5,
  "complexity": "medium"
}
```

---

## External Memory Section

```yaml
episode_id: null
started_at: null
completed_at: null
summary_ref: null
artifacts:
  - type: code
    path: packages/safety/kill-switch/src/kill-switch-dashboard.ts
  - type: test
    path: packages/safety/kill-switch/src/__tests__/kill-switch-dashboard.test.ts
  - type: api
    path: packages/safety/kill-switch/src/api.ts
decisions: []
blockers: []
```
