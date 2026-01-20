# S2-A6: Task Context Registry

## Task Metadata

```json
{
  "task_id": "S2-A6",
  "name": "Task Context Registry",
  "sprint": 2,
  "agent": "A",
  "status": "pending",
  "tests_status": "not_written",
  "dependencies": ["S2-A1", "S1-B8"],
  "blocks": ["S2-A7"],
  "estimated_complexity": "medium",
  "estimated_hours": 3,
  "spec_references": [
    "/docs/adr/ADR-0001-tesla-mixed-precision-patterns.md",
    "/docs/03-agents-tools/agent-recursion-contracts.md",
    "/docs/01-architecture/rlm-integration-spec.md"
  ],
  "acceptance_criteria": [
    "TaskContextRegistry class with task type definitions",
    "Context category mappings for all task types",
    "Required/optional/excluded context per task",
    "Registry validation on startup",
    "Extensible for custom task types"
  ],
  "test_files": [
    "packages/core/src/context/__tests__/task-context-registry.test.ts"
  ],
  "created_files": [
    "packages/core/src/context/task-context-registry.ts",
    "packages/core/src/context/context-categories.ts",
    "packages/core/src/context/task-types.ts"
  ]
}
```

---

## Context

The Task Context Registry implements **sparse attention** for RTV's domain: not every piece of historical data matters for every task. By defining which context categories are required, optional, or excluded per task type, we reduce token cost and improve model focus.

### Background: The Sparse Attention Principle

From Tesla's patent analysis (ADR-0001):
> "Tesla skips 'empty space' in compute. We skip irrelevant context categories to reduce token cost and improve focus."

**Without Task-Aware Filtering:**
```
Create Post Task → Load ALL context → 10,000 tokens → $0.30 per request
```

**With Task-Aware Filtering:**
```
Create Post Task → Load only relevant context → 3,000 tokens → $0.09 per request
```

### Task Types in RTV

| Task Type | Purpose | Key Context Needs |
|-----------|---------|-------------------|
| `create_post` | Generate new content | Brand voice, campaign objectives, recent top posts |
| `engage_comment` | Reply to comments | Conversation thread, user relationship, brand voice |
| `engage_dm` | Reply to DMs | Full conversation, user history, escalation rules |
| `schedule` | Plan content calendar | Campaign objectives, posting frequency, time zones |
| `analyze` | Generate reports | Historical performance, audience insights |
| `moderate` | Review flagged content | Compliance rules, prohibited topics |

---

## Pre-Implementation Checklist

- [ ] Read: `docs/adr/ADR-0001-tesla-mixed-precision-patterns.md`
- [ ] Read: `docs/03-agents-tools/agent-recursion-contracts.md`
- [ ] Verify S2-A1 (PlanGraph Model) is complete
- [ ] Verify S1-B8 (Pinned Context Manager) is complete
- [ ] Review existing task definitions in blueprints

---

## TDD Methodology

### Phase 1: RED — Write Failing Tests First

