/**
 * S2-A1: PlanGraph Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanGraph } from '../plan-graph.js';
import type { PlanNode, PlanGraphConfig } from '../types.js';

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

    it('should store start and end dates', () => {
      expect(graph.startDate).toEqual(new Date('2025-01-01'));
      expect(graph.endDate).toEqual(new Date('2025-03-31'));
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
      expect(node.recurrence?.frequency).toBe('weekly');
    });

    it('should add a milestone node', () => {
      const node = graph.addNode({
        type: 'milestone',
        title: 'Campaign Complete',
        description: 'End of Q1 campaign',
      });

      expect(node.type).toBe('milestone');
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

    it('should reject node scheduled before plan start date', () => {
      expect(() =>
        graph.addNode({
          type: 'content',
          title: 'Too Early',
          blueprintId: 'bp_test',
          platform: 'instagram',
          scheduledAt: new Date('2024-12-01'),
        })
      ).toThrow('outside plan date range');
    });

    it('should reject node scheduled after plan end date', () => {
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

    it('should allow node without scheduled date', () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Unscheduled',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      expect(node.scheduledAt).toBeUndefined();
    });

    it('should default status to pending', () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      expect(node.status).toBe('pending');
    });

    it('should allow setting initial status', () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
        status: 'completed',
      });

      expect(node.status).toBe('completed');
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

    it('should support depends_on edge type', () => {
      const edge = graph.addEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'depends_on',
      });

      expect(edge.type).toBe('depends_on');
    });

    it('should support repurposes edge type', () => {
      const edge = graph.addEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'repurposes',
      });

      expect(edge.type).toBe('repurposes');
    });

    it('should support follows edge type', () => {
      const edge = graph.addEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'follows',
      });

      expect(edge.type).toBe('follows');
    });

    it('should support part_of edge type', () => {
      const edge = graph.addEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'part_of',
      });

      expect(edge.type).toBe('part_of');
    });

    it('should reject edges with invalid source node ID', () => {
      expect(() =>
        graph.addEdge({
          sourceId: 'node_invalid',
          targetId: targetNode.id,
          type: 'depends_on',
        })
      ).toThrow('Source node not found');
    });

    it('should reject edges with invalid target node ID', () => {
      expect(() =>
        graph.addEdge({
          sourceId: sourceNode.id,
          targetId: 'node_invalid',
          type: 'depends_on',
        })
      ).toThrow('Target node not found');
    });

    it('should detect and prevent simple cycles', () => {
      graph.addEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'depends_on',
      });

      expect(() =>
        graph.addEdge({
          sourceId: targetNode.id,
          targetId: sourceNode.id,
          type: 'depends_on',
        })
      ).toThrow('cycle');
    });

    it('should detect and prevent complex cycles', () => {
      const middle = graph.addNode({
        type: 'content',
        title: 'Middle',
        blueprintId: 'bp_test',
        platform: 'facebook',
      });

      graph.addEdge({
        sourceId: sourceNode.id,
        targetId: middle.id,
        type: 'depends_on',
      });
      graph.addEdge({
        sourceId: middle.id,
        targetId: targetNode.id,
        type: 'depends_on',
      });

      expect(() =>
        graph.addEdge({
          sourceId: targetNode.id,
          targetId: sourceNode.id,
          type: 'depends_on',
        })
      ).toThrow('cycle');
    });

    it('should emit edge.created event', () => {
      const handler = vi.fn();
      graph.on('edge.created', handler);

      graph.addEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'depends_on',
      });

      expect(handler).toHaveBeenCalled();
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

    it('should update updatedAt timestamp', () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      const originalUpdatedAt = node.updatedAt;

      // Small delay to ensure timestamp changes
      graph.updateNode(node.id, { title: 'Updated' });

      const updated = graph.getNode(node.id);
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime()
      );
    });

    it('should throw for unknown node ID', () => {
      expect(() => graph.updateNode('node_unknown', { title: 'Test' })).toThrow(
        'Node not found'
      );
    });
  });

  describe('removeNode', () => {
    it('should remove node from graph', () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      graph.removeNode(node.id);

      expect(graph.nodes).toHaveLength(0);
    });

    it('should remove connected edges', () => {
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

      graph.addEdge({
        sourceId: node1.id,
        targetId: node2.id,
        type: 'depends_on',
      });

      graph.removeNode(node1.id);

      expect(graph.nodes).toHaveLength(1);
      expect(graph.edges).toHaveLength(0);
    });

    it('should emit node.removed event', () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      const handler = vi.fn();
      graph.on('node.removed', handler);

      graph.removeNode(node.id);

      expect(handler).toHaveBeenCalledWith(node.id);
    });

    it('should throw for unknown node ID', () => {
      expect(() => graph.removeNode('node_unknown')).toThrow('Node not found');
    });
  });

  describe('removeEdge', () => {
    it('should remove edge from graph', () => {
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

      const edge = graph.addEdge({
        sourceId: node1.id,
        targetId: node2.id,
        type: 'depends_on',
      });

      graph.removeEdge(edge.id);

      expect(graph.edges).toHaveLength(0);
    });

    it('should throw for unknown edge ID', () => {
      expect(() => graph.removeEdge('edge_unknown')).toThrow('Edge not found');
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

      graph.addEdge({
        sourceId: main.id,
        targetId: dep1.id,
        type: 'depends_on',
      });
      graph.addEdge({
        sourceId: main.id,
        targetId: dep2.id,
        type: 'depends_on',
      });

      const deps = graph.getDependencies(main.id);

      expect(deps).toHaveLength(2);
      expect(deps.map((d) => d.id)).toContain(dep1.id);
      expect(deps.map((d) => d.id)).toContain(dep2.id);
    });

    it('should return empty array for node with no dependencies', () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      const deps = graph.getDependencies(node.id);

      expect(deps).toHaveLength(0);
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

      graph.addEdge({
        sourceId: dependent.id,
        targetId: source.id,
        type: 'depends_on',
      });

      const dependents = graph.getDependents(source.id);

      expect(dependents).toHaveLength(1);
      expect(dependents[0].id).toBe(dependent.id);
    });

    it('should return empty array for node with no dependents', () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      const dependents = graph.getDependents(node.id);

      expect(dependents).toHaveLength(0);
    });
  });

  describe('topologicalSort', () => {
    it('should return nodes in execution order', () => {
      const a = graph.addNode({
        type: 'content',
        title: 'A',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });
      const b = graph.addNode({
        type: 'content',
        title: 'B',
        blueprintId: 'bp_test',
        platform: 'tiktok',
      });
      const c = graph.addNode({
        type: 'content',
        title: 'C',
        blueprintId: 'bp_test',
        platform: 'facebook',
      });

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

    it('should handle independent nodes', () => {
      graph.addNode({
        type: 'content',
        title: 'A',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });
      graph.addNode({
        type: 'content',
        title: 'B',
        blueprintId: 'bp_test',
        platform: 'tiktok',
      });

      const sorted = graph.topologicalSort();

      expect(sorted).toHaveLength(2);
    });

    it('should return empty array for empty graph', () => {
      const sorted = graph.topologicalSort();

      expect(sorted).toHaveLength(0);
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

    it('should not return nodes with incomplete dependencies', () => {
      const a = graph.addNode({
        type: 'content',
        title: 'A',
        blueprintId: 'bp_test',
        platform: 'instagram',
        status: 'pending',
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

      // Only A is ready (no dependencies), B has incomplete dependency
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe(a.id);
    });

    it('should not return already completed nodes', () => {
      const a = graph.addNode({
        type: 'content',
        title: 'A',
        blueprintId: 'bp_test',
        platform: 'instagram',
        status: 'completed',
      });

      const ready = graph.getReadyNodes();

      expect(ready).toHaveLength(0);
    });

    it('should return all nodes without dependencies if pending', () => {
      graph.addNode({
        type: 'content',
        title: 'A',
        blueprintId: 'bp_test',
        platform: 'instagram',
        status: 'pending',
      });
      graph.addNode({
        type: 'content',
        title: 'B',
        blueprintId: 'bp_test',
        platform: 'tiktok',
        status: 'pending',
      });

      const ready = graph.getReadyNodes();

      expect(ready).toHaveLength(2);
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

    it('should transition from approved to executing', () => {
      graph.submit();
      graph.approve('user_123');
      graph.startExecution();
      expect(graph.status).toBe('executing');
    });

    it('should transition from executing to completed', () => {
      graph.submit();
      graph.approve('user_123');
      graph.startExecution();
      graph.complete();
      expect(graph.status).toBe('completed');
    });

    it('should allow cancellation from most states', () => {
      graph.cancel();
      expect(graph.status).toBe('cancelled');
    });

    it('should reject invalid status transitions', () => {
      expect(() => graph.approve('user_123')).toThrow(
        'Invalid status transition'
      );
    });

    it('should reject transition from completed', () => {
      graph.submit();
      graph.approve('user_123');
      graph.startExecution();
      graph.complete();

      expect(() => graph.cancel()).toThrow('Invalid status transition');
    });

    it('should emit status.changed event', () => {
      const handler = vi.fn();
      graph.on('status.changed', handler);

      graph.submit();

      expect(handler).toHaveBeenCalledWith('pending_approval', 'draft');
    });

    it('should increment version on status change', () => {
      const initialVersion = graph.version;
      graph.submit();
      expect(graph.version).toBe(initialVersion + 1);
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

    it('should serialize all graph properties', () => {
      const json = graph.toJSON();

      expect(json.clientId).toBe('client_123');
      expect(json.name).toBe('Q1 Content Plan');
      expect(json.status).toBe('draft');
      expect(json.startDate).toBe('2025-01-01T00:00:00.000Z');
      expect(json.endDate).toBe('2025-03-31T00:00:00.000Z');
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

    it('should preserve graph state after deserialization', () => {
      graph.submit();
      graph.approve('user_123');

      const json = graph.toJSON();
      const restored = PlanGraph.fromJSON(json);

      expect(restored.status).toBe('approved');
    });

    it('should preserve nodes and edges after deserialization', () => {
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
      graph.addEdge({
        sourceId: node1.id,
        targetId: node2.id,
        type: 'depends_on',
      });

      const json = graph.toJSON();
      const restored = PlanGraph.fromJSON(json);

      expect(restored.nodes).toHaveLength(2);
      expect(restored.edges).toHaveLength(1);
    });
  });
});
