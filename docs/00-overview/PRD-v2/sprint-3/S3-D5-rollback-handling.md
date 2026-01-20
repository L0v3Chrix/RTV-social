# Build Prompt: S3-D5 — Rollback Handling

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S3-D5 |
| Sprint | 3 — Scheduling + Publishing |
| Agent | D — Publish Verification System |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1.5 days |
| Dependencies | S3-D1, S3-D2, S3-D4, S3-B1, S3-B2, S3-B3, S3-B4, S3-B5, S3-B6 |
| Blocks | None |

---

## Context

### What We're Building
A rollback handling system that can delete failed or problematic posts across all platforms. When publishing fails partially, contains errors, or violates policies, the system can cleanly remove the content and restore the calendar to a consistent state. This ensures client accounts stay clean and scheduling remains accurate.

### Why It Matters
- **Clean Failures**: Remove partial/broken posts from client accounts
- **Policy Recovery**: Delete content flagged for policy violations
- **Calendar Accuracy**: Keep calendar in sync with actual post state
- **Client Trust**: No orphaned or broken content on their accounts
- **Compliance**: Remove content that violates platform rules

### Spec References
- `docs/01-architecture/system-architecture-v3.md` — Publishing pipeline
- `docs/02-schemas/external-memory-schema.md` — RollbackEvent schema
- `docs/05-policy-safety/compliance-safety-framework.md` — Content removal
- `docs/06-reliability-ops/slo-error-budget.md` — Rollback SLOs
- `docs/runbooks/RB-04-content-incident.md` — Incident response

---

## Prerequisites

### Completed Tasks
- [x] S3-D1: Post Verification API
- [x] S3-D2: Proof Capture System
- [x] S3-D4: Failure Classification
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
    "@rtv/connectors/api": "workspace:*",
    "@rtv/verification": "workspace:*",
    "@rtv/core": "workspace:*",
    "@rtv/telemetry": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^1.2.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests BEFORE implementation.

#### 1.1 Rollback Request Tests
```typescript
// packages/verification/src/__tests__/rollback-request.test.ts
import { describe, it, expect } from 'vitest';
import {
  RollbackRequest,
  RollbackResult,
  RollbackStatus,
  createRollbackRequest,
  isRollbackComplete,
  isRollbackSuccessful,
} from '../rollback-types';

describe('Rollback Types', () => {
  describe('createRollbackRequest', () => {
    it('should create rollback request with required fields', () => {
      const request = createRollbackRequest({
        postId: 'post_123',
        platform: 'facebook',
        externalPostId: 'fb_post_456',
        clientId: 'client_abc',
        reason: 'publish_failed',
      });

      expect(request.id).toBeDefined();
      expect(request.postId).toBe('post_123');
      expect(request.platform).toBe('facebook');
      expect(request.status).toBe(RollbackStatus.PENDING);
      expect(request.requestedAt).toBeInstanceOf(Date);
    });

    it('should generate unique request IDs', () => {
      const request1 = createRollbackRequest({
        postId: 'post_1',
        platform: 'instagram',
        externalPostId: 'ig_1',
        clientId: 'client_abc',
        reason: 'content_policy',
      });

      const request2 = createRollbackRequest({
        postId: 'post_2',
        platform: 'instagram',
        externalPostId: 'ig_2',
        clientId: 'client_abc',
        reason: 'content_policy',
      });

      expect(request1.id).not.toBe(request2.id);
    });

    it('should include optional metadata', () => {
      const request = createRollbackRequest({
        postId: 'post_123',
        platform: 'tiktok',
        externalPostId: 'tt_video_789',
        clientId: 'client_abc',
        reason: 'verification_failed',
        metadata: {
          failureCode: 'content_not_allowed',
          attemptNumber: 3,
        },
      });

      expect(request.metadata?.failureCode).toBe('content_not_allowed');
    });
  });

  describe('RollbackStatus', () => {
    it('should define all status values', () => {
      expect(RollbackStatus.PENDING).toBe('pending');
      expect(RollbackStatus.IN_PROGRESS).toBe('in_progress');
      expect(RollbackStatus.COMPLETED).toBe('completed');
      expect(RollbackStatus.FAILED).toBe('failed');
      expect(RollbackStatus.SKIPPED).toBe('skipped');
    });
  });

  describe('status helpers', () => {
    it('isRollbackComplete should return true for terminal states', () => {
      expect(isRollbackComplete({ status: RollbackStatus.COMPLETED })).toBe(true);
      expect(isRollbackComplete({ status: RollbackStatus.FAILED })).toBe(true);
      expect(isRollbackComplete({ status: RollbackStatus.SKIPPED })).toBe(true);
      expect(isRollbackComplete({ status: RollbackStatus.PENDING })).toBe(false);
      expect(isRollbackComplete({ status: RollbackStatus.IN_PROGRESS })).toBe(false);
    });

    it('isRollbackSuccessful should return true only for completed', () => {
      expect(isRollbackSuccessful({ status: RollbackStatus.COMPLETED })).toBe(true);
      expect(isRollbackSuccessful({ status: RollbackStatus.FAILED })).toBe(false);
      expect(isRollbackSuccessful({ status: RollbackStatus.SKIPPED })).toBe(false);
    });
  });
});
```

