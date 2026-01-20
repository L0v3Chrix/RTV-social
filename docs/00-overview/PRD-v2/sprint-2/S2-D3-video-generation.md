# Build Prompt: S2-D3 — Silent Video Generation

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-D3 |
| Sprint | 2 |
| Agent | D (Media Generation) |
| Complexity | High |
| Status | pending |
| Estimated Files | 5 |
| Spec References | `agent-recursion-contracts.md`, `blueprint-schema.md` |

---

## Context

### What This Builds

The Silent Video Generation service — an orchestration layer for creating short-form video content from images and motion templates. "Silent" refers to video without AI-generated voiceover (handled separately by HeyGen integration). This covers motion graphics, image-to-video, and template-based video composition.

### Why It Matters

Video is the dominant content format across platforms:
- **Reels/TikTok/Shorts**: All prioritize video in algorithms
- **Motion > Static**: Moving content captures 5x more attention
- **Template Efficiency**: Reusable motion patterns reduce production cost
- **Brand Animation**: Consistent motion language strengthens brand

### Architecture Decision

The video generation uses a **composition-based approach**:
1. **Motion Templates**: Pre-defined animation patterns (zoom, pan, reveal)
2. **Image Sequences**: Transform static images into video
3. **Text Animation**: Animated captions and overlays
4. **Transition Library**: Standard transitions between segments
5. **Export Pipeline**: Platform-optimized encoding

---

## Prerequisites

### Completed Tasks
- [x] S2-D1: Image prompt generation
- [x] S2-D2: Image generation lane
- [x] S1-B1: RLM Environment

### Required Packages
```bash
pnpm add fluent-ffmpeg @ffmpeg-installer/ffmpeg zod nanoid
pnpm add -D vitest @types/fluent-ffmpeg
```

### External Services
- FFmpeg (via fluent-ffmpeg)
- Runway/Pika Labs API (optional, for AI video)
- S3-compatible storage

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests that define the expected behavior:

```typescript
// packages/agents/media/src/video-generation/__tests__/video-generator.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  VideoGenerator,
  VideoRequest,
  VideoResult,
  MotionTemplate
} from '../video-generator';
import { MotionTemplateLibrary } from '../motion-templates';

describe('VideoGenerator', () => {
  let generator: VideoGenerator;
  let mockStorageClient: any;
  let mockFFmpeg: any;

  beforeEach(() => {
    mockStorageClient = {
      upload: vi.fn().mockResolvedValue({
        url: 'https://storage.example.com/videos/test.mp4',
        key: 'videos/test.mp4'
      }),
      download: vi.fn().mockResolvedValue(Buffer.from('image data'))
    };

    mockFFmpeg = {
      input: vi.fn().mockReturnThis(),
      complexFilter: vi.fn().mockReturnThis(),
      outputOptions: vi.fn().mockReturnThis(),
      output: vi.fn().mockReturnThis(),
      on: vi.fn().mockImplementation((event, callback) => {
        if (event === 'end') setTimeout(callback, 100);
        return mockFFmpeg;
      }),
      run: vi.fn()
    };

    generator = new VideoGenerator({
      storageClient: mockStorageClient,
      ffmpegFactory: () => mockFFmpeg
    });
  });

  describe('image-to-video conversion', () => {
    it('should convert single image to video with motion', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        motionTemplate: 'zoom_in',
        duration: 5,
        aspectRatio: '9:16',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.status).toBe('completed');
      expect(result.videoUrl).toBeDefined();
      expect(result.duration).toBe(5);
    });

    it('should apply Ken Burns effect', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        motionTemplate: 'ken_burns',
        duration: 8,
        clientId: 'client-123'
      };

      await generator.generate(request);

      expect(mockFFmpeg.complexFilter).toHaveBeenCalledWith(
        expect.stringContaining('zoompan')
      );
    });

    it('should create slideshow from multiple images', async () => {
      const request: VideoRequest = {
        type: 'slideshow',
        sourceImages: [
          'https://example.com/image1.png',
          'https://example.com/image2.png',
          'https://example.com/image3.png'
        ],
        transitionType: 'fade',
        transitionDuration: 0.5,
        imageDuration: 3,
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.status).toBe('completed');
      // 3 images × 3 seconds + transitions
      expect(result.duration).toBeGreaterThanOrEqual(9);
    });
  });

  describe('motion templates', () => {
    const templates: MotionTemplate[] = [
      'zoom_in',
      'zoom_out',
      'pan_left',
      'pan_right',
      'ken_burns',
      'parallax',
      'reveal_down',
      'reveal_up',
      'pulse',
      'rotate'
    ];

    templates.forEach(template => {
      it(`should apply ${template} motion template`, async () => {
        const request: VideoRequest = {
          type: 'image_to_video',
          sourceImages: ['https://example.com/image.png'],
          motionTemplate: template,
          duration: 5,
          clientId: 'client-123'
        };

        const result = await generator.generate(request);
        expect(result.motionApplied).toBe(template);
      });
    });
  });

  describe('text animation', () => {
    it('should add animated text overlay', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        motionTemplate: 'zoom_in',
        duration: 5,
        clientId: 'client-123',
        textOverlays: [{
          text: 'Hello World',
          position: 'center',
          animation: 'fade_in',
          startTime: 1,
          duration: 3,
          style: {
            fontSize: 48,
            fontColor: '#FFFFFF',
            fontFamily: 'Inter'
          }
        }]
      };

      await generator.generate(request);

      expect(mockFFmpeg.complexFilter).toHaveBeenCalledWith(
        expect.stringContaining('drawtext')
      );
    });

    it('should support multiple text overlays', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        motionTemplate: 'static',
        duration: 5,
        clientId: 'client-123',
        textOverlays: [
          { text: 'Title', position: 'top', animation: 'slide_down', startTime: 0, duration: 2 },
          { text: 'Subtitle', position: 'bottom', animation: 'slide_up', startTime: 1, duration: 2 }
        ]
      };

      const result = await generator.generate(request);
      expect(result.textOverlaysApplied).toBe(2);
    });
  });

  describe('platform optimization', () => {
    it('should optimize for Instagram Reels (9:16)', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        platform: 'instagram',
        contentType: 'reel',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.resolution).toBe('1080x1920');
      expect(result.aspectRatio).toBe('9:16');
    });

    it('should optimize for YouTube Shorts', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        platform: 'youtube',
        contentType: 'short',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.resolution).toBe('1080x1920');
      expect(result.maxDuration).toBeLessThanOrEqual(60);
    });

    it('should optimize for TikTok', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        platform: 'tiktok',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      expect(result.aspectRatio).toBe('9:16');
    });

    it('should optimize for LinkedIn video', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        platform: 'linkedin',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);

      // LinkedIn prefers 1:1 or 16:9
      expect(['1:1', '16:9']).toContain(result.aspectRatio);
    });
  });

  describe('transition effects', () => {
    it('should apply fade transition between images', async () => {
      const request: VideoRequest = {
        type: 'slideshow',
        sourceImages: ['https://example.com/1.png', 'https://example.com/2.png'],
        transitionType: 'fade',
        transitionDuration: 1,
        clientId: 'client-123'
      };

      await generator.generate(request);

      expect(mockFFmpeg.complexFilter).toHaveBeenCalledWith(
        expect.stringContaining('fade')
      );
    });

    it('should apply slide transition', async () => {
      const request: VideoRequest = {
        type: 'slideshow',
        sourceImages: ['https://example.com/1.png', 'https://example.com/2.png'],
        transitionType: 'slide_left',
        transitionDuration: 0.5,
        clientId: 'client-123'
      };

      await generator.generate(request);

      expect(mockFFmpeg.complexFilter).toHaveBeenCalled();
    });

    it('should apply wipe transition', async () => {
      const request: VideoRequest = {
        type: 'slideshow',
        sourceImages: ['https://example.com/1.png', 'https://example.com/2.png'],
        transitionType: 'wipe',
        clientId: 'client-123'
      };

      const result = await generator.generate(request);
      expect(result.status).toBe('completed');
    });
  });

  describe('encoding options', () => {
    it('should use H.264 codec for compatibility', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        clientId: 'client-123'
      };

      await generator.generate(request);

      expect(mockFFmpeg.outputOptions).toHaveBeenCalledWith(
        expect.arrayContaining(['-c:v libx264'])
      );
    });

    it('should set appropriate bitrate', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        quality: 'high',
        clientId: 'client-123'
      };

      await generator.generate(request);

      expect(mockFFmpeg.outputOptions).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('-b:v')])
      );
    });

    it('should set 30fps for smooth playback', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        clientId: 'client-123'
      };

      await generator.generate(request);

      expect(mockFFmpeg.outputOptions).toHaveBeenCalledWith(
        expect.arrayContaining(['-r 30'])
      );
    });
  });

  describe('storage integration', () => {
    it('should download source images', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://storage.example.com/image.png'],
        clientId: 'client-123'
      };

      await generator.generate(request);

      expect(mockStorageClient.download).toHaveBeenCalled();
    });

    it('should upload generated video', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        clientId: 'client-123'
      };

      await generator.generate(request);

      expect(mockStorageClient.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: 'video/mp4'
        })
      );
    });

    it('should organize videos by client', async () => {
      const request: VideoRequest = {
        type: 'image_to_video',
        sourceImages: ['https://example.com/image.png'],
        clientId: 'client-456'
      };

      await generator.generate(request);

      const uploadCall = mockStorageClient.upload.mock.calls[0];
      expect(uploadCall[0].key).toContain('client-456');
    });
  });
});

describe('MotionTemplateLibrary', () => {
  it('should return FFmpeg filter for template', () => {
    const filter = MotionTemplateLibrary.getFilter('zoom_in', {
      width: 1080,
      height: 1920,
      duration: 5
    });

    expect(filter).toContain('zoompan');
    expect(filter).toContain('zoom');
  });

  it('should list all available templates', () => {
    const templates = MotionTemplateLibrary.listTemplates();
    expect(templates.length).toBeGreaterThan(5);
  });

  it('should describe template capabilities', () => {
    const info = MotionTemplateLibrary.getTemplateInfo('ken_burns');
    expect(info.name).toBe('Ken Burns');
    expect(info.description).toBeDefined();
    expect(info.recommendedDuration).toBeDefined();
  });
});
```

