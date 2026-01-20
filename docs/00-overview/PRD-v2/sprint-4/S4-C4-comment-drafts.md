# Build Prompt: S4-C4 — Comment Reply Drafts

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-C4 |
| Sprint | 4 — Engagement |
| Agent | C — Reply Drafting Agent |
| Complexity | High |
| Status | Pending |
| Estimated Effort | 1.5 days |
| Dependencies | S4-C1, S4-C2, S4-B1 |
| Blocks | S4-D1 |

---

## Context

### What We're Building
A comment reply drafting system that generates, stores, and manages draft replies for public comments across all platforms. Drafts are held for human approval before publishing, ensuring brand safety and quality control.

### Why It Matters
- **Human Oversight**: All replies reviewed before sending
- **Quality Control**: Consistent, on-brand responses
- **Efficiency**: AI drafts reduce response time
- **Audit Trail**: Full history of drafts and approvals
- **Safety**: Prevents automated publishing of problematic content

### Spec References
- `docs/03-agents-tools/agent-recursion-contracts.md` — Draft workflow
- `docs/05-policy-safety/compliance-requirements.md` — Approval workflow
- `docs/01-architecture/system-architecture-v3.md` — Draft storage

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
// packages/agents/reply/src/__tests__/comment-draft.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CommentDraftService,
  CommentDraft,
  DraftStatus,
  ApprovalResult,
} from '../comment-draft';
import { ReplyPromptBuilder } from '../reply-prompt-builder';
import { ResponseSafetyChecker } from '../response-safety';
import { createMockLLMClient } from './__mocks__/llm-client';
import { createMockRepository } from './__mocks__/repository';

