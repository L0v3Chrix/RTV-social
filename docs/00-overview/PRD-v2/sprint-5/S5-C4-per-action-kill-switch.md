# Build Prompt: S5-C4 — Per-Action Kill Switch

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-C4 |
| Sprint | 5 - Gated Rollout |
| Agent | C - Kill Switch Implementation |
| Task Name | Per-Action Kill Switch |
| Complexity | Medium |
| Status | pending |
| Dependencies | S5-C1 |
| Blocked By | None |

---

## Context

### What This Builds

The ActionKillSwitch that halts specific action types (publish, engage, delete, etc.) while allowing other operations to continue. Essential for targeted intervention when specific operations are problematic.

### Why It Matters

- **Surgical Control**: Disable publishing but allow engagement
- **Feature Isolation**: Issues with one action type don't affect others
- **Staged Recovery**: Re-enable actions one at a time
- **Risk Management**: Higher-risk actions can have tighter controls
- **Debugging**: Isolate problematic action types for investigation

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/03-agents-tools/tool-registry.md` | Tool Categories | Action type definitions |
| `docs/01-architecture/system-architecture-v3.md` | Side Effects | Action classification |
| `docs/runbooks/RB-05-action-failure.md` | Response | Action-specific procedures |

---

## Prerequisites

### Completed Tasks

- [x] S5-C1: Global kill switch (provides base patterns)
- [x] S1-D3: Tool wrapper (defines action types)

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/safety/kill-switch/src/__tests__/action-kill-switch.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionKillSwitch, ActionType } from '../action-kill-switch';

describe('ActionKillSwitch', () => {
  let killSwitch: ActionKillSwitch;
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
    mockNotifier = { notifyOperators: vi.fn() };

    killSwitch = new ActionKillSwitch({
      store: mockStore,
      audit: mockAudit,
      notifier: mockNotifier,
    });
  });

  describe('activateForAction', () => {
    it('should activate kill switch for specific action', async () => {
      await killSwitch.activateForAction('publish', {
        reason: 'Publishing errors detected',
        activatedBy: 'operator_1',
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        'kill_switch:action:publish',
        expect.objectContaining({
          active: true,
          action: 'publish',
          reason: 'Publishing errors detected',
        })
      );
    });

    it('should validate action is in allowed list', async () => {
      await expect(
        killSwitch.activateForAction('invalid_action' as ActionType, {
          reason: 'Test',
          activatedBy: 'operator_1',
        })
      ).rejects.toThrow('Invalid action');
    });

    it('should emit action-specific audit event', async () => {
      await killSwitch.activateForAction('engage', {
        reason: 'Engagement issues',
        activatedBy: 'operator_1',
      });

      expect(mockAudit.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'kill_switch.action.activated',
          details: expect.objectContaining({ action: 'engage' }),
        })
      );
    });
  });

  describe('deactivateForAction', () => {
    it('should deactivate action kill switch', async () => {
      mockStore.get.mockResolvedValue({ active: true, action: 'publish' });

      await killSwitch.deactivateForAction('publish', {
        reason: 'Issue resolved',
        deactivatedBy: 'operator_1',
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        'kill_switch:action:publish',
        expect.objectContaining({
          active: false,
          deactivatedAt: expect.any(String),
        })
      );
    });
  });

  describe('isActiveForAction', () => {
    it('should return true when action switch is active', async () => {
      mockStore.get.mockResolvedValue({ active: true });

      const result = await killSwitch.isActiveForAction('delete');

      expect(result).toBe(true);
    });
  });

  describe('checkBeforeAction', () => {
    it('should throw when action switch is active', async () => {
      mockStore.get.mockResolvedValue({ active: true, reason: 'Disabled' });

      await expect(
        killSwitch.checkBeforeAction('publish')
      ).rejects.toThrow('Kill switch active for action publish');
    });

    it('should pass when action switch is not active', async () => {
      mockStore.get.mockResolvedValue(null);

      await expect(
        killSwitch.checkBeforeAction('publish')
      ).resolves.not.toThrow();
    });
  });

  describe('activateForPlatformAction', () => {
    it('should activate for specific platform+action combination', async () => {
      await killSwitch.activateForPlatformAction('meta', 'publish', {
        reason: 'Meta publishing issue',
        activatedBy: 'operator_1',
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        'kill_switch:platform_action:meta:publish',
        expect.objectContaining({
          active: true,
          platform: 'meta',
          action: 'publish',
        })
      );
    });
  });

  describe('activateForClientAction', () => {
    it('should activate for specific client+action combination', async () => {
      await killSwitch.activateForClientAction('client_123', 'engage', {
        reason: 'Client engagement issue',
        activatedBy: 'operator_1',
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        'kill_switch:client_action:client_123:engage',
        expect.objectContaining({
          active: true,
          clientId: 'client_123',
          action: 'engage',
        })
      );
    });
  });

  describe('getActionRiskLevels', () => {
    it('should return risk classification for actions', () => {
      const riskLevels = killSwitch.getActionRiskLevels();

      expect(riskLevels.delete).toBe('high');
      expect(riskLevels.publish).toBe('medium');
      expect(riskLevels.read).toBe('low');
    });
  });

  describe('getAllActionStatuses', () => {
    it('should return status for all known actions', async () => {
      mockStore.get
        .mockResolvedValueOnce({ active: true, action: 'publish' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const statuses = await killSwitch.getAllActionStatuses();

      expect(statuses.publish.active).toBe(true);
      expect(statuses.engage.active).toBe(false);
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/safety/kill-switch/src/action-kill-switch.ts`

