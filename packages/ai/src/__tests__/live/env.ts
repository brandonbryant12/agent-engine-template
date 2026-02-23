import { Schema } from 'effect';

const liveTestEnvSchema = Schema.Struct({
  GEMINI_API_KEY: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
});

export const liveTestEnv = Schema.decodeUnknownSync(liveTestEnvSchema)(
  process.env, // eslint-disable-line no-restricted-properties -- Validated env boundary for live tests
);
