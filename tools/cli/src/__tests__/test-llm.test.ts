import { LLM } from '@repo/ai';
import { MockLLMLive, createMockLLM } from '@repo/ai/testing';
import { Effect, Schema } from 'effect';
import { describe, it, expect } from 'vitest';
import type { LLMError } from '@repo/ai';
import { buildChatPrompt, parseBoundedNumber } from '../commands/test-llm';

describe('test-llm command logic', () => {
  it('builds a chat prompt with prior turns', () => {
    const prompt = buildChatPrompt(
      [
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Hi there' },
      ],
      'What can you do?',
    );

    expect(prompt).toContain('User: Hello');
    expect(prompt).toContain('Assistant: Hi there');
    expect(prompt).toContain('User: What can you do?');
    expect(prompt.endsWith('Assistant:')).toBe(true);
  });

  it('parses bounded numbers with fallback', () => {
    expect(parseBoundedNumber('1.2', { fallback: 0.7, min: 0, max: 2 })).toBe(
      1.2,
    );
    expect(
      parseBoundedNumber('not-a-number', { fallback: 0.7, min: 0, max: 2 }),
    ).toBe(0.7);
    expect(
      parseBoundedNumber('9000', { fallback: 1024, min: 1, max: 8192 }),
    ).toBe(1024);
    expect(
      parseBoundedNumber('99.9', {
        fallback: 128,
        min: 1,
        max: 200,
        integer: true,
      }),
    ).toBe(100);
  });

  it('calls LLM.generate with a schema and returns structured output', async () => {
    const TestSchema = Schema.Struct({
      greeting: Schema.String,
      fact: Schema.String,
    });

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const llm = yield* LLM;
        return yield* llm.generate({
          prompt: 'Generate a greeting and a fact',
          schema: TestSchema,
        });
      }).pipe(Effect.provide(MockLLMLive)),
    );

    expect(result.object).toBeDefined();
    expect(result.usage).toBeDefined();
    expect(result.usage?.totalTokens).toBe(300);
  });

  it('returns token usage metrics', async () => {
    const SimpleSchema = Schema.Struct({ message: Schema.String });

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const llm = yield* LLM;
        return yield* llm.generate({
          prompt: 'test',
          schema: SimpleSchema,
        });
      }).pipe(Effect.provide(MockLLMLive)),
    );

    expect(result.usage?.inputTokens).toBe(100);
    expect(result.usage?.outputTokens).toBe(200);
    expect(result.usage?.totalTokens).toBe(300);
  });

  it('surfaces LLMError when generation fails', async () => {
    const errorLayer = createMockLLM({ errorMessage: 'API key invalid' });
    const SimpleSchema = Schema.Struct({ message: Schema.String });

    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const llm = yield* LLM;
        return yield* llm.generate({
          prompt: 'test',
          schema: SimpleSchema,
        });
      }).pipe(Effect.provide(errorLayer)),
    );

    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure' && exit.cause._tag === 'Fail') {
      const error = exit.cause.error;
      expect(error?._tag).toBe('LLMError');
      expect((error as LLMError).message).toBe('API key invalid');
    }
  });
});
