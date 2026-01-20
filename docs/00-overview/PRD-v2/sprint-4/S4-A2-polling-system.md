# Build Prompt: S4-A2 — Polling System

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-A2 |
| Sprint | 4 — Engagement |
| Agent | A — Event Ingestion |
| Complexity | High |
| Status | Pending |
| Estimated Effort | 2 days |
| Dependencies | Sprint 3 Complete |
| Blocks | S4-A3 |

---

## Context

### What We're Building
A polling system for platforms that don't support webhooks (TikTok, LinkedIn, X). The system periodically fetches new comments, mentions, and DMs using platform APIs, tracks polling state to avoid duplicates, and respects rate limits across all client accounts.

### Why It Matters
- **Coverage**: Engagement on non-webhook platforms
- **Rate Compliance**: Stay within API limits
- **Efficiency**: Only fetch new data since last poll
- **Reliability**: Handle failures gracefully
- **Scalability**: Poll many accounts efficiently

### Spec References
- `docs/01-architecture/system-architecture-v3.md` — Event ingestion
- `docs/02-schemas/external-memory-schema.md` — PollingState schema
- `docs/05-policy-safety/compliance-safety-framework.md` — Rate limiting
- `docs/06-reliability-ops/slo-error-budget.md` — Polling SLOs

---

## Prerequisites

### Completed Tasks
- [x] Sprint 3 Complete (Publishing pipeline)
- [x] S3-B3: TikTok connector
- [x] S3-B5: LinkedIn connector
- [x] S3-B6: X (Twitter) connector

### Required Packages
```json
{
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0",
    "@rtv/connectors/api": "workspace:*",
    "@rtv/core": "workspace:*",
    "@rtv/telemetry": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^1.2.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests BEFORE implementation.

#### 1.1 Polling State Tests
```typescript
// packages/engagement/ingestion/src/__tests__/polling-state.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  PollingState,
  PollingStateStore,
  createPollingState,
  updatePollingState,
} from '../polling-state';

describe('PollingState', () => {
  describe('createPollingState', () => {
    it('should create initial polling state', () => {
      const state = createPollingState({
        clientId: 'client_123',
        platform: 'tiktok',
        resourceType: 'comments',
        resourceId: 'video_456',
      });

      expect(state.clientId).toBe('client_123');
      expect(state.platform).toBe('tiktok');
      expect(state.lastPolledAt).toBeNull();
      expect(state.cursor).toBeNull();
      expect(state.consecutiveErrors).toBe(0);
    });
  });

  describe('updatePollingState', () => {
    it('should update state after successful poll', () => {
      const state = createPollingState({
        clientId: 'client_123',
        platform: 'linkedin',
        resourceType: 'comments',
        resourceId: 'post_789',
      });

      const updated = updatePollingState(state, {
        success: true,
        cursor: 'cursor_abc',
        itemsFound: 5,
      });

      expect(updated.lastPolledAt).not.toBeNull();
      expect(updated.cursor).toBe('cursor_abc');
      expect(updated.lastItemCount).toBe(5);
      expect(updated.consecutiveErrors).toBe(0);
    });

    it('should increment error count on failure', () => {
      const state = createPollingState({
        clientId: 'client_123',
        platform: 'x',
        resourceType: 'mentions',
      });

      const updated = updatePollingState(state, {
        success: false,
        error: 'Rate limit exceeded',
      });

      expect(updated.consecutiveErrors).toBe(1);
      expect(updated.lastError).toBe('Rate limit exceeded');
    });

    it('should reset error count on success after failures', () => {
      let state = createPollingState({
        clientId: 'client_123',
        platform: 'tiktok',
        resourceType: 'comments',
      });

      // Simulate 3 failures
      for (let i = 0; i < 3; i++) {
        state = updatePollingState(state, { success: false, error: 'Error' });
      }
      expect(state.consecutiveErrors).toBe(3);

      // Success resets count
      state = updatePollingState(state, { success: true, cursor: null });
      expect(state.consecutiveErrors).toBe(0);
    });
  });
});

