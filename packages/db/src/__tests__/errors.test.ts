import { describe, expect, it } from 'vitest';
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

describe('errors', () => {
  describe('NotFoundError', () => {
    it('has correct tag and HTTP protocol properties', () => {
      const error = new NotFoundError({ entity: 'Run', id: 'run_123' });
      expect(error._tag).toBe('NotFoundError');
      expect(NotFoundError.httpStatus).toBe(404);
      expect(NotFoundError.httpCode).toBe('NOT_FOUND');
      expect(NotFoundError.logLevel).toBe('silent');
    });

    it('returns empty string httpMessage when message is omitted (Schema.optional defaults to empty string)', () => {
      // Schema.optional(Schema.String) defaults to '' not undefined,
      // so the ?? fallback in httpMessage never triggers.
      const error = new NotFoundError({ entity: 'Run', id: 'run_123' });
      expect(NotFoundError.httpMessage(error)).toBe('');
    });

    it('uses custom message when provided', () => {
      const error = new NotFoundError({
        entity: 'Run',
        id: 'run_123',
        message: 'Custom not found',
      });
      expect(NotFoundError.httpMessage(error)).toBe('Custom not found');
    });

    it('exposes getData with entity and id', () => {
      const error = new NotFoundError({ entity: 'Thread', id: 'thread_abc' });
      expect(NotFoundError.getData(error)).toEqual({
        entity: 'Thread',
        id: 'thread_abc',
      });
    });
  });

  describe('ForbiddenError', () => {
    it('has correct tag and HTTP protocol properties', () => {
      const error = new ForbiddenError({ message: 'Access denied' });
      expect(error._tag).toBe('ForbiddenError');
      expect(ForbiddenError.httpStatus).toBe(403);
      expect(ForbiddenError.httpCode).toBe('FORBIDDEN');
      expect(ForbiddenError.logLevel).toBe('silent');
    });

    it('returns the message from httpMessage', () => {
      const error = new ForbiddenError({ message: 'Not allowed' });
      expect(ForbiddenError.httpMessage(error)).toBe('Not allowed');
    });
  });

  describe('UnauthorizedError', () => {
    it('has correct tag and HTTP protocol properties', () => {
      const error = new UnauthorizedError({ message: 'Please log in' });
      expect(error._tag).toBe('UnauthorizedError');
      expect(UnauthorizedError.httpStatus).toBe(401);
      expect(UnauthorizedError.httpCode).toBe('UNAUTHORIZED');
      expect(UnauthorizedError.logLevel).toBe('silent');
    });

    it('returns the message from httpMessage', () => {
      const error = new UnauthorizedError({ message: 'Login required' });
      expect(UnauthorizedError.httpMessage(error)).toBe('Login required');
    });
  });

  describe('ValidationError', () => {
    it('has correct tag and HTTP protocol properties', () => {
      const error = new ValidationError({
        field: 'email',
        message: 'Invalid format',
      });
      expect(error._tag).toBe('ValidationError');
      expect(ValidationError.httpStatus).toBe(422);
      expect(ValidationError.httpCode).toBe('VALIDATION_ERROR');
      expect(ValidationError.logLevel).toBe('silent');
    });

    it('formats httpMessage as "field: message"', () => {
      const error = new ValidationError({
        field: 'title',
        message: 'too long',
      });
      expect(ValidationError.httpMessage(error)).toBe('title: too long');
    });

    it('exposes getData with field', () => {
      const error = new ValidationError({
        field: 'name',
        message: 'required',
      });
      expect(ValidationError.getData(error)).toEqual({ field: 'name' });
    });
  });

  describe('DbError', () => {
    it('has correct tag and HTTP protocol properties', () => {
      const error = new DbError({ message: 'Query failed' });
      expect(error._tag).toBe('DbError');
      expect(DbError.httpStatus).toBe(500);
      expect(DbError.httpCode).toBe('INTERNAL_ERROR');
      expect(DbError.httpMessage).toBe('Database operation failed');
      expect(DbError.logLevel).toBe('error-with-stack');
    });
  });

  describe('ConstraintViolationError', () => {
    it('has correct tag and HTTP protocol properties', () => {
      const error = new ConstraintViolationError({
        constraint: 'unique_email',
        message: 'Duplicate email',
      });
      expect(error._tag).toBe('ConstraintViolationError');
      expect(ConstraintViolationError.httpStatus).toBe(409);
      expect(ConstraintViolationError.httpCode).toBe('CONFLICT');
      expect(ConstraintViolationError.httpMessage).toBe(
        'A conflict occurred with existing data',
      );
      expect(ConstraintViolationError.logLevel).toBe('error');
    });

    it('exposes getData with constraint and table', () => {
      const error = new ConstraintViolationError({
        constraint: 'unique_email',
        table: 'users',
        message: 'Duplicate email',
      });
      expect(ConstraintViolationError.getData(error)).toEqual({
        constraint: 'unique_email',
        table: 'users',
      });
    });
  });

  describe('DeadlockError', () => {
    it('has correct tag and HTTP protocol properties', () => {
      const error = new DeadlockError({ message: 'Deadlock detected' });
      expect(error._tag).toBe('DeadlockError');
      expect(DeadlockError.httpStatus).toBe(503);
      expect(DeadlockError.httpCode).toBe('SERVICE_UNAVAILABLE');
      expect(DeadlockError.httpMessage).toBe(
        'Database temporarily unavailable, please retry',
      );
      expect(DeadlockError.logLevel).toBe('error');
    });
  });

  describe('ConnectionError', () => {
    it('has correct tag and HTTP protocol properties', () => {
      const error = new ConnectionError({ message: 'Connection refused' });
      expect(error._tag).toBe('ConnectionError');
      expect(ConnectionError.httpStatus).toBe(503);
      expect(ConnectionError.httpCode).toBe('SERVICE_UNAVAILABLE');
      expect(ConnectionError.httpMessage).toBe('Database connection failed');
      expect(ConnectionError.logLevel).toBe('error-with-stack');
    });
  });

  describe('ExternalServiceError', () => {
    it('has correct tag and HTTP protocol properties', () => {
      const error = new ExternalServiceError({
        service: 'OpenAI',
        message: 'API timeout',
      });
      expect(error._tag).toBe('ExternalServiceError');
      expect(ExternalServiceError.httpStatus).toBe(502);
      expect(ExternalServiceError.httpCode).toBe('BAD_GATEWAY');
      expect(ExternalServiceError.logLevel).toBe('error');
    });

    it('formats httpMessage with service name', () => {
      const error = new ExternalServiceError({
        service: 'OpenAI',
        message: 'API timeout',
      });
      expect(ExternalServiceError.httpMessage(error)).toBe(
        'External service OpenAI failed',
      );
    });

    it('exposes getData with service', () => {
      const error = new ExternalServiceError({
        service: 'Google',
        message: 'Rate limited',
      });
      expect(ExternalServiceError.getData(error)).toEqual({
        service: 'Google',
      });
    });
  });
});
