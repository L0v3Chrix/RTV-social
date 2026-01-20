# Build Prompt: S3-D4 — Failure Classification

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S3-D4 |
| Sprint | 3 — Scheduling + Publishing |
| Agent | D — Publish Verification System |
| Complexity | Medium |
| Status | Pending |
| Estimated Effort | 1 day |
| Dependencies | S3-D1 |
| Blocks | S3-D3, S3-D5 |

---

## Context

### What We're Building
A failure classification system that categorizes publishing and verification errors into transient (retryable) vs. permanent (non-retryable) failures. The system analyzes error codes, messages, and context to determine appropriate recovery strategies, enabling intelligent retry decisions and proper incident routing.

### Why It Matters
- **Efficient Retries**: Only retry errors that can succeed
- **Faster Resolution**: Route permanent failures to human review
- **Cost Savings**: Avoid wasting API calls on hopeless retries
- **Better UX**: Provide meaningful error messages to users
- **Incident Management**: Proper categorization for alerting

### Spec References
- `docs/01-architecture/system-architecture-v3.md` — Error handling patterns
- `docs/03-agents-tools/agent-recursion-contracts.md` — Failure modes
- `docs/05-policy-safety/compliance-safety-framework.md` — Error handling
- `docs/06-reliability-ops/slo-error-budget.md` — Error classification

---

## Prerequisites

### Completed Tasks
- [x] S3-D1: Post Verification API

### Required Packages
```json
{
  "dependencies": {
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

#### 1.1 Failure Category Tests
```typescript
// packages/verification/src/__tests__/failure-category.test.ts
import { describe, it, expect } from 'vitest';
import {
  FailureCategory,
  FailureClassification,
  classifyFailure,
  isTransient,
  isPermanent,
  isRateLimited,
  isAuthError,
  isContentPolicy,
} from '../failure-classification';

describe('FailureClassification', () => {
  describe('FailureCategory', () => {
    it('should define all failure categories', () => {
      expect(FailureCategory.TRANSIENT).toBe('transient');
      expect(FailureCategory.PERMANENT).toBe('permanent');
      expect(FailureCategory.RATE_LIMITED).toBe('rate_limited');
      expect(FailureCategory.AUTH_ERROR).toBe('auth_error');
      expect(FailureCategory.CONTENT_POLICY).toBe('content_policy');
      expect(FailureCategory.PLATFORM_ERROR).toBe('platform_error');
      expect(FailureCategory.UNKNOWN).toBe('unknown');
    });
  });

  describe('classifyFailure', () => {
    it('should classify rate limit errors', () => {
      const result = classifyFailure({
        platform: 'facebook',
        error: { code: 17, message: 'User request limit reached' },
      });

      expect(result.category).toBe(FailureCategory.RATE_LIMITED);
      expect(result.isRetryable).toBe(true);
      expect(result.suggestedDelay).toBeGreaterThan(0);
    });

    it('should classify auth errors', () => {
      const result = classifyFailure({
        platform: 'instagram',
        error: { code: 190, message: 'Invalid OAuth access token' },
      });

      expect(result.category).toBe(FailureCategory.AUTH_ERROR);
      expect(result.isRetryable).toBe(true);
      expect(result.action).toBe('refresh_token');
    });

    it('should classify content policy violations as permanent', () => {
      const result = classifyFailure({
        platform: 'tiktok',
        error: { code: 'content_not_allowed', message: 'Content violates policy' },
      });

      expect(result.category).toBe(FailureCategory.CONTENT_POLICY);
      expect(result.isRetryable).toBe(false);
    });

    it('should classify network errors as transient', () => {
      const result = classifyFailure({
        platform: 'youtube',
        error: { code: 'ECONNRESET', message: 'Connection reset' },
      });

      expect(result.category).toBe(FailureCategory.TRANSIENT);
      expect(result.isRetryable).toBe(true);
    });

    it('should classify permanent account issues', () => {
      const result = classifyFailure({
        platform: 'linkedin',
        error: { code: 403, message: 'Account suspended' },
      });

      expect(result.category).toBe(FailureCategory.PERMANENT);
      expect(result.isRetryable).toBe(false);
      expect(result.requiresHumanReview).toBe(true);
    });

    it('should include platform-specific context', () => {
      const result = classifyFailure({
        platform: 'x',
        error: { code: 429, message: 'Too Many Requests' },
      });

      expect(result.platform).toBe('x');
      expect(result.originalError.code).toBe(429);
    });
  });

  describe('helper functions', () => {
    it('isTransient should return true for transient failures', () => {
      const classification = classifyFailure({
        platform: 'facebook',
        error: { code: 'ETIMEDOUT', message: 'Timeout' },
      });

      expect(isTransient(classification)).toBe(true);
    });

    it('isPermanent should return true for permanent failures', () => {
      const classification = classifyFailure({
        platform: 'instagram',
        error: { code: 'content_policy_violation', message: 'Banned content' },
      });

      expect(isPermanent(classification)).toBe(true);
    });

    it('isRateLimited should return true for rate limit failures', () => {
      const classification = classifyFailure({
        platform: 'tiktok',
        error: { code: 'rate_limit_exceeded', message: 'Too many requests' },
      });

      expect(isRateLimited(classification)).toBe(true);
    });

    it('isAuthError should return true for auth failures', () => {
      const classification = classifyFailure({
        platform: 'youtube',
        error: { code: 401, message: 'Unauthorized' },
      });

      expect(isAuthError(classification)).toBe(true);
    });

    it('isContentPolicy should return true for content violations', () => {
      const classification = classifyFailure({
        platform: 'linkedin',
        error: { code: 'spam_detected', message: 'Content flagged as spam' },
      });

      expect(isContentPolicy(classification)).toBe(true);
    });
  });
});
```

#### 1.2 Platform-Specific Classifier Tests
```typescript
// packages/verification/src/__tests__/platform-classifiers.test.ts
import { describe, it, expect } from 'vitest';
import {
  FacebookClassifier,
  InstagramClassifier,
  TikTokClassifier,
  YouTubeClassifier,
  LinkedInClassifier,
  XClassifier,
} from '../platform-classifiers';
import { FailureCategory } from '../failure-classification';

