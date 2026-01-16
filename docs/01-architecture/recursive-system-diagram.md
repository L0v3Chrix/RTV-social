# Full Recursive System Diagram (Conceptual) — v1

This document draws the conceptual end-to-end architecture of the platform as a **Recursive Loop Model (RLM)** system, showing how:
- humans, agents, tools, workers, and platforms interact
- memory + evaluation gates constrain behavior
- recursion happens safely (bounded) across Planning → Creation → Publishing → Engagement

> **Diagram format:** Mermaid + explanatory notes. (The diagrams are conceptual: they define the moving parts and their contracts, not exact infrastructure.)

---

## 1) System overview (all lanes)

```mermaid
flowchart TB
  %% ===== Humans / UI =====
  subgraph UI[Next.js Control Plane (Agency-Operated)]
    UI1[Client Dashboard]
    UI2[Plan Builder]
    UI3[Creative Studio]
    UI4[Approval Queue]
    UI5[Calendar + Scheduler]
    UI6[Engagement Inbox]
    UI7[Ops Panel: Health / Logs / Budgets]
  end

  %% ===== Agent Core =====
  subgraph CORE[RLM Agent Core]
    ORCH[Orchestrator / Episode Runner]
    POL[PolicyGuard + Autonomy Engine]
    BUD[Budget Enforcer]
    DISC[Tool Discovery Controller]
    EVAL[Evaluator(s): Preflight + Postflight]
    ROUTE[Model/Provider Router (BYOK)]
  end

  %% ===== Memory =====
  subgraph MEM[External Memory + State]
    PG[(PlanGraph
Postgres)]
    AG[(AssetGraph
Postgres)]
    CM[(Conversation Memory
Postgres)]
    EM[(Engagement Events
Postgres)]
    OBJ[(Object Store: S3/R2
Assets + Evidence)]
    IDX[(Search/Index
(optional))]
  end

  %% ===== Execution =====
  subgraph EXEC[Workers + Runners]
    Q[(Job Queue)]
    W1[Content Workers
(copy/prompt packaging)]
    W2[Media Workers
(image/video/heygen)]
    W3[Browser Runner
(playwright/extension)]
    W4[API Runner
(platform APIs)]
    W5[Ingestion/Summary Worker
(scrape→summarize)]
  end

  %% ===== Tool Gateway =====
  subgraph MCP[Docker MCP Gateway]
    GW[MCP Gateway
(one connection point)]
  end

  %% ===== Tools =====
  subgraph TOOLS[Tool Servers (MCP Catalog)]
    T1[GHL MCP]
    T2[Meta/IG APIs MCP]
    T3[TikTok APIs MCP]
    T4[LinkedIn APIs MCP]
    T5[YouTube APIs MCP]
    T6[X APIs MCP]
    T7[Skool Browser/Hybrid MCP]
    T8[Storage/DB MCP]
    T9[Telemetry/Alerting MCP]
  end

  %% ===== External platforms =====
  subgraph PLAT[External Platforms]
    P1[Meta: FB/IG]
    P2[TikTok]
    P3[LinkedIn]
    P4[YouTube]
    P5[X]
    P6[Skool]
  end

  %% ===== Connections =====
  UI1 --> ORCH
  UI2 --> ORCH
  UI3 --> ORCH
  UI4 --> ORCH
  UI5 --> ORCH
  UI6 --> ORCH
  UI7 --> ORCH

  ORCH --> POL
  ORCH --> BUD
  ORCH --> ROUTE
  ORCH --> DISC
  ORCH --> EVAL

  ORCH <--> PG
  ORCH <--> AG
  ORCH <--> CM
  ORCH <--> EM
  ORCH <--> OBJ
  ORCH <--> IDX

  DISC --> GW
  GW --> T1
  GW --> T2
  GW --> T3
  GW --> T4
  GW --> T5
  GW --> T6
  GW --> T7
  GW --> T8
  GW --> T9

  ORCH --> Q
  Q --> W1
  Q --> W2
  Q --> W3
  Q --> W4
  Q --> W5

  W3 --> PLAT
  W4 --> PLAT
  W2 --> OBJ
  W1 --> AG
  W5 --> CM
  W5 --> PG

  PLAT -->|webhooks/poll| W4
  PLAT -->|scrape/poll| W3
  W3 --> OBJ
  W4 --> OBJ

  EVAL --> ORCH
```

