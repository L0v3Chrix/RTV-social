# Platform Algorithm Alignment Playbooks — v1

**Purpose:** Provide platform-specific playbooks that operationalize “algorithm alignment” into repeatable **Planning → Creation → Publishing → Engagement** behaviors (with API lane + Browser lane support). This is written for an agency-operated, semi-autonomous system that aims to produce **viral distribution** while requiring only **2–3 short check-ins/day**.

**Authoritative sources referenced (high-trust):**
- Instagram Creators guidance + Meta Transparency ranking explanations (Instagram systems).
- TikTok Support “How TikTok recommends content.”
- LinkedIn Engineering blog (Feed ranking + dwell-time negative signal).
- YouTube official blog on recommendations.
- X open-source recommendation algorithm repositories.
- Meta Transparency “Ranking and Content” for Feed.

---

## 0) Global principles that apply across platforms

### 0.1 The three universal distribution levers
1) **Initial viewer satisfaction** (retention/dwell/quality signals)
2) **Network expansion** (shares, saves, replays, sends, follows)
3) **Conversation quality** (meaningful comments, reply chains, low negative feedback)

### 0.2 The four operational lanes (our system)
- **Planning lane:** topic/angle/CTA + platform mapping + constraints
- **Creation lane:** assets + copy + metadata optimized per surface
- **Publishing lane:** timing + format compliance + verification
- **Engagement lane:** rapid replies + DM routing + community loops

### 0.3 The agency advantage
The “algorithm” is not beaten by one post. It’s beaten by:
- **high-volume experiments** with tight QA
- **fast iteration** on what gets retained/shared
- **consistent publishing rhythm**
- **high-quality conversations** that don’t trigger spam signals

---

## 1) Instagram Playbook (Feed • Reels • Stories • Explore)

### 1.1 What Instagram is optimizing for (how ranking is described)
Instagram uses multiple ranking systems depending on surface (Feed, Reels, Explore, Stories). These systems predict what a person will find **valuable and relevant**, based on past interactions and content features.

### 1.2 MVP targets (what we optimize for)
- **Reels:** hook strength + retention + shares + replays
- **Feed:** saves + meaningful comments + time spent (dwell)
- **Stories:** taps forward/back + replies + sticker interactions
- **Explore:** similarity clustering + engagement velocity

### 1.3 Content types that most reliably expand reach
1) **Reels: Hook → Value → CTA** (15–35s)
2) **Reels: POV/UGC** (native-feeling)
3) **Carousel education** (save-worthy)
4) **Story sequences** (poll/quiz/Q&A → DM)
5) **Remix-ready clips** (designed for shares)

### 1.4 Creation rules (do/don’t)
**Do:**
- Put the hook in the first 1–2 seconds (visual + text)
- Use on-screen captions for silent viewing
- Use one clear idea per post
- Prefer “save/share prompts” over “like begging”

**Don’t:**
- Recycle watermarked content
- Over-hashtag; prefer tight relevance
- Publish inconsistent visual identity per client

### 1.5 Publishing rules
- Use **format-native** specs per surface (aspect ratio, length, cover)
- Attach alt-text where applicable
- Verify post is live and playable (PublishVerifier)

### 1.6 Engagement rules (algorithm-safe automation)
- First 30–60 minutes: respond to real comments quickly
- Build reply chains (question-back strategy)
- DM routing: comment keyword → DM sequence (with guardrails)
- Avoid repetitive templated comments; rotate response patterns

### 1.7 Automation alignment checklist (Instagram)
- [ ] Lane selected: API / Browser / Hybrid
- [ ] Reels: hook overlay present, captions present
- [ ] Cover image set
- [ ] CTA matches BrandKit policy
- [ ] Engagement templates are varied + context-aware
- [ ] Anti-spam pacing enabled (comment/DM rate limits)

---

## 2) TikTok Playbook (For You distribution)

### 2.1 What TikTok says it uses
TikTok describes recommendations as driven primarily by **user interactions** (watching, liking, sharing, commenting, following), plus **video information** (captions, sounds, hashtags, effects), plus **user/device/context info**.

### 2.2 MVP targets
- **Completion rate / average watch time**
- **Rewatches**
- **Shares/sends**
- **Comment rate** (quality > quantity)

### 2.3 High-value content types
1) **Hook-first micro-stories** (8–20s)
2) **Authority POV** (fast take + proof)
3) **UGC style testimonials**
4) **“Series” format** (Part 1/2/3)
5) **Duet/Stitch bait** (open loop)

### 2.4 Creation rules
- Keep the first 1 second visually loud
- Deliver value by second 3–5
- Use tight captions; avoid long intros
- Use trend audio only when it fits brand + message

### 2.5 Publishing rules
- Test 2–3 variants per idea (hook swap)
- Use consistent cadence (daily is ideal, but MVP: 4–6/wk)
- Verify playback + correct caption

### 2.6 Engagement rules
- Reply to top comments with new videos (high leverage)
- Use keyword triggers to DM resources (opt-in style)
- Do not mass-DM; keep conversation context-aware

