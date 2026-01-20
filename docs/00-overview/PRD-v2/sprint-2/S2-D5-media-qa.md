# Build Prompt: S2-D5 — Media QA System

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-D5 |
| Sprint | 2 - Planning + Creation |
| Agent | D - Media Generation |
| Task Name | Media QA System |
| Complexity | High |
| Status | pending |
| Estimated Tokens | 12,000 |

---

## Context

### What We're Building

The Media QA System provides automated quality assessment for all generated media assets (images, videos, thumbnails). It ensures that generated content meets technical specifications, brand guidelines, and platform requirements before being scheduled for publishing.

### Why It Matters

- **Quality gate** — Prevents low-quality assets from reaching production
- **Brand protection** — Ensures visual consistency across all content
- **Platform compliance** — Validates assets meet each platform's requirements
- **Automated rejection** — Removes human bottleneck for obvious failures
- **Continuous improvement** — Feeds quality data back to generation systems

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Data Model | Media asset schema |
| `docs/03-agents-tools/tool-registry-spec.md` | Media Tools | QA tool interface |
| `docs/02-schemas/external-memory-schema.md` | Media Memory | Asset metadata format |
| `docs/07-engineering-process/testing-strategy.md` | Visual Testing | Image comparison testing |
| `docs/05-policy-safety/content-safety-policy.md` | Moderation | NSFW/safety checks |

---

## Prerequisites

### Completed Tasks

| Task ID | Provides |
|---------|----------|
| S2-D2 | ImageGenerationLane |
| S2-D3 | VideoGenerator |
| S2-D4 | ThumbnailGenerator |
| S1-A2 | BrandKit model |
| S1-B4 | Reference retrieval |

### Required Packages

```bash
pnpm add sharp @ffprobe-installer/ffprobe fluent-ffmpeg jimp ssim.js
pnpm add -D @types/fluent-ffmpeg vitest
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests that define the expected behavior.

#### Test File: `packages/agents/media/src/qa/__tests__/image-qa.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageQAScorer, type ImageQAInput, type ImageQAResult } from '../image-qa';
import { createTestImageBuffer, createTestBrandKit } from '@rtv/testing';

describe('ImageQAScorer', () => {
  let scorer: ImageQAScorer;

  beforeEach(() => {
    scorer = new ImageQAScorer();
  });

  describe('technical quality', () => {
    it('should pass image with correct resolution', async () => {
      const image = await createTestImageBuffer({
        width: 1080,
        height: 1080,
        format: 'png',
      });

      const result = await scorer.score({
        imageBuffer: image,
        expectedDimensions: { width: 1080, height: 1080 },
        format: 'png',
      });

      expect(result.dimensions.passed).toBe(true);
      expect(result.dimensions.actual).toEqual({ width: 1080, height: 1080 });
    });

    it('should fail image with wrong resolution', async () => {
      const image = await createTestImageBuffer({
        width: 800,
        height: 600,
        format: 'png',
      });

      const result = await scorer.score({
        imageBuffer: image,
        expectedDimensions: { width: 1080, height: 1080 },
        format: 'png',
      });

      expect(result.dimensions.passed).toBe(false);
      expect(result.dimensions.deviation).toBeGreaterThan(0);
    });

    it('should detect image format mismatch', async () => {
      const image = await createTestImageBuffer({
        width: 1080,
        height: 1080,
        format: 'jpeg',
      });

      const result = await scorer.score({
        imageBuffer: image,
        expectedDimensions: { width: 1080, height: 1080 },
        format: 'png',
      });

      expect(result.format.passed).toBe(false);
      expect(result.format.actual).toBe('jpeg');
      expect(result.format.expected).toBe('png');
    });

    it('should check minimum file size', async () => {
      const tinyImage = await createTestImageBuffer({
        width: 50,
        height: 50,
        format: 'png',
      });

      const result = await scorer.score({
        imageBuffer: tinyImage,
        expectedDimensions: { width: 50, height: 50 },
        format: 'png',
        minFileSizeKb: 100,
      });

      expect(result.fileSize.passed).toBe(false);
    });

    it('should check maximum file size', async () => {
      const largeImage = await createTestImageBuffer({
        width: 4000,
        height: 4000,
        format: 'png',
        fill: 'noise', // Large random data
      });

      const result = await scorer.score({
        imageBuffer: largeImage,
        expectedDimensions: { width: 4000, height: 4000 },
        format: 'png',
        maxFileSizeMb: 1,
      });

      // May or may not pass depending on compression
      expect(result.fileSize.actualKb).toBeDefined();
    });
  });

  describe('visual quality', () => {
    it('should detect blurry images', async () => {
      const blurryImage = await createTestImageBuffer({
        width: 1080,
        height: 1080,
        blur: 20, // Gaussian blur
      });

      const result = await scorer.score({
        imageBuffer: blurryImage,
        expectedDimensions: { width: 1080, height: 1080 },
        format: 'png',
        qualityChecks: ['sharpness'],
      });

      expect(result.visual.sharpness.score).toBeLessThan(0.5);
      expect(result.visual.sharpness.passed).toBe(false);
    });

    it('should detect low contrast images', async () => {
      const lowContrastImage = await createTestImageBuffer({
        width: 1080,
        height: 1080,
        contrast: 0.1, // Very low contrast
      });

      const result = await scorer.score({
        imageBuffer: lowContrastImage,
        expectedDimensions: { width: 1080, height: 1080 },
        format: 'png',
        qualityChecks: ['contrast'],
      });

      expect(result.visual.contrast.score).toBeLessThan(0.5);
    });

    it('should calculate color distribution', async () => {
      const colorfulImage = await createTestImageBuffer({
        width: 1080,
        height: 1080,
        fill: 'gradient',
      });

      const result = await scorer.score({
        imageBuffer: colorfulImage,
        expectedDimensions: { width: 1080, height: 1080 },
        format: 'png',
        qualityChecks: ['colorDistribution'],
      });

      expect(result.visual.colorDistribution.dominantColors).toHaveLength(5);
      expect(result.visual.colorDistribution.saturationAvg).toBeGreaterThan(0);
    });
  });

  describe('brand alignment', () => {
    it('should check brand color presence', async () => {
      const brandColors = ['#FF5733', '#33FF57', '#3357FF'];
      const brandAlignedImage = await createTestImageBuffer({
        width: 1080,
        height: 1080,
        fill: 'brand-colors',
        colors: brandColors,
      });

      const result = await scorer.score({
        imageBuffer: brandAlignedImage,
        expectedDimensions: { width: 1080, height: 1080 },
        format: 'png',
        brandKit: createTestBrandKit({ colors: brandColors }),
      });

      expect(result.brandAlignment.colorMatch.score).toBeGreaterThan(0.7);
    });

    it('should fail when brand colors are absent', async () => {
      const offBrandImage = await createTestImageBuffer({
        width: 1080,
        height: 1080,
        fill: 'random-colors',
      });

      const result = await scorer.score({
        imageBuffer: offBrandImage,
        expectedDimensions: { width: 1080, height: 1080 },
        format: 'png',
        brandKit: createTestBrandKit({ colors: ['#000000', '#FFFFFF'] }),
      });

      expect(result.brandAlignment.colorMatch.score).toBeLessThan(0.5);
    });
  });

  describe('overall scoring', () => {
    it('should calculate weighted overall score', async () => {
      const image = await createTestImageBuffer({
        width: 1080,
        height: 1080,
        format: 'png',
      });

      const result = await scorer.score({
        imageBuffer: image,
        expectedDimensions: { width: 1080, height: 1080 },
        format: 'png',
        weights: {
          technical: 0.4,
          visual: 0.4,
          brandAlignment: 0.2,
        },
      });

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
      expect(result.passed).toBeDefined();
    });

    it('should fail if any critical check fails', async () => {
      const wrongFormatImage = await createTestImageBuffer({
        width: 1080,
        height: 1080,
        format: 'jpeg',
      });

      const result = await scorer.score({
        imageBuffer: wrongFormatImage,
        expectedDimensions: { width: 1080, height: 1080 },
        format: 'png',
        criticalChecks: ['format'],
      });

      expect(result.passed).toBe(false);
      expect(result.failReasons).toContain('format_mismatch');
    });
  });
});
```

#### Test File: `packages/agents/media/src/qa/__tests__/video-qa.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { VideoQAScorer, type VideoQAResult } from '../video-qa';
import { createTestVideoBuffer } from '@rtv/testing';

