# RB-07 — Queue Backlog / Jobs Not Starting

**Severity:** P2
**Tags:** QUEUE

---

## Symptoms

- Scheduling jobs delayed; queue depth rising

---

## Immediate Actions

1. Scale runners
2. Pause non-critical workloads (e.g., long media generation)
3. Ensure publish jobs prioritized

---

## Diagnosis

- Dead letters rising
- DB contention
- Provider latency

---

## Fix/Workaround

- Increase worker count safely
- Rebalance queues

---

## Verification

- Queue freshness returns to target

---

## Follow-ups

- Add queue depth alerting
- Implement job priority system

---

*Source: docs/06-reliability-ops/incident-runbooks-postmortem.md*
