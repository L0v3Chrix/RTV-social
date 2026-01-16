# Remaining Documentation Recommendations — Master Index (v1)

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

This is a **gap-focused** list of additional docs that typically make or break build + operations success for an agentic, multi-tenant system with **real-world side effects** (posting, DMs, comments, likes).

It’s organized so you can drop each item into `/docs/` as a repo artifact. Several items are “small but critical” because they prevent catastrophic failures (wrong-account actions, policy bypass, runaway recursion, etc.).

**Key best-practice anchors used across this list:**
- Reliability discipline (SLOs + error budgets) — write policies, enforce when burned. ([sre.google](https://sre.google/workbook/implementing-slos/?utm_source=chatgpt.com))
- Security verification standards (OWASP ASVS) — map checks to a known control set. ([owasp.org](https://owasp.org/www-project-application-security-verification-standard/?utm_source=chatgpt.com))
- Secure SDLC (NIST SSDF) + supply chain integrity (SLSA). ([csrc.nist.gov](https://csrc.nist.gov/projects/ssdf?utm_source=chatgpt.com))
- Observability naming + semantic conventions (OpenTelemetry). ([opentelemetry.io](https://opentelemetry.io/docs/concepts/semantic-conventions/?utm_source=chatgpt.com))
- Feature flags with explicit evaluation context (OpenFeature), and disciplined change tracking (Keep a Changelog + SemVer). ([openfeature.dev](https://openfeature.dev/specification/sections/evaluation-context?utm_source=chatgpt.com))

---

## A) Platform Integration & Side-Effect Control

### A1) Platform Integration Contracts (per platform)
**Use case:** Make platform wiring predictable, testable, and safe.

**What it contains:**
- Supported surfaces per platform (feed posts, reels, stories, comments, DMs, likes)
- Lane availability: API vs Browser vs Hybrid
- Auth method + token lifecycle (OAuth refresh patterns, expiry handling)
- Rate limits / backoff strategy / batching rules
- Sandbox/testing constraints + test account requirements
- “Proof of action” rules (how we verify a post/comment/DM actually went live)

**Why it matters:** Keeps API + browser automation behavior aligned and prevents brittle one-off implementations.

### A2) Auth & Token Lifecycle Spec
**Use case:** Stop outages caused by silent token expiry, scope mismatch, or refresh loops.

**What it contains:**
- Token states and transitions: valid → expiring → refresh → rotated → revoked
- Failure modes: refresh denied, consent revoked, suspicious login, captcha
- Storage rules: secret refs only; no raw tokens in DB/logs
- Alerting + runbooks for auth failures

### A3) Side-Effect Idempotency & De-duplication Spec
**Use case:** Prevent double-posting, duplicate DMs, repeated comment replies.

**What it contains:**
- Idempotency keys and how they’re generated per action type
- De-dupe windows per platform surface
- Exactly-once vs at-least-once policies by job type
- Replay-safe action design (safe retries)

### A4) Publish Verification & Reconciliation Spec
**Use case:** Ensure “success” means **visible on platform**, not “API returned 200.”

**What it contains:**
- Verification strategies: API fetch-back, browser confirm, screenshot proof
- Time-to-visible SLO targets + escalation thresholds ([sre.google](https://sre.google/sre-book/service-level-objectives/?utm_source=chatgpt.com))
- Reconciliation jobs: detect missing posts, mismatched captions, wrong media

---

## B) Multi-Tenant Safety, Access, and Isolation

### B1) Multi-Tenant Isolation & Data Boundary Spec (if not already finalized)
**Use case:** Ensure one client can never affect another client.

**What it contains:**
- Hard isolation rules (tenant_id scoping across DB, cache, queues, logs)
- Cross-tenant access tests and expected failures
- “Wrong-account” blast-radius controls (global kill switch, per-tenant kill)

### B2) RBAC & Operator Permissioning Spec (if not already finalized)
**Use case:** Agency ops needs granular permissions for planning/creation/publish/engage.

**What it contains:**
- Roles (Owner, Admin, Ops, Reviewer, Analyst, Auditor)
- Per-surface permissions (publish, DM, comment, like, browser-vault access)
- Break-glass flows + high-risk action approvals

### B3) Customer Offboarding & Data Deletion Runbook
**Use case:** A clean, provable offboarding that protects you and the client.

**What it contains:**
- Disconnect platform accounts and revoke tokens
- Rotate/disable BYOK references
- Purge or archive data per retention policy
- Export package generation for client handoff

---

## C) Observability, Ops Cadence, and Run-Time Control

### C1) Observability Data Dictionary + Naming Conventions
**Use case:** Make telemetry consistent across web, runner, tools, and browser lane.

**What it contains:**
- Required fields for logs/traces/metrics (tenant_id, platform_account_id, trace_id)
- Event taxonomy: PlanEvent, AssetEvent, PublishEvent, EngageEvent, PolicyEvent
- OpenTelemetry semantic conventions mapping ([opentelemetry.io](https://opentelemetry.io/docs/concepts/semantic-conventions/?utm_source=chatgpt.com))

### C2) Operator Daily/Shift SOP (Check-in Playbook)
**Use case:** Achieve your target: “check in a couple times/day” without chaos.

**What it contains:**
- Morning: queue health + auth status + publish schedule scan
- Midday: engagement review + escalations
- Evening: verification + backlog grooming
- Required dashboards + drilldowns

### C3) Backup & Disaster Recovery Plan
**Use case:** Recover from data loss, bad deploys, broken integrations.

**What it contains:**
- Backup schedule (DB, object store, secrets refs, audit logs)
- RPO/RTO targets
- Restore drills + acceptance checks

---

## D) Model, Prompt, and Agent Governance

### D1) Model Governance Spec (BYOK-aware)
**Use case:** Prevent model sprawl, cost blowups, or unsafe provider switching.

**What it contains:**
- Allowed providers/models per task class (planner/creator/engagement)
- Fallback ladder and “degraded mode” routing
- Cost caps per tenant; escalation thresholds
- Version pinning rules + change control

### D2) Prompt Versioning & Regression Harness
**Use case:** Prompts are code; changes can silently break behavior.

**What it contains:**
- Prompt packaging and semantic versioning ([semver.org](https://semver.org/?utm_source=chatgpt.com))
- Golden prompt suites (inputs → expected structure/outcome)
- Diff-based evaluation (format + policy compliance + style adherence)
- Rollback protocol for prompt regressions

### D3) Agent “Charter” Library (per agent type)
**Use case:** Keep each agent’s role crisp, reduce recursion loops.

**What it contains:**
- Responsibilities, forbidden actions, tool permissions
- Required outputs + evidence standard
- Stop conditions + escalation paths

### D4) Human-in-the-Loop Design Spec
**Use case:** Make “approval columns” clean and scalable.

**What it contains:**
- What requires review (by policy + by risk)
- UX patterns: batch approve, annotate, request revision
- Evidence attached to each approval (preview, platform target, policy checks)

---

## E) Reliability, Security, and Compliance Extensions

### E1) Secure SDLC Alignment Addendum (SSDF-based)
**Use case:** Ensure your build process stays secure at speed.

**What it contains:**
- SSDF practice mapping to your repo workflow (planning → coding → review → release)
- Required security gates and who owns them ([csrc.nist.gov](https://csrc.nist.gov/projects/ssdf?utm_source=chatgpt.com))

### E2) Supply Chain Attestation & Provenance Plan (SLSA-based)
**Use case:** Reduce risk of tampered builds and dependency attacks.

**What it contains:**
- Target SLSA level for MVP and post-MVP
- Build provenance generation + artifact signing strategy ([slsa.dev](https://slsa.dev/spec/v1.0/levels?utm_source=chatgpt.com))

### E3) “Terms-of-Use Risk Register” + Enforcement Notes
**Use case:** Track where automation might violate platform rules (esp. browser lane).

**What it contains:**
- Per platform: what we automate, what we avoid, required operator approvals
- “Gray areas” list + mitigation controls
- Logging requirements and “disable quickly” procedures

*(Not legal advice; this is an engineering risk register.)*

---

## F) Experimentation, Growth, and Future Analytics

### F1) Content Experiment Design Guide (Operator-facing)
**Use case:** Make experiments reproducible and comparable.

**What it contains:**
- Hypothesis templates
- What variables can be changed safely
- How we tag/track experiments
- Stop rules based on SLO burn and performance

### F2) Future Metrics & Attribution Spec (Post-MVP analytics)
**Use case:** Your v2 needs measurement and “what worked” learning.

**What it contains:**
- What metrics matter by platform + blueprint type
- Ingestion plan (API or scrape) and normalization strategy
- Attribution mapping to campaigns/offers

---

## G) Product & Internal Enablement

### G1) Operator Training Manual (Agency-only)
**Use case:** New team members can operate without tribal knowledge.

**What it contains:**
- How to onboard a client
- How to run planning/creation/publish/engage loops
- How to troubleshoot common failures

### G2) Customer Success Playbook (Agency-facing)
**Use case:** Keep clients happy without giving them logins.

**What it contains:**
- Monthly reporting template
- Content review cadence
- How to handle escalations, complaints, brand drift

---

## H) “One Pager” Index Files (Small, high leverage)

### H1) `/docs/README.md` — Documentation Map
**Use case:** Anyone can find the right spec fast.

### H2) `/docs/OPERATIONS.md` — The Operator’s Map
**Use case:** Single page: how to run the platform day-to-day.

### H3) `/docs/SAFETY.md` — Kill Switches + Side-Effect Rules
**Use case:** When something goes wrong, this is what people open first.

---

## Suggested file layout

```
/docs/
  specs/
  runbooks/
  adr/
  journal/
  training/
  policies/
  platform/
  testing/
  security/
```

---

## If you want me to generate the next doc
Pick one (I’ll generate it as a standalone artifact like your others):

1) Platform Integration Contracts (per platform)
2) Auth & Token Lifecycle Spec
3) Side-Effect Idempotency & De-dupe Spec
4) Observability Data Dictionary + Naming
5) Prompt Versioning & Regression Harness

