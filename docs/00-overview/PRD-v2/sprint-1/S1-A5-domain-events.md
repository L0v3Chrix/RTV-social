# Build Prompt: S1-A5 — Domain Event Emission

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-A5 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | A — Core Domain Models |
| **Complexity** | Medium |
| **Estimated Effort** | 2-3 hours |
| **Dependencies** | S1-A1, S1-A2, S1-A3, S1-A4 |
| **Blocks** | Sprint 2 |

---

## Context

### What We're Building

Create a domain event system that emits events when entities change, enabling loose coupling between domain models and downstream processors.

### Why This Matters

- **Audit trail**: Events provide history of all changes
- **Decoupling**: Consumers react to events without tight coupling
- **RLM integration**: Events feed into external memory for agent context
- **Observability**: Events drive metrics and alerting

### Spec References

- `/docs/01-architecture/rlm-integration-spec.md#6.4-observability`
- `/docs/03-agents-tools/agent-recursion-contracts.md#10-standard-outputs`

**Critical Requirement (from RLM spec):**
> Every episode must emit: episode_id, client_id, platform, lane, budgets used, recursion tree summary, all prompt spans accessed, final answer + confidence + evidence pointers

---

## Prerequisites

### Completed Tasks

- [x] S1-A1: Client entity model
- [x] S1-A2: BrandKit entity model
- [x] S1-A3: KnowledgeBase entity model
- [x] S1-A4: Offer entity model

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/domain/src/__tests__/events.test.ts`**

```typescript
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DomainEventBus,
  createDomainEventBus,
  emitDomainEvent,
  subscribeToDomainEvent,
  type DomainEvent,
  type DomainEventType,
} from '../events';

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
```

### Phase 2: Implementation

#### Step 1: Create Event Types

**File: `packages/domain/src/events/types.ts`**

```bash
mkdir -p packages/domain/src/events

cat > packages/domain/src/events/types.ts << 'EOF'
/**
 * Domain event types
 */

import { z } from 'zod';

/**
 * All domain event types
 */
export const DomainEventTypes = {
  // Client events
  'client.created': 'client.created',
  'client.updated': 'client.updated',
  'client.activated': 'client.activated',
  'client.suspended': 'client.suspended',
  'client.deleted': 'client.deleted',

  // BrandKit events
  'brandkit.created': 'brandkit.created',
  'brandkit.updated': 'brandkit.updated',
  'brandkit.voiceStyleUpdated': 'brandkit.voiceStyleUpdated',
  'brandkit.visualTokensUpdated': 'brandkit.visualTokensUpdated',

  // KnowledgeBase events
  'knowledgebase.created': 'knowledgebase.created',
  'knowledgebase.updated': 'knowledgebase.updated',
  'knowledgebase.documentAdded': 'knowledgebase.documentAdded',
  'knowledgebase.documentUpdated': 'knowledgebase.documentUpdated',
  'knowledgebase.documentRemoved': 'knowledgebase.documentRemoved',
  'knowledgebase.faqAdded': 'knowledgebase.faqAdded',
  'knowledgebase.faqUpdated': 'knowledgebase.faqUpdated',
  'knowledgebase.faqRemoved': 'knowledgebase.faqRemoved',

  // Offer events
  'offer.created': 'offer.created',
  'offer.updated': 'offer.updated',
  'offer.activated': 'offer.activated',
  'offer.deactivated': 'offer.deactivated',
  'offer.deleted': 'offer.deleted',
} as const;

export type DomainEventType = keyof typeof DomainEventTypes;

/**
 * Event metadata
 */
export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  source?: string;
  [key: string]: unknown;
}

/**
 * Base domain event interface
 */
export interface DomainEvent<T extends DomainEventType = DomainEventType> {
  readonly id: string;
  readonly type: T;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly clientId: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: EventMetadata;
  readonly timestamp: Date;
}

/**
 * Event handler type
 */
export type EventHandler<T extends DomainEventType = DomainEventType> = (
  event: DomainEvent<T>
) => void | Promise<void>;

/**
 * Event filter options
 */
export interface EventFilterOptions {
  types?: DomainEventType[];
  since?: Date;
  until?: Date;
  limit?: number;
}

/**
 * Event schema for validation
 */
export const domainEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  aggregateType: z.string(),
  aggregateId: z.string(),
  clientId: z.string(),
  payload: z.record(z.unknown()),
  metadata: z.object({
    correlationId: z.string().optional(),
    causationId: z.string().optional(),
    userId: z.string().optional(),
    source: z.string().optional(),
  }).passthrough(),
  timestamp: z.date(),
});
EOF
```

#### Step 2: Create Event Bus

**File: `packages/domain/src/events/bus.ts`**

```bash
cat > packages/domain/src/events/bus.ts << 'EOF'
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
} from './types';

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
EOF
```

#### Step 3: Create Event Emitters for Entities

**File: `packages/domain/src/events/emitters.ts`**

```bash
cat > packages/domain/src/events/emitters.ts << 'EOF'
/**
 * Domain event emitters for entities
 */

