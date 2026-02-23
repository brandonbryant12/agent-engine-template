import { createORPCClient } from '@orpc/client';
import { ResponseValidationPlugin } from '@orpc/contract/plugins';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import urlJoin from 'url-join';
import type {
  ContractRouterClient,
  InferContractRouterOutputs,
} from '@orpc/contract';
import { appContract } from '../contracts';

export { isDefinedError, safe } from '@orpc/client';
export { eventIteratorToUnproxiedDataStream } from '@orpc/client';

export interface APIClientOptions {
  serverUrl: string;
  apiPath: `/${string}`;
}

// Oddly, this is needed for better-auth to not complain
export type { AppRouter } from '../server';

export type AppContract = typeof appContract;
export type APIClient = ContractRouterClient<AppContract>;
export type RouterOutput = InferContractRouterOutputs<AppContract>;
export type TanstackQueryAPIClient = ReturnType<
  typeof createTanstackQueryUtils<APIClient>
>;

export const createAPIClient = ({
  serverUrl,
  apiPath,
}: APIClientOptions): APIClient =>
  createORPCClient(
    new OpenAPILink(appContract, {
      url: urlJoin(serverUrl, apiPath),
      plugins: [new ResponseValidationPlugin(appContract)],
      fetch: (request, init) =>
        globalThis.fetch(request, { ...init, credentials: 'include' }),
    }),
  );

export const createTanstackQueryAPIClient = (
  opts: APIClientOptions,
): TanstackQueryAPIClient => {
  const apiClient = createAPIClient(opts);
  return createTanstackQueryUtils(apiClient);
};

export const createBothClients = (opts: APIClientOptions) => {
  const client = createAPIClient(opts);
  const queryUtils = createTanstackQueryUtils(client);
  return { client, queryUtils };
};
