# Build Prompt: S3-D1 — Post Verification API

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S3-D1 |
| Sprint | 3 — Scheduling + Publishing |
| Agent | D — Publish Verification System |
| Complexity | High |
| Status | Pending |
| Estimated Effort | 2 days |
| Dependencies | S3-B1, S3-B2, S3-B3, S3-B4, S3-B5, S3-B6 |
| Blocks | S3-D2, S3-D3, S3-D4, S3-D5 |

---

## Context

### What We're Building
A unified Post Verification API that checks published content visibility across all platforms. After publishing via API or browser lane, the verification system confirms the post is live, accessible, and matches expected content. This is critical for proving delivery to clients and detecting shadow bans or rate limiting.

### Why It Matters
- **Proof of Delivery**: Clients need evidence posts went live
- **Shadow Ban Detection**: Identify when posts aren't visible to public
- **Platform Health**: Track which platforms have issues
- **SLA Compliance**: Verify promised posts were delivered
- **Incident Response**: Quickly detect publishing failures

### Spec References
- `docs/01-architecture/system-architecture-v3.md` — Publishing pipeline
- `docs/02-schemas/external-memory-schema.md` — VerificationEvent schema
- `docs/03-agents-tools/tool-registry.md` — Tool definitions
- `docs/05-policy-safety/compliance-safety-framework.md` — Audit requirements
- `docs/06-reliability-ops/slo-error-budget.md` — Verification SLOs

---

## Prerequisites

### Completed Tasks
- [x] S3-B1: Meta (Facebook) connector
- [x] S3-B2: Meta (Instagram) connector
- [x] S3-B3: TikTok connector
- [x] S3-B4: YouTube connector
- [x] S3-B5: LinkedIn connector
- [x] S3-B6: X (Twitter) connector

### Required Packages
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "cheerio": "^1.0.0-rc.12",
    "puppeteer-core": "^22.0.0",
    "@rtv/connectors/api": "workspace:*",
    "@rtv/core": "workspace:*",
    "@rtv/telemetry": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^1.2.0",
    "nock": "^13.5.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests BEFORE implementation.

#### 1.1 Verification Result Tests
```typescript
// packages/verification/src/__tests__/verification-result.test.ts
import { describe, it, expect } from 'vitest';
import {
  VerificationResult,
  VerificationStatus,
  createVerificationResult,
  isSuccessful,
  requiresRetry,
  isPermanentFailure,
} from '../verification-result';

describe('VerificationResult', () => {
  describe('createVerificationResult', () => {
    it('should create successful verification result', () => {
      const result = createVerificationResult({
        postId: 'post_123',
        platform: 'facebook',
        externalPostId: 'fb_post_456',
        status: 'visible',
      });

      expect(result.status).toBe('visible');
      expect(result.isVisible).toBe(true);
      expect(result.verifiedAt).toBeInstanceOf(Date);
    });

    it('should create hidden verification result', () => {
      const result = createVerificationResult({
        postId: 'post_123',
        platform: 'instagram',
        externalPostId: 'ig_post_789',
        status: 'hidden',
        reason: 'shadow_ban',
      });

      expect(result.status).toBe('hidden');
      expect(result.isVisible).toBe(false);
      expect(result.reason).toBe('shadow_ban');
    });

    it('should create not_found verification result', () => {
      const result = createVerificationResult({
        postId: 'post_123',
        platform: 'tiktok',
        externalPostId: 'tt_video_000',
        status: 'not_found',
      });

      expect(result.status).toBe('not_found');
      expect(result.isVisible).toBe(false);
    });

    it('should include content match data when provided', () => {
      const result = createVerificationResult({
        postId: 'post_123',
        platform: 'linkedin',
        externalPostId: 'li_post_111',
        status: 'visible',
        contentMatch: {
          textMatches: true,
          mediaMatches: true,
          similarity: 0.98,
        },
      });

      expect(result.contentMatch?.textMatches).toBe(true);
      expect(result.contentMatch?.similarity).toBe(0.98);
    });
  });

  describe('status helpers', () => {
    it('isSuccessful should return true for visible status', () => {
      const result = createVerificationResult({
        postId: 'post_123',
        platform: 'youtube',
        externalPostId: 'yt_video_222',
        status: 'visible',
      });

      expect(isSuccessful(result)).toBe(true);
    });

    it('requiresRetry should return true for pending status', () => {
      const result = createVerificationResult({
        postId: 'post_123',
        platform: 'tiktok',
        externalPostId: 'tt_video_333',
        status: 'pending',
      });

      expect(requiresRetry(result)).toBe(true);
    });

    it('requiresRetry should return true for timeout status', () => {
      const result = createVerificationResult({
        postId: 'post_123',
        platform: 'x',
        externalPostId: 'x_tweet_444',
        status: 'timeout',
      });

      expect(requiresRetry(result)).toBe(true);
    });

    it('isPermanentFailure should return true for deleted status', () => {
      const result = createVerificationResult({
        postId: 'post_123',
        platform: 'facebook',
        externalPostId: 'fb_post_555',
        status: 'deleted',
      });

      expect(isPermanentFailure(result)).toBe(true);
    });
  });
});
```

