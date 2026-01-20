# Build Prompt: S2-C1 — Copy Agent Prompt System

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-C1 |
| Sprint | 2 |
| Agent | C (Copy Generation) |
| Complexity | High |
| Status | pending |
| Estimated Files | 6 |
| Spec References | `agent-recursion-contracts.md`, `external-memory-schema.md`, `rlm-integration-spec.md` |

---

## Context

### What This Builds

The Copy Agent prompt system — the core prompt engineering infrastructure that enables brand-consistent, context-aware copy generation. This system implements dynamic prompt composition using brand voice data from external memory, ensuring every generated caption, hook, and CTA matches the client's established tone.

### Why It Matters

Copy is the voice of content. Without brand voice injection, AI-generated copy sounds generic and disconnected from the client's identity. This system ensures:
- **Brand Consistency**: Every piece of copy reflects client voice characteristics
- **Context Awareness**: Copy adapts to platform, content type, and campaign goals
- **Quality Baseline**: Prompts include guardrails that prevent off-brand output
- **Scalable Voice**: One brand kit enables unlimited on-brand copy generation

### Architecture Decision

The prompt system uses a **composition pattern** rather than monolithic prompts:
1. **Base Layer**: Core copy generation instructions
2. **Brand Layer**: Dynamic voice injection from BrandKit
3. **Context Layer**: Platform, content type, and campaign specifics
4. **Constraint Layer**: Length limits, compliance rules, hashtag requirements

---

## Prerequisites

### Completed Tasks
- [x] S1-A2: BrandKit domain model (brand voice, tone, vocabulary)
- [x] S1-B1: RLM Environment (external memory access)
- [x] S1-B3: Memory references (retrieve brand data)
- [x] S2-B3: Blueprint registry (step execution context)

### Required Packages
```bash
pnpm add zod nanoid
pnpm add -D vitest @types/node
```

### External Services
- OpenAI API (gpt-4o for copy generation)
- Anthropic API (claude-3 alternative)

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests that define the expected behavior:

