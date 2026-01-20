# Build Prompt: S5-A3 — End-to-End Test Suite

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-A3 |
| Sprint | 5 - Gated Rollout |
| Agent | A - House Account Testing |
| Task Name | End-to-End Test Suite |
| Complexity | High |
| Status | pending |
| Dependencies | S5-A2 |
| Blocked By | None |

---

## Context

### What This Builds

The E2ETestSuite that validates complete system flows from planning through publishing and engagement. This suite runs against house accounts with sandbox mode, testing all major paths including happy paths, error scenarios, and edge cases.

### Why It Matters

- **System Validation**: Prove entire flows work before client exposure
- **Regression Prevention**: Catch breaking changes across sprints
- **Confidence Building**: Documented proof of system capabilities
- **Documentation**: Tests serve as executable specifications
- **CI/CD Integration**: Automated validation on every deploy

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/07-engineering-process/testing-strategy.md` | E2E Testing | Test architecture |
| `docs/01-architecture/system-architecture-v3.md` | System Flows | Flow definitions |
| `docs/06-reliability-ops/slo-error-budget.md` | SLOs | Success criteria |

---

## Prerequisites

### Completed Tasks

- [x] S5-A2: Sandbox mode (tests run in sandbox)
- [x] All Sprint 0-4 tasks (system components to test)

### Required Packages

```json
{
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "playwright": "^1.44.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create comprehensive tests BEFORE any implementation.

#### 1.1 Create E2E Test Framework

**File:** `packages/tests/e2e/src/framework/test-context.ts`

```typescript
import { nanoid } from 'nanoid';
import { HOUSE_CLIENT_ID } from '@rtv/rollout/house-accounts';
import { SandboxModeService } from '@rtv/rollout/sandbox';

export interface E2ETestContext {
  testId: string;
  clientId: string;
  startedAt: Date;
  sandbox: SandboxModeService;
  artifacts: Map<string, any>;
  cleanup: Array<() => Promise<void>>;
}

export async function createTestContext(
  sandbox: SandboxModeService
): Promise<E2ETestContext> {
  const testId = `e2e_${nanoid(8)}`;

  // Enable sandbox for house account
  await sandbox.enableSandbox(HOUSE_CLIENT_ID, {
    mode: 'simulate',
    simulationConfig: {
      successRate: 1.0, // Tests expect success
      latencyMs: { min: 10, max: 50 },
      generateFakeIds: true,
    },
  });

  return {
    testId,
    clientId: HOUSE_CLIENT_ID,
    startedAt: new Date(),
    sandbox,
    artifacts: new Map(),
    cleanup: [],
  };
}

export async function cleanupTestContext(ctx: E2ETestContext): Promise<void> {
  // Run cleanup functions in reverse order
  for (const fn of ctx.cleanup.reverse()) {
    try {
      await fn();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  // Disable sandbox
  await ctx.sandbox.disableSandbox(ctx.clientId);
}
```

#### 1.2 Create Planning Flow E2E Test

**File:** `packages/tests/e2e/src/__tests__/planning-flow.e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestContext, E2ETestContext } from '../framework/test-context';
import { SandboxModeService } from '@rtv/rollout/sandbox';
import { PlanningService } from '@rtv/planning';
import { BrandKitService } from '@rtv/clients/brand';
import { KnowledgeBaseService } from '@rtv/clients/knowledge';

describe('Planning Flow E2E', () => {
  let ctx: E2ETestContext;
  let planningService: PlanningService;
  let brandKitService: BrandKitService;
  let knowledgeBaseService: KnowledgeBaseService;

  beforeAll(async () => {
    // Initialize services
    const sandbox = new SandboxModeService({ /* config */ });
    ctx = await createTestContext(sandbox);

    planningService = new PlanningService({ /* config */ });
    brandKitService = new BrandKitService({ /* config */ });
    knowledgeBaseService = new KnowledgeBaseService({ /* config */ });
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  describe('Brand to Plan Flow', () => {
    it('should create brand kit from client onboarding', async () => {
      // Step 1: Create brand kit
      const brandKit = await brandKitService.create(ctx.clientId, {
        name: 'E2E Test Brand',
        voice: {
          tone: 'professional',
          personality: ['helpful', 'knowledgeable'],
        },
        colors: {
          primary: '#3B82F6',
          secondary: '#10B981',
        },
        targetAudience: 'Small business owners',
      });

      expect(brandKit.id).toBeDefined();
      expect(brandKit.clientId).toBe(ctx.clientId);
      ctx.artifacts.set('brandKit', brandKit);
    });

    it('should populate knowledge base', async () => {
      // Step 2: Add knowledge base entries
      const entries = await knowledgeBaseService.addEntries(ctx.clientId, [
        {
          type: 'faq',
          question: 'What services do you offer?',
          answer: 'We offer consulting and implementation services.',
        },
        {
          type: 'product',
          name: 'Premium Package',
          description: 'Full-service implementation with support.',
          price: 5000,
        },
      ]);

      expect(entries).toHaveLength(2);
      ctx.artifacts.set('knowledgeEntries', entries);
    });

    it('should generate content plan from brand kit', async () => {
      const brandKit = ctx.artifacts.get('brandKit');

      // Step 3: Generate plan
      const plan = await planningService.generatePlan(ctx.clientId, {
        brandKitId: brandKit.id,
        platforms: ['meta_facebook', 'linkedin'],
        duration: { days: 7 },
        postsPerPlatformPerDay: 1,
      });

      expect(plan.id).toBeDefined();
      expect(plan.status).toBe('draft');
      expect(plan.nodes.length).toBeGreaterThan(0);
      ctx.artifacts.set('plan', plan);
    });

    it('should approve plan and transition to scheduled', async () => {
      const plan = ctx.artifacts.get('plan');

      // Step 4: Approve plan
      const approved = await planningService.approvePlan(plan.id, {
        approvedBy: 'e2e_test',
        notes: 'Auto-approved by E2E test',
      });

      expect(approved.status).toBe('approved');
    });
  });

  describe('Plan Validation', () => {
    it('should validate plan has required content types', async () => {
      const plan = ctx.artifacts.get('plan');

      const validation = await planningService.validatePlan(plan.id);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect scheduling conflicts', async () => {
      const plan = ctx.artifacts.get('plan');

      // Try to create overlapping plan
      const overlappingPlan = await planningService.generatePlan(ctx.clientId, {
        brandKitId: ctx.artifacts.get('brandKit').id,
        platforms: ['meta_facebook'],
        duration: { days: 7 },
        postsPerPlatformPerDay: 1,
        startDate: plan.startDate, // Same start date
      });

      const validation = await planningService.validatePlan(overlappingPlan.id);

      expect(validation.warnings).toContain(
        expect.stringContaining('scheduling conflict')
      );
    });
  });

  describe('Plan Graph Operations', () => {
    it('should allow plan revision', async () => {
      const plan = ctx.artifacts.get('plan');

      const revised = await planningService.revisePlan(plan.id, {
        addNodes: [
          {
            type: 'content',
            platform: 'instagram',
            scheduledFor: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
        revisedBy: 'e2e_test',
      });

      expect(revised.version).toBeGreaterThan(plan.version);
    });

    it('should track plan version history', async () => {
      const plan = ctx.artifacts.get('plan');

      const history = await planningService.getPlanHistory(plan.id);

      expect(history.versions.length).toBeGreaterThan(1);
      expect(history.versions[0].version).toBe(1);
    });
  });
});
```

#### 1.3 Create Creation Flow E2E Test

**File:** `packages/tests/e2e/src/__tests__/creation-flow.e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestContext, E2ETestContext } from '../framework/test-context';
import { SandboxModeService } from '@rtv/rollout/sandbox';
import { CopyAgentService } from '@rtv/agents/copy';
import { MediaGenerationService } from '@rtv/agents/media';
import { BlueprintService } from '@rtv/planning/blueprints';

describe('Creation Flow E2E', () => {
  let ctx: E2ETestContext;
  let copyAgent: CopyAgentService;
  let mediaService: MediaGenerationService;
  let blueprintService: BlueprintService;

  beforeAll(async () => {
    const sandbox = new SandboxModeService({ /* config */ });
    ctx = await createTestContext(sandbox);

    copyAgent = new CopyAgentService({ /* config */ });
    mediaService = new MediaGenerationService({ /* config */ });
    blueprintService = new BlueprintService({ /* config */ });
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  describe('Blueprint Execution', () => {
    it('should select appropriate blueprint for content type', async () => {
      const blueprint = await blueprintService.selectBlueprint({
        clientId: ctx.clientId,
        contentType: 'educational_post',
        platform: 'linkedin',
      });

      expect(blueprint.id).toBeDefined();
      expect(blueprint.steps.length).toBeGreaterThan(0);
      ctx.artifacts.set('blueprint', blueprint);
    });

    it('should generate copy using blueprint prompts', async () => {
      const blueprint = ctx.artifacts.get('blueprint');

      const copy = await copyAgent.generateCopy({
        clientId: ctx.clientId,
        blueprintId: blueprint.id,
        context: {
          topic: 'E2E Test Topic',
          targetAudience: 'Business professionals',
        },
      });

      expect(copy.headline).toBeDefined();
      expect(copy.body).toBeDefined();
      expect(copy.cta).toBeDefined();
      ctx.artifacts.set('copy', copy);
    });

    it('should validate copy against brand guidelines', async () => {
      const copy = ctx.artifacts.get('copy');

      const validation = await copyAgent.validateCopy(ctx.clientId, copy);

      expect(validation.passesGuidelines).toBe(true);
      expect(validation.toneMatch).toBeGreaterThan(0.8);
    });

    it('should generate image prompt from copy', async () => {
      const copy = ctx.artifacts.get('copy');

      const imagePrompt = await mediaService.generateImagePrompt({
        clientId: ctx.clientId,
        copy,
        platform: 'linkedin',
        style: 'professional',
      });

      expect(imagePrompt.prompt).toBeDefined();
      expect(imagePrompt.negativePrompt).toBeDefined();
      ctx.artifacts.set('imagePrompt', imagePrompt);
    });

    it('should generate image asset (simulated)', async () => {
      const imagePrompt = ctx.artifacts.get('imagePrompt');

      const image = await mediaService.generateImage({
        clientId: ctx.clientId,
        prompt: imagePrompt.prompt,
        dimensions: { width: 1200, height: 628 },
      });

      // In sandbox mode, this returns a simulated response
      expect(image.id).toMatch(/^sandbox_/);
      expect(image.url).toContain('sandbox');
      ctx.artifacts.set('image', image);
    });
  });

  describe('Asset Assembly', () => {
    it('should assemble complete post from components', async () => {
      const copy = ctx.artifacts.get('copy');
      const image = ctx.artifacts.get('image');

      const post = await blueprintService.assemblePost({
        clientId: ctx.clientId,
        copy,
        media: [image],
        platform: 'linkedin',
        scheduledFor: new Date(Date.now() + 86400000).toISOString(),
      });

      expect(post.id).toBeDefined();
      expect(post.status).toBe('ready');
      expect(post.components.copy).toBe(copy.id);
      expect(post.components.media).toContain(image.id);
      ctx.artifacts.set('post', post);
    });

    it('should validate post completeness', async () => {
      const post = ctx.artifacts.get('post');

      const validation = await blueprintService.validatePost(post.id);

      expect(validation.complete).toBe(true);
      expect(validation.missingComponents).toHaveLength(0);
    });
  });

  describe('Content Variants', () => {
    it('should generate platform variants from base content', async () => {
      const copy = ctx.artifacts.get('copy');

      const variants = await copyAgent.generateVariants({
        clientId: ctx.clientId,
        baseCopy: copy,
        platforms: ['meta_facebook', 'x', 'instagram'],
      });

      expect(variants).toHaveLength(3);
      variants.forEach(v => {
        expect(v.platform).toBeDefined();
        expect(v.characterCount).toBeLessThanOrEqual(
          v.platform === 'x' ? 280 : 2200
        );
      });
    });
  });
});
```

#### 1.4 Create Publishing Flow E2E Test

**File:** `packages/tests/e2e/src/__tests__/publishing-flow.e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestContext, E2ETestContext } from '../framework/test-context';
import { SandboxModeService } from '@rtv/rollout/sandbox';
import { CalendarService } from '@rtv/scheduling/calendar';
import { PublishingService } from '@rtv/publishing';
import { VerificationService } from '@rtv/publishing/verification';

describe('Publishing Flow E2E', () => {
  let ctx: E2ETestContext;
  let calendarService: CalendarService;
  let publishingService: PublishingService;
  let verificationService: VerificationService;

  beforeAll(async () => {
    const sandbox = new SandboxModeService({ /* config */ });
    ctx = await createTestContext(sandbox);

    calendarService = new CalendarService({ /* config */ });
    publishingService = new PublishingService({ /* config */ });
    verificationService = new VerificationService({ /* config */ });
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  describe('Scheduling Flow', () => {
    it('should schedule post for future publication', async () => {
      const scheduledTime = new Date(Date.now() + 3600000); // 1 hour from now

      const scheduled = await calendarService.schedulePost({
        clientId: ctx.clientId,
        postId: 'test_post_123',
        platform: 'meta_facebook',
        scheduledFor: scheduledTime.toISOString(),
      });

      expect(scheduled.id).toBeDefined();
      expect(scheduled.status).toBe('scheduled');
      expect(new Date(scheduled.scheduledFor)).toEqual(scheduledTime);
      ctx.artifacts.set('scheduledPost', scheduled);
    });

    it('should detect and resolve scheduling conflicts', async () => {
      const scheduled = ctx.artifacts.get('scheduledPost');

      // Try to schedule at same time
      const conflict = await calendarService.schedulePost({
        clientId: ctx.clientId,
        postId: 'test_post_456',
        platform: 'meta_facebook',
        scheduledFor: scheduled.scheduledFor,
      });

      // Should auto-resolve by shifting time
      expect(conflict.scheduledFor).not.toBe(scheduled.scheduledFor);
    });

    it('should respect platform posting limits', async () => {
      const posts = [];

      // Try to schedule 10 posts in 1 hour (exceeds limit)
      for (let i = 0; i < 10; i++) {
        const result = await calendarService.schedulePost({
          clientId: ctx.clientId,
          postId: `bulk_post_${i}`,
          platform: 'meta_facebook',
          scheduledFor: new Date(Date.now() + 3600000 + i * 60000).toISOString(),
        });
        posts.push(result);
      }

      // Some should be delayed to next hour
      const scheduledHours = posts.map(p =>
        new Date(p.scheduledFor).getHours()
      );
      const uniqueHours = new Set(scheduledHours);

      expect(uniqueHours.size).toBeGreaterThan(1); // Spread across hours
    });
  });

  describe('Publication Execution', () => {
    it('should execute publication via API lane (simulated)', async () => {
      const result = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'test_post_123',
        platform: 'meta_facebook',
        lane: 'api',
      });

      // In sandbox mode, returns simulated success
      expect(result.success).toBe(true);
      expect(result.platformPostId).toMatch(/^sandbox_/);
      expect(result.publishedAt).toBeDefined();
      ctx.artifacts.set('publishedPost', result);
    });

    it('should fall back to browser lane on API failure', async () => {
      // Configure sandbox to fail API calls
      await ctx.sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        operations: ['publish_api'],
        simulationConfig: { successRate: 0 }, // Always fail API
      });

      const result = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'test_post_browser',
        platform: 'meta_facebook',
        lane: 'auto', // Will try API then fallback
      });

      expect(result.lane).toBe('browser');
      expect(result.success).toBe(true);
    });
  });

  describe('Verification Flow', () => {
    it('should verify publication exists on platform', async () => {
      const published = ctx.artifacts.get('publishedPost');

      const verification = await verificationService.verify({
        clientId: ctx.clientId,
        platform: 'meta_facebook',
        platformPostId: published.platformPostId,
      });

      expect(verification.verified).toBe(true);
      expect(verification.proofUrl).toBeDefined();
      ctx.artifacts.set('verification', verification);
    });

    it('should capture proof artifacts', async () => {
      const verification = ctx.artifacts.get('verification');

      expect(verification.proof).toBeDefined();
      expect(verification.proof.screenshotUrl).toBeDefined();
      expect(verification.proof.capturedAt).toBeDefined();
    });

    it('should retry verification on transient failure', async () => {
      // First attempt fails, second succeeds
      let attempts = 0;
      await ctx.sandbox.enableSandbox(ctx.clientId, {
        mode: 'simulate',
        operations: ['verify'],
        simulationConfig: {
          successRate: attempts++ > 0 ? 1 : 0,
        },
      });

      const verification = await verificationService.verifyWithRetry({
        clientId: ctx.clientId,
        platform: 'meta_facebook',
        platformPostId: 'sandbox_post_123',
        maxRetries: 3,
        retryDelayMs: 100,
      });

      expect(verification.verified).toBe(true);
      expect(verification.attempts).toBeGreaterThan(1);
    });
  });

  describe('Rollback Flow', () => {
    it('should rollback failed publication', async () => {
      // Create a failed publication
      const failed = await publishingService.publish({
        clientId: ctx.clientId,
        postId: 'test_post_rollback',
        platform: 'meta_facebook',
        lane: 'api',
      });

      // Mark as needing rollback
      const rollback = await publishingService.rollback({
        clientId: ctx.clientId,
        publicationId: failed.id,
        reason: 'E2E test rollback',
      });

      expect(rollback.status).toBe('rolled_back');
      expect(rollback.deletedFromPlatform).toBe(true);
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Implement E2E Test Runner

**File:** `packages/tests/e2e/src/runner/e2e-runner.ts`

```typescript
import { nanoid } from 'nanoid';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('e2e-test-runner');

export interface E2ETestResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  artifacts: Record<string, any>;
}

