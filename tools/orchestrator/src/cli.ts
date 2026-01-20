#!/usr/bin/env node

/**
 * RTV Task Orchestrator - CLI Interface
 * 
 * Commands:
 *   status          Show sprint and task status
 *   next            Show next available tasks
 *   dispatch <id>   Dispatch a task to an agent
 *   complete <id>   Mark a task as complete
 *   fail <id>       Mark a task as failed
 *   reset <id>      Reset a task to pending
 *   prompt <id>     Display the full prompt for a task
 *   export          Export all ready task prompts
 *   history         Show recent activity
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { Orchestrator } from './orchestrator.js';
import { Sprint, SPRINT_NAMES, AGENT_TRACKS } from './types.js';

const program = new Command();

// Detect project root - check if running from project root or from tools/orchestrator
function findProjectRoot(): string {
  if (process.env.RTV_PROJECT_ROOT) {
    return process.env.RTV_PROJECT_ROOT;
  }

  const cwd = process.cwd();

  // Check if we're in the project root (has pnpm-workspace.yaml)
  const workspaceYaml = path.join(cwd, 'pnpm-workspace.yaml');
  if (fsSync.existsSync(workspaceYaml)) {
    return cwd;
  }

  // Check if we're in tools/orchestrator
  const parentParent = path.resolve(cwd, '..', '..');
  const parentWorkspaceYaml = path.join(parentParent, 'pnpm-workspace.yaml');
  if (fsSync.existsSync(parentWorkspaceYaml)) {
    return parentParent;
  }

  // Default to cwd
  return cwd;
}

const PROJECT_ROOT = findProjectRoot();

let orchestrator: Orchestrator;

async function initOrchestrator(): Promise<void> {
  orchestrator = new Orchestrator(PROJECT_ROOT);
  await orchestrator.initialize();
}

// ═══════════════════════════════════════════════════════════════
// STATUS COMMAND
// ═══════════════════════════════════════════════════════════════

program
  .command('status')
  .description('Show sprint and task status')
  .option('-s, --sprint <number>', 'Show specific sprint')
  .option('-a, --all', 'Show all sprints')
  .action(async (options) => {
    await initOrchestrator();
    
    console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║         RTV SOCIAL AUTOMATION - TASK ORCHESTRATOR            ║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝\n'));
    
    // Overall stats
    const stats = orchestrator.getOverallStats();
    console.log(chalk.bold('📊 Overall Progress'));
    console.log(chalk.dim('─'.repeat(60)));
    
    const progressBar = createProgressBar(stats.percentComplete);
    console.log(`   ${progressBar} ${stats.percentComplete}%`);
    console.log(`   ${chalk.green('✓ ' + stats.completed)} completed | ${chalk.yellow('⟳ ' + stats.inProgress)} in progress | ${chalk.blue('◉ ' + stats.ready)} ready | ${chalk.gray('○ ' + stats.pending)} pending${stats.failed > 0 ? chalk.red(' | ✗ ' + stats.failed + ' failed') : ''}`);
    console.log(`   Est. hours remaining: ${chalk.cyan(stats.estimatedHoursRemaining.toFixed(1))}h / ${stats.estimatedHoursTotal}h total\n`);
    
    // Sprint statuses
    const sprints = options.sprint !== undefined 
      ? [orchestrator.getSprintStatus(parseInt(options.sprint) as Sprint)]
      : orchestrator.getAllSprintStatus();
    
    for (const sprint of sprints) {
      const statusIcon = sprint.percentComplete === 100 ? '✅' : 
                         sprint.canStart ? '🚀' : '🔒';
      
      console.log(chalk.bold(`\n${statusIcon} Sprint ${sprint.sprint}: ${sprint.name}`));
      console.log(chalk.dim('─'.repeat(60)));
      
      const bar = createProgressBar(sprint.percentComplete);
      console.log(`   ${bar} ${sprint.percentComplete}%`);
      console.log(`   ${chalk.green(sprint.completed + ' done')} | ${chalk.yellow(sprint.inProgress + ' in progress')} | ${chalk.blue(sprint.ready + ' ready')} | ${chalk.gray(sprint.pending + ' pending')}`);
      
      if (sprint.estimatedHoursRemaining > 0) {
        console.log(`   Hours remaining: ${chalk.cyan(sprint.estimatedHoursRemaining.toFixed(1))}h`);
      }
      
      // Show agent tracks
      if (options.all || options.sprint !== undefined) {
        console.log(chalk.dim('\n   Agent Tracks:'));
        for (const agent of ['A', 'B', 'C', 'D'] as const) {
          const trackName = AGENT_TRACKS[sprint.sprint]?.[agent] || 'Unknown';
          console.log(chalk.dim(`   ${agent}: ${trackName}`));
        }
      }
    }
    
    console.log('');
  });

// ═══════════════════════════════════════════════════════════════
// NEXT COMMAND
// ═══════════════════════════════════════════════════════════════

program
  .command('next')
  .description('Show next available tasks')
  .option('-n, --limit <number>', 'Number of tasks to show', '8')
  .action(async (options) => {
    await initOrchestrator();
    
    const tasks = orchestrator.getNextTasks(parseInt(options.limit));
    
    if (tasks.length === 0) {
      console.log(chalk.yellow('\n⚠️  No tasks ready for dispatch.'));
      console.log(chalk.dim('   Check if dependencies are completed or if a sprint needs to start.\n'));
      return;
    }
    
    console.log(chalk.bold.cyan('\n🎯 Next Available Tasks\n'));
    console.log(chalk.dim('─'.repeat(70)));
    
    for (const task of tasks) {
      const complexityColor = task.complexity === 'high' ? chalk.red : 
                              task.complexity === 'medium' ? chalk.yellow : chalk.green;
      
      console.log(`\n${chalk.bold.white(task.id)} ${chalk.cyan(task.name)}`);
      console.log(`   Sprint: ${task.sprint} | Agent: ${task.agent} | ${complexityColor(task.complexity.toUpperCase())} | ~${task.estimatedHours}h`);
      console.log(`   Dependencies: ${task.dependencies.length ? chalk.dim(task.dependencies.join(', ')) : chalk.green('None')}`);
      console.log(`   Blocks: ${task.blocks.length ? chalk.dim(task.blocks.join(', ')) : chalk.dim('None')}`);
    }
    
    console.log(chalk.dim('\n─'.repeat(70)));
    console.log(chalk.dim(`\nTo dispatch: ${chalk.white('pnpm start dispatch <task-id>')}`));
    console.log(chalk.dim(`To view prompt: ${chalk.white('pnpm start prompt <task-id>')}\n`));
  });

// ═══════════════════════════════════════════════════════════════
// DISPATCH COMMAND
// ═══════════════════════════════════════════════════════════════

program
  .command('dispatch <taskId>')
  .description('Dispatch a task to an agent')
  .option('-a, --agent <id>', 'Agent ID to assign')
  .action(async (taskId, options) => {
    await initOrchestrator();
    
    const spinner = ora(`Dispatching task ${taskId}...`).start();
    
    const result = await orchestrator.dispatchTask(taskId, options.agent);
    
    if (!result.success) {
      spinner.fail(chalk.red(result.error));
      return;
    }
    
    spinner.succeed(chalk.green(`Task ${taskId} dispatched to ${result.agentId}`));
    
    console.log(chalk.dim('\n─'.repeat(70)));
    console.log(chalk.bold('\n📋 Agent Instructions\n'));
    console.log(`1. Open prompt file: ${chalk.cyan(result.promptPath)}`);
    console.log(`2. Follow TDD process: RED → GREEN → REFACTOR`);
    console.log(`3. When complete: ${chalk.cyan(`pnpm start complete ${taskId}`)}`);
    console.log(`4. If blocked: ${chalk.cyan(`pnpm start fail ${taskId} --reason "..."`)}`)
    console.log('');
  });

// ═══════════════════════════════════════════════════════════════
// COMPLETE COMMAND
// ═══════════════════════════════════════════════════════════════

program
  .command('complete <taskId>')
  .description('Mark a task as complete')
  .option('-n, --notes <text>', 'Completion notes')
  .action(async (taskId, options) => {
    await initOrchestrator();
    
    const spinner = ora(`Completing task ${taskId}...`).start();
    
    const result = await orchestrator.completeTask(taskId, options.notes);
    
    if (!result.valid) {
      spinner.fail(chalk.red(result.errors.join(', ')));
      return;
    }
    
    spinner.succeed(chalk.green(`Task ${taskId} marked complete!`));
    
    // Show what's unblocked
    const nextTasks = orchestrator.getNextTasks(4);
    if (nextTasks.length > 0) {
      console.log(chalk.bold('\n🔓 Newly Available Tasks:'));
      for (const task of nextTasks) {
        console.log(`   ${chalk.cyan(task.id)}: ${task.name}`);
      }
    }
    console.log('');
  });

// ═══════════════════════════════════════════════════════════════
// FAIL COMMAND
// ═══════════════════════════════════════════════════════════════

program
  .command('fail <taskId>')
  .description('Mark a task as failed')
  .requiredOption('-r, --reason <text>', 'Failure reason')
  .action(async (taskId, options) => {
    await initOrchestrator();
    
    const spinner = ora(`Marking task ${taskId} as failed...`).start();
    
    await orchestrator.failTask(taskId, options.reason);
    
    spinner.warn(chalk.yellow(`Task ${taskId} marked as failed: ${options.reason}`));
    console.log(chalk.dim(`\nTo retry: ${chalk.white(`pnpm start reset ${taskId}`)}\n`));
  });

// ═══════════════════════════════════════════════════════════════
// RESET COMMAND
// ═══════════════════════════════════════════════════════════════

program
  .command('reset <taskId>')
  .description('Reset a task to pending state')
  .action(async (taskId) => {
    await initOrchestrator();
    
    const spinner = ora(`Resetting task ${taskId}...`).start();
    
    await orchestrator.resetTask(taskId);
    
    spinner.succeed(chalk.green(`Task ${taskId} reset to pending`));
    console.log('');
  });

// ═══════════════════════════════════════════════════════════════
// PROMPT COMMAND
// ═══════════════════════════════════════════════════════════════

program
  .command('prompt <taskId>')
  .description('Display the full prompt for a task')
  .option('-o, --output <file>', 'Write to file instead of stdout')
  .action(async (taskId, options) => {
    await initOrchestrator();
    
    const task = orchestrator.getTask(taskId);
    if (!task) {
      console.log(chalk.red(`\n❌ Task ${taskId} not found\n`));
      return;
    }
    
    const content = await orchestrator.getPromptContent(taskId);
    if (!content) {
      console.log(chalk.red(`\n❌ Prompt file not found for ${taskId}\n`));
      return;
    }
    
    if (options.output) {
      await fs.writeFile(options.output, content);
      console.log(chalk.green(`\n✅ Prompt written to ${options.output}\n`));
    } else {
      console.log(chalk.bold.cyan(`\n═══ ${taskId}: ${task.name} ═══\n`));
      console.log(content);
    }
  });

// ═══════════════════════════════════════════════════════════════
// EXPORT COMMAND
// ═══════════════════════════════════════════════════════════════

program
  .command('export')
  .description('Export all ready task prompts')
  .option('-o, --output <file>', 'Output file', 'ready-tasks.md')
  .action(async (options) => {
    await initOrchestrator();
    
    const spinner = ora('Exporting ready tasks...').start();
    
    const content = await orchestrator.exportDispatchPrompts();
    await fs.writeFile(options.output, content);
    
    spinner.succeed(chalk.green(`Exported to ${options.output}`));
    console.log('');
  });

// ═══════════════════════════════════════════════════════════════
// HISTORY COMMAND
// ═══════════════════════════════════════════════════════════════

program
  .command('history')
  .description('Show recent activity')
  .option('-n, --limit <number>', 'Number of entries', '20')
  .action(async (options) => {
    await initOrchestrator();
    
    const history = orchestrator.getRecentHistory(parseInt(options.limit));
    
    console.log(chalk.bold.cyan('\n📜 Recent Activity\n'));
    console.log(chalk.dim('─'.repeat(70)));
    
    for (const entry of history.reverse()) {
      const actionIcon = entry.action === 'complete' ? '✅' :
                         entry.action === 'dispatch' ? '🚀' :
                         entry.action === 'fail' ? '❌' :
                         entry.action === 'reset' ? '🔄' : '📝';
      
      const timestamp = entry.timestamp.toISOString().replace('T', ' ').substring(0, 19);
      
      console.log(`${chalk.dim(timestamp)} ${actionIcon} ${chalk.bold(entry.taskId)} ${chalk.dim(entry.action)}${entry.agentId ? chalk.dim(` → ${entry.agentId}`) : ''}`);
      if (entry.details) {
        console.log(chalk.dim(`   ${entry.details}`));
      }
    }
    
    console.log('');
  });

// ═══════════════════════════════════════════════════════════════
// PLAN COMMAND - Show parallel execution plan
// ═══════════════════════════════════════════════════════════════

program
  .command('plan')
  .description('Show parallel execution plan for current sprint')
  .option('-s, --sprint <number>', 'Sprint number')
  .action(async (options) => {
    await initOrchestrator();
    
    const state = orchestrator.getState();
    const sprint = options.sprint !== undefined ? parseInt(options.sprint) : state.currentSprint;
    
    console.log(chalk.bold.cyan(`\n🗺️  Parallel Execution Plan - Sprint ${sprint}: ${SPRINT_NAMES[sprint as Sprint]}\n`));
    console.log(chalk.dim('Each column represents an agent track that can run in parallel.\n'));
    
    const plan = orchestrator.getParallelExecutionPlan();
    
    // Build column display
    const columns: string[][] = [[], [], [], []];
    const agents: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
    
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const tasks = plan.get(agent) || [];
      columns[i].push(chalk.bold(`Agent ${agent}`));
      columns[i].push(chalk.dim(AGENT_TRACKS[sprint as Sprint]?.[agent] || ''));
      columns[i].push(chalk.dim('─'.repeat(20)));
      
      for (const task of tasks) {
        const statusIcon = task.status === 'complete' ? '✅' :
                          task.status === 'in_progress' ? '⟳' :
                          task.status === 'ready' ? '◉' :
                          task.status === 'failed' ? '❌' : '○';
        columns[i].push(`${statusIcon} ${task.id}`);
      }
    }
    
    // Print columns side by side
    const maxRows = Math.max(...columns.map(c => c.length));
    for (let row = 0; row < maxRows; row++) {
      const line = columns.map(col => (col[row] || '').padEnd(25)).join('│');
      console.log(line);
    }
    
    console.log(chalk.dim('\n─'.repeat(100)));
    console.log(chalk.dim('Legend: ✅ complete | ⟳ in progress | ◉ ready | ○ pending | ❌ failed\n'));
  });

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function createProgressBar(percent: number, width: number = 30): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return `[${bar}]`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

program
  .name('rtv-orchestrator')
  .description('Task orchestrator for RTV Social Automation build')
  .version('1.0.0');

program.parse();
