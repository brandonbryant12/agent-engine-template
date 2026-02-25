import { Schema } from 'effect';

export class PromptKeyNotFoundError extends Schema.TaggedError<PromptKeyNotFoundError>()(
  'PromptKeyNotFoundError',
  {
    key: Schema.String,
  },
) {
  static readonly httpStatus = 404 as const;
  static readonly httpCode = 'NOT_FOUND' as const;
  static readonly httpMessage = (e: PromptKeyNotFoundError) =>
    `Prompt key "${e.key}" was not found`;
  static readonly logLevel = 'warn' as const;
}

export class PromptVersionNotFoundError extends Schema.TaggedError<PromptVersionNotFoundError>()(
  'PromptVersionNotFoundError',
  {
    key: Schema.String,
    version: Schema.String,
  },
) {
  static readonly httpStatus = 404 as const;
  static readonly httpCode = 'NOT_FOUND' as const;
  static readonly httpMessage = (e: PromptVersionNotFoundError) =>
    `Prompt version "${e.key}@${e.version}" was not found`;
  static readonly logLevel = 'warn' as const;
}

export class PromptVersionBlockedError extends Schema.TaggedError<PromptVersionBlockedError>()(
  'PromptVersionBlockedError',
  {
    key: Schema.String,
    version: Schema.String,
  },
) {
  static readonly httpStatus = 422 as const;
  static readonly httpCode = 'UNPROCESSABLE_CONTENT' as const;
  static readonly httpMessage =
    'Prompt version is blocked and cannot be used';
  static readonly logLevel = 'warn' as const;
}

export class PromptVariableSchemaMismatchError extends Schema.TaggedError<PromptVariableSchemaMismatchError>()(
  'PromptVariableSchemaMismatchError',
  {
    key: Schema.String,
    version: Schema.String,
    issues: Schema.Array(Schema.String),
  },
) {
  static readonly httpStatus = 422 as const;
  static readonly httpCode = 'UNPROCESSABLE_CONTENT' as const;
  static readonly httpMessage =
    'Prompt variables do not match prompt input schema';
  static readonly logLevel = 'warn' as const;
}

export type PromptResolverError =
  | PromptKeyNotFoundError
  | PromptVersionNotFoundError
  | PromptVersionBlockedError
  | PromptVariableSchemaMismatchError;
