/**
 * RTV Task Orchestrator - Core Engine
 * 
 * Manages task lifecycle, dependencies, and agent coordination
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  Task,
  TaskStatus,
  TestStatus,
  Sprint,
  Agent,
  OrchestratorState,
  SprintStatus,
  AgentAssignment,
  DispatchResult,
  ValidationResult,
  HistoryEntry,
  SPRINT_NAMES,
  AGENT_TRACKS
} from './types.js';
import { TASK_DEFINITIONS, getTaskById } from './task-registry.js';

export class Orchestrator {
  private state: OrchestratorState;
  private statePath: string;
  private promptsBasePath: string;

  constructor(projectPath: string) {
    this.statePath = path.join(projectPath, 'tools', 'orchestrator', 'state.json');
    this.promptsBasePath = path.join(projectPath, 'docs', '00-overview', 'PRD-v2');
    
    this.state = {
      version: '1.0.0',
      projectPath,
      currentSprint: 0,
      tasks: {},
      agents: {},
      history: [],
      lastUpdated: new Date()
    };
  }

  /**
   * Initialize orchestrator - load or create state
   */
  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      const loaded = JSON.parse(data);
      
      // Parse dates
      loaded.lastUpdated = new Date(loaded.lastUpdated);
      loaded.history = loaded.history.map((h: any) => ({
        ...h,
        timestamp: new Date(h.timestamp)
      }));
      
      for (const task of Object.values(loaded.tasks) as Task[]) {
        if (task.startedAt) task.startedAt = new Date(task.startedAt);
        if (task.completedAt) task.completedAt = new Date(task.completedAt);
      }
      
      for (const agent of Object.values(loaded.agents) as AgentAssignment[]) {
        agent.startedAt = new Date(agent.startedAt);
        agent.lastActivityAt = new Date(agent.lastActivityAt);
      }
      
      this.state = loaded;
    } catch {
      // Initialize fresh state from task definitions
      await this.initializeFromDefinitions();
    }
  }

  /**
   * Initialize tasks from the registry
   */
  private async initializeFromDefinitions(): Promise<void> {
    for (const def of TASK_DEFINITIONS) {
      this.state.tasks[def.id] = {
        id: def.id,
        name: def.name,
        sprint: def.sprint,
        agent: def.agent,
        status: 'pending',
        testStatus: 'not_written',
        complexity: def.complexity,
        estimatedHours: def.estimatedHours,
        dependencies: def.dependencies,
        blocks: def.blocks,
        tags: def.tags,
        acceptanceCriteria: [],
        specReferences: [],
        promptFile: def.promptFile
      };
    }
    
    // Compute initial ready status
    this.updateReadyStatus();
    await this.save();
  }

  /**
   * Update which tasks are ready based on dependencies
   */
  private updateReadyStatus(): void {
    for (const task of Object.values(this.state.tasks)) {
      if (task.status !== 'pending') continue;
      
      const depsComplete = task.dependencies.every(depId => {
        const dep = this.state.tasks[depId];
        return dep && dep.status === 'complete';
      });
      
      if (depsComplete) {
        task.status = 'ready';
      }
    }
  }

  /**
   * Save state to disk
   */
  async save(): Promise<void> {
    this.state.lastUpdated = new Date();
    const dir = path.dirname(this.statePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2));
  }

  /**
   * Get sprint status summary
   */
  getSprintStatus(sprint: Sprint): SprintStatus {
    const tasks = Object.values(this.state.tasks).filter(t => t.sprint === sprint);
    
    const completed = tasks.filter(t => t.status === 'complete').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const ready = tasks.filter(t => t.status === 'ready').length;
    const blocked = tasks.filter(t => t.status === 'blocked').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    
    const remaining = tasks.filter(t => t.status !== 'complete');
    const estimatedHoursRemaining = remaining.reduce((sum, t) => sum + t.estimatedHours, 0);
    
    // Can start if previous sprint complete (or sprint 0)
    let canStart = sprint === 0;
    if (sprint > 0) {
      const prevSprintTasks = Object.values(this.state.tasks).filter(t => t.sprint === (sprint - 1) as Sprint);
      canStart = prevSprintTasks.every(t => t.status === 'complete');
    }
    
    return {
      sprint,
      name: SPRINT_NAMES[sprint],
      totalTasks: tasks.length,
      completed,
      inProgress,
      ready,
      blocked,
      pending,
      failed,
      percentComplete: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
      estimatedHoursRemaining,
      canStart
    };
  }

  /**
   * Get all sprint statuses
   */
  getAllSprintStatus(): SprintStatus[] {
    return [0, 1, 2, 3, 4, 5].map(s => this.getSprintStatus(s as Sprint));
  }

  /**
   * Get next available tasks that can be dispatched
   */
  getNextTasks(limit: number = 4): Task[] {
    return Object.values(this.state.tasks)
      .filter(t => t.status === 'ready')
      .sort((a, b) => {
        // Prioritize by sprint, then by agent track order
        if (a.sprint !== b.sprint) return a.sprint - b.sprint;
        if (a.agent !== b.agent) return a.agent.localeCompare(b.agent);
        return a.id.localeCompare(b.id);
      })
      .slice(0, limit);
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.state.tasks[taskId];
  }

  /**
   * Dispatch a task to an agent
   */
  async dispatchTask(taskId: string, agentId?: string): Promise<DispatchResult> {
    const task = this.state.tasks[taskId];
    
    if (!task) {
      return { success: false, error: `Task ${taskId} not found` };
    }
    
    if (task.status !== 'ready') {
      return { success: false, error: `Task ${taskId} is not ready (status: ${task.status})` };
    }
    
    // Auto-generate agent ID if not provided
    const assignedAgentId = agentId || `agent-${task.agent}-${Date.now().toString(36)}`;
    
    // Update task
    task.status = 'in_progress';
    task.assignedTo = assignedAgentId;
    task.startedAt = new Date();
    
    // Track agent
    if (!this.state.agents[assignedAgentId]) {
      this.state.agents[assignedAgentId] = {
        agentId: assignedAgentId,
        agentType: task.agent,
        completedTasks: [],
        startedAt: new Date(),
        lastActivityAt: new Date()
      };
    }
    this.state.agents[assignedAgentId].currentTask = taskId;
    this.state.agents[assignedAgentId].lastActivityAt = new Date();
    
    // Log history
    this.addHistory('dispatch', taskId, assignedAgentId);
    
    await this.save();
    
    return {
      success: true,
      taskId,
      agentId: assignedAgentId,
      promptPath: path.join(this.promptsBasePath, task.promptFile)
    };
  }

  /**
   * Mark a task as complete
   */
  async completeTask(taskId: string, notes?: string): Promise<ValidationResult> {
    const task = this.state.tasks[taskId];
    
    if (!task) {
      return { valid: false, errors: [`Task ${taskId} not found`], warnings: [] };
    }
    
    if (task.status !== 'in_progress' && task.status !== 'review') {
      return { valid: false, errors: [`Task ${taskId} is not in progress (status: ${task.status})`], warnings: [] };
    }
    
    // Mark complete
    task.status = 'complete';
    task.completedAt = new Date();
    task.testStatus = 'passing';
    
    if (notes) {
      task.notes = task.notes || [];
      task.notes.push(notes);
    }
    
    // Calculate actual hours
    if (task.startedAt) {
      task.actualHours = (task.completedAt.getTime() - task.startedAt.getTime()) / (1000 * 60 * 60);
    }
    
    // Update agent
    if (task.assignedTo && this.state.agents[task.assignedTo]) {
      const agent = this.state.agents[task.assignedTo];
      agent.completedTasks.push(taskId);
      agent.currentTask = undefined;
      agent.lastActivityAt = new Date();
    }
    
    // Log history
    this.addHistory('complete', taskId, task.assignedTo, notes);
    
    // Update ready status for blocked tasks
    this.updateReadyStatus();
    
    await this.save();
    
    return { valid: true, errors: [], warnings: [] };
  }

  /**
   * Mark a task as failed
   */
  async failTask(taskId: string, reason: string): Promise<void> {
    const task = this.state.tasks[taskId];
    if (!task) return;
    
    task.status = 'failed';
    task.notes = task.notes || [];
    task.notes.push(`FAILED: ${reason}`);
    
    this.addHistory('fail', taskId, task.assignedTo, reason);
    
    await this.save();
  }

  /**
   * Reset a task to ready state
   */
  async resetTask(taskId: string): Promise<void> {
    const task = this.state.tasks[taskId];
    if (!task) return;
    
    task.status = 'pending';
    task.testStatus = 'not_written';
    task.assignedTo = undefined;
    task.startedAt = undefined;
    task.completedAt = undefined;
    task.actualHours = undefined;
    
    this.addHistory('reset', taskId);
    this.updateReadyStatus();
    
    await this.save();
  }

  /**
   * Get the full prompt file content
   */
  async getPromptContent(taskId: string): Promise<string | null> {
    const task = this.state.tasks[taskId];
    if (!task) return null;
    
    const promptPath = path.join(this.promptsBasePath, task.promptFile);
    try {
      return await fs.readFile(promptPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Get parallel execution plan for current sprint
   */
  getParallelExecutionPlan(): Map<Agent, Task[]> {
    const plan = new Map<Agent, Task[]>();
    const currentSprint = this.state.currentSprint;
    
    for (const agent of ['A', 'B', 'C', 'D'] as Agent[]) {
      const agentTasks = Object.values(this.state.tasks)
        .filter(t => t.sprint === currentSprint && t.agent === agent)
        .sort((a, b) => a.id.localeCompare(b.id));
      plan.set(agent, agentTasks);
    }
    
    return plan;
  }

  /**
   * Add history entry
   */
  private addHistory(
    action: HistoryEntry['action'],
    taskId: string,
    agentId?: string,
    details?: string
  ): void {
    this.state.history.push({
      timestamp: new Date(),
      action,
      taskId,
      agentId,
      details
    });
    
    // Keep history bounded
    if (this.state.history.length > 1000) {
      this.state.history = this.state.history.slice(-500);
    }
  }

  /**
   * Get recent history
   */
  getRecentHistory(limit: number = 20): HistoryEntry[] {
    return this.state.history.slice(-limit);
  }

  /**
   * Get overall progress stats
   */
  getOverallStats(): {
    totalTasks: number;
    completed: number;
    inProgress: number;
    ready: number;
    pending: number;
    failed: number;
    percentComplete: number;
    estimatedHoursTotal: number;
    estimatedHoursRemaining: number;
    actualHoursSpent: number;
  } {
    const tasks = Object.values(this.state.tasks);
    const completed = tasks.filter(t => t.status === 'complete');
    const remaining = tasks.filter(t => t.status !== 'complete');
    
    return {
      totalTasks: tasks.length,
      completed: completed.length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      ready: tasks.filter(t => t.status === 'ready').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      percentComplete: Math.round((completed.length / tasks.length) * 100),
      estimatedHoursTotal: tasks.reduce((sum, t) => sum + t.estimatedHours, 0),
      estimatedHoursRemaining: remaining.reduce((sum, t) => sum + t.estimatedHours, 0),
      actualHoursSpent: completed.reduce((sum, t) => sum + (t.actualHours || 0), 0)
    };
  }

  /**
   * Export dispatch prompts for all ready tasks
   */
  async exportDispatchPrompts(): Promise<string> {
    const readyTasks = this.getNextTasks(20);
    let output = '# Ready Tasks for Dispatch\n\n';
    
    for (const task of readyTasks) {
      const content = await this.getPromptContent(task.id);
      output += `## ${task.id}: ${task.name}\n`;
      output += `**Sprint:** ${task.sprint} | **Agent:** ${task.agent} | **Complexity:** ${task.complexity}\n`;
      output += `**Estimated Hours:** ${task.estimatedHours}\n`;
      output += `**Prompt File:** ${task.promptFile}\n\n`;
      output += `### Dependencies\n${task.dependencies.length ? task.dependencies.join(', ') : 'None'}\n\n`;
      output += `---\n\n`;
    }
    
    return output;
  }

  /**
   * Get state for external inspection
   */
  getState(): OrchestratorState {
    return this.state;
  }
}
