# Build Prompt: S3-B4 — YouTube API Connector

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S3-B4 |
| **Sprint** | 3 — Scheduling + Publishing |
| **Agent** | B — API Lane Connectors |
| **Task Name** | YouTube API Connector |
| **Complexity** | High |
| **Status** | Pending |
| **Estimated Effort** | 1.5 days |
| **Dependencies** | S1-D3, S3-A3 |
| **Blocks** | S3-D1, S3-D2 |

---

## Context

### What We're Building

A YouTube Data API v3 connector that implements video uploads, Shorts publishing, playlist management, video metadata updates, and analytics retrieval with resumable upload support.

### Why It Matters

YouTube is the second-largest search engine and primary long-form video platform. Proper integration enables scheduled publishing, SEO optimization through metadata, and community engagement features.

### Spec References

- `docs/01-architecture/system-architecture-v3.md` — Connector patterns
- `docs/03-agents-tools/tool-registry.md` — External tool contracts
- `docs/09-platform-playbooks/youtube-strategy.md` — YouTube best practices
- `docs/05-policy-safety/compliance-spec.md` — Content guidelines

---

## Prerequisites

### Completed Tasks

- [x] S1-D3: Tool wrapper with retry policies
- [x] S3-A3: Delayed execution engine

### Required Tools/Packages

```bash
pnpm add googleapis @google-cloud/local-auth
pnpm add -D nock vitest
```

### Required Accounts/Access

- Google Cloud Project with YouTube Data API v3 enabled
- OAuth 2.0 credentials (web application type)
- Test YouTube channel for sandbox testing

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests before implementation.

#### 1.1 Create YouTube Connector Test Suite