```typescript
// packages/agents/copy/src/prompts/__tests__/prompt-composer.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CopyPromptComposer,
  PromptLayer,
  ComposedPrompt
} from '../prompt-composer';
import { BrandVoice, CopyContext } from '../types';

describe('CopyPromptComposer', () => {
  let composer: CopyPromptComposer;

  beforeEach(() => {
    composer = new CopyPromptComposer();
  });

  describe('base layer composition', () => {
    it('should include role and task instructions', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram'
      });

      expect(prompt.system).toContain('social media copywriter');
      expect(prompt.system).toContain('caption');
    });

    it('should adapt base instructions per copy type', () => {
      const captionPrompt = composer.compose({ copyType: 'caption', platform: 'instagram' });
      const hookPrompt = composer.compose({ copyType: 'hook', platform: 'tiktok' });
      const ctaPrompt = composer.compose({ copyType: 'cta', platform: 'facebook' });

      expect(captionPrompt.system).not.toBe(hookPrompt.system);
      expect(hookPrompt.system).not.toBe(ctaPrompt.system);
    });
  });

  describe('brand voice injection', () => {
    const brandVoice: BrandVoice = {
      tone: ['professional', 'warm', 'empowering'],
      personality: 'Knowledgeable mentor who speaks with confidence but never condescension',
      vocabulary: {
        preferred: ['empower', 'transform', 'journey', 'growth'],
        avoided: ['cheap', 'guarantee', 'best', 'amazing'],
        industry: ['ROI', 'conversion', 'funnel', 'engagement']
      },
      sentenceStyle: 'Mix of short punchy statements and medium-length explanatory sentences',
      emojiUsage: 'Minimal and purposeful, max 2-3 per post'
    };

    it('should inject brand tone into system prompt', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        brandVoice
      });

      expect(prompt.system).toContain('professional');
      expect(prompt.system).toContain('warm');
      expect(prompt.system).toContain('empowering');
    });

    it('should include preferred vocabulary guidance', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        brandVoice
      });

      expect(prompt.system).toContain('empower');
      expect(prompt.system).toContain('transform');
    });

    it('should include vocabulary to avoid', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        brandVoice
      });

      expect(prompt.system).toContain('AVOID');
      expect(prompt.system).toContain('cheap');
      expect(prompt.system).toContain('guarantee');
    });

    it('should describe personality in prompt', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        brandVoice
      });

      expect(prompt.system).toContain('mentor');
      expect(prompt.system).toContain('confidence');
    });

    it('should include emoji usage guidelines', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        brandVoice
      });

      expect(prompt.system).toContain('emoji');
      expect(prompt.system).toContain('max 2-3');
    });
  });

  describe('platform context layer', () => {
    it('should include Instagram-specific constraints', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram'
      });

      expect(prompt.system).toContain('2,200');
      expect(prompt.system).toContain('hashtag');
    });

    it('should include TikTok-specific constraints', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'tiktok'
      });

      expect(prompt.system).toContain('2,200');
      expect(prompt.system).toContain('hashtag');
      expect(prompt.system).toContain('FYP');
    });

    it('should include LinkedIn-specific constraints', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'linkedin'
      });

      expect(prompt.system).toContain('3,000');
      expect(prompt.system).toContain('professional');
    });

    it('should include X/Twitter-specific constraints', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'x'
      });

      expect(prompt.system).toContain('280');
    });
  });

  describe('campaign context injection', () => {
    it('should include campaign objectives', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        campaign: {
          name: 'Summer Launch',
          objective: 'awareness',
          keyMessages: ['New product launch', 'Limited time offer']
        }
      });

      expect(prompt.system).toContain('awareness');
      expect(prompt.system).toContain('Summer Launch');
    });

    it('should include key messages to incorporate', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        campaign: {
          name: 'Promo',
          objective: 'conversion',
          keyMessages: ['50% off', 'Ends Friday']
        }
      });

      expect(prompt.system).toContain('50% off');
      expect(prompt.system).toContain('Ends Friday');
    });
  });

  describe('constraint layer', () => {
    it('should enforce character limits', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        constraints: {
          maxLength: 150,
          minLength: 50
        }
      });

      expect(prompt.system).toContain('150');
      expect(prompt.system).toContain('50');
    });

    it('should include hashtag constraints', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        constraints: {
          hashtagCount: { min: 5, max: 15 }
        }
      });

      expect(prompt.system).toContain('5');
      expect(prompt.system).toContain('15');
    });

    it('should include compliance rules', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        constraints: {
          compliance: ['No income claims', 'Must include disclaimer']
        }
      });

      expect(prompt.system).toContain('income claims');
      expect(prompt.system).toContain('disclaimer');
    });
  });

  describe('full composition', () => {
    it('should compose all layers in correct order', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        brandVoice: {
          tone: ['professional'],
          personality: 'Expert advisor',
          vocabulary: { preferred: [], avoided: [], industry: [] },
          sentenceStyle: 'Concise',
          emojiUsage: 'None'
        },
        campaign: {
          name: 'Test Campaign',
          objective: 'engagement',
          keyMessages: []
        },
        constraints: {
          maxLength: 200
        }
      });

      // Verify layer order (base -> brand -> platform -> campaign -> constraints)
      const systemPrompt = prompt.system;
      const baseIndex = systemPrompt.indexOf('social media copywriter');
      const brandIndex = systemPrompt.indexOf('professional');
      const platformIndex = systemPrompt.indexOf('Instagram');
      const constraintIndex = systemPrompt.indexOf('200');

      expect(baseIndex).toBeLessThan(brandIndex);
      expect(brandIndex).toBeLessThan(platformIndex);
      expect(platformIndex).toBeLessThan(constraintIndex);
    });

    it('should generate valid user prompt', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram'
      });

      expect(prompt.user).toBeDefined();
      expect(prompt.user).toContain('caption');
    });

    it('should include structured output instructions', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        outputFormat: 'json'
      });

      expect(prompt.system).toContain('JSON');
    });
  });
});

describe('BrandVoiceLoader', () => {
  it('should load brand voice from external memory', async () => {
    const mockMemory = {
      retrieve: vi.fn().mockResolvedValue({
        tone: ['friendly'],
        personality: 'Helpful friend',
        vocabulary: { preferred: [], avoided: [], industry: [] },
        sentenceStyle: 'Casual',
        emojiUsage: 'Moderate'
      })
    };

    const loader = new BrandVoiceLoader(mockMemory);
    const voice = await loader.loadForClient('client-123');

    expect(mockMemory.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-123',
        type: 'brand_voice'
      })
    );
    expect(voice.tone).toContain('friendly');
  });

  it('should return default voice if none configured', async () => {
    const mockMemory = {
      retrieve: vi.fn().mockResolvedValue(null)
    };

    const loader = new BrandVoiceLoader(mockMemory);
    const voice = await loader.loadForClient('client-123');

    expect(voice).toBeDefined();
    expect(voice.tone).toContain('professional');
  });
});

describe('PromptTemplate', () => {
  it('should support variable interpolation', () => {
    const template = new PromptTemplate(
      'Write a {{copyType}} for {{platform}} about {{topic}}'
    );

    const result = template.render({
      copyType: 'caption',
      platform: 'Instagram',
      topic: 'product launch'
    });

    expect(result).toBe('Write a caption for Instagram about product launch');
  });

  it('should handle missing variables gracefully', () => {
    const template = new PromptTemplate(
      'Write about {{topic}}'
    );

    const result = template.render({});

    expect(result).toContain('{{topic}}');
  });

  it('should support conditional sections', () => {
    const template = new PromptTemplate(
      'Write copy{{#if campaign}} for campaign: {{campaign}}{{/if}}'
    );

    const withCampaign = template.render({ campaign: 'Summer Sale' });
    const withoutCampaign = template.render({});

    expect(withCampaign).toContain('Summer Sale');
    expect(withoutCampaign).not.toContain('for campaign');
  });
});
```

