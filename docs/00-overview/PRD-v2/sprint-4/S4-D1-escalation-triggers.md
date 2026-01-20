# Build Prompt: S4-D1 — Escalation Triggers

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-D1 |
| Sprint | 4 — Engagement |
| Agent | D — Escalation System |
| Complexity | High |
| Status | Pending |
| Estimated Effort | 1.5 days |
| Dependencies | S4-C2, S4-B3 |
| Blocks | S4-D2, S4-D3 |

---

## Context

### What We're Building
An escalation trigger system that automatically identifies conversations requiring human intervention. Detects keywords, sentiment patterns, topic categories, and risk factors to route high-priority or sensitive threads to human operators.

### Why It Matters
- **Risk Mitigation**: Catch sensitive issues before they escalate
- **Brand Protection**: Human oversight on critical conversations
- **Legal Compliance**: Route legal threats to appropriate teams
- **Customer Satisfaction**: Quick escalation of urgent issues
- **Safety Net**: Catch what automation might mishandle

### Spec References
- `docs/05-policy-safety/compliance-requirements.md` — Escalation requirements
- `docs/06-reliability-ops/slo-error-budget.md` — Response time SLOs
- `docs/03-agents-tools/agent-recursion-contracts.md` — Escalation contracts

---

## Prerequisites

### Completed Tasks
- [x] S4-C2: Safe Response Generation
- [x] S4-B3: Participant Tracking

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/engagement/escalation/src/__tests__/escalation-triggers.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EscalationTriggerService,
  TriggerResult,
  TriggerCategory,
  EscalationPriority,
} from '../escalation-triggers';
import { Thread } from '@rtv/engagement/threads';

