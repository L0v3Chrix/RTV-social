# Build Prompt: S3-C2 — Browser Isolation

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S3-C2 |
| **Sprint** | 3 — Scheduling + Publishing |
| **Agent** | C — Browser Lane |
| **Task Name** | Browser Isolation |
| **Complexity** | High |
| **Status** | Pending |
| **Estimated Effort** | 1.5 days |
| **Dependencies** | S3-C1 |
| **Blocks** | S3-C3, S3-C4 |

---

## Context

### What We're Building

A browser isolation layer using Playwright that provides secure, isolated browser contexts per client with fingerprint randomization, proxy support, and anti-detection measures.

### Why It Matters

Browser automation must avoid detection to maintain platform access. Each client needs isolated contexts that don't leak information between tenants and appear as legitimate human-operated browsers.

### Spec References

- `docs/04-browser-lane/browser-automation-profile-vault.md` — Browser isolation requirements
- `docs/05-policy-safety/multi-tenant-isolation.md` — Tenant isolation
- `docs/01-architecture/system-architecture-v3.md` — Security architecture

---

## Prerequisites

### Completed Tasks

- [x] S3-C1: Profile Vault

### Required Tools/Packages

```bash
pnpm add playwright playwright-extra puppeteer-extra-plugin-stealth
pnpm add fingerprint-generator fingerprint-injector
pnpm add -D vitest @types/node
```

### Required Infrastructure

- Container runtime for browser sandboxing
- Proxy service for IP rotation (optional)

---

## Instructions

### Phase 1: Test First (TDD)

Create failing tests before implementation.

#### 1.1 Create Browser Isolation Test Suite

