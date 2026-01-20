# Build Prompt: S5-D2 — Creation E2E Tests

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-D2 |
| Sprint | 5 - Gated Rollout |
| Agent | D - Full E2E Test Suite |
| Task Name | Creation E2E Tests |
| Complexity | High |
| Status | pending |
| Dependencies | S5-A3, S2-B1 through S2-B5 |
| Blocked By | None |

---

## Context

### What This Builds

Comprehensive end-to-end tests for the Creation loop, validating the complete flow from approved plan through blueprint execution to assets ready. Tests copy generation, media creation, and variant production.

### Why It Matters

- **Asset Quality**: Ensures generated content meets standards
- **Integration Testing**: Validates copy and media pipelines work together
- **Variant Testing**: Confirms A/B variants generate correctly
- **Performance**: Verifies creation completes within SLO
- **Regression Prevention**: Catches quality degradation early

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Creation Loop | Loop architecture |
| `docs/03-agents-tools/tool-registry.md` | Media Tools | Asset generation tools |
| `docs/00-overview/sprint-2-tasks.md` | Agent B | Creation components |

---

## Prerequisites

### Completed Tasks

- [x] S5-A3: E2E test suite framework
- [x] S2-B1 through S2-B5: Creation loop components
- [x] S5-D1: Planning E2E tests (provides plan generation)

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/tests/e2e/src/creation/__tests__/creation-flow.e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { E2ETestContext, createE2ETestContext } from '../../test-context';
import { CreationE2ERunner } from '../creation-runner';
import { PlanningE2ERunner } from '../../planning/planning-runner';

