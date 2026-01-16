# Agent Tool Registry Specification (Tools + MCPs) — v1

This document defines the **tooling contract** for the MVP: which agents exist, what they do, what tools they can call, and the **rules that prevent context bloat, unsafe actions, and cross-client contamination**.

Design goals:
- **Extremely reliable** tool execution (deterministic + auditable)
- **Docker MCP as the only MCP entrypoint** (one tool in agent context)
- **Least privilege**: each agent gets only the tools it needs
- **BYOK isolation**: every tool call is bound to `client_id` + `provider_config`
- **Dual lanes**: API-first, Browser fallback
- **RLM aligned**: prefer summaries + file artifacts; never dump giant tool outputs into context

---

## 0) Definitions

### 0.1 Tool
A callable capability exposed to an agent.
- Example: `docker_mcp.runWorkflow('publish_instagram_reel')`

### 0.2 MCP server
A provider of multiple tools.
- Example: Chrome DevTools MCP provides tools for driving a browser.

### 0.3 Docker MCP “aggregation”
Docker MCP aggregates multiple MCP servers, allowing:
- dynamic tool discovery
- on-demand tool selection
- scripted workflows that keep large outputs out of model context

### 0.4 Workflow (scripted tool composition)
A deterministic sequence of tool calls.
- Example: “Publish IG Reel via browser lane”
  1) open profile
  2) navigate to IG
  3) upload media
  4) paste caption
  5) publish
  6) store screenshot evidence

---

## 1) Tooling architecture (how tools are exposed)

### 1.1 Agent sees only one MCP tool
Agents do **not** connect to 5–10 MCP servers directly.

**Agent context contains:**
- `docker_mcp` (single endpoint)
- minimal native tools (read/write DB via internal API, S3 upload, logging)

**Agent does NOT contain:**
- direct Chrome MCP
- direct GHL MCP
- direct scraping MCP

Instead:
- agent calls **Docker MCP** to discover/select tools
- agent triggers a **workflow** that runs tools and stores artifacts

### 1.2 Artifact-first strategy
All heavy outputs should go to artifacts:
- JSON files in S3
- screenshots
- DOM snapshots
- run logs

Agent receives:
- a **small summary** (status, key identifiers, artifact pointers)

---

## 2) Core agent roster (MVP)

The MVP uses a **small number of well-scoped agents**. Each agent has:
- mission
- inputs
- outputs
- allowed tools
- disallowed tools
- autonomy level

### 2.1 Orchestrator Agent (Supervisor)
**Purpose:** Owns job execution, assigns subagents, validates outputs.

**Inputs:**
- Job payload (PlanJob/CreateAssetsJob/PublishJob/EngagementJob)
- Client context pointer (client_id)

**Outputs:**
- Completed job state
- Run summary + artifact pointers

**Allowed tools:**
- `db.read/write` (via internal API)
- `queue.enqueue` / `queue.retry`
- `docker_mcp.discover_tools` (read-only)
- `docker_mcp.run_workflow` (execute)
- `s3.put/get`
- `logger.audit`

**Disallowed:**
- direct browser control (must be workflow)
- direct social posting calls (must be workflow)

**Autonomy:** full within policy constraints

---

### 2.2 Planner Agent
**Purpose:** Generate plan graphs that map objectives → platforms → blueprint selections.

**Inputs:**
- BrandKit summary
- KB summary
- Objective template
- Constraints (cadence, offers, compliance)

**Outputs:**
- PlanGraph: Plan + PlanNodes + Edges
- Recommended blueprint(s) per node
- Risk flags (compliance, sensitivity)

**Allowed tools:**
- `db.read` (BrandKit/KB/Policies)
- `db.write` (Plan/Nodes/Edges)
- `s3.put` (plan export)

**Disallowed:**
- publishing/engagement
- browser automation

**Autonomy:** allowed

---

### 2.3 Copy & Caption Agent
**Purpose:** Write platform-specific copy variants aligned to brand voice + goal.

**Inputs:**
- PlanNode payload
- Blueprint contract
- Brand voice + redlines
- Offer + CTA style

**Outputs:**
- Captions, hooks, CTAs
- Hashtag sets (optional)
- Variant metadata (length, tone)

**Allowed tools:**
- `db.read/write` (AssetVariant)
- `s3.put` (copy packs)

**Disallowed:**
- direct publishing

---

### 2.4 Creative Prompt Agent (Image/Video)
**Purpose:** Convert plan intent → media generation prompts & specs.

**Inputs:**
- Blueprint contract
- Brand visual tokens
- Output requirements by platform (ratio, length)

**Outputs:**
- Prompt set(s)
- Style constraints
- Shot lists (for video)

**Allowed tools:**
- `db.read/write` (VideoPrompt / Asset metadata)
- `s3.put` (prompt bundle)

**Disallowed:**
- generating media directly (must trigger workflows)

---

### 2.5 Media Pipeline Agent (Runner)
**Purpose:** Execute generation workflows (images, silent-first video clips, HeyGen avatar).

**Inputs:**
- Prompt bundle
- ProviderConfig (video.gen/image.gen/avatar.gen)
- Blueprint run plan (how many variants)

**Outputs:**
- Artifacts in S3 (mp4/png/jpg)
- Checksums + metadata
- QA signals (duration, resolution)

