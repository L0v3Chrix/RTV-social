# Build Prompt: S3-B3 — TikTok API Connector

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S3-B3 |
| **Sprint** | 3 — Scheduling + Publishing |
| **Agent** | B — API Lane Connectors |
| **Task Name** | TikTok API Connector |
| **Complexity** | High |
| **Status** | Pending |
| **Estimated Effort** | 1 day |
| **Dependencies** | S1-D3, S3-A3 |
| **Blocks** | S3-D1, S3-D2 |

---

## Context

### What We're Building

A TikTok API connector that implements video posting through TikTok's Content Posting API, including video upload, metadata management, privacy controls, and analytics retrieval.

### Why It Matters

TikTok's short-form video format requires specialized handling for vertical video content, sound synchronization, and platform-specific engagement features like duets and stitches.

### Spec References

- `docs/01-architecture/system-architecture-v3.md` — Connector patterns
- `docs/03-agents-tools/tool-registry.md` — External tool contracts
- `docs/09-platform-playbooks/tiktok-strategy.md` — TikTok best practices
- `docs/05-policy-safety/compliance-spec.md` — Content safety guidelines

---

## Prerequisites

### Completed Tasks

- [x] S1-D3: Tool wrapper with retry policies
- [x] S3-A3: Delayed execution engine

### Required Tools/Packages

```bash
pnpm add axios form-data
pnpm add -D nock @types/form-data vitest
```

### Required Accounts/Access

- TikTok Developer Account
- TikTok for Business API access
- Test Business Account for sandbox testing

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests before implementation.

#### 1.1 Create TikTok Connector Test Suite

