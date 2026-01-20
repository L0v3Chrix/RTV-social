/**
 * S2-D1: Image Prompt Generation Types
 *
 * Type definitions for the image prompt generation system.
 */

import { z } from 'zod';

// Image Style
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
  'sketch',
]);

export type ImageStyle = z.infer<typeof ImageStyleSchema>;

// Image Type
export const ImageTypeSchema = z.enum([
  'product',
  'lifestyle',
  'portrait',
  'graphic',
  'scene',
  'abstract',
  'text_overlay',
  'collage',
]);

export type ImageType = z.infer<typeof ImageTypeSchema>;

// Content Type
export const ContentTypeSchema = z.enum([
  'post',
  'story',
  'reel',
  'thumbnail',
  'cover',
  'carousel',
  'ad',
]);

export type ContentType = z.infer<typeof ContentTypeSchema>;

// Platform
export const PlatformSchema = z.enum([
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'x',
  'skool',
]);

export type Platform = z.infer<typeof PlatformSchema>;

// Image Provider
export const ImageProviderSchema = z.enum([
  'midjourney',
  'dalle',
  'stable_diffusion',
  'ideogram',
  'leonardo',
  'generic',
]);

export type ImageProvider = z.infer<typeof ImageProviderSchema>;

// Brand Visual Guidelines
export interface BrandVisualGuidelines {
  colorPalette: {
    primary: string;
    secondary: string;
    accent?: string | undefined;
    neutral?: string | undefined;
  };
  photographyStyle: string;
  mood: string;
  avoidVisuals: string[];
  preferredSubjects?: string[] | undefined;
  fontFamily?: string | undefined;
  logoPlacement?: string | undefined;
}

// Image Prompt Request
export interface ImagePromptRequest {
  contentBrief: string;
  platform: Platform;
  contentType: ContentType;
  clientId: string;
  style?: ImageStyle | undefined;
  imageType?: ImageType | undefined;
  brandGuidelines?: BrandVisualGuidelines | undefined;
  provider?: ImageProvider | undefined;
  variantCount?: number | undefined;
  customInstructions?: string | undefined;
}

// Image Prompt Variant
export interface ImagePromptVariant {
  prompt: string;
  negativePrompt: string;
  composition: string;
  emphasis: string;
}

// Image Prompt Result
export interface ImagePromptResult {
  prompt: string;
  negativePrompt: string;
  aspectRatio: string;
  resolution: string;
  styleApplied?: ImageStyle | undefined;
  styleNotes?: string | undefined;
  formattedPrompts: {
    midjourney?: string | undefined;
    dalle?: string | undefined;
    stable_diffusion?: string | undefined;
    generic: string;
  };
  variants?: ImagePromptVariant[] | undefined;
  metadata: {
    platform: Platform;
    contentType: ContentType;
    imageType?: ImageType | undefined;
    generatedAt: string;
  };
}
