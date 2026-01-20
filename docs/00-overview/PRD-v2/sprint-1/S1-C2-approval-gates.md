# Build Prompt: S1-C2 — Approval Gate Framework

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-C2 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | C — Policy Engine |
| **Complexity** | Medium |
| **Estimated Effort** | 3-4 hours |
| **Dependencies** | S1-C1 |
| **Blocks** | S1-C5 |

---

## Context

### What We're Building

The Approval Gate Framework implements human-in-the-loop checkpoints for high-risk or sensitive actions. When a policy rule requires approval, the framework queues the action, notifies approvers, and tracks the approval workflow until resolution.

### Why This Matters

- **Safety**: Human oversight for high-risk actions
- **Compliance**: Regulatory requirements for certain content
- **Quality**: Human review of AI-generated content
- **Control**: Client ability to approve before publishing

### Spec References

- `/docs/05-policy-safety/human-in-loop-approvals.md` — Approval workflows
- `/docs/03-agents-tools/agent-recursion-contracts.md` — Approval points
- `/docs/06-reliability-ops/incident-runbooks-postmortem.md` — Escalation paths

**Critical Pattern (from human-in-loop-approvals.md):**
> Approval gates pause execution and create a pending approval request. The agent cannot proceed until the request is approved, denied, or times out. Timeouts default to deny.

---

## Prerequisites

### Completed Tasks

- [x] S1-C1: Policy definition schema

### Required Packages

```bash
pnpm add nanoid zod date-fns
pnpm add -D vitest @types/node
```

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/policy/src/__tests__/approval-gates.test.ts`**

```typescript
import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  createApprovalGate,
  type ApprovalGate,
  type ApprovalRequest,
  type ApprovalDecision,
  ApprovalStatus,
} from '../approval-gates';

