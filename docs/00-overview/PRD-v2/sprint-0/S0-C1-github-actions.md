# Build Prompt: S0-C1 — GitHub Actions Workflow

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-C1 |
| **Sprint** | 0 — Foundation |
| **Agent** | C — CI/CD Pipeline |
| **Complexity** | Medium |
| **Estimated Effort** | 2-3 hours |
| **Dependencies** | S0-A1 (monorepo), S0-A4 (linting) |
| **Blocks** | S0-C2, S0-C3, S0-C4, S0-C5 |

---

## Context

### What We're Building

Set up GitHub Actions CI workflow that runs lint, typecheck, and tests on every pull request and push to main.

### Why This Matters

- **Automated quality gates**: Every change is validated
- **Fast feedback**: Developers know immediately if something breaks
- **Consistent enforcement**: No human judgment needed for basic checks
- **PR blocking**: Bad code can't be merged

### Spec References

- `/docs/07-engineering-process/ci-cd-spec.md`
- `/docs/07-engineering-process/testing-strategy.md#7-ci-integration`

**Critical Constraint (from ci-cd-spec.md):**
> All PRs must pass lint, typecheck, and test before merge. No exceptions without documented waiver.

---

## Prerequisites

### Completed Tasks

- [x] S0-A1: Monorepo scaffold
- [x] S0-A4: ESLint + Prettier setup

### Required Access

- Write access to GitHub repository
- GitHub Actions enabled

---

## Instructions

### Phase 1: Test First (TDD)

**File: `scripts/verify-ci.test.ts`**

```typescript
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';

describe('CI Configuration', () => {
  const rootDir = resolve(__dirname, '..');
  const workflowsDir = resolve(rootDir, '.github', 'workflows');

  test('.github/workflows directory exists', () => {
    expect(existsSync(workflowsDir)).toBe(true);
  });

  test('ci.yml workflow exists', () => {
    const ciPath = resolve(workflowsDir, 'ci.yml');
    expect(existsSync(ciPath)).toBe(true);
  });

  test('ci.yml has required jobs', () => {
    const ciPath = resolve(workflowsDir, 'ci.yml');
    const content = readFileSync(ciPath, 'utf-8');
    const workflow = parse(content);

    expect(workflow.jobs).toBeDefined();
    expect(workflow.jobs.lint).toBeDefined();
    expect(workflow.jobs.typecheck).toBeDefined();
    expect(workflow.jobs.test).toBeDefined();
  });

  test('ci.yml triggers on PR and push to main', () => {
    const ciPath = resolve(workflowsDir, 'ci.yml');
    const content = readFileSync(ciPath, 'utf-8');
    const workflow = parse(content);

    expect(workflow.on.pull_request).toBeDefined();
    expect(workflow.on.push.branches).toContain('main');
  });

  test('ci.yml uses pnpm', () => {
    const ciPath = resolve(workflowsDir, 'ci.yml');
    const content = readFileSync(ciPath, 'utf-8');

    expect(content).toContain('pnpm');
    expect(content).toContain('pnpm/action-setup');
  });

  test('ci.yml uses Node.js 20', () => {
    const ciPath = resolve(workflowsDir, 'ci.yml');
    const content = readFileSync(ciPath, 'utf-8');

    expect(content).toMatch(/node-version.*20/);
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Workflows Directory

```bash
mkdir -p .github/workflows
```

#### Step 2: Create Main CI Workflow

**File: `.github/workflows/ci.yml`**

```bash
cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Cancel in-progress runs for the same branch
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
  NODE_VERSION: '20'
  PNPM_VERSION: '8'

jobs:
  # Lint job
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run lint
        run: pnpm turbo lint

  # Typecheck job
  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run typecheck
        run: pnpm turbo typecheck

  # Test job
  test:
    name: Test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: rtv_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/rtv_test
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm turbo build

      - name: Run tests
        run: pnpm turbo test

  # Build job (ensures everything compiles)
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm turbo build

  # Summary job that depends on all others
  ci-ok:
    name: CI OK
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test, build]
    if: always()
    steps:
      - name: Check all jobs passed
        run: |
          if [[ "${{ needs.lint.result }}" != "success" ]] || \
             [[ "${{ needs.typecheck.result }}" != "success" ]] || \
             [[ "${{ needs.test.result }}" != "success" ]] || \
             [[ "${{ needs.build.result }}" != "success" ]]; then
            echo "One or more jobs failed"
            exit 1
          fi
          echo "All jobs passed!"
