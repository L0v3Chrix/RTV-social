# Build Prompt: S1-B4 — Context Window Management

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-B4 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | B — External Memory Layer |
| **Complexity** | High |
| **Estimated Effort** | 4-5 hours |
| **Dependencies** | S1-B1, S1-B2 |
| **Blocks** | S1-B5 |

---

## Context

### What We're Building

Context Window Management handles the critical task of fitting relevant content into the LLM's context window while respecting token budgets. It provides token counting, content prioritization, truncation strategies, and window composition — assembling the optimal context for each inference step.

### Why This Matters

- **Budget Enforcement**: Never exceed token limits
- **Relevance Ranking**: Most important content fits first
- **Graceful Degradation**: Smart truncation preserves meaning
- **Efficiency**: Minimize tokens while maximizing information

### Spec References

- `/docs/01-architecture/rlm-integration-spec.md` — Token budgets
- `/docs/06-reliability-ops/slo-error-budget.md` — Performance requirements
- `/docs/03-agents-tools/agent-recursion-contracts.md` — Context contracts

**Critical Pattern (from rlm-integration-spec.md):**
> The context window is a "budget" that must be carefully allocated. System prompts, conversation history, retrieved content, and response space all compete for tokens. Context management determines what fits.

---

## Prerequisites

### Completed Tasks

- [x] S1-B1: RLMEnv interface definition
- [x] S1-B2: Summary storage system

### Required Packages

