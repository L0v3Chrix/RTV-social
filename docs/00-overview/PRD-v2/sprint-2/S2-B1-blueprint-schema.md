# Build Prompt: S2-B1 — Blueprint Schema

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-B1 |
| Sprint | 2 |
| Agent | B (Blueprint Definitions) |
| Complexity | High |
| Status | pending |
| Estimated Tokens | 5,500 |
| Depends On | S1-A3 |
| Blocks | S2-B2, S2-B3, S2-D1 |

---

## Context

### What We're Building

The Blueprint schema defines the structure for creative templates. A Blueprint specifies: inputs (what the agent needs), outputs (what it produces), variants (platform-specific adaptations), and execution steps. Blueprints are the reusable patterns for content creation.

### Why It Matters

Blueprints enable:
- Consistent, repeatable content creation
- Multi-platform adaptation from single creative
- Clear contracts between planning and creation
- Agent-executable content specifications

### Spec References

- Architecture: `/docs/01-architecture/system-architecture-v3.md` (Blueprints)
- Agent Contracts: `/docs/03-agents-tools/agent-recursion-contracts.md`
- Engineering: `/docs/07-engineering-process/engineering-handbook.md`

---

## Prerequisites

### Completed Tasks
- [x] S1-A3: KnowledgeBase entity model

### Required Packages
```bash
pnpm add zod nanoid
pnpm add -D vitest
```

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/blueprint/src/schema/blueprint-schema.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  Blueprint,
  BlueprintSchema,
  BlueprintInput,
  BlueprintOutput,
  BlueprintVariant,
  BlueprintStep,
  validateBlueprint,
  createBlueprint,
} from './blueprint-schema';

