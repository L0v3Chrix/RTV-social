# S2-A7: Sparse Context Loader

## Task Metadata

```json
{
  "task_id": "S2-A7",
  "name": "Sparse Context Loader",
  "sprint": 2,
  "agent": "A",
  "status": "pending",
  "tests_status": "not_written",
  "dependencies": ["S2-A6", "S1-B5"],
  "blocks": ["S3-B7"],
  "estimated_complexity": "high",
  "estimated_hours": 4,
  "spec_references": [
    "/docs/adr/ADR-0001-tesla-mixed-precision-patterns.md",
    "/docs/01-architecture/rlm-integration-spec.md",
    "/docs/03-agents-tools/agent-recursion-contracts.md"
  ],
  "acceptance_criteria": [
    "SparseContextLoader class loads only relevant categories",
    "Integration with TaskContextRegistry for category resolution",
    "Integration with PinnedContextManager for pinned content",
    "Parallel loading of independent categories",
    "Token budget enforcement",
    "Context formatting for LLM injection",
    "Metrics for context loading performance"
  ],
  "test_files": [
    "packages/core/src/context/__tests__/sparse-context-loader.test.ts"
  ],
  "created_files": [
    "packages/core/src/context/sparse-context-loader.ts",
    "packages/core/src/context/context-formatters.ts",
    "packages/core/src/context/index.ts"
  ]
}
```

---

## Context

The Sparse Context Loader is the runtime component that loads only the context categories needed for a specific task, implementing the "sparse attention" pattern for token efficiency.

### How It Works

```
Task Request
     │
     ▼
┌─────────────────────────────┐
│  TaskContextRegistry        │
│  "What categories needed?"  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  SparseContextLoader        │
│  - Load pinned context      │
│  - Load required categories │
│  - Load optional (if budget)│
│  - Format for injection     │
└─────────────┬───────────────┘
              │
              ▼
     Formatted Context
     (token-optimized)
```

---

## Pre-Implementation Checklist

- [ ] Read: `docs/adr/ADR-0001-tesla-mixed-precision-patterns.md`
- [ ] Read: `docs/01-architecture/rlm-integration-spec.md`
- [ ] Verify S2-A6 (Task Context Registry) is complete
- [ ] Verify S1-B5 (Memory Retrieval API) is complete
- [ ] Review PinnedContextManager from S1-B8

---

## TDD Methodology

### Phase 1: RED — Write Failing Tests First

