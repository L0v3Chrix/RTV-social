# PRD v2: Complete Build Prompts for RTV Social Automation

## Overview

This directory contains **121 executable build prompts** that transform the RTV Social Automation Platform specifications into actionable, test-driven development tasks for AI coding agents.

**Project:** Autonomous Social Media Operating System
**Version:** 2.0
**Total Tasks:** 121
**Total Files:** 131

---

## Quick Navigation

| Sprint | Focus | Tasks | Status |
|--------|-------|-------|--------|
| [Sprint 0](./sprint-0/) | Foundation | 20 | Pending |
| [Sprint 1](./sprint-1/) | Core Infrastructure | 20 | Pending |
| [Sprint 2](./sprint-2/) | Planning + Creation | 20 | Pending |
| [Sprint 3](./sprint-3/) | Scheduling + Publishing | 21 | Pending |
| [Sprint 4](./sprint-4/) | Engagement | 20 | Pending |
| [Sprint 5](./sprint-5/) | Gated Rollout | 20 | Pending |

---

## Infrastructure Files

| File | Purpose |
|------|---------|
| [00-build-prompts-template.md](./00-build-prompts-template.md) | Canonical prompt template |
| [01-dependency-graph.md](./01-dependency-graph.md) | Task dependency visualization |
| [02-context-injection-guide.md](./02-context-injection-guide.md) | How prompts reference specs |

---

## Agent Build Protocol

### Methodology: Test-Driven Development (TDD)

Every task follows this mandatory sequence:

#### 1. RED: Write Failing Tests First
- Read the acceptance criteria
- Write tests that verify each criterion
- Run tests — they MUST fail
- If tests pass without implementation, tests are incorrect

#### 2. GREEN: Implement Minimum Code
- Write just enough code to make tests pass
- Do not add features beyond what tests require
- Run tests after each significant change

#### 3. REFACTOR: Clean Up
- Improve code quality without changing behavior
- Tests must continue passing
- Apply patterns from engineering-handbook.md

### Non-Negotiable Rules

1. **Never implement without tests first**
2. **Never mark task complete with failing tests**
3. **Never skip acceptance criteria**
4. **Always emit audit events for side effects**
5. **Always include tenant_id in queries**
6. **Always use secret references (never raw keys)**
7. **Always check kill switches before side effects**

### Spec-Driven Development (SDD)

Before writing any code:
1. Read all referenced spec documents
2. Identify required entities/interfaces from specs
3. Note any constraints or invariants
4. Design tests that verify spec compliance

### Quality Gates

Before marking any task complete:
- [ ] All acceptance criteria checked
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] No TODO/FIXME comments without linked issues
- [ ] Security checklist verified

---

## Parallel Execution Model

Each sprint has 4 agents (A, B, C, D) that work in parallel:

```
Time ─────────────────────────────────────────────────►

Sprint N:
  Agent A: ████ A1 ███ A2 ███ A3 ███ A4 ███ A5 ███
  Agent B: ████ B1 ███ B2 ███ B3 ███ B4 ███ B5 ███
  Agent C: ████ C1 ███ C2 ███ C3 ███ C4 ███ C5 ███
  Agent D: ████ D1 ███ D2 ███ D3 ███ D4 ███ D5 ███
```

**Within an agent track:** Tasks are sequential (A2 depends on A1)
**Across agent tracks:** Tasks are parallel (A1, B1, C1, D1 can run simultaneously)

---

## Task JSON Schema

Every build prompt includes a machine-parseable JSON block:

```json
{
  "task_id": "S0-A1",
  "name": "Initialize Monorepo Structure",
  "sprint": 0,
  "agent": "A",
  "status": "pending",
  "tests_status": "not_written",
  "dependencies": [],
  "blocks": ["S0-A2", "S0-A3"],
  "estimated_complexity": "medium",
  "estimated_hours": 2,
  "spec_references": ["/docs/..."],
  "acceptance_criteria": ["..."],
  "test_files": ["..."],
  "created_files": ["..."]
}
```

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Not started |
| `in_progress` | Currently being worked on |
| `blocked` | Waiting on dependency |
| `review` | Completed, awaiting review |
| `complete` | Done and verified |
| `failed` | Encountered unresolvable issue |

### Test Status Values

| Status | Meaning |
|--------|---------|
| `not_written` | Tests not yet created |
| `failing` | Tests written but failing (RED phase) |
| `passing` | All tests passing (GREEN phase) |

---

## Spec Reference Map

| Domain | Primary Spec Documents |
|--------|----------------------|
| Architecture | `docs/01-architecture/system-architecture-v3.md` |
| RLM Integration | `docs/01-architecture/rlm-integration-spec.md` |
| Data Schemas | `docs/02-schemas/external-memory-schema.md` |
| Agent Contracts | `docs/03-agents-tools/agent-recursion-contracts.md` |
| Browser Lane | `docs/04-browser-lane/browser-automation-profile-vault.md` |
| Security | `docs/05-policy-safety/multi-tenant-isolation.md` |
| Policy | `docs/05-policy-safety/compliance-policy-binder.md` |
| SLOs | `docs/06-reliability-ops/slo-error-budget.md` |
| Engineering | `docs/07-engineering-process/engineering-handbook.md` |
| Testing | `docs/07-engineering-process/testing-strategy.md` |
| CI/CD | `docs/07-engineering-process/ci-cd-spec.md` |

---

## Security Requirements (All Tasks)

### Tenant Isolation (Mandatory for data operations)
- Every query includes `client_id` scoping
- Never access cross-tenant data
- Fail closed on missing tenant context

### Secrets Management
- Never store raw secrets in database
- Use `CredentialRef` pointers only
- Never log secrets or PII

### Side Effects (Publish, DM, Comment, Like)
- Always check kill switches first
- Always verify identity before action
- Always emit audit events with proof
- Always implement idempotency

---

## Getting Started

1. **Read the template:** [00-build-prompts-template.md](./00-build-prompts-template.md)
2. **Understand dependencies:** [01-dependency-graph.md](./01-dependency-graph.md)
3. **Start with Sprint 0:** [sprint-0/README.md](./sprint-0/README.md)
4. **Execute tasks in order:** S0-A1 → S0-A2 → ... → S0-D5

---

## Success Criteria

The PRD v2 is complete when:

- [ ] All 121 build prompts generated
- [ ] Every prompt includes TDD instructions
- [ ] Every prompt has JSON task block
- [ ] Every prompt references correct specs
- [ ] Dependency graph is complete
- [ ] All agents can execute in parallel within sprints

---

*Generated: 2025-01-16*
*Version: 2.0*
