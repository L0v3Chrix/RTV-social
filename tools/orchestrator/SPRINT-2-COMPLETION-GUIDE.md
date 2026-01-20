# Sprint 2: LLM Integration & Agent Core - Complete Execution Guide

> **Autonomous Agent Execution Plan**
> **Sprint:** 2 - LLM Integration & Agent Core
> **Total Tasks:** 22 (includes 2 Tesla enhancements)
> **Estimated Duration:** 20-24 hours across 6 waves
> **Prerequisites:** Sprint 1 complete (23 tasks, ~300 tests)

---

## 🎯 Mission Brief

You are completing Sprint 2 of the RTV Social Automation project. This sprint establishes the agent architecture, LLM provider integrations, and infrastructure for job processing.

**Your prime directives:**
1. Follow TDD methodology (RED → GREEN → REFACTOR) for every task
2. Run tests after each task - do not proceed if tests fail
3. Commit at each gate checkpoint
4. Respect dependency ordering - never skip ahead
5. All code must pass TypeScript strict mode

---

## 📋 Pre-Flight Checklist

Before starting, verify Sprint 1 is complete:

```bash
pnpm install && pnpm build && pnpm test
# Expected: ~300+ tests pass, all packages build
```

**Required Sprint 1 deliverables (verify these exist):**
- [ ] Memory stores (in-memory, SQLite) with query language
- [ ] Context assembler with compression
- [ ] Token encoder with caching
- [ ] CLI commands (init, config, status, memory, doctor)
- [ ] Redis, rate limiter, health checks, metrics, tracing
- [ ] Tesla: Memory priority schema, eviction engine, pinned context manager

---

## 🗺️ Dependency Graph

```
SPRINT 2 TASK FLOW
==================

WAVE 1 (Parallel Entry Points)
├── S2-A1: Agent State Machine ────── needs S1-A4, S1-A5
├── S2-B1: LLM Provider Interface ─── needs S1-B4, S1-B5
├── S2-C1: Run Command ────────────── needs S1-C1, S1-C2, S1-C5
└── S2-D1: Queue System ───────────── needs S1-D1, S1-D2

WAVE 2 (After Wave 1)
├── S2-A2: Agent Event Bus ────────── needs S2-A1
├── S2-B2: OpenAI Provider ────────── needs S2-B1, S1-D2
├── S2-B3: Anthropic Provider ─────── needs S2-B1
├── S2-B4: Local LLM Provider ─────── needs S2-B1
├── S2-C2: Watch Command ──────────── needs S2-C1, S1-C3, S1-C4
└── S2-D2: Monitoring Dashboard ───── needs S2-D1, S1-D3, S1-D4, S1-D5

WAVE 3 (After Wave 2)
├── S2-A3: Agent Executor ─────────── needs S2-A1, S2-A2
├── S2-B5: Provider Router ────────── needs S2-B2, S2-B3, S2-B4
├── S2-C3: Logs Command ───────────── needs S2-C1
├── S2-C4: Test Command ───────────── needs S2-C1
├── S2-C5: Benchmark Command ──────── needs S2-C1
├── S2-D3: Alerting Rules ─────────── needs S2-D2
├── S2-D4: Secret Management ──────── needs S2-D1
└── S2-D5: Backup & Recovery ──────── needs S2-D1

WAVE 4 (After Wave 3)
├── S2-A4: Agent Supervisor ───────── needs S2-A2, S2-A3
└── S2-A6: Task Context Registry ──── needs S2-A1, S1-B8 (Tesla)

WAVE 5 (After Wave 4)
├── S2-A5: Agent Registry ─────────── needs S2-A3, S2-A4
└── S2-A7: Sparse Context Loader ──── needs S2-A6, S1-B5 (Tesla)
```

---

## 🚦 Execution Waves

### ══════════════════════════════════════════════════════════════════
### WAVE 1: Agent & LLM Foundation
### ══════════════════════════════════════════════════════════════════

#### Task S2-A1: Agent State Machine
**Package:** `packages/agent/src/state-machine/`
**Est. Time:** 6 hours
**Depends on:** S1-A4, S1-A5

