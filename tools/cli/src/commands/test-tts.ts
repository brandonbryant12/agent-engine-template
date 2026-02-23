import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, Prompt } from '@effect/cli';
import { FEMALE_VOICES, MALE_VOICES, type GeminiVoiceId } from '@repo/ai';
import { Console, Effect } from 'effect';
import { loadEnv } from '../lib/env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../../.output');

const GENERATE_CONTENT_MODEL = 'gemini-2.5-flash-preview-tts';
const CLOUD_TTS_MODEL = 'gemini-2.5-flash-tts';

const SAMPLE_DIALOGUE = [
  {
    speaker: 'Host',
    text: 'Welcome to the show! Today we have a very special guest.',
  },
  {
    speaker: 'Guest',
    text: 'Thanks for having me, it is great to be here!',
  },
  {
    speaker: 'Host',
    text: 'So tell us, what have you been working on lately?',
  },
  {
    speaker: 'Guest',
    text: 'I have been exploring the latest advances in AI-generated speech. It is truly remarkable how natural it sounds now.',
  },
] as const;

const genderPrompt = (label: string) =>
  Prompt.select({
    message: `${label} voice gender`,
    choices: [
      { title: 'Female', value: 'female' as const },
      { title: 'Male', value: 'male' as const },
    ],
  });

const voicePrompt = (label: string, voices: readonly string[]) =>
  Prompt.select({
    message: `${label} voice`,
    choices: voices.map((id) => ({
      title: id,
      value: id as GeminiVoiceId,
    })),
  });

const getDefaultKey = (): Effect.Effect<string | undefined> =>
  Effect.gen(function* () {
    const env = yield* loadEnv();
    return env.GEMINI_API_KEY;
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

/**
 * Multi-speaker via generativelanguage.googleapis.com generateContent.
 */
const tryGenerateContent = (
  apiKey: string,
  hostVoice: string,
  guestVoice: string,
): Effect.Effect<{ audioContent: Uint8Array }, Error> =>
  Effect.tryPromise({
    try: async () => {
      const conversationText = SAMPLE_DIALOGUE.map(
        (t) => `${t.speaker}: ${t.text}`,
      ).join('\n');

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GENERATE_CONTENT_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: conversationText }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: [
                    {
                      speaker: 'Host',
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: hostVoice },
                      },
                    },
                    {
                      speaker: 'Guest',
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: guestVoice },
                      },
                    },
                  ],
                },
              },
            },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`${response.status} - ${errorBody}`);
      }

      const data = (await response.json()) as {
        candidates: Array<{
          content: {
            parts: Array<{
              inlineData?: { mimeType: string; data: string };
            }>;
          };
        }>;
      };

      const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData?.data) {
        throw new Error('No audio data in response');
      }

      const audioContent = Uint8Array.from(
        Buffer.from(inlineData.data, 'base64'),
      );
      return { audioContent };
    },
    catch: (e) => new Error(e instanceof Error ? e.message : 'Unknown error'),
  });

/**
 * Multi-speaker via texttospeech.googleapis.com text:synthesize.
 * Uses the Cloud TTS multiSpeakerMarkup format with Gemini TTS voices.
 * Docs: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
 */
const tryTextToSpeech = (
  apiKey: string,
  hostVoice: string,
  guestVoice: string,
): Effect.Effect<{ audioContent: Uint8Array }, Error> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: {
              multiSpeakerMarkup: {
                turns: SAMPLE_DIALOGUE.map((t) => ({
                  speaker: t.speaker,
                  text: t.text,
                })),
              },
            },
            voice: {
              languageCode: 'en-US',
              modelName: CLOUD_TTS_MODEL,
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  { speakerAlias: 'Host', speakerId: hostVoice },
                  { speakerAlias: 'Guest', speakerId: guestVoice },
                ],
              },
            },
            audioConfig: {
              audioEncoding: 'LINEAR16',
              sampleRateHertz: 24000,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`${response.status} - ${errorBody}`);
      }

      const data = (await response.json()) as { audioContent: string };
      const audioContent = Uint8Array.from(
        Buffer.from(data.audioContent, 'base64'),
      );
      return { audioContent };
    },
    catch: (e) => new Error(e instanceof Error ? e.message : 'Unknown error'),
  });

const saveAudio = (
  filename: string,
  audioContent: Uint8Array,
): Effect.Effect<string, Error> =>
  Effect.gen(function* () {
    const filePath = path.join(OUTPUT_DIR, filename);
    yield* Effect.tryPromise({
      try: () => fs.mkdir(OUTPUT_DIR, { recursive: true }),
      catch: (e) => new Error(`Failed to create output dir: ${e}`),
    });
    yield* Effect.tryPromise({
      try: () => fs.writeFile(filePath, audioContent),
      catch: (e) => new Error(`Failed to write audio file: ${e}`),
    });
    return filePath;
  });

export const testTts = Command.make('tts', {}).pipe(
  Command.withHandler(() =>
    Effect.gen(function* () {
      const defaultKey = yield* getDefaultKey();
      const apiKey = yield* Prompt.run(
        Prompt.text({
          message: 'API key',
          default: defaultKey,
        }),
      );

      // Pick host voice
      const hostGender = yield* Prompt.run(genderPrompt('Host'));
      const hostVoices = hostGender === 'female' ? FEMALE_VOICES : MALE_VOICES;
      const hostVoice = yield* Prompt.run(voicePrompt('Host', hostVoices));

      // Pick guest voice
      const guestGender = yield* Prompt.run(genderPrompt('Guest'));
      const guestVoices =
        guestGender === 'female' ? FEMALE_VOICES : MALE_VOICES;
      const guestVoice = yield* Prompt.run(voicePrompt('Guest', guestVoices));

      yield* Console.log(`\nHost: ${hostVoice}, Guest: ${guestVoice}`);
      yield* Console.log(`Turns: ${SAMPLE_DIALOGUE.length}\n`);

      const timestamp = Date.now();

      // --- Endpoint 1: generateContent ---
      yield* Console.log(
        '--- [1] generativelanguage.googleapis.com (generateContent) ---',
      );
      const gc = yield* tryGenerateContent(apiKey, hostVoice, guestVoice).pipe(
        Effect.either,
      );
      if (gc._tag === 'Right') {
        const fp = yield* saveAudio(
          `tts-generateContent-${timestamp}.wav`,
          gc.right.audioContent,
        );
        yield* Console.log(
          `  OK  ${(gc.right.audioContent.length / 1024).toFixed(1)} KB → ${fp}`,
        );
      } else {
        yield* Console.log(`  FAIL  ${gc.left.message}`);
      }

      // --- Endpoint 2: texttospeech ---
      yield* Console.log(
        '\n--- [2] texttospeech.googleapis.com (text:synthesize) ---',
      );
      yield* Console.log(`  Model: ${CLOUD_TTS_MODEL}`);
      const tts = yield* tryTextToSpeech(apiKey, hostVoice, guestVoice).pipe(
        Effect.either,
      );
      if (tts._tag === 'Right') {
        const fp = yield* saveAudio(
          `tts-texttospeech-${timestamp}.mp3`,
          tts.right.audioContent,
        );
        yield* Console.log(
          `  OK  ${(tts.right.audioContent.length / 1024).toFixed(1)} KB → ${fp}`,
        );
      } else {
        yield* Console.log(`  FAIL  ${tts.left.message}`);
      }
    }),
  ),
  Command.withDescription(
    'Test TTS on both Google endpoints (generateContent + text:synthesize)',
  ),
);
