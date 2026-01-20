# Build Prompt: S2-C4 — Hook Generation

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-C4 |
| Sprint | 2 |
| Agent | C (Copy Generation) |
| Complexity | Medium |
| Status | pending |
| Estimated Files | 4 |
| Spec References | `agent-recursion-contracts.md`, `platform-playbooks/` |

---

## Context

### What This Builds

The Hook Generation service — a specialized module for creating attention-grabbing opening lines that stop the scroll. This implements a pattern library of 12 proven hook types with platform-specific optimization.

### Why It Matters

The hook is the most critical element of any social content. You have 0-3 seconds to capture attention:
- **Reels/TikTok**: Hook determines if users stop scrolling
- **LinkedIn**: First line appears before "see more" - it's your only chance
- **YouTube**: Opening determines watch time and algorithm performance
- **Stories**: Immediate engagement or swipe-away

### Architecture Decision

Hook generation uses a **pattern library approach**:
1. **12 Hook Patterns**: Proven structures that capture attention
2. **Platform Adaptation**: Same pattern, different execution per platform
3. **Topic Injection**: Pattern + topic = specific hook
4. **A/B Variants**: Multiple hooks per pattern for testing

---

## Prerequisites

### Completed Tasks
- [x] S2-C1: Copy agent prompt system (CopyPromptComposer)
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
// packages/agents/copy/src/hooks/__tests__/hook-generator.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HookGenerator,
  HookRequest,
  HookResult,
  HookPattern
} from '../hook-generator';
import { HookPatternLibrary } from '../hook-patterns';

