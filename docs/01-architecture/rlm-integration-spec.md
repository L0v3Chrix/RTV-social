# RLM Integration Spec — Recursive Language Models — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform  
**Audience:** Engineers, agent authors, operators  
**Goal:** Add a clean, implementable interpretation of **Recursive Language Models (RLMs)** to our repository so we can build long-horizon, multi-tenant automation without blowing context budgets.

---

## 0) Executive summary

**Recursive Language Models (RLMs)** are an inference-time paradigm where the LLM does **not** ingest the entire long prompt/context directly. Instead, the long prompt becomes part of an **external environment** the model can programmatically inspect (search, slice, summarize, diff), and the model **recursively calls itself** on small, relevant snippets until it has enough evidence to decide. This lets systems operate over **near-infinite context** while keeping each model call small, stable, and cheap.

For our platform, RLM is the foundational logic behind:

- **External memory** (Plan graph, Asset graph, Engagement events, Summaries)
- **Recursion contracts** (what an agent may read/write, when it recurses)
- **Evaluation loops** (self-critique vs human intervention)
- **Cost/latency budgets** (bounded episodes + stop rules)

**Bottom line:** RLM is the conceptual backbone that makes “autonomous social media operations” feasible at scale without context collapse.

---

## 1) Source of truth

This spec is derived from the paper:

- **Recursive Language Models** — Alex L. Zhang, Tim Kraska, Omar Khattab (MIT CSAIL), arXiv:2512.24601 (Dec 31, 2025)

It is also informed by the authors’ public blog and reference implementation.

**References:**
- arXiv abstract: https://arxiv.org/abs/2512.24601
- arXiv HTML: https://arxiv.org/html/2512.24601v1
- arXiv PDF: https://arxiv.org/pdf/2512.24601
- Author blog: https://alexzhang13.github.io/blog/2025/rlm/
- Reference codebase: https://github.com/alexzhang13/rlm

---

## 2) Why RLM is required in *our* system

Our platform accumulates context across:

- Tenant onboarding schemas (BrandKit + KnowledgeBase + Policies + Keys)
- Planning output (plan variants, calendars, experiments)
- Creation output (assets, prompt packs, storyboards, clip manifests)
- Publishing execution (audit logs, verification results)
- Engagement execution (comment threads, DM transcripts, escalation events)
- Runner telemetry (traces, errors, drift signals)

If we attempt to “stuff” this into standard LLM prompts:

- quality degrades as input grows ("context rot")
- costs explode
- agents become inconsistent and unsafe
- debugging is impossible (no structured evidence trail)

RLM solves this by enforcing:

- **External memory** is the canonical source (DB/files), not the prompt
- LLM only sees **slices** (retrieved evidence) at any time
- Recursion is **explicit**: “fetch → reason → decide → write back”

---

## 3) RLM: core concepts (operational definitions)

### 3.1 Environment
The “prompt” becomes an **environment** the model can query.

In our system, the environment includes:

- Postgres (tenant-scoped tables)
- Object store (S3/R2) for large artifacts
- Optional search index / vector store
- Audit/event stream
- Browser lane artifacts (screenshots, DOM hashes)

### 3.2 Tools (inspection primitives)
Instead of reading everything, the model uses tools:

- `search(query, filters)`
- `fetch_doc(id, sections)`
- `fetch_plan(plan_id)`
- `fetch_asset(asset_id)`
- `fetch_events(stream, range, filters)`
- `summarize(doc_id, style)`
- `diff(a, b)`
- `write_summary(target_id, summary_type)`

**Design principle:** tools return *references + small summaries* by default; raw payloads go to external files.

### 3.3 Recursion
Recursion means the system performs **multiple small LLM calls** rather than one huge call.

Example:

1) call model to decide what evidence is needed
2) retrieve a small evidence set
3) call model to interpret evidence
4) repeat until confidence or budget limit

### 3.4 Episode
An “episode” is one complete run of an agent workflow (e.g., planning, creating, posting, engaging) that:

- starts with an objective
- executes recursive calls
- ends with outputs + audits
- is bounded by budgets (tokens, time, retries)

---

## 4) How RLM maps to our architecture

### 4.1 The RLM Runtime (RLMEnv)
We implement a platform-level runtime called **RLMEnv**.

RLMEnv is the policy-aware wrapper around:

- external memory
- tool gateway (MCP/Docker MCP)
- audit logging
- budget enforcement
- recursion control

**RLMEnv responsibilities:**

1) Resolve tenant context (`tenant_id`, `platform_account_id`, lane)
2) Enforce RBAC + policies before any read/write
3) Provide inspection tools (search/fetch/summarize)
4) Enforce budgets (tokens/time/retries)
5) Emit audit events for all side-effect attempts
6) Persist summaries and decisions back to external memory

### 4.2 External memory is the “long context”
The system stores durable artifacts in external memory, not in prompts.

Minimal required RLM external memory objects:

- Plan graph model
- Asset graph
- Conversation summaries (DM and comment summarizations)
- Engagement events
- Runner telemetry summaries
- Policy and approvals state

### 4.3 “RLM mode” vs “Standard mode”
All agents must run in one of two modes:

