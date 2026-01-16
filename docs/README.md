# Documentation Index

**Project:** Autonomous Social Media Operating System
**Client:** Internal RTV Product
**Status:** PRD Phase → Sprint 0

---

## Documentation Structure

### 00 — Overview
Project scope, vision, and documentation roadmap.

| Document | Description |
|----------|-------------|
| [executive-summary-v3.md](./00-overview/executive-summary-v3.md) | North star: outcomes, platform coverage, autonomy stages, creative blueprints |
| [documentation-index.md](./00-overview/documentation-index.md) | Master index and build handoff instructions |
| [remaining-docs-recommendations.md](./00-overview/remaining-docs-recommendations.md) | Gap analysis and additional docs needed |

---

### 01 — Architecture
System design, data model, and RLM integration.

| Document | Description |
|----------|-------------|
| [system-architecture-v3.md](./01-architecture/system-architecture-v3.md) | Canonical system components + data model |
| [recursive-system-diagram.md](./01-architecture/recursive-system-diagram.md) | End-to-end conceptual diagram |
| [rlm-integration-spec.md](./01-architecture/rlm-integration-spec.md) | RLM paradigm integration spec |

---

### 02 — Schemas
Data models and onboarding contracts.

| Document | Description |
|----------|-------------|
| [onboarding-brand-kit-schema.md](./02-schemas/onboarding-brand-kit-schema.md) | Brand kit, KB ingestion, BYOK keyring |
| [external-memory-schema.md](./02-schemas/external-memory-schema.md) | External memory model for RLM systems |

---

### 03 — Agents & Tools
Agent architecture, tool registry, and recursion contracts.

| Document | Description |
|----------|-------------|
| [agent-tool-registry.md](./03-agents-tools/agent-tool-registry.md) | Tool registry, MCP gateway patterns |
| [agent-recursion-contracts.md](./03-agents-tools/agent-recursion-contracts.md) | Read/write permissions, stop conditions |
| [rlm-agent-prompt-architecture.md](./03-agents-tools/rlm-agent-prompt-architecture.md) | RLM to orchestrator/subagent mapping |
| [rlm-prompt-mapping.md](./03-agents-tools/rlm-prompt-mapping.md) | Additional RLM prompt mapping |
| [evaluation-loops.md](./03-agents-tools/evaluation-loops.md) | Self-critique vs human intervention |

---

### 04 — Browser Lane
Browser automation, profile vault, and runner design.

| Document | Description |
|----------|-------------|
| [browser-automation-profile-vault.md](./04-browser-lane/browser-automation-profile-vault.md) | Browser lane architecture, drift detection |

---

### 05 — Policy & Safety
Security, compliance, and governance.

| Document | Description |
|----------|-------------|
| [compliance-policy-binder.md](./05-policy-safety/compliance-policy-binder.md) | Policies, approval rules, kill switches |
| [side-effect-safety-spec.md](./05-policy-safety/side-effect-safety-spec.md) | Guardrails for publish/DM/comment flows |
| [threat-model.md](./05-policy-safety/threat-model.md) | Security threat analysis + data flows |
| [security-verification-plan.md](./05-policy-safety/security-verification-plan.md) | ASVS-mapped security checks |
| [secrets-key-management.md](./05-policy-safety/secrets-key-management.md) | BYOK handling, rotation, break-glass |
| [rbac-operator-permissioning.md](./05-policy-safety/rbac-operator-permissioning.md) | Operator roles and permissions |
| [multi-tenant-isolation.md](./05-policy-safety/multi-tenant-isolation.md) | Tenant isolation rules |
| [degraded-mode-fallback.md](./05-policy-safety/degraded-mode-fallback.md) | Failure mode handling |
| [data-retention-privacy.md](./05-policy-safety/data-retention-privacy.md) | Data retention and privacy |
| [dependency-supply-chain.md](./05-policy-safety/dependency-supply-chain.md) | Dependency controls |

---

### 06 — Reliability & Ops
SLOs, incidents, and observability.

