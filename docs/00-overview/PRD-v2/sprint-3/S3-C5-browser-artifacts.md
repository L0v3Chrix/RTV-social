# Build Prompt: S3-C5 — Browser Artifacts

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S3-C5 |
| **Sprint** | 3 — Scheduling + Publishing |
| **Agent** | C — Browser Lane |
| **Task Name** | Browser Artifacts |
| **Complexity** | Medium |
| **Status** | Pending |
| **Estimated Effort** | 0.5 days |
| **Dependencies** | S3-C1, S3-C2 |
| **Blocks** | S3-D3 |

---

## Context

### What We're Building

A browser artifacts system that captures screenshots, network HAR files, console logs, and proof-of-action records for every browser automation operation for debugging, audit trails, and verification.

### Why It Matters

Browser automation requires robust debugging and audit capabilities. Artifacts provide evidence of actions taken, help diagnose failures, and create compliance records for client reporting.

### Spec References

- `docs/04-browser-lane/browser-automation-profile-vault.md` — Artifact requirements
- `docs/06-reliability-ops/observability-spec.md` — Observability patterns
- `docs/05-policy-safety/audit-spec.md` — Audit trail requirements

---

## Prerequisites

### Completed Tasks

- [x] S3-C1: Profile Vault
- [x] S3-C2: Browser Isolation

### Required Tools/Packages

```bash
pnpm add playwright archiver
pnpm add -D vitest @types/archiver
```

---

## Instructions

### Phase 1: Test First (TDD)

#### 1.1 Create Browser Artifacts Test Suite

