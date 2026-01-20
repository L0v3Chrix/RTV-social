/**
 * RTV Social Automation - Task Registry
 *
 * Central registry of all 129 tasks across 6 sprints.
 * Includes 8 Tesla Mixed-Precision Enhancement tasks (ADR-0001).
 *
 * Task Naming Convention:
 *   S{sprint}-{track}{sequence}
 *   - Sprint: 0-5
 *   - Track: A (Agent), B (Backend), C (CLI), D (DevOps)
 *   - Sequence: 1-n
 *
 * @see docs/00-overview/PRD-v2/01-dependency-graph.md
 * @see docs/adr/ADR-0001-tesla-mixed-precision-patterns.md
 */

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
export type TaskTrack = 'A' | 'B' | 'C' | 'D';
export type Sprint = 0 | 1 | 2 | 3 | 4 | 5;

export interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  sprint: Sprint;
  track: TaskTrack;
  sequence: number;
  estimatedHours: number;
  dependencies: string[];
  blocks: string[];
  tags: string[];
  promptFile: string;
  status: TaskStatus;
  assignedAgent?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export const TASK_DEFINITIONS: TaskDefinition[] = [
  // ============================================================================
  // SPRINT 0: Foundation & Infrastructure (22 tasks)
  // ============================================================================

  // --- Track A: Agent Core ---
  {
    id: 'S0-A1',
    name: 'Turborepo Monorepo Scaffold',
    description: 'Initialize Turborepo with pnpm workspaces, packages/, apps/ structure',
    sprint: 0,
    track: 'A',
    sequence: 1,
    estimatedHours: 4,
    dependencies: [],
    blocks: ['S0-A2', 'S0-B1', 'S0-C1', 'S0-D1'],
    tags: ['infrastructure', 'turborepo', 'monorepo'],
    promptFile: 'sprint-0/S0-A1-turborepo-scaffold.md',
    status: 'pending'
  },
  {
    id: 'S0-A2',
    name: 'Shared TypeScript Config',
    description: 'Create @rtv/tsconfig with strict settings, path aliases, composite projects',
    sprint: 0,
    track: 'A',
    sequence: 2,
    estimatedHours: 2,
    dependencies: ['S0-A1'],
    blocks: ['S0-A3', 'S0-B2'],
    tags: ['typescript', 'config', 'shared'],
    promptFile: 'sprint-0/S0-A2-tsconfig-shared.md',
    status: 'pending'
  },
  {
    id: 'S0-A3',
    name: 'ESLint & Prettier Config',
    description: 'Unified linting with @rtv/eslint-config, Prettier integration',
    sprint: 0,
    track: 'A',
    sequence: 3,
    estimatedHours: 2,
    dependencies: ['S0-A2'],
    blocks: ['S0-A4'],
    tags: ['linting', 'eslint', 'prettier'],
    promptFile: 'sprint-0/S0-A3-eslint-prettier.md',
    status: 'pending'
  },
  {
    id: 'S0-A4',
    name: 'Vitest Test Framework',
    description: 'Configure Vitest with coverage, workspace integration, shared utilities',
    sprint: 0,
    track: 'A',
    sequence: 4,
    estimatedHours: 3,
    dependencies: ['S0-A3'],
    blocks: ['S0-A5', 'S1-A1'],
    tags: ['testing', 'vitest', 'coverage'],
    promptFile: 'sprint-0/S0-A4-vitest-setup.md',
    status: 'pending'
  },
  {
    id: 'S0-A5',
    name: 'Husky Pre-commit Hooks',
    description: 'Git hooks for lint-staged, commitlint, test running',
    sprint: 0,
    track: 'A',
    sequence: 5,
    estimatedHours: 2,
    dependencies: ['S0-A4'],
    blocks: ['S1-A1'],
    tags: ['git', 'hooks', 'husky', 'commitlint'],
    promptFile: 'sprint-0/S0-A5-husky-hooks.md',
    status: 'pending'
  },

  // --- Track B: Backend Core ---
  {
    id: 'S0-B1',
    name: 'Core Package Structure',
    description: 'Create @rtv/core with base types, interfaces, error hierarchy',
    sprint: 0,
    track: 'B',
    sequence: 1,
    estimatedHours: 4,
    dependencies: ['S0-A1'],
    blocks: ['S0-B2', 'S0-B3', 'S1-B1'],
    tags: ['core', 'types', 'interfaces'],
    promptFile: 'sprint-0/S0-B1-core-package.md',
    status: 'pending'
  },
  {
    id: 'S0-B2',
    name: 'Zod Schema Library',
    description: 'Create @rtv/schemas with runtime validation, type inference',
    sprint: 0,
    track: 'B',
    sequence: 2,
    estimatedHours: 4,
    dependencies: ['S0-A2', 'S0-B1'],
    blocks: ['S0-B3', 'S1-B2'],
    tags: ['zod', 'validation', 'schemas'],
    promptFile: 'sprint-0/S0-B2-zod-schemas.md',
    status: 'pending'
  },
  {
    id: 'S0-B3',
    name: 'Result Type Pattern',
    description: 'Implement Result<T, E> monad with pipe, map, flatMap utilities',
    sprint: 0,
    track: 'B',
    sequence: 3,
    estimatedHours: 3,
    dependencies: ['S0-B1', 'S0-B2'],
    blocks: ['S0-B4', 'S1-B1'],
    tags: ['result', 'monad', 'error-handling'],
    promptFile: 'sprint-0/S0-B3-result-type.md',
    status: 'pending'
  },
  {
    id: 'S0-B4',
    name: 'Logger Infrastructure',
    description: 'Pino-based structured logging with correlation IDs, log levels',
    sprint: 0,
    track: 'B',
    sequence: 4,
    estimatedHours: 3,
    dependencies: ['S0-B3'],
    blocks: ['S0-B5', 'S1-B1'],
    tags: ['logging', 'pino', 'observability'],
    promptFile: 'sprint-0/S0-B4-logger.md',
    status: 'pending'
  },
  {
    id: 'S0-B5',
    name: 'Configuration Management',
    description: 'Environment-based config with validation, secrets handling',
    sprint: 0,
    track: 'B',
    sequence: 5,
    estimatedHours: 3,
    dependencies: ['S0-B4'],
    blocks: ['S1-B1', 'S1-B2'],
    tags: ['config', 'environment', 'secrets'],
    promptFile: 'sprint-0/S0-B5-config-management.md',
    status: 'pending'
  },

  // --- Track C: CLI Core ---
  {
    id: 'S0-C1',
    name: 'CLI App Scaffold',
    description: 'Commander.js CLI with subcommands, help, version',
    sprint: 0,
    track: 'C',
    sequence: 1,
    estimatedHours: 3,
    dependencies: ['S0-A1'],
    blocks: ['S0-C2', 'S0-C3'],
    tags: ['cli', 'commander', 'scaffold'],
    promptFile: 'sprint-0/S0-C1-cli-scaffold.md',
    status: 'pending'
  },
  {
    id: 'S0-C2',
    name: 'CLI Config File Support',
    description: 'YAML/JSON config file loading, validation, merging',
    sprint: 0,
    track: 'C',
    sequence: 2,
    estimatedHours: 2,
    dependencies: ['S0-C1'],
    blocks: ['S0-C3', 'S1-C1'],
    tags: ['cli', 'config', 'yaml'],
    promptFile: 'sprint-0/S0-C2-cli-config.md',
    status: 'pending'
  },
  {
    id: 'S0-C3',
    name: 'CLI Output Formatting',
    description: 'Table, JSON, progress bar output with chalk styling',
    sprint: 0,
    track: 'C',
    sequence: 3,
    estimatedHours: 2,
    dependencies: ['S0-C1', 'S0-C2'],
    blocks: ['S1-C1'],
    tags: ['cli', 'output', 'formatting'],
    promptFile: 'sprint-0/S0-C3-cli-output.md',
    status: 'pending'
  },
  {
    id: 'S0-C4',
    name: 'CLI Interactive Prompts',
    description: 'Inquirer.js integration for guided configuration',
    sprint: 0,
    track: 'C',
    sequence: 4,
    estimatedHours: 2,
    dependencies: ['S0-C3'],
    blocks: ['S1-C2'],
    tags: ['cli', 'interactive', 'prompts'],
    promptFile: 'sprint-0/S0-C4-cli-prompts.md',
    status: 'pending'
  },
  {
    id: 'S0-C5',
    name: 'CLI Error Display',
    description: 'User-friendly error messages with suggestions, stack traces',
    sprint: 0,
    track: 'C',
    sequence: 5,
    estimatedHours: 2,
    dependencies: ['S0-C3'],
    blocks: ['S1-C1'],
    tags: ['cli', 'errors', 'ux'],
    promptFile: 'sprint-0/S0-C5-cli-errors.md',
    status: 'pending'
  },

  // --- Track D: DevOps ---
  {
    id: 'S0-D1',
    name: 'OpenTelemetry Foundation',
    description: 'OTEL SDK setup with traces, metrics, log correlation',
    sprint: 0,
    track: 'D',
    sequence: 1,
    estimatedHours: 4,
    dependencies: ['S0-A1'],
    blocks: ['S0-D2', 'S0-D3', 'S1-D1'],
    tags: ['observability', 'opentelemetry', 'tracing'],
    promptFile: 'sprint-0/S0-D1-otel-foundation.md',
    status: 'completed'
  },
  {
    id: 'S0-D2',
    name: 'Docker Development Environment',
    description: 'Docker Compose for local development with hot reload',
    sprint: 0,
    track: 'D',
    sequence: 2,
    estimatedHours: 3,
    dependencies: ['S0-D1'],
    blocks: ['S0-D3', 'S1-D1'],
    tags: ['docker', 'development', 'compose'],
    promptFile: 'sprint-0/S0-D2-docker-dev.md',
    status: 'pending'
  },
  {
    id: 'S0-D3',
    name: 'GitHub Actions CI Pipeline',
    description: 'CI workflow with lint, test, build, coverage upload',
    sprint: 0,
    track: 'D',
    sequence: 3,
    estimatedHours: 4,
    dependencies: ['S0-D1', 'S0-D2'],
    blocks: ['S0-D4', 'S1-D1'],
    tags: ['ci', 'github-actions', 'automation'],
    promptFile: 'sprint-0/S0-D3-github-ci.md',
    status: 'pending'
  },
  {
    id: 'S0-D4',
    name: 'Changesets Version Management',
    description: 'Automated versioning, changelogs, release workflow',
    sprint: 0,
    track: 'D',
    sequence: 4,
    estimatedHours: 2,
    dependencies: ['S0-D3'],
    blocks: ['S1-D2'],
    tags: ['versioning', 'changesets', 'releases'],
    promptFile: 'sprint-0/S0-D4-changesets.md',
    status: 'pending'
  },
  {
    id: 'S0-D5',
    name: 'Dependency Scanning',
    description: 'Renovate + npm audit for security scanning',
    sprint: 0,
    track: 'D',
    sequence: 5,
    estimatedHours: 2,
    dependencies: ['S0-D3'],
    blocks: ['S1-D1'],
    tags: ['security', 'dependencies', 'renovate'],
    promptFile: 'sprint-0/S0-D5-dependency-scanning.md',
    status: 'pending'
  },
  {
    id: 'S0-D6',
    name: 'Code Coverage Reporting',
    description: 'Codecov integration with PR comments, badges',
    sprint: 0,
    track: 'D',
    sequence: 6,
    estimatedHours: 2,
    dependencies: ['S0-D3'],
    blocks: ['S1-D1'],
    tags: ['coverage', 'codecov', 'quality'],
    promptFile: 'sprint-0/S0-D6-codecov.md',
    status: 'pending'
  },
  {
    id: 'S0-D7',
    name: 'Documentation Site Scaffold',
    description: 'Docusaurus setup for API docs, guides, tutorials',
    sprint: 0,
    track: 'D',
    sequence: 7,
    estimatedHours: 3,
    dependencies: ['S0-D3'],
    blocks: ['S5-D3'],
    tags: ['documentation', 'docusaurus', 'site'],
    promptFile: 'sprint-0/S0-D7-docs-site.md',
    status: 'pending'
  },

  // ============================================================================
  // SPRINT 1: Memory & Context Foundation (26 tasks - includes 3 Tesla enhancements)
  // ============================================================================

  // --- Track A: Agent Memory ---
  {
    id: 'S1-A1',
    name: 'Memory Store Interface',
    description: 'Abstract IMemoryStore with CRUD operations, query interface',
    sprint: 1,
    track: 'A',
    sequence: 1,
    estimatedHours: 4,
    dependencies: ['S0-A4', 'S0-A5'],
    blocks: ['S1-A2', 'S1-A3'],
    tags: ['memory', 'interface', 'storage'],
    promptFile: 'sprint-1/S1-A1-memory-interface.md',
    status: 'pending'
  },
  {
    id: 'S1-A2',
    name: 'In-Memory Store Implementation',
    description: 'Map-based store with TTL, LRU eviction, indexing',
    sprint: 1,
    track: 'A',
    sequence: 2,
    estimatedHours: 4,
    dependencies: ['S1-A1'],
    blocks: ['S1-A4', 'S1-B3'],
    tags: ['memory', 'in-memory', 'cache'],
    promptFile: 'sprint-1/S1-A2-in-memory-store.md',
    status: 'pending'
  },
  {
    id: 'S1-A3',
    name: 'SQLite Store Implementation',
    description: 'better-sqlite3 persistent store with migrations',
    sprint: 1,
    track: 'A',
    sequence: 3,
    estimatedHours: 5,
    dependencies: ['S1-A1'],
    blocks: ['S1-A4', 'S1-B3'],
    tags: ['memory', 'sqlite', 'persistence'],
    promptFile: 'sprint-1/S1-A3-sqlite-store.md',
    status: 'pending'
  },
  {
    id: 'S1-A4',
    name: 'Memory Query Language',
    description: 'DSL for filtering, sorting, pagination of memories',
    sprint: 1,
    track: 'A',
    sequence: 4,
    estimatedHours: 4,
    dependencies: ['S1-A2', 'S1-A3'],
    blocks: ['S1-A5', 'S2-A1'],
    tags: ['memory', 'query', 'dsl'],
    promptFile: 'sprint-1/S1-A4-memory-query.md',
    status: 'pending'
  },
  {
    id: 'S1-A5',
    name: 'Memory Serialization',
    description: 'JSON serialization with versioning, migration support',
    sprint: 1,
    track: 'A',
    sequence: 5,
    estimatedHours: 3,
    dependencies: ['S1-A4'],
    blocks: ['S2-A1'],
    tags: ['memory', 'serialization', 'versioning'],
    promptFile: 'sprint-1/S1-A5-memory-serialization.md',
    status: 'pending'
  },

  // --- Track B: Context Management ---
  {
    id: 'S1-B1',
    name: 'Context Window Manager',
    description: 'Token counting, budget allocation, overflow handling',
    sprint: 1,
    track: 'B',
    sequence: 1,
    estimatedHours: 5,
    dependencies: ['S0-B1', 'S0-B3', 'S0-B4', 'S0-B5'],
    blocks: ['S1-B2', 'S1-B3'],
    tags: ['context', 'tokens', 'budget'],
    promptFile: 'sprint-1/S1-B1-context-window.md',
    status: 'pending'
  },
  {
    id: 'S1-B2',
    name: 'Token Encoder Abstraction',
    description: 'tiktoken wrapper with model-specific encoding, caching',
    sprint: 1,
    track: 'B',
    sequence: 2,
    estimatedHours: 3,
    dependencies: ['S0-B2', 'S0-B5', 'S1-B1'],
    blocks: ['S1-B3', 'S1-B4'],
    tags: ['tokens', 'encoding', 'tiktoken'],
    promptFile: 'sprint-1/S1-B2-token-encoder.md',
    status: 'pending'
  },
  {
    id: 'S1-B3',
    name: 'Context Assembler',
    description: 'Compose context from multiple sources with priority',
    sprint: 1,
    track: 'B',
    sequence: 3,
    estimatedHours: 5,
    dependencies: ['S1-A2', 'S1-A3', 'S1-B1', 'S1-B2'],
    blocks: ['S1-B4', 'S1-B5', 'S1-B6'],
    tags: ['context', 'assembly', 'composition'],
    promptFile: 'sprint-1/S1-B3-context-assembler.md',
    status: 'pending'
  },
  {
    id: 'S1-B4',
    name: 'Prompt Template Engine',
    description: 'Handlebars-based templates with helpers, partials',
    sprint: 1,
    track: 'B',
    sequence: 4,
    estimatedHours: 4,
    dependencies: ['S1-B2', 'S1-B3'],
    blocks: ['S1-B5', 'S2-B1'],
    tags: ['prompts', 'templates', 'handlebars'],
    promptFile: 'sprint-1/S1-B4-prompt-templates.md',
    status: 'pending'
  },
  {
    id: 'S1-B5',
    name: 'Context Compression',
    description: 'Summarization, deduplication, priority-based trimming',
    sprint: 1,
    track: 'B',
    sequence: 5,
    estimatedHours: 5,
    dependencies: ['S1-B3', 'S1-B4'],
    blocks: ['S2-B1', 'S2-A7'],
    tags: ['context', 'compression', 'optimization'],
    promptFile: 'sprint-1/S1-B5-context-compression.md',
    status: 'pending'
  },

  // --- Track B: Tesla Memory Priority Enhancement (NEW) ---
  {
    id: 'S1-B6',
    name: 'Memory Priority Schema',
    description: 'Define PINNED/SESSION/SLIDING/EPHEMERAL priority levels with Zod schemas',
    sprint: 1,
    track: 'B',
    sequence: 6,
    estimatedHours: 3,
    dependencies: ['S1-B3'],
    blocks: ['S1-B7', 'S1-B8'],
    tags: ['memory', 'priority', 'schema', 'tesla-enhancement'],
    promptFile: 'sprint-1/S1-B6-memory-priority-schema.md',
    status: 'pending'
  },
  {
    id: 'S1-B7',
    name: 'Priority-Based Eviction Engine',
    description: 'Eviction engine that respects PINNED > SESSION > SLIDING > EPHEMERAL ordering',
    sprint: 1,
    track: 'B',
    sequence: 7,
    estimatedHours: 4,
    dependencies: ['S1-B6'],
    blocks: ['S1-B8'],
    tags: ['memory', 'eviction', 'priority', 'tesla-enhancement'],
    promptFile: 'sprint-1/S1-B7-priority-based-eviction.md',
    status: 'pending'
  },
  {
    id: 'S1-B8',
    name: 'Pinned Context Manager',
    description: 'High-level API for managing critical pinned context with budget enforcement',
    sprint: 1,
    track: 'B',
    sequence: 8,
    estimatedHours: 3,
    dependencies: ['S1-B6', 'S1-B7'],
    blocks: ['S2-A6'],
    tags: ['memory', 'pinned', 'manager', 'tesla-enhancement'],
    promptFile: 'sprint-1/S1-B8-pinned-context-manager.md',
    status: 'pending'
  },

  // --- Track C: CLI Commands ---
  {
    id: 'S1-C1',
    name: 'Init Command',
    description: 'rtv init - project initialization wizard',
    sprint: 1,
    track: 'C',
    sequence: 1,
    estimatedHours: 4,
    dependencies: ['S0-C2', 'S0-C3', 'S0-C5'],
    blocks: ['S1-C2', 'S2-C1'],
    tags: ['cli', 'init', 'wizard'],
    promptFile: 'sprint-1/S1-C1-init-command.md',
    status: 'pending'
  },
  {
    id: 'S1-C2',
    name: 'Config Command',
    description: 'rtv config - view, set, validate configuration',
    sprint: 1,
    track: 'C',
    sequence: 2,
    estimatedHours: 3,
    dependencies: ['S0-C4', 'S1-C1'],
    blocks: ['S2-C1'],
    tags: ['cli', 'config', 'management'],
    promptFile: 'sprint-1/S1-C2-config-command.md',
    status: 'pending'
  },
  {
    id: 'S1-C3',
    name: 'Status Command',
    description: 'rtv status - show campaign/agent status',
    sprint: 1,
    track: 'C',
    sequence: 3,
    estimatedHours: 3,
    dependencies: ['S1-C1'],
    blocks: ['S2-C2'],
    tags: ['cli', 'status', 'monitoring'],
    promptFile: 'sprint-1/S1-C3-status-command.md',
    status: 'pending'
  },
  {
    id: 'S1-C4',
    name: 'Memory Command',
    description: 'rtv memory - inspect, export, import memories',
    sprint: 1,
    track: 'C',
    sequence: 4,
    estimatedHours: 3,
    dependencies: ['S1-C1'],
    blocks: ['S2-C2'],
    tags: ['cli', 'memory', 'inspection'],
    promptFile: 'sprint-1/S1-C4-memory-command.md',
    status: 'pending'
  },
  {
    id: 'S1-C5',
    name: 'Doctor Command',
    description: 'rtv doctor - diagnose configuration issues',
    sprint: 1,
    track: 'C',
    sequence: 5,
    estimatedHours: 3,
    dependencies: ['S1-C2'],
    blocks: ['S2-C1'],
    tags: ['cli', 'diagnostics', 'troubleshooting'],
    promptFile: 'sprint-1/S1-C5-doctor-command.md',
    status: 'pending'
  },

  // --- Track D: Infrastructure ---
  {
    id: 'S1-D1',
    name: 'Redis Integration',
    description: 'ioredis client with connection pooling, pub/sub',
    sprint: 1,
    track: 'D',
    sequence: 1,
    estimatedHours: 4,
    dependencies: ['S0-D1', 'S0-D2', 'S0-D3', 'S0-D5', 'S0-D6'],
    blocks: ['S1-D2', 'S2-D1'],
    tags: ['redis', 'caching', 'pub-sub'],
    promptFile: 'sprint-1/S1-D1-redis-integration.md',
    status: 'pending'
  },
  {
    id: 'S1-D2',
    name: 'Rate Limiter Service',
    description: 'Token bucket rate limiting with Redis backend',
    sprint: 1,
    track: 'D',
    sequence: 2,
    estimatedHours: 4,
    dependencies: ['S0-D4', 'S1-D1'],
    blocks: ['S2-D1', 'S2-B2'],
    tags: ['rate-limiting', 'redis', 'throttling'],
    promptFile: 'sprint-1/S1-D2-rate-limiter.md',
    status: 'pending'
  },
  {
    id: 'S1-D3',
    name: 'Health Check Endpoints',
    description: 'Liveness, readiness probes with dependency checks',
    sprint: 1,
    track: 'D',
    sequence: 3,
    estimatedHours: 2,
    dependencies: ['S1-D1'],
    blocks: ['S2-D2'],
    tags: ['health', 'monitoring', 'probes'],
    promptFile: 'sprint-1/S1-D3-health-checks.md',
    status: 'pending'
  },
  {
    id: 'S1-D4',
    name: 'Metrics Collection',
    description: 'Prometheus metrics with custom business metrics',
    sprint: 1,
    track: 'D',
    sequence: 4,
    estimatedHours: 3,
    dependencies: ['S1-D1'],
    blocks: ['S2-D2'],
    tags: ['metrics', 'prometheus', 'observability'],
    promptFile: 'sprint-1/S1-D4-metrics.md',
    status: 'pending'
  },
  {
    id: 'S1-D5',
    name: 'Distributed Tracing',
    description: 'Jaeger integration with span propagation',
    sprint: 1,
    track: 'D',
    sequence: 5,
    estimatedHours: 3,
    dependencies: ['S1-D1'],
    blocks: ['S2-D2'],
    tags: ['tracing', 'jaeger', 'observability'],
    promptFile: 'sprint-1/S1-D5-tracing.md',
    status: 'pending'
  },

  // ============================================================================
  // SPRINT 2: LLM Integration & Agent Core (25 tasks - includes 2 Tesla enhancements)
  // ============================================================================

  // --- Track A: Agent Architecture ---
  {
    id: 'S2-A1',
    name: 'Agent State Machine',
    description: 'XState-based agent lifecycle with states, transitions',
    sprint: 2,
    track: 'A',
    sequence: 1,
    estimatedHours: 6,
    dependencies: ['S1-A4', 'S1-A5'],
    blocks: ['S2-A2', 'S2-A3', 'S2-A6'],
    tags: ['agent', 'state-machine', 'xstate'],
    promptFile: 'sprint-2/S2-A1-agent-state-machine.md',
    status: 'pending'
  },
  {
    id: 'S2-A2',
    name: 'Agent Event Bus',
    description: 'EventEmitter3 with typed events, async handlers',
    sprint: 2,
    track: 'A',
    sequence: 2,
    estimatedHours: 3,
    dependencies: ['S2-A1'],
    blocks: ['S2-A3', 'S2-A4'],
    tags: ['agent', 'events', 'pub-sub'],
    promptFile: 'sprint-2/S2-A2-event-bus.md',
    status: 'pending'
  },
  {
    id: 'S2-A3',
    name: 'Agent Executor',
    description: 'Task execution loop with retry, timeout, cancellation',
    sprint: 2,
    track: 'A',
    sequence: 3,
    estimatedHours: 5,
    dependencies: ['S2-A1', 'S2-A2'],
    blocks: ['S2-A4', 'S2-A5'],
    tags: ['agent', 'executor', 'tasks'],
    promptFile: 'sprint-2/S2-A3-agent-executor.md',
    status: 'pending'
  },
  {
    id: 'S2-A4',
    name: 'Agent Supervisor',
    description: 'Multi-agent coordination, resource allocation',
    sprint: 2,
    track: 'A',
    sequence: 4,
    estimatedHours: 5,
    dependencies: ['S2-A2', 'S2-A3'],
    blocks: ['S2-A5', 'S3-A1'],
    tags: ['agent', 'supervisor', 'coordination'],
    promptFile: 'sprint-2/S2-A4-agent-supervisor.md',
    status: 'pending'
  },
  {
    id: 'S2-A5',
    name: 'Agent Registry',
    description: 'Dynamic agent registration, discovery, lifecycle',
    sprint: 2,
    track: 'A',
    sequence: 5,
    estimatedHours: 4,
    dependencies: ['S2-A3', 'S2-A4'],
    blocks: ['S3-A1'],
    tags: ['agent', 'registry', 'discovery'],
    promptFile: 'sprint-2/S2-A5-agent-registry.md',
    status: 'pending'
  },

  // --- Track A: Tesla Task-Aware Context Enhancement (NEW) ---
  {
    id: 'S2-A6',
    name: 'Task Context Registry',
    description: 'Registry mapping task types to required/optional/excluded context categories',
    sprint: 2,
    track: 'A',
    sequence: 6,
    estimatedHours: 4,
    dependencies: ['S2-A1', 'S1-B8'],
    blocks: ['S2-A7'],
    tags: ['context', 'task', 'registry', 'tesla-enhancement'],
    promptFile: 'sprint-2/S2-A6-task-context-registry.md',
    status: 'pending'
  },
  {
    id: 'S2-A7',
    name: 'Sparse Context Loader',
    description: 'Runtime context loader that filters based on task type and token budget',
    sprint: 2,
    track: 'A',
    sequence: 7,
    estimatedHours: 5,
    dependencies: ['S2-A6', 'S1-B5'],
    blocks: ['S3-B7'],
    tags: ['context', 'sparse', 'loader', 'tesla-enhancement'],
    promptFile: 'sprint-2/S2-A7-sparse-context-loader.md',
    status: 'pending'
  },

  // --- Track B: LLM Providers ---
  {
    id: 'S2-B1',
    name: 'LLM Provider Interface',
    description: 'Abstract ILLMProvider with streaming, tools, vision',
    sprint: 2,
    track: 'B',
    sequence: 1,
    estimatedHours: 4,
    dependencies: ['S1-B4', 'S1-B5'],
    blocks: ['S2-B2', 'S2-B3', 'S2-B4'],
    tags: ['llm', 'provider', 'interface'],
    promptFile: 'sprint-2/S2-B1-llm-interface.md',
    status: 'pending'
  },
  {
    id: 'S2-B2',
    name: 'OpenAI Provider',
    description: 'OpenAI API client with GPT-4, vision, function calling',
    sprint: 2,
    track: 'B',
    sequence: 2,
    estimatedHours: 5,
    dependencies: ['S1-D2', 'S2-B1'],
    blocks: ['S2-B5', 'S3-B1'],
    tags: ['llm', 'openai', 'gpt'],
    promptFile: 'sprint-2/S2-B2-openai-provider.md',
    status: 'pending'
  },
  {
    id: 'S2-B3',
    name: 'Anthropic Provider',
    description: 'Claude API client with Claude 3, tool use',
    sprint: 2,
    track: 'B',
    sequence: 3,
    estimatedHours: 5,
    dependencies: ['S2-B1'],
    blocks: ['S2-B5', 'S3-B1'],
    tags: ['llm', 'anthropic', 'claude'],
    promptFile: 'sprint-2/S2-B3-anthropic-provider.md',
    status: 'pending'
  },
  {
    id: 'S2-B4',
    name: 'Local LLM Provider',
    description: 'Ollama/LM Studio support for local models',
    sprint: 2,
    track: 'B',
    sequence: 4,
    estimatedHours: 4,
    dependencies: ['S2-B1'],
    blocks: ['S2-B5', 'S3-B1'],
    tags: ['llm', 'local', 'ollama'],
    promptFile: 'sprint-2/S2-B4-local-provider.md',
    status: 'pending'
  },
  {
    id: 'S2-B5',
    name: 'Provider Router',
    description: 'Load balancing, failover, cost optimization',
    sprint: 2,
    track: 'B',
    sequence: 5,
    estimatedHours: 5,
    dependencies: ['S2-B2', 'S2-B3', 'S2-B4'],
    blocks: ['S3-B1', 'S3-B2'],
    tags: ['llm', 'router', 'failover'],
    promptFile: 'sprint-2/S2-B5-provider-router.md',
    status: 'pending'
  },

  // --- Track C: CLI Commands ---
  {
    id: 'S2-C1',
    name: 'Run Command',
    description: 'rtv run - execute campaigns with options',
    sprint: 2,
    track: 'C',
    sequence: 1,
    estimatedHours: 5,
    dependencies: ['S1-C1', 'S1-C2', 'S1-C5'],
    blocks: ['S2-C2', 'S3-C1'],
    tags: ['cli', 'run', 'execution'],
    promptFile: 'sprint-2/S2-C1-run-command.md',
    status: 'pending'
  },
  {
    id: 'S2-C2',
    name: 'Watch Command',
    description: 'rtv watch - live monitoring with updates',
    sprint: 2,
    track: 'C',
    sequence: 2,
    estimatedHours: 4,
    dependencies: ['S1-C3', 'S1-C4', 'S2-C1'],
    blocks: ['S3-C1'],
    tags: ['cli', 'watch', 'monitoring'],
    promptFile: 'sprint-2/S2-C2-watch-command.md',
    status: 'pending'
  },
  {
    id: 'S2-C3',
    name: 'Logs Command',
    description: 'rtv logs - view, filter, export logs',
    sprint: 2,
    track: 'C',
    sequence: 3,
    estimatedHours: 3,
    dependencies: ['S2-C1'],
    blocks: ['S3-C2'],
    tags: ['cli', 'logs', 'debugging'],
    promptFile: 'sprint-2/S2-C3-logs-command.md',
    status: 'pending'
  },
  {
    id: 'S2-C4',
    name: 'Test Command',
    description: 'rtv test - run agent tests, validate configs',
    sprint: 2,
    track: 'C',
    sequence: 4,
    estimatedHours: 4,
    dependencies: ['S2-C1'],
    blocks: ['S3-C2'],
    tags: ['cli', 'test', 'validation'],
    promptFile: 'sprint-2/S2-C4-test-command.md',
    status: 'pending'
  },
  {
    id: 'S2-C5',
    name: 'Benchmark Command',
    description: 'rtv benchmark - performance testing, comparison',
    sprint: 2,
    track: 'C',
    sequence: 5,
    estimatedHours: 4,
    dependencies: ['S2-C1'],
    blocks: ['S3-C2'],
    tags: ['cli', 'benchmark', 'performance'],
    promptFile: 'sprint-2/S2-C5-benchmark-command.md',
    status: 'pending'
  },

  // --- Track D: Infrastructure ---
  {
    id: 'S2-D1',
    name: 'Queue System',
    description: 'BullMQ job queue with workers, priorities',
    sprint: 2,
    track: 'D',
    sequence: 1,
    estimatedHours: 5,
    dependencies: ['S1-D1', 'S1-D2'],
    blocks: ['S2-D2', 'S3-D1'],
    tags: ['queue', 'bullmq', 'workers'],
    promptFile: 'sprint-2/S2-D1-queue-system.md',
    status: 'pending'
  },
  {
    id: 'S2-D2',
    name: 'Monitoring Dashboard',
    description: 'Grafana dashboards for metrics, logs, traces',
    sprint: 2,
    track: 'D',
    sequence: 2,
    estimatedHours: 4,
    dependencies: ['S1-D3', 'S1-D4', 'S1-D5', 'S2-D1'],
    blocks: ['S3-D1'],
    tags: ['monitoring', 'grafana', 'dashboards'],
    promptFile: 'sprint-2/S2-D2-monitoring-dashboard.md',
    status: 'pending'
  },
  {
    id: 'S2-D3',
    name: 'Alerting Rules',
    description: 'PagerDuty/Slack alerts for critical events',
    sprint: 2,
    track: 'D',
    sequence: 3,
    estimatedHours: 3,
    dependencies: ['S2-D2'],
    blocks: ['S3-D2'],
    tags: ['alerting', 'pagerduty', 'slack'],
    promptFile: 'sprint-2/S2-D3-alerting.md',
    status: 'pending'
  },
  {
    id: 'S2-D4',
    name: 'Secret Management',
    description: 'Vault/AWS Secrets Manager integration',
    sprint: 2,
    track: 'D',
    sequence: 4,
    estimatedHours: 4,
    dependencies: ['S2-D1'],
    blocks: ['S3-D1'],
    tags: ['secrets', 'vault', 'security'],
    promptFile: 'sprint-2/S2-D4-secrets.md',
    status: 'pending'
  },
  {
    id: 'S2-D5',
    name: 'Backup & Recovery',
    description: 'Automated backups, point-in-time recovery',
    sprint: 2,
    track: 'D',
    sequence: 5,
    estimatedHours: 4,
    dependencies: ['S2-D1'],
    blocks: ['S3-D2'],
    tags: ['backup', 'recovery', 'disaster-recovery'],
    promptFile: 'sprint-2/S2-D5-backup.md',
    status: 'pending'
  },

  // ============================================================================
  // SPRINT 3: Social Platform Integration (26 tasks - includes 3 Tesla enhancements)
  // ============================================================================

  // --- Track A: Platform Adapters ---
  {
    id: 'S3-A1',
    name: 'Platform Adapter Interface',
    description: 'Abstract ISocialPlatform with auth, posting, analytics',
    sprint: 3,
    track: 'A',
    sequence: 1,
    estimatedHours: 4,
    dependencies: ['S2-A4', 'S2-A5'],
    blocks: ['S3-A2', 'S3-A3', 'S3-A4', 'S3-A5'],
    tags: ['platform', 'adapter', 'interface'],
    promptFile: 'sprint-3/S3-A1-platform-interface.md',
    status: 'pending'
  },
  {
    id: 'S3-A2',
    name: 'Twitter/X Adapter',
    description: 'Twitter API v2 integration with OAuth2',
    sprint: 3,
    track: 'A',
    sequence: 2,
    estimatedHours: 6,
    dependencies: ['S3-A1'],
    blocks: ['S3-A6', 'S4-A1'],
    tags: ['platform', 'twitter', 'x'],
    promptFile: 'sprint-3/S3-A2-twitter-adapter.md',
    status: 'pending'
  },
  {
    id: 'S3-A3',
    name: 'LinkedIn Adapter',
    description: 'LinkedIn API with company pages, articles',
    sprint: 3,
    track: 'A',
    sequence: 3,
    estimatedHours: 5,
    dependencies: ['S3-A1'],
    blocks: ['S3-A6', 'S4-A1'],
    tags: ['platform', 'linkedin'],
    promptFile: 'sprint-3/S3-A3-linkedin-adapter.md',
    status: 'pending'
  },
  {
    id: 'S3-A4',
    name: 'Instagram Adapter',
    description: 'Instagram Graph API with media uploads',
    sprint: 3,
    track: 'A',
    sequence: 4,
    estimatedHours: 5,
    dependencies: ['S3-A1'],
    blocks: ['S3-A6', 'S4-A1'],
    tags: ['platform', 'instagram'],
    promptFile: 'sprint-3/S3-A4-instagram-adapter.md',
    status: 'pending'
  },
  {
    id: 'S3-A5',
    name: 'Facebook Adapter',
    description: 'Facebook Graph API with pages, groups',
    sprint: 3,
    track: 'A',
    sequence: 5,
    estimatedHours: 5,
    dependencies: ['S3-A1'],
    blocks: ['S3-A6', 'S4-A1'],
    tags: ['platform', 'facebook'],
    promptFile: 'sprint-3/S3-A5-facebook-adapter.md',
    status: 'pending'
  },
  {
    id: 'S3-A6',
    name: 'Platform Router',
    description: 'Multi-platform routing, cross-posting',
    sprint: 3,
    track: 'A',
    sequence: 6,
    estimatedHours: 4,
    dependencies: ['S3-A2', 'S3-A3', 'S3-A4', 'S3-A5'],
    blocks: ['S4-A1'],
    tags: ['platform', 'router', 'cross-posting'],
    promptFile: 'sprint-3/S3-A6-platform-router.md',
    status: 'pending'
  },

  // --- Track B: Content Generation ---
  {
    id: 'S3-B1',
    name: 'Content Strategy Engine',
    description: 'AI-driven content planning, topic selection',
    sprint: 3,
    track: 'B',
    sequence: 1,
    estimatedHours: 6,
    dependencies: ['S2-B2', 'S2-B3', 'S2-B4', 'S2-B5'],
    blocks: ['S3-B2', 'S3-B3', 'S3-B7'],
    tags: ['content', 'strategy', 'planning'],
    promptFile: 'sprint-3/S3-B1-content-strategy.md',
    status: 'pending'
  },
  {
    id: 'S3-B2',
    name: 'Post Generator',
    description: 'Platform-specific content generation',
    sprint: 3,
    track: 'B',
    sequence: 2,
    estimatedHours: 5,
    dependencies: ['S2-B5', 'S3-B1'],
    blocks: ['S3-B4', 'S4-B1'],
    tags: ['content', 'generation', 'posts'],
    promptFile: 'sprint-3/S3-B2-post-generator.md',
    status: 'pending'
  },
  {
    id: 'S3-B3',
    name: 'Media Handler',
    description: 'Image generation, video processing, carousel creation',
    sprint: 3,
    track: 'B',
    sequence: 3,
    estimatedHours: 6,
    dependencies: ['S3-B1'],
    blocks: ['S3-B4', 'S4-B2'],
    tags: ['content', 'media', 'images'],
    promptFile: 'sprint-3/S3-B3-media-handler.md',
    status: 'pending'
  },
  {
    id: 'S3-B4',
    name: 'Content Queue',
    description: 'Scheduled posting, approval workflow',
    sprint: 3,
    track: 'B',
    sequence: 4,
    estimatedHours: 5,
    dependencies: ['S3-B2', 'S3-B3'],
    blocks: ['S3-B5', 'S4-B1'],
    tags: ['content', 'queue', 'scheduling'],
    promptFile: 'sprint-3/S3-B4-content-queue.md',
    status: 'pending'
  },
  {
    id: 'S3-B5',
    name: 'A/B Testing Framework',
    description: 'Content variant testing, performance tracking',
    sprint: 3,
    track: 'B',
    sequence: 5,
    estimatedHours: 5,
    dependencies: ['S3-B4'],
    blocks: ['S3-B6', 'S4-B3'],
    tags: ['content', 'ab-testing', 'optimization'],
    promptFile: 'sprint-3/S3-B5-ab-testing.md',
    status: 'pending'
  },
  {
    id: 'S3-B6',
    name: 'Content Analytics',
    description: 'Performance metrics, engagement tracking',
    sprint: 3,
    track: 'B',
    sequence: 6,
    estimatedHours: 4,
    dependencies: ['S3-B5'],
    blocks: ['S4-B3'],
    tags: ['content', 'analytics', 'metrics'],
    promptFile: 'sprint-3/S3-B6-content-analytics.md',
    status: 'pending'
  },

  // --- Track B: Tesla Model Tier Routing Enhancement (NEW) ---
  {
    id: 'S3-B7',
    name: 'Model Tier Configuration',
    description: 'Define PREMIUM/STANDARD/ECONOMY tiers with provider mappings and cost configs',
    sprint: 3,
    track: 'B',
    sequence: 7,
    estimatedHours: 3,
    dependencies: ['S3-B1', 'S2-A7'],
    blocks: ['S3-B8', 'S3-B9'],
    tags: ['model', 'tier', 'config', 'tesla-enhancement'],
    promptFile: 'sprint-3/S3-B7-model-tier-config.md',
    status: 'pending'
  },
  {
    id: 'S3-B8',
    name: 'Complexity Assessor',
    description: 'Score task complexity (0-1) based on context size, output requirements, reasoning depth',
    sprint: 3,
    track: 'B',
    sequence: 8,
    estimatedHours: 4,
    dependencies: ['S3-B7', 'S2-A6'],
    blocks: ['S3-B9'],
    tags: ['complexity', 'assessment', 'scoring', 'tesla-enhancement'],
    promptFile: 'sprint-3/S3-B8-complexity-assessor.md',
    status: 'pending'
  },
  {
    id: 'S3-B9',
    name: 'Adaptive Model Router',
    description: 'Route requests to appropriate model tier based on complexity and budget constraints',
    sprint: 3,
    track: 'B',
    sequence: 9,
    estimatedHours: 5,
    dependencies: ['S3-B7', 'S3-B8'],
    blocks: ['S4-B1'],
    tags: ['model', 'router', 'adaptive', 'tesla-enhancement'],
    promptFile: 'sprint-3/S3-B9-adaptive-model-router.md',
    status: 'pending'
  },

  // --- Track C: CLI Commands ---
  {
    id: 'S3-C1',
    name: 'Campaign Command',
    description: 'rtv campaign - create, manage campaigns',
    sprint: 3,
    track: 'C',
    sequence: 1,
    estimatedHours: 5,
    dependencies: ['S2-C1', 'S2-C2'],
    blocks: ['S3-C3', 'S4-C1'],
    tags: ['cli', 'campaign', 'management'],
    promptFile: 'sprint-3/S3-C1-campaign-command.md',
    status: 'pending'
  },
  {
    id: 'S3-C2',
    name: 'Content Command',
    description: 'rtv content - generate, preview content',
    sprint: 3,
    track: 'C',
    sequence: 2,
    estimatedHours: 4,
    dependencies: ['S2-C3', 'S2-C4', 'S2-C5'],
    blocks: ['S3-C3', 'S4-C1'],
    tags: ['cli', 'content', 'preview'],
    promptFile: 'sprint-3/S3-C2-content-command.md',
    status: 'pending'
  },
  {
    id: 'S3-C3',
    name: 'Schedule Command',
    description: 'rtv schedule - manage posting schedule',
    sprint: 3,
    track: 'C',
    sequence: 3,
    estimatedHours: 4,
    dependencies: ['S3-C1', 'S3-C2'],
    blocks: ['S4-C1'],
    tags: ['cli', 'schedule', 'calendar'],
    promptFile: 'sprint-3/S3-C3-schedule-command.md',
    status: 'pending'
  },
  {
    id: 'S3-C4',
    name: 'Analytics Command',
    description: 'rtv analytics - view performance metrics',
    sprint: 3,
    track: 'C',
    sequence: 4,
    estimatedHours: 4,
    dependencies: ['S3-C1'],
    blocks: ['S4-C2'],
    tags: ['cli', 'analytics', 'reporting'],
    promptFile: 'sprint-3/S3-C4-analytics-command.md',
    status: 'pending'
  },
  {
    id: 'S3-C5',
    name: 'Export Command',
    description: 'rtv export - export data, reports',
    sprint: 3,
    track: 'C',
    sequence: 5,
    estimatedHours: 3,
    dependencies: ['S3-C4'],
    blocks: ['S4-C2'],
    tags: ['cli', 'export', 'reports'],
    promptFile: 'sprint-3/S3-C5-export-command.md',
    status: 'pending'
  },

  // --- Track D: Infrastructure ---
  {
    id: 'S3-D1',
    name: 'Kubernetes Deployment',
    description: 'K8s manifests, Helm charts, autoscaling',
    sprint: 3,
    track: 'D',
    sequence: 1,
    estimatedHours: 6,
    dependencies: ['S2-D1', 'S2-D2', 'S2-D4'],
    blocks: ['S3-D2', 'S4-D1'],
    tags: ['kubernetes', 'deployment', 'helm'],
    promptFile: 'sprint-3/S3-D1-kubernetes.md',
    status: 'pending'
  },
  {
    id: 'S3-D2',
    name: 'CD Pipeline',
    description: 'GitOps deployment with ArgoCD',
    sprint: 3,
    track: 'D',
    sequence: 2,
    estimatedHours: 5,
    dependencies: ['S2-D3', 'S2-D5', 'S3-D1'],
    blocks: ['S4-D1'],
    tags: ['cd', 'gitops', 'argocd'],
    promptFile: 'sprint-3/S3-D2-cd-pipeline.md',
    status: 'pending'
  },
  {
    id: 'S3-D3',
    name: 'Database Migration System',
    description: 'Prisma migrations with rollback support',
    sprint: 3,
    track: 'D',
    sequence: 3,
    estimatedHours: 4,
    dependencies: ['S3-D1'],
    blocks: ['S4-D2'],
    tags: ['database', 'migrations', 'prisma'],
    promptFile: 'sprint-3/S3-D3-migrations.md',
    status: 'pending'
  },
  {
    id: 'S3-D4',
    name: 'Feature Flags',
    description: 'LaunchDarkly/Unleash feature flag system',
    sprint: 3,
    track: 'D',
    sequence: 4,
    estimatedHours: 3,
    dependencies: ['S3-D1'],
    blocks: ['S4-D2'],
    tags: ['feature-flags', 'launchdarkly', 'toggles'],
    promptFile: 'sprint-3/S3-D4-feature-flags.md',
    status: 'pending'
  },
  {
    id: 'S3-D5',
    name: 'Cost Monitoring',
    description: 'LLM cost tracking, budget alerts',
    sprint: 3,
    track: 'D',
    sequence: 5,
    estimatedHours: 4,
    dependencies: ['S3-D1'],
    blocks: ['S4-D3'],
    tags: ['costs', 'monitoring', 'budget'],
    promptFile: 'sprint-3/S3-D5-cost-monitoring.md',
    status: 'pending'
  },

  // ============================================================================
  // SPRINT 4: Advanced Engagement (20 tasks)
  // ============================================================================

  // --- Track A: Engagement Automation ---
  {
    id: 'S4-A1',
    name: 'Engagement Monitor',
    description: 'Real-time monitoring of mentions, comments, DMs',
    sprint: 4,
    track: 'A',
    sequence: 1,
    estimatedHours: 6,
    dependencies: ['S3-A2', 'S3-A3', 'S3-A4', 'S3-A5', 'S3-A6'],
    blocks: ['S4-A2', 'S4-A3'],
    tags: ['engagement', 'monitoring', 'real-time'],
    promptFile: 'sprint-4/S4-A1-engagement-monitor.md',
    status: 'pending'
  },
  {
    id: 'S4-A2',
    name: 'Response Generator',
    description: 'AI-powered contextual responses',
    sprint: 4,
    track: 'A',
    sequence: 2,
    estimatedHours: 5,
    dependencies: ['S4-A1'],
    blocks: ['S4-A4', 'S5-A1'],
    tags: ['engagement', 'responses', 'ai'],
    promptFile: 'sprint-4/S4-A2-response-generator.md',
    status: 'pending'
  },
  {
    id: 'S4-A3',
    name: 'Sentiment Analyzer',
    description: 'Real-time sentiment analysis, brand monitoring',
    sprint: 4,
    track: 'A',
    sequence: 3,
    estimatedHours: 5,
    dependencies: ['S4-A1'],
    blocks: ['S4-A4', 'S5-A1'],
    tags: ['sentiment', 'analysis', 'brand'],
    promptFile: 'sprint-4/S4-A3-sentiment-analyzer.md',
    status: 'pending'
  },
  {
    id: 'S4-A4',
    name: 'Engagement Rules Engine',
    description: 'Configurable rules for automated responses',
    sprint: 4,
    track: 'A',
    sequence: 4,
    estimatedHours: 5,
    dependencies: ['S4-A2', 'S4-A3'],
    blocks: ['S4-A5', 'S5-A1'],
    tags: ['engagement', 'rules', 'automation'],
    promptFile: 'sprint-4/S4-A4-rules-engine.md',
    status: 'pending'
  },
  {
    id: 'S4-A5',
    name: 'Crisis Detection',
    description: 'Automatic detection of PR crises, escalation',
    sprint: 4,
    track: 'A',
    sequence: 5,
    estimatedHours: 4,
    dependencies: ['S4-A4'],
    blocks: ['S5-A2'],
    tags: ['crisis', 'detection', 'escalation'],
    promptFile: 'sprint-4/S4-A5-crisis-detection.md',
    status: 'pending'
  },

  // --- Track B: Intelligence ---
  {
    id: 'S4-B1',
    name: 'Trend Analysis',
    description: 'Trending topic detection, opportunity identification',
    sprint: 4,
    track: 'B',
    sequence: 1,
    estimatedHours: 6,
    dependencies: ['S3-B2', 'S3-B4', 'S3-B9'],
    blocks: ['S4-B2', 'S5-B1'],
    tags: ['trends', 'analysis', 'opportunities'],
    promptFile: 'sprint-4/S4-B1-trend-analysis.md',
    status: 'pending'
  },
  {
    id: 'S4-B2',
    name: 'Competitor Analysis',
    description: 'Competitor monitoring, strategy insights',
    sprint: 4,
    track: 'B',
    sequence: 2,
    estimatedHours: 5,
    dependencies: ['S3-B3', 'S4-B1'],
    blocks: ['S4-B4', 'S5-B1'],
    tags: ['competitors', 'analysis', 'insights'],
    promptFile: 'sprint-4/S4-B2-competitor-analysis.md',
    status: 'pending'
  },
  {
    id: 'S4-B3',
    name: 'Audience Insights',
    description: 'Audience segmentation, behavior analysis',
    sprint: 4,
    track: 'B',
    sequence: 3,
    estimatedHours: 5,
    dependencies: ['S3-B5', 'S3-B6'],
    blocks: ['S4-B4', 'S5-B2'],
    tags: ['audience', 'segmentation', 'behavior'],
    promptFile: 'sprint-4/S4-B3-audience-insights.md',
    status: 'pending'
  },
  {
    id: 'S4-B4',
    name: 'Predictive Analytics',
    description: 'Content performance prediction, optimal timing',
    sprint: 4,
    track: 'B',
    sequence: 4,
    estimatedHours: 6,
    dependencies: ['S4-B2', 'S4-B3'],
    blocks: ['S4-B5', 'S5-B2'],
    tags: ['prediction', 'analytics', 'timing'],
    promptFile: 'sprint-4/S4-B4-predictive-analytics.md',
    status: 'pending'
  },
  {
    id: 'S4-B5',
    name: 'ROI Calculator',
    description: 'Campaign ROI tracking, attribution',
    sprint: 4,
    track: 'B',
    sequence: 5,
    estimatedHours: 4,
    dependencies: ['S4-B4'],
    blocks: ['S5-B3'],
    tags: ['roi', 'attribution', 'tracking'],
    promptFile: 'sprint-4/S4-B5-roi-calculator.md',
    status: 'pending'
  },

  // --- Track C: CLI Commands ---
  {
    id: 'S4-C1',
    name: 'Engage Command',
    description: 'rtv engage - manage engagement automation',
    sprint: 4,
    track: 'C',
    sequence: 1,
    estimatedHours: 4,
    dependencies: ['S3-C1', 'S3-C2', 'S3-C3'],
    blocks: ['S4-C3', 'S5-C1'],
    tags: ['cli', 'engage', 'automation'],
    promptFile: 'sprint-4/S4-C1-engage-command.md',
    status: 'pending'
  },
  {
    id: 'S4-C2',
    name: 'Report Command',
    description: 'rtv report - generate detailed reports',
    sprint: 4,
    track: 'C',
    sequence: 2,
    estimatedHours: 4,
    dependencies: ['S3-C4', 'S3-C5'],
    blocks: ['S4-C3', 'S5-C2'],
    tags: ['cli', 'report', 'generation'],
    promptFile: 'sprint-4/S4-C2-report-command.md',
    status: 'pending'
  },
  {
    id: 'S4-C3',
    name: 'Dashboard Command',
    description: 'rtv dashboard - terminal UI dashboard',
    sprint: 4,
    track: 'C',
    sequence: 3,
    estimatedHours: 5,
    dependencies: ['S4-C1', 'S4-C2'],
    blocks: ['S5-C1'],
    tags: ['cli', 'dashboard', 'tui'],
    promptFile: 'sprint-4/S4-C3-dashboard-command.md',
    status: 'pending'
  },
  {
    id: 'S4-C4',
    name: 'Audit Command',
    description: 'rtv audit - compliance, security audit',
    sprint: 4,
    track: 'C',
    sequence: 4,
    estimatedHours: 4,
    dependencies: ['S4-C1'],
    blocks: ['S5-C2'],
    tags: ['cli', 'audit', 'compliance'],
    promptFile: 'sprint-4/S4-C4-audit-command.md',
    status: 'pending'
  },

  // --- Track D: Infrastructure ---
  {
    id: 'S4-D1',
    name: 'Multi-Region Deployment',
    description: 'Global deployment with data residency',
    sprint: 4,
    track: 'D',
    sequence: 1,
    estimatedHours: 6,
    dependencies: ['S3-D1', 'S3-D2'],
    blocks: ['S4-D2', 'S5-D1'],
    tags: ['multi-region', 'deployment', 'global'],
    promptFile: 'sprint-4/S4-D1-multi-region.md',
    status: 'pending'
  },
  {
    id: 'S4-D2',
    name: 'Disaster Recovery',
    description: 'DR procedures, RTO/RPO targets',
    sprint: 4,
    track: 'D',
    sequence: 2,
    estimatedHours: 5,
    dependencies: ['S3-D3', 'S3-D4', 'S4-D1'],
    blocks: ['S5-D1'],
    tags: ['disaster-recovery', 'backup', 'resilience'],
    promptFile: 'sprint-4/S4-D2-disaster-recovery.md',
    status: 'pending'
  },
  {
    id: 'S4-D3',
    name: 'Performance Optimization',
    description: 'Caching strategies, query optimization',
    sprint: 4,
    track: 'D',
    sequence: 3,
    estimatedHours: 5,
    dependencies: ['S3-D5'],
    blocks: ['S5-D2'],
    tags: ['performance', 'optimization', 'caching'],
    promptFile: 'sprint-4/S4-D3-performance.md',
    status: 'pending'
  },
  {
    id: 'S4-D4',
    name: 'Security Hardening',
    description: 'Security best practices, penetration testing',
    sprint: 4,
    track: 'D',
    sequence: 4,
    estimatedHours: 5,
    dependencies: ['S4-D1'],
    blocks: ['S5-D2'],
    tags: ['security', 'hardening', 'pentest'],
    promptFile: 'sprint-4/S4-D4-security.md',
    status: 'pending'
  },

  // ============================================================================
  // SPRINT 5: Enterprise & Polish (17 tasks)
  // ============================================================================

  // --- Track A: Enterprise Features ---
  {
    id: 'S5-A1',
    name: 'Multi-Tenant Architecture',
    description: 'Tenant isolation, BYOK support',
    sprint: 5,
    track: 'A',
    sequence: 1,
    estimatedHours: 8,
    dependencies: ['S4-A2', 'S4-A3', 'S4-A4'],
    blocks: ['S5-A2', 'S5-A3'],
    tags: ['multi-tenant', 'enterprise', 'byok'],
    promptFile: 'sprint-5/S5-A1-multi-tenant.md',
    status: 'pending'
  },
  {
    id: 'S5-A2',
    name: 'Team Management',
    description: 'Team roles, permissions, collaboration',
    sprint: 5,
    track: 'A',
    sequence: 2,
    estimatedHours: 5,
    dependencies: ['S4-A5', 'S5-A1'],
    blocks: ['S5-A3'],
    tags: ['teams', 'permissions', 'collaboration'],
    promptFile: 'sprint-5/S5-A2-team-management.md',
    status: 'pending'
  },
  {
    id: 'S5-A3',
    name: 'Audit Logging',
    description: 'Comprehensive audit trail, compliance',
    sprint: 5,
    track: 'A',
    sequence: 3,
    estimatedHours: 4,
    dependencies: ['S5-A1', 'S5-A2'],
    blocks: [],
    tags: ['audit', 'logging', 'compliance'],
    promptFile: 'sprint-5/S5-A3-audit-logging.md',
    status: 'pending'
  },
  {
    id: 'S5-A4',
    name: 'SSO Integration',
    description: 'SAML, OIDC enterprise authentication',
    sprint: 5,
    track: 'A',
    sequence: 4,
    estimatedHours: 5,
    dependencies: ['S5-A1'],
    blocks: [],
    tags: ['sso', 'saml', 'oidc'],
    promptFile: 'sprint-5/S5-A4-sso.md',
    status: 'pending'
  },

  // --- Track B: Advanced Analytics ---
  {
    id: 'S5-B1',
    name: 'Executive Dashboard',
    description: 'High-level KPIs, executive reporting',
    sprint: 5,
    track: 'B',
    sequence: 1,
    estimatedHours: 6,
    dependencies: ['S4-B1', 'S4-B2'],
    blocks: ['S5-B3'],
    tags: ['dashboard', 'executive', 'kpis'],
    promptFile: 'sprint-5/S5-B1-executive-dashboard.md',
    status: 'pending'
  },
  {
    id: 'S5-B2',
    name: 'Custom Reports',
    description: 'Report builder, scheduled exports',
    sprint: 5,
    track: 'B',
    sequence: 2,
    estimatedHours: 5,
    dependencies: ['S4-B3', 'S4-B4'],
    blocks: ['S5-B3'],
    tags: ['reports', 'custom', 'exports'],
    promptFile: 'sprint-5/S5-B2-custom-reports.md',
    status: 'pending'
  },
  {
    id: 'S5-B3',
    name: 'Data Export API',
    description: 'Bulk data export, integrations',
    sprint: 5,
    track: 'B',
    sequence: 3,
    estimatedHours: 4,
    dependencies: ['S4-B5', 'S5-B1', 'S5-B2'],
    blocks: [],
    tags: ['api', 'export', 'integrations'],
    promptFile: 'sprint-5/S5-B3-data-export.md',
    status: 'pending'
  },
  {
    id: 'S5-B4',
    name: 'Webhook System',
    description: 'Event webhooks, integrations',
    sprint: 5,
    track: 'B',
    sequence: 4,
    estimatedHours: 4,
    dependencies: ['S5-B1'],
    blocks: [],
    tags: ['webhooks', 'events', 'integrations'],
    promptFile: 'sprint-5/S5-B4-webhooks.md',
    status: 'pending'
  },

  // --- Track C: CLI Commands ---
  {
    id: 'S5-C1',
    name: 'Admin Command',
    description: 'rtv admin - administrative functions',
    sprint: 5,
    track: 'C',
    sequence: 1,
    estimatedHours: 4,
    dependencies: ['S4-C1', 'S4-C3'],
    blocks: ['S5-C3'],
    tags: ['cli', 'admin', 'management'],
    promptFile: 'sprint-5/S5-C1-admin-command.md',
    status: 'pending'
  },
  {
    id: 'S5-C2',
    name: 'Migrate Command',
    description: 'rtv migrate - data migration tools',
    sprint: 5,
    track: 'C',
    sequence: 2,
    estimatedHours: 4,
    dependencies: ['S4-C2', 'S4-C4'],
    blocks: ['S5-C3'],
    tags: ['cli', 'migrate', 'data'],
    promptFile: 'sprint-5/S5-C2-migrate-command.md',
    status: 'pending'
  },
  {
    id: 'S5-C3',
    name: 'Plugin Command',
    description: 'rtv plugin - plugin management',
    sprint: 5,
    track: 'C',
    sequence: 3,
    estimatedHours: 4,
    dependencies: ['S5-C1', 'S5-C2'],
    blocks: [],
    tags: ['cli', 'plugins', 'extensions'],
    promptFile: 'sprint-5/S5-C3-plugin-command.md',
    status: 'pending'
  },

  // --- Track D: Production Readiness ---
  {
    id: 'S5-D1',
    name: 'Load Testing',
    description: 'k6 load tests, performance benchmarks',
    sprint: 5,
    track: 'D',
    sequence: 1,
    estimatedHours: 5,
    dependencies: ['S4-D1', 'S4-D2'],
    blocks: ['S5-D3'],
    tags: ['load-testing', 'k6', 'performance'],
    promptFile: 'sprint-5/S5-D1-load-testing.md',
    status: 'pending'
  },
  {
    id: 'S5-D2',
    name: 'Compliance Documentation',
    description: 'GDPR, SOC2, security documentation',
    sprint: 5,
    track: 'D',
    sequence: 2,
    estimatedHours: 6,
    dependencies: ['S4-D3', 'S4-D4'],
    blocks: ['S5-D3'],
    tags: ['compliance', 'gdpr', 'soc2'],
    promptFile: 'sprint-5/S5-D2-compliance.md',
    status: 'pending'
  },
  {
    id: 'S5-D3',
    name: 'Production Runbook',
    description: 'Operational procedures, incident response',
    sprint: 5,
    track: 'D',
    sequence: 3,
    estimatedHours: 4,
    dependencies: ['S0-D7', 'S5-D1', 'S5-D2'],
    blocks: [],
    tags: ['runbook', 'operations', 'incidents'],
    promptFile: 'sprint-5/S5-D3-runbook.md',
    status: 'pending'
  },
  {
    id: 'S5-D4',
    name: 'Release Automation',
    description: 'Automated releases, changelogs, announcements',
    sprint: 5,
    track: 'D',
    sequence: 4,
    estimatedHours: 4,
    dependencies: ['S5-D1'],
    blocks: [],
    tags: ['releases', 'automation', 'changelog'],
    promptFile: 'sprint-5/S5-D4-releases.md',
    status: 'pending'
  },
  {
    id: 'S5-D5',
    name: 'SLA Monitoring',
    description: 'SLA tracking, uptime monitoring',
    sprint: 5,
    track: 'D',
    sequence: 5,
    estimatedHours: 3,
    dependencies: ['S5-D1'],
    blocks: [],
    tags: ['sla', 'uptime', 'monitoring'],
    promptFile: 'sprint-5/S5-D5-sla-monitoring.md',
    status: 'pending'
  }
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get task by ID
 */
export function getTaskById(id: string): TaskDefinition | undefined {
  return TASK_DEFINITIONS.find(task => task.id === id);
}

/**
 * Get all tasks for a sprint
 */
export function getTasksBySprint(sprint: Sprint): TaskDefinition[] {
  return TASK_DEFINITIONS.filter(task => task.sprint === sprint);
}

/**
 * Get all tasks for a track
 */
export function getTasksByTrack(track: TaskTrack): TaskDefinition[] {
  return TASK_DEFINITIONS.filter(task => task.track === track);
}

/**
 * Get ready tasks (all dependencies completed)
 */
export function getReadyTasks(): TaskDefinition[] {
  return TASK_DEFINITIONS.filter(task => {
    if (task.status !== 'pending') return false;
    return task.dependencies.every(depId => {
      const dep = getTaskById(depId);
      return dep?.status === 'completed';
    });
  });
}

/**
 * Get blocked tasks
 */
export function getBlockedTasks(): TaskDefinition[] {
  return TASK_DEFINITIONS.filter(task => {
    if (task.status !== 'pending') return false;
    return task.dependencies.some(depId => {
      const dep = getTaskById(depId);
      return dep?.status !== 'completed';
    });
  });
}

/**
 * Get tasks by tag
 */
export function getTasksByTag(tag: string): TaskDefinition[] {
  return TASK_DEFINITIONS.filter(task => task.tags.includes(tag));
}

/**
 * Get Tesla enhancement tasks
 */
export function getTeslaEnhancementTasks(): TaskDefinition[] {
  return getTasksByTag('tesla-enhancement');
}

/**
 * Calculate sprint statistics
 */
export function getSprintStats(sprint: Sprint): {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  blocked: number;
  estimatedHours: number;
} {
  const tasks = getTasksBySprint(sprint);
  return {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    estimatedHours: tasks.reduce((sum, t) => sum + t.estimatedHours, 0)
  };
}

/**
 * Get critical path (longest dependency chain)
 */
export function getCriticalPath(): string[] {
  const visited = new Set<string>();
  const memo = new Map<string, string[]>();

  function getLongestPath(taskId: string): string[] {
    if (memo.has(taskId)) return memo.get(taskId)!;
    if (visited.has(taskId)) return [];

    visited.add(taskId);
    const task = getTaskById(taskId);
    if (!task) return [];

    let longestPath: string[] = [];
    for (const blockId of task.blocks) {
      const path = getLongestPath(blockId);
      if (path.length > longestPath.length) {
        longestPath = path;
      }
    }

    const result = [taskId, ...longestPath];
    memo.set(taskId, result);
    visited.delete(taskId);
    return result;
  }

  // Find starting tasks (no dependencies)
  const startTasks = TASK_DEFINITIONS.filter(t => t.dependencies.length === 0);
  let criticalPath: string[] = [];

  for (const task of startTasks) {
    const path = getLongestPath(task.id);
    if (path.length > criticalPath.length) {
      criticalPath = path;
    }
  }

  return criticalPath;
}

// Export total count for validation
export const TOTAL_TASK_COUNT = TASK_DEFINITIONS.length; // Should be 129
