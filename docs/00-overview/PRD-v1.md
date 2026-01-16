# Product Requirements Document (PRD) — v1

## Autonomous Social Media Operating System

**Project:** RTV Social Automation Platform
**Version:** 1.0
**Status:** Draft
**Last Updated:** 2025-01-16

---

## 1. Executive Summary

Raize The Vibe is building an internal, agency-operated **Autonomous Social Media Operating System** — a platform that transforms brand inputs and knowledge bases into a repeatable pipeline that **plans → creates → publishes → engages** across multiple social platforms at scale.

### Vision

A semi-autonomous marketing operations platform where AI agents handle the heavy lifting, humans approve and steer as needed, and the system continuously learns from performance and conversations.

### Core Differentiators

1. **Agency-operated, multi-client** — Connect to client social accounts and run workflows internally
2. **Vibecoded build + agent-native ops** — Built and operated with CLI agents, Claude Agent SDK, and MCP
3. **RLM-aligned architecture** — External memory as canonical source, bounded episodes with budgets
4. **Docker MCP aggregation** — Single MCP endpoint with scripted tool workflows
5. **Dual execution lanes** — API-first with browser automation fallback

---

## 2. Product Overview

### 2.1 The 4 Automation Pillars

| Pillar | Description | Key Outputs |
|--------|-------------|-------------|
| **Planning** | Generate plan graphs (what to post, why, when, where) | Plan graphs, themes, hooks, post intents |
| **Creation** | Execute Creative Blueprints (assets + variants) | Copy, images, videos, thumbnails, captions |
| **Publishing** | Schedule + publish via API or browser lane | Published posts, proof artifacts, logs |
| **Engagement** | Monitor, respond, escalate (comments/DMs/community) | Replies, DM routing, escalations |

### 2.2 Creative Blueprints System

Creative Blueprints are repeatable, automatable content workflows. Each blueprint defines:

- **Inputs:** Brand + KB + offer + goal
- **Outputs:** Copy, visuals, video clips, captions, thumbnails
- **Variants:** Platform-specific (ratio/length/CTA)
- **Hooks:** Publishing + engagement triggers
- **QA:** Quality checks + recursion rules

**MVP Blueprints (12):**
1. Short-form "Hook → Value → CTA" Reel/Short
2. Educational Carousel ("Saveable Swipe File")
3. Story Sequence + DM keyword trigger
4. UGC/Testimonial Reel (Proof Stack)
5. Offer Reel (paid-ready) / Spark-ready post
6. VSL Segment Series (script-driven)
7. HeyGen Avatar Explainer
8. Skool Community Post + Comment Ops
9. LinkedIn Document Post (Lead Magnet Carousel)
10. YouTube Shorts Template Remix
11. Comment-to-DM Automation ("Keyword Router")
12. Community Poll / Question Post (Engagement Seeder)

### 2.3 Dual Execution Lanes

**Lane A — API (Preferred)**
- Official platform APIs
- GoHighLevel integration where beneficial
- Publishing, comment/DM pulling, replies

**Lane B — Browser (Fallback)**
- Profile Vault: Pre-authenticated Chrome profiles
- Runner: Isolated session execution
- Artifacts: Screenshots, DOM snapshots, step logs
- Use cases: Stories, Skool deep actions, UI-only operations

### 2.4 BYOK (Bring Your Own Keys)

Multi-tenant architecture with client-specific provider keys:
- LLM providers (OpenAI, Anthropic, Google)
- Image generation providers
- Video generation providers
- Avatar providers (HeyGen)

---

## 3. Platforms in Scope

### Phase 1 (MVP)

| Platform | API Support | Browser Lane Needed |
|----------|-------------|---------------------|
| Meta (Facebook + Instagram) | Partial | Stories, some engagement |
| TikTok | Partial | Some actions |
| YouTube | Good | Limited |
| LinkedIn | Good | Limited |
| X (Twitter) | Good | Limited |
| Skool | None | All operations |

### Phase 2

- Google Business Profile

---

## 4. Functional Requirements

### 4.1 Planning Subsystem

**FR-P001:** Generate plan graphs from objective templates
**FR-P002:** Support plan graph editing and approval workflow
**FR-P003:** Recommend blueprints per plan node
**FR-P004:** Persist all plans (no ephemeral plans)
**FR-P005:** Load BrandKit + KB summaries for context

### 4.2 Creation Subsystem

**FR-C001:** Execute blueprint runs with fan-out pattern
**FR-C002:** Generate copy, images, and video assets
**FR-C003:** Create platform-specific variants
**FR-C004:** Support human approval workflow
**FR-C005:** Track QA scores per asset
**FR-C006:** Support HeyGen avatar generation lane

### 4.3 Publishing Subsystem

**FR-PB001:** Single-pane calendar view
**FR-PB002:** Schedule posts with delayed execution
**FR-PB003:** Execute via API lane first, fallback to browser
**FR-PB004:** Capture proof artifacts (screenshots, post IDs)
**FR-PB005:** Support retry with exponential backoff
**FR-PB006:** Verify post visibility after publish

