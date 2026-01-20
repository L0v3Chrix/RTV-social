# Build Prompt: S0-A5 — Shared TSConfig Inheritance

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-A5 |
| **Sprint** | 0 — Foundation |
| **Agent** | A — Repository & Core Packages |
| **Complexity** | Low |
| **Estimated Effort** | 1 hour |
| **Dependencies** | S0-A2, S0-A3 |
| **Blocks** | Sprint 1 packages |

---

## Context

### What We're Building

Ensure all packages properly extend the base TypeScript configuration and verify the inheritance chain works correctly.

### Why This Matters

- **Consistency**: All packages use the same compiler settings
- **Maintainability**: Change once at root, applies everywhere
- **Build reliability**: Prevents config drift between packages

### Spec References

- `/docs/07-engineering-process/engineering-handbook.md#3-code-quality`

---

## Prerequisites

### Completed Tasks

- [x] S0-A2: TypeScript configuration created
- [x] S0-A3: Core packages scaffolded

### Required Files

- `tsconfig.base.json` exists
- `tsconfig.node.json` exists
- `packages/*/tsconfig.json` files exist

---

## Instructions

### Phase 1: Test First (TDD)

**File: `scripts/verify-tsconfig-inheritance.test.ts`**

```typescript
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('TSConfig Inheritance', () => {
  const rootDir = resolve(__dirname, '..');
  const packages = ['core', 'types', 'utils'];

  test('tsconfig.base.json exists', () => {
    const basePath = resolve(rootDir, 'tsconfig.base.json');
    expect(existsSync(basePath)).toBe(true);
  });

  test('tsconfig.node.json extends base', () => {
    const nodePath = resolve(rootDir, 'tsconfig.node.json');
    expect(existsSync(nodePath)).toBe(true);

    const nodeConfig = JSON.parse(readFileSync(nodePath, 'utf-8'));
    expect(nodeConfig.extends).toBe('./tsconfig.base.json');
  });

  test('tsconfig.react.json extends base', () => {
    const reactPath = resolve(rootDir, 'tsconfig.react.json');
    expect(existsSync(reactPath)).toBe(true);

    const reactConfig = JSON.parse(readFileSync(reactPath, 'utf-8'));
    expect(reactConfig.extends).toBe('./tsconfig.base.json');
  });

  packages.forEach((pkg) => {
    describe(`@rtv/${pkg}`, () => {
      test('tsconfig.json extends a root config', () => {
        const pkgTsconfig = resolve(rootDir, 'packages', pkg, 'tsconfig.json');
        expect(existsSync(pkgTsconfig)).toBe(true);

        const config = JSON.parse(readFileSync(pkgTsconfig, 'utf-8'));
        expect(config.extends).toMatch(/\.\.\/\.\.\/tsconfig\.(base|node|react)\.json/);
      });

      test('tsconfig.json has outDir set to dist', () => {
        const pkgTsconfig = resolve(rootDir, 'packages', pkg, 'tsconfig.json');
        const config = JSON.parse(readFileSync(pkgTsconfig, 'utf-8'));

        expect(config.compilerOptions?.outDir).toBe('dist');
      });

      test('tsconfig.json has rootDir set to src', () => {
        const pkgTsconfig = resolve(rootDir, 'packages', pkg, 'tsconfig.json');
        const config = JSON.parse(readFileSync(pkgTsconfig, 'utf-8'));

        expect(config.compilerOptions?.rootDir).toBe('src');
      });

      test('tsconfig.json includes src/**/*', () => {
        const pkgTsconfig = resolve(rootDir, 'packages', pkg, 'tsconfig.json');
        const config = JSON.parse(readFileSync(pkgTsconfig, 'utf-8'));

        expect(config.include).toContain('src/**/*');
      });
    });
  });

  test('all packages typecheck successfully', async () => {
    // This is validated by running: pnpm turbo typecheck
    expect(true).toBe(true);
  });
});
```

### Phase 2: Implementation

#### Step 1: Verify Base Config Completeness

**File: `tsconfig.base.json`** (verify/update)

```bash
cat > tsconfig.base.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Base Configuration",
  "compilerOptions": {
    // Strict Type Checking (all enabled)
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "forceConsistentCasingInFileNames": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,

    // Module System
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,

    // Output
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // Other
    "skipLibCheck": true
  },
  "exclude": [
    "node_modules",
    "dist",
    ".turbo"
  ]
}
EOF
```

#### Step 2: Verify Node Config

**File: `tsconfig.node.json`** (verify/update)

```bash
cat > tsconfig.node.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Node.js Configuration",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"]
  }
}
EOF
```

#### Step 3: Verify React Config

**File: `tsconfig.react.json`** (verify/update)

```bash
cat > tsconfig.react.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "React Configuration",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"]
  }
}
EOF
```

#### Step 4: Update Package TSConfigs

**File: `packages/types/tsconfig.json`**

