# Build Prompt: S4-D2 — Human Handoff Workflow

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-D2 |
| Sprint | 4 — Engagement |
| Agent | D — Escalation System |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1 day |
| Dependencies | S4-D1, S4-B4 |
| Blocks | S4-D3, S4-D4 |

---

## Context

### What We're Building
A human handoff workflow that smoothly transitions conversations from automated handling to human operators. Notifies operators via multiple channels, provides full context, and tracks handoff status until resolution.

### Why It Matters
- **Seamless Transition**: No dropped conversations
- **Full Context**: Operators see complete history
- **Timely Response**: Multi-channel notifications
- **Accountability**: Track who is handling what
- **SLA Compliance**: Meet response time targets

### Spec References
- `docs/06-reliability-ops/slo-error-budget.md` — Response time SLOs
- `docs/05-policy-safety/compliance-requirements.md` — Handoff requirements
- `docs/01-architecture/system-architecture-v3.md` — Notification system

---

## Prerequisites

### Completed Tasks
- [x] S4-D1: Escalation Triggers
- [x] S4-B4: Thread State Machine

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/engagement/escalation/src/__tests__/human-handoff.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HumanHandoffService,
  HandoffRequest,
  HandoffStatus,
  NotificationChannel,
} from '../human-handoff';
import { createMockNotifier } from './__mocks__/notifier';
import { createMockRepository } from './__mocks__/repository';

