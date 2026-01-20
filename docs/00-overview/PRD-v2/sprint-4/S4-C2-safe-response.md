# Build Prompt: S4-C2 — Safe Response Generation

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S4-C2 |
| Sprint | 4 — Engagement |
| Agent | C — Reply Drafting Agent |
| Complexity | High |
| Status | Pending |
| Estimated Effort | 1.5 days |
| Dependencies | S4-C1, S4-B3 |
| Blocks | S4-C4, S4-C5, S4-D1 |

---

## Context

### What We're Building
A safety layer for response generation that validates drafts before they can be approved. Checks for tone consistency, forbidden content, sensitive topics, and brand guideline compliance. Flags responses that need human review.

### Why It Matters
- **Brand Protection**: Prevent off-brand responses
- **Risk Mitigation**: Catch problematic content before approval
- **Compliance**: Enforce content policies
- **Quality Assurance**: Consistent response quality
- **Human Oversight**: Flag uncertain cases for review

### Spec References
- `docs/05-policy-safety/compliance-requirements.md` — Content policies
- `docs/03-agents-tools/agent-recursion-contracts.md` — Safety contracts
- `docs/01-architecture/system-architecture-v3.md` — Kill switches

---

## Prerequisites

### Completed Tasks
- [x] S4-C1: Reply Agent Prompt System
- [x] S4-B3: Participant Tracking

---

## Instructions

### Phase 1: Test First (TDD)

