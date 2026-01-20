# Build Prompt: S0-C3 — Branch Protection Rules

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-C3 |
| **Sprint** | 0 — Foundation |
| **Agent** | C — CI/CD Pipeline |
| **Complexity** | Low |
| **Estimated Effort** | 30 minutes |
| **Dependencies** | S0-C2 |
| **Blocks** | None |

---

## Context

### What We're Building

Configure comprehensive branch protection rules beyond status checks, including review requirements, commit signing, and conversation resolution.

### Why This Matters

- **Code review**: Every change is peer-reviewed
- **History integrity**: Linear history is easier to understand
- **Conversation tracking**: All feedback must be addressed
- **Accountability**: Clear trail of who approved what

### Spec References

- `/docs/07-engineering-process/ci-cd-spec.md#3-branch-protection`
- `/docs/07-engineering-process/engineering-handbook.md#6-pr-discipline`

---

## Prerequisites

### Completed Tasks

- [x] S0-C1: GitHub Actions workflow
- [x] S0-C2: Required checks configuration

### Required Access

- Repository admin access

---

## Instructions

### Phase 1: Test First (TDD)

Update the verification script from S0-C2 to check additional protections.

**File: `scripts/verify-repo-settings.ts`** (update)

```typescript
/**
 * Comprehensive GitHub repository settings verification
 */

import { Octokit } from '@octokit/rest';

interface ProtectionSettings {
  requireStatusChecks: boolean;
  strictStatusChecks: boolean;
  requiredChecks: string[];
  requireReviews: boolean;
  requiredReviewers: number;
  dismissStaleReviews: boolean;
  requireConversationResolution: boolean;
  enforceAdmins: boolean;
  requireLinearHistory: boolean;
  allowForcePushes: boolean;
  allowDeletions: boolean;
}

async function verifyBranchProtection(): Promise<ProtectionSettings | null> {
  const token = process.env['GITHUB_TOKEN'];
  if (!token) {
    console.error('GITHUB_TOKEN environment variable required');
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });
  const owner = 'L0v3Chrix';
  const repo = 'RTV-social';

  try {
    const { data: protection } = await octokit.repos.getBranchProtection({
      owner,
      repo,
      branch: 'main',
    });

    const settings: ProtectionSettings = {
      requireStatusChecks: !!protection.required_status_checks,
      strictStatusChecks: protection.required_status_checks?.strict ?? false,
      requiredChecks: protection.required_status_checks?.contexts ?? [],
      requireReviews: !!protection.required_pull_request_reviews,
      requiredReviewers:
        protection.required_pull_request_reviews?.required_approving_review_count ?? 0,
      dismissStaleReviews:
        protection.required_pull_request_reviews?.dismiss_stale_reviews ?? false,
      requireConversationResolution:
        protection.required_conversation_resolution?.enabled ?? false,
      enforceAdmins: protection.enforce_admins?.enabled ?? false,
      requireLinearHistory: protection.required_linear_history?.enabled ?? false,
      allowForcePushes: protection.allow_force_pushes?.enabled ?? false,
      allowDeletions: protection.allow_deletions?.enabled ?? false,
    };

    // Print results
    console.log('\n📋 Branch Protection Settings for main:\n');

    const checkMark = (condition: boolean) => (condition ? '✅' : '❌');

    console.log(`${checkMark(settings.requireStatusChecks)} Require status checks`);
    console.log(`${checkMark(settings.strictStatusChecks)} Strict status checks (up-to-date)`);
    console.log(`${checkMark(settings.requiredChecks.length >= 5)} Required checks (${settings.requiredChecks.length}/5)`);
    console.log(`${checkMark(settings.requireReviews)} Require pull request reviews`);
    console.log(`${checkMark(settings.requiredReviewers >= 1)} Required reviewers (${settings.requiredReviewers})`);
    console.log(`${checkMark(settings.dismissStaleReviews)} Dismiss stale reviews`);
    console.log(`${checkMark(settings.requireConversationResolution)} Require conversation resolution`);
    console.log(`${checkMark(settings.enforceAdmins)} Enforce for admins`);
    console.log(`${checkMark(settings.requireLinearHistory)} Require linear history`);
    console.log(`${checkMark(!settings.allowForcePushes)} Block force pushes`);
    console.log(`${checkMark(!settings.allowDeletions)} Block deletions`);

    return settings;
  } catch (error: any) {
    if (error.status === 404) {
      console.log('\n❌ Branch protection not configured');
      return null;
    }
    throw error;
  }
}

verifyBranchProtection().catch(console.error);
```

### Phase 2: Implementation

#### Update Branch Protection via GitHub CLI

**File: `scripts/setup-branch-protection.sh`** (update)

