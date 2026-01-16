# RLM → Agent Prompt Architecture — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency‑Operated)

**Purpose:** Define exactly how we translate **Recursive Language Models (RLM)** principles into a practical **agent prompt architecture** for our system, so agents can operate over effectively infinite context (plans, assets, engagement history, logs, KB) while keeping each model call small, safe, testable, and cost‑bounded.

This doc is **implementation‑oriented**: it specifies prompt layers, agent “episodes,” recursion triggers, tool boundaries, memory reads/writes, and the templates engineers will codify.

---

## 0) RLM in one paragraph (operational definition)

RLM is an inference strategy where the model treats long context as an **external environment** (not a single giant prompt). The model can **inspect, decompose, and recursively call itself** over small snippets and summaries to solve long‑context tasks. In our platform, that means: **the truth lives in external memory** (DB/object store/event streams), and agents only pull the minimum slices needed per step, with recursion as a controlled program (not free‑form wandering).

---

## 1) The mental model: “Episodes” not “Chats”

We do not run one infinite agent conversation.

We run **Episodes**:

- an episode has a **goal**, **inputs**, **budgets**, **policy envelope**, and **allowed tools**
- it may spawn **sub‑episodes** (subagents) to gather info or produce artifacts
- it must end with **writes**: (a) output artifact(s), (b) memory updates, (c) audit + telemetry

**Outcome:** bounded cost and reproducible behavior.

### 1.1 Episode phases (standard)

Every episode runs this phase machine:

1) **Intake** → read minimal context
2) **Plan** → produce a plan graph node + tool needs
3) **Act** → call tools / generate artifacts / schedule actions
4) **Verify** → self‑check + policy re-check + dry‑run validation
5) **Commit** → write outputs + summaries + audit events

If any phase exceeds budget or hits uncertainty, it recurses into a subagent.

---

## 2) Prompt stack: layered and composable

We treat prompts like a **stack of contracts**. Each layer is versioned and testable.

### 2.1 Prompt layers

**L0 — Platform Constitution (global system layer)**
- non‑negotiables: no silent failures, tenant isolation, side‑effect safety
- mandatory output schemas for actions
- refusal behavior for unsafe/unapproved actions

**L1 — Product Operating Manual (global policy layer)**
- Planning → Creation → Publishing → Engagement
- lane rules (API vs Browser vs Hybrid)
- tool gateway rule (Docker MCP / tool registry)
- budget rules (tokens, retries, time)

**L2 — Role/Agent Spec (per agent)**
- what the agent does
- what it can read
- what it can write
- what triggers recursion
- what tools it may call

**L3 — Task Packet (per episode)**
- goal
- tenant + platform targets
- allowed lanes
- budgets
- required outputs

**L4 — Context Capsule (retrieved)**
- only the minimum slices:
  - BrandKit summary
  - KB top facts
  - last plan summary
  - relevant assets list
  - relevant engagement events summary

**L5 — Tool Results (bounded)**
- tool outputs are NOT blindly injected
- tool gateway writes raw results to external storage
- agent gets a summarized “receipt” + pointers

### 2.2 Why this matters
- prevents context drift
- makes prompts modular
- enables versioned rollouts (feature flags for prompts)

---

## 3) The RLM “Environment” contract (what agents see)

Agents never “see the database.” They see a **typed environment**.

### 3.1 Environment primitives

The agent prompt assumes these environment primitives exist (implemented as tool calls / internal APIs):

- `env.get_client_capsule(client_id)` → brand + offers + compliance + enabled blueprints
- `env.search_kb(client_id, query, k)` → returns pointers + summaries
- `env.fetch_plan_graph(client_id, window)` → plan nodes + edges (summaries)
- `env.fetch_asset_graph(client_id, plan_id|time)` → assets + metadata
- `env.fetch_engagement_events(client_id, platform, window, filters)` → summarized events + pointers
- `env.read_pointer(pointer_id, max_bytes)` → safe bounded read
- `env.write_summary(target, summary_type, content)` → append-only summary writes
- `env.write_artifact(type, metadata, content_ref)` → artifact registry write
- `env.dry_run(action_spec)` → validation without side effects
- `env.policy_check(action_spec)` → allow/deny + reasons

### 3.2 “Pointer-first” rule
All large data is referenced by **pointers** (IDs, URIs). Agents request slices.

---

## 4) Agent taxonomy (what agents exist and how prompts differ)

We split agents by **responsibility + side-effect risk**.

### 4.1 Core agents

1) **Orchestrator**
- owns the episode state machine
- spawns subagents
- enforces budgets
- commits summaries + audit

2) **Planner**
- generates plan graph nodes
- selects creative blueprints
- emits schedule proposals

3) **Creator**
- generates copy prompts, image prompts, video prompts
- emits asset specs and generation jobs

4) **Publisher**
- transforms scheduled items into platform-specific action specs
- prefers API lane, falls back to browser lane under policy

5) **Engagement Agent**
- comment replies, DM routing, like/follow policies
- must follow “platform side-effect safety spec”

6) **Verifier**
- validates outputs, schema correctness, policy alignment
- runs golden-path checks

7) **Doc Agent**
- append-only documentation updates
- ADR suggestions when architecture changes

### 4.2 Subagents (specialists)
Use subagents when:
- you need deep retrieval
- you need platform-specific formatting
- you need to isolate context

Examples:
- `reels_scriptwriter`
- `carousel_designer`
- `skool_community_ops`
- `policy_linter`

---

## 5) Recursion: when, why, and how

RLM is not “always recurse.” It’s **controlled recursion**.

### 5.1 Recursion triggers (standard)
An agent MUST recurse when:

