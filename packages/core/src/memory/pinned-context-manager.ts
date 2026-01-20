/**
 * Pinned Context Manager
 *
 * Manages critical context that should never be evicted from memory.
 * Implements the "attention sink" pattern for preserving brand voice,
 * compliance rules, and other critical context.
 *
 * Inspired by Tesla's attention sink pattern (US20260017019A1).
 */

import { EventEmitter } from 'events';
import { MemoryPriority } from './priority.js';
import type { MemoryStore, MemoryEntry } from './types.js';

/**
 * Categories of pinned content.
 */
export enum PinnedCategory {
  BRAND_VOICE = 'brand_voice',
  COMPLIANCE_RULES = 'compliance_rules',
  PROHIBITED_TOPICS = 'prohibited_topics',
  LEGAL_DISCLAIMERS = 'legal_disclaimers',
  TONE_GUIDELINES = 'tone_guidelines',
}

/**
 * Category display order and headers.
 */
const CATEGORY_CONFIG: Record<PinnedCategory, { order: number; header: string }> = {
  [PinnedCategory.BRAND_VOICE]: { order: 1, header: 'Brand Voice' },
  [PinnedCategory.TONE_GUIDELINES]: { order: 2, header: 'Tone Guidelines' },
  [PinnedCategory.COMPLIANCE_RULES]: { order: 3, header: 'Compliance Rules' },
  [PinnedCategory.PROHIBITED_TOPICS]: { order: 4, header: 'Prohibited Topics' },
  [PinnedCategory.LEGAL_DISCLAIMERS]: { order: 5, header: 'Legal Disclaimers' },
};

/**
 * A pinned memory entry.
 */
export interface PinnedEntry {
  id: string;
  clientId: string;
  category: PinnedCategory;
  content: string;
  label: string;
  tokens: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of a pin operation.
 */
export interface PinResult {
  success: boolean;
  entry?: PinnedEntry;
  error?: string;
}

/**
 * Budget usage summary.
 */
export interface BudgetUsage {
  total: number;
  used: number;
  remaining: number;
  entries: number;
}

/**
 * Options for listing pinned entries.
 */
export interface ListOptions {
  category?: PinnedCategory;
}

/**
 * Options for getting a single entry with client context.
 */
export interface GetOptions {
  clientId?: string;
}

/**
 * Options for context injection.
 */
export interface InjectionOptions {
  categories?: PinnedCategory[];
}

/**
 * Configuration for PinnedContextManager.
 */
export interface PinnedContextManagerConfig {
  store: MemoryStore;
  defaultBudget?: number;
  tokenEstimator: (content: string) => number;
}

/**
 * Client initialization defaults.
 */
export interface ClientInitDefaults {
  brandVoice?: string;
  defaultCompliance?: boolean;
}

/**
 * Event emitted when content is pinned.
 */
export interface PinnedEvent {
  action: 'pin';
  entry: PinnedEntry;
  timestamp: Date;
}

/**
 * Event emitted when content is unpinned.
 */
export interface UnpinnedEvent {
  action: 'unpin';
  entry: PinnedEntry;
  timestamp: Date;
}

/**
 * Extended memory store interface for pinned context operations.
 */
interface ExtendedMemoryStore extends MemoryStore {
  getAll?(): MemoryEntry[];
}

/**
 * Manages critical context that should never be evicted.
 *
 * Implements the "attention sink" pattern for preserving
 * brand voice, compliance rules, and other critical context.
 */
export class PinnedContextManager extends EventEmitter {
  private store: ExtendedMemoryStore;
  private defaultBudget: number;
  private tokenEstimator: (content: string) => number;
  private entriesCache = new Map<string, MemoryEntry>();

  constructor(config: PinnedContextManagerConfig) {
    super();
    this.store = config.store;
    this.defaultBudget = config.defaultBudget ?? 2000;
    this.tokenEstimator = config.tokenEstimator;
  }

