/**
 * S2-D1: Image Prompt Generator
 *
 * Generates AI image prompts from content briefs and brand guidelines.
 */

import type {
  ImagePromptRequest,
  ImagePromptResult,
  ImagePromptVariant,
  BrandVisualGuidelines,
  ImageStyle,
  ImageType,
  Platform,
} from './types.js';
import { AspectRatioConfig } from './aspect-ratio-config.js';
import { ImagePromptTemplates, ImageTemplate } from './image-prompt-templates.js';

export class ImagePromptGenerator {
  generate(request: ImagePromptRequest): ImagePromptResult {
    // Determine image type
    const imageType =
      request.imageType || this.inferImageType(request.contentBrief);

    // Get template for image type
    const template = ImagePromptTemplates.getTemplate(imageType);

    // Get aspect ratio
    const aspectRatio = AspectRatioConfig.get(
      request.platform,
      request.contentType
    );
    // Thumbnails use medium quality, others use high
    const quality = request.contentType === 'thumbnail' ? 'medium' : 'high';
    const resolution = AspectRatioConfig.getResolution(aspectRatio, quality);

    // Build main prompt
    const prompt = this.buildPrompt(request, template);

    // Build negative prompt
    const negativePrompt = this.buildNegativePrompt(request, template);

    // Generate variants if requested
    const variants =
      request.variantCount && request.variantCount > 1
        ? this.generateVariants(request, template, request.variantCount)
        : undefined;

    // Format for different providers
    const formattedPrompts = this.formatForProviders(
      prompt,
      negativePrompt,
      aspectRatio,
      request.style || 'photorealistic'
    );

    const result: ImagePromptResult = {
      prompt,
      negativePrompt,
      aspectRatio,
      resolution,
      formattedPrompts,
      metadata: {
        platform: request.platform,
        contentType: request.contentType,
        generatedAt: new Date().toISOString(),
      },
    };

    // Add optional properties only if defined
    if (request.style !== undefined) {
      result.styleApplied = request.style;
    }
    if (request.brandGuidelines) {
      result.styleNotes = this.buildStyleNotes(request.brandGuidelines);
    }
    if (variants !== undefined) {
      result.variants = variants;
    }
    if (imageType !== undefined) {
      result.metadata.imageType = imageType;
    }

    return result;
  }

  private buildPrompt(
    request: ImagePromptRequest,
    template: ImageTemplate
  ): string {
    const parts: string[] = [];

    // Start with content brief
    parts.push(request.contentBrief);

    // Add template base
    parts.push(template.basePrompt);

    // Add style modifiers
    if (request.style) {
      const styleModifiers = ImagePromptTemplates.getStyleModifiers(
        request.style
      );
      parts.push(styleModifiers.slice(0, 3).join(', '));
    }

    // Add brand guidelines
    if (request.brandGuidelines) {
      parts.push(this.buildBrandPromptPart(request.brandGuidelines));
    }

    // Add lighting
    parts.push(template.lightingDefaults);

    // Add platform-specific quality keywords
    parts.push(this.getPlatformQualityKeywords(request.platform));

    // Add custom instructions
    if (request.customInstructions) {
      parts.push(request.customInstructions);
    }

    return parts.filter(Boolean).join(', ');
  }

  private buildBrandPromptPart(guidelines: BrandVisualGuidelines): string {
    const parts: string[] = [];

    // Photography style
    if (guidelines.photographyStyle) {
      parts.push(guidelines.photographyStyle);
    }

    // Mood
    if (guidelines.mood) {
      parts.push(guidelines.mood);
    }

    // Color hints (convert hex to color names)
    if (guidelines.colorPalette.primary) {
      const colorName = this.hexToColorName(guidelines.colorPalette.primary);
      parts.push(`${colorName} tones`);
    }

    // Preferred subjects
    if (guidelines.preferredSubjects?.length) {
      parts.push(guidelines.preferredSubjects.slice(0, 2).join(', '));
    }

    return parts.join(', ');
  }

