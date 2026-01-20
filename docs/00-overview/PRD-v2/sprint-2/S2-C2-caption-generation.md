# Build Prompt: S2-C2 — Caption Generation

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-C2 |
| Sprint | 2 |
| Agent | C (Copy Generation) |
| Complexity | Medium |
| Status | pending |
| Estimated Files | 5 |
| Spec References | `agent-recursion-contracts.md`, `platform-playbooks/` |

---

## Context

### What This Builds

The Caption Generation service — a specialized copy generation module that creates platform-optimized captions with proper length, hashtag strategy, and formatting. This service uses the prompt composer from S2-C1 and adds caption-specific orchestration.

### Why It Matters

Captions are the primary text touchpoint for social media content. Platform-specific optimization is critical:
- **Instagram**: 2,200 char limit, hashtag strategy, link-in-bio CTAs
- **TikTok**: Short, trend-aligned, FYP optimization
- **LinkedIn**: Professional tone, no hashtag spam, thought leadership
- **X/Twitter**: 280 char constraint, thread-awareness

### Architecture Decision

Caption generation follows the **variant generation pattern**:
1. Generate primary caption optimized for the target platform
2. Generate platform variants if cross-posting
3. Generate A/B test variants for optimization
4. Score and rank variants for selection

---

## Prerequisites

### Completed Tasks
- [x] S2-C1: Copy agent prompt system (CopyPromptComposer)
- [x] S1-A2: BrandKit domain model
- [x] S1-B3: Memory references

### Required Packages
```bash
pnpm add openai zod
pnpm add -D vitest
```

### External Services
- OpenAI API (gpt-4o, gpt-4o-mini)

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests that define the expected behavior:

```typescript
// packages/agents/copy/src/caption/__tests__/caption-generator.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CaptionGenerator,
  CaptionRequest,
  CaptionResult,
  CaptionVariant
} from '../caption-generator';
import { Platform } from '../../prompts/types';

describe('CaptionGenerator', () => {
  let generator: CaptionGenerator;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Test caption with #hashtag1 #hashtag2'
          }
        }]
      })
    };

    generator = new CaptionGenerator({
      llmClient: mockLLMClient
    });
  });

  describe('single platform generation', () => {
    it('should generate caption for Instagram', async () => {
      const request: CaptionRequest = {
        platform: 'instagram',
        topic: 'New product launch',
        contentDescription: 'Reel showing product features',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.primary).toBeDefined();
      expect(result.primary.text.length).toBeLessThanOrEqual(2200);
      expect(mockLLMClient.chat).toHaveBeenCalled();
    });

    it('should generate caption for X with 280 char limit', async () => {
      mockLLMClient.chat.mockResolvedValue({
        choices: [{
          message: { content: 'Short tweet text #launch' }
        }]
      });

      const request: CaptionRequest = {
        platform: 'x',
        topic: 'Product announcement',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.primary.text.length).toBeLessThanOrEqual(280);
    });

    it('should enforce LinkedIn professional tone', async () => {
      const request: CaptionRequest = {
        platform: 'linkedin',
        topic: 'Industry insights',
        clientId: 'client-123'
      };

      await generator.generate(request);

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('professional');
    });
  });

  describe('hashtag handling', () => {
    it('should extract hashtags from generated caption', async () => {
      mockLLMClient.chat.mockResolvedValue({
        choices: [{
          message: { content: 'Great content! #marketing #growth #tips' }
        }]
      });

      const request: CaptionRequest = {
        platform: 'instagram',
        topic: 'Marketing tips',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.primary.hashtags).toEqual(['#marketing', '#growth', '#tips']);
    });

    it('should limit hashtags per platform', async () => {
      mockLLMClient.chat.mockResolvedValue({
        choices: [{
          message: { content: 'Text #a #b #c #d #e #f #g #h #i #j #k #l' }
        }]
      });

      const request: CaptionRequest = {
        platform: 'linkedin',
        topic: 'Test',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      // LinkedIn allows max 5 hashtags
      expect(result.primary.hashtags.length).toBeLessThanOrEqual(5);
    });

    it('should respect hashtag constraints in request', async () => {
      const request: CaptionRequest = {
        platform: 'instagram',
        topic: 'Test',
        clientId: 'client-123',
        constraints: {
          hashtagCount: { min: 5, max: 10 }
        }
      };

      await generator.generate(request);

      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('5');
      expect(callArgs.messages[0].content).toContain('10');
    });
  });

  describe('variant generation', () => {
    it('should generate multiple variants when requested', async () => {
      mockLLMClient.chat
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Variant 1' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Variant 2' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Variant 3' } }] });

      const request: CaptionRequest = {
        platform: 'instagram',
        topic: 'Test',
        clientId: 'client-123',
        variantCount: 3
      };

      const result = await generator.generate(request);

      expect(result.variants.length).toBe(3);
    });

    it('should generate A/B test variants with different styles', async () => {
      const request: CaptionRequest = {
        platform: 'instagram',
        topic: 'Test',
        clientId: 'client-123',
        abTestStyles: ['question_hook', 'story_hook', 'stat_hook']
      };

      const result = await generator.generate(request);

      expect(result.variants.length).toBe(3);
      result.variants.forEach((v, i) => {
        expect(v.style).toBe(request.abTestStyles![i]);
      });
    });
  });

  describe('cross-platform variants', () => {
    it('should generate variants for multiple platforms', async () => {
      mockLLMClient.chat
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Instagram caption with #hashtags' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Short tweet #marketing' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Professional LinkedIn post about marketing insights' } }] });

      const request: CaptionRequest = {
        platform: 'instagram',
        topic: 'Marketing tips',
        clientId: 'client-123',
        crossPostTo: ['x', 'linkedin']
      };

      const result = await generator.generate(request);

      expect(result.crossPlatformVariants).toBeDefined();
      expect(result.crossPlatformVariants!.x).toBeDefined();
      expect(result.crossPlatformVariants!.linkedin).toBeDefined();
      expect(result.crossPlatformVariants!.x.text.length).toBeLessThanOrEqual(280);
    });
  });

  describe('brand voice integration', () => {
    it('should load brand voice from external memory', async () => {
      const mockBrandLoader = {
        loadForClient: vi.fn().mockResolvedValue({
          tone: ['playful', 'energetic'],
          personality: 'Fun brand',
          vocabulary: { preferred: ['awesome'], avoided: ['bad'], industry: [] },
          sentenceStyle: 'Short and punchy',
          emojiUsage: 'Heavy'
        })
      };

      generator = new CaptionGenerator({
        llmClient: mockLLMClient,
        brandVoiceLoader: mockBrandLoader
      });

      await generator.generate({
        platform: 'instagram',
        topic: 'Test',
        clientId: 'client-123'
      });

      expect(mockBrandLoader.loadForClient).toHaveBeenCalledWith('client-123');
      const callArgs = mockLLMClient.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('playful');
    });
  });

  describe('character counting', () => {
    it('should accurately count characters including emojis', () => {
      const caption = 'Hello 👋 World 🌍';
      const count = CaptionGenerator.countCharacters(caption);

      // Emojis count as characters in most platforms
      expect(count).toBeGreaterThan(12);
    });

    it('should report character count in result', async () => {
      mockLLMClient.chat.mockResolvedValue({
        choices: [{ message: { content: 'Test caption' } }]
      });

      const result = await generator.generate({
        platform: 'instagram',
        topic: 'Test',
        clientId: 'client-123'
      });

      expect(result.primary.characterCount).toBe(12);
    });
  });

  describe('error handling', () => {
    it('should retry on transient LLM failures', async () => {
      mockLLMClient.chat
        .mockRejectedValueOnce(new Error('Rate limited'))
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Success' } }] });

      const result = await generator.generate({
        platform: 'instagram',
        topic: 'Test',
        clientId: 'client-123'
      });

      expect(result.primary.text).toBe('Success');
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      mockLLMClient.chat.mockRejectedValue(new Error('Persistent failure'));

      await expect(generator.generate({
        platform: 'instagram',
        topic: 'Test',
        clientId: 'client-123'
      })).rejects.toThrow('Persistent failure');
    });
  });
});

describe('CaptionFormatter', () => {
  describe('formatForPlatform', () => {
    it('should add line breaks for Instagram readability', () => {
      const raw = 'First paragraph. Second paragraph. Third paragraph.';
      const formatted = CaptionFormatter.formatForPlatform(raw, 'instagram');

      expect(formatted).toContain('\n\n');
    });

    it('should move hashtags to end for Instagram', () => {
      const raw = 'Great #marketing tip for you!';
      const formatted = CaptionFormatter.formatForPlatform(raw, 'instagram', {
        hashtagPosition: 'end'
      });

      expect(formatted).toMatch(/tip for you!\n\n#marketing$/);
    });

    it('should strip hashtags for LinkedIn when over limit', () => {
      const raw = 'Post #a #b #c #d #e #f #g #h';
      const formatted = CaptionFormatter.formatForPlatform(raw, 'linkedin');

      const hashtags = formatted.match(/#\w+/g) || [];
      expect(hashtags.length).toBeLessThanOrEqual(5);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Define Caption Types

```typescript
// packages/agents/copy/src/caption/types.ts

