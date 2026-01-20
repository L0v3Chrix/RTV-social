# Build Prompt: S0-C5 — Environment Variables Setup

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-C5 |
| **Sprint** | 0 — Foundation |
| **Agent** | C — CI/CD Pipeline |
| **Complexity** | Low |
| **Estimated Effort** | 1 hour |
| **Dependencies** | S0-C1, S0-C4 |
| **Blocks** | Sprint 1 |

---

## Context

### What We're Building

Create a comprehensive environment variables management system with validation, documentation, and secure defaults.

### Why This Matters

- **Security**: Secrets never hardcoded
- **Consistency**: Same variables across environments
- **Validation**: App fails fast if config is wrong
- **Documentation**: Developers know what's needed

### Spec References

- `/docs/05-policy-safety/secrets-key-management.md`
- `/docs/07-engineering-process/ci-cd-spec.md#6-environment-management`

**Critical Constraint (from secrets-key-management.md):**
> All secrets must be loaded from environment variables. No secrets in code, configs, or logs.

---

## Prerequisites

### Completed Tasks

- [x] S0-C1: GitHub Actions workflow
- [x] S0-C4: Preview deployments

### Required Files

- `packages/core/` exists
- `apps/web/` exists

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/core/src/__tests__/env.test.ts`**

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { validateEnv, getEnvConfig, type EnvConfig } from '../env';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('validateEnv throws if required vars missing', () => {
    delete process.env['DATABASE_URL'];

    expect(() => validateEnv()).toThrow('DATABASE_URL');
  });

  test('validateEnv passes with all required vars', () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/test';
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    process.env['NODE_ENV'] = 'test';

    expect(() => validateEnv()).not.toThrow();
  });

  test('getEnvConfig returns typed configuration', () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/test';
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    process.env['NODE_ENV'] = 'test';

    const config = getEnvConfig();

    expect(config.databaseUrl).toBe('postgresql://localhost:5432/test');
    expect(config.nodeEnv).toBe('test');
    expect(config.isProduction).toBe(false);
  });

  test('defaults are applied for optional vars', () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/test';
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    process.env['NODE_ENV'] = 'development';

    const config = getEnvConfig();

    expect(config.port).toBe(3000);
    expect(config.logLevel).toBe('info');
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Environment Schema

**File: `packages/core/src/env.ts`**

```bash
cat > packages/core/src/env.ts << 'EOF'
/**
 * Environment configuration management
 *
 * Validates and provides typed access to environment variables.
 * Fail-fast on missing required configuration.
 */

/**
 * Environment variable schema
 */
interface EnvSchema {
  // Required
  DATABASE_URL: string;
  REDIS_URL: string;
  NODE_ENV: 'development' | 'test' | 'production';

  // Optional with defaults
  PORT?: string;
  LOG_LEVEL?: string;

  // Secrets (required in production)
  OPENAI_API_KEY?: string;
  GHL_API_KEY?: string;
  GHL_LOCATION_ID?: string;

  // Vercel (auto-injected)
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;

  // Turbo (optional)
  TURBO_TOKEN?: string;
  TURBO_TEAM?: string;
}

/**
 * Typed environment configuration
 */
export interface EnvConfig {
  // Core
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;

  // Server
  port: number;
  logLevel: string;

  // Database
  databaseUrl: string;

  // Redis
  redisUrl: string;

  // AI
  openaiApiKey: string | undefined;

  // GoHighLevel
  ghlApiKey: string | undefined;
  ghlLocationId: string | undefined;

  // Vercel
  isVercel: boolean;
  vercelEnv: string | undefined;
  vercelUrl: string | undefined;
}

/**
 * Required environment variables
 */
const REQUIRED_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
] as const;

/**
 * Variables required in production
 */
const PRODUCTION_REQUIRED_VARS = [
  'OPENAI_API_KEY',
] as const;

/**
 * Validate that all required environment variables are set
 * @throws Error if validation fails
 */
export function validateEnv(): void {
  const missing: string[] = [];
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';

  // Check required vars
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check production-required vars
  if (nodeEnv === 'production') {
    for (const varName of PRODUCTION_REQUIRED_VARS) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'See .env.example for required variables.'
    );
  }
}

/**
 * Get typed environment configuration
 * @throws Error if required vars are missing
 */