### What this diagram encodes
- **Orchestrator** runs *episodes* (bounded loops) and decides **pass/retry/escalate/stop**.
- **PolicyGuard** gates all side effects.
- **Budget Enforcer** prevents runaway recursion.
- **Docker MCP Gateway** acts as a single integration point to many tools (minimizes tool context).
- **Workers/Runners** perform heavy multi-step tasks (publishing, scraping, media generation) to avoid “LLM micromanaging” 20+ tool calls.
- **External Memory** holds the full system state (agents are stateless; they read summaries + write structured updates).

---

## 2) The RLM episode loop (single episode)

```mermaid
flowchart LR
  A[Retrieve minimal memory
PlanNode/Thread summary] --> B[Reason within scope
Role Charter + Constraints]
  B --> C{Need tools?}
  C -- No --> D[Write output
(JSON schema)]
  C -- Yes --> E[Tool discovery
via MCP Gateway]
  E --> F[Execute tools or
spawn worker job]
  F --> D
  D --> G[Evaluate
(preflight or postflight)]
  G --> H{Decision}
  H -- pass --> I[Commit to memory
+ emit next steps]
  H -- retry --> J[FixList + recurse
(bounded)]
  H -- escalate --> K[Human review task
+ payload]
  H -- stop/fail --> L[Stop + log
budget/policy reason]
  J --> A
```

**Key constraints:**
- Recursion uses deterministic FixLists.
- Depth caps are enforced per lane.
- Large tool outputs never flood the model context; they are stored externally and summarized.

---

## 3) Lane diagram: Planning → Creation → Publishing → Engagement

```mermaid
flowchart TB
  subgraph L1[Planning Lane]
    P0[Input: BrandKit + KB + Goals]
    P1[Planner Episode(s)]
    P2[PlanGraph Nodes/Edges]
    P3[Plan Preflight Eval]
    P4{Approved?}
  end

  subgraph L2[Creation Lane]
    C0[Input: PlanNode + Blueprint]
    C1[Copywriter Episode]
    C2[PromptWriter Episode]
    C3[Media Worker Jobs]
    C4[AssetGraph Build]
    C5[Creative QA Eval]
    C6{Ready?}
  end

  subgraph L3[Publishing Lane]
    U0[PublishPackage]
    U1[Preflight: Policy + Constraints]
    U2{Lane decision}
    U3[API Runner]
    U4[Browser Runner]
    U5[Postflight Verify]
    U6[Publish Evidence Stored]
  end

  subgraph L4[Engagement Lane]
    E0[Fetch threads/events]
    E1[Summarize → Conversation Memory]
    E2[Responder Episodes
(comment/dm/skool)]
    E3[Policy Gate]
    E4[Send via API/Browser]
    E5[Postflight + Reflection Note]
  end

  P0 --> P1 --> P2 --> P3 --> P4
  P4 -- yes --> C0
  P4 -- no/retry --> P1

  C0 --> C1 --> C2 --> C3 --> C4 --> C5 --> C6
  C6 -- yes --> U0
  C6 -- retry --> C1

  U0 --> U1 --> U2
  U2 -- api --> U3 --> U5
  U2 -- browser --> U4 --> U5
  U5 --> U6 --> E0

  E0 --> E1 --> E2 --> E3 --> E4 --> E5
  E5 -->|insights| P1
```

### What this lane diagram clarifies
- Planning produces **nodes**, not raw content.
- Creation attaches assets to nodes in an **asset graph**.
- Publishing uses **either API lane or Browser lane**, then verifies.
- Engagement runs continuously, and writes **feedback insights** back to planning.

---

## 4) Publishing lane decision (API vs Browser vs Hybrid)

```mermaid
flowchart LR
  A[Publish Request] --> B[Capability Matrix
(per PlatformAccount)]
  B --> C{API supports this
content type?}
  C -- yes --> D[API Lane]
  C -- no --> E[Browser Lane]
  C -- partial --> F[Hybrid]

  D --> G[Preflight -> Publish -> Verify]
  E --> H[Preflight -> Run UI script -> Verify]
  F --> I[API for media upload,
Browser for stories/edge actions]

  G --> J[Store Evidence]
  H --> J
  I --> J
```

