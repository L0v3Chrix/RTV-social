# Build Prompt: S3-D2 — Proof Capture System

## Metadata
| Field | Value |
|-------|-------|
| Task ID | S3-D2 |
| Sprint | 3 — Scheduling + Publishing |
| Agent | D — Publish Verification System |
| Complexity | High |
| Status | Pending |
| Estimated Effort | 2 days |
| Dependencies | S3-D1, S3-C5 |
| Blocks | S3-D5 |

---

## Context

### What We're Building
A Proof Capture System that creates immutable evidence of post publication. When content is verified as live, the system captures screenshots, post metadata, timestamps, and cryptographic hashes to create a tamper-proof proof bundle. This serves as client-facing evidence and legal protection.

### Why It Matters
- **Client Reporting**: Proof that promised posts were delivered
- **Legal Protection**: Evidence in case of disputes
- **Audit Trail**: Complete history of publishing activity
- **Compliance**: Meet regulatory requirements for content proof
- **Trust Building**: Demonstrate transparency to clients

### Spec References
- `docs/01-architecture/system-architecture-v3.md` — Publishing pipeline
- `docs/02-schemas/external-memory-schema.md` — ProofBundle schema
- `docs/04-browser-lane/browser-automation-profile-vault.md` — Artifact capture
- `docs/05-policy-safety/compliance-safety-framework.md` — Audit requirements
- `docs/06-reliability-ops/slo-error-budget.md` — Proof capture SLOs

---

## Prerequisites

### Completed Tasks
- [x] S3-D1: Post Verification API
- [x] S3-C5: Browser Artifacts system

### Required Packages
```json
{
  "dependencies": {
    "puppeteer-core": "^22.0.0",
    "@aws-sdk/client-s3": "^3.500.0",
    "sharp": "^0.33.0",
    "crypto": "native",
    "archiver": "^7.0.0",
    "@rtv/verification": "workspace:*",
    "@rtv/browser-lane": "workspace:*",
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

#### 1.1 Proof Bundle Tests
```typescript
// packages/verification/src/__tests__/proof-bundle.test.ts
import { describe, it, expect } from 'vitest';
import {
  ProofBundle,
  createProofBundle,
  verifyProofBundle,
  calculateBundleHash,
} from '../proof-bundle';

