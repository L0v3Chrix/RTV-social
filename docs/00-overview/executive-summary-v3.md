# Executive Summary + Project Scope — v3 (Creative Blueprints Library)

## Executive summary
Raize The Vibe is building an internal, agency-operated **Autonomous Social Media Operating System** for 2026+: a system that turns **brand inputs + knowledge base** into a repeatable pipeline that **plans → creates → publishes → engages** across multiple platforms at scale.

This is a **semi-autonomous marketing ops platform**: AI agents do the heavy lifting, humans approve/steer as needed, and the system continuously learns from performance and conversations.

### Core differentiators
- **Agency-operated, multi-client**: we connect to client social accounts (and optionally their GoHighLevel sub-account) and run the workflow internally (no client logins in MVP).
- **Vibecoded build + agent-native ops**: built and operated with CLI agents, Claude Agent SDK, and MCP-connected applications.
- **RLM-aligned architecture**: long-horizon workflows and data are treated as an **external environment**, not a giant prompt. Agents operate over references + summaries, recurse only on weak items, and write memory externally.
- **Docker MCP aggregation + programmatic tool use**: one MCP endpoint (Docker MCP Toolkit) + workflow scripts for tool composition so tool outputs don’t flood context.
- **Dual execution lanes**:
  1) **Official APIs** (preferr([reuters.com](https://www.reuters.com/business/all-new-facebook-videos-be-classified-reels-soon-meta-says-2025-06-17/?utm_source=chatgpt.com))rowser Automation** (fallback: covers gaps like Stories, Skool deep actions, UI-only engagement)

### Video creation subsystem (baked in)
We are incorporating a proven **Video Pipeline subsystem** as a first-class content workflow.

MVP standard:
- Generate **silent** 4–8s clips
- Stitch into Reels/Shorts/VSLs
- Add **music + voiceover** in post
- Export platform variants (9:16, 1:1, 16:9)

We also integrate **HeyGen** as a premium lane for avatar/presenter content.

### Multi-client isolation + BYO keys
Each client dashboard supports **Bring-Your-Own Keys** for:
- LLM providers (OpenAI / Anthropic / Google / router)([buffer.com](https://buffer.com/resources/instagram-algorithms/?utm_source=chatgpt.com))nsures clean cost attribution, flexible provider choices, and no shared-key risk.

---

## Project scope

### Platforms in scope (Phase 1–2)
- Meta: Facebook Pages, Instagram Business/Creator
- TikTok
- YouTube
- LinkedIn
- X
- Skool
- Optional: Google Business Profile

### Content modalities in scope
- Static posts (image + copy)
- Carousels / documents / multi-image
- Short-form video (Reels/Shorts/TikTok)
- VSL-style videos (script → segments → storyboard → prompts → clips → assembly)
- Avatar presenter videos (HeyGen lane)

---

## Creative blueprints library (MVP)
Creative Blueprints are **repeatable, automatable content workflows**. Each blueprint defines:
- Inputs (brand + KB + offer + goal)
- Output artifacts (copy, visuals, video clips, captions, thumbnails)
- Platform variants (ratio/length/CTA)
- Publishing + engagement hooks
- QA checks + recursion rules

### Scoring rubric
Each blueprint is scored 1–5 on:
- Reach (discovery)
- Engagement (saves/comments/shares)
- Conversion (DMs/calls/opt-ins)
- Automation Fit (reliable generation + execution)

Only high-value workflows are included for MVP.

### Blueprint 01 — Short-form “Hook → Value → CTA” Reel/Short
**Purpose:** discovery + top-of-funnel volume.
- Artifacts: silent clips stitched + captions + thumbnail + caption + CTA
- CTA patterns: comment keyword, DM keyword, link-in-bio, book call
- QA: hook clarity in first seconds, caption readability, CTA friction low
- Scores: Reach 5 / Engagement 4 / Conversion 3 / Automation Fit 5

### Blueprint 02 — Educational Carousel (“Saveable Swipe File”)
**Purpose:** saves/shares ([ads.tiktok.com](https://ads.tiktok.com/help/article/spark-ads?utm_source=chatgpt.com))–10 slide IG carousel OR 8–15 slide LinkedIn document OR TikTok photo mode sequence
- Slide recipe: promise → steps/framework → mistakes → CTA
- QA: mobile readability, 1 idea/slide, consistent brand design
- Scores: Reach 4 / Engagement 5 / Conversion 3 / Automation Fit 4

### Blueprint 03 — Story Sequence (3–7 frames) + DM keyword trigger
**Purpose:** nurture audience + DM conversion.
- Artifacts: story frames + sticker (poll/question) + CTA frame
- Automation: reply routing + escalations
- QA: sticker placement, CTA visibility, compliance constraints
- Scores: Reach 3 / Engagement 5 / Conversion 4 / Automation Fit 3

### Blueprint 04 — UGC/Testimonial Reel (Proof Stack)
**Purpose:** conversion lift via social proof.
- Artifacts: stitched clips + proof overlays (reviews, before/after, numbers) + CTA
- QA: credibility, clarity, no overclaims, visual proof legible
- Scores: Reach 4 / Engagement 4 / Conversion 5 / Automation Fit 4

### Blueprint 05 — Offer Reel (paid-ready) / Spark-ready post
**Purpose:** ready for boosting; uses native social proof.
- Artifacts: short-form offer video + offer card + CTA + landing/booking endpoint
- Optional: convert best organic into paid
- Scores: Reach 4 / Engagement 4 / Conversion 5 / Automation Fit 4

### Blueprint 06 — VSL Segment Series (script-driven)
**Purpose:** turn long scripts into a series of Shorts/Reels or a stitched VSL.
- Artifacts: segmented clips +([nonprofit.linkedin.com](https://nonprofit.linkedin.com/resource-hub/posting/types-of-posts?utm_source=chatgpt.com))c + captions + thumbnail
- QA: segment pacing, consistent character/environment rules, resume/retry segment failures
- Scores: Reach 4 / Engagement 4 / Conversion 5 / Automation Fit 4

### Blueprint 07 — HeyGen Avatar Explainer
**Purpose:** scalable “face of brand” content.
- Artifacts: avatar video + captions + CTA + variants
- QA: brand voice match, template consistency, accurate claims
- Scores: Reach 3 / Engagement 4([support.google.com](https://support.google.com/youtube/answer/16738000?hl=en&utm_source=chatgpt.com)) 4

### Blueprint 08 — Skool Community Post + Comment Ops
**Purpose:** retention + community flywheel.
- Artifacts: discussion prompt + pinned resource + DM follow-up rules
- Automation: like/comment ops + “resource request” DM delivery + escalation
- Scores: Reach 3 / Engagement 5 / Conversion 4 / Automation Fit 3

### Blueprint 09 — LinkedIn Document Post (Lead Magnet Carousel)
**Purpose:** B2B authority + lead capture.
- Artifacts: PDF carousel + caption + CTA + optional newsletter expansion
- QA: mobile readability, clear first slide, CTA aligned to lead magnet
- Scores: Reach 4 / Engagement 4 / Conversion 4 / Automation Fit 4

### Blueprint 10 — YouTube Shorts Template Remix
**Purpose:** faster production using pro([nonprofit.linkedin.com](https://nonprofit.linkedin.com/resource-hub/posting/types-of-posts?utm_source=chatgpt.com))ts: template-based Shorts + caption/metadata + thumbnail rules
- QA: pacing, audio selection (if used), caption timing
- Scores: Reach 4 / Engagement 4 / Conversion 3 / Automation Fit 4

### Blueprint 11 — Comment-to-DM Automation (“Keyword Router”)
**Purpose:** convert public engagement into private conversations.
- Logic: keyword detect → DM asset → qualify → book/opt-in
- Safety: throttling, spam avoidance, escalation
- Scores: Reach 3 / Engagement 4 / Conversion 5 / Automation Fit 4

### Blueprint 12 — Community Poll / Question Post (Engagement Seeder)
**Purpose:** low-lift engagement + audience research.
- Artifacts: poll prompt + 2–4 answers + reply scripts + follow-up post
- Scores: Reach 3 / Engagement 4 / Conversion 2 / Automation Fit 5

### Blueprint governance (MVP)
- Each client has enabled/disabled blueprints based on industry + risk tolerance.
- Each blueprint has a “definition of done” QA checklist.
- Each blueprint writes performance signals back into the planning layer.

---

## The 4 automation pillars (explicit)
1) **Planning**
   - Generate plans by outcome template (lead gen, authority, offer push, Skool growth)
   - Produce plan graph: themes, hooks, post intents, platform cadence

2) **Creation**
   - Convert plan nodes into platform-ready assets
   - Multi-modal creation: copy + static + video
   - Human approval workflow + automated QA checks

3) **Publishing**
   - Schedule to calendar (single pane in our app)
   - Post via API lane where possible; fallback to browser lane for gaps
   - Full logs + retries + artifacts

4) **Engagement**
   - Monitor comments/mentions/DMs
   - Auto-like and safe replies
   - Keyword-trigger DM flows
   - DM assistant with escalation
   - Skool community ops automation

