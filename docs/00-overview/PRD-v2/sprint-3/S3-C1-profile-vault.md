# Build Prompt: S3-C1 — Profile Vault

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S3-C1 |
| **Sprint** | 3 — Scheduling + Publishing |
| **Agent** | C — Browser Lane |
| **Task Name** | Profile Vault |
| **Complexity** | High |
| **Status** | Pending |
| **Estimated Effort** | 1.5 days |
| **Dependencies** | S0-B3, S1-A1 |
| **Blocks** | S3-C2, S3-C3, S3-C4 |

---

## Context

### What We're Building

A secure Profile Vault that manages browser profiles, session persistence, credential storage, and multi-tenant profile isolation for the browser automation lane.

### Why It Matters

Browser automation requires persistent sessions with cookies, local storage, and authentication state. The Profile Vault ensures each client's browser profiles are isolated, encrypted, and recoverable across automation runs.

### Spec References

- `docs/04-browser-lane/browser-automation-profile-vault.md` — Profile Vault design
- `docs/05-policy-safety/multi-tenant-isolation.md` — Tenant isolation requirements
- `docs/01-architecture/system-architecture-v3.md` — Security architecture
- `docs/02-schemas/external-memory-schema.md` — Storage patterns

---

## Prerequisites

### Completed Tasks

- [x] S0-B3: Multi-tenant schema
- [x] S1-A1: Client domain model

### Required Tools/Packages

```bash
pnpm add playwright @anthropic-ai/claude-code-runner
pnpm add crypto-js archiver unzipper
pnpm add -D vitest @types/archiver
```

### Required Infrastructure

- S3-compatible storage for profile archives
- Encryption keys in secure keyring
- Container runtime for browser isolation

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests before implementation.

#### 1.1 Create Profile Vault Test Suite

