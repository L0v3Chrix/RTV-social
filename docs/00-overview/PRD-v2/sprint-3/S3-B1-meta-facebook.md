# Build Prompt: S3-B1 — Meta Facebook Connector

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S3-B1 |
| Sprint | 3 - Scheduling + Publishing |
| Agent | B - API Lane Connectors |
| Task Name | Meta Facebook Connector |
| Complexity | High |
| Status | pending |
| Estimated Tokens | 10,000 |

---

## Context

### What We're Building

The Meta Facebook Connector implements publishing to Facebook Pages via the Graph API. It handles feed posts, photos, videos, and stories with proper media uploads and scheduling.

### Why It Matters

- **Official API** — Reliable, sanctioned publishing
- **Rich media** — Photos, videos, carousels
- **Scheduling** — Native scheduled posts
- **Analytics** — Access to insights post-publish

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | API Lane | Connector architecture |
| `docs/09-platform-playbooks/meta-facebook.md` | API Reference | Endpoints and limits |
| `docs/05-policy-safety/content-safety-policy.md` | Compliance | Content guidelines |

---

## Prerequisites

### Completed Tasks

| Task ID | Provides |
|---------|----------|
| S3-A3 | Delayed execution system |
| S1-A1 | Client model (for credentials) |
| S0-B4 | Audit event schema |

### Required Packages

```bash
pnpm add axios form-data
pnpm add -D vitest nock
```

---

## Instructions

### Phase 1: Test First (TDD)

#### Test File: `packages/connectors/api/src/meta/__tests__/facebook-connector.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { FacebookConnector, FacebookConfig } from '../facebook-connector';
import { PublishResult, PostContent } from '../../types';

