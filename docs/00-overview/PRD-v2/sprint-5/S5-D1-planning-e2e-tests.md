# Build Prompt: S5-D1 — Planning E2E Tests

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-D1 |
| Sprint | 5 - Gated Rollout |
| Agent | D - Full E2E Test Suite |
| Task Name | Planning E2E Tests |
| Complexity | High |
| Status | pending |
| Dependencies | S5-A3, S2-A1 through S2-A5 |
| Blocked By | None |

---

## Context

### What This Builds

Comprehensive end-to-end tests for the Planning loop, validating the complete flow from brand context through plan generation to approval. Tests the entire planning pipeline with real (sandbox) side effects.

### Why It Matters

- **Flow Validation**: Ensures planning works end-to-end
- **Integration Testing**: Validates all planning components work together
- **Regression Prevention**: Catches breaking changes early
- **Confidence**: Proves system works before client rollout
- **Documentation**: Tests serve as executable specifications

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Planning Loop | Loop architecture |
| `docs/02-schemas/onboarding-schema.md` | Brand Context | Input data structure |
| `docs/00-overview/sprint-2-tasks.md` | Agent A | Planning components |

---

## Prerequisites

### Completed Tasks

- [x] S5-A3: E2E test suite framework
- [x] S2-A1 through S2-A5: Planning loop components
- [x] S5-A2: Sandbox mode configuration

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/tests/e2e/src/planning/__tests__/planning-flow.e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { E2ETestContext, createE2ETestContext } from '../../test-context';
import { PlanningE2ERunner } from '../planning-runner';

