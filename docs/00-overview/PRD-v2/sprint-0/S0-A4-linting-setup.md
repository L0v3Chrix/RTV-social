# Build Prompt: S0-A4 — ESLint + Prettier Setup

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-A4 |
| **Sprint** | 0 — Foundation |
| **Agent** | A — Repository & Core Packages |
| **Complexity** | Low |
| **Estimated Effort** | 1-2 hours |
| **Dependencies** | S0-A1, S0-A3 |
| **Blocks** | None (end of agent A chain) |

---

## Context

### What We're Building

Configure ESLint and Prettier for consistent code quality and formatting across all packages in the monorepo.

### Why This Matters

- **Consistency**: All code follows the same style
- **Quality**: ESLint catches potential bugs and bad patterns
- **Automation**: Formatting is automatic, not manual
- **CI enforcement**: Bad code is blocked before merge

### Spec References

- `/docs/07-engineering-process/engineering-handbook.md#3-code-quality`
- `/docs/07-engineering-process/testing-strategy.md#1-static-analysis`

**Critical Constraint (from engineering-handbook.md):**
> All PRs must pass lint checks. No `eslint-disable` without accompanying comment justifying the exception.

---

## Prerequisites

### Completed Tasks

- [x] S0-A1: Monorepo scaffold initialized
- [x] S0-A3: Core packages scaffolded

### Required Files

- `package.json` with workspaces
- `packages/*/` directories exist

---

## Instructions

### Phase 1: Test First (TDD)

**File: `scripts/verify-linting.test.ts`**

```typescript
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('Linting Configuration', () => {
  const rootDir = resolve(__dirname, '..');

  test('eslint.config.js exists', () => {
    const eslintPath = resolve(rootDir, 'eslint.config.js');
    expect(existsSync(eslintPath)).toBe(true);
  });

  test('.prettierrc exists', () => {
    const prettierPath = resolve(rootDir, '.prettierrc');
    expect(existsSync(prettierPath)).toBe(true);
  });

  test('.prettierignore exists', () => {
    const ignorePath = resolve(rootDir, '.prettierignore');
    expect(existsSync(ignorePath)).toBe(true);
  });

  test('package.json has lint script', () => {
    const pkgPath = resolve(rootDir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts.lint).toBeDefined();
  });

  test('package.json has format script', () => {
    const pkgPath = resolve(rootDir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts.format).toBeDefined();
  });

  test('.editorconfig exists', () => {
    const editorPath = resolve(rootDir, '.editorconfig');
    expect(existsSync(editorPath)).toBe(true);
  });
});
```

### Phase 2: Implementation

#### Step 1: Install Dependencies

```bash
pnpm add -D eslint @eslint/js typescript-eslint eslint-config-prettier eslint-plugin-import-x @types/eslint__js -w
pnpm add -D prettier -w
```

#### Step 2: Create ESLint Configuration (Flat Config)

**File: `eslint.config.js`**

```bash
cat > eslint.config.js << 'EOF'
// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Prettier compatibility (disables conflicting rules)
  eslintConfigPrettier,

  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
    ],
  },

  // TypeScript files configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Error prevention
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Code style
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
        {
          selector: 'enum',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE', 'PascalCase'],
        },
      ],

      // Best practices
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },

  // Test files - relaxed rules
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  // Config files - allow CommonJS
  {
    files: ['*.config.js', '*.config.ts', '*.config.mjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
EOF
```

#### Step 3: Create Prettier Configuration

**File: `.prettierrc`**

```bash
cat > .prettierrc << 'EOF'
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "useTabs": false
}
EOF
```

**File: `.prettierignore`**

```bash
cat > .prettierignore << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
.next/
.turbo/
out/

# Lock files
pnpm-lock.yaml
package-lock.json

# Generated
coverage/
*.min.js
*.min.css

# Documentation
*.md
EOF
```

#### Step 4: Create EditorConfig

**File: `.editorconfig`**

```bash
cat > .editorconfig << 'EOF'
# EditorConfig helps maintain consistent coding styles
# https://editorconfig.org

root = true

[*]
charset = utf-8
end_of_line = lf
indent_size = 2
indent_style = space
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2

[Makefile]
indent_style = tab
EOF
```

