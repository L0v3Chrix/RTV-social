# Build Prompt: S1-D3 — Tool Wrapper Abstraction

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S1-D3 |
| **Sprint** | 1 — Core Infrastructure |
| **Agent** | D — Runner Skeleton |
| **Task Name** | Tool Wrapper Abstraction |
| **Complexity** | Medium |
| **Estimated Effort** | 4-5 hours |
| **Dependencies** | S1-D1, S1-D2, S1-C5 |
| **Blocks** | S1-D4, S1-D5, S2-C*, S2-D*, S3-B*, S4-C* |
| **Status** | pending |

---

## Context

### What This Builds

The Tool Wrapper provides a unified interface for all tool invocations within episodes. It wraps raw tool calls with:

- Budget enforcement (check before, record after)
- Policy evaluation (authorization)
- Audit logging (who called what, when, result)
- Error handling (retry, fallback)
- Observability (tracing, metrics)

### Why It Matters

Every autonomous action eventually calls a tool. The wrapper ensures:

- **Safety**: No tool executes without policy check
- **Accountability**: Complete audit trail
- **Cost Control**: Budget tracked per invocation
- **Reliability**: Consistent error handling
- **Observability**: Every call traced and measured

### Tool Categories

```
┌─────────────────────────────────────────────────────────────┐
│                      Tool Categories                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  READ TOOLS (Low Risk)                                       │
│  ├─ memory:read       - Read from external memory           │
│  ├─ memory:search     - Search summaries/references         │
│  ├─ api:fetch         - Read external data                  │
│  └─ file:read         - Read local files                    │
│                                                              │
│  WRITE TOOLS (Medium Risk)                                   │
│  ├─ memory:write      - Write to external memory            │
│  ├─ file:write        - Create/modify files                 │
│  ├─ cache:set         - Set cache values                    │
│  └─ queue:enqueue     - Add to work queues                  │
│                                                              │
│  PUBLISH TOOLS (High Risk)                                   │
│  ├─ platform:post     - Publish to social platform          │
│  ├─ platform:engage   - Comment/like/share                  │
│  ├─ email:send        - Send emails                         │
│  └─ notification:push - Send push notifications             │
│                                                              │
│  SIDE EFFECT TOOLS (Critical Risk)                          │
│  ├─ platform:delete   - Delete published content            │
│  ├─ account:modify    - Modify account settings             │
│  └─ payment:process   - Financial transactions              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Reference Specs

| Document | Section | Relevance |
|----------|---------|-----------|
| `/docs/03-agents-tools/tool-registry.md` | Tool Definitions | Tool catalog |
| `/docs/03-agents-tools/agent-recursion-contracts.md` | Tool Permissions | Per-agent access |
| `/docs/05-policy-safety/policy-engine.md` | Tool Authorization | Policy checks |
| `/docs/01-architecture/system-architecture-v3.md` | Tool Architecture | Integration |

---

## Prerequisites

### Completed Tasks

- [x] **S1-D1**: Episode lifecycle (episode context)
- [x] **S1-D2**: Budget enforcement (budget guard)
- [x] **S1-C5**: Policy evaluation engine (authorization)

### Required Packages

```json
{
  "dependencies": {
    "zod": "^3.22.0",
    "@opentelemetry/api": "^1.7.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0"
  }
}
```

---

## Instructions

### Phase 1: Test First (TDD)

Create comprehensive tests BEFORE implementation.

#### 1.1 Create Tool Types Tests

**File:** `packages/runner/src/tools/__tests__/types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  ToolDefinitionSchema,
  ToolInvocationSchema,
  ToolResultSchema,
  ToolRiskLevelSchema,
} from '../types';

