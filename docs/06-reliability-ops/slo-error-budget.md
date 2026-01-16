# SLO + Error Budget Policy — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose:** Define measurable reliability targets for the platform and a binding policy for how shipping decisions change as reliability degrades.

This document is the reliability “constitution” for MVP and post‑MVP.

---

## 0) Terms (short + practical)

- **SLI (Service Level Indicator):** the metric we measure (e.g., publish success rate).
- **SLO (Service Level Objective):** target for the SLI over a window (e.g., 99.5% over 28 days).
- **Error budget:** allowable unreliability. `error_budget = 1 - SLO`.
- **Burn rate:** speed at which we’re consuming error budget compared to “steady burn.”

---

## 1) Reliability philosophy for THIS product

This platform is a **side‑effects engine** (publishing, DMs, replies, likes). Reliability must optimize for:

1) **Safety** (no wrong account, no unauthorized action)
2) **Correctness** (right asset, right platform, right schedule)
3) **Timeliness** (jobs run on time, engagement replies within SLA)
4) **Operator trust** (no silent failures; clear incidents + recovery)

**Design premise:** We are allowed to pause features to restore reliability when data demands it.

---

## 2) Scope of SLOs (what SLOs apply to)

SLOs apply to:

- **API lane** actions (platform APIs, provider APIs)
- **Browser lane** actions (automated UI posting/engagement)
- **Runner** + **queue** + **tool gateway** (Docker MCP / tool execution)
- **Admin web app** reliability for operators

SLOs do **not** apply to:

- third‑party platform outages outside our control (counted separately as dependency incidents)
- manual operator time (tracked as toil but not an SLO)

---

## 3) The MVP SLO set (the minimum we enforce)

### SLO-01: Publish Success (API lane)
**User impact:** posts fail to publish.

- **SLI:** `published_success / publish_attempts` (idempotent attempts only)
- **Success definition:** external platform returns success AND verification passes OR verification is not possible but platform returns stable post ID.
- **Window:** rolling 28 days
- **Target:** **99.5%**
- **Error budget:** 0.5%

### SLO-02: Publish Success (Browser lane)
**User impact:** stories/posts fail, UI drift breaks automation.

- **SLI:** `browser_publish_success / browser_publish_attempts`
- **Success definition:** browser completes workflow AND proof captured (screenshot + post ID/URL if available)
- **Window:** rolling 28 days
- **Target:** **98.5%** (browser lane is inherently less stable; improve over time)

### SLO-03: Time-to-Visible Verification
**User impact:** post might be “ghosted” or not actually live.

- **SLI:** `% of published posts verified visible within X minutes`
- **X (MVP):** 10 minutes
- **Window:** rolling 28 days
- **Target:** **99%**

### SLO-04: Queue Freshness (job start latency)
**User impact:** publishing/engagement is late.

- **SLI:** `% of jobs that start within target delay`
- **Target delay:**
  - publishing jobs: start within 2 minutes of scheduled time
  - engagement ingest: start within 5 minutes of poll schedule
- **Window:** rolling 28 days
- **Target:** **99%**

### SLO-05: Runner Episode Completion
**User impact:** workflows stall mid‑episode.

- **SLI:** `episodes_complete_without_human_intervention / episodes_started`
- **Window:** rolling 28 days
- **Target:** **99%** for *non-side-effect* episodes; **98.5%** for episodes containing side effects

### SLO-06: Engagement Response SLA (operator + automation)
**User impact:** slow replies reduce conversion and trust.

Because this is agency‑operated, we measure two SLIs:

**A) Ingest freshness:**
- **SLI:** `% of inbound events visible in inbox within 5 minutes`
- **Target:** **99%**

**B) Reply timeliness (when configured for auto):**
- **SLI:** `% of auto-replies sent within 10 minutes of event creation`
- **Target:** **95%** (MVP; tighten later)

### SLO-07: Safety SLO (Cross‑Tenant / Wrong‑Account)
**User impact:** catastrophic.

- **SLI:** `0 wrong-account actions` (hard SLO)
- **Target:** **100%**
- **Policy:** any violation = immediate incident + freeze (see §7)

### SLO-08: Audit Completeness
**User impact:** can’t trust what happened; can’t debug.

- **SLI:** `% of side effects with an AuditEvent + proof artifact`
- **Target:** **99.9%** (missing audits are treated like failures)

---

## 4) SLIs: exact measurement rules (so we don’t game metrics)

### 4.1 Attempt counting and idempotency
- Every side effect must include an **idempotency key**.
- Retries with the same idempotency key are **not new attempts**.

### 4.2 Failure classification
Each attempt is classified as:
- **platform_rejected** (auth, content rules, rate limits)
- **tool_failure** (MCP/tool gateway error)
- **runner_failure** (timeout, crash)
- **verification_failed** (no visibility)
- **policy_blocked** (not a failure; expected)

Only **true failures** consume error budget.

