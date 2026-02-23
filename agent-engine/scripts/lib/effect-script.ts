import { Effect } from 'effect';

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

export const runScript = (run: () => Promise<void>): void => {
  void Effect.runPromise(
    Effect.tryPromise({
      try: run,
      catch: toError,
    }),
  ).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
};