**Hybrid is intentional**:
- Many platforms have “edge actions” (stories, certain engagement patterns) that are difficult or impossible via public API.
- Browser lane is higher risk, so it is throttled, monitored, and backed by contract tests.

---

## 5) Engagement lane: safe autonomy boundaries

```mermaid
flowchart TB
  A[New event
(comment/DM/Skool)] --> B[Thread fetch]
  B --> C[Summarize + classify intent]
  C --> D{Risk flags?}
  D -- yes --> E[Escalate to human
with suggested reply]
  D -- no --> F[Draft reply]
  F --> G[PolicyGuard]
  G --> H{Allowed?}
  H -- yes --> I[Send reply
(API or Browser)]
  H -- no --> E
  I --> J[Log event + postflight eval]
  J --> K[Write Reflection Note
(EpisodicMemory)]
```

**Risk flags include**:
- pricing negotiation
- complaints/refunds
- legal/medical/regulated claims
- harassment or platform policy risk

---

## 6) The “code execution” pattern (LLM → worker scripts)

This is the core design principle that keeps context small and reliability high:

- The LLM should **not** orchestrate 20 UI steps.
- The LLM should output:
  - intent
  - parameters
  - acceptance checks
- A worker executes the workflow and returns:
  - status
  - evidence
  - a short summary for the next episode

**Examples**
- Publishing a story
- Bulk engagement scan
- VSL pipeline generation of 40 clips

---

## 7) Observability loop (health + regression)

```mermaid
flowchart LR
  A[Episode/Workflow logs] --> B[Metrics]
  A --> C[Traces]
  A --> D[Artifacts/evidence]
  B --> E[Dashboards]
  B --> F[Alerts]
  F --> G[Auto-mitigations
(degrade lane/model)]
  F --> H[Human intervention task]
  G --> I[Write incident note
(memory)]
  H --> I
```

### Minimal MVP observability
- tokens in/out per episode
- tool calls per episode
- latency per workflow
- publish verify mismatches
- browser runner failure rate

---

## 8) Post-MVP extensibility patterns (baked into the diagram)

### 8.1 Add new platforms without rewriting the core
Additions are isolated to:
- a new PlatformAccount capability matrix entry
- a new tool server (API or browser scripts)
- blueprint compatibility mappings

The Orchestrator, memory, evaluation loops remain unchanged.

### 8.2 Add new creative blueprints safely
A blueprint is just:
- a planner-compatible node type
- a creation recipe (copy + prompts + assets)
- a QA checklist
- a publish packaging rule

### 8.3 Add new agent types without destabilizing
New agents must declare:
- read/write classes
- tool shortlist
- output schemas
- recursion triggers + stop conditions

### 8.4 Upgrade evaluators incrementally
You can add evaluators (brand voice, conversion, compliance) as a committee without changing the creation pipeline.

---

## 9) MVP Definition of Done (diagram-level)

This system is MVP-ready when:
1) Planning can generate PlanGraph nodes and schedule them.
2) Creation can generate a complete PublishPackage for at least 3 core blueprints.
3) Publishing works via API lane for at least 2 platforms AND Browser lane for stories (or Skool).
4) Engagement can read threads, summarize, draft replies, and safely auto-reply under guardrails.
5) Every side effect has preflight + postflight evaluation with evidence stored.

---

## 10) Next documents you queued earlier
You listed these and we’ve completed through the diagram stage:
- External Memory Schema ✅
- Agent Recursion Contracts ✅
- Evaluation Loops ✅
- Cost & Latency Budgets ✅
- Map RLM → Prompt Architecture ✅
- Full Recursive System Diagram ✅

If you want, next we can:
- convert this conceptual diagram into a **deployment diagram** (Vercel + workers + DB + object store)
- convert blueprint flows into **sequence diagrams per platform** (IG, TikTok, Skool)
- build the MVP milestone checklist + test plan + PDR in your preferred order

