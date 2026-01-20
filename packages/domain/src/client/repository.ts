/**
 * Client Repository
 *
 * Database operations for the Client entity.
 * All functions require a database connection to be passed in.
 */
import { eq, and, like, sql, desc, asc, isNull, or } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { clients } from '@rtv/db/schema';
import type {
  Client,
  CreateClientInput,
  UpdateClientInput,
  ListClientsOptions,
  PaginatedResult,
  ClientSettings,
  PartialClientSettings,
} from './types.js';
import { ClientStatus, DEFAULT_PAGINATION, DEFAULT_CLIENT_SETTINGS } from './types.js';
import { CreateClientSchema, UpdateClientSchema, ListClientsOptionsSchema } from './schemas.js';
import {
  ClientNotFoundError,
  DuplicateClientNameError,
  DuplicateClientSlugError,
  InvalidClientStatusError,
  ClientValidationError,
} from './errors.js';
import {
  generateSlug,
  generateUniqueSlug,
  createPaginatedResult,
  mergeSettings,
  calculateOffset,
} from './utils.js';

/**
 * Map database row to Client entity
 */
function mapToClient(row: typeof clients.$inferSelect): Client {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: null, // Not in current schema, defaulting to null
    status: row.isActive ? ClientStatus.ACTIVE : ClientStatus.SUSPENDED,
    settings: (row.settings ?? DEFAULT_CLIENT_SETTINGS) as ClientSettings,
    suspensionReason: null, // Not in current schema, defaulting to null
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: null, // Using isActive for soft delete
  };
}

/**
 * Create a new client
 * @param db Database connection
 * @param input Client creation input
 * @returns The created client
 * @throws DuplicateClientNameError if name already exists
 * @throws DuplicateClientSlugError if slug already exists
 * @throws ClientValidationError if input validation fails
 */
export async function createClient(
  db: PostgresJsDatabase,
  input: CreateClientInput
): Promise<Client> {
  // Validate input
  const parseResult = CreateClientSchema.safeParse(input);
  if (!parseResult.success) {
    const errors: Record<string, string[]> = {};
    parseResult.error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path]?.push(err.message);
    });
    throw new ClientValidationError(errors);
  }

  const validatedInput = parseResult.data;

  // Check for duplicate name
  const existingByName = await getClientByName(db, validatedInput.name);
  if (existingByName) {
    throw new DuplicateClientNameError(validatedInput.name);
  }

  // Generate or validate slug
  let slug = validatedInput.slug ?? generateSlug(validatedInput.name);
  const existingBySlug = await getClientBySlug(db, slug);
  if (existingBySlug) {
    if (validatedInput.slug) {
      // User provided a slug that's already taken
      throw new DuplicateClientSlugError(slug);
    }
    // Auto-generated slug conflicts, generate unique one
    slug = generateUniqueSlug(validatedInput.name);
  }

  // Merge settings with defaults
  const settingsInput: PartialClientSettings | undefined = validatedInput.settings;
  const settings = mergeSettings(settingsInput);

  // Insert into database
  const [inserted] = await db
    .insert(clients)
    .values({
      name: validatedInput.name,
      slug,
      settings,
      isActive: true,
    })
    .returning();

  if (!inserted) {
    throw new Error('Failed to create client');
  }

  return mapToClient(inserted);
}

/**
 * Get a client by ID
 * @param db Database connection
 * @param id Client ID
 * @returns The client or null if not found
 */
export async function getClient(
  db: PostgresJsDatabase,
  id: string
): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!row) {
    return null;
  }

  return mapToClient(row);
}

/**
 * Get a client by name
 * @param db Database connection
 * @param name Client name
 * @returns The client or null if not found
 */
export async function getClientByName(
  db: PostgresJsDatabase,
  name: string
): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(clients)
    .where(eq(clients.name, name))
    .limit(1);

  if (!row) {
    return null;
  }

  return mapToClient(row);
}

/**
 * Get a client by slug
 * @param db Database connection
 * @param slug Client slug
 * @returns The client or null if not found
 */
export async function getClientBySlug(
  db: PostgresJsDatabase,
  slug: string
): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(clients)
    .where(eq(clients.slug, slug))
    .limit(1);

  if (!row) {
    return null;
  }

  return mapToClient(row);
}

/**
 * Update a client
 * @param db Database connection
 * @param id Client ID
 * @param input Update input
 * @returns The updated client
 * @throws ClientNotFoundError if client doesn't exist
 * @throws DuplicateClientNameError if new name already exists
 * @throws ClientValidationError if input validation fails
 */
