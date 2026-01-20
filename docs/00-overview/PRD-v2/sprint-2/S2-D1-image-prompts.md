# Build Prompt: S2-D1 — Image Prompt Generation

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-D1 |
| Sprint | 2 |
| Agent | D (Media Generation) |
| Complexity | High |
| Status | pending |
| Estimated Files | 5 |
| Spec References | `agent-recursion-contracts.md`, `external-memory-schema.md` |

---

## Context

### What This Builds

The Image Prompt Generation service — a system that converts content briefs and brand guidelines into detailed, effective prompts for AI image generation tools (Midjourney, DALL-E, Stable Diffusion, etc.). This bridges the gap between content strategy and visual creation.

### Why It Matters

AI image generation quality depends entirely on prompt quality:
- **Brand Consistency**: Prompts must encode visual brand guidelines
- **Platform Optimization**: Different platforms need different aspect ratios and styles
- **Content Alignment**: Images must match the content they accompany
- **Style Control**: Consistent aesthetic across all generated images

### Architecture Decision

The system uses a **layered prompt composition** approach:
1. **Subject Layer**: What is being shown (product, person, scene)
2. **Style Layer**: Visual aesthetic (photography style, mood, color palette)
3. **Brand Layer**: Brand-specific visual guidelines
4. **Technical Layer**: Resolution, aspect ratio, format requirements
5. **Negative Layer**: What to avoid in generation

---

## Prerequisites

### Completed Tasks
- [x] S1-A2: BrandKit domain model (visual guidelines)
- [x] S1-B1: RLM Environment
- [x] S2-C1: Copy agent prompt system (pattern for prompt composition)

