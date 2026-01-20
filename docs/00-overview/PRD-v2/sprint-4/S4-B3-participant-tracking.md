# Build Prompt: S4-B3 — Participant Tracking

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-B3 |
| Sprint | 4 — Engagement |
| Agent | B — Conversation Thread Model |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1 day |
| Dependencies | S4-B1 |
| Blocks | S4-C2, S4-D1 |

---

## Context

### What We're Building
A participant tracking system that maintains history and context for users across threads. Tracks interaction patterns, sentiment trends, engagement frequency, and VIP status to enable personalized responses and escalation decisions.

### Why It Matters
- **Personalization**: Know who you're talking to across interactions
- **VIP Detection**: Identify high-value or high-risk users
- **Escalation Context**: User history informs escalation decisions
- **Reply Quality**: Historical context improves response relevance
- **Analytics**: Understand engagement patterns per user

### Spec References
- `docs/02-schemas/external-memory-schema.md` — Participant schema
- `docs/01-architecture/system-architecture-v3.md` — User tracking
- `docs/05-policy-safety/compliance-requirements.md` — Privacy considerations

---

## Prerequisites

### Completed Tasks
- [x] S4-B1: Thread Entity Model

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/engagement/threads/src/__tests__/participant-tracker.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ParticipantTracker,
  ParticipantProfile,
  InteractionRecord,
} from '../participant-tracker';
import { createMockRepository } from './__mocks__/repository';

