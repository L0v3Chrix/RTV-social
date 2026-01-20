# Build Prompt: S5-A2 — Sandbox Mode Configuration

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S5-A2 |
| Sprint | 5 - Gated Rollout |
| Agent | A - House Account Testing |
| Task Name | Sandbox Mode Configuration |
| Complexity | Medium |
| Status | pending |
| Dependencies | S5-A1 |
| Blocked By | None |

---

## Context

### What This Builds

The SandboxModeService that provides a safe testing environment where operations can be executed without real side effects. In sandbox mode, all platform API calls are intercepted, logged, and simulated rather than executed, allowing developers and QA to validate flows end-to-end without publishing real content.

### Why It Matters

- **Safe Development**: Test full flows without affecting real accounts
- **QA Validation**: Verify behavior without real publishing
- **Demo Environment**: Show clients functionality safely
- **Regression Testing**: Run automated tests without side effects
- **Debugging**: Investigate issues without fear of mistakes

### Spec References

| Document | Section | Purpose |
|----------|---------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Execution Modes | Sandbox vs. production |
| `docs/05-policy-safety/compliance-safety-policy.md` | Safe Execution | Sandbox requirements |
| `docs/07-engineering-process/testing-strategy.md` | E2E Testing | Test environment patterns |

---

## Prerequisites

### Completed Tasks

- [x] S5-A1: House account setup (sandbox applies to house accounts)
- [x] S3-B1-B6: Platform connectors (connectors support sandbox mode)

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

---

## Instructions

### Phase 1: Test First (TDD)

Create comprehensive tests BEFORE any implementation.

#### 1.1 Create Sandbox Types Test

**File:** `packages/rollout/sandbox/src/__tests__/sandbox-types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  SandboxModeSchema,
  SandboxConfigSchema,
  SandboxInterceptionSchema,
  SimulatedResponseSchema,
  validateSandboxConfig,
} from '../sandbox-types';

describe('Sandbox Types', () => {
  describe('SandboxModeSchema', () => {
    it('should validate sandbox mode enum', () => {
      const modes = ['off', 'intercept', 'simulate', 'record'] as const;

      modes.forEach(mode => {
        const result = SandboxModeSchema.safeParse(mode);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('SandboxConfigSchema', () => {
    it('should validate complete sandbox config', () => {
      const config = {
        mode: 'simulate' as const,
        clientId: 'client_rtv_house',
        platforms: ['meta_facebook', 'tiktok'],
        operations: ['publish', 'like', 'comment'],
        simulationConfig: {
          successRate: 0.95,
          latencyMs: { min: 100, max: 500 },
          generateFakeIds: true,
        },
        recordingConfig: {
          enabled: true,
          storagePath: '/tmp/sandbox-recordings',
          maxRecordings: 1000,
        },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = SandboxConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should allow minimal config', () => {
      const config = {
        mode: 'off' as const,
        clientId: 'client_001',
      };

      const result = SandboxConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate success rate range', () => {
      const config = {
        mode: 'simulate',
        clientId: 'client_001',
        simulationConfig: {
          successRate: 1.5, // Invalid - over 1.0
        },
      };

      const result = SandboxConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('SandboxInterceptionSchema', () => {
    it('should validate interception record', () => {
      const interception = {
        id: 'int_abc123',
        timestamp: new Date().toISOString(),
        clientId: 'client_001',
        operation: 'publish',
        platform: 'meta_facebook',
        request: {
          method: 'POST',
          endpoint: '/me/feed',
          body: { message: 'Test post' },
        },
        intercepted: true,
        simulated: true,
        simulatedResponse: {
          statusCode: 200,
          body: { id: 'fake_post_123' },
        },
      };

      const result = SandboxInterceptionSchema.safeParse(interception);
      expect(result.success).toBe(true);
    });
  });

  describe('SimulatedResponseSchema', () => {
    it('should validate success response', () => {
      const response = {
        statusCode: 200,
        body: { id: 'post_123', url: 'https://facebook.com/post/123' },
        headers: { 'x-sandbox': 'true' },
        latencyMs: 150,
      };

      const result = SimulatedResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate error response', () => {
      const response = {
        statusCode: 429,
        body: { error: 'Rate limit exceeded' },
        latencyMs: 50,
      };

      const result = SimulatedResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});
```

