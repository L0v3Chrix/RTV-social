/**
 * @rtv/core Memory Module
 *
 * Memory priority system for RLM (Recursive Language Model) integration.
 * Implements Tesla-inspired attention sink patterns.
 */

export {
  MemoryPriority,
  DEFAULT_PINNED_BUDGET,
  PRIORITY_CATEGORIES,
  isValidPriority,
  getPriorityWeight,
  canEvict,
  calculateEvictionScore,
  validatePinnedBudget,
  getPinnedBudgetUsage,
  suggestPriority,
  type EvictionContext,
  type PinnedBudgetResult,
  type PinnedBudgetUsage,
} from './priority.js';

export {
  EvictionEngine,
  EvictionStrategy,
  createEvictionEngine,
  type EvictionConfig,
  type EvictionOptions,
  type EvictionResult,
  type EvictionEvent,
  type CanPinResult,
  type NeedsEvictionResult,
  type ClientBudget,
} from './eviction-engine.js';

export {
  InMemoryStore,
  type MemoryEntry,
  type MemoryStore,
  type GetEvictableOptions,
} from './types.js';

export {
  PinnedContextManager,
  PinnedCategory,
  createPinnedContextManager,
  type PinnedEntry,
  type PinResult,
  type BudgetUsage,
  type ListOptions,
  type GetOptions,
  type InjectionOptions,
  type PinnedContextManagerConfig,
  type ClientInitDefaults,
  type PinnedEvent,
  type UnpinnedEvent,
} from './pinned-context-manager.js';
