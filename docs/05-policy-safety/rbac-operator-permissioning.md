# RBAC & Operator Permissioning Spec — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Goal:** Prevent wrong-tenant / wrong-account / wrong-platform side effects by enforcing **least privilege**, **deny-by-default**, and **centralized authorization** across the web app, runner, tool gateway, and browser lane.

This spec defines:
- Roles, permissions, and escalation
- Tenant isolation guarantees
- How we implement RBAC + ABAC together
- How we secure privileged actions (publish/DM/comment/like, secrets, browser profiles)

---

## 0) Non-negotiables

1) **Server-side authorization only**
UI gating is convenience. The backend is the source of truth.

2) **Centralized authorization**
No copy/paste auth checks scattered around handlers. All access requests pass through a single policy enforcement layer.

3) **Deny by default**
If a permission is not explicitly granted, it’s denied.

4) **Tenant boundaries are hard**
Every request is scoped by `tenant_id`; cross-tenant access is impossible by construction.

5) **Privileged operations require step-up controls**
Publish/engage/secrets/browser actions require additional safeguards (role + scope + approval + kill-switch awareness + audit).

---

## 1) Scope & terminology

### 1.1 Subject types
- **Human Users** (operators, engineers, admins)
- **Service Accounts** (runner, tool gateway, scheduled jobs)
- **Automation Identities** (agent episodes acting on behalf of tenant under policy)

### 1.2 Target resources (authorization “objects”)
- **Tenant** (client workspace)
- **BrandKit / KnowledgeBase**
- **Blueprint Library + Overrides**
- **Plans** (planning output)
- **Assets** (images/videos/copy)
- **Schedules** (calendar + post queue)
- **Publish operations**
- **Engagement operations** (comments/DM/likes)
- **Platform Accounts** (Meta/IG/TikTok/etc)
- **Browser Profiles** (vault entries)
- **CredentialRefs** (secret pointers)
- **ProviderConfig routing**
- **Audit Logs / Verification Artifacts**
- **Experimentation OS controls** (when enabled)

### 1.3 Action verbs (standardized)
- `read`, `list`, `create`, `update`, `delete`
- `approve`, `reject`
- `execute` (run episodes)
- `publish` (external side effect)
- `engage` (external side effect)
- `rotate` (tokens/keys)
- `connect` / `disconnect` (platform accounts)
- `export` (data export)

---

## 2) Authorization model: RBAC + ABAC (hybrid)

### 2.1 Why hybrid
- RBAC keeps staffing simple (clear operator roles)
- ABAC adds precision for multi-tenant, multi-platform, multi-lane, high-risk actions

### 2.2 How the hybrid works
**RBAC grants a base role**, then **ABAC policy rules** constrain the action by attributes:

**Subject attributes**
- `user_id`
- `role`
- `team` (ops/dev/security)
- `clearance_level` (standard|privileged)
- `mfa_verified` (true/false)

**Resource attributes**
- `tenant_id`
- `platform`
- `platform_account_id`
- `lane` (api|browser|hybrid)
- `capability` (plan|create|schedule|publish|engage_dm|engage_comment|like)
- `risk_tier` (A|B|C)

**Environment attributes**
- `env` (preview|staging|prod)
- `time_window`
- `incident_state` (normal|degraded|locked)

Authorization returns:
- `ALLOW` / `DENY`
- `reason_code`
- `required_step_up` (none|mfa|approval)

---

## 3) Roles (human)

> The platform is agency-operated today (clients do not have logins). These roles are for your team and contractors.

### 3.1 Super Admin (rare)
**Who:** Founders / designated security owner only.

**Can:**
- Manage users, roles, and global policies
- Perform emergency kill switches
- Approve and execute high-risk operations
- Manage secret manager integration

**Cannot:** (policy)
- Run day-to-day publishing without normal approvals (to prevent “god mode drift”)

### 3.2 Security Owner
**Who:** security lead / trusted senior.

**Can:**
- Approve Tier C access grants
- Rotate/revoke credentials (or authorize rotation)
- Manage browser profile vault encryption keys and access
- Review audit trails for privileged actions

### 3.3 Release Captain
**Who:** person responsible for production rollout.

**Can:**
- Enable/disable release flags
- Trigger canary expansion
- Initiate rollback steps
- Lock down risky surfaces during incidents

### 3.4 Ops Manager
**Who:** senior operator managing multiple clients.

**Can:**
- Onboard tenants and configure BrandKit/KB
- Connect/disconnect platform accounts (within allowed platforms)
- Manage schedules, approvals, and posting pipelines
- View all tenant dashboards assigned to their org

### 3.5 Operator (standard)
**Who:** day-to-day social ops.

**Can:**
- Plan + create + schedule content
- Submit items for approval
- Execute engagement actions that are approved/allowed

**Cannot:**
- Change autonomy policy defaults
- Rotate secrets
- Create/modify kill switches

### 3.6 Creative Specialist
**Who:** copy/design/video operator.

**Can:**
- Create assets and drafts
- Edit blueprint overrides (within guardrails)

**Cannot:**
- Publish/engage
- Connect platform accounts