### Required Packages
```bash
pnpm add zod nanoid
pnpm add -D vitest
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests that define the expected behavior:

```typescript
// packages/agents/media/src/image-prompts/__tests__/image-prompt-generator.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ImagePromptGenerator,
  ImagePromptRequest,
  ImagePromptResult,
  ImageStyle
} from '../image-prompt-generator';
import { BrandVisualGuidelines } from '../types';

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
        clientId: 'client-123'
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
        clientId: 'client-123'
      });

      const instagramStory = generator.generate({
        contentBrief: 'Product shot',
        platform: 'instagram',
        contentType: 'story',
        clientId: 'client-123'
      });

      expect(instagramPost.aspectRatio).toBe('1:1');
      expect(instagramStory.aspectRatio).toBe('9:16');
    });

    it('should generate negative prompt', () => {
      const result = generator.generate({
        contentBrief: 'Professional headshot',
        platform: 'linkedin',
        contentType: 'post',
        clientId: 'client-123'
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
        neutral: '#6B7280'
      },
      photographyStyle: 'clean, modern, bright lighting',
      mood: 'professional yet approachable',
      avoidVisuals: ['dark themes', 'cluttered backgrounds', 'stock photo clichés'],
      preferredSubjects: ['diverse people', 'modern workspaces', 'technology']
    };

    it('should inject brand color palette', () => {
      const result = generator.generate({
        contentBrief: 'Team meeting',
        platform: 'linkedin',
        contentType: 'post',
        clientId: 'client-123',
        brandGuidelines
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
        brandGuidelines
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
        brandGuidelines
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
        brandGuidelines
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
      'editorial'
    ];

    styles.forEach(style => {
      it(`should apply ${style} style preset`, () => {
        const result = generator.generate({
          contentBrief: 'Product showcase',
          platform: 'instagram',
          contentType: 'post',
          style,
          clientId: 'client-123'
        });

        expect(result.styleApplied).toBe(style);
        expect(result.prompt.toLowerCase()).toContain(style.replace('_', ' '));
      });
    });
  });

  describe('platform-specific optimization', () => {
    it('should optimize for Instagram feed', () => {
      const result = generator.generate({
        contentBrief: 'Lifestyle shot',
        platform: 'instagram',
        contentType: 'post',
        clientId: 'client-123'
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
        clientId: 'client-123'
      });

      expect(result.aspectRatio).toBe('9:16');
      expect(result.resolution).toBe('1080x1920');
    });

    it('should optimize for LinkedIn', () => {
      const result = generator.generate({
        contentBrief: 'Business meeting',
        platform: 'linkedin',
        contentType: 'post',
        clientId: 'client-123'
      });

      expect(result.aspectRatio).toBe('1.91:1');
      expect(result.prompt).toContain('professional');
    });

    it('should optimize for YouTube thumbnails', () => {
      const result = generator.generate({
        contentBrief: 'Tutorial thumbnail',
        platform: 'youtube',
        contentType: 'thumbnail',
        clientId: 'client-123'
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
        clientId: 'client-123'
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
        clientId: 'client-123'
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
        clientId: 'client-123'
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
        clientId: 'client-123'
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
        clientId: 'client-123'
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
        clientId: 'client-123'
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
        clientId: 'client-123'
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
        clientId: 'client-123'
      });

      expect(result.formattedPrompts.stable_diffusion).toBeDefined();
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
      const types = ['product', 'lifestyle', 'portrait', 'graphic', 'scene', 'abstract'];
      types.forEach(type => {
        expect(ImagePromptTemplates.getTemplate(type as any)).toBeDefined();
      });
    });
  });
});

describe('AspectRatioConfig', () => {
  describe('getAspectRatio', () => {
    it('should return correct ratio for platform+content type', () => {
      expect(AspectRatioConfig.get('instagram', 'post')).toBe('1:1');
      expect(AspectRatioConfig.get('instagram', 'story')).toBe('9:16');
      expect(AspectRatioConfig.get('youtube', 'thumbnail')).toBe('16:9');
      expect(AspectRatioConfig.get('linkedin', 'post')).toBe('1.91:1');
    });

    it('should return resolution for aspect ratio', () => {
      const resolution = AspectRatioConfig.getResolution('1:1', 'high');
      expect(resolution).toBe('1080x1080');
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Define Image Prompt Types

```typescript
// packages/agents/media/src/image-prompts/types.ts

import { z } from 'zod';
import { Platform } from '@rtv/agents-copy';

export const ImageStyleSchema = z.enum([
  'photorealistic',
  'illustration',
  'minimalist',
  'vibrant',
  'cinematic',
  'editorial',
  'flat_design',
  'isometric',
  'watercolor',
  'sketch'
]);

export type ImageStyle = z.infer<typeof ImageStyleSchema>;

export const ImageTypeSchema = z.enum([
  'product',
  'lifestyle',
  'portrait',
  'graphic',
  'scene',
  'abstract',
  'text_overlay',
  'collage'
]);

export type ImageType = z.infer<typeof ImageTypeSchema>;

export const ContentTypeSchema = z.enum([
  'post',
  'story',
  'reel',
  'thumbnail',
  'cover',
  'carousel',
  'ad'
]);

export type ContentType = z.infer<typeof ContentTypeSchema>;

export const ImageProviderSchema = z.enum([
  'midjourney',
  'dalle',
  'stable_diffusion',
  'ideogram',
  'leonardo',
  'generic'
]);

export type ImageProvider = z.infer<typeof ImageProviderSchema>;

export interface BrandVisualGuidelines {
  colorPalette: {
    primary: string;
    secondary: string;
    accent?: string;
    neutral?: string;
  };
  photographyStyle: string;
  mood: string;
  avoidVisuals: string[];
  preferredSubjects?: string[];
  fontFamily?: string;
  logoPlacement?: string;
}

export interface ImagePromptRequest {
  contentBrief: string;
  platform: Platform;
  contentType: ContentType;
  clientId: string;
  style?: ImageStyle;
  imageType?: ImageType;
  brandGuidelines?: BrandVisualGuidelines;
  provider?: ImageProvider;
  variantCount?: number;
  customInstructions?: string;
}

export interface ImagePromptVariant {
  prompt: string;
  negativePrompt: string;
  composition: string;
  emphasis: string;
}

export interface ImagePromptResult {
  prompt: string;
  negativePrompt: string;
  aspectRatio: string;
  resolution: string;
  styleApplied?: ImageStyle;
  styleNotes?: string;
  formattedPrompts: {
    midjourney?: string;
    dalle?: string;
    stable_diffusion?: string;
    generic: string;
  };
  variants?: ImagePromptVariant[];
  metadata: {
    platform: Platform;
    contentType: ContentType;
    imageType?: ImageType;
    generatedAt: string;
  };
}
```

#### Step 2: Implement Aspect Ratio Configuration

```typescript
// packages/agents/media/src/image-prompts/aspect-ratio-config.ts

import { Platform, ContentType } from './types';

interface AspectRatioSpec {
  ratio: string;
  resolutions: {
    low: string;
    medium: string;
    high: string;
  };
}

const ASPECT_RATIOS: Record<string, AspectRatioSpec> = {
  '1:1': {
    ratio: '1:1',
    resolutions: { low: '512x512', medium: '768x768', high: '1080x1080' }
  },
  '4:5': {
    ratio: '4:5',
    resolutions: { low: '512x640', medium: '768x960', high: '1080x1350' }
  },
  '9:16': {
    ratio: '9:16',
    resolutions: { low: '512x910', medium: '768x1365', high: '1080x1920' }
  },
  '16:9': {
    ratio: '16:9',
    resolutions: { low: '512x288', medium: '1280x720', high: '1920x1080' }
  },
  '1.91:1': {
    ratio: '1.91:1',
    resolutions: { low: '600x314', medium: '1200x628', high: '1200x628' }
  },
  '2:3': {
    ratio: '2:3',
    resolutions: { low: '512x768', medium: '768x1152', high: '1000x1500' }
  }
};

const PLATFORM_CONTENT_RATIOS: Record<string, string> = {
  'instagram:post': '1:1',
  'instagram:story': '9:16',
  'instagram:reel': '9:16',
  'instagram:carousel': '1:1',
  'instagram:ad': '1:1',
  'facebook:post': '1.91:1',
  'facebook:story': '9:16',
  'facebook:ad': '1.91:1',
  'facebook:cover': '16:9',
  'tiktok:post': '9:16',
  'tiktok:thumbnail': '9:16',
  'youtube:thumbnail': '16:9',
  'youtube:post': '16:9',
  'youtube:cover': '16:9',
  'linkedin:post': '1.91:1',
  'linkedin:cover': '4:1',
  'x:post': '16:9',
  'x:ad': '1.91:1',
  'skool:post': '16:9'
};

export class AspectRatioConfig {
  static get(platform: Platform, contentType: ContentType): string {
    const key = `${platform}:${contentType}`;
    return PLATFORM_CONTENT_RATIOS[key] || '1:1';
  }

  static getResolution(
    ratio: string,
    quality: 'low' | 'medium' | 'high' = 'high'
  ): string {
    const spec = ASPECT_RATIOS[ratio];
    if (!spec) {
      return '1080x1080'; // Default
    }
    return spec.resolutions[quality];
  }

  static getSpec(ratio: string): AspectRatioSpec | null {
    return ASPECT_RATIOS[ratio] || null;
  }

  static getAllRatios(): string[] {
    return Object.keys(ASPECT_RATIOS);
  }

  static getMidjourneyRatio(ratio: string): string {
    // Midjourney uses specific format
    const conversions: Record<string, string> = {
      '1:1': '1:1',
      '4:5': '4:5',
      '9:16': '9:16',
      '16:9': '16:9',
      '1.91:1': '191:100',
      '2:3': '2:3'
    };
    return conversions[ratio] || '1:1';
  }
}
```

#### Step 3: Implement Image Prompt Templates

```typescript
// packages/agents/media/src/image-prompts/image-prompt-templates.ts

import { ImageType, ImageStyle } from './types';

export interface ImageTemplate {
  basePrompt: string;
  modifiers: string[];
  lightingDefaults: string;
  compositionHints: string[];
  negativePromptBase: string[];
}

const TEMPLATES: Record<ImageType, ImageTemplate> = {
  product: {
    basePrompt: 'product photography, studio lighting, clean background',
    modifiers: [
      'commercial photography',
      'high-end product shot',
      'catalog quality',
      'e-commerce style'
    ],
    lightingDefaults: 'soft studio lighting, even illumination, subtle shadows',
    compositionHints: [
      'centered product',
      '45-degree angle',
      'hero shot',
      'detail close-up'
    ],
    negativePromptBase: [
      'blurry', 'distorted', 'low quality', 'watermark',
      'cluttered background', 'harsh shadows', 'overexposed'
    ]
  },
  lifestyle: {
    basePrompt: 'lifestyle photography, natural light, authentic moment',
    modifiers: [
      'candid shot',
      'in-context usage',
      'real-world setting',
      'aspirational lifestyle'
    ],
    lightingDefaults: 'natural daylight, golden hour, soft ambient light',
    compositionHints: [
      'rule of thirds',
      'environmental portrait',
      'action shot',
      'over-the-shoulder'
    ],
    negativePromptBase: [
      'staged', 'artificial', 'stock photo cliché',
      'overly posed', 'fake smile', 'unnatural colors'
    ]
  },
  portrait: {
    basePrompt: 'portrait photography, professional headshot, sharp focus on face',
    modifiers: [
      'studio portrait',
      'environmental portrait',
      'corporate headshot',
      'editorial portrait'
    ],
    lightingDefaults: 'Rembrandt lighting, soft key light, subtle fill',
    compositionHints: [
      'head and shoulders',
      'three-quarter view',
      'eye-level camera',
      'shallow depth of field'
    ],
    negativePromptBase: [
      'unflattering angle', 'harsh shadows on face',
      'red eye', 'blemishes', 'distorted features', 'double chin'
    ]
  },
  graphic: {
    basePrompt: 'graphic design, clean layout, vector style',
    modifiers: [
      'infographic style',
      'flat design',
      'modern graphic',
      'branded visual'
    ],
    lightingDefaults: 'flat lighting, no shadows, even color',
    compositionHints: [
      'grid layout',
      'visual hierarchy',
      'balanced composition',
      'white space'
    ],
    negativePromptBase: [
      'photorealistic', 'complex textures', 'gradients',
      'cluttered', 'too many elements', 'inconsistent style'
    ]
  },
  scene: {
    basePrompt: 'scene photography, establishing shot, environmental',
    modifiers: [
      'wide angle',
      'interior design',
      'exterior shot',
      'atmosphere focused'
    ],
    lightingDefaults: 'natural environmental lighting, mood lighting, atmospheric',
    compositionHints: [
      'leading lines',
      'depth layers',
      'foreground interest',
      'establishing context'
    ],
    negativePromptBase: [
      'empty', 'boring composition', 'flat lighting',
      'no focal point', 'distracting elements'
    ]
  },
  abstract: {
    basePrompt: 'abstract art, creative composition, artistic expression',
    modifiers: [
      'geometric abstract',
      'organic shapes',
      'texture focused',
      'color field'
    ],
    lightingDefaults: 'dramatic lighting, high contrast, creative shadows',
    compositionHints: [
      'dynamic composition',
      'asymmetric balance',
      'color harmony',
      'movement suggestion'
    ],
    negativePromptBase: [
      'literal', 'recognizable objects', 'mundane',
      'boring', 'muddy colors', 'cluttered'
    ]
  },
  text_overlay: {
    basePrompt: 'background for text overlay, space for copy, clean negative space',
    modifiers: [
      'quote background',
      'announcement graphic',
      'text-friendly layout',
      'social media template'
    ],
    lightingDefaults: 'even lighting, low contrast areas for text',
    compositionHints: [
      'left third clear',
      'center clear',
      'bottom third clear',
      'gradient area for text'
    ],
    negativePromptBase: [
      'busy background', 'no clear space',
      'high contrast patterns', 'distracting elements'
    ]
  },
  collage: {
    basePrompt: 'photo collage, multiple images, grid layout',
    modifiers: [
      'mood board',
      'before/after',
      'step by step',
      'collection showcase'
    ],
    lightingDefaults: 'consistent lighting across all elements',
    compositionHints: [
      'grid alignment',
      'size variation',
      'thematic grouping',
      'visual flow'
    ],
    negativePromptBase: [
      'mismatched styles', 'inconsistent colors',
      'poor alignment', 'cluttered', 'no visual hierarchy'
    ]
  }
};

const STYLE_MODIFIERS: Record<ImageStyle, string[]> = {
  photorealistic: [
    'photorealistic', 'hyperrealistic', 'photo quality',
    'DSLR quality', '8K resolution', 'sharp details'
  ],
  illustration: [
    'digital illustration', 'hand-drawn style', 'artistic rendering',
    'illustration art', 'creative interpretation'
  ],
  minimalist: [
    'minimalist design', 'clean aesthetic', 'simple composition',
    'white space', 'less is more', 'refined simplicity'
  ],
  vibrant: [
    'vibrant colors', 'saturated', 'bold palette',
    'eye-catching', 'energetic', 'pop colors'
  ],
  cinematic: [
    'cinematic lighting', 'movie still', 'dramatic atmosphere',
    'film grain', 'anamorphic', 'theatrical'
  ],
  editorial: [
    'editorial style', 'magazine quality', 'fashion forward',
    'high-end publication', 'sophisticated', 'curated'
  ],
  flat_design: [
    'flat design', '2D graphics', 'no shadows',
    'bold shapes', 'solid colors', 'geometric'
  ],
  isometric: [
    'isometric view', '3D isometric', 'isometric illustration',
    'axonometric projection', 'technical illustration'
  ],
  watercolor: [
    'watercolor painting', 'soft edges', 'color bleed',
    'artistic texture', 'hand-painted feel'
  ],
  sketch: [
    'pencil sketch', 'hand-drawn', 'line art',
    'rough sketch', 'artistic sketch', 'drawing style'
  ]
};

export class ImagePromptTemplates {
  static getTemplate(imageType: ImageType): ImageTemplate {
    return TEMPLATES[imageType] || TEMPLATES.scene;
  }

  static getStyleModifiers(style: ImageStyle): string[] {
    return STYLE_MODIFIERS[style] || STYLE_MODIFIERS.photorealistic;
  }

  static getAllImageTypes(): ImageType[] {
    return Object.keys(TEMPLATES) as ImageType[];
  }

  static getAllStyles(): ImageStyle[] {
    return Object.keys(STYLE_MODIFIERS) as ImageStyle[];
  }

  static combineNegativePrompts(
    templateNegatives: string[],
    brandAvoids: string[],
    customNegatives: string[] = []
  ): string {
    const all = [...new Set([
      ...templateNegatives,
      ...brandAvoids,
      ...customNegatives
    ])];
    return all.join(', ');
  }
}
```

#### Step 4: Implement Image Prompt Generator

```typescript
// packages/agents/media/src/image-prompts/image-prompt-generator.ts

import { nanoid } from 'nanoid';
import {
  ImagePromptRequest,
  ImagePromptResult,
  ImagePromptVariant,
  BrandVisualGuidelines,
  ImageStyle,
  ImageType,
  ImageProvider,
  Platform,
  ContentType
} from './types';
import { AspectRatioConfig } from './aspect-ratio-config';
import { ImagePromptTemplates } from './image-prompt-templates';

export class ImagePromptGenerator {
  generate(request: ImagePromptRequest): ImagePromptResult {
    // Determine image type
    const imageType = request.imageType || this.inferImageType(request.contentBrief);

    // Get template for image type
    const template = ImagePromptTemplates.getTemplate(imageType);

    // Get aspect ratio
    const aspectRatio = AspectRatioConfig.get(request.platform, request.contentType);
    const resolution = AspectRatioConfig.getResolution(aspectRatio);

    // Build main prompt
    const prompt = this.buildPrompt(request, template);

    // Build negative prompt
    const negativePrompt = this.buildNegativePrompt(request, template);

    // Generate variants if requested
    const variants = request.variantCount && request.variantCount > 1
      ? this.generateVariants(request, template, request.variantCount)
      : undefined;

    // Format for different providers
    const formattedPrompts = this.formatForProviders(
      prompt,
      negativePrompt,
      aspectRatio,
      request.style || 'photorealistic'
    );

    return {
      prompt,
      negativePrompt,
      aspectRatio,
      resolution,
      styleApplied: request.style,
      styleNotes: request.brandGuidelines
        ? this.buildStyleNotes(request.brandGuidelines)
        : undefined,
      formattedPrompts,
      variants,
      metadata: {
        platform: request.platform,
        contentType: request.contentType,
        imageType,
        generatedAt: new Date().toISOString()
      }
    };
  }

  private buildPrompt(
    request: ImagePromptRequest,
    template: any
  ): string {
    const parts: string[] = [];

    // Start with content brief
    parts.push(request.contentBrief);

    // Add template base
    parts.push(template.basePrompt);

    // Add style modifiers
    if (request.style) {
      const styleModifiers = ImagePromptTemplates.getStyleModifiers(request.style);
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
    template: any
  ): string {
    const negatives = [...template.negativePromptBase];

    // Add brand avoid visuals
    if (request.brandGuidelines?.avoidVisuals) {
      negatives.push(...request.brandGuidelines.avoidVisuals);
    }

    // Add standard quality negatives
    negatives.push(
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
    template: any,
    count: number
  ): ImagePromptVariant[] {
    const compositions = template.compositionHints;
    const variants: ImagePromptVariant[] = [];

    for (let i = 0; i < count; i++) {
      const composition = compositions[i % compositions.length];
      const modifier = template.modifiers[i % template.modifiers.length];

      const prompt = `${request.contentBrief}, ${composition}, ${modifier}, ${template.basePrompt}`;

      variants.push({
        prompt,
        negativePrompt: this.buildNegativePrompt(request, template),
        composition,
        emphasis: modifier
      });
    }

    return variants;
  }

  private formatForProviders(
    prompt: string,
    negativePrompt: string,
    aspectRatio: string,
    style: ImageStyle
  ): ImagePromptResult['formattedPrompts'] {
    const mjRatio = AspectRatioConfig.getMidjourneyRatio(aspectRatio);

    return {
      midjourney: `${prompt} --ar ${mjRatio} --v 6 --style raw`,
      dalle: prompt, // DALL-E uses natural language
      stable_diffusion: `${prompt}\n\nNegative prompt: ${negativePrompt}`,
      generic: prompt
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
      skool: 'educational, professional, community-focused'
    };

    return keywords[platform] || 'high quality';
  }

  private inferImageType(brief: string): ImageType {
    const briefLower = brief.toLowerCase();

    if (briefLower.includes('product') || briefLower.includes('item')) {
      return 'product';
    }
    if (briefLower.includes('person') || briefLower.includes('headshot') || briefLower.includes('portrait')) {
      return 'portrait';
    }
    if (briefLower.includes('lifestyle') || briefLower.includes('using') || briefLower.includes('action')) {
      return 'lifestyle';
    }
    if (briefLower.includes('graphic') || briefLower.includes('infographic') || briefLower.includes('chart')) {
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
      '#F97316': 'orange'
    };

    // Try exact match
    if (colorMap[hex.toUpperCase()]) {
      return colorMap[hex.toUpperCase()];
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

export { ImagePromptTemplates } from './image-prompt-templates';
export { AspectRatioConfig } from './aspect-ratio-config';
```

#### Step 5: Create Package Exports

```typescript
// packages/agents/media/src/image-prompts/index.ts

export * from './types';
export * from './image-prompt-generator';
export * from './image-prompt-templates';
export * from './aspect-ratio-config';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/agents/media
pnpm test src/image-prompts

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint src/image-prompts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/media/src/image-prompts/types.ts` | Type definitions |
| Create | `packages/agents/media/src/image-prompts/aspect-ratio-config.ts` | Platform aspect ratios |
| Create | `packages/agents/media/src/image-prompts/image-prompt-templates.ts` | Image type templates |
| Create | `packages/agents/media/src/image-prompts/image-prompt-generator.ts` | Main prompt generation |
| Create | `packages/agents/media/src/image-prompts/index.ts` | Package exports |
| Create | `packages/agents/media/src/image-prompts/__tests__/image-prompt-generator.test.ts` | Tests |

---

## Acceptance Criteria

- [ ] ImagePromptGenerator creates effective image prompts
- [ ] Brand visual guidelines injected
- [ ] Platform-specific aspect ratios applied
- [ ] 8 image types supported with templates
- [ ] 10 style presets available
- [ ] Negative prompts generated
- [ ] Provider-specific formatting (Midjourney, DALL-E, SD)
- [ ] Variant generation works
- [ ] Tests pass with >90% coverage

---

## Test Requirements

### Unit Tests
- Basic prompt generation
- Brand guidelines integration
- Style presets
- Platform optimization
- Content type handling
- Variant generation
- Provider formatting

### Integration Tests
- Full prompt generation flow
- Multiple providers

---

## Security & Safety Checklist

- [ ] No inappropriate content in prompts
- [ ] Brand guidelines validated
- [ ] No PII in prompts
- [ ] Audit logging for generated prompts

---

## JSON Task Block

```json
{
  "task_id": "S2-D1",
  "name": "Image Prompt Generation",
  "status": "pending",
  "dependencies": ["S1-A2", "S1-B1", "S2-C1"],
  "blocks": ["S2-D2", "S2-D4"],
  "agent": "D",
  "sprint": 2,
  "complexity": "high",
  "estimated_files": 5,
  "tdd_required": true,
  "spec_refs": [
    "docs/03-agents-tools/agent-recursion-contracts.md",
    "docs/02-schemas/external-memory-schema.md"
  ],
  "acceptance_checklist": [
    "prompt_composition",
    "brand_guidelines",
    "aspect_ratios",
    "image_types",
    "style_presets",
    "provider_formatting"
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
    { "type": "brand_visual_guidelines", "scope": "client" }
  ],
  "writes": [
    { "type": "image_prompt", "scope": "content" }
  ],
  "context_window_at_completion": null,
  "continuation_hint": "Prompts feed into image generation lane in S2-D2"
}
```