describe('Creation E2E: Plan → Assets Ready', () => {
  let ctx: E2ETestContext;
  let creationRunner: CreationE2ERunner;
  let planningRunner: PlanningE2ERunner;
  let approvedPlan: any;

  beforeAll(async () => {
    ctx = await createE2ETestContext({
      sandbox: true,
      clientId: 'e2e_creation_test',
      platforms: ['meta', 'linkedin'],
    });
    creationRunner = new CreationE2ERunner(ctx);
    planningRunner = new PlanningE2ERunner(ctx);

    // Create an approved plan to use for creation tests
    const brandContext = await planningRunner.loadBrandContext({
      businessName: 'Creation E2E Test',
      industry: 'technology',
      platforms: ['meta', 'linkedin'],
    });

    const plan = await planningRunner.generateAndWaitForPlan({
      brandContextId: brandContext.id,
    });

    approvedPlan = await planningRunner.approvePlan(plan.id, {
      approvedBy: 'e2e_test_setup',
    });
  }, 120000);

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await ctx.resetCreationState();
  });

  describe('Complete Creation Flow', () => {
    it('should execute blueprint and generate assets', async () => {
      const node = approvedPlan.nodes[0];

      // Start blueprint execution
      const execution = await creationRunner.executeBlueprint({
        planId: approvedPlan.id,
        nodeId: node.id,
      });

      expect(execution.status).toBe('processing');

      // Wait for completion
      const result = await creationRunner.waitForExecution(execution.id, {
        timeout: 120000, // 2 minutes for media generation
      });

      expect(result.status).toBe('completed');
      expect(result.assets).toBeDefined();
      expect(result.assets.copy).toBeDefined();
      expect(result.assets.media).toBeDefined();
    }, 180000);

    it('should generate copy with all required fields', async () => {
      const node = approvedPlan.nodes[0];

      const result = await creationRunner.executeAndWait({
        planId: approvedPlan.id,
        nodeId: node.id,
      });

      const copy = result.assets.copy;

      expect(copy.headline).toBeDefined();
      expect(copy.body).toBeDefined();
      expect(copy.callToAction).toBeDefined();
      expect(copy.hashtags).toBeInstanceOf(Array);

      // Platform-specific validation
      if (node.platform === 'meta') {
        expect(copy.body.length).toBeLessThanOrEqual(2200); // Facebook limit
      }
      if (node.platform === 'linkedin') {
        expect(copy.body.length).toBeLessThanOrEqual(3000); // LinkedIn limit
      }
    }, 180000);

    it('should generate media assets', async () => {
      const node = approvedPlan.nodes[0];

      const result = await creationRunner.executeAndWait({
        planId: approvedPlan.id,
        nodeId: node.id,
      });

      const media = result.assets.media;

      expect(media.primaryImage).toBeDefined();
      expect(media.primaryImage.url).toBeDefined();
      expect(media.primaryImage.width).toBeGreaterThan(0);
      expect(media.primaryImage.height).toBeGreaterThan(0);
      expect(media.primaryImage.format).toMatch(/^(png|jpg|jpeg|webp)$/);
    }, 180000);
  });

  describe('Variant Generation', () => {
    it('should generate A/B copy variants', async () => {
      const node = approvedPlan.nodes[0];

      const result = await creationRunner.executeAndWait({
        planId: approvedPlan.id,
        nodeId: node.id,
        generateVariants: true,
        variantCount: 2,
      });

      expect(result.variants).toBeDefined();
      expect(result.variants.length).toBe(2);

      // Variants should be different
      expect(result.variants[0].copy.headline).not.toBe(result.variants[1].copy.headline);
    }, 180000);

    it('should maintain brand voice across variants', async () => {
      const node = approvedPlan.nodes[0];

      const result = await creationRunner.executeAndWait({
        planId: approvedPlan.id,
        nodeId: node.id,
        generateVariants: true,
        variantCount: 3,
      });

      // All variants should pass brand voice validation
      for (const variant of result.variants) {
        const validation = await creationRunner.validateBrandVoice(variant.copy);
        expect(validation.passed).toBe(true);
        expect(validation.score).toBeGreaterThan(0.7);
      }
    }, 180000);
  });

  describe('Platform-Specific Assets', () => {
    it('should generate correct image dimensions for Meta', async () => {
      const metaNode = approvedPlan.nodes.find((n: any) => n.platform === 'meta');
      if (!metaNode) return; // Skip if no meta nodes

      const result = await creationRunner.executeAndWait({
        planId: approvedPlan.id,
        nodeId: metaNode.id,
      });

      const media = result.assets.media;

      // Meta feed image should be 1200x630 or 1080x1080
      const isValidDimension =
        (media.primaryImage.width === 1200 && media.primaryImage.height === 630) ||
        (media.primaryImage.width === 1080 && media.primaryImage.height === 1080);

      expect(isValidDimension).toBe(true);
    }, 180000);

    it('should generate correct image dimensions for LinkedIn', async () => {
      const linkedinNode = approvedPlan.nodes.find((n: any) => n.platform === 'linkedin');
      if (!linkedinNode) return;

      const result = await creationRunner.executeAndWait({
        planId: approvedPlan.id,
        nodeId: linkedinNode.id,
      });

      const media = result.assets.media;

      // LinkedIn image should be 1200x627 or 1200x1200
      const isValidDimension =
        (media.primaryImage.width === 1200 && media.primaryImage.height === 627) ||
        (media.primaryImage.width === 1200 && media.primaryImage.height === 1200);

      expect(isValidDimension).toBe(true);
    }, 180000);
  });

  describe('Batch Processing', () => {
    it('should process multiple nodes in batch', async () => {
      const nodes = approvedPlan.nodes.slice(0, 3);

      const batchResult = await creationRunner.executeBatch({
        planId: approvedPlan.id,
        nodeIds: nodes.map((n: any) => n.id),
      });

      expect(batchResult.totalNodes).toBe(3);

      // Wait for all to complete
      const results = await creationRunner.waitForBatchCompletion(batchResult.batchId, {
        timeout: 300000, // 5 minutes for batch
      });

      expect(results.completed).toBe(3);
      expect(results.failed).toBe(0);
    }, 360000);

    it('should handle partial batch failures gracefully', async () => {
      // Include an invalid node to force partial failure
      const nodes = approvedPlan.nodes.slice(0, 2);

      const batchResult = await creationRunner.executeBatch({
        planId: approvedPlan.id,
        nodeIds: [...nodes.map((n: any) => n.id), 'invalid_node_id'],
      });

      const results = await creationRunner.waitForBatchCompletion(batchResult.batchId, {
        timeout: 300000,
      });

      expect(results.completed).toBe(2);
      expect(results.failed).toBe(1);
      expect(results.failedNodes[0].nodeId).toBe('invalid_node_id');
    }, 360000);
  });

  describe('Asset Storage', () => {
    it('should store assets in correct location', async () => {
      const node = approvedPlan.nodes[0];

      const result = await creationRunner.executeAndWait({
        planId: approvedPlan.id,
        nodeId: node.id,
      });

      // Verify storage path includes client ID and plan ID
      expect(result.assets.media.primaryImage.url).toContain(ctx.clientId);
      expect(result.assets.media.primaryImage.url).toContain(approvedPlan.id);
    }, 180000);

    it('should store asset metadata', async () => {
      const node = approvedPlan.nodes[0];

      const result = await creationRunner.executeAndWait({
        planId: approvedPlan.id,
        nodeId: node.id,
      });

      const metadata = await creationRunner.getAssetMetadata(result.assets.media.primaryImage.id);

      expect(metadata.clientId).toBe(ctx.clientId);
      expect(metadata.planId).toBe(approvedPlan.id);
      expect(metadata.nodeId).toBe(node.id);
      expect(metadata.createdAt).toBeDefined();
    }, 180000);
  });

  describe('Error Handling', () => {
    it('should handle LLM copy generation failure', async () => {
      const node = approvedPlan.nodes[0];

      // Force copy generation failure
      ctx.setMockFailure('copy_generation', true);

      try {
        await creationRunner.executeAndWait({
          planId: approvedPlan.id,
          nodeId: node.id,
        });
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Copy generation failed');
      } finally {
        ctx.setMockFailure('copy_generation', false);
      }
    }, 60000);

    it('should retry on transient media generation failure', async () => {
      const node = approvedPlan.nodes[0];

      // Set up transient failure (fails once, then succeeds)
      ctx.setTransientFailure('media_generation', 1);

      const result = await creationRunner.executeAndWait({
        planId: approvedPlan.id,
        nodeId: node.id,
      });

      expect(result.status).toBe('completed');
      expect(result.retryCount).toBe(1);
    }, 180000);
  });

  describe('Performance', () => {
    it('should complete single node within SLO (60 seconds)', async () => {
      const node = approvedPlan.nodes[0];

      const startTime = Date.now();

      await creationRunner.executeAndWait({
        planId: approvedPlan.id,
        nodeId: node.id,
      });

      const duration = Date.now() - startTime;

      // SLO: Single node creation < 60 seconds
      expect(duration).toBeLessThan(60000);
    }, 90000);
  });
});
```

### Phase 2: Creation E2E Runner

**File:** `packages/tests/e2e/src/creation/creation-runner.ts`

```typescript
import { E2ETestContext } from '../test-context';

