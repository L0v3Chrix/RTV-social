# S3-B8: Task Complexity Assessor

## Task Metadata

```json
{
  "task_id": "S3-B8",
  "name": "Task Complexity Assessor",
  "sprint": 3,
  "agent": "B",
  "status": "pending",
  "tests_status": "not_written",
  "dependencies": ["S3-B7", "S2-A6"],
  "blocks": ["S3-B9"],
  "estimated_complexity": "medium",
  "estimated_hours": 3,
  "spec_references": [
    "/docs/adr/ADR-0001-tesla-mixed-precision-patterns.md",
    "/docs/03-agents-tools/agent-recursion-contracts.md"
  ],
  "acceptance_criteria": [
    "ComplexityAssessor class with task analysis",
    "Complexity scoring algorithm (0-1 scale)",
    "Factor-based assessment (context, reasoning, creativity)",
    "Task type complexity baselines",
    "Historical complexity calibration",
    "Integration with TaskContextRegistry"
  ],
  "test_files": [
    "packages/api-client/src/__tests__/complexity-assessor.test.ts"
  ],
  "created_files": [
    "packages/api-client/src/model-tiers/complexity-assessor.ts",
    "packages/api-client/src/model-tiers/complexity-factors.ts"
  ]
}
```

---

## Context

The Complexity Assessor analyzes tasks to determine the appropriate model tier. This implements intelligent routing: simple tasks go to ECONOMY tier, complex tasks go to PREMIUM tier.

### Complexity Factors

| Factor | Description | Weight |
|--------|-------------|--------|
| **Context Size** | Amount of context needed | 0.2 |
| **Reasoning Depth** | Multi-step reasoning required | 0.3 |
| **Creative Demand** | Originality requirements | 0.2 |
| **Precision Need** | Accuracy requirements | 0.2 |
| **Domain Specificity** | Specialized knowledge needed | 0.1 |

---

## Pre-Implementation Checklist

- [ ] Read: `docs/adr/ADR-0001-tesla-mixed-precision-patterns.md`
- [ ] Verify S3-B7 (Model Tier Config) is complete
- [ ] Verify S2-A6 (Task Context Registry) is complete
- [ ] Review task type definitions

---

## TDD Methodology

### Phase 1: RED — Write Failing Tests First

