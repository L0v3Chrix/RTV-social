# Build Prompt: S4-B5 — Thread Retrieval API

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-B5 |
| Sprint | 4 — Engagement |
| Agent | B — Conversation Thread Model |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1 day |
| Dependencies | S4-B1, S4-B4 |
| Blocks | S4-C1, S4-D3 |

---

## Context

### What We're Building
A thread retrieval API that enables querying threads by various criteria: post, user, status, platform, and time range. Supports pagination, filtering, and sorting for both operators and automated systems.

### Why It Matters
- **Operator Dashboard**: Find threads needing attention
- **Reply Agent**: Get threads requiring responses
- **Analytics**: Query threads for reporting
- **Escalation Queue**: Surface escalated threads
- **Search**: Find specific conversations

### Spec References
- `docs/01-architecture/system-architecture-v3.md` — API design
- `docs/02-schemas/external-memory-schema.md` — Query patterns
- `docs/05-policy-safety/multi-tenant-isolation.md` — Tenant scoping

---

## Prerequisites

### Completed Tasks
- [x] S4-B1: Thread Entity Model
- [x] S4-B4: Thread State Machine

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/engagement/threads/src/__tests__/thread-repository.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ThreadRepository,
  ThreadQuery,
  ThreadQueryResult,
} from '../thread-repository';
import { Thread, ThreadStatus } from '../thread-entity';
import { createMockDatabase } from './__mocks__/database';

