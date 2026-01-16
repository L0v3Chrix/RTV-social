# Secrets & Key Management Runbook — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Goal:** A practical, operator-friendly runbook for creating, storing, accessing, rotating, revoking, auditing, and recovering secrets and cryptographic keys in a **multi-tenant BYOK** system with **browser automation** and **side-effect actions**.

This runbook implements widely accepted best practices:
- centralize secrets, minimize sprawl, rotate regularly (OWASP) ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html?utm_source=chatgpt.com))
- follow key lifecycle discipline (NIST SP 800-57) ([csrc.nist.gov](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final?utm_source=chatgpt.com))
- enable audit logging for the secrets system (Vault guidance) ([developer.hashicorp.com](https://developer.hashicorp.com/vault/docs/audit/best-practices?utm_source=chatgpt.com))
- use safe cryptographic storage/encryption-at-rest principles (OWASP) ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html?utm_source=chatgpt.com))
- keep “secrets” out of app logs and implement security logging intentionally (OWASP) ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html?utm_source=chatgpt.com))
- use platform features for sensitive env vars appropriately (Vercel) ([vercel.com](https://vercel.com/docs/environment-variables?utm_source=chatgpt.com))

---

## 0) Definitions (so operators don’t guess)

### Secret
Any value that grants access or enables impersonation, including:
- API keys (LLM, image, video, avatar providers)
- OAuth tokens / refresh tokens (social platforms)
- session cookies (browser lane)
- webhook signing secrets
- internal service tokens
- database credentials

### Key
Cryptographic material used to encrypt/decrypt/sign.
- **KEK (Key Encryption Key):** stored in KMS/HSM; encrypts other keys.
- **DEK (Data Encryption Key):** encrypts data blobs (e.g., browser profile vault artifacts).

### BYOK
Client provides their own provider keys. Our app stores **only references** and fetches secrets at runtime.

---

## 1) Non-negotiable rules

1) **No raw secrets in the database. Ever.**
- DB stores only `CredentialRef` pointers (e.g., `vault://…` or `kms://…`).

2) **No raw secrets in logs, traces, or artifacts.**
- Logs must be structured and redacted; security logging is intentional and minimal. ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html?utm_source=chatgpt.com))

3) **Secrets are centralized and rotated.**
- Centralization + rotation is recommended to reduce blast radius and bad habits. ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html?utm_source=chatgpt.com))

