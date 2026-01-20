# Build Prompt: S0-C2 — Required Checks Configuration

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-C2 |
| **Sprint** | 0 — Foundation |
| **Agent** | C — CI/CD Pipeline |
| **Complexity** | Low |
| **Estimated Effort** | 1 hour |
| **Dependencies** | S0-C1 |
| **Blocks** | S0-C3 |

---

## Context

### What We're Building

Configure GitHub required status checks to block PR merges until all CI jobs pass.

### Why This Matters

- **Quality enforcement**: Can't merge broken code
- **Consistent standards**: Every PR meets the same bar
- **Automation**: No manual "did CI pass?" checks
- **Accountability**: CI failure is visible to everyone

### Spec References

- `/docs/07-engineering-process/ci-cd-spec.md#3-required-checks`
- `/docs/07-engineering-process/engineering-handbook.md#6-pr-discipline`

**Critical Constraint (from ci-cd-spec.md):**
> Required checks: lint, typecheck, test, build. All must pass for merge.

---

## Prerequisites

### Completed Tasks

- [x] S0-C1: GitHub Actions workflow created

### Required Access

- Repository admin access
- CI workflow must have run at least once

---

## Instructions

### Phase 1: Test First (TDD)

This task involves GitHub repository settings which cannot be directly tested via code. However, we can create a verification script.

**File: `scripts/verify-repo-settings.ts`**

```typescript
/**
 * Verification script for GitHub repository settings
 *
 * Run this script to verify that required checks are configured correctly.
 * Requires GITHUB_TOKEN environment variable with repo access.
 */

import { Octokit } from '@octokit/rest';

async function verifyRepoSettings() {
  const token = process.env['GITHUB_TOKEN'];
  if (!token) {
    console.error('GITHUB_TOKEN environment variable required');
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });

  // Get repo info from git remote
  const owner = 'L0v3Chrix';
  const repo = 'RTV-social';

  console.log(`Checking repository: ${owner}/${repo}`);

  try {
    // Get branch protection rules for main
    const { data: protection } = await octokit.repos.getBranchProtection({
      owner,
      repo,
      branch: 'main',
    });

    console.log('\n✅ Branch protection is enabled on main');

    // Check required status checks
    const checks = protection.required_status_checks;
    if (checks) {
      console.log('\n📋 Required Status Checks:');
      console.log(`  Strict: ${checks.strict}`);
      console.log(`  Contexts: ${checks.contexts.join(', ')}`);

      const requiredChecks = ['lint', 'typecheck', 'test', 'build', 'ci-ok'];
      const missingChecks = requiredChecks.filter(
        (c) => !checks.contexts.some((ctx) => ctx.includes(c))
      );

      if (missingChecks.length > 0) {
        console.log(`\n⚠️  Missing required checks: ${missingChecks.join(', ')}`);
      } else {
        console.log('\n✅ All required checks are configured');
      }
    } else {
      console.log('\n❌ No required status checks configured');
    }

    // Check other protections
    if (protection.required_pull_request_reviews) {
      console.log('\n✅ Pull request reviews required');
      console.log(
        `  Required approving reviews: ${protection.required_pull_request_reviews.required_approving_review_count}`
      );
    }

    if (protection.enforce_admins?.enabled) {
      console.log('✅ Rules enforced for admins');
    }
  } catch (error: any) {
    if (error.status === 404) {
      console.log('\n❌ Branch protection not configured on main');
    } else {
      throw error;
    }
  }
}

verifyRepoSettings().catch(console.error);
```

### Phase 2: Implementation

This task is primarily manual configuration in GitHub UI, but can also be done via GitHub CLI or API.

#### Option A: GitHub Web UI

1. **Navigate to Repository Settings**
   - Go to https://github.com/L0v3Chrix/RTV-social/settings

2. **Go to Branches**
   - Click "Branches" in the left sidebar

3. **Add Branch Protection Rule**
   - Click "Add rule" or edit existing rule for `main`