describe('EscalationTriggerService', () => {
  let service: EscalationTriggerService;

  beforeEach(() => {
    service = new EscalationTriggerService({
      customKeywords: [],
      sentimentThreshold: -0.7,
    });
  });

  describe('evaluateThread', () => {
    it('should trigger on legal keywords', async () => {
      const thread: Partial<Thread> = {
        id: 'thread_1',
        clientId: 'client_abc',
        platform: 'facebook',
        type: 'comment',
        messages: [
          {
            id: 'msg_1',
            content: 'I will contact my lawyer if this is not resolved!',
            direction: 'inbound',
            author: { platformId: 'user_1', displayName: 'Angry Customer' },
            timestamp: new Date(),
            threadId: 'thread_1',
            platformMessageId: 'fb_msg_1',
          },
        ],
      };

      const result = await service.evaluateThread(thread as Thread);

      expect(result.shouldEscalate).toBe(true);
      expect(result.triggers).toContainEqual(
        expect.objectContaining({
          category: 'legal',
          keyword: 'lawyer',
        })
      );
      expect(result.priority).toBe('urgent');
    });

    it('should trigger on media/PR keywords', async () => {
      const thread: Partial<Thread> = {
        id: 'thread_2',
        messages: [
          {
            id: 'msg_1',
            content: 'I am going to post this on Twitter and it will go viral!',
            direction: 'inbound',
          },
        ],
      };

      const result = await service.evaluateThread(thread as Thread);

      expect(result.shouldEscalate).toBe(true);
      expect(result.triggers.some((t) => t.category === 'media_pr')).toBe(true);
    });

    it('should trigger on safety/harm keywords', async () => {
      const thread: Partial<Thread> = {
        id: 'thread_3',
        messages: [
          {
            id: 'msg_1',
            content: 'This product caused an injury to my child',
            direction: 'inbound',
          },
        ],
      };

      const result = await service.evaluateThread(thread as Thread);

      expect(result.shouldEscalate).toBe(true);
      expect(result.triggers.some((t) => t.category === 'safety')).toBe(true);
      expect(result.priority).toBe('urgent');
    });

    it('should trigger on discrimination keywords', async () => {
      const thread: Partial<Thread> = {
        id: 'thread_4',
        messages: [
          {
            id: 'msg_1',
            content: 'Your employee discriminated against me because of my race',
            direction: 'inbound',
          },
        ],
      };

      const result = await service.evaluateThread(thread as Thread);

      expect(result.shouldEscalate).toBe(true);
      expect(result.triggers.some((t) => t.category === 'discrimination')).toBe(true);
    });

    it('should trigger on extreme negative sentiment', async () => {
      const thread: Partial<Thread> = {
        id: 'thread_5',
        messages: [
          {
            id: 'msg_1',
            content: 'This is absolutely terrible! The worst experience ever! I hate this company!',
            direction: 'inbound',
          },
        ],
        sentiment: 'negative',
      };

      const result = await service.evaluateThread(thread as Thread);

      expect(result.shouldEscalate).toBe(true);
      expect(result.triggers.some((t) => t.category === 'sentiment')).toBe(true);
    });

    it('should trigger on VIP with complaint', async () => {
      const thread: Partial<Thread> = {
        id: 'thread_6',
        messages: [
          {
            id: 'msg_1',
            content: 'This is not acceptable',
            direction: 'inbound',
            author: {
              platformId: 'vip_user',
              displayName: 'Important Person',
            },
          },
        ],
      };

      const result = await service.evaluateThread(thread as Thread, {
        participantContext: {
          isVip: true,
          followerCount: 500000,
        },
      });

      expect(result.shouldEscalate).toBe(true);
      expect(result.triggers.some((t) => t.category === 'vip')).toBe(true);
    });

    it('should trigger on repeated complaints from same user', async () => {
      const thread: Partial<Thread> = {
        id: 'thread_7',
        messages: [
          {
            id: 'msg_1',
            content: 'Having issues again with my order',
            direction: 'inbound',
          },
        ],
      };

      const result = await service.evaluateThread(thread as Thread, {
        participantContext: {
          previousEscalations: 3,
          recentComplaintCount: 5,
        },
      });

      expect(result.shouldEscalate).toBe(true);
      expect(result.triggers.some((t) => t.category === 'repeat_issue')).toBe(true);
    });

    it('should NOT trigger on positive messages', async () => {
      const thread: Partial<Thread> = {
        id: 'thread_8',
        messages: [
          {
            id: 'msg_1',
            content: 'Thank you so much! Great product and great service!',
            direction: 'inbound',
          },
        ],
        sentiment: 'positive',
      };

      const result = await service.evaluateThread(thread as Thread);

      expect(result.shouldEscalate).toBe(false);
      expect(result.triggers).toHaveLength(0);
    });

    it('should trigger on custom keywords', async () => {
      service = new EscalationTriggerService({
        customKeywords: [
          { keyword: 'refund', category: 'financial', priority: 'high' },
          { keyword: 'cancel subscription', category: 'churn_risk', priority: 'high' },
        ],
      });

      const thread: Partial<Thread> = {
        id: 'thread_9',
        messages: [
          {
            id: 'msg_1',
            content: 'I want to cancel my subscription immediately',
            direction: 'inbound',
          },
        ],
      };

      const result = await service.evaluateThread(thread as Thread);

      expect(result.shouldEscalate).toBe(true);
      expect(result.triggers.some((t) => t.category === 'churn_risk')).toBe(true);
    });
  });

  describe('calculatePriority', () => {
    it('should return urgent for safety issues', () => {
      const triggers = [
        { category: 'safety' as TriggerCategory, keyword: 'injury' },
      ];

      const priority = service.calculatePriority(triggers);

      expect(priority).toBe('urgent');
    });

    it('should return urgent for legal issues', () => {
      const triggers = [
        { category: 'legal' as TriggerCategory, keyword: 'lawsuit' },
      ];

      const priority = service.calculatePriority(triggers);

      expect(priority).toBe('urgent');
    });

    it('should return high for media/PR', () => {
      const triggers = [
        { category: 'media_pr' as TriggerCategory, keyword: 'viral' },
      ];

      const priority = service.calculatePriority(triggers);

      expect(priority).toBe('high');
    });

    it('should return highest priority when multiple triggers', () => {
      const triggers = [
        { category: 'sentiment' as TriggerCategory }, // medium
        { category: 'legal' as TriggerCategory }, // urgent
      ];

      const priority = service.calculatePriority(triggers);

      expect(priority).toBe('urgent');
    });
  });

  describe('getRecommendedAction', () => {
    it('should recommend immediate response for urgent', () => {
      const result: TriggerResult = {
        shouldEscalate: true,
        triggers: [{ category: 'safety' }],
        priority: 'urgent',
      };

      const action = service.getRecommendedAction(result);

      expect(action.immediateResponse).toBe(true);
      expect(action.notifyChannels).toContain('slack');
      expect(action.notifyChannels).toContain('email');
    });

    it('should recommend queue for high priority', () => {
      const result: TriggerResult = {
        shouldEscalate: true,
        triggers: [{ category: 'vip' }],
        priority: 'high',
      };

      const action = service.getRecommendedAction(result);

      expect(action.addToQueue).toBe(true);
      expect(action.queuePriority).toBe(1);
    });
  });

  describe('checkAllTriggers', () => {
    it('should check all messages in thread', async () => {
      const thread: Partial<Thread> = {
        id: 'thread_10',
        messages: [
          { id: 'msg_1', content: 'Hello', direction: 'inbound' },
          { id: 'msg_2', content: 'Thanks for reaching out!', direction: 'outbound' },
          { id: 'msg_3', content: 'This is unacceptable, I want to speak to a manager', direction: 'inbound' },
        ],
      };

      const result = await service.evaluateThread(thread as Thread);

      expect(result.shouldEscalate).toBe(true);
      expect(result.triggers.some((t) => t.messageId === 'msg_3')).toBe(true);
    });
  });

  describe('addCustomTrigger', () => {
    it('should allow adding custom triggers at runtime', () => {
      service.addCustomTrigger({
        keyword: 'competitor_name',
        category: 'competitive_intel',
        priority: 'medium',
      });

      const triggers = service.getActiveTriggers();

      expect(triggers.custom).toContainEqual(
        expect.objectContaining({ keyword: 'competitor_name' })
      );
    });
  });

  describe('disableTrigger', () => {
    it('should allow disabling specific triggers', () => {
      service.disableTrigger('sentiment');

      const result = service.evaluateMessage({
        content: 'This is terrible! Worst ever!',
        sentiment: 'negative',
      });

      expect(result.triggers.some((t) => t.category === 'sentiment')).toBe(false);
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/engagement/escalation/src/escalation-triggers.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Thread, ThreadMessage } from '@rtv/engagement/threads';

const tracer = trace.getTracer('escalation-triggers');

export type TriggerCategory =
  | 'legal'
  | 'media_pr'
  | 'safety'
  | 'discrimination'
  | 'sentiment'
  | 'vip'
  | 'repeat_issue'
  | 'financial'
  | 'churn_risk'
  | 'competitive_intel'
  | 'custom';

export type EscalationPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface Trigger {
  category: TriggerCategory;
  keyword?: string;
  messageId?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface TriggerResult {
  shouldEscalate: boolean;
  triggers: Trigger[];
  priority: EscalationPriority;
  summary?: string;
}

export interface CustomKeyword {
  keyword: string;
  category: TriggerCategory;
  priority: EscalationPriority;
}

export interface ParticipantContext {
  isVip?: boolean;
  followerCount?: number;
  previousEscalations?: number;
  recentComplaintCount?: number;
}

export interface RecommendedAction {
  immediateResponse: boolean;
  notifyChannels: string[];
  addToQueue: boolean;
  queuePriority: number;
  suggestedAssignee?: string;
}

const LEGAL_KEYWORDS = [
  'lawyer', 'attorney', 'lawsuit', 'sue', 'legal action', 'court',
  'litigation', 'lawyer up', 'legal team', 'my lawyer',
];

const MEDIA_PR_KEYWORDS = [
  'viral', 'twitter', 'news', 'reporter', 'journalist', 'media',
  'public', 'expose', 'tell everyone', 'post everywhere', 'influencer',
];

const SAFETY_KEYWORDS = [
  'injury', 'injured', 'hurt', 'harm', 'dangerous', 'unsafe',
  'emergency', 'hospital', 'allergic reaction', 'poison', 'death',
];

const DISCRIMINATION_KEYWORDS = [
  'discriminat', 'racist', 'sexist', 'ageist', 'disability',
  'harass', 'hostile', 'bias', 'prejudice',
];

const ESCALATION_REQUEST_KEYWORDS = [
  'manager', 'supervisor', 'escalate', 'speak to someone',
  'higher up', 'in charge', 'complaint department',
];

const PRIORITY_MAP: Record<TriggerCategory, EscalationPriority> = {
  legal: 'urgent',
  safety: 'urgent',
  discrimination: 'urgent',
  media_pr: 'high',
  vip: 'high',
  repeat_issue: 'high',
  financial: 'medium',
  churn_risk: 'medium',
  sentiment: 'medium',
  competitive_intel: 'low',
  custom: 'medium',
};

export class EscalationTriggerService {
  private customKeywords: CustomKeyword[];
  private sentimentThreshold: number;
  private disabledCategories: Set<TriggerCategory> = new Set();

  constructor(config?: {
    customKeywords?: CustomKeyword[];
    sentimentThreshold?: number;
  }) {
    this.customKeywords = config?.customKeywords || [];
    this.sentimentThreshold = config?.sentimentThreshold ?? -0.7;
  }

  async evaluateThread(
    thread: Thread,
    context?: { participantContext?: ParticipantContext }
  ): Promise<TriggerResult> {
    return tracer.startActiveSpan('evaluateTriggers', async (span) => {
      span.setAttributes({
        'trigger.thread_id': thread.id,
        'trigger.message_count': thread.messages?.length || 0,
      });

      const triggers: Trigger[] = [];

      // Check each inbound message
      const inboundMessages = (thread.messages || []).filter(
        (m) => m.direction === 'inbound'
      );

      for (const message of inboundMessages) {
        const messageResult = this.evaluateMessage({
          content: message.content,
          messageId: message.id,
        });
        triggers.push(...messageResult.triggers);
      }

      // Check thread-level sentiment
      if (
        thread.sentiment === 'negative' &&
        !this.disabledCategories.has('sentiment')
      ) {
        triggers.push({
          category: 'sentiment',
          confidence: 0.8,
        });
      }

      // Check participant context
      if (context?.participantContext) {
        const contextTriggers = this.evaluateParticipantContext(
          context.participantContext
        );
        triggers.push(...contextTriggers);
      }

      const shouldEscalate = triggers.length > 0;
      const priority = this.calculatePriority(triggers);

      span.setAttributes({
        'trigger.should_escalate': shouldEscalate,
        'trigger.count': triggers.length,
        'trigger.priority': priority,
      });
      span.end();

      return {
        shouldEscalate,
        triggers,
        priority,
        summary: this.generateSummary(triggers),
      };
    });
  }

  evaluateMessage(input: {
    content: string;
    messageId?: string;
    sentiment?: string;
  }): { triggers: Trigger[] } {
    const triggers: Trigger[] = [];
    const contentLower = input.content.toLowerCase();

    // Legal keywords
    if (!this.disabledCategories.has('legal')) {
      for (const keyword of LEGAL_KEYWORDS) {
        if (contentLower.includes(keyword)) {
          triggers.push({
            category: 'legal',
            keyword,
            messageId: input.messageId,
          });
          break;
        }
      }
    }

    // Media/PR keywords
    if (!this.disabledCategories.has('media_pr')) {
      for (const keyword of MEDIA_PR_KEYWORDS) {
        if (contentLower.includes(keyword)) {
          triggers.push({
            category: 'media_pr',
            keyword,
            messageId: input.messageId,
          });
          break;
        }
      }
    }

    // Safety keywords
    if (!this.disabledCategories.has('safety')) {
      for (const keyword of SAFETY_KEYWORDS) {
        if (contentLower.includes(keyword)) {
          triggers.push({
            category: 'safety',
            keyword,
            messageId: input.messageId,
          });
          break;
        }
      }
    }

    // Discrimination keywords
    if (!this.disabledCategories.has('discrimination')) {
      for (const keyword of DISCRIMINATION_KEYWORDS) {
        if (contentLower.includes(keyword)) {
          triggers.push({
            category: 'discrimination',
            keyword,
            messageId: input.messageId,
          });
          break;
        }
      }
    }

    // Escalation request
    for (const keyword of ESCALATION_REQUEST_KEYWORDS) {
      if (contentLower.includes(keyword)) {
        triggers.push({
          category: 'custom',
          keyword,
          messageId: input.messageId,
          metadata: { type: 'escalation_request' },
        });
        break;
      }
    }

    // Custom keywords
    for (const customKw of this.customKeywords) {
      if (contentLower.includes(customKw.keyword.toLowerCase())) {
        triggers.push({
          category: customKw.category,
          keyword: customKw.keyword,
          messageId: input.messageId,
        });
      }
    }

    return { triggers };
  }

  private evaluateParticipantContext(context: ParticipantContext): Trigger[] {
    const triggers: Trigger[] = [];

    // VIP with any issue
    if (context.isVip && !this.disabledCategories.has('vip')) {
      triggers.push({
        category: 'vip',
        metadata: { followerCount: context.followerCount },
      });
    }

    // Repeat issues
    if (
      (context.previousEscalations || 0) >= 2 ||
      (context.recentComplaintCount || 0) >= 3
    ) {
      if (!this.disabledCategories.has('repeat_issue')) {
        triggers.push({
          category: 'repeat_issue',
          metadata: {
            previousEscalations: context.previousEscalations,
            recentComplaints: context.recentComplaintCount,
          },
        });
      }
    }

    return triggers;
  }

  calculatePriority(triggers: Trigger[]): EscalationPriority {
    if (triggers.length === 0) return 'low';

    const priorities: EscalationPriority[] = triggers.map(
      (t) => PRIORITY_MAP[t.category] || 'medium'
    );

    if (priorities.includes('urgent')) return 'urgent';
    if (priorities.includes('high')) return 'high';
    if (priorities.includes('medium')) return 'medium';
    return 'low';
  }

  private generateSummary(triggers: Trigger[]): string {
    if (triggers.length === 0) return '';

    const categories = [...new Set(triggers.map((t) => t.category))];
    return `Escalation triggers: ${categories.join(', ')}`;
  }

  getRecommendedAction(result: TriggerResult): RecommendedAction {
    const action: RecommendedAction = {
      immediateResponse: false,
      notifyChannels: [],
      addToQueue: true,
      queuePriority: 3,
    };

    switch (result.priority) {
      case 'urgent':
        action.immediateResponse = true;
        action.notifyChannels = ['slack', 'email', 'sms'];
        action.queuePriority = 0;
        break;
      case 'high':
        action.notifyChannels = ['slack', 'email'];
        action.queuePriority = 1;
        break;
      case 'medium':
        action.notifyChannels = ['slack'];
        action.queuePriority = 2;
        break;
      default:
        action.queuePriority = 3;
    }

    return action;
  }

  addCustomTrigger(trigger: CustomKeyword): void {
    this.customKeywords.push(trigger);
  }

  removeCustomTrigger(keyword: string): void {
    this.customKeywords = this.customKeywords.filter(
      (t) => t.keyword !== keyword
    );
  }

  disableTrigger(category: TriggerCategory): void {
    this.disabledCategories.add(category);
  }

  enableTrigger(category: TriggerCategory): void {
    this.disabledCategories.delete(category);
  }

  getActiveTriggers(): {
    legal: string[];
    media_pr: string[];
    safety: string[];
    discrimination: string[];
    custom: CustomKeyword[];
    disabled: TriggerCategory[];
  } {
    return {
      legal: LEGAL_KEYWORDS,
      media_pr: MEDIA_PR_KEYWORDS,
      safety: SAFETY_KEYWORDS,
      discrimination: DISCRIMINATION_KEYWORDS,
      custom: this.customKeywords,
      disabled: [...this.disabledCategories],
    };
  }
}

export function createEscalationTriggerService(config?: {
  customKeywords?: CustomKeyword[];
  sentimentThreshold?: number;
}): EscalationTriggerService {
  return new EscalationTriggerService(config);
}
```

### Phase 3: Verification

```bash
cd packages/engagement/escalation && pnpm test
pnpm test:coverage
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/engagement/escalation/src/escalation-triggers.ts` | Trigger service |
| Create | `packages/engagement/escalation/src/__tests__/escalation-triggers.test.ts` | Tests |
| Create | `packages/engagement/escalation/package.json` | Package config |
| Modify | `packages/engagement/escalation/src/index.ts` | Export triggers |

---

## Acceptance Criteria

- [ ] Detect legal keywords (lawyer, lawsuit, sue)
- [ ] Detect media/PR keywords (viral, reporter, expose)
- [ ] Detect safety keywords (injury, dangerous, emergency)
- [ ] Detect discrimination keywords
- [ ] Detect explicit escalation requests (speak to manager)
- [ ] Support custom keywords per client
- [ ] Evaluate thread-level sentiment
- [ ] Consider VIP status
- [ ] Consider repeat issue history
- [ ] Calculate appropriate priority (urgent, high, medium, low)
- [ ] Generate recommended actions
- [ ] Allow disabling specific trigger categories
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-D1",
  "name": "Escalation Triggers",
  "description": "Detect conversations requiring human intervention",
  "status": "pending",
  "priority": "high",
  "complexity": "high",
  "sprint": 4,
  "agent": "D",
  "dependencies": ["S4-C2", "S4-B3"],
  "blocks": ["S4-D2", "S4-D3"],
  "estimated_hours": 12,
  "tags": ["engagement", "escalation", "triggers", "safety", "tdd"],
  "package": "@rtv/engagement/escalation"
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "next_task_hints": ["S4-D2 for human handoff workflow", "S4-D3 for escalation queue"]
}
```
