import { Storage } from '@repo/storage';
import { Effect } from 'effect';
import { TTS, type VoiceGender, type VoiceInfo } from '../index';

// =============================================================================
// Types
// =============================================================================

export interface ListVoicesWithPreviewsInput {
  readonly gender?: VoiceGender;
}

export interface VoiceWithPreview extends VoiceInfo {
  readonly previewUrl: string | null;
}

// =============================================================================
// Helpers
// =============================================================================

const resolvePreviewUrl = (voiceId: string) =>
  Effect.gen(function* () {
    const storage = yield* Storage;
    const key = `voice-previews/${voiceId}.wav`;
    const exists = yield* storage.exists(key);
    if (!exists) return null;
    return yield* storage.getUrl(key);
  }).pipe(Effect.catchAll(() => Effect.succeed(null)));

// =============================================================================
// Use Case
// =============================================================================

/**
 * List available TTS voices with their preview URLs.
 *
 * This use case combines voice listing with preview URL resolution from storage.
 * Each voice is enriched with a `previewUrl` if a preview WAV file exists in storage.
 *
 * @example
 * const voices = yield* listVoicesWithPreviews({});
 */
export const listVoicesWithPreviews = (input: ListVoicesWithPreviewsInput) =>
  Effect.gen(function* () {
    const tts = yield* TTS;
    const voices = yield* tts.listVoices({ gender: input.gender });

    return yield* Effect.all(
      voices.map((voice) =>
        resolvePreviewUrl(voice.id).pipe(
          Effect.map(
            (previewUrl): VoiceWithPreview => ({ ...voice, previewUrl }),
          ),
        ),
      ),
      { concurrency: 'unbounded' },
    );
  }).pipe(
    Effect.withSpan('useCase.listVoicesWithPreviews', {
      attributes: {
        'filter.gender': input.gender,
      },
    }),
  );