describe('ProofBundle', () => {
  describe('createProofBundle', () => {
    it('should create proof bundle with all required fields', () => {
      const bundle = createProofBundle({
        postId: 'post_123',
        platform: 'facebook',
        externalPostId: 'fb_post_456',
        clientId: 'client_abc',
        verificationResult: {
          status: 'visible',
          isVisible: true,
          verifiedAt: new Date('2025-01-15T12:00:00Z'),
        },
        screenshot: {
          data: Buffer.from('screenshot-data'),
          mimeType: 'image/png',
          width: 1920,
          height: 1080,
        },
      });

      expect(bundle.id).toBeDefined();
      expect(bundle.postId).toBe('post_123');
      expect(bundle.platform).toBe('facebook');
      expect(bundle.createdAt).toBeInstanceOf(Date);
      expect(bundle.hash).toBeDefined();
    });

    it('should generate unique proof bundle ID', () => {
      const bundle1 = createProofBundle({
        postId: 'post_123',
        platform: 'instagram',
        externalPostId: 'ig_post_789',
        clientId: 'client_abc',
        verificationResult: { status: 'visible', isVisible: true },
      });

      const bundle2 = createProofBundle({
        postId: 'post_456',
        platform: 'instagram',
        externalPostId: 'ig_post_012',
        clientId: 'client_abc',
        verificationResult: { status: 'visible', isVisible: true },
      });

      expect(bundle1.id).not.toBe(bundle2.id);
    });

    it('should include metadata when provided', () => {
      const bundle = createProofBundle({
        postId: 'post_123',
        platform: 'tiktok',
        externalPostId: 'tt_video_123',
        clientId: 'client_abc',
        verificationResult: { status: 'visible', isVisible: true },
        metadata: {
          viewCount: 1000,
          likeCount: 50,
          commentCount: 10,
        },
      });

      expect(bundle.metadata?.viewCount).toBe(1000);
    });

    it('should include post URL when provided', () => {
      const bundle = createProofBundle({
        postId: 'post_123',
        platform: 'linkedin',
        externalPostId: 'li_post_456',
        clientId: 'client_abc',
        verificationResult: { status: 'visible', isVisible: true },
        postUrl: 'https://linkedin.com/feed/update/urn:li:activity:12345',
      });

      expect(bundle.postUrl).toContain('linkedin.com');
    });
  });

  describe('calculateBundleHash', () => {
    it('should generate consistent hash for same content', () => {
      const content = {
        postId: 'post_123',
        platform: 'youtube',
        externalPostId: 'yt_video_789',
        verifiedAt: '2025-01-15T12:00:00Z',
      };

      const hash1 = calculateBundleHash(content);
      const hash2 = calculateBundleHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const content1 = {
        postId: 'post_123',
        platform: 'x',
        externalPostId: 'x_tweet_111',
        verifiedAt: '2025-01-15T12:00:00Z',
      };

      const content2 = {
        postId: 'post_123',
        platform: 'x',
        externalPostId: 'x_tweet_222',
        verifiedAt: '2025-01-15T12:00:00Z',
      };

      const hash1 = calculateBundleHash(content1);
      const hash2 = calculateBundleHash(content2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyProofBundle', () => {
    it('should verify valid proof bundle', () => {
      const bundle = createProofBundle({
        postId: 'post_123',
        platform: 'facebook',
        externalPostId: 'fb_post_456',
        clientId: 'client_abc',
        verificationResult: { status: 'visible', isVisible: true },
      });

      const isValid = verifyProofBundle(bundle);

      expect(isValid).toBe(true);
    });

    it('should reject tampered proof bundle', () => {
      const bundle = createProofBundle({
        postId: 'post_123',
        platform: 'instagram',
        externalPostId: 'ig_post_789',
        clientId: 'client_abc',
        verificationResult: { status: 'visible', isVisible: true },
      });

      // Tamper with the bundle
      bundle.postId = 'post_999';

      const isValid = verifyProofBundle(bundle);

      expect(isValid).toBe(false);
    });
  });
});
```

#### 1.2 Screenshot Capture Tests
```typescript
// packages/verification/src/__tests__/screenshot-capture.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScreenshotCapture } from '../screenshot-capture';
import { createMockBrowser } from './__mocks__/browser';

describe('ScreenshotCapture', () => {
  let capture: ScreenshotCapture;
  let mockBrowser: ReturnType<typeof createMockBrowser>;

  beforeEach(() => {
    mockBrowser = createMockBrowser();
    capture = new ScreenshotCapture({
      browser: mockBrowser,
    });
  });

  describe('capturePost', () => {
    it('should capture full-page screenshot of post', async () => {
      mockBrowser.newPage.mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('png-data')),
        close: vi.fn(),
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        setViewport: vi.fn(),
      });

      const result = await capture.capturePost({
        postUrl: 'https://facebook.com/123/posts/456',
        platform: 'facebook',
      });

      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.mimeType).toBe('image/png');
      expect(result.width).toBeDefined();
      expect(result.height).toBeDefined();
    });

    it('should wait for post content to load', async () => {
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('png-data')),
        close: vi.fn(),
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        setViewport: vi.fn(),
      };
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await capture.capturePost({
        postUrl: 'https://instagram.com/p/ABC123',
        platform: 'instagram',
      });

      expect(mockPage.waitForSelector).toHaveBeenCalled();
    });

    it('should use platform-specific viewport', async () => {
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('png-data')),
        close: vi.fn(),
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        setViewport: vi.fn(),
      };
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await capture.capturePost({
        postUrl: 'https://tiktok.com/@user/video/123',
        platform: 'tiktok',
      });

      // TikTok uses mobile viewport
      expect(mockPage.setViewport).toHaveBeenCalledWith(
        expect.objectContaining({
          isMobile: true,
        })
      );
    });

    it('should handle screenshot timeout', async () => {
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockRejectedValue(new Error('Timeout')),
        close: vi.fn(),
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        setViewport: vi.fn(),
      };
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await expect(
        capture.capturePost({
          postUrl: 'https://youtube.com/watch?v=xyz',
          platform: 'youtube',
        })
      ).rejects.toThrow('Timeout');
    });

    it('should close page after capture', async () => {
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('png-data')),
        close: vi.fn(),
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        setViewport: vi.fn(),
      };
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await capture.capturePost({
        postUrl: 'https://linkedin.com/posts/123',
        platform: 'linkedin',
      });

      expect(mockPage.close).toHaveBeenCalled();
    });
  });

  describe('captureElement', () => {
    it('should capture specific element', async () => {
      const mockElement = {
        screenshot: vi.fn().mockResolvedValue(Buffer.from('element-png')),
        boundingBox: vi.fn().mockResolvedValue({
          x: 0,
          y: 0,
          width: 400,
          height: 300,
        }),
      };
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        $: vi.fn().mockResolvedValue(mockElement),
        close: vi.fn(),
        setViewport: vi.fn(),
      };
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const result = await capture.captureElement({
        postUrl: 'https://x.com/user/status/123',
        platform: 'x',
        selector: '[data-testid="tweet"]',
      });

      expect(result.data).toBeInstanceOf(Buffer);
      expect(mockPage.$).toHaveBeenCalledWith('[data-testid="tweet"]');
    });
  });
});
```

#### 1.3 Proof Service Tests
```typescript
// packages/verification/src/__tests__/proof-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProofService } from '../proof-service';
import { createMockScreenshotCapture } from './__mocks__/screenshot-capture';
import { createMockStorage } from './__mocks__/storage';
import { createMockExternalMemory } from './__mocks__/external-memory';

