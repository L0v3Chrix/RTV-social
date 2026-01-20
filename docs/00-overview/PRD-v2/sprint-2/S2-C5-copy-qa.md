# Build Prompt: S2-C5 — Copy QA Scoring

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-C5 |
| Sprint | 2 |
| Agent | C (Copy Generation) |
| Complexity | High |
| Status | pending |
| Estimated Files | 5 |
| Spec References | `agent-recursion-contracts.md`, `external-memory-schema.md` |

---

## Context

### What This Builds

The Copy QA Scoring system — an automated quality assessment framework that evaluates generated copy across multiple dimensions: tone alignment, length compliance, clarity, brand voice match, and platform appropriateness. This system gates copy before it reaches approval workflows.

### Why It Matters

Automated QA ensures consistent quality at scale:
- **Tone Alignment**: Verify copy matches brand voice characteristics
- **Length Compliance**: Ensure platform limits are respected
- **Clarity Metrics**: Assess readability and message clarity
- **Safety Checks**: Catch compliance issues before human review
- **Efficiency**: Reduce human review burden for obvious issues

### Architecture Decision

QA scoring uses a **multi-dimensional rubric approach**:
1. **Rule-based Checks**: Deterministic validations (length, required elements)
2. **LLM-based Scoring**: Subjective quality assessment (tone, clarity, persuasiveness)
3. **Threshold Gates**: Minimum scores required to proceed
4. **Detailed Feedback**: Specific improvement suggestions for failures

---

## Prerequisites

### Completed Tasks
- [x] S2-C1: Copy agent prompt system
- [x] S2-C2: Caption generation
- [x] S2-C3: CTA generation
- [x] S2-C4: Hook generation
- [x] S1-A2: BrandKit domain model

### Required Packages
```bash
pnpm add openai zod
pnpm add -D vitest
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests that define the expected behavior:

```typescript
// packages/agents/copy/src/qa/__tests__/copy-qa.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CopyQAScorer,
  QARequest,
  QAResult,
  QADimension,
  QAThresholds
} from '../copy-qa';
import { RuleBasedChecker } from '../rule-checker';
import { LLMQAScorer } from '../llm-scorer';

