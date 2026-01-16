# Sprint 1: Core Infrastructure

**Duration:** Weeks 3-4
**Goal:** Build core domain models, external memory layer, policy engine, and runner skeleton.

**Prerequisites:** Sprint 0 complete

---

## Parallelizable Work

### Agent A: Core Domain Models
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| A1 | Client entity model | CRUD operations, validation |
| A2 | BrandKit entity model | Tone, colors, logo refs, KB refs |
| A3 | KnowledgeBase entity model | Chunk storage, embeddings |
| A4 | Offer entity model | Active offers with CTAs |
| A5 | Domain event emission | All entities emit events on change |

### Agent B: External Memory Layer (RLM)
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| B1 | RLMEnv interface definition | Read/write methods defined |
| B2 | Summary storage system | ThreadSummary, PlanSummary models |
| B3 | Reference system | Pointers to full content |
| B4 | Context window management | Token counting, truncation |
| B5 | Memory retrieval API | Query by relevance, recency |

### Agent C: Policy Engine
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| C1 | Policy definition schema | YAML/JSON policy format |
| C2 | Approval gate framework | Sync/async gates |
| C3 | Kill switch infrastructure | Global, per-client, per-platform |
| C4 | Rate limiting policies | Per-platform cadence enforcement |
| C5 | Policy evaluation engine | `PolicyEngine.evaluate()` |

### Agent D: Runner Skeleton
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| D1 | Episode model definition | Start, budget, termination |
| D2 | Budget enforcement system | Token, time, action budgets |
| D3 | Tool execution wrapper | Instrumented tool calls |
| D4 | Runner state machine | Pending → Running → Complete/Failed |
| D5 | Checkpoint system | Resume from checkpoint |

---

## Blocked Work

| Task | Blocked By | Description |
|------|------------|-------------|
| Provider routing | A1-A5 | Needs domain models for config |
| Tool gateway integration | D1-D5 | Needs runner skeleton |

---

## Sprint 1 Outputs

### Code
- [ ] Domain layer (`@rtv/domain`)
- [ ] RLM runtime (`@rtv/memory`)
- [ ] Policy engine (`@rtv/policy`)
- [ ] Runner skeleton (`@rtv/runner`)

### Tests
- [ ] Unit tests for all domain models
- [ ] Integration tests for memory layer
- [ ] Policy evaluation tests
- [ ] Runner state machine tests

### Telemetry
- [ ] Domain event emission
- [ ] Memory access metrics
- [ ] Policy evaluation metrics
- [ ] Runner execution metrics

### Documentation
- [ ] `docs/00-overview/sprint-1-completion.md`

### ADRs
- [ ] ADR-0010: External Memory Architecture
- [ ] ADR-0011: Policy Engine Design
- [ ] ADR-0012: Tool Gateway Pattern

---

## Definition of Done

- [ ] All domain models with full CRUD
- [ ] Memory layer storing and retrieving context
- [ ] Policy engine evaluating rules
- [ ] Runner executing basic episodes
- [ ] All tests passing
- [ ] ADRs documented and merged

---

*Sprint Owner:* TBD
*Review Date:* TBD