- **Context Insufficient:** missing key facts (offer/CTA/compliance)
- **Ambiguity:** multiple plausible actions with different risk
- **Budget Threat:** token/time budget predicted to exceed threshold
- **High Side-Effect:** publish/DM/comment/like without strong confidence
- **Conflict:** KB facts disagree with latest plan or policy
- **Drift Detected:** generated content deviates from BrandKit examples

### 5.2 Recursion contracts
Every recursion call must specify:

- `why` (trigger)
- `what_to_fetch` (explicit)
- `return_format` (schema)
- `max_cost` (budget)

### 5.3 Recursion depth limits
- default depth: 2
- max depth: 4 (Orchestrator override only)

---

## 6) Prompt templates (copy‑paste ready)

### 6.1 Orchestrator — L2 agent spec (template)

**You are the Orchestrator Agent for Raize The Vibe’s automation platform.**

**Mission:** Deliver the requested outcome by running a bounded episode: Intake → Plan → Act → Verify → Commit.

**You may read:**
- `ClientCapsule`, `PlanGraph summaries`, `AssetGraph metadata`, `Engagement summaries`, `PolicyBundle`

**You may write:**
- `PlanNode`, `AssetSpec`, `ActionSpec`, `EpisodeSummary`, `AuditEvent`

**You must recurse when:**
- any trigger in §5.1 is met

**Tool policy:**
- Call tools only through the Tool Gateway.
- Never request raw bulk data; request pointers + summaries.

**Budgets:**
- Respect `episode_budget`. If approaching 70% usage, compress or recurse.

**Output requirements:**
- Always output valid JSON schemas for plan/actions.
- Always end with `commit_bundle` (writes + audit + summary).

### 6.2 Task Packet — L3 (template)

```json
{
  "episode_id": "uuid",
  "client_id": "uuid",
  "goal": "Create a 7-day plan and generate assets for IG Reels + TikTok",
  "platform_targets": ["instagram", "tiktok"],
  "lanes_allowed": ["api", "browser"],
  "budgets": {
    "max_tokens": 24000,
    "max_tool_calls": 40,
    "max_wall_seconds": 900,
    "max_recursion_depth": 2
  },
  "outputs_required": [
    "plan_node",
    "asset_specs",
    "schedule_proposal",
    "verification_report"
  ],
  "approval_mode": "creation_requires_review",
  "risk_tier": "high"
}
```

### 6.3 ActionSpec (side-effect) — schema (template)

```json
{
  "action_type": "publish_post|publish_story|send_dm|reply_comment|like",
  "client_id": "uuid",
  "platform": "instagram",
  "platform_account_id": "uuid",
  "lane": "api|browser",
  "target": {
    "post_id": "string|null",
    "comment_id": "string|null",
    "dm_thread_id": "string|null",
    "profile_id": "string|null"
  },
  "payload": {
    "text": "string|null",
    "media_refs": ["asset://..."],
    "metadata": {}
  },
  "guardrails": {
    "requires_policy_allow": true,
    "requires_dry_run": true,
    "requires_operator_approval": false
  },
  "idempotency_key": "string",
  "trace_id": "string"
}
```

---

## 7) Context Capsules: how we keep prompts small

### 7.1 Capsule structure
A capsule is a compact, stable summary used across episodes.

- `BrandCapsule` (voice, offers, redlines, CTA style, examples)
- `KB Capsule` (top facts + FAQ summary)
- `Plan Capsule` (latest plan node summary + goals)
- `Asset Capsule` (existing reusable assets + template refs)
- `Engagement Capsule` (recent events, intents, unresolved threads)

### 7.2 Capsule freshness rules
- BrandCapsule updated only on onboarding edits
- KB Capsule updated when new sources added
- Engagement Capsule updated daily (or per check-in)

---

## 8) Tool usage in RLM mode (Tool Gateway pattern)

### 8.1 Tool gateway constraints
- tools are discovered and called through a single gateway (Docker MCP style)
- raw tool outputs go to external storage
- the agent receives:
  - a short summary
  - pointer(s) to full output
  - a validation receipt

### 8.2 Tool receipts (what returns to the model)

```json
{
  "tool": "browser_runner",
  "status": "ok|error",
  "summary": "Posted reel to IG via browser lane; got URL...",
  "pointers": ["artifact://run/123/log", "artifact://run/123/screenshot"],
  "metrics": {"duration_ms": 18422}
}
```

---

## 9) Verification: RLM-compatible self-checking

Every episode must produce a **Verification Report** with:
- schema validation status
- policy check results
- dry-run results (if side-effect)
- brand alignment lint (tone + redlines)
- duplication check (idempotency)
- tenancy boundary check

**Rule:** If verification fails, Orchestrator recurses to Verifier Agent and then either:
- auto-fix (low risk)
- request operator approval (high risk)

---

## 10) Implementation checklist (engineering)

To implement this architecture, engineers must:

1) Define JSON schemas for:
- task packet
- plan node
- asset spec
- action spec
- verification report
- commit bundle

2) Implement `RLMEnv` primitives (tool endpoints)

3) Implement capsule builders:
- BrandCapsule
- KBCapsule
- PlanCapsule
- EngagementCapsule

4) Implement the Orchestrator state machine

5) Wire budgets + recursion limits

6) Add evals:
- golden path episodes
- policy regression
- brand drift regression
- tenancy boundary regression

---

## 11) Post‑MVP extensibility patterns

This architecture supports:

- adding new platforms (new connectors + new lane policies)
- adding new blueprint families (new Creator subagents)
- client logins (same capsule model; new RBAC)
- metrics/experimentation OS (attach outcomes to plan nodes)
- new model providers (router changes only)

---

## 12) Next docs (recommended)

- External Memory Schema (RLM core)
- Agent Recursion Contracts
- Evaluation Loops
- Cost & Latency Budgets
- Full Recursive System Diagram (conceptual)

