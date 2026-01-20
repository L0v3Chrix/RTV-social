# Build Prompt: S3-C4 — Stories Browser Connector

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S3-C4 |
| **Sprint** | 3 — Scheduling + Publishing |
| **Agent** | C — Browser Lane |
| **Task Name** | Stories Browser Connector |
| **Complexity** | Medium |
| **Status** | Pending |
| **Estimated Effort** | 1 day |
| **Dependencies** | S3-C1, S3-C2 |
| **Blocks** | S3-D1 |

---

## Context

### What We're Building

A browser automation connector for publishing Stories across platforms (Instagram, Facebook) where Stories API access is limited or requires special permissions.

### Why It Matters

Stories have high engagement but limited API support. Browser automation enables consistent Stories publishing across platforms that restrict programmatic Story creation.

### Spec References

- `docs/04-browser-lane/browser-automation-profile-vault.md` — Browser lane patterns
- `docs/09-platform-playbooks/instagram-strategy.md` — Stories best practices
- `docs/09-platform-playbooks/facebook-strategy.md` — FB Stories patterns

---

## Prerequisites

### Completed Tasks

- [x] S3-C1: Profile Vault
- [x] S3-C2: Browser Isolation

### Required Tools/Packages

```bash
pnpm add playwright
pnpm add -D vitest
```

---

## Instructions

### Phase 1: Test First (TDD)

#### 1.1 Create Stories Connector Test Suite