#### 1.2 Platform Verifier Tests
```typescript
// packages/verification/src/__tests__/platform-verifiers.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FacebookVerifier,
  InstagramVerifier,
  TikTokVerifier,
  YouTubeVerifier,
  LinkedInVerifier,
  XVerifier,
} from '../platform-verifiers';
import { createMockConnector } from './__mocks__/connectors';

describe('Platform Verifiers', () => {
  describe('FacebookVerifier', () => {
    let verifier: FacebookVerifier;
    let mockConnector: ReturnType<typeof createMockConnector>;

    beforeEach(() => {
      mockConnector = createMockConnector('facebook');
      verifier = new FacebookVerifier(mockConnector);
    });

    it('should verify visible post via API', async () => {
      mockConnector.getPost.mockResolvedValue({
        id: 'fb_post_123',
        message: 'Test post content',
        is_published: true,
        created_time: '2025-01-15T12:00:00Z',
      });

      const result = await verifier.verify({
        externalPostId: 'fb_post_123',
        expectedContent: 'Test post content',
      });

      expect(result.status).toBe('visible');
      expect(result.isVisible).toBe(true);
    });

    it('should detect hidden post', async () => {
      mockConnector.getPost.mockResolvedValue({
        id: 'fb_post_123',
        message: 'Test post content',
        is_published: false,
        privacy: { value: 'SELF' },
      });

      const result = await verifier.verify({
        externalPostId: 'fb_post_123',
        expectedContent: 'Test post content',
      });

      expect(result.status).toBe('hidden');
      expect(result.reason).toBe('privacy_restricted');
    });

    it('should detect deleted post', async () => {
      mockConnector.getPost.mockRejectedValue({
        code: 100,
        message: 'Object does not exist',
      });

      const result = await verifier.verify({
        externalPostId: 'fb_post_123',
        expectedContent: 'Test post content',
      });

      expect(result.status).toBe('deleted');
    });

    it('should detect content mismatch', async () => {
      mockConnector.getPost.mockResolvedValue({
        id: 'fb_post_123',
        message: 'Different content',
        is_published: true,
      });

      const result = await verifier.verify({
        externalPostId: 'fb_post_123',
        expectedContent: 'Expected content',
      });

      expect(result.status).toBe('content_mismatch');
      expect(result.contentMatch?.textMatches).toBe(false);
    });
  });

  describe('TikTokVerifier', () => {
    let verifier: TikTokVerifier;
    let mockConnector: ReturnType<typeof createMockConnector>;

    beforeEach(() => {
      mockConnector = createMockConnector('tiktok');
      verifier = new TikTokVerifier(mockConnector);
    });

    it('should verify visible video', async () => {
      mockConnector.getVideoStatus.mockResolvedValue({
        id: 'tt_video_123',
        status: 'PUBLISH_COMPLETE',
        visibility: 'PUBLIC_TO_EVERYONE',
      });

      const result = await verifier.verify({
        externalPostId: 'tt_video_123',
      });

      expect(result.status).toBe('visible');
    });

    it('should detect processing video', async () => {
      mockConnector.getVideoStatus.mockResolvedValue({
        id: 'tt_video_123',
        status: 'PROCESSING_UPLOAD',
      });

      const result = await verifier.verify({
        externalPostId: 'tt_video_123',
      });

      expect(result.status).toBe('pending');
      expect(result.reason).toBe('still_processing');
    });

    it('should detect failed upload', async () => {
      mockConnector.getVideoStatus.mockResolvedValue({
        id: 'tt_video_123',
        status: 'FAILED',
        fail_reason: 'video_format_check_failed',
      });

      const result = await verifier.verify({
        externalPostId: 'tt_video_123',
      });

      expect(result.status).toBe('failed');
      expect(result.reason).toBe('video_format_check_failed');
    });
  });

  describe('YouTubeVerifier', () => {
    let verifier: YouTubeVerifier;
    let mockConnector: ReturnType<typeof createMockConnector>;

    beforeEach(() => {
      mockConnector = createMockConnector('youtube');
      verifier = new YouTubeVerifier(mockConnector);
    });

    it('should verify public video', async () => {
      mockConnector.getVideoDetails.mockResolvedValue({
        id: 'yt_video_123',
        status: {
          uploadStatus: 'processed',
          privacyStatus: 'public',
        },
        snippet: {
          title: 'Test Video',
        },
      });

      const result = await verifier.verify({
        externalPostId: 'yt_video_123',
        expectedTitle: 'Test Video',
      });

      expect(result.status).toBe('visible');
    });

    it('should detect unlisted video', async () => {
      mockConnector.getVideoDetails.mockResolvedValue({
        id: 'yt_video_123',
        status: {
          uploadStatus: 'processed',
          privacyStatus: 'unlisted',
        },
      });

      const result = await verifier.verify({
        externalPostId: 'yt_video_123',
      });

      expect(result.status).toBe('hidden');
      expect(result.reason).toBe('unlisted');
    });

    it('should detect processing video', async () => {
      mockConnector.getVideoDetails.mockResolvedValue({
        id: 'yt_video_123',
        status: {
          uploadStatus: 'processing',
        },
      });

      const result = await verifier.verify({
        externalPostId: 'yt_video_123',
      });

      expect(result.status).toBe('pending');
    });
  });
});
```

