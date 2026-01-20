# Build Prompt: S4-A3 — Event Normalization

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-A3 |
| Sprint | 4 — Engagement |
| Agent | A — Event Ingestion |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1 day |
| Dependencies | S4-A1, S4-A2 |
| Blocks | S4-A4, S4-A5 |

---

## Context

### What We're Building
An event normalization layer that transforms platform-specific events (from webhooks and polling) into a unified schema. Regardless of source platform, all events conform to a single NormalizedEvent type, enabling consistent downstream processing.

### Why It Matters
- **Consistency**: Same schema for all platforms
- **Simplicity**: Downstream handlers only know one format
- **Extensibility**: Add platforms without changing handlers
- **Validation**: Ensure all events meet schema
- **Observability**: Common metrics across platforms

### Spec References
- `docs/02-schemas/external-memory-schema.md` — NormalizedEvent schema
- `docs/01-architecture/system-architecture-v3.md` — Event flow

---

## Prerequisites

### Completed Tasks
- [x] S4-A1: Webhook Receiver
- [x] S4-A2: Polling System

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/engagement/ingestion/src/__tests__/event-normalizer.test.ts
import { describe, it, expect } from 'vitest';
import {
  normalizeEvent,
  NormalizedEvent,
  validateNormalizedEvent,
} from '../event-normalizer';

