# Build Prompt: S2-D4 — Thumbnail Generation

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-D4 |
| Sprint | 2 |
| Agent | D (Media Generation) |
| Complexity | Medium |
| Status | pending |
| Estimated Files | 4 |
| Spec References | `agent-recursion-contracts.md`, `platform-playbooks/` |

---

## Context

### What This Builds

The Thumbnail Generation service — a specialized system for creating click-worthy thumbnails optimized for YouTube, Instagram, and other platforms. Thumbnails are distinct from regular images: they require high contrast, readable text, expressive faces, and clear visual hierarchy.

### Why It Matters

Thumbnails determine click-through rates:
- **YouTube**: Thumbnail is 90% of the click decision
- **Instagram**: Cover images set carousel/reel expectations
- **LinkedIn**: Article thumbnails drive engagement
- **Content Discovery**: The visual promise that content delivers on

### Architecture Decision

Thumbnail generation uses a **composition-based approach**:
1. **Background Layer**: Gradient, image, or solid color
2. **Subject Layer**: Person, product, or main visual element
3. **Text Layer**: Title, hook, or key message
4. **Accent Layer**: Arrows, circles, emojis, visual cues
5. **Brand Layer**: Logo, colors, consistent styling

---

## Prerequisites

### Completed Tasks
- [x] S2-D1: Image prompt generation
- [x] S2-D2: Image generation lane
- [x] S1-A2: BrandKit domain model

### Required Packages
```bash
pnpm add sharp canvas zod nanoid
pnpm add -D vitest @types/canvas
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests that define the expected behavior:

```typescript
// packages/agents/media/src/thumbnails/__tests__/thumbnail-generator.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ThumbnailGenerator,
  ThumbnailRequest,
  ThumbnailResult,
  ThumbnailStyle
} from '../thumbnail-generator';
import { ThumbnailTemplateLibrary } from '../thumbnail-templates';

