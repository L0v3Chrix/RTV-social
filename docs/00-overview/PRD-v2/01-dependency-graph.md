# Task Dependency Graph

This document visualizes all **129 task dependencies** across 6 sprints.

> **Updated**: Added 8 new tasks from Tesla Mixed-Precision Pattern Enhancements (ADR-0001)

---

## Legend

```
─────► Sequential dependency (must complete first)
═════► Cross-agent dependency
╌╌╌╌► Cross-sprint dependency (implicit)
🆕    New task from ADR-0001 enhancements
```

---

## Sprint 0: Foundation (20 tasks)

### Agent A: Repository & Core Packages

```
S0-A1 (Monorepo Scaffold)
   │
   ├──► S0-A2 (TypeScript Config)
   │
   ├──► S0-A3 (Core Packages)
   │       │
   │       └──► S0-D1 (OTEL needs @rtv/core)
   │
   ├──► S0-A4 (ESLint + Prettier)
   │
   └──► S0-A5 (Shared tsconfig)
```

### Agent B: Database Schema

```
S0-B1 (Postgres Connection)
   │
   ├──► S0-B2 (Core Schema)
   │       │
   │       ├──► S0-B3 (Multi-tenant Schema)
   │       │
   │       └──► S0-B4 (Audit Event Schema)
   │               │
   │               └──► S0-B5 (Seed Data)
   │
   └══════════════════════════════════════► S1-A1 (Domain Models need DB)
```

### Agent C: CI/CD Pipeline

```
S0-C1 (GitHub Actions)
   │
   ├──► S0-C2 (Required Checks)
   │
   ├──► S0-C3 (Branch Protection)
   │
   ├──► S0-C4 (Preview Deployments)
   │
   └──► S0-C5 (Environment Variables)
```

### Agent D: Observability

```
S0-A3 ═══► S0-D1 (OTEL Instrumentation)
              │
              ├──► S0-D2 (Structured Logging)
              │       │
              │       └──► S0-D3 (Audit Event Framework)
              │               │
              │               └──► S0-D4 (Error Tracking)
              │
              └──► S0-D5 (Metrics Collection)
```

### Sprint 0 Cross-Agent Dependencies

```
S0-A1 ═══► S0-B1 (Database needs repo)
S0-A1 ═══► S0-C1 (CI needs repo)
S0-A1 ═══► S0-D1 (OTEL needs repo)
S0-A3 ═══► S0-D1 (OTEL goes in @rtv/core)
S0-B4 ═══► S0-D3 (Audit framework uses schema)
```

---

## Sprint 1: Core Infrastructure (23 tasks) 🆕 +3

**Prerequisite:** Sprint 0 complete

### Agent A: Domain Models

```
S1-A1 (Client Entity)
   │
   ├──► S1-A2 (BrandKit Entity)
   │
   ├──► S1-A3 (KnowledgeBase Entity)
   │
   ├──► S1-A4 (Offer Entity)
   │
   └──► S1-A5 (Domain Event Emission)
            │
            └══════════════════════════════► S1-B1 (Memory needs events)
```

### Agent B: External Memory Layer (Extended)

```
S1-A1 ═══► S1-B1 (RLMEnv Interface)
              │
              ├──► S1-B2 (Summary Storage)
              │
              ├──► S1-B3 (Reference System)
              │       │
              │       └──► S1-B6 🆕 (Memory Priority Schema)
              │               │
              │               └──► S1-B7 🆕 (Priority-Based Eviction)
              │                       │
              │                       └──► S1-B8 🆕 (Pinned Context Manager)
              │
              ├──► S1-B4 (Context Window Management)
              │
              └──► S1-B5 (Memory Retrieval API)
```

### Agent C: Policy Engine

```
S1-C1 (Policy Definition Schema)
   │
   ├──► S1-C2 (Approval Gate Framework)
   │
   ├──► S1-C3 (Kill Switch Infrastructure)
   │
   ├──► S1-C4 (Rate Limiting Policies)
   │
   └──► S1-C5 (Policy Evaluation Engine)
            │
            └══════════════════════════════► S1-D3 (Runner uses policy)
```