describe('HumanHandoffService', () => {
  let service: HumanHandoffService;
  let mockNotifier: ReturnType<typeof createMockNotifier>;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockNotifier = createMockNotifier();
    mockRepo = createMockRepository();
    service = new HumanHandoffService({
      notifier: mockNotifier,
      repository: mockRepo,
      defaultChannels: ['slack', 'email'],
    });
  });

  describe('initiateHandoff', () => {
    it('should create handoff request and notify operators', async () => {
      mockRepo.createHandoff.mockResolvedValue({
        id: 'handoff_123',
        status: 'pending',
      });

      const request = await service.initiateHandoff({
        threadId: 'thread_1',
        clientId: 'client_abc',
        priority: 'urgent',
        reason: 'Legal threat detected',
        triggers: [{ category: 'legal', keyword: 'lawyer' }],
        threadSummary: 'Customer threatening legal action over delayed refund',
      });

      expect(request.id).toBe('handoff_123');
      expect(mockNotifier.send).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: ['slack', 'email'],
          priority: 'urgent',
        })
      );
    });

    it('should include thread context in notification', async () => {
      mockRepo.createHandoff.mockResolvedValue({ id: 'handoff_456' });

      await service.initiateHandoff({
        threadId: 'thread_2',
        clientId: 'client_abc',
        priority: 'high',
        reason: 'VIP customer complaint',
        threadSummary: 'VIP influencer upset about product quality',
        participantInfo: {
          name: 'Famous Influencer',
          followerCount: 1000000,
          isVip: true,
        },
      });

      expect(mockNotifier.send).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            participantInfo: expect.objectContaining({
              name: 'Famous Influencer',
              followerCount: 1000000,
            }),
          }),
        })
      );
    });

    it('should add SMS for urgent priority', async () => {
      await service.initiateHandoff({
        threadId: 'thread_3',
        clientId: 'client_abc',
        priority: 'urgent',
        reason: 'Safety concern',
        triggers: [{ category: 'safety' }],
      });

      expect(mockNotifier.send).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: expect.arrayContaining(['sms']),
        })
      );
    });

    it('should track handoff start time', async () => {
      const beforeCreate = Date.now();

      await service.initiateHandoff({
        threadId: 'thread_4',
        clientId: 'client_abc',
        priority: 'medium',
        reason: 'Customer request',
      });

      expect(mockRepo.createHandoff).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: expect.any(Date),
        })
      );

      const callArg = mockRepo.createHandoff.mock.calls[0][0];
      expect(callArg.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
    });
  });

  describe('assignOperator', () => {
    it('should assign operator to handoff', async () => {
      mockRepo.getHandoff.mockResolvedValue({
        id: 'handoff_123',
        status: 'pending',
      });
      mockRepo.updateHandoff.mockResolvedValue({
        id: 'handoff_123',
        status: 'assigned',
        assignedTo: 'operator_1',
      });

      const result = await service.assignOperator('handoff_123', 'operator_1');

      expect(result.status).toBe('assigned');
      expect(result.assignedTo).toBe('operator_1');
    });

    it('should record assignment time', async () => {
      mockRepo.getHandoff.mockResolvedValue({
        id: 'handoff_123',
        status: 'pending',
        createdAt: new Date(Date.now() - 60000), // 1 min ago
      });

      await service.assignOperator('handoff_123', 'operator_1');

      expect(mockRepo.updateHandoff).toHaveBeenCalledWith(
        'handoff_123',
        expect.objectContaining({
          assignedAt: expect.any(Date),
        })
      );
    });

    it('should notify operator of assignment', async () => {
      mockRepo.getHandoff.mockResolvedValue({
        id: 'handoff_123',
        status: 'pending',
        threadId: 'thread_1',
      });

      await service.assignOperator('handoff_123', 'operator_1');

      expect(mockNotifier.sendToUser).toHaveBeenCalledWith(
        'operator_1',
        expect.objectContaining({
          type: 'assignment',
          handoffId: 'handoff_123',
        })
      );
    });

    it('should prevent reassignment without release', async () => {
      mockRepo.getHandoff.mockResolvedValue({
        id: 'handoff_123',
        status: 'assigned',
        assignedTo: 'operator_1',
      });

      await expect(
        service.assignOperator('handoff_123', 'operator_2')
      ).rejects.toThrow('Already assigned');
    });
  });

  describe('releaseHandoff', () => {
    it('should release handoff back to queue', async () => {
      mockRepo.getHandoff.mockResolvedValue({
        id: 'handoff_123',
        status: 'assigned',
        assignedTo: 'operator_1',
      });

      await service.releaseHandoff('handoff_123', {
        releasedBy: 'operator_1',
        reason: 'Need specialist assistance',
      });

      expect(mockRepo.updateHandoff).toHaveBeenCalledWith(
        'handoff_123',
        expect.objectContaining({
          status: 'pending',
          assignedTo: null,
        })
      );
    });

    it('should notify team of release', async () => {
      mockRepo.getHandoff.mockResolvedValue({
        id: 'handoff_123',
        status: 'assigned',
        assignedTo: 'operator_1',
        priority: 'high',
      });

      await service.releaseHandoff('handoff_123', {
        releasedBy: 'operator_1',
        reason: 'Out of office',
      });

      expect(mockNotifier.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'handoff_released',
        })
      );
    });
  });

  describe('resolveHandoff', () => {
    it('should mark handoff as resolved', async () => {
      mockRepo.getHandoff.mockResolvedValue({
        id: 'handoff_123',
        status: 'assigned',
        assignedTo: 'operator_1',
        createdAt: new Date(Date.now() - 300000), // 5 min ago
      });

      await service.resolveHandoff('handoff_123', {
        resolvedBy: 'operator_1',
        resolution: 'Issue addressed, customer satisfied',
        outcome: 'resolved',
      });

      expect(mockRepo.updateHandoff).toHaveBeenCalledWith(
        'handoff_123',
        expect.objectContaining({
          status: 'resolved',
          resolvedAt: expect.any(Date),
          resolution: 'Issue addressed, customer satisfied',
        })
      );
    });

    it('should calculate time to resolution', async () => {
      const createdAt = new Date(Date.now() - 600000); // 10 min ago
      mockRepo.getHandoff.mockResolvedValue({
        id: 'handoff_123',
        status: 'assigned',
        assignedTo: 'operator_1',
        createdAt,
      });

      await service.resolveHandoff('handoff_123', {
        resolvedBy: 'operator_1',
        resolution: 'Resolved',
        outcome: 'resolved',
      });

      expect(mockRepo.updateHandoff).toHaveBeenCalledWith(
        'handoff_123',
        expect.objectContaining({
          timeToResolutionMs: expect.any(Number),
        })
      );

      const callArg = mockRepo.updateHandoff.mock.calls[0][1];
      expect(callArg.timeToResolutionMs).toBeGreaterThanOrEqual(600000);
    });
  });

  describe('getActiveHandoffs', () => {
    it('should return pending and assigned handoffs', async () => {
      mockRepo.queryHandoffs.mockResolvedValue({
        handoffs: [
          { id: 'h1', status: 'pending' },
          { id: 'h2', status: 'assigned' },
        ],
        total: 2,
      });

      const result = await service.getActiveHandoffs('client_abc');

      expect(result.handoffs).toHaveLength(2);
    });

    it('should filter by operator', async () => {
      mockRepo.queryHandoffs.mockResolvedValue({
        handoffs: [{ id: 'h1', assignedTo: 'operator_1' }],
        total: 1,
      });

      const result = await service.getActiveHandoffs('client_abc', {
        assignedTo: 'operator_1',
      });

      expect(mockRepo.queryHandoffs).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedTo: 'operator_1',
        })
      );
    });
  });

  describe('escalateHandoff', () => {
    it('should escalate to higher priority', async () => {
      mockRepo.getHandoff.mockResolvedValue({
        id: 'handoff_123',
        status: 'pending',
        priority: 'medium',
      });

      await service.escalateHandoff('handoff_123', {
        newPriority: 'urgent',
        reason: 'Situation worsening',
        escalatedBy: 'operator_1',
      });

      expect(mockRepo.updateHandoff).toHaveBeenCalledWith(
        'handoff_123',
        expect.objectContaining({
          priority: 'urgent',
        })
      );

      // Should send urgent notifications
      expect(mockNotifier.send).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: expect.arrayContaining(['sms']),
        })
      );
    });
  });

  describe('SLA tracking', () => {
    it('should flag handoffs approaching SLA breach', async () => {
      const oldHandoff = {
        id: 'handoff_123',
        status: 'pending',
        priority: 'high',
        createdAt: new Date(Date.now() - 25 * 60000), // 25 min ago
      };
      mockRepo.getHandoff.mockResolvedValue(oldHandoff);

      const slaStatus = await service.checkSLAStatus('handoff_123');

      expect(slaStatus.atRisk).toBe(true);
      expect(slaStatus.timeRemaining).toBeLessThan(5 * 60000); // Less than 5 min
    });

    it('should flag SLA breached handoffs', async () => {
      const oldHandoff = {
        id: 'handoff_456',
        status: 'pending',
        priority: 'urgent',
        createdAt: new Date(Date.now() - 20 * 60000), // 20 min ago (urgent SLA is 15 min)
      };
      mockRepo.getHandoff.mockResolvedValue(oldHandoff);

      const slaStatus = await service.checkSLAStatus('handoff_456');

      expect(slaStatus.breached).toBe(true);
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/engagement/escalation/src/human-handoff.ts
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Trigger, EscalationPriority } from './escalation-triggers';

const tracer = trace.getTracer('human-handoff');

export type HandoffStatus = 'pending' | 'assigned' | 'resolved' | 'expired';
export type HandoffOutcome = 'resolved' | 'escalated' | 'no_action_needed' | 'customer_abandoned';
export type NotificationChannel = 'slack' | 'email' | 'sms' | 'push';

export interface HandoffRequest {
  id: string;
  threadId: string;
  clientId: string;
  status: HandoffStatus;
  priority: EscalationPriority;
  reason: string;
  triggers?: Trigger[];
  threadSummary?: string;
  participantInfo?: {
    name?: string;
    followerCount?: number;
    isVip?: boolean;
  };

  // Assignment
  assignedTo?: string;
  assignedAt?: Date;

  // Resolution
  resolvedAt?: Date;
  resolution?: string;
  outcome?: HandoffOutcome;
  resolvedBy?: string;
  timeToResolutionMs?: number;

  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
}

export interface Notifier {
  send(notification: {
    type: string;
    channels: NotificationChannel[];
    priority: EscalationPriority;
    title: string;
    message: string;
    context?: Record<string, unknown>;
  }): Promise<void>;
  sendToUser(userId: string, notification: Record<string, unknown>): Promise<void>;
}

export interface HandoffRepository {
  createHandoff(data: Omit<HandoffRequest, 'id'>): Promise<HandoffRequest>;
  getHandoff(id: string): Promise<HandoffRequest | null>;
  updateHandoff(id: string, data: Partial<HandoffRequest>): Promise<HandoffRequest>;
  queryHandoffs(query: {
    clientId: string;
    status?: HandoffStatus[];
    assignedTo?: string;
    priority?: EscalationPriority[];
    limit?: number;
  }): Promise<{ handoffs: HandoffRequest[]; total: number }>;
}

const SLA_TARGETS_MS: Record<EscalationPriority, number> = {
  urgent: 15 * 60000, // 15 minutes
  high: 30 * 60000, // 30 minutes
  medium: 60 * 60000, // 1 hour
  low: 4 * 60 * 60000, // 4 hours
};

export class HumanHandoffService {
  private notifier: Notifier;
  private repository: HandoffRepository;
  private defaultChannels: NotificationChannel[];

  constructor(config: {
    notifier: Notifier;
    repository: HandoffRepository;
    defaultChannels?: NotificationChannel[];
  }) {
    this.notifier = config.notifier;
    this.repository = config.repository;
    this.defaultChannels = config.defaultChannels || ['slack', 'email'];
  }

  async initiateHandoff(input: {
    threadId: string;
    clientId: string;
    priority: EscalationPriority;
    reason: string;
    triggers?: Trigger[];
    threadSummary?: string;
    participantInfo?: {
      name?: string;
      followerCount?: number;
      isVip?: boolean;
    };
  }): Promise<HandoffRequest> {
    return tracer.startActiveSpan('initiateHandoff', async (span) => {
      span.setAttributes({
        'handoff.thread_id': input.threadId,
        'handoff.client_id': input.clientId,
        'handoff.priority': input.priority,
      });

      const handoff = await this.repository.createHandoff({
        threadId: input.threadId,
        clientId: input.clientId,
        status: 'pending',
        priority: input.priority,
        reason: input.reason,
        triggers: input.triggers,
        threadSummary: input.threadSummary,
        participantInfo: input.participantInfo,
        createdAt: new Date(),
      });

      // Determine notification channels based on priority
      const channels = this.getChannelsForPriority(input.priority);

      // Send notification
      await this.notifier.send({
        type: 'new_handoff',
        channels,
        priority: input.priority,
        title: `New Escalation: ${input.reason}`,
        message: this.formatHandoffMessage(handoff),
        context: {
          handoffId: handoff.id,
          threadId: input.threadId,
          threadSummary: input.threadSummary,
          participantInfo: input.participantInfo,
        },
      });

      span.setAttributes({ 'handoff.id': handoff.id });
      span.end();

      return handoff;
    });
  }

  private getChannelsForPriority(
    priority: EscalationPriority
  ): NotificationChannel[] {
    const channels = [...this.defaultChannels];

    if (priority === 'urgent') {
      if (!channels.includes('sms')) channels.push('sms');
    }

    return channels;
  }

  private formatHandoffMessage(handoff: HandoffRequest): string {
    let message = `Priority: ${handoff.priority.toUpperCase()}\n`;
    message += `Reason: ${handoff.reason}\n`;

    if (handoff.threadSummary) {
      message += `Summary: ${handoff.threadSummary}\n`;
    }

    if (handoff.participantInfo?.isVip) {
      message += `⭐ VIP Customer`;
      if (handoff.participantInfo.followerCount) {
        message += ` (${handoff.participantInfo.followerCount.toLocaleString()} followers)`;
      }
      message += '\n';
    }

    return message;
  }

  async assignOperator(
    handoffId: string,
    operatorId: string
  ): Promise<HandoffRequest> {
    const handoff = await this.repository.getHandoff(handoffId);
    if (!handoff) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }

    if (handoff.status === 'assigned' && handoff.assignedTo !== operatorId) {
      throw new Error('Already assigned to another operator');
    }

    const updated = await this.repository.updateHandoff(handoffId, {
      status: 'assigned',
      assignedTo: operatorId,
      assignedAt: new Date(),
      updatedAt: new Date(),
    });

    await this.notifier.sendToUser(operatorId, {
      type: 'assignment',
      handoffId,
      threadId: handoff.threadId,
      priority: handoff.priority,
      message: 'You have been assigned to handle this escalation',
    });

    return updated;
  }

  async releaseHandoff(
    handoffId: string,
    data: { releasedBy: string; reason: string }
  ): Promise<HandoffRequest> {
    const handoff = await this.repository.getHandoff(handoffId);
    if (!handoff) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }

    const updated = await this.repository.updateHandoff(handoffId, {
      status: 'pending',
      assignedTo: undefined,
      assignedAt: undefined,
      updatedAt: new Date(),
    });

    await this.notifier.send({
      type: 'handoff_released',
      channels: this.getChannelsForPriority(handoff.priority),
      priority: handoff.priority,
      title: 'Handoff Released',
      message: `${data.releasedBy} released handoff: ${data.reason}`,
      context: { handoffId },
    });

    return updated;
  }

  async resolveHandoff(
    handoffId: string,
    data: {
      resolvedBy: string;
      resolution: string;
      outcome: HandoffOutcome;
    }
  ): Promise<HandoffRequest> {
    const handoff = await this.repository.getHandoff(handoffId);
    if (!handoff) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }

    const resolvedAt = new Date();
    const timeToResolutionMs = resolvedAt.getTime() - handoff.createdAt.getTime();

    return this.repository.updateHandoff(handoffId, {
      status: 'resolved',
      resolvedAt,
      resolution: data.resolution,
      outcome: data.outcome,
      resolvedBy: data.resolvedBy,
      timeToResolutionMs,
      updatedAt: new Date(),
    });
  }

  async escalateHandoff(
    handoffId: string,
    data: {
      newPriority: EscalationPriority;
      reason: string;
      escalatedBy: string;
    }
  ): Promise<HandoffRequest> {
    const handoff = await this.repository.getHandoff(handoffId);
    if (!handoff) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }

    const updated = await this.repository.updateHandoff(handoffId, {
      priority: data.newPriority,
      updatedAt: new Date(),
    });

    // Send notification for priority escalation
    await this.notifier.send({
      type: 'handoff_escalated',
      channels: this.getChannelsForPriority(data.newPriority),
      priority: data.newPriority,
      title: `Handoff Escalated to ${data.newPriority.toUpperCase()}`,
      message: `${data.escalatedBy} escalated: ${data.reason}`,
      context: { handoffId, previousPriority: handoff.priority },
    });

    return updated;
  }

  async getActiveHandoffs(
    clientId: string,
    options?: { assignedTo?: string }
  ): Promise<{ handoffs: HandoffRequest[]; total: number }> {
    return this.repository.queryHandoffs({
      clientId,
      status: ['pending', 'assigned'],
      assignedTo: options?.assignedTo,
    });
  }

  async checkSLAStatus(handoffId: string): Promise<{
    atRisk: boolean;
    breached: boolean;
    timeRemaining: number;
    slaTargetMs: number;
  }> {
    const handoff = await this.repository.getHandoff(handoffId);
    if (!handoff) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }

    const slaTargetMs = SLA_TARGETS_MS[handoff.priority];
    const elapsedMs = Date.now() - handoff.createdAt.getTime();
    const timeRemaining = slaTargetMs - elapsedMs;

    const breached = timeRemaining < 0;
    const atRisk = !breached && timeRemaining < slaTargetMs * 0.2; // <20% time remaining

    return {
      atRisk,
      breached,
      timeRemaining: Math.max(0, timeRemaining),
      slaTargetMs,
    };
  }
}

