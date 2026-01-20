# Sprint 2: Planning + Creation

**Duration:** Weeks 5-6
**Goal:** Implement planning and creation loops without side effects.
**Prerequisites:** Sprint 1 complete

---

## Sprint Overview

Sprint 2 builds the planning and content creation capabilities. Four agents work in parallel to build:

1. **Agent A** - Plan Graph System: PlanGraph model, node types, API, versioning, visualization
2. **Agent B** - Blueprint Definitions: Schema, versioning, registry, MVP blueprints (1-12)
3. **Agent C** - Copy Generation Agent: Prompts, captions, CTAs, hooks, QA scoring
4. **Agent D** - Media Generation Workflows: Image prompts, generation, video, thumbnails, QA

---

## Task Inventory

### Agent A: Plan Graph System (5 tasks)

| ID | Task | Complexity | Dependencies |
|----|------|------------|--------------|
| [S2-A1](./S2-A1-plangraph-model.md) | PlanGraph model | High | S1-A5 |
| [S2-A2](./S2-A2-plan-node-types.md) | Plan node types | Medium | S2-A1 |
| [S2-A3](./S2-A3-plan-api.md) | Plan API endpoints | Medium | S2-A1, S2-A2 |
| [S2-A4](./S2-A4-plan-versioning.md) | Plan versioning | Medium | S2-A3 |
| [S2-A5](./S2-A5-plan-visualization.md) | Plan visualization | Low | S2-A4 |

### Agent B: Blueprint Definitions (5 tasks)

| ID | Task | Complexity | Dependencies |
|----|------|------------|--------------|
| [S2-B1](./S2-B1-blueprint-schema.md) | Blueprint schema | High | S1-A3 |
| [S2-B2](./S2-B2-blueprint-versioning.md) | Blueprint versioning | Medium | S2-B1 |
| [S2-B3](./S2-B3-blueprint-registry.md) | Blueprint registry | Medium | S2-B1, S2-B2 |
| [S2-B4](./S2-B4-blueprints-1-6.md) | MVP blueprints (1-6) | High | S2-B3 |
| [S2-B5](./S2-B5-blueprints-7-12.md) | MVP blueprints (7-12) | High | S2-B3 |

### Agent C: Copy Generation Agent (5 tasks)

| ID | Task | Complexity | Dependencies |
|----|------|------------|--------------|
| [S2-C1](./S2-C1-copy-prompts.md) | Copy agent prompt system | High | S1-B5 |
| [S2-C2](./S2-C2-caption-generation.md) | Caption generation | Medium | S2-C1 |
| [S2-C3](./S2-C3-cta-generation.md) | CTA generation | Medium | S2-C1 |
| [S2-C4](./S2-C4-hook-generation.md) | Hook generation | Medium | S2-C1 |
| [S2-C5](./S2-C5-copy-qa.md) | Copy QA scoring | Medium | S2-C2, S2-C3, S2-C4 |

### Agent D: Media Generation Workflows (5 tasks)

| ID | Task | Complexity | Dependencies |
|----|------|------------|--------------|
| [S2-D1](./S2-D1-image-prompts.md) | Image prompt generation | High | S1-B5, S2-B1 |
| [S2-D2](./S2-D2-image-generation.md) | Image generation lane | High | S2-D1 |
| [S2-D3](./S2-D3-video-generation.md) | Silent video generation | High | S2-D2 |
| [S2-D4](./S2-D4-thumbnail-generation.md) | Thumbnail generation | Medium | S2-D2 |
| [S2-D5](./S2-D5-media-qa.md) | Media QA system | Medium | S2-D2, S2-D3, S2-D4 |

---

## Dependency Graph

```
Sprint 1 (Complete)
    │
    ├─► S2-A1 (PlanGraph) ─► S2-A2 (Node Types)
    │        │                      │
    │        └──────────────────────┴─► S2-A3 (API) ─► S2-A4 (Versioning) ─► S2-A5 (Viz)
    │
    ├─► S2-B1 (Blueprint Schema) ─► S2-B2 (Versioning)
    │        │                            │
    │        └────────────────────────────┴─► S2-B3 (Registry) ─┬─► S2-B4 (BP 1-6)
    │                                                           └─► S2-B5 (BP 7-12)
    │
    ├─► S2-C1 (Copy Prompts) ─► S2-C2 (Captions)
    │        │                       │
    │        ├─► S2-C3 (CTAs) ───────┤
    │        │                       │
    │        └─► S2-C4 (Hooks) ──────┴─► S2-C5 (QA)
    │
    └─► S2-D1 (Image Prompts) ─► S2-D2 (Image Gen)
                                      │
             ┌────────────────────────┼────────────────────────┐
             │                        │                        │
             ▼                        ▼                        ▼
        S2-D3 (Video)           S2-D4 (Thumbnails)        S2-D5 (QA)
```

