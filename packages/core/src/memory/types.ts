/**
 * Memory Types
 *
 * Shared types for the memory system including store interface
 * and entry definitions.
 */

import { MemoryPriority } from './priority.js';

/**
 * Memory entry stored in the system.
 */
export interface MemoryEntry {
  id: string;
  clientId?: string;
  key?: string;
  content?: string;
  category?: string;
  priority: MemoryPriority;
  tokens?: number;
  accessCount?: number;
  evictionScore?: number;
  sessionId?: string;
  lastAccessed?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Options for retrieving evictable entries.
 */
export interface GetEvictableOptions {
  clientId?: string;
  sessionActive?: boolean;
  limit?: number;
}

/**
 * Memory store interface for persistence.
 */
export interface MemoryStore {
  /**
   * Insert one or more entries.
   */
  insert(entries: MemoryEntry | MemoryEntry[]): Promise<void>;

  /**
   * Get entries eligible for eviction.
   * Returns entries sorted by eviction score (lowest first).
   */
  getEvictable(options?: GetEvictableOptions): Promise<MemoryEntry[]>;

  /**
   * Delete multiple entries by ID.
   */
  deleteBatch(ids: string[]): Promise<void>;

  /**
   * Get total entry count.
   */
  count(clientId?: string): Promise<number>;

  /**
   * Get total token count.
   */
  totalTokens(clientId?: string): Promise<number>;

  /**
   * Get total pinned tokens for a client.
   */
  getPinnedTokens(clientId: string): Promise<number>;

  /**
   * Get entry by ID.
   */
  get?(id: string): Promise<MemoryEntry | undefined>;

  /**
   * Update an entry.
   */
  update?(id: string, updates: Partial<MemoryEntry>): Promise<void>;
}

/**
 * In-memory store implementation for testing.
 */
export class InMemoryStore implements MemoryStore {
  private entries = new Map<string, MemoryEntry>();

  async insert(entries: MemoryEntry | MemoryEntry[]): Promise<void> {
    const items = Array.isArray(entries) ? entries : [entries];
    for (const item of items) {
      this.entries.set(item.id, {
        ...item,
        createdAt: item.createdAt ?? new Date(),
        updatedAt: new Date(),
      });
    }
  }

  async getEvictable(options?: GetEvictableOptions): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];

    for (const entry of this.entries.values()) {
      // Filter by clientId if specified
      if (options?.clientId && entry.clientId !== options.clientId) {
        continue;
      }

      results.push(entry);
    }

    // Sort by eviction score (lowest first)
    results.sort((a, b) => (a.evictionScore ?? 0) - (b.evictionScore ?? 0));

    // Apply limit if specified
    if (options?.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  async deleteBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.entries.delete(id);
    }
  }

  async count(clientId?: string): Promise<number> {
    if (!clientId) {
      return this.entries.size;
    }
    let count = 0;
    for (const entry of this.entries.values()) {
      if (entry.clientId === clientId) count++;
    }
    return count;
  }

  async totalTokens(clientId?: string): Promise<number> {
    let total = 0;
    for (const entry of this.entries.values()) {
      if (clientId && entry.clientId !== clientId) continue;
      total += entry.tokens ?? 0;
    }
    return total;
  }

  async getPinnedTokens(clientId: string): Promise<number> {
    let total = 0;
    for (const entry of this.entries.values()) {
      if (entry.clientId === clientId && entry.priority === MemoryPriority.PINNED) {
        total += entry.tokens ?? 0;
      }
    }
    return total;
  }

  async get(id: string): Promise<MemoryEntry | undefined> {
    return this.entries.get(id);
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    const existing = this.entries.get(id);
    if (existing) {
      this.entries.set(id, {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Clear all entries (for testing).
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get all entries (for testing).
   */
  getAll(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }
}
