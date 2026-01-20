# Build Prompt: S3-B6 — X (Twitter) API Connector

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S3-B6 |
| **Sprint** | 3 — Scheduling + Publishing |
| **Agent** | B — API Lane Connectors |
| **Task Name** | X (Twitter) API Connector |
| **Complexity** | Medium |
| **Status** | Pending |
| **Estimated Effort** | 1 day |
| **Dependencies** | S1-D3, S3-A3 |
| **Blocks** | S3-D1, S3-D2 |

---

## Context

### What We're Building

An X (Twitter) API v2 connector that implements tweet publishing (text, media, polls), thread creation, reply management, and engagement analytics retrieval.

### Why It Matters

X remains a critical platform for real-time engagement, thought leadership, and viral content distribution. The v2 API provides modern features including thread composition and poll creation.

### Spec References

- `docs/01-architecture/system-architecture-v3.md` — Connector patterns
- `docs/03-agents-tools/tool-registry.md` — External tool contracts
- `docs/09-platform-playbooks/x-twitter-strategy.md` — X best practices
- `docs/05-policy-safety/compliance-spec.md` — Content guidelines

---

## Prerequisites

### Completed Tasks

- [x] S1-D3: Tool wrapper with retry policies
- [x] S3-A3: Delayed execution engine

### Required Tools/Packages

```bash
pnpm add twitter-api-v2
pnpm add -D vitest nock
```

### Required Accounts/Access

- X Developer Account with Elevated access
- OAuth 2.0 credentials with required scopes
- Test account for sandbox testing

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests before implementation.

#### 1.1 Create X Connector Test Suite

