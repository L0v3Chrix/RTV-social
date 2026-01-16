# Agent Recursion Contracts — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose:** Define the **hard contracts** that govern when agents are allowed to recurse, what they may read/write, how recursion is bounded, and how we prevent runaway loops—especially in a system that performs **real-world side effects** (posting, commenting, DMs, likes) across **API + Browser lanes**.

This document assumes you already have:

- External Memory Schema (Plan Graph, Asset Graph, Conversation Summaries, Engagement Events)
- A Tool Gateway + MCP registry (Docker MCP or equivalent)
- Policy engine (compliance + autonomy levels)
- Observability + audit events

---

## 0) Definitions

- **Agent:** An LLM-driven component that proposes or executes work.
- **Episode:** One bounded agent run with a single goal and explicit budget.
- **Recursion:** The agent spawning sub-episodes to solve subproblems.
- **Capsule:** A bounded summary pointer the agent loads instead of full context.
- **Side-effect:** Any operation that changes external state (publish, DM, like, comment, follow, token refresh, browser clicks).

---

## 1) Non‑negotiable constraints (global rules)

1) **Deny-by-default recursion**
- Recursion is not “allowed” unless the episode’s recursion policy explicitly permits it.

2) **Single-owner write rule**
- Only one designated agent may write to a domain per episode (e.g., only PlanAgent may write PlanGraph nodes).

3) **Read bounded, write append-only**
- Agents request capsule refs and small slices. Large blobs remain external.
- Writes create new versions; never mutate history.

4) **No direct side effects without policy decision**
- Any side-effect requires a recorded `PolicyDecision(allow)` AND a `DryRun` where supported.

5) **Human control points exist by design**
- Every lane includes explicit “manual review” states.

---

## 2) Agent taxonomy (roles + responsibilities)

### 2.1 Orchestrator (Master)
**Goal:** Decompose work into atomic sub-episodes, enforce budgets, and coordinate outputs.

- Reads: all capsules + job state.
- Writes: `episode_run`, orchestration journal, task packets.
- Cannot: publish/DM/like/comment directly.

### 2.2 Planner Agent
**Goal:** Generate or revise a plan graph node.

- Reads: Brand capsule, KB capsule, prior plan nodes, engagement capsule.
- Writes: `plan_node`, `plan_edge`, `plan_variant`, schedule proposals.

### 2.3 Creator Agent (Blueprint executor)
**Goal:** Produce assets (copy/images/clips) for a blueprint.

- Reads: plan node, blueprint spec, brand visual tokens, KB facts, template refs.
- Writes: assets + asset edges, asset bundles, verification requests.

### 2.4 Publisher Agent
**Goal:** Convert approved bundles into publish payloads + schedule items.

- Reads: asset bundle, platform capabilities, lane preference, policy bundle.
- Writes: publish payload snapshot, schedule items.
- Side effects: allowed ONLY when flags + policy allow.

### 2.5 Engagement Agent
**Goal:** Respond to engagement events (comments/DMs/Skool threads) safely.

- Reads: engagement events, conversation summaries, escalation rules.
- Writes: engagement actions, conversation summary updates, handoff tickets.
- Side effects: allowed ONLY when policy allow + safety checks pass.

### 2.6 Verifier Agent
**Goal:** Prove correctness (tests, payload validation, platform verification, drift detection).

- Reads: tool receipts, screenshots, publish IDs, DOM snapshots, queue state.
- Writes: verification reports, alerts, regression test results.
- Cannot: create plans or creative beyond minimal diagnostic output.

### 2.7 Doc Agent
**Goal:** Append documentation and maintain ADR/journal continuity.

- Reads: PR diffs, episode summaries, decisions.
- Writes: docs/journal entries, ADR drafts.

---

## 3) Recursion permission model

Recursion is controlled by a **RecursionPolicy** attached to every episode.

### 3.1 RecursionPolicy (required fields)

- `max_depth` (default 2; hard max 4)
- `max_children` (default 6)
- `max_total_episodes` (default 12)
- `allowed_child_types[]` (e.g., `verify`, `retrieve`, `summarize`, `rewrite`, `tool_probe`)
- `forbidden_child_types[]` (e.g., `publish`, `engage` unless explicitly authorized)
- `stop_conditions[]` (see §6)

### 3.2 “Recursion classes” (what recursion is for)

**Class A — Retrieval recursion**
- Build capsules, locate facts, gather examples, fetch tool capabilities.

**Class B — Critique recursion**
- Self-review outputs against rubrics (tone, policy, platform specs).

**Class C — Repair recursion**
- Fix a failed step (selector drift, API error, invalid payload).

**Class D — Verification recursion**
- Confirm published content is visible, metadata correct, no duplicates.

**Rule:** Class D is always preferred over Class C when side effects happened.

---

## 4) Read/Write contracts by domain

### 4.1 Plan Graph
- **Writer:** Planner Agent only.
- **Readers:** Orchestrator, Creator, Publisher, Engagement, Verifier.
- **Write guardrails:**
  - Plan nodes must cite pointers (capsules, engagement summaries) in their metadata.
  - Plan edges must include rationale + evidence refs.

