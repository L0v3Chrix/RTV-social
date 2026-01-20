# Build Prompt: S5-D4 — Engagement E2E Tests

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-D4 |
| Sprint | 5 - Gated Rollout |
| Agent | D - Full E2E Test Suite |
| Task Name | Engagement E2E Tests |
| Complexity | High |
| Status | pending |
| Dependencies | S5-A3, S4-A1 through S4-D5 |
| Blocked By | None |

---

## Context

### What This Builds

Comprehensive end-to-end tests for the Engagement loop, validating the complete flow from platform event through draft generation, human approval, to response posting. Tests the human-in-the-loop workflow.

### Why It Matters

- **Human-in-Loop**: Validates approval workflow works correctly
- **Response Quality**: Ensures AI drafts meet brand standards
- **Escalation Testing**: Confirms escalation paths work
- **Safety Critical**: Engagement has highest risk of brand damage
- **Compliance**: Proves human approval before any response

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Engagement Loop | Loop architecture |
| `docs/05-policy-safety/human-approval-policy.md` | Approval | Human-in-loop requirements |
| `docs/00-overview/sprint-4-tasks.md` | All Agents | Engagement components |

---

## Prerequisites

### Completed Tasks

- [x] S5-A3: E2E test suite framework
- [x] S4-A1 through S4-A5: Event ingestion components
- [x] S4-B1 through S4-B5: Reply drafting components
- [x] S4-C1 through S4-C5: Approval queue components
- [x] S4-D1 through S4-D5: Escalation components

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/tests/e2e/src/engagement/__tests__/engagement-flow.e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { E2ETestContext, createE2ETestContext } from '../../test-context';
import { EngagementE2ERunner } from '../engagement-runner';

