import { TTSError, TTSQuotaExceededError } from '../errors';

/**
 * Map TTS API errors to domain errors.
 */
export function mapError(error: unknown): TTSError | TTSQuotaExceededError {
  if (error instanceof Error) {
    if (error.message.includes('quota') || error.message.includes('429')) {
      return new TTSQuotaExceededError({
        message: error.message,
      });
    }

    return new TTSError({
      message: error.message,
      cause: error,
    });
  }

  return new TTSError({
    message: 'Unknown TTS error',
    cause: error,
  });
}