### 4.4 Engagement Subsystem

**FR-E001:** Ingest events via webhook and polling
**FR-E002:** Maintain conversation thread summaries
**FR-E003:** Auto-like with throttling
**FR-E004:** Safe reply generation with approval gates
**FR-E005:** DM keyword routing (comment → DM flows)
**FR-E006:** Escalation to human operators
**FR-E007:** Skool community operations automation

### 4.5 Multi-Tenant Architecture

**FR-MT001:** Tenant isolation at every query
**FR-MT002:** Per-client kill switches
**FR-MT003:** Per-client provider routing (BYOK)
**FR-MT004:** Audit events with client_id scoping
**FR-MT005:** Profile Vault isolation (browser lane)

### 4.6 BYOK Provider Routing

**FR-BYO001:** Keyring with secret references (no raw values in DB)
**FR-BYO002:** Task-class routing (llm.planner, llm.creator, etc.)
**FR-BYO003:** Fallback provider configuration
**FR-BYO004:** Cost attribution per client

---

## 5. Non-Functional Requirements

### 5.1 Performance (SLOs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Publish success rate | > 99% | Successful publishes / attempts |
| Verification time | < 5 min | Time from publish to confirmed visible |
| Queue freshness | < 5 min | Time jobs wait in queue |
| API response (p95) | < 500ms | 95th percentile latency |
| Creation pipeline | < 30 min | Time from job start to assets ready |

### 5.2 Security (ASVS-Mapped)

- **Authentication:** Internal RBAC (admin/creator/approver/publisher)
- **Authorization:** Role-based permissions per operation
- **Secrets:** References only, never raw values in DB/logs
- **Tenant isolation:** Enforced at query and tool gateway level
- **Audit:** All side effects emit AuditEvent with proof

### 5.3 Reliability

- **Error budget:** 0.1% (43 min/month downtime)
- **Kill switches:** Global + per-client + per-platform
- **Fail closed:** Policy failures block actions
- **Graceful degradation:** Fall back to manual approval mode

### 5.4 Observability

- **Telemetry:** OpenTelemetry instrumentation
- **Audit events:** Required for all side effects
- **Dashboard:** "Couple times a day" operator check-in
- **Alerts:** P0/P1 paging, P2/P3 email

---

## 6. Sprint Decomposition

### Sprint 0: Foundation (Weeks 1-2)

**Goal:** Establish repository structure, database schema, CI/CD, and observability baseline.

#### Parallelizable Work

| Agent | Tasks |
|-------|-------|
| A | Repo scaffold, monorepo structure, TypeScript config, core packages |
| B | Database schema (Postgres), migrations, seed data |
| C | CI/CD pipeline, required checks, deployment config |
| D | Observability baseline (OTEL), audit event framework |

#### Blocked Work (Requires Sprint 0 Completion)

- Environment configuration (depends on schema)
- Basic API routes (depends on schema)

#### Sprint 0 Outputs

- **Code:** Repo structure, packages, schema, CI/CD
- **Tests:** Schema validation, CI checks pass
- **Telemetry:** Logging framework operational
- **Docs:** sprint-0-completion.md
- **ADRs:** ADR-0001 (Monorepo), ADR-0002 (Database), ADR-0003 (Queue), ADR-0004 (Observability)

---

### Sprint 1: Core Infrastructure (Weeks 3-4)

**Goal:** Build core domain models, external memory layer, policy engine, and runner skeleton.

#### Parallelizable Work

| Agent | Tasks |
|-------|-------|
| A | Core domain models (Client, BrandKit, KnowledgeBase) |
| B | External memory layer (RLMEnv, summaries, references) |
| C | Policy engine, approval gates, kill switch infrastructure |
| D | Runner skeleton, episode execution, budget enforcement |

#### Blocked Work

- Provider routing (requires domain models)
- Tool gateway integration (requires runner skeleton)

#### Sprint 1 Outputs

- **Code:** Domain layer, RLM runtime, policy engine, runner
- **Tests:** Unit + integration tests for all domains
- **Telemetry:** Domain event emission
- **Docs:** sprint-1-completion.md
- **ADRs:** ADR-0010 (External Memory), ADR-0011 (Policy Engine), ADR-0012 (Tool Gateway)

---

### Sprint 2: Planning + Creation (Weeks 5-6)

**Goal:** Implement planning and creation loops without side effects.

#### Parallelizable Work

| Agent | Tasks |
|-------|-------|
| A | Plan graph model, plan API endpoints |
| B | Blueprint definitions, versioning system |
| C | Copy generation agent, caption/CTA generation |
| D | Media generation workflows (image prompts, silent video) |

#### Blocked Work

- Asset creation pipeline (requires blueprints)
- Human approval workflow (requires assets)

#### Sprint 2 Outputs

- **Code:** Planning loop, creation loop (no side effects)
- **Tests:** Golden path tests (plan → create)
- **Telemetry:** Creation metrics (duration, quality scores)
- **Docs:** sprint-2-completion.md
- **ADRs:** ADR-0020 (Plan Graph), ADR-0021 (Blueprint Versioning), ADR-0022 (Asset Pipeline)