#### 1.2 Platform Rollback Tests
```typescript
// packages/verification/src/__tests__/platform-rollback.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FacebookRollback,
  InstagramRollback,
  TikTokRollback,
  YouTubeRollback,
  LinkedInRollback,
  XRollback,
} from '../platform-rollback';
import { RollbackStatus } from '../rollback-types';
import { createMockConnector } from './__mocks__/connectors';

describe('Platform Rollback', () => {
  describe('FacebookRollback', () => {
    let rollback: FacebookRollback;
    let mockConnector: ReturnType<typeof createMockConnector>;

    beforeEach(() => {
      mockConnector = createMockConnector('facebook');
      rollback = new FacebookRollback(mockConnector);
    });

    it('should delete post successfully', async () => {
      mockConnector.deletePost.mockResolvedValue({ success: true });

      const result = await rollback.execute({
        externalPostId: 'fb_post_123',
      });

      expect(result.status).toBe(RollbackStatus.COMPLETED);
      expect(mockConnector.deletePost).toHaveBeenCalledWith('fb_post_123');
    });

    it('should handle already deleted post', async () => {
      mockConnector.deletePost.mockRejectedValue({
        code: 100,
        message: 'Object does not exist',
      });

      const result = await rollback.execute({
        externalPostId: 'fb_post_123',
      });

      expect(result.status).toBe(RollbackStatus.SKIPPED);
      expect(result.reason).toContain('already deleted');
    });

    it('should handle permission denied', async () => {
      mockConnector.deletePost.mockRejectedValue({
        code: 200,
        message: 'Permissions error',
      });

      const result = await rollback.execute({
        externalPostId: 'fb_post_123',
      });

      expect(result.status).toBe(RollbackStatus.FAILED);
      expect(result.error).toContain('permission');
    });
  });

  describe('InstagramRollback', () => {
    let rollback: InstagramRollback;
    let mockConnector: ReturnType<typeof createMockConnector>;

    beforeEach(() => {
      mockConnector = createMockConnector('instagram');
      rollback = new InstagramRollback(mockConnector);
    });

    it('should delete media successfully', async () => {
      mockConnector.deleteMedia.mockResolvedValue({ success: true });

      const result = await rollback.execute({
        externalPostId: 'ig_media_123',
      });

      expect(result.status).toBe(RollbackStatus.COMPLETED);
    });

    it('should handle story expiration', async () => {
      mockConnector.deleteMedia.mockRejectedValue({
        code: 'STORY_EXPIRED',
        message: 'Story has expired',
      });

      const result = await rollback.execute({
        externalPostId: 'ig_story_123',
        isStory: true,
      });

      expect(result.status).toBe(RollbackStatus.SKIPPED);
      expect(result.reason).toContain('expired');
    });
  });

  describe('TikTokRollback', () => {
    let rollback: TikTokRollback;
    let mockConnector: ReturnType<typeof createMockConnector>;

    beforeEach(() => {
      mockConnector = createMockConnector('tiktok');
      rollback = new TikTokRollback(mockConnector);
    });

    it('should delete video successfully', async () => {
      mockConnector.deleteVideo.mockResolvedValue({ success: true });

      const result = await rollback.execute({
        externalPostId: 'tt_video_123',
      });

      expect(result.status).toBe(RollbackStatus.COMPLETED);
    });

    it('should handle video not found', async () => {
      mockConnector.deleteVideo.mockRejectedValue({
        code: 'video_not_found',
        message: 'Video does not exist',
      });

      const result = await rollback.execute({
        externalPostId: 'tt_video_123',
      });

      expect(result.status).toBe(RollbackStatus.SKIPPED);
    });
  });

  describe('YouTubeRollback', () => {
    let rollback: YouTubeRollback;
    let mockConnector: ReturnType<typeof createMockConnector>;

    beforeEach(() => {
      mockConnector = createMockConnector('youtube');
      rollback = new YouTubeRollback(mockConnector);
    });

    it('should delete video successfully', async () => {
      mockConnector.deleteVideo.mockResolvedValue({ success: true });

      const result = await rollback.execute({
        externalPostId: 'yt_video_123',
      });

      expect(result.status).toBe(RollbackStatus.COMPLETED);
    });

    it('should handle quota exceeded', async () => {
      mockConnector.deleteVideo.mockRejectedValue({
        code: 'quotaExceeded',
        message: 'Quota exceeded',
      });

      const result = await rollback.execute({
        externalPostId: 'yt_video_123',
      });

      expect(result.status).toBe(RollbackStatus.FAILED);
      expect(result.retryable).toBe(true);
    });
  });

  describe('LinkedInRollback', () => {
    let rollback: LinkedInRollback;
    let mockConnector: ReturnType<typeof createMockConnector>;

    beforeEach(() => {
      mockConnector = createMockConnector('linkedin');
      rollback = new LinkedInRollback(mockConnector);
    });

    it('should delete share successfully', async () => {
      mockConnector.deleteShare.mockResolvedValue({ success: true });

      const result = await rollback.execute({
        externalPostId: 'li_share_123',
      });

      expect(result.status).toBe(RollbackStatus.COMPLETED);
    });
  });

  describe('XRollback', () => {
    let rollback: XRollback;
    let mockConnector: ReturnType<typeof createMockConnector>;

    beforeEach(() => {
      mockConnector = createMockConnector('x');
      rollback = new XRollback(mockConnector);
    });

    it('should delete tweet successfully', async () => {
      mockConnector.deleteTweet.mockResolvedValue({ success: true });

      const result = await rollback.execute({
        externalPostId: 'x_tweet_123',
      });

      expect(result.status).toBe(RollbackStatus.COMPLETED);
    });

    it('should delete entire thread', async () => {
      mockConnector.deleteTweet.mockResolvedValue({ success: true });

      const result = await rollback.execute({
        externalPostId: 'x_tweet_123',
        threadIds: ['x_tweet_124', 'x_tweet_125'],
      });

      expect(result.status).toBe(RollbackStatus.COMPLETED);
      expect(mockConnector.deleteTweet).toHaveBeenCalledTimes(3);
    });
  });
});
```

