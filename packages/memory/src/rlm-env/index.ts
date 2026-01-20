/**
 * RLMEnv - Recursive Language Model Environment
 *
 * External memory management for LLM agents.
 */

export { createRlmEnv } from './env.js';

export type {
  // Environment
  RlmEnv,
  RlmEnvConfig,

  // Session
  RlmSession,
  SessionStatus,
  SessionOutcome,
  SessionResult,
  StartSessionParams,

  // Spans
  Span,
  SpanRef,

  // Budget
  RetrievalBudget,
  BudgetState,

  // Operations
  RetrieveParams,
  RetrievalResult,
  PeekParams,
  PeekResult,
  SubcallParams,
  WriteParams,
  WriteResult,

  // Logging
  AccessLogEntry,
  SearchSpansParams,
} from './types.js';

export { SpanSchema, SpanRefSchema, RetrievalBudgetSchema, BudgetStateSchema } from './types.js';
