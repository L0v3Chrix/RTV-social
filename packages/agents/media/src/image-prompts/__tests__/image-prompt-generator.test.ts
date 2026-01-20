/**
 * S2-D1: Image Prompt Generator Tests
 *
 * Comprehensive tests for the image prompt generation system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ImagePromptGenerator } from '../image-prompt-generator.js';
import { ImagePromptTemplates } from '../image-prompt-templates.js';
import { AspectRatioConfig } from '../aspect-ratio-config.js';
import type {
  ImagePromptRequest,
  ImageStyle,
  BrandVisualGuidelines,
} from '../types.js';

describe('ImagePromptGenerator', () => {
  let generator: ImagePromptGenerator;

  beforeEach(() => {
    generator = new ImagePromptGenerator();
  });

  describe('basic prompt generation', () => {
    it('should generate prompt from content brief', () => {
      const request: ImagePromptRequest = {
        contentBrief: 'A person working at a laptop in a modern office',
        platform: 'instagram',
        contentType: 'post',
        clientId: 'client-123',
      };

      const result = generator.generate(request);

      expect(result.prompt).toBeDefined();
      expect(result.prompt).toContain('laptop');
      expect(result.prompt).toContain('office');
    });

    it('should include platform-specific aspect ratio', () => {
      const instagramPost = generator.generate({
        contentBrief: 'Product shot',
        platform: 'instagram',
        contentType: 'post',
        clientId: 'client-123',
      });

      const instagramStory = generator.generate({
        contentBrief: 'Product shot',
        platform: 'instagram',
        contentType: 'story',
        clientId: 'client-123',
      });

      expect(instagramPost.aspectRatio).toBe('1:1');
      expect(instagramStory.aspectRatio).toBe('9:16');
    });

    it('should generate negative prompt', () => {
      const result = generator.generate({
        contentBrief: 'Professional headshot',
        platform: 'linkedin',
        contentType: 'post',
        clientId: 'client-123',
      });

      expect(result.negativePrompt).toBeDefined();
      expect(result.negativePrompt).toContain('blurry');
    });
  });

  describe('brand visual guidelines integration', () => {
    const brandGuidelines: BrandVisualGuidelines = {
      colorPalette: {
        primary: '#2563EB',
        secondary: '#10B981',
        accent: '#F59E0B',
        neutral: '#6B7280',
      },
      photographyStyle: 'clean, modern, bright lighting',
      mood: 'professional yet approachable',
      avoidVisuals: [
        'dark themes',
        'cluttered backgrounds',
        'stock photo clichés',
      ],
      preferredSubjects: ['diverse people', 'modern workspaces', 'technology'],
    };

    it('should inject brand color palette', () => {
      const result = generator.generate({
        contentBrief: 'Team meeting',
        platform: 'linkedin',
        contentType: 'post',
        clientId: 'client-123',
        brandGuidelines,
      });

      expect(result.prompt).toContain('blue'); // Primary color
      expect(result.styleNotes).toContain('2563EB');
    });

    it('should apply brand photography style', () => {
      const result = generator.generate({
        contentBrief: 'Office scene',
        platform: 'instagram',
        contentType: 'post',
        clientId: 'client-123',
        brandGuidelines,
      });

      expect(result.prompt).toContain('clean');
      expect(result.prompt).toContain('modern');
      expect(result.prompt).toContain('bright lighting');
    });

    it('should include brand mood in prompt', () => {
      const result = generator.generate({
        contentBrief: 'Customer service',
        platform: 'facebook',
        contentType: 'post',
        clientId: 'client-123',
        brandGuidelines,
      });

      expect(result.prompt).toContain('professional');
      expect(result.prompt).toContain('approachable');
    });

    it('should add avoid visuals to negative prompt', () => {
      const result = generator.generate({
        contentBrief: 'Workspace',
        platform: 'instagram',
        contentType: 'post',
        clientId: 'client-123',
        brandGuidelines,
      });

      expect(result.negativePrompt).toContain('dark');
      expect(result.negativePrompt).toContain('cluttered');
    });
  });

  describe('style presets', () => {
    const styles: ImageStyle[] = [
      'photorealistic',
      'illustration',
      'minimalist',
      'vibrant',
      'cinematic',
      'editorial',
    ];

    styles.forEach((style) => {
      it(`should apply ${style} style preset`, () => {
        const result = generator.generate({
          contentBrief: 'Product showcase',
          platform: 'instagram',
          contentType: 'post',
          style,
          clientId: 'client-123',
        });

        expect(result.styleApplied).toBe(style);
        expect(result.prompt.toLowerCase()).toContain(
          style.replace('_', ' ')
        );
      });
    });
  });

  describe('platform-specific optimization', () => {
    it('should optimize for Instagram feed', () => {
      const result = generator.generate({
        contentBrief: 'Lifestyle shot',
        platform: 'instagram',
        contentType: 'post',
        clientId: 'client-123',
      });

      expect(result.aspectRatio).toBe('1:1');
      expect(result.prompt).toContain('high quality');
      expect(result.resolution).toBe('1080x1080');
    });

    it('should optimize for Instagram Stories/Reels', () => {
      const result = generator.generate({
        contentBrief: 'Behind the scenes',
        platform: 'instagram',
        contentType: 'story',
        clientId: 'client-123',
      });

      expect(result.aspectRatio).toBe('9:16');
      expect(result.resolution).toBe('1080x1920');
    });

    it('should optimize for LinkedIn', () => {
      const result = generator.generate({
        contentBrief: 'Business meeting',
        platform: 'linkedin',
        contentType: 'post',
        clientId: 'client-123',
      });

      expect(result.aspectRatio).toBe('1.91:1');
      expect(result.prompt).toContain('professional');
    });

    it('should optimize for YouTube thumbnails', () => {
      const result = generator.generate({
        contentBrief: 'Tutorial thumbnail',
        platform: 'youtube',
        contentType: 'thumbnail',
        clientId: 'client-123',
      });

      expect(result.aspectRatio).toBe('16:9');
      expect(result.resolution).toBe('1280x720');
      expect(result.prompt).toContain('eye-catching');
    });
  });

  describe('content type specific prompts', () => {
    it('should generate product photography prompts', () => {
      const result = generator.generate({
        contentBrief: 'New smartphone product',
        platform: 'instagram',
        contentType: 'post',
        imageType: 'product',
        clientId: 'client-123',
      });

      expect(result.prompt).toContain('product photography');
      expect(result.prompt).toContain('studio lighting');
    });

    it('should generate lifestyle photography prompts', () => {
      const result = generator.generate({
        contentBrief: 'Person using our app',
        platform: 'instagram',
        contentType: 'post',
        imageType: 'lifestyle',
        clientId: 'client-123',
      });

      expect(result.prompt).toContain('lifestyle');
      expect(result.prompt).toContain('natural');
    });

    it('should generate graphic/illustration prompts', () => {
      const result = generator.generate({
        contentBrief: 'Infographic about our process',
        platform: 'linkedin',
        contentType: 'post',
        imageType: 'graphic',
        clientId: 'client-123',
      });

      expect(result.prompt).toContain('graphic design');
      expect(result.prompt).toContain('clean layout');
    });
  });

  describe('variant generation', () => {
    it('should generate multiple prompt variants', () => {
      const result = generator.generate({
        contentBrief: 'Team celebration',
        platform: 'instagram',
        contentType: 'post',
        variantCount: 3,
        clientId: 'client-123',
      });

      expect(result.variants).toBeDefined();
      expect(result.variants?.length).toBe(3);
    });

    it('should vary composition in variants', () => {
      const result = generator.generate({
        contentBrief: 'Office workspace',
        platform: 'instagram',
        contentType: 'post',
        variantCount: 2,
        clientId: 'client-123',
      });

      expect(result.variants?.[0].prompt).not.toBe(result.variants?.[1].prompt);
    });
  });

  describe('provider-specific formatting', () => {
    it('should format prompt for Midjourney', () => {
      const result = generator.generate({
        contentBrief: 'Futuristic city',
        platform: 'instagram',
        contentType: 'post',
        provider: 'midjourney',
        clientId: 'client-123',
      });

      expect(result.formattedPrompts.midjourney).toContain('--ar');
      expect(result.formattedPrompts.midjourney).toContain('--v');
    });

    it('should format prompt for DALL-E', () => {
      const result = generator.generate({
        contentBrief: 'Abstract art',
        platform: 'instagram',
        contentType: 'post',
        provider: 'dalle',
        clientId: 'client-123',
      });

      expect(result.formattedPrompts.dalle).toBeDefined();
      // DALL-E doesn't use parameters like Midjourney
      expect(result.formattedPrompts.dalle).not.toContain('--');
    });

    it('should format prompt for Stable Diffusion', () => {
      const result = generator.generate({
        contentBrief: 'Portrait photo',
        platform: 'instagram',
        contentType: 'post',
        provider: 'stable_diffusion',
        clientId: 'client-123',
      });

      expect(result.formattedPrompts.stable_diffusion).toBeDefined();
    });
  });

  describe('metadata generation', () => {
    it('should include metadata in result', () => {
      const result = generator.generate({
        contentBrief: 'Test image',
        platform: 'instagram',
        contentType: 'post',
        clientId: 'client-123',
      });

      expect(result.metadata.platform).toBe('instagram');
      expect(result.metadata.contentType).toBe('post');
      expect(result.metadata.generatedAt).toBeDefined();
    });
  });
});

describe('ImagePromptTemplates', () => {
  describe('getTemplate', () => {
    it('should return template for image type', () => {
      const template = ImagePromptTemplates.getTemplate('product');
      expect(template).toBeDefined();
      expect(template.basePrompt).toBeDefined();
    });

    it('should have templates for all image types', () => {
      const types = [
        'product',
        'lifestyle',
        'portrait',
        'graphic',
        'scene',
        'abstract',
      ] as const;
      types.forEach((type) => {
        expect(ImagePromptTemplates.getTemplate(type)).toBeDefined();
      });
    });
  });

  describe('getStyleModifiers', () => {
    it('should return modifiers for style', () => {
      const modifiers = ImagePromptTemplates.getStyleModifiers('photorealistic');
      expect(modifiers).toBeDefined();
      expect(modifiers.length).toBeGreaterThan(0);
    });

    it('should have modifiers for all styles', () => {
      const styles = [
        'photorealistic',
        'illustration',
        'minimalist',
        'vibrant',
        'cinematic',
        'editorial',
      ] as const;
      styles.forEach((style) => {
        expect(
          ImagePromptTemplates.getStyleModifiers(style).length
        ).toBeGreaterThan(0);
      });
    });
  });

  describe('combineNegativePrompts', () => {
    it('should combine negative prompts without duplicates', () => {
      const result = ImagePromptTemplates.combineNegativePrompts(
        ['blurry', 'low quality'],
        ['blurry', 'dark'],
        ['grainy']
      );

      expect(result).toContain('blurry');
      expect(result).toContain('low quality');
      expect(result).toContain('dark');
      expect(result).toContain('grainy');
      // Check no duplicate 'blurry'
      expect(result.split('blurry').length).toBe(2);
    });
  });
});

describe('AspectRatioConfig', () => {
  describe('get', () => {
    it('should return correct ratio for platform+content type', () => {
      expect(AspectRatioConfig.get('instagram', 'post')).toBe('1:1');
      expect(AspectRatioConfig.get('instagram', 'story')).toBe('9:16');
      expect(AspectRatioConfig.get('youtube', 'thumbnail')).toBe('16:9');
      expect(AspectRatioConfig.get('linkedin', 'post')).toBe('1.91:1');
    });

    it('should return default for unknown combination', () => {
      const result = AspectRatioConfig.get('instagram', 'cover' as any);
      expect(result).toBe('1:1');
    });
  });

  describe('getResolution', () => {
    it('should return resolution for aspect ratio', () => {
      const resolution = AspectRatioConfig.getResolution('1:1', 'high');
      expect(resolution).toBe('1080x1080');
    });

    it('should return medium resolution when specified', () => {
      const resolution = AspectRatioConfig.getResolution('16:9', 'medium');
      expect(resolution).toBe('1280x720');
    });

    it('should default to high quality', () => {
      const resolution = AspectRatioConfig.getResolution('9:16');
      expect(resolution).toBe('1080x1920');
    });
  });

  describe('getMidjourneyRatio', () => {
    it('should convert ratio for Midjourney', () => {
      expect(AspectRatioConfig.getMidjourneyRatio('1:1')).toBe('1:1');
      expect(AspectRatioConfig.getMidjourneyRatio('1.91:1')).toBe('191:100');
    });
  });

  describe('getAllRatios', () => {
    it('should return all available ratios', () => {
      const ratios = AspectRatioConfig.getAllRatios();
      expect(ratios).toContain('1:1');
      expect(ratios).toContain('16:9');
      expect(ratios).toContain('9:16');
    });
  });
});
