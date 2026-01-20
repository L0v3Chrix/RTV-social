# Build Prompt: S4-B2 — ThreadSummary System

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-B2 |
| Sprint | 4 — Engagement |
| Agent | B — Conversation Thread Model |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1 day |
| Dependencies | S4-B1 |
| Blocks | S4-C1, S4-C4, S4-C5 |

---

## Context

### What We're Building
A thread summarization system that generates concise summaries of conversation threads. Summaries help reply agents understand context quickly without processing entire message histories, and enable operators to triage conversations efficiently.

### Why It Matters
- **Context Compression**: Long threads summarized for LLM context windows
- **Quick Triage**: Operators see thread essence at a glance
- **Reply Quality**: Better context leads to better replies
- **RLM Integration**: Summaries stored as external memory
- **Cost Efficiency**: Reduced token usage with summaries

### Spec References
- `docs/01-architecture/rlm-integration-spec.md` — Summary patterns
- `docs/02-schemas/external-memory-schema.md` — ThreadSummary schema
- `docs/03-agents-tools/agent-recursion-contracts.md` — Agent memory access

---

## Prerequisites

### Completed Tasks
- [x] S4-B1: Thread Entity Model

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/engagement/threads/src/__tests__/thread-summary.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ThreadSummarizer,
  ThreadSummary,
  SummaryConfig,
} from '../thread-summary';
import { Thread, createThread, addMessageToThread } from '../thread-entity';
import { createMockLLMClient } from './__mocks__/llm-client';

