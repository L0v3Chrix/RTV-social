import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-A2: TypeScript Configuration', () => {
  const rootDir = resolve(__dirname, '..');

  test('tsconfig.json exists at root', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    expect(existsSync(tsconfigPath)).toBe(true);
  });

  test('strict mode is enabled', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  test('noUncheckedIndexedAccess is enabled', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(true);
  });

  test('exactOptionalPropertyTypes is enabled', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    expect(tsconfig.compilerOptions.exactOptionalPropertyTypes).toBe(true);
  });

  test('target is ES2022 or higher', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    const validTargets = ['ES2022', 'ES2023', 'ESNext'];
    expect(validTargets).toContain(tsconfig.compilerOptions.target);
  });

  test('moduleResolution is bundler or NodeNext', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    const validResolutions = ['bundler', 'NodeNext', 'Bundler'];
    expect(validResolutions).toContain(tsconfig.compilerOptions.moduleResolution);
  });

  test('path aliases are configured with @rtv/*', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    expect(tsconfig.compilerOptions.paths).toBeDefined();
    expect(tsconfig.compilerOptions.paths['@rtv/*']).toBeDefined();
  });

  test('tsconfig.base.json exists', () => {
    const basePath = resolve(rootDir, 'tsconfig.base.json');
    expect(existsSync(basePath)).toBe(true);
  });

  test('tsconfig.node.json exists and extends base', () => {
    const nodePath = resolve(rootDir, 'tsconfig.node.json');
    expect(existsSync(nodePath)).toBe(true);

    const nodeConfig = JSON.parse(readFileSync(nodePath, 'utf-8'));
    expect(nodeConfig.extends).toBe('./tsconfig.base.json');
  });

  test('tsconfig.react.json exists and extends base', () => {
    const reactPath = resolve(rootDir, 'tsconfig.react.json');
    expect(existsSync(reactPath)).toBe(true);

    const reactConfig = JSON.parse(readFileSync(reactPath, 'utf-8'));
    expect(reactConfig.extends).toBe('./tsconfig.base.json');
    expect(reactConfig.compilerOptions.jsx).toBe('react-jsx');
  });

  test('global type declarations exist', () => {
    const globalPath = resolve(rootDir, 'types', 'global.d.ts');
    expect(existsSync(globalPath)).toBe(true);
  });
});
