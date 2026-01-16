# RB-10 — Runaway Engagement Loop (P0/P1)

**Severity:** P0/P1
**Tags:** ENGAGE, SAFETY

---

## Symptoms

- Repeated DMs/replies
- High action rates

---

## Immediate Actions

1. Global or per-client engagement kill switch ON
2. Lock "keyword triggers"

---

## Diagnosis

- Recursion contract violated
- Dedupe/idempotency missing

---

## Fix/Workaround

- Add dedupe keys and conversation state
- Add hard caps and cooldowns

---

## Verification

- Replay test thread in sandbox

---

## Follow-ups

- Add engagement rate monitoring
- Implement conversation state tracking

---

*Source: docs/06-reliability-ops/incident-runbooks-postmortem.md*
