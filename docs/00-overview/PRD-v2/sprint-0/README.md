# Sprint 0: Foundation

**Duration:** Weeks 1-2
**Goal:** Establish repository structure, database schema, CI/CD, and observability baseline.

---

## Sprint Overview

Sprint 0 lays the technical foundation for the entire RTV Social Automation Platform. All subsequent sprints depend on the infrastructure established here.

**Key Deliverables:**
- Monorepo structure with Turborepo
- Core packages (`@rtv/core`, `@rtv/types`, `@rtv/utils`)
- PostgreSQL database schema with multi-tenant isolation
- CI/CD pipeline with GitHub Actions
- Observability baseline with OpenTelemetry

---

## Task Inventory (20 Tasks)

### Agent A: Repository & Core Packages (5 Tasks)

| ID | Task | File | Complexity |
|----|------|------|------------|
| S0-A1 | Initialize monorepo (Turborepo) | [S0-A1-monorepo-scaffold.md](./S0-A1-monorepo-scaffold.md) | Medium |
| S0-A2 | TypeScript configuration | [S0-A2-typescript-config.md](./S0-A2-typescript-config.md) | Low |
| S0-A3 | Core packages scaffold | [S0-A3-core-packages.md](./S0-A3-core-packages.md) | Medium |
| S0-A4 | ESLint + Prettier setup | [S0-A4-linting-setup.md](./S0-A4-linting-setup.md) | Low |
| S0-A5 | Shared tsconfig inheritance | [S0-A5-tsconfig-inheritance.md](./S0-A5-tsconfig-inheritance.md) | Low |

### Agent B: Database Schema (5 Tasks)

| ID | Task | File | Complexity |
|----|------|------|------------|
| S0-B1 | Postgres connection setup | [S0-B1-postgres-connection.md](./S0-B1-postgres-connection.md) | Medium |
| S0-B2 | Core schema migrations | [S0-B2-core-schema.md](./S0-B2-core-schema.md) | High |
| S0-B3 | Multi-tenant schema | [S0-B3-multi-tenant-schema.md](./S0-B3-multi-tenant-schema.md) | High |
| S0-B4 | Audit event schema | [S0-B4-audit-schema.md](./S0-B4-audit-schema.md) | Medium |
| S0-B5 | Seed data scripts | [S0-B5-seed-scripts.md](./S0-B5-seed-scripts.md) | Low |

### Agent C: CI/CD Pipeline (5 Tasks)

| ID | Task | File | Complexity |
|----|------|------|------------|
| S0-C1 | GitHub Actions workflow | [S0-C1-github-actions.md](./S0-C1-github-actions.md) | Medium |
| S0-C2 | Required checks config | [S0-C2-required-checks.md](./S0-C2-required-checks.md) | Low |
| S0-C3 | Branch protection rules | [S0-C3-branch-protection.md](./S0-C3-branch-protection.md) | Low |
| S0-C4 | Preview deployment config | [S0-C4-preview-deployments.md](./S0-C4-preview-deployments.md) | Medium |
| S0-C5 | Environment variables setup | [S0-C5-env-variables.md](./S0-C5-env-variables.md) | Low |

### Agent D: Observability Baseline (5 Tasks)

| ID | Task | File | Complexity |
|----|------|------|------------|
| S0-D1 | OpenTelemetry instrumentation | [S0-D1-opentelemetry.md](./S0-D1-opentelemetry.md) | High |
| S0-D2 | Structured logging setup | [S0-D2-structured-logging.md](./S0-D2-structured-logging.md) | Medium |
| S0-D3 | Audit event framework | [S0-D3-audit-framework.md](./S0-D3-audit-framework.md) | High |
| S0-D4 | Error tracking setup | [S0-D4-error-tracking.md](./S0-D4-error-tracking.md) | Medium |
| S0-D5 | Basic metrics collection | [S0-D5-metrics-collection.md](./S0-D5-metrics-collection.md) | Medium |

---

## Dependency Graph

```
S0-A1 (monorepo) ──┬──► S0-A2 (typescript)
                   │        │
                   │        ▼
                   ├──► S0-A3 (packages) ──► S0-A5 (tsconfig)
                   │        │
                   │        ▼
                   └──► S0-A4 (linting)

S0-B1 (postgres) ──► S0-B2 (schema) ──► S0-B3 (multi-tenant)
                          │                    │
                          ▼                    ▼
                     S0-B4 (audit) ◄──────────┘
                          │
                          ▼
                     S0-B5 (seed)

S0-C1 (actions) ──► S0-C2 (checks) ──► S0-C3 (branch)
                          │
                          ▼
                     S0-C4 (preview) ──► S0-C5 (env)

S0-D1 (otel) ──┬──► S0-D2 (logging)
               │        │
               │        ▼
               ├──► S0-D3 (audit) ◄── (requires S0-B4)
               │        │
               │        ▼
               └──► S0-D4 (errors) ──► S0-D5 (metrics)
```

---

## Parallel Execution Model

**4 agents can work simultaneously:**

- **Agent A:** Repository & Core Packages (independent)
- **Agent B:** Database Schema (independent)
- **Agent C:** CI/CD Pipeline (independent)
- **Agent D:** Observability Baseline (depends on B4 for audit schema)

**Estimated parallel completion:** 2-3 days with 4 agents

---

## Sprint 0 Completion Criteria

- [ ] `pnpm install` succeeds in monorepo
- [ ] `pnpm typecheck` passes all packages
- [ ] `pnpm lint` passes all packages
- [ ] Database migrations run successfully
- [ ] CI pipeline green on main branch
- [ ] OpenTelemetry spans emitting
- [ ] Audit events can be recorded
- [ ] ADRs 0001-0004 documented

---

## Related ADRs

- ADR-0001: Monorepo Structure
- ADR-0002: Database Selection
- ADR-0003: Queue Architecture
- ADR-0004: Observability Strategy

---

## Spec References

- `/docs/07-engineering-process/engineering-handbook.md`
- `/docs/07-engineering-process/ci-cd-spec.md`
- `/docs/07-engineering-process/testing-strategy.md`
- `/docs/05-policy-safety/multi-tenant-isolation.md`
- `/docs/06-reliability-ops/observability-dashboard.md`
