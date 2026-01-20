# Build Prompt: S1-B2 — Summary Storage System

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-B2 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | B — External Memory Layer |
| **Complexity** | Medium |
| **Estimated Effort** | 3-4 hours |
| **Dependencies** | S1-B1 |
| **Blocks** | S1-B4, S1-B5 |

---

## Context

### What We're Building

The Summary Storage System provides first-class storage for ThreadSummary and PlanSummary objects. In the RLM pattern, summaries are condensed representations of longer content that fit within context budgets. They serve as "table of contents" that agents navigate before retrieving full spans.

### Why This Matters

- **Bounded Context**: Summaries fit in prompt without full content
- **Navigation**: Agents decide what to retrieve based on summaries
- **Compression**: Multi-turn threads compressed to key points
- **Plan Tracking**: Plan summaries show execution progress

### Spec References

- `/docs/01-architecture/rlm-integration-spec.md` — Summary patterns
- `/docs/02-schemas/external-memory-schema.md` — Summary schemas
- `/docs/03-agents-tools/agent-recursion-contracts.md` — Summary contracts

**Critical Pattern (from rlm-integration-spec.md):**
> Summaries are "navigation aids" — they tell the agent what exists without loading it. An agent reads summaries first, then retrieves specific spans when needed.

---

## Prerequisites

### Completed Tasks

- [x] S1-B1: RLMEnv interface definition

### Required Packages

