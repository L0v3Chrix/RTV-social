# Observability & Check-In Dashboard Spec — v1.1 (Final)

**Purpose:** Make the platform reliable enough that an agency operator can **check in a couple times a day**, resolve exceptions fast, and keep dozens (eventually hundreds) of client workflows moving without constant babysitting.

This spec defines:
- what we measure (telemetry + audits)
- how we instrument (standard signals)
- what dashboards we ship (MVP)
- what alerts exist (SLO-driven, low-noise)
- the daily check-in flow (10–15 minutes, twice a day)

**Design stance:** Observability is a product feature. If you can’t see it, you can’t scale it.

---

## 1) Observability philosophy (MVP)

We implement:
- **Golden Signals** for end-to-end, user-visible reliability (Latency, Traffic, Errors, Saturation)
- **RED** for service endpoints (Rate, Errors, Duration)
- **USE** for infrastructure/resources (Utilization, Saturation, Errors)
- **Audit-first side effects**: every publish/DM/comment action must be traceable

**Rule:** One correlation ID everywhere.

---

## 2) System boundaries: what must be observable

### 2.1 Core subsystems
1) **Web App** (Next.js UI + API routes)
2) **Orchestrator / Job Runner** (agent episodes + queue)
3) **Tool Gateway** (Docker MCP, tool discovery + execution)
4) **Browser Runner** (profile vault + step executor)
5) **Platform Connectors** (API lane integrations)
6) **Storage** (DB, object storage for assets, caches)

### 2.2 Workflow lanes (first-class telemetry dimensions)
- Planning
- Creation
- Publishing
- Engagement

---

## 3) Telemetry types & storage

### 3.1 Required signals (MVP minimum)
- **Metrics** (time-series: counters, histograms, gauges)
- **Logs** (structured JSON)
- **Traces** (distributed traces across web → runner → tools)
- **Audits** (append-only records for every side-effect)

### 3.2 OpenTelemetry standardization (recommended)
Instrument web, runner, and gateways with OpenTelemetry.

Export options:
- Managed: Datadog / New Relic / Honeycomb
- Self-host: Grafana stack (Prometheus + Loki + Tempo)

**Sampling policy:**
- 100% traces for errors + escalations
- 10–20% traces for routine success

---

## 4) Canonical identifiers (required)

Every telemetry record MUST include (where applicable):
- `request_id` (web/API request)
- `trace_id`, `span_id`
- `client_id`
- `platform` (instagram|facebook|tiktok|youtube|linkedin|x|skool)
- `surface` (reels|feed|stories|shorts|community|dm)
- `lane` (planning|creation|publishing|engagement)
- `blueprint_id`
- `plan_id`, `asset_id`, `calendar_item_id`
- `episode_id` (agent episode)
- `job_id` (queue job)
- `tool_id` (MCP tool reference)
- `runner_id` (browser runner)

---

## 5) Metrics catalog (MVP)

> These are the metrics we must implement to operate the system at scale.

### 5.1 Golden signals (system-level)

**Latency**
- `api_http_duration_ms{route,method,status}` (p50/p95/p99)
- `job_end_to_end_duration_ms{lane,blueprint}`
- `publish_time_to_visible_ms{platform,lane}`

**Traffic**
- `jobs_enqueued_total{lane,blueprint}`
- `jobs_completed_total{lane,blueprint}`
- `posts_published_total{platform,surface}`

**Errors**
- `api_http_errors_total{route,status}`
- `job_failures_total{lane,blueprint,reason}`
- `tool_errors_total{tool_id,reason}`
- `publish_failures_total{platform,reason}`

**Saturation**
- `queue_depth{queue}`
- `runner_capacity_in_use{runner_pool}`
- `rate_limit_remaining{platform}` (best-effort)

### 5.2 Workflow funnel reliability (per client + platform)
- `plan_to_asset_success_rate{client_id}`
- `asset_to_calendar_success_rate{client_id}`
- `calendar_to_publish_success_rate{client_id,platform}`
- `publish_to_engagement_ingest_rate{client_id,platform}`

### 5.3 Agent quality & recursion controls
- `episode_steps_total{agent}`
- `episode_retries_total{agent,reason}`
- `episode_escalations_total{agent,reason}`
- `policy_guard_blocks_total{policy,reason}`

