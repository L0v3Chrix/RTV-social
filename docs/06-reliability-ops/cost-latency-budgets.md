# Cost & Latency Budgets — v1

This document defines the **operational budgets** (tokens, tool calls, retries, wall-clock time, and cost envelopes) for the RLM agent system.

It is designed to be:
- **MVP actionable**: safe defaults that prevent runaway spend and looping
- **production-ready**: metrics, SLOs, graceful degradation
- **post-MVP extensible**: per-client budgets, adaptive routing, FinOps controls

**Key 2026 principle:** budgets are enforced **per episode**, **per workflow**, and **per client/day**. When budgets are exceeded, the system **degrades gracefully** (smaller model, less context, fewer tools) or escalates to human.

---

## 0) Why budgets matter

Without hard budgets, agent systems fail in predictable ways:
- prompt/context sprawl → cost + latency inflation
- too many tools exposed → tool confusion and context bloat
- repeated retries → runaway spend
- slow/blocked browser runs → job pileups and deadlocks

Budgets prevent these failures and keep the platform **fast, reliable, and profitable**.

---

## 1) Budget Layers (3 tiers)

### Tier A — Episode budgets (single agent run)
Caps per `AgentEpisode`:
- max tokens (input + output)
- max tool calls
- max wall-clock time
- max retries per tool call

### Tier B — Workflow budgets (multi-episode chain)
Caps per “root workflow” (e.g., Create + Publish + Verify):
- max episodes in chain
- max aggregate tokens
- max aggregate tool calls
- max time-to-completion

### Tier C — Client envelopes (daily/weekly)
Caps per client:
- max spend/day
- max API calls/day
- max browser minutes/day
- platform rate limits

When Tier C is near exhaustion, the system:
- pauses non-critical work
- schedules into off-peak
- switches to lower-cost models

---

## 2) Latency SLOs (what “fast” means)

We define SLOs by workflow type.

### 2.1 User-facing UI actions (agency operator)
- **P50:** 2–5 seconds
- **P95:** 10–15 seconds

Examples:
- Generate plan draft (summary output)
- Generate captions for 1 blueprint
- Generate “reply suggestion” for a single DM

### 2.2 Background jobs (async)
- **P50:** 1–5 minutes
- **P95:** 15–30 minutes

Examples:
- Generate 10–30 images
- Generate 10–60 short clips
- Render stitched reels

### 2.3 Browser lane jobs
- **P50:** 30–90 seconds per publish action
- **P95:** 3–6 minutes

If it exceeds P95 repeatedly, trigger:
- UI contract test failure alert
- lane downgrade / escalation

---

## 3) Token Budgets (2026 defaults)

**Rule:** Keep agent context tight. Prefer retrieval of *summaries* and *small snippets*.

### 3.1 Per-episode token caps (defaults)

| Episode type | Input cap | Output cap | Total cap | Notes |
|---|---:|---:|---:|---|
| Planner (plan draft) | 6,000 | 1,500 | 7,500 | Plan graph nodes created as structured objects |
| Blueprint selection | 4,000 | 1,000 | 5,000 | Uses blueprint library + client policy |
| Scheduler | 3,000 | 1,000 | 4,000 | Mostly deterministic rules |
| Copywriter (1 blueprint instance) | 5,000 | 1,200 | 6,200 | Produces copy pack + variants |
| PromptWriter (image/video) | 4,000 | 800 | 4,800 | Uses strict templates |
| QAEditor | 4,000 | 1,000 | 5,000 | Produces EvalReport + FixList |
| Comment reply suggestion | 2,000 | 400 | 2,400 | Very bounded |
| DM responder (single turn) | 3,000 | 600 | 3,600 | Multi-turn threads use summaries |
| EscalationRouter | 1,500 | 250 | 1,750 | Always short |

### 3.2 Workflow token caps (aggregates)

| Workflow | Max episodes | Max total tokens | Notes |
|---|---:|---:|---|
| Plan week (all platforms) | 6 | 30,000 | includes planning + blueprint selection + scheduling |
| Create assets for 1 plan day | 10 | 45,000 | includes copy, prompts, QA, packaging |
| Publish + verify (1 post) | 5 | 18,000 | includes preflight, publish, verify |
| Engage (scan + respond batch) | 8 | 25,000 | batches are split by platform |

### 3.3 Context “diet” rules (non-negotiable)
- never dump raw scrape output into model context
- prefer `summary_short` + last N events for conversations
- store large tool outputs in S3; inject only extracted facts
- tool list exposure must be **minimal** (Docker MCP gateway / tool search)

---

## 4) Tool Call Budgets

### 4.1 Per-episode tool caps

| Agent | Max tool calls | Notes |
|---|---:|---|
| Planner | 4 | retrieval + plan write |
| Copywriter | 4 | retrieval + style checks |
| PromptWriter | 5 | provider lint + artifact writes |
| VideoAssembler | 10 | generation job orchestration occurs outside LLM via scripts |
| QAEditor | 6 | validators + evidence |
| PublisherAPI | 6 | preflight + publish + verify triggers |
| PublisherBrowser | 8 | runner executes steps; LLM does not loop UI |
| Engagement agents | 6 | fetch thread + reply + log |

