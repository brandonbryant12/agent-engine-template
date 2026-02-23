import { createBothClients } from '@repo/api/client';
import { env } from '@/env';

const { client, queryUtils } = createBothClients({
  serverUrl: env.PUBLIC_SERVER_URL,
  apiPath: env.PUBLIC_SERVER_API_PATH,
});

export const rawApiClient = client;
export const apiClient = queryUtils;