### 5.4 Browser runner metrics
- `browser_runs_total{platform,action}`
- `browser_step_duration_ms{action,selector_hash}`
- `browser_step_failures_total{action,reason}`
- `browser_login_challenges_total{platform}`
- `browser_screenshot_captured_total{reason}`

### 5.5 Provider + cost metrics (BYOK aware)
- `llm_calls_total{provider,model,task_class}`
- `llm_tokens_total{provider,model,type=in|out}`
- `llm_cost_usd_total{provider,model}` (derived)
- `image_gen_calls_total{provider,model}`
- `video_gen_calls_total{provider,model}`

### 5.6 Storage + asset pipeline metrics
- `asset_render_duration_ms{type=image|video|caption}`
- `asset_upload_failures_total{storage_provider}`
- `asset_dedupe_hits_total{client_id}`

---

## 6) Logs: required structure (JSON)

All logs are structured JSON.

Required fields:
- timestamp, level
- request_id, trace_id, span_id
- client_id, platform, lane, blueprint_id
- episode_id, job_id
- event_name
- duration_ms
- status (ok|error|blocked|retry)
- error_code + error_message (when error)

**Never log:** plaintext secrets, OAuth tokens, raw BYOK keys.

---

## 7) Traces: required spans (minimum)

### 7.1 Core spans
- `http.request` (web)
- `job.dequeue` (runner)
- `agent.episode` (planning/creation/publish/engage)
- `tool.call` (Docker MCP)
- `browser.run` (if Browser lane)
- `platform.api` (API lane)
- `post.verify` (visibility check)

### 7.2 Trace propagation rules
- propagate trace context across:
  - web → runner queue job payload
  - runner → tool gateway
  - tool gateway → browser runner

---

## 8) Audits: the source of truth for side effects

Every side-effect action writes an **append-only** audit record.

### 8.1 AuditEvent schema (minimum)
- `audit_id`
- `client_id`
- `actor_type` (agent|operator|system)
- `actor_id` (user_id or agent_id)
- `action_type` (publish|schedule|dm_send|comment_reply|story_post|hide_comment)
- `platform`, `surface`, `lane`
- `payload_hash` + `payload_summary`
- `policy_snapshot_id`
- `result` (success|fail|blocked)
- `proof` (post URL, screenshot ref)
- `created_at`

---

## 9) Dashboards (MVP set)

### Dashboard A — Global Ops Overview (owner view)
**Answers:** “Are we healthy?”

Widgets:
- Golden Signals (24h + 1h)
- jobs completed vs failed (24h)
- queue depth by lane
- top failing clients (by failure rate)
- browser runner pool health (available vs busy)
- provider health (LLM/video/image error rate)

### Dashboard B — Today’s Work Queue (operator view)
**Answers:** “What do I need to touch right now?”

Widgets:
- Ready-for-approval counts
- Blocked / needs attention list (severity sorted)
- publishes scheduled in next 6h
- publish verification failures
- escalated DM/comment threads
- policy blocks (to review false positives)

### Dashboard C — Client Health Dashboard (per client)
**Answers:** “Why is this client stuck?”

Widgets:
- pipeline funnel success rates
- calendar timeline (planned → scheduled → published)
- last 20 audits
- platform connection health (token status)
- lane usage mix (API vs Browser)

### Dashboard D — Lane Reliability (engineering + ops)
**Answers:** “Which lane is hurting us?”

Widgets:
- publish success rate by lane
- time-to-visible by lane
- top error reasons
- browser step failure heatmap (selector drift)

### Dashboard E — Cost & Budget (BYOK aware)
**Answers:** “Are costs or retries spiraling?”

Widgets:
- daily cost estimate by client
- tokens used by model
- highest spend blueprints
- retry-cost impact

---

## 10) Alerting: low-noise, SLO-driven

### 10.1 Alert tiers
- **P0:** platform-wide publish or verify broken for multiple clients
- **P1:** publish failures rising for a platform
- **P2:** single client blocked / stuck
- **P3:** cost spike or slow degradation

### 10.2 Recommended starter SLOs (tighten later)
- Publish Success: ≥ 99% scheduled publishes succeed (per platform, 24h)
- Verification: ≥ 98% publishes verified visible within 10 minutes
- Queue Latency: p95 job start delay < 2 minutes
- Runner Availability: runner pool not saturated > 5 minutes