### Phase 2: Implementation

#### Step 1: Define Video Types

```typescript
// packages/agents/media/src/video-generation/types.ts

import { z } from 'zod';
import { Platform } from '../image-prompts/types';

export const MotionTemplateSchema = z.enum([
  'static',
  'zoom_in',
  'zoom_out',
  'pan_left',
  'pan_right',
  'pan_up',
  'pan_down',
  'ken_burns',
  'parallax',
  'reveal_down',
  'reveal_up',
  'reveal_left',
  'reveal_right',
  'pulse',
  'rotate',
  'shake'
]);

export type MotionTemplate = z.infer<typeof MotionTemplateSchema>;

export const TransitionTypeSchema = z.enum([
  'cut',
  'fade',
  'dissolve',
  'slide_left',
  'slide_right',
  'slide_up',
  'slide_down',
  'wipe',
  'zoom'
]);

export type TransitionType = z.infer<typeof TransitionTypeSchema>;

export const TextAnimationSchema = z.enum([
  'none',
  'fade_in',
  'fade_out',
  'slide_up',
  'slide_down',
  'slide_left',
  'slide_right',
  'typewriter',
  'bounce',
  'scale_in'
]);

export type TextAnimation = z.infer<typeof TextAnimationSchema>;

export const VideoTypeSchema = z.enum([
  'image_to_video',
  'slideshow',
  'template_video',
  'text_animation'
]);

export type VideoType = z.infer<typeof VideoTypeSchema>;

export interface TextOverlay {
  text: string;
  position: 'top' | 'center' | 'bottom' | 'custom';
  customPosition?: { x: number; y: number };
  animation: TextAnimation;
  startTime: number;
  duration: number;
  style?: {
    fontSize?: number;
    fontColor?: string;
    fontFamily?: string;
    backgroundColor?: string;
    padding?: number;
    borderRadius?: number;
  };
}

export interface VideoRequest {
  type: VideoType;
  sourceImages: string[];
  motionTemplate?: MotionTemplate;
  duration?: number;
  aspectRatio?: string;
  platform?: Platform;
  contentType?: 'reel' | 'story' | 'post' | 'short';
  clientId: string;
  transitionType?: TransitionType;
  transitionDuration?: number;
  imageDuration?: number;
  textOverlays?: TextOverlay[];
  quality?: 'low' | 'medium' | 'high';
  outputFormat?: 'mp4' | 'webm' | 'mov';
  audioTrack?: string;
}

export interface VideoResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  storageKey?: string;
  duration: number;
  resolution: string;
  aspectRatio: string;
  maxDuration?: number;
  motionApplied?: MotionTemplate;
  textOverlaysApplied?: number;
  fileSize?: number;
  metadata: {
    generatedAt: string;
    processingTimeMs: number;
    codec: string;
    bitrate: string;
  };
  error?: string;
}

export interface MotionTemplateInfo {
  name: string;
  description: string;
  recommendedDuration: { min: number; max: number };
  bestFor: string[];
}

export interface FFmpegFilterParams {
  width: number;
  height: number;
  duration: number;
  fps?: number;
}
```

