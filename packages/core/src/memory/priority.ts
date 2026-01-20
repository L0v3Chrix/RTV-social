/**
 * Memory Priority System
 *
 * Inspired by Tesla's "attention sink" pattern from US20260017019A1.
 * Ensures critical context survives memory pressure.
 */

/**
 * Priority levels for memory entries.
 *
 * PINNED: Never evicted. Used for brand voice, compliance rules.
 * SESSION: Kept for campaign duration. Used for active objectives.
 * SLIDING: Normal LRU eviction. Used for general history.
 * EPHEMERAL: Single-use. Discarded after task completion.
 */
export enum MemoryPriority {
  PINNED = 'pinned',
  SESSION = 'session',
  SLIDING = 'sliding',
  EPHEMERAL = 'ephemeral',
}

/**
 * Priority weights for eviction scoring.
 * Higher weight = less likely to be evicted.
 */
const PRIORITY_WEIGHTS: Record<MemoryPriority, number> = {
  [MemoryPriority.PINNED]: 1000,
  [MemoryPriority.SESSION]: 100,
  [MemoryPriority.SLIDING]: 10,
  [MemoryPriority.EPHEMERAL]: 1,
};

/**
 * Default pinned token budget per client (tokens).
 */
export const DEFAULT_PINNED_BUDGET = 2000;

/**
 * Validates if a string is a valid MemoryPriority value.
 */
export function isValidPriority(value: unknown): value is MemoryPriority {
  if (typeof value !== 'string') return false;
  return Object.values(MemoryPriority).includes(value as MemoryPriority);
}

/**
 * Returns the eviction weight for a priority level.
 * Higher weight = less likely to be evicted.
 */
export function getPriorityWeight(priority: MemoryPriority): number {
  return PRIORITY_WEIGHTS[priority];
}

/**
 * Eviction context for conditional eviction rules.
 */
export interface EvictionContext {
  sessionActive?: boolean;
  memoryPressure?: 'low' | 'medium' | 'high';
  entryAge?: number; // milliseconds
}

/**
 * Determines if a memory entry can be evicted based on its priority.
 */
export function canEvict(
  priority: MemoryPriority,
  context: EvictionContext = {}
): boolean {
  switch (priority) {
    case MemoryPriority.PINNED:
      // Never evict pinned entries
      return false;

    case MemoryPriority.SESSION:
      // Only evict when session ends
      return context.sessionActive === false;

    case MemoryPriority.SLIDING:
      // Always evictable (LRU)
      return true;

    case MemoryPriority.EPHEMERAL:
      // Always evictable
      return true;

    default:
      // Unknown priority - allow eviction
      return true;
  }
}

/**
 * Calculates eviction score for a memory entry.
 * Lower score = more likely to be evicted.
 *
 * Formula: weight × recency_factor × access_factor
 */
export function calculateEvictionScore(
  priority: MemoryPriority,
  lastAccessed: Date,
  accessCount: number
): number {
  const weight = getPriorityWeight(priority);
  const ageMs = Date.now() - lastAccessed.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  // Recency factor: decays over time (half-life of 24 hours)
  const recencyFactor = Math.pow(0.5, ageHours / 24);

  // Access factor: logarithmic to prevent runaway scores
  const accessFactor = Math.log2(accessCount + 1) + 1;

  return weight * recencyFactor * accessFactor;
}

/**
 * Pinned budget validation result.
 */
export interface PinnedBudgetResult {
  valid: boolean;
  error?: string;
  tokensUsed?: number;
  tokensRemaining?: number;
}

/**
 * Pinned budget usage summary.
 */
export interface PinnedBudgetUsage {
  total: number;
  used: number;
  remaining: number;
  entries: number;
}

/**
 * Validates that pinning new content won't exceed budget.
 *
 * @param clientId - Client identifier
 * @param entry - Entry to be pinned
 * @param getCurrentUsage - Function to get current pinned token count
 * @param estimateTokens - Function to estimate tokens in content
 * @param maxBudget - Maximum pinned token budget (default: 2000)
 */
export async function validatePinnedBudget(
  clientId: string,
  entry: { content: string; priority: MemoryPriority },
  getCurrentUsage: (clientId: string) => Promise<number>,
  estimateTokens: (content: string) => number,
  maxBudget = DEFAULT_PINNED_BUDGET
): Promise<PinnedBudgetResult> {
  // Only validate for PINNED priority
  if (entry.priority !== MemoryPriority.PINNED) {
    return { valid: true };
  }

  const currentUsage = await getCurrentUsage(clientId);
  const newTokens = estimateTokens(entry.content);
  const totalAfter = currentUsage + newTokens;

  if (totalAfter > maxBudget) {
    return {
      valid: false,
      error: `Exceeds pinned token budget: ${totalAfter}/${maxBudget} tokens`,
      tokensUsed: currentUsage,
      tokensRemaining: maxBudget - currentUsage,
    };
  }

  return {
    valid: true,
    tokensUsed: totalAfter,
    tokensRemaining: maxBudget - totalAfter,
  };
}

/**
 * Gets pinned budget usage for a client.
 */
export async function getPinnedBudgetUsage(
  clientId: string,
  getCurrentUsage: (clientId: string) => Promise<number>,
  getEntryCount: (clientId: string) => Promise<number>,
  maxBudget = DEFAULT_PINNED_BUDGET
): Promise<PinnedBudgetUsage> {
  const used = await getCurrentUsage(clientId);
  const entries = await getEntryCount(clientId);

  return {
    total: maxBudget,
    used,
    remaining: maxBudget - used,
    entries,
  };
}

/**
 * Categories of content typically assigned to each priority.
 */
export const PRIORITY_CATEGORIES: Record<MemoryPriority, string[]> = {
  [MemoryPriority.PINNED]: [
    'brand_voice',
    'compliance_rules',
    'prohibited_topics',
    'tone_guidelines',
    'legal_disclaimers',
  ],
  [MemoryPriority.SESSION]: [
    'campaign_objectives',
    'active_threads',
    'current_offers',
    'session_context',
  ],
  [MemoryPriority.SLIDING]: [
    'engagement_history',
    'post_performance',
    'audience_insights',
    'conversation_summaries',
  ],
  [MemoryPriority.EPHEMERAL]: [
    'intermediate_drafts',
    'tool_outputs',
    'temporary_calculations',
    'debug_context',
  ],
};

/**
 * Suggests a priority level based on content category.
 */
export function suggestPriority(category: string): MemoryPriority {
  for (const [priority, categories] of Object.entries(PRIORITY_CATEGORIES)) {
    if (categories.includes(category)) {
      return priority as MemoryPriority;
    }
  }
  return MemoryPriority.SLIDING; // Default
}
