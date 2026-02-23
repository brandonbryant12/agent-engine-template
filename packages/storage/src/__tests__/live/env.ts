import { Schema } from 'effect';

const liveTestEnvSchema = Schema.Struct({
  S3_BUCKET: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  S3_REGION: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  S3_ACCESS_KEY_ID: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  S3_SECRET_ACCESS_KEY: Schema.optional(
    Schema.String.pipe(Schema.minLength(1)),
  ),
  S3_ENDPOINT: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
});

export const liveTestEnv = Schema.decodeUnknownSync(liveTestEnvSchema)(
  process.env,
);
