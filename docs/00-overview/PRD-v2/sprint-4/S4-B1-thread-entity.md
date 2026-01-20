# Build Prompt: S4-B1 — Thread Entity Model

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-B1 |
| Sprint | 4 — Engagement |
| Agent | B — Conversation Thread Model |
| Complexity | High |
| Status | Pending |
| Estimated Effort | 1.5 days |
| Dependencies | S4-A5 |
| Blocks | S4-B2, S4-B3, S4-B4, S4-B5, S4-C4, S4-C5 |

---

## Context

### What We're Building
A unified thread entity model that represents conversations across all platforms. Threads aggregate related messages (comments on a post, DM conversations, mention threads) into a single entity with consistent structure for downstream processing.

### Why It Matters
- **Unified View**: Same data model regardless of platform
- **Context Preservation**: Full conversation history for reply generation
- **State Tracking**: Know where each conversation stands
- **Audit Trail**: Complete record of all interactions
- **Scalability**: Efficient storage and retrieval patterns

### Spec References
- `docs/02-schemas/external-memory-schema.md` — Thread schema
- `docs/01-architecture/system-architecture-v3.md` — Data model
- `docs/03-agents-tools/agent-recursion-contracts.md` — Agent contracts

---

## Prerequisites

### Completed Tasks
- [x] S4-A5: Event Routing

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/engagement/threads/src/__tests__/thread-entity.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  Thread,
  ThreadMessage,
  ThreadType,
  createThread,
  addMessageToThread,
  getThreadParticipants,
} from '../thread-entity';

