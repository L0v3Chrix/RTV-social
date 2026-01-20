-- Migration: 0002_rls_policies
-- Description: Enable Row-Level Security (RLS) policies for multi-tenant tables
-- Author: RTV Social Automation
-- Date: 2025-01-19
--
-- This migration adds RLS policies to all tenant-scoped tables.
-- RLS provides database-level tenant isolation in addition to
-- application-level scoping implemented in tenant.ts.
--
-- Prerequisites:
-- - Session variable 'app.current_client_id' must be set before queries
-- - Application must use setTenantContext() from rls.ts
--
-- Tables affected:
-- - brand_kits (client_id column)
-- - knowledge_bases (client_id column)
-- - knowledge_chunks (client_id column)

-- ============================================================================
-- Brand Kits Table RLS
-- ============================================================================

-- Enable RLS on brand_kits
ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (prevents bypassing in development)
ALTER TABLE brand_kits FORCE ROW LEVEL SECURITY;

-- SELECT policy: Only return rows where client_id matches session context
CREATE POLICY brand_kits_tenant_select ON brand_kits
    FOR SELECT
    USING (client_id::text = current_setting('app.current_client_id', true));

-- INSERT policy: Only allow inserting rows with matching client_id
CREATE POLICY brand_kits_tenant_insert ON brand_kits
    FOR INSERT
    WITH CHECK (client_id::text = current_setting('app.current_client_id', true));

-- UPDATE policy: Only allow updating rows with matching client_id
-- Prevents changing client_id during update
CREATE POLICY brand_kits_tenant_update ON brand_kits
    FOR UPDATE
    USING (client_id::text = current_setting('app.current_client_id', true))
    WITH CHECK (client_id::text = current_setting('app.current_client_id', true));

-- DELETE policy: Only allow deleting rows with matching client_id
CREATE POLICY brand_kits_tenant_delete ON brand_kits
    FOR DELETE
    USING (client_id::text = current_setting('app.current_client_id', true));

-- ============================================================================
-- Knowledge Bases Table RLS
-- ============================================================================

-- Enable RLS on knowledge_bases
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners
ALTER TABLE knowledge_bases FORCE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY knowledge_bases_tenant_select ON knowledge_bases
    FOR SELECT
    USING (client_id::text = current_setting('app.current_client_id', true));

-- INSERT policy
CREATE POLICY knowledge_bases_tenant_insert ON knowledge_bases
    FOR INSERT
    WITH CHECK (client_id::text = current_setting('app.current_client_id', true));

-- UPDATE policy
CREATE POLICY knowledge_bases_tenant_update ON knowledge_bases
    FOR UPDATE
    USING (client_id::text = current_setting('app.current_client_id', true))
    WITH CHECK (client_id::text = current_setting('app.current_client_id', true));

-- DELETE policy
CREATE POLICY knowledge_bases_tenant_delete ON knowledge_bases
    FOR DELETE
    USING (client_id::text = current_setting('app.current_client_id', true));

-- ============================================================================
-- Knowledge Chunks Table RLS
-- ============================================================================

-- Enable RLS on knowledge_chunks
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners
ALTER TABLE knowledge_chunks FORCE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY knowledge_chunks_tenant_select ON knowledge_chunks
    FOR SELECT
    USING (client_id::text = current_setting('app.current_client_id', true));

-- INSERT policy
CREATE POLICY knowledge_chunks_tenant_insert ON knowledge_chunks
    FOR INSERT
    WITH CHECK (client_id::text = current_setting('app.current_client_id', true));

-- UPDATE policy
CREATE POLICY knowledge_chunks_tenant_update ON knowledge_chunks
    FOR UPDATE
    USING (client_id::text = current_setting('app.current_client_id', true))
    WITH CHECK (client_id::text = current_setting('app.current_client_id', true));

-- DELETE policy
CREATE POLICY knowledge_chunks_tenant_delete ON knowledge_chunks
    FOR DELETE
    USING (client_id::text = current_setting('app.current_client_id', true));

-- ============================================================================
-- Rollback Script (for reference, not executed)
-- ============================================================================
-- To rollback this migration, run:
--
-- DROP POLICY IF EXISTS brand_kits_tenant_select ON brand_kits;
-- DROP POLICY IF EXISTS brand_kits_tenant_insert ON brand_kits;
-- DROP POLICY IF EXISTS brand_kits_tenant_update ON brand_kits;
-- DROP POLICY IF EXISTS brand_kits_tenant_delete ON brand_kits;
-- ALTER TABLE brand_kits DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS knowledge_bases_tenant_select ON knowledge_bases;
-- DROP POLICY IF EXISTS knowledge_bases_tenant_insert ON knowledge_bases;
-- DROP POLICY IF EXISTS knowledge_bases_tenant_update ON knowledge_bases;
-- DROP POLICY IF EXISTS knowledge_bases_tenant_delete ON knowledge_bases;
-- ALTER TABLE knowledge_bases DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS knowledge_chunks_tenant_select ON knowledge_chunks;
-- DROP POLICY IF EXISTS knowledge_chunks_tenant_insert ON knowledge_chunks;
-- DROP POLICY IF EXISTS knowledge_chunks_tenant_update ON knowledge_chunks;
-- DROP POLICY IF EXISTS knowledge_chunks_tenant_delete ON knowledge_chunks;
-- ALTER TABLE knowledge_chunks DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Notes on Usage
-- ============================================================================
--
-- Before executing any query on these tables, the application must set
-- the tenant context using the session variable:
--
--   SELECT set_config('app.current_client_id', '<client-uuid>', false);
--
-- This is handled automatically by the RLS utilities in rls.ts:
--
--   import { setTenantContext, withRlsContext } from '@rtv/db';
--
--   // Option 1: Manual context management
--   await setTenantContext(db, { clientId: 'client-uuid' });
--   const results = await db.select().from(brandKits);
--   await clearTenantContext(db);
--
--   // Option 2: Automatic context management
--   const results = await withRlsContext(db, 'client-uuid', async () => {
--     return db.select().from(brandKits);
--   });
--
-- The application-level scoping in tenant.ts provides an additional
-- layer of protection by filtering queries before they reach the database.
-- RLS acts as a safety net to catch any queries that bypass the application layer.
