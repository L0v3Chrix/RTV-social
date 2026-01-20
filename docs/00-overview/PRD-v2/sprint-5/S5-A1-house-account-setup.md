# Build Prompt: S5-A1 — House Account Setup

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-A1 |
| Sprint | 5 - Gated Rollout |
| Agent | A - House Account Testing |
| Task Name | RTV House Account Setup |
| Complexity | Medium |
| Status | pending |
| Dependencies | S4-D5 |
| Blocked By | None |

---

## Context

### What This Builds

The HouseAccountManager that configures RTV-owned social media accounts across all supported platforms for internal testing. This includes platform credentials, API tokens, and a dedicated client record that serves as the validation environment before any external client rollout.

### Why It Matters

- **Safe Testing**: Real side effects without affecting clients
- **Full Coverage**: All platforms tested with actual API calls
- **Validation First**: Prove system works before client exposure
- **Baseline Data**: Establish performance benchmarks on known accounts
- **Rollback Testing**: Safe environment to test failure recovery

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Multi-Tenant Architecture | Client structure |
| `docs/02-schemas/onboarding-schema.md` | Client Schema | Account configuration |
| `docs/05-policy-safety/multi-tenant-isolation.md` | Isolation | House account separation |
| `docs/04-browser-lane/browser-automation-profile-vault.md` | Profile Vault | Browser profile setup |

---

## Prerequisites

### Completed Tasks

- [x] S4-D5: Escalation metrics (sprint 4 complete)
- [x] S0-B2: Core schema migrations (client table exists)
- [x] S3-B1-B6: Platform connectors (all platforms implemented)

### Required Packages

```json
{
  "dependencies": {
    "zod": "^3.23.0",
    "nanoid": "^5.0.0",
    "@opentelemetry/api": "^1.9.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### Required Secrets

```bash
# House account platform credentials (stored in vault)
RTV_HOUSE_META_ACCESS_TOKEN=<encrypted>
RTV_HOUSE_META_PAGE_ID=<encrypted>
RTV_HOUSE_INSTAGRAM_ACCOUNT_ID=<encrypted>
RTV_HOUSE_TIKTOK_ACCESS_TOKEN=<encrypted>
RTV_HOUSE_YOUTUBE_REFRESH_TOKEN=<encrypted>
RTV_HOUSE_LINKEDIN_ACCESS_TOKEN=<encrypted>
RTV_HOUSE_X_BEARER_TOKEN=<encrypted>
RTV_HOUSE_SKOOL_CREDENTIALS=<encrypted>
```

---

## Instructions

### Phase 1: Test First (TDD)

Create comprehensive tests BEFORE any implementation.

#### 1.1 Create House Account Types Test

**File:** `packages/rollout/house-accounts/src/__tests__/house-account-types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  HouseAccountConfigSchema,
  PlatformCredentialSchema,
  HouseAccountStatusSchema,
  validateHouseAccountConfig,
  HOUSE_CLIENT_ID,
  HOUSE_ACCOUNT_FLAGS,
} from '../house-account-types';

