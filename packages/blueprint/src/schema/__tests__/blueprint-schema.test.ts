/**
 * S2-B1: Blueprint Schema Tests
 */

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
  cloneBlueprint,
  incrementVersion,
} from '../blueprint-schema.js';

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

    it('should define number input with min/max', () => {
      const input: BlueprintInput = {
        name: 'duration',
        type: 'number',
        required: true,
        description: 'Video duration in seconds',
        min: 1,
        max: 300,
      };

      expect(input.type).toBe('number');
      expect(input.min).toBe(1);
      expect(input.max).toBe(300);
    });

    it('should define boolean input', () => {
      const input: BlueprintInput = {
        name: 'includeWatermark',
        type: 'boolean',
        required: false,
        description: 'Whether to include watermark',
        default: false,
      };

      expect(input.type).toBe('boolean');
      expect(input.default).toBe(false);
    });

    it('should define json input with schema', () => {
      const input: BlueprintInput = {
        name: 'customData',
        type: 'json',
        required: false,
        description: 'Custom structured data',
        schema: {
          type: 'object',
          properties: {
            key: { type: 'string' },
          },
        },
      };

      expect(input.type).toBe('json');
      expect(input.schema).toBeDefined();
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

    it('should define LinkedIn variant', () => {
      const variant: BlueprintVariant = {
        platform: 'linkedin',
        format: 'post',
        captionLimit: 3000,
        aspectRatio: '1:1',
      };

      expect(variant.platform).toBe('linkedin');
      expect(variant.aspectRatio).toBe('1:1');
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

    it('should define loop step', () => {
      const step: BlueprintStep = {
        name: 'processImages',
        type: 'loop',
        config: {
          iterateOver: 'images',
          itemVar: 'image',
        },
        steps: [
          { name: 'resize', type: 'transform', inputs: ['image'], outputs: ['resizedImage'] },
        ],
      };

      expect(step.type).toBe('loop');
      expect(step.steps).toHaveLength(1);
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
      expect(blueprint.createdAt).toBeInstanceOf(Date);
      expect(blueprint.updatedAt).toBeInstanceOf(Date);
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

    it('should reject invalid blueprint - empty slug', () => {
      const invalid = {
        slug: '',
        name: 'Test',
        description: 'Test',
        category: 'test',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      };

      expect(() => BlueprintSchema.parse(invalid)).toThrow();
    });

    it('should reject invalid blueprint - invalid slug format', () => {
      const invalid = {
        slug: 'Invalid Slug!',
        name: 'Test',
        description: 'Test',
        category: 'test',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      };

      expect(() => BlueprintSchema.parse(invalid)).toThrow();
    });

    it('should reject invalid blueprint - empty platforms', () => {
      const invalid = {
        slug: 'test',
        name: 'Test',
        description: 'Test',
        category: 'test',
        platforms: [],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
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

    it('should allow step outputs as inputs for subsequent steps', () => {
      const blueprint = createBlueprint({
        slug: 'test',
        name: 'Test',
        description: 'Test',
        category: 'test',
        platforms: ['instagram'],
        inputs: [
          { name: 'input1', type: 'text', required: true, description: 'Input' },
        ],
        outputs: [
          { name: 'finalOutput', type: 'text', description: 'Final output' },
        ],
        variants: [],
        steps: [
          { name: 'step1', type: 'agent', agent: 'copy', inputs: ['input1'], outputs: ['intermediate'] },
          { name: 'step2', type: 'agent', agent: 'copy', inputs: ['intermediate'], outputs: ['finalOutput'] },
        ],
      });

      expect(() => validateBlueprint(blueprint)).not.toThrow();
    });

    it('should validate nested steps in parallel blocks', () => {
      const blueprint = createBlueprint({
        slug: 'test',
        name: 'Test',
        description: 'Test',
        category: 'test',
        platforms: ['instagram'],
        inputs: [
          { name: 'prompt', type: 'text', required: true, description: 'Prompt' },
        ],
        outputs: [],
        variants: [],
        steps: [
          {
            name: 'generateVariants',
            type: 'parallel',
            steps: [
              { name: 'igVariant', type: 'agent', agent: 'media', inputs: ['prompt'], outputs: ['igImage'] },
              { name: 'ttVariant', type: 'agent', agent: 'media', inputs: ['prompt'], outputs: ['ttImage'] },
            ],
          },
        ],
      });

      expect(() => validateBlueprint(blueprint)).not.toThrow();
    });

    it('should reject nested step with undefined input', () => {
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
          {
            name: 'generateVariants',
            type: 'parallel',
            steps: [
              { name: 'igVariant', type: 'agent', agent: 'media', inputs: ['undefinedPrompt'], outputs: ['igImage'] },
            ],
          },
        ],
      });

      expect(() => validateBlueprint(blueprint)).toThrow('undefined input');
    });
  });

  describe('cloneBlueprint', () => {
    it('should create a new blueprint with different ID', () => {
      const original = createBlueprint({
        slug: 'original',
        name: 'Original',
        description: 'Original blueprint',
        category: 'test',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      const cloned = cloneBlueprint(original);

      expect(cloned.id).not.toBe(original.id);
      expect(cloned.id).toMatch(/^bp_/);
      expect(cloned.slug).toBe(original.slug);
      expect(cloned.version).toBe(1);
    });

    it('should apply overrides when cloning', () => {
      const original = createBlueprint({
        slug: 'original',
        name: 'Original',
        description: 'Original blueprint',
        category: 'test',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      const cloned = cloneBlueprint(original, {
        slug: 'cloned',
        name: 'Cloned Blueprint',
      });

      expect(cloned.slug).toBe('cloned');
      expect(cloned.name).toBe('Cloned Blueprint');
      expect(cloned.description).toBe(original.description);
    });
  });

  describe('incrementVersion', () => {
    it('should increment version number', () => {
      const blueprint = createBlueprint({
        slug: 'test',
        name: 'Test',
        description: 'Test',
        category: 'test',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      expect(blueprint.version).toBe(1);

      const updated = incrementVersion(blueprint);

      expect(updated.version).toBe(2);
      expect(updated.id).toBe(blueprint.id);
    });

    it('should update updatedAt timestamp', () => {
      const blueprint = createBlueprint({
        slug: 'test',
        name: 'Test',
        description: 'Test',
        category: 'test',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      const originalUpdatedAt = blueprint.updatedAt;

      // Small delay to ensure timestamp difference
      const updated = incrementVersion(blueprint);

      expect(updated.updatedAt).toBeInstanceOf(Date);
      expect(updated.updatedAt?.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt?.getTime() ?? 0);
    });
  });
});
