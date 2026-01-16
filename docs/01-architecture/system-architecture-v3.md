# System Architecture Diagram + Data Model — v3 (MVP, Blueprints, BYOK, Browser Lane)

This document is the **source-of-truth MVP architecture** for Raize The Vibe’s Autonomous Social Media Automation system.

Design goals:
- **Fastest reliable MVP** (agency-operated)
- **RLM-aligned**: bounded agent “episodes” + external memory (DB/S3), summaries > raw dumps
- **Docker MCP-first**: single MCP endpoint + dynamic tool discovery + scripted tool workflows
- **Dual execution lanes**: API-first where possible, Browser automation where APIs are missing/limited
- **Blueprint-driven**: all creation workflows are standardized “Creative Blueprints”
- **BYOK per client**: clients can bring their own LLM + media API keys (Keyring + Provider routing)

---

## 0) Core operating model

### 0.1 The 4 automation pillars
1) **Planning** → generate Plan Graph (what to post, why, when, where)
2) **Creation** → execute Creative Blueprints (assets + variants)
3) **Publishing** → schedule + publish runs (API lane, then browser fallback)
4) **Engagement** → ingest events + respond with guardrails (comments/DMs/community ops)

### 0.2 Creative Blueprints (the unit of automation)
A **Creative Blueprint** is a workflow contract that defines:
- required inputs (BrandKit + KB + objective + offer + constraints)
- outputs (copy, images, clips, thumbnails, captions, SRT)
- platform variants (format/ratio/length/CTA)
- QA gates + policy gates
- publish hooks + engagement hooks

### 0.3 Client Keyring (BYOK)
Each client has isolated provider configuration:
- LLM provider(s) for planning/creation/engagement
- Image provider(s)
- Video provider(s)
- Avatar provider(s) (HeyGen lane)

Credentials are stored as **references** to a secrets manager (never raw values in DB).

---

## 1) Runtime components (what runs where)

### 1.1 Next.js Web App (Vercel)
**Internal agency UI**:
- Client selector
- Plan builder + plan graph editor
- Blueprint runner + asset review/approval
- Calendar (single pane)
- Engagement console (events, threads, escalation)

### 1.2 Next.js API Routes (Vercel serverless)
Short-lived command endpoints:
- create plan
- create assets (blueprint runs)
- approve/reject assets
- schedule calendar items
- trigger publish now
- fetch engagement events

Writes state to DB + enqueues jobs (never runs long pipelines).

### 1.3 Worker Service (persistent container)
Runs long jobs + listeners:
- planning jobs
- creation pipelines (image/video)
- publishing execution
- engagement processing
- webhook handling + polling

Runs the **Agent Orchestrator** (Claude Agent SDK) and triggers **Docker MCP workflows**.

### 1.4 Queue + Scheduler
- durable jobs + retries
- delayed execution (publish at time T)
- fan-out patterns (plan → N blueprint runs)

### 1.5 Database: Postgres
Source of truth:
- clients + brand kit + KB
- keyring + provider routing
- plan graph
- blueprint definitions + versions
- assets + variants + approvals
- calendar items
- engagement events + thread summaries
- audit logs + run logs

### 1.6 Object storage (S3-compatible)
Stores artifacts:
- images/videos/thumbnails/SRT
- browser-run screenshots
- workflow logs and run outputs
- exports (ZIPs, CSVs, client handoffs)

### 1.7 Docker MCP Server (single endpoint)
- aggregates MCP servers
- tool discovery
- **scripted tool workflows** (JS) so large tool outputs stay out of model context

### 1.8 MCP servers behind Docker MCP (starter set)
- Chrome DevTools MCP (browser lane)
- GoHighLevel MCP (optional API lane accelerant)
- File system MCP (ops)
- Web/scrape MCP (optional)
- DB/query MCP (optional)

---

## 2) System diagram

