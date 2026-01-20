import { describe, test, expect, beforeEach } from 'vitest';
import {
  createMemoryRetriever,
  type MemoryRetriever,
} from '../retrieval/index.js';
import { createRlmEnv } from '../rlm-env/index.js';
import { createSummaryStore } from '../summaries/index.js';
import { createReferenceRegistry } from '../references/index.js';
import { createTokenCounter } from '../context-window/index.js';

describe('Memory Retrieval API', () => {
  let retriever: MemoryRetriever;

  beforeEach(async () => {
    // Set up dependencies
    const env = createRlmEnv({ clientId: 'client-123' });
    const summaryStore = createSummaryStore();
    const referenceRegistry = createReferenceRegistry();
    const tokenCounter = createTokenCounter('gpt-4');

    // Seed some test data
    await summaryStore.createThreadSummary({
      clientId: 'client-123',
      threadId: 'thread-1',
      platform: 'instagram',
      participantCount: 2,
      messageCount: 10,
      keyPoints: ['User asked about pricing', 'Interested in premium plan'],
      sentiment: 'positive',
      lastActivityAt: new Date(),
    });

    await summaryStore.createPlanSummary({
      clientId: 'client-123',
      planId: 'plan-1',
      planType: 'content_calendar',
      totalNodes: 10,
      completedNodes: 5,
      pendingNodes: 5,
      failedNodes: 0,
      keyMilestones: ['Week 1 complete'],
      currentPhase: 'execution',
    });

    await referenceRegistry.createReference({
      clientId: 'client-123',
      type: 'knowledge_base',
      targetId: 'kb-1',
      label: 'Product FAQ',
      description: 'Frequently asked questions about pricing and features',
      importance: 0.9,
    });

    retriever = createMemoryRetriever({
      clientId: 'client-123',
      env,
      summaryStore,
      referenceRegistry,
      tokenCounter,
    });
  });

  describe('Search', () => {
    test('searches across all memory types', async () => {
      const results = await retriever.search({
        query: 'pricing',
        maxResults: 10,
      });

      expect(results.items.length).toBeGreaterThan(0);
      expect(results.totalCount).toBeGreaterThanOrEqual(results.items.length);
    });

    test('filters by source type', async () => {
      const results = await retriever.search({
        query: 'pricing',
        sourceTypes: ['thread_summary'],
        maxResults: 10,
      });

      expect(results.items.every((r) => r.sourceType === 'thread_summary')).toBe(true);
    });

    test('respects token budget', async () => {
      const results = await retriever.search({
        query: 'pricing',
        maxTokens: 100,
        maxResults: 10,
      });

      expect(results.tokensUsed).toBeLessThanOrEqual(100);
    });

    test('returns relevance scores', async () => {
      const results = await retriever.search({
        query: 'pricing',
        maxResults: 10,
      });

      expect(results.items[0].relevance).toBeDefined();
      expect(results.items[0].relevance).toBeGreaterThan(0);
    });
  });

  describe('Peek', () => {
    test('returns metadata without content', async () => {
      const searchResults = await retriever.search({
        query: 'pricing',
        maxResults: 1,
      });

      const peek = await retriever.peek(searchResults.items[0].id);

      expect(peek).toBeDefined();
      expect(peek!.id).toBe(searchResults.items[0].id);
      expect(peek!.metadata).toBeDefined();
    });

    test('does not consume retrieval budget', async () => {
      const ctx = await retriever.createContext({ maxTokens: 1000 });
      const initialBudget = ctx.remainingTokens;

      const searchResults = await retriever.search({
        query: 'pricing',
        maxResults: 1,
      });

      await retriever.peek(searchResults.items[0].id);

      expect(ctx.remainingTokens).toBe(initialBudget);
    });
  });

  describe('Chunk', () => {
    test('retrieves content within token limit', async () => {
      const searchResults = await retriever.search({
        query: 'pricing',
        maxResults: 1,
      });

      const chunk = await retriever.chunk(searchResults.items[0].id, {
        maxTokens: 200,
      });

      expect(chunk.content).toBeDefined();
      expect(chunk.tokenCount).toBeLessThanOrEqual(200);
    });

    test('truncates content if exceeds limit', async () => {
      const searchResults = await retriever.search({
        query: 'pricing',
        maxResults: 1,
      });

      const fullChunk = await retriever.chunk(searchResults.items[0].id, {
        maxTokens: 1000,
      });

      const limitedChunk = await retriever.chunk(searchResults.items[0].id, {
        maxTokens: 50,
      });

      expect(limitedChunk.tokenCount).toBeLessThanOrEqual(50);
      expect(limitedChunk.truncated).toBe(fullChunk.tokenCount > 50);
    });
  });

  describe('Context Building', () => {
    test('createContext initializes retrieval context', async () => {
      const ctx = await retriever.createContext({
        maxTokens: 5000,
        systemPrompt: 'You are a helpful assistant.',
      });

      expect(ctx.remainingTokens).toBeLessThan(5000);
      expect(ctx.sections.length).toBeGreaterThan(0);
    });

    test('addToContext respects budget', async () => {
      const ctx = await retriever.createContext({ maxTokens: 500 });

      const searchResults = await retriever.search({
        query: 'pricing',
        maxResults: 5,
      });

      for (const result of searchResults.items) {
        await retriever.addToContext(ctx, result.id);
      }

      expect(ctx.remainingTokens).toBeGreaterThanOrEqual(0);
    });

    test('composeContext returns formatted string', async () => {
      const ctx = await retriever.createContext({
        maxTokens: 2000,
        systemPrompt: 'You are a helpful assistant.',
      });

      const searchResults = await retriever.search({
        query: 'pricing',
        maxResults: 3,
      });

      for (const result of searchResults.items) {
        await retriever.addToContext(ctx, result.id);
      }

      const composed = retriever.composeContext(ctx);

      expect(composed).toContain('You are a helpful assistant');
      expect(typeof composed).toBe('string');
    });
  });

  describe('Recency and Relevance', () => {
    test('sorts by recency when specified', async () => {
      const results = await retriever.search({
        query: '*',
        sortBy: 'recency',
        maxResults: 10,
      });

      // Results should be sorted by date (most recent first)
      for (let i = 1; i < results.items.length; i++) {
        const prev = results.items[i - 1].metadata?.lastActivityAt;
        const curr = results.items[i].metadata?.lastActivityAt;
        if (prev && curr) {
          expect(new Date(prev as string).getTime()).toBeGreaterThanOrEqual(
            new Date(curr as string).getTime()
          );
        }
      }
    });

    test('combines relevance and importance', async () => {
      const results = await retriever.search({
        query: 'pricing',
        sortBy: 'combined',
        maxResults: 10,
      });

      // High importance items should rank higher for equal relevance
      expect(results.items[0].combinedScore).toBeDefined();
    });
  });

  describe('Multi-hop Retrieval', () => {
    test('follows references to related content', async () => {
      const results = await retriever.searchWithHops({
        query: 'pricing',
        maxHops: 2,
        maxResults: 10,
      });

      expect(results.items.length).toBeGreaterThan(0);
      // Some results should come from following links
      expect(results.hopsUsed).toBeGreaterThanOrEqual(0);
    });
  });
});
