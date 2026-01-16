# Onboarding Specification

## Brand Kit + Knowledge Base (KB) Schema

This document defines the **authoritative onboarding contract** for each client. Everything the system plans, creates, publishes, and engages with is constrained by these schemas.

Design goals:

- One-time structured intake, then incremental refinement
- Human-editable, agent-readable
- Supports **per-client API keys, platforms, and autonomy policies**
- Optimized for RLM-style external memory (summaries > raw data)

---

## 1) Onboarding flow (agency-operated)

### Step 1 — Client shell

- Create Client record
- Assign internal owner(s)
- Initialize empty BrandKit + KnowledgeBase
- Initialize **Client Keyring (BYOK)**
- Enable default Creative Blueprints set (editable)
- Register PlatformAccounts placeholders

### Step 2 — Brand Kit intake (guided UI)

Agency staff completes a structured form (with examples + AI assist).

### Step 3 — Knowledge Base ingestion

- Upload docs
- Paste URLs
- Add FAQs manually
- Optional scrape + summarize

### Step 4 — Platforms + lane selection

- Connect social accounts (OAuth where possible)
- Define lane preference per platform: **API | Browser | Hybrid**
- Confirm capabilities (post/stories/dm/comments)

### Step 5 — Keyring (BYOK) + ProviderConfig routing

- Register **CredentialRefs** (secret pointers) for:
  - LLM providers (Anthropic/OpenAI/Google/OpenRouter)
  - Image providers
  - Video providers (silent-first clip generation)
  - Avatar providers (HeyGen)
- Choose **ProviderConfig** per task class:
  - llm.planner / llm.creator / llm.engagement
  - image.gen / video.gen / avatar.gen

### Step 6 — Blueprint enablement + overrides

- Enable/disable blueprint types per client
- Configure blueprint defaults (length, CTA style, cadence)

### Step 7 — Autonomy & compliance policies

- What agents may do automatically
- What requires approval
- Escalation rules

---

## 2) Brand Kit schema (authoritative voice + constraints)

The BrandKit is **the single source of truth** for how the brand speaks, behaves, and sells.

### BrandKit (root)

```json
{
  "brand_name": "string",
  "tagline": "string",
  "brand_mission": "string",
  "brand_values": ["string"],
  "target_audience": {
    "icp": "string",
    "pain_points": ["string"],
    "desires": ["string"],
    "objections": ["string"]
  }
}
```

### Voice & tone

```json
{
  "voice_style": {
    "tone": ["authoritative", "friendly", "direct"],
    "energy_level": "low|medium|high",
    "humor": "none|light|playful",
    "formality": "casual|professional|mixed"
  },
  "do_say": ["string"],
  "never_say": ["string"],
  "writing_examples": ["short example posts"]
}
```

### Offers & CTAs

```json
{
  "core_offers": [
    {
      "name": "string",
      "description": "string",
      "primary_cta": "string",
      "secondary_cta": "string",
      "landing_url": "string",
      "proof": ["string"]
    }
  ],
  "pricing_sensitivity": "low|medium|high",
  "allowed_promotions": ["discounts", "free consult", "free estimate", "trial"],
  "cta_preferences": {
    "primary": "comment_keyword|dm_keyword|link|book_call|call_now",
    "secondary": "string"
  }
}
```

### Visual design tokens (for automated creative generation)

```json
{
  "logo_urls": ["string"],
  "brand_colors": [{"name":"string","hex":"#RRGGBB"}],
  "fonts": [{"family":"string","usage":"headline|body"}],
  "imagery_style": "string",
  "photo_guidelines": ["string"],
  "template_refs": {
    "canva": ["url"],
    "figma": ["url"]
  }
}
```

### Compliance & redlines

```json
{
  "regulated": true,
  "required_disclaimers": ["string"],
  "prohibited_claims": ["string"],
  "approval_required_for": ["offers", "testimonials", "medical claims"]
}
```

---

## 3) Knowledge Base schema (facts the agents can rely on)

### KnowledgeBase (root)

```json
{
  "faq": [
    {"question": "string", "answer": "string"}
  ],
  "resources": [
    {"title": "string", "url": "string", "summary": "string"}
  ],
  "products_services": [
    {"name": "string", "details": "string"}
  ]
}
```

### Source documents

- PDFs, docs, pages
- Stored externally (S3)
- Indexed metadata only in DB

```json
{
  "source_id": "uuid",
  "type": "pdf|url|note",
  "summary": "agent-generated",
  "last_reviewed": "timestamp"
}
```

### Retrieval config (per client)

```json
{
  "retrieval_depth": "shallow|standard|deep",
  "max_sources": 5,
  "prefer_summaries": true
}
```

---

## 4) Blueprint enablement (per client)

Each client enables only the blueprints they want, with optional overrides.

```json
{
  "enabled_blueprints": [
    "short_reel_hook_value_cta",
    "educational_carousel",
    "ugc_testimonial_reel",
    "offer_reel_paid_ready",
    "vsl_segment_series",
    "heygen_avatar_explainer",
    "story_sequence_dm_keyword",
    "skool_community_ops",
    "comment_to_dm_keyword_router"
  ],
  "disabled_blueprints": ["string"],
  "blueprint_overrides": {
    "short_reel_hook_value_cta": {
      "max_length_seconds": 30,
      "cta_style": "comment_keyword"
    }
  }
}
```

---

## 5) Platform & API configuration

### PlatformAccount

```json
{
  "platform": "instagram|facebook|tiktok|linkedin|youtube|x|skool",
  "lane_preference": "api|browser|hybrid",
  "capabilities": {
    "post": true,
    "stories": false,
    "dm": true,
    "comments": true
  }
}
```

### Keyring (BYOK) + ProviderConfig

Each client may bring:

- LLM keys (Anthropic, OpenAI, Gemini, OpenRouter)
- Image keys
- Video keys (silent clip generation + stitching)
- Avatar keys (HeyGen)

Stored as **CredentialRef only** (never raw values).

#### CredentialRef

```json
{
  "provider": "anthropic|openai|google|openrouter|kie|heygen|meta|tiktok|linkedin",
  "secret_ref": "vault://path-or-kms-arn",
  "created_at": "timestamp"
}
```

#### ProviderConfig

```json
{
  "task_class": "llm.planner|llm.creator|llm.engagement|image.gen|video.gen|avatar.gen",
  "provider": "string",
  "model": "string",
  "params": {"temperature": 0.4, "max_tokens": 1200}
}
```

---

## 6) Autonomy & approval policies

```json
{
  "planning": "auto",
  "creation": "auto_with_review",
  "publishing": "manual_schedule",
  "engagement": {
    "comments": "auto",
    "dm": "auto_with_guardrails",
    "escalate_if": ["pricing", "complaints", "refund"]
  }
}
```

Policies are evaluated by agents **before every action**.

---

## 6) Why this schema matters

- Prevents hallucination and brand drift
- Enables safe autonomy
- Allows per-client LLM + model routing
- Keeps agents stateless and replayable

---

## 7) Output of onboarding

At completion, the system has:

- A fully-formed BrandKit (voice + offers + **visual tokens** + compliance)
- A queryable KnowledgeBase (structured + sources + summaries)
- Platform accounts connected + lane preference per platform
- **Keyring (BYOK) + ProviderConfig routing** for every task class
- Enabled blueprint set + overrides
- Policies defined

From here, **Planning → Creation → Publishing → Engagement** can run safely.

---

## 8) Next document

**Agent Tool Registry Spec (tools + MCPs)** **Agent Tool Registry Spec (tools + MCPs)**

