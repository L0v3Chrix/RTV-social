# Build Prompt: S2-B4 — MVP Blueprints (1-6)

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-B4 |
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

The first 6 MVP blueprints covering the most common content types:

1. **Hook → Value → CTA Reel** — Short-form video pattern
2. **Educational Carousel** — Saveable swipe file
3. **Story Sequence + DM** — Story with keyword trigger
4. **UGC/Testimonial Reel** — Proof stack video
5. **Offer Reel** — Paid-ready promotional content
6. **VSL Segment Series** — Script-driven video series

### Why It Matters

These blueprints cover the core content patterns needed for MVP launch. They define the inputs, outputs, variants, and execution steps for each content type.

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

**File:** `packages/blueprint/src/blueprints/mvp-1-6.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  hookValueCtaReelBlueprint,
  educationalCarouselBlueprint,
  storySequenceDMBlueprint,
  ugcTestimonialReelBlueprint,
  offerReelBlueprint,
  vslSegmentSeriesBlueprint,
} from './mvp-1-6';
import { validateBlueprint } from '../schema/blueprint-schema';

describe('MVP Blueprints 1-6', () => {
  describe('BP-01: Hook Value CTA Reel', () => {
    const bp = hookValueCtaReelBlueprint;

    it('should have correct slug', () => {
      expect(bp.slug).toBe('hook-value-cta-reel');
    });

    it('should support instagram, tiktok, youtube', () => {
      expect(bp.platforms).toContain('instagram');
      expect(bp.platforms).toContain('tiktok');
      expect(bp.platforms).toContain('youtube');
    });

    it('should have required inputs', () => {
      const inputNames = bp.inputs.map((i) => i.name);
      expect(inputNames).toContain('hook');
      expect(inputNames).toContain('valuePoints');
      expect(inputNames).toContain('cta');
    });

    it('should have video and caption outputs', () => {
      const outputNames = bp.outputs.map((o) => o.name);
      expect(outputNames).toContain('video');
      expect(outputNames).toContain('caption');
    });

    it('should have platform variants', () => {
      expect(bp.variants.length).toBeGreaterThanOrEqual(3);
      expect(bp.variants.some((v) => v.platform === 'instagram')).toBe(true);
      expect(bp.variants.some((v) => v.platform === 'tiktok')).toBe(true);
    });

    it('should pass validation', () => {
      expect(() => validateBlueprint(bp)).not.toThrow();
    });
  });

  describe('BP-02: Educational Carousel', () => {
    const bp = educationalCarouselBlueprint;

    it('should have correct slug', () => {
      expect(bp.slug).toBe('educational-carousel');
    });

    it('should support instagram, linkedin', () => {
      expect(bp.platforms).toContain('instagram');
      expect(bp.platforms).toContain('linkedin');
    });

    it('should have slide-based inputs', () => {
      const inputNames = bp.inputs.map((i) => i.name);
      expect(inputNames).toContain('topic');
      expect(inputNames).toContain('slideCount');
      expect(inputNames).toContain('takeaways');
    });

    it('should output slides array', () => {
      const outputNames = bp.outputs.map((o) => o.name);
      expect(outputNames).toContain('slides');
      expect(outputNames).toContain('caption');
    });

    it('should pass validation', () => {
      expect(() => validateBlueprint(bp)).not.toThrow();
    });
  });

  describe('BP-03: Story Sequence + DM', () => {
    const bp = storySequenceDMBlueprint;

    it('should have correct slug', () => {
      expect(bp.slug).toBe('story-sequence-dm');
    });

    it('should support instagram', () => {
      expect(bp.platforms).toContain('instagram');
    });

    it('should have keyword trigger input', () => {
      const inputNames = bp.inputs.map((i) => i.name);
      expect(inputNames).toContain('triggerKeyword');
      expect(inputNames).toContain('storyFrames');
    });

    it('should output stories and automation config', () => {
      const outputNames = bp.outputs.map((o) => o.name);
      expect(outputNames).toContain('stories');
      expect(outputNames).toContain('automationConfig');
    });

    it('should pass validation', () => {
      expect(() => validateBlueprint(bp)).not.toThrow();
    });
  });

  describe('BP-04: UGC/Testimonial Reel', () => {
    const bp = ugcTestimonialReelBlueprint;

    it('should have correct slug', () => {
      expect(bp.slug).toBe('ugc-testimonial-reel');
    });

    it('should have testimonial inputs', () => {
      const inputNames = bp.inputs.map((i) => i.name);
      expect(inputNames).toContain('testimonials');
      expect(inputNames).toContain('resultMetrics');
    });

    it('should have social proof category', () => {
      expect(bp.category).toBe('testimonial');
    });

    it('should pass validation', () => {
      expect(() => validateBlueprint(bp)).not.toThrow();
    });
  });

  describe('BP-05: Offer Reel', () => {
    const bp = offerReelBlueprint;

    it('should have correct slug', () => {
      expect(bp.slug).toBe('offer-reel');
    });

    it('should have offer reference input', () => {
      const offerInput = bp.inputs.find((i) => i.name === 'offer');
      expect(offerInput).toBeDefined();
      expect(offerInput?.type).toBe('reference');
      expect(offerInput?.referenceType).toBe('offer');
    });

    it('should have promotional category', () => {
      expect(bp.category).toBe('promotional');
    });

    it('should pass validation', () => {
      expect(() => validateBlueprint(bp)).not.toThrow();
    });
  });

  describe('BP-06: VSL Segment Series', () => {
    const bp = vslSegmentSeriesBlueprint;

    it('should have correct slug', () => {
      expect(bp.slug).toBe('vsl-segment-series');
    });

    it('should have script input', () => {
      const inputNames = bp.inputs.map((i) => i.name);
      expect(inputNames).toContain('script');
      expect(inputNames).toContain('segmentCount');
    });

    it('should output video segments', () => {
      const outputNames = bp.outputs.map((o) => o.name);
      expect(outputNames).toContain('segments');
    });

    it('should support youtube', () => {
      expect(bp.platforms).toContain('youtube');
    });

    it('should pass validation', () => {
      expect(() => validateBlueprint(bp)).not.toThrow();
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/blueprint/src/blueprints/mvp-1-6.ts`

