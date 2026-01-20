# Build Prompt: S5-B5 — Client Communication

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-B5 |
| Sprint | 5 - Gated Rollout |
| Agent | B - Canary Client Configuration |
| Task Name | Client Communication |
| Complexity | Low |
| Status | pending |
| Dependencies | S5-B4 |
| Blocked By | None |

---

## Context

### What This Builds

The ClientCommunicationService that manages expectation-setting messages to canary clients: welcome messages, status updates, feedback collection, and incident notifications.

### Why It Matters

- **Expectation Setting**: Clients understand they're early adopters
- **Transparency**: Keep clients informed of system status
- **Feedback Loop**: Collect actionable feedback from real users
- **Trust Building**: Proactive communication builds confidence
- **Issue Awareness**: Clients notified of problems before they report

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/rollout/communication/src/__tests__/client-communication.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientCommunicationService } from '../client-communication';

describe('ClientCommunicationService', () => {
  let service: ClientCommunicationService;
  let mockNotifier: any;

  beforeEach(() => {
    mockNotifier = {
      send: vi.fn().mockResolvedValue({ delivered: true }),
    };

    service = new ClientCommunicationService({
      notifier: mockNotifier,
    });
  });

  describe('sendCanaryWelcome', () => {
    it('should send welcome message to canary client', async () => {
      await service.sendCanaryWelcome('client_123', {
        clientName: 'Acme Corp',
        features: ['auto_posting', 'engagement'],
      });

      expect(mockNotifier.send).toHaveBeenCalledWith(
        'client_123',
        expect.objectContaining({
          type: 'canary_welcome',
          template: 'canary-welcome',
        })
      );
    });
  });

  describe('sendStatusUpdate', () => {
    it('should send status update to affected clients', async () => {
      await service.sendStatusUpdate(['client_1', 'client_2'], {
        status: 'healthy',
        message: 'System operating normally',
      });

      expect(mockNotifier.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendIncidentNotification', () => {
    it('should send incident notification with details', async () => {
      await service.sendIncidentNotification('client_123', {
        severity: 'high',
        title: 'Posting delays detected',
        description: 'Some posts may be delayed by up to 1 hour',
        expectedResolution: '2 hours',
      });

      expect(mockNotifier.send).toHaveBeenCalledWith(
        'client_123',
        expect.objectContaining({
          type: 'incident',
          data: expect.objectContaining({ severity: 'high' }),
        })
      );
    });
  });

  describe('collectFeedback', () => {
    it('should send feedback request', async () => {
      await service.collectFeedback('client_123', {
        surveyId: 'canary_feedback_v1',
        questions: ['How satisfied are you?', 'What could be improved?'],
      });

      expect(mockNotifier.send).toHaveBeenCalledWith(
        'client_123',
        expect.objectContaining({ type: 'feedback_request' })
      );
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/rollout/communication/src/client-communication.ts`

```typescript
export interface Notifier {
  send(clientId: string, message: any): Promise<{ delivered: boolean }>;
}

export interface ClientCommunicationServiceConfig {
  notifier: Notifier;
}

export class ClientCommunicationService {
  private notifier: Notifier;

  constructor(config: ClientCommunicationServiceConfig) {
    this.notifier = config.notifier;
  }

  async sendCanaryWelcome(
    clientId: string,
    data: { clientName: string; features: string[] }
  ): Promise<void> {
    await this.notifier.send(clientId, {
      type: 'canary_welcome',
      template: 'canary-welcome',
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async sendStatusUpdate(
    clientIds: string[],
    data: { status: string; message: string }
  ): Promise<void> {
    for (const clientId of clientIds) {
      await this.notifier.send(clientId, {
        type: 'status_update',
        template: 'status-update',
        data,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async sendIncidentNotification(
    clientId: string,
    data: {
      severity: 'low' | 'medium' | 'high' | 'critical';
      title: string;
      description: string;
      expectedResolution?: string;
    }
  ): Promise<void> {
    await this.notifier.send(clientId, {
      type: 'incident',
      template: `incident-${data.severity}`,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async sendResolutionNotification(
    clientId: string,
    data: { incidentId: string; resolution: string }
  ): Promise<void> {
    await this.notifier.send(clientId, {
      type: 'resolution',
      template: 'incident-resolved',
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async collectFeedback(
    clientId: string,
    data: { surveyId: string; questions: string[] }
  ): Promise<void> {
    await this.notifier.send(clientId, {
      type: 'feedback_request',
      template: 'feedback-survey',
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async sendGraduationNotice(
    clientId: string,
    data: { message: string }
  ): Promise<void> {
    await this.notifier.send(clientId, {
      type: 'canary_graduation',
      template: 'canary-graduation',
      data,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## Acceptance Criteria

- [ ] Canary welcome message sent on enrollment
- [ ] Status updates sent to affected clients
- [ ] Incident notifications include severity and ETA
- [ ] Feedback collection via surveys
- [ ] Graduation notice on canary completion

---

## JSON Task Block

```json
{
  "task_id": "S5-B5",
  "name": "Client Communication",
  "description": "ClientCommunicationService for canary client messaging",
  "status": "pending",
  "dependencies": ["S5-B4"],
  "blocks": [],
  "agent": "B",
  "sprint": 5,
  "complexity": "low"
}
```
