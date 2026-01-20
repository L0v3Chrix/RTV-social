# Build Prompt: S4-B4 — Thread State Machine

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-B4 |
| Sprint | 4 — Engagement |
| Agent | B — Conversation Thread Model |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1 day |
| Dependencies | S4-B1 |
| Blocks | S4-B5, S4-D2 |

---

## Context

### What We're Building
A state machine for thread lifecycle management. Threads transition through states (open, awaiting_reply, handled, escalated, archived) based on events and operator actions. The state machine enforces valid transitions and emits events for observability.

### Why It Matters
- **Clear Lifecycle**: Know exactly where each thread stands
- **Valid Transitions**: Prevent invalid state changes
- **Audit Trail**: Track all state changes with timestamps
- **Workflow Automation**: Trigger actions on state changes
- **SLA Tracking**: Measure time in each state

### Spec References
- `docs/01-architecture/system-architecture-v3.md` — State management
- `docs/06-reliability-ops/slo-error-budget.md` — SLA metrics
- `docs/03-agents-tools/agent-recursion-contracts.md` — Event contracts

---

## Prerequisites

### Completed Tasks
- [x] S4-B1: Thread Entity Model

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/engagement/threads/src/__tests__/thread-state-machine.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ThreadStateMachine,
  ThreadState,
  ThreadTransition,
  TransitionEvent,
} from '../thread-state-machine';
import { Thread } from '../thread-entity';

