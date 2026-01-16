# Testing Strategy + Golden Path Matrix — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose:** Define a testing system that catches bugs early, keeps automation safe, and ensures “Plan → Create → Publish → Engage” remains stable as agents/tools evolve.

This doc is written to be directly executable as a repo standard (CI gates + test suites + fixtures + environments).

---

## 0) Guiding model

We follow a **test pyramid** philosophy (many fast unit tests, fewer integration tests, very few E2E tests) and enforce a small set of **Golden Paths** with E2E smoke coverage.

- Higher-level tests are fewer and reserved for the most critical user journeys.
- Contract testing is required at system boundaries (tools, external APIs, browser actions).

---

## 1) What we are testing (system risks)

### 1.1 MVP risk categories
1) **Unsafe side effects**
- Posting/sending when policy says manual-only
- Posting with wrong account/client
- Duplicate sends due to retries

2) **Silent failures / stuck workflows**
- Queue items that never complete
- Tool errors not surfaced to operator

3) **Cross-tenant leakage**
- Client A credentials used for Client B
- Asset generated under wrong BrandKit

4) **Browser automation brittleness**
- selector drift
- auth/session expiry
- anti-bot detection signals

5) **Provider routing & budgets**
- wrong model/provider chosen
- exceeding cost/latency budgets

---

## 2) Test portfolio (what types of tests we maintain)

### 2.1 Unit tests (fast, deterministic)
**Goal:** Validate logic without external I/O.

Unit test targets:
- Policy Engine (deny/allow + reason codes)
- Provider Router (task_class → provider/model)
- Budget Guards (token/cost/latency limits)
- Schema validators (BrandKit/KB/Blueprint/Plan/Asset)
- Plan compiler (Plan → JobGraph)
- Prompt templates (inputs → deterministic prompt outputs)
- AuditEvent constructor (required fields always present)

**Rule:** Any change in these areas requires unit tests.

### 2.2 Integration tests (service boundary)
**Goal:** Validate two or more components working together.

Integration test targets:
- Runner ↔ DB ↔ Queue
- Runner ↔ Tool Gateway (Docker MCP client)
- API Lane connectors (using mocked HTTP + contract assertions)
- Browser Lane runner with a sandbox target (internal test site)
- Storage flows (assets to object store) + metadata in DB
- Observability emission (logs/metrics/traces) on success/failure

### 2.3 Contract tests (interfaces don’t break)
**Goal:** Prevent late surprises when a provider changes formats.

Contract test targets:
- Tool calls (MCP tool input/output schema)
- External APIs (request/response shape, error formats)
- Webhook payloads (if any)
- AuditEvent JSON schema

**Pattern:** Consumer-driven contracts are recommended when our code is the consumer of a service.

### 2.4 End-to-end tests (few, critical)
**Goal:** Ensure the system works like an operator experiences it.

E2E tests are restricted to Golden Paths only:
- “Plan → Create → Schedule → Publish → Verify (stub/sandbox)”
- “Engage: ingest → draft → policy check → send → audit proof”

**Rule:** E2E tests must be resilient (stable locators; no fixed sleeps).

### 2.5 Canary runs (continuous drift detection)
**Goal:** Detect platform UI drift and credential/session problems early.

- Browser Lane: daily canary against sandbox/test accounts.
- Alerts on:
  - selector failures
  - login failures
  - posting workflow changes

---

## 3) Tooling standard (recommended stack)

### 3.1 Web app (Next.js)
- **Unit tests:** Jest or Vitest (choose one), plus React Testing Library for client components.
- **E2E tests:** Playwright (recommended for cross-browser + stable locators).

**Note:** For async Server Components, prefer E2E or integration-style tests.

### 3.2 Backend/job runner
- Unit tests for pure logic modules.
- Integration tests for queue/db/tool gateway.

### 3.3 Contract testing
- Schema-based contract tests (JSON Schema / Zod)
- Snapshot contracts for stable payload formats where appropriate.

---

## 4) Environments (where tests run)

### 4.1 Local dev
- Runs unit + integration suites.
- Uses local DB + local queue.
- Uses tool gateway stubs unless explicitly enabled.

### 4.2 CI
- Runs unit + integration + E2E smoke (headless)
- Uses ephemeral DB and queue.
- Uses mocked external APIs.

### 4.3 Staging
- Runs:
  - full Golden Path E2E against sandbox accounts
  - canary runs
  - browser lane drift tests

### 4.4 Production
- Runs:
  - canary (read-only where possible)
  - “dry-run publish” validations
  - health checks

---

## 5) Test data strategy (fixtures + tenant isolation)

### 5.1 Fixtures
Maintain deterministic fixtures for:
- Client
- BrandKit
- KnowledgeBase
- PlatformAccounts
- Policies
- Blueprint configs
- Provider routing config

### 5.2 Tenant isolation tests (required)
For any feature that touches BYOK, platform accounts, or browser profiles:
- test that a ClientId cannot access another client’s credentials
- test that audit events always contain the correct ClientId

---

## 6) Required observability assertions in tests