describe('ThumbnailGenerator', () => {
  let generator: ThumbnailGenerator;
  let mockImageGenerator: any;
  let mockStorageClient: any;

  beforeEach(() => {
    mockImageGenerator = {
      generate: vi.fn().mockResolvedValue({
        status: 'completed',
        imageUrl: 'https://example.com/generated.png',
        storageKey: 'images/test.png'
      })
    };

    mockStorageClient = {
      upload: vi.fn().mockResolvedValue({
        url: 'https://storage.example.com/thumbnails/test.png',
        key: 'thumbnails/test.png'
      }),
      download: vi.fn().mockResolvedValue(Buffer.from('image data'))
    };

    generator = new ThumbnailGenerator({
      imageGenerator: mockImageGenerator,
      storageClient: mockStorageClient
    });
  });

  describe('basic thumbnail generation', () => {
    it('should generate YouTube thumbnail at correct size', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'How I Made $10K This Month',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.status).toBe('completed');
      expect(result.dimensions).toEqual({ width: 1280, height: 720 });
    });

    it('should generate Instagram cover at correct size', async () => {
      const request: ThumbnailRequest = {
        platform: 'instagram',
        contentType: 'reel_cover',
        title: 'Watch This!',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.dimensions).toEqual({ width: 1080, height: 1920 });
    });

    it('should include text overlay', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'The Secret to Success',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.textApplied).toBe(true);
      expect(result.titleUsed).toBe('The Secret to Success');
    });
  });

  describe('thumbnail styles', () => {
    const styles: ThumbnailStyle[] = [
      'face_reaction',
      'before_after',
      'listicle',
      'question',
      'reveal',
      'comparison',
      'tutorial',
      'story'
    ];

    styles.forEach(style => {
      it(`should support ${style} style`, async () => {
        const request: ThumbnailRequest = {
          platform: 'youtube',
          title: 'Test Title',
          style,
          clientId: 'client-123'
        };

        const result = await generator.generate(request);

        expect(result.styleApplied).toBe(style);
      });
    });
  });

  describe('text optimization', () => {
    it('should limit text length for readability', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'This Is A Very Long Title That Should Be Shortened For Thumbnail Readability And Maximum Impact',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.titleUsed?.length).toBeLessThanOrEqual(50);
    });

    it('should use high-contrast text colors', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'Test',
        backgroundColor: '#000000',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      // White text on black background
      expect(result.textColor).toBe('#FFFFFF');
    });

    it('should add text shadow for readability', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'Test',
        style: 'face_reaction',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.textEffects).toContain('shadow');
    });
  });

  describe('face detection positioning', () => {
    it('should position text avoiding face area', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'Amazing Results',
        backgroundImage: 'https://example.com/person.jpg',
        facePosition: 'right',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.textPosition).toBe('left');
    });

    it('should position text at bottom for centered faces', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'Watch This',
        backgroundImage: 'https://example.com/person.jpg',
        facePosition: 'center',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(['top', 'bottom']).toContain(result.textPosition);
    });
  });

  describe('brand integration', () => {
    it('should apply brand colors', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'Brand Video',
        brandGuidelines: {
          primaryColor: '#FF5733',
          secondaryColor: '#33FF57',
          fontFamily: 'Montserrat'
        },
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.colorsUsed).toContain('#FF5733');
    });

    it('should add brand logo when provided', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'Test',
        brandGuidelines: {
          logo: 'https://example.com/logo.png',
          logoPosition: 'bottom_right'
        },
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.logoApplied).toBe(true);
    });
  });

  describe('visual accents', () => {
    it('should add attention-grabbing accents', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'Click Here!',
        accents: ['arrow', 'circle'],
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.accentsApplied).toContain('arrow');
      expect(result.accentsApplied).toContain('circle');
    });

    it('should support emoji accents', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'Big News',
        accents: ['emoji:fire', 'emoji:rocket'],
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.emojisUsed).toContain('fire');
    });
  });

  describe('A/B variant generation', () => {
    it('should generate multiple variants', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'Test Video',
        variantCount: 3,
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.variants?.length).toBe(3);
    });

    it('should vary text position in variants', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'Test',
        variantCount: 2,
        variantStrategy: 'text_position',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      const positions = result.variants?.map(v => v.textPosition);
      expect(new Set(positions).size).toBeGreaterThan(1);
    });

    it('should vary colors in variants', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'Test',
        variantCount: 2,
        variantStrategy: 'color',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      const colors = result.variants?.map(v => v.primaryColor);
      expect(new Set(colors).size).toBeGreaterThan(1);
    });
  });

  describe('platform-specific optimization', () => {
    it('should optimize contrast for small display sizes', async () => {
      const request: ThumbnailRequest = {
        platform: 'youtube',
        title: 'Test',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      // Should have high contrast ratio
      expect(result.contrastRatio).toBeGreaterThan(4.5);
    });

    it('should use larger text for YouTube (small thumbnail display)', async () => {
      const youtube = await generator.generate({
        platform: 'youtube',
        title: 'Test',
        clientId: 'client-123'
      });

      const instagram = await generator.generate({
        platform: 'instagram',
        title: 'Test',
        clientId: 'client-123'
      });

      // YouTube thumbnails are viewed smaller, need bigger text
      expect(youtube.fontSizeRelative).toBeGreaterThan(instagram.fontSizeRelative);
    });
  });
});

describe('ThumbnailTemplateLibrary', () => {
  it('should return template for style', () => {
    const template = ThumbnailTemplateLibrary.getTemplate('face_reaction');

    expect(template).toBeDefined();
    expect(template.name).toBe('Face Reaction');
    expect(template.layers).toBeDefined();
  });

  it('should list all templates', () => {
    const templates = ThumbnailTemplateLibrary.listTemplates();
    expect(templates.length).toBeGreaterThan(5);
  });

  it('should recommend templates by content type', () => {
    const recommendations = ThumbnailTemplateLibrary.recommend('tutorial');
    expect(recommendations).toContain('tutorial');
    expect(recommendations).toContain('listicle');
  });
});
```

### Phase 2: Implementation

#### Step 1: Define Thumbnail Types

```typescript
// packages/agents/media/src/thumbnails/types.ts

