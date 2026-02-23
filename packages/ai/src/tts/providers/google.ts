import { Effect, Layer } from 'effect';
import { TTS_MODEL } from '../../models';
import { wrapPcmAsWav } from '../audio-utils';
import { mapError } from '../map-error';
import {
  TTS,
  type TTSService,
  type SynthesizeOptions,
  type SynthesizeResult,
  type ListVoicesOptions,
  type PreviewVoiceOptions,
  type PreviewVoiceResult,
} from '../service';
import { VOICES, getVoicesByGender, DEFAULT_PREVIEW_TEXT } from '../voices';

/**
 * Configuration for Google Gemini TTS provider.
 */
export interface GoogleTTSConfig {
  /** Gemini API key - required, should be passed from validated env.GEMINI_API_KEY */
  readonly apiKey: string;
  /** Override the default TTS model from models.ts */
  readonly model?: string;
}

/** Typed shape of the Gemini TTS generateContent response. */
interface GeminiTTSResponse {
  candidates: Array<{
    content: {
      parts: Array<{ inlineData?: { mimeType: string; data: string } }>;
    };
  }>;
}

/** Call the Gemini generateContent endpoint and return the raw response. */
async function callGeminiTTS(
  apiKey: string,
  modelName: string,
  body: Record<string, unknown>,
): Promise<GeminiTTSResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google TTS API error: ${response.status} - ${errorBody}`);
  }

  return (await response.json()) as GeminiTTSResponse;
}

/** Extract audio buffer from a Gemini TTS response, wrapping raw PCM as WAV if needed. */
function extractAudio(data: GeminiTTSResponse): Buffer {
  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) {
    const preview = JSON.stringify(data).slice(0, 500);
    throw new Error(`No audio data in response: ${preview}`);
  }

  const audioData = Buffer.from(inlineData.data, 'base64');
  const isAlreadyWav = audioData.slice(0, 4).toString('ascii') === 'RIFF';
  return isAlreadyWav ? audioData : wrapPcmAsWav(audioData);
}

/**
 * Create Google TTS service implementation.
 */
const makeGoogleTTSService = (config: GoogleTTSConfig): TTSService => {
  const modelName = config.model ?? TTS_MODEL;

  return {
    listVoices: (options?: ListVoicesOptions) =>
      Effect.succeed(
        options?.gender ? getVoicesByGender(options.gender) : VOICES,
      ).pipe(
        Effect.withSpan('tts.listVoices', {
          attributes: {
            'tts.provider': 'google',
            'tts.gender': options?.gender ?? 'all',
          },
        }),
      ),

    previewVoice: (options: PreviewVoiceOptions) =>
      Effect.tryPromise({
        try: async () => {
          const data = await callGeminiTTS(config.apiKey, modelName, {
            contents: [
              { parts: [{ text: options.text ?? DEFAULT_PREVIEW_TEXT }] },
            ],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: options.voiceId },
                },
              },
            },
          });

          return {
            audioContent: extractAudio(data),
            audioEncoding: 'LINEAR16',
            voiceId: options.voiceId,
          } satisfies PreviewVoiceResult;
        },
        catch: mapError,
      }).pipe(
        Effect.withSpan('tts.previewVoice', {
          attributes: {
            'tts.provider': 'google',
            'tts.model': modelName,
            'tts.voiceId': options.voiceId,
          },
        }),
      ),

    synthesize: (options: SynthesizeOptions) =>
      Effect.tryPromise({
        try: async () => {
          const isSingleSpeaker = options.voiceConfigs.length === 1;
          const contentText = isSingleSpeaker
            ? options.turns.map((t) => t.text).join('\n')
            : options.turns.map((t) => `${t.speaker}: ${t.text}`).join('\n');

          const speechConfig = isSingleSpeaker
            ? {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: options.voiceConfigs[0]!.voiceId,
                  },
                },
              }
            : {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: options.voiceConfigs.map((vc) => ({
                    speaker: vc.speakerAlias,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: vc.voiceId },
                    },
                  })),
                },
              };

          const data = await callGeminiTTS(config.apiKey, modelName, {
            contents: [{ parts: [{ text: contentText }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig,
            },
          });

          return {
            audioContent: extractAudio(data),
            audioEncoding: 'LINEAR16',
            mimeType: 'audio/wav',
          } satisfies SynthesizeResult;
        },
        catch: mapError,
      }).pipe(
        Effect.withSpan('tts.synthesize', {
          attributes: {
            'tts.provider': 'google',
            'tts.model': modelName,
            'tts.turnCount': options.turns.length,
            'tts.speakerCount': options.voiceConfigs.length,
          },
        }),
      ),
  };
};

/**
 * Create Google TTS service layer.
 *
 * @example
 * ```typescript
 * const TTSLive = GoogleTTSLive({ apiKey: 'your-api-key' });
 *
 * const program = Effect.gen(function* () {
 *   const tts = yield* TTS;
 *   const result = yield* tts.synthesize({
 *     turns: [
 *       { speaker: 'host', text: 'Welcome to the show!' },
 *       { speaker: 'guest', text: 'Thanks for having me!' },
 *     ],
 *     voiceConfigs: [
 *       { speakerAlias: 'host', voiceId: 'Charon' },
 *       { speakerAlias: 'guest', voiceId: 'Kore' },
 *     ],
 *   });
 *   return result.audioContent;
 * }).pipe(Effect.provide(TTSLive));
 * ```
 */
export const GoogleTTSLive = (config: GoogleTTSConfig): Layer.Layer<TTS> =>
  Layer.sync(TTS, () => makeGoogleTTSService(config));
