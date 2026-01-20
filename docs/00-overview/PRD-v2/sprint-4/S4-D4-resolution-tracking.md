# Build Prompt: S4-D4 — Resolution Tracking

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S4-D4 |
| Sprint | 4 - Engagement |
| Agent | D - Escalation |
| Task Name | Resolution Tracking |
| Complexity | Medium |
| Status | pending |
| Dependencies | S4-D1, S4-D2, S4-D3 |
| Blocked By | None |

---

## Context

### What This Builds

The ResolutionTracker that records how escalations are resolved, measures time-to-resolution, captures operator feedback, and tracks customer satisfaction. This provides the foundation for measuring escalation team performance and identifying process improvements.

### Why It Matters

- **Performance Visibility**: Know how long escalations take and why
- **Quality Assurance**: Capture resolution quality through satisfaction scores
- **Process Improvement**: Identify common resolution patterns and bottlenecks
- **Accountability**: Track operator performance with fair metrics
- **Customer Experience**: Correlate resolution approaches with satisfaction

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Engagement Layer | Escalation resolution patterns |
| `docs/05-policy-safety/compliance-safety-policy.md` | Incident Management | Resolution requirements |
| `docs/06-reliability-ops/slo-error-budget.md` | SLOs | Resolution time targets |
| `docs/02-schemas/external-memory-schema.md` | Episode Structure | Resolution event logging |

---

## Prerequisites

### Completed Tasks

- [x] S4-D1: EscalationTriggerService (triggers create escalations)
- [x] S4-D2: HumanHandoffService (handoffs resolve into resolutions)
- [x] S4-D3: EscalationQueue (queue items close via resolution)

### Required Packages

```json
{
  "dependencies": {
    "zod": "^3.23.0",
    "nanoid": "^5.0.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create comprehensive tests BEFORE any implementation.

#### 1.1 Create Resolution Types Test

**File:** `packages/engagement/escalation/src/__tests__/resolution-types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  ResolutionSchema,
  ResolutionOutcome,
  ResolutionMethod,
  ResolutionFeedbackSchema,
  SatisfactionRating,
  validateResolution,
  validateFeedback,
} from '../resolution-types';

