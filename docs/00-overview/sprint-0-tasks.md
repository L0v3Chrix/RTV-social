# Sprint 0: Foundation

**Duration:** Weeks 1-2
**Goal:** Establish repository structure, database schema, CI/CD, and observability baseline.

---

## Parallelizable Work

### Agent A: Repository & Core Packages
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| A1 | Initialize monorepo structure (Turborepo) | `pnpm install` succeeds, workspaces configured |
| A2 | TypeScript configuration (strict mode) | `pnpm typecheck` passes |
| A3 | Core packages scaffold | `@rtv/core`, `@rtv/types`, `@rtv/utils` exist |
| A4 | ESLint + Prettier configuration | `pnpm lint` passes on all packages |
| A5 | Shared tsconfig inheritance | All packages extend base config |

### Agent B: Database Schema
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| B1 | Postgres connection setup | Connection succeeds in dev |
| B2 | Core schema migrations | `clients`, `brand_kits`, `knowledge_bases` tables |
| B3 | Multi-tenant schema | `client_id` on all relevant tables |
| B4 | Audit event schema | `audit_events` table with proof column |
| B5 | Seed data scripts | Test data for development |

### Agent C: CI/CD Pipeline
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| C1 | GitHub Actions workflow | Lint + typecheck on PR |
| C2 | Required checks configuration | PRs blocked without passing checks |
| C3 | Branch protection rules | Main branch protected |
| C4 | Deployment preview config | Preview deployments on PR |
| C5 | Environment variables setup | Secrets configured in GitHub |

### Agent D: Observability Baseline
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| D1 | OpenTelemetry instrumentation | Basic spans emitting |
| D2 | Structured logging setup | JSON logs with correlation IDs |
| D3 | Audit event framework | `AuditEvent.emit()` available |
| D4 | Error tracking setup | Errors captured with context |
| D5 | Basic metrics collection | Request duration, error rates |

---

## Blocked Work (Requires Sprint 0 Completion)

| Task | Blocked By | Description |
|------|------------|-------------|
| Environment configuration | B1-B5 | Needs schema to configure |
| Basic API routes | A1-A5, B1-B5 | Needs packages and schema |

---

## Sprint 0 Outputs

### Code
- [ ] Monorepo structure with Turborepo
- [ ] Core packages (`@rtv/core`, `@rtv/types`, `@rtv/utils`)
- [ ] Database schema with migrations
- [ ] CI/CD pipeline configuration

### Tests
- [ ] Schema validation tests
- [ ] CI checks pass on all packages
- [ ] Migration up/down tests

### Telemetry
- [ ] Logging framework operational
- [ ] Basic OTEL instrumentation
- [ ] Audit event emission working

### Documentation
- [ ] `docs/00-overview/sprint-0-completion.md`

### ADRs
- [ ] ADR-0001: Monorepo Structure
- [ ] ADR-0002: Database Selection
- [ ] ADR-0003: Queue Architecture
- [ ] ADR-0004: Observability Strategy

---

## Definition of Done

- [ ] All A/B/C/D tasks completed
- [ ] CI pipeline green on main branch
- [ ] Database migrations run successfully
- [ ] Telemetry emitting in dev environment
- [ ] ADRs documented and merged
- [ ] Sprint completion doc written

---

*Sprint Owner:* TBD
*Review Date:* TBD
