# S1-B8: Pinned Context Manager

## Task Metadata

```json
{
  "task_id": "S1-B8",
  "name": "Pinned Context Manager",
  "sprint": 1,
  "agent": "B",
  "status": "pending",
  "tests_status": "not_written",
  "dependencies": ["S1-B6", "S1-B7"],
  "blocks": ["S2-A6"],
  "estimated_complexity": "medium",
  "estimated_hours": 3,
  "spec_references": [
    "/docs/02-schemas/external-memory-schema.md",
    "/docs/adr/ADR-0001-tesla-mixed-precision-patterns.md",
    "/docs/03-agents-tools/agent-recursion-contracts.md"
  ],
  "acceptance_criteria": [
    "PinnedContextManager class implemented",
    "Automatic pinning of brand voice on client creation",
    "Automatic pinning of compliance rules",
    "Budget enforcement with clear error messages",
    "API for listing/managing pinned entries",
    "Integration with RLMEnv context injection"
  ],
  "test_files": [
    "packages/core/src/memory/__tests__/pinned-context-manager.test.ts"
  ],
  "created_files": [
    "packages/core/src/memory/pinned-context-manager.ts",
    "packages/core/src/memory/pinned-categories.ts"
  ]
}
```

---

## Context

The Pinned Context Manager is the high-level API for managing critical context that should never be evicted from memory. This implements the "attention sink" pattern from Tesla's architecture.

### What Gets Pinned?

| Category | Example | Why Critical |
|----------|---------|--------------|
| Brand Voice | "Professional, friendly, avoid jargon" | Every response must match brand |
| Compliance Rules | "Never discuss competitors by name" | Legal/policy requirements |
| Prohibited Topics | "No political content, no health claims" | Risk mitigation |
| Legal Disclaimers | "Results may vary, not financial advice" | Required disclosures |

---

## Pre-Implementation Checklist

- [ ] Read: `docs/adr/ADR-0001-tesla-mixed-precision-patterns.md`
- [ ] Read: `docs/03-agents-tools/agent-recursion-contracts.md`
- [ ] Verify S1-B6 (Memory Priority Schema) is complete
- [ ] Verify S1-B7 (Eviction Engine) is complete
- [ ] Review RLMEnv interface from S1-B1

---

## TDD Methodology

### Phase 1: RED — Write Failing Tests First