describe('CopyQAScorer', () => {
  let scorer: CopyQAScorer;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              toneAlignment: 0.85,
              clarity: 0.9,
              persuasiveness: 0.8,
              brandVoiceMatch: 0.88,
              feedback: 'Good overall quality'
            })
          }
        }]
      })
    };

    scorer = new CopyQAScorer({
      llmClient: mockLLMClient
    });
  });

  describe('full QA scoring', () => {
    it('should score copy across all dimensions', async () => {
      const request: QARequest = {
        copy: 'Transform your business with our proven system!',
        copyType: 'caption',
        platform: 'instagram',
        clientId: 'client-123'
      };

      const result = await scorer.score(request);

      expect(result.scores).toBeDefined();
      expect(result.scores.toneAlignment).toBeDefined();
      expect(result.scores.clarity).toBeDefined();
      expect(result.scores.lengthCompliance).toBeDefined();
      expect(result.passed).toBeDefined();
    });

    it('should calculate overall score', async () => {
      const result = await scorer.score({
        copy: 'Test copy',
        copyType: 'caption',
        platform: 'instagram',
        clientId: 'client-123'
      });

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('should provide pass/fail determination', async () => {
      const result = await scorer.score({
        copy: 'Good quality copy here',
        copyType: 'caption',
        platform: 'instagram',
        clientId: 'client-123'
      });

      expect(typeof result.passed).toBe('boolean');
    });
  });

  describe('threshold-based pass/fail', () => {
    it('should pass when all scores above thresholds', async () => {
      mockLLMClient.chat.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              toneAlignment: 0.9,
              clarity: 0.95,
              persuasiveness: 0.85,
              brandVoiceMatch: 0.92
            })
          }
        }]
      });

      const result = await scorer.score({
        copy: 'Excellent copy',
        copyType: 'caption',
        platform: 'instagram',
        clientId: 'client-123'
      });

      expect(result.passed).toBe(true);
    });

    it('should fail when critical dimension below threshold', async () => {
      mockLLMClient.chat.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              toneAlignment: 0.4, // Below threshold
              clarity: 0.95,
              persuasiveness: 0.85,
              brandVoiceMatch: 0.3 // Below threshold
            })
          }
        }]
      });

      const result = await scorer.score({
        copy: 'Off-brand copy',
        copyType: 'caption',
        platform: 'instagram',
        clientId: 'client-123'
      });

      expect(result.passed).toBe(false);
      expect(result.failureReasons).toContain('toneAlignment');
    });

    it('should use custom thresholds when provided', async () => {
      const result = await scorer.score({
        copy: 'Test copy',
        copyType: 'caption',
        platform: 'instagram',
        clientId: 'client-123',
        thresholds: {
          toneAlignment: 0.95,
          clarity: 0.95,
          persuasiveness: 0.95,
          brandVoiceMatch: 0.95,
          lengthCompliance: 1.0
        }
      });

      // With very high thresholds, likely to fail
      expect(result.thresholdsUsed.toneAlignment).toBe(0.95);
    });
  });

  describe('dimension-specific scoring', () => {
    it('should score tone alignment against brand voice', async () => {
      const result = await scorer.score({
        copy: 'Professional business content',
        copyType: 'caption',
        platform: 'linkedin',
        clientId: 'client-123',
        brandVoice: {
          tone: ['professional', 'authoritative'],
          personality: 'Expert business advisor'
        }
      });

      expect(result.scores.toneAlignment).toBeDefined();
      expect(result.dimensionFeedback?.toneAlignment).toBeDefined();
    });

    it('should score clarity and readability', async () => {
      const result = await scorer.score({
        copy: 'Simple and clear message',
        copyType: 'caption',
        platform: 'instagram',
        clientId: 'client-123'
      });

      expect(result.scores.clarity).toBeDefined();
    });

    it('should score persuasiveness for conversion copy', async () => {
      const result = await scorer.score({
        copy: 'Get started today!',
        copyType: 'cta',
        platform: 'instagram',
        clientId: 'client-123'
      });

      expect(result.scores.persuasiveness).toBeDefined();
    });

    it('should score length compliance', async () => {
      const result = await scorer.score({
        copy: 'X'.repeat(3000), // Over Instagram limit
        copyType: 'caption',
        platform: 'instagram',
        clientId: 'client-123'
      });

      expect(result.scores.lengthCompliance).toBeLessThan(1);
    });
  });

  describe('feedback generation', () => {
    it('should provide specific feedback for each dimension', async () => {
      const result = await scorer.score({
        copy: 'Test copy with issues',
        copyType: 'caption',
        platform: 'instagram',
        clientId: 'client-123'
      });

      expect(result.dimensionFeedback).toBeDefined();
    });

    it('should provide improvement suggestions', async () => {
      mockLLMClient.chat.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              toneAlignment: 0.5,
              clarity: 0.6,
              persuasiveness: 0.5,
              brandVoiceMatch: 0.4,
              feedback: 'Copy lacks energy and brand voice',
              suggestions: [
                'Add more action verbs',
                'Match brand tone better',
                'Clarify the main message'
              ]
            })
          }
        }]
      });

      const result = await scorer.score({
        copy: 'Bland generic copy',
        copyType: 'caption',
        platform: 'instagram',
        clientId: 'client-123'
      });

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });
  });
});

