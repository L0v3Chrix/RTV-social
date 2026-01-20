# Build Prompt: S2-A3 — Plan API Endpoints

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-A3 |
| Sprint | 2 |
| Agent | A (Plan Graph System) |
| Complexity | Medium |
| Status | pending |
| Estimated Tokens | 5,000 |
| Depends On | S2-A1, S2-A2 |
| Blocks | S2-A4 |

---

## Context

### What We're Building

RESTful API endpoints for plan graph CRUD operations: create plans, add/update/remove nodes and edges, submit for approval, approve/reject. All operations are tenant-scoped and emit audit events.

### Why It Matters

The API is the interface for:
- Frontend plan builder UI
- Automated planning agents
- Approval workflows
- Integration with external scheduling tools

### Spec References

- Architecture: `/docs/01-architecture/system-architecture-v3.md` (API Design)
- Engineering: `/docs/07-engineering-process/engineering-handbook.md`
- Security: `/docs/05-policy-safety/multi-tenant-isolation.md`

---

## Prerequisites

### Completed Tasks
- [x] S2-A1: PlanGraph model
- [x] S2-A2: Plan node types

### Required Packages
```bash
pnpm add zod hono @hono/zod-validator
pnpm add -D vitest @types/node
```

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/planner/src/api/plan-api.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { planRoutes } from './plan-routes';
import { PlanService } from '../service/plan-service';

