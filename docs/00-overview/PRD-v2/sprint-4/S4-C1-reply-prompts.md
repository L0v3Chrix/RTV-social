# Build Prompt: S4-C1 — Reply Agent Prompt System

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-C1 |
| Sprint | 4 — Engagement |
| Agent | C — Reply Drafting Agent |
| Complexity | High |
| Status | Pending |
| Estimated Effort | 1.5 days |
| Dependencies | S4-B2, S4-B5 |
| Blocks | S4-C2, S4-C3, S4-C4, S4-C5 |

---

## Context

### What We're Building
A prompt engineering system for the reply drafting agent. Constructs context-rich prompts using thread summaries, participant history, brand voice guidelines, and knowledge base content to generate high-quality reply drafts.

### Why It Matters
- **Brand Consistency**: Every reply matches client's voice
- **Context-Aware**: Responses informed by conversation history
- **Knowledge-Grounded**: Answers from verified knowledge base
- **Quality Control**: Structured prompts = predictable quality
- **Personalization**: Adapt tone to participant and platform

### Spec References
- `docs/03-agents-tools/agent-recursion-contracts.md` — Agent prompts
- `docs/02-schemas/external-memory-schema.md` — Knowledge base access
- `docs/01-architecture/rlm-integration-spec.md` — RLM patterns

---

## Prerequisites

### Completed Tasks
- [x] S4-B2: ThreadSummary System
- [x] S4-B5: Thread Retrieval API

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/agents/reply/src/__tests__/reply-prompt-builder.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReplyPromptBuilder,
  ReplyPromptContext,
  BrandVoice,
} from '../reply-prompt-builder';
import { ReplyContext } from '@rtv/engagement/threads';
import { createMockKnowledgeBase } from './__mocks__/knowledge-base';