Create `packages/core/src/context/__tests__/task-context-registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskContextRegistry,
  TaskType,
  ContextCategory,
  TaskContextConfig
} from '../task-context-registry';

describe('S2-A6: Task Context Registry', () => {
  let registry: TaskContextRegistry;

  beforeEach(() => {
    registry = new TaskContextRegistry();
  });

  describe('Task Type Definitions', () => {
    it('should have create_post task type defined', () => {
      const config = registry.get(TaskType.CREATE_POST);
      expect(config).toBeDefined();
      expect(config.taskType).toBe(TaskType.CREATE_POST);
    });

    it('should have engage_comment task type defined', () => {
      const config = registry.get(TaskType.ENGAGE_COMMENT);
      expect(config).toBeDefined();
    });

    it('should have engage_dm task type defined', () => {
      const config = registry.get(TaskType.ENGAGE_DM);
      expect(config).toBeDefined();
    });

    it('should have schedule task type defined', () => {
      const config = registry.get(TaskType.SCHEDULE);
      expect(config).toBeDefined();
    });

    it('should have analyze task type defined', () => {
      const config = registry.get(TaskType.ANALYZE);
      expect(config).toBeDefined();
    });

    it('should have moderate task type defined', () => {
      const config = registry.get(TaskType.MODERATE);
      expect(config).toBeDefined();
    });

    it('should list all registered task types', () => {
      const types = registry.listTaskTypes();
      expect(types).toContain(TaskType.CREATE_POST);
      expect(types).toContain(TaskType.ENGAGE_COMMENT);
      expect(types).toContain(TaskType.ENGAGE_DM);
      expect(types.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Context Category Mappings', () => {
    describe('CREATE_POST task', () => {
      it('should require brand_voice context', () => {
        const config = registry.get(TaskType.CREATE_POST);
        expect(config.required).toContain(ContextCategory.BRAND_VOICE);
      });

      it('should require campaign_objectives context', () => {
        const config = registry.get(TaskType.CREATE_POST);
        expect(config.required).toContain(ContextCategory.CAMPAIGN_OBJECTIVES);
      });

      it('should optionally include recent_top_posts', () => {
        const config = registry.get(TaskType.CREATE_POST);
        expect(config.optional).toContain(ContextCategory.RECENT_TOP_POSTS);
      });

      it('should exclude full_engagement_history', () => {
        const config = registry.get(TaskType.CREATE_POST);
        expect(config.excluded).toContain(ContextCategory.FULL_ENGAGEMENT_HISTORY);
      });

      it('should exclude scheduling_logs', () => {
        const config = registry.get(TaskType.CREATE_POST);
        expect(config.excluded).toContain(ContextCategory.SCHEDULING_LOGS);
      });
    });

    describe('ENGAGE_COMMENT task', () => {
      it('should require conversation_thread context', () => {
        const config = registry.get(TaskType.ENGAGE_COMMENT);
        expect(config.required).toContain(ContextCategory.CONVERSATION_THREAD);
      });

      it('should require brand_voice context', () => {
        const config = registry.get(TaskType.ENGAGE_COMMENT);
        expect(config.required).toContain(ContextCategory.BRAND_VOICE);
      });

      it('should optionally include user_relationship', () => {
        const config = registry.get(TaskType.ENGAGE_COMMENT);
        expect(config.optional).toContain(ContextCategory.USER_RELATIONSHIP);
      });

      it('should exclude content_calendar', () => {
        const config = registry.get(TaskType.ENGAGE_COMMENT);
        expect(config.excluded).toContain(ContextCategory.CONTENT_CALENDAR);
      });
    });

    describe('ENGAGE_DM task', () => {
      it('should require full conversation history', () => {
        const config = registry.get(TaskType.ENGAGE_DM);
        expect(config.required).toContain(ContextCategory.CONVERSATION_THREAD);
        expect(config.required).toContain(ContextCategory.USER_HISTORY);
      });

      it('should require escalation_rules', () => {
        const config = registry.get(TaskType.ENGAGE_DM);
        expect(config.required).toContain(ContextCategory.ESCALATION_RULES);
      });
    });

    describe('MODERATE task', () => {
      it('should require compliance_rules', () => {
        const config = registry.get(TaskType.MODERATE);
        expect(config.required).toContain(ContextCategory.COMPLIANCE_RULES);
      });

      it('should require prohibited_topics', () => {
        const config = registry.get(TaskType.MODERATE);
        expect(config.required).toContain(ContextCategory.PROHIBITED_TOPICS);
      });
    });
  });

  describe('Context Category Validation', () => {
    it('should not have overlap between required and excluded', () => {
      const types = registry.listTaskTypes();
      
      for (const type of types) {
        const config = registry.get(type);
        const overlap = config.required.filter(c => config.excluded.includes(c));
        expect(overlap).toHaveLength(0);
      }
    });

    it('should not have overlap between optional and excluded', () => {
      const types = registry.listTaskTypes();
      
      for (const type of types) {
        const config = registry.get(type);
        const overlap = config.optional.filter(c => config.excluded.includes(c));
        expect(overlap).toHaveLength(0);
      }
    });

    it('should have at least one required category per task', () => {
      const types = registry.listTaskTypes();
      
      for (const type of types) {
        const config = registry.get(type);
        expect(config.required.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Registry Validation', () => {
    it('should validate all task configs on construction', () => {
      expect(() => new TaskContextRegistry()).not.toThrow();
    });

    it('should throw on invalid task config registration', () => {
      expect(() => {
        registry.register({
          taskType: 'invalid' as TaskType,
          required: [],
          optional: [],
          excluded: []
        });
      }).toThrow();
    });

    it('should throw if required is empty', () => {
      expect(() => {
        registry.register({
          taskType: TaskType.CREATE_POST,
          required: [], // Invalid: must have at least one
          optional: [ContextCategory.BRAND_VOICE],
          excluded: []
        });
      }).toThrow('at least one required');
    });

    it('should throw if required and excluded overlap', () => {
      expect(() => {
        registry.register({
          taskType: TaskType.CREATE_POST,
          required: [ContextCategory.BRAND_VOICE],
          optional: [],
          excluded: [ContextCategory.BRAND_VOICE] // Conflict!
        });
      }).toThrow('overlap');
    });
  });

  describe('Custom Task Types', () => {
    it('should allow registering custom task types', () => {
      registry.register({
        taskType: 'custom_task' as TaskType,
        required: [ContextCategory.BRAND_VOICE],
        optional: [ContextCategory.CAMPAIGN_OBJECTIVES],
        excluded: [ContextCategory.SCHEDULING_LOGS],
        description: 'A custom task for special workflows'
      });

      const config = registry.get('custom_task' as TaskType);
      expect(config).toBeDefined();
      expect(config.description).toBe('A custom task for special workflows');
    });

    it('should allow overriding default task configs', () => {
      const original = registry.get(TaskType.CREATE_POST);
      
      registry.register({
        taskType: TaskType.CREATE_POST,
        required: [ContextCategory.BRAND_VOICE, ContextCategory.LEGAL_DISCLAIMERS],
        optional: [],
        excluded: []
      });

      const updated = registry.get(TaskType.CREATE_POST);
      expect(updated.required).toContain(ContextCategory.LEGAL_DISCLAIMERS);
    });
  });

  describe('Context Resolution', () => {
    it('should resolve all required categories', () => {
      const resolved = registry.resolveCategories(TaskType.CREATE_POST, {
        budget: Infinity
      });

      const config = registry.get(TaskType.CREATE_POST);
      for (const required of config.required) {
        expect(resolved).toContain(required);
      }
    });

    it('should include optional categories within budget', () => {
      const config = registry.get(TaskType.CREATE_POST);
      
      // Large budget should include optionals
      const resolved = registry.resolveCategories(TaskType.CREATE_POST, {
        budget: 10000,
        estimatedTokens: {
          [ContextCategory.BRAND_VOICE]: 500,
          [ContextCategory.CAMPAIGN_OBJECTIVES]: 500,
          [ContextCategory.RECENT_TOP_POSTS]: 1000
        }
      });

      expect(resolved).toContain(ContextCategory.RECENT_TOP_POSTS);
    });

    it('should exclude optional categories when over budget', () => {
      const config = registry.get(TaskType.CREATE_POST);
      
      // Tiny budget should skip optionals
      const resolved = registry.resolveCategories(TaskType.CREATE_POST, {
        budget: 1000,
        estimatedTokens: {
          [ContextCategory.BRAND_VOICE]: 500,
          [ContextCategory.CAMPAIGN_OBJECTIVES]: 500,
          [ContextCategory.RECENT_TOP_POSTS]: 2000 // Too expensive
        }
      });

      expect(resolved).not.toContain(ContextCategory.RECENT_TOP_POSTS);
    });

    it('should never include excluded categories', () => {
      const config = registry.get(TaskType.CREATE_POST);
      
      const resolved = registry.resolveCategories(TaskType.CREATE_POST, {
        budget: Infinity
      });

      for (const excluded of config.excluded) {
        expect(resolved).not.toContain(excluded);
      }
    });
  });

  describe('Token Budget Estimation', () => {
    it('should estimate required token count', () => {
      const estimate = registry.estimateRequiredTokens(TaskType.CREATE_POST, {
        [ContextCategory.BRAND_VOICE]: 500,
        [ContextCategory.CAMPAIGN_OBJECTIVES]: 300,
        [ContextCategory.COMPLIANCE_RULES]: 200
      });

      // Should include brand_voice + campaign_objectives (both required)
      expect(estimate).toBeGreaterThanOrEqual(800);
    });

    it('should estimate total token count with optionals', () => {
      const estimate = registry.estimateTotalTokens(TaskType.CREATE_POST, {
        [ContextCategory.BRAND_VOICE]: 500,
        [ContextCategory.CAMPAIGN_OBJECTIVES]: 300,
        [ContextCategory.RECENT_TOP_POSTS]: 1000,
        [ContextCategory.TRENDING_TOPICS]: 500
      });

      // Should include required + optional
      expect(estimate).toBeGreaterThanOrEqual(2300);
    });
  });

  describe('Category Metadata', () => {
    it('should have descriptions for all categories', () => {
      const categories = Object.values(ContextCategory);
      
      for (const category of categories) {
        const meta = registry.getCategoryMetadata(category);
        expect(meta.description).toBeDefined();
        expect(meta.description.length).toBeGreaterThan(0);
      }
    });

    it('should have priority hints for categories', () => {
      const brandVoice = registry.getCategoryMetadata(ContextCategory.BRAND_VOICE);
      expect(brandVoice.priorityHint).toBe('high');

      const schedulingLogs = registry.getCategoryMetadata(ContextCategory.SCHEDULING_LOGS);
      expect(schedulingLogs.priorityHint).toBe('low');
    });
  });
});
```

