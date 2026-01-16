# Security Verification Plan — v1 (ASVS-mapped)

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose:** Turn “security” into a **repeatable, testable** build discipline. This plan maps our MVP controls to **OWASP ASVS v4.x** categories and defines:
- what must be implemented,
- how it’s verified (tests + checks),
- what evidence is required,
- what blocks a merge/release.

**Why ASVS:** ASVS is designed as a practical verification standard for web apps and services, with requirement sets and assurance levels. We use it as our **security Definition of Done**.

---

## 0) Security posture & assurance level

### 0.1 App classification
This is a **high-risk side-effect system**:
- multi-tenant **agency-operated** platform
- **BYOK** (client-provided API keys)
- **browser automation** with saved sessions
- direct publishing + engagement actions (comments/DMs/likes)

**Primary risk = wrong-account actions + credential leakage + cross-tenant data exposure.**

### 0.2 Target ASVS level
- **Baseline target:** **ASVS Level 2 (Standard)** across the product.
- **Elevated target (select controls):** Apply **Level 3** rigor to:
  - tenant isolation
  - secrets/key management
  - authorization for side effects
  - audit immutability
  - browser profile vault

### 0.3 MVP security goals
1) **No cross-tenant access** (data or side effects)
2) **No secret leakage** (DB/logs/traces/artifacts)
3) **No silent side effects** (everything audited + verifiable)
4) **Fail closed** on drift/uncertainty (degraded mode)

---

## 1) Verification workflow (how security is enforced)

### 1.1 “Security gates” that block merges
A PR cannot merge unless:
- schema validations exist for security-critical inputs
- tests exist for tenant boundaries + RBAC enforcement
- secrets redaction tests pass (logs/traces)
- threat-model-linked checks are updated if new surface area is introduced
- any new side-effect tool call emits AuditEvent + proof pointers

### 1.2 “Release gates” that block production deploys
A release cannot deploy unless:
- golden paths pass (publish + verify + engage in sandbox)
- dependency scanning + SAST checks pass (tooling-dependent)
- secrets leak checks pass (repo + CI logs)
- incident runbooks exist for any new alerts introduced

### 1.3 Evidence standard (“prove it”)
Every verification item below includes an evidence type:
- **Test**: unit/integration/e2e
- **Policy**: documented enforcement
- **Telemetry**: logs/metrics/traces demonstrate control
- **Audit**: AuditEvents + artifacts prove side effects

---

## 2) System-specific security invariants (non-negotiable)

### 2.1 Tenant boundary invariant
Every read/write/job/tool execution must be scoped to:
- `client_id` (tenant)
- and where applicable: `platform_account_id`

**Verification:** automated tests that attempt cross-tenant access must fail.

### 2.2 Side-effect invariant (post/DM/comment/like)
Before any side effect:
- policy gate passes
- **identity assertions** pass (tenant + platform-account fingerprint)
- an **idempotency key** is present
- audit event written (attempt + result)
- proof artifact stored (API receipt or browser screenshot)

### 2.3 Secrets invariant
- no raw keys in DB
- no raw keys in logs/traces
- secret values never enter LLM context
- secrets stored in vault/KMS and referenced by `CredentialRef`

### 2.4 Browser automation invariant
- profile vault is encrypted
- profiles have signed manifests (expected account identifiers)
- runner must confirm identity before performing side effects
- drift/captcha -> degrade to read-only

---

## 3) ASVS mapping: controls we must satisfy (MVP)

> We map to ASVS categories to keep coverage comprehensive.

### V1 — Architecture, design, threat modeling
**Controls (MVP):**
- Threat model + DFDs exist and are updated for any new data flow
- ADR required for tenant model, secrets model, browser lane, tool gateway
- Degraded mode definitions exist

**Verification:**
- “Security-doc diff” check: PRs that change flows must update threat model OR explicitly declare “no impact.”

---

### V2 — Authentication
**Controls (MVP):**
- Strong operator authentication (MFA strongly preferred)
- Password policy if passwords are used; avoid local auth if possible
- Rate limit + lockout protection

**Verification:**
- Unit tests for auth middleware
- Integration tests for login rate limits / lockout behavior

---

### V3 — Session management
**Controls (MVP):**
- Secure cookies, short TTL, rotation
- CSRF protections where applicable
- Session invalidation on role change

**Verification:**
- Automated tests for cookie flags, CSRF
- Security headers check (CSP/Frame/Referrer policies)

---

### V4 — Access control (RBAC + tenant enforcement)
**Controls (MVP):**
- RBAC roles: Admin / Manager / Publisher / Reviewer / Analyst
- Per-route authorization
- Object-level authorization for every DB entity (client scoped)

**Verification:**
- Integration tests: attempt cross-tenant reads/writes
- Integration tests: role-based access to restricted endpoints

---

### V5 — Malicious input handling
**Controls (MVP):**
- Strong schema validation (Zod/TypeBox/etc) on every API boundary
- SSRF protections for URL ingestion/scraping (allowlists, fetch guards)
- Safe handling of webhook payloads

**Verification:**
- Fuzz/negative tests on endpoints
- SSRF regression tests

---

### V6 — Output encoding / injection safety
**Controls (MVP):**
- Escape/encode user-controlled outputs
- Guard against prompt injection in engagement by treating content as data

**Verification:**
- Tests for HTML injection paths
- Engagement router tests with adversarial prompt patterns

---

### V7 — Cryptography at rest
**Controls (MVP):**
- Encryption at rest for:
  - profile vault
  - artifact store objects
  - any sensitive DB columns (if used)

