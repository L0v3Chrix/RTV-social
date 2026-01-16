# ADR Index + Templates — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose:** Establish a lightweight, enforceable Architecture Decision Record (ADR) system that:
- preserves the **why** behind major choices,
- supports **fast vibecoding** without architectural drift,
- keeps an append-only, reviewable decision trail,
- makes onboarding new engineers painless.

This ADR system is designed to work with your existing build discipline:
- trunk-based dev
- small PR slices
- feature flags / kill switches
- audit-first
- multi-tenant BYOK

---

## 1) ADR rules of the road

### 1.1 What belongs in an ADR
Create an ADR when a decision materially affects any of:
- security / tenant isolation
- cost / latency budgets
- reliability / SLOs
- data model / persistence
- integration strategy (API vs browser lane)
- tool gateway / MCP strategy
- provider routing (LLM/image/video/avatar)
- platform compliance posture
- CI/CD, observability, release process

**If a decision changes how we protect client accounts or how we produce side effects, it gets an ADR.**

### 1.2 What does *not* need an ADR
- small refactors
- choice of variable names
- UI-only layout tweaks
- one-off bug fixes without architectural impact

### 1.3 “One decision per ADR” rule
An ADR must capture exactly **one** decision. If you can’t summarize it as a single sentence, split it.

### 1.4 ADRs are append-only
- You never silently rewrite history.
- If a decision changes, the original ADR is marked **Superseded** and the new ADR links to it.

---

## 2) ADR storage, numbering, and publishing

### 2.1 Folder structure

```
repo/
  docs/
    adr/
      README.md                 # how ADRs work
      adr-index.md              # generated index
      ADR-0001-record-architecture-decisions.md
      ADR-0002-....md
    decisions/
      decision-log.md           # human readable timeline
```

### 2.2 Numbering
- Format: `ADR-####-kebab-case-title.md`
- Example: `ADR-0012-browser-lane-profile-vault.md`

### 2.3 ADR index
Maintain `docs/adr/adr-index.md` which lists:
- number
- title
- status
- date
- owner
- short summary

**Index is updated in the same PR as the ADR.**

---

## 3) ADR lifecycle (statuses)

Use these statuses consistently:
- **Proposed** — drafted, under review
- **Accepted** — approved and implemented (or implementation scheduled)
- **Rejected** — considered and explicitly declined
- **Deprecated** — still in place but slated for replacement
- **Superseded** — replaced by a newer ADR

Optional additional status (only if needed):
- **Implemented** — used when you want to separate “Accepted” from “Built”

---

## 4) Decision-making workflow (fast + high-integrity)

### 4.1 Architecture advice process (decentralized)
Anyone can propose an ADR, but must seek advice from:
- those affected (runner, browser, platform connectors)
- relevant SMEs (security, ops)

### 4.2 ADR review SLA
- **Low risk:** 24 hours
- **Medium risk:** 48 hours
- **High risk / P0 risk:** synchronous review required

### 4.3 Required reviewers by ADR category
**Security/Tenant/Secrets:** Security owner + platform owner

**Browser Lane:** browser automation owner + security owner

**Data Model/Storage:** backend owner + ops owner

**Provider Routing/Tool Gateway:** orchestration owner + cost owner

**Publishing/Engagement Side Effects:** compliance owner + ops owner

### 4.4 Vibecoding integration
Agents are allowed to draft ADRs, but:
- the human architect approves **Accepted** status
- every ADR PR includes a “Verification plan” section (tests/telemetry/runbook)

---

## 5) ADR template (standard, MVP)

> Copy this template for each new ADR. Keep it concise and specific.

```md
# ADR-____: <Decision title>

Date: YYYY-MM-DD

## Status
Proposed | Accepted | Rejected | Deprecated | Superseded

## Owner
<Name/role>

## Context
- What problem are we solving?
- What constraints matter (security, cost, latency, ToS, timeline)?
- What prior ADRs or assumptions are relevant?

## Decision
A single sentence describing the decision.

## Options considered
1) Option A
2) Option B
3) Option C (if needed)

## Decision drivers
- Security/tenant isolation
- Reliability/SLOs
- Cost/latency
- Developer velocity
- Platform compliance risk

## Consequences
### Positive
- ...

### Negative / trade-offs
- ...

### Risks
- What could go wrong?
- What failure mode is most dangerous?

## Implementation notes
- Key modules touched
- Feature flags / kill switches required
- Migration considerations

## Verification plan
- Unit tests:
- Integration tests:
- E2E / Golden path:
- Observability additions:
- Runbook updates:

## Rollback plan
- How we revert safely

## Related
- Links to PRs
- Links to runbooks
- Links to prior ADRs
```

---

