# Build Prompt: S3-B5 — LinkedIn API Connector

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S3-B5 |
| **Sprint** | 3 — Scheduling + Publishing |
| **Agent** | B — API Lane Connectors |
| **Task Name** | LinkedIn API Connector |
| **Complexity** | Medium |
| **Status** | Pending |
| **Estimated Effort** | 1 day |
| **Dependencies** | S1-D3, S3-A3 |
| **Blocks** | S3-D1, S3-D2 |

---

## Context

### What We're Building

A LinkedIn Marketing API connector that implements post publishing (text, images, documents, articles), company page management, and engagement analytics retrieval.

### Why It Matters

LinkedIn is the primary B2B social platform with high organic reach for professional content. Proper integration enables scheduled posting to personal profiles and company pages with rich media support.

### Spec References

- `docs/01-architecture/system-architecture-v3.md` — Connector patterns
- `docs/03-agents-tools/tool-registry.md` — External tool contracts
- `docs/09-platform-playbooks/linkedin-strategy.md` — LinkedIn best practices
- `docs/05-policy-safety/compliance-spec.md` — Content guidelines

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

- LinkedIn Developer Account
- LinkedIn App with Marketing Developer Platform access
- OAuth 2.0 credentials with required scopes
- Test Company Page for sandbox testing

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests before implementation.

#### 1.1 Create LinkedIn Connector Test Suite

