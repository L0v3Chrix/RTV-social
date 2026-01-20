# Build Prompt: S5-B4 — Rollback Triggers

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-B4 |
| Sprint | 5 - Gated Rollout |
| Agent | B - Canary Client Configuration |
| Task Name | Rollback Triggers |
| Complexity | High |
| Status | pending |
| Dependencies | S5-B3, S5-C1 |
| Blocked By | None |

---

## Context

### What This Builds

The AutoRollbackService that monitors metrics and automatically triggers rollback when thresholds are exceeded. Integrates with kill switches for immediate halt capabilities.

### Why It Matters

- **Automatic Protection**: No human intervention needed for obvious failures
- **Fast Response**: Sub-minute detection and reaction
- **Configurable Thresholds**: Per-feature sensitivity tuning
- **Integration**: Works with kill switches and feature flags
- **Auditability**: Complete rollback history

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/rollout/auto-rollback/src/__tests__/auto-rollback.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutoRollbackService } from '../auto-rollback';

describe('AutoRollbackService', () => {
  let service: AutoRollbackService;
  let mockMetrics: any;
  let mockRollout: any;
  let mockKillSwitch: any;

  beforeEach(() => {
    mockMetrics = {
      getErrorRate: vi.fn().mockResolvedValue(0.01),
      getLatencyP99: vi.fn().mockResolvedValue(500),
      subscribe: vi.fn(),
    };

    mockRollout = {
      rollback: vi.fn(),
    };

    mockKillSwitch = {
      activateGlobal: vi.fn(),
      activateForClient: vi.fn(),
    };

    service = new AutoRollbackService({
      metrics: mockMetrics,
      rollout: mockRollout,
      killSwitch: mockKillSwitch,
      thresholds: {
        errorRateCritical: 0.10,
        errorRateWarning: 0.05,
        latencyP99Critical: 5000,
      },
    });
  });

  describe('checkAndRollback', () => {
    it('should trigger rollback on critical error rate', async () => {
      mockMetrics.getErrorRate.mockResolvedValue(0.15);

      const result = await service.checkAndRollback('feature_x');

      expect(result.triggered).toBe(true);
      expect(result.reason).toContain('error rate');
      expect(mockRollout.rollback).toHaveBeenCalled();
    });

    it('should not trigger on healthy metrics', async () => {
      mockMetrics.getErrorRate.mockResolvedValue(0.01);
      mockMetrics.getLatencyP99.mockResolvedValue(200);

      const result = await service.checkAndRollback('feature_x');

      expect(result.triggered).toBe(false);
      expect(mockRollout.rollback).not.toHaveBeenCalled();
    });

    it('should activate kill switch on severe errors', async () => {
      mockMetrics.getErrorRate.mockResolvedValue(0.50);

      await service.checkAndRollback('feature_x', { activateKillSwitch: true });

      expect(mockKillSwitch.activateGlobal).toHaveBeenCalled();
    });
  });

  describe('watchFeature', () => {
    it('should subscribe to metrics for continuous monitoring', async () => {
      await service.watchFeature('feature_x');

      expect(mockMetrics.subscribe).toHaveBeenCalledWith(
        'feature_x',
        expect.any(Function)
      );
    });
  });

  describe('getRollbackHistory', () => {
    it('should return rollback events', async () => {
      mockMetrics.getErrorRate.mockResolvedValue(0.15);
      await service.checkAndRollback('feature_x');

      const history = await service.getRollbackHistory('feature_x');

      expect(history).toHaveLength(1);
      expect(history[0].feature).toBe('feature_x');
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/rollout/auto-rollback/src/auto-rollback.ts`

```typescript
export interface RollbackThresholds {
  errorRateCritical: number;
  errorRateWarning: number;
  latencyP99Critical: number;
}

export interface AutoRollbackServiceConfig {
  metrics: any;
  rollout: any;
  killSwitch: any;
  thresholds: RollbackThresholds;
}

export interface RollbackResult {
  triggered: boolean;
  reason?: string;
  timestamp: string;
}

export interface RollbackEvent {
  feature: string;
  reason: string;
  metrics: any;
  timestamp: string;
}

export class AutoRollbackService {
  private metrics: any;
  private rollout: any;
  private killSwitch: any;
  private thresholds: RollbackThresholds;
  private history: RollbackEvent[] = [];

  constructor(config: AutoRollbackServiceConfig) {
    this.metrics = config.metrics;
    this.rollout = config.rollout;
    this.killSwitch = config.killSwitch;
    this.thresholds = config.thresholds;
  }

  async checkAndRollback(
    feature: string,
    options?: { activateKillSwitch?: boolean }
  ): Promise<RollbackResult> {
    const errorRate = await this.metrics.getErrorRate(feature);
    const latencyP99 = await this.metrics.getLatencyP99(feature);

    // Check critical thresholds
    if (errorRate >= this.thresholds.errorRateCritical) {
      const reason = `Critical error rate: ${errorRate}`;
      await this.triggerRollback(feature, reason, { errorRate, latencyP99 });

      if (options?.activateKillSwitch || errorRate >= 0.5) {
        await this.killSwitch.activateGlobal({
          reason,
          activatedBy: 'auto_rollback',
        });
      }

      return { triggered: true, reason, timestamp: new Date().toISOString() };
    }

    if (latencyP99 >= this.thresholds.latencyP99Critical) {
      const reason = `Critical latency: ${latencyP99}ms`;
      await this.triggerRollback(feature, reason, { errorRate, latencyP99 });
      return { triggered: true, reason, timestamp: new Date().toISOString() };
    }

    return { triggered: false, timestamp: new Date().toISOString() };
  }

  async watchFeature(feature: string): Promise<void> {
    this.metrics.subscribe(feature, async (metrics: any) => {
      await this.checkAndRollback(feature);
    });
  }

  async unwatchFeature(feature: string): Promise<void> {
    this.metrics.unsubscribe(feature);
  }

  async getRollbackHistory(feature?: string): Promise<RollbackEvent[]> {
    if (feature) {
      return this.history.filter(e => e.feature === feature);
    }
    return this.history;
  }

  private async triggerRollback(feature: string, reason: string, metrics: any): Promise<void> {
    await this.rollout.rollback(feature, { reason });

    this.history.push({
      feature,
      reason,
      metrics,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## Acceptance Criteria

- [ ] Automatic rollback on critical error rate
- [ ] Automatic rollback on critical latency
- [ ] Kill switch activation on severe failures
- [ ] Continuous monitoring via subscription
- [ ] Rollback history tracking

---

## JSON Task Block

```json
{
  "task_id": "S5-B4",
  "name": "Rollback Triggers",
  "description": "AutoRollbackService for automatic rollback on metric thresholds",
  "status": "pending",
  "dependencies": ["S5-B3", "S5-C1"],
  "blocks": ["S5-B5"],
  "agent": "B",
  "sprint": 5,
  "complexity": "high"
}
```
