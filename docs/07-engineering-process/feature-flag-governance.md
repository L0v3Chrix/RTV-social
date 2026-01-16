# Config & Feature Flag Governance — v1 (B1)

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose:** Make config + feature flags **safe, observable, and boring** so we can ship quickly without accidental platform side-effects (publishing, DMs, comments, likes), and so operators can pause/rollback instantly.

This spec is:
- **Vendor-neutral** and **OpenFeature-aligned** (standard evaluation API + evaluation context) so we can swap control planes later without rewriting app logic.
- Built for **progressive delivery** (canarying config/feature changes) and for **high-risk side effects** where “wrong tenant” or “duplicate action” is catastrophic.

---

## 0) Non‑negotiables

1) **Flags/config NEVER contain secrets.** Only secret references (vault paths / KMS aliases / token handles).

2) **Side effects require TWO gates:**
- **Policy gate** (Compliance & Autonomy Policy Binder)
- **Flag/permission gate** (this doc)

3) **Kill switches exist at 4 scopes:**
- Global
- Platform
- Lane (API vs Browser)
- Tenant (client)

4) **Every config/flag change is auditable** (who/what/where/why) and must be visible in the operator dashboard.

5) **Progressive rollout only** (canary first). Config changes can break systems just like code releases; treat them as risky deployments.

---

## 1) Why we use OpenFeature (the interface layer)

We standardize flag evaluation through **OpenFeature**:

- App code calls the OpenFeature Evaluation API (boolean/string/number/object)
- We pass an **Evaluation Context** containing identifiers like `tenant_id`, `platform`, `account_id`, `lane`, `capability`.
- The provider behind OpenFeature can be LaunchDarkly/Unleash/Flagsmith/custom DB—doesn’t matter.

**Outcome:** vendor swapping later is inexpensive; governance remains stable.

---

## 2) Taxonomy: Config vs Flags

### 2.1 Build-time config (immutable per deployment)
Examples:
- UI branding
- public analytics IDs (if allowed)

Rules:
- Changes require deploy
- Never contains secrets

### 2.2 Runtime config (service behavior)
Examples:
- job concurrency
- retry windows
- cost/latency budgets
- queue throttles

Rules:
- Lives in a config store / flag control plane
- Changes can be applied without deploy
- Always audited

### 2.3 Tenant config (per-client settings)
Examples:
- enabled blueprints
- cadence rules
- lane preference per platform (API/browser/hybrid)
- autonomy levels

Rules:
- Lives in DB (non-secret) + references to secrets
- Changes audited
- High-risk fields require review

### 2.4 Feature flags (dynamic logic switches)
Used to:
- decouple deploy from release
- progressively roll out behavior
- do experiments safely

---

## 3) Flag types (four types only)

### 3.1 Release flags (short-lived)
Purpose: ship code dark, then enable gradually.

Requirements:
- Owner
- Expiration date
- Removal ticket
- Default OFF in prod

### 3.2 Operational flags (long-lived)
Purpose: ongoing operational levers (throttles, lane toggles).

Requirements:
- Documented in runbooks
- Visible in dashboard

### 3.3 Permission flags (risk gating)
Purpose: enable/disable specific capabilities by tenant/platform/lane.

Requirements:
- Scoped (no global enable by default)
- Evaluated after policy gate

### 3.4 Experiment flags
Purpose: A/B and variant tests.

Requirements:
- Experiment ID
- Success metrics defined
- Stop conditions defined
- Assignment is logged

---

## 4) Naming conventions + scoping model

### 4.1 Naming standard
Pattern:

`{type}.{domain}.{capability}.{platform}.{lane}.v{N}`

Examples:
- `ff.publish.scheduled.instagram.api.v1`
- `ff.engage.comment_reply.facebook.api.v1`
- `ff.engage.dm_autoreply.skool.browser.v1`
- `ops.lane.browser.enabled.v1`
- `perm.client.{tenant_id}.publish.instagram.v1`

### 4.2 Mandatory scoping keys
Every evaluation MUST support these dimensions (even if implemented in our evaluator rather than the vendor):

- `env` (preview|staging|prod)
- `tenant_id`
- `platform` (instagram|facebook|tiktok|linkedin|youtube|x|skool)
- `platform_account_id`
- `lane` (api|browser|hybrid)
- `capability` (plan|create|schedule|publish|verify|engage_comment|engage_dm|like)

---

## 5) Evaluation precedence (what wins?)

To compute whether an action is allowed:

