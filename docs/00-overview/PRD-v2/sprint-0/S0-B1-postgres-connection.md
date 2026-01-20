# Build Prompt: S0-B1 — Postgres Connection Setup

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-B1 |
| **Sprint** | 0 — Foundation |
| **Agent** | B — Database Schema |
| **Complexity** | Medium |
| **Estimated Effort** | 2-3 hours |
| **Dependencies** | S0-A1 (monorepo exists) |
| **Blocks** | S0-B2, S0-B3, S0-B4, S0-B5 |

---

## Context

### What We're Building

Set up PostgreSQL database connection using Drizzle ORM with connection pooling and proper configuration for development, test, and production environments.

### Why This Matters

- **Type-safe queries**: Drizzle provides TypeScript-first database access
- **Connection pooling**: Prevents connection exhaustion
- **Multi-environment**: Same code works across dev/test/prod
- **Migrations**: Schema versioning and rollback support

### Spec References

- `/docs/01-architecture/system-architecture-v3.md#5-data-model`
- `/docs/05-policy-safety/multi-tenant-isolation.md#4-data-layer`
- `/docs/07-engineering-process/engineering-handbook.md#5-database-conventions`

**Critical Constraint (from multi-tenant-isolation.md):**
> All database queries must be scoped by `client_id`. No query may access data across tenants without explicit system-level authorization.

---

## Prerequisites

### Completed Tasks

- [x] S0-A1: Monorepo scaffold initialized

### Required Tools

- PostgreSQL 15+ (local or cloud)
- pnpm

### Environment Variables Needed

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/rtv_dev
DATABASE_URL_TEST=postgresql://user:password@localhost:5432/rtv_test
```

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/db/src/__tests__/connection.test.ts`**

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { db, testConnection, closeConnection } from '../connection';

