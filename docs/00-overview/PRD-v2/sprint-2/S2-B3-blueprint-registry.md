# Build Prompt: S2-B3 — Blueprint Registry

## Metadata

| Field | Value |
|-------|-------|
| Task ID | S2-B3 |
| Sprint | 2 |
| Agent | B (Blueprint Definitions) |
| Complexity | Medium |
| Status | pending |
| Estimated Tokens | 4,000 |
| Depends On | S2-B1, S2-B2 |
| Blocks | S2-B4, S2-B5 |

---

## Context

### What We're Building

The Blueprint Registry provides a centralized repository for blueprint discovery and loading. It supports querying by category, platform, tags, and loading specific versions by slug or ID.

### Why It Matters

The registry enables:
- Centralized blueprint management
- Discovery by use case or platform
- Version-aware blueprint loading
- Caching for performance

### Spec References

- Architecture: `/docs/01-architecture/system-architecture-v3.md`
- Engineering: `/docs/07-engineering-process/engineering-handbook.md`

---

## Prerequisites

### Completed Tasks
- [x] S2-B1: Blueprint schema
- [x] S2-B2: Blueprint versioning

---

## Instructions

### Phase 1: Test First (TDD)

**File:** `packages/blueprint/src/registry/blueprint-registry.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BlueprintRegistry } from './blueprint-registry';
import { createBlueprint } from '../schema/blueprint-schema';

describe('BlueprintRegistry', () => {
  let registry: BlueprintRegistry;

  beforeEach(() => {
    registry = new BlueprintRegistry();
  });

  describe('register', () => {
    it('should register a blueprint', () => {
      const bp = createBlueprint({
        slug: 'hook-value-cta',
        name: 'Hook Value CTA',
        description: 'Short-form reel',
        category: 'short-form',
        platforms: ['instagram', 'tiktok'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      registry.register(bp);

      expect(registry.has('hook-value-cta')).toBe(true);
    });

    it('should reject duplicate slugs', () => {
      const bp = createBlueprint({
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

      registry.register(bp);

      expect(() => registry.register(bp)).toThrow('already registered');
    });
  });

  describe('get', () => {
    it('should get blueprint by slug', () => {
      const bp = createBlueprint({
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

      registry.register(bp);

      const retrieved = registry.get('test-bp');

      expect(retrieved?.name).toBe('Test Blueprint');
    });

    it('should get specific version', () => {
      const bp = createBlueprint({
        slug: 'test-bp',
        name: 'v1',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      registry.register(bp);
      registry.publishVersion('test-bp');
      registry.registerNewVersion('test-bp', { ...bp, name: 'v2' });

      const v1 = registry.get('test-bp', 1);

      expect(v1?.name).toBe('v1');
    });

    it('should return latest published by default', () => {
      const bp = createBlueprint({
        slug: 'test-bp',
        name: 'v1',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      });

      registry.register(bp);
      registry.publishVersion('test-bp');
      registry.registerNewVersion('test-bp', { ...bp, name: 'v2' });
      registry.publishVersion('test-bp', 2);

      const latest = registry.get('test-bp');

      expect(latest?.name).toBe('v2');
    });

    it('should return null for unknown slug', () => {
      expect(registry.get('unknown')).toBeNull();
    });
  });

  describe('getById', () => {
    it('should get blueprint by ID', () => {
      const bp = createBlueprint({
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

      registry.register(bp);

      const retrieved = registry.getById(bp.id!);

      expect(retrieved?.slug).toBe('test-bp');
    });
  });

  describe('findByCategory', () => {
    beforeEach(() => {
      registry.register(createBlueprint({
        slug: 'reel-1',
        name: 'Reel 1',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));
      registry.register(createBlueprint({
        slug: 'carousel-1',
        name: 'Carousel 1',
        description: 'Test',
        category: 'carousel',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));
      registry.register(createBlueprint({
        slug: 'reel-2',
        name: 'Reel 2',
        description: 'Test',
        category: 'short-form',
        platforms: ['tiktok'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));
    });

    it('should find blueprints by category', () => {
      const shortForm = registry.findByCategory('short-form');

      expect(shortForm).toHaveLength(2);
    });

    it('should return empty array for unknown category', () => {
      expect(registry.findByCategory('unknown')).toHaveLength(0);
    });
  });

  describe('findByPlatform', () => {
    beforeEach(() => {
      registry.register(createBlueprint({
        slug: 'ig-only',
        name: 'IG Only',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));
      registry.register(createBlueprint({
        slug: 'multi-platform',
        name: 'Multi',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram', 'tiktok', 'youtube'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));
      registry.register(createBlueprint({
        slug: 'tt-only',
        name: 'TT Only',
        description: 'Test',
        category: 'short-form',
        platforms: ['tiktok'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));
    });

    it('should find blueprints for platform', () => {
      const instagram = registry.findByPlatform('instagram');

      expect(instagram).toHaveLength(2);
    });

    it('should find blueprints supporting multiple platforms', () => {
      const tiktok = registry.findByPlatform('tiktok');

      expect(tiktok).toHaveLength(2);
      expect(tiktok.map((b) => b.slug)).toContain('multi-platform');
    });
  });

  describe('findByTags', () => {
    beforeEach(() => {
      registry.register(createBlueprint({
        slug: 'bp-1',
        name: 'BP 1',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
        tags: ['promotional', 'viral'],
      }));
      registry.register(createBlueprint({
        slug: 'bp-2',
        name: 'BP 2',
        description: 'Test',
        category: 'carousel',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
        tags: ['educational', 'viral'],
      }));
    });

    it('should find blueprints by single tag', () => {
      const viral = registry.findByTags(['viral']);

      expect(viral).toHaveLength(2);
    });

    it('should find blueprints matching all tags', () => {
      const specific = registry.findByTags(['promotional', 'viral']);

      expect(specific).toHaveLength(1);
      expect(specific[0].slug).toBe('bp-1');
    });
  });

  describe('search', () => {
    beforeEach(() => {
      registry.register(createBlueprint({
        slug: 'hook-value-cta-reel',
        name: 'Hook Value CTA Reel',
        description: 'Short-form video with hook opening',
        category: 'short-form',
        platforms: ['instagram', 'tiktok'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));
      registry.register(createBlueprint({
        slug: 'carousel-saveable',
        name: 'Saveable Carousel',
        description: 'Educational carousel for saves',
        category: 'carousel',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));
    });

    it('should search by name', () => {
      const results = registry.search({ query: 'carousel' });

      expect(results).toHaveLength(1);
      expect(results[0].slug).toBe('carousel-saveable');
    });

    it('should search by description', () => {
      const results = registry.search({ query: 'hook' });

      expect(results).toHaveLength(1);
    });

    it('should combine filters', () => {
      const results = registry.search({
        query: 'reel',
        category: 'short-form',
        platform: 'tiktok',
      });

      expect(results).toHaveLength(1);
    });
  });

  describe('list', () => {
    it('should list all registered blueprints', () => {
      registry.register(createBlueprint({
        slug: 'bp-1',
        name: 'BP 1',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));
      registry.register(createBlueprint({
        slug: 'bp-2',
        name: 'BP 2',
        description: 'Test',
        category: 'carousel',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));

      const all = registry.list();

      expect(all).toHaveLength(2);
    });
  });

  describe('getCategories', () => {
    it('should return all unique categories', () => {
      registry.register(createBlueprint({
        slug: 'bp-1',
        name: 'BP 1',
        description: 'Test',
        category: 'short-form',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));
      registry.register(createBlueprint({
        slug: 'bp-2',
        name: 'BP 2',
        description: 'Test',
        category: 'carousel',
        platforms: ['instagram'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));
      registry.register(createBlueprint({
        slug: 'bp-3',
        name: 'BP 3',
        description: 'Test',
        category: 'short-form',
        platforms: ['tiktok'],
        inputs: [],
        outputs: [],
        variants: [],
        steps: [],
      }));

      const categories = registry.getCategories();

      expect(categories).toHaveLength(2);
      expect(categories).toContain('short-form');
      expect(categories).toContain('carousel');
    });
  });
});
```