import { z } from 'zod';
import { Platform, CopyConstraints, BrandVoice } from '../prompts/types';

export const CaptionRequestSchema = z.object({
  platform: z.enum(['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'skool']),
  topic: z.string().min(1),
  contentDescription: z.string().optional(),
  clientId: z.string(),
  campaignId: z.string().optional(),
  constraints: z.object({
    maxLength: z.number().optional(),
    minLength: z.number().optional(),
    hashtagCount: z.object({
      min: z.number(),
      max: z.number()
    }).optional(),
    compliance: z.array(z.string()).optional()
  }).optional(),
  variantCount: z.number().min(1).max(5).optional(),
  abTestStyles: z.array(z.string()).optional(),
  crossPostTo: z.array(z.enum(['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'skool'])).optional(),
  brandVoiceOverride: z.any().optional()
});

export type CaptionRequest = z.infer<typeof CaptionRequestSchema>;

export interface CaptionVariant {
  text: string;
  hashtags: string[];
  characterCount: number;
  style?: string;
  platform: Platform;
}

export interface CaptionResult {
  primary: CaptionVariant;
  variants: CaptionVariant[];
  crossPlatformVariants?: Partial<Record<Platform, CaptionVariant>>;
  generatedAt: string;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
}

export interface CaptionGeneratorOptions {
  llmClient: LLMClient;
  brandVoiceLoader?: BrandVoiceLoader;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface LLMClient {
  chat(request: ChatRequest): Promise<ChatResponse>;
}

export interface ChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface BrandVoiceLoader {
  loadForClient(clientId: string): Promise<BrandVoice>;
}
```

#### Step 2: Implement Caption Generator

```typescript
// packages/agents/copy/src/caption/caption-generator.ts

import {
  CaptionRequest,
  CaptionResult,
  CaptionVariant,
  CaptionGeneratorOptions,
  LLMClient,
  BrandVoiceLoader
} from './types';
import { CopyPromptComposer } from '../prompts/prompt-composer';
import { Platform, BrandVoice } from '../prompts/types';
import { getPlatformConfig } from '../prompts/platform-config';
import { CaptionFormatter } from './caption-formatter';

export class CaptionGenerator {
  private llmClient: LLMClient;
  private brandVoiceLoader?: BrandVoiceLoader;
  private promptComposer: CopyPromptComposer;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(options: CaptionGeneratorOptions) {
    this.llmClient = options.llmClient;
    this.brandVoiceLoader = options.brandVoiceLoader;
    this.promptComposer = new CopyPromptComposer();
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
  }

  async generate(request: CaptionRequest): Promise<CaptionResult> {
    // Load brand voice
    const brandVoice = request.brandVoiceOverride ||
      (this.brandVoiceLoader
        ? await this.brandVoiceLoader.loadForClient(request.clientId)
        : undefined);

    // Generate primary caption
    const primary = await this.generateSingleCaption(request, brandVoice);

    // Generate variants if requested
    const variants = await this.generateVariants(request, brandVoice);

    // Generate cross-platform variants if requested
    const crossPlatformVariants = request.crossPostTo
      ? await this.generateCrossPlatformVariants(request, brandVoice)
      : undefined;

    return {
      primary,
      variants,
      crossPlatformVariants,
      generatedAt: new Date().toISOString(),
      modelUsed: 'gpt-4o',
      promptTokens: 0, // TODO: Track from response
      completionTokens: 0
    };
  }

  private async generateSingleCaption(
    request: CaptionRequest,
    brandVoice?: BrandVoice,
    style?: string
  ): Promise<CaptionVariant> {
    const platformConfig = getPlatformConfig(request.platform);

    const prompt = this.promptComposer.compose({
      copyType: 'caption',
      platform: request.platform,
      brandVoice,
      constraints: {
        maxLength: request.constraints?.maxLength || platformConfig.captionMaxLength,
        minLength: request.constraints?.minLength,
        hashtagCount: request.constraints?.hashtagCount || {
          min: Math.max(1, Math.floor(platformConfig.hashtagLimit / 3)),
          max: platformConfig.hashtagLimit
        },
        compliance: request.constraints?.compliance
      },
      topic: request.topic,
      contentDescription: request.contentDescription
    });

    const rawText = await this.callLLMWithRetry(prompt, style);

    // Extract hashtags
    const hashtags = this.extractHashtags(rawText);

    // Enforce platform hashtag limits
    const limitedHashtags = hashtags.slice(0, platformConfig.hashtagLimit);

    // Format for platform
    const formattedText = CaptionFormatter.formatForPlatform(
      rawText,
      request.platform,
      { hashtags: limitedHashtags }
    );

    return {
      text: formattedText,
      hashtags: limitedHashtags,
      characterCount: CaptionGenerator.countCharacters(formattedText),
      style,
      platform: request.platform
    };
  }

  private async generateVariants(
    request: CaptionRequest,
    brandVoice?: BrandVoice
  ): Promise<CaptionVariant[]> {
    const variants: CaptionVariant[] = [];

    // A/B test styles take precedence
    if (request.abTestStyles?.length) {
      for (const style of request.abTestStyles) {
        const variant = await this.generateSingleCaption(request, brandVoice, style);
        variants.push(variant);
      }
    } else if (request.variantCount && request.variantCount > 1) {
      // Generate generic variants
      for (let i = 0; i < request.variantCount; i++) {
        const variant = await this.generateSingleCaption(request, brandVoice);
        variants.push(variant);
      }
    }

    return variants;
  }

  private async generateCrossPlatformVariants(
    request: CaptionRequest,
    brandVoice?: BrandVoice
  ): Promise<Partial<Record<Platform, CaptionVariant>>> {
    const variants: Partial<Record<Platform, CaptionVariant>> = {};

    for (const platform of request.crossPostTo!) {
      const variant = await this.generateSingleCaption(
        { ...request, platform },
        brandVoice
      );
      variants[platform] = variant;
    }

    return variants;
  }

  private async callLLMWithRetry(
    prompt: { system: string; user: string; model?: string; temperature?: number; maxTokens?: number },
    style?: string
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const userPrompt = style
          ? `${prompt.user}\n\nStyle: Use a ${style.replace('_', ' ')} approach.`
          : prompt.user;

        const response = await this.llmClient.chat({
          model: prompt.model || 'gpt-4o',
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: userPrompt }
          ],
          temperature: prompt.temperature || 0.8,
          max_tokens: prompt.maxTokens || 500
        });

        return response.choices[0].message.content;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelayMs * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w]+/g;
    return text.match(hashtagRegex) || [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static countCharacters(text: string): number {
    // Use spread to properly count Unicode characters including emojis
    return [...text].length;
  }
}

export { CaptionFormatter } from './caption-formatter';
```

#### Step 3: Implement Caption Formatter

```typescript
// packages/agents/copy/src/caption/caption-formatter.ts

import { Platform } from '../prompts/types';
import { getPlatformConfig } from '../prompts/platform-config';

export interface FormatOptions {
  hashtags?: string[];
  hashtagPosition?: 'inline' | 'end' | 'first_comment';
  lineBreakStyle?: 'single' | 'double';
}

export class CaptionFormatter {
  static formatForPlatform(
    text: string,
    platform: Platform,
    options: FormatOptions = {}
  ): string {
    const config = getPlatformConfig(platform);

    let formatted = text;

    // Platform-specific formatting
    switch (platform) {
      case 'instagram':
        formatted = this.formatInstagram(formatted, options);
        break;
      case 'linkedin':
        formatted = this.formatLinkedIn(formatted, config.hashtagLimit);
        break;
      case 'x':
        formatted = this.formatX(formatted);
        break;
      case 'tiktok':
        formatted = this.formatTikTok(formatted);
        break;
      case 'facebook':
        formatted = this.formatFacebook(formatted);
        break;
      default:
        // Default formatting
        break;
    }

    // Enforce character limit
    if (formatted.length > config.captionMaxLength) {
      formatted = this.truncateWithEllipsis(formatted, config.captionMaxLength);
    }

    return formatted;
  }

  private static formatInstagram(text: string, options: FormatOptions): string {
    let formatted = text;

    // Add line breaks for readability
    formatted = this.addLineBreaks(formatted);

    // Handle hashtag positioning
    if (options.hashtagPosition === 'end' || !options.hashtagPosition) {
      formatted = this.moveHashtagsToEnd(formatted);
    }

    return formatted;
  }

  private static formatLinkedIn(text: string, maxHashtags: number): string {
    let formatted = text;

    // Add professional line breaks
    formatted = this.addLineBreaks(formatted);

    // Limit hashtags
    formatted = this.limitHashtags(formatted, maxHashtags);

    return formatted;
  }

  private static formatX(text: string): string {
    // X/Twitter - keep concise
    return text.trim();
  }

  private static formatTikTok(text: string): string {
    // TikTok - casual, trend-friendly
    return text.trim();
  }

  private static formatFacebook(text: string): string {
    // Facebook - can be longer, add line breaks
    return this.addLineBreaks(text);
  }

  private static addLineBreaks(text: string): string {
    // Split into sentences and add breaks between paragraphs
    const sentences = text.split(/(?<=[.!?])\s+/);

    if (sentences.length <= 2) {
      return text;
    }

    // Group into paragraphs of 2-3 sentences
    const paragraphs: string[] = [];
    let current: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      current.push(sentences[i]);
      if (current.length >= 2 && (i === sentences.length - 1 || current.length >= 3)) {
        paragraphs.push(current.join(' '));
        current = [];
      }
    }

    if (current.length > 0) {
      paragraphs.push(current.join(' '));
    }

    return paragraphs.join('\n\n');
  }

  private static moveHashtagsToEnd(text: string): string {
    const hashtagRegex = /#[\w]+/g;
    const hashtags = text.match(hashtagRegex) || [];

    if (hashtags.length === 0) {
      return text;
    }

    // Remove hashtags from text
    let cleanText = text.replace(hashtagRegex, '').replace(/\s+/g, ' ').trim();

    // Add hashtags at the end
    return `${cleanText}\n\n${hashtags.join(' ')}`;
  }

  private static limitHashtags(text: string, max: number): string {
    const hashtagRegex = /#[\w]+/g;
    const hashtags = text.match(hashtagRegex) || [];

    if (hashtags.length <= max) {
      return text;
    }

    // Remove excess hashtags
    const keepHashtags = hashtags.slice(0, max);
    const removeHashtags = hashtags.slice(max);

    let result = text;
    for (const tag of removeHashtags) {
      result = result.replace(new RegExp(`\\s*${tag}`, 'g'), '');
    }

    return result.replace(/\s+/g, ' ').trim();
  }

  private static truncateWithEllipsis(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Try to truncate at a word boundary
    const truncated = text.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }
}
```

#### Step 4: Create Package Exports

```typescript
// packages/agents/copy/src/caption/index.ts

export * from './types';
export * from './caption-generator';
export * from './caption-formatter';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/agents/copy
pnpm test src/caption

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint src/caption
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/copy/src/caption/types.ts` | Caption type definitions |
| Create | `packages/agents/copy/src/caption/caption-generator.ts` | Main generation logic |
| Create | `packages/agents/copy/src/caption/caption-formatter.ts` | Platform-specific formatting |
| Create | `packages/agents/copy/src/caption/index.ts` | Package exports |
| Create | `packages/agents/copy/src/caption/__tests__/caption-generator.test.ts` | Comprehensive tests |

---

## Acceptance Criteria

- [ ] CaptionGenerator produces platform-appropriate captions
- [ ] Character limits enforced per platform
- [ ] Hashtag limits enforced per platform
- [ ] Brand voice loaded and applied
- [ ] Variant generation works (A/B styles)
- [ ] Cross-platform variants generated correctly
- [ ] Retry logic handles transient failures
- [ ] CaptionFormatter applies platform-specific formatting
- [ ] Hashtag positioning configurable
- [ ] Tests pass with >90% coverage

---

## Test Requirements

### Unit Tests
- Single platform caption generation
- Character limit enforcement
- Hashtag extraction and limiting
- Variant generation
- Cross-platform generation
- Retry logic
- Formatter line breaks
- Formatter hashtag positioning

### Integration Tests
- Full generation with brand voice loading
- Multi-variant generation
- Cross-platform batch generation

---

## Security & Safety Checklist

- [ ] No API keys in generated content
- [ ] Brand voice validated before use
- [ ] Character limits prevent injection
- [ ] Compliance rules enforced
- [ ] Audit logging for generation requests

---

## JSON Task Block

```json
{
  "task_id": "S2-C2",
  "name": "Caption Generation",
  "status": "pending",
  "dependencies": ["S2-C1"],
  "blocks": ["S2-C5"],
  "agent": "C",
  "sprint": 2,
  "complexity": "medium",
  "estimated_files": 5,
  "tdd_required": true,
  "spec_refs": [
    "docs/03-agents-tools/agent-recursion-contracts.md",
    "docs/09-platform-playbooks/"
  ],
  "acceptance_checklist": [
    "platform_caption_generation",
    "character_limits",
    "hashtag_limits",
    "brand_voice_integration",
    "variant_generation",
    "cross_platform_variants",
    "retry_logic",
    "formatter"
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
    { "type": "brand_voice", "scope": "client" },
    { "type": "campaign_context", "scope": "campaign" }
  ],
  "writes": [
    { "type": "generated_caption", "scope": "content" }
  ],
  "context_window_at_completion": null,
  "continuation_hint": "Verify caption generation integrates with blueprint step execution"
}
```
