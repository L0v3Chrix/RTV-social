# Build Prompt: S4-A1 — Webhook Receiver

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-A1 |
| Sprint | 4 — Engagement |
| Agent | A — Event Ingestion |
| Complexity | High |
| Status | Pending |
| Estimated Effort | 2 days |
| Dependencies | Sprint 3 Complete |
| Blocks | S4-A3, S4-A4, S4-A5 |

---

## Context

### What We're Building
A webhook receiver system that ingests real-time events from platforms that support webhooks (Meta Graph API for Facebook/Instagram, YouTube Data API). The receiver validates signatures, parses payloads, and queues events for processing while handling high throughput and ensuring reliability.

### Why It Matters
- **Real-Time**: React to comments/messages within seconds
- **Reliability**: Never lose events, even under load
- **Security**: Validate webhook signatures to prevent spoofing
- **Scalability**: Handle burst traffic from viral posts
- **Observability**: Track event flow and failures

### Spec References
- `docs/01-architecture/system-architecture-v3.md` — Event ingestion
- `docs/02-schemas/external-memory-schema.md` — EngagementEvent schema
- `docs/05-policy-safety/compliance-safety-framework.md` — Security
- `docs/06-reliability-ops/slo-error-budget.md` — Ingestion SLOs

---

## Prerequisites

### Completed Tasks
- [x] Sprint 3 Complete (Publishing pipeline)

### Required Packages
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0",
    "crypto": "native",
    "@rtv/core": "workspace:*",
    "@rtv/telemetry": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^1.2.0",
    "supertest": "^6.3.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests BEFORE implementation.

#### 1.1 Webhook Signature Verification Tests
```typescript
// packages/engagement/ingestion/src/__tests__/webhook-signature.test.ts
import { describe, it, expect } from 'vitest';
import {
  verifyMetaSignature,
  verifyYouTubeSignature,
  createSignature,
} from '../webhook-signature';

describe('Webhook Signature Verification', () => {
  describe('verifyMetaSignature', () => {
    it('should verify valid Meta webhook signature', () => {
      const payload = JSON.stringify({ object: 'page', entry: [] });
      const secret = 'test_app_secret';
      const signature = createSignature(payload, secret, 'sha256');

      const isValid = verifyMetaSignature(
        payload,
        `sha256=${signature}`,
        secret
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ object: 'page', entry: [] });
      const secret = 'test_app_secret';

      const isValid = verifyMetaSignature(
        payload,
        'sha256=invalid_signature',
        secret
      );

      expect(isValid).toBe(false);
    });

    it('should reject missing signature', () => {
      const payload = JSON.stringify({ object: 'page', entry: [] });
      const secret = 'test_app_secret';

      const isValid = verifyMetaSignature(payload, '', secret);

      expect(isValid).toBe(false);
    });

    it('should reject tampered payload', () => {
      const originalPayload = JSON.stringify({ object: 'page', entry: [] });
      const tamperedPayload = JSON.stringify({ object: 'page', entry: [{}] });
      const secret = 'test_app_secret';
      const signature = createSignature(originalPayload, secret, 'sha256');

      const isValid = verifyMetaSignature(
        tamperedPayload,
        `sha256=${signature}`,
        secret
      );

      expect(isValid).toBe(false);
    });
  });

  describe('verifyYouTubeSignature', () => {
    it('should verify valid YouTube PubSubHubbub signature', () => {
      const payload = '<feed>...</feed>';
      const secret = 'youtube_hub_secret';
      const signature = createSignature(payload, secret, 'sha1');

      const isValid = verifyYouTubeSignature(
        payload,
        `sha1=${signature}`,
        secret
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid YouTube signature', () => {
      const payload = '<feed>...</feed>';
      const secret = 'youtube_hub_secret';

      const isValid = verifyYouTubeSignature(
        payload,
        'sha1=invalid',
        secret
      );

      expect(isValid).toBe(false);
    });
  });
});
```

