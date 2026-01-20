#!/usr/bin/env tsx
/**
 * @rtv/db Seed CLI
 *
 * Command-line interface for database seeding operations.
 *
 * Usage:
 *   pnpm db:seed        - Seed the database with sample data
 *   pnpm db:seed:clear  - Remove all seed data
 *   pnpm db:seed:reset  - Clear and re-seed the database
 */

import { seed, clearSeedData, reseed } from './index.js';
import { closeConnection } from '../connection.js';

type Command = 'seed' | 'clear' | 'reset' | 'help';

const COMMANDS: Record<Command, string> = {
  seed: 'Seed the database with sample data (idempotent)',
  clear: 'Remove all seed data from the database',
  reset: 'Clear and re-seed the database',
  help: 'Show this help message',
};

function printHelp(): void {
  console.log('Database Seed CLI\n');
  console.log('Usage: tsx cli.ts <command>\n');
  console.log('Commands:');
  Object.entries(COMMANDS).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(10)} ${desc}`);
  });
  console.log('\nExamples:');
  console.log('  tsx cli.ts seed      # Seed the database');
  console.log('  tsx cli.ts clear     # Clear seed data');
  console.log('  tsx cli.ts reset     # Clear and re-seed');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] as Command | undefined;

  if (!command || command === 'help') {
    printHelp();
    process.exit(0);
  }

  if (!Object.keys(COMMANDS).includes(command)) {
    console.error(`Unknown command: ${command}\n`);
    printHelp();
    process.exit(1);
  }

  try {
    switch (command) {
      case 'seed': {
        const result = await seed();
        process.exit(result.errors.length > 0 ? 1 : 0);
        break;
      }

      case 'clear': {
        const result = await clearSeedData();
        process.exit(result.errors.length > 0 ? 1 : 0);
        break;
      }

      case 'reset': {
        const result = await reseed();
        const hasErrors =
          result.clearResult.errors.length > 0 ||
          result.seedResult.errors.length > 0;
        process.exit(hasErrors ? 1 : 0);
        break;
      }
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

// Run the CLI
main().catch((error: unknown) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