```typescript
// packages/connectors/api/src/linkedin/__tests__/linkedin-connector.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { LinkedInConnector } from '../linkedin-connector';
import { LinkedInConfig, PostContent, MediaAsset } from '../types';

describe('LinkedInConnector', () => {
  let connector: LinkedInConnector;
  const testConfig: LinkedInConfig = {
    accessToken: 'test-access-token',
    personUrn: 'urn:li:person:ABC123',
    organizationUrn: 'urn:li:organization:DEF456'
  };

  beforeEach(() => {
    connector = new LinkedInConnector(testConfig);
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    vi.clearAllMocks();
  });

  describe('publishTextPost', () => {
    it('should publish text-only post to personal profile', async () => {
      nock('https://api.linkedin.com')
        .post('/v2/ugcPosts')
        .reply(201, {}, {
          'x-restli-id': 'urn:li:share:123456'
        });

      const result = await connector.publishTextPost({
        text: 'Test post content',
        author: testConfig.personUrn,
        visibility: 'PUBLIC'
      });

      expect(result.shareUrn).toBe('urn:li:share:123456');
      expect(result.success).toBe(true);
    });

    it('should publish text post to company page', async () => {
      nock('https://api.linkedin.com')
        .post('/v2/ugcPosts')
        .reply(201, {}, {
          'x-restli-id': 'urn:li:share:789012'
        });

      const result = await connector.publishTextPost({
        text: 'Company update',
        author: testConfig.organizationUrn,
        visibility: 'PUBLIC'
      });

      expect(result.shareUrn).toBe('urn:li:share:789012');
    });

    it('should handle rate limiting', async () => {
      nock('https://api.linkedin.com')
        .post('/v2/ugcPosts')
        .reply(429, {
          message: 'Rate limit exceeded',
          status: 429
        });

      await expect(connector.publishTextPost({
        text: 'Test',
        author: testConfig.personUrn,
        visibility: 'PUBLIC'
      })).rejects.toThrow('LinkedIn rate limit');
    });

    it('should handle authentication errors', async () => {
      nock('https://api.linkedin.com')
        .post('/v2/ugcPosts')
        .reply(401, {
          message: 'Expired access token',
          status: 401
        });

      await expect(connector.publishTextPost({
        text: 'Test',
        author: testConfig.personUrn,
        visibility: 'PUBLIC'
      })).rejects.toThrow('LinkedIn auth error');
    });
  });

  describe('publishImagePost', () => {
    it('should upload image and publish post', async () => {
      // Register upload
      nock('https://api.linkedin.com')
        .post('/v2/assets?action=registerUpload')
        .reply(200, {
          value: {
            uploadMechanism: {
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                uploadUrl: 'https://api.linkedin.com/upload/image123'
              }
            },
            asset: 'urn:li:digitalmediaAsset:ABC123'
          }
        });

      // Upload binary
      nock('https://api.linkedin.com')
        .put('/upload/image123')
        .reply(201);

      // Publish post with image
      nock('https://api.linkedin.com')
        .post('/v2/ugcPosts')
        .reply(201, {}, {
          'x-restli-id': 'urn:li:share:456789'
        });

      const result = await connector.publishImagePost({
        text: 'Check out this image!',
        author: testConfig.personUrn,
        visibility: 'PUBLIC',
        imageBuffer: Buffer.alloc(1000),
        imageTitle: 'Test Image'
      });

      expect(result.shareUrn).toBe('urn:li:share:456789');
      expect(result.mediaAssets).toHaveLength(1);
    });

    it('should publish multi-image post', async () => {
      // Register uploads for multiple images
      nock('https://api.linkedin.com')
        .post('/v2/assets?action=registerUpload')
        .times(3)
        .reply(200, {
          value: {
            uploadMechanism: {
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                uploadUrl: 'https://api.linkedin.com/upload/img'
              }
            },
            asset: 'urn:li:digitalmediaAsset:IMG'
          }
        });

      nock('https://api.linkedin.com')
        .put('/upload/img')
        .times(3)
        .reply(201);

      nock('https://api.linkedin.com')
        .post('/v2/ugcPosts')
        .reply(201, {}, {
          'x-restli-id': 'urn:li:share:multi123'
        });

      const result = await connector.publishMultiImagePost({
        text: 'Multiple images',
        author: testConfig.personUrn,
        visibility: 'PUBLIC',
        images: [
          { buffer: Buffer.alloc(1000), title: 'Image 1' },
          { buffer: Buffer.alloc(1000), title: 'Image 2' },
          { buffer: Buffer.alloc(1000), title: 'Image 3' }
        ]
      });

      expect(result.shareUrn).toBe('urn:li:share:multi123');
      expect(result.mediaAssets).toHaveLength(3);
    });
  });

  describe('publishDocumentPost', () => {
    it('should upload document and publish post', async () => {
      // Register upload
      nock('https://api.linkedin.com')
        .post('/v2/assets?action=registerUpload')
        .reply(200, {
          value: {
            uploadMechanism: {
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                uploadUrl: 'https://api.linkedin.com/upload/doc123'
              }
            },
            asset: 'urn:li:digitalmediaAsset:DOC123'
          }
        });

      // Upload binary
      nock('https://api.linkedin.com')
        .put('/upload/doc123')
        .reply(201);

      // Check asset status
      nock('https://api.linkedin.com')
        .get('/v2/assets/urn:li:digitalmediaAsset:DOC123')
        .reply(200, {
          recipes: [{
            status: 'AVAILABLE'
          }]
        });

      // Publish post
      nock('https://api.linkedin.com')
        .post('/v2/ugcPosts')
        .reply(201, {}, {
          'x-restli-id': 'urn:li:share:doc456'
        });

      const result = await connector.publishDocumentPost({
        text: 'Check out this PDF',
        author: testConfig.personUrn,
        visibility: 'PUBLIC',
        documentBuffer: Buffer.alloc(5000),
        documentTitle: 'Quarterly Report.pdf'
      });

      expect(result.shareUrn).toBe('urn:li:share:doc456');
    });
  });

  describe('publishArticle', () => {
    it('should publish article with thumbnail', async () => {
      nock('https://api.linkedin.com')
        .post('/v2/ugcPosts')
        .reply(201, {}, {
          'x-restli-id': 'urn:li:share:article123'
        });

      const result = await connector.publishArticle({
        text: 'Check out this article',
        author: testConfig.personUrn,
        visibility: 'PUBLIC',
        articleUrl: 'https://example.com/article',
        articleTitle: 'Great Article',
        articleDescription: 'A must-read article'
      });

      expect(result.shareUrn).toBe('urn:li:share:article123');
    });
  });

  describe('deletePost', () => {
    it('should delete post by URN', async () => {
      nock('https://api.linkedin.com')
        .delete('/v2/ugcPosts/urn:li:share:123456')
        .reply(204);

      const result = await connector.deletePost('urn:li:share:123456');

      expect(result.success).toBe(true);
    });

    it('should handle post not found', async () => {
      nock('https://api.linkedin.com')
        .delete('/v2/ugcPosts/urn:li:share:nonexistent')
        .reply(404, {
          message: 'Resource not found',
          status: 404
        });

      await expect(connector.deletePost('urn:li:share:nonexistent'))
        .rejects.toThrow('Post not found');
    });
  });

  describe('getPostAnalytics', () => {
    it('should fetch share statistics', async () => {
      nock('https://api.linkedin.com')
        .get('/v2/socialActions/urn:li:share:123456')
        .reply(200, {
          likesSummary: { totalLikes: 50 },
          commentsSummary: { totalFirstLevelComments: 10 }
        });

      nock('https://api.linkedin.com')
        .get('/v2/shares/urn:li:share:123456')
        .query(true)
        .reply(200, {
          totalShareStatistics: {
            uniqueImpressionsCount: 1000,
            shareCount: 5,
            clickCount: 100,
            engagement: 0.15
          }
        });

      const stats = await connector.getPostAnalytics('urn:li:share:123456');

      expect(stats.likes).toBe(50);
      expect(stats.comments).toBe(10);
      expect(stats.impressions).toBe(1000);
      expect(stats.shares).toBe(5);
    });
  });

  describe('getOrganizationInfo', () => {
    it('should fetch organization details', async () => {
      nock('https://api.linkedin.com')
        .get('/v2/organizations/DEF456')
        .reply(200, {
          id: 'DEF456',
          localizedName: 'Test Company',
          vanityName: 'testcompany'
        });

      const info = await connector.getOrganizationInfo('DEF456');

      expect(info.name).toBe('Test Company');
      expect(info.vanityName).toBe('testcompany');
    });
  });

  describe('uploadMedia', () => {
    it('should handle upload failure', async () => {
      nock('https://api.linkedin.com')
        .post('/v2/assets?action=registerUpload')
        .reply(200, {
          value: {
            uploadMechanism: {
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                uploadUrl: 'https://api.linkedin.com/upload/fail'
              }
            },
            asset: 'urn:li:digitalmediaAsset:FAIL'
          }
        });

      nock('https://api.linkedin.com')
        .put('/upload/fail')
        .reply(500, { message: 'Upload failed' });

      await expect(connector.uploadImage(Buffer.alloc(1000), testConfig.personUrn))
        .rejects.toThrow('Media upload failed');
    });

    it('should wait for asset processing', async () => {
      nock('https://api.linkedin.com')
        .post('/v2/assets?action=registerUpload')
        .reply(200, {
          value: {
            uploadMechanism: {
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                uploadUrl: 'https://api.linkedin.com/upload/process'
              }
            },
            asset: 'urn:li:digitalmediaAsset:PROCESS'
          }
        });

      nock('https://api.linkedin.com')
        .put('/upload/process')
        .reply(201);

      // First check: processing
      nock('https://api.linkedin.com')
        .get('/v2/assets/urn:li:digitalmediaAsset:PROCESS')
        .reply(200, {
          recipes: [{ status: 'PROCESSING' }]
        });

      // Second check: available
      nock('https://api.linkedin.com')
        .get('/v2/assets/urn:li:digitalmediaAsset:PROCESS')
        .reply(200, {
          recipes: [{ status: 'AVAILABLE' }]
        });

      const asset = await connector.uploadImage(
        Buffer.alloc(1000),
        testConfig.personUrn,
        { waitForProcessing: true }
      );

      expect(asset.assetUrn).toBe('urn:li:digitalmediaAsset:PROCESS');
    });
  });

  describe('visibility options', () => {
    it('should validate visibility settings', () => {
      expect(connector.isValidVisibility('PUBLIC')).toBe(true);
      expect(connector.isValidVisibility('CONNECTIONS')).toBe(true);
      expect(connector.isValidVisibility('LOGGED_IN')).toBe(true);
      expect(connector.isValidVisibility('INVALID')).toBe(false);
    });
  });
});
```

