import { Effect, Schema } from 'effect';

const EnvSchema = Schema.Struct({
  SERVER_POSTGRES_URL: Schema.optional(Schema.String),
  GEMINI_API_KEY: Schema.optional(Schema.String),
  HTTPS_PROXY: Schema.optional(Schema.String),
  HTTP_PROXY: Schema.optional(Schema.String),
  NO_PROXY: Schema.optional(Schema.String),
  // Storage config (used by seed commands)
  STORAGE_PROVIDER: Schema.optional(Schema.String),
  STORAGE_PATH: Schema.optional(Schema.String),
  STORAGE_BASE_URL: Schema.optional(Schema.String),
  PUBLIC_SERVER_URL: Schema.optional(Schema.String),
  S3_BUCKET: Schema.optional(Schema.String),
  S3_REGION: Schema.optional(Schema.String),
  S3_ACCESS_KEY_ID: Schema.optional(Schema.String),
  S3_SECRET_ACCESS_KEY: Schema.optional(Schema.String),
  S3_ENDPOINT: Schema.optional(Schema.String),
});

type Env = typeof EnvSchema.Type;

export class EnvError {
  readonly _tag = 'EnvError';
  constructor(readonly message: string) {}
}

export const loadEnv = (): Effect.Effect<Env, EnvError> =>
  Schema.decodeUnknown(EnvSchema)(process.env).pipe(
    Effect.mapError(
      () => new EnvError('Failed to parse environment variables.'),
    ),
  );
