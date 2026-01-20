# Build Prompt: S0-D3 — Audit Event Framework

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-D3 |
| **Sprint** | 0 — Foundation |
| **Agent** | D — Observability Baseline |
| **Complexity** | High |
| **Estimated Effort** | 3-4 hours |
| **Dependencies** | S0-B4, S0-D1, S0-D2 |
| **Blocks** | Sprint 1 |

---

## Context

### What We're Building

Create the runtime audit event framework that connects to the audit_events database table (S0-B4) and provides a simple API for emitting audit events from anywhere in the codebase.

### Why This Matters

- **Accountability**: Every side effect is recorded
- **Compliance**: Audit trail for security reviews
- **Debugging**: Understand what happened and when
- **Proof**: Capture evidence of actions

### Spec References

- `/docs/05-policy-safety/side-effect-safety-spec.md#3-proof-capture`
- `/docs/06-reliability-ops/observability-dashboard.md#4-audit-events`
- `/docs/01-architecture/system-architecture-v3.md#7-audit-trail`

**Critical Constraint (from side-effect-safety-spec.md):**
> Every side effect MUST emit an AuditEvent with:
> - `action_type`: The operation performed
> - `target_ref`: What was affected
> - `proof`: Evidence the action completed
> - `outcome`: success | failure | partial

---

## Prerequisites

### Completed Tasks

- [x] S0-B4: Audit event schema
- [x] S0-D1: OpenTelemetry instrumentation
- [x] S0-D2: Structured logging

### Required Packages

- `@rtv/db` (for audit_events table)
- `@rtv/observability` (for tracing/logging)

---

## Instructions

### Phase 1: Test First (TDD)

**File: `packages/observability/src/__tests__/audit.test.ts`**

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  AuditEmitter,
  createAuditEmitter,
  type AuditEventInput,
} from '../audit';

// Mock the database module
vi.mock('@rtv/db', () => ({
  createAuditEvent: vi.fn().mockResolvedValue({ id: 'audit-123' }),
}));

