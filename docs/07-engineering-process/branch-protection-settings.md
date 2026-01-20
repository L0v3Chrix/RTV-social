# Branch Protection Settings

**Project:** RTV Social Automation Platform
**Document:** S0-C3 Branch Protection Configuration
**Last Updated:** 2025-01-19

---

## Overview

This document describes the branch protection rules configured for the `main` branch to ensure code quality, enforce review processes, and maintain a clean commit history.

**Core Principle:** Protected branches + required checks enforce quality before merge. No code reaches `main` without passing CI and peer review.

---

## Quick Reference

| Setting | Value | Purpose |
|---------|-------|---------|
| Required status checks | `CI OK` | All CI jobs must pass |
| Strict mode | Enabled | Branch must be up-to-date |
| Required reviewers | 1 | Peer review before merge |
| Dismiss stale reviews | Yes | Re-review after changes |
| Conversation resolution | Required | All feedback addressed |
| Linear history | Required | Clean commit graph |
| Force pushes | Blocked | Prevent history rewriting |
| Deletions | Blocked | Protect main branch |
| Admin enforcement | Yes | No bypassing rules |

---

## Protection Rules Explained

### 1. Required Status Checks

**Setting:** `CI OK` check must pass
**Strict Mode:** Enabled (branch must be up-to-date before merging)

**What it does:**
- The `CI OK` job in `.github/workflows/ci.yml` is a summary job that depends on:
  - `lint` - Code style and quality checks
  - `typecheck` - TypeScript type validation
  - `test` - Unit and integration tests
  - `build` - Production build verification
- All these jobs must pass before the PR can be merged.

**Why:**
- Prevents broken code from reaching `main`
- Ensures all checks pass against the latest `main` (strict mode)
- Single check name simplifies branch protection configuration

**Strict Mode Impact:**
- If `main` has new commits after your PR was approved, you must update your branch
- Prevents "merge skew" where CI passed on old code but new `main` breaks it

---

### 2. Pull Request Review Requirements

**Required Approvals:** 1
**Dismiss Stale Reviews:** Enabled
**Last Push Approval:** Required (pusher cannot self-approve)

**What it does:**
- At least one team member must approve the PR
- Approvals are dismissed when new commits are pushed
- The person who pushed the most recent commit cannot approve it

**Why:**
- Enforces peer review for all code changes
- Ensures reviewers re-check after changes are made
- Prevents self-approval of last-minute changes

**Best Practices:**
- Request specific reviewers who know the affected code
- Provide context in PR description for faster reviews
- Keep PRs small (reviewable in 10-20 minutes)

---

### 3. Conversation Resolution

**Setting:** Required before merge

**What it does:**
- All review comments marked as "conversations" must be resolved
- Unresolved feedback blocks the merge

**Why:**
- Ensures all feedback is addressed, not ignored
- Creates accountability for review comments
- Improves code quality through thorough review

**How to resolve:**
- Address the feedback in code and reply explaining the change
- If declining feedback, explain why and resolve after discussion
- Reviewer can also resolve if satisfied

---

### 4. Linear History

**Setting:** Required

**What it does:**
- Forces squash merges or rebase merges
- Prevents merge commits from PRs
- Results in a clean, linear commit history

**Why:**
- Easier to read git history
- Simpler to bisect for bugs
- Cleaner rollback if needed
- No "merge commit noise"

**Merge Strategy:**
- Use "Squash and merge" for most PRs (recommended)
- Use "Rebase and merge" if preserving individual commits matters

---

### 5. Force Pushes

**Setting:** Blocked

**What it does:**
- Prevents `git push --force` to `main`
- Protects committed history from rewriting

**Why:**
- Prevents accidental history destruction
- Maintains audit trail of all changes
- Protects other developers' work

**Note:** This applies even to administrators.

---

### 6. Branch Deletions

**Setting:** Blocked

**What it does:**
- Prevents deletion of the `main` branch
- Protects the primary development branch

**Why:**
- Prevents catastrophic accidents
- Ensures `main` always exists as the source of truth

---

### 7. Admin Enforcement

**Setting:** Enabled (administrators must follow rules)

**What it does:**
- Repository administrators cannot bypass these rules
- Same protection applies to everyone

**Why:**
- Ensures consistent process for all team members
- Prevents "emergency" bypasses that skip quality checks
- Maintains trust in the protection system

---

## Verification

### Automated Verification

Run the verification script to check current settings:

```bash
# With GitHub token (checks actual settings)
GITHUB_TOKEN=your_token pnpm vitest run scripts/verify-repo-settings.test.ts

# Without token (shows expected settings only)
pnpm vitest run scripts/verify-repo-settings.test.ts
```

### Manual Verification

1. Go to repository Settings > Branches
2. Click "Edit" on the `main` branch rule
3. Verify each setting matches this document

---

## Setup

### Automated Setup

Use the provided setup script:

```bash
# Preview what will be configured
./scripts/setup-branch-protection.sh --dry-run

# Apply branch protection rules
./scripts/setup-branch-protection.sh
```

**Prerequisites:**
- `gh` CLI installed: https://cli.github.com/
- Authenticated: `gh auth login`
- Admin access to the repository

### Manual Setup via GitHub Web UI

If you prefer to configure via the web interface:

1. **Navigate to Settings**
   - Go to `github.com/raize-the-vibe/rtv-social-automation`
   - Click "Settings" tab
   - Click "Branches" in the left sidebar

2. **Add Branch Protection Rule**
   - Click "Add branch protection rule"
   - Branch name pattern: `main`

3. **Configure Required Status Checks**
   - Check "Require status checks to pass before merging"
   - Check "Require branches to be up to date before merging"
   - Search and add: `CI OK`

4. **Configure Pull Request Reviews**
   - Check "Require a pull request before merging"
   - Check "Require approvals"
   - Set "Required number of approvals before merging" to `1`
   - Check "Dismiss stale pull request approvals when new commits are pushed"
   - Check "Require approval of the most recent reviewable push"

5. **Configure Conversation Resolution**
   - Check "Require conversation resolution before merging"

6. **Configure Branch Integrity**
   - Check "Require linear history"
   - Ensure "Allow force pushes" is NOT checked
   - Ensure "Allow deletions" is NOT checked

7. **Configure Admin Enforcement**
   - Check "Do not allow bypassing the above settings"

8. **Save**
   - Click "Create" or "Save changes"

---

## Troubleshooting

### "CI OK" Check Not Available

The check must have run successfully in the last 7 days to be selectable.

**Solution:**
1. Create a PR and let CI run
2. Once `CI OK` completes successfully, configure branch protection
3. Or use the API/gh CLI setup script which doesn't have this limitation

### PR Blocked Despite Passing CI

**Possible causes:**
1. Branch not up-to-date with `main` (strict mode)
   - Solution: Merge or rebase from `main`

2. Stale approval after new commits
   - Solution: Request re-review

3. Unresolved conversations
   - Solution: Resolve all review threads

4. Required check hasn't run yet
   - Solution: Wait for CI to complete

### Admin Needs to Bypass

**Recommendation:** Don't bypass. The rules exist for good reason.

If absolutely necessary:
1. Temporarily disable "Do not allow bypassing" setting
2. Make the change
3. Re-enable the setting immediately
4. Document why bypass was needed

---

## Related Documentation

- [CI/CD Spec](./ci-cd-spec.md) - Complete CI/CD pipeline documentation
- [Definition of Done](./definition-of-done-pr-checklist.md) - PR checklist
- [Engineering Handbook](./engineering-handbook.md) - Development practices
- [GitHub Branch Protection Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-19 | Initial documentation for S0-C3 |
