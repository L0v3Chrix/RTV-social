# Incident Runbooks + Postmortem Template — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose:** Provide an operator-ready playbook for detecting, triaging, mitigating, and learning from incidents across **Planning → Creation → Publishing → Engagement**, including API lane + browser lane + runner + tool gateway.

**Design goals:**
- Minimize blast radius fast (kill switches + policy gates)
- Restore service quickly (golden recovery steps)
- Preserve evidence (audit + telemetry + artifacts)
- Learn without blame (system + process improvements)

---

## 0) Incident taxonomy (severity + types)

### 0.1 Severity levels
**P0 — Safety / Wrong Account / Data Exposure**
- Wrong-account action, cross-tenant access, credential leak, uncontrolled spam loop, un-audited side effects at scale
- **Immediate freeze** (global or per-client) until resolved

**P1 — Major Production Outage**
- Publishing or engagement automation broadly failing, queue stalled, runner down, massive verification failures

**P2 — Partial Degradation**
- Single platform down (API), browser lane drift for one platform, elevated error rates, delayed scheduling

**P3 — Minor / Cosmetic**
- UI glitches, non-blocking failures, single client edge-case

### 0.2 Incident types (tag every incident)
- SAFETY: wrong-account / cross-tenant / unauthorized action
- PUBLISH: failed publish / verify / schedule
- ENGAGE: DM/comment reply/like behavior issues
- AUTH: token refresh / OAuth issues
- RATE: rate limiting / spam detection / restrictions
- BROWSER: selector drift / UI change / captcha
- QUEUE: backlog / stuck jobs / latency breach
- TOOLGATE: Docker MCP / tool routing failures
- PROVIDER: LLM/image/video provider outage
- COST: runaway token usage / runaway generation
- DATA: ingestion issues / KB corruption / retrieval wrong sources
- OBS: missing telemetry/audit

---

## 1) Roles (major incident structure)

### 1.1 Core roles (assign immediately on P0/P1)
- **IC (Incident Commander):** runs the incident, makes calls, keeps momentum
- **Ops Lead:** executes mitigations, toggles flags/kill switches
- **Comms Lead:** internal stakeholder updates + client impact messaging (agency side)
- **Scribe:** timeline + decisions + evidence links
- **SMEs:** publishing SME, browser SME, provider SME, DB SME

### 1.2 Default meeting structure
- War-room channel + call
- IC sets cadence: updates every 10–15 min (P0/P1), 30–60 min (P2)

---

## 2) Golden incident workflow (every incident)

### 2.1 Detect → Triage (first 5 minutes)
1) Confirm incident is real (dashboard + logs)
2) Identify scope:
   - which clients
   - which platforms
   - which lane (API vs browser)
   - which action types (publish/engage)
3) Identify last good known state
4) Assign roles (IC, Scribe, Ops)

### 2.2 Mitigate (first 15 minutes)
**Priority order:**
1) Stop unsafe side effects
2) Reduce blast radius
3) Restore core function

Mitigation toolbox:
- Global kill switch (all side effects)
- Per-client kill switch
- Per-platform kill switch
- Lane routing switch (API↔browser↔hybrid)
- Disable risky blueprints / engagement triggers
- Pause queue consumers
- Reduce concurrency / rate
- Fail closed: require approval for all side effects

### 2.3 Recover (first 60 minutes)
- Re-enable minimal safe operations
- Run golden path canary (one client, sandbox accounts)
- Gradually ramp traffic / schedules

### 2.4 Close + Learn
- Capture summary
- Create postmortem ticket (P0/P1 mandatory)
- Create action items with owners + due dates

---

## 3) Required evidence bundle (for every incident)

Scribe must capture:
- Incident ID + tags + severity
- Start time, detection source, who paged
- Impact statement (clients/platforms/actions)
- Dashboard screenshots
- Trace IDs + log query links
- AuditEvent sample set (10–20 examples)
- Browser artifacts (screenshots/video/DOM snapshots) if applicable
- Recent deploys + feature flags changes
- Provider status pages if provider incident

---

## 4) Runbooks (MVP set)

> Each runbook follows: **Symptoms → Scope → Immediate actions → Diagnosis → Fix/Workaround → Verification → Follow-ups**

