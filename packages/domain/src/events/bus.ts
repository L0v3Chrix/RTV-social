/**
 * Domain event bus implementation
 */

import { nanoid } from 'nanoid';
import { createModuleLogger } from '@rtv/observability';
import {
  type DomainEvent,
  type DomainEventType,
  type EventHandler,
  type EventFilterOptions,
  type EventMetadata,
} from './types.js';

const logger = createModuleLogger('domain-events');

/**
 * Event bus interface
 */
export interface DomainEventBus {
  emit(event: DomainEvent): Promise<void>;
  subscribe<T extends DomainEventType>(
    eventType: T | `${string}.*`,
    handler: EventHandler<T>
  ): () => void;
  getHistory(clientId: string, options?: EventFilterOptions): DomainEvent[];
  clear(): void;
}

/**
 * Subscription entry
 */
interface Subscription {
  pattern: string;
  handler: EventHandler;
}

/**
 * Create a new domain event bus
 */
export function createDomainEventBus(): DomainEventBus {
  const subscriptions: Subscription[] = [];
  const eventHistory: Map<string, DomainEvent[]> = new Map();

  /**
   * Check if event type matches pattern
   */
  function matchesPattern(eventType: string, pattern: string): boolean {
    if (pattern === eventType) return true;
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return eventType.startsWith(prefix + '.');
    }
    return false;
  }

  /**
   * Store event in history
   */
  function storeEvent(event: DomainEvent): void {
    const history = eventHistory.get(event.clientId) ?? [];
    history.push(event);
    eventHistory.set(event.clientId, history);
  }

  return {
    async emit(event: DomainEvent): Promise<void> {
      logger.debug(
        { eventId: event.id, type: event.type, clientId: event.clientId },
        'Emitting domain event'
      );

      // Store in history
      storeEvent(event);

      // Notify subscribers
      const handlers = subscriptions
        .filter(sub => matchesPattern(event.type, sub.pattern))
        .map(sub => sub.handler);

      await Promise.all(
        handlers.map(async handler => {
          try {
            await handler(event);
          } catch (error) {
            logger.error(
              { error, eventId: event.id, type: event.type },
              'Event handler error'
            );
          }
        })
      );
    },

    subscribe<T extends DomainEventType>(
      eventType: T | `${string}.*`,
      handler: EventHandler<T>
    ): () => void {
      const subscription: Subscription = {
        pattern: eventType,
        handler: handler as EventHandler,
      };

      subscriptions.push(subscription);

      logger.debug({ pattern: eventType }, 'Event subscription added');

      // Return unsubscribe function
      return () => {
        const index = subscriptions.indexOf(subscription);
        if (index !== -1) {
          subscriptions.splice(index, 1);
          logger.debug({ pattern: eventType }, 'Event subscription removed');
        }
      };
    },

    getHistory(clientId: string, options: EventFilterOptions = {}): DomainEvent[] {
      const history = eventHistory.get(clientId) ?? [];
      let filtered = [...history];

      if (options.types && options.types.length > 0) {
        filtered = filtered.filter(e => options.types!.includes(e.type as DomainEventType));
      }

      if (options.since) {
        filtered = filtered.filter(e => e.timestamp >= options.since!);
      }

      if (options.until) {
        filtered = filtered.filter(e => e.timestamp <= options.until!);
      }

      if (options.limit) {
        filtered = filtered.slice(-options.limit);
      }

      return filtered;
    },

    clear(): void {
      subscriptions.length = 0;
      eventHistory.clear();
    },
  };
}

// Default global event bus instance
let defaultEventBus: DomainEventBus | null = null;

/**
 * Get the default event bus
 */
export function getDefaultEventBus(): DomainEventBus {
  if (!defaultEventBus) {
    defaultEventBus = createDomainEventBus();
  }
  return defaultEventBus;
}

/**
 * Set the default event bus
 */
export function setDefaultEventBus(bus: DomainEventBus): void {
  defaultEventBus = bus;
}

/**
 * Helper to create and emit a domain event
 */
export function createDomainEvent<T extends DomainEventType>(
  type: T,
  aggregateType: string,
  aggregateId: string,
  clientId: string,
  payload: Record<string, unknown>,
  metadata: EventMetadata = {}
): DomainEvent<T> {
  return {
    id: nanoid(),
    type,
    aggregateType,
    aggregateId,
    clientId,
    payload,
    metadata,
    timestamp: new Date(),
  };
}

/**
 * Emit a domain event to the default bus
 */
export async function emitDomainEvent(event: DomainEvent): Promise<void> {
  return getDefaultEventBus().emit(event);
}

/**
 * Subscribe to domain events on the default bus
 */
export function subscribeToDomainEvent<T extends DomainEventType>(
  eventType: T | `${string}.*`,
  handler: EventHandler<T>
): () => void {
  return getDefaultEventBus().subscribe(eventType, handler);
}
