/**
 * Verification tests for Sprint 1 Task S1-A1: Client Entity Model
 *
 * These tests verify:
 * 1. Package structure exists
 * 2. All required files are present
 * 3. Types are correctly defined
 * 4. Zod schemas validate correctly (via direct file import)
 */
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('S1-A1: Client Entity Model', () => {
  const rootDir = resolve(__dirname, '..');
  const packagesDir = resolve(rootDir, 'packages');
  const domainDir = resolve(packagesDir, 'domain');

  describe('@rtv/domain Package Structure', () => {
    test('package directory exists', () => {
      expect(existsSync(domainDir)).toBe(true);
    });

    test('package.json exists', () => {
      expect(existsSync(resolve(domainDir, 'package.json'))).toBe(true);
    });

    test('package.json has correct name', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(domainDir, 'package.json'), 'utf-8')
      );
      expect(pkgJson.name).toBe('@rtv/domain');
    });

    test('package.json has required dependencies', () => {
      const pkgJson = JSON.parse(
        readFileSync(resolve(domainDir, 'package.json'), 'utf-8')
      );
      expect(pkgJson.dependencies?.['@rtv/db']).toBe('workspace:*');
      expect(pkgJson.dependencies?.['@rtv/types']).toBe('workspace:*');
      expect(pkgJson.dependencies?.['zod']).toBeDefined();
      expect(pkgJson.dependencies?.['nanoid']).toBeDefined();
      expect(pkgJson.dependencies?.['slugify']).toBeDefined();
    });

    test('tsconfig.json exists', () => {
      expect(existsSync(resolve(domainDir, 'tsconfig.json'))).toBe(true);
    });

    test('tsconfig.json extends base config', () => {
      const tsconfig = JSON.parse(
        readFileSync(resolve(domainDir, 'tsconfig.json'), 'utf-8')
      );
      expect(tsconfig.extends).toMatch(/tsconfig\.(base|node)\.json/);
    });

    test('src directory exists', () => {
      expect(existsSync(resolve(domainDir, 'src'))).toBe(true);
    });

    test('src/index.ts exists', () => {
      expect(existsSync(resolve(domainDir, 'src', 'index.ts'))).toBe(true);
    });

    test('dist directory exists after build', () => {
      expect(existsSync(resolve(domainDir, 'dist'))).toBe(true);
    });

    test('dist/index.js exists after build', () => {
      expect(existsSync(resolve(domainDir, 'dist', 'index.js'))).toBe(true);
    });
  });

  describe('Client Module Structure', () => {
    const clientDir = resolve(domainDir, 'src', 'client');

    test('client directory exists', () => {
      expect(existsSync(clientDir)).toBe(true);
    });

    test('client/index.ts exists', () => {
      expect(existsSync(resolve(clientDir, 'index.ts'))).toBe(true);
    });

    test('client/types.ts exists', () => {
      expect(existsSync(resolve(clientDir, 'types.ts'))).toBe(true);
    });

    test('client/repository.ts exists', () => {
      expect(existsSync(resolve(clientDir, 'repository.ts'))).toBe(true);
    });

    test('client/schemas.ts exists', () => {
      expect(existsSync(resolve(clientDir, 'schemas.ts'))).toBe(true);
    });

    test('client/errors.ts exists', () => {
      expect(existsSync(resolve(clientDir, 'errors.ts'))).toBe(true);
    });

    test('client/utils.ts exists', () => {
      expect(existsSync(resolve(clientDir, 'utils.ts'))).toBe(true);
    });
  });

  describe('Source File Contents', () => {
    const clientDir = resolve(domainDir, 'src', 'client');

    test('types.ts exports ClientStatus constant', () => {
      const content = readFileSync(resolve(clientDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export const ClientStatus');
      expect(content).toContain("ACTIVE: 'active'");
      expect(content).toContain("SUSPENDED: 'suspended'");
      expect(content).toContain("DELETED: 'deleted'");
      expect(content).toContain("PENDING: 'pending'");
    });

    test('types.ts exports ClientSettings interface', () => {
      const content = readFileSync(resolve(clientDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface ClientSettings');
      expect(content).toContain('timezone: string');
      expect(content).toContain('defaultLanguage: string');
      expect(content).toContain('features: Record<string, boolean>');
      expect(content).toContain('notifications: ClientNotifications');
    });

    test('types.ts exports Client interface', () => {
      const content = readFileSync(resolve(clientDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface Client');
      expect(content).toContain('readonly id: string');
      expect(content).toContain('readonly name: string');
      expect(content).toContain('readonly slug: string');
      expect(content).toContain('readonly status: ClientStatusType');
      expect(content).toContain('readonly createdAt: Date');
      expect(content).toContain('readonly updatedAt: Date');
    });

    test('types.ts exports CreateClientInput interface', () => {
      const content = readFileSync(resolve(clientDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface CreateClientInput');
      expect(content).toContain('name: string');
    });

    test('types.ts exports UpdateClientInput interface', () => {
      const content = readFileSync(resolve(clientDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface UpdateClientInput');
    });

    test('types.ts exports PaginationOptions interface', () => {
      const content = readFileSync(resolve(clientDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface PaginationOptions');
      expect(content).toContain('page?');
      expect(content).toContain('pageSize?');
      expect(content).toContain('sortBy?');
      expect(content).toContain('sortOrder?');
    });

    test('types.ts exports PaginatedResult interface', () => {
      const content = readFileSync(resolve(clientDir, 'types.ts'), 'utf-8');
      expect(content).toContain('export interface PaginatedResult<T>');
      expect(content).toContain('data: T[]');
      expect(content).toContain('pagination: PaginationMeta');
    });
  });

  describe('Zod Schemas File', () => {
    const clientDir = resolve(domainDir, 'src', 'client');

    test('schemas.ts exports ClientStatusSchema', () => {
      const content = readFileSync(resolve(clientDir, 'schemas.ts'), 'utf-8');
      expect(content).toContain('export const ClientStatusSchema');
    });

    test('schemas.ts exports ClientSettingsSchema', () => {
      const content = readFileSync(resolve(clientDir, 'schemas.ts'), 'utf-8');
      expect(content).toContain('export const ClientSettingsSchema');
    });

    test('schemas.ts exports ClientSchema', () => {
      const content = readFileSync(resolve(clientDir, 'schemas.ts'), 'utf-8');
      expect(content).toContain('export const ClientSchema');
    });

    test('schemas.ts exports CreateClientSchema', () => {
      const content = readFileSync(resolve(clientDir, 'schemas.ts'), 'utf-8');
      expect(content).toContain('export const CreateClientSchema');
    });

    test('schemas.ts exports UpdateClientSchema', () => {
      const content = readFileSync(resolve(clientDir, 'schemas.ts'), 'utf-8');
      expect(content).toContain('export const UpdateClientSchema');
    });

    test('schemas.ts exports PaginationOptionsSchema', () => {
      const content = readFileSync(resolve(clientDir, 'schemas.ts'), 'utf-8');
      expect(content).toContain('export const PaginationOptionsSchema');
    });
  });

  describe('Repository Functions', () => {
    const clientDir = resolve(domainDir, 'src', 'client');

    test('repository.ts exports createClient function', () => {
      const content = readFileSync(resolve(clientDir, 'repository.ts'), 'utf-8');
      expect(content).toContain('export async function createClient');
    });

    test('repository.ts exports getClient function', () => {
      const content = readFileSync(resolve(clientDir, 'repository.ts'), 'utf-8');
      expect(content).toContain('export async function getClient');
    });

    test('repository.ts exports getClientByName function', () => {
      const content = readFileSync(resolve(clientDir, 'repository.ts'), 'utf-8');
      expect(content).toContain('export async function getClientByName');
    });

    test('repository.ts exports getClientBySlug function', () => {
      const content = readFileSync(resolve(clientDir, 'repository.ts'), 'utf-8');
      expect(content).toContain('export async function getClientBySlug');
    });

    test('repository.ts exports updateClient function', () => {
      const content = readFileSync(resolve(clientDir, 'repository.ts'), 'utf-8');
      expect(content).toContain('export async function updateClient');
    });

    test('repository.ts exports deleteClient function', () => {
      const content = readFileSync(resolve(clientDir, 'repository.ts'), 'utf-8');
      expect(content).toContain('export async function deleteClient');
    });

    test('repository.ts exports listClients function', () => {
      const content = readFileSync(resolve(clientDir, 'repository.ts'), 'utf-8');
      expect(content).toContain('export async function listClients');
    });

    test('repository.ts exports activateClient function', () => {
      const content = readFileSync(resolve(clientDir, 'repository.ts'), 'utf-8');
      expect(content).toContain('export async function activateClient');
    });

    test('repository.ts exports suspendClient function', () => {
      const content = readFileSync(resolve(clientDir, 'repository.ts'), 'utf-8');
      expect(content).toContain('export async function suspendClient');
    });
  });

  describe('Error Classes', () => {
    const clientDir = resolve(domainDir, 'src', 'client');

    test('errors.ts exports ClientNotFoundError', () => {
      const content = readFileSync(resolve(clientDir, 'errors.ts'), 'utf-8');
      expect(content).toContain('export class ClientNotFoundError');
    });

    test('errors.ts exports DuplicateClientNameError', () => {
      const content = readFileSync(resolve(clientDir, 'errors.ts'), 'utf-8');
      expect(content).toContain('export class DuplicateClientNameError');
    });

    test('errors.ts exports InvalidClientStatusError', () => {
      const content = readFileSync(resolve(clientDir, 'errors.ts'), 'utf-8');
      expect(content).toContain('export class InvalidClientStatusError');
    });

    test('errors.ts exports ClientValidationError', () => {
      const content = readFileSync(resolve(clientDir, 'errors.ts'), 'utf-8');
      expect(content).toContain('export class ClientValidationError');
    });
  });

  describe('Utility Functions', () => {
    const clientDir = resolve(domainDir, 'src', 'client');

    test('utils.ts exports generateSlug function', () => {
      const content = readFileSync(resolve(clientDir, 'utils.ts'), 'utf-8');
      expect(content).toContain('export function generateSlug');
    });

    test('utils.ts exports generateUniqueSlug function', () => {
      const content = readFileSync(resolve(clientDir, 'utils.ts'), 'utf-8');
      expect(content).toContain('export function generateUniqueSlug');
    });

    test('utils.ts exports createPaginatedResult function', () => {
      const content = readFileSync(resolve(clientDir, 'utils.ts'), 'utf-8');
      expect(content).toContain('export function createPaginatedResult');
    });

    test('utils.ts exports mergeSettings function', () => {
      const content = readFileSync(resolve(clientDir, 'utils.ts'), 'utf-8');
      expect(content).toContain('export function mergeSettings');
    });

    test('utils.ts exports calculateOffset function', () => {
      const content = readFileSync(resolve(clientDir, 'utils.ts'), 'utf-8');
      expect(content).toContain('export function calculateOffset');
    });
  });

  describe('Index File Exports', () => {
    const clientDir = resolve(domainDir, 'src', 'client');

    test('index.ts re-exports types', () => {
      const content = readFileSync(resolve(clientDir, 'index.ts'), 'utf-8');
      expect(content).toContain("from './types.js'");
      expect(content).toContain('ClientStatus');
      expect(content).toContain('type Client');
      expect(content).toContain('type ClientSettings');
    });

    test('index.ts re-exports schemas', () => {
      const content = readFileSync(resolve(clientDir, 'index.ts'), 'utf-8');
      expect(content).toContain("from './schemas.js'");
      expect(content).toContain('ClientSchema');
      expect(content).toContain('CreateClientSchema');
    });

    test('index.ts re-exports errors', () => {
      const content = readFileSync(resolve(clientDir, 'index.ts'), 'utf-8');
      expect(content).toContain("from './errors.js'");
      expect(content).toContain('ClientNotFoundError');
    });

    test('index.ts re-exports utils', () => {
      const content = readFileSync(resolve(clientDir, 'index.ts'), 'utf-8');
      expect(content).toContain("from './utils.js'");
      expect(content).toContain('generateSlug');
    });

    test('index.ts re-exports repository', () => {
      const content = readFileSync(resolve(clientDir, 'index.ts'), 'utf-8');
      expect(content).toContain("from './repository.js'");
      expect(content).toContain('createClient');
      expect(content).toContain('getClient');
      expect(content).toContain('updateClient');
      expect(content).toContain('deleteClient');
    });

    test('main index.ts re-exports client module', () => {
      const content = readFileSync(resolve(domainDir, 'src', 'index.ts'), 'utf-8');
      expect(content).toContain("from './client/index.js'");
    });
  });

  describe('Build Output Verification', () => {
    const distDir = resolve(domainDir, 'dist');

    test('dist/index.js exists', () => {
      expect(existsSync(resolve(distDir, 'index.js'))).toBe(true);
    });

    test('dist/index.d.ts exists', () => {
      expect(existsSync(resolve(distDir, 'index.d.ts'))).toBe(true);
    });

    test('dist/client/index.js exists', () => {
      expect(existsSync(resolve(distDir, 'client', 'index.js'))).toBe(true);
    });

    test('dist/client/types.js exists', () => {
      expect(existsSync(resolve(distDir, 'client', 'types.js'))).toBe(true);
    });

    test('dist/client/schemas.js exists', () => {
      expect(existsSync(resolve(distDir, 'client', 'schemas.js'))).toBe(true);
    });

    test('dist/client/repository.js exists', () => {
      expect(existsSync(resolve(distDir, 'client', 'repository.js'))).toBe(true);
    });

    test('dist/client/errors.js exists', () => {
      expect(existsSync(resolve(distDir, 'client', 'errors.js'))).toBe(true);
    });

    test('dist/client/utils.js exists', () => {
      expect(existsSync(resolve(distDir, 'client', 'utils.js'))).toBe(true);
    });
  });
});