describe('PollingStateStore', () => {
  let store: PollingStateStore;

  beforeEach(() => {
    store = new PollingStateStore({ redis: createMockRedis() });
  });

  it('should save and retrieve polling state', async () => {
    const state = createPollingState({
      clientId: 'client_123',
      platform: 'linkedin',
      resourceType: 'comments',
      resourceId: 'post_456',
    });

    await store.save(state);
    const retrieved = await store.get(state.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.clientId).toBe('client_123');
  });

  it('should list states by client and platform', async () => {
    await store.save(
      createPollingState({
        clientId: 'client_123',
        platform: 'tiktok',
        resourceType: 'comments',
        resourceId: 'video_1',
      })
    );
    await store.save(
      createPollingState({
        clientId: 'client_123',
        platform: 'tiktok',
        resourceType: 'comments',
        resourceId: 'video_2',
      })
    );

    const states = await store.listByClientPlatform('client_123', 'tiktok');

    expect(states).toHaveLength(2);
  });

  it('should identify states due for polling', async () => {
    const recentState = createPollingState({
      clientId: 'client_123',
      platform: 'x',
      resourceType: 'mentions',
    });
    recentState.lastPolledAt = new Date();

    const staleState = createPollingState({
      clientId: 'client_456',
      platform: 'x',
      resourceType: 'mentions',
    });
    staleState.lastPolledAt = new Date(Date.now() - 600000); // 10 minutes ago

    await store.save(recentState);
    await store.save(staleState);

    const dueStates = await store.getDueForPolling({
      platform: 'x',
      intervalMs: 300000, // 5 minutes
    });

    expect(dueStates.some((s) => s.id === staleState.id)).toBe(true);
    expect(dueStates.some((s) => s.id === recentState.id)).toBe(false);
  });
});
```

#### 1.2 Platform Poller Tests
```typescript
// packages/engagement/ingestion/src/__tests__/platform-pollers.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TikTokPoller,
  LinkedInPoller,
  XPoller,
} from '../platform-pollers';
import { createMockConnector } from './__mocks__/connectors';