### Phase 2: Implementation

#### Step 1: Define Types

```typescript
// packages/agents/copy/src/prompts/types.ts

import { z } from 'zod';

export const BrandVoiceSchema = z.object({
  tone: z.array(z.string()).min(1).max(5),
  personality: z.string().min(10).max(500),
  vocabulary: z.object({
    preferred: z.array(z.string()),
    avoided: z.array(z.string()),
    industry: z.array(z.string())
  }),
  sentenceStyle: z.string(),
  emojiUsage: z.string()
});

export type BrandVoice = z.infer<typeof BrandVoiceSchema>;

export const CopyTypeSchema = z.enum([
  'caption',
  'hook',
  'cta',
  'headline',
  'bio',
  'comment_reply',
  'dm_response'
]);

export type CopyType = z.infer<typeof CopyTypeSchema>;

export const PlatformSchema = z.enum([
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'x',
  'skool'
]);

export type Platform = z.infer<typeof PlatformSchema>;

export const CampaignContextSchema = z.object({
  name: z.string(),
  objective: z.enum(['awareness', 'engagement', 'conversion', 'retention']),
  keyMessages: z.array(z.string())
});

export type CampaignContext = z.infer<typeof CampaignContextSchema>;

export const CopyConstraintsSchema = z.object({
  maxLength: z.number().optional(),
  minLength: z.number().optional(),
  hashtagCount: z.object({
    min: z.number(),
    max: z.number()
  }).optional(),
  compliance: z.array(z.string()).optional(),
  mustInclude: z.array(z.string()).optional(),
  mustAvoid: z.array(z.string()).optional()
});

export type CopyConstraints = z.infer<typeof CopyConstraintsSchema>;

export interface CopyContext {
  copyType: CopyType;
  platform: Platform;
  brandVoice?: BrandVoice;
  campaign?: CampaignContext;
  constraints?: CopyConstraints;
  outputFormat?: 'text' | 'json';
  topic?: string;
  contentDescription?: string;
}

export interface ComposedPrompt {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface PromptLayer {
  name: string;
  priority: number;
  content: string;
}
```

#### Step 2: Create Platform Configurations

