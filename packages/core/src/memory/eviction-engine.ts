/**
 * Priority-Based Eviction Engine
 *
 * Manages memory pressure by intelligently evicting entries based on
 * their priority level, access patterns, and age.
 *
 * Inspired by Tesla's attention sink pattern (US20260017019A1).
 */

import { MemoryPriority, canEvict } from './priority.js';
import type { MemoryStore, MemoryEntry } from './types.js';

/**
 * Eviction strategies for SLIDING/EPHEMERAL entries.
 */
export enum EvictionStrategy {
  /** Least Recently Used - evict oldest accessed first */
  LRU = 'lru',
  /** Least Frequently Used - evict least accessed first */
  LFU = 'lfu',
  /** First In First Out - evict oldest created first */
  FIFO = 'fifo',
  /** Weighted score combining recency, frequency, and priority */
  WEIGHTED = 'weighted',
}

/**
 * Client-specific budget configuration.
 */
export interface ClientBudget {
  maxPinned: number;
}

/**
 * Configuration for the eviction engine.
 */
export interface EvictionConfig {
  store: MemoryStore;
  maxEntries?: number;
  maxTokens?: number;
  strategy?: EvictionStrategy;
  clientBudgets?: Record<string, ClientBudget>;
  onEvict?: (event: EvictionEvent) => void;
}

/**
 * Options for an eviction operation.
 */
export interface EvictionOptions {
  /** Target number of tokens to free */
  targetTokens?: number;
  /** Target number of entries to evict */
  targetCount?: number;
  /** Limit eviction to specific client */
  clientId?: string;
  /** Whether a session is currently active */
  sessionActive?: boolean;
  /** Reason for eviction (for audit) */
  reason?: string;
}

/**
 * Result of an eviction operation.
 */
export interface EvictionResult {
  /** IDs of evicted entries */
  evictedIds: string[];
  /** Total tokens freed */
  evictedTokens: number;
  /** Time taken in ms */
  durationMs: number;
  /** Entries skipped by priority */
  skipped: {
    pinned: number;
    session: number;
  };
  /** True if target couldn't be met */
  insufficientEvictable: boolean;
}

/**
 * Audit event emitted on eviction.
 */
export interface EvictionEvent {
  type: 'memory.evicted';
  entryId: string;
  clientId: string | undefined;
  priority: MemoryPriority;
  tokens: number;
  evictionScore: number;
  reason: string;
  timestamp: Date;
}

/**
 * Result of canPin check.
 */
export interface CanPinResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Result of needsEviction check.
 */
export interface NeedsEvictionResult {
  needed: boolean;
  reason?: string;
}

/**
 * Priority-Based Eviction Engine
 *
 * Manages memory pressure by intelligently evicting entries based on
 * their priority level, access patterns, and age.
 */
export class EvictionEngine {
  private store: MemoryStore;
  private maxEntries: number;
  private maxTokens: number;
  private strategy: EvictionStrategy;
  private clientBudgets: Record<string, ClientBudget>;
  private onEvict: ((event: EvictionEvent) => void) | undefined;
  private evictionLock = false;

  constructor(config: EvictionConfig) {
    this.store = config.store;
    this.maxEntries = config.maxEntries ?? Infinity;
    this.maxTokens = config.maxTokens ?? Infinity;
    this.strategy = config.strategy ?? EvictionStrategy.WEIGHTED;
    this.clientBudgets = config.clientBudgets ?? {};
    this.onEvict = config.onEvict;
  }

  /**
   * Evict entries to meet target tokens or count.
   */
  async evict(options: EvictionOptions): Promise<EvictionResult> {
    const start = performance.now();

    // Prevent concurrent evictions
    if (this.evictionLock) {
      return {
        evictedIds: [],
        evictedTokens: 0,
        durationMs: 0,
        skipped: { pinned: 0, session: 0 },
        insufficientEvictable: false,
      };
    }

    this.evictionLock = true;

    try {
      return await this.performEviction(options, start);
    } finally {
      this.evictionLock = false;
    }
  }