**Verification:**
- Config tests: storage encryption enabled
- Vault encryption tests for profile blobs

---

### V8 — Error handling + logging
**Controls (MVP):**
- No sensitive data in logs
- Standard error codes for operator visibility
- Security events are logged (auth failures, permission denials, vault access)

**Verification:**
- “redaction tests” (unit) ensure patterns are scrubbed
- Structured logging with trace correlation

---

### V9 — Data protection
**Controls (MVP):**
- Data minimization: store conversation **summaries** over raw content where possible
- Signed URLs for artifacts (short TTL)
- Tenant-scoped storage paths

**Verification:**
- Access tests on artifact URLs
- Tests for retention rules + deletion

---

### V10 — Communication security
**Controls (MVP):**
- TLS everywhere
- Secure webhook endpoints
- Strict CORS

**Verification:**
- Security header checks
- Webhook signature validation tests (where platform supports)

---

### V11 — HTTP security configuration
**Controls (MVP):**
- Hardened security headers
- CSP tuned for Next.js admin UI
- Clickjacking protections

**Verification:**
- Automated header tests in CI

---

### V12 — File and resource management
**Controls (MVP):**
- Safe file upload handling (type checks, size caps)
- Virus/malware scanning strategy (optional MVP, recommended)
- Safe parsing for PDFs/docs

**Verification:**
- Upload validation tests

---

### V13 — API and web service security
**Controls (MVP):**
- Authn/authz enforced for every endpoint
- Rate limiting for sensitive routes
- Idempotency for side-effect endpoints

**Verification:**
- Integration tests for idempotency and replay attacks

---

### V14 — Configuration
**Controls (MVP):**
- Secrets in vault/KMS
- Environment separation (dev/stage/prod)
- Feature flags for side effects

**Verification:**
- CI check: secrets not present in repo
- CI check: required env vars present in deployment

---

## 4) System-specific verification matrix (what we test, where)

> This is the actionable checklist used by engineering + verifier agents.

### 4.1 Tenant isolation (L3 rigor)
- [ ] All DB tables include `client_id`
- [ ] All queries are tenant-scoped
- [ ] Background jobs carry immutable tenant context
- [ ] Tool calls require tenant-scoped permission

**Tests:**
- [ ] Integration: “cross-tenant read” must 403/404
- [ ] Integration: “cross-tenant side effect” must hard-fail before tool call

### 4.2 BYOK secrets handling (L3 rigor)
- [ ] Only `CredentialRef` stored in DB
- [ ] Vault is the only place raw secret exists
- [ ] Keys never appear in logs/traces
- [ ] Provider router never injects secrets into LLM context

**Tests:**
- [ ] Unit: redaction patterns (API keys, tokens, cookies)
- [ ] Integration: vault fetch permissions are tenant scoped

### 4.3 Tool gateway permissions (Docker MCP)
- [ ] Tool registry is allowlisted by task class
- [ ] Script executor sandbox restrictions enforced
- [ ] Tool output stored as artifacts (not flooded into prompts)

**Tests:**
- [ ] Integration: attempt forbidden tool must fail
- [ ] Integration: large output stays out of LLM context (digest only)

### 4.4 Browser profile vault + wrong-account prevention (L3 rigor)
- [ ] Profile manifests include expected account identifiers
- [ ] Runner verifies identity before side effects
- [ ] Proof artifacts always captured

**Tests:**
- [ ] E2E: wrong profile selection attempt must be blocked
- [ ] E2E: drift/captcha triggers degraded mode

### 4.5 Engagement safety (prompt-injection hardening)
- [ ] Inbound messages treated as untrusted
- [ ] Allowed reply templates enforced
- [ ] Escalation triggers for sensitive intents

**Tests:**
- [ ] Unit: adversarial DM/comment fixtures
- [ ] Integration: “tool injection” attempt cannot trigger tool calls

---

## 5) CI integration (how checks run automatically)

### 5.1 Required checks (minimum)
- Static: lint + typecheck
- Unit tests
- Integration tests (API + runner)
- E2E smoke (sandbox, minimal)
- Security checks:
  - secrets scanning (repo + PR)
  - dependency scanning (policy-driven)
  - header/security config tests
  - redaction tests

### 5.2 Security test packs
**Pack A (fast, per PR):**
- tenant boundary unit tests
- RBAC tests
- redaction tests
- header tests

**Pack B (slower, nightly):**
- full integration suite
- sandbox publish + verification
- browser drift canary

---

## 6) Evidence artifacts (what we store)

For any release we retain:
- test run IDs + CI logs
- sandbox publish proof artifacts
- audit event sample exports
- threat model diff or statement

---

## 7) Ownership (who maintains what)

- **Security owner:** maintains ASVS mapping + gates
- **Platform owners:** maintain connector controls + rate limits
- **Browser owner:** maintains profile vault + drift defense
- **Observability owner:** maintains redaction and audit integrity

In vibecoding mode, a **Verifier Agent** runs the matrix and produces a pass/fail report.

---

## 8) Post-MVP extensibility patterns

This plan intentionally scales with the product:

1) **When client logins are introduced:**
- expand authN/authZ matrix, add client roles, expand session controls.

2) **When V2 metrics/experiments ship:**
- add privacy policies, consent, retention, data access controls.

3) **When more MCP tools are added:**
- add tool permission packs and sandboxing checks.

4) **When more platforms are added:**
- add platform-specific threat annex + connector verification pack.

---

## 9) Next doc

**Secrets & Key Management Runbook — v1**

