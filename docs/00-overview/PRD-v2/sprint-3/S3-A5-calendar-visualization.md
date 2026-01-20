# Build Prompt: S3-A5 — Calendar Visualization API

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S3-A5 |
| Sprint | 3 - Scheduling + Publishing |
| Agent | A - Calendar System |
| Task Name | Calendar Visualization API |
| Complexity | Medium |
| Status | pending |
| Estimated Tokens | 6,000 |

---

## Context

### What We're Building

The Calendar Visualization API provides optimized endpoints for rendering calendar views in the UI. It aggregates slots, posts, and metrics into structured JSON suitable for day, week, and month views.

### Why It Matters

- **UI performance** — Pre-aggregated data for fast rendering
- **Multiple views** — Day, week, month at different granularities
- **Status overview** — Quick visibility into scheduling state
- **Cross-platform view** — See all platforms at once

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | API Layer | Response patterns |

---

## Prerequisites

### Completed Tasks

| Task ID | Provides |
|---------|----------|
| S3-A1 | Calendar model |
| S3-A2 | Scheduling API |
| S3-A4 | Conflict detection |

---

## Instructions

### Phase 1: Test First (TDD)

#### Test File: `packages/calendar/src/visualization/__tests__/calendar-visualization.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CalendarVisualization } from '../calendar-visualization';
import { CalendarRepository } from '../../repository';
import { createTestDatabase, cleanupTestDatabase } from '@rtv/testing';