1) **Global kill switch** (wins)
2) **Platform kill**
3) **Lane kill** (browser lane kill is common)
4) **Tenant kill**
5) **Compliance/Autonomy policy** (manual-only blocks everything)
6) **Permission flag** (capability gate)
7) **Release/experiment flag**
8) **Tenant config** (cadence/blueprints)
9) **Runtime config** (budgets/throttles)
10) **Build defaults**

**Rule:** if any earlier gate blocks → action is blocked.

---

## 6) Kill switches (required set)

### 6.1 Required kill switches
- `kill.global`
- `kill.publish.global`
- `kill.engage.global`
- `kill.browser.global`

- `kill.platform.{platform}`
- `kill.lane.{lane}`
- `kill.tenant.{tenant_id}`
- `kill.tenant.{tenant_id}.platform.{platform}`

### 6.2 UX requirements
- Always visible
- One-click disable
- Requires reason entry
- Emits `ConfigChangeEvent`

---

## 7) Progressive rollout policy (how we turn things on)

We follow canarying practices for **code and configuration**:

### 7.1 Standard rollout ladder
1) Preview validation
2) Staging on sandbox accounts
3) Production deploy with flags OFF
4) Canary enablement on **house accounts**
5) Expand to 1–2 low-risk tenants
6) Expand to broader rollout

### 7.2 Rollout gates
To expand rollout, we require:
- SLOs healthy (no error budget burn spikes)
- Verification success rate above threshold
- No platform enforcement signals

### 7.3 Rollback-first doctrine
If something looks wrong:
1) Disable release flags
2) Engage kill switches if needed
3) Only then consider code rollback

---

## 8) Storage + access model

### 8.1 Where things live
- **Vercel env vars:** bootstrap-only (endpoints, non-secret IDs). Use Vercel’s environment separation (Development/Preview/Production).
- **Secrets manager:** all sensitive keys/tokens/cookies/profile encryption keys.
- **DB:** tenant config + policy + blueprint settings (non-secret) + secret references.
- **Flag provider:** release/ops/permission/experiment flags + runtime configs.

### 8.2 Access rules
- Web app reads config/flags server-side only.
- Runner snapshots config at episode start.
- Any side-effect step re-checks:
  - kill switches
  - policy
  - permission flags

---

## 9) Change control (who can change what)

### 9.1 Roles
- **Operator:** tenant config + tenant permissions within allowed bounds.
- **Release Captain:** enables release flags in production and manages rollout.
- **Security Owner:** approves changes affecting secrets handling, tenant boundaries, or broad side-effect enablement.

### 9.2 Risk tiers
- **Tier A (safe):** UI-only config
- **Tier B (medium):** planning/creation behavior
- **Tier C (high):** publish/DM/comment/like/browser lane

**Tier C changes require:** canary + rollback plan + dashboard watch window.

---

## 10) Testing requirements

### 10.1 Dual-gate tests (must exist for every side-effect feature)
- Flag OFF + policy allow → NO side effect
- Flag ON + policy block → NO side effect
- Flag ON + policy allow → side effect permitted (still requires platform contract)

### 10.2 Canary test suite
Daily:
- evaluate representative contexts for each platform/lane
- validate kill switches block correctly
- validate tenant scoping never bleeds

---

## 11) Observability requirements

Every config/flag evaluation must:
- emit structured logs with `tenant_id`, `platform`, `lane`, `capability`
- include `flag_snapshot_hash` and `config_snapshot_hash`
- be trace-correlated (`trace_id`)

Every config/flag change emits:
- `ConfigChangeEvent` (append-only audit)

---

## 12) Anti-flag-sprawl controls (flag health)

### 12.1 Metadata required per flag
- owner
- type
- created_at
- purpose
- default values by env
- scopes supported
- expiration (required for release flags)

### 12.2 Expiration + cleanup
- Release flags MUST expire
- Expired flags trigger alerts + cleanup tasks

### 12.3 Flag debt caps
- Cap active release flags per domain (publish/engage/browser)
- If cap exceeded → pause shipping and clean up

---

## 13) Post‑MVP extensibility patterns

This governance model scales cleanly to:

1) **Client logins (future)**
- RBAC + approvals
- tenant self-serve toggles under operator constraints

2) **Experimentation OS integration**
- experiment flags with metrics binding
- automatic stop/rollback by SLO + enforcement signals

3) **Policy bundles versioning**
- per-tenant policy versions
- controlled rollout of policy changes

4) **Multiple services** (web/runner/tool-gateway)
- shared flag evaluation layer
- service-specific operational flags

---

## 14) References (standards & practices)

- OpenFeature — Evaluation Context & Flag Evaluation API
- Google SRE — Canarying releases
- Vercel — Environments & environment variable handling (Preview vs Production)
- Feature flag operational practices (documentation, technical debt controls)

