import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { resolvePrompt } from '../resolver';

describe('prompt resolver', () => {
  it('uses explicit version over channel default', async () => {
    const prompt = await Effect.runPromise(
      resolvePrompt({
        key: 'chat.general.system',
        channel: 'chat.general',
        version: 'v2',
      }),
    );

    expect(prompt.policy).toBe('explicitVersion');
    expect(prompt.version).toBe('v2');
    expect(prompt.status).toBe('deprecated');
  });

  it('uses channel default when version is not provided', async () => {
    const prompt = await Effect.runPromise(
      resolvePrompt({
        key: 'chat.general.system',
        channel: 'chat.general',
      }),
    );

    expect(prompt.policy).toBe('channelDefault');
    expect(prompt.version).toBe('v1');
    expect(prompt.status).toBe('active');
  });

  it('fails with typed error for missing key', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        resolvePrompt({
          key: 'chat.missing.system',
          channel: 'chat.general',
        }),
      ),
    );

    expect(error._tag).toBe('PromptKeyNotFoundError');
    expect(error.key).toBe('chat.missing.system');
  });

  it('fails with typed error for missing version', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        resolvePrompt({
          key: 'chat.general.system',
          channel: 'chat.general',
          version: 'v99',
        }),
      ),
    );

    expect(error._tag).toBe('PromptVersionNotFoundError');
    if (error._tag !== 'PromptVersionNotFoundError') {
      throw new Error('Expected PromptVersionNotFoundError');
    }
    expect(error.version).toBe('v99');
  });

  it('fails with typed error for blocked version', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        resolvePrompt({
          key: 'chat.general.system',
          channel: 'chat.general',
          version: 'v0',
        }),
      ),
    );

    expect(error._tag).toBe('PromptVersionBlockedError');
    if (error._tag !== 'PromptVersionBlockedError') {
      throw new Error('Expected PromptVersionBlockedError');
    }
    expect(error.version).toBe('v0');
  });

  it('fails with typed error for variable schema mismatch', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        resolvePrompt({
          key: 'chat.templated.system',
          channel: 'chat.general',
          version: 'v1',
          variables: {},
        }),
      ),
    );

    expect(error._tag).toBe('PromptVariableSchemaMismatchError');
    if (error._tag !== 'PromptVariableSchemaMismatchError') {
      throw new Error('Expected PromptVariableSchemaMismatchError');
    }
    expect(error.key).toBe('chat.templated.system');
    expect(error.version).toBe('v1');
    expect(error.issues.length).toBeGreaterThan(0);
  });

  it('returns legacy fallback when compatibility mode is enabled', async () => {
    const prompt = await Effect.runPromise(
      resolvePrompt({
        key: 'chat.missing.system',
        channel: 'chat.general',
        compatibilityMode: 'legacy-inline-fallback',
        legacyFallback: 'legacy prompt',
      }),
    );

    expect(prompt.outcome).toBe('compatibility-fallback');
    expect(prompt.version).toBe('legacy-inline');
    expect(prompt.fallbackReason).toBe('PromptKeyNotFoundError');
    expect(prompt.content).toBe('legacy prompt');
  });
});