---

## Parallel Execution Model

```
Week 5:
├── Agent A: S2-A1 → S2-A2 → S2-A3
├── Agent B: S2-B1 → S2-B2 → S2-B3
├── Agent C: S2-C1 → S2-C2 → S2-C3
└── Agent D: S2-D1 → S2-D2

Week 6:
├── Agent A: S2-A4 → S2-A5
├── Agent B: S2-B4 → S2-B5
├── Agent C: S2-C4 → S2-C5
└── Agent D: S2-D3 → S2-D4 → S2-D5
```

---

## New Packages Created

| Package | Purpose | Owner |
|---------|---------|-------|
| `@rtv/planner` | Plan graph and planning loop | Agent A |
| `@rtv/blueprint` | Blueprint schema and registry | Agent B |
| `@rtv/agents/copy` | Copy generation agent | Agent C |
| `@rtv/agents/media` | Media generation workflows | Agent D |

---

## Blueprint Checklist (MVP 12)

| # | Blueprint | Task |
|---|-----------|------|
| 1 | Short-form "Hook → Value → CTA" Reel/Short | S2-B4 |
| 2 | Educational Carousel ("Saveable Swipe File") | S2-B4 |
| 3 | Story Sequence + DM keyword trigger | S2-B4 |
| 4 | UGC/Testimonial Reel (Proof Stack) | S2-B4 |
| 5 | Offer Reel (paid-ready) / Spark-ready post | S2-B4 |
| 6 | VSL Segment Series (script-driven) | S2-B4 |
| 7 | HeyGen Avatar Explainer | S2-B5 |
| 8 | Skool Community Post + Comment Ops | S2-B5 |
| 9 | LinkedIn Document Post (Lead Magnet Carousel) | S2-B5 |
| 10 | YouTube Shorts Template Remix | S2-B5 |
| 11 | Comment-to-DM Automation ("Keyword Router") | S2-B5 |
| 12 | Community Poll / Question Post (Engagement Seeder) | S2-B5 |

---

## Sprint 2 Outputs

### Code
- [ ] Planning loop (`@rtv/planner`)
- [ ] Blueprint system (`@rtv/blueprint`)
- [ ] Copy agent (`@rtv/agents/copy`)
- [ ] Media workflows (`@rtv/agents/media`)

### Tests
- [ ] Plan graph creation tests
- [ ] Blueprint loading tests
- [ ] Copy generation quality tests
- [ ] Media generation format tests
- [ ] Golden path: Plan → Create

### Telemetry
- [ ] Planning metrics (duration, node count)
- [ ] Creation metrics (duration, quality scores)
- [ ] Blueprint execution metrics
- [ ] Provider usage metrics

### Documentation
- [ ] `docs/00-overview/sprint-2-completion.md`
- [ ] Blueprint authoring guide

### ADRs
- [ ] ADR-0020: Plan Graph Model
- [ ] ADR-0021: Blueprint Versioning
- [ ] ADR-0022: Asset Pipeline Architecture

---

## Definition of Done

- [ ] Plans can be created and approved
- [ ] All 12 blueprints defined and loadable
- [ ] Copy generation produces quality output
- [ ] Media generation produces valid assets
- [ ] Golden path test: brand → plan → assets
- [ ] No side effects executed (dry-run only)

---

## Critical Specs

| Document | Purpose |
|----------|---------|
| `/docs/01-architecture/system-architecture-v3.md` | Planning data model |
| `/docs/01-architecture/rlm-integration-spec.md` | Memory access patterns |
| `/docs/03-agents-tools/agent-recursion-contracts.md` | Agent contracts |
| `/docs/02-schemas/external-memory-schema.md` | Content schemas |

---

*Sprint 2 implements planning and creation capabilities without executing side effects.*
