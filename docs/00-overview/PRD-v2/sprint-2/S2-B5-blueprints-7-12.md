# Build Prompt: S2-B5 — MVP Blueprints (7-12)

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-B5 |
| Sprint | 2 |
| Agent | B (Blueprint Definitions) |
| Complexity | High |
| Status | pending |
| Estimated Tokens | 6,000 |
| Depends On | S2-B3 |
| Blocks | S3-B1 |

---

## Context

### What We're Building

The remaining 6 MVP blueprints covering specialized content types:

7. **HeyGen Avatar Explainer** — AI avatar video
8. **Skool Community Post** — Community engagement post
9. **LinkedIn Document Post** — Lead magnet carousel
10. **YouTube Shorts Template** — Short-form remix
11. **Comment-to-DM Automation** — Keyword router
12. **Community Poll/Question** — Engagement seeder

### Why It Matters

These blueprints cover specialized platforms (Skool, LinkedIn) and advanced automation patterns (keyword routing, avatar videos) essential for a complete social automation system.

### Spec References

- Blueprint Schema: S2-B1
- Architecture: `/docs/01-architecture/system-architecture-v3.md`
- Platform Playbooks: `/docs/09-platform-playbooks/`

---

## Prerequisites

### Completed Tasks
- [x] S2-B3: Blueprint registry

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/blueprint/src/blueprints/mvp-7-12.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  heygenAvatarExplainerBlueprint,
  skoolCommunityPostBlueprint,
  linkedinDocumentPostBlueprint,
  youtubeShortTemplateBlueprint,
  commentToDmAutomationBlueprint,
  communityPollBlueprint,
} from './mvp-7-12';
import { validateBlueprint } from '../schema/blueprint-schema';