Create `packages/core/src/memory/__tests__/pinned-context-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  PinnedContextManager,
  PinnedCategory,
  PinnedEntry
} from '../pinned-context-manager';
import { MemoryPriority } from '../priority';
import { createMockStore } from './test-utils';

describe('S1-B8: Pinned Context Manager', () => {
  let manager: PinnedContextManager;
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
    manager = new PinnedContextManager({
      store,
      defaultBudget: 2000,
      tokenEstimator: (content) => Math.ceil(content.length / 4)
    });
  });

  describe('Pinning Content', () => {
    it('should pin brand voice content', async () => {
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Professional and friendly tone. Avoid technical jargon.',
        label: 'Core Brand Voice'
      });

      expect(result.success).toBe(true);
      expect(result.entry?.priority).toBe(MemoryPriority.PINNED);
      expect(result.entry?.category).toBe(PinnedCategory.BRAND_VOICE);
    });

    it('should pin compliance rules', async () => {
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.COMPLIANCE_RULES,
        content: 'Never mention competitor products by name.',
        label: 'Competitor Policy'
      });

      expect(result.success).toBe(true);
      expect(result.entry?.category).toBe(PinnedCategory.COMPLIANCE_RULES);
    });

    it('should pin prohibited topics', async () => {
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.PROHIBITED_TOPICS,
        content: 'Do not discuss: politics, religion, health claims',
        label: 'Prohibited Topics'
      });

      expect(result.success).toBe(true);
    });

    it('should pin legal disclaimers', async () => {
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.LEGAL_DISCLAIMERS,
        content: 'Results may vary. This is not financial advice.',
        label: 'Standard Disclaimers'
      });

      expect(result.success).toBe(true);
    });

    it('should reject pinning when budget exceeded', async () => {
      // Pin content that uses most of the budget
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'x'.repeat(7000), // ~1750 tokens
        label: 'Large content'
      });

      // Try to pin more
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.COMPLIANCE_RULES,
        content: 'x'.repeat(2000), // ~500 tokens, exceeds remaining
        label: 'Overflow'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('budget');
    });

    it('should track token usage per client', async () => {
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Test content',
        label: 'Test'
      });

      const usage = await manager.getUsage('client-1');

      expect(usage.used).toBeGreaterThan(0);
      expect(usage.remaining).toBeLessThan(usage.total);
      expect(usage.entries).toBe(1);
    });
  });

  describe('Retrieving Pinned Content', () => {
    beforeEach(async () => {
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Brand voice content',
        label: 'Voice'
      });
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.COMPLIANCE_RULES,
        content: 'Compliance content',
        label: 'Compliance'
      });
    });

    it('should list all pinned entries for client', async () => {
      const entries = await manager.list('client-1');

      expect(entries).toHaveLength(2);
      expect(entries.map(e => e.category)).toContain(PinnedCategory.BRAND_VOICE);
      expect(entries.map(e => e.category)).toContain(PinnedCategory.COMPLIANCE_RULES);
    });

    it('should filter by category', async () => {
      const entries = await manager.list('client-1', {
        category: PinnedCategory.BRAND_VOICE
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe(PinnedCategory.BRAND_VOICE);
    });

    it('should get single entry by ID', async () => {
      const all = await manager.list('client-1');
      const entry = await manager.get(all[0].id);

      expect(entry).toBeDefined();
      expect(entry?.content).toBe('Brand voice content');
    });

    it('should return null for non-existent entry', async () => {
      const entry = await manager.get('non-existent-id');
      expect(entry).toBeNull();
    });
  });

  describe('Updating Pinned Content', () => {
    it('should update existing pinned entry', async () => {
      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Original content',
        label: 'Voice'
      });

      const result = await manager.update(entry!.id, {
        content: 'Updated content'
      });

      expect(result.success).toBe(true);
      
      const updated = await manager.get(entry!.id);
      expect(updated?.content).toBe('Updated content');
    });

    it('should enforce budget on update', async () => {
      // Use most of budget
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'x'.repeat(6000),
        label: 'Large'
      });

      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.COMPLIANCE_RULES,
        content: 'Small',
        label: 'Small'
      });

      // Try to make small entry large
      const result = await manager.update(entry!.id, {
        content: 'x'.repeat(4000)
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('budget');
    });

    it('should allow updating label without affecting budget', async () => {
      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Content',
        label: 'Original Label'
      });

      const result = await manager.update(entry!.id, {
        label: 'New Label'
      });

      expect(result.success).toBe(true);
      
      const updated = await manager.get(entry!.id);
      expect(updated?.label).toBe('New Label');
    });
  });

  describe('Unpinning Content', () => {
    it('should remove pinned entry', async () => {
      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Content',
        label: 'Voice'
      });

      const result = await manager.unpin(entry!.id);

      expect(result.success).toBe(true);
      
      const check = await manager.get(entry!.id);
      expect(check).toBeNull();
    });

    it('should free budget when unpinning', async () => {
      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'x'.repeat(4000),
        label: 'Large'
      });

      const beforeUsage = await manager.getUsage('client-1');
      await manager.unpin(entry!.id);
      const afterUsage = await manager.getUsage('client-1');

      expect(afterUsage.used).toBeLessThan(beforeUsage.used);
    });

    it('should handle unpinning non-existent entry gracefully', async () => {
      const result = await manager.unpin('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Context Injection for RLMEnv', () => {
    beforeEach(async () => {
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Be professional',
        label: 'Voice'
      });
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.COMPLIANCE_RULES,
        content: 'No competitor mentions',
        label: 'Compliance'
      });
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.PROHIBITED_TOPICS,
        content: 'No politics',
        label: 'Prohibited'
      });
    });

    it('should format pinned context for injection', async () => {
      const context = await manager.getInjectionContext('client-1');

      expect(context).toContain('## Brand Voice');
      expect(context).toContain('Be professional');
      expect(context).toContain('## Compliance Rules');
      expect(context).toContain('No competitor mentions');
    });

    it('should respect category ordering', async () => {
      const context = await manager.getInjectionContext('client-1');

      // Brand voice should come before compliance
      const brandVoiceIndex = context.indexOf('Brand Voice');
      const complianceIndex = context.indexOf('Compliance Rules');
      
      expect(brandVoiceIndex).toBeLessThan(complianceIndex);
    });

    it('should filter categories for injection', async () => {
      const context = await manager.getInjectionContext('client-1', {
        categories: [PinnedCategory.BRAND_VOICE]
      });

      expect(context).toContain('Brand Voice');
      expect(context).not.toContain('Compliance Rules');
    });

    it('should estimate injection token count', async () => {
      const estimate = await manager.estimateInjectionTokens('client-1');

      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThanOrEqual(2000); // Within budget
    });
  });

  describe('Client Isolation', () => {
    it('should isolate pinned content between clients', async () => {
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Client 1 voice',
        label: 'Voice'
      });

      await manager.pin({
        clientId: 'client-2',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Client 2 voice',
        label: 'Voice'
      });

      const client1Entries = await manager.list('client-1');
      const client2Entries = await manager.list('client-2');

      expect(client1Entries).toHaveLength(1);
      expect(client1Entries[0].content).toBe('Client 1 voice');
      expect(client2Entries).toHaveLength(1);
      expect(client2Entries[0].content).toBe('Client 2 voice');
    });

    it('should not allow accessing other client pinned content', async () => {
      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Secret voice',
        label: 'Voice'
      });

      // Trying to get with wrong client context should fail
      const result = await manager.get(entry!.id, { clientId: 'client-2' });
      expect(result).toBeNull();
    });
  });

  describe('Automatic Pinning on Client Setup', () => {
    it('should auto-pin default compliance rules for new client', async () => {
      await manager.initializeClient('new-client', {
        brandVoice: 'Default professional tone',
        defaultCompliance: true
      });

      const entries = await manager.list('new-client');
      
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.some(e => e.category === PinnedCategory.BRAND_VOICE)).toBe(true);
    });

    it('should not duplicate on re-initialization', async () => {
      await manager.initializeClient('client-1', {
        brandVoice: 'Tone A'
      });

      await manager.initializeClient('client-1', {
        brandVoice: 'Tone B'
      });

      const entries = await manager.list('client-1');
      const brandVoiceEntries = entries.filter(
        e => e.category === PinnedCategory.BRAND_VOICE
      );

      expect(brandVoiceEntries).toHaveLength(1);
    });
  });

  describe('Audit Trail', () => {
    it('should emit event on pin', async () => {
      const events: any[] = [];
      manager.on('pinned', (e) => events.push(e));

      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Content',
        label: 'Voice'
      });

      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('pin');
    });

    it('should emit event on unpin', async () => {
      const events: any[] = [];
      manager.on('unpinned', (e) => events.push(e));

      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Content',
        label: 'Voice'
      });

      await manager.unpin(entry!.id);

      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('unpin');
    });
  });
});
```

