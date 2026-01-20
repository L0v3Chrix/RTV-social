/**
 * S1-D3: Tool Registry
 *
 * Registry for tool definitions with lookup by category, risk level, and permissions.
 */

import type { ToolDefinition, ToolRiskLevel, ToolCategory } from './types.js';

/**
 * Tool registry interface.
 */
export interface ToolRegistry {
  /** Register a new tool definition */
  register(definition: ToolDefinition): void;
  /** Unregister a tool by ID */
  unregister(toolId: string): void;
  /** Get a tool definition by ID */
  get(toolId: string): ToolDefinition | undefined;
  /** Get tools by category */
  getByCategory(category: ToolCategory): ToolDefinition[];
  /** Get tools by risk level */
  getByRiskLevel(riskLevel: ToolRiskLevel): ToolDefinition[];
  /** List all registered tools */
  list(): ToolDefinition[];
  /** Check if a tool has a specific permission */
  hasPermission(toolId: string, permission: string): boolean;
  /** Check if a tool is deprecated */
  isDeprecated(toolId: string): boolean;
}

/**
 * Create a tool registry instance.
 */
export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, ToolDefinition>();

  return {
    register(definition: ToolDefinition): void {
      if (tools.has(definition.id)) {
        throw new Error(`Tool already registered: ${definition.id}`);
      }
      tools.set(definition.id, definition);
    },

    unregister(toolId: string): void {
      tools.delete(toolId);
    },

    get(toolId: string): ToolDefinition | undefined {
      return tools.get(toolId);
    },

    getByCategory(category: ToolCategory): ToolDefinition[] {
      return Array.from(tools.values()).filter((t) => t.category === category);
    },

    getByRiskLevel(riskLevel: ToolRiskLevel): ToolDefinition[] {
      return Array.from(tools.values()).filter((t) => t.riskLevel === riskLevel);
    },

    list(): ToolDefinition[] {
      return Array.from(tools.values());
    },

    hasPermission(toolId: string, permission: string): boolean {
      const tool = tools.get(toolId);
      if (!tool) return false;

      return tool.permissions.some((p) => {
        // Exact match
        if (p === permission) return true;
        // Global wildcard
        if (p === '*') return true;
        // Prefix wildcard (e.g., 'read:*' matches 'read:memory')
        if (p.endsWith(':*')) {
          const prefix = p.slice(0, -1); // Remove '*', keep ':'
          return permission.startsWith(prefix);
        }
        return false;
      });
    },

    isDeprecated(toolId: string): boolean {
      const tool = tools.get(toolId);
      return tool?.deprecated ?? false;
    },
  };
}