```typescript
// packages/browser-lane/src/browser-isolation/__tests__/browser-isolation.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserIsolation } from '../browser-isolation';
import { IsolationConfig, BrowserContext } from '../types';

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        addInitScript: vi.fn(),
        setExtraHTTPHeaders: vi.fn(),
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn(),
          close: vi.fn()
        }),
        close: vi.fn(),
        cookies: vi.fn().mockResolvedValue([]),
        storageState: vi.fn().mockResolvedValue({ cookies: [], origins: [] })
      }),
      close: vi.fn()
    })
  }
}));

describe('BrowserIsolation', () => {
  let isolation: BrowserIsolation;

  const testConfig: IsolationConfig = {
    profileVaultPath: '/tmp/test-vault',
    headless: true,
    defaultTimeout: 30000,
    enableStealth: true,
    fingerprintOptions: {
      devices: ['desktop'],
      browsers: ['chrome'],
      operatingSystems: ['windows', 'macos']
    }
  };

  beforeEach(() => {
    isolation = new BrowserIsolation(testConfig);
  });

  afterEach(async () => {
    await isolation.shutdown();
    vi.clearAllMocks();
  });

  describe('createContext', () => {
    it('should create isolated browser context', async () => {
      const context = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456'
      });

      expect(context.id).toBeDefined();
      expect(context.clientId).toBe('client-123');
      expect(context.profileId).toBe('profile-456');
    });

    it('should apply fingerprint to context', async () => {
      const context = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456'
      });

      expect(context.fingerprint).toBeDefined();
      expect(context.fingerprint.userAgent).toBeDefined();
      expect(context.fingerprint.viewport).toBeDefined();
    });

    it('should isolate contexts between clients', async () => {
      const context1 = await isolation.createContext({
        clientId: 'client-A',
        profileId: 'profile-1'
      });

      const context2 = await isolation.createContext({
        clientId: 'client-B',
        profileId: 'profile-2'
      });

      expect(context1.id).not.toBe(context2.id);
      expect(context1.fingerprint.userAgent).not.toBe(context2.fingerprint.userAgent);
    });

    it('should reuse fingerprint for same profile', async () => {
      const context1 = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456'
      });

      await isolation.destroyContext(context1.id);

      const context2 = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456'
      });

      expect(context1.fingerprint.userAgent).toBe(context2.fingerprint.userAgent);
    });
  });

  describe('proxy support', () => {
    it('should configure proxy when provided', async () => {
      const context = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456',
        proxy: {
          server: 'http://proxy.example.com:8080',
          username: 'user',
          password: 'pass'
        }
      });

      expect(context.proxy).toBeDefined();
      expect(context.proxy?.server).toBe('http://proxy.example.com:8080');
    });

    it('should rotate proxy on request', async () => {
      const proxyRotator = vi.fn()
        .mockResolvedValueOnce({ server: 'http://proxy1.example.com:8080' })
        .mockResolvedValueOnce({ server: 'http://proxy2.example.com:8080' });

      const isolationWithRotation = new BrowserIsolation({
        ...testConfig,
        proxyRotator
      });

      const context = await isolationWithRotation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456',
        rotateProxy: true
      });

      await isolationWithRotation.rotateProxy(context.id);

      expect(proxyRotator).toHaveBeenCalledTimes(2);
    });
  });

  describe('stealth mode', () => {
    it('should apply stealth plugins when enabled', async () => {
      const context = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456'
      });

      expect(context.stealthEnabled).toBe(true);
    });

    it('should inject anti-detection scripts', async () => {
      const context = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456'
      });

      // Verify stealth scripts were added
      expect(context.antiDetectionApplied).toBe(true);
    });
  });

  describe('context lifecycle', () => {
    it('should track active contexts', async () => {
      const context1 = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-1'
      });

      const context2 = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-2'
      });

      expect(isolation.getActiveContextCount()).toBe(2);

      await isolation.destroyContext(context1.id);

      expect(isolation.getActiveContextCount()).toBe(1);
    });

    it('should persist session on context destroy', async () => {
      const saveSpy = vi.spyOn(isolation as any, 'saveContextSession');

      const context = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456'
      });

      await isolation.destroyContext(context.id, { saveSession: true });

      expect(saveSpy).toHaveBeenCalledWith(context.id);
    });

    it('should handle context timeout', async () => {
      const context = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456',
        maxLifetimeMs: 100
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const activeContext = isolation.getContext(context.id);
      expect(activeContext).toBeNull();
    });
  });

  describe('page management', () => {
    it('should create page within context', async () => {
      const context = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456'
      });

      const page = await isolation.createPage(context.id);

      expect(page).toBeDefined();
    });

    it('should limit pages per context', async () => {
      const context = await isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456',
        maxPages: 2
      });

      await isolation.createPage(context.id);
      await isolation.createPage(context.id);

      await expect(isolation.createPage(context.id))
        .rejects.toThrow('Maximum pages reached');
    });
  });

  describe('fingerprint generation', () => {
    it('should generate consistent fingerprint for profile', async () => {
      const fp1 = await isolation.generateFingerprint('profile-123');
      const fp2 = await isolation.generateFingerprint('profile-123');

      expect(fp1.userAgent).toBe(fp2.userAgent);
      expect(fp1.viewport.width).toBe(fp2.viewport.width);
    });

    it('should generate unique fingerprint for different profiles', async () => {
      const fp1 = await isolation.generateFingerprint('profile-A');
      const fp2 = await isolation.generateFingerprint('profile-B');

      expect(fp1.userAgent).not.toBe(fp2.userAgent);
    });

    it('should respect fingerprint options', async () => {
      const isolation = new BrowserIsolation({
        ...testConfig,
        fingerprintOptions: {
          devices: ['mobile'],
          browsers: ['chrome'],
          operatingSystems: ['android']
        }
      });

      const fp = await isolation.generateFingerprint('profile-123');

      expect(fp.device).toBe('mobile');
    });
  });

  describe('resource limits', () => {
    it('should enforce max contexts per client', async () => {
      const limitedIsolation = new BrowserIsolation({
        ...testConfig,
        maxContextsPerClient: 2
      });

      await limitedIsolation.createContext({ clientId: 'client-1', profileId: 'p1' });
      await limitedIsolation.createContext({ clientId: 'client-1', profileId: 'p2' });

      await expect(limitedIsolation.createContext({
        clientId: 'client-1',
        profileId: 'p3'
      })).rejects.toThrow('Maximum contexts reached');
    });

    it('should enforce global context limit', async () => {
      const limitedIsolation = new BrowserIsolation({
        ...testConfig,
        maxTotalContexts: 3
      });

      await limitedIsolation.createContext({ clientId: 'c1', profileId: 'p1' });
      await limitedIsolation.createContext({ clientId: 'c2', profileId: 'p2' });
      await limitedIsolation.createContext({ clientId: 'c3', profileId: 'p3' });

      await expect(limitedIsolation.createContext({
        clientId: 'c4',
        profileId: 'p4'
      })).rejects.toThrow('Global context limit reached');
    });
  });

  describe('error handling', () => {
    it('should handle browser launch failure', async () => {
      const { chromium } = await import('playwright');
      vi.mocked(chromium.launch).mockRejectedValueOnce(new Error('Launch failed'));

      await expect(isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456'
      })).rejects.toThrow('Failed to create browser context');
    });

    it('should cleanup on context creation failure', async () => {
      const { chromium } = await import('playwright');
      const mockBrowser = {
        newContext: vi.fn().mockRejectedValue(new Error('Context creation failed')),
        close: vi.fn()
      };
      vi.mocked(chromium.launch).mockResolvedValueOnce(mockBrowser as any);

      await expect(isolation.createContext({
        clientId: 'client-123',
        profileId: 'profile-456'
      })).rejects.toThrow();

      // Should have attempted cleanup
      expect(isolation.getActiveContextCount()).toBe(0);
    });
  });
});
```

