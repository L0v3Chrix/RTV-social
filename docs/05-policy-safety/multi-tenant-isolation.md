# G) Multi‑Tenant Isolation & Data Boundary Spec — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency‑Operated)

**Scope of this spec:** Multi‑tenant safety for an agency-run system that connects to many client social accounts, executes high‑side‑effect automation (publishing, DMs, comments, likes), and uses both **API lane** and **Browser lane** automation with **BYOK** (client-provided keys).

**Core outcome:** A failure in any layer must **not** cause cross‑tenant data exposure or cross‑tenant side effects.

---

## 0) Terms & definitions

- **Tenant / Client:** An agency customer. Each has BrandKit/KB, platform accounts, policy binder, feature flags, and optionally BYOK provider keys.
- **Operator:** Internal agency staff and internal service accounts.
- **Episode:** One agentic execution unit (Plan/Create/Publish/Engage step).
- **Side‑effect:** Any external action (post, schedule, DM, reply, like, follow, token refresh).
- **Lane:** API lane (platform APIs) vs Browser lane (automation runner).
- **Isolation level:** The strength of separation between tenants.

---

## 1) Design principles (non‑negotiables)

### 1.1 Deny‑by‑default + explicit tenant scope
Every request, job, tool call, and side-effect must be scoped by:
- `tenant_id` (required)
- `platform_account_id` (required for platform actions)
- `lane` (api|browser)

This aligns with strong access control requirements (operation-level authorization) (OWASP ASVS V4). ([owasp.org](https://owasp.org/www-project-application-security-verification-standard/?utm_source=chatgpt.com))

### 1.2 Cross‑tenant controls are mandatory for multi‑tenant apps
We explicitly verify that operations **cannot affect other tenants**, consistent with multi‑tenant security guidance (OWASP Multi‑Tenant Security Cheat Sheet) and ASVS access-control expectations. ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html?utm_source=chatgpt.com))

### 1.3 Partition by design, not by convention
Isolation must be enforced at multiple layers:
- AuthN/AuthZ policy
- Data model constraints
- Query enforcement (RLS / tenancy filters)
- Job queue scoping
- Secret scoping
- Cache scoping
- Tool gateway scoping
- Browser profile vault scoping

### 1.4 Prefer proven SaaS partitioning models
We support **Silo / Pool / Bridge** partitioning models (AWS SaaS Lens / storage strategies) and choose per resource based on risk and cost. ([docs.aws.amazon.com](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/silo-pool-and-bridge-models.html?utm_source=chatgpt.com))

### 1.5 Least privilege + separation of duties
Privilege is minimized and split across roles/services to reduce blast radius (NIST access control concepts). ([nvlpubs.nist.gov](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-53r5.pdf?utm_source=chatgpt.com))

---

## 2) Threat model summary (tenant boundary violations)

### 2.1 Primary cross‑tenant failure classes
1) **Data leak:** Tenant A sees Tenant B’s BrandKit/KB/assets/DMs/audits.
2) **Wrong-account side effect:** Posting/DMing/liking on Tenant B’s platform account while executing Tenant A.
3) **Key confusion:** Using Tenant B’s BYOK key for Tenant A tasks.
4) **Tool confusion:** Tool gateway call that pulls Tenant B data into Tenant A episode.
5) **Browser profile confusion:** Browser runner uses wrong Chrome profile (wrong saved login).

### 2.2 Highest risk surfaces
- Browser lane automation (UI drift + credentialed sessions)
- Engagement automation (DM/comment reply)
- “Global” caches / shared queues
- Human operator mistakes (selecting wrong tenant)

---

## 3) Target isolation posture for MVP

### 3.1 MVP isolation goal
- **Hard tenant boundaries in data access** (DB enforced)
- **Hard tenant boundaries in secrets** (vault enforced)
- **Hard tenant boundaries in side effects** (preflight + verification)
- **Soft isolation for compute** (pooled compute with strong runtime scoping)

### 3.2 Post‑MVP isolation evolution
- Optional “Silo upgrades” for high‑value / regulated tenants:
  - Dedicated DB (or schema)
  - Dedicated queue namespace
  - Dedicated browser runner pool
  - Dedicated provider routing

This maps to known silo/pool/bridge strategies. ([docs.aws.amazon.com](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/silo-pool-and-bridge-models.html?utm_source=chatgpt.com))

---

## 4) Data partitioning model (what is silo vs pool here?)

We choose isolation per resource type:

### 4.1 Pooled resources (default)
Shared infrastructure, strict logical separation:
- Web app
- API services
- Job runner
- Tool gateway
- Observability pipeline

### 4.2 Bridged resources (tenant-scoped namespaces)
Shared service but each tenant has strong partitioning via:
- separate namespaces / prefixes
- separate encryption keys
- separate worker pools (optional)

Examples:
- Object storage prefixes: `s3://bucket/tenant/{tenant_id}/...`
- Queue topics: `jobs.{tenant_id}.publish`

### 4.3 Silo resources (high-risk)
Dedicated per tenant for the highest risk assets:
- Browser automation profiles (profile vault)
- Optional dedicated DB/schema

Rationale: browser sessions are effectively “identity-bearing”. ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html?utm_source=chatgpt.com))

---

## 5) Tenant context propagation (the “TenantContext” contract)

### 5.1 Canonical TenantContext object
TenantContext is required on every request/job/tool call:

```json
{
  "tenant_id": "uuid",
  "operator_id": "uuid|null",
  "service_actor": "web|runner|tool-gateway|browser-runner",
  "platform_account_id": "uuid|null",
  "platform": "instagram|facebook|tiktok|linkedin|youtube|x|skool|null",
  "lane": "api|browser|null",
  "capability": "plan|create|schedule|publish|engage|verify",
  "risk_tier": "A|B|C",
  "trace_id": "uuid",
  "idempotency_key": "string|null",
  "policy_snapshot_id": "uuid"
}
```

### 5.2 Propagation rules
- Web request → API: via auth token claims + request headers
- API → queue job: TenantContext stored with job payload
- Runner → tool gateway: TenantContext must be attached
- Tool gateway → external providers: TenantContext used only for routing/selection; never leaked externally
- Browser runner: TenantContext selects **profile_id**; profile_id must map to the same tenant

### 5.3 “No context, no action” rule
If TenantContext is missing or incomplete, the operation fails closed.

---

## 6) Data model enforcement (DB layer)

### 6.1 Tenant ownership columns
Every tenant-owned table includes:
- `tenant_id` (required, indexed)
- `created_at`, `updated_at`

### 6.2 Composite keys to prevent ambiguity
For side-effect-targeted resources:
- PlatformAccount is uniquely identified by `(tenant_id, platform, external_account_fingerprint)`

### 6.3 DB enforcement options
**Option A (recommended): Row-Level Security (RLS)**
- Enforce `tenant_id = current_setting('app.tenant_id')` or equivalent
- Prevents accidental query omission

**Option B: Query-layer enforcement**
- Centralized data access layer requires tenant_id
- Static analysis + tests enforce

**MVP requirement:** whichever path we choose, it must be **DB-verifiable**.

### 6.4 Tenant-scoped indexes
- All queries must be tenant-first (avoid scanning cross-tenant)

### 6.5 External memory artifacts
Plan graph / Asset graph / Engagement events are all tenant-scoped:
- Nodes include `tenant_id`
- Edges cannot cross tenant_id

---

## 7) Queue + job isolation

### 7.1 Job payload
Every job includes TenantContext.

### 7.2 Namespacing
- Queue names/topics include tenant_id OR
- A single queue with strict payload enforcement + DLQ segregation

### 7.3 Worker safety
Workers must:
- set TenantContext at start
- clear TenantContext at end (avoid leaks between jobs)

### 7.4 DLQ strategy
DLQ records are tenant-scoped and cannot be viewed across tenants without privileged operator role.

---

## 8) Cache isolation

### 8.1 Cache key format (required)
All caches must be prefixed:
- `{tenant_id}:{resource}:{hash(inputs)}`

### 8.2 Prohibited cache patterns
- Any cache entry without tenant prefix
- Any shared “global” memoization of tenant data

### 8.3 Browser lane caching
- Never cache authenticated HTML responses cross-tenant
- Screenshot/artifacts stored in tenant prefix only

---

## 9) Secrets & BYOK isolation

### 9.1 Secrets are referenced, not stored
Application DB stores only `CredentialRef` pointers (see Secrets Runbook).

### 9.2 Tenant-scoped secret paths
Vault paths include tenant_id:
- `vault://tenants/{tenant_id}/providers/google`

### 9.3 Provider routing rules
- Provider selection uses ProviderConfig + TenantContext
- BYOK key retrieval requires `tenant_id` match

### 9.4 Key confusion prevention
When minting tokens or pulling secrets:
- enforce `(tenant_id, provider)` matches
- audit every secret access with tenant_id