describe('RuleBasedChecker', () => {
  let checker: RuleBasedChecker;

  beforeEach(() => {
    checker = new RuleBasedChecker();
  });

  describe('length checks', () => {
    it('should pass when within platform limits', () => {
      const result = checker.checkLength('Short caption', 'instagram');
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1);
    });

    it('should fail when over platform limit', () => {
      const result = checker.checkLength('X'.repeat(2500), 'instagram');
      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(1);
    });

    it('should warn when close to limit', () => {
      const result = checker.checkLength('X'.repeat(2000), 'instagram');
      expect(result.warning).toBe(true);
    });

    it('should check X/Twitter 280 char limit', () => {
      const result = checker.checkLength('X'.repeat(300), 'x');
      expect(result.passed).toBe(false);
    });
  });

  describe('required elements', () => {
    it('should check for CTA in captions', () => {
      const result = checker.checkRequiredElements(
        'Great content without call to action',
        'caption',
        { requireCTA: true }
      );
      expect(result.missingElements).toContain('CTA');
    });

    it('should pass when CTA present', () => {
      const result = checker.checkRequiredElements(
        'Great content! Click the link in bio to learn more',
        'caption',
        { requireCTA: true }
      );
      expect(result.missingElements).not.toContain('CTA');
    });

    it('should check for hashtags on Instagram', () => {
      const result = checker.checkRequiredElements(
        'Caption without any hashtags',
        'caption',
        { requireHashtags: true, platform: 'instagram' }
      );
      expect(result.missingElements).toContain('hashtags');
    });
  });

  describe('prohibited content', () => {
    it('should flag prohibited words', () => {
      const result = checker.checkProhibited(
        'This is the BEST product, guaranteed results!',
        { prohibitedWords: ['best', 'guaranteed'] }
      );
      expect(result.violations).toContain('best');
      expect(result.violations).toContain('guaranteed');
    });

    it('should flag compliance issues', () => {
      const result = checker.checkProhibited(
        'You will make $10,000 in your first month',
        { complianceRules: ['no income claims'] }
      );
      expect(result.complianceViolations.length).toBeGreaterThan(0);
    });
  });

  describe('hashtag validation', () => {
    it('should count hashtags', () => {
      const result = checker.checkHashtags(
        'Caption #one #two #three',
        'instagram'
      );
      expect(result.count).toBe(3);
    });

    it('should flag too many hashtags for LinkedIn', () => {
      const result = checker.checkHashtags(
        'Post #a #b #c #d #e #f #g #h',
        'linkedin'
      );
      expect(result.tooMany).toBe(true);
    });
  });
});

describe('LLMQAScorer', () => {
  let llmScorer: LLMQAScorer;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              toneAlignment: 0.85,
              clarity: 0.9,
              persuasiveness: 0.8,
              brandVoiceMatch: 0.88,
              feedback: 'Good copy'
            })
          }
        }]
      })
    };

    llmScorer = new LLMQAScorer(mockLLMClient);
  });

  describe('LLM-based scoring', () => {
    it('should call LLM with copy and criteria', async () => {
      await llmScorer.score({
        copy: 'Test copy',
        copyType: 'caption',
        platform: 'instagram'
      });

      expect(mockLLMClient.chat).toHaveBeenCalled();
    });

    it('should include brand voice in scoring prompt', async () => {
      await llmScorer.score({
        copy: 'Test copy',
        copyType: 'caption',
        platform: 'instagram',
        brandVoice: {
          tone: ['professional'],
          personality: 'Expert advisor'
        }
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('professional');
    });

    it('should parse JSON response', async () => {
      const result = await llmScorer.score({
        copy: 'Test copy',
        copyType: 'caption',
        platform: 'instagram'
      });

      expect(result.toneAlignment).toBe(0.85);
      expect(result.clarity).toBe(0.9);
    });

    it('should handle malformed LLM response', async () => {
      mockLLMClient.chat.mockResolvedValue({
        choices: [{
          message: { content: 'not valid json' }
        }]
      });

      await expect(llmScorer.score({
        copy: 'Test',
        copyType: 'caption',
        platform: 'instagram'
      })).rejects.toThrow();
    });
  });
});

describe('QA Dimension Weights', () => {
  it('should weight tone more heavily for brand-sensitive copy', () => {
    const weights = CopyQAScorer.getWeights('caption', 'linkedin');
    expect(weights.toneAlignment).toBeGreaterThan(weights.persuasiveness);
  });

  it('should weight persuasiveness more for CTAs', () => {
    const weights = CopyQAScorer.getWeights('cta', 'instagram');
    expect(weights.persuasiveness).toBeGreaterThan(weights.clarity);
  });

  it('should weight clarity more for hooks', () => {
    const weights = CopyQAScorer.getWeights('hook', 'tiktok');
    expect(weights.clarity).toBeGreaterThanOrEqual(weights.toneAlignment);
  });
});
```

### Phase 2: Implementation

#### Step 1: Define QA Types

```typescript
// packages/agents/copy/src/qa/types.ts

import { z } from 'zod';
import { Platform, CopyType, BrandVoice } from '../prompts/types';

export const QADimensionSchema = z.enum([
  'toneAlignment',
  'clarity',
  'persuasiveness',
  'brandVoiceMatch',
  'lengthCompliance',
  'platformAppropriateness',
  'safetyCompliance'
]);

export type QADimension = z.infer<typeof QADimensionSchema>;

