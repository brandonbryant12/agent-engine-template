import { createAuthClient as createBetterAuthClient } from 'better-auth/react';
import urlJoin from 'url-join';

export interface AuthClientOptions {
  apiBaseUrl: string;
  apiBasePath: string;
}

export const createAuthClient = ({
  apiBaseUrl,
  apiBasePath,
}: AuthClientOptions) =>
  createBetterAuthClient({
    baseURL: urlJoin(apiBaseUrl, apiBasePath, 'auth'),
  });
