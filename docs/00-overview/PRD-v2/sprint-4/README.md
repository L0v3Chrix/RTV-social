# Sprint 4: Engagement

**Duration:** Weeks 9-10
**Goal:** Implement engagement ingestion, reply drafting, and escalation.

---

## Overview

Sprint 4 focuses on the engagement layer — receiving, processing, and responding to comments, DMs, and mentions across all platforms. The system ingests events, creates conversation threads, drafts AI replies (for human approval), and escalates sensitive conversations.

**Critical Safety Rule:** All replies require human approval — NO auto-sending.

---

## Agents

| Agent | Focus | Tasks |
|-------|-------|-------|
| A | Event Ingestion | A1-A5 (Webhooks, polling, normalization) |
| B | Thread Model | B1-B5 (Threads, summaries, state machine) |
| C | Reply Agent | C1-C5 (Drafting, auto-like, safety) |
| D | Escalation | D1-D5 (Triggers, handoff, queue) |

---

## Task Index

### Agent A: Event Ingestion
| Task | File | Description |
|------|------|-------------|
| S4-A1 | [S4-A1-webhook-receiver.md](./S4-A1-webhook-receiver.md) | Webhook receiver for Meta, YouTube |
| S4-A2 | [S4-A2-polling-system.md](./S4-A2-polling-system.md) | Polling system for TikTok, LinkedIn, X |
| S4-A3 | [S4-A3-event-normalization.md](./S4-A3-event-normalization.md) | Unified event schema |
| S4-A4 | [S4-A4-deduplication.md](./S4-A4-deduplication.md) | Event deduplication |
| S4-A5 | [S4-A5-event-routing.md](./S4-A5-event-routing.md) | Route events to handlers |

### Agent B: Thread Model
| Task | File | Description |
|------|------|-------------|
| S4-B1 | [S4-B1-thread-entity.md](./S4-B1-thread-entity.md) | Thread entity model |
| S4-B2 | [S4-B2-thread-summary.md](./S4-B2-thread-summary.md) | ThreadSummary system |
| S4-B3 | [S4-B3-participant-tracking.md](./S4-B3-participant-tracking.md) | User history per thread |
| S4-B4 | [S4-B4-thread-state-machine.md](./S4-B4-thread-state-machine.md) | State machine |
| S4-B5 | [S4-B5-thread-retrieval.md](./S4-B5-thread-retrieval.md) | Thread retrieval API |

### Agent C: Reply Agent
| Task | File | Description |
|------|------|-------------|
| S4-C1 | [S4-C1-reply-prompts.md](./S4-C1-reply-prompts.md) | Reply prompt system |
| S4-C2 | [S4-C2-safe-generation.md](./S4-C2-safe-generation.md) | Safe response generation |
| S4-C3 | [S4-C3-auto-like.md](./S4-C3-auto-like.md) | Auto-like with throttling |
| S4-C4 | [S4-C4-comment-drafts.md](./S4-C4-comment-drafts.md) | Comment reply drafts |
| S4-C5 | [S4-C5-dm-drafts.md](./S4-C5-dm-drafts.md) | DM reply drafts |

### Agent D: Escalation
| Task | File | Description |
|------|------|-------------|
| S4-D1 | [S4-D1-escalation-triggers.md](./S4-D1-escalation-triggers.md) | Escalation triggers |
| S4-D2 | [S4-D2-human-handoff.md](./S4-D2-human-handoff.md) | Human handoff workflow |
| S4-D3 | [S4-D3-escalation-queue.md](./S4-D3-escalation-queue.md) | Escalation queue |
| S4-D4 | [S4-D4-resolution-tracking.md](./S4-D4-resolution-tracking.md) | Resolution tracking |
| S4-D5 | [S4-D5-escalation-metrics.md](./S4-D5-escalation-metrics.md) | Escalation metrics |

---

## Dependencies

```
Sprint 3 (Complete)
    │
    ├── S4-A1: Webhook Receiver
    │   └── S4-A3: Event Normalization
    │       └── S4-A4: Deduplication
    │           └── S4-A5: Event Routing
    │
    ├── S4-A2: Polling System
    │   └── S4-A3: Event Normalization
    │
    ├── S4-B1: Thread Entity
    │   ├── S4-B2: Thread Summary
    │   ├── S4-B3: Participant Tracking
    │   ├── S4-B4: Thread State Machine
    │   └── S4-B5: Thread Retrieval
    │
    ├── S4-C1: Reply Prompts
    │   └── S4-C2: Safe Generation
    │       ├── S4-C3: Auto-Like
    │       ├── S4-C4: Comment Drafts
    │       └── S4-C5: DM Drafts
    │
    └── S4-D1: Escalation Triggers
        └── S4-D2: Human Handoff
            └── S4-D3: Escalation Queue
                ├── S4-D4: Resolution Tracking
                └── S4-D5: Escalation Metrics
```

---

## Packages Created

| Package | Purpose |
|---------|---------|
| `@rtv/engagement/ingestion` | Event ingestion (webhooks, polling) |
| `@rtv/engagement/threads` | Thread model and summaries |
| `@rtv/agents/reply` | Reply drafting agent |
| `@rtv/engagement/escalation` | Escalation system |

---

## Key Patterns

### Event Normalization
All platform events normalized to unified schema:
```typescript
interface NormalizedEvent {
  id: string;
  clientId: string;
  platform: Platform;
  eventType: 'comment' | 'dm' | 'mention' | 'reaction';
  postId?: string;
  threadId?: string;
  author: {
    platformId: string;
    displayName: string;
    profileUrl?: string;
  };
  content: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}
```

### Thread State Machine
```
NEW → OPEN → IN_PROGRESS → HANDLED
                ↓
            ESCALATED → RESOLVED
```

### Reply Draft Workflow
```
Event → Thread → AI Draft → Human Review → Approve/Edit → Send
                              ↓
                          Escalate
```

---

## Safety Rules

1. **No Auto-Send**: All replies require human approval
2. **Rate Limiting**: Likes throttled per platform limits
3. **Escalation Triggers**: Keywords, sentiment, topics auto-escalate
4. **Brand Voice**: All drafts checked for consistency
5. **Kill Switch**: Per-client engagement disable

---

## Definition of Done

- [ ] Webhooks receiving Meta/YouTube events
- [ ] Polling running for TikTok/LinkedIn/X
- [ ] Events normalized and deduplicated
- [ ] Threads created with summaries
- [ ] Reply drafts generated (not sent)
- [ ] Escalation queue populated
- [ ] Human approval gates enforced
- [ ] Kill switches operational