```typescript
// packages/browser-lane/src/artifacts/__tests__/browser-artifacts.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserArtifacts } from '../browser-artifacts';
import { ArtifactsConfig, ArtifactType, ActionProof } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('BrowserArtifacts', () => {
  let artifacts: BrowserArtifacts;
  let tempDir: string;

  const testConfig: ArtifactsConfig = {
    basePath: '/tmp/test-artifacts',
    retentionDays: 7,
    enableScreenshots: true,
    enableHar: true,
    enableConsoleLogs: true,
    s3Bucket: 'test-bucket',
    s3Region: 'us-east-1'
  };

  beforeEach(async () => {
    tempDir = `/tmp/test-artifacts-${Date.now()}`;
    artifacts = new BrowserArtifacts({ ...testConfig, basePath: tempDir });
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('screenshot capture', () => {
    it('should capture page screenshot', async () => {
      const result = await artifacts.captureScreenshot({
        sessionId: 'session-123',
        actionId: 'action-456',
        label: 'before-click',
        page: createMockPage()
      });

      expect(result.path).toContain('session-123');
      expect(result.path).toContain('action-456');
      expect(result.type).toBe('screenshot');
    });

    it('should capture full page screenshot', async () => {
      const result = await artifacts.captureScreenshot({
        sessionId: 'session-123',
        actionId: 'action-456',
        label: 'full-page',
        page: createMockPage(),
        fullPage: true
      });

      expect(result.path).toBeDefined();
    });

    it('should capture element screenshot', async () => {
      const result = await artifacts.captureScreenshot({
        sessionId: 'session-123',
        actionId: 'action-456',
        label: 'button',
        page: createMockPage(),
        selector: '#submit-btn'
      });

      expect(result.path).toBeDefined();
    });

    it('should organize by session and action', async () => {
      await artifacts.captureScreenshot({
        sessionId: 'session-A',
        actionId: 'action-1',
        label: 'test',
        page: createMockPage()
      });

      const sessionPath = path.join(tempDir, 'session-A', 'action-1');
      const exists = await fs.stat(sessionPath).then(() => true).catch(() => false);

      expect(exists).toBe(true);
    });
  });

  describe('HAR capture', () => {
    it('should start HAR recording', async () => {
      const recording = await artifacts.startHarRecording({
        sessionId: 'session-123',
        actionId: 'action-456',
        context: createMockContext()
      });

      expect(recording.recordingId).toBeDefined();
      expect(recording.status).toBe('recording');
    });

    it('should stop HAR recording and save file', async () => {
      const recording = await artifacts.startHarRecording({
        sessionId: 'session-123',
        actionId: 'action-456',
        context: createMockContext()
      });

      const result = await artifacts.stopHarRecording(recording.recordingId);

      expect(result.path).toContain('.har');
      expect(result.type).toBe('har');
    });

    it('should capture network requests', async () => {
      const recording = await artifacts.startHarRecording({
        sessionId: 'session-123',
        actionId: 'action-456',
        context: createMockContext()
      });

      // Simulate network activity
      await recording.onRequest({ url: 'https://api.example.com/data' });
      await recording.onResponse({ url: 'https://api.example.com/data', status: 200 });

      const result = await artifacts.stopHarRecording(recording.recordingId);

      expect(result.requestCount).toBeGreaterThan(0);
    });
  });

  describe('console log capture', () => {
    it('should capture console logs', async () => {
      const collector = await artifacts.startConsoleCapture({
        sessionId: 'session-123',
        actionId: 'action-456',
        page: createMockPage()
      });

      // Simulate console messages
      collector.addLog({ type: 'log', text: 'Test message', timestamp: Date.now() });
      collector.addLog({ type: 'error', text: 'Test error', timestamp: Date.now() });

      const result = await artifacts.stopConsoleCapture(collector.collectorId);

      expect(result.logCount).toBe(2);
      expect(result.errorCount).toBe(1);
    });

    it('should filter by log level', async () => {
      const collector = await artifacts.startConsoleCapture({
        sessionId: 'session-123',
        actionId: 'action-456',
        page: createMockPage(),
        levels: ['error', 'warning']
      });

      collector.addLog({ type: 'log', text: 'Info', timestamp: Date.now() });
      collector.addLog({ type: 'error', text: 'Error', timestamp: Date.now() });

      const result = await artifacts.stopConsoleCapture(collector.collectorId);

      expect(result.logCount).toBe(1); // Only error
    });
  });

  describe('action proof', () => {
    it('should create action proof record', async () => {
      const proof = await artifacts.createActionProof({
        sessionId: 'session-123',
        actionId: 'action-456',
        actionType: 'click',
        target: '#submit-button',
        timestamp: new Date(),
        page: createMockPage()
      });

      expect(proof.proofId).toBeDefined();
      expect(proof.screenshots).toHaveLength(2); // before and after
    });

    it('should include before and after screenshots', async () => {
      const proof = await artifacts.createActionProof({
        sessionId: 'session-123',
        actionId: 'action-456',
        actionType: 'fill',
        target: '#email-input',
        value: 'test@example.com',
        timestamp: new Date(),
        page: createMockPage()
      });

      expect(proof.screenshots.find(s => s.label === 'before')).toBeDefined();
      expect(proof.screenshots.find(s => s.label === 'after')).toBeDefined();
    });

    it('should record action metadata', async () => {
      const proof = await artifacts.createActionProof({
        sessionId: 'session-123',
        actionId: 'action-456',
        actionType: 'navigate',
        target: 'https://example.com',
        timestamp: new Date(),
        page: createMockPage(),
        metadata: {
          expectedTitle: 'Example Domain'
        }
      });

      expect(proof.metadata.expectedTitle).toBe('Example Domain');
    });
  });

  describe('artifact bundling', () => {
    it('should create artifact bundle', async () => {
      // Create some artifacts first
      await artifacts.captureScreenshot({
        sessionId: 'session-123',
        actionId: 'action-1',
        label: 'test',
        page: createMockPage()
      });

      const bundle = await artifacts.createBundle({
        sessionId: 'session-123',
        includeScreenshots: true,
        includeHar: true,
        includeConsoleLogs: true
      });

      expect(bundle.path).toContain('.zip');
      expect(bundle.size).toBeGreaterThan(0);
    });

    it('should filter bundle by action IDs', async () => {
      await artifacts.captureScreenshot({
        sessionId: 'session-123',
        actionId: 'action-1',
        label: 'test1',
        page: createMockPage()
      });

      await artifacts.captureScreenshot({
        sessionId: 'session-123',
        actionId: 'action-2',
        label: 'test2',
        page: createMockPage()
      });

      const bundle = await artifacts.createBundle({
        sessionId: 'session-123',
        actionIds: ['action-1'],
        includeScreenshots: true
      });

      expect(bundle.artifactCount).toBe(1);
    });
  });

  describe('artifact cleanup', () => {
    it('should delete artifacts older than retention period', async () => {
      // Create old artifact
      const oldPath = path.join(tempDir, 'old-session', 'action-1');
      await fs.mkdir(oldPath, { recursive: true });
      await fs.writeFile(path.join(oldPath, 'test.png'), 'test');

      // Set old mtime
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      await fs.utimes(oldPath, oldDate, oldDate);

      const deleted = await artifacts.cleanupOldArtifacts();

      expect(deleted.deletedCount).toBeGreaterThan(0);
    });

    it('should preserve recent artifacts', async () => {
      await artifacts.captureScreenshot({
        sessionId: 'recent-session',
        actionId: 'action-1',
        label: 'test',
        page: createMockPage()
      });

      const deleted = await artifacts.cleanupOldArtifacts();

      const exists = await fs.stat(path.join(tempDir, 'recent-session'))
        .then(() => true).catch(() => false);

      expect(exists).toBe(true);
    });
  });

  describe('S3 upload', () => {
    it('should upload artifact to S3', async () => {
      const s3Mock = {
        upload: vi.fn().mockResolvedValue({ Location: 's3://bucket/artifact.png' })
      };
      vi.spyOn(artifacts as any, 's3Client', 'get').mockReturnValue(s3Mock);

      const screenshot = await artifacts.captureScreenshot({
        sessionId: 'session-123',
        actionId: 'action-456',
        label: 'test',
        page: createMockPage()
      });

      const s3Result = await artifacts.uploadToS3(screenshot.path);

      expect(s3Result.s3Url).toBeDefined();
    });

    it('should upload bundle to S3', async () => {
      const s3Mock = {
        upload: vi.fn().mockResolvedValue({ Location: 's3://bucket/bundle.zip' })
      };
      vi.spyOn(artifacts as any, 's3Client', 'get').mockReturnValue(s3Mock);

      await artifacts.captureScreenshot({
        sessionId: 'session-123',
        actionId: 'action-1',
        label: 'test',
        page: createMockPage()
      });

      const bundle = await artifacts.createBundle({
        sessionId: 'session-123',
        includeScreenshots: true,
        uploadToS3: true
      });

      expect(bundle.s3Url).toBeDefined();
    });
  });

  describe('artifact listing', () => {
    it('should list all artifacts for session', async () => {
      await artifacts.captureScreenshot({
        sessionId: 'session-123',
        actionId: 'action-1',
        label: 'test1',
        page: createMockPage()
      });

      await artifacts.captureScreenshot({
        sessionId: 'session-123',
        actionId: 'action-2',
        label: 'test2',
        page: createMockPage()
      });

      const list = await artifacts.listArtifacts({
        sessionId: 'session-123'
      });

      expect(list.length).toBe(2);
    });

    it('should filter by artifact type', async () => {
      await artifacts.captureScreenshot({
        sessionId: 'session-123',
        actionId: 'action-1',
        label: 'test',
        page: createMockPage()
      });

      const list = await artifacts.listArtifacts({
        sessionId: 'session-123',
        type: 'screenshot'
      });

      expect(list.every(a => a.type === 'screenshot')).toBe(true);
    });
  });
});

// Helper functions
function createMockPage() {
  return {
    screenshot: vi.fn().mockResolvedValue(Buffer.alloc(1000)),
    url: vi.fn().mockReturnValue('https://example.com'),
    title: vi.fn().mockResolvedValue('Test Page'),
    locator: vi.fn().mockReturnValue({
      screenshot: vi.fn().mockResolvedValue(Buffer.alloc(500))
    })
  };
}

function createMockContext() {
  return {
    on: vi.fn(),
    off: vi.fn()
  };
}
```

