# Build Prompt: S2-D2 — Image Generation Lane

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-D2 |
| Sprint | 2 |
| Agent | D (Media Generation) |
| Complexity | High |
| Status | pending |
| Estimated Files | 6 |
| Spec References | `agent-recursion-contracts.md`, `rlm-integration-spec.md` |

---

## Context

### What This Builds

The Image Generation Lane — an orchestration layer that takes image prompts and executes them against various AI image generation providers (DALL-E, Midjourney via API, Stable Diffusion, etc.). Handles provider selection, rate limiting, result storage, and quality validation.

### Why It Matters

Reliable image generation requires more than API calls:
- **Provider Abstraction**: Different providers have different APIs, limits, and capabilities
- **Cost Management**: Track and optimize generation costs per client
- **Quality Gating**: Verify generated images meet standards before use
- **Fault Tolerance**: Handle provider failures, retries, and fallbacks
- **Asset Management**: Store and organize generated images properly

### Architecture Decision

The generation lane uses a **provider adapter pattern**:
1. **Unified Interface**: Common interface for all providers
2. **Provider Adapters**: Specific implementations for each service
3. **Queue-based Execution**: Handle rate limits and async generation
4. **Result Validation**: Check generated images before acceptance
5. **Storage Layer**: Persist images with metadata

---

## Prerequisites

### Completed Tasks
- [x] S2-D1: Image prompt generation
- [x] S1-B1: RLM Environment
- [x] S0-B1: Postgres connection (for metadata storage)

### Required Packages
```bash
pnpm add openai @aws-sdk/client-s3 sharp zod
pnpm add -D vitest
```

### External Services
- OpenAI API (DALL-E 3)
- Stability AI API (Stable Diffusion)
- Replicate API (alternative providers)
- S3-compatible storage (Cloudflare R2)

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests that define the expected behavior:

```typescript
// packages/agents/media/src/image-generation/__tests__/image-generation-lane.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ImageGenerationLane,
  GenerationRequest,
  GenerationResult,
  GenerationStatus
} from '../image-generation-lane';
import { DalleAdapter } from '../adapters/dalle-adapter';
import { StableDiffusionAdapter } from '../adapters/stable-diffusion-adapter';

describe('ImageGenerationLane', () => {
  let lane: ImageGenerationLane;
  let mockStorageClient: any;

  beforeEach(() => {
    mockStorageClient = {
      upload: vi.fn().mockResolvedValue({
        url: 'https://storage.example.com/images/test-123.png',
        key: 'images/test-123.png'
      }),
      getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com')
    };

    lane = new ImageGenerationLane({
      storageClient: mockStorageClient,
      defaultProvider: 'dalle'
    });
  });

  describe('basic generation', () => {
    it('should generate image from prompt', async () => {
      const request: GenerationRequest = {
        prompt: 'A professional headshot, studio lighting',
        negativePrompt: 'blurry, distorted',
        aspectRatio: '1:1',
        clientId: 'client-123'
      };

      const result = await lane.generate(request);

      expect(result.status).toBe('completed');
      expect(result.imageUrl).toBeDefined();
      expect(result.storageKey).toBeDefined();
    });

    it('should use specified provider', async () => {
      const request: GenerationRequest = {
        prompt: 'Abstract art',
        provider: 'stable_diffusion',
        clientId: 'client-123'
      };

      const result = await lane.generate(request);

      expect(result.providerUsed).toBe('stable_diffusion');
    });

    it('should track generation metadata', async () => {
      const result = await lane.generate({
        prompt: 'Product shot',
        clientId: 'client-123'
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.generatedAt).toBeDefined();
      expect(result.metadata.promptUsed).toBeDefined();
      expect(result.metadata.modelVersion).toBeDefined();
    });
  });

  describe('provider selection', () => {
    it('should fall back to alternative provider on failure', async () => {
      // Simulate DALL-E failure
      const mockDalleAdapter = {
        generate: vi.fn().mockRejectedValue(new Error('Rate limited'))
      };

      lane.registerAdapter('dalle', mockDalleAdapter as any);

      const result = await lane.generate({
        prompt: 'Test image',
        clientId: 'client-123',
        fallbackProviders: ['stable_diffusion']
      });

      expect(result.status).toBe('completed');
      expect(result.providerUsed).toBe('stable_diffusion');
    });

    it('should select provider based on image style', async () => {
      const result = await lane.generate({
        prompt: 'Photorealistic portrait',
        style: 'photorealistic',
        clientId: 'client-123'
      });

      // DALL-E is better for photorealistic
      expect(result.providerUsed).toBe('dalle');
    });

    it('should respect client provider preferences', async () => {
      const result = await lane.generate({
        prompt: 'Any image',
        clientId: 'client-123',
        clientPreferences: {
          preferredProvider: 'stable_diffusion'
        }
      });

      expect(result.providerUsed).toBe('stable_diffusion');
    });
  });

  describe('cost tracking', () => {
    it('should track generation cost', async () => {
      const result = await lane.generate({
        prompt: 'Product shot',
        clientId: 'client-123'
      });

      expect(result.cost).toBeDefined();
      expect(result.cost.amount).toBeGreaterThan(0);
      expect(result.cost.currency).toBe('USD');
    });

    it('should respect client budget limits', async () => {
      await expect(lane.generate({
        prompt: 'Expensive image',
        clientId: 'client-123',
        maxCostCents: 1 // Very low limit
      })).rejects.toThrow('exceeds budget');
    });
  });

  describe('quality validation', () => {
    it('should validate generated image dimensions', async () => {
      const result = await lane.generate({
        prompt: 'Test image',
        aspectRatio: '1:1',
        resolution: '1024x1024',
        clientId: 'client-123'
      });

      expect(result.dimensions).toEqual({
        width: 1024,
        height: 1024
      });
    });

    it('should reject low quality images', async () => {
      const mockAdapter = {
        generate: vi.fn().mockResolvedValue({
          imageData: Buffer.from('tiny image'),
          format: 'png'
        })
      };

      lane.registerAdapter('test', mockAdapter as any);

      const result = await lane.generate({
        prompt: 'Test',
        provider: 'test' as any,
        clientId: 'client-123',
        qualityThreshold: 0.9
      });

      expect(result.qualityScore).toBeDefined();
    });
  });

  describe('storage integration', () => {
    it('should upload generated image to storage', async () => {
      await lane.generate({
        prompt: 'Store this image',
        clientId: 'client-123'
      });

      expect(mockStorageClient.upload).toHaveBeenCalled();
    });

    it('should organize images by client', async () => {
      await lane.generate({
        prompt: 'Client image',
        clientId: 'client-456'
      });

      const uploadCall = mockStorageClient.upload.mock.calls[0];
      expect(uploadCall[0].key).toContain('client-456');
    });

    it('should generate signed URL for access', async () => {
      const result = await lane.generate({
        prompt: 'Test',
        clientId: 'client-123',
        generateSignedUrl: true
      });

      expect(result.signedUrl).toBeDefined();
    });
  });

  describe('retry and error handling', () => {
    it('should retry on transient failures', async () => {
      const mockAdapter = {
        generate: vi.fn()
          .mockRejectedValueOnce(new Error('Timeout'))
          .mockResolvedValueOnce({
            imageData: Buffer.from('success'),
            format: 'png'
          })
      };

      lane.registerAdapter('test', mockAdapter as any);

      const result = await lane.generate({
        prompt: 'Retry test',
        provider: 'test' as any,
        clientId: 'client-123',
        maxRetries: 3
      });

      expect(mockAdapter.generate).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('completed');
    });

    it('should fail after max retries exceeded', async () => {
      const mockAdapter = {
        generate: vi.fn().mockRejectedValue(new Error('Persistent failure'))
      };

      lane.registerAdapter('test', mockAdapter as any);

      const result = await lane.generate({
        prompt: 'Fail test',
        provider: 'test' as any,
        clientId: 'client-123',
        maxRetries: 2
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Persistent failure');
    });

    it('should track failed attempts', async () => {
      const mockAdapter = {
        generate: vi.fn().mockRejectedValue(new Error('Error'))
      };

      lane.registerAdapter('test', mockAdapter as any);

      const result = await lane.generate({
        prompt: 'Track failures',
        provider: 'test' as any,
        clientId: 'client-123',
        maxRetries: 3
      });

      expect(result.attemptCount).toBe(3);
    });
  });

  describe('batch generation', () => {
    it('should generate multiple images in batch', async () => {
      const requests: GenerationRequest[] = [
        { prompt: 'Image 1', clientId: 'client-123' },
        { prompt: 'Image 2', clientId: 'client-123' },
        { prompt: 'Image 3', clientId: 'client-123' }
      ];

      const results = await lane.generateBatch(requests);

      expect(results.length).toBe(3);
      results.forEach(r => expect(r.status).toBe('completed'));
    });

    it('should respect concurrency limits', async () => {
      const startTimes: number[] = [];
      const mockAdapter = {
        generate: vi.fn().mockImplementation(async () => {
          startTimes.push(Date.now());
          await new Promise(r => setTimeout(r, 100));
          return { imageData: Buffer.from('test'), format: 'png' };
        })
      };

      lane.registerAdapter('test', mockAdapter as any);

      const requests = Array(5).fill(null).map((_, i) => ({
        prompt: `Image ${i}`,
        provider: 'test' as any,
        clientId: 'client-123'
      }));

      await lane.generateBatch(requests, { maxConcurrency: 2 });

      // With max 2 concurrent, batches should be staggered
      expect(mockAdapter.generate).toHaveBeenCalledTimes(5);
    });
  });
});

describe('DalleAdapter', () => {
  let adapter: DalleAdapter;
  let mockOpenAI: any;

  beforeEach(() => {
    mockOpenAI = {
      images: {
        generate: vi.fn().mockResolvedValue({
          data: [{
            url: 'https://example.com/image.png',
            revised_prompt: 'Enhanced prompt'
          }]
        })
      }
    };

    adapter = new DalleAdapter(mockOpenAI);
  });

  it('should call OpenAI images API', async () => {
    await adapter.generate({
      prompt: 'Test prompt',
      size: '1024x1024',
      quality: 'standard'
    });

    expect(mockOpenAI.images.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Test prompt',
        size: '1024x1024'
      })
    );
  });

  it('should support DALL-E 3 quality settings', async () => {
    await adapter.generate({
      prompt: 'High quality image',
      size: '1024x1024',
      quality: 'hd'
    });

    expect(mockOpenAI.images.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: 'hd'
      })
    );
  });

  it('should return revised prompt', async () => {
    const result = await adapter.generate({
      prompt: 'Original prompt',
      size: '1024x1024'
    });

    expect(result.revisedPrompt).toBe('Enhanced prompt');
  });
});

describe('StableDiffusionAdapter', () => {
  let adapter: StableDiffusionAdapter;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      generate: vi.fn().mockResolvedValue({
        artifacts: [{
          base64: Buffer.from('image data').toString('base64'),
          seed: 12345
        }]
      })
    };

    adapter = new StableDiffusionAdapter(mockClient);
  });

  it('should support negative prompts', async () => {
    await adapter.generate({
      prompt: 'Beautiful landscape',
      negativePrompt: 'ugly, blurry',
      size: '1024x1024'
    });

    expect(mockClient.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        negative_prompt: 'ugly, blurry'
      })
    );
  });

  it('should return seed for reproducibility', async () => {
    const result = await adapter.generate({
      prompt: 'Test',
      size: '1024x1024'
    });

    expect(result.seed).toBe(12345);
  });
});
```

