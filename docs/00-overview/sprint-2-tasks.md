# Sprint 2: Planning + Creation

**Duration:** Weeks 5-6
**Goal:** Implement planning and creation loops without side effects.

**Prerequisites:** Sprint 1 complete

---

## Parallelizable Work

### Agent A: Plan Graph System
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| A1 | PlanGraph model | Nodes, edges, dependencies |
| A2 | Plan node types | Content, Campaign, Series |
| A3 | Plan API endpoints | Create, read, update, approve |
| A4 | Plan versioning | Draft → Approved → Executed |
| A5 | Plan visualization | JSON export for UI rendering |

### Agent B: Blueprint Definitions
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| B1 | Blueprint schema | Inputs, outputs, variants |
| B2 | Blueprint versioning | Immutable versions |
| B3 | Blueprint registry | Load by ID/slug |
| B4 | MVP blueprints (1-6) | Hook→Value→CTA, Carousel, Story, UGC, Offer, VSL |
| B5 | MVP blueprints (7-12) | HeyGen, Skool, LinkedIn, YouTube, Comment-DM, Poll |

### Agent C: Copy Generation Agent
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| C1 | Copy agent prompt system | Brand voice injection |
| C2 | Caption generation | Platform-specific lengths |
| C3 | CTA generation | Offer-aware CTAs |
| C4 | Hook generation | Pattern library (12 types) |
| C5 | Copy QA scoring | Tone, length, clarity metrics |

### Agent D: Media Generation Workflows
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| D1 | Image prompt generation | From brand + blueprint |
| D2 | Image generation lane | Provider abstraction |
| D3 | Silent video generation | Clip assembly workflow |
| D4 | Thumbnail generation | Per-platform specs |
| D5 | Media QA system | Resolution, format checks |

---

## Blocked Work

| Task | Blocked By | Description |
|------|------------|-------------|
| Asset creation pipeline | B1-B5 | Needs blueprint definitions |
| Human approval workflow | C1-C5, D1-D5 | Needs assets to approve |

---

## Sprint 2 Outputs

### Code
- [ ] Planning loop (`@rtv/planner`)
- [ ] Creation loop (`@rtv/creator`)
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

## Blueprint Checklist (MVP 12)

| # | Blueprint | Status |
|---|-----------|--------|
| 1 | Short-form "Hook → Value → CTA" Reel/Short | [ ] |
| 2 | Educational Carousel ("Saveable Swipe File") | [ ] |
| 3 | Story Sequence + DM keyword trigger | [ ] |
| 4 | UGC/Testimonial Reel (Proof Stack) | [ ] |
| 5 | Offer Reel (paid-ready) / Spark-ready post | [ ] |
| 6 | VSL Segment Series (script-driven) | [ ] |
| 7 | HeyGen Avatar Explainer | [ ] |
| 8 | Skool Community Post + Comment Ops | [ ] |
| 9 | LinkedIn Document Post (Lead Magnet Carousel) | [ ] |
| 10 | YouTube Shorts Template Remix | [ ] |
| 11 | Comment-to-DM Automation ("Keyword Router") | [ ] |
| 12 | Community Poll / Question Post (Engagement Seeder) | [ ] |

---

## Definition of Done

- [ ] Plans can be created and approved
- [ ] All 12 blueprints defined and loadable
- [ ] Copy generation produces quality output
- [ ] Media generation produces valid assets
- [ ] Golden path test: brand → plan → assets
- [ ] No side effects executed (dry-run only)

---

*Sprint Owner:* TBD
*Review Date:* TBD