- **Standard mode:** small contexts, minimal retrieval (cheap)
- **RLM mode:** recursion + external memory (for long horizon / complex tasks)

**Rule:** planning/engagement defaults to RLM mode. Asset creation can be standard (unless doing large research or long series).

---

## 5) RLM in practice: the 4-step loop

We implement the loop as:

1) **Observe**: read minimal state (goal + last summaries)
2) **Retrieve**: query environment for evidence slices
3) **Reason**: interpret evidence, propose next action
4) **Write back**: persist decision, summary, audits, and next checkpoints

A single “reason” step is always bounded:

- `max_input_tokens`
- `max_output_tokens`
- `max_tool_calls`

---

## 6) RLM design constraints for our domain (social automation)

Social automation is high-side-effect. We add constraints:

### 6.1 Fail-closed side effects
If **identity preflight**, **policy preflight**, or **budget checks** fail:

- no tool call is executed
- an incident card is created
- operator must review

### 6.2 Summaries as first-class objects
We treat summaries as durable state:

- `CommentThreadSummary`
- `DMSummary`
- `PlanSummary`
- `ExperimentSummary`
- `IncidentSummary`

All summaries are:

- tenant-scoped
- versioned
- appended, not overwritten

### 6.3 Evidence bundle per episode
Every episode produces:

- trace id
- tool call transcript (summarized)
- artifacts (screenshots, payload refs)
- audit events
- decision summary

---

## 7) Implementation blueprint (repo structure)

Suggested folders:

```
/docs/specs/
  rlm_recursive_language_models.md   # this doc
  external_memory_schema.md
  recursion_contracts.md
  evaluation_loops.md
  cost_latency_budgets.md

/packages/core/
  rlm/
    env.ts            # RLMEnv interface + budgets
    episode.ts        # episode lifecycle
    retriever.ts      # search/fetch/summarize primitives
    summarizer.ts     # summary generators + versioning
    contracts.ts      # recursion contracts + guardrails

/apps/runner/
  episodes/
    planning.ts
    creation.ts
    publishing.ts
    engagement.ts
```

---

## 8) Minimal RLM API (interfaces)

### 8.1 RLMEnv interface (conceptual)

RLMEnv must expose:

- `observe(stateRef) → Observation`
- `retrieve(queryPlan) → EvidenceBundle`
- `reason(objective, observation, evidence) → Decision`
- `commit(decision) → CommitResult`

Where:

- **Observation** is small (last summaries + high-signal counters)
- **EvidenceBundle** contains references + short extracts
- **Decision** contains planned actions + reasons + confidence + next recursion criteria
- **CommitResult** writes summaries and emits audits

### 8.2 Episode contract
Each episode must specify:

- objective
- allowed reads
- allowed writes
- max recursion depth
- max tool calls
- max tokens
- stop rules

---

## 9) Stop rules (when recursion ends)

Recursion stops when any condition is met:

1) **Confidence threshold reached** (decision is stable)
2) **Budget exceeded** (tokens/time/tool calls)
3) **No new evidence** (retrieval no longer changes outcome)
4) **Risk threshold exceeded** (side-effect risk requires operator)

When stopping due to budget/risk, the episode must create:

- a recommended next step
- a minimal operator checklist
- an explicit “what we tried” log

---

## 10) Practical examples in our system

### Example A: Engagement reply drafting

Goal: Reply to 50 new comments across tenants without context explosion.

RLM loop:

1) Observe: fetch “engagement summary” + policy for that tenant
2) Retrieve: pull only new threads (IDs + excerpts)
3) Reason: draft replies grouped by intent
4) Write back: store reply drafts and mark requiring approval if needed

### Example B: Plan creation with deep KB

Goal: Generate a 30-day plan aligned with the BrandKit + history.

RLM loop:

1) Observe: last plan summary + performance notes
2) Retrieve: fetch only relevant offer notes + recent winning hooks
3) Reason: propose plan graph
4) Write back: persist plan nodes + schedule suggestions

---

## 11) What we must NOT do

- Do not dump raw logs into prompts.
- Do not let agents fetch unbounded data.
- Do not allow recursion without budgets.
- Do not allow “browser lane” actions without identity preflight + audit.

---

## 12) Acceptance criteria (Definition of Done for RLM integration)

RLM integration is “done” when:

1) RLMEnv exists with enforceable budgets
2) External memory schema supports:
   - plan graph
   - asset graph
   - conversation summaries
   - engagement events
3) Episodes are replayable from stored evidence bundles
4) Cross-tenant isolation tests pass for all RLM reads/writes
5) Observability shows:
   - recursion depth
   - tool call counts
   - token usage
   - stop reasons

---

## 13) Post-MVP extensibility patterns

RLM unlocks scalable upgrades:

- “analysis-only episodes” for research and ideation
- background summarization jobs that keep memory fresh
- multi-model routing per subtask
- automated prompt regression testing by episode replay

---

## 14) Next documents

To complete the RLM pack, ensure these are present (they already exist in this project’s doc set):

- **External Memory Schema (RLM core)**
- **Agent Recursion Contracts**
- **Evaluation Loops**
- **Cost & Latency Budgets**
- **RLM → Agent Prompt Architecture**
- **Full Recursive System Diagram (Conceptual)**