describe('CalendarVisualization', () => {
  let db: any;
  let repo: CalendarRepository;
  let viz: CalendarVisualization;

  beforeEach(async () => {
    db = await createTestDatabase();
    repo = new CalendarRepository(db);
    viz = new CalendarVisualization(repo);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('getDayView', () => {
    it('should return hourly slots for a day', async () => {
      // Create test data
      await createTestSlots(repo, 'client-123', '2025-01-20', 'instagram', 5);
      await createTestPosts(repo, 'client-123', '2025-01-20', 'instagram', 3);

      const result = await viz.getDayView({
        clientId: 'client-123',
        date: new Date('2025-01-20'),
        timezone: 'America/New_York',
      });

      expect(result.date).toBe('2025-01-20');
      expect(result.hours).toHaveLength(24);
      expect(result.hours[0]).toMatchObject({
        hour: 0,
        slots: expect.any(Array),
        posts: expect.any(Array),
      });
      expect(result.summary.totalSlots).toBe(5);
      expect(result.summary.totalPosts).toBe(3);
    });

    it('should group by platform', async () => {
      await createTestSlots(repo, 'client-123', '2025-01-20', 'instagram', 3);
      await createTestSlots(repo, 'client-123', '2025-01-20', 'tiktok', 2);

      const result = await viz.getDayView({
        clientId: 'client-123',
        date: new Date('2025-01-20'),
        timezone: 'UTC',
        groupByPlatform: true,
      });

      expect(result.platforms).toHaveProperty('instagram');
      expect(result.platforms).toHaveProperty('tiktok');
      expect(result.platforms.instagram.totalSlots).toBe(3);
      expect(result.platforms.tiktok.totalSlots).toBe(2);
    });
  });

  describe('getWeekView', () => {
    it('should return daily summaries for a week', async () => {
      const weekStart = new Date('2025-01-20');

      // Create posts across the week
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        await createTestPosts(repo, 'client-123', date.toISOString().split('T')[0], 'instagram', 2);
      }

      const result = await viz.getWeekView({
        clientId: 'client-123',
        weekStart,
        timezone: 'UTC',
      });

      expect(result.days).toHaveLength(7);
      expect(result.summary.totalPosts).toBe(14);
      expect(result.days[0].date).toBe('2025-01-20');
    });

    it('should include status breakdown per day', async () => {
      await createPostWithStatus(repo, 'client-123', '2025-01-20', 'scheduled');
      await createPostWithStatus(repo, 'client-123', '2025-01-20', 'published');
      await createPostWithStatus(repo, 'client-123', '2025-01-20', 'failed');

      const result = await viz.getWeekView({
        clientId: 'client-123',
        weekStart: new Date('2025-01-20'),
        timezone: 'UTC',
      });

      expect(result.days[0].statusBreakdown).toEqual({
        scheduled: 1,
        published: 1,
        failed: 1,
        queued: 0,
        publishing: 0,
        cancelled: 0,
        draft: 0,
      });
    });
  });

  describe('getMonthView', () => {
    it('should return daily counts for a month', async () => {
      // Create posts on various days
      await createTestPosts(repo, 'client-123', '2025-01-05', 'instagram', 2);
      await createTestPosts(repo, 'client-123', '2025-01-15', 'instagram', 3);
      await createTestPosts(repo, 'client-123', '2025-01-25', 'instagram', 1);

      const result = await viz.getMonthView({
        clientId: 'client-123',
        year: 2025,
        month: 1,
        timezone: 'UTC',
      });

      expect(result.year).toBe(2025);
      expect(result.month).toBe(1);
      expect(result.days.length).toBeGreaterThanOrEqual(28);
      expect(result.summary.totalPosts).toBe(6);
    });

    it('should include platform breakdown', async () => {
      await createTestPosts(repo, 'client-123', '2025-01-15', 'instagram', 3);
      await createTestPosts(repo, 'client-123', '2025-01-15', 'tiktok', 2);

      const result = await viz.getMonthView({
        clientId: 'client-123',
        year: 2025,
        month: 1,
        timezone: 'UTC',
      });

      expect(result.summary.byPlatform.instagram).toBe(3);
      expect(result.summary.byPlatform.tiktok).toBe(2);
    });
  });

  describe('getUpcoming', () => {
    it('should return next N scheduled posts', async () => {
      const now = new Date();
      for (let i = 1; i <= 10; i++) {
        const date = new Date(now.getTime() + i * 3600000);
        await createPostAtTime(repo, 'client-123', date, 'instagram');
      }

      const result = await viz.getUpcoming({
        clientId: 'client-123',
        limit: 5,
      });

      expect(result.posts).toHaveLength(5);
      expect(result.posts[0].scheduledTime < result.posts[1].scheduledTime).toBe(true);
    });

    it('should filter by platform', async () => {
      const now = new Date();
      await createPostAtTime(repo, 'client-123', new Date(now.getTime() + 3600000), 'instagram');
      await createPostAtTime(repo, 'client-123', new Date(now.getTime() + 7200000), 'tiktok');

      const result = await viz.getUpcoming({
        clientId: 'client-123',
        platform: 'instagram',
        limit: 10,
      });

      expect(result.posts.every(p => p.platform === 'instagram')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return scheduling statistics', async () => {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 86400000);

      await createPostWithStatus(repo, 'client-123', dayAgo.toISOString().split('T')[0], 'published');
      await createPostWithStatus(repo, 'client-123', dayAgo.toISOString().split('T')[0], 'published');
      await createPostWithStatus(repo, 'client-123', dayAgo.toISOString().split('T')[0], 'failed');

      const result = await viz.getStats({
        clientId: 'client-123',
        startDate: dayAgo,
        endDate: now,
      });

      expect(result.totalScheduled).toBeGreaterThan(0);
      expect(result.totalPublished).toBe(2);
      expect(result.totalFailed).toBe(1);
      expect(result.successRate).toBeCloseTo(0.67, 1);
    });
  });
});

// Helper functions
async function createTestSlots(repo, clientId, date, platform, count) {
  for (let i = 0; i < count; i++) {
    await repo.createSlot({
      clientId,
      startTime: new Date(`${date}T${String(9 + i).padStart(2, '0')}:00:00Z`),
      endTime: new Date(`${date}T${String(9 + i).padStart(2, '0')}:30:00Z`),
      platform,
      status: 'available',
    });
  }
}

async function createTestPosts(repo, clientId, date, platform, count) {
  for (let i = 0; i < count; i++) {
    await repo.createPost({
      id: `post-${date}-${platform}-${i}`,
      clientId,
      contentBriefId: `brief-${i}`,
      platform,
      postType: 'feed',
      status: 'scheduled',
      scheduledTime: new Date(`${date}T${String(9 + i).padStart(2, '0')}:00:00Z`),
      slotId: null,
      content: { caption: 'Test', mediaUrls: [] },
      platformPostId: null,
      publishedUrl: null,
      publishedAt: null,
      queuedAt: null,
      publishingStartedAt: null,
      failureReason: null,
      rescheduleHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

async function createPostWithStatus(repo, clientId, date, status) {
  await repo.createPost({
    id: `post-${date}-${status}-${Math.random()}`,
    clientId,
    contentBriefId: `brief-${status}`,
    platform: 'instagram',
    postType: 'feed',
    status,
    scheduledTime: new Date(`${date}T10:00:00Z`),
    slotId: null,
    content: { caption: 'Test', mediaUrls: [] },
    platformPostId: status === 'published' ? 'ig_123' : null,
    publishedUrl: status === 'published' ? 'https://instagram.com/p/123' : null,
    publishedAt: status === 'published' ? new Date() : null,
    queuedAt: null,
    publishingStartedAt: null,
    failureReason: status === 'failed' ? { errorCode: 'TEST', errorMessage: 'Test', retryable: false } : null,
    rescheduleHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function createPostAtTime(repo, clientId, time, platform) {
  await repo.createPost({
    id: `post-${time.getTime()}`,
    clientId,
    contentBriefId: `brief-${time.getTime()}`,
    platform,
    postType: 'feed',
    status: 'scheduled',
    scheduledTime: time,
    slotId: null,
    content: { caption: 'Test', mediaUrls: [] },
    platformPostId: null,
    publishedUrl: null,
    publishedAt: null,
    queuedAt: null,
    publishingStartedAt: null,
    failureReason: null,
    rescheduleHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
```

### Phase 2: Implementation

#### Step 1: Define View Types

Create `packages/calendar/src/visualization/types.ts`:

```typescript
import { Platform, PostStatus } from '../schemas';

export interface HourSlot {
  hour: number;
  slots: Array<{
    id: string;
    startTime: string;
    endTime: string;
    platform: Platform;
    status: string;
    postId: string | null;
  }>;
  posts: Array<{
    id: string;
    scheduledTime: string;
    platform: Platform;
    postType: string;
    status: PostStatus;
    contentBriefId: string;
  }>;
}

export interface DayViewResult {
  date: string;
  timezone: string;
  hours: HourSlot[];
  platforms?: Record<string, {
    totalSlots: number;
    availableSlots: number;
    totalPosts: number;
  }>;
  summary: {
    totalSlots: number;
    availableSlots: number;
    totalPosts: number;
    statusBreakdown: Record<PostStatus, number>;
  };
}

export interface DaySummary {
  date: string;
  slotCount: number;
  postCount: number;
  statusBreakdown: Record<PostStatus, number>;
  platformBreakdown: Record<Platform, number>;
}

export interface WeekViewResult {
  weekStart: string;
  weekEnd: string;
  timezone: string;
  days: DaySummary[];
  summary: {
    totalSlots: number;
    totalPosts: number;
    byPlatform: Record<Platform, number>;
    byStatus: Record<PostStatus, number>;
  };
}

export interface MonthDaySummary {
  date: string;
  dayOfWeek: number;
  postCount: number;
  slotCount: number;
  hasConflicts: boolean;
}

export interface MonthViewResult {
  year: number;
  month: number;
  timezone: string;
  days: MonthDaySummary[];
  summary: {
    totalPosts: number;
    totalSlots: number;
    byPlatform: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

export interface UpcomingResult {
  posts: Array<{
    id: string;
    scheduledTime: string;
    platform: Platform;
    postType: string;
    status: PostStatus;
    content: {
      caption?: string;
      thumbnailUrl?: string;
    };
    timeUntil: string;
  }>;
  total: number;
}

export interface StatsResult {
  totalScheduled: number;
  totalPublished: number;
  totalFailed: number;
  totalCancelled: number;
  successRate: number;
  byPlatform: Record<string, {
    scheduled: number;
    published: number;
    failed: number;
  }>;
  avgPublishDelay: number;
}
```

#### Step 2: Implement Visualization Service

Create `packages/calendar/src/visualization/calendar-visualization.ts`:

```typescript
import { DateTime } from 'luxon';
import { CalendarRepository } from '../repository';
import { Platform, PostStatus } from '../schemas';
import {
  DayViewResult,
  WeekViewResult,
  MonthViewResult,
  UpcomingResult,
  StatsResult,
  HourSlot,
} from './types';

export interface DayViewOptions {
  clientId: string;
  date: Date;
  timezone: string;
  groupByPlatform?: boolean;
}

export interface WeekViewOptions {
  clientId: string;
  weekStart: Date;
  timezone: string;
}

export interface MonthViewOptions {
  clientId: string;
  year: number;
  month: number;
  timezone: string;
}

export interface UpcomingOptions {
  clientId: string;
  limit?: number;
  platform?: Platform;
}

export interface StatsOptions {
  clientId: string;
  startDate: Date;
  endDate: Date;
  platform?: Platform;
}

const ALL_STATUSES: PostStatus[] = [
  'draft', 'scheduled', 'queued', 'publishing', 'published', 'failed', 'cancelled'
];

export class CalendarVisualization {
  constructor(private repo: CalendarRepository) {}

  async getDayView(options: DayViewOptions): Promise<DayViewResult> {
    const dt = DateTime.fromJSDate(options.date, { zone: options.timezone });
    const startOfDay = dt.startOf('day').toJSDate();
    const endOfDay = dt.endOf('day').toJSDate();

    const [slots, posts] = await Promise.all([
      this.repo.querySlots({
        clientId: options.clientId,
        startDate: startOfDay,
        endDate: endOfDay,
      }),
      this.repo.queryPosts({
        clientId: options.clientId,
        startDate: startOfDay,
        endDate: endOfDay,
      }),
    ]);

    // Build hourly view
    const hours: HourSlot[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      slots: [],
      posts: [],
    }));

    for (const slot of slots) {
      const slotDt = DateTime.fromJSDate(slot.startTime, { zone: options.timezone });
      const hour = slotDt.hour;
      hours[hour].slots.push({
        id: slot.id,
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
        platform: slot.platform,
        status: slot.status,
        postId: slot.reservedForPostId,
      });
    }

    for (const post of posts) {
      const postDt = DateTime.fromJSDate(post.scheduledTime, { zone: options.timezone });
      const hour = postDt.hour;
      hours[hour].posts.push({
        id: post.id,
        scheduledTime: post.scheduledTime.toISOString(),
        platform: post.platform,
        postType: post.postType,
        status: post.status,
        contentBriefId: post.contentBriefId,
      });
    }

    // Calculate summary
    const statusBreakdown = this.countByStatus(posts);
    const availableSlots = slots.filter(s => s.status === 'available').length;

    const result: DayViewResult = {
      date: dt.toFormat('yyyy-MM-dd'),
      timezone: options.timezone,
      hours,
      summary: {
        totalSlots: slots.length,
        availableSlots,
        totalPosts: posts.length,
        statusBreakdown,
      },
    };

    // Group by platform if requested
    if (options.groupByPlatform) {
      result.platforms = this.groupByPlatform(slots, posts);
    }

    return result;
  }

  async getWeekView(options: WeekViewOptions): Promise<WeekViewResult> {
    const weekStart = DateTime.fromJSDate(options.weekStart, { zone: options.timezone })
      .startOf('week');
    const weekEnd = weekStart.plus({ days: 6 }).endOf('day');

    const [slots, posts] = await Promise.all([
      this.repo.querySlots({
        clientId: options.clientId,
        startDate: weekStart.toJSDate(),
        endDate: weekEnd.toJSDate(),
      }),
      this.repo.queryPosts({
        clientId: options.clientId,
        startDate: weekStart.toJSDate(),
        endDate: weekEnd.toJSDate(),
      }),
    ]);

    // Build daily summaries
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = weekStart.plus({ days: i });
      const dayStart = day.startOf('day');
      const dayEnd = day.endOf('day');

      const daySlots = slots.filter(s => {
        const st = DateTime.fromJSDate(s.startTime, { zone: options.timezone });
        return st >= dayStart && st <= dayEnd;
      });

      const dayPosts = posts.filter(p => {
        const pt = DateTime.fromJSDate(p.scheduledTime, { zone: options.timezone });
        return pt >= dayStart && pt <= dayEnd;
      });

      days.push({
        date: day.toFormat('yyyy-MM-dd'),
        slotCount: daySlots.length,
        postCount: dayPosts.length,
        statusBreakdown: this.countByStatus(dayPosts),
        platformBreakdown: this.countByPlatform(dayPosts),
      });
    }

    return {
      weekStart: weekStart.toFormat('yyyy-MM-dd'),
      weekEnd: weekEnd.toFormat('yyyy-MM-dd'),
      timezone: options.timezone,
      days,
      summary: {
        totalSlots: slots.length,
        totalPosts: posts.length,
        byPlatform: this.countByPlatform(posts),
        byStatus: this.countByStatus(posts),
      },
    };
  }

  async getMonthView(options: MonthViewOptions): Promise<MonthViewResult> {
    const monthStart = DateTime.fromObject(
      { year: options.year, month: options.month, day: 1 },
      { zone: options.timezone }
    );
    const monthEnd = monthStart.endOf('month');

    const [slots, posts] = await Promise.all([
      this.repo.querySlots({
        clientId: options.clientId,
        startDate: monthStart.toJSDate(),
        endDate: monthEnd.toJSDate(),
      }),
      this.repo.queryPosts({
        clientId: options.clientId,
        startDate: monthStart.toJSDate(),
        endDate: monthEnd.toJSDate(),
      }),
    ]);

    // Build daily summaries
    const days = [];
    let current = monthStart;
    while (current <= monthEnd) {
      const dayStart = current.startOf('day');
      const dayEnd = current.endOf('day');

      const daySlots = slots.filter(s => {
        const st = DateTime.fromJSDate(s.startTime, { zone: options.timezone });
        return st >= dayStart && st <= dayEnd;
      });

      const dayPosts = posts.filter(p => {
        const pt = DateTime.fromJSDate(p.scheduledTime, { zone: options.timezone });
        return pt >= dayStart && pt <= dayEnd;
      });

      days.push({
        date: current.toFormat('yyyy-MM-dd'),
        dayOfWeek: current.weekday,
        postCount: dayPosts.length,
        slotCount: daySlots.length,
        hasConflicts: this.hasConflicts(dayPosts),
      });

      current = current.plus({ days: 1 });
    }

    return {
      year: options.year,
      month: options.month,
      timezone: options.timezone,
      days,
      summary: {
        totalPosts: posts.length,
        totalSlots: slots.length,
        byPlatform: this.countByPlatform(posts),
        byStatus: this.countByStatus(posts),
      },
    };
  }

  async getUpcoming(options: UpcomingOptions): Promise<UpcomingResult> {
    const now = new Date();
    const posts = await this.repo.queryPosts({
      clientId: options.clientId,
      platform: options.platform,
      status: ['scheduled', 'queued'],
      startDate: now,
      limit: options.limit || 10,
    });

    return {
      posts: posts.map(p => ({
        id: p.id,
        scheduledTime: p.scheduledTime.toISOString(),
        platform: p.platform,
        postType: p.postType,
        status: p.status,
        content: {
          caption: p.content.caption,
          thumbnailUrl: p.content.thumbnailUrl,
        },
        timeUntil: this.formatTimeUntil(p.scheduledTime, now),
      })),
      total: posts.length,
    };
  }

  async getStats(options: StatsOptions): Promise<StatsResult> {
    const posts = await this.repo.queryPosts({
      clientId: options.clientId,
      platform: options.platform,
      startDate: options.startDate,
      endDate: options.endDate,
    });

    const published = posts.filter(p => p.status === 'published');
    const failed = posts.filter(p => p.status === 'failed');
    const cancelled = posts.filter(p => p.status === 'cancelled');

    // Calculate by platform
    const byPlatform: StatsResult['byPlatform'] = {};
    const platforms = [...new Set(posts.map(p => p.platform))];
    for (const platform of platforms) {
      const platformPosts = posts.filter(p => p.platform === platform);
      byPlatform[platform] = {
        scheduled: platformPosts.length,
        published: platformPosts.filter(p => p.status === 'published').length,
        failed: platformPosts.filter(p => p.status === 'failed').length,
      };
    }

    // Calculate average publish delay
    const delays = published
      .filter(p => p.publishedAt)
      .map(p => p.publishedAt!.getTime() - p.scheduledTime.getTime());
    const avgDelay = delays.length > 0
      ? delays.reduce((a, b) => a + b, 0) / delays.length
      : 0;

    const totalAttempted = published.length + failed.length;
    const successRate = totalAttempted > 0 ? published.length / totalAttempted : 0;

    return {
      totalScheduled: posts.length,
      totalPublished: published.length,
      totalFailed: failed.length,
      totalCancelled: cancelled.length,
      successRate,
      byPlatform,
      avgPublishDelay: avgDelay,
    };
  }

  private countByStatus(posts: any[]): Record<PostStatus, number> {
    const counts: Record<PostStatus, number> = {
      draft: 0,
      scheduled: 0,
      queued: 0,
      publishing: 0,
      published: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const post of posts) {
      if (counts[post.status as PostStatus] !== undefined) {
        counts[post.status as PostStatus]++;
      }
    }

    return counts;
  }

  private countByPlatform(posts: any[]): Record<Platform, number> {
    const counts: Record<string, number> = {};
    for (const post of posts) {
      counts[post.platform] = (counts[post.platform] || 0) + 1;
    }
    return counts as Record<Platform, number>;
  }

  private groupByPlatform(slots: any[], posts: any[]) {
    const platforms: Record<string, any> = {};

    for (const slot of slots) {
      if (!platforms[slot.platform]) {
        platforms[slot.platform] = { totalSlots: 0, availableSlots: 0, totalPosts: 0 };
      }
      platforms[slot.platform].totalSlots++;
      if (slot.status === 'available') {
        platforms[slot.platform].availableSlots++;
      }
    }

    for (const post of posts) {
      if (!platforms[post.platform]) {
        platforms[post.platform] = { totalSlots: 0, availableSlots: 0, totalPosts: 0 };
      }
      platforms[post.platform].totalPosts++;
    }

    return platforms;
  }

  private hasConflicts(posts: any[]): boolean {
    // Simple conflict check: multiple posts on same platform within 30 minutes
    for (let i = 0; i < posts.length; i++) {
      for (let j = i + 1; j < posts.length; j++) {
        if (posts[i].platform === posts[j].platform) {
          const diff = Math.abs(
            posts[i].scheduledTime.getTime() - posts[j].scheduledTime.getTime()
          );
          if (diff < 30 * 60 * 1000) return true;
        }
      }
    }
    return false;
  }

  private formatTimeUntil(target: Date, now: Date): string {
    const diff = target.getTime() - now.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
```

#### Step 3: Export Module

Create `packages/calendar/src/visualization/index.ts`:

```typescript
export * from './types';
export * from './calendar-visualization';
```

### Phase 3: Verification

```bash
cd packages/calendar
pnpm test src/visualization/
pnpm tsc --noEmit
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/calendar/src/visualization/types.ts` | View type definitions |
| Create | `packages/calendar/src/visualization/calendar-visualization.ts` | Visualization service |
| Create | `packages/calendar/src/visualization/index.ts` | Module exports |
| Create | `packages/calendar/src/visualization/__tests__/calendar-visualization.test.ts` | Tests |

---

## Acceptance Criteria

- [ ] Day view returns hourly breakdown
- [ ] Week view returns daily summaries
- [ ] Month view returns all days with counts
- [ ] Upcoming returns next scheduled posts
- [ ] Stats calculates success rate
- [ ] All views support timezone conversion
- [ ] All tests pass

---

## JSON Task Block

```json
{
  "task_id": "S3-A5",
  "name": "Calendar Visualization API",
  "status": "pending",
  "dependencies": ["S3-A1", "S3-A2", "S3-A4"],
  "blocks": [],
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
  "token_budget": 6000,
  "tokens_used": 0,
  "predecessor_summaries": [
    "S3-A1: Calendar model",
    "S3-A2: Scheduling API",
    "S3-A4: Conflict detection"
  ]
}
```
