# RB-12 — Cost Runaway

**Severity:** P1/P2
**Tags:** COST

---

## Symptoms

- Token usage spike
- Generation spend spike

---

## Immediate Actions

1. Pause non-critical workflows
2. Enforce cost caps

---

## Diagnosis

- Infinite recursion
- Misconfigured provider routing

---

## Fix/Workaround

- Enforce per-episode budgets
- Fix recursion stop conditions

---

## Verification

- Cost burn returns to normal

---

## Follow-ups

- Add cost monitoring dashboard
- Implement per-client cost budgets

---

*Source: docs/06-reliability-ops/incident-runbooks-postmortem.md*