```bash
pnpm add nanoid zod date-fns
pnpm add -D vitest @types/node
```

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/memory/src/__tests__/summaries.test.ts`**

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import {
  createSummaryStore,
  type SummaryStore,
  type ThreadSummary,
  type PlanSummary,
  type SummaryType,
} from '../summaries';

describe('Summary Storage', () => {
  let store: SummaryStore;

  beforeEach(() => {
    store = createSummaryStore();
  });

  describe('ThreadSummary', () => {
    test('creates thread summary with required fields', async () => {
      const summary = await store.createThreadSummary({
        clientId: 'client-123',
        threadId: 'thread-456',
        platform: 'instagram',
        participantCount: 3,
        messageCount: 15,
        keyPoints: ['User asked about pricing', 'Interested in premium plan'],
        sentiment: 'positive',
        lastActivityAt: new Date(),
      });

      expect(summary.id).toBeDefined();
      expect(summary.type).toBe('thread');
      expect(summary.clientId).toBe('client-123');
      expect(summary.keyPoints).toHaveLength(2);
    });

    test('updates thread summary preserves history', async () => {
      const original = await store.createThreadSummary({
        clientId: 'client-123',
        threadId: 'thread-456',
        platform: 'instagram',
        participantCount: 2,
        messageCount: 5,
        keyPoints: ['Initial inquiry'],
        sentiment: 'neutral',
        lastActivityAt: new Date(),
      });

      const updated = await store.updateThreadSummary(original.id, {
        messageCount: 10,
        keyPoints: ['Initial inquiry', 'Follow-up question', 'Price discussion'],
        sentiment: 'positive',
      });

      expect(updated.version).toBe(2);
      expect(updated.messageCount).toBe(10);
      expect(updated.keyPoints).toHaveLength(3);
    });

    test('lists thread summaries by client', async () => {
      await store.createThreadSummary({
        clientId: 'client-123',
        threadId: 'thread-1',
        platform: 'instagram',
        participantCount: 2,
        messageCount: 5,
        keyPoints: ['Point 1'],
        sentiment: 'neutral',
        lastActivityAt: new Date(),
      });

      await store.createThreadSummary({
        clientId: 'client-123',
        threadId: 'thread-2',
        platform: 'facebook',
        participantCount: 3,
        messageCount: 10,
        keyPoints: ['Point 2'],
        sentiment: 'positive',
        lastActivityAt: new Date(),
      });

      await store.createThreadSummary({
        clientId: 'client-other',
        threadId: 'thread-3',
        platform: 'instagram',
        participantCount: 2,
        messageCount: 5,
        keyPoints: ['Other client'],
        sentiment: 'neutral',
        lastActivityAt: new Date(),
      });

      const summaries = await store.listThreadSummaries({
        clientId: 'client-123',
      });

      expect(summaries).toHaveLength(2);
      expect(summaries.every((s) => s.clientId === 'client-123')).toBe(true);
    });

    test('filters thread summaries by platform', async () => {
      await store.createThreadSummary({
        clientId: 'client-123',
        threadId: 'thread-1',
        platform: 'instagram',
        participantCount: 2,
        messageCount: 5,
        keyPoints: ['IG thread'],
        sentiment: 'neutral',
        lastActivityAt: new Date(),
      });

      await store.createThreadSummary({
        clientId: 'client-123',
        threadId: 'thread-2',
        platform: 'facebook',
        participantCount: 2,
        messageCount: 5,
        keyPoints: ['FB thread'],
        sentiment: 'neutral',
        lastActivityAt: new Date(),
      });

      const summaries = await store.listThreadSummaries({
        clientId: 'client-123',
        platform: 'instagram',
      });

      expect(summaries).toHaveLength(1);
      expect(summaries[0].platform).toBe('instagram');
    });
  });

  describe('PlanSummary', () => {
    test('creates plan summary with nodes', async () => {
      const summary = await store.createPlanSummary({
        clientId: 'client-123',
        planId: 'plan-789',
        planType: 'content_calendar',
        totalNodes: 10,
        completedNodes: 3,
        pendingNodes: 5,
        failedNodes: 2,
        keyMilestones: ['Week 1 content approved', 'First post scheduled'],
        currentPhase: 'creation',
        estimatedCompletionAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(summary.id).toBeDefined();
      expect(summary.type).toBe('plan');
      expect(summary.totalNodes).toBe(10);
      expect(summary.completedNodes).toBe(3);
    });

    test('updates plan progress', async () => {
      const original = await store.createPlanSummary({
        clientId: 'client-123',
        planId: 'plan-789',
        planType: 'content_calendar',
        totalNodes: 10,
        completedNodes: 0,
        pendingNodes: 10,
        failedNodes: 0,
        keyMilestones: [],
        currentPhase: 'planning',
      });

      const updated = await store.updatePlanSummary(original.id, {
        completedNodes: 5,
        pendingNodes: 5,
        keyMilestones: ['Halfway complete'],
        currentPhase: 'execution',
      });

      expect(updated.completedNodes).toBe(5);
      expect(updated.currentPhase).toBe('execution');
      expect(updated.version).toBe(2);
    });

    test('lists plan summaries by status', async () => {
      await store.createPlanSummary({
        clientId: 'client-123',
        planId: 'plan-1',
        planType: 'content_calendar',
        totalNodes: 10,
        completedNodes: 10,
        pendingNodes: 0,
        failedNodes: 0,
        keyMilestones: ['Complete'],
        currentPhase: 'completed',
      });

      await store.createPlanSummary({
        clientId: 'client-123',
        planId: 'plan-2',
        planType: 'content_calendar',
        totalNodes: 10,
        completedNodes: 5,
        pendingNodes: 5,
        failedNodes: 0,
        keyMilestones: [],
        currentPhase: 'execution',
      });

      const activePlans = await store.listPlanSummaries({
        clientId: 'client-123',
        status: 'active',
      });

      expect(activePlans).toHaveLength(1);
      expect(activePlans[0].currentPhase).toBe('execution');
    });
  });

  describe('Summary Spans', () => {
    test('generates spans from thread summary', async () => {
      const summary = await store.createThreadSummary({
        clientId: 'client-123',
        threadId: 'thread-456',
        platform: 'instagram',
        participantCount: 3,
        messageCount: 15,
        keyPoints: ['User asked about pricing', 'Interested in premium plan'],
        sentiment: 'positive',
        lastActivityAt: new Date(),
      });

      const spans = await store.getSummarySpans(summary.id);

      expect(spans.length).toBeGreaterThan(0);
      expect(spans[0].sourceType).toBe('thread_summary');
      expect(spans[0].sourceId).toBe(summary.id);
    });

    test('generates spans from plan summary', async () => {
      const summary = await store.createPlanSummary({
        clientId: 'client-123',
        planId: 'plan-789',
        planType: 'content_calendar',
        totalNodes: 10,
        completedNodes: 3,
        pendingNodes: 5,
        failedNodes: 2,
        keyMilestones: ['Week 1 content approved'],
        currentPhase: 'creation',
      });

      const spans = await store.getSummarySpans(summary.id);

      expect(spans.length).toBeGreaterThan(0);
      expect(spans[0].sourceType).toBe('plan_summary');
    });
  });

  describe('Summary Serialization', () => {
    test('toPromptText generates readable summary', async () => {
      const summary = await store.createThreadSummary({
        clientId: 'client-123',
        threadId: 'thread-456',
        platform: 'instagram',
        participantCount: 3,
        messageCount: 15,
        keyPoints: ['User asked about pricing', 'Interested in premium plan'],
        sentiment: 'positive',
        lastActivityAt: new Date(),
      });

      const text = store.toPromptText(summary);

      expect(text).toContain('Thread Summary');
      expect(text).toContain('instagram');
      expect(text).toContain('pricing');
      expect(text).toContain('positive');
    });

    test('toPromptText respects token budget', async () => {
      const summary = await store.createThreadSummary({
        clientId: 'client-123',
        threadId: 'thread-456',
        platform: 'instagram',
        participantCount: 3,
        messageCount: 15,
        keyPoints: Array(20).fill('Very long key point about something important'),
        sentiment: 'positive',
        lastActivityAt: new Date(),
      });

      const text = store.toPromptText(summary, { maxTokens: 100 });

      // Should truncate to fit budget
      expect(text.length).toBeLessThan(500); // ~100 tokens
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Summary Types

**File: `packages/memory/src/summaries/types.ts`**

```typescript
/**
 * Summary Type Definitions
 *
 * Summaries are condensed representations for RLM navigation.
 */

