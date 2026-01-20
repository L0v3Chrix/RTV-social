# Build Prompt: S2-A2 — Plan Node Types

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-A2 |
| Sprint | 2 |
| Agent | A (Plan Graph System) |
| Complexity | Medium |
| Status | pending |
| Estimated Tokens | 4,500 |
| Depends On | S2-A1 |
| Blocks | S2-A3 |

---

## Context

### What We're Building

Specialized node type definitions for the plan graph: Content nodes (individual posts), Campaign nodes (grouped content), Series nodes (recurring patterns), and Milestone nodes (approval gates). Each type has specific validation rules and behaviors.

### Why It Matters

Different content planning scenarios need different structures:
- Single posts need platform/blueprint specs
- Campaigns group related content for coordinated launches
- Series define recurring patterns (weekly tips, daily quotes)
- Milestones create approval checkpoints

### Spec References

- Architecture: `/docs/01-architecture/system-architecture-v3.md` (Content Planning)
- External Memory: `/docs/02-schemas/external-memory-schema.md`
- Engineering: `/docs/07-engineering-process/engineering-handbook.md`

---

## Prerequisites

### Completed Tasks
- [x] S2-A1: PlanGraph model

### Required Packages
```bash
pnpm add zod date-fns
pnpm add -D vitest
```

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/planner/src/nodes/node-types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  ContentNode,
  CampaignNode,
  SeriesNode,
  MilestoneNode,
  createContentNode,
  createCampaignNode,
  createSeriesNode,
  createMilestoneNode,
  validateContentNode,
  validateCampaignNode,
  expandSeries,
} from './node-types';