#### 1.3 Verification Service Tests
```typescript
// packages/verification/src/__tests__/verification-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VerificationService } from '../verification-service';
import { createMockVerifierRegistry } from './__mocks__/verifier-registry';
import { createMockExternalMemory } from './__mocks__/external-memory';

describe('VerificationService', () => {
  let service: VerificationService;
  let mockRegistry: ReturnType<typeof createMockVerifierRegistry>;
  let mockMemory: ReturnType<typeof createMockExternalMemory>;

  beforeEach(() => {
    mockRegistry = createMockVerifierRegistry();
    mockMemory = createMockExternalMemory();
    service = new VerificationService({
      verifierRegistry: mockRegistry,
      externalMemory: mockMemory,
    });
  });

  describe('verifyPost', () => {
    it('should verify post using correct platform verifier', async () => {
      const mockVerifier = {
        verify: vi.fn().mockResolvedValue({
          status: 'visible',
          isVisible: true,
        }),
      };
      mockRegistry.getVerifier.mockReturnValue(mockVerifier);

      const result = await service.verifyPost({
        postId: 'post_123',
        platform: 'facebook',
        externalPostId: 'fb_post_456',
        clientId: 'client_abc',
      });

      expect(mockRegistry.getVerifier).toHaveBeenCalledWith('facebook');
      expect(result.status).toBe('visible');
    });

    it('should emit verification event to external memory', async () => {
      const mockVerifier = {
        verify: vi.fn().mockResolvedValue({
          status: 'visible',
          isVisible: true,
        }),
      };
      mockRegistry.getVerifier.mockReturnValue(mockVerifier);

      await service.verifyPost({
        postId: 'post_123',
        platform: 'instagram',
        externalPostId: 'ig_post_789',
        clientId: 'client_abc',
      });

      expect(mockMemory.append).toHaveBeenCalledWith(
        'client_abc',
        expect.objectContaining({
          type: 'verification_event',
          postId: 'post_123',
          platform: 'instagram',
        })
      );
    });

    it('should scope verification to client', async () => {
      const mockVerifier = {
        verify: vi.fn().mockResolvedValue({
          status: 'visible',
          isVisible: true,
        }),
      };
      mockRegistry.getVerifier.mockReturnValue(mockVerifier);

      await service.verifyPost({
        postId: 'post_123',
        platform: 'linkedin',
        externalPostId: 'li_post_111',
        clientId: 'client_xyz',
      });

      // Verify client isolation
      expect(mockMemory.append).toHaveBeenCalledWith(
        'client_xyz',
        expect.anything()
      );
    });

    it('should handle verifier errors gracefully', async () => {
      const mockVerifier = {
        verify: vi.fn().mockRejectedValue(new Error('API rate limit')),
      };
      mockRegistry.getVerifier.mockReturnValue(mockVerifier);

      const result = await service.verifyPost({
        postId: 'post_123',
        platform: 'x',
        externalPostId: 'x_tweet_222',
        clientId: 'client_abc',
      });

      expect(result.status).toBe('error');
      expect(result.error).toContain('API rate limit');
    });
  });

  describe('verifyBatch', () => {
    it('should verify multiple posts in parallel', async () => {
      const mockVerifier = {
        verify: vi.fn().mockResolvedValue({
          status: 'visible',
          isVisible: true,
        }),
      };
      mockRegistry.getVerifier.mockReturnValue(mockVerifier);

      const posts = [
        { postId: 'post_1', platform: 'facebook', externalPostId: 'fb_1' },
        { postId: 'post_2', platform: 'instagram', externalPostId: 'ig_2' },
        { postId: 'post_3', platform: 'tiktok', externalPostId: 'tt_3' },
      ];

      const results = await service.verifyBatch({
        posts,
        clientId: 'client_abc',
      });

      expect(results).toHaveLength(3);
      expect(mockVerifier.verify).toHaveBeenCalledTimes(3);
    });

    it('should respect concurrency limit', async () => {
      const verifyCallOrder: number[] = [];
      let currentConcurrent = 0;
      let maxConcurrent = 0;

      const mockVerifier = {
        verify: vi.fn().mockImplementation(async () => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          await new Promise(resolve => setTimeout(resolve, 10));
          currentConcurrent--;
          return { status: 'visible', isVisible: true };
        }),
      };
      mockRegistry.getVerifier.mockReturnValue(mockVerifier);

      const posts = Array.from({ length: 10 }, (_, i) => ({
        postId: `post_${i}`,
        platform: 'facebook',
        externalPostId: `fb_${i}`,
      }));

      await service.verifyBatch({
        posts,
        clientId: 'client_abc',
        concurrency: 3,
      });

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });

  describe('scheduleVerification', () => {
    it('should schedule verification with delay', async () => {
      const result = await service.scheduleVerification({
        postId: 'post_123',
        platform: 'youtube',
        externalPostId: 'yt_video_456',
        clientId: 'client_abc',
        delayMs: 30000,
      });

      expect(result.scheduled).toBe(true);
      expect(result.scheduledFor).toBeDefined();
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Create Verification Types
```typescript
// packages/verification/src/types.ts
export type VerificationStatus =
  | 'visible'
  | 'hidden'
  | 'pending'
  | 'not_found'
  | 'deleted'
  | 'failed'
  | 'timeout'
  | 'error'
  | 'content_mismatch';