```typescript
// XState-based agent lifecycle
import { createMachine, interpret } from 'xstate';

type AgentState =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'executing'
  | 'paused'
  | 'error'
  | 'terminated';

type AgentEvent =
  | { type: 'INITIALIZE'; config: AgentConfig }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'ERROR'; error: Error }
  | { type: 'TASK_COMPLETE'; result: TaskResult };

interface AgentContext {
  id: string;
  config: AgentConfig;
  currentTask?: Task;
  error?: Error;
  metrics: AgentMetrics;
}

const agentMachine = createMachine<AgentContext, AgentEvent>({
  id: 'agent',
  initial: 'idle',
  states: {
    idle: { on: { INITIALIZE: 'initializing' } },
    initializing: { /* ... */ },
    ready: { on: { START: 'executing', STOP: 'terminated' } },
    executing: { on: { PAUSE: 'paused', ERROR: 'error', TASK_COMPLETE: 'ready' } },
    paused: { on: { RESUME: 'executing', STOP: 'terminated' } },
    error: { on: { INITIALIZE: 'initializing', STOP: 'terminated' } },
    terminated: { type: 'final' }
  }
});
```

**Tests Required:**
- State transitions work correctly
- Guards prevent invalid transitions
- Context updates on events
- Actions fire appropriately
- Async services integrate

---

#### Task S2-B1: LLM Provider Interface
**Package:** `packages/llm/src/provider/`
**Est. Time:** 4 hours
**Depends on:** S1-B4, S1-B5

```typescript
interface ILLMProvider {
  readonly name: string;
  readonly models: ModelInfo[];

  // Core operations
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest): AsyncIterable<StreamChunk>;

  // Tool/function calling
  completeWithTools(request: ToolRequest): Promise<ToolResponse>;

  // Vision (optional)
  supportsVision(): boolean;
  completeWithVision?(request: VisionRequest): Promise<CompletionResponse>;

  // Health
  healthCheck(): Promise<boolean>;
  getUsage(): ProviderUsage;
}

interface CompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  toolCallId?: string;
}
```

---

#### Task S2-C1: Run Command
**Package:** `packages/cli/src/commands/run/`
**Est. Time:** 5 hours
**Depends on:** S1-C1, S1-C2, S1-C5

```typescript
// rtv run - Execute campaigns
interface RunOptions {
  campaign?: string;
  config?: string;
  dryRun?: boolean;
  verbose?: boolean;
  parallel?: number;
  timeout?: number;
}

// Subcommands: rtv run campaign, rtv run agent, rtv run task
```

---

#### Task S2-D1: Queue System
**Package:** `packages/infrastructure/src/queue/`
**Est. Time:** 5 hours
**Depends on:** S1-D1, S1-D2

```typescript
// BullMQ job queue
import { Queue, Worker, Job } from 'bullmq';

interface JobQueue<T = unknown> {
  add(name: string, data: T, options?: JobOptions): Promise<Job<T>>;
  addBulk(jobs: { name: string; data: T; options?: JobOptions }[]): Promise<Job<T>[]>;

  process(handler: JobHandler<T>): void;
  pause(): Promise<void>;
  resume(): Promise<void>;

  getJob(id: string): Promise<Job<T> | null>;
  getJobs(status: JobStatus[]): Promise<Job<T>[]>;

  on(event: QueueEvent, handler: EventHandler): void;
}

interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: BackoffOptions;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}
```

---

### 🚧 GATE 1: Wave 1 Checkpoint
```bash
pnpm test
pnpm build

git add -A
git commit -m "feat(sprint-2): wave 1 - agent state machine, LLM interface, run command, queue

- S2-A1: XState agent state machine with lifecycle management
- S2-B1: ILLMProvider interface with streaming and tools
- S2-C1: rtv run command with campaign execution
- S2-D1: BullMQ job queue with priorities and retries

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push
```

---

### ══════════════════════════════════════════════════════════════════
### WAVE 2: Provider Implementations
### ══════════════════════════════════════════════════════════════════

#### Task S2-A2: Agent Event Bus
**Package:** `packages/agent/src/events/`
**Est. Time:** 3 hours
**Depends on:** S2-A1