describe('Audit Event Framework', () => {
  let emitter: AuditEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    emitter = createAuditEmitter({ bufferSize: 10, flushIntervalMs: 1000 });
  });

  test('emit creates audit event with required fields', async () => {
    const event: AuditEventInput = {
      clientId: 'client-123',
      actionType: 'content.publish',
      actorType: 'agent',
      actorId: 'publisher-agent',
      targetType: 'post',
      targetId: 'post-456',
      outcome: 'success',
    };

    const result = await emitter.emit(event);
    expect(result.id).toBe('audit-123');
  });

  test('emit adds proof when provided', async () => {
    const event: AuditEventInput = {
      clientId: 'client-123',
      actionType: 'content.publish',
      actorType: 'agent',
      actorId: 'publisher-agent',
      targetType: 'post',
      targetId: 'post-456',
      outcome: 'success',
      proof: {
        type: 'api_response',
        data: { postId: 'ig_789' },
      },
    };

    const result = await emitter.emit(event);
    expect(result).toBeDefined();
  });

  test('emit adds correlation from current span', async () => {
    const event: AuditEventInput = {
      clientId: 'client-123',
      actionType: 'test.event',
      actorType: 'system',
      actorId: 'test',
      targetType: 'test',
      targetId: 'test-1',
      outcome: 'success',
    };

    await emitter.emit(event);
    // Correlation ID should be added from trace context
  });

  test('builder pattern creates valid event', async () => {
    const result = await emitter
      .forClient('client-123')
      .action('content.create')
      .actor('agent', 'copy-agent')
      .target('asset', 'asset-789')
      .succeeded()
      .withApiProof({ assetId: 'asset-789' })
      .emit();

    expect(result).toBeDefined();
  });

  test('builder captures failure with error details', async () => {
    const result = await emitter
      .forClient('client-123')
      .action('content.publish')
      .actor('agent', 'publisher-agent')
      .target('post', 'post-123')
      .failed('PLATFORM_ERROR', 'Rate limit exceeded')
      .emit();

    expect(result).toBeDefined();
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Audit Module

**File: `packages/observability/src/audit.ts`**

```bash
cat > packages/observability/src/audit.ts << 'EOF'
/**
 * Audit Event Framework
 *
 * Provides a simple API for emitting audit events that are stored
 * in the database and correlated with traces.
 */

import { getCurrentSpan } from './tracing';
import { getLogger } from './logging';
import type { Logger } from 'pino';

// Types from @rtv/db (will be imported when available)
export interface AuditProof {
  type: 'screenshot' | 'api_response' | 'hash' | 'url' | 'none';
  data?: Record<string, unknown>;
  url?: string;
  hash?: string;
  capturedAt?: string;
}

export interface AuditMetadata {
  platform?: string;
  lane?: 'api' | 'browser';
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
  episodeId?: string;
  [key: string]: unknown;
}

export type AuditActorType = 'user' | 'agent' | 'system' | 'webhook';
export type AuditOutcome = 'success' | 'failure' | 'partial' | 'pending';

/**
 * Input for creating an audit event
 */
export interface AuditEventInput {
  clientId: string;
  actionType: string;
  actorType: AuditActorType;
  actorId: string;
  targetType: string;
  targetId: string;
  outcome: AuditOutcome;
  proof?: AuditProof;
  metadata?: AuditMetadata;
  correlationId?: string;
  parentEventId?: string;
}

/**
 * Audit event result
 */
export interface AuditEventResult {
  id: string;
  createdAt: Date;
}

/**
 * Audit emitter configuration
 */
export interface AuditEmitterConfig {
  bufferSize?: number;
  flushIntervalMs?: number;
  logger?: Logger;
}

/**
 * Audit Event Emitter
 *
 * Provides both direct emit() and builder pattern for creating audit events.
 */
export class AuditEmitter {
  private logger: Logger;
  private buffer: AuditEventInput[] = [];
  private bufferSize: number;
  private flushIntervalMs: number;
  private flushTimer: NodeJS.Timeout | null = null;

  // Builder state
  private builderState: Partial<AuditEventInput> = {};

  constructor(config: AuditEmitterConfig = {}) {
    this.logger = config.logger ?? getLogger().child({ module: 'audit' });
    this.bufferSize = config.bufferSize ?? 100;
    this.flushIntervalMs = config.flushIntervalMs ?? 5000;
  }

  /**
   * Emit an audit event immediately
   */
  async emit(event: AuditEventInput): Promise<AuditEventResult> {
    // Add correlation from trace context
    const span = getCurrentSpan();
    if (span && !event.correlationId) {
      event.correlationId = span.spanContext().traceId;
    }

    // Log the event
    this.logger.info(
      {
        auditEvent: true,
        actionType: event.actionType,
        targetType: event.targetType,
        targetId: event.targetId,
        outcome: event.outcome,
        clientId: event.clientId,
      },
      `Audit: ${event.actionType} on ${event.targetType}/${event.targetId}`
    );

    // Store in database
    try {
      // Import dynamically to avoid circular dependency
      const { createAuditEvent } = await import('@rtv/db');
      const result = await createAuditEvent(event);
      return { id: result.id, createdAt: result.createdAt };
    } catch (error) {
      // If DB is not available, log and continue
      this.logger.warn(
        { error, event },
        'Failed to persist audit event to database'
      );
      return { id: `local-${Date.now()}`, createdAt: new Date() };
    }
  }

  /**
   * Buffer an event for batch writing
   */
  buffer(event: AuditEventInput): void {
    this.buffer.push(event);

    if (this.buffer.length >= this.bufferSize) {
      void this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => void this.flush(), this.flushIntervalMs);
    }
  }

  /**
   * Flush buffered events
   */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) return;

    const events = this.buffer.splice(0);
    for (const event of events) {
      await this.emit(event);
    }
  }

  // =====================
  // Builder Pattern API
  // =====================

  /**
   * Start building an event for a client
   */
  forClient(clientId: string): this {
    this.builderState = { clientId };
    return this;
  }

  /**
   * Set the action type
   */
  action(actionType: string): this {
    this.builderState.actionType = actionType;
    return this;
  }

  /**
   * Set the actor
   */
  actor(type: AuditActorType, id: string): this {
    this.builderState.actorType = type;
    this.builderState.actorId = id;
    return this;
  }

  /**
   * Set the target
   */
  target(type: string, id: string): this {
    this.builderState.targetType = type;
    this.builderState.targetId = id;
    return this;
  }

  /**
   * Mark as succeeded
   */
  succeeded(): this {
    this.builderState.outcome = 'success';
    return this;
  }

  /**
   * Mark as failed
   */
  failed(errorCode?: string, errorMessage?: string): this {
    this.builderState.outcome = 'failure';
    this.builderState.metadata = {
      ...this.builderState.metadata,
      errorCode,
      errorMessage,
    };
    return this;
  }

  /**
   * Mark as partial
   */
  partial(): this {
    this.builderState.outcome = 'partial';
    return this;
  }

  /**
   * Mark as pending
   */
  pending(): this {
    this.builderState.outcome = 'pending';
    return this;
  }

  /**
   * Add proof
   */
  withProof(proof: AuditProof): this {
    this.builderState.proof = proof;
    return this;
  }

  /**
   * Add API response proof
   */
  withApiProof(data: Record<string, unknown>): this {
    this.builderState.proof = { type: 'api_response', data };
    return this;
  }

  /**
   * Add screenshot proof
   */
  withScreenshotProof(url: string): this {
    this.builderState.proof = {
      type: 'screenshot',
      url,
      capturedAt: new Date().toISOString(),
    };
    return this;
  }

  /**
   * Add metadata
   */
  withMetadata(metadata: AuditMetadata): this {
    this.builderState.metadata = { ...this.builderState.metadata, ...metadata };
    return this;
  }

  /**
   * Set correlation ID
   */
  withCorrelation(correlationId: string): this {
    this.builderState.correlationId = correlationId;
    return this;
  }

  /**
   * Link to parent event
   */
  childOf(parentEventId: string): this {
    this.builderState.parentEventId = parentEventId;
    return this;
  }

  /**
   * Emit the built event
   */
  async emitBuilt(): Promise<AuditEventResult> {
    const event = this.validateAndBuild();
    this.builderState = {}; // Reset
    return this.emit(event);
  }

  private validateAndBuild(): AuditEventInput {
    const { clientId, actionType, actorType, actorId, targetType, targetId, outcome } =
      this.builderState;

    if (!clientId) throw new Error('clientId is required');
    if (!actionType) throw new Error('actionType is required');
    if (!actorType) throw new Error('actorType is required');
    if (!actorId) throw new Error('actorId is required');
    if (!targetType) throw new Error('targetType is required');
    if (!targetId) throw new Error('targetId is required');
    if (!outcome) throw new Error('outcome is required');

    return this.builderState as AuditEventInput;
  }
}

// Default emitter instance
let defaultEmitter: AuditEmitter | null = null;

/**
 * Create a new audit emitter
 */
export function createAuditEmitter(config?: AuditEmitterConfig): AuditEmitter {
  return new AuditEmitter(config);
}

/**
 * Get or create the default audit emitter
 */
export function getAuditEmitter(): AuditEmitter {
  if (!defaultEmitter) {
    defaultEmitter = createAuditEmitter();
  }
  return defaultEmitter;
}

/**
 * Convenience function to emit an audit event
 */
export async function emitAuditEvent(event: AuditEventInput): Promise<AuditEventResult> {
  return getAuditEmitter().emit(event);
}

/**
 * Start building an audit event
 */
export function audit(): AuditEmitter {
  return getAuditEmitter();
}
EOF
```

#### Step 2: Update Package Index

**File: `packages/observability/src/index.ts`** (update)

```bash
cat > packages/observability/src/index.ts << 'EOF'
/**
 * @rtv/observability - Observability package
 *
 * Provides tracing, metrics, logging, and auditing for the RTV platform.
 */

// Tracing
export {
  initTracing,
  shutdownTracing,
  getTracer,
  getCurrentSpan,
  getCurrentContext,
  createSpan,
  withSpan,
  addSpanAttributes,
  addSpanEvent,
  setTenantContext,
  type TracingConfig,
} from './tracing';

// Logging
export {
  createLogger,
  getLogger,
  setDefaultLogger,
  withLogContext,
  withTenantLogger,
  withRequestLogger,
  createModuleLogger,
  logOperation,
  redactSensitive,
  LogLevel,
  type Logger,
  type LogContext,
  type LoggerConfig,
  type LogLevelType,
} from './logging';

// Auditing
export {
  AuditEmitter,
  createAuditEmitter,
  getAuditEmitter,
  emitAuditEvent,
  audit,
  type AuditEventInput,
  type AuditEventResult,
  type AuditProof,
  type AuditMetadata,
  type AuditActorType,
  type AuditOutcome,
  type AuditEmitterConfig,
} from './audit';

// Metrics
export {
  initMetrics,
  getMeter,
  createCounter,
  createHistogram,
} from './metrics';

// Re-export common OTEL types
export { SpanStatusCode, SpanKind } from '@opentelemetry/api';
EOF
```

#### Step 3: Add @rtv/db as Dependency

```bash
cd packages/observability

# Add db package as dependency
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
pkg.dependencies['@rtv/db'] = 'workspace:*';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update references in tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  "references": [
    { "path": "../types" },
    { "path": "../db" }
  ]
}
EOF

pnpm install
```

### Phase 3: Verification

```bash
cd packages/observability

# Build
pnpm build

# Typecheck
pnpm typecheck

# Run tests
pnpm test

# Test audit framework manually
cat > test-audit.ts << 'EOF'
import { audit, emitAuditEvent } from './src/audit';

async function main() {
  // Direct emit
  await emitAuditEvent({
    clientId: 'client-123',
    actionType: 'content.publish',
    actorType: 'agent',
    actorId: 'test-agent',
    targetType: 'post',
    targetId: 'post-456',
    outcome: 'success',
    proof: {
      type: 'api_response',
      data: { postId: 'ig_789' },
    },
  });

  // Builder pattern
  await audit()
    .forClient('client-123')
    .action('content.create')
    .actor('agent', 'copy-agent')
    .target('asset', 'asset-789')
    .succeeded()
    .withApiProof({ assetId: 'asset-789' })
    .emitBuilt();

  console.log('Audit events emitted');
}

main().catch(console.error);
EOF

npx tsx test-audit.ts
rm test-audit.ts
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/observability/src/audit.ts` | Audit framework |
| Modify | `packages/observability/src/index.ts` | Export audit |
| Modify | `packages/observability/package.json` | Add @rtv/db dep |
| Modify | `packages/observability/tsconfig.json` | Add db reference |
| Create | `packages/observability/src/__tests__/audit.test.ts` | Audit tests |

---

## Acceptance Criteria

- [ ] `AuditEmitter` class exists
- [ ] Direct `emit()` method works
- [ ] Builder pattern works (forClient → action → actor → target → outcome → emit)
- [ ] Correlation ID from trace context
- [ ] Proof can be attached
- [ ] Events logged to console
- [ ] Events persisted to database (when available)
- [ ] Audit tests pass

---

## Test Requirements

### Unit Tests

- emit() creates event with required fields
- Builder validates required fields
- Correlation ID added from span

### Integration Tests

- Events persisted to audit_events table
- Events queryable by action type

---

## Security & Safety Checklist

- [ ] No sensitive data in proof
- [ ] client_id always present
- [ ] Error details don't leak secrets
- [ ] Audit log cannot be tampered with

---

## JSON Task Block

```json
{
  "task_id": "S0-D3",
  "name": "Audit Event Framework",
  "sprint": 0,
  "agent": "D",
  "status": "pending",
  "complexity": "high",
  "estimated_hours": 4,
  "dependencies": ["S0-B4", "S0-D1", "S0-D2"],
  "blocks": [],
  "tags": ["observability", "audit", "compliance"],
  "acceptance_criteria": [
    "AuditEmitter class exists",
    "builder pattern works",
    "events persisted to DB",
    "correlation from traces"
  ],
  "created_at": "2025-01-16T00:00:00Z",
  "updated_at": null,
  "completed_at": null
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "agent_id": null,
  "decisions": [],
  "artifacts": [],
  "notes": []
}
```

---

## Next Steps

After completing this task:

1. **S0-D4**: Set up error tracking
2. **S0-D5**: Implement basic metrics collection