export interface QAScores {
  toneAlignment: number;      // 0-1: How well does tone match brand voice
  clarity: number;            // 0-1: How clear and readable is the copy
  persuasiveness: number;     // 0-1: How persuasive/engaging is the copy
  brandVoiceMatch: number;    // 0-1: Does it sound like the brand
  lengthCompliance: number;   // 0-1: Is length appropriate for platform
  platformAppropriateness?: number; // 0-1: Does it fit platform norms
  safetyCompliance?: number;  // 0-1: Does it pass safety/compliance checks
}

export interface QAThresholds {
  toneAlignment: number;
  clarity: number;
  persuasiveness: number;
  brandVoiceMatch: number;
  lengthCompliance: number;
  platformAppropriateness?: number;
  safetyCompliance?: number;
}

export interface QARequest {
  copy: string;
  copyType: CopyType;
  platform: Platform;
  clientId: string;
  brandVoice?: Partial<BrandVoice>;
  thresholds?: Partial<QAThresholds>;
  constraints?: {
    prohibitedWords?: string[];
    requiredElements?: string[];
    complianceRules?: string[];
  };
}

export interface QAResult {
  scores: QAScores;
  overallScore: number;
  passed: boolean;
  failureReasons: QADimension[];
  thresholdsUsed: QAThresholds;
  dimensionFeedback?: Record<QADimension, string>;
  suggestions?: string[];
  ruleViolations?: string[];
  generatedAt: string;
}

export interface DimensionWeights {
  toneAlignment: number;
  clarity: number;
  persuasiveness: number;
  brandVoiceMatch: number;
  lengthCompliance: number;
}

export interface RuleCheckResult {
  passed: boolean;
  score: number;
  warning?: boolean;
  message?: string;
}

export interface RequiredElementsResult {
  passed: boolean;
  missingElements: string[];
}

export interface ProhibitedCheckResult {
  passed: boolean;
  violations: string[];
  complianceViolations: string[];
}

export interface HashtagCheckResult {
  count: number;
  tooMany: boolean;
  tooFew: boolean;
  platformLimit: number;
}
```

#### Step 2: Implement Rule-Based Checker

```typescript
// packages/agents/copy/src/qa/rule-checker.ts

import { Platform, CopyType } from '../prompts/types';
import { getPlatformConfig } from '../prompts/platform-config';
import {
  RuleCheckResult,
  RequiredElementsResult,
  ProhibitedCheckResult,
  HashtagCheckResult
} from './types';

export class RuleBasedChecker {
  // CTA detection patterns
  private static ctaPatterns = [
    /link in bio/i,
    /click (the )?link/i,
    /tap (the )?link/i,
    /swipe up/i,
    /comment below/i,
    /follow for/i,
    /sign up/i,
    /get started/i,
    /learn more/i,
    /shop now/i,
    /book (a |your )?call/i,
    /dm (me|us)/i,
    /join (us|now)/i
  ];

  // Common compliance-triggering phrases
  private static compliancePatterns: Record<string, RegExp[]> = {
    'no income claims': [
      /you (will|can) (make|earn) \$?\d+/i,
      /guaranteed (income|results|returns)/i,
      /make \$?\d+ (per|a) (day|week|month)/i
    ],
    'no health claims': [
      /cure(s)? (your )?/i,
      /guaranteed (weight loss|health)/i,
      /medical breakthrough/i
    ]
  };

  checkLength(copy: string, platform: Platform): RuleCheckResult {
    const config = getPlatformConfig(platform);
    const length = copy.length;
    const limit = config.captionMaxLength;

    if (length > limit) {
      const overBy = length - limit;
      return {
        passed: false,
        score: Math.max(0, 1 - (overBy / limit)),
        message: `Copy exceeds ${platform} limit by ${overBy} characters`
      };
    }

    // Warning if within 10% of limit
    if (length > limit * 0.9) {
      return {
        passed: true,
        score: 0.9,
        warning: true,
        message: `Copy is within 10% of ${platform} character limit`
      };
    }

    return {
      passed: true,
      score: 1,
      message: 'Length is appropriate'
    };
  }