---

### Phase 2: GREEN — Implement Minimum Code

#### 2.1 Create Context Categories

Create `packages/core/src/context/context-categories.ts`:

```typescript
/**
 * Categories of context that can be loaded for tasks.
 * 
 * Each category represents a distinct type of information
 * that may be relevant to task execution.
 */
export enum ContextCategory {
  // Pinned categories (from Memory Priority System)
  BRAND_VOICE = 'brand_voice',
  COMPLIANCE_RULES = 'compliance_rules',
  PROHIBITED_TOPICS = 'prohibited_topics',
  LEGAL_DISCLAIMERS = 'legal_disclaimers',
  TONE_GUIDELINES = 'tone_guidelines',

  // Campaign & Strategy
  CAMPAIGN_OBJECTIVES = 'campaign_objectives',
  CONTENT_PILLARS = 'content_pillars',
  TARGET_AUDIENCE = 'target_audience',
  COMPETITOR_ANALYSIS = 'competitor_analysis',

  // Content Performance
  RECENT_TOP_POSTS = 'recent_top_posts',
  POST_PERFORMANCE = 'post_performance',
  ENGAGEMENT_TRENDS = 'engagement_trends',
  FULL_ENGAGEMENT_HISTORY = 'full_engagement_history',

  // Engagement Context
  CONVERSATION_THREAD = 'conversation_thread',
  USER_RELATIONSHIP = 'user_relationship',
  USER_HISTORY = 'user_history',
  ESCALATION_RULES = 'escalation_rules',

  // Scheduling
  CONTENT_CALENDAR = 'content_calendar',
  SCHEDULING_LOGS = 'scheduling_logs',
  POSTING_FREQUENCY = 'posting_frequency',
  TIME_ZONE_PREFERENCES = 'time_zone_preferences',

  // External
  TRENDING_TOPICS = 'trending_topics',
  PLATFORM_UPDATES = 'platform_updates',

  // Analytics
  AUDIENCE_INSIGHTS = 'audience_insights',
  ANALYTICS_REPORTS = 'analytics_reports'
}

/**
 * Metadata for each context category.
 */
export interface CategoryMetadata {
  description: string;
  priorityHint: 'high' | 'medium' | 'low';
  typicalTokens: number;
  refreshFrequency: 'realtime' | 'session' | 'daily' | 'weekly';
}

/**
 * Category metadata definitions.
 */
export const CATEGORY_METADATA: Record<ContextCategory, CategoryMetadata> = {
  [ContextCategory.BRAND_VOICE]: {
    description: 'Core brand voice and personality guidelines',
    priorityHint: 'high',
    typicalTokens: 500,
    refreshFrequency: 'weekly'
  },
  [ContextCategory.COMPLIANCE_RULES]: {
    description: 'Legal and platform compliance requirements',
    priorityHint: 'high',
    typicalTokens: 300,
    refreshFrequency: 'weekly'
  },
  [ContextCategory.PROHIBITED_TOPICS]: {
    description: 'Topics and themes to avoid',
    priorityHint: 'high',
    typicalTokens: 200,
    refreshFrequency: 'weekly'
  },
  [ContextCategory.LEGAL_DISCLAIMERS]: {
    description: 'Required legal disclaimers and disclosures',
    priorityHint: 'high',
    typicalTokens: 300,
    refreshFrequency: 'weekly'
  },
  [ContextCategory.TONE_GUIDELINES]: {
    description: 'Specific tone and style preferences',
    priorityHint: 'high',
    typicalTokens: 400,
    refreshFrequency: 'weekly'
  },
  [ContextCategory.CAMPAIGN_OBJECTIVES]: {
    description: 'Current campaign goals and KPIs',
    priorityHint: 'high',
    typicalTokens: 400,
    refreshFrequency: 'session'
  },
  [ContextCategory.CONTENT_PILLARS]: {
    description: 'Core content themes and categories',
    priorityHint: 'medium',
    typicalTokens: 300,
    refreshFrequency: 'weekly'
  },
  [ContextCategory.TARGET_AUDIENCE]: {
    description: 'Audience demographics and preferences',
    priorityHint: 'medium',
    typicalTokens: 400,
    refreshFrequency: 'weekly'
  },
  [ContextCategory.COMPETITOR_ANALYSIS]: {
    description: 'Competitor positioning and differentiation',
    priorityHint: 'low',
    typicalTokens: 600,
    refreshFrequency: 'weekly'
  },
  [ContextCategory.RECENT_TOP_POSTS]: {
    description: 'Best performing recent posts for reference',
    priorityHint: 'medium',
    typicalTokens: 800,
    refreshFrequency: 'daily'
  },
  [ContextCategory.POST_PERFORMANCE]: {
    description: 'Performance metrics for recent posts',
    priorityHint: 'medium',
    typicalTokens: 500,
    refreshFrequency: 'daily'
  },
  [ContextCategory.ENGAGEMENT_TRENDS]: {
    description: 'Patterns in engagement over time',
    priorityHint: 'low',
    typicalTokens: 400,
    refreshFrequency: 'daily'
  },
  [ContextCategory.FULL_ENGAGEMENT_HISTORY]: {
    description: 'Complete engagement history (large)',
    priorityHint: 'low',
    typicalTokens: 3000,
    refreshFrequency: 'realtime'
  },
  [ContextCategory.CONVERSATION_THREAD]: {
    description: 'Current conversation being responded to',
    priorityHint: 'high',
    typicalTokens: 1000,
    refreshFrequency: 'realtime'
  },
  [ContextCategory.USER_RELATIONSHIP]: {
    description: 'History with specific user',
    priorityHint: 'medium',
    typicalTokens: 400,
    refreshFrequency: 'realtime'
  },
  [ContextCategory.USER_HISTORY]: {
    description: 'Full interaction history with user',
    priorityHint: 'medium',
    typicalTokens: 800,
    refreshFrequency: 'realtime'
  },
  [ContextCategory.ESCALATION_RULES]: {
    description: 'When and how to escalate to humans',
    priorityHint: 'high',
    typicalTokens: 300,
    refreshFrequency: 'weekly'
  },
  [ContextCategory.CONTENT_CALENDAR]: {
    description: 'Scheduled and planned content',
    priorityHint: 'medium',
    typicalTokens: 600,
    refreshFrequency: 'daily'
  },
  [ContextCategory.SCHEDULING_LOGS]: {
    description: 'History of scheduling operations',
    priorityHint: 'low',
    typicalTokens: 400,
    refreshFrequency: 'daily'
  },
  [ContextCategory.POSTING_FREQUENCY]: {
    description: 'Posting cadence preferences',
    priorityHint: 'medium',
    typicalTokens: 200,
    refreshFrequency: 'weekly'
  },
  [ContextCategory.TIME_ZONE_PREFERENCES]: {
    description: 'Time zone and optimal posting times',
    priorityHint: 'medium',
    typicalTokens: 100,
    refreshFrequency: 'weekly'
  },
  [ContextCategory.TRENDING_TOPICS]: {
    description: 'Current trending topics on platforms',
    priorityHint: 'low',
    typicalTokens: 500,
    refreshFrequency: 'realtime'
  },
  [ContextCategory.PLATFORM_UPDATES]: {
    description: 'Recent platform changes and features',
    priorityHint: 'low',
    typicalTokens: 300,
    refreshFrequency: 'daily'
  },
  [ContextCategory.AUDIENCE_INSIGHTS]: {
    description: 'Detailed audience analytics',
    priorityHint: 'medium',
    typicalTokens: 600,
    refreshFrequency: 'daily'
  },
  [ContextCategory.ANALYTICS_REPORTS]: {
    description: 'Generated performance reports',
    priorityHint: 'low',
    typicalTokens: 1000,
    refreshFrequency: 'daily'
  }
};
```

