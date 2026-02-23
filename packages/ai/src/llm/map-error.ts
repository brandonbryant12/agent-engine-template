import { NoObjectGeneratedError } from 'ai';
import { LLMError, LLMRateLimitError } from '../errors';

/**
 * Map LLM API errors to domain errors.
 */
export function mapError(error: unknown): LLMError | LLMRateLimitError {
  if (error instanceof Error) {
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return new LLMRateLimitError({
        message: error.message,
      });
    }

    if (NoObjectGeneratedError.isInstance(error) && error.text) {
      console.error('[LLM] Failed to parse model output:', error.text);
    }

    return new LLMError({
      message: error.message,
      cause: error,
    });
  }

  return new LLMError({
    message: 'Unknown LLM error',
    cause: error,
  });
}
