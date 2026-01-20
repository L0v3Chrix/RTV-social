/**
 * Engine Types Tests
 */

import { describe, it, expect } from 'vitest';
import {
  EvaluationContextSchema,
  PolicyDecisionSchema,
  DecisionReasonSchema,
  DEFAULT_ENGINE_CONFIG,
  DEFAULT_CACHE_CONFIG,
} from '../types.js';

describe('Engine Types', () => {
  describe('EvaluationContextSchema', () => {
    it('should validate minimal context', () => {
      const context = {
        clientId: 'client_123',
        action: 'post:publish',
        resource: 'social:meta',
      };

      const result = EvaluationContextSchema.safeParse(context);
      expect(result.success).toBe(true);
    });

    it('should validate full context', () => {
      const context = {
        clientId: 'client_123',
        agentId: 'agent_456',
        action: 'post:publish',
        resource: 'social:meta',
        platform: 'facebook',
        timestamp: new Date(),
        fields: { author: 'john', tier: 'premium' },
        episodeId: 'ep_789',
        requestId: 'req_abc',
      };

      const result = EvaluationContextSchema.safeParse(context);
      expect(result.success).toBe(true);
    });

    it('should reject context without clientId', () => {
      const context = {
        action: 'post:publish',
        resource: 'social:meta',
      };

      const result = EvaluationContextSchema.safeParse(context);
      expect(result.success).toBe(false);
    });

    it('should reject context without action', () => {
      const context = {
        clientId: 'client_123',
        resource: 'social:meta',
      };

      const result = EvaluationContextSchema.safeParse(context);
      expect(result.success).toBe(false);
    });

    it('should reject context without resource', () => {
      const context = {
        clientId: 'client_123',
        action: 'post:publish',
      };

      const result = EvaluationContextSchema.safeParse(context);
      expect(result.success).toBe(false);
    });
  });

  describe('DecisionReasonSchema', () => {
    it('should validate all reason types', () => {
      const reasons = [
        'kill_switch_tripped',
        'rate_limit_exceeded',
        'rule_denied',
        'rule_allowed',
        'approval_required',
        'approval_pending',
        'approval_denied',
        'default_effect',
        'no_matching_rules',
        'evaluation_error',
      ];

      for (const reason of reasons) {
        const result = DecisionReasonSchema.safeParse(reason);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid reasons', () => {
      const result = DecisionReasonSchema.safeParse('invalid_reason');
      expect(result.success).toBe(false);
    });
  });

  describe('DEFAULT_ENGINE_CONFIG', () => {
    it('should have fail-closed enabled by default', () => {
      expect(DEFAULT_ENGINE_CONFIG.failClosed).toBe(true);
    });

    it('should have deny as default effect', () => {
      expect(DEFAULT_ENGINE_CONFIG.defaultEffect).toBe('deny');
    });

    it('should have all features enabled', () => {
      expect(DEFAULT_ENGINE_CONFIG.enableKillSwitch).toBe(true);
      expect(DEFAULT_ENGINE_CONFIG.enableRateLimit).toBe(true);
      expect(DEFAULT_ENGINE_CONFIG.enableApprovalGates).toBe(true);
      expect(DEFAULT_ENGINE_CONFIG.enableTracing).toBe(true);
    });

    it('should have reasonable timeout', () => {
      expect(DEFAULT_ENGINE_CONFIG.evaluationTimeoutMs).toBe(5000);
    });
  });

  describe('DEFAULT_CACHE_CONFIG', () => {
    it('should have caching enabled', () => {
      expect(DEFAULT_CACHE_CONFIG.enabled).toBe(true);
    });

    it('should have reasonable TTL', () => {
      expect(DEFAULT_CACHE_CONFIG.ttlMs).toBe(60000); // 1 minute
    });

    it('should have reasonable max size', () => {
      expect(DEFAULT_CACHE_CONFIG.maxSize).toBe(1000);
    });
  });
});
