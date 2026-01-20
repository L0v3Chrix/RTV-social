/**
 * @rtv/runner Tools Module
 *
 * Tool abstraction layer with:
 * - Type definitions for tool invocations
 * - Tool registry for definitions
 * - Tool wrapper for execution with guards
 */

export {
  // Schemas
  ToolRiskLevelSchema,
  ToolCategorySchema,
  RetryPolicySchema,
  BudgetCostSchema,
  ToolDefinitionSchema,
  ToolInvocationContextSchema,
  ToolInvocationSchema,
  ToolErrorSchema,
  ToolResultSchema,
  // Types
  type ToolRiskLevel,
  type ToolCategory,
  type RetryPolicy,
  type BudgetCost,
  type ToolDefinition,
  type ToolInvocationContext,
  type ToolInvocation,
  type ToolError,
  type ToolResult,
  type ToolHandler,
} from './types.js';

export { createToolRegistry, type ToolRegistry } from './tool-registry.js';

export {
  createToolWrapper,
  type ToolWrapper,
  type ToolWrapperDeps,
  type PolicyEngine,
} from './tool-wrapper.js';