```typescript
// packages/browser-lane/src/connectors/stories/__tests__/stories-connector.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoriesConnector } from '../stories-connector';
import { StoriesConfig, StoryContent, StoryResult } from '../types';

vi.mock('../../../browser-isolation', () => ({
  getBrowserIsolation: vi.fn(() => ({
    createContext: vi.fn().mockResolvedValue({
      id: 'ctx-123',
      clientId: 'client-123',
      profileId: 'profile-456'
    }),
    createPage: vi.fn().mockResolvedValue({
      goto: vi.fn(),
      waitForSelector: vi.fn(),
      click: vi.fn(),
      setInputFiles: vi.fn(),
      evaluate: vi.fn(),
      screenshot: vi.fn(),
      close: vi.fn(),
      locator: vi.fn().mockReturnValue({
        click: vi.fn(),
        waitFor: vi.fn()
      })
    }),
    destroyContext: vi.fn()
  }))
}));

describe('StoriesConnector', () => {
  let connector: StoriesConnector;

  const testConfig: StoriesConfig = {
    clientId: 'client-123',
    profileId: 'profile-456',
    platform: 'instagram'
  };

  beforeEach(() => {
    connector = new StoriesConnector(testConfig);
  });

  afterEach(async () => {
    await connector.disconnect();
    vi.clearAllMocks();
  });

  describe('Instagram Stories', () => {
    it('should publish image story', async () => {
      const result = await connector.publishStory({
        type: 'image',
        media: Buffer.alloc(1000),
        filename: 'story.jpg'
      });

      expect(result.success).toBe(true);
      expect(result.storyId).toBeDefined();
    });

    it('should publish video story', async () => {
      const result = await connector.publishStory({
        type: 'video',
        media: Buffer.alloc(5000),
        filename: 'story.mp4',
        duration: 15
      });

      expect(result.success).toBe(true);
    });

    it('should add stickers to story', async () => {
      const result = await connector.publishStory({
        type: 'image',
        media: Buffer.alloc(1000),
        filename: 'story.jpg',
        stickers: [
          { type: 'poll', question: 'Yes or No?', options: ['Yes', 'No'], position: { x: 50, y: 50 } },
          { type: 'mention', username: '@testuser', position: { x: 30, y: 80 } }
        ]
      });

      expect(result.success).toBe(true);
    });

    it('should add link to story', async () => {
      const result = await connector.publishStory({
        type: 'image',
        media: Buffer.alloc(1000),
        filename: 'story.jpg',
        link: 'https://example.com/landing'
      });

      expect(result.success).toBe(true);
    });

    it('should handle story upload failure', async () => {
      const mockPage = {
        goto: vi.fn(),
        setInputFiles: vi.fn().mockRejectedValue(new Error('Upload failed'))
      };

      vi.mocked(connector as any).page = mockPage;

      const result = await connector.publishStory({
        type: 'image',
        media: Buffer.alloc(1000),
        filename: 'story.jpg'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Facebook Stories', () => {
    beforeEach(() => {
      connector = new StoriesConnector({
        ...testConfig,
        platform: 'facebook'
      });
    });

    it('should publish image story to Facebook', async () => {
      const result = await connector.publishStory({
        type: 'image',
        media: Buffer.alloc(1000),
        filename: 'story.jpg'
      });

      expect(result.success).toBe(true);
    });

    it('should publish video story to Facebook', async () => {
      const result = await connector.publishStory({
        type: 'video',
        media: Buffer.alloc(5000),
        filename: 'story.mp4',
        duration: 20
      });

      expect(result.success).toBe(true);
    });

    it('should add text overlay', async () => {
      const result = await connector.publishStory({
        type: 'image',
        media: Buffer.alloc(1000),
        filename: 'story.jpg',
        textOverlay: {
          text: 'Check this out!',
          position: { x: 50, y: 50 },
          style: 'modern'
        }
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Story scheduling', () => {
    it('should queue story for later publication', async () => {
      const scheduledTime = new Date(Date.now() + 3600000); // 1 hour from now

      const result = await connector.scheduleStory({
        content: {
          type: 'image',
          media: Buffer.alloc(1000),
          filename: 'story.jpg'
        },
        publishAt: scheduledTime
      });

      expect(result.success).toBe(true);
      expect(result.scheduledId).toBeDefined();
    });
  });

  describe('Story validation', () => {
    it('should reject video over 60 seconds', async () => {
      await expect(connector.publishStory({
        type: 'video',
        media: Buffer.alloc(5000),
        filename: 'story.mp4',
        duration: 90
      })).rejects.toThrow('Story video exceeds maximum duration');
    });

    it('should reject oversized media', async () => {
      await expect(connector.publishStory({
        type: 'image',
        media: Buffer.alloc(50 * 1024 * 1024), // 50MB
        filename: 'story.jpg'
      })).rejects.toThrow('Story media exceeds maximum size');
    });
  });

  describe('Multi-slide stories', () => {
    it('should publish multiple slides as story', async () => {
      const slides = [
        { type: 'image' as const, media: Buffer.alloc(1000), filename: 'slide1.jpg' },
        { type: 'image' as const, media: Buffer.alloc(1000), filename: 'slide2.jpg' },
        { type: 'video' as const, media: Buffer.alloc(2000), filename: 'slide3.mp4', duration: 10 }
      ];

      const result = await connector.publishMultiSlideStory(slides);

      expect(result.success).toBe(true);
      expect(result.slideCount).toBe(3);
    });

    it('should limit slides per story', async () => {
      const slides = Array(15).fill({
        type: 'image' as const,
        media: Buffer.alloc(1000),
        filename: 'slide.jpg'
      });

      await expect(connector.publishMultiSlideStory(slides))
        .rejects.toThrow('Maximum slides exceeded');
    });
  });

  describe('Story analytics', () => {
    it('should retrieve story views', async () => {
      const stats = await connector.getStoryStats('story-123');

      expect(stats.views).toBeDefined();
      expect(stats.replies).toBeDefined();
    });

    it('should retrieve story reach', async () => {
      const stats = await connector.getStoryStats('story-123');

      expect(stats.reach).toBeDefined();
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Create Stories Types

```typescript
// packages/browser-lane/src/connectors/stories/types.ts

import { z } from 'zod';

export const StoriesConfigSchema = z.object({
  clientId: z.string(),
  profileId: z.string(),
  platform: z.enum(['instagram', 'facebook'])
});

export type StoriesConfig = z.infer<typeof StoriesConfigSchema>;

export const StickerTypeSchema = z.enum([
  'poll',
  'quiz',
  'question',
  'countdown',
  'mention',
  'hashtag',
  'location',
  'link',
  'music'
]);

export type StickerType = z.infer<typeof StickerTypeSchema>;