describe('Engagement E2E: Event → Draft → Approved → Posted', () => {
  let ctx: E2ETestContext;
  let runner: EngagementE2ERunner;

  beforeAll(async () => {
    ctx = await createE2ETestContext({
      sandbox: true,
      clientId: 'e2e_engagement_test',
      platforms: ['meta', 'linkedin'],
    });
    runner = new EngagementE2ERunner(ctx);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await ctx.resetEngagementState();
  });

  describe('Complete Engagement Flow', () => {
    it('should process comment and generate draft', async () => {
      // Simulate incoming comment
      const event = await runner.simulateComment({
        platform: 'meta',
        postId: 'test_post_123',
        commentId: 'comment_456',
        authorName: 'Test User',
        content: 'This is a great product! How much does it cost?',
        timestamp: new Date().toISOString(),
      });

      expect(event.id).toBeDefined();
      expect(event.status).toBe('received');

      // Wait for draft generation
      const draft = await runner.waitForDraft(event.id, {
        timeout: 30000,
      });

      expect(draft.status).toBe('pending_approval');
      expect(draft.content).toBeDefined();
      expect(draft.content.length).toBeGreaterThan(0);
    }, 60000);

    it('should approve draft and post reply', async () => {
      const event = await runner.simulateComment({
        platform: 'meta',
        postId: 'test_post_123',
        commentId: 'comment_789',
        authorName: 'Test User',
        content: 'Love this! Where can I buy?',
        timestamp: new Date().toISOString(),
      });

      const draft = await runner.waitForDraft(event.id);

      // Approve the draft
      const approved = await runner.approveDraft(draft.id, {
        approvedBy: 'e2e_test_operator',
      });

      expect(approved.status).toBe('approved');

      // Wait for reply to be posted
      const posted = await runner.waitForReplyPosted(draft.id, {
        timeout: 60000,
      });

      expect(posted.status).toBe('posted');
      expect(posted.platformReplyId).toBeDefined();
    }, 120000);

    it('should handle draft edit before approval', async () => {
      const event = await runner.simulateComment({
        platform: 'meta',
        postId: 'test_post_123',
        commentId: 'comment_edit',
        authorName: 'Test User',
        content: 'Question about your service',
        timestamp: new Date().toISOString(),
      });

      const draft = await runner.waitForDraft(event.id);

      // Edit the draft
      const edited = await runner.editDraft(draft.id, {
        newContent: 'Edited response content',
        editedBy: 'e2e_test_operator',
        editReason: 'Improved response',
      });

      expect(edited.content).toBe('Edited response content');
      expect(edited.editHistory.length).toBe(1);

      // Approve edited draft
      const approved = await runner.approveDraft(edited.id, {
        approvedBy: 'e2e_test_operator',
      });

      expect(approved.status).toBe('approved');
    }, 90000);

    it('should reject draft and regenerate', async () => {
      const event = await runner.simulateComment({
        platform: 'meta',
        postId: 'test_post_123',
        commentId: 'comment_reject',
        authorName: 'Test User',
        content: 'I have a complaint',
        timestamp: new Date().toISOString(),
      });

      const draft = await runner.waitForDraft(event.id);

      // Reject the draft
      const rejected = await runner.rejectDraft(draft.id, {
        rejectedBy: 'e2e_test_operator',
        reason: 'Too generic',
        feedback: 'Make it more empathetic',
      });

      expect(rejected.status).toBe('rejected');

      // Request regeneration
      const newDraft = await runner.regenerateDraft(draft.id, {
        additionalContext: 'Be more empathetic and apologetic',
      });

      expect(newDraft.id).not.toBe(draft.id);
      expect(newDraft.previousDraftId).toBe(draft.id);
      expect(newDraft.status).toBe('pending_approval');
    }, 120000);
  });

  describe('Direct Message Handling', () => {
    it('should process DM and generate draft', async () => {
      const event = await runner.simulateDM({
        platform: 'meta',
        conversationId: 'dm_conv_123',
        messageId: 'dm_msg_456',
        senderName: 'DM User',
        content: 'Hi, I need help with my order',
        timestamp: new Date().toISOString(),
      });

      expect(event.eventType).toBe('dm');

      const draft = await runner.waitForDraft(event.id);

      expect(draft.eventType).toBe('dm');
      expect(draft.content).toBeDefined();
    }, 60000);

    it('should maintain conversation context for DMs', async () => {
      const conversationId = 'dm_context_test';

      // First message
      const event1 = await runner.simulateDM({
        platform: 'meta',
        conversationId,
        messageId: 'msg_1',
        senderName: 'Context User',
        content: 'I ordered product ABC',
        timestamp: new Date().toISOString(),
      });

      await runner.waitForDraft(event1.id);
      await runner.approveDraft(event1.id, { approvedBy: 'operator' });
      await runner.waitForReplyPosted(event1.id);

      // Second message in same conversation
      const event2 = await runner.simulateDM({
        platform: 'meta',
        conversationId,
        messageId: 'msg_2',
        senderName: 'Context User',
        content: 'When will it arrive?',
        timestamp: new Date().toISOString(),
      });

      const draft2 = await runner.waitForDraft(event2.id);

      // Draft should reference previous context
      expect(draft2.conversationContext.length).toBeGreaterThan(0);
      expect(draft2.conversationContext).toContain('product ABC');
    }, 180000);
  });

  describe('Escalation Flow', () => {
    it('should auto-escalate high-severity events', async () => {
      const event = await runner.simulateComment({
        platform: 'meta',
        postId: 'test_post_123',
        commentId: 'escalate_comment',
        authorName: 'Angry User',
        content: 'THIS IS TERRIBLE! I WANT A REFUND! SCAM!',
        timestamp: new Date().toISOString(),
      });

      // Should be auto-escalated due to sentiment
      const escalation = await runner.waitForEscalation(event.id, {
        timeout: 30000,
      });

      expect(escalation.escalated).toBe(true);
      expect(escalation.reason).toContain('negative sentiment');
      expect(escalation.severity).toBe('high');
    }, 60000);

    it('should escalate when manual escalation requested', async () => {
      const event = await runner.simulateComment({
        platform: 'meta',
        postId: 'test_post_123',
        commentId: 'manual_escalate',
        authorName: 'Tricky User',
        content: 'I have a complex legal question',
        timestamp: new Date().toISOString(),
      });

      const draft = await runner.waitForDraft(event.id);

      // Manually escalate
      const escalation = await runner.escalate(draft.id, {
        escalatedBy: 'e2e_test_operator',
        reason: 'Legal question - needs specialist',
        severity: 'high',
      });

      expect(escalation.status).toBe('escalated');
      expect(draft.status).toBe('escalated');
    }, 60000);

    it('should resolve escalation and allow response', async () => {
      const event = await runner.simulateComment({
        platform: 'meta',
        postId: 'test_post_123',
        commentId: 'resolve_escalate',
        authorName: 'Concerned User',
        content: 'Urgent issue that needs manager attention',
        timestamp: new Date().toISOString(),
      });

      // Force escalation
      const draft = await runner.waitForDraft(event.id);
      await runner.escalate(draft.id, {
        escalatedBy: 'operator',
        reason: 'Needs review',
        severity: 'medium',
      });

      // Resolve escalation
      const resolved = await runner.resolveEscalation(draft.id, {
        resolvedBy: 'manager',
        resolution: 'Approved to respond with standard policy',
        suggestedResponse: 'Please contact support at...',
      });

      expect(resolved.escalationStatus).toBe('resolved');

      // Should now be able to approve and post
      await runner.approveDraft(draft.id, { approvedBy: 'manager' });
      const posted = await runner.waitForReplyPosted(draft.id);

      expect(posted.status).toBe('posted');
    }, 120000);
  });

  describe('Approval Queue', () => {
    it('should add drafts to approval queue', async () => {
      // Generate multiple events
      const events = await Promise.all([
        runner.simulateComment({
          platform: 'meta',
          postId: 'queue_post',
          commentId: 'queue_1',
          authorName: 'User 1',
          content: 'Question 1',
          timestamp: new Date().toISOString(),
        }),
        runner.simulateComment({
          platform: 'meta',
          postId: 'queue_post',
          commentId: 'queue_2',
          authorName: 'User 2',
          content: 'Question 2',
          timestamp: new Date().toISOString(),
        }),
      ]);

      // Wait for drafts
      await Promise.all(events.map(e => runner.waitForDraft(e.id)));

      // Check queue
      const queue = await runner.getApprovalQueue();

      expect(queue.items.length).toBeGreaterThanOrEqual(2);
      expect(queue.items[0].status).toBe('pending_approval');
    }, 90000);

    it('should prioritize queue by age and severity', async () => {
      // Create older event (simulate)
      const oldEvent = await runner.simulateComment({
        platform: 'meta',
        postId: 'priority_post',
        commentId: 'old_comment',
        authorName: 'Old User',
        content: 'Old question',
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      });

      // Create newer high-severity event
      const urgentEvent = await runner.simulateComment({
        platform: 'meta',
        postId: 'priority_post',
        commentId: 'urgent_comment',
        authorName: 'Urgent User',
        content: 'URGENT COMPLAINT!',
        timestamp: new Date().toISOString(),
      });

      await Promise.all([
        runner.waitForDraft(oldEvent.id),
        runner.waitForDraft(urgentEvent.id),
      ]);

      const queue = await runner.getApprovalQueue({ sortBy: 'priority' });

      // Urgent should be higher priority despite being newer
      const urgentIndex = queue.items.findIndex((i: any) => i.eventId === urgentEvent.id);
      const oldIndex = queue.items.findIndex((i: any) => i.eventId === oldEvent.id);

      expect(urgentIndex).toBeLessThan(oldIndex);
    }, 90000);
  });

  describe('Human Approval Enforcement', () => {
    it('should never auto-post without human approval', async () => {
      const event = await runner.simulateComment({
        platform: 'meta',
        postId: 'no_auto_post',
        commentId: 'no_auto',
        authorName: 'User',
        content: 'Simple question',
        timestamp: new Date().toISOString(),
      });

      const draft = await runner.waitForDraft(event.id);

      // Wait and verify no auto-posting
      await runner.sleep(5000);

      const status = await runner.getDraftStatus(draft.id);

      expect(status.status).toBe('pending_approval');
      expect(status.postedAt).toBeUndefined();
    }, 60000);

    it('should require approval even for positive sentiment', async () => {
      const event = await runner.simulateComment({
        platform: 'meta',
        postId: 'positive_post',
        commentId: 'positive',
        authorName: 'Happy User',
        content: 'Amazing product! Best purchase ever! Thank you so much!',
        timestamp: new Date().toISOString(),
      });

      const draft = await runner.waitForDraft(event.id);

      // Even positive comments need approval
      expect(draft.status).toBe('pending_approval');
      expect(draft.autoApproved).toBe(false);
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle failed draft generation gracefully', async () => {
      ctx.setMockFailure('draft_generation', true);

      const event = await runner.simulateComment({
        platform: 'meta',
        postId: 'fail_post',
        commentId: 'fail_draft',
        authorName: 'User',
        content: 'Question',
        timestamp: new Date().toISOString(),
      });

      // Should create incident, not crash
      await runner.sleep(10000);

      const eventStatus = await runner.getEventStatus(event.id);
      expect(eventStatus.draftGenerationFailed).toBe(true);
      expect(eventStatus.incident).toBeDefined();

      ctx.setMockFailure('draft_generation', false);
    }, 30000);

    it('should handle failed reply posting with retry', async () => {
      const event = await runner.simulateComment({
        platform: 'meta',
        postId: 'fail_reply_post',
        commentId: 'fail_reply',
        authorName: 'User',
        content: 'Question',
        timestamp: new Date().toISOString(),
      });

      const draft = await runner.waitForDraft(event.id);
      await runner.approveDraft(draft.id, { approvedBy: 'operator' });

      // Set transient failure
      ctx.setTransientFailure('reply_posting', 1);

      const posted = await runner.waitForReplyPosted(draft.id, {
        timeout: 120000,
      });

      expect(posted.status).toBe('posted');
      expect(posted.retryCount).toBe(1);
    }, 180000);
  });

  describe('Performance', () => {
    it('should generate draft within SLO (15 seconds)', async () => {
      const startTime = Date.now();

      const event = await runner.simulateComment({
        platform: 'meta',
        postId: 'perf_post',
        commentId: 'perf_comment',
        authorName: 'User',
        content: 'Performance test question',
        timestamp: new Date().toISOString(),
      });

      await runner.waitForDraft(event.id);

      const duration = Date.now() - startTime;

      // SLO: Draft generation < 15 seconds
      expect(duration).toBeLessThan(15000);
    }, 30000);
  });
});
```

### Phase 2: Engagement E2E Runner

**File:** `packages/tests/e2e/src/engagement/engagement-runner.ts`

```typescript
import { E2ETestContext } from '../test-context';

