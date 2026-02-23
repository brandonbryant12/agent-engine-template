import { describe, it, expect } from 'vitest';
import type { TTSError } from '../../errors';
import { mapError } from '../map-error';

describe('TTS mapError', () => {
  it('maps error with "quota" to TTSQuotaExceededError', () => {
    const result = mapError(new Error('API quota exceeded'));
    expect(result?._tag).toBe('TTSQuotaExceededError');
    expect(result.message).toBe('API quota exceeded');
  });

  it('maps error with "429" to TTSQuotaExceededError', () => {
    const result = mapError(new Error('HTTP 429 Too Many Requests'));
    expect(result?._tag).toBe('TTSQuotaExceededError');
    expect(result.message).toBe('HTTP 429 Too Many Requests');
  });

  it('maps generic Error to TTSError with cause', () => {
    const original = new Error('Connection timeout');
    const result = mapError(original);
    expect(result?._tag).toBe('TTSError');
    expect(result.message).toBe('Connection timeout');
    expect((result as TTSError).cause).toBe(original);
  });

  it('maps non-Error value to TTSError with "Unknown TTS error"', () => {
    const result = mapError('some string');
    expect(result?._tag).toBe('TTSError');
    expect(result.message).toBe('Unknown TTS error');
    expect((result as TTSError).cause).toBe('some string');
  });
});
