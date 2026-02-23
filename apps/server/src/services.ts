import {
  configureSSEPublisher,
  createApi,
  createServerRuntime,
} from '@repo/api/server';
import { AuthMode, createAuth } from '@repo/auth/server';
import { createDb } from '@repo/db/client';
import { buildStorageConfig } from './config';
import { env } from './env';

export const storageConfig = buildStorageConfig();

export const db = createDb({ databaseUrl: env.SERVER_POSTGRES_URL });

const microsoftSSOConfig =
  env.AUTH_MODE === AuthMode.DEV_PASSWORD
    ? undefined
    : {
        // Validated in env.ts when AUTH_MODE is hybrid/sso-only.
        clientId: env.AUTH_MICROSOFT_CLIENT_ID!,
        clientSecret: env.AUTH_MICROSOFT_CLIENT_SECRET!,
        tenantId: env.AUTH_MICROSOFT_TENANT_ID!,
        roleGroups: {
          adminGroupIds: env.AUTH_ROLE_ADMIN_GROUP_IDS,
          userGroupIds: env.AUTH_ROLE_USER_GROUP_IDS,
        },
      };

export const auth = createAuth({
  webUrl: env.PUBLIC_WEB_URL,
  serverUrl: env.PUBLIC_SERVER_URL,
  apiPath: env.PUBLIC_SERVER_API_PATH,
  authSecret: env.SERVER_AUTH_SECRET,
  authMode: env.AUTH_MODE,
  microsoftSSO: microsoftSSOConfig,
  db,
});

configureSSEPublisher({
  redisUrl: env.SERVER_REDIS_URL,
  channelPrefix: env.SSE_REDIS_CHANNEL_PREFIX,
});

export const serverRuntime = createServerRuntime({
  db,
  storageConfig,
  useMockAI: env.USE_MOCK_AI,
  geminiApiKey: env.GEMINI_API_KEY,
});

export const api = createApi({
  auth,
  serverRuntime,
  serverUrl: env.PUBLIC_SERVER_URL,
  apiPath: env.PUBLIC_SERVER_API_PATH,
});
