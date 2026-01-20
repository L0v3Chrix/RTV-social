# Build Prompt: S5-C1 — Global Kill Switch

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-C1 |
| Sprint | 5 - Gated Rollout |
| Agent | C - Kill Switch Implementation |
| Task Name | Global Kill Switch |
| Complexity | High |
| Status | pending |
| Dependencies | S5-A5 |
| Blocked By | None |

---

## Context

### What This Builds

The GlobalKillSwitch that immediately halts ALL operations across ALL clients and ALL platforms. This is the emergency brake for the entire system—when activated, no side effects can occur.

### Why It Matters

- **Emergency Response**: Instant halt on critical incidents
- **Zero Delay**: Sub-second activation across all services
- **Complete Coverage**: Nothing bypasses the global switch
- **Audit Trail**: Full history of activations and reasons
- **Safe Default**: System fails closed when uncertain

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Kill Switches | Switch architecture |
| `docs/05-policy-safety/compliance-safety-policy.md` | Emergency Procedures | Activation protocols |
| `docs/runbooks/RB-03-emergency-response.md` | Kill Switch | Operational procedures |

---

## Prerequisites

### Completed Tasks

- [x] S5-A5: Error scenario testing (validates need for kill switch)
- [x] S0-D3: Audit event framework (records activations)

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/safety/kill-switch/src/__tests__/global-kill-switch.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GlobalKillSwitch } from '../global-kill-switch';

