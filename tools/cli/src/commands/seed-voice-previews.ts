import { Command } from '@effect/cli';
import { VOICES, GoogleTTSLive, previewVoice } from '@repo/ai/tts';
import { Storage, FilesystemStorageLive, S3StorageLive } from '@repo/storage';
import { Console, Effect, Layer } from 'effect';
import { loadEnv, type EnvError } from '../lib/env';

/** The 8 voices exposed in the frontend UI */
const FRONTEND_VOICE_IDS = [
  'Aoede',
  'Kore',
  'Leda',
  'Zephyr',
  'Charon',
  'Fenrir',
  'Puck',
  'Orus',
] as const;

const storageKey = (voiceId: string) => `voice-previews/${voiceId}.wav`;

const buildStorageLayer = (env: {
  STORAGE_PROVIDER?: string;
  STORAGE_PATH?: string;
  STORAGE_BASE_URL?: string;
  PUBLIC_SERVER_URL?: string;
  S3_BUCKET?: string;
  S3_REGION?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_ENDPOINT?: string;
}): Layer.Layer<Storage> => {
  if (env.STORAGE_PROVIDER === 's3') {
    if (
      !env.S3_BUCKET ||
      !env.S3_REGION ||
      !env.S3_ACCESS_KEY_ID ||
      !env.S3_SECRET_ACCESS_KEY
    ) {
      throw new Error(
        'S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY required for s3 provider',
      );
    }
    return S3StorageLive({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      endpoint: env.S3_ENDPOINT,
    });
  }

  // Default to filesystem
  const basePath = env.STORAGE_PATH ?? './uploads';
  const baseUrl =
    env.STORAGE_BASE_URL ??
    `${env.PUBLIC_SERVER_URL ?? 'http://localhost:3000'}/storage`;
  return FilesystemStorageLive({ basePath, baseUrl });
};

const run = Effect.gen(function* () {
  const env = yield* loadEnv();

  if (!env.GEMINI_API_KEY) {
    yield* Console.log('Error: GEMINI_API_KEY is required.');
    return;
  }

  yield* Console.log('\nSeeding voice previews...\n');

  const ttsLayer = GoogleTTSLive({ apiKey: env.GEMINI_API_KEY });
  const storageLayer = buildStorageLayer(env);
  const layers = Layer.mergeAll(ttsLayer, storageLayer);

  const voiceNames = VOICES.filter((v) =>
    FRONTEND_VOICE_IDS.includes(v.id as (typeof FRONTEND_VOICE_IDS)[number]),
  ).reduce(
    (acc, v) => {
      acc[v.id] = v.name;
      return acc;
    },
    {} as Record<string, string>,
  );

  let seeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const voiceId of FRONTEND_VOICE_IDS) {
    const key = storageKey(voiceId);
    const name = voiceNames[voiceId] ?? voiceId;

    // Check if preview already exists
    const exists = yield* Effect.gen(function* () {
      const storage = yield* Storage;
      return yield* storage.exists(key);
    }).pipe(
      Effect.provide(storageLayer),
      Effect.catchAll(() => Effect.succeed(false)),
    );

    if (exists) {
      yield* Console.log(`  SKIP  ${name} — already exists`);
      skipped++;
      continue;
    }

    // Generate preview
    const result = yield* previewVoice({ voiceId }).pipe(
      Effect.provide(layers),
      Effect.either,
    );

    if (result._tag === 'Left') {
      yield* Console.log(`  FAIL  ${name} — ${String(result.left)}`);
      failed++;
      continue;
    }

    // Upload to storage
    const uploadResult = yield* Effect.gen(function* () {
      const storage = yield* Storage;
      return yield* storage.upload(key, result.right.audioContent, 'audio/wav');
    }).pipe(Effect.provide(storageLayer), Effect.either);

    if (uploadResult._tag === 'Left') {
      yield* Console.log(
        `  FAIL  ${name} — upload: ${String(uploadResult.left)}`,
      );
      failed++;
      continue;
    }

    const sizeKb = (result.right.audioContent.length / 1024).toFixed(1);
    yield* Console.log(`  OK    ${name} — ${sizeKb} KB → ${key}`);
    seeded++;
  }

  yield* Console.log(
    `\nDone. seeded=${seeded} skipped=${skipped} failed=${failed}`,
  );
}).pipe(
  Effect.catchTag('EnvError', (e: EnvError) =>
    Console.log(`\nEnvironment error: ${e.message}`),
  ),
);

export const seedVoicePreviews = Command.make(
  'voice-previews',
  {},
  () => run,
).pipe(
  Command.withDescription(
    'Generate and upload TTS preview clips for frontend voices',
  ),
);
