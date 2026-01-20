/**
 * S2-A1: PlanGraph Types
 *
 * Type definitions for the PlanGraph DAG model.
 */

import { z } from 'zod';

// Plan Status
export const PlanStatuses = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'executing',
  'completed',
  'cancelled',
] as const;
export type PlanStatus = (typeof PlanStatuses)[number];

// Node Types
export const NodeTypes = ['content', 'campaign', 'series', 'milestone'] as const;
export type NodeType = (typeof NodeTypes)[number];

// Edge Types
export const EdgeTypes = ['depends_on', 'repurposes', 'follows', 'part_of'] as const;
export type EdgeType = (typeof EdgeTypes)[number];

// Node Status
export const NodeStatuses = [
  'pending',
  'ready',
  'in_progress',
  'completed',
  'failed',
  'skipped',
] as const;
export type NodeStatus = (typeof NodeStatuses)[number];

// Platform
export const Platforms = [
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'x',
  'skool',
] as const;
export type Platform = (typeof Platforms)[number];

// Recurrence
export const RecurrenceSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  endDate: z.date().optional(),
});

export type Recurrence = z.infer<typeof RecurrenceSchema>;

// Plan Node
export interface PlanNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  blueprintId?: string;
  platform?: Platform;
  scheduledAt?: Date;
  status: NodeStatus;
  recurrence?: Recurrence;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// Plan Edge
export interface PlanEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Plan Graph Config
export interface PlanGraphConfig {
  clientId: string;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
}

// Add Node Input
export interface AddNodeInput {
  type: NodeType;
  title: string;
  description?: string;
  blueprintId?: string;
  platform?: Platform;
  scheduledAt?: Date;
  status?: NodeStatus;
  recurrence?: Recurrence;
  metadata?: Record<string, unknown>;
}

// Add Edge Input
export interface AddEdgeInput {
  sourceId: string;
  targetId: string;
  type: EdgeType;
  metadata?: Record<string, unknown>;
}

// Serialized Plan
export interface SerializedPlanGraph {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  status: PlanStatus;
  startDate?: string;
  endDate?: string;
  nodes: SerializedPlanNode[];
  edges: SerializedPlanEdge[];
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// Serialized Plan Node (dates as strings)
export interface SerializedPlanNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  blueprintId?: string;
  platform?: Platform;
  scheduledAt?: string;
  status: NodeStatus;
  recurrence?: Recurrence;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// Serialized Plan Edge (dates as strings)
export interface SerializedPlanEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
