# Build Prompt: S2-A1 — PlanGraph Model

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-A1 |
| Sprint | 2 |
| Agent | A (Plan Graph System) |
| Complexity | High |
| Status | pending |
| Estimated Tokens | 5,500 |
| Depends On | S1-A5 |
| Blocks | S2-A2, S2-A3 |

---

## Context

### What We're Building

The PlanGraph model is a directed acyclic graph (DAG) representing a content plan. Each node represents a piece of content or campaign, and edges represent dependencies and relationships. The model supports multi-platform content strategies with proper sequencing and timing.

### Why It Matters

The planning system is the brain of content operations:
- Orchestrates what content gets created and when
- Manages dependencies between related pieces
- Enables human review before execution
- Provides visibility into content pipeline

### Spec References

- Architecture: `/docs/01-architecture/system-architecture-v3.md` (Planning section)
- RLM Integration: `/docs/01-architecture/rlm-integration-spec.md`
- External Memory: `/docs/02-schemas/external-memory-schema.md`
- Engineering: `/docs/07-engineering-process/engineering-handbook.md`

---

## Prerequisites

### Completed Tasks
- [x] S1-A5: Domain event emission

### Required Packages
```bash
pnpm add zod nanoid date-fns
pnpm add -D vitest @types/node
```

### Required Knowledge
- DAG data structures
- Content scheduling patterns
- Domain event patterns

---

## Instructions

### Phase 1: Test First (TDD)

Create the test file BEFORE implementation.

