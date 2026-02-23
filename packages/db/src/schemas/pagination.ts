import { Schema } from 'effect';

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;
export const MIN_PAGE_LIMIT = 1;

export const paginatedResponse = <A, I, R>(
  dataSchema: Schema.Schema<A, I, R>,
) =>
  Schema.Struct({
    data: Schema.Array(dataSchema),
    hasMore: Schema.Boolean,
    nextCursor: Schema.optional(Schema.String),
  });

export const cursorQueryParams = <A, I, R>(
  cursorSchema: Schema.Schema<A, I, R>,
) =>
  Schema.Struct({
    limit: Schema.optionalWith(
      Schema.Number.pipe(
        Schema.int(),
        Schema.greaterThanOrEqualTo(MIN_PAGE_LIMIT),
        Schema.lessThanOrEqualTo(MAX_PAGE_LIMIT),
      ),
      { default: () => DEFAULT_PAGE_LIMIT },
    ),
    afterCursor: Schema.optional(cursorSchema),
    beforeCursor: Schema.optional(cursorSchema),
  });

export const SimpleCursorQueryParams = Schema.Struct({
  limit: Schema.optionalWith(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(MIN_PAGE_LIMIT),
      Schema.lessThanOrEqualTo(MAX_PAGE_LIMIT),
    ),
    { default: () => DEFAULT_PAGE_LIMIT },
  ),
  afterCursor: Schema.optional(Schema.String),
  beforeCursor: Schema.optional(Schema.String),
});

export const OffsetQueryParams = Schema.Struct({
  limit: Schema.optionalWith(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(MIN_PAGE_LIMIT),
      Schema.lessThanOrEqualTo(MAX_PAGE_LIMIT),
    ),
    { default: () => DEFAULT_PAGE_LIMIT },
  ),
  offset: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    { default: () => 0 },
  ),
});

export const offsetPaginatedResponse = <A, I, R>(
  dataSchema: Schema.Schema<A, I, R>,
) =>
  Schema.Struct({
    data: Schema.Array(dataSchema),
    total: Schema.Number,
    hasMore: Schema.Boolean,
  });

export type PaginatedResponse<T> = {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
};

export type CursorQueryParams<T = string> = {
  limit: number;
  afterCursor?: T;
  beforeCursor?: T;
};

export type OffsetQueryParamsType = typeof OffsetQueryParams.Type;

export type OffsetPaginatedResponse<T> = {
  data: T[];
  total: number;
  hasMore: boolean;
};

export const createPaginatedResponse = <T>(
  data: T[],
  limit: number,
  getCursor: (item: T) => string,
): PaginatedResponse<T> => {
  const hasMore = data.length > limit;
  const pageData = hasMore ? data.slice(0, limit) : data;
  const nextCursor =
    hasMore && pageData.length > 0
      ? getCursor(pageData[pageData.length - 1]!)
      : undefined;

  return {
    data: pageData,
    hasMore,
    nextCursor,
  };
};

export const createOffsetPaginatedResponse = <T>(
  data: T[],
  total: number,
  offset: number,
): OffsetPaginatedResponse<T> => ({
  data,
  total,
  hasMore: offset + data.length < total,
});