**Allowed tools:**
- `docker_mcp.run_workflow('generate_images')`
- `docker_mcp.run_workflow('generate_video_clips_silent')`
- `docker_mcp.run_workflow('stitch_video_timeline')`
- `docker_mcp.run_workflow('heygen_avatar_generate')`
- `s3.put/get`
- `db.write`

**Disallowed:**
- planning
- publishing

---

### 2.6 QA & Policy Agent
**Purpose:** Enforce compliance, brand rules, formatting rules, and publish readiness.

**Inputs:**
- Draft assets + variants
- Brand redlines
- Platform constraints
- Autonomy policies

**Outputs:**
- QA score + pass/fail
- Fix list (deterministic)
- Required human review flags

**Allowed tools:**
- `db.read/write` (Approval, QA fields)
- `s3.put` (QA report)

**Disallowed:**
- publishing

---

### 2.7 Publisher Agent
**Purpose:** Publish scheduled calendar items via the correct lane, capturing proof.

**Inputs:**
- CalendarItem
- AssetVariant + Artifacts
- PlatformAccount + lane preference
- ProviderConfig publish lanes

**Outputs:**
- PublishRun: success/fail
- External references (post_id/url when available)
- Proof artifacts (screenshots/log)

**Allowed tools:**
- `docker_mcp.run_workflow('publish_via_api')`
- `docker_mcp.run_workflow('publish_via_browser')`
- `db.read/write` (CalendarItem, PublishRun)
- `s3.put` (screenshots/logs)

**Disallowed:**
- planning

---

### 2.8 Engagement Agent
**Purpose:** Handle comments/DMs/community events with guardrails and memory summaries.

**Inputs:**
- EngagementEvent
- ThreadSummary
- BrandKit + KB
- Policies + escalation rules

**Outputs:**
- Reply action (like/reply/dm)
- Escalation ticket when needed
- Updated ThreadSummary

**Allowed tools:**
- `docker_mcp.run_workflow('engage_via_api')`
- `docker_mcp.run_workflow('engage_via_browser')`
- `db.read/write` (EngagementEvent, ThreadSummary, Escalation)
- `s3.put` (run artifacts)

**Disallowed:**
- publishing content

---

## 3) MCP tool catalog (behind Docker MCP)

### 3.1 Chrome DevTools MCP (Browser Lane)
**Capabilities (MVP):**
- open profile session
- navigate, click, type, upload
- read DOM content
- take screenshots
- export DOM snapshots

**Required for:**
- Stories posting
- Skool engagement actions
- UI-only flows

**Rules:**
- Must run via Runner + Profile Vault
- Must store screenshot proof at publish/engage completion

---

### 3.2 GoHighLevel MCP (Optional accelerator)
**Use when it reduces build time:**
- calendar scheduling
- message routing
- inbox views (if needed)

**Rules:**
- UI must still show a unified calendar, even if GHL is backing some scheduling
- Avoid “lock-in” architecture: keep our DB as source of truth

---

### 3.3 Media generation MCP workflows
These may wrap external APIs (image/video/avatar).

**Examples:**
- `generate_images` (Gemini / other)
- `generate_video_clips_silent` (4–8s, no audio)
- `stitch_video_timeline` (ffmpeg + render variants)
- `heygen_avatar_generate`

**Rules:**
- outputs go to S3
- agent receives only summary + pointers

---

## 4) Required workflows (scripted tool compositions)

### 4.1 Workflow: `open_profile_session`
**Inputs:** client_id, platform
**Steps:**
1) select profile from vault
2) open isolated browser context
3) verify login state
**Outputs:** session_handle + screenshot proof

### 4.2 Workflow: `publish_instagram_story`
**Inputs:** media_url, caption, client_id
**Steps:** open profile → IG → create story → upload → publish
**Outputs:** post proof screenshot + run log

### 4.3 Workflow: `publish_reel` (IG/FB)
**Inputs:** video_url, caption, hashtags, client_id
**Steps:** open profile → upload → metadata → publish
**Outputs:** URL or proof + log

### 4.4 Workflow: `skool_reply_and_dm_router`
**Inputs:** thread_ref, reply_text, keyword_rules
**Steps:** open profile → locate thread → reply → DM when rules match
**Outputs:** screenshots + updated thread refs

---

## 5) Safety, isolation, and context-control rules (non-negotiable)

### 5.1 Client isolation
- Every job is tagged with `client_id`
- Every workflow requires `client_id`
- Browser profile is selected by `client_id + platform`
- Secrets are resolved by `CredentialRef` scoped to client

### 5.2 Least privilege
- Agents cannot call tools outside their role
- Publisher/Engagement cannot alter BrandKit/KB

### 5.3 Context bloat prevention
- Workflows store bulk outputs to S3
- Agent receives only:
  - status
  - key IDs
  - artifact pointers

### 5.4 Evidence artifacts
- Any publish/engage action must produce:
  - screenshot proof
  - run log
  - external reference when available

---

## 6) MVP acceptance criteria (tooling)
- Docker MCP is the only MCP endpoint exposed to agents
- At least 3 end-to-end workflows working:
  1) Plan → Create (static post)
  2) Approve → Schedule → Publish (IG/FB)
  3) Ingest comment → Reply/DM (with summary update)
- Browser lane can:
  - open correct profile
  - publish at least one story type
  - reply in Skool

---

## 7) Next document
**Browser automation design (profile vault + runner)**