4) **Every secrets operation is auditable.**
- The secrets system must have audit logging enabled early; Vault explicitly recommends enabling audit devices. ([developer.hashicorp.com](https://developer.hashicorp.com/vault/docs/audit/best-practices?utm_source=chatgpt.com))

5) **Fail closed.**
- If secrets retrieval fails or identity verification fails, we do not perform side effects.

---

## 2) Secret inventory (what we manage)

### 2.1 Client secrets (per client_id)
**Provider keys (BYOK)**
- `anthropic_api_key`
- `openai_api_key`
- `google_gemini_api_key`
- `openrouter_api_key`
- `kie_api_key` (video)
- `heygen_api_key` (avatar)

**Platform auth**
- OAuth access + refresh tokens (Meta/Instagram, TikTok, LinkedIn, YouTube, X, Skool)
- Webhook signing secrets (where applicable)

**Browser lane**
- Encrypted browser profile blobs
- Session cookies (stored inside encrypted profile blobs, never plaintext)

### 2.2 Platform secrets (global, not client-specific)
- Vault/KMS access credentials for runtime (scoped roles)
- internal JWT signing keys (if used)
- service-to-service auth tokens

### 2.3 Cryptographic keys
- **KMS KEKs** (environment scoped) to encrypt DEKs
- DEKs (generated per profile / per sensitive artifact)

**Key lifecycle must follow creation → use → rotation/retirement → destruction.** ([csrc.nist.gov](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final?utm_source=chatgpt.com))

---

## 3) Storage design (where secrets live)

### 3.1 Canonical store
Use a secrets manager (recommended: **Vault** or a cloud KMS+secrets product).

**Requirements:**
- fine-grained policies per tenant path
- audit logging enabled
- response wrapping supported for one-time handoffs (Vault feature) ([developer.hashicorp.com](https://developer.hashicorp.com/vault/docs/concepts/response-wrapping?utm_source=chatgpt.com))

### 3.2 DB stores references only
Example `CredentialRef`:
```json
{
  "client_id": "uuid",
  "provider": "google|anthropic|openai|heygen|kie|meta|tiktok|linkedin|youtube|x|skool",
  "secret_ref": "vault://kv/clients/{client_id}/providers/google",
  "created_at": "timestamp",
  "created_by": "operator_id",
  "rotation_due_at": "timestamp"
}
```

### 3.3 Vercel environment variables (what is allowed)
Vercel env vars are fine for **non-tenant, non-BYOK** bootstrap config (e.g., Vault address, runtime role identifier), but avoid storing client keys there.
- Use Vercel’s environment variables correctly (including Preview vs Production separation). ([vercel.com](https://vercel.com/docs/environment-variables?utm_source=chatgpt.com))
- Enable “sensitive environment variables” policy so values are treated as sensitive. ([vercel.com](https://vercel.com/docs/environment-variables/sensitive-environment-variables?utm_source=chatgpt.com))

**Allowed in Vercel env:**
- `VAULT_ADDR`
- `VAULT_AUTH_ROLE` (or equivalent)
- `KMS_KEY_ID` (reference only)
- feature flags

**Not allowed in Vercel env:**
- any client provider keys
- OAuth refresh tokens
- browser session cookies

---

## 4) Access control model

### 4.1 Vault/KMS policies
Policies must be path-scoped:
- `/clients/{client_id}/…` is only readable by runtime when `client_id` is in the job context.

**Separation of duties:**
- Operators can write/rotate secrets
- Runners can read secrets only for the active tenant job

### 4.2 “Break glass”
- One break-glass role, time-limited, audited, approval-required.
- Use response wrapping for one-time distribution of high privilege tokens. ([developer.hashicorp.com](https://developer.hashicorp.com/vault/docs/concepts/response-wrapping?utm_source=chatgpt.com))

---

## 5) Standard operating procedures (SOPs)

### SOP 5.1 — Onboard a new client BYOK key
**When:** A new client provides provider keys.

**Steps:**
1) Create Vault path: `kv/clients/{client_id}/providers/{provider}`
2) Write secret into Vault (never paste into Slack/Notion/docs)
3) Create/Update `CredentialRef` in DB pointing to Vault path
4) Set `rotation_due_at` based on provider policy and risk
5) Run verification job (no side effects):
   - fetch secret
   - call provider “health/identity” endpoint
   - store result as non-sensitive audit note
6) Confirm logs/traces contain **no secret** patterns

**Evidence required:**
- Vault write event
- Verification job success
- AuditEvent for onboarding

---

### SOP 5.2 — Connect a social platform account (OAuth tokens)
**When:** You connect a client’s platform account.

**Steps:**
1) Complete OAuth flow in controlled environment
2) Store refresh token + metadata in Vault (tenant path)
3) Store DB reference only
4) Record platform account fingerprint in `PlatformAccount`:
   - page/account ID
   - username
   - expected display name
5) Run a read-only verification:
   - list recent posts
   - confirm identity matches fingerprint
6) Enable lane policy for this platform: API | Browser | Hybrid

**Evidence required:**
- Vault write event
- Platform identity verification record
- AuditEvent: “platform_connected”

---

### SOP 5.3 — Create a browser profile (profile vault)
**When:** Platform requires browser lane (stories, some engagement).

**Encryption design (envelope encryption):**
- generate a **DEK** per profile blob
- encrypt profile blob with DEK
- encrypt DEK with KMS **KEK**
- store encrypted blob + encrypted DEK + manifest

This follows cryptographic storage best practices (encrypt sensitive data at rest; keep key management separate). ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html?utm_source=chatgpt.com))

**Steps:**
1) Create Chrome profile for the client (profile id)
2) Log in manually once (operator) and confirm identity
3) Export profile blob → encrypt with DEK
4) Store encrypted blob in artifact store
5) Store encrypted DEK + manifest in Vault
6) Manifest must include:
   - `client_id`
   - platform(s)
   - expected account fingerprint(s)
   - created_by / created_at
