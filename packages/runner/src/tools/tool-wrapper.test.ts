/**
 * S1-D3: Tool Wrapper Tests
 *
 * Tests for tool invocation with policy, budget, and audit integration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createToolWrapper, type ToolWrapper } from './tool-wrapper.js';
import type { ToolDefinition, ToolInvocation } from './types.js';
import type { BudgetGuard, RemainingBudget } from '../budget/index.js';
import type { ToolRegistry } from './tool-registry.js';
import type { AuditEmitter } from '../episode/types.js';

// =====================
// Mock Factories
// =====================

interface MockPolicyResult {
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

interface MockPolicyEngine {
  evaluate: ReturnType<typeof vi.fn>;
}

function createMockPolicyEngine(): MockPolicyEngine {
  return {
    evaluate: vi.fn(),
  };
}

function createMockBudgetGuard(): {
  guardToolCall: ReturnType<typeof vi.fn>;
  getRemainingBudget: ReturnType<typeof vi.fn>;
} & BudgetGuard {
  return {
    guardToolCall: vi.fn().mockImplementation((_name, fn) => fn()),
    getRemainingBudget: vi.fn().mockReturnValue({
      tokens: 10000,
      timeMs: 60000,
      toolCalls: 10,
      subcalls: 5,
    } as RemainingBudget),
    withBudgetCheck: vi.fn(),
    guardLLMCall: vi.fn(),
    allocateSubcallBudget: vi.fn(),
  } as unknown as {
    guardToolCall: ReturnType<typeof vi.fn>;
    getRemainingBudget: ReturnType<typeof vi.fn>;
  } & BudgetGuard;
}

function createMockAudit(): { emit: ReturnType<typeof vi.fn> } & AuditEmitter {
  return {
    emit: vi.fn().mockResolvedValue(undefined),
  } as { emit: ReturnType<typeof vi.fn> } & AuditEmitter;
}

function createMockToolRegistry(): {
  get: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
  unregister: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  getByCategory: ReturnType<typeof vi.fn>;
  getByRiskLevel: ReturnType<typeof vi.fn>;
  hasPermission: ReturnType<typeof vi.fn>;
  isDeprecated: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    getByCategory: vi.fn().mockReturnValue([]),
    getByRiskLevel: vi.fn().mockReturnValue([]),
    hasPermission: vi.fn().mockReturnValue(false),
    isDeprecated: vi.fn().mockReturnValue(false),
  };
}

// =====================
// Tests
// =====================

describe('ToolWrapper', () => {
  let wrapper: ToolWrapper;
  let mockBudgetGuard: ReturnType<typeof createMockBudgetGuard>;
  let mockPolicyEngine: MockPolicyEngine;
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
      decision: {
        effect: 'allow',
        reason: 'OK',
        checkedAt: Date.now(),
        evaluationMs: 1,
      },
      checks: {
        killSwitch: 'passed',
        rateLimit: 'passed',
        rules: 'passed',
        approval: 'not_required',
      },
    } as MockPolicyResult);

    mockRegistry.get.mockReturnValue(sampleTool);

    wrapper = createToolWrapper({
      budgetGuard: mockBudgetGuard,
      policyEngine: mockPolicyEngine as unknown as Parameters<
        typeof createToolWrapper
      >[0]['policyEngine'],
      audit: mockAudit,
      registry: mockRegistry as unknown as ToolRegistry,
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
        requestId: undefined,
        episodeId: 'ep_123',
      });
    });

    it('should deny when policy denies', async () => {
      mockPolicyEngine.evaluate.mockResolvedValue({
        decision: {
          effect: 'deny',
          reason: 'Not authorized',
          deniedBy: 'policy_rule',
          checkedAt: Date.now(),
          evaluationMs: 1,
        },
        checks: {
          killSwitch: 'passed',
          rateLimit: 'passed',
          rules: 'denied',
          approval: 'skipped',
        },
      } as MockPolicyResult);

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

      await expect(
        wrapper.invoke({
          ...sampleInvocation,
          toolId: 'unknown:tool',
        })
      ).rejects.toThrow('Unknown tool: unknown:tool');
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

    it('should skip policy check when skipPolicyCheck is true', async () => {
      await wrapper.invoke({
        ...sampleInvocation,
        options: { skipPolicyCheck: true },
      });

      expect(mockPolicyEngine.evaluate).not.toHaveBeenCalled();
      expect(mockToolHandler).toHaveBeenCalled();
    });

    it('should warn for deprecated tools', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockRegistry.get.mockReturnValue({
        ...sampleTool,
        deprecated: true,
        deprecatedMessage: 'Use new:tool instead',
      });

      await wrapper.invoke(sampleInvocation);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('deprecated')
      );
      warnSpy.mockRestore();
    });

    it('should include invocationId in result metadata', async () => {
      const result = await wrapper.invoke(sampleInvocation);

      expect(result.metadata.invocationId).toBeDefined();
      expect(result.metadata.invocationId).toMatch(/^ti_/);
    });

    it('should track duration in result metadata', async () => {
      const result = await wrapper.invoke(sampleInvocation);

      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.startedAt).toBeLessThanOrEqual(
        result.metadata.completedAt
      );
    });
  });

  describe('retry behavior', () => {
    it('should retry on retryable error', async () => {
      const retryableError = new Error('Temporary failure');
      (retryableError as Error & { code: string }).code = 'TEMPORARY';

      mockToolHandler
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ data: 'success' });

      mockRegistry.get.mockReturnValue({
        ...sampleTool,
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 1,
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
          backoffMs: 1,
          retryableErrors: ['TEMPORARY'],
        },
      });

      const result = await wrapper.invoke(sampleInvocation);

      expect(result.success).toBe(false);
      expect(mockToolHandler).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries', async () => {
      const retryableError = new Error('Temporary');
      (retryableError as Error & { code: string }).code = 'TEMPORARY';
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

    it('should track retry count in metadata', async () => {
      const retryableError = new Error('Temporary');
      (retryableError as Error & { code: string }).code = 'TEMPORARY';

      mockToolHandler
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ data: 'success' });

      mockRegistry.get.mockReturnValue({
        ...sampleTool,
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 1,
          retryableErrors: ['TEMPORARY'],
        },
      });

      const result = await wrapper.invoke(sampleInvocation);

      expect(result.success).toBe(true);
      expect(result.metadata.retryCount).toBe(2);
    });
  });

  describe('timeout', () => {
    it('should timeout long-running tool', async () => {
      mockToolHandler.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000))
      );

      mockRegistry.get.mockReturnValue({
        ...sampleTool,
        budgetCost: {
          defaultTimeMs: 50,
        },
      });

      const result = await wrapper.invoke(sampleInvocation);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    }, 5000);

    it('should respect custom timeout from invocation options', async () => {
      mockToolHandler.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      mockRegistry.get.mockReturnValue({
        ...sampleTool,
        budgetCost: {
          defaultTimeMs: 30000, // Long default
        },
      });

      const result = await wrapper.invoke({
        ...sampleInvocation,
        options: {
          timeout: 50, // Short override
        },
      });

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

    it('should throw when no handler registered', async () => {
      mockRegistry.get.mockReturnValue({
        ...sampleTool,
        id: 'no:handler',
      });

      await expect(
        wrapper.invoke({
          ...sampleInvocation,
          toolId: 'no:handler',
        })
      ).rejects.toThrow('No handler registered for tool: no:handler');
    });
  });

  describe('unregisterHandler', () => {
    it('should unregister handler', async () => {
      wrapper.unregisterHandler('memory:read');

      mockRegistry.get.mockReturnValue(sampleTool);

      await expect(wrapper.invoke(sampleInvocation)).rejects.toThrow(
        'No handler registered for tool: memory:read'
      );
    });
  });

  describe('handler context', () => {
    it('should pass tool definition to handler', async () => {
      await wrapper.invoke(sampleInvocation);

      expect(mockToolHandler).toHaveBeenCalledWith(
        sampleInvocation.input,
        expect.objectContaining({
          toolDefinition: sampleTool,
        })
      );
    });

    it('should pass invocation context to handler', async () => {
      await wrapper.invoke(sampleInvocation);

      expect(mockToolHandler).toHaveBeenCalledWith(
        sampleInvocation.input,
        expect.objectContaining({
          episodeId: 'ep_123',
          clientId: 'client_abc',
          agentId: 'agent_copy',
        })
      );
    });

    it('should pass invocationId to handler', async () => {
      await wrapper.invoke(sampleInvocation);

      expect(mockToolHandler).toHaveBeenCalledWith(
        sampleInvocation.input,
        expect.objectContaining({
          invocationId: expect.stringMatching(/^ti_/),
        })
      );
    });
  });
});
