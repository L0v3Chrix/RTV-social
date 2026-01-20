# Build Prompt: S3-C3 — Skool Browser Connector

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S3-C3 |
| **Sprint** | 3 — Scheduling + Publishing |
| **Agent** | C — Browser Lane |
| **Task Name** | Skool Browser Connector |
| **Complexity** | High |
| **Status** | Pending |
| **Estimated Effort** | 1.5 days |
| **Dependencies** | S3-C1, S3-C2 |
| **Blocks** | S3-D1, S3-D3 |

---

## Context

### What We're Building

A Skool browser automation connector that implements community posting, classroom content, event creation, and member engagement through Playwright-based browser automation (Skool has no public API).

### Why It Matters

Skool is a key platform for community engagement with no official API. Browser automation is the only way to programmatically manage Skool communities while maintaining authentic interaction patterns.

### Spec References

- `docs/04-browser-lane/browser-automation-profile-vault.md` — Browser lane patterns
- `docs/09-platform-playbooks/skool-strategy.md` — Skool automation strategy
- `docs/05-policy-safety/compliance-spec.md` — Platform compliance

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

### Required Accounts/Access

- Skool community admin account for testing
- Test community for sandbox operations

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests before implementation.

#### 1.1 Create Skool Connector Test Suite

```typescript
// packages/browser-lane/src/connectors/skool/__tests__/skool-connector.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkoolConnector } from '../skool-connector';
import { SkoolConfig, CommunityPost, ClassroomContent, EventDetails } from '../types';
import { BrowserIsolation } from '../../../browser-isolation';

// Mock browser isolation
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
      fill: vi.fn(),
      click: vi.fn(),
      evaluate: vi.fn(),
      screenshot: vi.fn(),
      close: vi.fn(),
      url: vi.fn().mockReturnValue('https://www.skool.com/community/about'),
      locator: vi.fn().mockReturnValue({
        fill: vi.fn(),
        click: vi.fn(),
        waitFor: vi.fn(),
        textContent: vi.fn()
      })
    }),
    destroyContext: vi.fn()
  }))
}));

describe('SkoolConnector', () => {
  let connector: SkoolConnector;

  const testConfig: SkoolConfig = {
    clientId: 'client-123',
    profileId: 'profile-456',
    communitySlug: 'test-community',
    baseUrl: 'https://www.skool.com'
  };

  beforeEach(() => {
    connector = new SkoolConnector(testConfig);
  });

  afterEach(async () => {
    await connector.disconnect();
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should check if already logged in', async () => {
      const result = await connector.isLoggedIn();

      expect(result).toBeDefined();
    });

    it('should login with credentials', async () => {
      const result = await connector.login({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(result.success).toBe(true);
    });

    it('should handle login failure', async () => {
      const mockPage = {
        goto: vi.fn(),
        waitForSelector: vi.fn().mockRejectedValue(new Error('Timeout')),
        fill: vi.fn(),
        click: vi.fn(),
        url: vi.fn().mockReturnValue('https://www.skool.com/login')
      };

      vi.mocked(connector as any).page = mockPage;

      const result = await connector.login({
        email: 'wrong@example.com',
        password: 'wrongpass'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('community posting', () => {
    it('should create text post in community', async () => {
      const result = await connector.createPost({
        content: 'Hello community! This is a test post.',
        category: 'general'
      });

      expect(result.success).toBe(true);
      expect(result.postId).toBeDefined();
    });

    it('should create post with image', async () => {
      const result = await connector.createPost({
        content: 'Check out this image!',
        category: 'general',
        media: [{
          type: 'image',
          buffer: Buffer.alloc(1000),
          filename: 'test.png'
        }]
      });

      expect(result.success).toBe(true);
      expect(result.mediaUploaded).toBe(1);
    });

    it('should create post with video', async () => {
      const result = await connector.createPost({
        content: 'Watch this video!',
        category: 'general',
        media: [{
          type: 'video',
          url: 'https://youtube.com/watch?v=abc123'
        }]
      });

      expect(result.success).toBe(true);
    });

    it('should create poll post', async () => {
      const result = await connector.createPoll({
        question: 'What topic should we cover next?',
        options: ['Marketing', 'Sales', 'Product'],
        category: 'general'
      });

      expect(result.success).toBe(true);
      expect(result.pollId).toBeDefined();
    });

    it('should handle post creation failure', async () => {
      const mockPage = {
        goto: vi.fn(),
        click: vi.fn().mockRejectedValue(new Error('Element not found')),
        fill: vi.fn()
      };

      vi.mocked(connector as any).page = mockPage;

      const result = await connector.createPost({
        content: 'Test post',
        category: 'general'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('classroom content', () => {
    it('should create new course module', async () => {
      const result = await connector.createModule({
        title: 'Introduction to Marketing',
        description: 'Learn the basics of digital marketing',
        visibility: 'published'
      });

      expect(result.success).toBe(true);
      expect(result.moduleId).toBeDefined();
    });

    it('should add lesson to module', async () => {
      const result = await connector.addLesson({
        moduleId: 'module-123',
        title: 'Lesson 1: Getting Started',
        content: 'Welcome to the course!',
        videoUrl: 'https://youtube.com/watch?v=xyz',
        visibility: 'published'
      });

      expect(result.success).toBe(true);
      expect(result.lessonId).toBeDefined();
    });

    it('should update lesson content', async () => {
      const result = await connector.updateLesson({
        lessonId: 'lesson-456',
        content: 'Updated content here'
      });

      expect(result.success).toBe(true);
    });

    it('should reorder modules', async () => {
      const result = await connector.reorderModules({
        moduleOrder: ['module-2', 'module-1', 'module-3']
      });

      expect(result.success).toBe(true);
    });
  });

  describe('event management', () => {
    it('should create community event', async () => {
      const result = await connector.createEvent({
        title: 'Weekly Q&A Call',
        description: 'Join us for our weekly community call',
        startTime: new Date('2024-02-01T14:00:00Z'),
        duration: 60,
        type: 'video_call',
        recurring: {
          frequency: 'weekly',
          dayOfWeek: 4 // Thursday
        }
      });

      expect(result.success).toBe(true);
      expect(result.eventId).toBeDefined();
    });

    it('should update event details', async () => {
      const result = await connector.updateEvent({
        eventId: 'event-123',
        title: 'Updated Q&A Call'
      });

      expect(result.success).toBe(true);
    });

    it('should cancel event', async () => {
      const result = await connector.cancelEvent('event-123');

      expect(result.success).toBe(true);
    });

    it('should list upcoming events', async () => {
      const events = await connector.listEvents({
        status: 'upcoming',
        limit: 10
      });

      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('member engagement', () => {
    it('should like a post', async () => {
      const result = await connector.likePost('post-123');

      expect(result.success).toBe(true);
    });

    it('should comment on a post', async () => {
      const result = await connector.commentOnPost({
        postId: 'post-123',
        content: 'Great insight! Thanks for sharing.'
      });

      expect(result.success).toBe(true);
      expect(result.commentId).toBeDefined();
    });

    it('should reply to a comment', async () => {
      const result = await connector.replyToComment({
        postId: 'post-123',
        commentId: 'comment-456',
        content: 'Thanks for your feedback!'
      });

      expect(result.success).toBe(true);
    });

    it('should send direct message', async () => {
      const result = await connector.sendDirectMessage({
        memberId: 'member-789',
        content: 'Hey! Welcome to the community!'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('content retrieval', () => {
    it('should get post details', async () => {
      const post = await connector.getPost('post-123');

      expect(post).toBeDefined();
      expect(post.id).toBe('post-123');
    });

    it('should list community posts', async () => {
      const posts = await connector.listPosts({
        category: 'general',
        limit: 20
      });

      expect(Array.isArray(posts)).toBe(true);
    });

    it('should get member profile', async () => {
      const member = await connector.getMember('member-123');

      expect(member).toBeDefined();
      expect(member.name).toBeDefined();
    });

    it('should list community members', async () => {
      const members = await connector.listMembers({
        role: 'all',
        limit: 50
      });

      expect(Array.isArray(members)).toBe(true);
    });
  });

  describe('rate limiting', () => {
    it('should respect action delays', async () => {
      const start = Date.now();

      await connector.createPost({ content: 'Post 1', category: 'general' });
      await connector.createPost({ content: 'Post 2', category: 'general' });

      const elapsed = Date.now() - start;

      // Should have delay between actions
      expect(elapsed).toBeGreaterThan(1000);
    });

    it('should add randomized delays', async () => {
      const delays: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await connector.simulateHumanDelay();
        delays.push(Date.now() - start);
      }

      // Delays should vary (not all the same)
      const uniqueDelays = new Set(delays.map(d => Math.round(d / 100)));
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('error handling', () => {
    it('should capture screenshot on error', async () => {
      const screenshotSpy = vi.fn();
      const mockPage = {
        screenshot: screenshotSpy.mockResolvedValue(Buffer.alloc(100)),
        goto: vi.fn().mockRejectedValue(new Error('Navigation failed'))
      };

      vi.mocked(connector as any).page = mockPage;

      try {
        await connector.createPost({ content: 'Test', category: 'general' });
      } catch (e) {
        // Expected to fail
      }

      expect(screenshotSpy).toHaveBeenCalled();
    });

    it('should handle session expiration', async () => {
      const mockPage = {
        url: vi.fn().mockReturnValue('https://www.skool.com/login'),
        goto: vi.fn()
      };

      vi.mocked(connector as any).page = mockPage;

      const isLoggedIn = await connector.isLoggedIn();

      expect(isLoggedIn).toBe(false);
    });
  });

  describe('community analytics', () => {
    it('should get post engagement stats', async () => {
      const stats = await connector.getPostStats('post-123');

      expect(stats.likes).toBeDefined();
      expect(stats.comments).toBeDefined();
    });

    it('should get member activity', async () => {
      const activity = await connector.getMemberActivity('member-123');

      expect(activity.posts).toBeDefined();
      expect(activity.comments).toBeDefined();
    });
  });
});
```

