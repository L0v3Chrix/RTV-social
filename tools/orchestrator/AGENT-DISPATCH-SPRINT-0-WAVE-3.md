# Agent Dispatch Prompts - Sprint 0 Wave 3

> **Generated:** 2026-01-16
> **Status:** 3 parallel tasks ready for execution
> **Progress:** Sprint 0 at 70% (14/20 done)
> **Tests:** 270 passing

---

## Agent A: S0-B4 - Audit Event Schema

```
You are implementing task S0-B4: Audit Event Schema for the RTV Social Automation project.

## Context
This is a Turborepo monorepo using pnpm workspaces. Multi-tenant schemas with RLS are complete (S0-B3). This task creates the foundation for comprehensive audit logging.

## Task Requirements
Design and implement audit event schemas for tracking all system activities:

1. **Audit Event Types** (packages/schemas/src/audit/event-types.ts)
   ```typescript
   export const AuditEventCategory = {
     AUTH: 'auth',
     DATA: 'data',
     ADMIN: 'admin',
     SYSTEM: 'system',
     INTEGRATION: 'integration',
     CONTENT: 'content',
     BILLING: 'billing'
   } as const;

   export type AuditEventCategory = typeof AuditEventCategory[keyof typeof AuditEventCategory];

   export const AuditEventAction = {
     // Auth events
     LOGIN: 'login',
     LOGOUT: 'logout',
     LOGIN_FAILED: 'login_failed',
     PASSWORD_CHANGED: 'password_changed',
     MFA_ENABLED: 'mfa_enabled',
     MFA_DISABLED: 'mfa_disabled',
     API_KEY_CREATED: 'api_key_created',
     API_KEY_REVOKED: 'api_key_revoked',

     // Data events
     CREATE: 'create',
     READ: 'read',
     UPDATE: 'update',
     DELETE: 'delete',
     EXPORT: 'export',
     IMPORT: 'import',

     // Admin events
     USER_INVITED: 'user_invited',
     USER_REMOVED: 'user_removed',
     ROLE_CHANGED: 'role_changed',
     SETTINGS_CHANGED: 'settings_changed',
     PERMISSIONS_CHANGED: 'permissions_changed',

     // System events
     SCHEDULED_JOB: 'scheduled_job',
     WEBHOOK_RECEIVED: 'webhook_received',
     RATE_LIMITED: 'rate_limited',
     ERROR_OCCURRED: 'error_occurred',

     // Integration events
     CONNECTED: 'connected',
     DISCONNECTED: 'disconnected',
     SYNC_STARTED: 'sync_started',
     SYNC_COMPLETED: 'sync_completed',
     SYNC_FAILED: 'sync_failed',

     // Content events
     CONTENT_CREATED: 'content_created',
     CONTENT_PUBLISHED: 'content_published',
     CONTENT_SCHEDULED: 'content_scheduled',
     CONTENT_DELETED: 'content_deleted',
     CAMPAIGN_STARTED: 'campaign_started',
     CAMPAIGN_PAUSED: 'campaign_paused',
     CAMPAIGN_COMPLETED: 'campaign_completed'
   } as const;

   export type AuditEventAction = typeof AuditEventAction[keyof typeof AuditEventAction];
   ```

2. **Audit Event Schema** (packages/schemas/src/audit/event-schema.ts)
   ```typescript
   import { z } from 'zod';
   import { createId } from '@paralleldrive/cuid2';

   export const auditEventSchema = z.object({
     id: z.string().default(() => createId()),
     timestamp: z.date().default(() => new Date()),

     // Who
     clientId: z.string().cuid2(),
     userId: z.string().cuid2().nullable(),
     actorType: z.enum(['user', 'system', 'api_key', 'webhook']),
     actorId: z.string(),
     actorIp: z.string().ip().nullable(),
     actorUserAgent: z.string().nullable(),

     // What
     category: z.nativeEnum(AuditEventCategory),
     action: z.nativeEnum(AuditEventAction),
     resourceType: z.string(),
     resourceId: z.string().nullable(),

     // Details
     description: z.string(),
     metadata: z.record(z.unknown()).default({}),
     previousState: z.record(z.unknown()).nullable(),
     newState: z.record(z.unknown()).nullable(),

     // Context
     requestId: z.string().nullable(),
     sessionId: z.string().nullable(),
     traceId: z.string().nullable(),

     // Outcome
     status: z.enum(['success', 'failure', 'partial']),
     errorCode: z.string().nullable(),
     errorMessage: z.string().nullable(),

     // Compliance
     sensitiveDataAccessed: z.boolean().default(false),
     piiAccessed: z.boolean().default(false),
     retentionDays: z.number().int().positive().default(90)
   });

   export type AuditEvent = z.infer<typeof auditEventSchema>;
   export type AuditEventInput = z.input<typeof auditEventSchema>;
   ```

3. **Drizzle Schema** (packages/database/src/schema/audit-events.ts)
   ```typescript
   import { pgTable, text, timestamp, jsonb, boolean, integer, index } from 'drizzle-orm/pg-core';
   import { createId } from '@paralleldrive/cuid2';

   export const auditEvents = pgTable('audit_events', {
     id: text('id').primaryKey().$defaultFn(() => createId()),
     timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),

     // Who
     clientId: text('client_id').notNull(),
     userId: text('user_id'),
     actorType: text('actor_type').notNull(),
     actorId: text('actor_id').notNull(),
     actorIp: text('actor_ip'),
     actorUserAgent: text('actor_user_agent'),

     // What
     category: text('category').notNull(),
     action: text('action').notNull(),
     resourceType: text('resource_type').notNull(),
     resourceId: text('resource_id'),

     // Details
     description: text('description').notNull(),
     metadata: jsonb('metadata').default({}),
     previousState: jsonb('previous_state'),
     newState: jsonb('new_state'),

     // Context
     requestId: text('request_id'),
     sessionId: text('session_id'),
     traceId: text('trace_id'),

     // Outcome
     status: text('status').notNull(),
     errorCode: text('error_code'),
     errorMessage: text('error_message'),

     // Compliance
     sensitiveDataAccessed: boolean('sensitive_data_accessed').default(false),
     piiAccessed: boolean('pii_accessed').default(false),
     retentionDays: integer('retention_days').default(90),

     // Timestamps
     createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
   }, (table) => ({
     clientIdIdx: index('audit_events_client_id_idx').on(table.clientId),
     timestampIdx: index('audit_events_timestamp_idx').on(table.timestamp),
     categoryActionIdx: index('audit_events_category_action_idx').on(table.category, table.action),
     resourceIdx: index('audit_events_resource_idx').on(table.resourceType, table.resourceId),
     userIdIdx: index('audit_events_user_id_idx').on(table.userId),
     traceIdIdx: index('audit_events_trace_id_idx').on(table.traceId)
   }));

   export type AuditEventRecord = typeof auditEvents.$inferSelect;
   export type NewAuditEventRecord = typeof auditEvents.$inferInsert;
   ```

4. **Audit Event Builder** (packages/core/src/audit/event-builder.ts)
   ```typescript
   export class AuditEventBuilder {
     private event: Partial<AuditEventInput> = {};

     static create(): AuditEventBuilder {
       return new AuditEventBuilder();
     }

     forClient(clientId: string): this {
       this.event.clientId = clientId;
       return this;
     }

     byUser(userId: string): this {
       this.event.userId = userId;
       this.event.actorType = 'user';
       this.event.actorId = userId;
       return this;
     }

     bySystem(systemId: string = 'system'): this {
       this.event.actorType = 'system';
       this.event.actorId = systemId;
       return this;
     }

     byApiKey(keyId: string): this {
       this.event.actorType = 'api_key';
       this.event.actorId = keyId;
       return this;
     }

     withIp(ip: string): this {
       this.event.actorIp = ip;
       return this;
     }

     withUserAgent(userAgent: string): this {
       this.event.actorUserAgent = userAgent;
       return this;
     }

     action(category: AuditEventCategory, action: AuditEventAction): this {
       this.event.category = category;
       this.event.action = action;
       return this;
     }

     onResource(type: string, id?: string): this {
       this.event.resourceType = type;
       this.event.resourceId = id ?? null;
       return this;
     }

     describe(description: string): this {
       this.event.description = description;
       return this;
     }

     withMetadata(metadata: Record<string, unknown>): this {
       this.event.metadata = { ...this.event.metadata, ...metadata };
       return this;
     }

     withStateChange(previous: Record<string, unknown> | null, next: Record<string, unknown> | null): this {
       this.event.previousState = previous;
       this.event.newState = next;
       return this;
     }

     withContext(context: { requestId?: string; sessionId?: string; traceId?: string }): this {
       this.event.requestId = context.requestId ?? null;
       this.event.sessionId = context.sessionId ?? null;
       this.event.traceId = context.traceId ?? null;
       return this;
     }

     success(): this {
       this.event.status = 'success';
       return this;
     }

     failure(code: string, message: string): this {
       this.event.status = 'failure';
       this.event.errorCode = code;
       this.event.errorMessage = message;
       return this;
     }

     partial(): this {
       this.event.status = 'partial';
       return this;
     }

     accessedSensitiveData(): this {
       this.event.sensitiveDataAccessed = true;
       return this;
     }

     accessedPii(): this {
       this.event.piiAccessed = true;
       this.event.sensitiveDataAccessed = true;
       return this;
     }

     retainFor(days: number): this {
       this.event.retentionDays = days;
       return this;
     }

     build(): AuditEvent {
       return auditEventSchema.parse(this.event);
     }
   }
   ```

5. **Migration** (packages/database/drizzle/migrations/XXXX_audit_events.sql)
   ```sql
   CREATE TABLE IF NOT EXISTS audit_events (
     id TEXT PRIMARY KEY,
     timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

     client_id TEXT NOT NULL,
     user_id TEXT,
     actor_type TEXT NOT NULL,
     actor_id TEXT NOT NULL,
     actor_ip TEXT,
     actor_user_agent TEXT,

     category TEXT NOT NULL,
     action TEXT NOT NULL,
     resource_type TEXT NOT NULL,
     resource_id TEXT,

     description TEXT NOT NULL,
     metadata JSONB DEFAULT '{}',
     previous_state JSONB,
     new_state JSONB,

     request_id TEXT,
     session_id TEXT,
     trace_id TEXT,

     status TEXT NOT NULL,
     error_code TEXT,
     error_message TEXT,

     sensitive_data_accessed BOOLEAN DEFAULT FALSE,
     pii_accessed BOOLEAN DEFAULT FALSE,
     retention_days INTEGER DEFAULT 90,

     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   -- Indexes for common queries
   CREATE INDEX audit_events_client_id_idx ON audit_events(client_id);
   CREATE INDEX audit_events_timestamp_idx ON audit_events(timestamp DESC);
   CREATE INDEX audit_events_category_action_idx ON audit_events(category, action);
   CREATE INDEX audit_events_resource_idx ON audit_events(resource_type, resource_id);
   CREATE INDEX audit_events_user_id_idx ON audit_events(user_id);
   CREATE INDEX audit_events_trace_id_idx ON audit_events(trace_id);

   -- Partitioning by month for large-scale deployments (optional)
   -- CREATE TABLE audit_events_y2024m01 PARTITION OF audit_events
   --   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

   -- RLS Policy
   ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

   CREATE POLICY audit_events_tenant_isolation ON audit_events
     USING (client_id = current_setting('app.current_client_id', true));

   -- Retention cleanup function
   CREATE OR REPLACE FUNCTION cleanup_expired_audit_events()
   RETURNS INTEGER AS $$
   DECLARE
     deleted_count INTEGER;
   BEGIN
     DELETE FROM audit_events
     WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
     GET DIAGNOSTICS deleted_count = ROW_COUNT;
     RETURN deleted_count;
   END;
   $$ LANGUAGE plpgsql;
   ```

## TDD Requirements
Create packages/schemas/src/audit/__tests__/audit-events.test.ts:

### RED Phase - Write failing tests:
```typescript
import { describe, it, expect } from 'vitest';
import { auditEventSchema, AuditEvent } from '../event-schema';
import { AuditEventCategory, AuditEventAction } from '../event-types';
import { AuditEventBuilder } from '@rtv/core/audit/event-builder';

describe('Audit Event Schema', () => {
  describe('auditEventSchema', () => {
    it('should validate complete audit event', () => {
      const event = {
        clientId: 'clxxxxxxxxxxxxxxxxxx001',
        userId: 'clxxxxxxxxxxxxxxxxxx002',
        actorType: 'user' as const,
        actorId: 'clxxxxxxxxxxxxxxxxxx002',
        actorIp: '192.168.1.1',
        actorUserAgent: 'Mozilla/5.0',
        category: AuditEventCategory.DATA,
        action: AuditEventAction.CREATE,
        resourceType: 'campaign',
        resourceId: 'clxxxxxxxxxxxxxxxxxx003',
        description: 'Created new campaign',
        status: 'success' as const
      };

      const result = auditEventSchema.safeParse(event);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBeDefined();
        expect(result.data.timestamp).toBeInstanceOf(Date);
      }
    });

    it('should set default values', () => {
      const event = {
        clientId: 'clxxxxxxxxxxxxxxxxxx001',
        actorType: 'system' as const,
        actorId: 'scheduler',
        category: AuditEventCategory.SYSTEM,
        action: AuditEventAction.SCHEDULED_JOB,
        resourceType: 'job',
        description: 'Ran scheduled job',
        status: 'success' as const
      };

      const result = auditEventSchema.parse(event);
      expect(result.metadata).toEqual({});
      expect(result.retentionDays).toBe(90);
      expect(result.sensitiveDataAccessed).toBe(false);
    });

    it('should reject invalid IP address', () => {
      const event = {
        clientId: 'clxxxxxxxxxxxxxxxxxx001',
        actorType: 'user' as const,
        actorId: 'user1',
        actorIp: 'invalid-ip',
        category: AuditEventCategory.AUTH,
        action: AuditEventAction.LOGIN,
        resourceType: 'session',
        description: 'User logged in',
        status: 'success' as const
      };

      const result = auditEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    it('should allow null for optional fields', () => {
      const event = {
        clientId: 'clxxxxxxxxxxxxxxxxxx001',
        userId: null,
        actorType: 'api_key' as const,
        actorId: 'key_123',
        actorIp: null,
        category: AuditEventCategory.DATA,
        action: AuditEventAction.READ,
        resourceType: 'report',
        resourceId: null,
        description: 'API access',
        previousState: null,
        newState: null,
        status: 'success' as const
      };

      const result = auditEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('AuditEventCategory', () => {
    it('should have all required categories', () => {
      expect(AuditEventCategory.AUTH).toBe('auth');
      expect(AuditEventCategory.DATA).toBe('data');
      expect(AuditEventCategory.ADMIN).toBe('admin');
      expect(AuditEventCategory.SYSTEM).toBe('system');
      expect(AuditEventCategory.INTEGRATION).toBe('integration');
      expect(AuditEventCategory.CONTENT).toBe('content');
      expect(AuditEventCategory.BILLING).toBe('billing');
    });
  });

  describe('AuditEventAction', () => {
    it('should have auth actions', () => {
      expect(AuditEventAction.LOGIN).toBe('login');
      expect(AuditEventAction.LOGOUT).toBe('logout');
      expect(AuditEventAction.LOGIN_FAILED).toBe('login_failed');
    });

    it('should have CRUD actions', () => {
      expect(AuditEventAction.CREATE).toBe('create');
      expect(AuditEventAction.READ).toBe('read');
      expect(AuditEventAction.UPDATE).toBe('update');
      expect(AuditEventAction.DELETE).toBe('delete');
    });

    it('should have content actions', () => {
      expect(AuditEventAction.CONTENT_CREATED).toBe('content_created');
      expect(AuditEventAction.CONTENT_PUBLISHED).toBe('content_published');
      expect(AuditEventAction.CAMPAIGN_STARTED).toBe('campaign_started');
    });
  });
});

describe('AuditEventBuilder', () => {
  it('should build complete audit event', () => {
    const event = AuditEventBuilder.create()
      .forClient('clxxxxxxxxxxxxxxxxxx001')
      .byUser('clxxxxxxxxxxxxxxxxxx002')
      .withIp('192.168.1.1')
      .action(AuditEventCategory.DATA, AuditEventAction.CREATE)
      .onResource('campaign', 'clxxxxxxxxxxxxxxxxxx003')
      .describe('Created marketing campaign')
      .withMetadata({ campaignName: 'Summer Sale' })
      .success()
      .build();

    expect(event.clientId).toBe('clxxxxxxxxxxxxxxxxxx001');
    expect(event.userId).toBe('clxxxxxxxxxxxxxxxxxx002');
    expect(event.actorType).toBe('user');
    expect(event.category).toBe('data');
    expect(event.action).toBe('create');
    expect(event.status).toBe('success');
    expect(event.metadata).toEqual({ campaignName: 'Summer Sale' });
  });

  it('should build system event', () => {
    const event = AuditEventBuilder.create()
      .forClient('clxxxxxxxxxxxxxxxxxx001')
      .bySystem('cron-scheduler')
      .action(AuditEventCategory.SYSTEM, AuditEventAction.SCHEDULED_JOB)
      .onResource('job', 'cleanup-task')
      .describe('Executed daily cleanup')
      .success()
      .build();

    expect(event.actorType).toBe('system');
    expect(event.actorId).toBe('cron-scheduler');
  });

  it('should build API key event', () => {
    const event = AuditEventBuilder.create()
      .forClient('clxxxxxxxxxxxxxxxxxx001')
      .byApiKey('key_abc123')
      .action(AuditEventCategory.DATA, AuditEventAction.READ)
      .onResource('analytics', 'report-001')
      .describe('Retrieved analytics report')
      .accessedPii()
      .success()
      .build();

    expect(event.actorType).toBe('api_key');
    expect(event.piiAccessed).toBe(true);
    expect(event.sensitiveDataAccessed).toBe(true);
  });

  it('should build failure event', () => {
    const event = AuditEventBuilder.create()
      .forClient('clxxxxxxxxxxxxxxxxxx001')
      .byUser('clxxxxxxxxxxxxxxxxxx002')
      .action(AuditEventCategory.AUTH, AuditEventAction.LOGIN_FAILED)
      .onResource('session')
      .describe('Login attempt failed')
      .failure('INVALID_CREDENTIALS', 'Incorrect password')
      .build();

    expect(event.status).toBe('failure');
    expect(event.errorCode).toBe('INVALID_CREDENTIALS');
    expect(event.errorMessage).toBe('Incorrect password');
  });

  it('should track state changes', () => {
    const previous = { status: 'draft', title: 'Old Title' };
    const next = { status: 'published', title: 'New Title' };

    const event = AuditEventBuilder.create()
      .forClient('clxxxxxxxxxxxxxxxxxx001')
      .byUser('clxxxxxxxxxxxxxxxxxx002')
      .action(AuditEventCategory.CONTENT, AuditEventAction.CONTENT_PUBLISHED)
      .onResource('post', 'post-001')
      .describe('Published blog post')
      .withStateChange(previous, next)
      .success()
      .build();

    expect(event.previousState).toEqual(previous);
    expect(event.newState).toEqual(next);
  });

  it('should include context', () => {
    const event = AuditEventBuilder.create()
      .forClient('clxxxxxxxxxxxxxxxxxx001')
      .byUser('clxxxxxxxxxxxxxxxxxx002')
      .action(AuditEventCategory.DATA, AuditEventAction.UPDATE)
      .onResource('settings')
      .describe('Updated settings')
      .withContext({
        requestId: 'req-123',
        sessionId: 'sess-456',
        traceId: 'trace-789'
      })
      .success()
      .build();

    expect(event.requestId).toBe('req-123');
    expect(event.sessionId).toBe('sess-456');
    expect(event.traceId).toBe('trace-789');
  });

  it('should set custom retention', () => {
    const event = AuditEventBuilder.create()
      .forClient('clxxxxxxxxxxxxxxxxxx001')
      .bySystem()
      .action(AuditEventCategory.BILLING, AuditEventAction.CREATE)
      .onResource('invoice', 'inv-001')
      .describe('Generated invoice')
      .retainFor(365)
      .success()
      .build();

    expect(event.retentionDays).toBe(365);
  });
});
```

### GREEN Phase
Implement all schemas and builder to make tests pass.

### REFACTOR Phase
- Add JSDoc comments
- Export from package index
- Consider adding query helpers

## Deliverables
- [ ] packages/schemas/src/audit/event-types.ts
- [ ] packages/schemas/src/audit/event-schema.ts
- [ ] packages/schemas/src/audit/index.ts
- [ ] packages/database/src/schema/audit-events.ts
- [ ] packages/core/src/audit/event-builder.ts
- [ ] packages/core/src/audit/index.ts
- [ ] Migration file
- [ ] All tests passing

## Verification
```bash
pnpm test --filter=@rtv/schemas -- audit
pnpm test --filter=@rtv/core -- audit
pnpm build
```
```

---

## Agent B: S0-C4 - Vercel Preview Deployments

```
You are implementing task S0-C4: Vercel Preview Deployments for the RTV Social Automation project.

## Context
This is a Turborepo monorepo with GitHub Actions CI already configured. This task sets up automatic preview deployments for pull requests.

## Task Requirements
Configure Vercel for automatic preview deployments:

1. **Vercel Configuration** (vercel.json)
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "version": 2,
     "framework": null,
     "buildCommand": "pnpm build",
     "installCommand": "pnpm install",
     "outputDirectory": "apps/web/dist",
     "github": {
       "enabled": true,
       "autoAlias": true,
       "silent": false
     },
     "build": {
       "env": {
         "TURBO_TEAM": "@rtv",
         "TURBO_REMOTE_ONLY": "true"
       }
     },
     "env": {
       "NODE_ENV": "production"
     },
     "regions": ["iad1"],
     "functions": {
       "apps/api/dist/**/*.js": {
         "runtime": "nodejs20.x",
         "memory": 1024,
         "maxDuration": 30
       }
     }
   }
   ```

2. **GitHub Action for Vercel** (.github/workflows/vercel-preview.yml)
   ```yaml
   name: Vercel Preview Deployment

   on:
     pull_request:
       types: [opened, synchronize, reopened]

   env:
     VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
     VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

   jobs:
     deploy-preview:
       name: Deploy Preview
       runs-on: ubuntu-latest
       permissions:
         contents: read
         pull-requests: write
         deployments: write

       steps:
         - name: Checkout
           uses: actions/checkout@v4

         - name: Setup pnpm
           uses: pnpm/action-setup@v3
           with:
             version: 9

         - name: Setup Node.js
           uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: 'pnpm'

         - name: Install Vercel CLI
           run: pnpm add -g vercel@latest

         - name: Pull Vercel Environment
           run: vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}

         - name: Build Project
           run: vercel build --token=${{ secrets.VERCEL_TOKEN }}
           env:
             TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
             TURBO_TEAM: ${{ vars.TURBO_TEAM }}

         - name: Deploy to Vercel
           id: deploy
           run: |
             url=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
             echo "url=$url" >> $GITHUB_OUTPUT

         - name: Create Deployment Status
           uses: actions/github-script@v7
           with:
             script: |
               const { data: deployment } = await github.rest.repos.createDeployment({
                 owner: context.repo.owner,
                 repo: context.repo.repo,
                 ref: context.sha,
                 environment: 'Preview',
                 auto_merge: false,
                 required_contexts: []
               });

               await github.rest.repos.createDeploymentStatus({
                 owner: context.repo.owner,
                 repo: context.repo.repo,
                 deployment_id: deployment.id,
                 state: 'success',
                 environment_url: '${{ steps.deploy.outputs.url }}',
                 log_url: '${{ steps.deploy.outputs.url }}',
                 description: 'Preview deployment ready'
               });

         - name: Comment on PR
           uses: actions/github-script@v7
           with:
             script: |
               const url = '${{ steps.deploy.outputs.url }}';
               const sha = context.sha.substring(0, 7);

               const body = `## 🚀 Preview Deployment Ready

               | Status | URL |
               |--------|-----|
               | ✅ Ready | [${url}](${url}) |

               **Commit:** \`${sha}\`
               **Branch:** \`${{ github.head_ref }}\`

               <details>
               <summary>📋 Deployment Details</summary>

               - **Framework:** Turborepo + Vite
               - **Region:** iad1 (US East)
               - **Node.js:** 20.x

               </details>`;

               // Find existing comment
               const { data: comments } = await github.rest.issues.listComments({
                 owner: context.repo.owner,
                 repo: context.repo.repo,
                 issue_number: context.issue.number
               });

               const botComment = comments.find(c =>
                 c.user.type === 'Bot' && c.body.includes('Preview Deployment')
               );

               if (botComment) {
                 await github.rest.issues.updateComment({
                   owner: context.repo.owner,
                   repo: context.repo.repo,
                   comment_id: botComment.id,
                   body
                 });
               } else {
                 await github.rest.issues.createComment({
                   owner: context.repo.owner,
                   repo: context.repo.repo,
                   issue_number: context.issue.number,
                   body
                 });
               }
   ```

3. **Production Deployment** (.github/workflows/vercel-production.yml)
   ```yaml
   name: Vercel Production Deployment

   on:
     push:
       branches: [main]

   env:
     VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
     VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

   jobs:
     deploy-production:
       name: Deploy Production
       runs-on: ubuntu-latest
       environment:
         name: Production
         url: ${{ steps.deploy.outputs.url }}

       steps:
         - name: Checkout
           uses: actions/checkout@v4

         - name: Setup pnpm
           uses: pnpm/action-setup@v3
           with:
             version: 9

         - name: Setup Node.js
           uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: 'pnpm'

         - name: Install Vercel CLI
           run: pnpm add -g vercel@latest

         - name: Pull Vercel Environment
           run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

         - name: Build Project
           run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
           env:
             TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
             TURBO_TEAM: ${{ vars.TURBO_TEAM }}

         - name: Deploy to Vercel
           id: deploy
           run: |
             url=$(vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }})
             echo "url=$url" >> $GITHUB_OUTPUT

         - name: Create Release Tag
           if: success()
           run: |
             git tag -a "deploy-$(date +%Y%m%d-%H%M%S)" -m "Production deployment"
             git push origin --tags
   ```

4. **Vercel Ignore** (.vercelignore)
   ```
   # Dependencies
   node_modules/

   # Build outputs (handled by Vercel)
   dist/
   .turbo/

   # Development
   .env*.local
   *.log

   # Testing
   coverage/
   __tests__/
   *.test.ts
   *.spec.ts

   # Documentation
   docs/
   *.md
   !README.md

   # IDE
   .vscode/
   .idea/

   # Git
   .git/
   .gitignore

   # Misc
   .DS_Store
   Thumbs.db
   ```

5. **Setup Script** (scripts/setup-vercel.sh)
   ```bash
   #!/bin/bash
   set -e

   echo "🚀 Setting up Vercel project..."

   # Check for Vercel CLI
   if ! command -v vercel &> /dev/null; then
     echo "Installing Vercel CLI..."
     pnpm add -g vercel
   fi

   # Link project
   echo "Linking Vercel project..."
   vercel link

   # Get project info
   echo ""
   echo "📋 Add these secrets to GitHub:"
   echo "  VERCEL_TOKEN: Create at https://vercel.com/account/tokens"
   echo "  VERCEL_ORG_ID: $(cat .vercel/project.json | jq -r '.orgId')"
   echo "  VERCEL_PROJECT_ID: $(cat .vercel/project.json | jq -r '.projectId')"
   echo ""
   echo "Add this variable to GitHub:"
   echo "  TURBO_TEAM: @your-team-name"
   echo ""
   echo "✅ Vercel setup complete!"
   ```

6. **Environment Template** (.env.vercel.example)
   ```bash
   # Vercel Environment Variables
   # Copy to Vercel Dashboard > Project > Settings > Environment Variables

   # Database
   DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

   # Redis
   REDIS_URL=redis://default:pass@host:6379

   # Authentication
   AUTH_SECRET=generate-a-secure-secret
   AUTH_URL=https://your-app.vercel.app

   # API Keys (use Vercel's encrypted secrets)
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...

   # Feature Flags
   NEXT_PUBLIC_ENABLE_ANALYTICS=true

   # Observability
   OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.your-provider.com
   OTEL_SERVICE_NAME=rtv-automation
   ```

## TDD Requirements
Create .github/__tests__/vercel.test.ts:

### RED Phase - Write failing tests:
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Vercel Configuration', () => {
  const rootDir = process.cwd();

  describe('vercel.json', () => {
    const configPath = join(rootDir, 'vercel.json');

    it('should exist', () => {
      expect(existsSync(configPath)).toBe(true);
    });

    it('should have valid JSON', () => {
      const content = readFileSync(configPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should configure build command', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.buildCommand).toBe('pnpm build');
    });

    it('should configure install command', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.installCommand).toBe('pnpm install');
    });

    it('should enable GitHub integration', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.github?.enabled).toBe(true);
    });

    it('should configure functions runtime', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const fnConfig = Object.values(config.functions || {})[0] as any;
      expect(fnConfig?.runtime).toMatch(/nodejs\d+\.x/);
    });
  });

  describe('vercel-preview.yml', () => {
    const workflowPath = join(rootDir, '.github/workflows/vercel-preview.yml');

    it('should exist', () => {
      expect(existsSync(workflowPath)).toBe(true);
    });

    it('should trigger on pull_request', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('pull_request');
    });

    it('should use Vercel CLI', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('vercel');
    });

    it('should comment on PR', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('createComment');
    });
  });

  describe('vercel-production.yml', () => {
    const workflowPath = join(rootDir, '.github/workflows/vercel-production.yml');

    it('should exist', () => {
      expect(existsSync(workflowPath)).toBe(true);
    });

    it('should trigger on push to main', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('push');
      expect(content).toContain('main');
    });

    it('should deploy with --prod flag', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('--prod');
    });
  });

  describe('.vercelignore', () => {
    const ignorePath = join(rootDir, '.vercelignore');

    it('should exist', () => {
      expect(existsSync(ignorePath)).toBe(true);
    });

    it('should ignore node_modules', () => {
      const content = readFileSync(ignorePath, 'utf-8');
      expect(content).toContain('node_modules');
    });

    it('should ignore test files', () => {
      const content = readFileSync(ignorePath, 'utf-8');
      expect(content).toMatch(/\*\.test\.ts|\*\.spec\.ts/);
    });
  });
});
```

### GREEN Phase
Create all configuration files to make tests pass.

### REFACTOR Phase
- Add deployment notifications to Slack
- Configure preview URL aliases
- Add deployment protection rules

## Deliverables
- [ ] vercel.json
- [ ] .github/workflows/vercel-preview.yml
- [ ] .github/workflows/vercel-production.yml
- [ ] .vercelignore
- [ ] scripts/setup-vercel.sh
- [ ] .env.vercel.example
- [ ] .github/__tests__/vercel.test.ts
- [ ] Documentation in README
- [ ] All tests passing

## Required Secrets (Document in README)
- VERCEL_TOKEN - Vercel API token
- VERCEL_ORG_ID - Organization ID
- VERCEL_PROJECT_ID - Project ID

## Verification
```bash
pnpm test -- vercel
chmod +x scripts/setup-vercel.sh
```
```

---

## Agent C: S0-C5 - Environment Variable Management

```
You are implementing task S0-C5: Environment Variable Management for the RTV Social Automation project.

## Context
This is a Turborepo monorepo. Configuration management foundations exist. This task creates a robust system for managing environment variables across environments.

## Task Requirements
Implement comprehensive environment variable management:

1. **Environment Schema** (packages/config/src/env/schema.ts)
   ```typescript
   import { z } from 'zod';

   // Base environment variables (all environments)
   export const baseEnvSchema = z.object({
     NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
     LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
     TZ: z.string().default('UTC')
   });

   // Database configuration
   export const databaseEnvSchema = z.object({
     DATABASE_URL: z.string().url(),
     DATABASE_POOL_MIN: z.coerce.number().int().min(1).default(2),
     DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
     DATABASE_SSL: z.coerce.boolean().default(true)
   });

   // Redis configuration
   export const redisEnvSchema = z.object({
     REDIS_URL: z.string().url(),
     REDIS_TLS: z.coerce.boolean().default(true),
     REDIS_KEY_PREFIX: z.string().default('rtv:')
   });

   // Authentication
   export const authEnvSchema = z.object({
     AUTH_SECRET: z.string().min(32),
     AUTH_URL: z.string().url(),
     AUTH_TRUST_HOST: z.coerce.boolean().default(false),
     SESSION_MAX_AGE: z.coerce.number().int().default(60 * 60 * 24 * 7) // 7 days
   });

   // LLM Providers
   export const llmEnvSchema = z.object({
     OPENAI_API_KEY: z.string().optional(),
     OPENAI_ORG_ID: z.string().optional(),
     ANTHROPIC_API_KEY: z.string().optional(),
     DEFAULT_LLM_PROVIDER: z.enum(['openai', 'anthropic', 'local']).default('openai'),
     DEFAULT_LLM_MODEL: z.string().default('gpt-4o-mini'),
     LLM_TIMEOUT_MS: z.coerce.number().int().default(30000),
     LLM_MAX_RETRIES: z.coerce.number().int().default(3)
   });

   // Observability
   export const observabilityEnvSchema = z.object({
     OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
     OTEL_SERVICE_NAME: z.string().default('rtv-automation'),
     OTEL_ENABLED: z.coerce.boolean().default(true),
     SENTRY_DSN: z.string().url().optional()
   });

   // Feature flags
   export const featureFlagsEnvSchema = z.object({
     ENABLE_ANALYTICS: z.coerce.boolean().default(true),
     ENABLE_EXPERIMENTAL: z.coerce.boolean().default(false),
     MAINTENANCE_MODE: z.coerce.boolean().default(false)
   });

   // Combined schema
   export const envSchema = baseEnvSchema
     .merge(databaseEnvSchema)
     .merge(redisEnvSchema)
     .merge(authEnvSchema)
     .merge(llmEnvSchema)
     .merge(observabilityEnvSchema)
     .merge(featureFlagsEnvSchema);

   export type Env = z.infer<typeof envSchema>;
   ```

2. **Environment Loader** (packages/config/src/env/loader.ts)
   ```typescript
   import { config as dotenvConfig } from 'dotenv';
   import { expand } from 'dotenv-expand';
   import { existsSync } from 'fs';
   import { join } from 'path';
   import { envSchema, Env } from './schema';

   export interface LoadEnvOptions {
     /** Root directory to search for .env files */
     rootDir?: string;
     /** Override with specific .env file */
     envFile?: string;
     /** Skip validation (useful for partial configs) */
     skipValidation?: boolean;
     /** Custom environment variables to merge */
     overrides?: Partial<Env>;
   }

   export function getEnvFilePaths(rootDir: string, nodeEnv: string): string[] {
     return [
       join(rootDir, `.env.${nodeEnv}.local`),
       join(rootDir, `.env.local`),
       join(rootDir, `.env.${nodeEnv}`),
       join(rootDir, '.env')
     ].filter(existsSync);
   }

   export function loadEnv(options: LoadEnvOptions = {}): Env {
     const rootDir = options.rootDir || process.cwd();
     const nodeEnv = process.env.NODE_ENV || 'development';

     // Load .env files in order of precedence
     const envFiles = options.envFile
       ? [options.envFile]
       : getEnvFilePaths(rootDir, nodeEnv);

     // Load each file (later files don't override earlier ones)
     for (const envFile of envFiles.reverse()) {
       const result = dotenvConfig({ path: envFile });
       if (result.parsed) {
         expand({ parsed: result.parsed, processEnv: process.env });
       }
     }

     // Merge with overrides
     const envVars = {
       ...process.env,
       ...options.overrides
     };

     // Validate
     if (options.skipValidation) {
       return envVars as unknown as Env;
     }

     const result = envSchema.safeParse(envVars);
     if (!result.success) {
       const errors = result.error.issues.map(issue =>
         `  ${issue.path.join('.')}: ${issue.message}`
       ).join('\n');
       throw new Error(`Environment validation failed:\n${errors}`);
     }

     return result.data;
   }

   // Singleton for app-wide access
   let cachedEnv: Env | null = null;

   export function getEnv(): Env {
     if (!cachedEnv) {
       cachedEnv = loadEnv();
     }
     return cachedEnv;
   }

   export function resetEnvCache(): void {
     cachedEnv = null;
   }
   ```

3. **Environment Validator CLI** (packages/config/src/env/validate.ts)
   ```typescript
   import { envSchema } from './schema';
   import { loadEnv } from './loader';
   import chalk from 'chalk';

   export interface ValidationResult {
     valid: boolean;
     errors: Array<{ key: string; message: string }>;
     warnings: Array<{ key: string; message: string }>;
     loaded: string[];
   }

   export function validateEnv(options?: { verbose?: boolean }): ValidationResult {
     const result: ValidationResult = {
       valid: true,
       errors: [],
       warnings: [],
       loaded: []
     };

     try {
       const env = loadEnv({ skipValidation: true });
       const validation = envSchema.safeParse(env);

       if (!validation.success) {
         result.valid = false;
         result.errors = validation.error.issues.map(issue => ({
           key: issue.path.join('.'),
           message: issue.message
         }));
       }

       // Check for sensitive values in wrong environments
       if (env.NODE_ENV === 'production') {
         if (env.DATABASE_URL?.includes('localhost')) {
           result.warnings.push({
             key: 'DATABASE_URL',
             message: 'Using localhost database in production'
           });
         }
       }

       // Check for missing optional but recommended
       if (!env.SENTRY_DSN) {
         result.warnings.push({
           key: 'SENTRY_DSN',
           message: 'Error tracking not configured'
         });
       }

     } catch (error) {
       result.valid = false;
       result.errors.push({
         key: 'LOAD_ERROR',
         message: error instanceof Error ? error.message : 'Unknown error'
       });
     }

     return result;
   }

   export function printValidationResult(result: ValidationResult): void {
     console.log('\n' + chalk.bold('Environment Validation Report'));
     console.log('═'.repeat(50));

     if (result.valid) {
       console.log(chalk.green('✓ All required variables are valid\n'));
     } else {
       console.log(chalk.red('✗ Validation failed\n'));
     }

     if (result.errors.length > 0) {
       console.log(chalk.red.bold('Errors:'));
       result.errors.forEach(err => {
         console.log(chalk.red(`  ✗ ${err.key}: ${err.message}`));
       });
       console.log();
     }

     if (result.warnings.length > 0) {
       console.log(chalk.yellow.bold('Warnings:'));
       result.warnings.forEach(warn => {
         console.log(chalk.yellow(`  ⚠ ${warn.key}: ${warn.message}`));
       });
       console.log();
     }
   }
   ```

4. **Environment Generator** (packages/config/src/env/generator.ts)
   ```typescript
   import { envSchema } from './schema';
   import { writeFileSync } from 'fs';
   import { join } from 'path';

   export interface GenerateOptions {
     outputPath?: string;
     format?: 'env' | 'json' | 'yaml';
     includeDefaults?: boolean;
     includeComments?: boolean;
   }

   export function generateEnvTemplate(options: GenerateOptions = {}): string {
     const {
       format = 'env',
       includeDefaults = true,
       includeComments = true
     } = options;

     const shape = envSchema.shape;
     const lines: string[] = [];

     if (includeComments) {
       lines.push('# RTV Social Automation Environment Configuration');
       lines.push('# Generated template - fill in your values');
       lines.push('');
     }

     const groups: Record<string, string[]> = {
       'Base Configuration': ['NODE_ENV', 'LOG_LEVEL', 'TZ'],
       'Database': ['DATABASE_URL', 'DATABASE_POOL_MIN', 'DATABASE_POOL_MAX', 'DATABASE_SSL'],
       'Redis': ['REDIS_URL', 'REDIS_TLS', 'REDIS_KEY_PREFIX'],
       'Authentication': ['AUTH_SECRET', 'AUTH_URL', 'AUTH_TRUST_HOST', 'SESSION_MAX_AGE'],
       'LLM Providers': ['OPENAI_API_KEY', 'OPENAI_ORG_ID', 'ANTHROPIC_API_KEY', 'DEFAULT_LLM_PROVIDER', 'DEFAULT_LLM_MODEL', 'LLM_TIMEOUT_MS', 'LLM_MAX_RETRIES'],
       'Observability': ['OTEL_EXPORTER_OTLP_ENDPOINT', 'OTEL_SERVICE_NAME', 'OTEL_ENABLED', 'SENTRY_DSN'],
       'Feature Flags': ['ENABLE_ANALYTICS', 'ENABLE_EXPERIMENTAL', 'MAINTENANCE_MODE']
     };

     for (const [group, keys] of Object.entries(groups)) {
       if (includeComments) {
         lines.push(`# ${group}`);
       }

       for (const key of keys) {
         const fieldSchema = shape[key as keyof typeof shape];
         if (!fieldSchema) continue;

         const def = fieldSchema._def;
         const defaultValue = def.defaultValue?.();
         const isOptional = fieldSchema.isOptional();
         const isRequired = !isOptional && defaultValue === undefined;

         let value = '';
         if (includeDefaults && defaultValue !== undefined) {
           value = String(defaultValue);
         }

         if (format === 'env') {
           const comment = isRequired ? ' # Required' : isOptional ? ' # Optional' : '';
           lines.push(`${key}=${value}${includeComments ? comment : ''}`);
         }
       }

       if (includeComments) {
         lines.push('');
       }
     }

     return lines.join('\n');
   }

   export function writeEnvTemplate(outputPath: string, options?: GenerateOptions): void {
     const template = generateEnvTemplate(options);
     writeFileSync(outputPath, template, 'utf-8');
   }
   ```

5. **CLI Command** (packages/cli/src/commands/env.ts)
   ```typescript
   import { Command } from 'commander';
   import { validateEnv, printValidationResult } from '@rtv/config/env/validate';
   import { generateEnvTemplate, writeEnvTemplate } from '@rtv/config/env/generator';
   import { getEnvFilePaths } from '@rtv/config/env/loader';
   import chalk from 'chalk';

   export const envCommand = new Command('env')
     .description('Environment variable management');

   envCommand
     .command('validate')
     .description('Validate environment variables')
     .option('-v, --verbose', 'Show all loaded variables')
     .action((options) => {
       const result = validateEnv({ verbose: options.verbose });
       printValidationResult(result);
       process.exit(result.valid ? 0 : 1);
     });

   envCommand
     .command('generate')
     .description('Generate .env template file')
     .option('-o, --output <path>', 'Output file path', '.env.example')
     .option('--no-defaults', 'Exclude default values')
     .option('--no-comments', 'Exclude comments')
     .action((options) => {
       writeEnvTemplate(options.output, {
         includeDefaults: options.defaults,
         includeComments: options.comments
       });
       console.log(chalk.green(`✓ Generated ${options.output}`));
     });

   envCommand
     .command('list')
     .description('List loaded .env files')
     .action(() => {
       const nodeEnv = process.env.NODE_ENV || 'development';
       const files = getEnvFilePaths(process.cwd(), nodeEnv);

       console.log(chalk.bold('\nLoaded .env files (in order):'));
       files.forEach((file, i) => {
         console.log(`  ${i + 1}. ${file}`);
       });
       console.log();
     });

   envCommand
     .command('check <key>')
     .description('Check if a specific variable is set')
     .action((key) => {
       const value = process.env[key];
       if (value) {
         const masked = value.length > 8
           ? value.slice(0, 4) + '****' + value.slice(-4)
           : '****';
         console.log(chalk.green(`✓ ${key} is set: ${masked}`));
       } else {
         console.log(chalk.red(`✗ ${key} is not set`));
         process.exit(1);
       }
     });
   ```

6. **Environment Templates**

   `.env.example`:
   ```bash
   # RTV Social Automation - Environment Template
   # Copy to .env.local and fill in values

   # Base Configuration
   NODE_ENV=development
   LOG_LEVEL=debug
   TZ=UTC

   # Database (Required)
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rtv_dev
   DATABASE_POOL_MIN=2
   DATABASE_POOL_MAX=10
   DATABASE_SSL=false

   # Redis (Required)
   REDIS_URL=redis://localhost:6379
   REDIS_TLS=false
   REDIS_KEY_PREFIX=rtv:

   # Authentication (Required)
   AUTH_SECRET=development-secret-min-32-characters-long
   AUTH_URL=http://localhost:3000
   AUTH_TRUST_HOST=true
   SESSION_MAX_AGE=604800

   # LLM Providers (At least one required)
   OPENAI_API_KEY=sk-...
   # OPENAI_ORG_ID=org-...
   # ANTHROPIC_API_KEY=sk-ant-...
   DEFAULT_LLM_PROVIDER=openai
   DEFAULT_LLM_MODEL=gpt-4o-mini
   LLM_TIMEOUT_MS=30000
   LLM_MAX_RETRIES=3

   # Observability (Optional)
   # OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   OTEL_SERVICE_NAME=rtv-automation
   OTEL_ENABLED=true
   # SENTRY_DSN=https://...

   # Feature Flags
   ENABLE_ANALYTICS=true
   ENABLE_EXPERIMENTAL=false
   MAINTENANCE_MODE=false
   ```

   `.env.test`:
   ```bash
   NODE_ENV=test
   LOG_LEVEL=error
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rtv_test
   DATABASE_SSL=false
   REDIS_URL=redis://localhost:6379/1
   REDIS_TLS=false
   AUTH_SECRET=test-secret-must-be-at-least-32-chars
   AUTH_URL=http://localhost:3000
   AUTH_TRUST_HOST=true
   OTEL_ENABLED=false
   ```

## TDD Requirements
Create packages/config/src/env/__tests__/env.test.ts:

### RED Phase - Write failing tests:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { envSchema, baseEnvSchema, databaseEnvSchema } from '../schema';
import { loadEnv, getEnvFilePaths, resetEnvCache } from '../loader';
import { validateEnv } from '../validate';
import { generateEnvTemplate } from '../generator';

describe('Environment Schema', () => {
  describe('baseEnvSchema', () => {
    it('should accept valid NODE_ENV values', () => {
      expect(baseEnvSchema.parse({ NODE_ENV: 'development' })).toMatchObject({ NODE_ENV: 'development' });
      expect(baseEnvSchema.parse({ NODE_ENV: 'production' })).toMatchObject({ NODE_ENV: 'production' });
      expect(baseEnvSchema.parse({ NODE_ENV: 'test' })).toMatchObject({ NODE_ENV: 'test' });
      expect(baseEnvSchema.parse({ NODE_ENV: 'staging' })).toMatchObject({ NODE_ENV: 'staging' });
    });

    it('should reject invalid NODE_ENV', () => {
      expect(() => baseEnvSchema.parse({ NODE_ENV: 'invalid' })).toThrow();
    });

    it('should use default values', () => {
      const result = baseEnvSchema.parse({});
      expect(result.NODE_ENV).toBe('development');
      expect(result.LOG_LEVEL).toBe('info');
      expect(result.TZ).toBe('UTC');
    });
  });

  describe('databaseEnvSchema', () => {
    it('should require DATABASE_URL', () => {
      expect(() => databaseEnvSchema.parse({})).toThrow();
    });

    it('should validate DATABASE_URL is a URL', () => {
      expect(() => databaseEnvSchema.parse({ DATABASE_URL: 'not-a-url' })).toThrow();
    });

    it('should accept valid database config', () => {
      const result = databaseEnvSchema.parse({
        DATABASE_URL: 'postgresql://localhost:5432/db'
      });
      expect(result.DATABASE_POOL_MIN).toBe(2);
      expect(result.DATABASE_POOL_MAX).toBe(10);
      expect(result.DATABASE_SSL).toBe(true);
    });

    it('should coerce string numbers', () => {
      const result = databaseEnvSchema.parse({
        DATABASE_URL: 'postgresql://localhost:5432/db',
        DATABASE_POOL_MIN: '5',
        DATABASE_POOL_MAX: '20'
      });
      expect(result.DATABASE_POOL_MIN).toBe(5);
      expect(result.DATABASE_POOL_MAX).toBe(20);
    });
  });

  describe('envSchema (combined)', () => {
    it('should validate complete config', () => {
      const config = {
        DATABASE_URL: 'postgresql://localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        AUTH_SECRET: 'a-very-long-secret-that-is-at-least-32-chars',
        AUTH_URL: 'http://localhost:3000'
      };

      const result = envSchema.parse(config);
      expect(result.NODE_ENV).toBe('development');
      expect(result.DATABASE_URL).toBe(config.DATABASE_URL);
    });
  });
});

describe('Environment Loader', () => {
  beforeEach(() => {
    resetEnvCache();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getEnvFilePaths', () => {
    it('should return paths in correct order', () => {
      const paths = getEnvFilePaths('/app', 'development');
      expect(paths[0]).toContain('.env.development.local');
      // Other files may not exist, so just check the logic
    });
  });

  describe('loadEnv', () => {
    it('should merge overrides', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/db');
      vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
      vi.stubEnv('AUTH_SECRET', 'a-very-long-secret-that-is-at-least-32-chars');
      vi.stubEnv('AUTH_URL', 'http://localhost:3000');

      const env = loadEnv({
        skipValidation: false,
        overrides: { LOG_LEVEL: 'debug' }
      });

      expect(env.LOG_LEVEL).toBe('debug');
    });

    it('should throw on invalid config', () => {
      vi.stubEnv('DATABASE_URL', 'invalid');

      expect(() => loadEnv()).toThrow('Environment validation failed');
    });

    it('should skip validation when requested', () => {
      vi.stubEnv('DATABASE_URL', 'invalid');

      expect(() => loadEnv({ skipValidation: true })).not.toThrow();
    });
  });
});

describe('Environment Validator', () => {
  beforeEach(() => {
    resetEnvCache();
  });

  it('should return valid for complete config', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/db');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('AUTH_SECRET', 'a-very-long-secret-that-is-at-least-32-chars');
    vi.stubEnv('AUTH_URL', 'http://localhost:3000');

    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return errors for missing required vars', () => {
    vi.stubEnv('DATABASE_URL', undefined);

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should warn about localhost in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/db');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('AUTH_SECRET', 'a-very-long-secret-that-is-at-least-32-chars');
    vi.stubEnv('AUTH_URL', 'http://localhost:3000');

    const result = validateEnv();
    expect(result.warnings.some(w => w.key === 'DATABASE_URL')).toBe(true);
  });
});

describe('Environment Generator', () => {
  it('should generate env template', () => {
    const template = generateEnvTemplate();
    expect(template).toContain('NODE_ENV');
    expect(template).toContain('DATABASE_URL');
    expect(template).toContain('AUTH_SECRET');
  });

  it('should include comments by default', () => {
    const template = generateEnvTemplate();
    expect(template).toContain('#');
  });

  it('should exclude comments when requested', () => {
    const template = generateEnvTemplate({ includeComments: false });
    expect(template).not.toContain('# Required');
  });

  it('should include default values', () => {
    const template = generateEnvTemplate({ includeDefaults: true });
    expect(template).toContain('LOG_LEVEL=info');
  });
});
```

### GREEN Phase
Implement all modules to make tests pass.

### REFACTOR Phase
- Add TypeScript types for process.env
- Create environment type declarations
- Add secret rotation helpers

## Deliverables
- [ ] packages/config/src/env/schema.ts
- [ ] packages/config/src/env/loader.ts
- [ ] packages/config/src/env/validate.ts
- [ ] packages/config/src/env/generator.ts
- [ ] packages/config/src/env/index.ts
- [ ] packages/cli/src/commands/env.ts
- [ ] .env.example
- [ ] .env.test
- [ ] packages/config/src/env/__tests__/env.test.ts
- [ ] All tests passing

## Dependencies to Install
```bash
pnpm add -D dotenv dotenv-expand
```

## Verification
```bash
pnpm test --filter=@rtv/config -- env
pnpm build --filter=@rtv/config
# Test CLI
pnpm --filter=@rtv/cli exec rtv env validate
pnpm --filter=@rtv/cli exec rtv env generate
```
```

---

## Execution Summary

| Agent | Task ID | Task Name | Est. Hours | Blocks |
|-------|---------|-----------|------------|--------|
| A | S0-B4 | Audit Event Schema | 4h | S0-D3, S0-B5 |
| B | S0-C4 | Vercel Preview Deployments | 3h | - |
| C | S0-C5 | Environment Variable Management | 3h | - |

**Total Parallel Time:** ~4 hours (longest task)
**Total Sequential Time:** 10 hours (if done serially)
**Efficiency Gain:** 60% time savings

## Post-Completion Status

After Wave 3 completes:
- **Sprint 0:** 17/20 tasks done (85%)
- **Remaining:** S0-B5 (Seed Scripts), S0-D3 (Audit Framework), S0-D4 (Error Tracking)

### Wave 4 Preview (Final Sprint 0 Wave)
| Task | Waiting On |
|------|------------|
| S0-B5 (Seed Scripts) | S0-B4 ✓ |
| S0-D3 (Audit Framework) | S0-B4 ✓ |
| S0-D4 (Error Tracking) | Independent |

All 3 can run in parallel for Wave 4 to complete Sprint 0!
