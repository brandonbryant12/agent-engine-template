import { Schema } from 'effect';

// =============================================================================
// LLM Errors
// =============================================================================

/**
 * LLM service failure.
 */
export class LLMError extends Schema.TaggedError<LLMError>()('LLMError', {
  message: Schema.String,
  model: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
}) {
  static readonly httpStatus = 502 as const;
  static readonly httpCode = 'SERVICE_UNAVAILABLE' as const;
  static readonly httpMessage = 'AI service unavailable';
  static readonly logLevel = 'error' as const;
  static getData(e: LLMError) {
    return e.model ? { model: e.model } : {};
  }
}

/**
 * LLM rate limit exceeded.
 */
export class LLMRateLimitError extends Schema.TaggedError<LLMRateLimitError>()(
  'LLMRateLimitError',
  {
    message: Schema.String,
    retryAfter: Schema.optional(Schema.Number),
  },
) {
  static readonly httpStatus = 429 as const;
  static readonly httpCode = 'RATE_LIMITED' as const;
  static readonly httpMessage = 'AI rate limit exceeded';
  static readonly logLevel = 'warn' as const;
  static getData(e: LLMRateLimitError) {
    return e.retryAfter !== undefined ? { retryAfter: e.retryAfter } : {};
  }
}

// =============================================================================
// TTS Errors
// =============================================================================

/**
 * TTS service failure.
 */
export class TTSError extends Schema.TaggedError<TTSError>()('TTSError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
  static readonly httpStatus = 502 as const;
  static readonly httpCode = 'SERVICE_UNAVAILABLE' as const;
  static readonly httpMessage = 'Text-to-speech service unavailable';
  static readonly logLevel = 'error' as const;
}

/**
 * TTS quota exceeded.
 */
export class TTSQuotaExceededError extends Schema.TaggedError<TTSQuotaExceededError>()(
  'TTSQuotaExceededError',
  {
    message: Schema.String,
  },
) {
  static readonly httpStatus = 429 as const;
  static readonly httpCode = 'RATE_LIMITED' as const;
  static readonly httpMessage = 'TTS quota exceeded';
  static readonly logLevel = 'warn' as const;
}

/**
 * Voice not found.
 * Thrown when an invalid voice ID is provided.
 */
export class VoiceNotFoundError extends Schema.TaggedError<VoiceNotFoundError>()(
  'VoiceNotFoundError',
  {
    voiceId: Schema.String,
    message: Schema.optional(Schema.String),
  },
) {
  static readonly httpStatus = 404 as const;
  static readonly httpCode = 'VOICE_NOT_FOUND' as const;
  static readonly httpMessage = (e: VoiceNotFoundError) =>
    e.message || `Voice "${e.voiceId}" not found`;
  static readonly logLevel = 'silent' as const;
  static getData(e: VoiceNotFoundError) {
    return { voiceId: e.voiceId };
  }
}

// =============================================================================
// Audio Errors
// =============================================================================

/**
 * Audio processing failure.
 */
export class AudioError extends Schema.TaggedError<AudioError>()('AudioError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
  static readonly httpStatus = 500 as const;
  static readonly httpCode = 'INTERNAL_ERROR' as const;
  static readonly httpMessage = 'Audio processing failed';
  static readonly logLevel = 'error-with-stack' as const;
}

/**
 * FFmpeg/audio processing failure.
 */
export class AudioProcessingError extends Schema.TaggedError<AudioProcessingError>()(
  'AudioProcessingError',
  {
    message: Schema.String,
    operation: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 500 as const;
  static readonly httpCode = 'INTERNAL_ERROR' as const;
  static readonly httpMessage = 'Audio processing failed';
  static readonly logLevel = 'error-with-stack' as const;
  static getData(e: AudioProcessingError) {
    return e.operation ? { operation: e.operation } : {};
  }
}

// =============================================================================
// ImageGen Errors
// =============================================================================

/**
 * Image generation service failure.
 */
export class ImageGenError extends Schema.TaggedError<ImageGenError>()(
  'ImageGenError',
  {
    message: Schema.String,
    model: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 502 as const;
  static readonly httpCode = 'SERVICE_UNAVAILABLE' as const;
  static readonly httpMessage = 'Image generation service unavailable';
  static readonly logLevel = 'error' as const;
  static getData(e: ImageGenError) {
    return e.model ? { model: e.model } : {};
  }
}

/**
 * Image generation rate limit exceeded.
 */
export class ImageGenRateLimitError extends Schema.TaggedError<ImageGenRateLimitError>()(
  'ImageGenRateLimitError',
  {
    message: Schema.String,
    retryAfter: Schema.optional(Schema.Number),
  },
) {
  static readonly httpStatus = 429 as const;
  static readonly httpCode = 'RATE_LIMITED' as const;
  static readonly httpMessage = 'Image generation rate limit exceeded';
  static readonly logLevel = 'warn' as const;
  static getData(e: ImageGenRateLimitError) {
    return e.retryAfter !== undefined ? { retryAfter: e.retryAfter } : {};
  }
}

/**
 * Image content was filtered by safety system.
 */
export class ImageGenContentFilteredError extends Schema.TaggedError<ImageGenContentFilteredError>()(
  'ImageGenContentFilteredError',
  {
    message: Schema.String,
    prompt: Schema.optional(Schema.String),
  },
) {
  static readonly httpStatus = 422 as const;
  static readonly httpCode = 'CONTENT_FILTERED' as const;
  static readonly httpMessage =
    'Image could not be generated. Please adjust your prompt and try again.';
  static readonly logLevel = 'silent' as const;
}

// =============================================================================
// Research Errors
// =============================================================================

/**
 * Research operation failure.
 */
export class ResearchError extends Schema.TaggedError<ResearchError>()(
  'ResearchError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 422 as const;
  static readonly httpCode = 'RESEARCH_ERROR' as const;
  static readonly httpMessage = (e: ResearchError) => e.message;
  static readonly logLevel = 'error-with-stack' as const;
}

/**
 * Research operation timed out.
 */
export class ResearchTimeoutError extends Schema.TaggedError<ResearchTimeoutError>()(
  'ResearchTimeoutError',
  {
    operationId: Schema.String,
    message: Schema.optional(Schema.String),
  },
) {
  static readonly httpStatus = 504 as const;
  static readonly httpCode = 'RESEARCH_TIMEOUT' as const;
  static readonly httpMessage = (e: ResearchTimeoutError) =>
    e.message ?? 'Research operation timed out';
  static readonly logLevel = 'warn' as const;
}

// =============================================================================
// Error Union Types
// =============================================================================

/**
 * All AI package errors.
 */
export type AIError =
  | LLMError
  | LLMRateLimitError
  | TTSError
  | TTSQuotaExceededError
  | VoiceNotFoundError
  | AudioError
  | AudioProcessingError
  | ImageGenError
  | ImageGenRateLimitError
  | ImageGenContentFilteredError
  | ResearchError
  | ResearchTimeoutError;