describe('House Account Types', () => {
  describe('HouseAccountConfigSchema', () => {
    it('should validate complete house account config', () => {
      const config = {
        clientId: HOUSE_CLIENT_ID,
        name: 'RTV House Account',
        description: 'Internal testing account for RTV',
        environment: 'production' as const,
        platforms: {
          meta_facebook: {
            enabled: true,
            pageId: 'page_123',
            accessTokenRef: 'vault:rtv/meta/access_token',
          },
          meta_instagram: {
            enabled: true,
            accountId: 'ig_456',
            accessTokenRef: 'vault:rtv/instagram/access_token',
          },
          tiktok: {
            enabled: true,
            accessTokenRef: 'vault:rtv/tiktok/access_token',
          },
          youtube: {
            enabled: true,
            channelId: 'UC_xyz',
            refreshTokenRef: 'vault:rtv/youtube/refresh_token',
          },
          linkedin: {
            enabled: true,
            organizationId: 'org_789',
            accessTokenRef: 'vault:rtv/linkedin/access_token',
          },
          x: {
            enabled: true,
            accessTokenRef: 'vault:rtv/x/bearer_token',
          },
          skool: {
            enabled: true,
            communityId: 'comm_abc',
            credentialsRef: 'vault:rtv/skool/credentials',
          },
        },
        flags: HOUSE_ACCOUNT_FLAGS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = HouseAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should require house client ID', () => {
      const config = {
        clientId: 'regular_client_123', // Wrong ID
        name: 'Test Account',
      };

      const result = HouseAccountConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should validate platform credential references', () => {
      const credential = {
        enabled: true,
        accessTokenRef: 'vault:rtv/meta/access_token',
        pageId: 'page_123',
      };

      const result = PlatformCredentialSchema.safeParse(credential);
      expect(result.success).toBe(true);
    });

    it('should reject plain text secrets', () => {
      const credential = {
        enabled: true,
        accessToken: 'plain_text_secret_BAD', // Plain text not allowed
      };

      const result = PlatformCredentialSchema.safeParse(credential);
      expect(result.success).toBe(false);
    });
  });

  describe('House Account Constants', () => {
    it('should have correct house client ID format', () => {
      expect(HOUSE_CLIENT_ID).toBe('client_rtv_house');
    });

    it('should have safety flags enabled', () => {
      expect(HOUSE_ACCOUNT_FLAGS.isHouseAccount).toBe(true);
      expect(HOUSE_ACCOUNT_FLAGS.allowRealSideEffects).toBe(true);
      expect(HOUSE_ACCOUNT_FLAGS.requiresApproval).toBe(false); // Auto-approve for testing
    });
  });

  describe('HouseAccountStatusSchema', () => {
    it('should validate platform connection status', () => {
      const status = {
        platform: 'meta_facebook',
        connected: true,
        lastVerified: new Date().toISOString(),
        lastError: null,
        permissions: ['pages_manage_posts', 'pages_read_engagement'],
      };

      const result = HouseAccountStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    });

    it('should handle disconnected status with error', () => {
      const status = {
        platform: 'tiktok',
        connected: false,
        lastVerified: new Date().toISOString(),
        lastError: 'Token expired',
        permissions: [],
      };

      const result = HouseAccountStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    });
  });
});
```

#### 1.2 Create HouseAccountManager Test

**File:** `packages/rollout/house-accounts/src/__tests__/house-account-manager.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HouseAccountManager } from '../house-account-manager';
import { HOUSE_CLIENT_ID } from '../house-account-types';

