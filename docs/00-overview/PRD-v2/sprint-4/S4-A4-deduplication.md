# Build Prompt: S4-A4 — Event Deduplication

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-A4 |
| Sprint | 4 — Engagement |
| Agent | A — Event Ingestion |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1 day |
| Dependencies | S4-A3 |
| Blocks | S4-A5 |

---

## Context

### What We're Building
A deduplication system that prevents the same event from being processed multiple times. Uses Redis-based idempotency keys with TTL to detect duplicates from webhooks (which may retry) and polling (which may overlap).

### Why It Matters
- **Idempotency**: Same event processed once
- **Webhook Retries**: Meta retries failed deliveries
- **Polling Overlap**: Prevent double-processing
- **Cost Efficiency**: Don't waste resources on duplicates
- **Data Integrity**: No duplicate threads or replies

### Spec References
- `docs/01-architecture/system-architecture-v3.md` — Event processing
- `docs/06-reliability-ops/slo-error-budget.md` — Processing guarantees

---

## Prerequisites

### Completed Tasks
- [x] S4-A3: Event Normalization

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/engagement/ingestion/src/__tests__/deduplication.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeduplicationService, createDedupeKey } from '../deduplication';
import { createMockRedis } from './__mocks__/redis';

describe('Deduplication', () => {
  let service: DeduplicationService;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    service = new DeduplicationService({ redis: mockRedis, ttlSeconds: 86400 });
  });

  describe('createDedupeKey', () => {
    it('should create consistent key from event', () => {
      const event = {
        id: 'fb_comment_123',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
      };

      const key1 = createDedupeKey(event);
      const key2 = createDedupeKey(event);

      expect(key1).toBe(key2);
      expect(key1).toContain('client_abc');
      expect(key1).toContain('facebook');
      expect(key1).toContain('fb_comment_123');
    });

    it('should create different keys for different events', () => {
      const event1 = { id: 'evt_1', clientId: 'client_abc', platform: 'facebook' };
      const event2 = { id: 'evt_2', clientId: 'client_abc', platform: 'facebook' };

      expect(createDedupeKey(event1)).not.toBe(createDedupeKey(event2));
    });
  });

  describe('isDuplicate', () => {
    it('should return false for new event', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const isDupe = await service.isDuplicate({
        id: 'new_event_123',
        clientId: 'client_abc',
        platform: 'instagram',
      });

      expect(isDupe).toBe(false);
    });

    it('should return true for existing event', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const isDupe = await service.isDuplicate({
        id: 'existing_event_456',
        clientId: 'client_abc',
        platform: 'tiktok',
      });

      expect(isDupe).toBe(true);
    });
  });

  describe('markAsProcessed', () => {
    it('should store key with TTL', async () => {
      await service.markAsProcessed({
        id: 'evt_789',
        clientId: 'client_xyz',
        platform: 'linkedin',
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('evt_789'),
        86400,
        expect.any(String)
      );
    });
  });

  describe('checkAndMark (atomic)', () => {
    it('should atomically check and mark new event', async () => {
      mockRedis.setnx.mockResolvedValue(1); // Key didn't exist, was set

      const result = await service.checkAndMark({
        id: 'atomic_evt_1',
        clientId: 'client_abc',
        platform: 'x',
      });

      expect(result.isNew).toBe(true);
      expect(result.processed).toBe(true);
    });

    it('should return duplicate for existing event', async () => {
      mockRedis.setnx.mockResolvedValue(0); // Key already existed

      const result = await service.checkAndMark({
        id: 'duplicate_evt',
        clientId: 'client_abc',
        platform: 'youtube',
      });

      expect(result.isNew).toBe(false);
      expect(result.processed).toBe(false);
    });
  });

  describe('bulkCheck', () => {
    it('should check multiple events efficiently', async () => {
      mockRedis.mget.mockResolvedValue([null, '1', null]);

      const events = [
        { id: 'evt_1', clientId: 'client_abc', platform: 'facebook' },
        { id: 'evt_2', clientId: 'client_abc', platform: 'facebook' },
        { id: 'evt_3', clientId: 'client_abc', platform: 'facebook' },
      ];

      const results = await service.bulkCheck(events);

      expect(results.newEvents).toHaveLength(2);
      expect(results.duplicates).toHaveLength(1);
      expect(results.duplicates[0].id).toBe('evt_2');
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/engagement/ingestion/src/deduplication.ts
import { Redis } from 'ioredis';
import crypto from 'crypto';
import { Platform } from '@rtv/core';

interface DeduplicationServiceConfig {
  redis: Redis;
  ttlSeconds?: number;
  keyPrefix?: string;
}

interface EventIdentifier {
  id: string;
  clientId: string;
  platform: Platform | string;
}

export function createDedupeKey(event: EventIdentifier): string {
  return `dedupe:${event.clientId}:${event.platform}:${event.id}`;
}

export class DeduplicationService {
  private redis: Redis;
  private ttlSeconds: number;
  private keyPrefix: string;

  constructor(config: DeduplicationServiceConfig) {
    this.redis = config.redis;
    this.ttlSeconds = config.ttlSeconds || 86400; // 24 hours default
    this.keyPrefix = config.keyPrefix || 'rtv:';
  }

  private getKey(event: EventIdentifier): string {
    return `${this.keyPrefix}${createDedupeKey(event)}`;
  }

  async isDuplicate(event: EventIdentifier): Promise<boolean> {
    const key = this.getKey(event);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async markAsProcessed(event: EventIdentifier): Promise<void> {
    const key = this.getKey(event);
    const value = JSON.stringify({
      processedAt: new Date().toISOString(),
      eventId: event.id,
    });
    await this.redis.setex(key, this.ttlSeconds, value);
  }

  async checkAndMark(
    event: EventIdentifier
  ): Promise<{ isNew: boolean; processed: boolean }> {
    const key = this.getKey(event);
    const value = JSON.stringify({
      processedAt: new Date().toISOString(),
      eventId: event.id,
    });

    // SETNX returns 1 if key was set (new), 0 if key existed (duplicate)
    const result = await this.redis.setnx(key, value);
    const isNew = result === 1;

    if (isNew) {
      // Set TTL on the new key
      await this.redis.expire(key, this.ttlSeconds);
    }

    return { isNew, processed: isNew };
  }

  async bulkCheck(
    events: EventIdentifier[]
  ): Promise<{ newEvents: EventIdentifier[]; duplicates: EventIdentifier[] }> {
    if (events.length === 0) {
      return { newEvents: [], duplicates: [] };
    }

    const keys = events.map((e) => this.getKey(e));
    const results = await this.redis.mget(...keys);

    const newEvents: EventIdentifier[] = [];
    const duplicates: EventIdentifier[] = [];

    results.forEach((value, index) => {
      if (value === null) {
        newEvents.push(events[index]);
      } else {
        duplicates.push(events[index]);
      }
    });

    return { newEvents, duplicates };
  }

  async bulkMarkAsProcessed(events: EventIdentifier[]): Promise<void> {
    if (events.length === 0) return;

    const pipeline = this.redis.pipeline();
    const now = new Date().toISOString();

    for (const event of events) {
      const key = this.getKey(event);
      const value = JSON.stringify({ processedAt: now, eventId: event.id });
      pipeline.setex(key, this.ttlSeconds, value);
    }

    await pipeline.exec();
  }
}
```

### Phase 3: Verification

```bash
cd packages/engagement/ingestion && pnpm test
pnpm test:coverage
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/engagement/ingestion/src/deduplication.ts` | Dedup service |
| Create | `packages/engagement/ingestion/src/__tests__/deduplication.test.ts` | Tests |
| Modify | `packages/engagement/ingestion/src/index.ts` | Export dedup |

---

## Acceptance Criteria

- [ ] Redis-based idempotency keys with TTL
- [ ] Atomic check-and-mark using SETNX
- [ ] Bulk operations for batch processing
- [ ] Configurable TTL (default 24 hours)
- [ ] Client-scoped keys for isolation
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-A4",
  "name": "Event Deduplication",
  "description": "Prevent duplicate event processing using Redis idempotency",
  "status": "pending",
  "priority": "medium",
  "complexity": "medium",
  "sprint": 4,
  "agent": "A",
  "dependencies": ["S4-A3"],
  "blocks": ["S4-A5"],
  "estimated_hours": 8,
  "tags": ["engagement", "deduplication", "redis", "idempotency", "tdd"],
  "package": "@rtv/engagement/ingestion"
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "next_task_hints": ["S4-A5 for event routing"]
}
```