#### Step 5: Set Up Husky Pre-commit Hook

```bash
# Install husky
pnpm add -D husky lint-staged -w

# Initialize husky
pnpm exec husky init

# Create pre-commit hook
cat > .husky/pre-commit << 'EOF'
pnpm exec lint-staged
EOF

chmod +x .husky/pre-commit
```

#### Step 6: Configure lint-staged

Add to `package.json`:

```bash
# Add lint-staged config to package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
pkg['lint-staged'] = {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,yml,yaml}': ['prettier --write']
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
```

#### Step 7: Update Package Scripts

Ensure `package.json` has the correct scripts:

```bash
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
pkg.scripts = {
  ...pkg.scripts,
  'lint': 'turbo run lint',
  'lint:fix': 'eslint . --fix',
  'format': 'prettier --write \"**/*.{ts,tsx,json,yml,yaml}\"',
  'format:check': 'prettier --check \"**/*.{ts,tsx,json,yml,yaml}\"'
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
```

### Phase 3: Verification

```bash
# Verify ESLint config is valid
pnpm eslint --print-config packages/core/src/index.ts

# Run linting on all packages
pnpm turbo lint

# Check formatting
pnpm format:check

# Fix any formatting issues
pnpm format

# Test pre-commit hook
echo "// test" >> packages/core/src/index.ts
git add packages/core/src/index.ts
git commit -m "test: verify pre-commit hook" --no-verify
git reset HEAD~1
git checkout packages/core/src/index.ts

# Run structure tests
pnpm test -- scripts/verify-linting.test.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `eslint.config.js` | ESLint flat configuration |
| Create | `.prettierrc` | Prettier formatting rules |
| Create | `.prettierignore` | Files to skip formatting |
| Create | `.editorconfig` | Editor configuration |
| Create | `.husky/pre-commit` | Pre-commit hook |
| Modify | `package.json` | Add lint-staged config, scripts |
| Create | `scripts/verify-linting.test.ts` | Configuration tests |

---

## Acceptance Criteria

- [ ] `eslint.config.js` exists with TypeScript rules
- [ ] `.prettierrc` exists with formatting rules
- [ ] `pnpm lint` runs without errors
- [ ] `pnpm format:check` passes on formatted code
- [ ] Pre-commit hook runs lint-staged
- [ ] All TypeScript files pass linting
- [ ] Configuration tests pass

---

## Test Requirements

### Unit Tests

- Verify config files exist
- Verify scripts are defined
- Verify ESLint can parse TypeScript

### Integration Tests

- `pnpm lint` completes successfully
- `pnpm format` formats files correctly
- Pre-commit hook blocks bad code

---

## Security & Safety Checklist

- [ ] ESLint rules prevent unsafe patterns
- [ ] No sensitive files in lint scope
- [ ] `no-console` prevents accidental log leaks
- [ ] `strict-boolean-expressions` prevents falsy bugs

---

## JSON Task Block

```json
{
  "task_id": "S0-A4",
  "name": "ESLint + Prettier Setup",
  "sprint": 0,
  "agent": "A",
  "status": "pending",
  "complexity": "low",
  "estimated_hours": 2,
  "dependencies": ["S0-A1", "S0-A3"],
  "blocks": [],
  "tags": ["eslint", "prettier", "linting", "code-quality"],
  "acceptance_criteria": [
    "eslint.config.js exists",
    ".prettierrc exists",
    "pnpm lint passes",
    "pre-commit hook works"
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
# Remove linting configs
rm -f eslint.config.js .prettierrc .prettierignore .editorconfig
rm -rf .husky/

# Remove dependencies
pnpm remove eslint @eslint/js typescript-eslint eslint-config-prettier prettier husky lint-staged -w
```

---

## Next Steps

This is the final task in Agent A's chain. After completion:

1. Agent A work is complete for Sprint 0
2. Verify all Agent A acceptance criteria are met
3. Sprint 0 continues with Agents B, C, D
