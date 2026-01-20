# Build Prompt: S4-C5 — DM Reply Drafts

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-C5 |
| Sprint | 4 — Engagement |
| Agent | C — Reply Drafting Agent |
| Complexity | High |
| Status | Pending |
| Estimated Effort | 1.5 days |
| Dependencies | S4-C1, S4-C2, S4-B1 |
| Blocks | S4-D2 |

---

## Context

### What We're Building
A DM (Direct Message) reply drafting system similar to comment drafts but with DM-specific considerations: longer conversations, private context, more personalized tone, and different platform rules. Supports multi-turn conversations and private customer service interactions.

### Why It Matters
- **Private Communication**: DMs require more care than public comments
- **Relationship Building**: Personalized, helpful responses build loyalty
- **Customer Service**: Many support issues handled via DM
- **Compliance**: Private messages have different legal considerations
- **Context Depth**: DMs often have longer history to consider

### Spec References
- `docs/03-agents-tools/agent-recursion-contracts.md` — DM handling
- `docs/05-policy-safety/compliance-requirements.md` — Privacy requirements
- `docs/09-platform-playbooks/instagram-playbook.md` — DM specifics

---

## Prerequisites

### Completed Tasks
- [x] S4-C1: Reply Agent Prompt System
- [x] S4-C2: Safe Response Generation
- [x] S4-B1: Thread Entity Model

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/agents/reply/src/__tests__/dm-draft.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DMDraftService,
  DMDraft,
  DMConversationContext,
} from '../dm-draft';
import { ReplyPromptBuilder } from '../reply-prompt-builder';
import { ResponseSafetyChecker } from '../response-safety';
import { createMockLLMClient } from './__mocks__/llm-client';
import { createMockRepository } from './__mocks__/repository';