### RB-01 — Wrong-Account / Cross-Tenant Action (P0)
**Symptoms**
- AuditEvent shows action executed under wrong `client_id` or wrong platform account
- A post/DM/comment appears on wrong account

**Immediate actions (0–2 min)**
1) **Global kill switch ON** (side effects)
2) Disable all browser runners (if browser lane involved)
3) Snapshot evidence: affected AuditEvents + proof artifacts
4) IC assigns security SME

**Diagnosis**
- Verify tenancy boundaries:
  - request-scoped `client_id`
  - tool gateway scoping
  - browser profile selection logic
  - credentialRef resolution
- Check recent changes to:
  - routing
  - keyring resolution
  - profile vault

**Fix/Workaround**
- Force manual-only mode for all clients
- Patch tenancy guard (hard assert) and add regression test
- Rotate any impacted credentials

**Verification**
- Run sandbox canary for 1 client
- Confirm every AuditEvent has correct account identity

**Follow-ups**
- Mandatory postmortem
- Add/upgrade invariant checks and CI gates

---

### RB-02 — Publish Failures (API lane)
**Symptoms**
- `publish_attempts` rising, `publish_success` falling
- Platform returns errors (4xx/5xx), missing post IDs

**Immediate actions**
1) Switch affected platform to **manual schedule only** if error rate > threshold
2) Reduce concurrency + backoff
3) If widespread: disable publish side effects for that platform

**Diagnosis**
- Inspect error classes:
  - auth/token expired
  - rate limit
  - invalid media specs
  - platform outage
- Compare to last known good deploy

**Fix/Workaround**
- Token refresh repair
- Implement retry policy (idempotent)
- Media validation fix (size/aspect/format)

**Verification**
- Publish one test post to sandbox account
- Verify post visible

**Follow-ups**
- Add contract test for platform error mapping

---

### RB-03 — Verification Failures (“post may not be live”)
**Symptoms**
- Platform returned success but visibility verification fails
- Spike in `verification_failed`

**Immediate actions**
1) Stop auto-publish for affected surface if verification > threshold
2) Mark affected jobs as “needs human confirm”

**Diagnosis**
- Verification method broken (API lookup changed, selectors drift)
- Permissions scope insufficient

**Fix/Workaround**
- Patch verification adapter (API or browser)
- Add fallback proof capture in browser lane

**Verification**
- Verify 3 consecutive posts

---

### RB-04 — OAuth / Token Refresh Failure (AUTH)
**Symptoms**
- 401/403 errors, refresh endpoint failures
- Jobs fail after token expiry

**Immediate actions**
1) Pause affected jobs
2) Switch to manual-only for that platform/client

**Diagnosis**
- Refresh token revoked
- Scope changed
- Clock skew

**Fix/Workaround**
- Re-auth flow (operator)
- Rotate secrets in vault
- Patch refresh scheduler

**Verification**
- Run “auth check” job

---

### RB-05 — Rate Limiting / Spam Restriction (RATE)
**Symptoms**
- 429 responses, action blocks, “restricted” signals
- Browser lane sees warnings or forced verification

**Immediate actions**
1) Reduce concurrency
2) Increase random jitter
3) Pause engagement automations
4) Disable any blueprint causing burst actions

**Diagnosis**
- Examine action cadence vs policy
- Check if multiple profiles share IP/device fingerprint

**Fix/Workaround**
- Implement adaptive pacing
- Stagger schedules
- Add daily caps per action type

**Verification**
- Resume slowly; confirm no new blocks

---

### RB-06 — Browser Runner Drift / Selector Breakage (BROWSER)
**Symptoms**
- Increased browser publish failures
- Screenshots show UI change, missing buttons, modals

**Immediate actions**
1) Route to API lane where possible
2) Pause browser lane side effects on that platform
3) Keep browser lane in read-only mode (ingest only)

**Diagnosis**
- Identify selector changes
- Detect new interstitials/captcha

**Fix/Workaround**
- Patch selector map
- Add resilient locator strategy
- Add drift snapshot updates

**Verification**
- Run sandbox canary

---

### RB-07 — Queue Backlog / Jobs Not Starting (QUEUE)
**Symptoms**
- Scheduling jobs delayed; queue depth rising

**Immediate actions**
1) Scale runners
2) Pause non-critical workloads (e.g., long media generation)
3) Ensure publish jobs prioritized

**Diagnosis**
- Dead letters rising
- DB contention
- Provider latency