export interface ContentMatch {
  textMatches: boolean;
  mediaMatches?: boolean;
  similarity: number;
  differences?: string[];
}

export interface VerificationResult {
  postId: string;
  platform: Platform;
  externalPostId: string;
  status: VerificationStatus;
  isVisible: boolean;
  verifiedAt: Date;
  reason?: string;
  contentMatch?: ContentMatch;
  error?: string;
  responseTimeMs?: number;
  metadata?: Record<string, unknown>;
}

export interface VerifyPostRequest {
  postId: string;
  platform: Platform;
  externalPostId: string;
  clientId: string;
  expectedContent?: string;
  expectedTitle?: string;
  expectedMedia?: string[];
}

export interface VerifyBatchRequest {
  posts: Omit<VerifyPostRequest, 'clientId'>[];
  clientId: string;
  concurrency?: number;
}

export interface ScheduleVerificationRequest {
  postId: string;
  platform: Platform;
  externalPostId: string;
  clientId: string;
  delayMs: number;
  maxRetries?: number;
}

export interface PlatformVerifier {
  platform: Platform;
  verify(request: VerifyRequest): Promise<VerificationResult>;
}

export type Platform =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'x'
  | 'skool';
```

#### 2.2 Create Verification Result Factory
```typescript
// packages/verification/src/verification-result.ts
import {
  VerificationResult,
  VerificationStatus,
  ContentMatch,
  Platform,
} from './types';