describe('ParticipantTracker', () => {
  let tracker: ParticipantTracker;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    tracker = new ParticipantTracker({ repository: mockRepo });
  });

  describe('getOrCreateProfile', () => {
    it('should create new profile for unknown user', async () => {
      mockRepo.findParticipant.mockResolvedValue(null);
      mockRepo.createParticipant.mockResolvedValue({
        id: 'part_123',
        clientId: 'client_abc',
        platform: 'facebook',
        platformUserId: 'fb_user_456',
        displayName: 'John Doe',
        createdAt: new Date(),
      });

      const profile = await tracker.getOrCreateProfile({
        clientId: 'client_abc',
        platform: 'facebook',
        platformUserId: 'fb_user_456',
        displayName: 'John Doe',
      });

      expect(profile.id).toBe('part_123');
      expect(profile.interactionCount).toBe(0);
      expect(mockRepo.createParticipant).toHaveBeenCalled();
    });

    it('should return existing profile for known user', async () => {
      mockRepo.findParticipant.mockResolvedValue({
        id: 'part_existing',
        clientId: 'client_abc',
        platform: 'instagram',
        platformUserId: 'ig_user_789',
        displayName: 'Jane Smith',
        interactionCount: 5,
        createdAt: new Date(),
      });

      const profile = await tracker.getOrCreateProfile({
        clientId: 'client_abc',
        platform: 'instagram',
        platformUserId: 'ig_user_789',
        displayName: 'Jane Smith',
      });

      expect(profile.id).toBe('part_existing');
      expect(profile.interactionCount).toBe(5);
      expect(mockRepo.createParticipant).not.toHaveBeenCalled();
    });
  });

  describe('recordInteraction', () => {
    it('should record new interaction and update profile', async () => {
      const profile: ParticipantProfile = {
        id: 'part_123',
        clientId: 'client_abc',
        platform: 'facebook',
        platformUserId: 'fb_user_1',
        displayName: 'User',
        interactionCount: 5,
        lastInteractionAt: new Date(Date.now() - 86400000),
        createdAt: new Date(),
      };

      mockRepo.findParticipant.mockResolvedValue(profile);
      mockRepo.recordInteraction.mockResolvedValue(undefined);
      mockRepo.updateParticipant.mockResolvedValue(undefined);

      await tracker.recordInteraction({
        participantId: profile.id,
        threadId: 'thread_1',
        type: 'comment',
        sentiment: 'positive',
        content: 'Great product!',
      });

      expect(mockRepo.recordInteraction).toHaveBeenCalled();
      expect(mockRepo.updateParticipant).toHaveBeenCalledWith(
        'part_123',
        expect.objectContaining({
          interactionCount: 6,
        })
      );
    });

    it('should update sentiment trend', async () => {
      const profile: ParticipantProfile = {
        id: 'part_123',
        clientId: 'client_abc',
        platform: 'x',
        platformUserId: 'x_user_1',
        displayName: 'User',
        interactionCount: 10,
        sentimentTrend: 'neutral',
        createdAt: new Date(),
      };

      mockRepo.findParticipant.mockResolvedValue(profile);
      mockRepo.getRecentInteractions.mockResolvedValue([
        { sentiment: 'negative' },
        { sentiment: 'negative' },
        { sentiment: 'negative' },
      ]);

      await tracker.recordInteraction({
        participantId: profile.id,
        threadId: 'thread_2',
        type: 'mention',
        sentiment: 'negative',
        content: 'Terrible experience',
      });

      expect(mockRepo.updateParticipant).toHaveBeenCalledWith(
        'part_123',
        expect.objectContaining({
          sentimentTrend: 'negative',
        })
      );
    });
  });

  describe('isVIP', () => {
    it('should identify VIP by interaction count', async () => {
      const profile: ParticipantProfile = {
        id: 'part_vip',
        clientId: 'client_abc',
        platform: 'instagram',
        platformUserId: 'ig_influencer',
        displayName: 'Big Influencer',
        interactionCount: 50,
        followerCount: 100000,
        createdAt: new Date(),
      };

      mockRepo.findParticipant.mockResolvedValue(profile);

      const isVip = await tracker.isVIP('part_vip');

      expect(isVip).toBe(true);
    });

    it('should identify VIP by follower count', async () => {
      const profile: ParticipantProfile = {
        id: 'part_celeb',
        clientId: 'client_abc',
        platform: 'x',
        platformUserId: 'x_celeb',
        displayName: 'Celebrity',
        interactionCount: 2,
        followerCount: 500000,
        isVerified: true,
        createdAt: new Date(),
      };

      mockRepo.findParticipant.mockResolvedValue(profile);

      const isVip = await tracker.isVIP('part_celeb');

      expect(isVip).toBe(true);
    });

    it('should identify VIP by explicit flag', async () => {
      const profile: ParticipantProfile = {
        id: 'part_manual_vip',
        clientId: 'client_abc',
        platform: 'facebook',
        platformUserId: 'fb_important',
        displayName: 'Important Customer',
        interactionCount: 3,
        vipStatus: 'vip',
        createdAt: new Date(),
      };

      mockRepo.findParticipant.mockResolvedValue(profile);

      const isVip = await tracker.isVIP('part_manual_vip');

      expect(isVip).toBe(true);
    });
  });

  describe('getInteractionHistory', () => {
    it('should return recent interactions', async () => {
      mockRepo.getRecentInteractions.mockResolvedValue([
        {
          id: 'int_1',
          participantId: 'part_1',
          threadId: 'thread_1',
          type: 'comment',
          timestamp: new Date(),
        },
        {
          id: 'int_2',
          participantId: 'part_1',
          threadId: 'thread_2',
          type: 'dm',
          timestamp: new Date(),
        },
      ]);

      const history = await tracker.getInteractionHistory('part_1', {
        limit: 10,
      });

      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('comment');
    });

    it('should filter by interaction type', async () => {
      mockRepo.getRecentInteractions.mockResolvedValue([
        { id: 'int_1', type: 'dm', timestamp: new Date() },
      ]);

      const history = await tracker.getInteractionHistory('part_1', {
        limit: 10,
        type: 'dm',
      });

      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('dm');
    });
  });

  describe('getEngagementScore', () => {
    it('should calculate engagement score', async () => {
      const profile: ParticipantProfile = {
        id: 'part_engaged',
        clientId: 'client_abc',
        platform: 'facebook',
        platformUserId: 'fb_engaged',
        displayName: 'Engaged User',
        interactionCount: 20,
        sentimentTrend: 'positive',
        firstInteractionAt: new Date(Date.now() - 30 * 86400000), // 30 days ago
        lastInteractionAt: new Date(),
        createdAt: new Date(),
      };

      mockRepo.findParticipant.mockResolvedValue(profile);

      const score = await tracker.getEngagementScore('part_engaged');

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('flagForReview', () => {
    it('should flag participant for manual review', async () => {
      await tracker.flagForReview('part_123', {
        reason: 'repeated_complaints',
        notes: 'User has complained 5 times this week',
      });

      expect(mockRepo.updateParticipant).toHaveBeenCalledWith(
        'part_123',
        expect.objectContaining({
          flaggedForReview: true,
          flagReason: 'repeated_complaints',
        })
      );
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/engagement/threads/src/participant-tracker.ts
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Platform } from '@rtv/core';

const tracer = trace.getTracer('participant-tracker');

export const ParticipantProfileSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  platform: z.enum(['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x', 'skool']),
  platformUserId: z.string(),
  displayName: z.string(),
  username: z.string().optional(),
  profileUrl: z.string().optional(),

  // Engagement metrics
  interactionCount: z.number().default(0),
  threadCount: z.number().default(0),
  firstInteractionAt: z.date().optional(),
  lastInteractionAt: z.date().optional(),

  // Social proof
  followerCount: z.number().optional(),
  isVerified: z.boolean().optional(),

  // Status
  vipStatus: z.enum(['normal', 'vip', 'blocked']).default('normal'),
  sentimentTrend: z.enum(['positive', 'neutral', 'negative']).optional(),

  // Review
  flaggedForReview: z.boolean().default(false),
  flagReason: z.string().optional(),
  flaggedAt: z.date().optional(),

  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date().optional(),

  metadata: z.record(z.unknown()).default({}),
});

export type ParticipantProfile = z.infer<typeof ParticipantProfileSchema>;

export const InteractionRecordSchema = z.object({
  id: z.string(),
  participantId: z.string(),
  threadId: z.string(),
  type: z.enum(['comment', 'dm', 'mention', 'reaction']),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  content: z.string().optional(),
  timestamp: z.date(),
  metadata: z.record(z.unknown()).default({}),
});

export type InteractionRecord = z.infer<typeof InteractionRecordSchema>;

export interface ParticipantRepository {
  findParticipant(
    clientId: string,
    platform: string,
    platformUserId: string
  ): Promise<ParticipantProfile | null>;
  createParticipant(
    data: Omit<ParticipantProfile, 'id' | 'createdAt'>
  ): Promise<ParticipantProfile>;
  updateParticipant(
    id: string,
    data: Partial<ParticipantProfile>
  ): Promise<void>;
  recordInteraction(interaction: InteractionRecord): Promise<void>;
  getRecentInteractions(
    participantId: string,
    options: { limit: number; type?: string }
  ): Promise<InteractionRecord[]>;
}

interface VIPConfig {
  minInteractions: number;
  minFollowers: number;
}

export class ParticipantTracker {
  private repository: ParticipantRepository;
  private vipConfig: VIPConfig;

  constructor(config: {
    repository: ParticipantRepository;
    vipConfig?: Partial<VIPConfig>;
  }) {
    this.repository = config.repository;
    this.vipConfig = {
      minInteractions: config.vipConfig?.minInteractions || 25,
      minFollowers: config.vipConfig?.minFollowers || 10000,
    };
  }

  async getOrCreateProfile(data: {
    clientId: string;
    platform: Platform | string;
    platformUserId: string;
    displayName: string;
    username?: string;
    profileUrl?: string;
    followerCount?: number;
    isVerified?: boolean;
  }): Promise<ParticipantProfile> {
    return tracer.startActiveSpan('getOrCreateProfile', async (span) => {
      span.setAttributes({
        'participant.client_id': data.clientId,
        'participant.platform': data.platform,
        'participant.user_id': data.platformUserId,
      });

      const existing = await this.repository.findParticipant(
        data.clientId,
        data.platform,
        data.platformUserId
      );

      if (existing) {
        span.setAttributes({ 'participant.found': true });
        span.end();
        return existing;
      }

      const profile = await this.repository.createParticipant({
        clientId: data.clientId,
        platform: data.platform as ParticipantProfile['platform'],
        platformUserId: data.platformUserId,
        displayName: data.displayName,
        username: data.username,
        profileUrl: data.profileUrl,
        followerCount: data.followerCount,
        isVerified: data.isVerified,
        interactionCount: 0,
        threadCount: 0,
        vipStatus: 'normal',
        flaggedForReview: false,
        metadata: {},
      });

      span.setAttributes({ 'participant.created': true });
      span.end();

      return profile;
    });
  }

  async recordInteraction(data: {
    participantId: string;
    threadId: string;
    type: InteractionRecord['type'];
    sentiment?: InteractionRecord['sentiment'];
    content?: string;
  }): Promise<void> {
    return tracer.startActiveSpan('recordInteraction', async (span) => {
      span.setAttributes({
        'interaction.participant_id': data.participantId,
        'interaction.thread_id': data.threadId,
        'interaction.type': data.type,
      });

      const interaction: InteractionRecord = {
        id: `int_${nanoid()}`,
        participantId: data.participantId,
        threadId: data.threadId,
        type: data.type,
        sentiment: data.sentiment,
        content: data.content,
        timestamp: new Date(),
        metadata: {},
      };

      await this.repository.recordInteraction(interaction);

      // Update participant profile
      const recentInteractions = await this.repository.getRecentInteractions(
        data.participantId,
        { limit: 5 }
      );

      const sentimentTrend = this.calculateSentimentTrend([
        ...recentInteractions,
        interaction,
      ]);

      await this.repository.updateParticipant(data.participantId, {
        interactionCount:
          (recentInteractions.length > 0 ? recentInteractions.length : 0) + 1,
        lastInteractionAt: new Date(),
        sentimentTrend,
        updatedAt: new Date(),
      });

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    });
  }

  private calculateSentimentTrend(
    interactions: InteractionRecord[]
  ): ParticipantProfile['sentimentTrend'] {
    const sentiments = interactions
      .filter((i) => i.sentiment)
      .map((i) => i.sentiment!);

    if (sentiments.length === 0) return undefined;

    const counts = {
      positive: sentiments.filter((s) => s === 'positive').length,
      neutral: sentiments.filter((s) => s === 'neutral').length,
      negative: sentiments.filter((s) => s === 'negative').length,
    };

    if (counts.negative >= sentiments.length * 0.6) return 'negative';
    if (counts.positive >= sentiments.length * 0.6) return 'positive';
    return 'neutral';
  }

  async isVIP(participantId: string): Promise<boolean> {
    const profile = await this.repository.findParticipant(
      '',
      '',
      participantId
    );

    if (!profile) return false;

    // Explicit VIP flag
    if (profile.vipStatus === 'vip') return true;

    // High engagement
    if (profile.interactionCount >= this.vipConfig.minInteractions) return true;

    // High follower count
    if (
      profile.followerCount &&
      profile.followerCount >= this.vipConfig.minFollowers
    )
      return true;

    // Verified account
    if (profile.isVerified) return true;

    return false;
  }

  async getInteractionHistory(
    participantId: string,
    options: { limit: number; type?: InteractionRecord['type'] }
  ): Promise<InteractionRecord[]> {
    return this.repository.getRecentInteractions(participantId, options);
  }

  async getEngagementScore(participantId: string): Promise<number> {
    const profile = await this.repository.findParticipant(
      '',
      '',
      participantId
    );

    if (!profile) return 0;

    let score = 0;

    // Interaction frequency (max 30 points)
    score += Math.min(profile.interactionCount * 2, 30);

    // Recency (max 20 points)
    if (profile.lastInteractionAt) {
      const daysSinceLastInteraction =
        (Date.now() - profile.lastInteractionAt.getTime()) / 86400000;
      score += Math.max(20 - daysSinceLastInteraction, 0);
    }

    // Positive sentiment (max 20 points)
    if (profile.sentimentTrend === 'positive') score += 20;
    else if (profile.sentimentTrend === 'neutral') score += 10;

    // Longevity (max 15 points)
    if (profile.firstInteractionAt) {
      const daysAsCustomer =
        (Date.now() - profile.firstInteractionAt.getTime()) / 86400000;
      score += Math.min(daysAsCustomer / 2, 15);
    }

    // Social proof (max 15 points)
    if (profile.isVerified) score += 10;
    if (profile.followerCount && profile.followerCount > 1000) score += 5;

    return Math.min(Math.round(score), 100);
  }

  async flagForReview(
    participantId: string,
    data: { reason: string; notes?: string }
  ): Promise<void> {
    await this.repository.updateParticipant(participantId, {
      flaggedForReview: true,
      flagReason: data.reason,
      flaggedAt: new Date(),
      metadata: { reviewNotes: data.notes },
      updatedAt: new Date(),
    });
  }

  async setVIPStatus(
    participantId: string,
    status: ParticipantProfile['vipStatus']
  ): Promise<void> {
    await this.repository.updateParticipant(participantId, {
      vipStatus: status,
      updatedAt: new Date(),
    });
  }

  async getProfileContext(participantId: string): Promise<{
    profile: ParticipantProfile | null;
    isVip: boolean;
    engagementScore: number;
    recentInteractions: InteractionRecord[];
  }> {
    const profile = await this.repository.findParticipant(
      '',
      '',
      participantId
    );

    if (!profile) {
      return {
        profile: null,
        isVip: false,
        engagementScore: 0,
        recentInteractions: [],
      };
    }

    const [isVip, engagementScore, recentInteractions] = await Promise.all([
      this.isVIP(participantId),
      this.getEngagementScore(participantId),
      this.getInteractionHistory(participantId, { limit: 5 }),
    ]);

    return {
      profile,
      isVip,
      engagementScore,
      recentInteractions,
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
| Create | `packages/engagement/threads/src/participant-tracker.ts` | Tracker implementation |
| Create | `packages/engagement/threads/src/__tests__/participant-tracker.test.ts` | Tests |
| Modify | `packages/engagement/threads/src/index.ts` | Export tracker |

---

## Acceptance Criteria

- [ ] Create and retrieve participant profiles
- [ ] Record interactions with sentiment tracking
- [ ] Calculate sentiment trends from recent interactions
- [ ] VIP detection (followers, engagement, verified, explicit flag)
- [ ] Engagement score calculation (0-100)
- [ ] Flag participants for manual review
- [ ] Get profile context for reply agents
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-B3",
  "name": "Participant Tracking",
  "description": "Track user history and engagement across threads",
  "status": "pending",
  "priority": "medium",
  "complexity": "medium",
  "sprint": 4,
  "agent": "B",
  "dependencies": ["S4-B1"],
  "blocks": ["S4-C2", "S4-D1"],
  "estimated_hours": 8,
  "tags": ["engagement", "threads", "participants", "vip", "tdd"],
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
  "next_task_hints": ["S4-B4 for thread state machine", "S4-C2 for safe response generation"]
}
```