**Fix/Workaround**
- Increase worker count safely
- Rebalance queues

**Verification**
- Queue freshness returns to target

---

### RB-08 — Tool Gateway Failure (Docker MCP / Tool routing) (TOOLGATE)
**Symptoms**
- Tool calls failing
- Missing tool responses

**Immediate actions**
1) Fail closed: block side effects
2) Switch to degraded mode (read-only + planning)

**Diagnosis**
- Docker MCP unavailable
- Tool registry mismatch

**Fix/Workaround**
- Restart gateway
- Roll back tool registry config

**Verification**
- Run “tool health suite” checks

---

### RB-09 — Provider Outage (LLM/image/video/avatar) (PROVIDER)
**Symptoms**
- timeouts, error spikes, generation failures

**Immediate actions**
1) Switch provider via ProviderConfig routing
2) Pause high-cost generation tasks

**Diagnosis**
- Provider status pages
- Confirm quota/credits

**Fix/Workaround**
- route to alternate model/provider
- degrade features: text-only, silent clips, reduced resolution

**Verification**
- Generate one asset end-to-end

---

### RB-10 — Runaway Engagement Loop (P0/P1)
**Symptoms**
- repeated DMs/replies
- high action rates

**Immediate actions**
1) Global or per-client engagement kill switch ON
2) Lock “keyword triggers”

**Diagnosis**
- recursion contract violated
- dedupe/idempotency missing

**Fix/Workaround**
- Add dedupe keys and conversation state
- Add hard caps and cooldowns

**Verification**
- Replay test thread in sandbox

---

### RB-11 — Missing Audit/Telemetry (OBS)
**Symptoms**
- side effects without audit proofs
- traces missing

**Immediate actions**
1) Freeze side effects for affected components

**Diagnosis**
- instrumentation regression
- logging pipeline issues

**Fix/Workaround**
- patch instrumentation
- add CI check for audit emission

**Verification**
- audit completeness returns to target

---

### RB-12 — Cost Runaway (COST)
**Symptoms**
- token usage spike
- generation spend spike

**Immediate actions**
1) Pause non-critical workflows
2) enforce cost caps

**Diagnosis**
- infinite recursion
- misconfigured provider routing

**Fix/Workaround**
- enforce per-episode budgets
- fix recursion stop conditions

**Verification**
- cost burn returns to normal

---

## 5) Postmortem policy

### 5.1 When postmortems are required
- P0 and P1: mandatory
- P2: required if recurring or if budget burn > threshold

### 5.2 Culture
- Blameless, learning-focused
- Emphasis on systems and guardrails

---

## 6) Postmortem template (copy/paste)

## Postmortem: {INCIDENT_ID} — {TITLE}

### 1) Summary (2–5 sentences)
- What happened
- Who was impacted
- Duration

### 2) Impact
- Client impact (list clients)
- Platform impact (list platforms)
- Actions impacted (publish/DM/comments)
- Business impact (missed posts, delayed replies, risk)

### 3) Detection
- How was it detected (alert/dashboard/operator)
- Time to detection
- What signal should have detected it earlier

### 4) Timeline (UTC)
| Time | Event | Owner | Evidence link |
|------|-------|-------|--------------|

### 5) Root cause(s)
- Primary cause
- Contributing factors
- Preconditions (why this was possible)

### 6) What went well
- Fast mitigation
- Good tooling

### 7) What went poorly
- Missing runbook steps
- unclear ownership
- noisy/insufficient alerts

### 8) Where we got lucky
- low blast radius
- time of day

### 9) Corrective actions
| Action | Type (mitigate/prevent/detect) | Owner | Due date | Status |
|--------|-------------------------------|-------|----------|--------|

### 10) Follow-up changes to docs/tests
- Runbooks updated
- Regression tests added
- Monitoring/alerts updated
- ADR added/updated

### 11) Appendix
- Logs
- Trace IDs
- AuditEvent samples
- Screenshots/video
- Deploy diffs

---

## 7) Post-MVP extensibility patterns

This incident system scales by adding:
- runbooks per platform/surface
- automated runbook suggestions in the dashboard
- “incident rehearsal” drills quarterly
- dependency SLOs per provider
- automated postmortem draft generation using incident artifacts

---

## 8) Next doc

**Threat Model + Data Flow Diagrams — v1**