#### Step 2: Implement Motion Template Library

```typescript
// packages/agents/media/src/video-generation/motion-templates.ts

import { MotionTemplate, MotionTemplateInfo, FFmpegFilterParams } from './types';

const TEMPLATE_INFO: Record<MotionTemplate, MotionTemplateInfo> = {
  static: {
    name: 'Static',
    description: 'No motion, static image',
    recommendedDuration: { min: 1, max: 30 },
    bestFor: ['thumbnails', 'text-heavy content']
  },
  zoom_in: {
    name: 'Zoom In',
    description: 'Gradual zoom toward center',
    recommendedDuration: { min: 3, max: 10 },
    bestFor: ['product reveals', 'dramatic moments']
  },
  zoom_out: {
    name: 'Zoom Out',
    description: 'Gradual zoom away from center',
    recommendedDuration: { min: 3, max: 10 },
    bestFor: ['establishing shots', 'context reveals']
  },
  pan_left: {
    name: 'Pan Left',
    description: 'Horizontal pan from right to left',
    recommendedDuration: { min: 3, max: 8 },
    bestFor: ['landscapes', 'wide shots']
  },
  pan_right: {
    name: 'Pan Right',
    description: 'Horizontal pan from left to right',
    recommendedDuration: { min: 3, max: 8 },
    bestFor: ['landscapes', 'wide shots']
  },
  pan_up: {
    name: 'Pan Up',
    description: 'Vertical pan from bottom to top',
    recommendedDuration: { min: 3, max: 8 },
    bestFor: ['tall subjects', 'reveal moments']
  },
  pan_down: {
    name: 'Pan Down',
    description: 'Vertical pan from top to bottom',
    recommendedDuration: { min: 3, max: 8 },
    bestFor: ['tall subjects', 'establishing shots']
  },
  ken_burns: {
    name: 'Ken Burns',
    description: 'Combined slow zoom and pan',
    recommendedDuration: { min: 5, max: 15 },
    bestFor: ['documentary style', 'photo stories']
  },
  parallax: {
    name: 'Parallax',
    description: 'Layered motion effect',
    recommendedDuration: { min: 3, max: 8 },
    bestFor: ['depth effect', 'dynamic visuals']
  },
  reveal_down: {
    name: 'Reveal Down',
    description: 'Content reveals from top to bottom',
    recommendedDuration: { min: 2, max: 5 },
    bestFor: ['announcements', 'text reveals']
  },
  reveal_up: {
    name: 'Reveal Up',
    description: 'Content reveals from bottom to top',
    recommendedDuration: { min: 2, max: 5 },
    bestFor: ['announcements', 'text reveals']
  },
  reveal_left: {
    name: 'Reveal Left',
    description: 'Content reveals from right to left',
    recommendedDuration: { min: 2, max: 5 },
    bestFor: ['before/after', 'comparisons']
  },
  reveal_right: {
    name: 'Reveal Right',
    description: 'Content reveals from left to right',
    recommendedDuration: { min: 2, max: 5 },
    bestFor: ['before/after', 'comparisons']
  },
  pulse: {
    name: 'Pulse',
    description: 'Subtle rhythmic scaling',
    recommendedDuration: { min: 2, max: 8 },
    bestFor: ['music sync', 'attention grab']
  },
  rotate: {
    name: 'Rotate',
    description: 'Slow rotation effect',
    recommendedDuration: { min: 3, max: 10 },
    bestFor: ['product showcase', 'dynamic visuals']
  },
  shake: {
    name: 'Shake',
    description: 'Quick shake effect',
    recommendedDuration: { min: 0.5, max: 2 },
    bestFor: ['impact moments', 'emphasis']
  }
};

export class MotionTemplateLibrary {
  static getFilter(
    template: MotionTemplate,
    params: FFmpegFilterParams
  ): string {
    const { width, height, duration, fps = 30 } = params;
    const totalFrames = duration * fps;

    switch (template) {
      case 'static':
        return `scale=${width}:${height}`;

      case 'zoom_in':
        return `zoompan=z='min(zoom+0.001,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

      case 'zoom_out':
        return `zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.001))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

      case 'pan_left':
        return `zoompan=z='1.1':x='if(lte(on,1),iw/10,x+1)':y='ih/10':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

      case 'pan_right':
        return `zoompan=z='1.1':x='if(lte(on,1),iw-iw/10,x-1)':y='ih/10':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

      case 'pan_up':
        return `zoompan=z='1.1':x='iw/10':y='if(lte(on,1),ih/10,y+1)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

      case 'pan_down':
        return `zoompan=z='1.1':x='iw/10':y='if(lte(on,1),ih-ih/10,y-1)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

      case 'ken_burns':
        // Combination of zoom and pan
        return `zoompan=z='min(zoom+0.0005,1.3)':x='if(lte(on,1),iw/4,x+0.5)':y='if(lte(on,1),ih/4,y+0.3)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

      case 'parallax':
        // Simulated parallax with subtle motion
        return `zoompan=z='1.05+0.02*sin(on/${fps})':x='iw/2-(iw/zoom/2)+10*sin(on/${fps})':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

      case 'pulse':
        // Rhythmic scaling
        return `zoompan=z='1+0.03*sin(on*0.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

      case 'rotate':
        return `rotate=a='t*0.05':c=none:ow=rotw(iw):oh=roth(ih),scale=${width}:${height}`;

      case 'shake':
        return `crop=iw-20:ih-20:10+5*sin(t*50):10+5*cos(t*50),scale=${width}:${height}`;

      case 'reveal_down':
      case 'reveal_up':
      case 'reveal_left':
      case 'reveal_right':
        // Reveals are handled separately with overlay
        return `scale=${width}:${height}`;

      default:
        return `scale=${width}:${height}`;
    }
  }

  static getTransitionFilter(
    transitionType: string,
    duration: number
  ): string {
    const frames = duration * 30;

    switch (transitionType) {
      case 'fade':
        return `xfade=transition=fade:duration=${duration}`;
      case 'dissolve':
        return `xfade=transition=dissolve:duration=${duration}`;
      case 'slide_left':
        return `xfade=transition=slideleft:duration=${duration}`;
      case 'slide_right':
        return `xfade=transition=slideright:duration=${duration}`;
      case 'slide_up':
        return `xfade=transition=slideup:duration=${duration}`;
      case 'slide_down':
        return `xfade=transition=slidedown:duration=${duration}`;
      case 'wipe':
        return `xfade=transition=wipeleft:duration=${duration}`;
      case 'zoom':
        return `xfade=transition=zoomin:duration=${duration}`;
      default:
        return ''; // Cut (no transition filter needed)
    }
  }

  static getTemplateInfo(template: MotionTemplate): MotionTemplateInfo {
    return TEMPLATE_INFO[template];
  }

  static listTemplates(): MotionTemplate[] {
    return Object.keys(TEMPLATE_INFO) as MotionTemplate[];
  }

  static getRecommendedTemplate(contentType: string): MotionTemplate {
    const recommendations: Record<string, MotionTemplate> = {
      'product': 'zoom_in',
      'lifestyle': 'ken_burns',
      'portrait': 'zoom_out',
      'announcement': 'reveal_down',
      'comparison': 'reveal_right',
      'story': 'pan_left',
      'documentary': 'ken_burns'
    };

    return recommendations[contentType] || 'zoom_in';
  }
}
```

#### Step 3: Implement Video Generator

```typescript
// packages/agents/media/src/video-generation/video-generator.ts