## 6) ADR mini-template (when you need speed)

```md
# ADR-____: <Title>
Date: YYYY-MM-DD
Status: Proposed
Owner: <name>

## Context
<3-7 bullets>

## Decision
<one sentence>

## Consequences
<3-7 bullets>

## Verification
<tests + telemetry + runbook>
```

---

## 7) ADR checklist (Definition of Done for ADR PR)

An ADR PR cannot merge unless:
- [ ] Status is **Proposed** (or **Accepted** with explicit approval)
- [ ] Title is a single decision
- [ ] Options considered are documented
- [ ] Consequences include trade-offs + risks
- [ ] Verification plan is concrete (tests + telemetry + runbook)
- [ ] Rollback plan is present for risky decisions
- [ ] `docs/adr/adr-index.md` updated
- [ ] Any superseded ADR is marked **Superseded** and cross-linked

---

## 8) ADR Index (starter set for this project)

> This is the recommended ADR backlog for MVP. Create these early so implementation can proceed without thrash.

### Foundation decisions
- **ADR-0001: Record architecture decisions**
- **ADR-0002: Multi-tenant isolation model (client_id everywhere)**
- **ADR-0003: BYOK keyring + secret-ref storage (no raw secrets in DB)**
- **ADR-0004: Artifact store policy (proof capture + retention)**

### Orchestration + tools
- **ADR-0010: Tool gateway strategy (Docker MCP as single gateway)**
- **ADR-0011: Tool allowlisting + sandboxed script executor**
- **ADR-0012: Agent recursion contracts + budget enforcement strategy**

### Lanes + platforms
- **ADR-0020: Lane policy (API vs Browser vs Hybrid) per platform/account**
- **ADR-0021: Browser lane profile vault model (encryption + manifests)**
- **ADR-0022: Publish verification strategy (API verify + browser proof fallback)**
- **ADR-0023: Engagement ingestion model (webhooks vs polling)**

### Media pipeline
- **ADR-0030: Silent-first video clip pipeline + stitching approach**
- **ADR-0031: Provider routing strategy (per-client ProviderConfig by task class)**
- **ADR-0032: HeyGen integration boundaries (where used + constraints)**

### Reliability + operations
- **ADR-0040: Queue tech + scheduling model (priorities + retries)**
- **ADR-0041: Observability baseline (OTel + audit invariants)**
- **ADR-0042: SLOs + error budget thresholds (ship vs stabilize)**
- **ADR-0043: Incident process + kill switch contract**

### Deployment
- **ADR-0050: Hosting model (Vercel for web, runner hosting choice)**
- **ADR-0051: CI/CD gates + protected branches**

---

## 9) Example ADR (filled) — Tool Gateway via Docker MCP

```md
# ADR-0010: Tool gateway strategy (Docker MCP as single gateway)

Date: 2026-01-15

## Status
Proposed

## Owner
Platform Orchestration Lead

## Context
- We use many MCP tool servers; direct connection inflates agent context and increases risk.
- We need tool discovery + minimal tool activation per task.
- We need scripted tool workflows where large outputs stay out of the LLM context.

## Decision
Use Docker MCP as the single tool gateway for all MCP tool servers, with an allowlisted registry per task class.

## Options considered
1) Directly connect multiple MCP servers to the agent
2) Use Docker MCP gateway (single endpoint)
3) Use n8n/Make/Zapier as orchestration layer

## Decision drivers
- Reduce context consumption
- Improve tool calling reliability
- Centralize permissions + audit
- Support programmable tool workflows

## Consequences
### Positive
- Smaller context footprint
- Better control over tool access
- Enables scripted workflows without flooding prompts

### Negative / trade-offs
- Adds a gateway dependency
- Requires robust health checks and fallback mode

### Risks
- Gateway outage blocks tool access

## Implementation notes
- Runner calls Docker MCP client
- Tool discovery -> select minimal tool set
- Tool call digests written to artifacts

## Verification plan
- Tool health suite in CI
- Gateway outage simulation
- AuditEvent emission for tool calls

## Rollback plan
- Fail closed: disable side effects
- Degraded mode: planning-only + manual ops

## Related
- RB-08 Tool Gateway Failure runbook
```

---

## 10) Post-MVP extensibility patterns

### 10.1 “Decision records beyond architecture”
Use the ADR pattern for:
- **Design decision records** (creative system)
- **Compliance decision records** (platform policy changes)
- **Experiment decision records** (when V2 metrics arrives)

### 10.2 ADR automation (future)
- CLI command to create new ADR + increment index
- Bot checks: ensure ADR references for major architectural PRs
- Dashboard view of current Accepted decisions

---

## 11) Next doc

**Secrets & Key Management Runbook — v1**

