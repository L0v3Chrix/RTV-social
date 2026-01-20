# Build Prompt: S2-C3 — CTA Generation

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-C3 |
| Sprint | 2 |
| Agent | C (Copy Generation) |
| Complexity | Medium |
| Status | pending |
| Estimated Files | 4 |
| Spec References | `agent-recursion-contracts.md`, `external-memory-schema.md` |

---

## Context

### What This Builds

The CTA (Call-to-Action) Generation service — a specialized module for creating offer-aware, platform-appropriate calls-to-action. CTAs are context-sensitive, adapting to the active offer, platform link behavior, and content objective.

### Why It Matters

CTAs are where engagement converts to action. Poor CTAs lose the conversion opportunity:
- **Offer Awareness**: CTAs must align with active promotions and their urgency
- **Platform Behavior**: "Link in bio" vs inline links vs "See more"
- **Action Clarity**: Users must know exactly what to do next
- **Urgency Calibration**: Time-sensitive offers need appropriate urgency

### Architecture Decision

CTA generation uses an **offer-first pattern**:
1. Load active offer from Offer domain model (S1-A4)
2. Determine platform link behavior and limitations
3. Select CTA template based on objective (awareness, engagement, conversion)
4. Inject offer details, urgency, and value proposition
5. Generate final CTA with brand voice

---

## Prerequisites

### Completed Tasks
- [x] S2-C1: Copy agent prompt system (CopyPromptComposer)
- [x] S1-A4: Offer domain model (active offers, expiration)
- [x] S1-B3: Memory references

### Required Packages
```bash
pnpm add openai zod date-fns
pnpm add -D vitest
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests that define the expected behavior:

```typescript
// packages/agents/copy/src/cta/__tests__/cta-generator.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CTAGenerator,
  CTARequest,
  CTAResult,
  CTAStyle
} from '../cta-generator';
import { Offer, OfferType } from '../types';