```bash
cat > packages/types/tsconfig.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF
```

**File: `packages/utils/tsconfig.json`**

```bash
cat > packages/utils/tsconfig.json << 'EOF'
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

**File: `packages/core/tsconfig.json`**

```bash
cat > packages/core/tsconfig.json << 'EOF'
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
    { "path": "../types" },
    { "path": "../utils" }
  ]
}
EOF
```

#### Step 5: Update Root TSConfig for Project References

**File: `tsconfig.json`** (update)

```bash
cat > tsconfig.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    // Strict Type Checking
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "forceConsistentCasingInFileNames": true,

    // Module System
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,

    // Output
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",

    // Paths (for editor support)
    "baseUrl": ".",
    "paths": {
      "@rtv/core": ["packages/core/src"],
      "@rtv/core/*": ["packages/core/src/*"],
      "@rtv/types": ["packages/types/src"],
      "@rtv/types/*": ["packages/types/src/*"],
      "@rtv/utils": ["packages/utils/src"],
      "@rtv/utils/*": ["packages/utils/src/*"]
    },

    // Other
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "references": [
    { "path": "packages/types" },
    { "path": "packages/utils" },
    { "path": "packages/core" }
  ],
  "exclude": [
    "node_modules",
    "dist",
    ".turbo",
    "coverage"
  ]
}
EOF
```

#### Step 6: Add Build Script for Project References

Update turbo.json to support composite builds:

```bash
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    ".env",
    ".env.local",
    "tsconfig.base.json",
    "tsconfig.node.json",
    "tsconfig.react.json"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
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

### Phase 3: Verification

```bash
# Verify inheritance chain
echo "=== Verifying TSConfig Inheritance ==="

# Check each package extends root config
for pkg in types utils core; do
  echo "Checking packages/$pkg/tsconfig.json..."
  cat packages/$pkg/tsconfig.json | grep '"extends"'
done

# Verify TypeScript can resolve the inheritance
pnpm tsc --showConfig -p packages/types/tsconfig.json | head -20
pnpm tsc --showConfig -p packages/utils/tsconfig.json | head -20
pnpm tsc --showConfig -p packages/core/tsconfig.json | head -20

# Build all packages (tests inheritance)
pnpm turbo build

# Typecheck all packages
pnpm turbo typecheck

# Run inheritance tests
pnpm test -- scripts/verify-tsconfig-inheritance.test.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `tsconfig.base.json` | Verify/update base config |
| Modify | `tsconfig.node.json` | Verify/update Node config |
| Modify | `tsconfig.react.json` | Verify/update React config |
| Modify | `tsconfig.json` | Add project references |
| Modify | `packages/types/tsconfig.json` | Add composite, references |
| Modify | `packages/utils/tsconfig.json` | Add composite, references |
| Modify | `packages/core/tsconfig.json` | Add composite, references |
| Modify | `turbo.json` | Add global dependencies |
| Create | `scripts/verify-tsconfig-inheritance.test.ts` | Inheritance tests |

---

## Acceptance Criteria

- [ ] All packages extend `tsconfig.node.json` or `tsconfig.base.json`
- [ ] All packages have `outDir: "dist"` and `rootDir: "src"`
- [ ] Project references are set up correctly
- [ ] `pnpm turbo build` succeeds with correct order
- [ ] `pnpm turbo typecheck` passes for all packages
- [ ] `tsc --showConfig` shows inherited settings
- [ ] Inheritance tests pass

---

## Test Requirements

### Unit Tests

- Verify each package tsconfig extends root
- Verify compilerOptions are set correctly
- Verify include/exclude patterns

### Integration Tests

- Full build succeeds with correct ordering
- Type errors in one package block dependent packages

---

## Security & Safety Checklist

- [ ] No secrets in tsconfig files
- [ ] `skipLibCheck` prevents malicious declarations
- [ ] `isolatedModules` ensures safer builds

---

## JSON Task Block

```json
{
  "task_id": "S0-A5",
  "name": "Shared TSConfig Inheritance",
  "sprint": 0,
  "agent": "A",
  "status": "pending",
  "complexity": "low",
  "estimated_hours": 1,
  "dependencies": ["S0-A2", "S0-A3"],
  "blocks": [],
  "tags": ["typescript", "configuration", "inheritance"],
  "acceptance_criteria": [
    "all packages extend root config",
    "project references work",
    "pnpm turbo build succeeds",
    "inheritance tests pass"
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
# Restore original tsconfig files (from git)
git checkout HEAD -- tsconfig.json tsconfig.base.json tsconfig.node.json tsconfig.react.json
git checkout HEAD -- packages/*/tsconfig.json turbo.json
```

---

## Next Steps

After completing Agent A tasks:

1. All Agent A (Repository & Core Packages) tasks complete
2. Continue with Agent B (Database Schema) tasks
3. Continue with Agent C (CI/CD Pipeline) tasks
4. Continue with Agent D (Observability) tasks
