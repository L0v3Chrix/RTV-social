# Build Prompt: S5-B2 — Feature Flag Setup

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-B2 |
| Sprint | 5 - Gated Rollout |
| Agent | B - Canary Client Configuration |
| Task Name | Feature Flag Setup |
| Complexity | Medium |
| Status | pending |
| Dependencies | S5-B1, S0-C1 |
| Blocked By | None |

---

## Context

### What This Builds

The FeatureFlagService that provides per-client feature toggles for gradual rollout. Flags can be enabled globally, per-client, or by percentage, with real-time updates without deployment.

### Why It Matters

- **Gradual Rollout**: Enable features for subset of clients
- **Instant Rollback**: Disable features without deployment
- **A/B Testing**: Compare behavior between flag states
- **Client-Specific**: Enable features for specific clients only
- **Operational Control**: Quick response to issues

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Feature Flags | Flag architecture |
| `docs/07-engineering-process/ci-cd-spec.md` | Deployment | Flag integration |

---

## Prerequisites

### Completed Tasks

- [x] S5-B1: Canary selection (flags apply to canaries)
- [x] S0-C1: CI/CD (flag config deployment)

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/rollout/feature-flags/src/__tests__/feature-flag-service.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeatureFlagService } from '../feature-flag-service';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let mockStore: any;

  beforeEach(() => {
    mockStore = {
      getFlag: vi.fn(),
      setFlag: vi.fn(),
      getAllFlags: vi.fn(),
    };

    service = new FeatureFlagService({ store: mockStore });
  });

  describe('isEnabled', () => {
    it('should return true for globally enabled flag', async () => {
      mockStore.getFlag.mockResolvedValue({
        name: 'new_feature',
        enabled: true,
        rolloutPercentage: 100,
      });

      const result = await service.isEnabled('new_feature', 'client_123');

      expect(result).toBe(true);
    });

    it('should respect client-specific overrides', async () => {
      mockStore.getFlag.mockResolvedValue({
        name: 'new_feature',
        enabled: false,
        clientOverrides: {
          client_123: true,
        },
      });

      const result = await service.isEnabled('new_feature', 'client_123');

      expect(result).toBe(true);
    });

    it('should apply percentage rollout deterministically', async () => {
      mockStore.getFlag.mockResolvedValue({
        name: 'new_feature',
        enabled: true,
        rolloutPercentage: 50,
      });

      // Same client should get consistent result
      const result1 = await service.isEnabled('new_feature', 'client_abc');
      const result2 = await service.isEnabled('new_feature', 'client_abc');

      expect(result1).toBe(result2);
    });

    it('should return false for disabled flag', async () => {
      mockStore.getFlag.mockResolvedValue({
        name: 'new_feature',
        enabled: false,
      });

      const result = await service.isEnabled('new_feature', 'client_123');

      expect(result).toBe(false);
    });

    it('should return default value for unknown flag', async () => {
      mockStore.getFlag.mockResolvedValue(null);

      const result = await service.isEnabled('unknown_feature', 'client_123', {
        defaultValue: false,
      });

      expect(result).toBe(false);
    });
  });

  describe('setFlag', () => {
    it('should create new flag', async () => {
      await service.setFlag('new_feature', {
        enabled: true,
        description: 'Test feature',
      });

      expect(mockStore.setFlag).toHaveBeenCalledWith(
        'new_feature',
        expect.objectContaining({
          enabled: true,
          description: 'Test feature',
        })
      );
    });

    it('should update existing flag', async () => {
      mockStore.getFlag.mockResolvedValue({
        name: 'existing_feature',
        enabled: false,
      });

      await service.setFlag('existing_feature', { enabled: true });

      expect(mockStore.setFlag).toHaveBeenCalledWith(
        'existing_feature',
        expect.objectContaining({ enabled: true })
      );
    });
  });

  describe('setClientOverride', () => {
    it('should set client-specific override', async () => {
      mockStore.getFlag.mockResolvedValue({
        name: 'feature',
        enabled: false,
        clientOverrides: {},
      });

      await service.setClientOverride('feature', 'client_123', true);

      expect(mockStore.setFlag).toHaveBeenCalledWith(
        'feature',
        expect.objectContaining({
          clientOverrides: { client_123: true },
        })
      );
    });
  });

  describe('getRolloutStatus', () => {
    it('should return rollout statistics', async () => {
      mockStore.getFlag.mockResolvedValue({
        name: 'feature',
        enabled: true,
        rolloutPercentage: 50,
        clientOverrides: { client_1: true, client_2: false },
      });

      const status = await service.getRolloutStatus('feature');

      expect(status.percentage).toBe(50);
      expect(status.overrideCount).toBe(2);
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/rollout/feature-flags/src/feature-flag-service.ts`

```typescript
import { createHash } from 'crypto';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
  clientOverrides?: Record<string, boolean>;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlagStore {
  getFlag(name: string): Promise<FeatureFlag | null>;
  setFlag(name: string, flag: FeatureFlag): Promise<void>;
  getAllFlags(): Promise<FeatureFlag[]>;
}

export interface FeatureFlagServiceConfig {
  store: FlagStore;
}

export class FeatureFlagService {
  private store: FlagStore;

  constructor(config: FeatureFlagServiceConfig) {
    this.store = config.store;
  }

  async isEnabled(
    flagName: string,
    clientId: string,
    options?: { defaultValue?: boolean }
  ): Promise<boolean> {
    const flag = await this.store.getFlag(flagName);

    if (!flag) {
      return options?.defaultValue ?? false;
    }

    // Check client-specific override first
    if (flag.clientOverrides?.[clientId] !== undefined) {
      return flag.clientOverrides[clientId];
    }

    // Check if globally disabled
    if (!flag.enabled) {
      return false;
    }

    // Apply percentage rollout
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      return this.isInRolloutPercentage(flagName, clientId, flag.rolloutPercentage);
    }

    return true;
  }

  async setFlag(name: string, updates: Partial<FeatureFlag>): Promise<void> {
    const existing = await this.store.getFlag(name);
    const flag: FeatureFlag = {
      name,
      enabled: false,
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (!existing) {
      flag.createdAt = new Date().toISOString();
    }

    await this.store.setFlag(name, flag);
  }

  async setClientOverride(flagName: string, clientId: string, enabled: boolean): Promise<void> {
    const flag = await this.store.getFlag(flagName);
    if (!flag) {
      throw new Error(`Flag ${flagName} not found`);
    }

    await this.store.setFlag(flagName, {
      ...flag,
      clientOverrides: {
        ...flag.clientOverrides,
        [clientId]: enabled,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  async removeClientOverride(flagName: string, clientId: string): Promise<void> {
    const flag = await this.store.getFlag(flagName);
    if (!flag) {
      return;
    }

    const overrides = { ...flag.clientOverrides };
    delete overrides[clientId];

    await this.store.setFlag(flagName, {
      ...flag,
      clientOverrides: overrides,
      updatedAt: new Date().toISOString(),
    });
  }

  async getRolloutStatus(flagName: string): Promise<{
    enabled: boolean;
    percentage: number;
    overrideCount: number;
  }> {
    const flag = await this.store.getFlag(flagName);
    if (!flag) {
      throw new Error(`Flag ${flagName} not found`);
    }

    return {
      enabled: flag.enabled,
      percentage: flag.rolloutPercentage ?? 100,
      overrideCount: Object.keys(flag.clientOverrides ?? {}).length,
    };
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    return this.store.getAllFlags();
  }

  private isInRolloutPercentage(flagName: string, clientId: string, percentage: number): boolean {
    // Deterministic hash-based rollout
    const hash = createHash('sha256')
      .update(`${flagName}:${clientId}`)
      .digest('hex');
    const hashValue = parseInt(hash.slice(0, 8), 16);
    const bucket = hashValue % 100;
    return bucket < percentage;
  }
}
```

---

## Acceptance Criteria

- [ ] Global enable/disable for flags
- [ ] Client-specific overrides
- [ ] Percentage-based rollout with deterministic hashing
- [ ] Real-time flag updates without deployment
- [ ] Rollout status reporting

---

## JSON Task Block

```json
{
  "task_id": "S5-B2",
  "name": "Feature Flag Setup",
  "description": "FeatureFlagService for per-client feature toggles",
  "status": "pending",
  "dependencies": ["S5-B1", "S0-C1"],
  "blocks": ["S5-B3"],
  "agent": "B",
  "sprint": 5,
  "complexity": "medium"
}
```