describe('VideoQAScorer', () => {
  let scorer: VideoQAScorer;

  beforeEach(() => {
    scorer = new VideoQAScorer();
  });

  describe('technical validation', () => {
    it('should validate video duration', async () => {
      const video = await createTestVideoBuffer({
        durationSeconds: 15,
        width: 1080,
        height: 1920,
        fps: 30,
      });

      const result = await scorer.score({
        videoBuffer: video,
        expectedDuration: { min: 10, max: 60 },
        platform: 'tiktok',
      });

      expect(result.duration.passed).toBe(true);
      expect(result.duration.actualSeconds).toBe(15);
    });

    it('should fail video exceeding max duration', async () => {
      const longVideo = await createTestVideoBuffer({
        durationSeconds: 120,
        width: 1080,
        height: 1920,
        fps: 30,
      });

      const result = await scorer.score({
        videoBuffer: longVideo,
        expectedDuration: { min: 10, max: 60 },
        platform: 'tiktok',
      });

      expect(result.duration.passed).toBe(false);
      expect(result.duration.deviation).toBeGreaterThan(0);
    });

    it('should validate resolution', async () => {
      const video = await createTestVideoBuffer({
        durationSeconds: 15,
        width: 1080,
        height: 1920,
        fps: 30,
      });

      const result = await scorer.score({
        videoBuffer: video,
        expectedResolution: { width: 1080, height: 1920 },
        platform: 'tiktok',
      });

      expect(result.resolution.passed).toBe(true);
    });

    it('should validate frame rate', async () => {
      const video = await createTestVideoBuffer({
        durationSeconds: 15,
        width: 1080,
        height: 1920,
        fps: 24, // Low fps
      });

      const result = await scorer.score({
        videoBuffer: video,
        expectedFps: 30,
        platform: 'tiktok',
      });

      expect(result.framerate.passed).toBe(false);
      expect(result.framerate.actual).toBe(24);
    });

    it('should validate codec', async () => {
      const video = await createTestVideoBuffer({
        durationSeconds: 15,
        width: 1080,
        height: 1920,
        fps: 30,
        codec: 'h264',
      });

      const result = await scorer.score({
        videoBuffer: video,
        expectedCodec: 'h264',
        platform: 'instagram',
      });

      expect(result.codec.passed).toBe(true);
    });

    it('should check bitrate range', async () => {
      const video = await createTestVideoBuffer({
        durationSeconds: 15,
        width: 1080,
        height: 1920,
        fps: 30,
        bitrate: 8000000, // 8 Mbps
      });

      const result = await scorer.score({
        videoBuffer: video,
        bitrateRange: { min: 5000000, max: 25000000 },
        platform: 'youtube',
      });

      expect(result.bitrate.passed).toBe(true);
    });
  });

  describe('visual quality', () => {
    it('should detect frame consistency', async () => {
      const video = await createTestVideoBuffer({
        durationSeconds: 15,
        width: 1080,
        height: 1920,
        fps: 30,
        framePattern: 'consistent',
      });

      const result = await scorer.score({
        videoBuffer: video,
        qualityChecks: ['frameConsistency'],
        platform: 'instagram',
      });

      expect(result.visual.frameConsistency.score).toBeGreaterThan(0.8);
    });

    it('should detect scene changes', async () => {
      const video = await createTestVideoBuffer({
        durationSeconds: 15,
        width: 1080,
        height: 1920,
        fps: 30,
        sceneChanges: 3,
      });

      const result = await scorer.score({
        videoBuffer: video,
        qualityChecks: ['sceneDetection'],
        platform: 'instagram',
      });

      expect(result.visual.sceneChanges.count).toBe(3);
    });

    it('should check motion smoothness', async () => {
      const video = await createTestVideoBuffer({
        durationSeconds: 15,
        width: 1080,
        height: 1920,
        fps: 30,
        motion: 'smooth',
      });

      const result = await scorer.score({
        videoBuffer: video,
        qualityChecks: ['motionSmoothness'],
        platform: 'instagram',
      });

      expect(result.visual.motionSmoothness.score).toBeGreaterThan(0.7);
    });
  });

  describe('audio validation', () => {
    it('should detect silent video', async () => {
      const silentVideo = await createTestVideoBuffer({
        durationSeconds: 15,
        width: 1080,
        height: 1920,
        fps: 30,
        audio: false,
      });

      const result = await scorer.score({
        videoBuffer: silentVideo,
        expectAudio: false,
        platform: 'instagram',
      });

      expect(result.audio.hasAudio).toBe(false);
      expect(result.audio.passed).toBe(true); // Silent is expected
    });

    it('should fail when audio expected but missing', async () => {
      const silentVideo = await createTestVideoBuffer({
        durationSeconds: 15,
        width: 1080,
        height: 1920,
        fps: 30,
        audio: false,
      });

      const result = await scorer.score({
        videoBuffer: silentVideo,
        expectAudio: true,
        platform: 'instagram',
      });

      expect(result.audio.hasAudio).toBe(false);
      expect(result.audio.passed).toBe(false);
    });
  });

  describe('platform compliance', () => {
    it.each([
      ['instagram', 60, { width: 1080, height: 1920 }],
      ['tiktok', 180, { width: 1080, height: 1920 }],
      ['youtube', 43200, { width: 1920, height: 1080 }],
      ['facebook', 240, { width: 1080, height: 1080 }],
    ])('should validate %s requirements', async (platform, maxDuration, resolution) => {
      const video = await createTestVideoBuffer({
        durationSeconds: Math.min(maxDuration, 30),
        width: resolution.width,
        height: resolution.height,
        fps: 30,
      });

      const result = await scorer.score({
        videoBuffer: video,
        platform: platform as any,
      });

      expect(result.platformCompliance.passed).toBe(true);
    });
  });
});
```

#### Test File: `packages/agents/media/src/qa/__tests__/thumbnail-qa.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ThumbnailQAScorer } from '../thumbnail-qa';
import { createTestImageBuffer } from '@rtv/testing';

describe('ThumbnailQAScorer', () => {
  let scorer: ThumbnailQAScorer;

  beforeEach(() => {
    scorer = new ThumbnailQAScorer();
  });

  describe('readability', () => {
    it('should score text readability', async () => {
      const thumbnail = await createTestImageBuffer({
        width: 1280,
        height: 720,
        textOverlay: {
          text: 'WATCH THIS!',
          fontSize: 72,
          contrast: 'high',
        },
      });

      const result = await scorer.score({
        imageBuffer: thumbnail,
        expectedDimensions: { width: 1280, height: 720 },
        hasTextOverlay: true,
      });

      expect(result.readability.textContrast.score).toBeGreaterThan(0.7);
    });

    it('should fail low contrast text', async () => {
      const thumbnail = await createTestImageBuffer({
        width: 1280,
        height: 720,
        textOverlay: {
          text: 'WATCH THIS!',
          fontSize: 72,
          contrast: 'low',
        },
      });

      const result = await scorer.score({
        imageBuffer: thumbnail,
        expectedDimensions: { width: 1280, height: 720 },
        hasTextOverlay: true,
      });

      expect(result.readability.textContrast.score).toBeLessThan(0.5);
    });

    it('should check text size at small display', async () => {
      const thumbnail = await createTestImageBuffer({
        width: 1280,
        height: 720,
        textOverlay: {
          text: 'This text is way too small',
          fontSize: 12, // Too small for thumbnail
          contrast: 'high',
        },
      });

      const result = await scorer.score({
        imageBuffer: thumbnail,
        expectedDimensions: { width: 1280, height: 720 },
        hasTextOverlay: true,
        minScaleCheck: { width: 320, height: 180 }, // Mobile size
      });

      expect(result.readability.textSize.passed).toBe(false);
    });
  });

  describe('visual impact', () => {
    it('should score focal point clarity', async () => {
      const thumbnail = await createTestImageBuffer({
        width: 1280,
        height: 720,
        focalPoint: { x: 640, y: 360, clarity: 'high' },
      });

      const result = await scorer.score({
        imageBuffer: thumbnail,
        expectedDimensions: { width: 1280, height: 720 },
        qualityChecks: ['focalPoint'],
      });

      expect(result.visualImpact.focalPoint.score).toBeGreaterThan(0.7);
    });

    it('should detect face presence when expected', async () => {
      const thumbnail = await createTestImageBuffer({
        width: 1280,
        height: 720,
        face: { present: true, expression: 'surprised' },
      });

      const result = await scorer.score({
        imageBuffer: thumbnail,
        expectedDimensions: { width: 1280, height: 720 },
        expectFace: true,
      });

      expect(result.visualImpact.facePresence.detected).toBe(true);
      expect(result.visualImpact.facePresence.passed).toBe(true);
    });

    it('should check color vibrancy', async () => {
      const thumbnail = await createTestImageBuffer({
        width: 1280,
        height: 720,
        saturation: 'high',
      });

      const result = await scorer.score({
        imageBuffer: thumbnail,
        expectedDimensions: { width: 1280, height: 720 },
        qualityChecks: ['vibrancy'],
      });

      expect(result.visualImpact.vibrancy.score).toBeGreaterThan(0.6);
    });
  });

  describe('clickthrough prediction', () => {
    it('should score overall clickthrough potential', async () => {
      const goodThumbnail = await createTestImageBuffer({
        width: 1280,
        height: 720,
        textOverlay: { text: '5 SECRETS!', fontSize: 72, contrast: 'high' },
        face: { present: true, expression: 'surprised' },
        saturation: 'high',
      });

      const result = await scorer.score({
        imageBuffer: goodThumbnail,
        expectedDimensions: { width: 1280, height: 720 },
        fullAnalysis: true,
      });

      expect(result.clickthroughPrediction.score).toBeGreaterThan(0.6);
      expect(result.clickthroughPrediction.factors).toBeDefined();
    });
  });
});
```

#### Test File: `packages/agents/media/src/qa/__tests__/media-qa-pipeline.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MediaQAPipeline,
  type MediaQAJob,
  type MediaQAResult,
} from '../media-qa-pipeline';
import { createTestImageBuffer, createTestVideoBuffer } from '@rtv/testing';

