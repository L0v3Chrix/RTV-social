# Build Prompt: S1-C4 — Rate Limiting Policies

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-C4 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | C — Policy Engine |
| **Task Name** | Rate Limiting Policies |
| **Complexity** | Medium |
| **Estimated Effort** | 4-5 hours |
| **Dependencies** | S1-C1 |
| **Blocks** | S1-C5, S3-B1 through S3-B6 |
| **Status** | pending |

---

## Context

### What This Builds

Rate limiting policies control how frequently actions can be performed. Unlike kill switches (binary on/off), rate limiters track usage over time windows and enforce quotas. They protect both our systems and external APIs from abuse.

### Why It Matters

- **Platform Compliance**: Social platforms enforce rate limits; violating them risks account suspension
- **Cost Control**: LLM and media generation APIs charge per call
- **Quality Control**: Prevents flooding followers with too much content
- **Fair Usage**: Multi-tenant systems need resource fairness between clients

### Rate Limit Categories

```
┌─────────────────────────────────────────────────────────────┐
│                    Rate Limit Categories                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. PLATFORM LIMITS (External APIs)                         │
│     ├─ Meta: 200 posts/day, 100 DMs/hour                    │
│     ├─ TikTok: 50 videos/day                                │
│     ├─ LinkedIn: 150 posts/day                              │
│     └─ X: 100 posts/hour (varies by tier)                   │
│                                                              │
│  2. SYSTEM LIMITS (Our Resources)                           │
│     ├─ LLM tokens: 1M tokens/day per client                 │
│     ├─ Media generation: 100 images/day per client          │
│     ├─ Browser sessions: 10 concurrent per client           │
│     └─ API requests: 1000/minute per client                 │
│                                                              │
│  3. BUSINESS LIMITS (Client Tier)                           │
│     ├─ Starter: 100 posts/month                             │
│     ├─ Pro: 500 posts/month                                 │
│     └─ Enterprise: Unlimited                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Reference Specs

| Document | Section | Relevance |
|----------|---------|-----------|
| `/docs/05-policy-safety/policy-engine.md` | Rate Limiting | Requirements |
| `/docs/05-policy-safety/compliance-safety.md` | Platform Limits | Compliance |
| `/docs/09-platform-playbooks/*.md` | Platform-specific limits | Per-platform details |
| `/docs/01-architecture/system-architecture-v3.md` | Resource Governance | Architecture |
| `/docs/06-reliability-ops/slo-error-budget.md` | Budget Management | SLO alignment |

---

## Prerequisites

### Completed Tasks

- [x] **S0-B2**: Core schema migrations (for rate_limits table)
- [x] **S0-B3**: Multi-tenant schema (client_id scoping)
- [x] **S0-B4**: Audit event schema (for limit exceeded events)
- [x] **S1-C1**: Policy definition schema (for integration)

### Required Packages

```json
{
  "dependencies": {
    "drizzle-orm": "^0.30.0",
    "zod": "^3.22.0",
    "nanoid": "^5.0.0",
    "ioredis": "^5.3.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create comprehensive tests BEFORE implementation.

#### 1.1 Create Rate Limit Types Tests

**File:** `packages/policy/src/rate-limit/__tests__/types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  RateLimitConfigSchema,
  RateLimitCheckContextSchema,
  RateLimitWindowSchema,
} from '../types';

describe('Rate Limit Types', () => {
  describe('RateLimitConfigSchema', () => {
    it('should validate valid sliding window config', () => {
      const config = {
        id: 'rl_test',
        name: 'Meta Posts',
        category: 'platform',
        resource: 'meta:posts',
        limit: 200,
        window: { type: 'sliding', durationMs: 86400000 },
        scope: 'client',
      };

      const result = RateLimitConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate fixed window config', () => {
      const config = {
        id: 'rl_test',
        name: 'Daily Posts',
        category: 'business',
        resource: 'posts:total',
        limit: 100,
        window: { type: 'fixed', durationMs: 86400000, anchor: 'day_start' },
        scope: 'client',
      };

      const result = RateLimitConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate token bucket config', () => {
      const config = {
        id: 'rl_test',
        name: 'API Requests',
        category: 'system',
        resource: 'api:requests',
        limit: 1000,
        window: { type: 'token_bucket', refillRate: 100, refillIntervalMs: 1000 },
        scope: 'client',
      };

      const result = RateLimitConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid window type', () => {
      const config = {
        id: 'rl_test',
        name: 'Test',
        category: 'platform',
        resource: 'test',
        limit: 100,
        window: { type: 'invalid' },
        scope: 'client',
      };

      const result = RateLimitConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should require positive limit', () => {
      const config = {
        id: 'rl_test',
        name: 'Test',
        category: 'platform',
        resource: 'test',
        limit: -1,
        window: { type: 'sliding', durationMs: 60000 },
        scope: 'client',
      };

      const result = RateLimitConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('RateLimitCheckContextSchema', () => {
    it('should validate minimal context', () => {
      const context = {
        resource: 'meta:posts',
        clientId: 'client_abc',
      };

      const result = RateLimitCheckContextSchema.safeParse(context);
      expect(result.success).toBe(true);
    });

    it('should validate context with cost', () => {
      const context = {
        resource: 'llm:tokens',
        clientId: 'client_abc',
        cost: 1500,
      };

      const result = RateLimitCheckContextSchema.safeParse(context);
      expect(result.success).toBe(true);
    });
  });
});
```

#### 1.2 Create Sliding Window Tests

**File:** `packages/policy/src/rate-limit/__tests__/sliding-window.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createSlidingWindowLimiter, SlidingWindowLimiter } from '../sliding-window';
import { createMockRedis } from '@rtv/testing';

describe('SlidingWindowLimiter', () => {
  let limiter: SlidingWindowLimiter;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRedis = createMockRedis();
    limiter = createSlidingWindowLimiter({ redis: mockRedis });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('check', () => {
    it('should allow when under limit', async () => {
      mockRedis.zcount.mockResolvedValue(5);

      const result = await limiter.check({
        key: 'client_abc:meta:posts',
        limit: 10,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 5 - 1 (requested)
      expect(result.current).toBe(5);
    });

    it('should deny when at limit', async () => {
      mockRedis.zcount.mockResolvedValue(10);

      const result = await limiter.check({
        key: 'client_abc:meta:posts',
        limit: 10,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle cost > 1', async () => {
      mockRedis.zcount.mockResolvedValue(7);

      const result = await limiter.check({
        key: 'client_abc:llm:tokens',
        limit: 10,
        windowMs: 60000,
        cost: 5, // Would put us at 12, over limit of 10
      });

      expect(result.allowed).toBe(false);
    });

    it('should calculate correct reset time', async () => {
      const now = Date.now();
      vi.setSystemTime(now);
      mockRedis.zcount.mockResolvedValue(5);
      mockRedis.zrange.mockResolvedValue([String(now - 30000)]); // Oldest entry 30s ago

      const result = await limiter.check({
        key: 'client_abc:meta:posts',
        limit: 10,
        windowMs: 60000,
      });

      // Reset when oldest entry expires: 60s - 30s = 30s from now
      expect(result.resetAt).toBeCloseTo(now + 30000, -2);
    });
  });

  describe('record', () => {
    it('should add entry to sorted set', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      await limiter.record({
        key: 'client_abc:meta:posts',
        windowMs: 60000,
        cost: 1,
      });

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        expect.stringContaining('client_abc:meta:posts'),
        now,
        expect.any(String)
      );
    });

    it('should add multiple entries for cost > 1', async () => {
      await limiter.record({
        key: 'client_abc:llm:tokens',
        windowMs: 60000,
        cost: 1000,
      });

      // For efficiency, we store cost as a single entry with weight
      expect(mockRedis.zadd).toHaveBeenCalled();
    });

    it('should set expiration on key', async () => {
      await limiter.record({
        key: 'client_abc:meta:posts',
        windowMs: 60000,
        cost: 1,
      });

      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.any(String),
        60 // windowMs in seconds
      );
    });

    it('should clean up old entries', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      await limiter.record({
        key: 'client_abc:meta:posts',
        windowMs: 60000,
        cost: 1,
      });

      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        expect.any(String),
        '-inf',
        now - 60000
      );
    });
  });

  describe('getUsage', () => {
    it('should return current count', async () => {
      mockRedis.zcount.mockResolvedValue(42);

      const usage = await limiter.getUsage({
        key: 'client_abc:meta:posts',
        windowMs: 60000,
      });

      expect(usage.count).toBe(42);
    });

    it('should return entries in window', async () => {
      const now = Date.now();
      vi.setSystemTime(now);
      mockRedis.zrangebyscore.mockResolvedValue([
        String(now - 30000),
        String(now - 20000),
        String(now - 10000),
      ]);

      const usage = await limiter.getUsage({
        key: 'client_abc:meta:posts',
        windowMs: 60000,
        includeEntries: true,
      });

      expect(usage.entries).toHaveLength(3);
    });
  });
});
```

#### 1.3 Create Token Bucket Tests

**File:** `packages/policy/src/rate-limit/__tests__/token-bucket.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createTokenBucketLimiter, TokenBucketLimiter } from '../token-bucket';
import { createMockRedis } from '@rtv/testing';

describe('TokenBucketLimiter', () => {
  let limiter: TokenBucketLimiter;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRedis = createMockRedis();
    limiter = createTokenBucketLimiter({ redis: mockRedis });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('check', () => {
    it('should allow when bucket has tokens', async () => {
      // Bucket state: 50 tokens, last refill was recent
      mockRedis.hgetall.mockResolvedValue({
        tokens: '50',
        lastRefill: String(Date.now()),
      });

      const result = await limiter.check({
        key: 'client_abc:api',
        capacity: 100,
        refillRate: 10,
        refillIntervalMs: 1000,
        cost: 1,
      });

      expect(result.allowed).toBe(true);
      expect(result.tokensAvailable).toBe(49);
    });

    it('should refill tokens based on elapsed time', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Bucket was at 10 tokens, 5 seconds ago
      // Refill rate: 10 tokens/second = 50 new tokens
      mockRedis.hgetall.mockResolvedValue({
        tokens: '10',
        lastRefill: String(now - 5000),
      });

      const result = await limiter.check({
        key: 'client_abc:api',
        capacity: 100,
        refillRate: 10,
        refillIntervalMs: 1000,
        cost: 1,
      });

      expect(result.allowed).toBe(true);
      // 10 + 50 = 60 (capped at 100), minus 1 for this request
      expect(result.tokensAvailable).toBe(59);
    });

    it('should cap refill at capacity', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Bucket was at 90 tokens, 60 seconds ago (would refill 600)
      mockRedis.hgetall.mockResolvedValue({
        tokens: '90',
        lastRefill: String(now - 60000),
      });

      const result = await limiter.check({
        key: 'client_abc:api',
        capacity: 100,
        refillRate: 10,
        refillIntervalMs: 1000,
        cost: 1,
      });

      expect(result.tokensAvailable).toBe(99); // Capped at 100, minus 1
    });

    it('should deny when insufficient tokens', async () => {
      mockRedis.hgetall.mockResolvedValue({
        tokens: '5',
        lastRefill: String(Date.now()),
      });

      const result = await limiter.check({
        key: 'client_abc:api',
        capacity: 100,
        refillRate: 10,
        refillIntervalMs: 1000,
        cost: 10, // Need 10, only have 5
      });

      expect(result.allowed).toBe(false);
      expect(result.tokensAvailable).toBe(5);
    });

    it('should initialize new bucket at capacity', async () => {
      mockRedis.hgetall.mockResolvedValue(null); // No bucket exists

      const result = await limiter.check({
        key: 'client_abc:api',
        capacity: 100,
        refillRate: 10,
        refillIntervalMs: 1000,
        cost: 1,
      });

      expect(result.allowed).toBe(true);
      expect(result.tokensAvailable).toBe(99); // 100 - 1
    });
  });

  describe('consume', () => {
    it('should decrement tokens and update lastRefill', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      mockRedis.hgetall.mockResolvedValue({
        tokens: '50',
        lastRefill: String(now),
      });

      await limiter.consume({
        key: 'client_abc:api',
        capacity: 100,
        refillRate: 10,
        refillIntervalMs: 1000,
        cost: 5,
      });

      expect(mockRedis.hset).toHaveBeenCalledWith(
        expect.any(String),
        'tokens', '45',
        'lastRefill', String(now)
      );
    });
  });

  describe('getState', () => {
    it('should return current bucket state', async () => {
      const now = Date.now();
      mockRedis.hgetall.mockResolvedValue({
        tokens: '75',
        lastRefill: String(now - 1000),
      });

      const state = await limiter.getState({
        key: 'client_abc:api',
        capacity: 100,
        refillRate: 10,
        refillIntervalMs: 1000,
      });

      expect(state.tokens).toBe(85); // 75 + 10 (1 second of refill)
      expect(state.capacity).toBe(100);
    });
  });
});
```

#### 1.4 Create Rate Limit Service Tests

**File:** `packages/policy/src/rate-limit/__tests__/rate-limit-service.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRateLimitService, RateLimitService } from '../rate-limit-service';
import { createMockDb, createMockRedis, createMockAudit } from '@rtv/testing';
import { RateLimitConfig } from '../types';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockAudit: ReturnType<typeof createMockAudit>;

  const sampleConfig: RateLimitConfig = {
    id: 'rl_meta_posts',
    name: 'Meta Posts',
    category: 'platform',
    resource: 'meta:posts',
    limit: 200,
    window: { type: 'sliding', durationMs: 86400000 },
    scope: 'client',
    enabled: true,
  };

  beforeEach(() => {
    mockDb = createMockDb();
    mockRedis = createMockRedis();
    mockAudit = createMockAudit();

    // Default mock: no usage
    mockRedis.zcount.mockResolvedValue(0);

    service = createRateLimitService({
      db: mockDb,
      redis: mockRedis,
      audit: mockAudit,
      configs: [sampleConfig],
    });
  });

  describe('check', () => {
    it('should allow when under limit', async () => {
      mockRedis.zcount.mockResolvedValue(50);

      const result = await service.check({
        resource: 'meta:posts',
        clientId: 'client_abc',
      });

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(200);
      expect(result.remaining).toBe(149); // 200 - 50 - 1
    });

    it('should deny when over limit', async () => {
      mockRedis.zcount.mockResolvedValue(200);

      const result = await service.check({
        resource: 'meta:posts',
        clientId: 'client_abc',
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should emit event when limit exceeded', async () => {
      mockRedis.zcount.mockResolvedValue(200);

      await service.check({
        resource: 'meta:posts',
        clientId: 'client_abc',
      });

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'RATE_LIMIT_EXCEEDED',
        actor: 'system',
        target: 'client_abc',
        metadata: expect.objectContaining({
          resource: 'meta:posts',
          limit: 200,
          current: 200,
        }),
      });
    });

    it('should apply client-specific overrides', async () => {
      // Register client override
      await service.setOverride({
        clientId: 'client_vip',
        resource: 'meta:posts',
        limit: 500, // VIP gets more posts
        reason: 'Enterprise tier',
        setBy: 'admin',
      });

      mockRedis.zcount.mockResolvedValue(250);

      const result = await service.check({
        resource: 'meta:posts',
        clientId: 'client_vip',
      });

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(500);
    });

    it('should handle unknown resource', async () => {
      const result = await service.check({
        resource: 'unknown:resource',
        clientId: 'client_abc',
      });

      // Unknown resources are allowed (no limit defined)
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
    });
  });

  describe('consume', () => {
    it('should record usage when allowed', async () => {
      mockRedis.zcount.mockResolvedValue(50);

      const result = await service.consume({
        resource: 'meta:posts',
        clientId: 'client_abc',
        cost: 1,
      });

      expect(result.allowed).toBe(true);
      expect(mockRedis.zadd).toHaveBeenCalled();
    });

    it('should not record usage when denied', async () => {
      mockRedis.zcount.mockResolvedValue(200);

      const result = await service.consume({
        resource: 'meta:posts',
        clientId: 'client_abc',
        cost: 1,
      });

      expect(result.allowed).toBe(false);
      expect(mockRedis.zadd).not.toHaveBeenCalled();
    });

    it('should handle custom cost', async () => {
      mockRedis.zcount.mockResolvedValue(195);

      // Requesting 10, only 5 remaining
      const result = await service.consume({
        resource: 'meta:posts',
        clientId: 'client_abc',
        cost: 10,
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe('getUsage', () => {
    it('should return current usage for client', async () => {
      mockRedis.zcount.mockResolvedValue(75);

      const usage = await service.getUsage({
        clientId: 'client_abc',
        resource: 'meta:posts',
      });

      expect(usage.current).toBe(75);
      expect(usage.limit).toBe(200);
      expect(usage.percentage).toBe(37.5);
    });

    it('should return all resource usage for client', async () => {
      // Mock multiple resource counts
      mockRedis.zcount
        .mockResolvedValueOnce(75)  // meta:posts
        .mockResolvedValueOnce(30); // meta:dms

      const allUsage = await service.getAllUsage({
        clientId: 'client_abc',
      });

      expect(allUsage).toHaveLength(1); // Only meta:posts is configured
    });
  });

  describe('resetUsage', () => {
    it('should clear usage for specific resource', async () => {
      await service.resetUsage({
        clientId: 'client_abc',
        resource: 'meta:posts',
        reason: 'Manual reset for testing',
        resetBy: 'admin',
      });

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining('client_abc:meta:posts')
      );

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'RATE_LIMIT_RESET',
        actor: 'admin',
        target: 'client_abc',
        metadata: expect.objectContaining({
          resource: 'meta:posts',
          reason: 'Manual reset for testing',
        }),
      });
    });
  });

  describe('multiple rate limits', () => {
    it('should check all applicable limits', async () => {
      const multiService = createRateLimitService({
        db: mockDb,
        redis: mockRedis,
        audit: mockAudit,
        configs: [
          {
            id: 'rl_platform',
            name: 'Platform Limit',
            category: 'platform',
            resource: 'meta:posts',
            limit: 200,
            window: { type: 'sliding', durationMs: 86400000 },
            scope: 'client',
            enabled: true,
          },
          {
            id: 'rl_business',
            name: 'Business Limit',
            category: 'business',
            resource: 'meta:posts',
            limit: 100, // More restrictive
            window: { type: 'fixed', durationMs: 2592000000, anchor: 'month_start' },
            scope: 'client',
            enabled: true,
          },
        ],
      });

      mockRedis.zcount.mockResolvedValue(90); // Under platform, close to business

      const result = await multiService.check({
        resource: 'meta:posts',
        clientId: 'client_abc',
      });

      // Should respect the more restrictive limit
      expect(result.allowed).toBe(true);
      expect(result.limits).toHaveLength(2);
    });
  });
});
```

#### 1.5 Run Tests (Expect Failures)

```bash
cd packages/policy
pnpm test:watch src/rate-limit/
```

---

### Phase 2: Implementation

#### 2.1 Create Rate Limit Types

**File:** `packages/policy/src/rate-limit/types.ts`

```typescript
import { z } from 'zod';

/**
 * Window Types
 */
