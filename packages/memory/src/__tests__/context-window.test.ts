import { describe, test, expect, beforeEach } from 'vitest';
import {
  createContextWindow,
  type ContextWindow,
  type ContextSection,
  type TokenCounter,
  createTokenCounter,
} from '../context-window';

describe('Context Window Management', () => {
  let window: ContextWindow;
  let tokenCounter: TokenCounter;

  beforeEach(() => {
    tokenCounter = createTokenCounter('gpt-4');
    window = createContextWindow({
      maxTokens: 8000,
      reservedForResponse: 1000,
      tokenCounter,
    });
  });

  describe('Token Counting', () => {
    test('counts tokens accurately', () => {
      const text = 'Hello, world! This is a test message.';
      const count = tokenCounter.count(text);

      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(20); // Should be around 9 tokens
    });

    test('counts tokens for array of strings', () => {
      const texts = ['Hello', 'World', 'Test'];
      const count = tokenCounter.countMany(texts);

      expect(count).toBeGreaterThan(0);
    });

    test('estimates tokens quickly for large content', () => {
      const largeText = 'word '.repeat(10000);
      const estimate = tokenCounter.estimate(largeText);

      expect(estimate).toBeGreaterThan(5000);
      expect(estimate).toBeLessThan(15000);
    });
  });

  describe('Section Management', () => {
    test('adds section within budget', () => {
      const section: ContextSection = {
        id: 'system',
        type: 'system',
        content: 'You are a helpful assistant.',
        priority: 100,
      };

      const result = window.addSection(section);

      expect(result.added).toBe(true);
      expect(window.getRemainingTokens()).toBeLessThan(7000);
    });

    test('rejects section exceeding budget', () => {
      // With estimation of ~4 chars/token and 7000 available tokens (8000 - 1000 reserved)
      // We need more than 28000 chars to exceed budget
      const largeContent = 'word '.repeat(8000); // ~40000 chars = ~10000 tokens
      const section: ContextSection = {
        id: 'large',
        type: 'retrieved',
        content: largeContent,
        priority: 50,
      };

      const result = window.addSection(section);

      expect(result.added).toBe(false);
      expect(result.reason).toContain('budget');
    });

    test('replaces existing section with same ID', () => {
      window.addSection({
        id: 'test',
        type: 'system',
        content: 'Version 1',
        priority: 100,
      });

      window.addSection({
        id: 'test',
        type: 'system',
        content: 'Version 2 with more content',
        priority: 100,
      });

      const sections = window.getSections();
      expect(sections.filter((s) => s.id === 'test')).toHaveLength(1);
      expect(sections.find((s) => s.id === 'test')?.content).toContain('Version 2');
    });

    test('removes section by ID', () => {
      window.addSection({
        id: 'to-remove',
        type: 'retrieved',
        content: 'Some content',
        priority: 50,
      });

      const beforeTokens = window.getRemainingTokens();
      window.removeSection('to-remove');
      const afterTokens = window.getRemainingTokens();

      expect(afterTokens).toBeGreaterThan(beforeTokens);
    });
  });

  describe('Priority Management', () => {
    test('higher priority sections added first', () => {
      window.addSection({
        id: 'low',
        type: 'retrieved',
        content: 'Low priority content',
        priority: 10,
      });

      window.addSection({
        id: 'high',
        type: 'system',
        content: 'High priority content',
        priority: 100,
      });

      const sections = window.getSections();
      expect(sections[0].id).toBe('high');
    });

    test('evicts lower priority when budget tight', () => {
      // Fill most of the budget
      // Available: 8000 - 1000 reserved = 7000 tokens
      // With ~4 chars/token, 'word '.repeat(5600) = 28000 chars = 7000 tokens
      window.addSection({
        id: 'filler',
        type: 'retrieved',
        content: 'word '.repeat(5600), // Fills entire budget
        priority: 30,
      });

      // Add high priority that would exceed budget
      // 'word '.repeat(400) = 2000 chars = 500 tokens
      const result = window.addSection({
        id: 'important',
        type: 'system',
        content: 'word '.repeat(400),
        priority: 90,
        evictLowerPriority: true,
      });

      expect(result.added).toBe(true);
      expect(result.evicted?.includes('filler')).toBe(true);
    });
  });

  describe('Truncation', () => {
    test('truncates content to fit budget', () => {
      const longContent = 'This is a sentence. '.repeat(500);

      const truncated = window.truncateToFit(longContent, 100);

      expect(tokenCounter.count(truncated)).toBeLessThanOrEqual(100);
      expect(truncated).toContain('...');
    });

    test('truncates by sentence boundaries', () => {
      const content = 'First sentence. Second sentence. Third sentence. Fourth sentence.';

      const truncated = window.truncateToFit(content, 10, {
        strategy: 'sentence',
      });

      // Should end at a sentence boundary
      expect(truncated.endsWith('.') || truncated.endsWith('...')).toBe(true);
    });

    test('truncates from middle preserving start and end', () => {
      // Use longer content with distinct start and end markers
      const content =
        'START_MARKER first section content here. ' +
        'This is the middle section that will be truncated. ' +
        'More middle content that should be removed. ' +
        'END_MARKER last section content here.';
      // ~160 chars ≈ 40 tokens

      const truncated = window.truncateToFit(content, 30, {
        strategy: 'middle',
      });

      // Should preserve start and end markers while cutting middle
      expect(truncated).toContain('START_MARKER');
      expect(truncated).toContain('END_MARKER');
      expect(truncated).toContain('[...]');
      // Verify truncation actually happened (not full content)
      expect(truncated.length).toBeLessThan(content.length);
    });
  });

  describe('Window Composition', () => {
    test('composes full context string', () => {
      window.addSection({
        id: 'system',
        type: 'system',
        content: 'You are a helpful assistant.',
        priority: 100,
      });

      window.addSection({
        id: 'context',
        type: 'retrieved',
        content: 'Relevant context here.',
        priority: 50,
      });

      window.addSection({
        id: 'history',
        type: 'conversation',
        content: 'User: Hello\nAssistant: Hi there!',
        priority: 80,
      });

      const composed = window.compose();

      expect(composed).toContain('You are a helpful assistant');
      expect(composed).toContain('Relevant context');
      expect(composed).toContain('User: Hello');
    });

    test('respects section separators', () => {
      window.addSection({
        id: 'sec1',
        type: 'system',
        content: 'Section 1',
        priority: 100,
      });

      window.addSection({
        id: 'sec2',
        type: 'retrieved',
        content: 'Section 2',
        priority: 50,
      });

      const composed = window.compose({ separator: '\n---\n' });

      expect(composed).toContain('\n---\n');
    });

    test('compose returns metadata', () => {
      window.addSection({
        id: 'test',
        type: 'system',
        content: 'Test content',
        priority: 100,
      });

      const result = window.composeWithMetadata();

      expect(result.content).toBeDefined();
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.sectionCount).toBe(1);
      expect(result.remainingForResponse).toBe(1000);
    });
  });

  describe('Budget Allocation', () => {
    test('allocates budget to categories', () => {
      const allocation = window.allocateBudget({
        system: 0.1, // 10% for system prompt
        conversation: 0.3, // 30% for history
        retrieved: 0.5, // 50% for retrieved content
        response: 0.1, // 10% reserved for response
      });

      expect(allocation.system).toBeLessThanOrEqual(800);
      expect(allocation.conversation).toBeLessThanOrEqual(2400);
      expect(allocation.retrieved).toBeLessThanOrEqual(4000);
    });

    test('fits content to allocated budget', () => {
      const allocation = window.allocateBudget({
        system: 0.1,
        retrieved: 0.7,
        response: 0.2,
      });

      const longContent = 'word '.repeat(2000);
      const fitted = window.fitToAllocation(longContent, 'retrieved', allocation);

      expect(tokenCounter.count(fitted)).toBeLessThanOrEqual(allocation.retrieved);
    });
  });

  describe('Snapshot and Restore', () => {
    test('creates snapshot of current state', () => {
      window.addSection({
        id: 'test',
        type: 'system',
        content: 'Test content',
        priority: 100,
      });

      const snapshot = window.snapshot();

      expect(snapshot.sections).toHaveLength(1);
      expect(snapshot.usedTokens).toBeGreaterThan(0);
    });

    test('restores from snapshot', () => {
      window.addSection({
        id: 'original',
        type: 'system',
        content: 'Original content',
        priority: 100,
      });

      const snapshot = window.snapshot();

      window.addSection({
        id: 'new',
        type: 'retrieved',
        content: 'New content',
        priority: 50,
      });

      window.restore(snapshot);

      const sections = window.getSections();
      expect(sections).toHaveLength(1);
      expect(sections[0].id).toBe('original');
    });
  });
});