```text
┌──────────────────────────────┐
│ Agency Staff (Internal Only) │
└───────────────┬──────────────┘
                │ HTTPS
┌───────────────▼──────────────┐
│ Next.js Web App (Vercel UI)  │
│ Plans • Blueprints • Assets  │
│ Calendar • Engagement Console│
└───────────────┬──────────────┘
                │ command API
┌───────────────▼──────────────┐
│ Next.js API Routes (Serverless)│
│ - auth + RBAC (internal)        │
│ - writes DB                     │
│ - enqueues jobs                 │
└───────┬───────────┬──────────┘
        │           │
   ┌────▼────┐  ┌──▼────────────┐
   │ Postgres │  │ Queue/Scheduler│
   │  State   │  │ Jobs + Delays  │
   └────┬────┘  └──┬────────────┘
        │           │ consumes
┌───────▼───────────▼──────────┐
│ Worker Service (Container)    │
│ - Agent Orchestrator          │
│ - Plan/Create/Publish/Engage  │
│ - Webhooks + polling          │
└───────────────┬──────────────┘
                │ single MCP endpoint
┌───────────────▼──────────────┐
│ Docker MCP Server             │
│ - tool discovery              │
│ - JS workflow execution       │
└───────┬───────────┬──────────┘
        │           │
┌───────▼───┐   ┌───▼───────────┐
│ GHL MCP   │   │ Chrome Dev MCP │
│ (optional)│   │ (browser lane) │
└───────┬───┘   └───┬───────────┘
        │           │ controls
┌───────▼───────────▼──────────┐
│ External Platforms            │
│ Meta • TikTok • YT • LinkedIn │
│ X • Skool                      │
└───────────────────────────────┘

S3/Object Storage used by UI/API/Worker for artifacts + logs + screenshots.
```

---

## 3) Execution lanes (API vs Browser)

### Lane A — API-first (preferred)
Use official APIs and/or GHL where it reduces build time.
- Publishing (when supported)
- Pulling comments/DMs (when supported)
- Replying/DM routing (when supported)

### Lane B — Browser automation (fallback + MVP-critical)
Used for:
- posting Stories (IG/FB)
- Skool deeper actions (liking, replying, DMs, moderating)
- UI-only operations where APIs are limited

Browser lane relies on:
- **Profile Vault**: pre-authenticated Chrome profiles per client/platform
- **Runner**: isolated session execution to avoid cross-client contamination
- **Artifacts**: screenshots + DOM snapshots + step logs for every run

---

## 4) Critical flows (sequence-level)

### A) Planning → Plan Graph
1. Staff: select Client + Objective Template
2. API: create Plan, enqueue PlanJob
3. Worker: load BrandKit + KB summaries + policy
4. Planner Agent: generate PlanGraph (nodes/edges) + recommended blueprint(s) per node
5. DB: persist plan graph
6. UI: edit/approve plan graph

### B) Creation → Blueprint Runs → Assets
1. Staff: select plan nodes → choose blueprint(s) → Create
2. API: enqueue CreateAssetsJob (fan-out)
3. Worker:
   - Copy Agent generates caption + CTA + variants
   - Media Agent generates prompts (image/video)
   - Docker MCP workflows generate media (silent-first videos, images)
   - Optional HeyGen lane generates presenter content
4. DB: Asset + AssetVariants + QA results
5. UI: review + approve

### C) Publishing → Calendar → Publish Runs
1. Staff schedules CalendarItems
2. Scheduler enqueues PublishJob at scheduled time
3. Worker attempts Lane A; falls back to Lane B if needed
4. Persist PublishRun (result + artifacts)

### D) Engagement → Events → Thread Summary
1. Ingest event (webhook/poll/browser scan)
2. Persist EngagementEvent + attach to ConversationThread
3. Engagement Agent loads bounded context:
   - BrandKit
   - KB slices
   - ThreadSummary + last N messages
4. Agent chooses action:
   - like/reply
   - DM keyword router
   - escalate to human
5. Update ThreadSummary (external memory)

---

## 5) Data model (MVP entities)

### 5.1 Tenancy + internal users
- **AgencyUser**: internal staff
- **Client**: managed brand
- **Role/Permission**: internal RBAC (admin/creator/approver/publisher)