```typescript
// packages/agents/copy/src/prompts/platform-config.ts

import { Platform } from './types';

export interface PlatformConfig {
  name: string;
  captionMaxLength: number;
  hashtagLimit: number;
  mentionLimit: number;
  linkBehavior: 'in_bio' | 'inline' | 'first_comment';
  characteristics: string[];
  audienceExpectations: string[];
  bestPractices: string[];
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  instagram: {
    name: 'Instagram',
    captionMaxLength: 2200,
    hashtagLimit: 30,
    mentionLimit: 20,
    linkBehavior: 'in_bio',
    characteristics: [
      'Visual-first platform',
      'Hashtags drive discovery',
      'Stories for ephemeral content',
      'Reels for algorithm boost'
    ],
    audienceExpectations: [
      'Polished, aesthetic content',
      'Behind-the-scenes authenticity',
      'Engagement through questions and polls',
      'Value-driven captions'
    ],
    bestPractices: [
      'Front-load important information',
      'Use line breaks for readability',
      'Include call-to-action',
      'Place hashtags at end or in first comment',
      'Optimal hashtag count: 5-15'
    ]
  },
  facebook: {
    name: 'Facebook',
    captionMaxLength: 63206,
    hashtagLimit: 10,
    mentionLimit: 50,
    linkBehavior: 'inline',
    characteristics: [
      'Community-focused',
      'Groups drive engagement',
      'Longer content acceptable',
      'Link posts perform well'
    ],
    audienceExpectations: [
      'Personal, relatable content',
      'Community building',
      'Event promotion',
      'Detailed information'
    ],
    bestPractices: [
      'Keep captions under 80 characters for engagement',
      'Use 1-2 hashtags maximum',
      'Include native video when possible',
      'Post during lunch and evening hours'
    ]
  },
  tiktok: {
    name: 'TikTok',
    captionMaxLength: 2200,
    hashtagLimit: 6,
    mentionLimit: 10,
    linkBehavior: 'in_bio',
    characteristics: [
      'Short-form video dominant',
      'Trend-driven culture',
      'Sound/music integral',
      'FYP algorithm rewards engagement'
    ],
    audienceExpectations: [
      'Authentic, unpolished content',
      'Entertainment value',
      'Trend participation',
      'Quick hooks (0-3 seconds)'
    ],
    bestPractices: [
      'Hook in first 1-3 seconds',
      'Use trending sounds',
      'Hashtags: mix of broad and niche',
      'FYP, viral hashtags sparingly',
      'Caption supports video, not standalone'
    ]
  },
  youtube: {
    name: 'YouTube',
    captionMaxLength: 5000,
    hashtagLimit: 15,
    mentionLimit: 50,
    linkBehavior: 'inline',
    characteristics: [
      'Long-form video platform',
      'Search-driven discovery',
      'Shorts competing with TikTok',
      'Comments build community'
    ],
    audienceExpectations: [
      'Educational or entertainment value',
      'Production quality',
      'Consistent posting schedule',
      'Creator authenticity'
    ],
    bestPractices: [
      'Description front-loads keywords',
      'Include timestamps for long videos',
      'CTAs: subscribe, like, comment',
      'Shorts: vertical, 60 seconds max'
    ]
  },
  linkedin: {
    name: 'LinkedIn',
    captionMaxLength: 3000,
    hashtagLimit: 5,
    mentionLimit: 30,
    linkBehavior: 'inline',
    characteristics: [
      'Professional networking',
      'Thought leadership',
      'B2B focus',
      'Career content'
    ],
    audienceExpectations: [
      'Professional, polished tone',
      'Industry insights',
      'Career advice',
      'Company culture'
    ],
    bestPractices: [
      'First line is the hook (before "see more")',
      '3-5 hashtags maximum',
      'Personal stories perform well',
      'Native documents get high reach',
      'Avoid external links in post (use comments)'
    ]
  },
  x: {
    name: 'X (Twitter)',
    captionMaxLength: 280,
    hashtagLimit: 2,
    mentionLimit: 10,
    linkBehavior: 'inline',
    characteristics: [
      'Real-time conversation',
      'News and trending topics',
      'Thread culture',
      'High velocity'
    ],
    audienceExpectations: [
      'Concise, punchy content',
      'Hot takes and opinions',
      'Engagement with trends',
      'Quick wit'
    ],
    bestPractices: [
      'Under 280 characters (or threads)',
      '1-2 hashtags maximum',
      'Questions drive engagement',
      'Visual tweets perform better'
    ]
  },
  skool: {
    name: 'Skool',
    captionMaxLength: 10000,
    hashtagLimit: 0,
    mentionLimit: 50,
    linkBehavior: 'inline',
    characteristics: [
      'Community-first platform',
      'Course integration',
      'Discussion-focused',
      'Membership model'
    ],
    audienceExpectations: [
      'High-value content',
      'Community engagement',
      'Educational material',
      'Personal connection'
    ],
    bestPractices: [
      'Lead with value',
      'Encourage discussion',
      'Reference course materials',
      'Build relationships'
    ]
  }
};

export function getPlatformConfig(platform: Platform): PlatformConfig {
  return PLATFORM_CONFIGS[platform];
}
```

#### Step 3: Create Base Prompt Templates