### Phase 2: Implementation

#### 2.1 Create Artifacts Types

```typescript
// packages/browser-lane/src/artifacts/types.ts

import { z } from 'zod';

export const ArtifactsConfigSchema = z.object({
  basePath: z.string(),
  retentionDays: z.number().default(7),
  enableScreenshots: z.boolean().default(true),
  enableHar: z.boolean().default(true),
  enableConsoleLogs: z.boolean().default(true),
  s3Bucket: z.string().optional(),
  s3Region: z.string().default('us-east-1')
});

export type ArtifactsConfig = z.infer<typeof ArtifactsConfigSchema>;

export type ArtifactType = 'screenshot' | 'har' | 'console_log' | 'action_proof' | 'bundle';

export interface ArtifactMetadata {
  id: string;
  type: ArtifactType;
  sessionId: string;
  actionId: string;
  path: string;
  size: number;
  createdAt: Date;
  s3Url?: string;
}

export interface ScreenshotParams {
  sessionId: string;
  actionId: string;
  label: string;
  page: any; // Playwright Page
  fullPage?: boolean;
  selector?: string;
}

export interface ScreenshotResult extends ArtifactMetadata {
  type: 'screenshot';
  label: string;
  dimensions?: { width: number; height: number };
}

export interface HarRecordingParams {
  sessionId: string;
  actionId: string;
  context: any; // Playwright BrowserContext
}

export interface HarRecording {
  recordingId: string;
  sessionId: string;
  actionId: string;
  status: 'recording' | 'stopped';
  onRequest: (request: any) => Promise<void>;
  onResponse: (response: any) => Promise<void>;
}

export interface HarResult extends ArtifactMetadata {
  type: 'har';
  requestCount: number;
  responseCount: number;
  totalTransferSize: number;
}

export interface ConsoleParams {
  sessionId: string;
  actionId: string;
  page: any;
  levels?: Array<'log' | 'warning' | 'error' | 'info' | 'debug'>;
}

export interface ConsoleLog {
  type: string;
  text: string;
  timestamp: number;
  location?: string;
}

export interface ConsoleCollector {
  collectorId: string;
  sessionId: string;
  actionId: string;
  addLog: (log: ConsoleLog) => void;
}

export interface ConsoleResult extends ArtifactMetadata {
  type: 'console_log';
  logCount: number;
  errorCount: number;
  warningCount: number;
}

export interface ActionProofParams {
  sessionId: string;
  actionId: string;
  actionType: string;
  target: string;
  value?: string;
  timestamp: Date;
  page: any;
  metadata?: Record<string, any>;
}

export interface ActionProof {
  proofId: string;
  sessionId: string;
  actionId: string;
  actionType: string;
  target: string;
  value?: string;
  timestamp: Date;
  screenshots: ScreenshotResult[];
  metadata: Record<string, any>;
}

export interface BundleParams {
  sessionId: string;
  actionIds?: string[];
  includeScreenshots?: boolean;
  includeHar?: boolean;
  includeConsoleLogs?: boolean;
  uploadToS3?: boolean;
}

export interface BundleResult {
  bundleId: string;
  sessionId: string;
  path: string;
  size: number;
  artifactCount: number;
  createdAt: Date;
  s3Url?: string;
}

export interface ListArtifactsParams {
  sessionId: string;
  actionId?: string;
  type?: ArtifactType;
}
```

