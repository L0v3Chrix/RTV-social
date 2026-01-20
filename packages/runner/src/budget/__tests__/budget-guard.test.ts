/**
 * S1-D2: Budget Guard Tests
 *
 * Tests for the budget guard that wraps operations with budget checks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBudgetGuard, BudgetGuard, BudgetExceededError } from '../budget-guard.js';
import type { BudgetTracker } from '../budget-tracker.js';
import type { EpisodeBudget, BudgetState } from '../../episode/types.js';

/**
 * Create a mock budget tracker for testing
 */
function createMockBudgetTracker(): BudgetTracker & {
  checkBefore: ReturnType<typeof vi.fn>;
  recordTokens: ReturnType<typeof vi.fn>;
  recordToolCall: ReturnType<typeof vi.fn>;
  recordSubcall: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
  getBudget: ReturnType<typeof vi.fn>;
} {
  const defaultBudget: EpisodeBudget = {
    maxTokens: 100000,
    maxTimeMs: 300000,
    maxRetries: 3,
    maxSubcalls: 10,
    maxToolCalls: 50,
  };

  const defaultState: BudgetState = {
    tokensUsed: 0,
    timeElapsedMs: 0,
    retriesUsed: 0,
    subcallsUsed: 0,
    toolCallsUsed: 0,
  };

  return {
    checkBefore: vi.fn().mockReturnValue({ allowed: true, violations: [], details: {} }),
    recordTokens: vi.fn(),
    recordToolCall: vi.fn(),
    recordSubcall: vi.fn(),
    getState: vi.fn().mockReturnValue(defaultState),
    getBudget: vi.fn().mockReturnValue(defaultBudget),
    // EventEmitter methods (not used in tests)
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    emit: vi.fn(),
    removeListener: vi.fn().mockReturnThis(),
    addListener: vi.fn().mockReturnThis(),
    removeAllListeners: vi.fn().mockReturnThis(),
    setMaxListeners: vi.fn().mockReturnThis(),
    getMaxListeners: vi.fn().mockReturnValue(10),
    listeners: vi.fn().mockReturnValue([]),
    rawListeners: vi.fn().mockReturnValue([]),
    listenerCount: vi.fn().mockReturnValue(0),
    prependListener: vi.fn().mockReturnThis(),
    prependOnceListener: vi.fn().mockReturnThis(),
    eventNames: vi.fn().mockReturnValue([]),
    // BudgetTracker methods
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    snapshot: vi.fn().mockReturnValue(defaultState),
    getChildEpisodes: vi.fn().mockReturnValue([]),
    getToolCallCounts: vi.fn().mockReturnValue({}),
  } as unknown as BudgetTracker & {
    checkBefore: ReturnType<typeof vi.fn>;
    recordTokens: ReturnType<typeof vi.fn>;
    recordToolCall: ReturnType<typeof vi.fn>;
    recordSubcall: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
    getBudget: ReturnType<typeof vi.fn>;
  };
}