```typescript
// packages/agents/reply/src/__tests__/response-safety.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ResponseSafetyChecker,
  SafetyCheckResult,
  SafetyViolation,
  ToneAnalysis,
} from '../response-safety';
import { BrandVoice } from '../reply-prompt-builder';

describe('ResponseSafetyChecker', () => {
  let checker: ResponseSafetyChecker;

  beforeEach(() => {
    checker = new ResponseSafetyChecker({
      strictMode: false,
    });
  });

  describe('checkResponse', () => {
    it('should pass safe responses', async () => {
      const result = await checker.checkResponse({
        draft: 'Thank you for reaching out! We appreciate your feedback.',
        brandVoice: { tone: 'friendly' },
        platform: 'facebook',
      });

      expect(result.safe).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should flag responses with profanity', async () => {
      const result = await checker.checkResponse({
        draft: 'What the hell are you talking about?',
        brandVoice: { tone: 'professional' },
        platform: 'linkedin',
      });

      expect(result.safe).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'profanity',
          severity: 'high',
        })
      );
    });

    it('should flag responses with promises', async () => {
      const result = await checker.checkResponse({
        draft: 'I guarantee we will refund your money within 24 hours.',
        brandVoice: { tone: 'helpful' },
        platform: 'facebook',
      });

      expect(result.safe).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'unauthorized_promise',
          message: expect.stringContaining('guarantee'),
        })
      );
    });

    it('should flag responses with personal information requests', async () => {
      const result = await checker.checkResponse({
        draft: 'Please send us your social security number so we can verify.',
        brandVoice: { tone: 'professional' },
        platform: 'instagram',
      });

      expect(result.safe).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'pii_request',
          severity: 'critical',
        })
      );
    });

    it('should flag responses mentioning competitors', async () => {
      checker = new ResponseSafetyChecker({
        competitors: ['CompetitorA', 'CompetitorB'],
      });

      const result = await checker.checkResponse({
        draft: 'Unlike CompetitorA, we actually care about our customers.',
        brandVoice: { tone: 'friendly' },
        platform: 'x',
      });

      expect(result.safe).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'competitor_mention',
        })
      );
    });

    it('should flag responses exceeding platform character limit', async () => {
      const longResponse = 'A'.repeat(300);

      const result = await checker.checkResponse({
        draft: longResponse,
        brandVoice: { tone: 'friendly' },
        platform: 'x', // 280 char limit
      });

      expect(result.safe).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'length_exceeded',
          message: expect.stringContaining('280'),
        })
      );
    });

    it('should flag sarcastic tone in professional context', async () => {
      const result = await checker.checkResponse({
        draft: 'Oh wow, what a completely original complaint. Never heard that before.',
        brandVoice: { tone: 'professional' },
        platform: 'linkedin',
      });

      expect(result.safe).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'tone_mismatch',
        })
      );
    });
  });

  describe('analyzeTone', () => {
    it('should detect friendly tone', async () => {
      const analysis = await checker.analyzeTone(
        'Thanks so much for your message! We really appreciate you 😊'
      );

      expect(analysis.detectedTone).toBe('friendly');
      expect(analysis.confidence).toBeGreaterThan(0.7);
    });

    it('should detect professional tone', async () => {
      const analysis = await checker.analyzeTone(
        'Thank you for bringing this to our attention. We will investigate and follow up.'
      );

      expect(analysis.detectedTone).toBe('professional');
    });

    it('should detect negative tone', async () => {
      const analysis = await checker.analyzeTone(
        'That is not our problem. You should have read the terms.'
      );

      expect(analysis.detectedTone).toBe('dismissive');
      expect(analysis.flags).toContain('potentially_negative');
    });
  });

  describe('checkBrandGuidelines', () => {
    it('should pass when using approved words', async () => {
      const brandVoice: BrandVoice = {
        tone: 'friendly',
        doWords: ['appreciate', 'happy', 'help'],
        dontWords: ['unfortunately', 'cannot', 'policy'],
      };

      const result = await checker.checkBrandGuidelines(
        'We appreciate you reaching out and are happy to help!',
        brandVoice
      );

      expect(result.compliant).toBe(true);
    });

    it('should flag when using forbidden words', async () => {
      const brandVoice: BrandVoice = {
        tone: 'friendly',
        dontWords: ['unfortunately', 'cannot', 'policy'],
      };

      const result = await checker.checkBrandGuidelines(
        'Unfortunately, our policy states that we cannot help with this.',
        brandVoice
      );

      expect(result.compliant).toBe(false);
      expect(result.forbiddenWordsUsed).toContain('unfortunately');
      expect(result.forbiddenWordsUsed).toContain('policy');
      expect(result.forbiddenWordsUsed).toContain('cannot');
    });
  });

  describe('checkSensitiveTopics', () => {
    it('should flag legal language', async () => {
      const result = await checker.checkSensitiveTopics(
        'This is not legal advice, but you could sue for damages.'
      );

      expect(result.hasSensitiveContent).toBe(true);
      expect(result.topics).toContain('legal');
    });

    it('should flag medical language', async () => {
      const result = await checker.checkSensitiveTopics(
        'This supplement will cure your headaches and improve your health.'
      );

      expect(result.hasSensitiveContent).toBe(true);
      expect(result.topics).toContain('medical_claims');
    });

    it('should flag political content', async () => {
      const result = await checker.checkSensitiveTopics(
        'We support the current administration and their policies.'
      );

      expect(result.hasSensitiveContent).toBe(true);
      expect(result.topics).toContain('political');
    });
  });

  describe('getSuggestedRevisions', () => {
    it('should suggest removing profanity', async () => {
      const suggestions = await checker.getSuggestedRevisions(
        'That is damn frustrating, we understand.',
        [{ type: 'profanity', word: 'damn', severity: 'medium' }]
      );

      expect(suggestions).toContain(
        expect.stringContaining('really')
      );
    });

    it('should suggest softening promises', async () => {
      const suggestions = await checker.getSuggestedRevisions(
        'We guarantee this will be fixed.',
        [{ type: 'unauthorized_promise', word: 'guarantee' }]
      );

      expect(suggestions[0]).toContain('aim to');
    });
  });

  describe('requiresHumanReview', () => {
    it('should require review for critical violations', async () => {
      const result: SafetyCheckResult = {
        safe: false,
        violations: [{ type: 'pii_request', severity: 'critical' }],
        requiresHumanReview: true,
      };

      expect(checker.requiresHumanReview(result)).toBe(true);
    });

    it('should not require review for auto-fixable issues', async () => {
      const result: SafetyCheckResult = {
        safe: false,
        violations: [{ type: 'length_exceeded', severity: 'low', autoFixable: true }],
        requiresHumanReview: false,
      };

      expect(checker.requiresHumanReview(result)).toBe(false);
    });
  });
});
```

### Phase 2: Implementation