```typescript
// packages/connectors/api/src/x/__tests__/x-connector.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { XConnector } from '../x-connector';
import { XConfig, TweetParams, ThreadParams, PollParams } from '../types';

// Mock twitter-api-v2
vi.mock('twitter-api-v2', () => {
  const mockClient = {
    v2: {
      tweet: vi.fn(),
      reply: vi.fn(),
      deleteTweet: vi.fn(),
      like: vi.fn(),
      unlike: vi.fn(),
      retweet: vi.fn(),
      unretweet: vi.fn(),
      singleTweet: vi.fn(),
      tweetMetrics: vi.fn(),
      uploadMedia: vi.fn()
    },
    v1: {
      uploadMedia: vi.fn()
    }
  };

  return {
    TwitterApi: vi.fn(() => mockClient),
    default: {
      TwitterApi: vi.fn(() => mockClient)
    }
  };
});

import { TwitterApi } from 'twitter-api-v2';

describe('XConnector', () => {
  let connector: XConnector;
  let mockClient: any;

  const testConfig: XConfig = {
    appKey: 'test-app-key',
    appSecret: 'test-app-secret',
    accessToken: 'test-access-token',
    accessSecret: 'test-access-secret'
  };

  beforeEach(() => {
    connector = new XConnector(testConfig);
    mockClient = (TwitterApi as any).mock.results[0].value;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('publishTweet', () => {
    it('should publish text tweet', async () => {
      mockClient.v2.tweet.mockResolvedValue({
        data: {
          id: '1234567890',
          text: 'Test tweet'
        }
      });

      const result = await connector.publishTweet({
        text: 'Test tweet'
      });

      expect(result.tweetId).toBe('1234567890');
      expect(result.success).toBe(true);
      expect(mockClient.v2.tweet).toHaveBeenCalledWith('Test tweet');
    });

    it('should publish tweet with media', async () => {
      mockClient.v1.uploadMedia.mockResolvedValue('media123');
      mockClient.v2.tweet.mockResolvedValue({
        data: { id: '1234567891', text: 'Tweet with image' }
      });

      const result = await connector.publishTweet({
        text: 'Tweet with image',
        media: [{ buffer: Buffer.alloc(1000), type: 'image/png' }]
      });

      expect(result.tweetId).toBe('1234567891');
      expect(result.mediaIds).toContain('media123');
    });

    it('should handle rate limiting', async () => {
      mockClient.v2.tweet.mockRejectedValue({
        code: 429,
        data: { detail: 'Too many requests' }
      });

      await expect(connector.publishTweet({ text: 'Test' }))
        .rejects.toThrow('X rate limit');
    });

    it('should handle authentication errors', async () => {
      mockClient.v2.tweet.mockRejectedValue({
        code: 401,
        data: { detail: 'Unauthorized' }
      });

      await expect(connector.publishTweet({ text: 'Test' }))
        .rejects.toThrow('X auth error');
    });

    it('should reject tweets over character limit', async () => {
      const longText = 'x'.repeat(300);

      await expect(connector.publishTweet({ text: longText }))
        .rejects.toThrow('Tweet exceeds character limit');
    });
  });

  describe('publishThread', () => {
    it('should publish multi-tweet thread', async () => {
      mockClient.v2.tweet.mockResolvedValueOnce({
        data: { id: 'tweet1', text: 'Thread 1/3' }
      });
      mockClient.v2.reply.mockResolvedValueOnce({
        data: { id: 'tweet2', text: 'Thread 2/3' }
      });
      mockClient.v2.reply.mockResolvedValueOnce({
        data: { id: 'tweet3', text: 'Thread 3/3' }
      });

      const result = await connector.publishThread({
        tweets: [
          { text: 'Thread 1/3' },
          { text: 'Thread 2/3' },
          { text: 'Thread 3/3' }
        ]
      });

      expect(result.threadTweetIds).toHaveLength(3);
      expect(result.threadTweetIds[0]).toBe('tweet1');
      expect(result.success).toBe(true);
    });

    it('should handle partial thread failure', async () => {
      mockClient.v2.tweet.mockResolvedValueOnce({
        data: { id: 'tweet1', text: 'Thread 1/3' }
      });
      mockClient.v2.reply.mockRejectedValueOnce({
        code: 500,
        data: { detail: 'Server error' }
      });

      const result = await connector.publishThread({
        tweets: [
          { text: 'Thread 1/3' },
          { text: 'Thread 2/3' },
          { text: 'Thread 3/3' }
        ]
      });

      expect(result.success).toBe(false);
      expect(result.threadTweetIds).toContain('tweet1');
      expect(result.failedAt).toBe(1);
    });
  });

  describe('publishPoll', () => {
    it('should publish tweet with poll', async () => {
      mockClient.v2.tweet.mockResolvedValue({
        data: { id: 'poll123', text: 'What do you prefer?' }
      });

      const result = await connector.publishPoll({
        text: 'What do you prefer?',
        options: ['Option A', 'Option B', 'Option C'],
        durationMinutes: 1440 // 24 hours
      });

      expect(result.tweetId).toBe('poll123');
      expect(mockClient.v2.tweet).toHaveBeenCalledWith(expect.objectContaining({
        poll: {
          options: ['Option A', 'Option B', 'Option C'],
          duration_minutes: 1440
        }
      }));
    });

    it('should validate poll options count', async () => {
      await expect(connector.publishPoll({
        text: 'Invalid poll',
        options: ['Only one'],
        durationMinutes: 60
      })).rejects.toThrow('Poll must have 2-4 options');
    });

    it('should validate poll duration', async () => {
      await expect(connector.publishPoll({
        text: 'Invalid poll',
        options: ['A', 'B'],
        durationMinutes: 10 // Too short
      })).rejects.toThrow('Poll duration must be');
    });
  });

  describe('replyToTweet', () => {
    it('should reply to existing tweet', async () => {
      mockClient.v2.reply.mockResolvedValue({
        data: { id: 'reply123', text: 'Reply text' }
      });

      const result = await connector.replyToTweet('tweet123', 'Reply text');

      expect(result.tweetId).toBe('reply123');
      expect(mockClient.v2.reply).toHaveBeenCalledWith('Reply text', 'tweet123');
    });
  });

  describe('deleteTweet', () => {
    it('should delete tweet by ID', async () => {
      mockClient.v2.deleteTweet.mockResolvedValue({
        data: { deleted: true }
      });

      const result = await connector.deleteTweet('tweet123');

      expect(result.success).toBe(true);
    });

    it('should handle tweet not found', async () => {
      mockClient.v2.deleteTweet.mockRejectedValue({
        code: 404,
        data: { detail: 'Tweet not found' }
      });

      await expect(connector.deleteTweet('nonexistent'))
        .rejects.toThrow('Tweet not found');
    });
  });

  describe('getTweetMetrics', () => {
    it('should fetch tweet engagement metrics', async () => {
      mockClient.v2.singleTweet.mockResolvedValue({
        data: {
          id: 'tweet123',
          text: 'Test tweet',
          public_metrics: {
            retweet_count: 10,
            reply_count: 5,
            like_count: 50,
            quote_count: 2,
            impression_count: 1000
          }
        }
      });

      const metrics = await connector.getTweetMetrics('tweet123');

      expect(metrics.retweets).toBe(10);
      expect(metrics.replies).toBe(5);
      expect(metrics.likes).toBe(50);
      expect(metrics.quotes).toBe(2);
      expect(metrics.impressions).toBe(1000);
    });
  });

  describe('engagement actions', () => {
    it('should like a tweet', async () => {
      mockClient.v2.like.mockResolvedValue({
        data: { liked: true }
      });

      const result = await connector.likeTweet('tweet123');

      expect(result.success).toBe(true);
    });

    it('should unlike a tweet', async () => {
      mockClient.v2.unlike.mockResolvedValue({
        data: { liked: false }
      });

      const result = await connector.unlikeTweet('tweet123');

      expect(result.success).toBe(true);
    });

    it('should retweet', async () => {
      mockClient.v2.retweet.mockResolvedValue({
        data: { retweeted: true }
      });

      const result = await connector.retweet('tweet123');

      expect(result.success).toBe(true);
    });

    it('should unretweet', async () => {
      mockClient.v2.unretweet.mockResolvedValue({
        data: { retweeted: false }
      });

      const result = await connector.unretweet('tweet123');

      expect(result.success).toBe(true);
    });
  });

  describe('media upload', () => {
    it('should upload image', async () => {
      mockClient.v1.uploadMedia.mockResolvedValue('media123');

      const result = await connector.uploadMedia(
        Buffer.alloc(1000),
        'image/png'
      );

      expect(result.mediaId).toBe('media123');
    });

    it('should upload video with chunked upload', async () => {
      mockClient.v1.uploadMedia.mockResolvedValue('video123');

      const result = await connector.uploadMedia(
        Buffer.alloc(10 * 1024 * 1024), // 10MB
        'video/mp4'
      );

      expect(result.mediaId).toBe('video123');
    });

    it('should reject oversized media', async () => {
      await expect(connector.uploadMedia(
        Buffer.alloc(20 * 1024 * 1024), // 20MB image
        'image/png'
      )).rejects.toThrow('Media exceeds size limit');
    });
  });

  describe('quote tweet', () => {
    it('should quote an existing tweet', async () => {
      mockClient.v2.tweet.mockResolvedValue({
        data: { id: 'quote123', text: 'Quote text' }
      });

      const result = await connector.quoteTweet({
        text: 'Quote text',
        quoteTweetId: 'original123'
      });

      expect(result.tweetId).toBe('quote123');
      expect(mockClient.v2.tweet).toHaveBeenCalledWith(expect.objectContaining({
        quote_tweet_id: 'original123'
      }));
    });
  });
});
```

