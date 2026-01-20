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
