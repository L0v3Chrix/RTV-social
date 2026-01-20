/**
 * Approval Gate Type Definitions
 *
 * Human-in-the-loop approval workflow for high-risk actions.
 */

import { z } from 'zod';

// =====================
// Status
// =====================

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export const ApprovalStatusSchema = z.nativeEnum(ApprovalStatus);

// =====================
// Approval Record
// =====================

export const ApprovalRecordSchema = z.object({
  /** Approver user ID */
  approverId: z.string(),

  /** Approver role */
  approverRole: z.string(),

  /** Decision */
  decision: z.enum(['approve', 'deny']),

  /** Optional comment */
  comment: z.string().optional(),

  /** Decision timestamp */
  decidedAt: z.date(),
});

export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

// =====================
// Approval Request
// =====================

export const ApprovalRequestSchema = z.object({
  /** Unique request ID */
  id: z.string(),

  /** Client ID for tenant isolation */
  clientId: z.string(),

  /** Type of action requiring approval */
  actionType: z.string(),

  /** Resource being acted upon */
  resourceId: z.string(),

  /** Reason approval is required */
  reason: z.string(),

  /** Role required to approve */
  requiredRole: z.string(),

  /** Number of approvals required */
  requiredApprovals: z.number().int().positive().default(1),

  /** Current status */
  status: ApprovalStatusSchema,

  /** Context for the approver */
  context: z.record(z.unknown()).optional(),

  /** Approval records */
  approvals: z.array(ApprovalRecordSchema),

  /** Denial reason if denied */
  denialReason: z.string().optional(),

  /** Cancellation info */
  cancellation: z
    .object({
      cancelledBy: z.string(),
      reason: z.string(),
      cancelledAt: z.date(),
    })
    .optional(),

  /** Episode ID that triggered this */
  episodeId: z.string().optional(),

  /** Agent type that triggered this */
  agentType: z.string().optional(),

  /** Creation timestamp */
  createdAt: z.date(),

  /** Resolution timestamp */
  resolvedAt: z.date().optional(),

  /** Expiration timestamp */
  expiresAt: z.date(),

  /** Notification channels */
  notifyChannels: z.array(z.string()).optional(),

  /** Metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

// =====================
// Input Types
// =====================

export interface CreateApprovalRequestInput {
  clientId: string;
  actionType: string;
  resourceId: string;
  reason: string;
  requiredRole: string;
  requiredApprovals?: number;
  timeoutMs?: number;
  context?: Record<string, unknown>;
  episodeId?: string;
  agentType?: string;
  notifyChannels?: string[];
  metadata?: Record<string, unknown>;
}

export interface ApproveInput {
  approverId: string;
  approverRole: string;
  comment?: string;
}

export interface DenyInput {
  approverId: string;
  approverRole: string;
  reason: string;
}

export interface CancelInput {
  cancelledBy: string;
  reason: string;
}

// =====================
// Decision Result
// =====================

export interface ApprovalDecision {
  requestId: string;
  status: ApprovalStatus;
  approverId?: string;
  reason?: string;
  decidedAt: Date;
}

// =====================
// Query Options
// =====================

export interface ListPendingRequestsOptions {
  clientId?: string;
  requiredRole?: string;
  actionType?: string;
  limit?: number;
}

// =====================
// Notification
// =====================

export interface ApprovalNotification {
  type:
    | 'approval_requested'
    | 'approval_approved'
    | 'approval_denied'
    | 'approval_expired'
    | 'approval_cancelled';
  requestId: string;
  clientId: string;
  actionType: string;
  resourceId: string;
  reason?: string;
  approverId?: string;
  timestamp: Date;
}

// =====================
// Configuration
// =====================

export interface ApprovalGateConfig {
  /** Default timeout in milliseconds */
  defaultTimeoutMs?: number;

  /** Role hierarchy for authorization */
  roleHierarchy?: Record<string, string[]>;

  /** Notification callback */
  onNotify?: (notification: ApprovalNotification) => void;
}

// =====================
// Main Interface
// =====================

export interface ApprovalGate {
  /** Configuration */
  readonly config: ApprovalGateConfig;

  // Request lifecycle
  createRequest(input: CreateApprovalRequestInput): Promise<ApprovalRequest>;
  getRequest(id: string): Promise<ApprovalRequest | null>;
  approve(id: string, input: ApproveInput): Promise<ApprovalDecision>;
  deny(id: string, input: DenyInput): Promise<ApprovalDecision>;
  cancel(id: string, input: CancelInput): Promise<void>;

  // Query
  listPendingRequests(options?: ListPendingRequestsOptions): Promise<ApprovalRequest[]>;

  // Maintenance
  processExpired(): Promise<number>;
}
