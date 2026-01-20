/**
 * Reference System
 *
 * Lightweight pointers to content in external memory.
 */

export { createReferenceRegistry } from './registry.js';

export type {
  // Core types
  Reference,
  ReferenceType,
  SpanPointer,
  ReferenceLink,
  LinkType,

  // Input types
  CreateReferenceInput,
  UpdateReferenceInput,
  ListReferencesOptions,
  LinkOptions,
  GetLinkedOptions,

  // Resolution
  ResolvedLocation,

  // Access tracking
  AccessRecord,
  AccessStats,

  // Registry
  ReferenceRegistry,
} from './types.js';

export {
  ReferenceSchema,
  ReferenceTypeSchema,
  SpanPointerSchema,
  ReferenceLinkSchema,
  LinkTypeSchema,
} from './types.js';
