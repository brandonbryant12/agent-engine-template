import { Schema } from 'effect';

export class ToolValidationError extends Schema.TaggedError<ToolValidationError>()(
  'ToolValidationError',
  {
    message: Schema.String,
    issues: Schema.Array(Schema.String),
  },
) {
  static readonly httpStatus = 422 as const;
  static readonly httpCode = 'INPUT_VALIDATION_FAILED' as const;
  static readonly httpMessage = (e: ToolValidationError) => e.message;
  static readonly logLevel = 'warn' as const;
  static getData(e: ToolValidationError) {
    return { errorTag: e._tag, issues: e.issues };
  }
}

export class ToolProviderError extends Schema.TaggedError<ToolProviderError>()(
  'ToolProviderError',
  {
    message: Schema.String,
    provider: Schema.String,
  },
) {
  static readonly httpStatus = 502 as const;
  static readonly httpCode = 'SERVICE_UNAVAILABLE' as const;
  static readonly httpMessage = 'Tool provider unavailable';
  static readonly logLevel = 'error' as const;
  static getData(e: ToolProviderError) {
    return { errorTag: e._tag, provider: e.provider };
  }
}

export class ToolTimeoutError extends Schema.TaggedError<ToolTimeoutError>()(
  'ToolTimeoutError',
  {
    message: Schema.String,
    timeoutMs: Schema.Number,
  },
) {
  static readonly httpStatus = 502 as const;
  static readonly httpCode = 'SERVICE_UNAVAILABLE' as const;
  static readonly httpMessage = 'Tool request timed out';
  static readonly logLevel = 'warn' as const;
  static getData(e: ToolTimeoutError) {
    return { errorTag: e._tag, timeoutMs: e.timeoutMs };
  }
}

export class ToolRateLimitError extends Schema.TaggedError<ToolRateLimitError>()(
  'ToolRateLimitError',
  {
    message: Schema.String,
  },
) {
  static readonly httpStatus = 429 as const;
  static readonly httpCode = 'RATE_LIMITED' as const;
  static readonly httpMessage = 'Tool provider rate limited';
  static readonly logLevel = 'warn' as const;
  static getData(e: ToolRateLimitError) {
    return { errorTag: e._tag };
  }
}

export class ToolSchemaDriftError extends Schema.TaggedError<ToolSchemaDriftError>()(
  'ToolSchemaDriftError',
  {
    message: Schema.String,
  },
) {
  static readonly httpStatus = 502 as const;
  static readonly httpCode = 'SERVICE_UNAVAILABLE' as const;
  static readonly httpMessage = 'Tool provider payload mismatch';
  static readonly logLevel = 'error' as const;
  static getData(e: ToolSchemaDriftError) {
    return { errorTag: e._tag };
  }
}

export type ToolError =
  | ToolValidationError
  | ToolProviderError
  | ToolTimeoutError
  | ToolRateLimitError
  | ToolSchemaDriftError;
