import { Schema } from 'effect';

export class StorageError extends Schema.TaggedError<StorageError>()(
  'StorageError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 500 as const;
  static readonly httpCode = 'INTERNAL_ERROR' as const;
  static readonly httpMessage = 'Storage operation failed';
  static readonly logLevel = 'error-with-stack' as const;
}

export class StorageNotFoundError extends Schema.TaggedError<StorageNotFoundError>()(
  'StorageNotFoundError',
  {
    key: Schema.String,
    message: Schema.optional(Schema.String),
  },
) {
  static readonly httpStatus = 404 as const;
  static readonly httpCode = 'NOT_FOUND' as const;
  static readonly httpMessage = (e: StorageNotFoundError) =>
    e.message || `File not found: ${e.key}`;
  static readonly logLevel = 'silent' as const;
  static getData(e: StorageNotFoundError) {
    return { key: e.key };
  }
}

export class StorageUploadError extends Schema.TaggedError<StorageUploadError>()(
  'StorageUploadError',
  {
    key: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 500 as const;
  static readonly httpCode = 'INTERNAL_ERROR' as const;
  static readonly httpMessage = 'File upload failed';
  static readonly logLevel = 'error-with-stack' as const;
  static getData(e: StorageUploadError) {
    return { key: e.key };
  }
}

export type StoragePackageError =
  | StorageError
  | StorageNotFoundError
  | StorageUploadError;
