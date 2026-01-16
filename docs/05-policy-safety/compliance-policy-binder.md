# Compliance & Automation Policy Binder — v1

**Purpose:** Define the rules, guardrails, and operating constraints that keep the platform **account-safe**, **policy-aligned**, and **legally sane** while still enabling high-leverage automation.

This binder is the authoritative reference for:
- what the system may do automatically
- what requires human review
- what is forbidden (or too risky)
- how we throttle behavior to avoid “spam / inauthentic” signals
- how we handle privacy, credentials, data retention
- how we respond to incidents (restrictions, bans, policy flags)

**Design stance:** Viral automation is only valuable if accounts stay alive. We optimize for **survivability** first, then scale.

---

## 1) Governance model: autonomy tiers

All agent actions are assigned a tier. Tier determines: approval requirements, rate limits, logging verbosity, rollback options.

### Tier 0 — Read-only intelligence
**Allowed automatically.**
- fetch scheduled calendar
- pull post status
- summarize inbound comments/DMs
- classify engagement intent (question, complaint, purchase intent)

### Tier 1 — Draft generation
**Allowed automatically.**
- generate plans, scripts, captions, creatives, replies as drafts
- generate engagement suggestions (not posted)

### Tier 2 — Safe side effects (low-risk actions)
**Auto-with-guardrails** (configurable per client).
- scheduling posts via approved APIs
- moderating obvious spam (hide/flag) where platform features exist
- sending a DM only when user initiated and policy allows

### Tier 3 — High-risk side effects
**Human approval required.**
- any automated “like/follow/unfollow”
- any proactive outbound DM to non-initiators
- any browser lane action that mimics a human for engagement at scale

### Tier 4 — Forbidden / Do-not-build
**Never allowed.**
- scraping private data
- mass messaging
- credential stuffing / sharing passwords
- evasion tooling designed to defeat platform detection

---

## 2) Platform posture matrix (MVP default)

This is the default compliance posture. Client-specific overrides require explicit risk acceptance.

### 2.1 Instagram & Facebook (Meta)
**Safe posture:**
- publishing via **approved APIs** or platform-native tools
- DM automation only through approved messaging surfaces where permitted

**High-risk / restricted:**
- automated engagement (mass liking/commenting) via browser lane
- any scraping / automated collection

**MVP default lanes:**
- Publish: **API first**, fallback to Browser only for missing features (e.g., Stories) with human approval
- Engage: **suggest + human approve** unless using approved messaging endpoints

### 2.2 TikTok
**Safe posture:**
- publish/schedule via supported methods
- engage through moderation/inbox workflows with human-in-loop

**High-risk / restricted:**
- bot-like comment automation
- repetitive templated replies

**MVP default lanes:**
- Publish: API/partner tooling where possible; Browser lane only for posting gaps, with verification + throttles
- Engage: **assist mode** (draft replies + queue), human approves

### 2.3 YouTube
**Safe posture:**
- publish Shorts via supported methods
- comment moderation using platform tools

**High-risk / restricted:**
- repetitive comments (classified as spam)
- link-spam DMs/comments

**MVP default lanes:**
- Engage: draft replies + human approval when volume is high; never mass-post replies

### 2.4 LinkedIn (strict)
**Safe posture:**
- publish manually or via official supported publishing where applicable

**High-risk / restricted:**
- any third-party automation or extensions that automate activity

**MVP default lanes:**
- Publish: **manual** or approved scheduling only
- Engage: **manual** (system can draft suggested replies)

### 2.5 X
**Safe posture:**
- automation is allowed within rules; spam/inauthentic behavior is prohibited

**High-risk / restricted:**
- automated spam posts, spam DMs
- manipulative behaviors

**MVP default lanes:**
- Publish: API lane
- Engage: assist mode + strict throttles

### 2.6 Skool
**Safe posture:**
- operate as a human in the product

**High-risk / restricted:**
- bots/automation posting/commenting/messaging (prohibited)

**MVP default lanes:**
- Publish: **manual only**
- Engage: **manual only**
- System can draft posts/replies and prepare queues

---

## 3) Browser lane policy (the “RPA” guardrails)

Browser automation is the most powerful lane and the most likely to trigger restrictions. We treat it like a controlled substance.

