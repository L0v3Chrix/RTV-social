# Build Prompt: S0-A3 — Core Packages Scaffold

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-A3 |
| **Sprint** | 0 — Foundation |
| **Agent** | A — Repository & Core Packages |
| **Complexity** | Medium |
| **Estimated Effort** | 2-3 hours |
| **Dependencies** | S0-A1, S0-A2 |
| **Blocks** | S0-A4, S0-A5, Sprint 1 |

---

## Context

### What We're Building

Scaffold the three core shared packages that will be used across the entire platform:

- **@rtv/core**: Core utilities, constants, and shared logic
- **@rtv/types**: TypeScript type definitions and schemas
- **@rtv/utils**: Utility functions (string, date, validation helpers)

### Why This Matters

- **Code reuse**: Shared packages prevent duplication
- **Type consistency**: Single source of truth for types
- **Clear boundaries**: Packages enforce architectural separation
- **Testing isolation**: Each package can be tested independently

### Spec References

- `/docs/07-engineering-process/engineering-handbook.md#2-repository-structure`
- `/docs/01-architecture/system-architecture-v3.md#3-runtime-components`

---

## Prerequisites

### Completed Tasks

- [x] S0-A1: Monorepo scaffold initialized
- [x] S0-A2: TypeScript configured

### Required Files

- `package.json` with workspaces
- `tsconfig.base.json` exists

---

## Instructions

### Phase 1: Test First (TDD)

**File: `scripts/verify-packages.test.ts`**

```typescript
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('Core Packages Structure', () => {
  const packagesDir = resolve(__dirname, '..', 'packages');

  const packages = ['core', 'types', 'utils'];

  packages.forEach((pkg) => {
    describe(`@rtv/${pkg}`, () => {
      const pkgDir = resolve(packagesDir, pkg);

      test('package directory exists', () => {
        expect(existsSync(pkgDir)).toBe(true);
      });

      test('package.json exists', () => {
        expect(existsSync(resolve(pkgDir, 'package.json'))).toBe(true);
      });

      test('package.json has correct name', () => {
        const pkgJson = JSON.parse(
          readFileSync(resolve(pkgDir, 'package.json'), 'utf-8')
        );
        expect(pkgJson.name).toBe(`@rtv/${pkg}`);
      });

      test('src directory exists', () => {
        expect(existsSync(resolve(pkgDir, 'src'))).toBe(true);
      });

      test('src/index.ts exists', () => {
        expect(existsSync(resolve(pkgDir, 'src', 'index.ts'))).toBe(true);
      });

      test('tsconfig.json exists', () => {
        expect(existsSync(resolve(pkgDir, 'tsconfig.json'))).toBe(true);
      });

      test('tsconfig.json extends base config', () => {
        const tsconfig = JSON.parse(
          readFileSync(resolve(pkgDir, 'tsconfig.json'), 'utf-8')
        );
        expect(tsconfig.extends).toMatch(/tsconfig\.(base|node)\.json/);
      });
    });
  });
});
```

### Phase 2: Implementation

#### Step 1: Create @rtv/types Package

