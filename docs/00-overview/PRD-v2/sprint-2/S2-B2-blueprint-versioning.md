# Build Prompt: S2-B2 — Blueprint Versioning

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-B2 |
| Sprint | 2 |
| Agent | B (Blueprint Definitions) |
| Complexity | Medium |
| Status | pending |
| Estimated Tokens | 3,500 |
| Depends On | S2-B1 |
| Blocks | S2-B3 |

---

## Context

### What We're Building

Immutable versioning system for blueprints. Once a blueprint version is published, it cannot be modified. New changes create new versions. Content created with a specific version references that exact version for reproducibility.

### Why It Matters

Blueprint versioning ensures:
- Reproducible content creation
- Safe updates without breaking existing content
- Audit trail of template changes
- Rollback capability if new versions have issues

### Spec References

- Architecture: `/docs/01-architecture/system-architecture-v3.md`
- Engineering: `/docs/07-engineering-process/engineering-handbook.md`

---

## Prerequisites

### Completed Tasks
- [x] S2-B1: Blueprint schema

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/blueprint/src/versioning/blueprint-versioning.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BlueprintVersionService,
  BlueprintVersion,
  VersionStatus,
} from './blueprint-versioning';
import { createBlueprint } from '../schema/blueprint-schema';

describe('BlueprintVersionService', () => {
  let service: BlueprintVersionService;

  beforeEach(() => {
    service = new BlueprintVersionService();
  });

  describe('createDraft', () => {
    it('should create a draft version', () => {
      const blueprint = createBlueprint({
        slug: 'test-bp',
        name: 'Test Blueprint',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      const version = service.createDraft(blueprint);

      expect(version.status).toBe('draft');
      expect(version.version).toBe(1);
      expect(version.blueprint).toEqual(blueprint);
    });

    it('should increment version for existing blueprint', () => {
      const blueprint = createBlueprint({
        slug: 'test-bp',
        name: 'Test Blueprint',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(blueprint);
      service.publish(blueprint.slug, 1);

      const v2 = service.createDraft({ ...blueprint, name: 'Updated' });

      expect(v2.version).toBe(2);
    });
  });

  describe('publish', () => {
    it('should publish a draft version', () => {
      const blueprint = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(blueprint);
      const published = service.publish(blueprint.slug, 1);

      expect(published.status).toBe('published');
      expect(published.publishedAt).toBeInstanceOf(Date);
    });

    it('should reject publishing non-draft version', () => {
      const blueprint = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(blueprint);
      service.publish(blueprint.slug, 1);

      expect(() => service.publish(blueprint.slug, 1)).toThrow('not in draft status');
    });

    it('should make published version immutable', () => {
      const blueprint = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(blueprint);
      service.publish(blueprint.slug, 1);

      expect(() =>
        service.updateDraft(blueprint.slug, 1, { name: 'Changed' })
      ).toThrow('Cannot update published version');
    });
  });

  describe('deprecate', () => {
    it('should deprecate a published version', () => {
      const blueprint = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(blueprint);
      service.publish(blueprint.slug, 1);
      const deprecated = service.deprecate(blueprint.slug, 1, 'Use v2 instead');

      expect(deprecated.status).toBe('deprecated');
      expect(deprecated.deprecationReason).toBe('Use v2 instead');
    });

    it('should allow setting successor version', () => {
      const blueprint = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(blueprint);
      service.publish(blueprint.slug, 1);
      service.createDraft({ ...blueprint, name: 'v2' });
      service.publish(blueprint.slug, 2);

      const deprecated = service.deprecate(blueprint.slug, 1, 'Superseded', 2);

      expect(deprecated.successorVersion).toBe(2);
    });
  });

  describe('getVersion', () => {
    it('should get specific version', () => {
      const blueprint = createBlueprint({
        slug: 'test-bp',
        name: 'Test v1',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(blueprint);
      service.publish(blueprint.slug, 1);
      service.createDraft({ ...blueprint, name: 'Test v2' });

      const v1 = service.getVersion(blueprint.slug, 1);

      expect(v1?.blueprint.name).toBe('Test v1');
    });

    it('should return null for nonexistent version', () => {
      expect(service.getVersion('nonexistent', 1)).toBeNull();
    });
  });

  describe('getLatestPublished', () => {
    it('should get latest published version', () => {
      const blueprint = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(blueprint);
      service.publish(blueprint.slug, 1);
      service.createDraft({ ...blueprint, name: 'v2' });
      service.publish(blueprint.slug, 2);
      service.createDraft({ ...blueprint, name: 'v3 draft' }); // Not published

      const latest = service.getLatestPublished(blueprint.slug);

      expect(latest?.version).toBe(2);
    });

    it('should skip deprecated versions by default', () => {
      const blueprint = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(blueprint);
      service.publish(blueprint.slug, 1);
      service.createDraft({ ...blueprint, name: 'v2' });
      service.publish(blueprint.slug, 2);
      service.deprecate(blueprint.slug, 2, 'Bad version');

      const latest = service.getLatestPublished(blueprint.slug);

      expect(latest?.version).toBe(1);
    });
  });

  describe('listVersions', () => {
    it('should list all versions for a blueprint', () => {
      const blueprint = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(blueprint);
      service.publish(blueprint.slug, 1);
      service.createDraft({ ...blueprint, name: 'v2' });
      service.publish(blueprint.slug, 2);
      service.createDraft({ ...blueprint, name: 'v3' });

      const versions = service.listVersions(blueprint.slug);

      expect(versions).toHaveLength(3);
    });

    it('should filter by status', () => {
      const blueprint = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(blueprint);
      service.publish(blueprint.slug, 1);
      service.createDraft({ ...blueprint, name: 'v2' });

      const published = service.listVersions(blueprint.slug, { status: 'published' });
      const drafts = service.listVersions(blueprint.slug, { status: 'draft' });

      expect(published).toHaveLength(1);
      expect(drafts).toHaveLength(1);
    });
  });

  describe('compareVersions', () => {
    it('should identify added inputs', () => {
      const v1 = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [{ name: 'text', type: 'text', required: true, description: 'Text' }],
        outputs: [],
        variants: [],
        steps: [],
      });

      const v2 = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [
          { name: 'text', type: 'text', required: true, description: 'Text' },
          { name: 'image', type: 'media', required: false, description: 'Image' },
        ],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(v1);
      service.publish(v1.slug, 1);
      service.createDraft(v2);

      const diff = service.compareVersions(v1.slug, 1, 2);

      expect(diff.inputsAdded).toContain('image');
    });

    it('should identify removed inputs', () => {
      const v1 = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [
          { name: 'text', type: 'text', required: true, description: 'Text' },
          { name: 'image', type: 'media', required: false, description: 'Image' },
        ],
        outputs: [],
        variants: [],
        steps: [],
      });

      const v2 = createBlueprint({
        slug: 'test-bp',
        name: 'Test',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [{ name: 'text', type: 'text', required: true, description: 'Text' }],
        outputs: [],
        variants: [],
        steps: [],
      });

      service.createDraft(v1);
      service.publish(v1.slug, 1);
      service.createDraft(v2);

      const diff = service.compareVersions(v1.slug, 1, 2);

      expect(diff.inputsRemoved).toContain('image');
      expect(diff.isBreakingChange).toBe(true);
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/blueprint/src/versioning/types.ts`

```typescript
import { z } from 'zod';
import { Blueprint } from '../schema/types';

export const VersionStatusSchema = z.enum(['draft', 'published', 'deprecated']);
export type VersionStatus = z.infer<typeof VersionStatusSchema>;

export interface BlueprintVersion {
  slug: string;
  version: number;
  status: VersionStatus;
  blueprint: Blueprint;
  createdAt: Date;
  publishedAt?: Date;
  deprecatedAt?: Date;
  deprecationReason?: string;
  successorVersion?: number;
}

export interface VersionDiff {
  fromVersion: number;
  toVersion: number;
  inputsAdded: string[];
  inputsRemoved: string[];
  inputsModified: string[];
  outputsAdded: string[];
  outputsRemoved: string[];
  stepsChanged: boolean;
  isBreakingChange: boolean;
}

export interface ListVersionsOptions {
  status?: VersionStatus;
}
```

**File:** `packages/blueprint/src/versioning/blueprint-versioning.ts`

```typescript
import { Blueprint } from '../schema/blueprint-schema';
import {
  BlueprintVersion,
  VersionStatus,
  VersionDiff,
  ListVersionsOptions,
} from './types';

export class BlueprintVersionService {
  private versions: Map<string, BlueprintVersion[]> = new Map();

  createDraft(blueprint: Blueprint): BlueprintVersion {
    const slug = blueprint.slug;
    const existing = this.versions.get(slug) ?? [];
    const nextVersion = existing.length + 1;

    const version: BlueprintVersion = {
      slug,
      version: nextVersion,
      status: 'draft',
      blueprint: { ...blueprint, version: nextVersion },
      createdAt: new Date(),
    };

    existing.push(version);
    this.versions.set(slug, existing);

    return version;
  }

  updateDraft(
    slug: string,
    versionNumber: number,
    updates: Partial<Blueprint>
  ): BlueprintVersion {
    const version = this.getVersion(slug, versionNumber);
    if (!version) {
      throw new Error(`Version ${versionNumber} not found for ${slug}`);
    }

    if (version.status !== 'draft') {
      throw new Error('Cannot update published version');
    }

    version.blueprint = { ...version.blueprint, ...updates };
    return version;
  }

  publish(slug: string, versionNumber: number): BlueprintVersion {
    const version = this.getVersion(slug, versionNumber);
    if (!version) {
      throw new Error(`Version ${versionNumber} not found for ${slug}`);
    }

    if (version.status !== 'draft') {
      throw new Error(`Version ${versionNumber} is not in draft status`);
    }

    version.status = 'published';
    version.publishedAt = new Date();

    return version;
  }

  deprecate(
    slug: string,
    versionNumber: number,
    reason: string,
    successorVersion?: number
  ): BlueprintVersion {
    const version = this.getVersion(slug, versionNumber);
    if (!version) {
      throw new Error(`Version ${versionNumber} not found for ${slug}`);
    }

    if (version.status !== 'published') {
      throw new Error('Can only deprecate published versions');
    }

    version.status = 'deprecated';
    version.deprecatedAt = new Date();
    version.deprecationReason = reason;
    version.successorVersion = successorVersion;

    return version;
  }

  getVersion(slug: string, versionNumber: number): BlueprintVersion | null {
    const versions = this.versions.get(slug) ?? [];
    return versions.find((v) => v.version === versionNumber) ?? null;
  }

  getLatestPublished(
    slug: string,
    includeDeprecated = false
  ): BlueprintVersion | null {
    const versions = this.versions.get(slug) ?? [];

    const candidates = versions.filter((v) => {
      if (v.status === 'published') return true;
      if (includeDeprecated && v.status === 'deprecated') return true;
      return false;
    });

    if (candidates.length === 0) return null;

    // Sort by version descending
    candidates.sort((a, b) => b.version - a.version);

    // Return first non-deprecated if available
    const nonDeprecated = candidates.find((v) => v.status === 'published');
    return nonDeprecated ?? (includeDeprecated ? candidates[0] : null);
  }

  listVersions(slug: string, options?: ListVersionsOptions): BlueprintVersion[] {
    const versions = this.versions.get(slug) ?? [];

    if (options?.status) {
      return versions.filter((v) => v.status === options.status);
    }

    return versions;
  }

  compareVersions(
    slug: string,
    fromVersion: number,
    toVersion: number
  ): VersionDiff {
    const from = this.getVersion(slug, fromVersion);
    const to = this.getVersion(slug, toVersion);

    if (!from || !to) {
      throw new Error('One or both versions not found');
    }

    const fromInputs = new Set(from.blueprint.inputs.map((i) => i.name));
    const toInputs = new Set(to.blueprint.inputs.map((i) => i.name));
    const fromOutputs = new Set(from.blueprint.outputs.map((o) => o.name));
    const toOutputs = new Set(to.blueprint.outputs.map((o) => o.name));

    const inputsAdded = [...toInputs].filter((i) => !fromInputs.has(i));
    const inputsRemoved = [...fromInputs].filter((i) => !toInputs.has(i));
    const outputsAdded = [...toOutputs].filter((o) => !fromOutputs.has(o));
    const outputsRemoved = [...fromOutputs].filter((o) => !toOutputs.has(o));

    // Check for modified inputs (same name, different config)
    const inputsModified: string[] = [];
    for (const name of fromInputs) {
      if (toInputs.has(name)) {
        const fromInput = from.blueprint.inputs.find((i) => i.name === name);
        const toInput = to.blueprint.inputs.find((i) => i.name === name);
        if (JSON.stringify(fromInput) !== JSON.stringify(toInput)) {
          inputsModified.push(name);
        }
      }
    }

    // Steps changed if different length or different JSON
    const stepsChanged =
      JSON.stringify(from.blueprint.steps) !== JSON.stringify(to.blueprint.steps);

    // Breaking change if required inputs removed or outputs removed
    const requiredInputsRemoved = inputsRemoved.filter((name) => {
      const input = from.blueprint.inputs.find((i) => i.name === name);
      return input?.required;
    });

    const isBreakingChange =
      requiredInputsRemoved.length > 0 || outputsRemoved.length > 0;

    return {
      fromVersion,
      toVersion,
      inputsAdded,
      inputsRemoved,
      inputsModified,
      outputsAdded,
      outputsRemoved,
      stepsChanged,
      isBreakingChange,
    };
  }
}

export { BlueprintVersion, VersionStatus, VersionDiff };
```

**File:** `packages/blueprint/src/versioning/index.ts`

```typescript
export * from './types';
export * from './blueprint-versioning';
```

### Phase 3: Verification

```bash
cd packages/blueprint
pnpm test src/versioning/
pnpm typecheck
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/blueprint/src/versioning/types.ts` | Version types |
| Create | `packages/blueprint/src/versioning/blueprint-versioning.ts` | Version service |
| Create | `packages/blueprint/src/versioning/blueprint-versioning.test.ts` | Unit tests |
| Create | `packages/blueprint/src/versioning/index.ts` | Module exports |

---

## Acceptance Criteria

- [ ] createDraft creates version 1 for new blueprints
- [ ] createDraft increments version for existing blueprints
- [ ] publish transitions draft to published
- [ ] publish rejects non-draft versions
- [ ] Published versions cannot be updated
- [ ] deprecate marks published version as deprecated
- [ ] deprecate records reason and successor
- [ ] getVersion retrieves specific version
- [ ] getLatestPublished returns latest non-deprecated
- [ ] listVersions filters by status
- [ ] compareVersions identifies input/output changes
- [ ] compareVersions detects breaking changes
- [ ] All unit tests pass

---

## JSON Task Block

```json
{
  "task_id": "S2-B2",
  "name": "Blueprint Versioning",
  "sprint": 2,
  "agent": "B",
  "status": "pending",
  "complexity": "medium",
  "estimated_tokens": 3500,
  "dependencies": ["S2-B1"],
  "blocks": ["S2-B3"],
  "outputs": {
    "files": [
      "packages/blueprint/src/versioning/types.ts",
      "packages/blueprint/src/versioning/blueprint-versioning.ts",
      "packages/blueprint/src/versioning/blueprint-versioning.test.ts"
    ],
    "exports": ["BlueprintVersionService", "BlueprintVersion", "VersionDiff"]
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
