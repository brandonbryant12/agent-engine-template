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
