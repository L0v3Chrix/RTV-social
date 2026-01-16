# Dependency & Supply Chain Policy — v1

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency-Operated)

**Why this exists:** This system has *high-impact side effects* (publishing, DMs, engagement). A single compromised dependency, poisoned build artifact, or unsafe update can become a production incident or platform enforcement event. This policy makes dependency + build supply chain risk **measurable, enforceable, and operable**.

**Baseline alignment:** NIST SSDF (supply chain + artifact integrity), OWASP SCVS (component assurance maturity), SLSA (build provenance), SBOM standards (SPDX/CycloneDX), and modern CI controls.

---

## 0) Definitions (the shared language)

- **Dependency:** Any external code, package, action, image, SDK, or MCP server not authored in this repo.
- **Direct dependency:** Listed in `package.json` / `requirements.txt` / Dockerfile / Action `uses:`.
- **Transitive dependency:** Pulled in by a direct dependency.
- **Artifact:** Something we build or deploy (web app, runner image, job bundle, browser runner package).
- **Provenance:** Verifiable metadata describing how/where an artifact was produced.
- **SBOM:** Software Bill of Materials (machine-readable inventory of components).
- **VEX:** Vulnerability Exploitability eXchange (states whether a known CVE is exploitable in our context).

---

## 1) Scope

This policy applies to:

1) **Runtime dependencies**
- Node/TypeScript packages
- Python packages (if used)
- Browser automation packages
- SDKs for providers (OpenAI/Anthropic/Google/HeyGen/Kie/etc.)

2) **Build-time dependencies**
- GitHub Actions
- Build containers / base images
- Vercel build inputs

3) **Operational dependencies**
- Docker MCP gateway + selected MCP servers
- Observability SDKs
- Queue/DB client libs

4) **Artifacts**
- Vercel deployments (Next.js)
- Runner deployments (server or container)
- Any downloadable bundles (exported creatives, templates, etc.)

---

## 2) Supply chain threat model (what we’re defending against)

**Primary threats:**

- **Typosquatting / dependency confusion** (malicious similarly named packages)
- **Compromised maintainer accounts** (legit package version becomes malicious)
- **Malicious install scripts** (postinstall exfiltration)
- **Build pipeline tampering** (artifact not built from reviewed source)
- **Stale vulnerable transitive deps** (CVE exposure)
- **Poisoned CI actions** (Action `uses:` points to mutable tag)

**Core idea:** treat dependencies as *untrusted input* until verified.

---

## 3) Roles & accountability

### 3.1 Owners

- **Security Owner (Primary):** approves exceptions, owns risk policy, runs incident coordination for supply chain issues.
- **Platform Engineering Owner:** owns CI gates, provenance, signing, SBOM generation, and required checks.
- **Repo Maintainers:** ensure updates follow this policy; block merges that violate it.

### 3.2 Required reviews

- **Any new direct dependency** → requires explicit review and recorded rationale.
- **Any dependency with critical surface area** (auth, crypto, browser automation, network proxying, sandboxing) → requires Security Owner approval.

---

## 4) Dependency intake rules (what is allowed)

### 4.1 Allowed sources

- Official registries (npm, PyPI) and reputable upstreams
- Official vendor SDKs where possible
- Open-source projects with strong maintenance signals

### 4.2 Disallowed by default

- Unmaintained packages (no meaningful activity)
- Packages without clear license
- Packages that require broad OS privileges unnecessarily
- Packages that do code generation or dynamic loading without strong justification

### 4.3 Minimum “acceptance bar” for new dependencies

For any new direct dependency, capture in PR:

- **Why it’s needed** (what it enables)
- **Alternatives considered** (including “build ourselves”)
- **Maintenance signals** (recent releases, issue response)
- **Security signals** (advisories history, supply chain posture)
- **Operational risk** (does it touch secrets, browser, or network?)

---

## 5) Pinning, lockfiles, and reproducibility (non-negotiable)

### 5.1 Lockfiles are mandatory

- Node: `package-lock.json` or `pnpm-lock.yaml` (choose one ecosystem; do not mix)
- Python (if used): `requirements.txt` pinned or `poetry.lock`

### 5.2 CI must use deterministic installs

- Node: `npm ci` (or pnpm equivalent)
- Python: install from lock/pins only

### 5.3 Version pinning policy

- **Direct deps:** pin with `~` or exact versions for critical packages
- **Transitive deps:** controlled via lockfile only

### 5.4 No “floating tags” in CI actions

- GitHub Actions must pin to a commit SHA (not `@v3` tags) for security-sensitive workflows.

---

## 6) Vulnerability management policy