**Run tests to confirm they fail:**

```bash
cd packages/browser-lane
pnpm test src/browser-isolation --reporter=verbose
```

### Phase 2: Implementation

#### 2.1 Create Browser Isolation Types

```typescript
// packages/browser-lane/src/browser-isolation/types.ts

import { z } from 'zod';

export const FingerprintOptionsSchema = z.object({
  devices: z.array(z.enum(['desktop', 'mobile', 'tablet'])).default(['desktop']),
  browsers: z.array(z.enum(['chrome', 'firefox', 'safari', 'edge'])).default(['chrome']),
  operatingSystems: z.array(z.enum(['windows', 'macos', 'linux', 'android', 'ios']))
    .default(['windows', 'macos']),
  locales: z.array(z.string()).default(['en-US'])
});

export type FingerprintOptions = z.infer<typeof FingerprintOptionsSchema>;

export const ProxyConfigSchema = z.object({
  server: z.string(),
  username: z.string().optional(),
  password: z.string().optional(),
  bypass: z.array(z.string()).optional()
});

export type ProxyConfig = z.infer<typeof ProxyConfigSchema>;

export const IsolationConfigSchema = z.object({
  profileVaultPath: z.string(),
  headless: z.boolean().default(true),
  defaultTimeout: z.number().default(30000),
  enableStealth: z.boolean().default(true),
  fingerprintOptions: FingerprintOptionsSchema.optional(),
  maxContextsPerClient: z.number().default(5),
  maxTotalContexts: z.number().default(50),
  proxyRotator: z.function().optional()
});

export type IsolationConfig = z.infer<typeof IsolationConfigSchema>;

export interface Fingerprint {
  userAgent: string;
  viewport: { width: number; height: number };
  device: 'desktop' | 'mobile' | 'tablet';
  platform: string;
  language: string;
  timezone: string;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  webgl: {
    vendor: string;
    renderer: string;
  };
  fonts: string[];
  canvas: string;
  audioContext: string;
}

export interface CreateContextOptions {
  clientId: string;
  profileId: string;
  proxy?: ProxyConfig;
  rotateProxy?: boolean;
  maxPages?: number;
  maxLifetimeMs?: number;
}

export interface BrowserContext {
  id: string;
  clientId: string;
  profileId: string;
  fingerprint: Fingerprint;
  proxy?: ProxyConfig;
  stealthEnabled: boolean;
  antiDetectionApplied: boolean;
  createdAt: Date;
  maxLifetimeMs?: number;
  pageCount: number;
  maxPages: number;
}

export interface ContextSession {
  cookies: any[];
  localStorage: Record<string, Record<string, string>>;
  sessionStorage: Record<string, Record<string, string>>;
}
```

#### 2.2 Implement Browser Isolation