---

### Phase 2: GREEN — Implement Minimum Code

Create `packages/core/src/memory/pinned-context-manager.ts`:

```typescript
import { EventEmitter } from 'events';
import { MemoryPriority } from './priority';
import type { MemoryStore } from './store';

/**
 * Categories of pinned content.
 */
export enum PinnedCategory {
  BRAND_VOICE = 'brand_voice',
  COMPLIANCE_RULES = 'compliance_rules',
  PROHIBITED_TOPICS = 'prohibited_topics',
  LEGAL_DISCLAIMERS = 'legal_disclaimers',
  TONE_GUIDELINES = 'tone_guidelines'
}

/**
 * Category display order and headers.
 */
const CATEGORY_CONFIG: Record<PinnedCategory, { order: number; header: string }> = {
  [PinnedCategory.BRAND_VOICE]: { order: 1, header: 'Brand Voice' },
  [PinnedCategory.TONE_GUIDELINES]: { order: 2, header: 'Tone Guidelines' },
  [PinnedCategory.COMPLIANCE_RULES]: { order: 3, header: 'Compliance Rules' },
  [PinnedCategory.PROHIBITED_TOPICS]: { order: 4, header: 'Prohibited Topics' },
  [PinnedCategory.LEGAL_DISCLAIMERS]: { order: 5, header: 'Legal Disclaimers' }
};

/**
 * A pinned memory entry.
 */
export interface PinnedEntry {
  id: string;
  clientId: string;
  category: PinnedCategory;
  content: string;
  label: string;
  tokens: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of a pin operation.
 */
export interface PinResult {
  success: boolean;
  entry?: PinnedEntry;
  error?: string;
}

/**
 * Budget usage summary.
 */
export interface BudgetUsage {
  total: number;
  used: number;
  remaining: number;
  entries: number;
}

/**
 * Configuration for PinnedContextManager.
 */
export interface PinnedContextManagerConfig {
  store: MemoryStore;
  defaultBudget?: number;
  tokenEstimator: (content: string) => number;
}

/**
 * Manages critical context that should never be evicted.
 * 
 * Implements the "attention sink" pattern for preserving
 * brand voice, compliance rules, and other critical context.
 */
export class PinnedContextManager extends EventEmitter {
  private store: MemoryStore;
  private defaultBudget: number;
  private tokenEstimator: (content: string) => number;

  constructor(config: PinnedContextManagerConfig) {
    super();
    this.store = config.store;
    this.defaultBudget = config.defaultBudget ?? 2000;
    this.tokenEstimator = config.tokenEstimator;
  }

  /**
   * Pin content to prevent eviction.
   */
  async pin(params: {
    clientId: string;
    category: PinnedCategory;
    content: string;
    label: string;
  }): Promise<PinResult> {
    const { clientId, category, content, label } = params;
    const tokens = this.tokenEstimator(content);

    // Check budget
    const usage = await this.getUsage(clientId);
    if (usage.used + tokens > usage.total) {
      return {
        success: false,
        error: `Exceeds pinned budget: ${usage.used + tokens}/${usage.total} tokens`
      };
    }

    // Create entry
    const entry: PinnedEntry = {
      id: `pinned-${clientId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      clientId,
      category,
      content,
      label,
      tokens,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store with PINNED priority
    await this.store.insert({
      id: entry.id,
      clientId,
      content,
      priority: MemoryPriority.PINNED,
      tokens,
      metadata: {
        category,
        label,
        type: 'pinned_context'
      }
    });

    this.emit('pinned', {
      action: 'pin',
      entry,
      timestamp: new Date()
    });

    return { success: true, entry };
  }

  /**
   * Get budget usage for a client.
   */
  async getUsage(clientId: string): Promise<BudgetUsage> {
    const entries = await this.list(clientId);
    const used = entries.reduce((sum, e) => sum + e.tokens, 0);

    return {
      total: this.defaultBudget,
      used,
      remaining: this.defaultBudget - used,
      entries: entries.length
    };
  }

  /**
   * List pinned entries for a client.
   */
  async list(
    clientId: string, 
    options?: { category?: PinnedCategory }
  ): Promise<PinnedEntry[]> {
    const raw = await this.store.query({
      clientId,
      priority: MemoryPriority.PINNED,
      metadata: options?.category ? { category: options.category } : undefined
    });

    return raw.map(this.toPinnedEntry).filter(Boolean) as PinnedEntry[];
  }

  /**
   * Get a single pinned entry.
   */
  async get(
    id: string, 
    options?: { clientId?: string }
  ): Promise<PinnedEntry | null> {
    const raw = await this.store.get(id);
    
    if (!raw) return null;
    if (options?.clientId && raw.clientId !== options.clientId) return null;
    if (raw.priority !== MemoryPriority.PINNED) return null;

    return this.toPinnedEntry(raw);
  }

  /**
   * Update a pinned entry.
   */
  async update(
    id: string, 
    updates: { content?: string; label?: string }
  ): Promise<PinResult> {
    const existing = await this.get(id);
    if (!existing) {
      return { success: false, error: 'Entry not found' };
    }

    // If updating content, check budget
    if (updates.content) {
      const newTokens = this.tokenEstimator(updates.content);
      const usage = await this.getUsage(existing.clientId);
      const adjustedUsed = usage.used - existing.tokens + newTokens;

      if (adjustedUsed > usage.total) {
        return {
          success: false,
          error: `Update exceeds budget: ${adjustedUsed}/${usage.total} tokens`
        };
      }
    }

    await this.store.update(id, {
      content: updates.content,
      tokens: updates.content ? this.tokenEstimator(updates.content) : undefined,
      metadata: updates.label ? { label: updates.label } : undefined,
      updatedAt: new Date()
    });

    const updated = await this.get(id);
    return { success: true, entry: updated ?? undefined };
  }

  /**
   * Remove a pinned entry.
   */
  async unpin(id: string): Promise<PinResult> {
    const existing = await this.get(id);
    if (!existing) {
      return { success: false, error: 'Entry not found' };
    }

    await this.store.delete(id);

    this.emit('unpinned', {
      action: 'unpin',
      entry: existing,
      timestamp: new Date()
    });

    return { success: true };
  }

  /**
   * Get formatted context for RLMEnv injection.
   */
  async getInjectionContext(
    clientId: string,
    options?: { categories?: PinnedCategory[] }
  ): Promise<string> {
    let entries = await this.list(clientId);

    // Filter by categories if specified
    if (options?.categories) {
      entries = entries.filter(e => options.categories!.includes(e.category));
    }

    // Group by category
    const grouped = new Map<PinnedCategory, PinnedEntry[]>();
    for (const entry of entries) {
      const list = grouped.get(entry.category) ?? [];
      list.push(entry);
      grouped.set(entry.category, list);
    }

    // Build output in category order
    const sections: string[] = [];
    const sortedCategories = [...grouped.keys()].sort(
      (a, b) => CATEGORY_CONFIG[a].order - CATEGORY_CONFIG[b].order
    );

    for (const category of sortedCategories) {
      const categoryEntries = grouped.get(category)!;
      const header = CATEGORY_CONFIG[category].header;
      
      sections.push(`## ${header}`);
      for (const entry of categoryEntries) {
        if (entry.label) {
          sections.push(`### ${entry.label}`);
        }
        sections.push(entry.content);
        sections.push('');
      }
    }

    return sections.join('\n').trim();
  }

  /**
   * Estimate tokens for injection context.
   */
  async estimateInjectionTokens(
    clientId: string,
    options?: { categories?: PinnedCategory[] }
  ): Promise<number> {
    const context = await this.getInjectionContext(clientId, options);
    return this.tokenEstimator(context);
  }

  /**
   * Initialize client with default pinned content.
   */
  async initializeClient(
    clientId: string,
    defaults: {
      brandVoice?: string;
      defaultCompliance?: boolean;
    }
  ): Promise<void> {
    const existing = await this.list(clientId);

    // Only add brand voice if none exists
    if (defaults.brandVoice && !existing.some(e => e.category === PinnedCategory.BRAND_VOICE)) {
      await this.pin({
        clientId,
        category: PinnedCategory.BRAND_VOICE,
        content: defaults.brandVoice,
        label: 'Default Brand Voice'
      });
    }

    // Add default compliance if requested and none exists
    if (defaults.defaultCompliance && !existing.some(e => e.category === PinnedCategory.COMPLIANCE_RULES)) {
      await this.pin({
        clientId,
        category: PinnedCategory.COMPLIANCE_RULES,
        content: 'Follow all platform terms of service. Do not make false claims. Respect user privacy.',
        label: 'Default Compliance'
      });
    }
  }

  /**
   * Convert raw store entry to PinnedEntry.
   */
  private toPinnedEntry(raw: any): PinnedEntry | null {
    if (!raw.metadata?.category) return null;

    return {
      id: raw.id,
      clientId: raw.clientId,
      category: raw.metadata.category as PinnedCategory,
      content: raw.content,
      label: raw.metadata.label ?? '',
      tokens: raw.tokens ?? 0,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt ?? raw.createdAt
    };
  }
}
```

---

## Acceptance Criteria Checklist

- [ ] `PinnedContextManager` class implemented with full API
- [ ] `PinnedCategory` enum with all category types
- [ ] `pin()` creates entries with PINNED priority
- [ ] Budget enforcement on pin and update
- [ ] `list()` returns all pinned entries for client
- [ ] `get()` retrieves single entry with client isolation
- [ ] `update()` modifies content/label with budget check
- [ ] `unpin()` removes entry and frees budget
- [ ] `getInjectionContext()` formats for RLMEnv
- [ ] `initializeClient()` sets up defaults
- [ ] Audit events emitted for pin/unpin

---

## On Completion

```bash
pnpm test packages/core/src/memory/__tests__/pinned-context-manager.test.ts
pnpm typecheck
cd tools/orchestrator && pnpm tsx src/cli.ts complete S1-B8
```
