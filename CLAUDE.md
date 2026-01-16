# CLAUDE.md — Autonomous Social Media Operating System

> Project-specific context for Claude Code. Read this at session start.

---

## Project Identity

**Project:** Autonomous Social Media Operating System (Vibecoding Build)
**Client:** Internal RTV Product
**Status:** PRD Phase → Sprint 0
**Location:** `/Users/chrixcolvard/projects/_rtv/rtv-social-automation/`

---

## Project Overview

Building an agency-operated autonomous social media platform that:

- **Plans** → Generate plan graphs (what to post, why, when, where)
- **Creates** → Execute Creative Blueprints (assets + variants)
- **Publishes** → Schedule + publish via API or browser lane
- **Engages** → Monitor, respond, escalate (comments/DMs/community)

### Key Architecture Concepts

**RLM Integration (Recursive Language Models)**
- External memory is the canonical source (not prompts)
- Agents operate over references + summaries
- Bounded episodes with budgets (tokens/time/retries)
- Recursion contracts define read/write permissions

**Dual Execution Lanes**
- **API Lane** (preferred): Official platform APIs
- **Browser Lane** (fallback): Profile Vault + Runner for UI-only operations

**BYOK (Bring Your Own Keys)**
- Multi-tenant with client-specific provider keys
- Secure keyring with secret references only
- Support for multiple LLM/media providers per client

---

## Documentation Structure

```
/docs/
  00-overview/          # Executive summary, index, recommendations
  01-architecture/      # System architecture, RLM integration
  02-schemas/           # Onboarding, external memory schemas
  03-agents-tools/      # Tool registry, recursion contracts
  04-browser-lane/      # Profile vault, runner design
  05-policy-safety/     # Compliance, security, RBAC
  06-reliability-ops/   # SLOs, incidents, observability
  07-engineering-process/ # Handbook, CI/CD, testing
  08-growth-experiments/  # Experimentation, learning
  09-platform-playbooks/  # Per-platform strategies
  adr/                  # Architecture Decision Records
  runbooks/             # Operational runbooks (RB-01 through RB-12)
```

---

## Technical Stack

```yaml
Framework: Next.js 15 (App Router)
Language: TypeScript (strict mode)
Styling: Tailwind CSS
Database: Postgres (Neon/Supabase)
Queue: Redis (Upstash) + BullMQ
Storage: S3-compatible (Cloudflare R2)
MCP: Docker MCP Toolkit (single gateway)
Hosting: Vercel (web) + Container (runner)
Observability: OpenTelemetry
```

---

## Platforms in Scope

**Phase 1 (MVP):**
- Meta (Facebook + Instagram)
- TikTok
- YouTube
- LinkedIn
- X (Twitter)
- Skool

**Phase 2:**
- Google Business Profile

---

## Current Sprint

**Sprint:** Pre-Sprint (PRD Generation)
**Focus:** Documentation organization, PRD creation
**Status:** In Progress

### Next Sprint (Sprint 0)
- Repo scaffold + core packages
- Database schema + migrations
- CI/CD pipeline + required checks
- Observability baseline (OTEL)

---

## Non-Negotiable Rules

1. **Tenant Isolation**: Every query includes `client_id` scoping
2. **No Raw Secrets**: Only secret references in DB/logs
3. **Audit Everything**: Side effects emit AuditEvent with proof
4. **Fail Closed**: Policy failures block action, create incident
5. **Small Batches**: PRs reviewable in 10-20 min
6. **Kill Switches**: All side effects have per-client + global switches

---

## Key Commands

```bash
pnpm dev          # Start development server
pnpm build        # Production build
pnpm test         # Run tests
pnpm lint         # Lint code
pnpm db:migrate   # Run migrations
pnpm db:seed      # Seed test data
```

---

## Session Workflow

### Starting a Session

1. Read this CLAUDE.md
2. Check `docs/sessions.md` for last session notes
3. Review current sprint status
4. Identify next task

### Ending a Session

Append to `docs/sessions.md`:

```markdown
## Session: YYYY-MM-DD

### Accomplished
- [What was completed]

### Decisions Made
- [Key choices and why]

### Blockers/Issues
- [Problems encountered]

### Next Session
- [Priority tasks]
```

---

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Documentation Index | `/docs/README.md` |
| System Architecture | `/docs/01-architecture/system-architecture-v3.md` |
| Data Model | `/docs/01-architecture/system-architecture-v3.md#data-model` |
| RLM Integration | `/docs/01-architecture/rlm-integration-spec.md` |
| Engineering Handbook | `/docs/07-engineering-process/engineering-handbook.md` |
| ADR Index | `/docs/adr/adr-index.md` |
| Incident Runbooks | `/docs/runbooks/README.md` |
| Executive Summary | `/docs/00-overview/executive-summary-v3.md` |

---

## Sprint Roadmap

| Sprint | Focus | Key Deliverables |
|--------|-------|------------------|
| 0 | Foundation | Repo scaffold, schema, CI/CD, observability |
| 1 | Core Infrastructure | Domain models, RLM runtime, policy engine, runner |
| 2 | Planning + Creation | Plan graph, blueprints, copy/media generation |
| 3 | Scheduling + Publishing | Calendar, API/browser lanes, verification |
| 4 | Engagement | Event ingestion, reply drafting, escalation |
| 5 | Gated Rollout | House accounts, canary, kill switches, E2E |

---

## MCP Configuration

This project uses Docker MCP as a single gateway for:

- Chrome DevTools MCP (browser lane)
- GoHighLevel MCP (optional CRM integration)
- File system MCP (ops)
- Web/scrape MCP (verification)

---

## When Uncertain

1. Check `/docs/` for existing specs
2. Read relevant ADRs in `/docs/adr/`
3. Check `docs/sessions.md` for context
4. Reference the engineering handbook
5. Ask rather than assume

---

*This file provides project-specific context. See ~/.claude/CLAUDE.md for global RTV standards.*
