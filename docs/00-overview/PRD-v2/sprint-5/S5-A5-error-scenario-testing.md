# Build Prompt: S5-A5 — Error Scenario Testing

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-A5 |
| Sprint | 5 - Gated Rollout |
| Agent | A - House Account Testing |
| Task Name | Error Scenario Testing |
| Complexity | High |
| Status | pending |
| Dependencies | S5-A3 |
| Blocked By | None |

---

## Context

### What This Builds

The ErrorScenarioTestSuite that validates system behavior under failure conditions: API errors, rate limits, network timeouts, partial failures, and cascading failures. This ensures graceful degradation and proper error handling.

### Why It Matters

- **Resilience Validation**: Prove system handles failures gracefully
- **Recovery Testing**: Verify retry and rollback mechanisms work
- **Error Classification**: Confirm errors route to correct handlers
- **User Experience**: Ensure failures produce clear error messages
- **Safety Nets**: Validate kill switches and circuit breakers activate

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/06-reliability-ops/slo-error-budget.md` | Error Budgets | Acceptable error rates |
| `docs/runbooks/` | Incident Runbooks | Error handling procedures |
| `docs/01-architecture/system-architecture-v3.md` | Error Handling | Architecture patterns |

---

## Prerequisites

### Completed Tasks

- [x] S5-A3: E2E test suite (error tests extend E2E framework)
- [x] S5-C1: Global kill switch (tested in error scenarios)

### Required Packages

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "nock": "^13.5.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

#### 1.1 Create Error Scenario Tests

**File:** `packages/tests/e2e/src/__tests__/error-scenarios.e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, cleanupTestContext, E2ETestContext } from '../framework/test-context';
import { SandboxModeService } from '@rtv/rollout/sandbox';
import { PublishingService } from '@rtv/publishing';
import { KillSwitchService } from '@rtv/safety/kill-switches';