import { z } from 'zod';
import { Platform } from '../image-prompts/types';

export const ThumbnailStyleSchema = z.enum([
  'face_reaction',  // Big face with exaggerated expression
  'before_after',   // Split screen comparison
  'listicle',       // Number + title (5 Tips, 10 Secrets)
  'question',       // Question with curious imagery
  'reveal',         // Blurred/hidden element
  'comparison',     // Side by side
  'tutorial',       // Step indicator style
  'story',          // Narrative/emotional
  'minimal',        // Clean, simple
  'bold_text'       // Text-dominant design
]);

export type ThumbnailStyle = z.infer<typeof ThumbnailStyleSchema>;

export const ThumbnailContentTypeSchema = z.enum([
  'video',
  'reel_cover',
  'carousel_cover',
  'article',
  'story_highlight'
]);

export type ThumbnailContentType = z.infer<typeof ThumbnailContentTypeSchema>;

export const AccentTypeSchema = z.enum([
  'arrow',
  'circle',
  'underline',
  'highlight',
  'border',
  'glow',
  'emoji:fire',
  'emoji:rocket',
  'emoji:star',
  'emoji:money',
  'emoji:lightning',
  'emoji:heart'
]);

export type AccentType = z.infer<typeof AccentTypeSchema>;

export interface BrandGuidelines {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  logo?: string;
  logoPosition?: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
}

export interface ThumbnailRequest {
  platform: Platform;
  contentType?: ThumbnailContentType;
  title: string;
  subtitle?: string;
  style?: ThumbnailStyle;
  backgroundImage?: string;
  backgroundColor?: string;
  facePosition?: 'left' | 'center' | 'right';
  brandGuidelines?: BrandGuidelines;
  accents?: AccentType[];
  variantCount?: number;
  variantStrategy?: 'text_position' | 'color' | 'style' | 'accent';
  clientId: string;
}

export interface ThumbnailVariant {
  imageUrl: string;
  textPosition: string;
  primaryColor: string;
  style: ThumbnailStyle;
}

export interface ThumbnailResult {
  id: string;
  status: 'completed' | 'failed';
  imageUrl?: string;
  storageKey?: string;
  dimensions: { width: number; height: number };
  styleApplied: ThumbnailStyle;
  textApplied: boolean;
  titleUsed?: string;
  textPosition: string;
  textColor: string;
  textEffects: string[];
  colorsUsed: string[];
  logoApplied: boolean;
  accentsApplied: AccentType[];
  emojisUsed: string[];
  contrastRatio: number;
  fontSizeRelative: number;
  variants?: ThumbnailVariant[];
  error?: string;
}

export interface TemplateLayer {
  type: 'background' | 'subject' | 'text' | 'accent' | 'logo';
  position: { x: string; y: string };
  size: { width: string; height: string };
  zIndex: number;
  properties: Record<string, any>;
}

export interface ThumbnailTemplate {
  name: string;
  description: string;
  layers: TemplateLayer[];
  textPosition: 'left' | 'right' | 'center' | 'top' | 'bottom';
  accentPositions: string[];
  recommendedFor: string[];
}
```

#### Step 2: Implement Template Library

```typescript
// packages/agents/media/src/thumbnails/thumbnail-templates.ts

import { ThumbnailStyle, ThumbnailTemplate, TemplateLayer } from './types';

