# Evaluation Loops — v1

This document defines the **evaluation system** that makes the platform safe, reliable, and self-correcting.

Evaluation Loops answer three questions:
1) **Is the output correct and compliant?**
2) **Is the output high quality and aligned with goals?**
3) **Should we iterate (recurse), escalate to a human, or stop?**

This spec applies to:
- Planning → Creation → Publishing → Engagement
- MVP reliability
- Post-MVP extensibility (more evaluators, richer metrics)

---

## 0) Principles

### 0.1 Two-stage evaluation
Every meaningful output is evaluated:
1) **Preflight** (before it touches the real world)
2) **Postflight** (after it touches the real world)

### 0.2 Deterministic first, model second
Prefer deterministic checks:
- schema validation
- platform constraints (ratio, length)
- required disclaimer presence
- policy flags

Then apply model-based evaluation:
- brand voice alignment
- persuasion strength
- clarity and usefulness
- tone appropriateness

### 0.3 Evidence over vibes
Evaluation outputs must cite:
- which rule failed
- which artifact shows it
- what fix is required

### 0.4 Bounded recursion
Evaluation must always decide:
- **RETRY** (fix and rerun)
- **ESCALATE** (human needed)
- **STOP** (accept or deny)

---

## 1) Evaluation Objects (External Memory)

### 1.1 EvaluationReport
An evaluation run produces a structured report.

**Fields**
- `report_id`
- `client_id`
- `subject_type`: plan_node | asset | variant | publish_run | thread | engagement_event
- `subject_id`
- `stage`: preflight | postflight
- `checks` (array)
- `score_total` (0–100)
- `decision`: pass | retry | escalate | fail
- `fix_list` (array)
- `evidence_uris` (array)
- `created_by` (agent)
- `created_at`

### 1.2 CheckResult
Each check is atomic and explainable.

**Fields**
- `check_id`
- `name`
- `category`: schema | compliance | platform | brand | conversion | safety | execution
- `status`: pass | warn | fail
- `weight` (0–1)
- `message` (human readable)
- `required_fix` (optional)
- `evidence_uri` (optional)

---

## 2) Where evaluation happens (MVP)

### 2.1 Planning Lane
Subjects:
- Plan
- PlanNodes

Evaluation points:
- after plan generation
- before schedule generation

### 2.2 Creation Lane
Subjects:
- copy packs
- prompts
- media assets

Evaluation points:
- after copy generation
- after prompt generation
- after media generation (technical QA)

### 2.3 Publishing Lane
Subjects:
- PublishPackage
- PublishRun

Evaluation points:
- preflight: before publish
- postflight: verify publish correctness

### 2.4 Engagement Lane
Subjects:
- draft replies
- outbound DMs
- moderation actions

Evaluation points:
- preflight: policy + tone
- postflight: log + summarize thread

---

## 3) Evaluation categories & checklists

Each subject type has a standard checklist.

### 3.1 PlanNode evaluation checklist
**Schema checks (deterministic)**
- required fields exist for node_type
- blueprint is enabled
- constraints snapshot exists or is referenced

**Strategy checks (model + deterministic)**
- goal alignment (objective tags match plan)
- platform fit (blueprint appropriate)
- cadence sanity (rate limits)
- novelty (avoid duplicates)

**Scoring**
- schema: 30%
- strategy: 50%
- novelty/variety: 20%

**Fail examples**
- blueprint disabled → fail
- schedule exceeds rate limit → retry with fix

---

### 3.2 Copy/Caption evaluation checklist
**Deterministic**
- length bounds for platform
- CTA type matches policy
- disclaimers present (if required)
- prohibited claims absent

**Model-based**
- voice match
- clarity
- persuasion strength
- appropriateness

**Conversion heuristics (high signal)**
- strong hook (first line)
- clear benefit
- single primary CTA
- proof element when available

**Decision rules**
- if compliance fail → escalate or retry
- if voice mismatch → retry

---

### 3.3 Prompt evaluation checklist (image/video)
**Deterministic**
- includes required format keys (ratio, duration)
- includes safety constraints (“silent video, no audio” etc.)
- avoids banned terms/providers flags

**Model-based**
- visual clarity
- brand style tokens applied
- storyboard continuity

**Decision rules**
- if provider safety likely → retry with prompt lint

---

### 3.4 Media asset technical QA checklist
**Deterministic**
- file exists
- correct codec/container
- correct resolution
- duration within tolerance
- no audio track if silent-first required

**Visual QA (model-assisted)**
- legibility of text overlays
- no obvious artifacts
- matches requested style

**Decision rules**
- technical mismatch → retry generation
- visual mismatch → retry prompt or escalate to human creative

---

### 3.5 Publish preflight checklist
**Deterministic**
- ApprovalRecord status = approved if required
- platform lane exists and is available
- media constraints satisfy platform
- schedule time valid

**Safety**
- PolicyGuard allow
- rate limits within budget

**Decision rules**
- missing approval → stop + request human
- policy deny → stop

---

### 3.6 Publish postflight verification checklist
**Deterministic**
- publish_run status success
- post URL or proof screenshot exists
- caption matches expected (hash or diff)
- media matches checksum

**Decision rules**
- mismatch → retry verification, then escalate

---

### 3.7 Engagement reply evaluation checklist
**Deterministic**
- no prohibited content
- respects escalation triggers
- respects safe tone guidelines

**Model-based**
- helpfulness
- de-escalation
- brand voice

**Decision rules**
- low confidence or conflict → escalate

---

## 4) Loop design: self-critique and iteration

### 4.1 The “Critique → Fix → Re-evaluate” loop
For any subject, the loop is:
1) Generate output
2) Run EvaluationReport
3) If decision=retry:
   - create FixList
   - rerun correct agent with fix payload
   - re-evaluate

### 4.2 FixList must be deterministic
A FixList item includes:
- which field changed
- exact instruction
- acceptance criteria

Example FixList item:
- “Add required disclaimer line: ‘Results vary; terms apply.’ to caption tail.”

### 4.3 Maximum iteration policy
- default: 2 retries per subject
- if still failing → escalate

---

## 5) Human intervention points (designed, not accidental)

Humans intervene when:
- compliance redlines triggered
- 2FA/captcha/auth needed
- ambiguity around pricing/refund/complaint
- repeated failures beyond retry caps

### 5.1 Human review UI requirements (MVP)
- show asset preview
- show evaluation report
- show fix suggestions
- approve/reject with notes

### 5.2 Assist mode for browser lane
- pause runner
- operator completes step
- runner resumes
- audit log captured

---

## 6) Termination rules (when to stop recursing)

A loop terminates when:
1) **Pass** and downstream actions complete
2) **Fail** and Policy denies
3) **Escalate** (handoff)
4) **Budget exceeded** (cost/latency)

---

## 7) Post-MVP extensions

### 7.1 Performance feedback loop
- ingest metrics
- attribute to assets/blueprints
- update EpisodicMemory: “what worked”

### 7.2 Evaluator ensemble
Multiple evaluators can vote:
- deterministic validator
- brand voice model
- conversion model
- compliance model

Supervisor aggregates into final decision.

### 7.3 Continuous regression tests
Run weekly “UI contract tests” for browser lane and alert when broken.

---

## 8) MVP Acceptance Criteria

Evaluation system is MVP-ready when:
- every publish and engagement side effect has a preflight and postflight report
- fixlists are deterministic
- recursion caps are enforced
- human intervention is triggered predictably

---

## 9) Next Document
**Cost & Latency Budgets — v1** (token budgets per episode, retries per node, escalation thresholds).