export const SlidingWindowSchema = z.object({
  type: z.literal('sliding'),
  durationMs: z.number().int().positive(),
});

export const FixedWindowSchema = z.object({
  type: z.literal('fixed'),
  durationMs: z.number().int().positive(),
  anchor: z.enum(['hour_start', 'day_start', 'week_start', 'month_start']),
});

export const TokenBucketWindowSchema = z.object({
  type: z.literal('token_bucket'),
  refillRate: z.number().positive(),
  refillIntervalMs: z.number().int().positive(),
});

export const RateLimitWindowSchema = z.discriminatedUnion('type', [
  SlidingWindowSchema,
  FixedWindowSchema,
  TokenBucketWindowSchema,
]);

export type RateLimitWindow = z.infer<typeof RateLimitWindowSchema>;

/**
 * Rate Limit Categories
 */
export const RateLimitCategorySchema = z.enum([
  'platform',  // External platform limits
  'system',    // Our infrastructure limits
  'business',  // Client tier limits
]);
export type RateLimitCategory = z.infer<typeof RateLimitCategorySchema>;

/**
 * Rate Limit Scope
 */
export const RateLimitScopeSchema = z.enum([
  'global',    // Across all clients
  'client',    // Per client
  'account',   // Per social account
  'user',      // Per human user
]);
export type RateLimitScope = z.infer<typeof RateLimitScopeSchema>;