**File:** `packages/planner/src/graph/plan-graph.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PlanGraph,
  PlanNode,
  PlanEdge,
  PlanGraphConfig,
  PlanStatus,
  NodeType,
} from './plan-graph';

describe('PlanGraph', () => {
  let graph: PlanGraph;
  let config: PlanGraphConfig;

  beforeEach(() => {
    config = {
      clientId: 'client_123',
      name: 'Q1 Content Plan',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
    };
    graph = new PlanGraph(config);
  });

  describe('initialization', () => {
    it('should create a plan with unique ID', () => {
      expect(graph.id).toMatch(/^plan_/);
    });

    it('should start in draft status', () => {
      expect(graph.status).toBe('draft');
    });

    it('should store client and name', () => {
      expect(graph.clientId).toBe('client_123');
      expect(graph.name).toBe('Q1 Content Plan');
    });

    it('should have empty nodes and edges', () => {
      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });
  });

  describe('addNode', () => {
    it('should add a content node', () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Instagram Reel',
        blueprintId: 'bp_hook_value_cta',
        platform: 'instagram',
        scheduledAt: new Date('2025-01-15'),
      });

      expect(node.id).toMatch(/^node_/);
      expect(graph.nodes).toHaveLength(1);
    });

    it('should add a campaign node', () => {
      const node = graph.addNode({
        type: 'campaign',
        title: 'Product Launch',
        description: 'New product campaign',
      });

      expect(node.type).toBe('campaign');
    });

    it('should add a series node', () => {
      const node = graph.addNode({
        type: 'series',
        title: 'Weekly Tips',
        description: 'Recurring tip series',
        recurrence: { frequency: 'weekly', dayOfWeek: 1 },
      });

      expect(node.type).toBe('series');
    });

    it('should emit node.created event', () => {
      const handler = vi.fn();
      graph.on('node.created', handler);

      graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'content', title: 'Test' })
      );
    });

    it('should reject node outside plan date range', () => {
      expect(() =>
        graph.addNode({
          type: 'content',
          title: 'Too Late',
          blueprintId: 'bp_test',
          platform: 'instagram',
          scheduledAt: new Date('2025-06-01'),
        })
      ).toThrow('outside plan date range');
    });
  });

  describe('addEdge', () => {
    let sourceNode: PlanNode;
    let targetNode: PlanNode;

    beforeEach(() => {
      sourceNode = graph.addNode({
        type: 'content',
        title: 'Source',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });
      targetNode = graph.addNode({
        type: 'content',
        title: 'Target',
        blueprintId: 'bp_test',
        platform: 'tiktok',
      });
    });

    it('should add an edge between nodes', () => {
      const edge = graph.addEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'depends_on',
      });

      expect(edge.id).toMatch(/^edge_/);
      expect(graph.edges).toHaveLength(1);
    });

    it('should support different edge types', () => {
      const edge = graph.addEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'repurposes',
      });

      expect(edge.type).toBe('repurposes');
    });

    it('should reject edges with invalid node IDs', () => {
      expect(() =>
        graph.addEdge({
          sourceId: 'node_invalid',
          targetId: targetNode.id,
          type: 'depends_on',
        })
      ).toThrow('Source node not found');
    });

    it('should detect and prevent cycles', () => {
      const middle = graph.addNode({
        type: 'content',
        title: 'Middle',
        blueprintId: 'bp_test',
        platform: 'facebook',
      });

      graph.addEdge({ sourceId: sourceNode.id, targetId: middle.id, type: 'depends_on' });
      graph.addEdge({ sourceId: middle.id, targetId: targetNode.id, type: 'depends_on' });

      expect(() =>
        graph.addEdge({
          sourceId: targetNode.id,
          targetId: sourceNode.id,
          type: 'depends_on',
        })
      ).toThrow('cycle');
    });
  });

  describe('getNode', () => {
    it('should retrieve node by ID', () => {
      const added = graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      const retrieved = graph.getNode(added.id);
      expect(retrieved).toEqual(added);
    });

    it('should return null for unknown ID', () => {
      expect(graph.getNode('node_unknown')).toBeNull();
    });
  });

  describe('updateNode', () => {
    it('should update node properties', () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Original',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      graph.updateNode(node.id, { title: 'Updated' });

      expect(graph.getNode(node.id)?.title).toBe('Updated');
    });

    it('should emit node.updated event', () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      const handler = vi.fn();
      graph.on('node.updated', handler);

      graph.updateNode(node.id, { title: 'Updated' });

      expect(handler).toHaveBeenCalled();
    });

    it('should track version on updates', () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      expect(node.version).toBe(1);

      graph.updateNode(node.id, { title: 'Updated' });

      expect(graph.getNode(node.id)?.version).toBe(2);
    });
  });

  describe('removeNode', () => {
    it('should remove node and connected edges', () => {
      const node1 = graph.addNode({
        type: 'content',
        title: 'Node 1',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });
      const node2 = graph.addNode({
        type: 'content',
        title: 'Node 2',
        blueprintId: 'bp_test',
        platform: 'tiktok',
      });

      graph.addEdge({ sourceId: node1.id, targetId: node2.id, type: 'depends_on' });

      graph.removeNode(node1.id);

      expect(graph.nodes).toHaveLength(1);
      expect(graph.edges).toHaveLength(0);
    });
  });

  describe('getDependencies', () => {
    it('should return nodes that a node depends on', () => {
      const dep1 = graph.addNode({
        type: 'content',
        title: 'Dep 1',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });
      const dep2 = graph.addNode({
        type: 'content',
        title: 'Dep 2',
        blueprintId: 'bp_test',
        platform: 'tiktok',
      });
      const main = graph.addNode({
        type: 'content',
        title: 'Main',
        blueprintId: 'bp_test',
        platform: 'facebook',
      });

      graph.addEdge({ sourceId: main.id, targetId: dep1.id, type: 'depends_on' });
      graph.addEdge({ sourceId: main.id, targetId: dep2.id, type: 'depends_on' });

      const deps = graph.getDependencies(main.id);

      expect(deps).toHaveLength(2);
      expect(deps.map((d) => d.id)).toContain(dep1.id);
      expect(deps.map((d) => d.id)).toContain(dep2.id);
    });
  });

  describe('getDependents', () => {
    it('should return nodes that depend on a node', () => {
      const source = graph.addNode({
        type: 'content',
        title: 'Source',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });
      const dependent = graph.addNode({
        type: 'content',
        title: 'Dependent',
        blueprintId: 'bp_test',
        platform: 'tiktok',
      });

      graph.addEdge({ sourceId: dependent.id, targetId: source.id, type: 'depends_on' });

      const dependents = graph.getDependents(source.id);

      expect(dependents).toHaveLength(1);
      expect(dependents[0].id).toBe(dependent.id);
    });
  });

  describe('topologicalSort', () => {
    it('should return nodes in execution order', () => {
      const a = graph.addNode({ type: 'content', title: 'A', blueprintId: 'bp_test', platform: 'instagram' });
      const b = graph.addNode({ type: 'content', title: 'B', blueprintId: 'bp_test', platform: 'tiktok' });
      const c = graph.addNode({ type: 'content', title: 'C', blueprintId: 'bp_test', platform: 'facebook' });

      // C depends on B, B depends on A
      graph.addEdge({ sourceId: b.id, targetId: a.id, type: 'depends_on' });
      graph.addEdge({ sourceId: c.id, targetId: b.id, type: 'depends_on' });

      const sorted = graph.topologicalSort();

      const indexA = sorted.findIndex((n) => n.id === a.id);
      const indexB = sorted.findIndex((n) => n.id === b.id);
      const indexC = sorted.findIndex((n) => n.id === c.id);

      expect(indexA).toBeLessThan(indexB);
      expect(indexB).toBeLessThan(indexC);
    });
  });

  describe('getReadyNodes', () => {
    it('should return nodes with all dependencies completed', () => {
      const a = graph.addNode({
        type: 'content',
        title: 'A',
        blueprintId: 'bp_test',
        platform: 'instagram',
        status: 'completed',
      });
      const b = graph.addNode({
        type: 'content',
        title: 'B',
        blueprintId: 'bp_test',
        platform: 'tiktok',
        status: 'pending',
      });

      graph.addEdge({ sourceId: b.id, targetId: a.id, type: 'depends_on' });

      const ready = graph.getReadyNodes();

      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe(b.id);
    });
  });

  describe('status transitions', () => {
    it('should transition from draft to pending_approval', () => {
      graph.submit();
      expect(graph.status).toBe('pending_approval');
    });

    it('should transition from pending_approval to approved', () => {
      graph.submit();
      graph.approve('user_123');
      expect(graph.status).toBe('approved');
    });

    it('should transition from pending_approval to rejected', () => {
      graph.submit();
      graph.reject('user_123', 'Needs more content');
      expect(graph.status).toBe('rejected');
    });

    it('should reject invalid status transitions', () => {
      expect(() => graph.approve('user_123')).toThrow('Invalid status transition');
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      const json = graph.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('nodes');
      expect(json).toHaveProperty('edges');
      expect(json.nodes).toHaveLength(1);
    });

    it('should deserialize from JSON', () => {
      graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      const json = graph.toJSON();
      const restored = PlanGraph.fromJSON(json);

      expect(restored.id).toBe(graph.id);
      expect(restored.nodes).toHaveLength(1);
    });
  });
});
```