```typescript
// packages/agents/copy/src/prompts/base-templates.ts

import { CopyType } from './types';

export interface BaseTemplate {
  role: string;
  task: string;
  guidelines: string[];
  outputFormat: string;
}

export const BASE_TEMPLATES: Record<CopyType, BaseTemplate> = {
  caption: {
    role: 'You are an expert social media copywriter who creates engaging, on-brand captions that drive action.',
    task: 'Write a social media caption that captures attention, delivers value, and encourages engagement.',
    guidelines: [
      'Open with a hook that stops the scroll',
      'Deliver value or evoke emotion in the body',
      'End with a clear call-to-action',
      'Use line breaks for readability',
      'Match the platform\'s native style'
    ],
    outputFormat: 'Provide the caption text only, formatted for the platform.'
  },
  hook: {
    role: 'You are a master of attention-grabbing hooks that stop scrollers in their tracks.',
    task: 'Create an opening hook (first 1-3 seconds equivalent in text) that makes viewers need to see more.',
    guidelines: [
      'Create immediate curiosity or intrigue',
      'Use pattern interrupts',
      'Promise value or revelation',
      'Keep it under 10 words when possible',
      'Make it specific, not generic'
    ],
    outputFormat: 'Provide only the hook text, nothing else.'
  },
  cta: {
    role: 'You are a conversion-focused copywriter specializing in calls-to-action that drive specific user behavior.',
    task: 'Write a compelling call-to-action that motivates the reader to take the next step.',
    guidelines: [
      'Be specific about the action',
      'Create urgency when appropriate',
      'Highlight the benefit of taking action',
      'Remove friction and objections',
      'Use active, commanding verbs'
    ],
    outputFormat: 'Provide the CTA text only.'
  },
  headline: {
    role: 'You are a headline specialist who creates curiosity-driving titles that demand clicks.',
    task: 'Write a headline that captures attention and promises value.',
    guidelines: [
      'Use numbers or specific data when relevant',
      'Create a curiosity gap',
      'Promise a clear benefit',
      'Keep under 60 characters for most platforms',
      'Avoid clickbait that under-delivers'
    ],
    outputFormat: 'Provide the headline only.'
  },
  bio: {
    role: 'You are a personal branding expert who crafts bios that establish authority and drive action.',
    task: 'Write a bio that communicates value, builds trust, and encourages follow/connection.',
    guidelines: [
      'Lead with the transformation you provide',
      'Include social proof if available',
      'Mention your unique angle',
      'Include relevant keywords',
      'End with a CTA or where to find you'
    ],
    outputFormat: 'Provide the bio text formatted for the platform character limit.'
  },
  comment_reply: {
    role: 'You are a community manager skilled at turning comments into meaningful conversations and relationships.',
    task: 'Write a reply to a comment that builds connection and encourages further engagement.',
    guidelines: [
      'Acknowledge the commenter personally',
      'Add value beyond just "thanks"',
      'Ask a follow-up question when appropriate',
      'Keep the brand voice consistent',
      'Never be defensive or dismissive'
    ],
    outputFormat: 'Provide the reply text only.'
  },
  dm_response: {
    role: 'You are a relationship-focused communicator who turns DMs into meaningful conversations.',
    task: 'Write a direct message response that builds trust and moves the conversation forward.',
    guidelines: [
      'Be personal and conversational',
      'Answer questions directly',
      'Provide value without being salesy',
      'Include a soft next step',
      'Respect their time'
    ],
    outputFormat: 'Provide the DM response only.'
  }
};

export function getBaseTemplate(copyType: CopyType): BaseTemplate {
  return BASE_TEMPLATES[copyType];
}
```

#### Step 4: Implement Prompt Composer

