# Data Retention & Privacy Policy — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Purpose:** Define what data we collect, why we collect it, how long we keep it, where it lives, and how we delete it—so we operate safely, reduce legal/privacy risk, and keep the system fast + reliable.

**Scope:** Web app, runner/queues, tool gateway, browser lane, platform integrations (API + browser), analytics/telemetry, and external memory.

**Audience:** Engineering, Operators (agency), Security owner.

---

## 0) Core principles (the rules)

1) **Minimize** — Collect the least data required to plan/create/publish/engage and to debug incidents.

2) **Purpose-bound** — Every data category has a defined purpose. No “just in case” retention.

3) **Time-bound** — Every data category has an explicit retention period and deletion mechanism.

4) **Separation** — Separate:
- **Client-owned content** (assets, posts)
- **Platform credentials** (tokens, cookies)
- **Observability** (logs, traces)
- **External memory** (summaries, plans)

5) **Redaction by default** — Logs and traces must not contain secrets or sensitive message content.

6) **Tenant isolation** — No cross-tenant access, ever.

7) **Auditability** — Deletions are provable (append-only deletion events; proof of purge where possible).

---

## 1) Data inventory (what we store)

### 1.1 Client onboarding data
- BrandKit (voice, offers, design tokens, compliance redlines)
- KnowledgeBase (structured FAQ + summarized sources + metadata)
- PlatformAccount config (lane prefs, capabilities)
- Autonomy/approval policies

### 1.2 Operational execution data
- Plans (content calendars, intent graphs)
- Tasks/jobs (queue episodes)
- Approvals + operator actions
- Publish schedules

### 1.3 Side-effect proof + audit trail
- Audit events for any attempt to publish/send/engage
- Verification artifacts (proof URLs, screenshot refs, status)

### 1.4 Engagement data
- Comment events (minimal fields)
- DM events (minimal fields)
- Keyword triggers (comment-to-DM routing metadata)

### 1.5 Media assets
- Images, videos, thumbnails
- Prompt templates (non-sensitive)
- Final generated clips and stitched outputs

### 1.6 Credentials + secrets (BYOK)
- Provider keys (LLM/image/video/avatar)
- OAuth tokens/refresh tokens
- Browser profile cookies (if browser lane)

**Important:** raw secrets do **not** live in the database—only secret references.

### 1.7 Observability data
- Application logs
- Traces
- Metrics
- Error reports

### 1.8 External Memory (RLM core)
- Plan graph summaries
- Asset graph
- Conversation/decision summaries
- Engagement event summaries

---

## 2) Data classification (how we label risk)

### 2.1 Levels

**L0 — Public**
- public posts, public profile URLs

**L1 — Internal operational**
- job IDs, non-sensitive config, non-sensitive prompts

**L2 — Personal / customer interaction**
- usernames/handles, DM metadata, comment metadata

**L3 — Sensitive**
- DM body content, customer contact data (emails/phones if present), complaint/health/finance context

**L4 — Secrets**
- API keys, OAuth tokens, cookies, encryption keys

### 2.2 Handling rules
- L3 content is stored only when necessary and is minimized/summarized aggressively.
- L4 secrets are stored only in the secret manager; logs must never include L4.

---

## 3) Storage map (where the data lives)

### 3.1 Database (Postgres)
- Tenant config + policies
- Plan/asset metadata
- Job state
- Audit event index (metadata)

### 3.2 Object storage (S3/R2/Blob)
- Media assets (images/videos)
- Verification artifacts (screenshots)
- Uploaded KB documents (raw)

### 3.3 Vector/Index store (optional)
- Embeddings for KB retrieval
- Summary-first indexing

### 3.4 Secrets manager (Vault/KMS)
- All provider keys/tokens
- Browser profile encryption keys
- OAuth refresh tokens

### 3.5 Telemetry backend
- Logs/traces/metrics
- Redaction + sampling controls

---

## 4) Retention schedule (MVP defaults)

**Operators may override retention per client** only if consistent with policy and documented.

### 4.1 Core retention table (default)

1) **BrandKit + KB structured data**
- Retention: **Active contract + 12 months**
- Purpose: ongoing content planning + continuity
- Deletion: hard delete on termination request (see §7)

2) **Raw KB source documents**
- Retention: **Active contract + 90 days**
- Purpose: re-summarization + dispute resolution
- Policy: prefer storing summaries; raw docs can be re-provided by client

3) **Plans (calendar/plan graph)**
- Retention: **18 months**
- Purpose: learning from what we planned and posted; reproducibility