```typescript
// packages/connectors/api/src/tiktok/__tests__/tiktok-connector.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { TikTokConnector } from '../tiktok-connector';
import { TikTokConfig, VideoPost, VideoMetadata } from '../types';

describe('TikTokConnector', () => {
  let connector: TikTokConnector;
  const testConfig: TikTokConfig = {
    clientKey: 'test-client-key',
    clientSecret: 'test-client-secret',
    accessToken: 'test-access-token',
    openId: 'test-open-id',
    sandbox: true
  };

  beforeEach(() => {
    connector = new TikTokConnector(testConfig);
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    vi.clearAllMocks();
  });

  describe('initializeUpload', () => {
    it('should initialize chunked upload for large videos', async () => {
      const videoSize = 100 * 1024 * 1024; // 100MB

      nock('https://open.tiktokapis.com')
        .post('/v2/post/publish/video/init/')
        .reply(200, {
          data: {
            publish_id: 'v_pub_123',
            upload_url: 'https://upload.tiktok.com/upload/123'
          },
          error: { code: 'ok', message: '' }
        });

      const result = await connector.initializeUpload({
        videoSize,
        chunkSize: 10 * 1024 * 1024,
        totalChunkCount: 10
      });

      expect(result.publishId).toBe('v_pub_123');
      expect(result.uploadUrl).toBeDefined();
    });

    it('should handle initialization errors', async () => {
      nock('https://open.tiktokapis.com')
        .post('/v2/post/publish/video/init/')
        .reply(401, {
          error: {
            code: 'access_token_invalid',
            message: 'Access token is invalid'
          }
        });

      await expect(connector.initializeUpload({
        videoSize: 1000000,
        chunkSize: 1000000,
        totalChunkCount: 1
      })).rejects.toThrow('TikTok auth error');
    });
  });

  describe('uploadChunk', () => {
    it('should upload video chunk successfully', async () => {
      const chunk = Buffer.alloc(1024, 'x');
      const uploadUrl = 'https://upload.tiktok.com/upload/123';

      nock('https://upload.tiktok.com')
        .put('/upload/123')
        .reply(200, { error: { code: 'ok' } });

      const result = await connector.uploadChunk({
        uploadUrl,
        chunk,
        chunkIndex: 0,
        totalChunks: 1
      });

      expect(result.success).toBe(true);
    });

    it('should retry on transient failures', async () => {
      const chunk = Buffer.alloc(1024, 'x');
      const uploadUrl = 'https://upload.tiktok.com/upload/123';

      nock('https://upload.tiktok.com')
        .put('/upload/123')
        .reply(500)
        .put('/upload/123')
        .reply(200, { error: { code: 'ok' } });

      const result = await connector.uploadChunk({
        uploadUrl,
        chunk,
        chunkIndex: 0,
        totalChunks: 1
      });

      expect(result.success).toBe(true);
    });
  });

  describe('publishVideo', () => {
    it('should publish video with metadata', async () => {
      const metadata: VideoMetadata = {
        title: 'Test Video',
        privacyLevel: 'MUTUAL_FOLLOW_FRIENDS',
        disableDuet: false,
        disableStitch: false,
        disableComment: false,
        videoCoverTimestampMs: 1000,
        brandContentToggle: false,
        brandOrganicToggle: false
      };

      nock('https://open.tiktokapis.com')
        .post('/v2/post/publish/video/init/')
        .reply(200, {
          data: {
            publish_id: 'v_pub_123',
            upload_url: 'https://upload.tiktok.com/upload/123'
          },
          error: { code: 'ok' }
        });

      nock('https://upload.tiktok.com')
        .put('/upload/123')
        .reply(200, { error: { code: 'ok' } });

      const result = await connector.publishVideo({
        videoBuffer: Buffer.alloc(1000),
        metadata
      });

      expect(result.publishId).toBe('v_pub_123');
      expect(result.status).toBe('processing');
    });

    it('should handle video too large error', async () => {
      const videoBuffer = Buffer.alloc(5 * 1024 * 1024 * 1024); // 5GB (over limit)

      await expect(connector.publishVideo({
        videoBuffer,
        metadata: { title: 'Test', privacyLevel: 'PUBLIC_TO_EVERYONE' }
      })).rejects.toThrow('Video exceeds maximum size');
    });
  });

  describe('publishVideoFromUrl', () => {
    it('should publish video using pull from URL', async () => {
      nock('https://open.tiktokapis.com')
        .post('/v2/post/publish/video/init/')
        .reply(200, {
          data: {
            publish_id: 'v_pub_456'
          },
          error: { code: 'ok' }
        });

      const result = await connector.publishVideoFromUrl({
        videoUrl: 'https://cdn.example.com/video.mp4',
        metadata: {
          title: 'URL Video',
          privacyLevel: 'SELF_ONLY'
        }
      });

      expect(result.publishId).toBe('v_pub_456');
    });
  });

  describe('checkPublishStatus', () => {
    it('should return published status when complete', async () => {
      nock('https://open.tiktokapis.com')
        .post('/v2/post/publish/status/fetch/')
        .reply(200, {
          data: {
            status: 'PUBLISH_COMPLETE',
            publicaly_available_post_id: ['7123456789']
          },
          error: { code: 'ok' }
        });

      const result = await connector.checkPublishStatus('v_pub_123');

      expect(result.status).toBe('published');
      expect(result.postIds).toContain('7123456789');
    });

    it('should return processing status', async () => {
      nock('https://open.tiktokapis.com')
        .post('/v2/post/publish/status/fetch/')
        .reply(200, {
          data: {
            status: 'PROCESSING_UPLOAD'
          },
          error: { code: 'ok' }
        });

      const result = await connector.checkPublishStatus('v_pub_123');

      expect(result.status).toBe('processing');
    });

    it('should return failure status with reason', async () => {
      nock('https://open.tiktokapis.com')
        .post('/v2/post/publish/status/fetch/')
        .reply(200, {
          data: {
            status: 'FAILED',
            fail_reason: 'Video contains copyrighted music'
          },
          error: { code: 'ok' }
        });

      const result = await connector.checkPublishStatus('v_pub_123');

      expect(result.status).toBe('failed');
      expect(result.failReason).toBe('Video contains copyrighted music');
    });
  });

  describe('getVideoInsights', () => {
    it('should fetch video analytics', async () => {
      nock('https://open.tiktokapis.com')
        .get('/v2/video/query/')
        .query(true)
        .reply(200, {
          data: {
            videos: [{
              id: '7123456789',
              title: 'Test Video',
              view_count: 10000,
              like_count: 500,
              comment_count: 50,
              share_count: 25
            }]
          },
          error: { code: 'ok' }
        });

      const insights = await connector.getVideoInsights('7123456789');

      expect(insights.viewCount).toBe(10000);
      expect(insights.likeCount).toBe(500);
      expect(insights.commentCount).toBe(50);
      expect(insights.shareCount).toBe(25);
    });
  });

  describe('deleteVideo', () => {
    it('should delete video by ID', async () => {
      // Note: TikTok API doesn't support deletion - this tests our handling
      await expect(connector.deleteVideo('7123456789'))
        .rejects.toThrow('TikTok API does not support video deletion');
    });
  });

  describe('privacy levels', () => {
    it('should validate privacy level options', () => {
      expect(connector.isValidPrivacyLevel('PUBLIC_TO_EVERYONE')).toBe(true);
      expect(connector.isValidPrivacyLevel('MUTUAL_FOLLOW_FRIENDS')).toBe(true);
      expect(connector.isValidPrivacyLevel('SELF_ONLY')).toBe(true);
      expect(connector.isValidPrivacyLevel('INVALID')).toBe(false);
    });
  });

  describe('rate limiting', () => {
    it('should handle rate limit errors', async () => {
      nock('https://open.tiktokapis.com')
        .post('/v2/post/publish/video/init/')
        .reply(429, {
          error: {
            code: 'rate_limit_exceeded',
            message: 'Request rate limit exceeded'
          }
        });

      await expect(connector.initializeUpload({
        videoSize: 1000000,
        chunkSize: 1000000,
        totalChunkCount: 1
      })).rejects.toThrow('TikTok rate limit');
    });
  });
});
```