**Run tests to confirm they fail:**

```bash
cd packages/connectors/api
pnpm test src/x --reporter=verbose
```

### Phase 2: Implementation

#### 2.1 Create X Types

```typescript
// packages/connectors/api/src/x/types.ts

import { z } from 'zod';

export const XConfigSchema = z.object({
  appKey: z.string().min(1),
  appSecret: z.string().min(1),
  accessToken: z.string().min(1),
  accessSecret: z.string().min(1),
  bearerToken: z.string().optional()
});

export type XConfig = z.infer<typeof XConfigSchema>;

export interface TweetParams {
  text: string;
  media?: MediaItem[];
  replySettings?: 'everyone' | 'mentionedUsers' | 'followers';
  quoteTweetId?: string;
}

export interface MediaItem {
  buffer: Buffer;
  type: 'image/png' | 'image/jpeg' | 'image/gif' | 'video/mp4';
  altText?: string;
}

export interface ThreadParams {
  tweets: TweetParams[];
}

export interface PollParams {
  text: string;
  options: string[];
  durationMinutes: number;
}

export interface TweetResult {
  tweetId: string;
  text: string;
  success: boolean;
  mediaIds?: string[];
}

export interface ThreadResult {
  threadTweetIds: string[];
  success: boolean;
  failedAt?: number;
  error?: string;
}

export interface TweetMetrics {
  tweetId: string;
  retweets: number;
  replies: number;
  likes: number;
  quotes: number;
  impressions: number;
  engagementRate?: number;
}

export interface MediaUploadResult {
  mediaId: string;
  type: string;
  expiresAt?: Date;
}

export const XErrorCodes = {
  'RATE_LIMITED': { category: 'rate_limit', retryable: true },
  'UNAUTHORIZED': { category: 'auth', retryable: false },
  'FORBIDDEN': { category: 'permission', retryable: false },
  'NOT_FOUND': { category: 'not_found', retryable: false },
  'DUPLICATE': { category: 'duplicate', retryable: false },
  'SUSPENDED': { category: 'account', retryable: false },
  'SERVER_ERROR': { category: 'server', retryable: true }
} as const;

export const TWEET_CONSTRAINTS = {
  maxTextLength: 280,
  maxMediaPerTweet: 4,
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxGifSize: 15 * 1024 * 1024, // 15MB
  maxVideoSize: 512 * 1024 * 1024, // 512MB
  pollMinDuration: 5, // 5 minutes
  pollMaxDuration: 10080, // 7 days in minutes
  pollMinOptions: 2,
  pollMaxOptions: 4,
  maxThreadLength: 25,
  supportedImageFormats: ['png', 'jpeg', 'jpg', 'gif', 'webp'],
  supportedVideoFormats: ['mp4']
} as const;
```

