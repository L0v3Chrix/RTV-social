# Build Prompt: S4-D3 — Escalation Queue

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-D3 |
| Sprint | 4 — Engagement |
| Agent | D — Escalation System |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1 day |
| Dependencies | S4-D1, S4-D2, S4-B5 |
| Blocks | S4-D4, S4-D5 |

---

## Context

### What We're Building
A priority-ordered escalation queue that manages pending handoffs. Supports priority ordering, assignment distribution, workload balancing, and queue health monitoring. Operators can claim items from the queue based on availability and expertise.

### Why It Matters
- **Fair Distribution**: Balance workload across operators
- **Priority Handling**: Urgent issues get attention first
- **Visibility**: Know what's pending and who's handling what
- **Efficiency**: Quick claiming and reassignment
- **Metrics**: Track queue depth and wait times

### Spec References
- `docs/06-reliability-ops/slo-error-budget.md` — Queue SLOs
- `docs/01-architecture/system-architecture-v3.md` — Queue architecture

---

## Prerequisites

### Completed Tasks
- [x] S4-D1: Escalation Triggers
- [x] S4-D2: Human Handoff Workflow
- [x] S4-B5: Thread Retrieval API

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/engagement/escalation/src/__tests__/escalation-queue.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EscalationQueue,
  QueueItem,
  QueueStats,
  ClaimResult,
} from '../escalation-queue';
import { createMockRepository } from './__mocks__/repository';