#### 1.2 Create Integration Test Suite

```typescript
// packages/connectors/api/src/tiktok/__tests__/tiktok-integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TikTokConnector } from '../tiktok-connector';
import { createTestVideo } from '../../../test-utils/media-helpers';

describe('TikTok Integration Tests', () => {
  let connector: TikTokConnector;
  let testVideoBuffer: Buffer;

  beforeAll(async () => {
    if (!process.env.TIKTOK_ACCESS_TOKEN) {
      console.log('Skipping TikTok integration tests - no credentials');
      return;
    }

    connector = new TikTokConnector({
      clientKey: process.env.TIKTOK_CLIENT_KEY!,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
      accessToken: process.env.TIKTOK_ACCESS_TOKEN!,
      openId: process.env.TIKTOK_OPEN_ID!,
      sandbox: true
    });

    testVideoBuffer = await createTestVideo({
      duration: 10,
      width: 1080,
      height: 1920,
      format: 'mp4'
    });
  });

  describe('end-to-end publishing', () => {
    it('should publish video and check status', async () => {
      if (!connector) return;

      const result = await connector.publishVideo({
        videoBuffer: testVideoBuffer,
        metadata: {
          title: 'Integration test video #test',
          privacyLevel: 'SELF_ONLY',
          disableDuet: true,
          disableStitch: true,
          disableComment: false
        }
      });

      expect(result.publishId).toBeDefined();

      // Wait for processing
      let status = await connector.checkPublishStatus(result.publishId);
      let attempts = 0;
      const maxAttempts = 30;

      while (status.status === 'processing' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        status = await connector.checkPublishStatus(result.publishId);
        attempts++;
      }

      expect(status.status).toMatch(/published|failed/);
    }, 180000); // 3 minute timeout
  });
});
```

**Run tests to confirm they fail:**

```bash
cd packages/connectors/api
pnpm test src/tiktok --reporter=verbose
```

### Phase 2: Implementation

#### 2.1 Create TikTok Types

