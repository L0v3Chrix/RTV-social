/**
 * S2-C1: Copy Agent Prompt System Tests
 *
 * Comprehensive tests for the prompt composition system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CopyPromptComposer } from '../prompt-composer.js';
import { BrandVoiceLoader } from '../brand-voice-loader.js';
import { PromptTemplate } from '../prompt-template.js';
import type { BrandVoice, CopyContext } from '../types.js';

describe('CopyPromptComposer', () => {
  let composer: CopyPromptComposer;

  beforeEach(() => {
    composer = new CopyPromptComposer();
  });

  describe('base layer composition', () => {
    it('should include role and task instructions', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
      });

      expect(prompt.system).toContain('social media copywriter');
      expect(prompt.system).toContain('caption');
    });

    it('should adapt base instructions per copy type', () => {
      const captionPrompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
      });
      const hookPrompt = composer.compose({
        copyType: 'hook',
        platform: 'tiktok',
      });
      const ctaPrompt = composer.compose({
        copyType: 'cta',
        platform: 'facebook',
      });

      expect(captionPrompt.system).not.toBe(hookPrompt.system);
      expect(hookPrompt.system).not.toBe(ctaPrompt.system);
    });

    it('should include all copy type templates', () => {
      const copyTypes = [
        'caption',
        'hook',
        'cta',
        'headline',
        'bio',
        'comment_reply',
        'dm_response',
      ] as const;

      for (const copyType of copyTypes) {
        const prompt = composer.compose({
          copyType,
          platform: 'instagram',
        });
        expect(prompt.system).toBeDefined();
        expect(prompt.system.length).toBeGreaterThan(100);
      }
    });
  });

  describe('brand voice injection', () => {
    const brandVoice: BrandVoice = {
      tone: ['professional', 'warm', 'empowering'],
      personality:
        'Knowledgeable mentor who speaks with confidence but never condescension',
      vocabulary: {
        preferred: ['empower', 'transform', 'journey', 'growth'],
        avoided: ['cheap', 'guarantee', 'best', 'amazing'],
        industry: ['ROI', 'conversion', 'funnel', 'engagement'],
      },
      sentenceStyle:
        'Mix of short punchy statements and medium-length explanatory sentences',
      emojiUsage: 'Minimal and purposeful, max 2-3 per post',
    };

    it('should inject brand tone into system prompt', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        brandVoice,
      });

      expect(prompt.system).toContain('professional');
      expect(prompt.system).toContain('warm');
      expect(prompt.system).toContain('empowering');
    });

    it('should include preferred vocabulary guidance', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        brandVoice,
      });

      expect(prompt.system).toContain('empower');
      expect(prompt.system).toContain('transform');
    });

    it('should include vocabulary to avoid', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        brandVoice,
      });

      expect(prompt.system).toContain('AVOID');
      expect(prompt.system).toContain('cheap');
      expect(prompt.system).toContain('guarantee');
    });

    it('should describe personality in prompt', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        brandVoice,
      });

      expect(prompt.system).toContain('mentor');
      expect(prompt.system).toContain('confidence');
    });

    it('should include emoji usage guidelines', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        brandVoice,
      });

      expect(prompt.system.toLowerCase()).toContain('emoji');
      expect(prompt.system).toContain('max 2-3');
    });
  });

  describe('platform context layer', () => {
    it('should include Instagram-specific constraints', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
      });

      expect(prompt.system).toContain('2200');
      expect(prompt.system).toContain('hashtag');
    });

    it('should include TikTok-specific constraints', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'tiktok',
      });

      expect(prompt.system).toContain('2200');
      expect(prompt.system).toContain('hashtag');
      expect(prompt.system).toContain('FYP');
    });

    it('should include LinkedIn-specific constraints', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'linkedin',
      });

      expect(prompt.system).toContain('3000');
      expect(prompt.system.toLowerCase()).toContain('professional');
    });

    it('should include X/Twitter-specific constraints', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'x',
      });

      expect(prompt.system).toContain('280');
    });

    it('should include all platform configurations', () => {
      const platforms = [
        'instagram',
        'facebook',
        'tiktok',
        'youtube',
        'linkedin',
        'x',
        'skool',
      ] as const;

      for (const platform of platforms) {
        const prompt = composer.compose({
          copyType: 'caption',
          platform,
        });
        expect(prompt.system).toBeDefined();
        expect(prompt.system).toContain('Platform');
      }
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
          keyMessages: ['New product launch', 'Limited time offer'],
        },
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
          keyMessages: ['50% off', 'Ends Friday'],
        },
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
          minLength: 50,
        },
      });

      expect(prompt.system).toContain('150');
      expect(prompt.system).toContain('50');
    });

    it('should include hashtag constraints', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        constraints: {
          hashtagCount: { min: 5, max: 15 },
        },
      });

      expect(prompt.system).toContain('5');
      expect(prompt.system).toContain('15');
    });

    it('should include compliance rules', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        constraints: {
          compliance: ['No income claims', 'Must include disclaimer'],
        },
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
          emojiUsage: 'None',
        },
        campaign: {
          name: 'Test Campaign',
          objective: 'engagement',
          keyMessages: [],
        },
        constraints: {
          maxLength: 200,
        },
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
        platform: 'instagram',
      });

      expect(prompt.user).toBeDefined();
      expect(prompt.user).toContain('caption');
    });

    it('should include structured output instructions', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        outputFormat: 'json',
      });

      expect(prompt.system).toContain('JSON');
    });

    it('should include topic in user prompt', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        topic: 'product launch announcement',
      });

      expect(prompt.user).toContain('product launch announcement');
    });

    it('should include content description in user prompt', () => {
      const prompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
        contentDescription: 'Photo of team celebration',
      });

      expect(prompt.user).toContain('Photo of team celebration');
    });

    it('should select appropriate model', () => {
      const captionPrompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
      });
      const hookPrompt = composer.compose({
        copyType: 'hook',
        platform: 'instagram',
      });

      expect(captionPrompt.model).toBeDefined();
      expect(hookPrompt.model).toBeDefined();
    });

    it('should set temperature based on copy type', () => {
      const captionPrompt = composer.compose({
        copyType: 'caption',
        platform: 'instagram',
      });
      const replyPrompt = composer.compose({
        copyType: 'comment_reply',
        platform: 'instagram',
      });

      expect(captionPrompt.temperature).toBeGreaterThan(
        replyPrompt.temperature!
      );
    });

    it('should calculate max tokens based on platform limits', () => {
      const xPrompt = composer.compose({
        copyType: 'caption',
        platform: 'x',
      });
      const linkedinPrompt = composer.compose({
        copyType: 'caption',
        platform: 'linkedin',
      });

      expect(xPrompt.maxTokens!).toBeLessThan(linkedinPrompt.maxTokens!);
    });
  });
});

describe('BrandVoiceLoader', () => {
  it('should load brand voice from external memory', async () => {
    const mockMemory = {
      retrieve: vi.fn().mockResolvedValue({
        tone: ['friendly'],
        personality: 'A helpful and friendly assistant who communicates warmly.',
        vocabulary: { preferred: [], avoided: [], industry: [] },
        sentenceStyle: 'Casual',
        emojiUsage: 'Moderate',
      }),
    };

    const loader = new BrandVoiceLoader(mockMemory);
    const voice = await loader.loadForClient('client-123');

    expect(mockMemory.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-123',
        type: 'brand_voice',
      })
    );
    expect(voice.tone).toContain('friendly');
  });

  it('should return default voice if none configured', async () => {
    const mockMemory = {
      retrieve: vi.fn().mockResolvedValue(null),
    };

    const loader = new BrandVoiceLoader(mockMemory);
    const voice = await loader.loadForClient('client-123');

    expect(voice).toBeDefined();
    expect(voice.tone).toContain('professional');
  });

  it('should return default voice on invalid data', async () => {
    const mockMemory = {
      retrieve: vi.fn().mockResolvedValue({
        tone: [], // Invalid: min 1 required
        personality: 'short', // Invalid: min 10 chars
      }),
    };

    const loader = new BrandVoiceLoader(mockMemory);
    const voice = await loader.loadForClient('client-123');

    expect(voice).toBeDefined();
    expect(voice.tone).toContain('professional');
  });

  it('should provide static default voice', () => {
    const defaultVoice = BrandVoiceLoader.getDefault();

    expect(defaultVoice).toBeDefined();
    expect(defaultVoice.tone).toContain('professional');
    expect(defaultVoice.personality).toBeDefined();
    expect(defaultVoice.vocabulary).toBeDefined();
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
      topic: 'product launch',
    });

    expect(result).toBe('Write a caption for Instagram about product launch');
  });

  it('should handle missing variables gracefully', () => {
    const template = new PromptTemplate('Write about {{topic}}');

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

  it('should handle empty string as falsy in conditionals', () => {
    const template = new PromptTemplate(
      'Content{{#if note}} (Note: {{note}}){{/if}}'
    );

    const result = template.render({ note: '' });

    expect(result).toBe('Content');
  });

  it('should handle nested variables in conditionals', () => {
    const template = new PromptTemplate(
      '{{#if active}}Status: {{status}} on {{platform}}{{/if}}'
    );

    const result = template.render({
      active: 'yes',
      status: 'published',
      platform: 'Instagram',
    });

    expect(result).toBe('Status: published on Instagram');
  });

  it('should handle multiple conditionals', () => {
    const template = new PromptTemplate(
      '{{#if a}}A{{/if}}{{#if b}}B{{/if}}{{#if c}}C{{/if}}'
    );

    const result = template.render({ a: 'yes', c: 'yes' });

    expect(result).toBe('AC');
  });

  it('should preserve whitespace correctly', () => {
    const template = new PromptTemplate('Hello {{name}}!\n\nWelcome.');

    const result = template.render({ name: 'World' });

    expect(result).toBe('Hello World!\n\nWelcome.');
  });
});
