import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock postgres module before importing
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
const mockSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => Promise.resolve([])),
  })),
}));

const mockInsert = vi.fn(() => ({
  values: vi.fn(() => Promise.resolve()),
}));

const mockUpdate = vi.fn(() => ({
  set: vi.fn(() => ({
    where: vi.fn(() => Promise.resolve()),
  })),
}));

const mockDelete = vi.fn(() => ({
  where: vi.fn(() => Promise.resolve()),
}));

const mockExecute = vi.fn(() => Promise.resolve([{ client_id: 'test-client-id' }]));

const mockTransaction = vi.fn((fn) => fn({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  execute: mockExecute,
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    execute: mockExecute,
    transaction: mockTransaction,
  })),
}));

// Mock drizzle-orm eq and and functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ type: 'eq', column: col, value: val })),
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  sql: Object.assign(
    vi.fn((strings, ...values) => ({ strings, values })),
    {
      raw: vi.fn((str) => ({ raw: str })),
    }
  ),
}));

describe('@rtv/db Multi-Tenant Utilities', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env['DATABASE_URL'];
  });

  describe('TenantAccessError', () => {
    test('creates error with all properties', async () => {
      const { TenantAccessError } = await import('../tenant');

      const error = new TenantAccessError(
        'Access denied',
        'client-123',
        'BrandKit',
        'kit-456',
        'corr-789'
      );

      expect(error.message).toBe('Access denied');
      expect(error.name).toBe('TenantAccessError');
      expect(error.code).toBe('TENANT_ACCESS_ERROR');
      expect(error.clientId).toBe('client-123');
      expect(error.resourceType).toBe('BrandKit');
      expect(error.resourceId).toBe('kit-456');
      expect(error.correlationId).toBe('corr-789');
    });

    test('generates correlation ID if not provided', async () => {
      const { TenantAccessError } = await import('../tenant');

      const error = new TenantAccessError(
        'Access denied',
        'client-123',
        'BrandKit'
      );

      expect(error.correlationId).toBeDefined();
      expect(error.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    test('toJSON returns serializable object', async () => {
      const { TenantAccessError } = await import('../tenant');

      const error = new TenantAccessError(
        'Access denied',
        'client-123',
        'BrandKit',
        'kit-456',
        'corr-789'
      );

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'TenantAccessError',
        code: 'TENANT_ACCESS_ERROR',
        message: 'Access denied',
        clientId: 'client-123',
        resourceType: 'BrandKit',
        resourceId: 'kit-456',
        correlationId: 'corr-789',
      });
    });
  });

  describe('withTenantScope', () => {
    test('throws error when clientId is empty', async () => {
      const { withTenantScope, TenantAccessError } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();

      expect(() => withTenantScope(db, '')).toThrow(TenantAccessError);
      expect(() => withTenantScope(db, '')).toThrow(
        'Client ID is required for tenant-scoped operations'
      );
    });

    test('creates scoped database wrapper with context', async () => {
      const { withTenantScope } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const scopedDb = withTenantScope(db, 'client-123', 'corr-456');

      expect(scopedDb.db).toBe(db);
      expect(scopedDb.context.clientId).toBe('client-123');
      expect(scopedDb.context.correlationId).toBe('corr-456');
    });

    test('generates correlationId if not provided', async () => {
      const { withTenantScope } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const scopedDb = withTenantScope(db, 'client-123');

      expect(scopedDb.context.correlationId).toBeDefined();
      expect(scopedDb.context.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    test('scopedSelect returns query', async () => {
      const { withTenantScope } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const scopedDb = withTenantScope(db, 'client-123');

      // Create a mock table with clientId
      const mockTable = {
        clientId: { name: 'client_id' },
      };

      // scopedSelect now takes table and optional conditions directly
      const result = scopedDb.scopedSelect(mockTable as any);
      expect(result).toBeDefined();
    });

    test('scopedInsert returns insert query', async () => {
      const { withTenantScope } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const scopedDb = withTenantScope(db, 'client-123');

      const mockTable = {
        clientId: { name: 'client_id' },
      };

      // scopedInsert now takes table and data directly
      const result = scopedDb.scopedInsert(mockTable as any, { name: 'Test' });
      expect(result).toBeDefined();
    });

    test('scopedUpdate returns update query', async () => {
      const { withTenantScope } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const scopedDb = withTenantScope(db, 'client-123');

      const mockTable = {
        clientId: { name: 'client_id' },
      };

      // scopedUpdate now takes table, data, and optional conditions directly
      const result = scopedDb.scopedUpdate(mockTable as any, { name: 'Updated' });
      expect(result).toBeDefined();
    });

    test('scopedDelete returns delete query', async () => {
      const { withTenantScope } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const scopedDb = withTenantScope(db, 'client-123');

      const mockTable = {
        clientId: { name: 'client_id' },
      };

      // scopedDelete now takes table and optional conditions directly
      const result = scopedDb.scopedDelete(mockTable as any);
      expect(result).toBeDefined();
    });

    test('transaction creates scoped transaction', async () => {
      const { withTenantScope } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const scopedDb = withTenantScope(db, 'client-123');

      const result = await scopedDb.transaction(async (tx) => {
        expect(tx.context.clientId).toBe('client-123');
        return 'success';
      });

      expect(result).toBe('success');
    });
  });

  describe('Standalone scoped functions', () => {
    test('scopedQuery creates scoped select', async () => {
      const { scopedQuery } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const mockTable = {
        clientId: { name: 'client_id' },
      };

      const result = scopedQuery(db, mockTable as any, 'client-123');
      expect(result).toBeDefined();
    });

    test('scopedInsert creates scoped insert', async () => {
      const { scopedInsert } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const mockTable = {
        clientId: { name: 'client_id' },
      };

      const result = scopedInsert(
        db,
        mockTable as any,
        'client-123',
        { name: 'Test' }
      );
      expect(result).toBeDefined();
    });

    test('scopedInsert handles array of values', async () => {
      const { scopedInsert } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const mockTable = {
        clientId: { name: 'client_id' },
      };

      const result = scopedInsert(
        db,
        mockTable as any,
        'client-123',
        [{ name: 'Test 1' }, { name: 'Test 2' }]
      );
      expect(result).toBeDefined();
    });

    test('scopedUpdate creates scoped update', async () => {
      const { scopedUpdate } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const mockTable = {
        clientId: { name: 'client_id' },
      };

      const result = scopedUpdate(
        db,
        mockTable as any,
        'client-123',
        { name: 'Updated' }
      );
      expect(result).toBeDefined();
    });

    test('scopedDelete creates scoped delete', async () => {
      const { scopedDelete } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const mockTable = {
        clientId: { name: 'client_id' },
      };

      const result = scopedDelete(db, mockTable as any, 'client-123');
      expect(result).toBeDefined();
    });
  });

  describe('assertTenantOwnership', () => {
    test('throws when record is null', async () => {
      const { assertTenantOwnership, TenantAccessError } = await import('../tenant');

      expect(() =>
        assertTenantOwnership(null, 'client-123', 'BrandKit')
      ).toThrow(TenantAccessError);
      expect(() =>
        assertTenantOwnership(null, 'client-123', 'BrandKit')
      ).toThrow('BrandKit not found or access denied');
    });

    test('throws when record is undefined', async () => {
      const { assertTenantOwnership, TenantAccessError } = await import('../tenant');

      expect(() =>
        assertTenantOwnership(undefined, 'client-123', 'BrandKit')
      ).toThrow(TenantAccessError);
    });

    test('throws when clientId does not match', async () => {
      const { assertTenantOwnership, TenantAccessError } = await import('../tenant');

      const record = {
        id: 'kit-456',
        clientId: 'other-client',
        name: 'Test Kit',
      };

      expect(() =>
        assertTenantOwnership(record, 'client-123', 'BrandKit')
      ).toThrow(TenantAccessError);
      expect(() =>
        assertTenantOwnership(record, 'client-123', 'BrandKit')
      ).toThrow('Access denied: BrandKit does not belong to this tenant');
    });

    test('does not throw when clientId matches', async () => {
      const { assertTenantOwnership } = await import('../tenant');

      const record = {
        id: 'kit-456',
        clientId: 'client-123',
        name: 'Test Kit',
      };

      expect(() =>
        assertTenantOwnership(record, 'client-123', 'BrandKit')
      ).not.toThrow();
    });

    test('includes resourceId in error when available', async () => {
      const { assertTenantOwnership, TenantAccessError } = await import('../tenant');

      const record = {
        id: 'kit-456',
        clientId: 'other-client',
        name: 'Test Kit',
      };

      try {
        assertTenantOwnership(record, 'client-123', 'BrandKit');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TenantAccessError);
        expect((error as TenantAccessError).resourceId).toBe('kit-456');
      }
    });
  });

  describe('checkTenantOwnership', () => {
    test('returns false for null record', async () => {
      const { checkTenantOwnership } = await import('../tenant');

      expect(checkTenantOwnership(null, 'client-123')).toBe(false);
    });

    test('returns false for undefined record', async () => {
      const { checkTenantOwnership } = await import('../tenant');

      expect(checkTenantOwnership(undefined, 'client-123')).toBe(false);
    });

    test('returns false when clientId does not match', async () => {
      const { checkTenantOwnership } = await import('../tenant');

      const record = { clientId: 'other-client' };
      expect(checkTenantOwnership(record, 'client-123')).toBe(false);
    });

    test('returns true when clientId matches', async () => {
      const { checkTenantOwnership } = await import('../tenant');

      const record = { clientId: 'client-123' };
      expect(checkTenantOwnership(record, 'client-123')).toBe(true);
    });
  });

  describe('isValidClientId', () => {
    test('returns true for valid UUID', async () => {
      const { isValidClientId } = await import('../tenant');

      expect(isValidClientId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidClientId('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    test('returns false for invalid UUID', async () => {
      const { isValidClientId } = await import('../tenant');

      expect(isValidClientId('')).toBe(false);
      expect(isValidClientId('invalid')).toBe(false);
      expect(isValidClientId('client-123')).toBe(false);
      expect(isValidClientId('550e8400-e29b-41d4-a716')).toBe(false);
    });
  });

  describe('generateCorrelationId', () => {
    test('returns valid UUID', async () => {
      const { generateCorrelationId } = await import('../tenant');

      const id = generateCorrelationId();

      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    test('returns unique IDs', async () => {
      const { generateCorrelationId } = await import('../tenant');

      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      expect(id1).not.toBe(id2);
    });
  });
});

describe('@rtv/db RLS Utilities', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env['DATABASE_URL'];
  });

  describe('RLS_TENANT_VAR', () => {
    test('exports correct session variable name', async () => {
      const { RLS_TENANT_VAR } = await import('../rls');

      expect(RLS_TENANT_VAR).toBe('app.current_client_id');
    });
  });

  describe('setTenantContext', () => {
    test('sets tenant context with valid UUID', async () => {
      const { setTenantContext } = await import('../rls');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const result = await setTenantContext(db, {
        clientId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
      expect(result.clientId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.correlationId).toBeDefined();
    });

    test('throws error for invalid UUID when validation enabled', async () => {
      const { setTenantContext } = await import('../rls');
      const { TenantAccessError } = await import('../tenant');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();

      await expect(
        setTenantContext(db, { clientId: 'invalid-uuid' })
      ).rejects.toThrow(TenantAccessError);
    });

    test('allows invalid UUID when validation disabled', async () => {
      const { setTenantContext } = await import('../rls');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const result = await setTenantContext(db, {
        clientId: 'any-string',
        validateClientId: false,
      });

      expect(result.success).toBe(true);
      expect(result.clientId).toBe('any-string');
    });
  });

  describe('clearTenantContext', () => {
    test('clears tenant context', async () => {
      const { clearTenantContext } = await import('../rls');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();

      await expect(clearTenantContext(db)).resolves.toBeUndefined();
    });
  });

  describe('getTenantContext', () => {
    test('returns current tenant context', async () => {
      const { getTenantContext } = await import('../rls');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const result = await getTenantContext(db);

      // Mock returns 'test-client-id'
      expect(result).toBe('test-client-id');
    });
  });

  describe('withRlsContext', () => {
    test('executes function with RLS context', async () => {
      const { withRlsContext } = await import('../rls');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const result = await withRlsContext(
        db,
        '550e8400-e29b-41d4-a716-446655440000',
        async () => 'executed'
      );

      expect(result).toBe('executed');
    });

    test('clears context after execution', async () => {
      const { withRlsContext } = await import('../rls');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();

      await withRlsContext(
        db,
        '550e8400-e29b-41d4-a716-446655440000',
        async () => 'executed'
      );

      // Mock execute should have been called to clear context
      expect(mockExecute).toHaveBeenCalled();
    });

    test('clears context even on error', async () => {
      const { withRlsContext } = await import('../rls');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();

      await expect(
        withRlsContext(
          db,
          '550e8400-e29b-41d4-a716-446655440000',
          async () => {
            throw new Error('Test error');
          }
        )
      ).rejects.toThrow('Test error');

      // Context should still be cleared
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('withRlsTransaction', () => {
    test('executes function within transaction', async () => {
      const { withRlsTransaction } = await import('../rls');
      const { initializeConnection } = await import('../connection');

      const db = initializeConnection();
      const result = await withRlsTransaction(
        db,
        '550e8400-e29b-41d4-a716-446655440000',
        async () => 'executed in tx'
      );

      expect(result).toBe('executed in tx');
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('rlsPolicySql', () => {
    test('enableRls generates correct SQL', async () => {
      const { rlsPolicySql } = await import('../rls');

      const sql = rlsPolicySql.enableRls('brand_kits');
      expect(sql.raw).toContain('ENABLE ROW LEVEL SECURITY');
    });

    test('forceRls generates correct SQL', async () => {
      const { rlsPolicySql } = await import('../rls');

      const sql = rlsPolicySql.forceRls('brand_kits');
      expect(sql.raw).toContain('FORCE ROW LEVEL SECURITY');
    });

    test('createSelectPolicy generates correct SQL', async () => {
      const { rlsPolicySql } = await import('../rls');

      const sql = rlsPolicySql.createSelectPolicy('brand_kits', 'tenant_select');
      expect(sql.raw).toContain('CREATE POLICY');
      expect(sql.raw).toContain('FOR SELECT');
      expect(sql.raw).toContain('app.current_client_id');
    });

    test('createInsertPolicy generates correct SQL', async () => {
      const { rlsPolicySql } = await import('../rls');

      const sql = rlsPolicySql.createInsertPolicy('brand_kits', 'tenant_insert');
      expect(sql.raw).toContain('FOR INSERT');
      expect(sql.raw).toContain('WITH CHECK');
    });

    test('createUpdatePolicy generates correct SQL', async () => {
      const { rlsPolicySql } = await import('../rls');

      const sql = rlsPolicySql.createUpdatePolicy('brand_kits', 'tenant_update');
      expect(sql.raw).toContain('FOR UPDATE');
      expect(sql.raw).toContain('USING');
      expect(sql.raw).toContain('WITH CHECK');
    });

    test('createDeletePolicy generates correct SQL', async () => {
      const { rlsPolicySql } = await import('../rls');

      const sql = rlsPolicySql.createDeletePolicy('brand_kits', 'tenant_delete');
      expect(sql.raw).toContain('FOR DELETE');
      expect(sql.raw).toContain('USING');
    });

    test('createAllPolicies returns array of SQL statements', async () => {
      const { rlsPolicySql } = await import('../rls');

      const statements = rlsPolicySql.createAllPolicies('brand_kits');
      expect(statements).toHaveLength(6);
      expect(statements[0].raw).toContain('ENABLE ROW LEVEL SECURITY');
      expect(statements[1].raw).toContain('FORCE ROW LEVEL SECURITY');
    });

    test('dropAllPolicies returns array of drop statements', async () => {
      const { rlsPolicySql } = await import('../rls');

      const statements = rlsPolicySql.dropAllPolicies('brand_kits');
      expect(statements).toHaveLength(5);
      expect(statements[0].raw).toContain('DROP POLICY');
      expect(statements[4].raw).toContain('DISABLE ROW LEVEL SECURITY');
    });
  });
});

describe('@rtv/db Multi-Tenant Export Verification', () => {
  test('exports TenantAccessError', async () => {
    const tenant = await import('../tenant');
    expect(tenant.TenantAccessError).toBeDefined();
  });

  test('exports withTenantScope', async () => {
    const tenant = await import('../tenant');
    expect(tenant.withTenantScope).toBeDefined();
  });

  test('exports standalone scoped functions', async () => {
    const tenant = await import('../tenant');
    expect(tenant.scopedQuery).toBeDefined();
    expect(tenant.scopedInsert).toBeDefined();
    expect(tenant.scopedUpdate).toBeDefined();
    expect(tenant.scopedDelete).toBeDefined();
  });

  test('exports ownership validation functions', async () => {
    const tenant = await import('../tenant');
    expect(tenant.assertTenantOwnership).toBeDefined();
    expect(tenant.checkTenantOwnership).toBeDefined();
  });

  test('exports utility functions', async () => {
    const tenant = await import('../tenant');
    expect(tenant.isValidClientId).toBeDefined();
    expect(tenant.generateCorrelationId).toBeDefined();
  });

  test('exports RLS utilities', async () => {
    const rls = await import('../rls');
    expect(rls.RLS_TENANT_VAR).toBeDefined();
    expect(rls.setTenantContext).toBeDefined();
    expect(rls.clearTenantContext).toBeDefined();
    expect(rls.getTenantContext).toBeDefined();
    expect(rls.withRlsContext).toBeDefined();
    expect(rls.withRlsTransaction).toBeDefined();
    expect(rls.rlsPolicySql).toBeDefined();
  });
});
