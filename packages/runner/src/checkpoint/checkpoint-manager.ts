/**
 * S1-D5: Checkpoint Manager
 *
 * High-level manager for checkpoint operations.
 * Coordinates the checkpoint service and strategy.
 */

import type {
  Checkpoint,
  CheckpointData,
  CheckpointStore,
  MaybeCheckpointInput,
  CheckpointCheckContext,
} from './types.js';
import type { CheckpointStrategy } from './checkpoint-strategy.js';

/**
 * Configuration options for the checkpoint manager.
 */
export interface CheckpointManagerOptions {
  /** Checkpoint storage implementation */
  store: CheckpointStore;
  /** Checkpoint strategy for determining when to checkpoint */
  strategy: CheckpointStrategy;
}

/**
 * Checkpoint manager that coordinates checkpointing operations.
 *
 * Provides a high-level API for:
 * - Conditional checkpoint creation based on strategy
 * - Restoring from latest checkpoint
 * - Managing checkpoint history
 * - Cleaning up old checkpoints
 */
export class CheckpointManager {
  private store: CheckpointStore;
  private strategy: CheckpointStrategy;
  private _lastCheckpointAt: number | null = null;

  constructor(options: CheckpointManagerOptions) {
    this.store = options.store;
    this.strategy = options.strategy;
  }

  /**
   * Get the timestamp of the last checkpoint.
   */
  get lastCheckpointAt(): number | null {
    return this._lastCheckpointAt;
  }

  /**
   * Maybe create a checkpoint based on the current event and strategy.
   *
   * @returns The created checkpoint, or null if no checkpoint was created
   */
  async maybeCheckpoint(input: MaybeCheckpointInput): Promise<Checkpoint | null> {
    const context: CheckpointCheckContext = {
      event: input.event,
      phase: input.state.phase,
    };

    // Add optional properties only if they have values
    if (input.isLoopEnd !== undefined) {
      context.isLoopEnd = input.isLoopEnd;
    }
    if (this._lastCheckpointAt !== null) {
      context.lastCheckpointAt = this._lastCheckpointAt;
    }

    if (!this.strategy.shouldCheckpoint(context)) {
      return null;
    }

    const checkpoint = await this.store.create({
      episodeId: input.episodeId,
      phase: input.state.phase,
      progress: input.state.progress,
      loopCount: input.state.loopCount,
      context: input.state.context,
      budgetState: input.state.budgetState,
    });

    this._lastCheckpointAt = Date.now();

    return checkpoint;
  }

  /**
   * Force create a checkpoint regardless of strategy.
   */
  async forceCheckpoint(input: MaybeCheckpointInput): Promise<Checkpoint> {
    const checkpoint = await this.store.create({
      episodeId: input.episodeId,
      phase: input.state.phase,
      progress: input.state.progress,
      loopCount: input.state.loopCount,
      context: input.state.context,
      budgetState: input.state.budgetState,
    });

    this._lastCheckpointAt = Date.now();

    return checkpoint;
  }

  /**
   * Restore from the latest checkpoint for an episode.
   */
  async restoreLatest(episodeId: string): Promise<CheckpointData | null> {
    const latest = await this.store.getLatest(episodeId);

    if (!latest) {
      return null;
    }

    return this.store.restore(latest.id);
  }

  /**
   * Get checkpoint history for an episode.
   */
  async getHistory(episodeId: string): Promise<Checkpoint[]> {
    return this.store.getByEpisode(episodeId);
  }

  /**
   * Cleanup old checkpoints for an episode.
   *
   * @param episodeId The episode to clean up
   * @param options Cleanup options
   * @returns Number of checkpoints deleted
   */
  async cleanup(
    episodeId: string,
    options?: { keepLatest?: number }
  ): Promise<number> {
    const keepLatest = options?.keepLatest ?? 1;
    return this.store.pruneByEpisode(episodeId, { maxCount: keepLatest });
  }

  /**
   * Reset the manager state.
   * Clears the last checkpoint timestamp.
   */
  reset(): void {
    this._lastCheckpointAt = null;
  }
}

