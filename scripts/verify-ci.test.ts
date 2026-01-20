import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';

describe('S0-C1: CI Configuration', () => {
  const rootDir = resolve(__dirname, '..');
  const workflowsDir = resolve(rootDir, '.github', 'workflows');

  test('.github/workflows directory exists', () => {
    expect(existsSync(workflowsDir)).toBe(true);
  });

  test('ci.yml workflow exists', () => {
    const ciPath = resolve(workflowsDir, 'ci.yml');
    expect(existsSync(ciPath)).toBe(true);
  });

  test('ci.yml has required jobs', () => {
    const ciPath = resolve(workflowsDir, 'ci.yml');
    const content = readFileSync(ciPath, 'utf-8');
    const workflow = parse(content);

    expect(workflow.jobs).toBeDefined();
    expect(workflow.jobs.lint).toBeDefined();
    expect(workflow.jobs.typecheck).toBeDefined();
    expect(workflow.jobs.test).toBeDefined();
    expect(workflow.jobs.build).toBeDefined();
    expect(workflow.jobs['ci-ok']).toBeDefined();
  });

  test('ci.yml triggers on PR and push to main', () => {
    const ciPath = resolve(workflowsDir, 'ci.yml');
    const content = readFileSync(ciPath, 'utf-8');
    const workflow = parse(content);

    expect(workflow.on.pull_request).toBeDefined();
    expect(workflow.on.push.branches).toContain('main');
  });

  test('ci.yml uses pnpm', () => {
    const ciPath = resolve(workflowsDir, 'ci.yml');
    const content = readFileSync(ciPath, 'utf-8');

    expect(content).toContain('pnpm');
    expect(content).toContain('pnpm/action-setup');
  });

  test('ci.yml uses Node.js 20', () => {
    const ciPath = resolve(workflowsDir, 'ci.yml');
    const content = readFileSync(ciPath, 'utf-8');

    // Check for either direct node version or env variable pattern
    const hasNodeVersion = content.includes("NODE_VERSION: '20'") || content.match(/node-version.*['"]?20/);
    expect(hasNodeVersion).toBeTruthy();
  });

  test('ci.yml has concurrency control', () => {
    const ciPath = resolve(workflowsDir, 'ci.yml');
    const content = readFileSync(ciPath, 'utf-8');
    const workflow = parse(content);

    expect(workflow.concurrency).toBeDefined();
    expect(workflow.concurrency['cancel-in-progress']).toBe(true);
  });

  test('test job has postgres service', () => {
    const ciPath = resolve(workflowsDir, 'ci.yml');
    const content = readFileSync(ciPath, 'utf-8');
    const workflow = parse(content);

    expect(workflow.jobs.test.services).toBeDefined();
    expect(workflow.jobs.test.services.postgres).toBeDefined();
    expect(workflow.jobs.test.services.postgres.image).toBe('postgres:15');
  });

  test('dependabot.yml exists and is configured', () => {
    const dependabotPath = resolve(rootDir, '.github', 'dependabot.yml');
    expect(existsSync(dependabotPath)).toBe(true);

    const content = readFileSync(dependabotPath, 'utf-8');
    const config = parse(content);

    expect(config.version).toBe(2);
    expect(config.updates).toBeDefined();
    expect(config.updates.length).toBeGreaterThan(0);
  });

  test('PR template exists', () => {
    const prTemplatePath = resolve(rootDir, '.github', 'pull_request_template.md');
    expect(existsSync(prTemplatePath)).toBe(true);
  });

  test('issue templates exist', () => {
    const bugTemplatePath = resolve(rootDir, '.github', 'ISSUE_TEMPLATE', 'bug_report.md');
    const featureTemplatePath = resolve(rootDir, '.github', 'ISSUE_TEMPLATE', 'feature_request.md');

    expect(existsSync(bugTemplatePath)).toBe(true);
    expect(existsSync(featureTemplatePath)).toBe(true);
  });
});