### 4.2 Asset Graph
- **Writer:** Creator Agent only (except Publisher may attach publish payload snapshot refs).
- **Readers:** all.
- **Write guardrails:**
  - Every generated asset must record: blueprint type, plan id, prompt ref(s), provider config ref, hash.

### 4.3 Conversation Summaries
- **Writer:** Engagement Agent + Verifier Agent (resolution summaries) + Operator UI.
- **Readers:** Planner (to adapt strategy), Creator (to reflect voice insights).
- **Write guardrails:**
  - Summaries must be bounded.
  - Any raw payload pointers must be redacted.

### 4.4 Engagement Events
- **Writer:** Ingestion system only.
- **Readers:** Engagement, Planner.
- **Write guardrails:**
  - No agent may alter event truth; agents can only annotate (labels/risk flags) via separate tables.

### 4.5 Policy + Flags
- **Writer:** Human operator only (or privileged Policy Admin).
- **Readers:** all agents.
- **Write guardrails:**
  - Policy changes create versioned bundles.

---

## 5) Recursion triggers (what causes sub-episodes)

Agents may recurse only on explicit triggers:

### 5.1 Retrieval triggers
- Missing a required capsule (brand/KB/plan/engagement)
- Missing platform capability confirmation (API vs browser lane)
- Missing template refs for blueprint

### 5.2 Critique triggers
- Output fails rubric (tone/policy/platform constraints)
- High-stakes action planned (DM/publish) requires a second-pass review

### 5.3 Repair triggers
- Tool call fails with retryable class (timeout, 429, transient)
- Browser lane drift detected
- Payload validation fails

### 5.4 Verification triggers
- Side-effect attempted
- Queue reports success but platform visibility uncertain
- Duplicate-risk detected (same asset hash + same schedule window)

---

## 6) Stop conditions (how recursion ends)

Every episode must stop when any condition is met:

1) **Budget exhausted** (tokens, tool calls, time)
2) **Depth exceeded**
3) **No new information** (two consecutive children return “no delta”)
4) **Failure repeats** (same error class N times)
5) **Policy blocks** (deny/needs approval)
6) **Success achieved** (objective satisfied + verifier passes)

**Hard rule:** any side-effect lane stops if kill switch is toggled.

---

## 7) Budgeting + escalation linkage

Recursion contracts integrate with cost/latency budgets:

- A child episode may not exceed **50%** of the parent’s remaining budget.
- Any episode that crosses **70%** of budget must either:
  - produce a final answer OR
  - escalate to human with a structured handoff ticket.

---

## 8) Side-effect recursion rules (highest risk)

### 8.1 Publish recursion
Publishing is never “recursive by default.”

Allowed publish recursion patterns:

- **Dry-run → Verify payload → Execute publish → Verify visibility**
- If verification fails: **Verifier** recurses, not Publisher.

### 8.2 Engagement recursion
Engagement recursion is allowed for:

- intent classification
- drafting reply candidates
- policy compliance checks

But not for “sending repeatedly.”

**Rule:** Only one send attempt per event per idempotency key unless a human explicitly overrides.

### 8.3 Browser lane recursion
Browser lane recursion is constrained:

- Must run in sandbox targets first when possible.
- Must generate drift evidence (screenshots, DOM hash).
- Must fall back to manual review when selectors are unstable.

---

## 9) Contracts for subagents (Claude Code / Agent SDK alignment)

If using Claude Code subagents:

- Each subagent must declare:
  - `allowed_tools[]`
  - `read_scopes[]` (which capsules)
  - `write_scopes[]` (which domains)
  - `permission_mode` (no side effects unless explicitly granted)

**Rule:** Subagents default to **read-only** and escalate side effects to the parent.

---

## 10) Standard outputs (what every episode must emit)

Each episode must write an `EpisodeResult` with:

- `status`: ok | needs_review | failed
- `summary`: 3–8 lines
- `artifacts_created[]`: pointers
- `decisions[]`: (policy decisions, rationale)
- `verification_needed`: true/false
- `next_actions[]`: structured task packets for child episodes or humans

---

## 11) Implementation checklist (MVP)

1. Implement `RecursionPolicy` structure and enforce it in the Runner
2. Implement domain-specific write locks (PlanGraph writer, AssetGraph writer, etc.)
3. Add stop condition enforcement (depth, budget, repeated failure)
4. Add idempotency registry enforcement for publish/engagement
5. Add Verifier-first verification path for side effects
6. Add human escalation (handoff ticket) templates

---

## 12) Post‑MVP extensibility patterns

- Add **adaptive recursion** based on observed success rates (per tenant)
- Add **episode caching** (reuse verified capsules)
- Add **model router** for cheap subepisodes (haiku/mini) and strong parent runs (opus)
- Add **auto-tuning** of `max_children` and retry caps based on error budget burn

---

## 13) Next document

**Evaluation Loops — v1** (how agents self-critique + how humans intervene + when to stop)