```typescript
// packages/browser-lane/src/profile-vault/__tests__/profile-vault.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProfileVault } from '../profile-vault';
import { ProfileVaultConfig, BrowserProfile, ProfileStatus } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ProfileVault', () => {
  let vault: ProfileVault;
  let tempDir: string;

  const testConfig: ProfileVaultConfig = {
    storageBackend: 'filesystem',
    basePath: '/tmp/profile-vault-test',
    encryptionKey: 'test-encryption-key-32-chars!!!',
    s3Bucket: 'test-bucket',
    s3Region: 'us-east-1'
  };

  beforeEach(async () => {
    tempDir = `/tmp/profile-vault-test-${Date.now()}`;
    await fs.mkdir(tempDir, { recursive: true });
    vault = new ProfileVault({ ...testConfig, basePath: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('createProfile', () => {
    it('should create a new browser profile', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Skool Account 1'
      });

      expect(profile.id).toBeDefined();
      expect(profile.clientId).toBe('client-123');
      expect(profile.platform).toBe('skool');
      expect(profile.status).toBe('active');
    });

    it('should create isolated profile directory', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'instagram',
        name: 'IG Account'
      });

      const profilePath = vault.getProfilePath(profile.id);
      const exists = await fs.stat(profilePath).then(() => true).catch(() => false);

      expect(exists).toBe(true);
    });

    it('should enforce tenant isolation', async () => {
      const profile1 = await vault.createProfile({
        clientId: 'client-A',
        platform: 'skool',
        name: 'Profile A'
      });

      const profile2 = await vault.createProfile({
        clientId: 'client-B',
        platform: 'skool',
        name: 'Profile B'
      });

      // Paths should be in separate client directories
      expect(vault.getProfilePath(profile1.id)).not.toContain('client-B');
      expect(vault.getProfilePath(profile2.id)).not.toContain('client-A');
    });
  });

  describe('getProfile', () => {
    it('should retrieve profile by ID', async () => {
      const created = await vault.createProfile({
        clientId: 'client-123',
        platform: 'facebook',
        name: 'FB Profile'
      });

      const retrieved = await vault.getProfile(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent profile', async () => {
      const result = await vault.getProfile('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should enforce client scope', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-A',
        platform: 'skool',
        name: 'Profile A'
      });

      // Should not be accessible from different client context
      await expect(vault.getProfile(profile.id, 'client-B'))
        .rejects.toThrow('Profile not found or access denied');
    });
  });

  describe('listProfiles', () => {
    it('should list all profiles for a client', async () => {
      await vault.createProfile({ clientId: 'client-1', platform: 'skool', name: 'P1' });
      await vault.createProfile({ clientId: 'client-1', platform: 'instagram', name: 'P2' });
      await vault.createProfile({ clientId: 'client-2', platform: 'skool', name: 'P3' });

      const profiles = await vault.listProfiles('client-1');

      expect(profiles).toHaveLength(2);
      expect(profiles.every(p => p.clientId === 'client-1')).toBe(true);
    });

    it('should filter by platform', async () => {
      await vault.createProfile({ clientId: 'client-1', platform: 'skool', name: 'P1' });
      await vault.createProfile({ clientId: 'client-1', platform: 'instagram', name: 'P2' });

      const profiles = await vault.listProfiles('client-1', { platform: 'skool' });

      expect(profiles).toHaveLength(1);
      expect(profiles[0].platform).toBe('skool');
    });

    it('should filter by status', async () => {
      const p1 = await vault.createProfile({ clientId: 'client-1', platform: 'skool', name: 'P1' });
      await vault.createProfile({ clientId: 'client-1', platform: 'instagram', name: 'P2' });
      await vault.archiveProfile(p1.id);

      const activeProfiles = await vault.listProfiles('client-1', { status: 'active' });

      expect(activeProfiles).toHaveLength(1);
      expect(activeProfiles[0].name).toBe('P2');
    });
  });

  describe('session persistence', () => {
    it('should save session data', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Skool Profile'
      });

      const sessionData = {
        cookies: [{ name: 'auth', value: 'token123', domain: '.skool.com' }],
        localStorage: { user: 'test@example.com' },
        sessionStorage: {}
      };

      await vault.saveSession(profile.id, sessionData);

      const loaded = await vault.loadSession(profile.id);

      expect(loaded.cookies).toHaveLength(1);
      expect(loaded.localStorage.user).toBe('test@example.com');
    });

    it('should encrypt sensitive session data', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      const sessionData = {
        cookies: [{ name: 'auth', value: 'secret-token', domain: '.skool.com' }],
        localStorage: {},
        sessionStorage: {}
      };

      await vault.saveSession(profile.id, sessionData);

      // Read raw file and verify it's encrypted
      const sessionPath = path.join(vault.getProfilePath(profile.id), 'session.enc');
      const rawContent = await fs.readFile(sessionPath, 'utf-8');

      expect(rawContent).not.toContain('secret-token');
    });

    it('should handle session not found', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      await expect(vault.loadSession(profile.id))
        .rejects.toThrow('No session data found');
    });
  });

  describe('profile backup and restore', () => {
    it('should create encrypted backup', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      await vault.saveSession(profile.id, {
        cookies: [{ name: 'test', value: 'value', domain: '.test.com' }],
        localStorage: { key: 'value' },
        sessionStorage: {}
      });

      const backup = await vault.createBackup(profile.id);

      expect(backup.archivePath).toBeDefined();
      expect(backup.checksum).toBeDefined();
      expect(backup.size).toBeGreaterThan(0);
    });

    it('should restore from backup', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      const originalSession = {
        cookies: [{ name: 'auth', value: 'original', domain: '.skool.com' }],
        localStorage: { data: 'important' },
        sessionStorage: {}
      };

      await vault.saveSession(profile.id, originalSession);
      const backup = await vault.createBackup(profile.id);

      // Modify session
      await vault.saveSession(profile.id, {
        cookies: [],
        localStorage: {},
        sessionStorage: {}
      });

      // Restore from backup
      await vault.restoreFromBackup(profile.id, backup.archivePath);
      const restored = await vault.loadSession(profile.id);

      expect(restored.cookies).toHaveLength(1);
      expect(restored.localStorage.data).toBe('important');
    });

    it('should upload backup to S3', async () => {
      const s3Mock = {
        upload: vi.fn().mockResolvedValue({ Location: 's3://bucket/backup.zip' })
      };
      vi.spyOn(vault as any, 's3Client', 'get').mockReturnValue(s3Mock);

      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      await vault.saveSession(profile.id, {
        cookies: [],
        localStorage: {},
        sessionStorage: {}
      });

      const backup = await vault.createBackup(profile.id, { uploadToS3: true });

      expect(backup.s3Location).toBeDefined();
    });
  });

  describe('profile lifecycle', () => {
    it('should archive profile', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      await vault.archiveProfile(profile.id);
      const updated = await vault.getProfile(profile.id);

      expect(updated!.status).toBe('archived');
    });

    it('should delete profile', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      await vault.deleteProfile(profile.id);

      const result = await vault.getProfile(profile.id);
      expect(result).toBeNull();
    });

    it('should require archive before delete for active profiles', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      await expect(vault.deleteProfile(profile.id))
        .rejects.toThrow('Profile must be archived before deletion');
    });

    it('should update last used timestamp', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      const before = profile.lastUsedAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      await vault.markProfileUsed(profile.id);

      const updated = await vault.getProfile(profile.id);

      expect(updated!.lastUsedAt.getTime()).toBeGreaterThan(before.getTime());
    });
  });

  describe('credential management', () => {
    it('should store encrypted credentials', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      await vault.setCredentials(profile.id, {
        username: 'test@example.com',
        password: 'super-secret'
      });

      const creds = await vault.getCredentials(profile.id);

      expect(creds.username).toBe('test@example.com');
      expect(creds.password).toBe('super-secret');
    });

    it('should store only credential reference in metadata', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      await vault.setCredentials(profile.id, {
        username: 'user',
        password: 'pass'
      });

      // Check raw profile metadata doesn't contain plaintext
      const metaPath = path.join(vault.getProfilePath(profile.id), 'profile.json');
      const metaContent = await fs.readFile(metaPath, 'utf-8');

      expect(metaContent).not.toContain('pass');
      expect(metaContent).toContain('credentialRef');
    });
  });

  describe('profile locking', () => {
    it('should acquire lock for exclusive access', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      const lock = await vault.acquireLock(profile.id, 'session-1');

      expect(lock.acquired).toBe(true);
      expect(lock.lockId).toBeDefined();
    });

    it('should prevent concurrent access', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      await vault.acquireLock(profile.id, 'session-1');

      const secondLock = await vault.acquireLock(profile.id, 'session-2');

      expect(secondLock.acquired).toBe(false);
      expect(secondLock.heldBy).toBe('session-1');
    });

    it('should release lock', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      const lock = await vault.acquireLock(profile.id, 'session-1');
      await vault.releaseLock(profile.id, lock.lockId);

      const newLock = await vault.acquireLock(profile.id, 'session-2');

      expect(newLock.acquired).toBe(true);
    });

    it('should auto-expire stale locks', async () => {
      const profile = await vault.createProfile({
        clientId: 'client-123',
        platform: 'skool',
        name: 'Profile'
      });

      // Create lock with short TTL
      await vault.acquireLock(profile.id, 'session-1', { ttlMs: 100 });

      await new Promise(resolve => setTimeout(resolve, 150));

      const newLock = await vault.acquireLock(profile.id, 'session-2');

      expect(newLock.acquired).toBe(true);
    });
  });
});
```

