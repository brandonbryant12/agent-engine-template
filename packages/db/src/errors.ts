import { Schema } from 'effect';

export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  'NotFoundError',
  {
    entity: Schema.String,
    id: Schema.String,
    message: Schema.optional(Schema.String),
  },
) {
  static readonly httpStatus = 404 as const;
  static readonly httpCode = 'NOT_FOUND' as const;
  static readonly httpMessage = (e: NotFoundError) =>
    e.message ?? `${e.entity} with id ${e.id} not found`;
  static readonly logLevel = 'silent' as const;
  static getData(e: NotFoundError) {
    return { entity: e.entity, id: e.id };
  }
}

export class ForbiddenError extends Schema.TaggedError<ForbiddenError>()(
  'ForbiddenError',
  {
    message: Schema.String,
    resource: Schema.optional(Schema.String),
    action: Schema.optional(Schema.String),
  },
) {
  static readonly httpStatus = 403 as const;
  static readonly httpCode = 'FORBIDDEN' as const;
  static readonly httpMessage = (e: ForbiddenError) => e.message;
  static readonly logLevel = 'silent' as const;
}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
  'UnauthorizedError',
  {
    message: Schema.String,
  },
) {
  static readonly httpStatus = 401 as const;
  static readonly httpCode = 'UNAUTHORIZED' as const;
  static readonly httpMessage = (e: UnauthorizedError) => e.message;
  static readonly logLevel = 'silent' as const;
}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  'ValidationError',
  {
    field: Schema.String,
    message: Schema.String,
  },
) {
  static readonly httpStatus = 422 as const;
  static readonly httpCode = 'VALIDATION_ERROR' as const;
  static readonly httpMessage = (e: ValidationError) =>
    `${e.field}: ${e.message}`;
  static readonly logLevel = 'silent' as const;
  static getData(e: ValidationError) {
    return { field: e.field };
  }
}

export class DbError extends Schema.TaggedError<DbError>()('DbError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
  static readonly httpStatus = 500 as const;
  static readonly httpCode = 'INTERNAL_ERROR' as const;
  static readonly httpMessage = 'Database operation failed';
  static readonly logLevel = 'error-with-stack' as const;
}

/** PostgreSQL error codes: 23xxx */
export class ConstraintViolationError extends Schema.TaggedError<ConstraintViolationError>()(
  'ConstraintViolationError',
  {
    constraint: Schema.String,
    table: Schema.optional(Schema.String),
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 409 as const;
  static readonly httpCode = 'CONFLICT' as const;
  static readonly httpMessage = 'A conflict occurred with existing data';
  static readonly logLevel = 'error' as const;
  static getData(e: ConstraintViolationError) {
    return { constraint: e.constraint, table: e.table };
  }
}

/** PostgreSQL error code: 40P01 */
export class DeadlockError extends Schema.TaggedError<DeadlockError>()(
  'DeadlockError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 503 as const;
  static readonly httpCode = 'SERVICE_UNAVAILABLE' as const;
  static readonly httpMessage =
    'Database temporarily unavailable, please retry';
  static readonly logLevel = 'error' as const;
}

/** PostgreSQL error codes: 08xxx */
export class ConnectionError extends Schema.TaggedError<ConnectionError>()(
  'ConnectionError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 503 as const;
  static readonly httpCode = 'SERVICE_UNAVAILABLE' as const;
  static readonly httpMessage = 'Database connection failed';
  static readonly logLevel = 'error-with-stack' as const;
}

export class ExternalServiceError extends Schema.TaggedError<ExternalServiceError>()(
  'ExternalServiceError',
  {
    service: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 502 as const;
  static readonly httpCode = 'BAD_GATEWAY' as const;
  static readonly httpMessage = (e: ExternalServiceError) =>
    `External service ${e.service} failed`;
  static readonly logLevel = 'error' as const;
  static getData(e: ExternalServiceError) {
    return { service: e.service };
  }
}

export type BaseError =
  | NotFoundError
  | ForbiddenError
  | UnauthorizedError
  | ValidationError
  | DbError
  | ConstraintViolationError
  | DeadlockError
  | ConnectionError
  | ExternalServiceError;

export type BaseErrorTag = BaseError['_tag'];