Create `packages/api-client/src/__tests__/complexity-assessor.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ComplexityAssessor,
  ComplexityScore,
  ComplexityFactors,
  TaskComplexityInput
} from '../model-tiers/complexity-assessor';
import { TaskType } from '@rtv/core/context';
import { ModelTier } from '../model-tiers/config';

describe('S3-B8: Task Complexity Assessor', () => {
  let assessor: ComplexityAssessor;

  beforeEach(() => {
    assessor = new ComplexityAssessor();
  });

  describe('Complexity Scoring', () => {
    it('should return score between 0 and 1', async () => {
      const score = await assessor.assess({
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write a simple tweet'
      });

      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(1);
    });

    it('should return higher score for complex tasks', async () => {
      const simpleScore = await assessor.assess({
        taskType: TaskType.ENGAGE_COMMENT,
        contextTokens: 500,
        instructions: 'Say thank you'
      });

      const complexScore = await assessor.assess({
        taskType: TaskType.CREATE_POST,
        contextTokens: 8000,
        instructions: 'Create a comprehensive thread analyzing market trends with data-driven insights and actionable recommendations'
      });

      expect(complexScore.overall).toBeGreaterThan(simpleScore.overall);
    });

    it('should include factor breakdown', async () => {
      const score = await assessor.assess({
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write content'
      });

      expect(score.factors).toBeDefined();
      expect(score.factors.contextSize).toBeDefined();
      expect(score.factors.reasoningDepth).toBeDefined();
      expect(score.factors.creativeDemand).toBeDefined();
      expect(score.factors.precisionNeed).toBeDefined();
      expect(score.factors.domainSpecificity).toBeDefined();
    });
  });

  describe('Context Size Factor', () => {
    it('should increase with larger context', async () => {
      const smallContext = await assessor.assess({
        taskType: TaskType.ENGAGE_COMMENT,
        contextTokens: 500,
        instructions: 'Reply to comment'
      });

      const largeContext = await assessor.assess({
        taskType: TaskType.ENGAGE_COMMENT,
        contextTokens: 10000,
        instructions: 'Reply to comment'
      });

      expect(largeContext.factors.contextSize).toBeGreaterThan(smallContext.factors.contextSize);
    });

    it('should cap at maximum context threshold', async () => {
      const huge = await assessor.assess({
        taskType: TaskType.ANALYZE,
        contextTokens: 100000,
        instructions: 'Analyze'
      });

      const huger = await assessor.assess({
        taskType: TaskType.ANALYZE,
        contextTokens: 200000,
        instructions: 'Analyze'
      });

      // Both should be at max (1.0) for context factor
      expect(huge.factors.contextSize).toBe(huger.factors.contextSize);
    });
  });

  describe('Reasoning Depth Factor', () => {
    it('should detect multi-step reasoning requirements', async () => {
      const simple = await assessor.assess({
        taskType: TaskType.ENGAGE_COMMENT,
        contextTokens: 1000,
        instructions: 'Like the post'
      });

      const complex = await assessor.assess({
        taskType: TaskType.ANALYZE,
        contextTokens: 1000,
        instructions: 'Compare performance across platforms, identify trends, correlate with campaign timing, and recommend optimizations'
      });

      expect(complex.factors.reasoningDepth).toBeGreaterThan(simple.factors.reasoningDepth);
    });

    it('should detect reasoning keywords', async () => {
      const score = await assessor.assess({
        taskType: TaskType.CREATE_POST,
        contextTokens: 1000,
        instructions: 'Analyze the data, compare options, evaluate tradeoffs, and synthesize recommendations'
      });

      expect(score.factors.reasoningDepth).toBeGreaterThan(0.5);
    });
  });

  describe('Creative Demand Factor', () => {
    it('should be high for content creation', async () => {
      const creation = await assessor.assess({
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Create an engaging viral post'
      });

      const scheduling = await assessor.assess({
        taskType: TaskType.SCHEDULE,
        contextTokens: 2000,
        instructions: 'Schedule the post'
      });

      expect(creation.factors.creativeDemand).toBeGreaterThan(scheduling.factors.creativeDemand);
    });

    it('should detect creativity keywords', async () => {
      const score = await assessor.assess({
        taskType: TaskType.CREATE_POST,
        contextTokens: 1000,
        instructions: 'Create something unique, innovative, and original that will capture attention'
      });

      expect(score.factors.creativeDemand).toBeGreaterThan(0.7);
    });
  });

  describe('Task Type Baselines', () => {
    it('should have baseline for CREATE_POST', () => {
      const baseline = assessor.getTaskBaseline(TaskType.CREATE_POST);
      
      expect(baseline).toBeDefined();
      expect(baseline.creativeDemand).toBeGreaterThan(0.5);
    });

    it('should have baseline for ENGAGE_COMMENT', () => {
      const baseline = assessor.getTaskBaseline(TaskType.ENGAGE_COMMENT);
      
      expect(baseline).toBeDefined();
      expect(baseline.creativeDemand).toBeLessThan(0.5);
    });

    it('should have baseline for ANALYZE', () => {
      const baseline = assessor.getTaskBaseline(TaskType.ANALYZE);
      
      expect(baseline).toBeDefined();
      expect(baseline.reasoningDepth).toBeGreaterThan(0.5);
    });

    it('should have baseline for MODERATE', () => {
      const baseline = assessor.getTaskBaseline(TaskType.MODERATE);
      
      expect(baseline).toBeDefined();
      expect(baseline.precisionNeed).toBeGreaterThan(0.5);
    });
  });

  describe('Tier Mapping', () => {
    it('should map high complexity to PREMIUM', async () => {
      const score = await assessor.assess({
        taskType: TaskType.CREATE_POST,
        contextTokens: 10000,
        instructions: 'Create a comprehensive multi-part analysis with creative insights'
      });

      const tier = assessor.scoreToTier(score.overall);
      expect(tier).toBe(ModelTier.PREMIUM);
    });

    it('should map medium complexity to STANDARD', async () => {
      const score = await assessor.assess({
        taskType: TaskType.CREATE_POST,
        contextTokens: 3000,
        instructions: 'Write a promotional post'
      });

      const tier = assessor.scoreToTier(score.overall);
      expect(tier).toBe(ModelTier.STANDARD);
    });

    it('should map low complexity to ECONOMY', async () => {
      const score = await assessor.assess({
        taskType: TaskType.ENGAGE_COMMENT,
        contextTokens: 500,
        instructions: 'Say thanks'
      });

      const tier = assessor.scoreToTier(score.overall);
      expect(tier).toBe(ModelTier.ECONOMY);
    });

    it('should allow custom tier thresholds', () => {
      const customAssessor = new ComplexityAssessor({
        tierThresholds: {
          premium: 0.8,   // Higher bar for premium
          standard: 0.4   // Lower bar for standard
        }
      });

      // Score of 0.7 would be PREMIUM with default, but STANDARD with custom
      expect(customAssessor.scoreToTier(0.7)).toBe(ModelTier.STANDARD);
    });
  });

  describe('Historical Calibration', () => {
    it('should accept historical data for calibration', () => {
      assessor.calibrate([
        { taskType: TaskType.CREATE_POST, actualTier: ModelTier.PREMIUM, features: { tokens: 8000 } },
        { taskType: TaskType.CREATE_POST, actualTier: ModelTier.STANDARD, features: { tokens: 2000 } },
        { taskType: TaskType.ENGAGE_COMMENT, actualTier: ModelTier.ECONOMY, features: { tokens: 500 } }
      ]);

      // After calibration, assessments should be more accurate
      // (Implementation detail: weights may be adjusted)
    });

    it('should track assessment accuracy', async () => {
      // Record some assessments
      await assessor.assess({
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write post',
        trackingId: 'track-1'
      });

      // Later, record actual outcome
      assessor.recordOutcome('track-1', {
        actualTier: ModelTier.STANDARD,
        success: true,
        qualityScore: 0.8
      });

      const accuracy = assessor.getAccuracyMetrics();
      expect(accuracy).toBeDefined();
    });
  });

  describe('Confidence Scoring', () => {
    it('should include confidence in assessment', async () => {
      const score = await assessor.assess({
        taskType: TaskType.CREATE_POST,
        contextTokens: 2000,
        instructions: 'Write a post'
      });

      expect(score.confidence).toBeDefined();
      expect(score.confidence).toBeGreaterThanOrEqual(0);
      expect(score.confidence).toBeLessThanOrEqual(1);
    });

    it('should have higher confidence for clear-cut cases', async () => {
      const clearCut = await assessor.assess({
        taskType: TaskType.ENGAGE_COMMENT,
        contextTokens: 100,
        instructions: 'Like'
      });

      const ambiguous = await assessor.assess({
        taskType: TaskType.CREATE_POST,
        contextTokens: 4000,
        instructions: 'Write something'
      });

      expect(clearCut.confidence).toBeGreaterThan(ambiguous.confidence);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty instructions', async () => {
      const score = await assessor.assess({
        taskType: TaskType.CREATE_POST,
        contextTokens: 1000,
        instructions: ''
      });

      expect(score.overall).toBeDefined();
    });

    it('should handle zero context tokens', async () => {
      const score = await assessor.assess({
        taskType: TaskType.ENGAGE_COMMENT,
        contextTokens: 0,
        instructions: 'Simple reply'
      });

      expect(score.factors.contextSize).toBe(0);
    });

    it('should handle unknown task types', async () => {
      const score = await assessor.assess({
        taskType: 'unknown_task' as TaskType,
        contextTokens: 1000,
        instructions: 'Do something'
      });

      // Should fall back to generic assessment
      expect(score.overall).toBeDefined();
    });
  });

  describe('Batch Assessment', () => {
    it('should assess multiple tasks efficiently', async () => {
      const tasks: TaskComplexityInput[] = [
        { taskType: TaskType.CREATE_POST, contextTokens: 2000, instructions: 'Write post 1' },
        { taskType: TaskType.CREATE_POST, contextTokens: 3000, instructions: 'Write post 2' },
        { taskType: TaskType.ENGAGE_COMMENT, contextTokens: 500, instructions: 'Reply' }
      ];

      const scores = await assessor.assessBatch(tasks);

      expect(scores).toHaveLength(3);
      expect(scores.every(s => s.overall >= 0 && s.overall <= 1)).toBe(true);
    });
  });
});
```

