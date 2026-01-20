/**
 * Domain event emitters for entities
 */

import { createDomainEvent, emitDomainEvent } from './bus.js';
import type { EventMetadata } from './types.js';

/**
 * Client event emitters
 */
export const clientEvents = {
  async created(
    clientId: string,
    payload: { name: string; slug: string },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'client.created',
      'client',
      clientId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async updated(
    clientId: string,
    payload: { changes: string[] },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'client.updated',
      'client',
      clientId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async activated(clientId: string, metadata?: EventMetadata) {
    const event = createDomainEvent(
      'client.activated',
      'client',
      clientId,
      clientId,
      {},
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async suspended(
    clientId: string,
    payload: { reason?: string },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'client.suspended',
      'client',
      clientId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async deleted(clientId: string, metadata?: EventMetadata) {
    const event = createDomainEvent(
      'client.deleted',
      'client',
      clientId,
      clientId,
      {},
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },
};

/**
 * BrandKit event emitters
 */
export const brandkitEvents = {
  async created(
    brandkitId: string,
    clientId: string,
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'brandkit.created',
      'brandkit',
      brandkitId,
      clientId,
      {},
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async updated(
    brandkitId: string,
    clientId: string,
    payload: { changes: string[]; version: number },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'brandkit.updated',
      'brandkit',
      brandkitId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },
};

/**
 * KnowledgeBase event emitters
 */
export const knowledgebaseEvents = {
  async created(
    kbId: string,
    clientId: string,
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'knowledgebase.created',
      'knowledgebase',
      kbId,
      clientId,
      {},
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async documentAdded(
    kbId: string,
    clientId: string,
    payload: { documentId: string; title: string; spanCount: number },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'knowledgebase.documentAdded',
      'knowledgebase',
      kbId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async documentRemoved(
    kbId: string,
    clientId: string,
    payload: { documentId: string },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'knowledgebase.documentRemoved',
      'knowledgebase',
      kbId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },
};

/**
 * Offer event emitters
 */
export const offerEvents = {
  async created(
    offerId: string,
    clientId: string,
    payload: { name: string; type: string },
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'offer.created',
      'offer',
      offerId,
      clientId,
      payload,
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async activated(
    offerId: string,
    clientId: string,
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'offer.activated',
      'offer',
      offerId,
      clientId,
      {},
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },

  async deactivated(
    offerId: string,
    clientId: string,
    metadata?: EventMetadata
  ) {
    const event = createDomainEvent(
      'offer.deactivated',
      'offer',
      offerId,
      clientId,
      {},
      metadata
    );
    await emitDomainEvent(event);
    return event;
  },
};