describe('ProofService', () => {
  let service: ProofService;
  let mockCapture: ReturnType<typeof createMockScreenshotCapture>;
  let mockStorage: ReturnType<typeof createMockStorage>;
  let mockMemory: ReturnType<typeof createMockExternalMemory>;

  beforeEach(() => {
    mockCapture = createMockScreenshotCapture();
    mockStorage = createMockStorage();
    mockMemory = createMockExternalMemory();
    service = new ProofService({
      screenshotCapture: mockCapture,
      storage: mockStorage,
      externalMemory: mockMemory,
    });
  });

  describe('captureProof', () => {
    it('should capture screenshot and create proof bundle', async () => {
      mockCapture.capturePost.mockResolvedValue({
        data: Buffer.from('screenshot-data'),
        mimeType: 'image/png',
        width: 1920,
        height: 1080,
      });
      mockStorage.upload.mockResolvedValue({
        url: 'https://storage.example.com/proofs/bundle_123.zip',
      });

      const proof = await service.captureProof({
        postId: 'post_123',
        platform: 'facebook',
        externalPostId: 'fb_post_456',
        postUrl: 'https://facebook.com/123/posts/456',
        clientId: 'client_abc',
        verificationResult: {
          status: 'visible',
          isVisible: true,
          verifiedAt: new Date(),
        },
      });

      expect(proof.bundle).toBeDefined();
      expect(proof.bundle.screenshot).toBeDefined();
      expect(proof.storageUrl).toContain('storage.example.com');
    });

    it('should store proof bundle in S3', async () => {
      mockCapture.capturePost.mockResolvedValue({
        data: Buffer.from('screenshot-data'),
        mimeType: 'image/png',
        width: 1920,
        height: 1080,
      });

      await service.captureProof({
        postId: 'post_123',
        platform: 'instagram',
        externalPostId: 'ig_post_789',
        postUrl: 'https://instagram.com/p/ABC123',
        clientId: 'client_abc',
        verificationResult: {
          status: 'visible',
          isVisible: true,
          verifiedAt: new Date(),
        },
      });

      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: expect.any(String),
          key: expect.stringContaining('client_abc'),
        })
      );
    });

    it('should emit proof event to external memory', async () => {
      mockCapture.capturePost.mockResolvedValue({
        data: Buffer.from('screenshot-data'),
        mimeType: 'image/png',
        width: 1920,
        height: 1080,
      });

      await service.captureProof({
        postId: 'post_123',
        platform: 'tiktok',
        externalPostId: 'tt_video_111',
        postUrl: 'https://tiktok.com/@user/video/111',
        clientId: 'client_xyz',
        verificationResult: {
          status: 'visible',
          isVisible: true,
          verifiedAt: new Date(),
        },
      });

      expect(mockMemory.append).toHaveBeenCalledWith(
        'client_xyz',
        expect.objectContaining({
          type: 'proof_captured',
          postId: 'post_123',
          platform: 'tiktok',
        })
      );
    });

    it('should handle screenshot capture failure gracefully', async () => {
      mockCapture.capturePost.mockRejectedValue(new Error('Page not found'));

      const proof = await service.captureProof({
        postId: 'post_123',
        platform: 'youtube',
        externalPostId: 'yt_video_222',
        postUrl: 'https://youtube.com/watch?v=xyz',
        clientId: 'client_abc',
        verificationResult: {
          status: 'visible',
          isVisible: true,
          verifiedAt: new Date(),
        },
      });

      // Should still create bundle without screenshot
      expect(proof.bundle).toBeDefined();
      expect(proof.bundle.screenshot).toBeUndefined();
      expect(proof.bundle.screenshotError).toBe('Page not found');
    });

    it('should include post metadata in proof bundle', async () => {
      mockCapture.capturePost.mockResolvedValue({
        data: Buffer.from('screenshot-data'),
        mimeType: 'image/png',
        width: 1920,
        height: 1080,
      });

      const proof = await service.captureProof({
        postId: 'post_123',
        platform: 'linkedin',
        externalPostId: 'li_post_333',
        postUrl: 'https://linkedin.com/posts/333',
        clientId: 'client_abc',
        verificationResult: {
          status: 'visible',
          isVisible: true,
          verifiedAt: new Date(),
        },
        postMetadata: {
          title: 'Test Post',
          likeCount: 50,
          commentCount: 10,
        },
      });

      expect(proof.bundle.metadata?.likeCount).toBe(50);
    });
  });

  describe('getProof', () => {
    it('should retrieve proof bundle from storage', async () => {
      const bundleData = {
        id: 'proof_123',
        postId: 'post_456',
        platform: 'facebook',
      };
      mockStorage.download.mockResolvedValue(Buffer.from(JSON.stringify(bundleData)));

      const proof = await service.getProof({
        proofId: 'proof_123',
        clientId: 'client_abc',
      });

      expect(proof.id).toBe('proof_123');
      expect(mockStorage.download).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringContaining('proof_123'),
        })
      );
    });

    it('should enforce client isolation', async () => {
      mockStorage.download.mockResolvedValue(null);

      await expect(
        service.getProof({
          proofId: 'proof_123',
          clientId: 'different_client',
        })
      ).rejects.toThrow('Proof not found');
    });
  });

  describe('listProofs', () => {
    it('should list proofs for a post', async () => {
      mockStorage.list.mockResolvedValue([
        { key: 'proofs/client_abc/post_123/proof_1.json' },
        { key: 'proofs/client_abc/post_123/proof_2.json' },
      ]);

      const proofs = await service.listProofs({
        postId: 'post_123',
        clientId: 'client_abc',
      });

      expect(proofs).toHaveLength(2);
    });

    it('should filter proofs by date range', async () => {
      mockStorage.list.mockResolvedValue([
        { key: 'proofs/client_abc/post_123/proof_1.json', lastModified: new Date('2025-01-15') },
        { key: 'proofs/client_abc/post_123/proof_2.json', lastModified: new Date('2025-01-10') },
      ]);

      const proofs = await service.listProofs({
        postId: 'post_123',
        clientId: 'client_abc',
        startDate: new Date('2025-01-14'),
      });

      expect(proofs).toHaveLength(1);
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Create Proof Bundle Types
```typescript
// packages/verification/src/proof-bundle.ts
import crypto from 'crypto';
import { Platform, VerificationResult } from './types';

export interface Screenshot {
  data: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
}

export interface ProofBundle {
  id: string;
  postId: string;
  platform: Platform;
  externalPostId: string;
  clientId: string;
  verificationResult: Pick<VerificationResult, 'status' | 'isVisible' | 'verifiedAt'>;
  screenshot?: Screenshot;
  screenshotError?: string;
  postUrl?: string;
  metadata?: Record<string, unknown>;
  hash: string;
  createdAt: Date;
}

interface CreateProofBundleParams {
  postId: string;
  platform: Platform;
  externalPostId: string;
  clientId: string;
  verificationResult: Pick<VerificationResult, 'status' | 'isVisible' | 'verifiedAt'>;
  screenshot?: Screenshot;
  screenshotError?: string;
  postUrl?: string;
  metadata?: Record<string, unknown>;
}

export function createProofBundle(params: CreateProofBundleParams): ProofBundle {
  const id = `proof_${crypto.randomUUID()}`;
  const createdAt = new Date();

  const hashContent = {
    postId: params.postId,
    platform: params.platform,
    externalPostId: params.externalPostId,
    verifiedAt: params.verificationResult.verifiedAt?.toISOString() || createdAt.toISOString(),
    screenshotHash: params.screenshot
      ? crypto.createHash('sha256').update(params.screenshot.data).digest('hex')
      : null,
  };

  const hash = calculateBundleHash(hashContent);

  return {
    id,
    postId: params.postId,
    platform: params.platform,
    externalPostId: params.externalPostId,
    clientId: params.clientId,
    verificationResult: params.verificationResult,
    screenshot: params.screenshot,
    screenshotError: params.screenshotError,
    postUrl: params.postUrl,
    metadata: params.metadata,
    hash,
    createdAt,
  };
}

export function calculateBundleHash(content: Record<string, unknown>): string {
  const sortedJson = JSON.stringify(content, Object.keys(content).sort());
  return crypto.createHash('sha256').update(sortedJson).digest('hex');
}

export function verifyProofBundle(bundle: ProofBundle): boolean {
  const hashContent = {
    postId: bundle.postId,
    platform: bundle.platform,
    externalPostId: bundle.externalPostId,
    verifiedAt: bundle.verificationResult.verifiedAt?.toISOString() || bundle.createdAt.toISOString(),
    screenshotHash: bundle.screenshot
      ? crypto.createHash('sha256').update(bundle.screenshot.data).digest('hex')
      : null,
  };

  const expectedHash = calculateBundleHash(hashContent);
  return bundle.hash === expectedHash;
}
```

#### 2.2 Create Screenshot Capture Service
```typescript
// packages/verification/src/screenshot-capture.ts
import type { Browser, Page } from 'puppeteer-core';
import { Platform, Screenshot } from './types';

interface ScreenshotCaptureConfig {
  browser: Browser;
  defaultTimeout?: number;
}

interface CapturePostRequest {
  postUrl: string;
  platform: Platform;
  fullPage?: boolean;
}

interface CaptureElementRequest {
  postUrl: string;
  platform: Platform;
  selector: string;
}

const PLATFORM_VIEWPORTS: Record<Platform, { width: number; height: number; isMobile: boolean }> = {
  facebook: { width: 1920, height: 1080, isMobile: false },
  instagram: { width: 414, height: 896, isMobile: true },
  tiktok: { width: 414, height: 896, isMobile: true },
  youtube: { width: 1920, height: 1080, isMobile: false },
  linkedin: { width: 1920, height: 1080, isMobile: false },
  x: { width: 1280, height: 800, isMobile: false },
  skool: { width: 1920, height: 1080, isMobile: false },
};

const PLATFORM_SELECTORS: Record<Platform, string> = {
  facebook: '[data-pagelet="FeedUnit"]',
  instagram: 'article',
  tiktok: '[data-e2e="video-player"]',
  youtube: '#content',
  linkedin: '.feed-shared-update-v2',
  x: '[data-testid="tweet"]',
  skool: '.post-container',
};

export class ScreenshotCapture {
  private browser: Browser;
  private defaultTimeout: number;

  constructor(config: ScreenshotCaptureConfig) {
    this.browser = config.browser;
    this.defaultTimeout = config.defaultTimeout || 30000;
  }

  async capturePost(request: CapturePostRequest): Promise<Screenshot> {
    const page = await this.browser.newPage();

    try {
      const viewport = PLATFORM_VIEWPORTS[request.platform];
      await page.setViewport(viewport);

      await page.goto(request.postUrl, {
        waitUntil: 'networkidle2',
        timeout: this.defaultTimeout,
      });

      // Wait for content to load
      const selector = PLATFORM_SELECTORS[request.platform];
      await page.waitForSelector(selector, { timeout: this.defaultTimeout });

      const screenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: request.fullPage ?? false,
      });

      return {
        data: screenshotBuffer as Buffer,
        mimeType: 'image/png',
        width: viewport.width,
        height: viewport.height,
      };
    } finally {
      await page.close();
    }
  }

  async captureElement(request: CaptureElementRequest): Promise<Screenshot> {
    const page = await this.browser.newPage();

    try {
      const viewport = PLATFORM_VIEWPORTS[request.platform];
      await page.setViewport(viewport);

      await page.goto(request.postUrl, {
        waitUntil: 'networkidle2',
        timeout: this.defaultTimeout,
      });

      const element = await page.$(request.selector);
      if (!element) {
        throw new Error(`Element not found: ${request.selector}`);
      }

      const boundingBox = await element.boundingBox();
      if (!boundingBox) {
        throw new Error('Could not get element bounding box');
      }

      const screenshotBuffer = await element.screenshot({ type: 'png' });

      return {
        data: screenshotBuffer as Buffer,
        mimeType: 'image/png',
        width: Math.round(boundingBox.width),
        height: Math.round(boundingBox.height),
      };
    } finally {
      await page.close();
    }
  }
}
```

#### 2.3 Create Proof Service
```typescript
// packages/verification/src/proof-service.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import archiver from 'archiver';
import { Readable } from 'stream';
import {
  ProofBundle,
  createProofBundle,
} from './proof-bundle';
import { Platform, VerificationResult } from './types';
import type { ScreenshotCapture } from './screenshot-capture';
import type { ExternalMemory } from '@rtv/core';

const tracer = trace.getTracer('proof-service');

interface ProofServiceConfig {
  screenshotCapture: ScreenshotCapture;
  storage: StorageClient;
  externalMemory: ExternalMemory;
  bucketName?: string;
}

interface CaptureProofRequest {
  postId: string;
  platform: Platform;
  externalPostId: string;
  postUrl: string;
  clientId: string;
  verificationResult: Pick<VerificationResult, 'status' | 'isVisible' | 'verifiedAt'>;
  postMetadata?: Record<string, unknown>;
}

interface CaptureProofResult {
  bundle: ProofBundle;
  storageUrl: string;
}

interface GetProofRequest {
  proofId: string;
  clientId: string;
}

interface ListProofsRequest {
  postId: string;
  clientId: string;
  startDate?: Date;
  endDate?: Date;
}

interface StorageClient {
  upload(params: { bucket: string; key: string; body: Buffer; contentType: string }): Promise<{ url: string }>;
  download(params: { bucket: string; key: string }): Promise<Buffer | null>;
  list(params: { bucket: string; prefix: string }): Promise<{ key: string; lastModified?: Date }[]>;
}

export class ProofService {
  private capture: ScreenshotCapture;
  private storage: StorageClient;
  private memory: ExternalMemory;
  private bucketName: string;

  constructor(config: ProofServiceConfig) {
    this.capture = config.screenshotCapture;
    this.storage = config.storage;
    this.memory = config.externalMemory;
    this.bucketName = config.bucketName || 'rtv-proofs';
  }

  async captureProof(request: CaptureProofRequest): Promise<CaptureProofResult> {
    return tracer.startActiveSpan('captureProof', async (span) => {
      span.setAttributes({
        'proof.post_id': request.postId,
        'proof.platform': request.platform,
        'proof.client_id': request.clientId,
      });

      let screenshot;
      let screenshotError;

      // Try to capture screenshot
      try {
        screenshot = await this.capture.capturePost({
          postUrl: request.postUrl,
          platform: request.platform,
        });
      } catch (error: any) {
        screenshotError = error.message;
        span.recordException(error);
      }

      // Create proof bundle
      const bundle = createProofBundle({
        postId: request.postId,
        platform: request.platform,
        externalPostId: request.externalPostId,
        clientId: request.clientId,
        verificationResult: request.verificationResult,
        screenshot,
        screenshotError,
        postUrl: request.postUrl,
        metadata: request.postMetadata,
      });

      // Create ZIP archive with proof data
      const archiveBuffer = await this.createArchive(bundle);

      // Upload to storage
      const storageKey = `proofs/${request.clientId}/${request.postId}/${bundle.id}.zip`;
      const { url: storageUrl } = await this.storage.upload({
        bucket: this.bucketName,
        key: storageKey,
        body: archiveBuffer,
        contentType: 'application/zip',
      });

      // Emit proof event
      await this.memory.append(request.clientId, {
        type: 'proof_captured',
        proofId: bundle.id,
        postId: request.postId,
        platform: request.platform,
        externalPostId: request.externalPostId,
        hash: bundle.hash,
        storageUrl,
        createdAt: bundle.createdAt.toISOString(),
        hasScreenshot: !!screenshot,
      });

      span.setAttributes({
        'proof.bundle_id': bundle.id,
        'proof.hash': bundle.hash,
        'proof.has_screenshot': !!screenshot,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return { bundle, storageUrl };
    });
  }

  private async createArchive(bundle: ProofBundle): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      // Add metadata JSON
      const metadataJson = JSON.stringify(
        {
          id: bundle.id,
          postId: bundle.postId,
          platform: bundle.platform,
          externalPostId: bundle.externalPostId,
          clientId: bundle.clientId,
          verificationResult: bundle.verificationResult,
          postUrl: bundle.postUrl,
          metadata: bundle.metadata,
          hash: bundle.hash,
          createdAt: bundle.createdAt.toISOString(),
        },
        null,
        2
      );
      archive.append(metadataJson, { name: 'proof.json' });

      // Add screenshot if available
      if (bundle.screenshot) {
        archive.append(bundle.screenshot.data, {
          name: `screenshot.${bundle.screenshot.mimeType === 'image/jpeg' ? 'jpg' : 'png'}`,
        });
      }

      archive.finalize();
    });
  }

  async getProof(request: GetProofRequest): Promise<ProofBundle> {
    const prefix = `proofs/${request.clientId}/`;
    const files = await this.storage.list({
      bucket: this.bucketName,
      prefix,
    });

    const proofFile = files.find((f) => f.key.includes(request.proofId));
    if (!proofFile) {
      throw new Error('Proof not found');
    }

    const data = await this.storage.download({
      bucket: this.bucketName,
      key: proofFile.key,
    });

    if (!data) {
      throw new Error('Proof not found');
    }

    // Extract and parse proof.json from ZIP
    // In production, use a proper ZIP library
    const bundle = JSON.parse(data.toString());
    return bundle;
  }

  async listProofs(request: ListProofsRequest): Promise<ProofBundle[]> {
    const prefix = `proofs/${request.clientId}/${request.postId}/`;
    let files = await this.storage.list({
      bucket: this.bucketName,
      prefix,
    });

    // Filter by date range
    if (request.startDate) {
      files = files.filter(
        (f) => f.lastModified && f.lastModified >= request.startDate!
      );
    }
    if (request.endDate) {
      files = files.filter(
        (f) => f.lastModified && f.lastModified <= request.endDate!
      );
    }

    // Load each bundle
    const bundles = await Promise.all(
      files.map(async (file) => {
        const data = await this.storage.download({
          bucket: this.bucketName,
          key: file.key,
        });
        if (!data) return null;
        return JSON.parse(data.toString()) as ProofBundle;
      })
    );

    return bundles.filter((b): b is ProofBundle => b !== null);
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
| Create | `packages/verification/src/proof-bundle.ts` | Proof bundle creation and verification |
| Create | `packages/verification/src/screenshot-capture.ts` | Screenshot capture service |
| Create | `packages/verification/src/proof-service.ts` | Main proof service |
| Create | `packages/verification/src/__tests__/proof-bundle.test.ts` | Proof bundle tests |
| Create | `packages/verification/src/__tests__/screenshot-capture.test.ts` | Screenshot capture tests |
| Create | `packages/verification/src/__tests__/proof-service.test.ts` | Proof service tests |
| Modify | `packages/verification/src/index.ts` | Export proof module |

---

## Acceptance Criteria

- [ ] Proof bundles include screenshot, metadata, and cryptographic hash
- [ ] Screenshots captured using platform-appropriate viewports
- [ ] Proof bundles stored in S3 as ZIP archives
- [ ] Bundle verification detects tampering
- [ ] Screenshot capture failures don't block proof creation
- [ ] All proof operations scoped to client ID
- [ ] Proof events emitted to external memory
- [ ] Unit tests achieve 90%+ coverage

---

## Test Requirements

### Unit Tests
- ProofBundle creation and hash calculation
- Bundle verification (valid and tampered)
- Screenshot capture with mocked browser
- ProofService storage operations

### Integration Tests
- Full proof capture flow
- S3 upload/download
- External memory events

### Contract Tests
- ProofBundle schema validation
- Storage key format validation

---

## Security & Safety Checklist

- [ ] No hardcoded secrets (S3 credentials from environment)
- [ ] Client ID required for all proof operations (tenant isolation)
- [ ] Cryptographic hash prevents tampering
- [ ] Audit events emitted for proof capture
- [ ] S3 keys include client ID for isolation
- [ ] Screenshot capture timeout prevents hanging

---

## JSON Task Block

```json
{
  "task_id": "S3-D2",
  "name": "Proof Capture System",
  "description": "Capture screenshots and create tamper-proof evidence bundles for published posts",
  "status": "pending",
  "priority": "high",
  "complexity": "high",
  "sprint": 3,
  "agent": "D",
  "dependencies": ["S3-D1", "S3-C5"],
  "blocks": ["S3-D5"],
  "estimated_hours": 16,
  "actual_hours": null,
  "tags": ["verification", "proof", "screenshot", "s3", "tdd"],
  "package": "@rtv/verification",
  "files": {
    "create": [
      "packages/verification/src/proof-bundle.ts",
      "packages/verification/src/screenshot-capture.ts",
      "packages/verification/src/proof-service.ts"
    ],
    "modify": [
      "packages/verification/src/index.ts"
    ],
    "delete": []
  },
  "acceptance_criteria": [
    "Proof bundles include screenshot and hash",
    "Platform-appropriate viewport sizes",
    "S3 storage with ZIP archives",
    "Tamper detection via hash verification",
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
  "proof_bundles_captured": [],
  "next_task_hints": [
    "S3-D3 for retry logic",
    "S3-D5 for rollback handling"
  ]
}
```
