# Build Prompt: S4-C3 — Auto-Like with Throttling

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-C3 |
| Sprint | 4 — Engagement |
| Agent | C — Reply Drafting Agent |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1 day |
| Dependencies | S4-C1 |
| Blocks | None |

---

## Context

### What We're Building
An automated like/reaction system with intelligent throttling. Automatically likes positive comments and reactions within rate limits, respects platform-specific rules, and can be disabled per client or globally.

### Why It Matters
- **Engagement Boost**: Acknowledges positive comments
- **Time Savings**: Automates repetitive task
- **Rate Limit Compliance**: Respects platform limits
- **Brand Safety**: Only likes safe content
- **Controllability**: Kill switches at every level

### Spec References
- `docs/05-policy-safety/compliance-requirements.md` — Rate limits
- `docs/06-reliability-ops/slo-error-budget.md` — Throttling
- `docs/01-architecture/system-architecture-v3.md` — Kill switches

---

## Prerequisites

### Completed Tasks
- [x] S4-C1: Reply Agent Prompt System

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/agents/reply/src/__tests__/auto-like.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  AutoLikeService,
  LikeDecision,
  LikeResult,
  ThrottleConfig,
} from '../auto-like';
import { createMockPlatformClient } from './__mocks__/platform-client';
import { createMockRateLimiter } from './__mocks__/rate-limiter';

