/**
 * Client Entity Types
 *
 * The Client is the root tenant entity for multi-tenancy.
 * Every other entity in the system references a client.
 */

/**
 * Client status enumeration
 */
export const ClientStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
  PENDING: 'pending',
} as const;

export type ClientStatusType = (typeof ClientStatus)[keyof typeof ClientStatus];

/**
 * Client notification settings
 */
export interface ClientNotifications {
  email: boolean;
  slack: boolean;
}

/**
 * Client settings configuration
 */
export interface ClientSettings {
  timezone: string;
  defaultLanguage: string;
  features: Record<string, boolean>;
  notifications: ClientNotifications;
}

/**
 * Partial client settings for input
 */
export interface PartialClientSettings {
  timezone?: string | undefined;
  defaultLanguage?: string | undefined;
  features?: Record<string, boolean> | undefined;
  notifications?: Partial<ClientNotifications> | undefined;
}

/**
 * Default client settings
 */
export const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
  timezone: 'UTC',
  defaultLanguage: 'en',
  features: {},
  notifications: {
    email: true,
    slack: false,
  },
};

/**
 * Full Client entity
 */
export interface Client {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: ClientStatusType;
  readonly settings: ClientSettings;
  readonly suspensionReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

/**
 * Input for creating a new client
 */
export interface CreateClientInput {
  name: string;
  slug?: string | undefined;
  description?: string | null;
  settings?: PartialClientSettings | undefined;
}

/**
 * Input for updating a client
 */
export interface UpdateClientInput {
  name?: string | undefined;
  description?: string | null | undefined;
  settings?: PartialClientSettings | undefined;
}

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  page?: number | undefined;
  pageSize?: number | undefined;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGINATION = {
  page: 1 as const,
  pageSize: 20 as const,
  sortBy: 'createdAt' as const,
  sortOrder: 'desc' as const,
} satisfies {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Options for listing clients
 */
export interface ListClientsOptions extends PaginationOptions {
  status?: ClientStatusType | undefined;
  search?: string | undefined;
}
