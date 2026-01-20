# Sprint 1: Core Infrastructure

**Duration:** Weeks 3-4
**Goal:** Build core domain models, external memory layer, policy engine, and runner skeleton.
**Prerequisites:** Sprint 0 complete

---

## Sprint Overview

Sprint 1 establishes the core runtime infrastructure for the platform. Four agents work in parallel to build:

1. **Agent A** - Core Domain Models: Client, BrandKit, KnowledgeBase, Offer entities with events
2. **Agent B** - External Memory Layer: RLMEnv interface, summaries, references, retrieval
3. **Agent C** - Policy Engine: Policy schema, gates, kill switches, rate limiting
4. **Agent D** - Runner Skeleton: Episode model, budgets, tool wrapper, state machine

---

## Task Inventory

### Agent A: Core Domain Models (5 tasks)

| ID | Task | Complexity | Dependencies |
|----|------|------------|--------------|
| [S1-A1](./S1-A1-client-entity.md) | Client entity model | Medium | S0-B2 |
| [S1-A2](./S1-A2-brandkit-entity.md) | BrandKit entity model | Medium | S1-A1 |
| [S1-A3](./S1-A3-knowledgebase-entity.md) | KnowledgeBase entity model | High | S1-A1 |
| [S1-A4](./S1-A4-offer-entity.md) | Offer entity model | Medium | S1-A2 |
| [S1-A5](./S1-A5-domain-events.md) | Domain event emission | Medium | S1-A1 through S1-A4 |

### Agent B: External Memory Layer (5 tasks)

| ID | Task | Complexity | Dependencies |
|----|------|------------|--------------|
| [S1-B1](./S1-B1-rlmenv-interface.md) | RLMEnv interface definition | High | S0-D1 |
| [S1-B2](./S1-B2-summary-storage.md) | Summary storage system | Medium | S1-B1 |
| [S1-B3](./S1-B3-reference-system.md) | Reference system | Medium | S1-B1 |
| [S1-B4](./S1-B4-context-window.md) | Context window management | High | S1-B1, S1-B2 |
| [S1-B5](./S1-B5-memory-retrieval.md) | Memory retrieval API | Medium | S1-B1 through S1-B4 |

### Agent C: Policy Engine (5 tasks)

| ID | Task | Complexity | Dependencies |
|----|------|------------|--------------|
| [S1-C1](./S1-C1-policy-schema.md) | Policy definition schema | High | S0-A3 |
| [S1-C2](./S1-C2-approval-gates.md) | Approval gate framework | Medium | S1-C1 |
| [S1-C3](./S1-C3-kill-switches.md) | Kill switch infrastructure | High | S1-C1 |
| [S1-C4](./S1-C4-rate-limiting.md) | Rate limiting policies | Medium | S1-C1 |
| [S1-C5](./S1-C5-policy-evaluation.md) | Policy evaluation engine | High | S1-C1 through S1-C4 |

### Agent D: Runner Skeleton (5 tasks)

| ID | Task | Complexity | Dependencies |
|----|------|------------|--------------|
| [S1-D1](./S1-D1-episode-model.md) | Episode model definition | High | S0-D1 |
| [S1-D2](./S1-D2-budget-enforcement.md) | Budget enforcement system | High | S1-D1 |
| [S1-D3](./S1-D3-tool-wrapper.md) | Tool execution wrapper | Medium | S1-D1 |
| [S1-D4](./S1-D4-runner-state-machine.md) | Runner state machine | High | S1-D1 through S1-D3 |
| [S1-D5](./S1-D5-checkpoint-system.md) | Checkpoint system | Medium | S1-D4 |

---

## Dependency Graph

```
Sprint 0 (Complete)
    │
    ├─► S1-A1 (Client) ─► S1-A2 (BrandKit) ─► S1-A4 (Offer)
    │        │                   │
    │        └───────────────────┴─► S1-A3 (KnowledgeBase)
    │                                        │
    │        S1-A1 through S1-A4 ───────────►│─► S1-A5 (Events)
    │
    ├─► S1-B1 (RLMEnv) ─► S1-B2 (Summaries)
    │        │                   │
    │        ├─► S1-B3 (Refs)    │
    │        │                   │
    │        └───────────────────┴─► S1-B4 (Context) ─► S1-B5 (Retrieval)
    │
    ├─► S1-C1 (Policy Schema) ─► S1-C2 (Gates)
    │        │                        │
    │        ├─► S1-C3 (Kill Switches)│
    │        │                        │
    │        └─► S1-C4 (Rate Limits)──┴─► S1-C5 (Evaluation)
    │
    └─► S1-D1 (Episode) ─► S1-D2 (Budgets)
             │                   │
             ├─► S1-D3 (Tool Wrapper)
             │                   │
             └───────────────────┴─► S1-D4 (State Machine) ─► S1-D5 (Checkpoints)
```

---

## Parallel Execution Model

```
Week 3:
├── Agent A: S1-A1 → S1-A2 → S1-A3
├── Agent B: S1-B1 → S1-B2 → S1-B3
├── Agent C: S1-C1 → S1-C2 → S1-C3
└── Agent D: S1-D1 → S1-D2 → S1-D3

Week 4:
├── Agent A: S1-A4 → S1-A5
├── Agent B: S1-B4 → S1-B5
├── Agent C: S1-C4 → S1-C5
└── Agent D: S1-D4 → S1-D5
```

---

## New Packages Created

| Package | Purpose | Owner |
|---------|---------|-------|
| `@rtv/domain` | Core domain models and events | Agent A |
| `@rtv/memory` | RLM external memory layer | Agent B |
| `@rtv/policy` | Policy engine and evaluation | Agent C |
| `@rtv/runner` | Episode runner and execution | Agent D |

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

## Critical Specs

| Document | Purpose |
|----------|---------|
| `/docs/01-architecture/system-architecture-v3.md` | Data model reference |
| `/docs/01-architecture/rlm-integration-spec.md` | RLM patterns |
| `/docs/03-agents-tools/agent-recursion-contracts.md` | Agent contracts |
| `/docs/05-policy-safety/multi-tenant-isolation.md` | Tenant isolation |
| `/docs/06-reliability-ops/slo-error-budget.md` | Performance requirements |

---

*Sprint 1 builds the core infrastructure that all subsequent sprints depend on.*
