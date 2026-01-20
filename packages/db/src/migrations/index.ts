/**
 * @rtv/db Migrations Exports
 *
 * Migration utilities and runner for database schema updates.
 * Uses Drizzle Kit for migration generation and execution.
 *
 * Commands:
 * - pnpm db:generate - Generate migrations from schema changes
 * - pnpm db:migrate - Apply pending migrations
 * - pnpm db:push - Push schema directly (development only)
 * - pnpm db:studio - Open Drizzle Studio for database inspection
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getDb, closeConnection } from '../connection.js';

/**
 * Run all pending migrations
 * @param migrationsFolder Path to migrations folder (default: './drizzle')
 */
export async function runMigrations(
  migrationsFolder = './drizzle'
): Promise<void> {
  const db = getDb();

  console.log('Running migrations...');

  try {
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Run migrations and close connection
 * Useful for CLI scripts and one-off migration runs
 */
export async function runMigrationsAndClose(
  migrationsFolder = './drizzle'
): Promise<void> {
  try {
    await runMigrations(migrationsFolder);
  } finally {
    await closeConnection();
  }
}
