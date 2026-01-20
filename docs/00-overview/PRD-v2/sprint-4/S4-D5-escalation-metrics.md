# Build Prompt: S4-D5 — Escalation Metrics

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S4-D5 |
| Sprint | 4 - Engagement |
| Agent | D - Escalation |
| Task Name | Escalation Metrics |
| Complexity | Medium |
| Status | pending |
| Dependencies | S4-D1, S4-D2, S4-D3, S4-D4 |
| Blocked By | None |

---

## Context

### What This Builds

The EscalationMetrics service that aggregates escalation data into actionable dashboards: volume trends, category breakdowns, SLA compliance rates, operator performance rankings, and root cause patterns. This provides operational visibility for managing the escalation team.

### Why It Matters

- **Operational Visibility**: Real-time understanding of escalation load and performance
- **Resource Planning**: Identify peak hours and staffing needs
- **Quality Improvement**: Track satisfaction trends and identify training needs
- **Cost Management**: Monitor resolution efficiency and capacity utilization
- **Trend Detection**: Spot emerging issues before they become crises

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Observability | Metrics emission patterns |
| `docs/06-reliability-ops/slo-error-budget.md` | SLOs | Performance targets |
| `docs/05-policy-safety/compliance-safety-policy.md` | Incident Management | Escalation requirements |
| `docs/02-schemas/external-memory-schema.md` | Episode Structure | Metrics episode logging |

---

## Prerequisites

### Completed Tasks

- [x] S4-D1: EscalationTriggerService (provides trigger data)
- [x] S4-D2: HumanHandoffService (provides handoff data)
- [x] S4-D3: EscalationQueue (provides queue metrics)
- [x] S4-D4: ResolutionTracker (provides resolution data)

### Required Packages

```json
{
  "dependencies": {
    "zod": "^3.23.0",
    "date-fns": "^3.6.0",
    "@opentelemetry/api": "^1.9.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create comprehensive tests BEFORE any implementation.

#### 1.1 Create Metrics Types Test

**File:** `packages/engagement/escalation/src/__tests__/metrics-types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  MetricsPeriodSchema,
  EscalationVolumeMetricsSchema,
  CategoryBreakdownSchema,
  SLAMetricsSchema,
  OperatorMetricsSchema,
  TrendPointSchema,
  DashboardConfigSchema,
  validateMetricsPeriod,
} from '../metrics-types';

