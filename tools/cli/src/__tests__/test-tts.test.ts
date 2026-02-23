import { TTS } from '@repo/ai';
import { MockTTSLive, MOCK_VOICES, createMockTTS } from '@repo/ai/testing';
import { Effect } from 'effect';
import { describe, it, expect } from 'vitest';
import type { TTSError } from '@repo/ai';

describe('test-tts command logic', () => {
  it('lists available voices', async () => {
    const voices = await Effect.runPromise(
      Effect.gen(function* () {
        const tts = yield* TTS;
        return yield* tts.listVoices();
      }).pipe(Effect.provide(MockTTSLive)),
    );

    expect(voices.length).toBe(MOCK_VOICES.length);
    expect(voices[0]?.id).toBe('Charon');
  });

  it('generates audio preview for a voice', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tts = yield* TTS;
        return yield* tts.previewVoice({
          voiceId: 'Charon',
          text: 'Hello, test.',
        });
      }).pipe(Effect.provide(MockTTSLive)),
    );

    expect(result.audioContent).toBeInstanceOf(Buffer);
    expect(result.audioContent.length).toBeGreaterThan(0);
    expect(result.voiceId).toBe('Charon');
  });

  it('returns audio with correct encoding info', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tts = yield* TTS;
        return yield* tts.previewVoice({
          voiceId: 'Kore',
          text: 'Test encoding.',
        });
      }).pipe(Effect.provide(MockTTSLive)),
    );

    expect(result.audioEncoding).toBeDefined();
    expect(result.voiceId).toBe('Kore');
  });

  it('surfaces TTSError when preview fails', async () => {
    const errorLayer = createMockTTS({ errorMessage: 'Quota exceeded' });

    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const tts = yield* TTS;
        return yield* tts.previewVoice({
          voiceId: 'Charon',
          text: 'test',
        });
      }).pipe(Effect.provide(errorLayer)),
    );

    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure' && exit.cause._tag === 'Fail') {
      const error = exit.cause.error;
      expect(error?._tag).toBe('TTSError');
      expect((error as TTSError).message).toBe('Quota exceeded');
    }
  });
});
