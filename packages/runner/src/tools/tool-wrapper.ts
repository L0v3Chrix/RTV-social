/**
 * S1-D3: Tool Wrapper
 *
 * Wraps tool invocations with:
 * - Policy evaluation (authorization)
 * - Budget enforcement
 * - Audit logging
 * - Retry logic
 * - Timeout handling
 * - OpenTelemetry tracing
 */

import { nanoid } from 'nanoid';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import type {
  ToolDefinition,
  ToolInvocation,
  ToolResult,
  ToolError,
  ToolHandler,
  ToolInvocationContext,
  RetryPolicy,
} from './types.js';
import type { ToolRegistry } from './tool-registry.js';
import type { BudgetGuard } from '../budget/index.js';
import type { AuditEmitter } from '../episode/types.js';

const tracer = trace.getTracer('@rtv/runner/tool-wrapper');

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Policy evaluation request.
 */
interface PolicyRequest {
  action: string;
  resource: string;
  clientId: string;
  actorType: string;
  actorId: string;
  attributes: Record<string, unknown>;
  requestId?: string;
  episodeId?: string;
}

/**
 * Policy evaluation result.
 */
interface PolicyResult {
  decision: {
    effect: 'allow' | 'deny';
    reason: string;
    deniedBy?: string;
    checkedAt: number;
    evaluationMs: number;
  };
  checks: {
    killSwitch: 'passed' | 'skipped' | 'denied';
    rateLimit: 'passed' | 'skipped' | 'denied';
    rules: 'passed' | 'skipped' | 'denied';
    approval: 'passed' | 'skipped' | 'denied' | 'not_required';
  };
}

/**
 * Policy engine interface.
 */
export interface PolicyEngine {
  evaluate(request: PolicyRequest): Promise<PolicyResult>;
}

/**
 * Dependencies for tool wrapper.
 */
export interface ToolWrapperDeps {
  budgetGuard: BudgetGuard;
  policyEngine: PolicyEngine;
  audit: AuditEmitter;
  registry: ToolRegistry;
}

/**
 * Tool wrapper interface.
 */
export interface ToolWrapper {
  /** Invoke a tool with all guards */
  invoke(invocation: ToolInvocation): Promise<ToolResult>;
  /** Register a handler for a tool */
  registerHandler(toolId: string, handler: ToolHandler): void;
  /** Unregister a handler for a tool */
  unregisterHandler(toolId: string): void;
}

/**
 * Create a timeout promise.
 */
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms));
}

/**
 * Validate input against JSON Schema (basic validation).
 * Only checks required fields for now.
 */
function validateInput(definition: ToolDefinition, input: unknown): boolean {
  const schema = definition.inputSchema;

  // Basic required field check
  const schemaObj = schema as { required?: string[] };
  if (schemaObj.required && Array.isArray(schemaObj.required)) {
    const inputObj = input as Record<string, unknown>;
    for (const field of schemaObj.required) {
      if (!(field in inputObj)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Calculate backoff delay for retry.
 */
function calculateBackoff(attempt: number, policy: RetryPolicy | undefined): number {
  if (!policy) return 0;
  const delay = policy.backoffMs * Math.pow(policy.backoffMultiplier, attempt);
  return Math.min(delay, policy.maxBackoffMs);
}

/**
 * Check if error is retryable based on policy.
 */
function isRetryable(error: Error, policy: RetryPolicy | undefined): boolean {
  if (!policy?.retryableErrors) return false;
  const errorCode = (error as Error & { code?: string }).code ?? 'UNKNOWN';
  return policy.retryableErrors.includes(errorCode);
}

/**
 * Execute tool with retry logic.
 */
async function executeWithRetry(
  handler: ToolHandler,
  input: unknown,
  handlerContext: ToolInvocationContext & { toolDefinition: ToolDefinition; invocationId: string },
  retryPolicy: RetryPolicy | undefined
): Promise<{ output: unknown; retryCount: number }> {
  let lastError: Error | null = null;
  let lastAttempt = 0;
  const maxRetries = retryPolicy?.maxRetries ?? 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastAttempt = attempt;
    try {
      const output = await handler(input, handlerContext);
      // Return attempt as retryCount (attempt 0 = 0 retries, attempt 2 = 2 retries)
      return { output, retryCount: attempt };
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries && isRetryable(lastError, retryPolicy)) {
        const backoff = calculateBackoff(attempt, retryPolicy);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      break;
    }
  }

  // On complete failure, throw the last error (caller will track lastAttempt as retryCount)
  const errorWithAttempt = lastError as Error & { retryCount?: number };
  errorWithAttempt.retryCount = lastAttempt;
  throw errorWithAttempt;
}

/**
 * Create a tool wrapper instance.
 */
export function createToolWrapper(deps: ToolWrapperDeps): ToolWrapper {
  const { budgetGuard, policyEngine, audit, registry } = deps;
  const handlers = new Map<string, ToolHandler>();

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
            console.warn(
              `Tool ${invocation.toolId} is deprecated: ${definition.deprecatedMessage ?? 'No message provided'}`
            );
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
            // Build policy request conditionally for exactOptionalPropertyTypes
            const policyRequest: PolicyRequest = {
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
              episodeId: invocation.context.episodeId,
            };
            if (invocation.context.requestId !== undefined) {
              policyRequest.requestId = invocation.context.requestId;
            }
            const policyResult = await policyEngine.evaluate(policyRequest);

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
          const timeoutMs =
            invocation.options?.timeout ?? definition.budgetCost?.defaultTimeMs ?? DEFAULT_TIMEOUT_MS;

          let output: unknown;
          let retryCount = 0;

          try {
            const result = await budgetGuard.guardToolCall(invocation.toolId, async () => {
              const executePromise = executeWithRetry(
                handler,
                invocation.input,
                handlerContext,
                definition.retryPolicy
              );

              const raceResult = await Promise.race([executePromise, createTimeout(timeoutMs)]);

              return raceResult;
            });

            output = result.output;
            retryCount = result.retryCount;
          } catch (error) {
            const err = error as Error & { retryCount?: number };
            // Extract retryCount from error if available (set by executeWithRetry)
            const errorRetryCount = err.retryCount ?? 0;
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
                retryCount: errorRetryCount,
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

          // Re-throw for unknown tool and no handler errors
          if (err.message.startsWith('Unknown tool:') || err.message.startsWith('No handler')) {
            throw err;
          }

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