describe('HouseAccountManager', () => {
  let manager: HouseAccountManager;
  let mockVault: any;
  let mockClientRepository: any;
  let mockPlatformConnectors: any;
  let mockTelemetry: any;

  beforeEach(() => {
    mockVault = {
      getSecret: vi.fn(),
      setSecret: vi.fn(),
    };

    mockClientRepository = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    mockPlatformConnectors = {
      meta_facebook: { verifyConnection: vi.fn().mockResolvedValue(true) },
      meta_instagram: { verifyConnection: vi.fn().mockResolvedValue(true) },
      tiktok: { verifyConnection: vi.fn().mockResolvedValue(true) },
      youtube: { verifyConnection: vi.fn().mockResolvedValue(true) },
      linkedin: { verifyConnection: vi.fn().mockResolvedValue(true) },
      x: { verifyConnection: vi.fn().mockResolvedValue(true) },
      skool: { verifyConnection: vi.fn().mockResolvedValue(true) },
    };

    mockTelemetry = {
      recordSetup: vi.fn(),
      recordVerification: vi.fn(),
    };

    manager = new HouseAccountManager({
      vault: mockVault,
      clientRepository: mockClientRepository,
      platformConnectors: mockPlatformConnectors,
      telemetry: mockTelemetry,
    });
  });

  describe('initialize', () => {
    it('should create house account client if not exists', async () => {
      mockClientRepository.findById.mockResolvedValue(null);
      mockClientRepository.create.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        name: 'RTV House Account',
      });

      const result = await manager.initialize();

      expect(result.clientId).toBe(HOUSE_CLIENT_ID);
      expect(mockClientRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: HOUSE_CLIENT_ID,
          flags: expect.objectContaining({
            isHouseAccount: true,
          }),
        })
      );
    });

    it('should return existing house account if already exists', async () => {
      mockClientRepository.findById.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        name: 'RTV House Account',
      });

      const result = await manager.initialize();

      expect(result.clientId).toBe(HOUSE_CLIENT_ID);
      expect(mockClientRepository.create).not.toHaveBeenCalled();
    });

    it('should verify all platform connections on initialize', async () => {
      mockClientRepository.findById.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        platforms: {
          meta_facebook: { enabled: true },
          tiktok: { enabled: true },
        },
      });

      await manager.initialize();

      expect(mockPlatformConnectors.meta_facebook.verifyConnection).toHaveBeenCalled();
      expect(mockPlatformConnectors.tiktok.verifyConnection).toHaveBeenCalled();
    });
  });

  describe('configurePlatform', () => {
    it('should store credentials in vault', async () => {
      mockClientRepository.findById.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        platforms: {},
      });
      mockVault.setSecret.mockResolvedValue(undefined);

      await manager.configurePlatform('meta_facebook', {
        pageId: 'page_123',
        accessToken: 'secret_token',
      });

      expect(mockVault.setSecret).toHaveBeenCalledWith(
        'rtv/house/meta_facebook/access_token',
        'secret_token'
      );

      // Should NOT store plain text in client record
      expect(mockClientRepository.update).toHaveBeenCalledWith(
        HOUSE_CLIENT_ID,
        expect.objectContaining({
          platforms: expect.objectContaining({
            meta_facebook: expect.objectContaining({
              pageId: 'page_123',
              accessTokenRef: 'vault:rtv/house/meta_facebook/access_token',
            }),
          }),
        })
      );
    });

    it('should verify connection after configuration', async () => {
      mockClientRepository.findById.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        platforms: {},
      });
      mockVault.setSecret.mockResolvedValue(undefined);
      mockVault.getSecret.mockResolvedValue('secret_token');

      const result = await manager.configurePlatform('meta_facebook', {
        pageId: 'page_123',
        accessToken: 'secret_token',
      });

      expect(mockPlatformConnectors.meta_facebook.verifyConnection).toHaveBeenCalled();
      expect(result.connected).toBe(true);
    });

    it('should handle connection failure gracefully', async () => {
      mockClientRepository.findById.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        platforms: {},
      });
      mockVault.setSecret.mockResolvedValue(undefined);
      mockVault.getSecret.mockResolvedValue('secret_token');
      mockPlatformConnectors.tiktok.verifyConnection.mockRejectedValue(
        new Error('Invalid token')
      );

      const result = await manager.configurePlatform('tiktok', {
        accessToken: 'bad_token',
      });

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('getStatus', () => {
    it('should return status for all configured platforms', async () => {
      mockClientRepository.findById.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        platforms: {
          meta_facebook: { enabled: true, pageId: 'page_123' },
          tiktok: { enabled: true },
          youtube: { enabled: false },
        },
      });

      const status = await manager.getStatus();

      expect(status.platforms).toHaveLength(3);
      expect(status.platforms.find(p => p.platform === 'meta_facebook')?.enabled).toBe(true);
      expect(status.platforms.find(p => p.platform === 'youtube')?.enabled).toBe(false);
    });

    it('should verify connections for enabled platforms', async () => {
      mockClientRepository.findById.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        platforms: {
          meta_facebook: { enabled: true },
        },
      });

      await manager.getStatus({ verifyConnections: true });

      expect(mockPlatformConnectors.meta_facebook.verifyConnection).toHaveBeenCalled();
    });
  });

  describe('refreshCredentials', () => {
    it('should refresh tokens for platforms that support it', async () => {
      mockClientRepository.findById.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        platforms: {
          youtube: { enabled: true, refreshTokenRef: 'vault:rtv/house/youtube/refresh' },
        },
      });

      mockVault.getSecret.mockResolvedValue('refresh_token');
      mockPlatformConnectors.youtube.refreshToken = vi.fn().mockResolvedValue({
        accessToken: 'new_access_token',
        expiresIn: 3600,
      });

      const result = await manager.refreshCredentials('youtube');

      expect(mockPlatformConnectors.youtube.refreshToken).toHaveBeenCalled();
      expect(mockVault.setSecret).toHaveBeenCalledWith(
        expect.stringContaining('access_token'),
        'new_access_token'
      );
      expect(result.refreshed).toBe(true);
    });

    it('should skip platforms that do not support refresh', async () => {
      mockClientRepository.findById.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        platforms: {
          x: { enabled: true },
        },
      });

      // X (Twitter) uses long-lived tokens, no refresh
      delete mockPlatformConnectors.x.refreshToken;

      const result = await manager.refreshCredentials('x');

      expect(result.refreshed).toBe(false);
      expect(result.reason).toBe('Platform does not support token refresh');
    });
  });

  describe('validateSetup', () => {
    it('should return valid when all platforms connected', async () => {
      mockClientRepository.findById.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        platforms: {
          meta_facebook: { enabled: true },
          tiktok: { enabled: true },
        },
      });

      const validation = await manager.validateSetup();

      expect(validation.valid).toBe(true);
      expect(validation.connectedPlatforms).toHaveLength(2);
    });

    it('should return warnings for disabled platforms', async () => {
      mockClientRepository.findById.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        platforms: {
          meta_facebook: { enabled: true },
          tiktok: { enabled: false },
          skool: { enabled: false },
        },
      });

      const validation = await manager.validateSetup();

      expect(validation.valid).toBe(true); // Still valid, just warnings
      expect(validation.warnings).toContain('tiktok is disabled');
      expect(validation.warnings).toContain('skool is disabled');
    });

    it('should fail validation if no platforms configured', async () => {
      mockClientRepository.findById.mockResolvedValue({
        id: HOUSE_CLIENT_ID,
        platforms: {},
      });

      const validation = await manager.validateSetup();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('No platforms configured');
    });
  });

  describe('isHouseAccount', () => {
    it('should return true for house client ID', () => {
      expect(manager.isHouseAccount(HOUSE_CLIENT_ID)).toBe(true);
    });

    it('should return false for regular client IDs', () => {
      expect(manager.isHouseAccount('client_abc123')).toBe(false);
      expect(manager.isHouseAccount('client_xyz789')).toBe(false);
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Implement House Account Types

**File:** `packages/rollout/house-accounts/src/house-account-types.ts`

```typescript
import { z } from 'zod';

/**
 * House account client ID - fixed identifier
 */
export const HOUSE_CLIENT_ID = 'client_rtv_house';

/**
 * Default flags for house account
 */
export const HOUSE_ACCOUNT_FLAGS = {
  isHouseAccount: true,
  allowRealSideEffects: true,
  requiresApproval: false,
  bypassRateLimits: false, // Still respect platform limits
  extendedLogging: true,
};

/**
 * Supported platforms
 */
export const PlatformSchema = z.enum([
  'meta_facebook',
  'meta_instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'x',
  'skool',
]);

export type Platform = z.infer<typeof PlatformSchema>;

/**
 * Platform credential configuration
 * Only stores references to vault secrets, NEVER plain text
 */
export const PlatformCredentialSchema = z.object({
  enabled: z.boolean(),
  // Credential references (vault:path/to/secret)
  accessTokenRef: z.string().startsWith('vault:').optional(),
  refreshTokenRef: z.string().startsWith('vault:').optional(),
  credentialsRef: z.string().startsWith('vault:').optional(),
  // Platform-specific identifiers
  pageId: z.string().optional(),
  accountId: z.string().optional(),
  channelId: z.string().optional(),
  organizationId: z.string().optional(),
  communityId: z.string().optional(),
  // Metadata
  lastVerified: z.string().datetime().optional(),
  permissions: z.array(z.string()).optional(),
}).refine(
  (data) => !('accessToken' in data) && !('refreshToken' in data),
  { message: 'Plain text secrets not allowed - use *Ref fields' }
);

export type PlatformCredential = z.infer<typeof PlatformCredentialSchema>;

/**
 * House account flags
 */
export const HouseAccountFlagsSchema = z.object({
  isHouseAccount: z.literal(true),
  allowRealSideEffects: z.boolean(),
  requiresApproval: z.boolean(),
  bypassRateLimits: z.boolean(),
  extendedLogging: z.boolean(),
});

export type HouseAccountFlags = z.infer<typeof HouseAccountFlagsSchema>;

/**
 * House account configuration
 */
export const HouseAccountConfigSchema = z.object({
  clientId: z.literal(HOUSE_CLIENT_ID),
  name: z.string(),
  description: z.string().optional(),
  environment: z.enum(['development', 'staging', 'production']),
  platforms: z.record(PlatformSchema, PlatformCredentialSchema),
  flags: HouseAccountFlagsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type HouseAccountConfig = z.infer<typeof HouseAccountConfigSchema>;

/**
 * Platform connection status
 */
export const HouseAccountStatusSchema = z.object({
  platform: PlatformSchema,
  enabled: z.boolean().optional(),
  connected: z.boolean(),
  lastVerified: z.string().datetime(),
  lastError: z.string().nullable(),
  permissions: z.array(z.string()),
});

export type HouseAccountStatus = z.infer<typeof HouseAccountStatusSchema>;

/**
 * Configuration input for a platform
 */
export const PlatformConfigInputSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  credentials: z.record(z.string()).optional(),
  pageId: z.string().optional(),
  accountId: z.string().optional(),
  channelId: z.string().optional(),
  organizationId: z.string().optional(),
  communityId: z.string().optional(),
});

export type PlatformConfigInput = z.infer<typeof PlatformConfigInputSchema>;

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  connectedPlatforms: Platform[];
  disconnectedPlatforms: Platform[];
  warnings: string[];
  errors: string[];
}

/**
 * Type guard for house account config
 */
export function validateHouseAccountConfig(data: unknown): data is HouseAccountConfig {
  return HouseAccountConfigSchema.safeParse(data).success;
}
```

#### 2.2 Implement HouseAccountManager

**File:** `packages/rollout/house-accounts/src/house-account-manager.ts`

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  Platform,
  PlatformSchema,
  HouseAccountConfig,
  HouseAccountStatus,
  PlatformConfigInput,
  ValidationResult,
  HOUSE_CLIENT_ID,
  HOUSE_ACCOUNT_FLAGS,
} from './house-account-types';

const tracer = trace.getTracer('house-account-manager');

export interface Vault {
  getSecret(path: string): Promise<string | null>;
  setSecret(path: string, value: string): Promise<void>;
}

export interface ClientRepository {
  findById(id: string): Promise<any | null>;
  create(client: any): Promise<any>;
  update(id: string, updates: any): Promise<any>;
}

export interface PlatformConnector {
  verifyConnection(credentials: any): Promise<boolean>;
  refreshToken?(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>;
}

export interface HouseAccountTelemetry {
  recordSetup(platform: Platform, success: boolean): void;
  recordVerification(platform: Platform, connected: boolean): void;
}

export interface HouseAccountManagerConfig {
  vault: Vault;
  clientRepository: ClientRepository;
  platformConnectors: Record<Platform, PlatformConnector>;
  telemetry: HouseAccountTelemetry;
}

interface StatusOptions {
  verifyConnections?: boolean;
}

interface ConfigureResult {
  connected: boolean;
  error?: string;
}

interface RefreshResult {
  refreshed: boolean;
  reason?: string;
}

export class HouseAccountManager {
  private vault: Vault;
  private clientRepository: ClientRepository;
  private platformConnectors: Record<Platform, PlatformConnector>;
  private telemetry: HouseAccountTelemetry;

  constructor(config: HouseAccountManagerConfig) {
    this.vault = config.vault;
    this.clientRepository = config.clientRepository;
    this.platformConnectors = config.platformConnectors;
    this.telemetry = config.telemetry;
  }

  /**
   * Initialize or retrieve house account
   */
  async initialize(): Promise<{ clientId: string; isNew: boolean }> {
    return tracer.startActiveSpan('initializeHouseAccount', async (span) => {
      try {
        const existing = await this.clientRepository.findById(HOUSE_CLIENT_ID);

        if (existing) {
          // Verify all enabled platforms
          await this.verifyAllPlatforms(existing);

          span.setStatus({ code: SpanStatusCode.OK });
          span.setAttribute('house_account.is_new', false);
          return { clientId: HOUSE_CLIENT_ID, isNew: false };
        }

        // Create new house account client
        const newClient = await this.clientRepository.create({
          id: HOUSE_CLIENT_ID,
          name: 'RTV House Account',
          description: 'Internal testing account for RTV platform validation',
          environment: 'production',
          platforms: {},
          flags: HOUSE_ACCOUNT_FLAGS,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('house_account.is_new', true);
        return { clientId: newClient.id, isNew: true };
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Configure a platform for the house account
   */
  async configurePlatform(
    platform: Platform,
    input: PlatformConfigInput
  ): Promise<ConfigureResult> {
    return tracer.startActiveSpan('configurePlatform', async (span) => {
      span.setAttribute('platform', platform);

      try {
        const client = await this.clientRepository.findById(HOUSE_CLIENT_ID);
        if (!client) {
          throw new Error('House account not initialized');
        }

        // Store secrets in vault
        const vaultPath = `rtv/house/${platform}`;
        const credentialRefs: Record<string, string> = {};

        if (input.accessToken) {
          await this.vault.setSecret(`${vaultPath}/access_token`, input.accessToken);
          credentialRefs.accessTokenRef = `vault:${vaultPath}/access_token`;
        }

        if (input.refreshToken) {
          await this.vault.setSecret(`${vaultPath}/refresh_token`, input.refreshToken);
          credentialRefs.refreshTokenRef = `vault:${vaultPath}/refresh_token`;
        }

        if (input.credentials) {
          await this.vault.setSecret(
            `${vaultPath}/credentials`,
            JSON.stringify(input.credentials)
          );
          credentialRefs.credentialsRef = `vault:${vaultPath}/credentials`;
        }

        // Update client record with platform config
        const platformConfig = {
          enabled: true,
          ...credentialRefs,
          pageId: input.pageId,
          accountId: input.accountId,
          channelId: input.channelId,
          organizationId: input.organizationId,
          communityId: input.communityId,
          lastVerified: new Date().toISOString(),
        };

        await this.clientRepository.update(HOUSE_CLIENT_ID, {
          platforms: {
            ...client.platforms,
            [platform]: platformConfig,
          },
          updatedAt: new Date().toISOString(),
        });

        // Verify connection
        try {
          const credentials = await this.resolveCredentials(platform, platformConfig);
          const connector = this.platformConnectors[platform];
          await connector.verifyConnection(credentials);

          this.telemetry.recordSetup(platform, true);
          span.setStatus({ code: SpanStatusCode.OK });
          return { connected: true };
        } catch (verifyError) {
          this.telemetry.recordSetup(platform, false);
          return {
            connected: false,
            error: verifyError instanceof Error ? verifyError.message : String(verifyError),
          };
        }
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get status of all platforms
   */
  async getStatus(options: StatusOptions = {}): Promise<{
    clientId: string;
    platforms: HouseAccountStatus[];
  }> {
    const client = await this.clientRepository.findById(HOUSE_CLIENT_ID);
    if (!client) {
      throw new Error('House account not initialized');
    }

    const platforms: HouseAccountStatus[] = [];

    for (const [platform, config] of Object.entries(client.platforms || {})) {
      const status: HouseAccountStatus = {
        platform: platform as Platform,
        enabled: (config as any).enabled,
        connected: false,
        lastVerified: (config as any).lastVerified || new Date().toISOString(),
        lastError: null,
        permissions: (config as any).permissions || [],
      };

      if (options.verifyConnections && (config as any).enabled) {
        try {
          const credentials = await this.resolveCredentials(
            platform as Platform,
            config as any
          );
          const connector = this.platformConnectors[platform as Platform];
          await connector.verifyConnection(credentials);
          status.connected = true;
          this.telemetry.recordVerification(platform as Platform, true);
        } catch (error) {
          status.lastError = error instanceof Error ? error.message : String(error);
          this.telemetry.recordVerification(platform as Platform, false);
        }
      }

      platforms.push(status);
    }

    return { clientId: HOUSE_CLIENT_ID, platforms };
  }

  /**
   * Refresh credentials for a platform
   */
  async refreshCredentials(platform: Platform): Promise<RefreshResult> {
    return tracer.startActiveSpan('refreshCredentials', async (span) => {
      span.setAttribute('platform', platform);

      try {
        const client = await this.clientRepository.findById(HOUSE_CLIENT_ID);
        if (!client) {
          throw new Error('House account not initialized');
        }

        const platformConfig = client.platforms?.[platform];
        if (!platformConfig?.enabled) {
          return { refreshed: false, reason: 'Platform not configured' };
        }

        const connector = this.platformConnectors[platform];
        if (!connector.refreshToken) {
          return { refreshed: false, reason: 'Platform does not support token refresh' };
        }

        const refreshTokenRef = platformConfig.refreshTokenRef;
        if (!refreshTokenRef) {
          return { refreshed: false, reason: 'No refresh token configured' };
        }

        const refreshToken = await this.vault.getSecret(
          refreshTokenRef.replace('vault:', '')
        );
        if (!refreshToken) {
          return { refreshed: false, reason: 'Refresh token not found in vault' };
        }

        const { accessToken, expiresIn } = await connector.refreshToken(refreshToken);

        await this.vault.setSecret(
          `rtv/house/${platform}/access_token`,
          accessToken
        );

        await this.clientRepository.update(HOUSE_CLIENT_ID, {
          platforms: {
            ...client.platforms,
            [platform]: {
              ...platformConfig,
              lastVerified: new Date().toISOString(),
            },
          },
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return { refreshed: true };
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        return {
          refreshed: false,
          reason: error instanceof Error ? error.message : String(error),
        };
      } finally {
        span.end();
      }
    });
  }

  /**
   * Validate house account setup
   */
  async validateSetup(): Promise<ValidationResult> {
    const client = await this.clientRepository.findById(HOUSE_CLIENT_ID);
    if (!client) {
      return {
        valid: false,
        connectedPlatforms: [],
        disconnectedPlatforms: [],
        warnings: [],
        errors: ['House account not initialized'],
      };
    }

    const platforms = client.platforms || {};
    const platformKeys = Object.keys(platforms) as Platform[];

    if (platformKeys.length === 0) {
      return {
        valid: false,
        connectedPlatforms: [],
        disconnectedPlatforms: [],
        warnings: [],
        errors: ['No platforms configured'],
      };
    }

    const connectedPlatforms: Platform[] = [];
    const disconnectedPlatforms: Platform[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const platform of platformKeys) {
      const config = platforms[platform];
      if (!config.enabled) {
        warnings.push(`${platform} is disabled`);
        disconnectedPlatforms.push(platform);
        continue;
      }

      try {
        const credentials = await this.resolveCredentials(platform, config);
        const connector = this.platformConnectors[platform];
        await connector.verifyConnection(credentials);
        connectedPlatforms.push(platform);
      } catch (error) {
        disconnectedPlatforms.push(platform);
        errors.push(`${platform}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      valid: connectedPlatforms.length > 0 && errors.length === 0,
      connectedPlatforms,
      disconnectedPlatforms,
      warnings,
      errors,
    };
  }

  /**
   * Check if a client ID is the house account
   */
  isHouseAccount(clientId: string): boolean {
    return clientId === HOUSE_CLIENT_ID;
  }

  private async verifyAllPlatforms(client: any): Promise<void> {
    for (const [platform, config] of Object.entries(client.platforms || {})) {
      if ((config as any).enabled) {
        try {
          const credentials = await this.resolveCredentials(
            platform as Platform,
            config as any
          );
          const connector = this.platformConnectors[platform as Platform];
          await connector.verifyConnection(credentials);
          this.telemetry.recordVerification(platform as Platform, true);
        } catch {
          this.telemetry.recordVerification(platform as Platform, false);
        }
      }
    }
  }

  private async resolveCredentials(
    platform: Platform,
    config: any
  ): Promise<Record<string, any>> {
    const credentials: Record<string, any> = {
      pageId: config.pageId,
      accountId: config.accountId,
      channelId: config.channelId,
      organizationId: config.organizationId,
      communityId: config.communityId,
    };

    if (config.accessTokenRef) {
      credentials.accessToken = await this.vault.getSecret(
        config.accessTokenRef.replace('vault:', '')
      );
    }

    if (config.refreshTokenRef) {
      credentials.refreshToken = await this.vault.getSecret(
        config.refreshTokenRef.replace('vault:', '')
      );
    }

    if (config.credentialsRef) {
      const raw = await this.vault.getSecret(
        config.credentialsRef.replace('vault:', '')
      );
      if (raw) {
        Object.assign(credentials, JSON.parse(raw));
      }
    }

    return credentials;
  }
}
```

### Phase 3: Verification

```bash
# Run tests
cd packages/rollout/house-accounts
pnpm test src/__tests__/house-account-types.test.ts
pnpm test src/__tests__/house-account-manager.test.ts

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/rollout/house-accounts/package.json` | Package configuration |
| Create | `packages/rollout/house-accounts/src/house-account-types.ts` | Type definitions |
| Create | `packages/rollout/house-accounts/src/house-account-manager.ts` | HouseAccountManager class |
| Create | `packages/rollout/house-accounts/src/__tests__/house-account-types.test.ts` | Type tests |
| Create | `packages/rollout/house-accounts/src/__tests__/house-account-manager.test.ts` | Manager tests |
| Create | `packages/rollout/house-accounts/src/index.ts` | Public exports |

---

## Acceptance Criteria

- [ ] House account client created with fixed ID `client_rtv_house`
- [ ] All platform credentials stored in vault (no plain text)
- [ ] Credential references use `vault:` prefix format
- [ ] Connection verification runs on initialization
- [ ] Platform configuration validates before saving
- [ ] Refresh token flow implemented for platforms that support it
- [ ] Validation checks all platforms and reports status
- [ ] isHouseAccount helper correctly identifies house client
- [ ] All tests pass with >80% coverage

---

## Test Requirements

### Unit Tests
- Config validation with vault references
- Plain text secret rejection
- Platform connection verification
- Refresh token flow
- Validation result generation

### Integration Tests
- Full platform configuration flow
- Multi-platform status check
- Credential refresh cycle

---

## Security & Safety Checklist

- [ ] NO plain text secrets in database
- [ ] All credentials stored via vault references
- [ ] House account ID is immutable constant
- [ ] Extended logging enabled for audit trail
- [ ] Platform permissions verified on connection

---

## JSON Task Block

```json
{
  "task_id": "S5-A1",
  "name": "House Account Setup",
  "description": "HouseAccountManager for RTV internal testing accounts",
  "status": "pending",
  "dependencies": ["S4-D5"],
  "blocks": ["S5-A2", "S5-A3"],
  "agent": "A",
  "sprint": 5,
  "complexity": "medium",
  "estimated_files": 6,
  "test_coverage_target": 80,
  "package": "@rtv/rollout/house-accounts",
  "exports": [
    "HouseAccountManager",
    "HOUSE_CLIENT_ID",
    "HOUSE_ACCOUNT_FLAGS",
    "HouseAccountConfig",
    "HouseAccountStatus"
  ]
}
```

---

## External Memory Section

```yaml
episode_id: null
started_at: null
completed_at: null

references_read:
  - docs/01-architecture/system-architecture-v3.md
  - docs/02-schemas/onboarding-schema.md
  - docs/05-policy-safety/multi-tenant-isolation.md

writes_made: []

decisions:
  - decision: "Use fixed client ID for house account"
    rationale: "Simplifies identification and prevents accidental creation of duplicates"
  - decision: "Store all credentials in vault with references"
    rationale: "Security best practice - no plain text secrets in database"
  - decision: "Auto-approve for house account testing"
    rationale: "Reduces friction in internal testing while maintaining audit trail"

blockers: []
questions: []
```