/**
 * Rate Limit Configuration
 */
export const RateLimitConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: RateLimitCategorySchema,
  resource: z.string(), // e.g., "meta:posts", "llm:tokens", "api:requests"
  limit: z.number().int().positive(),
  window: RateLimitWindowSchema,
  scope: RateLimitScopeSchema,
  enabled: z.boolean().default(true),
  // Optional soft limit (warning threshold)
  softLimit: z.number().int().positive().optional(),
  // Optional burst allowance
  burstLimit: z.number().int().positive().optional(),
  burstWindow: z.number().int().positive().optional(), // ms
});
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

/**
 * Check Context
 */
export const RateLimitCheckContextSchema = z.object({
  resource: z.string(),
  clientId: z.string(),
  accountId: z.string().optional(),
  userId: z.string().optional(),
  cost: z.number().positive().default(1),
});
export type RateLimitCheckContext = z.infer<typeof RateLimitCheckContextSchema>;

/**
 * Check Result
 */
export const RateLimitCheckResultSchema = z.object({
  allowed: z.boolean(),
  limit: z.number().nullable(),
  remaining: z.number(),
  current: z.number(),
  resetAt: z.number(), // Unix timestamp ms
  retryAfter: z.number().nullable(), // ms until next allowed request
  limits: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: RateLimitCategorySchema,
    limit: z.number(),
    current: z.number(),
    remaining: z.number(),
    allowed: z.boolean(),
  })).optional(),
});
export type RateLimitCheckResult = z.infer<typeof RateLimitCheckResultSchema>;