import { z } from 'zod';
import type { Span } from '../rlm-env/types';

// =====================
// Base Summary
// =====================

export type SummaryType = 'thread' | 'plan' | 'episode' | 'knowledge';

export const BaseSummarySchema = z.object({
  /** Unique summary identifier */
  id: z.string(),

  /** Summary type discriminator */
  type: z.enum(['thread', 'plan', 'episode', 'knowledge']),

  /** Client ID for tenant isolation */
  clientId: z.string(),

  /** Version number (increments on update) */
  version: z.number().int().positive(),

  /** Token count of serialized summary */
  tokenCount: z.number().int().positive(),

  /** Creation timestamp */
  createdAt: z.date(),

  /** Last update timestamp */
  updatedAt: z.date(),
});

export type BaseSummary = z.infer<typeof BaseSummarySchema>;

// =====================
// Thread Summary
// =====================

export const SentimentSchema = z.enum([
  'very_negative',
  'negative',
  'neutral',
  'positive',
  'very_positive',
]);

export type Sentiment = z.infer<typeof SentimentSchema>;

export const ThreadSummarySchema = BaseSummarySchema.extend({
  type: z.literal('thread'),

  /** Original thread ID */
  threadId: z.string(),

  /** Platform where thread exists */
  platform: z.enum([
    'instagram',
    'facebook',
    'tiktok',
    'youtube',
    'linkedin',
    'x',
    'skool',
  ]),

  /** Number of participants */
  participantCount: z.number().int().positive(),

  /** Total message count */
  messageCount: z.number().int().nonnegative(),

  /** Key points extracted from thread */
  keyPoints: z.array(z.string()),

  /** Overall sentiment */
  sentiment: SentimentSchema,

  /** Engagement level (0-1) */
  engagementLevel: z.number().min(0).max(1).optional(),

  /** Whether thread requires human attention */
  needsEscalation: z.boolean().optional(),

  /** Escalation reason if applicable */
  escalationReason: z.string().optional(),

  /** Topics discussed */
  topics: z.array(z.string()).optional(),

  /** Last activity timestamp */
  lastActivityAt: z.date(),

  /** Span IDs pointing to full thread content */
  contentSpanIds: z.array(z.string()).optional(),
});

export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;

export type CreateThreadSummaryInput = Omit<
  ThreadSummary,
  'id' | 'type' | 'version' | 'tokenCount' | 'createdAt' | 'updatedAt'
>;

export type UpdateThreadSummaryInput = Partial<
  Omit<ThreadSummary, 'id' | 'type' | 'clientId' | 'threadId' | 'createdAt'>
>;

// =====================
// Plan Summary
// =====================

export const PlanPhaseSchema = z.enum([
  'planning',
  'creation',
  'review',
  'scheduling',
  'execution',
  'completed',
  'failed',
  'cancelled',
]);

