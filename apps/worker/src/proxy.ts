/* eslint-disable no-console -- Lifecycle logging before Effect runtime is available */
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { env } from './env';

/**
 * Configure global HTTP/HTTPS proxy for corporate environments.
 * Must be called before any network requests are made.
 */
export function configureProxy(): void {
  const proxyUrl = env.HTTPS_PROXY ?? env.HTTP_PROXY;

  if (!proxyUrl) {
    return;
  }

  console.log(`[Proxy] Configuring proxy: ${proxyUrl}`);

  // Corporate proxies often use their own CA
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log(
    '[Proxy] Disabled TLS certificate verification (NODE_TLS_REJECT_UNAUTHORIZED=0)',
  );

  const proxyAgent = new ProxyAgent({
    uri: proxyUrl,
    ...(env.NO_PROXY && { noProxy: env.NO_PROXY }),
  });

  setGlobalDispatcher(proxyAgent);
  console.log('[Proxy] Global fetch dispatcher configured with proxy agent');

  if (env.NO_PROXY) {
    console.log(`[Proxy] NO_PROXY hosts: ${env.NO_PROXY}`);
  }
}