describe('CTAGenerator', () => {
  let generator: CTAGenerator;
  let mockLLMClient: any;
  let mockOfferLoader: any;

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Click the link in bio to claim your spot!'
          }
        }]
      })
    };

    mockOfferLoader = {
      getActiveOffer: vi.fn().mockResolvedValue(null)
    };

    generator = new CTAGenerator({
      llmClient: mockLLMClient,
      offerLoader: mockOfferLoader
    });
  });

  describe('basic CTA generation', () => {
    it('should generate CTA for given objective', async () => {
      const request: CTARequest = {
        platform: 'instagram',
        objective: 'engagement',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.primary).toBeDefined();
      expect(result.primary.text).toContain('link in bio');
      expect(mockLLMClient.chat).toHaveBeenCalled();
    });

    it('should adapt CTA for conversion objective', async () => {
      const request: CTARequest = {
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123'
      };

      await generator.generate(request);

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('conversion');
    });

    it('should adapt CTA for awareness objective', async () => {
      const request: CTARequest = {
        platform: 'instagram',
        objective: 'awareness',
        clientId: 'client-123'
      };

      await generator.generate(request);

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('awareness');
    });
  });

  describe('offer-aware CTAs', () => {
    it('should load active offer for client', async () => {
      await generator.generate({
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123'
      });

      expect(mockOfferLoader.getActiveOffer).toHaveBeenCalledWith('client-123');
    });

    it('should inject offer details into CTA', async () => {
      const mockOffer: Offer = {
        id: 'offer-1',
        name: 'Summer Sale',
        type: 'discount',
        value: '25% off',
        headline: 'Summer Sale - 25% Off Everything',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isActive: true
      };

      mockOfferLoader.getActiveOffer.mockResolvedValue(mockOffer);

      await generator.generate({
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('25% off');
      expect(callArgs.messages[0].content).toContain('Summer Sale');
    });

    it('should calculate and include time urgency', async () => {
      const mockOffer: Offer = {
        id: 'offer-1',
        name: 'Flash Sale',
        type: 'discount',
        value: '50% off',
        headline: 'Flash Sale',
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        isActive: true
      };

      mockOfferLoader.getActiveOffer.mockResolvedValue(mockOffer);

      await generator.generate({
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toMatch(/hour|expires soon|limited time/i);
    });

    it('should use explicit offer when provided in request', async () => {
      const explicitOffer: Offer = {
        id: 'offer-explicit',
        name: 'VIP Offer',
        type: 'exclusive',
        value: 'Free consultation',
        headline: 'VIP Free Consultation',
        expiresAt: null,
        isActive: true
      };

      await generator.generate({
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123',
        offer: explicitOffer
      });

      // Should NOT call loader when offer is explicit
      expect(mockOfferLoader.getActiveOffer).not.toHaveBeenCalled();

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Free consultation');
    });
  });

  describe('platform-specific link handling', () => {
    it('should use "link in bio" for Instagram', async () => {
      await generator.generate({
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('link in bio');
    });

    it('should use "link in bio" for TikTok', async () => {
      await generator.generate({
        platform: 'tiktok',
        objective: 'conversion',
        clientId: 'client-123'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('link in bio');
    });

    it('should allow inline links for LinkedIn', async () => {
      await generator.generate({
        platform: 'linkedin',
        objective: 'conversion',
        clientId: 'client-123'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('inline link');
    });

    it('should allow inline links for X', async () => {
      await generator.generate({
        platform: 'x',
        objective: 'conversion',
        clientId: 'client-123'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('inline link');
    });

    it('should handle first comment links for Facebook', async () => {
      await generator.generate({
        platform: 'facebook',
        objective: 'conversion',
        clientId: 'client-123',
        linkPlacement: 'first_comment'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('first comment');
    });
  });

  describe('CTA style variations', () => {
    it('should support direct style', async () => {
      await generator.generate({
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123',
        style: 'direct'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('direct');
    });

    it('should support question style', async () => {
      await generator.generate({
        platform: 'instagram',
        objective: 'engagement',
        clientId: 'client-123',
        style: 'question'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('question');
    });

    it('should support urgency style', async () => {
      await generator.generate({
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123',
        style: 'urgency'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('urgency');
    });

    it('should support benefit style', async () => {
      await generator.generate({
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123',
        style: 'benefit'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('benefit');
    });

    it('should support social_proof style', async () => {
      await generator.generate({
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123',
        style: 'social_proof'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('social proof');
    });
  });

  describe('variant generation', () => {
    it('should generate multiple CTA variants', async () => {
      mockLLMClient.chat
        .mockResolvedValueOnce({ choices: [{ message: { content: 'CTA 1' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'CTA 2' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'CTA 3' } }] });

      const result = await generator.generate({
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123',
        variantCount: 3
      });

      expect(result.variants.length).toBe(3);
    });

    it('should generate variants with different styles', async () => {
      const result = await generator.generate({
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123',
        styles: ['direct', 'question', 'urgency']
      });

      expect(result.variants.length).toBe(3);
      expect(result.variants[0].style).toBe('direct');
      expect(result.variants[1].style).toBe('question');
      expect(result.variants[2].style).toBe('urgency');
    });
  });

  describe('custom action specification', () => {
    it('should support custom action in CTA', async () => {
      await generator.generate({
        platform: 'instagram',
        objective: 'conversion',
        clientId: 'client-123',
        customAction: 'Book your free consultation'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Book your free consultation');
    });

    it('should support custom destination', async () => {
      await generator.generate({
        platform: 'linkedin',
        objective: 'conversion',
        clientId: 'client-123',
        customDestination: 'our website'
      });

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('our website');
    });
  });
});

describe('CTATemplates', () => {
  describe('getTemplate', () => {
    it('should return template for objective + style', () => {
      const template = CTATemplates.getTemplate('conversion', 'direct');
      expect(template).toBeDefined();
      expect(template.structure).toBeDefined();
    });

    it('should provide fallback for unknown combination', () => {
      const template = CTATemplates.getTemplate('awareness', 'unknown' as any);
      expect(template).toBeDefined();
    });
  });
});

describe('UrgencyCalculator', () => {
  describe('calculateUrgency', () => {
    it('should return "extreme" for under 1 hour', () => {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      const urgency = UrgencyCalculator.calculate(expiresAt);
      expect(urgency.level).toBe('extreme');
    });

    it('should return "high" for under 24 hours', () => {
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours
      const urgency = UrgencyCalculator.calculate(expiresAt);
      expect(urgency.level).toBe('high');
    });

    it('should return "medium" for under 7 days', () => {
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
      const urgency = UrgencyCalculator.calculate(expiresAt);
      expect(urgency.level).toBe('medium');
    });

    it('should return "low" for over 7 days', () => {
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
      const urgency = UrgencyCalculator.calculate(expiresAt);
      expect(urgency.level).toBe('low');
    });

    it('should return "none" for no expiration', () => {
      const urgency = UrgencyCalculator.calculate(null);
      expect(urgency.level).toBe('none');
    });

    it('should provide human-readable time phrase', () => {
      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
      const urgency = UrgencyCalculator.calculate(expiresAt);
      expect(urgency.phrase).toMatch(/2 days|48 hours/);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Define CTA Types

```typescript
// packages/agents/copy/src/cta/types.ts

import { z } from 'zod';
import { Platform } from '../prompts/types';

export const OfferTypeSchema = z.enum([
  'discount',
  'free_trial',
  'free_consultation',
  'bundle',
  'exclusive',
  'early_access',
  'limited_time',
  'bonus'
]);

export type OfferType = z.infer<typeof OfferTypeSchema>;

export const OfferSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: OfferTypeSchema,
  value: z.string(), // e.g., "25% off", "Free for 30 days"
  headline: z.string(),
  expiresAt: z.string().nullable(),
  isActive: z.boolean()
});

export type Offer = z.infer<typeof OfferSchema>;

export const CTAStyleSchema = z.enum([
  'direct',       // "Click the link in bio now"
  'question',     // "Ready to transform your business?"
  'urgency',      // "Don't miss out - offer ends tonight!"
  'benefit',      // "Start saving 25% today"
  'social_proof', // "Join 10,000+ who already..."
  'curiosity'     // "See what's inside..."
]);

export type CTAStyle = z.infer<typeof CTAStyleSchema>;

export const CTAObjectiveSchema = z.enum([
  'awareness',   // Follow, save, share
  'engagement',  // Comment, like, reply
  'conversion',  // Click, sign up, buy
  'retention'    // Stay, continue, return
]);

export type CTAObjective = z.infer<typeof CTAObjectiveSchema>;

export const LinkPlacementSchema = z.enum([
  'in_bio',
  'inline',
  'first_comment',
  'swipe_up'
]);

export type LinkPlacement = z.infer<typeof LinkPlacementSchema>;

export interface CTARequest {
  platform: Platform;
  objective: CTAObjective;
  clientId: string;
  offer?: Offer;
  style?: CTAStyle;
  styles?: CTAStyle[];
  variantCount?: number;
  customAction?: string;
  customDestination?: string;
  linkPlacement?: LinkPlacement;
}

export interface CTAVariant {
  text: string;
  style: CTAStyle;
  objective: CTAObjective;
  includesOffer: boolean;
  urgencyLevel?: string;
}

export interface CTAResult {
  primary: CTAVariant;
  variants: CTAVariant[];
  offerUsed?: Offer;
  generatedAt: string;
}

export interface OfferLoader {
  getActiveOffer(clientId: string): Promise<Offer | null>;
}

export interface UrgencyInfo {
  level: 'none' | 'low' | 'medium' | 'high' | 'extreme';
  phrase: string;
  timeRemaining?: string;
}
```

#### Step 2: Implement Urgency Calculator

```typescript
// packages/agents/copy/src/cta/urgency-calculator.ts

import { differenceInHours, differenceInDays, formatDistanceToNow } from 'date-fns';
import { UrgencyInfo } from './types';

export class UrgencyCalculator {
  static calculate(expiresAt: Date | string | null): UrgencyInfo {
    if (!expiresAt) {
      return {
        level: 'none',
        phrase: ''
      };
    }

    const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    const now = new Date();

    if (expiry <= now) {
      return {
        level: 'none',
        phrase: 'expired'
      };
    }

    const hoursRemaining = differenceInHours(expiry, now);
    const daysRemaining = differenceInDays(expiry, now);

    if (hoursRemaining < 1) {
      return {
        level: 'extreme',
        phrase: 'expires in less than an hour',
        timeRemaining: formatDistanceToNow(expiry, { addSuffix: true })
      };
    }

    if (hoursRemaining < 24) {
      return {
        level: 'high',
        phrase: `expires in ${hoursRemaining} hours`,
        timeRemaining: `${hoursRemaining} hours`
      };
    }

    if (daysRemaining < 7) {
      return {
        level: 'medium',
        phrase: `ends in ${daysRemaining} days`,
        timeRemaining: `${daysRemaining} days`
      };
    }

    return {
      level: 'low',
      phrase: `available for ${daysRemaining} more days`,
      timeRemaining: `${daysRemaining} days`
    };
  }

  static getUrgencyPhrases(level: UrgencyInfo['level']): string[] {
    const phrases: Record<UrgencyInfo['level'], string[]> = {
      none: [],
      low: [
        'Limited availability',
        'While supplies last'
      ],
      medium: [
        'Don\'t wait too long',
        'Time is running out',
        'Offer ending soon'
      ],
      high: [
        'Last chance',
        'Final hours',
        'Ends today',
        'Don\'t miss out'
      ],
      extreme: [
        'FINAL HOUR',
        'Ending NOW',
        'Last minutes',
        'Act immediately'
      ]
    };

    return phrases[level];
  }
}
```

#### Step 3: Implement CTA Templates

```typescript
// packages/agents/copy/src/cta/cta-templates.ts

import { CTAObjective, CTAStyle } from './types';

export interface CTATemplate {
  structure: string;
  examples: string[];
  guidelines: string[];
}

const TEMPLATES: Record<CTAObjective, Record<CTAStyle, CTATemplate>> = {
  conversion: {
    direct: {
      structure: '[Action verb] + [destination] + [benefit/offer]',
      examples: [
        'Click the link in bio to get started',
        'Tap the link to claim your spot',
        'Head to our website to learn more'
      ],
      guidelines: [
        'Use clear, commanding action verbs',
        'Be specific about where they should go',
        'Keep it under 10 words'
      ]
    },
    question: {
      structure: '[Question about desire] + [Action suggestion]',
      examples: [
        'Ready to transform your business? Link in bio',
        'Want to see results like this? Tap the link',
        'Curious how we did it? Details in bio'
      ],
      guidelines: [
        'Ask about their desired outcome',
        'Make the question rhetorical',
        'Follow immediately with action'
      ]
    },
    urgency: {
      structure: '[Time constraint] + [Action] + [Consequence of missing]',
      examples: [
        'Offer ends tonight - grab yours now',
        'Only 5 spots left - secure yours in bio',
        'Last chance! Link expires at midnight'
      ],
      guidelines: [
        'Be specific about the deadline',
        'Create FOMO without being deceptive',
        'Make the scarcity real'
      ]
    },
    benefit: {
      structure: '[Start/Get] + [Specific benefit] + [Today/Now]',
      examples: [
        'Start saving 25% today - link in bio',
        'Get your free guide now - tap the link',
        'Unlock exclusive access - details in bio'
      ],
      guidelines: [
        'Lead with the benefit, not the action',
        'Be specific about what they get',
        'Use "your" to make it personal'
      ]
    },
    social_proof: {
      structure: '[Join/See what] + [Social proof] + [Action]',
      examples: [
        'Join 10,000+ who already transformed - link in bio',
        'See why 500+ left 5-star reviews - tap to learn',
        'Don\'t be the last to know - details in bio'
      ],
      guidelines: [
        'Use specific numbers when possible',
        'Reference relatable peer groups',
        'Create belonging motivation'
      ]
    },
    curiosity: {
      structure: '[Tease] + [Reveal promise] + [Action]',
      examples: [
        'The secret is inside - link in bio',
        'You won\'t believe what\'s included - tap to see',
        'This changes everything - details in bio'
      ],
      guidelines: [
        'Create an open loop',
        'Promise revelation without clickbait',
        'Make curiosity the motivator'
      ]
    }
  },
  engagement: {
    direct: {
      structure: '[Engagement action] + [Reason/Benefit]',
      examples: [
        'Drop a 🔥 if you agree',
        'Comment your thoughts below',
        'Double tap if this resonates'
      ],
      guidelines: [
        'Make the action easy and specific',
        'Give a reason to engage',
        'Use emojis to reduce friction'
      ]
    },
    question: {
      structure: '[Open-ended question] + [Invitation to share]',
      examples: [
        'What\'s your biggest challenge? Tell me in the comments',
        'Which option would you choose? A or B?',
        'Have you experienced this? Share below'
      ],
      guidelines: [
        'Ask questions they want to answer',
        'Make it about their experience',
        'Use multiple choice for easier engagement'
      ]
    },
    urgency: {
      structure: '[Time-bound engagement] + [Action]',
      examples: [
        'First 10 comments get a personal reply',
        'Comment in the next hour for a shoutout',
        'Today only - I\'m replying to everyone'
      ],
      guidelines: [
        'Create time-bound engagement incentives',
        'Be prepared to follow through',
        'Make early engagement valuable'
      ]
    },
    benefit: {
      structure: '[Benefit of engaging] + [Action]',
      examples: [
        'Save this for later - you\'ll need it',
        'Share with someone who needs this',
        'Comment to get my full guide'
      ],
      guidelines: [
        'Show the value of engagement',
        'Make saving/sharing feel beneficial',
        'Offer bonus for engagement'
      ]
    },
    social_proof: {
      structure: '[Others are doing X] + [Join them]',
      examples: [
        'Everyone is talking about this - what do you think?',
        'This post is blowing up - add your take',
        'The community wants to know your thoughts'
      ],
      guidelines: [
        'Show engagement momentum',
        'Create community feeling',
        'Make them part of conversation'
      ]
    },
    curiosity: {
      structure: '[Tease more content] + [Engagement action]',
      examples: [
        'Part 2 drops when this hits 100 comments',
        'Comment "YES" to unlock the full breakdown',
        'The answer might surprise you - guess in comments'
      ],
      guidelines: [
        'Gate additional content behind engagement',
        'Create anticipation for more',
        'Make engagement unlock value'
      ]
    }
  },
  awareness: {
    direct: {
      structure: '[Follow/Save] + [What they\'ll get]',
      examples: [
        'Follow for daily tips like this',
        'Save this post for later',
        'Turn on notifications to not miss the next one'
      ],
      guidelines: [
        'Focus on following or saving',
        'Promise future value',
        'Keep it simple'
      ]
    },
    question: {
      structure: '[Question about following] + [Value promise]',
      examples: [
        'Want more content like this? Hit follow',
        'Ready for more? Follow for part 2',
        'Enjoying this? Follow for more'
      ],
      guidelines: [
        'Check if they want more',
        'Promise continued value',
        'Make following logical next step'
      ]
    },
    urgency: {
      structure: '[Don\'t miss] + [Follow action]',
      examples: [
        'Don\'t miss tomorrow\'s reveal - follow now',
        'Big announcement coming - make sure you\'re following',
        'You won\'t want to miss what\'s next'
      ],
      guidelines: [
        'Create anticipation for future content',
        'Make following urgent',
        'Tease upcoming content'
      ]
    },
    benefit: {
      structure: '[Following benefit] + [Action]',
      examples: [
        'Get free tips every day - hit follow',
        'Join our community of 50k learners',
        'Follow to stay ahead of trends'
      ],
      guidelines: [
        'Lead with what following provides',
        'Show community size',
        'Make following valuable'
      ]
    },
    social_proof: {
      structure: '[Others follow because] + [Join them]',
      examples: [
        '50k+ follow for insights like this',
        'Join thousands who never miss a post',
        'See why industry leaders follow us'
      ],
      guidelines: [
        'Show follower count',
        'Reference who follows',
        'Create FOMO on following'
      ]
    },
    curiosity: {
      structure: '[Tease future content] + [Follow to see]',
      examples: [
        'Wait until you see what\'s coming next',
        'The best is yet to come - follow to see',
        'Part 2 is even better - don\'t miss it'
      ],
      guidelines: [
        'Create curiosity about future content',
        'Make following necessary to satisfy curiosity',
        'Build anticipation'
      ]
    }
  },
  retention: {
    direct: {
      structure: '[Come back] + [Reason]',
      examples: [
        'See you tomorrow for part 2',
        'Come back next week for results',
        'Stay tuned for the full breakdown'
      ],
      guidelines: [
        'Set expectation for return',
        'Promise specific future value',
        'Create appointment viewing'
      ]
    },
    question: {
      structure: '[Question about returning] + [Promise]',
      examples: [
        'Want to see the results? Check back Thursday',
        'Curious about the outcome? Updates coming',
        'Ready for the conclusion? Tomorrow at 9am'
      ],
      guidelines: [
        'Build curiosity for return',
        'Set specific return time',
        'Make return satisfying'
      ]
    },
    urgency: {
      structure: '[Limited time] + [Return action]',
      examples: [
        'Tomorrow only - don\'t miss it',
        'Live session ends tonight at 9pm',
        'Series finale dropping this week'
      ],
      guidelines: [
        'Create time-bound return incentive',
        'Make missing it feel costly',
        'Be specific about timing'
      ]
    },
    benefit: {
      structure: '[Benefit of returning] + [When]',
      examples: [
        'Full tutorial drops Friday - your transformation starts then',
        'The game-changing strategy coming Monday',
        'Your complete guide releases next week'
      ],
      guidelines: [
        'Lead with what they get on return',
        'Make return valuable',
        'Set clear timing'
      ]
    },
    social_proof: {
      structure: '[Others are waiting] + [Join them]',
      examples: [
        'Thousands are waiting for part 2 - are you?',
        'The community is buzzing for the next episode',
        'Everyone will be watching tomorrow'
      ],
      guidelines: [
        'Show anticipation from others',
        'Create communal waiting',
        'Make return a shared experience'
      ]
    },
    curiosity: {
      structure: '[Unresolved question] + [Return to find out]',
      examples: [
        'Did it work? Find out tomorrow',
        'The surprising result will shock you - coming soon',
        'Wait until you see what happens next'
      ],
      guidelines: [
        'Leave an open loop',
        'Promise resolution on return',
        'Make curiosity unbearable'
      ]
    }
  }
};

export class CTATemplates {
  static getTemplate(objective: CTAObjective, style: CTAStyle): CTATemplate {
    const objectiveTemplates = TEMPLATES[objective];
    if (!objectiveTemplates) {
      return TEMPLATES.conversion.direct;
    }

    const template = objectiveTemplates[style];
    if (!template) {
      return objectiveTemplates.direct;
    }

    return template;
  }

  static getAllStyles(): CTAStyle[] {
    return ['direct', 'question', 'urgency', 'benefit', 'social_proof', 'curiosity'];
  }

  static getStylesForObjective(objective: CTAObjective): CTAStyle[] {
    // All styles work for all objectives, but some are more effective
    const recommended: Record<CTAObjective, CTAStyle[]> = {
      conversion: ['direct', 'urgency', 'benefit'],
      engagement: ['question', 'curiosity', 'direct'],
      awareness: ['benefit', 'social_proof', 'direct'],
      retention: ['curiosity', 'urgency', 'benefit']
    };

    return recommended[objective] || this.getAllStyles();
  }
}
```

#### Step 4: Implement CTA Generator

```typescript
// packages/agents/copy/src/cta/cta-generator.ts

import {
  CTARequest,
  CTAResult,
  CTAVariant,
  CTAStyle,
  Offer,
  OfferLoader,
  LinkPlacement
} from './types';
import { CopyPromptComposer } from '../prompts/prompt-composer';
import { Platform } from '../prompts/types';
import { getPlatformConfig } from '../prompts/platform-config';
import { CTATemplates } from './cta-templates';
import { UrgencyCalculator } from './urgency-calculator';

interface LLMClient {
  chat(request: any): Promise<{ choices: Array<{ message: { content: string } }> }>;
}

interface CTAGeneratorOptions {
  llmClient: LLMClient;
  offerLoader?: OfferLoader;
  brandVoiceLoader?: any;
}

export class CTAGenerator {
  private llmClient: LLMClient;
  private offerLoader?: OfferLoader;
  private brandVoiceLoader?: any;
  private promptComposer: CopyPromptComposer;

  constructor(options: CTAGeneratorOptions) {
    this.llmClient = options.llmClient;
    this.offerLoader = options.offerLoader;
    this.brandVoiceLoader = options.brandVoiceLoader;
    this.promptComposer = new CopyPromptComposer();
  }

  async generate(request: CTARequest): Promise<CTAResult> {
    // Get offer (explicit or from loader)
    const offer = request.offer ||
      (this.offerLoader ? await this.offerLoader.getActiveOffer(request.clientId) : null);

    // Determine styles to generate
    const styles = request.styles ||
      (request.style ? [request.style] : ['direct']);

    // Generate primary CTA
    const primary = await this.generateSingleCTA(request, styles[0], offer);

    // Generate variants
    const variants: CTAVariant[] = [];

    if (request.variantCount && request.variantCount > 1) {
      for (let i = 0; i < request.variantCount; i++) {
        const style = styles[i % styles.length];
        const variant = await this.generateSingleCTA(request, style, offer);
        variants.push(variant);
      }
    } else if (request.styles && request.styles.length > 0) {
      for (const style of request.styles) {
        const variant = await this.generateSingleCTA(request, style, offer);
        variants.push(variant);
      }
    }

    return {
      primary,
      variants,
      offerUsed: offer || undefined,
      generatedAt: new Date().toISOString()
    };
  }

  private async generateSingleCTA(
    request: CTARequest,
    style: CTAStyle,
    offer: Offer | null
  ): Promise<CTAVariant> {
    const template = CTATemplates.getTemplate(request.objective, style);
    const platformConfig = getPlatformConfig(request.platform);
    const linkBehavior = this.getLinkBehavior(request.platform, request.linkPlacement);
    const urgency = offer ? UrgencyCalculator.calculate(offer.expiresAt) : null;

    const systemPrompt = this.buildSystemPrompt(
      request,
      template,
      linkBehavior,
      offer,
      urgency
    );

    const userPrompt = this.buildUserPrompt(request, style, offer);

    const response = await this.llmClient.chat({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    const text = response.choices[0].message.content.trim();

    return {
      text,
      style,
      objective: request.objective,
      includesOffer: !!offer,
      urgencyLevel: urgency?.level
    };
  }

  private buildSystemPrompt(
    request: CTARequest,
    template: any,
    linkBehavior: string,
    offer: Offer | null,
    urgency: any
  ): string {
    let prompt = `You are a conversion copywriter specializing in calls-to-action that drive ${request.objective}.

## Platform: ${request.platform}
- Link placement: ${linkBehavior}
- Keep CTA concise (under 15 words ideal)

## CTA Structure
${template.structure}

## Examples for Reference
${template.examples.map((e: string) => `- ${e}`).join('\n')}

## Guidelines
${template.guidelines.map((g: string) => `- ${g}`).join('\n')}
`;

    if (offer) {
      prompt += `
## Active Offer
- Name: ${offer.name}
- Type: ${offer.type}
- Value: ${offer.value}
- Headline: ${offer.headline}
`;

      if (urgency && urgency.level !== 'none') {
        prompt += `- Urgency: ${urgency.phrase} (level: ${urgency.level})
- Consider using urgency phrases like: ${UrgencyCalculator.getUrgencyPhrases(urgency.level).join(', ')}
`;
      }
    }

    if (request.customAction) {
      prompt += `\n## Specific Action Required\nThe CTA must direct users to: ${request.customAction}\n`;
    }

    if (request.customDestination) {
      prompt += `\n## Destination\nDirect users to: ${request.customDestination}\n`;
    }

    prompt += `
## Output Format
Provide ONLY the CTA text. No explanations, no alternatives, just the final CTA ready to use.
`;

    return prompt;
  }

  private buildUserPrompt(
    request: CTARequest,
    style: CTAStyle,
    offer: Offer | null
  ): string {
    let prompt = `Write a ${style} style CTA for ${request.platform} with ${request.objective} objective.`;

    if (offer) {
      prompt += `\n\nIncorporate the ${offer.type} offer: "${offer.value}"`;
    }

    return prompt;
  }

  private getLinkBehavior(platform: Platform, explicit?: LinkPlacement): string {
    if (explicit) {
      const behaviors: Record<LinkPlacement, string> = {
        in_bio: 'Use "link in bio" or similar phrasing',
        inline: 'Include inline link reference',
        first_comment: 'Reference that link is in first comment',
        swipe_up: 'Use "swipe up" for Stories'
      };
      return behaviors[explicit];
    }

    const config = getPlatformConfig(platform);

    switch (config.linkBehavior) {
      case 'in_bio':
        return 'Use "link in bio" or similar phrasing - no inline links allowed';
      case 'inline':
        return 'Can reference inline link directly';
      case 'first_comment':
        return 'Can mention link in first comment';
      default:
        return 'Reference link appropriately for platform';
    }
  }
}

export { CTATemplates } from './cta-templates';
export { UrgencyCalculator } from './urgency-calculator';
```

#### Step 5: Create Package Exports

```typescript
// packages/agents/copy/src/cta/index.ts

export * from './types';
export * from './cta-generator';
export * from './cta-templates';
export * from './urgency-calculator';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/agents/copy
pnpm test src/cta

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint src/cta
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/copy/src/cta/types.ts` | CTA type definitions |
| Create | `packages/agents/copy/src/cta/urgency-calculator.ts` | Time-based urgency calculation |
| Create | `packages/agents/copy/src/cta/cta-templates.ts` | CTA templates by objective/style |
| Create | `packages/agents/copy/src/cta/cta-generator.ts` | Main CTA generation logic |
| Create | `packages/agents/copy/src/cta/index.ts` | Package exports |
| Create | `packages/agents/copy/src/cta/__tests__/cta-generator.test.ts` | Comprehensive tests |

---

## Acceptance Criteria

- [ ] CTAGenerator produces objective-appropriate CTAs
- [ ] Offer details injected when active offer exists
- [ ] Urgency calculated and applied based on expiration
- [ ] Platform link behavior respected (in_bio vs inline)
- [ ] 6 CTA styles supported (direct, question, urgency, benefit, social_proof, curiosity)
- [ ] 4 objectives supported (awareness, engagement, conversion, retention)
- [ ] Variant generation works with different styles
- [ ] Custom actions and destinations supported
- [ ] Tests pass with >90% coverage

---

## Test Requirements

### Unit Tests
- Basic CTA generation per objective
- Offer injection
- Urgency calculation
- Platform link handling
- Style variations
- Variant generation

### Integration Tests
- Full CTA generation with offer loading
- Multi-style variant generation

---

## Security & Safety Checklist

- [ ] Offer data validated before use
- [ ] No PII in CTA text
- [ ] Compliance rules from constraints applied
- [ ] Urgency claims verified against real expiration
- [ ] Audit logging for generated CTAs

---

## JSON Task Block

```json
{
  "task_id": "S2-C3",
  "name": "CTA Generation",
  "status": "pending",
  "dependencies": ["S2-C1", "S1-A4"],
  "blocks": ["S2-C5"],
  "agent": "C",
  "sprint": 2,
  "complexity": "medium",
  "estimated_files": 4,
  "tdd_required": true,
  "spec_refs": [
    "docs/03-agents-tools/agent-recursion-contracts.md",
    "docs/02-schemas/external-memory-schema.md"
  ],
  "acceptance_checklist": [
    "offer_aware_cta",
    "urgency_calculation",
    "platform_link_behavior",
    "style_variations",
    "objective_adaptation",
    "variant_generation"
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
    { "type": "offer", "scope": "client" },
    { "type": "brand_voice", "scope": "client" }
  ],
  "writes": [
    { "type": "generated_cta", "scope": "content" }
  ],
  "context_window_at_completion": null,
  "continuation_hint": "Verify CTA integrates with offer loading from domain model"
}
```