EOF
```

#### Step 3: Create Dependabot Configuration

**File: `.github/dependabot.yml`**

```bash
cat > .github/dependabot.yml << 'EOF'
version: 2
updates:
  # npm dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    groups:
      # Group minor and patch updates
      minor-and-patch:
        patterns:
          - "*"
        update-types:
          - "minor"
          - "patch"
    commit-message:
      prefix: "deps"
    labels:
      - "dependencies"
      - "automated"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    commit-message:
      prefix: "ci"
    labels:
      - "ci"
      - "automated"
EOF
```

#### Step 4: Create PR Template

**File: `.github/pull_request_template.md`**

```bash
mkdir -p .github
cat > .github/pull_request_template.md << 'EOF'
## Summary

<!-- Brief description of changes -->

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to change)
- [ ] 📝 Documentation update
- [ ] 🧹 Refactor (no functional changes)
- [ ] 🧪 Test update

## Testing

<!-- How was this tested? -->

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist

- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] New and existing unit tests pass locally with my changes

## Related Issues

<!-- Link any related issues here -->

Closes #
EOF
```

#### Step 5: Create Issue Templates

```bash
mkdir -p .github/ISSUE_TEMPLATE

# Bug report template
cat > .github/ISSUE_TEMPLATE/bug_report.md << 'EOF'
---
name: Bug Report
about: Report a bug to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

## Bug Description

<!-- A clear description of what the bug is -->

## Steps to Reproduce

1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior

<!-- What you expected to happen -->

## Actual Behavior

<!-- What actually happened -->

## Environment

- OS: [e.g., macOS 14.0]
- Node.js: [e.g., 20.10.0]
- Browser (if applicable): [e.g., Chrome 120]

## Additional Context

<!-- Any other context about the problem -->
EOF

# Feature request template
cat > .github/ISSUE_TEMPLATE/feature_request.md << 'EOF'
---
name: Feature Request
about: Suggest an idea for this project
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

## Problem Statement

<!-- What problem does this feature solve? -->

## Proposed Solution

<!-- Describe the solution you'd like -->

## Alternatives Considered

<!-- Any alternative solutions you've considered -->

## Additional Context

<!-- Any other context or screenshots -->
EOF
```

### Phase 3: Verification

```bash
# Verify workflow files exist
ls -la .github/workflows/

# Validate YAML syntax
cat .github/workflows/ci.yml | python3 -c "import sys, yaml; yaml.safe_load(sys.stdin)"

# Test locally with act (optional)
# brew install act
# act -l  # List workflows
# act pull_request  # Run PR workflow

# Push and check GitHub Actions tab
git add .github/
git commit -m "ci: Add GitHub Actions CI workflow"
git push

# Run structure tests
pnpm test -- scripts/verify-ci.test.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `.github/workflows/ci.yml` | Main CI workflow |
| Create | `.github/dependabot.yml` | Dependency updates |
| Create | `.github/pull_request_template.md` | PR template |
| Create | `.github/ISSUE_TEMPLATE/bug_report.md` | Bug template |
| Create | `.github/ISSUE_TEMPLATE/feature_request.md` | Feature template |
| Create | `scripts/verify-ci.test.ts` | CI config tests |

---

## Acceptance Criteria

- [ ] CI workflow runs on PR and push to main
- [ ] Lint job passes
- [ ] Typecheck job passes
- [ ] Test job passes (with Postgres service)
- [ ] Build job passes
- [ ] ci-ok summary job aggregates results
- [ ] Dependabot configured for weekly updates
- [ ] PR and issue templates created

---

## Test Requirements

### Unit Tests

- Workflow files exist
- Required jobs defined
- Correct triggers configured

### Integration Tests

- Workflow runs successfully on GitHub
- All jobs complete without error
- Status checks appear on PRs

---

## Security & Safety Checklist

- [ ] No secrets hardcoded in workflow
- [ ] Secrets accessed via `${{ secrets.* }}`
- [ ] Dependabot configured with reasonable limits
- [ ] Workflow uses pinned action versions (@v4)

---

## JSON Task Block

```json
{
  "task_id": "S0-C1",
  "name": "GitHub Actions Workflow",
  "sprint": 0,
  "agent": "C",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 3,
  "dependencies": ["S0-A1", "S0-A4"],
  "blocks": ["S0-C2", "S0-C3", "S0-C4", "S0-C5"],
  "tags": ["ci", "github-actions", "automation"],
  "acceptance_criteria": [
    "CI workflow runs on PR",
    "lint job passes",
    "typecheck job passes",
    "test job passes",
    "build job passes"
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

1. **S0-C2**: Configure required checks
2. **S0-C3**: Set up branch protection
3. **S0-C4**: Configure preview deployments
4. **S0-C5**: Set up environment variables
