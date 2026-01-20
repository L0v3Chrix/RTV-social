import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

describe('S0-A5: Shared tsconfig Inheritance', () => {
  const rootDir = resolve(__dirname, '..');
  const packagesDir = resolve(rootDir, 'packages');
  const appsDir = resolve(rootDir, 'apps');

  // Helper to read and parse JSON (tsconfig files are valid JSON, no comments to strip)
  const readJsonFile = (filePath: string): Record<string, unknown> => {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  };

  describe('Root Configuration Files', () => {
    test('tsconfig.base.json exists at root', () => {
      const basePath = resolve(rootDir, 'tsconfig.base.json');
      expect(existsSync(basePath)).toBe(true);
    });

    test('tsconfig.base.json has required strict settings', () => {
      const basePath = resolve(rootDir, 'tsconfig.base.json');
      const config = readJsonFile(basePath);
      const compilerOptions = config.compilerOptions as Record<string, unknown>;

      expect(compilerOptions.strict).toBe(true);
      expect(compilerOptions.noUncheckedIndexedAccess).toBe(true);
      expect(compilerOptions.exactOptionalPropertyTypes).toBe(true);
      expect(compilerOptions.noImplicitReturns).toBe(true);
      expect(compilerOptions.noFallthroughCasesInSwitch).toBe(true);
      expect(compilerOptions.forceConsistentCasingInFileNames).toBe(true);
    });

    test('tsconfig.node.json exists and extends base', () => {
      const nodePath = resolve(rootDir, 'tsconfig.node.json');
      expect(existsSync(nodePath)).toBe(true);

      const config = readJsonFile(nodePath);
      expect(config.extends).toBe('./tsconfig.base.json');
    });

    test('tsconfig.node.json has NodeNext module settings', () => {
      const nodePath = resolve(rootDir, 'tsconfig.node.json');
      const config = readJsonFile(nodePath);
      const compilerOptions = config.compilerOptions as Record<string, unknown>;

      expect(compilerOptions.module).toBe('NodeNext');
      expect(compilerOptions.moduleResolution).toBe('NodeNext');
    });

    test('tsconfig.react.json exists and extends base', () => {
      const reactPath = resolve(rootDir, 'tsconfig.react.json');
      expect(existsSync(reactPath)).toBe(true);

      const config = readJsonFile(reactPath);
      expect(config.extends).toBe('./tsconfig.base.json');
    });

    test('tsconfig.react.json has JSX configuration', () => {
      const reactPath = resolve(rootDir, 'tsconfig.react.json');
      const config = readJsonFile(reactPath);
      const compilerOptions = config.compilerOptions as Record<string, unknown>;

      expect(compilerOptions.jsx).toBe('react-jsx');
    });
  });

  describe('Package tsconfig Inheritance', () => {
    const getPackages = (): string[] => {
      if (!existsSync(packagesDir)) return [];
      return readdirSync(packagesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
    };

    const packages = getPackages();

    test('packages directory exists with packages', () => {
      expect(existsSync(packagesDir)).toBe(true);
      expect(packages.length).toBeGreaterThan(0);
    });

    test.each(packages)('packages/%s/tsconfig.json exists', (pkg) => {
      const tsconfigPath = join(packagesDir, pkg, 'tsconfig.json');
      expect(existsSync(tsconfigPath)).toBe(true);
    });

    test.each(packages)(
      'packages/%s extends tsconfig.node.json or tsconfig.base.json',
      (pkg) => {
        const tsconfigPath = join(packagesDir, pkg, 'tsconfig.json');
        const config = readJsonFile(tsconfigPath);

        const validExtends = [
          '../../tsconfig.node.json',
          '../../tsconfig.base.json',
          '../../tsconfig.react.json',
        ];

        expect(validExtends).toContain(config.extends);
      }
    );

    test.each(packages)('packages/%s has outDir: "dist"', (pkg) => {
      const tsconfigPath = join(packagesDir, pkg, 'tsconfig.json');
      const config = readJsonFile(tsconfigPath);
      const compilerOptions = config.compilerOptions as Record<string, unknown>;

      expect(compilerOptions.outDir).toBe('dist');
    });

    test.each(packages)('packages/%s has rootDir: "src"', (pkg) => {
      const tsconfigPath = join(packagesDir, pkg, 'tsconfig.json');
      const config = readJsonFile(tsconfigPath);
      const compilerOptions = config.compilerOptions as Record<string, unknown>;

      expect(compilerOptions.rootDir).toBe('src');
    });

    test.each(packages)('packages/%s has composite: true', (pkg) => {
      const tsconfigPath = join(packagesDir, pkg, 'tsconfig.json');
      const config = readJsonFile(tsconfigPath);
      const compilerOptions = config.compilerOptions as Record<string, unknown>;

      expect(compilerOptions.composite).toBe(true);
    });

    test.each(packages)('packages/%s has noEmit: false', (pkg) => {
      const tsconfigPath = join(packagesDir, pkg, 'tsconfig.json');
      const config = readJsonFile(tsconfigPath);
      const compilerOptions = config.compilerOptions as Record<string, unknown>;

      expect(compilerOptions.noEmit).toBe(false);
    });
  });

  describe('App tsconfig Inheritance', () => {
    const getApps = (): string[] => {
      if (!existsSync(appsDir)) return [];
      return readdirSync(appsDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
    };

    const apps = getApps();

    test('apps directory exists with apps', () => {
      expect(existsSync(appsDir)).toBe(true);
      expect(apps.length).toBeGreaterThan(0);
    });

    test.each(apps)('apps/%s/tsconfig.json exists', (app) => {
      const tsconfigPath = join(appsDir, app, 'tsconfig.json');
      expect(existsSync(tsconfigPath)).toBe(true);
    });

    test.each(apps)(
      'apps/%s extends tsconfig.node.json or tsconfig.base.json',
      (app) => {
        const tsconfigPath = join(appsDir, app, 'tsconfig.json');
        const config = readJsonFile(tsconfigPath);

        const validExtends = [
          '../../tsconfig.node.json',
          '../../tsconfig.base.json',
          '../../tsconfig.react.json',
        ];

        expect(validExtends).toContain(config.extends);
      }
    );

    test.each(apps)('apps/%s has outDir: "dist"', (app) => {
      const tsconfigPath = join(appsDir, app, 'tsconfig.json');
      const config = readJsonFile(tsconfigPath);
      const compilerOptions = config.compilerOptions as Record<string, unknown>;

      expect(compilerOptions.outDir).toBe('dist');
    });

    test.each(apps)('apps/%s has rootDir: "src"', (app) => {
      const tsconfigPath = join(appsDir, app, 'tsconfig.json');
      const config = readJsonFile(tsconfigPath);
      const compilerOptions = config.compilerOptions as Record<string, unknown>;

      expect(compilerOptions.rootDir).toBe('src');
    });

    test.each(apps)('apps/%s has composite: true', (app) => {
      const tsconfigPath = join(appsDir, app, 'tsconfig.json');
      const config = readJsonFile(tsconfigPath);
      const compilerOptions = config.compilerOptions as Record<string, unknown>;

      expect(compilerOptions.composite).toBe(true);
    });
  });

  describe('Inheritance Chain Validation', () => {
    test('tsconfig.base.json does not extend anything', () => {
      const basePath = resolve(rootDir, 'tsconfig.base.json');
      const config = readJsonFile(basePath);

      expect(config.extends).toBeUndefined();
    });

    test('all configs form proper inheritance hierarchy', () => {
      // Base config
      const baseConfig = readJsonFile(resolve(rootDir, 'tsconfig.base.json'));
      expect(baseConfig.compilerOptions).toBeDefined();

      // Node config extends base
      const nodeConfig = readJsonFile(resolve(rootDir, 'tsconfig.node.json'));
      expect(nodeConfig.extends).toBe('./tsconfig.base.json');

      // React config extends base
      const reactConfig = readJsonFile(resolve(rootDir, 'tsconfig.react.json'));
      expect(reactConfig.extends).toBe('./tsconfig.base.json');
    });
  });

  describe('Build Output Configuration', () => {
    const allPackagesAndApps = (): Array<{ type: string; name: string }> => {
      const result: Array<{ type: string; name: string }> = [];

      if (existsSync(packagesDir)) {
        readdirSync(packagesDir, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .forEach((dirent) => result.push({ type: 'packages', name: dirent.name }));
      }

      if (existsSync(appsDir)) {
        readdirSync(appsDir, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .forEach((dirent) => result.push({ type: 'apps', name: dirent.name }));
      }

      return result;
    };

    const items = allPackagesAndApps();

    test.each(items)(
      '$type/$name includes src/**/* in include array',
      ({ type, name }) => {
        const tsconfigPath = join(rootDir, type, name, 'tsconfig.json');
        const config = readJsonFile(tsconfigPath);

        expect(config.include).toBeDefined();
        expect(config.include).toContain('src/**/*');
      }
    );

    test.each(items)(
      '$type/$name excludes node_modules and dist',
      ({ type, name }) => {
        const tsconfigPath = join(rootDir, type, name, 'tsconfig.json');
        const config = readJsonFile(tsconfigPath);

        expect(config.exclude).toBeDefined();
        const exclude = config.exclude as string[];
        expect(exclude).toContain('node_modules');
        expect(exclude).toContain('dist');
      }
    );
  });
});
