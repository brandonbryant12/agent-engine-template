import { ProxyAgent, setGlobalDispatcher } from 'undici';

const log = (message: string): void => {
  process.stdout.write(`${message}\n`);
};

/**
 * Configure global HTTP/HTTPS proxy when proxy env vars are present.
 * Must be called before any network requests.
 */
export const configureProxy = (): void => {
  const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;

  if (!proxyUrl) {
    return;
  }

  log(`[Proxy] Configuring proxy: ${proxyUrl}`);

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const noProxy = process.env.NO_PROXY;

  const proxyAgent = new ProxyAgent({
    uri: proxyUrl,
    ...(noProxy && { noProxy }),
  });

  setGlobalDispatcher(proxyAgent);
  log('[Proxy] Global fetch dispatcher configured with proxy agent');

  if (noProxy) {
    log(`[Proxy] NO_PROXY hosts: ${noProxy}`);
  }
};
