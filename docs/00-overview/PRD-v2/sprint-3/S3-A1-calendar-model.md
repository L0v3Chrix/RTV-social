# Build Prompt: S3-A1 — Calendar Model

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S3-A1 |
| Sprint | 3 - Scheduling + Publishing |
| Agent | A - Calendar System |
| Task Name | Calendar Model |
| Complexity | High |
| Status | pending |
| Estimated Tokens | 10,000 |

---

## Context

### What We're Building

The Calendar Model provides the foundational data structures and database schema for scheduling social media posts. It manages time slots, scheduled posts, and maintains relationships between content briefs and their publishing schedule.

### Why It Matters

- **Central scheduler** — All publishing flows through the calendar
- **Multi-platform coordination** — Posts scheduled across platforms with timing strategy
- **Conflict prevention** — Foundation for avoiding double-posts and overlaps
- **Client isolation** — Tenant-scoped calendars with no cross-contamination

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Data Model | Entity relationships |
| `docs/02-schemas/external-memory-schema.md` | Calendar Memory | Calendar span format |
| `docs/05-policy-safety/multi-tenant-isolation.md` | Tenant Scoping | Client isolation |
| `docs/06-reliability-ops/slo-error-budget.md` | Availability | Scheduling SLOs |

---

## Prerequisites

### Completed Tasks

| Task ID | Provides |
|---------|----------|
| S0-B2 | Core schema migrations |
| S0-B3 | Multi-tenant schema |
| S1-A1 | Client model |
| S2-A1 | PlanGraph model |

### Required Packages

```bash
pnpm add date-fns date-fns-tz luxon zod
pnpm add -D @types/luxon vitest
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests that define the expected behavior.

#### Test File: `packages/calendar/src/__tests__/calendar-model.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CalendarSlot, ScheduledPost, Calendar } from '../models';
import { CalendarRepository } from '../repository';
import { createTestDatabase, cleanupTestDatabase } from '@rtv/testing';

describe('CalendarSlot', () => {
  describe('creation', () => {
    it('should create a slot with valid time range', () => {
      const slot = CalendarSlot.create({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
      });

      expect(slot.id).toBeDefined();
      expect(slot.clientId).toBe('client-123');
      expect(slot.durationMinutes).toBe(30);
      expect(slot.status).toBe('available');
    });

    it('should reject slot with end before start', () => {
      expect(() => CalendarSlot.create({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:30:00Z'),
        endTime: new Date('2025-01-20T10:00:00Z'),
        platform: 'instagram',
      })).toThrow('End time must be after start time');
    });

    it('should reject slot shorter than minimum duration', () => {
      expect(() => CalendarSlot.create({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:04:00Z'), // 4 minutes
        platform: 'instagram',
        minDurationMinutes: 5,
      })).toThrow('Slot duration below minimum');
    });

    it('should create slot with platform-specific metadata', () => {
      const slot = CalendarSlot.create({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'youtube',
        platformMetadata: {
          preferredAudience: 'US',
          categoryId: '22',
        },
      });

      expect(slot.platformMetadata).toEqual({
        preferredAudience: 'US',
        categoryId: '22',
      });
    });
  });

  describe('timezone handling', () => {
    it('should store times in UTC', () => {
      const slot = CalendarSlot.create({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00-05:00'), // EST
        endTime: new Date('2025-01-20T10:30:00-05:00'),
        platform: 'instagram',
      });

      // Should be stored as UTC (15:00 UTC)
      expect(slot.startTime.toISOString()).toBe('2025-01-20T15:00:00.000Z');
    });

    it('should convert to client timezone for display', () => {
      const slot = CalendarSlot.create({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T15:00:00Z'),
        endTime: new Date('2025-01-20T15:30:00Z'),
        platform: 'instagram',
      });

      const localTime = slot.toTimezone('America/New_York');
      expect(localTime.startTime.getHours()).toBe(10); // 10 AM EST
    });
  });

  describe('status transitions', () => {
    it('should transition from available to reserved', () => {
      const slot = CalendarSlot.create({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
      });

      slot.reserve('post-456');
      expect(slot.status).toBe('reserved');
      expect(slot.reservedForPostId).toBe('post-456');
    });

    it('should not reserve already reserved slot', () => {
      const slot = CalendarSlot.create({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
      });

      slot.reserve('post-456');
      expect(() => slot.reserve('post-789')).toThrow('Slot already reserved');
    });

    it('should release reserved slot', () => {
      const slot = CalendarSlot.create({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
      });

      slot.reserve('post-456');
      slot.release();
      expect(slot.status).toBe('available');
      expect(slot.reservedForPostId).toBeNull();
    });

    it('should mark slot as executed', () => {
      const slot = CalendarSlot.create({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
      });

      slot.reserve('post-456');
      slot.markExecuted();
      expect(slot.status).toBe('executed');
    });
  });
});