#### 2.2 Create Task Types

Create `packages/core/src/context/task-types.ts`:

```typescript
/**
 * Task types supported by the RTV system.
 */
export enum TaskType {
  // Content Creation
  CREATE_POST = 'create_post',
  CREATE_STORY = 'create_story',
  CREATE_REEL = 'create_reel',
  EDIT_DRAFT = 'edit_draft',

  // Engagement
  ENGAGE_COMMENT = 'engage_comment',
  ENGAGE_DM = 'engage_dm',
  ENGAGE_MENTION = 'engage_mention',

  // Scheduling
  SCHEDULE = 'schedule',
  RESCHEDULE = 'reschedule',

  // Analysis
  ANALYZE = 'analyze',
  REPORT = 'report',

  // Moderation
  MODERATE = 'moderate',
  REVIEW = 'review'
}

/**
 * Task type metadata.
 */
export interface TaskTypeMetadata {
  description: string;
  category: 'creation' | 'engagement' | 'scheduling' | 'analysis' | 'moderation';
  typicalDuration: 'instant' | 'short' | 'medium' | 'long';
  requiresApproval: boolean;
}

/**
 * Task type metadata definitions.
 */
export const TASK_TYPE_METADATA: Record<TaskType, TaskTypeMetadata> = {
  [TaskType.CREATE_POST]: {
    description: 'Generate a new social media post',
    category: 'creation',
    typicalDuration: 'medium',
    requiresApproval: true
  },
  [TaskType.CREATE_STORY]: {
    description: 'Generate a story/ephemeral post',
    category: 'creation',
    typicalDuration: 'short',
    requiresApproval: true
  },
  [TaskType.CREATE_REEL]: {
    description: 'Generate a short-form video post',
    category: 'creation',
    typicalDuration: 'long',
    requiresApproval: true
  },
  [TaskType.EDIT_DRAFT]: {
    description: 'Edit an existing draft',
    category: 'creation',
    typicalDuration: 'short',
    requiresApproval: false
  },
  [TaskType.ENGAGE_COMMENT]: {
    description: 'Respond to a comment',
    category: 'engagement',
    typicalDuration: 'instant',
    requiresApproval: true
  },
  [TaskType.ENGAGE_DM]: {
    description: 'Respond to a direct message',
    category: 'engagement',
    typicalDuration: 'short',
    requiresApproval: true
  },
  [TaskType.ENGAGE_MENTION]: {
    description: 'Respond to a mention',
    category: 'engagement',
    typicalDuration: 'instant',
    requiresApproval: true
  },
  [TaskType.SCHEDULE]: {
    description: 'Schedule content for publishing',
    category: 'scheduling',
    typicalDuration: 'instant',
    requiresApproval: false
  },
  [TaskType.RESCHEDULE]: {
    description: 'Modify scheduled content timing',
    category: 'scheduling',
    typicalDuration: 'instant',
    requiresApproval: false
  },
  [TaskType.ANALYZE]: {
    description: 'Analyze performance data',
    category: 'analysis',
    typicalDuration: 'medium',
    requiresApproval: false
  },
  [TaskType.REPORT]: {
    description: 'Generate a performance report',
    category: 'analysis',
    typicalDuration: 'long',
    requiresApproval: false
  },
  [TaskType.MODERATE]: {
    description: 'Review content for compliance',
    category: 'moderation',
    typicalDuration: 'short',
    requiresApproval: false
  },
  [TaskType.REVIEW]: {
    description: 'Review flagged content or actions',
    category: 'moderation',
    typicalDuration: 'short',
    requiresApproval: false
  }
};
```

