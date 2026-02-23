/**
 * Live integration tests for TTS (Google Gemini) service.
 *
 * These tests are SKIPPED by default and only run when GEMINI_API_KEY is set.
 * Use them to verify:
 * - Service configuration before deployment
 * - API connectivity and credentials
 * - Real audio generation and format validation
 *
 * Run with: GEMINI_API_KEY=xxx pnpm --filter @repo/ai test:live:tts
 */
import { it } from '@effect/vitest';
import { expectEffectFailure } from '@repo/testing';
import { Effect, Exit } from 'effect';
import { describe, expect } from 'vitest';
import { TTSError, TTSQuotaExceededError } from '../../errors';
import { GoogleTTSLive, TTS } from '../../tts';
import { VOICES, FEMALE_VOICES, MALE_VOICES } from '../../tts/voices';
import { liveTestEnv } from './env';

const GEMINI_API_KEY = liveTestEnv.GEMINI_API_KEY;

describe.skipIf(!GEMINI_API_KEY)('TTS Live Integration', () => {
  const layer = GoogleTTSLive({ apiKey: GEMINI_API_KEY! });

  describe('listVoices', () => {
    it.effect('can list available voices', () =>
      Effect.gen(function* () {
        const tts = yield* TTS;
        const voices = yield* tts.listVoices();

        expect(voices.length).toBe(VOICES.length);
        expect(voices.length).toBe(FEMALE_VOICES.length + MALE_VOICES.length);
      }).pipe(Effect.provide(layer)),
    );

    it.effect('can filter voices by gender', () =>
      Effect.gen(function* () {
        const tts = yield* TTS;
        const female = yield* tts.listVoices({ gender: 'female' });
        const male = yield* tts.listVoices({ gender: 'male' });

        expect(female.length).toBe(FEMALE_VOICES.length);
        expect(male.length).toBe(MALE_VOICES.length);

        for (const voice of female) {
          expect(voice.gender).toBe('female');
        }
        for (const voice of male) {
          expect(voice.gender).toBe('male');
        }
      }).pipe(Effect.provide(layer)),
    );
  });

  describe('previewVoice', () => {
    it.effect('can generate audio from text', () =>
      Effect.gen(function* () {
        const tts = yield* TTS;
        const result = yield* tts.previewVoice({
          voiceId: 'Charon',
          text: 'Hello, this is a test.',
        });

        expect(result.audioContent).toBeInstanceOf(Buffer);
        expect(result.audioContent.length).toBeGreaterThan(0);
        expect(result.voiceId).toBe('Charon');
        expect(result.audioEncoding).toBeDefined();
      }).pipe(Effect.provide(layer)),
    );

    it.effect('returns LINEAR16 WAV audio', () =>
      Effect.gen(function* () {
        const tts = yield* TTS;
        const result = yield* tts.previewVoice({
          voiceId: 'Kore',
          text: 'Testing audio format.',
        });

        expect(result.audioEncoding).toBe('LINEAR16');
        expect(result.audioContent.length).toBeGreaterThan(0);

        // WAV files should start with RIFF header
        const header = result.audioContent.slice(0, 4).toString('ascii');
        expect(header).toBe('RIFF');
      }).pipe(Effect.provide(layer)),
    );

    it.effect('can preview multiple different voices', () =>
      Effect.gen(function* () {
        const tts = yield* TTS;
        const voicesToTest = ['Charon', 'Kore', 'Fenrir', 'Aoede'] as const;
        const results = [];

        for (const voiceId of voicesToTest) {
          const result = yield* tts.previewVoice({
            voiceId,
            text: `Hello from ${voiceId}.`,
          });
          results.push(result);
        }

        expect(results.length).toBe(voicesToTest.length);
        for (let i = 0; i < results.length; i++) {
          expect(results[i]?.voiceId).toBe(voicesToTest[i]);
          expect(results[i]?.audioContent.length).toBeGreaterThan(0);
        }
      }).pipe(Effect.provide(layer)),
    );
  });

  describe('synthesize', () => {
    it.effect('can synthesize multi-speaker audio', () =>
      Effect.gen(function* () {
        const tts = yield* TTS;
        const result = yield* tts.synthesize({
          turns: [
            { speaker: 'host', text: 'Welcome to the show!' },
            { speaker: 'guest', text: 'Thanks for having me.' },
            { speaker: 'host', text: 'Let us get started.' },
          ],
          voiceConfigs: [
            { speakerAlias: 'host', voiceId: 'Charon' },
            { speakerAlias: 'guest', voiceId: 'Kore' },
          ],
        });

        expect(result.audioContent).toBeInstanceOf(Buffer);
        expect(result.audioContent.length).toBeGreaterThan(0);
        expect(result.audioEncoding).toBeDefined();
        expect(result.mimeType).toBeDefined();
      }).pipe(Effect.provide(layer)),
    );

    it.effect('returns LINEAR16 WAV for synthesis', () =>
      Effect.gen(function* () {
        const tts = yield* TTS;
        const result = yield* tts.synthesize({
          turns: [{ speaker: 'narrator', text: 'Testing audio format.' }],
          voiceConfigs: [{ speakerAlias: 'narrator', voiceId: 'Alnilam' }],
        });

        expect(result.audioContent.length).toBeGreaterThan(0);
        expect(result.audioEncoding).toBe('LINEAR16');
        expect(result.mimeType).toBe('audio/wav');
        const header = result.audioContent.slice(0, 4).toString('ascii');
        expect(header).toBe('RIFF');
      }).pipe(Effect.provide(layer)),
    );
  });

  describe('error handling', () => {
    it.effect('handles invalid API key', () =>
      Effect.gen(function* () {
        const invalidLayer = GoogleTTSLive({ apiKey: 'invalid-api-key' });

        const exit = yield* Effect.gen(function* () {
          const tts = yield* TTS;
          return yield* tts.previewVoice({
            voiceId: 'Charon',
            text: 'Test',
          });
        }).pipe(Effect.provide(invalidLayer), Effect.exit);

        expectEffectFailure(exit, TTSError);
      }),
    );
  });
});

describe.skipIf(!GEMINI_API_KEY)('TTS Live Integration - Rate Limiting', () => {
  it.skip('handles rate limiting gracefully', async () => {
    const layer = GoogleTTSLive({ apiKey: GEMINI_API_KEY! });

    const effects = Array.from({ length: 20 }, () =>
      Effect.gen(function* () {
        const tts = yield* TTS;
        return yield* tts.previewVoice({
          voiceId: 'Charon',
          text: 'Rate limit test',
        });
      }).pipe(Effect.provide(layer)),
    );

    const exits = await Effect.runPromise(
      Effect.all(
        effects.map((e) => e.pipe(Effect.exit)),
        { concurrency: 'unbounded' },
      ),
    );

    const successes = exits.filter(Exit.isSuccess);
    const failures = exits.filter(Exit.isFailure);

    expect(successes.length).toBeGreaterThan(0);

    for (const failure of failures) {
      expectEffectFailure(failure, TTSQuotaExceededError);
    }
  });
});