describe('MVP Blueprints 7-12', () => {
  describe('BP-07: HeyGen Avatar Explainer', () => {
    const bp = heygenAvatarExplainerBlueprint;

    it('should have correct slug', () => {
      expect(bp.slug).toBe('heygen-avatar-explainer');
    });

    it('should have avatar category', () => {
      expect(bp.category).toBe('avatar');
    });

    it('should have avatar ID input', () => {
      const avatarInput = bp.inputs.find((i) => i.name === 'avatarId');
      expect(avatarInput).toBeDefined();
      expect(avatarInput?.required).toBe(true);
    });

    it('should have script input', () => {
      const inputNames = bp.inputs.map((i) => i.name);
      expect(inputNames).toContain('script');
    });

    it('should output video', () => {
      const outputNames = bp.outputs.map((o) => o.name);
      expect(outputNames).toContain('video');
    });

    it('should pass validation', () => {
      expect(() => validateBlueprint(bp)).not.toThrow();
    });
  });

  describe('BP-08: Skool Community Post', () => {
    const bp = skoolCommunityPostBlueprint;

    it('should have correct slug', () => {
      expect(bp.slug).toBe('skool-community-post');
    });

    it('should support skool platform', () => {
      expect(bp.platforms).toContain('skool');
    });

    it('should have engagement category', () => {
      expect(bp.category).toBe('engagement');
    });

    it('should have community-specific inputs', () => {
      const inputNames = bp.inputs.map((i) => i.name);
      expect(inputNames).toContain('postType');
      expect(inputNames).toContain('content');
    });

    it('should output post and comment ops', () => {
      const outputNames = bp.outputs.map((o) => o.name);
      expect(outputNames).toContain('post');
      expect(outputNames).toContain('commentOps');
    });

    it('should pass validation', () => {
      expect(() => validateBlueprint(bp)).not.toThrow();
    });
  });

  describe('BP-09: LinkedIn Document Post', () => {
    const bp = linkedinDocumentPostBlueprint;

    it('should have correct slug', () => {
      expect(bp.slug).toBe('linkedin-document-post');
    });

    it('should support linkedin platform', () => {
      expect(bp.platforms).toContain('linkedin');
    });

    it('should have lead magnet input', () => {
      const inputNames = bp.inputs.map((i) => i.name);
      expect(inputNames).toContain('leadMagnet');
    });

    it('should output PDF document', () => {
      const docOutput = bp.outputs.find((o) => o.name === 'document');
      expect(docOutput).toBeDefined();
    });

    it('should pass validation', () => {
      expect(() => validateBlueprint(bp)).not.toThrow();
    });
  });

  describe('BP-10: YouTube Shorts Template', () => {
    const bp = youtubeShortTemplateBlueprint;

    it('should have correct slug', () => {
      expect(bp.slug).toBe('youtube-shorts-template');
    });

    it('should support youtube platform', () => {
      expect(bp.platforms).toContain('youtube');
    });

    it('should have source video input', () => {
      const inputNames = bp.inputs.map((i) => i.name);
      expect(inputNames).toContain('sourceVideo');
    });

    it('should have remix/template options', () => {
      const templateInput = bp.inputs.find((i) => i.name === 'templateStyle');
      expect(templateInput).toBeDefined();
      expect(templateInput?.type).toBe('select');
    });

    it('should pass validation', () => {
      expect(() => validateBlueprint(bp)).not.toThrow();
    });
  });

  describe('BP-11: Comment-to-DM Automation', () => {
    const bp = commentToDmAutomationBlueprint;

    it('should have correct slug', () => {
      expect(bp.slug).toBe('comment-to-dm-automation');
    });

    it('should have automation category', () => {
      expect(bp.category).toBe('automation');
    });

    it('should have keyword triggers input', () => {
      const keywordsInput = bp.inputs.find((i) => i.name === 'keywords');
      expect(keywordsInput).toBeDefined();
      expect(keywordsInput?.type).toBe('json');
    });

    it('should output automation config', () => {
      const outputNames = bp.outputs.map((o) => o.name);
      expect(outputNames).toContain('automationConfig');
      expect(outputNames).toContain('dmTemplates');
    });

    it('should pass validation', () => {
      expect(() => validateBlueprint(bp)).not.toThrow();
    });
  });

  describe('BP-12: Community Poll/Question', () => {
    const bp = communityPollBlueprint;

    it('should have correct slug', () => {
      expect(bp.slug).toBe('community-poll-question');
    });

    it('should support multiple platforms', () => {
      expect(bp.platforms).toContain('instagram');
      expect(bp.platforms).toContain('linkedin');
    });

    it('should have poll options input', () => {
      const inputNames = bp.inputs.map((i) => i.name);
      expect(inputNames).toContain('question');
      expect(inputNames).toContain('options');
    });

    it('should have engagement category', () => {
      expect(bp.category).toBe('engagement');
    });

    it('should pass validation', () => {
      expect(() => validateBlueprint(bp)).not.toThrow();
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/blueprint/src/blueprints/mvp-7-12.ts`

```typescript
import { Blueprint, createBlueprint } from '../schema/blueprint-schema';

// BP-07: HeyGen Avatar Explainer
export const heygenAvatarExplainerBlueprint: Blueprint = createBlueprint({
  slug: 'heygen-avatar-explainer',
  name: 'HeyGen Avatar Explainer',
  description: 'AI avatar video for explanations and tutorials',
  category: 'avatar',
  platforms: ['youtube', 'instagram', 'tiktok', 'linkedin'],
  tags: ['avatar', 'explainer', 'educational'],
  estimatedDuration: 60,
  inputs: [
    { name: 'avatarId', type: 'text', required: true, description: 'HeyGen avatar ID' },
    { name: 'script', type: 'text', required: true, description: 'Script for avatar to speak', maxLength: 5000 },
    { name: 'voiceId', type: 'text', required: false, description: 'HeyGen voice ID (optional)' },
    { name: 'background', type: 'select', required: false, description: 'Video background', options: ['office', 'studio', 'gradient', 'custom'], default: 'studio' },
    { name: 'customBackground', type: 'media', required: false, description: 'Custom background image', mediaTypes: ['image/png', 'image/jpeg'] },
    { name: 'brandVoice', type: 'reference', required: false, description: 'Brand settings', referenceType: 'brandKit' },
  ],
  outputs: [
    { name: 'video', type: 'media', description: 'Avatar video', mediaType: 'video/mp4', dimensions: { width: 1920, height: 1080 } },
    { name: 'verticalVideo', type: 'media', description: 'Vertical version', mediaType: 'video/mp4', dimensions: { width: 1080, height: 1920 } },
    { name: 'caption', type: 'text', description: 'Post caption' },
    { name: 'transcript', type: 'text', description: 'Video transcript' },
  ],
  variants: [
    { platform: 'youtube', format: 'video', dimensions: { width: 1920, height: 1080 }, maxDuration: 600 },
    { platform: 'instagram', format: 'reel', dimensions: { width: 1080, height: 1920 }, maxDuration: 90 },
    { platform: 'tiktok', format: 'video', dimensions: { width: 1080, height: 1920 }, maxDuration: 180 },
    { platform: 'linkedin', format: 'video', dimensions: { width: 1920, height: 1080 }, maxDuration: 600 },
  ],
  steps: [
    { name: 'prepareScript', type: 'agent', agent: 'copy', inputs: ['script', 'brandVoice'], outputs: ['preparedScript'] },
    { name: 'generateAvatar', type: 'agent', agent: 'media', inputs: ['avatarId', 'preparedScript', 'voiceId', 'background', 'customBackground'], outputs: ['video'], config: { provider: 'heygen' } },
    { name: 'createVertical', type: 'transform', inputs: ['video'], outputs: ['verticalVideo'], config: { aspectRatio: '9:16' } },
    { name: 'generateCaption', type: 'agent', agent: 'copy', inputs: ['script', 'brandVoice'], outputs: ['caption'] },
    { name: 'extractTranscript', type: 'transform', inputs: ['preparedScript'], outputs: ['transcript'] },
  ],
});

// BP-08: Skool Community Post + Comment Ops
export const skoolCommunityPostBlueprint: Blueprint = createBlueprint({
  slug: 'skool-community-post',
  name: 'Skool Community Post + Comment Ops',
  description: 'Community post with follow-up comment operations',
  category: 'engagement',
  platforms: ['skool'],
  tags: ['community', 'engagement', 'nurture'],
  estimatedDuration: 15,
  inputs: [
    { name: 'postType', type: 'select', required: true, description: 'Type of post', options: ['discussion', 'resource', 'win', 'question', 'announcement'] },
    { name: 'content', type: 'text', required: true, description: 'Post content', maxLength: 5000 },
    { name: 'media', type: 'media', required: false, description: 'Attached media', mediaTypes: ['image/png', 'image/jpeg', 'video/mp4'] },
    { name: 'commentPrompts', type: 'json', required: false, description: 'Prompts for follow-up comments', schema: { type: 'array', items: { type: 'string' } } },
    { name: 'engagementGoal', type: 'select', required: false, description: 'Engagement goal', options: ['discussion', 'shares', 'wins', 'questions'] },
  ],
  outputs: [
    { name: 'post', type: 'json', description: 'Formatted post content', schema: { type: 'object' } },
    { name: 'commentOps', type: 'json', description: 'Scheduled comment operations', schema: { type: 'array', items: { type: 'object' } } },
    { name: 'engagementPlan', type: 'json', description: 'Engagement follow-up plan', schema: { type: 'object' } },
  ],
  variants: [
    { platform: 'skool', format: 'post', captionLimit: 10000 },
  ],
  steps: [
    { name: 'formatPost', type: 'agent', agent: 'copy', inputs: ['postType', 'content'], outputs: ['post'] },
    { name: 'generateCommentOps', type: 'agent', agent: 'copy', inputs: ['post', 'commentPrompts', 'engagementGoal'], outputs: ['commentOps'] },
    { name: 'createEngagementPlan', type: 'transform', inputs: ['post', 'commentOps', 'engagementGoal'], outputs: ['engagementPlan'] },
  ],
});

// BP-09: LinkedIn Document Post (Lead Magnet Carousel)
export const linkedinDocumentPostBlueprint: Blueprint = createBlueprint({
  slug: 'linkedin-document-post',
  name: 'LinkedIn Document Post (Lead Magnet Carousel)',
  description: 'Document carousel post for lead generation',
  category: 'educational',
  platforms: ['linkedin'],
  tags: ['lead-magnet', 'authority', 'b2b'],
  estimatedDuration: 45,
  inputs: [
    { name: 'leadMagnet', type: 'reference', required: false, description: 'Link to lead magnet', referenceType: 'knowledgeBase' },
    { name: 'topic', type: 'text', required: true, description: 'Document topic', maxLength: 200 },
    { name: 'slideContent', type: 'json', required: true, description: 'Content for each slide', schema: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } } } } },
    { name: 'cta', type: 'text', required: true, description: 'Call to action for lead capture', maxLength: 200 },
    { name: 'brandVoice', type: 'reference', required: false, description: 'Brand settings', referenceType: 'brandKit' },
  ],
  outputs: [
    { name: 'document', type: 'media', description: 'PDF document', mediaType: 'application/pdf' },
    { name: 'slides', type: 'json', description: 'Individual slide images', schema: { type: 'array', items: { type: 'object' } } },
    { name: 'caption', type: 'text', description: 'Post caption' },
    { name: 'hashtags', type: 'json', description: 'LinkedIn hashtags', schema: { type: 'array', items: { type: 'string' } } },
  ],
  variants: [
    { platform: 'linkedin', format: 'document', dimensions: { width: 1200, height: 1500 }, captionLimit: 3000 },
  ],
  steps: [
    { name: 'generateSlideContent', type: 'agent', agent: 'copy', inputs: ['topic', 'slideContent', 'cta', 'brandVoice'], outputs: ['slideCopy'] },
    { name: 'generateSlides', type: 'agent', agent: 'media', inputs: ['slideCopy', 'brandVoice'], outputs: ['slides'] },
    { name: 'compilePDF', type: 'transform', inputs: ['slides'], outputs: ['document'] },
    { name: 'generateCaption', type: 'agent', agent: 'copy', inputs: ['topic', 'cta', 'brandVoice'], outputs: ['caption', 'hashtags'] },
  ],
});

// BP-10: YouTube Shorts Template Remix
export const youtubeShortTemplateBlueprint: Blueprint = createBlueprint({
  slug: 'youtube-shorts-template',
  name: 'YouTube Shorts Template Remix',
  description: 'Remix existing video into YouTube Shorts format',
  category: 'short-form',
  platforms: ['youtube'],
  tags: ['remix', 'repurpose', 'shorts'],
  estimatedDuration: 30,
  inputs: [
    { name: 'sourceVideo', type: 'media', required: true, description: 'Source video to remix', mediaTypes: ['video/mp4', 'video/quicktime'] },
    { name: 'templateStyle', type: 'select', required: true, description: 'Remix template style', options: ['highlight-reel', 'quick-tips', 'reaction', 'tutorial-clip', 'hook-loop'] },
    { name: 'clipTimestamps', type: 'json', required: false, description: 'Specific timestamps to use', schema: { type: 'array', items: { type: 'object', properties: { start: { type: 'number' }, end: { type: 'number' } } } } },
    { name: 'addCaptions', type: 'boolean', required: false, description: 'Add auto-captions', default: true },
    { name: 'brandVoice', type: 'reference', required: false, description: 'Brand settings', referenceType: 'brandKit' },
  ],
  outputs: [
    { name: 'video', type: 'media', description: 'Remixed short', mediaType: 'video/mp4', dimensions: { width: 1080, height: 1920 } },
    { name: 'title', type: 'text', description: 'Short title' },
    { name: 'description', type: 'text', description: 'Short description' },
  ],
  variants: [
    { platform: 'youtube', format: 'short', dimensions: { width: 1080, height: 1920 }, maxDuration: 60, captionLimit: 100 },
  ],
  steps: [
    { name: 'analyzeSource', type: 'transform', inputs: ['sourceVideo', 'templateStyle', 'clipTimestamps'], outputs: ['clipPlan'] },
    { name: 'extractClips', type: 'transform', inputs: ['sourceVideo', 'clipPlan'], outputs: ['clips'] },
    { name: 'applyTemplate', type: 'agent', agent: 'media', inputs: ['clips', 'templateStyle', 'brandVoice'], outputs: ['video'] },
    { name: 'addCaptions', type: 'transform', condition: '${addCaptions} === true', inputs: ['video'], outputs: ['captionedVideo'] },
    { name: 'generateMetadata', type: 'agent', agent: 'copy', inputs: ['video', 'brandVoice'], outputs: ['title', 'description'] },
  ],
});

// BP-11: Comment-to-DM Automation ("Keyword Router")
export const commentToDmAutomationBlueprint: Blueprint = createBlueprint({
  slug: 'comment-to-dm-automation',
  name: 'Comment-to-DM Automation (Keyword Router)',
  description: 'Automated DM response based on comment keywords',
  category: 'automation',
  platforms: ['instagram', 'facebook'],
  tags: ['automation', 'leads', 'engagement'],
  estimatedDuration: 15,
  inputs: [
    { name: 'keywords', type: 'json', required: true, description: 'Trigger keywords with responses', schema: { type: 'array', items: { type: 'object', properties: { keyword: { type: 'string' }, dmTemplate: { type: 'string' }, offer: { type: 'string' } } } } },
    { name: 'defaultResponse', type: 'text', required: false, description: 'Default DM if no keyword matches', maxLength: 500 },
    { name: 'postId', type: 'text', required: false, description: 'Specific post to monitor' },
    { name: 'offer', type: 'reference', required: false, description: 'Default offer to include', referenceType: 'offer' },
    { name: 'brandVoice', type: 'reference', required: false, description: 'Brand settings', referenceType: 'brandKit' },
  ],
  outputs: [
    { name: 'automationConfig', type: 'json', description: 'Automation configuration', schema: { type: 'object' } },
    { name: 'dmTemplates', type: 'json', description: 'Generated DM templates', schema: { type: 'array', items: { type: 'object' } } },
    { name: 'testReport', type: 'json', description: 'Keyword test results', schema: { type: 'object' } },
  ],
  variants: [
    { platform: 'instagram', format: 'automation' },
    { platform: 'facebook', format: 'automation' },
  ],
  steps: [
    { name: 'generateDmTemplates', type: 'agent', agent: 'copy', inputs: ['keywords', 'offer', 'brandVoice'], outputs: ['dmTemplates'] },
    { name: 'buildConfig', type: 'transform', inputs: ['keywords', 'dmTemplates', 'defaultResponse', 'postId'], outputs: ['automationConfig'] },
    { name: 'testKeywords', type: 'transform', inputs: ['automationConfig'], outputs: ['testReport'] },
  ],
});

// BP-12: Community Poll / Question Post (Engagement Seeder)
export const communityPollBlueprint: Blueprint = createBlueprint({
  slug: 'community-poll-question',
  name: 'Community Poll / Question Post (Engagement Seeder)',
  description: 'Engagement-focused poll or question post',
  category: 'engagement',
  platforms: ['instagram', 'linkedin', 'x', 'facebook'],
  tags: ['engagement', 'community', 'research'],
  estimatedDuration: 10,
  inputs: [
    { name: 'question', type: 'text', required: true, description: 'Poll question', maxLength: 200 },
    { name: 'options', type: 'json', required: false, description: 'Poll options (2-4)', schema: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 } },
    { name: 'context', type: 'text', required: false, description: 'Additional context', maxLength: 500 },
    { name: 'followUpQuestion', type: 'text', required: false, description: 'Follow-up question for comments', maxLength: 200 },
    { name: 'brandVoice', type: 'reference', required: false, description: 'Brand settings', referenceType: 'brandKit' },
  ],
  outputs: [
    { name: 'post', type: 'json', description: 'Formatted poll/question post', schema: { type: 'object' } },
    { name: 'caption', type: 'text', description: 'Post caption' },
    { name: 'image', type: 'media', description: 'Optional poll graphic', mediaType: 'image/png', dimensions: { width: 1080, height: 1080 } },
    { name: 'engagementPlan', type: 'json', description: 'Comment engagement plan', schema: { type: 'object' } },
  ],
  variants: [
    { platform: 'instagram', format: 'feed', dimensions: { width: 1080, height: 1080 }, captionLimit: 2200 },
    { platform: 'linkedin', format: 'poll', captionLimit: 3000 },
    { platform: 'x', format: 'poll', captionLimit: 280 },
    { platform: 'facebook', format: 'poll', captionLimit: 63206 },
  ],
  steps: [
    { name: 'formatPost', type: 'agent', agent: 'copy', inputs: ['question', 'options', 'context', 'brandVoice'], outputs: ['post', 'caption'] },
    { name: 'generateImage', type: 'agent', agent: 'media', inputs: ['question', 'options', 'brandVoice'], outputs: ['image'] },
    { name: 'createEngagementPlan', type: 'transform', inputs: ['post', 'followUpQuestion'], outputs: ['engagementPlan'] },
  ],
});

// Export all blueprints
export const mvpBlueprints7to12 = [
  heygenAvatarExplainerBlueprint,
  skoolCommunityPostBlueprint,
  linkedinDocumentPostBlueprint,
  youtubeShortTemplateBlueprint,
  commentToDmAutomationBlueprint,
  communityPollBlueprint,
];
```

**File:** Update `packages/blueprint/src/blueprints/index.ts`

```typescript
export * from './mvp-1-6';
export * from './mvp-7-12';

import { mvpBlueprints1to6 } from './mvp-1-6';
import { mvpBlueprints7to12 } from './mvp-7-12';

export const allMvpBlueprints = [...mvpBlueprints1to6, ...mvpBlueprints7to12];
```

### Phase 3: Verification

```bash
cd packages/blueprint
pnpm test src/blueprints/
pnpm typecheck
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/blueprint/src/blueprints/mvp-7-12.ts` | Blueprint definitions |
| Create | `packages/blueprint/src/blueprints/mvp-7-12.test.ts` | Unit tests |
| Modify | `packages/blueprint/src/blueprints/index.ts` | Add exports |

---

## Acceptance Criteria

- [ ] BP-07 (HeyGen Avatar) has avatarId, script inputs
- [ ] BP-07 outputs video and vertical video versions
- [ ] BP-08 (Skool) has postType and commentOps output
- [ ] BP-09 (LinkedIn Doc) outputs PDF and slides
- [ ] BP-10 (YouTube Shorts) accepts sourceVideo for remix
- [ ] BP-11 (Comment-to-DM) has keywords array with responses
- [ ] BP-12 (Poll) supports 2-4 options
- [ ] All blueprints pass validation
- [ ] All blueprints have platform variants
- [ ] All unit tests pass

---

## JSON Task Block

```json
{
  "task_id": "S2-B5",
  "name": "MVP Blueprints (7-12)",
  "sprint": 2,
  "agent": "B",
  "status": "pending",
  "complexity": "high",
  "estimated_tokens": 6000,
  "dependencies": ["S2-B3"],
  "blocks": ["S3-B1"],
  "outputs": {
    "files": [
      "packages/blueprint/src/blueprints/mvp-7-12.ts",
      "packages/blueprint/src/blueprints/mvp-7-12.test.ts"
    ],
    "exports": [
      "heygenAvatarExplainerBlueprint",
      "skoolCommunityPostBlueprint",
      "linkedinDocumentPostBlueprint",
      "youtubeShortTemplateBlueprint",
      "commentToDmAutomationBlueprint",
      "communityPollBlueprint"
    ]
  }
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "last_checkpoint": null,
  "execution_notes": [],
  "blockers_encountered": [],
  "decisions_made": []
}
```
