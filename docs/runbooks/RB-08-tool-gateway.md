# RB-08 — Tool Gateway Failure (Docker MCP / Tool routing)

**Severity:** P1/P2
**Tags:** TOOLGATE

---

## Symptoms

- Tool calls failing
- Missing tool responses

---

## Immediate Actions

1. Fail closed: block side effects
2. Switch to degraded mode (read-only + planning)

---

## Diagnosis

- Docker MCP unavailable
- Tool registry mismatch

---

## Fix/Workaround

- Restart gateway
- Roll back tool registry config

---

## Verification

- Run "tool health suite" checks

---

## Follow-ups

- Add tool gateway health monitoring
- Implement automatic failover

---

*Source: docs/06-reliability-ops/incident-runbooks-postmortem.md*