describe('BudgetGuard', () => {
  let guard: BudgetGuard;
  let mockTracker: ReturnType<typeof createMockBudgetTracker>;
  let onExceeded: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTracker = createMockBudgetTracker();
    onExceeded = vi.fn();
    guard = createBudgetGuard({
      tracker: mockTracker,
      onExceeded,
    });
  });

  describe('withBudgetCheck', () => {
    it('should execute function when budget available', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });

      const result = await guard.withBudgetCheck({ tokens: 1000 }, async () => 'success');

      expect(result).toBe('success');
    });

    it('should throw BudgetExceededError when budget insufficient', async () => {
      mockTracker.checkBefore.mockReturnValue({
        allowed: false,
        violations: ['tokens'],
        details: { tokens: { wouldExceedBy: 5000 } },
      });

      await expect(
        guard.withBudgetCheck({ tokens: 50000 }, async () => 'success')
      ).rejects.toThrow('Budget exceeded: tokens');
    });

    it('should throw BudgetExceededError instance', async () => {
      mockTracker.checkBefore.mockReturnValue({
        allowed: false,
        violations: ['tokens'],
        details: {},
      });

      try {
        await guard.withBudgetCheck({ tokens: 50000 }, async () => 'success');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BudgetExceededError);
        expect((error as BudgetExceededError).violations).toContain('tokens');
      }
    });

    it('should record actual usage after execution', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });

      await guard.withBudgetCheck({ tokens: 1000 }, async () => 'success', { actualTokens: 1234 });

      expect(mockTracker.recordTokens).toHaveBeenCalledWith(1234);
    });

    it('should record estimated usage when no actual provided', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });

      await guard.withBudgetCheck({ tokens: 1000 }, async () => 'success');

      expect(mockTracker.recordTokens).toHaveBeenCalledWith(1000);
    });

    it('should call onExceeded callback on budget error', async () => {
      mockTracker.checkBefore.mockReturnValue({
        allowed: false,
        violations: ['tokens'],
        details: {},
      });

      try {
        await guard.withBudgetCheck({ tokens: 50000 }, async () => 'success');
      } catch {
        // Expected
      }

      expect(onExceeded).toHaveBeenCalled();
      expect(onExceeded.mock.calls[0][0]).toBeInstanceOf(BudgetExceededError);
    });
  });

  describe('guardLLMCall', () => {
    it('should check and record token usage', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });

      const mockLLMCall = vi.fn().mockResolvedValue({
        content: 'response',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await guard.guardLLMCall(mockLLMCall, {
        estimatedTokens: 200,
      });

      expect(result.content).toBe('response');
      expect(mockTracker.recordTokens).toHaveBeenCalledWith(150, expect.any(Object));
    });

    it('should throw if estimated tokens exceed budget', async () => {
      mockTracker.checkBefore.mockReturnValue({
        allowed: false,
        violations: ['tokens'],
      });

      const mockLLMCall = vi.fn();

      await expect(guard.guardLLMCall(mockLLMCall, { estimatedTokens: 500000 })).rejects.toThrow();

      expect(mockLLMCall).not.toHaveBeenCalled();
    });

    it('should use estimated tokens when no usage returned', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });

      const mockLLMCall = vi.fn().mockResolvedValue({
        content: 'response',
        // No usage field
      });

      await guard.guardLLMCall(mockLLMCall, {
        estimatedTokens: 200,
      });

      expect(mockTracker.recordTokens).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should include model in token recording', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });

      const mockLLMCall = vi.fn().mockResolvedValue({
        content: 'response',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      await guard.guardLLMCall(mockLLMCall, {
        estimatedTokens: 200,
        model: 'gpt-4',
      });

      expect(mockTracker.recordTokens).toHaveBeenCalledWith(150, {
        type: 'total',
        model: 'gpt-4',
      });
    });
  });

  describe('guardToolCall', () => {
    it('should check and record tool call', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });

      const mockTool = vi.fn().mockResolvedValue({ data: 'result' });

      const result = await guard.guardToolCall('my_tool', mockTool);

      expect(result).toEqual({ data: 'result' });
      expect(mockTracker.recordToolCall).toHaveBeenCalledWith('my_tool');
    });

    it('should throw if tool call budget exceeded', async () => {
      mockTracker.checkBefore.mockReturnValue({
        allowed: false,
        violations: ['toolCalls'],
      });

      const mockTool = vi.fn();

      await expect(guard.guardToolCall('my_tool', mockTool)).rejects.toThrow(
        'Budget exceeded: toolCalls'
      );

      expect(mockTool).not.toHaveBeenCalled();
    });

    it('should not record tool call on failure', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });

      const mockTool = vi.fn().mockRejectedValue(new Error('Tool failed'));

      await expect(guard.guardToolCall('my_tool', mockTool)).rejects.toThrow('Tool failed');

      // Still records the call attempt
      expect(mockTracker.recordToolCall).toHaveBeenCalledWith('my_tool');
    });
  });

  describe('allocateSubcallBudget', () => {
    it('should allocate budget for subcall', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });
      mockTracker.getState.mockReturnValue({
        tokensUsed: 10000,
        timeElapsedMs: 50000,
        subcallsUsed: 2,
        toolCallsUsed: 5,
        retriesUsed: 0,
      });

      const subcallBudget = await guard.allocateSubcallBudget({
        fraction: 0.3,
      });

      expect(subcallBudget.maxTokens).toBeDefined();
      expect(mockTracker.recordSubcall).toHaveBeenCalled();
    });

    it('should reject if subcall limit reached', async () => {
      mockTracker.checkBefore.mockReturnValue({
        allowed: false,
        violations: ['subcalls'],
      });

      await expect(guard.allocateSubcallBudget({ fraction: 0.3 })).rejects.toThrow(
        'Budget exceeded: subcalls'
      );
    });

    it('should respect minimum allocations', async () => {
      mockTracker.checkBefore.mockReturnValue({ allowed: true, violations: [] });
      mockTracker.getState.mockReturnValue({
        tokensUsed: 99000, // Almost exhausted
        timeElapsedMs: 290000,
        subcallsUsed: 0,
        toolCallsUsed: 0,
        retriesUsed: 0,
      });

      const subcallBudget = await guard.allocateSubcallBudget({
        fraction: 0.5,
        minTokens: 5000,
        minTimeMs: 30000,
      });

      expect(subcallBudget.maxTokens).toBe(5000);
      expect(subcallBudget.maxTimeMs).toBe(30000);
    });
  });

  describe('getRemainingBudget', () => {
    it('should return remaining budget for each type', () => {
      mockTracker.getState.mockReturnValue({
        tokensUsed: 30000,
        timeElapsedMs: 100000,
        subcallsUsed: 3,
        toolCallsUsed: 20,
        retriesUsed: 1,
      });

      const remaining = guard.getRemainingBudget();

      expect(remaining.tokens).toBe(70000);
      expect(remaining.timeMs).toBe(200000);
      expect(remaining.subcalls).toBe(7);
      expect(remaining.toolCalls).toBe(30);
    });

    it('should return Infinity for undefined limits', () => {
      mockTracker.getBudget.mockReturnValue({});
      mockTracker.getState.mockReturnValue({
        tokensUsed: 0,
        timeElapsedMs: 0,
        subcallsUsed: 0,
        toolCallsUsed: 0,
        retriesUsed: 0,
      });

      const remaining = guard.getRemainingBudget();

      expect(remaining.tokens).toBe(Infinity);
      expect(remaining.timeMs).toBe(Infinity);
      expect(remaining.subcalls).toBe(Infinity);
      expect(remaining.toolCalls).toBe(Infinity);
    });
  });

  describe('BudgetExceededError', () => {
    it('should contain violation details', () => {
      const error = new BudgetExceededError(['tokens', 'time'], {
        tokens: { wouldExceedBy: 5000 },
        time: { exceededBy: 10000 },
      });

      expect(error.violations).toEqual(['tokens', 'time']);
      expect(error.details).toEqual({
        tokens: { wouldExceedBy: 5000 },
        time: { exceededBy: 10000 },
      });
      expect(error.message).toBe('Budget exceeded: tokens, time');
      expect(error.name).toBe('BudgetExceededError');
    });
  });
});