#### 1.3 Rollback Service Tests
```typescript
// packages/verification/src/__tests__/rollback-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RollbackService } from '../rollback-service';
import { RollbackStatus } from '../rollback-types';
import { createMockConnectorRegistry } from './__mocks__/connector-registry';
import { createMockExternalMemory } from './__mocks__/external-memory';
import { createMockProofService } from './__mocks__/proof-service';

describe('RollbackService', () => {
  let service: RollbackService;
  let mockRegistry: ReturnType<typeof createMockConnectorRegistry>;
  let mockMemory: ReturnType<typeof createMockExternalMemory>;
  let mockProofService: ReturnType<typeof createMockProofService>;

  beforeEach(() => {
    mockRegistry = createMockConnectorRegistry();
    mockMemory = createMockExternalMemory();
    mockProofService = createMockProofService();
    service = new RollbackService({
      connectorRegistry: mockRegistry,
      externalMemory: mockMemory,
      proofService: mockProofService,
    });
  });

  describe('rollbackPost', () => {
    it('should rollback single post successfully', async () => {
      const mockRollback = {
        execute: vi.fn().mockResolvedValue({
          status: RollbackStatus.COMPLETED,
        }),
      };
      mockRegistry.getRollback.mockReturnValue(mockRollback);

      const result = await service.rollbackPost({
        postId: 'post_123',
        platform: 'facebook',
        externalPostId: 'fb_post_456',
        clientId: 'client_abc',
        reason: 'publish_failed',
      });

      expect(result.status).toBe(RollbackStatus.COMPLETED);
      expect(mockRegistry.getRollback).toHaveBeenCalledWith('facebook');
    });

    it('should capture proof before rollback', async () => {
      const mockRollback = {
        execute: vi.fn().mockResolvedValue({
          status: RollbackStatus.COMPLETED,
        }),
      };
      mockRegistry.getRollback.mockReturnValue(mockRollback);

      await service.rollbackPost({
        postId: 'post_123',
        platform: 'instagram',
        externalPostId: 'ig_post_789',
        clientId: 'client_abc',
        reason: 'content_policy',
        captureProofBeforeRollback: true,
      });

      expect(mockProofService.captureProof).toHaveBeenCalledBefore(
        mockRollback.execute
      );
    });

    it('should emit rollback event to external memory', async () => {
      const mockRollback = {
        execute: vi.fn().mockResolvedValue({
          status: RollbackStatus.COMPLETED,
        }),
      };
      mockRegistry.getRollback.mockReturnValue(mockRollback);

      await service.rollbackPost({
        postId: 'post_123',
        platform: 'tiktok',
        externalPostId: 'tt_video_111',
        clientId: 'client_xyz',
        reason: 'verification_failed',
      });

      expect(mockMemory.append).toHaveBeenCalledWith(
        'client_xyz',
        expect.objectContaining({
          type: 'rollback_completed',
          postId: 'post_123',
          platform: 'tiktok',
        })
      );
    });

    it('should update calendar after successful rollback', async () => {
      const mockRollback = {
        execute: vi.fn().mockResolvedValue({
          status: RollbackStatus.COMPLETED,
        }),
      };
      mockRegistry.getRollback.mockReturnValue(mockRollback);

      const result = await service.rollbackPost({
        postId: 'post_123',
        platform: 'youtube',
        externalPostId: 'yt_video_222',
        clientId: 'client_abc',
        reason: 'publish_failed',
        updateCalendar: true,
      });

      expect(result.calendarUpdated).toBe(true);
    });

    it('should handle rollback failure', async () => {
      const mockRollback = {
        execute: vi.fn().mockResolvedValue({
          status: RollbackStatus.FAILED,
          error: 'Permission denied',
        }),
      };
      mockRegistry.getRollback.mockReturnValue(mockRollback);

      const result = await service.rollbackPost({
        postId: 'post_123',
        platform: 'linkedin',
        externalPostId: 'li_post_333',
        clientId: 'client_abc',
        reason: 'content_policy',
      });

      expect(result.status).toBe(RollbackStatus.FAILED);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('rollbackBatch', () => {
    it('should rollback multiple posts', async () => {
      const mockRollback = {
        execute: vi.fn().mockResolvedValue({
          status: RollbackStatus.COMPLETED,
        }),
      };
      mockRegistry.getRollback.mockReturnValue(mockRollback);

      const posts = [
        { postId: 'post_1', platform: 'facebook', externalPostId: 'fb_1' },
        { postId: 'post_2', platform: 'instagram', externalPostId: 'ig_2' },
        { postId: 'post_3', platform: 'x', externalPostId: 'x_3' },
      ];

      const results = await service.rollbackBatch({
        posts,
        clientId: 'client_abc',
        reason: 'bulk_cleanup',
      });

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.status === RollbackStatus.COMPLETED)).toBe(true);
    });

    it('should continue on individual failures', async () => {
      const mockRollback = {
        execute: vi
          .fn()
          .mockResolvedValueOnce({ status: RollbackStatus.COMPLETED })
          .mockResolvedValueOnce({ status: RollbackStatus.FAILED, error: 'Error' })
          .mockResolvedValueOnce({ status: RollbackStatus.COMPLETED }),
      };
      mockRegistry.getRollback.mockReturnValue(mockRollback);

      const posts = [
        { postId: 'post_1', platform: 'facebook', externalPostId: 'fb_1' },
        { postId: 'post_2', platform: 'facebook', externalPostId: 'fb_2' },
        { postId: 'post_3', platform: 'facebook', externalPostId: 'fb_3' },
      ];

      const results = await service.rollbackBatch({
        posts,
        clientId: 'client_abc',
        reason: 'bulk_cleanup',
      });

      expect(results[0].status).toBe(RollbackStatus.COMPLETED);
      expect(results[1].status).toBe(RollbackStatus.FAILED);
      expect(results[2].status).toBe(RollbackStatus.COMPLETED);
    });
  });

  describe('getGlobalKillSwitch', () => {
    it('should check kill switch before rollback', async () => {
      service.setGlobalKillSwitch(true);

      const mockRollback = {
        execute: vi.fn(),
      };
      mockRegistry.getRollback.mockReturnValue(mockRollback);

      const result = await service.rollbackPost({
        postId: 'post_123',
        platform: 'facebook',
        externalPostId: 'fb_post_456',
        clientId: 'client_abc',
        reason: 'test',
      });

      expect(result.status).toBe(RollbackStatus.SKIPPED);
      expect(result.reason).toContain('kill switch');
      expect(mockRollback.execute).not.toHaveBeenCalled();
    });
  });

  describe('dryRun', () => {
    it('should validate rollback without executing', async () => {
      const mockRollback = {
        validate: vi.fn().mockResolvedValue({ canRollback: true }),
        execute: vi.fn(),
      };
      mockRegistry.getRollback.mockReturnValue(mockRollback);

      const result = await service.dryRun({
        postId: 'post_123',
        platform: 'tiktok',
        externalPostId: 'tt_video_444',
        clientId: 'client_abc',
      });

      expect(result.canRollback).toBe(true);
      expect(mockRollback.execute).not.toHaveBeenCalled();
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Create Rollback Types
```typescript
// packages/verification/src/rollback-types.ts
import crypto from 'crypto';
import { Platform } from './types';

