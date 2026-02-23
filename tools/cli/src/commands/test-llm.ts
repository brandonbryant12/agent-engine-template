import { Command, Prompt } from '@effect/cli';
import { LLM, LLM_MODEL } from '@repo/ai';
import { Console, Effect, Schema } from 'effect';
import { createAILayer } from '../lib/ai-layer';
import { loadEnv } from '../lib/env';

const GreetingSchema = Schema.Struct({
  greeting: Schema.String,
  fact: Schema.String,
});

const ResponseSchema = Schema.Struct({
  response: Schema.String,
});

const DEFAULT_MODEL = LLM_MODEL;
const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful assistant for Gemini API experiments. Keep replies concise and practical.';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;

type ExperimentMode = 'smoke' | 'single' | 'chat';

export interface ChatTurn {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

const normalizeOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseBoundedNumber = (
  rawValue: string,
  options: {
    readonly fallback: number;
    readonly min: number;
    readonly max: number;
    readonly integer?: boolean;
  },
): number => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return options.fallback;

  const nextValue = options.integer ? Math.round(parsed) : parsed;
  if (nextValue < options.min || nextValue > options.max) {
    return options.fallback;
  }

  return nextValue;
};

export const buildChatPrompt = (
  history: ReadonlyArray<ChatTurn>,
  userInput: string,
): string => {
  const transcript = history
    .map(
      (turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.text}`,
    )
    .join('\n');

  return transcript.length > 0
    ? `${transcript}\nUser: ${userInput}\nAssistant:`
    : `User: ${userInput}\nAssistant:`;
};

const getDefaultKey = (): Effect.Effect<string | undefined> =>
  Effect.gen(function* () {
    const env = yield* loadEnv();
    return env.GEMINI_API_KEY;
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

const printUsage = (
  usage:
    | {
        readonly inputTokens: number;
        readonly outputTokens: number;
        readonly totalTokens: number;
      }
    | undefined,
) =>
  Effect.gen(function* () {
    yield* Console.log('\n--- Token Usage ---');
    yield* Console.log(`  Input:  ${usage?.inputTokens ?? 'N/A'}`);
    yield* Console.log(`  Output: ${usage?.outputTokens ?? 'N/A'}`);
    yield* Console.log(`  Total:  ${usage?.totalTokens ?? 'N/A'}`);
  });

const runSmokeTest = (aiLayer: ReturnType<typeof createAILayer>) =>
  Effect.gen(function* () {
    yield* Console.log('\nRunning smoke test...\n');

    const result = yield* Effect.gen(function* () {
      const llm = yield* LLM;
      return yield* llm.generate({
        prompt: 'Generate a friendly greeting and an interesting science fact.',
        schema: GreetingSchema,
        temperature: DEFAULT_TEMPERATURE,
      });
    }).pipe(Effect.provide(aiLayer));

    yield* Console.log('--- Result ---');
    yield* Console.log(`Greeting: ${result.object.greeting}`);
    yield* Console.log(`Fact: ${result.object.fact}`);
    yield* printUsage(result.usage);
  });

const runSinglePromptExperiment = (aiLayer: ReturnType<typeof createAILayer>) =>
  Effect.gen(function* () {
    const systemPromptInput = yield* Prompt.run(
      Prompt.text({
        message: 'System prompt (optional)',
        default: DEFAULT_SYSTEM_PROMPT,
      }),
    );
    const prompt = yield* Prompt.run(
      Prompt.text({
        message: 'Prompt',
      }),
    );
    const temperatureInput = yield* Prompt.run(
      Prompt.text({
        message: 'Temperature (0 to 2)',
        default: String(DEFAULT_TEMPERATURE),
      }),
    );
    const maxTokensInput = yield* Prompt.run(
      Prompt.text({
        message: 'Max output tokens (1 to 8192)',
        default: String(DEFAULT_MAX_TOKENS),
      }),
    );

    const cleanedPrompt = prompt.trim();
    if (cleanedPrompt.length === 0) {
      yield* Console.log('\nPrompt is required for single prompt mode.');
      return;
    }

    const temperature = parseBoundedNumber(temperatureInput, {
      fallback: DEFAULT_TEMPERATURE,
      min: 0,
      max: 2,
    });
    const maxTokens = parseBoundedNumber(maxTokensInput, {
      fallback: DEFAULT_MAX_TOKENS,
      min: 1,
      max: 8192,
      integer: true,
    });

    const result = yield* Effect.gen(function* () {
      const llm = yield* LLM;
      return yield* llm.generate({
        system: normalizeOptional(systemPromptInput),
        prompt: cleanedPrompt,
        schema: ResponseSchema,
        temperature,
        maxTokens,
      });
    }).pipe(Effect.provide(aiLayer));

    yield* Console.log('\n--- Gemini Response ---');
    yield* Console.log(result.object.response);
    yield* printUsage(result.usage);
  });

const runChatExperiment = (aiLayer: ReturnType<typeof createAILayer>) =>
  Effect.gen(function* () {
    const systemPromptInput = yield* Prompt.run(
      Prompt.text({
        message: 'System prompt (optional)',
        default: DEFAULT_SYSTEM_PROMPT,
      }),
    );
    const temperatureInput = yield* Prompt.run(
      Prompt.text({
        message: 'Temperature (0 to 2)',
        default: String(DEFAULT_TEMPERATURE),
      }),
    );
    const maxTokensInput = yield* Prompt.run(
      Prompt.text({
        message: 'Max output tokens (1 to 8192)',
        default: String(DEFAULT_MAX_TOKENS),
      }),
    );

    const systemPrompt = normalizeOptional(systemPromptInput);
    const temperature = parseBoundedNumber(temperatureInput, {
      fallback: DEFAULT_TEMPERATURE,
      min: 0,
      max: 2,
    });
    const maxTokens = parseBoundedNumber(maxTokensInput, {
      fallback: DEFAULT_MAX_TOKENS,
      min: 1,
      max: 8192,
      integer: true,
    });

    yield* Console.log('\nInteractive chat mode started.');
    yield* Console.log('Commands: /exit to quit, /reset to clear history.\n');

    let history: ChatTurn[] = [];

    while (true) {
      const input = (yield* Prompt.run(
        Prompt.text({
          message: 'You',
        }),
      )).trim();

      if (input.length === 0) {
        continue;
      }

      if (input === '/exit') {
        yield* Console.log('\nExiting interactive chat.');
        break;
      }

      if (input === '/reset') {
        history = [];
        yield* Console.log('\nConversation history cleared.\n');
        continue;
      }

      const prompt = buildChatPrompt(history, input);
      const response = yield* Effect.gen(function* () {
        const llm = yield* LLM;
        return yield* llm.generate({
          system: systemPrompt,
          prompt,
          schema: ResponseSchema,
          temperature,
          maxTokens,
        });
      }).pipe(Effect.provide(aiLayer), Effect.either);

      if (response._tag === 'Left') {
        const message =
          response.left instanceof Error
            ? response.left.message
            : 'Unknown Gemini error';
        yield* Console.log(`\nRequest failed: ${message}\n`);
        continue;
      }

      const assistantText = response.right.object.response.trim();
      history = [
        ...history,
        { role: 'user', text: input },
        { role: 'assistant', text: assistantText },
      ];

      yield* Console.log(`\nAssistant: ${assistantText}\n`);
      yield* printUsage(response.right.usage);
      yield* Console.log('');
    }
  });

export const testLlm = Command.make('llm', {}).pipe(
  Command.withHandler(() =>
    Effect.gen(function* () {
      const defaultKey = yield* getDefaultKey();
      const apiKey = yield* Prompt.run(
        Prompt.text({
          message: 'API key',
          default: defaultKey,
        }),
      );

      const modelInput = yield* Prompt.run(
        Prompt.text({
          message: 'Gemini model ID',
          default: DEFAULT_MODEL,
        }),
      );
      const mode = yield* Prompt.run(
        Prompt.select({
          message: 'Mode',
          choices: [
            {
              title: 'Smoke test',
              value: 'smoke' as const,
              description:
                'Verify API key/model with structured greeting + fact output',
            },
            {
              title: 'Single prompt',
              value: 'single' as const,
              description: 'Run one custom prompt and inspect token usage',
            },
            {
              title: 'Interactive chat',
              value: 'chat' as const,
              description:
                'Multi-turn REPL chat with /exit and /reset commands',
            },
          ],
        }),
      );

      const model = normalizeOptional(modelInput) ?? DEFAULT_MODEL;
      yield* Console.log(`\nUsing model: ${model}`);

      const aiLayer = createAILayer({ apiKey, model });

      const selectedMode: ExperimentMode = mode;

      if (selectedMode === 'smoke') {
        yield* runSmokeTest(aiLayer);
        return;
      }

      if (selectedMode === 'single') {
        yield* runSinglePromptExperiment(aiLayer);
        return;
      }

      yield* runChatExperiment(aiLayer);
    }),
  ),
  Command.withDescription(
    'Gemini playground for smoke tests and prompt/chat experiments',
  ),
);
