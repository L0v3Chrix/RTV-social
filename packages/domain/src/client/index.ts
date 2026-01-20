/**
 * Client Module
 *
 * Exports all Client entity types, schemas, and operations.
 */

// Types
export {
  ClientStatus,
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_PAGINATION,
  type ClientStatusType,
  type ClientNotifications,
  type ClientSettings,
  type PartialClientSettings,
  type Client,
  type CreateClientInput,
  type UpdateClientInput,
  type PaginationOptions,
  type PaginationMeta,
  type PaginatedResult,
  type ListClientsOptions,
} from './types.js';

// Zod Schemas
export {
  ClientStatusSchema,
  ClientNotificationsSchema,
  ClientSettingsSchema,
  ClientSchema,
  CreateClientSchema,
  UpdateClientSchema,
  PaginationOptionsSchema,
  ListClientsOptionsSchema,
  type CreateClientSchemaType,
  type UpdateClientSchemaType,
  type ClientSchemaType,
  type PaginationOptionsSchemaType,
  type ListClientsOptionsSchemaType,
} from './schemas.js';

// Errors
export {
  ClientError,
  ClientNotFoundError,
  DuplicateClientNameError,
  DuplicateClientSlugError,
  InvalidClientStatusError,
  ClientValidationError,
} from './errors.js';

// Utility Functions
export {
  generateSlug,
  generateUniqueSlug,
  createPaginatedResult,
  mergeSettings,
  calculateOffset,
} from './utils.js';

// Repository Functions
export {
  createClient,
  getClient,
  getClientByName,
  getClientBySlug,
  updateClient,
  deleteClient,
  listClients,
  activateClient,
  suspendClient,
} from './repository.js';