/**
 * Usage Query
 */
export const RateLimitUsageQuerySchema = z.object({
  clientId: z.string(),
  resource: z.string().optional(),
  accountId: z.string().optional(),
});
export type RateLimitUsageQuery = z.infer<typeof RateLimitUsageQuerySchema>;

/**
 * Usage Result
 */
export const RateLimitUsageResultSchema = z.object({
  resource: z.string(),
  current: z.number(),
  limit: z.number(),
  percentage: z.number(),
  resetAt: z.number(),
  category: RateLimitCategorySchema,
});
export type RateLimitUsageResult = z.infer<typeof RateLimitUsageResultSchema>;

/**
 * Override Configuration
 */
export const RateLimitOverrideSchema = z.object({
  clientId: z.string(),
  resource: z.string(),
  limit: z.number().int().positive(),
  reason: z.string(),
  setBy: z.string(),
  expiresAt: z.date().optional(),
});
export type RateLimitOverride = z.infer<typeof RateLimitOverrideSchema>;

/**
 * Reset Input
 */
export const RateLimitResetInputSchema = z.object({
  clientId: z.string(),
  resource: z.string(),
  reason: z.string(),
  resetBy: z.string(),
});
export type RateLimitResetInput = z.infer<typeof RateLimitResetInputSchema>;

/**
 * Consume Input
 */
export const RateLimitConsumeInputSchema = z.object({
  resource: z.string(),
  clientId: z.string(),
  accountId: z.string().optional(),
  userId: z.string().optional(),
  cost: z.number().positive().default(1),
  metadata: z.record(z.unknown()).optional(),
});
export type RateLimitConsumeInput = z.infer<typeof RateLimitConsumeInputSchema>;
```

#### 2.2 Create Sliding Window Limiter

**File:** `packages/policy/src/rate-limit/sliding-window.ts`

```typescript
import { nanoid } from 'nanoid';
import type { Redis } from 'ioredis';

const KEY_PREFIX = 'rl:sw:';

interface SlidingWindowCheckInput {
  key: string;
  limit: number;
  windowMs: number;
  cost?: number;
}

interface SlidingWindowRecordInput {
  key: string;
  windowMs: number;
  cost?: number;
  metadata?: Record<string, unknown>;
}

interface SlidingWindowUsageInput {
  key: string;
  windowMs: number;
  includeEntries?: boolean;
}

interface SlidingWindowCheckResult {
  allowed: boolean;
  current: number;
  remaining: number;
  resetAt: number;
}

interface SlidingWindowUsageResult {
  count: number;
  entries?: number[];
  oldestEntry?: number;
  newestEntry?: number;
}

interface SlidingWindowLimiterDeps {
  redis: Redis;
}

export interface SlidingWindowLimiter {
  check(input: SlidingWindowCheckInput): Promise<SlidingWindowCheckResult>;
  record(input: SlidingWindowRecordInput): Promise<void>;
  getUsage(input: SlidingWindowUsageInput): Promise<SlidingWindowUsageResult>;
}

export function createSlidingWindowLimiter(deps: SlidingWindowLimiterDeps): SlidingWindowLimiter {
  const { redis } = deps;

  function buildKey(key: string): string {
    return `${KEY_PREFIX}${key}`;
  }

  return {
    async check(input: SlidingWindowCheckInput): Promise<SlidingWindowCheckResult> {
      const { key, limit, windowMs, cost = 1 } = input;
      const redisKey = buildKey(key);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get current count in window
      const current = await redis.zcount(redisKey, windowStart, now);

      // Check if adding cost would exceed limit
      const allowed = current + cost <= limit;
      const remaining = Math.max(0, limit - current - (allowed ? cost : 0));

      // Calculate reset time (when oldest entry expires)
      let resetAt = now + windowMs;
      if (current > 0) {
        const oldest = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
        if (oldest.length >= 2) {
          const oldestTimestamp = parseInt(oldest[1], 10);
          resetAt = oldestTimestamp + windowMs;
        }
      }

      return {
        allowed,
        current,
        remaining,
        resetAt,
      };
    },

    async record(input: SlidingWindowRecordInput): Promise<void> {
      const { key, windowMs, cost = 1, metadata } = input;
      const redisKey = buildKey(key);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Use pipeline for atomic operations
      const pipeline = redis.pipeline();

      // Clean up expired entries
      pipeline.zremrangebyscore(redisKey, '-inf', windowStart);

      // Add new entry(ies)
      // For cost > 1, we add a single entry with a unique member
      // The zcount will count it as 1, but we track cost separately
      // Alternative: add `cost` number of entries (expensive for large costs)
      const member = `${now}:${nanoid(8)}:${cost}`;
      pipeline.zadd(redisKey, now, member);

      // Set key expiration
      pipeline.expire(redisKey, Math.ceil(windowMs / 1000));

      await pipeline.exec();
    },

    async getUsage(input: SlidingWindowUsageInput): Promise<SlidingWindowUsageResult> {
      const { key, windowMs, includeEntries } = input;
      const redisKey = buildKey(key);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get count
      const count = await redis.zcount(redisKey, windowStart, now);

      const result: SlidingWindowUsageResult = { count };

      if (includeEntries) {
        const entries = await redis.zrangebyscore(
          redisKey,
          windowStart,
          now,
          'WITHSCORES'
        );

        // Parse entries (member, score pairs)
        const timestamps: number[] = [];
        for (let i = 1; i < entries.length; i += 2) {
          timestamps.push(parseInt(entries[i], 10));
        }

        result.entries = timestamps;
        if (timestamps.length > 0) {
          result.oldestEntry = Math.min(...timestamps);
          result.newestEntry = Math.max(...timestamps);
        }
      }

      return result;
    },
  };
}
```

#### 2.3 Create Token Bucket Limiter

**File:** `packages/policy/src/rate-limit/token-bucket.ts`

```typescript
import type { Redis } from 'ioredis';

