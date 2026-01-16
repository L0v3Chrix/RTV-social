# CI/CD Spec + Required Checks — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Goal:** Ship fast with confidence. Every merge must be:
- **tested** (unit/integration/contract/e2e smoke)
- **observable** (telemetry present)
- **safe** (policy gates + kill switches)
- **deployable** (Preview → Staging → Production with gated promotion)

**Core principle:** Protected branches + required checks enforce quality before merge. ([docs.github.com](https://docs.github.com/articles/about-status-checks?utm_source=chatgpt.com))

---

## 1) Environments & Deployment Model

### 1.1 Git + Vercel environments
We use Vercel’s Git integration to generate:
- **Preview deployments** for every branch/PR
- **Production deployments** when `main` is promoted

Preview environment behavior and creation triggers are first-class in Vercel. ([vercel.com](https://vercel.com/docs/deployments/environments?utm_source=chatgpt.com))

### 1.2 Promotion gating (deployment checks)
Production promotion must be gated by:
- required CI checks (GitHub Actions)
- optional staged checks (staging smoke, canary)

Vercel supports **Deployment Checks** that can block promotion until selected GitHub checks pass. ([vercel.com](https://vercel.com/docs/deployment-checks?utm_source=chatgpt.com))

### 1.3 Environments (recommended set)
- **Preview** (per PR)
- **Staging** (shared pre-prod; sandbox social accounts only)
- **Production**

Vercel formalizes environments for preview vs production behavior. ([vercel.com](https://vercel.com/docs/deployments/environments?utm_source=chatgpt.com))

---

## 2) Branch Protection + Required Checks

### 2.1 Protected branches
Protect:
- `main` (production)
- `staging` (optional) or `release/*` (if used)

Enforce:
- require PR reviews
- require status checks
- require up-to-date branch before merge (recommended)

GitHub branch protection + required checks are the merge gates. ([docs.github.com](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches?utm_source=chatgpt.com))

### 2.2 Required checks naming convention
Required checks must have stable names and run frequently.

**Important operational note:** GitHub requires that a status check has completed successfully in the repo within the past 7 days to be selectable as “required.” ([docs.github.com](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks?utm_source=chatgpt.com))

---

## 3) Pipeline Overview (what runs when)

### 3.1 PR Pipeline (every pull request)
**Purpose:** Prevent bad merges; create preview deployments.

Stages:
1) **Static Analysis** (lint, format, typecheck)
2) **Unit Tests**
3) **Integration Tests**
4) **Contract Tests**
5) **Build** (Next.js build)
6) **E2E Smoke (Golden Paths subset)**
7) **Security checks** (dependency + basic SAST)
8) **Preview Deploy** (Vercel) + “Preview health check”

Vercel will automatically create Preview Deployments for PRs when connected to GitHub. ([vercel.com](https://vercel.com/docs/git/vercel-for-github?utm_source=chatgpt.com))

### 3.2 Staging Pipeline (on merge to main OR manual)
**Purpose:** validate on a stable environment against sandbox accounts.

Stages:
- Deploy to **Staging**
- Run:
  - Browser-lane canary (safe sandbox)
  - API publish dry-run + verification stubs
  - Engagement ingest smoke
  - Observability assertions (logs/traces present)

### 3.3 Production Pipeline (promotion)
**Purpose:** safe promotion and fast rollback.

Stages:
- Ensure deployment checks are green
- Promote to production (Vercel)
- Post-deploy:
  - production health checks
  - error budget burn guard
  - optional canary workflow (read-only where possible)

---

## 4) GitHub Actions Workflows (recommended)

GitHub Actions CI is the default baseline for running builds and tests on events like PRs and pushes. ([docs.github.com](https://docs.github.com/en/actions/get-started/continuous-integration?utm_source=chatgpt.com))

### 4.1 Required workflows (minimum)

**A) `ci-pr.yml`** (required)
Triggered on `pull_request`.
Jobs:
- `lint-typecheck`
- `unit-tests`
- `integration-tests`
- `contract-tests`
- `build`
- `e2e-smoke` (Playwright headless)
- `security-deps` (Dependabot alerts + lockfile sanity; add SCA tool if desired)

**B) `ci-main.yml`** (required)
Triggered on `push` to `main`.
Jobs:
- same as PR, plus:
- `package-artifacts`
- `attest-build-provenance` (see §8)

**C) `staging-smoke.yml`** (required for staging gate)
Triggered on:
- successful `ci-main` OR manual dispatch.
Jobs:
- `staging-e2e` (Golden Paths full)
- `browser-canary` (sandbox)

**D) `daily-canary.yml`** (recommended)
Scheduled.
Jobs:
- `browser-drift-canary` (sandbox)
- `api-lane-health` (mock verification)

---

## 5) Build performance & caching