describe('EscalationQueue', () => {
  let queue: EscalationQueue;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    queue = new EscalationQueue({ repository: mockRepo });
  });

  describe('getQueue', () => {
    it('should return items ordered by priority then age', async () => {
      mockRepo.queryQueue.mockResolvedValue({
        items: [
          { id: 'h1', priority: 'urgent', createdAt: new Date(Date.now() - 60000) },
          { id: 'h2', priority: 'urgent', createdAt: new Date(Date.now() - 120000) },
          { id: 'h3', priority: 'high', createdAt: new Date(Date.now() - 180000) },
        ],
        total: 3,
      });

      const result = await queue.getQueue('client_abc');

      expect(result.items[0].id).toBe('h2'); // Older urgent first
      expect(result.items[1].id).toBe('h1'); // Newer urgent second
      expect(result.items[2].id).toBe('h3'); // High priority third
    });

    it('should support filtering by priority', async () => {
      mockRepo.queryQueue.mockResolvedValue({
        items: [{ id: 'h1', priority: 'urgent' }],
        total: 1,
      });

      await queue.getQueue('client_abc', { priority: ['urgent'] });

      expect(mockRepo.queryQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: ['urgent'],
        })
      );
    });

    it('should support pagination', async () => {
      mockRepo.queryQueue.mockResolvedValue({
        items: [{ id: 'h11' }, { id: 'h12' }],
        total: 25,
      });

      const result = await queue.getQueue('client_abc', {
        limit: 10,
        offset: 10,
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('claimNext', () => {
    it('should claim next available item for operator', async () => {
      mockRepo.queryQueue.mockResolvedValue({
        items: [
          { id: 'h1', priority: 'urgent', status: 'pending' },
        ],
        total: 1,
      });
      mockRepo.updateItem.mockResolvedValue({
        id: 'h1',
        status: 'assigned',
        assignedTo: 'operator_1',
      });

      const result = await queue.claimNext('client_abc', 'operator_1');

      expect(result.success).toBe(true);
      expect(result.item?.id).toBe('h1');
      expect(result.item?.assignedTo).toBe('operator_1');
    });

    it('should return nothing if queue is empty', async () => {
      mockRepo.queryQueue.mockResolvedValue({
        items: [],
        total: 0,
      });

      const result = await queue.claimNext('client_abc', 'operator_1');

      expect(result.success).toBe(false);
      expect(result.item).toBeUndefined();
    });

    it('should skip items already assigned', async () => {
      mockRepo.queryQueue.mockResolvedValue({
        items: [
          { id: 'h1', priority: 'urgent', status: 'assigned', assignedTo: 'operator_2' },
          { id: 'h2', priority: 'high', status: 'pending' },
        ],
        total: 2,
      });
      mockRepo.updateItem.mockResolvedValue({
        id: 'h2',
        status: 'assigned',
        assignedTo: 'operator_1',
      });

      const result = await queue.claimNext('client_abc', 'operator_1');

      expect(result.item?.id).toBe('h2');
    });

    it('should handle concurrent claim race condition', async () => {
      mockRepo.queryQueue.mockResolvedValue({
        items: [{ id: 'h1', status: 'pending' }],
        total: 1,
      });
      mockRepo.updateItem.mockRejectedValue(new Error('Concurrent modification'));

      const result = await queue.claimNext('client_abc', 'operator_1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Concurrent');
    });
  });

  describe('claimSpecific', () => {
    it('should claim specific item by ID', async () => {
      mockRepo.getItem.mockResolvedValue({
        id: 'h123',
        status: 'pending',
        clientId: 'client_abc',
      });
      mockRepo.updateItem.mockResolvedValue({
        id: 'h123',
        status: 'assigned',
        assignedTo: 'operator_1',
      });

      const result = await queue.claimSpecific('h123', 'operator_1');

      expect(result.success).toBe(true);
      expect(result.item?.assignedTo).toBe('operator_1');
    });

    it('should fail if item already assigned', async () => {
      mockRepo.getItem.mockResolvedValue({
        id: 'h123',
        status: 'assigned',
        assignedTo: 'operator_2',
      });

      const result = await queue.claimSpecific('h123', 'operator_1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Already assigned');
    });

    it('should fail if item not found', async () => {
      mockRepo.getItem.mockResolvedValue(null);

      const result = await queue.claimSpecific('h999', 'operator_1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('release', () => {
    it('should release item back to queue', async () => {
      mockRepo.getItem.mockResolvedValue({
        id: 'h123',
        status: 'assigned',
        assignedTo: 'operator_1',
      });
      mockRepo.updateItem.mockResolvedValue({
        id: 'h123',
        status: 'pending',
        assignedTo: null,
      });

      await queue.release('h123', 'operator_1', 'Need more expertise');

      expect(mockRepo.updateItem).toHaveBeenCalledWith(
        'h123',
        expect.objectContaining({
          status: 'pending',
          assignedTo: null,
        })
      );
    });

    it('should only allow release by assigned operator', async () => {
      mockRepo.getItem.mockResolvedValue({
        id: 'h123',
        status: 'assigned',
        assignedTo: 'operator_1',
      });

      await expect(
        queue.release('h123', 'operator_2', 'Reason')
      ).rejects.toThrow('Not assigned to you');
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      mockRepo.getQueueStats.mockResolvedValue({
        total: 15,
        byPriority: { urgent: 2, high: 5, medium: 6, low: 2 },
        byStatus: { pending: 10, assigned: 5 },
        avgWaitTimeMs: 180000, // 3 min
        oldestItemAge: 600000, // 10 min
      });

      const stats = await queue.getStats('client_abc');

      expect(stats.total).toBe(15);
      expect(stats.byPriority.urgent).toBe(2);
      expect(stats.avgWaitTimeMinutes).toBe(3);
    });
  });

  describe('getOperatorWorkload', () => {
    it('should return current workload per operator', async () => {
      mockRepo.getOperatorWorkload.mockResolvedValue([
        { operatorId: 'op1', assignedCount: 3, resolvedToday: 12 },
        { operatorId: 'op2', assignedCount: 2, resolvedToday: 8 },
      ]);

      const workload = await queue.getOperatorWorkload('client_abc');

      expect(workload).toHaveLength(2);
      expect(workload[0].assignedCount).toBe(3);
    });
  });

  describe('redistributeWorkload', () => {
    it('should redistribute items when operator goes offline', async () => {
      mockRepo.queryQueue.mockResolvedValue({
        items: [
          { id: 'h1', assignedTo: 'op_leaving' },
          { id: 'h2', assignedTo: 'op_leaving' },
        ],
        total: 2,
      });
      mockRepo.updateItem.mockResolvedValue({});

      const result = await queue.redistributeWorkload('op_leaving');

      expect(result.redistributedCount).toBe(2);
      expect(mockRepo.updateItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('autoAssign', () => {
    it('should auto-assign to available operator with lowest workload', async () => {
      mockRepo.getAvailableOperators.mockResolvedValue([
        { id: 'op1', currentLoad: 5 },
        { id: 'op2', currentLoad: 2 },
        { id: 'op3', currentLoad: 8 },
      ]);
      mockRepo.getItem.mockResolvedValue({ id: 'h123', status: 'pending' });
      mockRepo.updateItem.mockResolvedValue({ id: 'h123', assignedTo: 'op2' });

      const result = await queue.autoAssign('h123');

      expect(result.assignedTo).toBe('op2'); // Lowest workload
    });

    it('should respect operator max capacity', async () => {
      mockRepo.getAvailableOperators.mockResolvedValue([
        { id: 'op1', currentLoad: 10, maxCapacity: 10 }, // At capacity
        { id: 'op2', currentLoad: 8, maxCapacity: 10 },
      ]);
      mockRepo.getItem.mockResolvedValue({ id: 'h123', status: 'pending' });
      mockRepo.updateItem.mockResolvedValue({ id: 'h123', assignedTo: 'op2' });

      const result = await queue.autoAssign('h123');

      expect(result.assignedTo).toBe('op2');
    });
  });

  describe('priorityBoost', () => {
    it('should boost priority of items waiting too long', async () => {
      const oldItem = {
        id: 'h123',
        priority: 'medium',
        createdAt: new Date(Date.now() - 45 * 60000), // 45 min old
      };
      mockRepo.queryQueue.mockResolvedValue({
        items: [oldItem],
        total: 1,
      });

      await queue.applyPriorityBoosts('client_abc');

      expect(mockRepo.updateItem).toHaveBeenCalledWith(
        'h123',
        expect.objectContaining({
          priority: 'high',
        })
      );
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/engagement/escalation/src/escalation-queue.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { EscalationPriority } from './escalation-triggers';

const tracer = trace.getTracer('escalation-queue');

export type QueueItemStatus = 'pending' | 'assigned' | 'resolved';

export interface QueueItem {
  id: string;
  clientId: string;
  threadId: string;
  priority: EscalationPriority;
  status: QueueItemStatus;
  reason: string;
  assignedTo?: string;
  assignedAt?: Date;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface QueueStats {
  total: number;
  byPriority: Record<EscalationPriority, number>;
  byStatus: Record<QueueItemStatus, number>;
  avgWaitTimeMs: number;
  avgWaitTimeMinutes: number;
  oldestItemAge: number;
}

export interface ClaimResult {
  success: boolean;
  item?: QueueItem;
  error?: string;
}

export interface OperatorWorkload {
  operatorId: string;
  assignedCount: number;
  resolvedToday: number;
  currentLoad: number;
  maxCapacity?: number;
}

export interface QueueRepository {
  queryQueue(query: {
    clientId: string;
    status?: QueueItemStatus[];
    priority?: EscalationPriority[];
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: QueueItem[]; total: number }>;
  getItem(id: string): Promise<QueueItem | null>;
  updateItem(id: string, data: Partial<QueueItem>): Promise<QueueItem>;
  getQueueStats(clientId: string): Promise<{
    total: number;
    byPriority: Record<EscalationPriority, number>;
    byStatus: Record<QueueItemStatus, number>;
    avgWaitTimeMs: number;
    oldestItemAge: number;
  }>;
  getOperatorWorkload(clientId: string): Promise<OperatorWorkload[]>;
  getAvailableOperators(clientId: string): Promise<OperatorWorkload[]>;
}

const PRIORITY_ORDER: Record<EscalationPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_BOOST_THRESHOLDS_MS: Record<EscalationPriority, number> = {
  urgent: Infinity, // Never boost urgent
  high: 45 * 60000, // 45 min -> urgent
  medium: 30 * 60000, // 30 min -> high
  low: 60 * 60000, // 60 min -> medium
};

export class EscalationQueue {
  private repository: QueueRepository;

  constructor(config: { repository: QueueRepository }) {
    this.repository = config.repository;
  }

  async getQueue(
    clientId: string,
    options?: {
      priority?: EscalationPriority[];
      limit?: number;
      offset?: number;
    }
  ): Promise<{ items: QueueItem[]; total: number; hasMore: boolean }> {
    return tracer.startActiveSpan('getQueue', async (span) => {
      span.setAttributes({
        'queue.client_id': clientId,
        'queue.limit': options?.limit,
      });

      const result = await this.repository.queryQueue({
        clientId,
        status: ['pending', 'assigned'],
        priority: options?.priority,
        limit: options?.limit,
        offset: options?.offset,
      });

      // Sort by priority then age
      const sorted = result.items.sort((a, b) => {
        const priorityDiff =
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      span.end();

      return {
        items: sorted,
        total: result.total,
        hasMore:
          (options?.offset || 0) + sorted.length < result.total,
      };
    });
  }

  async claimNext(
    clientId: string,
    operatorId: string
  ): Promise<ClaimResult> {
    return tracer.startActiveSpan('claimNext', async (span) => {
      span.setAttributes({
        'claim.client_id': clientId,
        'claim.operator_id': operatorId,
      });

      const { items } = await this.repository.queryQueue({
        clientId,
        status: ['pending'],
        limit: 1,
      });

      if (items.length === 0) {
        span.setAttributes({ 'claim.result': 'empty_queue' });
        span.end();
        return { success: false };
      }

      const item = items[0];

      try {
        const updated = await this.repository.updateItem(item.id, {
          status: 'assigned',
          assignedTo: operatorId,
          assignedAt: new Date(),
        });

        span.setAttributes({ 'claim.item_id': item.id, 'claim.result': 'success' });
        span.end();

        return { success: true, item: updated };
      } catch (error) {
        span.setAttributes({ 'claim.result': 'error' });
        span.end();
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Concurrent modification',
        };
      }
    });
  }

  async claimSpecific(
    itemId: string,
    operatorId: string
  ): Promise<ClaimResult> {
    const item = await this.repository.getItem(itemId);

    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    if (item.status === 'assigned' && item.assignedTo !== operatorId) {
      return { success: false, error: 'Already assigned to another operator' };
    }

    const updated = await this.repository.updateItem(itemId, {
      status: 'assigned',
      assignedTo: operatorId,
      assignedAt: new Date(),
    });

    return { success: true, item: updated };
  }

  async release(
    itemId: string,
    operatorId: string,
    reason: string
  ): Promise<void> {
    const item = await this.repository.getItem(itemId);

    if (!item) {
      throw new Error('Item not found');
    }

    if (item.assignedTo !== operatorId) {
      throw new Error('Not assigned to you');
    }

    await this.repository.updateItem(itemId, {
      status: 'pending',
      assignedTo: undefined,
      assignedAt: undefined,
      metadata: {
        ...item.metadata,
        lastReleaseReason: reason,
        lastReleasedBy: operatorId,
        lastReleasedAt: new Date(),
      },
    });
  }

  async getStats(clientId: string): Promise<QueueStats> {
    const stats = await this.repository.getQueueStats(clientId);

    return {
      ...stats,
      avgWaitTimeMinutes: stats.avgWaitTimeMs / 60000,
    };
  }

  async getOperatorWorkload(clientId: string): Promise<OperatorWorkload[]> {
    return this.repository.getOperatorWorkload(clientId);
  }

  async redistributeWorkload(
    leavingOperatorId: string
  ): Promise<{ redistributedCount: number }> {
    const { items } = await this.repository.queryQueue({
      clientId: '', // All clients
      assignedTo: leavingOperatorId,
      status: ['assigned'],
    });

    for (const item of items) {
      await this.repository.updateItem(item.id, {
        status: 'pending',
        assignedTo: undefined,
        assignedAt: undefined,
        metadata: {
          ...item.metadata,
          redistributedFrom: leavingOperatorId,
          redistributedAt: new Date(),
        },
      });
    }

    return { redistributedCount: items.length };
  }

  async autoAssign(itemId: string): Promise<{ assignedTo: string }> {
    const item = await this.repository.getItem(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    const operators = await this.repository.getAvailableOperators(item.clientId);

    // Find operator with lowest load under capacity
    const availableOperators = operators.filter(
      (op) => !op.maxCapacity || op.currentLoad < op.maxCapacity
    );

    if (availableOperators.length === 0) {
      throw new Error('No operators available');
    }

    // Sort by current load
    availableOperators.sort((a, b) => a.currentLoad - b.currentLoad);

    const selectedOperator = availableOperators[0];

    await this.repository.updateItem(itemId, {
      status: 'assigned',
      assignedTo: selectedOperator.operatorId,
      assignedAt: new Date(),
    });

    return { assignedTo: selectedOperator.operatorId };
  }

  async applyPriorityBoosts(clientId: string): Promise<{ boostedCount: number }> {
    const { items } = await this.repository.queryQueue({
      clientId,
      status: ['pending'],
    });

    let boostedCount = 0;
    const now = Date.now();

    for (const item of items) {
      const age = now - item.createdAt.getTime();
      const threshold = PRIORITY_BOOST_THRESHOLDS_MS[item.priority];

      if (age > threshold) {
        const newPriority = this.getNextPriority(item.priority);
        if (newPriority) {
          await this.repository.updateItem(item.id, {
            priority: newPriority,
            metadata: {
              ...item.metadata,
              boostedAt: new Date(),
              previousPriority: item.priority,
              boostReason: 'age_threshold',
            },
          });
          boostedCount++;
        }
      }
    }

    return { boostedCount };
  }

  private getNextPriority(
    current: EscalationPriority
  ): EscalationPriority | null {
    switch (current) {
      case 'low':
        return 'medium';
      case 'medium':
        return 'high';
      case 'high':
        return 'urgent';
      default:
        return null;
    }
  }
}

export function createEscalationQueue(config: {
  repository: QueueRepository;
}): EscalationQueue {
  return new EscalationQueue(config);
}
```

### Phase 3: Verification

```bash
cd packages/engagement/escalation && pnpm test
pnpm test:coverage
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/engagement/escalation/src/escalation-queue.ts` | Queue implementation |
| Create | `packages/engagement/escalation/src/__tests__/escalation-queue.test.ts` | Tests |
| Modify | `packages/engagement/escalation/src/index.ts` | Export queue |

---

## Acceptance Criteria

- [ ] Get queue items ordered by priority then age
- [ ] Filter queue by priority level
- [ ] Support pagination
- [ ] Claim next available item
- [ ] Claim specific item by ID
- [ ] Handle concurrent claim race conditions
- [ ] Release items back to queue
- [ ] Get queue statistics (total, by priority, avg wait time)
- [ ] Get operator workload distribution
- [ ] Redistribute workload when operator leaves
- [ ] Auto-assign based on lowest workload
- [ ] Auto-boost priority for items waiting too long
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-D3",
  "name": "Escalation Queue",
  "description": "Priority-ordered queue for managing handoff items",
  "status": "pending",
  "priority": "medium",
  "complexity": "medium",
  "sprint": 4,
  "agent": "D",
  "dependencies": ["S4-D1", "S4-D2", "S4-B5"],
  "blocks": ["S4-D4", "S4-D5"],
  "estimated_hours": 8,
  "tags": ["engagement", "escalation", "queue", "priority", "tdd"],
  "package": "@rtv/engagement/escalation"
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "next_task_hints": ["S4-D4 for resolution tracking", "S4-D5 for escalation metrics"]
}
```