  /**
   * Pin content to prevent eviction.
   */
  async pin(params: {
    clientId: string;
    category: PinnedCategory;
    content: string;
    label: string;
  }): Promise<PinResult> {
    const { clientId, category, content, label } = params;
    const tokens = this.tokenEstimator(content);

    // Check budget
    const usage = await this.getUsage(clientId);
    if (usage.used + tokens > usage.total) {
      return {
        success: false,
        error: `Exceeds pinned budget: ${usage.used + tokens}/${usage.total} tokens`,
      };
    }

    // Create entry
    const id = `pinned-${clientId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date();

    const memoryEntry: MemoryEntry = {
      id,
      clientId,
      content,
      category: category as string,
      priority: MemoryPriority.PINNED,
      tokens,
      accessCount: 0,
      evictionScore: 1000, // High score for PINNED
      createdAt: now,
      updatedAt: now,
      lastAccessed: now,
      metadata: {
        label,
        type: 'pinned_context',
      },
    };

    await this.store.insert(memoryEntry);
    this.entriesCache.set(id, memoryEntry);

    const pinnedEntry = this.toPinnedEntry(memoryEntry);
    if (pinnedEntry) {
      this.emit('pinned', {
        action: 'pin',
        entry: pinnedEntry,
        timestamp: now,
      });

      return { success: true, entry: pinnedEntry };
    }

    return { success: false, error: 'Failed to create entry' };
  }

  /**
   * Get budget usage for a client.
   */
  async getUsage(clientId: string): Promise<BudgetUsage> {
    const entries = await this.list(clientId);
    const used = entries.reduce((sum, e) => sum + e.tokens, 0);

    return {
      total: this.defaultBudget,
      used,
      remaining: this.defaultBudget - used,
      entries: entries.length,
    };
  }

  /**
   * List pinned entries for a client.
   */
  async list(clientId: string, options?: ListOptions): Promise<PinnedEntry[]> {
    // Get entries from store or cache
    const allEntries = await this.getAllEntries();

    const filtered = allEntries.filter((entry) => {
      if (entry.clientId !== clientId) return false;
      if (entry.priority !== MemoryPriority.PINNED) return false;
      if (options?.category && entry.category !== options.category) return false;
      return true;
    });

    return filtered.map((e) => this.toPinnedEntry(e)).filter(Boolean) as PinnedEntry[];
  }

  /**
   * Get a single pinned entry.
   */
  async get(id: string, options?: GetOptions): Promise<PinnedEntry | null> {
    // Check cache first
    let raw = this.entriesCache.get(id);

    if (!raw && this.store.get) {
      raw = await this.store.get(id);
    }

    if (!raw) return null;
    if (options?.clientId && raw.clientId !== options.clientId) return null;
    if (raw.priority !== MemoryPriority.PINNED) return null;

    return this.toPinnedEntry(raw);
  }

  /**
   * Update a pinned entry.
   */
  async update(
    id: string,
    updates: { content?: string; label?: string }
  ): Promise<PinResult> {
    const existing = await this.get(id);
    if (!existing) {
      return { success: false, error: 'Entry not found' };
    }

    // If updating content, check budget
    if (updates.content) {
      const newTokens = this.tokenEstimator(updates.content);
      const usage = await this.getUsage(existing.clientId);
      const adjustedUsed = usage.used - existing.tokens + newTokens;

      if (adjustedUsed > usage.total) {
        return {
          success: false,
          error: `Update exceeds budget: ${adjustedUsed}/${usage.total} tokens`,
        };
      }
    }

    // Get the raw entry to update
    const rawEntry = this.entriesCache.get(id);
    if (rawEntry && this.store.update) {
      // Build update object conditionally to avoid overwriting with undefined
      const storeUpdates: Partial<MemoryEntry> = {
        updatedAt: new Date(),
      };

      if (updates.content !== undefined) {
        storeUpdates.content = updates.content;
        storeUpdates.tokens = this.tokenEstimator(updates.content);
      }

      if (updates.label !== undefined) {
        storeUpdates.metadata = { ...rawEntry.metadata, label: updates.label };
      }

      await this.store.update(id, storeUpdates);

      // Update cache
      const updatedEntry: MemoryEntry = {
        ...rawEntry,
        ...storeUpdates,
      };
      this.entriesCache.set(id, updatedEntry);
    }

    const updated = await this.get(id);
    if (updated) {
      return { success: true, entry: updated };
    }
    return { success: true };
  }

  /**
   * Remove a pinned entry.
   */
  async unpin(id: string): Promise<PinResult> {
    const existing = await this.get(id);
    if (!existing) {
      return { success: false, error: 'Entry not found' };
    }

    await this.store.deleteBatch([id]);
    this.entriesCache.delete(id);

    this.emit('unpinned', {
      action: 'unpin',
      entry: existing,
      timestamp: new Date(),
    });

    return { success: true };
  }

  /**
   * Get formatted context for RLMEnv injection.
   */
  async getInjectionContext(
    clientId: string,
    options?: InjectionOptions
  ): Promise<string> {
    let entries = await this.list(clientId);

    // Filter by categories if specified
    if (options?.categories) {
      entries = entries.filter((e) => options.categories!.includes(e.category));
    }

    // Group by category
    const grouped = new Map<PinnedCategory, PinnedEntry[]>();
    for (const entry of entries) {
      const list = grouped.get(entry.category) ?? [];
      list.push(entry);
      grouped.set(entry.category, list);
    }

    // Build output in category order
    const sections: string[] = [];
    const sortedCategories = [...grouped.keys()].sort(
      (a, b) => CATEGORY_CONFIG[a].order - CATEGORY_CONFIG[b].order
    );

    for (const category of sortedCategories) {
      const categoryEntries = grouped.get(category)!;
      const header = CATEGORY_CONFIG[category].header;

      sections.push(`## ${header}`);
      for (const entry of categoryEntries) {
        if (entry.label) {
          sections.push(`### ${entry.label}`);
        }
        sections.push(entry.content);
        sections.push('');
      }
    }

