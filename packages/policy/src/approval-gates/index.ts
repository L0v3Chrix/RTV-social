/**
 * Approval Gate Framework
 *
 * Human-in-the-loop approval workflow for high-risk actions.
 */

export { createApprovalGate } from './gate.js';

export {
  ApprovalStatus,
  ApprovalRequestSchema,
  ApprovalRecordSchema,
  ApprovalStatusSchema,
} from './types.js';

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
} from './types.js';
