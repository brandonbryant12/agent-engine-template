import { Effect } from 'effect';
import { describe, it, expect, afterEach } from 'vitest';
import { loadEnv } from '../lib/env';

describe('loadEnv', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns env with GEMINI_API_KEY when set', async () => {
    process.env.GEMINI_API_KEY = 'test-key-123';

    const result = await Effect.runPromise(loadEnv());
    expect(result.GEMINI_API_KEY).toBe('test-key-123');
  });

  it('succeeds when no API keys are set', async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await Effect.runPromise(loadEnv());
    expect(result.GEMINI_API_KEY).toBeUndefined();
  });
});
