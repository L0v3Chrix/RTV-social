# Build Prompt: S5-A4 — Performance Benchmarking

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-A4 |
| Sprint | 5 - Gated Rollout |
| Agent | A - House Account Testing |
| Task Name | Performance Benchmarking |
| Complexity | Medium |
| Status | pending |
| Dependencies | S5-A3 |
| Blocked By | None |

---

## Context

### What This Builds

The PerformanceBenchmarkSuite that measures system performance against SLO targets: plan generation time, content creation latency, publish-to-verify time, and end-to-end throughput. Results establish baselines and detect regressions.

### Why It Matters

- **SLO Validation**: Prove system meets defined targets before client rollout
- **Regression Detection**: Catch performance degradation early
- **Capacity Planning**: Understand throughput limits per client
- **Bottleneck Identification**: Find slow components to optimize
- **Client Expectation Setting**: Document real performance characteristics

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/06-reliability-ops/slo-error-budget.md` | SLOs | Performance targets |
| `docs/01-architecture/system-architecture-v3.md` | Performance | Architecture constraints |
| `docs/07-engineering-process/testing-strategy.md` | Benchmarking | Test patterns |

---

## Prerequisites

### Completed Tasks

- [x] S5-A3: E2E test suite (benchmarks build on E2E flows)

### Required Packages

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

#### 1.1 Create Benchmark Types

**File:** `packages/tests/e2e/src/benchmarks/benchmark-types.ts`

```typescript
export interface BenchmarkResult {
  name: string;
  iterations: number;
  metrics: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  sloTarget?: number;
  meetsSLO: boolean;
  timestamp: string;
}

export interface BenchmarkSuiteResult {
  suiteId: string;
  suiteName: string;
  environment: string;
  startedAt: string;
  completedAt: string;
  results: BenchmarkResult[];
  summary: {
    totalBenchmarks: number;
    passing: number;
    failing: number;
  };
}

export interface SLOTargets {
  planGeneration: number;      // ms
  contentCreation: number;     // ms
  publishToVerify: number;     // ms
  e2eThroughput: number;       // posts/hour
  apiLatency: number;          // ms
}

export const DEFAULT_SLO_TARGETS: SLOTargets = {
  planGeneration: 30000,       // 30 seconds
  contentCreation: 60000,      // 1 minute
  publishToVerify: 300000,     // 5 minutes
  e2eThroughput: 60,           // 60 posts/hour
  apiLatency: 500,             // 500ms
};
```

#### 1.2 Create Benchmark Tests

**File:** `packages/tests/e2e/src/__tests__/performance.benchmark.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestContext, E2ETestContext } from '../framework/test-context';
import { PerformanceBenchmark } from '../benchmarks/performance-benchmark';
import { DEFAULT_SLO_TARGETS } from '../benchmarks/benchmark-types';