```typescript
import { Blueprint, createBlueprint } from '../schema/blueprint-schema';

// BP-01: Hook → Value → CTA Reel
export const hookValueCtaReelBlueprint: Blueprint = createBlueprint({
  slug: 'hook-value-cta-reel',
  name: 'Hook → Value → CTA Reel',
  description: 'Short-form video with attention hook, value delivery, and call-to-action',
  category: 'short-form',
  platforms: ['instagram', 'tiktok', 'youtube'],
  tags: ['viral', 'engagement', 'conversion'],
  estimatedDuration: 30,
  inputs: [
    { name: 'hook', type: 'text', required: true, description: 'Attention-grabbing opening (2-5 seconds)', maxLength: 100 },
    { name: 'valuePoints', type: 'json', required: true, description: 'Array of value points to deliver', schema: { type: 'array', items: { type: 'string' } } },
    { name: 'cta', type: 'text', required: true, description: 'Call to action', maxLength: 150 },
    { name: 'brandVoice', type: 'reference', required: false, description: 'Brand voice settings', referenceType: 'brandKit' },
    { name: 'offer', type: 'reference', required: false, description: 'Linked offer for CTA', referenceType: 'offer' },
    { name: 'backgroundMusic', type: 'select', required: false, description: 'Music style', options: ['upbeat', 'calm', 'dramatic', 'none'] },
  ],
  outputs: [
    { name: 'video', type: 'media', description: 'Generated video', mediaType: 'video/mp4', dimensions: { width: 1080, height: 1920 } },
    { name: 'caption', type: 'text', description: 'Post caption' },
    { name: 'hashtags', type: 'json', description: 'Recommended hashtags', schema: { type: 'array', items: { type: 'string' } } },
    { name: 'thumbnail', type: 'media', description: 'Video thumbnail', mediaType: 'image/png', dimensions: { width: 1080, height: 1920 } },
  ],
  variants: [
    { platform: 'instagram', format: 'reel', dimensions: { width: 1080, height: 1920 }, maxDuration: 90, captionLimit: 2200, hashtagLimit: 30 },
    { platform: 'tiktok', format: 'video', dimensions: { width: 1080, height: 1920 }, maxDuration: 180, captionLimit: 4000, hashtagLimit: 100 },
    { platform: 'youtube', format: 'short', dimensions: { width: 1080, height: 1920 }, maxDuration: 60, captionLimit: 100 },
  ],
  steps: [
    { name: 'generateScript', type: 'agent', agent: 'copy', inputs: ['hook', 'valuePoints', 'cta', 'brandVoice'], outputs: ['script'] },
    { name: 'generateCaption', type: 'agent', agent: 'copy', inputs: ['script', 'brandVoice'], outputs: ['caption', 'hashtags'] },
    { name: 'generateVisuals', type: 'agent', agent: 'media', inputs: ['script', 'brandVoice'], outputs: ['video', 'thumbnail'] },
  ],
});

// BP-02: Educational Carousel
export const educationalCarouselBlueprint: Blueprint = createBlueprint({
  slug: 'educational-carousel',
  name: 'Educational Carousel (Saveable Swipe File)',
  description: 'Multi-slide carousel with educational content designed for saves',
  category: 'carousel',
  platforms: ['instagram', 'linkedin'],
  tags: ['educational', 'saves', 'authority'],
  estimatedDuration: 45,
  inputs: [
    { name: 'topic', type: 'text', required: true, description: 'Main topic/title', maxLength: 100 },
    { name: 'slideCount', type: 'number', required: true, description: 'Number of slides (5-10)', min: 5, max: 10, default: 7 },
    { name: 'takeaways', type: 'json', required: true, description: 'Key takeaways', schema: { type: 'array', items: { type: 'string' } } },
    { name: 'brandVoice', type: 'reference', required: false, description: 'Brand settings', referenceType: 'brandKit' },
    { name: 'ctaSlide', type: 'boolean', required: false, description: 'Include CTA slide', default: true },
  ],
  outputs: [
    { name: 'slides', type: 'json', description: 'Array of slide images', schema: { type: 'array', items: { type: 'object' } } },
    { name: 'caption', type: 'text', description: 'Post caption' },
    { name: 'altTexts', type: 'json', description: 'Alt text for each slide', schema: { type: 'array', items: { type: 'string' } } },
  ],
  variants: [
    { platform: 'instagram', format: 'carousel', dimensions: { width: 1080, height: 1350 }, captionLimit: 2200 },
    { platform: 'linkedin', format: 'document', dimensions: { width: 1200, height: 1500 }, captionLimit: 3000 },
  ],
  steps: [
    { name: 'generateOutline', type: 'agent', agent: 'copy', inputs: ['topic', 'takeaways', 'slideCount'], outputs: ['slideOutline'] },
    { name: 'generateCopy', type: 'agent', agent: 'copy', inputs: ['slideOutline', 'brandVoice'], outputs: ['slideCopy', 'caption'] },
    { name: 'generateSlides', type: 'agent', agent: 'media', inputs: ['slideCopy', 'brandVoice'], outputs: ['slides', 'altTexts'] },
  ],
});

// BP-03: Story Sequence + DM
export const storySequenceDMBlueprint: Blueprint = createBlueprint({
  slug: 'story-sequence-dm',
  name: 'Story Sequence + DM Keyword Trigger',
  description: 'Multi-frame story with automated DM response on keyword',
  category: 'story',
  platforms: ['instagram'],
  tags: ['engagement', 'automation', 'leads'],
  estimatedDuration: 20,
  inputs: [
    { name: 'storyFrames', type: 'json', required: true, description: 'Story frame content', schema: { type: 'array', items: { type: 'object' } } },
    { name: 'triggerKeyword', type: 'text', required: true, description: 'Keyword to trigger DM', maxLength: 50 },
    { name: 'dmMessage', type: 'text', required: true, description: 'Automated DM response', maxLength: 500 },
    { name: 'offer', type: 'reference', required: false, description: 'Linked offer', referenceType: 'offer' },
    { name: 'brandVoice', type: 'reference', required: false, description: 'Brand settings', referenceType: 'brandKit' },
  ],
  outputs: [
    { name: 'stories', type: 'json', description: 'Array of story assets', schema: { type: 'array', items: { type: 'object' } } },
    { name: 'automationConfig', type: 'json', description: 'DM automation configuration', schema: { type: 'object' } },
  ],
  variants: [
    { platform: 'instagram', format: 'story', dimensions: { width: 1080, height: 1920 }, maxDuration: 15 },
  ],
  steps: [
    { name: 'generateStoryContent', type: 'agent', agent: 'copy', inputs: ['storyFrames', 'triggerKeyword', 'brandVoice'], outputs: ['storyText'] },
    { name: 'generateStoryAssets', type: 'agent', agent: 'media', inputs: ['storyText', 'brandVoice'], outputs: ['stories'] },
    { name: 'configureAutomation', type: 'transform', inputs: ['triggerKeyword', 'dmMessage', 'offer'], outputs: ['automationConfig'] },
  ],
});

// BP-04: UGC/Testimonial Reel
export const ugcTestimonialReelBlueprint: Blueprint = createBlueprint({
  slug: 'ugc-testimonial-reel',
  name: 'UGC/Testimonial Reel (Proof Stack)',
  description: 'Testimonial compilation video for social proof',
  category: 'testimonial',
  platforms: ['instagram', 'tiktok', 'facebook'],
  tags: ['social-proof', 'trust', 'conversion'],
  estimatedDuration: 45,
  inputs: [
    { name: 'testimonials', type: 'json', required: true, description: 'Array of testimonials', schema: { type: 'array', items: { type: 'object', properties: { quote: { type: 'string' }, name: { type: 'string' }, result: { type: 'string' } } } } },
    { name: 'resultMetrics', type: 'json', required: false, description: 'Result metrics to highlight', schema: { type: 'array', items: { type: 'object' } } },
    { name: 'hook', type: 'text', required: true, description: 'Opening hook', maxLength: 100 },
    { name: 'cta', type: 'text', required: true, description: 'Call to action', maxLength: 150 },
    { name: 'brandVoice', type: 'reference', required: false, description: 'Brand settings', referenceType: 'brandKit' },
  ],
  outputs: [
    { name: 'video', type: 'media', description: 'Compiled testimonial video', mediaType: 'video/mp4' },
    { name: 'caption', type: 'text', description: 'Post caption' },
    { name: 'hashtags', type: 'json', description: 'Hashtags', schema: { type: 'array', items: { type: 'string' } } },
  ],
  variants: [
    { platform: 'instagram', format: 'reel', dimensions: { width: 1080, height: 1920 }, maxDuration: 90 },
    { platform: 'tiktok', format: 'video', dimensions: { width: 1080, height: 1920 }, maxDuration: 180 },
    { platform: 'facebook', format: 'reel', dimensions: { width: 1080, height: 1920 }, maxDuration: 90 },
  ],
  steps: [
    { name: 'generateScript', type: 'agent', agent: 'copy', inputs: ['testimonials', 'hook', 'cta', 'resultMetrics'], outputs: ['script'] },
    { name: 'generateCaption', type: 'agent', agent: 'copy', inputs: ['script', 'brandVoice'], outputs: ['caption', 'hashtags'] },
    { name: 'compileVideo', type: 'agent', agent: 'media', inputs: ['script', 'testimonials', 'brandVoice'], outputs: ['video'] },
  ],
});

// BP-05: Offer Reel
export const offerReelBlueprint: Blueprint = createBlueprint({
  slug: 'offer-reel',
  name: 'Offer Reel (Paid-Ready / Spark-Ready)',
  description: 'Promotional video for offers, ready for paid amplification',
  category: 'promotional',
  platforms: ['instagram', 'tiktok', 'facebook'],
  tags: ['paid', 'conversion', 'offer'],
  estimatedDuration: 30,
  inputs: [
    { name: 'offer', type: 'reference', required: true, description: 'Offer to promote', referenceType: 'offer' },
    { name: 'hook', type: 'text', required: true, description: 'Attention hook', maxLength: 100 },
    { name: 'benefits', type: 'json', required: true, description: 'Key benefits', schema: { type: 'array', items: { type: 'string' } } },
    { name: 'urgency', type: 'text', required: false, description: 'Urgency/scarcity element', maxLength: 100 },
    { name: 'brandVoice', type: 'reference', required: false, description: 'Brand settings', referenceType: 'brandKit' },
  ],
  outputs: [
    { name: 'video', type: 'media', description: 'Promotional video', mediaType: 'video/mp4' },
    { name: 'caption', type: 'text', description: 'Post caption' },
    { name: 'adCopy', type: 'json', description: 'Ad copy variants', schema: { type: 'object', properties: { primary: { type: 'string' }, headline: { type: 'string' }, description: { type: 'string' } } } },
  ],
  variants: [
    { platform: 'instagram', format: 'reel', dimensions: { width: 1080, height: 1920 }, maxDuration: 60 },
    { platform: 'tiktok', format: 'spark', dimensions: { width: 1080, height: 1920 }, maxDuration: 60 },
    { platform: 'facebook', format: 'reel', dimensions: { width: 1080, height: 1920 }, maxDuration: 60 },
  ],
  steps: [
    { name: 'generateScript', type: 'agent', agent: 'copy', inputs: ['offer', 'hook', 'benefits', 'urgency'], outputs: ['script'] },
    { name: 'generateCaption', type: 'agent', agent: 'copy', inputs: ['script', 'brandVoice'], outputs: ['caption'] },
    { name: 'generateAdCopy', type: 'agent', agent: 'copy', inputs: ['offer', 'benefits'], outputs: ['adCopy'] },
    { name: 'generateVideo', type: 'agent', agent: 'media', inputs: ['script', 'offer', 'brandVoice'], outputs: ['video'] },
  ],
});

// BP-06: VSL Segment Series
export const vslSegmentSeriesBlueprint: Blueprint = createBlueprint({
  slug: 'vsl-segment-series',
  name: 'VSL Segment Series (Script-Driven)',
  description: 'Multi-part video series from VSL script',
  category: 'long-form',
  platforms: ['youtube', 'instagram', 'tiktok'],
  tags: ['vsl', 'series', 'educational'],
  estimatedDuration: 120,
  inputs: [
    { name: 'script', type: 'text', required: true, description: 'Full VSL script', maxLength: 10000 },
    { name: 'segmentCount', type: 'number', required: true, description: 'Number of segments (3-10)', min: 3, max: 10, default: 5 },
    { name: 'offer', type: 'reference', required: false, description: 'Linked offer', referenceType: 'offer' },
    { name: 'brandVoice', type: 'reference', required: false, description: 'Brand settings', referenceType: 'brandKit' },
    { name: 'avatarId', type: 'text', required: false, description: 'HeyGen avatar ID for talking head' },
  ],
  outputs: [
    { name: 'segments', type: 'json', description: 'Array of video segments', schema: { type: 'array', items: { type: 'object' } } },
    { name: 'captions', type: 'json', description: 'Caption for each segment', schema: { type: 'array', items: { type: 'string' } } },
    { name: 'fullVideo', type: 'media', description: 'Full concatenated video', mediaType: 'video/mp4' },
  ],
  variants: [
    { platform: 'youtube', format: 'short', dimensions: { width: 1080, height: 1920 }, maxDuration: 60 },
    { platform: 'instagram', format: 'reel', dimensions: { width: 1080, height: 1920 }, maxDuration: 90 },
    { platform: 'tiktok', format: 'video', dimensions: { width: 1080, height: 1920 }, maxDuration: 180 },
  ],
  steps: [
    { name: 'splitScript', type: 'transform', inputs: ['script', 'segmentCount'], outputs: ['scriptSegments'] },
    { name: 'generateCaptions', type: 'agent', agent: 'copy', inputs: ['scriptSegments', 'brandVoice'], outputs: ['captions'] },
    { name: 'generateSegments', type: 'parallel', steps: [
      { name: 'generateVideoSegment', type: 'agent', agent: 'media', inputs: ['scriptSegments', 'brandVoice', 'avatarId'], outputs: ['segments'] },
    ]},
    { name: 'concatenate', type: 'transform', inputs: ['segments'], outputs: ['fullVideo'] },
  ],
});

// Export all blueprints
export const mvpBlueprints1to6 = [
  hookValueCtaReelBlueprint,
  educationalCarouselBlueprint,
  storySequenceDMBlueprint,
  ugcTestimonialReelBlueprint,
  offerReelBlueprint,
  vslSegmentSeriesBlueprint,
];
```