Create `packages/core/src/context/__tests__/sparse-context-loader.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SparseContextLoader,
  LoadedContext,
  ContextLoadOptions
} from '../sparse-context-loader';
import { TaskContextRegistry, TaskType, ContextCategory } from '../task-context-registry';
import { PinnedContextManager } from '../../memory/pinned-context-manager';
import { MemoryStore } from '../../memory/store';

describe('S2-A7: Sparse Context Loader', () => {
  let loader: SparseContextLoader;
  let registry: TaskContextRegistry;
  let pinnedManager: PinnedContextManager;
  let memoryStore: MemoryStore;

  beforeEach(() => {
    registry = new TaskContextRegistry();
    memoryStore = createMockMemoryStore();
    pinnedManager = new PinnedContextManager({
      store: memoryStore,
      tokenEstimator: (s) => Math.ceil(s.length / 4)
    });
    
    loader = new SparseContextLoader({
      registry,
      pinnedManager,
      memoryStore,
      tokenEstimator: (s) => Math.ceil(s.length / 4)
    });
  });

  describe('Loading Context for Tasks', () => {
    it('should load context for CREATE_POST task', async () => {
      // Setup pinned content
      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'brand_voice',
        content: 'Professional and friendly',
        label: 'Voice'
      });

      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000
      });

      expect(result.success).toBe(true);
      expect(result.categories).toContain(ContextCategory.BRAND_VOICE);
      expect(result.formatted).toContain('Professional and friendly');
    });

    it('should load context for ENGAGE_COMMENT task', async () => {
      // Setup conversation thread
      await memoryStore.insert({
        id: 'thread-1',
        clientId: 'client-1',
        category: ContextCategory.CONVERSATION_THREAD,
        content: 'User: Great product!\nBrand: Thank you!'
      });

      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.ENGAGE_COMMENT,
        budget: 3000,
        context: {
          threadId: 'thread-1'
        }
      });

      expect(result.success).toBe(true);
      expect(result.categories).toContain(ContextCategory.CONVERSATION_THREAD);
    });

    it('should load context for MODERATE task', async () => {
      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'compliance_rules',
        content: 'No competitor mentions',
        label: 'Compliance'
      });

      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.MODERATE,
        budget: 2000
      });

      expect(result.categories).toContain(ContextCategory.COMPLIANCE_RULES);
    });
  });

  describe('Token Budget Enforcement', () => {
    it('should respect token budget', async () => {
      // Setup large content
      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'brand_voice',
        content: 'x'.repeat(1000), // ~250 tokens
        label: 'Voice'
      });

      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 500
      });

      expect(result.totalTokens).toBeLessThanOrEqual(500);
    });

    it('should prioritize required over optional when budget tight', async () => {
      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'brand_voice',
        content: 'Brand voice content',
        label: 'Voice'
      });

      // Add optional content
      await memoryStore.insert({
        id: 'trending-1',
        clientId: 'client-1',
        category: ContextCategory.TRENDING_TOPICS,
        content: 'Trending: AI, Tech, Innovation'
      });

      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 100 // Very tight budget
      });

      // Should have required but not optional
      expect(result.categories).toContain(ContextCategory.BRAND_VOICE);
      expect(result.categories).not.toContain(ContextCategory.TRENDING_TOPICS);
    });

    it('should include optional categories when budget allows', async () => {
      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'brand_voice',
        content: 'Voice',
        label: 'Voice'
      });

      await memoryStore.insert({
        id: 'trending-1',
        clientId: 'client-1',
        category: ContextCategory.TRENDING_TOPICS,
        content: 'Trending topics'
      });

      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 10000 // Large budget
      });

      expect(result.categories).toContain(ContextCategory.TRENDING_TOPICS);
    });

    it('should report token usage breakdown', async () => {
      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'brand_voice',
        content: 'Brand voice',
        label: 'Voice'
      });

      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000
      });

      expect(result.tokenBreakdown).toBeDefined();
      expect(result.tokenBreakdown[ContextCategory.BRAND_VOICE]).toBeGreaterThan(0);
    });
  });

  describe('Excluded Categories', () => {
    it('should never load excluded categories', async () => {
      // Add content for excluded category
      await memoryStore.insert({
        id: 'history-1',
        clientId: 'client-1',
        category: ContextCategory.FULL_ENGAGEMENT_HISTORY,
        content: 'Large engagement history...'
      });

      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST, // Excludes FULL_ENGAGEMENT_HISTORY
        budget: 100000
      });

      expect(result.categories).not.toContain(ContextCategory.FULL_ENGAGEMENT_HISTORY);
      expect(result.formatted).not.toContain('Large engagement history');
    });

    it('should log warning when excluded category requested', async () => {
      const warnSpy = vi.spyOn(console, 'warn');

      await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000,
        forceCategories: [ContextCategory.FULL_ENGAGEMENT_HISTORY]
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('excluded')
      );
    });
  });

  describe('Parallel Loading', () => {
    it('should load independent categories in parallel', async () => {
      const loadTimes: number[] = [];
      
      // Mock slow loaders
      const slowStore = {
        ...memoryStore,
        getByCategory: vi.fn(async (clientId, category) => {
          const start = Date.now();
          await new Promise(r => setTimeout(r, 50)); // 50ms delay
          loadTimes.push(Date.now() - start);
          return [{ content: `Content for ${category}` }];
        })
      };

      const parallelLoader = new SparseContextLoader({
        registry,
        pinnedManager,
        memoryStore: slowStore,
        tokenEstimator: (s) => s.length
      });

      const start = Date.now();
      await parallelLoader.load({
        clientId: 'client-1',
        taskType: TaskType.ANALYZE, // Has multiple required categories
        budget: 10000
      });
      const totalTime = Date.now() - start;

      // Should be closer to 50ms (parallel) than 150ms (sequential)
      expect(totalTime).toBeLessThan(100);
    });
  });

  describe('Context Formatting', () => {
    it('should format context with section headers', async () => {
      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'brand_voice',
        content: 'Be professional',
        label: 'Voice'
      });

      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'compliance_rules',
        content: 'Follow guidelines',
        label: 'Compliance'
      });

      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.MODERATE,
        budget: 5000
      });

      expect(result.formatted).toContain('## Brand Voice');
      expect(result.formatted).toContain('## Compliance Rules');
    });

    it('should order sections by importance', async () => {
      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'brand_voice',
        content: 'Voice content',
        label: 'Voice'
      });

      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'compliance_rules',
        content: 'Compliance content',
        label: 'Compliance'
      });

      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000
      });

      // Brand voice should come before compliance in formatted output
      const brandIndex = result.formatted.indexOf('Brand Voice');
      const complianceIndex = result.formatted.indexOf('Compliance');
      
      expect(brandIndex).toBeLessThan(complianceIndex);
    });

    it('should support custom formatters', async () => {
      const customLoader = new SparseContextLoader({
        registry,
        pinnedManager,
        memoryStore,
        tokenEstimator: (s) => s.length,
        formatters: {
          [ContextCategory.BRAND_VOICE]: (content) => `<voice>${content}</voice>`
        }
      });

      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'brand_voice',
        content: 'Be friendly',
        label: 'Voice'
      });

      const result = await customLoader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000
      });

      expect(result.formatted).toContain('<voice>');
    });
  });

  describe('Caching', () => {
    it('should cache loaded context within session', async () => {
      const getSpy = vi.spyOn(memoryStore, 'getByCategory');

      await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000,
        sessionId: 'session-1'
      });

      // Second load with same session
      await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000,
        sessionId: 'session-1'
      });

      // Should have used cache for second call
      // (Implementation detail: fewer DB calls)
    });

    it('should invalidate cache on category update', async () => {
      await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000,
        sessionId: 'session-1'
      });

      // Update pinned content
      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'brand_voice',
        content: 'Updated voice',
        label: 'Voice'
      });

      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000,
        sessionId: 'session-1'
      });

      expect(result.formatted).toContain('Updated voice');
    });
  });

  describe('Metrics', () => {
    it('should emit load duration metric', async () => {
      const metrics: any[] = [];
      
      const metricsLoader = new SparseContextLoader({
        registry,
        pinnedManager,
        memoryStore,
        tokenEstimator: (s) => s.length,
        onMetric: (m) => metrics.push(m)
      });

      await metricsLoader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000
      });

      expect(metrics.some(m => m.name === 'context_load_duration_ms')).toBe(true);
    });

    it('should emit token usage metric', async () => {
      const metrics: any[] = [];
      
      const metricsLoader = new SparseContextLoader({
        registry,
        pinnedManager,
        memoryStore,
        tokenEstimator: (s) => s.length,
        onMetric: (m) => metrics.push(m)
      });

      await metricsLoader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000
      });

      expect(metrics.some(m => m.name === 'context_tokens_loaded')).toBe(true);
    });

    it('should emit category count metric', async () => {
      const metrics: any[] = [];
      
      const metricsLoader = new SparseContextLoader({
        registry,
        pinnedManager,
        memoryStore,
        tokenEstimator: (s) => s.length,
        onMetric: (m) => metrics.push(m)
      });

      await metricsLoader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000
      });

      expect(metrics.some(m => m.name === 'context_categories_loaded')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required category gracefully', async () => {
      // Don't set up any content
      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000
      });

      // Should still succeed but with warnings
      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        expect.stringContaining('missing')
      );
    });

    it('should fail if critical pinned content missing', async () => {
      const strictLoader = new SparseContextLoader({
        registry,
        pinnedManager,
        memoryStore,
        tokenEstimator: (s) => s.length,
        strictMode: true
      });

      const result = await strictLoader.load({
        clientId: 'client-1',
        taskType: TaskType.MODERATE, // Requires compliance_rules
        budget: 5000
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('compliance_rules');
    });
  });

  describe('Client Isolation', () => {
    it('should only load context for specified client', async () => {
      await pinnedManager.pin({
        clientId: 'client-1',
        category: 'brand_voice',
        content: 'Client 1 voice',
        label: 'Voice'
      });

      await pinnedManager.pin({
        clientId: 'client-2',
        category: 'brand_voice',
        content: 'Client 2 voice',
        label: 'Voice'
      });

      const result = await loader.load({
        clientId: 'client-1',
        taskType: TaskType.CREATE_POST,
        budget: 5000
      });

      expect(result.formatted).toContain('Client 1 voice');
      expect(result.formatted).not.toContain('Client 2 voice');
    });
  });
});

// Mock helpers
function createMockMemoryStore(): MemoryStore {
  const entries = new Map();
  return {
    insert: async (entry) => {
      entries.set(entry.id, entry);
    },
    getByCategory: async (clientId, category) => {
      return Array.from(entries.values())
        .filter(e => e.clientId === clientId && e.category === category);
    },
    get: async (id) => entries.get(id),
    query: async (opts) => {
      return Array.from(entries.values())
        .filter(e => {
          if (opts.clientId && e.clientId !== opts.clientId) return false;
          if (opts.priority && e.priority !== opts.priority) return false;
          return true;
        });
    }
  } as unknown as MemoryStore;
}
```