```typescript
// packages/connectors/api/src/youtube/__tests__/youtube-connector.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { YouTubeConnector } from '../youtube-connector';
import { YouTubeConfig, VideoUploadParams, VideoMetadata } from '../types';

describe('YouTubeConnector', () => {
  let connector: YouTubeConnector;
  const testConfig: YouTubeConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    channelId: 'UC123456789'
  };

  beforeEach(() => {
    connector = new YouTubeConnector(testConfig);
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    vi.clearAllMocks();
  });

  describe('uploadVideo', () => {
    it('should upload video using resumable upload', async () => {
      // Mock resumable upload initiation
      nock('https://www.googleapis.com')
        .post('/upload/youtube/v3/videos')
        .query(true)
        .reply(200, '', {
          'Location': 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=xyz123'
        });

      // Mock actual upload
      nock('https://www.googleapis.com')
        .put('/upload/youtube/v3/videos')
        .query(true)
        .reply(200, {
          id: 'video123',
          snippet: {
            title: 'Test Video',
            description: 'Test description',
            publishedAt: '2024-01-15T10:00:00Z'
          },
          status: {
            uploadStatus: 'uploaded',
            privacyStatus: 'private'
          }
        });

      const result = await connector.uploadVideo({
        videoBuffer: Buffer.alloc(1000),
        metadata: {
          title: 'Test Video',
          description: 'Test description',
          tags: ['test', 'video'],
          categoryId: '22',
          privacyStatus: 'private'
        }
      });

      expect(result.videoId).toBe('video123');
      expect(result.status).toBe('uploaded');
    });

    it('should handle upload quota exceeded', async () => {
      nock('https://www.googleapis.com')
        .post('/upload/youtube/v3/videos')
        .query(true)
        .reply(403, {
          error: {
            code: 403,
            message: 'The request cannot be completed because you have exceeded your quota.',
            errors: [{
              domain: 'youtube.quota',
              reason: 'quotaExceeded'
            }]
          }
        });

      await expect(connector.uploadVideo({
        videoBuffer: Buffer.alloc(1000),
        metadata: {
          title: 'Test',
          description: 'Test',
          categoryId: '22',
          privacyStatus: 'private'
        }
      })).rejects.toThrow('YouTube quota exceeded');
    });

    it('should resume failed upload', async () => {
      const uploadUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=xyz123';

      // First request fails
      nock('https://www.googleapis.com')
        .put('/upload/youtube/v3/videos')
        .query(true)
        .reply(500);

      // Check upload status
      nock('https://www.googleapis.com')
        .put('/upload/youtube/v3/videos')
        .query(true)
        .matchHeader('Content-Range', 'bytes */1000')
        .reply(308, '', { 'Range': 'bytes=0-499' });

      // Resume upload
      nock('https://www.googleapis.com')
        .put('/upload/youtube/v3/videos')
        .query(true)
        .reply(200, {
          id: 'video123',
          status: { uploadStatus: 'uploaded' }
        });

      const result = await connector.resumeUpload({
        uploadUrl,
        videoBuffer: Buffer.alloc(1000),
        startByte: 500
      });

      expect(result.videoId).toBe('video123');
    });
  });

  describe('uploadShort', () => {
    it('should upload video as YouTube Short', async () => {
      nock('https://www.googleapis.com')
        .post('/upload/youtube/v3/videos')
        .query(true)
        .reply(200, '', {
          'Location': 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=xyz123'
        });

      nock('https://www.googleapis.com')
        .put('/upload/youtube/v3/videos')
        .query(true)
        .reply(200, {
          id: 'short123',
          snippet: { title: '#Shorts Test Video' },
          status: { uploadStatus: 'uploaded' }
        });

      const result = await connector.uploadShort({
        videoBuffer: Buffer.alloc(1000),
        metadata: {
          title: 'Test Short',
          description: 'Short description #Shorts',
          tags: ['shorts'],
          privacyStatus: 'public'
        }
      });

      expect(result.videoId).toBe('short123');
      expect(result.isShort).toBe(true);
    });

    it('should reject videos too long for Shorts', async () => {
      // Mock video that's too long (over 60 seconds)
      await expect(connector.uploadShort({
        videoBuffer: Buffer.alloc(1000),
        metadata: {
          title: 'Test',
          description: 'Test',
          privacyStatus: 'public'
        },
        duration: 90 // 90 seconds
      })).rejects.toThrow('Video duration exceeds Shorts limit');
    });
  });

  describe('updateVideoMetadata', () => {
    it('should update video title and description', async () => {
      nock('https://www.googleapis.com')
        .put('/youtube/v3/videos')
        .query(true)
        .reply(200, {
          id: 'video123',
          snippet: {
            title: 'Updated Title',
            description: 'Updated description'
          }
        });

      const result = await connector.updateVideoMetadata('video123', {
        title: 'Updated Title',
        description: 'Updated description'
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should update privacy status', async () => {
      nock('https://www.googleapis.com')
        .put('/youtube/v3/videos')
        .query(true)
        .reply(200, {
          id: 'video123',
          status: { privacyStatus: 'public' }
        });

      const result = await connector.updateVideoMetadata('video123', {
        privacyStatus: 'public'
      });

      expect(result.privacyStatus).toBe('public');
    });
  });

  describe('scheduleVideo', () => {
    it('should set video to publish at specific time', async () => {
      const publishAt = new Date('2024-02-01T10:00:00Z');

      nock('https://www.googleapis.com')
        .put('/youtube/v3/videos')
        .query(true)
        .reply(200, {
          id: 'video123',
          status: {
            privacyStatus: 'private',
            publishAt: publishAt.toISOString()
          }
        });

      const result = await connector.scheduleVideo('video123', publishAt);

      expect(result.scheduledFor).toEqual(publishAt);
    });
  });

  describe('deleteVideo', () => {
    it('should delete video by ID', async () => {
      nock('https://www.googleapis.com')
        .delete('/youtube/v3/videos')
        .query({ id: 'video123' })
        .reply(204);

      const result = await connector.deleteVideo('video123');

      expect(result.success).toBe(true);
    });

    it('should handle video not found', async () => {
      nock('https://www.googleapis.com')
        .delete('/youtube/v3/videos')
        .query({ id: 'nonexistent' })
        .reply(404, {
          error: {
            code: 404,
            message: 'Video not found'
          }
        });

      await expect(connector.deleteVideo('nonexistent'))
        .rejects.toThrow('Video not found');
    });
  });

  describe('getVideoAnalytics', () => {
    it('should fetch video statistics', async () => {
      nock('https://www.googleapis.com')
        .get('/youtube/v3/videos')
        .query(true)
        .reply(200, {
          items: [{
            id: 'video123',
            statistics: {
              viewCount: '10000',
              likeCount: '500',
              dislikeCount: '10',
              commentCount: '50'
            }
          }]
        });

      const stats = await connector.getVideoAnalytics('video123');

      expect(stats.viewCount).toBe(10000);
      expect(stats.likeCount).toBe(500);
      expect(stats.commentCount).toBe(50);
    });
  });

  describe('playlist management', () => {
    it('should create playlist', async () => {
      nock('https://www.googleapis.com')
        .post('/youtube/v3/playlists')
        .query(true)
        .reply(200, {
          id: 'playlist123',
          snippet: { title: 'Test Playlist' }
        });

      const result = await connector.createPlaylist({
        title: 'Test Playlist',
        description: 'Test description',
        privacyStatus: 'public'
      });

      expect(result.playlistId).toBe('playlist123');
    });

    it('should add video to playlist', async () => {
      nock('https://www.googleapis.com')
        .post('/youtube/v3/playlistItems')
        .query(true)
        .reply(200, {
          id: 'playlistItem123',
          snippet: {
            playlistId: 'playlist123',
            resourceId: { videoId: 'video123' }
          }
        });

      const result = await connector.addToPlaylist('playlist123', 'video123');

      expect(result.success).toBe(true);
    });
  });

  describe('token refresh', () => {
    it('should refresh access token when expired', async () => {
      // First request fails with 401
      nock('https://www.googleapis.com')
        .get('/youtube/v3/videos')
        .query(true)
        .reply(401, {
          error: {
            code: 401,
            message: 'Invalid Credentials'
          }
        });

      // Token refresh
      nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {
          access_token: 'new-access-token',
          expires_in: 3600
        });

      // Retry request with new token
      nock('https://www.googleapis.com')
        .get('/youtube/v3/videos')
        .query(true)
        .reply(200, { items: [{ id: 'video123' }] });

      const result = await connector.getVideoAnalytics('video123');

      expect(result).toBeDefined();
    });
  });

  describe('rate limiting', () => {
    it('should handle rate limit with exponential backoff', async () => {
      nock('https://www.googleapis.com')
        .post('/upload/youtube/v3/videos')
        .query(true)
        .reply(429, {
          error: {
            code: 429,
            message: 'Rate limit exceeded'
          }
        })
        .post('/upload/youtube/v3/videos')
        .query(true)
        .reply(200, '', {
          'Location': 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=xyz'
        });

      // Should succeed after retry
      const result = await connector.uploadVideo({
        videoBuffer: Buffer.alloc(100),
        metadata: {
          title: 'Test',
          description: 'Test',
          categoryId: '22',
          privacyStatus: 'private'
        }
      });

      expect(result).toBeDefined();
    });
  });
});
```

