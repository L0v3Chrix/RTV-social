# Browser Automation Design (Profile Vault + Runner) — v1

This document defines the **browser automation subsystem** used when API publishing/engagement is unavailable, incomplete, or unreliable.

It covers:
- architecture and responsibilities
- profile vault design
- runner design (execution engine)
- workflow patterns (publish/engage)
- observability + evidence requirements
- safety controls (client isolation, rate limits, human takeover)
- MVP build checklist

Design goals:
- **Cleanest, fastest, most reliable path to MVP**
- **Deterministic execution** with retry and evidence
- **Client isolation** (no cross-account contamination)
- **RLM-friendly** (store artifacts; don’t flood agent context)
- **Extensible** (add new platforms + new flows without redesign)

---

## 0) Why browser automation exists in this system

### 0.1 The real-world platform gap
For many platforms and actions, official APIs are limited, expensive, or blocked by permissions:
- posting Stories (IG/FB)
- certain DM flows
- Skool community actions (likes, replies, moderation)
- UI-only toggles or quick edits

### 0.2 Browser lane policy
Browser automation is:
- a **fallback lane** when API lane can’t do the action
- a **capability unlock** for platforms with no usable API surface

### 0.3 Non-negotiable constraint
Browser lane must always produce **evidence artifacts**:
- before screenshot
- after screenshot
- step log
- DOM snapshot (when helpful)

---

## 1) Subsystem overview

### 1.1 Components
1) **Profile Vault**
   - stores and manages pre-authenticated browser profiles per client/platform
   - enforces isolation and lifecycle controls

2) **Runner**
   - executes a workflow in an isolated, repeatable way
   - handles retries, timeouts, network errors
   - records artifacts

3) **Workflow Library**
   - scripted sequences: publish story, publish reel, reply to comment, DM user, like post, etc.

4) **Selector Strategy + UI Contracts**
   - stable selectors (aria-labels, data-testid when possible)
   - “UI contract” tests to detect platform UI changes

5) **Observability + Audit**
   - run-level logs
   - screenshot evidence
   - per-step timings
   - failure classification

---

## 2) Profile Vault design

### 2.1 What a “profile” is
A **profile** is a browser state container that includes:
- cookies
- local storage/session storage
- saved logins
- trusted devices status
- “keep me signed in” settings

We treat profiles as **credentials + capability objects**.

### 2.2 Storage options (MVP)
MVP prefers the simplest reliable approach.

**Option A (recommended MVP): Persistent profile directory per client/platform**
- each profile lives as a folder on the worker host/container volume
- encrypted at rest (disk encryption) + access controlled by the runner

**Option B: Remote encrypted profile snapshots in S3**
- profile folder zipped + encrypted
- pulled before run, pushed after run
- heavier, but supports scaling across runners

**Option C: Browserless + remote profile management**
- more complex; defer until post-MVP

### 2.3 Naming + partitioning
Profiles are keyed by:
- `client_id`
- `platform`
- optional `account_variant` (e.g., IG main vs IG personal)

Example:
- `profiles/{client_id}/instagram/main/`
- `profiles/{client_id}/facebook/page_123/`
- `profiles/{client_id}/skool/community_ops/`

### 2.4 Vault metadata model
Profile Vault needs a DB record for each profile.

**Profile record fields (suggested):**
- `id`
- `client_id`
- `platform`
- `profile_path` or `snapshot_ref`
- `status`: active | needs_login | locked | compromised | retired
- `last_verified_at`
- `last_run_at`
- `capabilities`: can_post, can_story, can_dm, can_like, can_moderate
- `2fa_required`: yes/no
- `notes`: human readable

### 2.5 Lifecycle controls (must-have)

#### A) Creation
- Staff creates profile via a guided “Profile Setup” UI:
  - open interactive session
  - log in manually
  - system verifies login
  - system records baseline screenshot

#### B) Verification (every run or daily)
Before executing any workflow:
- open profile
- navigate to platform home
- confirm logged-in state
- fail fast with `needs_login` if not logged in

#### C) Locking
When a workflow is running:
- lock the profile (mutex)
- prevent concurrent runs

#### D) Rotation/retirement
If compromised or repeatedly failing:
- retire profile
- force new profile creation

### 2.6 2FA strategy (pragmatic MVP)
Most platforms enforce 2FA.

**MVP approach:**
- allow human-in-the-loop completion when 2FA appears
- capture “2FA needed” checkpoint artifact
- notify internal operator

Future:
- passkeys or device-based trust management

---

## 3) Runner design

### 3.1 Runner responsibilities
Runner is the execution engine that:
- boots a browser instance
- loads profile
- executes workflow steps
- captures artifacts
- handles retries and backoff
- returns a compact run summary to the agent

### 3.2 Execution model
Each run is:
- **one client**
- **one platform**
- **one workflow**
- **one isolated browser context**

No shared memory across clients. No multi-tab cross-client behavior.