describe('Platform Pollers', () => {
  describe('TikTokPoller', () => {
    let poller: TikTokPoller;
    let mockConnector: ReturnType<typeof createMockConnector>;

    beforeEach(() => {
      mockConnector = createMockConnector('tiktok');
      poller = new TikTokPoller(mockConnector);
    });

    it('should fetch video comments', async () => {
      mockConnector.getVideoComments.mockResolvedValue({
        comments: [
          { id: 'c1', text: 'Great video!', create_time: 1704067200 },
          { id: 'c2', text: 'Love it', create_time: 1704067201 },
        ],
        cursor: 'next_cursor_123',
        has_more: true,
      });

      const result = await poller.pollComments({
        videoId: 'video_123',
        cursor: null,
      });

      expect(result.events).toHaveLength(2);
      expect(result.events[0].eventType).toBe('comment');
      expect(result.nextCursor).toBe('next_cursor_123');
      expect(result.hasMore).toBe(true);
    });

    it('should continue from cursor', async () => {
      mockConnector.getVideoComments.mockResolvedValue({
        comments: [{ id: 'c3', text: 'Nice', create_time: 1704067202 }],
        cursor: null,
        has_more: false,
      });

      const result = await poller.pollComments({
        videoId: 'video_123',
        cursor: 'previous_cursor',
      });

      expect(mockConnector.getVideoComments).toHaveBeenCalledWith(
        'video_123',
        expect.objectContaining({ cursor: 'previous_cursor' })
      );
      expect(result.hasMore).toBe(false);
    });

    it('should handle rate limit errors', async () => {
      mockConnector.getVideoComments.mockRejectedValue({
        code: 'rate_limit_exceeded',
        message: 'Too many requests',
      });

      await expect(
        poller.pollComments({ videoId: 'video_123', cursor: null })
      ).rejects.toThrow('rate_limit_exceeded');
    });
  });

  describe('LinkedInPoller', () => {
    let poller: LinkedInPoller;
    let mockConnector: ReturnType<typeof createMockConnector>;

    beforeEach(() => {
      mockConnector = createMockConnector('linkedin');
      poller = new LinkedInPoller(mockConnector);
    });

    it('should fetch post comments', async () => {
      mockConnector.getPostComments.mockResolvedValue({
        elements: [
          {
            id: 'comment_li_1',
            message: { text: 'Insightful post!' },
            actor: { id: 'user_li_1', name: 'Jane Doe' },
            created: { time: 1704067200000 },
          },
        ],
        paging: { start: 10, count: 10, total: 15 },
      });

      const result = await poller.pollComments({
        postUrn: 'urn:li:share:123456789',
        start: 0,
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].content).toBe('Insightful post!');
      expect(result.nextStart).toBe(10);
    });

    it('should fetch inbox messages', async () => {
      mockConnector.getConversations.mockResolvedValue({
        elements: [
          {
            id: 'conv_1',
            lastActivityAt: 1704067200000,
            participants: [{ id: 'user_li_2' }],
            lastMessage: { text: 'Hello!' },
          },
        ],
      });

      const result = await poller.pollInbox({ sinceTim: null });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('dm');
    });
  });

  describe('XPoller', () => {
    let poller: XPoller;
    let mockConnector: ReturnType<typeof createMockConnector>;

    beforeEach(() => {
      mockConnector = createMockConnector('x');
      poller = new XPoller(mockConnector);
    });

    it('should fetch mentions', async () => {
      mockConnector.getMentions.mockResolvedValue({
        data: [
          {
            id: 'tweet_1',
            text: '@brand Check this out!',
            author_id: 'user_x_1',
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
        meta: { next_token: 'next_token_123' },
      });

      const result = await poller.pollMentions({
        userId: 'brand_user_id',
        sinceId: null,
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('mention');
      expect(result.nextToken).toBe('next_token_123');
    });

    it('should fetch tweet replies', async () => {
      mockConnector.getTweetReplies.mockResolvedValue({
        data: [
          {
            id: 'reply_1',
            text: 'Great thread!',
            author_id: 'user_x_2',
            created_at: '2025-01-01T00:01:00Z',
          },
        ],
        meta: { result_count: 1 },
      });

      const result = await poller.pollReplies({
        tweetId: 'tweet_original',
        sinceId: null,
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('comment');
    });

    it('should fetch DMs', async () => {
      mockConnector.getDirectMessages.mockResolvedValue({
        data: [
          {
            id: 'dm_1',
            text: 'Private message',
            sender_id: 'user_x_3',
            created_at: '2025-01-01T00:02:00Z',
          },
        ],
      });

      const result = await poller.pollDMs({
        sinceId: null,
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('dm');
    });
  });
});
```

#### 1.3 Polling Scheduler Tests
```typescript
// packages/engagement/ingestion/src/__tests__/polling-scheduler.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PollingScheduler } from '../polling-scheduler';
import { createMockPollingStateStore } from './__mocks__/polling-state-store';
import { createMockQueue } from './__mocks__/queue';

describe('PollingScheduler', () => {
  let scheduler: PollingScheduler;
  let mockStateStore: ReturnType<typeof createMockPollingStateStore>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    mockStateStore = createMockPollingStateStore();
    mockQueue = createMockQueue();
    scheduler = new PollingScheduler({
      stateStore: mockStateStore,
      queue: mockQueue,
      intervals: {
        tiktok: { comments: 300000 }, // 5 min
        linkedin: { comments: 600000, inbox: 300000 },
        x: { mentions: 60000, replies: 300000, dms: 300000 },
      },
    });
  });

  describe('scheduleDuePollJobs', () => {
    it('should queue jobs for due polling states', async () => {
      mockStateStore.getDueForPolling.mockResolvedValue([
        {
          id: 'state_1',
          clientId: 'client_123',
          platform: 'tiktok',
          resourceType: 'comments',
          resourceId: 'video_456',
        },
        {
          id: 'state_2',
          clientId: 'client_789',
          platform: 'tiktok',
          resourceType: 'comments',
          resourceId: 'video_012',
        },
      ]);

      await scheduler.scheduleDuePollJobs('tiktok');

      expect(mockQueue.addBulk).toHaveBeenCalled();
      const addedJobs = mockQueue.addBulk.mock.calls[0][0];
      expect(addedJobs).toHaveLength(2);
    });

    it('should respect rate limits per platform', async () => {
      mockStateStore.getDueForPolling.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({
          id: `state_${i}`,
          clientId: `client_${i}`,
          platform: 'x',
          resourceType: 'mentions',
        }))
      );

      await scheduler.scheduleDuePollJobs('x');

      // X has strict rate limits, should batch appropriately
      const addedJobs = mockQueue.addBulk.mock.calls[0][0];
      expect(addedJobs.length).toBeLessThanOrEqual(50); // Example limit
    });

    it('should skip states with too many errors', async () => {
      mockStateStore.getDueForPolling.mockResolvedValue([
        {
          id: 'state_healthy',
          clientId: 'client_1',
          platform: 'linkedin',
          consecutiveErrors: 0,
        },
        {
          id: 'state_unhealthy',
          clientId: 'client_2',
          platform: 'linkedin',
          consecutiveErrors: 10, // Too many errors
        },
      ]);

      await scheduler.scheduleDuePollJobs('linkedin');

      const addedJobs = mockQueue.addBulk.mock.calls[0][0];
      expect(addedJobs).toHaveLength(1);
      expect(addedJobs[0].data.stateId).toBe('state_healthy');
    });
  });

  describe('registerPollableResource', () => {
    it('should create polling state for new resource', async () => {
      await scheduler.registerPollableResource({
        clientId: 'client_123',
        platform: 'tiktok',
        resourceType: 'comments',
        resourceId: 'video_new_789',
      });

      expect(mockStateStore.save).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client_123',
          platform: 'tiktok',
          resourceId: 'video_new_789',
        })
      );
    });

    it('should not duplicate existing resources', async () => {
      mockStateStore.exists.mockResolvedValue(true);

      await scheduler.registerPollableResource({
        clientId: 'client_123',
        platform: 'linkedin',
        resourceType: 'comments',
        resourceId: 'post_existing',
      });

      expect(mockStateStore.save).not.toHaveBeenCalled();
    });
  });

  describe('unregisterPollableResource', () => {
    it('should remove polling state for resource', async () => {
      await scheduler.unregisterPollableResource({
        clientId: 'client_123',
        platform: 'x',
        resourceType: 'replies',
        resourceId: 'tweet_old',
      });

      expect(mockStateStore.delete).toHaveBeenCalled();
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Create Polling State
```typescript
// packages/engagement/ingestion/src/polling-state.ts
import crypto from 'crypto';
import { Redis } from 'ioredis';
import { Platform } from '@rtv/core';

export type PollingResourceType = 'comments' | 'mentions' | 'replies' | 'inbox' | 'dms';

export interface PollingState {
  id: string;
  clientId: string;
  platform: Platform;
  resourceType: PollingResourceType;
  resourceId?: string;
  cursor: string | null;
  lastPolledAt: Date | null;
  lastItemCount: number;
  consecutiveErrors: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CreatePollingStateParams {
  clientId: string;
  platform: Platform;
  resourceType: PollingResourceType;
  resourceId?: string;
}

export function createPollingState(params: CreatePollingStateParams): PollingState {
  const id = `poll_${params.platform}_${params.resourceType}_${params.resourceId || 'global'}_${crypto.randomUUID().slice(0, 8)}`;

  return {
    id,
    clientId: params.clientId,
    platform: params.platform,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    cursor: null,
    lastPolledAt: null,
    lastItemCount: 0,
    consecutiveErrors: 0,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

interface UpdatePollingStateParams {
  success: boolean;
  cursor?: string | null;
  itemsFound?: number;
  error?: string;
}

export function updatePollingState(
  state: PollingState,
  params: UpdatePollingStateParams
): PollingState {
  if (params.success) {
    return {
      ...state,
      cursor: params.cursor ?? state.cursor,
      lastPolledAt: new Date(),
      lastItemCount: params.itemsFound ?? 0,
      consecutiveErrors: 0,
      lastError: null,
      updatedAt: new Date(),
    };
  }

  return {
    ...state,
    consecutiveErrors: state.consecutiveErrors + 1,
    lastError: params.error || 'Unknown error',
    updatedAt: new Date(),
  };
}

interface PollingStateStoreConfig {
  redis: Redis;
  keyPrefix?: string;
}

export class PollingStateStore {
  private redis: Redis;
  private keyPrefix: string;

  constructor(config: PollingStateStoreConfig) {
    this.redis = config.redis;
    this.keyPrefix = config.keyPrefix || 'rtv:polling:';
  }

  private getKey(id: string): string {
    return `${this.keyPrefix}state:${id}`;
  }

  private getIndexKey(clientId: string, platform: Platform): string {
    return `${this.keyPrefix}index:${clientId}:${platform}`;
  }

  async save(state: PollingState): Promise<void> {
    const key = this.getKey(state.id);
    const indexKey = this.getIndexKey(state.clientId, state.platform);

    await this.redis
      .multi()
      .set(key, JSON.stringify(state))
      .sadd(indexKey, state.id)
      .exec();
  }

  async get(id: string): Promise<PollingState | null> {
    const data = await this.redis.get(this.getKey(id));
    if (!data) return null;

    const state = JSON.parse(data);
    state.lastPolledAt = state.lastPolledAt ? new Date(state.lastPolledAt) : null;
    state.createdAt = new Date(state.createdAt);
    state.updatedAt = new Date(state.updatedAt);

    return state;
  }

  async exists(
    clientId: string,
    platform: Platform,
    resourceType: PollingResourceType,
    resourceId?: string
  ): Promise<boolean> {
    const states = await this.listByClientPlatform(clientId, platform);
    return states.some(
      (s) =>
        s.resourceType === resourceType &&
        s.resourceId === resourceId
    );
  }

  async listByClientPlatform(
    clientId: string,
    platform: Platform
  ): Promise<PollingState[]> {
    const indexKey = this.getIndexKey(clientId, platform);
    const ids = await this.redis.smembers(indexKey);

    const states: PollingState[] = [];
    for (const id of ids) {
      const state = await this.get(id);
      if (state) states.push(state);
    }

    return states;
  }

  async getDueForPolling(params: {
    platform: Platform;
    intervalMs: number;
    maxErrors?: number;
  }): Promise<PollingState[]> {
    // In production, use Redis SCAN with pattern matching
    // This is simplified for the example
    const allKeys = await this.redis.keys(`${this.keyPrefix}state:poll_${params.platform}_*`);
    const dueStates: PollingState[] = [];
    const now = Date.now();
    const maxErrors = params.maxErrors ?? 5;

    for (const key of allKeys) {
      const state = await this.get(key.replace(`${this.keyPrefix}state:`, ''));
      if (!state) continue;

      if (state.consecutiveErrors >= maxErrors) continue;

      if (
        !state.lastPolledAt ||
        now - state.lastPolledAt.getTime() >= params.intervalMs
      ) {
        dueStates.push(state);
      }
    }

    return dueStates;
  }

  async delete(id: string): Promise<void> {
    const state = await this.get(id);
    if (!state) return;

    const key = this.getKey(id);
    const indexKey = this.getIndexKey(state.clientId, state.platform);

    await this.redis.multi().del(key).srem(indexKey, id).exec();
  }
}
```

#### 2.2 Create Platform Pollers
```typescript
// packages/engagement/ingestion/src/platform-pollers.ts
import { Platform } from '@rtv/core';

export interface PollResult {
  events: PollEvent[];
  nextCursor?: string | null;
  nextToken?: string | null;
  nextStart?: number;
  hasMore: boolean;
}

export interface PollEvent {
  id: string;
  platform: Platform;
  eventType: 'comment' | 'dm' | 'mention' | 'reaction';
  postId?: string;
  threadId?: string;
  author: {
    platformId: string;
    displayName: string;
    username?: string;
  };
  content: string;
  timestamp: Date;
  rawPayload: Record<string, unknown>;
}

export class TikTokPoller {
  constructor(private connector: any) {}

  async pollComments(params: {
    videoId: string;
    cursor: string | null;
  }): Promise<PollResult> {
    const response = await this.connector.getVideoComments(params.videoId, {
      cursor: params.cursor,
      max_count: 50,
    });

    const events: PollEvent[] = response.comments.map((comment: any) => ({
      id: comment.id,
      platform: 'tiktok' as Platform,
      eventType: 'comment',
      postId: params.videoId,
      author: {
        platformId: comment.user?.id || 'unknown',
        displayName: comment.user?.nickname || comment.user?.unique_id || 'Unknown',
        username: comment.user?.unique_id,
      },
      content: comment.text,
      timestamp: new Date(comment.create_time * 1000),
      rawPayload: comment,
    }));

    return {
      events,
      nextCursor: response.cursor,
      hasMore: response.has_more,
    };
  }
}

export class LinkedInPoller {
  constructor(private connector: any) {}

  async pollComments(params: {
    postUrn: string;
    start: number;
  }): Promise<PollResult> {
    const response = await this.connector.getPostComments(params.postUrn, {
      start: params.start,
      count: 50,
    });

    const events: PollEvent[] = response.elements.map((comment: any) => ({
      id: comment.id,
      platform: 'linkedin' as Platform,
      eventType: 'comment',
      postId: params.postUrn,
      author: {
        platformId: comment.actor?.id || 'unknown',
        displayName: comment.actor?.name || 'Unknown',
      },
      content: comment.message?.text || '',
      timestamp: new Date(comment.created?.time || Date.now()),
      rawPayload: comment,
    }));

    const hasMore =
      response.paging &&
      response.paging.start + response.paging.count < response.paging.total;

    return {
      events,
      nextStart: response.paging?.start + response.paging?.count,
      hasMore,
    };
  }

  async pollInbox(params: { sinceTime: number | null }): Promise<PollResult> {
    const response = await this.connector.getConversations({
      createdAfter: params.sinceTime,
    });

    const events: PollEvent[] = response.elements.map((conv: any) => ({
      id: conv.id,
      platform: 'linkedin' as Platform,
      eventType: 'dm',
      threadId: conv.id,
      author: {
        platformId: conv.participants?.[0]?.id || 'unknown',
        displayName: conv.participants?.[0]?.name || 'Unknown',
      },
      content: conv.lastMessage?.text || '',
      timestamp: new Date(conv.lastActivityAt),
      rawPayload: conv,
    }));

    return {
      events,
      hasMore: false,
    };
  }
}

export class XPoller {
  constructor(private connector: any) {}

  async pollMentions(params: {
    userId: string;
    sinceId: string | null;
  }): Promise<PollResult> {
    const response = await this.connector.getMentions(params.userId, {
      since_id: params.sinceId,
      max_results: 100,
    });

    const events: PollEvent[] = (response.data || []).map((tweet: any) => ({
      id: tweet.id,
      platform: 'x' as Platform,
      eventType: 'mention',
      author: {
        platformId: tweet.author_id,
        displayName: tweet.author_id, // Would need user lookup
      },
      content: tweet.text,
      timestamp: new Date(tweet.created_at),
      rawPayload: tweet,
    }));

    return {
      events,
      nextToken: response.meta?.next_token,
      hasMore: !!response.meta?.next_token,
    };
  }

  async pollReplies(params: {
    tweetId: string;
    sinceId: string | null;
  }): Promise<PollResult> {
    const response = await this.connector.getTweetReplies(params.tweetId, {
      since_id: params.sinceId,
    });

    const events: PollEvent[] = (response.data || []).map((reply: any) => ({
      id: reply.id,
      platform: 'x' as Platform,
      eventType: 'comment',
      postId: params.tweetId,
      author: {
        platformId: reply.author_id,
        displayName: reply.author_id,
      },
      content: reply.text,
      timestamp: new Date(reply.created_at),
      rawPayload: reply,
    }));

    return {
      events,
      hasMore: false,
    };
  }

  async pollDMs(params: { sinceId: string | null }): Promise<PollResult> {
    const response = await this.connector.getDirectMessages({
      since_id: params.sinceId,
    });

    const events: PollEvent[] = (response.data || []).map((dm: any) => ({
      id: dm.id,
      platform: 'x' as Platform,
      eventType: 'dm',
      threadId: dm.conversation_id,
      author: {
        platformId: dm.sender_id,
        displayName: dm.sender_id,
      },
      content: dm.text,
      timestamp: new Date(dm.created_at),
      rawPayload: dm,
    }));

    return {
      events,
      hasMore: false,
    };
  }
}
```

#### 2.3 Create Polling Scheduler
```typescript
// packages/engagement/ingestion/src/polling-scheduler.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Queue } from 'bullmq';
import {
  PollingState,
  PollingStateStore,
  createPollingState,
  PollingResourceType,
} from './polling-state';
import { Platform } from '@rtv/core';

const tracer = trace.getTracer('polling-scheduler');

interface PollingIntervals {
  [platform: string]: {
    [resourceType: string]: number;
  };
}

interface PollingSchedulerConfig {
  stateStore: PollingStateStore;
  queue: Queue;
  intervals: PollingIntervals;
  maxErrorThreshold?: number;
  batchLimits?: Record<Platform, number>;
}

export class PollingScheduler {
  private stateStore: PollingStateStore;
  private queue: Queue;
  private intervals: PollingIntervals;
  private maxErrorThreshold: number;
  private batchLimits: Record<Platform, number>;

  constructor(config: PollingSchedulerConfig) {
    this.stateStore = config.stateStore;
    this.queue = config.queue;
    this.intervals = config.intervals;
    this.maxErrorThreshold = config.maxErrorThreshold ?? 5;
    this.batchLimits = config.batchLimits ?? {
      tiktok: 100,
      linkedin: 50,
      x: 50,
    };
  }

  async scheduleDuePollJobs(platform: Platform): Promise<number> {
    return tracer.startActiveSpan('scheduleDuePollJobs', async (span) => {
      span.setAttributes({ 'polling.platform': platform });

      const platformIntervals = this.intervals[platform] || {};
      const allDueStates: PollingState[] = [];

      for (const [resourceType, intervalMs] of Object.entries(platformIntervals)) {
        const dueStates = await this.stateStore.getDueForPolling({
          platform,
          intervalMs,
          maxErrors: this.maxErrorThreshold,
        });

        // Filter by resource type
        const filtered = dueStates.filter((s) => s.resourceType === resourceType);
        allDueStates.push(...filtered);
      }

      // Respect batch limits
      const batchLimit = this.batchLimits[platform] || 100;
      const statesToSchedule = allDueStates.slice(0, batchLimit);

      if (statesToSchedule.length === 0) {
        span.setAttributes({ 'polling.jobs_scheduled': 0 });
        span.end();
        return 0;
      }

      const jobs = statesToSchedule.map((state) => ({
        name: 'poll-resource',
        data: {
          stateId: state.id,
          clientId: state.clientId,
          platform: state.platform,
          resourceType: state.resourceType,
          resourceId: state.resourceId,
          cursor: state.cursor,
        },
      }));

      await this.queue.addBulk(jobs);

      span.setAttributes({ 'polling.jobs_scheduled': jobs.length });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return jobs.length;
    });
  }

  async registerPollableResource(params: {
    clientId: string;
    platform: Platform;
    resourceType: PollingResourceType;
    resourceId?: string;
  }): Promise<PollingState | null> {
    const exists = await this.stateStore.exists(
      params.clientId,
      params.platform,
      params.resourceType,
      params.resourceId
    );

    if (exists) {
      return null;
    }

    const state = createPollingState(params);
    await this.stateStore.save(state);

    return state;
  }

  async unregisterPollableResource(params: {
    clientId: string;
    platform: Platform;
    resourceType: PollingResourceType;
    resourceId?: string;
  }): Promise<void> {
    const states = await this.stateStore.listByClientPlatform(
      params.clientId,
      params.platform
    );

    const state = states.find(
      (s) =>
        s.resourceType === params.resourceType &&
        s.resourceId === params.resourceId
    );

    if (state) {
      await this.stateStore.delete(state.id);
    }
  }
}
```

### Phase 3: Verification

```bash
# Run tests
cd packages/engagement/ingestion && pnpm test

# Run with coverage
pnpm test:coverage

# Verify types
pnpm typecheck

# Lint
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/engagement/ingestion/src/polling-state.ts` | Polling state management |
| Create | `packages/engagement/ingestion/src/platform-pollers.ts` | Platform-specific pollers |
| Create | `packages/engagement/ingestion/src/polling-scheduler.ts` | Scheduler for polling jobs |
| Create | `packages/engagement/ingestion/src/__tests__/polling-*.test.ts` | Tests |
| Modify | `packages/engagement/ingestion/src/index.ts` | Export polling module |

---

## Acceptance Criteria

- [ ] TikTok comment polling with cursor pagination
- [ ] LinkedIn comment and inbox polling
- [ ] X mentions, replies, and DM polling
- [ ] Polling state persistence in Redis
- [ ] Automatic scheduling of due polls
- [ ] Error tracking with backoff
- [ ] Batch limits per platform
- [ ] Unit tests achieve 90%+ coverage

---

## Test Requirements

### Unit Tests
- Polling state CRUD operations
- Each platform poller
- Scheduler job creation
- Error threshold handling

### Integration Tests
- Full polling cycle with mocked APIs
- State persistence and recovery

---

## Security & Safety Checklist

- [ ] No secrets in polling state
- [ ] Client isolation in state store
- [ ] Rate limits enforced per platform
- [ ] Error backoff prevents API abuse
- [ ] Cursor/token validation

---

## JSON Task Block

```json
{
  "task_id": "S4-A2",
  "name": "Polling System",
  "description": "Periodic polling for TikTok, LinkedIn, and X engagement",
  "status": "pending",
  "priority": "high",
  "complexity": "high",
  "sprint": 4,
  "agent": "A",
  "dependencies": ["S3-complete", "S3-B3", "S3-B5", "S3-B6"],
  "blocks": ["S4-A3"],
  "estimated_hours": 16,
  "actual_hours": null,
  "tags": ["engagement", "polling", "tiktok", "linkedin", "x", "tdd"],
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
  "key_decisions": [],
  "patterns_discovered": [],
  "polling_resources_registered": 0,
  "next_task_hints": ["S4-A3 for event normalization"]
}
```