describe('Tool Types', () => {
  describe('ToolDefinitionSchema', () => {
    it('should validate full tool definition', () => {
      const definition = {
        id: 'platform:post',
        name: 'Post to Platform',
        description: 'Publish content to social media platform',
        category: 'publish',
        riskLevel: 'high',
        inputSchema: {
          type: 'object',
          properties: {
            platform: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['platform', 'content'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            postId: { type: 'string' },
            url: { type: 'string' },
          },
        },
        permissions: ['publish:*'],
        budgetCost: {
          defaultTokens: 500,
          defaultTimeMs: 5000,
        },
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 1000,
          backoffMultiplier: 2,
        },
      };

      const result = ToolDefinitionSchema.safeParse(definition);
      expect(result.success).toBe(true);
    });

    it('should require id and name', () => {
      const definition = {
        description: 'Missing id and name',
      };

      const result = ToolDefinitionSchema.safeParse(definition);
      expect(result.success).toBe(false);
    });
  });

  describe('ToolInvocationSchema', () => {
    it('should validate invocation with context', () => {
      const invocation = {
        toolId: 'platform:post',
        input: {
          platform: 'meta',
          content: 'Hello world!',
        },
        context: {
          episodeId: 'ep_123',
          clientId: 'client_abc',
          agentId: 'agent_copy',
        },
      };

      const result = ToolInvocationSchema.safeParse(invocation);
      expect(result.success).toBe(true);
    });
  });

  describe('ToolRiskLevelSchema', () => {
    it('should accept valid risk levels', () => {
      const levels = ['read', 'write', 'publish', 'critical'];
      for (const level of levels) {
        const result = ToolRiskLevelSchema.safeParse(level);
        expect(result.success).toBe(true);
      }
    });
  });
});
```

#### 1.2 Create Tool Registry Tests

**File:** `packages/runner/src/tools/__tests__/tool-registry.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createToolRegistry, ToolRegistry } from '../tool-registry';
import { ToolDefinition } from '../types';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  const sampleTool: ToolDefinition = {
    id: 'test:tool',
    name: 'Test Tool',
    description: 'A test tool',
    category: 'read',
    riskLevel: 'read',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    permissions: ['test:read'],
  };

  beforeEach(() => {
    registry = createToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      registry.register(sampleTool);

      const retrieved = registry.get('test:tool');
      expect(retrieved).toEqual(sampleTool);
    });

    it('should throw on duplicate registration', () => {
      registry.register(sampleTool);

      expect(() => registry.register(sampleTool))
        .toThrow('Tool already registered: test:tool');
    });
  });

  describe('get', () => {
    it('should return undefined for unknown tool', () => {
      const result = registry.get('unknown:tool');
      expect(result).toBeUndefined();
    });
  });

  describe('getByCategory', () => {
    it('should return tools by category', () => {
      registry.register({ ...sampleTool, id: 'read:one', category: 'read' });
      registry.register({ ...sampleTool, id: 'read:two', category: 'read' });
      registry.register({ ...sampleTool, id: 'write:one', category: 'write' });

      const readTools = registry.getByCategory('read');
      expect(readTools).toHaveLength(2);
    });
  });

  describe('getByRiskLevel', () => {
    it('should return tools by risk level', () => {
      registry.register({ ...sampleTool, id: 'low:one', riskLevel: 'read' });
      registry.register({ ...sampleTool, id: 'high:one', riskLevel: 'critical' });

      const criticalTools = registry.getByRiskLevel('critical');
      expect(criticalTools).toHaveLength(1);
    });
  });

  describe('list', () => {
    it('should list all registered tools', () => {
      registry.register({ ...sampleTool, id: 'tool:1' });
      registry.register({ ...sampleTool, id: 'tool:2' });

      const all = registry.list();
      expect(all).toHaveLength(2);
    });
  });

  describe('hasPermission', () => {
    it('should check if tool has permission', () => {
      registry.register({
        ...sampleTool,
        permissions: ['read:memory', 'read:cache'],
      });

      expect(registry.hasPermission('test:tool', 'read:memory')).toBe(true);
      expect(registry.hasPermission('test:tool', 'write:memory')).toBe(false);
    });
  });
});
```

#### 1.3 Create Tool Wrapper Tests

**File:** `packages/runner/src/tools/__tests__/tool-wrapper.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createToolWrapper, ToolWrapper } from '../tool-wrapper';
import {
  createMockBudgetGuard,
  createMockPolicyEngine,
  createMockAudit,
  createMockToolRegistry,
} from '@rtv/testing';
import { ToolDefinition, ToolInvocation } from '../types';