**Run tests to confirm they fail:**

```bash
cd packages/connectors/api
pnpm test src/youtube --reporter=verbose
```

### Phase 2: Implementation

#### 2.1 Create YouTube Types

```typescript
// packages/connectors/api/src/youtube/types.ts

import { z } from 'zod';

export const YouTubeConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  channelId: z.string().min(1),
  apiKey: z.string().optional()
});

export type YouTubeConfig = z.infer<typeof YouTubeConfigSchema>;

export const PrivacyStatusSchema = z.enum([
  'public',
  'private',
  'unlisted'
]);

export type PrivacyStatus = z.infer<typeof PrivacyStatusSchema>;

export const VideoCategorySchema = z.enum([
  '1',  // Film & Animation
  '2',  // Autos & Vehicles
  '10', // Music
  '15', // Pets & Animals
  '17', // Sports
  '19', // Travel & Events
  '20', // Gaming
  '22', // People & Blogs
  '23', // Comedy
  '24', // Entertainment
  '25', // News & Politics
  '26', // Howto & Style
  '27', // Education
  '28', // Science & Technology
  '29'  // Nonprofits & Activism
]);

export const VideoMetadataSchema = z.object({
  title: z.string().max(100),
  description: z.string().max(5000),
  tags: z.array(z.string()).max(500).optional(),
  categoryId: VideoCategorySchema,
  privacyStatus: PrivacyStatusSchema,
  publishAt: z.date().optional(),
  defaultLanguage: z.string().default('en'),
  madeForKids: z.boolean().default(false),
  selfDeclaredMadeForKids: z.boolean().optional(),
  notifySubscribers: z.boolean().default(true)
});

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

export interface VideoUploadParams {
  videoBuffer: Buffer;
  metadata: VideoMetadata;
  thumbnailBuffer?: Buffer;
}

export interface ShortUploadParams extends VideoUploadParams {
  duration?: number; // seconds, max 60
}

export interface VideoUploadResult {
  videoId: string;
  status: 'uploaded' | 'processing' | 'failed';
  uploadUrl?: string;
  isShort?: boolean;
}

export interface ResumeUploadParams {
  uploadUrl: string;
  videoBuffer: Buffer;
  startByte: number;
}

export interface VideoUpdateResult {
  videoId: string;
  title?: string;
  description?: string;
  privacyStatus?: PrivacyStatus;
  scheduledFor?: Date;
}

export interface VideoStatistics {
  videoId: string;
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  favoriteCount: number;
}

export interface PlaylistParams {
  title: string;
  description?: string;
  privacyStatus: PrivacyStatus;
  defaultLanguage?: string;
}

export interface PlaylistResult {
  playlistId: string;
  title: string;
}

export const YouTubeErrorCodes = {
  'quotaExceeded': { category: 'quota', retryable: false },
  'uploadLimitExceeded': { category: 'quota', retryable: false },
  'rateLimitExceeded': { category: 'rate_limit', retryable: true },
  'forbidden': { category: 'auth', retryable: false },
  'unauthorized': { category: 'auth', retryable: true }, // Can retry after refresh
  'notFound': { category: 'not_found', retryable: false },
  'badRequest': { category: 'validation', retryable: false },
  'videoNotFound': { category: 'not_found', retryable: false },
  'processingFailure': { category: 'processing', retryable: true },
  'uploadAborted': { category: 'upload', retryable: true }
} as const;

export const VIDEO_CONSTRAINTS = {
  maxFileSize: 256 * 1024 * 1024 * 1024, // 256GB
  maxDuration: 12 * 60 * 60, // 12 hours
  shortsMaxDuration: 60, // 60 seconds
  shortsRecommendedAspect: '9:16',
  supportedFormats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', '3gp'],
  maxTitleLength: 100,
  maxDescriptionLength: 5000,
  maxTags: 500,
  maxTagLength: 500,
  resumableChunkSize: 256 * 1024 // 256KB minimum
} as const;
```

