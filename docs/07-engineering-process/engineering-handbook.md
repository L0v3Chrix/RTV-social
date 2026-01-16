# Engineering Handbook — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose of this handbook:** Create a build culture and execution system that makes this platform:

- **fast to ship** (small batches)
- **safe to operate** (no silent failures)
- **easy to debug** (observability-first)
- **easy to evolve** (append-only documentation + ADR discipline)

This handbook is written so a new senior engineer can join midstream and still build correctly.

---

## 0) Non‑Negotiables (the rules we do not break)

1. **No Silent Failures**

- Every failure must produce: (a) an error code, (b) an operator-visible incident card, (c) an audit record if a side-effect was attempted.

2. **Every Change Ships with Proof**

- If code changes behavior, it must include:
  - tests
  - telemetry
  - docs updates (append-only)

3. **Side Effects are Audited**

- Any publish, DM send, comment reply, like, follow, schedule, token refresh, browser action → emits `AuditEvent` with proof.

4. **Small Batches Only**

- Prefer changes that can be reviewed in 10–20 minutes.

5. **Policy Guardrails Execute Before Action**

- If a policy says “manual-only” for a platform/surface, automation is blocked before any tool call.

6. **BYOK Safety**

- Never store raw keys in DB or logs. Only secret references.

---

## 1) Delivery System (how we ship reliably)

### 1.1 Branching + integration strategy

- **Trunk-based development** with short-lived branches.
- Merge small, frequently.
- Feature flags for risky behaviors (publishing/engagement actions).

**Required:**

- No long-lived branches.
- No “mega PRs.”

### 1.2 Pull Requests (PR discipline)

Every PR must include:

- Scope summary (what changed)
- Why (problem statement)
- Evidence (tests + screenshots/video if UI)
- Risk level (Low/Med/High)
- Rollback plan
- Docs updated

**PR size guidance:**

- Ideal: 100–300 lines changed
- Max recommended: 600 lines (split if larger)

### 1.3 Commit message convention

- Use a structured convention (e.g., `feat:`, `fix:`, `chore:`, `docs:`)
- Include ticket/reference IDs when available

### 1.4 Release discipline

- Semantic versioning
- Curated `CHANGELOG.md`
- Release notes include:
  - user-visible changes
  - operational changes
  - migrations
  - known issues

---

## 2) Testing Strategy (bug catching every step)

### 2.1 Test pyramid (MVP baseline)

We maintain a balanced test portfolio:

1. **Unit tests** (fast, deterministic)

- Pure logic: policy engine, router, schema validation, prompt templating, budget checks.

2. **Integration tests** (service-level)

- Runner + queue + tool gateway integration
- API lane connector tests (mocked platform endpoints)
- DB migrations + schema constraints

3. **Contract tests**

- Tool contracts: MCP tool inputs/outputs
- Provider routing: provider selection by task class
- Audit event emission contracts

4. **E2E smoke tests** (few, critical)

- Golden path: Plan → Create → Schedule → Publish (dry-run) → Verify (stub)
- Browser runner golden path using a test target (internal sandbox site)

### 2.2 “No regression” rule

- Any bug fixed must ship with a test that fails pre-fix and passes post-fix.

### 2.3 Browser automation testing

Browser lane is brittle by nature. We reduce brittleness by:

- Selector abstraction layer (selectors live in one place)
- Screenshot-on-failure always
- DOM snapshot hashing for drift detection
- Canary run daily against sandbox accounts

### 2.4 Test data strategy

- Use seed fixtures for:
  - clients
  - brand kit
  - KB
  - blueprint configs
  - policies
  - platform accounts

### 2.5 Build‑time gates

A PR cannot merge unless:

- lint + typecheck pass
- unit tests pass
- integration tests pass
- migration checks pass
- security checks pass

---

## 3) Vibecoding Operating Model (agents + CLI + MCP)

### 3.1 Roles in vibecoding

- **Human Architect (you):** sets constraints, approves risky decisions
- **Orchestrator Agent:** breaks work into atomic PRs
- **Implementer Agents:** write code in small slices
- **Verifier Agent:** runs tests, checks logs, validates contracts
- **Doc Agent:** appends documentation trail

### 3.2 “Agent PR Slices” rule

Agents should ship changes as:

- one module
- one behavior
- one test bundle
- one doc append

If an agent produces a large diff, it must split.

### 3.3 Tool usage rule (Docker MCP gateway style)

- Agents do **tool discovery**, then call only the minimal tools.
- Any large data retrieval must write to external artifacts (files/DB) and only summarize back.

### 3.4 Prompt + agent spec versioning

