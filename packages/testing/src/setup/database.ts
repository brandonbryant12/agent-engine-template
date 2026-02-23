import { Db } from '@repo/db/effect';
import * as schema from '@repo/db/schema';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Layer } from 'effect';
import pg from 'pg';
import type { DatabaseInstance } from '@repo/db/client';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Drizzle instance with our schema but without the $client: Pool constraint.
 * Used in test contexts where the underlying client may be a PoolClient
 * (for transaction rollback) rather than a Pool.
 */
type TestDatabaseInstance = NodePgDatabase<typeof schema>;

export interface TestDatabaseConfig {
  connectionString?: string;
}

export const DEFAULT_TEST_CONNECTION =
  // eslint-disable-next-line no-restricted-properties -- test infrastructure, not production code
  process.env.TEST_POSTGRES_URL ??
  'postgres://test:test@localhost:5433/agent_engine_template_test';

export function createTestDatabase(config: TestDatabaseConfig = {}) {
  const connectionString = config.connectionString ?? DEFAULT_TEST_CONNECTION;

  const pool = new pg.Pool({
    connectionString,
    max: 10,
  });

  const db = drizzle(pool, { schema });

  return {
    db,
    pool,
    close: async () => {
      await pool.end();
    },
  };
}

export interface TestContext {
  db: TestDatabaseInstance;
  dbLayer: Layer.Layer<Db>;
  rollback: () => Promise<void>;
}

/**
 * Narrow cast: drizzle(PoolClient) produces $client: PoolClient but
 * DbService requires $client: Pool. The $client property is never accessed
 * in query code — only the NodePgDatabase query methods are used. This is
 * the single location where this cast exists. See DatabaseInstance type in
 * @repo/db/client for context.
 */
function toDbLayer(db: TestDatabaseInstance): Layer.Layer<Db> {
  return Layer.succeed(Db, { db: db as unknown as DatabaseInstance });
}

/**
 * Create a test context with a transaction that will be rolled back.
 * Each test gets a dedicated connection with an open transaction.
 */
export async function createTestContext(
  config: TestDatabaseConfig = {},
): Promise<TestContext> {
  const connectionString = config.connectionString ?? DEFAULT_TEST_CONNECTION;

  const pool = new pg.Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  await client.query('BEGIN');

  const db = drizzle(client, { schema });
  const dbLayer = toDbLayer(db);

  return {
    db,
    dbLayer,
    rollback: async () => {
      try {
        await client.query('ROLLBACK');
      } finally {
        client.release();
        await pool.end();
      }
    },
  };
}