Multi-tenant systems must explicitly address cross-tenant risks. ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html?utm_source=chatgpt.com))

---

## 10) Tool gateway isolation (Docker MCP gateway style)

### 10.1 Tool selection is scoped
The tool gateway must support:
- tenant-scoped tool execution
- tenant-scoped storage of tool outputs

### 10.2 Large tool outputs never enter shared context
- Tool outputs are written to tenant-scoped storage
- Only summaries return to agent context

### 10.3 Tool allowlists per capability
- Planner cannot call publish tools
- Engagement agent cannot call data export tools

---

## 11) Browser lane isolation (highest risk)

Browser lane is where “wrong-account” failures happen.

### 11.1 Profile vault model (silo by default)
- Each tenant has dedicated browser profiles:
  - `profile_id` belongs to exactly one tenant
  - profiles encrypted at rest
  - access is audited

### 11.2 Binding rules
Browser runner must bind:
- `tenant_id` → allowed `profile_id[]`
- `platform_account_id` → exact `profile_id` mapping

### 11.3 Preflight verification (required)
Before any side-effect click:
- confirm the logged-in account identity on the page
- match against expected account fingerprint
- if mismatch: fail closed + screenshot + incident card

### 11.4 Drift / captcha handling
- If UI drift or captcha detected:
  - enter degraded mode (read-only)
  - notify operator
  - never brute-force

---

## 12) Observability boundaries (logs, traces, metrics)

### 12.1 Tenant tagging
Every log/metric/span includes `tenant_id`.

### 12.2 PII handling
- DMs and message bodies are redacted or stored separately with strict access

### 12.3 Operator UI
- Operator views are tenant-filtered by default
- Cross-tenant reporting requires elevated role + explicit reason

Strong audit and access controls are standard security expectations. ([nvlpubs.nist.gov](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-53r5.pdf?utm_source=chatgpt.com))

---

## 13) API authorization model (RBAC + ABAC)

This spec assumes RBAC exists. We add ABAC constraints:
- role grants broad permissions
- attributes constrain to tenant_id/platform/lane/capability/risk tier

Multi-tenant authorization best practices emphasize tenant scoping + fine-grained enforcement. ([permit.io](https://www.permit.io/blog/best-practices-for-multi-tenant-authorization?utm_source=chatgpt.com))

---

## 14) Verification & test requirements (how we prove isolation)

### 14.1 Isolation test suite (required in CI)
1) **DB isolation tests**
- attempt cross-tenant reads/writes
- must fail

2) **Job isolation tests**
- queue job with tenant A cannot access tenant B

3) **Cache isolation tests**
- ensure keys always prefixed with tenant_id

4) **Secret isolation tests**
- secret fetch mismatch must fail

5) **Browser lane wrong-account test**
- intentionally set wrong profile mapping in sandbox and verify fail-closed behavior

### 14.2 Canary tests
Run daily sandbox canaries to detect:
- policy bypass
- drift in browser lane identity checks

---

## 15) Operational controls (blast radius reduction)

### 15.1 Kill switches
- global kill switch
- per-tenant kill switch
- per-platform kill switch
- per-lane kill switch

### 15.2 Rate limiting per tenant
- publish and engagement actions are rate-limited per tenant to reduce accidental spikes

### 15.3 Manual approval gates
- enforce per policy binder

---

## 16) Post‑MVP extensibility patterns

1) **Tenant “tiering” strategy**
- upgrade tenants to more siloed resources as needed (DB, runners, browser pools)

2) **Client logins**
- additional identity plane; maintain same tenant boundaries in UI

3) **Cross-tenant analytics (future)**
- only aggregate, privacy-preserving, no raw content mixing

4) **Bring-your-own-infrastructure (future)**
- allow enterprise tenants to run their own runner/tool gateway while web remains agency-operated

These map cleanly onto well-known SaaS partitioning patterns. ([docs.aws.amazon.com](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/silo-pool-and-bridge-models.html?utm_source=chatgpt.com))

---

## 17) Definition of Done (for multi‑tenant isolation)

This spec is “implemented” when:
- tenant context propagation exists end-to-end
- DB enforces tenant boundaries (RLS or equivalent)
- secrets are tenant-scoped and audited
- queues/caches are tenant-scoped
- browser profiles are tenant-bound and verified
- isolation test suite runs in CI and blocks merges
- wrong-account preflight exists and fails closed
- kill switches work and are tested

---

## 18) Next document

**H) Tenancy-Aware E2E Test Harness (Sandbox Accounts) — v1**