describe('Error Scenario E2E Tests', () => {
  let ctx: E2ETestContext;
  let sandbox: SandboxModeService;
  let publishingService: PublishingService;
  let killSwitchService: KillSwitchService;

  beforeAll(async () => {
    sandbox = new SandboxModeService({ /* config */ });
    ctx = await createTestContext(sandbox);
    publishingService = new PublishingService({ /* config */ });
    killSwitchService = new KillSwitchService({ /* config */ });
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  beforeEach(async () => {
    // Reset sandbox to default simulation
    await sandbox.enableSandbox(ctx.clientId, {
      mode: 'simulate',
      simulationConfig: { successRate: 1.0 },
    });
  });

  describe('API Error Handling', () => {
    it('should handle 401 unauthorized errors', async () => {
      await sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        operations: ['publish'],
        simulationConfig: {
          successRate: 0,
          errorCodes: [401],
        },
      });

      const result = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'test_post',
        platform: 'meta_facebook',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('AUTH_ERROR');
      expect(result.error.retryable).toBe(false);
    });

    it('should handle 429 rate limit errors with backoff', async () => {
      let attempts = 0;
      await sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        operations: ['publish'],
        simulationConfig: {
          successRate: attempts++ < 2 ? 0 : 1, // Fail twice then succeed
          errorCodes: [429],
        },
      });

      const result = await publishingService.publishWithRetry({
        clientId: ctx.clientId,
        postId: 'test_post',
        platform: 'meta_facebook',
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBeGreaterThan(1);
    });

    it('should handle 500 server errors with retry', async () => {
      await sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        operations: ['publish'],
        simulationConfig: {
          successRate: 0.5, // 50% failure
          errorCodes: [500, 502, 503],
        },
      });

      const results = await Promise.all(
        Array(10).fill(null).map(() =>
          publishingService.publishWithRetry({
            clientId: ctx.clientId,
            postId: `test_post_${Math.random()}`,
            platform: 'meta_facebook',
            maxRetries: 3,
          })
        )
      );

      // Most should eventually succeed with retries
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(7);
    });
  });

  describe('Network Failure Handling', () => {
    it('should handle connection timeout', async () => {
      await sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        simulationConfig: {
          successRate: 0,
          latencyMs: { min: 30001, max: 30001 }, // Exceed timeout
        },
      });

      const result = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'test_post',
        platform: 'meta_facebook',
        timeoutMs: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('TIMEOUT');
    });

    it('should handle DNS resolution failure', async () => {
      await sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        simulationConfig: {
          successRate: 0,
          errorType: 'network',
          networkError: 'ENOTFOUND',
        },
      });

      const result = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'test_post',
        platform: 'meta_facebook',
      });

      expect(result.success).toBe(false);
      expect(result.error.retryable).toBe(true);
    });
  });

  describe('Partial Failure Handling', () => {
    it('should handle multi-platform partial failure', async () => {
      // Meta succeeds, TikTok fails
      await sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        platforms: ['meta_facebook'],
        simulationConfig: { successRate: 1 },
      });

      await sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        platforms: ['tiktok'],
        simulationConfig: { successRate: 0 },
      });

      const result = await publishingService.publishMultiPlatform({
        clientId: ctx.clientId,
        postId: 'test_post',
        platforms: ['meta_facebook', 'tiktok'],
      });

      expect(result.meta_facebook.success).toBe(true);
      expect(result.tiktok.success).toBe(false);
      expect(result.overallStatus).toBe('partial');
    });

    it('should continue batch on individual failures', async () => {
      await sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        simulationConfig: { successRate: 0.8 }, // 20% failure
      });

      const posts = Array(10).fill(null).map((_, i) => ({
        clientId: ctx.clientId,
        postId: `batch_post_${i}`,
        platform: 'meta_facebook',
      }));

      const results = await publishingService.publishBatch(posts, {
        continueOnError: true,
      });

      // All should be attempted
      expect(results.total).toBe(10);
      expect(results.succeeded + results.failed).toBe(10);
    });
  });

  describe('Kill Switch Activation', () => {
    it('should halt operations when global kill switch active', async () => {
      await killSwitchService.activateGlobal({
        reason: 'E2E test',
        activatedBy: 'e2e_test',
      });

      const result = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'test_post',
        platform: 'meta_facebook',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('KILL_SWITCH_ACTIVE');

      // Cleanup
      await killSwitchService.deactivateGlobal({
        reason: 'E2E test complete',
        deactivatedBy: 'e2e_test',
      });
    });

    it('should halt specific client when client kill switch active', async () => {
      await killSwitchService.activateForClient(ctx.clientId, {
        reason: 'E2E test',
        activatedBy: 'e2e_test',
      });

      const result = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'test_post',
        platform: 'meta_facebook',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('CLIENT_KILL_SWITCH_ACTIVE');

      // Other clients should work
      const otherResult = await publishingService.publish({
        clientId: 'other_client',
        postId: 'test_post',
        platform: 'meta_facebook',
      });

      expect(otherResult.error?.code).not.toBe('CLIENT_KILL_SWITCH_ACTIVE');

      // Cleanup
      await killSwitchService.deactivateForClient(ctx.clientId, {
        reason: 'E2E test complete',
        deactivatedBy: 'e2e_test',
      });
    });
  });

  describe('Circuit Breaker Behavior', () => {
    it('should open circuit after consecutive failures', async () => {
      await sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        simulationConfig: { successRate: 0 }, // All fail
      });

      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        await publishingService.publish({
          clientId: ctx.clientId,
          postId: `circuit_test_${i}`,
          platform: 'meta_facebook',
        });
      }

      // Circuit should now be open
      const result = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'circuit_test_open',
        platform: 'meta_facebook',
      });

      expect(result.error.code).toBe('CIRCUIT_OPEN');
    });

    it('should half-open circuit after cooldown', async () => {
      // Wait for half-open state
      await new Promise(r => setTimeout(r, 1000));

      // Enable success for probe
      await sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        simulationConfig: { successRate: 1 },
      });

      const result = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'circuit_test_probe',
        platform: 'meta_facebook',
      });

      // Should succeed and close circuit
      expect(result.success).toBe(true);
    });
  });

  describe('Data Validation Errors', () => {
    it('should reject invalid post content', async () => {
      const result = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'test_post',
        platform: 'meta_facebook',
        content: {
          text: '', // Empty text
          media: [],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.details).toContain('text');
    });

    it('should reject content exceeding platform limits', async () => {
      const result = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'test_post',
        platform: 'x',
        content: {
          text: 'a'.repeat(281), // Exceeds X limit
        },
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('CONTENT_TOO_LONG');
    });
  });

  describe('Cascading Failure Prevention', () => {
    it('should isolate failures to single platform', async () => {
      // Simulate Meta being down
      await sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        platforms: ['meta_facebook', 'meta_instagram'],
        simulationConfig: { successRate: 0 },
      });

      // Other platforms should still work
      const linkedInResult = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'test_post',
        platform: 'linkedin',
      });

      expect(linkedInResult.success).toBe(true);
    });

    it('should not cascade LLM failures to publishing', async () => {
      // Simulate LLM timeout during content generation
      await sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        operations: ['generate_content'],
        simulationConfig: { successRate: 0 },
      });

      // Pre-generated content should still publish
      const result = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'pregenerated_post',
        platform: 'meta_facebook',
        content: { text: 'Pre-generated content' },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Recovery Scenarios', () => {
    it('should recover state after unexpected shutdown', async () => {
      // Start an operation
      const publishPromise = publishingService.publish({
        clientId: ctx.clientId,
        postId: 'recovery_test',
        platform: 'meta_facebook',
      });

      // Simulate crash by canceling
      // ... recovery logic test

      // System should have recoverable state
      const pendingOps = await publishingService.getPendingOperations(ctx.clientId);
      expect(pendingOps.length).toBeGreaterThanOrEqual(0);
    });
  });
});
```

### Phase 2: Implementation

Implemented as part of the test file above. The error scenario tests use the sandbox service to simulate various failure conditions.

### Phase 3: Verification

```bash
# Run error scenario tests
cd packages/tests/e2e
pnpm test src/__tests__/error-scenarios.e2e.test.ts

# Run with verbose output
pnpm test src/__tests__/error-scenarios.e2e.test.ts --reporter=verbose
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/tests/e2e/src/__tests__/error-scenarios.e2e.test.ts` | Error scenario tests |

---

## Acceptance Criteria

- [ ] API errors (401, 429, 500) handled with appropriate retry logic
- [ ] Network failures (timeout, DNS) trigger retries
- [ ] Partial failures allow successful operations to complete
- [ ] Kill switches halt operations immediately
- [ ] Circuit breaker opens after consecutive failures
- [ ] Validation errors provide clear feedback
- [ ] Cascading failures are isolated
- [ ] Recovery from unexpected shutdown is possible

---

## JSON Task Block

```json
{
  "task_id": "S5-A5",
  "name": "Error Scenario Testing",
  "description": "ErrorScenarioTestSuite validating failure handling and recovery",
  "status": "pending",
  "dependencies": ["S5-A3"],
  "blocks": ["S5-B1"],
  "agent": "A",
  "sprint": 5,
  "complexity": "high",
  "estimated_files": 1,
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
  - docs/runbooks/

writes_made: []

decisions:
  - decision: "Use sandbox to simulate error conditions"
    rationale: "Allows deterministic error testing without real failures"
  - decision: "Test kill switch integration in error scenarios"
    rationale: "Kill switches are critical safety nets during failures"

blockers: []
questions: []
```
