# RB-02 — Publish Failures (API lane)

**Severity:** P1/P2
**Tags:** PUBLISH

---

## Symptoms

- `publish_attempts` rising, `publish_success` falling
- Platform returns errors (4xx/5xx), missing post IDs

---

## Immediate Actions

1. Switch affected platform to **manual schedule only** if error rate > threshold
2. Reduce concurrency + backoff
3. If widespread: disable publish side effects for that platform

---

## Diagnosis

- Inspect error classes:
  - auth/token expired
  - rate limit
  - invalid media specs
  - platform outage
- Compare to last known good deploy

---

## Fix/Workaround

- Token refresh repair
- Implement retry policy (idempotent)
- Media validation fix (size/aspect/format)

---

## Verification

- Publish one test post to sandbox account
- Verify post visible

---

## Follow-ups

- Add contract test for platform error mapping

---

*Source: docs/06-reliability-ops/incident-runbooks-postmortem.md*
