/**
 * S2-C1: Copy Agent Prompt System Types
 *
 * Type definitions for the prompt composition system.
 */

import { z } from 'zod';

// Brand Voice Schema
export const BrandVoiceSchema = z.object({
  tone: z.array(z.string()).min(1).max(5),
  personality: z.string().min(10).max(500),
  vocabulary: z.object({
    preferred: z.array(z.string()),
    avoided: z.array(z.string()),
    industry: z.array(z.string()),
  }),
  sentenceStyle: z.string(),
  emojiUsage: z.string(),
});

export type BrandVoice = z.infer<typeof BrandVoiceSchema>;

// Copy Types
export const CopyTypeSchema = z.enum([
  'caption',
  'hook',
  'cta',
  'headline',
  'bio',
  'comment_reply',
  'dm_response',
]);

export type CopyType = z.infer<typeof CopyTypeSchema>;

// Platforms
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

// Campaign Context
export const CampaignContextSchema = z.object({
  name: z.string(),
  objective: z.enum(['awareness', 'engagement', 'conversion', 'retention']),
  keyMessages: z.array(z.string()),
});

export type CampaignContext = z.infer<typeof CampaignContextSchema>;

// Copy Constraints
export const CopyConstraintsSchema = z.object({
  maxLength: z.number().optional(),
  minLength: z.number().optional(),
  hashtagCount: z
    .object({
      min: z.number(),
      max: z.number(),
    })
    .optional(),
  compliance: z.array(z.string()).optional(),
  mustInclude: z.array(z.string()).optional(),
  mustAvoid: z.array(z.string()).optional(),
});

export type CopyConstraints = z.infer<typeof CopyConstraintsSchema>;

// Copy Context (input to prompt composer)
export interface CopyContext {
  copyType: CopyType;
  platform: Platform;
  brandVoice?: BrandVoice | undefined;
  campaign?: CampaignContext | undefined;
  constraints?: CopyConstraints | undefined;
  outputFormat?: 'text' | 'json' | undefined;
  topic?: string | undefined;
  contentDescription?: string | undefined;
}

// Composed Prompt (output from prompt composer)
export interface ComposedPrompt {
  system: string;
  user: string;
  model?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
}

// Prompt Layer (internal structure)
export interface PromptLayer {
  name: string;
  priority: number;
  content: string;
}
