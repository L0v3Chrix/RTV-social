# Context Injection Guide

This document explains how build prompts reference existing specification documents without duplicating content.

---

## Core Principle: Reference, Don't Duplicate

Build prompts should **reference** existing specs rather than copying content. This ensures:

1. **Single source of truth** — Specs can be updated without updating 121 prompts
2. **Maintainability** — Prompts stay focused on "how to build"
3. **Consistency** — All tasks refer to the same authoritative specs

---

## Reference Patterns

### Pattern 1: Spec Reference Block

Use at the top of each prompt's Context section:

```markdown
**Spec References:**
- `/docs/01-architecture/system-architecture-v3.md#5-data-model` — Entity definitions
- `/docs/05-policy-safety/multi-tenant-isolation.md#5-tenant-context` — TenantContext schema
- `/docs/07-engineering-process/testing-strategy.md#2-test-portfolio` — Test pyramid
```

**Guidelines:**
- Include full path from repo root
- Add section anchor if document is large
- Add brief description of what to find there

### Pattern 2: Inline Spec Excerpts

For critical constraints that MUST NOT be missed, quote the spec directly:

```markdown
**Critical Constraint (from multi-tenant-isolation.md):**

> Every request, job, tool call, and side-effect must be scoped by:
> - `tenant_id` (required)
> - `platform_account_id` (required for platform actions)
> - `lane` (api|browser)
>
> Missing tenant context = operation fails closed.
```

**When to use:**
- Security constraints
- Non-negotiable invariants
- Easy-to-miss requirements

### Pattern 3: Schema Reference

When implementing data models, reference the schema spec:

```markdown
**Required Schema (from external-memory-schema.md#plan-node):**

Implement the `PlanNode` entity with these fields:
- See spec for complete field list
- Pay attention to: `node_type` enum values, required vs optional fields
- Ensure `client_id` foreign key for tenant isolation
```

### Pattern 4: Pattern Reference

When implementing patterns that exist elsewhere:

```markdown
**Implementation Pattern (from agent-recursion-contracts.md#4-recursion-classes):**

Follow the Class A (Retrieval) recursion pattern:
1. Read minimal state (goal + last summaries)
2. Query environment for evidence slices
3. Interpret evidence, propose action
4. Persist decision, summary, audits

See spec for budget enforcement rules.
```

---

## Spec Document Index

### Architecture & System Design

| Document | Key Sections | Used In |
|----------|--------------|---------|
| `docs/01-architecture/system-architecture-v3.md` | Data model, Runtime components, Execution lanes | Sprint 0-5 |
| `docs/01-architecture/rlm-integration-spec.md` | RLM concepts, Episode model, Tool patterns | Sprint 1-4 |
| `docs/01-architecture/recursive-system-diagram.md` | Visual architecture | Reference only |

### Schemas & Data Models

| Document | Key Sections | Used In |
|----------|--------------|---------|
| `docs/02-schemas/external-memory-schema.md` | Plan Graph, Asset Graph, Conversation, Events | Sprint 1-4 |
| `docs/02-schemas/onboarding-brand-kit-schema.md` | BrandKit, KnowledgeBase, ClientKeyring | Sprint 1-2 |

### Agents & Tools

| Document | Key Sections | Used In |
|----------|--------------|---------|
| `docs/03-agents-tools/agent-tool-registry.md` | Agent roster, Tool workflows, MCP catalog | Sprint 1-4 |
| `docs/03-agents-tools/agent-recursion-contracts.md` | Recursion policy, Read/write contracts, Stop conditions | Sprint 1-4 |
| `docs/03-agents-tools/rlm-agent-prompt-architecture.md` | Prompt stack, Agent skeletons | Sprint 2-4 |
| `docs/03-agents-tools/evaluation-loops.md` | Two-stage evaluation, Checklists, Critique loop | Sprint 2-4 |

### Browser Lane

| Document | Key Sections | Used In |
|----------|--------------|---------|
| `docs/04-browser-lane/browser-automation-profile-vault.md` | Profile Vault, Runner, Workflows, Evidence | Sprint 3 |

### Security & Policy

| Document | Key Sections | Used In |
|----------|--------------|---------|
| `docs/05-policy-safety/multi-tenant-isolation.md` | TenantContext, Isolation layers, CI tests | Sprint 0-5 |
| `docs/05-policy-safety/rbac-operator-permissioning.md` | Roles, Permissions, Risk tiers | Sprint 1, 5 |
| `docs/05-policy-safety/secrets-key-management.md` | CredentialRef, Vault patterns, Rotation | Sprint 0-1 |
| `docs/05-policy-safety/compliance-policy-binder.md` | Autonomy tiers, Platform posture | Sprint 1, 3-5 |
| `docs/05-policy-safety/side-effect-safety-spec.md` | Idempotency, Proof, Verification | Sprint 3-4 |
| `docs/05-policy-safety/threat-model.md` | Top threats, Mitigations | Reference only |

### Reliability & Operations

| Document | Key Sections | Used In |
|----------|--------------|---------|
| `docs/06-reliability-ops/slo-error-budget.md` | SLO targets, Burn rate, Shipping gates | Sprint 0, 3-5 |
| `docs/06-reliability-ops/observability-dashboard.md` | Metrics, Dashboards, Check-in protocol | Sprint 0, 5 |
| `docs/06-reliability-ops/incident-runbooks-postmortem.md` | Runbooks, Incident workflow | Sprint 5 |
| `docs/06-reliability-ops/cost-latency-budgets.md` | Episode budgets, Provider limits | Sprint 1-2 |

### Engineering Process

| Document | Key Sections | Used In |
|----------|--------------|---------|
| `docs/07-engineering-process/engineering-handbook.md` | TDD, PR discipline, Code structure | Sprint 0-5 |
| `docs/07-engineering-process/testing-strategy.md` | Test pyramid, Golden paths, CI gates | Sprint 0, 5 |
| `docs/07-engineering-process/ci-cd-spec.md` | Pipelines, Environments, Branch protection | Sprint 0 |
| `docs/07-engineering-process/feature-flag-governance.md` | Flag lifecycle, Rollout rules | Sprint 5 |
| `docs/07-engineering-process/release-rollback-playbook.md` | Release process, Rollback triggers | Sprint 5 |

### Platform Specifics

| Document | Key Sections | Used In |
|----------|--------------|---------|
| `docs/09-platform-playbooks/platform-algorithm-playbooks.md` | Per-platform strategies | Sprint 2-4 |

---

## Spec-to-Sprint Mapping

### Sprint 0: Foundation

**Primary specs:**
- `engineering-handbook.md` — Build culture, code structure
- `ci-cd-spec.md` — Pipeline configuration
- `testing-strategy.md` — Test portfolio
- `multi-tenant-isolation.md` — Schema requirements
- `secrets-key-management.md` — Environment variables

### Sprint 1: Core Infrastructure

**Primary specs:**
- `system-architecture-v3.md` — Data model
- `external-memory-schema.md` — Memory domains
- `rlm-integration-spec.md` — RLMEnv, episodes
- `agent-recursion-contracts.md` — Recursion policy
- `compliance-policy-binder.md` — Autonomy tiers
- `cost-latency-budgets.md` — Budget enforcement

### Sprint 2: Planning + Creation

**Primary specs:**
- `external-memory-schema.md` — Plan Graph
- `onboarding-brand-kit-schema.md` — BrandKit context
- `rlm-agent-prompt-architecture.md` — Agent prompts
- `evaluation-loops.md` — QA scoring
- `platform-algorithm-playbooks.md` — Hook patterns

### Sprint 3: Scheduling + Publishing

**Primary specs:**
- `system-architecture-v3.md` — Calendar, lanes
- `browser-automation-profile-vault.md` — Profile Vault, Runner
- `side-effect-safety-spec.md` — Idempotency, proof
- `slo-error-budget.md` — Publish success SLO
- `platform-algorithm-playbooks.md` — Per-platform rules

### Sprint 4: Engagement

**Primary specs:**
- `external-memory-schema.md` — Conversation memory
- `agent-recursion-contracts.md` — Engagement agent
- `rlm-agent-prompt-architecture.md` — Reply agent
- `evaluation-loops.md` — Reply safety
- `compliance-policy-binder.md` — Escalation triggers

### Sprint 5: Gated Rollout

**Primary specs:**
- `slo-error-budget.md` — Success metrics
- `feature-flag-governance.md` — Flag setup
- `release-rollback-playbook.md` — Rollout plan
- `incident-runbooks-postmortem.md` — Runbooks
- `testing-strategy.md` — E2E test suite

---

## Reference Syntax Examples

### Good References

```markdown
**Spec References:**
- `/docs/05-policy-safety/multi-tenant-isolation.md#5-tenant-context-propagation`
  TenantContext object schema with required fields
```

```markdown
**Critical Constraint (from multi-tenant-isolation.md §2.1):**
> Deny-by-default: missing tenant context = operation fails closed
```

```markdown
See `/docs/03-agents-tools/agent-recursion-contracts.md#3-recursion-policy`
for RecursionPolicy schema (max_depth, allowed_child_types, stop_conditions).
```

### Bad References

```markdown
See the security docs for more info.
```
(Too vague — which doc? which section?)

```markdown
Follow the patterns in the architecture document.
```
(Which patterns? Where?)

---

## Verification Checklist

Before completing a build prompt, verify:

- [ ] All spec references use full paths from repo root
- [ ] Section anchors are valid (check document headings)
- [ ] Critical constraints are quoted inline
- [ ] No large spec content duplicated (reference instead)
- [ ] Agent can find referenced sections without ambiguity