export type PlanPhase = z.infer<typeof PlanPhaseSchema>;

export const PlanSummarySchema = BaseSummarySchema.extend({
  type: z.literal('plan'),

  /** Original plan ID */
  planId: z.string(),

  /** Plan type */
  planType: z.enum(['content_calendar', 'campaign', 'engagement', 'ad_spend']),

  /** Total nodes in plan graph */
  totalNodes: z.number().int().nonnegative(),

  /** Completed nodes */
  completedNodes: z.number().int().nonnegative(),

  /** Pending nodes */
  pendingNodes: z.number().int().nonnegative(),

  /** Failed nodes */
  failedNodes: z.number().int().nonnegative(),

  /** Key milestones reached */
  keyMilestones: z.array(z.string()),

  /** Current execution phase */
  currentPhase: PlanPhaseSchema,

  /** Blocking issues */
  blockers: z.array(z.string()).optional(),

  /** Estimated completion date */
  estimatedCompletionAt: z.date().optional(),

  /** Actual completion date */
  completedAt: z.date().optional(),

  /** Span IDs pointing to full plan content */
  contentSpanIds: z.array(z.string()).optional(),
});

export type PlanSummary = z.infer<typeof PlanSummarySchema>;

export type CreatePlanSummaryInput = Omit<
  PlanSummary,
  'id' | 'type' | 'version' | 'tokenCount' | 'createdAt' | 'updatedAt'
>;

export type UpdatePlanSummaryInput = Partial<
  Omit<PlanSummary, 'id' | 'type' | 'clientId' | 'planId' | 'createdAt'>
>;

// =====================
// Store Types
// =====================

export type Summary = ThreadSummary | PlanSummary;

export interface ListThreadSummariesOptions {
  clientId: string;
  platform?: ThreadSummary['platform'];
  needsEscalation?: boolean;
  minSentiment?: Sentiment;
  since?: Date;
  limit?: number;
}

export interface ListPlanSummariesOptions {
  clientId: string;
  planType?: PlanSummary['planType'];
  status?: 'active' | 'completed' | 'failed';
  since?: Date;
  limit?: number;
}

export interface ToPromptTextOptions {
  maxTokens?: number;
  includeMetadata?: boolean;
}

export interface SummaryStore {
  // Thread summaries
  createThreadSummary(input: CreateThreadSummaryInput): Promise<ThreadSummary>;
  getThreadSummary(id: string): Promise<ThreadSummary | null>;
  getThreadSummaryByThreadId(
    clientId: string,
    threadId: string
  ): Promise<ThreadSummary | null>;
  updateThreadSummary(
    id: string,
    input: UpdateThreadSummaryInput
  ): Promise<ThreadSummary>;
  listThreadSummaries(options: ListThreadSummariesOptions): Promise<ThreadSummary[]>;

  // Plan summaries
  createPlanSummary(input: CreatePlanSummaryInput): Promise<PlanSummary>;
  getPlanSummary(id: string): Promise<PlanSummary | null>;
  getPlanSummaryByPlanId(clientId: string, planId: string): Promise<PlanSummary | null>;
  updatePlanSummary(id: string, input: UpdatePlanSummaryInput): Promise<PlanSummary>;
  listPlanSummaries(options: ListPlanSummariesOptions): Promise<PlanSummary[]>;

  // Span generation
  getSummarySpans(summaryId: string): Promise<Span[]>;

  // Serialization
  toPromptText(summary: Summary, options?: ToPromptTextOptions): string;
}
```

#### Step 2: Implement Summary Store

**File: `packages/memory/src/summaries/store.ts`**

```typescript
/**
 * Summary Store Implementation
 *
 * In-memory store for summaries with span generation.
 */

import { nanoid } from 'nanoid';
import type {
  SummaryStore,
  ThreadSummary,
  PlanSummary,
  Summary,
  CreateThreadSummaryInput,
  UpdateThreadSummaryInput,
  CreatePlanSummaryInput,
  UpdatePlanSummaryInput,
  ListThreadSummariesOptions,
  ListPlanSummariesOptions,
  ToPromptTextOptions,
  Sentiment,
} from './types';
import type { Span } from '../rlm-env/types';