4. **Configure Required Status Checks**
   - Check "Require status checks to pass before merging"
   - Check "Require branches to be up to date before merging"
   - Search for and add these checks:
     - `Lint` (from CI workflow)
     - `Type Check` (from CI workflow)
     - `Test` (from CI workflow)
     - `Build` (from CI workflow)
     - `CI OK` (from CI workflow)

5. **Save Changes**
   - Click "Create" or "Save changes"

#### Option B: GitHub CLI

```bash
# Install GitHub CLI if not already installed
# brew install gh

# Authenticate
gh auth login

# Configure branch protection with required checks
gh api repos/L0v3Chrix/RTV-social/branches/main/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks='{"strict":true,"contexts":["Lint","Type Check","Test","Build","CI OK"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1}' \
  -f restrictions=null
```

#### Option C: Create Setup Script

**File: `scripts/setup-branch-protection.sh`**

```bash
cat > scripts/setup-branch-protection.sh << 'EOF'
#!/bin/bash
# Setup branch protection rules for main branch
# Requires: gh CLI authenticated with repo access

set -e

OWNER="L0v3Chrix"
REPO="RTV-social"
BRANCH="main"

echo "Setting up branch protection for $OWNER/$REPO ($BRANCH)"

# Create the branch protection rule
gh api repos/$OWNER/$REPO/branches/$BRANCH/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  --input - << 'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint",
      "Type Check",
      "Test",
      "Build",
      "CI OK"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "✅ Branch protection configured successfully"

# Verify
echo ""
echo "Verification:"
gh api repos/$OWNER/$REPO/branches/$BRANCH/protection \
  --jq '.required_status_checks.contexts[]' | while read check; do
  echo "  ✓ $check"
done
EOF

chmod +x scripts/setup-branch-protection.sh
```

### Phase 3: Verification

```bash
# Run setup script (if using Option C)
./scripts/setup-branch-protection.sh

# Verify via gh CLI
gh api repos/L0v3Chrix/RTV-social/branches/main/protection

# Or run the verification script
GITHUB_TOKEN=$(gh auth token) npx tsx scripts/verify-repo-settings.ts

# Test by creating a PR without passing CI
# The PR should be blocked from merging
```

---

## Required Checks List

| Check Name | Source | Required |
|------------|--------|----------|
| Lint | CI workflow `lint` job | ✅ Yes |
| Type Check | CI workflow `typecheck` job | ✅ Yes |
| Test | CI workflow `test` job | ✅ Yes |
| Build | CI workflow `build` job | ✅ Yes |
| CI OK | CI workflow `ci-ok` job | ✅ Yes |

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `scripts/setup-branch-protection.sh` | Setup script |
| Create | `scripts/verify-repo-settings.ts` | Verification script |
| Configure | GitHub Repository Settings | Branch protection rules |

---

## Acceptance Criteria

- [ ] Branch protection enabled on `main`
- [ ] All 5 status checks required (Lint, Type Check, Test, Build, CI OK)
- [ ] "Require branches to be up to date" enabled
- [ ] PR cannot be merged without passing checks
- [ ] At least 1 approving review required
- [ ] Verification script confirms configuration

---

## Test Requirements

### Manual Tests

- Create a PR with failing lint → Cannot merge
- Create a PR with passing CI → Can merge after approval
- Try to push directly to main → Blocked

### Automated Tests

- Verification script runs without errors
- All required checks listed in output

---

## Security & Safety Checklist

- [ ] Admins cannot bypass rules (enforce_admins: true)
- [ ] Force pushes disabled on main
- [ ] Branch deletions disabled on main
- [ ] Stale reviews dismissed on new commits

---

## JSON Task Block

```json
{
  "task_id": "S0-C2",
  "name": "Required Checks Configuration",
  "sprint": 0,
  "agent": "C",
  "status": "pending",
  "complexity": "low",
  "estimated_hours": 1,
  "dependencies": ["S0-C1"],
  "blocks": ["S0-C3"],
  "tags": ["ci", "github", "branch-protection"],
  "acceptance_criteria": [
    "branch protection on main",
    "5 required status checks",
    "strict mode enabled",
    "cannot merge without passing CI"
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

1. **S0-C3**: Configure additional branch protection rules
2. **S0-C4**: Set up preview deployments
