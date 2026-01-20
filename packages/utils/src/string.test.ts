/**
 * String utility tests
 */

import { describe, it, expect } from 'vitest';
import { truncate, slugify, randomString, isUUID } from './string.js';

describe('truncate', () => {
  it('returns original string if shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns original string if equal to maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and adds suffix if longer than maxLength', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('uses custom suffix', () => {
    expect(truncate('hello world', 9, '…')).toBe('hello wo…');
  });
});

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slugify('Hello! World?')).toBe('hello-world');
  });

  it('collapses multiple separators', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  hello world  ')).toBe('hello-world');
  });
});

describe('randomString', () => {
  it('generates string of specified length', () => {
    expect(randomString(10)).toHaveLength(10);
    expect(randomString(20)).toHaveLength(20);
  });

  it('generates alphanumeric characters', () => {
    const str = randomString(100);
    expect(str).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('generates different strings on each call', () => {
    const str1 = randomString(20);
    const str2 = randomString(20);
    expect(str1).not.toBe(str2);
  });
});

describe('isUUID', () => {
  it('returns true for valid UUID v4', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('returns true for valid UUID v1', () => {
    expect(isUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('returns false for invalid UUID', () => {
    expect(isUUID('not-a-uuid')).toBe(false);
    expect(isUUID('550e8400-e29b-41d4-a716')).toBe(false);
    expect(isUUID('')).toBe(false);
  });

  it('handles uppercase UUIDs', () => {
    expect(isUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });
});
