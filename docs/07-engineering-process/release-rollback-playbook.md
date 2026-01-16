# Release & Rollback Playbook + CHANGELOG Policy — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Goal:** Ship fast **without breaking production** by using:

- small batches
- automated gates
- progressive delivery (flags + canaries)
- deterministic rollback
- disciplined changelog + release notes

This doc is built to match your stack:

- **Next.js on Vercel** (Preview → Production)
- GitHub PR flow with required checks
- Feature flags for side-effect capabilities
- Runner/queues + browser lane (high-risk)

---

## 0) Non‑negotiables

1. **No silent failures**

- Every release must include telemetry updates for any behavior changes.

2. **Side effects are opt-in**

- Anything that publishes/sends/engages is behind feature flags + policy checks.

3. **Always have a rollback path**

- If you can’t roll back safely, you don’t ship.

4. **Append-only truth**

- Changelog + journal are never rewritten to hide reality.

---

## 1) Release levels (what kind of release is this?)

### L0 — Docs-only / non-runtime

- Documentation updates, prompts-only changes with no runtime impact.

### L1 — UI/UX safe

- Admin UI improvements (no side effects).

### L2 — Core logic (no external side effects)

- planning/creation workflows
- schemas, validations, storage, retrieval

### L3 — External side effects (high risk)

- publishing
- scheduling
- engagement
- token refresh
- browser automation

**Rule:** L3 releases require the strictest gates (see §5).

---

## 2) Environments & promotion model

### 2.1 Environments

We maintain three environments with increasing risk:

1. **Preview** (per PR)

- Always-on, used for review, smoke tests, and QA

2. **Staging**

- Long-lived environment for integration and canarying
- Connected only to sandbox platform accounts

3. **Production**

- Agency-operated
- Connected to real client accounts

### 2.2 Promotion rules

- **Preview → Staging**: automatic after merge to main (or manual promote)
- **Staging → Prod**: explicit release step after checks + human review

---

## 3) Branching + PR gates

### 3.1 Trunk-based development

- short-lived branches
- small PRs

### 3.2 Protected branches (GitHub)

`main` is protected:

- require PR review (min 1, more for L3)
- require status checks
- prevent force push
- require branch up-to-date before merge

### 3.3 Required status checks (baseline)

- lint
- typecheck
- unit tests
- integration tests
- migration checks
- security checks (SAST/dependency)
- golden-path smoke tests (as applicable)

**L3 extra required checks:**

- side-effect contracts
- policy engine regression suite
- browser lane smoke on sandbox target

---

## 4) Feature flags & progressive delivery

### 4.1 Why flags are mandatory here

Because you are building automation that can:

- post publicly
- send DMs
- like/comment

Flags reduce blast radius.

### 4.2 Flag scope

All side-effect flags support:

- global
- per-client
- per-platform account
- per-lane (API vs Browser)

### 4.3 Flag defaults

- Production defaults to **OFF** for new L3 features.
- A feature must “earn” the right to be turned on.

### 4.4 Canary strategy

We use canarying to expose changes safely:

- enable in staging on sandbox accounts
- then enable in prod for:
  1. internal “house accounts”
  2. 1–2 low-risk clients
  3. broader rollout

Rollout pace depends on SLO burn rate.

---

## 5) Vercel release mechanics

### 5.1 Deployment Checks (release gates)

A production build is not “released” until checks pass.

Minimum Deployment Checks:

- health check endpoint
- database connectivity
- queue connectivity
- runner heartbeat
- feature flag service reachable
- audit/event write path functioning
- basic UI navigation smoke

**Note:** If checks fail, do not release.

### 5.2 Deployment Protection

- Production URLs protected
- Preview URLs protected (at least team-only)
- Secrets never exposed in preview logs

### 5.3 Rollback on Vercel

We use Vercel Instant Rollback for fast recovery.

**Operational rule:** Do not delete production deployments that might be rollback targets.

---

## 6) Release playbook (step-by-step)

### 6.1 Release prep (T‑24h to T‑0)

1. Confirm target scope

- list PRs included
- identify L3 changes

2. Confirm flags

- new L3 features remain OFF

3. Confirm migrations

- prefer backward-compatible migrations
- if breaking migration is unavoidable, schedule a maintenance window

4. Confirm runbooks updated

- any new alert type has a runbook

5. Confirm changelog draft

- created before release

### 6.2 Release execution (T‑0)

**Phase A — Ship to Staging**

1. Merge to main
2. Deploy staging
3. Run staging smoke tests:

- plan → create → schedule
- dry-run publish (no side effects)
- verification job

**Phase B — Canary in Production** 4) Deploy production (not necessarily enable flags) 5) Enable canary flags for:

- house accounts only
- run publish/engage on a small, controlled schedule

6. Observe for a minimum window (e.g., 30–120 min) depending on risk

**Phase C — Expand rollout** 7) Expand to 1–2 low-risk clients 8) Expand further only if:

- error budget burn acceptable
- no enforcement friction
- publish verification healthy

### 6.3 Post-release validation

- verify:

  - publish success
  - verification time-to-visible
  - queue delay
  - runner availability
  - browser lane drift

- create an entry in the implementation journal:

  - what shipped
  - what was observed
  - any anomalies

---

## 7) Rollback playbook (deterministic)

### 7.1 Rollback triggers

Rollback is warranted when any of the following occur:

**P0 (immediate rollback):**

- wrong-account side effects
- duplicate posts/DMs
- failure to respect kill switch
- security incident suspicion

**P1 (rollback likely):**

- publish failure rate breach
- verification failure rate breach
- queue stuck in a way that blocks operations

**P2 (consider rollback):**

- elevated error rates, but contained
- non-critical UI regressions

### 7.2 Rollback first action: disable flags

Before rolling code back, **immediately disable**:

- publishing flags
- engagement flags
- browser lane side-effect flags

This stops harm while you evaluate.

### 7.3 Rollback decision checklist

1. Are side effects happening incorrectly?
2. Can we stop harm by disabling flags alone?
3. Is the failure isolated to one tenant/platform?
4. Does rollback introduce migration/data mismatch?

### 7.4 Rollback execution

**Option A — Flag rollback (preferred)**

- disable the feature via flags
- keep code deployed
- patch forward

**Option B — Deployment rollback (fast restore)**

- use Instant Rollback
- confirm rollback target is safe
- run post-rollback checks

**Option C — Full rollback + migration rollback**

- only when absolutely necessary
- requires explicit migration rollback plan

### 7.5 Post-rollback steps

- confirm:

  - system is stable
  - no pending side effects in queues
  - verification passes

- open incident + start postmortem process

---

## 8) CHANGELOG policy

### 8.1 Why we maintain a changelog

- A curated, chronological list of notable changes.
- Helps operators and engineers understand what changed and why.

### 8.2 Format: Keep a Changelog + SemVer

We maintain `/CHANGELOG.md` using:

- Keep a Changelog categories
- Semantic Versioning

### 8.3 Versioning rules (SemVer)

- **MAJOR**: breaking change / migration that requires operator action
- **MINOR**: new feature, backward-compatible
- **PATCH**: bug fix, backward-compatible

### 8.4 Changelog categories

For each version, use:

- Added
- Changed
- Deprecated
- Removed
- Fixed
- Security

### 8.5 What counts as “notable”

Include:

- new capabilities
- flag additions/changes
- policy changes
- new integrations
- schema/data model changes
- operational changes
- security changes

Exclude:

- internal refactors with no behavior change
- formatting changes

### 8.6 Changelog entry requirements

Each entry must include:

- short operator-facing description
- risk level (L0–L3)
- flags involved
- migration notes
- rollback notes

---

## 9) Release notes policy (human readable)

### 9.1 Where release notes live

- GitHub Release notes
- optionally mirrored into `/docs/journal/` entry

### 9.2 Release note template

**Title:** vX.Y.Z —&#x20;

**Highlights**

- <1–3 bullets>

**Operator impact**

- Flags:&#x20;
- New checks:&#x20;
- Migrations: \<none|details>
- Runbooks updated:&#x20;

**Risk**

- Release level: L0–L3
- Canary plan:&#x20;

**Rollback plan**

- Flag rollback:&#x20;
- Deployment rollback:&#x20;

**Known issues**

-

---

## 10) Repository files (required)

```
CHANGELOG.md
RELEASE.md                # this playbook
/docs/journal/YYYY-MM-DD.md
/docs/runbooks/
/docs/adr/
```

---

## 11) Post‑MVP extensibility patterns

This playbook is designed to scale:

1. **Multiple services** (web/runner/tools)

- service-specific canaries
- independent rollbacks

2. **Client logins (future)**

- release notes separated by role (operator vs client)

3. **Experimentation OS integration**

- release can spawn experiment variants

4. **Policy bundles**

- versioned policy sets per tenant

---

## 12) Next doc

If you want the remaining reliability pack:

- **Dependency & Supply Chain Policy — v1**
- **Config & Feature Flag Governance — v1**