#### 1.2 Meta Webhook Parser Tests
```typescript
// packages/engagement/ingestion/src/__tests__/meta-webhook-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseMetaWebhook, MetaWebhookEvent } from '../meta-webhook-parser';

describe('Meta Webhook Parser', () => {
  describe('parseMetaWebhook', () => {
    it('should parse Facebook page comment event', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page_123',
            time: 1704067200,
            changes: [
              {
                field: 'feed',
                value: {
                  item: 'comment',
                  comment_id: 'comment_456',
                  post_id: 'post_789',
                  from: { id: 'user_111', name: 'Test User' },
                  message: 'Great post!',
                  created_time: 1704067200,
                },
              },
            ],
          },
        ],
      };

      const events = parseMetaWebhook(payload);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('comment');
      expect(events[0].platform).toBe('facebook');
      expect(events[0].content).toBe('Great post!');
      expect(events[0].author.displayName).toBe('Test User');
    });

    it('should parse Instagram comment event', () => {
      const payload = {
        object: 'instagram',
        entry: [
          {
            id: 'ig_account_123',
            time: 1704067200,
            changes: [
              {
                field: 'comments',
                value: {
                  id: 'comment_ig_456',
                  media: { id: 'media_789' },
                  from: { id: 'user_ig_111', username: 'testuser' },
                  text: 'Love this!',
                  timestamp: '2025-01-01T00:00:00+0000',
                },
              },
            ],
          },
        ],
      };

      const events = parseMetaWebhook(payload);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('comment');
      expect(events[0].platform).toBe('instagram');
      expect(events[0].content).toBe('Love this!');
    });

    it('should parse Facebook Messenger event', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page_123',
            time: 1704067200,
            messaging: [
              {
                sender: { id: 'user_sender_123' },
                recipient: { id: 'page_123' },
                timestamp: 1704067200000,
                message: {
                  mid: 'msg_456',
                  text: 'Hello, I have a question',
                },
              },
            ],
          },
        ],
      };

      const events = parseMetaWebhook(payload);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('dm');
      expect(events[0].platform).toBe('facebook');
      expect(events[0].content).toBe('Hello, I have a question');
    });

    it('should parse Instagram Direct message', () => {
      const payload = {
        object: 'instagram',
        entry: [
          {
            id: 'ig_account_123',
            time: 1704067200,
            messaging: [
              {
                sender: { id: 'user_ig_sender' },
                recipient: { id: 'ig_account_123' },
                timestamp: 1704067200000,
                message: {
                  mid: 'ig_msg_789',
                  text: 'Can you help me?',
                },
              },
            ],
          },
        ],
      };

      const events = parseMetaWebhook(payload);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('dm');
      expect(events[0].platform).toBe('instagram');
    });

    it('should handle multiple events in single payload', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page_123',
            time: 1704067200,
            changes: [
              {
                field: 'feed',
                value: { item: 'comment', comment_id: 'c1', message: 'Comment 1' },
              },
              {
                field: 'feed',
                value: { item: 'comment', comment_id: 'c2', message: 'Comment 2' },
              },
            ],
          },
        ],
      };

      const events = parseMetaWebhook(payload);

      expect(events).toHaveLength(2);
    });

    it('should ignore unsupported event types', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page_123',
            time: 1704067200,
            changes: [
              {
                field: 'feed',
                value: { item: 'like', user_id: 'user_123' },
              },
            ],
          },
        ],
      };

      const events = parseMetaWebhook(payload);

      // Likes might be filtered out or handled differently
      expect(events.every((e) => e.eventType !== 'unknown')).toBe(true);
    });
  });
});
```

