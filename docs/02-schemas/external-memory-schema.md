# External Memory Schema (RLM Core) — v1

This document specifies the **External Memory layer** for the Raize The Vibe Autonomous Social Media Automation platform, designed to support:
- **MVP reliability** (Planning → Creation → Publishing → Engagement)
- **RLM-style recursion** (bounded context, iterative tool use, replayable episodes)
- **Post‑MVP extensibility** (episodic memory, long-term snapshots, cross-agent linking)

The external memory layer is the system’s **source of truth** for state, evidence, and summaries. Agents are **stateless by default** and must rely on external memory for recall.

---

## 0) Core Principles

### 0.1 Bounded-context by design
Agents must not depend on large in-context history. Instead:
- store rich artifacts externally (S3/object storage)
- store *small, structured* records + *high-signal summaries* in the DB
- retrieve only what is needed for a task episode

### 0.2 Replayability
Every important agent episode must be replayable:
- inputs, tool calls, outputs, and decisions are logged
- artifacts and evidence are immutable where possible

### 0.3 Explainability + audit
For any published asset or engagement action we must answer:
- why did we do this?
- what sources and constraints were used?
- what evidence shows it worked?

### 0.4 Multi-tenant client isolation
All memory is scoped by `client_id` and access-controlled by:
- tool permissions
- query filters
- profile vault isolation

### 0.5 Human-editable, agent-readable
Key schemas (BrandKit, KB, Autonomy Policies, Blueprint overrides) must be editable by humans and reliably read by agents.

---

## 1) Storage Topology

### 1.1 Primary stores
**Postgres (or equivalent relational DB)**
- structured records
- relationships/graphs
- indexes for retrieval

**Object storage (S3/R2/GCS)**
- large artifacts: images, videos, transcripts, DOM snapshots, screenshots, long JSON

**Vector index (optional MVP+, recommended post‑MVP)**
- semantic retrieval over KB summaries and conversation snippets
- must store embeddings per client

### 1.2 Artifact addressing
All large artifacts are stored by reference:
- `artifact_uri`: `s3://bucket/client/{client_id}/...`
- DB stores metadata only

---

## 2) Memory Domains (MVP Core)

The external memory has 4 MVP domains:
1) **Plan Graph** (planning + intent)
2) **Asset Graph** (creative assets + variants + approvals)
3) **Conversation Memory** (DMs, comment threads, Skool threads)
4) **Engagement Events** (actions taken + outcomes + feedback)

These domains are linked via stable IDs.

---

## 3) Plan Graph Model

### 3.1 What the Plan Graph is
A Plan Graph is a **directed acyclic graph (DAG)** of intent:
- objectives → campaigns → blueprints → planned posts → required assets → approval → publish jobs

It enables:
- generating content from a plan with a single click
- tracing every asset back to the plan intent
- recursion: refine a failing plan node without rewriting everything

### 3.2 Plan Graph entities

#### 3.2.1 Plan
Represents a planned batch of content for a time window (e.g., “Feb Week 1”).

**Fields**
- `plan_id` (uuid)
- `client_id`
- `name`
- `time_window_start`, `time_window_end`
- `objective_tags` (leadgen, authority, community, retention)
- `target_platforms` (ig, fb, tiktok, linkedin, x, youtube, skool)
- `status`: draft | reviewed | approved | executing | complete | archived
- `summary` (short)
- `constraints_ref` (points to immutable snapshot of BrandKit/KB/Policies used)
- `created_by` (human|agent)
- `created_at`, `updated_at`

#### 3.2.2 PlanNode
Atomic node in the plan graph (campaign/blueprint/post/etc.).

**Fields**
- `node_id` (uuid)
- `plan_id`
- `client_id`
- `node_type`: objective | campaign | blueprint_instance | post_intent | asset_requirement | approval_gate | publish_job
- `title`
- `inputs` (jsonb) — parameters (e.g., blueprint type, CTA keyword, offer)
- `summary` (short, retrieval-optimized)
- `status`: pending | ready | blocked | failed | complete
- `quality_score` (0–100) — updated by evaluators
- `cost_estimate` (optional)
- `created_at`, `updated_at`

#### 3.2.3 PlanEdge
Directed relationship between nodes.

**Fields**
- `edge_id` (uuid)
- `plan_id`
- `from_node_id`
- `to_node_id`
- `edge_type`: depends_on | produces | refines | requires_approval | scheduled_for
- `created_at`

### 3.3 Constraints snapshots (critical)
When a plan is approved, we freeze a **Constraints Snapshot**.

#### ConstraintsSnapshot
- `snapshot_id`
- `client_id`
- `brandkit_version_id`
- `kb_version_id`
- `policies_version_id`
- `provider_config_version_id`
- `blueprint_set_version_id`
- `created_at`
- `notes`

This ensures the same plan can be replayed with the exact rules used.

