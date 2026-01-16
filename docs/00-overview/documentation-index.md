# Repository Documentation Index + Vibecoding Build Handoff — v1

## Why we did this (process overview)

This is a **vibecoding project**.

Before writing production code, we created an **instruction-first knowledge base**: architecture, schemas, safety constraints, ops runbooks, and engineering governance—so that multiple CLI agents (and humans) can build in parallel without breaking safety, quality, or tenant boundaries.

**The intent:**

1) **Reduce ambiguity** → agents don’t guess; they follow contracts.
2) **Reduce rework** → specs define the “golden paths” and tests up front.
3) **Reduce risk** → side-effect guardrails, policy binders, kill switches, and verification rules are defined before automation touches real accounts.
4) **Increase parallelism** → work can be split across agents safely (UI, runner, tool gateway, schemas, tests, browser lane, platform connectors).

### How we build from here

**Next step:** Put these docs into the repository `/docs/` and give your build agent access to the folder. Then run your PRD generator process using the prompt structure you referenced:

- PRD Prompt Structure: https://gist.github.com/grandamenium/b26416a17a6824463061fe46ccf80a49#file-generate-agent-prd-md

### How the PRD should be produced (important)

When generating the PDR/PRD:

1) **Generate the PRD as specified**, but also:
2) **Decompose the PRD into ordered sprints**:
   - Sprint 0: repo scaffold + CI + env + basic schemas
   - Sprint 1: core domains + external memory + policy engine + runner skeleton
   - Sprint 2: planning + creation loops (no side effects)
   - Sprint 3: scheduling + publish dry-run + verification
   - Sprint 4: engagement ingestion + safe reply drafting + escalation
   - Sprint 5: side effects gated rollout (house accounts → canary clients)
3) For each sprint, split tasks into:
   - **Parallelizable work** (multiple agents can run simultaneously)
   - **Blocked work** (requires prerequisites)
4) Every sprint outputs:
   - code + tests + telemetry + docs append + ADR entries

### Required pre-PRD closure

The PRD generation phase should also include a checklist to ensure:

- Remaining documentation (from “Remaining Documentation Recommendations — Master Index”) is completed **before** final PRD sign-off.
- Any missing “spec glue” docs (integration contracts, idempotency rules, reconciliation jobs) are written.

---

## Index of generated documentation (complete list from this build session)

> Notes:
> - Items marked **(uploaded file)** exist as files provided in this conversation.
> - Items marked **(canvas doc)** were generated as standalone spec artifacts.
> - If you’re assembling the repo, map each doc to a stable filename under `/docs/`.

---

### 1) Executive + product scope

1. **Executive Summary + Project Scope + Creative Blueprints Library — v3** (uploaded file)
   - The north star: outcomes, platform coverage, lanes (API/browser), autonomy stages (plan/create/publish/engage), BYOK, and a curated library of high-value content workflows.

2. **Agency Social Media Automation Platform — Architecture & Plan** (uploaded PDF)
   - Consolidated narrative plan + architecture notes for onboarding, automation lanes, and MVP strategy.

3. **Remaining Documentation Recommendations — Master Index (v1)** (canvas doc)
   - A gap-focused list of additional docs that increase build and ops success (platform contracts, idempotency, reconciliation, prompt regression harness, etc.).

---

### 2) System architecture + schemas

4. **System Architecture Diagram + Data Model — v3 (MVP Blueprints, BYOK, Browser Lane)** (uploaded file)
   - Canonical system components and the initial data model for multi-tenant planning, assets, scheduling, publishing, engagement, and proof/audit.

5. **Onboarding Spec — Brand Kit + Knowledge Base Schema** (uploaded file + edited canvas)
   - The authoritative onboarding contract: brand kit, KB ingestion, BYOK keyring/provider routing, platform lane preferences, and autonomy policy hooks.

6. **External Memory Schema (RLM core) — v1** (canvas doc)
   - External memory model for plan graph, asset graph, conversation summaries, engagement events, and retrieval pointers.

---

### 3) Tooling + agent runtime

7. **Agent Tool Registry Spec (Tools + MCPs) — v1** (uploaded file)
   - Registry for tools, MCP gateway patterns, permissions, tool discovery strategy, and tool call logging.

8. **Browser Automation Design — Profile Vault + Runner — v1** (uploaded file)
   - Browser lane architecture: profile vault, runner, drift detection, proof capture, safe execution constraints.

9. **RLM → Agent Prompt Architecture — v1** (canvas doc)
   - How RLM-style recursion maps to orchestrator/subagents, episode budgets, tool gating, and pointer-first context strategy.

10. **Agent Recursion Contracts — v1** (canvas doc)
   - The hard rules: what agents can read/write, what triggers recursion, stop conditions, and side-effect recursion constraints.

11. **Full Recursive System Diagram (Conceptual) — v1** (canvas doc)
   - Conceptual end-to-end diagram: external memory, runner, tool gateway, approval gates, verification loops, and side-effect lanes.

---

### 4) Governance: policy, safety, compliance

12. **Compliance & Automation Policy Binder — v1** (canvas doc)
   - Policies, approval rules, kill switches, risk tiers, escalation, and audit expectations.

