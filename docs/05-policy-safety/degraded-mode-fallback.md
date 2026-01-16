# Degraded Mode + Fallback Policy — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose:** Define the **deterministic operating modes** and **fallback behaviors** the system must adopt when dependencies fail or become risky—so we never:
- cause unsafe side effects
- spam/duplicate actions
- lose track of state
- silently fail

This document is the operational “guardrail brain” for the platform. It pairs with:
- **Platform Side-Effect Safety Spec — v1** (idempotency, proof, verification)
- **SLO + Error Budget Policy — v1**
- **Incident Runbooks + Postmortem Template — v1**

**Core reliability principle:** Transform hard dependencies into **soft dependencies** using **graceful degradation** and **load shedding**, while keeping the system responsive and safe. (Google SRE + AWS Well-Architected)

---

## 0) Why degraded mode exists

### 0.1 Dependency reality
This system relies on:
- social platform APIs (variable reliability + rate limits)
- browser automation lane (UI drift, captchas, auth checkpoints)
- multiple AI providers (LLM/image/video/avatar)
- queues, storage, DB, vector index

Any of these can fail. If failures propagate (retry storms, cascading timeouts), the whole system can collapse. Google SRE emphasizes careful design for graceful degradation, and warns that overly complex degradation can itself become a failure mode—so degradation must be **simple, observable, and easily disabled/tuned**.

### 0.2 “Fail closed” side-effect posture
When uncertainty rises:
- **Planning and creation can continue** (low risk)
- **Publishing and engagement must degrade early** (high risk)

---

## 1) Mode taxonomy

### 1.1 Global operating modes
These are system-wide modes.

1) **NORMAL**
- all capabilities enabled per policy

2) **SAFE_AUTONOMY**
- creation continues
- publishing is allowed only with strict verification
- engagement is restricted to low-risk replies and throttled

3) **READ_ONLY**
- no external side effects
- ingest, monitor, plan, draft, and verify only

4) **MAINTENANCE**
- operators performing upgrades/migrations
- side effects disabled

5) **EMERGENCY_STOP**
- global kill switch tripped
- side effects disabled immediately

### 1.2 Per-tenant and per-platform modes
Mode can also be scoped:
- **client mode:** affects only a tenant
- **platform-account mode:** affects a connected account
- **lane mode:** API lane vs browser lane vs hybrid

This is essential for multi-tenant safety and blast-radius control.

---

## 2) Degradation triggers (what flips modes)

Triggers are evaluated by the **Reliability Guard** on every episode start and before every side effect.

### 2.1 Hard triggers (immediate degradation)
1) **Kill switch asserted** (global/client/platform)
2) **Identity verification fails** (wrong-account risk)
3) **Captcha / checkpoint detected** in browser lane
4) **Provider auth failures** (401/403) for platform or BYOK providers
5) **Unknown side-effect state** (cannot verify publish/DM outcome)

### 2.2 Soft triggers (progressive degradation)
1) **Rate limit pressure**
- increasing 429s
- shrinking retry-after windows

2) **Dependency error rate increase**
- platform 5xx
- LLM timeouts
- storage timeouts

3) **Queue delay growth**
- backlog > thresholds

4) **Error budget burn rate**
- publishing/engagement SLOs burning too fast

### 2.3 Pattern triggers (cascading failures)
1) **Retry storms**
- repeated retries per action beyond limits

2) **Latency amplification**
- p95/p99 spikes from dependency calls

3) **UI drift signatures**
- DOM hash mismatch
- selector failure rate rising

---

## 3) Guard mechanisms (how we degrade safely)

### 3.1 Circuit breakers (dependency-level)
Every external dependency call (platform API, LLM provider, Kie/HeyGen, browser runner) is wrapped in a circuit breaker:

**Breaker states:**
- **CLOSED:** normal
- **OPEN:** fail fast (no calls)
- **HALF_OPEN:** limited probes

**Trip signals:**
- timeouts exceed threshold
- error rate exceeds threshold
- rate limits exceed threshold

**Outcome:**
- if breaker opens, system routes to fallback or read-only behavior

### 3.2 Timeouts + bounded retries
- strict timeouts per dependency
- retries only for transient errors
- exponential backoff + jitter
- max retries capped by **Cost & Latency Budgets**

### 3.3 Bulkheads (resource isolation)
- separate worker pools for:
  - planning/creation
  - publishing
  - engagement
  - browser lane

So a failing lane cannot starve the rest.

### 3.4 Load shedding + prioritization
When pressure rises:
- prioritize:
  1) verification
  2) publishing (approved + scheduled)
  3) inbound DMs (support)
  4) comment replies
  5) outbound DMs / likes / follows

Non-essential automation is shed first.

### 3.5 Feature flags (surgical disable)
Every risky capability is behind a flag:
- `publishing_api_lane`
- `publishing_browser_lane`
- `engagement_dm_auto`
- `engagement_like_auto`
- `stories_browser_lane`
- `bulk_dm_campaigns`

Flags can be flipped at global/client/platform scope.

