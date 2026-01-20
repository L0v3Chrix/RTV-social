/**
 * Context Window Management
 *
 * Token counting, budgeting, truncation, and window composition.
 */

export { createContextWindow } from './window.js';
export { createTokenCounter, createTokenCounterAsync } from './token-counter.js';

export type {
  // Configuration
  ContextWindowConfig,
  TokenCounter,

  // Sections
  ContextSection,
  SectionType,
  AddSectionResult,

  // Truncation
  TruncationStrategy,
  TruncationOptions,

  // Budget
  BudgetAllocation,
  AllocationRatios,

  // Composition
  ComposeOptions,
  ComposedResult,

  // Snapshot
  WindowSnapshot,

  // Main interface
  ContextWindow,
} from './types.js';

export { ContextSectionSchema, SectionTypeSchema } from './types.js';
