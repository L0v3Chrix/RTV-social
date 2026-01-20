# Build Prompt: S3-A3 — Delayed Execution System

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S3-A3 |
| Sprint | 3 - Scheduling + Publishing |
| Agent | A - Calendar System |
| Task Name | Delayed Execution System |
| Complexity | High |
| Status | pending |
| Estimated Tokens | 10,000 |

---

## Context

### What We're Building

The Delayed Execution System implements a job queue that triggers post publishing at their scheduled times. It uses BullMQ with Redis to manage delayed jobs with precise timing, retries, and failure handling.

### Why It Matters

- **Precise timing** — Posts published at exact scheduled times
- **Reliability** — Survives restarts with persistent queue
- **Scalability** — Handles thousands of scheduled posts
- **Observability** — Track job status and failures

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Queue Layer | Job architecture |
| `docs/06-reliability-ops/slo-error-budget.md` | Availability | Execution SLOs |
| `docs/01-architecture/rlm-integration-spec.md` | Episode | Job context |

---

## Prerequisites

### Completed Tasks

| Task ID | Provides |
|---------|----------|
| S3-A1 | Calendar model |
| S3-A2 | Scheduling API |
| S1-D4 | State machine (runner) |

### Required Packages

```bash
pnpm add bullmq ioredis
pnpm add -D @types/ioredis vitest
```

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests that define the expected behavior.

#### Test File: `packages/calendar/src/execution/__tests__/delayed-execution.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import {
  PublishQueue,
  PublishWorker,
  PublishJobData,
  PublishJobResult,
} from '../delayed-execution';
import { createTestRedis, cleanupTestRedis } from '@rtv/testing';