describe('Resolution Types', () => {
  describe('ResolutionSchema', () => {
    it('should validate a complete resolution record', () => {
      const resolution = {
        id: 'res_abc123',
        escalationId: 'esc_xyz789',
        handoffId: 'hnd_def456',
        clientId: 'client_001',
        outcome: 'resolved' as const,
        method: 'direct_response' as const,
        summary: 'Customer inquiry about billing resolved by explaining charges',
        internalNotes: 'Customer was confused about subscription tiers',
        actionsTaken: [
          'Reviewed account billing history',
          'Explained subscription tier differences',
          'Applied courtesy credit',
        ],
        resolvedBy: 'operator_123',
        resolvedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        timeToResolutionMs: 1200000, // 20 minutes
      };

      const result = ResolutionSchema.safeParse(resolution);
      expect(result.success).toBe(true);
    });

    it('should require escalationId', () => {
      const resolution = {
        id: 'res_abc123',
        clientId: 'client_001',
        outcome: 'resolved',
        resolvedAt: new Date().toISOString(),
      };

      const result = ResolutionSchema.safeParse(resolution);
      expect(result.success).toBe(false);
    });

    it('should validate outcome enum values', () => {
      const validOutcomes: ResolutionOutcome[] = [
        'resolved',
        'partially_resolved',
        'unresolved',
        'duplicate',
        'invalid',
        'no_action_needed',
      ];

      validOutcomes.forEach(outcome => {
        const resolution = {
          id: 'res_abc123',
          escalationId: 'esc_xyz789',
          clientId: 'client_001',
          outcome,
          resolvedAt: new Date().toISOString(),
        };

        const result = ResolutionSchema.safeParse(resolution);
        expect(result.success).toBe(true);
      });
    });

    it('should validate method enum values', () => {
      const validMethods: ResolutionMethod[] = [
        'direct_response',
        'dm_conversation',
        'phone_call',
        'email',
        'internal_only',
        'platform_action',
        'escalated_further',
      ];

      validMethods.forEach(method => {
        const resolution = {
          id: 'res_abc123',
          escalationId: 'esc_xyz789',
          clientId: 'client_001',
          outcome: 'resolved',
          method,
          resolvedAt: new Date().toISOString(),
        };

        const result = ResolutionSchema.safeParse(resolution);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('ResolutionFeedbackSchema', () => {
    it('should validate satisfaction feedback', () => {
      const feedback = {
        id: 'fbk_abc123',
        resolutionId: 'res_xyz789',
        source: 'customer' as const,
        satisfactionRating: 5 as SatisfactionRating,
        wouldRecommend: true,
        feedbackText: 'Very helpful and quick response!',
        collectedAt: new Date().toISOString(),
        collectionMethod: 'follow_up_survey' as const,
      };

      const result = ResolutionFeedbackSchema.safeParse(feedback);
      expect(result.success).toBe(true);
    });

    it('should validate satisfaction rating range (1-5)', () => {
      const validRatings = [1, 2, 3, 4, 5];

      validRatings.forEach(rating => {
        const feedback = {
          id: 'fbk_abc123',
          resolutionId: 'res_xyz789',
          source: 'customer',
          satisfactionRating: rating,
          collectedAt: new Date().toISOString(),
        };

        const result = ResolutionFeedbackSchema.safeParse(feedback);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid satisfaction ratings', () => {
      const invalidRatings = [0, 6, -1, 10];

      invalidRatings.forEach(rating => {
        const feedback = {
          id: 'fbk_abc123',
          resolutionId: 'res_xyz789',
          source: 'customer',
          satisfactionRating: rating,
          collectedAt: new Date().toISOString(),
        };

        const result = ResolutionFeedbackSchema.safeParse(feedback);
        expect(result.success).toBe(false);
      });
    });

    it('should support operator self-assessment feedback', () => {
      const feedback = {
        id: 'fbk_abc123',
        resolutionId: 'res_xyz789',
        source: 'operator' as const,
        difficultyRating: 3,
        timeAdequate: true,
        toolsAdequate: false,
        suggestedImprovements: 'Need better access to order history',
        collectedAt: new Date().toISOString(),
        collectionMethod: 'post_resolution' as const,
      };

      const result = ResolutionFeedbackSchema.safeParse(feedback);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Functions', () => {
    it('should validate resolution with type guard', () => {
      const resolution = {
        id: 'res_abc123',
        escalationId: 'esc_xyz789',
        clientId: 'client_001',
        outcome: 'resolved',
        resolvedAt: new Date().toISOString(),
      };

      expect(validateResolution(resolution)).toBe(true);
    });

    it('should validate feedback with type guard', () => {
      const feedback = {
        id: 'fbk_abc123',
        resolutionId: 'res_xyz789',
        source: 'customer',
        satisfactionRating: 4,
        collectedAt: new Date().toISOString(),
      };

      expect(validateFeedback(feedback)).toBe(true);
    });
  });
});
```

#### 1.2 Create ResolutionTracker Test

**File:** `packages/engagement/escalation/src/__tests__/resolution-tracker.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResolutionTracker } from '../resolution-tracker';
import { Resolution, ResolutionFeedback } from '../resolution-types';

describe('ResolutionTracker', () => {
  let tracker: ResolutionTracker;
  let mockRepository: any;
  let mockEventEmitter: any;
  let mockTelemetry: any;

  beforeEach(() => {
    mockRepository = {
      saveResolution: vi.fn().mockResolvedValue(undefined),
      getResolution: vi.fn(),
      saveFeedback: vi.fn().mockResolvedValue(undefined),
      getFeedbackForResolution: vi.fn(),
      getResolutionsForClient: vi.fn(),
      getResolutionsByOperator: vi.fn(),
      updateResolution: vi.fn().mockResolvedValue(undefined),
    };

    mockEventEmitter = {
      emit: vi.fn(),
    };

    mockTelemetry = {
      recordResolution: vi.fn(),
      recordFeedback: vi.fn(),
    };

    tracker = new ResolutionTracker({
      repository: mockRepository,
      eventEmitter: mockEventEmitter,
      telemetry: mockTelemetry,
    });
  });

  describe('recordResolution', () => {
    it('should record a complete resolution', async () => {
      const escalation = {
        id: 'esc_xyz789',
        clientId: 'client_001',
        priority: 'high',
        createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
      };

      const handoff = {
        id: 'hnd_def456',
        assignedTo: 'operator_123',
        assignedAt: new Date(Date.now() - 1200000).toISOString(), // 20 min ago
      };

      const resolutionData = {
        outcome: 'resolved' as const,
        method: 'direct_response' as const,
        summary: 'Resolved customer billing inquiry',
        actionsTaken: ['Reviewed account', 'Applied credit'],
      };

      const resolution = await tracker.recordResolution(
        escalation,
        handoff,
        resolutionData
      );

      expect(resolution.id).toMatch(/^res_/);
      expect(resolution.escalationId).toBe('esc_xyz789');
      expect(resolution.handoffId).toBe('hnd_def456');
      expect(resolution.clientId).toBe('client_001');
      expect(resolution.outcome).toBe('resolved');
      expect(resolution.resolvedBy).toBe('operator_123');
      expect(resolution.timeToResolutionMs).toBeGreaterThan(0);

      expect(mockRepository.saveResolution).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'escalation.resolved',
        expect.any(Object)
      );
      expect(mockTelemetry.recordResolution).toHaveBeenCalled();
    });

    it('should calculate time-to-resolution from escalation creation', async () => {
      const escalationCreatedAt = Date.now() - 3600000; // 1 hour ago

      const escalation = {
        id: 'esc_xyz789',
        clientId: 'client_001',
        createdAt: new Date(escalationCreatedAt).toISOString(),
      };

      const handoff = {
        id: 'hnd_def456',
        assignedTo: 'operator_123',
      };

      const resolution = await tracker.recordResolution(
        escalation,
        handoff,
        { outcome: 'resolved' }
      );

      // TTR should be approximately 1 hour (within 100ms tolerance)
      expect(resolution.timeToResolutionMs).toBeGreaterThan(3599900);
      expect(resolution.timeToResolutionMs).toBeLessThan(3700000);
    });

    it('should handle resolution without handoff (auto-resolved)', async () => {
      const escalation = {
        id: 'esc_xyz789',
        clientId: 'client_001',
        createdAt: new Date().toISOString(),
      };

      const resolution = await tracker.recordResolution(
        escalation,
        null, // No handoff
        { outcome: 'duplicate', summary: 'Duplicate of existing thread' }
      );

      expect(resolution.handoffId).toBeUndefined();
      expect(resolution.resolvedBy).toBe('system');
      expect(resolution.outcome).toBe('duplicate');
    });

    it('should emit different events based on outcome', async () => {
      const escalation = {
        id: 'esc_xyz789',
        clientId: 'client_001',
        createdAt: new Date().toISOString(),
      };

      const handoff = {
        id: 'hnd_def456',
        assignedTo: 'operator_123',
      };

      // Test unresolved outcome
      await tracker.recordResolution(
        escalation,
        handoff,
        { outcome: 'unresolved', summary: 'Customer did not respond' }
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'escalation.unresolved',
        expect.any(Object)
      );
    });
  });

  describe('recordFeedback', () => {
    it('should record customer satisfaction feedback', async () => {
      const resolutionId = 'res_abc123';
      mockRepository.getResolution.mockResolvedValue({
        id: resolutionId,
        escalationId: 'esc_xyz789',
        outcome: 'resolved',
      });

      const feedbackData = {
        source: 'customer' as const,
        satisfactionRating: 5,
        wouldRecommend: true,
        feedbackText: 'Excellent support!',
        collectionMethod: 'follow_up_survey' as const,
      };

      const feedback = await tracker.recordFeedback(resolutionId, feedbackData);

      expect(feedback.id).toMatch(/^fbk_/);
      expect(feedback.resolutionId).toBe(resolutionId);
      expect(feedback.satisfactionRating).toBe(5);

      expect(mockRepository.saveFeedback).toHaveBeenCalled();
      expect(mockTelemetry.recordFeedback).toHaveBeenCalled();
    });

    it('should record operator self-assessment feedback', async () => {
      const resolutionId = 'res_abc123';
      mockRepository.getResolution.mockResolvedValue({
        id: resolutionId,
        outcome: 'resolved',
      });

      const feedbackData = {
        source: 'operator' as const,
        difficultyRating: 4,
        timeAdequate: false,
        toolsAdequate: true,
        suggestedImprovements: 'Need more context about customer history',
        collectionMethod: 'post_resolution' as const,
      };

      const feedback = await tracker.recordFeedback(resolutionId, feedbackData);

      expect(feedback.source).toBe('operator');
      expect(feedback.difficultyRating).toBe(4);
    });

    it('should throw if resolution not found', async () => {
      mockRepository.getResolution.mockResolvedValue(null);

      await expect(
        tracker.recordFeedback('res_nonexistent', {
          source: 'customer',
          satisfactionRating: 3,
          collectionMethod: 'follow_up_survey',
        })
      ).rejects.toThrow('Resolution not found');
    });
  });

  describe('getResolutionStats', () => {
    it('should calculate resolution statistics for a client', async () => {
      const resolutions = [
        {
          id: 'res_1',
          outcome: 'resolved',
          timeToResolutionMs: 900000, // 15 min
        },
        {
          id: 'res_2',
          outcome: 'resolved',
          timeToResolutionMs: 1800000, // 30 min
        },
        {
          id: 'res_3',
          outcome: 'unresolved',
          timeToResolutionMs: 7200000, // 2 hours
        },
        {
          id: 'res_4',
          outcome: 'partially_resolved',
          timeToResolutionMs: 2700000, // 45 min
        },
      ];

      mockRepository.getResolutionsForClient.mockResolvedValue(resolutions);
      mockRepository.getFeedbackForResolution
        .mockResolvedValueOnce([{ satisfactionRating: 5 }])
        .mockResolvedValueOnce([{ satisfactionRating: 4 }])
        .mockResolvedValueOnce([{ satisfactionRating: 2 }])
        .mockResolvedValueOnce([{ satisfactionRating: 3 }]);

      const stats = await tracker.getResolutionStats('client_001', {
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
      });

      expect(stats.totalResolutions).toBe(4);
      expect(stats.resolvedCount).toBe(2);
      expect(stats.unresolvedCount).toBe(1);
      expect(stats.partiallyResolvedCount).toBe(1);
      expect(stats.resolutionRate).toBe(0.5); // 2/4
      expect(stats.averageTimeToResolutionMs).toBeGreaterThan(0);
      expect(stats.averageSatisfaction).toBe(3.5); // (5+4+2+3)/4
    });

    it('should calculate operator-specific stats', async () => {
      const resolutions = [
        { id: 'res_1', resolvedBy: 'op_123', outcome: 'resolved', timeToResolutionMs: 600000 },
        { id: 'res_2', resolvedBy: 'op_123', outcome: 'resolved', timeToResolutionMs: 900000 },
        { id: 'res_3', resolvedBy: 'op_123', outcome: 'unresolved', timeToResolutionMs: 1800000 },
      ];

      mockRepository.getResolutionsByOperator.mockResolvedValue(resolutions);

      const stats = await tracker.getOperatorStats('op_123', {
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
      });

      expect(stats.operatorId).toBe('op_123');
      expect(stats.totalResolutions).toBe(3);
      expect(stats.resolutionRate).toBeCloseTo(0.667, 2);
      expect(stats.averageTimeToResolutionMs).toBe(1100000); // (600+900+1800)/3
    });
  });

  describe('getSLACompliance', () => {
    it('should calculate SLA compliance rates', async () => {
      const resolutions = [
        { priority: 'urgent', timeToResolutionMs: 600000 }, // 10 min - within 15 min SLA
        { priority: 'urgent', timeToResolutionMs: 1200000 }, // 20 min - over 15 min SLA
        { priority: 'high', timeToResolutionMs: 1500000 }, // 25 min - within 30 min SLA
        { priority: 'high', timeToResolutionMs: 2400000 }, // 40 min - over 30 min SLA
        { priority: 'medium', timeToResolutionMs: 3000000 }, // 50 min - within 1 hr SLA
        { priority: 'low', timeToResolutionMs: 10800000 }, // 3 hours - within 4 hr SLA
      ];

      mockRepository.getResolutionsForClient.mockResolvedValue(resolutions);

      const slaConfig = {
        urgent: 900000, // 15 min
        high: 1800000, // 30 min
        medium: 3600000, // 1 hour
        low: 14400000, // 4 hours
      };

      const compliance = await tracker.getSLACompliance('client_001', slaConfig);

      expect(compliance.urgent.total).toBe(2);
      expect(compliance.urgent.withinSLA).toBe(1);
      expect(compliance.urgent.complianceRate).toBe(0.5);

      expect(compliance.high.total).toBe(2);
      expect(compliance.high.withinSLA).toBe(1);
      expect(compliance.high.complianceRate).toBe(0.5);

      expect(compliance.medium.total).toBe(1);
      expect(compliance.medium.withinSLA).toBe(1);
      expect(compliance.medium.complianceRate).toBe(1);

      expect(compliance.low.total).toBe(1);
      expect(compliance.low.withinSLA).toBe(1);
      expect(compliance.low.complianceRate).toBe(1);

      expect(compliance.overall.complianceRate).toBeCloseTo(0.667, 2);
    });
  });

  describe('getResolutionTimeline', () => {
    it('should build resolution timeline with all events', async () => {
      const escalation = {
        id: 'esc_xyz789',
        createdAt: new Date('2025-01-16T10:00:00Z').toISOString(),
        triggers: [{ type: 'sentiment', detectedAt: new Date('2025-01-16T10:00:00Z').toISOString() }],
      };

      const handoff = {
        id: 'hnd_def456',
        createdAt: new Date('2025-01-16T10:05:00Z').toISOString(),
        assignedAt: new Date('2025-01-16T10:08:00Z').toISOString(),
        assignedTo: 'operator_123',
      };

      const resolution = {
        id: 'res_abc123',
        resolvedAt: new Date('2025-01-16T10:30:00Z').toISOString(),
        outcome: 'resolved',
        summary: 'Issue resolved',
      };

      mockRepository.getResolution.mockResolvedValue(resolution);

      const timeline = await tracker.getResolutionTimeline(
        escalation,
        handoff,
        resolution
      );

      expect(timeline.events).toHaveLength(4);
      expect(timeline.events[0].type).toBe('escalation_created');
      expect(timeline.events[1].type).toBe('handoff_initiated');
      expect(timeline.events[2].type).toBe('operator_assigned');
      expect(timeline.events[3].type).toBe('resolution_completed');

      expect(timeline.totalDurationMs).toBe(1800000); // 30 minutes
    });
  });

  describe('amendResolution', () => {
    it('should allow amending resolution within time window', async () => {
      const existingResolution = {
        id: 'res_abc123',
        escalationId: 'esc_xyz789',
        outcome: 'resolved',
        resolvedAt: new Date(Date.now() - 300000).toISOString(), // 5 min ago
        resolvedBy: 'operator_123',
      };

      mockRepository.getResolution.mockResolvedValue(existingResolution);

      const amendment = {
        outcome: 'partially_resolved' as const,
        internalNotes: 'Customer has follow-up question, marking as partial',
        amendedBy: 'operator_123',
        amendmentReason: 'Customer follow-up received',
      };

      const amended = await tracker.amendResolution('res_abc123', amendment);

      expect(amended.outcome).toBe('partially_resolved');
      expect(amended.amendments).toHaveLength(1);
      expect(amended.amendments[0].reason).toBe('Customer follow-up received');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'resolution.amended',
        expect.any(Object)
      );
    });

    it('should reject amendment after time window expires', async () => {
      const existingResolution = {
        id: 'res_abc123',
        outcome: 'resolved',
        resolvedAt: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
        resolvedBy: 'operator_123',
      };

      mockRepository.getResolution.mockResolvedValue(existingResolution);

      await expect(
        tracker.amendResolution('res_abc123', {
          outcome: 'unresolved',
          amendedBy: 'operator_123',
          amendmentReason: 'Late change',
        })
      ).rejects.toThrow('Amendment window has expired');
    });

    it('should allow supervisor override after window expires', async () => {
      const existingResolution = {
        id: 'res_abc123',
        outcome: 'resolved',
        resolvedAt: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
        resolvedBy: 'operator_123',
      };

      mockRepository.getResolution.mockResolvedValue(existingResolution);

      const amended = await tracker.amendResolution('res_abc123', {
        outcome: 'unresolved',
        amendedBy: 'supervisor_456',
        amendmentReason: 'Compliance review required outcome change',
        supervisorOverride: true,
      });

      expect(amended.outcome).toBe('unresolved');
      expect(amended.amendments[0].supervisorOverride).toBe(true);
    });
  });
});
```

#### 1.3 Create ResolutionRepository Test

**File:** `packages/engagement/escalation/src/__tests__/resolution-repository.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResolutionRepository } from '../resolution-repository';

describe('ResolutionRepository', () => {
  let repository: ResolutionRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn((fn) => fn(mockDb)),
    };

    repository = new ResolutionRepository({ db: mockDb });
  });

  describe('saveResolution', () => {
    it('should insert resolution record', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const resolution = {
        id: 'res_abc123',
        escalationId: 'esc_xyz789',
        handoffId: 'hnd_def456',
        clientId: 'client_001',
        outcome: 'resolved',
        method: 'direct_response',
        summary: 'Issue resolved',
        resolvedBy: 'operator_123',
        resolvedAt: new Date().toISOString(),
        timeToResolutionMs: 1200000,
      };

      await repository.saveResolution(resolution);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO escalation_resolutions'),
        expect.any(Array)
      );
    });
  });

  describe('getResolution', () => {
    it('should fetch resolution by ID', async () => {
      const mockResolution = {
        id: 'res_abc123',
        escalation_id: 'esc_xyz789',
        outcome: 'resolved',
      };

      mockDb.query.mockResolvedValue({ rows: [mockResolution] });

      const resolution = await repository.getResolution('res_abc123');

      expect(resolution).toBeDefined();
      expect(resolution?.id).toBe('res_abc123');
    });

    it('should return null if not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const resolution = await repository.getResolution('res_nonexistent');

      expect(resolution).toBeNull();
    });
  });

  describe('getResolutionsForClient', () => {
    it('should filter by date range', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getResolutionsForClient('client_001', {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('resolved_at >= $'),
        expect.arrayContaining(['client_001'])
      );
    });

    it('should filter by outcome', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getResolutionsForClient('client_001', {
        outcomes: ['resolved', 'partially_resolved'],
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('outcome = ANY'),
        expect.any(Array)
      );
    });

    it('should support pagination', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getResolutionsForClient('client_001', {
        limit: 20,
        offset: 40,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $'),
        expect.arrayContaining([20, 40])
      );
    });
  });

  describe('getResolutionsByOperator', () => {
    it('should fetch all resolutions for an operator', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getResolutionsByOperator('operator_123', {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('resolved_by = $'),
        expect.arrayContaining(['operator_123'])
      );
    });
  });

  describe('saveFeedback', () => {
    it('should insert feedback record', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const feedback = {
        id: 'fbk_abc123',
        resolutionId: 'res_xyz789',
        source: 'customer',
        satisfactionRating: 5,
        collectedAt: new Date().toISOString(),
        collectionMethod: 'follow_up_survey',
      };

      await repository.saveFeedback(feedback);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO resolution_feedback'),
        expect.any(Array)
      );
    });
  });

  describe('getFeedbackForResolution', () => {
    it('should fetch all feedback for a resolution', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'fbk_1', source: 'customer', satisfaction_rating: 5 },
          { id: 'fbk_2', source: 'operator', difficulty_rating: 3 },
        ],
      });

      const feedback = await repository.getFeedbackForResolution('res_abc123');

      expect(feedback).toHaveLength(2);
    });
  });

  describe('getAggregateStats', () => {
    it('should run aggregate query for statistics', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          total: 100,
          resolved: 75,
          avg_ttr: 1500000,
          median_ttr: 1200000,
        }],
      });

      const stats = await repository.getAggregateStats('client_001', {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      });

      expect(stats.total).toBe(100);
      expect(stats.resolved).toBe(75);
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Implement Resolution Types