4) **Job execution traces (non-sensitive)**
- Retention: **30 days** (hot)
- Purpose: debugging
- Note: long-term metrics kept, but not raw logs

5) **Audit events (metadata + proof pointers)**
- Retention: **24 months**
- Purpose: accountability for side effects

6) **Verification artifacts (screenshots/proofs)**
- Retention: **90 days**
- Purpose: dispute resolution and debugging

7) **Engagement event metadata (comment/dm IDs, timestamps, outcome)**
- Retention: **90 days**
- Purpose: engagement workflow operation + troubleshooting

8) **DM/Comment body content**
- Retention: **0–14 days** (default **7 days**) then summarized and purged
- Purpose: quality assurance + escalation handling
- Rule: store minimal snippets if required; prefer summaries

9) **Generated media assets**
- Retention: **Active contract + 12 months**
- Purpose: re-use and repurposing

10) **Provider request/response payloads**
- Retention: **0 days** (do not store) unless explicitly needed for debugging; if stored, max **7 days**

11) **Secrets (tokens/keys/cookies)**
- Retention: **Active contract only**
- Rotation: per §8
- On termination: revoke + delete

---

## 5) Privacy + compliance behavior (how we operate)

### 5.1 Data minimization rules for engagement
- Store identifiers and outcomes, not full bodies.
- For DMs/comments, keep:
  - platform message ID
  - user handle
  - timestamps
  - classifier label (question/complaint/lead)
  - response outcome

### 5.2 Summarize-then-purge
For any L3 user text (DM bodies, complaint messages):
- Create a short summary with redaction
- Store the summary
- Purge the raw body within retention window

### 5.3 Logging redaction requirements
- Never log tokens, cookies, API keys, auth headers
- Never log DM/comment bodies by default
- Hash session IDs where needed
- Use allow-list logging for platform payloads

### 5.4 Tenant isolation requirements
- Every object row keyed by `tenant_id`
- Always include tenant scope in queries
- Enforce in code and DB constraints

---

## 6) Data subject and client requests (operational process)

### 6.1 Request types
- Access request (what do we store?)
- Deletion request
- Correction request
- Export request (media + plans)

### 6.2 Identity + authorization
Because this is agency-operated:
- Requests must come from authorized client contact(s)
- We verify via contract contact list + email domain

### 6.3 Response SLA (MVP target)
- Acknowledge: 2 business days
- Fulfill: 14 business days (or sooner)

---

## 7) Deletion policy (what happens on termination)

### 7.1 Termination workflow
1) Disable all automation (kill switches)
2) Revoke platform access (OAuth revoke where possible)
3) Revoke provider keys (if stored under our secret manager)
4) Export client assets (optional)
5) Purge data per categories below
6) Emit `DeletionEvent` audit record

### 7.2 Purge matrix

**Hard delete (default on request):**
- BrandKit
- KB structured data
- KB raw documents (object storage)
- Tenant config
- Media assets (unless client requests export + continued retention)
- Browser profiles + cookies
- Provider credentials references

**Retain minimal audit metadata (if legally/operationally required):**
- Audit event headers (no content)
- Financial invoices/contract docs (outside this system)

### 7.3 Proof of deletion
- Produce a deletion report:
  - timestamp
  - categories deleted
  - storage locations purged
  - remaining retained categories + justification

---

## 8) Key/token retention + rotation (ties to Secrets Runbook)

- Keys are scoped by tenant and provider.
- Rotate on:
  - suspected exposure
  - provider rotation schedules
  - staff change (operator access)

Browser lane cookies:
- store encrypted
- rotate by regenerating profiles
- invalidate immediately on suspicious activity

---

## 9) Engineering requirements (build rules)

### 9.1 Data retention enforcement mechanisms
- TTL jobs for ephemeral stores
- scheduled purge worker (daily)
- deletion queues (idempotent)
- unit tests asserting retention windows

### 9.2 “No raw body” enforcement
- Schema supports `content_summary` and `content_ref` (optional)
- Raw body storage requires explicit `allow_raw_body_storage=true` policy override and expires automatically.

### 9.3 Backups
- Backups exist, but deletion requests must be honored by:
  - normal purge
  - and backup expiration/rotation

---

## 10) Post-MVP extensibility patterns

1) **Per-jurisdiction retention profiles**
- GDPR, CPRA, etc.

2) **Privacy center**
- client-facing export/delete UI (future)

3) **Metrics OS**
- keep aggregated metrics long-term while purging raw interaction content

4) **Differential retention by blueprint**
- ad workflows may require different proofs/retention than organic content

---

## 11) Next doc

**RBAC & Operator Permissioning Spec — v1**