import { createDomainEvent, emitDomainEvent } from './bus';
import type { DomainEventType, EventMetadata } from './types';

/**
 * Client event emitters
 */
export const clientEvents = {
  async created(
    clientId: string,
    payload: { name: string; slug: string },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'client.created',
      'client',
      clientId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async updated(
    clientId: string,
    payload: { changes: string[] },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'client.updated',
      'client',
      clientId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async activated(clientId: string, metadata?: EventMetadata) {
    const event = createDomainEvent(
      'client.activated',
      'client',
      clientId,
      clientId,
      {},
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async suspended(
    clientId: string,
    payload: { reason?: string },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'client.suspended',
      'client',
      clientId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async deleted(clientId: string, metadata?: EventMetadata) {
    const event = createDomainEvent(
      'client.deleted',
      'client',
      clientId,
      clientId,
      {},
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },
};

/**
 * BrandKit event emitters
 */
export const brandkitEvents = {
  async created(
    brandkitId: string,
    clientId: string,
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'brandkit.created',
      'brandkit',
      brandkitId,
      clientId,
      {},
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async updated(
    brandkitId: string,
    clientId: string,
    payload: { changes: string[]; version: number },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'brandkit.updated',
      'brandkit',
      brandkitId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },
};

/**
 * KnowledgeBase event emitters
 */
export const knowledgebaseEvents = {
  async created(
    kbId: string,
    clientId: string,
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'knowledgebase.created',
      'knowledgebase',
      kbId,
      clientId,
      {},
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async documentAdded(
    kbId: string,
    clientId: string,
    payload: { documentId: string; title: string; spanCount: number },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'knowledgebase.documentAdded',
      'knowledgebase',
      kbId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async documentRemoved(
    kbId: string,
    clientId: string,
    payload: { documentId: string },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'knowledgebase.documentRemoved',
      'knowledgebase',
      kbId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },
};

/**
 * Offer event emitters
 */
export const offerEvents = {
  async created(
    offerId: string,
    clientId: string,
    payload: { name: string; type: string },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'offer.created',
      'offer',
      offerId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async activated(
    offerId: string,
    clientId: string,
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'offer.activated',
      'offer',
      offerId,
      clientId,
      {},
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async deactivated(
    offerId: string,
    clientId: string,
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'offer.deactivated',
      'offer',
      offerId,
      clientId,
      {},
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },
};
EOF
```

#### Step 4: Create Events Index

**File: `packages/domain/src/events/index.ts`**

```bash
cat > packages/domain/src/events/index.ts << 'EOF'
/**
 * Domain events module
 */

export {
  createDomainEventBus,
  getDefaultEventBus,
  setDefaultEventBus,
  createDomainEvent,
  emitDomainEvent,
  subscribeToDomainEvent,
  type DomainEventBus,
} from './bus';

export {
  clientEvents,
  brandkitEvents,
  knowledgebaseEvents,
  offerEvents,
} from './emitters';

export {
  DomainEventTypes,
  domainEventSchema,
  type DomainEvent,
  type DomainEventType,
  type EventHandler,
  type EventFilterOptions,
  type EventMetadata,
} from './types';
EOF
```

#### Step 5: Update Package Index

```bash
cat > packages/domain/src/index.ts << 'EOF'
/**
 * @rtv/domain - Domain models and business logic
 */

// Client
export * from './client';

// BrandKit
export * from './brandkit';

// KnowledgeBase (RLM External Memory)
export * from './knowledgebase';

// Offer
export * from './offer';

// Domain Events
export * from './events';
EOF
```

### Phase 3: Verification

```bash
cd packages/domain
pnpm build && pnpm typecheck && pnpm test
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/domain/src/events/types.ts` | Event types |
| Create | `packages/domain/src/events/bus.ts` | Event bus |
| Create | `packages/domain/src/events/emitters.ts` | Entity emitters |
| Create | `packages/domain/src/events/index.ts` | Events exports |
| Modify | `packages/domain/src/index.ts` | Add events export |
| Create | `packages/domain/src/__tests__/events.test.ts` | Event tests |

---

## Acceptance Criteria

- [ ] Event bus emits to subscribers
- [ ] Wildcard subscriptions work
- [ ] Unsubscribe stops events
- [ ] Event history stored per client
- [ ] History filtering works
- [ ] Entity-specific emitters work
- [ ] All tests pass

---

## JSON Task Block

```json
{
  "task_id": "S1-A5",
  "name": "Domain Event Emission",
  "sprint": 1,
  "agent": "A",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 3,
  "dependencies": ["S1-A1", "S1-A2", "S1-A3", "S1-A4"],
  "blocks": [],
  "tags": ["domain", "events", "observability"],
  "acceptance_criteria": [
    "event bus works",
    "subscriptions work",
    "history tracking works",
    "entity emitters work"
  ],
  "created_at": "2025-01-16T00:00:00Z"
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "agent_id": null,
  "decisions": [],
  "artifacts": [],
  "notes": ["Events feed into RLM external memory"]
}
```