```typescript
// packages/browser-lane/src/browser-isolation/browser-isolation.ts

import { chromium, Browser, BrowserContext as PlaywrightContext, Page } from 'playwright';
import { FingerprintGenerator } from 'fingerprint-generator';
import { FingerprintInjector } from 'fingerprint-injector';
import {
  IsolationConfig,
  IsolationConfigSchema,
  CreateContextOptions,
  BrowserContext,
  Fingerprint,
  ContextSession,
  ProxyConfig
} from './types';
import { getProfileVault } from '../profile-vault';
import { logger } from '@rtv/observability';
import { generateId } from '@rtv/core';
import * as crypto from 'crypto';

export class BrowserIsolation {
  private readonly config: IsolationConfig;
  private readonly fingerprintGenerator: FingerprintGenerator;
  private browser: Browser | null = null;
  private contexts: Map<string, {
    context: PlaywrightContext;
    metadata: BrowserContext;
    pages: Set<Page>;
    timeoutId?: NodeJS.Timeout;
  }> = new Map();
  private fingerprintCache: Map<string, Fingerprint> = new Map();

  constructor(config: IsolationConfig) {
    this.config = IsolationConfigSchema.parse(config);
    this.fingerprintGenerator = new FingerprintGenerator({
      devices: this.config.fingerprintOptions?.devices || ['desktop'],
      browsers: this.config.fingerprintOptions?.browsers?.map(b =>
        b === 'chrome' ? 'chrome' : b
      ) || ['chrome'],
      operatingSystems: this.config.fingerprintOptions?.operatingSystems || ['windows', 'macos']
    });
  }

  async createContext(options: CreateContextOptions): Promise<BrowserContext> {
    // Check limits
    await this.enforceContextLimits(options.clientId);

    // Get or generate fingerprint
    const fingerprint = await this.generateFingerprint(options.profileId);

    // Ensure browser is launched
    if (!this.browser) {
      await this.launchBrowser();
    }

    try {
      // Get proxy if needed
      let proxy = options.proxy;
      if (options.rotateProxy && this.config.proxyRotator) {
        proxy = await this.config.proxyRotator();
      }

      // Create Playwright context with fingerprint
      const contextOptions: any = {
        userAgent: fingerprint.userAgent,
        viewport: fingerprint.viewport,
        locale: fingerprint.language,
        timezoneId: fingerprint.timezone,
        deviceScaleFactor: fingerprint.screen.pixelRatio,
        hasTouch: fingerprint.device !== 'desktop',
        isMobile: fingerprint.device === 'mobile'
      };

      if (proxy) {
        contextOptions.proxy = {
          server: proxy.server,
          username: proxy.username,
          password: proxy.password,
          bypass: proxy.bypass?.join(',')
        };
      }

      // Load existing session if available
      const vault = getProfileVault();
      try {
        const sessionData = await vault.loadSession(options.profileId);
        contextOptions.storageState = {
          cookies: sessionData.cookies,
          origins: Object.entries(sessionData.localStorage).map(([origin, storage]) => ({
            origin,
            localStorage: Object.entries(storage).map(([name, value]) => ({ name, value }))
          }))
        };
      } catch {
        // No existing session, continue with fresh context
      }

      const playwrightContext = await this.browser!.newContext(contextOptions);

      // Apply stealth if enabled
      if (this.config.enableStealth) {
        await this.applyStealthMeasures(playwrightContext, fingerprint);
      }

      const contextId = generateId('ctx');
      const metadata: BrowserContext = {
        id: contextId,
        clientId: options.clientId,
        profileId: options.profileId,
        fingerprint,
        proxy,
        stealthEnabled: this.config.enableStealth,
        antiDetectionApplied: this.config.enableStealth,
        createdAt: new Date(),
        maxLifetimeMs: options.maxLifetimeMs,
        pageCount: 0,
        maxPages: options.maxPages || 5
      };

      // Set up auto-destroy if lifetime specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (options.maxLifetimeMs) {
        timeoutId = setTimeout(() => {
          this.destroyContext(contextId).catch(err => {
            logger.error('Failed to auto-destroy context', { contextId, error: err });
          });
        }, options.maxLifetimeMs);
      }

      this.contexts.set(contextId, {
        context: playwrightContext,
        metadata,
        pages: new Set(),
        timeoutId
      });

      logger.info('BrowserIsolation: Created context', {
        contextId,
        clientId: options.clientId,
        profileId: options.profileId
      });

      return metadata;
    } catch (error) {
      logger.error('BrowserIsolation: Failed to create context', { error });
      throw new Error(`Failed to create browser context: ${(error as Error).message}`);
    }
  }

  async destroyContext(
    contextId: string,
    options: { saveSession?: boolean } = {}
  ): Promise<void> {
    const entry = this.contexts.get(contextId);
    if (!entry) return;

    // Clear timeout if exists
    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }

    // Save session if requested
    if (options.saveSession) {
      await this.saveContextSession(contextId);
    }

    // Close all pages
    for (const page of entry.pages) {
      await page.close().catch(() => {});
    }

    // Close context
    await entry.context.close();

    this.contexts.delete(contextId);

    logger.info('BrowserIsolation: Destroyed context', { contextId });
  }

  getContext(contextId: string): BrowserContext | null {
    return this.contexts.get(contextId)?.metadata || null;
  }

  getActiveContextCount(): number {
    return this.contexts.size;
  }

  async createPage(contextId: string): Promise<Page> {
    const entry = this.contexts.get(contextId);
    if (!entry) {
      throw new Error(`Context ${contextId} not found`);
    }

    if (entry.metadata.pageCount >= entry.metadata.maxPages) {
      throw new Error('Maximum pages reached for this context');
    }

    const page = await entry.context.newPage();
    entry.pages.add(page);
    entry.metadata.pageCount++;

    // Clean up when page closes
    page.on('close', () => {
      entry.pages.delete(page);
      entry.metadata.pageCount--;
    });

    return page;
  }

  async generateFingerprint(profileId: string): Promise<Fingerprint> {
    // Check cache first
    const cached = this.fingerprintCache.get(profileId);
    if (cached) return cached;

    // Generate deterministic fingerprint based on profile ID
    const seed = crypto.createHash('sha256').update(profileId).digest('hex');
    const seedNum = parseInt(seed.substring(0, 8), 16);

    // Use seed to generate consistent fingerprint
    const rawFingerprint = this.fingerprintGenerator.getFingerprint({
      // Use seed for deterministic generation
    });

    const fingerprint: Fingerprint = {
      userAgent: rawFingerprint.fingerprint.navigator.userAgent,
      viewport: {
        width: rawFingerprint.fingerprint.screen.width,
        height: rawFingerprint.fingerprint.screen.height
      },
      device: this.config.fingerprintOptions?.devices?.[0] || 'desktop',
      platform: rawFingerprint.fingerprint.navigator.platform,
      language: rawFingerprint.fingerprint.navigator.language,
      timezone: 'America/New_York', // TODO: randomize based on seed
      screen: {
        width: rawFingerprint.fingerprint.screen.width,
        height: rawFingerprint.fingerprint.screen.height,
        colorDepth: rawFingerprint.fingerprint.screen.colorDepth,
        pixelRatio: rawFingerprint.fingerprint.screen.pixelRatio
      },
      webgl: {
        vendor: rawFingerprint.fingerprint.webGl.vendor,
        renderer: rawFingerprint.fingerprint.webGl.renderer
      },
      fonts: rawFingerprint.fingerprint.fonts || [],
      canvas: seed.substring(0, 16), // Deterministic canvas hash
      audioContext: seed.substring(16, 32) // Deterministic audio hash
    };

    this.fingerprintCache.set(profileId, fingerprint);
    return fingerprint;
  }

  async rotateProxy(contextId: string): Promise<void> {
    if (!this.config.proxyRotator) {
      throw new Error('Proxy rotator not configured');
    }

    const entry = this.contexts.get(contextId);
    if (!entry) {
      throw new Error(`Context ${contextId} not found`);
    }

    const newProxy = await this.config.proxyRotator();

    // Note: Playwright doesn't support changing proxy on existing context
    // This would require recreating the context
    logger.warn('BrowserIsolation: Proxy rotation requires context recreation');

    entry.metadata.proxy = newProxy;
  }

  async shutdown(): Promise<void> {
    // Destroy all contexts
    for (const [contextId] of this.contexts) {
      await this.destroyContext(contextId, { saveSession: true });
    }

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    logger.info('BrowserIsolation: Shutdown complete');
  }

  private async launchBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--no-sandbox'
      ]
    });

    this.browser.on('disconnected', () => {
      this.browser = null;
      this.contexts.clear();
    });
  }

  private async applyStealthMeasures(
    context: PlaywrightContext,
    fingerprint: Fingerprint
  ): Promise<void> {
    const injector = new FingerprintInjector();

    await context.addInitScript(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin' },
          { name: 'Chrome PDF Viewer' },
          { name: 'Native Client' }
        ]
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'denied', onchange: null } as PermissionStatus);
        }
        return originalQuery(parameters);
      };
    });

    // Inject fingerprint-specific overrides
    await injector.attachFingerprintToPlaywright(context, {
      fingerprint: {
        navigator: {
          userAgent: fingerprint.userAgent,
          platform: fingerprint.platform,
          language: fingerprint.language
        },
        screen: fingerprint.screen,
        webGl: fingerprint.webgl
      }
    } as any);
  }

  private async saveContextSession(contextId: string): Promise<void> {
    const entry = this.contexts.get(contextId);
    if (!entry) return;

    const storageState = await entry.context.storageState();
    const vault = getProfileVault();

    await vault.saveSession(entry.metadata.profileId, {
      cookies: storageState.cookies,
      localStorage: storageState.origins.reduce((acc, origin) => {
        acc[origin.origin] = origin.localStorage.reduce((ls, item) => {
          ls[item.name] = item.value;
          return ls;
        }, {} as Record<string, string>);
        return acc;
      }, {} as Record<string, Record<string, string>>),
      sessionStorage: {}
    });
  }

  private async enforceContextLimits(clientId: string): Promise<void> {
    // Check global limit
    if (this.contexts.size >= this.config.maxTotalContexts) {
      throw new Error('Global context limit reached');
    }

    // Check per-client limit
    let clientContextCount = 0;
    for (const [, entry] of this.contexts) {
      if (entry.metadata.clientId === clientId) {
        clientContextCount++;
      }
    }

    if (clientContextCount >= this.config.maxContextsPerClient) {
      throw new Error('Maximum contexts reached for this client');
    }
  }
}
```

