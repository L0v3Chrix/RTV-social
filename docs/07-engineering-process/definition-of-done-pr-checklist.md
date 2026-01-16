# Definition of Done + PR Checklist — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose:** This is the *quality gate* for every change. If a PR does not meet this Definition of Done (DoD), it does not merge.

**Non‑negotiable theme:** No silent failures. Every new capability must be testable, observable, auditable, and operable.

---

## 1) Definition of Done (DoD)

A PR is **Done** only when all applicable sections below are satisfied.

### 1.1 Universal DoD (applies to every PR)

**Change clarity**
- [ ] PR title is specific (what changed)
- [ ] PR description includes **Why / What / How / Risk / Rollback**
- [ ] Scope is small (reviewable in ~10–20 minutes). If not, split.

**Correctness**
- [ ] Code builds locally and in CI
- [ ] No new warnings / type errors
- [ ] Lint + format passes

**Testing**
- [ ] Unit tests added/updated where logic changed
- [ ] Integration tests added/updated where system boundaries changed
- [ ] Bug fixes include a regression test (fails before, passes after)

**Observability**
- [ ] New/changed workflow emits structured logs (JSON)
- [ ] New/changed workflow emits metrics for success/failure
- [ ] New/changed workflow participates in trace context (trace_id propagation)

**Audits (side effects)**
- [ ] Any action with an external side effect emits `AuditEvent` with proof (URL/screenshot/file ref)
- [ ] Audit includes policy snapshot reference and correlation IDs

**Security**
- [ ] No secrets or tokens added to repo
- [ ] No secrets logged (incl. request bodies that could contain secrets)
- [ ] Input validation / schema validation added where new inputs introduced

**Documentation (append-only)**
- [ ] Updated or added docs for any behavior change
- [ ] If an architectural decision changed: ADR added (Context → Decision → Consequences)
- [ ] Implementation journal entry appended if this PR changes workflows/ops

**Operations**
- [ ] Feature flag/kill switch included for any behavior that can post/send/engage
- [ ] Failure mode produces an operator-visible incident card (or queue item)

---

## 2) PR Checklist (copy/paste template)

> Place this checklist in PR body. Check items or mark N/A.

### 2.1 PR Summary
- [ ] **What changed:**
- [ ] **Why:**
- [ ] **How:**
- [ ] **Risk level:** Low / Med / High
- [ ] **Rollback plan:** (flag off / revert / migration rollback)

### 2.2 Tests
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Smoke test plan listed (even if manual)
- [ ] Regression test added (if bugfix)

### 2.3 Observability
- [ ] Logs: structured JSON with required IDs
- [ ] Metrics: success/failure counters + latency histogram where relevant
- [ ] Traces: trace propagation verified across web → job → tools

### 2.4 Audit & Policy
- [ ] Side-effect action(s) emit `AuditEvent`
- [ ] `AuditEvent` includes proof (URL/screenshot/ref)
- [ ] Policy checks run before action
- [ ] Kill switch verified (per-client / per-platform where applicable)

### 2.5 Security & Privacy
- [ ] Secrets are referenced (vault/KMS) not stored
- [ ] No PII leaked to logs
- [ ] OAuth/token handling follows secret hygiene

### 2.6 Docs
- [ ] Spec updated (if behavior)
- [ ] ADR added (if decision)
- [ ] Runbook updated (if operational)
- [ ] Journal entry appended (if workflow)

---

## 3) Change-Type Requirements (additional DoD by category)

### 3.1 UI/Admin Web App changes
- [ ] Screenshot/video evidence attached
- [ ] Accessibility check (keyboard nav for new controls)
- [ ] Error states implemented (loading, empty, failure)
- [ ] Operator flow validated: “can resolve the issue in <2 minutes”

### 3.2 Schema / Data model / migrations
- [ ] Migration is reversible (or a documented forward-only strategy)
- [ ] Backfill plan documented (script or job)
- [ ] Integrity constraints added (not just app-level)
- [ ] Data seeding fixtures updated

### 3.3 Orchestrator / Job runner changes
- [ ] Idempotency verified for retryable jobs
- [ ] Retry policy defined (max retries + backoff)
- [ ] Queue visibility added (job status is operator-visible)
- [ ] Cost/latency budgets respected (episode caps)

### 3.4 Policy engine / compliance changes
- [ ] New policy rules have unit tests
- [ ] Policy blocks are explainable (reason codes)
- [ ] “Manual-only” zones cannot be bypassed by tool calls

### 3.5 Platform connector changes (API lane)
- [ ] Connector has contract tests for request/response shapes
- [ ] Rate-limit + backoff behavior tested
- [ ] Token refresh failure is surfaced (incident card)
- [ ] “Verify published” step emits proof

### 3.6 Browser automation changes (Browser lane)
- [ ] Selector map updated with version tag
- [ ] Screenshot on failure verified
- [ ] DOM drift handling documented (fallback selectors / recovery)
- [ ] Canary test updated (sandbox run)

### 3.7 Tool gateway / MCP changes
- [ ] Tool inputs validated (schema)
- [ ] Tool outputs normalized (typed)
- [ ] Tool call errors classified (retryable vs fatal)
- [ ] Large tool outputs stored externally; only summaries flow to agents

### 3.8 Agent prompts / subagent spec changes
- [ ] Prompt change has a minimal test scenario
- [ ] Before/after behavioral diff described
- [ ] Rollback strategy (versioned prompt)
- [ ] Recursion + stop conditions explicitly re-validated

---

## 4) Reviewer Checklist (what reviewers must verify)

Reviewers must confirm:
- [ ] The change is minimal and coherent
- [ ] Tests are meaningful (not just coverage)
- [ ] Failure modes are handled
- [ ] Observability exists to debug real incidents
- [ ] Any side effect is auditable with proof
- [ ] Secrets are handled correctly
- [ ] Docs reflect reality (and do not overwrite history)

**Reviewer power:** reviewers can require the author to split the PR.

---

## 5) CI Requirements (merge gates)

Required CI checks (baseline):
- lint / format
- typecheck
- unit tests
- integration tests
- build
- security scans (deps + SAST if enabled)

Branch protection:
- required checks must pass
- minimum approving reviewers (e.g., 1–2)
- disallow force-push to main

---

## 6) “Stop the Line” rules (hard blocks)

The PR cannot merge if any of these are true:
- Secrets or tokens appear in code, logs, fixtures, screenshots
- Any automated posting/sending lacks a kill switch
- Any new side effect lacks an audit event
- Any new workflow lacks observable failure states
- Any bug fix lacks a regression test

---

## 7) Append-only documentation trail (required files)

Minimum doc touch points:
- `CHANGELOG.md` (curated)
- `docs/journal/YYYY-MM-DD.md` (what we did)
- `docs/adr/` (why we did it)
- `docs/runbooks/` (how to fix it)

---

## 8) Optional: PR body automation

Recommended automation (nice-to-have):
- A CI job that verifies PR checkboxes are present/checked (or N/A) before merge.

---

## 9) Next docs (build pack)

- **Testing Strategy + Golden Path Matrix — v1**
- **CI/CD Spec + Required Checks — v1**
- **Security Verification Plan — v1 (ASVS-mapped)**
- **ADR Index + Templates — v1**
- **Incident Response + Postmortem Template — v1**
- **Release Process + CHANGELOG Policy — v1**

