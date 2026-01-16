# Map RLM → Agent Prompt Architecture — v1

This document maps the **Recursive Loop Model (RLM)** we’re building into a **concrete prompt architecture** that is:
- reliable under heavy tool use
- bounded in context + cost
- auditable (evidence-first)
- modular (agents can be swapped without rewriting everything)

It is designed to work with:
- **Docker MCP Toolkit** as the single MCP gateway (tool discovery + interception + least-privilege)
- a **Next.js control plane** (agency-operated)
- external memory (PlanGraph, AssetGraph, Conversation summaries, Engagement events)

---

## 0) RLM concept in our platform

RLM is implemented as repeatable **episodes**.

**Episode loop (canonical):**
1) **Retrieve** minimal relevant memory
2) **Reason** (plan inside the episode scope)
3) **Act** (tools or write outputs)
4) **Evaluate** (preflight or postflight)
5) **Recurse** (retry/fix) *or* **Escalate** *or* **Stop**

**Key rule:** recursion is controlled by contracts + budgets (see Agent Recursion Contracts & Cost Budgets docs).

---

## 1) Prompt architecture layers

Every agent prompt is composed from the same layers. This is the “stack” that makes the system predictable.

### Layer A — Global System Policy (platform-wide)
**Purpose:** enforce non-negotiables across all agents.

Contents:
- Safety + compliance: never break client redlines
- Secrets: never output raw secrets; only use CredentialRefs
- Evidence rule: store large tool outputs externally; bring back summaries
- Budget rule: stop if caps hit
- Tool rule: use **Docker MCP Gateway**; do not call individual MCP servers directly
- Output rule: always produce structured outputs

### Layer B — Agent Identity + Role Charter
**Purpose:** make the agent good at one job, not everything.

Contents:
- mission
- scope boundaries
- what success looks like
- what it must never do

### Layer C — Task Directive (episode-specific)
**Purpose:** provide the immediate job in executable terms.

Contents:
- objective
- inputs (memory object IDs)
- expected outputs (schemas)
- deadlines/latency class (UI vs async)

### Layer D — Constraints Snapshot
**Purpose:** stop hallucination and drift.

Contents:
- BrandKit voice + offers + visual tokens
- Autonomy policy and lane configuration (API/browser/hybrid)
- Platform constraints (length, ratios, story rules)
- Compliance disclaimers/redlines

### Layer E — Minimal Memory Injection
**Purpose:** provide just enough state.

Rules:
- Prefer summaries over raw
- Include only the relevant plan nodes or thread summary
- Include links/URIs to artifacts for deeper inspection

### Layer F — Tool Guidance (with discovery)
**Purpose:** ensure the agent selects the correct tool *without context bloat*.

Mechanism:
- The agent sees **one tool**: Docker MCP Gateway
- It requests tool discovery for the task (“show tools relevant to publishing IG story”)
- The gateway returns a small tool shortlist (names + 1-line descriptions)

### Layer G — Output Schema + Validation Hooks
**Purpose:** structured outputs and deterministic checks.

Contents:
- JSON schema
- required fields
- error format
- self-check checklist

### Layer H — Self-critique & Decision Gate
**Purpose:** decide pass/retry/escalate/stop.

Mechanism:
- produce output
- run internal checklist
- if failing → produce FixList and mark retry needed

---

## 2) “Prompt Contract” template (universal)

Use this template for every agent.

```text
[SYSTEM POLICY]
- (global rules)

[ROLE CHARTER]
- You are {AgentName}. Your mission is {…}
- You may read: {R0–R3 classes}
- You may write: {W1–W3}; Side effects: {none/W4 gated}
- Stop conditions: {…}

[TASK DIRECTIVE]
Objective: …
Inputs: …
Outputs required: …
Latency class: UI|async|browser
Budget: tokens/tool calls/time

[CONSTRAINTS SNAPSHOT]
BrandKit: …
Policies: …
Platform constraints: …
Compliance: …

[MEMORY INJECTION]
- Plan summary: …
- Relevant nodes: …
- Conversation summary (if applicable): …
- Evidence URIs: …

[TOOLS]
You have access ONLY to DockerMCPGateway.
1) Discover tools relevant to your task.
2) Use the smallest set of tools necessary.
3) Save large outputs externally and summarize.

[OUTPUT FORMAT]
Return ONLY valid JSON matching this schema: …

[SELF-CHECK]
Before returning:
- Did I follow BrandKit + policies?
- Did I avoid prohibited claims?
- Did I keep within budget?
- Did I include FixList if anything is missing?
```

