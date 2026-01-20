# Build Prompt: S3-A2 — Scheduling API

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S3-A2 |
| Sprint | 3 - Scheduling + Publishing |
| Agent | A - Calendar System |
| Task Name | Scheduling API |
| Complexity | Medium |
| Status | pending |
| Estimated Tokens | 8,000 |

---

## Context

### What We're Building

The Scheduling API provides HTTP endpoints for creating, updating, and managing scheduled posts. It exposes the calendar system functionality through a RESTful interface that clients and internal services can use.

### Why It Matters

- **Integration point** — UI and agents interact with scheduling through this API
- **Consistent interface** — Standard REST patterns for scheduling operations
- **Validation** — Centralized input validation and error handling
- **Audit trail** — All scheduling actions logged for compliance

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | API Layer | Route patterns |
| `docs/07-engineering-process/engineering-handbook.md` | API Standards | Response formats |
| `docs/05-policy-safety/multi-tenant-isolation.md` | Auth | Client scoping |

---

## Prerequisites

### Completed Tasks

| Task ID | Provides |
|---------|----------|
| S3-A1 | Calendar model and repository |
| S0-B3 | Multi-tenant schema |
| S1-D1 | Episode runner (for context) |

### Required Packages

```bash
pnpm add hono @hono/zod-validator
pnpm add -D vitest supertest
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests that define the expected behavior.

#### Test File: `packages/calendar/src/api/__tests__/scheduling-api.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { createSchedulingRoutes } from '../routes';
import { createTestDatabase, cleanupTestDatabase, createTestClient } from '@rtv/testing';