### 4.2 Tool call batching (required)
Where possible, use:
- bulk fetch endpoints
- paginated retrieval
- background jobs

### 4.3 Programmatic tool calling policy
Workflows that require many tool calls must run inside:
- **Runner/Worker code** (JS/Python)
- store outputs in external artifacts
- return only a short summary + pointers to the agent

This prevents context flooding and reduces token burn.

---

## 5) Retry Policy + Backoff

### 5.1 Retry classes
- **Transient** (network, 429, 5xx): retry
- **Auth** (token expired): refresh once, then escalate
- **Validation** (bad payload): do not retry blindly—fix then retry
- **Platform UI drift** (browser selectors): run contract test, then escalate

### 5.2 Default retry caps

| Failure type | Retries | Backoff |
|---|---:|---|
| 429 rate limit | 3 | exponential + jitter (30s → 2m → 5m) |
| 5xx provider | 2 | 15s → 60s |
| media generation failed | 2 | 60s → 3m |
| browser step failure | 1 | immediate re-run step once |
| publish mismatch on verify | 1 | re-check once, then escalate |

### 5.3 Max recursion depth (ties to Retry)
- Creative generation: depth **3**
- Publishing: depth **2**
- Engagement: depth **2**

After max depth: escalate or stop.

---

## 6) Cost Budgets (FinOps envelopes)

### 6.1 What we measure (minimum telemetry)
For every episode and workflow record:
- tokens in/out
- tool calls count
- wall-clock latency
- provider/model used
- cost estimate

### 6.2 Client envelope defaults (MVP)
These are starting points; per-client overrides allowed.

| Client tier | Max $/day | Max LLM tokens/day | Max image gens/day | Max video clips/day | Browser minutes/day |
|---|---:|---:|---:|---:|---:|
| Starter | $10–$25 | 250k–600k | 50–150 | 10–30 | 30 |
| Growth | $25–$75 | 600k–2M | 150–500 | 30–120 | 90 |
| Pro | $75–$250 | 2M–8M | 500–2,000 | 120–600 | 240 |

### 6.3 “Budget breach” actions
When a client hits 80% of any daily budget:
- switch to cheaper models for non-critical tasks
- stop generating optional variants
- reduce engagement frequency

At 100%:
- pause non-critical workflows
- continue only:
  - verification
  - compliance escalations
  - inbox triage (draft-only)

### 6.4 Model routing for cost control
ProviderConfig should support tiered routing:
- **default model** (balanced)
- **cheap model** (drafts, summarization)
- **premium model** (hard problems, compliance review)

Rule: “expensive only when it matters.”

---

## 7) Platform Rate Limits + Throttles

### 7.1 API lane
Respect platform API quotas and backoff on 429.

### 7.2 Browser lane
Browser lane is **riskier** and must be throttled:
- max actions/minute per profile
- max sessions/day per profile
- idle time randomization

### 7.3 Engagement pacing (anti-spam)
Hard caps per platform profile:
- likes/hour
- comment replies/hour
- DMs/hour

Default: conservative. Increase only with evidence and client approval.

---

## 8) Caching + Reuse (major 2026 cost lever)

### 8.1 What we cache
- KB retrieval summaries
- blueprint “prompt skeletons”
- hashtag packs
- brand voice exemplars
- repeated copy elements (bio, CTA blocks)

### 8.2 Cache invalidation
Invalidate on:
- BrandKit version change
- Offer change
- Policy change

---

## 9) Escalation thresholds

Escalate immediately when:
- compliance risk detected
- user complaint/refund/legal/medical
- repeated publish failures
- repeated browser automation blocks (CAPTCHA/2FA)
- budget exceeded but critical work remains

Escalation payload must include:
- thread summary
- proposed response
- risk flags
- evidence links

---

## 10) Implementation Checklist (MVP)

### 10.1 Telemetry
- token usage logging per episode
- latency (p50/p95)
- tool call count
- cost estimates

### 10.2 Enforcers
- EpisodeBudgetEnforcer middleware
- WorkflowBudgetEnforcer
- ClientBudgetEnforcer (daily)

### 10.3 Degradation policies
- model downgrade rules
- context shrink rules
- disable optional steps rules

### 10.4 Alerts
- budget threshold alerts (80%, 100%)
- browser lane failures > threshold
- publish verify mismatches

---

## 11) Post-MVP Extensions

### 11.1 Adaptive budgets
- raise budgets for workflows that prove ROI
- lower budgets for low-performing blueprints

### 11.2 Budget-aware planning
Planner incorporates cost estimates:
- “plan A: high production” vs “plan B: lean”

### 11.3 Predictive preflight
Before running heavy jobs (video), estimate:
- cost
- time
- success probability
Then require explicit approval if above thresholds.

---

## 12) Next Documents (from your list)
You asked for additional conceptual docs after budgets:

1) **Map RLM → Agent Prompt Architecture — v1**
2) **Full Recursive System Diagram (Conceptual) — v1**

These should be generated next, one at a time, as separate canvases.

