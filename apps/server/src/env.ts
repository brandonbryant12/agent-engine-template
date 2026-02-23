import { Schema } from 'effect';
import { DEFAULT_SERVER_PORT } from './constants';

const DEFAULT_SERVER_HOST = 'localhost';

const PortSchema = Schema.transform(
  Schema.String,
  Schema.Number.pipe(Schema.int(), Schema.between(0, 65535)),
  {
    decode: (s) => parseInt(s, 10),
    encode: (n) => String(n),
  },
);

const PathStartingWithSlash = Schema.String.pipe(
  Schema.filter((input): input is `/${string}` => input.startsWith('/'), {
    message: () => 'API Path must start with "/" if provided.',
  }),
);

const UrlSchema = Schema.String.pipe(
  Schema.filter(
    (s) => {
      try {
        new URL(s);
        return true;
      } catch {
        return false;
      }
    },
    { message: () => 'Invalid URL' },
  ),
);

const BooleanStringSchema = Schema.transform(Schema.String, Schema.Boolean, {
  decode: (s) => s === 'true' || s === '1',
  encode: (b) => (b ? 'true' : 'false'),
});

const StorageProviderSchema = Schema.Union(
  Schema.Literal('filesystem'),
  Schema.Literal('s3'),
);

const AuthModeSchema = Schema.Union(
  Schema.Literal('dev-password'),
  Schema.Literal('hybrid'),
  Schema.Literal('sso-only'),
);

const CsvStringArraySchema = Schema.transform(
  Schema.String,
  Schema.Array(Schema.String),
  {
    decode: (input) =>
      input
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    encode: (parts) => parts.join(','),
  },
);

export const envSchema = Schema.Struct({
  SERVER_PORT: Schema.optionalWith(PortSchema, {
    default: () => DEFAULT_SERVER_PORT,
  }),
  SERVER_HOST: Schema.optionalWith(Schema.String.pipe(Schema.minLength(1)), {
    default: () => DEFAULT_SERVER_HOST,
  }),
  SERVER_AUTH_SECRET: Schema.String.pipe(Schema.minLength(1)),
  AUTH_MODE: Schema.optionalWith(AuthModeSchema, {
    default: () => 'dev-password' as const,
  }),
  AUTH_MICROSOFT_CLIENT_ID: Schema.optional(
    Schema.String.pipe(Schema.minLength(1)),
  ),
  AUTH_MICROSOFT_CLIENT_SECRET: Schema.optional(
    Schema.String.pipe(Schema.minLength(1)),
  ),
  AUTH_MICROSOFT_TENANT_ID: Schema.optional(
    Schema.String.pipe(Schema.minLength(1)),
  ),
  AUTH_ROLE_ADMIN_GROUP_IDS: Schema.optionalWith(CsvStringArraySchema, {
    default: () => [],
  }),
  AUTH_ROLE_USER_GROUP_IDS: Schema.optionalWith(CsvStringArraySchema, {
    default: () => [],
  }),
  SERVER_POSTGRES_URL: Schema.String,

  PUBLIC_SERVER_URL: UrlSchema,
  PUBLIC_SERVER_API_PATH: Schema.optionalWith(PathStartingWithSlash, {
    default: () => '/api' as `/${string}`,
  }),
  PUBLIC_WEB_URL: UrlSchema,

  GEMINI_API_KEY: Schema.optional(Schema.String.pipe(Schema.minLength(1))),

  USE_MOCK_AI: Schema.optionalWith(BooleanStringSchema, {
    default: () => true,
  }),

  STORAGE_PROVIDER: Schema.optionalWith(StorageProviderSchema, {
    default: () => 'filesystem' as const,
  }),
  STORAGE_PATH: Schema.optional(Schema.String),
  STORAGE_BASE_URL: Schema.optional(Schema.String),
  S3_BUCKET: Schema.optional(Schema.String),
  S3_REGION: Schema.optional(Schema.String),
  S3_ACCESS_KEY_ID: Schema.optional(Schema.String),
  S3_SECRET_ACCESS_KEY: Schema.optional(Schema.String),
  S3_ENDPOINT: Schema.optional(Schema.String),
  S3_PUBLIC_ENDPOINT: Schema.optional(Schema.String),

  SERVER_REDIS_URL: Schema.optionalWith(Schema.String, {
    default: () => 'redis://localhost:6379',
  }),
  SSE_REDIS_CHANNEL_PREFIX: Schema.optionalWith(Schema.String, {
    default: () => 'cs:sse:user',
  }),

  CORS_ORIGINS: Schema.optional(Schema.String),

  TELEMETRY_ENABLED: Schema.optionalWith(BooleanStringSchema, {
    default: () => process.env.NODE_ENV === 'production',
  }),
  OTEL_EXPORTER_OTLP_ENDPOINT: Schema.optional(Schema.String),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: Schema.optional(Schema.String),
  OTEL_EXPORTER_OTLP_HEADERS: Schema.optional(Schema.String),
  OTEL_EXPORTER_OTLP_TRACES_HEADERS: Schema.optional(Schema.String),
  OTEL_SERVICE_NAME: Schema.optional(Schema.String),
  OTEL_SERVICE_VERSION: Schema.optional(Schema.String),
  OTEL_ENV: Schema.optionalWith(Schema.String, {
    default: () => process.env.NODE_ENV ?? 'development',
  }),

  HTTPS_PROXY: Schema.optional(Schema.String),
  HTTP_PROXY: Schema.optional(Schema.String),
  NO_PROXY: Schema.optional(Schema.String),
});

const rawEnv = Schema.decodeUnknownSync(envSchema)(process.env);

if (!rawEnv.USE_MOCK_AI) {
  if (!rawEnv.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required when USE_MOCK_AI=false');
  }
}

if (rawEnv.AUTH_MODE !== 'dev-password') {
  if (
    !rawEnv.AUTH_MICROSOFT_CLIENT_ID ||
    !rawEnv.AUTH_MICROSOFT_CLIENT_SECRET ||
    !rawEnv.AUTH_MICROSOFT_TENANT_ID
  ) {
    throw new Error(
      'AUTH_MICROSOFT_CLIENT_ID, AUTH_MICROSOFT_CLIENT_SECRET, and AUTH_MICROSOFT_TENANT_ID are required when AUTH_MODE is hybrid or sso-only',
    );
  }

  if (
    rawEnv.AUTH_ROLE_ADMIN_GROUP_IDS.length === 0 ||
    rawEnv.AUTH_ROLE_USER_GROUP_IDS.length === 0
  ) {
    throw new Error(
      'AUTH_ROLE_ADMIN_GROUP_IDS and AUTH_ROLE_USER_GROUP_IDS must be configured when AUTH_MODE is hybrid or sso-only',
    );
  }
}

export const env = rawEnv;