export interface CommentEventInput {
  platform: string;
  postId: string;
  commentId: string;
  authorName: string;
  content: string;
  timestamp: string;
}

export interface DMEventInput {
  platform: string;
  conversationId: string;
  messageId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export interface ApprovalInput {
  approvedBy: string;
  notes?: string;
}

export interface EditInput {
  newContent: string;
  editedBy: string;
  editReason: string;
}

export interface RejectInput {
  rejectedBy: string;
  reason: string;
  feedback?: string;
}

export interface EscalationInput {
  escalatedBy: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export interface WaitOptions {
  timeout?: number;
  pollInterval?: number;
}

export class EngagementE2ERunner {
  private ctx: E2ETestContext;

  constructor(ctx: E2ETestContext) {
    this.ctx = ctx;
  }

  async simulateComment(input: CommentEventInput): Promise<any> {
    const response = await this.ctx.api.post('/api/engagement/events/comment', {
      clientId: this.ctx.clientId,
      ...input,
    });
    return response.data;
  }

  async simulateDM(input: DMEventInput): Promise<any> {
    const response = await this.ctx.api.post('/api/engagement/events/dm', {
      clientId: this.ctx.clientId,
      ...input,
    });
    return response.data;
  }

  async waitForDraft(eventId: string, options: WaitOptions = {}): Promise<any> {
    const timeout = options.timeout ?? 30000;
    const pollInterval = options.pollInterval ?? 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getEventStatus(eventId);
      if (status.draft) {
        return status.draft;
      }
      if (status.draftGenerationFailed) {
        throw new Error(`Draft generation failed: ${status.error}`);
      }
      await this.sleep(pollInterval);
    }
    throw new Error(`Draft generation timeout after ${timeout}ms`);
  }