const TEMPLATES: Record<ThumbnailStyle, ThumbnailTemplate> = {
  face_reaction: {
    name: 'Face Reaction',
    description: 'Large expressive face with reaction-based text',
    layers: [
      {
        type: 'background',
        position: { x: '0', y: '0' },
        size: { width: '100%', height: '100%' },
        zIndex: 0,
        properties: { gradient: true }
      },
      {
        type: 'subject',
        position: { x: '60%', y: 'center' },
        size: { width: '50%', height: '90%' },
        zIndex: 1,
        properties: { crop: 'face' }
      },
      {
        type: 'text',
        position: { x: '5%', y: 'center' },
        size: { width: '45%', height: 'auto' },
        zIndex: 2,
        properties: { fontSize: 'large', shadow: true }
      }
    ],
    textPosition: 'left',
    accentPositions: ['bottom_left', 'top_right'],
    recommendedFor: ['vlogs', 'reactions', 'reviews']
  },
  before_after: {
    name: 'Before/After',
    description: 'Split screen comparison',
    layers: [
      {
        type: 'background',
        position: { x: '0', y: '0' },
        size: { width: '50%', height: '100%' },
        zIndex: 0,
        properties: { label: 'BEFORE', filter: 'desaturate' }
      },
      {
        type: 'background',
        position: { x: '50%', y: '0' },
        size: { width: '50%', height: '100%' },
        zIndex: 0,
        properties: { label: 'AFTER', filter: 'vibrant' }
      },
      {
        type: 'text',
        position: { x: 'center', y: 'bottom' },
        size: { width: '90%', height: 'auto' },
        zIndex: 2,
        properties: { fontSize: 'medium', background: true }
      }
    ],
    textPosition: 'bottom',
    accentPositions: ['center'],
    recommendedFor: ['transformations', 'tutorials', 'reviews']
  },
  listicle: {
    name: 'Listicle',
    description: 'Number-focused list style',
    layers: [
      {
        type: 'background',
        position: { x: '0', y: '0' },
        size: { width: '100%', height: '100%' },
        zIndex: 0,
        properties: { gradient: 'diagonal' }
      },
      {
        type: 'text',
        position: { x: '10%', y: '20%' },
        size: { width: '30%', height: '60%' },
        zIndex: 1,
        properties: { type: 'number', fontSize: 'huge', color: 'accent' }
      },
      {
        type: 'text',
        position: { x: '45%', y: 'center' },
        size: { width: '50%', height: 'auto' },
        zIndex: 2,
        properties: { fontSize: 'large', align: 'left' }
      }
    ],
    textPosition: 'right',
    accentPositions: ['bottom_right'],
    recommendedFor: ['tips', 'lists', 'educational']
  },
  question: {
    name: 'Question',
    description: 'Curiosity-driven question format',
    layers: [
      {
        type: 'background',
        position: { x: '0', y: '0' },
        size: { width: '100%', height: '100%' },
        zIndex: 0,
        properties: { blur: 'subtle' }
      },
      {
        type: 'text',
        position: { x: 'center', y: 'center' },
        size: { width: '80%', height: 'auto' },
        zIndex: 1,
        properties: { fontSize: 'large', questionMark: true }
      }
    ],
    textPosition: 'center',
    accentPositions: ['corners'],
    recommendedFor: ['q&a', 'educational', 'curiosity']
  },
  reveal: {
    name: 'Reveal',
    description: 'Hidden/blurred element to reveal',
    layers: [
      {
        type: 'background',
        position: { x: '0', y: '0' },
        size: { width: '100%', height: '100%' },
        zIndex: 0,
        properties: {}
      },
      {
        type: 'subject',
        position: { x: 'center', y: 'center' },
        size: { width: '60%', height: '60%' },
        zIndex: 1,
        properties: { blur: 'heavy', border: 'question' }
      },
      {
        type: 'text',
        position: { x: 'center', y: 'bottom' },
        size: { width: '80%', height: 'auto' },
        zIndex: 2,
        properties: { fontSize: 'large' }
      }
    ],
    textPosition: 'bottom',
    accentPositions: ['center'],
    recommendedFor: ['reveals', 'surprises', 'announcements']
  },
  comparison: {
    name: 'Comparison',
    description: 'Side by side comparison',
    layers: [
      {
        type: 'subject',
        position: { x: '10%', y: 'center' },
        size: { width: '35%', height: '80%' },
        zIndex: 1,
        properties: { label: 'VS' }
      },
      {
        type: 'subject',
        position: { x: '55%', y: 'center' },
        size: { width: '35%', height: '80%' },
        zIndex: 1,
        properties: {}
      },
      {
        type: 'text',
        position: { x: 'center', y: 'bottom' },
        size: { width: '100%', height: 'auto' },
        zIndex: 2,
        properties: { fontSize: 'medium', background: 'band' }
      }
    ],
    textPosition: 'bottom',
    accentPositions: ['center'],
    recommendedFor: ['comparisons', 'versus', 'reviews']
  },
  tutorial: {
    name: 'Tutorial',
    description: 'Educational step-based',
    layers: [
      {
        type: 'background',
        position: { x: '0', y: '0' },
        size: { width: '100%', height: '100%' },
        zIndex: 0,
        properties: { gradient: 'subtle' }
      },
      {
        type: 'accent',
        position: { x: '5%', y: '5%' },
        size: { width: '15%', height: 'auto' },
        zIndex: 1,
        properties: { type: 'step_indicator' }
      },
      {
        type: 'text',
        position: { x: 'center', y: 'center' },
        size: { width: '85%', height: 'auto' },
        zIndex: 2,
        properties: { fontSize: 'large' }
      }
    ],
    textPosition: 'center',
    accentPositions: ['top_left'],
    recommendedFor: ['tutorials', 'how-to', 'educational']
  },
  story: {
    name: 'Story',
    description: 'Narrative emotional style',
    layers: [
      {
        type: 'background',
        position: { x: '0', y: '0' },
        size: { width: '100%', height: '100%' },
        zIndex: 0,
        properties: { cinematic: true }
      },
      {
        type: 'text',
        position: { x: 'center', y: 'bottom' },
        size: { width: '90%', height: 'auto' },
        zIndex: 1,
        properties: { fontSize: 'medium', style: 'cinematic' }
      }
    ],
    textPosition: 'bottom',
    accentPositions: [],
    recommendedFor: ['stories', 'vlogs', 'documentaries']
  },
  minimal: {
    name: 'Minimal',
    description: 'Clean simple design',
    layers: [
      {
        type: 'background',
        position: { x: '0', y: '0' },
        size: { width: '100%', height: '100%' },
        zIndex: 0,
        properties: { solid: true }
      },
      {
        type: 'text',
        position: { x: 'center', y: 'center' },
        size: { width: '70%', height: 'auto' },
        zIndex: 1,
        properties: { fontSize: 'large', weight: 'bold' }
      }
    ],
    textPosition: 'center',
    accentPositions: [],
    recommendedFor: ['podcasts', 'interviews', 'professional']
  },
  bold_text: {
    name: 'Bold Text',
    description: 'Text-dominant high impact',
    layers: [
      {
        type: 'background',
        position: { x: '0', y: '0' },
        size: { width: '100%', height: '100%' },
        zIndex: 0,
        properties: { gradient: 'vibrant' }
      },
      {
        type: 'text',
        position: { x: 'center', y: 'center' },
        size: { width: '90%', height: 'auto' },
        zIndex: 1,
        properties: { fontSize: 'huge', weight: 'black', outline: true }
      }
    ],
    textPosition: 'center',
    accentPositions: ['corners'],
    recommendedFor: ['announcements', 'breaking news', 'viral']
  }
};