### 3.4 Retrieval strategy for Plan Graph
When an agent starts an episode:
- load `Plan.summary`
- load 3–8 relevant `PlanNode.summary` nodes based on task
- load ConstraintsSnapshot references (not full KB)
- optionally retrieve detailed KB facts via retrieval pipeline

---

## 4) Asset Graph Model

### 4.1 What the Asset Graph is
The Asset Graph is a **versioned creative asset lineage**:
- from prompts → generated media → edits → final variants → approved publish package

It enables:
- tracking which media was used where
- preventing duplication
- attribution + proof for compliance
- post‑mortems when something fails (e.g., platform rejects video)

### 4.2 Asset entities

#### 4.2.1 Asset
A logical creative object.

**Fields**
- `asset_id`
- `client_id`
- `asset_type`: copy | image | video_clip | video_sequence | carousel | story | reel | caption_pack | hashtag_pack | vsl_segment_pack
- `source_blueprint_instance_id` (PlanNode)
- `status`: draft | generated | edited | approved | published | retired
- `title`
- `summary`
- `primary_artifact_uri` (S3 ref)
- `created_by` (agent|human)
- `created_at`, `updated_at`

#### 4.2.2 AssetVariant
Concrete version(s) of an asset for a platform or format.

**Fields**
- `variant_id`
- `asset_id`
- `platform`
- `format`: feed_post | reel | story | short | long | skool_post | comment_reply | dm_message
- `dimensions` (jsonb) — e.g., 1080x1920
- `duration_seconds` (optional)
- `caption_text` (optional, stored in DB if short)
- `artifact_uri` (S3 ref)
- `checksum` (for dedupe)
- `status`: pending | ready | failed | approved | published
- `created_at`, `updated_at`

#### 4.2.3 PromptArtifact
Stores prompts used for generation (LLM/image/video), plus model routing.

**Fields**
- `prompt_id`
- `client_id`
- `task_class`: llm.creator | image.gen | video.gen | avatar.gen
- `provider`, `model`, `params`
- `prompt_text_uri` (S3 ref)
- `input_refs` (jsonb) — pointers to KB facts, plan nodes, templates
- `output_refs` (jsonb) — produced assets/variants
- `created_at`

#### 4.2.4 ApprovalRecord
Represents a human approval gate.

**Fields**
- `approval_id`
- `client_id`
- `asset_id` or `variant_id`
- `required_by_policy` (bool)
- `status`: pending | approved | rejected
- `reviewer_user_id`
- `notes`
- `evidence_uri` (optional)
- `created_at`, `updated_at`

#### 4.2.5 PublishPackage
A bundle ready to publish.

**Fields**
- `package_id`
- `client_id`
- `plan_id`
- `target_platforms` (array)
- `variants` (array of `variant_id`)
- `scheduled_at` (optional)
- `status`: queued | scheduled | publishing | published | failed
- `created_at`, `updated_at`

---

## 5) Conversation Summaries (DM + Comments + Skool)

### 5.1 Why conversation summaries matter
Engagement automation is only safe if the system can:
- understand current thread state
- avoid repeating itself
- track commitments and promises
- escalate when needed

### 5.2 Conversation thread model

#### ConversationThread
Represents a logical thread on a platform.

**Fields**
- `thread_id`
- `client_id`
- `platform`: instagram|facebook|tiktok|linkedin|youtube|x|skool
- `thread_type`: dm | comment_thread | skool_thread
- `external_thread_ref` (string) — platform IDs/URLs
- `participant_external_ref` (string) — user ID/handle where available
- `status`: open | dormant | escalated | closed
- `last_event_at`
- `safety_flags` (jsonb)
- `summary_short` (<= 1–2 paragraphs)
- `summary_long_uri` (S3 ref, optional)
- `open_questions` (jsonb) — what we still need to resolve
- `handoff_state`: none | awaiting_human | completed

### 5.3 Conversation message/event model

#### ConversationEvent
Atomic inbound/outbound message.

**Fields**
- `event_id`
- `thread_id`
- `client_id`
- `platform`
- `direction`: inbound | outbound
- `event_type`: dm_message | comment | reply | reaction
- `text` (short text only) OR `text_uri` (S3 ref)
- `media_uris` (array)
- `metadata` (jsonb)
- `created_at`

### 5.4 Summarization strategy (RLM-compatible)

**When to summarize**
- every N events (e.g., 6)
- when thread becomes “hot” (rapid messages)
- when agent requests context and thread is long

**How to summarize**
- update `summary_short` with:
  - who the user is / what they want
  - what was offered
  - what is pending
  - sentiment/temperature
  - escalation triggers

**Store raw**
- full event text (or transcripts) stored in S3 when long

**Summaries are the retrieval default**
- raw is fetched only when needed

---

## 6) Engagement Events Memory

### 6.1 What engagement events are
Engagement events are the system’s record of actions taken and their outcomes.

They power:
- accountability and audit
- planner feedback loops (what performed)
- safety: detect spammy behavior