describe('DMDraftService', () => {
  let service: DMDraftService;
  let mockLLM: ReturnType<typeof createMockLLMClient>;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockLLM = createMockLLMClient();
    mockRepo = createMockRepository();
    service = new DMDraftService({
      llmClient: mockLLM,
      repository: mockRepo,
      promptBuilder: new ReplyPromptBuilder(),
      safetyChecker: new ResponseSafetyChecker(),
    });
  });

  describe('generateDraft', () => {
    it('should generate draft for DM conversation', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'Hi! Thanks for reaching out. I would be happy to help with your order.',
      });
      mockRepo.saveDraft.mockResolvedValue({ id: 'dm_draft_123' });

      const draft = await service.generateDraft({
        threadId: 'dm_thread_1',
        clientId: 'client_abc',
        platform: 'instagram',
        conversation: {
          messages: [
            { role: 'customer', content: 'Hi, I have a question about my order' },
          ],
          customerName: 'John',
          previousPurchases: 3,
        },
        brandVoice: { tone: 'friendly' },
      });

      expect(draft.id).toBe('dm_draft_123');
      expect(draft.content).toContain('Thanks for reaching out');
      expect(draft.type).toBe('dm');
    });

    it('should use customer name in personalized greeting', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'Hi Sarah! Great to hear from you.',
      });

      const draft = await service.generateDraft({
        threadId: 'dm_thread_2',
        clientId: 'client_abc',
        platform: 'facebook',
        conversation: {
          messages: [{ role: 'customer', content: 'Hello' }],
          customerName: 'Sarah',
        },
        brandVoice: { tone: 'warm' },
      });

      expect(draft.content).toContain('Sarah');
    });

    it('should include conversation summary for long threads', async () => {
      const longConversation: DMConversationContext = {
        messages: Array(20).fill(null).map((_, i) => ({
          role: i % 2 === 0 ? 'customer' : 'brand',
          content: `Message ${i + 1}`,
        })),
        summary: 'Customer discussing shipping delays for order #12345',
        customerName: 'Mike',
      };

      mockLLM.complete.mockResolvedValue({
        content: 'Thanks for your patience, Mike. Regarding your shipping delay...',
      });

      const buildPromptSpy = vi.spyOn(
        service['promptBuilder'],
        'buildPrompt'
      );

      await service.generateDraft({
        threadId: 'dm_thread_3',
        clientId: 'client_abc',
        platform: 'instagram',
        conversation: longConversation,
        brandVoice: { tone: 'professional' },
      });

      expect(buildPromptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          thread: expect.objectContaining({
            summary: 'Customer discussing shipping delays for order #12345',
          }),
        })
      );
    });

    it('should handle VIP customers differently', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'Thank you so much for being a valued customer! Let me personally ensure...',
      });

      const draft = await service.generateDraft({
        threadId: 'dm_thread_4',
        clientId: 'client_abc',
        platform: 'instagram',
        conversation: {
          messages: [{ role: 'customer', content: 'I need help' }],
          customerName: 'VIP Customer',
          isVip: true,
          lifetimeValue: 5000,
        },
        brandVoice: { tone: 'premium' },
      });

      expect(draft.metadata?.vipHandling).toBe(true);
    });

    it('should flag sensitive topics in DMs', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'I understand this is frustrating. Let me connect you with our support team.',
      });

      vi.spyOn(service['safetyChecker'], 'checkSensitiveTopics').mockResolvedValue({
        hasSensitiveContent: true,
        topics: ['complaint', 'refund'],
      });

      const draft = await service.generateDraft({
        threadId: 'dm_thread_5',
        clientId: 'client_abc',
        platform: 'facebook',
        conversation: {
          messages: [
            { role: 'customer', content: 'I want a refund or I will sue you!' },
          ],
          customerName: 'Angry Customer',
        },
        brandVoice: { tone: 'calm' },
      });

      expect(draft.sensitiveTopics).toContain('complaint');
      expect(draft.status).toBe('needs_escalation_review');
    });
  });

  describe('platform-specific behavior', () => {
    it('should apply Instagram DM constraints', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'Thanks! 💜 Check out our latest post for more info!',
      });

      const draft = await service.generateDraft({
        threadId: 'dm_thread_6',
        clientId: 'client_abc',
        platform: 'instagram',
        conversation: {
          messages: [{ role: 'customer', content: 'Do you have sales?' }],
          customerName: 'User',
        },
        brandVoice: { tone: 'casual' },
      });

      expect(draft.platform).toBe('instagram');
      expect(draft.platformConstraints?.maxLength).toBe(1000);
    });

    it('should apply Facebook Messenger constraints', async () => {
      const draft = await service.generateDraft({
        threadId: 'dm_thread_7',
        clientId: 'client_abc',
        platform: 'facebook',
        conversation: {
          messages: [{ role: 'customer', content: 'Question about hours' }],
          customerName: 'User',
        },
        brandVoice: { tone: 'friendly' },
      });

      expect(draft.platformConstraints?.supportsQuickReplies).toBe(true);
    });

    it('should apply LinkedIn constraints (more formal)', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'Thank you for your inquiry. I would be pleased to discuss this further.',
      });

      const draft = await service.generateDraft({
        threadId: 'dm_thread_8',
        clientId: 'client_abc',
        platform: 'linkedin',
        conversation: {
          messages: [{ role: 'customer', content: 'Interested in partnership' }],
          customerName: 'Business Contact',
        },
        brandVoice: { tone: 'professional' },
      });

      expect(draft.platformConstraints?.formalityLevel).toBe('high');
    });
  });

  describe('suggestQuickReplies', () => {
    it('should suggest quick reply options', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'Would you like to schedule a call?',
        quickReplies: ['Yes, schedule call', 'No thanks', 'More info please'],
      });

      const draft = await service.generateDraft({
        threadId: 'dm_thread_9',
        clientId: 'client_abc',
        platform: 'facebook',
        conversation: {
          messages: [{ role: 'customer', content: 'Can we talk?' }],
          customerName: 'Prospect',
        },
        brandVoice: { tone: 'helpful' },
        includeQuickReplies: true,
      });

      expect(draft.suggestedQuickReplies).toHaveLength(3);
    });
  });

  describe('conversational flow', () => {
    it('should track conversation state', async () => {
      const draft = await service.generateDraft({
        threadId: 'dm_thread_10',
        clientId: 'client_abc',
        platform: 'instagram',
        conversation: {
          messages: [
            { role: 'customer', content: 'Hi' },
            { role: 'brand', content: 'Hello! How can I help?' },
            { role: 'customer', content: 'Order status' },
            { role: 'brand', content: 'Sure, what is your order number?' },
            { role: 'customer', content: '12345' },
          ],
          customerName: 'Customer',
          conversationState: 'awaiting_order_lookup',
        },
        brandVoice: { tone: 'helpful' },
      });

      expect(draft.conversationState).toBe('awaiting_order_lookup');
    });

    it('should suggest next actions based on conversation', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'I found your order. It shipped yesterday!',
        suggestedActions: ['send_tracking_link', 'mark_resolved'],
      });

      const draft = await service.generateDraft({
        threadId: 'dm_thread_11',
        clientId: 'client_abc',
        platform: 'facebook',
        conversation: {
          messages: [
            { role: 'customer', content: 'Where is my order #12345?' },
          ],
          customerName: 'Customer',
          orderLookupResult: { status: 'shipped', trackingNumber: 'ABC123' },
        },
        brandVoice: { tone: 'helpful' },
      });

      expect(draft.suggestedActions).toContain('send_tracking_link');
    });
  });

  describe('approval workflow', () => {
    it('should require approval for new customers', async () => {
      const draft = await service.generateDraft({
        threadId: 'dm_thread_12',
        clientId: 'client_abc',
        platform: 'instagram',
        conversation: {
          messages: [{ role: 'customer', content: 'First time here!' }],
          customerName: 'New Customer',
          isFirstInteraction: true,
        },
        brandVoice: { tone: 'welcoming' },
      });

      expect(draft.requiresApproval).toBe(true);
      expect(draft.approvalReason).toBe('first_interaction');
    });

    it('should allow auto-send for simple responses to known customers', async () => {
      service.setAutoSendEnabled(true);

      const draft = await service.generateDraft({
        threadId: 'dm_thread_13',
        clientId: 'client_abc',
        platform: 'facebook',
        conversation: {
          messages: [{ role: 'customer', content: 'Thanks!' }],
          customerName: 'Regular',
          interactionCount: 15,
        },
        brandVoice: { tone: 'friendly' },
      });

      // Even with auto-send enabled, DMs should still require approval by default
      expect(draft.requiresApproval).toBe(true);
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/agents/reply/src/dm-draft.ts
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { ReplyPromptBuilder, BrandVoice } from './reply-prompt-builder';
import { ResponseSafetyChecker } from './response-safety';
import { Platform } from '@rtv/core';

const tracer = trace.getTracer('dm-draft');

export interface DMMessage {
  role: 'customer' | 'brand';
  content: string;
  timestamp?: Date;
}

export interface DMConversationContext {
  messages: DMMessage[];
  customerName?: string;
  summary?: string;
  isVip?: boolean;
  lifetimeValue?: number;
  previousPurchases?: number;
  isFirstInteraction?: boolean;
  interactionCount?: number;
  conversationState?: string;
  orderLookupResult?: {
    status: string;
    trackingNumber?: string;
  };
}

export interface PlatformConstraints {
  maxLength: number;
  supportsQuickReplies?: boolean;
  supportsAttachments?: boolean;
  formalityLevel?: 'low' | 'medium' | 'high';
}

export interface DMDraft {
  id: string;
  threadId: string;
  clientId: string;
  platform: string;
  type: 'dm';
  content: string;
  status: 'pending_review' | 'needs_escalation_review' | 'approved' | 'rejected' | 'sent';

  // Platform
  platformConstraints?: PlatformConstraints;

  // Conversation
  conversationState?: string;
  suggestedQuickReplies?: string[];
  suggestedActions?: string[];

  // Safety
  sensitiveTopics?: string[];
  safetyFlags?: Array<{ type: string; severity: string }>;

  // Approval
  requiresApproval: boolean;
  approvalReason?: string;
  approvedBy?: string;
  approvedAt?: Date;

  // VIP
  metadata?: Record<string, unknown>;

  createdAt: Date;
  expiresAt?: Date;
}

const PLATFORM_DM_CONSTRAINTS: Record<string, PlatformConstraints> = {
  instagram: {
    maxLength: 1000,
    supportsQuickReplies: false,
    supportsAttachments: true,
    formalityLevel: 'low',
  },
  facebook: {
    maxLength: 2000,
    supportsQuickReplies: true,
    supportsAttachments: true,
    formalityLevel: 'medium',
  },
  linkedin: {
    maxLength: 8000,
    supportsQuickReplies: false,
    supportsAttachments: true,
    formalityLevel: 'high',
  },
  x: {
    maxLength: 10000,
    supportsQuickReplies: false,
    supportsAttachments: true,
    formalityLevel: 'medium',
  },
};

export interface LLMClient {
  complete(prompt: string, systemPrompt?: string): Promise<{
    content: string;
    quickReplies?: string[];
    suggestedActions?: string[];
  }>;
}

export interface DMDraftRepository {
  saveDraft(draft: Omit<DMDraft, 'id'>): Promise<DMDraft>;
  getDraft(id: string): Promise<DMDraft | null>;
  updateDraft(id: string, data: Partial<DMDraft>): Promise<DMDraft>;
}

export class DMDraftService {
  private llmClient: LLMClient;
  private repository: DMDraftRepository;
  private promptBuilder: ReplyPromptBuilder;
  private safetyChecker: ResponseSafetyChecker;
  private autoSendEnabled = false;

  constructor(config: {
    llmClient: LLMClient;
    repository: DMDraftRepository;
    promptBuilder: ReplyPromptBuilder;
    safetyChecker: ResponseSafetyChecker;
  }) {
    this.llmClient = config.llmClient;
    this.repository = config.repository;
    this.promptBuilder = config.promptBuilder;
    this.safetyChecker = config.safetyChecker;
  }

  setAutoSendEnabled(enabled: boolean): void {
    this.autoSendEnabled = enabled;
  }

  async generateDraft(input: {
    threadId: string;
    clientId: string;
    platform: Platform | string;
    conversation: DMConversationContext;
    brandVoice: Partial<BrandVoice>;
    includeQuickReplies?: boolean;
  }): Promise<DMDraft> {
    return tracer.startActiveSpan('generateDMDraft', async (span) => {
      span.setAttributes({
        'dm.thread_id': input.threadId,
        'dm.client_id': input.clientId,
        'dm.platform': input.platform,
        'dm.message_count': input.conversation.messages.length,
      });

      const platformConstraints =
        PLATFORM_DM_CONSTRAINTS[input.platform as string] ||
        PLATFORM_DM_CONSTRAINTS.facebook;

      // Build prompt with DM-specific context
      const prompt = await this.buildDMPrompt(input, platformConstraints);
      const systemPrompt = this.buildDMSystemPrompt(input);

      // Generate response
      const response = await this.llmClient.complete(prompt, systemPrompt);

      // Check for sensitive topics
      const sensitiveCheck = await this.safetyChecker.checkSensitiveTopics(
        response.content
      );

      // Safety check
      const safetyResult = await this.safetyChecker.checkResponse({
        draft: response.content,
        brandVoice: input.brandVoice,
        platform: input.platform,
      });

      // Determine status
      let status: DMDraft['status'] = 'pending_review';
      if (sensitiveCheck.hasSensitiveContent || safetyResult.requiresHumanReview) {
        status = 'needs_escalation_review';
      }

      // Determine if approval required
      const { requiresApproval, approvalReason } = this.determineApprovalNeeded(
        input.conversation
      );

      const draft: Omit<DMDraft, 'id'> = {
        threadId: input.threadId,
        clientId: input.clientId,
        platform: input.platform as string,
        type: 'dm',
        content: response.content,
        status,
        platformConstraints,
        conversationState: input.conversation.conversationState,
        suggestedQuickReplies: input.includeQuickReplies
          ? response.quickReplies
          : undefined,
        suggestedActions: response.suggestedActions,
        sensitiveTopics: sensitiveCheck.hasSensitiveContent
          ? sensitiveCheck.topics
          : undefined,
        safetyFlags: safetyResult.violations.map((v) => ({
          type: v.type,
          severity: v.severity,
        })),
        requiresApproval,
        approvalReason,
        metadata: {
          vipHandling: input.conversation.isVip,
          customerName: input.conversation.customerName,
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const savedDraft = await this.repository.saveDraft(draft);

      span.setAttributes({
        'dm.draft_id': savedDraft.id,
        'dm.status': status,
        'dm.requires_approval': requiresApproval,
      });
      span.end();

      return savedDraft;
    });
  }

  private async buildDMPrompt(
    input: {
      threadId: string;
      clientId: string;
      platform: Platform | string;
      conversation: DMConversationContext;
      brandVoice: Partial<BrandVoice>;
    },
    constraints: PlatformConstraints
  ): Promise<string> {
    const sections: string[] = [];

    // Platform context
    sections.push(`## Platform: ${input.platform} Direct Message`);
    sections.push(`Max length: ${constraints.maxLength} characters`);
    sections.push(`Formality: ${constraints.formalityLevel}`);

    // Customer context
    sections.push('\n## Customer Context');
    if (input.conversation.customerName) {
      sections.push(`Name: ${input.conversation.customerName}`);
    }
    if (input.conversation.isVip) {
      sections.push('⭐ VIP Customer - Handle with extra care');
      if (input.conversation.lifetimeValue) {
        sections.push(`Lifetime value: $${input.conversation.lifetimeValue}`);
      }
    }
    if (input.conversation.isFirstInteraction) {
      sections.push('📌 First interaction - Make a great impression');
    }
    if (input.conversation.interactionCount) {
      sections.push(`Previous interactions: ${input.conversation.interactionCount}`);
    }

    // Conversation summary
    if (input.conversation.summary) {
      sections.push('\n## Conversation Summary');
      sections.push(input.conversation.summary);
    }

    // Order lookup if available
    if (input.conversation.orderLookupResult) {
      sections.push('\n## Order Information');
      sections.push(`Status: ${input.conversation.orderLookupResult.status}`);
      if (input.conversation.orderLookupResult.trackingNumber) {
        sections.push(
          `Tracking: ${input.conversation.orderLookupResult.trackingNumber}`
        );
      }
    }

    // Recent messages
    sections.push('\n## Conversation');
    const recentMessages = input.conversation.messages.slice(-10);
    for (const msg of recentMessages) {
      const speaker = msg.role === 'customer' ? '👤 Customer' : '🏢 Brand';
      sections.push(`${speaker}: ${msg.content}`);
    }

    // Task
    sections.push('\n## Your Task');
    sections.push('Draft a helpful, personalized DM response.');
    if (input.conversation.customerName) {
      sections.push(`Address the customer by name: ${input.conversation.customerName}`);
    }
    sections.push('This is a private conversation - be personal and helpful.');

    return sections.join('\n');
  }

  private buildDMSystemPrompt(input: {
    conversation: DMConversationContext;
    brandVoice: Partial<BrandVoice>;
  }): string {
    const isVip = input.conversation.isVip;
    const isFirst = input.conversation.isFirstInteraction;

    return `You are a customer service representative handling direct messages.

IMPORTANT: This is a PRIVATE conversation. Be more personal and detailed than public comments.

${isVip ? '⭐ This is a VIP customer. Provide exceptional service and prioritize their needs.' : ''}
${isFirst ? '📌 This is their first interaction. Make an excellent first impression.' : ''}

Guidelines:
- Use the customer's name naturally (but not excessively)
- Be warm and conversational
- Provide helpful, accurate information
- If you don't know something, offer to find out
- Keep responses focused but thorough
- For complaints, acknowledge feelings before solving problems

Never:
- Share other customers' information
- Make promises you can't keep
- Share internal policies or pricing details not meant for customers
- Be dismissive or defensive

Remember: DMs build relationships. Every interaction is an opportunity.`;
  }

  private determineApprovalNeeded(
    conversation: DMConversationContext
  ): { requiresApproval: boolean; approvalReason?: string } {
    // First interactions always need approval
    if (conversation.isFirstInteraction) {
      return { requiresApproval: true, approvalReason: 'first_interaction' };
    }

    // VIP customers need approval
    if (conversation.isVip) {
      return { requiresApproval: true, approvalReason: 'vip_customer' };
    }

    // DMs generally need approval (safety default)
    return { requiresApproval: true, approvalReason: 'dm_default' };
  }

  async approveDraft(
    draftId: string,
    data: { approvedBy: string }
  ): Promise<DMDraft> {
    return this.repository.updateDraft(draftId, {
      status: 'approved',
      approvedBy: data.approvedBy,
      approvedAt: new Date(),
    });
  }

  async rejectDraft(
    draftId: string,
    data: { rejectedBy: string; reason: string }
  ): Promise<DMDraft> {
    return this.repository.updateDraft(draftId, {
      status: 'rejected',
      metadata: { rejectedBy: data.rejectedBy, rejectionReason: data.reason },
    });
  }

  async getDraft(draftId: string): Promise<DMDraft | null> {
    return this.repository.getDraft(draftId);
  }
}

export function createDMDraftService(config: {
  llmClient: LLMClient;
  repository: DMDraftRepository;
  promptBuilder?: ReplyPromptBuilder;
  safetyChecker?: ResponseSafetyChecker;
}): DMDraftService {
  return new DMDraftService({
    llmClient: config.llmClient,
    repository: config.repository,
    promptBuilder: config.promptBuilder || new ReplyPromptBuilder(),
    safetyChecker: config.safetyChecker || new ResponseSafetyChecker(),
  });
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
| Create | `packages/agents/reply/src/dm-draft.ts` | DM draft service |
| Create | `packages/agents/reply/src/__tests__/dm-draft.test.ts` | Tests |
| Modify | `packages/agents/reply/src/index.ts` | Export DM draft service |

---

## Acceptance Criteria

- [ ] Generate DM reply drafts with personalized greetings
- [ ] Use customer name naturally in responses
- [ ] Handle VIP customers with priority
- [ ] Support first interaction special handling
- [ ] Apply platform-specific constraints (character limits, formality)
- [ ] Include conversation summary for long threads
- [ ] Suggest quick replies (where supported)
- [ ] Suggest next actions based on conversation
- [ ] Track conversation state
- [ ] Flag sensitive topics for escalation
- [ ] Require approval for all DMs (safety default)
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-C5",
  "name": "DM Reply Drafts",
  "description": "Generate and manage DM reply drafts with personalization",
  "status": "pending",
  "priority": "high",
  "complexity": "high",
  "sprint": 4,
  "agent": "C",
  "dependencies": ["S4-C1", "S4-C2", "S4-B1"],
  "blocks": ["S4-D2"],
  "estimated_hours": 12,
  "tags": ["engagement", "reply-agent", "dm", "personalization", "tdd"],
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
  "next_task_hints": ["S4-D1 for escalation triggers", "S4-D2 for human handoff"]
}
```