export class ThumbnailTemplateLibrary {
  static getTemplate(style: ThumbnailStyle): ThumbnailTemplate {
    return TEMPLATES[style] || TEMPLATES.bold_text;
  }

  static listTemplates(): ThumbnailStyle[] {
    return Object.keys(TEMPLATES) as ThumbnailStyle[];
  }

  static recommend(contentType: string): ThumbnailStyle[] {
    const recommendations: ThumbnailStyle[] = [];

    for (const [style, template] of Object.entries(TEMPLATES)) {
      if (template.recommendedFor.some(r =>
        r.toLowerCase().includes(contentType.toLowerCase())
      )) {
        recommendations.push(style as ThumbnailStyle);
      }
    }

    return recommendations.length > 0
      ? recommendations
      : ['bold_text', 'face_reaction'];
  }

  static getTextPositionForFace(facePosition: 'left' | 'center' | 'right'): string {
    const opposite: Record<string, string> = {
      left: 'right',
      right: 'left',
      center: 'bottom'
    };
    return opposite[facePosition] || 'left';
  }
}
```

#### Step 3: Implement Thumbnail Generator

```typescript
// packages/agents/media/src/thumbnails/thumbnail-generator.ts

import { nanoid } from 'nanoid';
import {
  ThumbnailRequest,
  ThumbnailResult,
  ThumbnailVariant,
  ThumbnailStyle,
  AccentType
} from './types';
import { ThumbnailTemplateLibrary } from './thumbnail-templates';

