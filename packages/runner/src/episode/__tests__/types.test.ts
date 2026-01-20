/**
 * Episode Types Tests
 */

import { describe, it, expect } from 'vitest';
import {
  EpisodeConfigSchema,
  EpisodeBudgetSchema,
  EpisodeStatusSchema,
  EpisodeSchema,
  BudgetStateSchema,
  EpisodeErrorSchema,
  EpisodeCheckpointSchema,
} from '../types.js';

describe('Episode Types', () => {
  describe('EpisodeBudgetSchema', () => {
    it('should validate budget with all fields', () => {
      const budget = {
        maxTokens: 100000,
        maxTimeMs: 300000,
        maxRetries: 3,
        maxSubcalls: 10,
        maxToolCalls: 50,
      };

      const result = EpisodeBudgetSchema.safeParse(budget);
      expect(result.success).toBe(true);
    });

    it('should require positive values', () => {
      const budget = {
        maxTokens: -100,
        maxTimeMs: 300000,
        maxRetries: 3,
      };

      const result = EpisodeBudgetSchema.safeParse(budget);
      expect(result.success).toBe(false);
    });

    it('should allow partial budget', () => {
      const budget = {
        maxTokens: 100000,
      };

      const result = EpisodeBudgetSchema.safeParse(budget);
      expect(result.success).toBe(true);
    });

    it('should allow empty budget object', () => {
      const budget = {};

      const result = EpisodeBudgetSchema.safeParse(budget);
      expect(result.success).toBe(true);
    });
  });

  describe('EpisodeConfigSchema', () => {
    it('should validate full config', () => {
      const config = {
        agentId: 'agent_copy',
        taskType: 'generate_caption',
        clientId: 'client_abc',
        budget: {
          maxTokens: 100000,
          maxTimeMs: 300000,
          maxRetries: 3,
        },
        input: {
          planNodeId: 'pn_123',
          context: { platform: 'meta' },
        },
        parentEpisodeId: 'ep_parent',
      };

      const result = EpisodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should require agentId, taskType, clientId', () => {
      const config = {
        budget: { maxTokens: 100000 },
      };

      const result = EpisodeConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should allow config without parentEpisodeId', () => {
      const config = {
        agentId: 'agent_copy',
        taskType: 'generate_caption',
        clientId: 'client_abc',
        budget: {},
        input: {},
      };

      const result = EpisodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('EpisodeStatusSchema', () => {
    it('should accept valid statuses', () => {
      const statuses = ['created', 'running', 'suspended', 'completed', 'failed'];

      for (const status of statuses) {
        const result = EpisodeStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const result = EpisodeStatusSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('BudgetStateSchema', () => {
    it('should validate budget state with all fields', () => {
      const state = {
        tokensUsed: 5000,
        timeElapsedMs: 60000,
        retriesUsed: 1,
        subcallsUsed: 2,
        toolCallsUsed: 10,
      };

      const result = BudgetStateSchema.safeParse(state);
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const state = {};

      const result = BudgetStateSchema.safeParse(state);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tokensUsed).toBe(0);
        expect(result.data.timeElapsedMs).toBe(0);
      }
    });

    it('should reject negative values', () => {
      const state = {
        tokensUsed: -100,
      };

      const result = BudgetStateSchema.safeParse(state);
      expect(result.success).toBe(false);
    });
  });

  describe('EpisodeErrorSchema', () => {
    it('should validate error with required fields', () => {
      const error = {
        message: 'LLM timeout',
        code: 'TIMEOUT',
      };

      const result = EpisodeErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('should validate error with optional fields', () => {
      const error = {
        message: 'LLM timeout',
        code: 'TIMEOUT',
        stack: 'Error stack trace',
        details: { attempt: 3 },
        retryable: true,
      };

      const result = EpisodeErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('should require message and code', () => {
      const error = {
        retryable: true,
      };

      const result = EpisodeErrorSchema.safeParse(error);
      expect(result.success).toBe(false);
    });
  });

  describe('EpisodeCheckpointSchema', () => {
    it('should validate checkpoint with required fields', () => {
      const checkpoint = {
        currentStep: 3,
      };

      const result = EpisodeCheckpointSchema.safeParse(checkpoint);
      expect(result.success).toBe(true);
    });

    it('should validate checkpoint with all fields', () => {
      const checkpoint = {
        currentStep: 3,
        intermediateResults: ['draft caption'],
        toolState: { lastTool: 'search' },
        memoryReferences: ['ref_1', 'ref_2'],
        customData: { foo: 'bar' },
      };

      const result = EpisodeCheckpointSchema.safeParse(checkpoint);
      expect(result.success).toBe(true);
    });

    it('should require currentStep', () => {
      const checkpoint = {
        intermediateResults: ['draft'],
      };

      const result = EpisodeCheckpointSchema.safeParse(checkpoint);
      expect(result.success).toBe(false);
    });
  });

  describe('EpisodeSchema', () => {
    it('should validate full episode', () => {
      const episode = {
        id: 'ep_test123',
        agentId: 'agent_copy',
        taskType: 'generate_caption',
        clientId: 'client_abc',
        parentEpisodeId: null,
        childEpisodeIds: [],
        status: 'running',
        budget: { maxTokens: 100000 },
        budgetState: {
          tokensUsed: 5000,
          timeElapsedMs: 60000,
          retriesUsed: 0,
          subcallsUsed: 0,
          toolCallsUsed: 5,
        },
        input: { planNodeId: 'pn_123' },
        outputs: null,
        artifacts: [],
        checkpoint: null,
        error: null,
        createdAt: new Date(),
        startedAt: new Date(),
        suspendedAt: null,
        resumedAt: null,
        completedAt: null,
        failedAt: null,
        metadata: {},
      };

      const result = EpisodeSchema.safeParse(episode);
      expect(result.success).toBe(true);
    });

    it('should validate completed episode with outputs', () => {
      const episode = {
        id: 'ep_test123',
        agentId: 'agent_copy',
        taskType: 'generate_caption',
        clientId: 'client_abc',
        parentEpisodeId: null,
        childEpisodeIds: [],
        status: 'completed',
        budget: { maxTokens: 100000 },
        budgetState: {
          tokensUsed: 50000,
          timeElapsedMs: 120000,
          retriesUsed: 0,
          subcallsUsed: 0,
          toolCallsUsed: 10,
        },
        input: { planNodeId: 'pn_123' },
        outputs: { caption: 'Generated caption' },
        artifacts: ['artifact_1'],
        checkpoint: null,
        error: null,
        createdAt: new Date(),
        startedAt: new Date(),
        suspendedAt: null,
        resumedAt: null,
        completedAt: new Date(),
        failedAt: null,
        metadata: {},
      };

      const result = EpisodeSchema.safeParse(episode);
      expect(result.success).toBe(true);
    });
  });
});
