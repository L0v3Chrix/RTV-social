import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DomainEventBus,
  createDomainEventBus,
  type DomainEvent,
  type DomainEventType,
} from '../events/index.js';

describe('Domain Events', () => {
  let eventBus: DomainEventBus;

  beforeEach(() => {
    eventBus = createDomainEventBus();
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe('Event Emission', () => {
    test('emits events to subscribers', async () => {
      const handler = vi.fn();
      eventBus.subscribe('client.created', handler);

      const event: DomainEvent = {
        id: 'evt-123',
        type: 'client.created',
        aggregateType: 'client',
        aggregateId: 'client-456',
        clientId: 'client-456',
        payload: { name: 'New Client' },
        metadata: {},
        timestamp: new Date(),
      };

      await eventBus.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    test('supports wildcard subscriptions', async () => {
      const handler = vi.fn();
      eventBus.subscribe('client.*', handler);

      await eventBus.emit({
        id: 'evt-1',
        type: 'client.created',
        aggregateType: 'client',
        aggregateId: 'c1',
        clientId: 'c1',
        payload: {},
        metadata: {},
        timestamp: new Date(),
      });

      await eventBus.emit({
        id: 'evt-2',
        type: 'client.updated',
        aggregateType: 'client',
        aggregateId: 'c1',
        clientId: 'c1',
        payload: {},
        metadata: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledTimes(2);
    });

    test('multiple subscribers receive events', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe('client.created', handler1);
      eventBus.subscribe('client.created', handler2);

      await eventBus.emit({
        id: 'evt-1',
        type: 'client.created',
        aggregateType: 'client',
        aggregateId: 'c1',
        clientId: 'c1',
        payload: {},
        metadata: {},
        timestamp: new Date(),
      });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    test('unsubscribe stops receiving events', async () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('client.created', handler);

      await eventBus.emit({
        id: 'evt-1',
        type: 'client.created',
        aggregateType: 'client',
        aggregateId: 'c1',
        clientId: 'c1',
        payload: {},
        metadata: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      await eventBus.emit({
        id: 'evt-2',
        type: 'client.created',
        aggregateType: 'client',
        aggregateId: 'c2',
        clientId: 'c2',
        payload: {},
        metadata: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Types', () => {
    test('client events have correct structure', () => {
      const event: DomainEvent<'client.created'> = {
        id: 'evt-123',
        type: 'client.created',
        aggregateType: 'client',
        aggregateId: 'client-456',
        clientId: 'client-456',
        payload: {
          name: 'New Client',
          slug: 'new-client',
        },
        metadata: {
          correlationId: 'corr-123',
          causationId: 'cause-456',
        },
        timestamp: new Date(),
      };

      expect(event.type).toBe('client.created');
      expect(event.aggregateType).toBe('client');
    });

    test('brandkit events include client reference', () => {
      const event: DomainEvent<'brandkit.updated'> = {
        id: 'evt-123',
        type: 'brandkit.updated',
        aggregateType: 'brandkit',
        aggregateId: 'bk-456',
        clientId: 'client-789',
        payload: {
          changes: ['voiceStyle'],
          version: 2,
        },
        metadata: {},
        timestamp: new Date(),
      };

      expect(event.clientId).toBe('client-789');
    });
  });

  describe('Event History', () => {
    test('stores event history', async () => {
      await eventBus.emit({
        id: 'evt-1',
        type: 'client.created',
        aggregateType: 'client',
        aggregateId: 'c1',
        clientId: 'c1',
        payload: {},
        metadata: {},
        timestamp: new Date(),
      });

      await eventBus.emit({
        id: 'evt-2',
        type: 'client.updated',
        aggregateType: 'client',
        aggregateId: 'c1',
        clientId: 'c1',
        payload: {},
        metadata: {},
        timestamp: new Date(),
      });

      const history = eventBus.getHistory('c1');

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('evt-1');
      expect(history[1].id).toBe('evt-2');
    });

    test('filters history by event type', async () => {
      await eventBus.emit({
        id: 'evt-1',
        type: 'client.created',
        aggregateType: 'client',
        aggregateId: 'c1',
        clientId: 'c1',
        payload: {},
        metadata: {},
        timestamp: new Date(),
      });

      await eventBus.emit({
        id: 'evt-2',
        type: 'brandkit.created',
        aggregateType: 'brandkit',
        aggregateId: 'bk1',
        clientId: 'c1',
        payload: {},
        metadata: {},
        timestamp: new Date(),
      });

      const history = eventBus.getHistory('c1', { types: ['client.created'] });

      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('client.created');
    });
  });
});
