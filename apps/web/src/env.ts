import { Schema } from 'effect';

const PathStartingWithSlash = Schema.String.pipe(
  Schema.filter((value): value is `/${string}` => value.startsWith('/'), {
    message: () => 'Path must start with "/".',
  }),
);

const UrlSchema = Schema.String.pipe(
  Schema.filter(
    (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: () => 'Invalid URL' },
  ),
);

const envSchema = Schema.Struct({
  PUBLIC_SERVER_URL: UrlSchema,
  PUBLIC_SERVER_API_PATH: Schema.optionalWith(PathStartingWithSlash, {
    default: () => '/api' as const,
  }),
  PUBLIC_BASE_PATH: Schema.optionalWith(PathStartingWithSlash, {
    default: () => '/' as const,
  }),
});

const runtimeEnv: Record<string, unknown> = {
  ...import.meta.env,
  ...(((globalThis as Record<string, unknown>).__ENV__ as Record<
    string,
    unknown
  >) ?? {}),
};

export const env = Schema.decodeUnknownSync(envSchema)(runtimeEnv);