describe('Scheduling API', () => {
  let app: Hono;
  let db: any;
  let testClient: { id: string; apiKey: string };

  beforeEach(async () => {
    db = await createTestDatabase();
    testClient = await createTestClient(db);

    app = new Hono();
    app.route('/api/v1/calendar', createSchedulingRoutes(db));
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('POST /slots', () => {
    it('should create a calendar slot', async () => {
      const response = await app.request('/api/v1/calendar/slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          startTime: '2025-01-20T10:00:00Z',
          endTime: '2025-01-20T10:30:00Z',
          platform: 'instagram',
        }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data.id).toBeDefined();
      expect(body.data.status).toBe('available');
      expect(body.data.platform).toBe('instagram');
    });

    it('should reject invalid time range', async () => {
      const response = await app.request('/api/v1/calendar/slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          startTime: '2025-01-20T10:30:00Z',
          endTime: '2025-01-20T10:00:00Z', // End before start
          platform: 'instagram',
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('INVALID_TIME_RANGE');
    });

    it('should require authentication', async () => {
      const response = await app.request('/api/v1/calendar/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: '2025-01-20T10:00:00Z',
          endTime: '2025-01-20T10:30:00Z',
          platform: 'instagram',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /slots/generate', () => {
    it('should generate slots for date range', async () => {
      const response = await app.request('/api/v1/calendar/slots/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          startDate: '2025-01-20',
          endDate: '2025-01-21',
          platform: 'instagram',
          preferredTimes: ['09:00', '12:00', '17:00'],
          timezone: 'America/New_York',
          slotDurationMinutes: 30,
        }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data.slotsCreated).toBe(6); // 3 times × 2 days
      expect(body.data.slots).toHaveLength(6);
    });
  });

  describe('GET /slots', () => {
    it('should list available slots', async () => {
      // Create test slots
      await app.request('/api/v1/calendar/slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          startTime: '2025-01-20T10:00:00Z',
          endTime: '2025-01-20T10:30:00Z',
          platform: 'instagram',
        }),
      });

      const response = await app.request(
        '/api/v1/calendar/slots?platform=instagram&status=available',
        {
          headers: {
            'X-Client-ID': testClient.id,
            'Authorization': `Bearer ${testClient.apiKey}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
    });

    it('should filter by date range', async () => {
      const response = await app.request(
        '/api/v1/calendar/slots?startDate=2025-01-20&endDate=2025-01-21',
        {
          headers: {
            'X-Client-ID': testClient.id,
            'Authorization': `Bearer ${testClient.apiKey}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('POST /posts', () => {
    it('should schedule a post', async () => {
      // Create a slot first
      const slotResponse = await app.request('/api/v1/calendar/slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          startTime: '2025-01-20T10:00:00Z',
          endTime: '2025-01-20T10:30:00Z',
          platform: 'instagram',
        }),
      });
      const slotBody = await slotResponse.json();

      const response = await app.request('/api/v1/calendar/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          contentBriefId: 'brief-123',
          platform: 'instagram',
          postType: 'feed',
          slotId: slotBody.data.id,
          content: {
            caption: 'Test post content',
            mediaUrls: ['https://cdn.example.com/image.jpg'],
            hashtags: ['#test'],
          },
        }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data.id).toBeDefined();
      expect(body.data.status).toBe('scheduled');
      expect(body.data.scheduledTime).toBe('2025-01-20T10:00:00.000Z');
    });

    it('should schedule post with auto slot selection', async () => {
      // Create slots with different scores
      await app.request('/api/v1/calendar/slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          startTime: '2025-01-20T10:00:00Z',
          endTime: '2025-01-20T10:30:00Z',
          platform: 'instagram',
          score: 0.7,
        }),
      });
      await app.request('/api/v1/calendar/slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          startTime: '2025-01-20T14:00:00Z',
          endTime: '2025-01-20T14:30:00Z',
          platform: 'instagram',
          score: 0.9,
        }),
      });

      const response = await app.request('/api/v1/calendar/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          contentBriefId: 'brief-123',
          platform: 'instagram',
          postType: 'feed',
          autoSelectBestSlot: true,
          content: {
            caption: 'Test post',
            mediaUrls: ['https://cdn.example.com/image.jpg'],
          },
        }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data.scheduledTime).toBe('2025-01-20T14:00:00.000Z'); // Higher score
    });

    it('should validate required content fields', async () => {
      const response = await app.request('/api/v1/calendar/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          contentBriefId: 'brief-123',
          platform: 'youtube',
          postType: 'video',
          scheduledTime: '2025-01-20T10:00:00Z',
          content: {
            // Missing required 'title' for YouTube
            mediaUrls: ['https://cdn.example.com/video.mp4'],
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /posts/:id', () => {
    it('should update post content', async () => {
      // Create a post first
      const createResponse = await app.request('/api/v1/calendar/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          contentBriefId: 'brief-123',
          platform: 'instagram',
          postType: 'feed',
          scheduledTime: '2025-01-20T10:00:00Z',
          content: {
            caption: 'Original caption',
            mediaUrls: ['https://cdn.example.com/image.jpg'],
          },
        }),
      });
      const createBody = await createResponse.json();

      const response = await app.request(
        `/api/v1/calendar/posts/${createBody.data.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-ID': testClient.id,
            'Authorization': `Bearer ${testClient.apiKey}`,
          },
          body: JSON.stringify({
            content: {
              caption: 'Updated caption',
            },
          }),
        }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.content.caption).toBe('Updated caption');
    });
  });

  describe('POST /posts/:id/reschedule', () => {
    it('should reschedule a post', async () => {
      const createResponse = await app.request('/api/v1/calendar/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          contentBriefId: 'brief-123',
          platform: 'instagram',
          postType: 'feed',
          scheduledTime: '2025-01-20T10:00:00Z',
          content: { caption: 'Test', mediaUrls: [] },
        }),
      });
      const createBody = await createResponse.json();

      const response = await app.request(
        `/api/v1/calendar/posts/${createBody.data.id}/reschedule`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-ID': testClient.id,
            'Authorization': `Bearer ${testClient.apiKey}`,
          },
          body: JSON.stringify({
            newTime: '2025-01-21T14:00:00Z',
            reason: 'Optimal engagement time',
          }),
        }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.scheduledTime).toBe('2025-01-21T14:00:00.000Z');
      expect(body.data.rescheduleHistory).toHaveLength(1);
    });
  });

  describe('DELETE /posts/:id', () => {
    it('should cancel a scheduled post', async () => {
      const createResponse = await app.request('/api/v1/calendar/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          contentBriefId: 'brief-123',
          platform: 'instagram',
          postType: 'feed',
          scheduledTime: '2025-01-20T10:00:00Z',
          content: { caption: 'Test', mediaUrls: [] },
        }),
      });
      const createBody = await createResponse.json();

      const response = await app.request(
        `/api/v1/calendar/posts/${createBody.data.id}`,
        {
          method: 'DELETE',
          headers: {
            'X-Client-ID': testClient.id,
            'Authorization': `Bearer ${testClient.apiKey}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.status).toBe('cancelled');
    });
  });

  describe('GET /posts', () => {
    it('should list scheduled posts', async () => {
      // Create posts
      await app.request('/api/v1/calendar/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          contentBriefId: 'brief-1',
          platform: 'instagram',
          postType: 'feed',
          scheduledTime: '2025-01-20T10:00:00Z',
          content: { caption: 'Test 1', mediaUrls: [] },
        }),
      });
      await app.request('/api/v1/calendar/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
        body: JSON.stringify({
          contentBriefId: 'brief-2',
          platform: 'tiktok',
          postType: 'video',
          scheduledTime: '2025-01-20T14:00:00Z',
          content: { caption: 'Test 2', mediaUrls: [] },
        }),
      });

      const response = await app.request('/api/v1/calendar/posts', {
        headers: {
          'X-Client-ID': testClient.id,
          'Authorization': `Bearer ${testClient.apiKey}`,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(2);
    });

    it('should filter posts by platform', async () => {
      const response = await app.request(
        '/api/v1/calendar/posts?platform=instagram',
        {
          headers: {
            'X-Client-ID': testClient.id,
            'Authorization': `Bearer ${testClient.apiKey}`,
          },
        }
      );

      expect(response.status).toBe(200);
    });

    it('should filter posts by status', async () => {
      const response = await app.request(
        '/api/v1/calendar/posts?status=scheduled,queued',
        {
          headers: {
            'X-Client-ID': testClient.id,
            'Authorization': `Bearer ${testClient.apiKey}`,
          },
        }
      );

      expect(response.status).toBe(200);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Define API Schemas

Create `packages/calendar/src/api/schemas.ts`:

```typescript
import { z } from 'zod';
import { PlatformSchema, PostTypeSchema, PostContentSchema } from '../schemas';

// Create slot request
export const CreateSlotRequestSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  platform: PlatformSchema,
  score: z.number().min(0).max(1).optional(),
  platformMetadata: z.record(z.unknown()).optional(),
});

// Generate slots request
export const GenerateSlotsRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platform: PlatformSchema,
  preferredTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)),
  timezone: z.string().default('UTC'),
  slotDurationMinutes: z.number().min(5).max(120).default(30),
  skipWeekends: z.boolean().default(false),
  excludeDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
});

// Schedule post request
export const SchedulePostRequestSchema = z.object({
  contentBriefId: z.string(),
  platform: PlatformSchema,
  postType: PostTypeSchema,
  slotId: z.string().uuid().optional(),
  scheduledTime: z.string().datetime().optional(),
  autoSelectBestSlot: z.boolean().default(false),
  preferredTimeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
  content: PostContentSchema,
});

// Update post request
export const UpdatePostRequestSchema = z.object({
  content: PostContentSchema.partial().optional(),
});

// Reschedule post request
export const ReschedulePostRequestSchema = z.object({
  newTime: z.string().datetime(),
  reason: z.string().min(1).max(500),
});

// Query params
export const SlotQuerySchema = z.object({
  platform: PlatformSchema.optional(),
  status: z.enum(['available', 'reserved', 'executed', 'cancelled']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const PostQuerySchema = z.object({
  platform: PlatformSchema.optional(),
  status: z.string().optional(), // Comma-separated
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// API response wrapper
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});
```

#### Step 2: Implement Route Handlers

Create `packages/calendar/src/api/routes.ts`:

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { Database } from '@rtv/database';
import { CalendarRepository } from '../repository';
import { Calendar } from '../calendar';
import { CalendarSlot } from '../models/calendar-slot';
import { ScheduledPost } from '../models/scheduled-post';
import {
  CreateSlotRequestSchema,
  GenerateSlotsRequestSchema,
  SchedulePostRequestSchema,
  UpdatePostRequestSchema,
  ReschedulePostRequestSchema,
  SlotQuerySchema,
  PostQuerySchema,
} from './schemas';
import { authMiddleware } from './middleware';

export function createSchedulingRoutes(db: Database) {
  const app = new Hono();
  const repo = new CalendarRepository(db);

  // Auth middleware
  app.use('*', authMiddleware);

  // Helper to get client ID from context
  const getClientId = (c: any): string => c.get('clientId');

  // === SLOT ROUTES ===

  // Create single slot
  app.post(
    '/slots',
    zValidator('json', CreateSlotRequestSchema),
    async (c) => {
      const clientId = getClientId(c);
      const body = c.req.valid('json');

      const startTime = new Date(body.startTime);
      const endTime = new Date(body.endTime);

      if (endTime <= startTime) {
        return c.json({
          success: false,
          error: {
            code: 'INVALID_TIME_RANGE',
            message: 'End time must be after start time',
          },
        }, 400);
      }

      try {
        const slot = CalendarSlot.create({
          clientId,
          startTime,
          endTime,
          platform: body.platform,
          score: body.score,
          platformMetadata: body.platformMetadata,
        });

        const row = await repo.createSlot({
          clientId: slot.clientId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          platform: slot.platform,
          status: slot.status,
          score: slot.score,
          platformMetadata: slot.platformMetadata,
        });

        return c.json({ success: true, data: row }, 201);
      } catch (error: any) {
        return c.json({
          success: false,
          error: { code: 'SLOT_CREATION_FAILED', message: error.message },
        }, 400);
      }
    }
  );

  // Generate slots
  app.post(
    '/slots/generate',
    zValidator('json', GenerateSlotsRequestSchema),
    async (c) => {
      const clientId = getClientId(c);
      const body = c.req.valid('json');

      const calendar = new Calendar(repo, clientId);

      const slots = await calendar.generateSlots({
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        platform: body.platform,
        preferredTimes: body.preferredTimes,
        timezone: body.timezone,
        slotDurationMinutes: body.slotDurationMinutes,
        skipWeekends: body.skipWeekends,
        excludeDates: body.excludeDates?.map(d => new Date(d)),
        skipExisting: true,
        slotsPerDay: body.preferredTimes.length,
      });

      return c.json({
        success: true,
        data: {
          slotsCreated: slots.length,
          slots: slots.map(s => s.toRow()),
        },
      }, 201);
    }
  );

  // List slots
  app.get(
    '/slots',
    zValidator('query', SlotQuerySchema),
    async (c) => {
      const clientId = getClientId(c);
      const query = c.req.valid('query');

      const slots = await repo.querySlots({
        clientId,
        platform: query.platform,
        status: query.status,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        limit: query.limit,
      });

      return c.json({ success: true, data: slots });
    }
  );

  // Get single slot
  app.get('/slots/:id', async (c) => {
    const clientId = getClientId(c);
    const slotId = c.req.param('id');

    const slot = await repo.getSlot(slotId);
    if (!slot || slot.clientId !== clientId) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Slot not found' },
      }, 404);
    }

    return c.json({ success: true, data: slot });
  });

  // Delete slot
  app.delete('/slots/:id', async (c) => {
    const clientId = getClientId(c);
    const slotId = c.req.param('id');

    const slot = await repo.getSlot(slotId);
    if (!slot || slot.clientId !== clientId) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Slot not found' },
      }, 404);
    }

    if (slot.status === 'reserved' || slot.status === 'executed') {
      return c.json({
        success: false,
        error: { code: 'SLOT_IN_USE', message: 'Cannot delete slot in use' },
      }, 400);
    }

    await repo.updateSlot(slotId, { status: 'cancelled' });

    return c.json({ success: true, data: { id: slotId, status: 'cancelled' } });
  });

  // === POST ROUTES ===

  // Schedule post
  app.post(
    '/posts',
    zValidator('json', SchedulePostRequestSchema),
    async (c) => {
      const clientId = getClientId(c);
      const body = c.req.valid('json');

      const calendar = new Calendar(repo, clientId);

      try {
        const post = await calendar.schedulePost({
          contentBriefId: body.contentBriefId,
          platform: body.platform,
          postType: body.postType,
          slotId: body.slotId,
          scheduledTime: body.scheduledTime ? new Date(body.scheduledTime) : undefined,
          autoSelectBestSlot: body.autoSelectBestSlot,
          preferredTimeRange: body.preferredTimeRange ? {
            start: new Date(body.preferredTimeRange.start),
            end: new Date(body.preferredTimeRange.end),
          } : undefined,
          content: body.content,
        });

        return c.json({ success: true, data: post.toRow() }, 201);
      } catch (error: any) {
        return c.json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.message },
        }, 400);
      }
    }
  );

  // List posts
  app.get(
    '/posts',
    zValidator('query', PostQuerySchema),
    async (c) => {
      const clientId = getClientId(c);
      const query = c.req.valid('query');

      const posts = await repo.queryPosts({
        clientId,
        platform: query.platform,
        status: query.status?.split(','),
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        limit: query.limit,
      });

      return c.json({ success: true, data: posts });
    }
  );

  // Get single post
  app.get('/posts/:id', async (c) => {
    const clientId = getClientId(c);
    const postId = c.req.param('id');

    const post = await repo.getPost(postId);
    if (!post || post.clientId !== clientId) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Post not found' },
      }, 404);
    }

    return c.json({ success: true, data: post });
  });

  // Update post
  app.patch(
    '/posts/:id',
    zValidator('json', UpdatePostRequestSchema),
    async (c) => {
      const clientId = getClientId(c);
      const postId = c.req.param('id');
      const body = c.req.valid('json');

      const postRow = await repo.getPost(postId);
      if (!postRow || postRow.clientId !== clientId) {
        return c.json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Post not found' },
        }, 404);
      }

      const post = ScheduledPost.fromRow(postRow);

      try {
        if (body.content) {
          post.updateContent(body.content);
        }

        const updated = await repo.updatePost(postId, {
          content: post.content,
        });

        return c.json({ success: true, data: updated });
      } catch (error: any) {
        return c.json({
          success: false,
          error: { code: 'UPDATE_FAILED', message: error.message },
        }, 400);
      }
    }
  );

  // Reschedule post
  app.post(
    '/posts/:id/reschedule',
    zValidator('json', ReschedulePostRequestSchema),
    async (c) => {
      const clientId = getClientId(c);
      const postId = c.req.param('id');
      const body = c.req.valid('json');

      const calendar = new Calendar(repo, clientId);

      try {
        const post = await calendar.reschedulePost(
          postId,
          new Date(body.newTime),
          body.reason
        );

        return c.json({ success: true, data: post.toRow() });
      } catch (error: any) {
        return c.json({
          success: false,
          error: { code: 'RESCHEDULE_FAILED', message: error.message },
        }, 400);
      }
    }
  );

  // Cancel post
  app.delete('/posts/:id', async (c) => {
    const clientId = getClientId(c);
    const postId = c.req.param('id');

    const postRow = await repo.getPost(postId);
    if (!postRow || postRow.clientId !== clientId) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Post not found' },
      }, 404);
    }

    const post = ScheduledPost.fromRow(postRow);

    try {
      post.cancel();
      const updated = await repo.updatePost(postId, { status: 'cancelled' });

      // Release slot if exists
      if (post.slotId) {
        await repo.updateSlot(post.slotId, {
          status: 'available',
          reservedForPostId: null,
        });
      }

      return c.json({ success: true, data: updated });
    } catch (error: any) {
      return c.json({
        success: false,
        error: { code: 'CANCEL_FAILED', message: error.message },
      }, 400);
    }
  });

  return app;
}
```

#### Step 3: Implement Auth Middleware

Create `packages/calendar/src/api/middleware.ts`:

```typescript
import { Context, Next } from 'hono';

