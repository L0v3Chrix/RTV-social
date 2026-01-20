# Agent Dispatch Prompts - Sprint 0 Wave 2

> **Generated:** 2026-01-16
> **Status:** 4 parallel tasks ready for execution
> **Prerequisites:** S0-A4, S0-B1, S0-B2, S0-C1, S0-C2, S0-D1, S0-D2 ✅ Complete

---

## Agent A: S0-A5 - Husky Pre-commit Hooks

```
You are implementing task S0-A5: Husky Pre-commit Hooks for the RTV Social Automation project.

## Context
This is a Turborepo monorepo using pnpm workspaces. ESLint, Prettier, and Vitest are already configured (S0-A3, S0-A4 complete).

## Task Requirements
Implement Git hooks using Husky for automated code quality enforcement:

1. **Husky Setup**
   - Install husky v9+ with pnpm
   - Initialize with `pnpm exec husky init`
   - Configure .husky/ directory structure

2. **lint-staged Configuration**
   - Install lint-staged
   - Create lint-staged.config.js at root:
     ```javascript
     export default {
       '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
       '*.{json,md,yml,yaml}': ['prettier --write'],
       '*.ts': () => 'tsc --noEmit'
     }
     ```

3. **Pre-commit Hook**
   - Create .husky/pre-commit:
     ```bash
     pnpm lint-staged
     ```

4. **Commit Message Validation**
   - Install @commitlint/cli @commitlint/config-conventional
   - Create commitlint.config.js:
     ```javascript
     export default {
       extends: ['@commitlint/config-conventional'],
       rules: {
         'scope-enum': [2, 'always', [
           'core', 'schemas', 'cli', 'agent', 'api',
           'config', 'deps', 'docs', 'ci', 'test'
         ]],
         'subject-case': [2, 'always', 'lower-case']
       }
     }
     ```
   - Create .husky/commit-msg:
     ```bash
     pnpm commitlint --edit $1
     ```

5. **Pre-push Hook (Optional Tests)**
   - Create .husky/pre-push:
     ```bash
     pnpm test --run
     ```

## TDD Requirements
Create packages/config/husky/src/__tests__/hooks.test.ts:

### RED Phase - Write failing tests:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Husky Git Hooks', () => {
  const rootDir = process.cwd();

  describe('hook files', () => {
    it('should have pre-commit hook', () => {
      expect(existsSync(join(rootDir, '.husky/pre-commit'))).toBe(true);
    });

    it('should have commit-msg hook', () => {
      expect(existsSync(join(rootDir, '.husky/commit-msg'))).toBe(true);
    });

    it('should have pre-push hook', () => {
      expect(existsSync(join(rootDir, '.husky/pre-push'))).toBe(true);
    });
  });

  describe('lint-staged config', () => {
    it('should have lint-staged configuration', () => {
      expect(existsSync(join(rootDir, 'lint-staged.config.js'))).toBe(true);
    });

    it('should configure TypeScript file handling', async () => {
      const config = await import(join(rootDir, 'lint-staged.config.js'));
      expect(config.default['*.{ts,tsx}']).toBeDefined();
    });
  });

  describe('commitlint config', () => {
    it('should have commitlint configuration', () => {
      expect(existsSync(join(rootDir, 'commitlint.config.js'))).toBe(true);
    });

    it('should extend conventional config', async () => {
      const config = await import(join(rootDir, 'commitlint.config.js'));
      expect(config.default.extends).toContain('@commitlint/config-conventional');
    });

    it('should define valid scopes', async () => {
      const config = await import(join(rootDir, 'commitlint.config.js'));
      const scopes = config.default.rules['scope-enum'][2];
      expect(scopes).toContain('core');
      expect(scopes).toContain('cli');
      expect(scopes).toContain('agent');
    });
  });

  describe('commit message validation', () => {
    it('should accept valid conventional commit', () => {
      const result = execSync(
        'echo "feat(core): add new feature" | pnpm commitlint',
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      expect(result).not.toContain('error');
    });

    it('should reject invalid commit message', () => {
      expect(() => {
        execSync(
          'echo "invalid commit" | pnpm commitlint',
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });
  });
});
```

### GREEN Phase
Implement all hooks and configurations to make tests pass.

### REFACTOR Phase
- Ensure hooks are executable (chmod +x)
- Add npm scripts: "prepare": "husky"
- Document hook bypass: git commit --no-verify

## Deliverables
- [ ] .husky/pre-commit (lint-staged)
- [ ] .husky/commit-msg (commitlint)
- [ ] .husky/pre-push (tests)
- [ ] lint-staged.config.js
- [ ] commitlint.config.js
- [ ] Updated package.json with prepare script
- [ ] All tests passing