export enum RollbackStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export type RollbackReason =
  | 'publish_failed'
  | 'verification_failed'
  | 'content_policy'
  | 'client_request'
  | 'bulk_cleanup'
  | 'incident_response'
  | 'scheduled_deletion';

export interface RollbackRequest {
  id: string;
  postId: string;
  platform: Platform;
  externalPostId: string;
  clientId: string;
  reason: RollbackReason;
  status: RollbackStatus;
  requestedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface RollbackResult {
  status: RollbackStatus;
  reason?: string;
  error?: string;
  retryable?: boolean;
  deletedAt?: Date;
  calendarUpdated?: boolean;
  proofCaptured?: boolean;
}

interface CreateRollbackRequestParams {
  postId: string;
  platform: Platform;
  externalPostId: string;
  clientId: string;
  reason: RollbackReason;
  metadata?: Record<string, unknown>;
}

export function createRollbackRequest(
  params: CreateRollbackRequestParams
): RollbackRequest {
  return {
    id: `rollback_${crypto.randomUUID()}`,
    postId: params.postId,
    platform: params.platform,
    externalPostId: params.externalPostId,
    clientId: params.clientId,
    reason: params.reason,
    status: RollbackStatus.PENDING,
    requestedAt: new Date(),
    metadata: params.metadata,
  };
}

export function isRollbackComplete(result: { status: RollbackStatus }): boolean {
  return [
    RollbackStatus.COMPLETED,
    RollbackStatus.FAILED,
    RollbackStatus.SKIPPED,
  ].includes(result.status);
}

export function isRollbackSuccessful(result: { status: RollbackStatus }): boolean {
  return result.status === RollbackStatus.COMPLETED;
}
```

#### 2.2 Create Platform Rollback Implementations
```typescript
// packages/verification/src/platform-rollback.ts
import { RollbackResult, RollbackStatus } from './rollback-types';
import { Platform } from './types';

interface PlatformRollbackExecutor {
  platform: Platform;
  execute(params: RollbackExecuteParams): Promise<RollbackResult>;
  validate?(params: RollbackValidateParams): Promise<{ canRollback: boolean; reason?: string }>;
}

interface RollbackExecuteParams {
  externalPostId: string;
  isStory?: boolean;
  threadIds?: string[];
}

interface RollbackValidateParams {
  externalPostId: string;
}

export class FacebookRollback implements PlatformRollbackExecutor {
  platform = 'facebook' as const;