#### 1.3 Webhook Handler Tests
```typescript
// packages/engagement/ingestion/src/__tests__/webhook-handler.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createWebhookApp } from '../webhook-handler';
import { createMockQueue } from './__mocks__/queue';
import { createMockClientResolver } from './__mocks__/client-resolver';

describe('Webhook Handler', () => {
  let app: Express.Application;
  let mockQueue: ReturnType<typeof createMockQueue>;
  let mockClientResolver: ReturnType<typeof createMockClientResolver>;

  beforeEach(() => {
    mockQueue = createMockQueue();
    mockClientResolver = createMockClientResolver();
    mockClientResolver.resolve.mockResolvedValue({
      clientId: 'client_123',
      appSecret: 'test_secret',
    });

    app = createWebhookApp({
      queue: mockQueue,
      clientResolver: mockClientResolver,
    });
  });

  describe('GET /webhooks/meta', () => {
    it('should handle Meta verification challenge', async () => {
      const response = await request(app)
        .get('/webhooks/meta')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'verification_token',
          'hub.challenge': 'challenge_string',
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('challenge_string');
    });

    it('should reject invalid verify token', async () => {
      const response = await request(app)
        .get('/webhooks/meta')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'challenge_string',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /webhooks/meta', () => {
    it('should process valid Meta webhook', async () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page_123',
            time: Date.now(),
            changes: [
              {
                field: 'feed',
                value: {
                  item: 'comment',
                  comment_id: 'c_123',
                  message: 'Test comment',
                },
              },
            ],
          },
        ],
      };

      const signature = createValidSignature(JSON.stringify(payload), 'test_secret');

      const response = await request(app)
        .post('/webhooks/meta')
        .set('X-Hub-Signature-256', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should reject invalid signature', async () => {
      const payload = { object: 'page', entry: [] };

      const response = await request(app)
        .post('/webhooks/meta')
        .set('X-Hub-Signature-256', 'sha256=invalid')
        .send(payload);

      expect(response.status).toBe(401);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should respond quickly and process async', async () => {
      const payload = {
        object: 'page',
        entry: [{ id: 'page_123', time: Date.now(), changes: [] }],
      };
      const signature = createValidSignature(JSON.stringify(payload), 'test_secret');

      const startTime = Date.now();
      const response = await request(app)
        .post('/webhooks/meta')
        .set('X-Hub-Signature-256', signature)
        .send(payload);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Respond within 1 second
    });
  });

  describe('POST /webhooks/youtube', () => {
    it('should process valid YouTube webhook', async () => {
      const payload = `<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <yt:videoId>video_123</yt:videoId>
            <title>Test Video</title>
          </entry>
        </feed>`;

      const signature = createValidSignature(payload, 'youtube_secret', 'sha1');

      const response = await request(app)
        .post('/webhooks/youtube')
        .set('X-Hub-Signature', signature)
        .set('Content-Type', 'application/atom+xml')
        .send(payload);

      expect(response.status).toBe(200);
    });

    it('should handle YouTube hub verification', async () => {
      const response = await request(app)
        .get('/webhooks/youtube')
        .query({
          'hub.mode': 'subscribe',
          'hub.challenge': 'youtube_challenge',
          'hub.topic': 'https://youtube.com/xml/feeds/videos.xml?channel_id=UC123',
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('youtube_challenge');
    });
  });
});

function createValidSignature(payload: string, secret: string, algorithm = 'sha256'): string {
  const crypto = require('crypto');
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(payload);
  return `${algorithm}=${hmac.digest('hex')}`;
}
```

### Phase 2: Implementation

#### 2.1 Create Webhook Signature Verification
```typescript
// packages/engagement/ingestion/src/webhook-signature.ts
import crypto from 'crypto';

export function createSignature(
  payload: string,
  secret: string,
  algorithm: 'sha1' | 'sha256'
): string {
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

export function verifyMetaSignature(
  payload: string,
  signatureHeader: string,
  appSecret: string
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const [algorithm, signature] = signatureHeader.split('=');
  if (algorithm !== 'sha256' || !signature) {
    return false;
  }

  const expectedSignature = createSignature(payload, appSecret, 'sha256');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export function verifyYouTubeSignature(
  payload: string,
  signatureHeader: string,
  hubSecret: string
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const [algorithm, signature] = signatureHeader.split('=');
  if (algorithm !== 'sha1' || !signature) {
    return false;
  }

  const expectedSignature = createSignature(payload, hubSecret, 'sha1');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

#### 2.2 Create Meta Webhook Parser
```typescript
// packages/engagement/ingestion/src/meta-webhook-parser.ts
import { Platform } from '@rtv/core';

export interface MetaWebhookEvent {
  id: string;
  platform: Platform;
  eventType: 'comment' | 'dm' | 'mention' | 'reaction';
  postId?: string;
  threadId?: string;
  author: {
    platformId: string;
    displayName: string;
    username?: string;
    profileUrl?: string;
  };
  content: string;
  timestamp: Date;
  rawPayload: Record<string, unknown>;
}

export function parseMetaWebhook(payload: any): MetaWebhookEvent[] {
  const events: MetaWebhookEvent[] = [];
  const platform = payload.object === 'instagram' ? 'instagram' : 'facebook';

  for (const entry of payload.entry || []) {
    // Handle feed changes (comments, posts)
    if (entry.changes) {
      for (const change of entry.changes) {
        const event = parseFeedChange(change, entry.id, platform);
        if (event) {
          events.push(event);
        }
      }
    }

    // Handle messaging (DMs)
    if (entry.messaging) {
      for (const messaging of entry.messaging) {
        const event = parseMessaging(messaging, entry.id, platform);
        if (event) {
          events.push(event);
        }
      }
    }
  }

  return events;
}