describe('PublishQueue', () => {
  let redis: Redis;
  let queue: PublishQueue;

  beforeEach(async () => {
    redis = await createTestRedis();
    queue = new PublishQueue(redis);
  });

  afterEach(async () => {
    await queue.close();
    await cleanupTestRedis(redis);
  });

  describe('enqueue', () => {
    it('should enqueue a job for immediate execution', async () => {
      const jobData: PublishJobData = {
        postId: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date().toISOString(),
      };

      const job = await queue.enqueue(jobData);

      expect(job.id).toBeDefined();
      expect(job.data.postId).toBe('post-123');
    });

    it('should enqueue a job with delay', async () => {
      const futureTime = new Date(Date.now() + 60000); // 1 minute
      const jobData: PublishJobData = {
        postId: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: futureTime.toISOString(),
      };

      const job = await queue.enqueueDelayed(jobData, futureTime);

      expect(job.opts.delay).toBeGreaterThan(0);
      expect(job.opts.delay).toBeLessThanOrEqual(60000);
    });

    it('should set correct job options', async () => {
      const jobData: PublishJobData = {
        postId: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date().toISOString(),
      };

      const job = await queue.enqueue(jobData, {
        priority: 1,
        attempts: 5,
      });

      expect(job.opts.priority).toBe(1);
      expect(job.opts.attempts).toBe(5);
    });

    it('should deduplicate jobs by post ID', async () => {
      const jobData: PublishJobData = {
        postId: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date().toISOString(),
      };

      const job1 = await queue.enqueue(jobData);
      const job2 = await queue.enqueue(jobData); // Same postId

      expect(job1.id).toBe(job2.id); // Should be same job
    });
  });

  describe('remove', () => {
    it('should remove a scheduled job', async () => {
      const jobData: PublishJobData = {
        postId: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date(Date.now() + 60000).toISOString(),
      };

      const job = await queue.enqueueDelayed(jobData, new Date(Date.now() + 60000));
      const removed = await queue.removeByPostId('post-123');

      expect(removed).toBe(true);
    });

    it('should return false if job not found', async () => {
      const removed = await queue.removeByPostId('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('reschedule', () => {
    it('should reschedule a job to new time', async () => {
      const originalTime = new Date(Date.now() + 60000);
      const newTime = new Date(Date.now() + 120000);

      const jobData: PublishJobData = {
        postId: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: originalTime.toISOString(),
      };

      await queue.enqueueDelayed(jobData, originalTime);
      const rescheduled = await queue.reschedule('post-123', newTime);

      expect(rescheduled).toBe(true);

      const job = await queue.getJobByPostId('post-123');
      expect(job?.data.scheduledTime).toBe(newTime.toISOString());
    });
  });

  describe('getScheduledJobs', () => {
    it('should list delayed jobs', async () => {
      const futureTime = new Date(Date.now() + 60000);

      await queue.enqueueDelayed({
        postId: 'post-1',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: futureTime.toISOString(),
      }, futureTime);

      await queue.enqueueDelayed({
        postId: 'post-2',
        clientId: 'client-456',
        platform: 'tiktok',
        postType: 'video',
        scheduledTime: futureTime.toISOString(),
      }, futureTime);

      const delayed = await queue.getScheduledJobs();

      expect(delayed).toHaveLength(2);
    });

    it('should filter by client ID', async () => {
      const futureTime = new Date(Date.now() + 60000);

      await queue.enqueueDelayed({
        postId: 'post-1',
        clientId: 'client-A',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: futureTime.toISOString(),
      }, futureTime);

      await queue.enqueueDelayed({
        postId: 'post-2',
        clientId: 'client-B',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: futureTime.toISOString(),
      }, futureTime);

      const clientAJobs = await queue.getScheduledJobs({ clientId: 'client-A' });

      expect(clientAJobs).toHaveLength(1);
      expect(clientAJobs[0].data.clientId).toBe('client-A');
    });
  });
});

describe('PublishWorker', () => {
  let redis: Redis;
  let queue: PublishQueue;
  let worker: PublishWorker;
  let publishHandler: vi.Mock;

  beforeEach(async () => {
    redis = await createTestRedis();
    queue = new PublishQueue(redis);
    publishHandler = vi.fn();
    worker = new PublishWorker(redis, publishHandler);
  });

  afterEach(async () => {
    await worker.close();
    await queue.close();
    await cleanupTestRedis(redis);
  });

  describe('processing', () => {
    it('should process jobs and call handler', async () => {
      publishHandler.mockResolvedValue({
        success: true,
        platformPostId: 'ig_12345',
        publishedUrl: 'https://instagram.com/p/12345',
      });

      const jobData: PublishJobData = {
        postId: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date().toISOString(),
      };

      await queue.enqueue(jobData);

      // Wait for processing
      await new Promise((resolve) => {
        worker.on('completed', resolve);
      });

      expect(publishHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: 'post-123',
          platform: 'instagram',
        })
      );
    });

    it('should retry failed jobs', async () => {
      let attempts = 0;
      publishHandler.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Transient error');
        }
        return {
          success: true,
          platformPostId: 'ig_12345',
          publishedUrl: 'https://instagram.com/p/12345',
        };
      });

      const jobData: PublishJobData = {
        postId: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date().toISOString(),
      };

      await queue.enqueue(jobData, { attempts: 5 });

      await new Promise((resolve) => {
        worker.on('completed', resolve);
      });

      expect(attempts).toBe(3);
    });

    it('should emit events on completion', async () => {
      publishHandler.mockResolvedValue({
        success: true,
        platformPostId: 'ig_12345',
        publishedUrl: 'https://instagram.com/p/12345',
      });

      const completedSpy = vi.fn();
      worker.on('completed', completedSpy);

      await queue.enqueue({
        postId: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(completedSpy).toHaveBeenCalled();
    });

    it('should emit events on failure', async () => {
      publishHandler.mockRejectedValue(new Error('Permanent failure'));

      const failedSpy = vi.fn();
      worker.on('failed', failedSpy);

      await queue.enqueue({
        postId: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date().toISOString(),
      }, { attempts: 1 });

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(failedSpy).toHaveBeenCalled();
    });
  });

  describe('concurrency', () => {
    it('should process multiple jobs concurrently', async () => {
      const processingOrder: string[] = [];
      publishHandler.mockImplementation(async (data) => {
        processingOrder.push(data.postId);
        await new Promise((r) => setTimeout(r, 100));
        return { success: true, platformPostId: 'test', publishedUrl: 'test' };
      });

      // Enqueue 5 jobs
      for (let i = 0; i < 5; i++) {
        await queue.enqueue({
          postId: `post-${i}`,
          clientId: 'client-456',
          platform: 'instagram',
          postType: 'feed',
          scheduledTime: new Date().toISOString(),
        });
      }

      // Wait for all
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(processingOrder.length).toBeGreaterThan(1);
    });

    it('should respect concurrency limit', async () => {
      const concurrentWorker = new PublishWorker(redis, publishHandler, {
        concurrency: 2,
      });

      let concurrent = 0;
      let maxConcurrent = 0;

      publishHandler.mockImplementation(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 100));
        concurrent--;
        return { success: true, platformPostId: 'test', publishedUrl: 'test' };
      });

      for (let i = 0; i < 10; i++) {
        await queue.enqueue({
          postId: `post-${i}`,
          clientId: 'client-456',
          platform: 'instagram',
          postType: 'feed',
          scheduledTime: new Date().toISOString(),
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await concurrentWorker.close();

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });
});

describe('DelayedExecutionService', () => {
  let redis: Redis;
  let service: DelayedExecutionService;
  let mockCalendarRepo: any;
  let mockPublisher: any;

  beforeEach(async () => {
    redis = await createTestRedis();
    mockCalendarRepo = {
      getPost: vi.fn(),
      updatePost: vi.fn(),
      getSlot: vi.fn(),
      updateSlot: vi.fn(),
    };
    mockPublisher = {
      publish: vi.fn(),
    };

    service = new DelayedExecutionService(redis, mockCalendarRepo, mockPublisher);
  });

  afterEach(async () => {
    await service.close();
    await cleanupTestRedis(redis);
  });

  describe('schedulePost', () => {
    it('should enqueue post for scheduled time', async () => {
      const scheduledTime = new Date(Date.now() + 60000);

      mockCalendarRepo.getPost.mockResolvedValue({
        id: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        status: 'scheduled',
        scheduledTime,
        content: { caption: 'Test', mediaUrls: [] },
      });

      await service.schedulePost('post-123');

      const job = await service.getJobForPost('post-123');
      expect(job).toBeDefined();
    });

    it('should update post status to queued', async () => {
      const scheduledTime = new Date(Date.now() + 60000);

      mockCalendarRepo.getPost.mockResolvedValue({
        id: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        status: 'scheduled',
        scheduledTime,
        content: { caption: 'Test', mediaUrls: [] },
      });

      await service.schedulePost('post-123');

      expect(mockCalendarRepo.updatePost).toHaveBeenCalledWith(
        'post-123',
        expect.objectContaining({ status: 'queued' })
      );
    });
  });

  describe('cancelPost', () => {
    it('should remove job and update status', async () => {
      const scheduledTime = new Date(Date.now() + 60000);

      mockCalendarRepo.getPost.mockResolvedValue({
        id: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        status: 'queued',
        scheduledTime,
        slotId: 'slot-789',
        content: { caption: 'Test', mediaUrls: [] },
      });

      // Schedule first
      await service.schedulePost('post-123');

      // Then cancel
      await service.cancelPost('post-123');

      const job = await service.getJobForPost('post-123');
      expect(job).toBeNull();

      expect(mockCalendarRepo.updatePost).toHaveBeenCalledWith(
        'post-123',
        expect.objectContaining({ status: 'cancelled' })
      );
    });
  });

  describe('processJob', () => {
    it('should call publisher and update status on success', async () => {
      mockCalendarRepo.getPost.mockResolvedValue({
        id: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        status: 'queued',
        scheduledTime: new Date(),
        slotId: 'slot-789',
        content: { caption: 'Test', mediaUrls: [] },
      });

      mockPublisher.publish.mockResolvedValue({
        success: true,
        platformPostId: 'ig_12345',
        publishedUrl: 'https://instagram.com/p/12345',
      });

      await service.processJob({
        postId: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        scheduledTime: new Date().toISOString(),
      });

      expect(mockPublisher.publish).toHaveBeenCalled();
      expect(mockCalendarRepo.updatePost).toHaveBeenCalledWith(
        'post-123',
        expect.objectContaining({
          status: 'published',
          platformPostId: 'ig_12345',
        })
      );
    });

    it('should update status on failure', async () => {
      mockCalendarRepo.getPost.mockResolvedValue({
        id: 'post-123',
        clientId: 'client-456',
        platform: 'instagram',
        postType: 'feed',
        status: 'queued',
        scheduledTime: new Date(),
        content: { caption: 'Test', mediaUrls: [] },
      });

      mockPublisher.publish.mockRejectedValue(new Error('API error'));

      await expect(
        service.processJob({
          postId: 'post-123',
          clientId: 'client-456',
          platform: 'instagram',
          postType: 'feed',
          scheduledTime: new Date().toISOString(),
        })
      ).rejects.toThrow();

      expect(mockCalendarRepo.updatePost).toHaveBeenCalledWith(
        'post-123',
        expect.objectContaining({ status: 'publishing' })
      );
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Define Job Schemas

Create `packages/calendar/src/execution/schemas.ts`:

```typescript
import { z } from 'zod';
import { PlatformSchema, PostTypeSchema } from '../schemas';

export const PublishJobDataSchema = z.object({
  postId: z.string(),
  clientId: z.string(),
  platform: PlatformSchema,
  postType: PostTypeSchema,
  scheduledTime: z.string().datetime(),
  attempt: z.number().default(1),
});

export type PublishJobData = z.infer<typeof PublishJobDataSchema>;

export const PublishJobResultSchema = z.object({
  success: z.boolean(),
  platformPostId: z.string().optional(),
  publishedUrl: z.string().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }).optional(),
});

export type PublishJobResult = z.infer<typeof PublishJobResultSchema>;

export const JobOptionsSchema = z.object({
  priority: z.number().min(1).max(10).optional(),
  attempts: z.number().min(1).max(10).default(3),
  backoff: z.object({
    type: z.enum(['exponential', 'fixed']),
    delay: z.number(),
  }).optional(),
});

export type JobOptions = z.infer<typeof JobOptionsSchema>;
```

#### Step 2: Implement Publish Queue

Create `packages/calendar/src/execution/queue.ts`:

```typescript
import { Queue, Job, JobsOptions } from 'bullmq';
import Redis from 'ioredis';
import { PublishJobData, JobOptions } from './schemas';

const QUEUE_NAME = 'publish-queue';

export class PublishQueue {
  private queue: Queue<PublishJobData>;

  constructor(redis: Redis) {
    this.queue = new Queue<PublishJobData>(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 604800, // 7 days
        },
      },
    });
  }

  async enqueue(
    data: PublishJobData,
    options?: JobOptions
  ): Promise<Job<PublishJobData>> {
    const jobOptions: JobsOptions = {
      jobId: `publish:${data.postId}`,
      priority: options?.priority,
      attempts: options?.attempts || 3,
      backoff: options?.backoff,
    };

    return this.queue.add('publish', data, jobOptions);
  }

  async enqueueDelayed(
    data: PublishJobData,
    executeAt: Date
  ): Promise<Job<PublishJobData>> {
    const delay = Math.max(0, executeAt.getTime() - Date.now());

    return this.queue.add('publish', data, {
      jobId: `publish:${data.postId}`,
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  async removeByPostId(postId: string): Promise<boolean> {
    const job = await this.queue.getJob(`publish:${postId}`);
    if (!job) return false;

    await job.remove();
    return true;
  }

  async reschedule(postId: string, newTime: Date): Promise<boolean> {
    const job = await this.queue.getJob(`publish:${postId}`);
    if (!job) return false;

    const data = job.data;
    await job.remove();

    await this.enqueueDelayed(
      { ...data, scheduledTime: newTime.toISOString() },
      newTime
    );

    return true;
  }

  async getJobByPostId(postId: string): Promise<Job<PublishJobData> | null> {
    return this.queue.getJob(`publish:${postId}`) || null;
  }

  async getScheduledJobs(filter?: {
    clientId?: string;
    platform?: string;
  }): Promise<Job<PublishJobData>[]> {
    const delayed = await this.queue.getDelayed();

    if (!filter) return delayed;

    return delayed.filter((job) => {
      if (filter.clientId && job.data.clientId !== filter.clientId) return false;
      if (filter.platform && job.data.platform !== filter.platform) return false;
      return true;
    });
  }

  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    return this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
```

#### Step 3: Implement Publish Worker

Create `packages/calendar/src/execution/worker.ts`:

```typescript
import { Worker, Job } from 'bullmq';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { PublishJobData, PublishJobResult } from './schemas';

const QUEUE_NAME = 'publish-queue';

export type PublishHandler = (data: PublishJobData) => Promise<PublishJobResult>;

export interface WorkerOptions {
  concurrency?: number;
}

export class PublishWorker extends EventEmitter {
  private worker: Worker<PublishJobData, PublishJobResult>;

  constructor(
    redis: Redis,
    handler: PublishHandler,
    options: WorkerOptions = {}
  ) {
    super();

    this.worker = new Worker<PublishJobData, PublishJobResult>(
      QUEUE_NAME,
      async (job: Job<PublishJobData>) => {
        this.emit('processing', job);

        try {
          const result = await handler(job.data);

          if (!result.success && result.error?.retryable) {
            throw new Error(result.error.message);
          }

          return result;
        } catch (error) {
          this.emit('error', { job, error });
          throw error;
        }
      },
      {
        connection: redis,
        concurrency: options.concurrency || 5,
        limiter: {
          max: 100,
          duration: 60000, // 100 jobs per minute
        },
      }
    );

    // Forward events
    this.worker.on('completed', (job, result) => {
      this.emit('completed', { job, result });
    });

    this.worker.on('failed', (job, error) => {
      this.emit('failed', { job, error });
    });

    this.worker.on('stalled', (jobId) => {
      this.emit('stalled', { jobId });
    });
  }

  async pause(): Promise<void> {
    await this.worker.pause();
  }

  async resume(): Promise<void> {
    await this.worker.resume();
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
```

#### Step 4: Implement Execution Service

Create `packages/calendar/src/execution/service.ts`:

```typescript
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { PublishQueue } from './queue';
import { PublishWorker, PublishHandler } from './worker';
import { CalendarRepository } from '../repository';
import { ScheduledPost } from '../models/scheduled-post';
import { PublishJobData, PublishJobResult } from './schemas';

export interface Publisher {
  publish(post: {
    id: string;
    platform: string;
    postType: string;
    content: any;
    clientId: string;
  }): Promise<PublishJobResult>;
}

export class DelayedExecutionService extends EventEmitter {
  private queue: PublishQueue;
  private worker: PublishWorker;

  constructor(
    redis: Redis,
    private repo: CalendarRepository,
    private publisher: Publisher
  ) {
    super();

    this.queue = new PublishQueue(redis);
    this.worker = new PublishWorker(
      redis,
      this.processJob.bind(this)
    );

    // Forward worker events
    this.worker.on('completed', (data) => this.emit('completed', data));
    this.worker.on('failed', (data) => this.emit('failed', data));
  }

  async schedulePost(postId: string): Promise<void> {
    const postRow = await this.repo.getPost(postId);
    if (!postRow) throw new Error('Post not found');

    if (postRow.status !== 'scheduled') {
      throw new Error(`Cannot schedule post with status: ${postRow.status}`);
    }

    const jobData: PublishJobData = {
      postId: postRow.id,
      clientId: postRow.clientId,
      platform: postRow.platform,
      postType: postRow.postType,
      scheduledTime: postRow.scheduledTime.toISOString(),
    };

    await this.queue.enqueueDelayed(jobData, postRow.scheduledTime);

    // Update post status
    await this.repo.updatePost(postId, {
      status: 'queued',
      queuedAt: new Date(),
    });
  }

  async cancelPost(postId: string): Promise<void> {
    const postRow = await this.repo.getPost(postId);
    if (!postRow) throw new Error('Post not found');

    // Remove from queue
    await this.queue.removeByPostId(postId);

    // Update post status
    await this.repo.updatePost(postId, { status: 'cancelled' });

    // Release slot if exists
    if (postRow.slotId) {
      await this.repo.updateSlot(postRow.slotId, {
        status: 'available',
        reservedForPostId: null,
      });
    }
  }

  async reschedulePost(postId: string, newTime: Date): Promise<void> {
    const postRow = await this.repo.getPost(postId);
    if (!postRow) throw new Error('Post not found');

    await this.queue.reschedule(postId, newTime);
  }

  async getJobForPost(postId: string) {
    return this.queue.getJobByPostId(postId);
  }

  async getScheduledJobs(filter?: { clientId?: string }) {
    return this.queue.getScheduledJobs(filter);
  }

  async processJob(data: PublishJobData): Promise<PublishJobResult> {
    const postRow = await this.repo.getPost(data.postId);
    if (!postRow) {
      return {
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post no longer exists',
          retryable: false,
        },
      };
    }

    // Update status to publishing
    await this.repo.updatePost(data.postId, {
      status: 'publishing',
      publishingStartedAt: new Date(),
    });

    try {
      const result = await this.publisher.publish({
        id: postRow.id,
        platform: postRow.platform,
        postType: postRow.postType,
        content: postRow.content,
        clientId: postRow.clientId,
      });

      if (result.success) {
        // Update post with success
        await this.repo.updatePost(data.postId, {
          status: 'published',
          platformPostId: result.platformPostId,
          publishedUrl: result.publishedUrl,
          publishedAt: new Date(),
        });

        // Mark slot as executed
        if (postRow.slotId) {
          await this.repo.updateSlot(postRow.slotId, { status: 'executed' });
        }
      } else {
        // Update post with failure
        await this.repo.updatePost(data.postId, {
          status: 'failed',
          failureReason: {
            errorCode: result.error!.code,
            errorMessage: result.error!.message,
            retryable: result.error!.retryable,
          },
        });
      }

      return result;
    } catch (error: any) {
      // Update failure reason but keep status for retry
      await this.repo.updatePost(data.postId, {
        failureReason: {
          errorCode: 'PUBLISH_ERROR',
          errorMessage: error.message,
          retryable: true,
          retryCount: data.attempt,
        },
      });

      throw error;
    }
  }

  async pause(): Promise<void> {
    await this.worker.pause();
  }

  async resume(): Promise<void> {
    await this.worker.resume();
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }
}
```

#### Step 5: Export Module

Create `packages/calendar/src/execution/index.ts`:

```typescript
export * from './schemas';
export * from './queue';
export * from './worker';
export * from './service';
```

### Phase 3: Verification

```bash
# Run tests
cd packages/calendar
pnpm test src/execution/

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint src/execution/
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/calendar/src/execution/schemas.ts` | Job type definitions |
| Create | `packages/calendar/src/execution/queue.ts` | BullMQ queue wrapper |
| Create | `packages/calendar/src/execution/worker.ts` | Job worker |
| Create | `packages/calendar/src/execution/service.ts` | Execution service |
| Create | `packages/calendar/src/execution/index.ts` | Module exports |
| Create | `packages/calendar/src/execution/__tests__/delayed-execution.test.ts` | Tests |

---

## Acceptance Criteria

- [ ] Jobs enqueued with correct delay
- [ ] Jobs deduplicated by post ID
- [ ] Reschedule removes old job and creates new
- [ ] Worker processes jobs at scheduled time
- [ ] Retry with exponential backoff on failure
- [ ] Post status updated through lifecycle
- [ ] Slot marked executed on success
- [ ] Concurrency limits respected
- [ ] All tests pass

---

## JSON Task Block

```json
{
  "task_id": "S3-A3",
  "name": "Delayed Execution System",
  "status": "pending",
  "dependencies": ["S3-A1", "S3-A2"],
  "blocks": ["S3-B1", "S3-B2", "S3-B3", "S3-B4", "S3-B5", "S3-B6", "S3-C1"],
  "complexity": "high",
  "agent": "A",
  "sprint": 3,
  "package": "@rtv/calendar"
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
  "context_refs": [
    "spec://docs/01-architecture/system-architecture-v3.md",
    "spec://docs/06-reliability-ops/slo-error-budget.md"
  ],
  "predecessor_summaries": [
    "S3-A1: Calendar model with slots and posts",
    "S3-A2: Scheduling REST API"
  ]
}
```