#### 1.2 Create SandboxModeService Test

**File:** `packages/rollout/sandbox/src/__tests__/sandbox-mode-service.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SandboxModeService } from '../sandbox-mode-service';
import { SandboxConfig, SandboxMode } from '../sandbox-types';

describe('SandboxModeService', () => {
  let service: SandboxModeService;
  let mockConfigStore: any;
  let mockInterceptionLog: any;
  let mockTelemetry: any;

  beforeEach(() => {
    mockConfigStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    mockInterceptionLog = {
      record: vi.fn(),
      getRecordings: vi.fn(),
      clearRecordings: vi.fn(),
    };

    mockTelemetry = {
      recordInterception: vi.fn(),
    };

    service = new SandboxModeService({
      configStore: mockConfigStore,
      interceptionLog: mockInterceptionLog,
      telemetry: mockTelemetry,
    });
  });

  describe('enableSandbox', () => {
    it('should enable sandbox mode for a client', async () => {
      const config: Partial<SandboxConfig> = {
        mode: 'simulate',
        platforms: ['meta_facebook'],
        operations: ['publish'],
      };

      await service.enableSandbox('client_001', config);

      expect(mockConfigStore.set).toHaveBeenCalledWith(
        'sandbox:client_001',
        expect.objectContaining({
          mode: 'simulate',
          clientId: 'client_001',
          platforms: ['meta_facebook'],
          operations: ['publish'],
        })
      );
    });

    it('should set default expiration if not provided', async () => {
      await service.enableSandbox('client_001', { mode: 'intercept' });

      const call = mockConfigStore.set.mock.calls[0];
      const config = call[1];

      // Should have expiration set (default 24 hours)
      expect(config.expiresAt).toBeDefined();
      const expiresAt = new Date(config.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('disableSandbox', () => {
    it('should remove sandbox config for a client', async () => {
      await service.disableSandbox('client_001');

      expect(mockConfigStore.delete).toHaveBeenCalledWith('sandbox:client_001');
    });
  });

  describe('getSandboxConfig', () => {
    it('should return sandbox config if exists', async () => {
      const config: SandboxConfig = {
        mode: 'simulate',
        clientId: 'client_001',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      mockConfigStore.get.mockResolvedValue(config);

      const result = await service.getSandboxConfig('client_001');

      expect(result).toEqual(config);
    });

    it('should return null if no config exists', async () => {
      mockConfigStore.get.mockResolvedValue(null);

      const result = await service.getSandboxConfig('client_001');

      expect(result).toBeNull();
    });

    it('should auto-disable expired sandbox', async () => {
      const config: SandboxConfig = {
        mode: 'simulate',
        clientId: 'client_001',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      };

      mockConfigStore.get.mockResolvedValue(config);

      const result = await service.getSandboxConfig('client_001');

      expect(result).toBeNull();
      expect(mockConfigStore.delete).toHaveBeenCalledWith('sandbox:client_001');
    });
  });

  describe('isSandboxed', () => {
    it('should return true if sandbox enabled for client', async () => {
      mockConfigStore.get.mockResolvedValue({
        mode: 'simulate',
        clientId: 'client_001',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const result = await service.isSandboxed('client_001');

      expect(result).toBe(true);
    });

    it('should return false if sandbox disabled', async () => {
      mockConfigStore.get.mockResolvedValue({
        mode: 'off',
        clientId: 'client_001',
      });

      const result = await service.isSandboxed('client_001');

      expect(result).toBe(false);
    });

    it('should return false if no config', async () => {
      mockConfigStore.get.mockResolvedValue(null);

      const result = await service.isSandboxed('client_001');

      expect(result).toBe(false);
    });
  });

  describe('shouldIntercept', () => {
    it('should intercept matching operation and platform', async () => {
      mockConfigStore.get.mockResolvedValue({
        mode: 'intercept',
        clientId: 'client_001',
        platforms: ['meta_facebook'],
        operations: ['publish'],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const result = await service.shouldIntercept(
        'client_001',
        'publish',
        'meta_facebook'
      );

      expect(result).toBe(true);
    });

    it('should not intercept non-matching platform', async () => {
      mockConfigStore.get.mockResolvedValue({
        mode: 'intercept',
        clientId: 'client_001',
        platforms: ['meta_facebook'],
        operations: ['publish'],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const result = await service.shouldIntercept(
        'client_001',
        'publish',
        'tiktok'
      );

      expect(result).toBe(false);
    });

    it('should intercept all if no platforms specified', async () => {
      mockConfigStore.get.mockResolvedValue({
        mode: 'intercept',
        clientId: 'client_001',
        operations: ['publish'],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const result = await service.shouldIntercept(
        'client_001',
        'publish',
        'youtube'
      );

      expect(result).toBe(true);
    });
  });

  describe('simulateResponse', () => {
    it('should generate successful simulated response', async () => {
      mockConfigStore.get.mockResolvedValue({
        mode: 'simulate',
        clientId: 'client_001',
        simulationConfig: {
          successRate: 1.0, // Always succeed
          latencyMs: { min: 100, max: 100 },
          generateFakeIds: true,
        },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const response = await service.simulateResponse(
        'client_001',
        'publish',
        'meta_facebook',
        { message: 'Test post' }
      );

      expect(response.statusCode).toBe(200);
      expect(response.body.id).toMatch(/^sandbox_/);
      expect(response.latencyMs).toBe(100);
    });

    it('should generate error response based on success rate', async () => {
      mockConfigStore.get.mockResolvedValue({
        mode: 'simulate',
        clientId: 'client_001',
        simulationConfig: {
          successRate: 0, // Always fail
          latencyMs: { min: 50, max: 50 },
        },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const response = await service.simulateResponse(
        'client_001',
        'publish',
        'meta_facebook',
        { message: 'Test post' }
      );

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should add latency within configured range', async () => {
      mockConfigStore.get.mockResolvedValue({
        mode: 'simulate',
        clientId: 'client_001',
        simulationConfig: {
          successRate: 1.0,
          latencyMs: { min: 100, max: 500 },
        },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const response = await service.simulateResponse(
        'client_001',
        'publish',
        'meta_facebook',
        {}
      );

      expect(response.latencyMs).toBeGreaterThanOrEqual(100);
      expect(response.latencyMs).toBeLessThanOrEqual(500);
    });
  });

  describe('recordInterception', () => {
    it('should log interception when recording enabled', async () => {
      mockConfigStore.get.mockResolvedValue({
        mode: 'record',
        clientId: 'client_001',
        recordingConfig: {
          enabled: true,
        },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      await service.recordInterception('client_001', {
        operation: 'publish',
        platform: 'meta_facebook',
        request: { message: 'Test' },
        response: { statusCode: 200, body: { id: '123' } },
      });

      expect(mockInterceptionLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client_001',
          operation: 'publish',
          platform: 'meta_facebook',
        })
      );
    });
  });

  describe('getRecordings', () => {
    it('should return recordings for a client', async () => {
      const recordings = [
        { id: 'int_1', operation: 'publish' },
        { id: 'int_2', operation: 'like' },
      ];

      mockInterceptionLog.getRecordings.mockResolvedValue(recordings);

      const result = await service.getRecordings('client_001');

      expect(result).toHaveLength(2);
    });

    it('should filter by operation', async () => {
      mockInterceptionLog.getRecordings.mockResolvedValue([]);

      await service.getRecordings('client_001', { operation: 'publish' });

      expect(mockInterceptionLog.getRecordings).toHaveBeenCalledWith(
        'client_001',
        expect.objectContaining({ operation: 'publish' })
      );
    });
  });

  describe('createSandboxWrapper', () => {
    it('should return wrapped function that intercepts calls', async () => {
      mockConfigStore.get.mockResolvedValue({
        mode: 'simulate',
        clientId: 'client_001',
        simulationConfig: {
          successRate: 1.0,
          latencyMs: { min: 0, max: 0 },
          generateFakeIds: true,
        },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const originalFn = vi.fn().mockResolvedValue({ id: 'real_123' });

      const wrapped = service.createSandboxWrapper(
        'client_001',
        'publish',
        'meta_facebook',
        originalFn
      );

      const result = await wrapped({ message: 'Test' });

      expect(originalFn).not.toHaveBeenCalled();
      expect(result.id).toMatch(/^sandbox_/);
    });

    it('should pass through when sandbox disabled', async () => {
      mockConfigStore.get.mockResolvedValue(null);

      const originalFn = vi.fn().mockResolvedValue({ id: 'real_123' });

      const wrapped = service.createSandboxWrapper(
        'client_001',
        'publish',
        'meta_facebook',
        originalFn
      );

      const result = await wrapped({ message: 'Test' });

      expect(originalFn).toHaveBeenCalled();
      expect(result.id).toBe('real_123');
    });
  });
});
```

