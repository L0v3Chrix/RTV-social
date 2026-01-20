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
} from './types.js';
import type { Span } from '../rlm-env/types.js';

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