#### 2.2 Implement X Connector

```typescript
// packages/connectors/api/src/x/x-connector.ts

import { TwitterApi, TweetV2PostTweetResult, ApiResponseError } from 'twitter-api-v2';
import {
  XConfig,
  XConfigSchema,
  TweetParams,
  ThreadParams,
  PollParams,
  TweetResult,
  ThreadResult,
  TweetMetrics,
  MediaUploadResult,
  TWEET_CONSTRAINTS
} from './types';
import { XError, mapXError } from './errors';
import { logger } from '@rtv/observability';

export class XConnector {
  private readonly client: TwitterApi;
  private readonly config: XConfig;
  private userId: string | null = null;

  constructor(config: XConfig) {
    this.config = XConfigSchema.parse(config);

    this.client = new TwitterApi({
      appKey: config.appKey,
      appSecret: config.appSecret,
      accessToken: config.accessToken,
      accessSecret: config.accessSecret
    });
  }

  private async getUserId(): Promise<string> {
    if (!this.userId) {
      const me = await this.client.v2.me();
      this.userId = me.data.id;
    }
    return this.userId;
  }

  async publishTweet(params: TweetParams): Promise<TweetResult> {
    this.validateTweetText(params.text);

    logger.info('X: Publishing tweet', {
      textLength: params.text.length,
      hasMedia: !!params.media?.length
    });

    try {
      let mediaIds: string[] | undefined;

      // Upload media if provided
      if (params.media?.length) {
        mediaIds = await Promise.all(
          params.media.map(m => this.uploadMedia(m.buffer, m.type).then(r => r.mediaId))
        );
      }

      const tweetOptions: any = {};

      if (mediaIds?.length) {
        tweetOptions.media = { media_ids: mediaIds };
      }

      if (params.replySettings) {
        tweetOptions.reply_settings = params.replySettings;
      }

      if (params.quoteTweetId) {
        tweetOptions.quote_tweet_id = params.quoteTweetId;
      }

      const result = await this.client.v2.tweet(
        params.text,
        Object.keys(tweetOptions).length ? tweetOptions : undefined
      );

      return {
        tweetId: result.data.id,
        text: result.data.text,
        success: true,
        mediaIds
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async publishThread(params: ThreadParams): Promise<ThreadResult> {
    if (params.tweets.length > TWEET_CONSTRAINTS.maxThreadLength) {
      throw new XError(
        'VALIDATION',
        `Thread exceeds maximum length of ${TWEET_CONSTRAINTS.maxThreadLength}`,
        false
      );
    }

    logger.info('X: Publishing thread', { tweetCount: params.tweets.length });

    const tweetIds: string[] = [];

    try {
      // Publish first tweet
      const firstTweet = await this.publishTweet(params.tweets[0]);
      tweetIds.push(firstTweet.tweetId);

      // Reply chain for remaining tweets
      for (let i = 1; i < params.tweets.length; i++) {
        try {
          const reply = await this.replyToTweet(
            tweetIds[tweetIds.length - 1],
            params.tweets[i].text,
            params.tweets[i].media
          );
          tweetIds.push(reply.tweetId);
        } catch (error) {
          logger.error('X: Thread publishing failed', { failedAt: i, error });
          return {
            threadTweetIds: tweetIds,
            success: false,
            failedAt: i,
            error: (error as Error).message
          };
        }
      }

      return {
        threadTweetIds: tweetIds,
        success: true
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async publishPoll(params: PollParams): Promise<TweetResult> {
    this.validateTweetText(params.text);
    this.validatePoll(params.options, params.durationMinutes);

    logger.info('X: Publishing poll', {
      optionCount: params.options.length,
      duration: params.durationMinutes
    });

    try {
      const result = await this.client.v2.tweet({
        text: params.text,
        poll: {
          options: params.options,
          duration_minutes: params.durationMinutes
        }
      });

      return {
        tweetId: result.data.id,
        text: result.data.text,
        success: true
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async replyToTweet(
    tweetId: string,
    text: string,
    media?: TweetParams['media']
  ): Promise<TweetResult> {
    this.validateTweetText(text);

    logger.debug('X: Replying to tweet', { tweetId });

    try {
      let mediaIds: string[] | undefined;

      if (media?.length) {
        mediaIds = await Promise.all(
          media.map(m => this.uploadMedia(m.buffer, m.type).then(r => r.mediaId))
        );
      }

      const options: any = {
        reply: { in_reply_to_tweet_id: tweetId }
      };

      if (mediaIds?.length) {
        options.media = { media_ids: mediaIds };
      }

      const result = await this.client.v2.tweet(text, options);

      return {
        tweetId: result.data.id,
        text: result.data.text,
        success: true,
        mediaIds
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async quoteTweet(params: { text: string; quoteTweetId: string }): Promise<TweetResult> {
    return this.publishTweet({
      text: params.text,
      quoteTweetId: params.quoteTweetId
    });
  }

  async deleteTweet(tweetId: string): Promise<{ success: boolean }> {
    logger.info('X: Deleting tweet', { tweetId });

    try {
      await this.client.v2.deleteTweet(tweetId);
      return { success: true };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getTweetMetrics(tweetId: string): Promise<TweetMetrics> {
    logger.debug('X: Fetching tweet metrics', { tweetId });

    try {
      const result = await this.client.v2.singleTweet(tweetId, {
        'tweet.fields': ['public_metrics']
      });

      const metrics = result.data.public_metrics!;

      return {
        tweetId,
        retweets: metrics.retweet_count,
        replies: metrics.reply_count,
        likes: metrics.like_count,
        quotes: metrics.quote_count || 0,
        impressions: metrics.impression_count || 0,
        engagementRate: metrics.impression_count
          ? ((metrics.retweet_count + metrics.reply_count + metrics.like_count) / metrics.impression_count) * 100
          : undefined
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async likeTweet(tweetId: string): Promise<{ success: boolean }> {
    logger.debug('X: Liking tweet', { tweetId });

    try {
      const userId = await this.getUserId();
      await this.client.v2.like(userId, tweetId);
      return { success: true };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async unlikeTweet(tweetId: string): Promise<{ success: boolean }> {
    logger.debug('X: Unliking tweet', { tweetId });

    try {
      const userId = await this.getUserId();
      await this.client.v2.unlike(userId, tweetId);
      return { success: true };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async retweet(tweetId: string): Promise<{ success: boolean }> {
    logger.debug('X: Retweeting', { tweetId });

    try {
      const userId = await this.getUserId();
      await this.client.v2.retweet(userId, tweetId);
      return { success: true };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async unretweet(tweetId: string): Promise<{ success: boolean }> {
    logger.debug('X: Unretweeting', { tweetId });

    try {
      const userId = await this.getUserId();
      await this.client.v2.unretweet(userId, tweetId);
      return { success: true };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async uploadMedia(
    buffer: Buffer,
    mimeType: string
  ): Promise<MediaUploadResult> {
    const isVideo = mimeType.startsWith('video/');
    const isGif = mimeType === 'image/gif';
    const maxSize = isVideo
      ? TWEET_CONSTRAINTS.maxVideoSize
      : isGif
        ? TWEET_CONSTRAINTS.maxGifSize
        : TWEET_CONSTRAINTS.maxImageSize;

    if (buffer.length > maxSize) {
      throw new XError(
        'VALIDATION',
        `Media exceeds size limit of ${maxSize / (1024 * 1024)}MB`,
        false
      );
    }

    logger.debug('X: Uploading media', {
      type: mimeType,
      size: buffer.length
    });

    try {
      const mediaId = await this.client.v1.uploadMedia(buffer, {
        mimeType: mimeType as any
      });

      return {
        mediaId,
        type: mimeType
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private validateTweetText(text: string): void {
    if (text.length > TWEET_CONSTRAINTS.maxTextLength) {
      throw new XError(
        'VALIDATION',
        `Tweet exceeds character limit of ${TWEET_CONSTRAINTS.maxTextLength}`,
        false
      );
    }
  }

  private validatePoll(options: string[], durationMinutes: number): void {
    if (options.length < TWEET_CONSTRAINTS.pollMinOptions ||
        options.length > TWEET_CONSTRAINTS.pollMaxOptions) {
      throw new XError(
        'VALIDATION',
        `Poll must have ${TWEET_CONSTRAINTS.pollMinOptions}-${TWEET_CONSTRAINTS.pollMaxOptions} options`,
        false
      );
    }

    if (durationMinutes < TWEET_CONSTRAINTS.pollMinDuration ||
        durationMinutes > TWEET_CONSTRAINTS.pollMaxDuration) {
      throw new XError(
        'VALIDATION',
        `Poll duration must be between ${TWEET_CONSTRAINTS.pollMinDuration} and ${TWEET_CONSTRAINTS.pollMaxDuration} minutes`,
        false
      );
    }
  }

  private handleError(error: any): XError {
    if (error instanceof XError) {
      return error;
    }

    const apiError = error as ApiResponseError;
    const code = apiError.code;

    if (code === 429) {
      return new XError('RATE_LIMITED', 'X rate limit exceeded', true);
    }
    if (code === 401) {
      return new XError('UNAUTHORIZED', 'X auth error: unauthorized', false);
    }
    if (code === 403) {
      return new XError('FORBIDDEN', 'X permission denied', false);
    }
    if (code === 404) {
      return new XError('NOT_FOUND', 'Tweet not found', false);
    }

    return mapXError(apiError.message || 'Unknown error');
  }

  getTweetConstraints(): typeof TWEET_CONSTRAINTS {
    return TWEET_CONSTRAINTS;
  }
}
```

