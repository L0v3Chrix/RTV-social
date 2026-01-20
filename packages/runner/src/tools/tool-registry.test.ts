/**
 * S1-D3: Tool Registry Tests
 *
 * Tests for tool registration and lookup.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createToolRegistry, type ToolRegistry } from './tool-registry.js';
import type { ToolDefinition } from './types.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  const sampleTool: ToolDefinition = {
    id: 'test:tool',
    name: 'Test Tool',
    description: 'A test tool',
    category: 'read',
    riskLevel: 'read',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    permissions: ['test:read'],
  };

  beforeEach(() => {
    registry = createToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      registry.register(sampleTool);

      const retrieved = registry.get('test:tool');
      expect(retrieved).toEqual(sampleTool);
    });

    it('should throw on duplicate registration', () => {
      registry.register(sampleTool);

      expect(() => registry.register(sampleTool)).toThrow(
        'Tool already registered: test:tool'
      );
    });

    it('should register multiple different tools', () => {
      registry.register({ ...sampleTool, id: 'tool:one' });
      registry.register({ ...sampleTool, id: 'tool:two' });
      registry.register({ ...sampleTool, id: 'tool:three' });

      expect(registry.list()).toHaveLength(3);
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      registry.register(sampleTool);
      registry.unregister('test:tool');

      const retrieved = registry.get('test:tool');
      expect(retrieved).toBeUndefined();
    });

    it('should not throw when unregistering non-existent tool', () => {
      expect(() => registry.unregister('unknown:tool')).not.toThrow();
    });
  });

  describe('get', () => {
    it('should return undefined for unknown tool', () => {
      const result = registry.get('unknown:tool');
      expect(result).toBeUndefined();
    });

    it('should return tool definition by id', () => {
      registry.register(sampleTool);

      const result = registry.get('test:tool');
      expect(result).toBeDefined();
      expect(result?.id).toBe('test:tool');
    });
  });

  describe('getByCategory', () => {
    it('should return tools by category', () => {
      registry.register({ ...sampleTool, id: 'read:one', category: 'read' });
      registry.register({ ...sampleTool, id: 'read:two', category: 'read' });
      registry.register({ ...sampleTool, id: 'write:one', category: 'write' });

      const readTools = registry.getByCategory('read');
      expect(readTools).toHaveLength(2);
      expect(readTools.every((t) => t.category === 'read')).toBe(true);
    });

    it('should return empty array for category with no tools', () => {
      registry.register({ ...sampleTool, id: 'read:one', category: 'read' });

      const publishTools = registry.getByCategory('publish');
      expect(publishTools).toHaveLength(0);
    });
  });

  describe('getByRiskLevel', () => {
    it('should return tools by risk level', () => {
      registry.register({ ...sampleTool, id: 'low:one', riskLevel: 'read' });
      registry.register({ ...sampleTool, id: 'low:two', riskLevel: 'read' });
      registry.register({
        ...sampleTool,
        id: 'high:one',
        riskLevel: 'critical',
      });

      const criticalTools = registry.getByRiskLevel('critical');
      expect(criticalTools).toHaveLength(1);
      expect(criticalTools[0]?.id).toBe('high:one');
    });

    it('should return all read-level tools', () => {
      registry.register({ ...sampleTool, id: 'read:one', riskLevel: 'read' });
      registry.register({ ...sampleTool, id: 'read:two', riskLevel: 'read' });

      const readTools = registry.getByRiskLevel('read');
      expect(readTools).toHaveLength(2);
    });
  });

  describe('list', () => {
    it('should list all registered tools', () => {
      registry.register({ ...sampleTool, id: 'tool:1' });
      registry.register({ ...sampleTool, id: 'tool:2' });

      const all = registry.list();
      expect(all).toHaveLength(2);
    });

    it('should return empty array when no tools registered', () => {
      const all = registry.list();
      expect(all).toHaveLength(0);
    });

    it('should return a copy of the tools array', () => {
      registry.register({ ...sampleTool, id: 'tool:1' });
      const all1 = registry.list();
      const all2 = registry.list();

      expect(all1).not.toBe(all2);
      expect(all1).toEqual(all2);
    });
  });

  describe('hasPermission', () => {
    it('should check if tool has exact permission', () => {
      registry.register({
        ...sampleTool,
        permissions: ['read:memory', 'read:cache'],
      });

      expect(registry.hasPermission('test:tool', 'read:memory')).toBe(true);
      expect(registry.hasPermission('test:tool', 'write:memory')).toBe(false);
    });

    it('should support wildcard permissions', () => {
      registry.register({
        ...sampleTool,
        permissions: ['read:*'],
      });

      expect(registry.hasPermission('test:tool', 'read:memory')).toBe(true);
      expect(registry.hasPermission('test:tool', 'read:cache')).toBe(true);
      expect(registry.hasPermission('test:tool', 'write:memory')).toBe(false);
    });

    it('should support global wildcard', () => {
      registry.register({
        ...sampleTool,
        permissions: ['*'],
      });

      expect(registry.hasPermission('test:tool', 'read:memory')).toBe(true);
      expect(registry.hasPermission('test:tool', 'write:memory')).toBe(true);
      expect(registry.hasPermission('test:tool', 'anything:at:all')).toBe(true);
    });

    it('should return false for unknown tool', () => {
      expect(registry.hasPermission('unknown:tool', 'read:memory')).toBe(false);
    });
  });

  describe('isDeprecated', () => {
    it('should return true for deprecated tool', () => {
      registry.register({
        ...sampleTool,
        deprecated: true,
        deprecatedMessage: 'Use new:tool instead',
      });

      expect(registry.isDeprecated('test:tool')).toBe(true);
    });

    it('should return false for non-deprecated tool', () => {
      registry.register(sampleTool);

      expect(registry.isDeprecated('test:tool')).toBe(false);
    });

    it('should return false for unknown tool', () => {
      expect(registry.isDeprecated('unknown:tool')).toBe(false);
    });

    it('should return false when deprecated is not set', () => {
      registry.register({
        ...sampleTool,
        // deprecated not set
      });

      expect(registry.isDeprecated('test:tool')).toBe(false);
    });
  });
});
