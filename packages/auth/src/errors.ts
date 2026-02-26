import { Schema } from 'effect';

// Re-export base auth errors from @repo/db (shared across packages)
export { UnauthorizedError, ForbiddenError } from '@repo/db/errors';

export class PolicyError extends Schema.TaggedError<PolicyError>()(
  'PolicyError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 500 as const;
  static readonly httpCode = 'INTERNAL_ERROR' as const;
  static readonly httpMessage = 'Authorization check failed';
  static readonly logLevel = 'error-with-stack' as const;
}

export class AuthSessionError extends Schema.TaggedError<AuthSessionError>()(
  'AuthSessionError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 502 as const;
  static readonly httpCode = 'SERVICE_UNAVAILABLE' as const;
  static readonly httpMessage = 'Authentication service is unavailable';
  static readonly logLevel = 'warn' as const;
}