```typescript
// packages/connectors/api/src/tiktok/types.ts

import { z } from 'zod';

export const TikTokConfigSchema = z.object({
  clientKey: z.string().min(1),
  clientSecret: z.string().min(1),
  accessToken: z.string().min(1),
  openId: z.string().min(1),
  sandbox: z.boolean().default(false),
  baseUrl: z.string().default('https://open.tiktokapis.com')
});

export type TikTokConfig = z.infer<typeof TikTokConfigSchema>;

export const PrivacyLevelSchema = z.enum([
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'SELF_ONLY',
  'FOLLOWER_OF_CREATOR'
]);

export type PrivacyLevel = z.infer<typeof PrivacyLevelSchema>;

export const VideoMetadataSchema = z.object({
  title: z.string().max(2200),
  privacyLevel: PrivacyLevelSchema,
  disableDuet: z.boolean().default(false),
  disableStitch: z.boolean().default(false),
  disableComment: z.boolean().default(false),
  videoCoverTimestampMs: z.number().optional(),
  brandContentToggle: z.boolean().default(false),
  brandOrganicToggle: z.boolean().default(false)
});

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

export interface InitUploadParams {
  videoSize: number;
  chunkSize: number;
  totalChunkCount: number;
}

export interface InitUploadResult {
  publishId: string;
  uploadUrl: string;
}

export interface UploadChunkParams {
  uploadUrl: string;
  chunk: Buffer;
  chunkIndex: number;
  totalChunks: number;
}

export interface UploadChunkResult {
  success: boolean;
}

export interface PublishVideoParams {
  videoBuffer: Buffer;
  metadata: VideoMetadata;
}

export interface PublishVideoFromUrlParams {
  videoUrl: string;
  metadata: VideoMetadata;
}

export interface PublishResult {
  publishId: string;
  status: 'processing' | 'published' | 'failed';
  postIds?: string[];
  failReason?: string;
}

export interface PublishStatusResult {
  status: 'processing' | 'published' | 'failed';
  postIds?: string[];
  failReason?: string;
}

export interface VideoInsights {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createTime: Date;
}

export const TikTokErrorCodes = {
  'ok': { category: 'success', retryable: false },
  'access_token_invalid': { category: 'auth', retryable: false },
  'access_token_expired': { category: 'auth', retryable: false },
  'rate_limit_exceeded': { category: 'rate_limit', retryable: true },
  'invalid_file_upload': { category: 'validation', retryable: false },
  'video_file_error': { category: 'validation', retryable: false },
  'server_error': { category: 'server', retryable: true },
  'spam_risk_too_many_posts': { category: 'rate_limit', retryable: true },
  'unaudited_client_can_only_post_to_private_accounts': { category: 'permission', retryable: false }
} as const;

export const VIDEO_CONSTRAINTS = {
  maxFileSize: 4 * 1024 * 1024 * 1024, // 4GB
  minDuration: 1, // seconds
  maxDuration: 600, // 10 minutes
  supportedFormats: ['mp4', 'webm', 'mov'],
  minResolution: { width: 360, height: 640 },
  recommendedResolution: { width: 1080, height: 1920 },
  maxChunkSize: 64 * 1024 * 1024, // 64MB per chunk
  minChunkSize: 5 * 1024 * 1024 // 5MB per chunk
} as const;
```

#### 2.2 Implement TikTok Connector

