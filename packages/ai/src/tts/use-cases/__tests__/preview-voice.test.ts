import { it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { describe, expect } from 'vitest';
import {
  TTSError,
  TTSQuotaExceededError,
  VoiceNotFoundError,
} from '../../../errors';
import {
  TTS,
  type TTSService,
  type PreviewVoiceResult,
  type GeminiVoiceId,
} from '../../index';
import { previewVoice } from '../preview-voice';

// =============================================================================
// Mock TTS Service
// =============================================================================

interface MockConfig {
  shouldFail?: 'tts-error' | 'quota-exceeded';
  previewResult?: PreviewVoiceResult;
}

const createMockTTSService = (config: MockConfig = {}): TTSService => ({
  listVoices: () => Effect.die('Not implemented in mock'),

  previewVoice: (options) => {
    if (config.shouldFail === 'tts-error') {
      return Effect.fail(new TTSError({ message: 'TTS service unavailable' }));
    }
    if (config.shouldFail === 'quota-exceeded') {
      return Effect.fail(
        new TTSQuotaExceededError({ message: 'Quota exceeded' }),
      );
    }
    return Effect.succeed(
      config.previewResult ?? {
        audioContent: Buffer.from('test audio content'),
        audioEncoding: 'LINEAR16' as const,
        voiceId: options.voiceId,
      },
    );
  },

  synthesize: () => Effect.die('Not implemented in mock'),
});

const createMockTTSLayer = (config: MockConfig = {}): Layer.Layer<TTS> =>
  Layer.succeed(TTS, createMockTTSService(config));

// =============================================================================
// Tests
// =============================================================================

describe('previewVoice', () => {
  it.layer(createMockTTSLayer())('successful preview', (it) => {
    it.effect('generates audio preview for valid voice ID', () =>
      Effect.gen(function* () {
        const result = yield* previewVoice({ voiceId: 'Charon' });
        expect(result.voiceId).toBe('Charon');
        expect(result.audioEncoding).toBe('LINEAR16');
        expect(Buffer.isBuffer(result.audioContent)).toBe(true);
      }),
    );

    it.effect('passes custom text to TTS service', () =>
      Effect.gen(function* () {
        const result = yield* previewVoice({
          voiceId: 'Kore',
          text: 'Custom preview text',
        });
        expect(result.voiceId).toBe('Kore');
      }),
    );
  });

  it.layer(
    createMockTTSLayer({
      previewResult: {
        audioContent: Buffer.from('wav audio'),
        audioEncoding: 'LINEAR16',
        voiceId: 'Charon' as GeminiVoiceId,
      },
    }),
  )('audio encoding', (it) => {
    it.effect('returns LINEAR16 encoding from the TTS service', () =>
      Effect.gen(function* () {
        const result = yield* previewVoice({
          voiceId: 'Charon',
        });
        expect(result.audioEncoding).toBe('LINEAR16');
      }),
    );
  });

  describe('voice validation', () => {
    it.effect('fails with VoiceNotFoundError for invalid voice ID', () =>
      Effect.gen(function* () {
        const exit = yield* previewVoice({ voiceId: 'InvalidVoice' }).pipe(
          Effect.exit,
        );
        expect(exit._tag).toBe('Failure');
        if (exit._tag === 'Failure') {
          const error = exit.cause;
          expect(error._tag).toBe('Fail');
          if (error._tag === 'Fail') {
            expect(error.error._tag).toBe('VoiceNotFoundError');
            expect((error.error as VoiceNotFoundError).voiceId).toBe(
              'InvalidVoice',
            );
          }
        }
      }).pipe(Effect.provide(createMockTTSLayer())),
    );

    it('VoiceNotFoundError has correct HTTP protocol properties', () => {
      const error = new VoiceNotFoundError({ voiceId: 'BadVoice' });

      expect(VoiceNotFoundError.httpStatus).toBe(404);
      expect(VoiceNotFoundError.httpCode).toBe('VOICE_NOT_FOUND');
      expect(VoiceNotFoundError.logLevel).toBe('silent');
      expect(VoiceNotFoundError.httpMessage(error)).toBe(
        'Voice "BadVoice" not found',
      );
      expect(VoiceNotFoundError.getData(error)).toEqual({
        voiceId: 'BadVoice',
      });
    });

    it('VoiceNotFoundError uses custom message when provided', () => {
      const error = new VoiceNotFoundError({
        voiceId: 'BadVoice',
        message: 'Custom error message',
      });

      expect(VoiceNotFoundError.httpMessage(error)).toBe(
        'Custom error message',
      );
    });
  });

  describe('TTS service errors', () => {
    it.effect('propagates TTSError from service', () =>
      Effect.gen(function* () {
        const exit = yield* previewVoice({ voiceId: 'Charon' }).pipe(
          Effect.exit,
        );
        expect(exit._tag).toBe('Failure');
      }).pipe(Effect.provide(createMockTTSLayer({ shouldFail: 'tts-error' }))),
    );

    it.effect('propagates TTSQuotaExceededError from service', () =>
      Effect.gen(function* () {
        const exit = yield* previewVoice({ voiceId: 'Charon' }).pipe(
          Effect.exit,
        );
        expect(exit._tag).toBe('Failure');
      }).pipe(
        Effect.provide(createMockTTSLayer({ shouldFail: 'quota-exceeded' })),
      ),
    );
  });

  describe('all valid voice IDs', () => {
    const validVoiceIds = [
      'Achernar',
      'Aoede',
      'Charon',
      'Kore',
      'Zephyr',
      'Zubenelgenubi',
    ];

    for (const voiceId of validVoiceIds) {
      it.effect(`accepts valid voice ID: ${voiceId}`, () =>
        Effect.gen(function* () {
          const result = yield* previewVoice({ voiceId });
          expect(result.voiceId).toBe(voiceId);
        }).pipe(Effect.provide(createMockTTSLayer())),
      );
    }
  });
});