describe('Event Normalizer', () => {
  describe('normalizeEvent', () => {
    it('should normalize Facebook comment event', () => {
      const rawEvent = {
        platform: 'facebook',
        eventType: 'comment',
        comment_id: 'fb_comment_123',
        post_id: 'fb_post_456',
        from: { id: 'user_789', name: 'John Doe' },
        message: 'Great post!',
        created_time: 1704067200,
      };

      const normalized = normalizeEvent(rawEvent, 'client_abc');

      expect(normalized.id).toContain('fb_comment_123');
      expect(normalized.clientId).toBe('client_abc');
      expect(normalized.platform).toBe('facebook');
      expect(normalized.eventType).toBe('comment');
      expect(normalized.content).toBe('Great post!');
      expect(normalized.author.displayName).toBe('John Doe');
    });

    it('should normalize Instagram DM event', () => {
      const rawEvent = {
        platform: 'instagram',
        eventType: 'dm',
        mid: 'ig_dm_123',
        sender: { id: 'user_ig_456' },
        text: 'Hello!',
        timestamp: 1704067200000,
      };

      const normalized = normalizeEvent(rawEvent, 'client_abc');

      expect(normalized.eventType).toBe('dm');
      expect(normalized.content).toBe('Hello!');
    });

    it('should normalize TikTok comment from polling', () => {
      const rawEvent = {
        platform: 'tiktok',
        eventType: 'comment',
        id: 'tt_comment_789',
        video_id: 'tt_video_012',
        user: { id: 'tt_user_345', nickname: 'TikToker' },
        text: 'So cool!',
        create_time: 1704067200,
      };

      const normalized = normalizeEvent(rawEvent, 'client_xyz');

      expect(normalized.platform).toBe('tiktok');
      expect(normalized.author.displayName).toBe('TikToker');
    });

    it('should normalize X mention from polling', () => {
      const rawEvent = {
        platform: 'x',
        eventType: 'mention',
        id: 'x_tweet_123',
        author_id: 'x_user_456',
        text: '@brand Check this out',
        created_at: '2025-01-01T00:00:00Z',
      };

      const normalized = normalizeEvent(rawEvent, 'client_xyz');

      expect(normalized.eventType).toBe('mention');
      expect(normalized.content).toContain('@brand');
    });

    it('should include metadata from raw event', () => {
      const rawEvent = {
        platform: 'linkedin',
        eventType: 'comment',
        id: 'li_comment_123',
        post_urn: 'urn:li:share:456',
        actor: { id: 'user_789', name: 'Jane Smith' },
        message: { text: 'Insightful!' },
        created: { time: 1704067200000 },
        likes: { count: 5 },
      };

      const normalized = normalizeEvent(rawEvent, 'client_abc');

      expect(normalized.metadata.likes).toEqual({ count: 5 });
    });
  });

  describe('validateNormalizedEvent', () => {
    it('should accept valid normalized event', () => {
      const event: NormalizedEvent = {
        id: 'evt_123',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        author: { platformId: 'user_123', displayName: 'Test User' },
        content: 'Hello',
        timestamp: new Date(),
        metadata: {},
      };

      expect(validateNormalizedEvent(event)).toBe(true);
    });

    it('should reject event without id', () => {
      const event = {
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        content: 'Hello',
      };

      expect(() => validateNormalizedEvent(event as any)).toThrow('id');
    });

    it('should reject event without clientId', () => {
      const event = {
        id: 'evt_123',
        platform: 'facebook',
        eventType: 'comment',
        content: 'Hello',
      };

      expect(() => validateNormalizedEvent(event as any)).toThrow('clientId');
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/engagement/ingestion/src/event-normalizer.ts
import { z } from 'zod';
import { Platform } from '@rtv/core';

export const NormalizedEventSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  platform: z.enum(['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x', 'skool']),
  eventType: z.enum(['comment', 'dm', 'mention', 'reaction']),
  postId: z.string().optional(),
  threadId: z.string().optional(),
  author: z.object({
    platformId: z.string(),
    displayName: z.string(),
    username: z.string().optional(),
    profileUrl: z.string().optional(),
  }),
  content: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.unknown()).default({}),
  rawPayload: z.record(z.unknown()).optional(),
});

export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;

export function normalizeEvent(rawEvent: any, clientId: string): NormalizedEvent {
  const platform = rawEvent.platform as Platform;

  switch (platform) {
    case 'facebook':
      return normalizeFacebookEvent(rawEvent, clientId);
    case 'instagram':
      return normalizeInstagramEvent(rawEvent, clientId);
    case 'tiktok':
      return normalizeTikTokEvent(rawEvent, clientId);
    case 'youtube':
      return normalizeYouTubeEvent(rawEvent, clientId);
    case 'linkedin':
      return normalizeLinkedInEvent(rawEvent, clientId);
    case 'x':
      return normalizeXEvent(rawEvent, clientId);
    default:
      return normalizeGenericEvent(rawEvent, clientId);
  }
}

function normalizeFacebookEvent(raw: any, clientId: string): NormalizedEvent {
  return {
    id: `fb_${raw.comment_id || raw.mid || raw.id}`,
    clientId,
    platform: 'facebook',
    eventType: raw.eventType || 'comment',
    postId: raw.post_id,
    threadId: raw.thread_id,
    author: {
      platformId: raw.from?.id || raw.sender?.id || 'unknown',
      displayName: raw.from?.name || 'Unknown User',
    },
    content: raw.message || raw.text || '',
    timestamp: parseTimestamp(raw.created_time || raw.timestamp),
    metadata: extractMetadata(raw, ['reaction_type', 'likes', 'shares']),
    rawPayload: raw,
  };
}

function normalizeInstagramEvent(raw: any, clientId: string): NormalizedEvent {
  return {
    id: `ig_${raw.id || raw.mid}`,
    clientId,
    platform: 'instagram',
    eventType: raw.eventType || 'comment',
    postId: raw.media?.id || raw.media_id,
    threadId: raw.sender?.id,
    author: {
      platformId: raw.from?.id || raw.sender?.id || 'unknown',
      displayName: raw.from?.username || raw.sender?.id || 'Unknown',
      username: raw.from?.username,
    },
    content: raw.text || raw.message?.text || '',
    timestamp: parseTimestamp(raw.timestamp),
    metadata: {},
    rawPayload: raw,
  };
}

function normalizeTikTokEvent(raw: any, clientId: string): NormalizedEvent {
  return {
    id: `tt_${raw.id}`,
    clientId,
    platform: 'tiktok',
    eventType: raw.eventType || 'comment',
    postId: raw.video_id,
    author: {
      platformId: raw.user?.id || 'unknown',
      displayName: raw.user?.nickname || raw.user?.unique_id || 'Unknown',
      username: raw.user?.unique_id,
    },
    content: raw.text || '',
    timestamp: parseTimestamp(raw.create_time),
    metadata: extractMetadata(raw, ['likes_count', 'reply_count']),
    rawPayload: raw,
  };
}

function normalizeYouTubeEvent(raw: any, clientId: string): NormalizedEvent {
  return {
    id: `yt_${raw.id}`,
    clientId,
    platform: 'youtube',
    eventType: raw.eventType || 'comment',
    postId: raw.videoId || raw.video_id,
    author: {
      platformId: raw.authorChannelId?.value || raw.author_id || 'unknown',
      displayName: raw.authorDisplayName || 'Unknown',
    },
    content: raw.textDisplay || raw.text || '',
    timestamp: parseTimestamp(raw.publishedAt || raw.published_at),
    metadata: extractMetadata(raw, ['likeCount', 'replyCount']),
    rawPayload: raw,
  };
}

function normalizeLinkedInEvent(raw: any, clientId: string): NormalizedEvent {
  return {
    id: `li_${raw.id}`,
    clientId,
    platform: 'linkedin',
    eventType: raw.eventType || 'comment',
    postId: raw.post_urn || raw.postUrn,
    threadId: raw.conversation_id,
    author: {
      platformId: raw.actor?.id || 'unknown',
      displayName: raw.actor?.name || 'Unknown',
    },
    content: raw.message?.text || raw.text || '',
    timestamp: parseTimestamp(raw.created?.time || raw.createdAt),
    metadata: extractMetadata(raw, ['likes', 'comments']),
    rawPayload: raw,
  };
}

function normalizeXEvent(raw: any, clientId: string): NormalizedEvent {
  return {
    id: `x_${raw.id}`,
    clientId,
    platform: 'x',
    eventType: raw.eventType || 'comment',
    postId: raw.in_reply_to_tweet_id || raw.conversation_id,
    threadId: raw.conversation_id,
    author: {
      platformId: raw.author_id || raw.sender_id || 'unknown',
      displayName: raw.author_id || 'Unknown',
    },
    content: raw.text || '',
    timestamp: parseTimestamp(raw.created_at),
    metadata: extractMetadata(raw, ['public_metrics', 'entities']),
    rawPayload: raw,
  };
}

function normalizeGenericEvent(raw: any, clientId: string): NormalizedEvent {
  return {
    id: `evt_${raw.id || Date.now()}`,
    clientId,
    platform: raw.platform,
    eventType: raw.eventType || 'comment',
    postId: raw.postId || raw.post_id,
    author: {
      platformId: raw.authorId || raw.author_id || 'unknown',
      displayName: raw.authorName || raw.author_name || 'Unknown',
    },
    content: raw.content || raw.text || raw.message || '',
    timestamp: parseTimestamp(raw.timestamp || raw.created_at),
    metadata: {},
    rawPayload: raw,
  };
}

function parseTimestamp(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    return new Date(value < 10000000000 ? value * 1000 : value);
  }
  return new Date(value);
}

function extractMetadata(raw: any, keys: string[]): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const key of keys) {
    if (raw[key] !== undefined) {
      metadata[key] = raw[key];
    }
  }
  return metadata;
}