  constructor(private connector: any) {}

  async execute(params: RollbackExecuteParams): Promise<RollbackResult> {
    try {
      await this.connector.deletePost(params.externalPostId);
      return {
        status: RollbackStatus.COMPLETED,
        deletedAt: new Date(),
      };
    } catch (error: any) {
      if (error.code === 100) {
        return {
          status: RollbackStatus.SKIPPED,
          reason: 'Post already deleted or does not exist',
        };
      }

      if (error.code === 200) {
        return {
          status: RollbackStatus.FAILED,
          error: 'Permission denied - cannot delete post',
          retryable: false,
        };
      }

      return {
        status: RollbackStatus.FAILED,
        error: error.message,
        retryable: true,
      };
    }
  }

  async validate(params: RollbackValidateParams): Promise<{ canRollback: boolean; reason?: string }> {
    try {
      const post = await this.connector.getPost(params.externalPostId);
      return { canRollback: !!post };
    } catch {
      return { canRollback: false, reason: 'Post not found' };
    }
  }
}

export class InstagramRollback implements PlatformRollbackExecutor {
  platform = 'instagram' as const;

  constructor(private connector: any) {}

  async execute(params: RollbackExecuteParams): Promise<RollbackResult> {
    try {
      await this.connector.deleteMedia(params.externalPostId);
      return {
        status: RollbackStatus.COMPLETED,
        deletedAt: new Date(),
      };
    } catch (error: any) {
      if (error.code === 'STORY_EXPIRED' || error.message?.includes('expired')) {
        return {
          status: RollbackStatus.SKIPPED,
          reason: 'Story has expired - no deletion needed',
        };
      }

      return {
        status: RollbackStatus.FAILED,
        error: error.message,
        retryable: true,
      };
    }
  }
}

export class TikTokRollback implements PlatformRollbackExecutor {
  platform = 'tiktok' as const;

