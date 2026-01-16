# RB-01 — Wrong-Account / Cross-Tenant Action (P0)

**Severity:** P0 — Safety / Wrong Account / Data Exposure
**Tags:** SAFETY

---

## Symptoms

- AuditEvent shows action executed under wrong `client_id` or wrong platform account
- A post/DM/comment appears on wrong account

---

## Immediate Actions (0–2 min)

1. **Global kill switch ON** (side effects)
2. Disable all browser runners (if browser lane involved)
3. Snapshot evidence: affected AuditEvents + proof artifacts
4. IC assigns security SME

---

## Diagnosis

- Verify tenancy boundaries:
  - request-scoped `client_id`
  - tool gateway scoping
  - browser profile selection logic
  - credentialRef resolution
- Check recent changes to:
  - routing
  - keyring resolution
  - profile vault

---

## Fix/Workaround

- Force manual-only mode for all clients
- Patch tenancy guard (hard assert) and add regression test
- Rotate any impacted credentials

---

## Verification

- Run sandbox canary for 1 client
- Confirm every AuditEvent has correct account identity

---

## Follow-ups

- Mandatory postmortem
- Add/upgrade invariant checks and CI gates

---

*Source: docs/06-reliability-ops/incident-runbooks-postmortem.md*
