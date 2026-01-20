/**
 * Common type definitions used across the platform
 */

/** ISO 8601 date string */
export type ISODateString = string;

/** UUID v4 string */
export type UUID = string;

/** Timestamp in milliseconds since epoch */
export type Timestamp = number;

/** JSON-serializable value */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** JSON object type */
export type JsonObject = { [key: string]: JsonValue };

/** Brand type for nominal typing */
export type Brand<T, B> = T & { __brand: B };

/** Branded string types */
export type ClientId = Brand<string, 'ClientId'>;
export type UserId = Brand<string, 'UserId'>;
export type PlatformAccountId = Brand<string, 'PlatformAccountId'>;