#### 2.3 Create Task Context Registry

Create `packages/core/src/context/task-context-registry.ts`:

```typescript
import { ContextCategory, CATEGORY_METADATA, CategoryMetadata } from './context-categories';
import { TaskType } from './task-types';

/**
 * Configuration for a task's context requirements.
 */
export interface TaskContextConfig {
  taskType: TaskType | string;
  required: ContextCategory[];
  optional: ContextCategory[];
  excluded: ContextCategory[];
  description?: string;
}

/**
 * Options for resolving context categories.
 */
export interface ResolveOptions {
  budget: number;
  estimatedTokens?: Record<ContextCategory, number>;
}

/**
 * Registry for task-to-context mappings.
 * 
 * Implements sparse attention pattern: each task type
 * explicitly declares which context it needs, avoiding
 * unnecessary token usage.
 */
export class TaskContextRegistry {
  private configs: Map<string, TaskContextConfig> = new Map();

  constructor() {
    this.registerDefaults();
    this.validate();
  }

  /**
   * Register default task configurations.
   */
  private registerDefaults(): void {
    // CREATE_POST
    this.configs.set(TaskType.CREATE_POST, {
      taskType: TaskType.CREATE_POST,
      required: [
        ContextCategory.BRAND_VOICE,
        ContextCategory.CAMPAIGN_OBJECTIVES,
        ContextCategory.COMPLIANCE_RULES
      ],
      optional: [
        ContextCategory.RECENT_TOP_POSTS,
        ContextCategory.TRENDING_TOPICS,
        ContextCategory.CONTENT_PILLARS,
        ContextCategory.TARGET_AUDIENCE
      ],
      excluded: [
        ContextCategory.FULL_ENGAGEMENT_HISTORY,
        ContextCategory.SCHEDULING_LOGS,
        ContextCategory.CONVERSATION_THREAD,
        ContextCategory.USER_HISTORY,
        ContextCategory.ANALYTICS_REPORTS
      ]
    });

    // ENGAGE_COMMENT
    this.configs.set(TaskType.ENGAGE_COMMENT, {
      taskType: TaskType.ENGAGE_COMMENT,
      required: [
        ContextCategory.BRAND_VOICE,
        ContextCategory.CONVERSATION_THREAD,
        ContextCategory.COMPLIANCE_RULES
      ],
      optional: [
        ContextCategory.USER_RELATIONSHIP,
        ContextCategory.TONE_GUIDELINES,
        ContextCategory.ESCALATION_RULES
      ],
      excluded: [
        ContextCategory.CONTENT_CALENDAR,
        ContextCategory.SCHEDULING_LOGS,
        ContextCategory.ANALYTICS_REPORTS,
        ContextCategory.FULL_ENGAGEMENT_HISTORY
      ]
    });

    // ENGAGE_DM
    this.configs.set(TaskType.ENGAGE_DM, {
      taskType: TaskType.ENGAGE_DM,
      required: [
        ContextCategory.BRAND_VOICE,
        ContextCategory.CONVERSATION_THREAD,
        ContextCategory.USER_HISTORY,
        ContextCategory.ESCALATION_RULES,
        ContextCategory.COMPLIANCE_RULES
      ],
      optional: [
        ContextCategory.USER_RELATIONSHIP,
        ContextCategory.TONE_GUIDELINES,
        ContextCategory.CAMPAIGN_OBJECTIVES
      ],
      excluded: [
        ContextCategory.CONTENT_CALENDAR,
        ContextCategory.SCHEDULING_LOGS,
        ContextCategory.ANALYTICS_REPORTS,
        ContextCategory.TRENDING_TOPICS
      ]
    });

    // SCHEDULE
    this.configs.set(TaskType.SCHEDULE, {
      taskType: TaskType.SCHEDULE,
      required: [
        ContextCategory.CAMPAIGN_OBJECTIVES,
        ContextCategory.CONTENT_CALENDAR,
        ContextCategory.POSTING_FREQUENCY
      ],
      optional: [
        ContextCategory.TIME_ZONE_PREFERENCES,
        ContextCategory.AUDIENCE_INSIGHTS,
        ContextCategory.POST_PERFORMANCE
      ],
      excluded: [
        ContextCategory.CONVERSATION_THREAD,
        ContextCategory.USER_HISTORY,
        ContextCategory.BRAND_VOICE,
        ContextCategory.FULL_ENGAGEMENT_HISTORY
      ]
    });

    // ANALYZE
    this.configs.set(TaskType.ANALYZE, {
      taskType: TaskType.ANALYZE,
      required: [
        ContextCategory.POST_PERFORMANCE,
        ContextCategory.ENGAGEMENT_TRENDS,
        ContextCategory.CAMPAIGN_OBJECTIVES
      ],
      optional: [
        ContextCategory.AUDIENCE_INSIGHTS,
        ContextCategory.COMPETITOR_ANALYSIS,
        ContextCategory.FULL_ENGAGEMENT_HISTORY
      ],
      excluded: [
        ContextCategory.BRAND_VOICE,
        ContextCategory.CONVERSATION_THREAD,
        ContextCategory.SCHEDULING_LOGS
      ]
    });

    // MODERATE
    this.configs.set(TaskType.MODERATE, {
      taskType: TaskType.MODERATE,
      required: [
        ContextCategory.COMPLIANCE_RULES,
        ContextCategory.PROHIBITED_TOPICS,
        ContextCategory.LEGAL_DISCLAIMERS
      ],
      optional: [
        ContextCategory.BRAND_VOICE,
        ContextCategory.TONE_GUIDELINES
      ],
      excluded: [
        ContextCategory.TRENDING_TOPICS,
        ContextCategory.ANALYTICS_REPORTS,
        ContextCategory.SCHEDULING_LOGS,
        ContextCategory.CONTENT_CALENDAR
      ]
    });

    // Add remaining task types...
    this.registerRemainingDefaults();
  }

  private registerRemainingDefaults(): void {
    // CREATE_STORY
    this.configs.set(TaskType.CREATE_STORY, {
      taskType: TaskType.CREATE_STORY,
      required: [
        ContextCategory.BRAND_VOICE,
        ContextCategory.CAMPAIGN_OBJECTIVES
      ],
      optional: [
        ContextCategory.TRENDING_TOPICS,
        ContextCategory.RECENT_TOP_POSTS
      ],
      excluded: [
        ContextCategory.FULL_ENGAGEMENT_HISTORY,
        ContextCategory.ANALYTICS_REPORTS
      ]
    });

    // CREATE_REEL
    this.configs.set(TaskType.CREATE_REEL, {
      taskType: TaskType.CREATE_REEL,
      required: [
        ContextCategory.BRAND_VOICE,
        ContextCategory.CAMPAIGN_OBJECTIVES,
        ContextCategory.COMPLIANCE_RULES
      ],
      optional: [
        ContextCategory.TRENDING_TOPICS,
        ContextCategory.RECENT_TOP_POSTS,
        ContextCategory.AUDIENCE_INSIGHTS
      ],
      excluded: [
        ContextCategory.SCHEDULING_LOGS,
        ContextCategory.CONVERSATION_THREAD
      ]
    });

    // ENGAGE_MENTION
    this.configs.set(TaskType.ENGAGE_MENTION, {
      taskType: TaskType.ENGAGE_MENTION,
      required: [
        ContextCategory.BRAND_VOICE,
        ContextCategory.CONVERSATION_THREAD,
        ContextCategory.COMPLIANCE_RULES
      ],
      optional: [
        ContextCategory.USER_RELATIONSHIP,
        ContextCategory.CAMPAIGN_OBJECTIVES
      ],
      excluded: [
        ContextCategory.CONTENT_CALENDAR,
        ContextCategory.ANALYTICS_REPORTS
      ]
    });

    // REPORT
    this.configs.set(TaskType.REPORT, {
      taskType: TaskType.REPORT,
      required: [
        ContextCategory.POST_PERFORMANCE,
        ContextCategory.ENGAGEMENT_TRENDS,
        ContextCategory.AUDIENCE_INSIGHTS
      ],
      optional: [
        ContextCategory.FULL_ENGAGEMENT_HISTORY,
        ContextCategory.COMPETITOR_ANALYSIS,
        ContextCategory.ANALYTICS_REPORTS
      ],
      excluded: [
        ContextCategory.CONVERSATION_THREAD,
        ContextCategory.BRAND_VOICE
      ]
    });

    // REVIEW
    this.configs.set(TaskType.REVIEW, {
      taskType: TaskType.REVIEW,
      required: [
        ContextCategory.COMPLIANCE_RULES,
        ContextCategory.BRAND_VOICE
      ],
      optional: [
        ContextCategory.PROHIBITED_TOPICS,
        ContextCategory.LEGAL_DISCLAIMERS
      ],
      excluded: [
        ContextCategory.TRENDING_TOPICS,
        ContextCategory.SCHEDULING_LOGS
      ]
    });

    // EDIT_DRAFT / RESCHEDULE with minimal config
    this.configs.set(TaskType.EDIT_DRAFT, {
      taskType: TaskType.EDIT_DRAFT,
      required: [ContextCategory.BRAND_VOICE],
      optional: [ContextCategory.COMPLIANCE_RULES],
      excluded: []
    });

    this.configs.set(TaskType.RESCHEDULE, {
      taskType: TaskType.RESCHEDULE,
      required: [ContextCategory.CONTENT_CALENDAR],
      optional: [ContextCategory.POSTING_FREQUENCY],
      excluded: []
    });
  }

  /**
   * Validate all registered configurations.
   */
  private validate(): void {
    for (const [type, config] of this.configs) {
      this.validateConfig(config);
    }
  }

  /**
   * Validate a single configuration.
   */
  private validateConfig(config: TaskContextConfig): void {
    // Must have at least one required category
    if (config.required.length === 0) {
      throw new Error(
        `Task ${config.taskType} must have at least one required context category`
      );
    }

    // Check for required/excluded overlap
    const requiredSet = new Set(config.required);
    for (const excluded of config.excluded) {
      if (requiredSet.has(excluded)) {
        throw new Error(
          `Task ${config.taskType} has overlap between required and excluded: ${excluded}`
        );
      }
    }

    // Check for optional/excluded overlap
    const optionalSet = new Set(config.optional);
    for (const excluded of config.excluded) {
      if (optionalSet.has(excluded)) {
        throw new Error(
          `Task ${config.taskType} has overlap between optional and excluded: ${excluded}`
        );
      }
    }
  }

  /**
   * Get configuration for a task type.
   */
  get(taskType: TaskType | string): TaskContextConfig {
    const config = this.configs.get(taskType);
    if (!config) {
      throw new Error(`Unknown task type: ${taskType}`);
    }
    return config;
  }

  /**
   * Register or update a task configuration.
   */
  register(config: TaskContextConfig): void {
    this.validateConfig(config);
    this.configs.set(config.taskType, config);
  }

  /**
   * List all registered task types.
   */
  listTaskTypes(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Resolve which categories to load for a task.
   */
  resolveCategories(
    taskType: TaskType | string,
    options: ResolveOptions
  ): ContextCategory[] {
    const config = this.get(taskType);
    const result: ContextCategory[] = [...config.required];
    
    // Add optional categories if within budget
    let usedTokens = this.sumTokens(config.required, options.estimatedTokens);
    
    for (const optional of config.optional) {
      const tokens = options.estimatedTokens?.[optional] ?? 
        CATEGORY_METADATA[optional]?.typicalTokens ?? 500;
      
      if (usedTokens + tokens <= options.budget) {
        result.push(optional);
        usedTokens += tokens;
      }
    }

    return result;
  }

  /**
   * Estimate tokens for required categories.
   */
  estimateRequiredTokens(
    taskType: TaskType | string,
    tokenMap?: Record<ContextCategory, number>
  ): number {
    const config = this.get(taskType);
    return this.sumTokens(config.required, tokenMap);
  }

  /**
   * Estimate tokens for all categories (required + optional).
   */
  estimateTotalTokens(
    taskType: TaskType | string,
    tokenMap?: Record<ContextCategory, number>
  ): number {
    const config = this.get(taskType);
    const all = [...config.required, ...config.optional];
    return this.sumTokens(all, tokenMap);
  }

  /**
   * Get metadata for a context category.
   */
  getCategoryMetadata(category: ContextCategory): CategoryMetadata {
    return CATEGORY_METADATA[category];
  }

  /**
   * Sum tokens for a list of categories.
   */
  private sumTokens(
    categories: ContextCategory[],
    tokenMap?: Record<ContextCategory, number>
  ): number {
    return categories.reduce((sum, cat) => {
      const tokens = tokenMap?.[cat] ?? CATEGORY_METADATA[cat]?.typicalTokens ?? 500;
      return sum + tokens;
    }, 0);
  }
}

// Re-export types
export { ContextCategory, TaskType };
```

---

## Acceptance Criteria Checklist

- [ ] `TaskContextRegistry` class implemented
- [ ] All core task types have default configurations
- [ ] Required/optional/excluded categories defined per task
- [ ] Validation prevents invalid configurations
- [ ] `resolveCategories()` respects token budgets
- [ ] Custom task types can be registered
- [ ] Category metadata accessible
- [ ] Token estimation functions work correctly

---

## On Completion

```bash
pnpm test packages/core/src/context/__tests__/task-context-registry.test.ts
pnpm typecheck
cd tools/orchestrator && pnpm tsx src/cli.ts complete S2-A6
```