### Phase 2: Implementation

#### 2.1 Implement Sandbox Types

**File:** `packages/rollout/sandbox/src/sandbox-types.ts`

```typescript
import { z } from 'zod';

/**
 * Sandbox modes
 */
export const SandboxModeSchema = z.enum([
  'off',       // Sandbox disabled - real operations execute
  'intercept', // Intercept and block operations (log only)
  'simulate',  // Intercept and return simulated responses
  'record',    // Execute real operations but record for replay
]);

export type SandboxMode = z.infer<typeof SandboxModeSchema>;

/**
 * Latency configuration
 */
export const LatencyConfigSchema = z.object({
  min: z.number().int().min(0),
  max: z.number().int().min(0),
});

export type LatencyConfig = z.infer<typeof LatencyConfigSchema>;

/**
 * Simulation configuration
 */
export const SimulationConfigSchema = z.object({
  successRate: z.number().min(0).max(1).default(0.95),
  latencyMs: LatencyConfigSchema.optional(),
  generateFakeIds: z.boolean().default(true),
  errorCodes: z.array(z.number()).optional(), // Custom error codes to simulate
});

export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;

/**
 * Recording configuration
 */
export const RecordingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  storagePath: z.string().optional(),
  maxRecordings: z.number().int().positive().default(1000),
  ttlMs: z.number().int().positive().optional(),
});

export type RecordingConfig = z.infer<typeof RecordingConfigSchema>;

/**
 * Sandbox configuration
 */
export const SandboxConfigSchema = z.object({
  mode: SandboxModeSchema,
  clientId: z.string(),
  platforms: z.array(z.string()).optional(), // Specific platforms, or all if omitted
  operations: z.array(z.string()).optional(), // Specific operations, or all if omitted
  simulationConfig: SimulationConfigSchema.optional(),
  recordingConfig: RecordingConfigSchema.optional(),
  expiresAt: z.string().datetime().optional(),
});

export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;

/**
 * Simulated response
 */
export const SimulatedResponseSchema = z.object({
  statusCode: z.number().int(),
  body: z.any(),
  headers: z.record(z.string()).optional(),
  latencyMs: z.number().int().optional(),
});

export type SimulatedResponse = z.infer<typeof SimulatedResponseSchema>;

/**
 * Interception record
 */
export const SandboxInterceptionSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  clientId: z.string(),
  operation: z.string(),
  platform: z.string(),
  request: z.object({
    method: z.string().optional(),
    endpoint: z.string().optional(),
    body: z.any(),
  }),
  intercepted: z.boolean(),
  simulated: z.boolean(),
  simulatedResponse: SimulatedResponseSchema.optional(),
  actualResponse: z.any().optional(),
});

export type SandboxInterception = z.infer<typeof SandboxInterceptionSchema>;

/**
 * Recording filter options
 */
export interface RecordingFilterOptions {
  operation?: string;
  platform?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

/**
 * Interception input
 */
export interface InterceptionInput {
  operation: string;
  platform: string;
  request: any;
  response?: SimulatedResponse;
}

/**
 * Validation helper
 */
export function validateSandboxConfig(data: unknown): data is SandboxConfig {
  return SandboxConfigSchema.safeParse(data).success;
}
```