| Document | Description |
|----------|-------------|
| [slo-error-budget.md](./06-reliability-ops/slo-error-budget.md) | Reliability targets + error budget policy |
| [incident-runbooks-postmortem.md](./06-reliability-ops/incident-runbooks-postmortem.md) | Incident response + postmortem template |
| [observability-dashboard.md](./06-reliability-ops/observability-dashboard.md) | Operating dashboard spec |
| [sandbox-account-ops.md](./06-reliability-ops/sandbox-account-ops.md) | Sandbox account maintenance |
| [cost-latency-budgets.md](./06-reliability-ops/cost-latency-budgets.md) | Cost and latency guardrails |

---

### 07 — Engineering Process
Development practices, CI/CD, and testing.

| Document | Description |
|----------|-------------|
| [engineering-handbook.md](./07-engineering-process/engineering-handbook.md) | Build culture and execution system |
| [definition-of-done-pr-checklist.md](./07-engineering-process/definition-of-done-pr-checklist.md) | Quality gates per PR |
| [testing-strategy.md](./07-engineering-process/testing-strategy.md) | Test pyramid + critical path matrix |
| [ci-cd-spec.md](./07-engineering-process/ci-cd-spec.md) | CI/CD gates and progressive delivery |
| [release-rollback-playbook.md](./07-engineering-process/release-rollback-playbook.md) | Release levels, canaries, rollback |
| [feature-flag-governance.md](./07-engineering-process/feature-flag-governance.md) | Flag naming and approval workflow |
| [agent-prompt-ops-manual.md](./07-engineering-process/agent-prompt-ops-manual.md) | Prompt versioning and operations |
| [development-accounts-checklist.md](./07-engineering-process/development-accounts-checklist.md) | Required accounts for development |
| [tenancy-e2e-test-harness.md](./07-engineering-process/tenancy-e2e-test-harness.md) | Multi-tenant E2E testing |

---

### 08 — Growth & Experiments
Experimentation and adaptive learning.

| Document | Description |
|----------|-------------|
| [experimentation-os.md](./08-growth-experiments/experimentation-os.md) | Experiment tagging and isolation |
| [adaptive-learning-roadmap.md](./08-growth-experiments/adaptive-learning-roadmap.md) | System learning + v2 metrics |

---

### 09 — Platform Playbooks
Per-platform strategies and guardrails.

| Document | Description |
|----------|-------------|
| [platform-algorithm-playbooks.md](./09-platform-playbooks/platform-algorithm-playbooks.md) | Platform-specific content and engagement |

---

### ADR — Architecture Decision Records
Significant architectural decisions.

| Document | Description |
|----------|-------------|
| [adr-index.md](./adr/adr-index.md) | Index of all ADRs |
| [ADR-0000-adr-process.md](./adr/ADR-0000-adr-process.md) | ADR process and templates |

---

### Runbooks — Operational Procedures
Incident response and operational runbooks.

| Document | Description |
|----------|-------------|
| [README.md](./runbooks/README.md) | Runbooks index |
| [RB-01 through RB-12](./runbooks/) | Individual runbooks for specific scenarios |

---

## Quick Stats

- **Total Documents:** 54+
- **Categories:** 12
- **Runbooks:** 12
- **Planned ADRs:** 17

---

## Navigation

**Start Here:**
1. [Executive Summary](./00-overview/executive-summary-v3.md) — Project vision
2. [System Architecture](./01-architecture/system-architecture-v3.md) — Technical overview
3. [Engineering Handbook](./07-engineering-process/engineering-handbook.md) — Development practices

**For Operators:**
- [Runbooks](./runbooks/README.md)
- [Incident Response](./06-reliability-ops/incident-runbooks-postmortem.md)
- [Observability Dashboard](./06-reliability-ops/observability-dashboard.md)

**For Developers:**
- [ADR Index](./adr/adr-index.md)
- [Testing Strategy](./07-engineering-process/testing-strategy.md)
- [CI/CD Spec](./07-engineering-process/ci-cd-spec.md)