interface ImageGenerator {
  generate(request: any): Promise<{
    status: string;
    imageUrl: string;
    storageKey: string;
  }>;
}

interface StorageClient {
  upload(params: { key: string; data: Buffer; contentType: string }): Promise<{ url: string; key: string }>;
  download(url: string): Promise<Buffer>;
}

interface ThumbnailGeneratorOptions {
  imageGenerator: ImageGenerator;
  storageClient: StorageClient;
}

const PLATFORM_DIMENSIONS: Record<string, { width: number; height: number }> = {
  'youtube:video': { width: 1280, height: 720 },
  'instagram:reel_cover': { width: 1080, height: 1920 },
  'instagram:carousel_cover': { width: 1080, height: 1080 },
  'instagram:story_highlight': { width: 1080, height: 1920 },
  'linkedin:article': { width: 1200, height: 628 },
  'facebook:video': { width: 1280, height: 720 },
  'tiktok:video': { width: 1080, height: 1920 }
};

const CONTRAST_COLORS: Record<string, string> = {
  '#000000': '#FFFFFF',
  '#FFFFFF': '#000000',
  '#FF0000': '#FFFFFF',
  '#0000FF': '#FFFFFF',
  '#00FF00': '#000000'
};

export class ThumbnailGenerator {
  private imageGenerator: ImageGenerator;
  private storageClient: StorageClient;

  constructor(options: ThumbnailGeneratorOptions) {
    this.imageGenerator = options.imageGenerator;
    this.storageClient = options.storageClient;
  }