## Verification
```bash
# Test commit message validation
echo "feat(core): test commit" | pnpm commitlint

# Test lint-staged (stage a file first)
pnpm lint-staged --debug

# Run hook tests
pnpm test --filter="**/hooks.test.ts"
```
```

---

## Agent B: S0-B3 - Result Type Pattern

```
You are implementing task S0-B3: Result Type Pattern for the RTV Social Automation project.

## Context
This is a Turborepo monorepo. @rtv/core and @rtv/schemas packages exist (S0-B1, S0-B2 complete).

## Task Requirements
Implement a Result<T, E> monad for type-safe error handling without exceptions:

1. **Core Result Type** (packages/core/src/result/result.ts)
   ```typescript
   export type Result<T, E = Error> = Ok<T> | Err<E>;

   export interface Ok<T> {
     readonly _tag: 'Ok';
     readonly value: T;
   }

   export interface Err<E> {
     readonly _tag: 'Err';
     readonly error: E;
   }
   ```

2. **Constructors**
   ```typescript
   export const ok = <T>(value: T): Ok<T> => ({ _tag: 'Ok', value });
   export const err = <E>(error: E): Err<E> => ({ _tag: 'Err', error });
   ```

3. **Type Guards**
   ```typescript
   export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> =>
     result._tag === 'Ok';
   export const isErr = <T, E>(result: Result<T, E>): result is Err<E> =>
     result._tag === 'Err';
   ```

4. **Transformation Methods**
   ```typescript
   export const map = <T, U, E>(
     result: Result<T, E>,
     fn: (value: T) => U
   ): Result<U, E> =>
     isOk(result) ? ok(fn(result.value)) : result;

   export const mapErr = <T, E, F>(
     result: Result<T, E>,
     fn: (error: E) => F
   ): Result<T, F> =>
     isErr(result) ? err(fn(result.error)) : result;

   export const flatMap = <T, U, E>(
     result: Result<T, E>,
     fn: (value: T) => Result<U, E>
   ): Result<U, E> =>
     isOk(result) ? fn(result.value) : result;
   ```

5. **Utility Functions**
   ```typescript
   export const unwrap = <T, E>(result: Result<T, E>): T => {
     if (isOk(result)) return result.value;
     throw result.error;
   };

   export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
     isOk(result) ? result.value : defaultValue;

   export const unwrapOrElse = <T, E>(
     result: Result<T, E>,
     fn: (error: E) => T
   ): T =>
     isOk(result) ? result.value : fn(result.error);

   export const match = <T, E, U>(
     result: Result<T, E>,
     handlers: { ok: (value: T) => U; err: (error: E) => U }
   ): U =>
     isOk(result) ? handlers.ok(result.value) : handlers.err(result.error);
   ```

6. **Async Support**
   ```typescript
   export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

   export const fromPromise = async <T, E = Error>(
     promise: Promise<T>,
     mapError: (e: unknown) => E = (e) => e as E
   ): AsyncResult<T, E> => {
     try {
       return ok(await promise);
     } catch (e) {
       return err(mapError(e));
     }
   };

   export const mapAsync = async <T, U, E>(
     result: AsyncResult<T, E>,
     fn: (value: T) => Promise<U>
   ): AsyncResult<U, E> => {
     const r = await result;
     if (isOk(r)) {
       return ok(await fn(r.value));
     }
     return r;
   };
   ```

7. **Collection Utilities**
   ```typescript
   export const all = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
     const values: T[] = [];
     for (const result of results) {
       if (isErr(result)) return result;
       values.push(result.value);
     }
     return ok(values);
   };

   export const any = <T, E>(results: Result<T, E>[]): Result<T, E[]> => {
     const errors: E[] = [];
     for (const result of results) {
       if (isOk(result)) return result;
       errors.push(result.error);
     }
     return err(errors);
   };
   ```

8. **Pipe Function**
   ```typescript
   export function pipe<T, E, A>(
     result: Result<T, E>,
     fn1: (r: Result<T, E>) => Result<A, E>
   ): Result<A, E>;
   export function pipe<T, E, A, B>(
     result: Result<T, E>,
     fn1: (r: Result<T, E>) => Result<A, E>,
     fn2: (r: Result<A, E>) => Result<B, E>
   ): Result<B, E>;
   // ... more overloads up to 10
   export function pipe(result: any, ...fns: any[]): any {
     return fns.reduce((acc, fn) => fn(acc), result);
   }
   ```

## TDD Requirements
Create packages/core/src/result/__tests__/result.test.ts:

### RED Phase - Write failing tests:
```typescript
import { describe, it, expect } from 'vitest';
import {
  ok, err, isOk, isErr,
  map, mapErr, flatMap,
  unwrap, unwrapOr, unwrapOrElse, match,
  fromPromise, mapAsync,
  all, any, pipe,
  Result
} from '../result';

describe('Result Type', () => {
  describe('constructors', () => {
    it('should create Ok result', () => {
      const result = ok(42);
      expect(result._tag).toBe('Ok');
      expect(result.value).toBe(42);
    });

    it('should create Err result', () => {
      const result = err(new Error('failed'));
      expect(result._tag).toBe('Err');
      expect(result.error.message).toBe('failed');
    });
  });

  describe('type guards', () => {
    it('isOk should return true for Ok', () => {
      expect(isOk(ok(1))).toBe(true);
      expect(isOk(err('error'))).toBe(false);
    });

    it('isErr should return true for Err', () => {
      expect(isErr(err('error'))).toBe(true);
      expect(isErr(ok(1))).toBe(false);
    });
  });

  describe('map', () => {
    it('should transform Ok value', () => {
      const result = map(ok(2), x => x * 2);
      expect(isOk(result) && result.value).toBe(4);
    });

    it('should pass through Err', () => {
      const result = map(err('error'), x => x * 2);
      expect(isErr(result) && result.error).toBe('error');
    });
  });

  describe('mapErr', () => {
    it('should transform Err value', () => {
      const result = mapErr(err('error'), e => e.toUpperCase());
      expect(isErr(result) && result.error).toBe('ERROR');
    });

    it('should pass through Ok', () => {
      const result = mapErr(ok(42), e => e.toUpperCase());
      expect(isOk(result) && result.value).toBe(42);
    });
  });

  describe('flatMap', () => {
    it('should chain Ok results', () => {
      const divide = (a: number, b: number): Result<number, string> =>
        b === 0 ? err('division by zero') : ok(a / b);

      const result = flatMap(ok(10), x => divide(x, 2));
      expect(isOk(result) && result.value).toBe(5);
    });

    it('should short-circuit on Err', () => {
      const result = flatMap(err('first error'), () => ok(42));
      expect(isErr(result) && result.error).toBe('first error');
    });
  });

  describe('unwrap functions', () => {
    it('unwrap should return value for Ok', () => {
      expect(unwrap(ok(42))).toBe(42);
    });

    it('unwrap should throw for Err', () => {
      expect(() => unwrap(err(new Error('fail')))).toThrow('fail');
    });

    it('unwrapOr should return default for Err', () => {
      expect(unwrapOr(err('error'), 0)).toBe(0);
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it('unwrapOrElse should call function for Err', () => {
      const result = unwrapOrElse(err('error'), e => e.length);
      expect(result).toBe(5);
    });
  });

  describe('match', () => {
    it('should call ok handler for Ok', () => {
      const result = match(ok(42), {
        ok: v => `value: ${v}`,
        err: e => `error: ${e}`
      });
      expect(result).toBe('value: 42');
    });

    it('should call err handler for Err', () => {
      const result = match(err('failed'), {
        ok: v => `value: ${v}`,
        err: e => `error: ${e}`
      });
      expect(result).toBe('error: failed');
    });
  });

  describe('async support', () => {
    it('fromPromise should wrap resolved promise in Ok', async () => {
      const result = await fromPromise(Promise.resolve(42));
      expect(isOk(result) && result.value).toBe(42);
    });

    it('fromPromise should wrap rejected promise in Err', async () => {
      const result = await fromPromise(
        Promise.reject(new Error('async fail')),
        e => e as Error
      );
      expect(isErr(result) && result.error.message).toBe('async fail');
    });

    it('mapAsync should transform async Ok value', async () => {
      const result = await mapAsync(
        Promise.resolve(ok(2)),
        async x => x * 2
      );
      expect(isOk(result) && result.value).toBe(4);
    });
  });

  describe('collection utilities', () => {
    it('all should return Ok with all values if all Ok', () => {
      const result = all([ok(1), ok(2), ok(3)]);
      expect(isOk(result) && result.value).toEqual([1, 2, 3]);
    });

    it('all should return first Err if any Err', () => {
      const result = all([ok(1), err('fail'), ok(3)]);
      expect(isErr(result) && result.error).toBe('fail');
    });

    it('any should return first Ok', () => {
      const result = any([err('a'), ok(2), err('c')]);
      expect(isOk(result) && result.value).toBe(2);
    });

    it('any should return all Errs if no Ok', () => {
      const result = any([err('a'), err('b')]);
      expect(isErr(result) && result.error).toEqual(['a', 'b']);
    });
  });

  describe('pipe', () => {
    it('should chain transformations', () => {
      const result = pipe(
        ok(2),
        r => map(r, x => x + 1),
        r => map(r, x => x * 2)
      );
      expect(isOk(result) && result.value).toBe(6);
    });

    it('should short-circuit on error', () => {
      const result = pipe(
        ok(2),
        r => flatMap(r, () => err('stopped')),
        r => map(r, x => x * 2)
      );
      expect(isErr(result) && result.error).toBe('stopped');
    });
  });
});
```

### GREEN Phase
Implement all Result functions to make tests pass.

### REFACTOR Phase
- Add JSDoc comments with examples
- Export from packages/core/src/index.ts
- Consider adding Do-notation helper

