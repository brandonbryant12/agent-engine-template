import { describe, expect, it } from 'vitest';
import { handleTaggedError, type ErrorFactory } from '../effect-handler';

const createFactory = (code: string) => (options: unknown) => ({
  code,
  options,
});

const captureThrown = (error: { _tag: string }, factories: ErrorFactory) => {
  try {
    handleTaggedError(error, factories);
    throw new Error('Expected handleTaggedError to throw');
  } catch (thrown) {
    return thrown;
  }
};

class Fallback409Error extends Error {
  readonly _tag = 'Fallback409Error';
  static readonly httpStatus = 409;
  static readonly httpCode = 'MISSING_DOMAIN_CODE';
  static readonly httpMessage = 'Conflict fallback';
  static readonly logLevel = 'silent' as const;
}

class Fallback502Error extends Error {
  readonly _tag = 'Fallback502Error';
  static readonly httpStatus = 502;
  static readonly httpCode = 'MISSING_DOMAIN_CODE';
  static readonly httpMessage = 'Upstream unavailable';
  static readonly logLevel = 'silent' as const;
}

class Fallback422Error extends Error {
  readonly _tag = 'Fallback422Error';
  static readonly httpStatus = 422;
  static readonly httpCode = 'MISSING_DOMAIN_CODE';
  static readonly httpMessage = 'Validation issue';
  static readonly logLevel = 'silent' as const;
}

describe('effect-handler fallback invariants', () => {
  it('maps 409 fallback to CONFLICT', () => {
    const thrown = captureThrown(new Fallback409Error(), {
      CONFLICT: createFactory('CONFLICT'),
      INTERNAL_ERROR: createFactory('INTERNAL_ERROR'),
    });

    expect(thrown).toMatchObject({ code: 'CONFLICT' });
  });

  it('prefers SERVICE_UNAVAILABLE over BAD_GATEWAY for 502 fallback', () => {
    const thrown = captureThrown(new Fallback502Error(), {
      SERVICE_UNAVAILABLE: createFactory('SERVICE_UNAVAILABLE'),
      BAD_GATEWAY: createFactory('BAD_GATEWAY'),
      INTERNAL_ERROR: createFactory('INTERNAL_ERROR'),
    });

    expect(thrown).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('prefers UNPROCESSABLE_CONTENT over INPUT_VALIDATION_FAILED for 422 fallback', () => {
    const thrown = captureThrown(new Fallback422Error(), {
      UNPROCESSABLE_CONTENT: createFactory('UNPROCESSABLE_CONTENT'),
      INPUT_VALIDATION_FAILED: createFactory('INPUT_VALIDATION_FAILED'),
      INTERNAL_ERROR: createFactory('INTERNAL_ERROR'),
    });

    expect(thrown).toMatchObject({ code: 'UNPROCESSABLE_CONTENT' });
  });
});