export interface BlueprintExecutionInput {
  planId: string;
  nodeId: string;
  generateVariants?: boolean;
  variantCount?: number;
}

export interface BatchExecutionInput {
  planId: string;
  nodeIds: string[];
}

export interface WaitOptions {
  timeout?: number;
  pollInterval?: number;
}

export class CreationE2ERunner {
  private ctx: E2ETestContext;

  constructor(ctx: E2ETestContext) {
    this.ctx = ctx;
  }

  async executeBlueprint(input: BlueprintExecutionInput): Promise<any> {
    const response = await this.ctx.api.post('/api/creation/execute', {
      clientId: this.ctx.clientId,
      ...input,
    });

    return response.data;
  }

  async waitForExecution(
    executionId: string,
    options: WaitOptions = {}
  ): Promise<any> {
    const timeout = options.timeout ?? 120000;
    const pollInterval = options.pollInterval ?? 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = await this.ctx.api.get(`/api/creation/executions/${executionId}`);
      const execution = response.data;

      if (execution.status === 'completed') {
        return execution;
      }

      if (execution.status === 'failed') {
        throw new Error(`Blueprint execution failed: ${execution.error}`);
      }

      await this.sleep(pollInterval);
    }

    throw new Error(`Blueprint execution timeout after ${timeout}ms`);
  }

  async executeAndWait(
    input: BlueprintExecutionInput,
    options: WaitOptions = {}
  ): Promise<any> {
    const execution = await this.executeBlueprint(input);
    return this.waitForExecution(execution.id, options);
  }

  async executeBatch(input: BatchExecutionInput): Promise<any> {
    const response = await this.ctx.api.post('/api/creation/batch', {
      clientId: this.ctx.clientId,
      ...input,
    });

    return response.data;
  }

  async waitForBatchCompletion(
    batchId: string,
    options: WaitOptions = {}
  ): Promise<any> {
    const timeout = options.timeout ?? 300000;
    const pollInterval = options.pollInterval ?? 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = await this.ctx.api.get(`/api/creation/batches/${batchId}`);
      const batch = response.data;

      if (batch.status === 'completed' || batch.status === 'partial_failure') {
        return batch;
      }

      if (batch.status === 'failed') {
        throw new Error(`Batch execution failed: ${batch.error}`);
      }

      await this.sleep(pollInterval);
    }

    throw new Error(`Batch execution timeout after ${timeout}ms`);
  }

  async validateBrandVoice(copy: any): Promise<{ passed: boolean; score: number; issues: string[] }> {
    const response = await this.ctx.api.post('/api/creation/validate-voice', {
      clientId: this.ctx.clientId,
      copy,
    });

    return response.data;
  }

  async getAssetMetadata(assetId: string): Promise<any> {
    const response = await this.ctx.api.get(`/api/assets/${assetId}/metadata`);
    return response.data;
  }

  async getExecutionHistory(nodeId: string): Promise<any[]> {
    const response = await this.ctx.api.get('/api/creation/history', {
      params: {
        clientId: this.ctx.clientId,
        nodeId,
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

- [ ] Blueprint execution generates complete assets
- [ ] Copy includes all required fields (headline, body, CTA, hashtags)
- [ ] Platform character limits enforced
- [ ] Media assets generated with correct dimensions
- [ ] A/B variants generated when requested
- [ ] Brand voice consistency validated
- [ ] Batch processing works with partial failure handling
- [ ] Assets stored with correct metadata
- [ ] Performance within SLO (60 seconds per node)

---

## JSON Task Block

```json
{
  "task_id": "S5-D2",
  "name": "Creation E2E Tests",
  "description": "End-to-end tests for creation flow: Plan → Assets ready",
  "status": "pending",
  "dependencies": ["S5-A3", "S2-B1", "S2-B2", "S2-B3", "S2-B4", "S2-B5", "S5-D1"],
  "blocks": [],
  "agent": "D",
  "sprint": 5,
  "complexity": "high"
}
```