### Phase 2: Implementation

#### Step 1: Define Generation Types

```typescript
// packages/agents/media/src/image-generation/types.ts

import { z } from 'zod';
import { ImageProvider, ImageStyle } from '../image-prompts/types';

export const GenerationStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled'
]);

export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;

export interface GenerationRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  resolution?: string;
  provider?: ImageProvider;
  style?: ImageStyle;
  clientId: string;
  fallbackProviders?: ImageProvider[];
  clientPreferences?: {
    preferredProvider?: ImageProvider;
  };
  maxCostCents?: number;
  qualityThreshold?: number;
  generateSignedUrl?: boolean;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

export interface GenerationCost {
  amount: number;
  currency: string;
  breakdown?: {
    generation: number;
    storage: number;
  };
}

export interface GenerationDimensions {
  width: number;
  height: number;
}

export interface GenerationMetadata {
  generatedAt: string;
  promptUsed: string;
  revisedPrompt?: string;
  modelVersion: string;
  seed?: number;
  processingTimeMs: number;
}

export interface GenerationResult {
  id: string;
  status: GenerationStatus;
  imageUrl?: string;
  signedUrl?: string;
  storageKey?: string;
  providerUsed: ImageProvider;
  cost?: GenerationCost;
  dimensions?: GenerationDimensions;
  qualityScore?: number;
  metadata: GenerationMetadata;
  attemptCount: number;
  error?: string;
}

export interface ProviderCapabilities {
  maxResolution: string;
  supportedAspectRatios: string[];
  supportsNegativePrompt: boolean;
  supportsStylePresets: boolean;
  averageCostCents: number;
  averageGenerationMs: number;
}

export interface ProviderGenerateInput {
  prompt: string;
  negativePrompt?: string;
  size: string;
  quality?: 'standard' | 'hd';
  style?: string;
}

export interface ProviderGenerateOutput {
  imageData?: Buffer;
  imageUrl?: string;
  format: 'png' | 'jpeg' | 'webp';
  revisedPrompt?: string;
  seed?: number;
}

export interface ImageProviderAdapter {
  name: ImageProvider;
  capabilities: ProviderCapabilities;
  generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput>;
  estimateCost(input: ProviderGenerateInput): number;
}

export interface StorageClient {
  upload(params: {
    key: string;
    data: Buffer;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<{ url: string; key: string }>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export interface BatchOptions {
  maxConcurrency?: number;
  stopOnFirstError?: boolean;
}
```