describe('Platform Classifiers', () => {
  describe('FacebookClassifier', () => {
    const classifier = new FacebookClassifier();

    it('should classify error code 17 as rate limited', () => {
      const result = classifier.classify({ code: 17, message: 'Rate limit' });
      expect(result.category).toBe(FailureCategory.RATE_LIMITED);
    });

    it('should classify error code 190 as auth error', () => {
      const result = classifier.classify({ code: 190, message: 'Token invalid' });
      expect(result.category).toBe(FailureCategory.AUTH_ERROR);
    });

    it('should classify error code 200 as content policy', () => {
      const result = classifier.classify({ code: 200, message: 'Permissions error' });
      expect(result.category).toBe(FailureCategory.PERMANENT);
    });

    it('should classify error code 368 as temporary block', () => {
      const result = classifier.classify({ code: 368, message: 'Temporarily blocked' });
      expect(result.category).toBe(FailureCategory.RATE_LIMITED);
      expect(result.suggestedDelay).toBeGreaterThan(60000); // At least 1 minute
    });

    it('should classify unknown errors as unknown', () => {
      const result = classifier.classify({ code: 99999, message: 'Unknown' });
      expect(result.category).toBe(FailureCategory.UNKNOWN);
    });
  });

  describe('InstagramClassifier', () => {
    const classifier = new InstagramClassifier();

    it('should classify error code 4 as rate limited', () => {
      const result = classifier.classify({ code: 4, message: 'Too many calls' });
      expect(result.category).toBe(FailureCategory.RATE_LIMITED);
    });

    it('should classify feedback_required as rate limited', () => {
      const result = classifier.classify({ code: 'feedback_required', message: 'Action blocked' });
      expect(result.category).toBe(FailureCategory.RATE_LIMITED);
      expect(result.requiresHumanReview).toBe(true);
    });

    it('should classify challenge_required as auth error', () => {
      const result = classifier.classify({ code: 'challenge_required', message: 'Verify identity' });
      expect(result.category).toBe(FailureCategory.AUTH_ERROR);
      expect(result.action).toBe('complete_challenge');
    });
  });

  describe('TikTokClassifier', () => {
    const classifier = new TikTokClassifier();

    it('should classify spam_risk as rate limited', () => {
      const result = classifier.classify({
        code: 'spam_risk_too_many_pending_share',
        message: 'Too many pending shares'
      });
      expect(result.category).toBe(FailureCategory.RATE_LIMITED);
    });

    it('should classify video_format_check_failed as permanent', () => {
      const result = classifier.classify({
        code: 'video_format_check_failed',
        message: 'Invalid video format'
      });
      expect(result.category).toBe(FailureCategory.PERMANENT);
      expect(result.isRetryable).toBe(false);
    });

    it('should classify scope_not_authorized as auth error', () => {
      const result = classifier.classify({
        code: 'scope_not_authorized',
        message: 'Missing permission'
      });
      expect(result.category).toBe(FailureCategory.AUTH_ERROR);
    });
  });

  describe('YouTubeClassifier', () => {
    const classifier = new YouTubeClassifier();

    it('should classify quotaExceeded as rate limited', () => {
      const result = classifier.classify({ code: 'quotaExceeded', message: 'Quota exceeded' });
      expect(result.category).toBe(FailureCategory.RATE_LIMITED);
      expect(result.suggestedDelay).toBeGreaterThan(60000);
    });

    it('should classify forbidden as permanent', () => {
      const result = classifier.classify({ code: 'forbidden', message: 'Access denied' });
      expect(result.category).toBe(FailureCategory.PERMANENT);
    });

    it('should classify uploadLimitExceeded as rate limited', () => {
      const result = classifier.classify({ code: 'uploadLimitExceeded', message: 'Upload limit' });
      expect(result.category).toBe(FailureCategory.RATE_LIMITED);
    });

    it('should classify videoRejected as content policy', () => {
      const result = classifier.classify({ code: 'videoRejected', message: 'Video rejected' });
      expect(result.category).toBe(FailureCategory.CONTENT_POLICY);
    });
  });

  describe('LinkedInClassifier', () => {
    const classifier = new LinkedInClassifier();

    it('should classify 429 as rate limited', () => {
      const result = classifier.classify({ code: 429, message: 'Too many requests' });
      expect(result.category).toBe(FailureCategory.RATE_LIMITED);
    });

    it('should classify INVALID_ACCESS_TOKEN as auth error', () => {
      const result = classifier.classify({ code: 'INVALID_ACCESS_TOKEN', message: 'Token expired' });
      expect(result.category).toBe(FailureCategory.AUTH_ERROR);
    });

    it('should classify CONTENT_MODERATION as content policy', () => {
      const result = classifier.classify({ code: 'CONTENT_MODERATION', message: 'Flagged' });
      expect(result.category).toBe(FailureCategory.CONTENT_POLICY);
    });
  });

  describe('XClassifier', () => {
    const classifier = new XClassifier();

    it('should classify 429 as rate limited', () => {
      const result = classifier.classify({ code: 429, message: 'Rate limit exceeded' });
      expect(result.category).toBe(FailureCategory.RATE_LIMITED);
    });

    it('should classify 401 as auth error', () => {
      const result = classifier.classify({ code: 401, message: 'Unauthorized' });
      expect(result.category).toBe(FailureCategory.AUTH_ERROR);
    });

    it('should classify 403 with suspension message as permanent', () => {
      const result = classifier.classify({ code: 403, message: 'Account suspended' });
      expect(result.category).toBe(FailureCategory.PERMANENT);
      expect(result.requiresHumanReview).toBe(true);
    });

    it('should classify duplicate_tweet as content policy', () => {
      const result = classifier.classify({ code: 'duplicate_tweet', message: 'Duplicate content' });
      expect(result.category).toBe(FailureCategory.CONTENT_POLICY);
    });
  });
});
```

#### 1.3 Classifier Service Tests
```typescript
// packages/verification/src/__tests__/classifier-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClassifierService } from '../classifier-service';
import { FailureCategory } from '../failure-classification';
import { createMockExternalMemory } from './__mocks__/external-memory';