## Deliverables
- [ ] packages/core/src/result/result.ts
- [ ] packages/core/src/result/index.ts (re-export)
- [ ] packages/core/src/result/__tests__/result.test.ts
- [ ] Updated packages/core/src/index.ts exports
- [ ] All tests passing

## Verification
```bash
pnpm test --filter=@rtv/core -- result
pnpm build --filter=@rtv/core
```
```

---

## Agent C: S0-C3 - CLI Output Formatting

```
You are implementing task S0-C3: CLI Output Formatting for the RTV Social Automation project.

## Context
This is a Turborepo monorepo. CLI scaffold exists with Commander.js (S0-C1, S0-C2 complete).

## Task Requirements
Implement consistent, beautiful CLI output formatting:

1. **Output Formatter Base** (packages/cli/src/output/formatter.ts)
   ```typescript
   export type OutputFormat = 'table' | 'json' | 'yaml' | 'plain';

   export interface FormatterOptions {
     format: OutputFormat;
     color: boolean;
     verbose: boolean;
   }

   export interface Formatter {
     format: OutputFormat;
     table<T extends Record<string, unknown>>(data: T[], columns?: string[]): string;
     json<T>(data: T, pretty?: boolean): string;
     yaml<T>(data: T): string;
     list(items: string[], bullet?: string): string;
     keyValue(data: Record<string, unknown>): string;
   }
   ```

2. **Table Formatting** (using cli-table3)
   ```typescript
   import Table from 'cli-table3';
   import chalk from 'chalk';

   export function createTable<T extends Record<string, unknown>>(
     data: T[],
     options: {
       columns?: string[];
       headers?: Record<string, string>;
       colors?: Record<string, (v: string) => string>;
     } = {}
   ): string {
     const columns = options.columns || Object.keys(data[0] || {});
     const table = new Table({
       head: columns.map(c => chalk.bold(options.headers?.[c] || c)),
       style: { head: ['cyan'] }
     });

     data.forEach(row => {
       table.push(columns.map(c => {
         const value = String(row[c] ?? '');
         const colorFn = options.colors?.[c];
         return colorFn ? colorFn(value) : value;
       }));
     });

     return table.toString();
   }
   ```

3. **Progress Indicators** (packages/cli/src/output/progress.ts)
   ```typescript
   import ora, { Ora } from 'ora';
   import cliProgress from 'cli-progress';

   export function createSpinner(text: string): Ora {
     return ora({ text, spinner: 'dots' });
   }

   export function createProgressBar(total: number, format?: string): cliProgress.SingleBar {
     return new cliProgress.SingleBar({
       format: format || '{bar} {percentage}% | {value}/{total} | {task}',
       barCompleteChar: '█',
       barIncompleteChar: '░',
       hideCursor: true
     });
   }

   export async function withSpinner<T>(
     text: string,
     fn: () => Promise<T>,
     options?: { successText?: string; failText?: string }
   ): Promise<T> {
     const spinner = createSpinner(text).start();
     try {
       const result = await fn();
       spinner.succeed(options?.successText || text);
       return result;
     } catch (error) {
       spinner.fail(options?.failText || `Failed: ${text}`);
       throw error;
     }
   }
   ```

4. **Styled Text** (packages/cli/src/output/styles.ts)
   ```typescript
   import chalk from 'chalk';

   export const styles = {
     // Status colors
     success: chalk.green,
     error: chalk.red,
     warning: chalk.yellow,
     info: chalk.blue,
     dim: chalk.dim,

     // Semantic styles
     command: chalk.cyan.bold,
     path: chalk.underline,
     code: chalk.bgGray.white,
     highlight: chalk.bold.yellow,

     // Status badges
     badge: {
       success: chalk.bgGreen.black(' PASS '),
       error: chalk.bgRed.white(' FAIL '),
       warning: chalk.bgYellow.black(' WARN '),
       info: chalk.bgBlue.white(' INFO '),
       pending: chalk.bgGray.white(' WAIT ')
     },

     // Icons (with fallback for non-unicode terminals)
     icons: {
       success: '✓',
       error: '✗',
       warning: '⚠',
       info: 'ℹ',
       arrow: '→',
       bullet: '•'
     }
   };

   export function box(content: string, title?: string): string {
     const lines = content.split('\n');
     const maxLen = Math.max(...lines.map(l => l.length), title?.length || 0);
     const top = title
       ? `┌─ ${title} ${'─'.repeat(maxLen - title.length)}┐`
       : `┌${'─'.repeat(maxLen + 2)}┐`;
     const bottom = `└${'─'.repeat(maxLen + 2)}┘`;
     const body = lines.map(l => `│ ${l.padEnd(maxLen)} │`).join('\n');
     return `${top}\n${body}\n${bottom}`;
   }
   ```