describe('ToolWrapper', () => {
  let wrapper: ToolWrapper;
  let mockBudgetGuard: ReturnType<typeof createMockBudgetGuard>;
  let mockPolicyEngine: ReturnType<typeof createMockPolicyEngine>;
  let mockAudit: ReturnType<typeof createMockAudit>;
  let mockRegistry: ReturnType<typeof createMockToolRegistry>;
  let mockToolHandler: ReturnType<typeof vi.fn>;

  const sampleTool: ToolDefinition = {
    id: 'memory:read',
    name: 'Read Memory',
    description: 'Read from external memory',
    category: 'read',
    riskLevel: 'read',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    permissions: ['memory:read'],
    budgetCost: {
      defaultTokens: 100,
    },
  };

  const sampleInvocation: ToolInvocation = {
    toolId: 'memory:read',
    input: { key: 'test-key' },
    context: {
      episodeId: 'ep_123',
      clientId: 'client_abc',
      agentId: 'agent_copy',
    },
  };

  beforeEach(() => {
    mockBudgetGuard = createMockBudgetGuard();
    mockPolicyEngine = createMockPolicyEngine();
    mockAudit = createMockAudit();
    mockRegistry = createMockToolRegistry();
    mockToolHandler = vi.fn().mockResolvedValue({ data: 'result' });

    // Default: all checks pass
    mockPolicyEngine.evaluate.mockResolvedValue({
      decision: { effect: 'allow', reason: 'OK', checkedAt: Date.now(), evaluationMs: 1 },
      checks: { killSwitch: 'passed', rateLimit: 'passed', rules: 'passed', approval: 'not_required' },
    });
    mockBudgetGuard.getRemainingBudget.mockReturnValue({
      tokens: 10000,
      timeMs: 60000,
      toolCalls: 10,
      subcalls: 5,
    });
    mockRegistry.get.mockReturnValue(sampleTool);

    wrapper = createToolWrapper({
      budgetGuard: mockBudgetGuard,
      policyEngine: mockPolicyEngine,
      audit: mockAudit,
      registry: mockRegistry,
    });

    wrapper.registerHandler('memory:read', mockToolHandler);
  });

  describe('invoke', () => {
    it('should execute tool when authorized', async () => {
      const result = await wrapper.invoke(sampleInvocation);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ data: 'result' });
      expect(mockToolHandler).toHaveBeenCalledWith(
        sampleInvocation.input,
        expect.any(Object)
      );
    });

    it('should check policy before execution', async () => {
      await wrapper.invoke(sampleInvocation);

      expect(mockPolicyEngine.evaluate).toHaveBeenCalledWith({
        action: 'tool:invoke',
        resource: 'memory:read',
        clientId: 'client_abc',
        actorType: 'agent',
        actorId: 'agent_copy',
        attributes: {
          toolCategory: 'read',
          toolRiskLevel: 'read',
          input: sampleInvocation.input,
        },
      });
    });

    it('should deny when policy denies', async () => {
      mockPolicyEngine.evaluate.mockResolvedValue({
        decision: { effect: 'deny', reason: 'Not authorized', deniedBy: 'policy_rule', checkedAt: Date.now(), evaluationMs: 1 },
        checks: { killSwitch: 'passed', rateLimit: 'passed', rules: 'denied', approval: 'skipped' },
      });

      const result = await wrapper.invoke(sampleInvocation);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('POLICY_DENIED');
      expect(mockToolHandler).not.toHaveBeenCalled();
    });

    it('should check budget before execution', async () => {
      await wrapper.invoke(sampleInvocation);

      expect(mockBudgetGuard.guardToolCall).toHaveBeenCalled();
    });

    it('should emit audit event for successful invocation', async () => {
      await wrapper.invoke(sampleInvocation);

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'TOOL_INVOKED',
        actor: 'agent_copy',
        target: 'memory:read',
        metadata: expect.objectContaining({
          episodeId: 'ep_123',
          clientId: 'client_abc',
          success: true,
        }),
      });
    });

    it('should emit audit event for failed invocation', async () => {
      mockToolHandler.mockRejectedValue(new Error('Tool failed'));

      await wrapper.invoke(sampleInvocation);

      expect(mockAudit.emit).toHaveBeenCalledWith({
        type: 'TOOL_INVOKED',
        actor: 'agent_copy',
        target: 'memory:read',
        metadata: expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Tool failed',
          }),
        }),
      });
    });

    it('should throw for unknown tool', async () => {
      mockRegistry.get.mockReturnValue(undefined);

      await expect(wrapper.invoke({
        ...sampleInvocation,
        toolId: 'unknown:tool',
      })).rejects.toThrow('Unknown tool: unknown:tool');
    });

    it('should validate input against schema', async () => {
      mockRegistry.get.mockReturnValue({
        ...sampleTool,
        inputSchema: {
          type: 'object',
          properties: { requiredField: { type: 'string' } },
          required: ['requiredField'],
        },
      });

      const result = await wrapper.invoke({
        ...sampleInvocation,
        input: { wrongField: 'value' },
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });
  });

  describe('retry behavior', () => {
    it('should retry on retryable error', async () => {
      mockToolHandler
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ data: 'success' });

      mockRegistry.get.mockReturnValue({
        ...sampleTool,
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 10,
          retryableErrors: ['TEMPORARY'],
        },
      });

      const result = await wrapper.invoke(sampleInvocation);

      expect(result.success).toBe(true);
      expect(mockToolHandler).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable error', async () => {
      mockToolHandler.mockRejectedValue(new Error('Permanent failure'));

      mockRegistry.get.mockReturnValue({
        ...sampleTool,
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 10,
          retryableErrors: ['TEMPORARY'],
        },
      });

      const result = await wrapper.invoke(sampleInvocation);

      expect(result.success).toBe(false);
      expect(mockToolHandler).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries', async () => {
      const retryableError = new Error('Temporary');
      (retryableError as any).code = 'TEMPORARY';
      mockToolHandler.mockRejectedValue(retryableError);

      mockRegistry.get.mockReturnValue({
        ...sampleTool,
        retryPolicy: {
          maxRetries: 2,
          backoffMs: 1,
          retryableErrors: ['TEMPORARY'],
        },
      });

      const result = await wrapper.invoke(sampleInvocation);

      expect(result.success).toBe(false);
      expect(mockToolHandler).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe('timeout', () => {
    it('should timeout long-running tool', async () => {
      mockToolHandler.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      mockRegistry.get.mockReturnValue({
        ...sampleTool,
        budgetCost: {
          defaultTimeMs: 100,
        },
      });

      const result = await wrapper.invoke(sampleInvocation);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    }, 5000);
  });

  describe('registerHandler', () => {
    it('should register custom handler', async () => {
      const customHandler = vi.fn().mockResolvedValue({ custom: 'result' });
      wrapper.registerHandler('custom:tool', customHandler);

      mockRegistry.get.mockReturnValue({
        ...sampleTool,
        id: 'custom:tool',
      });

      const result = await wrapper.invoke({
        ...sampleInvocation,
        toolId: 'custom:tool',
      });

      expect(customHandler).toHaveBeenCalled();
      expect(result.output).toEqual({ custom: 'result' });
    });
  });
});
```

#### 1.4 Run Tests (Expect Failures)

```bash
cd packages/runner
pnpm test:watch src/tools/
```

---

### Phase 2: Implementation

#### 2.1 Create Tool Types

**File:** `packages/runner/src/tools/types.ts`

```typescript
import { z } from 'zod';