```bash
pnpm add nanoid zod tiktoken
pnpm add -D vitest @types/node
```

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/memory/src/__tests__/context-window.test.ts`**

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import {
  createContextWindow,
  type ContextWindow,
  type ContextSection,
  type TokenCounter,
  createTokenCounter,
} from '../context-window';

describe('Context Window Management', () => {
  let window: ContextWindow;
  let tokenCounter: TokenCounter;

  beforeEach(() => {
    tokenCounter = createTokenCounter('gpt-4');
    window = createContextWindow({
      maxTokens: 8000,
      reservedForResponse: 1000,
      tokenCounter,
    });
  });

  describe('Token Counting', () => {
    test('counts tokens accurately', () => {
      const text = 'Hello, world! This is a test message.';
      const count = tokenCounter.count(text);

      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(20); // Should be around 9 tokens
    });

    test('counts tokens for array of strings', () => {
      const texts = ['Hello', 'World', 'Test'];
      const count = tokenCounter.countMany(texts);

      expect(count).toBeGreaterThan(0);
    });

    test('estimates tokens quickly for large content', () => {
      const largeText = 'word '.repeat(10000);
      const estimate = tokenCounter.estimate(largeText);

      expect(estimate).toBeGreaterThan(5000);
      expect(estimate).toBeLessThan(15000);
    });
  });

  describe('Section Management', () => {
    test('adds section within budget', () => {
      const section: ContextSection = {
        id: 'system',
        type: 'system',
        content: 'You are a helpful assistant.',
        priority: 100,
      };

      const result = window.addSection(section);

      expect(result.added).toBe(true);
      expect(window.getRemainingTokens()).toBeLessThan(7000);
    });

    test('rejects section exceeding budget', () => {
      const largeContent = 'word '.repeat(5000);
      const section: ContextSection = {
        id: 'large',
        type: 'retrieved',
        content: largeContent,
        priority: 50,
      };

      const result = window.addSection(section);

      expect(result.added).toBe(false);
      expect(result.reason).toContain('budget');
    });

    test('replaces existing section with same ID', () => {
      window.addSection({
        id: 'test',
        type: 'system',
        content: 'Version 1',
        priority: 100,
      });

      window.addSection({
        id: 'test',
        type: 'system',
        content: 'Version 2 with more content',
        priority: 100,
      });

      const sections = window.getSections();
      expect(sections.filter((s) => s.id === 'test')).toHaveLength(1);
      expect(sections.find((s) => s.id === 'test')?.content).toContain('Version 2');
    });

    test('removes section by ID', () => {
      window.addSection({
        id: 'to-remove',
        type: 'retrieved',
        content: 'Some content',
        priority: 50,
      });

      const beforeTokens = window.getRemainingTokens();
      window.removeSection('to-remove');
      const afterTokens = window.getRemainingTokens();

      expect(afterTokens).toBeGreaterThan(beforeTokens);
    });
  });

  describe('Priority Management', () => {
    test('higher priority sections added first', () => {
      window.addSection({
        id: 'low',
        type: 'retrieved',
        content: 'Low priority content',
        priority: 10,
      });

      window.addSection({
        id: 'high',
        type: 'system',
        content: 'High priority content',
        priority: 100,
      });

      const sections = window.getSections();
      expect(sections[0].id).toBe('high');
    });

    test('evicts lower priority when budget tight', () => {
      // Fill most of the budget
      window.addSection({
        id: 'filler',
        type: 'retrieved',
        content: 'word '.repeat(1500), // ~1500 tokens
        priority: 30,
      });

      // Add high priority that would exceed budget
      const result = window.addSection({
        id: 'important',
        type: 'system',
        content: 'word '.repeat(200),
        priority: 90,
        evictLowerPriority: true,
      });

      expect(result.added).toBe(true);
      expect(result.evicted?.includes('filler')).toBe(true);
    });
  });

  describe('Truncation', () => {
    test('truncates content to fit budget', () => {
      const longContent = 'This is a sentence. '.repeat(500);

      const truncated = window.truncateToFit(longContent, 100);

      expect(tokenCounter.count(truncated)).toBeLessThanOrEqual(100);
      expect(truncated).toContain('...');
    });

    test('truncates by sentence boundaries', () => {
      const content = 'First sentence. Second sentence. Third sentence. Fourth sentence.';

      const truncated = window.truncateToFit(content, 10, {
        strategy: 'sentence',
      });

      // Should end at a sentence boundary
      expect(truncated.endsWith('.') || truncated.endsWith('...')).toBe(true);
    });

    test('truncates from middle preserving start and end', () => {
      const content = 'Important start content. Middle content here. Important end content.';

      const truncated = window.truncateToFit(content, 15, {
        strategy: 'middle',
      });

      expect(truncated).toContain('Important start');
      expect(truncated).toContain('Important end');
      expect(truncated).toContain('[...]');
    });
  });

  describe('Window Composition', () => {
    test('composes full context string', () => {
      window.addSection({
        id: 'system',
        type: 'system',
        content: 'You are a helpful assistant.',
        priority: 100,
      });

      window.addSection({
        id: 'context',
        type: 'retrieved',
        content: 'Relevant context here.',
        priority: 50,
      });

      window.addSection({
        id: 'history',
        type: 'conversation',
        content: 'User: Hello\nAssistant: Hi there!',
        priority: 80,
      });

      const composed = window.compose();

      expect(composed).toContain('You are a helpful assistant');
      expect(composed).toContain('Relevant context');
      expect(composed).toContain('User: Hello');
    });

    test('respects section separators', () => {
      window.addSection({
        id: 'sec1',
        type: 'system',
        content: 'Section 1',
        priority: 100,
      });

      window.addSection({
        id: 'sec2',
        type: 'retrieved',
        content: 'Section 2',
        priority: 50,
      });

      const composed = window.compose({ separator: '\n---\n' });

      expect(composed).toContain('\n---\n');
    });

    test('compose returns metadata', () => {
      window.addSection({
        id: 'test',
        type: 'system',
        content: 'Test content',
        priority: 100,
      });

      const result = window.composeWithMetadata();

      expect(result.content).toBeDefined();
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.sectionCount).toBe(1);
      expect(result.remainingForResponse).toBe(1000);
    });
  });

  describe('Budget Allocation', () => {
    test('allocates budget to categories', () => {
      const allocation = window.allocateBudget({
        system: 0.1, // 10% for system prompt
        conversation: 0.3, // 30% for history
        retrieved: 0.5, // 50% for retrieved content
        response: 0.1, // 10% reserved for response
      });

      expect(allocation.system).toBeLessThanOrEqual(800);
      expect(allocation.conversation).toBeLessThanOrEqual(2400);
      expect(allocation.retrieved).toBeLessThanOrEqual(4000);
    });

    test('fits content to allocated budget', () => {
      const allocation = window.allocateBudget({
        system: 0.1,
        retrieved: 0.7,
        response: 0.2,
      });

      const longContent = 'word '.repeat(2000);
      const fitted = window.fitToAllocation(longContent, 'retrieved', allocation);

      expect(tokenCounter.count(fitted)).toBeLessThanOrEqual(allocation.retrieved);
    });
  });

  describe('Snapshot and Restore', () => {
    test('creates snapshot of current state', () => {
      window.addSection({
        id: 'test',
        type: 'system',
        content: 'Test content',
        priority: 100,
      });

      const snapshot = window.snapshot();

      expect(snapshot.sections).toHaveLength(1);
      expect(snapshot.usedTokens).toBeGreaterThan(0);
    });

    test('restores from snapshot', () => {
      window.addSection({
        id: 'original',
        type: 'system',
        content: 'Original content',
        priority: 100,
      });

      const snapshot = window.snapshot();

      window.addSection({
        id: 'new',
        type: 'retrieved',
        content: 'New content',
        priority: 50,
      });

      window.restore(snapshot);

      const sections = window.getSections();
      expect(sections).toHaveLength(1);
      expect(sections[0].id).toBe('original');
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Types

**File: `packages/memory/src/context-window/types.ts`**

```typescript
/**
 * Context Window Type Definitions
 *
 * Types for managing LLM context windows and token budgets.
 */