#### 2.2 Implement YouTube Connector

```typescript
// packages/connectors/api/src/youtube/youtube-connector.ts

import { google, youtube_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import {
  YouTubeConfig,
  YouTubeConfigSchema,
  VideoMetadata,
  VideoMetadataSchema,
  VideoUploadParams,
  ShortUploadParams,
  VideoUploadResult,
  ResumeUploadParams,
  VideoUpdateResult,
  VideoStatistics,
  PlaylistParams,
  PlaylistResult,
  VIDEO_CONSTRAINTS
} from './types';
import { YouTubeError, mapYouTubeError } from './errors';
import { logger } from '@rtv/observability';
import { Readable } from 'stream';

export class YouTubeConnector {
  private readonly youtube: youtube_v3.Youtube;
  private readonly oauth2Client: OAuth2Client;
  private readonly config: YouTubeConfig;
  private accessToken: string;

  constructor(config: YouTubeConfig) {
    this.config = YouTubeConfigSchema.parse(config);
    this.accessToken = config.accessToken;

    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret
    );

    this.oauth2Client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken
    });

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client
    });

    this.setupTokenRefresh();
  }

  private setupTokenRefresh(): void {
    this.oauth2Client.on('tokens', (tokens) => {
      if (tokens.access_token) {
        this.accessToken = tokens.access_token;
        logger.info('YouTube: Access token refreshed');
      }
    });
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    const tokenInfo = this.oauth2Client.credentials;
    const expiryDate = tokenInfo.expiry_date;

    if (expiryDate && Date.now() >= expiryDate - 60000) {
      logger.info('YouTube: Refreshing access token');
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
    }
  }

  async uploadVideo(params: VideoUploadParams): Promise<VideoUploadResult> {
    const metadata = VideoMetadataSchema.parse(params.metadata);

    logger.info('YouTube: Starting video upload', {
      title: metadata.title,
      size: params.videoBuffer.length,
      privacyStatus: metadata.privacyStatus
    });

    await this.refreshTokenIfNeeded();

    try {
      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        notifySubscribers: metadata.notifySubscribers,
        requestBody: {
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags,
            categoryId: metadata.categoryId,
            defaultLanguage: metadata.defaultLanguage
          },
          status: {
            privacyStatus: metadata.privacyStatus,
            publishAt: metadata.publishAt?.toISOString(),
            selfDeclaredMadeForKids: metadata.selfDeclaredMadeForKids ?? metadata.madeForKids
          }
        },
        media: {
          body: Readable.from(params.videoBuffer)
        }
      }, {
        // Resumable upload options
        onUploadProgress: (evt) => {
          const progress = (evt.bytesRead / params.videoBuffer.length) * 100;
          logger.debug('YouTube: Upload progress', { progress: progress.toFixed(1) });
        }
      });

      const videoId = response.data.id!;

      // Upload thumbnail if provided
      if (params.thumbnailBuffer) {
        await this.setThumbnail(videoId, params.thumbnailBuffer);
      }

      return {
        videoId,
        status: 'uploaded'
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async uploadShort(params: ShortUploadParams): Promise<VideoUploadResult> {
    if (params.duration && params.duration > VIDEO_CONSTRAINTS.shortsMaxDuration) {
      throw new YouTubeError(
        'duration_exceeded',
        `Video duration exceeds Shorts limit of ${VIDEO_CONSTRAINTS.shortsMaxDuration} seconds`,
        false
      );
    }

    // Ensure #Shorts in title or description for algorithm recognition
    const metadata = { ...params.metadata };
    if (!metadata.title.toLowerCase().includes('#shorts')) {
      metadata.description = `${metadata.description || ''} #Shorts`.trim();
    }

    const result = await this.uploadVideo({
      videoBuffer: params.videoBuffer,
      metadata,
      thumbnailBuffer: params.thumbnailBuffer
    });

    return {
      ...result,
      isShort: true
    };
  }

  async resumeUpload(params: ResumeUploadParams): Promise<VideoUploadResult> {
    logger.info('YouTube: Resuming upload', { startByte: params.startByte });

    const remainingBuffer = params.videoBuffer.slice(params.startByte);

    const response = await fetch(params.uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Length': remainingBuffer.length.toString(),
        'Content-Range': `bytes ${params.startByte}-${params.videoBuffer.length - 1}/${params.videoBuffer.length}`
      },
      body: remainingBuffer
    });

    if (!response.ok) {
      throw new YouTubeError('upload_failed', 'Resume upload failed', true);
    }

    const data = await response.json();

    return {
      videoId: data.id,
      status: 'uploaded'
    };
  }

  async setThumbnail(videoId: string, thumbnailBuffer: Buffer): Promise<void> {
    logger.debug('YouTube: Setting custom thumbnail', { videoId });

    await this.youtube.thumbnails.set({
      videoId,
      media: {
        body: Readable.from(thumbnailBuffer)
      }
    });
  }

  async updateVideoMetadata(
    videoId: string,
    updates: Partial<VideoMetadata>
  ): Promise<VideoUpdateResult> {
    logger.info('YouTube: Updating video metadata', { videoId });

    await this.refreshTokenIfNeeded();

    try {
      // First, get current video data
      const current = await this.youtube.videos.list({
        part: ['snippet', 'status'],
        id: [videoId]
      });

      if (!current.data.items?.length) {
        throw new YouTubeError('not_found', 'Video not found', false);
      }

      const video = current.data.items[0];

      // Merge updates with current data
      const response = await this.youtube.videos.update({
        part: ['snippet', 'status'],
        requestBody: {
          id: videoId,
          snippet: {
            ...video.snippet,
            title: updates.title ?? video.snippet?.title,
            description: updates.description ?? video.snippet?.description,
            tags: updates.tags ?? video.snippet?.tags,
            categoryId: updates.categoryId ?? video.snippet?.categoryId
          },
          status: {
            ...video.status,
            privacyStatus: updates.privacyStatus ?? video.status?.privacyStatus
          }
        }
      });

      return {
        videoId,
        title: response.data.snippet?.title || undefined,
        description: response.data.snippet?.description || undefined,
        privacyStatus: response.data.status?.privacyStatus as any
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async scheduleVideo(videoId: string, publishAt: Date): Promise<VideoUpdateResult> {
    logger.info('YouTube: Scheduling video', { videoId, publishAt });

    await this.refreshTokenIfNeeded();

    try {
      const response = await this.youtube.videos.update({
        part: ['status'],
        requestBody: {
          id: videoId,
          status: {
            privacyStatus: 'private',
            publishAt: publishAt.toISOString()
          }
        }
      });

      return {
        videoId,
        privacyStatus: 'private',
        scheduledFor: new Date(response.data.status?.publishAt || publishAt)
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async deleteVideo(videoId: string): Promise<{ success: boolean }> {
    logger.info('YouTube: Deleting video', { videoId });

    await this.refreshTokenIfNeeded();

    try {
      await this.youtube.videos.delete({
        id: videoId
      });

      return { success: true };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getVideoAnalytics(videoId: string): Promise<VideoStatistics> {
    logger.debug('YouTube: Fetching video analytics', { videoId });

    await this.refreshTokenIfNeeded();

    try {
      const response = await this.youtube.videos.list({
        part: ['statistics'],
        id: [videoId]
      });

      const video = response.data.items?.[0];
      if (!video) {
        throw new YouTubeError('not_found', 'Video not found', false);
      }

      const stats = video.statistics!;

      return {
        videoId,
        viewCount: parseInt(stats.viewCount || '0', 10),
        likeCount: parseInt(stats.likeCount || '0', 10),
        dislikeCount: parseInt(stats.dislikeCount || '0', 10),
        commentCount: parseInt(stats.commentCount || '0', 10),
        favoriteCount: parseInt(stats.favoriteCount || '0', 10)
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async createPlaylist(params: PlaylistParams): Promise<PlaylistResult> {
    logger.info('YouTube: Creating playlist', { title: params.title });

    await this.refreshTokenIfNeeded();

    try {
      const response = await this.youtube.playlists.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: params.title,
            description: params.description,
            defaultLanguage: params.defaultLanguage
          },
          status: {
            privacyStatus: params.privacyStatus
          }
        }
      });

      return {
        playlistId: response.data.id!,
        title: response.data.snippet?.title || params.title
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async addToPlaylist(
    playlistId: string,
    videoId: string
  ): Promise<{ success: boolean }> {
    logger.info('YouTube: Adding video to playlist', { playlistId, videoId });

    await this.refreshTokenIfNeeded();

    try {
      await this.youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId
            }
          }
        }
      });

      return { success: true };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async removeFromPlaylist(playlistItemId: string): Promise<{ success: boolean }> {
    logger.info('YouTube: Removing item from playlist', { playlistItemId });

    await this.refreshTokenIfNeeded();

    try {
      await this.youtube.playlistItems.delete({
        id: playlistItemId
      });

      return { success: true };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getChannelInfo(): Promise<{
    channelId: string;
    title: string;
    subscriberCount: number;
  }> {
    await this.refreshTokenIfNeeded();

    const response = await this.youtube.channels.list({
      part: ['snippet', 'statistics'],
      id: [this.config.channelId]
    });

    const channel = response.data.items?.[0];
    if (!channel) {
      throw new YouTubeError('not_found', 'Channel not found', false);
    }

    return {
      channelId: channel.id!,
      title: channel.snippet?.title || '',
      subscriberCount: parseInt(channel.statistics?.subscriberCount || '0', 10)
    };
  }

  private handleError(error: any): YouTubeError {
    if (error instanceof YouTubeError) {
      return error;
    }

    const apiError = error.errors?.[0] || error;
    return mapYouTubeError(apiError.reason || 'unknown', apiError.message || error.message);
  }

  getVideoConstraints(): typeof VIDEO_CONSTRAINTS {
    return VIDEO_CONSTRAINTS;
  }
}
```

#### 2.3 Implement Error Handling

```typescript
// packages/connectors/api/src/youtube/errors.ts

import { YouTubeErrorCodes } from './types';

export class YouTubeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'YouTubeError';
  }
}

export function mapYouTubeError(code: string, message: string): YouTubeError {
  const errorInfo = YouTubeErrorCodes[code as keyof typeof YouTubeErrorCodes];

  if (!errorInfo) {
    return new YouTubeError(code, message, false);
  }

  const errorMessages: Record<string, string> = {
    'quota': `YouTube quota exceeded: ${message}`,
    'rate_limit': `YouTube rate limit: ${message}`,
    'auth': `YouTube auth error: ${message}`,
    'not_found': `YouTube resource not found: ${message}`,
    'validation': `YouTube validation error: ${message}`,
    'processing': `YouTube processing error: ${message}`,
    'upload': `YouTube upload error: ${message}`
  };

  return new YouTubeError(
    code,
    errorMessages[errorInfo.category] || message,
    errorInfo.retryable
  );
}
```

#### 2.4 Create Factory and Export

```typescript
// packages/connectors/api/src/youtube/index.ts

export * from './types';
export * from './youtube-connector';
export * from './errors';

import { YouTubeConnector } from './youtube-connector';
import { YouTubeConfig } from './types';
import { getSecretRef } from '@rtv/keyring';

export async function createYouTubeConnector(
  clientId: string
): Promise<YouTubeConnector> {
  const config: YouTubeConfig = {
    clientId: await getSecretRef(clientId, 'youtube', 'clientId'),
    clientSecret: await getSecretRef(clientId, 'youtube', 'clientSecret'),
    accessToken: await getSecretRef(clientId, 'youtube', 'accessToken'),
    refreshToken: await getSecretRef(clientId, 'youtube', 'refreshToken'),
    channelId: await getSecretRef(clientId, 'youtube', 'channelId')
  };

  return new YouTubeConnector(config);
}
```

### Phase 3: Verification

#### 3.1 Run All Tests

```bash
# Unit tests
cd packages/connectors/api
pnpm test src/youtube --reporter=verbose --coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint src/youtube
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/connectors/api/src/youtube/types.ts` | YouTube type definitions |
| Create | `packages/connectors/api/src/youtube/youtube-connector.ts` | Main connector implementation |
| Create | `packages/connectors/api/src/youtube/errors.ts` | Error handling |
| Create | `packages/connectors/api/src/youtube/index.ts` | Public exports |
| Create | `packages/connectors/api/src/youtube/__tests__/youtube-connector.test.ts` | Unit tests |
| Modify | `packages/connectors/api/src/index.ts` | Add YouTube exports |

---

## Acceptance Criteria

- [ ] Video upload with resumable upload works
- [ ] Shorts upload with duration validation works
- [ ] Video metadata update works
- [ ] Video scheduling works
- [ ] Video deletion works
- [ ] Analytics retrieval works
- [ ] Playlist management works
- [ ] Token refresh handles expiration
- [ ] Rate limiting handled with backoff
- [ ] Unit test coverage exceeds 80%

---

## Test Requirements

### Unit Tests
- [ ] Video upload (success, quota exceeded, resume)
- [ ] Shorts upload with duration validation
- [ ] Metadata update operations
- [ ] Video scheduling
- [ ] Video deletion (success, not found)
- [ ] Analytics retrieval
- [ ] Playlist CRUD operations
- [ ] Token refresh flow
- [ ] Rate limit handling

### Integration Tests
- [ ] End-to-end video upload
- [ ] Shorts upload and verification
- [ ] Playlist creation and video addition

---

## Security & Safety Checklist

- [ ] OAuth tokens never logged
- [ ] Refresh tokens stored in keyring
- [ ] Automatic token refresh before expiration
- [ ] Rate limits respected
- [ ] Quota usage monitored
- [ ] Audit events for all publish operations

---

## JSON Task Block

```json
{
  "task_id": "S3-B4",
  "name": "YouTube API Connector",
  "status": "pending",
  "dependencies": ["S1-D3", "S3-A3"],
  "blocks": ["S3-D1", "S3-D2"],
  "agent": "B",
  "sprint": 3,
  "complexity": "high",
  "package": "@rtv/connectors/api",
  "files": [
    "packages/connectors/api/src/youtube/types.ts",
    "packages/connectors/api/src/youtube/youtube-connector.ts",
    "packages/connectors/api/src/youtube/errors.ts",
    "packages/connectors/api/src/youtube/index.ts"
  ],
  "test_files": [
    "packages/connectors/api/src/youtube/__tests__/youtube-connector.test.ts"
  ],
  "estimated_loc": 650,
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
      sections: ["youtube-connector"]
    - type: spec
      path: docs/09-platform-playbooks/youtube-strategy.md
      sections: ["api-endpoints", "content-guidelines"]
  summaries_to_create:
    - topic: "YouTube Data API v3 patterns"
      scope: "resumable upload, OAuth refresh, Shorts requirements"
  decisions_made: []
  blockers: []
  handoff_notes: null
```

---

## Platform-Specific Notes

### YouTube API Quotas
- Default: 10,000 units/day
- Video upload: 1,600 units
- Video update: 50 units
- List operations: 1 unit
- Monitor usage via Google Cloud Console

### Shorts Requirements
- Max duration: 60 seconds
- Aspect ratio: 9:16 (vertical)
- Add #Shorts to title or description
- Resolution: 1080x1920 recommended