describe('BlueprintSchema', () => {
  describe('BlueprintInput', () => {
    it('should define required text input', () => {
      const input: BlueprintInput = {
        name: 'hook',
        type: 'text',
        required: true,
        description: 'The opening hook for the content',
        maxLength: 100,
      };

      expect(input.name).toBe('hook');
      expect(input.required).toBe(true);
    });

    it('should define optional media input', () => {
      const input: BlueprintInput = {
        name: 'backgroundImage',
        type: 'media',
        required: false,
        description: 'Optional background image',
        mediaTypes: ['image/png', 'image/jpeg'],
      };

      expect(input.type).toBe('media');
      expect(input.mediaTypes).toContain('image/png');
    });

    it('should define select input with options', () => {
      const input: BlueprintInput = {
        name: 'tone',
        type: 'select',
        required: true,
        description: 'Content tone',
        options: ['professional', 'casual', 'humorous'],
        default: 'professional',
      };

      expect(input.type).toBe('select');
      expect(input.options).toHaveLength(3);
    });

    it('should define reference input to other entities', () => {
      const input: BlueprintInput = {
        name: 'offer',
        type: 'reference',
        required: false,
        description: 'Linked offer for CTA',
        referenceType: 'offer',
      };

      expect(input.type).toBe('reference');
      expect(input.referenceType).toBe('offer');
    });
  });

  describe('BlueprintOutput', () => {
    it('should define caption output', () => {
      const output: BlueprintOutput = {
        name: 'caption',
        type: 'text',
        description: 'Generated caption',
      };

      expect(output.name).toBe('caption');
      expect(output.type).toBe('text');
    });

    it('should define media output', () => {
      const output: BlueprintOutput = {
        name: 'video',
        type: 'media',
        description: 'Generated video',
        mediaType: 'video/mp4',
        dimensions: { width: 1080, height: 1920 },
      };

      expect(output.mediaType).toBe('video/mp4');
      expect(output.dimensions?.height).toBe(1920);
    });

    it('should define structured output', () => {
      const output: BlueprintOutput = {
        name: 'metadata',
        type: 'json',
        description: 'Content metadata',
        schema: {
          type: 'object',
          properties: {
            hashtags: { type: 'array' },
            mentions: { type: 'array' },
          },
        },
      };

      expect(output.type).toBe('json');
      expect(output.schema).toBeDefined();
    });
  });

  describe('BlueprintVariant', () => {
    it('should define platform-specific variant', () => {
      const variant: BlueprintVariant = {
        platform: 'instagram',
        format: 'reel',
        dimensions: { width: 1080, height: 1920 },
        maxDuration: 90,
        captionLimit: 2200,
        hashtagLimit: 30,
      };

      expect(variant.platform).toBe('instagram');
      expect(variant.format).toBe('reel');
    });

    it('should define TikTok variant', () => {
      const variant: BlueprintVariant = {
        platform: 'tiktok',
        format: 'video',
        dimensions: { width: 1080, height: 1920 },
        maxDuration: 180,
        captionLimit: 4000,
        hashtagLimit: 100,
      };

      expect(variant.maxDuration).toBe(180);
    });

    it('should define YouTube Shorts variant', () => {
      const variant: BlueprintVariant = {
        platform: 'youtube',
        format: 'short',
        dimensions: { width: 1080, height: 1920 },
        maxDuration: 60,
        captionLimit: 100,
      };

      expect(variant.format).toBe('short');
    });
  });

  describe('BlueprintStep', () => {
    it('should define copy generation step', () => {
      const step: BlueprintStep = {
        name: 'generateCaption',
        type: 'agent',
        agent: 'copy',
        inputs: ['hook', 'brandVoice', 'offer'],
        outputs: ['caption', 'hashtags'],
        config: {
          maxTokens: 500,
          temperature: 0.7,
        },
      };

      expect(step.type).toBe('agent');
      expect(step.agent).toBe('copy');
    });

    it('should define media generation step', () => {
      const step: BlueprintStep = {
        name: 'generateImage',
        type: 'agent',
        agent: 'media',
        inputs: ['imagePrompt', 'brandColors'],
        outputs: ['image'],
        config: {
          provider: 'dalle',
          size: '1024x1024',
        },
      };

      expect(step.agent).toBe('media');
    });

    it('should define conditional step', () => {
      const step: BlueprintStep = {
        name: 'addWatermark',
        type: 'transform',
        condition: '${hasWatermark} === true',
        inputs: ['image', 'watermarkLogo'],
        outputs: ['watermarkedImage'],
      };

      expect(step.condition).toBeDefined();
    });

    it('should define parallel steps', () => {
      const step: BlueprintStep = {
        name: 'generateVariants',
        type: 'parallel',
        steps: [
          { name: 'igVariant', type: 'agent', agent: 'media', inputs: ['prompt'], outputs: ['igImage'] },
          { name: 'ttVariant', type: 'agent', agent: 'media', inputs: ['prompt'], outputs: ['ttImage'] },
        ],
      };

      expect(step.type).toBe('parallel');
      expect(step.steps).toHaveLength(2);
    });
  });

  describe('Blueprint', () => {
    it('should create a valid blueprint', () => {
      const blueprint = createBlueprint({
        slug: 'hook-value-cta-reel',
        name: 'Hook → Value → CTA Reel',
        description: 'Short-form video with hook, value delivery, and call-to-action',
        category: 'short-form',
        platforms: ['instagram', 'tiktok', 'youtube'],
        inputs: [
          { name: 'hook', type: 'text', required: true, description: 'Opening hook' },
          { name: 'value', type: 'text', required: true, description: 'Value proposition' },
          { name: 'cta', type: 'text', required: true, description: 'Call to action' },
        ],
        outputs: [
          { name: 'video', type: 'media', description: 'Generated video', mediaType: 'video/mp4' },
          { name: 'caption', type: 'text', description: 'Post caption' },
        ],
        variants: [
          { platform: 'instagram', format: 'reel', dimensions: { width: 1080, height: 1920 } },
          { platform: 'tiktok', format: 'video', dimensions: { width: 1080, height: 1920 } },
        ],
        steps: [
          { name: 'generateCaption', type: 'agent', agent: 'copy', inputs: ['hook', 'value', 'cta'], outputs: ['caption'] },
        ],
      });

      expect(blueprint.id).toMatch(/^bp_/);
      expect(blueprint.slug).toBe('hook-value-cta-reel');
      expect(blueprint.version).toBe(1);
    });

    it('should validate blueprint schema', () => {
      const validBlueprint = {
        slug: 'test-blueprint',
        name: 'Test Blueprint',
        description: 'A test',
        category: 'test',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      };

      expect(() => BlueprintSchema.parse(validBlueprint)).not.toThrow();
    });

    it('should reject invalid blueprint', () => {
      const invalid = {
        slug: '', // Invalid: empty slug
        name: 'Test',
      };

      expect(() => BlueprintSchema.parse(invalid)).toThrow();
    });
  });

  describe('validateBlueprint', () => {
    it('should validate input/output consistency in steps', () => {
      const blueprint = createBlueprint({
        slug: 'test',
        name: 'Test',
        description: 'Test',
        category: 'test',
        platforms: ['instagram'],
        inputs: [
          { name: 'text', type: 'text', required: true, description: 'Input text' },
        ],
        outputs: [
          { name: 'result', type: 'text', description: 'Output' },
        ],
        variants: [],
        steps: [
          { name: 'process', type: 'agent', agent: 'copy', inputs: ['text'], outputs: ['result'] },
        ],
      });

      expect(() => validateBlueprint(blueprint)).not.toThrow();
    });

    it('should reject step referencing undefined input', () => {
      const blueprint = createBlueprint({
        slug: 'test',
        name: 'Test',
        description: 'Test',
        category: 'test',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [
          { name: 'process', type: 'agent', agent: 'copy', inputs: ['undefinedInput'], outputs: [] },
        ],
      });

      expect(() => validateBlueprint(blueprint)).toThrow('undefined input');
    });

    it('should reject duplicate output names', () => {
      const blueprint = createBlueprint({
        slug: 'test',
        name: 'Test',
        description: 'Test',
        category: 'test',
        platforms: ['instagram'],
        inputs: [],
        outputs: [
          { name: 'result', type: 'text', description: 'Output 1' },
          { name: 'result', type: 'text', description: 'Output 2' },
        ],
        variants: [],
        steps: [],
      });

      expect(() => validateBlueprint(blueprint)).toThrow('duplicate output');
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/blueprint/src/schema/types.ts`

```typescript
import { z } from 'zod';

// Input Types
export const InputTypeSchema = z.enum(['text', 'media', 'select', 'reference', 'number', 'boolean', 'json']);
export type InputType = z.infer<typeof InputTypeSchema>;

// Media Types
export const MediaTypeSchema = z.enum([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mp3', 'audio/wav', 'audio/m4a',
]);
export type MediaType = z.infer<typeof MediaTypeSchema>;

// Reference Types
export const ReferenceTypeSchema = z.enum(['client', 'brandKit', 'knowledgeBase', 'offer', 'asset']);
export type ReferenceType = z.infer<typeof ReferenceTypeSchema>;

// Platform
export const PlatformSchema = z.enum(['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'skool']);
export type Platform = z.infer<typeof PlatformSchema>;

// Dimensions
export const DimensionsSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});
export type Dimensions = z.infer<typeof DimensionsSchema>;

// Blueprint Input
export const BlueprintInputSchema = z.object({
  name: z.string().min(1).max(50),
  type: InputTypeSchema,
  required: z.boolean().default(true),
  description: z.string().max(500),
  default: z.unknown().optional(),
  // Type-specific fields
  maxLength: z.number().optional(),
  minLength: z.number().optional(),
  mediaTypes: z.array(MediaTypeSchema).optional(),
  options: z.array(z.string()).optional(),
  referenceType: ReferenceTypeSchema.optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  schema: z.record(z.unknown()).optional(),
});
export type BlueprintInput = z.infer<typeof BlueprintInputSchema>;

// Blueprint Output
export const BlueprintOutputSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['text', 'media', 'json']),
  description: z.string().max(500),
  // Type-specific fields
  mediaType: MediaTypeSchema.optional(),
  dimensions: DimensionsSchema.optional(),
  schema: z.record(z.unknown()).optional(),
});
export type BlueprintOutput = z.infer<typeof BlueprintOutputSchema>;

// Blueprint Variant
export const BlueprintVariantSchema = z.object({
  platform: PlatformSchema,
  format: z.string(),
  dimensions: DimensionsSchema.optional(),
  maxDuration: z.number().optional(),
  captionLimit: z.number().optional(),
  hashtagLimit: z.number().optional(),
  aspectRatio: z.string().optional(),
  fileSize: z.number().optional(),
  customConfig: z.record(z.unknown()).optional(),
});
export type BlueprintVariant = z.infer<typeof BlueprintVariantSchema>;

// Step Types
export const StepTypeSchema = z.enum(['agent', 'transform', 'parallel', 'conditional', 'loop']);
export type StepType = z.infer<typeof StepTypeSchema>;

// Blueprint Step (recursive for parallel/conditional)
export const BlueprintStepSchema: z.ZodType<BlueprintStep> = z.lazy(() =>
  z.object({
    name: z.string().min(1).max(50),
    type: StepTypeSchema,
    agent: z.string().optional(),
    inputs: z.array(z.string()).optional(),
    outputs: z.array(z.string()).optional(),
    condition: z.string().optional(),
    config: z.record(z.unknown()).optional(),
    steps: z.array(BlueprintStepSchema).optional(),
  })
);
export type BlueprintStep = {
  name: string;
  type: StepType;
  agent?: string;
  inputs?: string[];
  outputs?: string[];
  condition?: string;
  config?: Record<string, unknown>;
  steps?: BlueprintStep[];
};

// Blueprint Categories
export const BlueprintCategorySchema = z.enum([
  'short-form', 'carousel', 'story', 'long-form',
  'testimonial', 'educational', 'promotional', 'engagement',
  'automation', 'avatar',
]);
export type BlueprintCategory = z.infer<typeof BlueprintCategorySchema>;

// Full Blueprint Schema
export const BlueprintSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  category: z.string(),
  platforms: z.array(PlatformSchema).min(1),
  inputs: z.array(BlueprintInputSchema),
  outputs: z.array(BlueprintOutputSchema),
  variants: z.array(BlueprintVariantSchema),
  steps: z.array(BlueprintStepSchema),
  version: z.number().default(1),
  tags: z.array(z.string()).optional(),
  estimatedDuration: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;
```

**File:** `packages/blueprint/src/schema/blueprint-schema.ts`

```typescript
import { nanoid } from 'nanoid';
import {
  Blueprint,
  BlueprintSchema,
  BlueprintInput,
  BlueprintOutput,
  BlueprintVariant,
  BlueprintStep,
} from './types';

export function createBlueprint(
  input: Omit<Blueprint, 'id' | 'version' | 'createdAt' | 'updatedAt'>
): Blueprint {
  const now = new Date();
  return {
    id: `bp_${nanoid(12)}`,
    ...input,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateBlueprint(blueprint: Blueprint): void {
  // Validate schema
  BlueprintSchema.parse(blueprint);

  // Collect all available inputs (declared inputs + step outputs)
  const availableInputs = new Set<string>();
  for (const input of blueprint.inputs) {
    availableInputs.add(input.name);
  }

  // Track all declared outputs
  const declaredOutputs = new Set<string>();
  for (const output of blueprint.outputs) {
    if (declaredOutputs.has(output.name)) {
      throw new Error(`Blueprint has duplicate output name: ${output.name}`);
    }
    declaredOutputs.add(output.name);
  }

  // Validate steps
  for (const step of blueprint.steps) {
    validateStep(step, availableInputs, blueprint.slug);

    // Add step outputs to available inputs for subsequent steps
    if (step.outputs) {
      for (const output of step.outputs) {
        availableInputs.add(output);
      }
    }
  }
}

function validateStep(
  step: BlueprintStep,
  availableInputs: Set<string>,
  blueprintSlug: string
): void {
  // Validate inputs are available
  if (step.inputs) {
    for (const input of step.inputs) {
      if (!availableInputs.has(input)) {
        throw new Error(
          `Step '${step.name}' in blueprint '${blueprintSlug}' references undefined input: ${input}`
        );
      }
    }
  }

  // Validate nested steps for parallel/conditional
  if (step.steps) {
    const nestedInputs = new Set(availableInputs);
    for (const nestedStep of step.steps) {
      validateStep(nestedStep, nestedInputs, blueprintSlug);
      if (nestedStep.outputs) {
        for (const output of nestedStep.outputs) {
          nestedInputs.add(output);
        }
      }
    }
  }
}

export function cloneBlueprint(
  blueprint: Blueprint,
  overrides?: Partial<Blueprint>
): Blueprint {
  return {
    ...blueprint,
    ...overrides,
    id: `bp_${nanoid(12)}`,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function incrementVersion(blueprint: Blueprint): Blueprint {
  return {
    ...blueprint,
    version: blueprint.version + 1,
    updatedAt: new Date(),
  };
}

export {
  Blueprint,
  BlueprintSchema,
  BlueprintInput,
  BlueprintOutput,
  BlueprintVariant,
  BlueprintStep,
};
```

**File:** `packages/blueprint/src/schema/index.ts`

```typescript
export * from './types';
export * from './blueprint-schema';
```

### Phase 3: Verification

```bash
cd packages/blueprint
pnpm test src/schema/
pnpm typecheck
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/blueprint/src/schema/types.ts` | Blueprint type definitions |
| Create | `packages/blueprint/src/schema/blueprint-schema.ts` | Blueprint factory and validation |
| Create | `packages/blueprint/src/schema/blueprint-schema.test.ts` | Unit tests |
| Create | `packages/blueprint/src/schema/index.ts` | Module exports |
| Create | `packages/blueprint/package.json` | Package config |
| Create | `packages/blueprint/tsconfig.json` | TypeScript config |

---

## Acceptance Criteria

- [ ] BlueprintInput supports text, media, select, reference, number, boolean, json types
- [ ] BlueprintOutput supports text, media, json types
- [ ] BlueprintVariant captures platform-specific constraints
- [ ] BlueprintStep supports agent, transform, parallel, conditional types
- [ ] createBlueprint generates unique ID and sets version 1
- [ ] validateBlueprint checks input/output consistency in steps
- [ ] validateBlueprint rejects undefined inputs in steps
- [ ] validateBlueprint rejects duplicate output names
- [ ] All unit tests pass

---

## JSON Task Block

```json
{
  "task_id": "S2-B1",
  "name": "Blueprint Schema",
  "sprint": 2,
  "agent": "B",
  "status": "pending",
  "complexity": "high",
  "estimated_tokens": 5500,
  "dependencies": ["S1-A3"],
  "blocks": ["S2-B2", "S2-B3", "S2-D1"],
  "outputs": {
    "files": [
      "packages/blueprint/src/schema/types.ts",
      "packages/blueprint/src/schema/blueprint-schema.ts",
      "packages/blueprint/src/schema/blueprint-schema.test.ts"
    ],
    "exports": ["Blueprint", "BlueprintSchema", "createBlueprint", "validateBlueprint"]
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