```typescript
// packages/agents/copy/src/prompts/prompt-composer.ts

import { nanoid } from 'nanoid';
import {
  CopyContext,
  ComposedPrompt,
  PromptLayer,
  BrandVoice,
  CopyConstraints,
  Platform,
  CopyType
} from './types';
import { getBaseTemplate, BASE_TEMPLATES } from './base-templates';
import { getPlatformConfig, PLATFORM_CONFIGS } from './platform-config';

export class CopyPromptComposer {
  private layers: PromptLayer[] = [];

  compose(context: CopyContext): ComposedPrompt {
    this.layers = [];

    // Layer 1: Base instructions
    this.addBaseLayer(context.copyType);

    // Layer 2: Brand voice (if provided)
    if (context.brandVoice) {
      this.addBrandLayer(context.brandVoice);
    }

    // Layer 3: Platform specifics
    this.addPlatformLayer(context.platform);

    // Layer 4: Campaign context (if provided)
    if (context.campaign) {
      this.addCampaignLayer(context.campaign);
    }

    // Layer 5: Constraints
    if (context.constraints) {
      this.addConstraintLayer(context.constraints, context.platform);
    }

    // Layer 6: Output format
    this.addOutputFormatLayer(context.outputFormat || 'text');

    // Compose final prompt
    return this.buildPrompt(context);
  }

  private addBaseLayer(copyType: CopyType): void {
    const template = getBaseTemplate(copyType);

    const content = `
## Role
${template.role}

## Task
${template.task}

## Core Guidelines
${template.guidelines.map(g => `- ${g}`).join('\n')}
`;

    this.layers.push({
      name: 'base',
      priority: 1,
      content
    });
  }

  private addBrandLayer(voice: BrandVoice): void {
    const toneList = voice.tone.join(', ');
    const preferredWords = voice.vocabulary.preferred.join(', ');
    const avoidedWords = voice.vocabulary.avoided.join(', ');
    const industryTerms = voice.vocabulary.industry.join(', ');

    const content = `
## Brand Voice

### Tone
Write with a ${toneList} tone throughout.

### Personality
${voice.personality}

### Vocabulary Guidelines
**PREFER these words/phrases:** ${preferredWords || 'No specific preferences'}
**AVOID these words/phrases:** ${avoidedWords || 'No specific restrictions'}
**Industry terms to use naturally:** ${industryTerms || 'None specified'}

### Writing Style
${voice.sentenceStyle}

### Emoji Usage
${voice.emojiUsage}
`;

    this.layers.push({
      name: 'brand',
      priority: 2,
      content
    });
  }

  private addPlatformLayer(platform: Platform): void {
    const config = getPlatformConfig(platform);

    const content = `
## Platform: ${config.name}

### Platform Characteristics
${config.characteristics.map(c => `- ${c}`).join('\n')}

### Audience Expectations on ${config.name}
${config.audienceExpectations.map(e => `- ${e}`).join('\n')}

### Best Practices
${config.bestPractices.map(p => `- ${p}`).join('\n')}

### Technical Limits
- Maximum caption length: ${config.captionMaxLength} characters
- Maximum hashtags: ${config.hashtagLimit}
- Link handling: ${config.linkBehavior === 'in_bio' ? 'Direct viewers to link in bio' : 'Links can be included inline'}
`;

    this.layers.push({
      name: 'platform',
      priority: 3,
      content
    });
  }

  private addCampaignLayer(campaign: { name: string; objective: string; keyMessages: string[] }): void {
    const content = `
## Campaign Context

### Campaign: ${campaign.name}
**Objective:** ${campaign.objective}