  async generate(request: ThumbnailRequest): Promise<ThumbnailResult> {
    const id = nanoid();

    try {
      // Get dimensions
      const dimensions = this.getDimensions(request);

      // Determine style
      const style = request.style || this.inferStyle(request);

      // Get template
      const template = ThumbnailTemplateLibrary.getTemplate(style);

      // Process title
      const processedTitle = this.processTitle(request.title);

      // Determine text position
      const textPosition = request.facePosition
        ? ThumbnailTemplateLibrary.getTextPositionForFace(request.facePosition)
        : template.textPosition;

      // Get text color based on background
      const textColor = this.getContrastColor(request.backgroundColor || '#000000');

      // Build image generation prompt
      const prompt = this.buildPrompt(request, template, textPosition);

      // Generate base image
      const imageResult = await this.imageGenerator.generate({
        prompt,
        aspectRatio: `${dimensions.width}:${dimensions.height}`,
        clientId: request.clientId
      });

      // Process accents
      const accentsApplied = request.accents || [];
      const emojisUsed = this.extractEmojis(accentsApplied);

      // Calculate metrics
      const contrastRatio = this.calculateContrast(textColor, request.backgroundColor || '#000000');
      const fontSizeRelative = this.getFontSizeForPlatform(request.platform);

      // Generate variants if requested
      let variants: ThumbnailVariant[] | undefined;
      if (request.variantCount && request.variantCount > 1) {
        variants = await this.generateVariants(request, request.variantCount);
      }

      // Determine colors used
      const colorsUsed = this.getColorsUsed(request);

      return {
        id,
        status: 'completed',
        imageUrl: imageResult.imageUrl,
        storageKey: imageResult.storageKey,
        dimensions,
        styleApplied: style,
        textApplied: true,
        titleUsed: processedTitle,
        textPosition,
        textColor,
        textEffects: this.getTextEffects(style),
        colorsUsed,
        logoApplied: !!request.brandGuidelines?.logo,
        accentsApplied,
        emojisUsed,
        contrastRatio,
        fontSizeRelative,
        variants
      };
    } catch (error) {
      return {
        id,
        status: 'failed',
        dimensions: { width: 0, height: 0 },
        styleApplied: request.style || 'bold_text',
        textApplied: false,
        textPosition: 'center',
        textColor: '#FFFFFF',
        textEffects: [],
        colorsUsed: [],
        logoApplied: false,
        accentsApplied: [],
        emojisUsed: [],
        contrastRatio: 0,
        fontSizeRelative: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getDimensions(request: ThumbnailRequest): { width: number; height: number } {
    const key = `${request.platform}:${request.contentType || 'video'}`;
    return PLATFORM_DIMENSIONS[key] || PLATFORM_DIMENSIONS['youtube:video'];
  }

  private inferStyle(request: ThumbnailRequest): ThumbnailStyle {
    const title = request.title.toLowerCase();

    // Number-based titles
    if (/^\d+/.test(request.title)) {
      return 'listicle';
    }

    // Question titles
    if (title.includes('?') || title.startsWith('how') || title.startsWith('why') || title.startsWith('what')) {
      return 'question';
    }

    // Before/after
    if (title.includes('before') || title.includes('after') || title.includes('transformation')) {
      return 'before_after';
    }

    // Comparison
    if (title.includes('vs') || title.includes('versus') || title.includes('compared')) {
      return 'comparison';
    }

    // Default
    return 'face_reaction';
  }

  private processTitle(title: string): string {
    // Limit to ~50 characters for readability
    if (title.length <= 50) {
      return title;
    }

    // Try to cut at word boundary
    const cut = title.substring(0, 47);
    const lastSpace = cut.lastIndexOf(' ');

    if (lastSpace > 30) {
      return cut.substring(0, lastSpace) + '...';
    }

    return cut + '...';
  }

  private getContrastColor(backgroundColor: string): string {
    // Check predefined contrasts
    if (CONTRAST_COLORS[backgroundColor.toUpperCase()]) {
      return CONTRAST_COLORS[backgroundColor.toUpperCase()];
    }

    // Calculate luminance
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }

  private buildPrompt(
    request: ThumbnailRequest,
    template: any,
    textPosition: string
  ): string {
    const parts: string[] = [
      'YouTube thumbnail design',
      `style: ${template.name}`,
      `text "${request.title}" positioned at ${textPosition}`,
      'high contrast',
      'bold typography',
      'eye-catching',
      'professional thumbnail design'
    ];

    if (request.backgroundImage) {
      parts.push(`background: ${request.backgroundImage}`);
    }

    if (request.brandGuidelines?.primaryColor) {
      parts.push(`primary color: ${request.brandGuidelines.primaryColor}`);
    }

    if (request.accents?.length) {
      parts.push(`visual accents: ${request.accents.join(', ')}`);
    }

    return parts.join(', ');
  }

  private getTextEffects(style: ThumbnailStyle): string[] {
    const effects: string[] = [];

    // Most styles use shadow for readability
    const shadowStyles: ThumbnailStyle[] = [
      'face_reaction', 'before_after', 'reveal', 'story'
    ];

    if (shadowStyles.includes(style)) {
      effects.push('shadow');
    }

    // Some styles use outline
    if (style === 'bold_text') {
      effects.push('outline');
    }

    return effects;
  }

  private extractEmojis(accents: AccentType[]): string[] {
    return accents
      .filter(a => a.startsWith('emoji:'))
      .map(a => a.replace('emoji:', ''));
  }

  private calculateContrast(foreground: string, background: string): number {
    // Simplified WCAG contrast calculation
    const getLuminance = (hex: string): number => {
      const rgb = hex.replace('#', '');
      const r = parseInt(rgb.substring(0, 2), 16) / 255;
      const g = parseInt(rgb.substring(2, 4), 16) / 255;
      const b = parseInt(rgb.substring(4, 6), 16) / 255;

      const sRGB = [r, g, b].map(c =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );

      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  private getFontSizeForPlatform(platform: string): number {
    // Relative font sizes (YouTube thumbnails need larger text)
    const sizes: Record<string, number> = {
      youtube: 1.2,
      instagram: 1.0,
      tiktok: 1.0,
      linkedin: 0.9,
      facebook: 1.1
    };

    return sizes[platform] || 1.0;
  }

  private getColorsUsed(request: ThumbnailRequest): string[] {
    const colors: string[] = [];

    if (request.backgroundColor) {
      colors.push(request.backgroundColor);
    }

    if (request.brandGuidelines?.primaryColor) {
      colors.push(request.brandGuidelines.primaryColor);
    }

    if (request.brandGuidelines?.secondaryColor) {
      colors.push(request.brandGuidelines.secondaryColor);
    }

    return colors;
  }

  private async generateVariants(
    request: ThumbnailRequest,
    count: number
  ): Promise<ThumbnailVariant[]> {
    const variants: ThumbnailVariant[] = [];
    const positions = ['left', 'right', 'center', 'top', 'bottom'];
    const colors = ['#FF5733', '#33FF57', '#5733FF', '#FFD700', '#FF1493'];
    const styles: ThumbnailStyle[] = ['face_reaction', 'bold_text', 'listicle', 'minimal'];

    for (let i = 0; i < count; i++) {
      const variantRequest = { ...request };

      switch (request.variantStrategy) {
        case 'text_position':
          // Vary position handled in generation
          break;
        case 'color':
          if (variantRequest.brandGuidelines) {
            variantRequest.brandGuidelines.primaryColor = colors[i % colors.length];
          }
          break;
        case 'style':
          variantRequest.style = styles[i % styles.length];
          break;
      }

      variants.push({
        imageUrl: `https://placeholder.com/variant${i}.png`,
        textPosition: positions[i % positions.length],
        primaryColor: colors[i % colors.length],
        style: variantRequest.style || 'bold_text'
      });
    }

    return variants;
  }
}

export { ThumbnailTemplateLibrary } from './thumbnail-templates';
```

#### Step 4: Create Package Exports

```typescript
// packages/agents/media/src/thumbnails/index.ts

export * from './types';
export * from './thumbnail-generator';
export * from './thumbnail-templates';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/agents/media
pnpm test src/thumbnails

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint src/thumbnails
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/media/src/thumbnails/types.ts` | Type definitions |
| Create | `packages/agents/media/src/thumbnails/thumbnail-templates.ts` | Thumbnail style templates |
| Create | `packages/agents/media/src/thumbnails/thumbnail-generator.ts` | Main generation logic |
| Create | `packages/agents/media/src/thumbnails/index.ts` | Package exports |
| Create | `packages/agents/media/src/thumbnails/__tests__/thumbnail-generator.test.ts` | Tests |

---

## Acceptance Criteria

- [ ] ThumbnailGenerator creates platform-optimized thumbnails
- [ ] 10 thumbnail styles available
- [ ] Text automatically positioned and sized
- [ ] High contrast ensured for readability
- [ ] Brand colors and logo integration
- [ ] Visual accents (arrows, circles, emojis)
- [ ] A/B variant generation
- [ ] Platform-specific dimensions
- [ ] Tests pass with >90% coverage

---

## JSON Task Block

```json
{
  "task_id": "S2-D4",
  "name": "Thumbnail Generation",
  "status": "pending",
  "dependencies": ["S2-D1", "S2-D2"],
  "blocks": ["S2-D5"],
  "agent": "D",
  "sprint": 2,
  "complexity": "medium",
  "estimated_files": 4,
  "tdd_required": true,
  "spec_refs": [
    "docs/03-agents-tools/agent-recursion-contracts.md",
    "docs/09-platform-playbooks/"
  ],
  "acceptance_checklist": [
    "platform_dimensions",
    "style_templates",
    "text_optimization",
    "contrast_calculation",
    "brand_integration",
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
    { "type": "brand_visual_guidelines", "scope": "client" }
  ],
  "writes": [
    { "type": "generated_thumbnail", "scope": "asset" }
  ],
  "context_window_at_completion": null,
  "continuation_hint": "Thumbnails feed into QA system in S2-D5"
}
```