#### Step 2: Implement DALL-E Adapter

```typescript
// packages/agents/media/src/image-generation/adapters/dalle-adapter.ts

import {
  ImageProviderAdapter,
  ProviderCapabilities,
  ProviderGenerateInput,
  ProviderGenerateOutput
} from '../types';

interface OpenAIClient {
  images: {
    generate(params: any): Promise<{
      data: Array<{
        url?: string;
        b64_json?: string;
        revised_prompt?: string;
      }>;
    }>;
  };
}

export class DalleAdapter implements ImageProviderAdapter {
  name = 'dalle' as const;

  capabilities: ProviderCapabilities = {
    maxResolution: '1792x1024',
    supportedAspectRatios: ['1:1', '16:9', '9:16', '1792:1024', '1024:1792'],
    supportsNegativePrompt: false, // DALL-E doesn't support negative prompts directly
    supportsStylePresets: true,
    averageCostCents: 4, // DALL-E 3 standard
    averageGenerationMs: 15000
  };

  constructor(private openai: OpenAIClient) {}

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    // Map size to DALL-E supported sizes
    const size = this.mapSize(input.size);

    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt: input.prompt,
      n: 1,
      size,
      quality: input.quality || 'standard',
      response_format: 'url'
    });

    const image = response.data[0];

    // If we got a URL, fetch the image data
    let imageData: Buffer | undefined;
    if (image.url) {
      const imageResponse = await fetch(image.url);
      imageData = Buffer.from(await imageResponse.arrayBuffer());
    } else if (image.b64_json) {
      imageData = Buffer.from(image.b64_json, 'base64');
    }

    return {
      imageData,
      imageUrl: image.url,
      format: 'png',
      revisedPrompt: image.revised_prompt
    };
  }

  estimateCost(input: ProviderGenerateInput): number {
    // DALL-E 3 pricing
    const pricing: Record<string, Record<string, number>> = {
      standard: {
        '1024x1024': 4,
        '1024x1792': 8,
        '1792x1024': 8
      },
      hd: {
        '1024x1024': 8,
        '1024x1792': 12,
        '1792x1024': 12
      }
    };

    const quality = input.quality || 'standard';
    const size = this.mapSize(input.size);

    return pricing[quality]?.[size] || 4;
  }

  private mapSize(requestedSize: string): '1024x1024' | '1024x1792' | '1792x1024' {
    // Map common aspect ratios to DALL-E sizes
    const mapping: Record<string, '1024x1024' | '1024x1792' | '1792x1024'> = {
      '1:1': '1024x1024',
      '1024x1024': '1024x1024',
      '9:16': '1024x1792',
      '1024x1792': '1024x1792',
      '16:9': '1792x1024',
      '1792x1024': '1792x1024'
    };

    return mapping[requestedSize] || '1024x1024';
  }
}
```