export function getEnvConfig(): EnvConfig {
  validateEnv();

  const nodeEnv = (process.env['NODE_ENV'] ?? 'development') as EnvConfig['nodeEnv'];

  return {
    // Core
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
    isTest: nodeEnv === 'test',

    // Server
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    logLevel: process.env['LOG_LEVEL'] ?? 'info',

    // Database
    databaseUrl: process.env['DATABASE_URL']!,

    // Redis
    redisUrl: process.env['REDIS_URL']!,

    // AI
    openaiApiKey: process.env['OPENAI_API_KEY'],

    // GoHighLevel
    ghlApiKey: process.env['GHL_API_KEY'],
    ghlLocationId: process.env['GHL_LOCATION_ID'],

    // Vercel
    isVercel: process.env['VERCEL'] === '1',
    vercelEnv: process.env['VERCEL_ENV'],
    vercelUrl: process.env['VERCEL_URL'],
  };
}

/**
 * Singleton config instance (lazy loaded)
 */
let _config: EnvConfig | null = null;

/**
 * Get the global environment config
 */
export function env(): EnvConfig {
  if (!_config) {
    _config = getEnvConfig();
  }
  return _config;
}

/**
 * Reset config (for testing)
 */
export function resetEnvConfig(): void {
  _config = null;
}
EOF
```

#### Step 2: Create Root .env.example

**File: `.env.example`**

```bash
cat > .env.example << 'EOF'
# =============================================================================
# RTV Social Automation - Environment Variables
# =============================================================================
# Copy this file to .env.local and fill in your values
# NEVER commit .env.local or any file with actual secrets

# -----------------------------------------------------------------------------
# Core Configuration
# -----------------------------------------------------------------------------

# Environment: development, test, production
NODE_ENV=development

# Server port (default: 3000)
PORT=3000

# Log level: debug, info, warn, error
LOG_LEVEL=info

# -----------------------------------------------------------------------------
# Database (Required)
# -----------------------------------------------------------------------------

# PostgreSQL connection string
# Format: postgresql://user:password@host:port/database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rtv_dev

# Test database (used by tests)
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/rtv_test

# -----------------------------------------------------------------------------
# Redis (Required)
# -----------------------------------------------------------------------------

# Redis connection string
# Format: redis://[user:password@]host:port
REDIS_URL=redis://localhost:6379

# -----------------------------------------------------------------------------
# AI Providers
# -----------------------------------------------------------------------------

# OpenAI API key (required in production)
OPENAI_API_KEY=

# -----------------------------------------------------------------------------
# GoHighLevel Integration
# -----------------------------------------------------------------------------

# GHL Private Integration Token
GHL_API_KEY=

# GHL Location ID (sub-account)
GHL_LOCATION_ID=

# GHL Calendar ID (for booking)
GHL_CALENDAR_ID=

# GHL Webhook Secret (for verifying webhooks)
GHL_WEBHOOK_SECRET=

# -----------------------------------------------------------------------------
# External Services
# -----------------------------------------------------------------------------

# Vercel (auto-populated in Vercel deployments)
# VERCEL=1
# VERCEL_ENV=preview
# VERCEL_URL=my-app-xxxx.vercel.app

# Turbo Remote Cache (optional, for faster builds)
# TURBO_TOKEN=
# TURBO_TEAM=

# -----------------------------------------------------------------------------
# Feature Flags (Optional)
# -----------------------------------------------------------------------------

# Enable browser lane automation
FEATURE_BROWSER_LANE=false

# Enable engagement features
FEATURE_ENGAGEMENT=false

# Enable side effects (publishing)
FEATURE_SIDE_EFFECTS=false
EOF
```

#### Step 3: Create Web App .env.example

**File: `apps/web/.env.example`**

```bash
cat > apps/web/.env.example << 'EOF'
# =============================================================================
# RTV Web App - Environment Variables
# =============================================================================
# Copy to .env.local for local development

# Public variables (exposed to browser via NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001

# Server-only variables
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rtv_dev
REDIS_URL=redis://localhost:6379

# Authentication (add when auth is implemented)
# AUTH_SECRET=
# AUTH_URL=http://localhost:3000

# Feature flags
NEXT_PUBLIC_FEATURE_ENGAGEMENT=false
EOF
```

#### Step 4: Update .gitignore

```bash
# Ensure env files are ignored
cat >> .gitignore << 'EOF'