**File:** `packages/engagement/escalation/src/resolution-types.ts`

```typescript
import { z } from 'zod';

/**
 * Resolution outcome types
 */
export const ResolutionOutcomeSchema = z.enum([
  'resolved',           // Issue fully addressed
  'partially_resolved', // Some aspects addressed, follow-up needed
  'unresolved',         // Could not resolve (customer unresponsive, etc.)
  'duplicate',          // Duplicate of another escalation
  'invalid',            // Not a valid escalation (spam, mistake)
  'no_action_needed',   // Review determined no action required
]);

export type ResolutionOutcome = z.infer<typeof ResolutionOutcomeSchema>;

/**
 * Resolution method (how it was resolved)
 */
export const ResolutionMethodSchema = z.enum([
  'direct_response',    // Public response on platform
  'dm_conversation',    // Private message exchange
  'phone_call',         // Phone call with customer
  'email',              // Email exchange
  'internal_only',      // Internal resolution (no customer contact)
  'platform_action',    // Platform-level action (refund, etc.)
  'escalated_further',  // Escalated to higher tier/external
]);

export type ResolutionMethod = z.infer<typeof ResolutionMethodSchema>;

/**
 * Satisfaction rating (1-5 stars)
 */
export const SatisfactionRatingSchema = z.number().int().min(1).max(5);
export type SatisfactionRating = z.infer<typeof SatisfactionRatingSchema>;

/**
 * Resolution amendment record
 */
export const ResolutionAmendmentSchema = z.object({
  amendedAt: z.string().datetime(),
  amendedBy: z.string(),
  previousOutcome: ResolutionOutcomeSchema,
  newOutcome: ResolutionOutcomeSchema,
  reason: z.string(),
  supervisorOverride: z.boolean().optional(),
});

export type ResolutionAmendment = z.infer<typeof ResolutionAmendmentSchema>;

/**
 * Complete resolution record
 */
export const ResolutionSchema = z.object({
  id: z.string().startsWith('res_'),
  escalationId: z.string().startsWith('esc_'),
  handoffId: z.string().startsWith('hnd_').optional(),
  clientId: z.string(),

  // Resolution details
  outcome: ResolutionOutcomeSchema,
  method: ResolutionMethodSchema.optional(),
  summary: z.string().optional(),
  internalNotes: z.string().optional(),
  actionsTaken: z.array(z.string()).optional(),

  // Resolution metadata
  resolvedBy: z.string(), // operator ID or 'system'
  resolvedAt: z.string().datetime(),
  createdAt: z.string().datetime().optional(),

  // Timing
  timeToResolutionMs: z.number().int().positive(),

  // Amendments
  amendments: z.array(ResolutionAmendmentSchema).optional(),

  // Linked data
  linkedThreadIds: z.array(z.string()).optional(),
  linkedTicketId: z.string().optional(),

  // Classification
  rootCause: z.string().optional(),
  preventionSuggestion: z.string().optional(),
});

export type Resolution = z.infer<typeof ResolutionSchema>;

/**
 * Feedback source
 */
export const FeedbackSourceSchema = z.enum([
  'customer',   // Feedback from the customer
  'operator',   // Operator self-assessment
  'supervisor', // Supervisor review
  'automated',  // Automated quality scoring
]);

export type FeedbackSource = z.infer<typeof FeedbackSourceSchema>;

/**
 * Feedback collection method
 */
export const FeedbackCollectionMethodSchema = z.enum([
  'follow_up_survey',   // Survey sent after resolution
  'inline_prompt',      // Prompt within conversation
  'post_resolution',    // Immediate post-resolution capture
  'periodic_review',    // Batch review process
  'quality_audit',      // Manual quality audit
]);

export type FeedbackCollectionMethod = z.infer<typeof FeedbackCollectionMethodSchema>;

/**
 * Resolution feedback record
 */
export const ResolutionFeedbackSchema = z.object({
  id: z.string().startsWith('fbk_'),
  resolutionId: z.string().startsWith('res_'),

  // Source
  source: FeedbackSourceSchema,
  collectedAt: z.string().datetime(),
  collectionMethod: FeedbackCollectionMethodSchema,

  // Customer feedback fields
  satisfactionRating: SatisfactionRatingSchema.optional(),
  wouldRecommend: z.boolean().optional(),
  feedbackText: z.string().optional(),

  // Operator self-assessment fields
  difficultyRating: z.number().int().min(1).max(5).optional(),
  timeAdequate: z.boolean().optional(),
  toolsAdequate: z.boolean().optional(),
  suggestedImprovements: z.string().optional(),

  // Supervisor/automated review fields
  qualityScore: z.number().min(0).max(100).optional(),
  complianceIssues: z.array(z.string()).optional(),
  reviewNotes: z.string().optional(),
});

export type ResolutionFeedback = z.infer<typeof ResolutionFeedbackSchema>;

/**
 * Resolution input (for creating new resolution)
 */
export const ResolutionInputSchema = z.object({
  outcome: ResolutionOutcomeSchema,
  method: ResolutionMethodSchema.optional(),
  summary: z.string().optional(),
  internalNotes: z.string().optional(),
  actionsTaken: z.array(z.string()).optional(),
  rootCause: z.string().optional(),
  preventionSuggestion: z.string().optional(),
});

export type ResolutionInput = z.infer<typeof ResolutionInputSchema>;

/**
 * Amendment input
 */
export const AmendmentInputSchema = z.object({
  outcome: ResolutionOutcomeSchema.optional(),
  internalNotes: z.string().optional(),
  amendedBy: z.string(),
  amendmentReason: z.string(),
  supervisorOverride: z.boolean().optional(),
});

export type AmendmentInput = z.infer<typeof AmendmentInputSchema>;

/**
 * Feedback input
 */
export const FeedbackInputSchema = z.object({
  source: FeedbackSourceSchema,
  collectionMethod: FeedbackCollectionMethodSchema,
  satisfactionRating: SatisfactionRatingSchema.optional(),
  wouldRecommend: z.boolean().optional(),
  feedbackText: z.string().optional(),
  difficultyRating: z.number().int().min(1).max(5).optional(),
  timeAdequate: z.boolean().optional(),
  toolsAdequate: z.boolean().optional(),
  suggestedImprovements: z.string().optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  complianceIssues: z.array(z.string()).optional(),
  reviewNotes: z.string().optional(),
});

export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;

/**
 * Validation helpers
 */
export function validateResolution(data: unknown): data is Resolution {
  return ResolutionSchema.safeParse(data).success;
}

export function validateFeedback(data: unknown): data is ResolutionFeedback {
  return ResolutionFeedbackSchema.safeParse(data).success;
}
```