export function validateNormalizedEvent(event: any): boolean {
  NormalizedEventSchema.parse(event);
  return true;
}
```

### Phase 3: Verification

```bash
cd packages/engagement/ingestion && pnpm test
pnpm test:coverage
pnpm typecheck
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/engagement/ingestion/src/event-normalizer.ts` | Normalization logic |
| Create | `packages/engagement/ingestion/src/__tests__/event-normalizer.test.ts` | Tests |
| Modify | `packages/engagement/ingestion/src/index.ts` | Export normalizer |

---

## Acceptance Criteria

- [ ] Normalize events from all 6 platforms (FB, IG, TT, YT, LI, X)
- [ ] Unified NormalizedEvent schema with Zod validation
- [ ] Platform-specific field mapping
- [ ] Timestamp parsing (Unix seconds, milliseconds, ISO)
- [ ] Metadata extraction for platform-specific fields
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-A3",
  "name": "Event Normalization",
  "description": "Transform platform-specific events into unified schema",
  "status": "pending",
  "priority": "medium",
  "complexity": "medium",
  "sprint": 4,
  "agent": "A",
  "dependencies": ["S4-A1", "S4-A2"],
  "blocks": ["S4-A4", "S4-A5"],
  "estimated_hours": 8,
  "tags": ["engagement", "normalization", "schema", "tdd"],
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
  "next_task_hints": ["S4-A4 for deduplication"]
}
```
