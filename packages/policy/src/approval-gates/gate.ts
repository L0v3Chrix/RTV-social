/**
 * Approval Gate Implementation
 *
 * In-memory approval workflow management.
 */

import { nanoid } from 'nanoid';
import {
  ApprovalStatus,
  type ApprovalGate,
  type ApprovalGateConfig,
  type ApprovalRequest,
  type ApprovalDecision,
  type ApprovalNotification,
  type CreateApprovalRequestInput,
  type ApproveInput,
  type DenyInput,
  type CancelInput,
  type ListPendingRequestsOptions,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 3600000; // 1 hour

// Default role hierarchy (higher roles can approve for lower)
const DEFAULT_ROLE_HIERARCHY: Record<string, string[]> = {
  admin: ['admin', 'content_moderator', 'reviewer', 'basic_user', 'moderator'],
  content_moderator: ['content_moderator', 'reviewer', 'moderator'],
  moderator: ['moderator'],
  reviewer: ['reviewer'],
  basic_user: [],
};

/**
 * Create a new Approval Gate
 */
export function createApprovalGate(config: ApprovalGateConfig = {}): ApprovalGate {
  const requests = new Map<string, ApprovalRequest>();
  const roleHierarchy = config.roleHierarchy ?? DEFAULT_ROLE_HIERARCHY;

  function notify(notification: ApprovalNotification): void {
    config.onNotify?.(notification);
  }

  function canApprove(approverRole: string, requiredRole: string): boolean {
    const allowedRoles = roleHierarchy[approverRole] ?? [approverRole];
    return allowedRoles.includes(requiredRole);
  }

  const gate: ApprovalGate = {
    config,

    async createRequest(input: CreateApprovalRequestInput): Promise<ApprovalRequest> {
      const now = new Date();
      const timeoutMs = input.timeoutMs ?? config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

      // Build the request object carefully for exactOptionalPropertyTypes
      const request: ApprovalRequest = {
        id: `approval-${nanoid()}`,
        clientId: input.clientId,
        actionType: input.actionType,
        resourceId: input.resourceId,
        reason: input.reason,
        requiredRole: input.requiredRole,
        requiredApprovals: input.requiredApprovals ?? 1,
        status: ApprovalStatus.PENDING,
        approvals: [],
        createdAt: now,
        expiresAt: new Date(now.getTime() + timeoutMs),
      };

      // Conditionally add optional properties
      if (input.context) {
        request.context = input.context;
      }
      if (input.episodeId) {
        request.episodeId = input.episodeId;
      }
      if (input.agentType) {
        request.agentType = input.agentType;
      }
      if (input.notifyChannels) {
        request.notifyChannels = input.notifyChannels;
      }
      if (input.metadata) {
        request.metadata = input.metadata;
      }

      requests.set(request.id, request);

      notify({
        type: 'approval_requested',
        requestId: request.id,
        clientId: request.clientId,
        actionType: request.actionType,
        resourceId: request.resourceId,
        reason: request.reason,
        timestamp: now,
      });

      return request;
    },

    async getRequest(id: string): Promise<ApprovalRequest | null> {
      return requests.get(id) ?? null;
    },

    async approve(id: string, input: ApproveInput): Promise<ApprovalDecision> {
      const request = requests.get(id);
      if (!request) {
        throw new Error(`Approval request not found: ${id}`);
      }

      if (request.status !== ApprovalStatus.PENDING) {
        throw new Error(`Request is not pending: ${request.status}`);
      }

      // Check role authorization
      if (!canApprove(input.approverRole, request.requiredRole)) {
        throw new Error(`Insufficient role: ${input.approverRole} cannot approve for ${request.requiredRole}`);
      }

      // Check if this approver already approved
      if (request.approvals.some((a) => a.approverId === input.approverId)) {
        throw new Error(`Approver ${input.approverId} has already approved this request`);
      }

      // Add approval - build record carefully for exactOptionalPropertyTypes
      const now = new Date();
      const approvalRecord: {
        approverId: string;
        approverRole: string;
        decision: 'approve' | 'deny';
        comment?: string;
        decidedAt: Date;
      } = {
        approverId: input.approverId,
        approverRole: input.approverRole,
        decision: 'approve',
        decidedAt: now,
      };
      if (input.comment) {
        approvalRecord.comment = input.comment;
      }

      request.approvals.push(approvalRecord);

      // Check if enough approvals
      if (request.approvals.length >= request.requiredApprovals) {
        request.status = ApprovalStatus.APPROVED;
        request.resolvedAt = now;

        notify({
          type: 'approval_approved',
          requestId: request.id,
          clientId: request.clientId,
          actionType: request.actionType,
          resourceId: request.resourceId,
          approverId: input.approverId,
          timestamp: now,
        });
      }

      return {
        requestId: request.id,
        status: request.status,
        approverId: input.approverId,
        decidedAt: now,
      };
    },

    async deny(id: string, input: DenyInput): Promise<ApprovalDecision> {
      const request = requests.get(id);
      if (!request) {
        throw new Error(`Approval request not found: ${id}`);
      }

      if (request.status !== ApprovalStatus.PENDING) {
        throw new Error(`Request is not pending: ${request.status}`);
      }

      // Check role authorization
      if (!canApprove(input.approverRole, request.requiredRole)) {
        throw new Error(`Insufficient role: ${input.approverRole} cannot deny for ${request.requiredRole}`);
      }

      const now = new Date();

      // Add denial record
      request.approvals.push({
        approverId: input.approverId,
        approverRole: input.approverRole,
        decision: 'deny',
        comment: input.reason,
        decidedAt: now,
      });

      // One denial rejects the entire request
      request.status = ApprovalStatus.DENIED;
      request.denialReason = input.reason;
      request.resolvedAt = now;

      notify({
        type: 'approval_denied',
        requestId: request.id,
        clientId: request.clientId,
        actionType: request.actionType,
        resourceId: request.resourceId,
        reason: input.reason,
        approverId: input.approverId,
        timestamp: now,
      });

      return {
        requestId: request.id,
        status: ApprovalStatus.DENIED,
        approverId: input.approverId,
        reason: input.reason,
        decidedAt: now,
      };
    },

    async cancel(id: string, input: CancelInput): Promise<void> {
      const request = requests.get(id);
      if (!request) {
        throw new Error(`Approval request not found: ${id}`);
      }

      if (request.status !== ApprovalStatus.PENDING) {
        throw new Error(`Cannot cancel request with status: ${request.status}`);
      }

      const now = new Date();
      request.status = ApprovalStatus.CANCELLED;
      request.cancellation = {
        cancelledBy: input.cancelledBy,
        reason: input.reason,
        cancelledAt: now,
      };
      request.resolvedAt = now;

      notify({
        type: 'approval_cancelled',
        requestId: request.id,
        clientId: request.clientId,
        actionType: request.actionType,
        resourceId: request.resourceId,
        reason: input.reason,
        timestamp: now,
      });
    },

    async listPendingRequests(
      options?: ListPendingRequestsOptions
    ): Promise<ApprovalRequest[]> {
      const results: ApprovalRequest[] = [];

      for (const request of requests.values()) {
        if (request.status !== ApprovalStatus.PENDING) continue;

        if (options?.clientId && request.clientId !== options.clientId) continue;
        if (options?.requiredRole && request.requiredRole !== options.requiredRole) continue;
        if (options?.actionType && request.actionType !== options.actionType) continue;

        results.push(request);
      }

      // Sort by creation date (oldest first)
      results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      if (options?.limit) {
        return results.slice(0, options.limit);
      }

      return results;
    },

    async processExpired(): Promise<number> {
      const now = new Date();
      let expiredCount = 0;

      for (const request of requests.values()) {
        if (
          request.status === ApprovalStatus.PENDING &&
          request.expiresAt <= now
        ) {
          request.status = ApprovalStatus.EXPIRED;
          request.resolvedAt = now;
          expiredCount++;

          notify({
            type: 'approval_expired',
            requestId: request.id,
            clientId: request.clientId,
            actionType: request.actionType,
            resourceId: request.resourceId,
            timestamp: now,
          });
        }
      }

      return expiredCount;
    },
  };

  return gate;
}