```typescript
// EventEmitter3 with typed events
import EventEmitter from 'eventemitter3';

type AgentEvents = {
  'task:start': (task: Task) => void;
  'task:complete': (task: Task, result: TaskResult) => void;
  'task:error': (task: Task, error: Error) => void;
  'state:change': (from: AgentState, to: AgentState) => void;
  'memory:update': (key: string, value: unknown) => void;
  'llm:request': (request: CompletionRequest) => void;
  'llm:response': (response: CompletionResponse) => void;
};

class AgentEventBus extends EventEmitter<AgentEvents> {
  emitAsync<K extends keyof AgentEvents>(
    event: K,
    ...args: Parameters<AgentEvents[K]>
  ): Promise<void>;

  onceAsync<K extends keyof AgentEvents>(event: K): Promise<Parameters<AgentEvents[K]>>;
}
```

---

#### Task S2-B2: OpenAI Provider
**Package:** `packages/llm/src/providers/openai/`
**Est. Time:** 5 hours
**Depends on:** S2-B1, S1-D2

```typescript
// OpenAI API client
class OpenAIProvider implements ILLMProvider {
  constructor(config: OpenAIConfig);

  // GPT-4, GPT-4o, GPT-4o-mini support
  // Vision with GPT-4V
  // Function calling / tool use
  // Streaming responses
  // Rate limit handling with backoff
  // Token usage tracking
}

interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}
```

---

#### Task S2-B3: Anthropic Provider
**Package:** `packages/llm/src/providers/anthropic/`
**Est. Time:** 5 hours
**Depends on:** S2-B1

```typescript
// Claude API client
class AnthropicProvider implements ILLMProvider {
  constructor(config: AnthropicConfig);

  // Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
  // Tool use with structured outputs
  // Streaming responses
  // Rate limit handling
  // Token usage tracking
}
```

---

#### Task S2-B4: Local LLM Provider
**Package:** `packages/llm/src/providers/local/`
**Est. Time:** 4 hours
**Depends on:** S2-B1

```typescript
// Ollama/LM Studio support
class LocalLLMProvider implements ILLMProvider {
  constructor(config: LocalConfig);

  // Ollama API compatibility
  // LM Studio OpenAI-compatible endpoint
  // Model discovery
  // GPU/CPU inference options
}

interface LocalConfig {
  endpoint: string;
  model?: string;
  contextLength?: number;
}
```

---

#### Task S2-C2: Watch Command
**Package:** `packages/cli/src/commands/watch/`
**Est. Time:** 4 hours
**Depends on:** S2-C1, S1-C3, S1-C4

```typescript
// rtv watch - Live monitoring
// Real-time status updates
// Agent activity feed
// Resource usage display
```

---

#### Task S2-D2: Monitoring Dashboard
**Package:** `packages/infrastructure/src/monitoring/`
**Est. Time:** 4 hours
**Depends on:** S2-D1, S1-D3, S1-D4, S1-D5

```typescript
// Grafana dashboard configurations
// Dashboards: Agent Performance, LLM Usage, Queue Status, System Health
// Prometheus queries for metrics
// Log aggregation views
```

---

### 🚧 GATE 2: Wave 2 Checkpoint
```bash
pnpm test
pnpm build

git add -A
git commit -m "feat(sprint-2): wave 2 - event bus, LLM providers, watch command, monitoring

- S2-A2: Typed AgentEventBus with async support
- S2-B2: OpenAI provider with GPT-4, vision, function calling
- S2-B3: Anthropic provider with Claude 3.5 Sonnet
- S2-B4: Local LLM provider for Ollama/LM Studio
- S2-C2: rtv watch live monitoring command
- S2-D2: Grafana monitoring dashboards

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push
```

---

### ══════════════════════════════════════════════════════════════════
### WAVE 3: Execution & Routing
### ══════════════════════════════════════════════════════════════════

#### Task S2-A3: Agent Executor
**Package:** `packages/agent/src/executor/`
**Est. Time:** 5 hours
**Depends on:** S2-A1, S2-A2

```typescript
// Task execution loop
class AgentExecutor {
  constructor(agent: Agent, options: ExecutorOptions);

  execute(task: Task): Promise<TaskResult>;
  executeWithRetry(task: Task, maxRetries: number): Promise<TaskResult>;
  cancel(): void;

  // Hooks
  onBeforeExecute(hook: ExecuteHook): void;
  onAfterExecute(hook: ExecuteHook): void;
  onError(hook: ErrorHook): void;
}

interface ExecutorOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  abortSignal?: AbortSignal;
}
```

---

#### Task S2-B5: Provider Router
**Package:** `packages/llm/src/router/`
**Est. Time:** 5 hours
**Depends on:** S2-B2, S2-B3, S2-B4

