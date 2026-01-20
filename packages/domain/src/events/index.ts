/**
 * Domain events module
 */

export {
  createDomainEventBus,
  getDefaultEventBus,
  setDefaultEventBus,
  createDomainEvent,
  emitDomainEvent,
  subscribeToDomainEvent,
  type DomainEventBus,
} from './bus.js';

export {
  clientEvents,
  brandkitEvents,
  knowledgebaseEvents,
  offerEvents,
} from './emitters.js';

export {
  DomainEventTypes,
  domainEventSchema,
  type DomainEvent,
  type DomainEventType,
  type EventHandler,
  type EventFilterOptions,
  type EventMetadata,
} from './types.js';
