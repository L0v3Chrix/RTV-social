/**
 * Episode State Machine Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createEpisodeStateMachine,
  isValidTransition,
  isTerminalState,
  isActiveState,
  VALID_TRANSITIONS,
} from '../state-machine.js';
import type { EpisodeStatus } from '../types.js';

describe('Episode State Machine', () => {
  describe('isValidTransition', () => {
    const validTransitions: [EpisodeStatus, EpisodeStatus][] = [
      ['created', 'running'],
      ['running', 'suspended'],
      ['running', 'completed'],
      ['running', 'failed'],
      ['suspended', 'running'],
      ['suspended', 'failed'],
      ['failed', 'created'], // retry creates new episode
    ];

    it.each(validTransitions)('should allow %s -> %s', (from, to) => {
      expect(isValidTransition(from, to)).toBe(true);
    });

    const invalidTransitions: [EpisodeStatus, EpisodeStatus][] = [
      ['created', 'completed'],
      ['created', 'suspended'],
      ['created', 'failed'],
      ['completed', 'running'],
      ['completed', 'failed'],
      ['completed', 'suspended'],
      ['failed', 'running'],
      ['failed', 'completed'],
      ['suspended', 'completed'],
    ];

    it.each(invalidTransitions)('should reject %s -> %s', (from, to) => {
      expect(isValidTransition(from, to)).toBe(false);
    });
  });

  describe('createEpisodeStateMachine', () => {
    it('should start in CREATED state', () => {
      const machine = createEpisodeStateMachine();
      expect(machine.currentState).toBe('created');
    });

    it('should allow custom initial state', () => {
      const machine = createEpisodeStateMachine('running');
      expect(machine.currentState).toBe('running');
    });

    it('should transition through valid states', () => {
      const machine = createEpisodeStateMachine();

      machine.transition('running');
      expect(machine.currentState).toBe('running');

      machine.transition('suspended');
      expect(machine.currentState).toBe('suspended');

      machine.transition('running');
      expect(machine.currentState).toBe('running');

      machine.transition('completed');
      expect(machine.currentState).toBe('completed');
    });

    it('should throw on invalid transition', () => {
      const machine = createEpisodeStateMachine();

      expect(() => machine.transition('completed')).toThrow(
        'Invalid transition from created to completed'
      );
    });

    it('should track transition history', () => {
      const machine = createEpisodeStateMachine();

      machine.transition('running');
      machine.transition('completed');

      expect(machine.history).toEqual([
        { from: 'created', to: 'running', timestamp: expect.any(Number) },
        { from: 'running', to: 'completed', timestamp: expect.any(Number) },
      ]);
    });

    it('should include reason in history when provided', () => {
      const machine = createEpisodeStateMachine();

      machine.transition('running', 'Episode started');
      machine.transition('suspended', 'Awaiting human approval');

      expect(machine.history[0].reason).toBe('Episode started');
      expect(machine.history[1].reason).toBe('Awaiting human approval');
    });

    it('should support canTransition check', () => {
      const machine = createEpisodeStateMachine();

      expect(machine.canTransition('running')).toBe(true);
      expect(machine.canTransition('completed')).toBe(false);
      expect(machine.canTransition('suspended')).toBe(false);
    });

    it('should return valid transitions', () => {
      const machine = createEpisodeStateMachine();
      expect(machine.getValidTransitions()).toEqual(['running']);

      machine.transition('running');
      expect(machine.getValidTransitions()).toEqual(['suspended', 'completed', 'failed']);

      machine.transition('completed');
      expect(machine.getValidTransitions()).toEqual([]);
    });
  });

  describe('isTerminalState', () => {
    it('should return true for completed', () => {
      expect(isTerminalState('completed')).toBe(true);
    });

    it('should return false for failed (can retry)', () => {
      expect(isTerminalState('failed')).toBe(false);
    });

    it('should return false for non-terminal states', () => {
      expect(isTerminalState('created')).toBe(false);
      expect(isTerminalState('running')).toBe(false);
      expect(isTerminalState('suspended')).toBe(false);
    });
  });

  describe('isActiveState', () => {
    it('should return true for running', () => {
      expect(isActiveState('running')).toBe(true);
    });

    it('should return false for other states', () => {
      expect(isActiveState('created')).toBe(false);
      expect(isActiveState('suspended')).toBe(false);
      expect(isActiveState('completed')).toBe(false);
      expect(isActiveState('failed')).toBe(false);
    });
  });

  describe('VALID_TRANSITIONS constant', () => {
    it('should have entries for all statuses', () => {
      const statuses: EpisodeStatus[] = ['created', 'running', 'suspended', 'completed', 'failed'];
      for (const status of statuses) {
        expect(VALID_TRANSITIONS[status]).toBeDefined();
        expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
      }
    });

    it('should have empty array for completed state', () => {
      expect(VALID_TRANSITIONS.completed).toEqual([]);
    });
  });
});
