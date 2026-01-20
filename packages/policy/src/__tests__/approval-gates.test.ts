import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  createApprovalGate,
  type ApprovalGate,
  type ApprovalRequest,
  type ApprovalDecision,
  ApprovalStatus,
} from '../approval-gates/index.js';

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
      const notifications: unknown[] = [];
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
      expect((notifications[0] as { type?: string }).type).toBe('approval_requested');
    });

    test('emits notification on approval', async () => {
      const notifications: unknown[] = [];
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

      expect(notifications.some((n) => (n as { type?: string }).type === 'approval_approved')).toBe(true);
    });
  });
});