### 2.7 Automation alignment checklist (TikTok)
- [ ] Hook variants generated
- [ ] Captions burned in
- [ ] Description includes 1–2 relevant keywords
- [ ] Comment-to-video reply backlog maintained
- [ ] Engagement pacing configured

---

## 3) YouTube Playbook (Shorts + Longform discovery)

### 3.1 What YouTube emphasizes
YouTube has described recommendations as centered on **viewer satisfaction** and **valued watch time** (satisfaction signals in addition to raw watch time).

### 3.2 MVP targets
**Shorts:**
- retention curve stability
- replays
- subs per view

**Longform (optional later):**
- session time + satisfaction
- CTR (thumbnail/title)
- average view duration

### 3.3 High-value content types
1) **Shorts: Hook → One Point → Payoff**
2) **Shorts: “Myth vs Truth”**
3) **Shorts: “3 mistakes”**
4) **Longform: pillar video** (post-MVP)

### 3.4 Creation rules
- Shorts: 9:16, fast pacing, captions
- Titles: keyword + curiosity + specificity
- Thumbnails (longform): high contrast, 3–5 words max

### 3.5 Publishing rules
- Consistent series formats
- Verify metadata + playback

### 3.6 Engagement rules
- Pin a comment that drives the next action
- Reply to comments that ask follow-ups (build topic backlog)

---

## 4) LinkedIn Playbook (Feed distribution for authority)

### 4.1 What LinkedIn engineering has stated
LinkedIn has used **dwell time** (time spent) as a ranking input, including predicting *short dwell time* and using it as a **negative** ranking signal.

### 4.2 MVP targets
- dwell time (scroll stop)
- saves
- meaningful comments
- profile clicks

### 4.3 High-value content types
1) **Text posts with strong first 2 lines**
2) **Framework posts** (how-to)
3) **Contrarian insight + proof**
4) **Document posts (PDF carousel)** (optional lane)

### 4.4 Creation rules
- First 2 lines must hook hard (no fluff)
- Use simple formatting (short paras)
- Avoid engagement bait; prioritize professional value

### 4.5 Engagement rules
- Reply thoughtfully; build comment chains
- Tag sparingly and only when relevant

---

## 5) Facebook Playbook (Feed + Groups + Reels)

### 5.1 What Meta highlights
Meta describes Feed ranking as using machine learning to personalize what appears, emphasizing relevance and predicted value, historically emphasizing meaningful interactions.

### 5.2 MVP targets
- shares
- comment conversations
- saves
- group engagement (if using groups)

### 5.3 High-value content types
1) **Native video / Reels**
2) **Story-based posts** (real + local)
3) **Community questions** (that spark real comments)
4) **Group-first posting** (where relevant)

### 5.4 Engagement rules
- Reply quickly; encourage back-and-forth
- Avoid repetitive templated comments

---

## 6) X Playbook (open ranking code awareness)

### 6.1 Why X is unique
X has open-sourced recommendation code (and related ML components) in public repos, which makes it more transparent than most networks.

### 6.2 MVP targets
- early engagement velocity
- meaningful replies
- reposts / quote tweets
- topic relevance

### 6.3 High-value content types
1) **Short insight threads** (3–7 posts)
2) **Hot take + proof**
3) **Visual-first posts** (image + short copy)
4) **Reply strategy** (commenting under large accounts in-niche)

### 6.4 Engagement rules
- A “reply engine” is often higher leverage than posting alone
- Avoid spammy tagging/hashtags

---

## 7) Skool Playbook (community growth + retention loop)

> Skool is less “algorithmic feed” and more **community retention + interaction loops**.

### 7.1 MVP targets
- daily active members
- post/comment participation rate
- DM conversations that convert to action

### 7.2 High-value workflows
1) **Daily prompt post** (simple ask)
2) **Weekly wins thread**
3) **Resource drop** (high save value)
4) **DM welcome + routing** (new member onboarding)

### 7.3 Engagement rules
- Answer fast in early lifecycle
- Make members feel seen (names + context)
- Rotate prompts to avoid monotony

---

## 8) Cross-platform “Beat the Algorithm” operating system

### 8.1 The viral engine loop
1) **Publish** a small batch of experiments
2) **Measure proxies** (retention, saves, shares, comment depth)
3) **Double down** on winners
4) **Convert engagement into community** (DM → Skool/CRM)
5) **Repeat weekly**

### 8.2 Minimal daily check-in protocol (agency)
**Check-in #1 (morning, 10–15 min):**
- approve today’s publish queue
- clear escalations
- confirm lane health (API tokens, browser runner status)

**Check-in #2 (midday, 10–15 min):**
- verify posts went live
- answer top comments/DMs
- log any “learning events” (rejects, failures)

**Optional #3 (late day, 5–10 min):**
- skim engagement; reply where high leverage

---

## 9) Post-MVP extensibility patterns

When we add metrics (V2), each playbook expands with:
- platform-specific analytics ingestion
- blueprint performance models per platform
- automated experiment rotation
- a “Performance Planner” that allocates content slots to proven winners

---

## 10) Next document in your success pack
**Compliance & Automation Policy Binder — v1** (platform rules + anti-spam + guardrails + escalation).

