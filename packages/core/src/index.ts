/**
 * @rtv/core - Core utilities and shared logic
 *
 * This package provides core functionality used across the
 * RTV Social Automation Platform.
 */

export * from './constants.js';
export * from './errors.js';
export * from './config.js';
export * from './env.js';
export * from './memory/index.js';

// Re-export types and utils for convenience
export * from '@rtv/types';
export * from '@rtv/utils';

// Version
export const VERSION = '0.0.0';