describe('Approval Gate Framework', () => {
  let gate: ApprovalGate;

  beforeEach(() => {
    gate = createApprovalGate({
      defaultTimeoutMs: 3600000, // 1 hour
    });
  });

  describe('Request Creation', () => {
    test('creates approval request with required fields', async () => {
      const request = await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'High-risk content detected',
        requiredRole: 'content_moderator',
        context: {
          platform: 'instagram',
          contentPreview: 'Check out our new...',
        },
      });

      expect(request.id).toBeDefined();
      expect(request.status).toBe(ApprovalStatus.PENDING);
      expect(request.clientId).toBe('client-123');
      expect(request.expiresAt).toBeDefined();
    });

    test('creates request with custom timeout', async () => {
      const request = await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'Content review required',
        requiredRole: 'content_moderator',
        timeoutMs: 86400000, // 24 hours
      });

      const expectedExpiry = Date.now() + 86400000;
      expect(request.expiresAt.getTime()).toBeCloseTo(expectedExpiry, -3);
    });

    test('creates request with multiple required approvers', async () => {
      const request = await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'Multi-approval required',
        requiredRole: 'content_moderator',
        requiredApprovals: 2,
      });

      expect(request.requiredApprovals).toBe(2);
    });
  });

  describe('Request Approval', () => {
    test('approves pending request', async () => {
      const request = await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'Review required',
        requiredRole: 'content_moderator',
      });

      const decision = await gate.approve(request.id, {
        approverId: 'user-789',
        approverRole: 'content_moderator',
        comment: 'Looks good!',
      });

      expect(decision.status).toBe(ApprovalStatus.APPROVED);
      expect(decision.approverId).toBe('user-789');

      const updated = await gate.getRequest(request.id);
      expect(updated?.status).toBe(ApprovalStatus.APPROVED);
    });

    test('requires correct role to approve', async () => {
      const request = await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'Review required',
        requiredRole: 'content_moderator',
      });

      await expect(
        gate.approve(request.id, {
          approverId: 'user-789',
          approverRole: 'basic_user', // Wrong role
        })
      ).rejects.toThrow('Insufficient role');
    });

    test('tracks multiple approvals', async () => {
      const request = await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'Multi-approval required',
        requiredRole: 'content_moderator',
        requiredApprovals: 2,
      });

      // First approval
      await gate.approve(request.id, {
        approverId: 'user-1',
        approverRole: 'content_moderator',
      });

      let updated = await gate.getRequest(request.id);
      expect(updated?.status).toBe(ApprovalStatus.PENDING);
      expect(updated?.approvals.length).toBe(1);

      // Second approval
      await gate.approve(request.id, {
        approverId: 'user-2',
        approverRole: 'content_moderator',
      });

      updated = await gate.getRequest(request.id);
      expect(updated?.status).toBe(ApprovalStatus.APPROVED);
      expect(updated?.approvals.length).toBe(2);
    });
  });

  describe('Request Denial', () => {
    test('denies pending request', async () => {
      const request = await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'Review required',
        requiredRole: 'content_moderator',
      });

      const decision = await gate.deny(request.id, {
        approverId: 'user-789',
        approverRole: 'content_moderator',
        reason: 'Content violates policy',
      });

      expect(decision.status).toBe(ApprovalStatus.DENIED);
      expect(decision.reason).toBe('Content violates policy');
    });

    test('one denial rejects entire request', async () => {
      const request = await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'Multi-approval required',
        requiredRole: 'content_moderator',
        requiredApprovals: 3,
      });

      // One approval
      await gate.approve(request.id, {
        approverId: 'user-1',
        approverRole: 'content_moderator',
      });

      // One denial should reject
      await gate.deny(request.id, {
        approverId: 'user-2',
        approverRole: 'content_moderator',
        reason: 'Quality issue',
      });

      const updated = await gate.getRequest(request.id);
      expect(updated?.status).toBe(ApprovalStatus.DENIED);
    });
  });

  describe('Request Timeout', () => {
    test('expires requests after timeout', async () => {
      vi.useFakeTimers();

      const request = await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'Review required',
        requiredRole: 'content_moderator',
        timeoutMs: 1000,
      });

      // Advance time past timeout
      vi.advanceTimersByTime(2000);

      await gate.processExpired();

      const updated = await gate.getRequest(request.id);
      expect(updated?.status).toBe(ApprovalStatus.EXPIRED);

      vi.useRealTimers();
    });
  });

  describe('Request Cancellation', () => {
    test('cancels pending request', async () => {
      const request = await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'Review required',
        requiredRole: 'content_moderator',
      });

      await gate.cancel(request.id, {
        cancelledBy: 'system',
        reason: 'Action no longer needed',
      });

      const updated = await gate.getRequest(request.id);
      expect(updated?.status).toBe(ApprovalStatus.CANCELLED);
    });

    test('cannot cancel resolved request', async () => {
      const request = await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'Review required',
        requiredRole: 'content_moderator',
      });

      await gate.approve(request.id, {
        approverId: 'user-789',
        approverRole: 'content_moderator',
      });

      await expect(
        gate.cancel(request.id, {
          cancelledBy: 'system',
          reason: 'Too late',
        })
      ).rejects.toThrow('Cannot cancel');
    });
  });

  describe('Request Queries', () => {
    test('lists pending requests by client', async () => {
      await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-1',
        reason: 'Review',
        requiredRole: 'moderator',
      });

      await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-2',
        reason: 'Review',
        requiredRole: 'moderator',
      });

      await gate.createRequest({
        clientId: 'client-other',
        actionType: 'publish',
        resourceId: 'post-3',
        reason: 'Review',
        requiredRole: 'moderator',
      });

      const pending = await gate.listPendingRequests({
        clientId: 'client-123',
      });

      expect(pending).toHaveLength(2);
      expect(pending.every((r) => r.clientId === 'client-123')).toBe(true);
    });

    test('lists requests by approver role', async () => {
      await gate.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-1',
        reason: 'Review',
        requiredRole: 'content_moderator',
      });

      await gate.createRequest({
        clientId: 'client-123',
        actionType: 'delete',
        resourceId: 'post-2',
        reason: 'Review',
        requiredRole: 'admin',
      });

      const forModerator = await gate.listPendingRequests({
        requiredRole: 'content_moderator',
      });

      expect(forModerator).toHaveLength(1);
      expect(forModerator[0].requiredRole).toBe('content_moderator');
    });
  });

  describe('Notifications', () => {
    test('emits notification on request creation', async () => {
      const notifications: any[] = [];
      const gateWithNotify = createApprovalGate({
        onNotify: (n) => notifications.push(n),
      });

      await gateWithNotify.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'Review required',
        requiredRole: 'content_moderator',
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('approval_requested');
    });

    test('emits notification on approval', async () => {
      const notifications: any[] = [];
      const gateWithNotify = createApprovalGate({
        onNotify: (n) => notifications.push(n),
      });

      const request = await gateWithNotify.createRequest({
        clientId: 'client-123',
        actionType: 'publish',
        resourceId: 'post-456',
        reason: 'Review required',
        requiredRole: 'content_moderator',
      });

      await gateWithNotify.approve(request.id, {
        approverId: 'user-789',
        approverRole: 'content_moderator',
      });

      expect(notifications.some((n) => n.type === 'approval_approved')).toBe(true);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Approval Gate Types

**File: `packages/policy/src/approval-gates/types.ts`**

```typescript
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
```

#### Step 2: Implement Approval Gate

**File: `packages/policy/src/approval-gates/gate.ts`**

```typescript
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
} from './types';

const DEFAULT_TIMEOUT_MS = 3600000; // 1 hour

// Default role hierarchy (higher roles can approve for lower)
const DEFAULT_ROLE_HIERARCHY: Record<string, string[]> = {
  admin: ['admin', 'content_moderator', 'reviewer', 'basic_user'],
  content_moderator: ['content_moderator', 'reviewer'],
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

      const request: ApprovalRequest = {
        id: `approval-${nanoid()}`,
        clientId: input.clientId,
        actionType: input.actionType,
        resourceId: input.resourceId,
        reason: input.reason,
        requiredRole: input.requiredRole,
        requiredApprovals: input.requiredApprovals ?? 1,
        status: ApprovalStatus.PENDING,
        context: input.context,
        approvals: [],
        episodeId: input.episodeId,
        agentType: input.agentType,
        notifyChannels: input.notifyChannels,
        metadata: input.metadata,
        createdAt: now,
        expiresAt: new Date(now.getTime() + timeoutMs),
      };

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

      // Add approval
      const now = new Date();
      request.approvals.push({
        approverId: input.approverId,
        approverRole: input.approverRole,
        decision: 'approve',
        comment: input.comment,
        decidedAt: now,
      });

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
```

#### Step 3: Create Module Index

**File: `packages/policy/src/approval-gates/index.ts`**

```typescript
/**
 * Approval Gate Framework
 *
 * Human-in-the-loop approval workflow for high-risk actions.
 */

export { createApprovalGate } from './gate';

export {
  ApprovalStatus,
  ApprovalRequestSchema,
  ApprovalRecordSchema,
  ApprovalStatusSchema,
} from './types';

export type {
  ApprovalGate,
  ApprovalGateConfig,
  ApprovalRequest,
  ApprovalRecord,
  ApprovalDecision,
  ApprovalNotification,
  CreateApprovalRequestInput,
  ApproveInput,
  DenyInput,
  CancelInput,
  ListPendingRequestsOptions,
} from './types';
```

#### Step 4: Update Main Package Index

**File: `packages/policy/src/index.ts`** (update)

```typescript
/**
 * @rtv/policy - Policy Engine
 *
 * Declarative policy definitions, evaluation, and enforcement.
 */

export * from './schema';
export * from './approval-gates';
```

### Phase 3: Verification

```bash
cd packages/policy

# Build
pnpm build

# Typecheck
pnpm typecheck

# Run tests
pnpm test

# Manual verification
cat > verify-gates.ts << 'EOF'
import { createApprovalGate, ApprovalStatus } from './src/approval-gates';

async function main() {
  const gate = createApprovalGate({
    defaultTimeoutMs: 3600000,
    onNotify: (n) => console.log('Notification:', n.type),
  });

  // Create request
  const request = await gate.createRequest({
    clientId: 'client-123',
    actionType: 'publish',
    resourceId: 'post-456',
    reason: 'High-risk content detected',
    requiredRole: 'content_moderator',
    context: {
      platform: 'instagram',
      contentPreview: 'Check out our amazing new product!',
    },
  });

  console.log('\nCreated request:', request.id);
  console.log('Status:', request.status);
  console.log('Expires:', request.expiresAt);

  // Approve
  const decision = await gate.approve(request.id, {
    approverId: 'moderator-1',
    approverRole: 'content_moderator',
    comment: 'Content looks good!',
  });

  console.log('\nDecision:', decision.status);

  // List pending
  const pending = await gate.listPendingRequests({ clientId: 'client-123' });
  console.log('\nPending requests:', pending.length);
}

main();
EOF

npx tsx verify-gates.ts
rm verify-gates.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/policy/src/approval-gates/types.ts` | Type definitions |
| Create | `packages/policy/src/approval-gates/gate.ts` | Gate implementation |
| Create | `packages/policy/src/approval-gates/index.ts` | Module exports |
| Modify | `packages/policy/src/index.ts` | Add approval-gates export |
| Create | `packages/policy/src/__tests__/approval-gates.test.ts` | Unit tests |

---

## Acceptance Criteria

- [ ] `createRequest()` creates pending approval with timeout
- [ ] `approve()` records approval and checks required count
- [ ] `approve()` validates approver role
- [ ] `deny()` immediately rejects request
- [ ] `cancel()` cancels pending requests only
- [ ] `listPendingRequests()` filters by client/role/type
- [ ] `processExpired()` expires timed-out requests
- [ ] Notifications emitted for all state changes
- [ ] Tests pass with >80% coverage

---

## Test Requirements

### Unit Tests

- Request creation
- Approval workflow
- Denial workflow
- Cancellation
- Multi-approval requirements
- Role authorization
- Expiration handling

### Integration Tests

- Notification delivery
- Concurrent approvals

---

## Security & Safety Checklist

- [ ] Role authorization enforced
- [ ] Timeouts prevent indefinite blocking
- [ ] One denial rejects entire request
- [ ] Duplicate approvals prevented
- [ ] Client isolation maintained

---

## JSON Task Block

```json
{
  "task_id": "S1-C2",
  "name": "Approval Gate Framework",
  "sprint": 1,
  "agent": "C",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 4,
  "dependencies": ["S1-C1"],
  "blocks": ["S1-C5"],
  "tags": ["policy", "approval", "human-in-loop"],
  "acceptance_criteria": [
    "request creation with timeout",
    "approval workflow",
    "role authorization",
    "multi-approval support",
    "expiration handling"
  ],
  "created_at": "2025-01-16T00:00:00Z",
  "updated_at": null,
  "completed_at": null
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "agent_id": null,
  "decisions": [],
  "artifacts": [],
  "notes": []
}
```

---

## Next Steps

After completing this task:

1. **S1-C3**: Build kill switch infrastructure
2. **S1-C4**: Add rate limiting policies