---

## 3) Tooling patterns that reduce context + increase reliability

### 3.1 Docker MCP Gateway pattern
**Goal:** expose one gateway tool, not 5–50 separate MCP servers.

Agent behavior:
1) Ask gateway to **search tools** relevant to task
2) Choose minimal tool shortlist
3) Execute workflow via **runner scripts** where possible
4) Store full outputs in external artifacts (S3/files)
5) Inject only compact summaries back into the episode

### 3.2 Programmatic tool workflows (preferred)
For multi-step operations (posting, scraping, bulk engagement):
- do not have the LLM micromanage 20 tool calls
- have the LLM generate a **workflow intent** + parameters
- a worker (JS/Python) executes the steps
- LLM receives: status + evidence + next decision options

### 3.3 Tool documentation is part of the prompt
Every tool must have:
- purpose
- required inputs
- outputs
- failure modes
- safety constraints

---

## 4) Mapping RLM memory types → prompt injection

We inject memory differently per lane.

### 4.1 Planning Lane
Inject:
- BrandKit summary
- enabled blueprints
- constraints
- prior performance highlights (top 3)

Never inject:
- raw assets
- long transcripts

### 4.2 Creation Lane
Inject:
- one PlanNode blueprint instance
- style tokens
- offer + CTA
- prior winning examples (small)

### 4.3 Publishing Lane
Inject:
- PublishPackage only (exact caption + asset URIs)
- lane choice (API/browser)
- verification checklist

### 4.4 Engagement Lane
Inject:
- Thread summary_short
- last N events (bounded)
- KB facts relevant to the question
- escalation policies

---

## 5) Agent prompt skeletons (MVP)

Below are concrete skeletons you can turn into Claude Code subagents or Agent SDK prompts.

### 5.1 StrategyPlanner prompt skeleton
**Inputs:** BrandKit, KB summaries, enabled blueprints, goals, time window.

**Output:** PlanGraph nodes/edges + rationale.

```json
{
  "plan_id": "uuid",
  "window": {"start":"YYYY-MM-DD","end":"YYYY-MM-DD"},
  "objectives": ["lead_gen","engagement","authority"],
  "nodes": [
    {
      "node_id": "uuid",
      "blueprint": "short_reel_hook_value_cta",
      "platforms": ["instagram","tiktok"],
      "topic": "string",
      "hook": "string",
      "cta": {"type":"comment_keyword","keyword":"ESTIMATE"},
      "constraints": {"max_seconds": 30},
      "acceptance_criteria": ["string"],
      "risk_flags": []
    }
  ],
  "edges": [{"from":"uuid","to":"uuid","type":"depends_on"}],
  "rationale": "string",
  "next_actions": ["schedule","create_assets"],
  "decision": "pass|retry|escalate",
  "fix_list": []
}
```

### 5.2 Copywriter prompt skeleton
**Inputs:** PlanNode + BrandKit.

**Output:** caption variants + headline + CTA block + platform formatting.

```json
{
  "asset_id": "uuid",
  "node_id": "uuid",
  "platform": "instagram",
  "variants": [
    {
      "variant_id": "uuid",
      "hook": "string",
      "caption": "string",
      "cta": "string",
      "hashtags": ["string"],
      "compliance": {"disclaimer_included": true, "prohibited_claims": []},
      "quality_score": 0,
      "notes": "string"
    }
  ],
  "decision": "pass|retry|escalate",
  "fix_list": []
}
```

### 5.3 PromptWriter (video/image) skeleton
**Inputs:** storyboard entry + style tokens + provider config.

**Output:** PromptArtifact(s) with strict templates.

```json
{
  "prompt_artifact_id": "uuid",
  "asset_id": "uuid",
  "provider": "google|kie|heygen",
  "model": "string",
  "mode": "text2video|image2video|text2image|avatar",
  "prompt": "string",
  "constraints": {"ratio":"9:16","duration_seconds":8,"audio":"silent"},
  "lint": {"passes": true, "warnings": []},
  "decision": "pass|retry|escalate",
  "fix_list": []
}
```

