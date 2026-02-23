import { Command } from '@effect/cli';
import { Storage } from '@repo/storage';
import { Console, Effect } from 'effect';
import { createStorageLayer } from '../lib/storage-layer';

const TEST_KEY = 'cli-test/hello.txt';
const TEST_DATA = Buffer.from('Hello from CLI storage test!');
const TEST_CONTENT_TYPE = 'text/plain';

class StepError {
  readonly _tag = 'StepError';
  constructor(
    readonly step: string,
    readonly cause: unknown,
  ) {}
}

const runStorageTest = Effect.gen(function* () {
  yield* Console.log('\nRunning storage CRUD lifecycle test...\n');

  const storageLayer = createStorageLayer();

  const step = <E>(
    name: string,
    effect: Effect.Effect<string, E, Storage>,
  ): Effect.Effect<void, StepError> =>
    Effect.provide(effect, storageLayer).pipe(
      Effect.flatMap((result) => Console.log(`  PASS  ${name} — ${result}`)),
      Effect.mapError((error) => new StepError(name, error)),
    );

  // Upload
  yield* step(
    'upload',
    Effect.gen(function* () {
      const storage = yield* Storage;
      const url = yield* storage.upload(TEST_KEY, TEST_DATA, TEST_CONTENT_TYPE);
      return `url=${url}`;
    }),
  );

  // Exists (should be true)
  yield* step(
    'exists',
    Effect.gen(function* () {
      const storage = yield* Storage;
      const exists = yield* storage.exists(TEST_KEY);
      return `exists=${exists}`;
    }),
  );

  // Download and verify roundtrip
  yield* step(
    'download',
    Effect.gen(function* () {
      const storage = yield* Storage;
      const buf = yield* storage.download(TEST_KEY);
      const match = buf.toString() === TEST_DATA.toString();
      return `roundtrip=${match ? 'OK' : 'MISMATCH'}`;
    }),
  );

  // Get URL
  yield* step(
    'getUrl',
    Effect.gen(function* () {
      const storage = yield* Storage;
      const url = yield* storage.getUrl(TEST_KEY);
      return `url=${url}`;
    }),
  );

  // Delete
  yield* step(
    'delete',
    Effect.gen(function* () {
      const storage = yield* Storage;
      yield* storage.delete(TEST_KEY);
      return 'deleted';
    }),
  );

  // Verify deleted
  yield* step(
    'verify deleted',
    Effect.gen(function* () {
      const storage = yield* Storage;
      const exists = yield* storage.exists(TEST_KEY);
      return `exists=${exists} (expected false)`;
    }),
  );

  yield* Console.log('\nAll storage tests passed.');
}).pipe(
  Effect.catchAll((error) =>
    Console.log(`\n  FAIL  ${error.step} — ${String(error.cause)}`).pipe(
      Effect.flatMap(() =>
        Console.log('\nStorage test aborted due to failure.'),
      ),
    ),
  ),
);

export const testStorage = Command.make(
  'storage',
  {},
  () => runStorageTest,
).pipe(Command.withDescription('Test storage CRUD lifecycle'));