### 3.7 QA / Verifier
**Who:** verifier agent operator or human QA.

**Can:**
- Run test episodes in staging
- Review verification proofs
- Mark items as “verified”

**Cannot:**
- Publish/engage to production unless explicitly granted and approved

### 3.8 Developer (engineering)
**Can:**
- Read non-secret operational data for debugging
- Run staging workflows

**Cannot by default:**
- Access production tenant content
- Access secrets
- Perform browser lane runs in production

### 3.9 Auditor (read-only)
**Can:**
- Read audit logs, changelogs, incident reports

**Cannot:**
- Modify anything

---

## 4) Service accounts (non-human)

### 4.1 Runner Service Account
**Purpose:** Executes agent episodes.

**Can:**
- Read tenant config needed for execution
- Write job state, audit events, verification pointers

**Cannot:**
- Directly fetch raw secrets—must request short-lived scoped tokens from secret manager
- Perform actions outside episode policy

### 4.2 Tool Gateway Service Account
**Purpose:** Calls MCP tools / platform connectors.

**Can:**
- Execute tool calls only when accompanied by:
  - valid episode token
  - tenant scope
  - capability scope

### 4.3 Browser Runner Service Account
**Purpose:** Runs headless/remote browser lane.

**Special rules:**
- Must only access browser profiles via profile vault API
- Must emit screenshot proof on side-effect steps
- Must obey global and tenant kill switches

---

## 5) Permission system

### 5.1 Permission naming convention
`{resource}:{action}:{scope}`

Examples:
- `tenant:read:any_assigned`
- `brandkit:update:tenant`
- `plan:create:tenant`
- `asset:update:tenant`
- `schedule:approve:tenant`
- `publish:execute:tenant_platform_account`
- `engage_dm:execute:tenant_platform_account`
- `browser_profile:use:tenant_platform_account`
- `credential_ref:read:tenant` (metadata only)
- `secret_token:mint:tenant_provider` (short-lived tokens)

### 5.2 Resource scoping rules
All permissions are scoped by:
- tenant
- platform
- platform account
- lane
- capability

### 5.3 Risk tiers for actions
**Tier A (safe):** read/list, drafts, internal planning, non-side-effect edits

**Tier B (medium):** scheduling, platform connections (sandbox), enabling blueprints

**Tier C (high):** publish, send DM, reply to comment, like/follow, browser lane, secret rotation

Tier C always requires:
- role permission
- ABAC attribute allow
- audit event
- and either approval or explicit autonomy policy allowing automation

---

## 6) Approval workflows (human-in-the-loop)

### 6.1 Default approval policy
- Planning: auto
- Creation: auto_with_review (draft approval)
- Publishing: manual approval required (MVP default)
- Engagement: auto only for low-risk categories; otherwise approval or escalations

### 6.2 Approval objects
- `ApprovalRequest` includes:
  - tenant/platform/account
  - intended side effect
  - content preview (redacted as needed)
  - required disclaimers
  - risk tier
  - proposed schedule

### 6.3 Two-person rule (optional, recommended for Tier C)
For Tier C actions in production:
- creator cannot be the final approver

---

## 7) Implementation requirements (how we enforce)

### 7.1 Central Policy Enforcement Point (PEP)
All requests pass through:
- authentication
- RBAC role check
- ABAC attribute check
- kill switch check
- autonomy policy check

### 7.2 Policy Decision Point (PDP)
A single module determines allow/deny:
- input: subject + resource + environment context
- output: decision + reason + required controls

### 7.3 Strong tenant isolation patterns
- Tenant ID in session token
- Tenant ID required in every route
- DB row-level constraints (or RLS)
- Explicit scoping in queues (job payload includes tenant scope)

### 7.4 Step-up authentication
For high-risk actions:
- require re-auth or MFA verification within last N minutes

### 7.5 Break-glass access
Emergency access grants:
- time-limited
- logged
- requires Security Owner approval
- automatically revoked

---

## 8) Audit requirements (authorization + side effects)

Every privileged decision emits:
- `AuthzDecisionEvent`
  - subject
  - resource
  - decision
  - reason_code
  - trace_id

Every attempted side effect emits:
- `SideEffectAuditEvent`
  - intended action
  - platform account
  - lane
  - tool call summary
  - verification pointer

---

## 9) Post-MVP extensibility patterns

1) **Client logins (future)**
- introduce roles: Client Admin, Client Approver, Client Viewer
- add per-client approval SLAs

2) **Fine-grained ABAC policies**
- rules like: “Operator can publish only on weekdays 9am–5pm for Tenant X”

3) **Policy bundles versioning**
- versioned permission sets per tenant

4) **Multi-org (agency inside agency)**
- org-level scoping on top of tenant scoping

---

## 10) Acceptance criteria (Definition of Done for RBAC)

- All routes guarded server-side
- Side effect endpoints require Tier C permissions
- Runner/tool gateway enforce capability-scoped tokens
- Audit events emitted for authorization decisions + side effects
- Unit tests for allow/deny matrices
- Canary tests ensure no cross-tenant access

---

## 11) Next doc

**Secrets Access Review & Access Recertification Process — v1**