  checkRequiredElements(
    copy: string,
    copyType: CopyType,
    options: {
      requireCTA?: boolean;
      requireHashtags?: boolean;
      platform?: Platform;
      customRequired?: string[];
    }
  ): RequiredElementsResult {
    const missingElements: string[] = [];

    // Check for CTA
    if (options.requireCTA) {
      const hasCTA = RuleBasedChecker.ctaPatterns.some(pattern =>
        pattern.test(copy)
      );
      if (!hasCTA) {
        missingElements.push('CTA');
      }
    }

    // Check for hashtags
    if (options.requireHashtags) {
      const hasHashtags = /#\w+/.test(copy);
      if (!hasHashtags) {
        missingElements.push('hashtags');
      }
    }

    // Check custom required elements
    if (options.customRequired) {
      for (const element of options.customRequired) {
        if (!copy.toLowerCase().includes(element.toLowerCase())) {
          missingElements.push(element);
        }
      }
    }

    return {
      passed: missingElements.length === 0,
      missingElements
    };
  }

  checkProhibited(
    copy: string,
    options: {
      prohibitedWords?: string[];
      complianceRules?: string[];
    }
  ): ProhibitedCheckResult {
    const violations: string[] = [];
    const complianceViolations: string[] = [];
    const lowerCopy = copy.toLowerCase();

    // Check prohibited words
    if (options.prohibitedWords) {
      for (const word of options.prohibitedWords) {
        if (lowerCopy.includes(word.toLowerCase())) {
          violations.push(word);
        }
      }
    }

    // Check compliance rules
    if (options.complianceRules) {
      for (const rule of options.complianceRules) {
        const patterns = RuleBasedChecker.compliancePatterns[rule];
        if (patterns) {
          for (const pattern of patterns) {
            if (pattern.test(copy)) {
              complianceViolations.push(`Violation of "${rule}": ${pattern.source}`);
            }
          }
        }
      }
    }

    return {
      passed: violations.length === 0 && complianceViolations.length === 0,
      violations,
      complianceViolations
    };
  }

  checkHashtags(copy: string, platform: Platform): HashtagCheckResult {
    const config = getPlatformConfig(platform);
    const hashtags = copy.match(/#\w+/g) || [];
    const count = hashtags.length;
    const limit = config.hashtagLimit;

    // Platform-specific minimums
    const minHashtags: Partial<Record<Platform, number>> = {
      instagram: 3,
      tiktok: 2,
      linkedin: 1,
      x: 0,
      facebook: 0
    };

    const min = minHashtags[platform] || 0;

    return {
      count,
      tooMany: count > limit,
      tooFew: count < min && count > 0,
      platformLimit: limit
    };
  }

  checkAll(
    copy: string,
    copyType: CopyType,
    platform: Platform,
    options?: {
      requireCTA?: boolean;
      requireHashtags?: boolean;
      prohibitedWords?: string[];
      complianceRules?: string[];
    }
  ): {
    lengthResult: RuleCheckResult;
    elementsResult: RequiredElementsResult;
    prohibitedResult: ProhibitedCheckResult;
    hashtagResult: HashtagCheckResult;
    overallPassed: boolean;
  } {
    const lengthResult = this.checkLength(copy, platform);
    const elementsResult = this.checkRequiredElements(copy, copyType, {
      ...options,
      platform
    });
    const prohibitedResult = this.checkProhibited(copy, options || {});
    const hashtagResult = this.checkHashtags(copy, platform);

    const overallPassed = lengthResult.passed &&
      elementsResult.passed &&
      prohibitedResult.passed &&
      !hashtagResult.tooMany;

    return {
      lengthResult,
      elementsResult,
      prohibitedResult,
      hashtagResult,
      overallPassed
    };
  }
}
```

#### Step 3: Implement LLM-Based Scorer

```typescript
// packages/agents/copy/src/qa/llm-scorer.ts

import { Platform, CopyType, BrandVoice } from '../prompts/types';

interface LLMClient {
  chat(request: any): Promise<{ choices: Array<{ message: { content: string } }> }>;
}

export interface LLMScoreRequest {
  copy: string;
  copyType: CopyType;
  platform: Platform;
  brandVoice?: Partial<BrandVoice>;
}

export interface LLMScoreResult {
  toneAlignment: number;
  clarity: number;
  persuasiveness: number;
  brandVoiceMatch: number;
  feedback?: string;
  suggestions?: string[];
}

export class LLMQAScorer {
  constructor(private llmClient: LLMClient) {}

  async score(request: LLMScoreRequest): Promise<LLMScoreResult> {
    const systemPrompt = this.buildSystemPrompt(request);
    const userPrompt = this.buildUserPrompt(request);

    const response = await this.llmClient.chat({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3, // Lower for more consistent scoring
      max_tokens: 500
    });

    const content = response.choices[0].message.content;

    try {
      return JSON.parse(content);
    } catch (e) {
      throw new Error(`Failed to parse LLM QA response: ${content}`);
    }
  }