interface CreateVerificationResultParams {
  postId: string;
  platform: Platform;
  externalPostId: string;
  status: VerificationStatus;
  reason?: string;
  contentMatch?: ContentMatch;
  error?: string;
  responseTimeMs?: number;
  metadata?: Record<string, unknown>;
}

export function createVerificationResult(
  params: CreateVerificationResultParams
): VerificationResult {
  const isVisible = params.status === 'visible';

  return {
    postId: params.postId,
    platform: params.platform,
    externalPostId: params.externalPostId,
    status: params.status,
    isVisible,
    verifiedAt: new Date(),
    reason: params.reason,
    contentMatch: params.contentMatch,
    error: params.error,
    responseTimeMs: params.responseTimeMs,
    metadata: params.metadata,
  };
}

export function isSuccessful(result: VerificationResult): boolean {
  return result.status === 'visible';
}

export function requiresRetry(result: VerificationResult): boolean {
  return ['pending', 'timeout', 'error'].includes(result.status);
}

export function isPermanentFailure(result: VerificationResult): boolean {
  return ['deleted', 'failed', 'not_found'].includes(result.status);
}

export function calculateTextSimilarity(
  expected: string,
  actual: string
): number {
  if (expected === actual) return 1.0;
  if (!expected || !actual) return 0.0;

  const expectedNormalized = expected.toLowerCase().trim();
  const actualNormalized = actual.toLowerCase().trim();

  if (expectedNormalized === actualNormalized) return 1.0;

  // Levenshtein-based similarity
  const maxLen = Math.max(expected.length, actual.length);
  const distance = levenshteinDistance(expectedNormalized, actualNormalized);

  return 1 - distance / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
```

#### 2.3 Create Platform Verifiers
```typescript
// packages/verification/src/platform-verifiers/facebook-verifier.ts
import { PlatformVerifier, VerificationResult, VerifyRequest } from '../types';
import { createVerificationResult, calculateTextSimilarity } from '../verification-result';
import type { FacebookConnector } from '@rtv/connectors/api';

export class FacebookVerifier implements PlatformVerifier {
  platform = 'facebook' as const;

  constructor(private connector: FacebookConnector) {}

  async verify(request: VerifyRequest): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      const post = await this.connector.getPost(request.externalPostId);
      const responseTimeMs = Date.now() - startTime;

      // Check if post exists
      if (!post) {
        return createVerificationResult({
          postId: request.postId,
          platform: 'facebook',
          externalPostId: request.externalPostId,
          status: 'not_found',
          responseTimeMs,
        });
      }

      // Check visibility
      if (!post.is_published) {
        return createVerificationResult({
          postId: request.postId,
          platform: 'facebook',
          externalPostId: request.externalPostId,
          status: 'hidden',
          reason: post.privacy?.value === 'SELF' ? 'privacy_restricted' : 'unpublished',
          responseTimeMs,
        });
      }

      // Check content match if expected content provided
      let contentMatch;
      if (request.expectedContent) {
        const similarity = calculateTextSimilarity(
          request.expectedContent,
          post.message || ''
        );
        const textMatches = similarity >= 0.9;

        contentMatch = { textMatches, similarity };

        if (!textMatches) {
          return createVerificationResult({
            postId: request.postId,
            platform: 'facebook',
            externalPostId: request.externalPostId,
            status: 'content_mismatch',
            contentMatch,
            responseTimeMs,
          });
        }
      }

      return createVerificationResult({
        postId: request.postId,
        platform: 'facebook',
        externalPostId: request.externalPostId,
        status: 'visible',
        contentMatch,
        responseTimeMs,
        metadata: {
          createdTime: post.created_time,
          engagementCount: post.shares?.count || 0,
        },
      });
    } catch (error: any) {
      const responseTimeMs = Date.now() - startTime;

      // Handle specific Facebook API errors
      if (error.code === 100) {
        return createVerificationResult({
          postId: request.postId,
          platform: 'facebook',
          externalPostId: request.externalPostId,
          status: 'deleted',
          error: error.message,
          responseTimeMs,
        });
      }

      if (error.code === 190) {
        return createVerificationResult({
          postId: request.postId,
          platform: 'facebook',
          externalPostId: request.externalPostId,
          status: 'error',
          error: 'Token expired',
          responseTimeMs,
        });
      }

      return createVerificationResult({
        postId: request.postId,
        platform: 'facebook',
        externalPostId: request.externalPostId,
        status: 'error',
        error: error.message,
        responseTimeMs,
      });
    }
  }
}
```

#### 2.4 Create Verification Service
```typescript
// packages/verification/src/verification-service.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import pLimit from 'p-limit';
import {
  VerificationResult,
  VerifyPostRequest,
  VerifyBatchRequest,
  ScheduleVerificationRequest,
  Platform,
} from './types';
import { createVerificationResult } from './verification-result';
import type { VerifierRegistry } from './verifier-registry';
import type { ExternalMemory } from '@rtv/core';