export interface Position {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export interface Sticker {
  type: StickerType;
  position: Position;
  question?: string;
  options?: string[];
  username?: string;
  hashtag?: string;
  location?: string;
  url?: string;
}

export interface TextOverlay {
  text: string;
  position: Position;
  style?: 'classic' | 'modern' | 'neon' | 'typewriter' | 'strong';
  color?: string;
  backgroundColor?: string;
  fontSize?: 'small' | 'medium' | 'large';
}

export interface StoryContent {
  type: 'image' | 'video';
  media: Buffer;
  filename: string;
  duration?: number; // seconds for video
  stickers?: Sticker[];
  textOverlay?: TextOverlay;
  link?: string;
}

export interface StoryResult {
  success: boolean;
  storyId?: string;
  error?: string;
  screenshotPath?: string;
}

export interface MultiSlideResult {
  success: boolean;
  storyId?: string;
  slideCount?: number;
  error?: string;
}

export interface ScheduleStoryParams {
  content: StoryContent;
  publishAt: Date;
}

export interface ScheduleResult {
  success: boolean;
  scheduledId?: string;
  publishAt?: Date;
  error?: string;
}

export interface StoryStats {
  storyId: string;
  views: number;
  reach: number;
  replies: number;
  linkClicks?: number;
  stickerTaps?: number;
  expiresAt: Date;
}

export const STORY_CONSTRAINTS = {
  instagram: {
    maxImageSize: 30 * 1024 * 1024, // 30MB
    maxVideoSize: 250 * 1024 * 1024, // 250MB
    maxVideoDuration: 60, // seconds
    maxSlides: 10,
    aspectRatio: { width: 1080, height: 1920 },
    supportedFormats: ['jpg', 'jpeg', 'png', 'mp4', 'mov']
  },
  facebook: {
    maxImageSize: 30 * 1024 * 1024,
    maxVideoSize: 1024 * 1024 * 1024, // 1GB
    maxVideoDuration: 120,
    maxSlides: 10,
    aspectRatio: { width: 1080, height: 1920 },
    supportedFormats: ['jpg', 'jpeg', 'png', 'mp4', 'mov']
  }
} as const;

export const PLATFORM_SELECTORS = {
  instagram: {
    createStoryButton: '[aria-label="New post"]',
    storyOption: '[data-testid="story-option"]',
    fileInput: 'input[type="file"]',
    nextButton: '[aria-label="Next"]',
    shareButton: '[aria-label="Share"]',
    addStickerButton: '[aria-label="Stickers"]',
    addTextButton: '[aria-label="Text"]',
    addLinkButton: '[aria-label="Link"]'
  },
  facebook: {
    createStoryButton: '[aria-label="Create story"]',
    fileInput: 'input[type="file"]',
    addToStoryButton: '[aria-label="Add to Story"]',
    shareButton: '[aria-label="Share to Story"]',
    addStickerButton: '[aria-label="Add sticker"]',
    addTextButton: '[aria-label="Add text"]'
  }
} as const;
```

#### 2.2 Implement Stories Connector

```typescript
// packages/browser-lane/src/connectors/stories/stories-connector.ts

import { Page } from 'playwright';
import {
  StoriesConfig,
  StoriesConfigSchema,
  StoryContent,
  StoryResult,
  MultiSlideResult,
  ScheduleStoryParams,
  ScheduleResult,
  StoryStats,
  Sticker,
  TextOverlay,
  STORY_CONSTRAINTS,
  PLATFORM_SELECTORS
} from './types';
import { getBrowserIsolation, BrowserContext } from '../../browser-isolation';
import { logger } from '@rtv/observability';
import { generateId } from '@rtv/core';
import * as fs from 'fs/promises';
import * as path from 'path';

export class StoriesConnector {
  private readonly config: StoriesConfig;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly selectors: typeof PLATFORM_SELECTORS.instagram | typeof PLATFORM_SELECTORS.facebook;
  private readonly constraints: typeof STORY_CONSTRAINTS.instagram | typeof STORY_CONSTRAINTS.facebook;

  constructor(config: StoriesConfig) {
    this.config = StoriesConfigSchema.parse(config);
    this.selectors = PLATFORM_SELECTORS[config.platform];
    this.constraints = STORY_CONSTRAINTS[config.platform];
  }