---

## 4) Degradation matrix by workflow stage

Your pipeline:
1) **Planning**
2) **Creating**
3) **Publishing**
4) **Engaging**

We define allowed behavior per mode.

### 4.1 Planning
**NORMAL / SAFE_AUTONOMY / READ_ONLY**
- allowed
- if LLM degraded: use cheaper model, cached summaries, or “outline only” mode

**Fallback options:**
- fallback model/provider via router
- reduce context (summary-first)
- postpone planning episodes that require heavy retrieval

### 4.2 Creating
**NORMAL / SAFE_AUTONOMY / READ_ONLY**
- allowed
- if image/video providers degraded:
  - create scripts + shot lists only
  - generate static images first
  - queue video generation for later

**Fallback options:**
- clip-first silent video plan
- render “editing package” (assets + instructions) even if clips unavailable

### 4.3 Publishing (high risk)
**NORMAL**
- allowed per policy

**SAFE_AUTONOMY**
- allowed ONLY if:
  - identity verified
  - idempotency guard present
  - verification available
  - rate budget available

**READ_ONLY / MAINTENANCE / EMERGENCY_STOP**
- blocked

**Fallback options:**
- schedule only (no publish)
- generate posting checklist + human-run publish
- create platform-ready captions/hashtags/alt text + downloadable assets

### 4.4 Engagement (highest enforcement risk)
**NORMAL**
- allowed within pacing budgets

**SAFE_AUTONOMY**
- restrict to:
  - replies to inbound DMs with guardrails
  - comment replies that are non-promotional
  - NO bulk outbound
  - NO aggressive like/follow automation

**READ_ONLY / MAINTENANCE / EMERGENCY_STOP**
- blocked

**Fallback options:**
- generate suggested replies for human approval
- queue “inbox triage” tasks without sending

---

## 5) Lane-specific fallback rules

### 5.1 API lane fallback
When API lane fails (rate limits, 5xx, auth issues):

**Actions:**
1) open circuit breaker
2) backoff + reschedule
3) switch to:
   - browser lane (only if safe + verified) OR
   - read-only + human checklist

**Never do:**
- infinite retries
- parallel retries across many workers

### 5.2 Browser lane fallback
Browser lane is inherently brittle.

**Browser lane hard stops:**
- captcha detected
- checkpoint/verification prompt
- login state unknown
- identity verification fails
- UI drift beyond tolerance

**Actions:**
1) degrade browser lane to **READ_ONLY**
2) require operator intervention
3) rotate profile if necessary (per Secrets Runbook)
4) move tasks back to API lane if possible

---

## 6) Verification-first degraded behavior

**Golden rule:** if we cannot verify the outcome, we treat it as **unknown** and stop dependent operations.

### 6.1 Unknown state handling
Example: post attempt happened, but confirmation failed.

System must:
1) record AuditEvent = `unknown`
2) store proof artifacts
3) schedule verification job (read-only)
4) if verified:
   - mark `confirmed_success`
   - continue pipeline
5) if not verified after N tries:
   - escalate to operator

---

## 7) Operator surfaces required

The Check-In Dashboard must show:
- current mode (global/client/platform)
- why it changed (trigger + evidence)
- breaker states per dependency
- backlog + priority queues
- tasks blocked by mode
- “resume safely” steps

**Operators need one-click actions:**
- set mode (global/client/platform)
- flip feature flags
- force re-verify identity
- re-run verification episode
- trip kill switch

---

## 8) Suggested default thresholds (MVP)

These are initial values—tune with real data.

### 8.1 Circuit breaker
- open if: 5 consecutive failures OR error rate > 30% over 2 minutes
- half-open probe: 1 request / 30 seconds
- close after: 5 consecutive successes

### 8.2 Rate-limit policy
- if 429 rate > 5% over 5 minutes → SAFE_AUTONOMY on that platform
- if `retry-after` present → always respect

### 8.3 Browser lane
- selector failure > 3 in a row → READ_ONLY browser lane
- captcha/checkpoint → immediate READ_ONLY + operator ticket

### 8.4 Unknown state
- any unknown on publish/DM triggers:
  - immediate halt of that job chain
  - verification-only reschedule

---

## 9) Testing requirements (must be in Golden Path Matrix)

Simulate and validate:
- platform API down
- platform 429 storm
- LLM provider timeout
- browser UI drift (selectors invalid)
- captcha detection
- storage transient failure
- DB latency spike

Verify:
- correct mode transition
- side effects blocked when required
- no duplicate actions
- proper audit/proof

---

## 10) Post-MVP extensibility patterns

1) **Adaptive degradation**
- auto-tune thresholds based on SLO burn rates

2) **Per-platform annexes**
- platform-specific “safe engagement” policies

3) **Human-in-the-loop routing**
- push tasks to approval queues when risk rises

4) **Chaos drills**
- scheduled failure injection against sandbox accounts to ensure mode transitions work

---

## 11) Next doc

**Release & Rollback Playbook + CHANGELOG Policy — v1**