describe('Database Connection', () => {
  beforeAll(async () => {
    // Ensure we can connect
  });

  afterAll(async () => {
    await closeConnection();
  });

  test('testConnection returns true when database is available', async () => {
    const result = await testConnection();
    expect(result).toBe(true);
  });

  test('db client is defined', () => {
    expect(db).toBeDefined();
  });

  test('can execute raw query', async () => {
    const result = await db.execute('SELECT 1 as value');
    expect(result.rows[0]?.value).toBe(1);
  });

  test('connection uses correct database', async () => {
    const result = await db.execute('SELECT current_database() as db_name');
    expect(result.rows[0]?.db_name).toMatch(/rtv_/);
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Database Package

```bash
# Create package directory
mkdir -p packages/db/src

# Create package.json
cat > packages/db/package.json << 'EOF'
{
  "name": "@rtv/db",
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
    "./schema": {
      "types": "./dist/schema/index.d.ts",
      "import": "./dist/schema/index.js"
    },
    "./migrations": {
      "types": "./dist/migrations/index.d.ts",
      "import": "./dist/migrations/index.js"
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
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@rtv/types": "workspace:*",
    "drizzle-orm": "^0.29.3",
    "postgres": "^3.4.3"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "drizzle-kit": "^0.20.13",
    "typescript": "workspace:*",
    "vitest": "^1.2.0"
  }
}
EOF
```

#### Step 2: Create TypeScript Config

```bash
cat > packages/db/tsconfig.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  "references": [
    { "path": "../types" }
  ]
}
EOF
```

#### Step 3: Create Drizzle Config

```bash
cat > packages/db/drizzle.config.ts << 'EOF'
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/rtv_dev',
  },
  verbose: true,
  strict: true,
});
EOF
```

#### Step 4: Create Connection Module

**File: `packages/db/src/connection.ts`**

```bash
mkdir -p packages/db/src

cat > packages/db/src/connection.ts << 'EOF'
/**
 * Database connection management
 *
 * Uses postgres.js for connection pooling and Drizzle for ORM.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Connection configuration
const connectionConfig = {
  max: parseInt(process.env['DB_POOL_MAX'] ?? '10', 10),
  idle_timeout: parseInt(process.env['DB_IDLE_TIMEOUT'] ?? '20', 10),
  connect_timeout: parseInt(process.env['DB_CONNECT_TIMEOUT'] ?? '10', 10),
};

// Create postgres client
const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create the connection pool
const queryClient = postgres(connectionString, connectionConfig);

// Create Drizzle client
export const db = drizzle(queryClient);

/**
 * Test database connection
 * @returns true if connection successful
 */
export async function testConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Close all database connections
 * Call this during graceful shutdown
 */
export async function closeConnection(): Promise<void> {
  await queryClient.end();
}

/**
 * Get connection pool statistics
 */
export function getPoolStats() {
  return {
    // postgres.js doesn't expose detailed stats, but we can track usage
    maxConnections: connectionConfig.max,
    idleTimeout: connectionConfig.idle_timeout,
    connectTimeout: connectionConfig.connect_timeout,
  };
}

// Export the raw client for migrations
export { queryClient };
EOF
```

#### Step 5: Create Index Export

**File: `packages/db/src/index.ts`**

```bash
cat > packages/db/src/index.ts << 'EOF'
/**
 * @rtv/db - Database package
 *
 * Provides database connection, schema, and migrations
 * for the RTV Social Automation Platform.
 */

export { db, testConnection, closeConnection, getPoolStats } from './connection';

// Schema exports will be added as we create tables
// export * from './schema';
EOF
```

#### Step 6: Create Schema Directory

```bash
mkdir -p packages/db/src/schema
mkdir -p packages/db/src/migrations
mkdir -p packages/db/src/__tests__

# Create placeholder schema index
cat > packages/db/src/schema/index.ts << 'EOF'
/**
 * Database schema exports
 *
 * All table definitions are exported from here.
 */

// Tables will be added in subsequent tasks:
// - S0-B2: Core schema (clients, brand_kits, knowledge_bases)
// - S0-B3: Multi-tenant schema (client_id columns)
// - S0-B4: Audit schema (audit_events)

export {};
EOF

# Create migrations placeholder
cat > packages/db/src/migrations/index.ts << 'EOF'
/**
 * Migration utilities
 */

export {};
EOF
```

#### Step 7: Create Environment Template

```bash
cat > packages/db/.env.example << 'EOF'
# Database Connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rtv_dev

# Connection Pool Settings
DB_POOL_MAX=10
DB_IDLE_TIMEOUT=20
DB_CONNECT_TIMEOUT=10
EOF
```

#### Step 8: Update Root Package

```bash
# Add db package to workspaces (should already be covered by packages/*)
# Update root tsconfig.json to include db package reference

# Add db to project references in root tsconfig.json
# This is done by the next task or manually
```

#### Step 9: Install Dependencies

```bash
pnpm install
```

### Phase 3: Verification

```bash
# Navigate to db package
cd packages/db

# Verify package structure
ls -la

# Verify TypeScript compiles
pnpm typecheck

# Build the package
pnpm build

# Test connection (requires running Postgres)
# Start Postgres locally or use a cloud instance
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rtv_dev" pnpm test

# Verify Drizzle config
pnpm db:studio  # Opens Drizzle Studio (requires DB)
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/db/package.json` | Package manifest |
| Create | `packages/db/tsconfig.json` | TypeScript config |
| Create | `packages/db/drizzle.config.ts` | Drizzle ORM config |
| Create | `packages/db/src/connection.ts` | Connection management |
| Create | `packages/db/src/index.ts` | Package exports |
| Create | `packages/db/src/schema/index.ts` | Schema placeholder |
| Create | `packages/db/src/migrations/index.ts` | Migrations placeholder |
| Create | `packages/db/.env.example` | Environment template |
| Create | `packages/db/src/__tests__/connection.test.ts` | Connection tests |

---

## Acceptance Criteria

- [ ] `@rtv/db` package exists and builds
- [ ] Drizzle ORM configured with postgres.js driver
- [ ] Connection pooling configured with sensible defaults
- [ ] `testConnection()` function works
- [ ] `closeConnection()` for graceful shutdown
- [ ] Environment variables documented in `.env.example`
- [ ] Connection tests pass (with running Postgres)

---

## Test Requirements

### Unit Tests

- `testConnection` returns true with valid DB
- `testConnection` returns false with invalid DB
- Connection pool stats are accessible

### Integration Tests

- Can execute raw SQL queries
- Connection survives multiple queries
- Graceful shutdown works

---

## Security & Safety Checklist

- [ ] No hardcoded database credentials
- [ ] Connection string from environment variable only
- [ ] `.env` files in `.gitignore`
- [ ] Connection timeout prevents hanging
- [ ] Pool limits prevent resource exhaustion

---

## JSON Task Block

```json
{
  "task_id": "S0-B1",
  "name": "Postgres Connection Setup",
  "sprint": 0,
  "agent": "B",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 3,
  "dependencies": ["S0-A1"],
  "blocks": ["S0-B2", "S0-B3", "S0-B4", "S0-B5"],
  "tags": ["database", "postgres", "drizzle", "connection"],
  "acceptance_criteria": [
    "@rtv/db package exists",
    "connection pooling configured",
    "testConnection works",
    "connection tests pass"
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

## Rollback Procedure

```bash
# Remove db package
rm -rf packages/db

# Remove from pnpm-lock.yaml
pnpm install
```

---

## Next Steps

After completing this task:

1. **S0-B2**: Create core schema migrations
2. **S0-B3**: Add multi-tenant schema
3. **S0-B4**: Create audit event schema
4. **S0-B5**: Write seed data scripts
