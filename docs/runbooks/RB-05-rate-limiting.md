# RB-05 — Rate Limiting / Spam Restriction

**Severity:** P2
**Tags:** RATE

---

## Symptoms

- 429 responses, action blocks, "restricted" signals
- Browser lane sees warnings or forced verification

---

## Immediate Actions

1. Reduce concurrency
2. Increase random jitter
3. Pause engagement automations
4. Disable any blueprint causing burst actions

---

## Diagnosis

- Examine action cadence vs policy
- Check if multiple profiles share IP/device fingerprint

---

## Fix/Workaround

- Implement adaptive pacing
- Stagger schedules
- Add daily caps per action type

---

## Verification

- Resume slowly; confirm no new blocks

---

## Follow-ups

- Add rate limit monitoring dashboard
- Implement platform-specific cadence policies

---

*Source: docs/06-reliability-ops/incident-runbooks-postmortem.md*
