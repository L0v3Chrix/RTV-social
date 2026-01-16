# Sandbox Account Ops Runbook (Creation, Rotation, Recovery) — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency‑Operated)

**Purpose:** Provide an operator‑safe, repeatable way to create and manage **sandbox/test accounts** across platforms so engineers can develop and QA **without touching live client accounts**.

This runbook supports both lanes:

- **API lane** (OAuth + official APIs)
- **Browser lane** (Chrome profile vault + runner)

It also supports your stack constraints:

- **Multi‑tenant**: sandboxes are tenant‑scoped and never cross‑wired
- **BYOK**: sandbox uses separate keys/tokens from production
- **Vercel + Next.js**: environment separation and secret rotation

---

## 0) Definitions

### “Sandbox account”
A platform identity used for testing:

- a *test user* (platform‑provided) **or**
- a dedicated *test profile/page/channel/org* **or**
- a dedicated *agency‑owned “house account”*

### “House account”
A real account owned by your agency (not a platform-provided test user). Used for staging/production canaries.

### Environments
- **Local**: developer machine
- **Preview**: per‑PR deployment
- **Staging**: long‑lived, sandbox connected
- **Production**: live client connected

---

## 1) Non‑Negotiable Safety Rules

1. **Never test in production.**
   - All experiments start in sandbox; only then canary on house accounts; only then production.

2. **No shared identities.**
   - Every sandbox identity is owned by exactly one tenant scope: `TENANT_SANDBOX`.

3. **Secrets never leave the vault.**
   - DB stores only secret references.

4. **Browser lane is isolated.**
   - Sandbox Chrome profiles are separate from operator personal profiles.

5. **Kill switch always works.**
   - Any automation capable of posting/sending/engaging must be immediately stoppable.

---

## 2) Naming Conventions (Everything becomes searchable)

### Tenants
- `rtv-internal` — agency internal tenant
- `sandbox-{platform}-{purpose}` — e.g. `sandbox-meta-publishing`

### Platform accounts
- `RTV Sandbox – IG Creator 01`
- `RTV Sandbox – FB Page 01`
- `RTV Sandbox – TikTok 01`
- `RTV Sandbox – YT Channel 01`

### Secrets
- `vault://rtv/sandbox/{platform}/{account}/{secret}`

### Browser profiles
- `profile://sandbox/{platform}/{account}`

---

## 3) Required Tooling & Stores

### 3.1 Secret Store (choose one)
- 1Password / Bitwarden / AWS Secrets Manager / GCP Secret Manager

**Minimum required features:**
- Access control by group (operators vs engineers)
- Audit logs
- Rotation support

### 3.2 Email identity
Use domain aliases for deterministic ownership:
- `sandbox+{platform}+{id}@yourdomain.com`

### 3.3 SIM / Phone (for SMS/2FA)
- Prefer authenticator apps; avoid SMS where possible.
- If SMS is unavoidable, use dedicated numbers per sandbox identity.

### 3.4 Browser Profile Vault
- Encrypted profile storage
- Profile check‑out + check‑in workflow
- Session capture artifacts (screenshots, traces)

---

## 4) Platform‑Specific Sandbox Creation

### 4.1 Meta (Facebook + Instagram)
Meta provides robust test utilities that should be the default approach for API-lane development.

**What to create:**
1) **Test App** (separate from production app)
2) **Test Users**
3) **Test Pages** (created by test users)
4) IG Business/Creator test setup (when needed) linked to a Page

**Creation steps (operator):**
1. In Meta Developer Dashboard: create a **Test App**.
2. Create **Test Users** for roles needed (publisher, commenter, admin).
3. From a Test User, create **Test Pages** to simulate Page posting.
4. Wire your sandbox app credentials into **staging** only.

**Notes:**
- Development mode data is generally only visible to app role users; plan your QA expectations accordingly.
- Use test users/pages for integration tests; reserve house accounts for staging canaries.

