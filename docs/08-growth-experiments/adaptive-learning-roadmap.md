# Adaptive Learning & Future Metrics Roadmap — v1

This document scopes **system-level learning** (functional reliability + operational intelligence) for the platform, and then outlines a **Version 2** roadmap for campaign metrics/tracking.

**Important distinction (per your direction):**
- **V1 learning (this doc):** improves the *functionality of the system* (fewer failures, smarter defaults, safer autonomy, faster ops).
- **V2 learning (roadmap):** expands into *campaign performance learning* (virality/retention/conversion) with analytics.

---

## 1) Goals

### 1.1 MVP (V1) goals — system-level learning
The platform should learn to:
- reduce tool failures and retries (publish, browser actions, API errors)
- improve agent reliability (less looping, better FixLists, more consistent outputs)
- automatically choose safer/faster/cheaper execution paths (model routing + lane routing)
- shorten operator workload by **remembering** operator preferences and repeated corrections
- improve scheduling success (fewer blocked publish attempts, fewer re-uploads)

### 1.2 V2 goals — campaign metrics and optimization
- unify platform analytics (per post, per blueprint, per client)
- track leading indicators for algorithm success (retention proxies, saves/shares, dwell proxies)
- support experimentation (A/B, multi-armed rotation)
- connect outcomes to planning decisions automatically

---

## 2) What “Adaptive Learning” means in this system

Adaptive learning is NOT model retraining in the MVP.

In V1, adaptive learning is:
- **structured feedback capture**
- **policy-driven updates** to configuration and heuristics
- **versioned prompt + workflow revisions**
- **automated recommendations** (and optional auto-application under guardrails)

Think of it as a **self-tuning control system** for agents + tools.

---

## 3) Learning Surfaces (V1)

### 3.1 Prompt & Output Reliability (agent-level)
What we learn:
- which prompt patterns cause failures, hallucinations, policy violations, or inconsistent schemas
- what instructions reduce retries and QA failures

Signals:
- schema validation failures
- QA evaluation failures
- operator edits and reasons
- repeated FixList patterns (same fix repeated across outputs)

Updates produced:
- prompt template refinements (v1 → v1.1)
- stricter schemas or additional required fields
- improved “self-check” lists per blueprint type

### 3.2 Tool & Lane Reliability (execution-level)
What we learn:
- which tools fail under what conditions (platform UI drift, token expiry, provider downtime)
- whether API lane or browser lane is more reliable per content type

Signals:
- tool call failures by code (401/429/5xx)
- browser runner step failure patterns (selector breaks, 2FA, CAPTCHA)
- publish verification mismatch rates

Updates produced:
- per-platform lane preference updates (API → Hybrid → Browser)
- selector strategy upgrades (e.g., fallback selectors)
- automated “contract tests” triggered before attempting high-volume runs

### 3.3 Operator Preference Learning (agency workflow)
What we learn:
- when humans consistently rewrite tone, CTAs, hashtags, captions
- when they prefer manual scheduling vs auto

Signals:
- tracked diff between generated vs approved (edit distance + semantic diffs)
- operator selections (variant A chosen 90% of time)

Updates produced:
- BrandKit refinements suggestions (do_say/never_say)
- default CTA style shifts (comment_keyword vs DM vs link)
- blueprint defaults updated per client

### 3.4 Budget & Latency Tuning (FinOps)
What we learn:
- which workflows exceed budget (tokens/tool calls/time)
- which models/providers are most cost-effective for each lane

Signals:
- tokens/latency per episode
- retries per node
- per-provider cost estimates

Updates produced:
- ProviderConfig routing tweaks (cheap model for drafts, premium only when needed)
- tighter token caps for specific agents
- “auto-degrade” thresholds tuned

---

## 4) Feedback Sources (V1)

### 4.1 Human feedback (explicit)
- Approve / Reject
- “Needs edits” with reason
- Manual rewrite (diff captured)
- Escalation decision (why)

### 4.2 System feedback (implicit)
- Tool failures and error categories
- Retry counts
- Timeouts
- Publish verification results
- Contract test results

### 4.3 Environment feedback
- Provider outage or performance degradation
- Platform UI changes
- Rate limiting behavior

---

## 5) Core Data Model Additions (learning tables)

> These are conceptual schemas; implement in Postgres with links to S3 artifacts.

### 5.1 LearningEvent (atomic record)
Captures every useful “learning moment.”

```json
{
  "learning_event_id": "uuid",
  "client_id": "uuid",
  "timestamp": "iso",
  "source": "human|system|platform",
  "lane": "planning|creation|publishing|engagement",
  "agent": "Planner|Copywriter|PublisherBrowser|...",
  "subject_type": "plan_node|asset|publish_run|thread|tool_call",
  "subject_id": "uuid",
  "event_type": "approve|reject|edit|retry|tool_fail|verify_fail|timeout|escalate",
  "severity": "low|med|high",
  "metadata": {
    "platform": "instagram|tiktok|skool|...",
    "blueprint": "short_reel_hook_value_cta",
    "error_code": "optional",
    "reason": "optional",
    "diff_uri": "s3://.../diff.json"
  }
}
```

### 5.2 AgentQualityStats (rolling)
```json
{
  "agent": "Copywriter",
  "client_id": "uuid",
  "window": "7d",
  "episodes": 120,
  "schema_fail_rate": 0.02,
  "qa_fail_rate": 0.11,
  "avg_retries": 0.7,
  "avg_latency_ms": 4200,
  "avg_tokens": 3100,
  "top_failure_modes": ["missing_disclaimer", "tone_drift"]
}
```