import { z } from 'zod';

// =====================
// Section Types
// =====================

export const SectionTypeSchema = z.enum([
  'system', // System prompt
  'conversation', // Conversation history
  'retrieved', // Retrieved from memory
  'tool_result', // Tool call results
  'instruction', // Dynamic instructions
]);

export type SectionType = z.infer<typeof SectionTypeSchema>;

export const ContextSectionSchema = z.object({
  /** Unique section identifier */
  id: z.string(),

  /** Section type for categorization */
  type: SectionTypeSchema,

  /** Content of the section */
  content: z.string(),

  /** Priority for inclusion (0-100) */
  priority: z.number().min(0).max(100),

  /** Token count (computed) */
  tokenCount: z.number().int().nonnegative().optional(),

  /** Whether to evict lower priority sections if needed */
  evictLowerPriority: z.boolean().optional(),

  /** Metadata for tracking */
  metadata: z.record(z.unknown()).optional(),
});

export type ContextSection = z.infer<typeof ContextSectionSchema>;

// =====================
// Token Counter
// =====================

export interface TokenCounter {
  /** Count exact tokens for text */
  count(text: string): number;

  /** Count tokens for multiple texts */
  countMany(texts: string[]): number;

  /** Fast estimate (less accurate, faster) */
  estimate(text: string): number;

  /** Model name */
  model: string;
}

// =====================
// Truncation
// =====================

export type TruncationStrategy = 'end' | 'sentence' | 'middle' | 'paragraph';

export interface TruncationOptions {
  /** How to truncate */
  strategy?: TruncationStrategy;

  /** Suffix to add when truncated */
  suffix?: string;

  /** For 'middle' strategy, ratio of start to keep */
  startRatio?: number;
}

// =====================
// Budget Allocation
// =====================

export interface BudgetAllocation {
  system: number;
  conversation: number;
  retrieved: number;
  tool_result: number;
  instruction: number;
  response: number;
  [key: string]: number;
}

export type AllocationRatios = Partial<Record<keyof BudgetAllocation, number>>;

// =====================
// Composition
// =====================

export interface ComposeOptions {
  /** Separator between sections */
  separator?: string;

  /** Include section headers */
  includeHeaders?: boolean;

  /** Order override (by section ID) */
  order?: string[];
}

export interface ComposedResult {
  /** Composed content */
  content: string;

  /** Total tokens used */
  totalTokens: number;

  /** Number of sections included */
  sectionCount: number;