### Key Messages to Incorporate
${campaign.keyMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Weave these messages naturally into the copy without being overtly promotional.
`;

    this.layers.push({
      name: 'campaign',
      priority: 4,
      content
    });
  }

  private addConstraintLayer(constraints: CopyConstraints, platform: Platform): void {
    const parts: string[] = ['## Constraints'];

    if (constraints.maxLength) {
      parts.push(`- Maximum length: ${constraints.maxLength} characters`);
    }
    if (constraints.minLength) {
      parts.push(`- Minimum length: ${constraints.minLength} characters`);
    }
    if (constraints.hashtagCount) {
      parts.push(`- Hashtag count: between ${constraints.hashtagCount.min} and ${constraints.hashtagCount.max}`);
    }
    if (constraints.mustInclude?.length) {
      parts.push(`- MUST include: ${constraints.mustInclude.join(', ')}`);
    }
    if (constraints.mustAvoid?.length) {
      parts.push(`- MUST NOT include: ${constraints.mustAvoid.join(', ')}`);
    }
    if (constraints.compliance?.length) {
      parts.push('\n### Compliance Requirements');
      constraints.compliance.forEach(c => parts.push(`- ${c}`));
    }

    this.layers.push({
      name: 'constraints',
      priority: 5,
      content: parts.join('\n')
    });
  }

  private addOutputFormatLayer(format: 'text' | 'json'): void {
    let content: string;

    if (format === 'json') {
      content = `
## Output Format
Respond with valid JSON in the following structure:
{
  "copy": "The generated copy text",
  "hashtags": ["array", "of", "hashtags"],
  "characterCount": 123,
  "alternateVersions": ["optional alternate version"]
}
`;
    } else {
      content = `
## Output Format
Provide only the final copy text, ready to use. Do not include explanations or alternatives unless specifically requested.
`;
    }

    this.layers.push({
      name: 'output',
      priority: 6,
      content
    });
  }

  private buildPrompt(context: CopyContext): ComposedPrompt {
    // Sort layers by priority
    const sortedLayers = [...this.layers].sort((a, b) => a.priority - b.priority);

    // Build system prompt
    const systemPrompt = sortedLayers.map(l => l.content).join('\n\n---\n');

    // Build user prompt
    const userPrompt = this.buildUserPrompt(context);

    return {
      system: systemPrompt,
      user: userPrompt,
      model: this.selectModel(context),
      temperature: this.selectTemperature(context),
      maxTokens: this.calculateMaxTokens(context)
    };
  }

  private buildUserPrompt(context: CopyContext): string {
    const parts: string[] = [];

    parts.push(`Write a ${context.copyType} for ${context.platform}.`);

    if (context.topic) {
      parts.push(`\nTopic: ${context.topic}`);
    }

    if (context.contentDescription) {
      parts.push(`\nContent Description: ${context.contentDescription}`);
    }

    return parts.join('\n');
  }

  private selectModel(context: CopyContext): string {
    // Use GPT-4o for complex copy, 3.5 for simpler tasks
    const complexTypes: CopyType[] = ['caption', 'bio', 'dm_response'];
    return complexTypes.includes(context.copyType) ? 'gpt-4o' : 'gpt-4o-mini';
  }

  private selectTemperature(context: CopyContext): number {
    // Higher temperature for creative copy, lower for replies
    const creativeTypes: CopyType[] = ['hook', 'headline', 'caption'];
    return creativeTypes.includes(context.copyType) ? 0.8 : 0.6;
  }

  private calculateMaxTokens(context: CopyContext): number {
    const config = getPlatformConfig(context.platform);
    // Estimate: 1 token ≈ 4 characters, add buffer
    return Math.ceil((context.constraints?.maxLength || config.captionMaxLength) / 3);
  }
}
```

#### Step 5: Implement Brand Voice Loader

```typescript
// packages/agents/copy/src/prompts/brand-voice-loader.ts

import { BrandVoice, BrandVoiceSchema } from './types';

export interface MemoryClient {
  retrieve(query: { clientId: string; type: string }): Promise<unknown>;
}

const DEFAULT_BRAND_VOICE: BrandVoice = {
  tone: ['professional', 'friendly'],
  personality: 'A knowledgeable professional who communicates clearly and warmly.',
  vocabulary: {
    preferred: [],
    avoided: [],
    industry: []
  },
  sentenceStyle: 'Clear and concise sentences with occasional longer explanatory passages.',
  emojiUsage: 'Minimal and purposeful use of emojis when they add value.'
};

export class BrandVoiceLoader {
  constructor(private memory: MemoryClient) {}

  async loadForClient(clientId: string): Promise<BrandVoice> {
    const raw = await this.memory.retrieve({
      clientId,
      type: 'brand_voice'
    });

    if (!raw) {
      return DEFAULT_BRAND_VOICE;
    }

    const parsed = BrandVoiceSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`Invalid brand voice data for client ${clientId}, using defaults`);
      return DEFAULT_BRAND_VOICE;
    }

    return parsed.data;
  }

  static getDefault(): BrandVoice {
    return DEFAULT_BRAND_VOICE;
  }
}
```

#### Step 6: Implement Prompt Template Engine

```typescript
// packages/agents/copy/src/prompts/prompt-template.ts

export class PromptTemplate {
  constructor(private template: string) {}

  render(variables: Record<string, string | undefined>): string {
    let result = this.template;

    // Handle conditionals: {{#if variable}}content{{/if}}
    result = this.processConditionals(result, variables);

    // Handle variable interpolation: {{variable}}
    result = this.processVariables(result, variables);

    return result;
  }

  private processConditionals(template: string, variables: Record<string, string | undefined>): string {
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

    return template.replace(conditionalRegex, (match, varName, content) => {
      const value = variables[varName];
      if (value !== undefined && value !== null && value !== '') {
        // Process variables within the conditional content
        return this.processVariables(content, variables);
      }
      return '';
    });
  }

  private processVariables(template: string, variables: Record<string, string | undefined>): string {
    const variableRegex = /\{\{(\w+)\}\}/g;

    return template.replace(variableRegex, (match, varName) => {
      const value = variables[varName];
      return value !== undefined ? value : match;
    });
  }
}

// Pre-defined templates for common use cases
export const PROMPT_TEMPLATES = {
  captionRequest: new PromptTemplate(
    'Write a {{platform}} caption about {{topic}}{{#if style}} in a {{style}} style{{/if}}.'
  ),
  hookRequest: new PromptTemplate(
    'Create a hook for a {{platform}} {{contentType}} about {{topic}}.'
  ),
  ctaRequest: new PromptTemplate(
    'Write a CTA for {{platform}} that drives {{action}}{{#if offer}} for the offer: {{offer}}{{/if}}.'
  )
};
```

#### Step 7: Create Package Exports

```typescript
// packages/agents/copy/src/prompts/index.ts

export * from './types';
export * from './prompt-composer';
export * from './brand-voice-loader';
export * from './prompt-template';
export * from './platform-config';
export * from './base-templates';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/agents/copy
pnpm test src/prompts

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint src/prompts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/copy/src/prompts/types.ts` | Type definitions |
| Create | `packages/agents/copy/src/prompts/platform-config.ts` | Platform-specific configurations |
| Create | `packages/agents/copy/src/prompts/base-templates.ts` | Copy type base templates |
| Create | `packages/agents/copy/src/prompts/prompt-composer.ts` | Main prompt composition logic |
| Create | `packages/agents/copy/src/prompts/brand-voice-loader.ts` | External memory brand voice retrieval |
| Create | `packages/agents/copy/src/prompts/prompt-template.ts` | Template engine for variable prompts |
| Create | `packages/agents/copy/src/prompts/index.ts` | Package exports |
| Create | `packages/agents/copy/src/prompts/__tests__/prompt-composer.test.ts` | Comprehensive tests |

---

## Acceptance Criteria

- [ ] CopyPromptComposer composes prompts from multiple layers
- [ ] Brand voice injection works with tone, personality, vocabulary
- [ ] Platform-specific constraints included (character limits, hashtag limits)
- [ ] Campaign context injects objectives and key messages
- [ ] Constraint layer enforces compliance rules
- [ ] BrandVoiceLoader retrieves voice from external memory
- [ ] Default brand voice provided when none configured
- [ ] PromptTemplate supports variable interpolation and conditionals
- [ ] All 7 copy types have base templates
- [ ] All 7 platforms have configurations
- [ ] Tests pass with >90% coverage

---

## Test Requirements

### Unit Tests
- Prompt layer composition order
- Brand voice injection completeness
- Platform configuration correctness
- Constraint enforcement
- Template variable interpolation
- Conditional section processing

### Integration Tests
- Full prompt composition with all layers
- External memory brand voice loading
- Default fallback behavior

---

## Security & Safety Checklist

- [ ] No hardcoded API keys in prompts
- [ ] Brand voice validated with Zod schema
- [ ] Compliance rules enforced through constraints
- [ ] No PII in prompt templates
- [ ] Audit logging when brand voice loaded

---

## JSON Task Block

```json
{
  "task_id": "S2-C1",
  "name": "Copy Agent Prompt System",
  "status": "pending",
  "dependencies": ["S1-A2", "S1-B1", "S1-B3", "S2-B3"],
  "blocks": ["S2-C2", "S2-C3", "S2-C4"],
  "agent": "C",
  "sprint": 2,
  "complexity": "high",
  "estimated_files": 6,
  "tdd_required": true,
  "spec_refs": [
    "docs/03-agents-tools/agent-recursion-contracts.md",
    "docs/02-schemas/external-memory-schema.md",
    "docs/01-architecture/rlm-integration-spec.md"
  ],
  "acceptance_checklist": [
    "prompt_composer_layers",
    "brand_voice_injection",
    "platform_configs",
    "constraint_layer",
    "template_engine",
    "memory_loader"
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
  "writes": [],
  "context_window_at_completion": null,
  "continuation_hint": "Verify brand voice loading from external memory integrates with RLM environment"
}
```