export async function authMiddleware(c: Context, next: Next) {
  const clientId = c.req.header('X-Client-ID');
  const authHeader = c.req.header('Authorization');

  if (!clientId || !authHeader) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing authentication headers',
      },
    }, 401);
  }

  if (!authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid authorization format',
      },
    }, 401);
  }

  // TODO: Validate API key against database
  // For now, just set the client ID
  c.set('clientId', clientId);

  await next();
}
```

#### Step 4: Export API Module

Create `packages/calendar/src/api/index.ts`:

```typescript
export * from './routes';
export * from './schemas';
export * from './middleware';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/calendar
pnpm test src/api/

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint src/api/
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/calendar/src/api/schemas.ts` | Request/response schemas |
| Create | `packages/calendar/src/api/routes.ts` | HTTP route handlers |
| Create | `packages/calendar/src/api/middleware.ts` | Auth middleware |
| Create | `packages/calendar/src/api/index.ts` | Module exports |
| Create | `packages/calendar/src/api/__tests__/scheduling-api.test.ts` | API tests |

---

## Acceptance Criteria

- [ ] POST /slots creates a calendar slot
- [ ] POST /slots/generate creates multiple slots
- [ ] GET /slots lists slots with filters
- [ ] POST /posts schedules a post
- [ ] POST /posts supports auto slot selection
- [ ] PATCH /posts/:id updates post content
- [ ] POST /posts/:id/reschedule reschedules a post
- [ ] DELETE /posts/:id cancels a post
- [ ] All endpoints require authentication
- [ ] All endpoints scope by client ID
- [ ] All tests pass

---

## JSON Task Block

```json
{
  "task_id": "S3-A2",
  "name": "Scheduling API",
  "status": "pending",
  "dependencies": ["S3-A1"],
  "blocks": ["S3-A3"],
  "created_at": "2025-01-16T00:00:00Z",
  "updated_at": "2025-01-16T00:00:00Z",
  "complexity": "medium",
  "agent": "A",
  "sprint": 3,
  "package": "@rtv/calendar"
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "token_budget": 8000,
  "tokens_used": 0,
  "context_refs": [
    "spec://docs/01-architecture/system-architecture-v3.md",
    "spec://docs/07-engineering-process/engineering-handbook.md"
  ],
  "predecessor_summaries": [
    "S3-A1: Calendar model with slots, posts, timezone handling"
  ]
}
```