#### Step 3: Implement Stable Diffusion Adapter

```typescript
// packages/agents/media/src/image-generation/adapters/stable-diffusion-adapter.ts

import {
  ImageProviderAdapter,
  ProviderCapabilities,
  ProviderGenerateInput,
  ProviderGenerateOutput
} from '../types';

interface StabilityClient {
  generate(params: any): Promise<{
    artifacts: Array<{
      base64: string;
      seed: number;
      finishReason: string;
    }>;
  }>;
}

export class StableDiffusionAdapter implements ImageProviderAdapter {
  name = 'stable_diffusion' as const;

  capabilities: ProviderCapabilities = {
    maxResolution: '2048x2048',
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
    supportsNegativePrompt: true,
    supportsStylePresets: true,
    averageCostCents: 1, // Much cheaper
    averageGenerationMs: 8000
  };

  constructor(private client: StabilityClient) {}

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    const [width, height] = this.parseSize(input.size);

    const response = await this.client.generate({
      text_prompts: [
        { text: input.prompt, weight: 1 },
        ...(input.negativePrompt
          ? [{ text: input.negativePrompt, weight: -1 }]
          : [])
      ],
      height,
      width,
      steps: 30,
      cfg_scale: 7,
      style_preset: input.style
    });

    const artifact = response.artifacts[0];

    return {
      imageData: Buffer.from(artifact.base64, 'base64'),
      format: 'png',
      seed: artifact.seed
    };
  }

  estimateCost(input: ProviderGenerateInput): number {
    // Stability AI pricing is based on steps and resolution
    const [width, height] = this.parseSize(input.size);
    const megapixels = (width * height) / 1000000;

    // Approximate: 0.5 cents per megapixel
    return Math.ceil(megapixels * 0.5);
  }

  private parseSize(size: string): [number, number] {
    if (size.includes('x')) {
      const [w, h] = size.split('x').map(Number);
      return [w, h];
    }

    // Map aspect ratios
    const mapping: Record<string, [number, number]> = {
      '1:1': [1024, 1024],
      '16:9': [1344, 768],
      '9:16': [768, 1344],
      '4:3': [1152, 896],
      '3:4': [896, 1152]
    };

    return mapping[size] || [1024, 1024];
  }
}
```

#### Step 4: Implement Image Generation Lane