  async connect(): Promise<void> {
    const isolation = getBrowserIsolation();

    this.context = await isolation.createContext({
      clientId: this.config.clientId,
      profileId: this.config.profileId
    });

    this.page = await isolation.createPage(this.context.id);

    // Navigate to platform
    const baseUrl = this.config.platform === 'instagram'
      ? 'https://www.instagram.com'
      : 'https://www.facebook.com';

    await this.page.goto(baseUrl);
    await this.page.waitForLoadState('networkidle');

    logger.info('StoriesConnector: Connected', {
      platform: this.config.platform,
      clientId: this.config.clientId
    });
  }

  async disconnect(): Promise<void> {
    if (this.context) {
      const isolation = getBrowserIsolation();
      await isolation.destroyContext(this.context.id, { saveSession: true });
      this.context = null;
      this.page = null;
    }
  }

  async publishStory(content: StoryContent): Promise<StoryResult> {
    await this.ensureConnected();
    await this.validateContent(content);

    try {
      // Create temp file for media
      const tempPath = await this.saveTempMedia(content);

      // Click create story
      await this.page!.click(this.selectors.createStoryButton);
      await this.humanDelay();

      // Select story option (Instagram)
      if (this.config.platform === 'instagram') {
        await this.page!.click(this.selectors.storyOption);
        await this.humanDelay();
      }

      // Upload media
      await this.page!.setInputFiles(this.selectors.fileInput, tempPath);
      await this.page!.waitForTimeout(3000); // Wait for upload

      // Add stickers if provided
      if (content.stickers?.length) {
        await this.addStickers(content.stickers);
      }

      // Add text overlay if provided
      if (content.textOverlay) {
        await this.addTextOverlay(content.textOverlay);
      }

      // Add link if provided
      if (content.link) {
        await this.addLink(content.link);
      }

      // Proceed to next/share
      if (this.config.platform === 'instagram') {
        await this.page!.click(this.selectors.nextButton);
        await this.humanDelay();
      }

      // Share story
      await this.page!.click(this.selectors.shareButton);
      await this.page!.waitForTimeout(5000); // Wait for publish

      // Cleanup temp file
      await fs.unlink(tempPath);

      const storyId = generateId('story');

      logger.info('StoriesConnector: Story published', {
        storyId,
        platform: this.config.platform,
        type: content.type
      });

      return {
        success: true,
        storyId
      };
    } catch (error) {
      const screenshotPath = await this.captureErrorScreenshot('story-failed');

      logger.error('StoriesConnector: Story publish failed', { error });

      return {
        success: false,
        error: (error as Error).message,
        screenshotPath
      };
    }
  }