/**
 * Tool Risk Levels
 */
export const ToolRiskLevelSchema = z.enum(['read', 'write', 'publish', 'critical']);
export type ToolRiskLevel = z.infer<typeof ToolRiskLevelSchema>;

/**
 * Tool Category
 */
export const ToolCategorySchema = z.enum(['read', 'write', 'publish', 'sideEffect']);
export type ToolCategory = z.infer<typeof ToolCategorySchema>;

/**
 * Retry Policy
 */
export const RetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).default(0),
  backoffMs: z.number().int().min(0).default(1000),
  backoffMultiplier: z.number().min(1).default(2),
  maxBackoffMs: z.number().int().min(0).default(30000),
  retryableErrors: z.array(z.string()).optional(),
});
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

/**
 * Budget Cost
 */
export const BudgetCostSchema = z.object({
  defaultTokens: z.number().int().min(0).optional(),
  defaultTimeMs: z.number().int().min(0).optional(),
});
export type BudgetCost = z.infer<typeof BudgetCostSchema>;

/**
 * Tool Definition
 */
export const ToolDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: ToolCategorySchema,
  riskLevel: ToolRiskLevelSchema,
  inputSchema: z.record(z.unknown()), // JSON Schema
  outputSchema: z.record(z.unknown()).optional(), // JSON Schema
  permissions: z.array(z.string()),
  budgetCost: BudgetCostSchema.optional(),
  retryPolicy: RetryPolicySchema.optional(),
  timeout: z.number().int().positive().optional(), // Override default timeout
  deprecated: z.boolean().optional(),
  deprecatedMessage: z.string().optional(),
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