describe('ScheduledPost', () => {
  describe('creation', () => {
    it('should create scheduled post from content brief', () => {
      const post = ScheduledPost.create({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
      });

      expect(post.id).toBeDefined();
      expect(post.status).toBe('scheduled');
      expect(post.platform).toBe('instagram');
    });

    it('should create post with content payload', () => {
      const post = ScheduledPost.create({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
        content: {
          caption: 'Check out our latest product!',
          mediaUrls: ['https://cdn.example.com/image1.jpg'],
          hashtags: ['#product', '#launch'],
        },
      });

      expect(post.content.caption).toBeDefined();
      expect(post.content.mediaUrls).toHaveLength(1);
    });

    it('should validate required fields for post type', () => {
      expect(() => ScheduledPost.create({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'youtube',
        postType: 'video',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
        content: {
          // Missing title for YouTube video
          mediaUrls: ['https://cdn.example.com/video.mp4'],
        },
      })).toThrow('YouTube video requires title');
    });
  });

  describe('status transitions', () => {
    it('should follow valid state machine: scheduled → queued', () => {
      const post = ScheduledPost.create({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
      });

      post.queue();
      expect(post.status).toBe('queued');
      expect(post.queuedAt).toBeDefined();
    });

    it('should follow valid state machine: queued → publishing', () => {
      const post = ScheduledPost.create({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
      });

      post.queue();
      post.startPublishing();
      expect(post.status).toBe('publishing');
      expect(post.publishingStartedAt).toBeDefined();
    });

    it('should follow valid state machine: publishing → published', () => {
      const post = ScheduledPost.create({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
      });

      post.queue();
      post.startPublishing();
      post.markPublished({
        platformPostId: 'ig_12345',
        publishedUrl: 'https://instagram.com/p/12345',
      });

      expect(post.status).toBe('published');
      expect(post.platformPostId).toBe('ig_12345');
      expect(post.publishedAt).toBeDefined();
    });

    it('should follow valid state machine: publishing → failed', () => {
      const post = ScheduledPost.create({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
      });

      post.queue();
      post.startPublishing();
      post.markFailed({
        errorCode: 'RATE_LIMIT',
        errorMessage: 'Too many requests',
        retryable: true,
      });

      expect(post.status).toBe('failed');
      expect(post.failureReason).toBeDefined();
    });

    it('should reject invalid state transitions', () => {
      const post = ScheduledPost.create({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
      });

      // Cannot go directly from scheduled to published
      expect(() => post.markPublished({
        platformPostId: 'ig_12345',
        publishedUrl: 'https://instagram.com/p/12345',
      })).toThrow('Invalid state transition');
    });
  });

  describe('reschedule', () => {
    it('should reschedule post to new time', () => {
      const post = ScheduledPost.create({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
      });

      const newTime = new Date('2025-01-21T14:00:00Z');
      post.reschedule(newTime, 'Optimal engagement time');

      expect(post.scheduledTime).toEqual(newTime);
      expect(post.rescheduleHistory).toHaveLength(1);
      expect(post.rescheduleHistory[0].reason).toBe('Optimal engagement time');
    });

    it('should not reschedule published post', () => {
      const post = ScheduledPost.create({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
      });

      post.queue();
      post.startPublishing();
      post.markPublished({
        platformPostId: 'ig_12345',
        publishedUrl: 'https://instagram.com/p/12345',
      });

      expect(() => post.reschedule(new Date())).toThrow('Cannot reschedule published post');
    });
  });
});