Run the tests to confirm they fail:

```bash
cd packages/planner
pnpm test src/graph/plan-graph.test.ts
```

### Phase 2: Implementation

**File:** `packages/planner/src/graph/types.ts`

```typescript
import { z } from 'zod';

// Plan Status
export const PlanStatuses = ['draft', 'pending_approval', 'approved', 'rejected', 'executing', 'completed', 'cancelled'] as const;
export type PlanStatus = typeof PlanStatuses[number];

// Node Types
export const NodeTypes = ['content', 'campaign', 'series', 'milestone'] as const;
export type NodeType = typeof NodeTypes[number];

// Edge Types
export const EdgeTypes = ['depends_on', 'repurposes', 'follows', 'part_of'] as const;
export type EdgeType = typeof EdgeTypes[number];

// Node Status
export const NodeStatuses = ['pending', 'ready', 'in_progress', 'completed', 'failed', 'skipped'] as const;
export type NodeStatus = typeof NodeStatuses[number];

// Platform
export const Platforms = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'skool'] as const;
export type Platform = typeof Platforms[number];

// Recurrence
export const RecurrenceSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  endDate: z.date().optional(),
});

export type Recurrence = z.infer<typeof RecurrenceSchema>;

// Plan Node
export const PlanNodeSchema = z.object({
  id: z.string(),
  type: z.enum(NodeTypes),
  title: z.string(),
  description: z.string().optional(),
  blueprintId: z.string().optional(),
  platform: z.enum(Platforms).optional(),
  scheduledAt: z.date().optional(),
  status: z.enum(NodeStatuses).default('pending'),
  recurrence: RecurrenceSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  version: z.number().default(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PlanNode = z.infer<typeof PlanNodeSchema>;

// Plan Edge
export const PlanEdgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  type: z.enum(EdgeTypes),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
});

export type PlanEdge = z.infer<typeof PlanEdgeSchema>;

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
  nodes: PlanNode[];
  edges: PlanEdge[];
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
```

**File:** `packages/planner/src/graph/plan-graph.ts`