  constructor(private connector: any) {}

  async execute(params: RollbackExecuteParams): Promise<RollbackResult> {
    try {
      await this.connector.deleteVideo(params.externalPostId);
      return {
        status: RollbackStatus.COMPLETED,
        deletedAt: new Date(),
      };
    } catch (error: any) {
      if (error.code === 'video_not_found') {
        return {
          status: RollbackStatus.SKIPPED,
          reason: 'Video not found - may already be deleted',
        };
      }

      return {
        status: RollbackStatus.FAILED,
        error: error.message,
        retryable: true,
      };
    }
  }
}

export class YouTubeRollback implements PlatformRollbackExecutor {
  platform = 'youtube' as const;

  constructor(private connector: any) {}

  async execute(params: RollbackExecuteParams): Promise<RollbackResult> {
    try {
      await this.connector.deleteVideo(params.externalPostId);
      return {
        status: RollbackStatus.COMPLETED,
        deletedAt: new Date(),
      };
    } catch (error: any) {
      if (error.code === 'quotaExceeded') {
        return {
          status: RollbackStatus.FAILED,
          error: 'Quota exceeded - retry later',
          retryable: true,
        };
      }

      if (error.code === 'videoNotFound') {
        return {
          status: RollbackStatus.SKIPPED,
          reason: 'Video not found',
        };
      }

      return {
        status: RollbackStatus.FAILED,
        error: error.message,
        retryable: true,
      };
    }
  }
}

export class LinkedInRollback implements PlatformRollbackExecutor {
  platform = 'linkedin' as const;

  constructor(private connector: any) {}

  async execute(params: RollbackExecuteParams): Promise<RollbackResult> {
    try {
      await this.connector.deleteShare(params.externalPostId);
      return {
        status: RollbackStatus.COMPLETED,
        deletedAt: new Date(),
      };
    } catch (error: any) {
      if (error.code === 404) {
        return {
          status: RollbackStatus.SKIPPED,
          reason: 'Share not found',
        };
      }

      return {
        status: RollbackStatus.FAILED,
        error: error.message,
        retryable: true,
      };
    }
  }
}

export class XRollback implements PlatformRollbackExecutor {
  platform = 'x' as const;

  constructor(private connector: any) {}

  async execute(params: RollbackExecuteParams): Promise<RollbackResult> {
    try {
      // Delete main tweet
      await this.connector.deleteTweet(params.externalPostId);

      // Delete thread replies if any
      if (params.threadIds?.length) {
        for (const threadId of params.threadIds) {
          await this.connector.deleteTweet(threadId);
        }
      }

      return {
        status: RollbackStatus.COMPLETED,
        deletedAt: new Date(),
      };
    } catch (error: any) {
      if (error.code === 144) {
        return {
          status: RollbackStatus.SKIPPED,
          reason: 'Tweet not found - may already be deleted',
        };
      }

      return {
        status: RollbackStatus.FAILED,
        error: error.message,
        retryable: true,
      };
    }
  }
}
```

#### 2.3 Create Rollback Service
```typescript
// packages/verification/src/rollback-service.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  RollbackRequest,
  RollbackResult,
  RollbackStatus,
  RollbackReason,
  createRollbackRequest,
} from './rollback-types';
import { Platform } from './types';
import type { ExternalMemory } from '@rtv/core';

const tracer = trace.getTracer('rollback-service');

