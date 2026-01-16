# RB-03 — Verification Failures ("post may not be live")

**Severity:** P2
**Tags:** PUBLISH

---

## Symptoms

- Platform returned success but visibility verification fails
- Spike in `verification_failed`

---

## Immediate Actions

1. Stop auto-publish for affected surface if verification > threshold
2. Mark affected jobs as "needs human confirm"

---

## Diagnosis

- Verification method broken (API lookup changed, selectors drift)
- Permissions scope insufficient

---

## Fix/Workaround

- Patch verification adapter (API or browser)
- Add fallback proof capture in browser lane

---

## Verification

- Verify 3 consecutive posts

---

## Follow-ups

- Add regression test for verification paths

---

*Source: docs/06-reliability-ops/incident-runbooks-postmortem.md*
