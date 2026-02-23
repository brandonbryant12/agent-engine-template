import { Schema } from 'effect';

/** Convert Effect Schema to Standard Schema for oRPC */
export const std = Schema.standardSchemaV1;

/** Coerce string query params to numbers */
export const CoerceNumber = Schema.Union(
  Schema.Number,
  Schema.String.pipe(
    Schema.transform(Schema.Number, { decode: Number, encode: String }),
  ),
).pipe(Schema.compose(Schema.Number));

/** Shared pagination input fields for list endpoints */
export const PaginationFields = {
  limit: Schema.optional(
    CoerceNumber.pipe(
      Schema.greaterThanOrEqualTo(1),
      Schema.lessThanOrEqualTo(100),
    ),
  ),
  offset: Schema.optional(CoerceNumber.pipe(Schema.greaterThanOrEqualTo(0))),
};

/** 403 Forbidden error (used by admin-only routes) */
export const authErrors = {
  FORBIDDEN: {
    status: 403,
  },
} as const;

/** Job not found error (used by generation job polling) */
export const jobErrors = {
  JOB_NOT_FOUND: {
    status: 404,
    data: std(
      Schema.Struct({
        jobId: Schema.String,
      }),
    ),
  },
} as const;