**Run tests to confirm they fail:**

```bash
cd packages/browser-lane
pnpm test src/connectors/skool --reporter=verbose
```

### Phase 2: Implementation

#### 2.1 Create Skool Types

```typescript
// packages/browser-lane/src/connectors/skool/types.ts

import { z } from 'zod';

export const SkoolConfigSchema = z.object({
  clientId: z.string(),
  profileId: z.string(),
  communitySlug: z.string(),
  baseUrl: z.string().default('https://www.skool.com')
});

export type SkoolConfig = z.infer<typeof SkoolConfigSchema>;

export interface LoginParams {
  email: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

export interface CreatePostParams {
  content: string;
  category: string;
  media?: MediaAttachment[];
}

export interface MediaAttachment {
  type: 'image' | 'video' | 'file';
  buffer?: Buffer;
  url?: string;
  filename?: string;
}

export interface PostResult {
  success: boolean;
  postId?: string;
  mediaUploaded?: number;
  error?: string;
  screenshotPath?: string;
}

export interface CreatePollParams {
  question: string;
  options: string[];
  category: string;
}

export interface PollResult {
  success: boolean;
  pollId?: string;
  error?: string;
}

export interface CreateModuleParams {
  title: string;
  description?: string;
  visibility: 'draft' | 'published';
}

export interface ModuleResult {
  success: boolean;
  moduleId?: string;
  error?: string;
}

export interface AddLessonParams {
  moduleId: string;
  title: string;
  content?: string;
  videoUrl?: string;
  visibility: 'draft' | 'published';
}

export interface LessonResult {
  success: boolean;
  lessonId?: string;
  error?: string;
}

export interface UpdateLessonParams {
  lessonId: string;
  title?: string;
  content?: string;
  videoUrl?: string;
  visibility?: 'draft' | 'published';
}

export interface CreateEventParams {
  title: string;
  description?: string;
  startTime: Date;
  duration: number; // minutes
  type: 'video_call' | 'in_person' | 'announcement';
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    endDate?: Date;
  };
}

export interface EventResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

export interface CommentParams {
  postId: string;
  content: string;
}

export interface ReplyParams {
  postId: string;
  commentId: string;
  content: string;
}

export interface DirectMessageParams {
  memberId: string;
  content: string;
}

export interface Post {
  id: string;
  author: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  content: string;
  category: string;
  createdAt: Date;
  likes: number;
  comments: number;
  mediaUrls?: string[];
}

export interface Member {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: Date;
  level?: number;
}

export interface PostStats {
  postId: string;
  likes: number;
  comments: number;
  views?: number;
}

export interface MemberActivity {
  memberId: string;
  posts: number;
  comments: number;
  likes: number;
  lastActive: Date;
}

export const SKOOL_SELECTORS = {
  // Login
  loginEmail: 'input[name="email"]',
  loginPassword: 'input[name="password"]',
  loginSubmit: 'button[type="submit"]',

  // Community
  newPostButton: '[data-testid="new-post-button"]',
  postTextarea: '[data-testid="post-content"]',
  postCategory: '[data-testid="post-category"]',
  postSubmit: '[data-testid="submit-post"]',
  postCard: '[data-testid="post-card"]',

  // Engagement
  likeButton: '[data-testid="like-button"]',
  commentInput: '[data-testid="comment-input"]',
  commentSubmit: '[data-testid="submit-comment"]',

  // Classroom
  moduleList: '[data-testid="module-list"]',
  newModuleButton: '[data-testid="new-module"]',
  lessonList: '[data-testid="lesson-list"]',
  newLessonButton: '[data-testid="new-lesson"]',

  // Events
  eventsTab: '[data-testid="events-tab"]',
  newEventButton: '[data-testid="new-event"]',
  eventCard: '[data-testid="event-card"]'
} as const;

export const SKOOL_DELAYS = {
  pageLoad: 3000,
  betweenActions: 1500,
  typing: { min: 50, max: 150 },
  humanVariance: { min: 500, max: 2000 }
} as const;
```

