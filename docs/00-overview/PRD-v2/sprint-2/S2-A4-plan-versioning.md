# Build Prompt: S2-A4 — Plan Versioning

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-A4 |
| Sprint | 2 |
| Agent | A (Plan Graph System) |
| Complexity | Medium |
| Status | pending |
| Estimated Tokens | 4,000 |
| Depends On | S2-A3 |
| Blocks | S2-A5 |

---

## Context

### What We're Building

Plan versioning system that tracks draft → approved → executed lifecycle with full audit history. Each version is immutable once approved, enabling rollback and comparison between versions.

### Why It Matters

Content plans need versioning for:
- Audit trail of changes before approval
- Rollback if execution fails
- Comparison between plan versions
- Compliance and accountability

### Spec References

- Architecture: `/docs/01-architecture/system-architecture-v3.md`
- Engineering: `/docs/07-engineering-process/engineering-handbook.md`

---

## Prerequisites

### Completed Tasks
- [x] S2-A3: Plan API endpoints

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/planner/src/versioning/plan-versioning.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PlanVersionService,
  PlanVersion,
  VersionSnapshot,
} from './plan-versioning';
import { PlanGraph } from '../graph/plan-graph';

describe('PlanVersionService', () => {
  let service: PlanVersionService;
  let graph: PlanGraph;

  beforeEach(() => {
    service = new PlanVersionService();
    graph = new PlanGraph({
      clientId: 'client_123',
      name: 'Test Plan',
    });
  });

  describe('createVersion', () => {
    it('should create version 1 for new plan', async () => {
      const version = await service.createVersion(graph, 'Initial draft');

      expect(version.version).toBe(1);
      expect(version.status).toBe('draft');
      expect(version.comment).toBe('Initial draft');
    });

    it('should increment version number', async () => {
      await service.createVersion(graph, 'v1');

      graph.addNode({
        type: 'content',
        title: 'New Node',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      const v2 = await service.createVersion(graph, 'Added node');

      expect(v2.version).toBe(2);
    });

    it('should capture full snapshot of plan state', async () => {
      graph.addNode({
        type: 'content',
        title: 'Node 1',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      const version = await service.createVersion(graph, 'With node');

      expect(version.snapshot.nodes).toHaveLength(1);
      expect(version.snapshot.edges).toHaveLength(0);
    });

    it('should record creator and timestamp', async () => {
      const version = await service.createVersion(graph, 'Test', 'user_123');

      expect(version.createdBy).toBe('user_123');
      expect(version.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getVersion', () => {
    it('should retrieve specific version', async () => {
      await service.createVersion(graph, 'v1');
      await service.createVersion(graph, 'v2');

      const v1 = await service.getVersion(graph.id, 1);

      expect(v1?.version).toBe(1);
      expect(v1?.comment).toBe('v1');
    });

    it('should return null for nonexistent version', async () => {
      const result = await service.getVersion(graph.id, 999);
      expect(result).toBeNull();
    });
  });

  describe('getLatestVersion', () => {
    it('should return most recent version', async () => {
      await service.createVersion(graph, 'v1');
      await service.createVersion(graph, 'v2');
      await service.createVersion(graph, 'v3');

      const latest = await service.getLatestVersion(graph.id);

      expect(latest?.version).toBe(3);
    });
  });

  describe('listVersions', () => {
    it('should list all versions for a plan', async () => {
      await service.createVersion(graph, 'v1');
      await service.createVersion(graph, 'v2');
      await service.createVersion(graph, 'v3');

      const versions = await service.listVersions(graph.id);

      expect(versions).toHaveLength(3);
    });

    it('should order by version descending', async () => {
      await service.createVersion(graph, 'v1');
      await service.createVersion(graph, 'v2');

      const versions = await service.listVersions(graph.id);

      expect(versions[0].version).toBe(2);
      expect(versions[1].version).toBe(1);
    });
  });

  describe('restoreVersion', () => {
    it('should restore plan to previous version state', async () => {
      graph.addNode({
        type: 'content',
        title: 'Original',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });
      await service.createVersion(graph, 'v1');

      graph.addNode({
        type: 'content',
        title: 'Added Later',
        blueprintId: 'bp_test',
        platform: 'tiktok',
      });
      await service.createVersion(graph, 'v2');

      const restored = await service.restoreVersion(graph.id, 1);

      expect(restored.nodes).toHaveLength(1);
      expect(restored.nodes[0].title).toBe('Original');
    });

    it('should create new version when restoring', async () => {
      await service.createVersion(graph, 'v1');
      await service.createVersion(graph, 'v2');

      await service.restoreVersion(graph.id, 1);

      const versions = await service.listVersions(graph.id);
      expect(versions).toHaveLength(3);
      expect(versions[0].comment).toContain('Restored from v1');
    });
  });

  describe('compareVersions', () => {
    it('should show added nodes', async () => {
      await service.createVersion(graph, 'v1');

      graph.addNode({
        type: 'content',
        title: 'New Node',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });
      await service.createVersion(graph, 'v2');

      const diff = await service.compareVersions(graph.id, 1, 2);

      expect(diff.nodesAdded).toHaveLength(1);
      expect(diff.nodesRemoved).toHaveLength(0);
    });

    it('should show removed nodes', async () => {
      const node = graph.addNode({
        type: 'content',
        title: 'To Remove',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });
      await service.createVersion(graph, 'v1');

      graph.removeNode(node.id);
      await service.createVersion(graph, 'v2');

      const diff = await service.compareVersions(graph.id, 1, 2);

      expect(diff.nodesRemoved).toHaveLength(1);
    });

    it('should show modified nodes', async () => {
      const node = graph.addNode({
        type: 'content',
        title: 'Original Title',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });
      await service.createVersion(graph, 'v1');

      graph.updateNode(node.id, { title: 'Updated Title' });
      await service.createVersion(graph, 'v2');

      const diff = await service.compareVersions(graph.id, 1, 2);

      expect(diff.nodesModified).toHaveLength(1);
      expect(diff.nodesModified[0].changes).toContain('title');
    });

    it('should show edge changes', async () => {
      const n1 = graph.addNode({ type: 'content', title: 'N1', blueprintId: 'bp', platform: 'instagram' });
      const n2 = graph.addNode({ type: 'content', title: 'N2', blueprintId: 'bp', platform: 'tiktok' });
      await service.createVersion(graph, 'v1');

      graph.addEdge({ sourceId: n1.id, targetId: n2.id, type: 'depends_on' });
      await service.createVersion(graph, 'v2');

      const diff = await service.compareVersions(graph.id, 1, 2);

      expect(diff.edgesAdded).toHaveLength(1);
    });
  });

  describe('markApproved', () => {
    it('should mark version as approved', async () => {
      const v1 = await service.createVersion(graph, 'Draft');

      const approved = await service.markApproved(graph.id, v1.version, 'user_123');

      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe('user_123');
      expect(approved.approvedAt).toBeInstanceOf(Date);
    });

    it('should reject approving already approved version', async () => {
      const v1 = await service.createVersion(graph, 'Draft');
      await service.markApproved(graph.id, v1.version, 'user_123');

      await expect(
        service.markApproved(graph.id, v1.version, 'user_456')
      ).rejects.toThrow('already approved');
    });
  });

  describe('lockVersion', () => {
    it('should lock version to prevent changes', async () => {
      const v1 = await service.createVersion(graph, 'Draft');

      await service.lockVersion(graph.id, v1.version);

      const version = await service.getVersion(graph.id, v1.version);
      expect(version?.locked).toBe(true);
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/planner/src/versioning/types.ts`

```typescript
import { z } from 'zod';
import { SerializedPlanGraph } from '../graph/types';

export const VersionStatusSchema = z.enum(['draft', 'approved', 'superseded']);
export type VersionStatus = z.infer<typeof VersionStatusSchema>;

export interface VersionSnapshot extends SerializedPlanGraph {}

export interface PlanVersion {
  id: string;
  planId: string;
  version: number;
  status: VersionStatus;
  snapshot: VersionSnapshot;
  comment?: string;
  createdBy?: string;
  createdAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  locked: boolean;
}

export interface VersionDiff {
  fromVersion: number;
  toVersion: number;
  nodesAdded: Array<{ id: string; title: string }>;
  nodesRemoved: Array<{ id: string; title: string }>;
  nodesModified: Array<{ id: string; title: string; changes: string[] }>;
  edgesAdded: Array<{ id: string; type: string }>;
  edgesRemoved: Array<{ id: string; type: string }>;
}
```

**File:** `packages/planner/src/versioning/plan-versioning.ts`

```typescript
import { nanoid } from 'nanoid';
import { PlanGraph, SerializedPlanGraph } from '../graph/plan-graph';
import { PlanVersion, VersionSnapshot, VersionDiff, VersionStatus } from './types';

export class PlanVersionService {
  private versions: Map<string, PlanVersion[]> = new Map();

  async createVersion(
    graph: PlanGraph,
    comment?: string,
    createdBy?: string
  ): Promise<PlanVersion> {
    const planId = graph.id;
    const existing = this.versions.get(planId) ?? [];
    const nextVersion = existing.length + 1;

    // Mark previous versions as superseded
    for (const v of existing) {
      if (v.status === 'draft') {
        v.status = 'superseded';
      }
    }

    const version: PlanVersion = {
      id: `ver_${nanoid(12)}`,
      planId,
      version: nextVersion,
      status: 'draft',
      snapshot: graph.toJSON(),
      comment,
      createdBy,
      createdAt: new Date(),
      locked: false,
    };

    existing.push(version);
    this.versions.set(planId, existing);

    return version;
  }

  async getVersion(planId: string, versionNumber: number): Promise<PlanVersion | null> {
    const versions = this.versions.get(planId) ?? [];
    return versions.find((v) => v.version === versionNumber) ?? null;
  }

  async getLatestVersion(planId: string): Promise<PlanVersion | null> {
    const versions = this.versions.get(planId) ?? [];
    if (versions.length === 0) return null;
    return versions[versions.length - 1];
  }

  async listVersions(planId: string): Promise<PlanVersion[]> {
    const versions = this.versions.get(planId) ?? [];
    return [...versions].sort((a, b) => b.version - a.version);
  }

  async restoreVersion(planId: string, versionNumber: number): Promise<PlanGraph> {
    const version = await this.getVersion(planId, versionNumber);
    if (!version) {
      throw new Error(`Version ${versionNumber} not found`);
    }

    const restored = PlanGraph.fromJSON(version.snapshot);

    // Create new version for the restore
    await this.createVersion(
      restored,
      `Restored from v${versionNumber}`,
      version.createdBy
    );

    return restored;
  }

  async compareVersions(
    planId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<VersionDiff> {
    const from = await this.getVersion(planId, fromVersion);
    const to = await this.getVersion(planId, toVersion);

    if (!from || !to) {
      throw new Error('Version not found');
    }

    const fromNodes = new Map(from.snapshot.nodes.map((n) => [n.id, n]));
    const toNodes = new Map(to.snapshot.nodes.map((n) => [n.id, n]));
    const fromEdges = new Map(from.snapshot.edges.map((e) => [e.id, e]));
    const toEdges = new Map(to.snapshot.edges.map((e) => [e.id, e]));

    const nodesAdded: VersionDiff['nodesAdded'] = [];
    const nodesRemoved: VersionDiff['nodesRemoved'] = [];
    const nodesModified: VersionDiff['nodesModified'] = [];
    const edgesAdded: VersionDiff['edgesAdded'] = [];
    const edgesRemoved: VersionDiff['edgesRemoved'] = [];

    // Find added and modified nodes
    for (const [id, node] of toNodes) {
      const oldNode = fromNodes.get(id);
      if (!oldNode) {
        nodesAdded.push({ id, title: node.title });
      } else {
        const changes = this.findNodeChanges(oldNode, node);
        if (changes.length > 0) {
          nodesModified.push({ id, title: node.title, changes });
        }
      }
    }

    // Find removed nodes
    for (const [id, node] of fromNodes) {
      if (!toNodes.has(id)) {
        nodesRemoved.push({ id, title: node.title });
      }
    }

    // Find added edges
    for (const [id, edge] of toEdges) {
      if (!fromEdges.has(id)) {
        edgesAdded.push({ id, type: edge.type });
      }
    }

    // Find removed edges
    for (const [id, edge] of fromEdges) {
      if (!toEdges.has(id)) {
        edgesRemoved.push({ id, type: edge.type });
      }
    }

    return {
      fromVersion,
      toVersion,
      nodesAdded,
      nodesRemoved,
      nodesModified,
      edgesAdded,
      edgesRemoved,
    };
  }

  private findNodeChanges(oldNode: any, newNode: any): string[] {
    const changes: string[] = [];
    const fields = ['title', 'description', 'status', 'scheduledAt', 'blueprintId', 'platform'];

    for (const field of fields) {
      if (JSON.stringify(oldNode[field]) !== JSON.stringify(newNode[field])) {
        changes.push(field);
      }
    }

    return changes;
  }

  async markApproved(
    planId: string,
    versionNumber: number,
    approvedBy: string
  ): Promise<PlanVersion> {
    const version = await this.getVersion(planId, versionNumber);
    if (!version) {
      throw new Error(`Version ${versionNumber} not found`);
    }

    if (version.status === 'approved') {
      throw new Error('Version is already approved');
    }

    version.status = 'approved';
    version.approvedBy = approvedBy;
    version.approvedAt = new Date();
    version.locked = true;

    return version;
  }

  async lockVersion(planId: string, versionNumber: number): Promise<void> {
    const version = await this.getVersion(planId, versionNumber);
    if (!version) {
      throw new Error(`Version ${versionNumber} not found`);
    }

    version.locked = true;
  }
}

export { PlanVersion, VersionSnapshot, VersionDiff };
```

**File:** `packages/planner/src/versioning/index.ts`

```typescript
export * from './types';
export * from './plan-versioning';
```

### Phase 3: Verification

```bash
cd packages/planner
pnpm test src/versioning/
pnpm typecheck
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/planner/src/versioning/types.ts` | Version types |
| Create | `packages/planner/src/versioning/plan-versioning.ts` | Version service |
| Create | `packages/planner/src/versioning/plan-versioning.test.ts` | Unit tests |
| Create | `packages/planner/src/versioning/index.ts` | Module exports |

---

## Acceptance Criteria

- [ ] createVersion increments version number
- [ ] createVersion captures full plan snapshot
- [ ] getVersion retrieves specific version
- [ ] getLatestVersion returns most recent
- [ ] listVersions orders by version descending
- [ ] restoreVersion recreates plan state
- [ ] compareVersions shows nodes added/removed/modified
- [ ] compareVersions shows edges added/removed
- [ ] markApproved updates status and records approver
- [ ] lockVersion prevents further changes
- [ ] All unit tests pass

---

## JSON Task Block

```json
{
  "task_id": "S2-A4",
  "name": "Plan Versioning",
  "sprint": 2,
  "agent": "A",
  "status": "pending",
  "complexity": "medium",
  "estimated_tokens": 4000,
  "dependencies": ["S2-A3"],
  "blocks": ["S2-A5"],
  "outputs": {
    "files": [
      "packages/planner/src/versioning/types.ts",
      "packages/planner/src/versioning/plan-versioning.ts",
      "packages/planner/src/versioning/plan-versioning.test.ts"
    ],
    "exports": ["PlanVersionService", "PlanVersion", "VersionDiff"]
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