- Treat agent prompts like code.
- Store in `/agents/` with version tags.
- Any prompt change requires:
  - small test scenario
  - before/after diff
  - rollback plan

---

## 4) Documentation System (append-only + traceable)

### 4.1 Documentation philosophy

- **Docs are code.** They live in the repo.
- We do not overwrite decisions silently.
- We append with:
  - `CHANGELOG.md`
  - `docs/adr/`
  - `docs/decisions/decision-log.md`
  - `docs/runbooks/`

### 4.2 Required doc artifacts

**A) Specs (what we intend to build)**

- `/docs/specs/` (system architecture, schemas, policies)

**B) ADRs (why we chose it)**

- `/docs/adr/ADR-####-title.md`

**C) Implementation journal (what we actually did)**

- `/docs/journal/YYYY-MM-DD.md`
- Each entry includes:
  - PR links
  - migrations
  - new metrics
  - new audits
  - breaking changes

**D) Runbooks (how to operate it)**

- `/docs/runbooks/` per alert type

### 4.3 Citation rule (the “path we took”)

When changing architecture, include:

- ADR reference
- link to relevant PR
- acceptance criteria
- risk note

---

## 5) Reliability: SLOs, error budgets, and incident discipline

### 5.1 SLO ownership

Define SLOs for:

- publish success
- verification time-to-visible
- queue delay
- runner availability

### 5.2 Error budget policy

- If error budget burn exceeds thresholds, feature shipping pauses until stability is restored.

### 5.3 Incidents + postmortems

- Incidents are blameless.
- Every P0/P1 incident requires:
  - timeline
  - contributing factors
  - corrective actions
  - follow-ups with owners + dates

---

## 6) Security & secrets handling (BYOK + operator safety)

### 6.1 Secrets

- All secrets stored in vault/KMS.
- App stores only secret references.
- Secrets never printed in logs.

### 6.2 Permissions

- Operators have RBAC.
- “Publish/Engage” actions require explicit policy permission.

### 6.3 Browser profile vault

- Profiles encrypted at rest.
- Access logged.
- Rotation and invalidation procedures documented.

---

## 7) Codebase structure (recommended)

```
repo/
  apps/
    web/                 # Next.js admin UI
    runner/              # job runner + agent episode execution
  packages/
    core/                # schemas, policy engine, router, budgets
    tools/               # tool registry + docker mcp client
    browser/             # runner client + selector maps
    platform-connectors/ # API lane connectors
  agents/                # agent prompts/specs/versioning
  docs/
    specs/
    adr/
    runbooks/
    journal/
  scripts/
    dev/                 # local ops scripts
    ci/                  # CI helpers
```

---

## 8) Implementation workflow (how we build without chaos)

### 8.1 The atomic build loop

1. Pick a single capability slice (e.g., “Schedule post to calendar”)
2. Add schema + validation
3. Add unit tests
4. Add integration test harness
5. Implement behavior
6. Add telemetry + audit
7. Update docs (ADR/journal)
8. Ship behind a feature flag
9. Run smoke tests

### 8.2 The “Kill Switch” requirement

Anything that posts/sends must support:

- per-client kill switch
- per-platform kill switch
- global kill switch

---

## 9) Bug lifecycle (patch immediately, document forever)

### 9.1 Bug report template

- What happened
- Expected behavior
- Repro steps
- Client/platform/lane
- Logs + trace\_id
- Screenshots (browser lane)
- Severity

### 9.2 Severity definitions

- **P0:** platform-wide side effects broken or unsafe behavior
- **P1:** client blocked from publishing/engagement
- **P2:** partial degradation or repeated manual intervention
- **P3:** cosmetic or low impact

### 9.3 Patch policy

- P0/P1: patch first, then features
- Bug fix must include:
  - regression test
  - runbook update (if operational)
  - changelog entry

---

## 10) Acceptance: what “ready to begin construction” means

Before major feature work begins:

- Repo scaffold exists
- CI gates exist
- Test framework exists
- Observability baseline exists (OTEL + audit events)
- PR templates + DoD exist
- ADR template exists
- Feature flags exist for side effects

---

## 11) Next documents to generate (build pack)

If you want, next we generate (each as separate docs):

1. **Definition of Done + PR Checklist — v1**
2. **Testing Strategy + Golden Path Matrix — v1**
3. **CI/CD Spec + Required Checks — v1**
4. **Security Verification Plan — v1 (ASVS-mapped)**
5. **ADR Index + Templates — v1**
6. **Incident Response + Postmortem Template — v1**
7. **Release Process + CHANGELOG Policy — v1**