### 5.1 Next.js CI caching
Persist `.next/cache` between CI runs to improve build times. Next.js documents this explicitly. ([nextjs.org](https://nextjs.org/docs/pages/guides/ci-build-caching?utm_source=chatgpt.com))

### 5.2 Node cache + dependency caching
- Cache package manager artifacts (`~/.npm`, pnpm store, etc.)
- Cache build outputs where safe

### 5.3 Concurrency controls
- Cancel in-progress runs on the same PR when new commits arrive.
- Enforce max parallelism for browser runner tests.

---

## 6) Required Checks (canonical list)

These check names should be configured as **Required status checks** on `main` branch protection.

**Required (MVP):**
1) `lint-typecheck`
2) `unit-tests`
3) `integration-tests`
4) `contract-tests`
5) `build`
6) `e2e-smoke`
7) `security-deps`
8) `vercel-preview` (deployment succeeded)

**Staging gate (recommended):**
9) `staging-e2e`
10) `browser-canary`

GitHub required status checks must be successful before merging. ([docs.github.com](https://docs.github.com/articles/about-status-checks?utm_source=chatgpt.com))

---

## 7) Deployment Checks (Vercel)

### 7.1 Preview deployments
- Every PR automatically generates a Preview Deployment URL
- Vercel posts deployment status back to GitHub

This is part of Vercel’s Git integration model. ([vercel.com](https://vercel.com/docs/git/vercel-for-github?utm_source=chatgpt.com))

### 7.2 Production promotion checks
Configure Vercel **Deployment Checks** to block production promotion until:
- required GitHub checks pass
- optionally staging checks pass

Vercel supports reading GitHub Action statuses as deployment gates. ([vercel.com](https://vercel.com/docs/deployment-checks?utm_source=chatgpt.com))

---

## 8) Supply chain hardening (provenance + attestations)

### 8.1 Build provenance (recommended)
Add provenance attestations for release artifacts.

- SLSA describes provenance as verifiable info about how artifacts were produced. ([slsa.dev](https://slsa.dev/spec/draft/build-provenance?utm_source=chatgpt.com))
- SLSA also provides “BYOB” builder patterns for GitHub Actions. ([slsa.dev](https://slsa.dev/blog/2023/08/bring-your-own-builder-github?utm_source=chatgpt.com))

### 8.2 GitHub Action: attest build provenance
Use GitHub’s `attest-build-provenance` action with OIDC permissions.
This requires `id-token: write` and `attestations: write` permissions. ([github.com](https://github.com/marketplace/actions/attest-build-provenance?utm_source=chatgpt.com))

**MVP position:**
- Enable provenance for production builds and any downloadable artifacts (if shipped).

---

## 9) Secrets, environment variables, and BYOK safety

### 9.1 Secrets management
- CI secrets stored in GitHub Actions secrets
- Runtime secrets in Vercel environment variables
- BYOK secrets are **never** stored as raw values; only references.

### 9.2 Secret scanning
- Enable GitHub secret scanning if available
- Add CI check that blocks merges if `.env` patterns or token formats appear

### 9.3 Environment separation
- Use separate keys/config for Preview/Staging/Prod
- Staging uses sandbox platform accounts and sandbox browser profiles

---

## 10) Artifact policy

### 10.1 What we store from CI
- Build logs (default)
- Playwright artifacts:
  - traces
  - screenshots on failure
  - video on failure (optional)
- Test reports / coverage summaries

### 10.2 Retention
- PR artifacts: 7–14 days
- Main artifacts: 30–90 days (depending on cost)

---

## 11) Quality gates tied to your MVP architecture

### 11.1 Side-effect gates
Any workflow that can:
- publish
- send DM
- reply comment
- like/follow
must be behind:
- feature flag
- kill switch
- policy check
- audit proof

### 11.2 Browser lane gates
Browser lane tests are allowed to be “staging required” until stable.
Once stable:
- make `browser-canary` a required check for production promotion.

---

## 12) CI/CD Runbooks (minimum)

Create runbooks for:
- CI failing on required checks
- Vercel deployment failing
- E2E smoke flaky test triage
- Browser runner drift incident

---

## 13) Implementation checklist (to operationalize)

1) Create GitHub ruleset/branch protection for `main` with required checks. ([docs.github.com](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches?utm_source=chatgpt.com))
2) Connect repo to Vercel Git integration for preview + production deploys. ([vercel.com](https://vercel.com/docs/git?utm_source=chatgpt.com))
3) Configure Vercel Deployment Checks for production promotion. ([vercel.com](https://vercel.com/docs/deployment-checks?utm_source=chatgpt.com))
4) Add Next.js CI caching for `.next/cache`. ([nextjs.org](https://nextjs.org/docs/pages/guides/ci-build-caching?utm_source=chatgpt.com))
5) Add provenance attestation for release artifacts. ([github.com](https://github.com/marketplace/actions/attest-build-provenance?utm_source=chatgpt.com))
6) Define canonical check names and lock them as Required checks. ([docs.github.com](https://docs.github.com/articles/about-status-checks?utm_source=chatgpt.com))
7) Add daily canary schedules for browser lane drift detection.

---

## 14) Next doc

**Security Verification Plan — v1 (ASVS-mapped)**