13. **Platform Side-Effect Safety Spec — v1** (canvas doc)
   - Guardrails for publish/DM/comment/like flows; idempotency; verification; blast radius controls.

14. **Threat Model + Data Flow Diagrams** (canvas doc)
   - Security threat analysis + sensitive data flows across web/runner/tool gateway/browser lane.

15. **Security Verification Plan — v1 (ASVS-mapped)** (canvas doc)
   - Concrete security checks mapped to an industry verification standard; includes how to prove controls.

16. **Secrets & Key Management Runbook — v1** (canvas doc)
   - BYOK handling, secret refs, rotation, break-glass access, and audit requirements.

17. **RBAC & Operator Permissioning Spec — v1** (canvas doc)
   - Operator roles, permissions, approval levels, and side-effect authority.

18. **Multi‑Tenant Isolation & Data Boundary Spec — v1** (canvas doc)
   - Tenant isolation rules across DB, cache, queue, logs, and tool execution.

19. **Degraded Mode + Fallback Policy — v1** (canvas doc)
   - What happens when systems fail: disable side effects, degrade lanes, manual review paths.

---

### 5) Reliability + operations

20. **SLO + Error Budget Policy — v1** (canvas doc)
   - Reliability targets + what to do when burned (shipping pause rules, incident thresholds).

21. **Incident Runbooks + Postmortem Template** (canvas doc)
   - Operator response steps + blameless postmortem format.

22. **Observability & Check‑In Dashboard Spec — v1** (canvas doc)
   - The “couple times a day” operating dashboard: queue health, publish verification, auth/token status, engagement load, risk flags.

23. **Sandbox Account Ops Runbook (Creation, Rotation, Recovery) — v1** (canvas doc)
   - How to maintain safe sandbox accounts for API/browser testing and canary releases.

---

### 6) Engineering execution pack

24. **Engineering Handbook — v1** (edited canvas)
   - Build culture and execution system: small batches, proofs, tests, telemetry, doc append-only discipline.

25. **Definition of Done + PR Checklist — v1** (canvas doc)
   - Enforces quality and safety per PR.

26. **Testing Strategy + Golden Path Matrix — v1** (canvas doc)
   - Test pyramid + critical path test matrix for plan→create→schedule→publish→verify→engage.

27. **CI/CD Spec + Required Checks — v1** (canvas doc)
   - Gates for merges, deployments, and safe progressive delivery.

28. **Release & Rollback Playbook + CHANGELOG Policy — v1** (edited canvas)
   - Release levels, canaries, feature flags, rollback paths, and changelog discipline.

29. **Dependency & Supply Chain Policy — v1** (canvas doc)
   - Dependency controls, provenance expectations, and safe update practice.

30. **Config & Feature Flag Governance — v1** (canvas doc)
   - Flag naming, scope, evaluation context, approval workflow, and expiry/cleanup rules.

31. **ADR Index + Templates — v1** (canvas doc)
   - Architecture decision discipline: why we chose things, when we change them.

---

### 7) Growth systems + experimentation (MVP+)

32. **Experimentation OS — v1** (canvas doc)
   - Experiment tagging, cadence, change isolation, and outcome recording.

33. **Platform Algorithm Alignment Playbooks** (canvas doc)
   - Practical playbooks per platform for content formats, cadence, engagement behavior, and guardrails.

34. **Adaptive Learning & Future Metrics Roadmap** (canvas doc)
   - How the system will learn operationally (not campaign-wise) + v2 metrics/attribution planning.

---

### 8) Creative systems

35. **Creative Blueprints Library** (included within Executive Summary v3)
   - High-value content types and workflows (reels, carousels, shorts, Skool ops, comment→DM routers, VSL segment series, avatar explainers).

36. **VSL Pipeline Integration Notes (silent clip generation + stitching + voice/music layer)** (captured in scope updates)
   - Reference architecture for scripted segmentation, storyboard → prompt generation, clip generation, and editing-ready outputs.

---

## Recommended repository placement

```
/docs/
  00-overview/
  01-architecture/
  02-schemas/
  03-agents-tools/
  04-browser-lane/
  05-policy-safety/
  06-reliability-ops/
  07-engineering-process/
  08-growth-experiments/
  09-platform-playbooks/
  adr/
  runbooks/
```

---

## Next action checklist (handoff to build agents)

1) Place all docs above into `/docs/` (convert canvas docs to markdown files).
2) Ensure the repo has:
   - PR templates
   - CI checks wired
   - flags/config scaffolding
   - secret reference strategy
3) Run the PRD generator prompt using:
   - `/docs/` as the knowledge base
   - output: PRD + sprint plan + parallelization map + remaining-docs completion tasks
4) Start Sprint 0 with 2–4 agents in parallel:
   - Agent A: repo scaffold + core packages
   - Agent B: runner skeleton + episode execution
   - Agent C: tool gateway + MCP integration
   - Agent D: web UI skeleton + onboarding forms

---

## If you want one more doc generated
The final “glue” document that often helps at this moment is:

**Build Orchestration Plan — Sprint-by-Sprint Agent Task Graph (v1)**
- A single document that turns the PRD into an actionable multi-agent work graph (who does what, dependencies, merge sequence, and verification steps).

