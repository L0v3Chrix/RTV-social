/**
 * S1-B8: Pinned Context Manager Tests
 *
 * Tests for the high-level API managing critical context that should
 * never be evicted (attention sink pattern).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PinnedContextManager,
  PinnedCategory,
  createPinnedContextManager,
} from '../pinned-context-manager.js';
import { InMemoryStore } from '../types.js';

describe('S1-B8: Pinned Context Manager', () => {
  let manager: PinnedContextManager;
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    manager = createPinnedContextManager({
      store,
      defaultBudget: 2000,
      tokenEstimator: (content) => Math.ceil(content.length / 4),
    });
  });

  describe('Pinning Content', () => {
    it('should pin brand voice content', async () => {
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Professional and friendly tone. Avoid technical jargon.',
        label: 'Core Brand Voice',
      });

      expect(result.success).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry?.category).toBe(PinnedCategory.BRAND_VOICE);
      expect(result.entry?.clientId).toBe('client-1');
    });

    it('should pin compliance rules', async () => {
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.COMPLIANCE_RULES,
        content: 'Never mention competitor products by name.',
        label: 'Competitor Policy',
      });

      expect(result.success).toBe(true);
      expect(result.entry?.category).toBe(PinnedCategory.COMPLIANCE_RULES);
    });

    it('should pin prohibited topics', async () => {
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.PROHIBITED_TOPICS,
        content: 'Do not discuss: politics, religion, health claims',
        label: 'Prohibited Topics',
      });

      expect(result.success).toBe(true);
      expect(result.entry?.category).toBe(PinnedCategory.PROHIBITED_TOPICS);
    });

    it('should pin legal disclaimers', async () => {
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.LEGAL_DISCLAIMERS,
        content: 'Results may vary. This is not financial advice.',
        label: 'Standard Disclaimers',
      });

      expect(result.success).toBe(true);
      expect(result.entry?.category).toBe(PinnedCategory.LEGAL_DISCLAIMERS);
    });

    it('should pin tone guidelines', async () => {
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.TONE_GUIDELINES,
        content: 'Use conversational language, be empathetic.',
        label: 'Tone Guidelines',
      });

      expect(result.success).toBe(true);
      expect(result.entry?.category).toBe(PinnedCategory.TONE_GUIDELINES);
    });

    it('should reject pinning when budget exceeded', async () => {
      // Pin content that uses most of the budget
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'x'.repeat(7000), // ~1750 tokens
        label: 'Large content',
      });

      // Try to pin more
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.COMPLIANCE_RULES,
        content: 'x'.repeat(2000), // ~500 tokens, exceeds remaining
        label: 'Overflow',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('budget');
    });

    it('should track token usage per client', async () => {
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Test content',
        label: 'Test',
      });

      const usage = await manager.getUsage('client-1');

      expect(usage.used).toBeGreaterThan(0);
      expect(usage.remaining).toBeLessThan(usage.total);
      expect(usage.entries).toBe(1);
    });

    it('should calculate tokens correctly', async () => {
      const content = 'This is a test content string';
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content,
        label: 'Test',
      });

      const usage = await manager.getUsage('client-1');
      // Token estimator is Math.ceil(content.length / 4)
      expect(usage.used).toBe(Math.ceil(content.length / 4));
    });
  });

  describe('Retrieving Pinned Content', () => {
    beforeEach(async () => {
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Brand voice content',
        label: 'Voice',
      });
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.COMPLIANCE_RULES,
        content: 'Compliance content',
        label: 'Compliance',
      });
    });

    it('should list all pinned entries for client', async () => {
      const entries = await manager.list('client-1');

      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.category)).toContain(PinnedCategory.BRAND_VOICE);
      expect(entries.map((e) => e.category)).toContain(PinnedCategory.COMPLIANCE_RULES);
    });

    it('should filter by category', async () => {
      const entries = await manager.list('client-1', {
        category: PinnedCategory.BRAND_VOICE,
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe(PinnedCategory.BRAND_VOICE);
    });

    it('should get single entry by ID', async () => {
      const all = await manager.list('client-1');
      const entry = await manager.get(all[0].id);

      expect(entry).toBeDefined();
      expect(entry?.content).toBe('Brand voice content');
    });

    it('should return null for non-existent entry', async () => {
      const entry = await manager.get('non-existent-id');
      expect(entry).toBeNull();
    });

    it('should return empty list for client with no pinned content', async () => {
      const entries = await manager.list('client-with-no-content');
      expect(entries).toHaveLength(0);
    });
  });

  describe('Updating Pinned Content', () => {
    it('should update existing pinned entry content', async () => {
      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Original content',
        label: 'Voice',
      });

      const result = await manager.update(entry!.id, {
        content: 'Updated content',
      });

      expect(result.success).toBe(true);

      const updated = await manager.get(entry!.id);
      expect(updated?.content).toBe('Updated content');
    });

    it('should update entry label', async () => {
      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Content',
        label: 'Original Label',
      });

      const result = await manager.update(entry!.id, {
        label: 'New Label',
      });

      expect(result.success).toBe(true);

      const updated = await manager.get(entry!.id);
      expect(updated?.label).toBe('New Label');
    });

    it('should enforce budget on update', async () => {
      // Use most of budget
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'x'.repeat(6000),
        label: 'Large',
      });

      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.COMPLIANCE_RULES,
        content: 'Small',
        label: 'Small',
      });

      // Try to make small entry large
      const result = await manager.update(entry!.id, {
        content: 'x'.repeat(4000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('budget');
    });

    it('should allow updating label without affecting budget', async () => {
      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Content',
        label: 'Original Label',
      });

      const usageBefore = await manager.getUsage('client-1');

      const result = await manager.update(entry!.id, {
        label: 'New Label',
      });

      expect(result.success).toBe(true);

      const usageAfter = await manager.getUsage('client-1');
      expect(usageAfter.used).toBe(usageBefore.used);
    });

    it('should return error when updating non-existent entry', async () => {
      const result = await manager.update('non-existent-id', {
        content: 'New content',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Unpinning Content', () => {
    it('should remove pinned entry', async () => {
      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Content',
        label: 'Voice',
      });

      const result = await manager.unpin(entry!.id);

      expect(result.success).toBe(true);

      const check = await manager.get(entry!.id);
      expect(check).toBeNull();
    });

    it('should free budget when unpinning', async () => {
      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'x'.repeat(4000),
        label: 'Large',
      });

      const beforeUsage = await manager.getUsage('client-1');
      await manager.unpin(entry!.id);
      const afterUsage = await manager.getUsage('client-1');

      expect(afterUsage.used).toBeLessThan(beforeUsage.used);
      expect(afterUsage.entries).toBe(0);
    });

    it('should handle unpinning non-existent entry gracefully', async () => {
      const result = await manager.unpin('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Context Injection for RLMEnv', () => {
    beforeEach(async () => {
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Be professional',
        label: 'Voice',
      });
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.COMPLIANCE_RULES,
        content: 'No competitor mentions',
        label: 'Compliance',
      });
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.PROHIBITED_TOPICS,
        content: 'No politics',
        label: 'Prohibited',
      });
    });

    it('should format pinned context for injection', async () => {
      const context = await manager.getInjectionContext('client-1');

      expect(context).toContain('## Brand Voice');
      expect(context).toContain('Be professional');
      expect(context).toContain('## Compliance Rules');
      expect(context).toContain('No competitor mentions');
    });

    it('should include entry labels as subheaders', async () => {
      const context = await manager.getInjectionContext('client-1');

      expect(context).toContain('### Voice');
      expect(context).toContain('### Compliance');
      expect(context).toContain('### Prohibited');
    });

    it('should respect category ordering', async () => {
      const context = await manager.getInjectionContext('client-1');

      // Brand voice should come before compliance
      const brandVoiceIndex = context.indexOf('Brand Voice');
      const complianceIndex = context.indexOf('Compliance Rules');
      const prohibitedIndex = context.indexOf('Prohibited Topics');

      expect(brandVoiceIndex).toBeLessThan(complianceIndex);
      expect(complianceIndex).toBeLessThan(prohibitedIndex);
    });

    it('should filter categories for injection', async () => {
      const context = await manager.getInjectionContext('client-1', {
        categories: [PinnedCategory.BRAND_VOICE],
      });

      expect(context).toContain('Brand Voice');
      expect(context).not.toContain('Compliance Rules');
      expect(context).not.toContain('Prohibited Topics');
    });

    it('should estimate injection token count', async () => {
      const estimate = await manager.estimateInjectionTokens('client-1');

      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThanOrEqual(2000); // Within budget
    });

    it('should return empty string for client with no pinned content', async () => {
      const context = await manager.getInjectionContext('client-with-no-content');
      expect(context).toBe('');
    });
  });

  describe('Client Isolation', () => {
    it('should isolate pinned content between clients', async () => {
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Client 1 voice',
        label: 'Voice',
      });

      await manager.pin({
        clientId: 'client-2',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Client 2 voice',
        label: 'Voice',
      });

      const client1Entries = await manager.list('client-1');
      const client2Entries = await manager.list('client-2');

      expect(client1Entries).toHaveLength(1);
      expect(client1Entries[0].content).toBe('Client 1 voice');
      expect(client2Entries).toHaveLength(1);
      expect(client2Entries[0].content).toBe('Client 2 voice');
    });

    it('should not allow accessing other client pinned content', async () => {
      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Secret voice',
        label: 'Voice',
      });

      // Trying to get with wrong client context should fail
      const result = await manager.get(entry!.id, { clientId: 'client-2' });
      expect(result).toBeNull();
    });

    it('should maintain separate budgets per client', async () => {
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'x'.repeat(4000),
        label: 'Large',
      });

      const client1Usage = await manager.getUsage('client-1');
      const client2Usage = await manager.getUsage('client-2');

      expect(client1Usage.used).toBeGreaterThan(0);
      expect(client2Usage.used).toBe(0);
      expect(client2Usage.remaining).toBe(client2Usage.total);
    });
  });

  describe('Automatic Pinning on Client Setup', () => {
    it('should auto-pin brand voice for new client', async () => {
      await manager.initializeClient('new-client', {
        brandVoice: 'Default professional tone',
      });

      const entries = await manager.list('new-client');

      expect(entries.length).toBeGreaterThan(0);
      expect(entries.some((e) => e.category === PinnedCategory.BRAND_VOICE)).toBe(true);
      expect(entries.find((e) => e.category === PinnedCategory.BRAND_VOICE)?.content).toBe(
        'Default professional tone'
      );
    });

    it('should auto-pin default compliance rules when requested', async () => {
      await manager.initializeClient('new-client', {
        defaultCompliance: true,
      });

      const entries = await manager.list('new-client');

      expect(entries.some((e) => e.category === PinnedCategory.COMPLIANCE_RULES)).toBe(true);
    });

    it('should pin both brand voice and compliance when both provided', async () => {
      await manager.initializeClient('new-client', {
        brandVoice: 'Professional tone',
        defaultCompliance: true,
      });

      const entries = await manager.list('new-client');

      expect(entries.some((e) => e.category === PinnedCategory.BRAND_VOICE)).toBe(true);
      expect(entries.some((e) => e.category === PinnedCategory.COMPLIANCE_RULES)).toBe(true);
    });

    it('should not duplicate on re-initialization', async () => {
      await manager.initializeClient('client-1', {
        brandVoice: 'Tone A',
      });

      await manager.initializeClient('client-1', {
        brandVoice: 'Tone B',
      });

      const entries = await manager.list('client-1');
      const brandVoiceEntries = entries.filter((e) => e.category === PinnedCategory.BRAND_VOICE);

      expect(brandVoiceEntries).toHaveLength(1);
      // Should keep original, not overwrite
      expect(brandVoiceEntries[0].content).toBe('Tone A');
    });

    it('should do nothing when no defaults provided', async () => {
      await manager.initializeClient('new-client', {});

      const entries = await manager.list('new-client');
      expect(entries).toHaveLength(0);
    });
  });

  describe('Audit Trail', () => {
    it('should emit event on pin', async () => {
      const events: unknown[] = [];
      manager.on('pinned', (e) => events.push(e));

      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Content',
        label: 'Voice',
      });

      expect(events).toHaveLength(1);
      expect((events[0] as { action: string }).action).toBe('pin');
      expect((events[0] as { entry: { category: string } }).entry.category).toBe(
        PinnedCategory.BRAND_VOICE
      );
    });

    it('should emit event on unpin', async () => {
      const events: unknown[] = [];
      manager.on('unpinned', (e) => events.push(e));

      const { entry } = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Content',
        label: 'Voice',
      });

      await manager.unpin(entry!.id);

      expect(events).toHaveLength(1);
      expect((events[0] as { action: string }).action).toBe('unpin');
    });

    it('should include timestamp in audit events', async () => {
      const events: unknown[] = [];
      manager.on('pinned', (e) => events.push(e));

      const before = new Date();
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Content',
        label: 'Voice',
      });
      const after = new Date();

      const event = events[0] as { timestamp: Date };
      expect(event.timestamp).toBeDefined();
      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should not emit event on failed pin', async () => {
      const events: unknown[] = [];
      manager.on('pinned', (e) => events.push(e));

      // Use up budget
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'x'.repeat(8000),
        label: 'Large',
      });

      // This should fail and not emit
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.COMPLIANCE_RULES,
        content: 'x'.repeat(2000),
        label: 'Overflow',
      });

      // Only one event from successful pin
      expect(events).toHaveLength(1);
    });
  });

  describe('Factory Function', () => {
    it('should create manager with createPinnedContextManager', () => {
      const mgr = createPinnedContextManager({
        store: new InMemoryStore(),
        tokenEstimator: (content) => Math.ceil(content.length / 4),
      });

      expect(mgr).toBeInstanceOf(PinnedContextManager);
    });

    it('should use default budget of 2000 tokens', async () => {
      const mgr = createPinnedContextManager({
        store: new InMemoryStore(),
        tokenEstimator: (content) => Math.ceil(content.length / 4),
      });

      const usage = await mgr.getUsage('any-client');
      expect(usage.total).toBe(2000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: '',
        label: 'Empty',
      });

      expect(result.success).toBe(true);
      expect(result.entry?.tokens).toBe(0);
    });

    it('should handle very long content within budget', async () => {
      const longContent = 'x'.repeat(7000); // ~1750 tokens, within 2000 budget
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: longContent,
        label: 'Long',
      });

      expect(result.success).toBe(true);
    });

    it('should handle special characters in content', async () => {
      const specialContent = '🎉 Special chars: <>&"\' 日本語';
      const result = await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: specialContent,
        label: 'Special',
      });

      expect(result.success).toBe(true);

      const retrieved = await manager.get(result.entry!.id);
      expect(retrieved?.content).toBe(specialContent);
    });

    it('should handle multiple entries of same category', async () => {
      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Voice 1',
        label: 'Primary Voice',
      });

      await manager.pin({
        clientId: 'client-1',
        category: PinnedCategory.BRAND_VOICE,
        content: 'Voice 2',
        label: 'Secondary Voice',
      });

      const entries = await manager.list('client-1', {
        category: PinnedCategory.BRAND_VOICE,
      });

      expect(entries).toHaveLength(2);
    });
  });
});