```bash
# Create directory structure
mkdir -p packages/types/src

# Create package.json
cat > packages/types/package.json << 'EOF'
{
  "name": "@rtv/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./*": {
      "types": "./dist/*.d.ts",
      "import": "./dist/*.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist .turbo",
    "dev": "tsc --watch",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "workspace:*"
  }
}
EOF

# Create tsconfig.json
cat > packages/types/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Create src/index.ts
cat > packages/types/src/index.ts << 'EOF'
/**
 * @rtv/types - Shared TypeScript type definitions
 *
 * This package contains all shared types, interfaces, and schemas
 * used across the RTV Social Automation Platform.
 */

// Re-export all types
export * from './common';
export * from './tenant';
export * from './result';
EOF

# Create common types
cat > packages/types/src/common.ts << 'EOF'
/**
 * Common type definitions used across the platform
 */

/** ISO 8601 date string */
export type ISODateString = string;

/** UUID v4 string */
export type UUID = string;

/** Timestamp in milliseconds since epoch */
export type Timestamp = number;

/** JSON-serializable value */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** JSON object type */
export type JsonObject = { [key: string]: JsonValue };

/** Brand type for nominal typing */
export type Brand<T, B> = T & { __brand: B };

/** Branded string types */
export type ClientId = Brand<string, 'ClientId'>;
export type UserId = Brand<string, 'UserId'>;
export type PlatformAccountId = Brand<string, 'PlatformAccountId'>;
EOF

# Create tenant types
cat > packages/types/src/tenant.ts << 'EOF'
/**
 * Multi-tenant context types
 */

import type { ClientId, UserId, PlatformAccountId } from './common';

/**
 * Tenant context required for all operations
 * @see /docs/05-policy-safety/multi-tenant-isolation.md#5-tenant-context
 */
export interface TenantContext {
  /** The client (tenant) ID - always required */
  readonly clientId: ClientId;

  /** The user performing the action - required for audit */
  readonly userId: UserId;

  /** Platform account ID - required for platform operations */
  readonly platformAccountId?: PlatformAccountId;

  /** Execution lane: api or browser */
  readonly lane: 'api' | 'browser';

  /** Request correlation ID for tracing */
  readonly correlationId: string;
}

/**
 * Create a TenantContext from raw values
 */
export function createTenantContext(params: {
  clientId: string;
  userId: string;
  platformAccountId?: string;
  lane: 'api' | 'browser';
  correlationId?: string;
}): TenantContext {
  return {
    clientId: params.clientId as ClientId,
    userId: params.userId as UserId,
    platformAccountId: params.platformAccountId as PlatformAccountId | undefined,
    lane: params.lane,
    correlationId: params.correlationId ?? crypto.randomUUID(),
  };
}
EOF

# Create result types
cat > packages/types/src/result.ts << 'EOF'
/**
 * Result type for error handling without exceptions
 */

/**
 * Success result
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Error result
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type - either Ok or Err
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Create a success result
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Create an error result
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Check if result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Check if result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/**
 * Unwrap a result, throwing if Err
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwrap a result with a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}
EOF
```

#### Step 2: Create @rtv/utils Package

```bash
# Create directory structure
mkdir -p packages/utils/src

# Create package.json
cat > packages/utils/package.json << 'EOF'
{
  "name": "@rtv/utils",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./*": {
      "types": "./dist/*.d.ts",
      "import": "./dist/*.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist .turbo",
    "dev": "tsc --watch",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@rtv/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "vitest": "^1.2.0"
  }
}
EOF

# Create tsconfig.json
cat > packages/utils/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Create src/index.ts
cat > packages/utils/src/index.ts << 'EOF'
/**
 * @rtv/utils - Utility functions for RTV Social Automation Platform
 */

export * from './string';
export * from './date';
export * from './validation';
export * from './async';
EOF

# Create string utilities
cat > packages/utils/src/string.ts << 'EOF'
/**
 * String utility functions
 */

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Slugify a string for URLs
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a random string
 */
export function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Check if a string is a valid UUID
 */
export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
EOF

# Create date utilities
cat > packages/utils/src/date.ts << 'EOF'
/**
 * Date utility functions
 */

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Get current ISO date string
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Add milliseconds to a date
 */
export function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

/**
 * Add seconds to a date
 */
export function addSeconds(date: Date, seconds: number): Date {
  return addMs(date, seconds * 1000);
}

/**
 * Add minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return addMs(date, minutes * 60 * 1000);
}

/**
 * Add hours to a date
 */
export function addHours(date: Date, hours: number): Date {
  return addMs(date, hours * 60 * 60 * 1000);
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  return addMs(date, days * 24 * 60 * 60 * 1000);
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}
EOF

# Create validation utilities
cat > packages/utils/src/validation.ts << 'EOF'
/**
 * Validation utility functions
 */

import type { Result } from '@rtv/types';
import { ok, err } from '@rtv/types';

/**
 * Validate that a value is not null or undefined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  name: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${name} must be defined`);
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a string to a positive integer
 */