  /** Tokens remaining for response */
  remainingForResponse: number;

  /** Sections that were truncated */
  truncatedSections: string[];

  /** Sections that were evicted */
  evictedSections: string[];
}

// =====================
// Snapshot
// =====================

export interface WindowSnapshot {
  /** Sections at snapshot time */
  sections: ContextSection[];

  /** Tokens used at snapshot time */
  usedTokens: number;

  /** Snapshot timestamp */
  createdAt: Date;
}

// =====================
// Add Result
// =====================

export interface AddSectionResult {
  /** Whether section was added */
  added: boolean;

  /** Token count of section */
  tokenCount: number;

  /** Reason if not added */
  reason?: string;

  /** Sections evicted to make room */
  evicted?: string[];

  /** Whether section was truncated */
  truncated?: boolean;
}

// =====================
// Configuration
// =====================

export interface ContextWindowConfig {
  /** Maximum tokens for the window */
  maxTokens: number;

  /** Tokens reserved for response */
  reservedForResponse: number;

  /** Token counter implementation */
  tokenCounter: TokenCounter;

  /** Default truncation strategy */
  defaultTruncation?: TruncationStrategy;
}

// =====================
// Main Interface
// =====================

export interface ContextWindow {
  /** Configuration */
  readonly config: ContextWindowConfig;

  // Section management
  addSection(section: ContextSection): AddSectionResult;
  removeSection(id: string): boolean;
  getSection(id: string): ContextSection | null;
  getSections(): ContextSection[];
  clearSections(): void;

  // Budget
  getRemainingTokens(): number;
  getUsedTokens(): number;
  allocateBudget(ratios: AllocationRatios): BudgetAllocation;
  fitToAllocation(
    content: string,
    category: keyof BudgetAllocation,
    allocation: BudgetAllocation
  ): string;

  // Truncation
  truncateToFit(
    content: string,
    maxTokens: number,
    options?: TruncationOptions
  ): string;

  // Composition
  compose(options?: ComposeOptions): string;
  composeWithMetadata(options?: ComposeOptions): ComposedResult;

  // Snapshot
  snapshot(): WindowSnapshot;
  restore(snapshot: WindowSnapshot): void;
}
```

#### Step 2: Implement Token Counter

**File: `packages/memory/src/context-window/token-counter.ts`**

```typescript
/**
 * Token Counter Implementation
 *
 * Uses tiktoken for accurate counting, with fallback estimation.
 */

import type { TokenCounter } from './types';

// Tiktoken encoding (lazy loaded)
let encodingCache: Map<string, any> = new Map();

async function getEncoding(model: string) {
  if (encodingCache.has(model)) {
    return encodingCache.get(model);
  }

  try {
    // Dynamic import tiktoken
    const { encoding_for_model, get_encoding } = await import('tiktoken');

    try {
      const enc = encoding_for_model(model as any);
      encodingCache.set(model, enc);
      return enc;
    } catch {
      // Fallback to cl100k_base for unknown models
      const enc = get_encoding('cl100k_base');
      encodingCache.set(model, enc);
      return enc;
    }
  } catch {
    // Tiktoken not available, return null
    return null;
  }
}

/**
 * Create a token counter for a specific model
 */
export function createTokenCounter(model: string = 'gpt-4'): TokenCounter {
  let encoding: any = null;
  let initPromise: Promise<void> | null = null;

  // Initialize encoding lazily
  async function ensureEncoding() {
    if (encoding) return;
    if (initPromise) {
      await initPromise;
      return;
    }

    initPromise = (async () => {
      encoding = await getEncoding(model);
    })();

    await initPromise;
  }

  // Synchronous estimation based on character count
  function estimateTokens(text: string): number {
    // Average: ~4 characters per token for English
    // Adjust for code/special characters
    const hasCode = /[{}\[\]();:=<>]/.test(text);
    const ratio = hasCode ? 3 : 4;
    return Math.ceil(text.length / ratio);
  }

  return {
    model,

    count(text: string): number {
      if (encoding) {
        try {
          return encoding.encode(text).length;
        } catch {
          return estimateTokens(text);
        }
      }

      // Synchronous fallback
      return estimateTokens(text);
    },

    countMany(texts: string[]): number {
      return texts.reduce((sum, text) => sum + this.count(text), 0);
    },

    estimate(text: string): number {
      return estimateTokens(text);
    },
  };
}