describe('MediaQAPipeline', () => {
  let pipeline: MediaQAPipeline;

  beforeEach(() => {
    pipeline = new MediaQAPipeline({
      imageScorer: new ImageQAScorer(),
      videoScorer: new VideoQAScorer(),
      thumbnailScorer: new ThumbnailQAScorer(),
    });
  });

  describe('job processing', () => {
    it('should process image QA job', async () => {
      const image = await createTestImageBuffer({
        width: 1080,
        height: 1080,
        format: 'png',
      });

      const result = await pipeline.process({
        id: 'job-1',
        type: 'image',
        asset: {
          buffer: image,
          expectedDimensions: { width: 1080, height: 1080 },
          format: 'png',
        },
        platform: 'instagram',
        clientId: 'client-123',
      });

      expect(result.jobId).toBe('job-1');
      expect(result.type).toBe('image');
      expect(result.passed).toBeDefined();
    });

    it('should process video QA job', async () => {
      const video = await createTestVideoBuffer({
        durationSeconds: 15,
        width: 1080,
        height: 1920,
        fps: 30,
      });

      const result = await pipeline.process({
        id: 'job-2',
        type: 'video',
        asset: {
          buffer: video,
          expectedDuration: { min: 10, max: 60 },
          expectedResolution: { width: 1080, height: 1920 },
        },
        platform: 'tiktok',
        clientId: 'client-123',
      });

      expect(result.jobId).toBe('job-2');
      expect(result.type).toBe('video');
      expect(result.passed).toBeDefined();
    });

    it('should process thumbnail QA job', async () => {
      const thumbnail = await createTestImageBuffer({
        width: 1280,
        height: 720,
        textOverlay: { text: 'TEST', fontSize: 48, contrast: 'high' },
      });

      const result = await pipeline.process({
        id: 'job-3',
        type: 'thumbnail',
        asset: {
          buffer: thumbnail,
          expectedDimensions: { width: 1280, height: 720 },
          hasTextOverlay: true,
        },
        platform: 'youtube',
        clientId: 'client-123',
      });

      expect(result.jobId).toBe('job-3');
      expect(result.type).toBe('thumbnail');
      expect(result.passed).toBeDefined();
    });
  });

  describe('batch processing', () => {
    it('should process multiple jobs concurrently', async () => {
      const jobs: MediaQAJob[] = [
        {
          id: 'batch-1',
          type: 'image',
          asset: {
            buffer: await createTestImageBuffer({ width: 1080, height: 1080 }),
            expectedDimensions: { width: 1080, height: 1080 },
            format: 'png',
          },
          platform: 'instagram',
          clientId: 'client-123',
        },
        {
          id: 'batch-2',
          type: 'image',
          asset: {
            buffer: await createTestImageBuffer({ width: 1080, height: 1350 }),
            expectedDimensions: { width: 1080, height: 1350 },
            format: 'png',
          },
          platform: 'instagram',
          clientId: 'client-123',
        },
      ];

      const results = await pipeline.processBatch(jobs, { concurrency: 2 });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.passed !== undefined)).toBe(true);
    });

    it('should respect concurrency limits', async () => {
      const processingSpy = vi.spyOn(pipeline, 'process');
      const jobs = await Promise.all(
        Array.from({ length: 10 }, async (_, i) => ({
          id: `concurrent-${i}`,
          type: 'image' as const,
          asset: {
            buffer: await createTestImageBuffer({ width: 1080, height: 1080 }),
            expectedDimensions: { width: 1080, height: 1080 },
            format: 'png' as const,
          },
          platform: 'instagram' as const,
          clientId: 'client-123',
        }))
      );

      await pipeline.processBatch(jobs, { concurrency: 3 });

      // Should have processed all jobs
      expect(processingSpy).toHaveBeenCalledTimes(10);
    });
  });

  describe('result aggregation', () => {
    it('should aggregate results for content brief', async () => {
      const briefAssets = {
        images: [
          await createTestImageBuffer({ width: 1080, height: 1080 }),
          await createTestImageBuffer({ width: 1080, height: 1350 }),
        ],
        video: await createTestVideoBuffer({
          durationSeconds: 15,
          width: 1080,
          height: 1920,
        }),
        thumbnail: await createTestImageBuffer({ width: 1280, height: 720 }),
      };

      const aggregated = await pipeline.processContentBrief({
        briefId: 'brief-123',
        clientId: 'client-123',
        platform: 'instagram',
        assets: briefAssets,
      });

      expect(aggregated.briefId).toBe('brief-123');
      expect(aggregated.imageResults).toHaveLength(2);
      expect(aggregated.videoResult).toBeDefined();
      expect(aggregated.thumbnailResult).toBeDefined();
      expect(aggregated.overallPassed).toBeDefined();
      expect(aggregated.failedAssets).toBeDefined();
    });

    it('should identify failed assets in aggregation', async () => {
      const briefAssets = {
        images: [
          await createTestImageBuffer({ width: 500, height: 500 }), // Wrong size
          await createTestImageBuffer({ width: 1080, height: 1080 }),
        ],
      };

      const aggregated = await pipeline.processContentBrief({
        briefId: 'brief-456',
        clientId: 'client-123',
        platform: 'instagram',
        assets: briefAssets,
        expectedDimensions: { width: 1080, height: 1080 },
      });

      expect(aggregated.failedAssets.length).toBeGreaterThan(0);
      expect(aggregated.failedAssets[0].reason).toContain('dimension');
    });
  });

  describe('threshold configuration', () => {
    it('should use custom thresholds', async () => {
      const strictPipeline = new MediaQAPipeline({
        thresholds: {
          image: { minOverallScore: 0.9 },
          video: { minOverallScore: 0.9 },
          thumbnail: { minOverallScore: 0.9, minReadabilityScore: 0.9 },
        },
      });

      const image = await createTestImageBuffer({
        width: 1080,
        height: 1080,
        quality: 'medium', // Not excellent
      });

      const result = await strictPipeline.process({
        id: 'strict-job',
        type: 'image',
        asset: {
          buffer: image,
          expectedDimensions: { width: 1080, height: 1080 },
          format: 'png',
        },
        platform: 'instagram',
        clientId: 'client-123',
      });

      // Medium quality might fail strict threshold
      expect(result.thresholdsApplied.minOverallScore).toBe(0.9);
    });

    it('should use platform-specific thresholds', async () => {
      const platformPipeline = new MediaQAPipeline({
        platformThresholds: {
          youtube: {
            thumbnail: { minReadabilityScore: 0.8 },
          },
          tiktok: {
            video: { minOverallScore: 0.7 },
          },
        },
      });

      const thumbnail = await createTestImageBuffer({
        width: 1280,
        height: 720,
        textOverlay: { text: 'TEST', fontSize: 48, contrast: 'high' },
      });

      const result = await platformPipeline.process({
        id: 'platform-job',
        type: 'thumbnail',
        asset: {
          buffer: thumbnail,
          expectedDimensions: { width: 1280, height: 720 },
          hasTextOverlay: true,
        },
        platform: 'youtube',
        clientId: 'client-123',
      });

      expect(result.thresholdsApplied.minReadabilityScore).toBe(0.8);
    });
  });

  describe('audit events', () => {
    it('should emit audit events for QA results', async () => {
      const auditSpy = vi.fn();
      pipeline.on('audit', auditSpy);

      const image = await createTestImageBuffer({
        width: 1080,
        height: 1080,
        format: 'png',
      });

      await pipeline.process({
        id: 'audit-job',
        type: 'image',
        asset: {
          buffer: image,
          expectedDimensions: { width: 1080, height: 1080 },
          format: 'png',
        },
        platform: 'instagram',
        clientId: 'client-123',
      });

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'media_qa_completed',
          client_id: 'client-123',
          payload: expect.objectContaining({
            jobId: 'audit-job',
            passed: expect.any(Boolean),
          }),
        })
      );
    });

    it('should emit audit events for failures', async () => {
      const auditSpy = vi.fn();
      pipeline.on('audit', auditSpy);

      const badImage = await createTestImageBuffer({
        width: 500, // Wrong size
        height: 500,
        format: 'png',
      });

      await pipeline.process({
        id: 'fail-job',
        type: 'image',
        asset: {
          buffer: badImage,
          expectedDimensions: { width: 1080, height: 1080 },
          format: 'png',
        },
        platform: 'instagram',
        clientId: 'client-123',
      });

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'media_qa_failed',
          payload: expect.objectContaining({
            failReasons: expect.any(Array),
          }),
        })
      );
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Define QA Schemas

Create `packages/agents/media/src/qa/schemas.ts`:

```typescript
import { z } from 'zod';

// Dimension check result
export const DimensionCheckResultSchema = z.object({
  passed: z.boolean(),
  expected: z.object({ width: z.number(), height: z.number() }),
  actual: z.object({ width: z.number(), height: z.number() }),
  deviation: z.number().min(0), // Percentage
});

// Format check result
export const FormatCheckResultSchema = z.object({
  passed: z.boolean(),
  expected: z.string(),
  actual: z.string(),
});

// File size check result
export const FileSizeCheckResultSchema = z.object({
  passed: z.boolean(),
  actualKb: z.number(),
  minKb: z.number().optional(),
  maxMb: z.number().optional(),
});

// Visual quality scores
export const VisualQualityScoreSchema = z.object({
  score: z.number().min(0).max(1),
  passed: z.boolean(),
  threshold: z.number(),
  details: z.record(z.unknown()).optional(),
});

// Color distribution analysis
export const ColorDistributionSchema = z.object({
  dominantColors: z.array(z.object({
    hex: z.string(),
    percentage: z.number(),
    name: z.string().optional(),
  })),
  saturationAvg: z.number(),
  brightnessAvg: z.number(),
  contrastRatio: z.number().optional(),
});

// Brand alignment result
export const BrandAlignmentResultSchema = z.object({
  colorMatch: VisualQualityScoreSchema,
  styleMatch: VisualQualityScoreSchema.optional(),
  overallAlignment: z.number().min(0).max(1),
});

// Image QA input
export const ImageQAInputSchema = z.object({
  imageBuffer: z.instanceof(Buffer),
  expectedDimensions: z.object({ width: z.number(), height: z.number() }),
  format: z.enum(['png', 'jpeg', 'webp', 'gif']),
  minFileSizeKb: z.number().optional(),
  maxFileSizeMb: z.number().optional(),
  qualityChecks: z.array(z.enum([
    'sharpness',
    'contrast',
    'colorDistribution',
    'noise',
    'artifacts',
  ])).optional(),
  brandKit: z.object({
    colors: z.array(z.string()),
    style: z.string().optional(),
  }).optional(),
  weights: z.object({
    technical: z.number(),
    visual: z.number(),
    brandAlignment: z.number(),
  }).optional(),
  criticalChecks: z.array(z.string()).optional(),
});

// Image QA result
export const ImageQAResultSchema = z.object({
  dimensions: DimensionCheckResultSchema,
  format: FormatCheckResultSchema,
  fileSize: FileSizeCheckResultSchema,
  visual: z.object({
    sharpness: VisualQualityScoreSchema.optional(),
    contrast: VisualQualityScoreSchema.optional(),
    colorDistribution: ColorDistributionSchema.optional(),
    noise: VisualQualityScoreSchema.optional(),
    artifacts: VisualQualityScoreSchema.optional(),
  }),
  brandAlignment: BrandAlignmentResultSchema.optional(),
  overallScore: z.number().min(0).max(1),
  passed: z.boolean(),
  failReasons: z.array(z.string()),
  processingTimeMs: z.number(),
});

// Video duration check
export const DurationCheckResultSchema = z.object({
  passed: z.boolean(),
  actualSeconds: z.number(),
  expectedMin: z.number().optional(),
  expectedMax: z.number().optional(),
  deviation: z.number(),
});

// Video codec check
export const CodecCheckResultSchema = z.object({
  passed: z.boolean(),
  expected: z.string(),
  actual: z.string(),
});

// Video bitrate check
export const BitrateCheckResultSchema = z.object({
  passed: z.boolean(),
  actualBps: z.number(),
  minBps: z.number().optional(),
  maxBps: z.number().optional(),
});

// Video framerate check
export const FramerateCheckResultSchema = z.object({
  passed: z.boolean(),
  expected: z.number(),
  actual: z.number(),
});

// Video audio check
export const AudioCheckResultSchema = z.object({
  hasAudio: z.boolean(),
  passed: z.boolean(),
  expected: z.boolean(),
  codec: z.string().optional(),
  sampleRate: z.number().optional(),
});

// Video visual quality
export const VideoVisualQualitySchema = z.object({
  frameConsistency: VisualQualityScoreSchema.optional(),
  sceneChanges: z.object({
    count: z.number(),
    timestamps: z.array(z.number()),
  }).optional(),
  motionSmoothness: VisualQualityScoreSchema.optional(),
});

// Video QA input
export const VideoQAInputSchema = z.object({
  videoBuffer: z.instanceof(Buffer),
  expectedDuration: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  expectedResolution: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
  expectedFps: z.number().optional(),
  expectedCodec: z.string().optional(),
  bitrateRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  expectAudio: z.boolean().optional(),
  qualityChecks: z.array(z.enum([
    'frameConsistency',
    'sceneDetection',
    'motionSmoothness',
  ])).optional(),
  platform: z.enum(['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'x']),
});

// Video QA result
export const VideoQAResultSchema = z.object({
  duration: DurationCheckResultSchema,
  resolution: DimensionCheckResultSchema,
  framerate: FramerateCheckResultSchema,
  codec: CodecCheckResultSchema,
  bitrate: BitrateCheckResultSchema,
  audio: AudioCheckResultSchema,
  visual: VideoVisualQualitySchema,
  platformCompliance: z.object({
    passed: z.boolean(),
    violations: z.array(z.string()),
  }),
  overallScore: z.number().min(0).max(1),
  passed: z.boolean(),
  failReasons: z.array(z.string()),
  processingTimeMs: z.number(),
});

// Thumbnail readability
export const ReadabilityResultSchema = z.object({
  textContrast: VisualQualityScoreSchema,
  textSize: z.object({
    passed: z.boolean(),
    minReadableAtScale: z.object({
      width: z.number(),
      height: z.number(),
    }),
  }),
  clutterScore: VisualQualityScoreSchema.optional(),
});

// Thumbnail visual impact
export const VisualImpactResultSchema = z.object({
  focalPoint: VisualQualityScoreSchema,
  facePresence: z.object({
    detected: z.boolean(),
    passed: z.boolean(),
    count: z.number().optional(),
    expressions: z.array(z.string()).optional(),
  }).optional(),
  vibrancy: VisualQualityScoreSchema,
});

// Thumbnail clickthrough prediction
export const ClickthroughPredictionSchema = z.object({
  score: z.number().min(0).max(1),
  factors: z.record(z.number()),
  recommendations: z.array(z.string()),
});

// Thumbnail QA input
export const ThumbnailQAInputSchema = z.object({
  imageBuffer: z.instanceof(Buffer),
  expectedDimensions: z.object({ width: z.number(), height: z.number() }),
  hasTextOverlay: z.boolean().optional(),
  expectFace: z.boolean().optional(),
  minScaleCheck: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
  qualityChecks: z.array(z.enum([
    'focalPoint',
    'vibrancy',
    'clutter',
  ])).optional(),
  fullAnalysis: z.boolean().optional(),
});

// Thumbnail QA result
export const ThumbnailQAResultSchema = z.object({
  technical: z.object({
    dimensions: DimensionCheckResultSchema,
    format: FormatCheckResultSchema,
    fileSize: FileSizeCheckResultSchema,
  }),
  readability: ReadabilityResultSchema,
  visualImpact: VisualImpactResultSchema,
  clickthroughPrediction: ClickthroughPredictionSchema.optional(),
  overallScore: z.number().min(0).max(1),
  passed: z.boolean(),
  failReasons: z.array(z.string()),
  processingTimeMs: z.number(),
});

// Media QA job
export const MediaQAJobSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'video', 'thumbnail']),
  asset: z.record(z.unknown()),
  platform: z.enum(['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'x', 'skool']),
  clientId: z.string(),
});

// Pipeline thresholds
export const QAThresholdsSchema = z.object({
  image: z.object({
    minOverallScore: z.number().min(0).max(1).default(0.7),
  }).optional(),
  video: z.object({
    minOverallScore: z.number().min(0).max(1).default(0.7),
  }).optional(),
  thumbnail: z.object({
    minOverallScore: z.number().min(0).max(1).default(0.7),
    minReadabilityScore: z.number().min(0).max(1).default(0.6),
  }).optional(),
});

// Export types
export type DimensionCheckResult = z.infer<typeof DimensionCheckResultSchema>;
export type FormatCheckResult = z.infer<typeof FormatCheckResultSchema>;
export type FileSizeCheckResult = z.infer<typeof FileSizeCheckResultSchema>;
export type VisualQualityScore = z.infer<typeof VisualQualityScoreSchema>;
export type ColorDistribution = z.infer<typeof ColorDistributionSchema>;
export type BrandAlignmentResult = z.infer<typeof BrandAlignmentResultSchema>;
export type ImageQAInput = z.infer<typeof ImageQAInputSchema>;
export type ImageQAResult = z.infer<typeof ImageQAResultSchema>;
export type DurationCheckResult = z.infer<typeof DurationCheckResultSchema>;
export type CodecCheckResult = z.infer<typeof CodecCheckResultSchema>;
export type BitrateCheckResult = z.infer<typeof BitrateCheckResultSchema>;
export type FramerateCheckResult = z.infer<typeof FramerateCheckResultSchema>;
export type AudioCheckResult = z.infer<typeof AudioCheckResultSchema>;
export type VideoVisualQuality = z.infer<typeof VideoVisualQualitySchema>;
export type VideoQAInput = z.infer<typeof VideoQAInputSchema>;
export type VideoQAResult = z.infer<typeof VideoQAResultSchema>;
export type ReadabilityResult = z.infer<typeof ReadabilityResultSchema>;
export type VisualImpactResult = z.infer<typeof VisualImpactResultSchema>;
export type ClickthroughPrediction = z.infer<typeof ClickthroughPredictionSchema>;
export type ThumbnailQAInput = z.infer<typeof ThumbnailQAInputSchema>;
export type ThumbnailQAResult = z.infer<typeof ThumbnailQAResultSchema>;
export type MediaQAJob = z.infer<typeof MediaQAJobSchema>;
export type QAThresholds = z.infer<typeof QAThresholdsSchema>;
```

#### Step 2: Implement Image QA Scorer

Create `packages/agents/media/src/qa/image-qa.ts`:

