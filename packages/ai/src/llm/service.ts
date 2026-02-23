import { Context } from 'effect';
import type { LLMError, LLMRateLimitError } from '../errors';
import type { Schema, Effect } from 'effect';

/**
 * Options for structured object generation.
 */
export interface GenerateOptions<T> {
  readonly system?: string;
  readonly prompt: string;
  readonly schema: Schema.Schema<T>;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

/**
 * Result from object generation.
 */
export interface GenerateResult<T> {
  readonly object: T;
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  };
}

/**
 * LLM service interface using AI SDK.
 * Provider-agnostic - works with OpenAI, Anthropic, Google, etc.
 */
export interface LLMService {
  /**
   * The underlying AI SDK model instance.
   */
  readonly model: unknown;

  /**
   * Generate a typed object from a prompt using Effect Schema.
   */
  readonly generate: <T>(
    options: GenerateOptions<T>,
  ) => Effect.Effect<GenerateResult<T>, LLMError | LLMRateLimitError>;
}

/**
 * LLM service Context.Tag for dependency injection.
 */
export class LLM extends Context.Tag('@repo/ai/LLM')<LLM, LLMService>() {}