export interface E2ESuiteResult {
  suiteId: string;
  suiteName: string;
  startedAt: string;
  completedAt: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  results: E2ETestResult[];
}

export interface E2ERunnerConfig {
  sandbox: any;
  clientId: string;
  timeout?: number;
  retries?: number;
}

export class E2ETestRunner {
  private sandbox: any;
  private clientId: string;
  private timeout: number;
  private retries: number;

  constructor(config: E2ERunnerConfig) {
    this.sandbox = config.sandbox;
    this.clientId = config.clientId;
    this.timeout = config.timeout ?? 60000;
    this.retries = config.retries ?? 0;
  }

  async runSuite(
    suiteName: string,
    tests: Array<{ name: string; fn: () => Promise<void> }>
  ): Promise<E2ESuiteResult> {
    return tracer.startActiveSpan(`e2e:${suiteName}`, async (span) => {
      const suiteId = `suite_${nanoid(8)}`;
      const startedAt = new Date();
      const results: E2ETestResult[] = [];

      span.setAttribute('suite.id', suiteId);
      span.setAttribute('suite.name', suiteName);
      span.setAttribute('suite.test_count', tests.length);

      for (const test of tests) {
        const result = await this.runTest(test.name, test.fn);
        results.push(result);
      }

      const completedAt = new Date();
      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const skipped = results.filter(r => r.status === 'skipped').length;

      span.setAttribute('suite.passed', passed);
      span.setAttribute('suite.failed', failed);
      span.setStatus({
        code: failed > 0 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
      });
      span.end();

      return {
        suiteId,
        suiteName,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        totalTests: tests.length,
        passed,
        failed,
        skipped,
        results,
      };
    });
  }

