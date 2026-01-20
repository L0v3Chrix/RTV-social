# Build Prompt: S0-A2 — TypeScript Configuration

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-A2 |
| **Sprint** | 0 — Foundation |
| **Agent** | A — Repository & Core Packages |
| **Complexity** | Low |
| **Estimated Effort** | 1-2 hours |
| **Dependencies** | S0-A1 |
| **Blocks** | S0-A3, S0-A5 |

---

## Context

### What We're Building

Configure TypeScript with strict mode across the monorepo. This establishes type safety as a foundational requirement for all code in the platform.

### Why This Matters

- **Type safety**: Catch errors at compile time, not runtime
- **Developer experience**: IDE autocompletion and inline documentation
- **Refactoring confidence**: Types make large changes safer
- **Documentation**: Types serve as living documentation

### Spec References

- `/docs/07-engineering-process/engineering-handbook.md#3-code-quality`
- `/docs/07-engineering-process/testing-strategy.md#1-static-analysis`

**Critical Constraint (from engineering-handbook.md):**
> TypeScript strict mode is mandatory. No `any` types without explicit justification in code comments.

---

## Prerequisites

### Completed Tasks

- [x] S0-A1: Monorepo scaffold initialized

### Required Files

- `package.json` with workspaces configured
- `pnpm-workspace.yaml` exists
- `turbo.json` exists

---

## Instructions

### Phase 1: Test First (TDD)

**File: `scripts/verify-typescript.test.ts`**

```typescript
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('TypeScript Configuration', () => {
  const rootDir = resolve(__dirname, '..');

  test('tsconfig.json exists at root', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    expect(existsSync(tsconfigPath)).toBe(true);
  });

  test('strict mode is enabled', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  test('noUncheckedIndexedAccess is enabled', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(true);
  });

  test('exactOptionalPropertyTypes is enabled', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    expect(tsconfig.compilerOptions.exactOptionalPropertyTypes).toBe(true);
  });

  test('target is ES2022 or higher', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    const validTargets = ['ES2022', 'ES2023', 'ESNext'];
    expect(validTargets).toContain(tsconfig.compilerOptions.target);
  });

  test('moduleResolution is bundler or NodeNext', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    const validResolutions = ['bundler', 'NodeNext', 'Bundler'];
    expect(validResolutions).toContain(tsconfig.compilerOptions.moduleResolution);
  });

  test('path aliases are configured', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    expect(tsconfig.compilerOptions.paths).toBeDefined();
    expect(tsconfig.compilerOptions.paths['@rtv/*']).toBeDefined();
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Base tsconfig.json

```bash
cat > tsconfig.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
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

    // Paths (for monorepo)
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
  "exclude": [
    "node_modules",
    "dist",
    ".turbo",
    "coverage"
  ]
}
EOF
```

#### Step 2: Create Package-Specific Configs

**File: `tsconfig.base.json`** (for packages to extend)

```bash
cat > tsconfig.base.json << 'EOF'
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

    // Other
    "skipLibCheck": true,
    "lib": ["ES2022"]
  }
}
EOF
```

**File: `tsconfig.node.json`** (for Node.js packages)

```bash
cat > tsconfig.node.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
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

**File: `tsconfig.react.json`** (for React packages)

```bash
cat > tsconfig.react.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"]
  }
}
EOF
```

#### Step 3: Install TypeScript Dependencies

```bash
pnpm add -D typescript @types/node -w
```

#### Step 4: Add Typecheck Script

Update `package.json` to ensure typecheck script exists:

```bash
# Verify turbo pipeline has typecheck
cat turbo.json | grep -A3 "typecheck"
```

#### Step 5: Create Type Declarations Directory

```bash
mkdir -p types
cat > types/global.d.ts << 'EOF'
// Global type declarations for RTV Social Automation Platform

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    DATABASE_URL?: string;
    REDIS_URL?: string;
  }
}

// Ensure this file is treated as a module
export {};
EOF
```

### Phase 3: Verification

```bash
# Verify TypeScript installation
pnpm tsc --version

# Verify strict mode is set
cat tsconfig.json | grep '"strict": true'

# Run typecheck (should pass with no source files yet)
pnpm turbo typecheck

# Verify tsconfig is valid JSON
node -e "require('./tsconfig.json')"

# Run structure tests
pnpm test -- scripts/verify-typescript.test.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `tsconfig.json` | Root TypeScript configuration |
| Create | `tsconfig.base.json` | Base config for packages to extend |
| Create | `tsconfig.node.json` | Node.js-specific config |
| Create | `tsconfig.react.json` | React-specific config |
| Create | `types/global.d.ts` | Global type declarations |
| Modify | `package.json` | Add TypeScript dev dependency |
| Create | `scripts/verify-typescript.test.ts` | Configuration validation tests |

---

## Acceptance Criteria

- [ ] `tsconfig.json` exists with strict mode enabled
- [ ] `noUncheckedIndexedAccess` is true
- [ ] `exactOptionalPropertyTypes` is true
- [ ] Path aliases configured for `@rtv/*`
- [ ] `pnpm turbo typecheck` runs without errors
- [ ] Base, Node, and React tsconfig variants exist
- [ ] Configuration validation tests pass

---

## Test Requirements

### Unit Tests

- Verify tsconfig.json strict settings
- Verify path aliases are defined
- Verify module resolution is correct

### Integration Tests

- `pnpm turbo typecheck` completes successfully
- TypeScript version is 5.3+

---

## Security & Safety Checklist

- [ ] No secrets in tsconfig files
- [ ] `skipLibCheck` is true (security: prevents malicious .d.ts)
- [ ] `isolatedModules` is true (safer builds)

---

## JSON Task Block

```json
{
  "task_id": "S0-A2",
  "name": "TypeScript Configuration",
  "sprint": 0,
  "agent": "A",
  "status": "pending",
  "complexity": "low",
  "estimated_hours": 2,
  "dependencies": ["S0-A1"],
  "blocks": ["S0-A3", "S0-A5"],
  "tags": ["typescript", "configuration", "strict-mode"],
  "acceptance_criteria": [
    "strict mode enabled",
    "path aliases configured",
    "pnpm turbo typecheck passes",
    "configuration tests pass"
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
# Remove TypeScript configurations
rm -f tsconfig.json tsconfig.base.json tsconfig.node.json tsconfig.react.json
rm -rf types/

# Remove TypeScript dependencies
pnpm remove typescript @types/node -w
```

---

## Next Steps

After completing this task:

1. **S0-A3**: Scaffold core packages (depends on this)
2. **S0-A5**: Set up shared tsconfig inheritance (depends on this)
