/* eslint-disable no-console, no-restricted-properties -- test infrastructure: console logging and process.env are intentional */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as schema from '@repo/db/schema';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { DatabaseInstance } from '@repo/db/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Reused across test files in the same process to avoid repeated startup. */
let globalContainer: StartedPostgreSqlContainer | undefined;
let globalPool: pg.Pool | undefined;
let schemaPushed = false;

export async function startPostgresContainer(): Promise<{
  container: StartedPostgreSqlContainer;
  connectionString: string;
}> {
  if (globalContainer) {
    return {
      container: globalContainer,
      connectionString: globalContainer.getConnectionUri(),
    };
  }

  console.log('[Testcontainers] Starting PostgreSQL container...');

  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('agent_engine_template_test')
    .withUsername('test')
    .withPassword('test')
    .withExposedPorts(5432)
    .start();

  globalContainer = container;

  const connectionString = container.getConnectionUri();
  console.log(`[Testcontainers] PostgreSQL ready at ${connectionString}`);

  if (!schemaPushed) {
    await pushSchema(connectionString);
    schemaPushed = true;
  }

  return { container, connectionString };
}

/**
 * Run drizzle-kit push against the test database.
 * The connectionString is a trusted internal value from testcontainers, not user input.
 */
export async function pushSchema(connectionString: string): Promise<void> {
  console.log('[Testcontainers] Pushing schema via drizzle-kit...');

  const monorepoRoot = path.resolve(__dirname, '../../../../..');

  try {
    // Safe: connectionString comes from testcontainers, passed via env var (not shell-interpolated)
    execSync(`pnpm --filter @repo/db exec drizzle-kit push`, {
      cwd: monorepoRoot,
      env: {
        ...process.env,
        DB_POSTGRES_URL: connectionString,
      },
      stdio: 'pipe',
    });
    console.log('[Testcontainers] Schema pushed successfully');
  } catch (error) {
    console.error('[Testcontainers] Schema push failed:', error);
    throw error;
  }
}

export async function getTestDb(): Promise<{
  db: DatabaseInstance;
  pool: pg.Pool;
}> {
  if (!globalContainer) {
    throw new Error(
      'PostgreSQL container not started. Call startPostgresContainer() first.',
    );
  }

  if (!globalPool) {
    globalPool = new pg.Pool({
      connectionString: globalContainer.getConnectionUri(),
      max: 10,
    });
  }

  const db: DatabaseInstance = drizzle(globalPool, { schema });

  return { db, pool: globalPool };
}

export async function stopPostgresContainer(): Promise<void> {
  console.log('[Testcontainers] Stopping PostgreSQL container...');

  if (globalPool) {
    await globalPool.end();
    globalPool = undefined;
  }

  if (globalContainer) {
    await globalContainer.stop();
    globalContainer = undefined;
  }

  console.log('[Testcontainers] PostgreSQL stopped');
}

export function getConnectionString(): string {
  if (!globalContainer) {
    throw new Error(
      'PostgreSQL container not started. Call startPostgresContainer() first.',
    );
  }
  return globalContainer.getConnectionUri();
}

export function isContainerRunning(): boolean {
  return globalContainer !== undefined;
}
