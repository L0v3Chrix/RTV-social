# DOCS_INDEX.md — Vibecoding Pre-Build Knowledge Base (v1)

## Why this file exists

This repository is being built **instruction-first**.

We pre-wrote the critical architectural specs, safety policies, testing discipline, and operational runbooks **before implementation** so that:

- CLI agents can execute in small, verifiable PR slices (no drift)
- Side effects (posting/DM/engagement) stay safe behind policy + flags
- Every change is testable, observable, and rollbackable
- Multi-tenant isolation stays correct as you scale clients

**Next step:** hand the entire `/docs/` folder (including this index + the “Remaining Docs” list) to your build/orchestrator agent **along with your PRD/PDR prompt**. The agent should:

1) read this index end-to-end
2) load the governing specs first (System Architecture + Onboarding + Tool Registry + Browser Lane)
3) output a **PDR** plus **sprint-ordered agent prompts**, splitting work into:
   - tasks that can be done in parallel
   - tasks that must be sequenced due to dependencies

> The PDR is expected to include: milestones, acceptance criteria, integration points, test plan per slice, telemetry/events, and rollback steps.

---

## How to read this index

- **Governing specs** define the system contract and should be treated like “public API.”
- **Policies & runbooks** define what’s allowed and how to operate safely.
- **RLM/agent docs** define the autonomy boundaries, recursion, evaluation loops, and budgets.
- **Engineering docs** define how PRs are produced, tested, released, and rolled back.

---

## 0) Repository “table of contents”

> **Format:** Title → What it governs (why it exists) → Where it should live

### A) Governing product specs (build these first)

1) **Executive Summary + Project Scope + Creative Blueprints Library (v3)**
- Governs: product intent, workflows (Plan→Create→Publish→Engage), supported platforms, blueprint catalog, BYOK, lanes.
- Location: `/docs/specs/executive_summary_project_scope.md`

2) **System Architecture Diagram + Data Model (v3)**
- Governs: services, boundaries, queues, stores, BYOK routing, lanes, job lifecycle, canonical entities.
- Location: `/docs/specs/system_architecture_data_model.md`

3) **Onboarding Spec — Brand Kit + Knowledge Base Schema (v1)**
- Governs: client intake contract, BrandKit schema, KB schema, platform lane selection, BYOK keyring + provider routing.
- Location: `/docs/specs/onboarding_brandkit_kb_schema.md`

4) **Agent Tool Registry Spec — Tools + MCPs (v1)**
- Governs: tool inventory, tool permissions, tool naming, discovery rules, side-effect gating, Docker MCP aggregation strategy.
- Location: `/docs/specs/agent_tool_registry.md`

5) **Browser Automation Design — Profile Vault + Runner (v1)**
- Governs: browser lane architecture, profile vault, runner, proof capture, drift handling, sandbox-first.
- Location: `/docs/specs/browser_automation_profile_vault_runner.md`

---

### B) RLM core + agentic autonomy (MVP safety backbone)

6) **External Memory Schema (RLM core) — v1**
- Governs: plan graph, asset graph, conversation summaries, engagement events, pointer-first storage.
- Location: `/docs/rlm/external_memory_schema.md`

7) **Agent Recursion Contracts — v1**
- Governs: what each agent can read/write, recursion triggers, stop conditions, escalation.
- Location: `/docs/rlm/agent_recursion_contracts.md`

8) **Evaluation Loops — v1**
- Governs: self-critique gates, human intervention points, regression evals, “when to stop.”
- Location: `/docs/rlm/evaluation_loops.md`

9) **Cost & Latency Budgets — v1**
- Governs: max tokens/episode, retries/node, timeouts, circuit breakers, cost ceilings per tenant.
- Location: `/docs/rlm/cost_latency_budgets.md`

10) **RLM → Agent Prompt Architecture — v1**
- Governs: mapping RLM loop into agent prompts, episode structure, memory reads/writes, tool calling patterns.
- Location: `/docs/rlm/rlm_to_agent_prompt_architecture.md`

