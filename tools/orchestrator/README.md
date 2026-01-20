# RTV Task Orchestrator

A CLI tool for managing the 121-task build across 6 sprints. Tracks dependencies, dispatches tasks to agents, and monitors progress.

## Quick Start

```bash
cd tools/orchestrator
pnpm install
pnpm start status    # View overall progress
pnpm start next      # See available tasks
pnpm start plan      # View parallel execution plan
```

## Commands

### Status & Progress

```bash
# Overall status
pnpm start status

# Specific sprint status
pnpm start status --sprint 0

# All sprints detailed
pnpm start status --all
```

### Task Discovery

```bash
# Show next available tasks (default: 8)
pnpm start next

# Show more tasks
pnpm start next --limit 20

# View parallel execution plan
pnpm start plan
pnpm start plan --sprint 1
```

### Task Management

```bash
# Dispatch a task to an agent
pnpm start dispatch S0-A1

# Dispatch with specific agent ID
pnpm start dispatch S0-A1 --agent agent-alpha

# Mark task complete
pnpm start complete S0-A1
pnpm start complete S0-A1 --notes "All tests passing"

# Mark task failed
pnpm start fail S0-A1 --reason "Blocked by missing API key"

# Reset task to retry
pnpm start reset S0-A1
```

### Prompts & Export

```bash
# View full prompt for a task
pnpm start prompt S0-A1

# Save prompt to file
pnpm start prompt S0-A1 --output my-task.md

# Export all ready tasks
pnpm start export
pnpm start export --output ready.md
```

### History

```bash
# View recent activity
pnpm start history

# View more entries
pnpm start history --limit 50
```

## Architecture

```
orchestrator/
├── src/
│   ├── types.ts           # Type definitions
│   ├── task-registry.ts   # All 121 task definitions
│   ├── orchestrator.ts    # Core engine
│   ├── cli.ts             # CLI interface
│   └── index.ts           # Public API
├── state.json             # Persistent state (auto-created)
├── package.json
└── README.md
```

## Task Lifecycle

```
pending → ready → in_progress → complete
                      ↓
                    failed → [reset] → pending
```

- **pending**: Dependencies not yet met
- **ready**: All dependencies complete, can be dispatched
- **in_progress**: Currently being worked on by an agent
- **complete**: Done and verified
- **failed**: Encountered blocker (can be reset)

## Parallel Execution Model

Each sprint has 4 agent tracks (A, B, C, D) that can run in parallel:

```
Sprint 0:
  Agent A: Repository & Core Packages
  Agent B: Database Schema  
  Agent C: CI/CD Pipeline
  Agent D: Observability
```

Within an agent track, tasks are sequential (A2 depends on A1).
Across tracks, tasks are parallel (A1, B1, C1, D1 can run simultaneously).

## Dependency Resolution

The orchestrator automatically:
- Tracks dependencies between tasks
- Updates task status when dependencies complete
- Prevents dispatching blocked tasks
- Calculates critical path

## State Persistence

State is automatically saved to `state.json` after every operation:
- Task statuses
- Agent assignments
- History log
- Progress metrics

## Integration with Build Prompts

Each task references a prompt file in `docs/00-overview/PRD-v2/`:

```
S0-A1 → sprint-0/S0-A1-monorepo-scaffold.md
S1-B3 → sprint-1/S1-B3-reference-system.md
```

Use `pnpm start prompt <task-id>` to view the full build instructions.

## Typical Workflow

1. **Check status**: `pnpm start status`
2. **Find next task**: `pnpm start next`
3. **View prompt**: `pnpm start prompt S0-A1`
4. **Dispatch**: `pnpm start dispatch S0-A1`
5. **Execute TDD**: RED → GREEN → REFACTOR
6. **Complete**: `pnpm start complete S0-A1`
7. **Repeat**

## Environment Variables

- `RTV_PROJECT_ROOT`: Override project root detection (optional)

## Troubleshooting

**"No tasks ready"**: Check if previous tasks are complete, or if you need to start a new sprint.

**"Task not in progress"**: Only dispatched tasks can be completed. Dispatch first.

**State corruption**: Delete `state.json` to reinitialize from task definitions.
