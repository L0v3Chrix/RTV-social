# H) Tenancy-Aware E2E Test Harness (Sandbox Accounts) — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose:** Provide a **repeatable, tenancy-aware end-to-end test system** that proves:

1) **No cross-tenant data access** (read/write isolation)
2) **No cross-tenant side effects** (publish/DM/comment/like to the wrong account)
3) **Golden paths work** (Plan → Create → Schedule → Publish → Verify → Engage)
4) Browser lane actions are **identity-verified** and fail-closed

This harness is designed to run:

- locally (developer laptop)
- in CI on every PR
- as daily canaries (staging)

---

## 0) Non‑negotiables

1) **Sandbox-only for side effects.** No automated publish/DM/like runs against real client accounts.
2) **Test harness is multi-tenant by default.** Every run provisions ≥2 tenants and proves separation.
3) **Deterministic & replayable.** Same inputs must produce the same outputs (within platform drift).
4) **Evidence-first failure artifacts.** Every failure yields:
   - trace_id
   - screenshots / video (browser lane)
   - tool call transcript summary
   - audit event bundle

---

## 1) Test harness architecture

### 1.1 Components

**A) Seed & Fixture Service**
- Creates tenants, BrandKit/KB, policies, flags, platform accounts
- Resets state between runs

**B) Sandbox Credential Pack**
- Vault-backed secret refs for sandbox accounts
- Includes:
  - platform API tokens (where supported)
  - browser profiles (where needed)

**C) E2E Runner**
- Executes golden-path workflows through the same public APIs the web app uses
- Also triggers runner/queue episodes

**D) Browser Lane Runner (Playwright)**
- Drives UI for platforms without safe API coverage (stories, some engagement)
- Uses profile vault to load authenticated profiles

**E) Assertions + Probes**
- Verifies:
  - DB isolation
  - audit records
  - outbound side-effect attempts
  - platform visibility checks

**F) Artifact Store**
- Stores:
  - traces
  - screenshots
  - HAR/network logs (optional)
  - DOM snapshots
  - failure bundles

### 1.2 Execution flow

1) Seed 2+ tenants: `TENANT_A`, `TENANT_B`
2) Connect each tenant to separate sandbox platform accounts + browser profiles
3) Execute golden path for each tenant
4) Execute **cross-tenant negative tests**
5) Validate audits + verification checks
6) Export run report and artifacts

---

## 2) Sandbox account strategy by platform

The platform testing strategy is split into **API Lane** and **Browser Lane**, with sandbox accounts created and managed centrally.

### 2.1 Meta (Facebook + Instagram)

**Testing goal:** Safely validate OAuth, posting, comment flows, and permission gating.

Use Meta’s development testing tooling:
- **Test Users** for simulated accounts
- **Test Pages** for simulated Pages used in dev mode

**Notes for your harness:**
- Keep each tenant mapped to its own test user/page pair
- Store all Meta tokens as Vault secret refs

### 2.2 TikTok

Use TikTok’s **Sandbox mode** to test integrations without full app review.

**Harness approach:**
- Maintain one TikTok Developer App with multiple sandboxes
- Assign sandbox credentials per tenant

### 2.3 YouTube

No universal “sandbox mode” for content posting in the same sense.

**Harness approach:**
- Create a dedicated internal Google account (or set) with test channels
- Treat these channels as sandbox targets
- Restrict automation cadence and keep all runs staged

### 2.4 LinkedIn

LinkedIn has strict automation policies.

**Harness approach:**
- Prefer API lane for allowed actions
- Avoid browser lane engagement automation for LinkedIn in MVP (manual-only or human-in-loop)

### 2.5 X (Twitter)

**Harness approach:**
- Use dedicated internal test accounts
- Rate-limit heavily
- Use dry-run mode for most PR checks; full side effects only on staging canaries

### 2.6 Skool

Skool is included in the system, but it has strict restrictions around automation/bots.

**Harness approach:**
- Keep Skool E2E tests focused on:
  - planning → content creation
  - manual publishing instructions
  - read-only verification (fetch/check views) if available
- If browser automation is ever used for Skool, keep it strictly human-triggered and compliance-reviewed.

---

## 3) Tenancy-aware test data model

### 3.1 Tenant fixture schema
Each test tenant must have:
- BrandKit (voice, offers, visual tokens)
- KnowledgeBase (FAQ, resources)
- ProviderConfig routing (planner/creator/engagement)
- BYOK Keyring refs (sandbox provider keys)
- PlatformAccounts w/ lane preference
- Feature flags defaults (side effects OFF)

### 3.2 Mandatory “Twin Tenant” setup
Each CI run creates **at least two tenants**:

- `TENANT_A`: normal sandbox setup
- `TENANT_B`: normal sandbox setup

And optionally:
- `TENANT_C`: “high restriction” policy pack

### 3.3 Hard invariant
All E2E test code must require passing `tenant_id` explicitly.

---

## 4) Golden Path Matrix (E2E)

### 4.1 Golden Path 1 — Planning
**Given** BrandKit + KB are present
**When** the Planner is invoked
**Then** it produces:
- PlanGraph nodes
- content calendar draft
- blueprint selection