```typescript
import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import {
  PlanNode,
  PlanEdge,
  PlanStatus,
  NodeType,
  NodeStatus,
  PlanGraphConfig,
  AddNodeInput,
  AddEdgeInput,
  SerializedPlanGraph,
} from './types';

interface PlanGraphEvents {
  'node.created': (node: PlanNode) => void;
  'node.updated': (node: PlanNode, changes: Partial<PlanNode>) => void;
  'node.removed': (nodeId: string) => void;
  'edge.created': (edge: PlanEdge) => void;
  'edge.removed': (edgeId: string) => void;
  'status.changed': (newStatus: PlanStatus, oldStatus: PlanStatus) => void;
}

export class PlanGraph extends EventEmitter<PlanGraphEvents> {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly description?: string;
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly createdAt: Date;

  private _status: PlanStatus = 'draft';
  private _nodes: Map<string, PlanNode> = new Map();
  private _edges: Map<string, PlanEdge> = new Map();
  private _version: number = 1;
  private _updatedAt: Date;
  private _approvedBy?: string;
  private _approvedAt?: Date;
  private _rejectedBy?: string;
  private _rejectedAt?: Date;
  private _rejectionReason?: string;

  constructor(config: PlanGraphConfig) {
    super();
    this.id = `plan_${nanoid(12)}`;
    this.clientId = config.clientId;
    this.name = config.name;
    this.description = config.description;
    this.startDate = config.startDate;
    this.endDate = config.endDate;
    this.createdAt = new Date();
    this._updatedAt = new Date();
  }

  get status(): PlanStatus {
    return this._status;
  }

  get version(): number {
    return this._version;
  }

  get nodes(): PlanNode[] {
    return Array.from(this._nodes.values());
  }

  get edges(): PlanEdge[] {
    return Array.from(this._edges.values());
  }

  addNode(input: AddNodeInput): PlanNode {
    // Validate scheduled date within plan range
    if (input.scheduledAt) {
      if (this.startDate && input.scheduledAt < this.startDate) {
        throw new Error('Scheduled date is outside plan date range');
      }
      if (this.endDate && input.scheduledAt > this.endDate) {
        throw new Error('Scheduled date is outside plan date range');
      }
    }

    const now = new Date();
    const node: PlanNode = {
      id: `node_${nanoid(12)}`,
      type: input.type,
      title: input.title,
      description: input.description,
      blueprintId: input.blueprintId,
      platform: input.platform,
      scheduledAt: input.scheduledAt,
      status: input.status ?? 'pending',
      recurrence: input.recurrence,
      metadata: input.metadata,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    this._nodes.set(node.id, node);
    this._updatedAt = now;
    this.emit('node.created', node);

    return node;
  }

  addEdge(input: AddEdgeInput): PlanEdge {
    // Validate source node exists
    if (!this._nodes.has(input.sourceId)) {
      throw new Error('Source node not found');
    }

    // Validate target node exists
    if (!this._nodes.has(input.targetId)) {
      throw new Error('Target node not found');
    }

    // Check for cycles
    if (this.wouldCreateCycle(input.sourceId, input.targetId)) {
      throw new Error('Adding this edge would create a cycle');
    }

    const edge: PlanEdge = {
      id: `edge_${nanoid(12)}`,
      sourceId: input.sourceId,
      targetId: input.targetId,
      type: input.type,
      metadata: input.metadata,
      createdAt: new Date(),
    };

    this._edges.set(edge.id, edge);
    this._updatedAt = new Date();
    this.emit('edge.created', edge);

    return edge;
  }

  getNode(nodeId: string): PlanNode | null {
    return this._nodes.get(nodeId) ?? null;
  }

  updateNode(nodeId: string, changes: Partial<Omit<PlanNode, 'id' | 'createdAt'>>): void {
    const node = this._nodes.get(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    const updatedNode: PlanNode = {
      ...node,
      ...changes,
      version: node.version + 1,
      updatedAt: new Date(),
    };

    this._nodes.set(nodeId, updatedNode);
    this._updatedAt = new Date();
    this.emit('node.updated', updatedNode, changes);
  }

  removeNode(nodeId: string): void {
    if (!this._nodes.has(nodeId)) {
      throw new Error('Node not found');
    }

    // Remove connected edges
    const connectedEdges = Array.from(this._edges.values()).filter(
      (e) => e.sourceId === nodeId || e.targetId === nodeId
    );

    for (const edge of connectedEdges) {
      this._edges.delete(edge.id);
      this.emit('edge.removed', edge.id);
    }

    this._nodes.delete(nodeId);
    this._updatedAt = new Date();
    this.emit('node.removed', nodeId);
  }

  removeEdge(edgeId: string): void {
    if (!this._edges.has(edgeId)) {
      throw new Error('Edge not found');
    }

    this._edges.delete(edgeId);
    this._updatedAt = new Date();
    this.emit('edge.removed', edgeId);
  }

  getDependencies(nodeId: string): PlanNode[] {
    const edges = Array.from(this._edges.values()).filter(
      (e) => e.sourceId === nodeId && e.type === 'depends_on'
    );

    return edges
      .map((e) => this._nodes.get(e.targetId))
      .filter((n): n is PlanNode => n !== undefined);
  }

  getDependents(nodeId: string): PlanNode[] {
    const edges = Array.from(this._edges.values()).filter(
      (e) => e.targetId === nodeId && e.type === 'depends_on'
    );

    return edges
      .map((e) => this._nodes.get(e.sourceId))
      .filter((n): n is PlanNode => n !== undefined);
  }

  topologicalSort(): PlanNode[] {
    const visited = new Set<string>();
    const result: PlanNode[] = [];

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // Visit dependencies first
      const deps = this.getDependencies(nodeId);
      for (const dep of deps) {
        visit(dep.id);
      }

      const node = this._nodes.get(nodeId);
      if (node) {
        result.push(node);
      }
    };

    for (const nodeId of this._nodes.keys()) {
      visit(nodeId);
    }

    return result;
  }

  getReadyNodes(): PlanNode[] {
    return this.nodes.filter((node) => {
      if (node.status !== 'pending') return false;

      const deps = this.getDependencies(node.id);
      return deps.every((dep) => dep.status === 'completed');
    });
  }

  // Status transitions
  submit(): void {
    this.transitionStatus('pending_approval');
  }

  approve(userId: string): void {
    this.transitionStatus('approved');
    this._approvedBy = userId;
    this._approvedAt = new Date();
  }

  reject(userId: string, reason: string): void {
    this.transitionStatus('rejected');
    this._rejectedBy = userId;
    this._rejectedAt = new Date();
    this._rejectionReason = reason;
  }

  startExecution(): void {
    this.transitionStatus('executing');
  }

  complete(): void {
    this.transitionStatus('completed');
  }

  cancel(): void {
    this.transitionStatus('cancelled');
  }

  private transitionStatus(newStatus: PlanStatus): void {
    const validTransitions: Record<PlanStatus, PlanStatus[]> = {
      draft: ['pending_approval', 'cancelled'],
      pending_approval: ['approved', 'rejected', 'draft', 'cancelled'],
      approved: ['executing', 'cancelled'],
      rejected: ['draft', 'cancelled'],
      executing: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    if (!validTransitions[this._status].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this._status} to ${newStatus}`);
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._version++;
    this._updatedAt = new Date();
    this.emit('status.changed', newStatus, oldStatus);
  }

  private wouldCreateCycle(sourceId: string, targetId: string): boolean {
    // DFS to check if targetId can reach sourceId
    const visited = new Set<string>();

    const canReach = (from: string, to: string): boolean => {
      if (from === to) return true;
      if (visited.has(from)) return false;
      visited.add(from);

      // Get nodes that 'from' depends on (outgoing depends_on edges)
      const edges = Array.from(this._edges.values()).filter(
        (e) => e.sourceId === from && e.type === 'depends_on'
      );

      for (const edge of edges) {
        if (canReach(edge.targetId, to)) return true;
      }

      return false;
    };

    return canReach(targetId, sourceId);
  }

  // Serialization
  toJSON(): SerializedPlanGraph {
    return {
      id: this.id,
      clientId: this.clientId,
      name: this.name,
      description: this.description,
      status: this._status,
      startDate: this.startDate?.toISOString(),
      endDate: this.endDate?.toISOString(),
      nodes: this.nodes,
      edges: this.edges,
      approvedBy: this._approvedBy,
      approvedAt: this._approvedAt?.toISOString(),
      rejectedBy: this._rejectedBy,
      rejectedAt: this._rejectedAt?.toISOString(),
      rejectionReason: this._rejectionReason,
      version: this._version,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  static fromJSON(json: SerializedPlanGraph): PlanGraph {
    const graph = new PlanGraph({
      clientId: json.clientId,
      name: json.name,
      description: json.description,
      startDate: json.startDate ? new Date(json.startDate) : undefined,
      endDate: json.endDate ? new Date(json.endDate) : undefined,
    });

    // Override generated ID with stored ID
    (graph as any).id = json.id;
    (graph as any)._status = json.status;
    (graph as any)._version = json.version;
    (graph as any).createdAt = new Date(json.createdAt);
    (graph as any)._updatedAt = new Date(json.updatedAt);

    if (json.approvedBy) (graph as any)._approvedBy = json.approvedBy;
    if (json.approvedAt) (graph as any)._approvedAt = new Date(json.approvedAt);
    if (json.rejectedBy) (graph as any)._rejectedBy = json.rejectedBy;
    if (json.rejectedAt) (graph as any)._rejectedAt = new Date(json.rejectedAt);
    if (json.rejectionReason) (graph as any)._rejectionReason = json.rejectionReason;

    // Restore nodes
    for (const node of json.nodes) {
      graph._nodes.set(node.id, node);
    }

    // Restore edges
    for (const edge of json.edges) {
      graph._edges.set(edge.id, edge);
    }

    return graph;
  }
}

export { PlanNode, PlanEdge, PlanStatus, NodeType, NodeStatus, PlanGraphConfig };
```

**File:** `packages/planner/src/graph/index.ts`

```typescript
export * from './types';
export * from './plan-graph';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/planner
pnpm test src/graph/

# Type check
pnpm typecheck

# Lint
pnpm lint

# Verify exports
pnpm build
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/planner/src/graph/types.ts` | Plan graph types and schemas |
| Create | `packages/planner/src/graph/plan-graph.ts` | Plan graph implementation |
| Create | `packages/planner/src/graph/plan-graph.test.ts` | Unit tests |
| Create | `packages/planner/src/graph/index.ts` | Module exports |
| Create | `packages/planner/package.json` | Package configuration |
| Create | `packages/planner/tsconfig.json` | TypeScript config |

---

## Acceptance Criteria

- [ ] PlanGraph creates with unique ID and draft status
- [ ] Content, campaign, series, milestone node types supported
- [ ] depends_on, repurposes, follows, part_of edge types supported
- [ ] Nodes validated against plan date range
- [ ] Cycle detection prevents invalid edges
- [ ] getDependencies returns upstream nodes
- [ ] getDependents returns downstream nodes
- [ ] topologicalSort returns execution order
- [ ] getReadyNodes returns nodes with completed dependencies
- [ ] Status transitions validated (draft → approved flow)
- [ ] Node versioning tracks updates
- [ ] Serialization/deserialization works correctly
- [ ] All unit tests pass with >90% coverage

---

## Test Requirements

### Unit Tests
- Node CRUD operations
- Edge CRUD operations
- Cycle detection
- Dependency queries
- Topological sorting
- Status transitions
- Serialization

### Integration Tests
- Complex graph operations
- Multi-platform content plans

---

## Security & Safety Checklist

- [ ] No hardcoded secrets or credentials
- [ ] Plan scoped to clientId
- [ ] Status transitions validated
- [ ] Input validation on all public methods

---

## JSON Task Block

```json
{
  "task_id": "S2-A1",
  "name": "PlanGraph Model",
  "sprint": 2,
  "agent": "A",
  "status": "pending",
  "complexity": "high",
  "estimated_tokens": 5500,
  "dependencies": ["S1-A5"],
  "blocks": ["S2-A2", "S2-A3"],
  "spec_refs": [
    "/docs/01-architecture/system-architecture-v3.md",
    "/docs/01-architecture/rlm-integration-spec.md",
    "/docs/02-schemas/external-memory-schema.md"
  ],
  "acceptance_criteria": [
    "plan_graph_with_unique_id",
    "node_types_supported",
    "edge_types_supported",
    "cycle_detection_works",
    "topological_sort_correct",
    "status_transitions_validated",
    "serialization_works"
  ],
  "outputs": {
    "files": [
      "packages/planner/src/graph/types.ts",
      "packages/planner/src/graph/plan-graph.ts",
      "packages/planner/src/graph/plan-graph.test.ts",
      "packages/planner/src/graph/index.ts"
    ],
    "exports": ["PlanGraph", "PlanNode", "PlanEdge", "PlanStatus", "NodeType"]
  }
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "last_checkpoint": null,
  "execution_notes": [],
  "blockers_encountered": [],
  "decisions_made": []
}
```

---

## Hints for AI Agent

1. **DAG Validation**: Use DFS to detect cycles before adding edges
2. **Topological Sort**: Kahn's algorithm or DFS-based approach
3. **Event Emission**: Emit events for all mutations
4. **Status Machine**: Validate transitions with explicit allowed map
5. **Serialization**: Handle Date objects carefully in JSON
6. **Node Versioning**: Increment on every update for conflict detection