**File:** `packages/blueprint/src/blueprints/index.ts`

```typescript
export * from './mvp-1-6';
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
| Create | `packages/blueprint/src/blueprints/mvp-1-6.ts` | Blueprint definitions |
| Create | `packages/blueprint/src/blueprints/mvp-1-6.test.ts` | Unit tests |
| Create | `packages/blueprint/src/blueprints/index.ts` | Module exports |

---

## Acceptance Criteria

- [ ] BP-01 (Hook Value CTA) has hook, valuePoints, cta inputs
- [ ] BP-01 outputs video, caption, hashtags, thumbnail
- [ ] BP-02 (Carousel) supports 5-10 slides
- [ ] BP-02 outputs slides array with alt texts
- [ ] BP-03 (Story + DM) has triggerKeyword and automationConfig
- [ ] BP-04 (UGC Testimonial) accepts testimonials array
- [ ] BP-05 (Offer Reel) references Offer entity
- [ ] BP-06 (VSL Series) splits script into segments
- [ ] All blueprints pass validation
- [ ] All blueprints have platform variants
- [ ] All unit tests pass

---

## JSON Task Block

```json
{
  "task_id": "S2-B4",
  "name": "MVP Blueprints (1-6)",
  "sprint": 2,
  "agent": "B",
  "status": "pending",
  "complexity": "high",
  "estimated_tokens": 6000,
  "dependencies": ["S2-B3"],
  "blocks": ["S3-B1"],
  "outputs": {
    "files": [
      "packages/blueprint/src/blueprints/mvp-1-6.ts",
      "packages/blueprint/src/blueprints/mvp-1-6.test.ts"
    ],
    "exports": [
      "hookValueCtaReelBlueprint",
      "educationalCarouselBlueprint",
      "storySequenceDMBlueprint",
      "ugcTestimonialReelBlueprint",
      "offerReelBlueprint",
      "vslSegmentSeriesBlueprint"
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