#### 2.3 Create Factory and Export

```typescript
// packages/browser-lane/src/browser-isolation/index.ts

export * from './types';
export * from './browser-isolation';

import { BrowserIsolation } from './browser-isolation';
import { IsolationConfig } from './types';

let isolationInstance: BrowserIsolation | null = null;

export function initializeBrowserIsolation(config: IsolationConfig): BrowserIsolation {
  isolationInstance = new BrowserIsolation(config);
  return isolationInstance;
}

export function getBrowserIsolation(): BrowserIsolation {
  if (!isolationInstance) {
    throw new Error('BrowserIsolation not initialized');
  }
  return isolationInstance;
}
```

### Phase 3: Verification

```bash
# Unit tests
cd packages/browser-lane
pnpm test src/browser-isolation --reporter=verbose --coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint src/browser-isolation
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/browser-lane/src/browser-isolation/types.ts` | Isolation types |
| Create | `packages/browser-lane/src/browser-isolation/browser-isolation.ts` | Main implementation |
| Create | `packages/browser-lane/src/browser-isolation/index.ts` | Public exports |
| Create | `packages/browser-lane/src/browser-isolation/__tests__/browser-isolation.test.ts` | Unit tests |

---

## Acceptance Criteria

- [ ] Browser contexts created with fingerprints
- [ ] Fingerprints deterministic per profile
- [ ] Stealth measures applied
- [ ] Proxy support works
- [ ] Context limits enforced
- [ ] Session persistence works
- [ ] Auto-destroy on timeout works
- [ ] Page limits per context work
- [ ] Unit test coverage exceeds 80%

---

## JSON Task Block

```json
{
  "task_id": "S3-C2",
  "name": "Browser Isolation",
  "status": "pending",
  "dependencies": ["S3-C1"],
  "blocks": ["S3-C3", "S3-C4"],
  "agent": "C",
  "sprint": 3,
  "complexity": "high",
  "package": "@rtv/browser-lane",
  "files": [
    "packages/browser-lane/src/browser-isolation/types.ts",
    "packages/browser-lane/src/browser-isolation/browser-isolation.ts",
    "packages/browser-lane/src/browser-isolation/index.ts"
  ],
  "test_files": [
    "packages/browser-lane/src/browser-isolation/__tests__/browser-isolation.test.ts"
  ],
  "estimated_loc": 550,
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
      sections: ["browser-isolation", "anti-detection"]
  summaries_to_create:
    - topic: "Playwright stealth configuration"
      scope: "fingerprinting, anti-detection, proxy rotation"
  decisions_made: []
  blockers: []
  handoff_notes: null
```