### 6.1 Scanning is always-on

Required in CI + scheduled:

- Dependency alerts (GitHub Dependabot)
- Dependency updates (Dependabot PRs)
- Package audits (e.g., `npm audit` in CI)

### 6.2 Severity SLAs

- **Critical:** triage within 4 hours; patch or mitigate within 24 hours
- **High:** triage within 1 business day; patch or mitigate within 7 days
- **Medium:** patch within 30 days
- **Low:** patch opportunistically

### 6.3 Patch decision hierarchy

1) Upgrade dependency
2) Remove dependency
3) Replace dependency
4) Mitigate (feature disable, isolation, runtime guard)
5) Accept risk (requires Security Owner sign-off + expiration date)

### 6.4 VEX posture (post-MVP ready)

If a CVE is present but **not exploitable** in our runtime path, record a VEX note:
- CVE
- affected component
- exploitability justification
- monitoring trigger

---

## 7) SBOM policy (inventory for every release)

### 7.1 What we produce

For each production release:

- **SBOM (CycloneDX)** for the deployed artifact(s)
- **SBOM (SPDX)** optional (if required by customers or compliance)

### 7.2 Where SBOMs live

- Stored as build artifacts in CI
- Stored with the deployment metadata (release bundle)
- Referenced in `/docs/releases/` via versioned link

### 7.3 Minimum SBOM requirements

- Includes direct + transitive deps
- Includes build metadata (commit SHA, build timestamp)
- Includes licenses where possible

---

## 8) Provenance + signing policy (build integrity)

### 8.1 Provenance requirements (SLSA baseline)

- We target **SLSA L2** posture for MVP:
  - build runs in a controlled CI platform
  - provenance is generated and associated with artifacts

### 8.2 Signing requirements

- Sign production artifacts (or at minimum: release manifests + SBOMs) using **Sigstore / Cosign**.
- Store signature references alongside the artifact metadata.

### 8.3 Verification gates

Before production promotion:

- Verify provenance exists and matches `commit_sha`
- Verify signatures for the release bundle (or its manifest)

---

## 9) Docker / MCP supply chain rules

Because MCP servers can be an execution vector, we treat them as dependencies.

### 9.1 Docker MCP gateway selection rules

- Only install MCP servers from vetted sources
- Maintain an **allowlist** in repo (`/docs/security/mcp-allowlist.md`)
- Each MCP server entry includes:
  - name + source
  - version/pin
  - permissions required
  - data surfaces touched
  - allowed environments (dev/staging/prod)

### 9.2 Tool permission minimization

- Default: **read-only** tools enabled
- Side-effect tools require explicit enablement per environment and per client policy

### 9.3 MCP updates

- MCP server updates are treated like dependency updates:
  - tested in staging
  - canaried
  - rollback plan required

---

## 10) License and legal policy (lightweight, enforceable)

- Maintain an explicit license allowlist/denylist
- Any dependency with restrictive or unknown license requires review

**MVP stance:** prefer permissive licenses (MIT/Apache-2.0/BSD). Exceptions require documentation.

---

## 11) CI required checks (enforced)

A PR cannot merge unless it passes:

1) Lockfile consistency check (no drift)
2) Dependency scan (Dependabot alerts are not ignored)
3) Audit check (`npm audit` or equivalent)
4) SBOM generation test (staging artifact)
5) Signing/provenance dry-run (staging)

**Release cannot promote to production unless:**

- No unresolved critical vulnerabilities in shipped dependency graph (unless exception approved)
- Provenance + signature verification succeed

---

## 12) Exception process (how we break glass safely)

Exceptions are allowed only with:

- Written justification
- Expiration date
- Mitigation plan
- Owner assigned

All exceptions live in:

- `/docs/security/exceptions/EXC-####.md`

---

## 13) Operating checklist (what you do weekly)

**Weekly:**
- Review Dependabot PRs
- Review dependency alert queue
- Run scheduled supply chain report
- Confirm no new MCP servers installed outside allowlist

**Monthly:**
- Audit “critical surface” dependencies (auth, browser runner, crypto)
- Rotate any non-keyless signing materials (if used)

---

## 14) Post‑MVP extensibility patterns

This policy is designed to grow without rework:

- Add VEX outputs per release
- Add provenance level hardening (SLSA L3+)
- Add organization-wide dependency scoring (OpenSSF Scorecard on key deps)
- Add private package registry proxying (to reduce upstream exposure)

---

## 15) Next docs (recommended)

1) **Config & Feature Flag Governance — v1**
2) **Data Retention & Privacy Policy — v1**
3) **Agent Prompt Ops Manual — v1**