  private async performEviction(
    options: EvictionOptions,
    startTime: number
  ): Promise<EvictionResult> {
    const {
      targetTokens = 0,
      targetCount = 0,
      clientId,
      sessionActive = true,
      reason = 'memory_pressure',
    } = options;

    // Early exit if no target
    if (targetTokens <= 0 && targetCount <= 0) {
      return {
        evictedIds: [],
        evictedTokens: 0,
        durationMs: performance.now() - startTime,
        skipped: { pinned: 0, session: 0 },
        insufficientEvictable: false,
      };
    }

    // Get all entries
    const entries = await this.store.getEvictable(
      clientId ? { clientId } : undefined
    );

    // Count non-evictable entries before sorting
    let skippedPinned = 0;
    let skippedSession = 0;

    for (const entry of entries) {
      if (entry.priority === MemoryPriority.PINNED) {
        skippedPinned++;
      } else if (entry.priority === MemoryPriority.SESSION && sessionActive) {
        skippedSession++;
      }
    }

    // Sort by priority tier, then by eviction score within tier
    const sorted = this.sortByEvictionOrder(entries, sessionActive);

    const evictedIds: string[] = [];
    let evictedTokens = 0;

    for (const entry of sorted) {
      // Check if we've met our target
      if (targetTokens > 0 && evictedTokens >= targetTokens) break;
      if (targetCount > 0 && evictedIds.length >= targetCount) break;

      // Check if entry can be evicted (should always be true for sorted entries)
      if (!canEvict(entry.priority, { sessionActive })) {
        continue;
      }

      // Mark for eviction
      evictedIds.push(entry.id);
      evictedTokens += entry.tokens ?? 0;

      // Emit audit event
      if (this.onEvict) {
        this.onEvict({
          type: 'memory.evicted',
          entryId: entry.id,
          clientId: entry.clientId,
          priority: entry.priority,
          tokens: entry.tokens ?? 0,
          evictionScore: entry.evictionScore ?? 0,
          reason,
          timestamp: new Date(),
        });
      }
    }

    // Batch delete evicted entries
    if (evictedIds.length > 0) {
      await this.store.deleteBatch(evictedIds);
    }

    const insufficientEvictable =
      (targetTokens > 0 && evictedTokens < targetTokens) ||
      (targetCount > 0 && evictedIds.length < targetCount);

    return {
      evictedIds,
      evictedTokens,
      durationMs: performance.now() - startTime,
      skipped: {
        pinned: skippedPinned,
        session: skippedSession,
      },
      insufficientEvictable,
    };
  }

  /**
   * Sort entries by eviction order:
   * 1. EPHEMERAL first (always evictable)
   * 2. SLIDING second (LRU/LFU/weighted)
   * 3. SESSION third (only if session inactive)
   * 4. PINNED never
   */
  private sortByEvictionOrder(
    entries: MemoryEntry[],
    sessionActive: boolean
  ): MemoryEntry[] {
    // Group by priority
    const ephemeral: MemoryEntry[] = [];
    const sliding: MemoryEntry[] = [];
    const session: MemoryEntry[] = [];

    for (const entry of entries) {
      switch (entry.priority) {
        case MemoryPriority.EPHEMERAL:
          ephemeral.push(entry);
          break;
        case MemoryPriority.SLIDING:
          sliding.push(entry);
          break;
        case MemoryPriority.SESSION:
          if (!sessionActive) session.push(entry);
          break;
        // PINNED entries excluded
      }
    }

    // Sort within each group by strategy
    const sortFn = this.getSortFunction();
    ephemeral.sort(sortFn);
    sliding.sort(sortFn);
    session.sort(sortFn);

    // Concatenate in eviction order
    return [...ephemeral, ...sliding, ...session];
  }

  /**
   * Get sort function based on eviction strategy.
   */
  private getSortFunction(): (a: MemoryEntry, b: MemoryEntry) => number {
    switch (this.strategy) {
      case EvictionStrategy.LRU:
        return (a, b) =>
          (a.lastAccessed?.getTime() ?? 0) - (b.lastAccessed?.getTime() ?? 0);

      case EvictionStrategy.LFU:
        return (a, b) => (a.accessCount ?? 0) - (b.accessCount ?? 0);

      case EvictionStrategy.FIFO:
        return (a, b) =>
          (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);

      case EvictionStrategy.WEIGHTED:
      default:
        // Lower score = evict first
        return (a, b) => (a.evictionScore ?? 0) - (b.evictionScore ?? 0);
    }
  }

  /**
   * Check if client can pin more content.
   */
  async canPin(clientId: string, tokensToPin: number): Promise<CanPinResult> {
    const budget = this.clientBudgets[clientId]?.maxPinned ?? 2000;
    const currentPinned = await this.store.getPinnedTokens(clientId);

    if (currentPinned + tokensToPin > budget) {
      return {
        allowed: false,
        reason: `Would exceed pinned budget: ${currentPinned + tokensToPin}/${budget}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if eviction is needed based on current usage.
   */
  async needsEviction(): Promise<NeedsEvictionResult> {
    const [count, tokens] = await Promise.all([
      this.store.count(),
      this.store.totalTokens(),
    ]);

    if (count > this.maxEntries) {
      return {
        needed: true,
        reason: `Entry count ${count} exceeds max ${this.maxEntries}`,
      };
    }

    if (tokens > this.maxTokens) {
      return {
        needed: true,
        reason: `Token count ${tokens} exceeds max ${this.maxTokens}`,
      };
    }

    return { needed: false };
  }

  /**
   * Auto-evict if needed, returns eviction result or null.
   */
  async autoEvict(clientId?: string): Promise<EvictionResult | null> {
    const { needed, reason } = await this.needsEviction();

    if (!needed) return null;

    const tokens = await this.store.totalTokens();
    const targetTokens = tokens - this.maxTokens + this.maxTokens * 0.1; // Free 10% extra

    const options: EvictionOptions = {
      targetTokens,
      reason: reason ?? 'auto_eviction',
    };

    if (clientId) {
      options.clientId = clientId;
    }

    return this.evict(options);
  }
}

/**
 * Create a new eviction engine with default configuration.
 */
export function createEvictionEngine(config: EvictionConfig): EvictionEngine {
  return new EvictionEngine(config);
}
