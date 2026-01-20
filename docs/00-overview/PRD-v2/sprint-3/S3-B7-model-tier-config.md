# S3-B7: Model Tier Configuration

## Task Metadata

```json
{
  "task_id": "S3-B7",
  "name": "Model Tier Configuration",
  "sprint": 3,
  "agent": "B",
  "status": "pending",
  "tests_status": "not_written",
  "dependencies": ["S3-B1", "S2-A7"],
  "blocks": ["S3-B8", "S3-B9"],
  "estimated_complexity": "medium",
  "estimated_hours": 3,
  "spec_references": [
    "/docs/adr/ADR-0001-tesla-mixed-precision-patterns.md",
    "/docs/01-architecture/system-architecture-v3.md",
    "/docs/05-policy-safety/multi-tenant-isolation.md"
  ],
  "acceptance_criteria": [
    "ModelTier enum with PREMIUM, STANDARD, ECONOMY levels",
    "ModelConfig interface with provider-specific settings",
    "Tier-to-model mapping for OpenAI, Anthropic, local",
    "Client-specific tier overrides",
    "Cost estimation per tier",
    "Capability matrix per tier"
  ],
  "test_files": [
    "packages/api-client/src/__tests__/model-tier-config.test.ts"
  ],
  "created_files": [
    "packages/api-client/src/model-tiers/config.ts",
    "packages/api-client/src/model-tiers/providers.ts",
    "packages/api-client/src/model-tiers/capabilities.ts"
  ]
}
```

---

## Context

Model Tier Configuration implements the "quantization-aware" pattern from Tesla's architecture: designing workflows that expect model tier constraints, enabling intelligent cost/quality tradeoffs.

### Why Model Tiers?

| Tier | Use Case | Cost | Quality |
|------|----------|------|---------|
| **PREMIUM** | Complex reasoning, brand calibration | $$$ | Highest |
| **STANDARD** | General tasks, content creation | $$ | High |
| **ECONOMY** | High-volume simple tasks, engagement | $ | Good |

### BYOK Integration

RTV supports Bring Your Own Keys (BYOK), meaning clients provide their own API keys. Model tier configuration must respect:
- Client's available providers
- Client's cost preferences
- Client's quality requirements

---

## Pre-Implementation Checklist

- [ ] Read: `docs/adr/ADR-0001-tesla-mixed-precision-patterns.md`
- [ ] Read: `docs/01-architecture/system-architecture-v3.md`
- [ ] Read: `docs/05-policy-safety/multi-tenant-isolation.md`
- [ ] Verify S3-B1 (Meta Facebook Connector) is complete
- [ ] Verify S2-A7 (Sparse Context Loader) is complete
- [ ] Review BYOK key management from specs

---

## TDD Methodology

### Phase 1: RED — Write Failing Tests First

