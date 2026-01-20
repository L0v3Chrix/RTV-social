/**
 * S1-D2: Budget Tracker Tests
 *
 * Tests for real-time budget tracking that monitors consumption
 * during episode execution.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createBudgetTracker, BudgetTracker } from '../budget-tracker.js';
import type { EpisodeBudget } from '../../episode/types.js';

describe('BudgetTracker', () => {
  let tracker: BudgetTracker;

  const budget: EpisodeBudget = {
    maxTokens: 100000,
    maxTimeMs: 300000,
    maxRetries: 3,
    maxSubcalls: 10,
    maxToolCalls: 50,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = createBudgetTracker({
      episodeId: 'ep_test',
      budget,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    tracker.stop();
  });

  describe('recordTokens', () => {
    it('should accumulate token usage', () => {
      tracker.recordTokens(1000);
      tracker.recordTokens(2000);

      expect(tracker.getState().tokensUsed).toBe(3000);
    });

    it('should separate input and output tokens', () => {
      tracker.recordTokens(1000, { type: 'input' });
      tracker.recordTokens(500, { type: 'output' });

      const state = tracker.getState();
      expect(state.tokensUsed).toBe(1500);
    });

    it('should emit warning at 80% usage', () => {
      const onWarning = vi.fn();
      tracker.on('warning', onWarning);

      tracker.recordTokens(80000);

      expect(onWarning).toHaveBeenCalledWith({
        type: 'tokens',
        used: 80000,
        max: 100000,
        percentage: 80,
      });
    });

    it('should emit exceeded event at limit', () => {
      const onExceeded = vi.fn();
      tracker.on('exceeded', onExceeded);

      tracker.recordTokens(100001);

      expect(onExceeded).toHaveBeenCalledWith({
        type: 'tokens',
        used: 100001,
        max: 100000,
        exceededBy: 1,
      });
    });

    it('should only emit warning once', () => {
      const onWarning = vi.fn();
      tracker.on('warning', onWarning);

      tracker.recordTokens(80000);
      tracker.recordTokens(5000);
      tracker.recordTokens(5000);

      // Should only emit once when crossing 80% threshold
      const tokenWarnings = onWarning.mock.calls.filter((c) => c[0].type === 'tokens');
      expect(tokenWarnings).toHaveLength(1);
    });
  });

  describe('time tracking', () => {
    it('should track elapsed time', () => {
      tracker.start();
      vi.advanceTimersByTime(5000);

      expect(tracker.getState().timeElapsedMs).toBeGreaterThanOrEqual(5000);
    });

    it('should pause and resume time tracking', () => {
      tracker.start();
      vi.advanceTimersByTime(5000);

      tracker.pause();
      const pausedTime = tracker.getState().timeElapsedMs;

      vi.advanceTimersByTime(10000);
      expect(tracker.getState().timeElapsedMs).toBe(pausedTime);

      tracker.resume();
      vi.advanceTimersByTime(5000);
      expect(tracker.getState().timeElapsedMs).toBeGreaterThan(pausedTime);
    });

    it('should emit warning at 80% time usage', () => {
      const onWarning = vi.fn();
      tracker.on('warning', onWarning);

      tracker.start();
      vi.advanceTimersByTime(240000); // 80% of 300000

      expect(onWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'time',
          percentage: expect.any(Number),
        })
      );
    });

    it('should emit exceeded event when time exhausted', () => {
      const onExceeded = vi.fn();
      tracker.on('exceeded', onExceeded);

      tracker.start();
      vi.advanceTimersByTime(300001);

      expect(onExceeded).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'time',
          exceededBy: expect.any(Number),
        })
      );
    });

    it('should stop time tracking', () => {
      tracker.start();
      vi.advanceTimersByTime(5000);
      tracker.stop();
      const stoppedTime = tracker.getState().timeElapsedMs;

      vi.advanceTimersByTime(10000);
      expect(tracker.getState().timeElapsedMs).toBe(stoppedTime);
    });
  });

  describe('recordSubcall', () => {
    it('should increment subcall count', () => {
      tracker.recordSubcall('ep_child_1');
      tracker.recordSubcall('ep_child_2');

      expect(tracker.getState().subcallsUsed).toBe(2);
    });

    it('should track child episode IDs', () => {
      tracker.recordSubcall('ep_child_1');
      tracker.recordSubcall('ep_child_2');

      expect(tracker.getChildEpisodes()).toEqual(['ep_child_1', 'ep_child_2']);
    });

    it('should emit warning at 80% subcall usage', () => {
      const onWarning = vi.fn();
      tracker.on('warning', onWarning);

      for (let i = 0; i < 8; i++) {
        tracker.recordSubcall(`ep_child_${i}`);
      }

      const subcallWarnings = onWarning.mock.calls.filter((c) => c[0].type === 'subcalls');
      expect(subcallWarnings).toHaveLength(1);
    });
  });

  describe('recordToolCall', () => {
    it('should increment tool call count', () => {
      tracker.recordToolCall('tool_read');
      tracker.recordToolCall('tool_write');
      tracker.recordToolCall('tool_read');

      expect(tracker.getState().toolCallsUsed).toBe(3);
    });

    it('should track by tool name', () => {
      tracker.recordToolCall('tool_read');
      tracker.recordToolCall('tool_read');
      tracker.recordToolCall('tool_write');

      expect(tracker.getToolCallCounts()).toEqual({
        tool_read: 2,
        tool_write: 1,
      });
    });

    it('should emit warning at 80% tool call usage', () => {
      const onWarning = vi.fn();
      tracker.on('warning', onWarning);

      for (let i = 0; i < 40; i++) {
        tracker.recordToolCall(`tool_${i}`);
      }

      const toolWarnings = onWarning.mock.calls.filter((c) => c[0].type === 'toolCalls');
      expect(toolWarnings).toHaveLength(1);
    });
  });

  describe('checkBefore', () => {
    it('should allow operation when budget available', () => {
      const result = tracker.checkBefore({
        tokens: 50000,
        toolCalls: 10,
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny operation when budget would be exceeded', () => {
      tracker.recordTokens(60000);

      const result = tracker.checkBefore({
        tokens: 50000,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toContain('tokens');
    });

    it('should check multiple budget types', () => {
      tracker.recordTokens(90000);
      tracker.recordToolCall('tool');

      for (let i = 0; i < 45; i++) {
        tracker.recordToolCall(`tool_${i}`);
      }

      const result = tracker.checkBefore({
        tokens: 20000,
        toolCalls: 10,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toContain('tokens');
      expect(result.violations).toContain('toolCalls');
    });
  });

  describe('snapshot', () => {
    it('should create immutable snapshot', () => {
      tracker.recordTokens(10000);
      const snapshot1 = tracker.snapshot();

      tracker.recordTokens(5000);
      const snapshot2 = tracker.snapshot();

      expect(snapshot1.tokensUsed).toBe(10000);
      expect(snapshot2.tokensUsed).toBe(15000);
    });

    it('should include all budget state fields', () => {
      tracker.recordTokens(1000);
      tracker.recordSubcall('ep_child');
      tracker.recordToolCall('tool');

      const snapshot = tracker.snapshot();

      expect(snapshot).toMatchObject({
        tokensUsed: 1000,
        timeElapsedMs: expect.any(Number),
        retriesUsed: 0,
        subcallsUsed: 1,
        toolCallsUsed: 1,
      });
    });
  });

  describe('getBudget', () => {
    it('should return the original budget', () => {
      const returnedBudget = tracker.getBudget();

      expect(returnedBudget).toEqual(budget);
    });

    it('should return a copy of the budget', () => {
      const returnedBudget = tracker.getBudget();
      returnedBudget.maxTokens = 999;

      expect(tracker.getBudget().maxTokens).toBe(100000);
    });
  });

  describe('initial state', () => {
    it('should accept initial state', () => {
      const initialState = {
        tokensUsed: 5000,
        timeElapsedMs: 10000,
        retriesUsed: 1,
        subcallsUsed: 2,
        toolCallsUsed: 5,
      };

      const trackerWithState = createBudgetTracker({
        episodeId: 'ep_test',
        budget,
        initialState,
      });

      expect(trackerWithState.getState()).toMatchObject(initialState);
      trackerWithState.stop();
    });
  });

  describe('custom warning threshold', () => {
    it('should emit warning at custom threshold', () => {
      const customTracker = createBudgetTracker({
        episodeId: 'ep_test',
        budget,
        warningThreshold: 0.5, // 50%
      });

      const onWarning = vi.fn();
      customTracker.on('warning', onWarning);

      customTracker.recordTokens(50000);

      expect(onWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tokens',
          percentage: 50,
        })
      );

      customTracker.stop();
    });
  });
});