### 6.2 Engagement event model

#### EngagementEvent
Represents an action or observed metric.

**Fields**
- `engagement_id`
- `client_id`
- `platform`
- `event_kind`: like | comment_reply | dm_sent | dm_received | follow | unfollow | post_published | post_rejected | moderation_action | escalation
- `external_ref` (IDs/URLs)
- `actor`: ai | human | platform
- `linked_asset_id` / `variant_id` / `publish_run_id` (optional)
- `thread_id` (optional)
- `payload` (jsonb) — structured details
- `result`: success | fail | partial
- `failure_reason` (classification)
- `created_at`

### 6.3 Performance rollups
We maintain rollups to feed Planning/Creative decisions:

#### PerformanceMetric
- `metric_id`
- `client_id`
- `platform`
- `asset_id` / `variant_id` / `plan_id`
- `metric_type`: impressions | reach | likes | comments | shares | saves | clicks | replies | dm_starts
- `value`
- `window_start`, `window_end`

Rollups can be ingested from:
- platform APIs
- GoHighLevel analytics (if routed through GHL)
- scraping/browser lane evidence (last resort)

---

## 7) Agent Episode Logging (RLM “episodes”)

### 7.1 Why episodes exist
In an RLM system, each agent action is an **episode**:
- bounded context
- explicit goal
- tool calls
- outputs

This makes recursion measurable and safe.

#### AgentEpisode
- `episode_id`
- `client_id`
- `agent_name`
- `task_class`
- `trigger` (planner_tick | webhook_event | human_request | schedule)
- `input_refs` (jsonb)
- `retrieval_refs` (jsonb)
- `tool_call_log_uri` (S3)
- `output_summary` (short)
- `status`: success | failed | aborted | escalated
- `cost_tokens_est` (optional)
- `latency_ms`
- `created_at`

Episodes link to:
- PlanNodes
- Assets
- Conversations
- EngagementEvents

---

## 8) Post‑MVP Extensibility Patterns

### 8.1 Episodic memory
Add an **EpisodicMemory** layer that stores higher-level lessons:

#### EpisodicMemory
- `memory_id`
- `client_id`
- `scope`: global | client | platform | blueprint
- `lesson_type`: what_worked | what_failed | voice_guardrail | audience_insight
- `statement` (short)
- `evidence_refs` (links to metrics, episodes)
- `confidence` (0–1)
- `decay_policy` (how it expires)
- `created_at`, `updated_at`

### 8.2 Long-term snapshots
Every week or month, create **ClientSnapshot**:

#### ClientSnapshot
- `snapshot_id`
- `client_id`
- `time_window`
- `top_assets` (array)
- `top_lessons` (array)
- `risks` (array)
- `strategy_notes_uri` (S3)

### 8.3 Cross-agent linking
Allow any memory record to reference another by ID using a universal link schema:

#### MemoryLink
- `link_id`
- `client_id`
- `from_type`, `from_id`
- `to_type`, `to_id`
- `relation`: supports | contradicts | caused | derived_from | validates

### 8.4 Memory cleaning + decay
To avoid stale strategy:
- store `confidence` and decay over time
- retire lessons if they stop performing
- require evidence refresh to keep a lesson “active”

---

## 9) Minimal JSON Schemas (implementation starter)

### 9.1 PlanNode (json)
```json
{
  "node_id": "uuid",
  "plan_id": "uuid",
  "client_id": "uuid",
  "node_type": "blueprint_instance",
  "title": "IG Reel: Hook → Value → CTA",
  "inputs": {
    "blueprint": "short_reel_hook_value_cta",
    "cta_style": "comment_keyword",
    "offer": "Free Estimate",
    "platform": "instagram"
  },
  "summary": "Reel targeting homeowners; hook about water pressure; CTA comment 'PRESSURE' for DM.",
  "status": "ready",
  "quality_score": 86
}
```

### 9.2 ConversationThread (json)
```json
{
  "thread_id": "uuid",
  "client_id": "uuid",
  "platform": "instagram",
  "thread_type": "dm",
  "external_thread_ref": "ig:thread:123",
  "participant_external_ref": "ig:user:456",
  "status": "open",
  "summary_short": "User asked about pricing for tankless install. We explained estimate process and requested address. Awaiting reply.",
  "open_questions": ["Address", "Timeline"],
  "handoff_state": "none"
}
```

---

## 10) MVP Acceptance Criteria

External memory is MVP-ready when:
- Every Plan/Asset/Publish/Engagement action can be traced via IDs
- Every publish run has evidence artifacts (screenshots/logs where applicable)
- Conversation threads maintain a summary and do not require raw context by default
- Agent episodes are recorded with inputs, tool calls, and outputs
- Client isolation is enforced in all queries and storage paths

---

## 11) Next Document
**Agent Recursion Contracts — v1** (what each agent can read/write, recursion triggers, stop conditions).

