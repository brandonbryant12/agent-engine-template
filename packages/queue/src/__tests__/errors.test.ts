import { describe, it, expect } from 'vitest';
import {
  QueueError,
  JobNotFoundError,
  JobProcessingError,
  formatError,
} from '../errors';

describe('queue errors', () => {
  describe('QueueError', () => {
    it('creates a tagged error with correct tag and message', () => {
      const error = new QueueError({ message: 'Queue operation failed' });

      expect(error._tag).toBe('QueueError');
      expect(error.message).toBe('Queue operation failed');
    });

    it('includes optional cause', () => {
      const cause = new Error('Database connection failed');
      const error = new QueueError({
        message: 'Queue operation failed',
        cause,
      });

      expect(error.cause).toBe(cause);
    });

    it('exposes correct HTTP protocol properties', () => {
      expect(QueueError.httpStatus).toBe(500);
      expect(QueueError.httpCode).toBe('INTERNAL_ERROR');
      expect(QueueError.httpMessage).toBe('Job queue operation failed');
      expect(QueueError.logLevel).toBe('error-with-stack');
    });
  });

  describe('JobNotFoundError', () => {
    it('creates a tagged error with jobId', () => {
      const error = new JobNotFoundError({ jobId: 'job-123' });

      expect(error._tag).toBe('JobNotFoundError');
      expect(error.jobId).toBe('job-123');
    });

    it('httpMessage falls back to default when message is empty', () => {
      const error = new JobNotFoundError({ jobId: 'job-123' });

      const result = JobNotFoundError.httpMessage(error);
      expect(result).toBe('Job job-123 not found');
    });

    it('httpMessage returns custom message when provided', () => {
      const error = new JobNotFoundError({
        jobId: 'job-123',
        message: 'Custom not found message',
      });

      expect(error.message).toBe('Custom not found message');
      expect(JobNotFoundError.httpMessage(error)).toBe(
        'Custom not found message',
      );
    });

    it('httpMessage returns fallback when message is undefined', () => {
      // Directly test the static method with an object that has undefined message
      const errorLike = {
        jobId: 'job-123',
        message: undefined,
      } as JobNotFoundError;
      expect(JobNotFoundError.httpMessage(errorLike)).toBe(
        'Job job-123 not found',
      );
    });

    it('exposes correct HTTP protocol properties', () => {
      expect(JobNotFoundError.httpStatus).toBe(404);
      expect(JobNotFoundError.httpCode).toBe('JOB_NOT_FOUND');
      expect(JobNotFoundError.logLevel).toBe('silent');
    });

    it('getData returns jobId', () => {
      const error = new JobNotFoundError({ jobId: 'job-abc' });
      expect(JobNotFoundError.getData(error)).toEqual({ jobId: 'job-abc' });
    });
  });

  describe('JobProcessingError', () => {
    it('creates a tagged error with jobId and message', () => {
      const error = new JobProcessingError({
        jobId: 'job-456',
        message: 'LLM API rate limited',
      });

      expect(error._tag).toBe('JobProcessingError');
      expect(error.jobId).toBe('job-456');
      expect(error.message).toBe('LLM API rate limited');
    });

    it('includes optional cause', () => {
      const cause = new Error('API timeout');
      const error = new JobProcessingError({
        jobId: 'job-456',
        message: 'LLM API rate limited',
        cause,
      });

      expect(error.cause).toBe(cause);
    });

    it('exposes correct HTTP protocol properties', () => {
      expect(JobProcessingError.httpStatus).toBe(500);
      expect(JobProcessingError.httpCode).toBe('INTERNAL_ERROR');
      expect(JobProcessingError.httpMessage).toBe('Job processing failed');
      expect(JobProcessingError.logLevel).toBe('error-with-stack');
    });

    it('getData returns jobId', () => {
      const error = new JobProcessingError({
        jobId: 'job-xyz',
        message: 'Processing failed',
      });
      expect(JobProcessingError.getData(error)).toEqual({ jobId: 'job-xyz' });
    });
  });
});

describe('formatError', () => {
  it('formats Effect tagged errors with _tag and message', () => {
    const error = new QueueError({ message: 'something broke' });
    expect(formatError(error)).toBe('QueueError: something broke');
  });

  it('formats Effect tagged errors with _tag only (no message)', () => {
    // Simulate a tagged error that has _tag but no message property
    const error = { _tag: 'SomeError' };
    expect(formatError(error)).toBe('SomeError');
  });

  it('formats tagged errors with empty message as tag only', () => {
    const error = { _tag: 'SomeError', message: '' };
    expect(formatError(error)).toBe('SomeError');
  });

  it('formats standard Error objects using message', () => {
    const error = new Error('standard error message');
    expect(formatError(error)).toBe('standard error message');
  });

  it('formats standard Error with empty message using name', () => {
    const error = new Error();
    error.message = '';
    expect(formatError(error)).toBe('Error');
  });

  it('formats string values using String()', () => {
    expect(formatError('plain string error')).toBe('plain string error');
  });

  it('formats number values using String()', () => {
    expect(formatError(42)).toBe('42');
  });

  it('formats null using String()', () => {
    expect(formatError(null)).toBe('null');
  });

  it('formats undefined using String()', () => {
    expect(formatError(undefined)).toBe('undefined');
  });

  it('prioritizes _tag over Error instance check for tagged errors', () => {
    // A Schema.TaggedError is both an object with _tag AND an instanceof Error.
    // formatError should use the _tag branch, not the Error branch.
    const error = new JobNotFoundError({ jobId: 'job-1' });
    // Should format as "JobNotFoundError" (tag branch, no message on this error)
    const result = formatError(error);
    expect(result).toBe('JobNotFoundError');
  });

  it('formats JobProcessingError with tag and message', () => {
    const error = new JobProcessingError({
      jobId: 'job-1',
      message: 'timeout',
    });
    expect(formatError(error)).toBe('JobProcessingError: timeout');
  });
});