#### 2.2 Implement Browser Artifacts

```typescript
// packages/browser-lane/src/artifacts/browser-artifacts.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  ArtifactsConfig,
  ArtifactsConfigSchema,
  ArtifactMetadata,
  ScreenshotParams,
  ScreenshotResult,
  HarRecordingParams,
  HarRecording,
  HarResult,
  ConsoleParams,
  ConsoleCollector,
  ConsoleResult,
  ConsoleLog,
  ActionProofParams,
  ActionProof,
  BundleParams,
  BundleResult,
  ListArtifactsParams
} from './types';
import { logger } from '@rtv/observability';
import { generateId } from '@rtv/core';

export class BrowserArtifacts {
  private readonly config: ArtifactsConfig;
  private readonly s3Client: S3Client | null;
  private harRecordings: Map<string, { entries: any[]; params: HarRecordingParams }> = new Map();
  private consoleCollectors: Map<string, { logs: ConsoleLog[]; params: ConsoleParams }> = new Map();

  constructor(config: ArtifactsConfig) {
    this.config = ArtifactsConfigSchema.parse(config);

    if (config.s3Bucket) {
      this.s3Client = new S3Client({ region: config.s3Region });
    } else {
      this.s3Client = null;
    }
  }

  async captureScreenshot(params: ScreenshotParams): Promise<ScreenshotResult> {
    const artifactId = generateId('screenshot');
    const artifactDir = this.getArtifactDir(params.sessionId, params.actionId);
    await fs.mkdir(artifactDir, { recursive: true });

    const filename = `${params.label}-${Date.now()}.png`;
    const artifactPath = path.join(artifactDir, filename);

    let buffer: Buffer;
    let dimensions: { width: number; height: number } | undefined;

    if (params.selector) {
      const element = params.page.locator(params.selector);
      buffer = await element.screenshot();
    } else {
      buffer = await params.page.screenshot({ fullPage: params.fullPage });
    }

    await fs.writeFile(artifactPath, buffer);

    const stats = await fs.stat(artifactPath);

    logger.debug('BrowserArtifacts: Screenshot captured', {
      sessionId: params.sessionId,
      actionId: params.actionId,
      label: params.label
    });

    return {
      id: artifactId,
      type: 'screenshot',
      sessionId: params.sessionId,
      actionId: params.actionId,
      path: artifactPath,
      size: stats.size,
      createdAt: new Date(),
      label: params.label,
      dimensions
    };
  }

  async startHarRecording(params: HarRecordingParams): Promise<HarRecording> {
    const recordingId = generateId('har');

    const recording: HarRecording = {
      recordingId,
      sessionId: params.sessionId,
      actionId: params.actionId,
      status: 'recording',
      onRequest: async (request: any) => {
        const entry = this.harRecordings.get(recordingId);
        if (entry) {
          entry.entries.push({
            startedDateTime: new Date().toISOString(),
            request: {
              method: request.method || 'GET',
              url: request.url,
              headers: []
            }
          });
        }
      },
      onResponse: async (response: any) => {
        const entry = this.harRecordings.get(recordingId);
        if (entry) {
          const lastEntry = entry.entries[entry.entries.length - 1];
          if (lastEntry) {
            lastEntry.response = {
              status: response.status || 200,
              statusText: response.statusText || 'OK',
              headers: []
            };
          }
        }
      }
    };

    this.harRecordings.set(recordingId, { entries: [], params });

    // Set up context listeners
    params.context.on('request', recording.onRequest);
    params.context.on('response', recording.onResponse);

    return recording;
  }

  async stopHarRecording(recordingId: string): Promise<HarResult> {
    const recording = this.harRecordings.get(recordingId);
    if (!recording) {
      throw new Error(`HAR recording ${recordingId} not found`);
    }

    const { entries, params } = recording;

    const artifactDir = this.getArtifactDir(params.sessionId, params.actionId);
    await fs.mkdir(artifactDir, { recursive: true });

    const filename = `network-${Date.now()}.har`;
    const artifactPath = path.join(artifactDir, filename);

    const har = {
      log: {
        version: '1.2',
        creator: { name: 'RTV Browser Artifacts', version: '1.0' },
        entries
      }
    };

    await fs.writeFile(artifactPath, JSON.stringify(har, null, 2));

    this.harRecordings.delete(recordingId);

    const stats = await fs.stat(artifactPath);

    return {
      id: recordingId,
      type: 'har',
      sessionId: params.sessionId,
      actionId: params.actionId,
      path: artifactPath,
      size: stats.size,
      createdAt: new Date(),
      requestCount: entries.length,
      responseCount: entries.filter(e => e.response).length,
      totalTransferSize: 0
    };
  }

  async startConsoleCapture(params: ConsoleParams): Promise<ConsoleCollector> {
    const collectorId = generateId('console');

    const collector: ConsoleCollector = {
      collectorId,
      sessionId: params.sessionId,
      actionId: params.actionId,
      addLog: (log: ConsoleLog) => {
        const entry = this.consoleCollectors.get(collectorId);
        if (entry) {
          if (!params.levels || params.levels.includes(log.type as any)) {
            entry.logs.push(log);
          }
        }
      }
    };

    this.consoleCollectors.set(collectorId, { logs: [], params });

    // Set up page console listener
    params.page.on('console', (msg: any) => {
      collector.addLog({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
        location: msg.location()?.url
      });
    });

    return collector;
  }

  async stopConsoleCapture(collectorId: string): Promise<ConsoleResult> {
    const collector = this.consoleCollectors.get(collectorId);
    if (!collector) {
      throw new Error(`Console collector ${collectorId} not found`);
    }

    const { logs, params } = collector;

    const artifactDir = this.getArtifactDir(params.sessionId, params.actionId);
    await fs.mkdir(artifactDir, { recursive: true });

    const filename = `console-${Date.now()}.json`;
    const artifactPath = path.join(artifactDir, filename);

    await fs.writeFile(artifactPath, JSON.stringify(logs, null, 2));

    this.consoleCollectors.delete(collectorId);

    const stats = await fs.stat(artifactPath);

    return {
      id: collectorId,
      type: 'console_log',
      sessionId: params.sessionId,
      actionId: params.actionId,
      path: artifactPath,
      size: stats.size,
      createdAt: new Date(),
      logCount: logs.length,
      errorCount: logs.filter(l => l.type === 'error').length,
      warningCount: logs.filter(l => l.type === 'warning').length
    };
  }

  async createActionProof(params: ActionProofParams): Promise<ActionProof> {
    const proofId = generateId('proof');

    // Capture before screenshot
    const beforeScreenshot = await this.captureScreenshot({
      sessionId: params.sessionId,
      actionId: params.actionId,
      label: 'before',
      page: params.page
    });

    // Capture after screenshot (simulate action delay)
    await new Promise(resolve => setTimeout(resolve, 500));

    const afterScreenshot = await this.captureScreenshot({
      sessionId: params.sessionId,
      actionId: params.actionId,
      label: 'after',
      page: params.page
    });

    // Save proof metadata
    const proof: ActionProof = {
      proofId,
      sessionId: params.sessionId,
      actionId: params.actionId,
      actionType: params.actionType,
      target: params.target,
      value: params.value,
      timestamp: params.timestamp,
      screenshots: [beforeScreenshot, afterScreenshot],
      metadata: params.metadata || {}
    };

    const artifactDir = this.getArtifactDir(params.sessionId, params.actionId);
    const proofPath = path.join(artifactDir, `proof-${proofId}.json`);
    await fs.writeFile(proofPath, JSON.stringify(proof, null, 2));

    logger.info('BrowserArtifacts: Action proof created', {
      proofId,
      actionType: params.actionType,
      target: params.target
    });

    return proof;
  }

  async createBundle(params: BundleParams): Promise<BundleResult> {
    const bundleId = generateId('bundle');
    const sessionDir = path.join(this.config.basePath, params.sessionId);

    const bundlePath = path.join(this.config.basePath, '_bundles', `${params.sessionId}-${bundleId}.zip`);
    await fs.mkdir(path.dirname(bundlePath), { recursive: true });

    return new Promise(async (resolve, reject) => {
      const output = createWriteStream(bundlePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      let artifactCount = 0;

      output.on('close', async () => {
        const stats = await fs.stat(bundlePath);

        const result: BundleResult = {
          bundleId,
          sessionId: params.sessionId,
          path: bundlePath,
          size: stats.size,
          artifactCount,
          createdAt: new Date()
        };

        if (params.uploadToS3) {
          const s3Result = await this.uploadToS3(bundlePath);
          result.s3Url = s3Result.s3Url;
        }

        resolve(result);
      });

      archive.on('error', reject);
      archive.pipe(output);

      // Add files based on params
      try {
        const actions = params.actionIds || await this.getActionIds(params.sessionId);

        for (const actionId of actions) {
          const actionDir = path.join(sessionDir, actionId);

          try {
            const files = await fs.readdir(actionDir);

            for (const file of files) {
              const shouldInclude =
                (params.includeScreenshots && file.endsWith('.png')) ||
                (params.includeHar && file.endsWith('.har')) ||
                (params.includeConsoleLogs && file.includes('console'));

              if (shouldInclude) {
                archive.file(path.join(actionDir, file), { name: `${actionId}/${file}` });
                artifactCount++;
              }
            }
          } catch {
            // Action directory doesn't exist, skip
          }
        }

        archive.finalize();
      } catch (error) {
        reject(error);
      }
    });
  }

  async cleanupOldArtifacts(): Promise<{ deletedCount: number; freedBytes: number }> {
    const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    let freedBytes = 0;

    const sessions = await fs.readdir(this.config.basePath);

    for (const session of sessions) {
      if (session.startsWith('_')) continue; // Skip special directories

      const sessionPath = path.join(this.config.basePath, session);
      const stats = await fs.stat(sessionPath);

      if (stats.isDirectory() && stats.mtime < cutoffDate) {
        const size = await this.getDirectorySize(sessionPath);
        await fs.rm(sessionPath, { recursive: true, force: true });
        deletedCount++;
        freedBytes += size;
      }
    }

    logger.info('BrowserArtifacts: Cleanup complete', {
      deletedCount,
      freedBytes: `${(freedBytes / (1024 * 1024)).toFixed(2)}MB`
    });

    return { deletedCount, freedBytes };
  }

  async uploadToS3(localPath: string): Promise<{ s3Url: string }> {
    if (!this.s3Client || !this.config.s3Bucket) {
      throw new Error('S3 not configured');
    }

    const fileContent = await fs.readFile(localPath);
    const key = `artifacts/${path.basename(localPath)}`;

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
      Body: fileContent
    }));

    return {
      s3Url: `s3://${this.config.s3Bucket}/${key}`
    };
  }

  async listArtifacts(params: ListArtifactsParams): Promise<ArtifactMetadata[]> {
    const results: ArtifactMetadata[] = [];
    const sessionDir = path.join(this.config.basePath, params.sessionId);

    const actionIds = params.actionId
      ? [params.actionId]
      : await this.getActionIds(params.sessionId);

    for (const actionId of actionIds) {
      const actionDir = path.join(sessionDir, actionId);

      try {
        const files = await fs.readdir(actionDir);

        for (const file of files) {
          const type = this.getArtifactType(file);
          if (params.type && type !== params.type) continue;

          const filePath = path.join(actionDir, file);
          const stats = await fs.stat(filePath);

          results.push({
            id: file,
            type,
            sessionId: params.sessionId,
            actionId,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime
          });
        }
      } catch {
        // Action directory doesn't exist
      }
    }

    return results;
  }

  private getArtifactDir(sessionId: string, actionId: string): string {
    return path.join(this.config.basePath, sessionId, actionId);
  }

  private async getActionIds(sessionId: string): Promise<string[]> {
    const sessionDir = path.join(this.config.basePath, sessionId);

    try {
      const entries = await fs.readdir(sessionDir, { withFileTypes: true });
      return entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
      return [];
    }
  }

  private getArtifactType(filename: string): ArtifactMetadata['type'] {
    if (filename.endsWith('.png') || filename.endsWith('.jpg')) return 'screenshot';
    if (filename.endsWith('.har')) return 'har';
    if (filename.includes('console')) return 'console_log';
    if (filename.includes('proof')) return 'action_proof';
    return 'screenshot';
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    const files = await fs.readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        size += await this.getDirectorySize(filePath);
      } else {
        const stats = await fs.stat(filePath);
        size += stats.size;
      }
    }

    return size;
  }
}
```

#### 2.3 Create Factory and Export

```typescript
// packages/browser-lane/src/artifacts/index.ts