describe('AutoLikeService', () => {
  let service: AutoLikeService;
  let mockPlatform: ReturnType<typeof createMockPlatformClient>;
  let mockRateLimiter: ReturnType<typeof createMockRateLimiter>;

  beforeEach(() => {
    mockPlatform = createMockPlatformClient();
    mockRateLimiter = createMockRateLimiter();
    service = new AutoLikeService({
      platformClient: mockPlatform,
      rateLimiter: mockRateLimiter,
      defaultThrottle: {
        maxLikesPerHour: 60,
        maxLikesPerDay: 500,
        cooldownMs: 1000,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('shouldLike', () => {
    it('should approve liking positive comments', async () => {
      const decision = await service.shouldLike({
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        content: 'Love this! Great content!',
        sentiment: 'positive',
      });

      expect(decision.shouldLike).toBe(true);
      expect(decision.reason).toBe('positive_sentiment');
    });

    it('should skip negative comments', async () => {
      const decision = await service.shouldLike({
        clientId: 'client_abc',
        platform: 'instagram',
        eventType: 'comment',
        content: 'This is terrible, worst purchase ever',
        sentiment: 'negative',
      });

      expect(decision.shouldLike).toBe(false);
      expect(decision.reason).toBe('negative_sentiment');
    });

    it('should skip neutral comments by default', async () => {
      const decision = await service.shouldLike({
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        content: 'ok',
        sentiment: 'neutral',
      });

      expect(decision.shouldLike).toBe(false);
      expect(decision.reason).toBe('neutral_sentiment');
    });

    it('should skip if kill switch is enabled for client', async () => {
      service.setClientKillSwitch('client_abc', true);

      const decision = await service.shouldLike({
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        content: 'Amazing!',
        sentiment: 'positive',
      });

      expect(decision.shouldLike).toBe(false);
      expect(decision.reason).toBe('client_kill_switch');
    });

    it('should skip if global kill switch is enabled', async () => {
      service.setGlobalKillSwitch(true);

      const decision = await service.shouldLike({
        clientId: 'client_abc',
        platform: 'tiktok',
        eventType: 'comment',
        content: 'So cool!',
        sentiment: 'positive',
      });

      expect(decision.shouldLike).toBe(false);
      expect(decision.reason).toBe('global_kill_switch');
    });

    it('should skip if platform is disabled', async () => {
      service.setPlatformEnabled('linkedin', false);

      const decision = await service.shouldLike({
        clientId: 'client_abc',
        platform: 'linkedin',
        eventType: 'comment',
        content: 'Great insight!',
        sentiment: 'positive',
      });

      expect(decision.shouldLike).toBe(false);
      expect(decision.reason).toBe('platform_disabled');
    });

    it('should skip questions (need reply, not like)', async () => {
      const decision = await service.shouldLike({
        clientId: 'client_abc',
        platform: 'instagram',
        eventType: 'comment',
        content: 'How much does this cost?',
        sentiment: 'neutral',
      });

      expect(decision.shouldLike).toBe(false);
      expect(decision.reason).toBe('is_question');
    });
  });

  describe('executeLike', () => {
    it('should like comment successfully', async () => {
      mockRateLimiter.canProceed.mockResolvedValue(true);
      mockPlatform.likeComment.mockResolvedValue({ success: true });

      const result = await service.executeLike({
        clientId: 'client_abc',
        platform: 'facebook',
        targetId: 'comment_123',
        targetType: 'comment',
      });

      expect(result.success).toBe(true);
      expect(mockPlatform.likeComment).toHaveBeenCalledWith('comment_123');
      expect(mockRateLimiter.increment).toHaveBeenCalled();
    });

    it('should respect rate limits', async () => {
      mockRateLimiter.canProceed.mockResolvedValue(false);

      const result = await service.executeLike({
        clientId: 'client_abc',
        platform: 'instagram',
        targetId: 'comment_456',
        targetType: 'comment',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('rate_limited');
      expect(mockPlatform.likeComment).not.toHaveBeenCalled();
    });

    it('should handle platform errors gracefully', async () => {
      mockRateLimiter.canProceed.mockResolvedValue(true);
      mockPlatform.likeComment.mockRejectedValue(new Error('API error'));

      const result = await service.executeLike({
        clientId: 'client_abc',
        platform: 'tiktok',
        targetId: 'comment_789',
        targetType: 'comment',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('platform_error');
      expect(result.error).toBe('API error');
    });

    it('should enforce cooldown between likes', async () => {
      mockRateLimiter.canProceed.mockResolvedValue(true);
      mockPlatform.likeComment.mockResolvedValue({ success: true });

      await service.executeLike({
        clientId: 'client_abc',
        platform: 'facebook',
        targetId: 'comment_1',
        targetType: 'comment',
      });

      // Immediately try another
      const result = await service.executeLike({
        clientId: 'client_abc',
        platform: 'facebook',
        targetId: 'comment_2',
        targetType: 'comment',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('cooldown_active');
    });
  });

  describe('processBatch', () => {
    it('should process multiple likes with delays', async () => {
      mockRateLimiter.canProceed.mockResolvedValue(true);
      mockPlatform.likeComment.mockResolvedValue({ success: true });

      const events = [
        { clientId: 'client_abc', platform: 'facebook', targetId: 'c1', targetType: 'comment' },
        { clientId: 'client_abc', platform: 'facebook', targetId: 'c2', targetType: 'comment' },
        { clientId: 'client_abc', platform: 'facebook', targetId: 'c3', targetType: 'comment' },
      ];

      const results = await service.processBatch(events);

      expect(results.succeeded).toBe(3);
      expect(results.failed).toBe(0);
    });

    it('should stop batch if rate limit hit', async () => {
      mockRateLimiter.canProceed
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      mockPlatform.likeComment.mockResolvedValue({ success: true });

      const events = [
        { clientId: 'client_abc', platform: 'facebook', targetId: 'c1', targetType: 'comment' },
        { clientId: 'client_abc', platform: 'facebook', targetId: 'c2', targetType: 'comment' },
        { clientId: 'client_abc', platform: 'facebook', targetId: 'c3', targetType: 'comment' },
      ];

      const results = await service.processBatch(events);

      expect(results.succeeded).toBe(1);
      expect(results.rateLimited).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should track like statistics', async () => {
      mockRateLimiter.canProceed.mockResolvedValue(true);
      mockPlatform.likeComment.mockResolvedValue({ success: true });

      await service.executeLike({
        clientId: 'client_abc',
        platform: 'facebook',
        targetId: 'c1',
        targetType: 'comment',
      });

      const stats = service.getStats('client_abc');

      expect(stats.totalLikes).toBe(1);
      expect(stats.byPlatform.facebook).toBe(1);
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/agents/reply/src/auto-like.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Platform } from '@rtv/core';

const tracer = trace.getTracer('auto-like');

export interface ThrottleConfig {
  maxLikesPerHour: number;
  maxLikesPerDay: number;
  cooldownMs: number;
}

export interface LikeDecision {
  shouldLike: boolean;
  reason: string;
  confidence?: number;
}

export interface LikeResult {
  success: boolean;
  reason?: string;
  error?: string;
}

export interface LikeTarget {
  clientId: string;
  platform: Platform | string;
  targetId: string;
  targetType: 'comment' | 'post' | 'reply';
}

export interface LikeCandidate {
  clientId: string;
  platform: Platform | string;
  eventType: string;
  content: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface BatchResult {
  succeeded: number;
  failed: number;
  rateLimited: number;
  skipped: number;
}

export interface LikeStats {
  totalLikes: number;
  byPlatform: Record<string, number>;
  lastLikeAt?: Date;
}

export interface RateLimiter {
  canProceed(key: string): Promise<boolean>;
  increment(key: string): Promise<void>;
  getRemainingQuota(key: string): Promise<number>;
}

export interface PlatformClient {
  likeComment(commentId: string): Promise<{ success: boolean }>;
  likePost(postId: string): Promise<{ success: boolean }>;
}

const DEFAULT_THROTTLE: ThrottleConfig = {
  maxLikesPerHour: 60,
  maxLikesPerDay: 500,
  cooldownMs: 2000, // 2 seconds between likes
};

const QUESTION_PATTERNS = [
  /\?$/,
  /^(how|what|when|where|why|who|which|can|do|does|is|are|will|would|should|could)/i,
  /anyone know/i,
  /help me/i,
];

export class AutoLikeService {
  private platformClient: PlatformClient;
  private rateLimiter: RateLimiter;
  private throttle: ThrottleConfig;

  private globalKillSwitch = false;
  private clientKillSwitches: Map<string, boolean> = new Map();
  private platformEnabled: Map<string, boolean> = new Map();
  private lastLikeTime: Map<string, number> = new Map();
  private stats: Map<string, LikeStats> = new Map();

  constructor(config: {
    platformClient: PlatformClient;
    rateLimiter: RateLimiter;
    defaultThrottle?: ThrottleConfig;
  }) {
    this.platformClient = config.platformClient;
    this.rateLimiter = config.rateLimiter;
    this.throttle = config.defaultThrottle || DEFAULT_THROTTLE;

    // Enable all platforms by default
    ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x'].forEach(
      (p) => this.platformEnabled.set(p, true)
    );
  }

  setGlobalKillSwitch(enabled: boolean): void {
    this.globalKillSwitch = enabled;
  }

  setClientKillSwitch(clientId: string, enabled: boolean): void {
    this.clientKillSwitches.set(clientId, enabled);
  }

  setPlatformEnabled(platform: string, enabled: boolean): void {
    this.platformEnabled.set(platform, enabled);
  }

  async shouldLike(candidate: LikeCandidate): Promise<LikeDecision> {
    return tracer.startActiveSpan('shouldLike', async (span) => {
      span.setAttributes({
        'like.client_id': candidate.clientId,
        'like.platform': candidate.platform,
        'like.event_type': candidate.eventType,
      });

      // Check global kill switch
      if (this.globalKillSwitch) {
        span.end();
        return { shouldLike: false, reason: 'global_kill_switch' };
      }

      // Check client kill switch
      if (this.clientKillSwitches.get(candidate.clientId)) {
        span.end();
        return { shouldLike: false, reason: 'client_kill_switch' };
      }

      // Check platform enabled
      if (!this.platformEnabled.get(candidate.platform as string)) {
        span.end();
        return { shouldLike: false, reason: 'platform_disabled' };
      }

      // Check if it's a question (should reply, not like)
      if (this.isQuestion(candidate.content)) {
        span.end();
        return { shouldLike: false, reason: 'is_question' };
      }

      // Check sentiment
      if (candidate.sentiment === 'negative') {
        span.end();
        return { shouldLike: false, reason: 'negative_sentiment' };
      }

      if (candidate.sentiment === 'neutral') {
        span.end();
        return { shouldLike: false, reason: 'neutral_sentiment' };
      }

      span.end();
      return { shouldLike: true, reason: 'positive_sentiment', confidence: 0.9 };
    });
  }

  private isQuestion(content: string): boolean {
    return QUESTION_PATTERNS.some((pattern) => pattern.test(content.trim()));
  }

  async executeLike(target: LikeTarget): Promise<LikeResult> {
    return tracer.startActiveSpan('executeLike', async (span) => {
      span.setAttributes({
        'like.client_id': target.clientId,
        'like.platform': target.platform,
        'like.target_id': target.targetId,
        'like.target_type': target.targetType,
      });

      // Check cooldown
      const lastLike = this.lastLikeTime.get(target.clientId);
      if (lastLike && Date.now() - lastLike < this.throttle.cooldownMs) {
        span.setAttributes({ 'like.result': 'cooldown_active' });
        span.end();
        return { success: false, reason: 'cooldown_active' };
      }

      // Check rate limit
      const rateLimitKey = `like:${target.clientId}:${target.platform}`;
      const canProceed = await this.rateLimiter.canProceed(rateLimitKey);

      if (!canProceed) {
        span.setAttributes({ 'like.result': 'rate_limited' });
        span.end();
        return { success: false, reason: 'rate_limited' };
      }

      try {
        let result: { success: boolean };

        if (target.targetType === 'comment' || target.targetType === 'reply') {
          result = await this.platformClient.likeComment(target.targetId);
        } else {
          result = await this.platformClient.likePost(target.targetId);
        }

        if (result.success) {
          await this.rateLimiter.increment(rateLimitKey);
          this.lastLikeTime.set(target.clientId, Date.now());
          this.recordStat(target.clientId, target.platform as string);
        }

        span.setAttributes({ 'like.result': result.success ? 'success' : 'failed' });
        span.end();

        return { success: result.success };
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
        return {
          success: false,
          reason: 'platform_error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  async processBatch(targets: LikeTarget[]): Promise<BatchResult> {
    const results: BatchResult = {
      succeeded: 0,
      failed: 0,
      rateLimited: 0,
      skipped: 0,
    };

    for (const target of targets) {
      const result = await this.executeLike(target);

      if (result.success) {
        results.succeeded++;
      } else if (result.reason === 'rate_limited') {
        results.rateLimited++;
        // Stop processing if rate limited
        results.rateLimited += targets.length - results.succeeded - 1;
        break;
      } else if (result.reason === 'cooldown_active') {
        // Wait for cooldown and retry
        await this.sleep(this.throttle.cooldownMs);
        const retryResult = await this.executeLike(target);
        if (retryResult.success) {
          results.succeeded++;
        } else {
          results.failed++;
        }
      } else {
        results.failed++;
      }

      // Add delay between likes
      if (targets.indexOf(target) < targets.length - 1) {
        await this.sleep(this.throttle.cooldownMs);
      }
    }

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private recordStat(clientId: string, platform: string): void {
    const existing = this.stats.get(clientId) || {
      totalLikes: 0,
      byPlatform: {},
    };

    existing.totalLikes++;
    existing.byPlatform[platform] = (existing.byPlatform[platform] || 0) + 1;
    existing.lastLikeAt = new Date();

    this.stats.set(clientId, existing);
  }

  getStats(clientId: string): LikeStats {
    return (
      this.stats.get(clientId) || {
        totalLikes: 0,
        byPlatform: {},
      }
    );
  }

  async getRemainingQuota(
    clientId: string,
    platform: string
  ): Promise<number> {
    const key = `like:${clientId}:${platform}`;
    return this.rateLimiter.getRemainingQuota(key);
  }
}

export function createAutoLikeService(config: {
  platformClient: PlatformClient;
  rateLimiter: RateLimiter;
  throttle?: ThrottleConfig;
}): AutoLikeService {
  return new AutoLikeService({
    platformClient: config.platformClient,
    rateLimiter: config.rateLimiter,
    defaultThrottle: config.throttle,
  });
}
```

### Phase 3: Verification

```bash
cd packages/agents/reply && pnpm test
pnpm test:coverage
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/reply/src/auto-like.ts` | Auto-like service |
| Create | `packages/agents/reply/src/__tests__/auto-like.test.ts` | Tests |
| Modify | `packages/agents/reply/src/index.ts` | Export auto-like |

---

## Acceptance Criteria

- [ ] Like positive comments automatically
- [ ] Skip negative and neutral comments
- [ ] Skip questions (need reply, not like)
- [ ] Respect rate limits (per hour, per day)
- [ ] Enforce cooldown between likes
- [ ] Global kill switch
- [ ] Per-client kill switches
- [ ] Per-platform enable/disable
- [ ] Batch processing with delays
- [ ] Track like statistics
- [ ] Handle platform errors gracefully
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-C3",
  "name": "Auto-Like with Throttling",
  "description": "Automatically like positive comments within rate limits",
  "status": "pending",
  "priority": "medium",
  "complexity": "medium",
  "sprint": 4,
  "agent": "C",
  "dependencies": ["S4-C1"],
  "blocks": [],
  "estimated_hours": 8,
  "tags": ["engagement", "reply-agent", "auto-like", "throttling", "tdd"],
  "package": "@rtv/agents/reply"
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "next_task_hints": ["S4-C4 for comment reply drafts"]
}
```
