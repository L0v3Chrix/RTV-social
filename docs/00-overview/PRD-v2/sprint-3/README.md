# Sprint 3: Scheduling + Publishing

**Duration:** Weeks 7-8
**Goal:** Implement calendar system and dual-lane publishing with verification.

---

## Sprint Overview

Sprint 3 implements the complete publishing pipeline:

1. **Calendar System** — Schedule posts with conflict detection
2. **API Lane** — Official platform connectors for publishing
3. **Browser Lane** — Fallback automation for UI-only operations
4. **Verification** — Confirm posts are live and capture proof

---

## Task Index

### Agent A: Calendar System (5 tasks)

| File | Task ID | Name | Complexity |
|------|---------|------|------------|
| [S3-A1-calendar-model.md](./S3-A1-calendar-model.md) | S3-A1 | Calendar Model | High |
| [S3-A2-scheduling-api.md](./S3-A2-scheduling-api.md) | S3-A2 | Scheduling API | Medium |
| [S3-A3-delayed-execution.md](./S3-A3-delayed-execution.md) | S3-A3 | Delayed Execution | High |
| [S3-A4-conflict-detection.md](./S3-A4-conflict-detection.md) | S3-A4 | Conflict Detection | Medium |
| [S3-A5-calendar-visualization.md](./S3-A5-calendar-visualization.md) | S3-A5 | Calendar Visualization API | Medium |

### Agent B: API Lane Connectors (6 tasks)

| File | Task ID | Name | Complexity |
|------|---------|------|------------|
| [S3-B1-meta-facebook.md](./S3-B1-meta-facebook.md) | S3-B1 | Meta Facebook Connector | High |
| [S3-B2-meta-instagram.md](./S3-B2-meta-instagram.md) | S3-B2 | Meta Instagram Connector | High |
| [S3-B3-tiktok.md](./S3-B3-tiktok.md) | S3-B3 | TikTok Connector | High |
| [S3-B4-youtube.md](./S3-B4-youtube.md) | S3-B4 | YouTube Connector | High |
| [S3-B5-linkedin.md](./S3-B5-linkedin.md) | S3-B5 | LinkedIn Connector | Medium |
| [S3-B6-x-twitter.md](./S3-B6-x-twitter.md) | S3-B6 | X (Twitter) Connector | Medium |

### Agent C: Browser Lane Runner (5 tasks)

| File | Task ID | Name | Complexity |
|------|---------|------|------------|
| [S3-C1-profile-vault.md](./S3-C1-profile-vault.md) | S3-C1 | Profile Vault System | High |
| [S3-C2-session-isolation.md](./S3-C2-session-isolation.md) | S3-C2 | Session Isolation | High |
| [S3-C3-skool-automation.md](./S3-C3-skool-automation.md) | S3-C3 | Skool Automation | High |
| [S3-C4-story-posting.md](./S3-C4-story-posting.md) | S3-C4 | Story Posting Fallback | Medium |
| [S3-C5-artifact-capture.md](./S3-C5-artifact-capture.md) | S3-C5 | Artifact Capture | Medium |

### Agent D: Publish Verification System (5 tasks)

| File | Task ID | Name | Complexity |
|------|---------|------|------------|
| [S3-D1-verification-api.md](./S3-D1-verification-api.md) | S3-D1 | Post Verification API | Medium |
| [S3-D2-proof-capture.md](./S3-D2-proof-capture.md) | S3-D2 | Proof Capture System | Medium |
| [S3-D3-retry-logic.md](./S3-D3-retry-logic.md) | S3-D3 | Retry Logic | Medium |
| [S3-D4-failure-classification.md](./S3-D4-failure-classification.md) | S3-D4 | Failure Classification | Medium |
| [S3-D5-rollback.md](./S3-D5-rollback.md) | S3-D5 | Rollback Capability | Medium |

---

## Dependency Graph

```
Sprint 2 (Complete)
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                        Sprint 3                               │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│   Agent A    │   Agent B    │   Agent C    │    Agent D      │
│  Calendar    │  API Lane    │ Browser Lane │  Verification   │
├──────────────┼──────────────┼──────────────┼─────────────────┤
│     A1       │     B1       │     C1       │      D1         │
│     │        │     │        │     │        │      │          │
│     ▼        │     ▼        │     ▼        │      ▼          │
│     A2       │     B2       │     C2       │      D2         │
│     │        │     │        │     │        │      │          │
│     ▼        │     ▼        │     ▼        │      ▼          │
│     A3 ◄─────┼─────┼────────┼─────┼────────┼──────┤          │
│     │        │     ▼        │     ▼        │      ▼          │
│     ▼        │     B3       │     C3       │      D3         │
│     A4       │     │        │     │        │      │          │
│     │        │     ▼        │     ▼        │      ▼          │
│     ▼        │     B4       │     C4       │      D4         │
│     A5       │     │        │     │        │      │          │
│              │     ▼        │     ▼        │      ▼          │
│              │     B5       │     C5       │      D5         │
│              │     │        │              │                 │
│              │     ▼        │              │                 │
│              │     B6       │              │                 │
└──────────────┴──────────────┴──────────────┴─────────────────┘
                         │
                         ▼
                    Sprint 4
```

---

## Key Packages

| Package | Description |
|---------|-------------|
| `@rtv/calendar` | Scheduling system |
| `@rtv/connectors/api` | Official API connectors |
| `@rtv/connectors/browser` | Browser automation lane |
| `@rtv/verification` | Post verification system |

---

## Sprint 3 Outputs

### Code
- Calendar system with slot management
- 6 platform API connectors
- Browser lane runner with Profile Vault
- Verification and proof capture

### Tests
- Calendar scheduling tests
- API connector mocked tests
- Browser lane E2E tests (sandbox)
- Verification flow tests
- Golden path: Schedule → Publish → Verify

### Telemetry
- Publish success/failure metrics
- Lane selection metrics (API vs browser)
- Verification time metrics
- Retry attempt metrics

### ADRs
- ADR-0030: API Lane Architecture
- ADR-0031: Browser Lane Architecture
- ADR-0032: Verification Strategy

---

## Platform Coverage Matrix

| Platform | API Publish | API Stories | Browser Fallback |
|----------|-------------|-------------|------------------|
| Facebook | S3-B1 | S3-B1 | S3-C4 |
| Instagram | S3-B2 | S3-B2 | S3-C4 |
| TikTok | S3-B3 | N/A | — |
| YouTube | S3-B4 | N/A | — |
| LinkedIn | S3-B5 | N/A | — |
| X (Twitter) | S3-B6 | N/A | — |
| Skool | N/A | N/A | S3-C3 |

---

## Definition of Done

- [ ] Calendar system scheduling posts
- [ ] All API connectors functional (mocked)
- [ ] Browser lane executing Skool operations
- [ ] Verification confirming post visibility
- [ ] Proof artifacts captured
- [ ] Dry-run golden path passing
- [ ] No production side effects yet
