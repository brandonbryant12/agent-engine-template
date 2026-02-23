/* eslint-disable no-console, no-restricted-properties -- vitest global setup: console logging and process.env are intentional */
import {
  startPostgresContainer,
  stopPostgresContainer,
} from './testcontainers/postgres';

export default async function setup() {
  console.log('\n[Global Setup] Starting test infrastructure...');

  const { connectionString } = await startPostgresContainer();
  process.env.TEST_POSTGRES_URL = connectionString;

  console.log('[Global Setup] Test infrastructure ready\n');

  return async function teardown() {
    console.log('\n[Global Teardown] Cleaning up test infrastructure...');
    await stopPostgresContainer();
    console.log('[Global Teardown] Cleanup complete\n');
  };
}