# Environment files
.env
.env.local
.env.*.local
.env.development
.env.test
.env.production

# Keep .env.example files
!.env.example
!**/.env.example
EOF
```

#### Step 5: Create Env Validation Script

**File: `scripts/validate-env.ts`**

```bash
cat > scripts/validate-env.ts << 'EOF'
#!/usr/bin/env npx tsx
/**
 * Validate environment configuration
 *
 * Usage: npx tsx scripts/validate-env.ts
 */

import { validateEnv, getEnvConfig } from '../packages/core/src/env';

function main() {
  console.log('🔍 Validating environment configuration...\n');

  try {
    validateEnv();
    const config = getEnvConfig();

    console.log('✅ Environment validation passed!\n');
    console.log('Configuration:');
    console.log('  NODE_ENV:', config.nodeEnv);
    console.log('  PORT:', config.port);
    console.log('  LOG_LEVEL:', config.logLevel);
    console.log('  DATABASE_URL:', config.databaseUrl.replace(/:[^:@]+@/, ':****@'));
    console.log('  REDIS_URL:', config.redisUrl);
    console.log('  OPENAI_API_KEY:', config.openaiApiKey ? '****' : '(not set)');
    console.log('  GHL_API_KEY:', config.ghlApiKey ? '****' : '(not set)');
    console.log('  IS_VERCEL:', config.isVercel);

    if (config.isProduction && !config.openaiApiKey) {
      console.log('\n⚠️  Warning: OPENAI_API_KEY not set (required for production)');
    }
  } catch (error) {
    console.error('❌ Environment validation failed!\n');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
EOF
```

#### Step 6: Update Package Exports

**File: `packages/core/src/index.ts`** (update)

```bash
cat > packages/core/src/index.ts << 'EOF'
/**
 * @rtv/core - Core utilities and shared logic
 */

export * from './constants';
export * from './errors';
export * from './config';
export * from './env';

// Re-export types and utils
export * from '@rtv/types';
export * from '@rtv/utils';
EOF
```

### Phase 3: Verification

```bash
# Copy example to local
cp .env.example .env.local

# Edit .env.local with real values
# (At minimum, set DATABASE_URL and REDIS_URL)

# Run validation script
npx tsx scripts/validate-env.ts

# Run tests
pnpm test -- packages/core/src/__tests__/env.test.ts

# Verify .gitignore
git status  # .env.local should not appear
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/core/src/env.ts` | Env validation and config |
| Create | `.env.example` | Root env template |
| Create | `apps/web/.env.example` | Web app env template |
| Create | `scripts/validate-env.ts` | Validation script |
| Modify | `.gitignore` | Ignore env files |
| Modify | `packages/core/src/index.ts` | Export env module |
| Create | `packages/core/src/__tests__/env.test.ts` | Env tests |

---

## Acceptance Criteria

- [ ] `.env.example` documents all variables
- [ ] `validateEnv()` throws on missing required vars
- [ ] `getEnvConfig()` returns typed configuration
- [ ] Production requires `OPENAI_API_KEY`
- [ ] `.env.local` is gitignored
- [ ] Validation script works
- [ ] Tests pass

---

## Test Requirements

### Unit Tests

- Validation fails on missing required vars
- Validation passes with all required vars
- Defaults applied for optional vars
- Config is correctly typed

### Integration Tests

- App starts with valid env
- App fails to start with invalid env

---

## Security & Safety Checklist

- [ ] No secrets in .env.example
- [ ] All .env files gitignored
- [ ] Secrets masked in validation output
- [ ] Production validation stricter

---

## JSON Task Block

```json
{
  "task_id": "S0-C5",
  "name": "Environment Variables Setup",
  "sprint": 0,
  "agent": "C",
  "status": "pending",
  "complexity": "low",
  "estimated_hours": 1,
  "dependencies": ["S0-C1", "S0-C4"],
  "blocks": [],
  "tags": ["configuration", "environment", "security"],
  "acceptance_criteria": [
    ".env.example complete",
    "validation function works",
    "typed config returned",
    "secrets gitignored"
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

Agent C (CI/CD Pipeline) tasks are complete.

Continue with:
- Agent D: Observability tasks (D1-D5)
