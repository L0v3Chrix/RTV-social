/**
 * RTV Task Orchestrator - Task Registry
 * 
 * Complete registry of all 121 tasks with dependencies
 */

import { Task, Sprint, Agent, Complexity } from './types.js';

interface TaskDefinition {
  id: string;
  name: string;
  sprint: Sprint;
  agent: Agent;
  complexity: Complexity;
  estimatedHours: number;
  dependencies: string[];
  blocks: string[];
  tags: string[];
  promptFile: string;
}

// Complete task registry - all 121 tasks
export const TASK_DEFINITIONS: TaskDefinition[] = [
  // ═══════════════════════════════════════════════════════════════
  // SPRINT 0: Foundation (20 tasks)
  // ═══════════════════════════════════════════════════════════════
  
  // Agent A: Repository & Core Packages
  {
    id: 'S0-A1',
    name: 'Initialize Monorepo Structure',
    sprint: 0,
    agent: 'A',
    complexity: 'medium',
    estimatedHours: 3,
    dependencies: [],
    blocks: ['S0-A2', 'S0-A3', 'S0-A4', 'S0-A5', 'S0-B1', 'S0-C1'],
    tags: ['infrastructure', 'monorepo', 'turborepo'],
    promptFile: 'sprint-0/S0-A1-monorepo-scaffold.md'
  },
  {
    id: 'S0-A2',
    name: 'Configure TypeScript',
    sprint: 0,
    agent: 'A',
    complexity: 'low',
    estimatedHours: 2,
    dependencies: ['S0-A1'],
    blocks: [],
    tags: ['typescript', 'config'],
    promptFile: 'sprint-0/S0-A2-typescript-config.md'
  },
  {
    id: 'S0-A3',
    name: 'Scaffold Core Packages',
    sprint: 0,
    agent: 'A',
    complexity: 'medium',
    estimatedHours: 4,
    dependencies: ['S0-A1'],
    blocks: ['S0-D1'],
    tags: ['packages', 'core'],
    promptFile: 'sprint-0/S0-A3-core-packages.md'
  },
  {
    id: 'S0-A4',
    name: 'Configure ESLint + Prettier',
    sprint: 0,
    agent: 'A',
    complexity: 'low',
    estimatedHours: 2,
    dependencies: ['S0-A1'],
    blocks: [],
    tags: ['linting', 'formatting'],
    promptFile: 'sprint-0/S0-A4-linting-setup.md'
  },
  {
    id: 'S0-A5',
    name: 'Shared tsconfig Inheritance',
    sprint: 0,
    agent: 'A',
    complexity: 'low',
    estimatedHours: 1,
    dependencies: ['S0-A1'],
    blocks: [],
    tags: ['typescript', 'config'],
    promptFile: 'sprint-0/S0-A5-tsconfig-inheritance.md'
  },
  
  // Agent B: Database Schema
  {
    id: 'S0-B1',
    name: 'Postgres Connection Pool',
    sprint: 0,
    agent: 'B',
    complexity: 'medium',
    estimatedHours: 3,
    dependencies: ['S0-A1'],
    blocks: ['S0-B2'],
    tags: ['database', 'postgres'],
    promptFile: 'sprint-0/S0-B1-postgres-connection.md'
  },
  {
    id: 'S0-B2',
    name: 'Core Schema Tables',
    sprint: 0,
    agent: 'B',
    complexity: 'medium',
    estimatedHours: 4,
    dependencies: ['S0-B1'],
    blocks: ['S0-B3', 'S0-B4'],
    tags: ['database', 'schema'],
    promptFile: 'sprint-0/S0-B2-core-schema.md'
  },
  {
    id: 'S0-B3',
    name: 'Multi-tenant Schema',
    sprint: 0,
    agent: 'B',
    complexity: 'high',
    estimatedHours: 4,
    dependencies: ['S0-B2'],
    blocks: [],
    tags: ['database', 'multi-tenant', 'security'],
    promptFile: 'sprint-0/S0-B3-multi-tenant-schema.md'
  },
  {
    id: 'S0-B4',
    name: 'Audit Event Schema',
    sprint: 0,
    agent: 'B',
    complexity: 'medium',
    estimatedHours: 3,
    dependencies: ['S0-B2'],
    blocks: ['S0-B5', 'S0-D3'],
    tags: ['database', 'audit', 'security'],
    promptFile: 'sprint-0/S0-B4-audit-schema.md'
  },
  {
    id: 'S0-B5',
    name: 'Seed Data Scripts',
    sprint: 0,
    agent: 'B',
    complexity: 'low',
    estimatedHours: 2,
    dependencies: ['S0-B4'],
    blocks: [],
    tags: ['database', 'testing'],
    promptFile: 'sprint-0/S0-B5-seed-scripts.md'
  },
  
  // Agent C: CI/CD Pipeline
  {
    id: 'S0-C1',
    name: 'GitHub Actions Workflow',
    sprint: 0,
    agent: 'C',
    complexity: 'medium',
    estimatedHours: 3,
    dependencies: ['S0-A1'],
    blocks: ['S0-C2', 'S0-C3', 'S0-C4', 'S0-C5'],
    tags: ['ci-cd', 'github'],
    promptFile: 'sprint-0/S0-C1-github-actions.md'
  },
  {
    id: 'S0-C2',
    name: 'Required Status Checks',
    sprint: 0,
    agent: 'C',
    complexity: 'low',
    estimatedHours: 2,
    dependencies: ['S0-C1'],
    blocks: [],
    tags: ['ci-cd', 'quality'],
    promptFile: 'sprint-0/S0-C2-required-checks.md'
  },
  {
    id: 'S0-C3',
    name: 'Branch Protection Rules',
    sprint: 0,
    agent: 'C',
    complexity: 'low',
    estimatedHours: 1,
    dependencies: ['S0-C1'],
    blocks: [],
    tags: ['ci-cd', 'security'],
    promptFile: 'sprint-0/S0-C3-branch-protection.md'
  },
  {
    id: 'S0-C4',
    name: 'Vercel Preview Deployments',
    sprint: 0,
    agent: 'C',
    complexity: 'medium',
    estimatedHours: 3,
    dependencies: ['S0-C1'],
    blocks: [],
    tags: ['ci-cd', 'vercel', 'deployment'],
    promptFile: 'sprint-0/S0-C4-preview-deployments.md'
  },
  {
    id: 'S0-C5',
    name: 'Environment Variable Management',
    sprint: 0,
    agent: 'C',
    complexity: 'medium',
    estimatedHours: 2,
    dependencies: ['S0-C1'],
    blocks: [],
    tags: ['ci-cd', 'config', 'secrets'],
    promptFile: 'sprint-0/S0-C5-env-variables.md'
  },
  
  // Agent D: Observability
  {
    id: 'S0-D1',
    name: 'OpenTelemetry Setup',
    sprint: 0,
    agent: 'D',
    complexity: 'high',
    estimatedHours: 4,
    dependencies: ['S0-A3'],
    blocks: ['S0-D2', 'S0-D5'],
    tags: ['observability', 'otel', 'tracing'],
    promptFile: 'sprint-0/S0-D1-opentelemetry.md'
  },
  {
    id: 'S0-D2',
    name: 'Structured Logging',
    sprint: 0,
    agent: 'D',
    complexity: 'medium',
    estimatedHours: 3,
    dependencies: ['S0-D1'],
    blocks: ['S0-D3'],
    tags: ['observability', 'logging'],
    promptFile: 'sprint-0/S0-D2-structured-logging.md'
  },
  {
    id: 'S0-D3',
    name: 'Audit Event Framework',
    sprint: 0,
    agent: 'D',
    complexity: 'high',
    estimatedHours: 4,
    dependencies: ['S0-D2', 'S0-B4'],
    blocks: ['S0-D4'],
    tags: ['observability', 'audit', 'security'],
    promptFile: 'sprint-0/S0-D3-audit-framework.md'
  },
  {
    id: 'S0-D4',
    name: 'Error Tracking (Sentry)',
    sprint: 0,
    agent: 'D',
    complexity: 'medium',
    estimatedHours: 2,
    dependencies: ['S0-D3'],
    blocks: [],
    tags: ['observability', 'errors', 'sentry'],
    promptFile: 'sprint-0/S0-D4-error-tracking.md'
  },
  {
    id: 'S0-D5',
    name: 'Metrics Collection',
    sprint: 0,
    agent: 'D',
    complexity: 'medium',
    estimatedHours: 3,
    dependencies: ['S0-D1'],
    blocks: [],
    tags: ['observability', 'metrics'],
    promptFile: 'sprint-0/S0-D5-metrics-collection.md'
  },
  
  // ═══════════════════════════════════════════════════════════════
  // SPRINT 1: Core Infrastructure (20 tasks)
  // ═══════════════════════════════════════════════════════════════
  
  // Agent A: Domain Models
  {
    id: 'S1-A1',
    name: 'Client Entity Model',
    sprint: 1,
    agent: 'A',
    complexity: 'medium',
    estimatedHours: 4,
    dependencies: ['S0-B3'],
    blocks: ['S1-A2', 'S1-A3', 'S1-A4', 'S1-A5', 'S1-B1'],
    tags: ['domain', 'entity', 'client'],
    promptFile: 'sprint-1/S1-A1-client-entity.md'
  },
  {
    id: 'S1-A2',
    name: 'BrandKit Entity Model',
    sprint: 1,
    agent: 'A',
    complexity: 'high',
    estimatedHours: 5,
    dependencies: ['S1-A1'],
    blocks: [],
    tags: ['domain', 'entity', 'brandkit'],
    promptFile: 'sprint-1/S1-A2-brandkit-entity.md'
  },
  {
    id: 'S1-A3',
    name: 'KnowledgeBase Entity Model',
    sprint: 1,
    agent: 'A',
    complexity: 'high',
    estimatedHours: 5,
    dependencies: ['S1-A1'],
    blocks: [],
    tags: ['domain', 'entity', 'kb'],
    promptFile: 'sprint-1/S1-A3-knowledgebase-entity.md'
  },
  {
    id: 'S1-A4',
    name: 'Offer Entity Model',
    sprint: 1,
    agent: 'A',
    complexity: 'medium',
    estimatedHours: 3,
    dependencies: ['S1-A1'],
    blocks: [],
    tags: ['domain', 'entity', 'offer'],
    promptFile: 'sprint-1/S1-A4-offer-entity.md'
  },
  {
    id: 'S1-A5',
    name: 'Domain Event Emission',
    sprint: 1,
    agent: 'A',
    complexity: 'medium',
    estimatedHours: 3,
    dependencies: ['S1-A1'],
    blocks: [],
    tags: ['domain', 'events'],
    promptFile: 'sprint-1/S1-A5-domain-events.md'
  },
  
  // Agent B: External Memory Layer
  {
    id: 'S1-B1',
    name: 'RLMEnv Interface',
    sprint: 1,
    agent: 'B',
    complexity: 'high',
    estimatedHours: 6,
    dependencies: ['S1-A1'],
    blocks: ['S1-B2', 'S1-B3', 'S1-B4', 'S1-B5', 'S1-D1'],
    tags: ['rlm', 'memory', 'interface'],
    promptFile: 'sprint-1/S1-B1-rlmenv-interface.md'
  },
  {
    id: 'S1-B2',
    name: 'Summary Storage System',
    sprint: 1,
    agent: 'B',
    complexity: 'medium',
    estimatedHours: 4,
    dependencies: ['S1-B1'],
    blocks: [],
    tags: ['rlm', 'memory', 'summary'],
    promptFile: 'sprint-1/S1-B2-summary-storage.md'
  },
  {
    id: 'S1-B3',
    name: 'Reference System',
    sprint: 1,
    agent: 'B',
    complexity: 'medium',
    estimatedHours: 3,
    dependencies: ['S1-B1'],
    blocks: [],
    tags: ['rlm', 'memory', 'reference'],
    promptFile: 'sprint-1/S1-B3-reference-system.md'
  },
  {
    id: 'S1-B4',
    name: 'Context Window Management',
    sprint: 1,
    agent: 'B',
    complexity: 'high',
    estimatedHours: 5,
    dependencies: ['S1-B1'],
    blocks: [],
    tags: ['rlm', 'context', 'budget'],
    promptFile: 'sprint-1/S1-B4-context-window.md'
  },
  {
    id: 'S1-B5',
    name: 'Memory Retrieval API',
    sprint: 1,
    agent: 'B',
    complexity: 'medium',
    estimatedHours: 4,
    dependencies: ['S1-B1'],
    blocks: [],
    tags: ['rlm', 'memory', 'api'],
    promptFile: 'sprint-1/S1-B5-memory-retrieval.md'
  },
  
  // Agent C: Policy Engine
  {
    id: 'S1-C1',
    name: 'Policy Definition Schema',
    sprint: 1,
    agent: 'C',
    complexity: 'medium',
    estimatedHours: 4,
    dependencies: ['S0-B3'],
    blocks: ['S1-C2', 'S1-C3', 'S1-C4', 'S1-C5'],
    tags: ['policy', 'schema'],
    promptFile: 'sprint-1/S1-C1-policy-schema.md'
  },
  {
    id: 'S1-C2',
    name: 'Approval Gate Framework',
    sprint: 1,
    agent: 'C',
    complexity: 'high',
    estimatedHours: 5,
    dependencies: ['S1-C1'],
    blocks: [],
    tags: ['policy', 'approval', 'gates'],
    promptFile: 'sprint-1/S1-C2-approval-gates.md'
  },
  {
    id: 'S1-C3',
    name: 'Kill Switch Infrastructure',
    sprint: 1,
    agent: 'C',
    complexity: 'high',
    estimatedHours: 5,
    dependencies: ['S1-C1'],
    blocks: [],
    tags: ['policy', 'safety', 'kill-switch'],
    promptFile: 'sprint-1/S1-C3-kill-switches.md'
  },
  {
    id: 'S1-C4',
    name: 'Rate Limiting Policies',
    sprint: 1,
    agent: 'C',
    complexity: 'medium',
    estimatedHours: 4,
    dependencies: ['S1-C1'],
    blocks: [],
    tags: ['policy', 'rate-limit'],
    promptFile: 'sprint-1/S1-C4-rate-limiting.md'
  },
  {
    id: 'S1-C5',
    name: 'Policy Evaluation Engine',
    sprint: 1,
    agent: 'C',
    complexity: 'high',
    estimatedHours: 6,
    dependencies: ['S1-C1'],
    blocks: ['S1-D3'],
    tags: ['policy', 'engine', 'evaluation'],
    promptFile: 'sprint-1/S1-C5-policy-evaluation.md'
  },
  
  // Agent D: Runner Skeleton
  {
    id: 'S1-D1',
    name: 'Episode Lifecycle Model',
    sprint: 1,
    agent: 'D',
    complexity: 'high',
    estimatedHours: 5,
    dependencies: ['S1-B1'],
    blocks: ['S1-D2', 'S1-D3', 'S1-D4', 'S1-D5'],
    tags: ['runner', 'episode', 'lifecycle'],
    promptFile: 'sprint-1/S1-D1-episode-lifecycle.md'
  },
  {
    id: 'S1-D2',
    name: 'Budget Enforcement',
    sprint: 1,
    agent: 'D',
    complexity: 'medium',
    estimatedHours: 4,
    dependencies: ['S1-D1'],
    blocks: [],
    tags: ['runner', 'budget', 'cost'],
    promptFile: 'sprint-1/S1-D2-budget-enforcement.md'
  },
  {
    id: 'S1-D3',
    name: 'Tool Execution Wrapper',
    sprint: 1,
    agent: 'D',
    complexity: 'high',
    estimatedHours: 6,
    dependencies: ['S1-D1', 'S1-C5'],
    blocks: [],
    tags: ['runner', 'tools', 'mcp'],
    promptFile: 'sprint-1/S1-D3-tool-wrapper.md'
  },
  {
    id: 'S1-D4',
    name: 'Runner State Machine',
    sprint: 1,
    agent: 'D',
    complexity: 'high',
    estimatedHours: 5,
    dependencies: ['S1-D1'],
    blocks: [],
    tags: ['runner', 'state-machine'],
    promptFile: 'sprint-1/S1-D4-runner-state-machine.md'
  },
  {
    id: 'S1-D5',
    name: 'Checkpoint & Resume System',
    sprint: 1,
    agent: 'D',
    complexity: 'high',
    estimatedHours: 5,
    dependencies: ['S1-D1'],
    blocks: [],
    tags: ['runner', 'checkpoint', 'resume'],
    promptFile: 'sprint-1/S1-D5-checkpoint-resume.md'
  },
  
  // ═══════════════════════════════════════════════════════════════
  // SPRINT 2: Planning + Creation (20 tasks)
  // ═══════════════════════════════════════════════════════════════
  
  // Agent A: Plan Graph System
  { id: 'S2-A1', name: 'PlanGraph Model', sprint: 2, agent: 'A', complexity: 'high', estimatedHours: 5, dependencies: ['S1-B5'], blocks: ['S2-A2', 'S2-A3', 'S2-A4', 'S2-A5'], tags: ['planning', 'graph'], promptFile: 'sprint-2/S2-A1-plangraph-model.md' },
  { id: 'S2-A2', name: 'Plan Node Types', sprint: 2, agent: 'A', complexity: 'medium', estimatedHours: 4, dependencies: ['S2-A1'], blocks: [], tags: ['planning', 'nodes'], promptFile: 'sprint-2/S2-A2-plan-node-types.md' },
  { id: 'S2-A3', name: 'Plan API Endpoints', sprint: 2, agent: 'A', complexity: 'medium', estimatedHours: 4, dependencies: ['S2-A1'], blocks: [], tags: ['planning', 'api'], promptFile: 'sprint-2/S2-A3-plan-api.md' },
  { id: 'S2-A4', name: 'Plan Versioning', sprint: 2, agent: 'A', complexity: 'medium', estimatedHours: 3, dependencies: ['S2-A1'], blocks: [], tags: ['planning', 'versioning'], promptFile: 'sprint-2/S2-A4-plan-versioning.md' },
  { id: 'S2-A5', name: 'Plan Visualization', sprint: 2, agent: 'A', complexity: 'medium', estimatedHours: 4, dependencies: ['S2-A1'], blocks: [], tags: ['planning', 'ui'], promptFile: 'sprint-2/S2-A5-plan-visualization.md' },
  
  // Agent B: Blueprint Definitions
  { id: 'S2-B1', name: 'Blueprint Schema', sprint: 2, agent: 'B', complexity: 'high', estimatedHours: 5, dependencies: ['S1-A2'], blocks: ['S2-B2', 'S2-B3', 'S2-B4', 'S2-B5'], tags: ['blueprint', 'schema'], promptFile: 'sprint-2/S2-B1-blueprint-schema.md' },
  { id: 'S2-B2', name: 'Blueprint Versioning', sprint: 2, agent: 'B', complexity: 'medium', estimatedHours: 3, dependencies: ['S2-B1'], blocks: [], tags: ['blueprint', 'versioning'], promptFile: 'sprint-2/S2-B2-blueprint-versioning.md' },
  { id: 'S2-B3', name: 'Blueprint Registry', sprint: 2, agent: 'B', complexity: 'medium', estimatedHours: 4, dependencies: ['S2-B1'], blocks: [], tags: ['blueprint', 'registry'], promptFile: 'sprint-2/S2-B3-blueprint-registry.md' },
  { id: 'S2-B4', name: 'MVP Blueprints 1-6', sprint: 2, agent: 'B', complexity: 'high', estimatedHours: 8, dependencies: ['S2-B1'], blocks: [], tags: ['blueprint', 'content'], promptFile: 'sprint-2/S2-B4-blueprints-1-6.md' },
  { id: 'S2-B5', name: 'MVP Blueprints 7-12', sprint: 2, agent: 'B', complexity: 'high', estimatedHours: 8, dependencies: ['S2-B1'], blocks: [], tags: ['blueprint', 'content'], promptFile: 'sprint-2/S2-B5-blueprints-7-12.md' },
  
  // Agent C: Copy Generation Agent
  { id: 'S2-C1', name: 'Copy Agent Prompt System', sprint: 2, agent: 'C', complexity: 'high', estimatedHours: 6, dependencies: ['S1-D4'], blocks: ['S2-C2', 'S2-C3', 'S2-C4', 'S2-C5'], tags: ['agent', 'copy', 'prompts'], promptFile: 'sprint-2/S2-C1-copy-prompts.md' },
  { id: 'S2-C2', name: 'Caption Generation', sprint: 2, agent: 'C', complexity: 'medium', estimatedHours: 4, dependencies: ['S2-C1'], blocks: [], tags: ['agent', 'copy', 'caption'], promptFile: 'sprint-2/S2-C2-caption-generation.md' },
  { id: 'S2-C3', name: 'CTA Generation', sprint: 2, agent: 'C', complexity: 'medium', estimatedHours: 3, dependencies: ['S2-C1'], blocks: [], tags: ['agent', 'copy', 'cta'], promptFile: 'sprint-2/S2-C3-cta-generation.md' },
  { id: 'S2-C4', name: 'Hook Generation', sprint: 2, agent: 'C', complexity: 'medium', estimatedHours: 4, dependencies: ['S2-C1'], blocks: [], tags: ['agent', 'copy', 'hook'], promptFile: 'sprint-2/S2-C4-hook-generation.md' },
  { id: 'S2-C5', name: 'Copy QA Scoring', sprint: 2, agent: 'C', complexity: 'high', estimatedHours: 5, dependencies: ['S2-C1'], blocks: [], tags: ['agent', 'copy', 'qa'], promptFile: 'sprint-2/S2-C5-copy-qa.md' },
  
  // Agent D: Media Generation
  { id: 'S2-D1', name: 'Image Prompt Generation', sprint: 2, agent: 'D', complexity: 'medium', estimatedHours: 4, dependencies: ['S1-D4'], blocks: ['S2-D2', 'S2-D3', 'S2-D4', 'S2-D5'], tags: ['media', 'image', 'prompts'], promptFile: 'sprint-2/S2-D1-image-prompts.md' },
  { id: 'S2-D2', name: 'Image Generation Lane', sprint: 2, agent: 'D', complexity: 'high', estimatedHours: 6, dependencies: ['S2-D1'], blocks: [], tags: ['media', 'image', 'generation'], promptFile: 'sprint-2/S2-D2-image-generation.md' },
  { id: 'S2-D3', name: 'Silent Video Generation', sprint: 2, agent: 'D', complexity: 'high', estimatedHours: 8, dependencies: ['S2-D1'], blocks: [], tags: ['media', 'video', 'generation'], promptFile: 'sprint-2/S2-D3-video-generation.md' },
  { id: 'S2-D4', name: 'Thumbnail Generation', sprint: 2, agent: 'D', complexity: 'medium', estimatedHours: 4, dependencies: ['S2-D1'], blocks: [], tags: ['media', 'thumbnail'], promptFile: 'sprint-2/S2-D4-thumbnail-generation.md' },
  { id: 'S2-D5', name: 'Media QA System', sprint: 2, agent: 'D', complexity: 'high', estimatedHours: 5, dependencies: ['S2-D1'], blocks: [], tags: ['media', 'qa'], promptFile: 'sprint-2/S2-D5-media-qa.md' },
  
  // ═══════════════════════════════════════════════════════════════
  // SPRINT 3: Scheduling + Publishing (21 tasks)
  // ═══════════════════════════════════════════════════════════════
  
  // Agent A: Calendar System
  { id: 'S3-A1', name: 'Calendar Model', sprint: 3, agent: 'A', complexity: 'high', estimatedHours: 5, dependencies: ['S2-A5'], blocks: ['S3-A2', 'S3-A3', 'S3-A4', 'S3-A5'], tags: ['calendar', 'scheduling'], promptFile: 'sprint-3/S3-A1-calendar-model.md' },
  { id: 'S3-A2', name: 'Scheduling API', sprint: 3, agent: 'A', complexity: 'medium', estimatedHours: 4, dependencies: ['S3-A1'], blocks: [], tags: ['calendar', 'api'], promptFile: 'sprint-3/S3-A2-scheduling-api.md' },
  { id: 'S3-A3', name: 'Delayed Execution', sprint: 3, agent: 'A', complexity: 'medium', estimatedHours: 4, dependencies: ['S3-A1'], blocks: [], tags: ['calendar', 'queue'], promptFile: 'sprint-3/S3-A3-delayed-execution.md' },
  { id: 'S3-A4', name: 'Conflict Detection', sprint: 3, agent: 'A', complexity: 'medium', estimatedHours: 3, dependencies: ['S3-A1'], blocks: [], tags: ['calendar', 'validation'], promptFile: 'sprint-3/S3-A4-conflict-detection.md' },
  { id: 'S3-A5', name: 'Calendar Visualization', sprint: 3, agent: 'A', complexity: 'medium', estimatedHours: 4, dependencies: ['S3-A1'], blocks: [], tags: ['calendar', 'ui'], promptFile: 'sprint-3/S3-A5-calendar-visualization.md' },
  
  // Agent B: API Lane Connectors (6 tasks)
  { id: 'S3-B1', name: 'Meta Facebook Connector', sprint: 3, agent: 'B', complexity: 'high', estimatedHours: 6, dependencies: ['S2-B5'], blocks: [], tags: ['connector', 'meta', 'facebook'], promptFile: 'sprint-3/S3-B1-meta-facebook.md' },
  { id: 'S3-B2', name: 'Meta Instagram Connector', sprint: 3, agent: 'B', complexity: 'high', estimatedHours: 6, dependencies: ['S2-B5'], blocks: [], tags: ['connector', 'meta', 'instagram'], promptFile: 'sprint-3/S3-B2-meta-instagram.md' },
  { id: 'S3-B3', name: 'TikTok Connector', sprint: 3, agent: 'B', complexity: 'high', estimatedHours: 6, dependencies: ['S2-B5'], blocks: [], tags: ['connector', 'tiktok'], promptFile: 'sprint-3/S3-B3-tiktok.md' },
  { id: 'S3-B4', name: 'YouTube Connector', sprint: 3, agent: 'B', complexity: 'high', estimatedHours: 6, dependencies: ['S2-B5'], blocks: [], tags: ['connector', 'youtube'], promptFile: 'sprint-3/S3-B4-youtube.md' },
  { id: 'S3-B5', name: 'LinkedIn Connector', sprint: 3, agent: 'B', complexity: 'high', estimatedHours: 5, dependencies: ['S2-B5'], blocks: [], tags: ['connector', 'linkedin'], promptFile: 'sprint-3/S3-B5-linkedin.md' },
  { id: 'S3-B6', name: 'X/Twitter Connector', sprint: 3, agent: 'B', complexity: 'high', estimatedHours: 5, dependencies: ['S2-B5'], blocks: [], tags: ['connector', 'x', 'twitter'], promptFile: 'sprint-3/S3-B6-x-twitter.md' },
  
  // Agent C: Browser Lane Runner
  { id: 'S3-C1', name: 'Profile Vault', sprint: 3, agent: 'C', complexity: 'high', estimatedHours: 8, dependencies: ['S0-B3', 'S1-A1'], blocks: ['S3-C2', 'S3-C3', 'S3-C4', 'S3-C5'], tags: ['browser', 'profile', 'vault'], promptFile: 'sprint-3/S3-C1-profile-vault.md' },
  { id: 'S3-C2', name: 'Session Isolation', sprint: 3, agent: 'C', complexity: 'high', estimatedHours: 6, dependencies: ['S3-C1'], blocks: [], tags: ['browser', 'isolation', 'security'], promptFile: 'sprint-3/S3-C2-browser-isolation.md' },
  { id: 'S3-C3', name: 'Skool Automation', sprint: 3, agent: 'C', complexity: 'high', estimatedHours: 8, dependencies: ['S3-C1'], blocks: [], tags: ['browser', 'skool', 'automation'], promptFile: 'sprint-3/S3-C3-skool-connector.md' },
  { id: 'S3-C4', name: 'Story Posting Fallback', sprint: 3, agent: 'C', complexity: 'high', estimatedHours: 6, dependencies: ['S3-C1'], blocks: [], tags: ['browser', 'stories', 'fallback'], promptFile: 'sprint-3/S3-C4-stories-connector.md' },
  { id: 'S3-C5', name: 'Artifact Capture', sprint: 3, agent: 'C', complexity: 'medium', estimatedHours: 4, dependencies: ['S3-C1'], blocks: [], tags: ['browser', 'artifacts', 'proof'], promptFile: 'sprint-3/S3-C5-browser-artifacts.md' },
  
  // Agent D: Publish Verification
  { id: 'S3-D1', name: 'Post Verification API', sprint: 3, agent: 'D', complexity: 'high', estimatedHours: 5, dependencies: ['S3-B1'], blocks: ['S3-D2', 'S3-D3', 'S3-D4', 'S3-D5'], tags: ['verification', 'api'], promptFile: 'sprint-3/S3-D1-api-verification.md' },
  { id: 'S3-D2', name: 'Proof Capture System', sprint: 3, agent: 'D', complexity: 'medium', estimatedHours: 4, dependencies: ['S3-D1'], blocks: [], tags: ['verification', 'proof'], promptFile: 'sprint-3/S3-D2-proof-capture.md' },
  { id: 'S3-D3', name: 'Retry Logic', sprint: 3, agent: 'D', complexity: 'medium', estimatedHours: 4, dependencies: ['S3-D1'], blocks: [], tags: ['verification', 'retry'], promptFile: 'sprint-3/S3-D3-retry-logic.md' },
  { id: 'S3-D4', name: 'Failure Classification', sprint: 3, agent: 'D', complexity: 'medium', estimatedHours: 3, dependencies: ['S3-D1'], blocks: [], tags: ['verification', 'errors'], promptFile: 'sprint-3/S3-D4-failure-classification.md' },
  { id: 'S3-D5', name: 'Rollback Handling', sprint: 3, agent: 'D', complexity: 'high', estimatedHours: 5, dependencies: ['S3-D1'], blocks: [], tags: ['verification', 'rollback'], promptFile: 'sprint-3/S3-D5-rollback-handling.md' },
  
  // ═══════════════════════════════════════════════════════════════
  // SPRINT 4: Engagement (20 tasks)
  // ═══════════════════════════════════════════════════════════════
  
  // Agent A: Event Ingestion
  { id: 'S4-A1', name: 'Webhook Receiver', sprint: 4, agent: 'A', complexity: 'high', estimatedHours: 5, dependencies: ['S3-D5'], blocks: ['S4-A2', 'S4-A3', 'S4-A4', 'S4-A5'], tags: ['engagement', 'webhook'], promptFile: 'sprint-4/S4-A1-webhook-receiver.md' },
  { id: 'S4-A2', name: 'Polling System', sprint: 4, agent: 'A', complexity: 'medium', estimatedHours: 4, dependencies: ['S4-A1'], blocks: [], tags: ['engagement', 'polling'], promptFile: 'sprint-4/S4-A2-polling-system.md' },
  { id: 'S4-A3', name: 'Event Normalization', sprint: 4, agent: 'A', complexity: 'medium', estimatedHours: 4, dependencies: ['S4-A1'], blocks: [], tags: ['engagement', 'normalization'], promptFile: 'sprint-4/S4-A3-event-normalization.md' },
  { id: 'S4-A4', name: 'Deduplication', sprint: 4, agent: 'A', complexity: 'medium', estimatedHours: 3, dependencies: ['S4-A1'], blocks: [], tags: ['engagement', 'dedupe'], promptFile: 'sprint-4/S4-A4-deduplication.md' },
  { id: 'S4-A5', name: 'Event Routing', sprint: 4, agent: 'A', complexity: 'medium', estimatedHours: 4, dependencies: ['S4-A1'], blocks: [], tags: ['engagement', 'routing'], promptFile: 'sprint-4/S4-A5-event-routing.md' },
  
  // Agent B: Conversation Thread Model
  { id: 'S4-B1', name: 'Thread Entity Model', sprint: 4, agent: 'B', complexity: 'high', estimatedHours: 5, dependencies: ['S3-D5'], blocks: ['S4-B2', 'S4-B3', 'S4-B4', 'S4-B5'], tags: ['engagement', 'thread'], promptFile: 'sprint-4/S4-B1-thread-entity.md' },
  { id: 'S4-B2', name: 'ThreadSummary System', sprint: 4, agent: 'B', complexity: 'high', estimatedHours: 6, dependencies: ['S4-B1'], blocks: [], tags: ['engagement', 'summary'], promptFile: 'sprint-4/S4-B2-thread-summary.md' },
  { id: 'S4-B3', name: 'Participant Tracking', sprint: 4, agent: 'B', complexity: 'medium', estimatedHours: 4, dependencies: ['S4-B1'], blocks: [], tags: ['engagement', 'participant'], promptFile: 'sprint-4/S4-B3-participant-tracking.md' },
  { id: 'S4-B4', name: 'Thread State Machine', sprint: 4, agent: 'B', complexity: 'high', estimatedHours: 5, dependencies: ['S4-B1'], blocks: [], tags: ['engagement', 'state-machine'], promptFile: 'sprint-4/S4-B4-thread-state-machine.md' },
  { id: 'S4-B5', name: 'Thread Retrieval API', sprint: 4, agent: 'B', complexity: 'medium', estimatedHours: 4, dependencies: ['S4-B1'], blocks: [], tags: ['engagement', 'api'], promptFile: 'sprint-4/S4-B5-thread-retrieval.md' },
  
  // Agent C: Reply Drafting Agent
  { id: 'S4-C1', name: 'Reply Agent Prompt System', sprint: 4, agent: 'C', complexity: 'high', estimatedHours: 6, dependencies: ['S4-B5'], blocks: ['S4-C2', 'S4-C3', 'S4-C4', 'S4-C5'], tags: ['engagement', 'agent', 'reply'], promptFile: 'sprint-4/S4-C1-reply-prompts.md' },
  { id: 'S4-C2', name: 'Safe Response Generation', sprint: 4, agent: 'C', complexity: 'high', estimatedHours: 5, dependencies: ['S4-C1'], blocks: [], tags: ['engagement', 'safety'], promptFile: 'sprint-4/S4-C2-safe-response.md' },
  { id: 'S4-C3', name: 'Auto-Like with Throttling', sprint: 4, agent: 'C', complexity: 'medium', estimatedHours: 3, dependencies: ['S4-C1'], blocks: [], tags: ['engagement', 'like'], promptFile: 'sprint-4/S4-C3-auto-like.md' },
  { id: 'S4-C4', name: 'Comment Reply Drafts', sprint: 4, agent: 'C', complexity: 'medium', estimatedHours: 4, dependencies: ['S4-C1'], blocks: [], tags: ['engagement', 'comment'], promptFile: 'sprint-4/S4-C4-comment-drafts.md' },
  { id: 'S4-C5', name: 'DM Reply Drafts', sprint: 4, agent: 'C', complexity: 'high', estimatedHours: 5, dependencies: ['S4-C1'], blocks: [], tags: ['engagement', 'dm'], promptFile: 'sprint-4/S4-C5-dm-drafts.md' },
  
  // Agent D: Escalation System
  { id: 'S4-D1', name: 'Escalation Triggers', sprint: 4, agent: 'D', complexity: 'high', estimatedHours: 5, dependencies: ['S4-C5'], blocks: ['S4-D2', 'S4-D3', 'S4-D4', 'S4-D5'], tags: ['escalation', 'triggers'], promptFile: 'sprint-4/S4-D1-escalation-triggers.md' },
  { id: 'S4-D2', name: 'Human Handoff Workflow', sprint: 4, agent: 'D', complexity: 'high', estimatedHours: 6, dependencies: ['S4-D1'], blocks: [], tags: ['escalation', 'handoff'], promptFile: 'sprint-4/S4-D2-human-handoff.md' },
  { id: 'S4-D3', name: 'Escalation Queue', sprint: 4, agent: 'D', complexity: 'medium', estimatedHours: 4, dependencies: ['S4-D1'], blocks: [], tags: ['escalation', 'queue'], promptFile: 'sprint-4/S4-D3-escalation-queue.md' },
  { id: 'S4-D4', name: 'Resolution Tracking', sprint: 4, agent: 'D', complexity: 'medium', estimatedHours: 4, dependencies: ['S4-D1'], blocks: [], tags: ['escalation', 'resolution'], promptFile: 'sprint-4/S4-D4-resolution-tracking.md' },
  { id: 'S4-D5', name: 'Escalation Metrics', sprint: 4, agent: 'D', complexity: 'medium', estimatedHours: 3, dependencies: ['S4-D1'], blocks: [], tags: ['escalation', 'metrics'], promptFile: 'sprint-4/S4-D5-escalation-metrics.md' },
  
  // ═══════════════════════════════════════════════════════════════
  // SPRINT 5: Gated Rollout (20 tasks)
  // ═══════════════════════════════════════════════════════════════
  
  // Agent A: House Account Testing
  { id: 'S5-A1', name: 'House Account Setup', sprint: 5, agent: 'A', complexity: 'medium', estimatedHours: 4, dependencies: ['S4-D5'], blocks: ['S5-A2', 'S5-A3', 'S5-A4', 'S5-A5'], tags: ['testing', 'house-account'], promptFile: 'sprint-5/S5-A1-house-account-setup.md' },
  { id: 'S5-A2', name: 'Sandbox Mode Config', sprint: 5, agent: 'A', complexity: 'medium', estimatedHours: 3, dependencies: ['S5-A1'], blocks: [], tags: ['testing', 'sandbox'], promptFile: 'sprint-5/S5-A2-sandbox-mode.md' },
  { id: 'S5-A3', name: 'E2E Test Suite', sprint: 5, agent: 'A', complexity: 'high', estimatedHours: 8, dependencies: ['S5-A1'], blocks: [], tags: ['testing', 'e2e'], promptFile: 'sprint-5/S5-A3-e2e-test-suite.md' },
  { id: 'S5-A4', name: 'Performance Benchmarking', sprint: 5, agent: 'A', complexity: 'medium', estimatedHours: 4, dependencies: ['S5-A1'], blocks: [], tags: ['testing', 'performance'], promptFile: 'sprint-5/S5-A4-performance-benchmarking.md' },
  { id: 'S5-A5', name: 'Error Scenario Testing', sprint: 5, agent: 'A', complexity: 'high', estimatedHours: 5, dependencies: ['S5-A1'], blocks: [], tags: ['testing', 'errors'], promptFile: 'sprint-5/S5-A5-error-scenario-testing.md' },
  
  // Agent B: Canary Configuration
  { id: 'S5-B1', name: 'Canary Client Selection', sprint: 5, agent: 'B', complexity: 'medium', estimatedHours: 3, dependencies: ['S4-D5'], blocks: ['S5-B2', 'S5-B3', 'S5-B4', 'S5-B5'], tags: ['rollout', 'canary'], promptFile: 'sprint-5/S5-B1-canary-selection.md' },
  { id: 'S5-B2', name: 'Feature Flag Setup', sprint: 5, agent: 'B', complexity: 'high', estimatedHours: 6, dependencies: ['S5-B1'], blocks: [], tags: ['rollout', 'flags'], promptFile: 'sprint-5/S5-B2-feature-flags.md' },
  { id: 'S5-B3', name: 'Gradual Rollout Plan', sprint: 5, agent: 'B', complexity: 'medium', estimatedHours: 4, dependencies: ['S5-B1'], blocks: [], tags: ['rollout', 'gradual'], promptFile: 'sprint-5/S5-B3-gradual-rollout.md' },
  { id: 'S5-B4', name: 'Rollback Triggers', sprint: 5, agent: 'B', complexity: 'high', estimatedHours: 5, dependencies: ['S5-B1'], blocks: [], tags: ['rollout', 'rollback'], promptFile: 'sprint-5/S5-B4-rollback-triggers.md' },
  { id: 'S5-B5', name: 'Client Communication', sprint: 5, agent: 'B', complexity: 'low', estimatedHours: 2, dependencies: ['S5-B1'], blocks: [], tags: ['rollout', 'communication'], promptFile: 'sprint-5/S5-B5-client-communication.md' },
  
  // Agent C: Kill Switch Implementation
  { id: 'S5-C1', name: 'Global Kill Switch', sprint: 5, agent: 'C', complexity: 'high', estimatedHours: 5, dependencies: ['S1-C3'], blocks: ['S5-C2', 'S5-C3', 'S5-C4', 'S5-C5'], tags: ['safety', 'kill-switch', 'global'], promptFile: 'sprint-5/S5-C1-global-kill-switch.md' },
  { id: 'S5-C2', name: 'Per-Client Kill Switch', sprint: 5, agent: 'C', complexity: 'medium', estimatedHours: 4, dependencies: ['S5-C1'], blocks: [], tags: ['safety', 'kill-switch', 'client'], promptFile: 'sprint-5/S5-C2-per-client-kill-switch.md' },
  { id: 'S5-C3', name: 'Per-Platform Kill Switch', sprint: 5, agent: 'C', complexity: 'medium', estimatedHours: 4, dependencies: ['S5-C1'], blocks: [], tags: ['safety', 'kill-switch', 'platform'], promptFile: 'sprint-5/S5-C3-per-platform-kill-switch.md' },
  { id: 'S5-C4', name: 'Per-Action Kill Switch', sprint: 5, agent: 'C', complexity: 'medium', estimatedHours: 4, dependencies: ['S5-C1'], blocks: [], tags: ['safety', 'kill-switch', 'action'], promptFile: 'sprint-5/S5-C4-per-action-kill-switch.md' },
  { id: 'S5-C5', name: 'Kill Switch Dashboard', sprint: 5, agent: 'C', complexity: 'medium', estimatedHours: 5, dependencies: ['S5-C1'], blocks: [], tags: ['safety', 'kill-switch', 'ui'], promptFile: 'sprint-5/S5-C5-kill-switch-dashboard.md' },
  
  // Agent D: Full E2E Test Suite
  { id: 'S5-D1', name: 'Planning E2E Tests', sprint: 5, agent: 'D', complexity: 'high', estimatedHours: 6, dependencies: ['S5-A3'], blocks: ['S5-D2', 'S5-D3', 'S5-D4', 'S5-D5'], tags: ['testing', 'e2e', 'planning'], promptFile: 'sprint-5/S5-D1-planning-e2e-tests.md' },
  { id: 'S5-D2', name: 'Creation E2E Tests', sprint: 5, agent: 'D', complexity: 'high', estimatedHours: 6, dependencies: ['S5-D1'], blocks: [], tags: ['testing', 'e2e', 'creation'], promptFile: 'sprint-5/S5-D2-creation-e2e-tests.md' },
  { id: 'S5-D3', name: 'Publishing E2E Tests', sprint: 5, agent: 'D', complexity: 'high', estimatedHours: 8, dependencies: ['S5-D1'], blocks: [], tags: ['testing', 'e2e', 'publishing'], promptFile: 'sprint-5/S5-D3-publishing-e2e-tests.md' },
  { id: 'S5-D4', name: 'Engagement E2E Tests', sprint: 5, agent: 'D', complexity: 'high', estimatedHours: 6, dependencies: ['S5-D1'], blocks: [], tags: ['testing', 'e2e', 'engagement'], promptFile: 'sprint-5/S5-D4-engagement-e2e-tests.md' },
  { id: 'S5-D5', name: 'Multi-Tenant E2E Tests', sprint: 5, agent: 'D', complexity: 'high', estimatedHours: 6, dependencies: ['S5-D1'], blocks: [], tags: ['testing', 'e2e', 'multi-tenant'], promptFile: 'sprint-5/S5-D5-multi-tenant-e2e-tests.md' },
];

export function getTaskDefinitions(): TaskDefinition[] {
  return TASK_DEFINITIONS;
}

export function getTaskById(id: string): TaskDefinition | undefined {
  return TASK_DEFINITIONS.find(t => t.id === id);
}

export function getTasksBySprint(sprint: Sprint): TaskDefinition[] {
  return TASK_DEFINITIONS.filter(t => t.sprint === sprint);
}

export function getTasksByAgent(sprint: Sprint, agent: Agent): TaskDefinition[] {
  return TASK_DEFINITIONS.filter(t => t.sprint === sprint && t.agent === agent);
}