interface RollbackServiceConfig {
  connectorRegistry: ConnectorRegistry;
  externalMemory: ExternalMemory;
  proofService?: ProofService;
}

interface ConnectorRegistry {
  getRollback(platform: Platform): PlatformRollback;
}

interface PlatformRollback {
  execute(params: any): Promise<RollbackResult>;
  validate?(params: any): Promise<{ canRollback: boolean; reason?: string }>;
}

interface ProofService {
  captureProof(params: any): Promise<any>;
}

interface RollbackPostParams {
  postId: string;
  platform: Platform;
  externalPostId: string;
  clientId: string;
  reason: RollbackReason;
  captureProofBeforeRollback?: boolean;
  updateCalendar?: boolean;
  metadata?: Record<string, unknown>;
}

interface RollbackBatchParams {
  posts: Array<{
    postId: string;
    platform: Platform;
    externalPostId: string;
  }>;
  clientId: string;
  reason: RollbackReason;
}

interface DryRunParams {
  postId: string;
  platform: Platform;
  externalPostId: string;
  clientId: string;
}

export class RollbackService {
  private registry: ConnectorRegistry;
  private memory: ExternalMemory;
  private proofService?: ProofService;
  private globalKillSwitch = false;

  constructor(config: RollbackServiceConfig) {
    this.registry = config.connectorRegistry;
    this.memory = config.externalMemory;
    this.proofService = config.proofService;
  }

  setGlobalKillSwitch(enabled: boolean): void {
    this.globalKillSwitch = enabled;
  }