const SENTIMENT_ORDER: Sentiment[] = [
  'very_negative',
  'negative',
  'neutral',
  'positive',
  'very_positive',
];

function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ~= 4 characters
  return Math.ceil(text.length / 4);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Create a new Summary Store
 */
export function createSummaryStore(): SummaryStore {
  const threadSummaries = new Map<string, ThreadSummary>();
  const planSummaries = new Map<string, PlanSummary>();

  function serializeThreadSummary(summary: ThreadSummary): string {
    const lines = [
      `## Thread Summary: ${summary.threadId}`,
      `- Platform: ${summary.platform}`,
      `- Participants: ${summary.participantCount}`,
      `- Messages: ${summary.messageCount}`,
      `- Sentiment: ${summary.sentiment}`,
      `- Last Activity: ${summary.lastActivityAt.toISOString()}`,
      '',
      '### Key Points:',
      ...summary.keyPoints.map((p) => `- ${p}`),
    ];

    if (summary.topics?.length) {
      lines.push('', '### Topics:', ...summary.topics.map((t) => `- ${t}`));
    }

    if (summary.needsEscalation) {
      lines.push('', `**NEEDS ESCALATION**: ${summary.escalationReason ?? 'Reason not specified'}`);
    }

    return lines.join('\n');
  }

  function serializePlanSummary(summary: PlanSummary): string {
    const progress = summary.totalNodes > 0
      ? Math.round((summary.completedNodes / summary.totalNodes) * 100)
      : 0;

    const lines = [
      `## Plan Summary: ${summary.planId}`,
      `- Type: ${summary.planType}`,
      `- Phase: ${summary.currentPhase}`,
      `- Progress: ${progress}% (${summary.completedNodes}/${summary.totalNodes} nodes)`,
      `- Pending: ${summary.pendingNodes}, Failed: ${summary.failedNodes}`,
      '',
      '### Milestones:',
      ...summary.keyMilestones.map((m) => `- ${m}`),
    ];

    if (summary.blockers?.length) {
      lines.push('', '### Blockers:', ...summary.blockers.map((b) => `- ${b}`));
    }

    if (summary.estimatedCompletionAt) {
      lines.push('', `Estimated Completion: ${summary.estimatedCompletionAt.toISOString()}`);
    }

    return lines.join('\n');
  }

  const store: SummaryStore = {
    // Thread summaries
    async createThreadSummary(input: CreateThreadSummaryInput): Promise<ThreadSummary> {
      const now = new Date();
      const summary: ThreadSummary = {
        ...input,
        id: `ts-${nanoid()}`,
        type: 'thread',
        version: 1,
        tokenCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      // Calculate token count
      summary.tokenCount = estimateTokenCount(serializeThreadSummary(summary));

      threadSummaries.set(summary.id, summary);
      return summary;
    },

    async getThreadSummary(id: string): Promise<ThreadSummary | null> {
      return threadSummaries.get(id) ?? null;
    },

    async getThreadSummaryByThreadId(
      clientId: string,
      threadId: string
    ): Promise<ThreadSummary | null> {
      for (const summary of threadSummaries.values()) {
        if (summary.clientId === clientId && summary.threadId === threadId) {
          return summary;
        }
      }
      return null;
    },

    async updateThreadSummary(
      id: string,
      input: UpdateThreadSummaryInput
    ): Promise<ThreadSummary> {
      const existing = threadSummaries.get(id);
      if (!existing) {
        throw new Error(`Thread summary not found: ${id}`);
      }

      const updated: ThreadSummary = {
        ...existing,
        ...input,
        version: existing.version + 1,
        updatedAt: new Date(),
      };

      updated.tokenCount = estimateTokenCount(serializeThreadSummary(updated));

      threadSummaries.set(id, updated);
      return updated;
    },

    async listThreadSummaries(
      options: ListThreadSummariesOptions
    ): Promise<ThreadSummary[]> {
      const results: ThreadSummary[] = [];

      for (const summary of threadSummaries.values()) {
        // Filter by client
        if (summary.clientId !== options.clientId) continue;

        // Filter by platform
        if (options.platform && summary.platform !== options.platform) continue;

        // Filter by escalation
        if (
          options.needsEscalation !== undefined &&
          summary.needsEscalation !== options.needsEscalation
        ) {
          continue;
        }

        // Filter by sentiment
        if (options.minSentiment) {
          const minIdx = SENTIMENT_ORDER.indexOf(options.minSentiment);
          const summaryIdx = SENTIMENT_ORDER.indexOf(summary.sentiment);
          if (summaryIdx < minIdx) continue;
        }

        // Filter by date
        if (options.since && summary.lastActivityAt < options.since) continue;

        results.push(summary);
      }

      // Sort by last activity (most recent first)
      results.sort(
        (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime()
      );

      // Apply limit
      if (options.limit) {
        return results.slice(0, options.limit);
      }

      return results;
    },

    // Plan summaries
    async createPlanSummary(input: CreatePlanSummaryInput): Promise<PlanSummary> {
      const now = new Date();
      const summary: PlanSummary = {
        ...input,
        id: `ps-${nanoid()}`,
        type: 'plan',
        version: 1,
        tokenCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      summary.tokenCount = estimateTokenCount(serializePlanSummary(summary));

      planSummaries.set(summary.id, summary);
      return summary;
    },

    async getPlanSummary(id: string): Promise<PlanSummary | null> {
      return planSummaries.get(id) ?? null;
    },

    async getPlanSummaryByPlanId(
      clientId: string,
      planId: string
    ): Promise<PlanSummary | null> {
      for (const summary of planSummaries.values()) {
        if (summary.clientId === clientId && summary.planId === planId) {
          return summary;
        }
      }
      return null;
    },

    async updatePlanSummary(
      id: string,
      input: UpdatePlanSummaryInput
    ): Promise<PlanSummary> {
      const existing = planSummaries.get(id);
      if (!existing) {
        throw new Error(`Plan summary not found: ${id}`);
      }

      const updated: PlanSummary = {
        ...existing,
        ...input,
        version: existing.version + 1,
        updatedAt: new Date(),
      };

      updated.tokenCount = estimateTokenCount(serializePlanSummary(updated));

      planSummaries.set(id, updated);
      return updated;
    },

    async listPlanSummaries(options: ListPlanSummariesOptions): Promise<PlanSummary[]> {
      const results: PlanSummary[] = [];

      for (const summary of planSummaries.values()) {
        // Filter by client
        if (summary.clientId !== options.clientId) continue;

        // Filter by plan type
        if (options.planType && summary.planType !== options.planType) continue;

        // Filter by status
        if (options.status) {
          const isCompleted = summary.currentPhase === 'completed';
          const isFailed =
            summary.currentPhase === 'failed' || summary.currentPhase === 'cancelled';
          const isActive = !isCompleted && !isFailed;

          if (options.status === 'active' && !isActive) continue;
          if (options.status === 'completed' && !isCompleted) continue;
          if (options.status === 'failed' && !isFailed) continue;
        }

        // Filter by date
        if (options.since && summary.createdAt < options.since) continue;

        results.push(summary);
      }

      // Sort by created date (most recent first)
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply limit
      if (options.limit) {
        return results.slice(0, options.limit);
      }

      return results;
    },

    // Span generation
    async getSummarySpans(summaryId: string): Promise<Span[]> {
      const threadSummary = threadSummaries.get(summaryId);
      if (threadSummary) {
        const content = serializeThreadSummary(threadSummary);
        return [
          {
            id: `span-${summaryId}`,
            sourceType: 'thread_summary',
            sourceId: summaryId,
            startByte: 0,
            endByte: content.length,
            hash: simpleHash(content),
            tokenCount: threadSummary.tokenCount,
          },
        ];
      }

      const planSummary = planSummaries.get(summaryId);
      if (planSummary) {
        const content = serializePlanSummary(planSummary);
        return [
          {
            id: `span-${summaryId}`,
            sourceType: 'plan_summary',
            sourceId: summaryId,
            startByte: 0,
            endByte: content.length,
            hash: simpleHash(content),
            tokenCount: planSummary.tokenCount,
          },
        ];
      }

      return [];
    },

    // Serialization
    toPromptText(summary: Summary, options?: ToPromptTextOptions): string {
      let text: string;

      if (summary.type === 'thread') {
        text = serializeThreadSummary(summary);
      } else {
        text = serializePlanSummary(summary);
      }

      // Truncate if needed
      if (options?.maxTokens) {
        const maxChars = options.maxTokens * 4; // Rough estimate
        if (text.length > maxChars) {
          text = text.slice(0, maxChars - 3) + '...';
        }
      }

      return text;
    },
  };

  return store;
}
```

#### Step 3: Create Module Index

**File: `packages/memory/src/summaries/index.ts`**

```typescript
/**
 * Summary Storage System
 *
 * First-class storage for ThreadSummary and PlanSummary objects.
 */

export { createSummaryStore } from './store';

export type {
  // Base types
  SummaryType,
  BaseSummary,
  Summary,
  Sentiment,
  PlanPhase,

  // Thread summary
  ThreadSummary,
  CreateThreadSummaryInput,
  UpdateThreadSummaryInput,
  ListThreadSummariesOptions,

  // Plan summary
  PlanSummary,
  CreatePlanSummaryInput,
  UpdatePlanSummaryInput,
  ListPlanSummariesOptions,

  // Store
  SummaryStore,
  ToPromptTextOptions,
} from './types';

export {
  BaseSummarySchema,
  ThreadSummarySchema,
  PlanSummarySchema,
  SentimentSchema,
  PlanPhaseSchema,
} from './types';
```

#### Step 4: Update Main Package Index

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
```

### Phase 3: Verification

```bash
cd packages/memory

# Build
pnpm build

# Typecheck
pnpm typecheck

# Run tests
pnpm test

# Manual verification
cat > verify-summaries.ts << 'EOF'
import { createSummaryStore } from './src/summaries';

async function main() {
  const store = createSummaryStore();

  // Create thread summary
  const thread = await store.createThreadSummary({
    clientId: 'client-123',
    threadId: 'thread-456',
    platform: 'instagram',
    participantCount: 3,
    messageCount: 15,
    keyPoints: ['User asked about pricing', 'Interested in premium plan'],
    sentiment: 'positive',
    lastActivityAt: new Date(),
  });

  console.log('Created thread summary:', thread.id);
  console.log('Token count:', thread.tokenCount);
  console.log('\nPrompt text:');
  console.log(store.toPromptText(thread));

  // Get spans
  const spans = await store.getSummarySpans(thread.id);
  console.log('\nSpans:', spans);
}

main();
EOF

npx tsx verify-summaries.ts
rm verify-summaries.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/memory/src/summaries/types.ts` | Type definitions |
| Create | `packages/memory/src/summaries/store.ts` | Store implementation |
| Create | `packages/memory/src/summaries/index.ts` | Module exports |
| Modify | `packages/memory/src/index.ts` | Add summaries export |
| Create | `packages/memory/src/__tests__/summaries.test.ts` | Unit tests |

---

## Acceptance Criteria

- [ ] `createThreadSummary()` creates summary with token count
- [ ] `updateThreadSummary()` increments version
- [ ] `listThreadSummaries()` filters by client, platform, sentiment
- [ ] `createPlanSummary()` tracks node progress
- [ ] `updatePlanSummary()` updates phase and milestones
- [ ] `listPlanSummaries()` filters by status
- [ ] `getSummarySpans()` generates spans from summaries
- [ ] `toPromptText()` serializes for LLM consumption
- [ ] Token budget respected in serialization
- [ ] Tests pass with >80% coverage

---

## Test Requirements

### Unit Tests

- Thread summary CRUD operations
- Plan summary CRUD operations
- Filtering and listing
- Span generation
- Token counting and truncation

### Integration Tests

- Summary integration with RlmEnv
- Span registration from summaries

---

## Security & Safety Checklist

- [ ] Client ID scopes all queries (tenant isolation)
- [ ] No sensitive content in key points
- [ ] Escalation flags don't leak customer data
- [ ] Version tracking for audit trail

---

## JSON Task Block

```json
{
  "task_id": "S1-B2",
  "name": "Summary Storage System",
  "sprint": 1,
  "agent": "B",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 4,
  "dependencies": ["S1-B1"],
  "blocks": ["S1-B4", "S1-B5"],
  "tags": ["rlm", "memory", "summaries"],
  "acceptance_criteria": [
    "thread summaries created and updated",
    "plan summaries track progress",
    "filtering by client and status",
    "span generation from summaries",
    "prompt text serialization"
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

1. **S1-B3**: Implement reference system for span pointers
2. **S1-B4**: Add context window management with token counting
