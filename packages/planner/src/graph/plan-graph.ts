/**
 * S2-A1: PlanGraph Model
 *
 * A directed acyclic graph (DAG) representing a content plan.
 * Each node represents content or a campaign, and edges represent
 * dependencies and relationships.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  PlanNode,
  PlanEdge,
  PlanStatus,
  PlanGraphConfig,
  AddNodeInput,
  AddEdgeInput,
  SerializedPlanGraph,
  SerializedPlanNode,
  SerializedPlanEdge,
} from './types.js';

interface PlanGraphEvents {
  'node.created': (node: PlanNode) => void;
  'node.updated': (node: PlanNode, changes: Partial<PlanNode>) => void;
  'node.removed': (nodeId: string) => void;
  'edge.created': (edge: PlanEdge) => void;
  'edge.removed': (edgeId: string) => void;
  'status.changed': (newStatus: PlanStatus, oldStatus: PlanStatus) => void;
}


/**
 * PlanGraph represents a content plan as a DAG.
 *
 * Supports:
 * - Content, campaign, series, and milestone nodes
 * - Dependency, repurpose, follow, and part_of edges
 * - Cycle detection to maintain DAG property
 * - Status-based workflow (draft → approved → executing → completed)
 * - Serialization for persistence
 */
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
    if (config.description !== undefined) {
      this.description = config.description;
    }
    if (config.startDate !== undefined) {
      this.startDate = config.startDate;
    }
    if (config.endDate !== undefined) {
      this.endDate = config.endDate;
    }
    this.createdAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Current status of the plan.
   */
  get status(): PlanStatus {
    return this._status;
  }

  /**
   * Version number, incremented on each modification.
   */
  get version(): number {
    return this._version;
  }

  /**
   * All nodes in the graph.
   */
  get nodes(): PlanNode[] {
    return Array.from(this._nodes.values());
  }

  /**
   * All edges in the graph.
   */
  get edges(): PlanEdge[] {
    return Array.from(this._edges.values());
  }

  /**
   * Add a node to the graph.
   */
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
      status: input.status ?? 'pending',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    // Add optional properties only if defined
    if (input.description !== undefined) node.description = input.description;
    if (input.blueprintId !== undefined) node.blueprintId = input.blueprintId;
    if (input.platform !== undefined) node.platform = input.platform;
    if (input.scheduledAt !== undefined) node.scheduledAt = input.scheduledAt;
    if (input.recurrence !== undefined) node.recurrence = input.recurrence;
    if (input.metadata !== undefined) node.metadata = input.metadata;

    this._nodes.set(node.id, node);
    this._updatedAt = now;
    this.emit('node.created', node);

    return node;
  }

  /**
   * Add an edge between two nodes.
   */
  addEdge(input: AddEdgeInput): PlanEdge {
    // Validate source node exists
    if (!this._nodes.has(input.sourceId)) {
      throw new Error('Source node not found');
    }

    // Validate target node exists
    if (!this._nodes.has(input.targetId)) {
      throw new Error('Target node not found');
    }

    // Check for cycles (only for depends_on edges)
    if (input.type === 'depends_on' && this.wouldCreateCycle(input.sourceId, input.targetId)) {
      throw new Error('Adding this edge would create a cycle');
    }

    const edge: PlanEdge = {
      id: `edge_${nanoid(12)}`,
      sourceId: input.sourceId,
      targetId: input.targetId,
      type: input.type,
      createdAt: new Date(),
    };

    // Add optional properties only if defined
    if (input.metadata !== undefined) edge.metadata = input.metadata;

    this._edges.set(edge.id, edge);
    this._updatedAt = new Date();
    this.emit('edge.created', edge);

    return edge;
  }

  /**
   * Get a node by ID.
   */
  getNode(nodeId: string): PlanNode | null {
    return this._nodes.get(nodeId) ?? null;
  }

  /**
   * Update a node's properties.
   */
  updateNode(
    nodeId: string,
    changes: Partial<Omit<PlanNode, 'id' | 'createdAt'>>
  ): void {
    const node = this._nodes.get(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    // Start with existing node
    const updatedNode: PlanNode = {
      ...node,
      version: node.version + 1,
      updatedAt: new Date(),
    };

    // Apply changes, only including defined values
    if (changes.type !== undefined) updatedNode.type = changes.type;
    if (changes.title !== undefined) updatedNode.title = changes.title;
    if (changes.description !== undefined) updatedNode.description = changes.description;
    if (changes.blueprintId !== undefined) updatedNode.blueprintId = changes.blueprintId;
    if (changes.platform !== undefined) updatedNode.platform = changes.platform;
    if (changes.scheduledAt !== undefined) updatedNode.scheduledAt = changes.scheduledAt;
    if (changes.status !== undefined) updatedNode.status = changes.status;
    if (changes.recurrence !== undefined) updatedNode.recurrence = changes.recurrence;
    if (changes.metadata !== undefined) updatedNode.metadata = changes.metadata;

    this._nodes.set(nodeId, updatedNode);
    this._updatedAt = new Date();
    this.emit('node.updated', updatedNode, changes);
  }

  /**
   * Remove a node and all connected edges.
   */
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

  /**
   * Remove an edge by ID.
   */
  removeEdge(edgeId: string): void {
    if (!this._edges.has(edgeId)) {
      throw new Error('Edge not found');
    }

    this._edges.delete(edgeId);
    this._updatedAt = new Date();
    this.emit('edge.removed', edgeId);
  }

  /**
   * Get nodes that a node depends on (upstream dependencies).
   */
  getDependencies(nodeId: string): PlanNode[] {
    const edges = Array.from(this._edges.values()).filter(
      (e) => e.sourceId === nodeId && e.type === 'depends_on'
    );

    return edges
      .map((e) => this._nodes.get(e.targetId))
      .filter((n): n is PlanNode => n !== undefined);
  }

  /**
   * Get nodes that depend on a node (downstream dependents).
   */
  getDependents(nodeId: string): PlanNode[] {
    const edges = Array.from(this._edges.values()).filter(
      (e) => e.targetId === nodeId && e.type === 'depends_on'
    );

    return edges
      .map((e) => this._nodes.get(e.sourceId))
      .filter((n): n is PlanNode => n !== undefined);
  }

  /**
   * Return nodes in topological order (dependencies before dependents).
   */
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

  /**
   * Get nodes that are ready to execute (pending with all dependencies completed).
   */
  getReadyNodes(): PlanNode[] {
    return this.nodes.filter((node) => {
      if (node.status !== 'pending') return false;

      const deps = this.getDependencies(node.id);
      return deps.every((dep) => dep.status === 'completed');
    });
  }

  // Status transitions

  /**
   * Submit plan for approval.
   */
  submit(): void {
    this.transitionStatus('pending_approval');
  }

  /**
   * Approve the plan.
   */
  approve(userId: string): void {
    this.transitionStatus('approved');
    this._approvedBy = userId;
    this._approvedAt = new Date();
  }

  /**
   * Reject the plan.
   */
  reject(userId: string, reason: string): void {
    this.transitionStatus('rejected');
    this._rejectedBy = userId;
    this._rejectedAt = new Date();
    this._rejectionReason = reason;
  }

  /**
   * Start executing the plan.
   */
  startExecution(): void {
    this.transitionStatus('executing');
  }

  /**
   * Mark the plan as complete.
   */
  complete(): void {
    this.transitionStatus('completed');
  }

  /**
   * Cancel the plan.
   */
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
      throw new Error(
        `Invalid status transition from ${this._status} to ${newStatus}`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._version++;
    this._updatedAt = new Date();
    this.emit('status.changed', newStatus, oldStatus);
  }

  private wouldCreateCycle(sourceId: string, targetId: string): boolean {
    // DFS to check if targetId can reach sourceId through depends_on edges
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

  /**
   * Serialize the graph to JSON.
   */
  toJSON(): SerializedPlanGraph {
    const base: SerializedPlanGraph = {
      id: this.id,
      clientId: this.clientId,
      name: this.name,
      status: this._status,
      nodes: this.nodes.map((n) => this.serializeNode(n)),
      edges: this.edges.map((e) => this.serializeEdge(e)),
      version: this._version,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };

    // Add optional fields only if defined
    if (this.description !== undefined) base.description = this.description;
    if (this.startDate !== undefined) base.startDate = this.startDate.toISOString();
    if (this.endDate !== undefined) base.endDate = this.endDate.toISOString();
    if (this._approvedBy !== undefined) base.approvedBy = this._approvedBy;
    if (this._approvedAt !== undefined) base.approvedAt = this._approvedAt.toISOString();
    if (this._rejectedBy !== undefined) base.rejectedBy = this._rejectedBy;
    if (this._rejectedAt !== undefined) base.rejectedAt = this._rejectedAt.toISOString();
    if (this._rejectionReason !== undefined) base.rejectionReason = this._rejectionReason;

    return base;
  }

  private serializeNode(node: PlanNode): SerializedPlanNode {
    const base: SerializedPlanNode = {
      id: node.id,
      type: node.type,
      title: node.title,
      status: node.status,
      version: node.version,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    };

    // Add optional fields only if defined
    if (node.description !== undefined) base.description = node.description;
    if (node.blueprintId !== undefined) base.blueprintId = node.blueprintId;
    if (node.platform !== undefined) base.platform = node.platform;
    if (node.scheduledAt !== undefined) base.scheduledAt = node.scheduledAt.toISOString();
    if (node.recurrence !== undefined) base.recurrence = node.recurrence;
    if (node.metadata !== undefined) base.metadata = node.metadata;

    return base;
  }

  private serializeEdge(edge: PlanEdge): SerializedPlanEdge {
    const base: SerializedPlanEdge = {
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      type: edge.type,
      createdAt: edge.createdAt.toISOString(),
    };

    // Add optional fields only if defined
    if (edge.metadata !== undefined) base.metadata = edge.metadata;

    return base;
  }

  /**
   * Deserialize a graph from JSON.
   */
  static fromJSON(json: SerializedPlanGraph): PlanGraph {
    const config: PlanGraphConfig = {
      clientId: json.clientId,
      name: json.name,
    };
    if (json.description !== undefined) config.description = json.description;
    if (json.startDate !== undefined) config.startDate = new Date(json.startDate);
    if (json.endDate !== undefined) config.endDate = new Date(json.endDate);

    const graph = new PlanGraph(config);

    // Override generated values with stored values
    (graph as { id: string }).id = json.id;
    graph._status = json.status;
    graph._version = json.version;
    (graph as { createdAt: Date }).createdAt = new Date(json.createdAt);
    graph._updatedAt = new Date(json.updatedAt);

    if (json.approvedBy !== undefined) graph._approvedBy = json.approvedBy;
    if (json.approvedAt !== undefined) graph._approvedAt = new Date(json.approvedAt);
    if (json.rejectedBy !== undefined) graph._rejectedBy = json.rejectedBy;
    if (json.rejectedAt !== undefined) graph._rejectedAt = new Date(json.rejectedAt);
    if (json.rejectionReason !== undefined) graph._rejectionReason = json.rejectionReason;

    // Restore nodes
    for (const nodeJson of json.nodes) {
      const node: PlanNode = {
        id: nodeJson.id,
        type: nodeJson.type,
        title: nodeJson.title,
        status: nodeJson.status,
        version: nodeJson.version,
        createdAt: new Date(nodeJson.createdAt),
        updatedAt: new Date(nodeJson.updatedAt),
      };

      // Add optional fields only if defined
      if (nodeJson.description !== undefined) node.description = nodeJson.description;
      if (nodeJson.blueprintId !== undefined) node.blueprintId = nodeJson.blueprintId;
      if (nodeJson.platform !== undefined) node.platform = nodeJson.platform;
      if (nodeJson.scheduledAt !== undefined) node.scheduledAt = new Date(nodeJson.scheduledAt);
      if (nodeJson.recurrence !== undefined) node.recurrence = nodeJson.recurrence;
      if (nodeJson.metadata !== undefined) node.metadata = nodeJson.metadata;

      graph._nodes.set(node.id, node);
    }

    // Restore edges
    for (const edgeJson of json.edges) {
      const edge: PlanEdge = {
        id: edgeJson.id,
        sourceId: edgeJson.sourceId,
        targetId: edgeJson.targetId,
        type: edgeJson.type,
        createdAt: new Date(edgeJson.createdAt),
      };

      // Add optional fields only if defined
      if (edgeJson.metadata !== undefined) edge.metadata = edgeJson.metadata;

      graph._edges.set(edge.id, edge);
    }

    return graph;
  }
}

// Re-export types for convenience
export type {
  PlanNode,
  PlanEdge,
  PlanStatus,
  PlanGraphConfig,
  AddNodeInput,
  AddEdgeInput,
};