#### 2.2 Implement ResolutionTracker

**File:** `packages/engagement/escalation/src/resolution-tracker.ts`

```typescript
import { nanoid } from 'nanoid';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  Resolution,
  ResolutionFeedback,
  ResolutionInput,
  AmendmentInput,
  FeedbackInput,
  ResolutionSchema,
  ResolutionFeedbackSchema,
  ResolutionAmendment,
} from './resolution-types';
import { Escalation } from './escalation-types';
import { Handoff } from './handoff-types';

const tracer = trace.getTracer('resolution-tracker');

export interface ResolutionTrackerConfig {
  repository: ResolutionRepository;
  eventEmitter: EventEmitter;
  telemetry: ResolutionTelemetry;
  amendmentWindowMs?: number; // Default: 4 hours
}

export interface ResolutionRepository {
  saveResolution(resolution: Resolution): Promise<void>;
  getResolution(id: string): Promise<Resolution | null>;
  updateResolution(id: string, updates: Partial<Resolution>): Promise<void>;
  saveFeedback(feedback: ResolutionFeedback): Promise<void>;
  getFeedbackForResolution(resolutionId: string): Promise<ResolutionFeedback[]>;
  getResolutionsForClient(clientId: string, filters: ResolutionFilters): Promise<Resolution[]>;
  getResolutionsByOperator(operatorId: string, filters: ResolutionFilters): Promise<Resolution[]>;
  getAggregateStats(clientId: string, filters: ResolutionFilters): Promise<AggregateStats>;
}

export interface ResolutionFilters {
  startDate?: Date;
  endDate?: Date;
  outcomes?: string[];
  operators?: string[];
  limit?: number;
  offset?: number;
}

export interface AggregateStats {
  total: number;
  resolved: number;
  avg_ttr: number;
  median_ttr: number;
}

export interface EventEmitter {
  emit(event: string, data: unknown): void;
}

export interface ResolutionTelemetry {
  recordResolution(resolution: Resolution): void;
  recordFeedback(feedback: ResolutionFeedback): void;
}

export interface ResolutionStats {
  totalResolutions: number;
  resolvedCount: number;
  unresolvedCount: number;
  partiallyResolvedCount: number;
  resolutionRate: number;
  averageTimeToResolutionMs: number;
  medianTimeToResolutionMs: number;
  averageSatisfaction: number;
}

export interface OperatorStats extends ResolutionStats {
  operatorId: string;
}

export interface SLAComplianceEntry {
  total: number;
  withinSLA: number;
  complianceRate: number;
}

export interface SLACompliance {
  urgent: SLAComplianceEntry;
  high: SLAComplianceEntry;
  medium: SLAComplianceEntry;
  low: SLAComplianceEntry;
  overall: SLAComplianceEntry;
}

export interface TimelineEvent {
  type: string;
  timestamp: string;
  actor?: string;
  details?: Record<string, unknown>;
}

export interface ResolutionTimeline {
  events: TimelineEvent[];
  totalDurationMs: number;
}

export class ResolutionTracker {
  private repository: ResolutionRepository;
  private eventEmitter: EventEmitter;
  private telemetry: ResolutionTelemetry;
  private amendmentWindowMs: number;

  constructor(config: ResolutionTrackerConfig) {
    this.repository = config.repository;
    this.eventEmitter = config.eventEmitter;
    this.telemetry = config.telemetry;
    this.amendmentWindowMs = config.amendmentWindowMs ?? 4 * 60 * 60 * 1000; // 4 hours
  }

  /**
   * Record a resolution for an escalation
   */
  async recordResolution(
    escalation: Partial<Escalation>,
    handoff: Partial<Handoff> | null,
    input: ResolutionInput
  ): Promise<Resolution> {
    return tracer.startActiveSpan('recordResolution', async (span) => {
      try {
        const now = new Date();
        const escalationCreatedAt = new Date(escalation.createdAt!);
        const timeToResolutionMs = now.getTime() - escalationCreatedAt.getTime();

        const resolution: Resolution = {
          id: `res_${nanoid(12)}`,
          escalationId: escalation.id!,
          handoffId: handoff?.id,
          clientId: escalation.clientId!,
          outcome: input.outcome,
          method: input.method,
          summary: input.summary,
          internalNotes: input.internalNotes,
          actionsTaken: input.actionsTaken,
          rootCause: input.rootCause,
          preventionSuggestion: input.preventionSuggestion,
          resolvedBy: handoff?.assignedTo ?? 'system',
          resolvedAt: now.toISOString(),
          createdAt: now.toISOString(),
          timeToResolutionMs,
        };

        // Validate resolution
        ResolutionSchema.parse(resolution);

        // Save to repository
        await this.repository.saveResolution(resolution);

        // Emit appropriate event based on outcome
        const eventName = input.outcome === 'resolved'
          ? 'escalation.resolved'
          : input.outcome === 'unresolved'
            ? 'escalation.unresolved'
            : 'escalation.closed';

        this.eventEmitter.emit(eventName, {
          resolution,
          escalation,
          handoff,
        });

        // Record telemetry
        this.telemetry.recordResolution(resolution);

        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('resolution.id', resolution.id);
        span.setAttribute('resolution.outcome', resolution.outcome);
        span.setAttribute('resolution.ttr_ms', timeToResolutionMs);

        return resolution;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Record feedback for a resolution
   */
  async recordFeedback(
    resolutionId: string,
    input: FeedbackInput
  ): Promise<ResolutionFeedback> {
    return tracer.startActiveSpan('recordFeedback', async (span) => {
      try {
        // Verify resolution exists
        const resolution = await this.repository.getResolution(resolutionId);
        if (!resolution) {
          throw new Error('Resolution not found');
        }

        const feedback: ResolutionFeedback = {
          id: `fbk_${nanoid(12)}`,
          resolutionId,
          source: input.source,
          collectedAt: new Date().toISOString(),
          collectionMethod: input.collectionMethod,
          satisfactionRating: input.satisfactionRating,
          wouldRecommend: input.wouldRecommend,
          feedbackText: input.feedbackText,
          difficultyRating: input.difficultyRating,
          timeAdequate: input.timeAdequate,
          toolsAdequate: input.toolsAdequate,
          suggestedImprovements: input.suggestedImprovements,
          qualityScore: input.qualityScore,
          complianceIssues: input.complianceIssues,
          reviewNotes: input.reviewNotes,
        };

        // Validate feedback
        ResolutionFeedbackSchema.parse(feedback);

        // Save to repository
        await this.repository.saveFeedback(feedback);

        // Record telemetry
        this.telemetry.recordFeedback(feedback);

        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('feedback.id', feedback.id);
        span.setAttribute('feedback.source', feedback.source);

        return feedback;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get resolution statistics for a client
   */
  async getResolutionStats(
    clientId: string,
    filters: { startDate: Date; endDate: Date }
  ): Promise<ResolutionStats> {
    return tracer.startActiveSpan('getResolutionStats', async (span) => {
      try {
        const resolutions = await this.repository.getResolutionsForClient(
          clientId,
          filters
        );

        if (resolutions.length === 0) {
          return {
            totalResolutions: 0,
            resolvedCount: 0,
            unresolvedCount: 0,
            partiallyResolvedCount: 0,
            resolutionRate: 0,
            averageTimeToResolutionMs: 0,
            medianTimeToResolutionMs: 0,
            averageSatisfaction: 0,
          };
        }

        const resolvedCount = resolutions.filter(r => r.outcome === 'resolved').length;
        const unresolvedCount = resolutions.filter(r => r.outcome === 'unresolved').length;
        const partiallyResolvedCount = resolutions.filter(r => r.outcome === 'partially_resolved').length;

        // Calculate average TTR
        const ttrs = resolutions.map(r => r.timeToResolutionMs);
        const avgTTR = ttrs.reduce((a, b) => a + b, 0) / ttrs.length;
        const sortedTTRs = [...ttrs].sort((a, b) => a - b);
        const medianTTR = sortedTTRs[Math.floor(sortedTTRs.length / 2)];

        // Calculate average satisfaction
        let totalSatisfaction = 0;
        let satisfactionCount = 0;

        for (const resolution of resolutions) {
          const feedback = await this.repository.getFeedbackForResolution(resolution.id);
          for (const fb of feedback) {
            if (fb.satisfactionRating !== undefined) {
              totalSatisfaction += fb.satisfactionRating;
              satisfactionCount++;
            }
          }
        }

        const avgSatisfaction = satisfactionCount > 0
          ? totalSatisfaction / satisfactionCount
          : 0;

        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('stats.total', resolutions.length);

        return {
          totalResolutions: resolutions.length,
          resolvedCount,
          unresolvedCount,
          partiallyResolvedCount,
          resolutionRate: resolvedCount / resolutions.length,
          averageTimeToResolutionMs: avgTTR,
          medianTimeToResolutionMs: medianTTR,
          averageSatisfaction: avgSatisfaction,
        };
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get operator-specific statistics
   */
  async getOperatorStats(
    operatorId: string,
    filters: { startDate: Date; endDate: Date }
  ): Promise<OperatorStats> {
    const resolutions = await this.repository.getResolutionsByOperator(
      operatorId,
      filters
    );

    if (resolutions.length === 0) {
      return {
        operatorId,
        totalResolutions: 0,
        resolvedCount: 0,
        unresolvedCount: 0,
        partiallyResolvedCount: 0,
        resolutionRate: 0,
        averageTimeToResolutionMs: 0,
        medianTimeToResolutionMs: 0,
        averageSatisfaction: 0,
      };
    }

    const resolvedCount = resolutions.filter(r => r.outcome === 'resolved').length;
    const unresolvedCount = resolutions.filter(r => r.outcome === 'unresolved').length;
    const partiallyResolvedCount = resolutions.filter(r => r.outcome === 'partially_resolved').length;

    const ttrs = resolutions.map(r => r.timeToResolutionMs);
    const avgTTR = ttrs.reduce((a, b) => a + b, 0) / ttrs.length;

    return {
      operatorId,
      totalResolutions: resolutions.length,
      resolvedCount,
      unresolvedCount,
      partiallyResolvedCount,
      resolutionRate: resolvedCount / resolutions.length,
      averageTimeToResolutionMs: avgTTR,
      medianTimeToResolutionMs: 0, // Simplified for operator stats
      averageSatisfaction: 0, // Would need to aggregate feedback
    };
  }

  /**
   * Calculate SLA compliance
   */
  async getSLACompliance(
    clientId: string,
    slaConfig: Record<string, number>
  ): Promise<SLACompliance> {
    const resolutions = await this.repository.getResolutionsForClient(clientId, {});

    const byPriority: Record<string, { total: number; withinSLA: number }> = {
      urgent: { total: 0, withinSLA: 0 },
      high: { total: 0, withinSLA: 0 },
      medium: { total: 0, withinSLA: 0 },
      low: { total: 0, withinSLA: 0 },
    };

    for (const resolution of resolutions) {
      const priority = (resolution as any).priority || 'medium';
      if (byPriority[priority]) {
        byPriority[priority].total++;
        if (resolution.timeToResolutionMs <= slaConfig[priority]) {
          byPriority[priority].withinSLA++;
        }
      }
    }

    const calcRate = (entry: { total: number; withinSLA: number }) =>
      entry.total > 0 ? entry.withinSLA / entry.total : 1;

    const overallTotal = Object.values(byPriority).reduce((a, b) => a + b.total, 0);
    const overallWithinSLA = Object.values(byPriority).reduce((a, b) => a + b.withinSLA, 0);

    return {
      urgent: { ...byPriority.urgent, complianceRate: calcRate(byPriority.urgent) },
      high: { ...byPriority.high, complianceRate: calcRate(byPriority.high) },
      medium: { ...byPriority.medium, complianceRate: calcRate(byPriority.medium) },
      low: { ...byPriority.low, complianceRate: calcRate(byPriority.low) },
      overall: {
        total: overallTotal,
        withinSLA: overallWithinSLA,
        complianceRate: overallTotal > 0 ? overallWithinSLA / overallTotal : 1,
      },
    };
  }

  /**
   * Build resolution timeline
   */
  async getResolutionTimeline(
    escalation: any,
    handoff: any | null,
    resolution: Resolution
  ): Promise<ResolutionTimeline> {
    const events: TimelineEvent[] = [];

    // Escalation created
    events.push({
      type: 'escalation_created',
      timestamp: escalation.createdAt,
      details: { triggers: escalation.triggers },
    });

    // Handoff events
    if (handoff) {
      if (handoff.createdAt) {
        events.push({
          type: 'handoff_initiated',
          timestamp: handoff.createdAt,
        });
      }
      if (handoff.assignedAt) {
        events.push({
          type: 'operator_assigned',
          timestamp: handoff.assignedAt,
          actor: handoff.assignedTo,
        });
      }
    }

    // Resolution
    events.push({
      type: 'resolution_completed',
      timestamp: resolution.resolvedAt,
      actor: resolution.resolvedBy,
      details: { outcome: resolution.outcome },
    });

    // Sort by timestamp
    events.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const totalDurationMs =
      new Date(resolution.resolvedAt).getTime() -
      new Date(escalation.createdAt).getTime();

    return { events, totalDurationMs };
  }

  /**
   * Amend a resolution
   */
  async amendResolution(
    resolutionId: string,
    input: AmendmentInput
  ): Promise<Resolution> {
    return tracer.startActiveSpan('amendResolution', async (span) => {
      try {
        const resolution = await this.repository.getResolution(resolutionId);
        if (!resolution) {
          throw new Error('Resolution not found');
        }

        const resolvedAt = new Date(resolution.resolvedAt);
        const now = new Date();
        const timeSinceResolution = now.getTime() - resolvedAt.getTime();

        // Check if within amendment window (unless supervisor override)
        if (timeSinceResolution > this.amendmentWindowMs && !input.supervisorOverride) {
          throw new Error('Amendment window has expired');
        }

        // Create amendment record
        const amendment: ResolutionAmendment = {
          amendedAt: now.toISOString(),
          amendedBy: input.amendedBy,
          previousOutcome: resolution.outcome,
          newOutcome: input.outcome ?? resolution.outcome,
          reason: input.amendmentReason,
          supervisorOverride: input.supervisorOverride,
        };

        // Update resolution
        const updates: Partial<Resolution> = {
          amendments: [...(resolution.amendments || []), amendment],
        };

        if (input.outcome) {
          updates.outcome = input.outcome;
        }
        if (input.internalNotes) {
          updates.internalNotes = input.internalNotes;
        }

        await this.repository.updateResolution(resolutionId, updates);

        const amended = { ...resolution, ...updates };

        this.eventEmitter.emit('resolution.amended', {
          resolution: amended,
          amendment,
        });

        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('resolution.id', resolutionId);
        span.setAttribute('amendment.supervisor_override', input.supervisorOverride ?? false);

        return amended;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

#### 2.3 Implement ResolutionRepository

**File:** `packages/engagement/escalation/src/resolution-repository.ts`

```typescript
import { Resolution, ResolutionFeedback } from './resolution-types';
import { ResolutionFilters, AggregateStats } from './resolution-tracker';