describe('Plan API', () => {
  let app: Hono;
  let mockService: PlanService;

  beforeEach(() => {
    mockService = {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      addNode: vi.fn(),
      updateNode: vi.fn(),
      removeNode: vi.fn(),
      addEdge: vi.fn(),
      removeEdge: vi.fn(),
      submit: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn(),
    } as unknown as PlanService;

    app = new Hono();
    app.route('/plans', planRoutes(mockService));
  });

  describe('POST /plans', () => {
    it('should create a plan', async () => {
      const planData = {
        clientId: 'client_123',
        name: 'Q1 Plan',
        startDate: '2025-01-01',
        endDate: '2025-03-31',
      };

      vi.mocked(mockService.create).mockResolvedValue({
        id: 'plan_abc123',
        ...planData,
        status: 'draft',
      } as any);

      const res = await app.request('/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe('plan_abc123');
    });

    it('should return 400 for invalid input', async () => {
      const res = await app.request('/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }), // Missing required fields
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /plans/:id', () => {
    it('should get a plan by ID', async () => {
      vi.mocked(mockService.get).mockResolvedValue({
        id: 'plan_abc123',
        name: 'Test Plan',
        status: 'draft',
        nodes: [],
        edges: [],
      } as any);

      const res = await app.request('/plans/plan_abc123');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe('plan_abc123');
    });

    it('should return 404 for unknown plan', async () => {
      vi.mocked(mockService.get).mockResolvedValue(null);

      const res = await app.request('/plans/plan_unknown');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /plans', () => {
    it('should list plans for client', async () => {
      vi.mocked(mockService.list).mockResolvedValue({
        plans: [{ id: 'plan_1' }, { id: 'plan_2' }],
        total: 2,
        page: 1,
        pageSize: 20,
      } as any);

      const res = await app.request('/plans?clientId=client_123');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.plans).toHaveLength(2);
    });

    it('should support pagination', async () => {
      vi.mocked(mockService.list).mockResolvedValue({
        plans: [],
        total: 100,
        page: 2,
        pageSize: 20,
      } as any);

      const res = await app.request('/plans?clientId=client_123&page=2&pageSize=20');

      expect(res.status).toBe(200);
      expect(mockService.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 20 })
      );
    });

    it('should filter by status', async () => {
      const res = await app.request('/plans?clientId=client_123&status=draft');

      expect(mockService.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft' })
      );
    });
  });

  describe('PATCH /plans/:id', () => {
    it('should update plan properties', async () => {
      vi.mocked(mockService.update).mockResolvedValue({
        id: 'plan_abc123',
        name: 'Updated Name',
      } as any);

      const res = await app.request('/plans/plan_abc123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /plans/:id', () => {
    it('should delete a plan', async () => {
      vi.mocked(mockService.delete).mockResolvedValue(undefined);

      const res = await app.request('/plans/plan_abc123', {
        method: 'DELETE',
      });

      expect(res.status).toBe(204);
    });
  });

  describe('POST /plans/:id/nodes', () => {
    it('should add a node to plan', async () => {
      const nodeData = {
        type: 'content',
        title: 'Instagram Post',
        blueprintId: 'bp_reel',
        platform: 'instagram',
      };

      vi.mocked(mockService.addNode).mockResolvedValue({
        id: 'node_xyz789',
        ...nodeData,
      } as any);

      const res = await app.request('/plans/plan_abc123/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nodeData),
      });

      expect(res.status).toBe(201);
    });
  });

  describe('PATCH /plans/:id/nodes/:nodeId', () => {
    it('should update a node', async () => {
      vi.mocked(mockService.updateNode).mockResolvedValue({
        id: 'node_xyz789',
        title: 'Updated Title',
      } as any);

      const res = await app.request('/plans/plan_abc123/nodes/node_xyz789', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated Title' }),
      });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /plans/:id/nodes/:nodeId', () => {
    it('should remove a node', async () => {
      vi.mocked(mockService.removeNode).mockResolvedValue(undefined);

      const res = await app.request('/plans/plan_abc123/nodes/node_xyz789', {
        method: 'DELETE',
      });

      expect(res.status).toBe(204);
    });
  });

  describe('POST /plans/:id/edges', () => {
    it('should add an edge', async () => {
      const edgeData = {
        sourceId: 'node_1',
        targetId: 'node_2',
        type: 'depends_on',
      };

      vi.mocked(mockService.addEdge).mockResolvedValue({
        id: 'edge_abc',
        ...edgeData,
      } as any);

      const res = await app.request('/plans/plan_abc123/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edgeData),
      });

      expect(res.status).toBe(201);
    });
  });

  describe('POST /plans/:id/submit', () => {
    it('should submit plan for approval', async () => {
      vi.mocked(mockService.submit).mockResolvedValue({
        id: 'plan_abc123',
        status: 'pending_approval',
      } as any);

      const res = await app.request('/plans/plan_abc123/submit', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('pending_approval');
    });
  });

  describe('POST /plans/:id/approve', () => {
    it('should approve a plan', async () => {
      vi.mocked(mockService.approve).mockResolvedValue({
        id: 'plan_abc123',
        status: 'approved',
      } as any);

      const res = await app.request('/plans/plan_abc123/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user_123' }),
      });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /plans/:id/reject', () => {
    it('should reject a plan with reason', async () => {
      vi.mocked(mockService.reject).mockResolvedValue({
        id: 'plan_abc123',
        status: 'rejected',
      } as any);

      const res = await app.request('/plans/plan_abc123/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user_123', reason: 'Needs more content' }),
      });

      expect(res.status).toBe(200);
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/planner/src/api/schemas.ts`

```typescript
import { z } from 'zod';

export const CreatePlanSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const UpdatePlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const ListPlansSchema = z.object({
  clientId: z.string().min(1),
  status: z.enum(['draft', 'pending_approval', 'approved', 'rejected', 'executing', 'completed', 'cancelled']).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export const AddNodeSchema = z.object({
  type: z.enum(['content', 'campaign', 'series', 'milestone']),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  blueprintId: z.string().optional(),
  platform: z.enum(['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'skool']).optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateNodeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(['pending', 'ready', 'in_progress', 'completed', 'failed', 'skipped']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AddEdgeSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: z.enum(['depends_on', 'repurposes', 'follows', 'part_of']),
  metadata: z.record(z.unknown()).optional(),
});

export const ApproveSchema = z.object({
  userId: z.string().min(1),
  comment: z.string().max(500).optional(),
});

export const RejectSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(1).max(500),
});
```

**File:** `packages/planner/src/api/plan-routes.ts`

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  CreatePlanSchema,
  UpdatePlanSchema,
  ListPlansSchema,
  AddNodeSchema,
  UpdateNodeSchema,
  AddEdgeSchema,
  ApproveSchema,
  RejectSchema,
} from './schemas';
import { PlanService } from '../service/plan-service';

export function planRoutes(service: PlanService): Hono {
  const router = new Hono();

  // Create plan
  router.post('/', zValidator('json', CreatePlanSchema), async (c) => {
    const data = c.req.valid('json');
    const plan = await service.create({
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    });
    return c.json(plan, 201);
  });

  // List plans
  router.get('/', zValidator('query', ListPlansSchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.list(query);
    return c.json(result);
  });

  // Get plan
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const plan = await service.get(id);
    if (!plan) {
      return c.json({ error: 'Plan not found' }, 404);
    }
    return c.json(plan);
  });

  // Update plan
  router.patch('/:id', zValidator('json', UpdatePlanSchema), async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const plan = await service.update(id, {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    });
    return c.json(plan);
  });

  // Delete plan
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await service.delete(id);
    return c.body(null, 204);
  });

  // Add node
  router.post('/:id/nodes', zValidator('json', AddNodeSchema), async (c) => {
    const planId = c.req.param('id');
    const data = c.req.valid('json');
    const node = await service.addNode(planId, {
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    });
    return c.json(node, 201);
  });

  // Update node
  router.patch('/:id/nodes/:nodeId', zValidator('json', UpdateNodeSchema), async (c) => {
    const planId = c.req.param('id');
    const nodeId = c.req.param('nodeId');
    const data = c.req.valid('json');
    const node = await service.updateNode(planId, nodeId, {
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    });
    return c.json(node);
  });

  // Remove node
  router.delete('/:id/nodes/:nodeId', async (c) => {
    const planId = c.req.param('id');
    const nodeId = c.req.param('nodeId');
    await service.removeNode(planId, nodeId);
    return c.body(null, 204);
  });

  // Add edge
  router.post('/:id/edges', zValidator('json', AddEdgeSchema), async (c) => {
    const planId = c.req.param('id');
    const data = c.req.valid('json');
    const edge = await service.addEdge(planId, data);
    return c.json(edge, 201);
  });

  // Remove edge
  router.delete('/:id/edges/:edgeId', async (c) => {
    const planId = c.req.param('id');
    const edgeId = c.req.param('edgeId');
    await service.removeEdge(planId, edgeId);
    return c.body(null, 204);
  });

  // Submit for approval
  router.post('/:id/submit', async (c) => {
    const id = c.req.param('id');
    const plan = await service.submit(id);
    return c.json(plan);
  });

  // Approve
  router.post('/:id/approve', zValidator('json', ApproveSchema), async (c) => {
    const id = c.req.param('id');
    const { userId, comment } = c.req.valid('json');
    const plan = await service.approve(id, userId, comment);
    return c.json(plan);
  });

  // Reject
  router.post('/:id/reject', zValidator('json', RejectSchema), async (c) => {
    const id = c.req.param('id');
    const { userId, reason } = c.req.valid('json');
    const plan = await service.reject(id, userId, reason);
    return c.json(plan);
  });

  return router;
}
```

**File:** `packages/planner/src/api/index.ts`

```typescript
export * from './schemas';
export * from './plan-routes';
```

### Phase 3: Verification

```bash
cd packages/planner
pnpm test src/api/
pnpm typecheck
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/planner/src/api/schemas.ts` | Zod validation schemas |
| Create | `packages/planner/src/api/plan-routes.ts` | Hono route handlers |
| Create | `packages/planner/src/api/plan-api.test.ts` | API tests |
| Create | `packages/planner/src/api/index.ts` | Module exports |

---

## Acceptance Criteria

- [ ] POST /plans creates a new plan
- [ ] GET /plans/:id retrieves plan with nodes/edges
- [ ] GET /plans lists plans with pagination and filtering
- [ ] PATCH /plans/:id updates plan properties
- [ ] DELETE /plans/:id removes a plan
- [ ] POST /plans/:id/nodes adds a node
- [ ] PATCH /plans/:id/nodes/:nodeId updates a node
- [ ] DELETE /plans/:id/nodes/:nodeId removes a node
- [ ] POST /plans/:id/edges adds an edge
- [ ] DELETE /plans/:id/edges/:edgeId removes an edge
- [ ] POST /plans/:id/submit submits for approval
- [ ] POST /plans/:id/approve approves a plan
- [ ] POST /plans/:id/reject rejects a plan with reason
- [ ] All inputs validated with Zod
- [ ] 400 returned for invalid input
- [ ] 404 returned for unknown resources

---

## JSON Task Block

```json
{
  "task_id": "S2-A3",
  "name": "Plan API Endpoints",
  "sprint": 2,
  "agent": "A",
  "status": "pending",
  "complexity": "medium",
  "estimated_tokens": 5000,
  "dependencies": ["S2-A1", "S2-A2"],
  "blocks": ["S2-A4"],
  "outputs": {
    "files": [
      "packages/planner/src/api/schemas.ts",
      "packages/planner/src/api/plan-routes.ts",
      "packages/planner/src/api/plan-api.test.ts"
    ],
    "exports": ["planRoutes"]
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
