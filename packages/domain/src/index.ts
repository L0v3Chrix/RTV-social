/**
 * @rtv/domain - Domain Models and Business Logic
 *
 * This package contains all domain entities, value objects, and business logic
 * for the RTV Social Automation Platform.
 */

// Client Module - Re-export everything
export * from './client/index.js';

// BrandKit Module - Re-export everything
export * from './brandkit/index.js';

// KnowledgeBase Module (RLM External Memory) - Re-export everything
export * from './knowledgebase/index.js';

// Offer Module - Re-export everything
export * from './offer/index.js';

// Domain Events - Re-export everything
export * from './events/index.js';

// Version
export const VERSION = '0.0.0';