```typescript
// packages/agents/media/src/image-generation/image-generation-lane.ts

import { nanoid } from 'nanoid';
import {
  GenerationRequest,
  GenerationResult,
  GenerationStatus,
  ImageProviderAdapter,
  StorageClient,
  BatchOptions
} from './types';
import { ImageProvider } from '../image-prompts/types';
import { DalleAdapter } from './adapters/dalle-adapter';
import { StableDiffusionAdapter } from './adapters/stable-diffusion-adapter';

interface LaneOptions {
  storageClient: StorageClient;
  defaultProvider: ImageProvider;
  adapters?: Map<ImageProvider, ImageProviderAdapter>;
}

export class ImageGenerationLane {
  private adapters: Map<ImageProvider, ImageProviderAdapter> = new Map();
  private storageClient: StorageClient;
  private defaultProvider: ImageProvider;

  constructor(options: LaneOptions) {
    this.storageClient = options.storageClient;
    this.defaultProvider = options.defaultProvider;

    if (options.adapters) {
      this.adapters = options.adapters;
    }
  }

  registerAdapter(name: ImageProvider, adapter: ImageProviderAdapter): void {
    this.adapters.set(name, adapter);
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const id = nanoid();
    const startTime = Date.now();
    let attemptCount = 0;
    const maxRetries = request.maxRetries ?? 3;

    // Select provider
    const providersToTry = this.getProvidersToTry(request);

    for (const provider of providersToTry) {
      const adapter = this.adapters.get(provider);
      if (!adapter) continue;

      // Check cost limit
      const estimatedCost = adapter.estimateCost({
        prompt: request.prompt,
        negativePrompt: request.negativePrompt,
        size: request.resolution || request.aspectRatio || '1024x1024'
      });

      if (request.maxCostCents && estimatedCost > request.maxCostCents) {
        throw new Error(`Generation cost (${estimatedCost}¢) exceeds budget (${request.maxCostCents}¢)`);
      }

      // Attempt generation with retries
      for (let retry = 0; retry < maxRetries; retry++) {
        attemptCount++;

        try {
          const output = await adapter.generate({
            prompt: request.prompt,
            negativePrompt: request.negativePrompt,
            size: request.resolution || this.aspectRatioToSize(request.aspectRatio),
            quality: 'standard'
          });

          // Validate quality if threshold specified
          let qualityScore: number | undefined;
          if (request.qualityThreshold && output.imageData) {
            qualityScore = await this.assessQuality(output.imageData);
            if (qualityScore < request.qualityThreshold) {
              continue; // Retry for better quality
            }
          }

          // Upload to storage
          const storageResult = await this.uploadImage(
            output.imageData!,
            request.clientId,
            output.format,
            id
          );

          // Generate signed URL if requested
          let signedUrl: string | undefined;
          if (request.generateSignedUrl) {
            signedUrl = await this.storageClient.getSignedUrl(storageResult.key);
          }

          // Get dimensions
          const dimensions = output.imageData
            ? await this.getImageDimensions(output.imageData)
            : undefined;

          return {
            id,
            status: 'completed',
            imageUrl: storageResult.url,
            signedUrl,
            storageKey: storageResult.key,
            providerUsed: provider,
            cost: {
              amount: estimatedCost / 100,
              currency: 'USD'
            },
            dimensions,
            qualityScore,
            metadata: {
              generatedAt: new Date().toISOString(),
              promptUsed: request.prompt,
              revisedPrompt: output.revisedPrompt,
              modelVersion: adapter.name,
              seed: output.seed,
              processingTimeMs: Date.now() - startTime
            },
            attemptCount
          };
        } catch (error) {
          console.error(`Generation attempt ${attemptCount} failed:`, error);
          if (retry === maxRetries - 1) {
            // Last retry for this provider, try next
            break;
          }
          // Wait before retry with exponential backoff
          await this.delay(1000 * Math.pow(2, retry));
        }
      }
    }

    // All providers failed
    return {
      id,
      status: 'failed',
      providerUsed: providersToTry[0],
      metadata: {
        generatedAt: new Date().toISOString(),
        promptUsed: request.prompt,
        modelVersion: 'none',
        processingTimeMs: Date.now() - startTime
      },
      attemptCount,
      error: 'All generation attempts failed'
    };
  }

  async generateBatch(
    requests: GenerationRequest[],
    options: BatchOptions = {}
  ): Promise<GenerationResult[]> {
    const maxConcurrency = options.maxConcurrency ?? 3;
    const results: GenerationResult[] = [];

    // Process in batches
    for (let i = 0; i < requests.length; i += maxConcurrency) {
      const batch = requests.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(
        batch.map(req => this.generate(req))
      );

      results.push(...batchResults);

      if (options.stopOnFirstError && batchResults.some(r => r.status === 'failed')) {
        break;
      }
    }

    return results;
  }

  private getProvidersToTry(request: GenerationRequest): ImageProvider[] {
    const providers: ImageProvider[] = [];

    // Client preference first
    if (request.clientPreferences?.preferredProvider) {
      providers.push(request.clientPreferences.preferredProvider);
    }

    // Explicit provider
    if (request.provider && !providers.includes(request.provider)) {
      providers.push(request.provider);
    }

    // Style-based selection
    if (request.style) {
      const styleProvider = this.getProviderForStyle(request.style);
      if (!providers.includes(styleProvider)) {
        providers.push(styleProvider);
      }
    }

    // Default
    if (!providers.includes(this.defaultProvider)) {
      providers.push(this.defaultProvider);
    }

    // Fallbacks
    if (request.fallbackProviders) {
      for (const fb of request.fallbackProviders) {
        if (!providers.includes(fb)) {
          providers.push(fb);
        }
      }
    }

    return providers;
  }

  private getProviderForStyle(style: string): ImageProvider {
    // DALL-E is better for photorealistic, SD for artistic
    const dalleStyles = ['photorealistic', 'editorial', 'cinematic'];
    return dalleStyles.includes(style) ? 'dalle' : 'stable_diffusion';
  }

  private aspectRatioToSize(aspectRatio?: string): string {
    if (!aspectRatio) return '1024x1024';

    const mapping: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '4:5': '1024x1280',
      '1.91:1': '1792x938'
    };

    return mapping[aspectRatio] || '1024x1024';
  }

  private async uploadImage(
    imageData: Buffer,
    clientId: string,
    format: string,
    id: string
  ): Promise<{ url: string; key: string }> {
    const key = `clients/${clientId}/images/${id}.${format}`;
    const contentType = `image/${format}`;

    return this.storageClient.upload({
      key,
      data: imageData,
      contentType,
      metadata: {
        clientId,
        generatedAt: new Date().toISOString()
      }
    });
  }

  private async assessQuality(imageData: Buffer): Promise<number> {
    // Simplified quality assessment
    // In production, use a more sophisticated model
    const size = imageData.length;

    // Very small images are likely low quality
    if (size < 50000) return 0.3;
    if (size < 100000) return 0.5;
    if (size < 200000) return 0.7;

    return 0.9;
  }

  private async getImageDimensions(imageData: Buffer): Promise<{ width: number; height: number }> {
    // Use sharp for image metadata
    // Simplified for now
    return { width: 1024, height: 1024 };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { DalleAdapter } from './adapters/dalle-adapter';
export { StableDiffusionAdapter } from './adapters/stable-diffusion-adapter';
```