**Run tests to confirm they fail:**

```bash
cd packages/connectors/api
pnpm test src/linkedin --reporter=verbose
```

### Phase 2: Implementation

#### 2.1 Create LinkedIn Types

```typescript
// packages/connectors/api/src/linkedin/types.ts

import { z } from 'zod';

export const LinkedInConfigSchema = z.object({
  accessToken: z.string().min(1),
  personUrn: z.string().regex(/^urn:li:person:[A-Za-z0-9_-]+$/),
  organizationUrn: z.string().regex(/^urn:li:organization:\d+$/).optional(),
  refreshToken: z.string().optional()
});

export type LinkedInConfig = z.infer<typeof LinkedInConfigSchema>;

export const VisibilitySchema = z.enum([
  'PUBLIC',
  'CONNECTIONS',
  'LOGGED_IN'
]);

export type Visibility = z.infer<typeof VisibilitySchema>;

export const MediaTypeSchema = z.enum([
  'IMAGE',
  'DOCUMENT',
  'VIDEO',
  'ARTICLE'
]);

export type MediaType = z.infer<typeof MediaTypeSchema>;

export interface TextPostParams {
  text: string;
  author: string; // personUrn or organizationUrn
  visibility: Visibility;
}

export interface ImagePostParams extends TextPostParams {
  imageBuffer: Buffer;
  imageTitle?: string;
  imageDescription?: string;
}

export interface MultiImagePostParams extends TextPostParams {
  images: Array<{
    buffer: Buffer;
    title?: string;
    description?: string;
  }>;
}

export interface DocumentPostParams extends TextPostParams {
  documentBuffer: Buffer;
  documentTitle: string;
}

export interface ArticlePostParams extends TextPostParams {
  articleUrl: string;
  articleTitle?: string;
  articleDescription?: string;
  thumbnailUrl?: string;
}

export interface MediaAsset {
  assetUrn: string;
  uploadUrl?: string;
  status: 'UPLOADING' | 'PROCESSING' | 'AVAILABLE' | 'FAILED';
}

export interface PostResult {
  shareUrn: string;
  success: boolean;
  mediaAssets?: MediaAsset[];
}

export interface PostAnalytics {
  shareUrn: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  clicks: number;
  engagement: number;
}

export interface OrganizationInfo {
  id: string;
  name: string;
  vanityName: string;
  logoUrl?: string;
  description?: string;
}

export const LinkedInErrorCodes = {
  'EXPIRED_ACCESS_TOKEN': { category: 'auth', retryable: false },
  'INVALID_ACCESS_TOKEN': { category: 'auth', retryable: false },
  'RATE_LIMIT_EXCEEDED': { category: 'rate_limit', retryable: true },
  'RESOURCE_NOT_FOUND': { category: 'not_found', retryable: false },
  'PERMISSION_DENIED': { category: 'permission', retryable: false },
  'INVALID_REQUEST': { category: 'validation', retryable: false },
  'SERVER_ERROR': { category: 'server', retryable: true },
  'CONTENT_BLOCKED': { category: 'content', retryable: false }
} as const;

export const POST_CONSTRAINTS = {
  maxTextLength: 3000,
  maxHashtags: 30,
  maxMentions: 50,
  maxImages: 9,
  maxImageSize: 8 * 1024 * 1024, // 8MB
  maxDocumentSize: 100 * 1024 * 1024, // 100MB
  supportedImageFormats: ['jpg', 'jpeg', 'png', 'gif'],
  supportedDocumentFormats: ['pdf', 'ppt', 'pptx', 'doc', 'docx']
} as const;
```

