# RB-06 — Browser Runner Drift / Selector Breakage

**Severity:** P2
**Tags:** BROWSER

---

## Symptoms

- Increased browser publish failures
- Screenshots show UI change, missing buttons, modals

---

## Immediate Actions

1. Route to API lane where possible
2. Pause browser lane side effects on that platform
3. Keep browser lane in read-only mode (ingest only)

---

## Diagnosis

- Identify selector changes
- Detect new interstitials/captcha

---

## Fix/Workaround

- Patch selector map
- Add resilient locator strategy
- Add drift snapshot updates

---

## Verification

- Run sandbox canary

---

## Follow-ups

- Set up automated drift detection
- Maintain baseline screenshots for comparison

---

*Source: docs/06-reliability-ops/incident-runbooks-postmortem.md*
