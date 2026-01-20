import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock postgres module before importing connection
vi.mock('postgres', () => {
  const mockEnd = vi.fn().mockResolvedValue(undefined);
  const mockSql = Object.assign(
    vi.fn().mockImplementation(() => Promise.resolve([{ test: 1 }])),
    {
      end: mockEnd,
      unsafe: vi.fn().mockResolvedValue([]),
    }
  );
  return {
    default: vi.fn(() => mockSql),
  };
});

// Mock drizzle-orm
vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe('@rtv/db Connection', () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear environment
    delete process.env['DATABASE_URL'];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getConnectionString', () => {
    test('throws error when DATABASE_URL is not set', async () => {
      const { initializeConnection } = await import('../connection');

      expect(() => initializeConnection()).toThrow(
        'DATABASE_URL environment variable is not set'
      );
    });

    test('returns connection when DATABASE_URL is set', async () => {
      process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

      const { initializeConnection } = await import('../connection');
      const db = initializeConnection();

      expect(db).toBeDefined();
    });
  });

  describe('initializeConnection', () => {
    test('creates database instance', async () => {
      process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

      const { initializeConnection } = await import('../connection');
      const db = initializeConnection();

      expect(db).toBeDefined();
      expect(db.select).toBeDefined();
      expect(db.insert).toBeDefined();
    });

    test('returns same instance on subsequent calls (singleton)', async () => {
      process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

      const { initializeConnection } = await import('../connection');
      const db1 = initializeConnection();
      const db2 = initializeConnection();

      expect(db1).toBe(db2);
    });
  });

  describe('getDb', () => {
    test('initializes connection if not already initialized', async () => {
      process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

      const { getDb } = await import('../connection');
      const db = getDb();

      expect(db).toBeDefined();
    });
  });

  describe('testConnection', () => {
    test('returns true when connection succeeds', async () => {
      process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

      const { testConnection } = await import('../connection');
      const result = await testConnection();

      expect(result).toBe(true);
    });

    test('returns false when DATABASE_URL is not set', async () => {
      const { testConnection } = await import('../connection');
      const result = await testConnection();

      expect(result).toBe(false);
    });
  });

  describe('closeConnection', () => {
    test('closes the connection pool', async () => {
      process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

      const { initializeConnection, closeConnection, getDb } = await import(
        '../connection'
      );

      initializeConnection();
      await closeConnection();

      // After closing, getDb should reinitialize
      const newDb = getDb();
      expect(newDb).toBeDefined();
    });
  });

  describe('executeRawQuery', () => {
    test('executes raw SQL query', async () => {
      process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

      const { executeRawQuery } = await import('../connection');
      const result = await executeRawQuery('SELECT 1');

      expect(result).toEqual([]);
    });
  });
});

describe('@rtv/db Schema', () => {
  test('exports base schema utilities', async () => {
    const schema = await import('../schema');

    expect(schema.timestamps).toBeDefined();
    expect(schema.idColumn).toBeDefined();
    expect(schema.clientIdColumn).toBeDefined();
    expect(schema.healthCheck).toBeDefined();
  });

  test('timestamp columns have correct structure', async () => {
    const { timestamps } = await import('../schema/base');

    expect(timestamps.createdAt).toBeDefined();
    expect(timestamps.updatedAt).toBeDefined();
  });

  test('client ID column enforces multi-tenant pattern', async () => {
    const { clientIdColumn } = await import('../schema/base');

    expect(clientIdColumn.clientId).toBeDefined();
  });
});

describe('@rtv/db Package Exports', () => {
  test('exports connection utilities', async () => {
    const db = await import('../index');

    expect(db.initializeConnection).toBeDefined();
    expect(db.getDb).toBeDefined();
    expect(db.testConnection).toBeDefined();
    expect(db.closeConnection).toBeDefined();
    expect(db.executeRawQuery).toBeDefined();
  });

  test('exports VERSION constant', async () => {
    const db = await import('../index');

    expect(db.VERSION).toBe('0.0.0');
  });
});