describe('ClassifierService', () => {
  let service: ClassifierService;
  let mockMemory: ReturnType<typeof createMockExternalMemory>;

  beforeEach(() => {
    mockMemory = createMockExternalMemory();
    service = new ClassifierService({
      externalMemory: mockMemory,
    });
  });

  describe('classifyAndEmit', () => {
    it('should classify error and emit event', async () => {
      const result = await service.classifyAndEmit({
        platform: 'facebook',
        error: { code: 17, message: 'Rate limit exceeded' },
        clientId: 'client_123',
        postId: 'post_456',
      });

      expect(result.category).toBe(FailureCategory.RATE_LIMITED);
      expect(mockMemory.append).toHaveBeenCalledWith(
        'client_123',
        expect.objectContaining({
          type: 'failure_classified',
          platform: 'facebook',
          category: FailureCategory.RATE_LIMITED,
        })
      );
    });

    it('should include context in classification', async () => {
      const result = await service.classifyAndEmit({
        platform: 'instagram',
        error: { code: 190, message: 'Token expired' },
        clientId: 'client_123',
        postId: 'post_789',
        context: {
          attemptNumber: 2,
          operation: 'publish',
        },
      });

      expect(result.context?.attemptNumber).toBe(2);
      expect(result.context?.operation).toBe('publish');
    });

    it('should trigger human review for certain categories', async () => {
      const result = await service.classifyAndEmit({
        platform: 'x',
        error: { code: 403, message: 'Account suspended' },
        clientId: 'client_123',
        postId: 'post_999',
      });

      expect(result.requiresHumanReview).toBe(true);
      expect(mockMemory.append).toHaveBeenCalledWith(
        'client_123',
        expect.objectContaining({
          requiresHumanReview: true,
        })
      );
    });
  });

  describe('getRecommendedAction', () => {
    it('should recommend retry for transient failures', () => {
      const action = service.getRecommendedAction({
        category: FailureCategory.TRANSIENT,
        isRetryable: true,
      });

      expect(action.type).toBe('retry');
    });

    it('should recommend token refresh for auth errors', () => {
      const action = service.getRecommendedAction({
        category: FailureCategory.AUTH_ERROR,
        isRetryable: true,
        action: 'refresh_token',
      });

      expect(action.type).toBe('refresh_token');
    });

    it('should recommend human review for permanent failures', () => {
      const action = service.getRecommendedAction({
        category: FailureCategory.PERMANENT,
        isRetryable: false,
        requiresHumanReview: true,
      });

      expect(action.type).toBe('escalate');
      expect(action.requiresHuman).toBe(true);
    });

    it('should recommend wait for rate limited', () => {
      const action = service.getRecommendedAction({
        category: FailureCategory.RATE_LIMITED,
        isRetryable: true,
        suggestedDelay: 60000,
      });

      expect(action.type).toBe('wait_and_retry');
      expect(action.delayMs).toBe(60000);
    });

    it('should recommend content modification for content policy', () => {
      const action = service.getRecommendedAction({
        category: FailureCategory.CONTENT_POLICY,
        isRetryable: false,
      });

      expect(action.type).toBe('modify_content');
      expect(action.requiresHuman).toBe(true);
    });
  });

  describe('aggregateFailures', () => {
    it('should aggregate failures by category', async () => {
      await service.classifyAndEmit({
        platform: 'facebook',
        error: { code: 17 },
        clientId: 'client_123',
      });
      await service.classifyAndEmit({
        platform: 'instagram',
        error: { code: 4 },
        clientId: 'client_123',
      });
      await service.classifyAndEmit({
        platform: 'tiktok',
        error: { code: 'content_not_allowed' },
        clientId: 'client_123',
      });

      const aggregation = service.aggregateFailures('client_123');

      expect(aggregation.byCategory[FailureCategory.RATE_LIMITED]).toBe(2);
      expect(aggregation.byCategory[FailureCategory.CONTENT_POLICY]).toBe(1);
    });

    it('should aggregate failures by platform', async () => {
      await service.classifyAndEmit({
        platform: 'facebook',
        error: { code: 17 },
        clientId: 'client_123',
      });
      await service.classifyAndEmit({
        platform: 'facebook',
        error: { code: 190 },
        clientId: 'client_123',
      });

      const aggregation = service.aggregateFailures('client_123');

      expect(aggregation.byPlatform['facebook']).toBe(2);
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Create Failure Classification Types
```typescript
// packages/verification/src/failure-classification.ts
import { Platform } from './types';

export enum FailureCategory {
  TRANSIENT = 'transient',
  PERMANENT = 'permanent',
  RATE_LIMITED = 'rate_limited',
  AUTH_ERROR = 'auth_error',
  CONTENT_POLICY = 'content_policy',
  PLATFORM_ERROR = 'platform_error',
  UNKNOWN = 'unknown',
}

export interface FailureClassification {
  category: FailureCategory;
  platform: Platform;
  isRetryable: boolean;
  suggestedDelay?: number;
  action?: string;
  requiresHumanReview: boolean;
  originalError: {
    code: string | number;
    message?: string;
  };
  context?: Record<string, unknown>;
  classifiedAt: Date;
}

interface ClassifyFailureParams {
  platform: Platform;
  error: { code: string | number; message?: string };
  context?: Record<string, unknown>;
}

// Network/transient error codes
const TRANSIENT_CODES = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNREFUSED',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'TIMEOUT',
  'NetworkError',
  500,
  502,
  503,
  504,
];

export function classifyFailure(params: ClassifyFailureParams): FailureClassification {
  const { platform, error, context } = params;

  // Check for network/transient errors first
  if (TRANSIENT_CODES.includes(error.code)) {
    return {
      category: FailureCategory.TRANSIENT,
      platform,
      isRetryable: true,
      suggestedDelay: 5000,
      requiresHumanReview: false,
      originalError: error,
      context,
      classifiedAt: new Date(),
    };
  }

  // Delegate to platform-specific classifier
  const classifier = getClassifier(platform);
  return classifier.classify(error, context);
}

export function isTransient(classification: FailureClassification): boolean {
  return classification.category === FailureCategory.TRANSIENT;
}

export function isPermanent(classification: FailureClassification): boolean {
  return (
    classification.category === FailureCategory.PERMANENT ||
    classification.category === FailureCategory.CONTENT_POLICY
  );
}

export function isRateLimited(classification: FailureClassification): boolean {
  return classification.category === FailureCategory.RATE_LIMITED;
}

export function isAuthError(classification: FailureClassification): boolean {
  return classification.category === FailureCategory.AUTH_ERROR;
}

export function isContentPolicy(classification: FailureClassification): boolean {
  return classification.category === FailureCategory.CONTENT_POLICY;
}

// Import classifiers
import {
  FacebookClassifier,
  InstagramClassifier,
  TikTokClassifier,
  YouTubeClassifier,
  LinkedInClassifier,
  XClassifier,
} from './platform-classifiers';

function getClassifier(platform: Platform) {
  switch (platform) {
    case 'facebook':
      return new FacebookClassifier();
    case 'instagram':
      return new InstagramClassifier();
    case 'tiktok':
      return new TikTokClassifier();
    case 'youtube':
      return new YouTubeClassifier();
    case 'linkedin':
      return new LinkedInClassifier();
    case 'x':
      return new XClassifier();
    default:
      return new GenericClassifier(platform);
  }
}

class GenericClassifier {
  constructor(private platform: Platform) {}

  classify(
    error: { code: string | number; message?: string },
    context?: Record<string, unknown>
  ): FailureClassification {
    return {
      category: FailureCategory.UNKNOWN,
      platform: this.platform,
      isRetryable: false,
      requiresHumanReview: true,
      originalError: error,
      context,
      classifiedAt: new Date(),
    };
  }
}
```

#### 2.2 Create Platform Classifiers
```typescript
// packages/verification/src/platform-classifiers.ts
import { FailureCategory, FailureClassification } from './failure-classification';
import { Platform } from './types';

interface PlatformClassifier {
  classify(
    error: { code: string | number; message?: string },
    context?: Record<string, unknown>
  ): FailureClassification;
}

export class FacebookClassifier implements PlatformClassifier {
  private readonly platform: Platform = 'facebook';

  private readonly errorMap: Record<number, Partial<FailureClassification>> = {
    1: { category: FailureCategory.TRANSIENT, isRetryable: true },
    2: { category: FailureCategory.PLATFORM_ERROR, isRetryable: true },
    4: { category: FailureCategory.RATE_LIMITED, isRetryable: true, suggestedDelay: 60000 },
    17: { category: FailureCategory.RATE_LIMITED, isRetryable: true, suggestedDelay: 60000 },
    100: { category: FailureCategory.PERMANENT, isRetryable: false }, // Invalid parameter
    190: { category: FailureCategory.AUTH_ERROR, isRetryable: true, action: 'refresh_token' },
    200: { category: FailureCategory.PERMANENT, isRetryable: false }, // Permissions
    368: { category: FailureCategory.RATE_LIMITED, isRetryable: true, suggestedDelay: 300000 },
  };

  classify(
    error: { code: string | number; message?: string },
    context?: Record<string, unknown>
  ): FailureClassification {
    const code = typeof error.code === 'number' ? error.code : parseInt(error.code, 10);
    const mapped = this.errorMap[code];

    if (mapped) {
      return {
        category: mapped.category || FailureCategory.UNKNOWN,
        platform: this.platform,
        isRetryable: mapped.isRetryable ?? false,
        suggestedDelay: mapped.suggestedDelay,
        action: mapped.action,
        requiresHumanReview: mapped.category === FailureCategory.PERMANENT,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    return {
      category: FailureCategory.UNKNOWN,
      platform: this.platform,
      isRetryable: false,
      requiresHumanReview: true,
      originalError: error,
      context,
      classifiedAt: new Date(),
    };
  }
}

export class InstagramClassifier implements PlatformClassifier {
  private readonly platform: Platform = 'instagram';

  classify(
    error: { code: string | number; message?: string },
    context?: Record<string, unknown>
  ): FailureClassification {
    const code = error.code;

    // Rate limits
    if (code === 4 || code === 'feedback_required') {
      return {
        category: FailureCategory.RATE_LIMITED,
        platform: this.platform,
        isRetryable: true,
        suggestedDelay: code === 'feedback_required' ? 3600000 : 60000,
        requiresHumanReview: code === 'feedback_required',
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Auth errors
    if (code === 190 || code === 'challenge_required') {
      return {
        category: FailureCategory.AUTH_ERROR,
        platform: this.platform,
        isRetryable: true,
        action: code === 'challenge_required' ? 'complete_challenge' : 'refresh_token',
        requiresHumanReview: code === 'challenge_required',
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Content policy
    if (
      code === 'content_policy_violation' ||
      String(error.message).includes('violates')
    ) {
      return {
        category: FailureCategory.CONTENT_POLICY,
        platform: this.platform,
        isRetryable: false,
        requiresHumanReview: true,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    return {
      category: FailureCategory.UNKNOWN,
      platform: this.platform,
      isRetryable: false,
      requiresHumanReview: true,
      originalError: error,
      context,
      classifiedAt: new Date(),
    };
  }
}

export class TikTokClassifier implements PlatformClassifier {
  private readonly platform: Platform = 'tiktok';

  classify(
    error: { code: string | number; message?: string },
    context?: Record<string, unknown>
  ): FailureClassification {
    const code = String(error.code);

    // Rate limits
    if (
      code === 'spam_risk_too_many_pending_share' ||
      code === 'rate_limit_exceeded'
    ) {
      return {
        category: FailureCategory.RATE_LIMITED,
        platform: this.platform,
        isRetryable: true,
        suggestedDelay: 300000,
        requiresHumanReview: false,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Permanent failures
    if (
      code === 'video_format_check_failed' ||
      code === 'video_duration_check_failed' ||
      code === 'invalid_params'
    ) {
      return {
        category: FailureCategory.PERMANENT,
        platform: this.platform,
        isRetryable: false,
        requiresHumanReview: true,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Auth errors
    if (code === 'scope_not_authorized' || code === 'access_token_invalid') {
      return {
        category: FailureCategory.AUTH_ERROR,
        platform: this.platform,
        isRetryable: true,
        action: 'refresh_token',
        requiresHumanReview: false,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Content policy
    if (code === 'content_not_allowed' || code.includes('policy')) {
      return {
        category: FailureCategory.CONTENT_POLICY,
        platform: this.platform,
        isRetryable: false,
        requiresHumanReview: true,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    return {
      category: FailureCategory.UNKNOWN,
      platform: this.platform,
      isRetryable: false,
      requiresHumanReview: true,
      originalError: error,
      context,
      classifiedAt: new Date(),
    };
  }
}

export class YouTubeClassifier implements PlatformClassifier {
  private readonly platform: Platform = 'youtube';

  classify(
    error: { code: string | number; message?: string },
    context?: Record<string, unknown>
  ): FailureClassification {
    const code = String(error.code);

    // Rate limits
    if (
      code === 'quotaExceeded' ||
      code === 'rateLimitExceeded' ||
      code === 'uploadLimitExceeded'
    ) {
      return {
        category: FailureCategory.RATE_LIMITED,
        platform: this.platform,
        isRetryable: true,
        suggestedDelay: code === 'quotaExceeded' ? 86400000 : 60000,
        requiresHumanReview: code === 'quotaExceeded',
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Permanent failures
    if (code === 'forbidden' || code === 'notFound') {
      return {
        category: FailureCategory.PERMANENT,
        platform: this.platform,
        isRetryable: false,
        requiresHumanReview: true,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Content policy
    if (code === 'videoRejected' || code.includes('policy')) {
      return {
        category: FailureCategory.CONTENT_POLICY,
        platform: this.platform,
        isRetryable: false,
        requiresHumanReview: true,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Auth errors
    if (code === 'unauthorized' || error.code === 401) {
      return {
        category: FailureCategory.AUTH_ERROR,
        platform: this.platform,
        isRetryable: true,
        action: 'refresh_token',
        requiresHumanReview: false,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    return {
      category: FailureCategory.UNKNOWN,
      platform: this.platform,
      isRetryable: false,
      requiresHumanReview: true,
      originalError: error,
      context,
      classifiedAt: new Date(),
    };
  }
}

export class LinkedInClassifier implements PlatformClassifier {
  private readonly platform: Platform = 'linkedin';

  classify(
    error: { code: string | number; message?: string },
    context?: Record<string, unknown>
  ): FailureClassification {
    const code = error.code;

    // Rate limits
    if (code === 429) {
      return {
        category: FailureCategory.RATE_LIMITED,
        platform: this.platform,
        isRetryable: true,
        suggestedDelay: 60000,
        requiresHumanReview: false,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Auth errors
    if (code === 'INVALID_ACCESS_TOKEN' || code === 401) {
      return {
        category: FailureCategory.AUTH_ERROR,
        platform: this.platform,
        isRetryable: true,
        action: 'refresh_token',
        requiresHumanReview: false,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Content policy
    if (
      code === 'CONTENT_MODERATION' ||
      code === 'spam_detected' ||
      String(error.message).includes('spam')
    ) {
      return {
        category: FailureCategory.CONTENT_POLICY,
        platform: this.platform,
        isRetryable: false,
        requiresHumanReview: true,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    return {
      category: FailureCategory.UNKNOWN,
      platform: this.platform,
      isRetryable: false,
      requiresHumanReview: true,
      originalError: error,
      context,
      classifiedAt: new Date(),
    };
  }
}

export class XClassifier implements PlatformClassifier {
  private readonly platform: Platform = 'x';

  classify(
    error: { code: string | number; message?: string },
    context?: Record<string, unknown>
  ): FailureClassification {
    const code = error.code;
    const message = String(error.message || '').toLowerCase();

    // Rate limits
    if (code === 429 || message.includes('too many requests')) {
      return {
        category: FailureCategory.RATE_LIMITED,
        platform: this.platform,
        isRetryable: true,
        suggestedDelay: 900000, // 15 minutes
        requiresHumanReview: false,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Auth errors
    if (code === 401) {
      return {
        category: FailureCategory.AUTH_ERROR,
        platform: this.platform,
        isRetryable: true,
        action: 'refresh_token',
        requiresHumanReview: false,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Permanent (suspension)
    if (code === 403 && message.includes('suspended')) {
      return {
        category: FailureCategory.PERMANENT,
        platform: this.platform,
        isRetryable: false,
        requiresHumanReview: true,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    // Content policy
    if (code === 'duplicate_tweet' || message.includes('duplicate')) {
      return {
        category: FailureCategory.CONTENT_POLICY,
        platform: this.platform,
        isRetryable: false,
        requiresHumanReview: false,
        originalError: error,
        context,
        classifiedAt: new Date(),
      };
    }

    return {
      category: FailureCategory.UNKNOWN,
      platform: this.platform,
      isRetryable: false,
      requiresHumanReview: true,
      originalError: error,
      context,
      classifiedAt: new Date(),
    };
  }
}
```

#### 2.3 Create Classifier Service
```typescript
// packages/verification/src/classifier-service.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  FailureCategory,
  FailureClassification,
  classifyFailure,
} from './failure-classification';
import { Platform } from './types';
import type { ExternalMemory } from '@rtv/core';

const tracer = trace.getTracer('classifier-service');

interface ClassifierServiceConfig {
  externalMemory: ExternalMemory;
}

interface ClassifyAndEmitParams {
  platform: Platform;
  error: { code: string | number; message?: string };
  clientId: string;
  postId?: string;
  context?: Record<string, unknown>;
}

interface RecommendedAction {
  type: 'retry' | 'wait_and_retry' | 'refresh_token' | 'escalate' | 'modify_content' | 'abort';
  delayMs?: number;
  requiresHuman: boolean;
  reason: string;
}

interface FailureAggregation {
  byCategory: Record<FailureCategory, number>;
  byPlatform: Record<string, number>;
  total: number;
}

export class ClassifierService {
  private memory: ExternalMemory;
  private failureHistory: Map<string, FailureClassification[]> = new Map();

  constructor(config: ClassifierServiceConfig) {
    this.memory = config.externalMemory;
  }

  async classifyAndEmit(params: ClassifyAndEmitParams): Promise<FailureClassification> {
    return tracer.startActiveSpan('classifyAndEmit', async (span) => {
      span.setAttributes({
        'failure.platform': params.platform,
        'failure.client_id': params.clientId,
        'failure.error_code': String(params.error.code),
      });

      const classification = classifyFailure({
        platform: params.platform,
        error: params.error,
        context: params.context,
      });

      // Store in history
      const history = this.failureHistory.get(params.clientId) || [];
      history.push(classification);
      this.failureHistory.set(params.clientId, history);

      // Emit to external memory
      await this.memory.append(params.clientId, {
        type: 'failure_classified',
        platform: params.platform,
        category: classification.category,
        isRetryable: classification.isRetryable,
        requiresHumanReview: classification.requiresHumanReview,
        errorCode: params.error.code,
        errorMessage: params.error.message,
        postId: params.postId,
        classifiedAt: classification.classifiedAt.toISOString(),
      });

      span.setAttributes({
        'failure.category': classification.category,
        'failure.is_retryable': classification.isRetryable,
        'failure.requires_human': classification.requiresHumanReview,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return classification;
    });
  }

  getRecommendedAction(
    classification: Partial<FailureClassification>
  ): RecommendedAction {
    const { category, isRetryable, action, suggestedDelay, requiresHumanReview } =
      classification;

    switch (category) {
      case FailureCategory.TRANSIENT:
        return {
          type: 'retry',
          requiresHuman: false,
          reason: 'Transient failure - retry should succeed',
        };

      case FailureCategory.RATE_LIMITED:
        return {
          type: 'wait_and_retry',
          delayMs: suggestedDelay || 60000,
          requiresHuman: false,
          reason: 'Rate limited - wait before retrying',
        };

      case FailureCategory.AUTH_ERROR:
        if (action === 'refresh_token') {
          return {
            type: 'refresh_token',
            requiresHuman: false,
            reason: 'Token expired - refresh and retry',
          };
        }
        return {
          type: 'escalate',
          requiresHuman: true,
          reason: 'Auth error requires manual intervention',
        };

      case FailureCategory.CONTENT_POLICY:
        return {
          type: 'modify_content',
          requiresHuman: true,
          reason: 'Content violates policy - modification required',
        };

      case FailureCategory.PERMANENT:
        return {
          type: 'escalate',
          requiresHuman: true,
          reason: 'Permanent failure - requires investigation',
        };

      default:
        return {
          type: requiresHumanReview ? 'escalate' : 'abort',
          requiresHuman: requiresHumanReview || false,
          reason: 'Unknown failure category',
        };
    }
  }

  aggregateFailures(clientId: string): FailureAggregation {
    const history = this.failureHistory.get(clientId) || [];

    const byCategory = {} as Record<FailureCategory, number>;
    const byPlatform = {} as Record<string, number>;

    for (const classification of history) {
      byCategory[classification.category] =
        (byCategory[classification.category] || 0) + 1;
      byPlatform[classification.platform] =
        (byPlatform[classification.platform] || 0) + 1;
    }

    return {
      byCategory,
      byPlatform,
      total: history.length,
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
| Create | `packages/verification/src/failure-classification.ts` | Core classification logic |
| Create | `packages/verification/src/platform-classifiers.ts` | Platform-specific classifiers |
| Create | `packages/verification/src/classifier-service.ts` | Classification service |
| Create | `packages/verification/src/__tests__/failure-category.test.ts` | Category tests |
| Create | `packages/verification/src/__tests__/platform-classifiers.test.ts` | Platform tests |
| Create | `packages/verification/src/__tests__/classifier-service.test.ts` | Service tests |
| Modify | `packages/verification/src/index.ts` | Export classification module |

---

## Acceptance Criteria

- [ ] All failure categories defined (transient, permanent, rate_limited, auth_error, content_policy, platform_error, unknown)
- [ ] Platform-specific classifiers for Facebook, Instagram, TikTok, YouTube, LinkedIn, X
- [ ] Helper functions for category checking (isTransient, isPermanent, etc.)
- [ ] Recommended action generation based on classification
- [ ] Failure aggregation for analytics
- [ ] Classification events emitted to external memory
- [ ] Unit tests achieve 90%+ coverage

---

## Test Requirements

### Unit Tests
- Failure category enum
- classifyFailure function with various inputs
- Each platform classifier
- Helper functions
- ClassifierService methods

### Integration Tests
- Full classification flow with external memory
- Aggregation over time

---

## Security & Safety Checklist

- [ ] No sensitive data in classification (only error codes/messages)
- [ ] Client isolation in failure history
- [ ] No secrets logged in error messages
- [ ] Classification doesn't expose internal system details

---

## JSON Task Block

```json
{
  "task_id": "S3-D4",
  "name": "Failure Classification",
  "description": "Categorize publishing failures into transient vs permanent for intelligent retry decisions",
  "status": "pending",
  "priority": "medium",
  "complexity": "medium",
  "sprint": 3,
  "agent": "D",
  "dependencies": ["S3-D1"],
  "blocks": ["S3-D3", "S3-D5"],
  "estimated_hours": 8,
  "actual_hours": null,
  "tags": ["verification", "failure", "classification", "error-handling", "tdd"],
  "package": "@rtv/verification",
  "files": {
    "create": [
      "packages/verification/src/failure-classification.ts",
      "packages/verification/src/platform-classifiers.ts",
      "packages/verification/src/classifier-service.ts"
    ],
    "modify": [
      "packages/verification/src/index.ts"
    ],
    "delete": []
  },
  "acceptance_criteria": [
    "All failure categories defined",
    "Platform-specific classifiers",
    "Recommended action generation",
    "Failure aggregation",
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
  "failure_patterns": {},
  "next_task_hints": [
    "S3-D3 for retry logic integration",
    "S3-D5 for rollback handling"
  ]
}
```