**Browser lane:**
- Create a separate real FB profile if required for browser workflows (stories, certain surfaces) and store it as a sandbox Chrome profile.

---

### 4.2 TikTok
TikTok offers **Sandbox Mode** for apps.

**What to create:**
1) TikTok Developer App in **Sandbox mode**
2) Optional: separate house TikTok account for staging canaries

**Creation steps (operator):**
1. Create/manage app in TikTok Developer Portal.
2. Add a **Sandbox** configuration.
3. Connect sandbox credentials to staging.

**Important limitation:**
- Sandbox mode may not provide full functionality for every product (some features may be excluded). Plan for a staged approach: sandbox → house account → production.

---

### 4.3 YouTube
YouTube’s APIs are quota‑based and depend on Google OAuth.

**What to create:**
1) A dedicated **Google account** for sandbox
2) A dedicated **YouTube channel** (or Brand account channel) attached to that identity
3) Separate OAuth client for **staging**

**Creation steps (operator):**
1. Create `sandbox+youtube+01@yourdomain.com` Google identity.
2. Create a YouTube channel (and optionally a Brand channel).
3. Create OAuth client credentials specifically for staging.
4. Store refresh tokens in vault.

**Browser lane:**
- If testing upload flows through the browser, store authenticated session in sandbox Chrome profile.

---

### 4.4 LinkedIn
LinkedIn does not provide a universal sandbox equivalent for all APIs. Treat this as **test organizations/pages**.

**What to create:**
1) A dedicated LinkedIn “test company/page” owned by your agency
2) A dedicated sandbox user identity

**Creation steps (operator):**
1. Create sandbox LinkedIn user.
2. Create a company/page used only for testing.
3. Connect APIs in staging only.

**Browser lane:**
- LinkedIn automation can be sensitive; keep runs low frequency on sandbox assets.

---

### 4.5 X (formerly Twitter)
X provides environments within projects (e.g., Development/Production/Staging) and also enforces rate limits.

**What to create:**
1) X Developer project + app(s) with staging credentials
2) Sandbox X account for testing content

**Creation steps (operator):**
1. Create staging app credentials.
2. Authenticate with sandbox X account.
3. Store tokens in vault.

**Operational rule:**
- Respect rate limit headers; build retry logic that uses reset times.

---

### 4.6 Skool
Skool typically requires browser lane automation.

**What to create:**
1) A dedicated sandbox Skool group
2) A sandbox member account(s) for testing posts/comments/DMs

**Creation steps (operator):**
1. Create group owned by sandbox identity.
2. Add sandbox members for engagement tests.
3. Store each identity’s browser profile separately.

---

## 5) Environment Wiring (How sandboxes connect to your stack)

### 5.1 Separate Provider Config
Sandbox tenant must have its own:
- Platform OAuth creds
- Webhooks (if any)
- Callback URLs
- Rate limit budgets

### 5.2 Separate Vercel envs
- **Preview**: should default to mocked connectors or stub mode
- **Staging**: uses sandbox platform credentials
- **Prod**: uses live credentials

### 5.3 “No production secrets in preview” policy
Preview deployments must not have production credentials.

---

## 6) Rotation Policy

### 6.1 What gets rotated

**API lane**
- OAuth client secrets (when possible)
- Refresh tokens (if compromised or periodically)
- Webhook signing secrets

**Browser lane**
- Passwords
- 2FA secrets/recovery codes
- Session cookies (by re-login)

**Infrastructure**
- Vercel environment variables (staging)
- Vault access tokens

### 6.2 Rotation schedule (default)
- **Staging sandbox tokens**: every 30–60 days
- **Browser lane passwords**: every 60–90 days
- **Immediately** after any suspected compromise

### 6.3 Rotation workflow (operator)
1. Put sandbox tenant in **maintenance mode** (disable side effects).
2. Rotate secrets in platform portal.
3. Update vault secret values.
4. Update environment secret references.
5. Run golden-path smoke test:
   - auth → create → schedule → dry-run publish → verify stub
