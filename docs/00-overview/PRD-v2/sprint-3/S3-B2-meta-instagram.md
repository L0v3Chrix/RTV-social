# Build Prompt: S3-B2 — Meta Instagram Connector

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S3-B2 |
| Sprint | 3 - Scheduling + Publishing |
| Agent | B - API Lane Connectors |
| Task Name | Meta Instagram Connector |
| Complexity | High |
| Status | pending |
| Estimated Tokens | 10,000 |

---

## Context

### What We're Building

The Meta Instagram Connector implements publishing to Instagram via the Instagram Graph API. It handles feed posts, carousels, reels, and stories with the two-step container creation flow.

### Why It Matters

- **Business accounts** — Official API for Instagram Business/Creator accounts
- **Rich formats** — Feed posts, carousels, reels, stories
- **Media requirements** — Strict aspect ratio and format requirements
- **Container flow** — Two-step publish process

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | API Lane | Connector architecture |
| `docs/09-platform-playbooks/meta-instagram.md` | API Reference | Endpoints and limits |

---

## Prerequisites

### Completed Tasks

| Task ID | Provides |
|---------|----------|
| S3-B1 | Facebook connector (shared auth patterns) |
| S3-A3 | Delayed execution system |

### Required Packages

```bash
pnpm add axios
pnpm add -D vitest nock
```

---

## Instructions

### Phase 1: Test First (TDD)

#### Test File: `packages/connectors/api/src/meta/__tests__/instagram-connector.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { InstagramConnector, InstagramConfig } from '../instagram-connector';
import { PostContent, PublishResult } from '../../types';