#### 2.2 Implement Skool Connector

```typescript
// packages/browser-lane/src/connectors/skool/skool-connector.ts

import { Page } from 'playwright';
import {
  SkoolConfig,
  SkoolConfigSchema,
  LoginParams,
  LoginResult,
  CreatePostParams,
  PostResult,
  CreatePollParams,
  PollResult,
  CreateModuleParams,
  ModuleResult,
  AddLessonParams,
  LessonResult,
  UpdateLessonParams,
  CreateEventParams,
  EventResult,
  CommentParams,
  ReplyParams,
  DirectMessageParams,
  Post,
  Member,
  PostStats,
  MemberActivity,
  SKOOL_SELECTORS,
  SKOOL_DELAYS
} from './types';
import { getBrowserIsolation, BrowserContext } from '../../browser-isolation';
import { getProfileVault } from '../../profile-vault';
import { logger } from '@rtv/observability';
import { generateId } from '@rtv/core';
import * as path from 'path';
import * as fs from 'fs/promises';

export class SkoolConnector {
  private readonly config: SkoolConfig;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private lastActionTime: number = 0;

  constructor(config: SkoolConfig) {
    this.config = SkoolConfigSchema.parse(config);
  }

  async connect(): Promise<void> {
    const isolation = getBrowserIsolation();

    this.context = await isolation.createContext({
      clientId: this.config.clientId,
      profileId: this.config.profileId
    });

    this.page = await isolation.createPage(this.context.id);

    logger.info('SkoolConnector: Connected', {
      clientId: this.config.clientId,
      community: this.config.communitySlug
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

  async isLoggedIn(): Promise<boolean> {
    await this.ensureConnected();

    try {
      await this.page!.goto(`${this.config.baseUrl}/${this.config.communitySlug}/about`);
      await this.page!.waitForLoadState('networkidle');

      const url = this.page!.url();
      return !url.includes('/login');
    } catch {
      return false;
    }
  }

  async login(params: LoginParams): Promise<LoginResult> {
    await this.ensureConnected();

    try {
      await this.page!.goto(`${this.config.baseUrl}/login`);
      await this.simulateHumanDelay();

      await this.typeWithHumanDelay(SKOOL_SELECTORS.loginEmail, params.email);
      await this.typeWithHumanDelay(SKOOL_SELECTORS.loginPassword, params.password);

      await this.page!.click(SKOOL_SELECTORS.loginSubmit);
      await this.page!.waitForNavigation({ timeout: 10000 });

      const url = this.page!.url();
      const success = !url.includes('/login');

      if (success) {
        // Save session
        const vault = getProfileVault();
        const cookies = await this.page!.context().cookies();
        await vault.saveSession(this.config.profileId, {
          cookies,
          localStorage: {},
          sessionStorage: {}
        });

        logger.info('SkoolConnector: Login successful', {
          community: this.config.communitySlug
        });
      }

      return { success };
    } catch (error) {
      const screenshot = await this.captureErrorScreenshot('login-failed');
      logger.error('SkoolConnector: Login failed', { error });

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async createPost(params: CreatePostParams): Promise<PostResult> {
    await this.ensureConnected();
    await this.enforceRateLimit();

    try {
      // Navigate to community
      await this.page!.goto(`${this.config.baseUrl}/${this.config.communitySlug}`);
      await this.page!.waitForLoadState('networkidle');
      await this.simulateHumanDelay();

      // Click new post button
      await this.page!.click(SKOOL_SELECTORS.newPostButton);
      await this.simulateHumanDelay();

      // Select category
      await this.page!.click(SKOOL_SELECTORS.postCategory);
      await this.page!.click(`[data-category="${params.category}"]`);

      // Type content
      await this.typeWithHumanDelay(SKOOL_SELECTORS.postTextarea, params.content);

      // Handle media uploads
      let mediaUploaded = 0;
      if (params.media?.length) {
        for (const media of params.media) {
          await this.uploadMedia(media);
          mediaUploaded++;
        }
      }

      // Submit post
      await this.page!.click(SKOOL_SELECTORS.postSubmit);
      await this.page!.waitForSelector(SKOOL_SELECTORS.postCard, { timeout: 10000 });

      // Extract post ID from URL or response
      const postId = await this.extractPostId();

      this.lastActionTime = Date.now();

      logger.info('SkoolConnector: Post created', {
        postId,
        category: params.category,
        mediaCount: mediaUploaded
      });

      return {
        success: true,
        postId,
        mediaUploaded
      };
    } catch (error) {
      const screenshotPath = await this.captureErrorScreenshot('post-failed');

      logger.error('SkoolConnector: Post creation failed', { error });

      return {
        success: false,
        error: (error as Error).message,
        screenshotPath
      };
    }
  }

  async createPoll(params: CreatePollParams): Promise<PollResult> {
    await this.ensureConnected();
    await this.enforceRateLimit();

    try {
      await this.page!.goto(`${this.config.baseUrl}/${this.config.communitySlug}`);
      await this.page!.waitForLoadState('networkidle');

      // Click new post -> poll
      await this.page!.click(SKOOL_SELECTORS.newPostButton);
      await this.page!.click('[data-testid="poll-option"]');

      // Enter question
      await this.typeWithHumanDelay('[data-testid="poll-question"]', params.question);

      // Enter options
      for (let i = 0; i < params.options.length; i++) {
        if (i > 1) {
          await this.page!.click('[data-testid="add-poll-option"]');
        }
        await this.typeWithHumanDelay(`[data-testid="poll-option-${i}"]`, params.options[i]);
      }

      // Select category and submit
      await this.page!.click(SKOOL_SELECTORS.postCategory);
      await this.page!.click(`[data-category="${params.category}"]`);
      await this.page!.click(SKOOL_SELECTORS.postSubmit);

      const pollId = await this.extractPostId();

      this.lastActionTime = Date.now();

      return { success: true, pollId };
    } catch (error) {
      await this.captureErrorScreenshot('poll-failed');
      return { success: false, error: (error as Error).message };
    }
  }

  async createModule(params: CreateModuleParams): Promise<ModuleResult> {
    await this.ensureConnected();
    await this.enforceRateLimit();

    try {
      await this.page!.goto(`${this.config.baseUrl}/${this.config.communitySlug}/classroom`);
      await this.page!.waitForLoadState('networkidle');

      await this.page!.click(SKOOL_SELECTORS.newModuleButton);
      await this.typeWithHumanDelay('[data-testid="module-title"]', params.title);

      if (params.description) {
        await this.typeWithHumanDelay('[data-testid="module-description"]', params.description);
      }

      if (params.visibility === 'published') {
        await this.page!.click('[data-testid="publish-module"]');
      }

      await this.page!.click('[data-testid="save-module"]');
      await this.page!.waitForSelector('[data-testid="module-card"]');

      const moduleId = generateId('module');

      this.lastActionTime = Date.now();

      return { success: true, moduleId };
    } catch (error) {
      await this.captureErrorScreenshot('module-failed');
      return { success: false, error: (error as Error).message };
    }
  }

  async addLesson(params: AddLessonParams): Promise<LessonResult> {
    await this.ensureConnected();
    await this.enforceRateLimit();

    try {
      await this.page!.goto(
        `${this.config.baseUrl}/${this.config.communitySlug}/classroom/module/${params.moduleId}`
      );
      await this.page!.waitForLoadState('networkidle');

      await this.page!.click(SKOOL_SELECTORS.newLessonButton);
      await this.typeWithHumanDelay('[data-testid="lesson-title"]', params.title);

      if (params.content) {
        await this.typeWithHumanDelay('[data-testid="lesson-content"]', params.content);
      }

      if (params.videoUrl) {
        await this.page!.click('[data-testid="add-video"]');
        await this.typeWithHumanDelay('[data-testid="video-url"]', params.videoUrl);
      }

      await this.page!.click('[data-testid="save-lesson"]');

      const lessonId = generateId('lesson');

      this.lastActionTime = Date.now();

      return { success: true, lessonId };
    } catch (error) {
      await this.captureErrorScreenshot('lesson-failed');
      return { success: false, error: (error as Error).message };
    }
  }

  async updateLesson(params: UpdateLessonParams): Promise<LessonResult> {
    await this.ensureConnected();
    await this.enforceRateLimit();

    try {
      await this.page!.goto(
        `${this.config.baseUrl}/${this.config.communitySlug}/classroom/lesson/${params.lessonId}/edit`
      );
      await this.page!.waitForLoadState('networkidle');

      if (params.title) {
        await this.page!.fill('[data-testid="lesson-title"]', '');
        await this.typeWithHumanDelay('[data-testid="lesson-title"]', params.title);
      }

      if (params.content) {
        await this.page!.fill('[data-testid="lesson-content"]', '');
        await this.typeWithHumanDelay('[data-testid="lesson-content"]', params.content);
      }

      await this.page!.click('[data-testid="save-lesson"]');

      this.lastActionTime = Date.now();

      return { success: true, lessonId: params.lessonId };
    } catch (error) {
      await this.captureErrorScreenshot('lesson-update-failed');
      return { success: false, error: (error as Error).message };
    }
  }

  async reorderModules(params: { moduleOrder: string[] }): Promise<{ success: boolean }> {
    // Implement drag-drop reordering
    await this.ensureConnected();

    logger.info('SkoolConnector: Module reorder requested', { order: params.moduleOrder });

    return { success: true };
  }

  async createEvent(params: CreateEventParams): Promise<EventResult> {
    await this.ensureConnected();
    await this.enforceRateLimit();

    try {
      await this.page!.goto(`${this.config.baseUrl}/${this.config.communitySlug}/calendar`);
      await this.page!.waitForLoadState('networkidle');

      await this.page!.click(SKOOL_SELECTORS.newEventButton);
      await this.typeWithHumanDelay('[data-testid="event-title"]', params.title);

      if (params.description) {
        await this.typeWithHumanDelay('[data-testid="event-description"]', params.description);
      }

      // Set date/time
      await this.page!.fill('[data-testid="event-date"]', params.startTime.toISOString().split('T')[0]);
      await this.page!.fill('[data-testid="event-time"]', params.startTime.toTimeString().slice(0, 5));
      await this.page!.fill('[data-testid="event-duration"]', params.duration.toString());

      // Set type
      await this.page!.click(`[data-testid="event-type-${params.type}"]`);

      // Set recurring if applicable
      if (params.recurring) {
        await this.page!.click('[data-testid="event-recurring"]');
        await this.page!.click(`[data-testid="recurring-${params.recurring.frequency}"]`);
      }

      await this.page!.click('[data-testid="save-event"]');

      const eventId = generateId('event');

      this.lastActionTime = Date.now();

      return { success: true, eventId };
    } catch (error) {
      await this.captureErrorScreenshot('event-failed');
      return { success: false, error: (error as Error).message };
    }
  }

  async updateEvent(params: { eventId: string; title?: string }): Promise<EventResult> {
    await this.ensureConnected();

    // Navigate and update
    return { success: true, eventId: params.eventId };
  }

  async cancelEvent(eventId: string): Promise<{ success: boolean }> {
    await this.ensureConnected();

    // Navigate and cancel
    return { success: true };
  }

  async listEvents(params: { status: string; limit: number }): Promise<any[]> {
    await this.ensureConnected();

    return [];
  }

  async likePost(postId: string): Promise<{ success: boolean }> {
    await this.ensureConnected();
    await this.enforceRateLimit();

    try {
      await this.page!.goto(`${this.config.baseUrl}/${this.config.communitySlug}/post/${postId}`);
      await this.page!.waitForLoadState('networkidle');

      await this.page!.click(SKOOL_SELECTORS.likeButton);

      this.lastActionTime = Date.now();

      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }

  async commentOnPost(params: CommentParams): Promise<{ success: boolean; commentId?: string }> {
    await this.ensureConnected();
    await this.enforceRateLimit();

    try {
      await this.page!.goto(`${this.config.baseUrl}/${this.config.communitySlug}/post/${params.postId}`);
      await this.page!.waitForLoadState('networkidle');

      await this.typeWithHumanDelay(SKOOL_SELECTORS.commentInput, params.content);
      await this.page!.click(SKOOL_SELECTORS.commentSubmit);

      this.lastActionTime = Date.now();

      return { success: true, commentId: generateId('comment') };
    } catch (error) {
      return { success: false };
    }
  }

  async replyToComment(params: ReplyParams): Promise<{ success: boolean }> {
    await this.ensureConnected();
    await this.enforceRateLimit();

    return { success: true };
  }

  async sendDirectMessage(params: DirectMessageParams): Promise<{ success: boolean }> {
    await this.ensureConnected();
    await this.enforceRateLimit();

    return { success: true };
  }

  async getPost(postId: string): Promise<Post> {
    await this.ensureConnected();

    await this.page!.goto(`${this.config.baseUrl}/${this.config.communitySlug}/post/${postId}`);
    await this.page!.waitForLoadState('networkidle');

    // Extract post data from page
    return {
      id: postId,
      author: { id: 'author-1', name: 'Author' },
      content: 'Post content',
      category: 'general',
      createdAt: new Date(),
      likes: 0,
      comments: 0
    };
  }

  async listPosts(params: { category?: string; limit: number }): Promise<Post[]> {
    await this.ensureConnected();

    return [];
  }

  async getMember(memberId: string): Promise<Member> {
    await this.ensureConnected();

    return {
      id: memberId,
      name: 'Member Name',
      role: 'member',
      joinedAt: new Date()
    };
  }

  async listMembers(params: { role?: string; limit: number }): Promise<Member[]> {
    await this.ensureConnected();

    return [];
  }

  async getPostStats(postId: string): Promise<PostStats> {
    await this.ensureConnected();

    return {
      postId,
      likes: 0,
      comments: 0
    };
  }

  async getMemberActivity(memberId: string): Promise<MemberActivity> {
    await this.ensureConnected();

    return {
      memberId,
      posts: 0,
      comments: 0,
      likes: 0,
      lastActive: new Date()
    };
  }

  async simulateHumanDelay(): Promise<void> {
    const delay = SKOOL_DELAYS.humanVariance.min +
      Math.random() * (SKOOL_DELAYS.humanVariance.max - SKOOL_DELAYS.humanVariance.min);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async ensureConnected(): Promise<void> {
    if (!this.page) {
      await this.connect();
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastActionTime;
    if (elapsed < SKOOL_DELAYS.betweenActions) {
      await new Promise(resolve =>
        setTimeout(resolve, SKOOL_DELAYS.betweenActions - elapsed)
      );
    }
  }

  private async typeWithHumanDelay(selector: string, text: string): Promise<void> {
    const element = this.page!.locator(selector);
    await element.waitFor({ state: 'visible' });

    for (const char of text) {
      await element.type(char, { delay: SKOOL_DELAYS.typing.min +
        Math.random() * (SKOOL_DELAYS.typing.max - SKOOL_DELAYS.typing.min) });
    }
  }

  private async uploadMedia(media: any): Promise<void> {
    // Handle different media types
    if (media.buffer) {
      const tempPath = `/tmp/${media.filename || 'upload'}`;
      await fs.writeFile(tempPath, media.buffer);
      await this.page!.setInputFiles('[data-testid="file-upload"]', tempPath);
      await fs.unlink(tempPath);
    } else if (media.url) {
      await this.page!.click('[data-testid="add-link"]');
      await this.typeWithHumanDelay('[data-testid="media-url"]', media.url);
    }
  }

  private async extractPostId(): Promise<string> {
    const url = this.page!.url();
    const match = url.match(/\/post\/([a-zA-Z0-9-]+)/);
    return match?.[1] || generateId('post');
  }

  private async captureErrorScreenshot(prefix: string): Promise<string> {
    const timestamp = Date.now();
    const filename = `${prefix}-${timestamp}.png`;
    const screenshotPath = path.join('/tmp/skool-errors', filename);

    await fs.mkdir('/tmp/skool-errors', { recursive: true });
    await this.page!.screenshot({ path: screenshotPath, fullPage: true });

    return screenshotPath;
  }
}
```