6. Re-enable side effects for staging.

---

## 7) Recovery Procedures

### 7.1 Account lockout
Symptoms:
- login challenge
- suspicious activity
- password reset required

Steps:
1. Disable automation flags for affected tenant/platform.
2. Check vault for recovery email/phone/backup codes.
3. Complete platform recovery.
4. Rotate password + revoke sessions.
5. Recreate the browser profile (fresh login) and re-encrypt.
6. Run smoke tests and re-enable.

### 7.2 Token revocation or expiry
Symptoms:
- API returns auth errors

Steps:
1. Disable jobs that require auth.
2. Trigger re-auth flow.
3. Store new refresh token.
4. Backfill missed work only if safe.

### 7.3 Suspected compromise
Steps:
1. Global kill switch for that platform/tenant.
2. Rotate all secrets.
3. Export audit logs.
4. Create incident + postmortem.

---

## 8) Daily Operator Checklist (Staging)

Morning:
- Confirm sandbox tenants are in correct environment (staging only)
- Confirm runner heartbeat
- Confirm no stuck queues

Before testing:
- Confirm the right tenant is selected in UI
- Confirm **publish flags OFF** unless specifically testing publishing

After testing:
- Clear pending posts
- Reset sandbox feeds if needed
- Archive artifacts (screenshots/traces)

---

## 9) Minimum “Sandbox Inventory” (MVP)

You should have at least:

- **Meta**: 1 test app, 2 test users, 1 test page, 1 IG business/creator account
- **TikTok**: 1 sandbox app configuration + 1 house TikTok account for canary
- **YouTube**: 1 sandbox Google identity + 1 channel
- **LinkedIn**: 1 sandbox user + 1 test page/org
- **X**: 1 sandbox user + staging app creds
- **Skool**: 1 sandbox group + 2 member accounts

---

## 10) Post‑MVP Extensibility Patterns

- **Automated sandbox provisioning**: infra scripts that create tenant shells + vault entries + seed data
- **Automated rotation jobs**: scheduled checks for token expiry and staged re-auth
- **Sandbox “reset” button**: clears all scheduled posts, deletes drafts, and archives artifacts
- **Cross-platform canary suite**: nightly publish+verify in sandboxes, weekly in house accounts

---

## Appendix A — What must be logged (audit)

For any sandbox action that touches external platforms, log:
- tenant_id, platform, account_id
- lane (API/browser)
- action type (post/comment/dm/etc)
- request id / trace id
- outcome + error code
- proof artifact links (screenshots/video where applicable)

---

## Appendix B — References

- Meta Test Apps: https://developers.facebook.com/docs/development/build-and-test/test-apps/
- Meta Test Users: https://developers.facebook.com/docs/development/build-and-test/test-users/
- Meta Test Pages: https://developers.facebook.com/docs/development/build-and-test/test-pages/
- Meta Build & Test overview: https://developers.facebook.com/docs/development/build-and-test/
- TikTok Sandbox announcement: https://developers.tiktok.com/blog/introducing-sandbox
- TikTok Add a Sandbox: https://developers.tiktok.com/doc/add-a-sandbox/
- TikTok Content Posting API Get Started: https://developers.tiktok.com/doc/content-posting-api-get-started
- Vercel Environment Variables: https://vercel.com/docs/environment-variables
- Vercel Sensitive Environment Variables: https://vercel.com/docs/environment-variables/sensitive-environment-variables
- Vercel Rotating Secrets: https://vercel.com/docs/environment-variables/rotating-secrets
- Playwright Auth + storage state: https://playwright.dev/docs/auth
- Playwright Best Practices (isolation): https://playwright.dev/docs/best-practices
- X API rate limits: https://docs.x.com/x-api/fundamentals/rate-limits