#### 2.2 Implement LinkedIn Connector

```typescript
// packages/connectors/api/src/linkedin/linkedin-connector.ts

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  LinkedInConfig,
  LinkedInConfigSchema,
  Visibility,
  VisibilitySchema,
  TextPostParams,
  ImagePostParams,
  MultiImagePostParams,
  DocumentPostParams,
  ArticlePostParams,
  MediaAsset,
  PostResult,
  PostAnalytics,
  OrganizationInfo,
  POST_CONSTRAINTS
} from './types';
import { LinkedInError, mapLinkedInError } from './errors';
import { logger } from '@rtv/observability';
import { withRetry, RetryConfig } from '../shared/retry';

export class LinkedInConnector {
  private readonly client: AxiosInstance;
  private readonly config: LinkedInConfig;
  private readonly retryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableErrors: ['rate_limit', 'server']
  };

  constructor(config: LinkedInConfig) {
    this.config = LinkedInConfigSchema.parse(config);

    this.client = axios.create({
      baseURL: 'https://api.linkedin.com/v2',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202401'
      },
      timeout: 30000
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const status = error.response?.status;
        const data = error.response?.data as any;

        if (status === 429) {
          throw new LinkedInError('RATE_LIMIT_EXCEEDED', 'LinkedIn rate limit exceeded', true);
        }
        if (status === 401) {
          throw new LinkedInError('EXPIRED_ACCESS_TOKEN', 'LinkedIn auth error: token expired', false);
        }
        if (status === 404) {
          throw new LinkedInError('RESOURCE_NOT_FOUND', 'Post not found', false);
        }

        throw mapLinkedInError(data?.message || error.message);
      }
    );
  }

  async publishTextPost(params: TextPostParams): Promise<PostResult> {
    this.validateText(params.text);

    logger.info('LinkedIn: Publishing text post', {
      author: params.author,
      visibility: params.visibility,
      textLength: params.text.length
    });

    const response = await withRetry(
      () => this.client.post('/ugcPosts', {
        author: params.author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: params.text
            },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': params.visibility
        }
      }),
      this.retryConfig
    );

    const shareUrn = response.headers['x-restli-id'] as string;

    return {
      shareUrn,
      success: true
    };
  }

  async publishImagePost(params: ImagePostParams): Promise<PostResult> {
    this.validateText(params.text);

    logger.info('LinkedIn: Publishing image post', {
      author: params.author,
      imageSize: params.imageBuffer.length
    });

    // Upload image first
    const asset = await this.uploadImage(params.imageBuffer, params.author);

    // Wait for processing
    await this.waitForAssetProcessing(asset.assetUrn);

    // Publish post with image
    const response = await withRetry(
      () => this.client.post('/ugcPosts', {
        author: params.author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: params.text
            },
            shareMediaCategory: 'IMAGE',
            media: [{
              status: 'READY',
              description: {
                text: params.imageDescription || ''
              },
              media: asset.assetUrn,
              title: {
                text: params.imageTitle || ''
              }
            }]
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': params.visibility
        }
      }),
      this.retryConfig
    );

    return {
      shareUrn: response.headers['x-restli-id'] as string,
      success: true,
      mediaAssets: [asset]
    };
  }

  async publishMultiImagePost(params: MultiImagePostParams): Promise<PostResult> {
    this.validateText(params.text);

    if (params.images.length > POST_CONSTRAINTS.maxImages) {
      throw new LinkedInError(
        'INVALID_REQUEST',
        `Maximum ${POST_CONSTRAINTS.maxImages} images allowed`,
        false
      );
    }

    logger.info('LinkedIn: Publishing multi-image post', {
      author: params.author,
      imageCount: params.images.length
    });

    // Upload all images in parallel
    const assets = await Promise.all(
      params.images.map(img => this.uploadImage(img.buffer, params.author))
    );

    // Wait for all to process
    await Promise.all(assets.map(a => this.waitForAssetProcessing(a.assetUrn)));

    // Publish post with all images
    const response = await withRetry(
      () => this.client.post('/ugcPosts', {
        author: params.author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: params.text
            },
            shareMediaCategory: 'IMAGE',
            media: assets.map((asset, i) => ({
              status: 'READY',
              description: { text: params.images[i].description || '' },
              media: asset.assetUrn,
              title: { text: params.images[i].title || '' }
            }))
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': params.visibility
        }
      }),
      this.retryConfig
    );

    return {
      shareUrn: response.headers['x-restli-id'] as string,
      success: true,
      mediaAssets: assets
    };
  }

  async publishDocumentPost(params: DocumentPostParams): Promise<PostResult> {
    this.validateText(params.text);

    logger.info('LinkedIn: Publishing document post', {
      author: params.author,
      documentTitle: params.documentTitle,
      documentSize: params.documentBuffer.length
    });

    // Upload document
    const asset = await this.uploadDocument(
      params.documentBuffer,
      params.author,
      params.documentTitle
    );

    // Wait for processing
    await this.waitForAssetProcessing(asset.assetUrn);

    // Publish post
    const response = await withRetry(
      () => this.client.post('/ugcPosts', {
        author: params.author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: params.text
            },
            shareMediaCategory: 'DOCUMENT',
            media: [{
              status: 'READY',
              media: asset.assetUrn,
              title: {
                text: params.documentTitle
              }
            }]
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': params.visibility
        }
      }),
      this.retryConfig
    );

    return {
      shareUrn: response.headers['x-restli-id'] as string,
      success: true,
      mediaAssets: [asset]
    };
  }

  async publishArticle(params: ArticlePostParams): Promise<PostResult> {
    this.validateText(params.text);

    logger.info('LinkedIn: Publishing article share', {
      author: params.author,
      articleUrl: params.articleUrl
    });

    const response = await withRetry(
      () => this.client.post('/ugcPosts', {
        author: params.author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: params.text
            },
            shareMediaCategory: 'ARTICLE',
            media: [{
              status: 'READY',
              originalUrl: params.articleUrl,
              title: {
                text: params.articleTitle || ''
              },
              description: {
                text: params.articleDescription || ''
              }
            }]
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': params.visibility
        }
      }),
      this.retryConfig
    );

    return {
      shareUrn: response.headers['x-restli-id'] as string,
      success: true
    };
  }

  async uploadImage(
    buffer: Buffer,
    owner: string,
    options: { waitForProcessing?: boolean } = {}
  ): Promise<MediaAsset> {
    if (buffer.length > POST_CONSTRAINTS.maxImageSize) {
      throw new LinkedInError(
        'INVALID_REQUEST',
        `Image exceeds maximum size of ${POST_CONSTRAINTS.maxImageSize / (1024 * 1024)}MB`,
        false
      );
    }

    // Register upload
    const registerResponse = await this.client.post('/assets?action=registerUpload', {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner,
        serviceRelationships: [{
          relationshipType: 'OWNER',
          identifier: 'urn:li:userGeneratedContent'
        }]
      }
    });

    const uploadData = registerResponse.data.value;
    const uploadUrl = uploadData.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const assetUrn = uploadData.asset;

    // Upload binary
    try {
      await axios.put(uploadUrl, buffer, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/octet-stream'
        }
      });
    } catch (error) {
      throw new LinkedInError('UPLOAD_FAILED', 'Media upload failed', true);
    }

    const asset: MediaAsset = {
      assetUrn,
      uploadUrl,
      status: 'PROCESSING'
    };

    if (options.waitForProcessing) {
      await this.waitForAssetProcessing(assetUrn);
      asset.status = 'AVAILABLE';
    }

    return asset;
  }

  async uploadDocument(
    buffer: Buffer,
    owner: string,
    title: string
  ): Promise<MediaAsset> {
    if (buffer.length > POST_CONSTRAINTS.maxDocumentSize) {
      throw new LinkedInError(
        'INVALID_REQUEST',
        `Document exceeds maximum size of ${POST_CONSTRAINTS.maxDocumentSize / (1024 * 1024)}MB`,
        false
      );
    }

    const registerResponse = await this.client.post('/assets?action=registerUpload', {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-document'],
        owner,
        serviceRelationships: [{
          relationshipType: 'OWNER',
          identifier: 'urn:li:userGeneratedContent'
        }],
        supportedUploadMechanism: ['SYNCHRONOUS_UPLOAD']
      }
    });

    const uploadData = registerResponse.data.value;
    const uploadUrl = uploadData.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const assetUrn = uploadData.asset;

    await axios.put(uploadUrl, buffer, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/octet-stream'
      }
    });

    return {
      assetUrn,
      uploadUrl,
      status: 'PROCESSING'
    };
  }

  private async waitForAssetProcessing(
    assetUrn: string,
    timeoutMs: number = 60000
  ): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < timeoutMs) {
      const response = await this.client.get(`/assets/${encodeURIComponent(assetUrn)}`);
      const status = response.data.recipes?.[0]?.status;

      if (status === 'AVAILABLE') {
        return;
      }

      if (status === 'FAILED') {
        throw new LinkedInError('UPLOAD_FAILED', 'Asset processing failed', false);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new LinkedInError('TIMEOUT', 'Asset processing timed out', true);
  }

  async deletePost(shareUrn: string): Promise<{ success: boolean }> {
    logger.info('LinkedIn: Deleting post', { shareUrn });

    await withRetry(
      () => this.client.delete(`/ugcPosts/${encodeURIComponent(shareUrn)}`),
      this.retryConfig
    );

    return { success: true };
  }

  async getPostAnalytics(shareUrn: string): Promise<PostAnalytics> {
    logger.debug('LinkedIn: Fetching post analytics', { shareUrn });

    const [socialActions, shareStats] = await Promise.all([
      this.client.get(`/socialActions/${encodeURIComponent(shareUrn)}`),
      this.client.get(`/shares/${encodeURIComponent(shareUrn)}`, {
        params: { fields: 'totalShareStatistics' }
      })
    ]);

    const stats = shareStats.data.totalShareStatistics || {};

    return {
      shareUrn,
      likes: socialActions.data.likesSummary?.totalLikes || 0,
      comments: socialActions.data.commentsSummary?.totalFirstLevelComments || 0,
      shares: stats.shareCount || 0,
      impressions: stats.uniqueImpressionsCount || 0,
      clicks: stats.clickCount || 0,
      engagement: stats.engagement || 0
    };
  }

  async getOrganizationInfo(organizationId: string): Promise<OrganizationInfo> {
    logger.debug('LinkedIn: Fetching organization info', { organizationId });

    const response = await this.client.get(`/organizations/${organizationId}`);

    return {
      id: response.data.id,
      name: response.data.localizedName,
      vanityName: response.data.vanityName,
      logoUrl: response.data.logoV2?.original,
      description: response.data.localizedDescription
    };
  }

  private validateText(text: string): void {
    if (text.length > POST_CONSTRAINTS.maxTextLength) {
      throw new LinkedInError(
        'INVALID_REQUEST',
        `Text exceeds maximum length of ${POST_CONSTRAINTS.maxTextLength}`,
        false
      );
    }
  }

  isValidVisibility(visibility: string): visibility is Visibility {
    return VisibilitySchema.safeParse(visibility).success;
  }

  getPostConstraints(): typeof POST_CONSTRAINTS {
    return POST_CONSTRAINTS;
  }
}
```