```typescript
// Load balancing and failover
class ProviderRouter implements ILLMProvider {
  constructor(providers: ILLMProvider[], config: RouterConfig);

  // Routing strategies
  setStrategy(strategy: RoutingStrategy): void;

  // Failover
  addFallback(provider: ILLMProvider): void;

  // Cost optimization
  setCostLimit(daily: number, monthly: number): void;
  getCostReport(): CostReport;
}

type RoutingStrategy =
  | 'round-robin'
  | 'least-latency'
  | 'least-cost'
  | 'capability-match'
  | 'weighted';
```

---

#### Tasks S2-C3, S2-C4, S2-C5: CLI Commands
**Est. Time:** 3-4 hours each

```typescript
// S2-C3: rtv logs - View and filter logs
// S2-C4: rtv test - Run agent tests
// S2-C5: rtv benchmark - Performance testing
```

---

#### Tasks S2-D3, S2-D4, S2-D5: Infrastructure
**Est. Time:** 3-4 hours each

```typescript
// S2-D3: Alerting Rules - PagerDuty/Slack integration
// S2-D4: Secret Management - Vault/AWS Secrets Manager
// S2-D5: Backup & Recovery - Automated backups
```

---

### 🚧 GATE 3: Wave 3 Checkpoint
```bash
pnpm test
pnpm build

git add -A
git commit -m "feat(sprint-2): wave 3 - executor, router, CLI commands, infrastructure

- S2-A3: AgentExecutor with retry and timeout
- S2-B5: ProviderRouter with load balancing and failover
- S2-C3: rtv logs command
- S2-C4: rtv test command
- S2-C5: rtv benchmark command
- S2-D3: Alerting rules for PagerDuty/Slack
- S2-D4: Secret management with Vault
- S2-D5: Backup and recovery system

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push
```

---

### ══════════════════════════════════════════════════════════════════
### WAVE 4: Multi-Agent Coordination
### ══════════════════════════════════════════════════════════════════

#### Task S2-A4: Agent Supervisor
**Package:** `packages/agent/src/supervisor/`
**Est. Time:** 5 hours
**Depends on:** S2-A2, S2-A3

```typescript
// Multi-agent coordination
class AgentSupervisor {
  constructor(config: SupervisorConfig);

  // Agent management
  spawn(config: AgentConfig): Promise<Agent>;
  terminate(agentId: string): Promise<void>;
  getAgent(agentId: string): Agent | undefined;
  listAgents(): Agent[];

  // Resource allocation
  allocateResources(agentId: string, resources: Resources): void;
  getResourceUsage(): ResourceReport;

  // Task distribution
  dispatch(task: Task, strategy?: DispatchStrategy): Promise<Agent>;
  broadcast(message: Message): void;
}

type DispatchStrategy = 'first-available' | 'least-loaded' | 'specialized' | 'round-robin';
```

---

#### Task S2-A6: Task Context Registry (Tesla Enhancement)
**Package:** `packages/agent/src/context-registry/`
**Est. Time:** 4 hours
**Depends on:** S2-A1, S1-B8

```typescript
// Registry mapping task types to context categories
interface TaskContextConfig {
  taskType: TaskType;
  required: ContextCategory[];
  optional: ContextCategory[];
  excluded: ContextCategory[];
  maxTokens?: number;
}

type ContextCategory =
  | 'system_prompt'
  | 'brand_voice'
  | 'campaign_brief'
  | 'recent_posts'
  | 'engagement_history'
  | 'audience_data'
  | 'competitor_data'
  | 'trending_topics';

class TaskContextRegistry {
  register(config: TaskContextConfig): void;
  getConfig(taskType: TaskType): TaskContextConfig;
  getRequiredCategories(taskType: TaskType): ContextCategory[];
  getOptionalCategories(taskType: TaskType): ContextCategory[];
}
```

---

### 🚧 GATE 4: Wave 4 Checkpoint
```bash
pnpm test
pnpm build

git add -A
git commit -m "feat(sprint-2): wave 4 - agent supervisor, task context registry

- S2-A4: AgentSupervisor for multi-agent coordination
- S2-A6: TaskContextRegistry mapping tasks to context [Tesla Enhancement]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push
```

---