### 4.3 Dependency outages
If platform/API provider is down:
- record as **dependency incident**
- optionally exclude from error budget if explicitly agreed (see §6.4)

---

## 5) Error budget math (quick reference)

### 5.1 Availability/success SLOs
If SLO = 99.5% over 28 days:
- Error budget = 0.5%
- If there are 10,000 attempts/month → budget = 50 failed attempts

### 5.2 Latency/freshness SLOs
If target is “99% within 2 minutes”:
- Budget is 1% of jobs allowed to start late

---

## 6) Burn rate alerting (how we detect problems early)

We use multi‑window burn alerts to catch both:
- **fast burns** (major incidents)
- **slow burns** (degradation)

### 6.1 Standard burn alerts (recommended)
For each SLO with a 28‑day window:

**Page (fast burn):**
- short window: 5–15 minutes
- long window: 1 hour
- burn rate threshold: high (e.g., 10–14x)

**Ticket (slow burn):**
- short window: 1–6 hours
- long window: 1–3 days
- burn rate threshold: moderate (e.g., 2–4x)

### 6.2 Which SLOs page vs ticket
**Paging SLOs:**
- Wrong account action (immediate)
- Publish success (API lane)
- Publish success (Browser lane) when it blocks scheduled deliveries
- Queue freshness

**Ticket SLOs:**
- Verification time-to-visible
- Engagement timeliness
- Runner completion

---

## 7) Error budget enforcement policy (what changes when we burn budget)

This is the binding policy that governs shipping.

### 7.1 Status bands (evaluated weekly + continuously)

**GREEN (Healthy):**
- Remaining error budget ≥ 50%
- Actions:
  - normal feature shipping
  - normal release cadence

**YELLOW (Degrading):**
- Remaining error budget 20–50% OR burn alerts (slow) firing repeatedly
- Actions:
  - feature shipping continues **only** if behind flags
  - increased canary + staging requirements
  - reliability work gets priority in sprint planning

**RED (Frozen):**
- Remaining error budget < 20% OR any paging burn alert sustained
- Actions:
  - **release freeze** on new side-effect capabilities
  - only P0/P1 bug fixes + security fixes
  - root-cause work prioritized until GREEN/YELLOW

### 7.2 Hard stop rules (instant freeze)
Immediate **RED** status and release freeze if:
- any wrong-account / cross-tenant action occurs
- any un-audited side effect occurs at scale (audit completeness drops below 99.9%)
- any uncontrolled “spam loop” is detected (repeat DMs/replies)

### 7.3 Post‑incident requirements
If a single incident consumes ≥ 20% of any SLO’s monthly budget:
- mandatory postmortem
- at least one “must-do” remediation item

---

## 8) Shipping rules tied to error budget

### 8.1 Feature flag discipline
- All new side effects ship behind flags.
- In YELLOW/RED:
  - no enabling new flags in production without explicit approval

### 8.2 Canary requirement
- In YELLOW:
  - staged canary (limited clients/platforms)
- In RED:
  - only reliability changes, canary first

### 8.3 Change types allowed during freeze
Allowed in RED:
- bug fixes that reduce error budget burn
- performance improvements that reduce queue latency
- policy and safety improvements
- security patches

Not allowed in RED:
- new engagement behaviors
- new publishing surfaces
- new provider integrations

---

## 9) Ownership and review

### 9.1 Owners
- **Reliability Owner (weekly rotating)**: reviews burn reports, approves freeze/unfreeze.
- **Engineering Lead**: ensures roadmap respects budget.
- **On-call**: responds to paging burn alerts.

### 9.2 Review cadence
- Daily: burn alerts + canary status
- Weekly: SLO review meeting
- Monthly: adjust SLO targets if needed (only if justified)

---

## 10) SLO Reporting (what gets shown in the dashboard)

Each SLO must show:
- current SLI value
- SLO target
- budget remaining (absolute + %)
- burn rate
- top failure reasons
- top impacted clients/platforms

---

## 11) Post‑MVP extensibility patterns (built-in)

This policy is designed to extend cleanly by:

1) Adding new SLOs per capability:
- e.g., “Skool DM reply timeliness” or “IG story publish success”

2) Adding per‑client reliability tiers:
- default tier vs premium tier

3) Adding workload classes:
- organic posting vs paid ads vs community ops

4) Adding error budget partitioning:
- separate budgets for publishing vs engagement vs browser lane

---

## 12) Implementation checklist (to make this real)

1) Create `slo_definitions.yml` (source of truth)
2) Instrument SLIs with consistent tags:
   - client_id
   - platform
   - lane (api|browser)
   - action_type (publish|dm|comment|like)
3) Build budget calculator job (daily)
4) Implement burn rate alerts (page/ticket) per SLO
5) Add “Reliability Status” banner in admin UI: GREEN/YELLOW/RED
6) Wire freeze policy to feature-flag admin controls

---

## 13) Next doc

**Incident Response Runbooks + Postmortem Template — v1**

