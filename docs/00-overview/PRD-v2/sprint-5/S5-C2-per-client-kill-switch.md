# Build Prompt: S5-C2 — Per-Client Kill Switch

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-C2 |
| Sprint | 5 - Gated Rollout |
| Agent | C - Kill Switch Implementation |
| Task Name | Per-Client Kill Switch |
| Complexity | Medium |
| Status | pending |
| Dependencies | S5-C1 |
| Blocked By | None |

---

## Context

### What This Builds

The ClientKillSwitch that halts all operations for a SINGLE client while other clients continue normally. Essential for isolating problematic clients without affecting the entire system.

### Why It Matters

- **Tenant Isolation**: Problems with one client don't affect others
- **Granular Control**: Surgical intervention for specific issues
- **Onboarding Safety**: Disable new clients quickly if issues arise
- **Investigation**: Halt operations while debugging client-specific issues
- **Compliance**: Meet per-tenant isolation requirements

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Kill Switches | Switch hierarchy |
| `docs/05-policy-safety/multi-tenant-isolation.md` | Tenant Isolation | Client boundaries |
| `docs/runbooks/RB-03-emergency-response.md` | Per-Client | Procedures |

---

## Prerequisites

### Completed Tasks

- [x] S5-C1: Global kill switch (provides base patterns)
- [x] S0-B3: Multi-tenant schema (client_id scoping)

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/safety/kill-switch/src/__tests__/client-kill-switch.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientKillSwitch } from '../client-kill-switch';