5. **JSON/YAML Output**
   ```typescript
   import YAML from 'yaml';

   export function formatJson<T>(data: T, pretty = true): string {
     return JSON.stringify(data, null, pretty ? 2 : 0);
   }

   export function formatYaml<T>(data: T): string {
     return YAML.stringify(data);
   }
   ```

6. **Output Manager** (packages/cli/src/output/manager.ts)
   ```typescript
   export class OutputManager {
     private format: OutputFormat = 'table';
     private colorEnabled = true;
     private verboseEnabled = false;

     setFormat(format: OutputFormat): this {
       this.format = format;
       return this;
     }

     setColor(enabled: boolean): this {
       this.colorEnabled = enabled;
       if (!enabled) chalk.level = 0;
       return this;
     }

     setVerbose(enabled: boolean): this {
       this.verboseEnabled = enabled;
       return this;
     }

     print<T>(data: T, options?: PrintOptions): void {
       switch (this.format) {
         case 'json':
           console.log(formatJson(data));
           break;
         case 'yaml':
           console.log(formatYaml(data));
           break;
         case 'table':
           if (Array.isArray(data)) {
             console.log(createTable(data, options?.tableOptions));
           } else {
             console.log(formatKeyValue(data as Record<string, unknown>));
           }
           break;
         default:
           console.log(data);
       }
     }

     success(message: string): void {
       console.log(styles.success(`${styles.icons.success} ${message}`));
     }

     error(message: string): void {
       console.error(styles.error(`${styles.icons.error} ${message}`));
     }

     warning(message: string): void {
       console.warn(styles.warning(`${styles.icons.warning} ${message}`));
     }

     info(message: string): void {
       console.log(styles.info(`${styles.icons.info} ${message}`));
     }

     verbose(message: string): void {
       if (this.verboseEnabled) {
         console.log(styles.dim(message));
       }
     }
   }

   export const output = new OutputManager();
   ```

## TDD Requirements
Create packages/cli/src/output/__tests__/output.test.ts:

### RED Phase - Write failing tests:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTable } from '../formatter';
import { createSpinner, withSpinner } from '../progress';
import { styles, box } from '../styles';
import { OutputManager } from '../manager';
import { formatJson, formatYaml } from '../formats';