describe('ContentNode', () => {
  describe('createContentNode', () => {
    it('should create a content node with required fields', () => {
      const node = createContentNode({
        title: 'Instagram Reel',
        blueprintId: 'bp_hook_value_cta',
        platform: 'instagram',
      });

      expect(node.type).toBe('content');
      expect(node.title).toBe('Instagram Reel');
      expect(node.blueprintId).toBe('bp_hook_value_cta');
      expect(node.platform).toBe('instagram');
    });

    it('should include optional fields when provided', () => {
      const node = createContentNode({
        title: 'Scheduled Post',
        blueprintId: 'bp_carousel',
        platform: 'instagram',
        scheduledAt: new Date('2025-02-15T10:00:00Z'),
        caption: 'Check out these tips!',
        hashtags: ['#tips', '#howto'],
        offerId: 'offer_123',
      });

      expect(node.scheduledAt).toEqual(new Date('2025-02-15T10:00:00Z'));
      expect(node.caption).toBe('Check out these tips!');
      expect(node.hashtags).toContain('#tips');
      expect(node.offerId).toBe('offer_123');
    });

    it('should default status to pending', () => {
      const node = createContentNode({
        title: 'Test',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      expect(node.status).toBe('pending');
    });
  });

  describe('validateContentNode', () => {
    it('should pass for valid content node', () => {
      const node = createContentNode({
        title: 'Valid',
        blueprintId: 'bp_test',
        platform: 'instagram',
      });

      expect(() => validateContentNode(node)).not.toThrow();
    });

    it('should fail without blueprintId', () => {
      const node = { type: 'content', title: 'Test', platform: 'instagram' };

      expect(() => validateContentNode(node as any)).toThrow('blueprintId required');
    });

    it('should fail without platform', () => {
      const node = { type: 'content', title: 'Test', blueprintId: 'bp_test' };

      expect(() => validateContentNode(node as any)).toThrow('platform required');
    });

    it('should validate platform-specific constraints', () => {
      const node = createContentNode({
        title: 'TikTok Video',
        blueprintId: 'bp_reel',
        platform: 'tiktok',
        caption: 'A'.repeat(5000), // TikTok limit is 4000
      });

      expect(() => validateContentNode(node)).toThrow('caption exceeds platform limit');
    });
  });
});

describe('CampaignNode', () => {
  describe('createCampaignNode', () => {
    it('should create a campaign node', () => {
      const node = createCampaignNode({
        title: 'Product Launch',
        description: 'New product launch campaign',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-02-28'),
      });

      expect(node.type).toBe('campaign');
      expect(node.title).toBe('Product Launch');
      expect(node.startDate).toEqual(new Date('2025-02-01'));
    });

    it('should include campaign-specific metadata', () => {
      const node = createCampaignNode({
        title: 'Q1 Push',
        description: 'Quarterly campaign',
        budget: 5000,
        goals: ['awareness', 'leads'],
        targetAudience: 'small business owners',
      });

      expect(node.budget).toBe(5000);
      expect(node.goals).toContain('awareness');
      expect(node.targetAudience).toBe('small business owners');
    });
  });

  describe('validateCampaignNode', () => {
    it('should pass for valid campaign', () => {
      const node = createCampaignNode({
        title: 'Valid Campaign',
        description: 'Test',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-02-28'),
      });

      expect(() => validateCampaignNode(node)).not.toThrow();
    });

    it('should fail when endDate is before startDate', () => {
      const node = createCampaignNode({
        title: 'Invalid',
        description: 'Test',
        startDate: new Date('2025-02-28'),
        endDate: new Date('2025-02-01'),
      });

      expect(() => validateCampaignNode(node)).toThrow('endDate must be after startDate');
    });
  });
});

describe('SeriesNode', () => {
  describe('createSeriesNode', () => {
    it('should create a series node with recurrence', () => {
      const node = createSeriesNode({
        title: 'Weekly Tips',
        description: 'Tips every Monday',
        blueprintId: 'bp_tip_post',
        platforms: ['instagram', 'linkedin'],
        recurrence: {
          frequency: 'weekly',
          dayOfWeek: 1, // Monday
          time: '10:00',
        },
        startDate: new Date('2025-01-06'),
        endDate: new Date('2025-03-31'),
      });

      expect(node.type).toBe('series');
      expect(node.recurrence.frequency).toBe('weekly');
      expect(node.recurrence.dayOfWeek).toBe(1);
      expect(node.platforms).toContain('instagram');
    });

    it('should support daily recurrence', () => {
      const node = createSeriesNode({
        title: 'Daily Quote',
        description: 'Motivational quotes',
        blueprintId: 'bp_quote',
        platforms: ['instagram'],
        recurrence: {
          frequency: 'daily',
          time: '08:00',
        },
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      });

      expect(node.recurrence.frequency).toBe('daily');
    });

    it('should support monthly recurrence', () => {
      const node = createSeriesNode({
        title: 'Monthly Recap',
        description: 'Monthly performance recap',
        blueprintId: 'bp_recap',
        platforms: ['youtube'],
        recurrence: {
          frequency: 'monthly',
          dayOfMonth: 1,
          time: '12:00',
        },
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      expect(node.recurrence.dayOfMonth).toBe(1);
    });
  });

  describe('expandSeries', () => {
    it('should expand weekly series into content nodes', () => {
      const series = createSeriesNode({
        title: 'Weekly Tips',
        description: 'Tips every Monday',
        blueprintId: 'bp_tip_post',
        platforms: ['instagram'],
        recurrence: {
          frequency: 'weekly',
          dayOfWeek: 1,
          time: '10:00',
        },
        startDate: new Date('2025-01-06'),
        endDate: new Date('2025-01-27'),
      });

      const expanded = expandSeries(series);

      expect(expanded).toHaveLength(4); // 4 Mondays
      expect(expanded[0].scheduledAt).toEqual(new Date('2025-01-06T10:00:00Z'));
      expect(expanded[0].title).toBe('Weekly Tips #1');
    });

    it('should expand daily series', () => {
      const series = createSeriesNode({
        title: 'Daily Quote',
        description: 'Quotes',
        blueprintId: 'bp_quote',
        platforms: ['instagram'],
        recurrence: {
          frequency: 'daily',
          time: '08:00',
        },
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-07'),
      });

      const expanded = expandSeries(series);

      expect(expanded).toHaveLength(7);
    });

    it('should create content nodes for each platform', () => {
      const series = createSeriesNode({
        title: 'Cross-Platform',
        description: 'Post everywhere',
        blueprintId: 'bp_generic',
        platforms: ['instagram', 'tiktok', 'facebook'],
        recurrence: {
          frequency: 'weekly',
          dayOfWeek: 3,
          time: '14:00',
        },
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-08'),
      });

      const expanded = expandSeries(series);

      // 1 Wednesday × 3 platforms = 3 nodes
      expect(expanded).toHaveLength(3);
      expect(expanded.map((n) => n.platform)).toContain('instagram');
      expect(expanded.map((n) => n.platform)).toContain('tiktok');
    });
  });
});

describe('MilestoneNode', () => {
  describe('createMilestoneNode', () => {
    it('should create a milestone node', () => {
      const node = createMilestoneNode({
        title: 'Campaign Approval',
        description: 'Approve all campaign content',
        dueDate: new Date('2025-02-15'),
        approvers: ['user_123', 'user_456'],
      });

      expect(node.type).toBe('milestone');
      expect(node.approvers).toHaveLength(2);
    });

    it('should support auto-approval after timeout', () => {
      const node = createMilestoneNode({
        title: 'Final Review',
        description: 'Final review checkpoint',
        dueDate: new Date('2025-02-20'),
        approvers: ['user_123'],
        autoApproveAfterHours: 48,
      });

      expect(node.autoApproveAfterHours).toBe(48);
    });

    it('should track approval requirements', () => {
      const node = createMilestoneNode({
        title: 'Launch Gate',
        description: 'All must approve',
        dueDate: new Date('2025-02-25'),
        approvers: ['user_1', 'user_2', 'user_3'],
        requireAllApprovers: true,
      });

      expect(node.requireAllApprovers).toBe(true);
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/planner/src/nodes/types.ts`

```typescript
import { z } from 'zod';

// Platform limits
export const PlatformLimits: Record<string, { captionLength: number; hashtagCount: number }> = {
  instagram: { captionLength: 2200, hashtagCount: 30 },
  facebook: { captionLength: 63206, hashtagCount: 30 },
  tiktok: { captionLength: 4000, hashtagCount: 100 },
  youtube: { captionLength: 5000, hashtagCount: 15 },
  linkedin: { captionLength: 3000, hashtagCount: 30 },
  x: { captionLength: 280, hashtagCount: 10 },
  skool: { captionLength: 10000, hashtagCount: 0 },
};

// Base node schema
export const BaseNodeSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['content', 'campaign', 'series', 'milestone']),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  status: z.enum(['pending', 'ready', 'in_progress', 'completed', 'failed', 'skipped']).default('pending'),
  metadata: z.record(z.unknown()).optional(),
  version: z.number().default(1),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Content node schema
export const ContentNodeSchema = BaseNodeSchema.extend({
  type: z.literal('content'),
  blueprintId: z.string(),
  platform: z.enum(['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'skool']),
  scheduledAt: z.date().optional(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  offerId: z.string().optional(),
  assetIds: z.array(z.string()).optional(),
  seriesId: z.string().optional(),
  seriesIndex: z.number().optional(),
});

export type ContentNode = z.infer<typeof ContentNodeSchema>;

// Campaign node schema
export const CampaignNodeSchema = BaseNodeSchema.extend({
  type: z.literal('campaign'),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  budget: z.number().optional(),
  goals: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  contentNodeIds: z.array(z.string()).optional(),
});

export type CampaignNode = z.infer<typeof CampaignNodeSchema>;

// Recurrence schema
export const RecurrenceSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().default('UTC'),
});

// Series node schema
export const SeriesNodeSchema = BaseNodeSchema.extend({
  type: z.literal('series'),
  blueprintId: z.string(),
  platforms: z.array(z.enum(['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'skool'])),
  recurrence: RecurrenceSchema,
  startDate: z.date(),
  endDate: z.date(),
  templateCaption: z.string().optional(),
  templateHashtags: z.array(z.string()).optional(),
});

export type SeriesNode = z.infer<typeof SeriesNodeSchema>;

// Milestone node schema
export const MilestoneNodeSchema = BaseNodeSchema.extend({
  type: z.literal('milestone'),
  dueDate: z.date(),
  approvers: z.array(z.string()),
  requireAllApprovers: z.boolean().default(false),
  autoApproveAfterHours: z.number().optional(),
  approvals: z.array(z.object({
    userId: z.string(),
    approvedAt: z.date(),
    comment: z.string().optional(),
  })).optional(),
});

export type MilestoneNode = z.infer<typeof MilestoneNodeSchema>;

// Union type
export type PlanNodeType = ContentNode | CampaignNode | SeriesNode | MilestoneNode;
```

**File:** `packages/planner/src/nodes/node-types.ts`

```typescript
import { nanoid } from 'nanoid';
import {
  addDays,
  addWeeks,
  addMonths,
  setDay,
  setDate,
  setHours,
  setMinutes,
  isBefore,
  isAfter,
  startOfDay,
} from 'date-fns';
import {
  ContentNode,
  ContentNodeSchema,
  CampaignNode,
  CampaignNodeSchema,
  SeriesNode,
  SeriesNodeSchema,
  MilestoneNode,
  MilestoneNodeSchema,
  PlatformLimits,
} from './types';

// Content Node Factory
export function createContentNode(
  input: Omit<ContentNode, 'id' | 'type' | 'status' | 'version' | 'createdAt' | 'updatedAt'> & {
    status?: ContentNode['status'];
  }
): ContentNode {
  const now = new Date();
  return ContentNodeSchema.parse({
    id: `node_${nanoid(12)}`,
    type: 'content',
    ...input,
    status: input.status ?? 'pending',
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}

export function validateContentNode(node: ContentNode): void {
  // Validate required fields
  if (!node.blueprintId) {
    throw new Error('blueprintId required for content node');
  }

  if (!node.platform) {
    throw new Error('platform required for content node');
  }

  // Validate platform-specific constraints
  const limits = PlatformLimits[node.platform];
  if (limits && node.caption) {
    if (node.caption.length > limits.captionLength) {
      throw new Error(`caption exceeds platform limit (${limits.captionLength} chars)`);
    }
  }

  if (limits && node.hashtags) {
    if (node.hashtags.length > limits.hashtagCount) {
      throw new Error(`hashtags exceed platform limit (${limits.hashtagCount})`);
    }
  }
}

// Campaign Node Factory
export function createCampaignNode(
  input: Omit<CampaignNode, 'id' | 'type' | 'status' | 'version' | 'createdAt' | 'updatedAt'>
): CampaignNode {
  const now = new Date();
  return CampaignNodeSchema.parse({
    id: `node_${nanoid(12)}`,
    type: 'campaign',
    ...input,
    status: 'pending',
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}

export function validateCampaignNode(node: CampaignNode): void {
  if (node.startDate && node.endDate) {
    if (isAfter(node.startDate, node.endDate)) {
      throw new Error('endDate must be after startDate');
    }
  }
}

// Series Node Factory
export function createSeriesNode(
  input: Omit<SeriesNode, 'id' | 'type' | 'status' | 'version' | 'createdAt' | 'updatedAt'>
): SeriesNode {
  const now = new Date();
  return SeriesNodeSchema.parse({
    id: `node_${nanoid(12)}`,
    type: 'series',
    ...input,
    status: 'pending',
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}

export function expandSeries(series: SeriesNode): ContentNode[] {
  const nodes: ContentNode[] = [];
  const { recurrence, startDate, endDate, platforms, blueprintId } = series;

  // Generate dates based on recurrence
  const dates = generateRecurrenceDates(startDate, endDate, recurrence);

  // Create content node for each date × platform combination
  let index = 1;
  for (const date of dates) {
    for (const platform of platforms) {
      const scheduledAt = applyTime(date, recurrence.time ?? '12:00', recurrence.timezone);

      nodes.push(
        createContentNode({
          title: `${series.title} #${index}`,
          description: series.description,
          blueprintId,
          platform,
          scheduledAt,
          caption: series.templateCaption,
          hashtags: series.templateHashtags,
          seriesId: series.id,
          seriesIndex: index,
        })
      );
    }
    index++;
  }

  return nodes;
}

function generateRecurrenceDates(
  startDate: Date,
  endDate: Date,
  recurrence: SeriesNode['recurrence']
): Date[] {
  const dates: Date[] = [];
  let current = startOfDay(startDate);

  // Adjust first date based on frequency
  if (recurrence.frequency === 'weekly' && recurrence.dayOfWeek !== undefined) {
    current = setDay(current, recurrence.dayOfWeek, { weekStartsOn: 0 });
    if (isBefore(current, startDate)) {
      current = addWeeks(current, 1);
    }
  } else if (recurrence.frequency === 'monthly' && recurrence.dayOfMonth !== undefined) {
    current = setDate(current, recurrence.dayOfMonth);
    if (isBefore(current, startDate)) {
      current = addMonths(current, 1);
    }
  }

  while (!isAfter(current, endDate)) {
    dates.push(new Date(current));

    switch (recurrence.frequency) {
      case 'daily':
        current = addDays(current, 1);
        break;
      case 'weekly':
        current = addWeeks(current, 1);
        break;
      case 'biweekly':
        current = addWeeks(current, 2);
        break;
      case 'monthly':
        current = addMonths(current, 1);
        break;
    }
  }

  return dates;
}

function applyTime(date: Date, time: string, timezone: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  let result = setHours(date, hours);
  result = setMinutes(result, minutes);
  // For simplicity, treating as UTC. Production would use proper timezone handling.
  return result;
}

// Milestone Node Factory
export function createMilestoneNode(
  input: Omit<MilestoneNode, 'id' | 'type' | 'status' | 'version' | 'createdAt' | 'updatedAt'>
): MilestoneNode {
  const now = new Date();
  return MilestoneNodeSchema.parse({
    id: `node_${nanoid(12)}`,
    type: 'milestone',
    ...input,
    status: 'pending',
    version: 1,
    createdAt: now,
    updatedAt: now,
    approvals: [],
  });
}

export function approveMilestone(
  node: MilestoneNode,
  userId: string,
  comment?: string
): MilestoneNode {
  if (!node.approvers.includes(userId)) {
    throw new Error('User is not an authorized approver');
  }

  const approvals = node.approvals ?? [];
  if (approvals.some((a) => a.userId === userId)) {
    throw new Error('User has already approved');
  }

  const updatedApprovals = [
    ...approvals,
    { userId, approvedAt: new Date(), comment },
  ];

  const isComplete = node.requireAllApprovers
    ? updatedApprovals.length === node.approvers.length
    : updatedApprovals.length > 0;

  return {
    ...node,
    approvals: updatedApprovals,
    status: isComplete ? 'completed' : node.status,
    updatedAt: new Date(),
    version: node.version + 1,
  };
}

export {
  ContentNode,
  CampaignNode,
  SeriesNode,
  MilestoneNode,
};
```

**File:** `packages/planner/src/nodes/index.ts`

```typescript
export * from './types';
export * from './node-types';
```

### Phase 3: Verification

```bash
cd packages/planner
pnpm test src/nodes/
pnpm typecheck
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/planner/src/nodes/types.ts` | Node type schemas |
| Create | `packages/planner/src/nodes/node-types.ts` | Node factories and validators |
| Create | `packages/planner/src/nodes/node-types.test.ts` | Unit tests |
| Create | `packages/planner/src/nodes/index.ts` | Module exports |

---

## Acceptance Criteria

- [ ] ContentNode validates blueprintId and platform
- [ ] ContentNode enforces platform-specific caption/hashtag limits
- [ ] CampaignNode validates date ranges
- [ ] SeriesNode supports daily, weekly, biweekly, monthly recurrence
- [ ] expandSeries generates correct content nodes
- [ ] MilestoneNode tracks approvals
- [ ] approveMilestone handles single and all-approvers modes
- [ ] All unit tests pass

---

## JSON Task Block

```json
{
  "task_id": "S2-A2",
  "name": "Plan Node Types",
  "sprint": 2,
  "agent": "A",
  "status": "pending",
  "complexity": "medium",
  "estimated_tokens": 4500,
  "dependencies": ["S2-A1"],
  "blocks": ["S2-A3"],
  "outputs": {
    "files": [
      "packages/planner/src/nodes/types.ts",
      "packages/planner/src/nodes/node-types.ts",
      "packages/planner/src/nodes/node-types.test.ts"
    ],
    "exports": ["ContentNode", "CampaignNode", "SeriesNode", "MilestoneNode", "expandSeries"]
  }
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "last_checkpoint": null,
  "execution_notes": [],
  "blockers_encountered": [],
  "decisions_made": []
}
```
