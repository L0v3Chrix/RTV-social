import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-A4: Linting Configuration', () => {
  const rootDir = resolve(__dirname, '..');

  test('eslint.config.js exists', () => {
    const eslintPath = resolve(rootDir, 'eslint.config.js');
    expect(existsSync(eslintPath)).toBe(true);
  });

  test('.prettierrc exists', () => {
    const prettierPath = resolve(rootDir, '.prettierrc');
    expect(existsSync(prettierPath)).toBe(true);
  });

  test('.prettierignore exists', () => {
    const ignorePath = resolve(rootDir, '.prettierignore');
    expect(existsSync(ignorePath)).toBe(true);
  });

  test('package.json has lint script', () => {
    const pkgPath = resolve(rootDir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts.lint).toBeDefined();
  });

  test('package.json has format script', () => {
    const pkgPath = resolve(rootDir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts.format).toBeDefined();
  });

  test('.editorconfig exists', () => {
    const editorPath = resolve(rootDir, '.editorconfig');
    expect(existsSync(editorPath)).toBe(true);
  });

  test('eslint config includes TypeScript rules', () => {
    const eslintPath = resolve(rootDir, 'eslint.config.js');
    const content = readFileSync(eslintPath, 'utf-8');
    expect(content).toContain('typescript-eslint');
  });

  test('prettier config has required settings', () => {
    const prettierPath = resolve(rootDir, '.prettierrc');
    const config = JSON.parse(readFileSync(prettierPath, 'utf-8'));
    expect(config.semi).toBeDefined();
    expect(config.singleQuote).toBeDefined();
    expect(config.tabWidth).toBeDefined();
  });
});
