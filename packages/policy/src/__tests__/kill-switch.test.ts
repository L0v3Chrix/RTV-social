import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createKillSwitchService,
  createAutoTripMonitor,
  type KillSwitchService,
  type AutoTripMonitor,
} from '../kill-switch/index.js';

describe('Kill Switch Service', () => {
  let service: KillSwitchService;
  const auditEvents: unknown[] = [];

  beforeEach(() => {
    auditEvents.length = 0;
    service = createKillSwitchService({
      onAudit: (event) => auditEvents.push(event),
    });
  });

  describe('create', () => {
    test('creates global kill switch', async () => {
      const sw = await service.create({
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        createdBy: 'admin-1',
      });

      expect(sw.id).toMatch(/^ks_/);
      expect(sw.scope).toBe('global');
      expect(sw.targetType).toBe('all');
      expect(sw.isActive).toBe(false);
      expect(sw.clientId).toBeNull();
    });

    test('creates client-scoped kill switch', async () => {
      const sw = await service.create({
        scope: 'client',
        targetType: 'platform',
        targetValue: 'meta',
        clientId: 'client-123',
        createdBy: 'admin-1',
      });

      expect(sw.scope).toBe('client');
      expect(sw.clientId).toBe('client-123');
    });

    test('requires clientId for client scope', async () => {
      await expect(
        service.create({
          scope: 'client',
          targetType: 'platform',
          targetValue: 'meta',
          createdBy: 'admin-1',
        })
      ).rejects.toThrow('Client scope requires clientId');
    });

    test('rejects clientId for global scope', async () => {
      await expect(
        service.create({
          scope: 'global',
          targetType: 'all',
          targetValue: '*',
          clientId: 'client-123',
          createdBy: 'admin-1',
        })
      ).rejects.toThrow('Global scope cannot have clientId');
    });

    test('emits audit event on creation', async () => {
      await service.create({
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        createdBy: 'admin-1',
      });

      expect(auditEvents).toHaveLength(1);
      expect((auditEvents[0] as { type: string }).type).toBe('KILL_SWITCH_CREATED');
    });
  });

  describe('isTripped', () => {
    test('returns false when no switches are active', async () => {
      const result = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client-123',
      });

      expect(result.tripped).toBe(false);
      expect(result.switch).toBeNull();
    });

    test('returns true when global all switch is active', async () => {
      const sw = await service.create({
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        createdBy: 'admin-1',
      });

      await service.activate({
        id: sw.id,
        reason: 'Emergency stop',
        activatedBy: 'admin-1',
      });

      const result = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client-123',
      });

      expect(result.tripped).toBe(true);
      expect(result.switch?.id).toBe(sw.id);
      expect(result.reason).toBe('Emergency stop');
    });

    test('global switch blocks all clients', async () => {
      const sw = await service.create({
        scope: 'global',
        targetType: 'platform',
        targetValue: 'meta',
        createdBy: 'admin-1',
      });

      await service.activate({
        id: sw.id,
        reason: 'Meta API down',
        activatedBy: 'admin-1',
      });

      // Should block any client
      const result1 = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client-1',
      });
      const result2 = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client-2',
      });

      expect(result1.tripped).toBe(true);
      expect(result2.tripped).toBe(true);
    });

    test('client switch only blocks that client', async () => {
      const sw = await service.create({
        scope: 'client',
        targetType: 'all',
        targetValue: '*',
        clientId: 'client-1',
        createdBy: 'admin-1',
      });

      await service.activate({
        id: sw.id,
        reason: 'Client pause requested',
        activatedBy: 'admin-1',
      });

      const result1 = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client-1',
      });
      const result2 = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client-2',
      });

      expect(result1.tripped).toBe(true);
      expect(result2.tripped).toBe(false);
    });

    test('platform switch blocks only that platform', async () => {
      const sw = await service.create({
        scope: 'global',
        targetType: 'platform',
        targetValue: 'tiktok',
        createdBy: 'admin-1',
      });

      await service.activate({
        id: sw.id,
        reason: 'TikTok API issues',
        activatedBy: 'admin-1',
      });

      const resultTikTok = await service.isTripped({
        action: 'publish',
        platform: 'tiktok',
        clientId: 'client-1',
      });
      const resultMeta = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client-1',
      });

      expect(resultTikTok.tripped).toBe(true);
      expect(resultMeta.tripped).toBe(false);
    });

    test('action switch blocks only that action', async () => {
      const sw = await service.create({
        scope: 'global',
        targetType: 'action',
        targetValue: 'publish',
        createdBy: 'admin-1',
      });

      await service.activate({
        id: sw.id,
        reason: 'Publishing halted',
        activatedBy: 'admin-1',
      });

      const resultPublish = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client-1',
      });
      const resultEngage = await service.isTripped({
        action: 'engage',
        platform: 'meta',
        clientId: 'client-1',
      });

      expect(resultPublish.tripped).toBe(true);
      expect(resultEngage.tripped).toBe(false);
    });

    test('global takes priority over client', async () => {
      const globalSw = await service.create({
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        createdBy: 'admin-1',
      });

      const clientSw = await service.create({
        scope: 'client',
        targetType: 'all',
        targetValue: '*',
        clientId: 'client-1',
        createdBy: 'admin-1',
      });

      // Activate both
      await service.activate({
        id: globalSw.id,
        reason: 'Global stop',
        activatedBy: 'admin-1',
      });
      await service.activate({
        id: clientSw.id,
        reason: 'Client stop',
        activatedBy: 'admin-1',
      });

      const result = await service.isTripped({
        action: 'publish',
        platform: 'meta',
        clientId: 'client-1',
      });

      // Should return global switch (higher priority)
      expect(result.switch?.id).toBe(globalSw.id);
      expect(result.reason).toBe('Global stop');
    });
  });

  describe('activate', () => {
    test('activates switch', async () => {
      const sw = await service.create({
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        createdBy: 'admin-1',
      });

      await service.activate({
        id: sw.id,
        reason: 'Emergency stop',
        activatedBy: 'admin-1',
      });

      const updated = await service.getById(sw.id);
      expect(updated?.isActive).toBe(true);
      expect(updated?.reason).toBe('Emergency stop');
      expect(updated?.activatedBy).toBe('admin-1');
      expect(updated?.activatedAt).toBeDefined();
    });

    test('is idempotent when already active', async () => {
      const sw = await service.create({
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        createdBy: 'admin-1',
      });

      await service.activate({
        id: sw.id,
        reason: 'First activation',
        activatedBy: 'admin-1',
      });

      const firstActivation = (await service.getById(sw.id))?.activatedAt;

      // Second activation should be no-op
      await service.activate({
        id: sw.id,
        reason: 'Second activation',
        activatedBy: 'admin-2',
      });

      const updated = await service.getById(sw.id);
      expect(updated?.reason).toBe('First activation');
      expect(updated?.activatedAt).toEqual(firstActivation);
    });

    test('throws for non-existent switch', async () => {
      await expect(
        service.activate({
          id: 'nonexistent',
          reason: 'Test',
          activatedBy: 'admin-1',
        })
      ).rejects.toThrow('Kill switch not found: nonexistent');
    });

    test('emits audit event on activation', async () => {
      const sw = await service.create({
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        createdBy: 'admin-1',
      });

      auditEvents.length = 0;

      await service.activate({
        id: sw.id,
        reason: 'Emergency stop',
        activatedBy: 'admin-1',
      });

      expect(auditEvents.some((e) => (e as { type: string }).type === 'KILL_SWITCH_ACTIVATED')).toBe(true);
    });
  });

  describe('deactivate', () => {
    test('deactivates switch', async () => {
      const sw = await service.create({
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        createdBy: 'admin-1',
      });

      await service.activate({
        id: sw.id,
        reason: 'Emergency',
        activatedBy: 'admin-1',
      });

      await service.deactivate({
        id: sw.id,
        reason: 'Issue resolved',
        deactivatedBy: 'admin-2',
      });

      const updated = await service.getById(sw.id);
      expect(updated?.isActive).toBe(false);
    });

    test('is idempotent when already inactive', async () => {
      const sw = await service.create({
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        createdBy: 'admin-1',
      });

      // Already inactive, should not throw
      await service.deactivate({
        id: sw.id,
        reason: 'Deactivate inactive',
        deactivatedBy: 'admin-1',
      });

      const updated = await service.getById(sw.id);
      expect(updated?.isActive).toBe(false);
    });

    test('emits audit event on deactivation', async () => {
      const sw = await service.create({
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        createdBy: 'admin-1',
      });

      await service.activate({
        id: sw.id,
        reason: 'Emergency',
        activatedBy: 'admin-1',
      });

      auditEvents.length = 0;

      await service.deactivate({
        id: sw.id,
        reason: 'Issue resolved',
        deactivatedBy: 'admin-2',
      });

      expect(auditEvents.some((e) => (e as { type: string }).type === 'KILL_SWITCH_DEACTIVATED')).toBe(true);
    });
  });

  describe('listActive', () => {
    test('lists all active switches', async () => {
      const sw1 = await service.create({
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        createdBy: 'admin-1',
      });
      const sw2 = await service.create({
        scope: 'global',
        targetType: 'platform',
        targetValue: 'meta',
        createdBy: 'admin-1',
      });

      await service.activate({
        id: sw1.id,
        reason: 'Stop all',
        activatedBy: 'admin-1',
      });

      const active = await service.listActive();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(sw1.id);
    });

    test('filters by scope', async () => {
      const globalSw = await service.create({
        scope: 'global',
        targetType: 'all',
        targetValue: '*',
        createdBy: 'admin-1',
      });
      const clientSw = await service.create({
        scope: 'client',
        targetType: 'all',
        targetValue: '*',
        clientId: 'client-1',
        createdBy: 'admin-1',
      });

      await service.activate({
        id: globalSw.id,
        reason: 'Global',
        activatedBy: 'admin-1',
      });
      await service.activate({
        id: clientSw.id,
        reason: 'Client',
        activatedBy: 'admin-1',
      });

      const globalOnly = await service.listActive({ scope: 'global' });
      expect(globalOnly).toHaveLength(1);
      expect(globalOnly[0].scope).toBe('global');
    });
  });
});