describe('ThreadStateMachine', () => {
  let machine: ThreadStateMachine;
  let onTransition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onTransition = vi.fn();
    machine = new ThreadStateMachine({ onTransition });
  });

  const createTestThread = (status: ThreadState): Thread => ({
    id: 'thread_123',
    clientId: 'client_abc',
    platform: 'facebook',
    type: 'comment',
    status,
    messages: [],
    messageCount: 0,
    participants: [],
    participantCount: 0,
    createdAt: new Date(),
    lastMessageAt: new Date(),
    tags: [],
    priority: 'medium',
    metadata: {},
  });

  describe('canTransition', () => {
    it('should allow open -> awaiting_reply', () => {
      const thread = createTestThread('open');
      expect(machine.canTransition(thread, 'awaiting_reply')).toBe(true);
    });

    it('should allow open -> escalated', () => {
      const thread = createTestThread('open');
      expect(machine.canTransition(thread, 'escalated')).toBe(true);
    });

    it('should allow awaiting_reply -> handled', () => {
      const thread = createTestThread('awaiting_reply');
      expect(machine.canTransition(thread, 'handled')).toBe(true);
    });

    it('should allow escalated -> handled', () => {
      const thread = createTestThread('escalated');
      expect(machine.canTransition(thread, 'handled')).toBe(true);
    });

    it('should allow handled -> archived', () => {
      const thread = createTestThread('handled');
      expect(machine.canTransition(thread, 'archived')).toBe(true);
    });

    it('should NOT allow archived -> open', () => {
      const thread = createTestThread('archived');
      expect(machine.canTransition(thread, 'open')).toBe(false);
    });

    it('should NOT allow handled -> open', () => {
      const thread = createTestThread('handled');
      expect(machine.canTransition(thread, 'open')).toBe(false);
    });

    it('should allow reopen: handled -> open with reason', () => {
      const thread = createTestThread('handled');
      expect(
        machine.canTransition(thread, 'open', { reason: 'customer_replied' })
      ).toBe(true);
    });
  });

  describe('transition', () => {
    it('should transition thread and emit event', async () => {
      const thread = createTestThread('open');

      const result = await machine.transition(thread, 'awaiting_reply', {
        actor: 'operator_1',
        reason: 'draft_created',
      });

      expect(result.status).toBe('awaiting_reply');
      expect(onTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'thread_123',
          fromState: 'open',
          toState: 'awaiting_reply',
          actor: 'operator_1',
        })
      );
    });

    it('should throw on invalid transition', async () => {
      const thread = createTestThread('archived');

      await expect(
        machine.transition(thread, 'open', { actor: 'system' })
      ).rejects.toThrow('Invalid transition');
    });

    it('should record transition timestamp', async () => {
      const thread = createTestThread('open');

      const result = await machine.transition(thread, 'escalated', {
        actor: 'system',
        reason: 'keyword_trigger',
      });

      expect(result.escalatedAt).toBeDefined();
      expect(result.escalatedAt!.getTime()).toBeCloseTo(Date.now(), -2);
    });

    it('should record handled timestamp', async () => {
      const thread = createTestThread('awaiting_reply');

      const result = await machine.transition(thread, 'handled', {
        actor: 'operator_1',
        reason: 'reply_sent',
      });

      expect(result.handledAt).toBeDefined();
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions for open thread', () => {
      const thread = createTestThread('open');
      const valid = machine.getValidTransitions(thread);

      expect(valid).toContain('awaiting_reply');
      expect(valid).toContain('escalated');
      expect(valid).toContain('handled');
      expect(valid).not.toContain('archived');
    });

    it('should return valid transitions for escalated thread', () => {
      const thread = createTestThread('escalated');
      const valid = machine.getValidTransitions(thread);

      expect(valid).toContain('handled');
      expect(valid).toContain('open');
      expect(valid).not.toContain('archived');
    });

    it('should return empty for archived thread', () => {
      const thread = createTestThread('archived');
      const valid = machine.getValidTransitions(thread);

      expect(valid).toHaveLength(0);
    });
  });

  describe('getStateHistory', () => {
    it('should track all transitions', async () => {
      let thread = createTestThread('open');

      thread = await machine.transition(thread, 'awaiting_reply', {
        actor: 'system',
        reason: 'auto_draft',
      });

      thread = await machine.transition(thread, 'handled', {
        actor: 'operator_1',
        reason: 'reply_approved',
      });

      const history = machine.getStateHistory('thread_123');

      expect(history).toHaveLength(2);
      expect(history[0].fromState).toBe('open');
      expect(history[0].toState).toBe('awaiting_reply');
      expect(history[1].fromState).toBe('awaiting_reply');
      expect(history[1].toState).toBe('handled');
    });
  });

  describe('getTimeInState', () => {
    it('should calculate time spent in current state', async () => {
      const thread = createTestThread('open');
      thread.createdAt = new Date(Date.now() - 3600000); // 1 hour ago

      const timeInState = machine.getTimeInState(thread);

      expect(timeInState).toBeGreaterThanOrEqual(3600000);
      expect(timeInState).toBeLessThan(3700000);
    });
  });

  describe('auto-transitions', () => {
    it('should auto-escalate on new message if already handled', async () => {
      const thread = createTestThread('handled');

      const result = await machine.onNewMessage(thread, {
        direction: 'inbound',
        messageId: 'msg_new',
      });

      expect(result.status).toBe('open');
    });

    it('should not change state on outbound message', async () => {
      const thread = createTestThread('awaiting_reply');

      const result = await machine.onNewMessage(thread, {
        direction: 'outbound',
        messageId: 'msg_reply',
      });

      expect(result.status).toBe('awaiting_reply');
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/engagement/threads/src/thread-state-machine.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Thread, ThreadStatus } from './thread-entity';

const tracer = trace.getTracer('thread-state-machine');

export type ThreadState = ThreadStatus;

export interface TransitionEvent {
  threadId: string;
  fromState: ThreadState;
  toState: ThreadState;
  actor: string;
  reason?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ThreadTransition {
  fromState: ThreadState;
  toState: ThreadState;
  actor: string;
  reason?: string;
  timestamp: Date;
}

type TransitionMap = Record<ThreadState, ThreadState[]>;

const STANDARD_TRANSITIONS: TransitionMap = {
  open: ['awaiting_reply', 'handled', 'escalated'],
  awaiting_reply: ['open', 'handled', 'escalated'],
  handled: ['archived'],
  escalated: ['open', 'handled'],
  archived: [],
};

const REOPEN_TRANSITIONS: TransitionMap = {
  open: [],
  awaiting_reply: [],
  handled: ['open'], // Can reopen if customer replies
  escalated: [],
  archived: [],
};

export class ThreadStateMachine {
  private onTransitionCallback?: (event: TransitionEvent) => void;
  private transitionHistory: Map<string, ThreadTransition[]> = new Map();
  private stateEntryTimes: Map<string, Date> = new Map();

  constructor(config?: { onTransition?: (event: TransitionEvent) => void }) {
    this.onTransitionCallback = config?.onTransition;
  }

  canTransition(
    thread: Thread,
    toState: ThreadState,
    options?: { reason?: string }
  ): boolean {
    const currentState = thread.status;

    // Check standard transitions
    if (STANDARD_TRANSITIONS[currentState].includes(toState)) {
      return true;
    }

    // Check reopen transitions (requires reason)
    if (
      options?.reason &&
      REOPEN_TRANSITIONS[currentState].includes(toState)
    ) {
      return true;
    }

    return false;
  }

  async transition(
    thread: Thread,
    toState: ThreadState,
    options: { actor: string; reason?: string; metadata?: Record<string, unknown> }
  ): Promise<Thread> {
    return tracer.startActiveSpan('threadTransition', async (span) => {
      span.setAttributes({
        'transition.thread_id': thread.id,
        'transition.from_state': thread.status,
        'transition.to_state': toState,
        'transition.actor': options.actor,
      });

      if (!this.canTransition(thread, toState, { reason: options.reason })) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Invalid transition',
        });
        span.end();
        throw new Error(
          `Invalid transition from ${thread.status} to ${toState}`
        );
      }

      const now = new Date();
      const event: TransitionEvent = {
        threadId: thread.id,
        fromState: thread.status,
        toState,
        actor: options.actor,
        reason: options.reason,
        timestamp: now,
        metadata: options.metadata,
      };

      // Record transition in history
      this.recordTransition(thread.id, {
        fromState: thread.status,
        toState,
        actor: options.actor,
        reason: options.reason,
        timestamp: now,
      });

      // Update state entry time
      this.stateEntryTimes.set(thread.id, now);

      // Build updated thread
      const updatedThread: Thread = {
        ...thread,
        status: toState,
      };

      // Set state-specific timestamps
      if (toState === 'handled') {
        updatedThread.handledAt = now;
      } else if (toState === 'escalated') {
        updatedThread.escalatedAt = now;
      }

      // Emit transition event
      if (this.onTransitionCallback) {
        this.onTransitionCallback(event);
      }

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return updatedThread;
    });
  }

  private recordTransition(threadId: string, transition: ThreadTransition): void {
    const history = this.transitionHistory.get(threadId) || [];
    history.push(transition);
    this.transitionHistory.set(threadId, history);
  }

  getValidTransitions(thread: Thread): ThreadState[] {
    return [...STANDARD_TRANSITIONS[thread.status]];
  }

  getStateHistory(threadId: string): ThreadTransition[] {
    return this.transitionHistory.get(threadId) || [];
  }

  getTimeInState(thread: Thread): number {
    const entryTime = this.stateEntryTimes.get(thread.id) || thread.createdAt;
    return Date.now() - entryTime.getTime();
  }

  async onNewMessage(
    thread: Thread,
    message: { direction: 'inbound' | 'outbound'; messageId: string }
  ): Promise<Thread> {
    // If handled and new inbound message, reopen
    if (thread.status === 'handled' && message.direction === 'inbound') {
      return this.transition(thread, 'open', {
        actor: 'system',
        reason: 'customer_replied',
        metadata: { triggerMessageId: message.messageId },
      });
    }

    // If awaiting_reply and outbound sent, could transition to handled
    // But we leave this to explicit operator action

    return thread;
  }

  async autoEscalate(
    thread: Thread,
    reason: string,
    metadata?: Record<string, unknown>
  ): Promise<Thread> {
    if (this.canTransition(thread, 'escalated')) {
      return this.transition(thread, 'escalated', {
        actor: 'system',
        reason,
        metadata,
      });
    }
    return thread;
  }

  async markHandled(
    thread: Thread,
    operatorId: string,
    reason?: string
  ): Promise<Thread> {
    if (this.canTransition(thread, 'handled')) {
      return this.transition(thread, 'handled', {
        actor: operatorId,
        reason: reason || 'manually_resolved',
      });
    }
    return thread;
  }

  async archive(thread: Thread, operatorId: string): Promise<Thread> {
    if (this.canTransition(thread, 'archived')) {
      return this.transition(thread, 'archived', {
        actor: operatorId,
        reason: 'archived',
      });
    }
    return thread;
  }

  getStateDurations(threadId: string): Record<ThreadState, number> {
    const history = this.getStateHistory(threadId);
    const durations: Record<ThreadState, number> = {
      open: 0,
      awaiting_reply: 0,
      handled: 0,
      escalated: 0,
      archived: 0,
    };

    for (let i = 0; i < history.length; i++) {
      const transition = history[i];
      const nextTransition = history[i + 1];
      const endTime = nextTransition?.timestamp || new Date();
      const duration =
        endTime.getTime() - transition.timestamp.getTime();

      durations[transition.toState] += duration;
    }

    return durations;
  }

  isStale(thread: Thread, thresholdMs: number): boolean {
    const timeInState = this.getTimeInState(thread);
    return thread.status === 'open' && timeInState > thresholdMs;
  }

  needsAttention(thread: Thread): boolean {
    // Open for more than 1 hour
    if (this.isStale(thread, 3600000)) return true;

    // Escalated and not handled
    if (thread.status === 'escalated') return true;

    // High priority
    if (thread.priority === 'urgent' || thread.priority === 'high') {
      return thread.status === 'open' || thread.status === 'awaiting_reply';
    }

    return false;
  }
}

export function createThreadStateMachine(
  onTransition?: (event: TransitionEvent) => void
): ThreadStateMachine {
  return new ThreadStateMachine({ onTransition });
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
| Create | `packages/engagement/threads/src/thread-state-machine.ts` | State machine implementation |
| Create | `packages/engagement/threads/src/__tests__/thread-state-machine.test.ts` | Tests |
| Modify | `packages/engagement/threads/src/index.ts` | Export state machine |

---

## Acceptance Criteria

- [ ] Define valid state transitions (open, awaiting_reply, handled, escalated, archived)
- [ ] Enforce transition rules (prevent invalid transitions)
- [ ] Support reopen transitions with reason
- [ ] Track transition history per thread
- [ ] Calculate time in current state
- [ ] Auto-transition on new inbound message (handled -> open)
- [ ] Emit transition events for observability
- [ ] Identify stale and attention-needed threads
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-B4",
  "name": "Thread State Machine",
  "description": "Manage thread lifecycle with valid state transitions",
  "status": "pending",
  "priority": "medium",
  "complexity": "medium",
  "sprint": 4,
  "agent": "B",
  "dependencies": ["S4-B1"],
  "blocks": ["S4-B5", "S4-D2"],
  "estimated_hours": 8,
  "tags": ["engagement", "threads", "state-machine", "workflow", "tdd"],
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
  "next_task_hints": ["S4-B5 for thread retrieval API", "S4-D2 for human handoff"]
}
```