---

### Sprint 3: Scheduling + Publishing (Weeks 7-8)

**Goal:** Implement calendar system and dual-lane publishing with verification.

#### Parallelizable Work

| Agent | Tasks |
|-------|-------|
| A | Calendar system, scheduling API, delayed execution |
| B | API lane connectors (Meta, TikTok, YouTube, LinkedIn, X) |
| C | Browser lane runner, Profile Vault, session isolation |
| D | Publish verification system, proof capture |

#### Blocked Work

- Dry-run publishing (requires all lanes)
- Proof capture (requires verification)

#### Sprint 3 Outputs

- **Code:** Calendar, publish lanes, verification
- **Tests:** Publish dry-run golden path
- **Telemetry:** Publish success/failure metrics
- **Docs:** sprint-3-completion.md
- **ADRs:** ADR-0030 (API Lane), ADR-0031 (Browser Lane), ADR-0032 (Verification)

---

### Sprint 4: Engagement (Weeks 9-10)

**Goal:** Implement engagement ingestion, reply drafting, and escalation.

#### Parallelizable Work

| Agent | Tasks |
|-------|-------|
| A | Event ingestion (webhooks + polling) |
| B | Conversation thread model, ThreadSummary |
| C | Reply drafting agent, safe response generation |
| D | Escalation system, human handoff |

#### Blocked Work

- DM routing (requires thread model)
- Comment automation (requires reply agent)

#### Sprint 4 Outputs

- **Code:** Engagement loop (safe drafting, no auto-send)
- **Tests:** Engagement golden path
- **Telemetry:** Engagement event metrics
- **Docs:** sprint-4-completion.md
- **ADRs:** ADR-0040 (Event Ingestion), ADR-0041 (Thread Model), ADR-0042 (Reply Agent)

---

### Sprint 5: Gated Rollout (Weeks 11-12)

**Goal:** Enable side effects with safety gates and validate on house accounts.

#### Parallelizable Work

| Agent | Tasks |
|-------|-------|
| A | House account testing, sandbox validation |
| B | Canary client configuration, feature flags |
| C | Kill switch implementation (global + per-client + per-platform) |
| D | Full E2E test suite with side effects |

#### Blocked Work

- Production side effects (requires all safety gates)
- Client rollout (requires house account validation)

#### Sprint 5 Outputs

- **Code:** Side effects enabled behind flags
- **Tests:** Full E2E with side effects
- **Telemetry:** Production monitoring
- **Docs:** sprint-5-completion.md
- **ADRs:** ADR-0050 (Kill Switches), ADR-0051 (Gated Rollout)

---

## 7. Success Criteria

### MVP Success Metrics

| Metric | Target |
|--------|--------|
| Publish success rate | > 99% |
| Verification time-to-visible | < 5 minutes |
| Wrong-account incidents | Zero |
| Operator check-in time | < 30 min/day |
| Blueprint execution success | > 95% |

### Business Success Metrics

| Metric | Target |
|--------|--------|
| Clients onboarded | 3+ (house + canary) |
| Posts published per day | 10+ across all clients |
| Engagement events processed | 100+ per day |
| Time saved per client | 5+ hours/week |

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Platform API changes | High | Medium | Versioned connectors, browser fallback |
| Browser lane drift | High | Medium | Drift detection, selector resilience |
| Provider outages | Medium | Medium | Multi-provider BYOK, fallback routing |
| Rate limiting | Medium | Low | Adaptive pacing, cadence policies |
| Wrong-account action | Low | Critical | Tenant isolation, kill switches, audit |
| Cost runaway | Medium | Medium | Episode budgets, per-client limits |

---

## 9. Dependencies

### Platform Developer Accounts

- Meta Business (Facebook + Instagram API)
- TikTok for Developers
- YouTube Data API
- LinkedIn Marketing API
- X (Twitter) Developer Account
- Skool (browser-only, no API)

### AI Provider Keys

- OpenAI API
- Anthropic API (Claude)
- Google AI (Gemini)
- Image generation provider
- Video generation provider
- HeyGen (avatar)

### Infrastructure

- Vercel (web hosting)
- Postgres (Neon or Supabase)
- Redis (Upstash)
- S3-compatible storage (Cloudflare R2)
- Container hosting (for worker service)

---

## 10. Appendices

### A. Complete ADR Backlog

See [/docs/adr/adr-index.md](../adr/adr-index.md) for full list.

### B. Full Test Matrix

See [/docs/07-engineering-process/testing-strategy.md](../07-engineering-process/testing-strategy.md).

### C. Observability Requirements

See [/docs/06-reliability-ops/observability-dashboard.md](../06-reliability-ops/observability-dashboard.md).

### D. Required Accounts Checklist

See [/docs/07-engineering-process/development-accounts-checklist.md](../07-engineering-process/development-accounts-checklist.md).

### E. Blueprint Definitions

See [Executive Summary v3](./executive-summary-v3.md#creative-blueprints-library-mvp) for full blueprint specifications.

---

*Generated: 2025-01-16*
*Version: 1.0*