/**
 * Tool Invocation Context
 */
export const ToolInvocationContextSchema = z.object({
  episodeId: z.string(),
  clientId: z.string(),
  agentId: z.string(),
  requestId: z.string().optional(),
  parentToolCallId: z.string().optional(),
});
export type ToolInvocationContext = z.infer<typeof ToolInvocationContextSchema>;

/**
 * Tool Invocation
 */
export const ToolInvocationSchema = z.object({
  toolId: z.string(),
  input: z.record(z.unknown()),
  context: ToolInvocationContextSchema,
  options: z.object({
    timeout: z.number().int().positive().optional(),
    skipPolicyCheck: z.boolean().optional(), // For system-level calls
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
});
export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;

/**
 * Tool Error
 */
export const ToolErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean().default(false),
  details: z.record(z.unknown()).optional(),
});
export type ToolError = z.infer<typeof ToolErrorSchema>;

/**
 * Tool Result
 */
export const ToolResultSchema = z.object({
  success: z.boolean(),
  output: z.record(z.unknown()).nullable(),
  error: ToolErrorSchema.nullable(),
  metadata: z.object({
    toolId: z.string(),
    invocationId: z.string(),
    startedAt: z.number(),
    completedAt: z.number(),
    durationMs: z.number(),
    retryCount: z.number(),
    tokensUsed: z.number().optional(),
  }),
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

/**
 * Tool Handler function type
 */
export type ToolHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: ToolInvocationContext & {
    toolDefinition: ToolDefinition;
    invocationId: string;
  }
) => Promise<TOutput>;
```

#### 2.2 Create Tool Registry

**File:** `packages/runner/src/tools/tool-registry.ts`

```typescript
import { ToolDefinition, ToolRiskLevel, ToolCategory } from './types';

export interface ToolRegistry {
  register(definition: ToolDefinition): void;
  unregister(toolId: string): void;
  get(toolId: string): ToolDefinition | undefined;
  getByCategory(category: ToolCategory): ToolDefinition[];
  getByRiskLevel(riskLevel: ToolRiskLevel): ToolDefinition[];
  list(): ToolDefinition[];
  hasPermission(toolId: string, permission: string): boolean;
  isDeprecated(toolId: string): boolean;
}

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, ToolDefinition>();

  return {
    register(definition: ToolDefinition): void {
      if (tools.has(definition.id)) {
        throw new Error(`Tool already registered: ${definition.id}`);
      }
      tools.set(definition.id, definition);
    },

    unregister(toolId: string): void {
      tools.delete(toolId);
    },

    get(toolId: string): ToolDefinition | undefined {
      return tools.get(toolId);
    },

    getByCategory(category: ToolCategory): ToolDefinition[] {
      return Array.from(tools.values()).filter(t => t.category === category);
    },

    getByRiskLevel(riskLevel: ToolRiskLevel): ToolDefinition[] {
      return Array.from(tools.values()).filter(t => t.riskLevel === riskLevel);
    },

    list(): ToolDefinition[] {
      return Array.from(tools.values());
    },

    hasPermission(toolId: string, permission: string): boolean {
      const tool = tools.get(toolId);
      if (!tool) return false;

      return tool.permissions.some(p => {
        // Support wildcards
        if (p === '*' || p === permission) return true;
        if (p.endsWith(':*')) {
          const prefix = p.slice(0, -1);
          return permission.startsWith(prefix);
        }
        return false;
      });
    },

    isDeprecated(toolId: string): boolean {
      const tool = tools.get(toolId);
      return tool?.deprecated ?? false;
    },
  };
}
```

#### 2.3 Create Tool Wrapper

**File:** `packages/runner/src/tools/tool-wrapper.ts`

```typescript
import { nanoid } from 'nanoid';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  ToolDefinition,
  ToolInvocation,
  ToolResult,
  ToolError,
  ToolHandler,
  ToolInvocationContext,
} from './types';
import type { ToolRegistry } from './tool-registry';
import type { BudgetGuard } from '../budget';
import type { PolicyEngine } from '@rtv/policy';
import type { AuditEmitter } from '@rtv/audit';

