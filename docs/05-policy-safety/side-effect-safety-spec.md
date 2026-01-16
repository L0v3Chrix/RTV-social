# Platform Side-Effect Safety Spec — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose:** Define the **non-negotiable safety contract** for any action that causes an external side effect on a platform:

- publishing (post, reel, story, short, pin)
- scheduling
- editing/deleting
- engagement (like, comment reply, follow)
- outbound messages (DMs)

This spec is **platform-agnostic** (Meta/IG/TikTok/YouTube/LinkedIn/X/Skool) and **lane-agnostic** (API lane, Browser lane, Hybrid).

It is grounded in established reliability/security practices:
- Safe retries with **idempotent APIs** and request deduplication (AWS Builders’ Library) ([aws.amazon.com](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/?utm_source=chatgpt.com))
- Always attach **idempotency keys** to retryable side-effect requests (Stripe docs + guidance) ([docs.stripe.com](https://docs.stripe.com/api/idempotent_requests?utm_source=chatgpt.com))
- Security logging that avoids leaking sensitive data (OWASP Logging Cheat Sheet) ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html?utm_source=chatgpt.com))
- Consistent telemetry correlation attributes via OpenTelemetry semantic conventions ([opentelemetry.io](https://opentelemetry.io/docs/concepts/semantic-conventions/?utm_source=chatgpt.com))

---

## 0) Threats this spec prevents

1) **Duplicate side effects**
- same post published twice
- double-sent DM
- repeated comment replies

2) **Wrong-account side effects**
- posting on the wrong client’s account
- liking/commenting as the wrong profile

3) **Silent failure / unknown state**
- we don’t know if a post actually went live
- browser automation drifted, but still clicked “Post”

4) **Platform enforcement risk**
- spam-like patterns
- rate-limit thrash
- automation behavior that triggers restrictions

---

## 1) Definitions

### 1.1 Side effect
Any operation that changes remote state or triggers user-visible behavior on a platform.

### 1.2 Episode
A single end-to-end execution attempt for a unit of work (publish, DM batch, engage loop) with a unique **episode_id**.

### 1.3 Action
A single atomic side-effect attempt (e.g., “send DM to user X”, “publish post Y”) with a unique **action_id**.

### 1.4 Proof
Evidence that the action occurred (or did not occur) that can be reviewed by a human or verifier agent.

### 1.5 Idempotency key
A unique key representing “the same action” so retries don’t duplicate side effects. ([docs.stripe.com](https://docs.stripe.com/api/idempotent_requests?utm_source=chatgpt.com))

---

## 2) Global invariants (MUST always be true)

### Invariant A — Pre-flight policy gate
Before any side effect, the Policy Engine evaluates:
- client autonomy policy (auto/manual)
- platform policy (allowed actions)
- time window / quiet hours
- budget limits (rate/cost)
- content compliance flags

**If any check fails → hard block before tool call.**

### Invariant B — Identity assertions
Every side effect must prove:
- `client_id` matches
- `platform_account_id` matches
- `lane` (api/browser/hybrid)
- **fingerprint verification passes** (see §4)

### Invariant C — Idempotency + dedupe
Every side effect request must include:
- an **idempotency_key** (for API lane)
- and/or a **dedupe guard** (for browser lane)

Retries must be safe and predictable. ([aws.amazon.com](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/?utm_source=chatgpt.com))

### Invariant D — Append-only audit
Every attempt emits an immutable AuditEvent:
- planned
- attempted
- succeeded / failed / unknown
- with proof pointers

Logging must be security-safe (no secrets). ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html?utm_source=chatgpt.com))

### Invariant E — Verify or degrade
If the system cannot reliably verify outcome, it must:
- mark state as `unknown`
- collect proof
- escalate to human or re-check later
- **never proceed** to dependent steps without verification

---

## 3) Standard side-effect state machine

Every side-effect action follows this lifecycle:

1) `queued`
2) `preflight_passed`
3) `identity_verified`
4) `attempted`
5) `confirmed_success` OR `confirmed_failed` OR `unknown`
6) `postcheck_complete`

**Rules:**
- No transition bypasses.
- Side effects must be deterministic and replay-safe.

---

## 4) Identity verification (wrong-account prevention)

### 4.1 PlatformAccount fingerprint
When a platform account is connected, we store a stable fingerprint:
- platform account/page/channel ID
- username/handle
- display name
- any platform-specific immutable identifier we can query

### 4.2 API lane verification
Before side effects:
- call a read-only identity endpoint
- compare returned fingerprint to stored fingerprint

### 4.3 Browser lane verification
Before side effects:
- navigate to account/profile surface
- verify at least **2-of-3**:
  - handle visible
  - profile avatar or name visible
  - account switcher selection visible
- take a screenshot proof
- hash a DOM snapshot for drift detection

### 4.4 “Two-person rule” toggle (optional but recommended)
High-risk actions (paid ads, bulk DMs, offer blasts) can require:
- human approval
- or dual-verification (agent + human)

---

## 5) Idempotency & retries

### 5.1 API lane — mandatory idempotency keys
All retryable side-effect requests must include an idempotency key.

**Key composition (recommended):**
- `client_id`
- `platform`
- `platform_account_id`
- `action_type`
- deterministic payload hash
- optional timestamp bucket (only if required)

This follows the general pattern recommended for safe retry and dedupe. ([aws.amazon.com](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/?utm_source=chatgpt.com))

### 5.2 Retry rules
- retry only on **transient** failures (timeouts, 5xx, rate-limits)
- exponential backoff with jitter
- hard cap retries (budgeted)
- if platform returns “unknown state”, fall into `unknown` + verification loop

