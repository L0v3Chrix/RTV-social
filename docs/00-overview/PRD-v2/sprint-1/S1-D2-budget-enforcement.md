# Build Prompt: S1-D2 — Budget Enforcement

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-D2 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | D — Runner Skeleton |
| **Task Name** | Budget Enforcement |
| **Complexity** | Medium |
| **Estimated Effort** | 4-5 hours |
| **Dependencies** | S1-D1 |
| **Blocks** | S1-D3, S1-D4, S1-D5, S2-* |
| **Status** | pending |

---

## Context

### What This Builds

Budget enforcement ensures episodes operate within defined limits. Every episode has budgets for tokens, time, retries, subcalls, and tool calls. The enforcement system tracks consumption in real-time and prevents operations that would exceed limits.

### Why It Matters

Without budget enforcement:
- Runaway LLM calls could cost thousands of dollars
- Infinite loops could consume resources indefinitely
- A single bug could exhaust tenant quotas
- Agent recursion could spiral out of control

### Budget Types

```
┌─────────────────────────────────────────────────────────────┐
│                     Budget Enforcement                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TOKEN BUDGET                                                │
│  ├─ maxTokens: 100,000                                      │
│  ├─ tokensUsed: 45,230                                      │
│  └─ remaining: 54,770                                       │
│                                                              │
│  TIME BUDGET                                                 │
│  ├─ maxTimeMs: 300,000 (5 min)                              │
│  ├─ timeElapsedMs: 120,000                                  │
│  └─ remaining: 180,000                                      │
│                                                              │
│  RETRY BUDGET                                                │
│  ├─ maxRetries: 3                                           │
│  ├─ retriesUsed: 1                                          │
│  └─ remaining: 2                                            │
│                                                              │
│  SUBCALL BUDGET (nested episodes)                           │
│  ├─ maxSubcalls: 10                                         │
│  ├─ subcallsUsed: 3                                         │
│  └─ remaining: 7                                            │
│                                                              │
│  TOOL CALL BUDGET                                           │
│  ├─ maxToolCalls: 50                                        │
│  ├─ toolCallsUsed: 23                                       │
│  └─ remaining: 27                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Reference Specs

| Document | Section | Relevance |
|----------|---------|-----------|
| `/docs/01-architecture/rlm-integration-spec.md` | Budget Enforcement | Requirements |
| `/docs/03-agents-tools/agent-recursion-contracts.md` | Subcall Budgets | Recursion limits |
| `/docs/06-reliability-ops/slo-error-budget.md` | Cost Control | SLO alignment |
| `/docs/01-architecture/system-architecture-v3.md` | Resource Governance | Architecture |

---

## Prerequisites

### Completed Tasks

- [x] **S1-D1**: Episode lifecycle management (budget state)

### Required Packages

```json
{
  "dependencies": {
    "zod": "^3.22.0",
    "@opentelemetry/api": "^1.7.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create comprehensive tests BEFORE implementation.

#### 1.1 Create Budget Checker Tests

**File:** `packages/runner/src/budget/__tests__/budget-checker.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createBudgetChecker, BudgetChecker } from '../budget-checker';
import { EpisodeBudget, BudgetState } from '../../episode/types';

describe('BudgetChecker', () => {
  let checker: BudgetChecker;

  const fullBudget: EpisodeBudget = {
    maxTokens: 100000,
    maxTimeMs: 300000,
    maxRetries: 3,
    maxSubcalls: 10,
    maxToolCalls: 50,
  };

  const emptyState: BudgetState = {
    tokensUsed: 0,
    timeElapsedMs: 0,
    retriesUsed: 0,
    subcallsUsed: 0,
    toolCallsUsed: 0,
  };

  beforeEach(() => {
    checker = createBudgetChecker();
  });

  describe('checkTokenBudget', () => {
    it('should allow when under budget', () => {
      const state = { ...emptyState, tokensUsed: 50000 };
      const result = checker.checkTokenBudget(fullBudget, state, 10000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(40000);
    });

    it('should deny when would exceed budget', () => {
      const state = { ...emptyState, tokensUsed: 95000 };
      const result = checker.checkTokenBudget(fullBudget, state, 10000);

      expect(result.allowed).toBe(false);
      expect(result.wouldExceedBy).toBe(5000);
    });

    it('should allow exactly at limit', () => {
      const state = { ...emptyState, tokensUsed: 90000 };
      const result = checker.checkTokenBudget(fullBudget, state, 10000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should return unlimited when no maxTokens set', () => {
      const noBudget: EpisodeBudget = {};
      const result = checker.checkTokenBudget(noBudget, emptyState, 1000000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });
  });

  describe('checkTimeBudget', () => {
    it('should allow when under time limit', () => {
      const state = { ...emptyState, timeElapsedMs: 120000 };
      const result = checker.checkTimeBudget(fullBudget, state);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(180000);
    });

    it('should deny when time exceeded', () => {
      const state = { ...emptyState, timeElapsedMs: 350000 };
      const result = checker.checkTimeBudget(fullBudget, state);

      expect(result.allowed).toBe(false);
      expect(result.exceededBy).toBe(50000);
    });

    it('should include deadline', () => {
      const state = { ...emptyState, timeElapsedMs: 100000 };
      const startTime = Date.now() - 100000;
      const result = checker.checkTimeBudget(fullBudget, state, startTime);

      expect(result.deadline).toBeDefined();
      expect(result.deadline).toBeGreaterThan(Date.now());
    });
  });

  describe('checkSubcallBudget', () => {
    it('should allow when under limit', () => {
      const state = { ...emptyState, subcallsUsed: 5 };
      const result = checker.checkSubcallBudget(fullBudget, state);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it('should deny when at limit', () => {
      const state = { ...emptyState, subcallsUsed: 10 };
      const result = checker.checkSubcallBudget(fullBudget, state);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('checkToolCallBudget', () => {
    it('should allow when under limit', () => {
      const state = { ...emptyState, toolCallsUsed: 25 };
      const result = checker.checkToolCallBudget(fullBudget, state);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(25);
    });

    it('should deny when would exceed', () => {
      const state = { ...emptyState, toolCallsUsed: 48 };
      const result = checker.checkToolCallBudget(fullBudget, state, 5);

      expect(result.allowed).toBe(false);
      expect(result.wouldExceedBy).toBe(3);
    });
  });

  describe('checkAll', () => {
    it('should return OK when all budgets pass', () => {
      const state: BudgetState = {
        tokensUsed: 50000,
        timeElapsedMs: 100000,
        retriesUsed: 1,
        subcallsUsed: 3,
        toolCallsUsed: 20,
      };

      const result = checker.checkAll(fullBudget, state);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should return violations when any budget fails', () => {
      const state: BudgetState = {
        tokensUsed: 110000, // Over
        timeElapsedMs: 100000,
        retriesUsed: 1,
        subcallsUsed: 15, // Over
        toolCallsUsed: 20,
      };

      const result = checker.checkAll(fullBudget, state);

      expect(result.allowed).toBe(false);
      expect(result.violations).toContain('tokens');
      expect(result.violations).toContain('subcalls');
    });

    it('should include all budget details', () => {
      const result = checker.checkAll(fullBudget, emptyState);

      expect(result.details).toMatchObject({
        tokens: { allowed: true, used: 0, max: 100000 },
        time: { allowed: true, used: 0, max: 300000 },
        retries: { allowed: true, used: 0, max: 3 },
        subcalls: { allowed: true, used: 0, max: 10 },
        toolCalls: { allowed: true, used: 0, max: 50 },
      });
    });
  });

  describe('calculateSubcallBudget', () => {
    it('should allocate fraction of remaining budget', () => {
      const parentState: BudgetState = {
        tokensUsed: 30000,
        timeElapsedMs: 100000,
        retriesUsed: 0,
        subcallsUsed: 2,
        toolCallsUsed: 10,
      };

      const subcallBudget = checker.calculateSubcallBudget(
        fullBudget,
        parentState,
        { fraction: 0.5 }
      );

      // Half of remaining tokens: (100000 - 30000) * 0.5 = 35000
      expect(subcallBudget.maxTokens).toBe(35000);
      // Half of remaining time: (300000 - 100000) * 0.5 = 100000
      expect(subcallBudget.maxTimeMs).toBe(100000);
      // Subcalls decremented
      expect(subcallBudget.maxSubcalls).toBeLessThan(fullBudget.maxSubcalls!);
    });

    it('should respect minimum allocations', () => {
      const parentState: BudgetState = {
        tokensUsed: 99000, // Almost exhausted
        timeElapsedMs: 290000,
        retriesUsed: 0,
        subcallsUsed: 0,
        toolCallsUsed: 0,
      };

      const subcallBudget = checker.calculateSubcallBudget(
        fullBudget,
        parentState,
        { fraction: 0.5, minTokens: 5000, minTimeMs: 30000 }
      );

      expect(subcallBudget.maxTokens).toBe(5000);
      expect(subcallBudget.maxTimeMs).toBe(30000);
    });
  });
});
```

#### 1.2 Create Budget Tracker Tests

**File:** `packages/runner/src/budget/__tests__/budget-tracker.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createBudgetTracker, BudgetTracker } from '../budget-tracker';
import { EpisodeBudget, BudgetState } from '../../episode/types';

describe('BudgetTracker', () => {
  let tracker: BudgetTracker;

  const budget: EpisodeBudget = {
    maxTokens: 100000,
    maxTimeMs: 300000,
    maxRetries: 3,
    maxSubcalls: 10,
    maxToolCalls: 50,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = createBudgetTracker({
      episodeId: 'ep_test',
      budget,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    tracker.stop();
  });

  describe('recordTokens', () => {
    it('should accumulate token usage', () => {
      tracker.recordTokens(1000);
      tracker.recordTokens(2000);

      expect(tracker.getState().tokensUsed).toBe(3000);
    });

    it('should separate input and output tokens', () => {
      tracker.recordTokens(1000, { type: 'input' });
      tracker.recordTokens(500, { type: 'output' });

      const state = tracker.getState();
      expect(state.tokensUsed).toBe(1500);
      // Could track breakdown in metadata
    });

    it('should emit warning at 80% usage', () => {
      const onWarning = vi.fn();
      tracker.on('warning', onWarning);

      tracker.recordTokens(80000);

      expect(onWarning).toHaveBeenCalledWith({
        type: 'tokens',
        used: 80000,
        max: 100000,
        percentage: 80,
      });
    });

    it('should emit exceeded event at limit', () => {
      const onExceeded = vi.fn();
      tracker.on('exceeded', onExceeded);

      tracker.recordTokens(100001);

      expect(onExceeded).toHaveBeenCalledWith({
        type: 'tokens',
        used: 100001,
        max: 100000,
        exceededBy: 1,
      });
    });
  });

  describe('time tracking', () => {
    it('should track elapsed time', () => {
      tracker.start();
      vi.advanceTimersByTime(5000);

      expect(tracker.getState().timeElapsedMs).toBeGreaterThanOrEqual(5000);
    });

    it('should pause and resume time tracking', () => {
      tracker.start();
      vi.advanceTimersByTime(5000);

      tracker.pause();
      const pausedTime = tracker.getState().timeElapsedMs;

      vi.advanceTimersByTime(10000);
      expect(tracker.getState().timeElapsedMs).toBe(pausedTime);

      tracker.resume();
      vi.advanceTimersByTime(5000);
      expect(tracker.getState().timeElapsedMs).toBeGreaterThan(pausedTime);
    });

    it('should emit warning at 80% time usage', () => {
      const onWarning = vi.fn();
      tracker.on('warning', onWarning);

      tracker.start();
      vi.advanceTimersByTime(240000); // 80% of 300000

      expect(onWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'time',
          percentage: expect.any(Number),
        })
      );
    });

    it('should emit exceeded event when time exhausted', () => {
      const onExceeded = vi.fn();
      tracker.on('exceeded', onExceeded);

      tracker.start();
      vi.advanceTimersByTime(300001);

      expect(onExceeded).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'time',
          exceededBy: expect.any(Number),
        })
      );
    });
  });

  describe('recordSubcall', () => {
    it('should increment subcall count', () => {
      tracker.recordSubcall('ep_child_1');
      tracker.recordSubcall('ep_child_2');

      expect(tracker.getState().subcallsUsed).toBe(2);
    });

    it('should track child episode IDs', () => {
      tracker.recordSubcall('ep_child_1');
      tracker.recordSubcall('ep_child_2');

      expect(tracker.getChildEpisodes()).toEqual(['ep_child_1', 'ep_child_2']);
    });
  });

  describe('recordToolCall', () => {
    it('should increment tool call count', () => {
      tracker.recordToolCall('tool_read');
      tracker.recordToolCall('tool_write');
      tracker.recordToolCall('tool_read');

      expect(tracker.getState().toolCallsUsed).toBe(3);
    });

    it('should track by tool name', () => {
      tracker.recordToolCall('tool_read');
      tracker.recordToolCall('tool_read');
      tracker.recordToolCall('tool_write');

      expect(tracker.getToolCallCounts()).toEqual({
        tool_read: 2,
        tool_write: 1,
      });
    });
  });

  describe('checkBefore', () => {
    it('should allow operation when budget available', () => {
      const result = tracker.checkBefore({
        tokens: 50000,
        toolCalls: 10,
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny operation when budget would be exceeded', () => {
      tracker.recordTokens(60000);

      const result = tracker.checkBefore({
        tokens: 50000,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toContain('tokens');
    });
  });

  describe('snapshot', () => {
    it('should create immutable snapshot', () => {
      tracker.recordTokens(10000);
      const snapshot1 = tracker.snapshot();

      tracker.recordTokens(5000);
      const snapshot2 = tracker.snapshot();

      expect(snapshot1.tokensUsed).toBe(10000);
      expect(snapshot2.tokensUsed).toBe(15000);
    });
  });
});
```

#### 1.3 Create Budget Guard Tests

**File:** `packages/runner/src/budget/__tests__/budget-guard.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBudgetGuard, BudgetGuard } from '../budget-guard';
import { createMockBudgetTracker } from '@rtv/testing';

describe('BudgetGuard', () => {
  let guard: BudgetGuard;
  let mockTracker: ReturnType<typeof createMockBudgetTracker>;

  beforeEach(() => {
    mockTracker = createMockBudgetTracker();
    guard = createBudgetGuard({
      tracker: mockTracker,
      onExceeded: vi.fn(),
    });
  });

  describe('withBudgetCheck', () => {
    it('should execute function when budget available', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });

      const result = await guard.withBudgetCheck(
        { tokens: 1000 },
        async () => 'success'
      );

      expect(result).toBe('success');
    });

    it('should throw BudgetExceededError when budget insufficient', async () => {
      mockTracker.checkBefore.mockReturnValue({
        allowed: false,
        violations: ['tokens'],
        details: { tokens: { wouldExceedBy: 5000 } },
      });

      await expect(
        guard.withBudgetCheck(
          { tokens: 50000 },
          async () => 'success'
        )
      ).rejects.toThrow('Budget exceeded: tokens');
    });

    it('should record actual usage after execution', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });

      await guard.withBudgetCheck(
        { tokens: 1000 },
        async () => 'success',
        { actualTokens: 1234 }
      );

      expect(mockTracker.recordTokens).toHaveBeenCalledWith(1234);
    });
  });

  describe('guardLLMCall', () => {
    it('should check and record token usage', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });

      const mockLLMCall = vi.fn().mockResolvedValue({
        content: 'response',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await guard.guardLLMCall(mockLLMCall, {
        estimatedTokens: 200,
      });

      expect(result.content).toBe('response');
      expect(mockTracker.recordTokens).toHaveBeenCalledWith(150);
    });

    it('should throw if estimated tokens exceed budget', async () => {
      mockTracker.checkBefore.mockReturnValue({
        allowed: false,
        violations: ['tokens'],
      });

      const mockLLMCall = vi.fn();

      await expect(
        guard.guardLLMCall(mockLLMCall, { estimatedTokens: 500000 })
      ).rejects.toThrow();

      expect(mockLLMCall).not.toHaveBeenCalled();
    });
  });

  describe('guardToolCall', () => {
    it('should check and record tool call', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });

      const mockTool = vi.fn().mockResolvedValue({ data: 'result' });

      const result = await guard.guardToolCall('my_tool', mockTool);

      expect(result).toEqual({ data: 'result' });
      expect(mockTracker.recordToolCall).toHaveBeenCalledWith('my_tool');
    });

    it('should throw if tool call budget exceeded', async () => {
      mockTracker.checkBefore.mockReturnValue({
        allowed: false,
        violations: ['toolCalls'],
      });

      const mockTool = vi.fn();

      await expect(
        guard.guardToolCall('my_tool', mockTool)
      ).rejects.toThrow('Budget exceeded: toolCalls');
    });
  });

  describe('guardSubcall', () => {
    it('should allocate budget for subcall', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });
      mockTracker.getState.mockReturnValue({
        tokensUsed: 10000,
        timeElapsedMs: 50000,
        subcallsUsed: 2,
        toolCallsUsed: 5,
        retriesUsed: 0,
      });

      const subcallBudget = await guard.allocateSubcallBudget({
        fraction: 0.3,
      });

      expect(subcallBudget.maxTokens).toBeDefined();
      expect(mockTracker.recordSubcall).toHaveBeenCalled();
    });

    it('should reject if subcall limit reached', async () => {
      mockTracker.checkBefore.mockReturnValue({
        allowed: false,
        violations: ['subcalls'],
      });

      await expect(
        guard.allocateSubcallBudget({ fraction: 0.3 })
      ).rejects.toThrow('Budget exceeded: subcalls');
    });
  });
});
```

#### 1.4 Run Tests (Expect Failures)

```bash
cd packages/runner
pnpm test:watch src/budget/
```

---

### Phase 2: Implementation

#### 2.1 Create Budget Checker

**File:** `packages/runner/src/budget/budget-checker.ts`

```typescript
import { EpisodeBudget, BudgetState } from '../episode/types';

export interface BudgetCheckResult {
  allowed: boolean;
  remaining: number;
  used: number;
  max: number | null;
  wouldExceedBy?: number;
  exceededBy?: number;
  deadline?: number;
}

export interface BudgetCheckAllResult {
  allowed: boolean;
  violations: string[];
  details: {
    tokens: BudgetCheckResult;
    time: BudgetCheckResult;
    retries: BudgetCheckResult;
    subcalls: BudgetCheckResult;
    toolCalls: BudgetCheckResult;
  };
}

export interface SubcallBudgetOptions {
  fraction: number;
  minTokens?: number;
  minTimeMs?: number;
  minToolCalls?: number;
}

export interface BudgetChecker {
  checkTokenBudget(budget: EpisodeBudget, state: BudgetState, requestedTokens?: number): BudgetCheckResult;
  checkTimeBudget(budget: EpisodeBudget, state: BudgetState, startTime?: number): BudgetCheckResult;
  checkRetryBudget(budget: EpisodeBudget, state: BudgetState): BudgetCheckResult;
  checkSubcallBudget(budget: EpisodeBudget, state: BudgetState): BudgetCheckResult;
  checkToolCallBudget(budget: EpisodeBudget, state: BudgetState, requestedCalls?: number): BudgetCheckResult;
  checkAll(budget: EpisodeBudget, state: BudgetState): BudgetCheckAllResult;
  calculateSubcallBudget(budget: EpisodeBudget, state: BudgetState, options: SubcallBudgetOptions): EpisodeBudget;
}

export function createBudgetChecker(): BudgetChecker {
  return {
    checkTokenBudget(budget: EpisodeBudget, state: BudgetState, requestedTokens = 0): BudgetCheckResult {
      const max = budget.maxTokens ?? null;
      const used = state.tokensUsed;

      if (max === null) {
        return {
          allowed: true,
          remaining: Infinity,
          used,
          max: null,
        };
      }

      const remaining = max - used;
      const wouldUse = used + requestedTokens;
      const allowed = wouldUse <= max;

      return {
        allowed,
        remaining: allowed ? max - wouldUse : 0,
        used,
        max,
        wouldExceedBy: allowed ? undefined : wouldUse - max,
      };
    },

    checkTimeBudget(budget: EpisodeBudget, state: BudgetState, startTime?: number): BudgetCheckResult {
      const max = budget.maxTimeMs ?? null;
      const used = state.timeElapsedMs;

      if (max === null) {
        return {
          allowed: true,
          remaining: Infinity,
          used,
          max: null,
        };
      }

      const remaining = max - used;
      const allowed = used < max;

      const result: BudgetCheckResult = {
        allowed,
        remaining: Math.max(0, remaining),
        used,
        max,
      };

      if (!allowed) {
        result.exceededBy = used - max;
      }

      if (startTime) {
        result.deadline = startTime + max;
      }

      return result;
    },

    checkRetryBudget(budget: EpisodeBudget, state: BudgetState): BudgetCheckResult {
      const max = budget.maxRetries ?? null;
      const used = state.retriesUsed;

      if (max === null) {
        return {
          allowed: true,
          remaining: Infinity,
          used,
          max: null,
        };
      }

      const remaining = max - used;
      const allowed = used < max;

      return {
        allowed,
        remaining: Math.max(0, remaining),
        used,
        max,
      };
    },

    checkSubcallBudget(budget: EpisodeBudget, state: BudgetState): BudgetCheckResult {
      const max = budget.maxSubcalls ?? null;
      const used = state.subcallsUsed;

      if (max === null) {
        return {
          allowed: true,
          remaining: Infinity,
          used,
          max: null,
        };
      }

      const remaining = max - used;
      const allowed = used < max;

      return {
        allowed,
        remaining: Math.max(0, remaining),
        used,
        max,
      };
    },

    checkToolCallBudget(budget: EpisodeBudget, state: BudgetState, requestedCalls = 1): BudgetCheckResult {
      const max = budget.maxToolCalls ?? null;
      const used = state.toolCallsUsed;

      if (max === null) {
        return {
          allowed: true,
          remaining: Infinity,
          used,
          max: null,
        };
      }

      const remaining = max - used;
      const wouldUse = used + requestedCalls;
      const allowed = wouldUse <= max;

      return {
        allowed,
        remaining: allowed ? max - wouldUse : 0,
        used,
        max,
        wouldExceedBy: allowed ? undefined : wouldUse - max,
      };
    },

    checkAll(budget: EpisodeBudget, state: BudgetState): BudgetCheckAllResult {
      const tokens = this.checkTokenBudget(budget, state);
      const time = this.checkTimeBudget(budget, state);
      const retries = this.checkRetryBudget(budget, state);
      const subcalls = this.checkSubcallBudget(budget, state);
      const toolCalls = this.checkToolCallBudget(budget, state);

      const violations: string[] = [];
      if (!tokens.allowed) violations.push('tokens');
      if (!time.allowed) violations.push('time');
      if (!retries.allowed) violations.push('retries');
      if (!subcalls.allowed) violations.push('subcalls');
      if (!toolCalls.allowed) violations.push('toolCalls');

      return {
        allowed: violations.length === 0,
        violations,
        details: {
          tokens,
          time,
          retries,
          subcalls,
          toolCalls,
        },
      };
    },

    calculateSubcallBudget(
      budget: EpisodeBudget,
      state: BudgetState,
      options: SubcallBudgetOptions
    ): EpisodeBudget {
      const { fraction, minTokens = 1000, minTimeMs = 10000, minToolCalls = 5 } = options;

      const remainingTokens = (budget.maxTokens ?? Infinity) - state.tokensUsed;
      const remainingTime = (budget.maxTimeMs ?? Infinity) - state.timeElapsedMs;
      const remainingSubcalls = (budget.maxSubcalls ?? Infinity) - state.subcallsUsed - 1;
      const remainingToolCalls = (budget.maxToolCalls ?? Infinity) - state.toolCallsUsed;

      return {
        maxTokens: budget.maxTokens
          ? Math.max(minTokens, Math.floor(remainingTokens * fraction))
          : undefined,
        maxTimeMs: budget.maxTimeMs
          ? Math.max(minTimeMs, Math.floor(remainingTime * fraction))
          : undefined,
        maxRetries: budget.maxRetries, // Retries don't cascade
        maxSubcalls: budget.maxSubcalls
          ? Math.max(0, Math.floor(remainingSubcalls * fraction))
          : undefined,
        maxToolCalls: budget.maxToolCalls
          ? Math.max(minToolCalls, Math.floor(remainingToolCalls * fraction))
          : undefined,
      };
    },
  };
}
```

#### 2.2 Create Budget Tracker

**File:** `packages/runner/src/budget/budget-tracker.ts`

```typescript
import { EventEmitter } from 'events';
import { EpisodeBudget, BudgetState } from '../episode/types';
import { createBudgetChecker, BudgetChecker, BudgetCheckAllResult } from './budget-checker';

interface BudgetTrackerOptions {
  episodeId: string;
  budget: EpisodeBudget;
  initialState?: BudgetState;
  warningThreshold?: number; // Default 0.8 (80%)
  checkIntervalMs?: number; // Default 1000
}

interface TokenRecordOptions {
  type?: 'input' | 'output' | 'total';
  model?: string;
}

interface BudgetWarningEvent {
  type: 'tokens' | 'time' | 'subcalls' | 'toolCalls';
  used: number;
  max: number;
  percentage: number;
}

interface BudgetExceededEvent {
  type: 'tokens' | 'time' | 'subcalls' | 'toolCalls';
  used: number;
  max: number;
  exceededBy: number;
}

interface BudgetCheckRequest {
  tokens?: number;
  toolCalls?: number;
  subcalls?: number;
}

export interface BudgetTracker extends EventEmitter {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  recordTokens(count: number, options?: TokenRecordOptions): void;
  recordSubcall(childEpisodeId: string): void;
  recordToolCall(toolName: string): void;
  getState(): BudgetState;
  snapshot(): BudgetState;
  checkBefore(request: BudgetCheckRequest): BudgetCheckAllResult;
  getChildEpisodes(): string[];
  getToolCallCounts(): Record<string, number>;
  getBudget(): EpisodeBudget;
}

export function createBudgetTracker(options: BudgetTrackerOptions): BudgetTracker {
  const {
    episodeId,
    budget,
    initialState,
    warningThreshold = 0.8,
    checkIntervalMs = 1000,
  } = options;

  const emitter = new EventEmitter();
  const checker: BudgetChecker = createBudgetChecker();

  // Mutable state
  let state: BudgetState = initialState || {
    tokensUsed: 0,
    timeElapsedMs: 0,
    retriesUsed: 0,
    subcallsUsed: 0,
    toolCallsUsed: 0,
  };

  // Time tracking
  let startTime: number | null = null;
  let pausedTime: number | null = null;
  let accumulatedTime = state.timeElapsedMs;
  let timeCheckInterval: NodeJS.Timeout | null = null;

  // Tracking details
  const childEpisodes: string[] = [];
  const toolCallCounts: Record<string, number> = {};
  const warningsEmitted = new Set<string>();

  /**
   * Check and emit warnings/exceeded events for a budget type
   */
  function checkAndEmit(type: 'tokens' | 'time' | 'subcalls' | 'toolCalls') {
    let used: number;
    let max: number | undefined;

    switch (type) {
      case 'tokens':
        used = state.tokensUsed;
        max = budget.maxTokens;
        break;
      case 'time':
        used = state.timeElapsedMs;
        max = budget.maxTimeMs;
        break;
      case 'subcalls':
        used = state.subcallsUsed;
        max = budget.maxSubcalls;
        break;
      case 'toolCalls':
        used = state.toolCallsUsed;
        max = budget.maxToolCalls;
        break;
    }

    if (max === undefined) return;

    const percentage = used / max;
    const warningKey = `${type}:warning`;

    // Check for warning threshold
    if (percentage >= warningThreshold && !warningsEmitted.has(warningKey)) {
      warningsEmitted.add(warningKey);
      emitter.emit('warning', {
        type,
        used,
        max,
        percentage: Math.round(percentage * 100),
      } as BudgetWarningEvent);
    }

    // Check for exceeded
    if (used > max) {
      emitter.emit('exceeded', {
        type,
        used,
        max,
        exceededBy: used - max,
      } as BudgetExceededEvent);
    }
  }

  /**
   * Update time elapsed from wall clock
   */
  function updateTimeElapsed() {
    if (startTime !== null && pausedTime === null) {
      state.timeElapsedMs = accumulatedTime + (Date.now() - startTime);
      checkAndEmit('time');
    }
  }

  const tracker: BudgetTracker = Object.assign(emitter, {
    start() {
      if (startTime !== null) return;
      startTime = Date.now();
      pausedTime = null;

      // Start periodic time checks
      timeCheckInterval = setInterval(() => {
        updateTimeElapsed();
      }, checkIntervalMs);
    },

    stop() {
      if (timeCheckInterval) {
        clearInterval(timeCheckInterval);
        timeCheckInterval = null;
      }
      updateTimeElapsed();
      startTime = null;
      pausedTime = null;
    },

    pause() {
      if (startTime === null || pausedTime !== null) return;
      updateTimeElapsed();
      accumulatedTime = state.timeElapsedMs;
      pausedTime = Date.now();
    },

    resume() {
      if (pausedTime === null) return;
      startTime = Date.now();
      pausedTime = null;
    },

    recordTokens(count: number, _options?: TokenRecordOptions) {
      state.tokensUsed += count;
      checkAndEmit('tokens');
    },

    recordSubcall(childEpisodeId: string) {
      state.subcallsUsed += 1;
      childEpisodes.push(childEpisodeId);
      checkAndEmit('subcalls');
    },

    recordToolCall(toolName: string) {
      state.toolCallsUsed += 1;
      toolCallCounts[toolName] = (toolCallCounts[toolName] || 0) + 1;
      checkAndEmit('toolCalls');
    },

    getState(): BudgetState {
      updateTimeElapsed();
      return { ...state };
    },

    snapshot(): BudgetState {
      updateTimeElapsed();
      return {
        tokensUsed: state.tokensUsed,
        timeElapsedMs: state.timeElapsedMs,
        retriesUsed: state.retriesUsed,
        subcallsUsed: state.subcallsUsed,
        toolCallsUsed: state.toolCallsUsed,
      };
    },

    checkBefore(request: BudgetCheckRequest): BudgetCheckAllResult {
      updateTimeElapsed();

      // Create a hypothetical state
      const hypotheticalState: BudgetState = {
        tokensUsed: state.tokensUsed + (request.tokens || 0),
        timeElapsedMs: state.timeElapsedMs,
        retriesUsed: state.retriesUsed,
        subcallsUsed: state.subcallsUsed + (request.subcalls || 0),
        toolCallsUsed: state.toolCallsUsed + (request.toolCalls || 0),
      };

      return checker.checkAll(budget, hypotheticalState);
    },

    getChildEpisodes(): string[] {
      return [...childEpisodes];
    },

    getToolCallCounts(): Record<string, number> {
      return { ...toolCallCounts };
    },

    getBudget(): EpisodeBudget {
      return { ...budget };
    },
  });

  return tracker;
}
```

#### 2.3 Create Budget Guard

**File:** `packages/runner/src/budget/budget-guard.ts`

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { BudgetTracker } from './budget-tracker';
import { createBudgetChecker, SubcallBudgetOptions } from './budget-checker';
import { EpisodeBudget } from '../episode/types';

const tracer = trace.getTracer('budget-guard');

/**
 * Error thrown when budget is exceeded
 */
export class BudgetExceededError extends Error {
  constructor(
    public readonly violations: string[],
    public readonly details: Record<string, unknown>
  ) {
    super(`Budget exceeded: ${violations.join(', ')}`);
    this.name = 'BudgetExceededError';
  }
}

interface BudgetGuardOptions {
  tracker: BudgetTracker;
  onExceeded?: (error: BudgetExceededError) => void;
}

interface BudgetRequest {
  tokens?: number;
  toolCalls?: number;
  subcalls?: number;
}

interface ExecuteOptions {
  actualTokens?: number;
}

interface LLMCallOptions {
  estimatedTokens: number;
  model?: string;
}

interface LLMResponse {
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface BudgetGuard {
  /**
   * Execute a function with budget check
   */
  withBudgetCheck<T>(
    request: BudgetRequest,
    fn: () => Promise<T>,
    options?: ExecuteOptions
  ): Promise<T>;

  /**
   * Guard an LLM call
   */
  guardLLMCall<T extends LLMResponse>(
    fn: () => Promise<T>,
    options: LLMCallOptions
  ): Promise<T>;

  /**
   * Guard a tool call
   */
  guardToolCall<T>(
    toolName: string,
    fn: () => Promise<T>
  ): Promise<T>;

  /**
   * Allocate budget for a subcall
   */
  allocateSubcallBudget(options: SubcallBudgetOptions): Promise<EpisodeBudget>;

  /**
   * Get remaining budget
   */
  getRemainingBudget(): {
    tokens: number;
    timeMs: number;
    toolCalls: number;
    subcalls: number;
  };
}

export function createBudgetGuard(options: BudgetGuardOptions): BudgetGuard {
  const { tracker, onExceeded } = options;
  const checker = createBudgetChecker();

  /**
   * Check budget and throw if insufficient
   */
  function assertBudget(request: BudgetRequest): void {
    const result = tracker.checkBefore(request);

    if (!result.allowed) {
      const error = new BudgetExceededError(result.violations, result.details);
      onExceeded?.(error);
      throw error;
    }
  }

  return {
    async withBudgetCheck<T>(
      request: BudgetRequest,
      fn: () => Promise<T>,
      execOptions?: ExecuteOptions
    ): Promise<T> {
      return tracer.startActiveSpan('budget.guard.withCheck', async (span) => {
        try {
          // Pre-check
          assertBudget(request);

          // Execute
          const result = await fn();

          // Record actual usage
          if (execOptions?.actualTokens !== undefined) {
            tracker.recordTokens(execOptions.actualTokens);
          } else if (request.tokens) {
            tracker.recordTokens(request.tokens);
          }

          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
          throw error;
        } finally {
          span.end();
        }
      });
    },

    async guardLLMCall<T extends LLMResponse>(
      fn: () => Promise<T>,
      llmOptions: LLMCallOptions
    ): Promise<T> {
      return tracer.startActiveSpan('budget.guard.llm', async (span) => {
        span.setAttribute('llm.estimated_tokens', llmOptions.estimatedTokens);

        try {
          // Pre-check with estimated tokens
          assertBudget({ tokens: llmOptions.estimatedTokens });

          // Execute LLM call
          const response = await fn();

          // Record actual token usage
          const actualTokens = response.usage
            ? response.usage.input_tokens + response.usage.output_tokens
            : llmOptions.estimatedTokens;

          tracker.recordTokens(actualTokens, {
            type: 'total',
            model: llmOptions.model,
          });

          span.setAttribute('llm.actual_tokens', actualTokens);
          span.setStatus({ code: SpanStatusCode.OK });

          return response;
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
          throw error;
        } finally {
          span.end();
        }
      });
    },

    async guardToolCall<T>(
      toolName: string,
      fn: () => Promise<T>
    ): Promise<T> {
      return tracer.startActiveSpan('budget.guard.tool', async (span) => {
        span.setAttribute('tool.name', toolName);

        try {
          // Pre-check
          assertBudget({ toolCalls: 1 });

          // Execute tool
          const result = await fn();

          // Record
          tracker.recordToolCall(toolName);

          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
          throw error;
        } finally {
          span.end();
        }
      });
    },

    async allocateSubcallBudget(subcallOptions: SubcallBudgetOptions): Promise<EpisodeBudget> {
      return tracer.startActiveSpan('budget.guard.allocateSubcall', async (span) => {
        span.setAttribute('subcall.fraction', subcallOptions.fraction);

        try {
          // Check if we can create a subcall
          assertBudget({ subcalls: 1 });

          const parentBudget = tracker.getBudget();
          const parentState = tracker.getState();

          // Calculate child budget
          const childBudget = checker.calculateSubcallBudget(
            parentBudget,
            parentState,
            subcallOptions
          );

          // Record the subcall allocation (ID will be set when child starts)
          tracker.recordSubcall('pending');

          span.setStatus({ code: SpanStatusCode.OK });
          return childBudget;
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
          throw error;
        } finally {
          span.end();
        }
      });
    },

    getRemainingBudget(): {
      tokens: number;
      timeMs: number;
      toolCalls: number;
      subcalls: number;
    } {
      const budget = tracker.getBudget();
      const state = tracker.getState();

      return {
        tokens: (budget.maxTokens ?? Infinity) - state.tokensUsed,
        timeMs: (budget.maxTimeMs ?? Infinity) - state.timeElapsedMs,
        toolCalls: (budget.maxToolCalls ?? Infinity) - state.toolCallsUsed,
        subcalls: (budget.maxSubcalls ?? Infinity) - state.subcallsUsed,
      };
    },
  };
}
```

#### 2.4 Create Module Index

**File:** `packages/runner/src/budget/index.ts`

```typescript
export * from './budget-checker';
export * from './budget-tracker';
export * from './budget-guard';
```

---

### Phase 3: Verification

#### 3.1 Run Tests

```bash
# Run all budget tests
cd packages/runner
pnpm test src/budget/

# Run with coverage
pnpm test:coverage src/budget/
```

#### 3.2 Type Check

```bash
pnpm typecheck
```

#### 3.3 Lint

```bash
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/runner/src/budget/budget-checker.ts` | Budget checking logic |
| Create | `packages/runner/src/budget/budget-tracker.ts` | Real-time tracking |
| Create | `packages/runner/src/budget/budget-guard.ts` | Execution guard |
| Create | `packages/runner/src/budget/index.ts` | Module exports |
| Create | `packages/runner/src/budget/__tests__/budget-checker.test.ts` | Checker tests |
| Create | `packages/runner/src/budget/__tests__/budget-tracker.test.ts` | Tracker tests |
| Create | `packages/runner/src/budget/__tests__/budget-guard.test.ts` | Guard tests |

---

## Acceptance Criteria

- [ ] Token budget checking with remaining calculation
- [ ] Time budget tracking with deadline support
- [ ] Subcall budget allocation with fraction
- [ ] Tool call budget enforcement
- [ ] Warning events at 80% threshold
- [ ] Exceeded events when limits hit
- [ ] Guard functions prevent exceeding operations
- [ ] BudgetExceededError with violation details
- [ ] Snapshot creation for checkpointing
- [ ] All tests pass with >80% coverage
- [ ] TypeScript compiles with no errors

---

## Test Requirements

### Unit Tests

- Each budget type check
- Threshold calculations
- Warning/exceeded event emission
- Subcall budget allocation

### Integration Tests

- Combined multi-budget checking
- Guard with actual operations
- Time tracking accuracy

### Performance Tests

- Check operations <1ms
- No memory leaks in tracking

---

## Security & Safety Checklist

- [ ] Budgets cannot be negative
- [ ] No bypass for budget checks
- [ ] Event emission doesn't block
- [ ] State immutability in snapshots

---

## JSON Task Block

```json
{
  "task_id": "S1-D2",
  "name": "Budget Enforcement",
  "status": "pending",
  "complexity": "medium",
  "sprint": 1,
  "agent": "D",
  "dependencies": ["S1-D1"],
  "blocks": ["S1-D3", "S1-D4", "S1-D5", "S2-A1"],
  "estimated_hours": 5,
  "actual_hours": null,
  "files": [
    "packages/runner/src/budget/budget-checker.ts",
    "packages/runner/src/budget/budget-tracker.ts",
    "packages/runner/src/budget/budget-guard.ts",
    "packages/runner/src/budget/index.ts"
  ],
  "test_files": [
    "packages/runner/src/budget/__tests__/budget-checker.test.ts",
    "packages/runner/src/budget/__tests__/budget-tracker.test.ts",
    "packages/runner/src/budget/__tests__/budget-guard.test.ts"
  ],
  "acceptance_criteria": [
    "Multi-type budget checking",
    "Real-time usage tracking",
    "Warning and exceeded events",
    "Guard functions for operations",
    "Subcall budget allocation"
  ]
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "artifacts": {
    "files_created": [],
    "tests_passed": null,
    "coverage_percent": null
  },
  "learnings": [],
  "blockers_encountered": []
}
```