describe('Auto-Trip Monitor', () => {
  let monitor: AutoTripMonitor;
  let service: KillSwitchService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = createKillSwitchService();
    monitor = createAutoTripMonitor({
      killSwitchService: service,
      config: {
        windowMs: 60_000,
        thresholds: {
          'platform:meta': { errorRate: 0.5, minSamples: 10 },
          'platform:tiktok': { errorRate: 0.3, minSamples: 5 },
        },
        checkIntervalMs: 10_000,
        cooldownMs: 300_000,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    monitor.stop();
  });

  describe('error rate tracking', () => {
    test('tracks errors per target', async () => {
      await monitor.recordResult({
        target: 'platform:meta',
        success: false,
        clientId: 'client-1',
      });

      await monitor.recordResult({
        target: 'platform:meta',
        success: true,
        clientId: 'client-1',
      });

      const stats = monitor.getStats('platform:meta', 'client-1');
      expect(stats.errors).toBe(1);
      expect(stats.total).toBe(2);
      expect(stats.errorRate).toBe(0.5);
    });

    test('expires old samples', async () => {
      await monitor.recordResult({
        target: 'platform:meta',
        success: false,
        clientId: 'client-1',
      });

      // Advance past window
      vi.advanceTimersByTime(61_000);

      const stats = monitor.getStats('platform:meta', 'client-1');
      expect(stats.total).toBe(0);
    });

    test('aggregates across clients when no clientId specified', async () => {
      await monitor.recordResult({
        target: 'platform:meta',
        success: false,
        clientId: 'client-1',
      });
      await monitor.recordResult({
        target: 'platform:meta',
        success: true,
        clientId: 'client-2',
      });

      const stats = monitor.getStats('platform:meta');
      expect(stats.total).toBe(2);
      expect(stats.errors).toBe(1);
      expect(stats.errorRate).toBe(0.5);
    });
  });

  describe('stats for unknown target', () => {
    test('returns zero stats for unknown target', () => {
      const stats = monitor.getStats('platform:unknown');
      expect(stats.total).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.errorRate).toBe(0);
    });
  });
});
