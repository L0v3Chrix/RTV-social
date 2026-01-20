/**
 * Domain event types
 */

import { z } from 'zod';

/**
 * All domain event types
 */
export const DomainEventTypes = {
  // Client events
  'client.created': 'client.created',
  'client.updated': 'client.updated',
  'client.activated': 'client.activated',
  'client.suspended': 'client.suspended',
  'client.deleted': 'client.deleted',

  // BrandKit events
  'brandkit.created': 'brandkit.created',
  'brandkit.updated': 'brandkit.updated',
  'brandkit.voiceStyleUpdated': 'brandkit.voiceStyleUpdated',
  'brandkit.visualTokensUpdated': 'brandkit.visualTokensUpdated',

  // KnowledgeBase events
  'knowledgebase.created': 'knowledgebase.created',
  'knowledgebase.updated': 'knowledgebase.updated',
  'knowledgebase.documentAdded': 'knowledgebase.documentAdded',
  'knowledgebase.documentUpdated': 'knowledgebase.documentUpdated',
  'knowledgebase.documentRemoved': 'knowledgebase.documentRemoved',
  'knowledgebase.faqAdded': 'knowledgebase.faqAdded',
  'knowledgebase.faqUpdated': 'knowledgebase.faqUpdated',
  'knowledgebase.faqRemoved': 'knowledgebase.faqRemoved',

  // Offer events
  'offer.created': 'offer.created',
  'offer.updated': 'offer.updated',
  'offer.activated': 'offer.activated',
  'offer.deactivated': 'offer.deactivated',
  'offer.deleted': 'offer.deleted',
} as const;

export type DomainEventType = keyof typeof DomainEventTypes;

/**
 * Event metadata
 */
export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  source?: string;
  [key: string]: unknown;
}

/**
 * Base domain event interface
 */
export interface DomainEvent<T extends DomainEventType = DomainEventType> {
  readonly id: string;
  readonly type: T;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly clientId: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: EventMetadata;
  readonly timestamp: Date;
}

/**
 * Event handler type
 */
export type EventHandler<T extends DomainEventType = DomainEventType> = (
  event: DomainEvent<T>
) => void | Promise<void>;

/**
 * Event filter options
 */
export interface EventFilterOptions {
  types?: DomainEventType[];
  since?: Date;
  until?: Date;
  limit?: number;
}

/**
 * Event schema for validation
 */
export const domainEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  aggregateType: z.string(),
  aggregateId: z.string(),
  clientId: z.string(),
  payload: z.record(z.unknown()),
  metadata: z.object({
    correlationId: z.string().optional(),
    causationId: z.string().optional(),
    userId: z.string().optional(),
    source: z.string().optional(),
  }).passthrough(),
  timestamp: z.date(),
});