**Assertions:**
- plan nodes are tenant-scoped
- cost budget recorded

### 4.2 Golden Path 2 — Creation
**When** Create is invoked from an approved plan
**Then** it produces:
- copy assets
- image assets
- video clip assets (silent-first where applicable)

**Assertions:**
- assets written under tenant namespace
- prompt packs saved
- no secrets in artifacts

### 4.3 Golden Path 3 — Scheduling
**When** assets are scheduled
**Then** Calendar shows:
- scheduled posts
- platform mapping
- publish windows

**Assertions:**
- schedule objects tenant-scoped
- idempotency keys present

### 4.4 Golden Path 4 — Publishing
**When** publish is triggered
**Then**:
- side-effect attempts are audited
- platform post appears (in sandbox)

**Assertions:**
- preflight policy passes
- correct platform account target
- publish verification succeeds

### 4.5 Golden Path 5 — Engagement
**When** engagement job runs
**Then**:
- reads new comments/DMs
- drafts replies
- sends only if policy allows

**Assertions:**
- no spam loops
- reply templates match brand constraints
- escalation rules triggered correctly

---

## 5) Cross-tenant negative tests (must-pass)

These tests prove isolation is real.

### 5.1 Data access isolation tests
- Attempt to fetch Tenant B plan with Tenant A operator context → **deny**
- Attempt to attach Tenant B asset to Tenant A plan → **deny**

### 5.2 Side-effect isolation tests
- Force a job payload mismatch:
  - TenantContext says A
  - platform_account_id belongs to B
  - expected behavior: **fail closed** before tool call

### 5.3 Secret isolation tests
- Attempt to resolve CredentialRef for tenant B while in tenant A job → **deny**

### 5.4 Browser profile mismatch test
- Provide tenant A with tenant B profile_id
- Expected:
  - identity preflight fails
  - no clicks performed
  - incident card produced

---

## 6) Browser lane E2E testing (Playwright)

### 6.1 Why Playwright
Playwright provides:
- resilient locators
- auto-waiting
- parallel workers
- trace capture
- screenshot/video on failure

### 6.2 Browser lane structure
- One Playwright **project** per platform, per lane:
  - `instagram-browser`
  - `facebook-browser`
  - `tiktok-browser`
  - `x-browser`
  - `skool-browser` (if ever allowed)

### 6.3 Test isolation
- Each test uses its own storage state/profile mapping
- No shared mutable global state

### 6.4 Required browser artifacts
On every failure capture:
- screenshot
- video (optional for all tests; required for failed)
- trace
- DOM snapshot hash

### 6.5 Selector strategy
- Prefer stable, user-facing locators
- Centralize selectors per platform in one package:
  - `/packages/browser/selectors/{platform}.ts`

### 6.6 Drift detection
- Maintain per-platform “expected DOM anchors” list
- If anchor missing → drift alert

---

## 7) API lane E2E testing

### 7.1 When to use API lane tests
- OAuth/token refresh
- post creation
- comment retrieval
- verification endpoints

### 7.2 Contract tests
Every connector has:
- request schema validation
- response schema validation
- retries/backoff correctness

---

## 8) Environments & safety controls

### 8.1 Environments
- **Preview**: no side effects (dry-run only)
- **Staging**: sandbox side effects allowed (rate limited)
- **Production**: real side effects only via flags + manual approvals

### 8.2 Feature-flag gating in tests
- Default: all side-effect flags OFF
- Tests must explicitly enable only for sandbox tenants in staging

### 8.3 Rate limiting
- Per-tenant and per-platform rate limits enforced in runner
- Test harness expects and asserts these limits

---

## 9) CI integration

### 9.1 Test tiers
**Tier 0 (PR required):**
- unit + integration
- tenant isolation tests (DB/queue/secrets)
- browser lane smoke (against internal sandbox site)

**Tier 1 (main required):**
- full golden path in dry-run

**Tier 2 (nightly staging canary):**
- sandbox side effects enabled
- platform-specific publish + verify
- minimal engagement checks

### 9.2 Flake management
- Quarantine flaky tests with explicit owner + deadline
- Never disable tests silently

---

## 10) Evidence bundle format (what every run outputs)

Each run produces an **evidence bundle**:

- `run.json`
  - environment
  - git sha
  - tenant ids
  - timestamps
  - pass/fail summary
- `audits.jsonl`
  - all AuditEvents produced
- `artifacts/`
  - traces
  - screenshots
  - videos
  - DOM snapshots
- `report.md`
  - human-readable recap

---

## 11) Implementation checklist (MVP)

1) Build seed/fixture service
2) Create sandbox accounts and map per tenant
3) Add Playwright harness w/ projects per platform
4) Add cross-tenant negative tests
5) Add CI tiers and required checks
6) Add nightly staging canary schedule
7) Integrate evidence bundles into Observability dashboard

---

## 12) Post-MVP extensibility patterns

1) Tenant tiering: dedicated runner pools
2) Platform expansion: new Playwright project + new connector module
3) Client login: same harness can run as a “client persona”
4) Metrics tests: campaign performance validation (V2)

---

## 13) Next document

**I) Sandbox Account Ops Runbook (Creation, Rotation, Recovery) — v1**

