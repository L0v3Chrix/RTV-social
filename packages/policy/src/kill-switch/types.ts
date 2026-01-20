/**
 * Kill Switch Type Definitions
 *
 * Emergency controls for halting autonomous operations.
 */

import { z } from 'zod';

// =====================
// Scopes and Target Types
// =====================

export const KillSwitchScopeSchema = z.enum(['global', 'client', 'platform', 'action']);
export type KillSwitchScope = z.infer<typeof KillSwitchScopeSchema>;

export const KillSwitchTargetTypeSchema = z.enum(['all', 'platform', 'action']);
export type KillSwitchTargetType = z.infer<typeof KillSwitchTargetTypeSchema>;

// =====================
// Kill Switch Entity
// =====================

export const KillSwitchSchema = z.object({
  /** Unique ID */
  id: z.string(),

  /** Client ID (null for global) */
  clientId: z.string().nullable(),

  /** Scope level */
  scope: KillSwitchScopeSchema,

  /** Target type */
  targetType: KillSwitchTargetTypeSchema,

  /** Target value (e.g., 'meta', 'publish', '*') */
  targetValue: z.string(),

  /** Platform for action-level switches */
  platform: z.string().nullable().optional(),

  /** Active state */
  isActive: z.boolean(),

  /** Reason for activation */
  reason: z.string().nullable(),

  /** Who activated */
  activatedBy: z.string().nullable(),

  /** When activated */
  activatedAt: z.date().nullable(),

  /** Auto-trip configuration */
  autoTripConfig: z
    .object({
      enabled: z.boolean(),
      errorRateThreshold: z.number(),
      minSamples: z.number(),
      windowMs: z.number(),
      cooldownMs: z.number(),
    })
    .nullable()
    .optional(),

  /** Timestamps */
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type KillSwitch = z.infer<typeof KillSwitchSchema>;

// =====================
// History Entry
// =====================

export const KillSwitchHistoryEntrySchema = z.object({
  id: z.string(),
  killSwitchId: z.string(),
  action: z.enum(['created', 'activated', 'deactivated', 'updated']),
  previousState: z.boolean().nullable(),
  newState: z.boolean().nullable(),
  reason: z.string().nullable(),
  performedBy: z.string(),
  performedAt: z.date(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type KillSwitchHistoryEntry = z.infer<typeof KillSwitchHistoryEntrySchema>;

// =====================
// Check Context
// =====================

export const KillSwitchCheckContextSchema = z.object({
  action: z.string(),
  platform: z.string().optional(),
  clientId: z.string(),
});

export type KillSwitchCheckContext = z.infer<typeof KillSwitchCheckContextSchema>;

// =====================
// Check Result
// =====================

export interface KillSwitchCheckResult {
  tripped: boolean;
  switch: {
    id: string;
    scope: KillSwitchScope;
    targetType: KillSwitchTargetType;
    targetValue: string;
    clientId: string | null;
    reason: string | null;
    activatedAt: Date | null;
    activatedBy: string | null;
  } | null;
  reason: string | null;
  checkDurationMs: number;
}

// =====================
// Input Types
// =====================

export interface ActivateKillSwitchInput {
  id: string;
  reason: string;
  activatedBy: string;
  incidentId?: string;
  metadata?: Record<string, unknown>;
}

export interface DeactivateKillSwitchInput {
  id: string;
  reason: string;
  deactivatedBy: string;
  metadata?: Record<string, unknown>;
}

export interface CreateKillSwitchInput {
  scope: KillSwitchScope;
  targetType: KillSwitchTargetType;
  targetValue: string;
  clientId?: string;
  platform?: string;
  createdBy: string;
  autoTripConfig?: {
    enabled: boolean;
    errorRateThreshold: number;
    minSamples: number;
    windowMs: number;
    cooldownMs: number;
  };
}

export interface ListActiveOptions {
  scope?: KillSwitchScope;
  clientId?: string;
  targetType?: KillSwitchTargetType;
  platform?: string;
}

// =====================
// Auto-Trip Types
// =====================

export interface AutoTripResult {
  target: string;
  success: boolean;
  clientId: string;
  timestamp?: number;
  errorType?: string;
}

export interface AutoTripStats {
  errors: number;
  total: number;
  errorRate: number;
  windowStart: number;
  windowEnd: number;
}

export interface AutoTripThreshold {
  errorRate: number;
  minSamples: number;
}

export interface AutoTripMonitorConfig {
  windowMs: number;
  thresholds: Record<string, AutoTripThreshold>;
  checkIntervalMs: number;
  cooldownMs?: number;
}

// =====================
// Service Interface
// =====================

export interface KillSwitchService {
  /** Check if any kill switch is tripped for context */
  isTripped(context: KillSwitchCheckContext): Promise<KillSwitchCheckResult>;

  /** Activate a kill switch */
  activate(input: ActivateKillSwitchInput): Promise<void>;

  /** Deactivate a kill switch */
  deactivate(input: DeactivateKillSwitchInput): Promise<void>;

  /** Create a new kill switch */
  create(input: CreateKillSwitchInput): Promise<KillSwitch>;

  /** List active switches */
  listActive(options?: ListActiveOptions): Promise<KillSwitch[]>;

  /** Get switch by ID */
  getById(id: string): Promise<KillSwitch | null>;
}
