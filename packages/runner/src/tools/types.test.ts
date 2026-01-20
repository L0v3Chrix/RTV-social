/**
 * S1-D3: Tool Types Tests
 *
 * Tests for tool type definitions and Zod schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  ToolDefinitionSchema,
  ToolInvocationSchema,
  ToolResultSchema,
  ToolRiskLevelSchema,
  ToolCategorySchema,
  RetryPolicySchema,
  BudgetCostSchema,
  ToolErrorSchema,
  ToolInvocationContextSchema,
} from './types.js';

describe('Tool Types', () => {
  describe('ToolRiskLevelSchema', () => {
    it('should accept valid risk levels', () => {
      const levels = ['read', 'write', 'publish', 'critical'];
      for (const level of levels) {
        const result = ToolRiskLevelSchema.safeParse(level);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid risk levels', () => {
      const result = ToolRiskLevelSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('ToolCategorySchema', () => {
    it('should accept valid categories', () => {
      const categories = ['read', 'write', 'publish', 'sideEffect'];
      for (const category of categories) {
        const result = ToolCategorySchema.safeParse(category);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid categories', () => {
      const result = ToolCategorySchema.safeParse('unknown');
      expect(result.success).toBe(false);
    });
  });

  describe('RetryPolicySchema', () => {
    it('should validate retry policy with defaults', () => {
      const policy = {
        maxRetries: 3,
        backoffMs: 1000,
      };
      const result = RetryPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.backoffMultiplier).toBe(2);
        expect(result.data.maxBackoffMs).toBe(30000);
      }
    });

    it('should validate full retry policy', () => {
      const policy = {
        maxRetries: 5,
        backoffMs: 500,
        backoffMultiplier: 1.5,
        maxBackoffMs: 60000,
        retryableErrors: ['TIMEOUT', 'RATE_LIMITED'],
      };
      const result = RetryPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    });

    it('should reject negative maxRetries', () => {
      const policy = {
        maxRetries: -1,
        backoffMs: 1000,
      };
      const result = RetryPolicySchema.safeParse(policy);
      expect(result.success).toBe(false);
    });
  });

  describe('BudgetCostSchema', () => {
    it('should validate budget cost', () => {
      const cost = {
        defaultTokens: 500,
        defaultTimeMs: 5000,
      };
      const result = BudgetCostSchema.safeParse(cost);
      expect(result.success).toBe(true);
    });

    it('should allow optional fields', () => {
      const cost = {
        defaultTokens: 100,
      };
      const result = BudgetCostSchema.safeParse(cost);
      expect(result.success).toBe(true);
    });

    it('should allow empty object', () => {
      const result = BudgetCostSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('ToolDefinitionSchema', () => {
    it('should validate full tool definition', () => {
      const definition = {
        id: 'platform:post',
        name: 'Post to Platform',
        description: 'Publish content to social media platform',
        category: 'publish',
        riskLevel: 'publish',
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
        category: 'read',
        riskLevel: 'read',
        inputSchema: {},
        permissions: [],
      };

      const result = ToolDefinitionSchema.safeParse(definition);
      expect(result.success).toBe(false);
    });

    it('should require category and riskLevel', () => {
      const definition = {
        id: 'test:tool',
        name: 'Test Tool',
        inputSchema: {},
        permissions: [],
      };

      const result = ToolDefinitionSchema.safeParse(definition);
      expect(result.success).toBe(false);
    });

    it('should validate deprecated tool', () => {
      const definition = {
        id: 'legacy:tool',
        name: 'Legacy Tool',
        category: 'read',
        riskLevel: 'read',
        inputSchema: {},
        permissions: [],
        deprecated: true,
        deprecatedMessage: 'Use new:tool instead',
      };

      const result = ToolDefinitionSchema.safeParse(definition);
      expect(result.success).toBe(true);
    });
  });

  describe('ToolInvocationContextSchema', () => {
    it('should validate invocation context', () => {
      const context = {
        episodeId: 'ep_123',
        clientId: 'client_abc',
        agentId: 'agent_copy',
      };

      const result = ToolInvocationContextSchema.safeParse(context);
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const context = {
        episodeId: 'ep_123',
        clientId: 'client_abc',
        agentId: 'agent_copy',
        requestId: 'req_xyz',
        parentToolCallId: 'tc_parent',
      };

      const result = ToolInvocationContextSchema.safeParse(context);
      expect(result.success).toBe(true);
    });

    it('should require all mandatory fields', () => {
      const context = {
        episodeId: 'ep_123',
      };

      const result = ToolInvocationContextSchema.safeParse(context);
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

    it('should accept options', () => {
      const invocation = {
        toolId: 'memory:read',
        input: { key: 'test' },
        context: {
          episodeId: 'ep_123',
          clientId: 'client_abc',
          agentId: 'agent_copy',
        },
        options: {
          timeout: 5000,
          skipPolicyCheck: true,
          metadata: { source: 'test' },
        },
      };

      const result = ToolInvocationSchema.safeParse(invocation);
      expect(result.success).toBe(true);
    });

    it('should require toolId and context', () => {
      const invocation = {
        input: { key: 'test' },
      };

      const result = ToolInvocationSchema.safeParse(invocation);
      expect(result.success).toBe(false);
    });
  });

  describe('ToolErrorSchema', () => {
    it('should validate tool error', () => {
      const error = {
        code: 'POLICY_DENIED',
        message: 'Access denied by policy',
        retryable: false,
        details: { policyId: 'pol_123' },
      };

      const result = ToolErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('should provide default retryable value', () => {
      const error = {
        code: 'TIMEOUT',
        message: 'Operation timed out',
      };

      const result = ToolErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.retryable).toBe(false);
      }
    });
  });

  describe('ToolResultSchema', () => {
    it('should validate successful result', () => {
      const result = {
        success: true,
        output: { data: 'result' },
        error: null,
        metadata: {
          toolId: 'memory:read',
          invocationId: 'ti_123',
          startedAt: Date.now() - 100,
          completedAt: Date.now(),
          durationMs: 100,
          retryCount: 0,
        },
      };

      const parseResult = ToolResultSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should validate failed result', () => {
      const result = {
        success: false,
        output: null,
        error: {
          code: 'EXECUTION_ERROR',
          message: 'Tool execution failed',
          retryable: true,
        },
        metadata: {
          toolId: 'platform:post',
          invocationId: 'ti_456',
          startedAt: Date.now() - 500,
          completedAt: Date.now(),
          durationMs: 500,
          retryCount: 2,
        },
      };

      const parseResult = ToolResultSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should include optional tokensUsed', () => {
      const result = {
        success: true,
        output: { data: 'result' },
        error: null,
        metadata: {
          toolId: 'llm:generate',
          invocationId: 'ti_789',
          startedAt: Date.now() - 200,
          completedAt: Date.now(),
          durationMs: 200,
          retryCount: 0,
          tokensUsed: 150,
        },
      };

      const parseResult = ToolResultSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });
});
