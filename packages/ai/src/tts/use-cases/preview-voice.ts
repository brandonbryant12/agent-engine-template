import { Effect } from 'effect';
import {
  TTS,
  type AudioEncoding,
  type GeminiVoiceId,
  isValidVoiceId,
} from '../index';
import { VoiceNotFoundError } from './errors';

// =============================================================================
// Types
// =============================================================================

export interface PreviewVoiceInput {
  readonly voiceId: string;
  readonly text?: string;
}

export interface PreviewVoiceUseCaseResult {
  readonly audioContent: Buffer;
  readonly audioEncoding: AudioEncoding;
  readonly voiceId: string;
}

// =============================================================================
// Use Case
// =============================================================================

/** Generate a preview audio sample for a voice. */
export const previewVoice = (input: PreviewVoiceInput) =>
  Effect.gen(function* () {
    if (!isValidVoiceId(input.voiceId)) {
      return yield* new VoiceNotFoundError({ voiceId: input.voiceId });
    }

    const tts = yield* TTS;
    return yield* tts.previewVoice({
      voiceId: input.voiceId as GeminiVoiceId,
      text: input.text,
    });
  }).pipe(
    Effect.withSpan('useCase.previewVoice', {
      attributes: {
        'voice.id': input.voiceId,
      },
    }),
  );
