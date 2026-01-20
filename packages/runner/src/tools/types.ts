/**
 * S1-D3: Tool Types
 *
 * Type definitions for tool abstraction layer.
 * Defines tool definitions, invocations, results, and related schemas.
 */

import { z } from 'zod';

// =====================
// Tool Risk Levels
// =====================

/**
 * Risk levels for tools, determining authorization requirements.
 * - read: Low risk, read-only operations
 * - write: Medium risk, can modify data
 * - publish: High risk, external side effects
 * - critical: Critical risk, requires explicit approval
 */
export const ToolRiskLevelSchema = z.enum(['read', 'write', 'publish', 'critical']);
export type ToolRiskLevel = z.infer<typeof ToolRiskLevelSchema>;

// =====================
// Tool Category
// =====================

/**
 * Categories for tools based on operation type.
 */
export const ToolCategorySchema = z.enum(['read', 'write', 'publish', 'sideEffect']);
export type ToolCategory = z.infer<typeof ToolCategorySchema>;

// =====================
// Retry Policy
// =====================

/**
 * Retry policy for tool execution failures.
 */
export const RetryPolicySchema = z.object({
  /** Maximum number of retry attempts */
  maxRetries: z.number().int().min(0).default(0),
  /** Initial backoff delay in milliseconds */
  backoffMs: z.number().int().min(0).default(1000),
  /** Multiplier for exponential backoff */
  backoffMultiplier: z.number().min(1).default(2),
  /** Maximum backoff delay in milliseconds */
  maxBackoffMs: z.number().int().min(0).default(30000),
  /** Error codes that should trigger retry */
  retryableErrors: z.array(z.string()).optional(),
});
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

// =====================
// Budget Cost
// =====================

/**
 * Budget cost estimates for tool execution.
 */
export const BudgetCostSchema = z.object({
  /** Estimated token consumption */
  defaultTokens: z.number().int().min(0).optional(),
  /** Estimated execution time in milliseconds (also used as timeout) */
  defaultTimeMs: z.number().int().min(0).optional(),
});
export type BudgetCost = z.infer<typeof BudgetCostSchema>;

// =====================
// Tool Definition
// =====================

/**
 * Complete definition of a tool in the registry.
 */
export const ToolDefinitionSchema = z.object({
  /** Unique tool identifier (e.g., 'platform:post') */
  id: z.string(),
  /** Human-readable name */
  name: z.string(),
  /** Description of what the tool does */
  description: z.string().optional(),
  /** Tool category */
  category: ToolCategorySchema,
  /** Risk level determining authorization requirements */
  riskLevel: ToolRiskLevelSchema,
  /** JSON Schema for input validation */
  inputSchema: z.record(z.unknown()),
  /** JSON Schema for output validation */
  outputSchema: z.record(z.unknown()).optional(),
  /** Required permissions to invoke this tool */
  permissions: z.array(z.string()),
  /** Budget cost estimates */
  budgetCost: BudgetCostSchema.optional(),
  /** Retry policy for failures */
  retryPolicy: RetryPolicySchema.optional(),
  /** Override default timeout (milliseconds) */
  timeout: z.number().int().positive().optional(),
  /** Whether tool is deprecated */
  deprecated: z.boolean().optional(),
  /** Message for deprecated tools */
  deprecatedMessage: z.string().optional(),
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// =====================
// Tool Invocation Context
// =====================

/**
 * Context information for a tool invocation.
 */
export const ToolInvocationContextSchema = z.object({
  /** Episode ID executing this tool */
  episodeId: z.string(),
  /** Client ID for tenant isolation */
  clientId: z.string(),
  /** Agent ID making the call */
  agentId: z.string(),
  /** Request ID for tracing */
  requestId: z.string().optional(),
  /** Parent tool call ID for nested calls */
  parentToolCallId: z.string().optional(),
});
export type ToolInvocationContext = z.infer<typeof ToolInvocationContextSchema>;

// =====================
// Tool Invocation
// =====================

/**
 * Request to invoke a tool.
 */
export const ToolInvocationSchema = z.object({
  /** Tool ID to invoke */
  toolId: z.string(),
  /** Input parameters for the tool */
  input: z.record(z.unknown()),
  /** Invocation context */
  context: ToolInvocationContextSchema,
  /** Invocation options */
  options: z
    .object({
      /** Override default timeout */
      timeout: z.number().int().positive().optional(),
      /** Skip policy check (for system-level calls) */
      skipPolicyCheck: z.boolean().optional(),
      /** Additional metadata */
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
});
export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;

// =====================
// Tool Error
// =====================

/**
 * Error information from tool execution.
 */
export const ToolErrorSchema = z.object({
  /** Error code for programmatic handling */
  code: z.string(),
  /** Human-readable error message */
  message: z.string(),
  /** Whether the error can be retried */
  retryable: z.boolean().default(false),
  /** Additional error details */
  details: z.record(z.unknown()).optional(),
});
export type ToolError = z.infer<typeof ToolErrorSchema>;

// =====================
// Tool Result
// =====================

/**
 * Result of tool invocation.
 */
export const ToolResultSchema = z.object({
  /** Whether invocation succeeded */
  success: z.boolean(),
  /** Output data (null on failure) */
  output: z.record(z.unknown()).nullable(),
  /** Error information (null on success) */
  error: ToolErrorSchema.nullable(),
  /** Invocation metadata */
  metadata: z.object({
    /** Tool that was invoked */
    toolId: z.string(),
    /** Unique invocation identifier */
    invocationId: z.string(),
    /** Start timestamp */
    startedAt: z.number(),
    /** Completion timestamp */
    completedAt: z.number(),
    /** Execution duration in milliseconds */
    durationMs: z.number(),
    /** Number of retry attempts */
    retryCount: z.number(),
    /** Tokens consumed (if applicable) */
    tokensUsed: z.number().optional(),
  }),
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

// =====================
// Tool Handler
// =====================

/**
 * Handler function type for tool execution.
 */
export type ToolHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: ToolInvocationContext & {
    toolDefinition: ToolDefinition;
    invocationId: string;
  }
) => Promise<TOutput>;