describe('CommentDraftService', () => {
  let service: CommentDraftService;
  let mockLLM: ReturnType<typeof createMockLLMClient>;
  let mockRepo: ReturnType<typeof createMockRepository>;
  let mockPromptBuilder: ReplyPromptBuilder;
  let mockSafetyChecker: ResponseSafetyChecker;

  beforeEach(() => {
    mockLLM = createMockLLMClient();
    mockRepo = createMockRepository();
    mockPromptBuilder = new ReplyPromptBuilder();
    mockSafetyChecker = new ResponseSafetyChecker();

    service = new CommentDraftService({
      llmClient: mockLLM,
      repository: mockRepo,
      promptBuilder: mockPromptBuilder,
      safetyChecker: mockSafetyChecker,
    });
  });

  describe('generateDraft', () => {
    it('should generate draft for comment thread', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'Thank you for your feedback! We appreciate it.',
      });
      mockRepo.saveDraft.mockResolvedValue({ id: 'draft_123' });

      const draft = await service.generateDraft({
        threadId: 'thread_1',
        clientId: 'client_abc',
        platform: 'facebook',
        threadContext: {
          type: 'comment',
          recentMessages: [
            { content: 'Great product!', direction: 'inbound', author: { displayName: 'User' } },
          ],
        },
        brandVoice: { tone: 'friendly' },
      });

      expect(draft.id).toBe('draft_123');
      expect(draft.content).toContain('Thank you');
      expect(draft.status).toBe('pending_review');
    });

    it('should run safety check on generated draft', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'We guarantee a full refund immediately!',
      });

      const safetyCheckSpy = vi.spyOn(mockSafetyChecker, 'checkResponse');

      await service.generateDraft({
        threadId: 'thread_1',
        clientId: 'client_abc',
        platform: 'instagram',
        threadContext: {
          type: 'comment',
          recentMessages: [
            { content: 'I want my money back', direction: 'inbound' },
          ],
        },
        brandVoice: { tone: 'helpful' },
      });

      expect(safetyCheckSpy).toHaveBeenCalled();
    });

    it('should flag draft for human review if safety check fails', async () => {
      mockLLM.complete.mockResolvedValue({
        content: 'You are absolutely wrong and this is your fault.',
      });

      vi.spyOn(mockSafetyChecker, 'checkResponse').mockResolvedValue({
        safe: false,
        violations: [{ type: 'tone_mismatch', severity: 'high' }],
        requiresHumanReview: true,
      });

      const draft = await service.generateDraft({
        threadId: 'thread_1',
        clientId: 'client_abc',
        platform: 'x',
        threadContext: {
          type: 'comment',
          recentMessages: [{ content: 'Your product sucks', direction: 'inbound' }],
        },
        brandVoice: { tone: 'professional' },
      });

      expect(draft.status).toBe('needs_revision');
      expect(draft.safetyFlags).toHaveLength(1);
    });

    it('should include alternative drafts when requested', async () => {
      mockLLM.complete
        .mockResolvedValueOnce({ content: 'Draft 1: Thanks!' })
        .mockResolvedValueOnce({ content: 'Draft 2: We appreciate you!' })
        .mockResolvedValueOnce({ content: 'Draft 3: Thank you so much!' });

      const drafts = await service.generateDraftWithAlternatives({
        threadId: 'thread_1',
        clientId: 'client_abc',
        platform: 'facebook',
        threadContext: {
          type: 'comment',
          recentMessages: [{ content: 'Nice!', direction: 'inbound' }],
        },
        brandVoice: { tone: 'friendly' },
        alternativeCount: 3,
      });

      expect(drafts).toHaveLength(3);
    });
  });

  describe('approveDraft', () => {
    it('should approve draft and update status', async () => {
      const existingDraft: CommentDraft = {
        id: 'draft_123',
        threadId: 'thread_1',
        clientId: 'client_abc',
        content: 'Thank you!',
        status: 'pending_review',
        createdAt: new Date(),
      };

      mockRepo.getDraft.mockResolvedValue(existingDraft);
      mockRepo.updateDraft.mockResolvedValue({ ...existingDraft, status: 'approved' });

      const result = await service.approveDraft('draft_123', {
        approvedBy: 'operator_1',
        notes: 'Looks good',
      });

      expect(result.status).toBe('approved');
      expect(result.approvedBy).toBe('operator_1');
      expect(result.approvedAt).toBeDefined();
    });

    it('should reject draft with reason', async () => {
      const existingDraft: CommentDraft = {
        id: 'draft_456',
        threadId: 'thread_2',
        clientId: 'client_abc',
        content: 'Not appropriate response',
        status: 'pending_review',
        createdAt: new Date(),
      };

      mockRepo.getDraft.mockResolvedValue(existingDraft);

      const result = await service.rejectDraft('draft_456', {
        rejectedBy: 'operator_2',
        reason: 'Tone is too casual',
      });

      expect(result.status).toBe('rejected');
      expect(result.rejectionReason).toBe('Tone is too casual');
    });
  });

  describe('editDraft', () => {
    it('should allow editing draft content', async () => {
      const existingDraft: CommentDraft = {
        id: 'draft_789',
        threadId: 'thread_3',
        clientId: 'client_abc',
        content: 'Original content',
        status: 'pending_review',
        createdAt: new Date(),
      };

      mockRepo.getDraft.mockResolvedValue(existingDraft);
      mockRepo.updateDraft.mockResolvedValue({
        ...existingDraft,
        content: 'Edited content',
        editedBy: 'operator_1',
      });

      const edited = await service.editDraft('draft_789', {
        content: 'Edited content',
        editedBy: 'operator_1',
      });

      expect(edited.content).toBe('Edited content');
      expect(edited.editHistory).toBeDefined();
    });

    it('should run safety check on edited content', async () => {
      const safetyCheckSpy = vi.spyOn(mockSafetyChecker, 'checkResponse');

      await service.editDraft('draft_789', {
        content: 'New content here',
        editedBy: 'operator_1',
      });

      expect(safetyCheckSpy).toHaveBeenCalled();
    });
  });

  describe('regenerateDraft', () => {
    it('should regenerate draft with feedback', async () => {
      const existingDraft: CommentDraft = {
        id: 'draft_999',
        threadId: 'thread_4',
        clientId: 'client_abc',
        content: 'Too formal response',
        status: 'needs_revision',
        createdAt: new Date(),
      };

      mockRepo.getDraft.mockResolvedValue(existingDraft);
      mockLLM.complete.mockResolvedValue({
        content: 'Hey! Thanks for reaching out! 😊',
      });

      const regenerated = await service.regenerateDraft('draft_999', {
        feedback: 'Make it more casual and friendly',
        requestedBy: 'operator_1',
      });

      expect(regenerated.content).toContain('Hey');
      expect(regenerated.regenerationCount).toBe(1);
    });
  });

  describe('getDraftsForReview', () => {
    it('should return pending drafts for client', async () => {
      mockRepo.queryDrafts.mockResolvedValue({
        drafts: [
          { id: 'draft_1', status: 'pending_review' },
          { id: 'draft_2', status: 'pending_review' },
        ],
        total: 2,
      });

      const result = await service.getDraftsForReview('client_abc', {
        status: 'pending_review',
        limit: 10,
      });

      expect(result.drafts).toHaveLength(2);
    });

    it('should prioritize escalated threads', async () => {
      mockRepo.queryDrafts.mockResolvedValue({
        drafts: [
          { id: 'draft_1', status: 'pending_review', threadPriority: 'high' },
          { id: 'draft_2', status: 'pending_review', threadPriority: 'urgent' },
        ],
        total: 2,
      });

      const result = await service.getDraftsForReview('client_abc', {
        status: 'pending_review',
        sortByPriority: true,
        limit: 10,
      });

      expect(result.drafts[0].threadPriority).toBe('urgent');
    });
  });

  describe('getApprovalMetrics', () => {
    it('should calculate approval rate', async () => {
      mockRepo.getApprovalMetrics.mockResolvedValue({
        total: 100,
        approved: 85,
        rejected: 10,
        edited: 5,
        avgTimeToApproval: 300000, // 5 minutes
      });

      const metrics = await service.getApprovalMetrics('client_abc');

      expect(metrics.approvalRate).toBe(0.85);
      expect(metrics.avgTimeToApprovalMinutes).toBe(5);
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/agents/reply/src/comment-draft.ts
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { ReplyPromptBuilder, ReplyPromptContext, BrandVoice } from './reply-prompt-builder';
import { ResponseSafetyChecker, SafetyViolation } from './response-safety';
import { Platform } from '@rtv/core';

const tracer = trace.getTracer('comment-draft');

export type DraftStatus =
  | 'pending_review'
  | 'needs_revision'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'expired';

export const CommentDraftSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  clientId: z.string(),
  platform: z.string().optional(),
  content: z.string(),
  status: z.enum(['pending_review', 'needs_revision', 'approved', 'rejected', 'published', 'expired']),

  // Safety
  safetyFlags: z.array(z.object({
    type: z.string(),
    severity: z.string(),
    message: z.string().optional(),
  })).optional(),

  // Approval workflow
  approvedBy: z.string().optional(),
  approvedAt: z.date().optional(),
  rejectedBy: z.string().optional(),
  rejectedAt: z.date().optional(),
  rejectionReason: z.string().optional(),

  // Edit tracking
  editedBy: z.string().optional(),
  editedAt: z.date().optional(),
  editHistory: z.array(z.object({
    content: z.string(),
    editedBy: z.string(),
    editedAt: z.date(),
  })).optional(),

  // Regeneration
  regenerationCount: z.number().default(0),
  originalDraftId: z.string().optional(),

  // Metadata
  threadPriority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  createdAt: z.date(),
  expiresAt: z.date().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type CommentDraft = z.infer<typeof CommentDraftSchema>;

export interface ThreadContext {
  type: 'comment' | 'dm' | 'mention';
  recentMessages: Array<{
    content: string;
    direction: 'inbound' | 'outbound';
    author?: { displayName: string };
  }>;
  summary?: string;
  totalMessages?: number;
}

export interface GenerateDraftInput {
  threadId: string;
  clientId: string;
  platform: Platform | string;
  threadContext: ThreadContext;
  brandVoice: Partial<BrandVoice>;
  participantContext?: {
    isVip: boolean;
    engagementScore: number;
  };
}

export interface LLMClient {
  complete(prompt: string, systemPrompt?: string): Promise<{ content: string }>;
}

export interface DraftRepository {
  saveDraft(draft: Omit<CommentDraft, 'id'>): Promise<CommentDraft>;
  getDraft(id: string): Promise<CommentDraft | null>;
  updateDraft(id: string, data: Partial<CommentDraft>): Promise<CommentDraft>;
  queryDrafts(query: {
    clientId: string;
    status?: DraftStatus[];
    limit: number;
    offset?: number;
    sortByPriority?: boolean;
  }): Promise<{ drafts: CommentDraft[]; total: number }>;
  getApprovalMetrics(clientId: string): Promise<{
    total: number;
    approved: number;
    rejected: number;
    edited: number;
    avgTimeToApproval: number;
  }>;
}

export class CommentDraftService {
  private llmClient: LLMClient;
  private repository: DraftRepository;
  private promptBuilder: ReplyPromptBuilder;
  private safetyChecker: ResponseSafetyChecker;

  constructor(config: {
    llmClient: LLMClient;
    repository: DraftRepository;
    promptBuilder: ReplyPromptBuilder;
    safetyChecker: ResponseSafetyChecker;
  }) {
    this.llmClient = config.llmClient;
    this.repository = config.repository;
    this.promptBuilder = config.promptBuilder;
    this.safetyChecker = config.safetyChecker;
  }

  async generateDraft(input: GenerateDraftInput): Promise<CommentDraft> {
    return tracer.startActiveSpan('generateCommentDraft', async (span) => {
      span.setAttributes({
        'draft.thread_id': input.threadId,
        'draft.client_id': input.clientId,
        'draft.platform': input.platform,
      });

      // Build prompt
      const promptContext: ReplyPromptContext = {
        thread: {
          id: input.threadId,
          type: input.threadContext.type,
          platform: input.platform,
          summary: input.threadContext.summary,
          recentMessages: input.threadContext.recentMessages,
          totalMessages: input.threadContext.totalMessages,
        },
        brandVoice: input.brandVoice,
        participantContext: input.participantContext,
      };

      const prompt = await this.promptBuilder.buildPrompt(promptContext);
      const systemPrompt = this.promptBuilder.buildSystemPrompt({
        clientName: input.clientId, // Would be resolved to actual name
      });

      // Generate draft
      const response = await this.llmClient.complete(prompt, systemPrompt);
      const content = response.content;

      // Safety check
      const safetyResult = await this.safetyChecker.checkResponse({
        draft: content,
        brandVoice: input.brandVoice,
        platform: input.platform,
      });

      const status: DraftStatus = safetyResult.requiresHumanReview
        ? 'needs_revision'
        : 'pending_review';

      const safetyFlags = safetyResult.violations.map((v) => ({
        type: v.type,
        severity: v.severity,
        message: v.message,
      }));

      // Save draft
      const draft = await this.repository.saveDraft({
        threadId: input.threadId,
        clientId: input.clientId,
        platform: input.platform as string,
        content,
        status,
        safetyFlags: safetyFlags.length > 0 ? safetyFlags : undefined,
        regenerationCount: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        metadata: {},
      });

      span.setAttributes({
        'draft.id': draft.id,
        'draft.status': status,
        'draft.safety_flags': safetyFlags.length,
      });
      span.end();

      return draft;
    });
  }

  async generateDraftWithAlternatives(
    input: GenerateDraftInput & { alternativeCount: number }
  ): Promise<CommentDraft[]> {
    const drafts: CommentDraft[] = [];

    for (let i = 0; i < input.alternativeCount; i++) {
      const draft = await this.generateDraft(input);
      drafts.push(draft);
    }

    return drafts;
  }

  async approveDraft(
    draftId: string,
    data: { approvedBy: string; notes?: string }
  ): Promise<CommentDraft> {
    const draft = await this.repository.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    return this.repository.updateDraft(draftId, {
      status: 'approved',
      approvedBy: data.approvedBy,
      approvedAt: new Date(),
      metadata: { ...draft.metadata, approvalNotes: data.notes },
    });
  }

  async rejectDraft(
    draftId: string,
    data: { rejectedBy: string; reason: string }
  ): Promise<CommentDraft> {
    const draft = await this.repository.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    return this.repository.updateDraft(draftId, {
      status: 'rejected',
      rejectedBy: data.rejectedBy,
      rejectedAt: new Date(),
      rejectionReason: data.reason,
    });
  }

  async editDraft(
    draftId: string,
    data: { content: string; editedBy: string }
  ): Promise<CommentDraft> {
    const draft = await this.repository.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    // Safety check new content
    await this.safetyChecker.checkResponse({
      draft: data.content,
      brandVoice: {},
      platform: draft.platform || 'facebook',
    });

    const editHistory = draft.editHistory || [];
    editHistory.push({
      content: draft.content,
      editedBy: data.editedBy,
      editedAt: new Date(),
    });

    return this.repository.updateDraft(draftId, {
      content: data.content,
      editedBy: data.editedBy,
      editedAt: new Date(),
      editHistory,
      status: 'pending_review', // Reset to pending after edit
    });
  }

  async regenerateDraft(
    draftId: string,
    data: { feedback: string; requestedBy: string }
  ): Promise<CommentDraft> {
    const draft = await this.repository.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    // Build follow-up prompt with feedback
    const followUpPrompt = this.promptBuilder.buildFollowUpPrompt(
      draft.content,
      data.feedback,
      {
        thread: {
          id: draft.threadId,
          type: 'comment',
          platform: draft.platform || 'facebook',
          recentMessages: [],
        },
        brandVoice: {},
      }
    );

    const response = await this.llmClient.complete(followUpPrompt);

    return this.repository.updateDraft(draftId, {
      content: response.content,
      status: 'pending_review',
      regenerationCount: draft.regenerationCount + 1,
      metadata: {
        ...draft.metadata,
        lastRegenerationFeedback: data.feedback,
        lastRegenerationBy: data.requestedBy,
      },
    });
  }

  async getDraftsForReview(
    clientId: string,
    options: {
      status?: DraftStatus;
      sortByPriority?: boolean;
      limit: number;
    }
  ): Promise<{ drafts: CommentDraft[]; total: number }> {
    return this.repository.queryDrafts({
      clientId,
      status: options.status ? [options.status] : ['pending_review', 'needs_revision'],
      limit: options.limit,
      sortByPriority: options.sortByPriority,
    });
  }

  async getApprovalMetrics(clientId: string): Promise<{
    approvalRate: number;
    avgTimeToApprovalMinutes: number;
    total: number;
    approved: number;
    rejected: number;
    edited: number;
  }> {
    const metrics = await this.repository.getApprovalMetrics(clientId);

    return {
      approvalRate: metrics.total > 0 ? metrics.approved / metrics.total : 0,
      avgTimeToApprovalMinutes: metrics.avgTimeToApproval / 60000,
      ...metrics,
    };
  }
}

export function createCommentDraftService(config: {
  llmClient: LLMClient;
  repository: DraftRepository;
  promptBuilder?: ReplyPromptBuilder;
  safetyChecker?: ResponseSafetyChecker;
}): CommentDraftService {
  return new CommentDraftService({
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
| Create | `packages/agents/reply/src/comment-draft.ts` | Draft service |
| Create | `packages/agents/reply/src/__tests__/comment-draft.test.ts` | Tests |
| Modify | `packages/agents/reply/src/index.ts` | Export draft service |

---

## Acceptance Criteria

- [ ] Generate comment reply drafts with LLM
- [ ] Run safety checks on generated content
- [ ] Flag drafts needing revision
- [ ] Support draft approval workflow
- [ ] Support draft rejection with reason
- [ ] Allow editing drafts with history tracking
- [ ] Support regeneration with feedback
- [ ] Generate alternative drafts
- [ ] Query drafts by status
- [ ] Track approval metrics
- [ ] Set draft expiration
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-C4",
  "name": "Comment Reply Drafts",
  "description": "Generate and manage comment reply drafts for approval",
  "status": "pending",
  "priority": "high",
  "complexity": "high",
  "sprint": 4,
  "agent": "C",
  "dependencies": ["S4-C1", "S4-C2", "S4-B1"],
  "blocks": ["S4-D1"],
  "estimated_hours": 12,
  "tags": ["engagement", "reply-agent", "drafts", "approval", "tdd"],
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
  "next_task_hints": ["S4-C5 for DM reply drafts", "S4-D1 for escalation triggers"]
}
```