#### 2.3 Implement Error Handling

```typescript
// packages/connectors/api/src/linkedin/errors.ts

import { LinkedInErrorCodes } from './types';

export class LinkedInError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'LinkedInError';
  }
}

export function mapLinkedInError(message: string): LinkedInError {
  // Parse error message to determine type
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('rate limit')) {
    return new LinkedInError('RATE_LIMIT_EXCEEDED', `LinkedIn rate limit: ${message}`, true);
  }
  if (lowerMessage.includes('token') || lowerMessage.includes('auth')) {
    return new LinkedInError('EXPIRED_ACCESS_TOKEN', `LinkedIn auth error: ${message}`, false);
  }
  if (lowerMessage.includes('not found')) {
    return new LinkedInError('RESOURCE_NOT_FOUND', message, false);
  }
  if (lowerMessage.includes('permission') || lowerMessage.includes('forbidden')) {
    return new LinkedInError('PERMISSION_DENIED', `LinkedIn permission error: ${message}`, false);
  }

  return new LinkedInError('UNKNOWN', message, false);
}
```

#### 2.4 Create Factory and Export

```typescript
// packages/connectors/api/src/linkedin/index.ts

export * from './types';
export * from './linkedin-connector';
export * from './errors';

import { LinkedInConnector } from './linkedin-connector';
import { LinkedInConfig } from './types';
import { getSecretRef } from '@rtv/keyring';

export async function createLinkedInConnector(
  clientId: string
): Promise<LinkedInConnector> {
  const config: LinkedInConfig = {
    accessToken: await getSecretRef(clientId, 'linkedin', 'accessToken'),
    personUrn: await getSecretRef(clientId, 'linkedin', 'personUrn'),
    organizationUrn: await getSecretRef(clientId, 'linkedin', 'organizationUrn')
  };

  return new LinkedInConnector(config);
}
```