export function parsePositiveInt(str: string): Result<number, string> {
  const num = parseInt(str, 10);
  if (isNaN(num)) {
    return err('Invalid number');
  }
  if (num <= 0) {
    return err('Number must be positive');
  }
  return ok(num);
}

/**
 * Validate an object has all required keys
 */
export function hasRequiredKeys<T extends Record<string, unknown>>(
  obj: T,
  keys: (keyof T)[]
): boolean {
  return keys.every((key) => key in obj && obj[key] !== undefined);
}
EOF

# Create async utilities
cat > packages/utils/src/async.ts << 'EOF'
/**
 * Async utility functions
 */

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Execute with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Execute promises in batches
 */
export async function batchExecute<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }

  return results;
}
EOF
```

#### Step 3: Create @rtv/core Package

```bash
# Create directory structure
mkdir -p packages/core/src

# Create package.json
cat > packages/core/package.json << 'EOF'
{
  "name": "@rtv/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./*": {
      "types": "./dist/*.d.ts",
      "import": "./dist/*.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist .turbo",
    "dev": "tsc --watch",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@rtv/types": "workspace:*",
    "@rtv/utils": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "vitest": "^1.2.0"
  }
}
EOF

# Create tsconfig.json
cat > packages/core/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Create src/index.ts
cat > packages/core/src/index.ts << 'EOF'
/**
 * @rtv/core - Core utilities and shared logic
 *
 * This package provides core functionality used across the
 * RTV Social Automation Platform.
 */

export * from './constants';
export * from './errors';
export * from './config';

// Re-export types and utils for convenience
export * from '@rtv/types';
export * from '@rtv/utils';
EOF

# Create constants
cat > packages/core/src/constants.ts << 'EOF'
/**
 * Platform constants and configuration values
 */

/**
 * Supported social media platforms
 */
export const PLATFORMS = [
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'x',
  'skool',
] as const;

export type Platform = (typeof PLATFORMS)[number];

/**
 * Platform display names
 */
export const PLATFORM_NAMES: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X (Twitter)',
  skool: 'Skool',
};

/**
 * Default budget limits
 */
export const DEFAULT_BUDGETS = {
  maxTokensPerEpisode: 100_000,
  maxDurationMs: 300_000, // 5 minutes
  maxRetries: 3,
  maxToolCalls: 50,
} as const;

/**
 * Rate limits (per minute)
 */
export const RATE_LIMITS: Record<Platform, number> = {
  facebook: 30,
  instagram: 30,
  tiktok: 20,
  youtube: 10,
  linkedin: 20,
  x: 50,
  skool: 10,
};
EOF

# Create errors
cat > packages/core/src/errors.ts << 'EOF'
/**
 * Custom error classes for the platform
 */

/**
 * Base error class for all platform errors
 */
export class RTVError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RTVError';
  }
}

/**
 * Error thrown when tenant context is missing or invalid
 */
export class TenantContextError extends RTVError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TENANT_CONTEXT_ERROR', details);
    this.name = 'TenantContextError';
  }
}

/**
 * Error thrown when a policy check fails
 */
export class PolicyError extends RTVError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'POLICY_ERROR', details);
    this.name = 'PolicyError';
  }
}

/**
 * Error thrown when budget is exceeded
 */
