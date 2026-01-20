/**
 * Kill Switch Service Implementation
 *
 * In-memory implementation for kill switch management.
 * Production would use database and Redis cache.
 */

import { nanoid } from 'nanoid';
import {
  type KillSwitch,
  type KillSwitchService,
  type KillSwitchCheckContext,
  type KillSwitchCheckResult,
  type ActivateKillSwitchInput,
  type DeactivateKillSwitchInput,
  type CreateKillSwitchInput,
  type ListActiveOptions,
  type KillSwitchHistoryEntry,
} from './types.js';

export interface KillSwitchServiceConfig {
  /** Callback for audit events */
  onAudit?: (event: {
    type: string;
    actor: string;
    target: string;
    metadata: Record<string, unknown>;
  }) => void;
}

/**
 * Create a new Kill Switch Service
 */
export function createKillSwitchService(
  config: KillSwitchServiceConfig = {}
): KillSwitchService {
  const switches = new Map<string, KillSwitch>();
  const history: KillSwitchHistoryEntry[] = [];

  function emitAudit(
    type: string,
    actor: string,
    target: string,
    metadata: Record<string, unknown>
  ): void {
    config.onAudit?.({ type, actor, target, metadata });
  }

  /**
   * Check if switch matches context
   */
  function matchesContext(sw: KillSwitch, context: KillSwitchCheckContext): boolean {
    // Global all matches everything
    if (sw.scope === 'global' && sw.targetType === 'all') {
      return true;
    }

    // Global platform matches if platform matches
    if (sw.scope === 'global' && sw.targetType === 'platform') {
      return sw.targetValue === context.platform;
    }

    // Global action matches if action matches (and platform if specified)
    if (sw.scope === 'global' && sw.targetType === 'action') {
      if (sw.targetValue !== context.action) return false;
      if (sw.platform && sw.platform !== context.platform) return false;
      return true;
    }

    // Client scope requires matching clientId
    if (sw.scope === 'client' && sw.clientId === context.clientId) {
      if (sw.targetType === 'all') {
        return true;
      }
      if (sw.targetType === 'platform') {
        return sw.targetValue === context.platform;
      }
      if (sw.targetType === 'action') {
        if (sw.targetValue !== context.action) return false;
        if (sw.platform && sw.platform !== context.platform) return false;
        return true;
      }
    }

    return false;
  }

  /**
   * Get priority score for a switch (lower = higher priority)
   */
  function getPriority(sw: KillSwitch): number {
    // Priority order: global all > global platform > global action > client all > client platform > client action
    if (sw.scope === 'global') {
      if (sw.targetType === 'all') return 0;
      if (sw.targetType === 'platform') return 1;
      if (sw.targetType === 'action') return 2;
    }
    if (sw.scope === 'client') {
      if (sw.targetType === 'all') return 3;
      if (sw.targetType === 'platform') return 4;
      if (sw.targetType === 'action') return 5;
    }
    return 99;
  }

  const service: KillSwitchService = {
    async isTripped(context: KillSwitchCheckContext): Promise<KillSwitchCheckResult> {
      const startTime = Date.now();

      // Find all matching active switches
      const matching: KillSwitch[] = [];
      for (const sw of switches.values()) {
        if (sw.isActive && matchesContext(sw, context)) {
          matching.push(sw);
        }
      }

      // Sort by priority and return highest priority match
      if (matching.length > 0) {
        matching.sort((a, b) => getPriority(a) - getPriority(b));
        // Safe to use non-null assertion since we checked matching.length > 0
        const sw = matching[0]!;

        return {
          tripped: true,
          switch: {
            id: sw.id,
            scope: sw.scope,
            targetType: sw.targetType,
            targetValue: sw.targetValue,
            clientId: sw.clientId,
            reason: sw.reason,
            activatedAt: sw.activatedAt,
            activatedBy: sw.activatedBy,
          },
          reason: sw.reason,
          checkDurationMs: Date.now() - startTime,
        };
      }

      return {
        tripped: false,
        switch: null,
        reason: null,
        checkDurationMs: Date.now() - startTime,
      };
    },

    async activate(input: ActivateKillSwitchInput): Promise<void> {
      const sw = switches.get(input.id);
      if (!sw) {
        throw new Error(`Kill switch not found: ${input.id}`);
      }

      if (sw.isActive) {
        // Already active, no-op
        return;
      }

      const now = new Date();
      sw.isActive = true;
      sw.reason = input.reason;
      sw.activatedBy = input.activatedBy;
      sw.activatedAt = now;
      sw.updatedAt = now;

      // Record history
      history.push({
        id: `ksh_${nanoid()}`,
        killSwitchId: sw.id,
        action: 'activated',
        previousState: false,
        newState: true,
        reason: input.reason,
        performedBy: input.activatedBy,
        performedAt: now,
        metadata: {
          trigger: input.activatedBy.startsWith('system:') ? 'auto_trip' : 'manual',
          incidentId: input.incidentId,
          ...input.metadata,
        },
      });

      emitAudit('KILL_SWITCH_ACTIVATED', input.activatedBy, input.id, {
        reason: input.reason,
        incidentId: input.incidentId,
        previousState: false,
        newState: true,
        scope: sw.scope,
        targetType: sw.targetType,
        targetValue: sw.targetValue,
        clientId: sw.clientId,
      });
    },

    async deactivate(input: DeactivateKillSwitchInput): Promise<void> {
      const sw = switches.get(input.id);
      if (!sw) {
        throw new Error(`Kill switch not found: ${input.id}`);
      }

      if (!sw.isActive) {
        // Already inactive, no-op
        return;
      }

      const now = new Date();
      const activeDuration = sw.activatedAt
        ? now.getTime() - sw.activatedAt.getTime()
        : null;

      sw.isActive = false;
      sw.updatedAt = now;

      // Record history
      history.push({
        id: `ksh_${nanoid()}`,
        killSwitchId: sw.id,
        action: 'deactivated',
        previousState: true,
        newState: false,
        reason: input.reason,
        performedBy: input.deactivatedBy,
        performedAt: now,
        metadata: {
          trigger: 'manual',
          activeDuration,
          ...input.metadata,
        },
      });

      emitAudit('KILL_SWITCH_DEACTIVATED', input.deactivatedBy, input.id, {
        reason: input.reason,
        previousState: true,
        newState: false,
        activeDuration,
        scope: sw.scope,
        targetType: sw.targetType,
        targetValue: sw.targetValue,
        clientId: sw.clientId,
      });
    },

    async create(input: CreateKillSwitchInput): Promise<KillSwitch> {
      // Validate scope/clientId combination
      if (input.scope === 'client' && !input.clientId) {
        throw new Error('Client scope requires clientId');
      }
      if (input.scope === 'global' && input.clientId) {
        throw new Error('Global scope cannot have clientId');
      }

      const now = new Date();
      const id = `ks_${nanoid()}`;

      const sw: KillSwitch = {
        id,
        scope: input.scope,
        targetType: input.targetType,
        targetValue: input.targetValue,
        clientId: input.clientId ?? null,
        platform: input.platform ?? null,
        isActive: false,
        reason: null,
        activatedBy: null,
        activatedAt: null,
        autoTripConfig: input.autoTripConfig ?? null,
        createdAt: now,
        updatedAt: now,
      };

      switches.set(id, sw);

      // Record history
      history.push({
        id: `ksh_${nanoid()}`,
        killSwitchId: id,
        action: 'created',
        previousState: null,
        newState: false,
        reason: 'Kill switch created',
        performedBy: input.createdBy,
        performedAt: now,
        metadata: {},
      });

      emitAudit('KILL_SWITCH_CREATED', input.createdBy, id, {
        scope: input.scope,
        targetType: input.targetType,
        targetValue: input.targetValue,
        clientId: input.clientId,
        platform: input.platform,
      });

      return sw;
    },

    async listActive(options?: ListActiveOptions): Promise<KillSwitch[]> {
      const results: KillSwitch[] = [];

      for (const sw of switches.values()) {
        if (!sw.isActive) continue;

        if (options?.scope && sw.scope !== options.scope) continue;
        if (options?.targetType && sw.targetType !== options.targetType) continue;
        if (options?.platform && sw.platform !== options.platform) continue;

        // For clientId, match if null (global) or matches
        if (options?.clientId) {
          if (sw.clientId !== null && sw.clientId !== options.clientId) continue;
        }

        results.push(sw);
      }

      return results;
    },

    async getById(id: string): Promise<KillSwitch | null> {
      return switches.get(id) ?? null;
    },
  };

  return service;
}

// Re-export types for convenience
export type { KillSwitchService } from './types.js';