#### 2.3 Implement Error Handling

```typescript
// packages/connectors/api/src/x/errors.ts

import { XErrorCodes } from './types';

export class XError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'XError';
  }
}

export function mapXError(message: string): XError {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many')) {
    return new XError('RATE_LIMITED', `X rate limit: ${message}`, true);
  }
  if (lowerMessage.includes('auth') || lowerMessage.includes('token')) {
    return new XError('UNAUTHORIZED', `X auth error: ${message}`, false);
  }
  if (lowerMessage.includes('duplicate')) {
    return new XError('DUPLICATE', `X duplicate content: ${message}`, false);
  }
  if (lowerMessage.includes('suspended')) {
    return new XError('SUSPENDED', `X account suspended: ${message}`, false);
  }

  return new XError('UNKNOWN', message, false);
}
```

#### 2.4 Create Factory and Export

```typescript
// packages/connectors/api/src/x/index.ts

export * from './types';
export * from './x-connector';
export * from './errors';

import { XConnector } from './x-connector';
import { XConfig } from './types';
import { getSecretRef } from '@rtv/keyring';

export async function createXConnector(
  clientId: string
): Promise<XConnector> {
  const config: XConfig = {
    appKey: await getSecretRef(clientId, 'x', 'appKey'),
    appSecret: await getSecretRef(clientId, 'x', 'appSecret'),
    accessToken: await getSecretRef(clientId, 'x', 'accessToken'),
    accessSecret: await getSecretRef(clientId, 'x', 'accessSecret')
  };

  return new XConnector(config);
}
```