describe('ClientKillSwitch', () => {
  let killSwitch: ClientKillSwitch;
  let mockStore: any;
  let mockAudit: any;
  let mockNotifier: any;

  beforeEach(() => {
    mockStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      delete: vi.fn(),
      scan: vi.fn().mockResolvedValue([]),
    };

    mockAudit = { emit: vi.fn() };
    mockNotifier = { notifyOperators: vi.fn() };

    killSwitch = new ClientKillSwitch({
      store: mockStore,
      audit: mockAudit,
      notifier: mockNotifier,
    });
  });

  describe('activateForClient', () => {
    it('should activate kill switch for specific client', async () => {
      await killSwitch.activateForClient('client_123', {
        reason: 'Suspicious activity detected',
        activatedBy: 'operator_1',
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        'kill_switch:client:client_123',
        expect.objectContaining({
          active: true,
          clientId: 'client_123',
          reason: 'Suspicious activity detected',
        })
      );
    });

    it('should emit client-specific audit event', async () => {
      await killSwitch.activateForClient('client_123', {
        reason: 'Testing',
        activatedBy: 'operator_1',
      });

      expect(mockAudit.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'kill_switch.client.activated',
          clientId: 'client_123',
        })
      );
    });

    it('should notify operators about client halt', async () => {
      await killSwitch.activateForClient('client_123', {
        reason: 'Issue',
        activatedBy: 'operator_1',
      });

      expect(mockNotifier.notifyOperators).toHaveBeenCalled();
    });
  });

  describe('deactivateForClient', () => {
    it('should deactivate kill switch for client', async () => {
      mockStore.get.mockResolvedValue({ active: true, clientId: 'client_123' });

      await killSwitch.deactivateForClient('client_123', {
        reason: 'Issue resolved',
        deactivatedBy: 'operator_1',
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        'kill_switch:client:client_123',
        expect.objectContaining({
          active: false,
          deactivatedAt: expect.any(String),
        })
      );
    });
  });

  describe('isActiveForClient', () => {
    it('should return true when client switch is active', async () => {
      mockStore.get.mockResolvedValue({ active: true });

      const result = await killSwitch.isActiveForClient('client_123');

      expect(result).toBe(true);
    });

    it('should return false when no switch exists', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await killSwitch.isActiveForClient('client_123');

      expect(result).toBe(false);
    });
  });

  describe('checkBeforeAction', () => {
    it('should throw when client switch is active', async () => {
      mockStore.get.mockResolvedValue({ active: true, reason: 'Halted' });

      await expect(
        killSwitch.checkBeforeAction('client_123')
      ).rejects.toThrow('Kill switch active for client client_123');
    });

    it('should pass when client switch is not active', async () => {
      mockStore.get.mockResolvedValue(null);

      await expect(
        killSwitch.checkBeforeAction('client_123')
      ).resolves.not.toThrow();
    });
  });

  describe('listActiveClients', () => {
    it('should return all clients with active kill switches', async () => {
      mockStore.scan.mockResolvedValue([
        { key: 'kill_switch:client:client_1', value: { active: true, clientId: 'client_1' } },
        { key: 'kill_switch:client:client_2', value: { active: true, clientId: 'client_2' } },
      ]);

      const result = await killSwitch.listActiveClients();

      expect(result).toHaveLength(2);
      expect(result.map(c => c.clientId)).toContain('client_1');
    });
  });

  describe('bulkActivate', () => {
    it('should activate kill switch for multiple clients', async () => {
      await killSwitch.bulkActivate(['client_1', 'client_2', 'client_3'], {
        reason: 'System maintenance',
        activatedBy: 'operator_1',
      });

      expect(mockStore.set).toHaveBeenCalledTimes(3);
    });
  });

  describe('getClientHistory', () => {
    it('should return activation history for client', async () => {
      mockStore.get.mockResolvedValue([
        { activatedAt: '2025-01-01', reason: 'Test 1' },
        { activatedAt: '2025-01-02', reason: 'Test 2' },
      ]);

      const history = await killSwitch.getClientHistory('client_123');

      expect(history).toHaveLength(2);
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/safety/kill-switch/src/client-kill-switch.ts`

```typescript
import { z } from 'zod';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('kill-switch');

export const ClientActivationSchema = z.object({
  reason: z.string().min(5),
  activatedBy: z.string(),
  severity: z.enum(['warning', 'high', 'critical']).default('high'),
  incidentId: z.string().optional(),
  scheduledEnd: z.string().datetime().optional(),
});

export const ClientDeactivationSchema = z.object({
  reason: z.string().min(5),
  deactivatedBy: z.string(),
});

export interface ClientKillSwitchState {
  active: boolean;
  clientId: string;
  activatedAt: string;
  activatedBy: string;
  reason: string;
  severity: string;
  incidentId?: string;
  scheduledEnd?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  deactivationReason?: string;
}

export interface ClientKillSwitchConfig {
  store: any;
  audit: any;
  notifier: any;
}

export class ClientKillSwitch {
  private store: any;
  private audit: any;
  private notifier: any;

  private readonly KEY_PREFIX = 'kill_switch:client:';
  private readonly HISTORY_PREFIX = 'kill_switch:client:history:';

  constructor(config: ClientKillSwitchConfig) {
    this.store = config.store;
    this.audit = config.audit;
    this.notifier = config.notifier;
  }

  async activateForClient(
    clientId: string,
    input: z.infer<typeof ClientActivationSchema>
  ): Promise<void> {
    return tracer.startActiveSpan('ClientKillSwitch.activateForClient', async (span) => {
      try {
        span.setAttributes({ 'client.id': clientId });
        const validated = ClientActivationSchema.parse(input);

        const state: ClientKillSwitchState = {
          active: true,
          clientId,
          activatedAt: new Date().toISOString(),
          activatedBy: validated.activatedBy,
          reason: validated.reason,
          severity: validated.severity,
          incidentId: validated.incidentId,
          scheduledEnd: validated.scheduledEnd,
        };

        await this.store.set(`${this.KEY_PREFIX}${clientId}`, state);

        // Record in history
        await this.appendClientHistory(clientId, state);

        // Emit audit event
        await this.audit.emit({
          eventType: 'kill_switch.client.activated',
          clientId,
          actor: validated.activatedBy,
          details: {
            reason: validated.reason,
            severity: validated.severity,
            incidentId: validated.incidentId,
          },
        });

        // Notify operators
        await this.notifier.notifyOperators({
          type: 'CLIENT_KILL_SWITCH_ACTIVATED',
          clientId,
          severity: validated.severity,
          message: `Kill switch activated for client ${clientId}: ${validated.reason}`,
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

  async deactivateForClient(
    clientId: string,
    input: z.infer<typeof ClientDeactivationSchema>
  ): Promise<void> {
    return tracer.startActiveSpan('ClientKillSwitch.deactivateForClient', async (span) => {
      try {
        span.setAttributes({ 'client.id': clientId });
        const validated = ClientDeactivationSchema.parse(input);

        const current = await this.store.get(`${this.KEY_PREFIX}${clientId}`);
        if (!current?.active) {
          return;
        }

        const state: ClientKillSwitchState = {
          ...current,
          active: false,
          deactivatedAt: new Date().toISOString(),
          deactivatedBy: validated.deactivatedBy,
          deactivationReason: validated.reason,
        };

        await this.store.set(`${this.KEY_PREFIX}${clientId}`, state);

        // Update history
        await this.updateClientHistoryEntry(clientId, current.activatedAt, {
          deactivatedAt: state.deactivatedAt,
          deactivatedBy: state.deactivatedBy,
          deactivationReason: state.deactivationReason,
        });

        // Emit audit event
        await this.audit.emit({
          eventType: 'kill_switch.client.deactivated',
          clientId,
          actor: validated.deactivatedBy,
          details: {
            reason: validated.reason,
          },
        });

        // Notify operators
        await this.notifier.notifyOperators({
          type: 'CLIENT_KILL_SWITCH_DEACTIVATED',
          clientId,
          severity: 'info',
          message: `Kill switch deactivated for client ${clientId}: ${validated.reason}`,
          deactivatedBy: validated.deactivatedBy,
        });
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async isActiveForClient(clientId: string): Promise<boolean> {
    const state = await this.store.get(`${this.KEY_PREFIX}${clientId}`);
    return state?.active === true;
  }

  async getStateForClient(clientId: string): Promise<ClientKillSwitchState | null> {
    return this.store.get(`${this.KEY_PREFIX}${clientId}`);
  }

  async checkBeforeAction(clientId: string): Promise<void> {
    const state = await this.store.get(`${this.KEY_PREFIX}${clientId}`);
    if (state?.active) {
      throw new Error(`Kill switch active for client ${clientId}: ${state.reason}`);
    }
  }

  async listActiveClients(): Promise<ClientKillSwitchState[]> {
    const results = await this.store.scan(`${this.KEY_PREFIX}*`);
    return results
      .map((r: any) => r.value)
      .filter((s: ClientKillSwitchState) => s.active);
  }

  async bulkActivate(
    clientIds: string[],
    input: z.infer<typeof ClientActivationSchema>
  ): Promise<void> {
    for (const clientId of clientIds) {
      await this.activateForClient(clientId, input);
    }
  }

  async bulkDeactivate(
    clientIds: string[],
    input: z.infer<typeof ClientDeactivationSchema>
  ): Promise<void> {
    for (const clientId of clientIds) {
      await this.deactivateForClient(clientId, input);
    }
  }

  async getClientHistory(
    clientId: string,
    options?: { limit?: number }
  ): Promise<ClientKillSwitchState[]> {
    const history = await this.store.get(`${this.HISTORY_PREFIX}${clientId}`) || [];
    const limit = options?.limit ?? 50;
    return history.slice(-limit);
  }

  // Check for scheduled end times and auto-deactivate
  async processScheduledDeactivations(): Promise<number> {
    const activeClients = await this.listActiveClients();
    const now = new Date();
    let deactivated = 0;

    for (const client of activeClients) {
      if (client.scheduledEnd && new Date(client.scheduledEnd) <= now) {
        await this.deactivateForClient(client.clientId, {
          reason: 'Scheduled end time reached',
          deactivatedBy: 'system:scheduled',
        });
        deactivated++;
      }
    }

    return deactivated;
  }

  private async appendClientHistory(
    clientId: string,
    state: ClientKillSwitchState
  ): Promise<void> {
    const history = await this.store.get(`${this.HISTORY_PREFIX}${clientId}`) || [];
    history.push(state);
    if (history.length > 50) {
      history.shift();
    }
    await this.store.set(`${this.HISTORY_PREFIX}${clientId}`, history);
  }

  private async updateClientHistoryEntry(
    clientId: string,
    activatedAt: string,
    update: Partial<ClientKillSwitchState>
  ): Promise<void> {
    const history = await this.store.get(`${this.HISTORY_PREFIX}${clientId}`) || [];
    const index = history.findIndex((h: ClientKillSwitchState) => h.activatedAt === activatedAt);
    if (index >= 0) {
      history[index] = { ...history[index], ...update };
      await this.store.set(`${this.HISTORY_PREFIX}${clientId}`, history);
    }
  }
}
```

---

## Acceptance Criteria

- [ ] Per-client kill switch halts that client only
- [ ] Other clients continue operating normally
- [ ] Activation requires reason and operator ID
- [ ] Audit events include client_id
- [ ] Bulk activation/deactivation for multiple clients
- [ ] Scheduled deactivation support
- [ ] Client-specific history tracking

---

## JSON Task Block

```json
{
  "task_id": "S5-C2",
  "name": "Per-Client Kill Switch",
  "description": "ClientKillSwitch for single-client operation halt",
  "status": "pending",
  "dependencies": ["S5-C1"],
  "blocks": ["S5-C5"],
  "agent": "C",
  "sprint": 5,
  "complexity": "medium"
}
```