const tracer = trace.getTracer('tool-wrapper');

const DEFAULT_TIMEOUT_MS = 30000;

interface ToolWrapperDeps {
  budgetGuard: BudgetGuard;
  policyEngine: PolicyEngine;
  audit: AuditEmitter;
  registry: ToolRegistry;
}

export interface ToolWrapper {
  invoke(invocation: ToolInvocation): Promise<ToolResult>;
  registerHandler(toolId: string, handler: ToolHandler): void;
  unregisterHandler(toolId: string): void;
}

export function createToolWrapper(deps: ToolWrapperDeps): ToolWrapper {
  const { budgetGuard, policyEngine, audit, registry } = deps;
  const handlers = new Map<string, ToolHandler>();

  /**
   * Create a timeout promise
   */
  function createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    );
  }

  /**
   * Validate input against tool schema (basic validation)
   */
  function validateInput(definition: ToolDefinition, input: unknown): boolean {
    const schema = definition.inputSchema;
    if (!schema || typeof schema !== 'object') return true;

    // Basic required field check
    if (schema.required && Array.isArray(schema.required)) {
      const inputObj = input as Record<string, unknown>;
      for (const field of schema.required) {
        if (!(field in inputObj)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Calculate backoff delay
   */
  function calculateBackoff(attempt: number, policy: ToolDefinition['retryPolicy']): number {
    if (!policy) return 0;
    const delay = policy.backoffMs * Math.pow(policy.backoffMultiplier, attempt);
    return Math.min(delay, policy.maxBackoffMs || 30000);
  }

  /**
   * Check if error is retryable
   */
  function isRetryable(error: Error, policy: ToolDefinition['retryPolicy']): boolean {
    if (!policy?.retryableErrors) return false;
    const errorCode = (error as any).code || 'UNKNOWN';
    return policy.retryableErrors.includes(errorCode);
  }

  /**
   * Execute tool with retry logic
   */
  async function executeWithRetry(
    handler: ToolHandler,
    input: unknown,
    handlerContext: ToolInvocationContext & { toolDefinition: ToolDefinition; invocationId: string },
    retryPolicy: ToolDefinition['retryPolicy']
  ): Promise<{ output: unknown; retryCount: number }> {
    let lastError: Error | null = null;
    let retryCount = 0;
    const maxRetries = retryPolicy?.maxRetries ?? 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const output = await handler(input, handlerContext);
        return { output, retryCount };
      } catch (error) {
        lastError = error as Error;
        retryCount = attempt;

        if (attempt < maxRetries && isRetryable(lastError, retryPolicy)) {
          const backoff = calculateBackoff(attempt, retryPolicy);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }

        break;
      }
    }

    throw lastError;
  }

  return {
    async invoke(invocation: ToolInvocation): Promise<ToolResult> {
      const invocationId = `ti_${nanoid()}`;
      const startedAt = Date.now();

      return tracer.startActiveSpan(`tool.invoke.${invocation.toolId}`, async (span) => {
        span.setAttributes({
          'tool.id': invocation.toolId,
          'tool.invocation_id': invocationId,
          'tool.episode_id': invocation.context.episodeId,
          'tool.client_id': invocation.context.clientId,
        });

        try {
          // Get tool definition
          const definition = registry.get(invocation.toolId);
          if (!definition) {
            throw new Error(`Unknown tool: ${invocation.toolId}`);
          }

          // Warn if deprecated
          if (definition.deprecated) {
            console.warn(`Tool ${invocation.toolId} is deprecated: ${definition.deprecatedMessage}`);
          }

          // Validate input
          if (!validateInput(definition, invocation.input)) {
            const error: ToolError = {
              code: 'INVALID_INPUT',
              message: 'Input validation failed',
              retryable: false,
            };

            await audit.emit({
              type: 'TOOL_INVOKED',
              actor: invocation.context.agentId,
              target: invocation.toolId,
              metadata: {
                episodeId: invocation.context.episodeId,
                clientId: invocation.context.clientId,
                invocationId,
                success: false,
                error,
              },
            });

            return {
              success: false,
              output: null,
              error,
              metadata: {
                toolId: invocation.toolId,
                invocationId,
                startedAt,
                completedAt: Date.now(),
                durationMs: Date.now() - startedAt,
                retryCount: 0,
              },
            };
          }

          // Policy check (unless skipped for system calls)
          if (!invocation.options?.skipPolicyCheck) {
            const policyResult = await policyEngine.evaluate({
              action: 'tool:invoke',
              resource: invocation.toolId,
              clientId: invocation.context.clientId,
              actorType: 'agent',
              actorId: invocation.context.agentId,
              attributes: {
                toolCategory: definition.category,
                toolRiskLevel: definition.riskLevel,
                input: invocation.input,
              },
              requestId: invocation.context.requestId,
              episodeId: invocation.context.episodeId,
            });

            if (policyResult.decision.effect !== 'allow') {
              const error: ToolError = {
                code: 'POLICY_DENIED',
                message: policyResult.decision.reason,
                retryable: false,
                details: {
                  deniedBy: policyResult.decision.deniedBy,
                },
              };

              await audit.emit({
                type: 'TOOL_INVOKED',
                actor: invocation.context.agentId,
                target: invocation.toolId,
                metadata: {
                  episodeId: invocation.context.episodeId,
                  clientId: invocation.context.clientId,
                  invocationId,
                  success: false,
                  error,
                  policyDecision: policyResult.decision.effect,
                },
              });

              return {
                success: false,
                output: null,
                error,
                metadata: {
                  toolId: invocation.toolId,
                  invocationId,
                  startedAt,
                  completedAt: Date.now(),
                  durationMs: Date.now() - startedAt,
                  retryCount: 0,
                },
              };
            }
          }

          // Get handler
          const handler = handlers.get(invocation.toolId);
          if (!handler) {
            throw new Error(`No handler registered for tool: ${invocation.toolId}`);
          }

          // Prepare handler context
          const handlerContext = {
            ...invocation.context,
            toolDefinition: definition,
            invocationId,
          };

          // Execute with budget guard and timeout
          const timeoutMs = invocation.options?.timeout
            ?? definition.budgetCost?.defaultTimeMs
            ?? DEFAULT_TIMEOUT_MS;

          let output: unknown;
          let retryCount = 0;

          try {
            const result = await budgetGuard.guardToolCall(
              invocation.toolId,
              async () => {
                const executePromise = executeWithRetry(
                  handler,
                  invocation.input,
                  handlerContext,
                  definition.retryPolicy
                );

                const result = await Promise.race([
                  executePromise,
                  createTimeout(timeoutMs),
                ]);

                return result;
              }
            );

            output = result.output;
            retryCount = result.retryCount;
          } catch (error) {
            const err = error as Error;
            const toolError: ToolError = {
              code: err.message === 'TIMEOUT' ? 'TIMEOUT' : 'EXECUTION_ERROR',
              message: err.message,
              retryable: false,
            };

            await audit.emit({
              type: 'TOOL_INVOKED',
              actor: invocation.context.agentId,
              target: invocation.toolId,
              metadata: {
                episodeId: invocation.context.episodeId,
                clientId: invocation.context.clientId,
                invocationId,
                success: false,
                error: toolError,
                durationMs: Date.now() - startedAt,
              },
            });

            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });

            return {
              success: false,
              output: null,
              error: toolError,
              metadata: {
                toolId: invocation.toolId,
                invocationId,
                startedAt,
                completedAt: Date.now(),
                durationMs: Date.now() - startedAt,
                retryCount,
              },
            };
          }

          // Success
          const completedAt = Date.now();

          await audit.emit({
            type: 'TOOL_INVOKED',
            actor: invocation.context.agentId,
            target: invocation.toolId,
            metadata: {
              episodeId: invocation.context.episodeId,
              clientId: invocation.context.clientId,
              invocationId,
              success: true,
              durationMs: completedAt - startedAt,
              retryCount,
            },
          });

          span.setStatus({ code: SpanStatusCode.OK });

          return {
            success: true,
            output: output as Record<string, unknown>,
            error: null,
            metadata: {
              toolId: invocation.toolId,
              invocationId,
              startedAt,
              completedAt,
              durationMs: completedAt - startedAt,
              retryCount,
            },
          };

        } catch (error) {
          const err = error as Error;
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          span.recordException(err);

          return {
            success: false,
            output: null,
            error: {
              code: 'INTERNAL_ERROR',
              message: err.message,
              retryable: false,
            },
            metadata: {
              toolId: invocation.toolId,
              invocationId,
              startedAt,
              completedAt: Date.now(),
              durationMs: Date.now() - startedAt,
              retryCount: 0,
            },
          };
        } finally {
          span.end();
        }
      });
    },

    registerHandler(toolId: string, handler: ToolHandler): void {
      handlers.set(toolId, handler);
    },

    unregisterHandler(toolId: string): void {
      handlers.delete(toolId);
    },
  };
}
```

#### 2.4 Create Module Index

**File:** `packages/runner/src/tools/index.ts`

```typescript
export * from './types';
export * from './tool-registry';
export * from './tool-wrapper';
```

---

### Phase 3: Verification

#### 3.1 Run Tests

```bash
# Run all tool tests
cd packages/runner
pnpm test src/tools/