const tracer = trace.getTracer('verification-service');

interface VerificationServiceConfig {
  verifierRegistry: VerifierRegistry;
  externalMemory: ExternalMemory;
  defaultConcurrency?: number;
}

export class VerificationService {
  private registry: VerifierRegistry;
  private memory: ExternalMemory;
  private defaultConcurrency: number;

  constructor(config: VerificationServiceConfig) {
    this.registry = config.verifierRegistry;
    this.memory = config.externalMemory;
    this.defaultConcurrency = config.defaultConcurrency || 5;
  }

  async verifyPost(request: VerifyPostRequest): Promise<VerificationResult> {
    return tracer.startActiveSpan('verifyPost', async (span) => {
      span.setAttributes({
        'verification.post_id': request.postId,
        'verification.platform': request.platform,
        'verification.client_id': request.clientId,
      });

      try {
        const verifier = this.registry.getVerifier(request.platform);

        const result = await verifier.verify({
          postId: request.postId,
          externalPostId: request.externalPostId,
          expectedContent: request.expectedContent,
          expectedTitle: request.expectedTitle,
          expectedMedia: request.expectedMedia,
        });

        // Emit verification event to external memory
        await this.memory.append(request.clientId, {
          type: 'verification_event',
          postId: request.postId,
          platform: request.platform,
          externalPostId: request.externalPostId,
          status: result.status,
          isVisible: result.isVisible,
          verifiedAt: result.verifiedAt.toISOString(),
          reason: result.reason,
          responseTimeMs: result.responseTimeMs,
        });

        span.setAttributes({
          'verification.status': result.status,
          'verification.is_visible': result.isVisible,
          'verification.response_time_ms': result.responseTimeMs || 0,
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error: any) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);

        return createVerificationResult({
          postId: request.postId,
          platform: request.platform,
          externalPostId: request.externalPostId,
          status: 'error',
          error: error.message,
        });
      } finally {
        span.end();
      }
    });
  }

