/**
 * Reference Registry Implementation
 *
 * In-memory registry for reference management.
 */

import { nanoid } from 'nanoid';
import type {
  ReferenceRegistry,
  Reference,
  ReferenceLink,
  CreateReferenceInput,
  UpdateReferenceInput,
  ListReferencesOptions,
  LinkType,
  LinkOptions,
  GetLinkedOptions,
  ResolvedLocation,
  AccessRecord,
  AccessStats,
} from './types.js';

/**
 * Create a new Reference Registry
 */
export function createReferenceRegistry(): ReferenceRegistry {
  const references = new Map<string, Reference>();
  const links = new Map<string, ReferenceLink[]>();
  const accessRecords = new Map<string, AccessRecord[]>();
  const versionChains = new Map<string, string[]>(); // rootId -> [v1Id, v2Id, ...]

  const registry: ReferenceRegistry = {
    // CRUD
    async createReference(input: CreateReferenceInput): Promise<Reference> {
      const now = new Date();
      const ref: Reference = {
        ...input,
        id: `ref-${nanoid()}`,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };

      references.set(ref.id, ref);

      // Initialize version chain
      versionChains.set(ref.id, [ref.id]);

      return ref;
    },

    async getReference(id: string): Promise<Reference | null> {
      return references.get(id) ?? null;
    },

    async updateReference(id: string, input: UpdateReferenceInput): Promise<Reference> {
      const existing = references.get(id);
      if (!existing) {
        throw new Error(`Reference not found: ${id}`);
      }

      const updated: Reference = {
        ...existing,
        ...input,
        updatedAt: new Date(),
      };

      references.set(id, updated);
      return updated;
    },

    async deleteReference(id: string): Promise<void> {
      references.delete(id);

      // Remove all links involving this reference
      for (const [key, refLinks] of links.entries()) {
        const filtered = refLinks.filter(
          (l) => l.sourceId !== id && l.targetId !== id
        );
        if (filtered.length === 0) {
          links.delete(key);
        } else {
          links.set(key, filtered);
        }
      }
    },

    // Query
    async getReferencesByTarget(
      clientId: string,
      targetId: string
    ): Promise<Reference[]> {
      const results: Reference[] = [];
      for (const ref of references.values()) {
        if (ref.clientId === clientId && ref.targetId === targetId) {
          results.push(ref);
        }
      }
      return results;
    },

    async listReferences(options: ListReferencesOptions): Promise<Reference[]> {
      const results: Reference[] = [];

      for (const ref of references.values()) {
        if (ref.clientId !== options.clientId) continue;
        if (options.type && ref.type !== options.type) continue;
        if (options.targetId && ref.targetId !== options.targetId) continue;
        if (
          options.minImportance !== undefined &&
          (ref.importance ?? 0) < options.minImportance
        ) {
          continue;
        }

        results.push(ref);
      }

      // Sort by importance (descending), then by creation date
      results.sort((a, b) => {
        const impDiff = (b.importance ?? 0) - (a.importance ?? 0);
        if (impDiff !== 0) return impDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      if (options.limit) {
        return results.slice(0, options.limit);
      }

      return results;
    },

    // Links
    async linkReferences(
      sourceId: string,
      targetId: string,
      linkType: LinkType,
      options?: LinkOptions
    ): Promise<void> {
      const now = new Date();

      // Create forward link
      const forwardLink: ReferenceLink = {
        sourceId,
        targetId,
        linkType,
        metadata: options?.metadata,
        createdAt: now,
      };

      const sourceLinks = links.get(sourceId) ?? [];
      sourceLinks.push(forwardLink);
      links.set(sourceId, sourceLinks);

      // Create reverse link if bidirectional (default: true)
      if (options?.bidirectional !== false) {
        const reverseLink: ReferenceLink = {
          sourceId: targetId,
          targetId: sourceId,
          linkType: getReverseLinkType(linkType),
          metadata: options?.metadata,
          createdAt: now,
        };

        const targetLinks = links.get(targetId) ?? [];
        targetLinks.push(reverseLink);
        links.set(targetId, targetLinks);
      }
    },

    async unlinkReferences(sourceId: string, targetId: string): Promise<void> {
      // Remove forward link
      const sourceLinks = links.get(sourceId) ?? [];
      links.set(
        sourceId,
        sourceLinks.filter((l) => l.targetId !== targetId)
      );

      // Remove reverse link
      const targetLinks = links.get(targetId) ?? [];
      links.set(
        targetId,
        targetLinks.filter((l) => l.targetId !== sourceId)
      );
    },

    async getLinkedReferences(
      id: string,
      options?: GetLinkedOptions
    ): Promise<Reference[]> {
      // When linkType is specified, default to 'outgoing' only (semantic: what do I link to?)
      // When no linkType, default to 'both' (get all connected references)
      const direction = options?.direction ?? (options?.linkType ? 'outgoing' : 'both');
      const linkedIds = new Set<string>();

      // Get outgoing links
      if (direction === 'outgoing' || direction === 'both') {
        const outgoing = links.get(id) ?? [];
        for (const link of outgoing) {
          if (!options?.linkType || link.linkType === options.linkType) {
            linkedIds.add(link.targetId);
          }
        }
      }

      // Get incoming links
      if (direction === 'incoming' || direction === 'both') {
        for (const [sourceId, sourceLinks] of links.entries()) {
          if (sourceId === id) continue;
          for (const link of sourceLinks) {
            if (link.targetId === id) {
              if (!options?.linkType || link.linkType === options.linkType) {
                linkedIds.add(sourceId);
              }
            }
          }
        }
      }

      // Resolve to references
      const results: Reference[] = [];
      for (const linkedId of linkedIds) {
        const ref = references.get(linkedId);
        if (ref) results.push(ref);
      }

      return results;
    },

    // Resolution
    async resolveReference(id: string): Promise<ResolvedLocation> {
      const ref = references.get(id);
      if (!ref) {
        throw new Error(`Reference not found: ${id}`);
      }

      const location: ResolvedLocation = {
        referenceId: id,
        targetId: ref.targetId,
      };

      if (ref.spanPointer) {
        location.spanId = ref.spanPointer.spanId;
        location.startByte = ref.spanPointer.startByte;
        location.endByte = ref.spanPointer.endByte;
        location.tokenEstimate = ref.spanPointer.tokenEstimate;
      }

      return location;
    },

    // Access tracking
    async recordAccess(
      referenceId: string,
      access: { sessionId: string; operation: AccessRecord['operation'] }
    ): Promise<void> {
      const record: AccessRecord = {
        referenceId,
        sessionId: access.sessionId,
        operation: access.operation,
        timestamp: new Date(),
      };

      const records = accessRecords.get(referenceId) ?? [];
      records.push(record);
      accessRecords.set(referenceId, records);
    },

    async getAccessStats(referenceId: string): Promise<AccessStats> {
      const records = accessRecords.get(referenceId) ?? [];
      const lastRecord = records[records.length - 1];

      return {
        referenceId,
        accessCount: records.length,
        lastAccessedAt: lastRecord?.timestamp ?? null,
        dereferenceCount: records.filter((r) => r.operation === 'dereference').length,
      };
    },

    // Versioning
    async createVersion(
      id: string,
      updates: UpdateReferenceInput
    ): Promise<Reference> {
      const existing = references.get(id);
      if (!existing) {
        throw new Error(`Reference not found: ${id}`);
      }

      // Find the root version
      let rootId = id;
      for (const [root, chain] of versionChains.entries()) {
        if (chain.includes(id)) {
          rootId = root;
          break;
        }
      }

      const chain = versionChains.get(rootId) ?? [id];
      const latestId = chain[chain.length - 1] ?? id;
      const latest = references.get(latestId);
      if (!latest) {
        throw new Error(`Latest version not found: ${latestId}`);
      }

      const now = new Date();
      const newVersion: Reference = {
        ...latest,
        ...updates,
        id: `ref-${nanoid()}`,
        version: latest.version + 1,
        previousVersionId: latestId,
        createdAt: now,
        updatedAt: now,
      };

      references.set(newVersion.id, newVersion);
      chain.push(newVersion.id);
      versionChains.set(rootId, chain);

      return newVersion;
    },

    async getVersionHistory(id: string): Promise<Reference[]> {
      // Find the root version
      let rootId = id;
      for (const [root, chain] of versionChains.entries()) {
        if (chain.includes(id)) {
          rootId = root;
          break;
        }
      }

      const chain = versionChains.get(rootId) ?? [id];
      const history: Reference[] = [];

      for (const versionId of chain) {
        const ref = references.get(versionId);
        if (ref) history.push(ref);
      }

      return history;
    },

    // Serialization
    toCompactForm(ref: Reference): string {
      const parts = [
        `[${ref.type}]`,
        ref.label,
        ref.spanPointer ? `(~${ref.spanPointer.tokenEstimate} tokens)` : '',
      ].filter(Boolean);

      return parts.join(' ');
    },

    toCompactFormArray(refs: Reference[]): string {
      return refs.map((ref, i) => `${i + 1}. ${registry.toCompactForm(ref)}`).join('\n');
    },
  };

  return registry;
}

/**
 * Get the reverse link type for bidirectional linking
 */
function getReverseLinkType(linkType: LinkType): LinkType {
  switch (linkType) {
    case 'parent_of':
      return 'child_of';
    case 'child_of':
      return 'parent_of';
    case 'supersedes':
      return 'derived_from';
    case 'derived_from':
      return 'supersedes';
    default:
      return linkType;
  }
}