```typescript
// packages/agents/reply/src/response-safety.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { BrandVoice } from './reply-prompt-builder';
import { Platform } from '@rtv/core';

const tracer = trace.getTracer('response-safety');

export interface SafetyViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message?: string;
  word?: string;
  autoFixable?: boolean;
  suggestedFix?: string;
}

export interface SafetyCheckResult {
  safe: boolean;
  violations: SafetyViolation[];
  requiresHumanReview: boolean;
  toneAnalysis?: ToneAnalysis;
  brandCompliance?: BrandComplianceResult;
  suggestions?: string[];
}

export interface ToneAnalysis {
  detectedTone: string;
  confidence: number;
  flags: string[];
}

export interface BrandComplianceResult {
  compliant: boolean;
  forbiddenWordsUsed: string[];
  missingPreferredWords: string[];
}

export interface SensitiveTopicResult {
  hasSensitiveContent: boolean;
  topics: string[];
}

const PLATFORM_LIMITS: Record<string, number> = {
  facebook: 8000,
  instagram: 2200,
  tiktok: 150,
  youtube: 10000,
  linkedin: 1300,
  x: 280,
  skool: 5000,
};

const PROFANITY_LIST = [
  'damn', 'hell', 'crap', 'ass', 'shit', 'fuck', 'bitch',
  // Add more as needed
];

const PROMISE_WORDS = [
  'guarantee', 'promise', 'definitely', 'certainly', 'absolutely',
  'will refund', 'will fix', 'will resolve', '100%', 'for sure',
];

const PII_PATTERNS = [
  /social security/i,
  /ssn/i,
  /credit card/i,
  /bank account/i,
  /password/i,
  /date of birth/i,
  /dob/i,
  /driver'?s? license/i,
];

const SENSITIVE_TOPICS = {
  legal: [/lawyer/i, /sue/i, /legal action/i, /lawsuit/i, /attorney/i, /litigation/i],
  medical_claims: [/cure/i, /heal/i, /treat disease/i, /medical advice/i, /diagnosis/i],
  political: [/democrat/i, /republican/i, /administration/i, /politician/i, /vote for/i],
  religious: [/pray/i, /god will/i, /blessed by/i, /religious/i],
  discriminatory: [/race/i, /gender/i, /orientation/i, /disability/i],
};

const TONE_INDICATORS = {
  friendly: ['thanks', 'appreciate', 'happy', '😊', '!', 'glad', 'wonderful'],
  professional: ['thank you', 'regarding', 'please', 'sincerely', 'assist'],
  dismissive: ['not our', 'your problem', 'should have', "don't care", 'whatever'],
  sarcastic: ['oh wow', 'never heard', 'how original', 'sure thing', 'totally'],
};

export class ResponseSafetyChecker {
  private strictMode: boolean;
  private competitors: string[];

  constructor(config?: { strictMode?: boolean; competitors?: string[] }) {
    this.strictMode = config?.strictMode ?? false;
    this.competitors = config?.competitors || [];
  }

  async checkResponse(input: {
    draft: string;
    brandVoice: Partial<BrandVoice>;
    platform: Platform | string;
  }): Promise<SafetyCheckResult> {
    return tracer.startActiveSpan('checkResponseSafety', async (span) => {
      span.setAttributes({
        'safety.platform': input.platform,
        'safety.draft_length': input.draft.length,
      });

      const violations: SafetyViolation[] = [];

      // Check length
      const limit = PLATFORM_LIMITS[input.platform as string] || 8000;
      if (input.draft.length > limit) {
        violations.push({
          type: 'length_exceeded',
          severity: 'low',
          message: `Response exceeds ${limit} character limit for ${input.platform}`,
          autoFixable: true,
        });
      }

      // Check profanity
      for (const word of PROFANITY_LIST) {
        if (input.draft.toLowerCase().includes(word)) {
          violations.push({
            type: 'profanity',
            severity: 'high',
            word,
            message: `Contains profanity: ${word}`,
          });
        }
      }

      // Check unauthorized promises
      for (const phrase of PROMISE_WORDS) {
        if (input.draft.toLowerCase().includes(phrase.toLowerCase())) {
          violations.push({
            type: 'unauthorized_promise',
            severity: 'medium',
            word: phrase,
            message: `Contains unauthorized promise language: ${phrase}`,
          });
        }
      }

      // Check PII requests
      for (const pattern of PII_PATTERNS) {
        if (pattern.test(input.draft)) {
          violations.push({
            type: 'pii_request',
            severity: 'critical',
            message: 'Requests or mentions sensitive personal information',
          });
          break;
        }
      }

      // Check competitor mentions
      for (const competitor of this.competitors) {
        if (input.draft.toLowerCase().includes(competitor.toLowerCase())) {
          violations.push({
            type: 'competitor_mention',
            severity: 'medium',
            word: competitor,
            message: `Mentions competitor: ${competitor}`,
          });
        }
      }

      // Analyze tone
      const toneAnalysis = await this.analyzeTone(input.draft);
      if (
        toneAnalysis.detectedTone === 'dismissive' ||
        toneAnalysis.detectedTone === 'sarcastic'
      ) {
        violations.push({
          type: 'tone_mismatch',
          severity: 'high',
          message: `Detected ${toneAnalysis.detectedTone} tone which may be inappropriate`,
        });
      }

      // Check brand guidelines
      const brandCompliance = await this.checkBrandGuidelines(
        input.draft,
        input.brandVoice as BrandVoice
      );

      const safe =
        violations.length === 0 ||
        violations.every((v) => v.severity === 'low' && v.autoFixable);

      const requiresHumanReview = violations.some(
        (v) => v.severity === 'critical' || v.severity === 'high'
      );

      span.setAttributes({
        'safety.safe': safe,
        'safety.violation_count': violations.length,
        'safety.requires_review': requiresHumanReview,
      });
      span.end();

      return {
        safe,
        violations,
        requiresHumanReview,
        toneAnalysis,
        brandCompliance,
      };
    });
  }

  async analyzeTone(text: string): Promise<ToneAnalysis> {
    const lowerText = text.toLowerCase();
    const scores: Record<string, number> = {};
    const flags: string[] = [];

    for (const [tone, indicators] of Object.entries(TONE_INDICATORS)) {
      scores[tone] = indicators.filter((ind) =>
        lowerText.includes(ind.toLowerCase())
      ).length;
    }

    const maxTone = Object.entries(scores).reduce((a, b) =>
      a[1] > b[1] ? a : b
    );

    const totalIndicators = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalIndicators > 0 ? maxTone[1] / totalIndicators : 0.5;

    if (maxTone[0] === 'dismissive' || maxTone[0] === 'sarcastic') {
      flags.push('potentially_negative');
    }

    return {
      detectedTone: maxTone[0],
      confidence,
      flags,
    };
  }

  async checkBrandGuidelines(
    text: string,
    brandVoice: BrandVoice
  ): Promise<BrandComplianceResult> {
    const lowerText = text.toLowerCase();
    const forbiddenWordsUsed: string[] = [];
    const missingPreferredWords: string[] = [];

    if (brandVoice.dontWords) {
      for (const word of brandVoice.dontWords) {
        if (lowerText.includes(word.toLowerCase())) {
          forbiddenWordsUsed.push(word);
        }
      }
    }

    if (brandVoice.doWords) {
      const hasAnyPreferred = brandVoice.doWords.some((word) =>
        lowerText.includes(word.toLowerCase())
      );
      if (!hasAnyPreferred) {
        missingPreferredWords.push(...brandVoice.doWords);
      }
    }

    return {
      compliant: forbiddenWordsUsed.length === 0,
      forbiddenWordsUsed,
      missingPreferredWords,
    };
  }

  async checkSensitiveTopics(text: string): Promise<SensitiveTopicResult> {
    const topics: string[] = [];

    for (const [topic, patterns] of Object.entries(SENSITIVE_TOPICS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          topics.push(topic);
          break;
        }
      }
    }

    return {
      hasSensitiveContent: topics.length > 0,
      topics,
    };
  }

  async getSuggestedRevisions(
    text: string,
    violations: SafetyViolation[]
  ): Promise<string[]> {
    const suggestions: string[] = [];

    for (const violation of violations) {
      if (violation.type === 'profanity' && violation.word) {
        const replacement = text.replace(
          new RegExp(violation.word, 'gi'),
          'really'
        );
        suggestions.push(replacement);
      }

      if (violation.type === 'unauthorized_promise' && violation.word) {
        const softenedWord = violation.word
          .replace(/guarantee/i, 'aim to')
          .replace(/definitely/i, 'likely')
          .replace(/certainly/i, 'should')
          .replace(/promise/i, 'commit to trying to');
        suggestions.push(text.replace(violation.word, softenedWord));
      }
    }

    return suggestions;
  }

  requiresHumanReview(result: SafetyCheckResult): boolean {
    return result.requiresHumanReview;
  }
}

export function createSafetyChecker(config?: {
  strictMode?: boolean;
  competitors?: string[];
}): ResponseSafetyChecker {
  return new ResponseSafetyChecker(config);
}
```

