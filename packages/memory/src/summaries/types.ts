/**
 * Summary Type Definitions
 *
 * Summaries are condensed representations for RLM navigation.
 */

import { z } from 'zod';
import type { Span } from '../rlm-env/types.js';

// =====================
// Base Summary
// =====================

export type SummaryType = 'thread' | 'plan' | 'episode' | 'knowledge';

export const BaseSummarySchema = z.object({
  /** Unique summary identifier */
  id: z.string(),

  /** Summary type discriminator */
  type: z.enum(['thread', 'plan', 'episode', 'knowledge']),

  /** Client ID for tenant isolation */
  clientId: z.string(),

  /** Version number (increments on update) */
  version: z.number().int().positive(),

  /** Token count of serialized summary */
  tokenCount: z.number().int().positive(),

  /** Creation timestamp */
  createdAt: z.date(),

  /** Last update timestamp */
  updatedAt: z.date(),
});

export type BaseSummary = z.infer<typeof BaseSummarySchema>;

// =====================
// Thread Summary
// =====================

export const SentimentSchema = z.enum([
  'very_negative',
  'negative',
  'neutral',
  'positive',
  'very_positive',
]);

export type Sentiment = z.infer<typeof SentimentSchema>;

export const ThreadSummarySchema = BaseSummarySchema.extend({
  type: z.literal('thread'),

  /** Original thread ID */
  threadId: z.string(),

  /** Platform where thread exists */
  platform: z.enum([
    'instagram',
    'facebook',
    'tiktok',
    'youtube',
    'linkedin',
    'x',
    'skool',
  ]),

  /** Number of participants */
  participantCount: z.number().int().positive(),

  /** Total message count */
  messageCount: z.number().int().nonnegative(),

  /** Key points extracted from thread */
  keyPoints: z.array(z.string()),

  /** Overall sentiment */
  sentiment: SentimentSchema,

  /** Engagement level (0-1) */
  engagementLevel: z.number().min(0).max(1).optional(),

  /** Whether thread requires human attention */
  needsEscalation: z.boolean().optional(),

  /** Escalation reason if applicable */
  escalationReason: z.string().optional(),

  /** Topics discussed */
  topics: z.array(z.string()).optional(),

  /** Last activity timestamp */
  lastActivityAt: z.date(),

  /** Span IDs pointing to full thread content */
  contentSpanIds: z.array(z.string()).optional(),
});

export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;

export type CreateThreadSummaryInput = Omit<
  ThreadSummary,
  'id' | 'type' | 'version' | 'tokenCount' | 'createdAt' | 'updatedAt'
>;

export type UpdateThreadSummaryInput = Partial<
  Omit<ThreadSummary, 'id' | 'type' | 'clientId' | 'threadId' | 'createdAt'>
>;

// =====================
// Plan Summary
// =====================

export const PlanPhaseSchema = z.enum([
  'planning',
  'creation',
  'review',
  'scheduling',
  'execution',
  'completed',
  'failed',
  'cancelled',
]);

export type PlanPhase = z.infer<typeof PlanPhaseSchema>;

export const PlanSummarySchema = BaseSummarySchema.extend({
  type: z.literal('plan'),

  /** Original plan ID */
  planId: z.string(),

  /** Plan type */
  planType: z.enum(['content_calendar', 'campaign', 'engagement', 'ad_spend']),

  /** Total nodes in plan graph */
  totalNodes: z.number().int().nonnegative(),

  /** Completed nodes */
  completedNodes: z.number().int().nonnegative(),

  /** Pending nodes */
  pendingNodes: z.number().int().nonnegative(),

  /** Failed nodes */
  failedNodes: z.number().int().nonnegative(),

  /** Key milestones reached */
  keyMilestones: z.array(z.string()),

  /** Current execution phase */
  currentPhase: PlanPhaseSchema,

  /** Blocking issues */
  blockers: z.array(z.string()).optional(),

  /** Estimated completion date */
  estimatedCompletionAt: z.date().optional(),

  /** Actual completion date */
  completedAt: z.date().optional(),

  /** Span IDs pointing to full plan content */
  contentSpanIds: z.array(z.string()).optional(),
});

export type PlanSummary = z.infer<typeof PlanSummarySchema>;

export type CreatePlanSummaryInput = Omit<
  PlanSummary,
  'id' | 'type' | 'version' | 'tokenCount' | 'createdAt' | 'updatedAt'
>;

export type UpdatePlanSummaryInput = Partial<
  Omit<PlanSummary, 'id' | 'type' | 'clientId' | 'planId' | 'createdAt'>
>;

// =====================
// Store Types
// =====================

export type Summary = ThreadSummary | PlanSummary;

export interface ListThreadSummariesOptions {
  clientId: string;
  platform?: ThreadSummary['platform'];
  needsEscalation?: boolean;
  minSentiment?: Sentiment;
  since?: Date;
  limit?: number;
}

export interface ListPlanSummariesOptions {
  clientId: string;
  planType?: PlanSummary['planType'];
  status?: 'active' | 'completed' | 'failed';
  since?: Date;
  limit?: number;
}

export interface ToPromptTextOptions {
  maxTokens?: number;
  includeMetadata?: boolean;
}

export interface SummaryStore {
  // Thread summaries
  createThreadSummary(input: CreateThreadSummaryInput): Promise<ThreadSummary>;
  getThreadSummary(id: string): Promise<ThreadSummary | null>;
  getThreadSummaryByThreadId(
    clientId: string,
    threadId: string
  ): Promise<ThreadSummary | null>;
  updateThreadSummary(
    id: string,
    input: UpdateThreadSummaryInput
  ): Promise<ThreadSummary>;
  listThreadSummaries(options: ListThreadSummariesOptions): Promise<ThreadSummary[]>;

  // Plan summaries
  createPlanSummary(input: CreatePlanSummaryInput): Promise<PlanSummary>;
  getPlanSummary(id: string): Promise<PlanSummary | null>;
  getPlanSummaryByPlanId(clientId: string, planId: string): Promise<PlanSummary | null>;
  updatePlanSummary(id: string, input: UpdatePlanSummaryInput): Promise<PlanSummary>;
  listPlanSummaries(options: ListPlanSummariesOptions): Promise<PlanSummary[]>;

  // Span generation
  getSummarySpans(summaryId: string): Promise<Span[]>;

  // Serialization
  toPromptText(summary: Summary, options?: ToPromptTextOptions): string;
}
