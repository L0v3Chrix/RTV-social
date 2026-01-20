# S3-B9: Adaptive Model Router

## Task Metadata

```json
{
  "task_id": "S3-B9",
  "name": "Adaptive Model Router",
  "sprint": 3,
  "agent": "B",
  "status": "pending",
  "tests_status": "not_written",
  "dependencies": ["S3-B7", "S3-B8"],
  "blocks": [],
  "estimated_complexity": "high",
  "estimated_hours": 4,
  "spec_references": [
    "/docs/adr/ADR-0001-tesla-mixed-precision-patterns.md",
    "/docs/01-architecture/system-architecture-v3.md",
    "/docs/05-policy-safety/multi-tenant-isolation.md"
  ],
  "acceptance_criteria": [
    "AdaptiveModelRouter class with intelligent routing",
    "Integration with ComplexityAssessor and ModelTierRegistry",
    "Client budget awareness",
    "Fallback chain execution on errors",
    "Usage tracking and cost monitoring",
    "A/B testing support for tier experiments"
  ],
  "test_files": [
    "packages/api-client/src/__tests__/adaptive-model-router.test.ts"
  ],
  "created_files": [
    "packages/api-client/src/model-tiers/adaptive-router.ts",
    "packages/api-client/src/model-tiers/index.ts"
  ]
}
```

---

## Context

The Adaptive Model Router is the runtime orchestrator that combines complexity assessment with tier configuration to intelligently route requests to the appropriate model, with fallback handling and cost management.

### Routing Flow

```
Task Request
     │
     ▼
┌─────────────────────────────┐
│  ComplexityAssessor         │
│  "How complex is this?"     │
└─────────────┬───────────────┘
              │ complexity score
              ▼
┌─────────────────────────────┐
│  ModelTierRegistry          │
│  "What's available?"        │
└─────────────┬───────────────┘
              │ available models
              ▼
┌─────────────────────────────┐
│  AdaptiveModelRouter        │
│  - Check budget             │
│  - Select optimal model     │
│  - Handle fallbacks         │
│  - Track usage              │
└─────────────┬───────────────┘
              │
              ▼
        Model Request
```

---

## Pre-Implementation Checklist

- [ ] Read: `docs/adr/ADR-0001-tesla-mixed-precision-patterns.md`
- [ ] Verify S3-B7 (Model Tier Config) is complete
- [ ] Verify S3-B8 (Complexity Assessor) is complete
- [ ] Review BYOK key management

---

## TDD Methodology

### Phase 1: RED — Write Failing Tests First