export class BudgetExceededError extends RTVError {
  constructor(
    budgetType: 'tokens' | 'time' | 'retries' | 'tool_calls',
    limit: number,
    used: number
  ) {
    super(
      `Budget exceeded: ${budgetType} (used ${used}/${limit})`,
      'BUDGET_EXCEEDED',
      { budgetType, limit, used }
    );
    this.name = 'BudgetExceededError';
  }
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends RTVError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', { resource, id });
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when a platform operation fails
 */
export class PlatformError extends RTVError {
  constructor(
    platform: string,
    operation: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Platform error (${platform}/${operation}): ${message}`,
      'PLATFORM_ERROR',
      { platform, operation, ...details }
    );
    this.name = 'PlatformError';
  }
}
EOF

# Create config
cat > packages/core/src/config.ts << 'EOF'
/**
 * Configuration utilities
 */

/**
 * Get a required environment variable
 * @throws Error if the variable is not set
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Get an optional environment variable with a default
 */
export function getEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

/**
 * Get an optional environment variable as a number
 */
export function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get an optional environment variable as a boolean
 */
export function getEnvBool(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env['NODE_ENV'] === 'development';
}

/**
 * Check if running in test environment
 */
export function isTest(): boolean {
  return process.env['NODE_ENV'] === 'test';
}
EOF
```

#### Step 4: Install Dependencies

```bash
# Install workspace dependencies
pnpm install
```

### Phase 3: Verification

```bash
# Verify package structure
ls -la packages/

# Verify each package has correct structure
for pkg in core types utils; do
  echo "=== @rtv/$pkg ==="
  ls -la packages/$pkg/
  ls -la packages/$pkg/src/
done

# Build all packages
pnpm turbo build

# Type check all packages
pnpm turbo typecheck

# Run structure tests
pnpm test -- scripts/verify-packages.test.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/types/package.json` | Types package manifest |
| Create | `packages/types/tsconfig.json` | Types TypeScript config |
| Create | `packages/types/src/index.ts` | Types entry point |
| Create | `packages/types/src/common.ts` | Common type definitions |
| Create | `packages/types/src/tenant.ts` | Tenant context types |
| Create | `packages/types/src/result.ts` | Result type utilities |
| Create | `packages/utils/package.json` | Utils package manifest |
| Create | `packages/utils/tsconfig.json` | Utils TypeScript config |
| Create | `packages/utils/src/index.ts` | Utils entry point |
| Create | `packages/utils/src/string.ts` | String utilities |
| Create | `packages/utils/src/date.ts` | Date utilities |
| Create | `packages/utils/src/validation.ts` | Validation utilities |
| Create | `packages/utils/src/async.ts` | Async utilities |
| Create | `packages/core/package.json` | Core package manifest |
| Create | `packages/core/tsconfig.json` | Core TypeScript config |
| Create | `packages/core/src/index.ts` | Core entry point |
| Create | `packages/core/src/constants.ts` | Platform constants |
| Create | `packages/core/src/errors.ts` | Custom error classes |
| Create | `packages/core/src/config.ts` | Config utilities |
| Create | `scripts/verify-packages.test.ts` | Package structure tests |

---

## Acceptance Criteria

- [ ] `@rtv/types` package exists with type definitions
- [ ] `@rtv/utils` package exists with utility functions
- [ ] `@rtv/core` package exists with core logic
- [ ] All packages have `src/index.ts` entry points
- [ ] All packages extend base tsconfig
- [ ] `pnpm turbo build` succeeds for all packages
- [ ] `pnpm turbo typecheck` passes for all packages
- [ ] Package structure tests pass

---

## Test Requirements

### Unit Tests

- Verify Result type utilities work correctly
- Verify string utilities produce expected output
- Verify date utilities calculate correctly
- Verify async utilities (retry, timeout) work

### Integration Tests

- Cross-package imports work (core → types → utils)
- Build outputs are valid ES modules

---

## Security & Safety Checklist

- [ ] No hardcoded secrets in any package
- [ ] Error messages don't leak sensitive data
- [ ] Config utilities validate environment variables
- [ ] TenantContext is immutable (readonly fields)

---

## JSON Task Block

```json
{
  "task_id": "S0-A3",
  "name": "Core Packages Scaffold",
  "sprint": 0,
  "agent": "A",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 3,
  "dependencies": ["S0-A1", "S0-A2"],
  "blocks": ["S0-A4", "S0-A5"],
  "tags": ["packages", "types", "utils", "core"],
  "acceptance_criteria": [
    "@rtv/types package exists",
    "@rtv/utils package exists",
    "@rtv/core package exists",
    "all packages build successfully",
    "all packages typecheck"
  ],
  "created_at": "2025-01-16T00:00:00Z",
  "updated_at": null,
  "completed_at": null
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "agent_id": null,
  "decisions": [],
  "artifacts": [],
  "notes": []
}
```

---

## Next Steps

After completing this task:

1. **S0-A4**: Configure ESLint + Prettier (depends on packages existing)
2. **S0-A5**: Set up shared tsconfig inheritance