/**
 * Initialize token counter asynchronously (for accurate counting)
 */
export async function createTokenCounterAsync(
  model: string = 'gpt-4'
): Promise<TokenCounter> {
  const counter = createTokenCounter(model);

  // Pre-initialize encoding
  try {
    const encoding = await getEncoding(model);
    if (encoding) {
      return {
        model,
        count(text: string): number {
          return encoding.encode(text).length;
        },
        countMany(texts: string[]): number {
          return texts.reduce((sum, text) => sum + this.count(text), 0);
        },
        estimate(text: string): number {
          return Math.ceil(text.length / 4);
        },
      };
    }
  } catch {
    // Use synchronous fallback
  }

  return counter;
}
```

#### Step 3: Implement Context Window

**File: `packages/memory/src/context-window/window.ts`**

```typescript
/**
 * Context Window Implementation
 *
 * Manages content fitting into LLM context windows.
 */

import type {
  ContextWindow,
  ContextWindowConfig,
  ContextSection,
  AddSectionResult,
  BudgetAllocation,
  AllocationRatios,
  TruncationOptions,
  TruncationStrategy,
  ComposeOptions,
  ComposedResult,
  WindowSnapshot,
} from './types';

/**
 * Create a new Context Window
 */
export function createContextWindow(config: ContextWindowConfig): ContextWindow {
  const sections = new Map<string, ContextSection>();
  let usedTokens = 0;

  const availableTokens = config.maxTokens - config.reservedForResponse;

  function calculateTokens(content: string): number {
    return config.tokenCounter.count(content);
  }

  function getSortedSections(): ContextSection[] {
    return Array.from(sections.values()).sort((a, b) => b.priority - a.priority);
  }

  const window: ContextWindow = {
    config,

    // Section management
    addSection(section: ContextSection): AddSectionResult {
      const tokenCount = section.tokenCount ?? calculateTokens(section.content);
      const sectionWithTokens = { ...section, tokenCount };

      // Check if replacing existing section
      const existing = sections.get(section.id);
      const existingTokens = existing?.tokenCount ?? 0;

      const netTokens = tokenCount - existingTokens;
      const wouldExceed = usedTokens + netTokens > availableTokens;

      if (wouldExceed) {
        // Try to evict lower priority sections if allowed
        if (section.evictLowerPriority) {
          const evicted = tryEvictForSpace(
            netTokens,
            section.priority,
            section.id
          );

          if (evicted.length > 0) {
            // Remove evicted sections
            for (const id of evicted) {
              const evictedSection = sections.get(id);
              if (evictedSection) {
                usedTokens -= evictedSection.tokenCount ?? 0;
                sections.delete(id);
              }
            }

            // Now add the section
            sections.set(section.id, sectionWithTokens);
            usedTokens += tokenCount;

            return {
              added: true,
              tokenCount,
              evicted,
            };
          }
        }

        return {
          added: false,
          tokenCount,
          reason: `Would exceed budget: need ${netTokens}, have ${availableTokens - usedTokens}`,
        };
      }

      // Update tokens if replacing
      if (existing) {
        usedTokens -= existingTokens;
      }

      sections.set(section.id, sectionWithTokens);
      usedTokens += tokenCount;

      return {
        added: true,
        tokenCount,
      };
    },

    removeSection(id: string): boolean {
      const section = sections.get(id);
      if (!section) return false;

      usedTokens -= section.tokenCount ?? 0;
      sections.delete(id);
      return true;
    },

    getSection(id: string): ContextSection | null {
      return sections.get(id) ?? null;
    },

    getSections(): ContextSection[] {
      return getSortedSections();
    },

    clearSections(): void {
      sections.clear();
      usedTokens = 0;
    },

    // Budget
    getRemainingTokens(): number {
      return availableTokens - usedTokens;
    },

    getUsedTokens(): number {
      return usedTokens;
    },

    allocateBudget(ratios: AllocationRatios): BudgetAllocation {
      const totalRatio = Object.values(ratios).reduce((sum, r) => sum + (r ?? 0), 0);

      if (totalRatio > 1.01) {
        throw new Error(`Budget ratios exceed 100%: ${totalRatio * 100}%`);
      }

      const allocation: BudgetAllocation = {
        system: 0,
        conversation: 0,
        retrieved: 0,
        tool_result: 0,
        instruction: 0,
        response: config.reservedForResponse,
      };

      for (const [key, ratio] of Object.entries(ratios)) {
        if (key === 'response') {
          allocation.response = Math.floor(config.maxTokens * (ratio ?? 0));
        } else {
          allocation[key] = Math.floor(config.maxTokens * (ratio ?? 0));
        }
      }

      return allocation;
    },

    fitToAllocation(
      content: string,
      category: keyof BudgetAllocation,
      allocation: BudgetAllocation
    ): string {
      const maxTokens = allocation[category];
      if (!maxTokens) return content;

      const currentTokens = calculateTokens(content);
      if (currentTokens <= maxTokens) return content;

      return window.truncateToFit(content, maxTokens);
    },

    // Truncation
    truncateToFit(
      content: string,
      maxTokens: number,
      options?: TruncationOptions
    ): string {
      const strategy = options?.strategy ?? config.defaultTruncation ?? 'end';
      const suffix = options?.suffix ?? '...';

      const currentTokens = calculateTokens(content);
      if (currentTokens <= maxTokens) return content;

      switch (strategy) {
        case 'end':
          return truncateFromEnd(content, maxTokens, suffix, config.tokenCounter);

        case 'sentence':
          return truncateBySentence(content, maxTokens, suffix, config.tokenCounter);

        case 'middle':
          return truncateFromMiddle(
            content,
            maxTokens,
            options?.startRatio ?? 0.6,
            config.tokenCounter
          );

        case 'paragraph':
          return truncateByParagraph(content, maxTokens, suffix, config.tokenCounter);

        default:
          return truncateFromEnd(content, maxTokens, suffix, config.tokenCounter);
      }
    },

    // Composition
    compose(options?: ComposeOptions): string {
      const separator = options?.separator ?? '\n\n';
      const sorted = options?.order
        ? options.order
            .map((id) => sections.get(id))
            .filter((s): s is ContextSection => s !== undefined)
        : getSortedSections();

      const parts: string[] = [];

      for (const section of sorted) {
        if (options?.includeHeaders) {
          parts.push(`[${section.type.toUpperCase()}: ${section.id}]`);
        }
        parts.push(section.content);
      }

      return parts.join(separator);
    },

    composeWithMetadata(options?: ComposeOptions): ComposedResult {
      const content = window.compose(options);

      return {
        content,
        totalTokens: usedTokens,
        sectionCount: sections.size,
        remainingForResponse: config.reservedForResponse,
        truncatedSections: [], // Would track if we added truncation tracking
        evictedSections: [],
      };
    },

    // Snapshot
    snapshot(): WindowSnapshot {
      return {
        sections: Array.from(sections.values()),
        usedTokens,
        createdAt: new Date(),
      };
    },

    restore(snapshot: WindowSnapshot): void {
      sections.clear();
      for (const section of snapshot.sections) {
        sections.set(section.id, section);
      }
      usedTokens = snapshot.usedTokens;
    },
  };

  // Helper to find sections to evict
  function tryEvictForSpace(
    neededTokens: number,
    minPriority: number,
    excludeId: string
  ): string[] {
    const candidates = getSortedSections()
      .filter((s) => s.id !== excludeId && s.priority < minPriority)
      .reverse(); // Lowest priority first

    const toEvict: string[] = [];
    let freedTokens = 0;

    for (const section of candidates) {
      toEvict.push(section.id);
      freedTokens += section.tokenCount ?? 0;

      if (freedTokens >= neededTokens) {
        break;
      }
    }

    return freedTokens >= neededTokens ? toEvict : [];
  }

  return window;
}

