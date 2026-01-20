/**
 * S1-D4: Runner State Machine Types
 *
 * Type definitions for the runner state machine that orchestrates
 * episode execution through the perceive-plan-act-observe loop.
 */

import { z } from 'zod';
import type { Episode, EpisodeBudget, EpisodeCheckpoint } from '../episode/types.js';

// =====================
// Runner States
// =====================

/**
 * All possible runner states.
 */
export const RunnerStates = [
  'idle',
  'initializing',
  'running',
  'perceiving',
  'planning',
  'acting',
  'observing',
  'suspended',
  'completed',
  'failed',
] as const;

export type RunnerState = (typeof RunnerStates)[number];

// =====================
// Runner Events
// =====================

/**
 * START event - begin a new episode.
 */
export const StartEventSchema = z.object({
  type: z.literal('START'),
  payload: z.object({
    agentType: z.string(),
    taskType: z.string(),
    clientId: z.string(),
    parentEpisodeId: z.string().optional(),
    budget: z.custom<EpisodeBudget>().optional(),
    inputs: z.record(z.unknown()).optional(),
  }),
});

/**
 * PERCEIVE event - start perception phase.
 */
export const PerceiveEventSchema = z.object({
  type: z.literal('PERCEIVE'),
  payload: z.object({
    session: z.unknown(),
    query: z.string().optional(),
  }),
});

/**
 * PERCEIVE_COMPLETE event - perception phase completed.
 */
export const PerceiveCompleteEventSchema = z.object({
  type: z.literal('PERCEIVE_COMPLETE'),
  payload: z.object({
    context: z.unknown().optional(),
  }),
});

/**
 * PLAN event - start planning phase.
 */
export const PlanEventSchema = z.object({
  type: z.literal('PLAN'),
  payload: z.object({
    prompt: z.string(),
    context: z.unknown().optional(),
  }),
});

/**
 * PLAN_COMPLETE event - planning phase completed.
 */
export const PlanCompleteEventSchema = z.object({
  type: z.literal('PLAN_COMPLETE'),
  payload: z.object({
    plan: z.array(z.unknown()),
  }),
});

/**
 * ACT event - start action phase.
 */
export const ActEventSchema = z.object({
  type: z.literal('ACT'),
  payload: z.object({
    toolId: z.string(),
    input: z.record(z.unknown()),
  }),
});

/**
 * ACT_COMPLETE event - action phase completed.
 */
export const ActCompleteEventSchema = z.object({
  type: z.literal('ACT_COMPLETE'),
  payload: z.object({
    result: z.unknown().optional(),
  }),
});

/**
 * OBSERVE event - start observation phase.
 */
export const ObserveEventSchema = z.object({
  type: z.literal('OBSERVE'),
  payload: z.object({
    session: z.unknown().optional(),
    result: z.unknown(),
  }),
});

/**
 * OBSERVE_COMPLETE event - observation phase completed.
 */
export const ObserveCompleteEventSchema = z.object({
  type: z.literal('OBSERVE_COMPLETE'),
  payload: z.object({
    observation: z.unknown().optional(),
  }),
});

/**
 * SUSPEND event - suspend execution.
 */
export const SuspendEventSchema = z.object({
  type: z.literal('SUSPEND'),
  payload: z.object({
    reason: z.string(),
    checkpoint: z.custom<EpisodeCheckpoint>().optional(),
  }),
});

/**
 * RESUME event - resume execution.
 */
export const ResumeEventSchema = z.object({
  type: z.literal('RESUME'),
  payload: z.object({
    fromCheckpoint: z.boolean().optional(),
  }),
});

/**
 * COMPLETE event - complete the episode.
 */
export const CompleteEventSchema = z.object({
  type: z.literal('COMPLETE'),
  payload: z.object({
    outputs: z.record(z.unknown()),
  }),
});

/**
 * FAIL event - fail the episode.
 */