function parseFeedChange(
  change: any,
  pageId: string,
  platform: Platform
): MetaWebhookEvent | null {
  if (change.field !== 'feed' && change.field !== 'comments') {
    return null;
  }

  const value = change.value;

  if (value.item === 'comment' || change.field === 'comments') {
    return {
      id: value.comment_id || value.id || `comment_${Date.now()}`,
      platform,
      eventType: 'comment',
      postId: value.post_id || value.media?.id,
      author: {
        platformId: value.from?.id || value.from?.username || 'unknown',
        displayName: value.from?.name || value.from?.username || 'Unknown User',
        username: value.from?.username,
      },
      content: value.message || value.text || '',
      timestamp: parseTimestamp(value.created_time || value.timestamp),
      rawPayload: value,
    };
  }

  if (value.item === 'reaction' || value.item === 'like') {
    return {
      id: `reaction_${value.reaction_type || 'like'}_${Date.now()}`,
      platform,
      eventType: 'reaction',
      postId: value.post_id,
      author: {
        platformId: value.from?.id || 'unknown',
        displayName: value.from?.name || 'Unknown User',
      },
      content: value.reaction_type || 'like',
      timestamp: new Date(),
      rawPayload: value,
    };
  }

  return null;
}

function parseMessaging(
  messaging: any,
  accountId: string,
  platform: Platform
): MetaWebhookEvent | null {
  if (!messaging.message) {
    return null;
  }

  return {
    id: messaging.message.mid || `dm_${Date.now()}`,
    platform,
    eventType: 'dm',
    threadId: messaging.sender.id,
    author: {
      platformId: messaging.sender.id,
      displayName: messaging.sender.name || messaging.sender.id,
    },
    content: messaging.message.text || '',
    timestamp: new Date(messaging.timestamp),
    rawPayload: messaging,
  };
}

function parseTimestamp(timestamp: any): Date {
  if (!timestamp) {
    return new Date();
  }

  if (typeof timestamp === 'number') {
    // Unix timestamp (seconds or milliseconds)
    return new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
  }

  return new Date(timestamp);
}
```

#### 2.3 Create Webhook Handler
```typescript
// packages/engagement/ingestion/src/webhook-handler.ts
import express, { Request, Response, Application } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Queue } from 'bullmq';
import { verifyMetaSignature, verifyYouTubeSignature } from './webhook-signature';
import { parseMetaWebhook } from './meta-webhook-parser';

const tracer = trace.getTracer('webhook-handler');

interface WebhookAppConfig {
  queue: Queue;
  clientResolver: ClientResolver;
  metaVerifyToken?: string;
  youtubeHubSecret?: string;
}

interface ClientResolver {
  resolve(platformId: string, platform: string): Promise<{
    clientId: string;
    appSecret: string;
  } | null>;
}

export function createWebhookApp(config: WebhookAppConfig): Application {
  const app = express();

  // Raw body for signature verification
  app.use('/webhooks', express.raw({ type: '*/*' }));

  // Meta webhook verification (GET)
  app.get('/webhooks/meta', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.metaVerifyToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  });

  // Meta webhook handler (POST)
  app.post('/webhooks/meta', async (req: Request, res: Response) => {
    return tracer.startActiveSpan('handleMetaWebhook', async (span) => {
      const rawBody = req.body.toString();
      const signature = req.headers['x-hub-signature-256'] as string;

      try {
        const payload = JSON.parse(rawBody);

        // Get first entry to resolve client
        const firstEntry = payload.entry?.[0];
        if (!firstEntry) {
          res.status(200).send('OK');
          span.end();
          return;
        }

        const platform = payload.object === 'instagram' ? 'instagram' : 'facebook';
        const client = await config.clientResolver.resolve(firstEntry.id, platform);

        if (!client) {
          span.setAttributes({ 'webhook.client_found': false });
          res.status(200).send('OK'); // Still acknowledge
          span.end();
          return;
        }

        // Verify signature
        if (!verifyMetaSignature(rawBody, signature, client.appSecret)) {
          span.setAttributes({ 'webhook.signature_valid': false });
          res.status(401).send('Invalid signature');
          span.end();
          return;
        }

        // Parse and queue events
        const events = parseMetaWebhook(payload);
        span.setAttributes({
          'webhook.event_count': events.length,
          'webhook.platform': platform,
        });

        for (const event of events) {
          await config.queue.add('process-event', {
            clientId: client.clientId,
            event,
            receivedAt: new Date().toISOString(),
          });
        }

        res.status(200).send('OK');
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error: any) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        res.status(200).send('OK'); // Always acknowledge to prevent retries
      } finally {
        span.end();
      }
    });
  });

  // YouTube webhook verification (GET)
  app.get('/webhooks/youtube', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && challenge) {
      res.status(200).send(challenge);
    } else {
      res.status(200).send('OK');
    }
  });

  // YouTube webhook handler (POST)
  app.post('/webhooks/youtube', async (req: Request, res: Response) => {
    return tracer.startActiveSpan('handleYouTubeWebhook', async (span) => {
      const rawBody = req.body.toString();
      const signature = req.headers['x-hub-signature'] as string;

      try {
        if (config.youtubeHubSecret) {
          if (!verifyYouTubeSignature(rawBody, signature, config.youtubeHubSecret)) {
            span.setAttributes({ 'webhook.signature_valid': false });
            res.status(401).send('Invalid signature');
            span.end();
            return;
          }
        }

        // Parse YouTube Atom feed
        const events = parseYouTubeFeed(rawBody);
        span.setAttributes({
          'webhook.event_count': events.length,
          'webhook.platform': 'youtube',
        });

        for (const event of events) {
          // Resolve client from channel ID
          const client = await config.clientResolver.resolve(
            event.channelId,
            'youtube'
          );

          if (client) {
            await config.queue.add('process-event', {
              clientId: client.clientId,
              event,
              receivedAt: new Date().toISOString(),
            });
          }
        }

        res.status(200).send('OK');
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error: any) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        res.status(200).send('OK');
      } finally {
        span.end();
      }
    });
  });

  return app;
}