### 3.1 Browser lane allowed use cases (MVP)
- posting to surfaces that APIs do not support well (e.g., Stories)
- media upload where API is missing or unreliable
- verification checks (did post publish? is it visible?)

### 3.2 Browser lane prohibited use cases (MVP)
- mass liking
- mass following/unfollowing
- bulk commenting
- bulk DMs
- scraping user data

### 3.3 Browser lane execution constraints
- **Human-in-loop mode by default**: operator clicks “Run” and can watch step execution
- **Step-level logging**: selector used, timestamp, screenshots on failure
- **Kill switch**: instantly stop all runs on a client or platform
- **Rate caps**: hard per-hour caps (posts, comments, DMs)
- **Session hygiene**: do not run 24/7; enforce “human-like work windows”

---

## 4) Anti-spam & authenticity controls

These controls protect accounts from being flagged as automated.

### 4.1 Rate limiting (global)
- **Per account per hour:** caps for publishing attempts, comment replies, DMs
- **Per thread:** cap on rapid-fire replies
- **Randomized jitter:** avoid perfectly periodic behavior

### 4.2 Content uniqueness controls
- enforce response template diversity
- ban identical repeated replies across many users
- require context insertion (name, topic, specific question)

### 4.3 Link hygiene
- limit links in DMs
- forbid suspicious domains
- prefer “ask permission then link” flow

### 4.4 Escalation triggers
Auto-escalate to human when:
- pricing/quotes
- medical/legal/financial claims
- angry/hostile sentiment
- refund/chargeback intent
- user asks for a human

---

## 5) Policy enforcement inside the system

### 5.1 Policy as code
Policies live as:
- **Client AutonomyPolicy** (planning/creation/publish/engage)
- **PlatformPolicy** (per platform restrictions)
- **BlueprintPolicy** (blueprint-specific limits)

Every side-effect tool call must pass:
1) Client AutonomyPolicy
2) PlatformPolicy
3) CompliancePolicy (regulated claims, disclaimers)
4) BudgetPolicy (cost/latency)

### 5.2 Preflight / Postflight checks
Before: verify token validity, lane selection, rate limit remaining
After: verify published state; verify no duplicate publish; log result

---

## 6) Data privacy & credential handling

### 6.1 BYOK and secret storage
- store only **CredentialRef** in DB
- secrets live in vault/KMS
- no plaintext keys in logs

### 6.2 PII handling
- do not store full DM conversations unless required
- store conversation **summaries** for context
- retention windows per client

### 6.3 Audit logging
- every side-effect action must produce an audit entry:
  - who/what triggered it
  - what platform
  - what content
  - result + verification

---

## 7) Moderation & safety

### 7.1 Content redlines (examples)
- prohibited claims
- prohibited offers
- required disclaimers

### 7.2 Output gating
- all generated content passes:
  - compliance scan
  - toxicity/hate scan
  - regulated claims scan (if applicable)

---

## 8) Incident response playbook

### 8.1 Restriction / ban signals
- login challenge
- suspicious activity warnings
- token invalidations
- sudden publish failures

### 8.2 Response sequence
1) Freeze high-risk automation (Tier 3+)
2) Switch to manual mode
3) Run platform health diagnostics
4) Notify internal operator + client owner
5) Apply remediation (rotate tokens, reduce volume, remove risky workflows)
6) Post-incident report + learning events

### 8.3 “Account survival mode”
When a platform flags an account:
- only manual publishing for 7–14 days
- no engagement automation
- reduce frequency

---

## 9) MVP implementation checklist

**Must-have gates:**
- [ ] Autonomy tiers implemented
- [ ] Platform posture matrix enforced
- [ ] Browser lane restricted to allowed use cases
- [ ] Rate limiter + jitter in place
- [ ] Audit log for every side effect
- [ ] Escalation triggers working
- [ ] Kill switch + freeze per client

---

## 10) Post-MVP extensibility

- platform-specific compliance modules
- partner/API integrations replacing browser lane
- improved consent flows for DMs
- metrics-driven throttling (reduce actions when negatives rise)

---

## 11) Next document
**Experimentation OS — v1** (how we run controlled experiments safely without triggering platform manipulation signals).