Create `packages/api-client/src/__tests__/adaptive-model-router.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AdaptiveModelRouter,
  RouteRequest,
  RouteResult,
  UsageStats
} from '../model-tiers/adaptive-router';
import { ModelTier, Provider, ModelTierRegistry } from '../model-tiers/config';
import { ComplexityAssessor } from '../model-tiers/complexity-assessor';
import { TaskType } from '@rtv/core/context';

describe('S3-B9: Adaptive Model Router', () => {
  let router: AdaptiveModelRouter;
  let registry: ModelTierRegistry;
  let assessor: ComplexityAssessor;

  beforeEach(() => {
    registry = new ModelTierRegistry();
    assessor = new ComplexityAssessor();
    router = new AdaptiveModelRouter({ registry, assessor });
  });

  describe('Basic Routing', () => {
    it('should route simple task to ECONOMY tier', async () => {
      const result = await router.route({
        clientId: 'client-1',
        taskType: TaskType.ENGAGE_COMMENT,
        contextTokens: 500,
        instructions: 'Say thank you'
      });

      expect(result.success).toBe(true);
      expect(result.selectedTier).toBe(ModelTier.ECONOMY);
    });

    it('should route complex task to PREMIUM tier', async () => {
      const result = await router.route({
        clientId: 'client-1',
        taskType: TaskType.ANALYZE,
        contextTokens: 10000,
        instructions: 'Analyze trends, compare performance, synthesize recommendations'
      });

      expect(result.success).toBe(true);
      expect(result.selectedTier).toBe(ModelTier.PREMIUM);
    });

    it('should return model config in result', async () => {
      const result = await router.route({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write a post'
      });

      expect(result.modelConfig).toBeDefined();
      expect(result.modelConfig.model).toBeDefined();
      expect(result.modelConfig.provider).toBeDefined();
    });
  });

  describe('Budget Awareness', () => {
    beforeEach(() => {
      registry.setClientConfig('budget-client', {
        maxDailyCost: 5.00,
        defaultProvider: Provider.OPENAI
      });
    });

    it('should downgrade tier when approaching budget limit', async () => {
      // Simulate high usage
      router.recordUsage('budget-client', { cost: 4.50, tokens: 100000 });

      const result = await router.route({
        clientId: 'budget-client',
        taskType: TaskType.CREATE_POST,
        contextTokens: 5000,
        instructions: 'Create comprehensive content' // Would normally be PREMIUM
      });

      // Should downgrade due to budget
      expect(result.selectedTier).not.toBe(ModelTier.PREMIUM);
      expect(result.budgetWarning).toBe(true);
    });

    it('should block requests when budget exhausted', async () => {
      router.recordUsage('budget-client', { cost: 5.00, tokens: 150000 });

      const result = await router.route({
        clientId: 'budget-client',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write a post'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('budget');
    });

    it('should allow unlimited budget when not set', async () => {
      // Record massive usage for client without budget limits
      router.recordUsage('unlimited-client', { cost: 1000, tokens: 10000000 });

      const result = await router.route({
        clientId: 'unlimited-client',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write a post'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Provider Selection', () => {
    it('should use client default provider', async () => {
      registry.setClientConfig('anthropic-client', {
        defaultProvider: Provider.ANTHROPIC
      });

      const result = await router.route({
        clientId: 'anthropic-client',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write a post'
      });

      expect(result.modelConfig.provider).toBe(Provider.ANTHROPIC);
    });

    it('should respect provider availability', async () => {
      registry.setClientConfig('openai-only', {
        availableProviders: [Provider.OPENAI]
      });

      const result = await router.route({
        clientId: 'openai-only',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write a post'
      });

      expect(result.modelConfig.provider).toBe(Provider.OPENAI);
    });

    it('should allow provider override in request', async () => {
      const result = await router.route({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write a post',
        preferredProvider: Provider.LOCAL
      });

      expect(result.modelConfig.provider).toBe(Provider.LOCAL);
    });
  });

  describe('Tier Override', () => {
    it('should respect tier override in request', async () => {
      const result = await router.route({
        clientId: 'client-1',
        taskType: TaskType.ENGAGE_COMMENT, // Would normally be ECONOMY
        contextTokens: 500,
        instructions: 'Reply',
        tierOverride: ModelTier.PREMIUM
      });

      expect(result.selectedTier).toBe(ModelTier.PREMIUM);
      expect(result.overrideApplied).toBe(true);
    });

    it('should log tier overrides for analysis', async () => {
      await router.route({
        clientId: 'client-1',
        taskType: TaskType.ENGAGE_COMMENT,
        contextTokens: 500,
        instructions: 'Reply',
        tierOverride: ModelTier.PREMIUM
      });

      const stats = router.getUsageStats('client-1');
      expect(stats.overrideCount).toBeGreaterThan(0);
    });
  });

  describe('Fallback Handling', () => {
    it('should execute fallback chain on primary failure', async () => {
      const mockExecutor = vi.fn()
        .mockRejectedValueOnce(new Error('Rate limited'))
        .mockResolvedValueOnce({ success: true, response: 'Fallback response' });

      const routerWithExecutor = new AdaptiveModelRouter({
        registry,
        assessor,
        executor: mockExecutor
      });

      const result = await routerWithExecutor.routeAndExecute({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write a post',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(mockExecutor).toHaveBeenCalledTimes(2);
    });

    it('should try different provider on fallback', async () => {
      registry.setClientConfig('multi-provider', {
        availableProviders: [Provider.OPENAI, Provider.ANTHROPIC]
      });

      const mockExecutor = vi.fn()
        .mockRejectedValueOnce(new Error('OpenAI error'))
        .mockResolvedValueOnce({ success: true });

      const routerWithExecutor = new AdaptiveModelRouter({
        registry,
        assessor,
        executor: mockExecutor
      });

      await routerWithExecutor.routeAndExecute({
        clientId: 'multi-provider',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write',
        messages: []
      });

      // Should have tried different provider
      const calls = mockExecutor.mock.calls;
      expect(calls[0][0].provider).not.toBe(calls[1][0].provider);
    });

    it('should exhaust fallback chain before failing', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('All failed'));

      const routerWithExecutor = new AdaptiveModelRouter({
        registry,
        assessor,
        executor: mockExecutor
      });

      const result = await routerWithExecutor.routeAndExecute({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write',
        messages: []
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('exhausted');
      expect(mockExecutor.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('Usage Tracking', () => {
    it('should track usage per client', async () => {
      router.recordUsage('client-1', { cost: 0.05, tokens: 1000 });
      router.recordUsage('client-1', { cost: 0.10, tokens: 2000 });

      const stats = router.getUsageStats('client-1');

      expect(stats.totalCost).toBe(0.15);
      expect(stats.totalTokens).toBe(3000);
      expect(stats.requestCount).toBe(2);
    });

    it('should track usage per tier', async () => {
      router.recordUsage('client-1', { 
        cost: 0.10, 
        tokens: 1000, 
        tier: ModelTier.PREMIUM 
      });
      router.recordUsage('client-1', { 
        cost: 0.01, 
        tokens: 500, 
        tier: ModelTier.ECONOMY 
      });

      const stats = router.getUsageStats('client-1');

      expect(stats.byTier[ModelTier.PREMIUM].cost).toBe(0.10);
      expect(stats.byTier[ModelTier.ECONOMY].cost).toBe(0.01);
    });

    it('should reset daily usage', () => {
      router.recordUsage('client-1', { cost: 1.00, tokens: 10000 });
      
      router.resetDailyUsage('client-1');

      const stats = router.getUsageStats('client-1');
      expect(stats.dailyCost).toBe(0);
    });

    it('should track usage by date', () => {
      router.recordUsage('client-1', { cost: 0.50, tokens: 5000 });

      const history = router.getUsageHistory('client-1', 7);

      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].cost).toBe(0.50);
    });
  });

  describe('A/B Testing', () => {
    it('should support experiment enrollment', async () => {
      router.enrollInExperiment('client-1', 'tier-test', {
        control: { tier: ModelTier.STANDARD },
        treatment: { tier: ModelTier.ECONOMY }
      });

      const result = await router.route({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write',
        experimentId: 'tier-test'
      });

      expect([ModelTier.STANDARD, ModelTier.ECONOMY]).toContain(result.selectedTier);
      expect(result.experimentVariant).toBeDefined();
    });

    it('should track experiment outcomes', async () => {
      router.enrollInExperiment('client-1', 'quality-test', {
        control: { tier: ModelTier.STANDARD },
        treatment: { tier: ModelTier.PREMIUM }
      });

      const result = await router.route({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write',
        experimentId: 'quality-test'
      });

      router.recordExperimentOutcome(result.requestId!, {
        success: true,
        qualityScore: 0.9
      });

      const experimentStats = router.getExperimentStats('quality-test');
      expect(experimentStats).toBeDefined();
    });

    it('should consistently assign same variant to client', async () => {
      router.enrollInExperiment('client-1', 'consistent-test', {
        control: { tier: ModelTier.STANDARD },
        treatment: { tier: ModelTier.ECONOMY }
      });

      const results = await Promise.all([
        router.route({ clientId: 'client-1', taskType: TaskType.CREATE_POST, contextTokens: 1000, instructions: 'Write 1', experimentId: 'consistent-test' }),
        router.route({ clientId: 'client-1', taskType: TaskType.CREATE_POST, contextTokens: 1000, instructions: 'Write 2', experimentId: 'consistent-test' }),
        router.route({ clientId: 'client-1', taskType: TaskType.CREATE_POST, contextTokens: 1000, instructions: 'Write 3', experimentId: 'consistent-test' }),
      ]);

      const variants = results.map(r => r.experimentVariant);
      expect(new Set(variants).size).toBe(1); // All same variant
    });
  });

  describe('Latency Optimization', () => {
    it('should prefer lower latency provider when quality equivalent', async () => {
      registry.setClientConfig('latency-sensitive', {
        availableProviders: [Provider.OPENAI, Provider.ANTHROPIC],
        preferLowLatency: true
      });

      // OpenAI generally has lower latency
      const result = await router.route({
        clientId: 'latency-sensitive',
        taskType: TaskType.ENGAGE_COMMENT,
        contextTokens: 500,
        instructions: 'Quick reply',
        latencyPriority: 'high'
      });

      // For simple tasks, should prefer faster provider
      expect(result.latencyOptimized).toBe(true);
    });
  });

  describe('Request Metadata', () => {
    it('should include request ID in result', async () => {
      const result = await router.route({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write'
      });

      expect(result.requestId).toBeDefined();
      expect(typeof result.requestId).toBe('string');
    });

    it('should include complexity score in result', async () => {
      const result = await router.route({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write'
      });

      expect(result.complexityScore).toBeDefined();
      expect(result.complexityScore).toBeGreaterThanOrEqual(0);
      expect(result.complexityScore).toBeLessThanOrEqual(1);
    });

    it('should include estimated cost in result', async () => {
      const result = await router.route({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write',
        expectedOutputTokens: 500
      });

      expect(result.estimatedCost).toBeDefined();
      expect(result.estimatedCost).toBeGreaterThan(0);
    });
  });
});
```

