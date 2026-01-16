# Sprint 3: Scheduling + Publishing

**Duration:** Weeks 7-8
**Goal:** Implement calendar system and dual-lane publishing with verification.

**Prerequisites:** Sprint 2 complete

---

## Parallelizable Work

### Agent A: Calendar System
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| A1 | Calendar model | Slots, posts, conflicts |
| A2 | Scheduling API | Create, update, reschedule |
| A3 | Delayed execution system | Queue with scheduled time |
| A4 | Conflict detection | No double-posting |
| A5 | Calendar visualization API | JSON for UI rendering |

### Agent B: API Lane Connectors
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| B1 | Meta (Facebook) connector | Post, story (partial) |
| B2 | Meta (Instagram) connector | Post, reel, story (partial) |
| B3 | TikTok connector | Video post |
| B4 | YouTube connector | Shorts, video |
| B5 | LinkedIn connector | Post, document |
| B6 | X (Twitter) connector | Tweet, thread |

### Agent C: Browser Lane Runner
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| C1 | Profile Vault system | Encrypted profile storage |
| C2 | Session isolation | Clean browser per execution |
| C3 | Skool automation | Login, post, comment |
| C4 | Story posting (fallback) | When API unavailable |
| C5 | Artifact capture | Screenshots, DOM snapshots |

### Agent D: Publish Verification System
| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| D1 | Post verification API | Check visibility |
| D2 | Proof capture system | Screenshot + post ID |
| D3 | Retry logic | Exponential backoff |
| D4 | Failure classification | Transient vs permanent |
| D5 | Rollback capability | Delete failed posts |

---

## Blocked Work

| Task | Blocked By | Description |
|------|------------|-------------|
| Dry-run publishing | B1-B6, C1-C5 | Needs all lanes ready |
| Proof capture | D1-D5 | Needs verification system |

---

## Sprint 3 Outputs

### Code
- [ ] Calendar system (`@rtv/calendar`)
- [ ] API lane connectors (`@rtv/connectors/api`)
- [ ] Browser lane runner (`@rtv/connectors/browser`)
- [ ] Verification system (`@rtv/verification`)

### Tests
- [ ] Calendar scheduling tests
- [ ] API connector mocked tests
- [ ] Browser lane E2E tests (sandbox)
- [ ] Verification flow tests
- [ ] Golden path: Schedule → Publish → Verify

### Telemetry
- [ ] Publish success/failure metrics
- [ ] Lane selection metrics (API vs browser)
- [ ] Verification time metrics
- [ ] Retry attempt metrics

### Documentation
- [ ] `docs/00-overview/sprint-3-completion.md`
- [ ] Platform connector guide
- [ ] Profile Vault setup guide

### ADRs
- [ ] ADR-0030: API Lane Architecture
- [ ] ADR-0031: Browser Lane Architecture
- [ ] ADR-0032: Verification Strategy

---

## Platform Coverage Matrix

| Platform | API Publish | API Stories | Browser Fallback |
|----------|-------------|-------------|------------------|
| Facebook | [ ] | [ ] | [ ] |
| Instagram | [ ] | [ ] | [ ] |
| TikTok | [ ] | N/A | [ ] |
| YouTube | [ ] | N/A | [ ] |
| LinkedIn | [ ] | N/A | [ ] |
| X (Twitter) | [ ] | N/A | [ ] |
| Skool | N/A | N/A | [ ] |

---

## Definition of Done

- [ ] Calendar system scheduling posts
- [ ] All API connectors functional (mocked)
- [ ] Browser lane executing Skool operations
- [ ] Verification confirming post visibility
- [ ] Proof artifacts captured
- [ ] Dry-run golden path passing
- [ ] No production side effects yet

---

*Sprint Owner:* TBD
*Review Date:* TBD