describe('FacebookConnector', () => {
  let connector: FacebookConnector;
  const config: FacebookConfig = {
    accessToken: 'test-access-token',
    pageId: 'test-page-id',
    apiVersion: 'v18.0',
  };

  beforeEach(() => {
    connector = new FacebookConnector(config);
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  describe('publishFeedPost', () => {
    it('should publish a text-only post', async () => {
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-page-id/feed`)
        .reply(200, { id: '123456789_987654321' });

      const content: PostContent = {
        caption: 'Hello from RTV!',
        mediaUrls: [],
      };

      const result = await connector.publishFeedPost(content);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('123456789_987654321');
    });

    it('should publish a post with link', async () => {
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-page-id/feed`)
        .reply(200, { id: '123456789_987654321' });

      const content: PostContent = {
        caption: 'Check this out!',
        link: 'https://example.com/article',
        mediaUrls: [],
      };

      const result = await connector.publishFeedPost(content);

      expect(result.success).toBe(true);
    });

    it('should handle API errors', async () => {
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-page-id/feed`)
        .reply(400, {
          error: {
            message: 'Invalid access token',
            type: 'OAuthException',
            code: 190,
          },
        });

      const content: PostContent = {
        caption: 'Test post',
        mediaUrls: [],
      };

      const result = await connector.publishFeedPost(content);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('OAUTH_ERROR');
      expect(result.error?.retryable).toBe(false);
    });

    it('should handle rate limiting', async () => {
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-page-id/feed`)
        .reply(429, {
          error: {
            message: 'Rate limit exceeded',
            type: 'OAuthException',
            code: 32,
          },
        });

      const content: PostContent = {
        caption: 'Test post',
        mediaUrls: [],
      };

      const result = await connector.publishFeedPost(content);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMIT');
      expect(result.error?.retryable).toBe(true);
    });
  });

  describe('publishPhoto', () => {
    it('should publish a single photo', async () => {
      // Mock photo upload
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-page-id/photos`)
        .reply(200, { id: 'photo_123', post_id: '123456789_987654321' });

      const content: PostContent = {
        caption: 'Check out this photo!',
        mediaUrls: ['https://cdn.example.com/image.jpg'],
      };

      const result = await connector.publishPhoto(content);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBeDefined();
    });

    it('should publish multiple photos as album', async () => {
      // Mock unpublished photo uploads
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-page-id/photos`)
        .times(3)
        .reply(200, (uri, body) => ({
          id: `photo_${Math.random().toString(36).substr(2, 9)}`,
        }));

      // Mock album creation
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-page-id/feed`)
        .reply(200, { id: '123456789_987654321' });

      const content: PostContent = {
        caption: 'Photo album!',
        mediaUrls: [
          'https://cdn.example.com/image1.jpg',
          'https://cdn.example.com/image2.jpg',
          'https://cdn.example.com/image3.jpg',
        ],
      };

      const result = await connector.publishPhoto(content);

      expect(result.success).toBe(true);
    });
  });

  describe('publishVideo', () => {
    it('should publish a video with resumable upload', async () => {
      // Mock video upload initialization
      nock('https://graph-video.facebook.com')
        .post(`/v18.0/test-page-id/videos`)
        .reply(200, { upload_session_id: 'session_123' });

      // Mock chunk uploads
      nock('https://graph-video.facebook.com')
        .post(`/v18.0/test-page-id/videos`)
        .reply(200, { start_offset: '1000000', end_offset: '2000000' });

      // Mock finalization
      nock('https://graph-video.facebook.com')
        .post(`/v18.0/test-page-id/videos`)
        .reply(200, { success: true, video_id: 'video_123' });

      const content: PostContent = {
        caption: 'Check out this video!',
        title: 'Amazing Video',
        mediaUrls: ['https://cdn.example.com/video.mp4'],
      };

      const result = await connector.publishVideo(content);

      expect(result.success).toBe(true);
    });

    it('should handle video processing status', async () => {
      nock('https://graph-video.facebook.com')
        .post(`/v18.0/test-page-id/videos`)
        .reply(200, { video_id: 'video_123' });

      nock('https://graph.facebook.com')
        .get(`/v18.0/video_123`)
        .query({ fields: 'status' })
        .reply(200, { status: { video_status: 'processing' } });

      const content: PostContent = {
        caption: 'Video post',
        mediaUrls: ['https://cdn.example.com/video.mp4'],
      };

      const result = await connector.publishVideo(content);

      expect(result.success).toBe(true);
      expect(result.metadata?.processingStatus).toBe('processing');
    });
  });

  describe('publishScheduled', () => {
    it('should create a scheduled post', async () => {
      const scheduledTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      nock('https://graph.facebook.com')
        .post(`/v18.0/test-page-id/feed`)
        .reply(200, { id: '123456789_987654321' });

      const content: PostContent = {
        caption: 'Scheduled post',
        mediaUrls: [],
      };

      const result = await connector.publishScheduled(content, new Date(scheduledTime * 1000));

      expect(result.success).toBe(true);
    });

    it('should reject past scheduled times', async () => {
      const pastTime = new Date(Date.now() - 3600000);

      const content: PostContent = {
        caption: 'Past post',
        mediaUrls: [],
      };

      const result = await connector.publishScheduled(content, pastTime);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SCHEDULE_TIME');
    });
  });

  describe('publishStory', () => {
    it('should publish a photo story', async () => {
      // Mock story container creation
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-page-id/photo_stories`)
        .reply(200, { id: 'story_container_123' });

      // Mock story publish
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-page-id/photo_stories`)
        .reply(200, { success: true, story_id: 'story_123' });

      const content: PostContent = {
        mediaUrls: ['https://cdn.example.com/story-image.jpg'],
      };

      const result = await connector.publishStory(content, 'photo');

      expect(result.success).toBe(true);
    });
  });

  describe('deletePost', () => {
    it('should delete a post', async () => {
      nock('https://graph.facebook.com')
        .delete(`/v18.0/123456789_987654321`)
        .reply(200, { success: true });

      const result = await connector.deletePost('123456789_987654321');

      expect(result.success).toBe(true);
    });

    it('should handle already deleted post', async () => {
      nock('https://graph.facebook.com')
        .delete(`/v18.0/123456789_987654321`)
        .reply(404, {
          error: {
            message: 'Post not found',
            code: 100,
          },
        });

      const result = await connector.deletePost('123456789_987654321');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('getPostInsights', () => {
    it('should fetch post insights', async () => {
      nock('https://graph.facebook.com')
        .get(`/v18.0/123456789_987654321/insights`)
        .query(true)
        .reply(200, {
          data: [
            { name: 'post_impressions', values: [{ value: 1500 }] },
            { name: 'post_engaged_users', values: [{ value: 120 }] },
            { name: 'post_clicks', values: [{ value: 45 }] },
          ],
        });

      const insights = await connector.getPostInsights('123456789_987654321');

      expect(insights.impressions).toBe(1500);
      expect(insights.engagement).toBe(120);
      expect(insights.clicks).toBe(45);
    });
  });

  describe('verifyCredentials', () => {
    it('should verify valid credentials', async () => {
      nock('https://graph.facebook.com')
        .get(`/v18.0/me`)
        .query({ access_token: 'test-access-token' })
        .reply(200, { id: '123', name: 'Test Page' });

      const valid = await connector.verifyCredentials();

      expect(valid).toBe(true);
    });

    it('should reject invalid credentials', async () => {
      nock('https://graph.facebook.com')
        .get(`/v18.0/me`)
        .query({ access_token: 'test-access-token' })
        .reply(401, {
          error: { message: 'Invalid token', code: 190 },
        });

      const valid = await connector.verifyCredentials();

      expect(valid).toBe(false);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Define Connector Types

Create `packages/connectors/api/src/types.ts`:

```typescript
export interface PostContent {
  caption?: string;
  title?: string;
  description?: string;
  mediaUrls: string[];
  thumbnailUrl?: string;
  link?: string;
  hashtags?: string[];
  mentions?: string[];
  altText?: string;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  publishedUrl?: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

export interface DeleteResult {
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface PostInsights {
  impressions: number;
  reach?: number;
  engagement: number;
  clicks: number;
  shares?: number;
  comments?: number;
  reactions?: number;
}

export interface ConnectorConfig {
  accessToken: string;
  apiVersion?: string;
}

export interface Connector {
  verifyCredentials(): Promise<boolean>;
  publishFeedPost(content: PostContent): Promise<PublishResult>;
  deletePost(postId: string): Promise<DeleteResult>;
}
```

#### Step 2: Implement Facebook Connector

Create `packages/connectors/api/src/meta/facebook-connector.ts`:

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import {
  PostContent,
  PublishResult,
  DeleteResult,
  PostInsights,
  Connector,
} from '../types';

export interface FacebookConfig {
  accessToken: string;
  pageId: string;
  apiVersion?: string;
}

const GRAPH_API_URL = 'https://graph.facebook.com';
const VIDEO_API_URL = 'https://graph-video.facebook.com';

export class FacebookConnector implements Connector {
  private client: AxiosInstance;
  private videoClient: AxiosInstance;
  private config: FacebookConfig;

  constructor(config: FacebookConfig) {
    this.config = {
      ...config,
      apiVersion: config.apiVersion || 'v18.0',
    };

    this.client = axios.create({
      baseURL: `${GRAPH_API_URL}/${this.config.apiVersion}`,
      params: { access_token: this.config.accessToken },
    });

    this.videoClient = axios.create({
      baseURL: `${VIDEO_API_URL}/${this.config.apiVersion}`,
      params: { access_token: this.config.accessToken },
    });
  }

  async verifyCredentials(): Promise<boolean> {
    try {
      await this.client.get('/me');
      return true;
    } catch {
      return false;
    }
  }

  async publishFeedPost(content: PostContent): Promise<PublishResult> {
    try {
      const payload: Record<string, string> = {};

      if (content.caption) {
        payload.message = content.caption;
      }

      if (content.link) {
        payload.link = content.link;
      }

      const response = await this.client.post(
        `/${this.config.pageId}/feed`,
        payload
      );

      return {
        success: true,
        platformPostId: response.data.id,
        publishedUrl: `https://facebook.com/${response.data.id}`,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async publishPhoto(content: PostContent): Promise<PublishResult> {
    try {
      if (content.mediaUrls.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_MEDIA',
            message: 'At least one image URL is required',
            retryable: false,
          },
        };
      }

      if (content.mediaUrls.length === 1) {
        // Single photo
        const response = await this.client.post(
          `/${this.config.pageId}/photos`,
          {
            url: content.mediaUrls[0],
            caption: content.caption,
          }
        );

        return {
          success: true,
          platformPostId: response.data.post_id || response.data.id,
          publishedUrl: `https://facebook.com/${response.data.post_id || response.data.id}`,
        };
      }

      // Multiple photos - create as album
      const photoIds: string[] = [];

      for (const url of content.mediaUrls) {
        const response = await this.client.post(
          `/${this.config.pageId}/photos`,
          {
            url,
            published: false, // Upload unpublished
          }
        );
        photoIds.push(response.data.id);
      }

      // Create feed post with attached photos
      const attachedMedia = photoIds.map((id) => ({
        media_fbid: id,
      }));

      const response = await this.client.post(`/${this.config.pageId}/feed`, {
        message: content.caption,
        attached_media: attachedMedia,
      });

      return {
        success: true,
        platformPostId: response.data.id,
        publishedUrl: `https://facebook.com/${response.data.id}`,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async publishVideo(content: PostContent): Promise<PublishResult> {
    try {
      if (content.mediaUrls.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_MEDIA',
            message: 'Video URL is required',
            retryable: false,
          },
        };
      }

      const videoUrl = content.mediaUrls[0];

      // Use file_url for remote video
      const response = await this.videoClient.post(
        `/${this.config.pageId}/videos`,
        {
          file_url: videoUrl,
          title: content.title,
          description: content.caption || content.description,
        }
      );

      const videoId = response.data.video_id || response.data.id;

      // Check processing status
      const statusResponse = await this.client.get(`/${videoId}`, {
        params: { fields: 'status' },
      });

      return {
        success: true,
        platformPostId: videoId,
        publishedUrl: `https://facebook.com/${videoId}`,
        metadata: {
          processingStatus: statusResponse.data.status?.video_status,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async publishScheduled(
    content: PostContent,
    scheduledTime: Date
  ): Promise<PublishResult> {
    const now = Date.now();
    const scheduleTimestamp = Math.floor(scheduledTime.getTime() / 1000);

    // Facebook requires at least 10 minutes in future, max 6 months
    const minTime = Math.floor(now / 1000) + 600;
    const maxTime = Math.floor(now / 1000) + 15552000;

    if (scheduleTimestamp < minTime) {
      return {
        success: false,
        error: {
          code: 'INVALID_SCHEDULE_TIME',
          message: 'Scheduled time must be at least 10 minutes in the future',
          retryable: false,
        },
      };
    }

    if (scheduleTimestamp > maxTime) {
      return {
        success: false,
        error: {
          code: 'INVALID_SCHEDULE_TIME',
          message: 'Scheduled time cannot be more than 6 months in the future',
          retryable: false,
        },
      };
    }

    try {
      const payload: Record<string, any> = {
        message: content.caption,
        published: false,
        scheduled_publish_time: scheduleTimestamp,
      };

      if (content.link) {
        payload.link = content.link;
      }

      const response = await this.client.post(
        `/${this.config.pageId}/feed`,
        payload
      );

      return {
        success: true,
        platformPostId: response.data.id,
        metadata: {
          scheduled: true,
          scheduledTime: scheduledTime.toISOString(),
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async publishStory(
    content: PostContent,
    mediaType: 'photo' | 'video'
  ): Promise<PublishResult> {
    try {
      const endpoint =
        mediaType === 'photo' ? 'photo_stories' : 'video_stories';

      // Create story container
      const containerResponse = await this.client.post(
        `/${this.config.pageId}/${endpoint}`,
        {
          [mediaType === 'photo' ? 'photo_url' : 'video_url']:
            content.mediaUrls[0],
        }
      );

      return {
        success: true,
        platformPostId: containerResponse.data.story_id || containerResponse.data.id,
        metadata: { type: 'story', mediaType },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deletePost(postId: string): Promise<DeleteResult> {
    try {
      await this.client.delete(`/${postId}`);
      return { success: true };
    } catch (error) {
      const axiosError = error as AxiosError<any>;
      if (axiosError.response?.status === 404) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Post not found or already deleted',
          },
        };
      }
      return {
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: axiosError.response?.data?.error?.message || 'Delete failed',
        },
      };
    }
  }

  async getPostInsights(postId: string): Promise<PostInsights> {
    const metrics = [
      'post_impressions',
      'post_engaged_users',
      'post_clicks',
      'post_reactions_by_type_total',
    ].join(',');

    const response = await this.client.get(`/${postId}/insights`, {
      params: { metric: metrics },
    });

    const data = response.data.data;
    const getValue = (name: string) =>
      data.find((m: any) => m.name === name)?.values?.[0]?.value || 0;

    return {
      impressions: getValue('post_impressions'),
      engagement: getValue('post_engaged_users'),
      clicks: getValue('post_clicks'),
      reactions: getValue('post_reactions_by_type_total'),
    };
  }

  private handleError(error: unknown): PublishResult {
    const axiosError = error as AxiosError<any>;
    const fbError = axiosError.response?.data?.error;

    if (!fbError) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred',
          retryable: true,
        },
      };
    }

    // Map Facebook error codes
    const errorMapping: Record<number, { code: string; retryable: boolean }> = {
      190: { code: 'OAUTH_ERROR', retryable: false },
      100: { code: 'INVALID_PARAMETER', retryable: false },
      200: { code: 'PERMISSION_ERROR', retryable: false },
      32: { code: 'RATE_LIMIT', retryable: true },
      1: { code: 'UNKNOWN_ERROR', retryable: true },
      2: { code: 'SERVICE_ERROR', retryable: true },
    };

    const mapped = errorMapping[fbError.code] || {
      code: 'API_ERROR',
      retryable: false,
    };

    return {
      success: false,
      error: {
        code: mapped.code,
        message: fbError.message,
        retryable: mapped.retryable,
        details: { facebookErrorCode: fbError.code, type: fbError.type },
      },
    };
  }
}
```

#### Step 3: Export Module

Create `packages/connectors/api/src/meta/index.ts`:

```typescript
export * from './facebook-connector';
```

### Phase 3: Verification

```bash
cd packages/connectors/api
pnpm test src/meta/__tests__/facebook-connector.test.ts
pnpm tsc --noEmit
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/connectors/api/src/types.ts` | Shared connector types |
| Create | `packages/connectors/api/src/meta/facebook-connector.ts` | Facebook API connector |
| Create | `packages/connectors/api/src/meta/index.ts` | Module exports |
| Create | `packages/connectors/api/src/meta/__tests__/facebook-connector.test.ts` | Tests |

---

## Acceptance Criteria

- [ ] Publishes text posts to Facebook Page
- [ ] Publishes single photos
- [ ] Publishes multi-photo albums
- [ ] Publishes videos with processing status
- [ ] Creates scheduled posts
- [ ] Publishes stories
- [ ] Deletes posts
- [ ] Fetches post insights
- [ ] Handles API errors with correct codes
- [ ] Identifies retryable vs permanent errors
- [ ] All tests pass

---

## JSON Task Block

```json
{
  "task_id": "S3-B1",
  "name": "Meta Facebook Connector",
  "status": "pending",
  "dependencies": ["S3-A3"],
  "blocks": ["S3-D1"],
  "complexity": "high",
  "agent": "B",
  "sprint": 3,
  "package": "@rtv/connectors/api"
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "token_budget": 10000,
  "tokens_used": 0,
  "context_refs": [
    "spec://docs/09-platform-playbooks/meta-facebook.md"
  ],
  "predecessor_summaries": [
    "S3-A3: Delayed execution with BullMQ"
  ]
}
```