  async rollbackPost(params: RollbackPostParams): Promise<RollbackResult & { request: RollbackRequest }> {
    return tracer.startActiveSpan('rollbackPost', async (span) => {
      span.setAttributes({
        'rollback.post_id': params.postId,
        'rollback.platform': params.platform,
        'rollback.client_id': params.clientId,
        'rollback.reason': params.reason,
      });

      const request = createRollbackRequest(params);

      // Check kill switch
      if (this.globalKillSwitch) {
        const result: RollbackResult = {
          status: RollbackStatus.SKIPPED,
          reason: 'Global kill switch is enabled',
        };

        await this.emitRollbackEvent(params.clientId, request, result);
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

        return { ...result, request };
      }

      try {
        // Capture proof before deletion if requested
        let proofCaptured = false;
        if (params.captureProofBeforeRollback && this.proofService) {
          await this.proofService.captureProof({
            postId: params.postId,
            platform: params.platform,
            externalPostId: params.externalPostId,
            clientId: params.clientId,
            verificationResult: {
              status: 'pending_rollback',
              isVisible: true,
              verifiedAt: new Date(),
            },
          });
          proofCaptured = true;
        }

        // Execute rollback
        const rollback = this.registry.getRollback(params.platform);
        const result = await rollback.execute({
          externalPostId: params.externalPostId,
        });

        // Update calendar if requested
        let calendarUpdated = false;
        if (params.updateCalendar && result.status === RollbackStatus.COMPLETED) {
          // In production, this would call calendar service
          calendarUpdated = true;
        }

        const finalResult: RollbackResult = {
          ...result,
          proofCaptured,
          calendarUpdated,
        };

        await this.emitRollbackEvent(params.clientId, request, finalResult);

        span.setAttributes({
          'rollback.status': result.status,
          'rollback.proof_captured': proofCaptured,
          'rollback.calendar_updated': calendarUpdated,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

        return { ...finalResult, request };
      } catch (error: any) {
        const result: RollbackResult = {
          status: RollbackStatus.FAILED,
          error: error.message,
          retryable: true,
        };

        await this.emitRollbackEvent(params.clientId, request, result);

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);
        span.end();

        return { ...result, request };
      }
    });
  }

  async rollbackBatch(params: RollbackBatchParams): Promise<Array<RollbackResult & { postId: string }>> {
    return tracer.startActiveSpan('rollbackBatch', async (span) => {
      span.setAttributes({
        'rollback.batch_size': params.posts.length,
        'rollback.client_id': params.clientId,
        'rollback.reason': params.reason,
      });

      const results: Array<RollbackResult & { postId: string }> = [];

      for (const post of params.posts) {
        const result = await this.rollbackPost({
          ...post,
          clientId: params.clientId,
          reason: params.reason,
        });

        results.push({ ...result, postId: post.postId });
      }

      const completedCount = results.filter(
        (r) => r.status === RollbackStatus.COMPLETED
      ).length;

      span.setAttributes({
        'rollback.completed_count': completedCount,
        'rollback.failed_count': results.length - completedCount,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return results;
    });
  }

  async dryRun(params: DryRunParams): Promise<{ canRollback: boolean; reason?: string }> {
    const rollback = this.registry.getRollback(params.platform);

    if (rollback.validate) {
      return rollback.validate({
        externalPostId: params.externalPostId,
      });
    }

    // Default: assume can rollback
    return { canRollback: true };
  }

  private async emitRollbackEvent(
    clientId: string,
    request: RollbackRequest,
    result: RollbackResult
  ): Promise<void> {
    const eventType =
      result.status === RollbackStatus.COMPLETED
        ? 'rollback_completed'
        : result.status === RollbackStatus.SKIPPED
        ? 'rollback_skipped'
        : 'rollback_failed';

    await this.memory.append(clientId, {
      type: eventType,
      rollbackId: request.id,
      postId: request.postId,
      platform: request.platform,
      externalPostId: request.externalPostId,
      reason: request.reason,
      status: result.status,
      error: result.error,
      deletedAt: result.deletedAt?.toISOString(),
      timestamp: new Date().toISOString(),
    });
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
| Create | `packages/verification/src/rollback-types.ts` | Rollback type definitions |
| Create | `packages/verification/src/platform-rollback.ts` | Platform-specific rollback implementations |
| Create | `packages/verification/src/rollback-service.ts` | Main rollback service |
| Create | `packages/verification/src/__tests__/rollback-request.test.ts` | Type tests |
| Create | `packages/verification/src/__tests__/platform-rollback.test.ts` | Platform rollback tests |
| Create | `packages/verification/src/__tests__/rollback-service.test.ts` | Service tests |
| Modify | `packages/verification/src/index.ts` | Export rollback module |

---

## Acceptance Criteria

- [ ] RollbackStatus enum with all states (pending, in_progress, completed, failed, skipped)
- [ ] Platform-specific rollback for Facebook, Instagram, TikTok, YouTube, LinkedIn, X
- [ ] Handle "already deleted" gracefully (skip, don't fail)
- [ ] Optional proof capture before rollback
- [ ] Global kill switch to disable all rollbacks
- [ ] Batch rollback support with individual error handling
- [ ] Dry run validation without execution
- [ ] All rollback events emitted to external memory
- [ ] Unit tests achieve 90%+ coverage

---

## Test Requirements

### Unit Tests
- Rollback request creation
- Status helpers (isComplete, isSuccessful)
- Each platform rollback implementation
- RollbackService methods
- Kill switch behavior

### Integration Tests
- Full rollback flow with mocked connectors
- Batch rollback with mixed results
- Proof capture integration

---

## Security & Safety Checklist

- [ ] No secrets in rollback logic
- [ ] Client isolation in all operations
- [ ] Kill switch available for emergencies
- [ ] Audit trail via external memory events
- [ ] No cascading deletions without explicit request
- [ ] Dry run available for validation

---

## JSON Task Block

```json
{
  "task_id": "S3-D5",
  "name": "Rollback Handling",
  "description": "Delete failed or problematic posts across platforms and restore calendar consistency",
  "status": "pending",
  "priority": "medium",
  "complexity": "medium",
  "sprint": 3,
  "agent": "D",
  "dependencies": ["S3-D1", "S3-D2", "S3-D4", "S3-B1", "S3-B2", "S3-B3", "S3-B4", "S3-B5", "S3-B6"],
  "blocks": [],
  "estimated_hours": 12,
  "actual_hours": null,
  "tags": ["verification", "rollback", "deletion", "recovery", "tdd"],
  "package": "@rtv/verification",
  "files": {
    "create": [
      "packages/verification/src/rollback-types.ts",
      "packages/verification/src/platform-rollback.ts",
      "packages/verification/src/rollback-service.ts"
    ],
    "modify": [
      "packages/verification/src/index.ts"
    ],
    "delete": []
  },
  "acceptance_criteria": [
    "Platform-specific rollback implementations",
    "Handle already-deleted gracefully",
    "Optional proof capture before rollback",
    "Global kill switch",
    "Batch rollback support",
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
  "rollback_operations": [],
  "next_task_hints": [
    "Sprint 4 for engagement features",
    "Integrate rollback with incident response"
  ]
}
```