### Phase 3: Verification

```bash
# Unit tests
cd packages/connectors/api
pnpm test src/linkedin --reporter=verbose --coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint src/linkedin
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/connectors/api/src/linkedin/types.ts` | LinkedIn type definitions |
| Create | `packages/connectors/api/src/linkedin/linkedin-connector.ts` | Main connector implementation |
| Create | `packages/connectors/api/src/linkedin/errors.ts` | Error handling |
| Create | `packages/connectors/api/src/linkedin/index.ts` | Public exports |
| Create | `packages/connectors/api/src/linkedin/__tests__/linkedin-connector.test.ts` | Unit tests |
| Modify | `packages/connectors/api/src/index.ts` | Add LinkedIn exports |

---

## Acceptance Criteria

- [ ] Text post publishing works for profiles and company pages
- [ ] Single and multi-image posts work
- [ ] Document (PDF) posts work
- [ ] Article sharing with link preview works
- [ ] Post deletion works
- [ ] Analytics retrieval works
- [ ] Media upload handles processing wait
- [ ] Rate limiting handled with retry
- [ ] Unit test coverage exceeds 80%

---

## JSON Task Block

```json
{
  "task_id": "S3-B5",
  "name": "LinkedIn API Connector",
  "status": "pending",
  "dependencies": ["S1-D3", "S3-A3"],
  "blocks": ["S3-D1", "S3-D2"],
  "agent": "B",
  "sprint": 3,
  "complexity": "medium",
  "package": "@rtv/connectors/api",
  "files": [
    "packages/connectors/api/src/linkedin/types.ts",
    "packages/connectors/api/src/linkedin/linkedin-connector.ts",
    "packages/connectors/api/src/linkedin/errors.ts",
    "packages/connectors/api/src/linkedin/index.ts"
  ],
  "test_files": [
    "packages/connectors/api/src/linkedin/__tests__/linkedin-connector.test.ts"
  ],
  "estimated_loc": 500,
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
      sections: ["linkedin-connector"]
    - type: spec
      path: docs/09-platform-playbooks/linkedin-strategy.md
      sections: ["api-endpoints", "content-guidelines"]
  summaries_to_create:
    - topic: "LinkedIn Marketing API patterns"
      scope: "UGC posts, media upload, visibility"
  decisions_made: []
  blockers: []
  handoff_notes: null
```
