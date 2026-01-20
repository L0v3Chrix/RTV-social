import { describe, test, expect, beforeEach } from 'vitest';
import {
  createReferenceRegistry,
  type ReferenceRegistry,
  type Reference,
  type ReferenceType,
} from '../references';

describe('Reference System', () => {
  let registry: ReferenceRegistry;

  beforeEach(() => {
    registry = createReferenceRegistry();
  });

  describe('Reference Creation', () => {
    test('creates reference with required fields', async () => {
      const ref = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'Product FAQ',
        description: 'Frequently asked questions about our products',
      });

      expect(ref.id).toBeDefined();
      expect(ref.type).toBe('knowledge_base');
      expect(ref.targetId).toBe('kb-456');
      expect(ref.label).toBe('Product FAQ');
    });

    test('creates reference with span pointer', async () => {
      const ref = await registry.createReference({
        clientId: 'client-123',
        type: 'span',
        targetId: 'span-789',
        spanPointer: {
          spanId: 'span-789',
          startByte: 0,
          endByte: 1000,
          tokenEstimate: 250,
        },
        label: 'Pricing section',
      });

      expect(ref.spanPointer).toBeDefined();
      expect(ref.spanPointer?.tokenEstimate).toBe(250);
    });

    test('creates reference with metadata', async () => {
      const ref = await registry.createReference({
        clientId: 'client-123',
        type: 'thread',
        targetId: 'thread-123',
        label: 'Support conversation',
        metadata: {
          platform: 'instagram',
          sentiment: 'positive',
          messageCount: 15,
        },
      });

      expect(ref.metadata?.platform).toBe('instagram');
      expect(ref.metadata?.messageCount).toBe(15);
    });
  });

  describe('Reference Retrieval', () => {
    test('gets reference by ID', async () => {
      const created = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'Product FAQ',
      });

      const retrieved = await registry.getReference(created.id);

      expect(retrieved).toEqual(created);
    });

    test('gets references by target', async () => {
      await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'Ref 1',
      });

      await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'Ref 2',
      });

      const refs = await registry.getReferencesByTarget('client-123', 'kb-456');

      expect(refs).toHaveLength(2);
    });

    test('lists references by client and type', async () => {
      await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-1',
        label: 'KB 1',
      });

      await registry.createReference({
        clientId: 'client-123',
        type: 'thread',
        targetId: 'thread-1',
        label: 'Thread 1',
      });

      await registry.createReference({
        clientId: 'client-other',
        type: 'knowledge_base',
        targetId: 'kb-2',
        label: 'KB 2',
      });

      const kbRefs = await registry.listReferences({
        clientId: 'client-123',
        type: 'knowledge_base',
      });

      expect(kbRefs).toHaveLength(1);
      expect(kbRefs[0].type).toBe('knowledge_base');
    });
  });

  describe('Reference Links', () => {
    test('creates bidirectional links between references', async () => {
      const ref1 = await registry.createReference({
        clientId: 'client-123',
        type: 'thread',
        targetId: 'thread-1',
        label: 'Support thread',
      });

      const ref2 = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-1',
        label: 'Related FAQ',
      });

      await registry.linkReferences(ref1.id, ref2.id, 'related_to');

      const linkedFrom1 = await registry.getLinkedReferences(ref1.id);
      const linkedFrom2 = await registry.getLinkedReferences(ref2.id);

      expect(linkedFrom1.some((r) => r.id === ref2.id)).toBe(true);
      expect(linkedFrom2.some((r) => r.id === ref1.id)).toBe(true);
    });

    test('creates directional links', async () => {
      const parent = await registry.createReference({
        clientId: 'client-123',
        type: 'plan',
        targetId: 'plan-1',
        label: 'Main plan',
      });

      const child = await registry.createReference({
        clientId: 'client-123',
        type: 'plan',
        targetId: 'plan-2',
        label: 'Sub plan',
      });

      await registry.linkReferences(parent.id, child.id, 'parent_of', {
        bidirectional: false,
      });

      const childrenOfParent = await registry.getLinkedReferences(parent.id, {
        linkType: 'parent_of',
      });
      const parentsOfChild = await registry.getLinkedReferences(child.id, {
        linkType: 'parent_of',
      });

      expect(childrenOfParent.some((r) => r.id === child.id)).toBe(true);
      expect(parentsOfChild).toHaveLength(0);
    });
  });

  describe('Reference Resolution', () => {
    test('resolves reference to content location', async () => {
      const ref = await registry.createReference({
        clientId: 'client-123',
        type: 'span',
        targetId: 'span-123',
        spanPointer: {
          spanId: 'span-123',
          startByte: 100,
          endByte: 500,
          tokenEstimate: 100,
        },
        label: 'Content section',
      });

      const location = await registry.resolveReference(ref.id);

      expect(location.spanId).toBe('span-123');
      expect(location.startByte).toBe(100);
      expect(location.endByte).toBe(500);
    });

    test('tracks reference access', async () => {
      const ref = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'FAQ',
      });

      await registry.recordAccess(ref.id, {
        sessionId: 'session-123',
        operation: 'read',
      });

      const stats = await registry.getAccessStats(ref.id);

      expect(stats.accessCount).toBe(1);
      expect(stats.lastAccessedAt).toBeDefined();
    });
  });

  describe('Reference Versioning', () => {
    test('creates new version of reference', async () => {
      const v1 = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'FAQ v1',
      });

      const v2 = await registry.createVersion(v1.id, {
        label: 'FAQ v2',
        description: 'Updated FAQ content',
      });

      expect(v2.version).toBe(2);
      expect(v2.previousVersionId).toBe(v1.id);
      expect(v2.label).toBe('FAQ v2');
    });

    test('lists version history', async () => {
      const v1 = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'FAQ v1',
      });

      await registry.createVersion(v1.id, { label: 'FAQ v2' });
      await registry.createVersion(v1.id, { label: 'FAQ v3' });

      const history = await registry.getVersionHistory(v1.id);

      expect(history).toHaveLength(3);
      expect(history[0].label).toBe('FAQ v1');
      expect(history[2].label).toBe('FAQ v3');
    });
  });

  describe('Reference Serialization', () => {
    test('toCompactForm generates minimal representation', async () => {
      const ref = await registry.createReference({
        clientId: 'client-123',
        type: 'knowledge_base',
        targetId: 'kb-456',
        label: 'Product FAQ',
        description: 'Long description here',
        metadata: { category: 'support' },
      });

      const compact = registry.toCompactForm(ref);

      expect(compact).toContain('knowledge_base');
      expect(compact).toContain('Product FAQ');
      expect(compact.length).toBeLessThan(200);
    });

    test('toCompactForm array generates reference list', async () => {
      const refs = await Promise.all([
        registry.createReference({
          clientId: 'client-123',
          type: 'knowledge_base',
          targetId: 'kb-1',
          label: 'FAQ 1',
        }),
        registry.createReference({
          clientId: 'client-123',
          type: 'thread',
          targetId: 'thread-1',
          label: 'Thread 1',
        }),
      ]);

      const compact = registry.toCompactFormArray(refs);

      expect(compact).toContain('FAQ 1');
      expect(compact).toContain('Thread 1');
    });
  });
});