// =====================
// Truncation Helpers
// =====================

function truncateFromEnd(
  content: string,
  maxTokens: number,
  suffix: string,
  counter: { count: (s: string) => number }
): string {
  const suffixTokens = counter.count(suffix);
  const targetTokens = maxTokens - suffixTokens;

  // Binary search for optimal cut point
  let low = 0;
  let high = content.length;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const slice = content.slice(0, mid);
    const tokens = counter.count(slice);

    if (tokens <= targetTokens) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return content.slice(0, low) + suffix;
}

function truncateBySentence(
  content: string,
  maxTokens: number,
  suffix: string,
  counter: { count: (s: string) => number }
): string {
  const sentences = content.match(/[^.!?]+[.!?]+/g) ?? [content];
  const suffixTokens = counter.count(suffix);
  const targetTokens = maxTokens - suffixTokens;

  let result = '';
  let tokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = counter.count(sentence);
    if (tokens + sentenceTokens > targetTokens) break;

    result += sentence;
    tokens += sentenceTokens;
  }

  if (result.length < content.length) {
    result += suffix;
  }

  return result || content.slice(0, 100) + suffix;
}

function truncateFromMiddle(
  content: string,
  maxTokens: number,
  startRatio: number,
  counter: { count: (s: string) => number }
): string {
  const ellipsis = ' [...] ';
  const ellipsisTokens = counter.count(ellipsis);
  const targetTokens = maxTokens - ellipsisTokens;

  const startTokens = Math.floor(targetTokens * startRatio);
  const endTokens = targetTokens - startTokens;

  // Find start portion
  let startEnd = 0;
  let tokens = 0;
  while (startEnd < content.length && tokens < startTokens) {
    const char = content[startEnd];
    tokens = counter.count(content.slice(0, startEnd + 1));
    startEnd++;
  }

  // Find end portion
  let endStart = content.length;
  tokens = 0;
  while (endStart > 0 && tokens < endTokens) {
    endStart--;
    tokens = counter.count(content.slice(endStart));
  }

  if (startEnd >= endStart) {
    // Content fits
    return content;
  }

  return content.slice(0, startEnd) + ellipsis + content.slice(endStart);
}

