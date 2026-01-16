# Accounts You Need for Development — Master Checklist (v1)

**Project:** Raize The Vibe — Autonomous Social Media Automation Platform (Agency‑Operated)

This is the **development-facing** list of accounts you’ll want to create (or confirm you already have) to build, deploy, test, and operate the MVP safely.

> Note: Because you’re running a **hybrid lane** (API lane + Browser automation lane), you need **both** official developer/API accounts (where available) **and** sandbox social accounts for browser-runner validation.

---

## A) Core engineering + deployment (required)

### 1) GitHub (org + repo)
- **Account:** GitHub org (or user) + repos + Actions
- **Used for:** source control, PR review, CI checks, release workflow
- **Must configure:** protected branches + required status checks ([docs.github.com](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches?utm_source=chatgpt.com))

### 2) Vercel (team)
- **Account:** Vercel team
- **Used for:** Next.js hosting, Preview/Staging/Prod deployments, env vars management
- **Must configure:** environments + encrypted environment variables ([vercel.com](https://vercel.com/docs/deployments/environments?utm_source=chatgpt.com))

### 3) Domain + DNS provider (Cloudflare recommended)
- **Account:** Cloudflare (or equivalent)
- **Used for:**
  - verified domains for platform APIs (esp. TikTok content posting URLs)
  - webhooks/callback URLs
  - security (WAF, DNS controls)

### 4) Primary database provider
- **Account:** Postgres provider (examples: Neon / Supabase / RDS / Cloud SQL)
- **Used for:** multi-tenant core tables (Client, BrandKit, KB, Plans, Assets, Policies, Audit, Jobs)

### 5) Queue + cache provider
- **Account:** Redis provider (examples: Upstash / Redis Cloud / ElastiCache)
- **Used for:** job queues, locks, rate limiting, idempotency, token refresh scheduling

### 6) Object storage
- **Account:** S3-compatible storage (examples: AWS S3 / Cloudflare R2)
- **Used for:** uploaded KB docs, generated assets, browser evidence (screenshots), traces/artifacts

---

## B) AI + generation providers (required for your stack)

### 7) Anthropic
- **Account:** Anthropic API (Claude)
- **Used for:** planning/creation/engagement reasoning via your ProviderConfig router (BYOK + agency keys)

### 8) Google (Gemini)
- **Account:** Google Cloud project (or Google AI Studio, depending on which endpoint you use)
- **Used for:** Gemini text + image/video generation (per your roadmap)

### 9) OpenAI
- **Account:** OpenAI API
- **Used for:** optional routing and model redundancy in ProviderConfig

### 10) OpenRouter (optional but recommended)
- **Account:** OpenRouter
- **Used for:** provider abstraction (one billing surface + many models) when clients bring their own routing preference

### 11) Video clip generator vendor(s)
- **Account:** Kie.ai (Veo 3.1 via REST, per your VSL pipeline)
- **Used for:** silent-first 4–8s clip generation to splice into reels/VSL segments

### 12) Avatar video vendor
- **Account:** HeyGen
- **Used for:** avatar-driven explainers and scalable face-to-camera style content

---

## C) Social platform developer portals (required for API lane)

### 13) Meta for Developers (Facebook + Instagram)
- **Account:** Meta Developer account + Meta App
- **Used for:**
  - Instagram platform app setup ([developers.facebook.com](https://developers.facebook.com/docs/instagram-platform/create-an-instagram-app/?utm_source=chatgpt.com))
  - Instagram content publishing via Graph API ([developers.facebook.com](https://developers.facebook.com/products/instagram/apis/?utm_source=chatgpt.com))
  - Instagram messaging (if/when enabled for your use cases) ([developers.facebook.com](https://developers.facebook.com/docs/instagram-platform/?utm_source=chatgpt.com))

### 14) TikTok for Developers
- **Account:** TikTok Developer account + registered app
- **Used for:** Content Posting API, direct posting configuration, sandbox mode
- **Note:** requires domain/URL verification for posting from hosted URLs ([developers.tiktok.com](https://developers.tiktok.com/doc/content-posting-api-get-started?utm_source=chatgpt.com))

### 15) Google Cloud Console (YouTube)
- **Account:** Google Cloud project + OAuth consent screen + OAuth client
- **Used for:** YouTube Data API OAuth-based integrations ([developers.google.com](https://developers.google.com/youtube/registering_an_application?utm_source=chatgpt.com))

### 16) LinkedIn Developer Portal
- **Account:** LinkedIn developer app
- **Used for:** OAuth + permitted LinkedIn API surfaces
- **Note:** LinkedIn access is permissioned; many scopes require explicit approval ([learn.microsoft.com](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access?utm_source=chatgpt.com))

### 17) X Developer Platform
- **Account:** X developer account + Project + App
- **Used for:** X API integrations (post, DM, etc. where allowed by your access tier)
- **Note:** create developer account → project/app → credentials ([docs.x.com](https://docs.x.com/x-api/getting-started/getting-access?utm_source=chatgpt.com))

---

## D) Browser automation lane accounts (required for “no-API / story / engagement” coverage)

Because many “viral ops” surfaces are either limited or restricted in official APIs, your browser lane needs **realistic** test coverage.

### 18) Sandbox social accounts per platform
- **Account:** Dedicated sandbox/house accounts for:
  - Instagram
  - Facebook Page
  - TikTok
  - YouTube Channel
  - LinkedIn Page
  - X account
  - Skool community operator account (see next)
- **Used for:** end-to-end verification of:
  - story posting
  - comment harvesting
  - comment replies
  - DM flows
  - UI drift detection

### 19) Skool (operator account)
- **Account:** Skool admin/operator account + test community
- **Used for:** browser-automation engagement ops (comments/DM replies/likes where available in UI)

### 20) Password vault + secret reference system
- **Account:** 1Password / Bitwarden / equivalent
- **Used for:**
  - storing platform creds for browser lane profiles
  - storing API keys for agency + tenant BYOK
  - issuing secret references (never writing raw keys into DB)

---

## E) MCP + tool aggregation (strongly recommended)

### 21) Docker Desktop + Docker MCP Catalog
- **Account:** Docker (for Docker Desktop usage)
- **Used for:** consolidating MCP servers into one discoverable tool surface (reduced context flooding)
- **Docs:** Docker MCP Catalog + Toolkit ([docs.docker.com](https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/?utm_source=chatgpt.com))

---

## F) Observability, error tracking, and alerting (required for safe autonomy)

### 22) Error tracking
- **Account:** Sentry (or equivalent)
- **Used for:** exceptions, client-impact triage, release regression detection

### 23) Metrics + tracing
- **Account:** Grafana Cloud / Datadog / New Relic (pick one)
- **Used for:** runner health, queue latency, publish success rate, verification latency, browser lane drift

### 24) Uptime + notifications
- **Account:** PagerDuty / Opsgenie (optional) + Slack
- **Used for:** on-call, incident routing, kill-switch alerts

---

## G) Communications + webhooks (usually required)

### 25) Email delivery
- **Account:** SendGrid / Postmark / Mailgun
- **Used for:** operator notifications, client escalation emails, verification receipts

### 26) SMS (optional for V1, useful for agency workflows)
- **Account:** Twilio (or similar)
- **Used for:** internal check-ins, optional client alerting

---

## H) Optional but high-leverage “build fast” accounts

### 27) Feature flag service
- **Account:** LaunchDarkly / Statsig / OpenFeature-compatible provider
- **Used for:** progressive delivery and “side effects behind flags” discipline

### 28) Secrets manager (cloud-native)
- **Account:** AWS KMS / GCP Secret Manager
- **Used for:** production-grade key handling + rotation

---

## Minimum set to start building (MVP-ready)

If you want the **minimum** to begin construction without shortcuts:

1) GitHub org + repo
2) Vercel team
3) Domain/DNS
4) Postgres
5) Redis
6) Object storage
7) Anthropic + (Google Gemini) + (OpenAI optional)
8) Meta Dev + TikTok Dev + Google Cloud (YouTube)
9) Docker Desktop + Docker MCP Catalog
10) Sandbox social accounts (one set)
11) 1Password/Bitwarden
12) Sentry + one metrics/tracing provider

---

## Fast question (so we don’t over-buy)

Do you want this MVP to **ship API posting** on Day 1 for Meta/TikTok/YouTube, or do you want to start **browser-lane only** and add APIs after the golden paths are stable?

(You can do either — this just changes which developer portals must be configured first.)

