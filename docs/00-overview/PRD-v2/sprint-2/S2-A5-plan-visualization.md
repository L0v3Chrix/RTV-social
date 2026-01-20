# Build Prompt: S2-A5 — Plan Visualization

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-A5 |
| Sprint | 2 |
| Agent | A (Plan Graph System) |
| Complexity | Low |
| Status | pending |
| Estimated Tokens | 3,500 |
| Depends On | S2-A4 |
| Blocks | S3-A1 |

---

## Context

### What We're Building

JSON export format for plan graphs that enables UI rendering. Includes layout hints, platform groupings, timeline views, and dependency visualization data. The format is consumed by frontend components to render interactive plan views.

### Why It Matters

Users need visual tools to:
- Understand content dependencies at a glance
- View timeline of scheduled content
- Group content by platform/campaign
- Identify bottlenecks and gaps

### Spec References

- Architecture: `/docs/01-architecture/system-architecture-v3.md`
- Engineering: `/docs/07-engineering-process/engineering-handbook.md`

---

## Prerequisites

### Completed Tasks
- [x] S2-A4: Plan versioning

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/planner/src/visualization/plan-export.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PlanExporter, ExportFormat, VisualizationData } from './plan-export';
import { PlanGraph } from '../graph/plan-graph';

describe('PlanExporter', () => {
  let exporter: PlanExporter;
  let graph: PlanGraph;

  beforeEach(() => {
    exporter = new PlanExporter();
    graph = new PlanGraph({
      clientId: 'client_123',
      name: 'Test Plan',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
    });
  });

  describe('exportForVisualization', () => {
    it('should export plan with nodes and edges', () => {
      const n1 = graph.addNode({
        type: 'content',
        title: 'Node 1',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });
      const n2 = graph.addNode({
        type: 'content',
        title: 'Node 2',
        blueprintId: 'bp_test',
        platform: 'tiktok',
      });
      graph.addEdge({ sourceId: n1.id, targetId: n2.id, type: 'depends_on' });

      const result = exporter.exportForVisualization(graph);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    it('should include node positions based on dependencies', () => {
      const n1 = graph.addNode({ type: 'content', title: 'Root', blueprintId: 'bp', platform: 'instagram' });
      const n2 = graph.addNode({ type: 'content', title: 'Child', blueprintId: 'bp', platform: 'tiktok' });
      graph.addEdge({ sourceId: n2.id, targetId: n1.id, type: 'depends_on' });

      const result = exporter.exportForVisualization(graph);

      const rootNode = result.nodes.find((n) => n.id === n1.id);
      const childNode = result.nodes.find((n) => n.id === n2.id);

      // Root should be positioned before child (lower x or y)
      expect(rootNode?.position.level).toBeLessThan(childNode?.position.level);
    });

    it('should include platform colors', () => {
      graph.addNode({
        type: 'content',
        title: 'IG Post',
        blueprintId: 'bp',
        platform: 'instagram',
      });

      const result = exporter.exportForVisualization(graph);

      expect(result.nodes[0].style.color).toBeDefined();
      expect(result.nodes[0].style.platformIcon).toBe('instagram');
    });

    it('should include status indicators', () => {
      graph.addNode({
        type: 'content',
        title: 'Completed',
        blueprintId: 'bp',
        platform: 'instagram',
        status: 'completed',
      });

      const result = exporter.exportForVisualization(graph);

      expect(result.nodes[0].style.statusColor).toBeDefined();
      expect(result.nodes[0].style.statusIcon).toBe('check');
    });
  });

  describe('exportForTimeline', () => {
    it('should group nodes by date', () => {
      graph.addNode({
        type: 'content',
        title: 'Jan 15',
        blueprintId: 'bp',
        platform: 'instagram',
        scheduledAt: new Date('2025-01-15'),
      });
      graph.addNode({
        type: 'content',
        title: 'Jan 15 also',
        blueprintId: 'bp',
        platform: 'tiktok',
        scheduledAt: new Date('2025-01-15'),
      });
      graph.addNode({
        type: 'content',
        title: 'Jan 20',
        blueprintId: 'bp',
        platform: 'facebook',
        scheduledAt: new Date('2025-01-20'),
      });

      const result = exporter.exportForTimeline(graph);

      expect(result.days).toHaveLength(2);
      expect(result.days[0].nodes).toHaveLength(2);
      expect(result.days[1].nodes).toHaveLength(1);
    });

    it('should order by date ascending', () => {
      graph.addNode({
        type: 'content',
        title: 'Later',
        blueprintId: 'bp',
        platform: 'instagram',
        scheduledAt: new Date('2025-02-01'),
      });
      graph.addNode({
        type: 'content',
        title: 'Earlier',
        blueprintId: 'bp',
        platform: 'tiktok',
        scheduledAt: new Date('2025-01-15'),
      });

      const result = exporter.exportForTimeline(graph);

      expect(result.days[0].date).toBe('2025-01-15');
      expect(result.days[1].date).toBe('2025-02-01');
    });

    it('should include unscheduled nodes separately', () => {
      graph.addNode({
        type: 'content',
        title: 'Scheduled',
        blueprintId: 'bp',
        platform: 'instagram',
        scheduledAt: new Date('2025-01-15'),
      });
      graph.addNode({
        type: 'content',
        title: 'Unscheduled',
        blueprintId: 'bp',
        platform: 'tiktok',
      });

      const result = exporter.exportForTimeline(graph);

      expect(result.unscheduled).toHaveLength(1);
    });
  });

  describe('exportForPlatformView', () => {
    it('should group nodes by platform', () => {
      graph.addNode({ type: 'content', title: 'IG 1', blueprintId: 'bp', platform: 'instagram' });
      graph.addNode({ type: 'content', title: 'IG 2', blueprintId: 'bp', platform: 'instagram' });
      graph.addNode({ type: 'content', title: 'TT 1', blueprintId: 'bp', platform: 'tiktok' });

      const result = exporter.exportForPlatformView(graph);

      expect(result.platforms.instagram).toHaveLength(2);
      expect(result.platforms.tiktok).toHaveLength(1);
    });

    it('should include platform statistics', () => {
      graph.addNode({ type: 'content', title: 'Done', blueprintId: 'bp', platform: 'instagram', status: 'completed' });
      graph.addNode({ type: 'content', title: 'Pending', blueprintId: 'bp', platform: 'instagram', status: 'pending' });

      const result = exporter.exportForPlatformView(graph);

      expect(result.stats.instagram.total).toBe(2);
      expect(result.stats.instagram.completed).toBe(1);
      expect(result.stats.instagram.pending).toBe(1);
    });
  });

  describe('exportForCampaignView', () => {
    it('should group content nodes under campaigns', () => {
      const campaign = graph.addNode({
        type: 'campaign',
        title: 'Product Launch',
        description: 'Launch campaign',
      });
      const content1 = graph.addNode({
        type: 'content',
        title: 'Teaser',
        blueprintId: 'bp',
        platform: 'instagram',
      });
      const content2 = graph.addNode({
        type: 'content',
        title: 'Launch Post',
        blueprintId: 'bp',
        platform: 'instagram',
      });

      graph.addEdge({ sourceId: content1.id, targetId: campaign.id, type: 'part_of' });
      graph.addEdge({ sourceId: content2.id, targetId: campaign.id, type: 'part_of' });

      const result = exporter.exportForCampaignView(graph);

      expect(result.campaigns).toHaveLength(1);
      expect(result.campaigns[0].nodes).toHaveLength(2);
    });

    it('should include standalone content not in campaigns', () => {
      graph.addNode({ type: 'campaign', title: 'Campaign' });
      graph.addNode({ type: 'content', title: 'Standalone', blueprintId: 'bp', platform: 'instagram' });

      const result = exporter.exportForCampaignView(graph);

      expect(result.standalone).toHaveLength(1);
    });
  });

  describe('exportStatistics', () => {
    it('should calculate plan statistics', () => {
      graph.addNode({ type: 'content', title: 'C1', blueprintId: 'bp', platform: 'instagram', status: 'completed' });
      graph.addNode({ type: 'content', title: 'C2', blueprintId: 'bp', platform: 'instagram', status: 'pending' });
      graph.addNode({ type: 'content', title: 'C3', blueprintId: 'bp', platform: 'tiktok', status: 'in_progress' });
      graph.addNode({ type: 'campaign', title: 'Campaign' });

      const stats = exporter.exportStatistics(graph);

      expect(stats.totalNodes).toBe(4);
      expect(stats.contentNodes).toBe(3);
      expect(stats.campaignNodes).toBe(1);
      expect(stats.byStatus.completed).toBe(1);
      expect(stats.byStatus.pending).toBe(1);
      expect(stats.byStatus.in_progress).toBe(1);
      expect(stats.byPlatform.instagram).toBe(2);
      expect(stats.completionPercentage).toBeCloseTo(33.33, 1);
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/planner/src/visualization/types.ts`

```typescript
import { PlanNode, PlanEdge, Platform, NodeStatus } from '../graph/types';

export interface NodePosition {
  x: number;
  y: number;
  level: number;
}

export interface NodeStyle {
  color: string;
  statusColor: string;
  statusIcon: string;
  platformIcon: string;
}

export interface VisualizationNode {
  id: string;
  type: string;
  title: string;
  platform?: Platform;
  status: NodeStatus;
  scheduledAt?: string;
  position: NodePosition;
  style: NodeStyle;
  metadata: Record<string, unknown>;
}

export interface VisualizationEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  style: {
    color: string;
    dashed: boolean;
  };
}

export interface VisualizationData {
  planId: string;
  planName: string;
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  bounds: { width: number; height: number };
}

export interface TimelineDay {
  date: string;
  nodes: VisualizationNode[];
}

export interface TimelineData {
  planId: string;
  startDate: string;
  endDate: string;
  days: TimelineDay[];
  unscheduled: VisualizationNode[];
}

export interface PlatformViewData {
  planId: string;
  platforms: Record<string, VisualizationNode[]>;
  stats: Record<string, { total: number; completed: number; pending: number; inProgress: number }>;
}

export interface CampaignViewData {
  planId: string;
  campaigns: Array<{
    id: string;
    title: string;
    nodes: VisualizationNode[];
  }>;
  standalone: VisualizationNode[];
}

export interface PlanStatistics {
  totalNodes: number;
  contentNodes: number;
  campaignNodes: number;
  seriesNodes: number;
  milestoneNodes: number;
  byStatus: Record<string, number>;
  byPlatform: Record<string, number>;
  completionPercentage: number;
}
```

**File:** `packages/planner/src/visualization/plan-export.ts`

```typescript
import { PlanGraph } from '../graph/plan-graph';
import { PlanNode, Platform } from '../graph/types';
import {
  VisualizationData,
  VisualizationNode,
  VisualizationEdge,
  TimelineData,
  TimelineDay,
  PlatformViewData,
  CampaignViewData,
  PlanStatistics,
  NodePosition,
  NodeStyle,
} from './types';

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E4405F',
  facebook: '#1877F2',
  tiktok: '#000000',
  youtube: '#FF0000',
  linkedin: '#0A66C2',
  x: '#1DA1F2',
  skool: '#6366F1',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#9CA3AF',
  ready: '#3B82F6',
  in_progress: '#F59E0B',
  completed: '#10B981',
  failed: '#EF4444',
  skipped: '#6B7280',
};

const STATUS_ICONS: Record<string, string> = {
  pending: 'clock',
  ready: 'play',
  in_progress: 'loader',
  completed: 'check',
  failed: 'x',
  skipped: 'minus',
};

export class PlanExporter {
  exportForVisualization(graph: PlanGraph): VisualizationData {
    const sorted = graph.topologicalSort();
    const levelMap = this.calculateLevels(graph);

    const nodes: VisualizationNode[] = sorted.map((node, index) => ({
      id: node.id,
      type: node.type,
      title: node.title,
      platform: node.platform as Platform | undefined,
      status: node.status,
      scheduledAt: node.scheduledAt?.toISOString(),
      position: this.calculatePosition(node.id, levelMap, index),
      style: this.getNodeStyle(node),
      metadata: node.metadata ?? {},
    }));

    const edges: VisualizationEdge[] = graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: edge.type,
      style: {
        color: edge.type === 'depends_on' ? '#6B7280' : '#D1D5DB',
        dashed: edge.type !== 'depends_on',
      },
    }));

    const maxLevel = Math.max(...Object.values(levelMap), 0);
    const nodesPerLevel = new Map<number, number>();
    for (const level of Object.values(levelMap)) {
      nodesPerLevel.set(level, (nodesPerLevel.get(level) ?? 0) + 1);
    }
    const maxNodesInLevel = Math.max(...nodesPerLevel.values(), 1);

    return {
      planId: graph.id,
      planName: graph.name,
      nodes,
      edges,
      bounds: {
        width: (maxLevel + 1) * 200,
        height: maxNodesInLevel * 100,
      },
    };
  }

  exportForTimeline(graph: PlanGraph): TimelineData {
    const dayMap = new Map<string, VisualizationNode[]>();
    const unscheduled: VisualizationNode[] = [];

    for (const node of graph.nodes) {
      const vizNode = this.toVisualizationNode(node);

      if (node.scheduledAt) {
        const dateKey = node.scheduledAt.toISOString().split('T')[0];
        const existing = dayMap.get(dateKey) ?? [];
        existing.push(vizNode);
        dayMap.set(dateKey, existing);
      } else {
        unscheduled.push(vizNode);
      }
    }

    const days: TimelineDay[] = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, nodes]) => ({ date, nodes }));

    return {
      planId: graph.id,
      startDate: graph.startDate?.toISOString() ?? '',
      endDate: graph.endDate?.toISOString() ?? '',
      days,
      unscheduled,
    };
  }

  exportForPlatformView(graph: PlanGraph): PlatformViewData {
    const platforms: Record<string, VisualizationNode[]> = {};
    const stats: PlatformViewData['stats'] = {};

    for (const node of graph.nodes) {
      if (node.type !== 'content' || !node.platform) continue;

      const vizNode = this.toVisualizationNode(node);
      const platform = node.platform;

      if (!platforms[platform]) {
        platforms[platform] = [];
        stats[platform] = { total: 0, completed: 0, pending: 0, inProgress: 0 };
      }

      platforms[platform].push(vizNode);
      stats[platform].total++;

      if (node.status === 'completed') stats[platform].completed++;
      else if (node.status === 'pending') stats[platform].pending++;
      else if (node.status === 'in_progress') stats[platform].inProgress++;
    }

    return { planId: graph.id, platforms, stats };
  }

  exportForCampaignView(graph: PlanGraph): CampaignViewData {
    const campaigns: CampaignViewData['campaigns'] = [];
    const contentInCampaigns = new Set<string>();

    // Find campaign nodes and their content
    for (const node of graph.nodes) {
      if (node.type === 'campaign') {
        const contentNodes = graph.edges
          .filter((e) => e.targetId === node.id && e.type === 'part_of')
          .map((e) => graph.getNode(e.sourceId))
          .filter((n): n is PlanNode => n !== null)
          .map((n) => this.toVisualizationNode(n));

        contentNodes.forEach((n) => contentInCampaigns.add(n.id));

        campaigns.push({
          id: node.id,
          title: node.title,
          nodes: contentNodes,
        });
      }
    }

    // Find standalone content
    const standalone = graph.nodes
      .filter((n) => n.type === 'content' && !contentInCampaigns.has(n.id))
      .map((n) => this.toVisualizationNode(n));

    return { planId: graph.id, campaigns, standalone };
  }

  exportStatistics(graph: PlanGraph): PlanStatistics {
    const byStatus: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};
    let contentNodes = 0;
    let campaignNodes = 0;
    let seriesNodes = 0;
    let milestoneNodes = 0;
    let completed = 0;

    for (const node of graph.nodes) {
      // Count by type
      switch (node.type) {
        case 'content':
          contentNodes++;
          if (node.platform) {
            byPlatform[node.platform] = (byPlatform[node.platform] ?? 0) + 1;
          }
          break;
        case 'campaign':
          campaignNodes++;
          break;
        case 'series':
          seriesNodes++;
          break;
        case 'milestone':
          milestoneNodes++;
          break;
      }

      // Count by status
      byStatus[node.status] = (byStatus[node.status] ?? 0) + 1;
      if (node.status === 'completed') completed++;
    }

    const completionPercentage = contentNodes > 0
      ? (byStatus.completed ?? 0) / contentNodes * 100
      : 0;

    return {
      totalNodes: graph.nodes.length,
      contentNodes,
      campaignNodes,
      seriesNodes,
      milestoneNodes,
      byStatus,
      byPlatform,
      completionPercentage,
    };
  }

  private calculateLevels(graph: PlanGraph): Record<string, number> {
    const levels: Record<string, number> = {};

    const visit = (nodeId: string): number => {
      if (levels[nodeId] !== undefined) return levels[nodeId];

      const deps = graph.getDependencies(nodeId);
      if (deps.length === 0) {
        levels[nodeId] = 0;
      } else {
        const maxDepLevel = Math.max(...deps.map((d) => visit(d.id)));
        levels[nodeId] = maxDepLevel + 1;
      }

      return levels[nodeId];
    };

    for (const node of graph.nodes) {
      visit(node.id);
    }

    return levels;
  }

  private calculatePosition(
    nodeId: string,
    levelMap: Record<string, number>,
    index: number
  ): NodePosition {
    const level = levelMap[nodeId] ?? 0;
    return {
      x: level * 200,
      y: index * 80,
      level,
    };
  }

  private getNodeStyle(node: PlanNode): NodeStyle {
    const platform = node.platform as string | undefined;
    return {
      color: platform ? PLATFORM_COLORS[platform] ?? '#6B7280' : '#6B7280',
      statusColor: STATUS_COLORS[node.status] ?? '#9CA3AF',
      statusIcon: STATUS_ICONS[node.status] ?? 'circle',
      platformIcon: platform ?? 'file',
    };
  }

  private toVisualizationNode(node: PlanNode): VisualizationNode {
    return {
      id: node.id,
      type: node.type,
      title: node.title,
      platform: node.platform as Platform | undefined,
      status: node.status,
      scheduledAt: node.scheduledAt?.toISOString(),
      position: { x: 0, y: 0, level: 0 },
      style: this.getNodeStyle(node),
      metadata: node.metadata ?? {},
    };
  }
}

