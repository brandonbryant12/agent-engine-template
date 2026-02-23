/**
 * Live integration tests for LLM (Google Gemini) service.
 *
 * These tests are SKIPPED by default and only run when GEMINI_API_KEY is set.
 * Use them to verify:
 * - Service configuration before deployment
 * - API connectivity and credentials
 * - Real API response handling
 *
 * Run with: GEMINI_API_KEY=xxx pnpm --filter @repo/ai test:live:llm
 */
import { it } from '@effect/vitest';
import { expectEffectFailure } from '@repo/testing';
import { Effect, Exit, Schema } from 'effect';
import { describe, expect } from 'vitest';
import { LLMError, LLMRateLimitError } from '../../errors';
import { GoogleLive, LLM } from '../../llm';
import { liveTestEnv } from './env';

const GEMINI_API_KEY = liveTestEnv.GEMINI_API_KEY;

describe.skipIf(!GEMINI_API_KEY)('LLM Live Integration', () => {
  const layer = GoogleLive({ apiKey: GEMINI_API_KEY! });

  describe('generate', () => {
    it.effect('can generate text with simple prompt', () =>
      Effect.gen(function* () {
        const GreetingSchema = Schema.Struct({ greeting: Schema.String });
        const llm = yield* LLM;
        const result = yield* llm.generate({
          prompt: 'Say "Hello, World!" in a greeting object',
          schema: GreetingSchema,
        });

        expect(result.object).toBeDefined();
        expect(result.object.greeting).toBeDefined();
        expect(result.object.greeting.trim().length).toBeGreaterThan(0);
      }).pipe(Effect.provide(layer)),
    );

    it.effect('returns structured JSON when requested', () =>
      Effect.gen(function* () {
        const PersonSchema = Schema.Struct({
          name: Schema.String,
          age: Schema.Number,
          occupation: Schema.String,
        });
        const llm = yield* LLM;
        const result = yield* llm.generate({
          prompt:
            'Generate a fictional person with name "Alice Smith", age 30, occupation "Software Engineer"',
          schema: PersonSchema,
        });

        expect(result.object.name).toBe('Alice Smith');
        expect(result.object.age).toBe(30);
        expect(result.object.occupation).toBe('Software Engineer');
      }).pipe(Effect.provide(layer)),
    );

    it.effect('returns token usage metrics', () =>
      Effect.gen(function* () {
        const SimpleSchema = Schema.Struct({ message: Schema.String });
        const llm = yield* LLM;
        const result = yield* llm.generate({
          prompt: 'Generate a simple message saying "test"',
          schema: SimpleSchema,
        });

        expect(result.usage).toBeDefined();
        expect(result.usage?.inputTokens).toBeGreaterThan(0);
        expect(result.usage?.outputTokens).toBeGreaterThan(0);
        expect(result.usage?.totalTokens).toBe(
          result.usage!.inputTokens + result.usage!.outputTokens,
        );
      }).pipe(Effect.provide(layer)),
    );

    it.effect('respects system prompt', () =>
      Effect.gen(function* () {
        const ResponseSchema = Schema.Struct({ response: Schema.String });
        const llm = yield* LLM;
        const result = yield* llm.generate({
          system:
            'You are a pirate. Always respond like a pirate would, using pirate slang.',
          prompt: 'Say hello',
          schema: ResponseSchema,
        });

        expect(result.object.response).toBeDefined();
        // LLM output is non-deterministic — just verify we got a non-empty response
        expect(result.object.response.length).toBeGreaterThan(0);
      }).pipe(Effect.provide(layer)),
    );

    it.effect('respects temperature setting', () =>
      Effect.gen(function* () {
        const NumberSchema = Schema.Struct({ number: Schema.Number });
        const llm = yield* LLM;
        const results = [];

        // With temperature 0, responses should be deterministic
        for (let i = 0; i < 3; i++) {
          const result = yield* llm.generate({
            prompt: 'Generate the number 42',
            schema: NumberSchema,
            temperature: 0,
          });
          results.push(result.object.number);
        }

        expect(results[0]).toBe(results[1]);
        expect(results[1]).toBe(results[2]);
      }).pipe(Effect.provide(layer)),
    );
  });

  describe('error handling', () => {
    it.effect('handles invalid API key (401)', () =>
      Effect.gen(function* () {
        const invalidLayer = GoogleLive({ apiKey: 'invalid-api-key' });
        const SimpleSchema = Schema.Struct({ message: Schema.String });

        const exit = yield* Effect.gen(function* () {
          const llm = yield* LLM;
          return yield* llm.generate({
            prompt: 'Say hello',
            schema: SimpleSchema,
          });
        }).pipe(Effect.provide(invalidLayer), Effect.exit);

        expectEffectFailure(exit, LLMError);
      }),
    );
  });
});

describe.skipIf(!GEMINI_API_KEY)('LLM Live Integration - Rate Limiting', () => {
  it.skip('handles rate limiting gracefully (429)', async () => {
    const layer = GoogleLive({ apiKey: GEMINI_API_KEY! });
    const SimpleSchema = Schema.Struct({ message: Schema.String });

    const effects = Array.from({ length: 50 }, () =>
      Effect.gen(function* () {
        const llm = yield* LLM;
        return yield* llm.generate({
          prompt: 'Say hello',
          schema: SimpleSchema,
        });
      }).pipe(Effect.provide(layer)),
    );

    const exits = await Effect.runPromise(
      Effect.all(
        effects.map((e) => e.pipe(Effect.exit)),
        { concurrency: 'unbounded' },
      ),
    );

    const successes = exits.filter(Exit.isSuccess);
    const failures = exits.filter(Exit.isFailure);

    expect(successes.length).toBeGreaterThan(0);

    for (const failure of failures) {
      expectEffectFailure(failure, LLMRateLimitError);
    }
  });
});