  private async runTest(
    testName: string,
    testFn: () => Promise<void>
  ): Promise<E2ETestResult> {
    return tracer.startActiveSpan(`test:${testName}`, async (span) => {
      const testId = `test_${nanoid(8)}`;
      const startTime = Date.now();

      span.setAttribute('test.id', testId);
      span.setAttribute('test.name', testName);

      let attempts = 0;
      let lastError: Error | undefined;

      while (attempts <= this.retries) {
        try {
          await Promise.race([
            testFn(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Test timeout')),
                this.timeout
              )
            ),
          ]);

          span.setStatus({ code: SpanStatusCode.OK });
          span.end();

          return {
            testId,
            testName,
            status: 'passed',
            duration: Date.now() - startTime,
            artifacts: {},
          };
        } catch (error) {
          lastError = error as Error;
          attempts++;

          if (attempts <= this.retries) {
            span.addEvent('retry', { attempt: attempts });
          }
        }
      }

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: lastError?.message,
      });
      span.end();

      return {
        testId,
        testName,
        status: 'failed',
        duration: Date.now() - startTime,
        error: lastError?.message,
        artifacts: {},
      };
    });
  }
}
```

### Phase 3: Verification

```bash
# Run E2E tests
cd packages/tests/e2e
pnpm test src/__tests__/planning-flow.e2e.test.ts
pnpm test src/__tests__/creation-flow.e2e.test.ts
pnpm test src/__tests__/publishing-flow.e2e.test.ts

