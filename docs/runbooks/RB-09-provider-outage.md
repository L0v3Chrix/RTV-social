# RB-09 — Provider Outage (LLM/image/video/avatar)

**Severity:** P1/P2
**Tags:** PROVIDER

---

## Symptoms

- Timeouts, error spikes, generation failures

---

## Immediate Actions

1. Switch provider via ProviderConfig routing
2. Pause high-cost generation tasks

---

## Diagnosis

- Provider status pages
- Confirm quota/credits

---

## Fix/Workaround

- Route to alternate model/provider
- Degrade features: text-only, silent clips, reduced resolution

---

## Verification

- Generate one asset end-to-end

---

## Follow-ups

- Add provider status monitoring
- Maintain fallback provider configurations

---

*Source: docs/06-reliability-ops/incident-runbooks-postmortem.md*
