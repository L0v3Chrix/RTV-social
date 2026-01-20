import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createRateLimiterService,
  type RateLimiterService,
  type RateLimitCheckContext,
  DEFAULT_PLATFORM_LIMITS,
} from '../rate-limiting/index.js';

describe('Rate Limiter Service', () => {
  let service: RateLimiterService;
  const auditEvents: unknown[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    auditEvents.length = 0;
    service = createRateLimiterService({
      onAudit: (event) => auditEvents.push(event),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createPolicy', () => {
    test('creates global rate limit policy', async () => {
      const policy = await service.createPolicy({
        name: 'Global Facebook Limit',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 30,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      expect(policy.id).toMatch(/^rl_/);
      expect(policy.scope).toBe('global');
      expect(policy.platform).toBe('facebook');
      expect(policy.clientId).toBeNull();
      expect(policy.config.maxRequests).toBe(30);
    });

    test('creates client-scoped rate limit policy', async () => {
      const policy = await service.createPolicy({
        name: 'Client Instagram Limit',
        scope: 'client',
        clientId: 'client-123',
        platform: 'instagram',
        config: {
          maxRequests: 20,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      expect(policy.scope).toBe('client');
      expect(policy.clientId).toBe('client-123');
    });

    test('requires clientId for client scope', async () => {
      await expect(
        service.createPolicy({
          name: 'Bad Policy',
          scope: 'client',
          platform: 'facebook',
          config: {
            maxRequests: 30,
            windowMs: 60_000,
            strategy: 'sliding_window',
          },
          createdBy: 'admin-1',
        })
      ).rejects.toThrow('Client scope requires clientId');
    });

    test('rejects clientId for global scope', async () => {
      await expect(
        service.createPolicy({
          name: 'Bad Policy',
          scope: 'global',
          clientId: 'client-123',
          platform: 'facebook',
          config: {
            maxRequests: 30,
            windowMs: 60_000,
            strategy: 'sliding_window',
          },
          createdBy: 'admin-1',
        })
      ).rejects.toThrow('Global scope cannot have clientId');
    });

    test('emits audit event on creation', async () => {
      await service.createPolicy({
        name: 'Test Policy',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 30,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      expect(auditEvents).toHaveLength(1);
      expect((auditEvents[0] as { type: string }).type).toBe('RATE_LIMIT_POLICY_CREATED');
    });
  });

  describe('check', () => {
    test('allows requests when no policy exists', async () => {
      const context: RateLimitCheckContext = {
        clientId: 'client-1',
        platform: 'facebook',
        action: 'publish',
      };

      const result = await service.check(context);

      expect(result.allowed).toBe(true);
      expect(result.policy).toBeNull();
      expect(result.usage.remaining).toBe(Infinity);
    });

    test('allows requests within limit', async () => {
      await service.createPolicy({
        name: 'Facebook Limit',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 5,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const context: RateLimitCheckContext = {
        clientId: 'client-1',
        platform: 'facebook',
        action: 'publish',
      };

      // Check and consume 3 requests
      for (let i = 0; i < 3; i++) {
        const result = await service.check(context);
        expect(result.allowed).toBe(true);
        await service.consume(context);
      }

      // Check 4th request - should still be allowed
      const result = await service.check(context);
      expect(result.allowed).toBe(true);
      expect(result.usage.current).toBe(3);
      expect(result.usage.remaining).toBe(2);
    });

    test('denies requests exceeding limit', async () => {
      await service.createPolicy({
        name: 'Facebook Limit',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 3,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const context: RateLimitCheckContext = {
        clientId: 'client-1',
        platform: 'facebook',
        action: 'publish',
      };

      // Consume all 3 allowed requests
      for (let i = 0; i < 3; i++) {
        await service.consume(context);
      }

      // 4th request should be denied
      const result = await service.check(context);
      expect(result.allowed).toBe(false);
      expect(result.usage.current).toBe(3);
      expect(result.usage.remaining).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    test('allows requests after window expires', async () => {
      await service.createPolicy({
        name: 'Facebook Limit',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 2,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const context: RateLimitCheckContext = {
        clientId: 'client-1',
        platform: 'facebook',
        action: 'publish',
      };

      // Consume all requests
      await service.consume(context);
      await service.consume(context);

      // Should be denied
      let result = await service.check(context);
      expect(result.allowed).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime(61_000);

      // Should be allowed again
      result = await service.check(context);
      expect(result.allowed).toBe(true);
      expect(result.usage.current).toBe(0);
    });

    test('platform-specific policy only affects that platform', async () => {
      await service.createPolicy({
        name: 'TikTok Limit',
        scope: 'global',
        platform: 'tiktok',
        config: {
          maxRequests: 1,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const tiktokContext: RateLimitCheckContext = {
        clientId: 'client-1',
        platform: 'tiktok',
        action: 'publish',
      };

      const facebookContext: RateLimitCheckContext = {
        clientId: 'client-1',
        platform: 'facebook',
        action: 'publish',
      };

      // Consume TikTok limit
      await service.consume(tiktokContext);

      // TikTok should be denied
      const tiktokResult = await service.check(tiktokContext);
      expect(tiktokResult.allowed).toBe(false);

      // Facebook should be allowed (no policy)
      const facebookResult = await service.check(facebookContext);
      expect(facebookResult.allowed).toBe(true);
    });

    test('client-specific policy only affects that client', async () => {
      await service.createPolicy({
        name: 'Client 1 Limit',
        scope: 'client',
        clientId: 'client-1',
        platform: 'facebook',
        config: {
          maxRequests: 1,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const client1Context: RateLimitCheckContext = {
        clientId: 'client-1',
        platform: 'facebook',
        action: 'publish',
      };

      const client2Context: RateLimitCheckContext = {
        clientId: 'client-2',
        platform: 'facebook',
        action: 'publish',
      };

      // Consume client-1 limit
      await service.consume(client1Context);

      // Client-1 should be denied
      const client1Result = await service.check(client1Context);
      expect(client1Result.allowed).toBe(false);

      // Client-2 should be allowed (no policy for them)
      const client2Result = await service.check(client2Context);
      expect(client2Result.allowed).toBe(true);
    });

    test('more specific policy takes priority', async () => {
      // Global policy
      await service.createPolicy({
        name: 'Global Facebook',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 100,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        priority: 10,
        createdBy: 'admin-1',
      });

      // Client-specific policy with higher priority
      await service.createPolicy({
        name: 'Client 1 Facebook',
        scope: 'client',
        clientId: 'client-1',
        platform: 'facebook',
        config: {
          maxRequests: 5,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        priority: 0,
        createdBy: 'admin-1',
      });

      const context: RateLimitCheckContext = {
        clientId: 'client-1',
        platform: 'facebook',
        action: 'publish',
      };

      const result = await service.check(context);
      expect(result.policy?.name).toBe('Client 1 Facebook');
      expect(result.usage.limit).toBe(5);
    });

    test('supports multiple tokens per request', async () => {
      await service.createPolicy({
        name: 'Upload Limit',
        scope: 'global',
        platform: 'youtube',
        action: 'upload',
        config: {
          maxRequests: 10,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const context: RateLimitCheckContext = {
        clientId: 'client-1',
        platform: 'youtube',
        action: 'upload',
        tokens: 5,
      };

      // Consume 5 tokens
      await service.consume(context);

      // Should have 5 remaining
      let result = await service.check({ ...context, tokens: 1 });
      expect(result.usage.current).toBe(5);
      expect(result.usage.remaining).toBe(5);

      // Requesting 6 more should be denied
      result = await service.check({ ...context, tokens: 6 });
      expect(result.allowed).toBe(false);

      // Requesting 5 more should be allowed
      result = await service.check({ ...context, tokens: 5 });
      expect(result.allowed).toBe(true);
    });
  });

  describe('getUsage', () => {
    test('returns current usage stats', async () => {
      await service.createPolicy({
        name: 'Facebook Limit',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 10,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const context: RateLimitCheckContext = {
        clientId: 'client-1',
        platform: 'facebook',
        action: 'publish',
      };

      // Consume some requests
      await service.consume(context);
      await service.consume(context);
      await service.consume(context);

      const usage = await service.getUsage(context);
      expect(usage.current).toBe(3);
      expect(usage.limit).toBe(10);
      expect(usage.remaining).toBe(7);
    });
  });

  describe('resetUsage', () => {
    test('resets usage for context', async () => {
      await service.createPolicy({
        name: 'Facebook Limit',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 2,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const context: RateLimitCheckContext = {
        clientId: 'client-1',
        platform: 'facebook',
        action: 'publish',
      };

      // Consume all requests
      await service.consume(context);
      await service.consume(context);

      // Should be denied
      let result = await service.check(context);
      expect(result.allowed).toBe(false);

      // Reset usage
      await service.resetUsage(context);

      // Should be allowed again
      result = await service.check(context);
      expect(result.allowed).toBe(true);
      expect(result.usage.current).toBe(0);
    });
  });

  describe('updatePolicy', () => {
    test('updates policy configuration', async () => {
      const policy = await service.createPolicy({
        name: 'Original Name',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 10,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const updated = await service.updatePolicy({
        id: policy.id,
        name: 'New Name',
        config: {
          maxRequests: 20,
        },
        updatedBy: 'admin-2',
      });

      expect(updated.name).toBe('New Name');
      expect(updated.config.maxRequests).toBe(20);
      expect(updated.config.windowMs).toBe(60_000); // Unchanged
    });

    test('can deactivate policy', async () => {
      const policy = await service.createPolicy({
        name: 'Active Policy',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 1,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const context: RateLimitCheckContext = {
        clientId: 'client-1',
        platform: 'facebook',
        action: 'publish',
      };

      // Consume the one allowed request
      await service.consume(context);

      // Should be denied with active policy
      let result = await service.check(context);
      expect(result.allowed).toBe(false);

      // Deactivate policy
      await service.updatePolicy({
        id: policy.id,
        isActive: false,
        updatedBy: 'admin-1',
      });

      // Should be allowed now (no active policy)
      result = await service.check(context);
      expect(result.allowed).toBe(true);
    });

    test('throws for non-existent policy', async () => {
      await expect(
        service.updatePolicy({
          id: 'nonexistent',
          name: 'New Name',
          updatedBy: 'admin-1',
        })
      ).rejects.toThrow('Rate limit policy not found: nonexistent');
    });
  });

  describe('deletePolicy', () => {
    test('deletes policy', async () => {
      const policy = await service.createPolicy({
        name: 'To Delete',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 10,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      await service.deletePolicy(policy.id);

      const result = await service.getPolicyById(policy.id);
      expect(result).toBeNull();
    });

    test('throws for non-existent policy', async () => {
      await expect(service.deletePolicy('nonexistent')).rejects.toThrow(
        'Rate limit policy not found: nonexistent'
      );
    });
  });

  describe('listPolicies', () => {
    test('lists all policies', async () => {
      await service.createPolicy({
        name: 'Policy 1',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 10,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      await service.createPolicy({
        name: 'Policy 2',
        scope: 'global',
        platform: 'tiktok',
        config: {
          maxRequests: 20,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const policies = await service.listPolicies();
      expect(policies).toHaveLength(2);
    });

    test('filters by platform', async () => {
      await service.createPolicy({
        name: 'Facebook',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 10,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      await service.createPolicy({
        name: 'TikTok',
        scope: 'global',
        platform: 'tiktok',
        config: {
          maxRequests: 20,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const policies = await service.listPolicies({ platform: 'facebook' });
      expect(policies).toHaveLength(1);
      expect(policies[0].name).toBe('Facebook');
    });

    test('filters active only', async () => {
      const active = await service.createPolicy({
        name: 'Active',
        scope: 'global',
        platform: 'facebook',
        config: {
          maxRequests: 10,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      const inactive = await service.createPolicy({
        name: 'Inactive',
        scope: 'global',
        platform: 'tiktok',
        config: {
          maxRequests: 20,
          windowMs: 60_000,
          strategy: 'sliding_window',
        },
        createdBy: 'admin-1',
      });

      await service.updatePolicy({
        id: inactive.id,
        isActive: false,
        updatedBy: 'admin-1',
      });

      const policies = await service.listPolicies({ activeOnly: true });
      expect(policies).toHaveLength(1);
      expect(policies[0].name).toBe('Active');
    });
  });
});

describe('Rate Limiter with Default Policies', () => {
  let service: RateLimiterService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = createRateLimiterService({
      useDefaultPolicies: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('applies default platform limits', async () => {
    const context: RateLimitCheckContext = {
      clientId: 'client-1',
      platform: 'facebook',
      action: 'publish',
    };

    const result = await service.check(context);
    expect(result.policy).not.toBeNull();
    expect(result.policy?.name).toBe('Default facebook Rate Limit');
    expect(result.usage.limit).toBe(DEFAULT_PLATFORM_LIMITS.facebook);
  });

  test('has default policies for all platforms', async () => {
    const policies = await service.listPolicies();
    expect(policies.length).toBe(7); // 7 platforms

    const platforms = policies.map((p) => p.platform);
    expect(platforms).toContain('facebook');
    expect(platforms).toContain('instagram');
    expect(platforms).toContain('tiktok');
    expect(platforms).toContain('youtube');
    expect(platforms).toContain('linkedin');
    expect(platforms).toContain('x');
    expect(platforms).toContain('skool');
  });
});