### 5.3 ToolReliabilityStats (rolling)
```json
{
  "tool": "PublisherBrowser.InstagramPost",
  "client_id": "uuid",
  "window": "7d",
  "runs": 60,
  "success_rate": 0.85,
  "verify_mismatch_rate": 0.05,
  "avg_duration_sec": 75,
  "top_fail_steps": ["upload", "caption_field"],
  "common_error": ["selector_not_found", "2fa_required"]
}
```

### 5.4 OperatorPreferenceProfile (per client)
```json
{
  "client_id": "uuid",
  "voice_adjustments": {
    "preferred_energy": "high",
    "avoid_phrases": ["string"],
    "prefer_phrases": ["string"]
  },
  "cta_preferences": {
    "primary": "comment_keyword",
    "secondary": "dm_keyword"
  },
  "approval_style": {
    "requires_review_for": ["offers", "testimonials"],
    "auto_ok_for": ["educational_posts"]
  }
}
```

---

## 6) Learning Loops (how the system updates itself)

### 6.1 Online learning loop (real-time micro-updates)
Triggered immediately when:
- a publish fails
- verification mismatches
- a DM reply escalates
- an operator rejects content

Output:
- a FixList
- a recommended config adjustment (not applied automatically unless allowed)

### 6.2 Batch learning loop (nightly)
Runs once nightly per client (or across all clients):
- aggregates LearningEvents
- updates rolling stats
- produces a “Suggested Improvements” report

Nightly outputs:
- PromptTemplatePatch proposals
- ToolWorkflowPatch proposals
- ProviderRoutingPatch proposals
- Updated default settings proposals

### 6.3 Patch application loop (guarded)
All changes are **versioned**.

Patch application modes:
- **Suggest only (default MVP):** human clicks “Apply patch”
- **Auto-apply allowed for low-risk classes:** e.g., token caps, tool retry timers
- **Never auto-apply:** anything that changes policy boundaries or creates new side effects

---

## 7) What can update automatically vs requires human approval

### 7.1 Auto-apply allowed (low-risk)
- token/time budgets within safe range
- retry/backoff timings
- tool selection ordering when equivalent
- caching settings

### 7.2 Requires human approval (medium/high risk)
- changing BrandKit voice rules
- changing default CTA behavior
- enabling engagement auto-replies in new categories
- switching lane to Browser for a platform
- changing any compliance-related behavior

### 7.3 Never auto-apply
- adding new tools with side effects
- changing autonomy policy from manual → auto
- storing additional sensitive data

---

## 8) Versioning, rollback, and governance

### 8.1 Config versioning
Every adjustable component is versioned:
- BrandKit version
- KnowledgeBase summary version
- ProviderConfig version
- Tool workflow version
- PromptTemplate version

### 8.2 Patch format
```json
{
  "patch_id": "uuid",
  "scope": "client|global",
  "target": "PromptTemplate|ToolWorkflow|ProviderConfig|BudgetConfig",
  "target_id": "string",
  "from_version": "v1.0",
  "to_version": "v1.1",
  "changes": [{"path":"/params/max_tokens","op":"replace","value":1200}],
  "risk": "low|med|high",
  "requires_approval": true,
  "justification": "Based on 14 rejects for missing disclaimers.",
  "evidence": ["s3://.../report.json"]
}
```

### 8.3 Rollback
Any applied patch can be rolled back by:
- restoring previous version pointers
- re-running contract tests

---

## 9) Operator UX additions (to support “check twice daily”)

### 9.1 “Learning Inbox” panel
A queue of suggested patches with:
- reason
- risk
- apply button
- rollback button

### 9.2 Two daily check-ins
**Morning check:**
- verify scheduled posts are “green”
- review any high-risk patch suggestions
- approve pending publish packages

**Afternoon check:**
- verify publishes succeeded
- clear escalations (DMs/comments)
- approve or reject recommended patches

---

## 10) MVP Scope: what we actually build now

### Build now (V1)
- LearningEvent logging (human + system)
- nightly batch aggregation job
- Suggested Improvements report
- patch proposal generation (not auto-applied by default)
- minimal “Learning Inbox” UI

### Defer (V1.5)
- automated patch apply for low-risk classes
- multi-agent committee to approve patches automatically

---

## 11) Version 2 Roadmap: Campaign metrics & tracking

You said: *“roadmapping for version two to have campaign metrics and tracking.”*

### V2 deliverables
1) Unified analytics ingestion per platform (API where available)
2) Metrics model:
   - reach, impressions, engagement rate
   - retention proxies (watch time %, completion)
   - saves/shares
   - CTR/link clicks
3) Blueprint performance tables
4) Experimentation engine (A/B + rotation)
5) Planning feedback integration:
   - planner sees “what worked recently” and prioritizes it

### V2 “Performance Planner” agent (new)
- reads BlueprintPerformance
- proposes plan changes
- recommends which blueprints to allocate more slots

### V2 governance
- performance optimization must never violate:
  - compliance
  - anti-spam pacing
  - autonomy rules

---

## 12) Definition of Done (for V1 learning)

V1 learning is complete when:
- every approval/reject/edit produces a LearningEvent
- failures produce LearningEvents and suggested patches
- nightly report generates reliably
- patches are versioned, reviewable, and rollbackable
- the operator can keep the system running with **two short daily check-ins**

---

## 13) Next requested docs (your list)

You asked to place the following as individual documents/artifacts:
1) Platform Algorithm Alignment Playbooks
2) Compliance & Automation Policy Binder
3) Experimentation OS
4) Observability & Check-In Dashboard Spec

This document (Adaptive Learning & Future Metrics Roadmap) is now the 5th in that “success pack.”