### Phase 3: Verification

```bash
# Unit tests
cd packages/connectors/api
pnpm test src/x --reporter=verbose --coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint src/x
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/connectors/api/src/x/types.ts` | X type definitions |
| Create | `packages/connectors/api/src/x/x-connector.ts` | Main connector implementation |
| Create | `packages/connectors/api/src/x/errors.ts` | Error handling |
| Create | `packages/connectors/api/src/x/index.ts` | Public exports |
| Create | `packages/connectors/api/src/x/__tests__/x-connector.test.ts` | Unit tests |
| Modify | `packages/connectors/api/src/index.ts` | Add X exports |

---

## Acceptance Criteria

- [ ] Text tweet publishing works
- [ ] Media tweet publishing works (images, videos)
- [ ] Thread publishing with reply chain works
- [ ] Poll creation works
- [ ] Reply to tweet works
- [ ] Quote tweet works
- [ ] Tweet deletion works
- [ ] Engagement actions (like, retweet) work
- [ ] Metrics retrieval works
- [ ] Rate limiting handled with retry
- [ ] Unit test coverage exceeds 80%

---

## JSON Task Block

```json
{
  "task_id": "S3-B6",
  "name": "X (Twitter) API Connector",
  "status": "pending",
  "dependencies": ["S1-D3", "S3-A3"],
  "blocks": ["S3-D1", "S3-D2"],
  "agent": "B",
  "sprint": 3,
  "complexity": "medium",
  "package": "@rtv/connectors/api",
  "files": [
    "packages/connectors/api/src/x/types.ts",
    "packages/connectors/api/src/x/x-connector.ts",
    "packages/connectors/api/src/x/errors.ts",
    "packages/connectors/api/src/x/index.ts"
  ],
  "test_files": [
    "packages/connectors/api/src/x/__tests__/x-connector.test.ts"
  ],
  "estimated_loc": 450,
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
      sections: ["x-connector"]
    - type: spec
      path: docs/09-platform-playbooks/x-twitter-strategy.md
      sections: ["api-endpoints", "content-guidelines"]
  summaries_to_create:
    - topic: "X API v2 patterns"
      scope: "tweets, threads, polls, media upload"
  decisions_made: []
  blockers: []
  handoff_notes: null
```

---

## Platform-Specific Notes

### X API Rate Limits
- Tweet creation: 300/15min (app), 100/15min (user)
- Media upload: 615/15min
- Like/Retweet: 1000/24hr

### Character Counting
- URLs count as 23 characters
- Media attachments don't count
- Emoji may count as 2+ characters