### ══════════════════════════════════════════════════════════════════
### WAVE 5: Registry & Sparse Loading (Final)
### ══════════════════════════════════════════════════════════════════

#### Task S2-A5: Agent Registry
**Package:** `packages/agent/src/registry/`
**Est. Time:** 4 hours
**Depends on:** S2-A3, S2-A4

```typescript
// Dynamic agent registration
class AgentRegistry {
  register(type: string, factory: AgentFactory): void;
  unregister(type: string): void;
  create(type: string, config: AgentConfig): Promise<Agent>;

  // Discovery
  listTypes(): string[];
  getCapabilities(type: string): AgentCapabilities;
  findByCapability(capability: string): string[];
}
```

---

#### Task S2-A7: Sparse Context Loader (Tesla Enhancement)
**Package:** `packages/agent/src/sparse-loader/`
**Est. Time:** 5 hours
**Depends on:** S2-A6, S1-B5

```typescript
// Runtime context loader with filtering
class SparseContextLoader {
  constructor(
    registry: TaskContextRegistry,
    memoryStore: IMemoryStore,
    config: LoaderConfig
  );

  // Load only relevant context for task type
  load(taskType: TaskType, budget: number): Promise<LoadedContext>;

  // Parallel loading with priority
  loadParallel(categories: ContextCategory[]): Promise<Map<ContextCategory, ContextChunk[]>>;

  // Metrics
  getLoadStats(): LoadStats;
}

interface LoadedContext {
  chunks: ContextChunk[];
  totalTokens: number;
  categories: ContextCategory[];
  excluded: ContextCategory[];
  loadTimeMs: number;
}
```

---

### 🚧 GATE 5: Sprint 2 Complete
```bash
pnpm test
pnpm build
pnpm lint

git add -A
git commit -m "feat(sprint-2): wave 5 - agent registry, sparse context loader

- S2-A5: AgentRegistry with dynamic registration and discovery
- S2-A7: SparseContextLoader with task-aware filtering [Tesla Enhancement]

Sprint 2 Complete: LLM Integration & Agent Core
- 22 tasks completed
- XState agent state machine
- LLM providers (OpenAI, Anthropic, Local)
- Provider router with failover
- Job queue with BullMQ
- Multi-agent supervisor
- Tesla: Task context registry, sparse loader

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push
git tag -a "sprint-2-complete" -m "Sprint 2: LLM Integration & Agent Core complete"
git push origin sprint-2-complete
```

---

## 📊 Progress Tracking

### Wave 1 □
- [ ] S2-A1: Agent State Machine
- [ ] S2-B1: LLM Provider Interface
- [ ] S2-C1: Run Command
- [ ] S2-D1: Queue System
- [ ] **GATE 1: Commit & Push**

### Wave 2 □
- [ ] S2-A2: Agent Event Bus
- [ ] S2-B2: OpenAI Provider
- [ ] S2-B3: Anthropic Provider
- [ ] S2-B4: Local LLM Provider
- [ ] S2-C2: Watch Command
- [ ] S2-D2: Monitoring Dashboard
- [ ] **GATE 2: Commit & Push**

### Wave 3 □
- [ ] S2-A3: Agent Executor
- [ ] S2-B5: Provider Router
- [ ] S2-C3: Logs Command
- [ ] S2-C4: Test Command
- [ ] S2-C5: Benchmark Command
- [ ] S2-D3: Alerting Rules
- [ ] S2-D4: Secret Management
- [ ] S2-D5: Backup & Recovery
- [ ] **GATE 3: Commit & Push**

### Wave 4 □
- [ ] S2-A4: Agent Supervisor
- [ ] S2-A6: Task Context Registry ⚡
- [ ] **GATE 4: Commit & Push**

### Wave 5 □
- [ ] S2-A5: Agent Registry
- [ ] S2-A7: Sparse Context Loader ⚡
- [ ] **GATE 5: Sprint Complete - Tag & Push**

⚡ = Tesla Enhancement

---

## 🎯 Success Criteria

Sprint 2 is complete when:
- [ ] All 22 tasks implemented
- [ ] All tests pass (expect 450+ tests total)
- [ ] All packages build with no errors
- [ ] LLM providers work with real API calls (test with env vars)
- [ ] Queue system processes jobs correctly
- [ ] Agent state machine transitions correctly
- [ ] All 5 gate commits pushed
- [ ] Sprint tag created and pushed