```bash
cat > scripts/setup-branch-protection.sh << 'EOF'
#!/bin/bash
# Complete branch protection setup for main branch
# Requires: gh CLI authenticated with repo admin access

set -e

OWNER="L0v3Chrix"
REPO="RTV-social"
BRANCH="main"

echo "🔒 Setting up comprehensive branch protection for $OWNER/$REPO ($BRANCH)"

# Create/update the branch protection rule
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
    "required_approving_review_count": 1,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON

echo ""
echo "✅ Branch protection configured successfully"
echo ""

# Summary of settings
echo "📋 Protection Settings:"
echo "  ✓ Required status checks: Lint, Type Check, Test, Build, CI OK"
echo "  ✓ Strict mode: Branch must be up-to-date"
echo "  ✓ Required reviewers: 1"
echo "  ✓ Dismiss stale reviews: Yes"
echo "  ✓ Require last push approval: Yes"
echo "  ✓ Require conversation resolution: Yes"
echo "  ✓ Enforce for admins: Yes"
echo "  ✓ Require linear history: Yes"
echo "  ✓ Block force pushes: Yes"
echo "  ✓ Block deletions: Yes"
echo ""

# Verify
echo "Verifying configuration..."
gh api repos/$OWNER/$REPO/branches/$BRANCH/protection \
  --jq '{
    status_checks: .required_status_checks.contexts,
    strict: .required_status_checks.strict,
    reviewers: .required_pull_request_reviews.required_approving_review_count,
    enforce_admins: .enforce_admins.enabled,
    linear_history: .required_linear_history.enabled
  }'
EOF

chmod +x scripts/setup-branch-protection.sh
```

#### Alternative: GitHub Web UI Steps

1. **Go to Repository Settings → Branches**

2. **Edit `main` branch protection rule**

3. **Enable these settings:**

   **Protect matching branches:**
   - [x] Require a pull request before merging
     - [x] Require approvals: 1
     - [x] Dismiss stale pull request approvals when new commits are pushed
     - [x] Require approval of the most recent reviewable push
   - [x] Require status checks to pass before merging
     - [x] Require branches to be up to date before merging
     - Status checks: Lint, Type Check, Test, Build, CI OK
   - [x] Require conversation resolution before merging
   - [x] Require linear history
   - [x] Do not allow bypassing the above settings

   **Rules applied to everyone including administrators:**
   - [x] Checked

   **Allow force pushes:**
   - [ ] Unchecked (disabled)

   **Allow deletions:**
   - [ ] Unchecked (disabled)

4. **Save Changes**

### Phase 3: Verification

```bash
# Run the setup script
./scripts/setup-branch-protection.sh

# Verify with the verification script
GITHUB_TOKEN=$(gh auth token) npx tsx scripts/verify-repo-settings.ts

# Manual verification tests:
# 1. Create a PR without review → Should be blocked
# 2. Create a PR with unresolved conversations → Should be blocked
# 3. Try to force push to main → Should be rejected
```

---

## Branch Protection Rules Summary

| Rule | Setting | Purpose |
|------|---------|---------|
| Require status checks | Enabled + Strict | CI must pass, branch must be current |
| Required reviewers | 1 | Peer review for all changes |
| Dismiss stale reviews | Yes | New commits invalidate old approvals |
| Last push approval | Yes | Final commit must be approved |
| Conversation resolution | Yes | All feedback addressed |
| Linear history | Yes | Clean, rebase-based history |
| Enforce for admins | Yes | No bypassing rules |
| Force pushes | Blocked | History is immutable |
| Deletions | Blocked | Branch cannot be deleted |

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Update | `scripts/setup-branch-protection.sh` | Complete protection setup |
| Update | `scripts/verify-repo-settings.ts` | Comprehensive verification |
| Configure | GitHub Repository Settings | Branch protection rules |

---

## Acceptance Criteria

- [ ] All protection rules from table above are enabled
- [ ] PRs require at least 1 approval
- [ ] Stale reviews are dismissed on new commits
- [ ] Conversations must be resolved before merge
- [ ] Linear history required (no merge commits)
- [ ] Admins cannot bypass rules
- [ ] Force pushes blocked
- [ ] Branch deletion blocked
- [ ] Verification script confirms all settings

---

## Test Requirements

### Manual Tests

- PR with unresolved conversation → Cannot merge
- PR with stale approval after new commit → Needs re-approval
- Force push to main → Rejected

### Automated Tests

- Verification script shows all green checkmarks

---

## Security & Safety Checklist

- [ ] No user can bypass protection rules
- [ ] History cannot be rewritten
- [ ] All changes are traceable
- [ ] Branch cannot be accidentally deleted

---

## JSON Task Block

```json
{
  "task_id": "S0-C3",
  "name": "Branch Protection Rules",
  "sprint": 0,
  "agent": "C",
  "status": "pending",
  "complexity": "low",
  "estimated_hours": 0.5,
  "dependencies": ["S0-C2"],
  "blocks": [],
  "tags": ["ci", "github", "branch-protection", "security"],
  "acceptance_criteria": [
    "1 required reviewer",
    "stale reviews dismissed",
    "conversation resolution required",
    "linear history required",
    "admins enforced"
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

1. **S0-C4**: Configure preview deployments
2. **S0-C5**: Set up environment variables