describe('Performance Benchmarks', () => {
  let ctx: E2ETestContext;
  let benchmark: PerformanceBenchmark;

  beforeAll(async () => {
    ctx = await createTestContext(/* sandbox */);
    benchmark = new PerformanceBenchmark({
      clientId: ctx.clientId,
      sloTargets: DEFAULT_SLO_TARGETS,
      warmupIterations: 2,
      measureIterations: 10,
    });
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  describe('Plan Generation Performance', () => {
    it('should meet SLO for plan generation (<30s)', async () => {
      const result = await benchmark.measurePlanGeneration();

      expect(result.meetsSLO).toBe(true);
      expect(result.metrics.p95).toBeLessThan(DEFAULT_SLO_TARGETS.planGeneration);
    });
  });

  describe('Content Creation Performance', () => {
    it('should meet SLO for content creation (<60s)', async () => {
      const result = await benchmark.measureContentCreation();

      expect(result.meetsSLO).toBe(true);
      expect(result.metrics.p95).toBeLessThan(DEFAULT_SLO_TARGETS.contentCreation);
    });
  });

  describe('Publish to Verify Performance', () => {
    it('should meet SLO for publish-verify cycle (<5min)', async () => {
      const result = await benchmark.measurePublishToVerify();

      expect(result.meetsSLO).toBe(true);
      expect(result.metrics.p95).toBeLessThan(DEFAULT_SLO_TARGETS.publishToVerify);
    });
  });

  describe('End-to-End Throughput', () => {
    it('should meet SLO for throughput (>60 posts/hour)', async () => {
      const result = await benchmark.measureThroughput();

      expect(result.meetsSLO).toBe(true);
      expect(result.metrics.mean).toBeGreaterThan(DEFAULT_SLO_TARGETS.e2eThroughput);
    });
  });

  describe('API Latency', () => {
    it('should meet SLO for API latency (<500ms)', async () => {
      const result = await benchmark.measureAPILatency();

      expect(result.meetsSLO).toBe(true);
      expect(result.metrics.p99).toBeLessThan(DEFAULT_SLO_TARGETS.apiLatency);
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Implement PerformanceBenchmark

**File:** `packages/tests/e2e/src/benchmarks/performance-benchmark.ts`

```typescript
import { BenchmarkResult, SLOTargets, DEFAULT_SLO_TARGETS } from './benchmark-types';

export interface PerformanceBenchmarkConfig {
  clientId: string;
  sloTargets?: SLOTargets;
  warmupIterations?: number;
  measureIterations?: number;
}

export class PerformanceBenchmark {
  private clientId: string;
  private sloTargets: SLOTargets;
  private warmupIterations: number;
  private measureIterations: number;

  constructor(config: PerformanceBenchmarkConfig) {
    this.clientId = config.clientId;
    this.sloTargets = config.sloTargets ?? DEFAULT_SLO_TARGETS;
    this.warmupIterations = config.warmupIterations ?? 3;
    this.measureIterations = config.measureIterations ?? 10;
  }

  async measurePlanGeneration(): Promise<BenchmarkResult> {
    return this.runBenchmark('plan_generation', async () => {
      // Simulate plan generation
      const start = Date.now();
      await this.simulatePlanGeneration();
      return Date.now() - start;
    }, this.sloTargets.planGeneration);
  }

  async measureContentCreation(): Promise<BenchmarkResult> {
    return this.runBenchmark('content_creation', async () => {
      const start = Date.now();
      await this.simulateContentCreation();
      return Date.now() - start;
    }, this.sloTargets.contentCreation);
  }

  async measurePublishToVerify(): Promise<BenchmarkResult> {
    return this.runBenchmark('publish_to_verify', async () => {
      const start = Date.now();
      await this.simulatePublishToVerify();
      return Date.now() - start;
    }, this.sloTargets.publishToVerify);
  }

  async measureThroughput(): Promise<BenchmarkResult> {
    return this.runBenchmark('throughput', async () => {
      return this.measurePostsPerHour();
    }, this.sloTargets.e2eThroughput, true);
  }

  async measureAPILatency(): Promise<BenchmarkResult> {
    return this.runBenchmark('api_latency', async () => {
      const start = Date.now();
      await this.simulateAPICall();
      return Date.now() - start;
    }, this.sloTargets.apiLatency);
  }

  private async runBenchmark(
    name: string,
    measureFn: () => Promise<number>,
    sloTarget: number,
    higherIsBetter = false
  ): Promise<BenchmarkResult> {
    // Warmup
    for (let i = 0; i < this.warmupIterations; i++) {
      await measureFn();
    }

    // Measure
    const measurements: number[] = [];
    for (let i = 0; i < this.measureIterations; i++) {
      measurements.push(await measureFn());
    }

    const metrics = this.calculateMetrics(measurements);
    const meetsSLO = higherIsBetter
      ? metrics.mean >= sloTarget
      : metrics.p95 <= sloTarget;

    return {
      name,
      iterations: this.measureIterations,
      metrics,
      sloTarget,
      meetsSLO,
      timestamp: new Date().toISOString(),
    };
  }

  private calculateMetrics(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(variance),
    };
  }

  // Simulation methods (replace with real implementations)
  private async simulatePlanGeneration(): Promise<void> {
    await this.delay(Math.random() * 5000 + 1000);
  }

  private async simulateContentCreation(): Promise<void> {
    await this.delay(Math.random() * 10000 + 2000);
  }

  private async simulatePublishToVerify(): Promise<void> {
    await this.delay(Math.random() * 30000 + 5000);
  }

  private async measurePostsPerHour(): Promise<number> {
    // Measure how many posts can be processed in a sample period
    const sampleDurationMs = 10000; // 10 seconds
    let postsProcessed = 0;
    const start = Date.now();

    while (Date.now() - start < sampleDurationMs) {
      await this.delay(100); // Simulate post processing
      postsProcessed++;
    }

    // Extrapolate to posts per hour
    return (postsProcessed / sampleDurationMs) * 3600000;
  }

  private async simulateAPICall(): Promise<void> {
    await this.delay(Math.random() * 200 + 50);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/tests/e2e/src/benchmarks/benchmark-types.ts` | Benchmark type definitions |
| Create | `packages/tests/e2e/src/benchmarks/performance-benchmark.ts` | PerformanceBenchmark class |
| Create | `packages/tests/e2e/src/__tests__/performance.benchmark.test.ts` | Benchmark tests |

---

## Acceptance Criteria

- [ ] Plan generation benchmark meets <30s SLO at p95
- [ ] Content creation benchmark meets <60s SLO at p95
- [ ] Publish-to-verify benchmark meets <5min SLO at p95
- [ ] Throughput benchmark meets >60 posts/hour
- [ ] API latency benchmark meets <500ms at p99
- [ ] Warmup iterations prevent cold-start skew
- [ ] Statistical metrics include mean, median, p95, p99, stdDev

---

## JSON Task Block

```json
{
  "task_id": "S5-A4",
  "name": "Performance Benchmarking",
  "description": "PerformanceBenchmarkSuite measuring system against SLO targets",
  "status": "pending",
  "dependencies": ["S5-A3"],
  "blocks": [],
  "agent": "A",
  "sprint": 5,
  "complexity": "medium",
  "estimated_files": 3,
  "test_coverage_target": 80,
  "package": "@rtv/tests/e2e"
}
```

---

## External Memory Section

```yaml
episode_id: null
started_at: null
completed_at: null

references_read:
  - docs/06-reliability-ops/slo-error-budget.md

writes_made: []

decisions:
  - decision: "Use p95 for most SLOs, p99 for latency"
    rationale: "p95 allows for outliers while ensuring good typical experience"
  - decision: "Include warmup iterations"
    rationale: "Prevents JIT compilation and cache cold-start from skewing results"

blockers: []
questions: []
```
