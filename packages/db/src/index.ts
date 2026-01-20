/**
 * @rtv/db - Database schemas, migrations, and connection pool
 *
 * This package provides:
 * - Drizzle ORM schemas with multi-tenant patterns
 * - Database migrations via Drizzle Kit
 * - Connection pool management with postgres.js
 * - Type-safe query helpers
 * - Multi-tenant scoping utilities
 * - Row-Level Security (RLS) helpers
 */

// Connection management
export {
  initializeConnection,
  getDb,
  testConnection,
  closeConnection,
  executeRawQuery,
  type PostgresJsDatabase,
} from './connection.js';

// Schema exports
export * from './schema/index.js';

// Multi-tenant utilities
export {
  // Error class
  TenantAccessError,
  // Scoped database wrapper
  withTenantScope,
  // Standalone scoped functions
  scopedQuery,
  scopedInsert,
  scopedUpdate,
  scopedDelete,
  // Ownership validation
  assertTenantOwnership,
  checkTenantOwnership,
  // Utility functions
  isValidClientId,
  generateCorrelationId,
  // Types
  type TenantTable,
  type TenantRecord,
  type TenantContext,
  type ScopedDatabase,
} from './tenant.js';

// RLS utilities
export {
  // Constants
  RLS_TENANT_VAR,
  // Context management
  setTenantContext,
  clearTenantContext,
  getTenantContext,
  // Context wrappers
  withRlsContext,
  withRlsTransaction,
  // SQL helpers
  rlsPolicySql,
  // Types
  type RlsContextConfig,
  type RlsContextResult,
} from './rls.js';

// Seed utilities (for dev/test environments)
export {
  seed,
  clearSeedData,
  reseed,
  SEED_CLIENTS,
  getSeedClientBySlug,
  getSeedClientSlugs,
  type SeedClient,
  type SeedResult,
} from './seed/index.js';

// Version
export const VERSION = '0.0.0';