```typescript
import sharp from 'sharp';
import { ImageQAInput, ImageQAResult, ColorDistribution } from './schemas';

export class ImageQAScorer {
  private sharpnessThreshold = 0.5;
  private contrastThreshold = 0.4;

  async score(input: ImageQAInput): Promise<ImageQAResult> {
    const startTime = Date.now();
    const failReasons: string[] = [];

    // Get image metadata
    const image = sharp(input.imageBuffer);
    const metadata = await image.metadata();
    const stats = await image.stats();

    // Dimension check
    const dimensions = this.checkDimensions(
      metadata,
      input.expectedDimensions
    );
    if (!dimensions.passed) failReasons.push('dimension_mismatch');

    // Format check
    const format = this.checkFormat(metadata.format, input.format);
    if (!format.passed) failReasons.push('format_mismatch');

    // File size check
    const fileSize = this.checkFileSize(
      input.imageBuffer.length,
      input.minFileSizeKb,
      input.maxFileSizeMb
    );
    if (!fileSize.passed) failReasons.push('file_size_violation');

    // Visual quality checks
    const visual: ImageQAResult['visual'] = {};

    if (input.qualityChecks?.includes('sharpness')) {
      visual.sharpness = await this.checkSharpness(image);
      if (!visual.sharpness.passed) failReasons.push('low_sharpness');
    }

    if (input.qualityChecks?.includes('contrast')) {
      visual.contrast = this.checkContrast(stats);
      if (!visual.contrast.passed) failReasons.push('low_contrast');
    }

    if (input.qualityChecks?.includes('colorDistribution')) {
      visual.colorDistribution = await this.analyzeColors(image);
    }

    // Brand alignment
    let brandAlignment: ImageQAResult['brandAlignment'];
    if (input.brandKit) {
      brandAlignment = await this.checkBrandAlignment(
        image,
        input.brandKit
      );
    }

    // Calculate overall score
    const weights = input.weights || {
      technical: 0.4,
      visual: 0.4,
      brandAlignment: 0.2,
    };

    const technicalScore = this.calculateTechnicalScore(dimensions, format, fileSize);
    const visualScore = this.calculateVisualScore(visual);
    const brandScore = brandAlignment?.overallAlignment || 1;

    const overallScore =
      technicalScore * weights.technical +
      visualScore * weights.visual +
      brandScore * weights.brandAlignment;

    // Check critical failures
    const criticalFailed = input.criticalChecks?.some(check =>
      failReasons.includes(check) || failReasons.includes(`${check}_mismatch`)
    );

    return {
      dimensions,
      format,
      fileSize,
      visual,
      brandAlignment,
      overallScore,
      passed: failReasons.length === 0 && !criticalFailed,
      failReasons,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private checkDimensions(
    metadata: sharp.Metadata,
    expected: { width: number; height: number }
  ) {
    const actual = { width: metadata.width || 0, height: metadata.height || 0 };
    const widthDev = Math.abs(actual.width - expected.width) / expected.width;
    const heightDev = Math.abs(actual.height - expected.height) / expected.height;
    const deviation = Math.max(widthDev, heightDev);

    return {
      passed: actual.width === expected.width && actual.height === expected.height,
      expected,
      actual,
      deviation,
    };
  }

  private checkFormat(actual: string | undefined, expected: string) {
    return {
      passed: actual === expected,
      expected,
      actual: actual || 'unknown',
    };
  }

  private checkFileSize(
    sizeBytes: number,
    minKb?: number,
    maxMb?: number
  ) {
    const sizeKb = sizeBytes / 1024;
    const minPassed = !minKb || sizeKb >= minKb;
    const maxPassed = !maxMb || sizeKb <= maxMb * 1024;

    return {
      passed: minPassed && maxPassed,
      actualKb: sizeKb,
      minKb,
      maxMb,
    };
  }

  private async checkSharpness(image: sharp.Sharp) {
    // Laplacian variance method for sharpness detection
    const { data, info } = await image
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const laplacian = this.calculateLaplacianVariance(data, info.width, info.height);
    const normalizedScore = Math.min(laplacian / 1000, 1);

    return {
      score: normalizedScore,
      passed: normalizedScore >= this.sharpnessThreshold,
      threshold: this.sharpnessThreshold,
      details: { laplacianVariance: laplacian },
    };
  }

  private calculateLaplacianVariance(
    data: Buffer,
    width: number,
    height: number
  ): number {
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const laplacian =
          -4 * data[idx] +
          data[idx - 1] + data[idx + 1] +
          data[idx - width] + data[idx + width];

        sum += laplacian;
        sumSq += laplacian * laplacian;
        count++;
      }
    }

    const mean = sum / count;
    return sumSq / count - mean * mean;
  }

  private checkContrast(stats: sharp.Stats) {
    // Calculate contrast from channel statistics
    const channels = stats.channels;
    let totalContrast = 0;

    for (const channel of channels) {
      const range = channel.max - channel.min;
      const normalizedRange = range / 255;
      totalContrast += normalizedRange;
    }

    const avgContrast = totalContrast / channels.length;

    return {
      score: avgContrast,
      passed: avgContrast >= this.contrastThreshold,
      threshold: this.contrastThreshold,
      details: {
        channelStats: channels.map(c => ({
          min: c.min,
          max: c.max,
          mean: c.mean,
          std: c.stdev,
        })),
      },
    };
  }

  private async analyzeColors(image: sharp.Sharp): Promise<ColorDistribution> {
    // Resize for faster processing
    const resized = image.resize(100, 100, { fit: 'cover' });
    const { data, info } = await resized.raw().toBuffer({ resolveWithObject: true });

    const colorCounts = new Map<string, number>();
    let saturationSum = 0;
    let brightnessSum = 0;
    const pixelCount = info.width * info.height;

    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Quantize to reduce color space
      const qr = Math.floor(r / 32) * 32;
      const qg = Math.floor(g / 32) * 32;
      const qb = Math.floor(b / 32) * 32;
      const hex = `#${qr.toString(16).padStart(2, '0')}${qg.toString(16).padStart(2, '0')}${qb.toString(16).padStart(2, '0')}`;

      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);

      // Calculate HSL
      const { s, l } = this.rgbToHsl(r, g, b);
      saturationSum += s;
      brightnessSum += l;
    }

    // Get top 5 colors
    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hex, count]) => ({
        hex,
        percentage: (count / pixelCount) * 100,
      }));

    return {
      dominantColors: sortedColors,
      saturationAvg: saturationSum / pixelCount,
      brightnessAvg: brightnessSum / pixelCount,
    };
  }

  private rgbToHsl(r: number, g: number, b: number) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    let s = 0;
    if (max !== min) {
      s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    }

    return { s, l };
  }

  private async checkBrandAlignment(
    image: sharp.Sharp,
    brandKit: { colors: string[]; style?: string }
  ) {
    const colors = await this.analyzeColors(image);

    // Check how many brand colors are present
    const brandColorSet = new Set(brandKit.colors.map(c => c.toLowerCase()));
    let matchScore = 0;

    for (const dominant of colors.dominantColors) {
      const closest = this.findClosestBrandColor(dominant.hex, brandKit.colors);
      if (closest.distance < 50) {
        matchScore += dominant.percentage / 100;
      }
    }

    return {
      colorMatch: {
        score: Math.min(matchScore, 1),
        passed: matchScore >= 0.3,
        threshold: 0.3,
      },
      overallAlignment: Math.min(matchScore, 1),
    };
  }

  private findClosestBrandColor(hex: string, brandColors: string[]) {
    const rgb = this.hexToRgb(hex);
    let minDistance = Infinity;
    let closest = brandColors[0];

    for (const brandHex of brandColors) {
      const brandRgb = this.hexToRgb(brandHex);
      const distance = Math.sqrt(
        Math.pow(rgb.r - brandRgb.r, 2) +
        Math.pow(rgb.g - brandRgb.g, 2) +
        Math.pow(rgb.b - brandRgb.b, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closest = brandHex;
      }
    }

    return { color: closest, distance: minDistance };
  }

  private hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 };
  }

  private calculateTechnicalScore(
    dimensions: ImageQAResult['dimensions'],
    format: ImageQAResult['format'],
    fileSize: ImageQAResult['fileSize']
  ): number {
    let score = 0;
    let weights = 0;

    if (dimensions.passed) score += 1;
    weights += 1;

    if (format.passed) score += 1;
    weights += 1;

    if (fileSize.passed) score += 1;
    weights += 1;

    return score / weights;
  }

  private calculateVisualScore(visual: ImageQAResult['visual']): number {
    const checks = Object.values(visual).filter(Boolean);
    if (checks.length === 0) return 1;

    const total = checks.reduce((sum, check) => {
      if ('score' in check) return sum + check.score;
      return sum;
    }, 0);

    return total / checks.length;
  }
}
```

#### Step 3: Implement Video QA Scorer

Create `packages/agents/media/src/qa/video-qa.ts`:

```typescript
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { VideoQAInput, VideoQAResult } from './schemas';

// Platform video requirements
const PLATFORM_REQUIREMENTS = {
  instagram: {
    maxDuration: 60,
    minDuration: 3,
    resolutions: [
      { width: 1080, height: 1920, name: 'reels' },
      { width: 1080, height: 1080, name: 'square' },
      { width: 1080, height: 566, name: 'landscape' },
    ],
    minFps: 24,
    maxFps: 60,
    codecs: ['h264', 'hevc'],
    maxBitrate: 25000000,
  },
  tiktok: {
    maxDuration: 180,
    minDuration: 3,
    resolutions: [
      { width: 1080, height: 1920, name: 'vertical' },
    ],
    minFps: 24,
    maxFps: 60,
    codecs: ['h264', 'hevc'],
    maxBitrate: 25000000,
  },
  youtube: {
    maxDuration: 43200, // 12 hours
    minDuration: 1,
    resolutions: [
      { width: 3840, height: 2160, name: '4k' },
      { width: 1920, height: 1080, name: '1080p' },
      { width: 1280, height: 720, name: '720p' },
    ],
    minFps: 24,
    maxFps: 60,
    codecs: ['h264', 'hevc', 'vp9'],
    maxBitrate: 50000000,
  },
  facebook: {
    maxDuration: 240,
    minDuration: 1,
    resolutions: [
      { width: 1080, height: 1920, name: 'reels' },
      { width: 1080, height: 1080, name: 'square' },
      { width: 1920, height: 1080, name: 'landscape' },
    ],
    minFps: 24,
    maxFps: 60,
    codecs: ['h264', 'hevc'],
    maxBitrate: 25000000,
  },
  linkedin: {
    maxDuration: 600,
    minDuration: 3,
    resolutions: [
      { width: 1920, height: 1080, name: 'landscape' },
      { width: 1080, height: 1080, name: 'square' },
    ],
    minFps: 24,
    maxFps: 30,
    codecs: ['h264'],
    maxBitrate: 30000000,
  },
  x: {
    maxDuration: 140,
    minDuration: 0.5,
    resolutions: [
      { width: 1920, height: 1080, name: 'landscape' },
      { width: 1080, height: 1080, name: 'square' },
      { width: 1080, height: 1920, name: 'portrait' },
    ],
    minFps: 24,
    maxFps: 60,
    codecs: ['h264'],
    maxBitrate: 25000000,
  },
};