describe('ReplyPromptBuilder', () => {
  let builder: ReplyPromptBuilder;
  let mockKB: ReturnType<typeof createMockKnowledgeBase>;

  beforeEach(() => {
    mockKB = createMockKnowledgeBase();
    builder = new ReplyPromptBuilder({ knowledgeBase: mockKB });
  });

  describe('buildPrompt', () => {
    it('should include brand voice instructions', async () => {
      const context: ReplyPromptContext = {
        thread: {
          id: 'thread_1',
          type: 'comment',
          platform: 'facebook',
          recentMessages: [
            {
              id: 'msg_1',
              author: { displayName: 'Customer' },
              content: 'Love your product!',
              direction: 'inbound',
            },
          ],
        },
        brandVoice: {
          tone: 'friendly',
          personality: 'helpful and warm',
          doWords: ['thank', 'appreciate', 'happy to help'],
          dontWords: ['unfortunately', 'cannot', 'policy'],
          exampleResponses: [
            'Thanks so much for your kind words! 😊',
            'We really appreciate you taking the time to share!',
          ],
        },
      };

      const prompt = await builder.buildPrompt(context);

      expect(prompt).toContain('friendly');
      expect(prompt).toContain('helpful and warm');
      expect(prompt).toContain('thank');
    });

    it('should include thread summary for long conversations', async () => {
      const context: ReplyPromptContext = {
        thread: {
          id: 'thread_1',
          type: 'dm',
          platform: 'instagram',
          summary: 'Customer asking about shipping times for international orders',
          recentMessages: [
            {
              id: 'msg_10',
              author: { displayName: 'Customer' },
              content: 'Any update on when my order will ship?',
              direction: 'inbound',
            },
          ],
          totalMessages: 15,
        },
        brandVoice: { tone: 'professional' },
      };

      const prompt = await builder.buildPrompt(context);

      expect(prompt).toContain('shipping times');
      expect(prompt).toContain('international orders');
    });

    it('should include relevant knowledge base content', async () => {
      mockKB.search.mockResolvedValue([
        {
          id: 'kb_1',
          title: 'Return Policy',
          content: 'Returns accepted within 30 days with receipt.',
          relevanceScore: 0.95,
        },
      ]);

      const context: ReplyPromptContext = {
        thread: {
          id: 'thread_1',
          type: 'comment',
          platform: 'facebook',
          recentMessages: [
            {
              id: 'msg_1',
              author: { displayName: 'Customer' },
              content: 'Can I return this item I bought last week?',
              direction: 'inbound',
            },
          ],
        },
        brandVoice: { tone: 'helpful' },
      };

      const prompt = await builder.buildPrompt(context);

      expect(prompt).toContain('30 days');
      expect(prompt).toContain('receipt');
      expect(mockKB.search).toHaveBeenCalledWith(
        expect.stringContaining('return')
      );
    });

    it('should adapt tone for platform', async () => {
      const facebookContext: ReplyPromptContext = {
        thread: {
          id: 'thread_1',
          type: 'comment',
          platform: 'facebook',
          recentMessages: [{ id: 'msg_1', content: 'Hi!', direction: 'inbound' }],
        },
        brandVoice: { tone: 'casual' },
      };

      const linkedinContext: ReplyPromptContext = {
        thread: {
          id: 'thread_2',
          type: 'comment',
          platform: 'linkedin',
          recentMessages: [{ id: 'msg_1', content: 'Hi!', direction: 'inbound' }],
        },
        brandVoice: { tone: 'casual' },
      };

      const fbPrompt = await builder.buildPrompt(facebookContext);
      const liPrompt = await builder.buildPrompt(linkedinContext);

      expect(fbPrompt).toContain('casual');
      expect(liPrompt).toContain('professional'); // LinkedIn overrides to professional
    });

    it('should include participant context for VIPs', async () => {
      const context: ReplyPromptContext = {
        thread: {
          id: 'thread_1',
          type: 'dm',
          platform: 'instagram',
          recentMessages: [
            {
              id: 'msg_1',
              author: { displayName: 'Big Influencer', followerCount: 500000 },
              content: 'I have a question about your product',
              direction: 'inbound',
            },
          ],
        },
        brandVoice: { tone: 'friendly' },
        participantContext: {
          isVip: true,
          engagementScore: 95,
          previousInteractions: 12,
          sentimentTrend: 'positive',
        },
      };

      const prompt = await builder.buildPrompt(context);

      expect(prompt).toContain('VIP');
      expect(prompt).toContain('priority');
    });

    it('should include platform-specific constraints', async () => {
      const tiktokContext: ReplyPromptContext = {
        thread: {
          id: 'thread_1',
          type: 'comment',
          platform: 'tiktok',
          recentMessages: [{ id: 'msg_1', content: 'Cool!', direction: 'inbound' }],
        },
        brandVoice: { tone: 'fun' },
      };

      const prompt = await builder.buildPrompt(tiktokContext);

      expect(prompt).toContain('150 characters'); // TikTok comment limit
      expect(prompt).toContain('emoji-friendly');
    });
  });

  describe('extractSearchQuery', () => {
    it('should extract key terms from customer message', () => {
      const message = 'What is your return policy for damaged items?';
      const query = builder.extractSearchQuery(message);

      expect(query).toContain('return');
      expect(query).toContain('policy');
      expect(query).toContain('damaged');
    });

    it('should handle short messages', () => {
      const message = 'Help';
      const query = builder.extractSearchQuery(message);

      expect(query).toBe('help support assistance');
    });
  });

  describe('buildSystemPrompt', () => {
    it('should define agent role and constraints', () => {
      const systemPrompt = builder.buildSystemPrompt({
        clientName: 'Acme Corp',
        industry: 'E-commerce',
      });

      expect(systemPrompt).toContain('social media community manager');
      expect(systemPrompt).toContain('Acme Corp');
      expect(systemPrompt).toContain('draft');
      expect(systemPrompt).toContain('human review');
    });

    it('should include safety constraints', () => {
      const systemPrompt = builder.buildSystemPrompt({
        clientName: 'Test Brand',
      });

      expect(systemPrompt).toContain('never promise');
      expect(systemPrompt).toContain('never share personal information');
      expect(systemPrompt).toContain('escalate');
    });
  });

  describe('formatConversationHistory', () => {
    it('should format messages with clear speaker labels', () => {
      const messages = [
        { author: { displayName: 'John' }, content: 'Hi there!', direction: 'inbound' as const },
        { author: { displayName: 'Brand' }, content: 'Hello John!', direction: 'outbound' as const },
        { author: { displayName: 'John' }, content: 'I need help', direction: 'inbound' as const },
      ];

      const formatted = builder.formatConversationHistory(messages);

      expect(formatted).toContain('[Customer - John]: Hi there!');
      expect(formatted).toContain('[Brand]: Hello John!');
      expect(formatted).toContain('[Customer - John]: I need help');
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/agents/reply/src/reply-prompt-builder.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { ThreadMessage, ReplyContext } from '@rtv/engagement/threads';
import { Platform } from '@rtv/core';

const tracer = trace.getTracer('reply-prompt-builder');

export interface BrandVoice {
  tone: string;
  personality?: string;
  doWords?: string[];
  dontWords?: string[];
  exampleResponses?: string[];
  customInstructions?: string;
}

export interface ParticipantContext {
  isVip: boolean;
  engagementScore: number;
  previousInteractions: number;
  sentimentTrend?: 'positive' | 'neutral' | 'negative';
}

export interface ThreadContext {
  id: string;
  type: 'comment' | 'dm' | 'mention';
  platform: Platform | string;
  summary?: string;
  recentMessages: Partial<ThreadMessage>[];
  totalMessages?: number;
}

export interface ReplyPromptContext {
  thread: ThreadContext;
  brandVoice: Partial<BrandVoice>;
  participantContext?: ParticipantContext;
  knowledgeContent?: string;
}

export interface KnowledgeBaseClient {
  search(query: string, clientId: string): Promise<Array<{
    id: string;
    title: string;
    content: string;
    relevanceScore: number;
  }>>;
}

const PLATFORM_CONSTRAINTS: Record<string, { maxLength: number; style: string }> = {
  facebook: { maxLength: 8000, style: 'conversational with light emoji use' },
  instagram: { maxLength: 2200, style: 'friendly, emoji-friendly, visual language' },
  tiktok: { maxLength: 150, style: 'ultra-brief, emoji-friendly, trendy language' },
  youtube: { maxLength: 10000, style: 'detailed and helpful' },
  linkedin: { maxLength: 1300, style: 'professional and thoughtful' },
  x: { maxLength: 280, style: 'concise and punchy' },
  skool: { maxLength: 5000, style: 'community-focused, supportive' },
};

const PLATFORM_TONE_OVERRIDES: Record<string, string> = {
  linkedin: 'professional',
};

export class ReplyPromptBuilder {
  private knowledgeBase?: KnowledgeBaseClient;
  private clientId?: string;

  constructor(config?: {
    knowledgeBase?: KnowledgeBaseClient;
    clientId?: string;
  }) {
    this.knowledgeBase = config?.knowledgeBase;
    this.clientId = config?.clientId;
  }

  async buildPrompt(context: ReplyPromptContext): Promise<string> {
    return tracer.startActiveSpan('buildReplyPrompt', async (span) => {
      span.setAttributes({
        'prompt.thread_id': context.thread.id,
        'prompt.platform': context.thread.platform,
        'prompt.thread_type': context.thread.type,
      });

      const sections: string[] = [];

      // 1. Platform context
      const platform = context.thread.platform as string;
      const platformInfo = PLATFORM_CONSTRAINTS[platform] || PLATFORM_CONSTRAINTS.facebook;
      const effectiveTone =
        PLATFORM_TONE_OVERRIDES[platform] || context.brandVoice.tone || 'friendly';

      sections.push(`## Platform: ${platform.toUpperCase()}`);
      sections.push(`- Max response length: ${platformInfo.maxLength} characters`);
      sections.push(`- Style: ${platformInfo.style}`);
      sections.push(`- Tone: ${effectiveTone}`);

      // 2. Brand voice
      sections.push('\n## Brand Voice');
      if (context.brandVoice.personality) {
        sections.push(`Personality: ${context.brandVoice.personality}`);
      }
      if (context.brandVoice.doWords?.length) {
        sections.push(`Use words like: ${context.brandVoice.doWords.join(', ')}`);
      }
      if (context.brandVoice.dontWords?.length) {
        sections.push(`Avoid words like: ${context.brandVoice.dontWords.join(', ')}`);
      }
      if (context.brandVoice.exampleResponses?.length) {
        sections.push('\nExample responses in our voice:');
        context.brandVoice.exampleResponses.forEach((ex) => {
          sections.push(`- "${ex}"`);
        });
      }
      if (context.brandVoice.customInstructions) {
        sections.push(`\nAdditional instructions: ${context.brandVoice.customInstructions}`);
      }

      // 3. Participant context (if VIP)
      if (context.participantContext?.isVip) {
        sections.push('\n## VIP Customer Alert');
        sections.push('This is a high-value customer. Treat with priority attention.');
        sections.push(`Engagement score: ${context.participantContext.engagementScore}/100`);
        sections.push(`Previous interactions: ${context.participantContext.previousInteractions}`);
        if (context.participantContext.sentimentTrend) {
          sections.push(`Recent sentiment: ${context.participantContext.sentimentTrend}`);
        }
      }

      // 4. Thread summary (for long conversations)
      if (context.thread.summary) {
        sections.push('\n## Conversation Summary');
        sections.push(context.thread.summary);
        sections.push(`(Total messages: ${context.thread.totalMessages || 'unknown'})`);
      }

      // 5. Knowledge base content
      const lastMessage = context.thread.recentMessages[context.thread.recentMessages.length - 1];
      if (lastMessage?.content && this.knowledgeBase && this.clientId) {
        const searchQuery = this.extractSearchQuery(lastMessage.content);
        const kbResults = await this.knowledgeBase.search(searchQuery, this.clientId);

        if (kbResults.length > 0) {
          sections.push('\n## Relevant Knowledge Base Information');
          kbResults.slice(0, 3).forEach((result) => {
            sections.push(`### ${result.title}`);
            sections.push(result.content);
          });
        }
      } else if (context.knowledgeContent) {
        sections.push('\n## Relevant Knowledge Base Information');
        sections.push(context.knowledgeContent);
      }

      // 6. Conversation history
      sections.push('\n## Recent Conversation');
      sections.push(this.formatConversationHistory(context.thread.recentMessages));

      // 7. Task instruction
      sections.push('\n## Your Task');
      sections.push('Draft a reply to the most recent customer message.');
      sections.push('Remember: This draft will be reviewed by a human before sending.');
      sections.push(`Keep response under ${platformInfo.maxLength} characters.`);

      const prompt = sections.join('\n');

      span.setAttributes({ 'prompt.length': prompt.length });
      span.end();

      return prompt;
    });
  }

  buildSystemPrompt(config: {
    clientName: string;
    industry?: string;
  }): string {
    return `You are a social media community manager for ${config.clientName}${config.industry ? ` in the ${config.industry} industry` : ''}.

Your role is to draft friendly, helpful, and on-brand responses to customer messages on social media.

IMPORTANT CONSTRAINTS:
- You create DRAFTS that will be reviewed by a human before sending
- Never promise specific outcomes (refunds, discounts, delivery dates) without knowledge base confirmation
- Never share personal information about customers or employees
- Never engage with harassment, abuse, or illegal requests - flag for escalation instead
- If you're unsure about anything, recommend human escalation
- Stay on topic and professional at all times

ESCALATION TRIGGERS (recommend human review):
- Legal threats or mentions of lawyers
- Requests for personal/private information
- Complaints about discrimination or harassment
- Medical or safety concerns
- Mentions of media, press, or going viral
- Any request you're not 100% confident handling

Remember: It's always better to escalate than to give incorrect information.`;
  }

  extractSearchQuery(message: string): string {
    // Remove common stop words and extract key terms
    const stopWords = new Set([
      'i', 'me', 'my', 'we', 'our', 'you', 'your', 'the', 'a', 'an',
      'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'can',
      'this', 'that', 'these', 'those',
      'what', 'which', 'who', 'when', 'where', 'why', 'how',
      'and', 'or', 'but', 'if', 'then', 'so', 'for', 'to', 'of', 'in', 'on', 'at',
    ]);

    const words = message
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    if (words.length === 0) {
      return 'help support assistance';
    }

    return words.slice(0, 5).join(' ');
  }

  formatConversationHistory(messages: Partial<ThreadMessage>[]): string {
    return messages
      .map((msg) => {
        const speaker =
          msg.direction === 'outbound'
            ? '[Brand]'
            : `[Customer - ${msg.author?.displayName || 'Unknown'}]`;
        return `${speaker}: ${msg.content || ''}`;
      })
      .join('\n');
  }

  buildFollowUpPrompt(
    originalDraft: string,
    feedback: string,
    context: ReplyPromptContext
  ): string {
    return `## Previous Draft
${originalDraft}

## Feedback
${feedback}

## Your Task
Revise the draft based on the feedback above. Maintain the same brand voice and platform constraints.

${this.formatConversationHistory(context.thread.recentMessages)}

Generate a revised reply:`;
  }

  buildEscalationPrompt(context: ReplyPromptContext): string {
    return `## Escalation Assessment

Review this conversation and determine if it requires human escalation.

${context.thread.summary ? `Summary: ${context.thread.summary}` : ''}

Recent messages:
${this.formatConversationHistory(context.thread.recentMessages)}

Analyze for:
1. Legal threats or liability concerns
2. Safety or medical issues
3. Discrimination or harassment claims
4. Media/PR risk
5. Complex issues requiring human judgment

Respond with:
- ESCALATE: [reason] if human intervention needed
- SAFE: if automated reply is appropriate`;
  }
}

export function createReplyPromptBuilder(config?: {
  knowledgeBase?: KnowledgeBaseClient;
  clientId?: string;
}): ReplyPromptBuilder {
  return new ReplyPromptBuilder(config);
}
```

### Phase 3: Verification

```bash
cd packages/agents/reply && pnpm test
pnpm test:coverage
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/reply/src/reply-prompt-builder.ts` | Prompt builder |
| Create | `packages/agents/reply/src/__tests__/reply-prompt-builder.test.ts` | Tests |
| Create | `packages/agents/reply/package.json` | Package config |
| Modify | `packages/agents/reply/src/index.ts` | Export prompt builder |

---

## Acceptance Criteria

- [ ] Build prompts with brand voice instructions
- [ ] Include thread summary for context
- [ ] Search and include knowledge base content
- [ ] Adapt tone for different platforms
- [ ] Include platform-specific constraints (character limits)
- [ ] Handle VIP participant context
- [ ] Extract search queries from messages
- [ ] Format conversation history clearly
- [ ] Include safety constraints in system prompt
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-C1",
  "name": "Reply Agent Prompt System",
  "description": "Build context-rich prompts for reply generation",
  "status": "pending",
  "priority": "high",
  "complexity": "high",
  "sprint": 4,
  "agent": "C",
  "dependencies": ["S4-B2", "S4-B5"],
  "blocks": ["S4-C2", "S4-C3", "S4-C4", "S4-C5"],
  "estimated_hours": 12,
  "tags": ["engagement", "reply-agent", "prompts", "llm", "tdd"],
  "package": "@rtv/agents/reply"
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "next_task_hints": ["S4-C2 for safe response generation", "S4-C3 for auto-like"]
}
```