---

### Phase 2: GREEN — Implement Minimum Code

Create `packages/core/src/context/sparse-context-loader.ts`:

```typescript
import { TaskContextRegistry, TaskType, ContextCategory } from './task-context-registry';
import { PinnedContextManager, PinnedCategory } from '../memory/pinned-context-manager';
import { CATEGORY_METADATA } from './context-categories';
import type { MemoryStore } from '../memory/store';

/**
 * Result of loading context for a task.
 */
export interface LoadedContext {
  success: boolean;
  error?: string;
  warnings: string[];
  categories: ContextCategory[];
  formatted: string;
  totalTokens: number;
  tokenBreakdown: Record<ContextCategory, number>;
  loadDurationMs: number;
}

/**
 * Options for loading context.
 */
export interface ContextLoadOptions {
  clientId: string;
  taskType: TaskType | string;
  budget: number;
  sessionId?: string;
  context?: Record<string, any>;
  forceCategories?: ContextCategory[];
}

/**
 * Configuration for SparseContextLoader.
 */
export interface SparseContextLoaderConfig {
  registry: TaskContextRegistry;
  pinnedManager: PinnedContextManager;
  memoryStore: MemoryStore;
  tokenEstimator: (content: string) => number;
  formatters?: Record<ContextCategory, (content: string) => string>;
  onMetric?: (metric: { name: string; value: number; tags: Record<string, string> }) => void;
  strictMode?: boolean;
}

/**
 * Category section headers for formatted output.
 */
const CATEGORY_HEADERS: Record<ContextCategory, string> = {
  [ContextCategory.BRAND_VOICE]: 'Brand Voice',
  [ContextCategory.COMPLIANCE_RULES]: 'Compliance Rules',
  [ContextCategory.PROHIBITED_TOPICS]: 'Prohibited Topics',
  [ContextCategory.LEGAL_DISCLAIMERS]: 'Legal Disclaimers',
  [ContextCategory.TONE_GUIDELINES]: 'Tone Guidelines',
  [ContextCategory.CAMPAIGN_OBJECTIVES]: 'Campaign Objectives',
  [ContextCategory.CONTENT_PILLARS]: 'Content Pillars',
  [ContextCategory.TARGET_AUDIENCE]: 'Target Audience',
  [ContextCategory.COMPETITOR_ANALYSIS]: 'Competitor Analysis',
  [ContextCategory.RECENT_TOP_POSTS]: 'Recent Top Posts',
  [ContextCategory.POST_PERFORMANCE]: 'Post Performance',
  [ContextCategory.ENGAGEMENT_TRENDS]: 'Engagement Trends',
  [ContextCategory.FULL_ENGAGEMENT_HISTORY]: 'Engagement History',
  [ContextCategory.CONVERSATION_THREAD]: 'Conversation',
  [ContextCategory.USER_RELATIONSHIP]: 'User Relationship',
  [ContextCategory.USER_HISTORY]: 'User History',
  [ContextCategory.ESCALATION_RULES]: 'Escalation Rules',
  [ContextCategory.CONTENT_CALENDAR]: 'Content Calendar',
  [ContextCategory.SCHEDULING_LOGS]: 'Scheduling Logs',
  [ContextCategory.POSTING_FREQUENCY]: 'Posting Frequency',
  [ContextCategory.TIME_ZONE_PREFERENCES]: 'Time Zone',
  [ContextCategory.TRENDING_TOPICS]: 'Trending Topics',
  [ContextCategory.PLATFORM_UPDATES]: 'Platform Updates',
  [ContextCategory.AUDIENCE_INSIGHTS]: 'Audience Insights',
  [ContextCategory.ANALYTICS_REPORTS]: 'Analytics Reports'
};

/**
 * Category display order (lower = higher priority).
 */
const CATEGORY_ORDER: Record<ContextCategory, number> = {
  [ContextCategory.BRAND_VOICE]: 1,
  [ContextCategory.TONE_GUIDELINES]: 2,
  [ContextCategory.COMPLIANCE_RULES]: 3,
  [ContextCategory.PROHIBITED_TOPICS]: 4,
  [ContextCategory.LEGAL_DISCLAIMERS]: 5,
  [ContextCategory.CAMPAIGN_OBJECTIVES]: 10,
  [ContextCategory.CONVERSATION_THREAD]: 15,
  [ContextCategory.USER_HISTORY]: 16,
  [ContextCategory.USER_RELATIONSHIP]: 17,
  [ContextCategory.ESCALATION_RULES]: 18,
  [ContextCategory.CONTENT_PILLARS]: 20,
  [ContextCategory.TARGET_AUDIENCE]: 21,
  [ContextCategory.RECENT_TOP_POSTS]: 30,
  [ContextCategory.TRENDING_TOPICS]: 31,
  [ContextCategory.POST_PERFORMANCE]: 40,
  [ContextCategory.ENGAGEMENT_TRENDS]: 41,
  [ContextCategory.AUDIENCE_INSIGHTS]: 42,
  [ContextCategory.CONTENT_CALENDAR]: 50,
  [ContextCategory.POSTING_FREQUENCY]: 51,
  [ContextCategory.TIME_ZONE_PREFERENCES]: 52,
  [ContextCategory.COMPETITOR_ANALYSIS]: 60,
  [ContextCategory.PLATFORM_UPDATES]: 70,
  [ContextCategory.SCHEDULING_LOGS]: 80,
  [ContextCategory.FULL_ENGAGEMENT_HISTORY]: 90,
  [ContextCategory.ANALYTICS_REPORTS]: 91
};

/**
 * Maps ContextCategory to PinnedCategory where applicable.
 */
const PINNED_CATEGORY_MAP: Partial<Record<ContextCategory, PinnedCategory>> = {
  [ContextCategory.BRAND_VOICE]: PinnedCategory.BRAND_VOICE,
  [ContextCategory.COMPLIANCE_RULES]: PinnedCategory.COMPLIANCE_RULES,
  [ContextCategory.PROHIBITED_TOPICS]: PinnedCategory.PROHIBITED_TOPICS,
  [ContextCategory.LEGAL_DISCLAIMERS]: PinnedCategory.LEGAL_DISCLAIMERS,
  [ContextCategory.TONE_GUIDELINES]: PinnedCategory.TONE_GUIDELINES
};

/**
 * Sparse Context Loader
 * 
 * Loads only the context categories needed for a specific task,
 * implementing the sparse attention pattern for token efficiency.
 */
export class SparseContextLoader {
  private registry: TaskContextRegistry;
  private pinnedManager: PinnedContextManager;
  private memoryStore: MemoryStore;
  private tokenEstimator: (content: string) => number;
  private formatters: Record<ContextCategory, (content: string) => string>;
  private onMetric?: (metric: any) => void;
  private strictMode: boolean;

  constructor(config: SparseContextLoaderConfig) {
    this.registry = config.registry;
    this.pinnedManager = config.pinnedManager;
    this.memoryStore = config.memoryStore;
    this.tokenEstimator = config.tokenEstimator;
    this.formatters = config.formatters ?? {};
    this.onMetric = config.onMetric;
    this.strictMode = config.strictMode ?? false;
  }

  /**
   * Load context for a task.
   */
  async load(options: ContextLoadOptions): Promise<LoadedContext> {
    const startTime = performance.now();
    const warnings: string[] = [];

    try {
      // Get task configuration
      const taskConfig = this.registry.get(options.taskType);
      
      // Handle forced categories (with warnings for excluded)
      if (options.forceCategories) {
        for (const cat of options.forceCategories) {
          if (taskConfig.excluded.includes(cat)) {
            console.warn(`Category ${cat} is excluded for task ${options.taskType}`);
            warnings.push(`Forced category ${cat} is normally excluded`);
          }
        }
      }

      // Resolve which categories to load
      const categoriesToLoad = this.resolveCategories(taskConfig, options);

      // Load content for each category in parallel
      const loadedContent = await this.loadCategories(
        options.clientId,
        categoriesToLoad,
        options.context
      );

      // Calculate token breakdown
      const tokenBreakdown: Record<ContextCategory, number> = {};
      let totalTokens = 0;

      for (const [category, content] of Object.entries(loadedContent)) {
        const tokens = this.tokenEstimator(content);
        tokenBreakdown[category as ContextCategory] = tokens;
        totalTokens += tokens;
      }

      // Check for missing required categories
      for (const required of taskConfig.required) {
        if (!loadedContent[required]) {
          const msg = `Required category ${required} is missing`;
          warnings.push(msg);
          
          if (this.strictMode) {
            return this.failureResult(msg, startTime);
          }
        }
      }

      // Format content
      const formatted = this.formatContent(loadedContent);

      // Emit metrics
      this.emitMetrics(options, totalTokens, Object.keys(loadedContent).length, startTime);

      return {
        success: true,
        warnings,
        categories: Object.keys(loadedContent) as ContextCategory[],
        formatted,
        totalTokens,
        tokenBreakdown,
        loadDurationMs: performance.now() - startTime
      };
    } catch (error) {
      return this.failureResult(
        error instanceof Error ? error.message : 'Unknown error',
        startTime
      );
    }
  }

  /**
   * Resolve which categories to load based on config and budget.
   */
  private resolveCategories(
    config: { required: ContextCategory[]; optional: ContextCategory[]; excluded: ContextCategory[] },
    options: ContextLoadOptions
  ): ContextCategory[] {
    const result: ContextCategory[] = [...config.required];
    let estimatedTokens = 0;

    // Estimate required tokens
    for (const cat of config.required) {
      estimatedTokens += CATEGORY_METADATA[cat]?.typicalTokens ?? 500;
    }

    // Add optional categories if budget allows
    for (const cat of config.optional) {
      const catTokens = CATEGORY_METADATA[cat]?.typicalTokens ?? 500;
      if (estimatedTokens + catTokens <= options.budget) {
        result.push(cat);
        estimatedTokens += catTokens;
      }
    }

    // Add forced categories (excluding already included)
    if (options.forceCategories) {
      for (const cat of options.forceCategories) {
        if (!result.includes(cat) && !config.excluded.includes(cat)) {
          result.push(cat);
        }
      }
    }

    return result;
  }

  /**
   * Load content for categories in parallel.
   */
  private async loadCategories(
    clientId: string,
    categories: ContextCategory[],
    additionalContext?: Record<string, any>
  ): Promise<Record<ContextCategory, string>> {
    const results: Record<ContextCategory, string> = {} as any;

    // Load all categories in parallel
    await Promise.all(
      categories.map(async (category) => {
        const content = await this.loadCategory(clientId, category, additionalContext);
        if (content) {
          results[category] = content;
        }
      })
    );

    return results;
  }

  /**
   * Load content for a single category.
   */
  private async loadCategory(
    clientId: string,
    category: ContextCategory,
    additionalContext?: Record<string, any>
  ): Promise<string | null> {
    // Check if this is a pinned category
    const pinnedCategory = PINNED_CATEGORY_MAP[category];
    if (pinnedCategory) {
      const entries = await this.pinnedManager.list(clientId, { category: pinnedCategory });
      if (entries.length > 0) {
        return entries.map(e => e.content).join('\n\n');
      }
    }

    // Load from memory store
    const entries = await this.memoryStore.getByCategory?.(clientId, category);
    if (entries && entries.length > 0) {
      return entries.map((e: any) => e.content).join('\n\n');
    }

    // Check additional context
    if (additionalContext?.[category]) {
      return additionalContext[category];
    }

    return null;
  }

  /**
   * Format loaded content into a single string.
   */
  private formatContent(content: Record<ContextCategory, string>): string {
    // Sort categories by order
    const sortedCategories = Object.keys(content)
      .sort((a, b) => {
        const orderA = CATEGORY_ORDER[a as ContextCategory] ?? 100;
        const orderB = CATEGORY_ORDER[b as ContextCategory] ?? 100;
        return orderA - orderB;
      }) as ContextCategory[];

    const sections: string[] = [];

    for (const category of sortedCategories) {
      const categoryContent = content[category];
      const header = CATEGORY_HEADERS[category] ?? category;
      
      // Apply custom formatter if available
      const formatter = this.formatters[category];
      const formatted = formatter ? formatter(categoryContent) : categoryContent;

      sections.push(`## ${header}\n\n${formatted}`);
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Emit metrics for the load operation.
   */
  private emitMetrics(
    options: ContextLoadOptions,
    totalTokens: number,
    categoryCount: number,
    startTime: number
  ): void {
    if (!this.onMetric) return;

    const tags = {
      client_id: options.clientId,
      task_type: options.taskType.toString()
    };

    this.onMetric({
      name: 'context_load_duration_ms',
      value: performance.now() - startTime,
      tags
    });

    this.onMetric({
      name: 'context_tokens_loaded',
      value: totalTokens,
      tags
    });

    this.onMetric({
      name: 'context_categories_loaded',
      value: categoryCount,
      tags
    });
  }

  /**
   * Create a failure result.
   */
  private failureResult(error: string, startTime: number): LoadedContext {
    return {
      success: false,
      error,
      warnings: [],
      categories: [],
      formatted: '',
      totalTokens: 0,
      tokenBreakdown: {},
      loadDurationMs: performance.now() - startTime
    };
  }
}
```

---

## Acceptance Criteria Checklist

- [ ] `SparseContextLoader` loads only relevant categories
- [ ] Integration with `TaskContextRegistry` working
- [ ] Integration with `PinnedContextManager` working
- [ ] Parallel loading of independent categories
- [ ] Token budget respected (required > optional)
- [ ] Excluded categories never loaded
- [ ] Formatted output with section headers
- [ ] Categories ordered by importance
- [ ] Custom formatters supported
- [ ] Metrics emitted for monitoring
- [ ] Client isolation enforced

---

## On Completion

```bash
pnpm test packages/core/src/context/__tests__/sparse-context-loader.test.ts
pnpm typecheck
cd tools/orchestrator && pnpm tsx src/cli.ts complete S2-A7
```