describe('HookGenerator', () => {
  let generator: HookGenerator;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Stop scrolling if you want to 10x your business'
          }
        }]
      })
    };

    generator = new HookGenerator({
      llmClient: mockLLMClient
    });
  });

  describe('single hook generation', () => {
    it('should generate hook for given topic', async () => {
      const request: HookRequest = {
        platform: 'instagram',
        topic: 'business growth',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.primary).toBeDefined();
      expect(result.primary.text).toBeTruthy();
      expect(mockLLMClient.chat).toHaveBeenCalled();
    });

    it('should generate hook with specific pattern', async () => {
      const request: HookRequest = {
        platform: 'tiktok',
        topic: 'marketing tips',
        pattern: 'question',
        clientId: 'client-123'
      };

      await generator.generate(request);

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('question');
    });

    it('should keep hooks short for TikTok', async () => {
      mockLLMClient.chat.mockResolvedValue({
        choices: [{ message: { content: 'Short hook' } }]
      });

      const result = await generator.generate({
        platform: 'tiktok',
        topic: 'test',
        clientId: 'client-123'
      });

      expect(result.primary.text.length).toBeLessThan(50);
    });
  });

  describe('12 hook patterns', () => {
    const patterns: HookPattern[] = [
      'question',
      'bold_claim',
      'story_open',
      'pattern_interrupt',
      'stat_shock',
      'problem_agitate',
      'curiosity_gap',
      'contrarian',
      'how_to',
      'what_if',
      'warning',
      'social_proof'
    ];

    patterns.forEach(pattern => {
      it(`should support ${pattern} pattern`, async () => {
        const request: HookRequest = {
          platform: 'instagram',
          topic: 'productivity',
          pattern,
          clientId: 'client-123'
        };

        await generator.generate(request);

        const callArgs = mockLLMClient.chat.mock.calls[0][0];
        expect(callArgs.messages[0].content).toContain(pattern.replace('_', ' '));
      });
    });
  });

  describe('platform-specific adaptation', () => {
    it('should adapt hooks for Instagram Reels', async () => {
      await generator.generate({
        platform: 'instagram',
        topic: 'fitness',
        clientId: 'client-123',
        contentType: 'reel'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Reel');
    });

    it('should adapt hooks for LinkedIn first line', async () => {
      await generator.generate({
        platform: 'linkedin',
        topic: 'leadership',
        clientId: 'client-123'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('see more');
    });

    it('should adapt hooks for YouTube Shorts', async () => {
      await generator.generate({
        platform: 'youtube',
        topic: 'tech',
        clientId: 'client-123',
        contentType: 'short'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Short');
    });

    it('should adapt hooks for Twitter/X thread', async () => {
      await generator.generate({
        platform: 'x',
        topic: 'startups',
        clientId: 'client-123',
        contentType: 'thread'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('thread');
    });
  });

  describe('variant generation', () => {
    it('should generate multiple pattern variants', async () => {
      mockLLMClient.chat
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Hook 1' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Hook 2' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Hook 3' } }] });

      const result = await generator.generate({
        platform: 'instagram',
        topic: 'test',
        clientId: 'client-123',
        patterns: ['question', 'bold_claim', 'story_open']
      });

      expect(result.variants.length).toBe(3);
      expect(result.variants[0].pattern).toBe('question');
      expect(result.variants[1].pattern).toBe('bold_claim');
      expect(result.variants[2].pattern).toBe('story_open');
    });

    it('should generate multiple variants of same pattern', async () => {
      mockLLMClient.chat
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Variant 1' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Variant 2' } }] });

      const result = await generator.generate({
        platform: 'instagram',
        topic: 'test',
        pattern: 'question',
        variantCount: 2,
        clientId: 'client-123'
      });

      expect(result.variants.length).toBe(2);
      expect(result.variants[0].text).not.toBe(result.variants[1].text);
    });
  });

  describe('hook scoring', () => {
    it('should score hooks on attention factors', async () => {
      const result = await generator.generate({
        platform: 'instagram',
        topic: 'test',
        clientId: 'client-123',
        scoreHooks: true
      });

      expect(result.primary.score).toBeDefined();
      expect(result.primary.score?.curiosityGap).toBeDefined();
      expect(result.primary.score?.specificity).toBeDefined();
      expect(result.primary.score?.emotionalPull).toBeDefined();
    });
  });

  describe('niche customization', () => {
    it('should adapt hooks for B2B audience', async () => {
      await generator.generate({
        platform: 'linkedin',
        topic: 'sales strategy',
        niche: 'b2b_saas',
        clientId: 'client-123'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('B2B');
    });

    it('should adapt hooks for creator audience', async () => {
      await generator.generate({
        platform: 'instagram',
        topic: 'content creation',
        niche: 'creators',
        clientId: 'client-123'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('creator');
    });
  });
});

describe('HookPatternLibrary', () => {
  describe('getPattern', () => {
    it('should return pattern definition', () => {
      const pattern = HookPatternLibrary.getPattern('question');

      expect(pattern).toBeDefined();
      expect(pattern.name).toBe('Question Hook');
      expect(pattern.structure).toBeDefined();
      expect(pattern.examples).toHaveLength(3);
    });

    it('should return all 12 patterns', () => {
      const all = HookPatternLibrary.getAllPatterns();
      expect(Object.keys(all)).toHaveLength(12);
    });
  });

  describe('getRecommendedPatterns', () => {
    it('should recommend patterns for engagement objective', () => {
      const recommended = HookPatternLibrary.getRecommendedPatterns('engagement');

      expect(recommended).toContain('question');
      expect(recommended).toContain('contrarian');
    });

    it('should recommend patterns for conversion objective', () => {
      const recommended = HookPatternLibrary.getRecommendedPatterns('conversion');

      expect(recommended).toContain('problem_agitate');
      expect(recommended).toContain('social_proof');
    });
  });

  describe('adaptForPlatform', () => {
    it('should shorten hooks for TikTok', () => {
      const pattern = HookPatternLibrary.adaptForPlatform('bold_claim', 'tiktok');

      expect(pattern.maxLength).toBeLessThan(50);
    });

    it('should adapt for LinkedIn professional tone', () => {
      const pattern = HookPatternLibrary.adaptForPlatform('contrarian', 'linkedin');

      expect(pattern.toneGuidance).toContain('professional');
    });
  });
});

describe('HookScorer', () => {
  describe('scoreHook', () => {
    it('should score curiosity gap', () => {
      const hook = 'I discovered a secret that tripled my revenue';
      const score = HookScorer.score(hook);

      expect(score.curiosityGap).toBeGreaterThan(0.5);
    });

    it('should score specificity', () => {
      const specific = 'I made $47,382 in 30 days';
      const vague = 'I made money quickly';

      const specificScore = HookScorer.score(specific);
      const vagueScore = HookScorer.score(vague);

      expect(specificScore.specificity).toBeGreaterThan(vagueScore.specificity);
    });

    it('should score emotional pull', () => {
      const emotional = 'This broke my heart but changed my life';
      const neutral = 'Here is some information';

      const emotionalScore = HookScorer.score(emotional);
      const neutralScore = HookScorer.score(neutral);

      expect(emotionalScore.emotionalPull).toBeGreaterThan(neutralScore.emotionalPull);
    });

    it('should calculate overall score', () => {
      const score = HookScorer.score('Test hook');
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Define Hook Types

```typescript
// packages/agents/copy/src/hooks/types.ts

import { z } from 'zod';
import { Platform } from '../prompts/types';

export const HookPatternSchema = z.enum([
  'question',         // "What if I told you..."
  'bold_claim',       // "This will change everything"
  'story_open',       // "Last week I..."
  'pattern_interrupt', // "STOP. Don't scroll."
  'stat_shock',       // "97% of people don't know..."
  'problem_agitate',  // "Tired of [pain]?"
  'curiosity_gap',    // "The secret nobody talks about"
  'contrarian',       // "Everything you know about X is wrong"
  'how_to',           // "How to X without Y"
  'what_if',          // "What if you could..."
  'warning',          // "Don't make this mistake"
  'social_proof'      // "10,000 people already..."
]);

export type HookPattern = z.infer<typeof HookPatternSchema>;

export const ContentTypeSchema = z.enum([
  'reel',
  'post',
  'story',
  'short',
  'thread',
  'carousel',
  'live'
]);

export type ContentType = z.infer<typeof ContentTypeSchema>;

export const NicheSchema = z.enum([
  'b2b_saas',
  'ecommerce',
  'creators',
  'coaches',
  'local_business',
  'personal_brand',
  'agency',
  'generic'
]);

export type Niche = z.infer<typeof NicheSchema>;

export interface HookRequest {
  platform: Platform;
  topic: string;
  clientId: string;
  pattern?: HookPattern;
  patterns?: HookPattern[];
  variantCount?: number;
  contentType?: ContentType;
  niche?: Niche;
  scoreHooks?: boolean;
  maxLength?: number;
}

export interface HookScore {
  curiosityGap: number;  // 0-1: How much it creates desire to know more
  specificity: number;   // 0-1: How specific vs generic
  emotionalPull: number; // 0-1: Emotional resonance
  clarity: number;       // 0-1: How clear the message is
  overall: number;       // 0-100: Weighted overall score
}

export interface HookVariant {
  text: string;
  pattern: HookPattern;
  platform: Platform;
  score?: HookScore;
}

export interface HookResult {
  primary: HookVariant;
  variants: HookVariant[];
  generatedAt: string;
  modelUsed: string;
}

export interface PatternDefinition {
  name: string;
  description: string;
  structure: string;
  examples: string[];
  bestFor: string[];
  avoid: string[];
  maxLength?: number;
  toneGuidance?: string;
}
```

#### Step 2: Implement Hook Pattern Library

```typescript
// packages/agents/copy/src/hooks/hook-patterns.ts

import { HookPattern, PatternDefinition, Platform, Niche } from './types';

const PATTERNS: Record<HookPattern, PatternDefinition> = {
  question: {
    name: 'Question Hook',
    description: 'Opens with a compelling question that makes viewers want the answer',
    structure: '[Intriguing question about their desire/pain]?',
    examples: [
      'What if you could 10x your income without working more hours?',
      'Ever wonder why some people succeed while others struggle?',
      'What would you do with an extra $10k per month?'
    ],
    bestFor: ['engagement', 'awareness', 'thought leadership'],
    avoid: ['yes/no questions', 'generic questions', 'questions they already know the answer to']
  },
  bold_claim: {
    name: 'Bold Claim Hook',
    description: 'Makes a surprising or counterintuitive statement that demands attention',
    structure: '[Surprising statement that challenges expectations]',
    examples: [
      'This 30-second habit made me a millionaire',
      'I fired my entire team and revenue doubled',
      'The best marketing costs $0'
    ],
    bestFor: ['viral potential', 'authority building', 'conversion'],
    avoid: ['unsubstantiated claims', 'clickbait without payoff', 'hyperbole without proof']
  },
  story_open: {
    name: 'Story Opening Hook',
    description: 'Starts a narrative that creates emotional investment',
    structure: '[Time marker] + [Situation setup]...',
    examples: [
      'Last Tuesday, I got a call that changed everything',
      '3 years ago I was $50k in debt',
      'I was about to quit when this happened'
    ],
    bestFor: ['emotional connection', 'relatability', 'retention'],
    avoid: ['boring setups', 'too much context upfront', 'unclear stakes']
  },
  pattern_interrupt: {
    name: 'Pattern Interrupt Hook',
    description: 'Breaks the scroll pattern with unexpected command or statement',
    structure: '[Unexpected command or statement that breaks pattern]',
    examples: [
      'STOP. Don\'t scroll past this.',
      'Wait—before you swipe away',
      'POV: You finally understand'
    ],
    bestFor: ['stopping the scroll', 'TikTok/Reels', 'announcements'],
    avoid: ['overuse', 'generic commands', 'aggressive tone without value']
  },
  stat_shock: {
    name: 'Shocking Statistic Hook',
    description: 'Leads with a surprising statistic that reframes their thinking',
    structure: '[Surprising statistic] + [Brief context]',
    examples: [
      '97% of businesses fail within 5 years. Here\'s why.',
      'You lose 23 minutes every time you check your phone',
      '80% of your results come from 20% of your effort'
    ],
    bestFor: ['credibility', 'educational content', 'reframing'],
    avoid: ['made-up stats', 'outdated data', 'stats without context']
  },
  problem_agitate: {
    name: 'Problem Agitation Hook',
    description: 'Identifies a pain point and amplifies it',
    structure: '[Pain point identification] + [Agitation]',
    examples: [
      'Tired of posting and getting zero engagement?',
      'Still struggling to close high-ticket clients?',
      'Working 80 hours and barely breaking even?'
    ],
    bestFor: ['conversion', 'solution selling', 'relatability'],
    avoid: ['shaming', 'creating anxiety without solution', 'overused pains']
  },
  curiosity_gap: {
    name: 'Curiosity Gap Hook',
    description: 'Creates an information gap that demands to be closed',
    structure: '[Tease of valuable information] + [Gap]',
    examples: [
      'The one thing successful people never tell you',
      'This is what your competitors don\'t want you to know',
      'I discovered why 99% of funnels fail'
    ],
    bestFor: ['watch time', 'clicks', 'engagement'],
    avoid: ['pure clickbait', 'no payoff', 'vague promises']
  },
  contrarian: {
    name: 'Contrarian Hook',
    description: 'Challenges conventional wisdom or popular beliefs',
    structure: '[Common belief is wrong] + [New perspective]',
    examples: [
      'Hustle culture is killing your business',
      'Your morning routine is a waste of time',
      'Everything you know about sales is wrong'
    ],
    bestFor: ['thought leadership', 'differentiation', 'viral potential'],
    avoid: ['being contrarian for its own sake', 'offensive takes', 'unsupported claims']
  },
  how_to: {
    name: 'How-To Hook',
    description: 'Promises to teach a specific skill or outcome',
    structure: 'How to [desirable outcome] without [common obstacle]',
    examples: [
      'How to get 10k followers without posting daily',
      'How to close deals without being salesy',
      'How to automate your business in 3 steps'
    ],
    bestFor: ['educational content', 'tutorials', 'value-first marketing'],
    avoid: ['overpromising', 'too generic', 'impossible outcomes']
  },
  what_if: {
    name: 'What If Hook',
    description: 'Invites imagination of a better future',
    structure: 'What if [desirable scenario]?',
    examples: [
      'What if you never had to cold call again?',
      'What if your content sold while you slept?',
      'What if every client came to you pre-sold?'
    ],
    bestFor: ['aspiration', 'vision selling', 'emotional appeal'],
    avoid: ['unrealistic scenarios', 'too abstract', 'manipulation']
  },
  warning: {
    name: 'Warning Hook',
    description: 'Alerts to a danger or mistake they might be making',
    structure: '[Warning about mistake/danger] + [Stakes]',
    examples: [
      'Don\'t post another video until you see this',
      'This mistake is costing you thousands',
      'Warning: This trend is destroying your reach'
    ],
    bestFor: ['urgency', 'protective positioning', 'problem awareness'],
    avoid: ['fear mongering', 'fake urgency', 'crying wolf']
  },
  social_proof: {
    name: 'Social Proof Hook',
    description: 'Leads with evidence of others\' success',
    structure: '[Number/type of people] + [result they achieved]',
    examples: [
      '10,000 entrepreneurs used this to scale',
      'My client went from $0 to $100k in 90 days',
      'Why 500+ brands trust this strategy'
    ],
    bestFor: ['credibility', 'conversion', 'authority'],
    avoid: ['fake testimonials', 'inflated numbers', 'unverifiable claims']
  }
};

export class HookPatternLibrary {
  static getPattern(pattern: HookPattern): PatternDefinition {
    return PATTERNS[pattern];
  }

  static getAllPatterns(): Record<HookPattern, PatternDefinition> {
    return PATTERNS;
  }

  static getPatternList(): HookPattern[] {
    return Object.keys(PATTERNS) as HookPattern[];
  }

  static getRecommendedPatterns(objective: string): HookPattern[] {
    const recommendations: Record<string, HookPattern[]> = {
      engagement: ['question', 'contrarian', 'curiosity_gap', 'pattern_interrupt'],
      conversion: ['problem_agitate', 'social_proof', 'bold_claim', 'warning'],
      awareness: ['stat_shock', 'story_open', 'how_to', 'what_if'],
      retention: ['story_open', 'curiosity_gap', 'bold_claim']
    };

    return recommendations[objective] || this.getPatternList().slice(0, 4);
  }

  static adaptForPlatform(pattern: HookPattern, platform: Platform): PatternDefinition {
    const base = PATTERNS[pattern];
    const adapted = { ...base };

    switch (platform) {
      case 'tiktok':
        adapted.maxLength = 40;
        adapted.toneGuidance = 'Casual, energetic, trend-aware. Use internet slang appropriately.';
        break;
      case 'instagram':
        adapted.maxLength = 60;
        adapted.toneGuidance = 'Engaging, visual-first. Hook works with or without sound.';
        break;
      case 'linkedin':
        adapted.maxLength = 100;
        adapted.toneGuidance = 'Professional but not corporate. Thought leadership tone. Must work before "see more" cutoff.';
        break;
      case 'youtube':
        adapted.maxLength = 50;
        adapted.toneGuidance = 'Must work both spoken and as text overlay. Retain viewers past 3 seconds.';
        break;
      case 'x':
        adapted.maxLength = 80;
        adapted.toneGuidance = 'Punchy, provocative. Thread starter or standalone.';
        break;
      case 'facebook':
        adapted.maxLength = 100;
        adapted.toneGuidance = 'Community-oriented. Works for groups and feeds.';
        break;
      case 'skool':
        adapted.maxLength = 120;
        adapted.toneGuidance = 'Value-first, community-building. Encourages discussion.';
        break;
    }

    return adapted;
  }

  static adaptForNiche(pattern: HookPattern, niche: Niche): PatternDefinition {
    const base = PATTERNS[pattern];
    const adapted = { ...base };

    const nicheGuidance: Record<Niche, string> = {
      b2b_saas: 'Focus on ROI, efficiency, and scalability. Reference B2B pain points.',
      ecommerce: 'Product-focused, conversion-oriented. Reference shopping behavior.',
      creators: 'Meta about content creation. Reference algorithm, growth, monetization.',
      coaches: 'Transformation-focused. Reference client results and personal development.',
      local_business: 'Community-oriented. Reference local specifics and service quality.',
      personal_brand: 'Authentic, story-driven. Reference personal journey and expertise.',
      agency: 'Client-results focused. Reference case studies and outcomes.',
      generic: 'Universal appeal. Broadly applicable.'
    };

    adapted.toneGuidance = (adapted.toneGuidance || '') + ' ' + nicheGuidance[niche];

    return adapted;
  }
}
```

#### Step 3: Implement Hook Scorer

```typescript
// packages/agents/copy/src/hooks/hook-scorer.ts

import { HookScore } from './types';

export class HookScorer {
  // Words/phrases that indicate curiosity gap
  private static curiosityIndicators = [
    'secret', 'discovered', 'revealed', 'hidden', 'truth', 'nobody',
    'what if', 'imagine', 'unlock', 'mystery', 'surprising', 'shocking'
  ];

  // Patterns that indicate specificity
  private static specificityPatterns = [
    /\$[\d,]+/,          // Dollar amounts
    /\d+%/,              // Percentages
    /\d+ (days?|hours?|minutes?|weeks?|months?|years?)/i, // Time periods
    /\d+k?/,             // Numbers
    /\d+x/               // Multipliers
  ];

  // Emotional trigger words
  private static emotionalTriggers = [
    'broke', 'changed', 'transformed', 'struggled', 'failed', 'succeeded',
    'loved', 'hated', 'feared', 'dreamed', 'wished', 'regretted',
    'amazing', 'terrible', 'incredible', 'devastating', 'life-changing'
  ];

  static score(hook: string): HookScore {
    const normalizedHook = hook.toLowerCase();

    const curiosityGap = this.scoreCuriosityGap(normalizedHook);
    const specificity = this.scoreSpecificity(hook);
    const emotionalPull = this.scoreEmotionalPull(normalizedHook);
    const clarity = this.scoreClarity(hook);

    // Weighted overall score
    const overall = Math.round(
      (curiosityGap * 30) +
      (specificity * 25) +
      (emotionalPull * 25) +
      (clarity * 20)
    );

    return {
      curiosityGap,
      specificity,
      emotionalPull,
      clarity,
      overall
    };
  }

  private static scoreCuriosityGap(hook: string): number {
    let score = 0;
    const matches = this.curiosityIndicators.filter(indicator =>
      hook.includes(indicator)
    );

    // Base score from keyword matches
    score += Math.min(matches.length * 0.2, 0.6);

    // Bonus for question format
    if (hook.includes('?')) {
      score += 0.2;
    }

    // Bonus for open loops
    if (hook.includes('...') || hook.endsWith('but')) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }

  private static scoreSpecificity(hook: string): number {
    let score = 0.2; // Base score

    // Check for specific patterns
    const matches = this.specificityPatterns.filter(pattern =>
      pattern.test(hook)
    );

    score += matches.length * 0.2;

    // Bonus for proper nouns (capitalized words that aren't sentence starts)
    const properNouns = hook.match(/(?<!^|\. )[A-Z][a-z]+/g);
    if (properNouns && properNouns.length > 0) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  private static scoreEmotionalPull(hook: string): number {
    let score = 0;

    const matches = this.emotionalTriggers.filter(trigger =>
      hook.includes(trigger)
    );

    score += Math.min(matches.length * 0.25, 0.75);

    // Bonus for personal pronouns (more intimate)
    const personalPronouns = (hook.match(/\b(i|you|my|your|we|our)\b/gi) || []).length;
    score += Math.min(personalPronouns * 0.05, 0.25);

    return Math.min(score, 1);
  }

  private static scoreClarity(hook: string): number {
    let score = 1.0;

    // Penalize overly long hooks
    const words = hook.split(/\s+/).length;
    if (words > 15) {
      score -= 0.3;
    } else if (words > 10) {
      score -= 0.1;
    }

    // Penalize jargon overload (multiple uncommon words)
    // This is a simplified heuristic
    const complexWords = hook.match(/\b\w{12,}\b/g);
    if (complexWords && complexWords.length > 1) {
      score -= 0.2;
    }

    // Reward simple sentence structure
    if (!hook.includes(',') || hook.split(',').length <= 2) {
      score += 0.1;
    }

    return Math.max(Math.min(score, 1), 0);
  }

  static getScoreBreakdown(score: HookScore): string {
    const labels = {
      curiosityGap: 'Curiosity Gap',
      specificity: 'Specificity',
      emotionalPull: 'Emotional Pull',
      clarity: 'Clarity'
    };

    const breakdown = Object.entries(labels)
      .map(([key, label]) => {
        const value = score[key as keyof HookScore];
        if (typeof value === 'number' && key !== 'overall') {
          const percentage = Math.round(value * 100);
          return `${label}: ${percentage}%`;
        }
        return null;
      })
      .filter(Boolean)
      .join(', ');

    return `Overall: ${score.overall}/100 (${breakdown})`;
  }
}
```

#### Step 4: Implement Hook Generator

```typescript
// packages/agents/copy/src/hooks/hook-generator.ts

import {
  HookRequest,
  HookResult,
  HookVariant,
  HookPattern,
  ContentType
} from './types';
import { HookPatternLibrary } from './hook-patterns';
import { HookScorer } from './hook-scorer';
import { Platform } from '../prompts/types';

interface LLMClient {
  chat(request: any): Promise<{ choices: Array<{ message: { content: string } }> }>;
}

interface HookGeneratorOptions {
  llmClient: LLMClient;
  brandVoiceLoader?: any;
}

export class HookGenerator {
  private llmClient: LLMClient;
  private brandVoiceLoader?: any;

  constructor(options: HookGeneratorOptions) {
    this.llmClient = options.llmClient;
    this.brandVoiceLoader = options.brandVoiceLoader;
  }

  async generate(request: HookRequest): Promise<HookResult> {
    // Determine patterns to use
    const patterns = this.resolvePatterns(request);

    // Generate primary hook
    const primary = await this.generateSingleHook(
      request,
      patterns[0]
    );

    // Generate variants
    const variants: HookVariant[] = [];

    if (request.patterns && request.patterns.length > 1) {
      // Multiple different patterns
      for (let i = 0; i < request.patterns.length; i++) {
        const variant = await this.generateSingleHook(
          request,
          request.patterns[i]
        );
        variants.push(variant);
      }
    } else if (request.variantCount && request.variantCount > 1) {
      // Multiple variants of same pattern
      for (let i = 0; i < request.variantCount; i++) {
        const variant = await this.generateSingleHook(
          request,
          patterns[0]
        );
        variants.push(variant);
      }
    }

    return {
      primary,
      variants,
      generatedAt: new Date().toISOString(),
      modelUsed: 'gpt-4o-mini'
    };
  }

  private resolvePatterns(request: HookRequest): HookPattern[] {
    if (request.patterns && request.patterns.length > 0) {
      return request.patterns;
    }
    if (request.pattern) {
      return [request.pattern];
    }
    // Default: recommend based on platform
    return ['curiosity_gap', 'question', 'bold_claim'];
  }

  private async generateSingleHook(
    request: HookRequest,
    pattern: HookPattern
  ): Promise<HookVariant> {
    // Get pattern definition adapted for platform
    let patternDef = HookPatternLibrary.adaptForPlatform(pattern, request.platform);

    // Further adapt for niche if provided
    if (request.niche) {
      patternDef = HookPatternLibrary.adaptForNiche(pattern, request.niche);
    }

    const systemPrompt = this.buildSystemPrompt(request, patternDef, pattern);
    const userPrompt = this.buildUserPrompt(request, pattern);

    const response = await this.llmClient.chat({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9, // Higher for creative hooks
      max_tokens: 100
    });

    const text = response.choices[0].message.content.trim();

    // Enforce max length
    const maxLength = request.maxLength || patternDef.maxLength || 100;
    const finalText = text.length > maxLength
      ? text.substring(0, maxLength).trim() + '...'
      : text;

    const variant: HookVariant = {
      text: finalText,
      pattern,
      platform: request.platform
    };

    // Score if requested
    if (request.scoreHooks) {
      variant.score = HookScorer.score(finalText);
    }

    return variant;
  }

  private buildSystemPrompt(
    request: HookRequest,
    patternDef: any,
    pattern: HookPattern
  ): string {
    const contentTypeGuidance = this.getContentTypeGuidance(
      request.platform,
      request.contentType
    );

    return `You are a viral content hook specialist. You create scroll-stopping opening lines that capture attention in 0-3 seconds.

## Hook Pattern: ${patternDef.name}
${patternDef.description}

### Structure
${patternDef.structure}

### Examples
${patternDef.examples.map((e: string) => `- "${e}"`).join('\n')}

### Best For
${patternDef.bestFor.join(', ')}

### Avoid
${patternDef.avoid.join(', ')}

## Platform: ${request.platform}
${contentTypeGuidance}
${patternDef.toneGuidance || ''}

## Constraints
- Maximum length: ${patternDef.maxLength || 100} characters
- Must work standalone (no context needed)
- Must create immediate desire to continue

## Output
Provide ONLY the hook text. No explanations, no alternatives, just the final hook.`;
  }

  private buildUserPrompt(request: HookRequest, pattern: HookPattern): string {
    return `Write a ${pattern.replace('_', ' ')} hook about: ${request.topic}`;
  }

  private getContentTypeGuidance(platform: Platform, contentType?: ContentType): string {
    if (!contentType) {
      return '';
    }

    const guidance: Record<string, Record<string, string>> = {
      instagram: {
        reel: 'For Instagram Reel: Hook must work with or without sound. First 1-3 seconds are critical. Visual text overlays common.',
        post: 'For Instagram Post: Hook is first line of caption. Must work before "more" truncation.',
        story: 'For Instagram Story: Immediate engagement needed. Swipe-up or poll integration common.',
        carousel: 'For Instagram Carousel: Hook is cover slide and first caption line. Must drive swipe.'
      },
      tiktok: {
        reel: 'For TikTok video: Extremely short hook. Trend-aware. Often starts with POV or challenge format.',
        live: 'For TikTok Live: Interactive hook. Reference live context.'
      },
      youtube: {
        short: 'For YouTube Short: Must retain in first 3 seconds. Hook determines algorithm performance.',
        post: 'For YouTube Community: Standalone engagement. Poll or question format works well.'
      },
      linkedin: {
        post: 'For LinkedIn Post: Professional but not boring. Must work before "see more" cutoff (~200 chars).',
        thread: 'For LinkedIn article: Hook is headline. Must drive click-through.'
      },
      x: {
        thread: 'For X Thread: Hook is tweet 1. Must drive unroll. Often uses "A thread:" format.',
        post: 'For X Post: Standalone engagement. 280 char limit. Punchy.'
      }
    };

    return guidance[platform]?.[contentType] || '';
  }
}

export { HookPatternLibrary } from './hook-patterns';
export { HookScorer } from './hook-scorer';
```

#### Step 5: Create Package Exports

```typescript
// packages/agents/copy/src/hooks/index.ts

export * from './types';
export * from './hook-generator';
export * from './hook-patterns';
export * from './hook-scorer';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/agents/copy
pnpm test src/hooks

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint src/hooks
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/copy/src/hooks/types.ts` | Hook type definitions |
| Create | `packages/agents/copy/src/hooks/hook-patterns.ts` | 12 hook pattern definitions |
| Create | `packages/agents/copy/src/hooks/hook-scorer.ts` | Hook quality scoring |
| Create | `packages/agents/copy/src/hooks/hook-generator.ts` | Main hook generation logic |
| Create | `packages/agents/copy/src/hooks/index.ts` | Package exports |
| Create | `packages/agents/copy/src/hooks/__tests__/hook-generator.test.ts` | Comprehensive tests |

---

## Acceptance Criteria

- [ ] HookGenerator produces attention-grabbing hooks
- [ ] All 12 hook patterns implemented and documented
- [ ] Platform-specific adaptation works
- [ ] Niche customization available
- [ ] Variant generation works
- [ ] HookScorer provides quality metrics
- [ ] Content type guidance integrated
- [ ] Maximum length enforced
- [ ] Tests pass with >90% coverage

---

## Test Requirements

### Unit Tests
- Single hook generation
- All 12 pattern types
- Platform adaptation
- Variant generation
- Hook scoring

### Integration Tests
- Full hook generation with brand voice
- Multi-pattern variant generation
- Scoring accuracy

---

## Security & Safety Checklist

- [ ] No inappropriate content in hooks
- [ ] Brand voice validated
- [ ] Pattern definitions don't include harmful guidance
- [ ] Audit logging for generation

---

## JSON Task Block

```json
{
  "task_id": "S2-C4",
  "name": "Hook Generation",
  "status": "pending",
  "dependencies": ["S2-C1"],
  "blocks": ["S2-C5"],
  "agent": "C",
  "sprint": 2,
  "complexity": "medium",
  "estimated_files": 4,
  "tdd_required": true,
  "spec_refs": [
    "docs/03-agents-tools/agent-recursion-contracts.md",
    "docs/09-platform-playbooks/"
  ],
  "acceptance_checklist": [
    "12_hook_patterns",
    "platform_adaptation",
    "niche_customization",
    "variant_generation",
    "hook_scoring",
    "content_type_guidance"
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
    { "type": "brand_voice", "scope": "client" }
  ],
  "writes": [
    { "type": "generated_hook", "scope": "content" }
  ],
  "context_window_at_completion": null,
  "continuation_hint": "Verify hook patterns align with platform playbook recommendations"
}
```
