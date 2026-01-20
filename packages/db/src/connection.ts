/**
 * @rtv/db - PostgreSQL Connection Pool
 *
 * Uses Drizzle ORM with postgres.js driver for high-performance queries.
 * Supports multi-tenant architecture with client_id scoping.
 */
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

// Connection configuration
const connectionConfig = {
  max: 10, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  prepare: false, // Disable prepared statements for serverless compatibility
};

// Singleton instances
let queryClient: Sql | null = null;
let db: PostgresJsDatabase | null = null;

/**
 * Get the database connection string from environment
 * @throws Error if DATABASE_URL is not set
 */
function getConnectionString(): string {
  const connectionString = process.env['DATABASE_URL'];

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
        'Please set it to your PostgreSQL connection string.'
    );
  }

  return connectionString;
}

/**
 * Initialize the database connection
 * Creates a new connection pool if one doesn't exist
 */
export function initializeConnection(): PostgresJsDatabase {
  if (db) {
    return db;
  }

  const connectionString = getConnectionString();
  queryClient = postgres(connectionString, connectionConfig);
  db = drizzle(queryClient);

  return db;
}

/**
 * Get the database instance
 * Initializes connection if not already initialized
 */
export function getDb(): PostgresJsDatabase {
  if (!db) {
    return initializeConnection();
  }
  return db;
}

/**
 * Test the database connection
 * @returns true if connection is successful, false otherwise
 */
export async function testConnection(): Promise<boolean> {
  try {
    const connectionString = getConnectionString();
    const testClient = postgres(connectionString, {
      ...connectionConfig,
      max: 1,
    });

    // Execute a simple query to test the connection
    await testClient`SELECT 1 as test`;
    await testClient.end();

    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Close the database connection pool
 * Should be called when shutting down the application
 */
export async function closeConnection(): Promise<void> {
  if (queryClient) {
    await queryClient.end();
    queryClient = null;
    db = null;
  }
}

/**
 * Execute a raw SQL query (for migrations and advanced use cases)
 * @param query SQL query to execute
 */
export async function executeRawQuery<T>(
  query: string
): Promise<T[]> {
  if (!queryClient) {
    initializeConnection();
  }

  if (!queryClient) {
    throw new Error('Failed to initialize database connection');
  }

  return queryClient.unsafe(query) as unknown as T[];
}

// Export types for external use
export type { PostgresJsDatabase };