export async function updateClient(
  db: PostgresJsDatabase,
  id: string,
  input: UpdateClientInput
): Promise<Client> {
  // Validate input
  const parseResult = UpdateClientSchema.safeParse(input);
  if (!parseResult.success) {
    const errors: Record<string, string[]> = {};
    parseResult.error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path]?.push(err.message);
    });
    throw new ClientValidationError(errors);
  }

  const validatedInput = parseResult.data;

  // Get existing client
  const existing = await getClient(db, id);
  if (!existing) {
    throw new ClientNotFoundError(id);
  }

  // Check for duplicate name if name is being changed
  if (validatedInput.name && validatedInput.name !== existing.name) {
    const existingByName = await getClientByName(db, validatedInput.name);
    if (existingByName && existingByName.id !== id) {
      throw new DuplicateClientNameError(validatedInput.name);
    }
  }

  // Build update values
  const updateValues: Partial<typeof clients.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (validatedInput.name !== undefined) {
    updateValues.name = validatedInput.name;
  }

  if (validatedInput.settings !== undefined) {
    // Create a partial settings object by merging existing and new
    const partialSettings: PartialClientSettings = {
      timezone: validatedInput.settings.timezone ?? existing.settings.timezone,
      defaultLanguage: validatedInput.settings.defaultLanguage ?? existing.settings.defaultLanguage,
      features: validatedInput.settings.features ?? existing.settings.features,
      notifications: validatedInput.settings.notifications ?? existing.settings.notifications,
    };
    updateValues.settings = mergeSettings(partialSettings);
  }

  // Perform update
  const [updated] = await db
    .update(clients)
    .set(updateValues)
    .where(eq(clients.id, id))
    .returning();

  if (!updated) {
    throw new Error('Failed to update client');
  }

  return mapToClient(updated);
}

/**
 * Soft delete a client
 * @param db Database connection
 * @param id Client ID
 * @returns The deleted client
 * @throws ClientNotFoundError if client doesn't exist
 */
export async function deleteClient(
  db: PostgresJsDatabase,
  id: string
): Promise<Client> {
  // Get existing client
  const existing = await getClient(db, id);
  if (!existing) {
    throw new ClientNotFoundError(id);
  }

  // Soft delete by setting isActive to false
  const [deleted] = await db
    .update(clients)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, id))
    .returning();

  if (!deleted) {
    throw new Error('Failed to delete client');
  }

  return {
    ...mapToClient(deleted),
    status: ClientStatus.DELETED,
    deletedAt: new Date(),
  };
}

/**
 * List clients with pagination and filtering
 * @param db Database connection
 * @param options List options including pagination and filters
 * @returns Paginated list of clients
 */
export async function listClients(
  db: PostgresJsDatabase,
  options?: ListClientsOptions
): Promise<PaginatedResult<Client>> {
  // Merge with explicit defaults - DEFAULT_PAGINATION has required values
  const page: number = options?.page ?? DEFAULT_PAGINATION.page;
  const pageSize: number = options?.pageSize ?? DEFAULT_PAGINATION.pageSize;
  const sortBy: string = options?.sortBy ?? DEFAULT_PAGINATION.sortBy;
  const sortOrder: 'asc' | 'desc' = options?.sortOrder ?? DEFAULT_PAGINATION.sortOrder;
  const status = options?.status;
  const search = options?.search;

  // Build conditions
  const conditions = [];

  // Filter by status
  if (status) {
    if (status === ClientStatus.ACTIVE) {
      conditions.push(eq(clients.isActive, true));
    } else if (status === ClientStatus.SUSPENDED || status === ClientStatus.DELETED) {
      conditions.push(eq(clients.isActive, false));
    }
  }

  // Search by name or slug
  if (search) {
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        like(clients.name, searchPattern),
        like(clients.slug, searchPattern)
      )
    );
  }

  // Get total count
  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(clients);

  if (conditions.length > 0) {
    countQuery.where(and(...conditions));
  }

  const [countResult] = await countQuery;
  const total = Number(countResult?.count ?? 0);

  // Get paginated results
  const offset = calculateOffset(page, pageSize);

  // Build order by
  const orderColumn = sortBy === 'name' ? clients.name : clients.createdAt;
  const orderDirection = sortOrder === 'asc' ? asc : desc;

  let query = db.select().from(clients);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const rows = await query
    .orderBy(orderDirection(orderColumn))
    .limit(pageSize)
    .offset(offset);

  const data = rows.map(mapToClient);

  return createPaginatedResult(data, { page, pageSize, total });
}

/**
 * Activate a client
 * @param db Database connection
 * @param id Client ID
 * @returns The activated client
 * @throws ClientNotFoundError if client doesn't exist
 * @throws InvalidClientStatusError if client is already active
 */
export async function activateClient(
  db: PostgresJsDatabase,
  id: string
): Promise<Client> {
  const existing = await getClient(db, id);
  if (!existing) {
    throw new ClientNotFoundError(id);
  }

  if (existing.status === ClientStatus.ACTIVE) {
    throw new InvalidClientStatusError(existing.status, ClientStatus.ACTIVE);
  }

  const [activated] = await db
    .update(clients)
    .set({
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, id))
    .returning();

  if (!activated) {
    throw new Error('Failed to activate client');
  }

  return mapToClient(activated);
}

/**
 * Suspend a client
 * @param db Database connection
 * @param id Client ID
 * @param reason Optional suspension reason
 * @returns The suspended client
 * @throws ClientNotFoundError if client doesn't exist
 * @throws InvalidClientStatusError if client is already suspended
 */
export async function suspendClient(
  db: PostgresJsDatabase,
  id: string,
  reason?: string
): Promise<Client> {
  const existing = await getClient(db, id);
  if (!existing) {
    throw new ClientNotFoundError(id);
  }

  if (existing.status === ClientStatus.SUSPENDED) {
    throw new InvalidClientStatusError(existing.status, ClientStatus.SUSPENDED);
  }

  const [suspended] = await db
    .update(clients)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, id))
    .returning();

  if (!suspended) {
    throw new Error('Failed to suspend client');
  }

  return {
    ...mapToClient(suspended),
    status: ClientStatus.SUSPENDED,
    suspensionReason: reason ?? null,
  };
}