describe('Planning E2E: Brand → Plan Approved', () => {
  let ctx: E2ETestContext;
  let runner: PlanningE2ERunner;

  beforeAll(async () => {
    ctx = await createE2ETestContext({
      sandbox: true,
      clientId: 'e2e_test_client',
      platforms: ['meta', 'linkedin'],
    });
    runner = new PlanningE2ERunner(ctx);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await ctx.resetState();
  });

  describe('Complete Planning Flow', () => {
    it('should generate plan from brand context', async () => {
      // Step 1: Load brand context
      const brandContext = await runner.loadBrandContext({
        businessName: 'E2E Test Business',
        industry: 'technology',
        targetAudience: 'small business owners',
        brandVoice: 'professional, approachable',
        platforms: ['meta', 'linkedin'],
      });

      expect(brandContext.id).toBeDefined();
      expect(brandContext.status).toBe('active');

      // Step 2: Trigger plan generation
      const planRequest = await runner.requestPlanGeneration({
        brandContextId: brandContext.id,
        planningHorizon: '7_days',
        contentMix: {
          educational: 40,
          promotional: 30,
          engagement: 30,
        },
      });

      expect(planRequest.status).toBe('processing');

      // Step 3: Wait for plan completion
      const plan = await runner.waitForPlanCompletion(planRequest.id, {
        timeout: 60000, // 60 seconds
      });

      expect(plan.status).toBe('pending_approval');
      expect(plan.nodes.length).toBeGreaterThan(0);
      expect(plan.edges.length).toBeGreaterThan(0);
    }, 90000);

    it('should generate platform-specific content nodes', async () => {
      const brandContext = await runner.loadBrandContext({
        businessName: 'Multi-Platform Test',
        platforms: ['meta', 'linkedin', 'tiktok'],
      });

      const plan = await runner.generateAndWaitForPlan({
        brandContextId: brandContext.id,
        planningHorizon: '7_days',
      });

      // Verify platform distribution
      const platformCounts = plan.nodes.reduce((acc: Record<string, number>, node: any) => {
        acc[node.platform] = (acc[node.platform] || 0) + 1;
        return acc;
      }, {});

      expect(Object.keys(platformCounts)).toContain('meta');
      expect(Object.keys(platformCounts)).toContain('linkedin');
      expect(Object.keys(platformCounts)).toContain('tiktok');
    }, 90000);

    it('should respect content mix ratios', async () => {
      const brandContext = await runner.loadBrandContext({
        businessName: 'Content Mix Test',
        platforms: ['meta'],
      });

      const plan = await runner.generateAndWaitForPlan({
        brandContextId: brandContext.id,
        contentMix: {
          educational: 60,
          promotional: 20,
          engagement: 20,
        },
      });

      const typeCounts = plan.nodes.reduce((acc: Record<string, number>, node: any) => {
        acc[node.contentType] = (acc[node.contentType] || 0) + 1;
        return acc;
      }, {});

      const total = plan.nodes.length;
      const educationalRatio = (typeCounts.educational || 0) / total;

      // Allow 15% variance from target
      expect(educationalRatio).toBeGreaterThan(0.45);
      expect(educationalRatio).toBeLessThan(0.75);
    }, 90000);
  });

  describe('Plan Approval Flow', () => {
    it('should approve plan and transition to ready state', async () => {
      const brandContext = await runner.loadBrandContext({
        businessName: 'Approval Test',
        platforms: ['meta'],
      });

      const plan = await runner.generateAndWaitForPlan({
        brandContextId: brandContext.id,
      });

      expect(plan.status).toBe('pending_approval');

      // Approve the plan
      const approvedPlan = await runner.approvePlan(plan.id, {
        approvedBy: 'e2e_test_operator',
        notes: 'E2E test approval',
      });

      expect(approvedPlan.status).toBe('approved');
      expect(approvedPlan.approvedAt).toBeDefined();
      expect(approvedPlan.approvedBy).toBe('e2e_test_operator');
    }, 90000);

    it('should reject plan with feedback', async () => {
      const brandContext = await runner.loadBrandContext({
        businessName: 'Rejection Test',
        platforms: ['meta'],
      });

      const plan = await runner.generateAndWaitForPlan({
        brandContextId: brandContext.id,
      });

      // Reject the plan
      const rejectedPlan = await runner.rejectPlan(plan.id, {
        rejectedBy: 'e2e_test_operator',
        reason: 'Content needs more variety',
        feedback: 'Add more engagement posts',
      });

      expect(rejectedPlan.status).toBe('rejected');
      expect(rejectedPlan.rejectionReason).toBe('Content needs more variety');
    }, 90000);

    it('should regenerate plan after rejection', async () => {
      const brandContext = await runner.loadBrandContext({
        businessName: 'Regeneration Test',
        platforms: ['meta'],
      });

      const originalPlan = await runner.generateAndWaitForPlan({
        brandContextId: brandContext.id,
      });

      await runner.rejectPlan(originalPlan.id, {
        rejectedBy: 'e2e_test_operator',
        reason: 'Needs changes',
        feedback: 'More promotional content',
      });

      // Request regeneration
      const newPlan = await runner.regeneratePlan(originalPlan.id, {
        adjustments: {
          contentMix: {
            promotional: 50,
            educational: 25,
            engagement: 25,
          },
        },
      });

      expect(newPlan.id).not.toBe(originalPlan.id);
      expect(newPlan.previousPlanId).toBe(originalPlan.id);
      expect(newPlan.status).toBe('pending_approval');
    }, 120000);
  });

  describe('Plan Node Details', () => {
    it('should generate nodes with all required fields', async () => {
      const brandContext = await runner.loadBrandContext({
        businessName: 'Node Detail Test',
        platforms: ['meta'],
      });

      const plan = await runner.generateAndWaitForPlan({
        brandContextId: brandContext.id,
      });

      for (const node of plan.nodes) {
        expect(node.id).toBeDefined();
        expect(node.platform).toBeDefined();
        expect(node.contentType).toBeDefined();
        expect(node.scheduledFor).toBeDefined();
        expect(node.blueprint).toBeDefined();
        expect(node.blueprint.headline).toBeDefined();
        expect(node.blueprint.hook).toBeDefined();
      }
    }, 90000);

    it('should generate optimal posting times', async () => {
      const brandContext = await runner.loadBrandContext({
        businessName: 'Timing Test',
        platforms: ['meta'],
        timezone: 'America/New_York',
      });

      const plan = await runner.generateAndWaitForPlan({
        brandContextId: brandContext.id,
      });

      for (const node of plan.nodes) {
        const scheduledHour = new Date(node.scheduledFor).getHours();
        // Verify posting during reasonable hours (8 AM - 9 PM)
        expect(scheduledHour).toBeGreaterThanOrEqual(8);
        expect(scheduledHour).toBeLessThanOrEqual(21);
      }
    }, 90000);
  });

  describe('Error Handling', () => {
    it('should handle missing brand context gracefully', async () => {
      await expect(
        runner.requestPlanGeneration({
          brandContextId: 'nonexistent_id',
          planningHorizon: '7_days',
        })
      ).rejects.toThrow('Brand context not found');
    });

    it('should handle LLM timeout gracefully', async () => {
      const brandContext = await runner.loadBrandContext({
        businessName: 'Timeout Test',
        platforms: ['meta'],
      });

      // Force timeout by setting very short timeout
      await expect(
        runner.generateAndWaitForPlan(
          { brandContextId: brandContext.id },
          { timeout: 100 } // 100ms - will timeout
        )
      ).rejects.toThrow(/timeout/i);
    });

    it('should record failed generation in audit log', async () => {
      const brandContext = await runner.loadBrandContext({
        businessName: 'Audit Test',
        platforms: ['meta'],
      });

      try {
        await runner.generateAndWaitForPlan(
          { brandContextId: brandContext.id },
          { timeout: 100 }
        );
      } catch {
        // Expected to fail
      }

      const auditEvents = await ctx.getAuditEvents({
        clientId: ctx.clientId,
        eventType: 'plan.generation.failed',
      });

      expect(auditEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should generate plan within SLO (30 seconds)', async () => {
      const brandContext = await runner.loadBrandContext({
        businessName: 'Performance Test',
        platforms: ['meta'],
      });

      const startTime = Date.now();

      await runner.generateAndWaitForPlan({
        brandContextId: brandContext.id,
      });

      const duration = Date.now() - startTime;

      // SLO: Plan generation < 30 seconds
      expect(duration).toBeLessThan(30000);
    }, 60000);
  });
});
```

### Phase 2: Planning E2E Runner

**File:** `packages/tests/e2e/src/planning/planning-runner.ts`

```typescript
import { E2ETestContext } from '../test-context';

export interface BrandContextInput {
  businessName: string;
  industry?: string;
  targetAudience?: string;
  brandVoice?: string;
  platforms: string[];
  timezone?: string;
}

export interface PlanGenerationInput {
  brandContextId: string;
  planningHorizon?: '7_days' | '14_days' | '30_days';
  contentMix?: {
    educational?: number;
    promotional?: number;
    engagement?: number;
  };
}

export interface PlanApprovalInput {
  approvedBy: string;
  notes?: string;
}

export interface PlanRejectionInput {
  rejectedBy: string;
  reason: string;
  feedback?: string;
}

export interface WaitOptions {
  timeout?: number;
  pollInterval?: number;
}

export class PlanningE2ERunner {
  private ctx: E2ETestContext;

  constructor(ctx: E2ETestContext) {
    this.ctx = ctx;
  }

  async loadBrandContext(input: BrandContextInput): Promise<any> {
    const response = await this.ctx.api.post('/api/brand-context', {
      clientId: this.ctx.clientId,
      ...input,
    });

    return response.data;
  }

  async requestPlanGeneration(input: PlanGenerationInput): Promise<any> {
    const response = await this.ctx.api.post('/api/plans/generate', {
      clientId: this.ctx.clientId,
      ...input,
    });

    return response.data;
  }

  async waitForPlanCompletion(
    planRequestId: string,
    options: WaitOptions = {}
  ): Promise<any> {
    const timeout = options.timeout ?? 60000;
    const pollInterval = options.pollInterval ?? 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = await this.ctx.api.get(`/api/plans/${planRequestId}`);
      const plan = response.data;

      if (plan.status === 'pending_approval' || plan.status === 'approved') {
        return plan;
      }

      if (plan.status === 'failed') {
        throw new Error(`Plan generation failed: ${plan.error}`);
      }

      await this.sleep(pollInterval);
    }

    throw new Error(`Plan generation timeout after ${timeout}ms`);
  }

  async generateAndWaitForPlan(
    input: Omit<PlanGenerationInput, 'brandContextId'> & { brandContextId: string },
    options: WaitOptions = {}
  ): Promise<any> {
    const request = await this.requestPlanGeneration(input);
    return this.waitForPlanCompletion(request.id, options);
  }

  async approvePlan(planId: string, input: PlanApprovalInput): Promise<any> {
    const response = await this.ctx.api.post(`/api/plans/${planId}/approve`, {
      clientId: this.ctx.clientId,
      ...input,
    });

    return response.data;
  }

  async rejectPlan(planId: string, input: PlanRejectionInput): Promise<any> {
    const response = await this.ctx.api.post(`/api/plans/${planId}/reject`, {
      clientId: this.ctx.clientId,
      ...input,
    });

    return response.data;
  }

  async regeneratePlan(
    originalPlanId: string,
    options: { adjustments?: Partial<PlanGenerationInput> }
  ): Promise<any> {
    const response = await this.ctx.api.post(`/api/plans/${originalPlanId}/regenerate`, {
      clientId: this.ctx.clientId,
      ...options,
    });

    return this.waitForPlanCompletion(response.data.id);
  }

  async getPlanHistory(brandContextId: string): Promise<any[]> {
    const response = await this.ctx.api.get('/api/plans', {
      params: {
        clientId: this.ctx.clientId,
        brandContextId,
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

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/tests/e2e/src/planning/__tests__/planning-flow.e2e.test.ts` | E2E tests |
| Create | `packages/tests/e2e/src/planning/planning-runner.ts` | Test runner |
| Create | `packages/tests/e2e/src/planning/index.ts` | Exports |

---

## Acceptance Criteria

- [ ] Brand context → Plan generation flow works end-to-end
- [ ] Plan approval flow works correctly
- [ ] Plan rejection and regeneration flow works
- [ ] Platform-specific nodes generated correctly
- [ ] Content mix ratios respected within tolerance
- [ ] Optimal posting times generated
- [ ] Error handling tested (missing context, timeouts)
- [ ] Performance within SLO (30 seconds)

---

## JSON Task Block

```json
{
  "task_id": "S5-D1",
  "name": "Planning E2E Tests",
  "description": "End-to-end tests for planning flow: Brand → Plan approved",
  "status": "pending",
  "dependencies": ["S5-A3", "S2-A1", "S2-A2", "S2-A3", "S2-A4", "S2-A5"],
  "blocks": [],
  "agent": "D",
  "sprint": 5,
  "complexity": "high"
}
```

---

## External Memory Section

```yaml
episode_id: null
started_at: null
completed_at: null
summary_ref: null
artifacts:
  - type: test
    path: packages/tests/e2e/src/planning/__tests__/planning-flow.e2e.test.ts
  - type: code
    path: packages/tests/e2e/src/planning/planning-runner.ts
decisions: []
blockers: []
```
