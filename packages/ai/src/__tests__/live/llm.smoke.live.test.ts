/**
 * Super simple LLM live smoke test.
 *
 * Runs one chat-style prompt and prints the full success result or full error.
 * Skipped by default unless GEMINI_API_KEY is set.
 *
 * Run with: GEMINI_API_KEY=xxx pnpm --filter @repo/ai test:live:llm:smoke
 */
import { inspect } from 'node:util';
import { it } from '@effect/vitest';
import { Effect, Exit, Schema } from 'effect';
import { describe, expect } from 'vitest';
import { GoogleLive, LLM } from '../../llm';
import { liveTestEnv } from './env';

const GEMINI_API_KEY = liveTestEnv.GEMINI_API_KEY;

describe.skipIf(!GEMINI_API_KEY)('LLM Live Smoke', () => {
  const layer = GoogleLive({ apiKey: GEMINI_API_KEY! });

  it.effect('runs one LLM chat and prints full success/error output', () =>
    Effect.gen(function* () {
      const ResponseSchema = Schema.Struct({
        response: Schema.String,
      });

      const exit = yield* Effect.gen(function* () {
        const llm = yield* LLM;
        return yield* llm.generate({
          prompt:
            'Reply with one short sentence that confirms this is a live smoke test.',
          schema: ResponseSchema,
          temperature: 0,
        });
      }).pipe(Effect.provide(layer), Effect.exit);

      if (Exit.isSuccess(exit)) {
        process.stdout.write(
          [
            '[LLM LIVE SMOKE] status=success',
            inspect(exit.value, { depth: null, colors: false }),
            '',
          ].join('\n'),
        );

        expect(exit.value.object.response.trim().length).toBeGreaterThan(0);
        return;
      }

      process.stdout.write(
        [
          '[LLM LIVE SMOKE] status=error',
          inspect(exit.cause, { depth: null, colors: false }),
          '',
        ].join('\n'),
      );

      return yield* Effect.failCause(exit.cause);
    }),
  );
});