export interface DatabaseClient {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[]; rowCount: number }>;
  transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T>;
}

export interface ResolutionRepositoryConfig {
  db: DatabaseClient;
}

export class ResolutionRepository {
  private db: DatabaseClient;

  constructor(config: ResolutionRepositoryConfig) {
    this.db = config.db;
  }

  /**
   * Save a resolution
   */
  async saveResolution(resolution: Resolution): Promise<void> {
    const sql = `
      INSERT INTO escalation_resolutions (
        id, escalation_id, handoff_id, client_id,
        outcome, method, summary, internal_notes, actions_taken,
        resolved_by, resolved_at, created_at,
        time_to_resolution_ms, root_cause, prevention_suggestion,
        linked_thread_ids, linked_ticket_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17
      )
    `;

    await this.db.query(sql, [
      resolution.id,
      resolution.escalationId,
      resolution.handoffId || null,
      resolution.clientId,
      resolution.outcome,
      resolution.method || null,
      resolution.summary || null,
      resolution.internalNotes || null,
      JSON.stringify(resolution.actionsTaken || []),
      resolution.resolvedBy,
      resolution.resolvedAt,
      resolution.createdAt || new Date().toISOString(),
      resolution.timeToResolutionMs,
      resolution.rootCause || null,
      resolution.preventionSuggestion || null,
      JSON.stringify(resolution.linkedThreadIds || []),
      resolution.linkedTicketId || null,
    ]);
  }