**Run tests to confirm they fail:**

```bash
cd packages/browser-lane
pnpm test src/profile-vault --reporter=verbose
```

### Phase 2: Implementation

#### 2.1 Create Profile Vault Types

```typescript
// packages/browser-lane/src/profile-vault/types.ts

import { z } from 'zod';

export const ProfileVaultConfigSchema = z.object({
  storageBackend: z.enum(['filesystem', 's3', 'hybrid']).default('hybrid'),
  basePath: z.string(),
  encryptionKey: z.string().min(32),
  s3Bucket: z.string().optional(),
  s3Region: z.string().default('us-east-1'),
  s3Endpoint: z.string().optional()
});

export type ProfileVaultConfig = z.infer<typeof ProfileVaultConfigSchema>;

export const ProfileStatusSchema = z.enum([
  'active',
  'locked',
  'archived',
  'suspended'
]);

export type ProfileStatus = z.infer<typeof ProfileStatusSchema>;

export const PlatformSchema = z.enum([
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'x',
  'skool',
  'google_business'
]);

export type Platform = z.infer<typeof PlatformSchema>;

export interface BrowserProfile {
  id: string;
  clientId: string;
  platform: Platform;
  name: string;
  status: ProfileStatus;
  credentialRef?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
  lastBackupAt?: Date;
  metadata?: Record<string, any>;
}

export interface CreateProfileParams {
  clientId: string;
  platform: Platform;
  name: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  metadata?: Record<string, any>;
}

export interface SessionData {
  cookies: Cookie[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  indexedDB?: any;
}

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface ProfileCredentials {
  username: string;
  password: string;
  mfaSecret?: string;
  recoveryEmail?: string;
}

export interface BackupResult {
  profileId: string;
  archivePath: string;
  checksum: string;
  size: number;
  createdAt: Date;
  s3Location?: string;
}

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  heldBy?: string;
  expiresAt?: Date;
}

export interface ListProfilesOptions {
  platform?: Platform;
  status?: ProfileStatus;
  limit?: number;
  offset?: number;
}
```

