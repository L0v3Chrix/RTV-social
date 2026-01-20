/**
 * Context Window Type Definitions
 *
 * Types for managing LLM context windows and token budgets.
 */

import { z } from 'zod';

// =====================
// Section Types
// =====================

export const SectionTypeSchema = z.enum([
  'system', // System prompt
  'conversation', // Conversation history
  'retrieved', // Retrieved from memory
  'tool_result', // Tool call results
  'instruction', // Dynamic instructions
]);

export type SectionType = z.infer<typeof SectionTypeSchema>;

export const ContextSectionSchema = z.object({
  /** Unique section identifier */
  id: z.string(),

  /** Section type for categorization */
  type: SectionTypeSchema,

  /** Content of the section */
  content: z.string(),

  /** Priority for inclusion (0-100) */
  priority: z.number().min(0).max(100),

  /** Token count (computed) */
  tokenCount: z.number().int().nonnegative().optional(),

  /** Whether to evict lower priority sections if needed */
  evictLowerPriority: z.boolean().optional(),

  /** Metadata for tracking */
  metadata: z.record(z.unknown()).optional(),
});

export type ContextSection = z.infer<typeof ContextSectionSchema>;

// =====================
// Token Counter
// =====================

export interface TokenCounter {
  /** Count exact tokens for text */
  count(text: string): number;

  /** Count tokens for multiple texts */
  countMany(texts: string[]): number;

  /** Fast estimate (less accurate, faster) */
  estimate(text: string): number;

  /** Model name */
  model: string;
}

// =====================
// Truncation
// =====================

export type TruncationStrategy = 'end' | 'sentence' | 'middle' | 'paragraph';

export interface TruncationOptions {
  /** How to truncate */
  strategy?: TruncationStrategy;

  /** Suffix to add when truncated */
  suffix?: string;

  /** For 'middle' strategy, ratio of start to keep */
  startRatio?: number;
}

// =====================
// Budget Allocation
// =====================

export interface BudgetAllocation {
  system: number;
  conversation: number;
  retrieved: number;
  tool_result: number;
  instruction: number;
  response: number;
  [key: string]: number;
}

export type AllocationRatios = Partial<Record<keyof BudgetAllocation, number>>;

// =====================
// Composition
// =====================

export interface ComposeOptions {
  /** Separator between sections */
  separator?: string;

  /** Include section headers */
  includeHeaders?: boolean;

  /** Order override (by section ID) */
  order?: string[];
}

export interface ComposedResult {
  /** Composed content */
  content: string;

  /** Total tokens used */
  totalTokens: number;

  /** Number of sections included */
  sectionCount: number;

  /** Tokens remaining for response */
  remainingForResponse: number;

  /** Sections that were truncated */
  truncatedSections: string[];

  /** Sections that were evicted */
  evictedSections: string[];
}

// =====================
// Snapshot
// =====================

export interface WindowSnapshot {
  /** Sections at snapshot time */
  sections: ContextSection[];

  /** Tokens used at snapshot time */
  usedTokens: number;

  /** Snapshot timestamp */
  createdAt: Date;
}

// =====================
// Add Result
// =====================

export interface AddSectionResult {
  /** Whether section was added */
  added: boolean;

  /** Token count of section */
  tokenCount: number;

  /** Reason if not added */
  reason?: string;

  /** Sections evicted to make room */
  evicted?: string[];

  /** Whether section was truncated */
  truncated?: boolean;
}

// =====================
// Configuration
// =====================

export interface ContextWindowConfig {
  /** Maximum tokens for the window */
  maxTokens: number;

  /** Tokens reserved for response */
  reservedForResponse: number;

  /** Token counter implementation */
  tokenCounter: TokenCounter;

  /** Default truncation strategy */
  defaultTruncation?: TruncationStrategy;
}

// =====================
// Main Interface
// =====================

export interface ContextWindow {
  /** Configuration */
  readonly config: ContextWindowConfig;

  // Section management
  addSection(section: ContextSection): AddSectionResult;
  removeSection(id: string): boolean;
  getSection(id: string): ContextSection | null;
  getSections(): ContextSection[];
  clearSections(): void;

  // Budget
  getRemainingTokens(): number;
  getUsedTokens(): number;
  allocateBudget(ratios: AllocationRatios): BudgetAllocation;
  fitToAllocation(
    content: string,
    category: keyof BudgetAllocation,
    allocation: BudgetAllocation
  ): string;

  // Truncation
  truncateToFit(
    content: string,
    maxTokens: number,
    options?: TruncationOptions
  ): string;

  // Composition
  compose(options?: ComposeOptions): string;
  composeWithMetadata(options?: ComposeOptions): ComposedResult;

  // Snapshot
  snapshot(): WindowSnapshot;
  restore(snapshot: WindowSnapshot): void;
}
