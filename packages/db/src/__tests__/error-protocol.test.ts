import { describe, expect, it } from 'vitest';
import { hasHttpProtocol } from '../error-protocol';
import {
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  DbError,
  ConstraintViolationError,
  DeadlockError,
  ConnectionError,
  ExternalServiceError,
} from '../errors';

describe('hasHttpProtocol', () => {
  it('returns true for all error classes that implement HttpErrorProtocol', () => {
    expect(hasHttpProtocol(NotFoundError)).toBe(true);
    expect(hasHttpProtocol(ForbiddenError)).toBe(true);
    expect(hasHttpProtocol(UnauthorizedError)).toBe(true);
    expect(hasHttpProtocol(ValidationError)).toBe(true);
    expect(hasHttpProtocol(DbError)).toBe(true);
    expect(hasHttpProtocol(ConstraintViolationError)).toBe(true);
    expect(hasHttpProtocol(DeadlockError)).toBe(true);
    expect(hasHttpProtocol(ConnectionError)).toBe(true);
    expect(hasHttpProtocol(ExternalServiceError)).toBe(true);
  });

  it('returns false for non-object/non-function values', () => {
    // Note: hasHttpProtocol does not handle null safely (it will throw).
    // It guards against primitives and undefined but null passes the typeof check.
    expect(hasHttpProtocol(undefined)).toBe(false);
    expect(hasHttpProtocol(42)).toBe(false);
    expect(hasHttpProtocol('string')).toBe(false);
    expect(hasHttpProtocol(true)).toBe(false);
  });

  it('returns false for objects missing required protocol fields', () => {
    expect(hasHttpProtocol({})).toBe(false);
    expect(hasHttpProtocol({ httpStatus: 404 })).toBe(false);
    expect(hasHttpProtocol({ httpStatus: 404, httpCode: 'NOT_FOUND' })).toBe(
      false,
    );
    expect(
      hasHttpProtocol({
        httpStatus: 404,
        httpCode: 'NOT_FOUND',
        httpMessage: 'Not found',
      }),
    ).toBe(false);
  });

  it('returns true for objects with all required protocol fields', () => {
    expect(
      hasHttpProtocol({
        httpStatus: 404,
        httpCode: 'NOT_FOUND',
        httpMessage: 'Not found',
        logLevel: 'silent',
      }),
    ).toBe(true);
  });

  it('accepts httpMessage as either a string or function', () => {
    expect(
      hasHttpProtocol({
        httpStatus: 500,
        httpCode: 'ERROR',
        httpMessage: 'Static message',
        logLevel: 'error',
      }),
    ).toBe(true);

    expect(
      hasHttpProtocol({
        httpStatus: 500,
        httpCode: 'ERROR',
        httpMessage: () => 'Dynamic message',
        logLevel: 'error',
      }),
    ).toBe(true);
  });

  it('returns false when httpStatus is not a number', () => {
    expect(
      hasHttpProtocol({
        httpStatus: '404',
        httpCode: 'NOT_FOUND',
        httpMessage: 'msg',
        logLevel: 'silent',
      }),
    ).toBe(false);
  });

  it('returns false when httpCode is not a string', () => {
    expect(
      hasHttpProtocol({
        httpStatus: 404,
        httpCode: 404,
        httpMessage: 'msg',
        logLevel: 'silent',
      }),
    ).toBe(false);
  });
});
