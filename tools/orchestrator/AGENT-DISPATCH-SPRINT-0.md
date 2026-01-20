# Sprint 0 Agent Dispatch Prompts

> **Copy-paste ready prompts for 4 parallel AI coding agents**
> 
> ⚠️ **EXECUTION ORDER**: Only Agent A (S0-A1) can start immediately. Agents B, C, D must wait for their dependencies.

---

## 🚀 Agent A — S0-A1: Monorepo Scaffold

**Status**: ✅ READY TO START (no dependencies)

```markdown
# Task: S0-A1 — Monorepo Scaffold

## Context
You are Agent A working on the RTV Autonomous Social Media Operating System. This is Sprint 0, Task 1 — the foundational monorepo setup that all other tasks depend on.

## Objective
Create a production-grade Turborepo monorepo with pnpm workspaces, establishing the folder structure for all packages and apps.

## Pre-Implementation Checklist
- [ ] Read: `docs/01-architecture/monorepo-structure.md`
- [ ] Read: `docs/07-engineering-process/coding-standards.md`
- [ ] Verify Node.js 20+ and pnpm 8+ available

## TDD Methodology
Follow RED → GREEN → REFACTOR:
1. **RED**: Write failing tests first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping tests green

## Acceptance Criteria
1. `turbo.json` exists with pipeline for `build`, `test`, `lint`, `typecheck`
2. Root `package.json` has:
   - `"packageManager": "pnpm@8.x.x"`
   - `"workspaces"` pointing to `packages/*` and `apps/*`
3. Folder structure created:
   ```
   packages/
     core/           # Shared utilities, types
     db/             # Drizzle schemas, migrations
     api-client/     # Generated API clients
     ui/             # Shared React components (if needed)
   apps/
     api/            # Fastify API server
     web/            # Next.js dashboard (future)
     worker/         # Background job processor
   ```
4. Each package has minimal `package.json` with `name` scoped to `@rtv/*`
5. Root `tsconfig.json` with path aliases configured
6. `pnpm install` succeeds with no errors
7. `turbo run build` executes (even if packages are empty stubs)

## Test Requirements
Create `tools/orchestrator/tests/s0-a1.test.ts`:
```typescript
describe('S0-A1: Monorepo Scaffold', () => {
  it('should have turbo.json with required pipelines', async () => {
    const turboConfig = await import('../../../turbo.json');
    expect(turboConfig.pipeline).toHaveProperty('build');
    expect(turboConfig.pipeline).toHaveProperty('test');
    expect(turboConfig.pipeline).toHaveProperty('lint');
  });

  it('should have all package directories', () => {
    const requiredDirs = [
      'packages/core',
      'packages/db', 
      'packages/api-client',
      'apps/api',
      'apps/worker'
    ];
    requiredDirs.forEach(dir => {
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  it('should have valid workspace configuration', async () => {
    const rootPkg = await import('../../../package.json');
    expect(rootPkg.workspaces).toContain('packages/*');
    expect(rootPkg.workspaces).toContain('apps/*');
  });
});
```

## Deliverables
- [ ] `turbo.json`
- [ ] Root `package.json`
- [ ] Root `tsconfig.json`
- [ ] `packages/core/package.json`
- [ ] `packages/db/package.json`
- [ ] `packages/api-client/package.json`
- [ ] `apps/api/package.json`
- [ ] `apps/worker/package.json`
- [ ] `pnpm-workspace.yaml`
- [ ] Tests passing

## Blocks
This task blocks: S0-A2, S0-A3, S0-B1, S0-B2, S0-C1, S0-C2, S0-D2

## Estimated Time
2-3 hours

## On Completion
Run: `cd tools/orchestrator && pnpm tsx src/cli.ts complete S0-A1`
```

---

## 🗄️ Agent B — S0-B1: PostgreSQL Connection Pool

**Status**: ⏳ BLOCKED (waiting for S0-A1)

```markdown
# Task: S0-B1 — PostgreSQL Connection Pool

## Context
You are Agent B working on the RTV Autonomous Social Media Operating System. This is Sprint 0, Task 1 for your track — establishing the database connection layer.

## Dependencies
- ⏳ **S0-A1** (Monorepo Scaffold) — MUST BE COMPLETE FIRST

## Objective
Set up PostgreSQL connection pooling using `postgres.js` with proper connection management, health checks, and graceful shutdown.

## Pre-Implementation Checklist
- [ ] Verify S0-A1 is complete (monorepo structure exists)
- [ ] Read: `docs/02-schemas/database-design.md`
- [ ] Read: `docs/06-reliability-ops/database-operations.md`
- [ ] Ensure PostgreSQL 15+ is available (local or Docker)

## TDD Methodology
Follow RED → GREEN → REFACTOR:
1. **RED**: Write failing tests first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping tests green

## Acceptance Criteria
1. `packages/db/src/connection.ts` exports:
   - `createPool(config: PoolConfig): Pool`
   - `getPool(): Pool` (singleton accessor)
   - `closePool(): Promise<void>`
2. Connection config supports:
   - `DATABASE_URL` environment variable
   - Individual `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
   - Connection pool size (min/max)
   - Statement timeout
   - Idle timeout
3. Health check function: `checkConnection(): Promise<boolean>`
4. Graceful shutdown on `SIGTERM`/`SIGINT`
5. Connection retry with exponential backoff
6. TypeScript strict mode, no `any` types

## Test Requirements
Create `packages/db/src/__tests__/connection.test.ts`:
```typescript
describe('S0-B1: PostgreSQL Connection Pool', () => {
  it('should create pool with DATABASE_URL', async () => {
    const pool = createPool({ connectionString: process.env.DATABASE_URL });
    expect(pool).toBeDefined();
    await closePool();
  });

  it('should return singleton pool instance', () => {
    const pool1 = getPool();
    const pool2 = getPool();
    expect(pool1).toBe(pool2);
  });

  it('should pass health check with valid connection', async () => {
    const healthy = await checkConnection();
    expect(healthy).toBe(true);
  });

  it('should handle connection failure gracefully', async () => {
    const pool = createPool({ connectionString: 'postgres://invalid' });
    const healthy = await checkConnection();
    expect(healthy).toBe(false);
  });

  it('should close pool cleanly', async () => {
    await closePool();
    // Attempting query should fail or reconnect
  });
});
```

## Deliverables
- [ ] `packages/db/package.json` (add postgres.js dependency)
- [ ] `packages/db/src/connection.ts`
- [ ] `packages/db/src/config.ts` (env parsing)
- [ ] `packages/db/src/__tests__/connection.test.ts`
- [ ] `packages/db/src/index.ts` (exports)
- [ ] Tests passing

## Blocks
This task blocks: S0-B2, S0-B3, S1-B1

## Estimated Time
2-3 hours

## On Completion
Run: `cd tools/orchestrator && pnpm tsx src/cli.ts complete S0-B1`
```

---

## 🔄 Agent C — S0-C1: GitHub Actions CI Pipeline

**Status**: ⏳ BLOCKED (waiting for S0-A1)

```markdown
# Task: S0-C1 — GitHub Actions CI Pipeline

## Context
You are Agent C working on the RTV Autonomous Social Media Operating System. This is Sprint 0, Task 1 for your track — establishing the CI/CD foundation.

## Dependencies
- ⏳ **S0-A1** (Monorepo Scaffold) — MUST BE COMPLETE FIRST

## Objective
Create GitHub Actions workflows for continuous integration: linting, type checking, testing, and build verification on every PR.

## Pre-Implementation Checklist
- [ ] Verify S0-A1 is complete (turbo.json exists)
- [ ] Read: `docs/07-engineering-process/ci-cd-pipeline.md`
- [ ] Read: `docs/07-engineering-process/coding-standards.md`

## TDD Methodology
Follow RED → GREEN → REFACTOR:
1. **RED**: Write failing workflow validation first
2. **GREEN**: Create workflows that pass validation
3. **REFACTOR**: Optimize caching and parallelism

## Acceptance Criteria
1. `.github/workflows/ci.yml` triggers on:
   - Push to `main`
   - Pull requests to `main`
2. CI pipeline runs in parallel:
   - `lint` — ESLint + Prettier check
   - `typecheck` — TypeScript compilation
   - `test` — Vitest unit tests
   - `build` — Turbo build pipeline
3. Uses pnpm caching via `actions/setup-node` + `actions/cache`
4. Turborepo remote caching configured (optional but preferred)
5. Matrix strategy for Node.js 20.x
6. Concurrency control to cancel outdated runs
7. Status checks required for PR merge (documented)

## Workflow Template
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      # ... similar setup
      - run: pnpm turbo typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      # ... similar setup
      - run: pnpm turbo test

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      # ... similar setup
      - run: pnpm turbo build
```

## Test Requirements
Create `.github/workflows/__tests__/ci.test.ts`:
```typescript
describe('S0-C1: GitHub Actions CI', () => {
  it('should have valid workflow YAML syntax', async () => {
    const yaml = await import('yaml');
    const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(() => yaml.parse(workflow)).not.toThrow();
  });

  it('should trigger on push and PR to main', async () => {
    const workflow = loadWorkflow('.github/workflows/ci.yml');
    expect(workflow.on.push.branches).toContain('main');
    expect(workflow.on.pull_request.branches).toContain('main');
  });

  it('should have all required jobs', async () => {
    const workflow = loadWorkflow('.github/workflows/ci.yml');
    expect(workflow.jobs).toHaveProperty('lint');
    expect(workflow.jobs).toHaveProperty('typecheck');
    expect(workflow.jobs).toHaveProperty('test');
    expect(workflow.jobs).toHaveProperty('build');
  });

  it('should use pnpm caching', async () => {
    const workflow = loadWorkflow('.github/workflows/ci.yml');
    const lintJob = workflow.jobs.lint;
    const setupNode = lintJob.steps.find(s => s.uses?.includes('setup-node'));
    expect(setupNode.with.cache).toBe('pnpm');
  });
});
```

## Deliverables
- [ ] `.github/workflows/ci.yml`
- [ ] `.github/workflows/__tests__/ci.test.ts`
- [ ] Root `eslint.config.js` (if not exists)
- [ ] Root `prettier.config.js` (if not exists)
- [ ] Documentation: which checks are required for merge
- [ ] Tests passing

## Blocks
This task blocks: S0-C2, S0-C3, S1-C1

## Estimated Time
2-3 hours

## On Completion
Run: `cd tools/orchestrator && pnpm tsx src/cli.ts complete S0-C1`
```

---

## 📊 Agent D — S0-D1: OpenTelemetry Foundation

**Status**: ⏳ BLOCKED (waiting for S0-A3)

```markdown
# Task: S0-D1 — OpenTelemetry Foundation

## Context
You are Agent D working on the RTV Autonomous Social Media Operating System. This is Sprint 0, Task 1 for your track — establishing observability infrastructure.

## Dependencies
- ⏳ **S0-A3** (Shared Types Package) — MUST BE COMPLETE FIRST
  - Note: S0-A3 depends on S0-A2, which depends on S0-A1
  - This task is deeper in the dependency chain

## Objective
Set up OpenTelemetry SDK with tracing, metrics, and logging foundations that all services will use.

## Pre-Implementation Checklist
- [ ] Verify S0-A3 is complete (packages/core exists with types)
- [ ] Read: `docs/06-reliability-ops/observability-strategy.md`
- [ ] Read: `docs/01-architecture/system-overview.md`

## TDD Methodology
Follow RED → GREEN → REFACTOR:
1. **RED**: Write failing tests for telemetry setup
2. **GREEN**: Implement minimal SDK configuration
3. **REFACTOR**: Add exporters and optimize

## Acceptance Criteria
1. `packages/core/src/telemetry/` module exports:
   - `initTelemetry(config: TelemetryConfig): void`
   - `getTracer(name: string): Tracer`
   - `getMeter(name: string): Meter`
   - `shutdownTelemetry(): Promise<void>`
2. Configuration supports:
   - Service name and version
   - Environment (development/staging/production)
   - OTLP endpoint URL
   - Sampling rate
   - Export interval
3. Automatic instrumentation for:
   - HTTP requests (incoming and outgoing)
   - PostgreSQL queries
   - Console logging correlation
4. Resource attributes include:
   - `service.name`
   - `service.version`
   - `deployment.environment`
   - `host.name`
5. Graceful shutdown with flush on `SIGTERM`
6. Works in both API and Worker contexts

## Test Requirements
Create `packages/core/src/telemetry/__tests__/telemetry.test.ts`:
```typescript
describe('S0-D1: OpenTelemetry Foundation', () => {
  beforeEach(() => {
    // Reset telemetry between tests
  });

  it('should initialize with valid config', () => {
    initTelemetry({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test'
    });
    // Verify no errors
  });

  it('should return consistent tracer instance', () => {
    const tracer1 = getTracer('test');
    const tracer2 = getTracer('test');
    expect(tracer1).toBe(tracer2);
  });

  it('should return consistent meter instance', () => {
    const meter1 = getMeter('test');
    const meter2 = getMeter('test');
    expect(meter1).toBe(meter2);
  });

  it('should create spans with correct attributes', async () => {
    const tracer = getTracer('test');
    const span = tracer.startSpan('test-operation');
    span.setAttribute('test.key', 'value');
    span.end();
    // Verify span was recorded
  });

  it('should shutdown cleanly', async () => {
    await shutdownTelemetry();
    // Verify all spans flushed
  });

  it('should include resource attributes', () => {
    const resource = getResource();
    expect(resource.attributes['service.name']).toBe('test-service');
    expect(resource.attributes['deployment.environment']).toBe('test');
  });
});
```

## Deliverables
- [ ] `packages/core/package.json` (add @opentelemetry/* dependencies)
- [ ] `packages/core/src/telemetry/index.ts`
- [ ] `packages/core/src/telemetry/config.ts`
- [ ] `packages/core/src/telemetry/tracer.ts`
- [ ] `packages/core/src/telemetry/meter.ts`
- [ ] `packages/core/src/telemetry/resource.ts`
- [ ] `packages/core/src/telemetry/__tests__/telemetry.test.ts`
- [ ] Tests passing

## Blocks
This task blocks: S0-D2, S0-D3, S1-D1

## Estimated Time
3-4 hours

## On Completion
Run: `cd tools/orchestrator && pnpm tsx src/cli.ts complete S0-D1`
```

---

## 📋 Execution Order Summary

| Order | Task | Agent | Depends On | Status |
|-------|------|-------|------------|--------|
| 1 | S0-A1 | Agent A | (none) | ✅ Ready |
| 2 | S0-B1 | Agent B | S0-A1 | ⏳ Blocked |
| 2 | S0-C1 | Agent C | S0-A1 | ⏳ Blocked |
| 3 | S0-A2 | Agent A | S0-A1 | ⏳ Blocked |
| 4 | S0-A3 | Agent A | S0-A2 | ⏳ Blocked |
| 5 | S0-D1 | Agent D | S0-A3 | ⏳ Blocked |

### Recommended Workflow

1. **Start Agent A** with S0-A1 immediately
2. **Wait** for S0-A1 completion notification
3. **Start Agents B + C** in parallel (both depend only on S0-A1)
4. **Agent A continues** to S0-A2, then S0-A3
5. **Start Agent D** once S0-A3 completes

### Orchestrator Commands

```bash
# Check what's ready to start
cd tools/orchestrator && pnpm tsx src/cli.ts next

# View full execution plan
cd tools/orchestrator && pnpm tsx src/cli.ts plan

# Mark task complete (unlocks dependents)
cd tools/orchestrator && pnpm tsx src/cli.ts complete S0-A1
```

---

## 🔔 Agent Communication Protocol

When copying these prompts to your AI agents, add this preamble:

```markdown
## Inter-Agent Communication

When you complete this task:
1. Ensure all tests pass: `pnpm test`
2. Ensure lint passes: `pnpm lint`
3. Commit with message: `feat(sprint-0): complete [TASK-ID] - [description]`
4. Report completion to orchestrator: `cd tools/orchestrator && pnpm tsx src/cli.ts complete [TASK-ID]`
5. Notify coordinator that dependent tasks are now unblocked

If you encounter blockers:
1. Document the blocker in your task notes
2. Check if a dependency is incomplete
3. Report to coordinator for task reassignment
```
