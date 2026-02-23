import { layer } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { expect } from 'vitest';
import { TTS, type TTSService, VOICES } from '../../index';
import { listVoices } from '../list-voices';

// =============================================================================
// Mock TTS Service
// =============================================================================

const createMockTTSService = (): TTSService => ({
  listVoices: (options) =>
    Effect.succeed(
      options?.gender
        ? VOICES.filter((v) => v.gender === options.gender)
        : VOICES,
    ),
  previewVoice: () => Effect.die('Not implemented in mock'),
  synthesize: () => Effect.die('Not implemented in mock'),
});

const MockTTSLayer: Layer.Layer<TTS> = Layer.succeed(
  TTS,
  createMockTTSService(),
);

// =============================================================================
// Tests
// =============================================================================

layer(MockTTSLayer)('listVoices', (it) => {
  it.effect('returns all available voices', () =>
    Effect.gen(function* () {
      const result = yield* listVoices({});
      expect(result.voices).toHaveLength(VOICES.length);
      expect(result.voices).toEqual(VOICES);
    }),
  );

  it.effect('returns only female voices when gender is female', () =>
    Effect.gen(function* () {
      const result = yield* listVoices({ gender: 'female' });
      expect(result.voices.length).toBeGreaterThan(0);
      expect(result.voices.every((v) => v.gender === 'female')).toBe(true);
    }),
  );

  it.effect('returns only male voices when gender is male', () =>
    Effect.gen(function* () {
      const result = yield* listVoices({ gender: 'male' });
      expect(result.voices.length).toBeGreaterThan(0);
      expect(result.voices.every((v) => v.gender === 'male')).toBe(true);
    }),
  );
});