  /**
   * Get a resolution by ID
   */
  async getResolution(id: string): Promise<Resolution | null> {
    const sql = `
      SELECT * FROM escalation_resolutions WHERE id = $1
    `;

    const result = await this.db.query(sql, [id]);
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToResolution(result.rows[0]);
  }

  /**
   * Update a resolution
   */
  async updateResolution(id: string, updates: Partial<Resolution>): Promise<void> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.outcome !== undefined) {
      setClauses.push(`outcome = $${paramIndex++}`);
      params.push(updates.outcome);
    }
    if (updates.internalNotes !== undefined) {
      setClauses.push(`internal_notes = $${paramIndex++}`);
      params.push(updates.internalNotes);
    }
    if (updates.amendments !== undefined) {
      setClauses.push(`amendments = $${paramIndex++}`);
      params.push(JSON.stringify(updates.amendments));
    }

    if (setClauses.length === 0) {
      return;
    }

    setClauses.push(`updated_at = $${paramIndex++}`);
    params.push(new Date().toISOString());

    params.push(id);

    const sql = `
      UPDATE escalation_resolutions
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await this.db.query(sql, params);
  }

  /**
   * Save feedback
   */
  async saveFeedback(feedback: ResolutionFeedback): Promise<void> {
    const sql = `
      INSERT INTO resolution_feedback (
        id, resolution_id, source, collected_at, collection_method,
        satisfaction_rating, would_recommend, feedback_text,
        difficulty_rating, time_adequate, tools_adequate, suggested_improvements,
        quality_score, compliance_issues, review_notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
    `;

    await this.db.query(sql, [
      feedback.id,
      feedback.resolutionId,
      feedback.source,
      feedback.collectedAt,
      feedback.collectionMethod,
      feedback.satisfactionRating ?? null,
      feedback.wouldRecommend ?? null,
      feedback.feedbackText ?? null,
      feedback.difficultyRating ?? null,
      feedback.timeAdequate ?? null,
      feedback.toolsAdequate ?? null,
      feedback.suggestedImprovements ?? null,
      feedback.qualityScore ?? null,
      JSON.stringify(feedback.complianceIssues || []),
      feedback.reviewNotes ?? null,
    ]);
  }

  /**
   * Get feedback for a resolution
   */
  async getFeedbackForResolution(resolutionId: string): Promise<ResolutionFeedback[]> {
    const sql = `
      SELECT * FROM resolution_feedback WHERE resolution_id = $1
    `;

    const result = await this.db.query(sql, [resolutionId]);
    return result.rows.map(row => this.mapRowToFeedback(row));
  }

  /**
   * Get resolutions for a client with filters
   */
  async getResolutionsForClient(
    clientId: string,
    filters: ResolutionFilters
  ): Promise<Resolution[]> {
    const conditions: string[] = ['client_id = $1'];
    const params: unknown[] = [clientId];
    let paramIndex = 2;

    if (filters.startDate) {
      conditions.push(`resolved_at >= $${paramIndex++}`);
      params.push(filters.startDate.toISOString());
    }
    if (filters.endDate) {
      conditions.push(`resolved_at <= $${paramIndex++}`);
      params.push(filters.endDate.toISOString());
    }
    if (filters.outcomes && filters.outcomes.length > 0) {
      conditions.push(`outcome = ANY($${paramIndex++})`);
      params.push(filters.outcomes);
    }
    if (filters.operators && filters.operators.length > 0) {
      conditions.push(`resolved_by = ANY($${paramIndex++})`);
      params.push(filters.operators);
    }

    let sql = `
      SELECT * FROM escalation_resolutions
      WHERE ${conditions.join(' AND ')}
      ORDER BY resolved_at DESC
    `;

    if (filters.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }
    if (filters.offset) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }

    const result = await this.db.query(sql, params);
    return result.rows.map(row => this.mapRowToResolution(row));
  }

  /**
   * Get resolutions by operator
   */
  async getResolutionsByOperator(
    operatorId: string,
    filters: ResolutionFilters
  ): Promise<Resolution[]> {
    const conditions: string[] = ['resolved_by = $1'];
    const params: unknown[] = [operatorId];
    let paramIndex = 2;

    if (filters.startDate) {
      conditions.push(`resolved_at >= $${paramIndex++}`);
      params.push(filters.startDate.toISOString());
    }
    if (filters.endDate) {
      conditions.push(`resolved_at <= $${paramIndex++}`);
      params.push(filters.endDate.toISOString());
    }

    const sql = `
      SELECT * FROM escalation_resolutions
      WHERE ${conditions.join(' AND ')}
      ORDER BY resolved_at DESC
    `;

    const result = await this.db.query(sql, params);
    return result.rows.map(row => this.mapRowToResolution(row));
  }

  /**
   * Get aggregate statistics
   */
  async getAggregateStats(
    clientId: string,
    filters: ResolutionFilters
  ): Promise<AggregateStats> {
    const conditions: string[] = ['client_id = $1'];
    const params: unknown[] = [clientId];
    let paramIndex = 2;

    if (filters.startDate) {
      conditions.push(`resolved_at >= $${paramIndex++}`);
      params.push(filters.startDate.toISOString());
    }
    if (filters.endDate) {
      conditions.push(`resolved_at <= $${paramIndex++}`);
      params.push(filters.endDate.toISOString());
    }

    const sql = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE outcome = 'resolved') as resolved,
        AVG(time_to_resolution_ms) as avg_ttr,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_to_resolution_ms) as median_ttr
      FROM escalation_resolutions
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await this.db.query(sql, params);
    const row = result.rows[0] as any;

    return {
      total: parseInt(row.total) || 0,
      resolved: parseInt(row.resolved) || 0,
      avg_ttr: parseFloat(row.avg_ttr) || 0,
      median_ttr: parseFloat(row.median_ttr) || 0,
    };
  }

  private mapRowToResolution(row: any): Resolution {
    return {
      id: row.id,
      escalationId: row.escalation_id,
      handoffId: row.handoff_id || undefined,
      clientId: row.client_id,
      outcome: row.outcome,
      method: row.method || undefined,
      summary: row.summary || undefined,
      internalNotes: row.internal_notes || undefined,
      actionsTaken: JSON.parse(row.actions_taken || '[]'),
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      timeToResolutionMs: parseInt(row.time_to_resolution_ms),
      amendments: JSON.parse(row.amendments || '[]'),
      rootCause: row.root_cause || undefined,
      preventionSuggestion: row.prevention_suggestion || undefined,
      linkedThreadIds: JSON.parse(row.linked_thread_ids || '[]'),
      linkedTicketId: row.linked_ticket_id || undefined,
    };
  }

  private mapRowToFeedback(row: any): ResolutionFeedback {
    return {
      id: row.id,
      resolutionId: row.resolution_id,
      source: row.source,
      collectedAt: row.collected_at,
      collectionMethod: row.collection_method,
      satisfactionRating: row.satisfaction_rating || undefined,
      wouldRecommend: row.would_recommend ?? undefined,
      feedbackText: row.feedback_text || undefined,
      difficultyRating: row.difficulty_rating || undefined,
      timeAdequate: row.time_adequate ?? undefined,
      toolsAdequate: row.tools_adequate ?? undefined,
      suggestedImprovements: row.suggested_improvements || undefined,
      qualityScore: row.quality_score || undefined,
      complianceIssues: JSON.parse(row.compliance_issues || '[]'),
      reviewNotes: row.review_notes || undefined,
    };
  }
}
```

### Phase 3: Verification

```bash
# Run tests
cd packages/engagement/escalation
pnpm test src/__tests__/resolution-types.test.ts
pnpm test src/__tests__/resolution-tracker.test.ts
pnpm test src/__tests__/resolution-repository.test.ts

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/engagement/escalation/src/resolution-types.ts` | Resolution and feedback type definitions |
| Create | `packages/engagement/escalation/src/resolution-tracker.ts` | ResolutionTracker class |
| Create | `packages/engagement/escalation/src/resolution-repository.ts` | Database persistence layer |
| Create | `packages/engagement/escalation/src/__tests__/resolution-types.test.ts` | Type validation tests |
| Create | `packages/engagement/escalation/src/__tests__/resolution-tracker.test.ts` | ResolutionTracker tests |
| Create | `packages/engagement/escalation/src/__tests__/resolution-repository.test.ts` | Repository tests |
| Modify | `packages/engagement/escalation/src/index.ts` | Export resolution components |

---

## Acceptance Criteria

- [ ] Resolution records capture outcome, method, TTR, and operator
- [ ] Feedback collection supports customer satisfaction and operator self-assessment
- [ ] SLA compliance calculation compares TTR against priority targets
- [ ] Amendment system allows changes within time window (supervisor override available)
- [ ] Timeline builder reconstructs full escalation lifecycle
- [ ] All tests pass with >80% coverage
- [ ] OpenTelemetry spans capture resolution recording
- [ ] Events emitted for resolution and amendment actions

---

## Test Requirements

### Unit Tests
- Resolution schema validation for all outcome types
- Feedback schema validation for customer and operator sources
- TTR calculation from escalation creation timestamp
- SLA compliance rate computation
- Amendment window enforcement

### Integration Tests
- End-to-end resolution recording flow
- Feedback association with resolutions
- Statistics aggregation queries
- Amendment persistence

---

## Security & Safety Checklist

- [ ] No PII logged in resolution summaries
- [ ] Feedback text sanitized before storage
- [ ] Tenant isolation: all queries include client_id
- [ ] Amendment audit trail preserved
- [ ] Supervisor override requires elevated permissions

---

## JSON Task Block

```json
{
  "task_id": "S4-D4",
  "name": "Resolution Tracking",
  "description": "ResolutionTracker for recording outcomes, feedback, and SLA compliance",
  "status": "pending",
  "dependencies": ["S4-D1", "S4-D2", "S4-D3"],
  "blocks": ["S4-D5"],
  "agent": "D",
  "sprint": 4,
  "complexity": "medium",
  "estimated_files": 6,
  "test_coverage_target": 80,
  "package": "@rtv/engagement/escalation",
  "exports": [
    "ResolutionTracker",
    "ResolutionRepository",
    "Resolution",
    "ResolutionFeedback",
    "ResolutionOutcome",
    "ResolutionMethod"
  ]
}
```

---

## External Memory Section

```yaml
episode_id: null
started_at: null
completed_at: null

references_read:
  - docs/01-architecture/system-architecture-v3.md
  - docs/05-policy-safety/compliance-safety-policy.md
  - docs/06-reliability-ops/slo-error-budget.md

writes_made: []

decisions:
  - decision: "Support resolution amendments within 4-hour window"
    rationale: "Allows correction without supervisor overhead for recent mistakes"
  - decision: "Separate feedback sources (customer, operator, supervisor)"
    rationale: "Different perspectives provide richer quality signals"
  - decision: "Calculate SLA compliance per-priority"
    rationale: "Matches SLA targets defined in S4-D2"

blockers: []
questions: []
```