  private buildSystemPrompt(request: LLMScoreRequest): string {
    let prompt = `You are a copy quality assessor. Evaluate the provided social media copy and return a JSON object with scores from 0 to 1 for each dimension.

## Scoring Dimensions

### toneAlignment (0-1)
How well does the copy match the intended tone?
- 0.9-1.0: Perfect tone match
- 0.7-0.89: Good match with minor inconsistencies
- 0.5-0.69: Acceptable but could be improved
- Below 0.5: Tone mismatch

### clarity (0-1)
How clear and easy to understand is the copy?
- 0.9-1.0: Crystal clear, no ambiguity
- 0.7-0.89: Clear with minor complexity
- 0.5-0.69: Understandable but could be clearer
- Below 0.5: Confusing or unclear

### persuasiveness (0-1)
How compelling and action-driving is the copy?
- 0.9-1.0: Highly compelling, strong call to action
- 0.7-0.89: Good persuasion with room to improve
- 0.5-0.69: Mildly persuasive
- Below 0.5: Not persuasive

### brandVoiceMatch (0-1)
Does the copy sound authentically "on brand"?
- 0.9-1.0: Sounds exactly like the brand
- 0.7-0.89: Good brand alignment
- 0.5-0.69: Generic, could be any brand
- Below 0.5: Off-brand or contradicts voice

## Platform Context
Platform: ${request.platform}
Copy Type: ${request.copyType}
`;

    if (request.brandVoice) {
      prompt += `
## Brand Voice Reference
${request.brandVoice.tone ? `Tone: ${request.brandVoice.tone.join(', ')}` : ''}
${request.brandVoice.personality ? `Personality: ${request.brandVoice.personality}` : ''}
`;
    }

    prompt += `
## Response Format
Return ONLY valid JSON in this exact format:
{
  "toneAlignment": 0.85,
  "clarity": 0.9,
  "persuasiveness": 0.8,
  "brandVoiceMatch": 0.88,
  "feedback": "Brief overall assessment",
  "suggestions": ["Specific improvement 1", "Specific improvement 2"]
}
`;

    return prompt;
  }

  private buildUserPrompt(request: LLMScoreRequest): string {
    return `Score this ${request.copyType} for ${request.platform}:

"${request.copy}"`;
  }
}
```

#### Step 4: Implement Copy QA Scorer

```typescript
// packages/agents/copy/src/qa/copy-qa.ts

import {
  QARequest,
  QAResult,
  QAScores,
  QAThresholds,
  QADimension,
  DimensionWeights
} from './types';
import { Platform, CopyType } from '../prompts/types';
import { RuleBasedChecker } from './rule-checker';
import { LLMQAScorer } from './llm-scorer';

interface LLMClient {
  chat(request: any): Promise<{ choices: Array<{ message: { content: string } }> }>;
}

interface CopyQAScorerOptions {
  llmClient: LLMClient;
  brandVoiceLoader?: any;
}

const DEFAULT_THRESHOLDS: QAThresholds = {
  toneAlignment: 0.7,
  clarity: 0.7,
  persuasiveness: 0.6,
  brandVoiceMatch: 0.7,
  lengthCompliance: 0.8
};

export class CopyQAScorer {
  private llmScorer: LLMQAScorer;
  private ruleChecker: RuleBasedChecker;
  private brandVoiceLoader?: any;

  constructor(options: CopyQAScorerOptions) {
    this.llmScorer = new LLMQAScorer(options.llmClient);
    this.ruleChecker = new RuleBasedChecker();
    this.brandVoiceLoader = options.brandVoiceLoader;
  }