const KEY_PREFIX = 'rl:tb:';

interface TokenBucketInput {
  key: string;
  capacity: number;
  refillRate: number;
  refillIntervalMs: number;
  cost?: number;
}

interface TokenBucketCheckResult {
  allowed: boolean;
  tokensAvailable: number;
  capacity: number;
  refillRate: number;
  nextRefillAt: number;
}

interface TokenBucketState {
  tokens: number;
  capacity: number;
  refillRate: number;
  refillIntervalMs: number;
  lastRefill: number;
}

interface TokenBucketLimiterDeps {
  redis: Redis;
}

export interface TokenBucketLimiter {
  check(input: TokenBucketInput): Promise<TokenBucketCheckResult>;
  consume(input: TokenBucketInput): Promise<void>;
  getState(input: TokenBucketInput): Promise<TokenBucketState>;
  reset(key: string, capacity: number): Promise<void>;
}

export function createTokenBucketLimiter(deps: TokenBucketLimiterDeps): TokenBucketLimiter {
  const { redis } = deps;

  function buildKey(key: string): string {
    return `${KEY_PREFIX}${key}`;
  }

  /**
   * Calculate current tokens based on time elapsed since last refill
   */
  function calculateCurrentTokens(
    storedTokens: number,
    lastRefill: number,
    capacity: number,
    refillRate: number,
    refillIntervalMs: number,
    now: number
  ): number {
    const elapsed = now - lastRefill;
    const intervals = Math.floor(elapsed / refillIntervalMs);
    const refilled = intervals * refillRate;
    return Math.min(capacity, storedTokens + refilled);
  }

  return {
    async check(input: TokenBucketInput): Promise<TokenBucketCheckResult> {
      const { key, capacity, refillRate, refillIntervalMs, cost = 1 } = input;
      const redisKey = buildKey(key);
      const now = Date.now();

      // Get current state
      const state = await redis.hgetall(redisKey);

      let tokens: number;
      let lastRefill: number;

      if (!state || Object.keys(state).length === 0) {
        // Initialize new bucket at full capacity
        tokens = capacity;
        lastRefill = now;
      } else {
        tokens = parseFloat(state.tokens);
        lastRefill = parseInt(state.lastRefill, 10);

        // Calculate refilled tokens
        tokens = calculateCurrentTokens(
          tokens,
          lastRefill,
          capacity,
          refillRate,
          refillIntervalMs,
          now
        );
      }

      const allowed = tokens >= cost;
      const tokensAvailable = allowed ? tokens - cost : tokens;
      const nextRefillAt = lastRefill + refillIntervalMs;

      return {
        allowed,
        tokensAvailable,
        capacity,
        refillRate,
        nextRefillAt,
      };
    },

    async consume(input: TokenBucketInput): Promise<void> {
      const { key, capacity, refillRate, refillIntervalMs, cost = 1 } = input;
      const redisKey = buildKey(key);
      const now = Date.now();

      // Get current state
      const state = await redis.hgetall(redisKey);

      let tokens: number;
      let lastRefill: number;

      if (!state || Object.keys(state).length === 0) {
        tokens = capacity;
        lastRefill = now;
      } else {
        tokens = parseFloat(state.tokens);
        lastRefill = parseInt(state.lastRefill, 10);

        // Calculate refilled tokens
        const elapsed = now - lastRefill;
        const intervals = Math.floor(elapsed / refillIntervalMs);
        if (intervals > 0) {
          tokens = Math.min(capacity, tokens + intervals * refillRate);
          lastRefill = now;
        }
      }

      // Consume tokens
      const newTokens = Math.max(0, tokens - cost);

      // Update state
      await redis.hset(
        redisKey,
        'tokens', String(newTokens),
        'lastRefill', String(lastRefill)
      );

      // Set expiration (cleanup inactive buckets)
      await redis.expire(redisKey, 86400); // 24 hours
    },

    async getState(input: TokenBucketInput): Promise<TokenBucketState> {
      const { key, capacity, refillRate, refillIntervalMs } = input;
      const redisKey = buildKey(key);
      const now = Date.now();

      const state = await redis.hgetall(redisKey);

      if (!state || Object.keys(state).length === 0) {
        return {
          tokens: capacity,
          capacity,
          refillRate,
          refillIntervalMs,
          lastRefill: now,
        };
      }

      const storedTokens = parseFloat(state.tokens);
      const lastRefill = parseInt(state.lastRefill, 10);

      const currentTokens = calculateCurrentTokens(
        storedTokens,
        lastRefill,
        capacity,
        refillRate,
        refillIntervalMs,
        now
      );

      return {
        tokens: currentTokens,
        capacity,
        refillRate,
        refillIntervalMs,
        lastRefill,
      };
    },

    async reset(key: string, capacity: number): Promise<void> {
      const redisKey = buildKey(key);
      await redis.hset(
        redisKey,
        'tokens', String(capacity),
        'lastRefill', String(Date.now())
      );
    },
  };
}
```

#### 2.4 Create Rate Limit Service

**File:** `packages/policy/src/rate-limit/rate-limit-service.ts`

```typescript
import type { Redis } from 'ioredis';
import {
  RateLimitConfig,
  RateLimitCheckContext,
  RateLimitCheckResult,
  RateLimitConsumeInput,
  RateLimitUsageQuery,
  RateLimitUsageResult,
  RateLimitOverride,
  RateLimitResetInput,
  RateLimitCheckContextSchema,
  RateLimitConsumeInputSchema,
} from './types';
import { createSlidingWindowLimiter, SlidingWindowLimiter } from './sliding-window';
import { createTokenBucketLimiter, TokenBucketLimiter } from './token-bucket';
import type { AuditEmitter } from '@rtv/audit';

interface RateLimitServiceDeps {
  db: {
    select: () => any;
    insert: (table: any) => any;
    update: (table: any) => any;
  };
  redis: Redis;
  audit: AuditEmitter;
  configs: RateLimitConfig[];
}