describe('ThreadRepository', () => {
  let repository: ThreadRepository;
  let mockDb: ReturnType<typeof createMockDatabase>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    repository = new ThreadRepository({ db: mockDb });
  });

  describe('findById', () => {
    it('should return thread by ID with client isolation', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          {
            id: 'thread_123',
            client_id: 'client_abc',
            platform: 'facebook',
            type: 'comment',
            status: 'open',
          },
        ],
      });

      const thread = await repository.findById('thread_123', 'client_abc');

      expect(thread).toBeDefined();
      expect(thread!.id).toBe('thread_123');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('client_id'),
        expect.arrayContaining(['thread_123', 'client_abc'])
      );
    });

    it('should return null for thread from different client', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const thread = await repository.findById('thread_123', 'client_xyz');

      expect(thread).toBeNull();
    });
  });

  describe('findByPost', () => {
    it('should return all threads for a post', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'thread_1', root_post_id: 'post_123', type: 'comment' },
          { id: 'thread_2', root_post_id: 'post_123', type: 'comment' },
        ],
      });

      const threads = await repository.findByPost('post_123', 'client_abc');

      expect(threads).toHaveLength(2);
    });
  });

  describe('findByParticipant', () => {
    it('should return threads involving a user', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'thread_1', participant_ids: ['user_1', 'brand'] },
          { id: 'thread_2', participant_ids: ['user_1', 'user_2'] },
        ],
      });

      const threads = await repository.findByParticipant(
        'user_1',
        'client_abc'
      );

      expect(threads).toHaveLength(2);
    });
  });

  describe('query', () => {
    it('should filter by status', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'thread_1', status: 'open' },
          { id: 'thread_2', status: 'open' },
        ],
        count: 2,
      });

      const result = await repository.query({
        clientId: 'client_abc',
        status: ['open'],
        limit: 10,
        offset: 0,
      });

      expect(result.threads).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by platform', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'thread_1', platform: 'instagram' }],
        count: 1,
      });

      const result = await repository.query({
        clientId: 'client_abc',
        platform: ['instagram'],
        limit: 10,
        offset: 0,
      });

      expect(result.threads).toHaveLength(1);
      expect(result.threads[0].platform).toBe('instagram');
    });

    it('should filter by thread type', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'thread_1', type: 'dm' }],
        count: 1,
      });

      const result = await repository.query({
        clientId: 'client_abc',
        type: ['dm'],
        limit: 10,
        offset: 0,
      });

      expect(result.threads[0].type).toBe('dm');
    });

    it('should filter by priority', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'thread_1', priority: 'urgent' },
          { id: 'thread_2', priority: 'high' },
        ],
        count: 2,
      });

      const result = await repository.query({
        clientId: 'client_abc',
        priority: ['urgent', 'high'],
        limit: 10,
        offset: 0,
      });

      expect(result.threads).toHaveLength(2);
    });

    it('should filter by date range', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'thread_1', created_at: new Date('2025-01-01') }],
        count: 1,
      });

      const result = await repository.query({
        clientId: 'client_abc',
        createdAfter: new Date('2024-12-01'),
        createdBefore: new Date('2025-02-01'),
        limit: 10,
        offset: 0,
      });

      expect(result.threads).toHaveLength(1);
    });

    it('should support pagination', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'thread_11' }, { id: 'thread_12' }],
        count: 25,
      });

      const result = await repository.query({
        clientId: 'client_abc',
        limit: 10,
        offset: 10,
      });

      expect(result.threads).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(result.hasMore).toBe(true);
    });

    it('should sort by last message', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'thread_1', last_message_at: new Date('2025-01-02') },
          { id: 'thread_2', last_message_at: new Date('2025-01-01') },
        ],
        count: 2,
      });

      const result = await repository.query({
        clientId: 'client_abc',
        sortBy: 'lastMessageAt',
        sortOrder: 'desc',
        limit: 10,
        offset: 0,
      });

      expect(result.threads[0].id).toBe('thread_1');
    });

    it('should search by content', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'thread_1', messages: [{ content: 'refund request' }] }],
        count: 1,
      });

      const result = await repository.query({
        clientId: 'client_abc',
        search: 'refund',
        limit: 10,
        offset: 0,
      });

      expect(result.threads).toHaveLength(1);
    });
  });

  describe('getThreadsNeedingAttention', () => {
    it('should return open threads older than threshold', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'thread_stale', status: 'open', created_at: new Date(Date.now() - 7200000) },
        ],
        count: 1,
      });

      const threads = await repository.getThreadsNeedingAttention(
        'client_abc',
        { staleThresholdMs: 3600000 }
      );

      expect(threads).toHaveLength(1);
    });

    it('should include escalated threads', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'thread_escalated', status: 'escalated' },
          { id: 'thread_stale', status: 'open' },
        ],
        count: 2,
      });

      const threads = await repository.getThreadsNeedingAttention(
        'client_abc',
        { staleThresholdMs: 3600000 }
      );

      expect(threads).toHaveLength(2);
    });
  });

  describe('getThreadStats', () => {
    it('should return thread statistics', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { status: 'open', count: 15 },
          { status: 'handled', count: 45 },
          { status: 'escalated', count: 5 },
        ],
      });

      const stats = await repository.getThreadStats('client_abc');

      expect(stats.byStatus.open).toBe(15);
      expect(stats.byStatus.handled).toBe(45);
      expect(stats.byStatus.escalated).toBe(5);
      expect(stats.total).toBe(65);
    });
  });

  describe('save', () => {
    it('should create new thread', async () => {
      const thread: Thread = {
        id: 'thread_new',
        clientId: 'client_abc',
        platform: 'facebook',
        type: 'comment',
        status: 'open',
        messages: [],
        messageCount: 0,
        participants: [],
        participantCount: 0,
        createdAt: new Date(),
        lastMessageAt: new Date(),
        tags: [],
        priority: 'medium',
        metadata: {},
      };

      mockDb.query.mockResolvedValue({ rows: [{ id: 'thread_new' }] });

      const saved = await repository.save(thread);

      expect(saved.id).toBe('thread_new');
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should update existing thread', async () => {
      const thread: Thread = {
        id: 'thread_existing',
        clientId: 'client_abc',
        platform: 'instagram',
        type: 'dm',
        status: 'handled',
        messages: [],
        messageCount: 5,
        participants: [],
        participantCount: 2,
        createdAt: new Date(),
        lastMessageAt: new Date(),
        handledAt: new Date(),
        tags: ['resolved'],
        priority: 'medium',
        metadata: {},
      };

      mockDb.query.mockResolvedValue({ rows: [thread] });

      const saved = await repository.save(thread);

      expect(saved.status).toBe('handled');
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/engagement/threads/src/thread-repository.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Thread, ThreadStatus, ThreadType } from './thread-entity';
import { Platform } from '@rtv/core';

const tracer = trace.getTracer('thread-repository');

export interface ThreadQuery {
  clientId: string;
  status?: ThreadStatus[];
  platform?: Platform[];
  type?: ThreadType[];
  priority?: Thread['priority'][];
  assignedTo?: string;
  participantId?: string;
  postId?: string;
  tags?: string[];
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  lastMessageAfter?: Date;
  lastMessageBefore?: Date;
  sortBy?: 'createdAt' | 'lastMessageAt' | 'priority' | 'messageCount';
  sortOrder?: 'asc' | 'desc';
  limit: number;
  offset: number;
}

export interface ThreadQueryResult {
  threads: Thread[];
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}

export interface ThreadStats {
  total: number;
  byStatus: Record<ThreadStatus, number>;
  byPlatform: Record<string, number>;
  byType: Record<ThreadType, number>;
  avgResponseTimeMs?: number;
}

export interface DatabaseClient {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[]; count?: number }>;
}

export class ThreadRepository {
  private db: DatabaseClient;

  constructor(config: { db: DatabaseClient }) {
    this.db = config.db;
  }

  async findById(id: string, clientId: string): Promise<Thread | null> {
    return tracer.startActiveSpan('findThreadById', async (span) => {
      span.setAttributes({
        'query.thread_id': id,
        'query.client_id': clientId,
      });

      const result = await this.db.query(
        `SELECT * FROM threads WHERE id = $1 AND client_id = $2`,
        [id, clientId]
      );

      if (result.rows.length === 0) {
        span.end();
        return null;
      }

      const thread = this.rowToThread(result.rows[0]);
      span.end();
      return thread;
    });
  }

  async findByPost(postId: string, clientId: string): Promise<Thread[]> {
    const result = await this.db.query(
      `SELECT * FROM threads WHERE root_post_id = $1 AND client_id = $2 ORDER BY created_at DESC`,
      [postId, clientId]
    );

    return result.rows.map((row) => this.rowToThread(row));
  }

  async findByParticipant(
    participantId: string,
    clientId: string
  ): Promise<Thread[]> {
    const result = await this.db.query(
      `SELECT t.* FROM threads t
       JOIN thread_participants tp ON t.id = tp.thread_id
       WHERE tp.participant_id = $1 AND t.client_id = $2
       ORDER BY t.last_message_at DESC`,
      [participantId, clientId]
    );

    return result.rows.map((row) => this.rowToThread(row));
  }

  async query(query: ThreadQuery): Promise<ThreadQueryResult> {
    return tracer.startActiveSpan('queryThreads', async (span) => {
      span.setAttributes({
        'query.client_id': query.clientId,
        'query.limit': query.limit,
        'query.offset': query.offset,
      });

      const { sql, params } = this.buildQuerySQL(query);

      const result = await this.db.query(sql, params);
      const threads = result.rows.map((row) => this.rowToThread(row));
      const total = result.count || threads.length;

      span.setAttributes({ 'query.result_count': threads.length });
      span.end();

      return {
        threads,
        total,
        hasMore: query.offset + threads.length < total,
        offset: query.offset,
        limit: query.limit,
      };
    });
  }

  private buildQuerySQL(query: ThreadQuery): { sql: string; params: unknown[] } {
    const conditions: string[] = ['client_id = $1'];
    const params: unknown[] = [query.clientId];
    let paramIndex = 2;

    if (query.status?.length) {
      conditions.push(`status = ANY($${paramIndex})`);
      params.push(query.status);
      paramIndex++;
    }

    if (query.platform?.length) {
      conditions.push(`platform = ANY($${paramIndex})`);
      params.push(query.platform);
      paramIndex++;
    }

    if (query.type?.length) {
      conditions.push(`type = ANY($${paramIndex})`);
      params.push(query.type);
      paramIndex++;
    }

    if (query.priority?.length) {
      conditions.push(`priority = ANY($${paramIndex})`);
      params.push(query.priority);
      paramIndex++;
    }

    if (query.assignedTo) {
      conditions.push(`assigned_to = $${paramIndex}`);
      params.push(query.assignedTo);
      paramIndex++;
    }

    if (query.postId) {
      conditions.push(`root_post_id = $${paramIndex}`);
      params.push(query.postId);
      paramIndex++;
    }

    if (query.tags?.length) {
      conditions.push(`tags && $${paramIndex}`);
      params.push(query.tags);
      paramIndex++;
    }

    if (query.search) {
      conditions.push(`search_vector @@ plainto_tsquery($${paramIndex})`);
      params.push(query.search);
      paramIndex++;
    }

    if (query.createdAfter) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(query.createdAfter);
      paramIndex++;
    }

    if (query.createdBefore) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(query.createdBefore);
      paramIndex++;
    }

    if (query.lastMessageAfter) {
      conditions.push(`last_message_at >= $${paramIndex}`);
      params.push(query.lastMessageAfter);
      paramIndex++;
    }

    if (query.lastMessageBefore) {
      conditions.push(`last_message_at <= $${paramIndex}`);
      params.push(query.lastMessageBefore);
      paramIndex++;
    }

    const sortColumn = this.getSortColumn(query.sortBy);
    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const sql = `
      SELECT *, COUNT(*) OVER() as total_count
      FROM threads
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(query.limit, query.offset);

    return { sql, params };
  }

  private getSortColumn(sortBy?: ThreadQuery['sortBy']): string {
    switch (sortBy) {
      case 'lastMessageAt':
        return 'last_message_at';
      case 'priority':
        return 'priority';
      case 'messageCount':
        return 'message_count';
      case 'createdAt':
      default:
        return 'created_at';
    }
  }

  async getThreadsNeedingAttention(
    clientId: string,
    options: { staleThresholdMs: number }
  ): Promise<Thread[]> {
    const staleTime = new Date(Date.now() - options.staleThresholdMs);

    const result = await this.db.query(
      `SELECT * FROM threads
       WHERE client_id = $1
       AND (
         status = 'escalated'
         OR (status = 'open' AND created_at < $2)
         OR (priority IN ('urgent', 'high') AND status IN ('open', 'awaiting_reply'))
       )
       ORDER BY
         CASE priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
         END,
         created_at ASC
       LIMIT 100`,
      [clientId, staleTime]
    );

    return result.rows.map((row) => this.rowToThread(row));
  }

  async getThreadStats(clientId: string): Promise<ThreadStats> {
    const result = await this.db.query(
      `SELECT status, COUNT(*) as count FROM threads WHERE client_id = $1 GROUP BY status`,
      [clientId]
    );

    const byStatus: Record<string, number> = {};
    let total = 0;

    for (const row of result.rows as Array<{ status: string; count: number }>) {
      byStatus[row.status] = Number(row.count);
      total += Number(row.count);
    }

    return {
      total,
      byStatus: byStatus as Record<ThreadStatus, number>,
      byPlatform: {},
      byType: {} as Record<ThreadType, number>,
    };
  }

  async save(thread: Thread): Promise<Thread> {
    return tracer.startActiveSpan('saveThread', async (span) => {
      span.setAttributes({
        'save.thread_id': thread.id,
        'save.client_id': thread.clientId,
      });

      const result = await this.db.query(
        `INSERT INTO threads (
          id, client_id, platform, type, status, platform_thread_id, root_post_id,
          messages, message_count, participants, participant_count,
          created_at, last_message_at, handled_at, escalated_at,
          assigned_to, tags, priority, sentiment, summary, summary_updated_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          messages = EXCLUDED.messages,
          message_count = EXCLUDED.message_count,
          participants = EXCLUDED.participants,
          participant_count = EXCLUDED.participant_count,
          last_message_at = EXCLUDED.last_message_at,
          handled_at = EXCLUDED.handled_at,
          escalated_at = EXCLUDED.escalated_at,
          assigned_to = EXCLUDED.assigned_to,
          tags = EXCLUDED.tags,
          priority = EXCLUDED.priority,
          sentiment = EXCLUDED.sentiment,
          summary = EXCLUDED.summary,
          summary_updated_at = EXCLUDED.summary_updated_at,
          metadata = EXCLUDED.metadata
        RETURNING *`,
        [
          thread.id,
          thread.clientId,
          thread.platform,
          thread.type,
          thread.status,
          thread.platformThreadId,
          thread.rootPostId,
          JSON.stringify(thread.messages),
          thread.messageCount,
          JSON.stringify(thread.participants),
          thread.participantCount,
          thread.createdAt,
          thread.lastMessageAt,
          thread.handledAt,
          thread.escalatedAt,
          thread.assignedTo,
          thread.tags,
          thread.priority,
          thread.sentiment,
          thread.summary,
          thread.summaryUpdatedAt,
          JSON.stringify(thread.metadata),
        ]
      );

      span.end();
      return this.rowToThread(result.rows[0]);
    });
  }

  async delete(id: string, clientId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM threads WHERE id = $1 AND client_id = $2`,
      [id, clientId]
    );
  }

  private rowToThread(row: unknown): Thread {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      clientId: r.client_id as string,
      platform: r.platform as Thread['platform'],
      type: r.type as Thread['type'],
      status: r.status as ThreadStatus,
      platformThreadId: r.platform_thread_id as string | undefined,
      rootPostId: r.root_post_id as string | undefined,
      messages: typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages || [],
      messageCount: Number(r.message_count) || 0,
      participants: typeof r.participants === 'string' ? JSON.parse(r.participants) : r.participants || [],
      participantCount: Number(r.participant_count) || 0,
      createdAt: new Date(r.created_at as string),
      lastMessageAt: new Date(r.last_message_at as string),
      handledAt: r.handled_at ? new Date(r.handled_at as string) : undefined,
      escalatedAt: r.escalated_at ? new Date(r.escalated_at as string) : undefined,
      assignedTo: r.assigned_to as string | undefined,
      tags: (r.tags as string[]) || [],
      priority: (r.priority as Thread['priority']) || 'medium',
      sentiment: r.sentiment as Thread['sentiment'],
      summary: r.summary as string | undefined,
      summaryUpdatedAt: r.summary_updated_at ? new Date(r.summary_updated_at as string) : undefined,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata || {},
    };
  }
}
```

### Phase 3: Verification

```bash
cd packages/engagement/threads && pnpm test
pnpm test:coverage
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/engagement/threads/src/thread-repository.ts` | Repository implementation |
| Create | `packages/engagement/threads/src/__tests__/thread-repository.test.ts` | Tests |
| Modify | `packages/engagement/threads/src/index.ts` | Export repository |

---

## Acceptance Criteria

- [ ] Query threads by ID with tenant isolation
- [ ] Query threads by post, participant, or status
- [ ] Filter by platform, type, priority, tags
- [ ] Filter by date ranges (created, last message)
- [ ] Full-text search on thread content
- [ ] Pagination with offset/limit
- [ ] Sorting by various fields
- [ ] Get threads needing attention (stale, escalated, high priority)
- [ ] Calculate thread statistics per client
- [ ] Save and update threads
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-B5",
  "name": "Thread Retrieval API",
  "description": "Query and retrieve threads by various criteria",
  "status": "pending",
  "priority": "medium",
  "complexity": "medium",
  "sprint": 4,
  "agent": "B",
  "dependencies": ["S4-B1", "S4-B4"],
  "blocks": ["S4-C1", "S4-D3"],
  "estimated_hours": 8,
  "tags": ["engagement", "threads", "repository", "query", "tdd"],
  "package": "@rtv/engagement/threads"
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "next_task_hints": ["S4-C1 for reply agent prompts", "S4-D3 for escalation queue"]
}
```