describe('Calendar', () => {
  let db: any;
  let repo: CalendarRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    repo = new CalendarRepository(db);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('slot generation', () => {
    it('should generate slots for date range', async () => {
      const calendar = new Calendar(repo, 'client-123');

      const slots = await calendar.generateSlots({
        startDate: new Date('2025-01-20'),
        endDate: new Date('2025-01-21'),
        platform: 'instagram',
        slotDurationMinutes: 30,
        slotsPerDay: 4,
        preferredTimes: ['09:00', '12:00', '17:00', '20:00'],
        timezone: 'America/New_York',
      });

      expect(slots).toHaveLength(8); // 4 slots × 2 days
      expect(slots[0].startTime.getUTCHours()).toBe(14); // 9 AM EST = 14:00 UTC
    });

    it('should respect existing slots when generating', async () => {
      const calendar = new Calendar(repo, 'client-123');

      // Create existing slot
      await repo.createSlot({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T14:00:00Z'),
        endTime: new Date('2025-01-20T14:30:00Z'),
        platform: 'instagram',
        status: 'available',
      });

      const slots = await calendar.generateSlots({
        startDate: new Date('2025-01-20'),
        endDate: new Date('2025-01-20'),
        platform: 'instagram',
        slotDurationMinutes: 30,
        slotsPerDay: 1,
        preferredTimes: ['09:00'],
        timezone: 'America/New_York',
        skipExisting: true,
      });

      expect(slots).toHaveLength(0); // Slot already exists
    });
  });

  describe('availability', () => {
    it('should find available slots for platform', async () => {
      const calendar = new Calendar(repo, 'client-123');

      // Create test slots
      await repo.createSlot({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
        status: 'available',
      });
      await repo.createSlot({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T11:00:00Z'),
        endTime: new Date('2025-01-20T11:30:00Z'),
        platform: 'instagram',
        status: 'reserved',
      });

      const available = await calendar.findAvailableSlots({
        platform: 'instagram',
        startDate: new Date('2025-01-20'),
        endDate: new Date('2025-01-21'),
      });

      expect(available).toHaveLength(1);
      expect(available[0].status).toBe('available');
    });

    it('should find next available slot', async () => {
      const calendar = new Calendar(repo, 'client-123');

      await repo.createSlot({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
        status: 'reserved',
      });
      await repo.createSlot({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T11:00:00Z'),
        endTime: new Date('2025-01-20T11:30:00Z'),
        platform: 'instagram',
        status: 'available',
      });

      const next = await calendar.findNextAvailable('instagram');

      expect(next).toBeDefined();
      expect(next!.startTime).toEqual(new Date('2025-01-20T11:00:00Z'));
    });
  });

  describe('scheduling', () => {
    it('should schedule post to available slot', async () => {
      const calendar = new Calendar(repo, 'client-123');

      const slot = await repo.createSlot({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
        status: 'available',
      });

      const post = await calendar.schedulePost({
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        slotId: slot.id,
        content: {
          caption: 'Test post',
          mediaUrls: ['https://cdn.example.com/image.jpg'],
        },
      });

      expect(post.status).toBe('scheduled');
      expect(post.scheduledTime).toEqual(slot.startTime);

      const updatedSlot = await repo.getSlot(slot.id);
      expect(updatedSlot!.status).toBe('reserved');
      expect(updatedSlot!.reservedForPostId).toBe(post.id);
    });

    it('should auto-select best slot when not specified', async () => {
      const calendar = new Calendar(repo, 'client-123');

      // Create multiple available slots
      await repo.createSlot({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
        status: 'available',
        score: 0.7,
      });
      await repo.createSlot({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T14:00:00Z'),
        endTime: new Date('2025-01-20T14:30:00Z'),
        platform: 'instagram',
        status: 'available',
        score: 0.9, // Higher engagement score
      });

      const post = await calendar.schedulePost({
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        content: { caption: 'Test', mediaUrls: [] },
        autoSelectBestSlot: true,
      });

      // Should select the 14:00 slot with higher score
      expect(post.scheduledTime.getUTCHours()).toBe(14);
    });
  });

  describe('tenant isolation', () => {
    it('should only return slots for specified client', async () => {
      const calendar1 = new Calendar(repo, 'client-123');
      const calendar2 = new Calendar(repo, 'client-456');

      await repo.createSlot({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
        status: 'available',
      });
      await repo.createSlot({
        clientId: 'client-456',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
        status: 'available',
      });

      const slots1 = await calendar1.findAvailableSlots({
        platform: 'instagram',
        startDate: new Date('2025-01-20'),
        endDate: new Date('2025-01-21'),
      });

      const slots2 = await calendar2.findAvailableSlots({
        platform: 'instagram',
        startDate: new Date('2025-01-20'),
        endDate: new Date('2025-01-21'),
      });

      expect(slots1).toHaveLength(1);
      expect(slots1[0].clientId).toBe('client-123');
      expect(slots2).toHaveLength(1);
      expect(slots2[0].clientId).toBe('client-456');
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Define Calendar Schemas

Create `packages/calendar/src/schemas.ts`:

```typescript
import { z } from 'zod';

// Platforms
export const PlatformSchema = z.enum([
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'x',
  'skool',
]);

export type Platform = z.infer<typeof PlatformSchema>;

// Post types
export const PostTypeSchema = z.enum([
  'feed',
  'story',
  'reel',
  'video',
  'short',
  'article',
  'thread',
  'document',
]);

export type PostType = z.infer<typeof PostTypeSchema>;

// Slot status
export const SlotStatusSchema = z.enum([
  'available',
  'reserved',
  'executed',
  'cancelled',
]);

export type SlotStatus = z.infer<typeof SlotStatusSchema>;

// Post status
export const PostStatusSchema = z.enum([
  'draft',
  'scheduled',
  'queued',
  'publishing',
  'published',
  'failed',
  'cancelled',
]);

export type PostStatus = z.infer<typeof PostStatusSchema>;

// Calendar slot
export const CalendarSlotSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  platform: PlatformSchema,
  status: SlotStatusSchema,
  reservedForPostId: z.string().uuid().nullable(),
  score: z.number().min(0).max(1).optional(),
  platformMetadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type CalendarSlotRow = z.infer<typeof CalendarSlotSchema>;

// Post content
export const PostContentSchema = z.object({
  caption: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  mediaUrls: z.array(z.string().url()),
  thumbnailUrl: z.string().url().optional(),
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  link: z.string().url().optional(),
  cta: z.string().optional(),
  altText: z.string().optional(),
  platformSpecific: z.record(z.unknown()).optional(),
});

export type PostContent = z.infer<typeof PostContentSchema>;

// Scheduled post
export const ScheduledPostSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string(),
  contentBriefId: z.string().uuid(),
  platform: PlatformSchema,
  postType: PostTypeSchema,
  status: PostStatusSchema,
  scheduledTime: z.coerce.date(),
  slotId: z.string().uuid().nullable(),
  content: PostContentSchema,
  platformPostId: z.string().nullable(),
  publishedUrl: z.string().url().nullable(),
  publishedAt: z.coerce.date().nullable(),
  queuedAt: z.coerce.date().nullable(),
  publishingStartedAt: z.coerce.date().nullable(),
  failureReason: z.object({
    errorCode: z.string(),
    errorMessage: z.string(),
    retryable: z.boolean(),
    retryCount: z.number().optional(),
  }).nullable(),
  rescheduleHistory: z.array(z.object({
    previousTime: z.coerce.date(),
    newTime: z.coerce.date(),
    reason: z.string(),
    changedAt: z.coerce.date(),
  })),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ScheduledPostRow = z.infer<typeof ScheduledPostSchema>;

// Slot generation options
export const SlotGenerationOptionsSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  platform: PlatformSchema,
  slotDurationMinutes: z.number().min(5).max(120).default(30),
  slotsPerDay: z.number().min(1).max(24).default(4),
  preferredTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)),
  timezone: z.string().default('UTC'),
  skipExisting: z.boolean().default(true),
  skipWeekends: z.boolean().default(false),
  excludeDates: z.array(z.coerce.date()).optional(),
});

export type SlotGenerationOptions = z.infer<typeof SlotGenerationOptionsSchema>;

// Schedule post options
export const SchedulePostOptionsSchema = z.object({
  contentBriefId: z.string().uuid(),
  platform: PlatformSchema,
  postType: PostTypeSchema,
  slotId: z.string().uuid().optional(),
  scheduledTime: z.coerce.date().optional(),
  content: PostContentSchema,
  autoSelectBestSlot: z.boolean().default(false),
  preferredTimeRange: z.object({
    start: z.coerce.date(),
    end: z.coerce.date(),
  }).optional(),
});

export type SchedulePostOptions = z.infer<typeof SchedulePostOptionsSchema>;
```

#### Step 2: Implement CalendarSlot Model

Create `packages/calendar/src/models/calendar-slot.ts`:

```typescript
import { nanoid } from 'nanoid';
import { DateTime } from 'luxon';
import { CalendarSlotRow, SlotStatus, Platform } from '../schemas';

export interface CreateSlotInput {
  clientId: string;
  startTime: Date;
  endTime: Date;
  platform: Platform;
  status?: SlotStatus;
  score?: number;
  platformMetadata?: Record<string, unknown>;
  minDurationMinutes?: number;
}

export class CalendarSlot {
  readonly id: string;
  readonly clientId: string;
  readonly platform: Platform;
  readonly platformMetadata?: Record<string, unknown>;
  readonly createdAt: Date;

  private _startTime: Date;
  private _endTime: Date;
  private _status: SlotStatus;
  private _reservedForPostId: string | null;
  private _score?: number;
  private _updatedAt: Date;

  private constructor(data: CalendarSlotRow) {
    this.id = data.id;
    this.clientId = data.clientId;
    this.platform = data.platform;
    this.platformMetadata = data.platformMetadata;
    this.createdAt = data.createdAt;

    this._startTime = data.startTime;
    this._endTime = data.endTime;
    this._status = data.status;
    this._reservedForPostId = data.reservedForPostId;
    this._score = data.score;
    this._updatedAt = data.updatedAt;
  }

  static create(input: CreateSlotInput): CalendarSlot {
    const now = new Date();

    // Validate time range
    if (input.endTime <= input.startTime) {
      throw new Error('End time must be after start time');
    }

    // Validate minimum duration
    const durationMinutes = (input.endTime.getTime() - input.startTime.getTime()) / 60000;
    const minDuration = input.minDurationMinutes || 5;
    if (durationMinutes < minDuration) {
      throw new Error(`Slot duration below minimum of ${minDuration} minutes`);
    }

    return new CalendarSlot({
      id: nanoid(),
      clientId: input.clientId,
      startTime: input.startTime,
      endTime: input.endTime,
      platform: input.platform,
      status: input.status || 'available',
      reservedForPostId: null,
      score: input.score,
      platformMetadata: input.platformMetadata,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromRow(row: CalendarSlotRow): CalendarSlot {
    return new CalendarSlot(row);
  }

  // Getters
  get startTime(): Date {
    return this._startTime;
  }

  get endTime(): Date {
    return this._endTime;
  }

  get status(): SlotStatus {
    return this._status;
  }

  get reservedForPostId(): string | null {
    return this._reservedForPostId;
  }

  get score(): number | undefined {
    return this._score;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get durationMinutes(): number {
    return (this._endTime.getTime() - this._startTime.getTime()) / 60000;
  }

  // Methods
  reserve(postId: string): void {
    if (this._status !== 'available') {
      throw new Error('Slot already reserved');
    }

    this._status = 'reserved';
    this._reservedForPostId = postId;
    this._updatedAt = new Date();
  }

  release(): void {
    if (this._status === 'executed') {
      throw new Error('Cannot release executed slot');
    }

    this._status = 'available';
    this._reservedForPostId = null;
    this._updatedAt = new Date();
  }

  markExecuted(): void {
    if (this._status !== 'reserved') {
      throw new Error('Can only execute reserved slots');
    }

    this._status = 'executed';
    this._updatedAt = new Date();
  }

  cancel(): void {
    if (this._status === 'executed') {
      throw new Error('Cannot cancel executed slot');
    }

    this._status = 'cancelled';
    this._updatedAt = new Date();
  }

  toTimezone(timezone: string): { startTime: Date; endTime: Date } {
    const start = DateTime.fromJSDate(this._startTime, { zone: 'utc' })
      .setZone(timezone);
    const end = DateTime.fromJSDate(this._endTime, { zone: 'utc' })
      .setZone(timezone);

    return {
      startTime: start.toJSDate(),
      endTime: end.toJSDate(),
    };
  }

  toRow(): CalendarSlotRow {
    return {
      id: this.id,
      clientId: this.clientId,
      startTime: this._startTime,
      endTime: this._endTime,
      platform: this.platform,
      status: this._status,
      reservedForPostId: this._reservedForPostId,
      score: this._score,
      platformMetadata: this.platformMetadata,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
```

#### Step 3: Implement ScheduledPost Model

Create `packages/calendar/src/models/scheduled-post.ts`:

```typescript
import { nanoid } from 'nanoid';
import {
  ScheduledPostRow,
  PostStatus,
  Platform,
  PostType,
  PostContent,
} from '../schemas';

// Valid state transitions
const VALID_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['queued', 'cancelled'],
  queued: ['publishing', 'cancelled'],
  publishing: ['published', 'failed'],
  published: [],
  failed: ['scheduled', 'cancelled'],
  cancelled: [],
};

// Platform-specific required fields
const PLATFORM_REQUIREMENTS: Record<string, Record<string, string[]>> = {
  youtube: {
    video: ['title'],
    short: ['title'],
  },
  linkedin: {
    article: ['title'],
    document: ['title'],
  },
};

export interface CreateScheduledPostInput {
  clientId: string;
  contentBriefId: string;
  platform: Platform;
  postType: PostType;
  scheduledTime: Date;
  slotId?: string;
  content?: Partial<PostContent>;
}

export interface PublishResult {
  platformPostId: string;
  publishedUrl: string;
}

export interface FailureResult {
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
}

export class ScheduledPost {
  readonly id: string;
  readonly clientId: string;
  readonly contentBriefId: string;
  readonly platform: Platform;
  readonly postType: PostType;
  readonly createdAt: Date;

  private _status: PostStatus;
  private _scheduledTime: Date;
  private _slotId: string | null;
  private _content: PostContent;
  private _platformPostId: string | null;
  private _publishedUrl: string | null;
  private _publishedAt: Date | null;
  private _queuedAt: Date | null;
  private _publishingStartedAt: Date | null;
  private _failureReason: ScheduledPostRow['failureReason'];
  private _rescheduleHistory: ScheduledPostRow['rescheduleHistory'];
  private _metadata?: Record<string, unknown>;
  private _updatedAt: Date;

  private constructor(data: ScheduledPostRow) {
    this.id = data.id;
    this.clientId = data.clientId;
    this.contentBriefId = data.contentBriefId;
    this.platform = data.platform;
    this.postType = data.postType;
    this.createdAt = data.createdAt;

    this._status = data.status;
    this._scheduledTime = data.scheduledTime;
    this._slotId = data.slotId;
    this._content = data.content;
    this._platformPostId = data.platformPostId;
    this._publishedUrl = data.publishedUrl;
    this._publishedAt = data.publishedAt;
    this._queuedAt = data.queuedAt;
    this._publishingStartedAt = data.publishingStartedAt;
    this._failureReason = data.failureReason;
    this._rescheduleHistory = data.rescheduleHistory;
    this._metadata = data.metadata;
    this._updatedAt = data.updatedAt;
  }

  static create(input: CreateScheduledPostInput): ScheduledPost {
    const now = new Date();

    const content: PostContent = {
      mediaUrls: [],
      ...input.content,
    };

    // Validate platform-specific requirements
    const requirements = PLATFORM_REQUIREMENTS[input.platform]?.[input.postType];
    if (requirements) {
      for (const field of requirements) {
        if (!content[field as keyof PostContent]) {
          throw new Error(
            `${input.platform} ${input.postType} requires ${field}`
          );
        }
      }
    }

    return new ScheduledPost({
      id: nanoid(),
      clientId: input.clientId,
      contentBriefId: input.contentBriefId,
      platform: input.platform,
      postType: input.postType,
      status: 'scheduled',
      scheduledTime: input.scheduledTime,
      slotId: input.slotId || null,
      content,
      platformPostId: null,
      publishedUrl: null,
      publishedAt: null,
      queuedAt: null,
      publishingStartedAt: null,
      failureReason: null,
      rescheduleHistory: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromRow(row: ScheduledPostRow): ScheduledPost {
    return new ScheduledPost(row);
  }

  // Getters
  get status(): PostStatus {
    return this._status;
  }

  get scheduledTime(): Date {
    return this._scheduledTime;
  }

  get slotId(): string | null {
    return this._slotId;
  }

  get content(): PostContent {
    return this._content;
  }

  get platformPostId(): string | null {
    return this._platformPostId;
  }

  get publishedUrl(): string | null {
    return this._publishedUrl;
  }

  get publishedAt(): Date | null {
    return this._publishedAt;
  }

  get queuedAt(): Date | null {
    return this._queuedAt;
  }

  get publishingStartedAt(): Date | null {
    return this._publishingStartedAt;
  }

  get failureReason(): ScheduledPostRow['failureReason'] {
    return this._failureReason;
  }

  get rescheduleHistory(): ScheduledPostRow['rescheduleHistory'] {
    return [...this._rescheduleHistory];
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // State transitions
  private transition(newStatus: PostStatus): void {
    const allowed = VALID_TRANSITIONS[this._status];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid state transition: ${this._status} → ${newStatus}`
      );
    }
    this._status = newStatus;
    this._updatedAt = new Date();
  }

  queue(): void {
    this.transition('queued');
    this._queuedAt = new Date();
  }

  startPublishing(): void {
    this.transition('publishing');
    this._publishingStartedAt = new Date();
  }

  markPublished(result: PublishResult): void {
    this.transition('published');
    this._platformPostId = result.platformPostId;
    this._publishedUrl = result.publishedUrl;
    this._publishedAt = new Date();
  }

  markFailed(failure: FailureResult): void {
    this.transition('failed');
    this._failureReason = {
      ...failure,
      retryCount: (this._failureReason?.retryCount || 0) + 1,
    };
  }

  cancel(): void {
    this.transition('cancelled');
  }

  reschedule(newTime: Date, reason: string): void {
    if (this._status === 'published' || this._status === 'cancelled') {
      throw new Error(`Cannot reschedule ${this._status} post`);
    }

    this._rescheduleHistory.push({
      previousTime: this._scheduledTime,
      newTime,
      reason,
      changedAt: new Date(),
    });

    this._scheduledTime = newTime;
    this._updatedAt = new Date();

    // Reset to scheduled if was failed
    if (this._status === 'failed') {
      this._status = 'scheduled';
      this._failureReason = null;
    }
  }

  updateContent(content: Partial<PostContent>): void {
    if (this._status !== 'draft' && this._status !== 'scheduled') {
      throw new Error('Can only update content in draft or scheduled status');
    }

    this._content = {
      ...this._content,
      ...content,
    };
    this._updatedAt = new Date();
  }

  setSlot(slotId: string): void {
    this._slotId = slotId;
    this._updatedAt = new Date();
  }

  toRow(): ScheduledPostRow {
    return {
      id: this.id,
      clientId: this.clientId,
      contentBriefId: this.contentBriefId,
      platform: this.platform,
      postType: this.postType,
      status: this._status,
      scheduledTime: this._scheduledTime,
      slotId: this._slotId,
      content: this._content,
      platformPostId: this._platformPostId,
      publishedUrl: this._publishedUrl,
      publishedAt: this._publishedAt,
      queuedAt: this._queuedAt,
      publishingStartedAt: this._publishingStartedAt,
      failureReason: this._failureReason,
      rescheduleHistory: this._rescheduleHistory,
      metadata: this._metadata,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
```

#### Step 4: Implement Calendar Repository

Create `packages/calendar/src/repository.ts`:

```typescript
import { Database } from '@rtv/database';
import { CalendarSlotRow, ScheduledPostRow, Platform, SlotStatus } from './schemas';

export interface CreateSlotInput {
  clientId: string;
  startTime: Date;
  endTime: Date;
  platform: Platform;
  status: SlotStatus;
  score?: number;
  platformMetadata?: Record<string, unknown>;
}

export interface SlotQuery {
  clientId: string;
  platform?: Platform;
  status?: SlotStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface PostQuery {
  clientId: string;
  platform?: Platform;
  status?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export class CalendarRepository {
  constructor(private db: Database) {}

  // Slot operations
  async createSlot(input: CreateSlotInput): Promise<CalendarSlotRow> {
    const [row] = await this.db
      .insertInto('calendar_slots')
      .values({
        client_id: input.clientId,
        start_time: input.startTime,
        end_time: input.endTime,
        platform: input.platform,
        status: input.status,
        score: input.score,
        platform_metadata: input.platformMetadata ? JSON.stringify(input.platformMetadata) : null,
      })
      .returning('*')
      .execute();

    return this.mapSlotRow(row);
  }

  async getSlot(id: string): Promise<CalendarSlotRow | null> {
    const row = await this.db
      .selectFrom('calendar_slots')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapSlotRow(row) : null;
  }

  async updateSlot(
    id: string,
    updates: Partial<Pick<CalendarSlotRow, 'status' | 'reservedForPostId'>>
  ): Promise<CalendarSlotRow> {
    const [row] = await this.db
      .updateTable('calendar_slots')
      .set({
        status: updates.status,
        reserved_for_post_id: updates.reservedForPostId,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returning('*')
      .execute();

    return this.mapSlotRow(row);
  }

  async querySlots(query: SlotQuery): Promise<CalendarSlotRow[]> {
    let qb = this.db
      .selectFrom('calendar_slots')
      .selectAll()
      .where('client_id', '=', query.clientId);

    if (query.platform) {
      qb = qb.where('platform', '=', query.platform);
    }

    if (query.status) {
      qb = qb.where('status', '=', query.status);
    }

    if (query.startDate) {
      qb = qb.where('start_time', '>=', query.startDate);
    }

    if (query.endDate) {
      qb = qb.where('end_time', '<=', query.endDate);
    }

    qb = qb.orderBy('start_time', 'asc');

    if (query.limit) {
      qb = qb.limit(query.limit);
    }

    const rows = await qb.execute();
    return rows.map(this.mapSlotRow);
  }

  async findOverlappingSlots(
    clientId: string,
    platform: Platform,
    startTime: Date,
    endTime: Date
  ): Promise<CalendarSlotRow[]> {
    const rows = await this.db
      .selectFrom('calendar_slots')
      .selectAll()
      .where('client_id', '=', clientId)
      .where('platform', '=', platform)
      .where('status', '!=', 'cancelled')
      .where((eb) =>
        eb.or([
          // New slot starts during existing slot
          eb.and([
            eb('start_time', '<=', startTime),
            eb('end_time', '>', startTime),
          ]),
          // New slot ends during existing slot
          eb.and([
            eb('start_time', '<', endTime),
            eb('end_time', '>=', endTime),
          ]),
          // New slot contains existing slot
          eb.and([
            eb('start_time', '>=', startTime),
            eb('end_time', '<=', endTime),
          ]),
        ])
      )
      .execute();

    return rows.map(this.mapSlotRow);
  }

  // Post operations
  async createPost(input: ScheduledPostRow): Promise<ScheduledPostRow> {
    const [row] = await this.db
      .insertInto('scheduled_posts')
      .values({
        id: input.id,
        client_id: input.clientId,
        content_brief_id: input.contentBriefId,
        platform: input.platform,
        post_type: input.postType,
        status: input.status,
        scheduled_time: input.scheduledTime,
        slot_id: input.slotId,
        content: JSON.stringify(input.content),
        platform_post_id: input.platformPostId,
        published_url: input.publishedUrl,
        published_at: input.publishedAt,
        queued_at: input.queuedAt,
        publishing_started_at: input.publishingStartedAt,
        failure_reason: input.failureReason ? JSON.stringify(input.failureReason) : null,
        reschedule_history: JSON.stringify(input.rescheduleHistory),
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })
      .returning('*')
      .execute();

    return this.mapPostRow(row);
  }

  async getPost(id: string): Promise<ScheduledPostRow | null> {
    const row = await this.db
      .selectFrom('scheduled_posts')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapPostRow(row) : null;
  }

  async updatePost(id: string, updates: Partial<ScheduledPostRow>): Promise<ScheduledPostRow> {
    const dbUpdates: any = { updated_at: new Date() };

    if (updates.status) dbUpdates.status = updates.status;
    if (updates.scheduledTime) dbUpdates.scheduled_time = updates.scheduledTime;
    if (updates.slotId !== undefined) dbUpdates.slot_id = updates.slotId;
    if (updates.content) dbUpdates.content = JSON.stringify(updates.content);
    if (updates.platformPostId !== undefined) dbUpdates.platform_post_id = updates.platformPostId;
    if (updates.publishedUrl !== undefined) dbUpdates.published_url = updates.publishedUrl;
    if (updates.publishedAt !== undefined) dbUpdates.published_at = updates.publishedAt;
    if (updates.queuedAt !== undefined) dbUpdates.queued_at = updates.queuedAt;
    if (updates.publishingStartedAt !== undefined) dbUpdates.publishing_started_at = updates.publishingStartedAt;
    if (updates.failureReason !== undefined) {
      dbUpdates.failure_reason = updates.failureReason ? JSON.stringify(updates.failureReason) : null;
    }
    if (updates.rescheduleHistory) {
      dbUpdates.reschedule_history = JSON.stringify(updates.rescheduleHistory);
    }

    const [row] = await this.db
      .updateTable('scheduled_posts')
      .set(dbUpdates)
      .where('id', '=', id)
      .returning('*')
      .execute();

    return this.mapPostRow(row);
  }

  async queryPosts(query: PostQuery): Promise<ScheduledPostRow[]> {
    let qb = this.db
      .selectFrom('scheduled_posts')
      .selectAll()
      .where('client_id', '=', query.clientId);

    if (query.platform) {
      qb = qb.where('platform', '=', query.platform);
    }

    if (query.status && query.status.length > 0) {
      qb = qb.where('status', 'in', query.status);
    }

    if (query.startDate) {
      qb = qb.where('scheduled_time', '>=', query.startDate);
    }

    if (query.endDate) {
      qb = qb.where('scheduled_time', '<=', query.endDate);
    }

    qb = qb.orderBy('scheduled_time', 'asc');

    if (query.limit) {
      qb = qb.limit(query.limit);
    }

    const rows = await qb.execute();
    return rows.map(this.mapPostRow);
  }

  // Helpers
  private mapSlotRow(row: any): CalendarSlotRow {
    return {
      id: row.id,
      clientId: row.client_id,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      platform: row.platform,
      status: row.status,
      reservedForPostId: row.reserved_for_post_id,
      score: row.score,
      platformMetadata: row.platform_metadata ? JSON.parse(row.platform_metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapPostRow(row: any): ScheduledPostRow {
    return {
      id: row.id,
      clientId: row.client_id,
      contentBriefId: row.content_brief_id,
      platform: row.platform,
      postType: row.post_type,
      status: row.status,
      scheduledTime: new Date(row.scheduled_time),
      slotId: row.slot_id,
      content: JSON.parse(row.content),
      platformPostId: row.platform_post_id,
      publishedUrl: row.published_url,
      publishedAt: row.published_at ? new Date(row.published_at) : null,
      queuedAt: row.queued_at ? new Date(row.queued_at) : null,
      publishingStartedAt: row.publishing_started_at ? new Date(row.publishing_started_at) : null,
      failureReason: row.failure_reason ? JSON.parse(row.failure_reason) : null,
      rescheduleHistory: JSON.parse(row.reschedule_history),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
```

#### Step 5: Implement Calendar Service

Create `packages/calendar/src/calendar.ts`:

```typescript
import { DateTime } from 'luxon';
import { CalendarRepository } from './repository';
import { CalendarSlot } from './models/calendar-slot';
import { ScheduledPost } from './models/scheduled-post';
import {
  SlotGenerationOptions,
  SchedulePostOptions,
  Platform,
  CalendarSlotRow,
} from './schemas';

export class Calendar {
  constructor(
    private repo: CalendarRepository,
    private clientId: string
  ) {}

  // Slot generation
  async generateSlots(options: SlotGenerationOptions): Promise<CalendarSlot[]> {
    const slots: CalendarSlot[] = [];
    const { startDate, endDate, timezone, preferredTimes, slotDurationMinutes, skipExisting } = options;

    let currentDate = DateTime.fromJSDate(startDate, { zone: timezone });
    const end = DateTime.fromJSDate(endDate, { zone: timezone });

    while (currentDate <= end) {
      // Skip weekends if configured
      if (options.skipWeekends && (currentDate.weekday === 6 || currentDate.weekday === 7)) {
        currentDate = currentDate.plus({ days: 1 });
        continue;
      }

      // Skip excluded dates
      if (options.excludeDates?.some(d =>
        DateTime.fromJSDate(d).hasSame(currentDate, 'day')
      )) {
        currentDate = currentDate.plus({ days: 1 });
        continue;
      }

      // Generate slots for each preferred time
      for (const timeStr of preferredTimes) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const slotStart = currentDate.set({ hour: hours, minute: minutes, second: 0 });
        const slotEnd = slotStart.plus({ minutes: slotDurationMinutes });

        // Check if slot already exists
        if (skipExisting) {
          const existing = await this.repo.findOverlappingSlots(
            this.clientId,
            options.platform,
            slotStart.toJSDate(),
            slotEnd.toJSDate()
          );
          if (existing.length > 0) continue;
        }

        const slot = CalendarSlot.create({
          clientId: this.clientId,
          startTime: slotStart.toJSDate(),
          endTime: slotEnd.toJSDate(),
          platform: options.platform,
        });

        await this.repo.createSlot({
          clientId: slot.clientId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          platform: slot.platform,
          status: slot.status,
          score: slot.score,
        });

        slots.push(slot);
      }

      currentDate = currentDate.plus({ days: 1 });
    }

    return slots;
  }

  // Availability queries
  async findAvailableSlots(options: {
    platform: Platform;
    startDate: Date;
    endDate: Date;
  }): Promise<CalendarSlot[]> {
    const rows = await this.repo.querySlots({
      clientId: this.clientId,
      platform: options.platform,
      status: 'available',
      startDate: options.startDate,
      endDate: options.endDate,
    });

    return rows.map(CalendarSlot.fromRow);
  }

  async findNextAvailable(platform: Platform): Promise<CalendarSlot | null> {
    const rows = await this.repo.querySlots({
      clientId: this.clientId,
      platform,
      status: 'available',
      startDate: new Date(),
      limit: 1,
    });

    return rows.length > 0 ? CalendarSlot.fromRow(rows[0]) : null;
  }

  // Scheduling
  async schedulePost(options: SchedulePostOptions): Promise<ScheduledPost> {
    let slotRow: CalendarSlotRow | null = null;
    let scheduledTime: Date;

    if (options.slotId) {
      // Use specified slot
      slotRow = await this.repo.getSlot(options.slotId);
      if (!slotRow) throw new Error('Slot not found');
      if (slotRow.clientId !== this.clientId) throw new Error('Slot belongs to different client');
      if (slotRow.status !== 'available') throw new Error('Slot not available');
      scheduledTime = slotRow.startTime;
    } else if (options.autoSelectBestSlot) {
      // Auto-select best available slot
      const availableSlots = await this.repo.querySlots({
        clientId: this.clientId,
        platform: options.platform,
        status: 'available',
        startDate: options.preferredTimeRange?.start || new Date(),
        endDate: options.preferredTimeRange?.end,
      });

      if (availableSlots.length === 0) {
        throw new Error('No available slots found');
      }

      // Sort by score (highest first)
      availableSlots.sort((a, b) => (b.score || 0) - (a.score || 0));
      slotRow = availableSlots[0];
      scheduledTime = slotRow.startTime;
    } else if (options.scheduledTime) {
      // Use specified time without slot
      scheduledTime = options.scheduledTime;
    } else {
      throw new Error('Must specify slotId, scheduledTime, or autoSelectBestSlot');
    }

    // Create the post
    const post = ScheduledPost.create({
      clientId: this.clientId,
      contentBriefId: options.contentBriefId,
      platform: options.platform,
      postType: options.postType,
      scheduledTime,
      slotId: slotRow?.id,
      content: options.content,
    });

    await this.repo.createPost(post.toRow());

    // Reserve the slot if using one
    if (slotRow) {
      await this.repo.updateSlot(slotRow.id, {
        status: 'reserved',
        reservedForPostId: post.id,
      });
    }

    return post;
  }

  async reschedulePost(
    postId: string,
    newTime: Date,
    reason: string
  ): Promise<ScheduledPost> {
    const postRow = await this.repo.getPost(postId);
    if (!postRow) throw new Error('Post not found');
    if (postRow.clientId !== this.clientId) throw new Error('Post belongs to different client');

    const post = ScheduledPost.fromRow(postRow);

    // Release old slot if exists
    if (post.slotId) {
      await this.repo.updateSlot(post.slotId, {
        status: 'available',
        reservedForPostId: null,
      });
    }

    // Reschedule
    post.reschedule(newTime, reason);

    await this.repo.updatePost(postId, {
      scheduledTime: post.scheduledTime,
      status: post.status,
      slotId: null,
      rescheduleHistory: post.rescheduleHistory,
    });

    return post;
  }

  // Post queries
  async getScheduledPosts(options: {
    platform?: Platform;
    startDate?: Date;
    endDate?: Date;
    status?: string[];
  }): Promise<ScheduledPost[]> {
    const rows = await this.repo.queryPosts({
      clientId: this.clientId,
      ...options,
    });

    return rows.map(ScheduledPost.fromRow);
  }

  async getPost(postId: string): Promise<ScheduledPost | null> {
    const row = await this.repo.getPost(postId);
    if (!row) return null;
    if (row.clientId !== this.clientId) return null;
    return ScheduledPost.fromRow(row);
  }
}
```

#### Step 6: Export Module

Create `packages/calendar/src/index.ts`:

```typescript
export * from './schemas';
export * from './models/calendar-slot';
export * from './models/scheduled-post';
export * from './repository';
export * from './calendar';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/calendar
pnpm test

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/calendar/src/schemas.ts` | Type definitions |
| Create | `packages/calendar/src/models/calendar-slot.ts` | Slot model |
| Create | `packages/calendar/src/models/scheduled-post.ts` | Post model |
| Create | `packages/calendar/src/repository.ts` | Database operations |
| Create | `packages/calendar/src/calendar.ts` | Calendar service |
| Create | `packages/calendar/src/index.ts` | Module exports |
| Create | `packages/calendar/src/__tests__/calendar-model.test.ts` | Model tests |

---

## Acceptance Criteria

- [ ] CalendarSlot validates time ranges and minimum durations
- [ ] CalendarSlot handles timezone conversions correctly
- [ ] CalendarSlot state transitions follow valid paths
- [ ] ScheduledPost validates platform-specific requirements
- [ ] ScheduledPost state machine enforces valid transitions
- [ ] Calendar generates slots for date ranges with preferred times
- [ ] Calendar respects existing slots when generating
- [ ] Scheduling reserves slots atomically
- [ ] Auto-slot selection prioritizes by score
- [ ] All queries are tenant-scoped
- [ ] All tests pass

---

## Test Requirements

### Unit Tests
- Test slot creation and validation
- Test post state machine
- Test timezone handling

### Integration Tests
- Test slot generation with database
- Test scheduling flow
- Test tenant isolation

---

## Security & Safety Checklist

- [ ] All queries include client_id scope
- [ ] No cross-tenant data access possible
- [ ] Audit events for scheduling changes
- [ ] No hardcoded secrets

---

## JSON Task Block

```json
{
  "task_id": "S3-A1",
  "name": "Calendar Model",
  "status": "pending",
  "dependencies": ["S0-B2", "S0-B3", "S1-A1", "S2-A1"],
  "blocks": ["S3-A2", "S3-A3"],
  "created_at": "2025-01-16T00:00:00Z",
  "updated_at": "2025-01-16T00:00:00Z",
  "complexity": "high",
  "agent": "A",
  "sprint": 3,
  "package": "@rtv/calendar",
  "files": [
    "packages/calendar/src/schemas.ts",
    "packages/calendar/src/models/calendar-slot.ts",
    "packages/calendar/src/models/scheduled-post.ts",
    "packages/calendar/src/repository.ts",
    "packages/calendar/src/calendar.ts",
    "packages/calendar/src/index.ts"
  ],
  "test_files": [
    "packages/calendar/src/__tests__/calendar-model.test.ts"
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
  "token_budget": 10000,
  "tokens_used": 0,
  "context_refs": [
    "spec://docs/01-architecture/system-architecture-v3.md",
    "spec://docs/02-schemas/external-memory-schema.md"
  ],
  "summary_trigger": "on_complete",
  "write_permissions": [
    "packages/calendar/**"
  ],
  "read_permissions": [
    "packages/calendar/**",
    "packages/core/**",
    "docs/**"
  ],
  "predecessor_summaries": []
}
```