function truncateByParagraph(
  content: string,
  maxTokens: number,
  suffix: string,
  counter: { count: (s: string) => number }
): string {
  const paragraphs = content.split(/\n\n+/);
  const suffixTokens = counter.count(suffix);
  const targetTokens = maxTokens - suffixTokens;

  let result = '';
  let tokens = 0;

  for (const para of paragraphs) {
    const paraTokens = counter.count(para + '\n\n');
    if (tokens + paraTokens > targetTokens) break;

    result += para + '\n\n';
    tokens += paraTokens;
  }

  if (result.length < content.length) {
    result = result.trimEnd() + suffix;
  }

  return result || content.slice(0, 100) + suffix;
}
```

#### Step 4: Create Module Index

**File: `packages/memory/src/context-window/index.ts`**

```typescript
/**
 * Context Window Management
 *
 * Token counting, budgeting, truncation, and window composition.
 */

export { createContextWindow } from './window';
export { createTokenCounter, createTokenCounterAsync } from './token-counter';

export type {
  // Configuration
  ContextWindowConfig,
  TokenCounter,

  // Sections
  ContextSection,
  SectionType,
  AddSectionResult,

  // Truncation
  TruncationStrategy,
  TruncationOptions,

  // Budget
  BudgetAllocation,
  AllocationRatios,

  // Composition
  ComposeOptions,
  ComposedResult,

  // Snapshot
  WindowSnapshot,

  // Main interface
  ContextWindow,
} from './types';

export { ContextSectionSchema, SectionTypeSchema } from './types';
```

#### Step 5: Update Main Package Index

**File: `packages/memory/src/index.ts`** (update)

```typescript
/**
 * @rtv/memory - External Memory Layer
 *
 * Provides RLM (Recursive Language Model) environment for agents.
 * Manages span-indexed content, retrieval budgets, and access logging.
 */