export interface RateLimitService {
  /**
   * Check if an action would be allowed
   */
  check(context: RateLimitCheckContext): Promise<RateLimitCheckResult>;

  /**
   * Check and consume quota
   */
  consume(input: RateLimitConsumeInput): Promise<RateLimitCheckResult>;

  /**
   * Get current usage for a resource
   */
  getUsage(query: RateLimitUsageQuery): Promise<RateLimitUsageResult>;

  /**
   * Get all usage for a client
   */
  getAllUsage(query: { clientId: string }): Promise<RateLimitUsageResult[]>;

  /**
   * Set a client-specific override
   */
  setOverride(override: RateLimitOverride): Promise<void>;

  /**
   * Remove an override
   */
  removeOverride(clientId: string, resource: string): Promise<void>;

  /**
   * Reset usage for a resource
   */
  resetUsage(input: RateLimitResetInput): Promise<void>;

  /**
   * Get all configurations
   */
  getConfigs(): RateLimitConfig[];
}

export function createRateLimitService(deps: RateLimitServiceDeps): RateLimitService {
  const { db, redis, audit, configs } = deps;

  // Initialize limiters
  const slidingWindow: SlidingWindowLimiter = createSlidingWindowLimiter({ redis });
  const tokenBucket: TokenBucketLimiter = createTokenBucketLimiter({ redis });

  // In-memory override cache (could be Redis for distributed)
  const overrides = new Map<string, RateLimitOverride>();

  /**
   * Build key for rate limit tracking
   */
  function buildKey(config: RateLimitConfig, context: RateLimitCheckContext): string {
    const parts = [context.clientId, config.resource];

    if (config.scope === 'account' && context.accountId) {
      parts.push(context.accountId);
    }
    if (config.scope === 'user' && context.userId) {
      parts.push(context.userId);
    }

    return parts.join(':');
  }

  /**
   * Get effective limit (considering overrides)
   */
  function getEffectiveLimit(config: RateLimitConfig, clientId: string): number {
    const overrideKey = `${clientId}:${config.resource}`;
    const override = overrides.get(overrideKey);

    if (override) {
      // Check expiration
      if (override.expiresAt && override.expiresAt < new Date()) {
        overrides.delete(overrideKey);
      } else {
        return override.limit;
      }
    }

    return config.limit;
  }

  /**
   * Find configs for a resource
   */
  function findConfigs(resource: string): RateLimitConfig[] {
    return configs.filter(c => c.resource === resource && c.enabled);
  }

  /**
   * Calculate fixed window start
   */
  function getFixedWindowStart(anchor: string): number {
    const now = new Date();
    switch (anchor) {
      case 'hour_start':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
      case 'day_start':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      case 'week_start': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(now.getFullYear(), now.getMonth(), diff).getTime();
      }
      case 'month_start':
        return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      default:
        return Date.now();
    }
  }

  return {
    async check(context: RateLimitCheckContext): Promise<RateLimitCheckResult> {
      const validated = RateLimitCheckContextSchema.parse(context);
      const resourceConfigs = findConfigs(validated.resource);

      if (resourceConfigs.length === 0) {
        // No limit configured
        return {
          allowed: true,
          limit: null,
          remaining: Infinity,
          current: 0,
          resetAt: Date.now() + 86400000,
          retryAfter: null,
        };
      }

      const results: Array<{
        id: string;
        name: string;
        category: RateLimitConfig['category'];
        limit: number;
        current: number;
        remaining: number;
        allowed: boolean;
        resetAt: number;
      }> = [];

      let anyDenied = false;
      let earliestReset = Infinity;
      let lowestRemaining = Infinity;

      for (const config of resourceConfigs) {
        const key = buildKey(config, validated);
        const effectiveLimit = getEffectiveLimit(config, validated.clientId);
        let checkResult: { allowed: boolean; current: number; remaining: number; resetAt: number };

        if (config.window.type === 'sliding') {
          checkResult = await slidingWindow.check({
            key,
            limit: effectiveLimit,
            windowMs: config.window.durationMs,
            cost: validated.cost,
          });
        } else if (config.window.type === 'fixed') {
          const windowStart = getFixedWindowStart(config.window.anchor);
          const windowMs = config.window.durationMs;
          checkResult = await slidingWindow.check({
            key: `${key}:${windowStart}`,
            limit: effectiveLimit,
            windowMs,
            cost: validated.cost,
          });
        } else if (config.window.type === 'token_bucket') {
          const tbResult = await tokenBucket.check({
            key,
            capacity: effectiveLimit,
            refillRate: config.window.refillRate,
            refillIntervalMs: config.window.refillIntervalMs,
            cost: validated.cost,
          });
          checkResult = {
            allowed: tbResult.allowed,
            current: effectiveLimit - tbResult.tokensAvailable,
            remaining: tbResult.tokensAvailable,
            resetAt: tbResult.nextRefillAt,
          };
        } else {
          continue;
        }

        results.push({
          id: config.id,
          name: config.name,
          category: config.category,
          limit: effectiveLimit,
          current: checkResult.current,
          remaining: checkResult.remaining,
          allowed: checkResult.allowed,
        });

        if (!checkResult.allowed) {
          anyDenied = true;
        }

        earliestReset = Math.min(earliestReset, checkResult.resetAt);
        lowestRemaining = Math.min(lowestRemaining, checkResult.remaining);
      }

      const mostRestrictive = results.reduce((prev, curr) =>
        curr.remaining < prev.remaining ? curr : prev
      );

      // Emit event if denied
      if (anyDenied) {
        await audit.emit({
          type: 'RATE_LIMIT_EXCEEDED',
          actor: 'system',
          target: validated.clientId,
          metadata: {
            resource: validated.resource,
            limit: mostRestrictive.limit,
            current: mostRestrictive.current,
            cost: validated.cost,
            limitId: mostRestrictive.id,
          },
        });
      }

      return {
        allowed: !anyDenied,
        limit: mostRestrictive.limit,
        remaining: lowestRemaining,
        current: mostRestrictive.current,
        resetAt: earliestReset,
        retryAfter: anyDenied ? earliestReset - Date.now() : null,
        limits: results,
      };
    },

    async consume(input: RateLimitConsumeInput): Promise<RateLimitCheckResult> {
      const validated = RateLimitConsumeInputSchema.parse(input);

      // Check first
      const checkResult = await this.check({
        resource: validated.resource,
        clientId: validated.clientId,
        accountId: validated.accountId,
        userId: validated.userId,
        cost: validated.cost,
      });

      if (!checkResult.allowed) {
        return checkResult;
      }

      // Record usage
      const resourceConfigs = findConfigs(validated.resource);

      for (const config of resourceConfigs) {
        const key = buildKey(config, validated);

        if (config.window.type === 'sliding') {
          await slidingWindow.record({
            key,
            windowMs: config.window.durationMs,
            cost: validated.cost,
            metadata: validated.metadata,
          });
        } else if (config.window.type === 'fixed') {
          const windowStart = getFixedWindowStart(config.window.anchor);
          await slidingWindow.record({
            key: `${key}:${windowStart}`,
            windowMs: config.window.durationMs,
            cost: validated.cost,
            metadata: validated.metadata,
          });
        } else if (config.window.type === 'token_bucket') {
          await tokenBucket.consume({
            key,
            capacity: getEffectiveLimit(config, validated.clientId),
            refillRate: config.window.refillRate,
            refillIntervalMs: config.window.refillIntervalMs,
            cost: validated.cost,
          });
        }
      }

      return checkResult;
    },

    async getUsage(query: RateLimitUsageQuery): Promise<RateLimitUsageResult> {
      const config = configs.find(c => c.resource === query.resource);

      if (!config) {
        throw new Error(`Unknown resource: ${query.resource}`);
      }

      const key = buildKey(config, {
        resource: query.resource,
        clientId: query.clientId,
        accountId: query.accountId,
        cost: 0,
      });

      const effectiveLimit = getEffectiveLimit(config, query.clientId);

      let current = 0;
      let resetAt = Date.now();

      if (config.window.type === 'sliding') {
        const usage = await slidingWindow.getUsage({
          key,
          windowMs: config.window.durationMs,
        });
        current = usage.count;
        resetAt = Date.now() + config.window.durationMs;
      } else if (config.window.type === 'token_bucket') {
        const state = await tokenBucket.getState({
          key,
          capacity: effectiveLimit,
          refillRate: config.window.refillRate,
          refillIntervalMs: config.window.refillIntervalMs,
        });
        current = effectiveLimit - state.tokens;
        resetAt = state.lastRefill + config.window.refillIntervalMs;
      }

      return {
        resource: query.resource,
        current,
        limit: effectiveLimit,
        percentage: (current / effectiveLimit) * 100,
        resetAt,
        category: config.category,
      };
    },

    async getAllUsage(query: { clientId: string }): Promise<RateLimitUsageResult[]> {
      const results: RateLimitUsageResult[] = [];

      for (const config of configs) {
        if (!config.enabled) continue;

        try {
          const usage = await this.getUsage({
            clientId: query.clientId,
            resource: config.resource,
          });
          results.push(usage);
        } catch {
          // Skip errors for individual resources
        }
      }

      return results;
    },

    async setOverride(override: RateLimitOverride): Promise<void> {
      const key = `${override.clientId}:${override.resource}`;
      overrides.set(key, override);

      await audit.emit({
        type: 'RATE_LIMIT_OVERRIDE_SET',
        actor: override.setBy,
        target: override.clientId,
        metadata: {
          resource: override.resource,
          limit: override.limit,
          reason: override.reason,
          expiresAt: override.expiresAt,
        },
      });
    },

    async removeOverride(clientId: string, resource: string): Promise<void> {
      const key = `${clientId}:${resource}`;
      overrides.delete(key);
    },

    async resetUsage(input: RateLimitResetInput): Promise<void> {
      const config = configs.find(c => c.resource === input.resource);

      if (!config) {
        throw new Error(`Unknown resource: ${input.resource}`);
      }

      const key = buildKey(config, {
        resource: input.resource,
        clientId: input.clientId,
        cost: 0,
      });

      // Delete the key
      await redis.del(`rl:sw:${key}`);
      await redis.del(`rl:tb:${key}`);

      await audit.emit({
        type: 'RATE_LIMIT_RESET',
        actor: input.resetBy,
        target: input.clientId,
        metadata: {
          resource: input.resource,
          reason: input.reason,
        },
      });
    },

    getConfigs(): RateLimitConfig[] {
      return [...configs];
    },
  };
}
```

#### 2.5 Create Default Configurations

**File:** `packages/policy/src/rate-limit/default-configs.ts`

```typescript
import { RateLimitConfig } from './types';