    return sections.join('\n').trim();
  }

  /**
   * Estimate tokens for injection context.
   */
  async estimateInjectionTokens(
    clientId: string,
    options?: InjectionOptions
  ): Promise<number> {
    const context = await this.getInjectionContext(clientId, options);
    return this.tokenEstimator(context);
  }

  /**
   * Initialize client with default pinned content.
   */
  async initializeClient(clientId: string, defaults: ClientInitDefaults): Promise<void> {
    const existing = await this.list(clientId);

    // Only add brand voice if none exists
    if (
      defaults.brandVoice &&
      !existing.some((e) => e.category === PinnedCategory.BRAND_VOICE)
    ) {
      await this.pin({
        clientId,
        category: PinnedCategory.BRAND_VOICE,
        content: defaults.brandVoice,
        label: 'Default Brand Voice',
      });
    }

    // Add default compliance if requested and none exists
    if (
      defaults.defaultCompliance &&
      !existing.some((e) => e.category === PinnedCategory.COMPLIANCE_RULES)
    ) {
      await this.pin({
        clientId,
        category: PinnedCategory.COMPLIANCE_RULES,
        content:
          'Follow all platform terms of service. Do not make false claims. Respect user privacy.',
        label: 'Default Compliance',
      });
    }
  }

  /**
   * Get all entries from store or cache.
   */
  private async getAllEntries(): Promise<MemoryEntry[]> {
    // If store has getAll, use it
    if (this.store.getAll) {
      return this.store.getAll();
    }

    // Otherwise return cached entries
    return Array.from(this.entriesCache.values());
  }

  /**
   * Convert raw store entry to PinnedEntry.
   */
  private toPinnedEntry(raw: MemoryEntry): PinnedEntry | null {
    if (!raw.category) return null;

    // Validate category
    const validCategories = Object.values(PinnedCategory);
    if (!validCategories.includes(raw.category as PinnedCategory)) {
      return null;
    }

    return {
      id: raw.id,
      clientId: raw.clientId ?? '',
      category: raw.category as PinnedCategory,
      content: raw.content ?? '',
      label: ((raw.metadata as Record<string, unknown> | undefined)?.['label'] as string | undefined) ?? '',
      tokens: raw.tokens ?? 0,
      createdAt: raw.createdAt ?? new Date(),
      updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date(),
    };
  }
}

/**
 * Create a new PinnedContextManager instance.
 */
export function createPinnedContextManager(
  config: PinnedContextManagerConfig
): PinnedContextManager {
  return new PinnedContextManager(config);
}