### 3.3 Runner inputs
A runner job payload should include:
- `client_id`
- `platform`
- `workflow_name`
- `inputs` (media URLs, caption text, target thread refs)
- `policy` (max retries, max duration)

### 3.4 Runner outputs
Runner must output:
- `status`: success | fail | needs_login | needs_2fa | ui_changed
- `step_results`: timings + step states
- `artifact_refs`: screenshot paths + logs
- `external_refs`: URLs or IDs when discoverable

### 3.5 Step abstraction (high reliability)
Each workflow is a set of steps.

A step has:
- name
- preconditions
- action
- success criteria
- retry policy
- artifact capture rules

Example step:
- `navigate_to_create_story`
  - success when the “Create Story” UI is visible

### 3.6 Failure classification (important)
Runner must classify failures so we can route fixes:
- `AUTH_EXPIRED`
- `2FA_CHALLENGE`
- `UI_SELECTOR_CHANGED`
- `UPLOAD_FAILED`
- `RATE_LIMIT`
- `NETWORK_FLAP`
- `UNKNOWN`

This classification is stored in PublishRun/WorkflowRun.

### 3.7 Retry policy (MVP)
- default retries: 2
- exponential backoff
- do not retry on AUTH_EXPIRED unless human resolves
- do not spam platforms

### 3.8 Rate limiting + safety
Rate limits should be enforced per:
- platform
- client
- action type

Example:
- max 10 comment replies / 10 minutes
- max 20 likes / hour
- max 5 DMs / hour

Policies can be set per client.

---

## 4) Selector strategy + UI contracts

### 4.1 Selector hierarchy (best practice)
Prefer stable selectors in this order:
1) platform-provided `aria-label` / accessibility labels
2) stable text + role selectors
3) data attributes (rare on consumer sites)
4) CSS selectors as last resort

### 4.2 UI contract tests
Create small “contract checks” per platform:
- open home
- confirm the presence of key UI elements
- confirm create-post UI can be opened

If contract fails:
- mark workflow as `ui_changed`
- prevent risky publish actions

---

## 5) Workflow library (MVP set)

The MVP should implement a small set of workflows that unlock the majority of value.

### 5.1 Publishing workflows
1) **IG Story Publish** (browser)
- upload story media
- optional caption overlay (if supported)
- publish

2) **IG Reel Publish** (browser)
- upload video
- paste caption
- publish

3) **FB Page Post Publish** (browser)
- upload media
- caption
- publish

4) **Skool Post Publish** (browser)
- create post
- paste content
- attach media
- publish

### 5.2 Engagement workflows
1) **Like + Reply to Comment** (IG/FB)
- locate post
- open comment thread
- like comment
- reply

2) **DM user after keyword**
- locate commenter
- open profile
- send DM template

3) **Skool community ops**
- like
- reply
- DM
- pin/unpin (optional)

### 5.3 Evidence requirements per workflow
Every workflow must capture:
- pre-action screenshot
- post-action screenshot
- step log
- DOM snapshot on failure

---

## 6) Human takeover (“assist mode”)

### 6.1 Why it matters
Some failures are not solvable autonomously:
- 2FA
- captcha
- suspicious login
- UI changes

### 6.2 Assist mode flow
- runner pauses
- system opens a remote interactive session
- operator completes step
- runner resumes from checkpoint

### 6.3 Audit trail
Assist mode must log:
- who intervened
- what step
- screenshots before/after

---

## 7) Security + compliance controls

### 7.1 Secrets separation
- platform credentials must NOT be stored in DB
- only CredentialRef pointers

### 7.2 Profile encryption
- profiles stored encrypted at rest
- access controlled by runner process identity

### 7.3 Least privilege
- profile only has access to required accounts
- avoid using personal master accounts when possible

### 7.4 Cross-client contamination prevention
- strict profile locking
- no shared runner sessions
- kill browser after each run

---

## 8) MVP build checklist (actionable)

### Phase 1 — Profile Vault
- [ ] DB model + UI for profile registry
- [ ] Create profile session (manual login)
- [ ] Verify login state
- [ ] Locking + status transitions

### Phase 2 — Runner
- [ ] Job payload schema
- [ ] Step engine + retry/backoff
- [ ] Artifact capture (screenshots + logs)
- [ ] Failure classification

### Phase 3 — Workflows
- [ ] `open_profile_session`
- [ ] `publish_instagram_story`
- [ ] `publish_instagram_reel`
- [ ] `skool_post_publish`
- [ ] `skool_reply_and_dm_router`

### Phase 4 — Observability
- [ ] PublishRun UI view (proof + logs)
- [ ] Alerting on needs_login / ui_changed

---

## 9) Required “definition of done” for browser lane
- Publish a Story successfully from a stored profile
- Publish a Reel successfully from a stored profile
- Reply in Skool from a stored profile
- Evidence artifacts stored for every run
- Safe failure states (needs_login, needs_2fa, ui_changed)

---

## 10) Next document
**(Per your order) PDR second-to-last and MVP milestone checklist/test plan last.**