const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const MINUTE_MS = 60000;
const MONTH_MS = 2592000000;

/**
 * Default rate limit configurations for the platform
 */
export const defaultRateLimitConfigs: RateLimitConfig[] = [
  // ===== PLATFORM LIMITS =====

  // Meta (Facebook + Instagram)
  {
    id: 'rl_meta_posts',
    name: 'Meta Posts',
    description: 'Daily post limit for Meta platforms',
    category: 'platform',
    resource: 'meta:posts',
    limit: 200,
    window: { type: 'sliding', durationMs: DAY_MS },
    scope: 'account',
    enabled: true,
  },
  {
    id: 'rl_meta_dms',
    name: 'Meta DMs',
    description: 'Hourly DM limit for Meta platforms',
    category: 'platform',
    resource: 'meta:dms',
    limit: 100,
    window: { type: 'sliding', durationMs: HOUR_MS },
    scope: 'account',
    enabled: true,
  },
  {
    id: 'rl_meta_comments',
    name: 'Meta Comments',
    description: 'Hourly comment limit for Meta platforms',
    category: 'platform',
    resource: 'meta:comments',
    limit: 200,
    window: { type: 'sliding', durationMs: HOUR_MS },
    scope: 'account',
    enabled: true,
  },

  // TikTok
  {
    id: 'rl_tiktok_videos',
    name: 'TikTok Videos',
    description: 'Daily video upload limit',
    category: 'platform',
    resource: 'tiktok:videos',
    limit: 50,
    window: { type: 'sliding', durationMs: DAY_MS },
    scope: 'account',
    enabled: true,
  },

  // YouTube
  {
    id: 'rl_youtube_videos',
    name: 'YouTube Videos',
    description: 'Daily video upload limit',
    category: 'platform',
    resource: 'youtube:videos',
    limit: 100,
    window: { type: 'sliding', durationMs: DAY_MS },
    scope: 'account',
    enabled: true,
  },

  // LinkedIn
  {
    id: 'rl_linkedin_posts',
    name: 'LinkedIn Posts',
    description: 'Daily post limit',
    category: 'platform',
    resource: 'linkedin:posts',
    limit: 150,
    window: { type: 'sliding', durationMs: DAY_MS },
    scope: 'account',
    enabled: true,
  },

  // X (Twitter)
  {
    id: 'rl_x_posts',
    name: 'X Posts',
    description: 'Hourly post limit',
    category: 'platform',
    resource: 'x:posts',
    limit: 100,
    window: { type: 'sliding', durationMs: HOUR_MS },
    scope: 'account',
    enabled: true,
  },

  // ===== SYSTEM LIMITS =====

  // LLM Tokens
  {
    id: 'rl_llm_tokens',
    name: 'LLM Tokens',
    description: 'Daily token usage limit',
    category: 'system',
    resource: 'llm:tokens',
    limit: 1_000_000, // 1M tokens/day
    window: { type: 'sliding', durationMs: DAY_MS },
    scope: 'client',
    enabled: true,
    softLimit: 800_000, // Warn at 80%
  },

  // Media Generation
  {
    id: 'rl_media_images',
    name: 'Image Generation',
    description: 'Daily image generation limit',
    category: 'system',
    resource: 'media:images',
    limit: 100,
    window: { type: 'sliding', durationMs: DAY_MS },
    scope: 'client',
    enabled: true,
  },
  {
    id: 'rl_media_videos',
    name: 'Video Generation',
    description: 'Daily video generation limit',
    category: 'system',
    resource: 'media:videos',
    limit: 20,
    window: { type: 'sliding', durationMs: DAY_MS },
    scope: 'client',
    enabled: true,
  },

  // Browser Sessions
  {
    id: 'rl_browser_sessions',
    name: 'Browser Sessions',
    description: 'Concurrent browser session limit',
    category: 'system',
    resource: 'browser:sessions',
    limit: 10,
    window: { type: 'token_bucket', refillRate: 1, refillIntervalMs: MINUTE_MS },
    scope: 'client',
    enabled: true,
  },

  // API Requests
  {
    id: 'rl_api_requests',
    name: 'API Requests',
    description: 'Per-minute API request limit',
    category: 'system',
    resource: 'api:requests',
    limit: 1000,
    window: { type: 'token_bucket', refillRate: 100, refillIntervalMs: 1000 },
    scope: 'client',
    enabled: true,
    burstLimit: 50,
    burstWindow: 1000,
  },

  // ===== BUSINESS LIMITS =====

  // Total Posts (monthly)
  {
    id: 'rl_business_posts_starter',
    name: 'Starter Posts',
    description: 'Monthly post limit for Starter tier',
    category: 'business',
    resource: 'business:posts',
    limit: 100,
    window: { type: 'fixed', durationMs: MONTH_MS, anchor: 'month_start' },
    scope: 'client',
    enabled: true,
  },
];

