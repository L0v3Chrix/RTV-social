import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get directory path for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('S0-C5: Environment Variable Management', () => {
  const rootDir = resolve(__dirname, '..');
  const coreDir = resolve(rootDir, 'packages', 'core');

  describe('env.ts module exists with required exports', () => {
    test('packages/core/src/env.ts file exists', () => {
      const envPath = resolve(coreDir, 'src', 'env.ts');
      expect(existsSync(envPath)).toBe(true);
    });

    test('env.ts exports envSchema', async () => {
      const { envSchema } = await import('../packages/core/src/env.js');
      expect(envSchema).toBeDefined();
      expect(typeof envSchema.parse).toBe('function');
    });

    test('env.ts exports Env type (via envSchema inference)', async () => {
      const { envSchema } = await import('../packages/core/src/env.js');
      // The Env type is inferred from envSchema
      // We verify the schema shape to confirm the type would be correct
      const shape = envSchema.shape;
      expect(shape).toBeDefined();
      expect(shape.NODE_ENV).toBeDefined();
      expect(shape.DATABASE_URL).toBeDefined();
      expect(shape.LOG_LEVEL).toBeDefined();
    });

    test('env.ts exports validateEnv function', async () => {
      const { validateEnv } = await import('../packages/core/src/env.js');
      expect(validateEnv).toBeDefined();
      expect(typeof validateEnv).toBe('function');
    });
  });

  describe('envSchema validates required environment variables', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset process.env for each test
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('schema validates NODE_ENV enum values', async () => {
      const { envSchema } = await import('../packages/core/src/env.js');

      // Valid values should pass
      const validResult = envSchema.safeParse({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://localhost:5432/test',
        LOG_LEVEL: 'info',
        OTEL_SERVICE_NAME: 'test-service',
      });
      expect(validResult.success).toBe(true);

      // Invalid value should fail
      const invalidResult = envSchema.safeParse({
        NODE_ENV: 'invalid',
        DATABASE_URL: 'postgres://localhost:5432/test',
        LOG_LEVEL: 'info',
        OTEL_SERVICE_NAME: 'test-service',
      });
      expect(invalidResult.success).toBe(false);
    });

    test('schema validates DATABASE_URL is a valid URL', async () => {
      const { envSchema } = await import('../packages/core/src/env.js');

      // Valid URL should pass
      const validResult = envSchema.safeParse({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        LOG_LEVEL: 'info',
        OTEL_SERVICE_NAME: 'test-service',
      });
      expect(validResult.success).toBe(true);

      // Invalid URL should fail
      const invalidResult = envSchema.safeParse({
        NODE_ENV: 'development',
        DATABASE_URL: 'not-a-url',
        LOG_LEVEL: 'info',
        OTEL_SERVICE_NAME: 'test-service',
      });
      expect(invalidResult.success).toBe(false);
    });

    test('schema validates LOG_LEVEL enum values', async () => {
      const { envSchema } = await import('../packages/core/src/env.js');

      const validLevels = ['debug', 'info', 'warn', 'error'];

      for (const level of validLevels) {
        const result = envSchema.safeParse({
          NODE_ENV: 'development',
          DATABASE_URL: 'postgres://localhost:5432/test',
          LOG_LEVEL: level,
          OTEL_SERVICE_NAME: 'test-service',
        });
        expect(result.success).toBe(true);
      }

      // Invalid level should fail
      const invalidResult = envSchema.safeParse({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://localhost:5432/test',
        LOG_LEVEL: 'invalid-level',
        OTEL_SERVICE_NAME: 'test-service',
      });
      expect(invalidResult.success).toBe(false);
    });

    test('schema allows optional REDIS_URL', async () => {
      const { envSchema } = await import('../packages/core/src/env.js');

      // Without REDIS_URL should pass
      const withoutRedis = envSchema.safeParse({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://localhost:5432/test',
        LOG_LEVEL: 'info',
        OTEL_SERVICE_NAME: 'test-service',
      });
      expect(withoutRedis.success).toBe(true);

      // With REDIS_URL should pass
      const withRedis = envSchema.safeParse({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://localhost:5432/test',
        LOG_LEVEL: 'info',
        OTEL_SERVICE_NAME: 'test-service',
        REDIS_URL: 'redis://localhost:6379',
      });
      expect(withRedis.success).toBe(true);
    });

    test('schema allows optional OTEL_EXPORTER_OTLP_ENDPOINT', async () => {
      const { envSchema } = await import('../packages/core/src/env.js');

      // Without OTEL_EXPORTER_OTLP_ENDPOINT should pass
      const withoutOtel = envSchema.safeParse({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://localhost:5432/test',
        LOG_LEVEL: 'info',
        OTEL_SERVICE_NAME: 'test-service',
      });
      expect(withoutOtel.success).toBe(true);

      // With OTEL_EXPORTER_OTLP_ENDPOINT should pass
      const withOtel = envSchema.safeParse({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://localhost:5432/test',
        LOG_LEVEL: 'info',
        OTEL_SERVICE_NAME: 'test-service',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
      });
      expect(withOtel.success).toBe(true);
    });

    test('schema requires OTEL_SERVICE_NAME', async () => {
      const { envSchema } = await import('../packages/core/src/env.js');

      // Without OTEL_SERVICE_NAME should fail
      const result = envSchema.safeParse({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://localhost:5432/test',
        LOG_LEVEL: 'info',
      });
      expect(result.success).toBe(false);
    });

    test('schema provides sensible defaults', async () => {
      const { envSchema } = await import('../packages/core/src/env.js');

      const result = envSchema.safeParse({
        DATABASE_URL: 'postgres://localhost:5432/test',
        OTEL_SERVICE_NAME: 'test-service',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // NODE_ENV should default to 'development'
        expect(result.data.NODE_ENV).toBe('development');
        // LOG_LEVEL should default to 'info'
        expect(result.data.LOG_LEVEL).toBe('info');
      }
    });
  });

  describe('validateEnv function', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('validateEnv returns typed Env object on success', async () => {
      const { validateEnv } = await import('../packages/core/src/env.js');

      // Set required environment variables
      process.env.DATABASE_URL = 'postgres://localhost:5432/test';
      process.env.OTEL_SERVICE_NAME = 'test-service';
      // NODE_ENV is set by vitest to 'test', so we check it's a valid enum value
      process.env.NODE_ENV = 'development';

      const env = validateEnv();

      expect(env.NODE_ENV).toBe('development');
      expect(env.DATABASE_URL).toBe('postgres://localhost:5432/test');
      expect(env.LOG_LEVEL).toBe('info');
      expect(env.OTEL_SERVICE_NAME).toBe('test-service');
    });

    test('validateEnv throws on missing required variables', async () => {
      const { validateEnv } = await import('../packages/core/src/env.js');

      // Clear required variables
      delete process.env.DATABASE_URL;
      delete process.env.OTEL_SERVICE_NAME;

      expect(() => validateEnv()).toThrow();
    });
  });

  describe('.env.example files', () => {
    test('.env.example exists in root directory', () => {
      const envExamplePath = resolve(rootDir, '.env.example');
      expect(existsSync(envExamplePath)).toBe(true);
    });

    test('.env.example contains all required variables', () => {
      const envExamplePath = resolve(rootDir, '.env.example');
      const content = readFileSync(envExamplePath, 'utf-8');

      // Required variables should be present (commented or not)
      const requiredVars = [
        'NODE_ENV',
        'DATABASE_URL',
        'LOG_LEVEL',
        'OTEL_SERVICE_NAME',
        'REDIS_URL',
        'OTEL_EXPORTER_OTLP_ENDPOINT',
      ];

      for (const varName of requiredVars) {
        expect(content).toContain(varName);
      }
    });

    test('.env.example does not contain actual secret values', () => {
      const envExamplePath = resolve(rootDir, '.env.example');
      const content = readFileSync(envExamplePath, 'utf-8');

      // Should not contain actual passwords or tokens
      expect(content).not.toMatch(/password123|secret123|sk-[a-zA-Z0-9]+/i);

      // Should contain placeholder values or be commented
      expect(content).toMatch(/your[-_]|example|placeholder|<.*>/i);
    });
  });

  describe('package.json has zod dependency', () => {
    test('packages/core/package.json includes zod dependency', () => {
      const pkgPath = resolve(coreDir, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

      expect(pkg.dependencies?.zod || pkg.devDependencies?.zod).toBeDefined();
    });
  });

  describe('env.ts is exported from core index', () => {
    test('packages/core/src/index.ts exports env module', () => {
      const indexPath = resolve(coreDir, 'src', 'index.ts');
      const content = readFileSync(indexPath, 'utf-8');

      expect(content).toContain("./env");
    });
  });
});