```typescript
// packages/connectors/api/src/tiktok/tiktok-connector.ts

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  TikTokConfig,
  TikTokConfigSchema,
  VideoMetadata,
  VideoMetadataSchema,
  PrivacyLevel,
  PrivacyLevelSchema,
  InitUploadParams,
  InitUploadResult,
  UploadChunkParams,
  UploadChunkResult,
  PublishVideoParams,
  PublishVideoFromUrlParams,
  PublishResult,
  PublishStatusResult,
  VideoInsights,
  TikTokErrorCodes,
  VIDEO_CONSTRAINTS
} from './types';
import { TikTokError, mapTikTokError } from './errors';
import { logger } from '@rtv/observability';
import { withRetry, RetryConfig } from '../shared/retry';

export class TikTokConnector {
  private readonly client: AxiosInstance;
  private readonly config: TikTokConfig;
  private readonly retryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableErrors: ['rate_limit', 'server']
  };

  constructor(config: TikTokConfig) {
    this.config = TikTokConfigSchema.parse(config);

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.response.use(
      (response) => {
        const error = response.data?.error;
        if (error && error.code !== 'ok') {
          throw mapTikTokError(error.code, error.message);
        }
        return response;
      },
      (error: AxiosError) => {
        if (error.response?.data) {
          const errorData = error.response.data as { error?: { code: string; message: string } };
          if (errorData.error) {
            throw mapTikTokError(errorData.error.code, errorData.error.message);
          }
        }
        throw new TikTokError('network_error', error.message, true);
      }
    );
  }

  async initializeUpload(params: InitUploadParams): Promise<InitUploadResult> {
    logger.info('TikTok: Initializing video upload', {
      videoSize: params.videoSize,
      chunkCount: params.totalChunkCount
    });

    const response = await withRetry(
      () => this.client.post('/v2/post/publish/video/init/', {
        post_info: {
          title: '', // Set during final publish
          privacy_level: 'SELF_ONLY'
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: params.videoSize,
          chunk_size: params.chunkSize,
          total_chunk_count: params.totalChunkCount
        }
      }),
      this.retryConfig
    );

    return {
      publishId: response.data.data.publish_id,
      uploadUrl: response.data.data.upload_url
    };
  }

  async uploadChunk(params: UploadChunkParams): Promise<UploadChunkResult> {
    logger.debug('TikTok: Uploading chunk', {
      chunkIndex: params.chunkIndex,
      totalChunks: params.totalChunks
    });

    await withRetry(
      () => axios.put(params.uploadUrl, params.chunk, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes ${params.chunkIndex * params.chunk.length}-${(params.chunkIndex + 1) * params.chunk.length - 1}/${params.totalChunks * params.chunk.length}`
        }
      }),
      this.retryConfig
    );

    return { success: true };
  }

  async publishVideo(params: PublishVideoParams): Promise<PublishResult> {
    const metadata = VideoMetadataSchema.parse(params.metadata);
    const videoSize = params.videoBuffer.length;

    if (videoSize > VIDEO_CONSTRAINTS.maxFileSize) {
      throw new TikTokError(
        'video_too_large',
        `Video exceeds maximum size of ${VIDEO_CONSTRAINTS.maxFileSize / (1024 * 1024 * 1024)}GB`,
        false
      );
    }

    logger.info('TikTok: Publishing video', {
      title: metadata.title.substring(0, 50),
      size: videoSize,
      privacyLevel: metadata.privacyLevel
    });

    // Calculate chunk parameters
    const chunkSize = Math.min(
      VIDEO_CONSTRAINTS.maxChunkSize,
      Math.max(VIDEO_CONSTRAINTS.minChunkSize, Math.ceil(videoSize / 10))
    );
    const totalChunkCount = Math.ceil(videoSize / chunkSize);

    // Initialize upload
    const initResult = await this.initializeUpload({
      videoSize,
      chunkSize,
      totalChunkCount
    });

    // Upload chunks
    for (let i = 0; i < totalChunkCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, videoSize);
      const chunk = params.videoBuffer.slice(start, end);

      await this.uploadChunk({
        uploadUrl: initResult.uploadUrl,
        chunk,
        chunkIndex: i,
        totalChunks: totalChunkCount
      });
    }

    // Complete publishing with metadata
    await this.completePublish(initResult.publishId, metadata);

    return {
      publishId: initResult.publishId,
      status: 'processing'
    };
  }

  private async completePublish(
    publishId: string,
    metadata: VideoMetadata
  ): Promise<void> {
    await withRetry(
      () => this.client.post('/v2/post/publish/video/init/', {
        publish_id: publishId,
        post_info: {
          title: metadata.title,
          privacy_level: metadata.privacyLevel,
          disable_duet: metadata.disableDuet,
          disable_stitch: metadata.disableStitch,
          disable_comment: metadata.disableComment,
          video_cover_timestamp_ms: metadata.videoCoverTimestampMs,
          brand_content_toggle: metadata.brandContentToggle,
          brand_organic_toggle: metadata.brandOrganicToggle
        }
      }),
      this.retryConfig
    );
  }

  async publishVideoFromUrl(params: PublishVideoFromUrlParams): Promise<PublishResult> {
    const metadata = VideoMetadataSchema.parse(params.metadata);

    logger.info('TikTok: Publishing video from URL', {
      title: metadata.title.substring(0, 50),
      privacyLevel: metadata.privacyLevel
    });

    const response = await withRetry(
      () => this.client.post('/v2/post/publish/video/init/', {
        post_info: {
          title: metadata.title,
          privacy_level: metadata.privacyLevel,
          disable_duet: metadata.disableDuet,
          disable_stitch: metadata.disableStitch,
          disable_comment: metadata.disableComment,
          video_cover_timestamp_ms: metadata.videoCoverTimestampMs
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: params.videoUrl
        }
      }),
      this.retryConfig
    );

    return {
      publishId: response.data.data.publish_id,
      status: 'processing'
    };
  }

  async checkPublishStatus(publishId: string): Promise<PublishStatusResult> {
    logger.debug('TikTok: Checking publish status', { publishId });

    const response = await withRetry(
      () => this.client.post('/v2/post/publish/status/fetch/', {
        publish_id: publishId
      }),
      this.retryConfig
    );

    const data = response.data.data;

    switch (data.status) {
      case 'PUBLISH_COMPLETE':
        return {
          status: 'published',
          postIds: data.publicaly_available_post_id || []
        };
      case 'FAILED':
        return {
          status: 'failed',
          failReason: data.fail_reason
        };
      default:
        return {
          status: 'processing'
        };
    }
  }

  async waitForPublishComplete(
    publishId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<PublishStatusResult> {
    const { timeoutMs = 180000, pollIntervalMs = 5000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.checkPublishStatus(publishId);

      if (status.status !== 'processing') {
        return status;
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new TikTokError('timeout', 'Video processing timed out', false);
  }

  async getVideoInsights(videoId: string): Promise<VideoInsights> {
    logger.debug('TikTok: Fetching video insights', { videoId });

    const response = await withRetry(
      () => this.client.get('/v2/video/query/', {
        params: {
          fields: 'id,title,create_time,view_count,like_count,comment_count,share_count'
        },
        data: {
          filters: {
            video_ids: [videoId]
          }
        }
      }),
      this.retryConfig
    );

    const video = response.data.data.videos[0];

    return {
      videoId: video.id,
      title: video.title,
      viewCount: video.view_count || 0,
      likeCount: video.like_count || 0,
      commentCount: video.comment_count || 0,
      shareCount: video.share_count || 0,
      createTime: new Date(video.create_time * 1000)
    };
  }

  async deleteVideo(videoId: string): Promise<never> {
    // TikTok Content Posting API does not support video deletion
    // Videos can only be deleted through the TikTok app
    throw new TikTokError(
      'not_supported',
      'TikTok API does not support video deletion. Videos must be deleted through the TikTok app.',
      false
    );
  }

  isValidPrivacyLevel(level: string): level is PrivacyLevel {
    return PrivacyLevelSchema.safeParse(level).success;
  }

  getVideoConstraints(): typeof VIDEO_CONSTRAINTS {
    return VIDEO_CONSTRAINTS;
  }
}
```

#### 2.3 Implement Error Handling

```typescript
// packages/connectors/api/src/tiktok/errors.ts

import { TikTokErrorCodes } from './types';

export class TikTokError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'TikTokError';
  }
}

