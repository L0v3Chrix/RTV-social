import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';

describe('S0-C4: Vercel Preview Deployments', () => {
  const rootDir = resolve(__dirname, '..');
  const workflowsDir = resolve(rootDir, '.github', 'workflows');

  describe('vercel.json configuration', () => {
    const vercelJsonPath = resolve(rootDir, 'vercel.json');

    test('vercel.json exists in project root', () => {
      expect(existsSync(vercelJsonPath)).toBe(true);
    });

    test('vercel.json is valid JSON', () => {
      const content = readFileSync(vercelJsonPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    test('vercel.json has required buildCommand', () => {
      const content = readFileSync(vercelJsonPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.buildCommand).toBeDefined();
      expect(config.buildCommand).toBe('pnpm turbo build --filter=@rtv/web');
    });

    test('vercel.json has required installCommand', () => {
      const content = readFileSync(vercelJsonPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.installCommand).toBeDefined();
      expect(config.installCommand).toBe('pnpm install');
    });

    test('vercel.json has framework set to nextjs', () => {
      const content = readFileSync(vercelJsonPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.framework).toBeDefined();
      expect(config.framework).toBe('nextjs');
    });

    test('vercel.json has correct outputDirectory', () => {
      const content = readFileSync(vercelJsonPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.outputDirectory).toBeDefined();
      expect(config.outputDirectory).toBe('apps/web/.next');
    });

    test('vercel.json has git integration configured', () => {
      const content = readFileSync(vercelJsonPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.git).toBeDefined();
      expect(config.git.deploymentEnabled).toBeDefined();
    });
  });

  describe('preview deployment workflow', () => {
    const previewWorkflowPath = resolve(workflowsDir, 'preview.yml');

    test('preview.yml workflow exists', () => {
      expect(existsSync(previewWorkflowPath)).toBe(true);
    });

    test('preview.yml is valid YAML', () => {
      const content = readFileSync(previewWorkflowPath, 'utf-8');
      expect(() => parse(content)).not.toThrow();
    });

    test('preview.yml triggers on pull_request', () => {
      const content = readFileSync(previewWorkflowPath, 'utf-8');
      const workflow = parse(content);

      expect(workflow.on).toBeDefined();
      expect(workflow.on.pull_request).toBeDefined();
    });

    test('preview.yml has preview job', () => {
      const content = readFileSync(previewWorkflowPath, 'utf-8');
      const workflow = parse(content);

      expect(workflow.jobs).toBeDefined();
      expect(workflow.jobs.preview).toBeDefined();
    });

    test('preview.yml uses pnpm action setup', () => {
      const content = readFileSync(previewWorkflowPath, 'utf-8');

      expect(content).toContain('pnpm/action-setup');
    });

    test('preview.yml has PR comment step for preview URL', () => {
      const content = readFileSync(previewWorkflowPath, 'utf-8');

      // Check for PR commenting capability
      expect(content).toContain('github.event.pull_request');
    });

    test('preview.yml has concurrency control', () => {
      const content = readFileSync(previewWorkflowPath, 'utf-8');
      const workflow = parse(content);

      expect(workflow.concurrency).toBeDefined();
      expect(workflow.concurrency['cancel-in-progress']).toBe(true);
    });
  });

  describe('environment documentation', () => {
    test('VERCEL-ENV-VARS.md exists in docs folder', () => {
      const envDocsPath = resolve(rootDir, 'docs', 'VERCEL-ENV-VARS.md');
      expect(existsSync(envDocsPath)).toBe(true);
    });

    test('VERCEL-ENV-VARS.md documents required variables', () => {
      const envDocsPath = resolve(rootDir, 'docs', 'VERCEL-ENV-VARS.md');
      const content = readFileSync(envDocsPath, 'utf-8');

      // Check for essential environment variables documentation
      expect(content).toContain('VERCEL_TOKEN');
      expect(content).toContain('VERCEL_ORG_ID');
      expect(content).toContain('VERCEL_PROJECT_ID');
    });

    test('VERCEL-ENV-VARS.md documents preview deployment variables', () => {
      const envDocsPath = resolve(rootDir, 'docs', 'VERCEL-ENV-VARS.md');
      const content = readFileSync(envDocsPath, 'utf-8');

      // Check for preview-specific documentation
      expect(content.toLowerCase()).toContain('preview');
    });
  });
});