describe('Metrics Types', () => {
  describe('MetricsPeriodSchema', () => {
    it('should validate hourly period', () => {
      const period = {
        granularity: 'hourly' as const,
        startDate: '2025-01-16T00:00:00Z',
        endDate: '2025-01-16T23:59:59Z',
        timezone: 'UTC',
      };

      const result = MetricsPeriodSchema.safeParse(period);
      expect(result.success).toBe(true);
    });

    it('should validate daily period', () => {
      const period = {
        granularity: 'daily' as const,
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
        timezone: 'America/New_York',
      };

      const result = MetricsPeriodSchema.safeParse(period);
      expect(result.success).toBe(true);
    });

    it('should validate weekly period', () => {
      const period = {
        granularity: 'weekly' as const,
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-03-31T23:59:59Z',
      };

      const result = MetricsPeriodSchema.safeParse(period);
      expect(result.success).toBe(true);
    });

    it('should validate monthly period', () => {
      const period = {
        granularity: 'monthly' as const,
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-12-31T23:59:59Z',
      };

      const result = MetricsPeriodSchema.safeParse(period);
      expect(result.success).toBe(true);
    });

    it('should reject invalid granularity', () => {
      const period = {
        granularity: 'minutely',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      const result = MetricsPeriodSchema.safeParse(period);
      expect(result.success).toBe(false);
    });
  });

  describe('EscalationVolumeMetricsSchema', () => {
    it('should validate complete volume metrics', () => {
      const metrics = {
        period: {
          granularity: 'daily',
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-01-31T23:59:59Z',
        },
        totalEscalations: 150,
        openEscalations: 12,
        resolvedEscalations: 130,
        unresolvedEscalations: 8,
        averagePerDay: 4.84,
        peakHour: 14,
        peakDay: 'Monday',
        comparisonPeriod: {
          totalEscalations: 120,
          percentChange: 25,
        },
      };

      const result = EscalationVolumeMetricsSchema.safeParse(metrics);
      expect(result.success).toBe(true);
    });

    it('should allow optional comparison period', () => {
      const metrics = {
        period: {
          granularity: 'daily',
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-01-31T23:59:59Z',
        },
        totalEscalations: 150,
        openEscalations: 12,
        resolvedEscalations: 130,
        unresolvedEscalations: 8,
        averagePerDay: 4.84,
      };

      const result = EscalationVolumeMetricsSchema.safeParse(metrics);
      expect(result.success).toBe(true);
    });
  });

  describe('CategoryBreakdownSchema', () => {
    it('should validate category breakdown', () => {
      const breakdown = {
        category: 'sentiment',
        count: 45,
        percentage: 30,
        averageTimeToResolutionMs: 1500000,
        resolutionRate: 0.85,
        satisfactionAverage: 4.2,
        trend: 'increasing' as const,
      };

      const result = CategoryBreakdownSchema.safeParse(breakdown);
      expect(result.success).toBe(true);
    });

    it('should validate trend enum values', () => {
      const trends = ['increasing', 'decreasing', 'stable'] as const;

      trends.forEach(trend => {
        const breakdown = {
          category: 'legal',
          count: 10,
          percentage: 6.67,
          trend,
        };

        const result = CategoryBreakdownSchema.safeParse(breakdown);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('SLAMetricsSchema', () => {
    it('should validate SLA metrics', () => {
      const metrics = {
        priority: 'urgent' as const,
        targetMs: 900000,
        totalEscalations: 20,
        withinSLA: 18,
        overSLA: 2,
        complianceRate: 0.9,
        averageResponseTimeMs: 720000,
        medianResponseTimeMs: 650000,
        p95ResponseTimeMs: 880000,
        p99ResponseTimeMs: 895000,
      };

      const result = SLAMetricsSchema.safeParse(metrics);
      expect(result.success).toBe(true);
    });

    it('should validate all priority levels', () => {
      const priorities = ['urgent', 'high', 'medium', 'low'] as const;

      priorities.forEach(priority => {
        const metrics = {
          priority,
          targetMs: 900000,
          totalEscalations: 20,
          withinSLA: 18,
          overSLA: 2,
          complianceRate: 0.9,
        };

        const result = SLAMetricsSchema.safeParse(metrics);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('OperatorMetricsSchema', () => {
    it('should validate operator metrics', () => {
      const metrics = {
        operatorId: 'op_123',
        operatorName: 'John Doe',
        totalResolutions: 45,
        resolutionRate: 0.92,
        averageTimeToResolutionMs: 1200000,
        averageSatisfaction: 4.5,
        escalationsHandled: 50,
        currentWorkload: 3,
        utilizationRate: 0.75,
        rank: 2,
      };

      const result = OperatorMetricsSchema.safeParse(metrics);
      expect(result.success).toBe(true);
    });
  });

  describe('TrendPointSchema', () => {
    it('should validate trend data point', () => {
      const point = {
        timestamp: '2025-01-16T00:00:00Z',
        value: 15,
        label: 'Jan 16',
      };

      const result = TrendPointSchema.safeParse(point);
      expect(result.success).toBe(true);
    });
  });

  describe('DashboardConfigSchema', () => {
    it('should validate dashboard configuration', () => {
      const config = {
        clientId: 'client_001',
        refreshIntervalMs: 60000,
        defaultPeriod: {
          granularity: 'daily',
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-01-31T23:59:59Z',
        },
        widgets: ['volume', 'sla', 'categories', 'operators'],
        alertThresholds: {
          slaComplianceWarning: 0.9,
          slaComplianceCritical: 0.8,
          queueDepthWarning: 10,
          queueDepthCritical: 20,
        },
      };

      const result = DashboardConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Functions', () => {
    it('should validate period with type guard', () => {
      const period = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      expect(validateMetricsPeriod(period)).toBe(true);
    });

    it('should reject invalid period', () => {
      const period = {
        granularity: 'invalid',
        startDate: '2025-01-01',
      };

      expect(validateMetricsPeriod(period)).toBe(false);
    });
  });
});
```

#### 1.2 Create EscalationMetricsService Test

**File:** `packages/engagement/escalation/src/__tests__/escalation-metrics.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EscalationMetricsService } from '../escalation-metrics';
import { MetricsPeriod } from '../metrics-types';

describe('EscalationMetricsService', () => {
  let service: EscalationMetricsService;
  let mockRepository: any;
  let mockCache: any;
  let mockTelemetry: any;

  beforeEach(() => {
    mockRepository = {
      getEscalationVolume: vi.fn(),
      getCategoryBreakdown: vi.fn(),
      getSLAMetrics: vi.fn(),
      getOperatorMetrics: vi.fn(),
      getTrendData: vi.fn(),
      getResolutionDistribution: vi.fn(),
      getPlatformBreakdown: vi.fn(),
    };

    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };

    mockTelemetry = {
      recordMetricsQuery: vi.fn(),
    };

    service = new EscalationMetricsService({
      repository: mockRepository,
      cache: mockCache,
      telemetry: mockTelemetry,
      cacheTtlMs: 60000,
    });
  });

  describe('getVolumeMetrics', () => {
    it('should return volume metrics for a period', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getEscalationVolume.mockResolvedValue({
        totalEscalations: 150,
        openEscalations: 12,
        resolvedEscalations: 130,
        unresolvedEscalations: 8,
        byDay: { Monday: 35, Tuesday: 28, Wednesday: 22 },
        byHour: { 14: 25, 15: 22, 10: 20 },
      });

      const metrics = await service.getVolumeMetrics('client_001', period);

      expect(metrics.totalEscalations).toBe(150);
      expect(metrics.openEscalations).toBe(12);
      expect(metrics.resolvedEscalations).toBe(130);
      expect(metrics.unresolvedEscalations).toBe(8);
      expect(metrics.period).toEqual(period);
      expect(metrics.averagePerDay).toBeCloseTo(4.84, 1); // 150/31 days
    });

    it('should calculate peak hour and day', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getEscalationVolume.mockResolvedValue({
        totalEscalations: 100,
        openEscalations: 5,
        resolvedEscalations: 90,
        unresolvedEscalations: 5,
        byDay: { Monday: 35, Tuesday: 28, Wednesday: 22, Thursday: 10, Friday: 5 },
        byHour: { 9: 10, 14: 25, 15: 22, 16: 18 },
      });

      const metrics = await service.getVolumeMetrics('client_001', period);

      expect(metrics.peakHour).toBe(14); // Highest volume hour
      expect(metrics.peakDay).toBe('Monday'); // Highest volume day
    });

    it('should include comparison period when requested', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getEscalationVolume
        .mockResolvedValueOnce({
          totalEscalations: 150,
          openEscalations: 12,
          resolvedEscalations: 130,
          unresolvedEscalations: 8,
        })
        .mockResolvedValueOnce({
          totalEscalations: 120,
          openEscalations: 10,
          resolvedEscalations: 105,
          unresolvedEscalations: 5,
        });

      const metrics = await service.getVolumeMetrics('client_001', period, {
        includeComparison: true,
      });

      expect(metrics.comparisonPeriod).toBeDefined();
      expect(metrics.comparisonPeriod?.totalEscalations).toBe(120);
      expect(metrics.comparisonPeriod?.percentChange).toBe(25); // (150-120)/120 * 100
    });

    it('should use cache when available', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      const cachedMetrics = {
        totalEscalations: 100,
        period,
      };

      mockCache.get.mockResolvedValue(cachedMetrics);

      const metrics = await service.getVolumeMetrics('client_001', period);

      expect(metrics.totalEscalations).toBe(100);
      expect(mockRepository.getEscalationVolume).not.toHaveBeenCalled();
    });
  });

  describe('getCategoryBreakdown', () => {
    it('should return category breakdown metrics', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getCategoryBreakdown.mockResolvedValue([
        { category: 'sentiment', count: 45, avgTtr: 1500000, resolutionRate: 0.85 },
        { category: 'legal', count: 15, avgTtr: 2100000, resolutionRate: 0.73 },
        { category: 'safety', count: 10, avgTtr: 900000, resolutionRate: 0.95 },
        { category: 'vip', count: 30, avgTtr: 1200000, resolutionRate: 0.90 },
      ]);

      const breakdown = await service.getCategoryBreakdown('client_001', period);

      expect(breakdown).toHaveLength(4);
      expect(breakdown[0].category).toBe('sentiment');
      expect(breakdown[0].count).toBe(45);
      expect(breakdown[0].percentage).toBe(45); // 45/100 * 100
    });

    it('should calculate percentage of total', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getCategoryBreakdown.mockResolvedValue([
        { category: 'sentiment', count: 60 },
        { category: 'legal', count: 40 },
      ]);

      const breakdown = await service.getCategoryBreakdown('client_001', period);

      expect(breakdown[0].percentage).toBe(60);
      expect(breakdown[1].percentage).toBe(40);
    });

    it('should calculate trends when historical data available', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-16T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getCategoryBreakdown
        .mockResolvedValueOnce([
          { category: 'sentiment', count: 60 },
        ])
        .mockResolvedValueOnce([
          { category: 'sentiment', count: 40 }, // Previous period had 40
        ]);

      const breakdown = await service.getCategoryBreakdown('client_001', period, {
        includeTrends: true,
      });

      expect(breakdown[0].trend).toBe('increasing'); // 60 > 40
    });
  });

  describe('getSLAMetrics', () => {
    it('should return SLA metrics by priority', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getSLAMetrics.mockResolvedValue([
        {
          priority: 'urgent',
          totalEscalations: 20,
          withinSLA: 18,
          overSLA: 2,
          avgResponseTime: 720000,
          medianResponseTime: 650000,
          p95ResponseTime: 880000,
          p99ResponseTime: 895000,
        },
        {
          priority: 'high',
          totalEscalations: 50,
          withinSLA: 45,
          overSLA: 5,
          avgResponseTime: 1500000,
          medianResponseTime: 1400000,
          p95ResponseTime: 1750000,
          p99ResponseTime: 1790000,
        },
      ]);

      const slaConfig = {
        urgent: 900000,
        high: 1800000,
        medium: 3600000,
        low: 14400000,
      };

      const metrics = await service.getSLAMetrics('client_001', period, slaConfig);

      expect(metrics).toHaveLength(2);
      expect(metrics[0].priority).toBe('urgent');
      expect(metrics[0].complianceRate).toBe(0.9); // 18/20
      expect(metrics[0].targetMs).toBe(900000);
    });

    it('should calculate overall SLA compliance', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getSLAMetrics.mockResolvedValue([
        { priority: 'urgent', totalEscalations: 10, withinSLA: 9, overSLA: 1 },
        { priority: 'high', totalEscalations: 20, withinSLA: 18, overSLA: 2 },
        { priority: 'medium', totalEscalations: 50, withinSLA: 48, overSLA: 2 },
        { priority: 'low', totalEscalations: 20, withinSLA: 20, overSLA: 0 },
      ]);

      const slaConfig = {
        urgent: 900000,
        high: 1800000,
        medium: 3600000,
        low: 14400000,
      };

      const metrics = await service.getSLAMetrics('client_001', period, slaConfig);
      const overallCompliance = service.calculateOverallCompliance(metrics);

      // (9+18+48+20) / (10+20+50+20) = 95/100 = 0.95
      expect(overallCompliance).toBe(0.95);
    });
  });

  describe('getOperatorMetrics', () => {
    it('should return operator performance metrics', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getOperatorMetrics.mockResolvedValue([
        {
          operatorId: 'op_001',
          operatorName: 'Alice',
          totalResolutions: 50,
          resolvedCount: 46,
          avgTtr: 1100000,
          avgSatisfaction: 4.7,
          escalationsHandled: 52,
          currentWorkload: 2,
        },
        {
          operatorId: 'op_002',
          operatorName: 'Bob',
          totalResolutions: 40,
          resolvedCount: 35,
          avgTtr: 1400000,
          avgSatisfaction: 4.3,
          escalationsHandled: 42,
          currentWorkload: 4,
        },
      ]);

      const metrics = await service.getOperatorMetrics('client_001', period);

      expect(metrics).toHaveLength(2);
      expect(metrics[0].operatorName).toBe('Alice');
      expect(metrics[0].resolutionRate).toBeCloseTo(0.92, 2); // 46/50
      expect(metrics[0].rank).toBe(1); // Best performer
    });

    it('should rank operators by composite score', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getOperatorMetrics.mockResolvedValue([
        {
          operatorId: 'op_001',
          operatorName: 'Alice',
          totalResolutions: 30,
          resolvedCount: 28,
          avgTtr: 1500000,
          avgSatisfaction: 4.5,
          escalationsHandled: 30,
          currentWorkload: 1,
        },
        {
          operatorId: 'op_002',
          operatorName: 'Bob',
          totalResolutions: 50,
          resolvedCount: 45,
          avgTtr: 1200000,
          avgSatisfaction: 4.3,
          escalationsHandled: 50,
          currentWorkload: 3,
        },
      ]);

      const metrics = await service.getOperatorMetrics('client_001', period);

      // Bob handles more volume with faster TTR, should rank higher
      const bobMetrics = metrics.find(m => m.operatorName === 'Bob');
      expect(bobMetrics?.rank).toBeLessThanOrEqual(2);
    });

    it('should calculate utilization rate', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getOperatorMetrics.mockResolvedValue([
        {
          operatorId: 'op_001',
          operatorName: 'Alice',
          totalResolutions: 40,
          resolvedCount: 38,
          avgTtr: 1200000,
          escalationsHandled: 40,
          currentWorkload: 3,
          availableHours: 160, // Full-time for 4 weeks
          activeHours: 120,
        },
      ]);

      const metrics = await service.getOperatorMetrics('client_001', period);

      expect(metrics[0].utilizationRate).toBe(0.75); // 120/160
    });
  });

  describe('getTrendData', () => {
    it('should return time series trend data', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-07T23:59:59Z',
      };

      mockRepository.getTrendData.mockResolvedValue([
        { date: '2025-01-01', volume: 15 },
        { date: '2025-01-02', volume: 18 },
        { date: '2025-01-03', volume: 12 },
        { date: '2025-01-04', volume: 8 },
        { date: '2025-01-05', volume: 5 },
        { date: '2025-01-06', volume: 20 },
        { date: '2025-01-07', volume: 22 },
      ]);

      const trend = await service.getTrendData('client_001', period, 'volume');

      expect(trend.points).toHaveLength(7);
      expect(trend.points[0].value).toBe(15);
      expect(trend.points[6].value).toBe(22);
    });

    it('should support different metric types', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-07T23:59:59Z',
      };

      mockRepository.getTrendData.mockResolvedValue([
        { date: '2025-01-01', sla_compliance: 0.95 },
        { date: '2025-01-02', sla_compliance: 0.92 },
        { date: '2025-01-03', sla_compliance: 0.88 },
      ]);

      const trend = await service.getTrendData('client_001', period, 'sla_compliance');

      expect(trend.metricType).toBe('sla_compliance');
      expect(trend.points[0].value).toBe(0.95);
    });

    it('should calculate moving average', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-07T23:59:59Z',
      };

      mockRepository.getTrendData.mockResolvedValue([
        { date: '2025-01-01', volume: 10 },
        { date: '2025-01-02', volume: 20 },
        { date: '2025-01-03', volume: 30 },
        { date: '2025-01-04', volume: 25 },
        { date: '2025-01-05', volume: 15 },
      ]);

      const trend = await service.getTrendData('client_001', period, 'volume', {
        includeMovingAverage: true,
        movingAverageWindow: 3,
      });

      expect(trend.movingAverage).toBeDefined();
      // MA for day 3 = (10+20+30)/3 = 20
      // MA for day 4 = (20+30+25)/3 = 25
      expect(trend.movingAverage![2]).toBe(20);
      expect(trend.movingAverage![3]).toBe(25);
    });
  });

  describe('getDashboard', () => {
    it('should aggregate all metrics into dashboard', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getEscalationVolume.mockResolvedValue({
        totalEscalations: 100,
        openEscalations: 10,
        resolvedEscalations: 85,
        unresolvedEscalations: 5,
      });

      mockRepository.getCategoryBreakdown.mockResolvedValue([
        { category: 'sentiment', count: 50 },
      ]);

      mockRepository.getSLAMetrics.mockResolvedValue([
        { priority: 'high', totalEscalations: 50, withinSLA: 45, overSLA: 5 },
      ]);

      mockRepository.getOperatorMetrics.mockResolvedValue([
        { operatorId: 'op_001', totalResolutions: 50 },
      ]);

      mockRepository.getTrendData.mockResolvedValue([
        { date: '2025-01-01', volume: 10 },
      ]);

      const slaConfig = {
        urgent: 900000,
        high: 1800000,
        medium: 3600000,
        low: 14400000,
      };

      const dashboard = await service.getDashboard('client_001', period, slaConfig);

      expect(dashboard.volume).toBeDefined();
      expect(dashboard.volume.totalEscalations).toBe(100);
      expect(dashboard.categories).toBeDefined();
      expect(dashboard.sla).toBeDefined();
      expect(dashboard.operators).toBeDefined();
      expect(dashboard.trends).toBeDefined();
      expect(dashboard.generatedAt).toBeDefined();
    });

    it('should include alert status', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getEscalationVolume.mockResolvedValue({
        totalEscalations: 100,
        openEscalations: 25, // High queue depth
        resolvedEscalations: 70,
        unresolvedEscalations: 5,
      });

      mockRepository.getCategoryBreakdown.mockResolvedValue([]);
      mockRepository.getSLAMetrics.mockResolvedValue([
        { priority: 'urgent', totalEscalations: 20, withinSLA: 14, overSLA: 6 }, // 70% compliance
      ]);
      mockRepository.getOperatorMetrics.mockResolvedValue([]);
      mockRepository.getTrendData.mockResolvedValue([]);

      const slaConfig = {
        urgent: 900000,
        high: 1800000,
        medium: 3600000,
        low: 14400000,
      };

      const alertThresholds = {
        slaComplianceWarning: 0.9,
        slaComplianceCritical: 0.8,
        queueDepthWarning: 15,
        queueDepthCritical: 25,
      };

      const dashboard = await service.getDashboard(
        'client_001',
        period,
        slaConfig,
        { alertThresholds }
      );

      expect(dashboard.alerts).toBeDefined();
      expect(dashboard.alerts.slaCompliance).toBe('critical'); // 70% < 80%
      expect(dashboard.alerts.queueDepth).toBe('critical'); // 25 >= 25
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics as CSV', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-07T23:59:59Z',
      };

      mockRepository.getTrendData.mockResolvedValue([
        { date: '2025-01-01', volume: 15, sla_compliance: 0.95 },
        { date: '2025-01-02', volume: 18, sla_compliance: 0.92 },
      ]);

      const csv = await service.exportMetrics('client_001', period, 'csv');

      expect(csv).toContain('date,volume,sla_compliance');
      expect(csv).toContain('2025-01-01,15,0.95');
    });

    it('should export metrics as JSON', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-07T23:59:59Z',
      };

      mockRepository.getEscalationVolume.mockResolvedValue({
        totalEscalations: 100,
      });
      mockRepository.getCategoryBreakdown.mockResolvedValue([]);
      mockRepository.getSLAMetrics.mockResolvedValue([]);
      mockRepository.getOperatorMetrics.mockResolvedValue([]);
      mockRepository.getTrendData.mockResolvedValue([]);

      const json = await service.exportMetrics('client_001', period, 'json');

      const parsed = JSON.parse(json);
      expect(parsed.volume.totalEscalations).toBe(100);
    });
  });

  describe('cache management', () => {
    it('should cache metrics for TTL duration', async () => {
      const period: MetricsPeriod = {
        granularity: 'daily',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };

      mockRepository.getEscalationVolume.mockResolvedValue({
        totalEscalations: 100,
      });

      await service.getVolumeMetrics('client_001', period);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('volume:client_001'),
        expect.any(Object),
        expect.objectContaining({ ttl: 60000 })
      );
    });

    it('should invalidate cache on request', async () => {
      await service.invalidateCache('client_001');

      expect(mockCache.invalidate).toHaveBeenCalledWith(
        expect.stringContaining('client_001')
      );
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Implement Metrics Types

**File:** `packages/engagement/escalation/src/metrics-types.ts`

```typescript
import { z } from 'zod';

/**
 * Time granularity for metrics aggregation
 */
export const GranularitySchema = z.enum(['hourly', 'daily', 'weekly', 'monthly']);
export type Granularity = z.infer<typeof GranularitySchema>;

/**
 * Metrics period definition
 */
export const MetricsPeriodSchema = z.object({
  granularity: GranularitySchema,
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  timezone: z.string().optional(),
});

export type MetricsPeriod = z.infer<typeof MetricsPeriodSchema>;

/**
 * Comparison period data
 */
export const ComparisonPeriodSchema = z.object({
  totalEscalations: z.number(),
  percentChange: z.number(),
});

export type ComparisonPeriod = z.infer<typeof ComparisonPeriodSchema>;

/**
 * Volume metrics
 */
export const EscalationVolumeMetricsSchema = z.object({
  period: MetricsPeriodSchema,
  totalEscalations: z.number(),
  openEscalations: z.number(),
  resolvedEscalations: z.number(),
  unresolvedEscalations: z.number(),
  averagePerDay: z.number().optional(),
  peakHour: z.number().optional(),
  peakDay: z.string().optional(),
  comparisonPeriod: ComparisonPeriodSchema.optional(),
});

export type EscalationVolumeMetrics = z.infer<typeof EscalationVolumeMetricsSchema>;

/**
 * Trend direction
 */
export const TrendDirectionSchema = z.enum(['increasing', 'decreasing', 'stable']);
export type TrendDirection = z.infer<typeof TrendDirectionSchema>;

/**
 * Category breakdown
 */
export const CategoryBreakdownSchema = z.object({
  category: z.string(),
  count: z.number(),
  percentage: z.number(),
  averageTimeToResolutionMs: z.number().optional(),
  resolutionRate: z.number().optional(),
  satisfactionAverage: z.number().optional(),
  trend: TrendDirectionSchema.optional(),
});

export type CategoryBreakdown = z.infer<typeof CategoryBreakdownSchema>;

/**
 * Priority levels
 */
export const PrioritySchema = z.enum(['urgent', 'high', 'medium', 'low']);
export type Priority = z.infer<typeof PrioritySchema>;

/**
 * SLA metrics
 */
export const SLAMetricsSchema = z.object({
  priority: PrioritySchema,
  targetMs: z.number(),
  totalEscalations: z.number(),
  withinSLA: z.number(),
  overSLA: z.number(),
  complianceRate: z.number(),
  averageResponseTimeMs: z.number().optional(),
  medianResponseTimeMs: z.number().optional(),
  p95ResponseTimeMs: z.number().optional(),
  p99ResponseTimeMs: z.number().optional(),
});

export type SLAMetrics = z.infer<typeof SLAMetricsSchema>;

/**
 * Operator metrics
 */
export const OperatorMetricsSchema = z.object({
  operatorId: z.string(),
  operatorName: z.string(),
  totalResolutions: z.number(),
  resolutionRate: z.number(),
  averageTimeToResolutionMs: z.number().optional(),
  averageSatisfaction: z.number().optional(),
  escalationsHandled: z.number(),
  currentWorkload: z.number(),
  utilizationRate: z.number().optional(),
  rank: z.number().optional(),
});

export type OperatorMetrics = z.infer<typeof OperatorMetricsSchema>;

/**
 * Trend data point
 */
export const TrendPointSchema = z.object({
  timestamp: z.string().datetime(),
  value: z.number(),
  label: z.string().optional(),
});

export type TrendPoint = z.infer<typeof TrendPointSchema>;

/**
 * Trend data
 */
export const TrendDataSchema = z.object({
  metricType: z.string(),
  period: MetricsPeriodSchema,
  points: z.array(TrendPointSchema),
  movingAverage: z.array(z.number()).optional(),
});

export type TrendData = z.infer<typeof TrendDataSchema>;

/**
 * Alert status
 */
export const AlertStatusSchema = z.enum(['ok', 'warning', 'critical']);
export type AlertStatus = z.infer<typeof AlertStatusSchema>;

/**
 * Dashboard alerts
 */
export const DashboardAlertsSchema = z.object({
  slaCompliance: AlertStatusSchema,
  queueDepth: AlertStatusSchema,
  resolutionRate: AlertStatusSchema.optional(),
});

export type DashboardAlerts = z.infer<typeof DashboardAlertsSchema>;

/**
 * Alert thresholds configuration
 */
export const AlertThresholdsSchema = z.object({
  slaComplianceWarning: z.number(),
  slaComplianceCritical: z.number(),
  queueDepthWarning: z.number(),
  queueDepthCritical: z.number(),
  resolutionRateWarning: z.number().optional(),
  resolutionRateCritical: z.number().optional(),
});

export type AlertThresholds = z.infer<typeof AlertThresholdsSchema>;

/**
 * Dashboard configuration
 */
export const DashboardConfigSchema = z.object({
  clientId: z.string(),
  refreshIntervalMs: z.number(),
  defaultPeriod: MetricsPeriodSchema,
  widgets: z.array(z.string()),
  alertThresholds: AlertThresholdsSchema.optional(),
});

export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;

/**
 * Complete dashboard data
 */
export const DashboardDataSchema = z.object({
  clientId: z.string(),
  period: MetricsPeriodSchema,
  generatedAt: z.string().datetime(),
  volume: EscalationVolumeMetricsSchema,
  categories: z.array(CategoryBreakdownSchema),
  sla: z.array(SLAMetricsSchema),
  operators: z.array(OperatorMetricsSchema),
  trends: z.record(z.string(), TrendDataSchema),
  alerts: DashboardAlertsSchema.optional(),
});

export type DashboardData = z.infer<typeof DashboardDataSchema>;

/**
 * SLA configuration
 */
export const SLAConfigSchema = z.record(z.string(), z.number());
export type SLAConfig = z.infer<typeof SLAConfigSchema>;

/**
 * Validation helpers
 */
export function validateMetricsPeriod(data: unknown): data is MetricsPeriod {
  return MetricsPeriodSchema.safeParse(data).success;
}

export function validateDashboardConfig(data: unknown): data is DashboardConfig {
  return DashboardConfigSchema.safeParse(data).success;
}
```

#### 2.2 Implement EscalationMetricsService

**File:** `packages/engagement/escalation/src/escalation-metrics.ts`

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  MetricsPeriod,
  EscalationVolumeMetrics,
  CategoryBreakdown,
  SLAMetrics,
  OperatorMetrics,
  TrendData,
  TrendPoint,
  DashboardData,
  DashboardAlerts,
  AlertThresholds,
  AlertStatus,
  SLAConfig,
} from './metrics-types';

const tracer = trace.getTracer('escalation-metrics');

export interface MetricsRepository {
  getEscalationVolume(
    clientId: string,
    period: MetricsPeriod
  ): Promise<VolumeRawData>;
  getCategoryBreakdown(
    clientId: string,
    period: MetricsPeriod
  ): Promise<CategoryRawData[]>;
  getSLAMetrics(
    clientId: string,
    period: MetricsPeriod
  ): Promise<SLARawData[]>;
  getOperatorMetrics(
    clientId: string,
    period: MetricsPeriod
  ): Promise<OperatorRawData[]>;
  getTrendData(
    clientId: string,
    period: MetricsPeriod,
    metricType: string
  ): Promise<TrendRawData[]>;
}

export interface MetricsCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options: { ttl: number }): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

export interface MetricsTelemetry {
  recordMetricsQuery(clientId: string, queryType: string, duration: number): void;
}

export interface EscalationMetricsServiceConfig {
  repository: MetricsRepository;
  cache: MetricsCache;
  telemetry: MetricsTelemetry;
  cacheTtlMs?: number;
}

interface VolumeRawData {
  totalEscalations: number;
  openEscalations: number;
  resolvedEscalations: number;
  unresolvedEscalations: number;
  byDay?: Record<string, number>;
  byHour?: Record<number, number>;
}

interface CategoryRawData {
  category: string;
  count: number;
  avgTtr?: number;
  resolutionRate?: number;
  avgSatisfaction?: number;
}

interface SLARawData {
  priority: string;
  totalEscalations: number;
  withinSLA: number;
  overSLA: number;
  avgResponseTime?: number;
  medianResponseTime?: number;
  p95ResponseTime?: number;
  p99ResponseTime?: number;
}

interface OperatorRawData {
  operatorId: string;
  operatorName: string;
  totalResolutions: number;
  resolvedCount?: number;
  avgTtr?: number;
  avgSatisfaction?: number;
  escalationsHandled: number;
  currentWorkload: number;
  availableHours?: number;
  activeHours?: number;
}

interface TrendRawData {
  date: string;
  [key: string]: string | number;
}

export interface VolumeOptions {
  includeComparison?: boolean;
}

export interface CategoryOptions {
  includeTrends?: boolean;
}

export interface TrendOptions {
  includeMovingAverage?: boolean;
  movingAverageWindow?: number;
}

export interface DashboardOptions {
  alertThresholds?: AlertThresholds;
}

export class EscalationMetricsService {
  private repository: MetricsRepository;
  private cache: MetricsCache;
  private telemetry: MetricsTelemetry;
  private cacheTtlMs: number;

  constructor(config: EscalationMetricsServiceConfig) {
    this.repository = config.repository;
    this.cache = config.cache;
    this.telemetry = config.telemetry;
    this.cacheTtlMs = config.cacheTtlMs ?? 60000;
  }

  /**
   * Get volume metrics
   */
  async getVolumeMetrics(
    clientId: string,
    period: MetricsPeriod,
    options: VolumeOptions = {}
  ): Promise<EscalationVolumeMetrics> {
    return tracer.startActiveSpan('getVolumeMetrics', async (span) => {
      const startTime = Date.now();
      try {
        // Check cache
        const cacheKey = `volume:${clientId}:${this.periodKey(period)}`;
        const cached = await this.cache.get<EscalationVolumeMetrics>(cacheKey);
        if (cached) {
          span.setAttribute('cache.hit', true);
          return cached;
        }

        // Fetch from repository
        const rawData = await this.repository.getEscalationVolume(clientId, period);

        // Calculate derived metrics
        const daysDiff = this.getDaysDiff(period);
        const averagePerDay = rawData.totalEscalations / daysDiff;

        // Find peak hour and day
        let peakHour: number | undefined;
        let peakDay: string | undefined;

        if (rawData.byHour) {
          const entries = Object.entries(rawData.byHour);
          if (entries.length > 0) {
            peakHour = parseInt(
              entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
            );
          }
        }

        if (rawData.byDay) {
          const entries = Object.entries(rawData.byDay);
          if (entries.length > 0) {
            peakDay = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
          }
        }

        const metrics: EscalationVolumeMetrics = {
          period,
          totalEscalations: rawData.totalEscalations,
          openEscalations: rawData.openEscalations,
          resolvedEscalations: rawData.resolvedEscalations,
          unresolvedEscalations: rawData.unresolvedEscalations,
          averagePerDay,
          peakHour,
          peakDay,
        };

        // Fetch comparison period if requested
        if (options.includeComparison) {
          const comparisonPeriod = this.getPreviousPeriod(period);
          const comparisonData = await this.repository.getEscalationVolume(
            clientId,
            comparisonPeriod
          );

          const percentChange =
            comparisonData.totalEscalations > 0
              ? ((rawData.totalEscalations - comparisonData.totalEscalations) /
                  comparisonData.totalEscalations) *
                100
              : 0;

          metrics.comparisonPeriod = {
            totalEscalations: comparisonData.totalEscalations,
            percentChange: Math.round(percentChange),
          };
        }

        // Cache result
        await this.cache.set(cacheKey, metrics, { ttl: this.cacheTtlMs });

        span.setStatus({ code: SpanStatusCode.OK });
        return metrics;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        this.telemetry.recordMetricsQuery(clientId, 'volume', Date.now() - startTime);
        span.end();
      }
    });
  }

  /**
   * Get category breakdown
   */
  async getCategoryBreakdown(
    clientId: string,
    period: MetricsPeriod,
    options: CategoryOptions = {}
  ): Promise<CategoryBreakdown[]> {
    return tracer.startActiveSpan('getCategoryBreakdown', async (span) => {
      try {
        const rawData = await this.repository.getCategoryBreakdown(clientId, period);
        const total = rawData.reduce((sum, cat) => sum + cat.count, 0);

        const breakdown: CategoryBreakdown[] = rawData.map((cat) => ({
          category: cat.category,
          count: cat.count,
          percentage: total > 0 ? (cat.count / total) * 100 : 0,
          averageTimeToResolutionMs: cat.avgTtr,
          resolutionRate: cat.resolutionRate,
          satisfactionAverage: cat.avgSatisfaction,
        }));

        // Calculate trends if requested
        if (options.includeTrends) {
          const previousPeriod = this.getPreviousPeriod(period);
          const previousData = await this.repository.getCategoryBreakdown(
            clientId,
            previousPeriod
          );
          const previousMap = new Map(previousData.map((c) => [c.category, c.count]));

          for (const cat of breakdown) {
            const previousCount = previousMap.get(cat.category) ?? 0;
            if (cat.count > previousCount * 1.1) {
              cat.trend = 'increasing';
            } else if (cat.count < previousCount * 0.9) {
              cat.trend = 'decreasing';
            } else {
              cat.trend = 'stable';
            }
          }
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return breakdown;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get SLA metrics
   */
  async getSLAMetrics(
    clientId: string,
    period: MetricsPeriod,
    slaConfig: SLAConfig
  ): Promise<SLAMetrics[]> {
    return tracer.startActiveSpan('getSLAMetrics', async (span) => {
      try {
        const rawData = await this.repository.getSLAMetrics(clientId, period);

        const metrics: SLAMetrics[] = rawData.map((sla) => ({
          priority: sla.priority as any,
          targetMs: slaConfig[sla.priority] ?? 0,
          totalEscalations: sla.totalEscalations,
          withinSLA: sla.withinSLA,
          overSLA: sla.overSLA,
          complianceRate:
            sla.totalEscalations > 0
              ? sla.withinSLA / sla.totalEscalations
              : 1,
          averageResponseTimeMs: sla.avgResponseTime,
          medianResponseTimeMs: sla.medianResponseTime,
          p95ResponseTimeMs: sla.p95ResponseTime,
          p99ResponseTimeMs: sla.p99ResponseTime,
        }));

        span.setStatus({ code: SpanStatusCode.OK });
        return metrics;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Calculate overall SLA compliance
   */
  calculateOverallCompliance(metrics: SLAMetrics[]): number {
    const totalEscalations = metrics.reduce((sum, m) => sum + m.totalEscalations, 0);
    const totalWithinSLA = metrics.reduce((sum, m) => sum + m.withinSLA, 0);
    return totalEscalations > 0 ? totalWithinSLA / totalEscalations : 1;
  }

  /**
   * Get operator metrics
   */
  async getOperatorMetrics(
    clientId: string,
    period: MetricsPeriod
  ): Promise<OperatorMetrics[]> {
    return tracer.startActiveSpan('getOperatorMetrics', async (span) => {
      try {
        const rawData = await this.repository.getOperatorMetrics(clientId, period);

        const metrics: OperatorMetrics[] = rawData.map((op) => ({
          operatorId: op.operatorId,
          operatorName: op.operatorName,
          totalResolutions: op.totalResolutions,
          resolutionRate:
            op.totalResolutions > 0
              ? (op.resolvedCount ?? op.totalResolutions) / op.totalResolutions
              : 0,
          averageTimeToResolutionMs: op.avgTtr,
          averageSatisfaction: op.avgSatisfaction,
          escalationsHandled: op.escalationsHandled,
          currentWorkload: op.currentWorkload,
          utilizationRate:
            op.availableHours && op.activeHours
              ? op.activeHours / op.availableHours
              : undefined,
        }));

        // Rank operators by composite score
        const ranked = this.rankOperators(metrics);

        span.setStatus({ code: SpanStatusCode.OK });
        return ranked;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get trend data
   */
  async getTrendData(
    clientId: string,
    period: MetricsPeriod,
    metricType: string,
    options: TrendOptions = {}
  ): Promise<TrendData> {
    return tracer.startActiveSpan('getTrendData', async (span) => {
      try {
        const rawData = await this.repository.getTrendData(clientId, period, metricType);

        const points: TrendPoint[] = rawData.map((d) => ({
          timestamp: new Date(d.date).toISOString(),
          value: d[metricType] as number,
          label: d.date,
        }));

        const trend: TrendData = {
          metricType,
          period,
          points,
        };

        // Calculate moving average if requested
        if (options.includeMovingAverage) {
          const window = options.movingAverageWindow ?? 7;
          trend.movingAverage = this.calculateMovingAverage(
            points.map((p) => p.value),
            window
          );
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return trend;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get complete dashboard data
   */
  async getDashboard(
    clientId: string,
    period: MetricsPeriod,
    slaConfig: SLAConfig,
    options: DashboardOptions = {}
  ): Promise<DashboardData> {
    return tracer.startActiveSpan('getDashboard', async (span) => {
      try {
        // Fetch all metrics in parallel
        const [volume, categories, sla, operators, volumeTrend] = await Promise.all([
          this.getVolumeMetrics(clientId, period),
          this.getCategoryBreakdown(clientId, period),
          this.getSLAMetrics(clientId, period, slaConfig),
          this.getOperatorMetrics(clientId, period),
          this.getTrendData(clientId, period, 'volume'),
        ]);

        const dashboard: DashboardData = {
          clientId,
          period,
          generatedAt: new Date().toISOString(),
          volume,
          categories,
          sla,
          operators,
          trends: {
            volume: volumeTrend,
          },
        };

        // Calculate alerts if thresholds provided
        if (options.alertThresholds) {
          dashboard.alerts = this.calculateAlerts(
            volume,
            sla,
            options.alertThresholds
          );
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return dashboard;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Export metrics
   */
  async exportMetrics(
    clientId: string,
    period: MetricsPeriod,
    format: 'csv' | 'json'
  ): Promise<string> {
    if (format === 'json') {
      const dashboard = await this.getDashboard(clientId, period, {});
      return JSON.stringify(dashboard, null, 2);
    }

    // CSV export
    const trendData = await this.repository.getTrendData(clientId, period, 'volume');
    const headers = Object.keys(trendData[0] || {}).join(',');
    const rows = trendData.map((row) =>
      Object.values(row).join(',')
    );
    return [headers, ...rows].join('\n');
  }

  /**
   * Invalidate cache
   */
  async invalidateCache(clientId: string): Promise<void> {
    await this.cache.invalidate(`*:${clientId}:*`);
  }

  // Private helpers

  private periodKey(period: MetricsPeriod): string {
    return `${period.granularity}:${period.startDate}:${period.endDate}`;
  }

  private getDaysDiff(period: MetricsPeriod): number {
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }

  private getPreviousPeriod(period: MetricsPeriod): MetricsPeriod {
    const duration =
      new Date(period.endDate).getTime() - new Date(period.startDate).getTime();
    const newEnd = new Date(new Date(period.startDate).getTime() - 1);
    const newStart = new Date(newEnd.getTime() - duration);

    return {
      granularity: period.granularity,
      startDate: newStart.toISOString(),
      endDate: newEnd.toISOString(),
      timezone: period.timezone,
    };
  }

  private rankOperators(metrics: OperatorMetrics[]): OperatorMetrics[] {
    // Score based on: resolution rate (40%), volume (30%), TTR (20%), satisfaction (10%)
    const scored = metrics.map((m) => {
      const resolutionScore = m.resolutionRate * 40;
      const volumeScore = Math.min(m.escalationsHandled / 50, 1) * 30; // Normalize to max 50
      const ttrScore = m.averageTimeToResolutionMs
        ? Math.max(0, (1 - m.averageTimeToResolutionMs / 3600000)) * 20
        : 10; // Penalize no data
      const satScore = m.averageSatisfaction
        ? (m.averageSatisfaction / 5) * 10
        : 5;

      return {
        ...m,
        _score: resolutionScore + volumeScore + ttrScore + satScore,
      };
    });

    // Sort by score and assign ranks
    scored.sort((a, b) => b._score - a._score);
    return scored.map((m, i) => {
      const { _score, ...metrics } = m;
      return { ...metrics, rank: i + 1 };
    });
  }

  private calculateMovingAverage(values: number[], window: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < window - 1) {
        result.push(0); // Not enough data
      } else {
        const sum = values.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / window);
      }
    }
    return result;
  }

  private calculateAlerts(
    volume: EscalationVolumeMetrics,
    sla: SLAMetrics[],
    thresholds: AlertThresholds
  ): DashboardAlerts {
    // SLA compliance alert
    const overallCompliance = this.calculateOverallCompliance(sla);
    let slaStatus: AlertStatus = 'ok';
    if (overallCompliance < thresholds.slaComplianceCritical) {
      slaStatus = 'critical';
    } else if (overallCompliance < thresholds.slaComplianceWarning) {
      slaStatus = 'warning';
    }

    // Queue depth alert
    let queueStatus: AlertStatus = 'ok';
    if (volume.openEscalations >= thresholds.queueDepthCritical) {
      queueStatus = 'critical';
    } else if (volume.openEscalations >= thresholds.queueDepthWarning) {
      queueStatus = 'warning';
    }

    return {
      slaCompliance: slaStatus,
      queueDepth: queueStatus,
    };
  }
}
```

### Phase 3: Verification

```bash
# Run tests
cd packages/engagement/escalation
pnpm test src/__tests__/metrics-types.test.ts
pnpm test src/__tests__/escalation-metrics.test.ts

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/engagement/escalation/src/metrics-types.ts` | Metrics type definitions |
| Create | `packages/engagement/escalation/src/escalation-metrics.ts` | EscalationMetricsService class |
| Create | `packages/engagement/escalation/src/__tests__/metrics-types.test.ts` | Type validation tests |
| Create | `packages/engagement/escalation/src/__tests__/escalation-metrics.test.ts` | Service tests |
| Modify | `packages/engagement/escalation/src/index.ts` | Export metrics components |

---

## Acceptance Criteria

- [ ] Volume metrics include total, open, resolved, unresolved counts
- [ ] Category breakdown shows count, percentage, and trends
- [ ] SLA metrics show compliance rates by priority level
- [ ] Operator metrics include resolution rate, TTR, satisfaction, rank
- [ ] Trend data supports multiple granularities (hourly, daily, weekly, monthly)
- [ ] Dashboard aggregates all metrics with alert status
- [ ] Export supports CSV and JSON formats
- [ ] Caching reduces database load for repeated queries
- [ ] All tests pass with >80% coverage

---

## Test Requirements

### Unit Tests
- Metrics period validation for all granularities
- Volume metrics calculation including peak detection
- Category breakdown percentage calculation
- SLA compliance rate computation
- Operator ranking algorithm
- Moving average calculation
- Alert threshold evaluation

### Integration Tests
- End-to-end dashboard generation
- Cache hit/miss behavior
- Export format verification

---

## Security & Safety Checklist

- [ ] Tenant isolation: all queries include client_id
- [ ] No PII in exported metrics
- [ ] Cache keys include client_id for isolation
- [ ] Rate limiting on export endpoints
- [ ] Operator data aggregated (no individual tracking)

---

## JSON Task Block

```json
{
  "task_id": "S4-D5",
  "name": "Escalation Metrics",
  "description": "EscalationMetricsService for dashboards, trends, and SLA tracking",
  "status": "pending",
  "dependencies": ["S4-D1", "S4-D2", "S4-D3", "S4-D4"],
  "blocks": [],
  "agent": "D",
  "sprint": 4,
  "complexity": "medium",
  "estimated_files": 4,
  "test_coverage_target": 80,
  "package": "@rtv/engagement/escalation",
  "exports": [
    "EscalationMetricsService",
    "MetricsPeriod",
    "EscalationVolumeMetrics",
    "CategoryBreakdown",
    "SLAMetrics",
    "OperatorMetrics",
    "TrendData",
    "DashboardData"
  ]
}
```

---

## External Memory Section

```yaml
episode_id: null
started_at: null
completed_at: null

references_read:
  - docs/01-architecture/system-architecture-v3.md
  - docs/06-reliability-ops/slo-error-budget.md
  - docs/05-policy-safety/compliance-safety-policy.md

writes_made: []

decisions:
  - decision: "Support multiple time granularities"
    rationale: "Different stakeholders need different views (ops=hourly, mgmt=weekly)"
  - decision: "Composite scoring for operator ranking"
    rationale: "Single dimension ranking unfair; balanced scoring rewards well-rounded performance"
  - decision: "Cache metrics with configurable TTL"
    rationale: "Dashboard queries expensive; freshness vs. performance tradeoff"

blockers: []
questions: []
```