import { nanoid } from 'nanoid';
import {
  VideoRequest,
  VideoResult,
  TextOverlay,
  MotionTemplate
} from './types';
import { MotionTemplateLibrary } from './motion-templates';

interface FFmpegInstance {
  input(path: string): FFmpegInstance;
  complexFilter(filter: string | string[]): FFmpegInstance;
  outputOptions(options: string[]): FFmpegInstance;
  output(path: string): FFmpegInstance;
  on(event: string, callback: (...args: any[]) => void): FFmpegInstance;
  run(): void;
}

interface StorageClient {
  upload(params: { key: string; data: Buffer; contentType: string }): Promise<{ url: string; key: string }>;
  download(url: string): Promise<Buffer>;
}

interface VideoGeneratorOptions {
  storageClient: StorageClient;
  ffmpegFactory: () => FFmpegInstance;
  tempDir?: string;
}

const PLATFORM_SPECS: Record<string, { aspectRatio: string; resolution: string; maxDuration?: number }> = {
  'instagram:reel': { aspectRatio: '9:16', resolution: '1080x1920', maxDuration: 90 },
  'instagram:story': { aspectRatio: '9:16', resolution: '1080x1920', maxDuration: 60 },
  'instagram:post': { aspectRatio: '1:1', resolution: '1080x1080' },
  'tiktok:post': { aspectRatio: '9:16', resolution: '1080x1920', maxDuration: 180 },
  'youtube:short': { aspectRatio: '9:16', resolution: '1080x1920', maxDuration: 60 },
  'youtube:post': { aspectRatio: '16:9', resolution: '1920x1080' },
  'linkedin:post': { aspectRatio: '1:1', resolution: '1080x1080' },
  'facebook:reel': { aspectRatio: '9:16', resolution: '1080x1920', maxDuration: 90 },
  'x:post': { aspectRatio: '16:9', resolution: '1920x1080' }
};