---

### Phase 2: GREEN — Implement Minimum Code

Create `packages/api-client/src/model-tiers/complexity-assessor.ts`:

```typescript
import { TaskType } from '@rtv/core/context';
import { ModelTier } from './config';

/**
 * Input for complexity assessment.
 */
export interface TaskComplexityInput {
  taskType: TaskType | string;
  contextTokens: number;
  instructions: string;
  trackingId?: string;
  metadata?: Record<string, any>;
}

/**
 * Individual complexity factors (0-1 scale).
 */
export interface ComplexityFactors {
  contextSize: number;
  reasoningDepth: number;
  creativeDemand: number;
  precisionNeed: number;
  domainSpecificity: number;
}

/**
 * Complete complexity score.
 */
export interface ComplexityScore {
  overall: number;
  factors: ComplexityFactors;
  confidence: number;
  recommendedTier: ModelTier;
  reasoning: string;
}

/**
 * Configuration for ComplexityAssessor.
 */
export interface ComplexityAssessorConfig {
  tierThresholds?: {
    premium: number;
    standard: number;
  };
  factorWeights?: Partial<ComplexityFactors>;
}

/**
 * Calibration data point.
 */
export interface CalibrationData {
  taskType: TaskType | string;
  actualTier: ModelTier;
  features: Record<string, any>;
}

/**
 * Outcome recording for accuracy tracking.
 */
export interface OutcomeRecord {
  actualTier: ModelTier;
  success: boolean;
  qualityScore: number;
}

// Reasoning keywords that indicate complex thinking
const REASONING_KEYWORDS = [
  'analyze', 'compare', 'evaluate', 'synthesize', 'correlate',
  'identify', 'recommend', 'explain', 'justify', 'differentiate',
  'contrast', 'assess', 'determine', 'calculate', 'derive'
];

// Creativity keywords
const CREATIVITY_KEYWORDS = [
  'create', 'unique', 'innovative', 'original', 'creative',
  'engaging', 'viral', 'compelling', 'captivating', 'fresh',
  'novel', 'imaginative', 'inventive'
];

// Task type baselines
const TASK_BASELINES: Record<string, ComplexityFactors> = {
  [TaskType.CREATE_POST]: {
    contextSize: 0.4,
    reasoningDepth: 0.4,
    creativeDemand: 0.7,
    precisionNeed: 0.3,
    domainSpecificity: 0.3
  },
  [TaskType.CREATE_STORY]: {
    contextSize: 0.3,
    reasoningDepth: 0.3,
    creativeDemand: 0.8,
    precisionNeed: 0.2,
    domainSpecificity: 0.2
  },
  [TaskType.CREATE_REEL]: {
    contextSize: 0.4,
    reasoningDepth: 0.4,
    creativeDemand: 0.8,
    precisionNeed: 0.3,
    domainSpecificity: 0.3
  },
  [TaskType.ENGAGE_COMMENT]: {
    contextSize: 0.3,
    reasoningDepth: 0.2,
    creativeDemand: 0.3,
    precisionNeed: 0.4,
    domainSpecificity: 0.2
  },
  [TaskType.ENGAGE_DM]: {
    contextSize: 0.5,
    reasoningDepth: 0.4,
    creativeDemand: 0.4,
    precisionNeed: 0.5,
    domainSpecificity: 0.3
  },
  [TaskType.ENGAGE_MENTION]: {
    contextSize: 0.3,
    reasoningDepth: 0.2,
    creativeDemand: 0.3,
    precisionNeed: 0.4,
    domainSpecificity: 0.2
  },
  [TaskType.SCHEDULE]: {
    contextSize: 0.3,
    reasoningDepth: 0.2,
    creativeDemand: 0.1,
    precisionNeed: 0.6,
    domainSpecificity: 0.2
  },
  [TaskType.ANALYZE]: {
    contextSize: 0.6,
    reasoningDepth: 0.8,
    creativeDemand: 0.2,
    precisionNeed: 0.7,
    domainSpecificity: 0.5
  },
  [TaskType.REPORT]: {
    contextSize: 0.7,
    reasoningDepth: 0.6,
    creativeDemand: 0.3,
    precisionNeed: 0.8,
    domainSpecificity: 0.4
  },
  [TaskType.MODERATE]: {
    contextSize: 0.3,
    reasoningDepth: 0.5,
    creativeDemand: 0.1,
    precisionNeed: 0.9,
    domainSpecificity: 0.4
  },
  [TaskType.REVIEW]: {
    contextSize: 0.4,
    reasoningDepth: 0.5,
    creativeDemand: 0.1,
    precisionNeed: 0.8,
    domainSpecificity: 0.4
  }
};

// Default factor weights
const DEFAULT_WEIGHTS: ComplexityFactors = {
  contextSize: 0.2,
  reasoningDepth: 0.3,
  creativeDemand: 0.2,
  precisionNeed: 0.2,
  domainSpecificity: 0.1
};

// Default tier thresholds
const DEFAULT_THRESHOLDS = {
  premium: 0.7,
  standard: 0.4
};

/**
 * Task Complexity Assessor
 * 
 * Analyzes tasks to determine appropriate model tier based on
 * multiple complexity factors.
 */
export class ComplexityAssessor {
  private tierThresholds: { premium: number; standard: number };
  private factorWeights: ComplexityFactors;
  private assessmentHistory: Map<string, { score: ComplexityScore; input: TaskComplexityInput }> = new Map();
  private outcomeHistory: Map<string, OutcomeRecord> = new Map();

  constructor(config?: ComplexityAssessorConfig) {
    this.tierThresholds = config?.tierThresholds ?? DEFAULT_THRESHOLDS;
    this.factorWeights = { ...DEFAULT_WEIGHTS, ...config?.factorWeights };
  }

  /**
   * Assess complexity of a single task.
   */
  async assess(input: TaskComplexityInput): Promise<ComplexityScore> {
    const factors = this.calculateFactors(input);
    const overall = this.calculateOverall(factors);
    const confidence = this.calculateConfidence(factors, overall);
    const recommendedTier = this.scoreToTier(overall);

    const score: ComplexityScore = {
      overall,
      factors,
      confidence,
      recommendedTier,
      reasoning: this.generateReasoning(factors, recommendedTier)
    };

    // Track if tracking ID provided
    if (input.trackingId) {
      this.assessmentHistory.set(input.trackingId, { score, input });
    }

    return score;
  }

  /**
   * Assess multiple tasks in batch.
   */
  async assessBatch(inputs: TaskComplexityInput[]): Promise<ComplexityScore[]> {
    return Promise.all(inputs.map(input => this.assess(input)));
  }

  /**
   * Calculate individual complexity factors.
   */
  private calculateFactors(input: TaskComplexityInput): ComplexityFactors {
    const baseline = this.getTaskBaseline(input.taskType);
    const instructionLower = input.instructions.toLowerCase();

    // Context size factor (0-1 based on token count)
    // 0 tokens = 0, 50k+ tokens = 1
    const contextSize = Math.min(1, input.contextTokens / 50000);

    // Reasoning depth (baseline + keyword detection)
    const reasoningKeywordCount = REASONING_KEYWORDS.filter(
      kw => instructionLower.includes(kw)
    ).length;
    const reasoningBoost = Math.min(0.3, reasoningKeywordCount * 0.05);
    const reasoningDepth = Math.min(1, baseline.reasoningDepth + reasoningBoost);

    // Creative demand (baseline + keyword detection)
    const creativityKeywordCount = CREATIVITY_KEYWORDS.filter(
      kw => instructionLower.includes(kw)
    ).length;
    const creativityBoost = Math.min(0.3, creativityKeywordCount * 0.05);
    const creativeDemand = Math.min(1, baseline.creativeDemand + creativityBoost);

    // Precision need (from baseline, boosted by instruction length)
    const lengthBoost = Math.min(0.2, input.instructions.length / 500 * 0.1);
    const precisionNeed = Math.min(1, baseline.precisionNeed + lengthBoost);

    // Domain specificity (from baseline)
    const domainSpecificity = baseline.domainSpecificity;

    return {
      contextSize,
      reasoningDepth,
      creativeDemand,
      precisionNeed,
      domainSpecificity
    };
  }

  /**
   * Calculate overall score from factors.
   */
  private calculateOverall(factors: ComplexityFactors): number {
    return (
      factors.contextSize * this.factorWeights.contextSize +
      factors.reasoningDepth * this.factorWeights.reasoningDepth +
      factors.creativeDemand * this.factorWeights.creativeDemand +
      factors.precisionNeed * this.factorWeights.precisionNeed +
      factors.domainSpecificity * this.factorWeights.domainSpecificity
    );
  }

  /**
   * Calculate confidence in the assessment.
   */
  private calculateConfidence(factors: ComplexityFactors, overall: number): number {
    // High confidence when factors are consistent (all high or all low)
    const values = Object.values(factors);
    const variance = this.calculateVariance(values);
    
    // Low variance = high confidence
    // Also, extreme scores (very high or very low) are more confident
    const extremity = Math.abs(overall - 0.5) * 2;
    
    return Math.max(0, Math.min(1, (1 - variance) * 0.7 + extremity * 0.3));
  }

  /**
   * Calculate variance of values.
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Generate reasoning explanation.
   */
  private generateReasoning(factors: ComplexityFactors, tier: ModelTier): string {
    const parts: string[] = [];

    if (factors.contextSize > 0.5) {
      parts.push('large context window needed');
    }
    if (factors.reasoningDepth > 0.5) {
      parts.push('complex reasoning required');
    }
    if (factors.creativeDemand > 0.5) {
      parts.push('high creative output expected');
    }
    if (factors.precisionNeed > 0.5) {
      parts.push('high precision required');
    }

    if (parts.length === 0) {
      parts.push('straightforward task');
    }

    return `${tier.toUpperCase()} tier recommended: ${parts.join(', ')}`;
  }

  /**
   * Get baseline complexity for a task type.
   */
  getTaskBaseline(taskType: TaskType | string): ComplexityFactors {
    return TASK_BASELINES[taskType] ?? {
      contextSize: 0.5,
      reasoningDepth: 0.5,
      creativeDemand: 0.5,
      precisionNeed: 0.5,
      domainSpecificity: 0.5
    };
  }

  /**
   * Convert score to tier.
   */
  scoreToTier(score: number): ModelTier {
    if (score >= this.tierThresholds.premium) {
      return ModelTier.PREMIUM;
    }
    if (score >= this.tierThresholds.standard) {
      return ModelTier.STANDARD;
    }
    return ModelTier.ECONOMY;
  }

  /**
   * Calibrate assessor with historical data.
   */
  calibrate(data: CalibrationData[]): void {
    // Future enhancement: adjust weights based on historical accuracy
    console.log(`Calibrating with ${data.length} data points`);
  }

  /**
   * Record actual outcome for accuracy tracking.
   */
  recordOutcome(trackingId: string, outcome: OutcomeRecord): void {
    this.outcomeHistory.set(trackingId, outcome);
  }

  /**
   * Get accuracy metrics.
   */
  getAccuracyMetrics(): {
    totalAssessments: number;
    recordedOutcomes: number;
    accuracy: number;
  } {
    let correct = 0;
    let total = 0;

    for (const [id, outcome] of this.outcomeHistory) {
      const assessment = this.assessmentHistory.get(id);
      if (assessment) {
        total++;
        if (assessment.score.recommendedTier === outcome.actualTier) {
          correct++;
        }
      }
    }

    return {
      totalAssessments: this.assessmentHistory.size,
      recordedOutcomes: this.outcomeHistory.size,
      accuracy: total > 0 ? correct / total : 0
    };
  }
}
```

---

## Acceptance Criteria Checklist

- [ ] `ComplexityAssessor` class implemented
- [ ] Scores returned on 0-1 scale
- [ ] All five factors calculated correctly
- [ ] Task type baselines defined
- [ ] `scoreToTier()` maps scores to tiers
- [ ] Custom thresholds supported
- [ ] Calibration API available
- [ ] Accuracy tracking implemented
- [ ] Confidence scoring works
- [ ] Batch assessment supported

---

## On Completion

```bash
pnpm test packages/api-client/src/__tests__/complexity-assessor.test.ts
pnpm typecheck
cd tools/orchestrator && pnpm tsx src/cli.ts complete S3-B8
```