---

### Phase 2: GREEN — Implement Minimum Code

Create `packages/api-client/src/model-tiers/adaptive-router.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid';
import { 
  ModelTier, 
  Provider, 
  ModelConfig, 
  ModelTierRegistry,
  estimateCost 
} from './config';
import { ComplexityAssessor, TaskComplexityInput } from './complexity-assessor';
import { TaskType } from '@rtv/core/context';

/**
 * Request for routing.
 */
export interface RouteRequest {
  clientId: string;
  taskType: TaskType | string;
  contextTokens: number;
  instructions: string;
  preferredProvider?: Provider;
  tierOverride?: ModelTier;
  expectedOutputTokens?: number;
  experimentId?: string;
  latencyPriority?: 'low' | 'normal' | 'high';
}

/**
 * Execute request (includes messages for actual API call).
 */
export interface ExecuteRequest extends RouteRequest {
  messages: Array<{ role: string; content: string }>;
}

/**
 * Result of routing.
 */
export interface RouteResult {
  success: boolean;
  error?: string;
  requestId: string;
  selectedTier: ModelTier;
  modelConfig: ModelConfig;
  complexityScore: number;
  estimatedCost: number;
  budgetWarning?: boolean;
  overrideApplied?: boolean;
  experimentVariant?: string;
  latencyOptimized?: boolean;
  fallbackUsed?: boolean;
}

/**
 * Usage record.
 */
export interface UsageRecord {
  cost: number;
  tokens: number;
  tier?: ModelTier;
  provider?: Provider;
  timestamp?: Date;
}

/**
 * Usage statistics.
 */
export interface UsageStats {
  totalCost: number;
  dailyCost: number;
  totalTokens: number;
  requestCount: number;
  overrideCount: number;
  byTier: Record<ModelTier, { cost: number; tokens: number; count: number }>;
}

/**
 * Experiment configuration.
 */
export interface ExperimentConfig {
  control: { tier?: ModelTier; provider?: Provider };
  treatment: { tier?: ModelTier; provider?: Provider };
}

/**
 * Router configuration.
 */
export interface AdaptiveRouterConfig {
  registry: ModelTierRegistry;
  assessor: ComplexityAssessor;
  executor?: (request: any) => Promise<any>;
}

/**
 * Adaptive Model Router
 * 
 * Intelligently routes requests to optimal model based on
 * complexity, budget, and availability.
 */
export class AdaptiveModelRouter {
  private registry: ModelTierRegistry;
  private assessor: ComplexityAssessor;
  private executor?: (request: any) => Promise<any>;
  
  private usageByClient: Map<string, UsageRecord[]> = new Map();
  private experiments: Map<string, ExperimentConfig> = new Map();
  private clientVariants: Map<string, Map<string, string>> = new Map();
  private experimentOutcomes: Map<string, any[]> = new Map();

  constructor(config: AdaptiveRouterConfig) {
    this.registry = config.registry;
    this.assessor = config.assessor;
    this.executor = config.executor;
  }

  /**
   * Route a request to optimal model.
   */
  async route(request: RouteRequest): Promise<RouteResult> {
    const requestId = uuidv4();

    try {
      // Assess complexity
      const complexity = await this.assessor.assess({
        taskType: request.taskType as TaskType,
        contextTokens: request.contextTokens,
        instructions: request.instructions
      });

      // Determine tier
      let selectedTier = complexity.recommendedTier;
      let overrideApplied = false;

      // Apply tier override if specified
      if (request.tierOverride) {
        selectedTier = request.tierOverride;
        overrideApplied = true;
      }

      // Apply experiment variant if enrolled
      let experimentVariant: string | undefined;
      if (request.experimentId) {
        const variant = this.getExperimentVariant(request.clientId, request.experimentId);
        if (variant) {
          experimentVariant = variant.name;
          if (variant.config.tier) {
            selectedTier = variant.config.tier;
          }
        }
      }

      // Check budget
      const clientConfig = this.registry.getClientConfig(request.clientId);
      const budgetCheck = this.checkBudget(request.clientId, clientConfig);
      
      if (!budgetCheck.allowed) {
        return {
          success: false,
          error: `Daily budget exhausted: ${budgetCheck.reason}`,
          requestId,
          selectedTier,
          modelConfig: {} as ModelConfig,
          complexityScore: complexity.overall,
          estimatedCost: 0
        };
      }

      // Downgrade tier if approaching budget limit
      let budgetWarning = false;
      if (budgetCheck.warning) {
        budgetWarning = true;
        if (selectedTier === ModelTier.PREMIUM) {
          selectedTier = ModelTier.STANDARD;
        } else if (selectedTier === ModelTier.STANDARD) {
          selectedTier = ModelTier.ECONOMY;
        }
      }

      // Determine provider
      const provider = request.preferredProvider ?? clientConfig.defaultProvider ?? Provider.ANTHROPIC;

      // Get model config
      const modelConfig = this.registry.getModelForClient(request.clientId, selectedTier, provider);

      // Estimate cost
      const estimatedCost = estimateCost({
        tier: selectedTier,
        provider,
        inputTokens: request.contextTokens,
        outputTokens: request.expectedOutputTokens ?? 1000
      });

      // Check for latency optimization
      const latencyOptimized = request.latencyPriority === 'high' && 
        selectedTier === ModelTier.ECONOMY;

      return {
        success: true,
        requestId,
        selectedTier,
        modelConfig,
        complexityScore: complexity.overall,
        estimatedCost,
        budgetWarning,
        overrideApplied,
        experimentVariant,
        latencyOptimized
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Routing failed',
        requestId,
        selectedTier: ModelTier.STANDARD,
        modelConfig: {} as ModelConfig,
        complexityScore: 0,
        estimatedCost: 0
      };
    }
  }

  /**
   * Route and execute a request with fallback handling.
   */
  async routeAndExecute(request: ExecuteRequest): Promise<RouteResult & { response?: any }> {
    if (!this.executor) {
      throw new Error('No executor configured');
    }

    const routeResult = await this.route(request);
    if (!routeResult.success) {
      return { ...routeResult, response: undefined };
    }

    // Build fallback chain
    const fallbackChain = [
      { tier: routeResult.selectedTier, provider: routeResult.modelConfig.provider, model: routeResult.modelConfig.model },
      ...routeResult.modelConfig.fallbackChain
    ];

    let lastError: Error | undefined;
    let fallbackUsed = false;

    for (let i = 0; i < fallbackChain.length; i++) {
      const fallback = fallbackChain[i];
      
      try {
        const response = await this.executor({
          provider: fallback.provider,
          model: fallback.model,
          messages: request.messages,
          maxTokens: routeResult.modelConfig.maxTokens,
          temperature: routeResult.modelConfig.temperature
        });

        return {
          ...routeResult,
          fallbackUsed: i > 0,
          response
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        fallbackUsed = true;
      }
    }

    return {
      ...routeResult,
      success: false,
      error: `Fallback chain exhausted: ${lastError?.message}`,
      fallbackUsed
    };
  }

  /**
   * Check if client is within budget.
   */
  private checkBudget(
    clientId: string, 
    config: ReturnType<ModelTierRegistry['getClientConfig']>
  ): { allowed: boolean; warning?: boolean; reason?: string } {
    if (!config.maxDailyCost) {
      return { allowed: true };
    }

    const stats = this.getUsageStats(clientId);
    
    if (stats.dailyCost >= config.maxDailyCost) {
      return { 
        allowed: false, 
        reason: `Daily cost ${stats.dailyCost.toFixed(2)} >= limit ${config.maxDailyCost.toFixed(2)}` 
      };
    }

    if (stats.dailyCost >= config.maxDailyCost * 0.9) {
      return { allowed: true, warning: true };
    }

    return { allowed: true };
  }

  /**
   * Get experiment variant for client.
   */
  private getExperimentVariant(
    clientId: string, 
    experimentId: string
  ): { name: string; config: { tier?: ModelTier; provider?: Provider } } | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    // Check if client already has a variant
    let clientVariants = this.clientVariants.get(clientId);
    if (!clientVariants) {
      clientVariants = new Map();
      this.clientVariants.set(clientId, clientVariants);
    }

    let variant = clientVariants.get(experimentId);
    if (!variant) {
      // Randomly assign (50/50)
      variant = Math.random() < 0.5 ? 'control' : 'treatment';
      clientVariants.set(experimentId, variant);
    }

    return {
      name: variant,
      config: variant === 'control' ? experiment.control : experiment.treatment
    };
  }

  /**
   * Record usage.
   */
  recordUsage(clientId: string, usage: UsageRecord): void {
    const records = this.usageByClient.get(clientId) ?? [];
    records.push({ ...usage, timestamp: usage.timestamp ?? new Date() });
    this.usageByClient.set(clientId, records);
  }

  /**
   * Get usage statistics for a client.
   */
  getUsageStats(clientId: string): UsageStats {
    const records = this.usageByClient.get(clientId) ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats: UsageStats = {
      totalCost: 0,
      dailyCost: 0,
      totalTokens: 0,
      requestCount: records.length,
      overrideCount: 0,
      byTier: {
        [ModelTier.PREMIUM]: { cost: 0, tokens: 0, count: 0 },
        [ModelTier.STANDARD]: { cost: 0, tokens: 0, count: 0 },
        [ModelTier.ECONOMY]: { cost: 0, tokens: 0, count: 0 }
      }
    };

    for (const record of records) {
      stats.totalCost += record.cost;
      stats.totalTokens += record.tokens;

      if (record.timestamp && record.timestamp >= today) {
        stats.dailyCost += record.cost;
      }

      if (record.tier) {
        stats.byTier[record.tier].cost += record.cost;
        stats.byTier[record.tier].tokens += record.tokens;
        stats.byTier[record.tier].count += 1;
      }
    }

    return stats;
  }

  /**
   * Reset daily usage for a client.
   */
  resetDailyUsage(clientId: string): void {
    const records = this.usageByClient.get(clientId) ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Keep only records from before today
    const filtered = records.filter(r => r.timestamp && r.timestamp < today);
    this.usageByClient.set(clientId, filtered);
  }

  /**
   * Get usage history for a client.
   */
  getUsageHistory(clientId: string, days: number): Array<{ date: Date; cost: number; tokens: number }> {
    const records = this.usageByClient.get(clientId) ?? [];
    const history: Map<string, { cost: number; tokens: number }> = new Map();

    for (const record of records) {
      const date = record.timestamp ?? new Date();
      const key = date.toISOString().split('T')[0];
      
      const existing = history.get(key) ?? { cost: 0, tokens: 0 };
      existing.cost += record.cost;
      existing.tokens += record.tokens;
      history.set(key, existing);
    }

    return Array.from(history.entries())
      .map(([date, data]) => ({ date: new Date(date), ...data }))
      .slice(-days);
  }

  /**
   * Enroll client in experiment.
   */
  enrollInExperiment(clientId: string, experimentId: string, config: ExperimentConfig): void {
    this.experiments.set(experimentId, config);
  }

  /**
   * Record experiment outcome.
   */
  recordExperimentOutcome(requestId: string, outcome: any): void {
    // Store with request ID for later analysis
    const outcomes = this.experimentOutcomes.get(requestId) ?? [];
    outcomes.push(outcome);
    this.experimentOutcomes.set(requestId, outcomes);
  }

  /**
   * Get experiment statistics.
   */
  getExperimentStats(experimentId: string): any {
    // Return aggregated stats for experiment
    return {
      experimentId,
      enrolled: this.clientVariants.size,
      outcomes: this.experimentOutcomes.size
    };
  }
}
```

---

## Acceptance Criteria Checklist

- [ ] `AdaptiveModelRouter` class implemented
- [ ] Integration with `ComplexityAssessor` working
- [ ] Integration with `ModelTierRegistry` working
- [ ] Client budget awareness and enforcement
- [ ] Tier downgrade on budget warning
- [ ] Request blocking on budget exhaustion
- [ ] Fallback chain execution
- [ ] Cross-provider fallback support
- [ ] Usage tracking per client and tier
- [ ] A/B testing enrollment and tracking
- [ ] Request metadata (ID, complexity, cost estimate)

---

## On Completion

```bash
pnpm test packages/api-client/src/__tests__/adaptive-model-router.test.ts
pnpm typecheck
cd tools/orchestrator && pnpm tsx src/cli.ts complete S3-B9
```