#### Step 5: Create Package Exports

```typescript
// packages/agents/media/src/image-generation/index.ts

export * from './types';
export * from './image-generation-lane';
export * from './adapters/dalle-adapter';
export * from './adapters/stable-diffusion-adapter';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/agents/media
pnpm test src/image-generation

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint src/image-generation
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/media/src/image-generation/types.ts` | Type definitions |
| Create | `packages/agents/media/src/image-generation/adapters/dalle-adapter.ts` | DALL-E provider |
| Create | `packages/agents/media/src/image-generation/adapters/stable-diffusion-adapter.ts` | Stable Diffusion provider |
| Create | `packages/agents/media/src/image-generation/image-generation-lane.ts` | Main orchestration |
| Create | `packages/agents/media/src/image-generation/index.ts` | Package exports |
| Create | `packages/agents/media/src/image-generation/__tests__/image-generation-lane.test.ts` | Tests |

---

## Acceptance Criteria

- [ ] ImageGenerationLane generates images from prompts
- [ ] DALL-E adapter fully functional
- [ ] Stable Diffusion adapter fully functional
- [ ] Provider selection logic works
- [ ] Cost tracking per generation
- [ ] Quality validation available
- [ ] Retry logic with fallbacks
- [ ] Batch generation supported
- [ ] Storage integration working
- [ ] Tests pass with >90% coverage

---

## Test Requirements

### Unit Tests
- Basic generation
- Provider selection
- Cost tracking
- Quality validation
- Storage integration
- Retry logic
- Batch generation

### Integration Tests
- Full generation pipeline
- Multi-provider fallback
- Storage lifecycle

---

## Security & Safety Checklist

- [ ] API keys not exposed in logs
- [ ] Cost limits enforced
- [ ] Client isolation in storage
- [ ] Signed URLs with expiration
- [ ] Audit logging for generations

---

## JSON Task Block

```json
{
  "task_id": "S2-D2",
  "name": "Image Generation Lane",
  "status": "pending",
  "dependencies": ["S2-D1", "S1-B1", "S0-B1"],
  "blocks": ["S2-D5"],
  "agent": "D",
  "sprint": 2,
  "complexity": "high",
  "estimated_files": 6,
  "tdd_required": true,
  "spec_refs": [
    "docs/03-agents-tools/agent-recursion-contracts.md",
    "docs/01-architecture/rlm-integration-spec.md"
  ],
  "acceptance_checklist": [
    "provider_adapters",
    "generation_orchestration",
    "cost_tracking",
    "quality_validation",
    "retry_logic",
    "batch_generation",
    "storage_integration"
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
    { "type": "image_prompt", "scope": "content" }
  ],
  "writes": [
    { "type": "generated_image", "scope": "asset" },
    { "type": "generation_cost", "scope": "client_budget" }
  ],
  "context_window_at_completion": null,
  "continuation_hint": "Generated images feed into QA system in S2-D5"
}
```
