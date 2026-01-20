# Build Prompt: S5-B1 — Canary Client Selection

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-B1 |
| Sprint | 5 - Gated Rollout |
| Agent | B - Canary Client Configuration |
| Task Name | Canary Client Selection |
| Complexity | Low |
| Status | pending |
| Dependencies | S5-A5 |
| Blocked By | None |

---

## Context

### What This Builds

The CanarySelectionService that identifies and configures 2-3 trusted clients for early rollout. These clients receive new features first, with enhanced monitoring and direct communication channels for feedback.

### Why It Matters

- **Risk Mitigation**: Limited blast radius for any issues
- **Real Feedback**: Production-like testing with real users
- **Trust Building**: Involves clients in product development
- **Quick Iteration**: Fast feedback loop for improvements
- **Validation**: Proves system works in real conditions

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Rollout Strategy | Canary patterns |
| `docs/05-policy-safety/compliance-safety-policy.md` | Client Communication | Disclosure requirements |

---

## Prerequisites

### Completed Tasks

- [x] S5-A5: Error scenario testing (validates system readiness)
- [x] S0-B2: Core schema (client table exists)

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/rollout/canary/src/__tests__/canary-selection.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanarySelectionService } from '../canary-selection';

describe('CanarySelectionService', () => {
  let service: CanarySelectionService;
  let mockClientRepository: any;

  beforeEach(() => {
    mockClientRepository = {
      findAll: vi.fn(),
      update: vi.fn(),
    };

    service = new CanarySelectionService({
      clientRepository: mockClientRepository,
      maxCanaryClients: 3,
    });
  });

  describe('selectCanaryClients', () => {
    it('should select clients based on criteria', async () => {
      mockClientRepository.findAll.mockResolvedValue([
        { id: 'client_1', name: 'Trusted Client', trustScore: 9, activeSince: '2024-01-01' },
        { id: 'client_2', name: 'New Client', trustScore: 5, activeSince: '2025-01-01' },
        { id: 'client_3', name: 'Veteran Client', trustScore: 8, activeSince: '2023-06-01' },
      ]);

      const canaries = await service.selectCanaryClients({
        minTrustScore: 7,
        minTenureDays: 180,
      });

      expect(canaries).toHaveLength(2);
      expect(canaries.map(c => c.id)).toContain('client_1');
      expect(canaries.map(c => c.id)).toContain('client_3');
    });

    it('should respect max canary limit', async () => {
      mockClientRepository.findAll.mockResolvedValue([
        { id: 'client_1', trustScore: 10 },
        { id: 'client_2', trustScore: 10 },
        { id: 'client_3', trustScore: 10 },
        { id: 'client_4', trustScore: 10 },
      ]);

      const canaries = await service.selectCanaryClients({});

      expect(canaries.length).toBeLessThanOrEqual(3);
    });

    it('should mark clients as canary', async () => {
      mockClientRepository.findAll.mockResolvedValue([
        { id: 'client_1', trustScore: 9 },
      ]);

      await service.selectCanaryClients({});

      expect(mockClientRepository.update).toHaveBeenCalledWith(
        'client_1',
        expect.objectContaining({
          isCanary: true,
          canaryEnrolledAt: expect.any(String),
        })
      );
    });
  });

  describe('getCanaryClients', () => {
    it('should return currently enrolled canaries', async () => {
      mockClientRepository.findAll.mockResolvedValue([
        { id: 'client_1', isCanary: true },
        { id: 'client_2', isCanary: false },
      ]);

      const canaries = await service.getCanaryClients();

      expect(canaries).toHaveLength(1);
      expect(canaries[0].id).toBe('client_1');
    });
  });

  describe('removeFromCanary', () => {
    it('should remove canary status', async () => {
      await service.removeFromCanary('client_1', { reason: 'Graduated to GA' });

      expect(mockClientRepository.update).toHaveBeenCalledWith(
        'client_1',
        expect.objectContaining({
          isCanary: false,
          canaryRemovedAt: expect.any(String),
          canaryRemovalReason: 'Graduated to GA',
        })
      );
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/rollout/canary/src/canary-selection.ts`

```typescript
export interface CanarySelectionCriteria {
  minTrustScore?: number;
  minTenureDays?: number;
  requiresConsent?: boolean;
  excludeIds?: string[];
}

export interface CanaryClient {
  id: string;
  name: string;
  trustScore: number;
  isCanary: boolean;
  canaryEnrolledAt?: string;
}

export interface CanarySelectionServiceConfig {
  clientRepository: any;
  maxCanaryClients?: number;
}

export class CanarySelectionService {
  private clientRepository: any;
  private maxCanaryClients: number;

  constructor(config: CanarySelectionServiceConfig) {
    this.clientRepository = config.clientRepository;
    this.maxCanaryClients = config.maxCanaryClients ?? 3;
  }

  async selectCanaryClients(criteria: CanarySelectionCriteria): Promise<CanaryClient[]> {
    const clients = await this.clientRepository.findAll();

    const eligible = clients.filter((client: any) => {
      if (criteria.minTrustScore && client.trustScore < criteria.minTrustScore) {
        return false;
      }

      if (criteria.minTenureDays) {
        const tenure = this.calculateTenureDays(client.activeSince);
        if (tenure < criteria.minTenureDays) {
          return false;
        }
      }

      if (criteria.excludeIds?.includes(client.id)) {
        return false;
      }

      return true;
    });

    // Sort by trust score and take top N
    const selected = eligible
      .sort((a: any, b: any) => b.trustScore - a.trustScore)
      .slice(0, this.maxCanaryClients);

    // Mark as canary
    for (const client of selected) {
      await this.clientRepository.update(client.id, {
        isCanary: true,
        canaryEnrolledAt: new Date().toISOString(),
      });
    }

    return selected;
  }

  async getCanaryClients(): Promise<CanaryClient[]> {
    const clients = await this.clientRepository.findAll();
    return clients.filter((c: any) => c.isCanary);
  }

  async removeFromCanary(clientId: string, options: { reason: string }): Promise<void> {
    await this.clientRepository.update(clientId, {
      isCanary: false,
      canaryRemovedAt: new Date().toISOString(),
      canaryRemovalReason: options.reason,
    });
  }

  private calculateTenureDays(activeSince: string): number {
    const start = new Date(activeSince);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }
}
```

---

## Acceptance Criteria

- [ ] Canary selection based on trust score and tenure
- [ ] Maximum canary limit enforced
- [ ] Clients marked with canary status and enrollment date
- [ ] Removal tracking with reason

---

## JSON Task Block

```json
{
  "task_id": "S5-B1",
  "name": "Canary Client Selection",
  "description": "CanarySelectionService for identifying early adopter clients",
  "status": "pending",
  "dependencies": ["S5-A5"],
  "blocks": ["S5-B2"],
  "agent": "B",
  "sprint": 5,
  "complexity": "low"
}
```