Create `packages/api-client/src/__tests__/model-tier-config.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ModelTier,
  ModelConfig,
  ModelTierRegistry,
  Provider,
  getModelForTier,
  getTierCapabilities,
  estimateCost
} from '../model-tiers/config';

describe('S3-B7: Model Tier Configuration', () => {
  let registry: ModelTierRegistry;

  beforeEach(() => {
    registry = new ModelTierRegistry();
  });

  describe('ModelTier Enum', () => {
    it('should define PREMIUM tier', () => {
      expect(ModelTier.PREMIUM).toBe('premium');
    });

    it('should define STANDARD tier', () => {
      expect(ModelTier.STANDARD).toBe('standard');
    });

    it('should define ECONOMY tier', () => {
      expect(ModelTier.ECONOMY).toBe('economy');
    });

    it('should have exactly 3 tiers', () => {
      const tiers = Object.values(ModelTier);
      expect(tiers).toHaveLength(3);
    });
  });

  describe('Provider Enum', () => {
    it('should define OpenAI provider', () => {
      expect(Provider.OPENAI).toBe('openai');
    });

    it('should define Anthropic provider', () => {
      expect(Provider.ANTHROPIC).toBe('anthropic');
    });

    it('should define Local provider', () => {
      expect(Provider.LOCAL).toBe('local');
    });
  });

  describe('Model Configuration', () => {
    describe('OpenAI Models', () => {
      it('should map PREMIUM to GPT-4', () => {
        const config = getModelForTier(ModelTier.PREMIUM, Provider.OPENAI);
        expect(config.model).toBe('gpt-4-turbo');
      });

      it('should map STANDARD to GPT-4-mini', () => {
        const config = getModelForTier(ModelTier.STANDARD, Provider.OPENAI);
        expect(config.model).toBe('gpt-4o-mini');
      });

      it('should map ECONOMY to GPT-3.5', () => {
        const config = getModelForTier(ModelTier.ECONOMY, Provider.OPENAI);
        expect(config.model).toBe('gpt-3.5-turbo');
      });
    });

    describe('Anthropic Models', () => {
      it('should map PREMIUM to Claude Opus', () => {
        const config = getModelForTier(ModelTier.PREMIUM, Provider.ANTHROPIC);
        expect(config.model).toContain('opus');
      });

      it('should map STANDARD to Claude Sonnet', () => {
        const config = getModelForTier(ModelTier.STANDARD, Provider.ANTHROPIC);
        expect(config.model).toContain('sonnet');
      });

      it('should map ECONOMY to Claude Haiku', () => {
        const config = getModelForTier(ModelTier.ECONOMY, Provider.ANTHROPIC);
        expect(config.model).toContain('haiku');
      });
    });

    describe('Local Models', () => {
      it('should map PREMIUM to largest local model', () => {
        const config = getModelForTier(ModelTier.PREMIUM, Provider.LOCAL);
        expect(config.model).toBe('llama-3.1-70b');
      });

      it('should map ECONOMY to smallest local model', () => {
        const config = getModelForTier(ModelTier.ECONOMY, Provider.LOCAL);
        expect(config.model).toBe('llama-3.1-8b');
      });
    });
  });

  describe('Model Config Interface', () => {
    it('should include model identifier', () => {
      const config = getModelForTier(ModelTier.PREMIUM, Provider.OPENAI);
      expect(config.model).toBeDefined();
      expect(typeof config.model).toBe('string');
    });

    it('should include max tokens', () => {
      const config = getModelForTier(ModelTier.PREMIUM, Provider.OPENAI);
      expect(config.maxTokens).toBeDefined();
      expect(config.maxTokens).toBeGreaterThan(0);
    });

    it('should include temperature default', () => {
      const config = getModelForTier(ModelTier.STANDARD, Provider.ANTHROPIC);
      expect(config.temperature).toBeDefined();
      expect(config.temperature).toBeGreaterThanOrEqual(0);
      expect(config.temperature).toBeLessThanOrEqual(2);
    });

    it('should include cost per 1K tokens', () => {
      const config = getModelForTier(ModelTier.PREMIUM, Provider.OPENAI);
      expect(config.costPer1kInput).toBeDefined();
      expect(config.costPer1kOutput).toBeDefined();
    });

    it('should include context window size', () => {
      const config = getModelForTier(ModelTier.PREMIUM, Provider.ANTHROPIC);
      expect(config.contextWindow).toBeDefined();
      expect(config.contextWindow).toBeGreaterThan(0);
    });
  });

  describe('Tier Capabilities', () => {
    it('should define capabilities for PREMIUM tier', () => {
      const caps = getTierCapabilities(ModelTier.PREMIUM);
      
      expect(caps.complexReasoning).toBe(true);
      expect(caps.longContext).toBe(true);
      expect(caps.codeGeneration).toBe(true);
      expect(caps.creativeWriting).toBe(true);
    });

    it('should define capabilities for STANDARD tier', () => {
      const caps = getTierCapabilities(ModelTier.STANDARD);
      
      expect(caps.complexReasoning).toBe(true);
      expect(caps.longContext).toBe(true);
      expect(caps.codeGeneration).toBe(true);
      expect(caps.creativeWriting).toBe(true);
    });

    it('should define limited capabilities for ECONOMY tier', () => {
      const caps = getTierCapabilities(ModelTier.ECONOMY);
      
      expect(caps.complexReasoning).toBe(false);
      expect(caps.longContext).toBe(false); // Smaller context window
      expect(caps.codeGeneration).toBe(true);
      expect(caps.creativeWriting).toBe(true);
    });

    it('should include capability descriptions', () => {
      const caps = getTierCapabilities(ModelTier.PREMIUM);
      
      expect(caps.description).toBeDefined();
      expect(caps.description).toContain('premium');
    });
  });

  describe('Cost Estimation', () => {
    it('should estimate cost for request', () => {
      const cost = estimateCost({
        tier: ModelTier.PREMIUM,
        provider: Provider.OPENAI,
        inputTokens: 1000,
        outputTokens: 500
      });

      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    it('should return higher cost for PREMIUM than ECONOMY', () => {
      const premiumCost = estimateCost({
        tier: ModelTier.PREMIUM,
        provider: Provider.OPENAI,
        inputTokens: 1000,
        outputTokens: 500
      });

      const economyCost = estimateCost({
        tier: ModelTier.ECONOMY,
        provider: Provider.OPENAI,
        inputTokens: 1000,
        outputTokens: 500
      });

      expect(premiumCost).toBeGreaterThan(economyCost);
    });

    it('should return $0 for local provider', () => {
      const cost = estimateCost({
        tier: ModelTier.PREMIUM,
        provider: Provider.LOCAL,
        inputTokens: 10000,
        outputTokens: 5000
      });

      expect(cost).toBe(0);
    });

    it('should calculate monthly budget estimate', () => {
      const monthlyEstimate = registry.estimateMonthlyBudget({
        tier: ModelTier.STANDARD,
        provider: Provider.ANTHROPIC,
        requestsPerDay: 100,
        avgInputTokens: 2000,
        avgOutputTokens: 1000
      });

      expect(monthlyEstimate).toBeGreaterThan(0);
      expect(monthlyEstimate).toBeLessThan(10000); // Sanity check
    });
  });

  describe('Registry Configuration', () => {
    it('should list all available tiers', () => {
      const tiers = registry.listTiers();
      expect(tiers).toContain(ModelTier.PREMIUM);
      expect(tiers).toContain(ModelTier.STANDARD);
      expect(tiers).toContain(ModelTier.ECONOMY);
    });

    it('should list all available providers', () => {
      const providers = registry.listProviders();
      expect(providers).toContain(Provider.OPENAI);
      expect(providers).toContain(Provider.ANTHROPIC);
      expect(providers).toContain(Provider.LOCAL);
    });

    it('should get default tier', () => {
      const defaultTier = registry.getDefaultTier();
      expect(defaultTier).toBe(ModelTier.STANDARD);
    });

    it('should get default provider', () => {
      const defaultProvider = registry.getDefaultProvider();
      expect([Provider.OPENAI, Provider.ANTHROPIC]).toContain(defaultProvider);
    });
  });

  describe('Client-Specific Overrides', () => {
    it('should allow client-specific tier defaults', () => {
      registry.setClientConfig('client-premium', {
        defaultTier: ModelTier.PREMIUM,
        defaultProvider: Provider.ANTHROPIC
      });

      const config = registry.getClientConfig('client-premium');
      expect(config.defaultTier).toBe(ModelTier.PREMIUM);
    });

    it('should allow client-specific model overrides', () => {
      registry.setClientConfig('client-custom', {
        modelOverrides: {
          [ModelTier.STANDARD]: {
            provider: Provider.OPENAI,
            model: 'gpt-4-turbo', // Use premium model for standard tier
          }
        }
      });

      const model = registry.getModelForClient('client-custom', ModelTier.STANDARD);
      expect(model.model).toBe('gpt-4-turbo');
    });

    it('should allow client-specific cost limits', () => {
      registry.setClientConfig('client-budget', {
        maxDailyCost: 10.00,
        maxMonthlyCost: 200.00
      });

      const config = registry.getClientConfig('client-budget');
      expect(config.maxDailyCost).toBe(10.00);
      expect(config.maxMonthlyCost).toBe(200.00);
    });

    it('should fall back to defaults for unconfigured clients', () => {
      const config = registry.getClientConfig('unknown-client');
      
      expect(config.defaultTier).toBe(ModelTier.STANDARD);
      expect(config.defaultProvider).toBeDefined();
    });
  });

  describe('Provider Availability', () => {
    it('should check if provider is available for client', () => {
      registry.setClientConfig('client-openai-only', {
        availableProviders: [Provider.OPENAI]
      });

      expect(registry.isProviderAvailable('client-openai-only', Provider.OPENAI)).toBe(true);
      expect(registry.isProviderAvailable('client-openai-only', Provider.ANTHROPIC)).toBe(false);
    });

    it('should default to all providers available', () => {
      expect(registry.isProviderAvailable('new-client', Provider.OPENAI)).toBe(true);
      expect(registry.isProviderAvailable('new-client', Provider.ANTHROPIC)).toBe(true);
    });
  });

  describe('Tier Recommendations', () => {
    it('should recommend tier based on task complexity', () => {
      const recommendation = registry.recommendTier({
        taskType: 'create_post',
        complexity: 'high',
        qualityRequirement: 'premium'
      });

      expect(recommendation.tier).toBe(ModelTier.PREMIUM);
    });

    it('should recommend ECONOMY for simple tasks', () => {
      const recommendation = registry.recommendTier({
        taskType: 'engage_comment',
        complexity: 'low',
        qualityRequirement: 'acceptable'
      });

      expect(recommendation.tier).toBe(ModelTier.ECONOMY);
    });

    it('should include recommendation reasoning', () => {
      const recommendation = registry.recommendTier({
        taskType: 'analyze',
        complexity: 'medium',
        qualityRequirement: 'high'
      });

      expect(recommendation.reasoning).toBeDefined();
      expect(recommendation.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('Model Versioning', () => {
    it('should include model version in config', () => {
      const config = getModelForTier(ModelTier.PREMIUM, Provider.ANTHROPIC);
      expect(config.version).toBeDefined();
    });

    it('should support pinning to specific version', () => {
      registry.setClientConfig('client-pinned', {
        pinnedVersions: {
          [Provider.ANTHROPIC]: 'claude-3-opus-20240229'
        }
      });

      const model = registry.getModelForClient('client-pinned', ModelTier.PREMIUM, Provider.ANTHROPIC);
      expect(model.model).toBe('claude-3-opus-20240229');
    });
  });

  describe('Fallback Configuration', () => {
    it('should define fallback chain', () => {
      const config = getModelForTier(ModelTier.PREMIUM, Provider.OPENAI);
      
      expect(config.fallbackChain).toBeDefined();
      expect(config.fallbackChain.length).toBeGreaterThan(0);
    });

    it('should fallback to lower tier on error', () => {
      const config = getModelForTier(ModelTier.PREMIUM, Provider.OPENAI);
      
      // First fallback should be STANDARD
      expect(config.fallbackChain[0].tier).toBe(ModelTier.STANDARD);
    });

    it('should fallback to different provider if configured', () => {
      registry.setClientConfig('client-multi', {
        availableProviders: [Provider.OPENAI, Provider.ANTHROPIC]
      });

      const config = registry.getModelForClient('client-multi', ModelTier.PREMIUM, Provider.OPENAI);
      
      // Should have cross-provider fallback
      const hasAnthropic = config.fallbackChain.some(f => f.provider === Provider.ANTHROPIC);
      expect(hasAnthropic).toBe(true);
    });
  });
});
```

