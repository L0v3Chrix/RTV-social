# Build Prompt: S5-D3 — Publishing E2E Tests

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-D3 |
| Sprint | 5 - Gated Rollout |
| Agent | D - Full E2E Test Suite |
| Task Name | Publishing E2E Tests |
| Complexity | High |
| Status | pending |
| Dependencies | S5-A3, S3-A1 through S3-D5 |
| Blocked By | None |

---

## Context

### What This Builds

Comprehensive end-to-end tests for the Publishing loop, validating the complete flow from ready assets through scheduling, publishing, and verification. Tests both API and browser lanes.

### Why It Matters

- **Critical Path**: Publishing is where real side effects occur
- **Verification**: Confirms posts actually appear on platforms
- **Multi-Lane Testing**: Validates both API and browser fallback
- **Safety**: Ensures kill switches and rate limits work
- **SLO Validation**: Proves publish-to-verify under 5 minutes

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Scheduling/Publishing Loop | Loop architecture |
| `docs/04-browser-lane/runner-design.md` | Browser Lane | Fallback publishing |
| `docs/00-overview/sprint-3-tasks.md` | All Agents | Publishing components |

---

## Prerequisites

### Completed Tasks

- [x] S5-A3: E2E test suite framework
- [x] S3-A1 through S3-A5: Scheduling components
- [x] S3-B1 through S3-B6: Platform API connectors
- [x] S3-C1 through S3-C5: Browser lane components
- [x] S3-D1 through S3-D5: Verification components
- [x] S5-D2: Creation E2E tests (provides assets)

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/tests/e2e/src/publishing/__tests__/publishing-flow.e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { E2ETestContext, createE2ETestContext } from '../../test-context';
import { PublishingE2ERunner } from '../publishing-runner';
import { CreationE2ERunner } from '../../creation/creation-runner';
import { PlanningE2ERunner } from '../../planning/planning-runner';