### 5.4 QAEditor skeleton (Evaluation loop bridge)
**Inputs:** Draft assets.

**Output:** EvaluationReport + deterministic FixList.

```json
{
  "report_id": "uuid",
  "subject_type": "asset",
  "subject_id": "uuid",
  "stage": "preflight",
  "score_total": 0,
  "checks": [{"name":"compliance_disclaimer","category":"compliance","status":"pass"}],
  "decision": "pass|retry|escalate|fail",
  "fix_list": [
    {"field":"caption","instruction":"Add disclaimer line X to the end.","acceptance":"Caption ends with disclaimer exactly."}
  ],
  "evidence_uris": []
}
```

### 5.5 PublisherBrowser skeleton
**Inputs:** PublishPackage + profile vault ref + lane rules.

**Output:** publish_run + evidence.

```json
{
  "publish_run_id": "uuid",
  "platform": "instagram",
  "lane": "browser",
  "profile_ref": "profile://client/ig/main",
  "publish_package": {"caption":"string","media_uris":["s3://..."],"type":"story|reel|post"},
  "actions": ["login","navigate","upload","set_caption","publish"],
  "result": {"status":"success|failed","post_url":"string"},
  "evidence_uris": ["s3://evidence/screenshot1.png"],
  "decision": "pass|retry|escalate",
  "fix_list": []
}
```

### 5.6 Engagement agent skeleton (CommentResponder)
**Inputs:** thread summary + last N events + policy.

**Output:** reply draft or send action request.

```json
{
  "thread_id": "uuid",
  "platform": "skool",
  "intent": "answer|clarify|route|deescalate",
  "reply": "string",
  "confidence": 0.0,
  "risk_flags": ["pricing|complaint|refund|medical|legal"],
  "action": "draft_only|post_reply|escalate",
  "escalation_payload": {"summary":"string","recommended_reply":"string"},
  "decision": "pass|retry|escalate",
  "fix_list": []
}
```

---

## 6) Prompt architecture for the VSL Pipeline inside this platform

Your existing VSL pipeline becomes a **Blueprint family** (Video Series / VSL Segment Series).

Prompt architecture mapping:
- StrategyPlanner creates a PlanNode: `vsl_segment_series`
- PromptWriter generates segment prompts (silent-first)
- VideoAssembler runs the heavy workflow in code (workers)
- QAEditor checks technical + narrative continuity
- PublishPackage composes:
  - stitched reel(s)
  - captions
  - thumbnail
  - story cutdowns

**Key rule:** the LLM should output **parameters**, not run long generation loops.

---

## 7) Post-MVP prompt architecture patterns

### 7.1 Reflexion-style memory notes
After failures or significant successes, an agent writes:
- what happened
- why it happened
- what to do next time

Stored as `EpisodicMemory` linked to blueprint + platform + offer.

### 7.2 Multi-agent “committee” evaluation
For high-risk items (regulated clients, ads, sensitive replies):
- run 2–3 evaluators
- require consensus or human review

### 7.3 Continuous prompt regression tests
Maintain a test suite:
- golden prompts
- expected schema outputs
- failure-case prompts

Run whenever tools/models change.

---

## 8) Implementation Notes (how to build this in Claude Code + CLI agents)

### 8.1 Subagents
Each agent becomes a Claude Code subagent with:
- role charter
- allowed tools (Docker MCP only)
- output schema

### 8.2 Orchestration
The Orchestrator:
- loads memory pointers
- assembles prompt layers A–H
- runs episode
- logs episode + outputs
- triggers QA + recursion

### 8.3 Minimal context enforcement
At prompt assembly time:
- enforce max memory injection size
- include only the required objects
- store raw data externally

---

## 9) Definition of Done (MVP)

This prompt architecture is MVP-ready when:
- every agent output is schema-validated
- side effects require PolicyGuard approval
- recursion is bounded and logged
- tool discovery works through Docker MCP gateway
- any episode can be replayed from memory

---

## 10) Next Document
**Full Recursive System Diagram (Conceptual) — v1**