  private buildNegativePrompt(
    request: ImagePromptRequest,
    template: ImageTemplate
  ): string {
    const negatives = [...template.negativePromptBase];

    // Add brand avoid visuals
    if (request.brandGuidelines?.avoidVisuals) {
      negatives.push(...request.brandGuidelines.avoidVisuals);
    }

    // Add standard quality negatives
    negatives.push(
      'blurry',
      'low resolution',
      'artifacts',
      'compression',
      'watermark',
      'logo',
      'text',
      'signature'
    );

    return [...new Set(negatives)].join(', ');
  }

  private generateVariants(
    request: ImagePromptRequest,
    template: ImageTemplate,
    count: number
  ): ImagePromptVariant[] {
    const compositions = template.compositionHints;
    const variants: ImagePromptVariant[] = [];

    for (let i = 0; i < count; i++) {
      const composition = compositions[i % compositions.length] ?? 'centered';
      const modifier = template.modifiers[i % template.modifiers.length] ?? '';

      const prompt = `${request.contentBrief}, ${composition}, ${modifier}, ${template.basePrompt}`;

      variants.push({
        prompt,
        negativePrompt: this.buildNegativePrompt(request, template),
        composition,
        emphasis: modifier,
      });
    }

    return variants;
  }

  private formatForProviders(
    prompt: string,
    negativePrompt: string,
    aspectRatio: string,
    _style: ImageStyle
  ): ImagePromptResult['formattedPrompts'] {
    const mjRatio = AspectRatioConfig.getMidjourneyRatio(aspectRatio);

    return {
      midjourney: `${prompt} --ar ${mjRatio} --v 6 --style raw`,
      dalle: prompt, // DALL-E uses natural language
      stable_diffusion: `${prompt}\n\nNegative prompt: ${negativePrompt}`,
      generic: prompt,
    };
  }

  private buildStyleNotes(guidelines: BrandVisualGuidelines): string {
    return `Primary color: ${guidelines.colorPalette.primary}, Style: ${guidelines.photographyStyle}, Mood: ${guidelines.mood}`;
  }

  private getPlatformQualityKeywords(platform: Platform): string {
    const keywords: Record<string, string> = {
      instagram: 'high quality, instagram worthy, social media optimized',
      linkedin: 'professional, corporate quality, business appropriate',
      tiktok: 'trending, eye-catching, scroll-stopping',
      youtube: 'eye-catching, thumbnail quality, high contrast',
      facebook: 'engaging, shareable, high quality',
      x: 'attention-grabbing, viral potential',
      skool: 'educational, professional, community-focused',
    };

    return keywords[platform] || 'high quality';
  }

  private inferImageType(brief: string): ImageType {
    const briefLower = brief.toLowerCase();

    if (briefLower.includes('product') || briefLower.includes('item')) {
      return 'product';
    }
    if (
      briefLower.includes('person') ||
      briefLower.includes('headshot') ||
      briefLower.includes('portrait')
    ) {
      return 'portrait';
    }
    if (
      briefLower.includes('lifestyle') ||
      briefLower.includes('using') ||
      briefLower.includes('action')
    ) {
      return 'lifestyle';
    }
    if (
      briefLower.includes('graphic') ||
      briefLower.includes('infographic') ||
      briefLower.includes('chart')
    ) {
      return 'graphic';
    }
    if (briefLower.includes('abstract') || briefLower.includes('pattern')) {
      return 'abstract';
    }

    return 'scene'; // Default
  }

  private hexToColorName(hex: string): string {
    // Simplified color name mapping
    const colorMap: Record<string, string> = {
      '#2563EB': 'blue',
      '#10B981': 'green',
      '#F59E0B': 'amber',
      '#EF4444': 'red',
      '#8B5CF6': 'purple',
      '#EC4899': 'pink',
      '#14B8A6': 'teal',
      '#F97316': 'orange',
    };

    // Try exact match
    const exactMatch = colorMap[hex.toUpperCase()];
    if (exactMatch) {
      return exactMatch;
    }

    // Determine by hue
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    if (b > r && b > g) return 'blue';
    if (g > r && g > b) return 'green';
    if (r > g && r > b) return r > 200 ? 'red' : 'maroon';

    return 'neutral';
  }
}