export const FailEventSchema = z.object({
  type: z.literal('FAIL'),
  payload: z.object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  }),
});

/**
 * BUDGET_WARNING event - budget threshold crossed.
 */
export const BudgetWarningEventSchema = z.object({
  type: z.literal('BUDGET_WARNING'),
  payload: z.object({
    type: z.enum(['tokens', 'time', 'retries', 'subcalls', 'toolCalls']),
    usage: z.number(),
    limit: z.number(),
  }),
});

/**
 * BUDGET_EXCEEDED event - budget limit exceeded.
 */
export const BudgetExceededEventSchema = z.object({
  type: z.literal('BUDGET_EXCEEDED'),
  payload: z.object({
    type: z.enum(['tokens', 'time', 'retries', 'subcalls', 'toolCalls']),
  }),
});

/**
 * Union of all runner events.
 */
export const RunnerEventSchema = z.discriminatedUnion('type', [
  StartEventSchema,
  PerceiveEventSchema,
  PerceiveCompleteEventSchema,
  PlanEventSchema,
  PlanCompleteEventSchema,
  ActEventSchema,
  ActCompleteEventSchema,
  ObserveEventSchema,
  ObserveCompleteEventSchema,
  SuspendEventSchema,
  ResumeEventSchema,
  CompleteEventSchema,
  FailEventSchema,
  BudgetWarningEventSchema,
  BudgetExceededEventSchema,
]);

export type RunnerEvent = z.infer<typeof RunnerEventSchema>;

// =====================
// Runner Context
// =====================

/**
 * Current phase in the RLM loop.
 */
export type RunnerPhase = 'perceive' | 'plan' | 'act' | 'observe' | null;

/**
 * Runner context containing execution state.
 */
export interface RunnerContext {
  /** Current episode being executed */
  episode: Episode | null;
  /** Current phase in the RLM loop */
  currentPhase: RunnerPhase;
  /** Accumulated data from phases */
  phaseData: Record<string, unknown>;
  /** Number of complete loops through perceive-plan-act-observe */
  loopCount: number;
  /** Last error if failed */
  lastError: { code: string; message: string } | null;
}

// =====================
// State Transitions
// =====================

/**
 * Valid transitions from each state.
 */
export const ValidTransitions: Record<RunnerState, RunnerEvent['type'][]> = {
  idle: ['START'],
  initializing: ['PERCEIVE', 'PLAN', 'ACT', 'FAIL'],
  running: [
    'PERCEIVE',
    'PLAN',
    'ACT',
    'OBSERVE',
    'SUSPEND',
    'COMPLETE',
    'FAIL',
    'BUDGET_WARNING',
    'BUDGET_EXCEEDED',
  ],
  perceiving: ['PERCEIVE_COMPLETE', 'SUSPEND', 'FAIL', 'BUDGET_WARNING', 'BUDGET_EXCEEDED'],
  planning: ['PLAN_COMPLETE', 'SUSPEND', 'FAIL', 'BUDGET_WARNING', 'BUDGET_EXCEEDED'],
  acting: ['ACT_COMPLETE', 'SUSPEND', 'FAIL', 'BUDGET_WARNING', 'BUDGET_EXCEEDED'],
  observing: ['OBSERVE_COMPLETE', 'SUSPEND', 'FAIL', 'BUDGET_WARNING', 'BUDGET_EXCEEDED'],
  suspended: ['RESUME', 'FAIL'],
  completed: [],
  failed: [],
};

// =====================
// High-Risk Tools
// =====================

/**
 * Tool ID prefixes that require policy checks.
 */
export const HighRiskToolPrefixes = [
  'social.publish',
  'social.reply',
  'payment',
  'data.delete',
] as const;

/**
 * Check if a tool ID is high-risk.
 */
export function isHighRiskTool(toolId: string): boolean {
  return HighRiskToolPrefixes.some((prefix) => toolId.startsWith(prefix));
}
