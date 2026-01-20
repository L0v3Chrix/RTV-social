# Build Prompt: S0-A1 — Initialize Monorepo Structure

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-A1 |
| **Sprint** | 0 — Foundation |
| **Agent** | A — Repository & Core Packages |
| **Complexity** | Medium |
| **Estimated Effort** | 2-3 hours |
| **Dependencies** | None (first task) |
| **Blocks** | S0-A2, S0-A3, S0-A4, S0-A5 |

---

## Context

### What We're Building

Initialize a Turborepo-based monorepo structure for the RTV Social Automation Platform. This is the foundational task that all other Sprint 0 work depends on.

### Why This Matters

- **Single codebase**: All packages share tooling, types, and utilities
- **Atomic deployments**: Changes across packages deploy together
- **Developer experience**: Fast builds with Turborepo caching
- **Consistency**: Shared configurations across all packages

### Spec References

- `/docs/07-engineering-process/engineering-handbook.md#2-repository-structure`
- `/docs/07-engineering-process/ci-cd-spec.md#4-build-system`

---

## Prerequisites

### Required Tools

```bash
# Verify Node.js (20+ required)
node --version  # Should be v20.x or higher

# Verify pnpm (8+ required)
pnpm --version  # Should be v8.x or higher

# If pnpm not installed:
npm install -g pnpm@latest
```

### Required Environment

- GitHub repository created: `L0v3Chrix/RTV-social`
- Local clone available
- Write access to repository

---

## Instructions

### Phase 1: Test First (TDD)

Create tests that verify the monorepo structure BEFORE implementation.

**File: `scripts/verify-monorepo.test.ts`**

```typescript
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('Monorepo Structure', () => {
  const rootDir = resolve(__dirname, '..');

  test('package.json exists with workspaces', () => {
    const pkgPath = resolve(rootDir, 'package.json');
    expect(existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    expect(pkg.workspaces).toBeDefined();
    expect(pkg.workspaces).toContain('packages/*');
    expect(pkg.workspaces).toContain('apps/*');
  });

  test('pnpm-workspace.yaml exists', () => {
    const wsPath = resolve(rootDir, 'pnpm-workspace.yaml');
    expect(existsSync(wsPath)).toBe(true);
  });

  test('turbo.json exists with pipeline', () => {
    const turboPath = resolve(rootDir, 'turbo.json');
    expect(existsSync(turboPath)).toBe(true);

    const turbo = JSON.parse(readFileSync(turboPath, 'utf-8'));
    expect(turbo.pipeline).toBeDefined();
    expect(turbo.pipeline.build).toBeDefined();
    expect(turbo.pipeline.test).toBeDefined();
    expect(turbo.pipeline.lint).toBeDefined();
  });

  test('packages directory exists', () => {
    const pkgsDir = resolve(rootDir, 'packages');
    expect(existsSync(pkgsDir)).toBe(true);
  });

  test('apps directory exists', () => {
    const appsDir = resolve(rootDir, 'apps');
    expect(existsSync(appsDir)).toBe(true);
  });

  test('pnpm install succeeds', async () => {
    // This will be validated by running: pnpm install --dry-run
    expect(true).toBe(true); // Placeholder for CI validation
  });
});
```

### Phase 2: Implementation

#### Step 1: Initialize Root Package

```bash
# Create root package.json
cat > package.json << 'EOF'
{
  "name": "rtv-social-automation",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@8.15.0",
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "prepare": "husky install"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.1",
    "husky": "^9.0.10",
    "prettier": "^3.2.4",
    "turbo": "^1.12.0",
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
EOF
```

#### Step 2: Create pnpm Workspace Configuration

```bash
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/*'
  - 'apps/*'
EOF
```

#### Step 3: Create Turborepo Configuration

```bash
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    ".env",
    ".env.local"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "env": ["NODE_ENV"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "env": ["CI", "NODE_ENV"]
    },
    "clean": {
      "cache": false
    }
  }
}
EOF
```

#### Step 4: Create Directory Structure

```bash
# Create package directories
mkdir -p packages
mkdir -p apps

# Create placeholder files
touch packages/.gitkeep
touch apps/.gitkeep
```

#### Step 5: Create .gitignore

```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
.next/
.turbo/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test
coverage/
.nyc_output/

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Cache
.cache/
*.tsbuildinfo
EOF
```

#### Step 6: Create .nvmrc

```bash
echo "20" > .nvmrc
```

#### Step 7: Create .npmrc

```bash
cat > .npmrc << 'EOF'
auto-install-peers=true
strict-peer-dependencies=false
shamefully-hoist=true
EOF
```

#### Step 8: Install Dependencies

```bash
pnpm install
```

### Phase 3: Verification

```bash
# Verify monorepo structure
ls -la

# Verify pnpm workspace
pnpm ls

# Verify turbo
pnpm turbo --version

# Run structure validation
pnpm test -- scripts/verify-monorepo.test.ts

# Verify workspaces recognized
pnpm ls --recursive --depth=-1
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `package.json` | Root package with workspaces config |
| Create | `pnpm-workspace.yaml` | pnpm workspace definition |
| Create | `turbo.json` | Turborepo pipeline configuration |
| Create | `packages/` | Package workspace directory |
| Create | `apps/` | Application workspace directory |
| Create | `.gitignore` | Git ignore patterns |
| Create | `.nvmrc` | Node version specification |
| Create | `.npmrc` | npm/pnpm configuration |
| Create | `scripts/verify-monorepo.test.ts` | Structure validation tests |

---

## Acceptance Criteria

- [ ] `pnpm install` completes without errors
- [ ] `pnpm ls --recursive` shows workspace root
- [ ] `turbo.json` has build, dev, lint, test, typecheck pipelines
- [ ] `packages/` directory exists for shared packages
- [ ] `apps/` directory exists for applications
- [ ] `.gitignore` includes node_modules, dist, .turbo, .env
- [ ] Structure validation tests pass

---

## Test Requirements

### Unit Tests

- Verify package.json has workspaces field
- Verify pnpm-workspace.yaml is valid YAML
- Verify turbo.json has required pipelines

### Integration Tests

- `pnpm install` succeeds from fresh clone
- `pnpm turbo build` runs (no-op with empty packages)

---

## Security & Safety Checklist

- [ ] No hardcoded secrets in any configuration file
- [ ] `.env` and `.env.local` are in `.gitignore`
- [ ] No sensitive data in package.json
- [ ] engines field enforces minimum Node.js version

---

## JSON Task Block

```json
{
  "task_id": "S0-A1",
  "name": "Initialize Monorepo Structure",
  "sprint": 0,
  "agent": "A",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 3,
  "dependencies": [],
  "blocks": ["S0-A2", "S0-A3", "S0-A4", "S0-A5"],
  "tags": ["infrastructure", "monorepo", "turborepo"],
  "acceptance_criteria": [
    "pnpm install succeeds",
    "turbo.json has required pipelines",
    "workspace directories exist",
    "structure tests pass"
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

If this task fails or needs to be reverted:

```bash
# Remove generated files
rm -f package.json pnpm-workspace.yaml turbo.json
rm -rf packages apps node_modules
rm -f .gitignore .nvmrc .npmrc
rm -f pnpm-lock.yaml

# Restore from git if needed
git checkout HEAD -- .
```

---

## Next Steps

After completing this task:

1. **S0-A2**: Configure TypeScript (strict mode)
2. **S0-A3**: Scaffold core packages
3. **S0-A4**: Configure ESLint + Prettier
4. **S0-A5**: Set up shared tsconfig inheritance