11) **Full Recursive System Diagram (Conceptual) — v1**
- Governs: end-to-end agent recursion topology, decision points, storage & verification flows.
- Location: `/docs/rlm/full_recursive_system_diagram.md`

12) **RLM Integration Spec (from diagram/article) — v1**
- Governs: how RLM logic is “baked in” across planner/creator/publisher/engager loops.
- Location: `/docs/rlm/rlm_integration_spec.md`

---

### C) Automation playbooks + operating strategy

13) **Platform Algorithm Alignment Playbooks — v1**
- Governs: per-platform posting/format best practices and how blueprints align to native distribution.
- Location: `/docs/playbooks/platform_algorithm_alignment.md`

14) **Experimentation OS — v1**
- Governs: how we run controlled creative experiments, rotate hooks/angles, and avoid random “spray and pray.”
- Location: `/docs/playbooks/experimentation_os.md`

15) **Observability & Check-In Dashboard Spec — v1**
- Governs: operator dashboard, daily health checks, job status, drift, queue latency, failures, proofs.
- Location: `/docs/ops/observability_dashboard_spec.md`

16) **Adaptive Learning & Future Metrics Roadmap — v1**
- Governs: V2 learning for system functionality + roadmap for campaign metrics/attribution and outcome tracking.
- Location: `/docs/roadmap/adaptive_learning_future_metrics.md`

---

### D) Compliance, safety, and governance (non-negotiable)

17) **Compliance & Automation Policy Binder — v1**
- Governs: autonomy boundaries, approval rules, prohibited behaviors, escalation paths, platform constraints.
- Location: `/docs/policy/compliance_automation_policy_binder.md`

18) **Platform Side-Effect Safety Spec — v1**
- Governs: safe execution of likes/comments/DMs/posts, idempotency, dedupe, proof, kill-switches.
- Location: `/docs/policy/platform_side_effect_safety.md`

19) **Degraded Mode + Fallback Policy — v1**
- Governs: what happens when APIs fail, browser lane fails, quotas hit, or drift occurs.
- Location: `/docs/policy/degraded_mode_fallback.md`

20) **Data Retention & Privacy Policy — v1**
- Governs: retention windows, deletion, audit/event log handling, user data minimization.
- Location: `/docs/policy/data_retention_privacy.md`

21) **Secrets & Key Management Runbook — v1**
- Governs: BYOK handling, secret_ref patterns, rotation, breach response, least privilege.
- Location: `/docs/security/secrets_key_management_runbook.md`

22) **RBAC & Operator Permissioning Spec — v1**
- Governs: operator roles, permission boundaries, approval actions, dangerous operations gating.
- Location: `/docs/security/rbac_operator_permissioning.md`

23) **Multi-Tenant Isolation & Data Boundary Spec — v1**
- Governs: tenancy boundaries, isolation rules, cross-tenant access prevention, audit.
- Location: `/docs/security/multitenant_isolation_data_boundaries.md`

24) **Threat Model + Data Flow Diagrams — v1**
- Governs: threats, trust boundaries, attack surfaces (tools, runner, browser vault), mitigations.
- Location: `/docs/security/threat_model_data_flows.md`

25) **Security Verification Plan — v1 (ASVS-mapped)**
- Governs: security testing checklist aligned to ASVS-style controls.
- Location: `/docs/security/security_verification_plan_asvs.md`

---

### E) Engineering execution (ship without breaking prod)

26) **Engineering Handbook — v1**
- Governs: build culture, PR slice discipline, testing philosophy, vibecoding roles.
- Location: `/docs/engineering/engineering_handbook.md`

27) **Definition of Done + PR Checklist — v1**
- Governs: merge requirements, evidence required, review discipline.
- Location: `/docs/engineering/definition_of_done_pr_checklist.md`

28) **Testing Strategy + Golden Path Matrix — v1**
- Governs: unit/integration/contract/E2E plan and the golden paths that must never break.
- Location: `/docs/engineering/testing_strategy_golden_path_matrix.md`

