import { describe, it, expect } from 'vitest';
import {
  StorageError,
  StorageNotFoundError,
  StorageUploadError,
} from '../errors';

describe('storage errors', () => {
  describe('StorageError', () => {
    it('creates a tagged error with message', () => {
      const error = new StorageError({ message: 'Storage operation failed' });

      expect(error._tag).toBe('StorageError');
      expect(error.message).toBe('Storage operation failed');
    });

    it('accepts optional cause', () => {
      const cause = new Error('Connection refused');
      const error = new StorageError({ message: 'fail', cause });

      expect(error.cause).toBe(cause);
    });

    it('has correct HTTP protocol properties', () => {
      expect(StorageError.httpStatus).toBe(500);
      expect(StorageError.httpCode).toBe('INTERNAL_ERROR');
      expect(StorageError.httpMessage).toBe('Storage operation failed');
      expect(StorageError.logLevel).toBe('error-with-stack');
    });
  });

  describe('StorageNotFoundError', () => {
    it('creates a tagged error with key', () => {
      const error = new StorageNotFoundError({ key: 'audio/chat-run-123.mp3' });

      expect(error._tag).toBe('StorageNotFoundError');
      expect(error.key).toBe('audio/chat-run-123.mp3');
    });

    it('has correct HTTP protocol properties', () => {
      expect(StorageNotFoundError.httpStatus).toBe(404);
      expect(StorageNotFoundError.httpCode).toBe('NOT_FOUND');
      expect(StorageNotFoundError.logLevel).toBe('silent');
    });

    it('httpMessage returns dynamic message with key', () => {
      const error = new StorageNotFoundError({ key: 'audio/test.mp3' });
      const message = StorageNotFoundError.httpMessage(error);

      expect(message).toBe('File not found: audio/test.mp3');
    });

    it('httpMessage uses custom message when provided', () => {
      const error = new StorageNotFoundError({
        key: 'audio/test.mp3',
        message: 'Custom not found',
      });
      const message = StorageNotFoundError.httpMessage(error);

      expect(message).toBe('Custom not found');
    });

    it('getData returns key', () => {
      const error = new StorageNotFoundError({ key: 'audio/test.mp3' });

      expect(StorageNotFoundError.getData(error)).toEqual({
        key: 'audio/test.mp3',
      });
    });
  });

  describe('StorageUploadError', () => {
    it('creates a tagged error with key and message', () => {
      const error = new StorageUploadError({
        key: 'audio/chat-run-123.mp3',
        message: 'Insufficient storage space',
      });

      expect(error._tag).toBe('StorageUploadError');
      expect(error.key).toBe('audio/chat-run-123.mp3');
      expect(error.message).toBe('Insufficient storage space');
    });

    it('accepts optional cause', () => {
      const cause = new Error('Disk full');
      const error = new StorageUploadError({
        key: 'audio/chat-run-123.mp3',
        message: 'fail',
        cause,
      });

      expect(error.cause).toBe(cause);
    });

    it('has correct HTTP protocol properties', () => {
      expect(StorageUploadError.httpStatus).toBe(500);
      expect(StorageUploadError.httpCode).toBe('INTERNAL_ERROR');
      expect(StorageUploadError.httpMessage).toBe('File upload failed');
      expect(StorageUploadError.logLevel).toBe('error-with-stack');
    });

    it('getData returns key', () => {
      const error = new StorageUploadError({
        key: 'audio/test.mp3',
        message: 'fail',
      });

      expect(StorageUploadError.getData(error)).toEqual({
        key: 'audio/test.mp3',
      });
    });
  });
});