# Run with coverage
pnpm test:coverage src/tools/
```

#### 3.2 Type Check

```bash
pnpm typecheck
```

#### 3.3 Lint

```bash
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/runner/src/tools/types.ts` | Type definitions |
| Create | `packages/runner/src/tools/tool-registry.ts` | Registry |
| Create | `packages/runner/src/tools/tool-wrapper.ts` | Wrapper |
| Create | `packages/runner/src/tools/index.ts` | Module exports |
| Create | `packages/runner/src/tools/__tests__/types.test.ts` | Type tests |
| Create | `packages/runner/src/tools/__tests__/tool-registry.test.ts` | Registry tests |
| Create | `packages/runner/src/tools/__tests__/tool-wrapper.test.ts` | Wrapper tests |

---

## Acceptance Criteria

- [ ] Tool definition with risk levels and permissions
- [ ] Tool registry with category and risk queries
- [ ] Policy check before tool execution
- [ ] Budget guard integration
- [ ] Input validation against schema
- [ ] Retry logic with exponential backoff
- [ ] Timeout handling
- [ ] Audit events for all invocations
- [ ] OpenTelemetry tracing
- [ ] Handler registration/unregistration
- [ ] All tests pass with >80% coverage
- [ ] TypeScript compiles with no errors

---

## Test Requirements

### Unit Tests

- Tool definition validation
- Registry CRUD operations
- Input validation
- Retry logic
- Timeout behavior

### Integration Tests

- Full invocation flow
- Policy integration
- Budget integration

### Performance Tests

- Wrapper overhead <5ms
- Registry lookup <1ms

---

## Security & Safety Checklist

- [ ] Policy check cannot be bypassed by agents
- [ ] Input validated before execution
- [ ] Secrets not logged in audit events
- [ ] Risk levels enforced

---

## JSON Task Block

```json
{
  "task_id": "S1-D3",
  "name": "Tool Wrapper Abstraction",
  "status": "pending",
  "complexity": "medium",
  "sprint": 1,
  "agent": "D",
  "dependencies": ["S1-D1", "S1-D2", "S1-C5"],
  "blocks": ["S1-D4", "S1-D5", "S2-C1", "S3-B1"],
  "estimated_hours": 5,
  "actual_hours": null,
  "files": [
    "packages/runner/src/tools/types.ts",
    "packages/runner/src/tools/tool-registry.ts",
    "packages/runner/src/tools/tool-wrapper.ts",
    "packages/runner/src/tools/index.ts"
  ],
  "test_files": [
    "packages/runner/src/tools/__tests__/types.test.ts",
    "packages/runner/src/tools/__tests__/tool-registry.test.ts",
    "packages/runner/src/tools/__tests__/tool-wrapper.test.ts"
  ],
  "acceptance_criteria": [
    "Tool registry with definitions",
    "Policy check before execution",
    "Budget enforcement",
    "Retry and timeout",
    "Full audit trail"
  ]
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "artifacts": {
    "files_created": [],
    "tests_passed": null,
    "coverage_percent": null
  },
  "learnings": [],
  "blockers_encountered": []
}
```