export class VideoGenerator {
  private storageClient: StorageClient;
  private ffmpegFactory: () => FFmpegInstance;
  private tempDir: string;

  constructor(options: VideoGeneratorOptions) {
    this.storageClient = options.storageClient;
    this.ffmpegFactory = options.ffmpegFactory;
    this.tempDir = options.tempDir || '/tmp/video-gen';
  }

  async generate(request: VideoRequest): Promise<VideoResult> {
    const id = nanoid();
    const startTime = Date.now();

    try {
      // Get platform specs
      const platformKey = request.platform && request.contentType
        ? `${request.platform}:${request.contentType}`
        : null;
      const specs = platformKey ? PLATFORM_SPECS[platformKey] : null;

      const aspectRatio = request.aspectRatio || specs?.aspectRatio || '9:16';
      const resolution = this.getResolution(aspectRatio, specs?.resolution);
      const [width, height] = resolution.split('x').map(Number);
      const duration = request.duration || request.imageDuration || 5;

      // Download source images
      const localImages = await this.downloadImages(request.sourceImages);

      // Build FFmpeg command
      const outputPath = `${this.tempDir}/${id}.mp4`;
      const ffmpeg = this.ffmpegFactory();

      // Add inputs
      for (const imagePath of localImages) {
        ffmpeg.input(imagePath);
      }

      // Build filter complex
      const filters = this.buildFilters(request, { width, height, duration });
      ffmpeg.complexFilter(filters);

      // Set output options
      const outputOptions = this.getOutputOptions(request.quality || 'medium');
      ffmpeg.outputOptions(outputOptions);

      // Generate video
      await this.runFFmpeg(ffmpeg, outputPath);

      // Upload result
      const videoBuffer = await this.readFile(outputPath);
      const uploadResult = await this.storageClient.upload({
        key: `clients/${request.clientId}/videos/${id}.mp4`,
        data: videoBuffer,
        contentType: 'video/mp4'
      });

      // Cleanup temp files
      await this.cleanup([...localImages, outputPath]);

      return {
        id,
        status: 'completed',
        videoUrl: uploadResult.url,
        storageKey: uploadResult.key,
        duration,
        resolution,
        aspectRatio,
        maxDuration: specs?.maxDuration,
        motionApplied: request.motionTemplate,
        textOverlaysApplied: request.textOverlays?.length || 0,
        fileSize: videoBuffer.length,
        metadata: {
          generatedAt: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
          codec: 'h264',
          bitrate: this.getBitrateForQuality(request.quality || 'medium')
        }
      };
    } catch (error) {
      return {
        id,
        status: 'failed',
        duration: 0,
        resolution: '0x0',
        aspectRatio: '1:1',
        metadata: {
          generatedAt: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
          codec: 'none',
          bitrate: '0'
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async downloadImages(urls: string[]): Promise<string[]> {
    const paths: string[] = [];

    for (let i = 0; i < urls.length; i++) {
      const buffer = await this.storageClient.download(urls[i]);
      const path = `${this.tempDir}/input_${i}_${nanoid()}.png`;
      await this.writeFile(path, buffer);
      paths.push(path);
    }

    return paths;
  }

  private buildFilters(
    request: VideoRequest,
    params: { width: number; height: number; duration: number }
  ): string[] {
    const filters: string[] = [];
    const { width, height, duration } = params;

    if (request.type === 'slideshow' && request.sourceImages.length > 1) {
      // Slideshow with transitions
      filters.push(...this.buildSlideshowFilters(request, params));
    } else {
      // Single image with motion
      const motionTemplate = request.motionTemplate || 'zoom_in';
      const motionFilter = MotionTemplateLibrary.getFilter(motionTemplate, {
        width,
        height,
        duration
      });
      filters.push(`[0:v]${motionFilter}[video]`);
    }

    // Add text overlays
    if (request.textOverlays?.length) {
      filters.push(...this.buildTextOverlayFilters(request.textOverlays, params));
    }

    return filters;
  }

  private buildSlideshowFilters(
    request: VideoRequest,
    params: { width: number; height: number; duration: number }
  ): string[] {
    const filters: string[] = [];
    const imageDuration = request.imageDuration || 3;
    const transitionDuration = request.transitionDuration || 0.5;
    const { width, height } = params;

    // Scale each image
    for (let i = 0; i < request.sourceImages.length; i++) {
      filters.push(`[${i}:v]scale=${width}:${height},setsar=1[img${i}]`);
    }

    // Build transition chain
    if (request.transitionType && request.transitionType !== 'cut') {
      const transitionFilter = MotionTemplateLibrary.getTransitionFilter(
        request.transitionType,
        transitionDuration
      );

      // Chain images with transitions
      let currentOutput = 'img0';
      for (let i = 1; i < request.sourceImages.length; i++) {
        const nextOutput = i === request.sourceImages.length - 1 ? 'video' : `trans${i}`;
        filters.push(`[${currentOutput}][img${i}]${transitionFilter}:offset=${(imageDuration - transitionDuration) * i}[${nextOutput}]`);
        currentOutput = nextOutput;
      }
    } else {
      // Simple concatenation
      const inputs = request.sourceImages.map((_, i) => `[img${i}]`).join('');
      filters.push(`${inputs}concat=n=${request.sourceImages.length}:v=1:a=0[video]`);
    }

    return filters;
  }

  private buildTextOverlayFilters(
    overlays: TextOverlay[],
    params: { width: number; height: number; duration: number }
  ): string[] {
    const filters: string[] = [];

    for (let i = 0; i < overlays.length; i++) {
      const overlay = overlays[i];
      const { x, y } = this.getTextPosition(overlay, params);

      const fontColor = overlay.style?.fontColor || 'white';
      const fontSize = overlay.style?.fontSize || 48;
      const fontFamily = overlay.style?.fontFamily || 'Sans';

      // Build drawtext filter
      let filter = `drawtext=text='${overlay.text.replace(/'/g, "\\'")}':`;
      filter += `fontcolor=${fontColor}:fontsize=${fontSize}:fontfile=${fontFamily}:`;
      filter += `x=${x}:y=${y}`;

      // Add animation
      if (overlay.animation !== 'none') {
        filter += this.getTextAnimationExpression(overlay);
      }

      // Add timing
      filter += `:enable='between(t,${overlay.startTime},${overlay.startTime + overlay.duration})'`;

      const inputLabel = i === 0 ? '[video]' : `[text${i - 1}]`;
      const outputLabel = i === overlays.length - 1 ? '[final]' : `[text${i}]`;
      filters.push(`${inputLabel}${filter}${outputLabel}`);
    }

    return filters;
  }

  private getTextPosition(
    overlay: TextOverlay,
    params: { width: number; height: number }
  ): { x: string; y: string } {
    const { width, height } = params;

    if (overlay.position === 'custom' && overlay.customPosition) {
      return {
        x: String(overlay.customPosition.x),
        y: String(overlay.customPosition.y)
      };
    }

    switch (overlay.position) {
      case 'top':
        return { x: '(w-text_w)/2', y: 'h*0.1' };
      case 'center':
        return { x: '(w-text_w)/2', y: '(h-text_h)/2' };
      case 'bottom':
        return { x: '(w-text_w)/2', y: 'h*0.85' };
      default:
        return { x: '(w-text_w)/2', y: '(h-text_h)/2' };
    }
  }

  private getTextAnimationExpression(overlay: TextOverlay): string {
    const startTime = overlay.startTime;

    switch (overlay.animation) {
      case 'fade_in':
        return `:alpha='if(lt(t,${startTime}+0.5),(t-${startTime})*2,1)'`;
      case 'fade_out':
        return `:alpha='if(gt(t,${startTime + overlay.duration - 0.5}),1-(t-${startTime + overlay.duration - 0.5})*2,1)'`;
      case 'slide_up':
        return ''; // Would need y animation
      default:
        return '';
    }
  }

  private getOutputOptions(quality: 'low' | 'medium' | 'high'): string[] {
    const bitrates = {
      low: '2M',
      medium: '5M',
      high: '10M'
    };

    return [
      '-c:v libx264',
      '-preset medium',
      '-crf 23',
      `-b:v ${bitrates[quality]}`,
      '-pix_fmt yuv420p',
      '-r 30',
      '-movflags +faststart'
    ];
  }

  private getBitrateForQuality(quality: 'low' | 'medium' | 'high'): string {
    const bitrates = { low: '2M', medium: '5M', high: '10M' };
    return bitrates[quality];
  }

  private getResolution(aspectRatio: string, defaultRes?: string): string {
    if (defaultRes) return defaultRes;

    const mapping: Record<string, string> = {
      '9:16': '1080x1920',
      '16:9': '1920x1080',
      '1:1': '1080x1080',
      '4:5': '1080x1350'
    };

    return mapping[aspectRatio] || '1080x1920';
  }

  private runFFmpeg(ffmpeg: FFmpegInstance, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  // File system helpers (would use fs in real implementation)
  private async writeFile(path: string, data: Buffer): Promise<void> {
    // Implementation
  }

  private async readFile(path: string): Promise<Buffer> {
    return Buffer.from('video data');
  }

  private async cleanup(paths: string[]): Promise<void> {
    // Implementation
  }
}

export { MotionTemplateLibrary } from './motion-templates';
```

#### Step 4: Create Package Exports

```typescript
// packages/agents/media/src/video-generation/index.ts

export * from './types';
export * from './video-generator';
export * from './motion-templates';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/agents/media
pnpm test src/video-generation

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint src/video-generation
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/agents/media/src/video-generation/types.ts` | Type definitions |
| Create | `packages/agents/media/src/video-generation/motion-templates.ts` | Motion template library |
| Create | `packages/agents/media/src/video-generation/video-generator.ts` | Main video generation |
| Create | `packages/agents/media/src/video-generation/index.ts` | Package exports |
| Create | `packages/agents/media/src/video-generation/__tests__/video-generator.test.ts` | Tests |

---

## Acceptance Criteria

- [ ] VideoGenerator creates videos from images
- [ ] 15+ motion templates available
- [ ] Slideshow with transitions supported
- [ ] Text overlay with animation
- [ ] Platform-specific optimization
- [ ] Quality encoding options
- [ ] Storage integration working
- [ ] Tests pass with >90% coverage

---

## JSON Task Block

```json
{
  "task_id": "S2-D3",
  "name": "Silent Video Generation",
  "status": "pending",
  "dependencies": ["S2-D1", "S2-D2"],
  "blocks": ["S2-D5"],
  "agent": "D",
  "sprint": 2,
  "complexity": "high",
  "estimated_files": 5,
  "tdd_required": true,
  "spec_refs": [
    "docs/03-agents-tools/agent-recursion-contracts.md",
    "docs/00-overview/PRD-v2/sprint-2/S2-B4-blueprints-1-6.md"
  ],
  "acceptance_checklist": [
    "image_to_video",
    "motion_templates",
    "slideshow_generation",
    "text_overlays",
    "platform_optimization",
    "encoding_options"
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
  "reads": [
    { "type": "generated_image", "scope": "asset" }
  ],
  "writes": [
    { "type": "generated_video", "scope": "asset" }
  ],
  "context_window_at_completion": null,
  "continuation_hint": "Videos feed into QA system in S2-D5, HeyGen voiceover added in Sprint 3"
}
```