### Agent D: Runner Skeleton

```
S1-B1 ═══► S1-D1 (Episode Model)
              │
              ├──► S1-D2 (Budget Enforcement)
              │
S1-C5 ═══════╪══► S1-D3 (Tool Execution Wrapper)
              │
              ├──► S1-D4 (Runner State Machine)
              │
              └──► S1-D5 (Checkpoint System)
```

### 🆕 Memory Priority System (ADR-0001 Enhancement 1)

```
S1-B3 ──► S1-B6 (Memory Priority Schema)
              │
              └──► S1-B7 (Priority-Based Eviction Engine)
                      │
                      └──► S1-B8 (Pinned Context Manager)
                              │
                              └══════════════════► S2-A6 (Context Registry)
```

---

## Sprint 2: Planning + Creation (22 tasks) 🆕 +2

**Prerequisite:** Sprint 1 complete

### Agent A: Plan Graph System (Extended)

```
S2-A1 (PlanGraph Model)
   │
   ├──► S2-A2 (Plan Node Types)
   │
   ├──► S2-A3 (Plan API Endpoints)
   │
   ├──► S2-A4 (Plan Versioning)
   │
   ├──► S2-A5 (Plan Visualization)
   │
   └──► S2-A6 🆕 (Task Context Registry)
            │
            └──► S2-A7 🆕 (Sparse Context Loader)
                    │
                    └══════════════════► S3-B7 (Model Tier Config)
```

### Agent B: Blueprint Definitions

```
S2-B1 (Blueprint Schema)
   │
   ├──► S2-B2 (Blueprint Versioning)
   │
   ├──► S2-B3 (Blueprint Registry)
   │
   ├──► S2-B4 (MVP Blueprints 1-6)
   │
   └──► S2-B5 (MVP Blueprints 7-12)
```

### Agent C: Copy Generation Agent

```
S2-C1 (Copy Agent Prompt System)
   │
   ├──► S2-C2 (Caption Generation)
   │
   ├──► S2-C3 (CTA Generation)
   │
   ├──► S2-C4 (Hook Generation)
   │
   └──► S2-C5 (Copy QA Scoring)
```

### Agent D: Media Generation

```
S2-D1 (Image Prompt Generation)
   │
   ├──► S2-D2 (Image Generation Lane)
   │
   ├──► S2-D3 (Silent Video Generation)
   │
   ├──► S2-D4 (Thumbnail Generation)
   │
   └──► S2-D5 (Media QA System)
```

### 🆕 Task-Aware Context Filtering (ADR-0001 Enhancement 2)

```
S2-A1 ═══► S2-A6 (Task Context Registry)
S1-B8 ═══►    │
              └──► S2-A7 (Sparse Context Loader)
                      │
                      └══════════════════► S3-B7 (Model Tier Config)
```

---

## Sprint 3: Scheduling + Publishing (24 tasks) 🆕 +3

**Prerequisite:** Sprint 2 complete

### Agent A: Calendar System

```
S3-A1 (Calendar Model)
   │
   ├──► S3-A2 (Scheduling API)
   │
   ├──► S3-A3 (Delayed Execution)
   │
   ├──► S3-A4 (Conflict Detection)
   │
   └──► S3-A5 (Calendar Visualization)
```

### Agent B: API Lane Connectors + Model Routing (Extended)

```
S3-B1 (Meta Facebook Connector)
   │
S3-B2 (Meta Instagram Connector)
   │
S3-B3 (TikTok Connector)
   │
S3-B4 (YouTube Connector)
   │
S3-B5 (LinkedIn Connector)
   │
S3-B6 (X/Twitter Connector)
   │
S3-B1 ═══► S3-B7 🆕 (Model Tier Configuration)
S2-A7 ═══►    │
              └──► S3-B8 🆕 (Complexity Assessor)
                      │
                      └──► S3-B9 🆕 (Adaptive Model Router)
```

Note: B1-B6 can run in parallel (no internal dependencies)

### Agent C: Browser Lane Runner

