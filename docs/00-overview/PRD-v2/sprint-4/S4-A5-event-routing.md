# Build Prompt: S4-A5 — Event Routing

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-A5 |
| Sprint | 4 — Engagement |
| Agent | A — Event Ingestion |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1 day |
| Dependencies | S4-A4 |
| Blocks | S4-B1, S4-C1, S4-D1 |

---

## Context

### What We're Building
An event routing system that directs normalized, deduplicated events to appropriate handlers based on event type, platform, and client configuration. Routes events to thread creation, reply drafting, escalation, or archival queues.

### Why It Matters
- **Separation of Concerns**: Each handler focuses on one task
- **Parallel Processing**: Different event types processed concurrently
- **Flexibility**: Route rules configurable per client
- **Kill Switches**: Disable specific routes instantly
- **Observability**: Track event flow through system

### Spec References
- `docs/01-architecture/system-architecture-v3.md` — Event routing
- `docs/03-agents-tools/agent-recursion-contracts.md` — Handler contracts

---

## Prerequisites

### Completed Tasks
- [x] S4-A4: Event Deduplication

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/engagement/ingestion/src/__tests__/event-router.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventRouter, RouteRule, RouteDestination } from '../event-router';
import { createMockQueues } from './__mocks__/queues';

describe('EventRouter', () => {
  let router: EventRouter;
  let mockQueues: ReturnType<typeof createMockQueues>;

  beforeEach(() => {
    mockQueues = createMockQueues();
    router = new EventRouter({
      queues: mockQueues,
      defaultRules: [
        { eventType: 'comment', destination: 'thread-handler' },
        { eventType: 'dm', destination: 'thread-handler' },
        { eventType: 'mention', destination: 'thread-handler' },
        { eventType: 'reaction', destination: 'reaction-handler' },
      ],
    });
  });

  describe('routeEvent', () => {
    it('should route comment to thread handler', async () => {
      const event = {
        id: 'evt_1',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'comment',
        content: 'Nice post!',
      };

      await router.routeEvent(event);

      expect(mockQueues['thread-handler'].add).toHaveBeenCalledWith(
        'process-event',
        expect.objectContaining({ event })
      );
    });

    it('should route DM to thread handler', async () => {
      const event = {
        id: 'evt_2',
        clientId: 'client_abc',
        platform: 'instagram',
        eventType: 'dm',
        content: 'Hello!',
      };

      await router.routeEvent(event);

      expect(mockQueues['thread-handler'].add).toHaveBeenCalled();
    });

    it('should route reaction to reaction handler', async () => {
      const event = {
        id: 'evt_3',
        clientId: 'client_abc',
        platform: 'facebook',
        eventType: 'reaction',
        content: 'love',
      };

      await router.routeEvent(event);

      expect(mockQueues['reaction-handler'].add).toHaveBeenCalled();
    });

    it('should use client-specific rules when configured', async () => {
      router.setClientRules('client_xyz', [
        { eventType: 'comment', destination: 'vip-handler' },
      ]);

      const event = {
        id: 'evt_4',
        clientId: 'client_xyz',
        platform: 'tiktok',
        eventType: 'comment',
        content: 'Great!',
      };

      await router.routeEvent(event);

      expect(mockQueues['vip-handler'].add).toHaveBeenCalled();
    });

    it('should check escalation triggers', async () => {
      router.setEscalationKeywords(['urgent', 'complaint', 'refund']);

      const event = {
        id: 'evt_5',
        clientId: 'client_abc',
        platform: 'linkedin',
        eventType: 'comment',
        content: 'I need a refund immediately!',
      };

      await router.routeEvent(event);

      expect(mockQueues['escalation-handler'].add).toHaveBeenCalled();
    });

    it('should respect kill switch', async () => {
      router.setKillSwitch('client_abc', true);

      const event = {
        id: 'evt_6',
        clientId: 'client_abc',
        platform: 'x',
        eventType: 'mention',
        content: '@brand hello',
      };

      await router.routeEvent(event);

      expect(mockQueues['thread-handler'].add).not.toHaveBeenCalled();
    });
  });

  describe('routeBatch', () => {
    it('should route multiple events efficiently', async () => {
      const events = [
        { id: 'evt_1', clientId: 'client_abc', eventType: 'comment', platform: 'facebook' },
        { id: 'evt_2', clientId: 'client_abc', eventType: 'dm', platform: 'instagram' },
        { id: 'evt_3', clientId: 'client_abc', eventType: 'reaction', platform: 'facebook' },
      ];

      await router.routeBatch(events);

      expect(mockQueues['thread-handler'].addBulk).toHaveBeenCalled();
      expect(mockQueues['reaction-handler'].addBulk).toHaveBeenCalled();
    });
  });

  describe('getRouteStats', () => {
    it('should track routing statistics', async () => {
      await router.routeEvent({ id: 'e1', clientId: 'c1', eventType: 'comment', platform: 'facebook' });
      await router.routeEvent({ id: 'e2', clientId: 'c1', eventType: 'comment', platform: 'instagram' });
      await router.routeEvent({ id: 'e3', clientId: 'c1', eventType: 'dm', platform: 'facebook' });

      const stats = router.getRouteStats();

      expect(stats.byDestination['thread-handler']).toBe(3);
      expect(stats.byEventType['comment']).toBe(2);
      expect(stats.byEventType['dm']).toBe(1);
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/engagement/ingestion/src/event-router.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Queue } from 'bullmq';
import { NormalizedEvent } from './event-normalizer';

const tracer = trace.getTracer('event-router');

export type RouteDestination =
  | 'thread-handler'
  | 'reaction-handler'
  | 'escalation-handler'
  | 'vip-handler'
  | 'archive';

export interface RouteRule {
  eventType?: string;
  platform?: string;
  destination: RouteDestination;
  priority?: number;
  condition?: (event: NormalizedEvent) => boolean;
}

interface EventRouterConfig {
  queues: Record<RouteDestination, Queue>;
  defaultRules: RouteRule[];
}

export class EventRouter {
  private queues: Record<RouteDestination, Queue>;
  private defaultRules: RouteRule[];
  private clientRules: Map<string, RouteRule[]> = new Map();
  private killSwitches: Map<string, boolean> = new Map();
  private escalationKeywords: string[] = [];
  private stats = {
    byDestination: {} as Record<string, number>,
    byEventType: {} as Record<string, number>,
    total: 0,
  };

  constructor(config: EventRouterConfig) {
    this.queues = config.queues;
    this.defaultRules = config.defaultRules;
  }

  setClientRules(clientId: string, rules: RouteRule[]): void {
    this.clientRules.set(clientId, rules);
  }

  setKillSwitch(clientId: string, enabled: boolean): void {
    this.killSwitches.set(clientId, enabled);
  }

  setEscalationKeywords(keywords: string[]): void {
    this.escalationKeywords = keywords.map((k) => k.toLowerCase());
  }

  async routeEvent(event: NormalizedEvent): Promise<RouteDestination | null> {
    return tracer.startActiveSpan('routeEvent', async (span) => {
      span.setAttributes({
        'routing.event_id': event.id,
        'routing.client_id': event.clientId,
        'routing.event_type': event.eventType,
        'routing.platform': event.platform,
      });

      // Check kill switch
      if (this.killSwitches.get(event.clientId)) {
        span.setAttributes({ 'routing.killed': true });
        span.end();
        return null;
      }

      // Check escalation triggers
      if (this.shouldEscalate(event)) {
        await this.sendToQueue('escalation-handler', event);
        this.recordStats('escalation-handler', event.eventType);
        span.setAttributes({ 'routing.destination': 'escalation-handler' });
        span.end();
        return 'escalation-handler';
      }

      // Get applicable rules
      const rules = this.clientRules.get(event.clientId) || this.defaultRules;
      const matchingRule = this.findMatchingRule(rules, event);

      if (!matchingRule) {
        span.setAttributes({ 'routing.destination': 'archive' });
        span.end();
        return 'archive';
      }

      await this.sendToQueue(matchingRule.destination, event);
      this.recordStats(matchingRule.destination, event.eventType);

      span.setAttributes({ 'routing.destination': matchingRule.destination });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return matchingRule.destination;
    });
  }

  async routeBatch(events: NormalizedEvent[]): Promise<void> {
    // Group events by destination
    const groups: Record<RouteDestination, NormalizedEvent[]> = {} as any;

    for (const event of events) {
      if (this.killSwitches.get(event.clientId)) continue;

      let destination: RouteDestination;

      if (this.shouldEscalate(event)) {
        destination = 'escalation-handler';
      } else {
        const rules = this.clientRules.get(event.clientId) || this.defaultRules;
        const matchingRule = this.findMatchingRule(rules, event);
        destination = matchingRule?.destination || 'archive';
      }

      if (!groups[destination]) {
        groups[destination] = [];
      }
      groups[destination].push(event);
      this.recordStats(destination, event.eventType);
    }

    // Send batches to each queue
    for (const [destination, destEvents] of Object.entries(groups)) {
      const queue = this.queues[destination as RouteDestination];
      if (queue && destEvents.length > 0) {
        const jobs = destEvents.map((event) => ({
          name: 'process-event',
          data: { event },
        }));
        await queue.addBulk(jobs);
      }
    }
  }

  private shouldEscalate(event: NormalizedEvent): boolean {
    if (this.escalationKeywords.length === 0) return false;

    const contentLower = event.content.toLowerCase();
    return this.escalationKeywords.some((keyword) =>
      contentLower.includes(keyword)
    );
  }

  private findMatchingRule(
    rules: RouteRule[],
    event: NormalizedEvent
  ): RouteRule | null {
    return (
      rules.find((rule) => {
        if (rule.eventType && rule.eventType !== event.eventType) return false;
        if (rule.platform && rule.platform !== event.platform) return false;
        if (rule.condition && !rule.condition(event)) return false;
        return true;
      }) || null
    );
  }

  private async sendToQueue(
    destination: RouteDestination,
    event: NormalizedEvent
  ): Promise<void> {
    const queue = this.queues[destination];
    if (queue) {
      await queue.add('process-event', { event });
    }
  }

  private recordStats(destination: string, eventType: string): void {
    this.stats.byDestination[destination] =
      (this.stats.byDestination[destination] || 0) + 1;
    this.stats.byEventType[eventType] =
      (this.stats.byEventType[eventType] || 0) + 1;
    this.stats.total++;
  }

  getRouteStats(): typeof this.stats {
    return { ...this.stats };
  }
}
```

### Phase 3: Verification

```bash
cd packages/engagement/ingestion && pnpm test
pnpm test:coverage
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/engagement/ingestion/src/event-router.ts` | Router implementation |
| Create | `packages/engagement/ingestion/src/__tests__/event-router.test.ts` | Tests |
| Modify | `packages/engagement/ingestion/src/index.ts` | Export router |

---

## Acceptance Criteria

- [ ] Route events by type (comment, DM, mention, reaction)
- [ ] Client-specific rule overrides
- [ ] Escalation keyword triggers
- [ ] Kill switches per client
- [ ] Batch routing for efficiency
- [ ] Routing statistics tracking
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-A5",
  "name": "Event Routing",
  "description": "Route normalized events to appropriate handler queues",
  "status": "pending",
  "priority": "medium",
  "complexity": "medium",
  "sprint": 4,
  "agent": "A",
  "dependencies": ["S4-A4"],
  "blocks": ["S4-B1", "S4-C1", "S4-D1"],
  "estimated_hours": 8,
  "tags": ["engagement", "routing", "queues", "tdd"],
  "package": "@rtv/engagement/ingestion"
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "next_task_hints": ["S4-B1 for thread model", "S4-C1 for reply agent", "S4-D1 for escalation"]
}
```