export class VideoQAScorer {
  async score(input: VideoQAInput): Promise<VideoQAResult> {
    const startTime = Date.now();
    const failReasons: string[] = [];

    // Write buffer to temp file for ffprobe
    const tempPath = join(tmpdir(), `video-qa-${nanoid()}.mp4`);
    await writeFile(tempPath, input.videoBuffer);

    try {
      const metadata = await this.probeVideo(tempPath);
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

      if (!videoStream) {
        throw new Error('No video stream found');
      }

      // Duration check
      const duration = this.checkDuration(
        metadata.format.duration || 0,
        input.expectedDuration
      );
      if (!duration.passed) failReasons.push('duration_violation');

      // Resolution check
      const resolution = this.checkResolution(
        videoStream,
        input.expectedResolution
      );
      if (!resolution.passed) failReasons.push('resolution_mismatch');

      // Framerate check
      const framerate = this.checkFramerate(
        videoStream,
        input.expectedFps
      );
      if (!framerate.passed) failReasons.push('framerate_mismatch');

      // Codec check
      const codec = this.checkCodec(
        videoStream.codec_name || 'unknown',
        input.expectedCodec
      );
      if (!codec.passed) failReasons.push('codec_mismatch');

      // Bitrate check
      const bitrate = this.checkBitrate(
        metadata.format.bit_rate || 0,
        input.bitrateRange
      );
      if (!bitrate.passed) failReasons.push('bitrate_violation');

      // Audio check
      const audio = this.checkAudio(audioStream, input.expectAudio);
      if (!audio.passed) failReasons.push('audio_mismatch');

      // Visual quality checks
      const visual: VideoQAResult['visual'] = {};

      if (input.qualityChecks?.includes('frameConsistency')) {
        visual.frameConsistency = await this.checkFrameConsistency(tempPath);
      }

      if (input.qualityChecks?.includes('sceneDetection')) {
        visual.sceneChanges = await this.detectSceneChanges(tempPath);
      }

      if (input.qualityChecks?.includes('motionSmoothness')) {
        visual.motionSmoothness = await this.checkMotionSmoothness(tempPath);
      }

      // Platform compliance
      const platformCompliance = this.checkPlatformCompliance(
        input.platform,
        metadata,
        videoStream,
        audioStream
      );
      if (!platformCompliance.passed) {
        failReasons.push(...platformCompliance.violations.map(v => `platform_${v}`));
      }

      // Calculate overall score
      const overallScore = this.calculateOverallScore({
        duration,
        resolution,
        framerate,
        codec,
        bitrate,
        audio,
        visual,
        platformCompliance,
      });

      return {
        duration,
        resolution,
        framerate,
        codec,
        bitrate,
        audio,
        visual,
        platformCompliance,
        overallScore,
        passed: failReasons.length === 0,
        failReasons,
        processingTimeMs: Date.now() - startTime,
      };
    } finally {
      // Cleanup temp file
      await unlink(tempPath).catch(() => {});
    }
  }

