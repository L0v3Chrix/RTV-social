/**
 * Client Utility Functions
 *
 * Helper functions for Client domain operations.
 */
import slugifyModule from 'slugify';
import { nanoid } from 'nanoid';
import type { PaginatedResult, PaginationMeta, ClientSettings, PartialClientSettings } from './types.js';
import { DEFAULT_CLIENT_SETTINGS } from './types.js';

/**
 * Generate a URL-friendly slug from a name
 * @param name The name to convert to a slug
 * @returns A lowercase, hyphenated slug
 */
export function generateSlug(name: string): string {
  // Handle the slugify module default export
  const slugify = (slugifyModule as unknown as { default: (input: string, options?: object) => string }).default ?? slugifyModule;
  return (slugify as (input: string, options?: object) => string)(name, {
    lower: true,
    strict: true,
    replacement: '-',
    trim: true,
  });
}

/**
 * Generate a unique slug by appending a random suffix
 * @param name The base name to convert to a slug
 * @returns A unique slug with a random suffix
 */
export function generateUniqueSlug(name: string): string {
  const baseSlug = generateSlug(name);
  const suffix = nanoid(6).toLowerCase();
  return `${baseSlug}-${suffix}`;
}

/**
 * Create a paginated result object
 * @param data The data array
 * @param options Pagination options
 * @returns A paginated result with metadata
 */
export function createPaginatedResult<T>(
  data: T[],
  options: {
    page: number;
    pageSize: number;
    total: number;
  }
): PaginatedResult<T> {
  const { page, pageSize, total } = options;
  const totalPages = Math.ceil(total / pageSize);

  const pagination: PaginationMeta = {
    page,
    pageSize,
    total,
    totalPages,
  };

  return {
    data,
    pagination,
  };
}

/**
 * Merge partial settings with defaults
 * @param partial Partial settings from input
 * @returns Complete settings object
 */
export function mergeSettings(partial?: PartialClientSettings): ClientSettings {
  if (!partial) {
    return { ...DEFAULT_CLIENT_SETTINGS };
  }

  return {
    timezone: partial.timezone ?? DEFAULT_CLIENT_SETTINGS.timezone,
    defaultLanguage: partial.defaultLanguage ?? DEFAULT_CLIENT_SETTINGS.defaultLanguage,
    features: { ...DEFAULT_CLIENT_SETTINGS.features, ...(partial.features ?? {}) },
    notifications: {
      ...DEFAULT_CLIENT_SETTINGS.notifications,
      ...(partial.notifications ?? {}),
    },
  };
}

/**
 * Calculate pagination offset
 * @param page Page number (1-indexed)
 * @param pageSize Number of items per page
 * @returns Offset for database query
 */
export function calculateOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
