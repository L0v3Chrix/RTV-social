import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  createRlmEnv,
  type RlmEnv,
  type Span,
} from '../rlm-env/index.js';

describe('RlmEnv', () => {
  let env: RlmEnv;

  beforeEach(() => {
    env = createRlmEnv({
      clientId: 'client-123',
      defaultBudget: {
        maxTokens: 10000,
        maxTimeMs: 30000,
        maxRetries: 3,
      },
    });
  });

  describe('Session Management', () => {
    test('startSession creates new session with budget', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      expect(session.id).toBeDefined();
      expect(session.budget.remainingTokens).toBe(10000);
      expect(session.status).toBe('active');
    });

    test('session tracks token consumption', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      // Register a test span
      await env.registerSpan(
        {
          id: 'test-span',
          sourceType: 'knowledge_base',
          sourceId: 'kb-1',
          startByte: 0,
          endByte: 100,
          hash: 'abc',
          tokenCount: 500,
        },
        'Test content for the span with query text'
      );

      // Simulate retrieval
      await session.retrieve({
        query: 'test',
        maxTokens: 1000,
      });

      expect(session.budget.remainingTokens).toBeLessThan(10000);
      expect(session.budget.tokensUsed).toBeGreaterThan(0);
    });

    test('session fails when budget exhausted', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
        budget: { maxTokens: 100, maxTimeMs: 30000, maxRetries: 3 },
      });

      // Try to retrieve more than budget allows
      await expect(
        session.retrieve({ query: 'test', maxTokens: 500 })
      ).rejects.toThrow('Budget exhausted');
    });

    test('endSession marks session complete', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      const result = await session.end('success');

      expect(result.status).toBe('completed');
      expect(result.outcome).toBe('success');
      expect(result.totalTokensUsed).toBeDefined();
    });
  });

  describe('Span Operations', () => {
    test('registerSpan stores span metadata', async () => {
      const span: Span = {
        id: 'span-1',
        sourceType: 'knowledge_base',
        sourceId: 'kb-123',
        startByte: 0,
        endByte: 1000,
        hash: 'abc123',
        tokenCount: 250,
      };

      await env.registerSpan(span);

      const retrieved = await env.getSpan('span-1');
      expect(retrieved).toEqual(span);
    });

    test('getSpanContent retrieves content by span', async () => {
      const span: Span = {
        id: 'span-1',
        sourceType: 'knowledge_base',
        sourceId: 'kb-123',
        startByte: 0,
        endByte: 100,
        hash: 'abc123',
        tokenCount: 25,
      };

      // Register span with content
      await env.registerSpan(span, 'This is the span content for testing.');

      const content = await env.getSpanContent('span-1');
      expect(content).toBe('This is the span content for testing.');
    });
  });

  describe('Retrieval', () => {
    test('retrieve returns spans matching query', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      // Register some test spans
      await env.registerSpan(
        {
          id: 'span-1',
          sourceType: 'knowledge_base',
          sourceId: 'kb-123',
          startByte: 0,
          endByte: 100,
          hash: 'abc123',
          tokenCount: 25,
        },
        'Information about product pricing and features.'
      );

      const results = await session.retrieve({
        query: 'pricing',
        maxTokens: 500,
      });

      expect(results.spans.length).toBeGreaterThan(0);
      expect(results.tokensUsed).toBeLessThanOrEqual(500);
    });

    test('retrieve respects maxTokens limit', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      const results = await session.retrieve({
        query: 'test',
        maxTokens: 100,
      });

      expect(results.tokensUsed).toBeLessThanOrEqual(100);
    });

    test('peek retrieves without consuming budget', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      // Register a span first
      await env.registerSpan({
        id: 'span-1',
        sourceType: 'knowledge_base',
        sourceId: 'kb-123',
        startByte: 0,
        endByte: 100,
        hash: 'abc123',
        tokenCount: 25,
      });

      const initialBudget = session.budget.remainingTokens;

      await session.peek({ spanId: 'span-1' });

      // Peek should not consume budget
      expect(session.budget.remainingTokens).toBe(initialBudget);
    });
  });

  describe('Access Logging', () => {
    test('all operations are logged', async () => {
      const accessLog: unknown[] = [];
      const loggedEnv = createRlmEnv({
        clientId: 'client-123',
        onAccess: (entry) => accessLog.push(entry),
      });

      const session = await loggedEnv.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
      });

      await session.retrieve({ query: 'test', maxTokens: 100 });

      expect(accessLog.length).toBeGreaterThan(0);
      expect((accessLog[0] as { operation?: string }).operation).toBeDefined();
      expect((accessLog[0] as { sessionId?: string }).sessionId).toBe(session.id);
    });
  });

  describe('Subcall', () => {
    test('subcall creates child session with reduced budget', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
        budget: { maxTokens: 10000, maxTimeMs: 30000, maxRetries: 3 },
      });

      const childSession = await session.subcall({
        agentType: 'qa-agent',
        budgetFraction: 0.2, // 20% of parent budget
      });

      expect(childSession.budget.remainingTokens).toBe(2000);
      expect(childSession.parentSessionId).toBe(session.id);
    });

    test('subcall budget cannot exceed parent remaining', async () => {
      const session = await env.startSession({
        agentType: 'copy-agent',
        episodeId: 'ep-123',
        budget: { maxTokens: 1000, maxTimeMs: 30000, maxRetries: 3 },
      });

      // Register a span and use some budget
      await env.registerSpan(
        {
          id: 'test-span',
          sourceType: 'knowledge_base',
          sourceId: 'kb-1',
          startByte: 0,
          endByte: 3200,
          hash: 'abc',
          tokenCount: 800,
        },
        'Test content for the span. '.repeat(100)
      );

      await session.retrieve({ query: 'test', maxTokens: 900 });

      const childSession = await session.subcall({
        agentType: 'qa-agent',
        budgetFraction: 0.5,
      });

      // Child gets 50% of REMAINING, not original
      expect(childSession.budget.remainingTokens).toBeLessThanOrEqual(100);
    });
  });
});