describe('ThreadSummarizer', () => {
  let summarizer: ThreadSummarizer;
  let mockLLM: ReturnType<typeof createMockLLMClient>;

  beforeEach(() => {
    mockLLM = createMockLLMClient();
    summarizer = new ThreadSummarizer({
      llmClient: mockLLM,
      maxMessagesBeforeSummary: 5,
      summaryMaxTokens: 200,
    });
  });

  describe('shouldSummarize', () => {
    it('should return false for threads under threshold', () => {
      const thread = createThread({
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        postId: 'fb_post_1',
        author: { platformId: 'user_1', displayName: 'User' },
        content: 'Hello',
        timestamp: new Date(),
      });

      expect(summarizer.shouldSummarize(thread)).toBe(false);
    });

    it('should return true for threads at or above threshold', () => {
      let thread = createThread({
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        postId: 'fb_post_1',
        author: { platformId: 'user_1', displayName: 'User' },
        content: 'Hello',
        timestamp: new Date(),
      });

      for (let i = 2; i <= 6; i++) {
        thread = addMessageToThread(thread, {
          id: `evt_${i}`,
          clientId: 'client_abc',
          platform: 'facebook',
          eventType: 'comment',
          postId: 'fb_post_1',
          author: { platformId: `user_${i}`, displayName: `User ${i}` },
          content: `Message ${i}`,
          timestamp: new Date(),
        });
      }

      expect(summarizer.shouldSummarize(thread)).toBe(true);
    });

    it('should return true if summary is stale', () => {
      const thread = createThread({
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        postId: 'fb_post_1',
        author: { platformId: 'user_1', displayName: 'User' },
        content: 'Hello',
        timestamp: new Date(),
      });

      thread.summary = 'Old summary';
      thread.summaryUpdatedAt = new Date(Date.now() - 3600000); // 1 hour ago
      thread.lastMessageAt = new Date(); // Just now

      expect(summarizer.shouldSummarize(thread)).toBe(true);
    });
  });

  describe('summarize', () => {
    it('should generate summary for thread', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'Customer asking about product return policy. Needs status update.',
      });

      let thread = createThread({
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        postId: 'fb_post_1',
        author: { platformId: 'user_1', displayName: 'Customer' },
        content: 'I bought this product and want to return it',
        timestamp: new Date(),
      });

      thread = addMessageToThread(thread, {
        id: 'evt_2',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        postId: 'fb_post_1',
        author: { platformId: 'user_1', displayName: 'Customer' },
        content: 'What is your return policy?',
        timestamp: new Date(),
      });

      const summary = await summarizer.summarize(thread);

      expect(summary.threadId).toBe(thread.id);
      expect(summary.content).toContain('return policy');
      expect(summary.messageCount).toBe(2);
      expect(summary.generatedAt).toBeDefined();
    });

    it('should extract key topics from conversation', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'Customer complaint about delayed shipping. Requesting refund.',
        topics: ['shipping', 'refund', 'complaint'],
      });

      const thread = createThread({
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'instagram',
        eventType: 'dm',
        threadId: 'ig_dm_1',
        author: { platformId: 'user_1', displayName: 'User' },
        content: 'My order is late and I want my money back',
        timestamp: new Date(),
      });

      const summary = await summarizer.summarize(thread);

      expect(summary.topics).toContain('shipping');
      expect(summary.topics).toContain('refund');
    });

    it('should identify sentiment', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'Angry customer complaining about service quality.',
        sentiment: 'negative',
      });

      const thread = createThread({
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'x',
        eventType: 'mention',
        postId: 'x_tweet_1',
        author: { platformId: 'user_1', displayName: 'Unhappy Customer' },
        content: 'This is the worst service I have ever experienced!',
        timestamp: new Date(),
      });

      const summary = await summarizer.summarize(thread);

      expect(summary.sentiment).toBe('negative');
    });

    it('should identify action items', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'Customer needs help with password reset.',
        actionItems: ['Send password reset link', 'Follow up in 24 hours'],
      });

      const thread = createThread({
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'dm',
        threadId: 'fb_dm_1',
        author: { platformId: 'user_1', displayName: 'User' },
        content: 'I cannot log into my account',
        timestamp: new Date(),
      });

      const summary = await summarizer.summarize(thread);

      expect(summary.actionItems).toHaveLength(2);
      expect(summary.actionItems).toContain('Send password reset link');
    });
  });

  describe('getContextForReply', () => {
    it('should return summary + recent messages for long threads', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'Ongoing discussion about product features.',
      });

      let thread = createThread({
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        postId: 'fb_post_1',
        author: { platformId: 'user_1', displayName: 'User' },
        content: 'First message',
        timestamp: new Date(),
      });

      for (let i = 2; i <= 10; i++) {
        thread = addMessageToThread(thread, {
          id: `evt_${i}`,
          clientId: 'client_abc',
          platform: 'facebook',
          eventType: 'comment',
          postId: 'fb_post_1',
          author: { platformId: `user_${i % 3}`, displayName: `User ${i % 3}` },
          content: `Message ${i}`,
          timestamp: new Date(),
        });
      }

      const context = await summarizer.getContextForReply(thread, {
        recentMessageCount: 3,
      });

      expect(context.summary).toBeDefined();
      expect(context.recentMessages).toHaveLength(3);
      expect(context.totalMessages).toBe(10);
    });

    it('should return all messages for short threads', async () => {
      const thread = createThread({
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'instagram',
        eventType: 'dm',
        threadId: 'ig_dm_1',
        author: { platformId: 'user_1', displayName: 'User' },
        content: 'Hi there',
        timestamp: new Date(),
      });

      const context = await summarizer.getContextForReply(thread, {
        recentMessageCount: 5,
      });

      expect(context.summary).toBeUndefined();
      expect(context.recentMessages).toHaveLength(1);
      expect(context.allMessagesIncluded).toBe(true);
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/engagement/threads/src/thread-summary.ts
import { z } from 'zod';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Thread, ThreadMessage } from './thread-entity';

const tracer = trace.getTracer('thread-summary');

export const ThreadSummarySchema = z.object({
  threadId: z.string(),
  content: z.string(),
  topics: z.array(z.string()).default([]),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).optional(),
  actionItems: z.array(z.string()).default([]),
  messageCount: z.number(),
  participantCount: z.number(),
  generatedAt: z.date(),
  expiresAt: z.date().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;

export interface SummaryConfig {
  maxMessagesBeforeSummary: number;
  summaryMaxTokens: number;
  staleSummaryThresholdMs?: number;
}

export interface LLMClient {
  complete(prompt: string, options?: { maxTokens?: number }): Promise<{
    content: string;
    topics?: string[];
    sentiment?: string;
    actionItems?: string[];
  }>;
}

export interface ReplyContext {
  summary?: ThreadSummary;
  recentMessages: ThreadMessage[];
  totalMessages: number;
  allMessagesIncluded: boolean;
}

export class ThreadSummarizer {
  private llmClient: LLMClient;
  private config: SummaryConfig;

  constructor(config: SummaryConfig & { llmClient: LLMClient }) {
    this.llmClient = config.llmClient;
    this.config = {
      maxMessagesBeforeSummary: config.maxMessagesBeforeSummary,
      summaryMaxTokens: config.summaryMaxTokens,
      staleSummaryThresholdMs: config.staleSummaryThresholdMs || 1800000, // 30 min
    };
  }

  shouldSummarize(thread: Thread): boolean {
    // Check if thread has enough messages
    if (thread.messageCount >= this.config.maxMessagesBeforeSummary) {
      // Check if summary exists and is fresh
      if (!thread.summary || !thread.summaryUpdatedAt) {
        return true;
      }

      // Check if summary is stale (new messages since last summary)
      const summaryAge = Date.now() - thread.summaryUpdatedAt.getTime();
      const hasNewMessages =
        thread.lastMessageAt.getTime() > thread.summaryUpdatedAt.getTime();

      if (hasNewMessages && summaryAge > this.config.staleSummaryThresholdMs!) {
        return true;
      }
    }

    return false;
  }

  async summarize(thread: Thread): Promise<ThreadSummary> {
    return tracer.startActiveSpan('summarizeThread', async (span) => {
      span.setAttributes({
        'summary.thread_id': thread.id,
        'summary.message_count': thread.messageCount,
        'summary.participant_count': thread.participantCount,
      });

      const prompt = this.buildSummaryPrompt(thread);

      const response = await this.llmClient.complete(prompt, {
        maxTokens: this.config.summaryMaxTokens,
      });

      const summary: ThreadSummary = {
        threadId: thread.id,
        content: response.content,
        topics: response.topics || this.extractTopics(response.content),
        sentiment: this.parseSentiment(response.sentiment),
        actionItems: response.actionItems || [],
        messageCount: thread.messageCount,
        participantCount: thread.participantCount,
        generatedAt: new Date(),
        metadata: {
          platform: thread.platform,
          threadType: thread.type,
        },
      };

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return summary;
    });
  }

  private buildSummaryPrompt(thread: Thread): string {
    const messages = thread.messages
      .map(
        (m) =>
          `[${m.direction === 'inbound' ? 'Customer' : 'Brand'}] ${m.author.displayName}: ${m.content}`
      )
      .join('\n');

    return `Summarize this ${thread.type} conversation on ${thread.platform}.

Conversation:
${messages}

Provide:
1. A concise summary (1-2 sentences)
2. Key topics discussed
3. Overall sentiment (positive/neutral/negative/mixed)
4. Any action items or next steps needed

Format your response as a summary focusing on what the customer needs and any pending actions.`;
  }

  private extractTopics(content: string): string[] {
    // Simple keyword extraction - in production use NLP
    const keywords = [
      'shipping',
      'refund',
      'return',
      'complaint',
      'question',
      'support',
      'order',
      'product',
      'service',
      'account',
      'password',
      'billing',
      'payment',
    ];

    const contentLower = content.toLowerCase();
    return keywords.filter((kw) => contentLower.includes(kw));
  }

  private parseSentiment(
    sentiment?: string
  ): ThreadSummary['sentiment'] | undefined {
    if (!sentiment) return undefined;
    const normalized = sentiment.toLowerCase();
    if (['positive', 'neutral', 'negative', 'mixed'].includes(normalized)) {
      return normalized as ThreadSummary['sentiment'];
    }
    return undefined;
  }

  async getContextForReply(
    thread: Thread,
    options: { recentMessageCount: number }
  ): Promise<ReplyContext> {
    const { recentMessageCount } = options;

    // For short threads, return all messages
    if (thread.messageCount <= recentMessageCount) {
      return {
        recentMessages: thread.messages,
        totalMessages: thread.messageCount,
        allMessagesIncluded: true,
      };
    }

    // For long threads, generate/use summary + recent messages
    let summary: ThreadSummary | undefined;

    if (this.shouldSummarize(thread)) {
      summary = await this.summarize(thread);
    } else if (thread.summary) {
      // Use existing summary
      summary = {
        threadId: thread.id,
        content: thread.summary,
        topics: [],
        actionItems: [],
        messageCount: thread.messageCount,
        participantCount: thread.participantCount,
        generatedAt: thread.summaryUpdatedAt || new Date(),
      };
    }

    const recentMessages = thread.messages.slice(-recentMessageCount);

    return {
      summary,
      recentMessages,
      totalMessages: thread.messageCount,
      allMessagesIncluded: false,
    };
  }

  async updateThreadWithSummary(thread: Thread): Promise<Thread> {
    const summary = await this.summarize(thread);

    return {
      ...thread,
      summary: summary.content,
      summaryUpdatedAt: summary.generatedAt,
      sentiment: summary.sentiment,
      tags: [...new Set([...thread.tags, ...summary.topics])],
    };
  }
}

export function formatContextForLLM(context: ReplyContext): string {
  let formatted = '';

  if (context.summary) {
    formatted += `## Conversation Summary\n${context.summary.content}\n\n`;

    if (context.summary.topics.length > 0) {
      formatted += `Topics: ${context.summary.topics.join(', ')}\n`;
    }

    if (context.summary.sentiment) {
      formatted += `Sentiment: ${context.summary.sentiment}\n`;
    }

    formatted += '\n';
  }

  formatted += `## Recent Messages (${context.recentMessages.length} of ${context.totalMessages})\n`;

  for (const msg of context.recentMessages) {
    const role = msg.direction === 'inbound' ? 'Customer' : 'Brand';
    formatted += `[${role}] ${msg.author.displayName}: ${msg.content}\n`;
  }

  return formatted;
}
```

### Phase 3: Verification

```bash
cd packages/engagement/threads && pnpm test
pnpm test:coverage
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/engagement/threads/src/thread-summary.ts` | Summary generation |
| Create | `packages/engagement/threads/src/__tests__/thread-summary.test.ts` | Tests |
| Modify | `packages/engagement/threads/src/index.ts` | Export summarizer |

---

## Acceptance Criteria

- [ ] Generate summaries for threads above message threshold
- [ ] Detect stale summaries needing refresh
- [ ] Extract topics from conversation
- [ ] Identify sentiment (positive/neutral/negative/mixed)
- [ ] Extract action items from conversation
- [ ] Provide context for reply agents (summary + recent messages)
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-B2",
  "name": "ThreadSummary System",
  "description": "Generate and maintain thread summaries for context compression",
  "status": "pending",
  "priority": "medium",
  "complexity": "medium",
  "sprint": 4,
  "agent": "B",
  "dependencies": ["S4-B1"],
  "blocks": ["S4-C1", "S4-C4", "S4-C5"],
  "estimated_hours": 8,
  "tags": ["engagement", "threads", "summary", "llm", "tdd"],
  "package": "@rtv/engagement/threads"
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "next_task_hints": ["S4-B3 for participant tracking", "S4-C1 for reply agent prompts"]
}
```