  async score(request: QARequest): Promise<QAResult> {
    // Load brand voice if not provided
    const brandVoice = request.brandVoice ||
      (this.brandVoiceLoader
        ? await this.brandVoiceLoader.loadForClient(request.clientId)
        : undefined);

    // Run rule-based checks
    const ruleResults = this.ruleChecker.checkAll(
      request.copy,
      request.copyType,
      request.platform,
      request.constraints
    );

    // Run LLM-based scoring
    const llmScores = await this.llmScorer.score({
      copy: request.copy,
      copyType: request.copyType,
      platform: request.platform,
      brandVoice
    });

    // Combine scores
    const scores: QAScores = {
      toneAlignment: llmScores.toneAlignment,
      clarity: llmScores.clarity,
      persuasiveness: llmScores.persuasiveness,
      brandVoiceMatch: llmScores.brandVoiceMatch,
      lengthCompliance: ruleResults.lengthResult.score,
      safetyCompliance: ruleResults.prohibitedResult.passed ? 1 : 0
    };

    // Get thresholds
    const thresholds: QAThresholds = {
      ...DEFAULT_THRESHOLDS,
      ...request.thresholds
    };

    // Determine failures
    const failureReasons: QADimension[] = [];

    if (scores.toneAlignment < thresholds.toneAlignment) {
      failureReasons.push('toneAlignment');
    }
    if (scores.clarity < thresholds.clarity) {
      failureReasons.push('clarity');
    }
    if (scores.persuasiveness < thresholds.persuasiveness) {
      failureReasons.push('persuasiveness');
    }
    if (scores.brandVoiceMatch < thresholds.brandVoiceMatch) {
      failureReasons.push('brandVoiceMatch');
    }
    if (scores.lengthCompliance < thresholds.lengthCompliance) {
      failureReasons.push('lengthCompliance');
    }
    if (scores.safetyCompliance !== undefined && scores.safetyCompliance < 1) {
      failureReasons.push('safetyCompliance');
    }

    // Calculate overall score
    const weights = CopyQAScorer.getWeights(request.copyType, request.platform);
    const overallScore = this.calculateOverallScore(scores, weights);

    // Compile rule violations
    const ruleViolations: string[] = [];
    if (!ruleResults.lengthResult.passed) {
      ruleViolations.push(ruleResults.lengthResult.message || 'Length violation');
    }
    ruleViolations.push(...ruleResults.prohibitedResult.violations.map(v => `Prohibited word: ${v}`));
    ruleViolations.push(...ruleResults.prohibitedResult.complianceViolations);
    ruleViolations.push(...ruleResults.elementsResult.missingElements.map(e => `Missing: ${e}`));

    return {
      scores,
      overallScore,
      passed: failureReasons.length === 0 && ruleResults.overallPassed,
      failureReasons,
      thresholdsUsed: thresholds,
      dimensionFeedback: this.buildDimensionFeedback(scores, llmScores.feedback),
      suggestions: llmScores.suggestions,
      ruleViolations: ruleViolations.length > 0 ? ruleViolations : undefined,
      generatedAt: new Date().toISOString()
    };
  }

  private calculateOverallScore(scores: QAScores, weights: DimensionWeights): number {
    const weightedSum =
      (scores.toneAlignment * weights.toneAlignment) +
      (scores.clarity * weights.clarity) +
      (scores.persuasiveness * weights.persuasiveness) +
      (scores.brandVoiceMatch * weights.brandVoiceMatch) +
      (scores.lengthCompliance * weights.lengthCompliance);

    const totalWeight =
      weights.toneAlignment +
      weights.clarity +
      weights.persuasiveness +
      weights.brandVoiceMatch +
      weights.lengthCompliance;

    return Math.round((weightedSum / totalWeight) * 100);
  }

  private buildDimensionFeedback(
    scores: QAScores,
    overallFeedback?: string
  ): Record<QADimension, string> {
    return {
      toneAlignment: this.getFeedbackForScore(scores.toneAlignment, 'tone alignment'),
      clarity: this.getFeedbackForScore(scores.clarity, 'clarity'),
      persuasiveness: this.getFeedbackForScore(scores.persuasiveness, 'persuasiveness'),
      brandVoiceMatch: this.getFeedbackForScore(scores.brandVoiceMatch, 'brand voice'),
      lengthCompliance: this.getFeedbackForScore(scores.lengthCompliance, 'length'),
      platformAppropriateness: 'Not evaluated',
      safetyCompliance: scores.safetyCompliance === 1
        ? 'No safety or compliance issues detected'
        : 'Potential compliance issues detected'
    };
  }

  private getFeedbackForScore(score: number, dimension: string): string {
    if (score >= 0.9) return `Excellent ${dimension}`;
    if (score >= 0.7) return `Good ${dimension}, minor improvements possible`;
    if (score >= 0.5) return `Acceptable ${dimension}, recommend revisions`;
    return `Poor ${dimension}, needs significant improvement`;
  }