describe('InstagramConnector', () => {
  let connector: InstagramConnector;
  const config: InstagramConfig = {
    accessToken: 'test-access-token',
    instagramAccountId: 'test-ig-account-id',
    apiVersion: 'v18.0',
  };

  beforeEach(() => {
    connector = new InstagramConnector(config);
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  describe('publishFeedPost', () => {
    it('should publish a single image post', async () => {
      // Mock container creation
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media`)
        .reply(200, { id: 'container_123' });

      // Mock container status check
      nock('https://graph.facebook.com')
        .get(`/v18.0/container_123`)
        .query({ fields: 'status_code' })
        .reply(200, { status_code: 'FINISHED' });

      // Mock publish
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media_publish`)
        .reply(200, { id: 'ig_post_123' });

      const content: PostContent = {
        caption: 'Hello Instagram!',
        mediaUrls: ['https://cdn.example.com/image.jpg'],
      };

      const result = await connector.publishFeedPost(content);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('ig_post_123');
    });

    it('should handle container creation failure', async () => {
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media`)
        .reply(400, {
          error: {
            message: 'The image is too small',
            code: 36003,
            error_subcode: 2207026,
          },
        });

      const content: PostContent = {
        caption: 'Test post',
        mediaUrls: ['https://cdn.example.com/small-image.jpg'],
      };

      const result = await connector.publishFeedPost(content);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MEDIA_ERROR');
    });

    it('should wait for container processing', async () => {
      // Container creation
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media`)
        .reply(200, { id: 'container_123' });

      // First status check - still processing
      nock('https://graph.facebook.com')
        .get(`/v18.0/container_123`)
        .query({ fields: 'status_code' })
        .reply(200, { status_code: 'IN_PROGRESS' });

      // Second status check - finished
      nock('https://graph.facebook.com')
        .get(`/v18.0/container_123`)
        .query({ fields: 'status_code' })
        .reply(200, { status_code: 'FINISHED' });

      // Publish
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media_publish`)
        .reply(200, { id: 'ig_post_123' });

      const content: PostContent = {
        caption: 'Test post',
        mediaUrls: ['https://cdn.example.com/image.jpg'],
      };

      const result = await connector.publishFeedPost(content);

      expect(result.success).toBe(true);
    });
  });

  describe('publishCarousel', () => {
    it('should publish a carousel with multiple images', async () => {
      // Mock child container creation (3 images)
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media`)
        .times(3)
        .reply(200, (uri, body) => ({
          id: `child_container_${Math.random().toString(36).substr(2, 9)}`,
        }));

      // Mock carousel container creation
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media`)
        .reply(200, { id: 'carousel_container_123' });

      // Mock status check
      nock('https://graph.facebook.com')
        .get(`/v18.0/carousel_container_123`)
        .query({ fields: 'status_code' })
        .reply(200, { status_code: 'FINISHED' });

      // Mock publish
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media_publish`)
        .reply(200, { id: 'ig_carousel_123' });

      const content: PostContent = {
        caption: 'Check out these photos!',
        mediaUrls: [
          'https://cdn.example.com/image1.jpg',
          'https://cdn.example.com/image2.jpg',
          'https://cdn.example.com/image3.jpg',
        ],
      };

      const result = await connector.publishCarousel(content);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('ig_carousel_123');
    });

    it('should reject carousel with too few items', async () => {
      const content: PostContent = {
        caption: 'Single image',
        mediaUrls: ['https://cdn.example.com/image1.jpg'],
      };

      const result = await connector.publishCarousel(content);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CAROUSEL');
    });

    it('should reject carousel with too many items', async () => {
      const content: PostContent = {
        caption: 'Too many images',
        mediaUrls: Array(11).fill('https://cdn.example.com/image.jpg'),
      };

      const result = await connector.publishCarousel(content);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CAROUSEL');
    });
  });

  describe('publishReel', () => {
    it('should publish a reel', async () => {
      // Mock container creation
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media`)
        .reply(200, { id: 'reel_container_123' });

      // Mock status check
      nock('https://graph.facebook.com')
        .get(`/v18.0/reel_container_123`)
        .query({ fields: 'status_code' })
        .reply(200, { status_code: 'FINISHED' });

      // Mock publish
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media_publish`)
        .reply(200, { id: 'ig_reel_123' });

      const content: PostContent = {
        caption: 'Check out this reel!',
        mediaUrls: ['https://cdn.example.com/video.mp4'],
        thumbnailUrl: 'https://cdn.example.com/thumbnail.jpg',
      };

      const result = await connector.publishReel(content);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('ig_reel_123');
    });

    it('should include cover image if provided', async () => {
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media`, (body) => {
          return body.cover_url === 'https://cdn.example.com/cover.jpg';
        })
        .reply(200, { id: 'reel_container_123' });

      nock('https://graph.facebook.com')
        .get(`/v18.0/reel_container_123`)
        .query({ fields: 'status_code' })
        .reply(200, { status_code: 'FINISHED' });

      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media_publish`)
        .reply(200, { id: 'ig_reel_123' });

      const content: PostContent = {
        caption: 'Reel with cover',
        mediaUrls: ['https://cdn.example.com/video.mp4'],
        thumbnailUrl: 'https://cdn.example.com/cover.jpg',
      };

      const result = await connector.publishReel(content);

      expect(result.success).toBe(true);
    });
  });

  describe('publishStory', () => {
    it('should publish an image story', async () => {
      // Mock container creation
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media`)
        .reply(200, { id: 'story_container_123' });

      // Mock status check
      nock('https://graph.facebook.com')
        .get(`/v18.0/story_container_123`)
        .query({ fields: 'status_code' })
        .reply(200, { status_code: 'FINISHED' });

      // Mock publish
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media_publish`)
        .reply(200, { id: 'ig_story_123' });

      const content: PostContent = {
        mediaUrls: ['https://cdn.example.com/story-image.jpg'],
      };

      const result = await connector.publishStory(content, 'image');

      expect(result.success).toBe(true);
    });

    it('should publish a video story', async () => {
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media`)
        .reply(200, { id: 'story_container_123' });

      nock('https://graph.facebook.com')
        .get(`/v18.0/story_container_123`)
        .query({ fields: 'status_code' })
        .reply(200, { status_code: 'FINISHED' });

      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media_publish`)
        .reply(200, { id: 'ig_story_123' });

      const content: PostContent = {
        mediaUrls: ['https://cdn.example.com/story-video.mp4'],
      };

      const result = await connector.publishStory(content, 'video');

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle rate limiting', async () => {
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media`)
        .reply(429, {
          error: {
            message: 'Application request limit reached',
            code: 4,
          },
        });

      const content: PostContent = {
        caption: 'Test',
        mediaUrls: ['https://cdn.example.com/image.jpg'],
      };

      const result = await connector.publishFeedPost(content);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMIT');
      expect(result.error?.retryable).toBe(true);
    });

    it('should handle invalid media URL', async () => {
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media`)
        .reply(400, {
          error: {
            message: 'Invalid image URL',
            code: 100,
            error_subcode: 33,
          },
        });

      const content: PostContent = {
        caption: 'Test',
        mediaUrls: ['https://invalid-url.com/broken.jpg'],
      };

      const result = await connector.publishFeedPost(content);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MEDIA_ERROR');
    });

    it('should handle container timeout', async () => {
      nock('https://graph.facebook.com')
        .post(`/v18.0/test-ig-account-id/media`)
        .reply(200, { id: 'container_123' });

      // Always return IN_PROGRESS
      nock('https://graph.facebook.com')
        .get(`/v18.0/container_123`)
        .query({ fields: 'status_code' })
        .times(10)
        .reply(200, { status_code: 'IN_PROGRESS' });

      const content: PostContent = {
        caption: 'Test',
        mediaUrls: ['https://cdn.example.com/image.jpg'],
      };

      const result = await connector.publishFeedPost(content, {
        maxWaitTime: 1000,
        pollInterval: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONTAINER_TIMEOUT');
    });
  });

  describe('getMediaInsights', () => {
    it('should fetch media insights', async () => {
      nock('https://graph.facebook.com')
        .get(`/v18.0/ig_post_123/insights`)
        .query(true)
        .reply(200, {
          data: [
            { name: 'impressions', values: [{ value: 5000 }] },
            { name: 'reach', values: [{ value: 3000 }] },
            { name: 'engagement', values: [{ value: 250 }] },
            { name: 'saved', values: [{ value: 45 }] },
          ],
        });

      const insights = await connector.getMediaInsights('ig_post_123');

      expect(insights.impressions).toBe(5000);
      expect(insights.reach).toBe(3000);
      expect(insights.engagement).toBe(250);
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Implement Instagram Connector

Create `packages/connectors/api/src/meta/instagram-connector.ts`:

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import { PostContent, PublishResult, DeleteResult, PostInsights, Connector } from '../types';

export interface InstagramConfig {
  accessToken: string;
  instagramAccountId: string;
  apiVersion?: string;
}

export interface PublishOptions {
  maxWaitTime?: number;
  pollInterval?: number;
}

const GRAPH_API_URL = 'https://graph.facebook.com';
const DEFAULT_MAX_WAIT = 120000; // 2 minutes
const DEFAULT_POLL_INTERVAL = 5000; // 5 seconds

type MediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'REELS' | 'STORIES';

export class InstagramConnector implements Connector {
  private client: AxiosInstance;
  private config: InstagramConfig;

  constructor(config: InstagramConfig) {
    this.config = {
      ...config,
      apiVersion: config.apiVersion || 'v18.0',
    };

    this.client = axios.create({
      baseURL: `${GRAPH_API_URL}/${this.config.apiVersion}`,
      params: { access_token: this.config.accessToken },
    });
  }

  async verifyCredentials(): Promise<boolean> {
    try {
      await this.client.get(`/${this.config.instagramAccountId}`, {
        params: { fields: 'id,username' },
      });
      return true;
    } catch {
      return false;
    }
  }

  async publishFeedPost(
    content: PostContent,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    if (content.mediaUrls.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_MEDIA',
          message: 'Instagram requires at least one image or video',
          retryable: false,
        },
      };
    }

    // Determine if video or image
    const isVideo = this.isVideoUrl(content.mediaUrls[0]);

    try {
      // Step 1: Create container
      const containerPayload: Record<string, any> = {
        [isVideo ? 'video_url' : 'image_url']: content.mediaUrls[0],
        caption: this.formatCaption(content),
        media_type: isVideo ? 'VIDEO' : 'IMAGE',
      };

      if (content.altText) {
        containerPayload.alt_text = content.altText;
      }

      const containerResponse = await this.client.post(
        `/${this.config.instagramAccountId}/media`,
        containerPayload
      );

      const containerId = containerResponse.data.id;

      // Step 2: Wait for container to be ready
      const ready = await this.waitForContainer(containerId, options);
      if (!ready.success) {
        return ready;
      }

      // Step 3: Publish
      const publishResponse = await this.client.post(
        `/${this.config.instagramAccountId}/media_publish`,
        { creation_id: containerId }
      );

      return {
        success: true,
        platformPostId: publishResponse.data.id,
        publishedUrl: `https://instagram.com/p/${publishResponse.data.id}`,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async publishCarousel(
    content: PostContent,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    if (content.mediaUrls.length < 2) {
      return {
        success: false,
        error: {
          code: 'INVALID_CAROUSEL',
          message: 'Carousel requires at least 2 items',
          retryable: false,
        },
      };
    }

    if (content.mediaUrls.length > 10) {
      return {
        success: false,
        error: {
          code: 'INVALID_CAROUSEL',
          message: 'Carousel cannot have more than 10 items',
          retryable: false,
        },
      };
    }

    try {
      // Step 1: Create child containers
      const childIds: string[] = [];
      for (const url of content.mediaUrls) {
        const isVideo = this.isVideoUrl(url);
        const childResponse = await this.client.post(
          `/${this.config.instagramAccountId}/media`,
          {
            [isVideo ? 'video_url' : 'image_url']: url,
            is_carousel_item: true,
            media_type: isVideo ? 'VIDEO' : 'IMAGE',
          }
        );
        childIds.push(childResponse.data.id);
      }

      // Step 2: Create carousel container
      const carouselResponse = await this.client.post(
        `/${this.config.instagramAccountId}/media`,
        {
          media_type: 'CAROUSEL',
          children: childIds.join(','),
          caption: this.formatCaption(content),
        }
      );

      const containerId = carouselResponse.data.id;

      // Step 3: Wait for container
      const ready = await this.waitForContainer(containerId, options);
      if (!ready.success) {
        return ready;
      }

      // Step 4: Publish
      const publishResponse = await this.client.post(
        `/${this.config.instagramAccountId}/media_publish`,
        { creation_id: containerId }
      );

      return {
        success: true,
        platformPostId: publishResponse.data.id,
        publishedUrl: `https://instagram.com/p/${publishResponse.data.id}`,
        metadata: { type: 'carousel', itemCount: content.mediaUrls.length },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async publishReel(
    content: PostContent,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    if (content.mediaUrls.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_MEDIA',
          message: 'Reel requires a video URL',
          retryable: false,
        },
      };
    }

    try {
      const containerPayload: Record<string, any> = {
        video_url: content.mediaUrls[0],
        caption: this.formatCaption(content),
        media_type: 'REELS',
      };

      if (content.thumbnailUrl) {
        containerPayload.cover_url = content.thumbnailUrl;
      }

      const containerResponse = await this.client.post(
        `/${this.config.instagramAccountId}/media`,
        containerPayload
      );

      const containerId = containerResponse.data.id;

      const ready = await this.waitForContainer(containerId, options);
      if (!ready.success) {
        return ready;
      }

      const publishResponse = await this.client.post(
        `/${this.config.instagramAccountId}/media_publish`,
        { creation_id: containerId }
      );

      return {
        success: true,
        platformPostId: publishResponse.data.id,
        publishedUrl: `https://instagram.com/reel/${publishResponse.data.id}`,
        metadata: { type: 'reel' },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async publishStory(
    content: PostContent,
    mediaType: 'image' | 'video',
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    try {
      const containerPayload: Record<string, any> = {
        [mediaType === 'video' ? 'video_url' : 'image_url']: content.mediaUrls[0],
        media_type: 'STORIES',
      };

      const containerResponse = await this.client.post(
        `/${this.config.instagramAccountId}/media`,
        containerPayload
      );

      const containerId = containerResponse.data.id;

      const ready = await this.waitForContainer(containerId, options);
      if (!ready.success) {
        return ready;
      }

      const publishResponse = await this.client.post(
        `/${this.config.instagramAccountId}/media_publish`,
        { creation_id: containerId }
      );

      return {
        success: true,
        platformPostId: publishResponse.data.id,
        metadata: { type: 'story', mediaType },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deletePost(postId: string): Promise<DeleteResult> {
    // Instagram Graph API doesn't support deleting media via API
    // This would need to be done through the browser lane
    return {
      success: false,
      error: {
        code: 'NOT_SUPPORTED',
        message: 'Instagram API does not support media deletion',
      },
    };
  }

  async getMediaInsights(mediaId: string): Promise<PostInsights> {
    const metrics = [
      'impressions',
      'reach',
      'engagement',
      'saved',
      'video_views',
    ].join(',');

    const response = await this.client.get(`/${mediaId}/insights`, {
      params: { metric: metrics },
    });

    const data = response.data.data;
    const getValue = (name: string) =>
      data.find((m: any) => m.name === name)?.values?.[0]?.value || 0;

    return {
      impressions: getValue('impressions'),
      reach: getValue('reach'),
      engagement: getValue('engagement'),
      clicks: 0, // Not available for IG
      shares: getValue('saved'),
    };
  }

  private async waitForContainer(
    containerId: string,
    options: PublishOptions
  ): Promise<PublishResult> {
    const maxWait = options.maxWaitTime || DEFAULT_MAX_WAIT;
    const pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const statusResponse = await this.client.get(`/${containerId}`, {
        params: { fields: 'status_code' },
      });

      const status = statusResponse.data.status_code;

      if (status === 'FINISHED') {
        return { success: true };
      }

      if (status === 'ERROR') {
        return {
          success: false,
          error: {
            code: 'CONTAINER_ERROR',
            message: 'Container processing failed',
            retryable: false,
          },
        };
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }

    return {
      success: false,
      error: {
        code: 'CONTAINER_TIMEOUT',
        message: 'Container processing timed out',
        retryable: true,
      },
    };
  }

  private formatCaption(content: PostContent): string {
    let caption = content.caption || '';

    if (content.hashtags && content.hashtags.length > 0) {
      const hashtagStr = content.hashtags
        .map((h) => (h.startsWith('#') ? h : `#${h}`))
        .join(' ');
      caption = caption ? `${caption}\n\n${hashtagStr}` : hashtagStr;
    }

    return caption;
  }

  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm'];
    return videoExtensions.some((ext) => url.toLowerCase().includes(ext));
  }

  private handleError(error: unknown): PublishResult {
    const axiosError = error as AxiosError<any>;
    const igError = axiosError.response?.data?.error;

    if (!igError) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred',
          retryable: true,
        },
      };
    }

    // Map Instagram/Facebook error codes
    const errorMapping: Record<number, { code: string; retryable: boolean }> = {
      4: { code: 'RATE_LIMIT', retryable: true },
      190: { code: 'OAUTH_ERROR', retryable: false },
      100: { code: 'MEDIA_ERROR', retryable: false },
      36003: { code: 'MEDIA_ERROR', retryable: false },
    };

    const mapped = errorMapping[igError.code] || {
      code: 'API_ERROR',
      retryable: false,
    };

    return {
      success: false,
      error: {
        code: mapped.code,
        message: igError.message,
        retryable: mapped.retryable,
        details: {
          instagramErrorCode: igError.code,
          errorSubcode: igError.error_subcode,
        },
      },
    };
  }
}
```

#### Step 2: Update Meta Index

Update `packages/connectors/api/src/meta/index.ts`:

```typescript
export * from './facebook-connector';
export * from './instagram-connector';
```

### Phase 3: Verification

```bash
cd packages/connectors/api
pnpm test src/meta/__tests__/instagram-connector.test.ts
pnpm tsc --noEmit
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/connectors/api/src/meta/instagram-connector.ts` | Instagram API connector |
| Modify | `packages/connectors/api/src/meta/index.ts` | Add Instagram export |
| Create | `packages/connectors/api/src/meta/__tests__/instagram-connector.test.ts` | Tests |

---

## Acceptance Criteria

- [ ] Publishes single image posts
- [ ] Publishes carousels (2-10 items)
- [ ] Publishes reels with optional cover
- [ ] Publishes stories (image/video)
- [ ] Waits for container processing
- [ ] Handles container timeout
- [ ] Formats captions with hashtags
- [ ] Fetches media insights
- [ ] All tests pass

---

## JSON Task Block

```json
{
  "task_id": "S3-B2",
  "name": "Meta Instagram Connector",
  "status": "pending",
  "dependencies": ["S3-B1", "S3-A3"],
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
  "predecessor_summaries": [
    "S3-B1: Facebook connector with Graph API patterns"
  ]
}
```