---

### Phase 2: GREEN — Implement Minimum Code

#### 2.1 Create Config Types

Create `packages/api-client/src/model-tiers/config.ts`:

```typescript
/**
 * Model tier levels.
 */
export enum ModelTier {
  PREMIUM = 'premium',
  STANDARD = 'standard',
  ECONOMY = 'economy'
}

/**
 * LLM providers.
 */
export enum Provider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  LOCAL = 'local'
}

/**
 * Model configuration.
 */
export interface ModelConfig {
  provider: Provider;
  model: string;
  version?: string;
  maxTokens: number;
  temperature: number;
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  fallbackChain: FallbackConfig[];
}

/**
 * Fallback configuration.
 */
export interface FallbackConfig {
  tier: ModelTier;
  provider: Provider;
  model: string;
}

/**
 * Tier capabilities.
 */
export interface TierCapabilities {
  complexReasoning: boolean;
  longContext: boolean;
  codeGeneration: boolean;
  creativeWriting: boolean;
  multimodal: boolean;
  functionCalling: boolean;
  description: string;
}

/**
 * Client-specific configuration.
 */
export interface ClientModelConfig {
  defaultTier?: ModelTier;
  defaultProvider?: Provider;
  availableProviders?: Provider[];
  modelOverrides?: Partial<Record<ModelTier, Partial<ModelConfig>>>;
  pinnedVersions?: Partial<Record<Provider, string>>;
  maxDailyCost?: number;
  maxMonthlyCost?: number;
}

/**
 * Cost estimation parameters.
 */
export interface CostEstimateParams {
  tier: ModelTier;
  provider: Provider;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Monthly budget estimation parameters.
 */
export interface MonthlyBudgetParams {
  tier: ModelTier;
  provider: Provider;
  requestsPerDay: number;
  avgInputTokens: number;
  avgOutputTokens: number;
}

/**
 * Tier recommendation parameters.
 */
export interface TierRecommendationParams {
  taskType: string;
  complexity: 'low' | 'medium' | 'high';
  qualityRequirement: 'acceptable' | 'high' | 'premium';
  budgetConstraint?: number;
}

/**
 * Tier recommendation result.
 */
export interface TierRecommendation {
  tier: ModelTier;
  provider: Provider;
  reasoning: string;
  estimatedCost: number;
}

// Model definitions per tier and provider
const MODEL_CONFIGS: Record<Provider, Record<ModelTier, ModelConfig>> = {
  [Provider.OPENAI]: {
    [ModelTier.PREMIUM]: {
      provider: Provider.OPENAI,
      model: 'gpt-4-turbo',
      version: '2024-04-09',
      maxTokens: 4096,
      temperature: 0.7,
      contextWindow: 128000,
      costPer1kInput: 0.01,
      costPer1kOutput: 0.03,
      fallbackChain: [
        { tier: ModelTier.STANDARD, provider: Provider.OPENAI, model: 'gpt-4o-mini' }
      ]
    },
    [ModelTier.STANDARD]: {
      provider: Provider.OPENAI,
      model: 'gpt-4o-mini',
      version: '2024-07-18',
      maxTokens: 4096,
      temperature: 0.7,
      contextWindow: 128000,
      costPer1kInput: 0.00015,
      costPer1kOutput: 0.0006,
      fallbackChain: [
        { tier: ModelTier.ECONOMY, provider: Provider.OPENAI, model: 'gpt-3.5-turbo' }
      ]
    },
    [ModelTier.ECONOMY]: {
      provider: Provider.OPENAI,
      model: 'gpt-3.5-turbo',
      version: '0125',
      maxTokens: 4096,
      temperature: 0.7,
      contextWindow: 16385,
      costPer1kInput: 0.0005,
      costPer1kOutput: 0.0015,
      fallbackChain: []
    }
  },
  [Provider.ANTHROPIC]: {
    [ModelTier.PREMIUM]: {
      provider: Provider.ANTHROPIC,
      model: 'claude-3-opus-20240229',
      version: '20240229',
      maxTokens: 4096,
      temperature: 0.7,
      contextWindow: 200000,
      costPer1kInput: 0.015,
      costPer1kOutput: 0.075,
      fallbackChain: [
        { tier: ModelTier.STANDARD, provider: Provider.ANTHROPIC, model: 'claude-3-5-sonnet-20241022' }
      ]
    },
    [ModelTier.STANDARD]: {
      provider: Provider.ANTHROPIC,
      model: 'claude-3-5-sonnet-20241022',
      version: '20241022',
      maxTokens: 8192,
      temperature: 0.7,
      contextWindow: 200000,
      costPer1kInput: 0.003,
      costPer1kOutput: 0.015,
      fallbackChain: [
        { tier: ModelTier.ECONOMY, provider: Provider.ANTHROPIC, model: 'claude-3-5-haiku-20241022' }
      ]
    },
    [ModelTier.ECONOMY]: {
      provider: Provider.ANTHROPIC,
      model: 'claude-3-5-haiku-20241022',
      version: '20241022',
      maxTokens: 8192,
      temperature: 0.7,
      contextWindow: 200000,
      costPer1kInput: 0.0008,
      costPer1kOutput: 0.004,
      fallbackChain: []
    }
  },
  [Provider.LOCAL]: {
    [ModelTier.PREMIUM]: {
      provider: Provider.LOCAL,
      model: 'llama-3.1-70b',
      maxTokens: 4096,
      temperature: 0.7,
      contextWindow: 128000,
      costPer1kInput: 0,
      costPer1kOutput: 0,
      fallbackChain: [
        { tier: ModelTier.STANDARD, provider: Provider.LOCAL, model: 'llama-3.1-8b' }
      ]
    },
    [ModelTier.STANDARD]: {
      provider: Provider.LOCAL,
      model: 'llama-3.1-8b',
      maxTokens: 4096,
      temperature: 0.7,
      contextWindow: 128000,
      costPer1kInput: 0,
      costPer1kOutput: 0,
      fallbackChain: [
        { tier: ModelTier.ECONOMY, provider: Provider.LOCAL, model: 'llama-3.1-8b' }
      ]
    },
    [ModelTier.ECONOMY]: {
      provider: Provider.LOCAL,
      model: 'llama-3.1-8b',
      maxTokens: 4096,
      temperature: 0.7,
      contextWindow: 128000,
      costPer1kInput: 0,
      costPer1kOutput: 0,
      fallbackChain: []
    }
  }
};

// Tier capabilities
const TIER_CAPABILITIES: Record<ModelTier, TierCapabilities> = {
  [ModelTier.PREMIUM]: {
    complexReasoning: true,
    longContext: true,
    codeGeneration: true,
    creativeWriting: true,
    multimodal: true,
    functionCalling: true,
    description: 'Premium tier: Best quality, complex reasoning, highest cost'
  },
  [ModelTier.STANDARD]: {
    complexReasoning: true,
    longContext: true,
    codeGeneration: true,
    creativeWriting: true,
    multimodal: true,
    functionCalling: true,
    description: 'Standard tier: High quality, good balance of cost and capability'
  },
  [ModelTier.ECONOMY]: {
    complexReasoning: false,
    longContext: false,
    codeGeneration: true,
    creativeWriting: true,
    multimodal: false,
    functionCalling: true,
    description: 'Economy tier: Good quality for simple tasks, lowest cost'
  }
};

/**
 * Get model configuration for a tier and provider.
 */
export function getModelForTier(tier: ModelTier, provider: Provider): ModelConfig {
  return MODEL_CONFIGS[provider][tier];
}

/**
 * Get capabilities for a tier.
 */
export function getTierCapabilities(tier: ModelTier): TierCapabilities {
  return TIER_CAPABILITIES[tier];
}

/**
 * Estimate cost for a request.
 */
export function estimateCost(params: CostEstimateParams): number {
  const config = getModelForTier(params.tier, params.provider);
  
  const inputCost = (params.inputTokens / 1000) * config.costPer1kInput;
  const outputCost = (params.outputTokens / 1000) * config.costPer1kOutput;
  
  return inputCost + outputCost;
}

/**
 * Model Tier Registry
 * 
 * Manages model tier configurations and client-specific overrides.
 */
export class ModelTierRegistry {
  private clientConfigs: Map<string, ClientModelConfig> = new Map();
  private defaultTier: ModelTier = ModelTier.STANDARD;
  private defaultProvider: Provider = Provider.ANTHROPIC;

  /**
   * List all available tiers.
   */
  listTiers(): ModelTier[] {
    return Object.values(ModelTier);
  }

  /**
   * List all available providers.
   */
  listProviders(): Provider[] {
    return Object.values(Provider);
  }

  /**
   * Get default tier.
   */
  getDefaultTier(): ModelTier {
    return this.defaultTier;
  }

  /**
   * Get default provider.
   */
  getDefaultProvider(): Provider {
    return this.defaultProvider;
  }

  /**
   * Set client-specific configuration.
   */
  setClientConfig(clientId: string, config: ClientModelConfig): void {
    this.clientConfigs.set(clientId, config);
  }

  /**
   * Get client configuration (with defaults).
   */
  getClientConfig(clientId: string): ClientModelConfig {
    const config = this.clientConfigs.get(clientId);
    return {
      defaultTier: config?.defaultTier ?? this.defaultTier,
      defaultProvider: config?.defaultProvider ?? this.defaultProvider,
      availableProviders: config?.availableProviders ?? this.listProviders(),
      modelOverrides: config?.modelOverrides ?? {},
      pinnedVersions: config?.pinnedVersions ?? {},
      maxDailyCost: config?.maxDailyCost,
      maxMonthlyCost: config?.maxMonthlyCost
    };
  }

  /**
   * Get model for a client with overrides applied.
   */
  getModelForClient(
    clientId: string, 
    tier: ModelTier, 
    provider?: Provider
  ): ModelConfig {
    const clientConfig = this.getClientConfig(clientId);
    const effectiveProvider = provider ?? clientConfig.defaultProvider ?? this.defaultProvider;
    
    // Get base config
    let config = { ...getModelForTier(tier, effectiveProvider) };

    // Apply client overrides
    const override = clientConfig.modelOverrides?.[tier];
    if (override) {
      config = { ...config, ...override };
    }

    // Apply pinned version
    const pinnedVersion = clientConfig.pinnedVersions?.[effectiveProvider];
    if (pinnedVersion) {
      config.model = pinnedVersion;
    }

    // Build fallback chain with cross-provider fallbacks
    if (clientConfig.availableProviders && clientConfig.availableProviders.length > 1) {
      const otherProviders = clientConfig.availableProviders.filter(p => p !== effectiveProvider);
      for (const otherProvider of otherProviders) {
        config.fallbackChain.push({
          tier,
          provider: otherProvider,
          model: getModelForTier(tier, otherProvider).model
        });
      }
    }

    return config;
  }

  /**
   * Check if provider is available for client.
   */
  isProviderAvailable(clientId: string, provider: Provider): boolean {
    const config = this.getClientConfig(clientId);
    return config.availableProviders?.includes(provider) ?? true;
  }

  /**
   * Estimate monthly budget.
   */
  estimateMonthlyBudget(params: MonthlyBudgetParams): number {
    const costPerRequest = estimateCost({
      tier: params.tier,
      provider: params.provider,
      inputTokens: params.avgInputTokens,
      outputTokens: params.avgOutputTokens
    });

    return costPerRequest * params.requestsPerDay * 30;
  }

  /**
   * Recommend tier based on task requirements.
   */
  recommendTier(params: TierRecommendationParams): TierRecommendation {
    let tier: ModelTier;
    let reasoning: string;

    // Determine tier based on complexity and quality
    if (params.qualityRequirement === 'premium' || params.complexity === 'high') {
      tier = ModelTier.PREMIUM;
      reasoning = 'High complexity or premium quality requirement → PREMIUM tier';
    } else if (params.complexity === 'low' && params.qualityRequirement === 'acceptable') {
      tier = ModelTier.ECONOMY;
      reasoning = 'Low complexity with acceptable quality → ECONOMY tier for cost savings';
    } else {
      tier = ModelTier.STANDARD;
      reasoning = 'Balanced requirements → STANDARD tier';
    }

    // Check budget constraint
    if (params.budgetConstraint !== undefined) {
      const estimatedCost = estimateCost({
        tier,
        provider: this.defaultProvider,
        inputTokens: 2000,
        outputTokens: 1000
      });

      if (estimatedCost > params.budgetConstraint) {
        // Downgrade tier to fit budget
        if (tier === ModelTier.PREMIUM) {
          tier = ModelTier.STANDARD;
          reasoning += ' (downgraded from PREMIUM due to budget)';
        } else if (tier === ModelTier.STANDARD) {
          tier = ModelTier.ECONOMY;
          reasoning += ' (downgraded from STANDARD due to budget)';
        }
      }
    }

    return {
      tier,
      provider: this.defaultProvider,
      reasoning,
      estimatedCost: estimateCost({
        tier,
        provider: this.defaultProvider,
        inputTokens: 2000,
        outputTokens: 1000
      })
    };
  }
}
```

---

## Acceptance Criteria Checklist

- [ ] `ModelTier` enum with PREMIUM, STANDARD, ECONOMY
- [ ] `Provider` enum with OPENAI, ANTHROPIC, LOCAL
- [ ] `ModelConfig` interface with all required fields
- [ ] Model mappings for all tier/provider combinations
- [ ] `getTierCapabilities()` returns capability matrix
- [ ] `estimateCost()` calculates request cost
- [ ] `ModelTierRegistry` manages configurations
- [ ] Client-specific overrides work
- [ ] `recommendTier()` provides intelligent suggestions
- [ ] Fallback chains configured

---

## On Completion

```bash
pnpm test packages/api-client/src/__tests__/model-tier-config.test.ts
pnpm typecheck
cd tools/orchestrator && pnpm tsx src/cli.ts complete S3-B7
```
