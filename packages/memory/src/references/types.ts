/**
 * Reference Type Definitions
 *
 * References are lightweight pointers to content in external memory.
 */

import { z } from 'zod';

// =====================
// Reference Types
// =====================

export const ReferenceTypeSchema = z.enum([
  'knowledge_base',
  'thread',
  'plan',
  'episode',
  'brand_kit',
  'offer',
  'span',
  'summary',
  'artifact',
]);

export type ReferenceType = z.infer<typeof ReferenceTypeSchema>;

// =====================
// Span Pointer
// =====================

export const SpanPointerSchema = z.object({
  /** Span ID for direct retrieval */
  spanId: z.string(),

  /** Byte offset start */
  startByte: z.number().int().nonnegative(),

  /** Byte offset end */
  endByte: z.number().int().positive(),

  /** Estimated token count */
  tokenEstimate: z.number().int().positive(),

  /** Content hash for validation */
  contentHash: z.string().optional(),
});

export type SpanPointer = z.infer<typeof SpanPointerSchema>;

// =====================
// Reference
// =====================

export const ReferenceSchema = z.object({
  /** Unique reference identifier */
  id: z.string(),

  /** Client ID for tenant isolation */
  clientId: z.string(),

  /** Type of content being referenced */
  type: ReferenceTypeSchema,

  /** Target entity ID */
  targetId: z.string(),

  /** Human-readable label */
  label: z.string(),

  /** Optional description */
  description: z.string().optional(),

  /** Optional span pointer for direct content access */
  spanPointer: SpanPointerSchema.optional(),

  /** Flexible metadata */
  metadata: z.record(z.unknown()).optional(),

  /** Version number */
  version: z.number().int().positive(),

  /** Previous version reference ID */
  previousVersionId: z.string().optional(),

  /** Importance score (0-1) for ranking */
  importance: z.number().min(0).max(1).optional(),

  /** Creation timestamp */
  createdAt: z.date(),

  /** Last update timestamp */
  updatedAt: z.date(),
});

export type Reference = z.infer<typeof ReferenceSchema>;

// =====================
// Reference Links
// =====================

export const LinkTypeSchema = z.enum([
  'related_to',
  'parent_of',
  'child_of',
  'derived_from',
  'references',
  'supersedes',
]);

export type LinkType = z.infer<typeof LinkTypeSchema>;

export const ReferenceLinkSchema = z.object({
  /** Source reference ID */
  sourceId: z.string(),

  /** Target reference ID */
  targetId: z.string(),

  /** Link type */
  linkType: LinkTypeSchema,

  /** Link metadata */
  metadata: z.record(z.unknown()).optional(),

  /** Creation timestamp */
  createdAt: z.date(),
});

export type ReferenceLink = z.infer<typeof ReferenceLinkSchema>;

// =====================
// Access Tracking
// =====================

export interface AccessRecord {
  referenceId: string;
  sessionId: string;
  operation: 'read' | 'dereference' | 'link';
  timestamp: Date;
}

export interface AccessStats {
  referenceId: string;
  accessCount: number;
  lastAccessedAt: Date | null;
  dereferenceCount: number;
}

// =====================
// Input Types
// =====================

export type CreateReferenceInput = Omit<
  Reference,
  'id' | 'version' | 'createdAt' | 'updatedAt'
>;

export type UpdateReferenceInput = Partial<
  Omit<Reference, 'id' | 'clientId' | 'createdAt'>
>;

export interface ListReferencesOptions {
  clientId: string;
  type?: ReferenceType;
  targetId?: string;
  minImportance?: number;
  limit?: number;
}

export interface LinkOptions {
  bidirectional?: boolean;
  metadata?: Record<string, unknown>;
}

export interface GetLinkedOptions {
  linkType?: LinkType;
  direction?: 'outgoing' | 'incoming' | 'both';
}

// =====================
// Resolved Location
// =====================

export interface ResolvedLocation {
  referenceId: string;
  targetId: string;
  spanId?: string;
  startByte?: number;
  endByte?: number;
  tokenEstimate?: number;
}

// =====================
// Registry Interface
// =====================

export interface ReferenceRegistry {
  // CRUD
  createReference(input: CreateReferenceInput): Promise<Reference>;
  getReference(id: string): Promise<Reference | null>;
  updateReference(id: string, input: UpdateReferenceInput): Promise<Reference>;
  deleteReference(id: string): Promise<void>;

  // Query
  getReferencesByTarget(clientId: string, targetId: string): Promise<Reference[]>;
  listReferences(options: ListReferencesOptions): Promise<Reference[]>;

  // Links
  linkReferences(
    sourceId: string,
    targetId: string,
    linkType: LinkType,
    options?: LinkOptions
  ): Promise<void>;
  unlinkReferences(sourceId: string, targetId: string): Promise<void>;
  getLinkedReferences(id: string, options?: GetLinkedOptions): Promise<Reference[]>;

  // Resolution
  resolveReference(id: string): Promise<ResolvedLocation>;

  // Access tracking
  recordAccess(
    referenceId: string,
    access: { sessionId: string; operation: AccessRecord['operation'] }
  ): Promise<void>;
  getAccessStats(referenceId: string): Promise<AccessStats>;

  // Versioning
  createVersion(id: string, updates: UpdateReferenceInput): Promise<Reference>;
  getVersionHistory(id: string): Promise<Reference[]>;

  // Serialization
  toCompactForm(ref: Reference): string;
  toCompactFormArray(refs: Reference[]): string;
}
