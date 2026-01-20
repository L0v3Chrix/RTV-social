/**
 * S1-D5: Checkpoint Service
 *
 * Handles checkpoint CRUD operations for episode suspension and resume.
 * Uses in-memory storage by default, can be extended with database storage.
 */

import { nanoid } from 'nanoid';
import {
  type Checkpoint,
  type CheckpointData,
  type CheckpointStore,
  type PruneOptions,
  CheckpointDataSchema,
} from './types.js';

/**
 * In-memory checkpoint service implementation.
 *
 * For production use, extend this with database-backed storage
 * using @rtv/db checkpoints schema.
 */
export class CheckpointService implements CheckpointStore {
  private checkpoints = new Map<string, Checkpoint>();

  /**
   * Create a new checkpoint.
   */
  async create(data: CheckpointData): Promise<Checkpoint> {
    // Validate input
    const validated = CheckpointDataSchema.parse(data);

    if (!validated.episodeId) {
      throw new Error('episodeId is required');
    }

    const id = `cp_${nanoid(12)}`;
    const now = new Date().toISOString();

    const checkpoint: Checkpoint = {
      id,
      episodeId: validated.episodeId,
      phase: validated.phase,
      progress: validated.progress,
      loopCount: validated.loopCount,
      context: validated.context,
      budgetState: validated.budgetState,
      metadata: validated.metadata,
      createdAt: now,
      version: 1,
    };

    this.checkpoints.set(id, checkpoint);

    return checkpoint;
  }

  /**
   * Get the latest checkpoint for an episode.
   */
  async getLatest(episodeId: string): Promise<Checkpoint | null> {
    const episodeCheckpoints = this.getEpisodeCheckpoints(episodeId);

    if (episodeCheckpoints.length === 0) {
      return null;
    }

    // Use nullish coalescing to satisfy TypeScript (array access could be undefined)
    return episodeCheckpoints[0] ?? null;
  }

  /**
   * Get all checkpoints for an episode, ordered by creation time descending.
   */
  async getByEpisode(episodeId: string): Promise<Checkpoint[]> {
    return this.getEpisodeCheckpoints(episodeId);
  }

  /**
   * Restore checkpoint data from a checkpoint ID.
   */
  async restore(checkpointId: string): Promise<CheckpointData | null> {
    const checkpoint = this.checkpoints.get(checkpointId);

    if (!checkpoint) {
      return null;
    }

    return {
      episodeId: checkpoint.episodeId,
      phase: checkpoint.phase,
      progress: checkpoint.progress,
      loopCount: checkpoint.loopCount,
      context: checkpoint.context,
      budgetState: checkpoint.budgetState,
      metadata: checkpoint.metadata,
    };
  }

  /**
   * Delete a checkpoint by ID.
   */
  async delete(checkpointId: string): Promise<void> {
    this.checkpoints.delete(checkpointId);
  }

  /**
   * Delete all checkpoints for an episode.
   */
  async deleteByEpisode(episodeId: string): Promise<void> {
    for (const [id, cp] of this.checkpoints.entries()) {
      if (cp.episodeId === episodeId) {
        this.checkpoints.delete(id);
      }
    }
  }

  /**
   * Prune old checkpoints beyond retention limit.
   */
  async prune(options: PruneOptions): Promise<number> {
    const { maxAgeDays = 7 } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    const cutoffTime = cutoffDate.getTime();

    let deleted = 0;

    for (const [id, cp] of this.checkpoints.entries()) {
      const createdTime = new Date(cp.createdAt).getTime();
      if (createdTime < cutoffTime) {
        this.checkpoints.delete(id);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Prune checkpoints for an episode beyond count limit.
   */
  async pruneByEpisode(episodeId: string, options: PruneOptions): Promise<number> {
    const { maxCount = 10 } = options;

    const checkpoints = this.getEpisodeCheckpoints(episodeId);

    if (checkpoints.length <= maxCount) {
      return 0;
    }

    const toDelete = checkpoints.slice(maxCount);

    for (const cp of toDelete) {
      this.checkpoints.delete(cp.id);
    }

    return toDelete.length;
  }

  /**
   * Get all checkpoints for an episode, sorted by creation time descending.
   */
  private getEpisodeCheckpoints(episodeId: string): Checkpoint[] {
    return Array.from(this.checkpoints.values())
      .filter((cp) => cp.episodeId === episodeId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Clear all checkpoints (for testing).
   */
  clear(): void {
    this.checkpoints.clear();
  }
}

// Re-export types for convenience
export type { Checkpoint, CheckpointData, CheckpointStore, PruneOptions };