#### 2.2 Implement Profile Vault

```typescript
// packages/browser-lane/src/profile-vault/profile-vault.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import archiver from 'archiver';
import unzipper from 'unzipper';
import { createWriteStream, createReadStream } from 'fs';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  ProfileVaultConfig,
  ProfileVaultConfigSchema,
  BrowserProfile,
  CreateProfileParams,
  SessionData,
  ProfileCredentials,
  BackupResult,
  LockResult,
  ListProfilesOptions,
  ProfileStatus
} from './types';
import { logger } from '@rtv/observability';
import { generateId } from '@rtv/core';

export class ProfileVault {
  private readonly config: ProfileVaultConfig;
  private readonly s3Client: S3Client | null;
  private readonly locks: Map<string, { lockId: string; sessionId: string; expiresAt: Date }>;

  constructor(config: ProfileVaultConfig) {
    this.config = ProfileVaultConfigSchema.parse(config);
    this.locks = new Map();

    if (config.storageBackend !== 'filesystem' && config.s3Bucket) {
      this.s3Client = new S3Client({
        region: config.s3Region,
        endpoint: config.s3Endpoint
      });
    } else {
      this.s3Client = null;
    }
  }

  async createProfile(params: CreateProfileParams): Promise<BrowserProfile> {
    const id = generateId('profile');
    const now = new Date();

    const profile: BrowserProfile = {
      id,
      clientId: params.clientId,
      platform: params.platform,
      name: params.name,
      status: 'active',
      userAgent: params.userAgent,
      viewport: params.viewport || { width: 1920, height: 1080 },
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
      metadata: params.metadata
    };

    // Create profile directory
    const profilePath = this.getProfilePath(id, params.clientId);
    await fs.mkdir(profilePath, { recursive: true });

    // Save profile metadata
    await this.saveProfileMetadata(profile);

    logger.info('ProfileVault: Created profile', {
      profileId: id,
      clientId: params.clientId,
      platform: params.platform
    });

    return profile;
  }

  async getProfile(
    profileId: string,
    clientId?: string
  ): Promise<BrowserProfile | null> {
    try {
      // Find profile directory
      const profileDir = await this.findProfileDirectory(profileId);
      if (!profileDir) return null;

      const metaPath = path.join(profileDir, 'profile.json');
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const profile = JSON.parse(metaContent) as BrowserProfile;

      // Enforce tenant isolation
      if (clientId && profile.clientId !== clientId) {
        throw new Error('Profile not found or access denied');
      }

      // Parse dates
      profile.createdAt = new Date(profile.createdAt);
      profile.updatedAt = new Date(profile.updatedAt);
      profile.lastUsedAt = new Date(profile.lastUsedAt);
      if (profile.lastBackupAt) {
        profile.lastBackupAt = new Date(profile.lastBackupAt);
      }

      return profile;
    } catch (error) {
      if ((error as Error).message.includes('access denied')) {
        throw error;
      }
      return null;
    }
  }

  async listProfiles(
    clientId: string,
    options: ListProfilesOptions = {}
  ): Promise<BrowserProfile[]> {
    const clientPath = path.join(this.config.basePath, clientId);

    try {
      await fs.access(clientPath);
    } catch {
      return [];
    }

    const entries = await fs.readdir(clientPath, { withFileTypes: true });
    const profiles: BrowserProfile[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const profile = await this.getProfile(entry.name, clientId);
      if (!profile) continue;

      // Apply filters
      if (options.platform && profile.platform !== options.platform) continue;
      if (options.status && profile.status !== options.status) continue;

      profiles.push(profile);
    }

    // Apply pagination
    const start = options.offset || 0;
    const end = options.limit ? start + options.limit : undefined;

    return profiles.slice(start, end);
  }

  getProfilePath(profileId: string, clientId?: string): string {
    if (clientId) {
      return path.join(this.config.basePath, clientId, profileId);
    }
    // If clientId not provided, we need to find it
    // This is a simplified version - real impl would search
    return path.join(this.config.basePath, 'unknown', profileId);
  }

  private async findProfileDirectory(profileId: string): Promise<string | null> {
    const basePath = this.config.basePath;

    try {
      const clients = await fs.readdir(basePath, { withFileTypes: true });

      for (const client of clients) {
        if (!client.isDirectory()) continue;

        const profilePath = path.join(basePath, client.name, profileId);
        try {
          await fs.access(profilePath);
          return profilePath;
        } catch {
          continue;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async saveSession(profileId: string, sessionData: SessionData): Promise<void> {
    const profileDir = await this.findProfileDirectory(profileId);
    if (!profileDir) {
      throw new Error(`Profile ${profileId} not found`);
    }

    const encrypted = this.encrypt(JSON.stringify(sessionData));
    const sessionPath = path.join(profileDir, 'session.enc');

    await fs.writeFile(sessionPath, encrypted, 'utf-8');

    logger.debug('ProfileVault: Saved session', { profileId });
  }

  async loadSession(profileId: string): Promise<SessionData> {
    const profileDir = await this.findProfileDirectory(profileId);
    if (!profileDir) {
      throw new Error(`Profile ${profileId} not found`);
    }

    const sessionPath = path.join(profileDir, 'session.enc');

    try {
      const encrypted = await fs.readFile(sessionPath, 'utf-8');
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error('No session data found');
    }
  }

  async setCredentials(
    profileId: string,
    credentials: ProfileCredentials
  ): Promise<void> {
    const profileDir = await this.findProfileDirectory(profileId);
    if (!profileDir) {
      throw new Error(`Profile ${profileId} not found`);
    }

    const credRef = `cred:${profileId}:${Date.now()}`;
    const encrypted = this.encrypt(JSON.stringify(credentials));
    const credPath = path.join(profileDir, 'credentials.enc');

    await fs.writeFile(credPath, encrypted, 'utf-8');

    // Update profile metadata with reference only
    const profile = await this.getProfile(profileId);
    if (profile) {
      profile.credentialRef = credRef;
      profile.updatedAt = new Date();
      await this.saveProfileMetadata(profile);
    }

    logger.info('ProfileVault: Updated credentials', { profileId });
  }

  async getCredentials(profileId: string): Promise<ProfileCredentials> {
    const profileDir = await this.findProfileDirectory(profileId);
    if (!profileDir) {
      throw new Error(`Profile ${profileId} not found`);
    }

    const credPath = path.join(profileDir, 'credentials.enc');

    try {
      const encrypted = await fs.readFile(credPath, 'utf-8');
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch {
      throw new Error('No credentials found');
    }
  }

  async createBackup(
    profileId: string,
    options: { uploadToS3?: boolean } = {}
  ): Promise<BackupResult> {
    const profileDir = await this.findProfileDirectory(profileId);
    if (!profileDir) {
      throw new Error(`Profile ${profileId} not found`);
    }

    const backupDir = path.join(this.config.basePath, '_backups');
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = Date.now();
    const archivePath = path.join(backupDir, `${profileId}-${timestamp}.zip`);

    // Create encrypted zip archive
    await this.createArchive(profileDir, archivePath);

    const stats = await fs.stat(archivePath);
    const checksum = await this.calculateChecksum(archivePath);

    const result: BackupResult = {
      profileId,
      archivePath,
      checksum,
      size: stats.size,
      createdAt: new Date()
    };

    // Upload to S3 if requested
    if (options.uploadToS3 && this.s3Client) {
      const s3Key = `profiles/${profileId}/backups/${path.basename(archivePath)}`;
      const fileContent = await fs.readFile(archivePath);

      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: s3Key,
        Body: fileContent
      }));

      result.s3Location = `s3://${this.config.s3Bucket}/${s3Key}`;
    }

    // Update profile metadata
    const profile = await this.getProfile(profileId);
    if (profile) {
      profile.lastBackupAt = new Date();
      await this.saveProfileMetadata(profile);
    }

    logger.info('ProfileVault: Created backup', {
      profileId,
      size: stats.size,
      s3: !!result.s3Location
    });

    return result;
  }

  async restoreFromBackup(
    profileId: string,
    archivePath: string
  ): Promise<void> {
    const profileDir = await this.findProfileDirectory(profileId);
    if (!profileDir) {
      throw new Error(`Profile ${profileId} not found`);
    }

    // Extract archive to profile directory
    await this.extractArchive(archivePath, profileDir);

    logger.info('ProfileVault: Restored from backup', { profileId });
  }

  async archiveProfile(profileId: string): Promise<void> {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    profile.status = 'archived';
    profile.updatedAt = new Date();
    await this.saveProfileMetadata(profile);

    // Create backup before archiving
    await this.createBackup(profileId, { uploadToS3: true });

    logger.info('ProfileVault: Archived profile', { profileId });
  }

  async deleteProfile(profileId: string): Promise<void> {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    if (profile.status === 'active') {
      throw new Error('Profile must be archived before deletion');
    }

    const profileDir = await this.findProfileDirectory(profileId);
    if (profileDir) {
      await fs.rm(profileDir, { recursive: true, force: true });
    }

    logger.info('ProfileVault: Deleted profile', { profileId });
  }

  async markProfileUsed(profileId: string): Promise<void> {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    profile.lastUsedAt = new Date();
    profile.updatedAt = new Date();
    await this.saveProfileMetadata(profile);
  }

  async acquireLock(
    profileId: string,
    sessionId: string,
    options: { ttlMs?: number } = {}
  ): Promise<LockResult> {
    const ttlMs = options.ttlMs || 30 * 60 * 1000; // 30 minutes default
    const now = new Date();

    const existingLock = this.locks.get(profileId);

    // Check if existing lock is still valid
    if (existingLock && existingLock.expiresAt > now) {
      if (existingLock.sessionId === sessionId) {
        // Same session, extend lock
        existingLock.expiresAt = new Date(now.getTime() + ttlMs);
        return {
          acquired: true,
          lockId: existingLock.lockId,
          expiresAt: existingLock.expiresAt
        };
      }
      return {
        acquired: false,
        heldBy: existingLock.sessionId,
        expiresAt: existingLock.expiresAt
      };
    }

    // Create new lock
    const lockId = generateId('lock');
    const expiresAt = new Date(now.getTime() + ttlMs);

    this.locks.set(profileId, { lockId, sessionId, expiresAt });

    logger.debug('ProfileVault: Lock acquired', { profileId, sessionId, lockId });

    return {
      acquired: true,
      lockId,
      expiresAt
    };
  }

  async releaseLock(profileId: string, lockId: string): Promise<void> {
    const existingLock = this.locks.get(profileId);

    if (existingLock?.lockId === lockId) {
      this.locks.delete(profileId);
      logger.debug('ProfileVault: Lock released', { profileId, lockId });
    }
  }

  private async saveProfileMetadata(profile: BrowserProfile): Promise<void> {
    const profileDir = await this.findProfileDirectory(profile.id) ||
      this.getProfilePath(profile.id, profile.clientId);

    await fs.mkdir(profileDir, { recursive: true });
    const metaPath = path.join(profileDir, 'profile.json');
    await fs.writeFile(metaPath, JSON.stringify(profile, null, 2), 'utf-8');
  }

  private encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(data: string): string {
    const [ivHex, encrypted] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private async createArchive(sourceDir: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(targetPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  private async extractArchive(archivePath: string, targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      createReadStream(archivePath)
        .pipe(unzipper.Extract({ path: targetDir }))
        .on('close', () => resolve())
        .on('error', reject);
    });
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

#### 2.3 Create Factory and Export

```typescript
// packages/browser-lane/src/profile-vault/index.ts

export * from './types';
export * from './profile-vault';

import { ProfileVault } from './profile-vault';
import { ProfileVaultConfig } from './types';

let vaultInstance: ProfileVault | null = null;

export function initializeProfileVault(config: ProfileVaultConfig): ProfileVault {
  vaultInstance = new ProfileVault(config);
  return vaultInstance;
}

export function getProfileVault(): ProfileVault {
  if (!vaultInstance) {
    throw new Error('ProfileVault not initialized. Call initializeProfileVault first.');
  }
  return vaultInstance;
}
```

### Phase 3: Verification

```bash
# Unit tests
cd packages/browser-lane
pnpm test src/profile-vault --reporter=verbose --coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint src/profile-vault
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/browser-lane/src/profile-vault/types.ts` | Profile Vault types |
| Create | `packages/browser-lane/src/profile-vault/profile-vault.ts` | Main implementation |
| Create | `packages/browser-lane/src/profile-vault/index.ts` | Public exports |
| Create | `packages/browser-lane/src/profile-vault/__tests__/profile-vault.test.ts` | Unit tests |

---

## Acceptance Criteria

- [ ] Profile CRUD operations work
- [ ] Session data persisted and encrypted
- [ ] Credentials stored with encryption
- [ ] Backup/restore functionality works
- [ ] S3 backup upload works
- [ ] Tenant isolation enforced
- [ ] Profile locking prevents concurrent access
- [ ] Lock auto-expiration works
- [ ] Unit test coverage exceeds 80%

---

## JSON Task Block

```json
{
  "task_id": "S3-C1",
  "name": "Profile Vault",
  "status": "pending",
  "dependencies": ["S0-B3", "S1-A1"],
  "blocks": ["S3-C2", "S3-C3", "S3-C4"],
  "agent": "C",
  "sprint": 3,
  "complexity": "high",
  "package": "@rtv/browser-lane",
  "files": [
    "packages/browser-lane/src/profile-vault/types.ts",
    "packages/browser-lane/src/profile-vault/profile-vault.ts",
    "packages/browser-lane/src/profile-vault/index.ts"
  ],
  "test_files": [
    "packages/browser-lane/src/profile-vault/__tests__/profile-vault.test.ts"
  ],
  "estimated_loc": 600,
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
      sections: ["profile-management", "encryption"]
    - type: spec
      path: docs/05-policy-safety/multi-tenant-isolation.md
      sections: ["data-isolation"]
  summaries_to_create:
    - topic: "Profile Vault encryption patterns"
      scope: "AES-256, session data, credentials"
  decisions_made: []
  blockers: []
  handoff_notes: null
```
