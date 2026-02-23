import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import type { DatabaseInstance } from './client';

/**
 * Run pending Drizzle migrations against the database.
 * Uses the migration files from `packages/db/drizzle/`.
 *
 * Usage:
 *   import { createDb } from '@repo/db/client';
 *   import { runMigrations } from '@repo/db/migrate';
 *   const db = createDb({ databaseUrl: process.env.SERVER_POSTGRES_URL });
 *   await runMigrations(db);
 */
export const runMigrations = async (
  db: DatabaseInstance,
  migrationsFolder?: string,
): Promise<void> => {
  await drizzleMigrate(db, {
    migrationsFolder:
      migrationsFolder ?? new URL('../drizzle', import.meta.url).pathname,
  });
};
