/**
 * Memory Retriever Implementation
 *
 * Unified search and retrieval across all memory sources.
 */

import { nanoid } from 'nanoid';
import type {
  MemoryRetriever,
  MemoryRetrieverConfig,
  SearchQuery,
  SearchResult,
  SearchResultItem,
  SearchWithHopsOptions,
  SearchWithHopsResult,
  RetrievalPeekResult,
  ChunkOptions,
  ChunkResult,
  RetrievalContext,
  CreateContextOptions,
  SourceType,
} from './types.js';
import type { ThreadSummary, PlanSummary } from '../summaries/index.js';
import type { Reference } from '../references/index.js';

/**
 * Create a Memory Retriever
 */
export function createMemoryRetriever(config: MemoryRetrieverConfig): MemoryRetriever {
  const { clientId, summaryStore, referenceRegistry, tokenCounter } = config;

  // Helper to create search result item
  function toSearchResultItem(
    item: ThreadSummary | PlanSummary | Reference,
    type: SourceType,
    relevance: number
  ): SearchResultItem {
    const importance = 'importance' in item ? (item.importance ?? 0.5) : 0.5;

    if ('threadId' in item) {
      // ThreadSummary
      const summary = item as ThreadSummary;
      return {
        id: summary.id,
        sourceType: 'thread_summary',
        sourceId: summary.threadId,
        label: `Thread: ${summary.platform} (${summary.messageCount} messages)`,
        relevance,
        importance,
        combinedScore: relevance * 0.7 + importance * 0.3,
        tokenEstimate: summary.tokenCount,
        snippet: summary.keyPoints.slice(0, 2).join('. '),
        metadata: {
          platform: summary.platform,
          sentiment: summary.sentiment,
          lastActivityAt: summary.lastActivityAt,
        },
      };
    }

    if ('planId' in item) {
      // PlanSummary
      const summary = item as PlanSummary;
      const progress =
        summary.totalNodes > 0
          ? Math.round((summary.completedNodes / summary.totalNodes) * 100)
          : 0;
      return {
        id: summary.id,
        sourceType: 'plan_summary',
        sourceId: summary.planId,
        label: `Plan: ${summary.planType} (${progress}% complete)`,
        relevance,
        importance,
        combinedScore: relevance * 0.7 + importance * 0.3,
        tokenEstimate: summary.tokenCount,
        snippet: summary.keyMilestones.slice(0, 2).join('. '),
        metadata: {
          planType: summary.planType,
          currentPhase: summary.currentPhase,
          completedNodes: summary.completedNodes,
          totalNodes: summary.totalNodes,
        },
      };
    }

    // Reference
    const ref = item as Reference;
    return {
      id: ref.id,
      sourceType: ref.type as SourceType,
      sourceId: ref.targetId,
      label: ref.label,
      relevance,
      importance: ref.importance ?? 0.5,
      combinedScore: relevance * 0.7 + (ref.importance ?? 0.5) * 0.3,
      tokenEstimate: ref.spanPointer?.tokenEstimate ?? 100,
      snippet: ref.description,
      metadata: ref.metadata,
    };
  }

  // Simple text matching for relevance
  function calculateRelevance(text: string, query: string): number {
    if (query === '*') return 0.5; // Neutral for wildcard
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/);

    let matches = 0;
    for (const word of words) {
      if (lowerText.includes(word)) matches++;
    }

    return words.length > 0 ? matches / words.length : 0;
  }

  const retriever: MemoryRetriever = {
    config,

    // Search
    async search(query: SearchQuery): Promise<SearchResult> {
      const results: SearchResultItem[] = [];
      let tokensUsed = 0;

      // Search thread summaries
      if (!query.sourceTypes || query.sourceTypes.includes('thread_summary')) {
        const listOptions: { clientId: string; limit: number; since?: Date } = {
          clientId,
          limit: query.maxResults * 2,
        };
        if (query.since) {
          listOptions.since = query.since;
        }
        const threads = await summaryStore.listThreadSummaries(listOptions);

        for (const thread of threads) {
          const searchText = [thread.platform, ...thread.keyPoints, thread.sentiment].join(' ');
          const relevance = calculateRelevance(searchText, query.query);

          if (relevance >= (query.minRelevance ?? 0)) {
            results.push(toSearchResultItem(thread, 'thread_summary', relevance));
          }
        }
      }

      // Search plan summaries
      if (!query.sourceTypes || query.sourceTypes.includes('plan_summary')) {
        const planListOptions: { clientId: string; limit: number; since?: Date } = {
          clientId,
          limit: query.maxResults * 2,
        };
        if (query.since) {
          planListOptions.since = query.since;
        }
        const plans = await summaryStore.listPlanSummaries(planListOptions);

        for (const plan of plans) {
          const searchText = [plan.planType, plan.currentPhase, ...plan.keyMilestones].join(' ');
          const relevance = calculateRelevance(searchText, query.query);

          if (relevance >= (query.minRelevance ?? 0)) {
            results.push(toSearchResultItem(plan, 'plan_summary', relevance));
          }
        }
      }

      // Search references
      const refTypes = query.sourceTypes?.filter(
        (t) => !['thread_summary', 'plan_summary'].includes(t)
      );
      if (!query.sourceTypes || refTypes?.length) {
        const refs = await referenceRegistry.listReferences({
          clientId,
          type: refTypes?.[0] as Reference['type'],
          limit: query.maxResults * 2,
        });

        for (const ref of refs) {
          const searchText = [ref.label, ref.description ?? ''].join(' ');
          const relevance = calculateRelevance(searchText, query.query);

          if (relevance >= (query.minRelevance ?? 0)) {
            results.push(toSearchResultItem(ref, ref.type as SourceType, relevance));
          }
        }
      }

      // Sort results
      switch (query.sortBy) {
        case 'relevance':
          results.sort((a, b) => b.relevance - a.relevance);
          break;
        case 'recency':
          results.sort((a, b) => {
            const aTime = a.metadata?.['lastActivityAt']
              ? new Date(a.metadata['lastActivityAt'] as string).getTime()
              : 0;
            const bTime = b.metadata?.['lastActivityAt']
              ? new Date(b.metadata['lastActivityAt'] as string).getTime()
              : 0;
            return bTime - aTime;
          });
          break;
        case 'importance':
          results.sort((a, b) => b.importance - a.importance);
          break;
        case 'combined':
        default:
          results.sort((a, b) => b.combinedScore - a.combinedScore);
      }

      // Apply token limit
      let limitedResults = results;
      if (query.maxTokens) {
        limitedResults = [];
        for (const item of results) {
          if (tokensUsed + item.tokenEstimate > query.maxTokens) break;
          limitedResults.push(item);
          tokensUsed += item.tokenEstimate;
        }
      } else {
        limitedResults = results.slice(0, query.maxResults);
        tokensUsed = limitedResults.reduce((sum, r) => sum + r.tokenEstimate, 0);
      }

      return {
        items: limitedResults.slice(0, query.maxResults),
        totalCount: results.length,
        tokensUsed,
        query,
      };
    },

    async searchWithHops(options: SearchWithHopsOptions): Promise<SearchWithHopsResult> {
      // First search
      const initialResults = await retriever.search(options);

      if (options.maxHops === 0) {
        return { ...initialResults, hopsUsed: 0 };
      }

      // Follow references
      const seenIds = new Set(initialResults.items.map((r) => r.id));
      const hopPaths: Array<{ from: string; to: string; linkType: string }> = [];
      let hopsUsed = 0;

      for (let hop = 0; hop < options.maxHops; hop++) {
        const newItems: SearchResultItem[] = [];

        for (const item of initialResults.items) {
          const linked = await referenceRegistry.getLinkedReferences(item.id);

          for (const ref of linked) {
            if (!seenIds.has(ref.id)) {
              seenIds.add(ref.id);
              newItems.push(toSearchResultItem(ref, ref.type as SourceType, 0.5));
              hopPaths.push({
                from: item.id,
                to: ref.id,
                linkType: 'related_to',
              });
            }
          }
        }

        if (newItems.length > 0) {
          initialResults.items.push(...newItems);
          hopsUsed = hop + 1;
        } else {
          break;
        }
      }

      // Re-sort and limit
      initialResults.items.sort((a, b) => b.combinedScore - a.combinedScore);
      initialResults.items = initialResults.items.slice(0, options.maxResults);

      return {
        ...initialResults,
        totalCount: seenIds.size,
        hopsUsed,
        hopPaths,
      };
    },

    // Peek
    async peek(id: string): Promise<RetrievalPeekResult | null> {
      // Try thread summary
      const thread = await summaryStore.getThreadSummary(id);
      if (thread) {
        return {
          id: thread.id,
          sourceType: 'thread_summary',
          sourceId: thread.threadId,
          label: `Thread: ${thread.platform}`,
          description: thread.keyPoints.join('. '),
          metadata: {
            platform: thread.platform,
            sentiment: thread.sentiment,
            participantCount: thread.participantCount,
            messageCount: thread.messageCount,
            lastActivityAt: thread.lastActivityAt,
          },
          relatedIds: thread.contentSpanIds ?? [],
          tokenEstimate: thread.tokenCount,
          location: undefined,
        };
      }

      // Try plan summary
      const plan = await summaryStore.getPlanSummary(id);
      if (plan) {
        return {
          id: plan.id,
          sourceType: 'plan_summary',
          sourceId: plan.planId,
          label: `Plan: ${plan.planType}`,
          description: plan.keyMilestones.join('. '),
          metadata: {
            planType: plan.planType,
            currentPhase: plan.currentPhase,
            completedNodes: plan.completedNodes,
            totalNodes: plan.totalNodes,
          },
          relatedIds: plan.contentSpanIds ?? [],
          tokenEstimate: plan.tokenCount,
          location: undefined,
        };
      }

      // Try reference
      const ref = await referenceRegistry.getReference(id);
      if (ref) {
        const linked = await referenceRegistry.getLinkedReferences(id);
        return {
          id: ref.id,
          sourceType: ref.type as SourceType,
          sourceId: ref.targetId,
          label: ref.label,
          description: ref.description,
          metadata: ref.metadata ?? {},
          relatedIds: linked.map((l) => l.id),
          tokenEstimate: ref.spanPointer?.tokenEstimate ?? 100,
          location: ref.spanPointer
            ? {
                spanId: ref.spanPointer.spanId,
                startByte: ref.spanPointer.startByte,
                endByte: ref.spanPointer.endByte,
              }
            : undefined,
        };
      }

      return null;
    },

    // Chunk
    async chunk(id: string, options: ChunkOptions): Promise<ChunkResult> {
      const peek = await retriever.peek(id);
      if (!peek) {
        throw new Error(`Item not found: ${id}`);
      }

      // Get content based on source type
      let content = '';

      if (peek.sourceType === 'thread_summary') {
        const thread = await summaryStore.getThreadSummary(id);
        if (thread) {
          content = summaryStore.toPromptText(thread);
        }
      } else if (peek.sourceType === 'plan_summary') {
        const plan = await summaryStore.getPlanSummary(id);
        if (plan) {
          content = summaryStore.toPromptText(plan);
        }
      } else {
        // Reference - use description as content
        content = peek.description ?? peek.label;
      }

      // Add header if requested
      let header = '';
      if (options.includeHeader) {
        header = `[${peek.sourceType}: ${peek.label}]\n`;
      }

      // Calculate tokens
      const headerTokens = header ? tokenCounter.count(header) : 0;
      const availableTokens = options.maxTokens - headerTokens;
      const contentTokens = tokenCounter.count(content);

      let finalContent = content;
      let truncated = false;

      if (contentTokens > availableTokens) {
        // Truncate content
        truncated = true;
        const ratio = availableTokens / contentTokens;
        const cutIndex = Math.floor(content.length * ratio);

        switch (options.truncationStrategy) {
          case 'sentence': {
            const sentences = content.slice(0, cutIndex).match(/[^.!?]+[.!?]+/g);
            finalContent = sentences ? sentences.join('') + '...' : content.slice(0, cutIndex) + '...';
            break;
          }
          case 'middle': {
            const startLen = Math.floor(cutIndex * 0.6);
            const endLen = cutIndex - startLen;
            finalContent = content.slice(0, startLen) + ' [...] ' + content.slice(-endLen);
            break;
          }
          case 'end':
          default:
            finalContent = content.slice(0, cutIndex) + '...';
        }
      }

      const fullContent = header + finalContent;

      return {
        id,
        content: fullContent,
        tokenCount: tokenCounter.count(fullContent),
        truncated,
        header: header || undefined,
      };
    },

    // Context building
    async createContext(options: CreateContextOptions): Promise<RetrievalContext> {
      const ctx: RetrievalContext = {
        id: `ctx-${nanoid()}`,
        maxTokens: options.maxTokens,
        remainingTokens: options.maxTokens - (options.reservedForResponse ?? 500),
        sections: [],
        retrievedIds: new Set(),
      };

      // Add system prompt if provided
      if (options.systemPrompt) {
        const tokens = tokenCounter.count(options.systemPrompt);
        ctx.sections.push({
          id: 'system',
          type: 'system',
          content: options.systemPrompt,
          priority: 100,
          tokenCount: tokens,
        });
        ctx.remainingTokens -= tokens;
      }

      return ctx;
    },

    async addToContext(ctx: RetrievalContext, id: string): Promise<boolean> {
      if (ctx.retrievedIds.has(id)) return true; // Already added

      const chunk = await retriever.chunk(id, {
        maxTokens: Math.min(ctx.remainingTokens, 500),
        includeHeader: true,
      });

      if (chunk.tokenCount > ctx.remainingTokens) {
        return false; // Doesn't fit
      }

      ctx.sections.push({
        id,
        type: 'retrieved',
        content: chunk.content,
        priority: 50,
        tokenCount: chunk.tokenCount,
      });

      ctx.remainingTokens -= chunk.tokenCount;
      ctx.retrievedIds.add(id);

      return true;
    },

    composeContext(ctx: RetrievalContext): string {
      // Sort by priority
      const sorted = [...ctx.sections].sort((a, b) => b.priority - a.priority);
      return sorted.map((s) => s.content).join('\n\n');
    },
  };

  return retriever;
}
