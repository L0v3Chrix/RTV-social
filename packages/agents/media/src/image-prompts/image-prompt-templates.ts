/**
 * S2-D1: Image Prompt Templates
 *
 * Templates for different image types and styles.
 */

import type { ImageType, ImageStyle } from './types.js';

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
      'e-commerce style',
    ],
    lightingDefaults:
      'soft studio lighting, even illumination, subtle shadows',
    compositionHints: [
      'centered product',
      '45-degree angle',
      'hero shot',
      'detail close-up',
    ],
    negativePromptBase: [
      'blurry',
      'distorted',
      'low quality',
      'watermark',
      'cluttered background',
      'harsh shadows',
      'overexposed',
    ],
  },
  lifestyle: {
    basePrompt: 'lifestyle photography, natural light, authentic moment',
    modifiers: [
      'candid shot',
      'in-context usage',
      'real-world setting',
      'aspirational lifestyle',
    ],
    lightingDefaults: 'natural daylight, golden hour, soft ambient light',
    compositionHints: [
      'rule of thirds',
      'environmental portrait',
      'action shot',
      'over-the-shoulder',
    ],
    negativePromptBase: [
      'staged',
      'artificial',
      'stock photo cliché',
      'overly posed',
      'fake smile',
      'unnatural colors',
    ],
  },
  portrait: {
    basePrompt:
      'portrait photography, professional headshot, sharp focus on face',
    modifiers: [
      'studio portrait',
      'environmental portrait',
      'corporate headshot',
      'editorial portrait',
    ],
    lightingDefaults: 'Rembrandt lighting, soft key light, subtle fill',
    compositionHints: [
      'head and shoulders',
      'three-quarter view',
      'eye-level camera',
      'shallow depth of field',
    ],
    negativePromptBase: [
      'unflattering angle',
      'harsh shadows on face',
      'red eye',
      'blemishes',
      'distorted features',
      'double chin',
    ],
  },
  graphic: {
    basePrompt: 'graphic design, clean layout, vector style',
    modifiers: [
      'infographic style',
      'flat design',
      'modern graphic',
      'branded visual',
    ],
    lightingDefaults: 'flat lighting, no shadows, even color',
    compositionHints: [
      'grid layout',
      'visual hierarchy',
      'balanced composition',
      'white space',
    ],
    negativePromptBase: [
      'photorealistic',
      'complex textures',
      'gradients',
      'cluttered',
      'too many elements',
      'inconsistent style',
    ],
  },
  scene: {
    basePrompt: 'scene photography, establishing shot, environmental',
    modifiers: [
      'wide angle',
      'interior design',
      'exterior shot',
      'atmosphere focused',
    ],
    lightingDefaults:
      'natural environmental lighting, mood lighting, atmospheric',
    compositionHints: [
      'leading lines',
      'depth layers',
      'foreground interest',
      'establishing context',
    ],
    negativePromptBase: [
      'empty',
      'boring composition',
      'flat lighting',
      'no focal point',
      'distracting elements',
    ],
  },
  abstract: {
    basePrompt: 'abstract art, creative composition, artistic expression',
    modifiers: [
      'geometric abstract',
      'organic shapes',
      'texture focused',
      'color field',
    ],
    lightingDefaults: 'dramatic lighting, high contrast, creative shadows',
    compositionHints: [
      'dynamic composition',
      'asymmetric balance',
      'color harmony',
      'movement suggestion',
    ],
    negativePromptBase: [
      'literal',
      'recognizable objects',
      'mundane',
      'boring',
      'muddy colors',
      'cluttered',
    ],
  },
  text_overlay: {
    basePrompt:
      'background for text overlay, space for copy, clean negative space',
    modifiers: [
      'quote background',
      'announcement graphic',
      'text-friendly layout',
      'social media template',
    ],
    lightingDefaults: 'even lighting, low contrast areas for text',
    compositionHints: [
      'left third clear',
      'center clear',
      'bottom third clear',
      'gradient area for text',
    ],
    negativePromptBase: [
      'busy background',
      'no clear space',
      'high contrast patterns',
      'distracting elements',
    ],
  },
  collage: {
    basePrompt: 'photo collage, multiple images, grid layout',
    modifiers: ['mood board', 'before/after', 'step by step', 'collection showcase'],
    lightingDefaults: 'consistent lighting across all elements',
    compositionHints: [
      'grid alignment',
      'size variation',
      'thematic grouping',
      'visual flow',
    ],
    negativePromptBase: [
      'mismatched styles',
      'inconsistent colors',
      'poor alignment',
      'cluttered',
      'no visual hierarchy',
    ],
  },
};

const STYLE_MODIFIERS: Record<ImageStyle, string[]> = {
  photorealistic: [
    'photorealistic',
    'hyperrealistic',
    'photo quality',
    'DSLR quality',
    '8K resolution',
    'sharp details',
  ],
  illustration: [
    'digital illustration',
    'hand-drawn style',
    'artistic rendering',
    'illustration art',
    'creative interpretation',
  ],
  minimalist: [
    'minimalist design',
    'clean aesthetic',
    'simple composition',
    'white space',
    'less is more',
    'refined simplicity',
  ],
  vibrant: [
    'vibrant colors',
    'saturated',
    'bold palette',
    'eye-catching',
    'energetic',
    'pop colors',
  ],
  cinematic: [
    'cinematic lighting',
    'movie still',
    'dramatic atmosphere',
    'film grain',
    'anamorphic',
    'theatrical',
  ],
  editorial: [
    'editorial style',
    'magazine quality',
    'fashion forward',
    'high-end publication',
    'sophisticated',
    'curated',
  ],
  flat_design: [
    'flat design',
    '2D graphics',
    'no shadows',
    'bold shapes',
    'solid colors',
    'geometric',
  ],
  isometric: [
    'isometric view',
    '3D isometric',
    'isometric illustration',
    'axonometric projection',
    'technical illustration',
  ],
  watercolor: [
    'watercolor painting',
    'soft edges',
    'color bleed',
    'artistic texture',
    'hand-painted feel',
  ],
  sketch: [
    'pencil sketch',
    'hand-drawn',
    'line art',
    'rough sketch',
    'artistic sketch',
    'drawing style',
  ],
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
    const all = [
      ...new Set([...templateNegatives, ...brandAvoids, ...customNegatives]),
    ];
    return all.join(', ');
  }
}