# Run full E2E suite
pnpm test:e2e

# Type check
pnpm tsc --noEmit
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/tests/e2e/package.json` | Package configuration |
| Create | `packages/tests/e2e/src/framework/test-context.ts` | Test context management |
| Create | `packages/tests/e2e/src/runner/e2e-runner.ts` | E2E test runner |
| Create | `packages/tests/e2e/src/__tests__/planning-flow.e2e.test.ts` | Planning E2E tests |
| Create | `packages/tests/e2e/src/__tests__/creation-flow.e2e.test.ts` | Creation E2E tests |
| Create | `packages/tests/e2e/src/__tests__/publishing-flow.e2e.test.ts` | Publishing E2E tests |
| Create | `packages/tests/e2e/vitest.config.ts` | Vitest configuration |

---

## Acceptance Criteria

- [ ] Planning flow E2E validates brand to plan pipeline
- [ ] Creation flow E2E validates blueprint to content pipeline
- [ ] Publishing flow E2E validates scheduling to verification
- [ ] All tests run against sandbox mode (no real side effects)
- [ ] Test artifacts captured for debugging
- [ ] Retry logic handles transient failures
- [ ] Timeout prevents hanging tests
- [ ] All tests pass with sandbox simulations

---

## Test Requirements

### E2E Tests
- Complete planning flow (brand → knowledge → plan → approval)
- Complete creation flow (blueprint → copy → media → assembly)
- Complete publishing flow (schedule → publish → verify)
- Error handling and rollback flows

---

## JSON Task Block

```json
{
  "task_id": "S5-A3",
  "name": "End-to-End Test Suite",
  "description": "E2ETestSuite validating complete system flows",
  "status": "pending",
  "dependencies": ["S5-A2"],
  "blocks": ["S5-A4", "S5-A5"],
  "agent": "A",
  "sprint": 5,
  "complexity": "high",
  "estimated_files": 7,
  "test_coverage_target": 80,
  "package": "@rtv/tests/e2e",
  "exports": [
    "E2ETestRunner",
    "createTestContext",
    "cleanupTestContext"
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
  - docs/07-engineering-process/testing-strategy.md
  - docs/01-architecture/system-architecture-v3.md
  - docs/06-reliability-ops/slo-error-budget.md

writes_made: []

decisions:
  - decision: "Run all E2E tests in sandbox mode"
    rationale: "Prevents real side effects while validating full flows"
  - decision: "Capture test artifacts for debugging"
    rationale: "Essential for diagnosing failures in complex flows"
  - decision: "Support retry with configurable attempts"
    rationale: "Handles transient failures in async systems"

blockers: []
questions: []
```