/**
 * Get default config for a resource
 */
export function getDefaultConfig(resource: string): RateLimitConfig | undefined {
  return defaultRateLimitConfigs.find(c => c.resource === resource);
}

/**
 * Get all configs for a category
 */
export function getConfigsByCategory(category: RateLimitConfig['category']): RateLimitConfig[] {
  return defaultRateLimitConfigs.filter(c => c.category === category);
}
```

#### 2.6 Create Module Index

**File:** `packages/policy/src/rate-limit/index.ts`

```typescript
export * from './types';
export * from './sliding-window';
export * from './token-bucket';
export * from './rate-limit-service';
export * from './default-configs';
```

---

### Phase 3: Verification

#### 3.1 Run Tests

```bash
# Run all rate limit tests
cd packages/policy
pnpm test src/rate-limit/

# Run with coverage
pnpm test:coverage src/rate-limit/
```

#### 3.2 Type Check

```bash
pnpm typecheck
```

#### 3.3 Lint

```bash
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/policy/src/rate-limit/types.ts` | Type definitions |
| Create | `packages/policy/src/rate-limit/sliding-window.ts` | Sliding window limiter |
| Create | `packages/policy/src/rate-limit/token-bucket.ts` | Token bucket limiter |
| Create | `packages/policy/src/rate-limit/rate-limit-service.ts` | Main service |
| Create | `packages/policy/src/rate-limit/default-configs.ts` | Default configurations |
| Create | `packages/policy/src/rate-limit/index.ts` | Module exports |
| Create | `packages/policy/src/rate-limit/__tests__/types.test.ts` | Type tests |
| Create | `packages/policy/src/rate-limit/__tests__/sliding-window.test.ts` | Sliding window tests |
| Create | `packages/policy/src/rate-limit/__tests__/token-bucket.test.ts` | Token bucket tests |
| Create | `packages/policy/src/rate-limit/__tests__/rate-limit-service.test.ts` | Service tests |

---

## Acceptance Criteria

- [ ] Sliding window limiter tracks usage over rolling time window
- [ ] Token bucket limiter supports burst traffic with refill
- [ ] Fixed window limiter aligns to calendar boundaries
- [ ] Service checks all applicable limits for a resource
- [ ] Most restrictive limit determines result
- [ ] Client-specific overrides take precedence
- [ ] Usage reset clears all tracking data
- [ ] Audit events emitted on limit exceeded
- [ ] Default configs cover all platform/system/business limits
- [ ] All tests pass with >80% coverage
- [ ] TypeScript compiles with no errors

---

## Test Requirements

### Unit Tests

- Sliding window: check, record, cleanup
- Token bucket: refill calculation, consume, capacity cap
- Fixed window: anchor alignment
- Service: multi-limit checking, override handling

### Integration Tests

- Redis persistence across operations
- Concurrent access handling
- Window expiration

### Performance Tests

- Check latency <5ms
- 10K checks/second throughput
- Memory usage under load

---

## Security & Safety Checklist

- [ ] No hardcoded secrets
- [ ] Client isolation: limits scoped correctly
- [ ] Audit trail: limit exceeded events logged
- [ ] Override tracking: who set what limits
- [ ] Cache TTL: prevents stale data

---

## JSON Task Block

```json
{
  "task_id": "S1-C4",
  "name": "Rate Limiting Policies",
  "status": "pending",
  "complexity": "medium",
  "sprint": 1,
  "agent": "C",
  "dependencies": ["S1-C1"],
  "blocks": ["S1-C5", "S3-B1", "S3-B2", "S3-B3", "S3-B4", "S3-B5", "S3-B6"],
  "estimated_hours": 5,
  "actual_hours": null,
  "files": [
    "packages/policy/src/rate-limit/types.ts",
    "packages/policy/src/rate-limit/sliding-window.ts",
    "packages/policy/src/rate-limit/token-bucket.ts",
    "packages/policy/src/rate-limit/rate-limit-service.ts",
    "packages/policy/src/rate-limit/default-configs.ts",
    "packages/policy/src/rate-limit/index.ts"
  ],
  "test_files": [
    "packages/policy/src/rate-limit/__tests__/types.test.ts",
    "packages/policy/src/rate-limit/__tests__/sliding-window.test.ts",
    "packages/policy/src/rate-limit/__tests__/token-bucket.test.ts",
    "packages/policy/src/rate-limit/__tests__/rate-limit-service.test.ts"
  ],
  "acceptance_criteria": [
    "Sliding window limiter implemented",
    "Token bucket limiter implemented",
    "Multi-limit checking",
    "Client overrides",
    "Default configurations for all platforms"
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
  "artifacts": {
    "files_created": [],
    "tests_passed": null,
    "coverage_percent": null
  },
  "learnings": [],
  "blockers_encountered": []
}
```
