# Build Prompt: S5-B3 — Gradual Rollout Plan

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-B3 |
| Sprint | 5 - Gated Rollout |
| Agent | B - Canary Client Configuration |
| Task Name | Gradual Rollout Plan |
| Complexity | Medium |
| Status | pending |
| Dependencies | S5-B2 |
| Blocked By | None |

---

## Context

### What This Builds

The GradualRolloutService that orchestrates phased rollout from 10% → 50% → 100% of clients. Each phase includes monitoring checkpoints, success criteria, and automatic progression or rollback triggers.

### Why It Matters

- **Controlled Exposure**: Limit impact of issues to subset of clients
- **Automated Progression**: Move forward when metrics are healthy
- **Automatic Rollback**: Revert when issues detected
- **Visibility**: Clear rollout status and timeline
- **Reproducibility**: Documented rollout process

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/rollout/gradual/src/__tests__/gradual-rollout.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GradualRolloutService } from '../gradual-rollout';

describe('GradualRolloutService', () => {
  let service: GradualRolloutService;
  let mockFeatureFlags: any;
  let mockMetrics: any;

  beforeEach(() => {
    mockFeatureFlags = {
      setFlag: vi.fn(),
      getRolloutStatus: vi.fn(),
    };

    mockMetrics = {
      getSuccessRate: vi.fn().mockResolvedValue(0.99),
      getErrorRate: vi.fn().mockResolvedValue(0.01),
    };

    service = new GradualRolloutService({
      featureFlags: mockFeatureFlags,
      metrics: mockMetrics,
      rolloutStages: [10, 50, 100],
      monitoringPeriodMs: 3600000, // 1 hour
    });
  });

  describe('startRollout', () => {
    it('should start at first stage (10%)', async () => {
      await service.startRollout('new_feature');

      expect(mockFeatureFlags.setFlag).toHaveBeenCalledWith(
        'new_feature',
        expect.objectContaining({ rolloutPercentage: 10 })
      );
    });
  });

  describe('advanceRollout', () => {
    it('should advance to next stage when metrics healthy', async () => {
      mockFeatureFlags.getRolloutStatus.mockResolvedValue({ percentage: 10 });
      mockMetrics.getSuccessRate.mockResolvedValue(0.99);

      const result = await service.advanceRollout('new_feature');

      expect(result.advanced).toBe(true);
      expect(result.newPercentage).toBe(50);
    });

    it('should not advance when metrics unhealthy', async () => {
      mockFeatureFlags.getRolloutStatus.mockResolvedValue({ percentage: 10 });
      mockMetrics.getSuccessRate.mockResolvedValue(0.80);

      const result = await service.advanceRollout('new_feature');

      expect(result.advanced).toBe(false);
      expect(result.reason).toContain('success rate');
    });
  });

  describe('rollback', () => {
    it('should return to previous stage', async () => {
      mockFeatureFlags.getRolloutStatus.mockResolvedValue({ percentage: 50 });

      await service.rollback('new_feature', { reason: 'Error spike detected' });

      expect(mockFeatureFlags.setFlag).toHaveBeenCalledWith(
        'new_feature',
        expect.objectContaining({ rolloutPercentage: 10 })
      );
    });

    it('should disable completely from first stage', async () => {
      mockFeatureFlags.getRolloutStatus.mockResolvedValue({ percentage: 10 });

      await service.rollback('new_feature', { reason: 'Critical issue' });

      expect(mockFeatureFlags.setFlag).toHaveBeenCalledWith(
        'new_feature',
        expect.objectContaining({ enabled: false })
      );
    });
  });

  describe('getRolloutPlan', () => {
    it('should return planned stages and current progress', async () => {
      mockFeatureFlags.getRolloutStatus.mockResolvedValue({ percentage: 50 });

      const plan = await service.getRolloutPlan('new_feature');

      expect(plan.stages).toEqual([10, 50, 100]);
      expect(plan.currentStage).toBe(1); // Index
      expect(plan.currentPercentage).toBe(50);
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/rollout/gradual/src/gradual-rollout.ts`

```typescript
export interface GradualRolloutServiceConfig {
  featureFlags: any;
  metrics: any;
  rolloutStages?: number[];
  monitoringPeriodMs?: number;
  successRateThreshold?: number;
}

export interface RolloutPlan {
  featureName: string;
  stages: number[];
  currentStage: number;
  currentPercentage: number;
  startedAt: string;
  lastAdvancedAt?: string;
}

export class GradualRolloutService {
  private featureFlags: any;
  private metrics: any;
  private rolloutStages: number[];
  private successRateThreshold: number;

  constructor(config: GradualRolloutServiceConfig) {
    this.featureFlags = config.featureFlags;
    this.metrics = config.metrics;
    this.rolloutStages = config.rolloutStages ?? [10, 50, 100];
    this.successRateThreshold = config.successRateThreshold ?? 0.95;
  }

  async startRollout(featureName: string): Promise<void> {
    await this.featureFlags.setFlag(featureName, {
      enabled: true,
      rolloutPercentage: this.rolloutStages[0],
      rolloutStartedAt: new Date().toISOString(),
    });
  }

  async advanceRollout(featureName: string): Promise<{ advanced: boolean; newPercentage?: number; reason?: string }> {
    const status = await this.featureFlags.getRolloutStatus(featureName);
    const currentIndex = this.rolloutStages.indexOf(status.percentage);

    if (currentIndex === this.rolloutStages.length - 1) {
      return { advanced: false, reason: 'Already at 100%' };
    }

    // Check metrics
    const successRate = await this.metrics.getSuccessRate(featureName);
    if (successRate < this.successRateThreshold) {
      return { advanced: false, reason: `Insufficient success rate: ${successRate}` };
    }

    const newPercentage = this.rolloutStages[currentIndex + 1];
    await this.featureFlags.setFlag(featureName, {
      rolloutPercentage: newPercentage,
      lastAdvancedAt: new Date().toISOString(),
    });

    return { advanced: true, newPercentage };
  }

  async rollback(featureName: string, options: { reason: string }): Promise<void> {
    const status = await this.featureFlags.getRolloutStatus(featureName);
    const currentIndex = this.rolloutStages.indexOf(status.percentage);

    if (currentIndex <= 0) {
      // Disable completely
      await this.featureFlags.setFlag(featureName, {
        enabled: false,
        rollbackReason: options.reason,
        rolledBackAt: new Date().toISOString(),
      });
    } else {
      // Go to previous stage
      await this.featureFlags.setFlag(featureName, {
        rolloutPercentage: this.rolloutStages[currentIndex - 1],
        rollbackReason: options.reason,
        rolledBackAt: new Date().toISOString(),
      });
    }
  }

  async getRolloutPlan(featureName: string): Promise<RolloutPlan> {
    const status = await this.featureFlags.getRolloutStatus(featureName);
    const flag = await this.featureFlags.getFlag(featureName);

    return {
      featureName,
      stages: this.rolloutStages,
      currentStage: this.rolloutStages.indexOf(status.percentage),
      currentPercentage: status.percentage,
      startedAt: flag?.rolloutStartedAt,
      lastAdvancedAt: flag?.lastAdvancedAt,
    };
  }
}
```

---

## Acceptance Criteria

- [ ] Rollout starts at configured first stage (10%)
- [ ] Advancement requires healthy metrics
- [ ] Rollback returns to previous stage or disables
- [ ] Rollout plan shows current progress and history

---

## JSON Task Block

```json
{
  "task_id": "S5-B3",
  "name": "Gradual Rollout Plan",
  "description": "GradualRolloutService for 10%→50%→100% phased rollout",
  "status": "pending",
  "dependencies": ["S5-B2"],
  "blocks": ["S5-B4"],
  "agent": "B",
  "sprint": 5,
  "complexity": "medium"
}
```