Tests must assert:
- Every job execution includes `trace_id`
- Failures emit:
  - structured error code
  - incident card creation (or queue status)
  - AuditEvent if side effect attempted

---

## 7) Golden Path Matrix

**Legend:**
- Unit = U
- Integration = I
- Contract = C
- E2E = E
- Canary = K

> MVP rule: every Golden Path row must have at least **U + I + (C if boundary) + E (smoke)**.

| Golden Path | Description | Lanes | Required Tests | Proof / Assertions | CI Gate? |
|---|---|---|---|---|---|
| GP-01: Client Onboarding | Create Client + BrandKit + KB + Policies + Platform placeholders | API | U, I | schemas validate; BYOK refs stored; audit of onboarding change | Yes |
| GP-02: Plan Build | Generate a Plan from BrandKit/KB/Blueprints | API | U, I | plan graph valid; budget precheck pass; trace_id present | Yes |
| GP-03: Asset Create (Text) | Create copy assets from a plan node | API | U, I, C | deterministic prompt template; output schema valid; cost budget tracked | Yes |
| GP-04: Asset Create (Image) | Generate an image asset from a blueprint | API | U, I, C | provider routing correct; file stored; metadata links correct | Yes |
| GP-05: Asset Create (Video Clips) | VSL pipeline: script→segments→prompts→clips (silent) | API | U, I, C | progress.json equivalent; resume works; failed segment classified | Yes |
| GP-06: Calendar Schedule | Place approved assets onto publish calendar | API | U, I | schedule is idempotent; re-run doesn’t duplicate | Yes |
| GP-07: Publish (API Lane) | Post to platform via API connector | API | U, I, C, E | policy check first; audit event + proof URL; verify visible (stub/sandbox) | Yes |
| GP-08: Publish (Browser Lane) | Post via browser runner (stories when needed) | Browser | U, I, E, K | screenshot proof; selector map used; failure yields incident card | Staging |
| GP-09: Engagement Ingest | Pull comments/DM events into inbox | API/Browser | U, I, C | pagination safe; dedupe events; correlation ids | Yes |
| GP-10: Engagement Reply (Safe) | Draft reply → policy gate → send | API/Browser | U, I, E | block manual-only zones; audit proof; escalation conditions trigger | Yes |
| GP-11: Escalation | Route to human review/approval | API | U, I | SLA timers; operator notification; no auto-send after escalation | Yes |
| GP-12: Kill Switch | Disable per client/platform/global | API | U, I, E | all side effects blocked immediately; UI reflects status | Yes |
| GP-13: Retry + Idempotency | Retry publish/engage without duplication | API/Browser | U, I | idempotency keys; audit shows single external action | Yes |
| GP-14: Drift Detection | Browser lane detects UI change | Browser | K | selector failures trigger runbook link + incident | Prod/Staging |

---

## 8) Browser lane testing (hardening playbook)

### 8.1 Selector strategy
- Centralize selectors in a `SelectorMap` with version tags.
- Use stable locators (role/text/testid) whenever possible.
- Never anchor tests to layout-only CSS selectors.

### 8.2 Failure capture
On any browser-run failure, automatically capture:
- screenshot
- DOM snapshot
- console logs
- network HAR (optional)
- trace_id correlation

### 8.3 Anti-brittle rules
- No `sleep(5000)` style waits.
- Use auto-wait conditions.
- Use “expect element visible/enabled” gating.

---

## 9) Contract testing standards

### 9.1 Tool contracts (MCP)
For each tool call:
- validate inputs with schema
- validate outputs with schema
- classify errors: retryable vs fatal

### 9.2 External API contracts
- Create a “golden response” snapshot for each endpoint shape.
- Verify required fields exist, but don’t pin volatile values.

---

## 10) Performance + load testing (MVP-lite, V2 full)

**MVP-lite:**
- Queue throughput test (N jobs across M tenants)
- Browser runner concurrency test (limited)
- Large plan graph test (stress recursion and budgets)

**V2:**
- Sustained load tests per tenant tier
- Spike tests on publish windows

---

## 11) CI Gates (minimum required)

PR cannot merge unless:
- unit tests pass
- integration tests pass
- contract tests pass
- E2E smoke (Golden Paths subset) passes

Browser lane E2E can be:
- required in staging pipeline
- optional/allowed-to-fail in PR CI (until stabilized)

---

## 12) Implementation checklist (to operationalize this doc)

1) Create `/tests/fixtures/` with seeded client/brand/policy configs
2) Create `TestHarness` helpers:
   - `withTestClient()`
   - `seedPlan()`
   - `runEpisode()`
   - `assertAudit()`
3) Implement `GoldenPathRunner` scripts:
   - `gp01_onboarding`
   - `gp07_publish_api`
   - `gp08_publish_browser`
   - `gp10_engagement_reply`
4) Add CI jobs:
   - `unit`
   - `integration`
   - `contract`
   - `e2e_smoke`
5) Add daily canary schedules (staging + prod read-only where possible)

---

## 13) Next doc

**CI/CD Spec + Required Checks — v1**

