import { Schema } from 'effect';

export class QueueError extends Schema.TaggedError<QueueError>()('QueueError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
  static readonly httpStatus = 500 as const;
  static readonly httpCode = 'INTERNAL_ERROR' as const;
  static readonly httpMessage = 'Job queue operation failed';
  static readonly logLevel = 'error-with-stack' as const;
}

export class JobNotFoundError extends Schema.TaggedError<JobNotFoundError>()(
  'JobNotFoundError',
  {
    jobId: Schema.String,
    message: Schema.optional(Schema.String),
  },
) {
  static readonly httpStatus = 404 as const;
  static readonly httpCode = 'JOB_NOT_FOUND' as const;
  static readonly httpMessage = (e: JobNotFoundError) =>
    e.message || `Job ${e.jobId} not found`;
  static readonly logLevel = 'silent' as const;
  static getData(e: JobNotFoundError) {
    return { jobId: e.jobId };
  }
}

export class JobProcessingError extends Schema.TaggedError<JobProcessingError>()(
  'JobProcessingError',
  {
    jobId: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 500 as const;
  static readonly httpCode = 'INTERNAL_ERROR' as const;
  static readonly httpMessage = 'Job processing failed';
  static readonly logLevel = 'error-with-stack' as const;
  static getData(e: JobProcessingError) {
    return { jobId: e.jobId };
  }
}

export const formatError = (error: unknown): string => {
  if (error && typeof error === 'object') {
    if ('_tag' in error && typeof error._tag === 'string') {
      const msg =
        'message' in error && typeof error.message === 'string'
          ? error.message
          : '';
      return msg ? `${error._tag}: ${msg}` : error._tag;
    }
    if (error instanceof Error) {
      return error.message || error.name;
    }
  }
  return String(error);
};

export type QueuePackageError =
  | QueueError
  | JobNotFoundError
  | JobProcessingError;