### 5.3 Browser lane — dedupe guard
Browser automation can’t rely on HTTP idempotency, so dedupe is achieved by:
- **pre-check:** confirm content not already posted / DM not already sent
- **UI receipt:** capture post/DM confirmation UI state
- **post-check:** verify the resulting artifact exists (see §6)

---

## 6) Proof & verification standards

### 6.1 Proof types
**API lane proof:**
- request id / response id / created object id
- platform permalink URL (if available)

**Browser lane proof:**
- screenshot at key step boundaries
- short screen recording for high-risk flows
- DOM snapshot hash

### 6.2 Verification levels
**Level 0 (queued):** no proof yet

**Level 1 (attempted):** attempt proof exists (request id or screenshot)

**Level 2 (confirmed):** the platform state confirms it (object exists)

**Level 3 (durable):** platform state + permalink stored + engagement surface visible

### 6.3 Verification loops
After publish/send:
- API lane: fetch created object by ID or list recent objects
- Browser lane: navigate to the destination surface and confirm content exists

If verification fails:
- mark `unknown`
- schedule a verification retry (read-only)
- escalate if still unknown after N attempts

---

## 7) Kill switches (mandatory)

Every side-effect path must respect kill switches at three levels:

1) **Global kill switch** — disables all side effects
2) **Client kill switch** — disables all side effects for a tenant
3) **PlatformAccount kill switch** — disables side effects for a specific connected account

**Kill switch must be checked:**
- before preflight
- immediately before tool call
- immediately before any “confirm/post” click in browser lane

---

## 8) Rate limits, pacing, and anti-enforcement posture

### 8.1 Budgeted pacing
Treat side effects like a scarce resource:
- per platform per account rate budgets
- per time-window quotas
- per-action spacing rules

### 8.2 “Human-like” engagement pacing (browser lane)
- randomized delay bounds
- cap per hour/day
- avoid repetitive patterns
- respect quiet hours

### 8.3 Rate-limit handling
If the platform returns a rate-limit signal:
- respect `retry-after` if available
- backoff and reschedule, do not thrash
- reduce concurrency

### 8.4 Enforcement guardrails
If platform friction increases:
- captcha or checkpoint triggered
- UI layout changed
- repeated auth failures

Then:
- immediately degrade to read-only
- require human intervention
- do not attempt side effects until validated

---

## 9) Side-effect event schema (AuditEvent)

All side effects emit an append-only record.

```json
{
  "audit_event_id": "uuid",
  "timestamp": "iso",
  "episode_id": "uuid",
  "action_id": "uuid",
  "client_id": "uuid",
  "platform": "instagram|facebook|tiktok|youtube|linkedin|x|skool",
  "platform_account_id": "uuid",
  "lane": "api|browser|hybrid",
  "action_type": "publish|schedule|dm_send|comment_reply|like|follow|edit|delete",
  "idempotency_key": "string",
  "policy_snapshot_id": "uuid",
  "identity_fingerprint_ok": true,
  "request": {
    "safe_payload_hash": "sha256",
    "tool": "connector|browser_runner",
    "tool_version": "semver"
  },
  "result": {
    "status": "queued|attempted|confirmed_success|confirmed_failed|unknown",
    "platform_object_id": "string",
    "permalink": "string",
    "http_status": 200,
    "error_code": "string"
  },
  "proof": {
    "artifact_refs": ["s3://…"],
    "screenshots": ["s3://…"],
    "dom_hash": "sha256"
  }
}
```

**Note:** No secrets or PII in audit payload; store pointers only. Security logging guidance recommends avoiding sensitive data in logs. ([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html?utm_source=chatgpt.com))

---

## 10) Telemetry correlation (required)

Every action must emit correlatable telemetry:
- `episode_id`, `action_id`, `client_id`, `platform_account_id`
- trace/span correlation

We follow OpenTelemetry semantic conventions for consistent naming across logs/metrics/traces. ([opentelemetry.io](https://opentelemetry.io/docs/concepts/semantic-conventions/?utm_source=chatgpt.com))

**Minimum telemetry:**
- span: `side_effect.action`
- metric: `side_effect.attempts`, `side_effect.success`, `side_effect.unknown`, `side_effect.latency_ms`
- log: structured event with redacted fields

---

## 11) Golden path safety checks (must exist in tests)

### GP1 — Plan → Create → Schedule (no side effects)
- ensures no side effects occur during planning/creation

### GP2 — Publish (API lane) → Verify
- confirm idempotency works on retry
- confirm object exists via read-only verification

### GP3 — Publish (browser lane) → Verify
- confirm identity assertions
- confirm proof artifacts exist
- confirm post exists

### GP4 — Engage loop → Reply to comment keyword → DM router
- confirm “keyword triggers” are policy-gated
- confirm no duplicate DM on retry

### GP5 — Kill switch trip
- confirm kill switch blocks at every stage

---

## 12) Post-MVP extensibility patterns

This spec is written to extend cleanly:

1) **Client logins (self-serve)**
- add per-client roles and additional approvals

2) **More platforms**
- add platform annex (capabilities, verification endpoints, proof patterns)

3) **A/B testing + metrics (V2)**
- add attribution IDs into AuditEvent
- add experiment_id + variant_id on publish actions

4) **Tooling expansion via Docker MCP**
- tool allowlists by action_type
- sandboxed workflow scripts that store raw outputs externally and return digests

---

## 13) Next doc

**Degraded Mode + Fallback Policy — v1**