describe('Thread Entity', () => {
  describe('createThread', () => {
    it('should create comment thread from normalized event', () => {
      const event = {
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        postId: 'fb_post_123',
        author: { platformId: 'user_1', displayName: 'John Doe' },
        content: 'Great post!',
        timestamp: new Date('2025-01-01T12:00:00Z'),
      };

      const thread = createThread(event);

      expect(thread.id).toBeDefined();
      expect(thread.clientId).toBe('client_abc');
      expect(thread.platform).toBe('facebook');
      expect(thread.type).toBe('comment');
      expect(thread.rootPostId).toBe('fb_post_123');
      expect(thread.messages).toHaveLength(1);
      expect(thread.participantCount).toBe(1);
    });

    it('should create DM thread from normalized event', () => {
      const event = {
        id: 'evt_2',
        clientId: 'client_abc',
        platform: 'instagram',
        eventType: 'dm',
        threadId: 'ig_thread_456',
        author: { platformId: 'user_2', displayName: 'Jane Smith' },
        content: 'Hello!',
        timestamp: new Date('2025-01-01T12:00:00Z'),
      };

      const thread = createThread(event);

      expect(thread.type).toBe('dm');
      expect(thread.platformThreadId).toBe('ig_thread_456');
    });

    it('should create mention thread from normalized event', () => {
      const event = {
        id: 'evt_3',
        clientId: 'client_xyz',
        platform: 'x',
        eventType: 'mention',
        postId: 'x_tweet_789',
        author: { platformId: 'user_3', displayName: 'Bob' },
        content: '@brand Check this out',
        timestamp: new Date('2025-01-01T12:00:00Z'),
      };

      const thread = createThread(event);

      expect(thread.type).toBe('mention');
      expect(thread.rootPostId).toBe('x_tweet_789');
    });
  });

  describe('addMessageToThread', () => {
    it('should add message to existing thread', () => {
      const thread = createThread({
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        postId: 'fb_post_123',
        author: { platformId: 'user_1', displayName: 'John' },
        content: 'First message',
        timestamp: new Date('2025-01-01T12:00:00Z'),
      });

      const newEvent = {
        id: 'evt_2',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        postId: 'fb_post_123',
        parentId: 'evt_1',
        author: { platformId: 'user_2', displayName: 'Jane' },
        content: 'Reply message',
        timestamp: new Date('2025-01-01T12:01:00Z'),
      };

      const updatedThread = addMessageToThread(thread, newEvent);

      expect(updatedThread.messages).toHaveLength(2);
      expect(updatedThread.participantCount).toBe(2);
      expect(updatedThread.lastMessageAt.getTime()).toBeGreaterThan(
        thread.lastMessageAt.getTime()
      );
    });

    it('should update message count correctly', () => {
      let thread = createThread({
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'instagram',
        eventType: 'dm',
        threadId: 'ig_thread_1',
        author: { platformId: 'user_1', displayName: 'User 1' },
        content: 'Hi',
        timestamp: new Date(),
      });

      for (let i = 2; i <= 5; i++) {
        thread = addMessageToThread(thread, {
          id: `evt_${i}`,
          clientId: 'client_abc',
          platform: 'instagram',
          eventType: 'dm',
          threadId: 'ig_thread_1',
          author: { platformId: `user_${i % 2 + 1}`, displayName: `User ${i}` },
          content: `Message ${i}`,
          timestamp: new Date(),
        });
      }

      expect(thread.messageCount).toBe(5);
    });
  });

  describe('getThreadParticipants', () => {
    it('should return unique participants', () => {
      let thread = createThread({
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        postId: 'fb_post_1',
        author: { platformId: 'user_1', displayName: 'Alice' },
        content: 'Hello',
        timestamp: new Date(),
      });

      thread = addMessageToThread(thread, {
        id: 'evt_2',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        postId: 'fb_post_1',
        author: { platformId: 'user_2', displayName: 'Bob' },
        content: 'Hi Alice',
        timestamp: new Date(),
      });

      thread = addMessageToThread(thread, {
        id: 'evt_3',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        postId: 'fb_post_1',
        author: { platformId: 'user_1', displayName: 'Alice' },
        content: 'How are you?',
        timestamp: new Date(),
      });

      const participants = getThreadParticipants(thread);

      expect(participants).toHaveLength(2);
      expect(participants.map((p) => p.platformId)).toContain('user_1');
      expect(participants.map((p) => p.platformId)).toContain('user_2');
    });
  });

  describe('ThreadMessage', () => {
    it('should include all required fields', () => {
      const message: ThreadMessage = {
        id: 'msg_1',
        threadId: 'thread_1',
        platformMessageId: 'fb_msg_123',
        author: {
          platformId: 'user_1',
          displayName: 'Test User',
          username: 'testuser',
        },
        content: 'Test message',
        direction: 'inbound',
        timestamp: new Date(),
        metadata: {},
      };

      expect(message.direction).toBe('inbound');
      expect(message.author.platformId).toBe('user_1');
    });

    it('should track outbound messages', () => {
      const message: ThreadMessage = {
        id: 'msg_2',
        threadId: 'thread_1',
        platformMessageId: 'fb_msg_456',
        author: {
          platformId: 'brand_account',
          displayName: 'Brand',
        },
        content: 'Thanks for reaching out!',
        direction: 'outbound',
        timestamp: new Date(),
        metadata: { approvedBy: 'operator_1', approvedAt: new Date() },
      };

      expect(message.direction).toBe('outbound');
      expect(message.metadata.approvedBy).toBe('operator_1');
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/engagement/threads/src/thread-entity.ts
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { NormalizedEvent } from '@rtv/engagement/ingestion';
import { Platform } from '@rtv/core';

export type ThreadType = 'comment' | 'dm' | 'mention';
export type ThreadStatus = 'open' | 'handled' | 'escalated' | 'archived';
export type MessageDirection = 'inbound' | 'outbound';

export const ThreadParticipantSchema = z.object({
  platformId: z.string(),
  displayName: z.string(),
  username: z.string().optional(),
  profileUrl: z.string().optional(),
  isVerified: z.boolean().optional(),
  followerCount: z.number().optional(),
});

export type ThreadParticipant = z.infer<typeof ThreadParticipantSchema>;

export const ThreadMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  platformMessageId: z.string(),
  author: ThreadParticipantSchema,
  content: z.string(),
  direction: z.enum(['inbound', 'outbound']),
  timestamp: z.date(),
  replyToMessageId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type ThreadMessage = z.infer<typeof ThreadMessageSchema>;

export const ThreadSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  platform: z.enum(['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x', 'skool']),
  type: z.enum(['comment', 'dm', 'mention']),
  status: z.enum(['open', 'handled', 'escalated', 'archived']).default('open'),

  // Platform identifiers
  platformThreadId: z.string().optional(),
  rootPostId: z.string().optional(),

  // Messages
  messages: z.array(ThreadMessageSchema),
  messageCount: z.number().default(0),

  // Participants
  participants: z.array(ThreadParticipantSchema),
  participantCount: z.number().default(0),

  // Timestamps
  createdAt: z.date(),
  lastMessageAt: z.date(),
  handledAt: z.date().optional(),
  escalatedAt: z.date().optional(),

  // Assignment
  assignedTo: z.string().optional(),

  // Metadata
  tags: z.array(z.string()).default([]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).optional(),

  // Summary (generated)
  summary: z.string().optional(),
  summaryUpdatedAt: z.date().optional(),

  metadata: z.record(z.unknown()).default({}),
});

export type Thread = z.infer<typeof ThreadSchema>;

export function createThread(event: NormalizedEvent): Thread {
  const threadId = `thread_${nanoid()}`;
  const now = new Date();

  const participant: ThreadParticipant = {
    platformId: event.author.platformId,
    displayName: event.author.displayName,
    username: event.author.username,
    profileUrl: event.author.profileUrl,
  };

  const message: ThreadMessage = {
    id: `msg_${nanoid()}`,
    threadId,
    platformMessageId: event.id,
    author: participant,
    content: event.content,
    direction: 'inbound',
    timestamp: event.timestamp,
    metadata: event.metadata || {},
  };

  const threadType = mapEventTypeToThreadType(event.eventType);

  return {
    id: threadId,
    clientId: event.clientId,
    platform: event.platform as Platform,
    type: threadType,
    status: 'open',
    platformThreadId: event.threadId,
    rootPostId: event.postId,
    messages: [message],
    messageCount: 1,
    participants: [participant],
    participantCount: 1,
    createdAt: now,
    lastMessageAt: event.timestamp,
    tags: [],
    priority: 'medium',
    metadata: {},
  };
}

function mapEventTypeToThreadType(eventType: string): ThreadType {
  switch (eventType) {
    case 'dm':
      return 'dm';
    case 'mention':
      return 'mention';
    case 'comment':
    default:
      return 'comment';
  }
}

export function addMessageToThread(
  thread: Thread,
  event: NormalizedEvent
): Thread {
  const participant: ThreadParticipant = {
    platformId: event.author.platformId,
    displayName: event.author.displayName,
    username: event.author.username,
    profileUrl: event.author.profileUrl,
  };

  const message: ThreadMessage = {
    id: `msg_${nanoid()}`,
    threadId: thread.id,
    platformMessageId: event.id,
    author: participant,
    content: event.content,
    direction: 'inbound',
    timestamp: event.timestamp,
    replyToMessageId: event.metadata?.parentId as string | undefined,
    metadata: event.metadata || {},
  };

  // Check if participant already exists
  const existingParticipant = thread.participants.find(
    (p) => p.platformId === participant.platformId
  );

  const updatedParticipants = existingParticipant
    ? thread.participants
    : [...thread.participants, participant];

  return {
    ...thread,
    messages: [...thread.messages, message],
    messageCount: thread.messageCount + 1,
    participants: updatedParticipants,
    participantCount: updatedParticipants.length,
    lastMessageAt: event.timestamp,
  };
}

export function addOutboundMessage(
  thread: Thread,
  content: string,
  brandAccountId: string,
  brandDisplayName: string,
  metadata?: Record<string, unknown>
): Thread {
  const message: ThreadMessage = {
    id: `msg_${nanoid()}`,
    threadId: thread.id,
    platformMessageId: `pending_${nanoid()}`,
    author: {
      platformId: brandAccountId,
      displayName: brandDisplayName,
    },
    content,
    direction: 'outbound',
    timestamp: new Date(),
    metadata: metadata || {},
  };

  return {
    ...thread,
    messages: [...thread.messages, message],
    messageCount: thread.messageCount + 1,
    lastMessageAt: message.timestamp,
  };
}

export function getThreadParticipants(thread: Thread): ThreadParticipant[] {
  return [...thread.participants];
}

export function getInboundMessages(thread: Thread): ThreadMessage[] {
  return thread.messages.filter((m) => m.direction === 'inbound');
}

export function getOutboundMessages(thread: Thread): ThreadMessage[] {
  return thread.messages.filter((m) => m.direction === 'outbound');
}

export function getLastMessage(thread: Thread): ThreadMessage | undefined {
  return thread.messages[thread.messages.length - 1];
}

export function updateThreadStatus(
  thread: Thread,
  status: ThreadStatus
): Thread {
  const now = new Date();
  const updates: Partial<Thread> = { status };

  if (status === 'handled') {
    updates.handledAt = now;
  } else if (status === 'escalated') {
    updates.escalatedAt = now;
  }

  return { ...thread, ...updates };
}

export function assignThread(thread: Thread, operatorId: string): Thread {
  return { ...thread, assignedTo: operatorId };
}

export function tagThread(thread: Thread, tags: string[]): Thread {
  const uniqueTags = [...new Set([...thread.tags, ...tags])];
  return { ...thread, tags: uniqueTags };
}

export function setPriority(
  thread: Thread,
  priority: Thread['priority']
): Thread {
  return { ...thread, priority };
}

export function setSentiment(
  thread: Thread,
  sentiment: Thread['sentiment']
): Thread {
  return { ...thread, sentiment };
}

export function validateThread(thread: unknown): Thread {
  return ThreadSchema.parse(thread);
}
```

### Phase 3: Verification

```bash
cd packages/engagement/threads && pnpm test
pnpm test:coverage
pnpm typecheck
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/engagement/threads/src/thread-entity.ts` | Thread entity and operations |
| Create | `packages/engagement/threads/src/__tests__/thread-entity.test.ts` | Tests |
| Create | `packages/engagement/threads/package.json` | Package config |
| Modify | `packages/engagement/threads/src/index.ts` | Export thread entity |

---

## Acceptance Criteria

- [ ] Thread entity model with all required fields
- [ ] Support for comment, DM, and mention thread types
- [ ] Message tracking with direction (inbound/outbound)
- [ ] Participant tracking with deduplication
- [ ] Thread status management (open, handled, escalated, archived)
- [ ] Priority and sentiment fields
- [ ] Zod validation schemas
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-B1",
  "name": "Thread Entity Model",
  "description": "Create unified thread entity for comments, DMs, and mentions",
  "status": "pending",
  "priority": "high",
  "complexity": "high",
  "sprint": 4,
  "agent": "B",
  "dependencies": ["S4-A5"],
  "blocks": ["S4-B2", "S4-B3", "S4-B4", "S4-B5", "S4-C4", "S4-C5"],
  "estimated_hours": 12,
  "tags": ["engagement", "threads", "entity", "schema", "tdd"],
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
  "next_task_hints": ["S4-B2 for thread summaries", "S4-B3 for participant tracking"]
}
```