export * from './types';
export * from './browser-artifacts';

import { BrowserArtifacts } from './browser-artifacts';
import { ArtifactsConfig } from './types';

let artifactsInstance: BrowserArtifacts | null = null;

export function initializeArtifacts(config: ArtifactsConfig): BrowserArtifacts {
  artifactsInstance = new BrowserArtifacts(config);
  return artifactsInstance;
}

export function getBrowserArtifacts(): BrowserArtifacts {
  if (!artifactsInstance) {
    throw new Error('BrowserArtifacts not initialized');
  }
  return artifactsInstance;
}
```

### Phase 3: Verification

```bash
cd packages/browser-lane
pnpm test src/artifacts --reporter=verbose --coverage
pnpm typecheck
pnpm lint src/artifacts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/browser-lane/src/artifacts/types.ts` | Artifacts types |
| Create | `packages/browser-lane/src/artifacts/browser-artifacts.ts` | Main implementation |
| Create | `packages/browser-lane/src/artifacts/index.ts` | Public exports |
| Create | `packages/browser-lane/src/artifacts/__tests__/browser-artifacts.test.ts` | Unit tests |

---

## Acceptance Criteria

- [ ] Screenshot capture works (full page, element)
- [ ] HAR recording works
- [ ] Console log capture works
- [ ] Action proof creation works
- [ ] Artifact bundling works
- [ ] S3 upload works
- [ ] Artifact cleanup respects retention
- [ ] Artifact listing works
- [ ] Unit test coverage exceeds 80%

---

## JSON Task Block

```json
{
  "task_id": "S3-C5",
  "name": "Browser Artifacts",
  "status": "pending",
  "dependencies": ["S3-C1", "S3-C2"],
  "blocks": ["S3-D3"],
  "agent": "C",
  "sprint": 3,
  "complexity": "medium",
  "package": "@rtv/browser-lane",
  "files": [
    "packages/browser-lane/src/artifacts/types.ts",
    "packages/browser-lane/src/artifacts/browser-artifacts.ts",
    "packages/browser-lane/src/artifacts/index.ts"
  ],
  "test_files": [
    "packages/browser-lane/src/artifacts/__tests__/browser-artifacts.test.ts"
  ],
  "estimated_loc": 400,
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
      path: docs/06-reliability-ops/observability-spec.md
      sections: ["artifacts"]
    - type: spec
      path: docs/05-policy-safety/audit-spec.md
      sections: ["proof-capture"]
  summaries_to_create:
    - topic: "Browser artifacts system"
      scope: "screenshots, HAR, console logs, proof records"
  decisions_made: []
  blockers: []
  handoff_notes: null
```