  async approveDraft(draftId: string, input: ApprovalInput): Promise<any> {
    const response = await this.ctx.api.post(`/api/engagement/drafts/${draftId}/approve`, {
      clientId: this.ctx.clientId,
      ...input,
    });
    return response.data;
  }

  async editDraft(draftId: string, input: EditInput): Promise<any> {
    const response = await this.ctx.api.post(`/api/engagement/drafts/${draftId}/edit`, {
      clientId: this.ctx.clientId,
      ...input,
    });
    return response.data;
  }

  async rejectDraft(draftId: string, input: RejectInput): Promise<any> {
    const response = await this.ctx.api.post(`/api/engagement/drafts/${draftId}/reject`, {
      clientId: this.ctx.clientId,
      ...input,
    });
    return response.data;
  }

  async regenerateDraft(draftId: string, options: { additionalContext?: string }): Promise<any> {
    const response = await this.ctx.api.post(`/api/engagement/drafts/${draftId}/regenerate`, {
      clientId: this.ctx.clientId,
      ...options,
    });
    return response.data;
  }

  async waitForReplyPosted(draftId: string, options: WaitOptions = {}): Promise<any> {
    const timeout = options.timeout ?? 60000;
    const pollInterval = options.pollInterval ?? 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getDraftStatus(draftId);
      if (status.status === 'posted') {
        return status;
      }
      if (status.status === 'failed') {
        throw new Error(`Reply posting failed: ${status.error}`);
      }
      await this.sleep(pollInterval);
    }
    throw new Error(`Reply posting timeout after ${timeout}ms`);
  }