export { VisualizationData, TimelineData, PlatformViewData, CampaignViewData, PlanStatistics };
```

**File:** `packages/planner/src/visualization/index.ts`

```typescript
export * from './types';
export * from './plan-export';
```

### Phase 3: Verification

```bash
cd packages/planner
pnpm test src/visualization/
pnpm typecheck
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/planner/src/visualization/types.ts` | Export types |
| Create | `packages/planner/src/visualization/plan-export.ts` | Export service |
| Create | `packages/planner/src/visualization/plan-export.test.ts` | Unit tests |
| Create | `packages/planner/src/visualization/index.ts` | Module exports |

---

## Acceptance Criteria

- [ ] exportForVisualization includes nodes with positions
- [ ] exportForVisualization includes styled edges
- [ ] exportForTimeline groups nodes by date
- [ ] exportForTimeline orders dates ascending
- [ ] exportForTimeline separates unscheduled nodes
- [ ] exportForPlatformView groups by platform
- [ ] exportForPlatformView includes platform stats
- [ ] exportForCampaignView groups content under campaigns
- [ ] exportStatistics calculates accurate counts
- [ ] All unit tests pass

---

## JSON Task Block

```json
{
  "task_id": "S2-A5",
  "name": "Plan Visualization",
  "sprint": 2,
  "agent": "A",
  "status": "pending",
  "complexity": "low",
  "estimated_tokens": 3500,
  "dependencies": ["S2-A4"],
  "blocks": ["S3-A1"],
  "outputs": {
    "files": [
      "packages/planner/src/visualization/types.ts",
      "packages/planner/src/visualization/plan-export.ts",
      "packages/planner/src/visualization/plan-export.test.ts"
    ],
    "exports": ["PlanExporter", "VisualizationData", "TimelineData", "PlatformViewData"]
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