### Phase 3: Verification

```bash
cd packages/agents/reply && pnpm test
pnpm test:coverage
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/reply/src/response-safety.ts` | Safety checker |
| Create | `packages/agents/reply/src/__tests__/response-safety.test.ts` | Tests |
| Modify | `packages/agents/reply/src/index.ts` | Export safety checker |

---

## Acceptance Criteria

- [ ] Detect profanity and inappropriate language
- [ ] Flag unauthorized promises (guarantee, definitely)
- [ ] Block PII requests (SSN, credit card, password)
- [ ] Check competitor mentions
- [ ] Validate platform character limits
- [ ] Analyze tone for brand consistency
- [ ] Check brand guideline compliance (do/don't words)
- [ ] Detect sensitive topics (legal, medical, political)
- [ ] Provide suggested revisions
- [ ] Determine if human review required
- [ ] Unit tests achieve 90%+ coverage

---

## JSON Task Block

```json
{
  "task_id": "S4-C2",
  "name": "Safe Response Generation",
  "description": "Validate response drafts for safety and brand compliance",
  "status": "pending",
  "priority": "high",
  "complexity": "high",
  "sprint": 4,
  "agent": "C",
  "dependencies": ["S4-C1", "S4-B3"],
  "blocks": ["S4-C4", "S4-C5", "S4-D1"],
  "estimated_hours": 12,
  "tags": ["engagement", "reply-agent", "safety", "compliance", "tdd"],
  "package": "@rtv/agents/reply"
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "next_task_hints": ["S4-C4 for comment reply drafts", "S4-D1 for escalation triggers"]
}
```