### Phase 2: Implementation

**File:** `packages/blueprint/src/registry/types.ts`

```typescript
import { Blueprint } from '../schema/types';

export interface SearchOptions {
  query?: string;
  category?: string;
  platform?: string;
  tags?: string[];
}

export interface RegistryEntry {
  slug: string;
  versions: Map<number, Blueprint>;
  latestPublished: number | null;
}
```

**File:** `packages/blueprint/src/registry/blueprint-registry.ts`

```typescript
import { Blueprint } from '../schema/blueprint-schema';
import { SearchOptions, RegistryEntry } from './types';

export class BlueprintRegistry {
  private entries: Map<string, RegistryEntry> = new Map();
  private byId: Map<string, Blueprint> = new Map();

  register(blueprint: Blueprint): void {
    if (this.entries.has(blueprint.slug)) {
      throw new Error(`Blueprint '${blueprint.slug}' is already registered`);
    }

    const entry: RegistryEntry = {
      slug: blueprint.slug,
      versions: new Map([[1, blueprint]]),
      latestPublished: null,
    };

    this.entries.set(blueprint.slug, entry);
    if (blueprint.id) {
      this.byId.set(blueprint.id, blueprint);
    }
  }

  registerNewVersion(slug: string, blueprint: Blueprint): number {
    const entry = this.entries.get(slug);
    if (!entry) {
      throw new Error(`Blueprint '${slug}' not found`);
    }

    const nextVersion = entry.versions.size + 1;
    const versionedBlueprint = { ...blueprint, version: nextVersion };
    entry.versions.set(nextVersion, versionedBlueprint);

    if (versionedBlueprint.id) {
      this.byId.set(versionedBlueprint.id, versionedBlueprint);
    }

    return nextVersion;
  }

  publishVersion(slug: string, version?: number): void {
    const entry = this.entries.get(slug);
    if (!entry) {
      throw new Error(`Blueprint '${slug}' not found`);
    }

    const targetVersion = version ?? entry.versions.size;
    if (!entry.versions.has(targetVersion)) {
      throw new Error(`Version ${targetVersion} not found`);
    }

    entry.latestPublished = targetVersion;
  }

  has(slug: string): boolean {
    return this.entries.has(slug);
  }

  get(slug: string, version?: number): Blueprint | null {
    const entry = this.entries.get(slug);
    if (!entry) return null;

    if (version !== undefined) {
      return entry.versions.get(version) ?? null;
    }

    // Return latest published, or latest draft if none published
    if (entry.latestPublished !== null) {
      return entry.versions.get(entry.latestPublished) ?? null;
    }

    // Return latest version
    const maxVersion = Math.max(...entry.versions.keys());
    return entry.versions.get(maxVersion) ?? null;
  }

  getById(id: string): Blueprint | null {
    return this.byId.get(id) ?? null;
  }

  findByCategory(category: string): Blueprint[] {
    const results: Blueprint[] = [];

    for (const entry of this.entries.values()) {
      const bp = this.getLatestBlueprint(entry);
      if (bp && bp.category === category) {
        results.push(bp);
      }
    }

    return results;
  }

  findByPlatform(platform: string): Blueprint[] {
    const results: Blueprint[] = [];

    for (const entry of this.entries.values()) {
      const bp = this.getLatestBlueprint(entry);
      if (bp && bp.platforms.includes(platform as any)) {
        results.push(bp);
      }
    }

    return results;
  }

  findByTags(tags: string[]): Blueprint[] {
    const results: Blueprint[] = [];

    for (const entry of this.entries.values()) {
      const bp = this.getLatestBlueprint(entry);
      if (bp && bp.tags) {
        const hasAllTags = tags.every((tag) => bp.tags!.includes(tag));
        if (hasAllTags) {
          results.push(bp);
        }
      }
    }

    return results;
  }

  search(options: SearchOptions): Blueprint[] {
    let results = this.list();

    if (options.query) {
      const query = options.query.toLowerCase();
      results = results.filter(
        (bp) =>
          bp.name.toLowerCase().includes(query) ||
          bp.description.toLowerCase().includes(query) ||
          bp.slug.toLowerCase().includes(query)
      );
    }

    if (options.category) {
      results = results.filter((bp) => bp.category === options.category);
    }

    if (options.platform) {
      results = results.filter((bp) =>
        bp.platforms.includes(options.platform as any)
      );
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter(
        (bp) => bp.tags && options.tags!.every((tag) => bp.tags!.includes(tag))
      );
    }

    return results;
  }

  list(): Blueprint[] {
    const results: Blueprint[] = [];

    for (const entry of this.entries.values()) {
      const bp = this.getLatestBlueprint(entry);
      if (bp) {
        results.push(bp);
      }
    }

    return results;
  }

  getCategories(): string[] {
    const categories = new Set<string>();

    for (const entry of this.entries.values()) {
      const bp = this.getLatestBlueprint(entry);
      if (bp) {
        categories.add(bp.category);
      }
    }

    return Array.from(categories);
  }

  private getLatestBlueprint(entry: RegistryEntry): Blueprint | null {
    if (entry.latestPublished !== null) {
      return entry.versions.get(entry.latestPublished) ?? null;
    }

    const maxVersion = Math.max(...entry.versions.keys());
    return entry.versions.get(maxVersion) ?? null;
  }
}
```

