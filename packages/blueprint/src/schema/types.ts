/**
 * S2-B1: Blueprint Types
 *
 * Type definitions for the Blueprint schema system.
 * Blueprints define reusable templates for content creation.
 */

import { z } from 'zod';

// Input Types
export const InputTypeSchema = z.enum(['text', 'media', 'select', 'reference', 'number', 'boolean', 'json']);
export type InputType = z.infer<typeof InputTypeSchema>;

// Media Types
export const MediaTypeSchema = z.enum([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mp3', 'audio/wav', 'audio/m4a',
]);
export type MediaType = z.infer<typeof MediaTypeSchema>;

// Reference Types
export const ReferenceTypeSchema = z.enum(['client', 'brandKit', 'knowledgeBase', 'offer', 'asset']);
export type ReferenceType = z.infer<typeof ReferenceTypeSchema>;

// Platform
export const PlatformSchema = z.enum(['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'skool']);
export type Platform = z.infer<typeof PlatformSchema>;

// Dimensions
export const DimensionsSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});
export type Dimensions = z.infer<typeof DimensionsSchema>;

// Blueprint Input
export const BlueprintInputSchema = z.object({
  name: z.string().min(1).max(50),
  type: InputTypeSchema,
  required: z.boolean().default(true),
  description: z.string().max(500),
  default: z.unknown().optional(),
  // Type-specific fields
  maxLength: z.number().optional(),
  minLength: z.number().optional(),
  mediaTypes: z.array(MediaTypeSchema).optional(),
  options: z.array(z.string()).optional(),
  referenceType: ReferenceTypeSchema.optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  schema: z.record(z.unknown()).optional(),
});
export type BlueprintInput = z.infer<typeof BlueprintInputSchema>;

// Blueprint Output
export const BlueprintOutputSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['text', 'media', 'json']),
  description: z.string().max(500),
  // Type-specific fields
  mediaType: MediaTypeSchema.optional(),
  dimensions: DimensionsSchema.optional(),
  schema: z.record(z.unknown()).optional(),
});
export type BlueprintOutput = z.infer<typeof BlueprintOutputSchema>;

// Blueprint Variant
export const BlueprintVariantSchema = z.object({
  platform: PlatformSchema,
  format: z.string(),
  dimensions: DimensionsSchema.optional(),
  maxDuration: z.number().optional(),
  captionLimit: z.number().optional(),
  hashtagLimit: z.number().optional(),
  aspectRatio: z.string().optional(),
  fileSize: z.number().optional(),
  customConfig: z.record(z.unknown()).optional(),
});
export type BlueprintVariant = z.infer<typeof BlueprintVariantSchema>;

// Step Types
export const StepTypeSchema = z.enum(['agent', 'transform', 'parallel', 'conditional', 'loop']);
export type StepType = z.infer<typeof StepTypeSchema>;

// Blueprint Step (recursive for parallel/conditional)
// Using manual interface to avoid exactOptionalPropertyTypes issues with Zod inference
export interface BlueprintStep {
  name: string;
  type: StepType;
  agent?: string | undefined;
  inputs?: string[] | undefined;
  outputs?: string[] | undefined;
  condition?: string | undefined;
  config?: Record<string, unknown> | undefined;
  steps?: BlueprintStep[] | undefined;
}

export const BlueprintStepSchema: z.ZodType<BlueprintStep> = z.lazy(() =>
  z.object({
    name: z.string().min(1).max(50),
    type: StepTypeSchema,
    agent: z.string().optional(),
    inputs: z.array(z.string()).optional(),
    outputs: z.array(z.string()).optional(),
    condition: z.string().optional(),
    config: z.record(z.unknown()).optional(),
    steps: z.array(BlueprintStepSchema).optional(),
  })
) as z.ZodType<BlueprintStep>;

// Blueprint Categories
export const BlueprintCategorySchema = z.enum([
  'short-form', 'carousel', 'story', 'long-form',
  'testimonial', 'educational', 'promotional', 'engagement',
  'automation', 'avatar',
]);
export type BlueprintCategory = z.infer<typeof BlueprintCategorySchema>;

// Full Blueprint Schema
export const BlueprintSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  category: z.string(),
  platforms: z.array(PlatformSchema).min(1),
  inputs: z.array(BlueprintInputSchema),
  outputs: z.array(BlueprintOutputSchema),
  variants: z.array(BlueprintVariantSchema),
  steps: z.array(BlueprintStepSchema),
  version: z.number().default(1),
  tags: z.array(z.string()).optional(),
  estimatedDuration: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;

// Create Blueprint Input (without auto-generated fields)
export type CreateBlueprintInput = Omit<Blueprint, 'id' | 'version' | 'createdAt' | 'updatedAt'>;
