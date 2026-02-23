import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, jsonSchema } from 'ai';
import { Effect, Layer, JSONSchema, Schedule } from 'effect';
import { LLM_MODEL } from '../../models';
import { mapError } from '../map-error';
import {
  LLM,
  type LLMService,
  type GenerateOptions,
  type GenerateResult,
} from '../service';

/**
 * Configuration for Google AI provider via AI SDK.
 */
export interface GoogleConfig {
  /** API key - required, should be passed from validated env.GEMINI_API_KEY */
  readonly apiKey: string;
  /** Override the default LLM model from models.ts */
  readonly model?: string;
}

/**
 * Strip markdown code fences that Gemini thinking models sometimes wrap around JSON.
 * e.g. ```json\n{...}\n``` → {...}
 */
function stripMarkdownCodeFence(text: string): string | null {
  const match = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```\s*$/);
  return match ? match[1]!.trim() : null;
}

/**
 * Create Google AI service implementation via AI SDK.
 */
const makeGoogleService = (config: GoogleConfig): LLMService => {
  const modelId = config.model ?? LLM_MODEL;

  const google = createGoogleGenerativeAI({
    apiKey: config.apiKey,
  });
  const model = google(modelId);

  return {
    model,

    generate: <T>(options: GenerateOptions<T>) =>
      Effect.tryPromise({
        try: async () => {
          // Convert Effect Schema to JSON Schema, then wrap with AI SDK's jsonSchema helper
          const effectJsonSchema = JSONSchema.make(options.schema);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const aiSchema = jsonSchema<T>(effectJsonSchema as any);

          const result = await generateObject({
            model,
            system: options.system,
            prompt: options.prompt,
            schema: aiSchema,
            maxOutputTokens: options.maxTokens,
            temperature: options.temperature ?? 0.7,
            // Keep retries in Effect.retry to avoid double-retry with AI SDK defaults.
            maxRetries: 0,
            experimental_repairText: async ({ text }) =>
              stripMarkdownCodeFence(text),
          });

          const { inputTokens, outputTokens, totalTokens } = result.usage;

          return {
            object: result.object as T,
            usage:
              inputTokens !== undefined &&
              outputTokens !== undefined &&
              totalTokens !== undefined
                ? { inputTokens, outputTokens, totalTokens }
                : undefined,
          } satisfies GenerateResult<T>;
        },
        catch: mapError,
      }).pipe(
        // Retry transient LLM errors (e.g. response parsing failures) up to 2 times
        Effect.retry({
          times: 2,
          schedule: Schedule.exponential('500 millis'),
          while: (error) => error._tag === 'LLMError',
        }),
        Effect.withSpan('llm.generate', {
          attributes: { 'llm.provider': 'google', 'llm.model': modelId },
        }),
      ),
  };
};

/**
 * Create Google AI LLM service layer via AI SDK v5.
 *
 * @example
 * ```typescript
 * const LLMLive = GoogleLive({ apiKey: env.GEMINI_API_KEY });
 *
 * const program = Effect.gen(function* () {
 *   const llm = yield* LLM;
 *   const result = yield* llm.generate({
 *     prompt: 'Generate a greeting',
 *     schema: GreetingSchema,
 *   });
 *   return result.object;
 * }).pipe(Effect.provide(LLMLive));
 * ```
 */
export const GoogleLive = (config: GoogleConfig): Layer.Layer<LLM> =>
  Layer.sync(LLM, () => makeGoogleService(config));