  async publishMultiSlideStory(slides: StoryContent[]): Promise<MultiSlideResult> {
    if (slides.length > this.constraints.maxSlides) {
      throw new Error(`Maximum slides exceeded (max: ${this.constraints.maxSlides})`);
    }

    await this.ensureConnected();

    // Validate all slides
    for (const slide of slides) {
      await this.validateContent(slide);
    }

    try {
      // Upload first slide
      const firstResult = await this.publishStory(slides[0]);
      if (!firstResult.success) {
        return { success: false, error: firstResult.error };
      }

      // Add remaining slides
      for (let i = 1; i < slides.length; i++) {
        // Use "Add to story" functionality
        await this.page!.click('[aria-label="Add to your story"]');
        await this.humanDelay();

        const tempPath = await this.saveTempMedia(slides[i]);
        await this.page!.setInputFiles(this.selectors.fileInput, tempPath);
        await this.page!.waitForTimeout(3000);

        if (slides[i].stickers?.length) {
          await this.addStickers(slides[i].stickers!);
        }

        await this.page!.click(this.selectors.shareButton);
        await this.page!.waitForTimeout(3000);

        await fs.unlink(tempPath);
      }

      return {
        success: true,
        storyId: firstResult.storyId,
        slideCount: slides.length
      };
    } catch (error) {
      await this.captureErrorScreenshot('multi-slide-failed');

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async scheduleStory(params: ScheduleStoryParams): Promise<ScheduleResult> {
    // Note: Stories scheduling is limited - most platforms don't support native scheduling
    // We'll store the content and publish at scheduled time via job queue

    await this.validateContent(params.content);

    const scheduledId = generateId('scheduled-story');

    // Store scheduled story metadata
    // In real implementation, this would queue a job in BullMQ

    logger.info('StoriesConnector: Story scheduled', {
      scheduledId,
      publishAt: params.publishAt
    });

    return {
      success: true,
      scheduledId,
      publishAt: params.publishAt
    };
  }

  async getStoryStats(storyId: string): Promise<StoryStats> {
    await this.ensureConnected();

    // Navigate to story insights
    // Note: This requires Business/Creator account

    // For now, return placeholder stats
    return {
      storyId,
      views: 0,
      reach: 0,
      replies: 0,
      linkClicks: 0,
      stickerTaps: 0,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
  }

  private async validateContent(content: StoryContent): Promise<void> {
    // Check media size
    const maxSize = content.type === 'video'
      ? this.constraints.maxVideoSize
      : this.constraints.maxImageSize;

    if (content.media.length > maxSize) {
      throw new Error(`Story media exceeds maximum size (${maxSize / (1024 * 1024)}MB)`);
    }

    // Check video duration
    if (content.type === 'video' && content.duration) {
      if (content.duration > this.constraints.maxVideoDuration) {
        throw new Error(
          `Story video exceeds maximum duration (${this.constraints.maxVideoDuration}s)`
        );
      }
    }

    // Check format
    const ext = content.filename.split('.').pop()?.toLowerCase();
    if (!this.constraints.supportedFormats.includes(ext || '')) {
      throw new Error(`Unsupported format: ${ext}`);
    }
  }

  private async addStickers(stickers: Sticker[]): Promise<void> {
    await this.page!.click(this.selectors.addStickerButton);
    await this.humanDelay();

    for (const sticker of stickers) {
      switch (sticker.type) {
        case 'poll':
          await this.addPollSticker(sticker);
          break;
        case 'mention':
          await this.addMentionSticker(sticker);
          break;
        case 'hashtag':
          await this.addHashtagSticker(sticker);
          break;
        case 'question':
          await this.addQuestionSticker(sticker);
          break;
        // Add more sticker types as needed
      }
    }
  }

  private async addPollSticker(sticker: Sticker): Promise<void> {
    await this.page!.click('[data-testid="poll-sticker"]');
    await this.humanDelay();

    if (sticker.question) {
      await this.page!.fill('[data-testid="poll-question"]', sticker.question);
    }

    if (sticker.options) {
      for (let i = 0; i < sticker.options.length; i++) {
        await this.page!.fill(`[data-testid="poll-option-${i}"]`, sticker.options[i]);
      }
    }

    // Position sticker
    await this.positionElement('[data-testid="poll-sticker-element"]', sticker.position);
  }

  private async addMentionSticker(sticker: Sticker): Promise<void> {
    await this.page!.click('[data-testid="mention-sticker"]');
    await this.humanDelay();

    if (sticker.username) {
      await this.page!.fill('[data-testid="mention-input"]', sticker.username);
      await this.page!.click('[data-testid="mention-suggestion"]');
    }
  }

  private async addHashtagSticker(sticker: Sticker): Promise<void> {
    await this.page!.click('[data-testid="hashtag-sticker"]');
    await this.humanDelay();

    if (sticker.hashtag) {
      await this.page!.fill('[data-testid="hashtag-input"]', sticker.hashtag);
    }
  }

  private async addQuestionSticker(sticker: Sticker): Promise<void> {
    await this.page!.click('[data-testid="question-sticker"]');
    await this.humanDelay();

    if (sticker.question) {
      await this.page!.fill('[data-testid="question-prompt"]', sticker.question);
    }
  }

  private async addTextOverlay(overlay: TextOverlay): Promise<void> {
    await this.page!.click(this.selectors.addTextButton);
    await this.humanDelay();

    await this.page!.fill('[data-testid="text-input"]', overlay.text);

    // Apply style if specified
    if (overlay.style) {
      await this.page!.click(`[data-testid="text-style-${overlay.style}"]`);
    }

    // Apply color if specified
    if (overlay.color) {
      await this.page!.click('[data-testid="text-color-picker"]');
      await this.page!.fill('[data-testid="color-input"]', overlay.color);
    }

    // Position text
    await this.positionElement('[data-testid="text-element"]', overlay.position);

    // Confirm text
    await this.page!.click('[data-testid="done-text"]');
  }

  private async addLink(url: string): Promise<void> {
    if (this.config.platform === 'instagram') {
      await this.page!.click(this.selectors.addLinkButton);
      await this.humanDelay();
      await this.page!.fill('[data-testid="link-input"]', url);
      await this.page!.click('[data-testid="done-link"]');
    }
    // Facebook Stories handle links differently
  }

  private async positionElement(selector: string, position: { x: number; y: number }): Promise<void> {
    // Get viewport dimensions
    const viewport = this.page!.viewportSize() || { width: 1080, height: 1920 };

    // Calculate pixel positions from percentages
    const x = (position.x / 100) * viewport.width;
    const y = (position.y / 100) * viewport.height;

    // Drag element to position
    const element = this.page!.locator(selector);
    await element.dragTo(this.page!.locator('body'), {
      targetPosition: { x, y }
    });
  }

  private async saveTempMedia(content: StoryContent): Promise<string> {
    const tempDir = '/tmp/story-uploads';
    await fs.mkdir(tempDir, { recursive: true });

    const tempPath = path.join(tempDir, `${Date.now()}-${content.filename}`);
    await fs.writeFile(tempPath, content.media);

    return tempPath;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.page) {
      await this.connect();
    }
  }

  private async humanDelay(): Promise<void> {
    const delay = 500 + Math.random() * 1000;
    await this.page!.waitForTimeout(delay);
  }

  private async captureErrorScreenshot(prefix: string): Promise<string> {
    const timestamp = Date.now();
    const filename = `${prefix}-${this.config.platform}-${timestamp}.png`;
    const screenshotPath = path.join('/tmp/story-errors', filename);

    await fs.mkdir('/tmp/story-errors', { recursive: true });
    await this.page!.screenshot({ path: screenshotPath, fullPage: true });

    return screenshotPath;
  }
}
```

#### 2.3 Create Factory and Export

```typescript
// packages/browser-lane/src/connectors/stories/index.ts

export * from './types';
export * from './stories-connector';

import { StoriesConnector } from './stories-connector';
import { StoriesConfig } from './types';

export function createStoriesConnector(config: StoriesConfig): StoriesConnector {
  return new StoriesConnector(config);
}
```

### Phase 3: Verification

```bash
cd packages/browser-lane
pnpm test src/connectors/stories --reporter=verbose --coverage
pnpm typecheck
pnpm lint src/connectors/stories
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/browser-lane/src/connectors/stories/types.ts` | Stories types |
| Create | `packages/browser-lane/src/connectors/stories/stories-connector.ts` | Main implementation |
| Create | `packages/browser-lane/src/connectors/stories/index.ts` | Public exports |
| Create | `packages/browser-lane/src/connectors/stories/__tests__/stories-connector.test.ts` | Unit tests |

---

## Acceptance Criteria

- [ ] Image story publishing works
- [ ] Video story publishing works
- [ ] Sticker addition works
- [ ] Text overlay works
- [ ] Link addition works (Instagram)
- [ ] Multi-slide stories work
- [ ] Content validation works
- [ ] Error screenshots captured
- [ ] Unit test coverage exceeds 80%

---

## JSON Task Block

```json
{
  "task_id": "S3-C4",
  "name": "Stories Browser Connector",
  "status": "pending",
  "dependencies": ["S3-C1", "S3-C2"],
  "blocks": ["S3-D1"],
  "agent": "C",
  "sprint": 3,
  "complexity": "medium",
  "package": "@rtv/browser-lane",
  "files": [
    "packages/browser-lane/src/connectors/stories/types.ts",
    "packages/browser-lane/src/connectors/stories/stories-connector.ts",
    "packages/browser-lane/src/connectors/stories/index.ts"
  ],
  "test_files": [
    "packages/browser-lane/src/connectors/stories/__tests__/stories-connector.test.ts"
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
      path: docs/09-platform-playbooks/instagram-strategy.md
      sections: ["stories"]
    - type: spec
      path: docs/09-platform-playbooks/facebook-strategy.md
      sections: ["stories"]
  summaries_to_create:
    - topic: "Stories browser automation"
      scope: "stickers, overlays, multi-slide"
  decisions_made: []
  blockers: []
  handoff_notes: null
```