  static getWeights(copyType: CopyType, platform: Platform): DimensionWeights {
    // Base weights
    const weights: DimensionWeights = {
      toneAlignment: 0.25,
      clarity: 0.25,
      persuasiveness: 0.2,
      brandVoiceMatch: 0.2,
      lengthCompliance: 0.1
    };

    // Adjust based on copy type
    switch (copyType) {
      case 'cta':
        weights.persuasiveness = 0.35;
        weights.clarity = 0.3;
        weights.toneAlignment = 0.15;
        weights.brandVoiceMatch = 0.1;
        break;
      case 'hook':
        weights.clarity = 0.3;
        weights.persuasiveness = 0.25;
        weights.toneAlignment = 0.2;
        break;
      case 'caption':
        // Keep defaults
        break;
      case 'bio':
        weights.brandVoiceMatch = 0.3;
        weights.clarity = 0.3;
        weights.persuasiveness = 0.15;
        break;
    }

    // Adjust based on platform
    switch (platform) {
      case 'linkedin':
        weights.toneAlignment += 0.1;
        weights.persuasiveness -= 0.1;
        break;
      case 'tiktok':
        weights.persuasiveness += 0.1;
        weights.toneAlignment -= 0.1;
        break;
    }

    return weights;
  }
}

export { RuleBasedChecker } from './rule-checker';
export { LLMQAScorer } from './llm-scorer';
```

#### Step 5: Create Package Exports

```typescript
// packages/agents/copy/src/qa/index.ts

export * from './types';
export * from './copy-qa';
export * from './rule-checker';
export * from './llm-scorer';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/agents/copy
pnpm test src/qa

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint src/qa
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/copy/src/qa/types.ts` | QA type definitions |
| Create | `packages/agents/copy/src/qa/rule-checker.ts` | Deterministic rule-based checks |
| Create | `packages/agents/copy/src/qa/llm-scorer.ts` | LLM-based quality scoring |
| Create | `packages/agents/copy/src/qa/copy-qa.ts` | Main QA orchestration |
| Create | `packages/agents/copy/src/qa/index.ts` | Package exports |
| Create | `packages/agents/copy/src/qa/__tests__/copy-qa.test.ts` | Comprehensive tests |

---

## Acceptance Criteria

- [ ] CopyQAScorer evaluates all dimensions
- [ ] Rule-based checks catch length, prohibited content, missing elements
- [ ] LLM-based scoring assesses subjective quality
- [ ] Thresholds configurable per dimension
- [ ] Pass/fail determination based on thresholds
- [ ] Dimension-specific feedback provided
- [ ] Improvement suggestions generated
- [ ] Weights adjust based on copy type and platform
- [ ] Tests pass with >90% coverage

---

## Test Requirements

### Unit Tests
- Full QA scoring
- Threshold-based pass/fail
- Dimension-specific scoring
- Rule-based checks (length, elements, prohibited)
- LLM scoring integration
- Weight calculation

### Integration Tests
- Complete QA pipeline
- Brand voice integration
- Multiple copy types

---

## Security & Safety Checklist

- [ ] Compliance rules enforced
- [ ] Prohibited content flagged
- [ ] No sensitive data in LLM prompts
- [ ] Audit logging for QA results
- [ ] Brand voice validated

---

## JSON Task Block

```json
{
  "task_id": "S2-C5",
  "name": "Copy QA Scoring",
  "status": "pending",
  "dependencies": ["S2-C1", "S2-C2", "S2-C3", "S2-C4"],
  "blocks": [],
  "agent": "C",
  "sprint": 2,
  "complexity": "high",
  "estimated_files": 5,
  "tdd_required": true,
  "spec_refs": [
    "docs/03-agents-tools/agent-recursion-contracts.md",
    "docs/02-schemas/external-memory-schema.md"
  ],
  "acceptance_checklist": [
    "multi_dimension_scoring",
    "rule_based_checks",
    "llm_based_scoring",
    "threshold_gates",
    "feedback_generation",
    "weight_system"
  ]
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "reads": [
    { "type": "brand_voice", "scope": "client" },
    { "type": "compliance_rules", "scope": "client" }
  ],
  "writes": [
    { "type": "qa_result", "scope": "content" }
  ],
  "context_window_at_completion": null,
  "continuation_hint": "QA results should integrate with approval workflow in Sprint 3"
}
```
