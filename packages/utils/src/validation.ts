/**
 * Validation utility functions
 */

import type { Result } from '@rtv/types';
import { ok, err } from '@rtv/types';

/**
 * Validate that a value is not null or undefined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  name: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${name} must be defined`);
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a string to a positive integer
 */
export function parsePositiveInt(str: string): Result<number, string> {
  const num = parseInt(str, 10);
  if (isNaN(num)) {
    return err('Invalid number');
  }
  if (num <= 0) {
    return err('Number must be positive');
  }
  return ok(num);
}

/**
 * Validate an object has all required keys
 */
export function hasRequiredKeys<T extends Record<string, unknown>>(
  obj: T,
  keys: (keyof T)[]
): boolean {
  return keys.every((key) => key in obj && obj[key] !== undefined);
}