**File:** `packages/blueprint/src/registry/index.ts`

```typescript
export * from './types';
export * from './blueprint-registry';
```

### Phase 3: Verification

```bash
cd packages/blueprint
pnpm test src/registry/
pnpm typecheck
pnpm lint
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/blueprint/src/registry/types.ts` | Registry types |
| Create | `packages/blueprint/src/registry/blueprint-registry.ts` | Registry service |
| Create | `packages/blueprint/src/registry/blueprint-registry.test.ts` | Unit tests |
| Create | `packages/blueprint/src/registry/index.ts` | Module exports |

---

## Acceptance Criteria

- [ ] register adds blueprint to registry
- [ ] register rejects duplicate slugs
- [ ] get retrieves by slug (latest published)
- [ ] get retrieves specific version
- [ ] getById retrieves by ID
- [ ] findByCategory filters by category
- [ ] findByPlatform filters by platform
- [ ] findByTags filters by all matching tags
- [ ] search combines query + filters
- [ ] list returns all blueprints
- [ ] getCategories returns unique categories
- [ ] All unit tests pass

---

## JSON Task Block

```json
{
  "task_id": "S2-B3",
  "name": "Blueprint Registry",
  "sprint": 2,
  "agent": "B",
  "status": "pending",
  "complexity": "medium",
  "estimated_tokens": 4000,
  "dependencies": ["S2-B1", "S2-B2"],
  "blocks": ["S2-B4", "S2-B5"],
  "outputs": {
    "files": [
      "packages/blueprint/src/registry/types.ts",
      "packages/blueprint/src/registry/blueprint-registry.ts",
      "packages/blueprint/src/registry/blueprint-registry.test.ts"
    ],
    "exports": ["BlueprintRegistry"]
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