export * from './rlm-env';
export * from './summaries';
export * from './references';
export * from './context-window';
```

### Phase 3: Verification

```bash
cd packages/memory

# Install tiktoken
pnpm add tiktoken

# Build
pnpm build

# Typecheck
pnpm typecheck

# Run tests
pnpm test

# Manual verification
cat > verify-context.ts << 'EOF'
import { createContextWindow, createTokenCounter } from './src/context-window';

const counter = createTokenCounter('gpt-4');
const window = createContextWindow({
  maxTokens: 8000,
  reservedForResponse: 1000,
  tokenCounter: counter,
});

// Add sections
window.addSection({
  id: 'system',
  type: 'system',
  content: 'You are a helpful assistant for social media management.',
  priority: 100,
});

window.addSection({
  id: 'context',
  type: 'retrieved',
  content: 'The user has a premium subscription. They manage 3 social accounts.',
  priority: 60,
});

window.addSection({
  id: 'history',
  type: 'conversation',
  content: 'User: How do I schedule a post?\nAssistant: You can...',
  priority: 80,
});

console.log('Used tokens:', window.getUsedTokens());
console.log('Remaining:', window.getRemainingTokens());

const composed = window.composeWithMetadata();
console.log('\nComposed context:');
console.log(composed.content);
console.log('\nMetadata:', {
  totalTokens: composed.totalTokens,
  sectionCount: composed.sectionCount,
  remainingForResponse: composed.remainingForResponse,
});
EOF

npx tsx verify-context.ts
rm verify-context.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/memory/src/context-window/types.ts` | Type definitions |
| Create | `packages/memory/src/context-window/token-counter.ts` | Token counting |
| Create | `packages/memory/src/context-window/window.ts` | Window implementation |
| Create | `packages/memory/src/context-window/index.ts` | Module exports |
| Modify | `packages/memory/src/index.ts` | Add context-window export |
| Create | `packages/memory/src/__tests__/context-window.test.ts` | Unit tests |

---

## Acceptance Criteria

- [ ] `createTokenCounter()` counts tokens accurately
- [ ] `addSection()` respects budget limits
- [ ] `removeSection()` frees tokens
- [ ] Higher priority sections take precedence
- [ ] `truncateToFit()` handles all strategies (end, sentence, middle, paragraph)
- [ ] `compose()` assembles context correctly
- [ ] `allocateBudget()` distributes tokens by ratios
- [ ] `snapshot()` and `restore()` work correctly
- [ ] Tests pass with >80% coverage

---

## Test Requirements

### Unit Tests

- Token counting accuracy
- Section addition/removal
- Priority-based eviction
- All truncation strategies
- Budget allocation
- Snapshot/restore

### Integration Tests

- Large content handling
- Multi-section composition
- Budget exhaustion scenarios

---

## Security & Safety Checklist

- [ ] No sensitive content logged during truncation
- [ ] Token counts don't leak content information
- [ ] Budget limits enforced strictly
- [ ] No infinite loops in truncation

---

## JSON Task Block

```json
{
  "task_id": "S1-B4",
  "name": "Context Window Management",
  "sprint": 1,
  "agent": "B",
  "status": "pending",
  "complexity": "high",
  "estimated_hours": 5,
  "dependencies": ["S1-B1", "S1-B2"],
  "blocks": ["S1-B5"],
  "tags": ["rlm", "memory", "context", "tokens"],
  "acceptance_criteria": [
    "accurate token counting",
    "section management with priorities",
    "multiple truncation strategies",
    "budget allocation",
    "snapshot and restore"
  ],
  "created_at": "2025-01-16T00:00:00Z",
  "updated_at": null,
  "completed_at": null
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "agent_id": null,
  "decisions": [],
  "artifacts": [],
  "notes": []
}
```

---

## Next Steps

After completing this task:

1. **S1-B5**: Implement memory retrieval API
