import { describe, expect, it } from 'vitest';
import {
  handleTaggedError,
  STATUS_TO_ERROR_CODES,
  type ErrorFactory,
} from '../effect-handler';

const createFactory = (code: string) => (options: unknown) => ({
  code,
  options,
});

const EXPECTED_FALLBACK_PRIORITY_BY_STATUS = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_CONTENT',
  429: 'RATE_LIMITED',
  502: 'SERVICE_UNAVAILABLE',
  503: 'SERVICE_UNAVAILABLE',
  504: 'SERVICE_UNAVAILABLE',
} as const satisfies Readonly<Record<number, string>>;

const captureThrown = (error: { _tag: string }, factories: ErrorFactory) => {
  try {
    handleTaggedError(error, factories);
    throw new Error('Expected handleTaggedError to throw');
  } catch (thrown) {
    return thrown;
  }
};

const createFallbackError = (status: number) =>
  class FallbackError extends Error {
    readonly _tag = `Fallback${status}Error`;
    static readonly httpStatus = status;
    static readonly httpCode = 'MISSING_DOMAIN_CODE';
    static readonly httpMessage = `Fallback for ${status}`;
    static readonly logLevel = 'silent' as const;
  };

const sortedStatusKeys = (record: Readonly<Record<number, unknown>>) =>
  Object.keys(record)
    .map(Number)
    .sort((a, b) => a - b);

const createFactoriesForStatus = (status: number): ErrorFactory => {
  const fallbackCodes = STATUS_TO_ERROR_CODES[status] ?? [];
  return Object.fromEntries([
    ...fallbackCodes.map((code) => [code, createFactory(code)] as const),
    ['INTERNAL_ERROR', createFactory('INTERNAL_ERROR')] as const,
  ]);
};

const fallbackCases = Object.entries(EXPECTED_FALLBACK_PRIORITY_BY_STATUS).map(
  ([status, expectedCode]) => ({
    status: Number(status),
    expectedCode,
  }),
);

describe('effect-handler fallback invariants', () => {
  it('requires explicit fallback expectations for every status mapping key', () => {
    expect(
      sortedStatusKeys(EXPECTED_FALLBACK_PRIORITY_BY_STATUS),
    ).toStrictEqual(sortedStatusKeys(STATUS_TO_ERROR_CODES));
  });

  it('keeps first-priority fallback expectations aligned with status map ordering', () => {
    for (const { status, expectedCode } of fallbackCases) {
      expect(STATUS_TO_ERROR_CODES[status]?.[0]).toBe(expectedCode);
    }
  });

  it.each(fallbackCases)(
    'maps $status fallback to $expectedCode',
    ({ status, expectedCode }) => {
      const FallbackError = createFallbackError(status);
      const thrown = captureThrown(
        new FallbackError(),
        createFactoriesForStatus(status),
      );

      expect(thrown).toMatchObject({ code: expectedCode });
    },
  );
});
