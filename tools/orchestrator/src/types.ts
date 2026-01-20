/**
 * RTV Task Orchestrator - Type Definitions
 * 
 * Core types for managing the 121-task build across 6 sprints
 */

export type TaskStatus = 
  | 'pending'      // Not started
  | 'ready'        // Dependencies met, can be dispatched
  | 'in_progress'  // Currently being worked on
  | 'review'       // Completed, awaiting verification
  | 'complete'     // Done and verified
  | 'blocked'      // Waiting on dependency
  | 'failed';      // Encountered unresolvable issue

export type TestStatus = 
  | 'not_written'  // Tests not yet created
  | 'failing'      // Tests written but failing (RED phase)
  | 'passing';     // All tests passing (GREEN phase)

export type Sprint = 0 | 1 | 2 | 3 | 4 | 5;

export type Agent = 'A' | 'B' | 'C' | 'D';

export type Complexity = 'low' | 'medium' | 'high';

export interface Task {
  id: string;                    // e.g., "S0-A1"
  name: string;                  // e.g., "Initialize Monorepo Structure"
  sprint: Sprint;
  agent: Agent;
  status: TaskStatus;
  testStatus: TestStatus;
  complexity: Complexity;
  estimatedHours: number;
  dependencies: string[];        // Task IDs this depends on
  blocks: string[];              // Task IDs blocked by this
  tags: string[];
  acceptanceCriteria: string[];
  specReferences: string[];
  promptFile: string;            // Path to build prompt markdown
  
  // Runtime tracking
  assignedTo?: string;           // Agent instance ID
  startedAt?: Date;
  completedAt?: Date;
  actualHours?: number;
  notes?: string[];
  artifacts?: string[];          // Paths to created files
}

export interface TaskGraph {
  tasks: Map<string, Task>;
  sprints: Map<Sprint, string[]>;  // Sprint -> Task IDs
  agentTracks: Map<string, string[]>; // "S0-A" -> Task IDs in order
}

export interface SprintStatus {
  sprint: Sprint;
  name: string;
  totalTasks: number;
  completed: number;
  inProgress: number;
  ready: number;
  blocked: number;
  pending: number;
  failed: number;
  percentComplete: number;
  estimatedHoursRemaining: number;
  canStart: boolean;
}

export interface AgentAssignment {
  agentId: string;               // e.g., "agent-A-001"
  agentType: Agent;
  currentTask?: string;
  completedTasks: string[];
  startedAt: Date;
  lastActivityAt: Date;
}

export interface OrchestratorState {
  version: string;
  projectPath: string;
  currentSprint: Sprint;
  tasks: Record<string, Task>;
  agents: Record<string, AgentAssignment>;
  history: HistoryEntry[];
  lastUpdated: Date;
}

export interface HistoryEntry {
  timestamp: Date;
  action: 'dispatch' | 'complete' | 'fail' | 'reset' | 'note';
  taskId: string;
  agentId?: string;
  details?: string;
}

export interface DispatchResult {
  success: boolean;
  taskId?: string;
  agentId?: string;
  promptPath?: string;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Sprint metadata
export const SPRINT_NAMES: Record<Sprint, string> = {
  0: 'Foundation',
  1: 'Core Infrastructure',
  2: 'Planning + Creation',
  3: 'Scheduling + Publishing',
  4: 'Engagement',
  5: 'Gated Rollout'
};

// Agent track descriptions
export const AGENT_TRACKS: Record<Sprint, Record<Agent, string>> = {
  0: {
    A: 'Repository & Core Packages',
    B: 'Database Schema',
    C: 'CI/CD Pipeline',
    D: 'Observability'
  },
  1: {
    A: 'Domain Models',
    B: 'External Memory Layer',
    C: 'Policy Engine',
    D: 'Runner Skeleton'
  },
  2: {
    A: 'Plan Graph System',
    B: 'Blueprint Definitions',
    C: 'Copy Generation Agent',
    D: 'Media Generation'
  },
  3: {
    A: 'Calendar System',
    B: 'API Lane Connectors',
    C: 'Browser Lane Runner',
    D: 'Publish Verification'
  },
  4: {
    A: 'Event Ingestion',
    B: 'Conversation Thread Model',
    C: 'Reply Drafting Agent',
    D: 'Escalation System'
  },
  5: {
    A: 'House Account Testing',
    B: 'Canary Configuration',
    C: 'Kill Switch Implementation',
    D: 'Full E2E Test Suite'
  }
};
