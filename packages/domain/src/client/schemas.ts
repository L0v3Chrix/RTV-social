/**
 * Client Zod Validation Schemas
 *
 * Provides runtime validation for all Client-related inputs and outputs.
 */
import { z } from 'zod';
import { ClientStatus, DEFAULT_CLIENT_SETTINGS } from './types.js';

/**
 * Client status schema
 */
export const ClientStatusSchema = z.enum([
  ClientStatus.ACTIVE,
  ClientStatus.SUSPENDED,
  ClientStatus.DELETED,
  ClientStatus.PENDING,
]);

/**
 * Client notifications schema
 */
export const ClientNotificationsSchema = z.object({
  email: z.boolean(),
  slack: z.boolean(),
});

/**
 * Client settings schema
 */
export const ClientSettingsSchema = z.object({
  timezone: z.string().min(1).default(DEFAULT_CLIENT_SETTINGS.timezone),
  defaultLanguage: z.string().min(1).default(DEFAULT_CLIENT_SETTINGS.defaultLanguage),
  features: z.record(z.string(), z.boolean()).default({}),
  notifications: ClientNotificationsSchema.default(DEFAULT_CLIENT_SETTINGS.notifications),
});

/**
 * Full client schema
 */
export const ClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  description: z.string().nullable(),
  status: ClientStatusSchema,
  settings: ClientSettingsSchema,
  suspensionReason: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

/**
 * Schema for creating a new client
 */
export const CreateClientSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  settings: ClientSettingsSchema.partial().optional(),
});

/**
 * Schema for updating a client
 */
export const UpdateClientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  settings: ClientSettingsSchema.partial().optional(),
});

/**
 * Pagination options schema
 */
export const PaginationOptionsSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(20),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * List clients options schema
 */
export const ListClientsOptionsSchema = PaginationOptionsSchema.extend({
  status: ClientStatusSchema.optional(),
  search: z.string().optional(),
});

/**
 * Type exports from schemas
 */
export type CreateClientSchemaType = z.infer<typeof CreateClientSchema>;
export type UpdateClientSchemaType = z.infer<typeof UpdateClientSchema>;
export type ClientSchemaType = z.infer<typeof ClientSchema>;
export type PaginationOptionsSchemaType = z.infer<typeof PaginationOptionsSchema>;
export type ListClientsOptionsSchemaType = z.infer<typeof ListClientsOptionsSchema>;