export function createHumanHandoffService(config: {
  notifier: Notifier;
  repository: HandoffRepository;
  defaultChannels?: NotificationChannel[];
}): HumanHandoffService {
  return new HumanHandoffService(config);
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
| Create | `packages/engagement/escalation/src/human-handoff.ts` | Handoff service |
| Create | `packages/engagement/escalation/src/__tests__/human-handoff.test.ts` | Tests |
| Modify | `packages/engagement/escalation/src/index.ts` | Export handoff service |

---

## Acceptance Criteria

- [ ] Initiate handoff with full context
- [ ] Send multi-channel notifications (Slack, email, SMS for urgent)
- [ ] Assign operators to handoffs
- [ ] Prevent double assignment
- [ ] Release handoffs back to queue
- [ ] Resolve handoffs with outcome tracking
- [ ] Escalate priority of existing handoffs
- [ ] Track time to resolution
- [ ] Check SLA status (at risk, breached)
- [ ] Query active handoffs by client/operator
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-D2",
  "name": "Human Handoff Workflow",
  "description": "Manage smooth transition from automation to human operators",
  "status": "pending",
  "priority": "high",
  "complexity": "medium",
  "sprint": 4,
  "agent": "D",
  "dependencies": ["S4-D1", "S4-B4"],
  "blocks": ["S4-D3", "S4-D4"],
  "estimated_hours": 8,
  "tags": ["engagement", "escalation", "handoff", "workflow", "tdd"],
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
  "next_task_hints": ["S4-D3 for escalation queue", "S4-D4 for resolution tracking"]
}
```
