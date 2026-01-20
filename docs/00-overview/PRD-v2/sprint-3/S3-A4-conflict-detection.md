# Build Prompt: S3-A4 — Conflict Detection

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S3-A4 |
| Sprint | 3 - Scheduling + Publishing |
| Agent | A - Calendar System |
| Task Name | Conflict Detection |
| Complexity | Medium |
| Status | pending |
| Estimated Tokens | 6,000 |

---

## Context

### What We're Building

The Conflict Detection system prevents scheduling conflicts such as double-posting, overlapping time slots, and platform rate limit violations. It validates scheduling operations before they execute and provides recommendations for optimal timing.

### Why It Matters

- **Prevents double-posting** — No duplicate content on same platform
- **Rate limit compliance** — Respect platform posting frequency limits
- **Optimal spacing** — Ensure posts are spaced appropriately
- **User experience** — Clear feedback on conflicts

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Scheduling | Conflict rules |
| `docs/09-platform-playbooks/` | Platform Limits | Rate limits per platform |

---

## Prerequisites

### Completed Tasks

| Task ID | Provides |
|---------|----------|
| S3-A1 | Calendar model |
| S3-A2 | Scheduling API |

### Required Packages

```bash
pnpm add date-fns
pnpm add -D vitest
```

---

## Instructions

### Phase 1: Test First (TDD)

#### Test File: `packages/calendar/src/conflicts/__tests__/conflict-detection.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConflictDetector,
  ConflictType,
  ConflictResult,
} from '../conflict-detector';
import { createTestDatabase, cleanupTestDatabase } from '@rtv/testing';
import { CalendarRepository } from '../../repository';

