# RTV Autonomous Social Media Operating System

> An agency-operated platform that Plans → Creates → Publishes → Engages across multiple social platforms.

---

## Quick Links

- **Project Context:** [`CLAUDE.md`](./CLAUDE.md)
- **Documentation:** [`/docs/`](./docs/README.md)
- **Architecture:** [`/docs/01-architecture/system-architecture-v3.md`](./docs/01-architecture/system-architecture-v3.md)
- **Engineering Handbook:** [`/docs/07-engineering-process/engineering-handbook.md`](./docs/07-engineering-process/engineering-handbook.md)
- **ADRs:** [`/docs/adr/`](./docs/adr/adr-index.md)
- **Runbooks:** [`/docs/runbooks/`](./docs/runbooks/README.md)

---

## Project Status

**Current Phase:** PRD → Sprint 0
**Last Updated:** 2025-01-16

---

## What This Is

A **vibecoding knowledge base** that serves as the specification-first foundation for building an autonomous social media automation platform for agencies. This repository contains:

- 54+ specification documents
- Complete architecture and data model
- Security and compliance frameworks
- Operational runbooks
- Engineering processes

**No production code yet** — this is the instruction set for build agents.

---

## Key Concepts

### The 4 Automation Pillars

1. **Planning** — Generate plan graphs (what to post, why, when, where)
2. **Creation** — Execute Creative Blueprints (assets + variants)
3. **Publishing** — Schedule + publish via API or browser lane
4. **Engagement** — Monitor, respond, escalate (comments/DMs/community)

### Architecture Highlights

- **RLM (Recursive Language Models)** — External memory as canonical source
- **Dual Execution Lanes** — API-first with browser automation fallback
- **BYOK (Bring Your Own Keys)** — Multi-tenant with client-specific providers
- **Safety-First** — Kill switches, approval gates, audit trails

---

## Documentation Structure

```
/docs/
├── 00-overview/          # Project scope, vision
├── 01-architecture/      # System design, RLM
├── 02-schemas/           # Data models
├── 03-agents-tools/      # Tool registry, recursion
├── 04-browser-lane/      # Browser automation
├── 05-policy-safety/     # Security, compliance
├── 06-reliability-ops/   # SLOs, incidents
├── 07-engineering-process/ # Dev practices
├── 08-growth-experiments/  # Experimentation
├── 09-platform-playbooks/  # Platform strategies
├── adr/                  # Architecture decisions
└── runbooks/             # Operational procedures
```

---

## Tech Stack (Planned)

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict)
- **Database:** Postgres + Redis
- **Storage:** S3-compatible
- **MCP:** Docker MCP Toolkit
- **Hosting:** Vercel + Container
- **Observability:** OpenTelemetry

---

## Getting Started

1. Read [`CLAUDE.md`](./CLAUDE.md) for project context
2. Review [`/docs/00-overview/`](./docs/00-overview/) for full scope
3. Check [`/docs/07-engineering-process/development-accounts-checklist.md`](./docs/07-engineering-process/development-accounts-checklist.md) for required accounts

---

## Sprint Roadmap

| Sprint | Focus | Status |
|--------|-------|--------|
| 0 | Foundation (repo, schema, CI/CD) | Pending |
| 1 | Core Infrastructure | Pending |
| 2 | Planning + Creation | Pending |
| 3 | Scheduling + Publishing | Pending |
| 4 | Engagement | Pending |
| 5 | Gated Rollout | Pending |

---

## License

Proprietary — Raize The Vibe