### 10.3 Alerts (examples)
- Publish failure rate > 2% for 15 minutes (platform-wide)
- Verification failures > 1% for 15 minutes
- Browser login challenges spike
- Queue depth exceeds cap for 10 minutes
- Provider error spike (LLM/video/image)

---

## 11) Daily check-in protocol (2× per day)

### Morning check-in (10–15 minutes)
1) Open **Today’s Work Queue**
2) Approve draft → publish items
3) Clear escalations (DM/comment)
4) Confirm runner health + platform tokens
5) Confirm next 6h schedule

### Midday check-in (10–15 minutes)
1) Verify posts went live
2) Resolve publish/verify failures
3) Approve engagement drafts for high-signal threads
4) Review policy blocks (false positives)

### Optional late check-in (5–10 minutes)
- skim engagement summaries
- tag follow-ups for tomorrow

---

## 12) Runbooks (MVP minimum)

Write one-pagers for:
- Publish failure spike
- Verification failures
- Browser runner login challenge
- Selector drift
- Provider outage
- Token refresh failing
- Queue backing up

Each runbook includes: symptoms → likely causes → immediate actions → rollback → prevention.

---

## 13) Implementation plan (MVP)

### 13.1 Instrumentation steps
1) Add OTEL SDK to Web App + Runner + Tool Gateway
2) Implement context propagation (trace_id from web → job)
3) Add structured logging (trace_id/span_id in all logs)
4) Implement metrics catalog (counters + histograms)
5) Implement AuditEvent append-only store

### 13.2 Dashboard build steps
1) Build Global Ops Overview
2) Build Today’s Work Queue
3) Build Client Health
4) Build Lane Reliability
5) Build Cost & Budget

### 13.3 Alerting steps
1) Create SLOs
2) Create low-noise alerts
3) Connect pager/notification routing
4) Write runbooks for each alert

---

## 14) Final MVP checklist (complete)

### A) Must-have instrumentation
- [ ] OTEL installed in Web App
- [ ] OTEL installed in Runner
- [ ] OTEL installed in Tool Gateway
- [ ] Trace context propagates web → queue job → tool calls
- [ ] Structured logs include trace_id/span_id everywhere
- [ ] Metrics exported (OTLP or native backend)

### B) Must-have metrics
- [ ] api_http_duration_ms (p50/p95/p99)
- [ ] api_http_errors_total
- [ ] jobs_enqueued_total / jobs_completed_total / job_failures_total
- [ ] publish_failures_total
- [ ] publish_time_to_visible_ms
- [ ] queue_depth
- [ ] runner_capacity_in_use
- [ ] tool_errors_total
- [ ] policy_guard_blocks_total
- [ ] episode_retries_total / episode_escalations_total
- [ ] llm_calls_total / llm_tokens_total / llm_cost_usd_total

### C) Must-have audits
- [ ] AuditEvent emitted for every side effect
- [ ] Proof stored for publish (URL; screenshot for browser lane)
- [ ] Policy snapshot recorded per action

### D) Must-have dashboards
- [ ] Global Ops Overview
- [ ] Today’s Work Queue
- [ ] Client Health Dashboard
- [ ] Lane Reliability
- [ ] Cost & Budget

### E) Must-have alerts
- [ ] Platform-wide publish failure spike
- [ ] Verification failure spike
- [ ] Browser login challenges spike
- [ ] Queue depth saturation
- [ ] Provider outage / error spike

### F) Must-have operator workflows
- [ ] Morning check-in path works end-to-end
- [ ] Midday check-in path works end-to-end
- [ ] Escalation queue is visible and actionable
- [ ] Kill switch visible per client/platform

### G) Must-have runbooks
- [ ] Publish failure spike
- [ ] Verification failures
- [ ] Browser login challenge
- [ ] Selector drift
- [ ] Provider outage
- [ ] Token refresh failing
- [ ] Queue backing up

---

## 15) Post-MVP extensibility

- Canary accounts + synthetic publish checks
- Automated regression monitoring for browser selectors
- Campaign performance dashboards (V2)
- Experimentation OS metric ingestion (V2)

---

## 16) Next document (if you want it)
**Runbook Pack — v1** (copy/paste one-pagers for the failure modes above).