#### 2.2 Implement SandboxModeService

**File:** `packages/rollout/sandbox/src/sandbox-mode-service.ts`

```typescript
import { nanoid } from 'nanoid';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  SandboxConfig,
  SandboxMode,
  SimulatedResponse,
  SandboxInterception,
  RecordingFilterOptions,
  InterceptionInput,
} from './sandbox-types';

const tracer = trace.getTracer('sandbox-mode-service');

export interface SandboxConfigStore {
  get(key: string): Promise<SandboxConfig | null>;
  set(key: string, config: SandboxConfig): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface InterceptionLog {
  record(interception: SandboxInterception): Promise<void>;
  getRecordings(clientId: string, filters?: RecordingFilterOptions): Promise<SandboxInterception[]>;
  clearRecordings(clientId: string): Promise<void>;
}

export interface SandboxTelemetry {
  recordInterception(clientId: string, operation: string, platform: string): void;
}

export interface SandboxModeServiceConfig {
  configStore: SandboxConfigStore;
  interceptionLog: InterceptionLog;
  telemetry: SandboxTelemetry;
  defaultExpirationMs?: number;
}

const DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export class SandboxModeService {
  private configStore: SandboxConfigStore;
  private interceptionLog: InterceptionLog;
  private telemetry: SandboxTelemetry;
  private defaultExpirationMs: number;

  constructor(config: SandboxModeServiceConfig) {
    this.configStore = config.configStore;
    this.interceptionLog = config.interceptionLog;
    this.telemetry = config.telemetry;
    this.defaultExpirationMs = config.defaultExpirationMs ?? DEFAULT_EXPIRATION_MS;
  }

  /**
   * Enable sandbox mode for a client
   */
  async enableSandbox(
    clientId: string,
    config: Partial<SandboxConfig>
  ): Promise<void> {
    return tracer.startActiveSpan('enableSandbox', async (span) => {
      span.setAttribute('client_id', clientId);
      span.setAttribute('mode', config.mode ?? 'simulate');

      try {
        const fullConfig: SandboxConfig = {
          mode: config.mode ?? 'simulate',
          clientId,
          platforms: config.platforms,
          operations: config.operations,
          simulationConfig: config.simulationConfig ?? {
            successRate: 0.95,
            latencyMs: { min: 100, max: 500 },
            generateFakeIds: true,
          },
          recordingConfig: config.recordingConfig ?? {
            enabled: true,
            maxRecordings: 1000,
          },
          expiresAt:
            config.expiresAt ??
            new Date(Date.now() + this.defaultExpirationMs).toISOString(),
        };

        await this.configStore.set(`sandbox:${clientId}`, fullConfig);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Disable sandbox mode for a client
   */
  async disableSandbox(clientId: string): Promise<void> {
    await this.configStore.delete(`sandbox:${clientId}`);
  }

  /**
   * Get sandbox configuration
   */
  async getSandboxConfig(clientId: string): Promise<SandboxConfig | null> {
    const config = await this.configStore.get(`sandbox:${clientId}`);

    if (!config) {
      return null;
    }

    // Check expiration
    if (config.expiresAt && new Date(config.expiresAt) < new Date()) {
      await this.disableSandbox(clientId);
      return null;
    }

    return config;
  }

  /**
   * Check if sandbox is enabled for a client
   */
  async isSandboxed(clientId: string): Promise<boolean> {
    const config = await this.getSandboxConfig(clientId);
    return config !== null && config.mode !== 'off';
  }

  /**
   * Check if an operation should be intercepted
   */
  async shouldIntercept(
    clientId: string,
    operation: string,
    platform: string
  ): Promise<boolean> {
    const config = await this.getSandboxConfig(clientId);

    if (!config || config.mode === 'off') {
      return false;
    }

    // Check platform filter
    if (config.platforms && config.platforms.length > 0) {
      if (!config.platforms.includes(platform)) {
        return false;
      }
    }

    // Check operation filter
    if (config.operations && config.operations.length > 0) {
      if (!config.operations.includes(operation)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate simulated response
   */
  async simulateResponse(
    clientId: string,
    operation: string,
    platform: string,
    request: any
  ): Promise<SimulatedResponse> {
    const config = await this.getSandboxConfig(clientId);

    if (!config || config.mode !== 'simulate') {
      throw new Error('Sandbox simulation not enabled');
    }

    const simConfig = config.simulationConfig ?? {
      successRate: 0.95,
      latencyMs: { min: 100, max: 500 },
      generateFakeIds: true,
    };

    // Calculate latency
    const latencyMs = simConfig.latencyMs
      ? Math.floor(
          Math.random() * (simConfig.latencyMs.max - simConfig.latencyMs.min) +
            simConfig.latencyMs.min
        )
      : 0;

    // Determine success/failure
    const isSuccess = Math.random() < simConfig.successRate;

    if (isSuccess) {
      return {
        statusCode: 200,
        body: this.generateSuccessBody(operation, platform, simConfig.generateFakeIds),
        headers: { 'x-sandbox': 'true' },
        latencyMs,
      };
    } else {
      return {
        statusCode: this.randomErrorCode(simConfig.errorCodes),
        body: { error: 'Simulated error', code: 'SANDBOX_ERROR' },
        headers: { 'x-sandbox': 'true' },
        latencyMs,
      };
    }
  }

  /**
   * Record an interception
   */
  async recordInterception(
    clientId: string,
    input: InterceptionInput
  ): Promise<void> {
    const config = await this.getSandboxConfig(clientId);

    if (!config?.recordingConfig?.enabled) {
      return;
    }

    const interception: SandboxInterception = {
      id: `int_${nanoid(12)}`,
      timestamp: new Date().toISOString(),
      clientId,
      operation: input.operation,
      platform: input.platform,
      request: {
        body: input.request,
      },
      intercepted: true,
      simulated: !!input.response,
      simulatedResponse: input.response,
    };

    await this.interceptionLog.record(interception);
    this.telemetry.recordInterception(clientId, input.operation, input.platform);
  }

  /**
   * Get recordings for a client
   */
  async getRecordings(
    clientId: string,
    filters?: RecordingFilterOptions
  ): Promise<SandboxInterception[]> {
    return this.interceptionLog.getRecordings(clientId, filters);
  }

  /**
   * Clear recordings for a client
   */
  async clearRecordings(clientId: string): Promise<void> {
    await this.interceptionLog.clearRecordings(clientId);
  }

  /**
   * Create a wrapper function that respects sandbox mode
   */
  createSandboxWrapper<T extends (...args: any[]) => Promise<any>>(
    clientId: string,
    operation: string,
    platform: string,
    originalFn: T
  ): T {
    return (async (...args: Parameters<T>) => {
      const shouldIntercept = await this.shouldIntercept(
        clientId,
        operation,
        platform
      );

      if (!shouldIntercept) {
        return originalFn(...args);
      }

      const config = await this.getSandboxConfig(clientId);

      if (config?.mode === 'intercept') {
        // Log and block
        await this.recordInterception(clientId, {
          operation,
          platform,
          request: args[0],
        });
        return { intercepted: true, sandbox: true };
      }

      if (config?.mode === 'simulate') {
        // Generate simulated response
        const response = await this.simulateResponse(
          clientId,
          operation,
          platform,
          args[0]
        );

        await this.recordInterception(clientId, {
          operation,
          platform,
          request: args[0],
          response,
        });

        // Simulate latency
        if (response.latencyMs) {
          await this.delay(response.latencyMs);
        }

        return response.body;
      }

      if (config?.mode === 'record') {
        // Execute real operation and record
        const result = await originalFn(...args);
        await this.recordInterception(clientId, {
          operation,
          platform,
          request: args[0],
        });
        return result;
      }

      return originalFn(...args);
    }) as T;
  }

  private generateSuccessBody(
    operation: string,
    platform: string,
    generateFakeIds: boolean
  ): any {
    const id = generateFakeIds
      ? `sandbox_${platform}_${nanoid(12)}`
      : undefined;

    switch (operation) {
      case 'publish':
        return {
          id,
          url: `https://sandbox.${platform}.com/post/${id}`,
          createdAt: new Date().toISOString(),
          sandbox: true,
        };
      case 'like':
        return { success: true, sandbox: true };
      case 'comment':
        return { id, sandbox: true };
      case 'dm':
        return { messageId: id, sandbox: true };
      default:
        return { success: true, id, sandbox: true };
    }
  }

  private randomErrorCode(errorCodes?: number[]): number {
    const codes = errorCodes ?? [400, 401, 403, 429, 500];
    return codes[Math.floor(Math.random() * codes.length)];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### Phase 3: Verification

```bash
# Run tests
cd packages/rollout/sandbox
pnpm test src/__tests__/sandbox-types.test.ts
pnpm test src/__tests__/sandbox-mode-service.test.ts

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/rollout/sandbox/package.json` | Package configuration |
| Create | `packages/rollout/sandbox/src/sandbox-types.ts` | Type definitions |
| Create | `packages/rollout/sandbox/src/sandbox-mode-service.ts` | SandboxModeService class |
| Create | `packages/rollout/sandbox/src/__tests__/sandbox-types.test.ts` | Type tests |
| Create | `packages/rollout/sandbox/src/__tests__/sandbox-mode-service.test.ts` | Service tests |
| Create | `packages/rollout/sandbox/src/index.ts` | Public exports |

---

## Acceptance Criteria

- [ ] Four sandbox modes supported: off, intercept, simulate, record
- [ ] Platform and operation filters allow targeted sandboxing
- [ ] Simulated responses include configurable success rate
- [ ] Latency simulation adds realistic delays
- [ ] Interception recording captures all blocked operations
- [ ] Sandbox wrapper transparently intercepts function calls
- [ ] Expiration auto-disables stale sandbox configs
- [ ] All tests pass with >80% coverage

---

## Test Requirements

### Unit Tests
- Mode validation for all enum values
- Config expiration handling
- Success rate probability
- Latency range compliance
- Filter matching logic

### Integration Tests
- Full wrapper interception flow
- Recording persistence
- Multi-platform sandbox configuration

---

## Security & Safety Checklist

- [ ] Sandbox expiration prevents indefinite blocking
- [ ] Recordings don't persist sensitive data
- [ ] Clear x-sandbox headers on responses
- [ ] Telemetry tracks all interceptions
- [ ] No bypass paths when sandbox enabled

---

## JSON Task Block

```json
{
  "task_id": "S5-A2",
  "name": "Sandbox Mode Configuration",
  "description": "SandboxModeService for safe testing without real side effects",
  "status": "pending",
  "dependencies": ["S5-A1"],
  "blocks": ["S5-A3", "S5-D1"],
  "agent": "A",
  "sprint": 5,
  "complexity": "medium",
  "estimated_files": 6,
  "test_coverage_target": 80,
  "package": "@rtv/rollout/sandbox",
  "exports": [
    "SandboxModeService",
    "SandboxConfig",
    "SandboxMode",
    "SimulatedResponse",
    "SandboxInterception"
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
  - docs/05-policy-safety/compliance-safety-policy.md
  - docs/07-engineering-process/testing-strategy.md

writes_made: []

decisions:
  - decision: "Four sandbox modes (off/intercept/simulate/record)"
    rationale: "Different testing scenarios need different levels of interception"
  - decision: "Configurable success rate and latency"
    rationale: "Realistic simulation requires variability like production"
  - decision: "Auto-expiration on sandbox configs"
    rationale: "Prevents accidentally blocking production operations indefinitely"

blockers: []
questions: []
```
