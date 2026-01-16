# RB-04 — OAuth / Token Refresh Failure

**Severity:** P2
**Tags:** AUTH

---

## Symptoms

- 401/403 errors, refresh endpoint failures
- Jobs fail after token expiry

---

## Immediate Actions

1. Pause affected jobs
2. Switch to manual-only for that platform/client

---

## Diagnosis

- Refresh token revoked
- Scope changed
- Clock skew

---

## Fix/Workaround

- Re-auth flow (operator)
- Rotate secrets in vault
- Patch refresh scheduler

---

## Verification

- Run "auth check" job

---

## Follow-ups

- Add token health monitoring
- Set up proactive refresh alerts before expiry

---

*Source: docs/06-reliability-ops/incident-runbooks-postmortem.md*