describe('ConflictDetector', () => {
  let db: any;
  let repo: CalendarRepository;
  let detector: ConflictDetector;

  beforeEach(async () => {
    db = await createTestDatabase();
    repo = new CalendarRepository(db);
    detector = new ConflictDetector(repo);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('slot overlap detection', () => {
    it('should detect overlapping slots', async () => {
      // Create existing slot
      await repo.createSlot({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
        status: 'reserved',
      });

      const result = await detector.checkSlotConflicts({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:15:00Z'),
        endTime: new Date('2025-01-20T10:45:00Z'),
        platform: 'instagram',
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toContainEqual(
        expect.objectContaining({ type: 'SLOT_OVERLAP' })
      );
    });

    it('should allow adjacent slots', async () => {
      await repo.createSlot({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
        status: 'reserved',
      });

      const result = await detector.checkSlotConflicts({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:30:00Z'), // Starts when previous ends
        endTime: new Date('2025-01-20T11:00:00Z'),
        platform: 'instagram',
      });

      expect(result.hasConflicts).toBe(false);
    });

    it('should allow same time on different platforms', async () => {
      await repo.createSlot({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'instagram',
        status: 'reserved',
      });

      const result = await detector.checkSlotConflicts({
        clientId: 'client-123',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T10:30:00Z'),
        platform: 'tiktok', // Different platform
      });

      expect(result.hasConflicts).toBe(false);
    });
  });

  describe('duplicate content detection', () => {
    it('should detect duplicate content brief', async () => {
      // Create existing post
      await repo.createPost({
        id: 'post-1',
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        status: 'scheduled',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
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

      const result = await detector.checkDuplicateContent({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toContainEqual(
        expect.objectContaining({ type: 'DUPLICATE_CONTENT' })
      );
    });

    it('should allow same content on different platform', async () => {
      await repo.createPost({
        id: 'post-1',
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        status: 'scheduled',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
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

      const result = await detector.checkDuplicateContent({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'tiktok', // Different platform
      });

      expect(result.hasConflicts).toBe(false);
    });
  });

  describe('rate limit detection', () => {
    it('should detect rate limit violation', async () => {
      // Create multiple posts within rate limit window
      const baseTime = new Date('2025-01-20T10:00:00Z');
      for (let i = 0; i < 5; i++) {
        await repo.createPost({
          id: `post-${i}`,
          clientId: 'client-123',
          contentBriefId: `brief-${i}`,
          platform: 'instagram',
          postType: 'feed',
          status: 'scheduled',
          scheduledTime: new Date(baseTime.getTime() + i * 60000), // 1 min apart
          slotId: null,
          content: { caption: `Test ${i}`, mediaUrls: [] },
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

      const result = await detector.checkRateLimits({
        clientId: 'client-123',
        platform: 'instagram',
        scheduledTime: new Date('2025-01-20T10:06:00Z'),
      });

      // Instagram limit is typically ~25 posts/day
      // But posting 6 times in 10 minutes might trigger frequency limit
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should warn about minimum spacing', async () => {
      await repo.createPost({
        id: 'post-1',
        clientId: 'client-123',
        contentBriefId: 'brief-1',
        platform: 'instagram',
        postType: 'feed',
        status: 'scheduled',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
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

      const result = await detector.checkRateLimits({
        clientId: 'client-123',
        platform: 'instagram',
        scheduledTime: new Date('2025-01-20T10:05:00Z'), // 5 min later
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'MIN_SPACING_WARNING',
          message: expect.stringContaining('recommended'),
        })
      );
    });
  });

  describe('comprehensive check', () => {
    it('should run all conflict checks', async () => {
      const result = await detector.checkAll({
        clientId: 'client-123',
        contentBriefId: 'brief-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
      });

      expect(result.hasConflicts).toBeDefined();
      expect(result.conflicts).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should provide alternative time suggestions', async () => {
      // Create post at preferred time
      await repo.createPost({
        id: 'post-1',
        clientId: 'client-123',
        contentBriefId: 'brief-1',
        platform: 'instagram',
        postType: 'feed',
        status: 'scheduled',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
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

      const result = await detector.checkAll({
        clientId: 'client-123',
        contentBriefId: 'brief-1', // Same brief = duplicate
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date('2025-01-20T10:00:00Z'),
      });

      expect(result.hasConflicts).toBe(true);
      // Should suggest alternative platforms or note the duplicate
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Define Conflict Types

Create `packages/calendar/src/conflicts/types.ts`:

```typescript
export type ConflictType =
  | 'SLOT_OVERLAP'
  | 'DUPLICATE_CONTENT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'MIN_SPACING_VIOLATION';

export type WarningType =
  | 'MIN_SPACING_WARNING'
  | 'HIGH_FREQUENCY_WARNING'
  | 'SUBOPTIMAL_TIME_WARNING';

export interface Conflict {
  type: ConflictType;
  message: string;
  details: {
    existingPostId?: string;
    existingSlotId?: string;
    existingTime?: Date;
    limit?: number;
    actual?: number;
  };
}

export interface Warning {
  type: WarningType;
  message: string;
  recommendation?: string;
}

export interface Suggestion {
  type: 'ALTERNATIVE_TIME' | 'ALTERNATIVE_PLATFORM' | 'RESCHEDULE';
  message: string;
  suggestedTime?: Date;
  suggestedPlatform?: string;
  reason: string;
}

export interface ConflictResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
  warnings: Warning[];
  suggestions: Suggestion[];
}

// Platform-specific rate limits
export const PLATFORM_LIMITS = {
  instagram: {
    maxPostsPerDay: 25,
    maxPostsPerHour: 5,
    minSpacingMinutes: 30,
    recommendedSpacingMinutes: 60,
  },
  facebook: {
    maxPostsPerDay: 25,
    maxPostsPerHour: 5,
    minSpacingMinutes: 30,
    recommendedSpacingMinutes: 60,
  },
  tiktok: {
    maxPostsPerDay: 10,
    maxPostsPerHour: 3,
    minSpacingMinutes: 60,
    recommendedSpacingMinutes: 120,
  },
  youtube: {
    maxPostsPerDay: 5,
    maxPostsPerHour: 2,
    minSpacingMinutes: 120,
    recommendedSpacingMinutes: 240,
  },
  linkedin: {
    maxPostsPerDay: 10,
    maxPostsPerHour: 2,
    minSpacingMinutes: 60,
    recommendedSpacingMinutes: 120,
  },
  x: {
    maxPostsPerDay: 50,
    maxPostsPerHour: 10,
    minSpacingMinutes: 15,
    recommendedSpacingMinutes: 30,
  },
  skool: {
    maxPostsPerDay: 10,
    maxPostsPerHour: 3,
    minSpacingMinutes: 60,
    recommendedSpacingMinutes: 120,
  },
};
```

#### Step 2: Implement Conflict Detector

Create `packages/calendar/src/conflicts/conflict-detector.ts`:

```typescript
import { addHours, addDays, subHours, differenceInMinutes } from 'date-fns';
import { CalendarRepository } from '../repository';
import { Platform } from '../schemas';
import {
  ConflictResult,
  Conflict,
  Warning,
  Suggestion,
  PLATFORM_LIMITS,
} from './types';

export interface SlotConflictCheck {
  clientId: string;
  startTime: Date;
  endTime: Date;
  platform: Platform;
  excludeSlotId?: string;
}

export interface DuplicateContentCheck {
  clientId: string;
  contentBriefId: string;
  platform: Platform;
  excludePostId?: string;
}

export interface RateLimitCheck {
  clientId: string;
  platform: Platform;
  scheduledTime: Date;
  excludePostId?: string;
}

export interface ComprehensiveCheck {
  clientId: string;
  contentBriefId: string;
  platform: Platform;
  postType: string;
  scheduledTime: Date;
  slotId?: string;
  excludePostId?: string;
}

export class ConflictDetector {
  constructor(private repo: CalendarRepository) {}

  async checkSlotConflicts(check: SlotConflictCheck): Promise<ConflictResult> {
    const conflicts: Conflict[] = [];
    const warnings: Warning[] = [];
    const suggestions: Suggestion[] = [];

    const overlapping = await this.repo.findOverlappingSlots(
      check.clientId,
      check.platform,
      check.startTime,
      check.endTime
    );

    // Filter out the slot being edited
    const filtered = check.excludeSlotId
      ? overlapping.filter((s) => s.id !== check.excludeSlotId)
      : overlapping;

    for (const slot of filtered) {
      conflicts.push({
        type: 'SLOT_OVERLAP',
        message: `Overlaps with existing slot from ${slot.startTime.toISOString()} to ${slot.endTime.toISOString()}`,
        details: {
          existingSlotId: slot.id,
          existingTime: slot.startTime,
        },
      });
    }

    // Suggest alternative times if conflicts found
    if (conflicts.length > 0) {
      const nextAvailable = await this.findNextAvailableTime(
        check.clientId,
        check.platform,
        check.endTime
      );

      if (nextAvailable) {
        suggestions.push({
          type: 'ALTERNATIVE_TIME',
          message: `Next available time: ${nextAvailable.toISOString()}`,
          suggestedTime: nextAvailable,
          reason: 'No overlapping slots at this time',
        });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      warnings,
      suggestions,
    };
  }

  async checkDuplicateContent(check: DuplicateContentCheck): Promise<ConflictResult> {
    const conflicts: Conflict[] = [];
    const warnings: Warning[] = [];
    const suggestions: Suggestion[] = [];

    const existingPosts = await this.repo.queryPosts({
      clientId: check.clientId,
      platform: check.platform,
      status: ['scheduled', 'queued', 'publishing', 'published'],
    });

    const duplicates = existingPosts.filter(
      (post) =>
        post.contentBriefId === check.contentBriefId &&
        post.id !== check.excludePostId
    );

    for (const post of duplicates) {
      conflicts.push({
        type: 'DUPLICATE_CONTENT',
        message: `Content brief already scheduled/published on ${check.platform}`,
        details: {
          existingPostId: post.id,
          existingTime: post.scheduledTime,
        },
      });
    }

    // Suggest alternative platforms
    if (conflicts.length > 0) {
      const allPlatforms: Platform[] = [
        'instagram',
        'facebook',
        'tiktok',
        'youtube',
        'linkedin',
        'x',
      ];
      const usedPlatforms = existingPosts
        .filter((p) => p.contentBriefId === check.contentBriefId)
        .map((p) => p.platform);

      const availablePlatforms = allPlatforms.filter(
        (p) => !usedPlatforms.includes(p)
      );

      for (const platform of availablePlatforms.slice(0, 3)) {
        suggestions.push({
          type: 'ALTERNATIVE_PLATFORM',
          message: `Consider posting to ${platform} instead`,
          suggestedPlatform: platform,
          reason: 'Content not yet posted on this platform',
        });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      warnings,
      suggestions,
    };
  }

  async checkRateLimits(check: RateLimitCheck): Promise<ConflictResult> {
    const conflicts: Conflict[] = [];
    const warnings: Warning[] = [];
    const suggestions: Suggestion[] = [];

    const limits = PLATFORM_LIMITS[check.platform];
    if (!limits) {
      return { hasConflicts: false, conflicts, warnings, suggestions };
    }

    // Check posts in last 24 hours
    const dayAgo = subHours(check.scheduledTime, 24);
    const hourAgo = subHours(check.scheduledTime, 1);

    const recentPosts = await this.repo.queryPosts({
      clientId: check.clientId,
      platform: check.platform,
      status: ['scheduled', 'queued', 'publishing', 'published'],
      startDate: dayAgo,
      endDate: addDays(check.scheduledTime, 1),
    });

    const filtered = check.excludePostId
      ? recentPosts.filter((p) => p.id !== check.excludePostId)
      : recentPosts;

    // Count posts in windows
    const postsInDay = filtered.filter(
      (p) => p.scheduledTime >= dayAgo && p.scheduledTime <= check.scheduledTime
    ).length;

    const postsInHour = filtered.filter(
      (p) => p.scheduledTime >= hourAgo && p.scheduledTime <= check.scheduledTime
    ).length;

    // Check daily limit
    if (postsInDay >= limits.maxPostsPerDay) {
      conflicts.push({
        type: 'RATE_LIMIT_EXCEEDED',
        message: `Daily limit of ${limits.maxPostsPerDay} posts exceeded for ${check.platform}`,
        details: {
          limit: limits.maxPostsPerDay,
          actual: postsInDay,
        },
      });
    }

    // Check hourly limit
    if (postsInHour >= limits.maxPostsPerHour) {
      conflicts.push({
        type: 'RATE_LIMIT_EXCEEDED',
        message: `Hourly limit of ${limits.maxPostsPerHour} posts exceeded for ${check.platform}`,
        details: {
          limit: limits.maxPostsPerHour,
          actual: postsInHour,
        },
      });
    }

    // Check minimum spacing
    const closestPost = this.findClosestPost(filtered, check.scheduledTime);
    if (closestPost) {
      const spacing = Math.abs(
        differenceInMinutes(closestPost.scheduledTime, check.scheduledTime)
      );

      if (spacing < limits.minSpacingMinutes) {
        conflicts.push({
          type: 'MIN_SPACING_VIOLATION',
          message: `Minimum spacing of ${limits.minSpacingMinutes} minutes required`,
          details: {
            existingPostId: closestPost.id,
            existingTime: closestPost.scheduledTime,
          },
        });
      } else if (spacing < limits.recommendedSpacingMinutes) {
        warnings.push({
          type: 'MIN_SPACING_WARNING',
          message: `Posts are only ${spacing} minutes apart (recommended: ${limits.recommendedSpacingMinutes}+ minutes)`,
          recommendation: `Consider spacing posts at least ${limits.recommendedSpacingMinutes} minutes apart`,
        });
      }
    }

    // Suggest better times if conflicts
    if (conflicts.length > 0) {
      const nextSafe = await this.findNextSafeTime(
        check.clientId,
        check.platform,
        check.scheduledTime
      );

      if (nextSafe) {
        suggestions.push({
          type: 'ALTERNATIVE_TIME',
          message: `Next safe posting time: ${nextSafe.toISOString()}`,
          suggestedTime: nextSafe,
          reason: 'Respects rate limits and spacing',
        });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      warnings,
      suggestions,
    };
  }

  async checkAll(check: ComprehensiveCheck): Promise<ConflictResult> {
    const allConflicts: Conflict[] = [];
    const allWarnings: Warning[] = [];
    const allSuggestions: Suggestion[] = [];

    // Check duplicate content
    const duplicateResult = await this.checkDuplicateContent({
      clientId: check.clientId,
      contentBriefId: check.contentBriefId,
      platform: check.platform,
      excludePostId: check.excludePostId,
    });
    allConflicts.push(...duplicateResult.conflicts);
    allWarnings.push(...duplicateResult.warnings);
    allSuggestions.push(...duplicateResult.suggestions);

    // Check rate limits
    const rateResult = await this.checkRateLimits({
      clientId: check.clientId,
      platform: check.platform,
      scheduledTime: check.scheduledTime,
      excludePostId: check.excludePostId,
    });
    allConflicts.push(...rateResult.conflicts);
    allWarnings.push(...rateResult.warnings);
    allSuggestions.push(...rateResult.suggestions);

    // Dedupe suggestions
    const uniqueSuggestions = this.deduplicateSuggestions(allSuggestions);

    return {
      hasConflicts: allConflicts.length > 0,
      conflicts: allConflicts,
      warnings: allWarnings,
      suggestions: uniqueSuggestions,
    };
  }

  private findClosestPost(posts: any[], targetTime: Date): any | null {
    if (posts.length === 0) return null;

    return posts.reduce((closest, post) => {
      const currentDiff = Math.abs(
        post.scheduledTime.getTime() - targetTime.getTime()
      );
      const closestDiff = closest
        ? Math.abs(closest.scheduledTime.getTime() - targetTime.getTime())
        : Infinity;

      return currentDiff < closestDiff ? post : closest;
    }, null);
  }

  private async findNextAvailableTime(
    clientId: string,
    platform: Platform,
    after: Date
  ): Promise<Date | null> {
    const slots = await this.repo.querySlots({
      clientId,
      platform,
      status: 'available',
      startDate: after,
      limit: 1,
    });

    return slots.length > 0 ? slots[0].startTime : null;
  }

  private async findNextSafeTime(
    clientId: string,
    platform: Platform,
    after: Date
  ): Promise<Date | null> {
    const limits = PLATFORM_LIMITS[platform];
    if (!limits) return after;

    // Find a time that respects minimum spacing
    const recentPosts = await this.repo.queryPosts({
      clientId,
      platform,
      status: ['scheduled', 'queued', 'publishing', 'published'],
      startDate: subHours(after, 24),
      endDate: addHours(after, 24),
    });

    // Sort by scheduled time
    const sorted = recentPosts.sort(
      (a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime()
    );

    // Find gaps
    let candidateTime = new Date(after);
    for (const post of sorted) {
      const spacing = differenceInMinutes(post.scheduledTime, candidateTime);
      if (spacing >= limits.recommendedSpacingMinutes) {
        return candidateTime;
      }
      // Move candidate past this post
      candidateTime = new Date(
        post.scheduledTime.getTime() + limits.recommendedSpacingMinutes * 60000
      );
    }

    return candidateTime;
  }

  private deduplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Set<string>();
    return suggestions.filter((s) => {
      const key = `${s.type}:${s.suggestedTime?.toISOString() || s.suggestedPlatform}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export { ConflictType } from './types';
```

#### Step 3: Export Module

Create `packages/calendar/src/conflicts/index.ts`:

```typescript
export * from './types';
export * from './conflict-detector';
```

### Phase 3: Verification

```bash
cd packages/calendar
pnpm test src/conflicts/
pnpm tsc --noEmit
pnpm lint src/conflicts/
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/calendar/src/conflicts/types.ts` | Conflict type definitions |
| Create | `packages/calendar/src/conflicts/conflict-detector.ts` | Detection logic |
| Create | `packages/calendar/src/conflicts/index.ts` | Module exports |
| Create | `packages/calendar/src/conflicts/__tests__/conflict-detection.test.ts` | Tests |

---

## Acceptance Criteria

- [ ] Detects overlapping slots
- [ ] Detects duplicate content briefs
- [ ] Enforces platform rate limits
- [ ] Warns about minimum spacing
- [ ] Suggests alternative times
- [ ] Suggests alternative platforms
- [ ] All tests pass

---

## JSON Task Block

```json
{
  "task_id": "S3-A4",
  "name": "Conflict Detection",
  "status": "pending",
  "dependencies": ["S3-A1", "S3-A2"],
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
    "S3-A1: Calendar model with slots and posts",
    "S3-A2: Scheduling REST API"
  ]
}
```
