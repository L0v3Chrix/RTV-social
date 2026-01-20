/**
 * BrandKit entity types
 */

import { z } from 'zod';

/**
 * Voice style schema
 */
export const voiceStyleSchema = z.object({
  tone: z.string().min(1),
  personality: z.array(z.string()).optional(),
  writingStyle: z.string().optional(),
  vocabulary: z.object({
    preferred: z.array(z.string()),
    avoided: z.array(z.string()),
  }).optional(),
  examples: z.array(z.object({
    context: z.string(),
    example: z.string(),
  })).optional(),
});

export type VoiceStyle = z.infer<typeof voiceStyleSchema>;

/**
 * Visual tokens schema
 */
export const visualTokensSchema = z.object({
  colors: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    background: z.string().optional(),
    text: z.string().optional(),
  }).catchall(z.string()),
  typography: z.object({
    headingFont: z.string().optional(),
    bodyFont: z.string().optional(),
    baseSize: z.number().optional(),
  }).optional(),
  logoUrls: z.object({
    primary: z.string().url().optional(),
    icon: z.string().url().optional(),
    dark: z.string().url().optional(),
    light: z.string().url().optional(),
  }).optional(),
  spacing: z.object({
    base: z.number().optional(),
    scale: z.number().optional(),
  }).optional(),
}).optional();

export type VisualTokens = z.infer<typeof visualTokensSchema>;

/**
 * Compliance rules schema
 */
export const complianceRulesSchema = z.object({
  industry: z.string().optional(),
  restrictions: z.array(z.string()).optional(),
  requiredDisclosures: z.array(z.string()).optional(),
  prohibitedTopics: z.array(z.string()).optional(),
  platformSpecific: z.record(z.object({
    restrictions: z.array(z.string()).optional(),
    requirements: z.array(z.string()).optional(),
  })).optional(),
}).optional();

export type ComplianceRules = z.infer<typeof complianceRulesSchema>;

/**
 * ICP (Ideal Customer Profile) schema
 */
export const icpSchema = z.object({
  demographics: z.object({
    ageRange: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
    gender: z.string().optional(),
    income: z.string().optional(),
    location: z.array(z.string()).optional(),
    education: z.string().optional(),
    occupation: z.array(z.string()).optional(),
  }).optional(),
  psychographics: z.object({
    interests: z.array(z.string()).optional(),
    values: z.array(z.string()).optional(),
    painPoints: z.array(z.string()).optional(),
    goals: z.array(z.string()).optional(),
    fears: z.array(z.string()).optional(),
  }).optional(),
  behaviors: z.object({
    platforms: z.array(z.string()).optional(),
    contentPreferences: z.array(z.string()).optional(),
    purchaseDrivers: z.array(z.string()).optional(),
    mediaConsumption: z.array(z.string()).optional(),
  }).optional(),
}).optional();

export type ICP = z.infer<typeof icpSchema>;

/**
 * BrandKit entity
 */
export interface BrandKit {
  readonly id: string;
  readonly clientId: string;
  readonly voiceStyle: VoiceStyle;
  readonly visualTokens: VisualTokens | null;
  readonly complianceRules: ComplianceRules | null;
  readonly icp: ICP | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Create brandkit input
 */
export const createBrandKitInputSchema = z.object({
  clientId: z.string().min(1),
  voiceStyle: voiceStyleSchema,
  visualTokens: visualTokensSchema.optional(),
  complianceRules: complianceRulesSchema.optional(),
  icp: icpSchema.optional(),
});

export type CreateBrandKitInput = z.infer<typeof createBrandKitInputSchema>;

/**
 * Update brandkit input
 */
export const updateBrandKitInputSchema = z.object({
  voiceStyle: voiceStyleSchema.optional(),
  visualTokens: visualTokensSchema.optional(),
  complianceRules: complianceRulesSchema.optional(),
  icp: icpSchema.optional(),
});

export type UpdateBrandKitInput = z.infer<typeof updateBrandKitInputSchema>;
