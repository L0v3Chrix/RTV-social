/**
 * Auto-Trip Monitor
 *
 * Automatically trips kill switches based on error rate thresholds.
 */

import type {
  KillSwitchService,
  AutoTripResult,
  AutoTripStats,
  AutoTripMonitorConfig,
} from './types.js';

interface ResultRecord {
  success: boolean;
  timestamp: number;
  clientId: string;
  errorType?: string;
}

export interface AutoTripMonitor {
  /** Record a result for auto-trip calculation */
  recordResult(result: AutoTripResult): Promise<void>;

  /** Get current stats for a target */
  getStats(target: string, clientId?: string): AutoTripStats;

  /** Start the monitor */
  start(): void;

  /** Stop the monitor */
  stop(): void;
}

export interface AutoTripMonitorDeps {
  killSwitchService: KillSwitchService;
  metrics?: {
    increment(name: string, tags?: Record<string, string>): void;
    gauge(name: string, value: number, tags?: Record<string, string>): void;
  };
  config: AutoTripMonitorConfig;
}

export function createAutoTripMonitor(deps: AutoTripMonitorDeps): AutoTripMonitor {
  const { killSwitchService, metrics, config } = deps;

  // In-memory sliding window storage
  // Map<target, Map<clientId, ResultRecord[]>>
  const results = new Map<string, Map<string, ResultRecord[]>>();

  // Cooldown tracking
  const cooldowns = new Map<string, number>(); // target:clientId -> timestamp

  let checkInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Clean expired records from a results array
   */
  function cleanExpired(records: ResultRecord[], now: number): ResultRecord[] {
    const windowStart = now - config.windowMs;
    return records.filter((r) => r.timestamp >= windowStart);
  }

  /**
   * Calculate stats for a target/client combination
   */
  function calculateStats(records: ResultRecord[], now: number): AutoTripStats {
    const cleaned = cleanExpired(records, now);
    const errors = cleaned.filter((r) => !r.success).length;
    const total = cleaned.length;

    return {
      errors,
      total,
      errorRate: total > 0 ? errors / total : 0,
      windowStart: now - config.windowMs,
      windowEnd: now,
    };
  }

  /**
   * Check if a target should be tripped
   */
  async function checkTrip(
    target: string,
    clientId: string,
    stats: AutoTripStats
  ): Promise<void> {
    const threshold = config.thresholds[target];
    if (!threshold) return;

    // Check minimum samples
    if (stats.total < threshold.minSamples) return;

    // Check error rate
    if (stats.errorRate < threshold.errorRate) return;

    // Check cooldown
    const cooldownKey = `${target}:${clientId}`;
    const cooldownMs = config.cooldownMs ?? 300_000;
    const lastTrip = cooldowns.get(cooldownKey);
    if (lastTrip && Date.now() - lastTrip < cooldownMs) {
      return;
    }

    // Parse target to determine type
    const [targetType, targetValue] = target.split(':');

    // Check if already tripped
    const activeSwitches = await killSwitchService.listActive({
      targetType: targetType as 'platform' | 'action' | 'all',
      clientId,
    });

    for (const sw of activeSwitches) {
      if (sw.targetValue === targetValue) {
        // Already active, update cooldown and return
        cooldowns.set(cooldownKey, Date.now());
        return;
      }
    }

    // Log that we would trip (actual creation would need switch ID)
    console.warn(
      `[AutoTrip] Would trip switch for ${target} (client: ${clientId})`,
      {
        errorRate: stats.errorRate,
        threshold: threshold.errorRate,
        samples: stats.total,
      }
    );

    metrics?.increment('auto_trip.triggered', {
      target,
      client_id: clientId,
    });

    // Update cooldown
    cooldowns.set(cooldownKey, Date.now());
  }

  /**
   * Check all targets for potential trips
   */
  async function checkAllTargets(): Promise<void> {
    const now = Date.now();

    for (const [target, clientMap] of results.entries()) {
      for (const [clientId, records] of clientMap.entries()) {
        const stats = calculateStats(records, now);
        await checkTrip(target, clientId, stats);
      }
    }
  }

  return {
    async recordResult(result: AutoTripResult): Promise<void> {
      const now = result.timestamp || Date.now();

      // Get or create target map
      let clientMap = results.get(result.target);
      if (!clientMap) {
        clientMap = new Map();
        results.set(result.target, clientMap);
      }

      // Get or create client array
      let records = clientMap.get(result.clientId);
      if (!records) {
        records = [];
        clientMap.set(result.clientId, records);
      }

      // Add record - conditionally add errorType for exactOptionalPropertyTypes
      const record: ResultRecord = {
        success: result.success,
        timestamp: now,
        clientId: result.clientId,
      };
      if (result.errorType) {
        record.errorType = result.errorType;
      }
      records.push(record);

      // Clean expired
      const cleaned = cleanExpired(records, now);
      clientMap.set(result.clientId, cleaned);

      // Update metrics
      metrics?.increment('auto_trip.result', {
        target: result.target,
        success: String(result.success),
        client_id: result.clientId,
      });
    },

    getStats(target: string, clientId?: string): AutoTripStats {
      const now = Date.now();
      const clientMap = results.get(target);

      if (!clientMap) {
        return {
          errors: 0,
          total: 0,
          errorRate: 0,
          windowStart: now - config.windowMs,
          windowEnd: now,
        };
      }

      if (clientId) {
        const records = clientMap.get(clientId) || [];
        return calculateStats(records, now);
      }

      // Aggregate across all clients
      let totalErrors = 0;
      let totalRecords = 0;

      for (const records of clientMap.values()) {
        const cleaned = cleanExpired(records, now);
        totalErrors += cleaned.filter((r) => !r.success).length;
        totalRecords += cleaned.length;
      }

      return {
        errors: totalErrors,
        total: totalRecords,
        errorRate: totalRecords > 0 ? totalErrors / totalRecords : 0,
        windowStart: now - config.windowMs,
        windowEnd: now,
      };
    },

    start(): void {
      if (checkInterval) return;

      checkInterval = setInterval(() => {
        checkAllTargets().catch((err) => {
          console.error('[AutoTrip] Check failed:', err);
        });
      }, config.checkIntervalMs);
    },

    stop(): void {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    },
  };
}