  async escalate(draftId: string, input: EscalationInput): Promise<any> {
    const response = await this.ctx.api.post(`/api/engagement/drafts/${draftId}/escalate`, {
      clientId: this.ctx.clientId,
      ...input,
    });
    return response.data;
  }

  async waitForEscalation(eventId: string, options: WaitOptions = {}): Promise<any> {
    const timeout = options.timeout ?? 30000;
    const pollInterval = options.pollInterval ?? 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getEventStatus(eventId);
      if (status.escalation) {
        return status.escalation;
      }
      await this.sleep(pollInterval);
    }
    return { escalated: false };
  }

  async resolveEscalation(draftId: string, input: {
    resolvedBy: string;
    resolution: string;
    suggestedResponse?: string;
  }): Promise<any> {
    const response = await this.ctx.api.post(`/api/engagement/drafts/${draftId}/resolve-escalation`, {
      clientId: this.ctx.clientId,
      ...input,
    });
    return response.data;
  }

  async getApprovalQueue(options?: { sortBy?: string }): Promise<any> {
    const response = await this.ctx.api.get('/api/engagement/queue', {
      params: { clientId: this.ctx.clientId, ...options },
    });
    return response.data;
  }

  async getEventStatus(eventId: string): Promise<any> {
    const response = await this.ctx.api.get(`/api/engagement/events/${eventId}`);
    return response.data;
  }

  async getDraftStatus(draftId: string): Promise<any> {
    const response = await this.ctx.api.get(`/api/engagement/drafts/${draftId}`);
    return response.data;
  }

  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Acceptance Criteria

- [ ] Comment → Draft → Approve → Post flow works end-to-end
- [ ] DM handling with conversation context works
- [ ] Draft editing and rejection/regeneration works
- [ ] Auto-escalation triggers on high-severity events
- [ ] Manual escalation and resolution works
- [ ] Approval queue shows all pending drafts
- [ ] Human approval ALWAYS required (no auto-posting)
- [ ] Error handling for failed draft generation
- [ ] Performance within SLO (draft generation < 15 seconds)

---

## JSON Task Block

```json
{
  "task_id": "S5-D4",
  "name": "Engagement E2E Tests",
  "description": "End-to-end tests for engagement flow: Event → Draft → Approved → Posted",
  "status": "pending",
  "dependencies": ["S5-A3", "S4-A1", "S4-B1", "S4-C1", "S4-D1"],
  "blocks": [],
  "agent": "D",
  "sprint": 5,
  "complexity": "high"
}
```