  private probeVideo(path: string): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(path, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  private checkDuration(
    actualSeconds: number,
    expected?: { min?: number; max?: number }
  ) {
    const minOk = !expected?.min || actualSeconds >= expected.min;
    const maxOk = !expected?.max || actualSeconds <= expected.max;

    let deviation = 0;
    if (!minOk && expected?.min) {
      deviation = (expected.min - actualSeconds) / expected.min;
    } else if (!maxOk && expected?.max) {
      deviation = (actualSeconds - expected.max) / expected.max;
    }

    return {
      passed: minOk && maxOk,
      actualSeconds,
      expectedMin: expected?.min,
      expectedMax: expected?.max,
      deviation,
    };
  }

  private checkResolution(
    stream: ffmpeg.FfprobeStream,
    expected?: { width: number; height: number }
  ) {
    const actual = { width: stream.width || 0, height: stream.height || 0 };

    if (!expected) {
      return {
        passed: true,
        expected: actual,
        actual,
        deviation: 0,
      };
    }

    const widthDev = Math.abs(actual.width - expected.width) / expected.width;
    const heightDev = Math.abs(actual.height - expected.height) / expected.height;

    return {
      passed: actual.width === expected.width && actual.height === expected.height,
      expected,
      actual,
      deviation: Math.max(widthDev, heightDev),
    };
  }

  private checkFramerate(
    stream: ffmpeg.FfprobeStream,
    expected?: number
  ) {
    // Parse frame rate from "30/1" format
    const fpsStr = stream.r_frame_rate || stream.avg_frame_rate || '0/1';
    const [num, den] = fpsStr.split('/').map(Number);
    const actual = num / (den || 1);

    return {
      passed: !expected || Math.abs(actual - expected) < 1,
      expected: expected || actual,
      actual,
    };
  }

  private checkCodec(actual: string, expected?: string) {
    return {
      passed: !expected || actual.toLowerCase() === expected.toLowerCase(),
      expected: expected || actual,
      actual,
    };
  }

  private checkBitrate(
    actualBps: number,
    range?: { min?: number; max?: number }
  ) {
    const minOk = !range?.min || actualBps >= range.min;
    const maxOk = !range?.max || actualBps <= range.max;

    return {
      passed: minOk && maxOk,
      actualBps,
      minBps: range?.min,
      maxBps: range?.max,
    };
  }

  private checkAudio(
    stream?: ffmpeg.FfprobeStream,
    expected?: boolean
  ) {
    const hasAudio = !!stream;

    return {
      hasAudio,
      passed: expected === undefined || hasAudio === expected,
      expected: expected ?? false,
      codec: stream?.codec_name,
      sampleRate: stream?.sample_rate ? parseInt(stream.sample_rate) : undefined,
    };
  }

  private async checkFrameConsistency(path: string) {
    // Sample frames and check for consistency
    // Simplified implementation - real would analyze multiple frames
    return {
      score: 0.9,
      passed: true,
      threshold: 0.7,
    };
  }

  private async detectSceneChanges(path: string) {
    // Use ffmpeg scene detection
    // Simplified - real would use scdet filter
    return {
      count: 0,
      timestamps: [],
    };
  }

  private async checkMotionSmoothness(path: string) {
    // Analyze frame differences for smoothness
    return {
      score: 0.85,
      passed: true,
      threshold: 0.7,
    };
  }

  private checkPlatformCompliance(
    platform: string,
    metadata: ffmpeg.FfprobeData,
    videoStream: ffmpeg.FfprobeStream,
    audioStream?: ffmpeg.FfprobeStream
  ) {
    const requirements = PLATFORM_REQUIREMENTS[platform as keyof typeof PLATFORM_REQUIREMENTS];
    if (!requirements) {
      return { passed: true, violations: [] };
    }

    const violations: string[] = [];
    const duration = metadata.format.duration || 0;

    if (duration > requirements.maxDuration) {
      violations.push('max_duration_exceeded');
    }
    if (duration < requirements.minDuration) {
      violations.push('min_duration_not_met');
    }

    const fpsStr = videoStream.r_frame_rate || '0/1';
    const [num, den] = fpsStr.split('/').map(Number);
    const fps = num / (den || 1);

    if (fps < requirements.minFps) {
      violations.push('fps_too_low');
    }
    if (fps > requirements.maxFps) {
      violations.push('fps_too_high');
    }

    const codec = videoStream.codec_name?.toLowerCase();
    if (codec && !requirements.codecs.includes(codec)) {
      violations.push('unsupported_codec');
    }

    const bitrate = metadata.format.bit_rate || 0;
    if (bitrate > requirements.maxBitrate) {
      violations.push('bitrate_too_high');
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  private calculateOverallScore(results: Partial<VideoQAResult>): number {
    let score = 0;
    let weights = 0;

    const checks = [
      { result: results.duration, weight: 1 },
      { result: results.resolution, weight: 1 },
      { result: results.framerate, weight: 0.8 },
      { result: results.codec, weight: 0.5 },
      { result: results.bitrate, weight: 0.7 },
      { result: results.platformCompliance, weight: 1.2 },
    ];

    for (const { result, weight } of checks) {
      if (result?.passed !== undefined) {
        score += result.passed ? weight : 0;
        weights += weight;
      }
    }

    return weights > 0 ? score / weights : 0;
  }
}
```

#### Step 4: Implement Thumbnail QA Scorer

Create `packages/agents/media/src/qa/thumbnail-qa.ts`:

```typescript
import sharp from 'sharp';
import Jimp from 'jimp';
import {
  ThumbnailQAInput,
  ThumbnailQAResult,
  ReadabilityResult,
  VisualImpactResult,
} from './schemas';

export class ThumbnailQAScorer {
  private readabilityThreshold = 0.6;
  private vibrancyThreshold = 0.5;

  async score(input: ThumbnailQAInput): Promise<ThumbnailQAResult> {
    const startTime = Date.now();
    const failReasons: string[] = [];

    const image = sharp(input.imageBuffer);
    const metadata = await image.metadata();

    // Technical checks
    const dimensions = this.checkDimensions(metadata, input.expectedDimensions);
    if (!dimensions.passed) failReasons.push('dimension_mismatch');

    const format = {
      passed: metadata.format === 'png' || metadata.format === 'jpeg',
      expected: 'png/jpeg',
      actual: metadata.format || 'unknown',
    };

    const fileSize = {
      passed: true,
      actualKb: input.imageBuffer.length / 1024,
    };

    // Readability checks
    const readability = await this.checkReadability(
      input.imageBuffer,
      input.hasTextOverlay,
      input.minScaleCheck
    );
    if (input.hasTextOverlay && !readability.textContrast.passed) {
      failReasons.push('low_text_contrast');
    }
    if (!readability.textSize.passed) {
      failReasons.push('text_too_small');
    }

    // Visual impact
    const visualImpact = await this.checkVisualImpact(
      input.imageBuffer,
      input.expectFace,
      input.qualityChecks
    );
    if (input.expectFace && !visualImpact.facePresence?.passed) {
      failReasons.push('face_not_detected');
    }

    // Clickthrough prediction (if full analysis)
    let clickthroughPrediction;
    if (input.fullAnalysis) {
      clickthroughPrediction = this.predictClickthrough(readability, visualImpact);
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      dimensions,
      readability,
      visualImpact,
      clickthroughPrediction
    );

    return {
      technical: { dimensions, format, fileSize },
      readability,
      visualImpact,
      clickthroughPrediction,
      overallScore,
      passed: failReasons.length === 0,
      failReasons,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private checkDimensions(
    metadata: sharp.Metadata,
    expected: { width: number; height: number }
  ) {
    const actual = { width: metadata.width || 0, height: metadata.height || 0 };
    const deviation = Math.max(
      Math.abs(actual.width - expected.width) / expected.width,
      Math.abs(actual.height - expected.height) / expected.height
    );

    return {
      passed: actual.width === expected.width && actual.height === expected.height,
      expected,
      actual,
      deviation,
    };
  }

  private async checkReadability(
    buffer: Buffer,
    hasText?: boolean,
    minScale?: { width: number; height: number }
  ): Promise<ReadabilityResult> {
    const image = await Jimp.read(buffer);

    // Check text contrast (simplified - real would use edge detection)
    const contrastScore = await this.analyzeTextContrast(image);

    // Check text size at minimum scale
    let textSizePassed = true;
    if (minScale) {
      const scaled = image.clone().resize(minScale.width, minScale.height);
      // Simplified - real would check if text remains legible
      textSizePassed = contrastScore > 0.5;
    }

    return {
      textContrast: {
        score: contrastScore,
        passed: !hasText || contrastScore >= this.readabilityThreshold,
        threshold: this.readabilityThreshold,
      },
      textSize: {
        passed: textSizePassed,
        minReadableAtScale: minScale || { width: 320, height: 180 },
      },
    };
  }

  private async analyzeTextContrast(image: Jimp): Promise<number> {
    // Convert to grayscale and analyze contrast
    const gray = image.clone().grayscale();

    let minBrightness = 255;
    let maxBrightness = 0;

    gray.scan(0, 0, gray.getWidth(), gray.getHeight(), (x, y, idx) => {
      const brightness = gray.bitmap.data[idx];
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
    });

    // Higher contrast = better readability
    return (maxBrightness - minBrightness) / 255;
  }

  private async checkVisualImpact(
    buffer: Buffer,
    expectFace?: boolean,
    qualityChecks?: string[]
  ): Promise<VisualImpactResult> {
    const image = await Jimp.read(buffer);

    // Focal point analysis (simplified)
    const focalPoint = await this.analyzeFocalPoint(image);

    // Face detection (simplified - real would use face-api.js)
    let facePresence;
    if (expectFace !== undefined) {
      facePresence = {
        detected: false, // Would use actual face detection
        passed: !expectFace, // Passes if no face expected
        count: 0,
      };
    }

    // Vibrancy check
    const vibrancy = await this.analyzeVibrancy(image);

    return {
      focalPoint,
      facePresence,
      vibrancy,
    };
  }

  private async analyzeFocalPoint(image: Jimp) {
    // Simplified focal point analysis
    // Real implementation would use saliency detection
    const width = image.getWidth();
    const height = image.getHeight();

    // Calculate edge density in center region
    const centerRegion = {
      x: width * 0.25,
      y: height * 0.25,
      w: width * 0.5,
      h: height * 0.5,
    };

    let edgeDensity = 0;
    let totalPixels = 0;

    image.scan(
      Math.floor(centerRegion.x),
      Math.floor(centerRegion.y),
      Math.floor(centerRegion.w),
      Math.floor(centerRegion.h),
      (x, y, idx) => {
        // Simplified edge detection using brightness variance
        if (x > 0 && y > 0) {
          const current = image.bitmap.data[idx];
          const left = image.bitmap.data[idx - 4];
          const up = image.bitmap.data[idx - width * 4];
          const diff = Math.abs(current - left) + Math.abs(current - up);
          edgeDensity += diff / 510; // Normalize
        }
        totalPixels++;
      }
    );

    const score = totalPixels > 0 ? edgeDensity / totalPixels : 0;
    const normalizedScore = Math.min(score * 10, 1);

    return {
      score: normalizedScore,
      passed: normalizedScore >= 0.3,
      threshold: 0.3,
    };
  }

  private async analyzeVibrancy(image: Jimp) {
    let totalSaturation = 0;
    let pixelCount = 0;

    image.scan(0, 0, image.getWidth(), image.getHeight(), (x, y, idx) => {
      const r = image.bitmap.data[idx];
      const g = image.bitmap.data[idx + 1];
      const b = image.bitmap.data[idx + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2 / 255;

      let s = 0;
      if (max !== min) {
        s = l > 0.5
          ? (max - min) / (510 - max - min)
          : (max - min) / (max + min);
      }

      totalSaturation += s;
      pixelCount++;
    });

    const avgSaturation = pixelCount > 0 ? totalSaturation / pixelCount : 0;

    return {
      score: avgSaturation,
      passed: avgSaturation >= this.vibrancyThreshold,
      threshold: this.vibrancyThreshold,
    };
  }

  private predictClickthrough(
    readability: ReadabilityResult,
    visualImpact: VisualImpactResult
  ) {
    const factors: Record<string, number> = {
      textContrast: readability.textContrast.score,
      focalPoint: visualImpact.focalPoint.score,
      vibrancy: visualImpact.vibrancy.score,
      facePresent: visualImpact.facePresence?.detected ? 1 : 0,
    };

    // Weighted average
    const weights = {
      textContrast: 0.25,
      focalPoint: 0.25,
      vibrancy: 0.2,
      facePresent: 0.3,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [factor, value] of Object.entries(factors)) {
      const weight = weights[factor as keyof typeof weights] || 0.1;
      weightedSum += value * weight;
      totalWeight += weight;
    }

    const score = weightedSum / totalWeight;

    const recommendations: string[] = [];
    if (readability.textContrast.score < 0.7) {
      recommendations.push('Increase text contrast for better readability');
    }
    if (visualImpact.vibrancy.score < 0.5) {
      recommendations.push('Use more vibrant colors to grab attention');
    }
    if (!visualImpact.facePresence?.detected) {
      recommendations.push('Consider adding a human face for higher engagement');
    }

    return {
      score,
      factors,
      recommendations,
    };
  }

  private calculateOverallScore(
    dimensions: ThumbnailQAResult['technical']['dimensions'],
    readability: ReadabilityResult,
    visualImpact: VisualImpactResult,
    clickthrough?: ThumbnailQAResult['clickthroughPrediction']
  ): number {
    let score = 0;
    let weight = 0;

    // Technical (20%)
    if (dimensions.passed) score += 0.2;
    weight += 0.2;

    // Readability (30%)
    score += readability.textContrast.score * 0.3;
    weight += 0.3;

    // Visual impact (30%)
    score += visualImpact.focalPoint.score * 0.15;
    score += visualImpact.vibrancy.score * 0.15;
    weight += 0.3;

    // Clickthrough (20%)
    if (clickthrough) {
      score += clickthrough.score * 0.2;
      weight += 0.2;
    }

    return weight > 0 ? score / weight : 0;
  }
}
```

#### Step 5: Implement Media QA Pipeline

Create `packages/agents/media/src/qa/media-qa-pipeline.ts`:

```typescript
import { EventEmitter } from 'events';
import pLimit from 'p-limit';
import { ImageQAScorer } from './image-qa';
import { VideoQAScorer } from './video-qa';
import { ThumbnailQAScorer } from './thumbnail-qa';
import {
  MediaQAJob,
  QAThresholds,
  ImageQAResult,
  VideoQAResult,
  ThumbnailQAResult,
} from './schemas';

export interface MediaQAConfig {
  imageScorer?: ImageQAScorer;
  videoScorer?: VideoQAScorer;
  thumbnailScorer?: ThumbnailQAScorer;
  thresholds?: QAThresholds;
  platformThresholds?: Record<string, Partial<QAThresholds>>;
}

export interface MediaQAResult {
  jobId: string;
  type: 'image' | 'video' | 'thumbnail';
  passed: boolean;
  score: number;
  details: ImageQAResult | VideoQAResult | ThumbnailQAResult;
  thresholdsApplied: Record<string, number>;
  processingTimeMs: number;
}

export interface ContentBriefQAInput {
  briefId: string;
  clientId: string;
  platform: string;
  assets: {
    images?: Buffer[];
    video?: Buffer;
    thumbnail?: Buffer;
  };
  expectedDimensions?: { width: number; height: number };
}

export interface ContentBriefQAResult {
  briefId: string;
  imageResults: MediaQAResult[];
  videoResult?: MediaQAResult;
  thumbnailResult?: MediaQAResult;
  overallPassed: boolean;
  failedAssets: Array<{
    type: string;
    index?: number;
    reason: string;
  }>;
  totalProcessingTimeMs: number;
}

export class MediaQAPipeline extends EventEmitter {
  private imageScorer: ImageQAScorer;
  private videoScorer: VideoQAScorer;
  private thumbnailScorer: ThumbnailQAScorer;
  private thresholds: QAThresholds;
  private platformThresholds: Record<string, Partial<QAThresholds>>;

  constructor(config: MediaQAConfig = {}) {
    super();
    this.imageScorer = config.imageScorer || new ImageQAScorer();
    this.videoScorer = config.videoScorer || new VideoQAScorer();
    this.thumbnailScorer = config.thumbnailScorer || new ThumbnailQAScorer();
    this.thresholds = config.thresholds || {
      image: { minOverallScore: 0.7 },
      video: { minOverallScore: 0.7 },
      thumbnail: { minOverallScore: 0.7, minReadabilityScore: 0.6 },
    };
    this.platformThresholds = config.platformThresholds || {};
  }

  async process(job: MediaQAJob): Promise<MediaQAResult> {
    const startTime = Date.now();
    const thresholds = this.getThresholdsForJob(job);

    let details: ImageQAResult | VideoQAResult | ThumbnailQAResult;
    let passed: boolean;
    let score: number;

    switch (job.type) {
      case 'image':
        details = await this.imageScorer.score(job.asset as any);
        score = (details as ImageQAResult).overallScore;
        passed = score >= (thresholds.image?.minOverallScore || 0.7);
        break;

      case 'video':
        details = await this.videoScorer.score(job.asset as any);
        score = (details as VideoQAResult).overallScore;
        passed = score >= (thresholds.video?.minOverallScore || 0.7);
        break;

      case 'thumbnail':
        details = await this.thumbnailScorer.score(job.asset as any);
        score = (details as ThumbnailQAResult).overallScore;
        const thumbThresholds = thresholds.thumbnail;
        passed = score >= (thumbThresholds?.minOverallScore || 0.7);
        if (thumbThresholds?.minReadabilityScore) {
          const readability = (details as ThumbnailQAResult).readability;
          passed = passed && readability.textContrast.score >= thumbThresholds.minReadabilityScore;
        }
        break;

      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    const result: MediaQAResult = {
      jobId: job.id,
      type: job.type,
      passed,
      score,
      details,
      thresholdsApplied: this.flattenThresholds(thresholds, job.type),
      processingTimeMs: Date.now() - startTime,
    };

    // Emit audit events
    this.emit('audit', {
      event_type: passed ? 'media_qa_completed' : 'media_qa_failed',
      client_id: job.clientId,
      payload: {
        jobId: job.id,
        type: job.type,
        passed,
        score,
        failReasons: !passed ? (details as any).failReasons : undefined,
      },
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  async processBatch(
    jobs: MediaQAJob[],
    options: { concurrency?: number } = {}
  ): Promise<MediaQAResult[]> {
    const limit = pLimit(options.concurrency || 3);
    return Promise.all(jobs.map(job => limit(() => this.process(job))));
  }

  async processContentBrief(input: ContentBriefQAInput): Promise<ContentBriefQAResult> {
    const startTime = Date.now();
    const imageResults: MediaQAResult[] = [];
    const failedAssets: ContentBriefQAResult['failedAssets'] = [];

    // Process images
    if (input.assets.images) {
      for (let i = 0; i < input.assets.images.length; i++) {
        const result = await this.process({
          id: `${input.briefId}-image-${i}`,
          type: 'image',
          asset: {
            buffer: input.assets.images[i],
            expectedDimensions: input.expectedDimensions || { width: 1080, height: 1080 },
            format: 'png',
          },
          platform: input.platform as any,
          clientId: input.clientId,
        });

        imageResults.push(result);

        if (!result.passed) {
          failedAssets.push({
            type: 'image',
            index: i,
            reason: (result.details as ImageQAResult).failReasons.join(', '),
          });
        }
      }
    }

    // Process video
    let videoResult: MediaQAResult | undefined;
    if (input.assets.video) {
      videoResult = await this.process({
        id: `${input.briefId}-video`,
        type: 'video',
        asset: {
          videoBuffer: input.assets.video,
          platform: input.platform,
        },
        platform: input.platform as any,
        clientId: input.clientId,
      });

      if (!videoResult.passed) {
        failedAssets.push({
          type: 'video',
          reason: (videoResult.details as VideoQAResult).failReasons.join(', '),
        });
      }
    }

    // Process thumbnail
    let thumbnailResult: MediaQAResult | undefined;
    if (input.assets.thumbnail) {
      thumbnailResult = await this.process({
        id: `${input.briefId}-thumbnail`,
        type: 'thumbnail',
        asset: {
          buffer: input.assets.thumbnail,
          expectedDimensions: { width: 1280, height: 720 },
          hasTextOverlay: true,
        },
        platform: input.platform as any,
        clientId: input.clientId,
      });

      if (!thumbnailResult.passed) {
        failedAssets.push({
          type: 'thumbnail',
          reason: (thumbnailResult.details as ThumbnailQAResult).failReasons.join(', '),
        });
      }
    }

    return {
      briefId: input.briefId,
      imageResults,
      videoResult,
      thumbnailResult,
      overallPassed: failedAssets.length === 0,
      failedAssets,
      totalProcessingTimeMs: Date.now() - startTime,
    };
  }

  private getThresholdsForJob(job: MediaQAJob): QAThresholds {
    const platformThresholds = this.platformThresholds[job.platform];
    if (!platformThresholds) return this.thresholds;

    return {
      image: { ...this.thresholds.image, ...platformThresholds.image },
      video: { ...this.thresholds.video, ...platformThresholds.video },
      thumbnail: { ...this.thresholds.thumbnail, ...platformThresholds.thumbnail },
    };
  }

  private flattenThresholds(
    thresholds: QAThresholds,
    type: 'image' | 'video' | 'thumbnail'
  ): Record<string, number> {
    const typeThresholds = thresholds[type] || {};
    return Object.entries(typeThresholds).reduce((acc, [key, value]) => {
      if (typeof value === 'number') {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, number>);
  }
}
```

#### Step 6: Export Module

Create `packages/agents/media/src/qa/index.ts`:

```typescript
export * from './schemas';
export * from './image-qa';
export * from './video-qa';
export * from './thumbnail-qa';
export * from './media-qa-pipeline';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/agents/media
pnpm test src/qa/__tests__/

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint src/qa/
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/media/src/qa/schemas.ts` | QA type definitions |
| Create | `packages/agents/media/src/qa/image-qa.ts` | Image quality scorer |
| Create | `packages/agents/media/src/qa/video-qa.ts` | Video quality scorer |
| Create | `packages/agents/media/src/qa/thumbnail-qa.ts` | Thumbnail quality scorer |
| Create | `packages/agents/media/src/qa/media-qa-pipeline.ts` | Unified QA pipeline |
| Create | `packages/agents/media/src/qa/index.ts` | Module exports |
| Create | `packages/agents/media/src/qa/__tests__/image-qa.test.ts` | Image QA tests |
| Create | `packages/agents/media/src/qa/__tests__/video-qa.test.ts` | Video QA tests |
| Create | `packages/agents/media/src/qa/__tests__/thumbnail-qa.test.ts` | Thumbnail QA tests |
| Create | `packages/agents/media/src/qa/__tests__/media-qa-pipeline.test.ts` | Pipeline tests |

---

## Acceptance Criteria

- [ ] ImageQAScorer validates dimensions, format, file size, sharpness, contrast, and brand alignment
- [ ] VideoQAScorer validates duration, resolution, framerate, codec, bitrate, and audio
- [ ] ThumbnailQAScorer validates readability, focal point, vibrancy, and predicts clickthrough
- [ ] MediaQAPipeline processes all media types with configurable thresholds
- [ ] Platform-specific thresholds are applied correctly
- [ ] Batch processing respects concurrency limits
- [ ] Content brief aggregation identifies all failed assets
- [ ] Audit events are emitted for all QA results
- [ ] All tests pass

---

## Test Requirements

### Unit Tests
- Test each scorer in isolation with mock images/videos
- Test threshold configurations
- Test score calculations

### Integration Tests
- Test pipeline with real media files
- Test batch processing
- Test content brief aggregation

### Performance Tests
- Measure processing time per asset type
- Verify concurrency limits work correctly

---

## Security & Safety Checklist

- [ ] No hardcoded secrets
- [ ] Temp files are cleaned up after processing
- [ ] File buffers are not leaked
- [ ] Client ID is included in all audit events
- [ ] Platform requirements are configurable

---

## JSON Task Block

```json
{
  "task_id": "S2-D5",
  "name": "Media QA System",
  "status": "pending",
  "dependencies": ["S2-D2", "S2-D3", "S2-D4"],
  "blocks": [],
  "created_at": "2025-01-16T00:00:00Z",
  "updated_at": "2025-01-16T00:00:00Z",
  "complexity": "high",
  "agent": "D",
  "sprint": 2,
  "package": "@rtv/agents/media",
  "files": [
    "packages/agents/media/src/qa/schemas.ts",
    "packages/agents/media/src/qa/image-qa.ts",
    "packages/agents/media/src/qa/video-qa.ts",
    "packages/agents/media/src/qa/thumbnail-qa.ts",
    "packages/agents/media/src/qa/media-qa-pipeline.ts",
    "packages/agents/media/src/qa/index.ts"
  ],
  "test_files": [
    "packages/agents/media/src/qa/__tests__/image-qa.test.ts",
    "packages/agents/media/src/qa/__tests__/video-qa.test.ts",
    "packages/agents/media/src/qa/__tests__/thumbnail-qa.test.ts",
    "packages/agents/media/src/qa/__tests__/media-qa-pipeline.test.ts"
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
  "token_budget": 12000,
  "tokens_used": 0,
  "context_refs": [
    "spec://docs/01-architecture/system-architecture-v3.md",
    "spec://docs/03-agents-tools/tool-registry-spec.md",
    "spec://docs/02-schemas/external-memory-schema.md"
  ],
  "summary_trigger": "on_complete",
  "write_permissions": [
    "packages/agents/media/src/qa/**"
  ],
  "read_permissions": [
    "packages/agents/media/src/**",
    "packages/core/**",
    "docs/**"
  ],
  "predecessor_summaries": [
    "S2-D2: ImageGenerationLane with provider adapters",
    "S2-D3: VideoGenerator with motion templates",
    "S2-D4: ThumbnailGenerator with styles"
  ]
}
```