```typescript
import { z } from 'zod';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('kill-switch');

export const ACTIONS = ['publish', 'engage', 'delete', 'schedule', 'draft', 'read'] as const;
export type ActionType = typeof ACTIONS[number];

export const ACTION_RISK_LEVELS: Record<ActionType, 'low' | 'medium' | 'high'> = {
  read: 'low',
  draft: 'low',
  schedule: 'medium',
  publish: 'medium',
  engage: 'medium',
  delete: 'high',
};

export const ActionActivationSchema = z.object({
  reason: z.string().min(5),
  activatedBy: z.string(),
  severity: z.enum(['warning', 'high', 'critical']).default('high'),
  affectedScope: z.enum(['global', 'platform', 'client']).optional(),
});

export const ActionDeactivationSchema = z.object({
  reason: z.string().min(5),
  deactivatedBy: z.string(),
});

export interface ActionKillSwitchState {
  active: boolean;
  action: ActionType;
  activatedAt: string;
  activatedBy: string;
  reason: string;
  severity: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  deactivationReason?: string;
}

export interface PlatformActionKillSwitchState extends ActionKillSwitchState {
  platform: string;
}

export interface ClientActionKillSwitchState extends ActionKillSwitchState {
  clientId: string;
}

export interface ActionKillSwitchConfig {
  store: any;
  audit: any;
  notifier: any;
}

export class ActionKillSwitch {
  private store: any;
  private audit: any;
  private notifier: any;

  private readonly ACTION_PREFIX = 'kill_switch:action:';
  private readonly PLATFORM_ACTION_PREFIX = 'kill_switch:platform_action:';
  private readonly CLIENT_ACTION_PREFIX = 'kill_switch:client_action:';
  private readonly HISTORY_PREFIX = 'kill_switch:action:history:';

  constructor(config: ActionKillSwitchConfig) {
    this.store = config.store;
    this.audit = config.audit;
    this.notifier = config.notifier;
  }

  async activateForAction(
    action: ActionType,
    input: z.infer<typeof ActionActivationSchema>
  ): Promise<void> {
    return tracer.startActiveSpan('ActionKillSwitch.activateForAction', async (span) => {
      try {
        if (!ACTIONS.includes(action)) {
          throw new Error(`Invalid action: ${action}`);
        }

        span.setAttributes({ 'action': action });
        const validated = ActionActivationSchema.parse(input);

        const state: ActionKillSwitchState = {
          active: true,
          action,
          activatedAt: new Date().toISOString(),
          activatedBy: validated.activatedBy,
          reason: validated.reason,
          severity: validated.severity,
        };

        await this.store.set(`${this.ACTION_PREFIX}${action}`, state);

        // Record in history
        await this.appendActionHistory(action, state);

        // Emit audit event
        await this.audit.emit({
          eventType: 'kill_switch.action.activated',
          actor: validated.activatedBy,
          details: {
            action,
            reason: validated.reason,
            severity: validated.severity,
            riskLevel: ACTION_RISK_LEVELS[action],
          },
        });

        // Notify operators
        await this.notifier.notifyOperators({
          type: 'ACTION_KILL_SWITCH_ACTIVATED',
          action,
          severity: validated.severity,
          message: `Kill switch activated for action ${action}: ${validated.reason}`,
          activatedBy: validated.activatedBy,
        });
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async deactivateForAction(
    action: ActionType,
    input: z.infer<typeof ActionDeactivationSchema>
  ): Promise<void> {
    return tracer.startActiveSpan('ActionKillSwitch.deactivateForAction', async (span) => {
      try {
        span.setAttributes({ 'action': action });
        const validated = ActionDeactivationSchema.parse(input);

        const current = await this.store.get(`${this.ACTION_PREFIX}${action}`);
        if (!current?.active) {
          return;
        }

        const state: ActionKillSwitchState = {
          ...current,
          active: false,
          deactivatedAt: new Date().toISOString(),
          deactivatedBy: validated.deactivatedBy,
          deactivationReason: validated.reason,
        };

        await this.store.set(`${this.ACTION_PREFIX}${action}`, state);

        // Update history
        await this.updateActionHistoryEntry(action, current.activatedAt, {
          deactivatedAt: state.deactivatedAt,
          deactivatedBy: state.deactivatedBy,
          deactivationReason: state.deactivationReason,
        });

        // Emit audit event
        await this.audit.emit({
          eventType: 'kill_switch.action.deactivated',
          actor: validated.deactivatedBy,
          details: {
            action,
            reason: validated.reason,
          },
        });

        await this.notifier.notifyOperators({
          type: 'ACTION_KILL_SWITCH_DEACTIVATED',
          action,
          severity: 'info',
          message: `Kill switch deactivated for action ${action}: ${validated.reason}`,
        });
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async isActiveForAction(action: ActionType): Promise<boolean> {
    const state = await this.store.get(`${this.ACTION_PREFIX}${action}`);
    return state?.active === true;
  }

  async getStateForAction(action: ActionType): Promise<ActionKillSwitchState | null> {
    return this.store.get(`${this.ACTION_PREFIX}${action}`);
  }

  async checkBeforeAction(action: ActionType): Promise<void> {
    const state = await this.store.get(`${this.ACTION_PREFIX}${action}`);
    if (state?.active) {
      throw new Error(`Kill switch active for action ${action}: ${state.reason}`);
    }
  }

  // Platform-specific action switches
  async activateForPlatformAction(
    platform: string,
    action: ActionType,
    input: z.infer<typeof ActionActivationSchema>
  ): Promise<void> {
    if (!ACTIONS.includes(action)) {
      throw new Error(`Invalid action: ${action}`);
    }

    const validated = ActionActivationSchema.parse(input);

    const state: PlatformActionKillSwitchState = {
      active: true,
      platform,
      action,
      activatedAt: new Date().toISOString(),
      activatedBy: validated.activatedBy,
      reason: validated.reason,
      severity: validated.severity,
    };

    await this.store.set(`${this.PLATFORM_ACTION_PREFIX}${platform}:${action}`, state);

    await this.audit.emit({
      eventType: 'kill_switch.platform_action.activated',
      actor: validated.activatedBy,
      details: { platform, action, reason: validated.reason },
    });
  }

  async deactivateForPlatformAction(
    platform: string,
    action: ActionType,
    input: z.infer<typeof ActionDeactivationSchema>
  ): Promise<void> {
    const validated = ActionDeactivationSchema.parse(input);
    const current = await this.store.get(`${this.PLATFORM_ACTION_PREFIX}${platform}:${action}`);

    if (!current?.active) {
      return;
    }

    await this.store.set(`${this.PLATFORM_ACTION_PREFIX}${platform}:${action}`, {
      ...current,
      active: false,
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: validated.deactivatedBy,
      deactivationReason: validated.reason,
    });

    await this.audit.emit({
      eventType: 'kill_switch.platform_action.deactivated',
      actor: validated.deactivatedBy,
      details: { platform, action, reason: validated.reason },
    });
  }

  async isActiveForPlatformAction(platform: string, action: ActionType): Promise<boolean> {
    const state = await this.store.get(`${this.PLATFORM_ACTION_PREFIX}${platform}:${action}`);
    return state?.active === true;
  }

  async checkBeforePlatformAction(platform: string, action: ActionType): Promise<void> {
    // Check global action first
    await this.checkBeforeAction(action);

    // Then check platform-specific
    const state = await this.store.get(`${this.PLATFORM_ACTION_PREFIX}${platform}:${action}`);
    if (state?.active) {
      throw new Error(`Kill switch active for ${platform} action ${action}: ${state.reason}`);
    }
  }

  // Client-specific action switches
  async activateForClientAction(
    clientId: string,
    action: ActionType,
    input: z.infer<typeof ActionActivationSchema>
  ): Promise<void> {
    if (!ACTIONS.includes(action)) {
      throw new Error(`Invalid action: ${action}`);
    }

    const validated = ActionActivationSchema.parse(input);

    const state: ClientActionKillSwitchState = {
      active: true,
      clientId,
      action,
      activatedAt: new Date().toISOString(),
      activatedBy: validated.activatedBy,
      reason: validated.reason,
      severity: validated.severity,
    };

    await this.store.set(`${this.CLIENT_ACTION_PREFIX}${clientId}:${action}`, state);

    await this.audit.emit({
      eventType: 'kill_switch.client_action.activated',
      clientId,
      actor: validated.activatedBy,
      details: { action, reason: validated.reason },
    });
  }

  async deactivateForClientAction(
    clientId: string,
    action: ActionType,
    input: z.infer<typeof ActionDeactivationSchema>
  ): Promise<void> {
    const validated = ActionDeactivationSchema.parse(input);
    const current = await this.store.get(`${this.CLIENT_ACTION_PREFIX}${clientId}:${action}`);

    if (!current?.active) {
      return;
    }

    await this.store.set(`${this.CLIENT_ACTION_PREFIX}${clientId}:${action}`, {
      ...current,
      active: false,
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: validated.deactivatedBy,
      deactivationReason: validated.reason,
    });

    await this.audit.emit({
      eventType: 'kill_switch.client_action.deactivated',
      clientId,
      actor: validated.deactivatedBy,
      details: { action, reason: validated.reason },
    });
  }

  async isActiveForClientAction(clientId: string, action: ActionType): Promise<boolean> {
    const state = await this.store.get(`${this.CLIENT_ACTION_PREFIX}${clientId}:${action}`);
    return state?.active === true;
  }

  async checkBeforeClientAction(clientId: string, action: ActionType): Promise<void> {
    // Check global action first
    await this.checkBeforeAction(action);

    // Then check client-specific
    const state = await this.store.get(`${this.CLIENT_ACTION_PREFIX}${clientId}:${action}`);
    if (state?.active) {
      throw new Error(`Kill switch active for client ${clientId} action ${action}: ${state.reason}`);
    }
  }

  getActionRiskLevels(): Record<ActionType, 'low' | 'medium' | 'high'> {
    return { ...ACTION_RISK_LEVELS };
  }

  async getAllActionStatuses(): Promise<Record<ActionType, { active: boolean; state?: ActionKillSwitchState }>> {
    const statuses: Record<string, { active: boolean; state?: ActionKillSwitchState }> = {};

    for (const action of ACTIONS) {
      const state = await this.store.get(`${this.ACTION_PREFIX}${action}`);
      statuses[action] = {
        active: state?.active === true,
        state: state || undefined,
      };
    }

    return statuses as Record<ActionType, { active: boolean; state?: ActionKillSwitchState }>;
  }

  async listActiveActions(): Promise<ActionKillSwitchState[]> {
    const results = await this.store.scan(`${this.ACTION_PREFIX}*`);
    return results
      .map((r: any) => r.value)
      .filter((s: ActionKillSwitchState) => s.active);
  }

  async getActionHistory(
    action: ActionType,
    options?: { limit?: number }
  ): Promise<ActionKillSwitchState[]> {
    const history = await this.store.get(`${this.HISTORY_PREFIX}${action}`) || [];
    const limit = options?.limit ?? 50;
    return history.slice(-limit);
  }

  private async appendActionHistory(
    action: ActionType,
    state: ActionKillSwitchState
  ): Promise<void> {
    const history = await this.store.get(`${this.HISTORY_PREFIX}${action}`) || [];
    history.push(state);
    if (history.length > 50) {
      history.shift();
    }
    await this.store.set(`${this.HISTORY_PREFIX}${action}`, history);
  }

  private async updateActionHistoryEntry(
    action: ActionType,
    activatedAt: string,
    update: Partial<ActionKillSwitchState>
  ): Promise<void> {
    const history = await this.store.get(`${this.HISTORY_PREFIX}${action}`) || [];
    const index = history.findIndex((h: ActionKillSwitchState) => h.activatedAt === activatedAt);
    if (index >= 0) {
      history[index] = { ...history[index], ...update };
      await this.store.set(`${this.HISTORY_PREFIX}${action}`, history);
    }
  }
}
```

---

## Acceptance Criteria

- [ ] Per-action kill switch halts that action type only
- [ ] All action types enumerated (publish, engage, delete, schedule, draft, read)
- [ ] Action validation prevents invalid action names
- [ ] Risk levels defined per action type
- [ ] Platform+action combination switch for granular control
- [ ] Client+action combination switch
- [ ] Action status dashboard data available
- [ ] History tracking per action

---

## JSON Task Block

```json
{
  "task_id": "S5-C4",
  "name": "Per-Action Kill Switch",
  "description": "ActionKillSwitch for action-type-specific operation halt",
  "status": "pending",
  "dependencies": ["S5-C1"],
  "blocks": ["S5-C5"],
  "agent": "C",
  "sprint": 5,
  "complexity": "medium"
}
```