export function mapTikTokError(code: string, message: string): TikTokError {
  const errorInfo = TikTokErrorCodes[code as keyof typeof TikTokErrorCodes];

  if (!errorInfo) {
    return new TikTokError(code, message, false);
  }

  const errorMessages: Record<string, string> = {
    'auth': `TikTok auth error: ${message}`,
    'rate_limit': `TikTok rate limit: ${message}`,
    'validation': `TikTok validation error: ${message}`,
    'server': `TikTok server error: ${message}`,
    'permission': `TikTok permission error: ${message}`
  };

  return new TikTokError(
    code,
    errorMessages[errorInfo.category] || message,
    errorInfo.retryable
  );
}
```

#### 2.4 Create Factory and Export

```typescript
// packages/connectors/api/src/tiktok/index.ts

export * from './types';
export * from './tiktok-connector';
export * from './errors';

import { TikTokConnector } from './tiktok-connector';
import { TikTokConfig } from './types';
import { getSecretRef } from '@rtv/keyring';

export async function createTikTokConnector(
  clientId: string
): Promise<TikTokConnector> {
  const config: TikTokConfig = {
    clientKey: await getSecretRef(clientId, 'tiktok', 'clientKey'),
    clientSecret: await getSecretRef(clientId, 'tiktok', 'clientSecret'),
    accessToken: await getSecretRef(clientId, 'tiktok', 'accessToken'),
    openId: await getSecretRef(clientId, 'tiktok', 'openId'),
    sandbox: process.env.NODE_ENV !== 'production'
  };

  return new TikTokConnector(config);
}
```

### Phase 3: Verification

#### 3.1 Run All Tests

```bash
# Unit tests
cd packages/connectors/api
pnpm test src/tiktok --reporter=verbose --coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint src/tiktok
```

#### 3.2 Verify Contract Compliance

```bash
# Run contract tests
pnpm test:contracts --filter=tiktok
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/connectors/api/src/tiktok/types.ts` | TikTok type definitions |
| Create | `packages/connectors/api/src/tiktok/tiktok-connector.ts` | Main connector implementation |
| Create | `packages/connectors/api/src/tiktok/errors.ts` | Error handling |
| Create | `packages/connectors/api/src/tiktok/index.ts` | Public exports |
| Create | `packages/connectors/api/src/tiktok/__tests__/tiktok-connector.test.ts` | Unit tests |
| Create | `packages/connectors/api/src/tiktok/__tests__/tiktok-integration.test.ts` | Integration tests |
| Modify | `packages/connectors/api/src/index.ts` | Add TikTok exports |

---

## Acceptance Criteria

- [ ] Video upload works with chunked transfer for large files
- [ ] Video publishing from URL (pull) works
- [ ] Publish status polling returns correct states
- [ ] Video insights retrieval works
- [ ] Privacy levels are enforced
- [ ] Error handling covers all TikTok error codes
- [ ] Rate limiting is handled with retry logic
- [ ] Unit test coverage exceeds 80%
- [ ] Integration tests pass with sandbox credentials
- [ ] TypeScript compiles with no errors

---

## Test Requirements

### Unit Tests
- [ ] Initialize upload (success and failure cases)
- [ ] Chunk upload with retry on failure
- [ ] Complete video publishing flow
- [ ] URL-based publishing
- [ ] Status checking state machine
- [ ] Video insights retrieval
- [ ] Privacy level validation
- [ ] Error code mapping

### Integration Tests
- [ ] End-to-end video publish and status check
- [ ] Large file chunked upload
- [ ] Rate limit handling

### Contract Tests
- [ ] Connector implements IPlatformConnector interface
- [ ] Response shapes match expected types

---

## Security & Safety Checklist

- [ ] Access tokens never logged
- [ ] Client secrets stored only in keyring
- [ ] Sandbox mode for non-production
- [ ] Rate limits respected to prevent API bans
- [ ] Video content not logged or stored after upload
- [ ] Audit events emitted for all publish operations

---

## JSON Task Block

```json
{
  "task_id": "S3-B3",
  "name": "TikTok API Connector",
  "status": "pending",
  "dependencies": ["S1-D3", "S3-A3"],
  "blocks": ["S3-D1", "S3-D2"],
  "agent": "B",
  "sprint": 3,
  "complexity": "high",
  "package": "@rtv/connectors/api",
  "files": [
    "packages/connectors/api/src/tiktok/types.ts",
    "packages/connectors/api/src/tiktok/tiktok-connector.ts",
    "packages/connectors/api/src/tiktok/errors.ts",
    "packages/connectors/api/src/tiktok/index.ts"
  ],
  "test_files": [
    "packages/connectors/api/src/tiktok/__tests__/tiktok-connector.test.ts",
    "packages/connectors/api/src/tiktok/__tests__/tiktok-integration.test.ts"
  ],
  "estimated_loc": 550,
  "actual_loc": null,
  "started_at": null,
  "completed_at": null,
  "verified_at": null
}
```

---

## External Memory Section

```yaml
external_memory:
  episode_id: null
  started_at: null
  references:
    - type: spec
      path: docs/03-agents-tools/tool-registry.md
      sections: ["tiktok-connector"]
    - type: spec
      path: docs/09-platform-playbooks/tiktok-strategy.md
      sections: ["api-endpoints", "content-guidelines"]
  summaries_to_create:
    - topic: "TikTok Content Posting API patterns"
      scope: "chunk upload, status polling, privacy levels"
  decisions_made: []
  blockers: []
  handoff_notes: null
```

---

## Platform-Specific Notes

### TikTok API Limitations
1. **No video deletion via API** - must use app
2. **Creator marketplace compliance** required for branded content
3. **Unaudited apps** limited to private posting only
4. **Video processing** can take 1-5 minutes

### Recommended Video Specs
- **Resolution:** 1080x1920 (9:16 vertical)
- **Duration:** 15-60 seconds optimal for engagement
- **Format:** MP4 with H.264 codec
- **Audio:** AAC, 44.1kHz