29) **CI/CD Spec + Required Checks — v1**
- Governs: required pipelines, gates, artifact retention, staged deploy rules.
- Location: `/docs/engineering/ci_cd_required_checks.md`

30) **SLO + Error Budget Policy — v1**
- Governs: reliability targets and what happens when error budget burns.
- Location: `/docs/ops/slo_error_budget_policy.md`

31) **Incident Runbooks + Postmortem Template — v1**
- Governs: incident response, comms, severity, timeline, corrective action tracking.
- Location: `/docs/ops/incident_runbooks_postmortems.md`

32) **Release & Rollback Playbook + CHANGELOG Policy — v1**
- Governs: release levels, canaries, flags, rollback, changelog discipline.
- Location: `/docs/ops/release_rollback_changelog_policy.md`

33) **Dependency & Supply Chain Policy — v1**
- Governs: dependency pinning, update cadence, SBOM expectations, review rules.
- Location: `/docs/engineering/dependency_supply_chain_policy.md`

34) **Config & Feature Flag Governance — v1**
- Governs: config tiers, flag taxonomy, ownership, rollout procedures, audit trail.
- Location: `/docs/engineering/config_feature_flag_governance.md`

35) **ADR Index + Templates — v1**
- Governs: how decisions are recorded and discoverable.
- Location: `/docs/adr/ADR_INDEX.md` and `/docs/adr/templates/`

---

### F) Sandbox + test operations

36) **Tenancy-Aware E2E Test Harness (Sandbox Accounts) — v1**
- Governs: sandbox accounts strategy + E2E harness patterns for isolating tenant actions.
- Location: `/docs/testing/tenancy_aware_e2e_harness.md`

37) **Sandbox Account Ops Runbook (Creation, Rotation, Recovery) — v1**
- Governs: how sandbox accounts are created, rotated, recovered, and safely stored.
- Location: `/docs/ops/sandbox_account_ops_runbook.md`

---

### G) Handoff + meta docs

38) **Repository Documentation Index + Vibecoding Build Handoff (v1)**
- Governs: how to hand the repo to agents, how to sprint and parallelize, how to orchestrate.
- Location: `/docs/HANDOFF.md`

39) **Remaining Documentation Recommendations — Master Index (v1)**
- Governs: what else to write if needed; gaps list.
- Location: `/docs/remaining_docs_recommendations.md`

40) **Accounts You Need for Development — Master Checklist (v1)**
- Governs: all external accounts required to build/run/test.
- Location: `/docs/ops/accounts_master_checklist.md`

---

## 1) Notes on doc standards used

- For release notes and changelog format, this repo aligns to **Keep a Changelog** categories and **SemVer** versioning guidance. ([keepachangelog.com](https://keepachangelog.com/en/1.1.0/?utm_source=chatgpt.com))
- For feature flag governance, the repo is compatible with OpenFeature-style vendor-neutral concepts (even if you use an internal flag service). ([openfeature.dev](https://openfeature.dev/specification/?utm_source=chatgpt.com))
- For Custom GPT knowledge usage, keep files single-column/simple formatting and use this index as the “router” doc for the GPT. ([help.openai.com](https://help.openai.com/en/articles/8843948-knowledge-in-gpts?utm_source=chatgpt.com))

---

## 2) TODO (operator)

- Confirm canonical filenames/paths in the repo (match the list above).
- Mark the latest versions explicitly (v1/v2/v3) if multiple exist.
- Add a `/docs/journal/` entry whenever architecture changes (append-only).

---

## 3) How the build agent should use this file

When executing the PRD/PDR prompt:

1) Read **A) Governing product specs** first.
2) Use **B) RLM core** to enforce bounded autonomy and safe recursion.
3) Use **D) Policy/Governance** before implementing any side effects.
4) Convert the system into sprints and parallel workstreams:
   - **Parallelizable:** UI/admin, schemas, tool adapters, test harness, docs
   - **Sequenced:** data model → onboarding → planner loop → creation loop → scheduler → publishing lane → engagement lane
5) Emit agent prompts that are:
   - PR-sized
   - test-first
   - telemetry-first
   - rollbackable
