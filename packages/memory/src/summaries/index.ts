/**
 * Summary Storage System
 *
 * First-class storage for ThreadSummary and PlanSummary objects.
 */

export { createSummaryStore } from './store.js';

export type {
  // Base types
  SummaryType,
  BaseSummary,
  Summary,
  Sentiment,
  PlanPhase,

  // Thread summary
  ThreadSummary,
  CreateThreadSummaryInput,
  UpdateThreadSummaryInput,
  ListThreadSummariesOptions,

  // Plan summary
  PlanSummary,
  CreatePlanSummaryInput,
  UpdatePlanSummaryInput,
  ListPlanSummariesOptions,

  // Store
  SummaryStore,
  ToPromptTextOptions,
} from './types.js';

export {
  BaseSummarySchema,
  ThreadSummarySchema,
  PlanSummarySchema,
  SentimentSchema,
  PlanPhaseSchema,
} from './types.js';