describe('CLI Output', () => {
  describe('createTable', () => {
    it('should create table from array of objects', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ];
      const result = createTable(data);
      expect(result).toContain('Alice');
      expect(result).toContain('Bob');
      expect(result).toContain('name');
      expect(result).toContain('age');
    });

    it('should respect column selection', () => {
      const data = [{ a: 1, b: 2, c: 3 }];
      const result = createTable(data, { columns: ['a', 'c'] });
      expect(result).toContain('a');
      expect(result).toContain('c');
      expect(result).not.toContain(' b '); // b should not be a header
    });

    it('should apply custom headers', () => {
      const data = [{ id: 1 }];
      const result = createTable(data, { headers: { id: 'ID Number' } });
      expect(result).toContain('ID Number');
    });
  });

  describe('styles', () => {
    it('should have success style', () => {
      const styled = styles.success('test');
      expect(styled).toContain('test');
    });

    it('should have status badges', () => {
      expect(styles.badge.success).toContain('PASS');
      expect(styles.badge.error).toContain('FAIL');
    });

    it('should have icons', () => {
      expect(styles.icons.success).toBe('✓');
      expect(styles.icons.error).toBe('✗');
    });
  });

  describe('box', () => {
    it('should create box around content', () => {
      const result = box('Hello');
      expect(result).toContain('┌');
      expect(result).toContain('┘');
      expect(result).toContain('Hello');
    });

    it('should include title if provided', () => {
      const result = box('Content', 'Title');
      expect(result).toContain('Title');
    });
  });

  describe('formatJson', () => {
    it('should format JSON with indentation', () => {
      const result = formatJson({ a: 1 });
      expect(result).toBe('{\n  "a": 1\n}');
    });

    it('should format compact JSON', () => {
      const result = formatJson({ a: 1 }, false);
      expect(result).toBe('{"a":1}');
    });
  });

  describe('formatYaml', () => {
    it('should format as YAML', () => {
      const result = formatYaml({ name: 'test', value: 42 });
      expect(result).toContain('name: test');
      expect(result).toContain('value: 42');
    });
  });

  describe('withSpinner', () => {
    it('should show success on completion', async () => {
      const result = await withSpinner('Loading', async () => 'done');
      expect(result).toBe('done');
    });

    it('should show failure on error', async () => {
      await expect(
        withSpinner('Loading', async () => { throw new Error('fail'); })
      ).rejects.toThrow('fail');
    });
  });

  describe('OutputManager', () => {
    let manager: OutputManager;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      manager = new OutputManager();
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should print JSON format', () => {
      manager.setFormat('json').print({ test: 1 });
      expect(consoleSpy).toHaveBeenCalledWith('{\n  "test": 1\n}');
    });

    it('should print success message', () => {
      manager.success('Done!');
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('Done!');
      expect(output).toContain('✓');
    });

    it('should only print verbose when enabled', () => {
      manager.verbose('Debug info');
      expect(consoleSpy).not.toHaveBeenCalled();

      manager.setVerbose(true).verbose('Debug info');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
```

### GREEN Phase
Implement all output utilities to make tests pass.

### REFACTOR Phase
- Add support for NO_COLOR environment variable
- Handle terminal width for responsive tables
- Export singleton output manager

## Deliverables
- [ ] packages/cli/src/output/formatter.ts
- [ ] packages/cli/src/output/progress.ts
- [ ] packages/cli/src/output/styles.ts
- [ ] packages/cli/src/output/formats.ts
- [ ] packages/cli/src/output/manager.ts
- [ ] packages/cli/src/output/index.ts
- [ ] packages/cli/src/output/__tests__/output.test.ts
- [ ] All tests passing

## Dependencies to Install
```bash
pnpm add -D cli-table3 ora cli-progress chalk yaml @types/cli-progress
```

## Verification
```bash
pnpm test --filter=@rtv/cli -- output
pnpm build --filter=@rtv/cli
```
```

---

## Agent D: S0-D3 - GitHub Actions CI Pipeline

```
You are implementing task S0-D3: GitHub Actions CI Pipeline for the RTV Social Automation project.

## Context
This is a Turborepo monorepo. OpenTelemetry and structured logging are configured (S0-D1, S0-D2 complete).

## Task Requirements
Create a comprehensive CI pipeline with GitHub Actions:

1. **Main CI Workflow** (.github/workflows/ci.yml)
   ```yaml
   name: CI

   on:
     push:
       branches: [main, develop]
     pull_request:
       branches: [main, develop]

   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true

   env:
     TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
     TURBO_TEAM: ${{ vars.TURBO_TEAM }}
     NODE_VERSION: '20'
     PNPM_VERSION: '9'

   jobs:
     lint:
       name: Lint
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
           with:
             fetch-depth: 0

         - uses: pnpm/action-setup@v3
           with:
             version: ${{ env.PNPM_VERSION }}

         - uses: actions/setup-node@v4
           with:
             node-version: ${{ env.NODE_VERSION }}
             cache: 'pnpm'

         - name: Install dependencies
           run: pnpm install --frozen-lockfile

         - name: Lint
           run: pnpm lint

         - name: Type check
           run: pnpm typecheck

     test:
       name: Test
       runs-on: ubuntu-latest
       needs: lint
       strategy:
         matrix:
           node: [18, 20, 22]
       steps:
         - uses: actions/checkout@v4

         - uses: pnpm/action-setup@v3
           with:
             version: ${{ env.PNPM_VERSION }}

         - uses: actions/setup-node@v4
           with:
             node-version: ${{ matrix.node }}
             cache: 'pnpm'

         - name: Install dependencies
           run: pnpm install --frozen-lockfile

         - name: Run tests
           run: pnpm test --coverage

         - name: Upload coverage
           if: matrix.node == 20
           uses: codecov/codecov-action@v4
           with:
             token: ${{ secrets.CODECOV_TOKEN }}
             files: ./coverage/lcov.info
             fail_ci_if_error: false

     build:
       name: Build
       runs-on: ubuntu-latest
       needs: lint
       steps:
         - uses: actions/checkout@v4

         - uses: pnpm/action-setup@v3
           with:
             version: ${{ env.PNPM_VERSION }}

         - uses: actions/setup-node@v4
           with:
             node-version: ${{ env.NODE_VERSION }}
             cache: 'pnpm'

         - name: Install dependencies
           run: pnpm install --frozen-lockfile

         - name: Build
           run: pnpm build

         - name: Upload build artifacts
           uses: actions/upload-artifact@v4
           with:
             name: build-artifacts
             path: |
               packages/*/dist
               apps/*/dist
             retention-days: 7

     security:
       name: Security Scan
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4

         - uses: pnpm/action-setup@v3
           with:
             version: ${{ env.PNPM_VERSION }}

         - uses: actions/setup-node@v4
           with:
             node-version: ${{ env.NODE_VERSION }}
             cache: 'pnpm'

         - name: Install dependencies
           run: pnpm install --frozen-lockfile

         - name: Audit dependencies
           run: pnpm audit --audit-level=high
           continue-on-error: true

         - name: Check for secrets
           uses: trufflesecurity/trufflehog@main
           with:
             path: ./
             base: ${{ github.event.repository.default_branch }}
             head: HEAD
             extra_args: --only-verified
   ```

2. **PR Workflow** (.github/workflows/pr.yml)
   ```yaml
   name: PR Checks

   on:
     pull_request:
       types: [opened, synchronize, reopened]

   jobs:
     pr-title:
       name: Validate PR Title
       runs-on: ubuntu-latest
       steps:
         - uses: amannn/action-semantic-pull-request@v5
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
           with:
             types: |
               feat
               fix
               docs
               style
               refactor
               perf
               test
               build
               ci
               chore
               revert
             scopes: |
               core
               schemas
               cli
               agent
               api
               deps
             requireScope: false

     changed-files:
       name: Detect Changes
       runs-on: ubuntu-latest
       outputs:
         packages: ${{ steps.filter.outputs.packages }}
         docs: ${{ steps.filter.outputs.docs }}
       steps:
         - uses: actions/checkout@v4
         - uses: dorny/paths-filter@v3
           id: filter
           with:
             filters: |
               packages:
                 - 'packages/**'
               docs:
                 - 'docs/**'
                 - '*.md'

     size-check:
       name: Bundle Size
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v3
           with:
             version: 9
         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: 'pnpm'
         - run: pnpm install --frozen-lockfile
         - run: pnpm build
         - uses: preactjs/compressed-size-action@v2
           with:
             repo-token: ${{ secrets.GITHUB_TOKEN }}
             pattern: './packages/*/dist/**/*.js'
   ```

3. **Release Workflow** (.github/workflows/release.yml)
   ```yaml
   name: Release

   on:
     push:
       branches: [main]

   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}

   jobs:
     release:
       name: Release
       runs-on: ubuntu-latest
       permissions:
         contents: write
         pull-requests: write
       steps:
         - uses: actions/checkout@v4
           with:
             fetch-depth: 0

         - uses: pnpm/action-setup@v3
           with:
             version: 9

         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: 'pnpm'

         - name: Install dependencies
           run: pnpm install --frozen-lockfile

         - name: Create Release PR or Publish
           uses: changesets/action@v1
           with:
             publish: pnpm release
             version: pnpm version-packages
             commit: 'chore(release): version packages'
             title: 'chore(release): version packages'
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
             NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```

4. **Dependabot Config** (.github/dependabot.yml)
   ```yaml
   version: 2
   updates:
     - package-ecosystem: npm
       directory: /
       schedule:
         interval: weekly
         day: monday
       open-pull-requests-limit: 10
       groups:
         production:
           patterns:
             - '*'
           exclude-patterns:
             - '@types/*'
             - 'eslint*'
             - 'prettier*'
             - 'vitest*'
             - 'typescript*'
         dev-dependencies:
           patterns:
             - '@types/*'
             - 'eslint*'
             - 'prettier*'
             - 'vitest*'
             - 'typescript*'
       commit-message:
         prefix: 'chore(deps)'
       labels:
         - dependencies
         - automated

     - package-ecosystem: github-actions
       directory: /
       schedule:
         interval: weekly
       commit-message:
         prefix: 'ci'
       labels:
         - ci
         - automated
   ```

5. **Branch Protection Script** (scripts/setup-branch-protection.sh)
   ```bash
   #!/bin/bash
   # Run with: GITHUB_TOKEN=xxx ./scripts/setup-branch-protection.sh owner/repo

   REPO=$1

   gh api \
     --method PUT \
     -H "Accept: application/vnd.github+json" \
     "/repos/$REPO/branches/main/protection" \
     -f required_status_checks='{"strict":true,"contexts":["Lint","Test (20)","Build"]}' \
     -f enforce_admins=false \
     -f required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
     -f restrictions=null \
     -F allow_force_pushes=false \
     -F allow_deletions=false
   ```

## TDD Requirements
Create .github/__tests__/workflows.test.ts:

### RED Phase - Write tests:
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { load } from 'js-yaml';
import { join } from 'path';

describe('GitHub Actions Workflows', () => {
  const workflowsDir = join(process.cwd(), '.github/workflows');

  describe('ci.yml', () => {
    const ciPath = join(workflowsDir, 'ci.yml');

    it('should exist', () => {
      expect(existsSync(ciPath)).toBe(true);
    });

    it('should have valid YAML', () => {
      const content = readFileSync(ciPath, 'utf-8');
      expect(() => load(content)).not.toThrow();
    });

    it('should trigger on push and PR to main', () => {
      const content = readFileSync(ciPath, 'utf-8');
      const workflow = load(content) as any;
      expect(workflow.on.push.branches).toContain('main');
      expect(workflow.on.pull_request.branches).toContain('main');
    });

    it('should have lint job', () => {
      const content = readFileSync(ciPath, 'utf-8');
      const workflow = load(content) as any;
      expect(workflow.jobs.lint).toBeDefined();
      expect(workflow.jobs.lint.steps).toContainEqual(
        expect.objectContaining({ run: expect.stringContaining('lint') })
      );
    });

    it('should have test job with matrix', () => {
      const content = readFileSync(ciPath, 'utf-8');
      const workflow = load(content) as any;
      expect(workflow.jobs.test).toBeDefined();
      expect(workflow.jobs.test.strategy.matrix.node).toContain(20);
    });

    it('should have build job', () => {
      const content = readFileSync(ciPath, 'utf-8');
      const workflow = load(content) as any;
      expect(workflow.jobs.build).toBeDefined();
    });

    it('should have concurrency settings', () => {
      const content = readFileSync(ciPath, 'utf-8');
      const workflow = load(content) as any;
      expect(workflow.concurrency).toBeDefined();
      expect(workflow.concurrency['cancel-in-progress']).toBe(true);
    });

    it('should upload coverage to Codecov', () => {
      const content = readFileSync(ciPath, 'utf-8');
      const workflow = load(content) as any;
      const testSteps = workflow.jobs.test.steps;
      expect(testSteps).toContainEqual(
        expect.objectContaining({ uses: expect.stringContaining('codecov') })
      );
    });
  });

  describe('pr.yml', () => {
    const prPath = join(workflowsDir, 'pr.yml');

    it('should exist', () => {
      expect(existsSync(prPath)).toBe(true);
    });

    it('should validate PR title', () => {
      const content = readFileSync(prPath, 'utf-8');
      const workflow = load(content) as any;
      expect(workflow.jobs['pr-title']).toBeDefined();
    });
  });

  describe('release.yml', () => {
    const releasePath = join(workflowsDir, 'release.yml');

    it('should exist', () => {
      expect(existsSync(releasePath)).toBe(true);
    });

    it('should use changesets action', () => {
      const content = readFileSync(releasePath, 'utf-8');
      const workflow = load(content) as any;
      const releaseSteps = workflow.jobs.release.steps;
      expect(releaseSteps).toContainEqual(
        expect.objectContaining({ uses: expect.stringContaining('changesets') })
      );
    });
  });

  describe('dependabot.yml', () => {
    const dependabotPath = join(process.cwd(), '.github/dependabot.yml');

    it('should exist', () => {
      expect(existsSync(dependabotPath)).toBe(true);
    });

    it('should configure npm updates', () => {
      const content = readFileSync(dependabotPath, 'utf-8');
      const config = load(content) as any;
      expect(config.updates).toContainEqual(
        expect.objectContaining({ 'package-ecosystem': 'npm' })
      );
    });

    it('should configure github-actions updates', () => {
      const content = readFileSync(dependabotPath, 'utf-8');
      const config = load(content) as any;
      expect(config.updates).toContainEqual(
        expect.objectContaining({ 'package-ecosystem': 'github-actions' })
      );
    });
  });
});
```

### GREEN Phase
Create all workflow files to make tests pass.

### REFACTOR Phase
- Add workflow status badges to README
- Document required secrets
- Add manual workflow triggers for debugging

## Deliverables
- [ ] .github/workflows/ci.yml
- [ ] .github/workflows/pr.yml
- [ ] .github/workflows/release.yml
- [ ] .github/dependabot.yml
- [ ] scripts/setup-branch-protection.sh
- [ ] .github/__tests__/workflows.test.ts
- [ ] Updated README with CI badges
- [ ] All tests passing

## Required Secrets (Document in README)
- TURBO_TOKEN - Turborepo remote cache
- CODECOV_TOKEN - Coverage uploads
- NPM_TOKEN - Package publishing
- GITHUB_TOKEN - Auto-provided

## Verification
```bash
pnpm test -- workflows
# Validate YAML syntax
pnpm dlx yaml-lint .github/workflows/*.yml
```
```

---

## Execution Summary

| Agent | Task ID | Task Name | Est. Hours |
|-------|---------|-----------|------------|
| A | S0-A5 | Husky Pre-commit Hooks | 2h |
| B | S0-B3 | Result Type Pattern | 3h |
| C | S0-C3 | CLI Output Formatting | 2h |
| D | S0-D3 | GitHub Actions CI Pipeline | 4h |

**Total Parallel Time:** ~4 hours (longest task)
**Total Sequential Time:** 11 hours (if done serially)
**Efficiency Gain:** 64% time savings

## Post-Completion Next Wave

After these 4 complete, the following become unblocked:

| Task | Waiting On | Can Start When |
|------|------------|----------------|
| S0-B4 (Logger Infrastructure) | S0-B3 | Agent B completes |
| S0-C4 (CLI Interactive Prompts) | S0-C3 | Agent C completes |
| S0-C5 (CLI Error Display) | S0-C3 | Agent C completes |
| S0-D4 (Changesets) | S0-D3 | Agent D completes |
| S0-D5 (Dependency Scanning) | S0-D3 | Agent D completes |
| S0-D6 (Code Coverage Reporting) | S0-D3 | Agent D completes |
| S0-D7 (Documentation Site) | S0-D3 | Agent D completes |

Sprint 0 will be ~90% complete after this wave + next wave.
