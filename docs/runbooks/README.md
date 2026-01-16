# Runbooks Index

Operational runbooks for incident response and common operational scenarios.

---

## Safety (P0)

| Runbook | Description | Severity |
|---------|-------------|----------|
| [RB-01](./RB-01-wrong-account.md) | Wrong-Account / Cross-Tenant Action | P0 |
| [RB-10](./RB-10-runaway-engagement.md) | Runaway Engagement Loop | P0/P1 |

---

## Publishing

| Runbook | Description | Severity |
|---------|-------------|----------|
| [RB-02](./RB-02-publish-failures.md) | Publish Failures (API lane) | P1/P2 |
| [RB-03](./RB-03-verification-failures.md) | Verification Failures | P2 |

---

## Authentication

| Runbook | Description | Severity |
|---------|-------------|----------|
| [RB-04](./RB-04-oauth-token-refresh.md) | OAuth / Token Refresh Failure | P2 |

---

## Rate Limiting & Browser

| Runbook | Description | Severity |
|---------|-------------|----------|
| [RB-05](./RB-05-rate-limiting.md) | Rate Limiting / Spam Restriction | P2 |
| [RB-06](./RB-06-browser-drift.md) | Browser Runner Drift / Selector Breakage | P2 |

---

## Infrastructure

| Runbook | Description | Severity |
|---------|-------------|----------|
| [RB-07](./RB-07-queue-backlog.md) | Queue Backlog / Jobs Not Starting | P2 |
| [RB-08](./RB-08-tool-gateway.md) | Tool Gateway Failure | P1/P2 |
| [RB-09](./RB-09-provider-outage.md) | Provider Outage (LLM/image/video) | P1/P2 |

---

## Observability & Cost

| Runbook | Description | Severity |
|---------|-------------|----------|
| [RB-11](./RB-11-missing-audit.md) | Missing Audit/Telemetry | P2 |
| [RB-12](./RB-12-cost-runaway.md) | Cost Runaway | P1/P2 |

---

## Quick Reference

### Severity Levels

- **P0**: Safety / Wrong Account / Data Exposure — Immediate freeze required
- **P1**: Major Production Outage — Broad automation failure
- **P2**: Partial Degradation — Single platform or elevated errors
- **P3**: Minor / Cosmetic — Non-blocking issues

### Incident Tags

`SAFETY` `PUBLISH` `ENGAGE` `AUTH` `RATE` `BROWSER` `QUEUE` `TOOLGATE` `PROVIDER` `COST` `DATA` `OBS`

---

*See [incident-runbooks-postmortem.md](../06-reliability-ops/incident-runbooks-postmortem.md) for full incident workflow and postmortem template.*