7) Run runner validation (read-only):
   - open profile
   - verify account identity
   - take proof screenshot (non-sensitive)

**Evidence required:**
- Vault write event (encrypted DEK + manifest)
- Runner validation proof

---

## 6) Rotation policy

OWASP recommends regular rotation to reduce the window of usefulness of stolen credentials. ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html?utm_source=chatgpt.com))

### 6.1 Rotation schedule (defaults)
- **Provider API keys (LLMs, image/video):** 30–90 days (client preference)
- **OAuth refresh tokens:** rotate/refresh continuously via OAuth; re-auth if revoked
- **Internal service tokens:** 30 days
- **Browser profiles:** re-key (DEK rotation) every 30–60 days OR after any incident
- **KEKs (KMS):** per cloud policy (quarterly/annual) + audit

### 6.2 Rotation procedure (safe)
1) Create new secret alongside old secret (dual-write period)
2) Update ProviderConfig routing to “test new key” in staging
3) Run verification job and 1–3 dry-run episodes
4) Flip production to new secret
5) Revoke old secret
6) Confirm no error budget spike

### 6.3 Emergency rotation triggers
- suspected leak
- unusual provider usage
- platform account lockouts
- artifact store exposure

**Reference:** NIST emphasizes managing keying material across lifecycle including compromise handling. ([csrc.nist.gov](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final?utm_source=chatgpt.com))

---

## 7) Revocation & compromise response

### 7.1 If a client provider key is suspected leaked
1) **Global kill switch** for side effects on that client
2) Rotate provider key immediately
3) Audit last 24–72 hours of:
   - vault reads
   - provider usage metrics
   - tool calls
4) Update incident ticket + postmortem if P0/P1

### 7.2 If a social account token is revoked/compromised
1) Disable engagement + publishing for that platform
2) Require manual re-auth
3) Validate identity + permissions
4) Re-enable gradually (canary)

### 7.3 If browser profile vault is suspected compromised
1) Disable browser lane globally or for that client
2) Invalidate sessions (logout, revoke tokens where possible)
3) Recreate browser profile from scratch
4) Rotate DEK and KMS-encrypted DEK references
5) Run full wrong-account prevention validation

---

## 8) Logging, redaction, and audit

### 8.1 Logging rules
- Never log secrets
- Never log full OAuth token payloads
- Never log cookie values

Security logging should be intentionally designed and avoid sensitive content. ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html?utm_source=chatgpt.com))

### 8.2 Vault audit
- Enable audit devices early and keep them healthy (Vault best practice). ([developer.hashicorp.com](https://developer.hashicorp.com/vault/docs/audit/best-practices?utm_source=chatgpt.com))

### 8.3 “Secrets leak” regression test pack
- test that app logs redact:
  - `sk-`-like patterns
  - `Bearer ` tokens
  - long base64 segments
  - cookie key/value shapes
- test that traces do not include request headers containing auth

---

## 9) Backup & recovery

### 9.1 Vault/KMS
- follow vendor recommendations for backups and unseal policies
- test restore at least quarterly

### 9.2 Artifact store
- encrypted artifacts must remain decryptable after restore
- maintain KEK continuity or key versioning plan

### 9.3 DR drill (minimum)
Quarterly drill:
1) restore secrets system
2) restore DB refs
3) run verification-only suite for 3 sample tenants
4) confirm publish remains disabled during DR test

---

## 10) Operator checklists

### 10.1 Daily
- [ ] Vault health OK
- [ ] audit device healthy
- [ ] no secrets leak alerts
- [ ] no unusual provider usage spikes

### 10.2 Weekly
- [ ] rotation_due list reviewed
- [ ] least-privilege policy review for any new paths

### 10.3 Monthly
- [ ] run DR drill (if scheduled)
- [ ] rotate internal tokens

---

## 11) Post-MVP extensibility patterns

1) **Client self-serve keys**
- introduce per-client UI for key entry with immediate vault write and validation
- enforce “sensitive fields” handling

2) **Secret usage analytics**
- per-client/provider usage dashboards without exposing values

3) **Automated rotation**
- where providers support programmatic rotation (limited; implement carefully)

---

## 12) Next doc

**Platform Side-Effect Safety Spec — v1**
