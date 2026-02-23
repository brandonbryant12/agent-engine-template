import { describe, it, expect } from 'vitest';
import type { LLMError } from '../../errors';
import { mapError } from '../map-error';

describe('LLM mapError', () => {
  it('maps error with "rate limit" to LLMRateLimitError', () => {
    const result = mapError(new Error('API rate limit exceeded'));
    expect(result?._tag).toBe('LLMRateLimitError');
    expect(result.message).toBe('API rate limit exceeded');
  });

  it('maps error with "429" to LLMRateLimitError', () => {
    const result = mapError(new Error('HTTP 429 Too Many Requests'));
    expect(result?._tag).toBe('LLMRateLimitError');
    expect(result.message).toBe('HTTP 429 Too Many Requests');
  });

  it('maps generic Error to LLMError with cause', () => {
    const original = new Error('Connection timeout');
    const result = mapError(original);
    expect(result?._tag).toBe('LLMError');
    expect(result.message).toBe('Connection timeout');
    expect((result as LLMError).cause).toBe(original);
  });

  it('maps non-Error value to LLMError with "Unknown LLM error"', () => {
    const result = mapError(42);
    expect(result?._tag).toBe('LLMError');
    expect(result.message).toBe('Unknown LLM error');
    expect((result as LLMError).cause).toBe(42);
  });
});