describe('GlobalKillSwitch', () => {
  let killSwitch: GlobalKillSwitch;
  let mockStore: any;
  let mockAudit: any;
  let mockNotifier: any;

  beforeEach(() => {
    mockStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      subscribe: vi.fn(),
    };

    mockAudit = {
      emit: vi.fn(),
    };

    mockNotifier = {
      notifyAll: vi.fn(),
      notifyOncall: vi.fn(),
    };

    killSwitch = new GlobalKillSwitch({
      store: mockStore,
      audit: mockAudit,
      notifier: mockNotifier,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('activate', () => {
    it('should activate global kill switch', async () => {
      await killSwitch.activate({
        reason: 'Critical incident detected',
        activatedBy: 'operator_123',
        severity: 'critical',
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        'kill_switch:global',
        expect.objectContaining({
          active: true,
          reason: 'Critical incident detected',
          activatedBy: 'operator_123',
        })
      );
    });

    it('should emit audit event on activation', async () => {
      await killSwitch.activate({
        reason: 'Emergency stop',
        activatedBy: 'operator_123',
        severity: 'critical',
      });

      expect(mockAudit.emit).toHaveBeenCalledWith({
        eventType: 'kill_switch.global.activated',
        actor: 'operator_123',
        details: expect.objectContaining({
          reason: 'Emergency stop',
          severity: 'critical',
        }),
      });
    });

    it('should notify on-call team', async () => {
      await killSwitch.activate({
        reason: 'Emergency',
        activatedBy: 'operator_123',
        severity: 'critical',
      });

      expect(mockNotifier.notifyOncall).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'KILL_SWITCH_ACTIVATED',
          severity: 'critical',
        })
      );
    });
  });

  describe('deactivate', () => {
    it('should deactivate with required reason', async () => {
      mockStore.get.mockResolvedValue({ active: true });

      await killSwitch.deactivate({
        reason: 'Incident resolved',
        deactivatedBy: 'operator_123',
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        'kill_switch:global',
        expect.objectContaining({
          active: false,
          deactivatedAt: expect.any(String),
        })
      );
    });

    it('should require confirmation for deactivation', async () => {
      mockStore.get.mockResolvedValue({ active: true });

      await expect(
        killSwitch.deactivate({
          reason: 'Resolved',
          deactivatedBy: 'operator_123',
          // Missing confirmation
        })
      ).rejects.toThrow('Confirmation required');
    });
  });

  describe('isActive', () => {
    it('should return true when active', async () => {
      mockStore.get.mockResolvedValue({ active: true });

      const result = await killSwitch.isActive();

      expect(result).toBe(true);
    });

    it('should return false when not active', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await killSwitch.isActive();

      expect(result).toBe(false);
    });
  });

  describe('checkBeforeAction', () => {
    it('should throw when global switch is active', async () => {
      mockStore.get.mockResolvedValue({ active: true, reason: 'Emergency' });

      await expect(
        killSwitch.checkBeforeAction()
      ).rejects.toThrow('Global kill switch active: Emergency');
    });

    it('should pass when switch is inactive', async () => {
      mockStore.get.mockResolvedValue(null);

      await expect(killSwitch.checkBeforeAction()).resolves.not.toThrow();
    });
  });

  describe('getHistory', () => {
    it('should return activation history', async () => {
      mockStore.get.mockResolvedValue([
        { activatedAt: '2025-01-01T00:00:00Z', reason: 'Test 1' },
        { activatedAt: '2025-01-02T00:00:00Z', reason: 'Test 2' },
      ]);

      const history = await killSwitch.getHistory({ limit: 10 });

      expect(history).toHaveLength(2);
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/safety/kill-switch/src/global-kill-switch.ts`

```typescript
import { z } from 'zod';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('kill-switch');

export const ActivationSchema = z.object({
  reason: z.string().min(10),
  activatedBy: z.string(),
  severity: z.enum(['warning', 'high', 'critical']),
  incidentId: z.string().optional(),
  autoActivated: z.boolean().default(false),
});

export const DeactivationSchema = z.object({
  reason: z.string().min(10),
  deactivatedBy: z.string(),
  confirmation: z.literal('CONFIRM_DEACTIVATE').optional(),
  incidentResolutionId: z.string().optional(),
});

export interface KillSwitchState {
  active: boolean;
  activatedAt: string;
  activatedBy: string;
  reason: string;
  severity: string;
  incidentId?: string;
  autoActivated: boolean;
  deactivatedAt?: string;
  deactivatedBy?: string;
  deactivationReason?: string;
}

export interface GlobalKillSwitchConfig {
  store: any;
  audit: any;
  notifier: any;
  requireConfirmation?: boolean;
}

export class GlobalKillSwitch {
  private store: any;
  private audit: any;
  private notifier: any;
  private requireConfirmation: boolean;

  private readonly GLOBAL_KEY = 'kill_switch:global';
  private readonly HISTORY_KEY = 'kill_switch:global:history';

  constructor(config: GlobalKillSwitchConfig) {
    this.store = config.store;
    this.audit = config.audit;
    this.notifier = config.notifier;
    this.requireConfirmation = config.requireConfirmation ?? true;
  }

  async activate(input: z.infer<typeof ActivationSchema>): Promise<void> {
    return tracer.startActiveSpan('GlobalKillSwitch.activate', async (span) => {
      try {
        const validated = ActivationSchema.parse(input);

        const state: KillSwitchState = {
          active: true,
          activatedAt: new Date().toISOString(),
          activatedBy: validated.activatedBy,
          reason: validated.reason,
          severity: validated.severity,
          incidentId: validated.incidentId,
          autoActivated: validated.autoActivated,
        };

        // Activate immediately
        await this.store.set(this.GLOBAL_KEY, state);

        // Record in history
        await this.appendHistory(state);

        // Emit audit event
        await this.audit.emit({
          eventType: 'kill_switch.global.activated',
          actor: validated.activatedBy,
          details: {
            reason: validated.reason,
            severity: validated.severity,
            incidentId: validated.incidentId,
            autoActivated: validated.autoActivated,
          },
        });

        // Notify on-call
        await this.notifier.notifyOncall({
          type: 'KILL_SWITCH_ACTIVATED',
          severity: validated.severity,
          message: `Global kill switch activated: ${validated.reason}`,
          activatedBy: validated.activatedBy,
        });

        span.setAttributes({
          'kill_switch.activated': true,
          'kill_switch.reason': validated.reason,
          'kill_switch.severity': validated.severity,
        });
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async deactivate(input: z.infer<typeof DeactivationSchema>): Promise<void> {
    return tracer.startActiveSpan('GlobalKillSwitch.deactivate', async (span) => {
      try {
        const validated = DeactivationSchema.parse(input);

        // Require confirmation for safety
        if (this.requireConfirmation && validated.confirmation !== 'CONFIRM_DEACTIVATE') {
          throw new Error('Confirmation required: pass confirmation: "CONFIRM_DEACTIVATE"');
        }

        const current = await this.store.get(this.GLOBAL_KEY);
        if (!current?.active) {
          return; // Already inactive
        }

        const state: KillSwitchState = {
          ...current,
          active: false,
          deactivatedAt: new Date().toISOString(),
          deactivatedBy: validated.deactivatedBy,
          deactivationReason: validated.reason,
        };

        await this.store.set(this.GLOBAL_KEY, state);

        // Update history
        await this.updateHistoryEntry(current.activatedAt, {
          deactivatedAt: state.deactivatedAt,
          deactivatedBy: state.deactivatedBy,
          deactivationReason: state.deactivationReason,
        });

        // Emit audit event
        await this.audit.emit({
          eventType: 'kill_switch.global.deactivated',
          actor: validated.deactivatedBy,
          details: {
            reason: validated.reason,
            activeDuration: this.calculateDuration(current.activatedAt, state.deactivatedAt!),
            incidentResolutionId: validated.incidentResolutionId,
          },
        });

        // Notify team
        await this.notifier.notifyOncall({
          type: 'KILL_SWITCH_DEACTIVATED',
          severity: 'info',
          message: `Global kill switch deactivated: ${validated.reason}`,
          deactivatedBy: validated.deactivatedBy,
        });

        span.setAttributes({
          'kill_switch.deactivated': true,
          'kill_switch.reason': validated.reason,
        });
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async isActive(): Promise<boolean> {
    const state = await this.store.get(this.GLOBAL_KEY);
    return state?.active === true;
  }

  async getState(): Promise<KillSwitchState | null> {
    return this.store.get(this.GLOBAL_KEY);
  }

  async checkBeforeAction(): Promise<void> {
    const state = await this.store.get(this.GLOBAL_KEY);
    if (state?.active) {
      throw new Error(`Global kill switch active: ${state.reason}`);
    }
  }

  async getHistory(options?: { limit?: number }): Promise<KillSwitchState[]> {
    const history = await this.store.get(this.HISTORY_KEY) || [];
    const limit = options?.limit ?? 50;
    return history.slice(-limit);
  }

  // Auto-activation based on metrics
  async evaluateMetrics(metrics: {
    errorRate: number;
    errorRateThreshold: number;
    criticalErrors: number;
  }): Promise<boolean> {
    if (metrics.errorRate >= metrics.errorRateThreshold || metrics.criticalErrors > 0) {
      await this.activate({
        reason: `Auto-activated: error rate ${metrics.errorRate} exceeded threshold ${metrics.errorRateThreshold}`,
        activatedBy: 'system:auto_kill_switch',
        severity: 'critical',
        autoActivated: true,
      });
      return true;
    }
    return false;
  }

  private async appendHistory(state: KillSwitchState): Promise<void> {
    const history = await this.store.get(this.HISTORY_KEY) || [];
    history.push(state);
    // Keep last 100 entries
    if (history.length > 100) {
      history.shift();
    }
    await this.store.set(this.HISTORY_KEY, history);
  }

  private async updateHistoryEntry(
    activatedAt: string,
    update: Partial<KillSwitchState>
  ): Promise<void> {
    const history = await this.store.get(this.HISTORY_KEY) || [];
    const index = history.findIndex((h: KillSwitchState) => h.activatedAt === activatedAt);
    if (index >= 0) {
      history[index] = { ...history[index], ...update };
      await this.store.set(this.HISTORY_KEY, history);
    }
  }

  private calculateDuration(start: string, end: string): string {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}
```

### Phase 3: Kill Switch Middleware

**File:** `packages/safety/kill-switch/src/middleware.ts`

```typescript
import { GlobalKillSwitch } from './global-kill-switch';

export function createKillSwitchMiddleware(killSwitch: GlobalKillSwitch) {
  return async function killSwitchMiddleware(
    ctx: { clientId?: string; action?: string },
    next: () => Promise<void>
  ): Promise<void> {
    // Check global kill switch before any action
    await killSwitch.checkBeforeAction();

    // Proceed with action
    await next();
  };
}
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/safety/kill-switch/src/__tests__/global-kill-switch.test.ts` | Unit tests |
| Create | `packages/safety/kill-switch/src/global-kill-switch.ts` | GlobalKillSwitch implementation |
| Create | `packages/safety/kill-switch/src/middleware.ts` | Kill switch middleware |
| Create | `packages/safety/kill-switch/src/index.ts` | Package exports |
| Create | `packages/safety/kill-switch/package.json` | Package configuration |

---

## Acceptance Criteria

- [ ] Global kill switch halts ALL operations instantly
- [ ] Activation requires reason and operator ID
- [ ] Deactivation requires confirmation
- [ ] All activations/deactivations emit audit events
- [ ] On-call team notified on activation
- [ ] Activation history maintained
- [ ] Auto-activation on critical error thresholds

---

## Test Requirements

### Unit Tests
- Activation with all required fields
- Deactivation with confirmation
- Check before action blocks when active
- History retrieval and pagination
- Auto-activation on metrics threshold

### Integration Tests
- Middleware blocks requests when active
- Notification delivery on activation
- Audit events recorded correctly

---

## Security & Safety Checklist

- [ ] Only authorized operators can activate/deactivate
- [ ] All actions emit audit events
- [ ] Confirmation required for deactivation
- [ ] Sub-second activation time
- [ ] Fail-closed on errors

---

## JSON Task Block

```json
{
  "task_id": "S5-C1",
  "name": "Global Kill Switch",
  "description": "GlobalKillSwitch for emergency halt of all operations",
  "status": "pending",
  "dependencies": ["S5-A5"],
  "blocks": ["S5-C2", "S5-C3", "S5-C4", "S5-C5"],
  "agent": "C",
  "sprint": 5,
  "complexity": "high"
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
    path: packages/safety/kill-switch/src/global-kill-switch.ts
  - type: test
    path: packages/safety/kill-switch/src/__tests__/global-kill-switch.test.ts
decisions: []
blockers: []
```
