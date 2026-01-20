import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-A1: Monorepo Structure', () => {
  const rootDir = resolve(__dirname, '..');

  test('package.json exists with workspaces', () => {
    const pkgPath = resolve(rootDir, 'package.json');
    expect(existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    expect(pkg.workspaces).toBeDefined();
    expect(pkg.workspaces).toContain('packages/*');
    expect(pkg.workspaces).toContain('apps/*');
  });

  test('pnpm-workspace.yaml exists', () => {
    const wsPath = resolve(rootDir, 'pnpm-workspace.yaml');
    expect(existsSync(wsPath)).toBe(true);
  });

  test('turbo.json exists with required tasks', () => {
    const turboPath = resolve(rootDir, 'turbo.json');
    expect(existsSync(turboPath)).toBe(true);

    const turbo = JSON.parse(readFileSync(turboPath, 'utf-8'));
    expect(turbo.tasks).toBeDefined();
    expect(turbo.tasks.build).toBeDefined();
    expect(turbo.tasks.test).toBeDefined();
    expect(turbo.tasks.lint).toBeDefined();
    expect(turbo.tasks.typecheck).toBeDefined();
  });

  test('packages directory exists with required packages', () => {
    const packages = ['core', 'db', 'api-client'];
    packages.forEach((pkg) => {
      const pkgDir = resolve(rootDir, 'packages', pkg);
      expect(existsSync(pkgDir)).toBe(true);

      const pkgJson = resolve(pkgDir, 'package.json');
      expect(existsSync(pkgJson)).toBe(true);

      const pkgData = JSON.parse(readFileSync(pkgJson, 'utf-8'));
      expect(pkgData.name).toBe(`@rtv/${pkg}`);
    });
  });

  test('apps directory exists with required apps', () => {
    const apps = ['api', 'worker'];
    apps.forEach((app) => {
      const appDir = resolve(rootDir, 'apps', app);
      expect(existsSync(appDir)).toBe(true);

      const pkgJson = resolve(appDir, 'package.json');
      expect(existsSync(pkgJson)).toBe(true);

      const pkgData = JSON.parse(readFileSync(pkgJson, 'utf-8'));
      expect(pkgData.name).toBe(`@rtv/${app}`);
    });
  });

  test('root tsconfig.json exists with path aliases', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    expect(existsSync(tsconfigPath)).toBe(true);

    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.paths).toBeDefined();
    expect(tsconfig.compilerOptions.paths['@rtv/core']).toBeDefined();
    expect(tsconfig.compilerOptions.paths['@rtv/db']).toBeDefined();
  });

  test('all packages have source index files', () => {
    const packages = ['core', 'db', 'api-client'];
    packages.forEach((pkg) => {
      const indexPath = resolve(rootDir, 'packages', pkg, 'src', 'index.ts');
      expect(existsSync(indexPath)).toBe(true);
    });
  });

  test('all apps have source index files', () => {
    const apps = ['api', 'worker'];
    apps.forEach((app) => {
      const indexPath = resolve(rootDir, 'apps', app, 'src', 'index.ts');
      expect(existsSync(indexPath)).toBe(true);
    });
  });

  test('engine requirements are specified', () => {
    const pkgPath = resolve(rootDir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    expect(pkg.engines).toBeDefined();
    expect(pkg.engines.node).toBe('>=20.0.0');
    expect(pkg.engines.pnpm).toBe('>=8.0.0');
  });
});