### 5.2 Brand + knowledge
- **BrandKit**: voice/tone, ICP, offers, compliance, visual tokens
- **KnowledgeBase**: structured FAQs/resources + retrieval settings
- **KBSourceDoc**: external doc/url + summary + storage ref

### 5.3 Keyring + provider routing (BYOK)
- **ClientKeyring**: container
- **CredentialRef**: secret pointer
- **ProviderConfig**: task-class routing

Task classes (starter):
- `llm.planner`, `llm.creator`, `llm.engagement`
- `image.gen`, `video.gen`, `avatar.gen`
- `publish.api`, `publish.browser`
- `engage.api`, `engage.browser`

### 5.4 Blueprints
- **CreativeBlueprint**: definition contract (input schema, outputs, QA rules)
- **BlueprintVersion**: versioned blueprint definitions
- **BlueprintRun**: execution record (inputs/outputs + QA score)

### 5.5 Planning
- **Plan**
- **PlanNode**
- **PlanEdge**

### 5.6 Creation
- **Asset**: logical creative
- **AssetVariant**: platform/format-specific
- **AssetArtifact**: file references
- **Approval**: review status and reviewer

### 5.7 Publishing
- **CalendarItem**
- **PublishJob**
- **PublishRun**
- **PlatformAccount**: connected social account

### 5.8 Engagement
- **EngagementEvent**: comment/mention/DM/community event
- **ConversationThread**: per platform + external user
- **Message** (optional): raw messages with retention
- **ThreadSummary** (required): rolling summary record
- **Escalation**: handoff to human

### 5.9 Observability
- **AuditLog**: actor/action/timestamp
- **WorkflowRun**: Docker MCP workflow execution record

---

## 6) Suggested starter tables (minimum useful set)

### Client
- id (uuid)
- name
- status
- created_at

### BrandKit
- id
- client_id
- voice_style (json)
- offers (json)
- compliance_rules (json)
- visual_tokens (json)
- updated_at

### KnowledgeBase
- id
- client_id
- faq (json)
- resources (json)
- retrieval_config (json)
- updated_at

### ClientKeyring
- id
- client_id
- notes

### CredentialRef
- id
- client_id
- provider
- secret_ref
- created_at

### ProviderConfig
- id
- client_id
- task_class
- provider
- model
- params (json)

### CreativeBlueprint
- id
- name
- description
- input_schema (json)
- output_schema (json)
- qa_rules (json)
- default_enabled (bool)

### BlueprintRun
- id
- client_id
- blueprint_id
- blueprint_version_id
- plan_node_id (nullable)
- status
- inputs (json)
- outputs (json)
- qa_score (float)

### Plan / PlanNode / PlanEdge
- Plan(id, client_id, title, objective_template, date_range, status)
- PlanNode(id, plan_id, type, platform_targets, payload, quality_score)
- PlanEdge(id, from_node_id, to_node_id, relation)

### Asset / AssetVariant / AssetArtifact
- Asset(id, client_id, plan_node_id, type, status)
- AssetVariant(id, asset_id, platform, format, copy, metadata)
- AssetArtifact(id, asset_variant_id, kind, storage_url, checksum)

### CalendarItem
- id
- client_id
- platform
- asset_variant_id
- scheduled_at
- status
- external_ref

### PublishRun
- id
- calendar_item_id
- lane (api|browser)
- started_at
- finished_at
- result
- error
- artifacts (json)

### EngagementEvent
- id
- client_id
- platform
- event_type
- external_user_id
- external_ref
- payload (json)
- status

### ConversationThread / ThreadSummary
- ConversationThread(id, client_id, platform, external_user_id, status)
- ThreadSummary(id, thread_id, summary_text, updated_at)

---

## 7) MVP non-negotiables
- Plan Graph persisted (no ephemeral plans)
- Blueprint definitions stored + versioned
- Assets persisted + variants + approval state
- Single-pane calendar (DB-backed)
- Publish runs always produce artifacts/logs
- Keyring (BYOK) + provider routing from day 1
- Browser lane runner with Profile Vault + screenshots

---

## 8) Next document (per your requested order)
**Agent Tool Registry Spec (tools + MCPs)**