```
S3-C1 (Profile Vault System)
   │
   ├──► S3-C2 (Session Isolation)
   │
   ├──► S3-C3 (Skool Automation)
   │
   ├──► S3-C4 (Story Posting Fallback)
   │
   └──► S3-C5 (Artifact Capture)
```

### Agent D: Publish Verification

```
S3-D1 (Post Verification API)
   │
   ├──► S3-D2 (Proof Capture System)
   │
   ├──► S3-D3 (Retry Logic)
   │
   ├──► S3-D4 (Failure Classification)
   │
   └──► S3-D5 (Rollback Capability)
```

### 🆕 Model Tier Routing (ADR-0001 Enhancement 3)

```
S3-B1 ═══► S3-B7 (Model Tier Configuration)
S2-A7 ═══►    │
              └──► S3-B8 (Complexity Assessor)
S2-A6 ═══════════►    │
                      └──► S3-B9 (Adaptive Model Router)
```

---

## Sprint 4: Engagement (20 tasks)

**Prerequisite:** Sprint 3 complete

### Agent A: Event Ingestion

```
S4-A1 (Webhook Receiver)
   │
   ├──► S4-A2 (Polling System)
   │
   ├──► S4-A3 (Event Normalization)
   │
   ├──► S4-A4 (Deduplication)
   │
   └──► S4-A5 (Event Routing)
```

### Agent B: Conversation Thread Model

```
S4-B1 (Thread Entity Model)
   │
   ├──► S4-B2 (ThreadSummary System)
   │
   ├──► S4-B3 (Participant Tracking)
   │
   ├──► S4-B4 (Thread State Machine)
   │
   └──► S4-B5 (Thread Retrieval API)
```

### Agent C: Reply Drafting Agent

```
S4-C1 (Reply Agent Prompt System)
   │
   ├──► S4-C2 (Safe Response Generation)
   │
   ├──► S4-C3 (Auto-Like with Throttling)
   │
   ├──► S4-C4 (Comment Reply Drafts)
   │
   └──► S4-C5 (DM Reply Drafts)
```

### Agent D: Escalation System

```
S4-D1 (Escalation Triggers)
   │
   ├──► S4-D2 (Human Handoff Workflow)
   │
   ├──► S4-D3 (Escalation Queue)
   │
   ├──► S4-D4 (Resolution Tracking)
   │
   └──► S4-D5 (Escalation Metrics)
```

---

## Sprint 5: Gated Rollout (20 tasks)

**Prerequisite:** Sprint 4 complete

### Agent A: House Account Testing

```
S5-A1 (House Account Setup)
   │
   ├──► S5-A2 (Sandbox Mode Config)
   │
   ├──► S5-A3 (E2E Test Suite)
   │
   ├──► S5-A4 (Performance Benchmarking)
   │
   └──► S5-A5 (Error Scenario Testing)
```

### Agent B: Canary Configuration

```
S5-B1 (Canary Client Selection)
   │
   ├──► S5-B2 (Feature Flag Setup)
   │
   ├──► S5-B3 (Gradual Rollout Plan)
   │
   ├──► S5-B4 (Rollback Triggers)
   │
   └──► S5-B5 (Client Communication)
```

### Agent C: Kill Switch Implementation

```
S5-C1 (Global Kill Switch)
   │
   ├──► S5-C2 (Per-Client Kill Switch)
   │
   ├──► S5-C3 (Per-Platform Kill Switch)
   │
   ├──► S5-C4 (Per-Action Kill Switch)
   │
   └──► S5-C5 (Kill Switch Dashboard)
```

### Agent D: Full E2E Test Suite

```
S5-D1 (Planning E2E Tests)
   │
   ├──► S5-D2 (Creation E2E Tests)
   │
   ├──► S5-D3 (Publishing E2E Tests)
   │
   ├──► S5-D4 (Engagement E2E Tests)
   │
   └──► S5-D5 (Multi-Tenant E2E Tests)
```

---

## 🆕 ADR-0001 Enhancement Summary

| Enhancement | Tasks | Sprint | Dependencies |
|-------------|-------|--------|--------------|
| **Memory Priority System** | S1-B6, S1-B7, S1-B8 | Sprint 1 | S1-B3 |
| **Task-Aware Context Filtering** | S2-A6, S2-A7 | Sprint 2 | S2-A1, S1-B8 |
| **Model Tier Routing** | S3-B7, S3-B8, S3-B9 | Sprint 3 | S3-B1, S2-A7, S2-A6 |