describe('Publishing E2E: Assets → Published + Verified', () => {
  let ctx: E2ETestContext;
  let publishingRunner: PublishingE2ERunner;
  let creationRunner: CreationE2ERunner;
  let planningRunner: PlanningE2ERunner;
  let readyAssets: any;
  let approvedPlan: any;

  beforeAll(async () => {
    ctx = await createE2ETestContext({
      sandbox: true,
      clientId: 'e2e_publishing_test',
      platforms: ['meta', 'linkedin'],
    });

    publishingRunner = new PublishingE2ERunner(ctx);
    creationRunner = new CreationE2ERunner(ctx);
    planningRunner = new PlanningE2ERunner(ctx);

    // Set up plan and assets for publishing tests
    const brandContext = await planningRunner.loadBrandContext({
      businessName: 'Publishing E2E Test',
      platforms: ['meta', 'linkedin'],
    });

    const plan = await planningRunner.generateAndWaitForPlan({
      brandContextId: brandContext.id,
    });

    approvedPlan = await planningRunner.approvePlan(plan.id, {
      approvedBy: 'e2e_test_setup',
    });

    // Create assets for first node
    readyAssets = await creationRunner.executeAndWait({
      planId: approvedPlan.id,
      nodeId: approvedPlan.nodes[0].id,
    });
  }, 300000);

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await ctx.resetPublishingState();
  });

  describe('API Lane Publishing', () => {
    it('should publish via API and verify', async () => {
      const node = approvedPlan.nodes[0];

      // Schedule for immediate publish
      const scheduled = await publishingRunner.schedulePost({
        nodeId: node.id,
        assetsId: readyAssets.id,
        publishAt: new Date().toISOString(),
        lane: 'api',
      });

      expect(scheduled.status).toBe('scheduled');

      // Wait for publish
      const published = await publishingRunner.waitForPublish(scheduled.id, {
        timeout: 60000,
      });

      expect(published.status).toBe('published');
      expect(published.platformPostId).toBeDefined();

      // Verify the post
      const verified = await publishingRunner.waitForVerification(published.id, {
        timeout: 300000, // 5 minutes SLO
      });

      expect(verified.status).toBe('verified');
      expect(verified.verificationProof).toBeDefined();
      expect(verified.verificationProof.screenshot).toBeDefined();
    }, 360000);

    it('should record publish proof', async () => {
      const node = approvedPlan.nodes[0];

      const scheduled = await publishingRunner.schedulePost({
        nodeId: node.id,
        assetsId: readyAssets.id,
        publishAt: new Date().toISOString(),
        lane: 'api',
      });

      const published = await publishingRunner.waitForPublish(scheduled.id);

      expect(published.proof).toBeDefined();
      expect(published.proof.apiResponse).toBeDefined();
      expect(published.proof.timestamp).toBeDefined();
      expect(published.proof.platformPostId).toBeDefined();
    }, 120000);

    it('should handle API rate limits with backoff', async () => {
      // Trigger rate limit scenario
      ctx.setMockRateLimit('meta', true);

      const node = approvedPlan.nodes[0];

      const scheduled = await publishingRunner.schedulePost({
        nodeId: node.id,
        assetsId: readyAssets.id,
        publishAt: new Date().toISOString(),
        lane: 'api',
      });

      // Should retry with backoff
      const status = await publishingRunner.getPublishStatus(scheduled.id);

      expect(status.retryScheduled).toBe(true);
      expect(status.nextRetryAt).toBeDefined();

      ctx.setMockRateLimit('meta', false);
    }, 60000);
  });

  describe('Browser Lane Publishing', () => {
    it('should publish via browser lane when API unavailable', async () => {
      // Disable API lane
      ctx.setMockAPIAvailable('meta', false);

      const node = approvedPlan.nodes[0];

      const scheduled = await publishingRunner.schedulePost({
        nodeId: node.id,
        assetsId: readyAssets.id,
        publishAt: new Date().toISOString(),
        lane: 'auto', // Will fallback to browser
      });

      const published = await publishingRunner.waitForPublish(scheduled.id, {
        timeout: 120000, // Browser lane is slower
      });

      expect(published.status).toBe('published');
      expect(published.lane).toBe('browser');
      expect(published.browserProof).toBeDefined();
      expect(published.browserProof.screenshot).toBeDefined();

      ctx.setMockAPIAvailable('meta', true);
    }, 180000);

    it('should use browser lane for platforms without API', async () => {
      // Skool only supports browser lane
      const skoolContext = await createE2ETestContext({
        sandbox: true,
        clientId: 'e2e_skool_test',
        platforms: ['skool'],
      });

      const skoolRunner = new PublishingE2ERunner(skoolContext);

      // Create minimal assets for skool
      const skoolAssets = {
        id: 'skool_assets_1',
        copy: { body: 'Test post for Skool' },
      };

      const scheduled = await skoolRunner.schedulePost({
        nodeId: 'skool_node_1',
        assetsId: skoolAssets.id,
        publishAt: new Date().toISOString(),
        lane: 'auto',
      });

      const published = await skoolRunner.waitForPublish(scheduled.id, {
        timeout: 120000,
      });

      expect(published.lane).toBe('browser');

      await skoolContext.cleanup();
    }, 180000);
  });

  describe('Scheduling', () => {
    it('should schedule post for future time', async () => {
      const node = approvedPlan.nodes[0];
      const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour ahead

      const scheduled = await publishingRunner.schedulePost({
        nodeId: node.id,
        assetsId: readyAssets.id,
        publishAt: futureTime,
        lane: 'api',
      });

      expect(scheduled.status).toBe('scheduled');
      expect(scheduled.publishAt).toBe(futureTime);
    }, 30000);

    it('should respect platform cadence limits', async () => {
      const node = approvedPlan.nodes[0];
      const now = new Date().toISOString();

      // Schedule first post
      await publishingRunner.schedulePost({
        nodeId: node.id,
        assetsId: readyAssets.id,
        publishAt: now,
        lane: 'api',
      });

      // Try to schedule second post immediately (should be adjusted)
      const secondScheduled = await publishingRunner.schedulePost({
        nodeId: approvedPlan.nodes[1]?.id || node.id,
        assetsId: readyAssets.id,
        publishAt: now,
        lane: 'api',
      });

      // Should be scheduled at least 1 hour after first (cadence limit)
      const firstTime = new Date(now).getTime();
      const secondTime = new Date(secondScheduled.publishAt).getTime();

      expect(secondTime - firstTime).toBeGreaterThanOrEqual(3600000); // 1 hour
    }, 60000);

    it('should cancel scheduled post', async () => {
      const node = approvedPlan.nodes[0];
      const futureTime = new Date(Date.now() + 3600000).toISOString();

      const scheduled = await publishingRunner.schedulePost({
        nodeId: node.id,
        assetsId: readyAssets.id,
        publishAt: futureTime,
        lane: 'api',
      });

      const cancelled = await publishingRunner.cancelScheduledPost(scheduled.id, {
        reason: 'E2E test cancellation',
        cancelledBy: 'e2e_test',
      });

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancelledAt).toBeDefined();
    }, 30000);

    it('should reschedule post', async () => {
      const node = approvedPlan.nodes[0];
      const originalTime = new Date(Date.now() + 3600000).toISOString();
      const newTime = new Date(Date.now() + 7200000).toISOString();

      const scheduled = await publishingRunner.schedulePost({
        nodeId: node.id,
        assetsId: readyAssets.id,
        publishAt: originalTime,
        lane: 'api',
      });

      const rescheduled = await publishingRunner.reschedulePost(scheduled.id, {
        newPublishAt: newTime,
        reason: 'E2E test reschedule',
      });

      expect(rescheduled.publishAt).toBe(newTime);
      expect(rescheduled.rescheduledFrom).toBe(originalTime);
    }, 30000);
  });

  describe('Verification', () => {
    it('should verify post exists on platform', async () => {
      const node = approvedPlan.nodes[0];

      const scheduled = await publishingRunner.schedulePost({
        nodeId: node.id,
        assetsId: readyAssets.id,
        publishAt: new Date().toISOString(),
        lane: 'api',
      });

      const published = await publishingRunner.waitForPublish(scheduled.id);

      const verification = await publishingRunner.verifyPost(published.id);

      expect(verification.exists).toBe(true);
      expect(verification.contentMatch).toBe(true);
      expect(verification.proof.screenshot).toBeDefined();
    }, 300000);

    it('should detect verification failure', async () => {
      const node = approvedPlan.nodes[0];

      const scheduled = await publishingRunner.schedulePost({
        nodeId: node.id,
        assetsId: readyAssets.id,
        publishAt: new Date().toISOString(),
        lane: 'api',
      });

      const published = await publishingRunner.waitForPublish(scheduled.id);

      // Simulate post deletion
      ctx.simulatePostDeletion(published.platformPostId);

      const verification = await publishingRunner.verifyPost(published.id);

      expect(verification.exists).toBe(false);
      expect(verification.failureReason).toBe('post_not_found');
    }, 300000);
  });

  describe('Kill Switch Integration', () => {
    it('should block publishing when kill switch active', async () => {
      // Activate global kill switch
      await ctx.activateKillSwitch('global');

      const node = approvedPlan.nodes[0];

      await expect(
        publishingRunner.schedulePost({
          nodeId: node.id,
          assetsId: readyAssets.id,
          publishAt: new Date().toISOString(),
          lane: 'api',
        })
      ).rejects.toThrow(/kill switch/i);

      await ctx.deactivateKillSwitch('global');
    }, 30000);

    it('should block publishing when platform kill switch active', async () => {
      await ctx.activateKillSwitch('platform', 'meta');

      const node = approvedPlan.nodes.find((n: any) => n.platform === 'meta');
      if (!node) return;

      await expect(
        publishingRunner.schedulePost({
          nodeId: node.id,
          assetsId: readyAssets.id,
          publishAt: new Date().toISOString(),
          lane: 'api',
        })
      ).rejects.toThrow(/kill switch.*meta/i);

      await ctx.deactivateKillSwitch('platform', 'meta');
    }, 30000);
  });

  describe('Performance', () => {
    it('should verify within SLO (5 minutes from publish)', async () => {
      const node = approvedPlan.nodes[0];

      const scheduled = await publishingRunner.schedulePost({
        nodeId: node.id,
        assetsId: readyAssets.id,
        publishAt: new Date().toISOString(),
        lane: 'api',
      });

      const publishStartTime = Date.now();

      const published = await publishingRunner.waitForPublish(scheduled.id);

      const verified = await publishingRunner.waitForVerification(published.id, {
        timeout: 300000,
      });

      const totalDuration = Date.now() - publishStartTime;

      // SLO: Publish to verify < 5 minutes
      expect(totalDuration).toBeLessThan(300000);
      expect(verified.status).toBe('verified');
    }, 360000);
  });
});
```

### Phase 2: Publishing E2E Runner

**File:** `packages/tests/e2e/src/publishing/publishing-runner.ts`

```typescript
import { E2ETestContext } from '../test-context';

