/**
 * S2-B1: Blueprint Schema
 *
 * Factory functions and validation for Blueprint entities.
 */

import { nanoid } from 'nanoid';
import {
  Blueprint,
  BlueprintSchema,
  BlueprintStep,
  CreateBlueprintInput,
} from './types.js';

/**
 * Create a new Blueprint with auto-generated ID and timestamps.
 */
export function createBlueprint(input: CreateBlueprintInput): Blueprint {
  const now = new Date();
  const blueprint: Blueprint = {
    id: `bp_${nanoid(12)}`,
    slug: input.slug,
    name: input.name,
    description: input.description,
    category: input.category,
    platforms: input.platforms,
    inputs: input.inputs,
    outputs: input.outputs,
    variants: input.variants,
    steps: input.steps,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  // Add optional fields only if defined
  if (input.tags !== undefined) blueprint.tags = input.tags;
  if (input.estimatedDuration !== undefined) blueprint.estimatedDuration = input.estimatedDuration;

  return blueprint;
}

/**
 * Validate a Blueprint for schema compliance and logical consistency.
 */
export function validateBlueprint(blueprint: Blueprint): void {
  // Validate schema
  BlueprintSchema.parse(blueprint);

  // Collect all available inputs (declared inputs + step outputs)
  const availableInputs = new Set<string>();
  for (const input of blueprint.inputs) {
    availableInputs.add(input.name);
  }

  // Track all declared outputs for duplicate checking
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

/**
 * Validate a single step and its nested steps.
 */
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

/**
 * Clone a Blueprint with a new ID and reset version.
 */
export function cloneBlueprint(
  blueprint: Blueprint,
  overrides?: Partial<Blueprint>
): Blueprint {
  const now = new Date();
  const cloned: Blueprint = {
    ...blueprint,
    id: `bp_${nanoid(12)}`,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  // Apply overrides only if they're defined
  if (overrides) {
    if (overrides.slug !== undefined) cloned.slug = overrides.slug;
    if (overrides.name !== undefined) cloned.name = overrides.name;
    if (overrides.description !== undefined) cloned.description = overrides.description;
    if (overrides.category !== undefined) cloned.category = overrides.category;
    if (overrides.platforms !== undefined) cloned.platforms = overrides.platforms;
    if (overrides.inputs !== undefined) cloned.inputs = overrides.inputs;
    if (overrides.outputs !== undefined) cloned.outputs = overrides.outputs;
    if (overrides.variants !== undefined) cloned.variants = overrides.variants;
    if (overrides.steps !== undefined) cloned.steps = overrides.steps;
    if (overrides.tags !== undefined) cloned.tags = overrides.tags;
    if (overrides.estimatedDuration !== undefined) cloned.estimatedDuration = overrides.estimatedDuration;
  }

  return cloned;
}

/**
 * Increment the version of a Blueprint.
 */
export function incrementVersion(blueprint: Blueprint): Blueprint {
  return {
    ...blueprint,
    version: blueprint.version + 1,
    updatedAt: new Date(),
  };
}

// Re-export types for convenience
export type {
  Blueprint,
  BlueprintStep,
  CreateBlueprintInput,
} from './types.js';

export {
  BlueprintSchema,
  BlueprintInputSchema,
  BlueprintOutputSchema,
  BlueprintVariantSchema,
  BlueprintStepSchema,
  InputTypeSchema,
  MediaTypeSchema,
  ReferenceTypeSchema,
  PlatformSchema,
  DimensionsSchema,
  StepTypeSchema,
  BlueprintCategorySchema,
} from './types.js';

export type {
  BlueprintInput,
  BlueprintOutput,
  BlueprintVariant,
  InputType,
  MediaType,
  ReferenceType,
  Platform,
  Dimensions,
  StepType,
  BlueprintCategory,
} from './types.js';