### Enhancement Dependency Chain

```
S1-B3 (Reference System)
   │
   └──► S1-B6 (Memory Priority Schema) 🆕
           │
           └──► S1-B7 (Priority-Based Eviction) 🆕
                   │
                   └──► S1-B8 (Pinned Context Manager) 🆕
                           │
                           └══════════════════════════════════►
                                                               │
S2-A1 (PlanGraph Model)                                        │
   │                                                           │
   └──► S2-A6 (Task Context Registry) 🆕 ◄═════════════════════┘
           │
           └──► S2-A7 (Sparse Context Loader) 🆕
                   │
                   └══════════════════════════════════►
                                                       │
S3-B1 (Meta Facebook Connector)                        │
   │                                                   │
   └──► S3-B7 (Model Tier Config) 🆕 ◄═════════════════┘
           │
           └──► S3-B8 (Complexity Assessor) 🆕
                   │
                   └──► S3-B9 (Adaptive Model Router) 🆕
```

---

## Critical Path (Updated)

The longest dependency chain determines minimum completion time:

```
S0-A1 → S0-A3 → S0-D1 → S0-D3 → S0-D4
                           ↓
                   Sprint 0 Complete
                           ↓
S1-A1 → S1-B1 → S1-B3 → S1-B6 🆕 → S1-B7 🆕 → S1-B8 🆕
                           ↓
                   Sprint 1 Complete
                           ↓
S2-A1 → S2-A6 🆕 → S2-A7 🆕 → S2-B1 → S2-B3 → S2-B5
                           ↓
                   Sprint 2 Complete
                           ↓
S3-B1 → S3-B7 🆕 → S3-B8 🆕 → S3-B9 🆕 → S3-D1 → S3-D5
                           ↓
                   Sprint 3 Complete
                           ↓
S4-A1 → S4-B1 → S4-C1 → S4-D1 → S4-D5
                           ↓
                   Sprint 4 Complete
                           ↓
S5-A1 → S5-A3 → S5-C1 → S5-D1 → S5-D5
                           ↓
                   Sprint 5 Complete
```

**Critical path length:** ~38 sequential tasks out of 129 total (+8 from enhancements)

**Parallelization opportunity:** ~70% of tasks can run in parallel with proper orchestration

---

## Dependency Matrix (JSON) — Updated

```json
{
  "sprint_1_additions": {
    "S1-B6": { "deps": ["S1-B3"], "blocks": ["S1-B7", "S1-B8"] },
    "S1-B7": { "deps": ["S1-B6"], "blocks": ["S1-B8"] },
    "S1-B8": { "deps": ["S1-B6", "S1-B7"], "blocks": ["S2-A6"] }
  },
  "sprint_2_additions": {
    "S2-A6": { "deps": ["S2-A1", "S1-B8"], "blocks": ["S2-A7"] },
    "S2-A7": { "deps": ["S2-A6", "S1-B5"], "blocks": ["S3-B7"] }
  },
  "sprint_3_additions": {
    "S3-B7": { "deps": ["S3-B1", "S2-A7"], "blocks": ["S3-B8", "S3-B9"] },
    "S3-B8": { "deps": ["S3-B7", "S2-A6"], "blocks": ["S3-B9"] },
    "S3-B9": { "deps": ["S3-B7", "S3-B8"], "blocks": [] }
  }
}
```

Full dependency matrix for all sprints available in machine-readable format upon request.

---

## Task Count Summary

| Sprint | Original | Added | New Total |
|--------|----------|-------|-----------|
| Sprint 0 | 20 | 0 | 20 |
| Sprint 1 | 20 | 3 | 23 |
| Sprint 2 | 20 | 2 | 22 |
| Sprint 3 | 21 | 3 | 24 |
| Sprint 4 | 20 | 0 | 20 |
| Sprint 5 | 20 | 0 | 20 |
| **Total** | **121** | **8** | **129** |