  async verifyBatch(request: VerifyBatchRequest): Promise<VerificationResult[]> {
    return tracer.startActiveSpan('verifyBatch', async (span) => {
      span.setAttributes({
        'verification.batch_size': request.posts.length,
        'verification.client_id': request.clientId,
        'verification.concurrency': request.concurrency || this.defaultConcurrency,
      });

      const limit = pLimit(request.concurrency || this.defaultConcurrency);

      const results = await Promise.all(
        request.posts.map((post) =>
          limit(() =>
            this.verifyPost({
              ...post,
              clientId: request.clientId,
            })
          )
        )
      );

      const visibleCount = results.filter((r) => r.isVisible).length;
      span.setAttributes({
        'verification.visible_count': visibleCount,
        'verification.success_rate': visibleCount / results.length,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return results;
    });
  }

  async scheduleVerification(
    request: ScheduleVerificationRequest
  ): Promise<{ scheduled: boolean; scheduledFor: Date }> {
    const scheduledFor = new Date(Date.now() + request.delayMs);

    // In production, this would add to a job queue
    // For now, emit scheduling event
    await this.memory.append(request.clientId, {
      type: 'verification_scheduled',
      postId: request.postId,
      platform: request.platform,
      externalPostId: request.externalPostId,
      scheduledFor: scheduledFor.toISOString(),
      maxRetries: request.maxRetries || 3,
    });

    return {
      scheduled: true,
      scheduledFor,
    };
  }
}
```

### Phase 3: Verification

```bash
# Run tests
cd packages/verification && pnpm test

# Run with coverage
pnpm test:coverage

# Verify types
pnpm typecheck

# Lint
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/verification/package.json` | Package configuration |
| Create | `packages/verification/tsconfig.json` | TypeScript config |
| Create | `packages/verification/src/index.ts` | Public exports |
| Create | `packages/verification/src/types.ts` | Type definitions |
| Create | `packages/verification/src/verification-result.ts` | Result factory |
| Create | `packages/verification/src/verification-service.ts` | Main service |
| Create | `packages/verification/src/verifier-registry.ts` | Verifier registry |
| Create | `packages/verification/src/platform-verifiers/index.ts` | Verifier exports |
| Create | `packages/verification/src/platform-verifiers/facebook-verifier.ts` | Facebook verifier |
| Create | `packages/verification/src/platform-verifiers/instagram-verifier.ts` | Instagram verifier |
| Create | `packages/verification/src/platform-verifiers/tiktok-verifier.ts` | TikTok verifier |
| Create | `packages/verification/src/platform-verifiers/youtube-verifier.ts` | YouTube verifier |
| Create | `packages/verification/src/platform-verifiers/linkedin-verifier.ts` | LinkedIn verifier |
| Create | `packages/verification/src/platform-verifiers/x-verifier.ts` | X (Twitter) verifier |
| Create | `packages/verification/src/__tests__/` | Test directory |

---

## Acceptance Criteria

- [ ] VerificationResult type includes all statuses: visible, hidden, pending, not_found, deleted, failed, timeout, error, content_mismatch
- [ ] Each platform has dedicated verifier implementation
- [ ] Verification results include response time metrics
- [ ] Content matching with similarity scoring
- [ ] Batch verification with configurable concurrency
- [ ] All verification events emitted to external memory with client scoping
- [ ] Platform API errors mapped to appropriate verification statuses
- [ ] Unit tests achieve 90%+ coverage
- [ ] Integration tests verify real API responses (mocked)

---

## Test Requirements

### Unit Tests
- VerificationResult creation and status helpers
- Each platform verifier (mocked API)
- VerificationService batch processing
- Text similarity calculation

### Integration Tests
- Full verification flow with mocked connectors
- External memory event emission
- Scheduled verification creation

### Contract Tests
- VerificationResult schema validation
- API response mapping per platform

---

## Security & Safety Checklist

- [ ] No hardcoded secrets (API tokens from connectors)
- [ ] Client ID required for all verification operations (tenant isolation)
- [ ] Rate limiting respected per platform
- [ ] Audit events emitted for all verification attempts
- [ ] Error messages don't leak sensitive data
- [ ] Verification timeouts prevent hanging requests

---

## JSON Task Block

```json
{
  "task_id": "S3-D1",
  "name": "Post Verification API",
  "description": "Unified API for verifying published content visibility across all platforms",
  "status": "pending",
  "priority": "high",
  "complexity": "high",
  "sprint": 3,
  "agent": "D",
  "dependencies": ["S3-B1", "S3-B2", "S3-B3", "S3-B4", "S3-B5", "S3-B6"],
  "blocks": ["S3-D2", "S3-D3", "S3-D4", "S3-D5"],
  "estimated_hours": 16,
  "actual_hours": null,
  "tags": ["verification", "api", "multi-platform", "tdd"],
  "package": "@rtv/verification",
  "files": {
    "create": [
      "packages/verification/src/types.ts",
      "packages/verification/src/verification-result.ts",
      "packages/verification/src/verification-service.ts",
      "packages/verification/src/verifier-registry.ts",
      "packages/verification/src/platform-verifiers/facebook-verifier.ts",
      "packages/verification/src/platform-verifiers/instagram-verifier.ts",
      "packages/verification/src/platform-verifiers/tiktok-verifier.ts",
      "packages/verification/src/platform-verifiers/youtube-verifier.ts",
      "packages/verification/src/platform-verifiers/linkedin-verifier.ts",
      "packages/verification/src/platform-verifiers/x-verifier.ts"
    ],
    "modify": [],
    "delete": []
  },
  "acceptance_criteria": [
    "VerificationResult includes all status types",
    "Each platform has dedicated verifier",
    "Batch verification with concurrency control",
    "External memory events emitted",
    "90%+ test coverage"
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
  "key_decisions": [],
  "patterns_discovered": [],
  "references_used": [],
  "artifacts_created": [],
  "verification_results": {},
  "next_task_hints": [
    "S3-D2 for proof capture",
    "S3-D3 for retry logic"
  ]
}
```
