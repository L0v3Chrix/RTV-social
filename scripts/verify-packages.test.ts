import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S0-A3: Core Packages Structure', () => {
  const rootDir = resolve(__dirname, '..');
  const packagesDir = resolve(rootDir, 'packages');

  const packages = ['core', 'types', 'utils'];

  packages.forEach((pkg) => {
    describe(`@rtv/${pkg}`, () => {
      const pkgDir = resolve(packagesDir, pkg);

      test('package directory exists', () => {
        expect(existsSync(pkgDir)).toBe(true);
      });

      test('package.json exists', () => {
        expect(existsSync(resolve(pkgDir, 'package.json'))).toBe(true);
      });

      test('package.json has correct name', () => {
        const pkgJson = JSON.parse(
          readFileSync(resolve(pkgDir, 'package.json'), 'utf-8')
        );
        expect(pkgJson.name).toBe(`@rtv/${pkg}`);
      });

      test('src directory exists', () => {
        expect(existsSync(resolve(pkgDir, 'src'))).toBe(true);
      });

      test('src/index.ts exists', () => {
        expect(existsSync(resolve(pkgDir, 'src', 'index.ts'))).toBe(true);
      });

      test('tsconfig.json exists', () => {
        expect(existsSync(resolve(pkgDir, 'tsconfig.json'))).toBe(true);
      });

      test('tsconfig.json extends base config', () => {
        const tsconfig = JSON.parse(
          readFileSync(resolve(pkgDir, 'tsconfig.json'), 'utf-8')
        );
        expect(tsconfig.extends).toMatch(/tsconfig\.(base|node)\.json/);
      });
    });
  });

  describe('@rtv/types specific', () => {
    const pkgDir = resolve(packagesDir, 'types');

    test('common.ts exists', () => {
      expect(existsSync(resolve(pkgDir, 'src', 'common.ts'))).toBe(true);
    });

    test('tenant.ts exists', () => {
      expect(existsSync(resolve(pkgDir, 'src', 'tenant.ts'))).toBe(true);
    });

    test('result.ts exists', () => {
      expect(existsSync(resolve(pkgDir, 'src', 'result.ts'))).toBe(true);
    });
  });

  describe('@rtv/utils specific', () => {
    const pkgDir = resolve(packagesDir, 'utils');

    test('string.ts exists', () => {
      expect(existsSync(resolve(pkgDir, 'src', 'string.ts'))).toBe(true);
    });

    test('date.ts exists', () => {
      expect(existsSync(resolve(pkgDir, 'src', 'date.ts'))).toBe(true);
    });

    test('validation.ts exists', () => {
      expect(existsSync(resolve(pkgDir, 'src', 'validation.ts'))).toBe(true);
    });

    test('async.ts exists', () => {
      expect(existsSync(resolve(pkgDir, 'src', 'async.ts'))).toBe(true);
    });
  });

  describe('@rtv/core specific', () => {
    const pkgDir = resolve(packagesDir, 'core');

    test('constants.ts exists', () => {
      expect(existsSync(resolve(pkgDir, 'src', 'constants.ts'))).toBe(true);
    });

    test('errors.ts exists', () => {
      expect(existsSync(resolve(pkgDir, 'src', 'errors.ts'))).toBe(true);
    });

    test('config.ts exists', () => {
      expect(existsSync(resolve(pkgDir, 'src', 'config.ts'))).toBe(true);
    });
  });

  describe('Package dependencies', () => {
    test('@rtv/utils depends on @rtv/types', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(packagesDir, 'utils', 'package.json'), 'utf-8')
      );
      expect(pkgJson.dependencies?.['@rtv/types']).toBe('workspace:*');
    });

    test('@rtv/core depends on @rtv/types', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(packagesDir, 'core', 'package.json'), 'utf-8')
      );
      expect(pkgJson.dependencies?.['@rtv/types']).toBe('workspace:*');
    });

    test('@rtv/core depends on @rtv/utils', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(packagesDir, 'core', 'package.json'), 'utf-8')
      );
      expect(pkgJson.dependencies?.['@rtv/utils']).toBe('workspace:*');
    });
  });
});