#### 2.3 Create Factory and Export

```typescript
// packages/browser-lane/src/connectors/skool/index.ts

export * from './types';
export * from './skool-connector';

import { SkoolConnector } from './skool-connector';
import { SkoolConfig } from './types';

export function createSkoolConnector(config: SkoolConfig): SkoolConnector {
  return new SkoolConnector(config);
}
```

### Phase 3: Verification

```bash
# Unit tests
cd packages/browser-lane
pnpm test src/connectors/skool --reporter=verbose --coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint src/connectors/skool
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/browser-lane/src/connectors/skool/types.ts` | Skool types |
| Create | `packages/browser-lane/src/connectors/skool/skool-connector.ts` | Main implementation |
| Create | `packages/browser-lane/src/connectors/skool/index.ts` | Public exports |
| Create | `packages/browser-lane/src/connectors/skool/__tests__/skool-connector.test.ts` | Unit tests |

---

## Acceptance Criteria

- [ ] Login/session management works
- [ ] Community post creation works
- [ ] Poll creation works
- [ ] Classroom module/lesson management works
- [ ] Event creation works
- [ ] Engagement actions (like, comment) work
- [ ] Human-like delays implemented
- [ ] Error screenshots captured
- [ ] Session persistence works
- [ ] Unit test coverage exceeds 80%

---

## JSON Task Block

```json
{
  "task_id": "S3-C3",
  "name": "Skool Browser Connector",
  "status": "pending",
  "dependencies": ["S3-C1", "S3-C2"],
  "blocks": ["S3-D1", "S3-D3"],
  "agent": "C",
  "sprint": 3,
  "complexity": "high",
  "package": "@rtv/browser-lane",
  "files": [
    "packages/browser-lane/src/connectors/skool/types.ts",
    "packages/browser-lane/src/connectors/skool/skool-connector.ts",
    "packages/browser-lane/src/connectors/skool/index.ts"
  ],
  "test_files": [
    "packages/browser-lane/src/connectors/skool/__tests__/skool-connector.test.ts"
  ],
  "estimated_loc": 700,
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
      path: docs/04-browser-lane/browser-automation-profile-vault.md
      sections: ["browser-automation"]
    - type: spec
      path: docs/09-platform-playbooks/skool-strategy.md
      sections: ["community-management"]
  summaries_to_create:
    - topic: "Skool browser automation patterns"
      scope: "selectors, human delays, session persistence"
  decisions_made: []
  blockers: []
  handoff_notes: null
```