export interface SchedulePostInput {
  nodeId: string;
  assetsId: string;
  publishAt: string;
  lane: 'api' | 'browser' | 'auto';
}

export interface CancelInput {
  reason: string;
  cancelledBy: string;
}

export interface RescheduleInput {
  newPublishAt: string;
  reason: string;
}

export interface WaitOptions {
  timeout?: number;
  pollInterval?: number;
}

export class PublishingE2ERunner {
  private ctx: E2ETestContext;

  constructor(ctx: E2ETestContext) {
    this.ctx = ctx;
  }

  async schedulePost(input: SchedulePostInput): Promise<any> {
    const response = await this.ctx.api.post('/api/publishing/schedule', {
      clientId: this.ctx.clientId,
      ...input,
    });

    return response.data;
  }

  async waitForPublish(
    scheduledId: string,
    options: WaitOptions = {}
  ): Promise<any> {
    const timeout = options.timeout ?? 60000;
    const pollInterval = options.pollInterval ?? 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getPublishStatus(scheduledId);

      if (status.status === 'published') {
        return status;
      }

      if (status.status === 'failed') {
        throw new Error(`Publishing failed: ${status.error}`);
      }

      await this.sleep(pollInterval);
    }

    throw new Error(`Publishing timeout after ${timeout}ms`);
  }

  async waitForVerification(
    publishedId: string,
    options: WaitOptions = {}
  ): Promise<any> {
    const timeout = options.timeout ?? 300000;
    const pollInterval = options.pollInterval ?? 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getPublishStatus(publishedId);

      if (status.verificationStatus === 'verified') {
        return status;
      }

      if (status.verificationStatus === 'failed') {
        throw new Error(`Verification failed: ${status.verificationError}`);
      }

      await this.sleep(pollInterval);
    }

    throw new Error(`Verification timeout after ${timeout}ms`);
  }

  async getPublishStatus(id: string): Promise<any> {
    const response = await this.ctx.api.get(`/api/publishing/${id}`);
    return response.data;
  }

  async cancelScheduledPost(id: string, input: CancelInput): Promise<any> {
    const response = await this.ctx.api.post(`/api/publishing/${id}/cancel`, {
      clientId: this.ctx.clientId,
      ...input,
    });

    return response.data;
  }

  async reschedulePost(id: string, input: RescheduleInput): Promise<any> {
    const response = await this.ctx.api.post(`/api/publishing/${id}/reschedule`, {
      clientId: this.ctx.clientId,
      ...input,
    });

    return response.data;
  }

  async verifyPost(publishedId: string): Promise<any> {
    const response = await this.ctx.api.post(`/api/publishing/${publishedId}/verify`, {
      clientId: this.ctx.clientId,
    });

    return response.data;
  }

  async getPublishingHistory(options?: { nodeId?: string; limit?: number }): Promise<any[]> {
    const response = await this.ctx.api.get('/api/publishing/history', {
      params: {
        clientId: this.ctx.clientId,
        ...options,
      },
    });

    return response.data;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Acceptance Criteria

- [ ] API lane publishing works end-to-end
- [ ] Browser lane fallback works when API unavailable
- [ ] Post verification captures screenshot proof
- [ ] Scheduling respects platform cadence limits
- [ ] Cancel and reschedule work correctly
- [ ] Kill switches block publishing appropriately
- [ ] Rate limit handling with backoff
- [ ] Performance within SLO (publish-to-verify < 5 min)

---

## JSON Task Block

```json
{
  "task_id": "S5-D3",
  "name": "Publishing E2E Tests",
  "description": "End-to-end tests for publishing flow: Assets → Published + Verified",
  "status": "pending",
  "dependencies": ["S5-A3", "S3-A1", "S3-B1", "S3-C1", "S3-D1", "S5-D2"],
  "blocks": [],
  "agent": "D",
  "sprint": 5,
  "complexity": "high"
}
```