function parseYouTubeFeed(xml: string): any[] {
  // Simplified XML parsing - in production use proper XML parser
  const events: any[] = [];
  const videoIdMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
  const channelIdMatch = xml.match(/<yt:channelId>([^<]+)<\/yt:channelId>/);

  if (videoIdMatch && channelIdMatch) {
    events.push({
      id: `yt_${videoIdMatch[1]}`,
      platform: 'youtube',
      eventType: 'video_update',
      videoId: videoIdMatch[1],
      channelId: channelIdMatch[1],
      timestamp: new Date(),
    });
  }

  return events;
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
| Create | `packages/engagement/ingestion/package.json` | Package config |
| Create | `packages/engagement/ingestion/src/index.ts` | Public exports |
| Create | `packages/engagement/ingestion/src/webhook-signature.ts` | Signature verification |
| Create | `packages/engagement/ingestion/src/meta-webhook-parser.ts` | Meta payload parser |
| Create | `packages/engagement/ingestion/src/webhook-handler.ts` | Express webhook handler |
| Create | `packages/engagement/ingestion/src/__tests__/` | Test directory |

---

## Acceptance Criteria

- [ ] Meta webhook signature verification (SHA256)
- [ ] YouTube PubSubHubbub signature verification (SHA1)
- [ ] Parse Facebook comments, DMs, reactions
- [ ] Parse Instagram comments, DMs
- [ ] Parse YouTube feed updates
- [ ] Queue events for async processing
- [ ] Respond within 1 second (async processing)
- [ ] Verification challenge handling (GET)
- [ ] Unit tests achieve 90%+ coverage

---

## Test Requirements

### Unit Tests
- Signature verification (valid, invalid, tampered)
- Meta payload parsing (comments, DMs, reactions)
- YouTube feed parsing
- Client resolution

### Integration Tests
- Full webhook flow with mocked queue
- HTTP endpoint testing with supertest

### Contract Tests
- Meta webhook payload schema
- YouTube Atom feed schema

---

## Security & Safety Checklist

- [ ] Signature verification before processing
- [ ] Timing-safe comparison for signatures
- [ ] No secrets in logs or errors
- [ ] Client isolation via resolver
- [ ] Always acknowledge webhooks (prevent retries)
- [ ] Rate limiting on endpoints

---

## JSON Task Block

```json
{
  "task_id": "S4-A1",
  "name": "Webhook Receiver",
  "description": "Receive and validate webhooks from Meta (Facebook/Instagram) and YouTube",
  "status": "pending",
  "priority": "high",
  "complexity": "high",
  "sprint": 4,
  "agent": "A",
  "dependencies": ["S3-complete"],
  "blocks": ["S4-A3", "S4-A4", "S4-A5"],
  "estimated_hours": 16,
  "actual_hours": null,
  "tags": ["engagement", "webhook", "meta", "youtube", "tdd"],
  "package": "@rtv/engagement/ingestion",
  "files": {
    "create": [
      "packages/engagement/ingestion/src/webhook-signature.ts",
      "packages/engagement/ingestion/src/meta-webhook-parser.ts",
      "packages/engagement/ingestion/src/webhook-handler.ts"
    ],
    "modify": [],
    "delete": []
  },
  "acceptance_criteria": [
    "Meta signature verification",
    "YouTube signature verification",
    "Parse comments and DMs",
    "Queue for async processing",
    "90%+ test coverage"
  ]
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
  "references_used": [],
  "artifacts_created": [],
  "webhook_events_processed": 0,
  "next_task_hints": [
    "S4-A2 for polling system",
    "S4-A3 for event normalization"
  ]
}
```
