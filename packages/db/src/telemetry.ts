import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  type SpanExporter,
  SimpleSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { Effect, Layer } from 'effect';

export interface TelemetryConfig {
  readonly serviceName: string;
  readonly serviceVersion?: string;
  readonly environment?: string;
  readonly enabled?: boolean;
  readonly otlpEndpoint?: string;
  readonly otlpTracesEndpoint?: string;
  readonly otlpHeaders?: string;
  readonly otlpTracesHeaders?: string;
}

let initialized = false;
let provider: NodeTracerProvider | null = null;

const DEPLOYMENT_ENVIRONMENT_NAME = 'deployment.environment.name';

const parseOtlpEndpointUrl = (endpoint: string): URL | null => {
  try {
    return new URL(endpoint);
  } catch {
    return null;
  }
};

const normalizeOtlpTracesEndpoint = (endpoint: string): string => {
  const trimmed = endpoint.trim();
  const url = parseOtlpEndpointUrl(trimmed);
  if (!url) {
    return trimmed;
  }
  if (!url.pathname || url.pathname === '') {
    url.pathname = '/';
  }
  return url.toString();
};

const resolveOtlpBaseTracesEndpoint = (endpoint: string): string => {
  const trimmed = endpoint.trim();
  const url = parseOtlpEndpointUrl(trimmed);
  if (!url) {
    const normalized = trimmed.replace(/\/+$/, '');
    return `${normalized}/v1/traces`;
  }
  if (!url.pathname || url.pathname === '') {
    url.pathname = '/';
  }
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  return new URL('v1/traces', url).toString();
};

const parseOtlpHeaders = (
  rawHeaders?: string,
): Record<string, string> | undefined => {
  if (!rawHeaders) {
    return undefined;
  }

  const entries = rawHeaders
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
        return null;
      }
      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      if (!key || !value) {
        return null;
      }
      return [key, value] as const;
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
};

const resolveTracesEndpoint = (config: TelemetryConfig): string | undefined => {
  if (config.otlpTracesEndpoint) {
    return normalizeOtlpTracesEndpoint(config.otlpTracesEndpoint);
  }
  if (config.otlpEndpoint) {
    return resolveOtlpBaseTracesEndpoint(config.otlpEndpoint);
  }
  return undefined;
};

const resolveTracesHeaders = (
  config: TelemetryConfig,
): Record<string, string> | undefined => {
  const rawHeaders =
    config.otlpTracesHeaders !== undefined
      ? config.otlpTracesHeaders
      : config.otlpHeaders;
  return parseOtlpHeaders(rawHeaders);
};

const createSpanExporter = (
  config: TelemetryConfig,
  tracesEndpoint?: string,
): SpanExporter => {
  if (tracesEndpoint) {
    return new OTLPTraceExporter({
      url: tracesEndpoint,
      headers: resolveTracesHeaders(config),
    });
  }

  return new ConsoleSpanExporter();
};

export const initTelemetry = (config: TelemetryConfig): void => {
  if (config.enabled === false || initialized) return;

  provider = new NodeTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion ?? '0.0.0',
      [DEPLOYMENT_ENVIRONMENT_NAME]: config.environment ?? 'development',
    }),
  });

  const tracesEndpoint = resolveTracesEndpoint(config);
  const exporter = createSpanExporter(config, tracesEndpoint);
  if (tracesEndpoint) {
    provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  } else {
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  }
  provider.register();
  initialized = true;
};

export const shutdownTelemetry = async (): Promise<void> => {
  if (!provider) return;
  await provider.shutdown();
  provider = null;
  initialized = false;
};

export const TelemetryLive = (config: TelemetryConfig): Layer.Layer<never> =>
  Layer.effectDiscard(Effect.sync(() => initTelemetry(config)));

export const TelemetryDisabled: Layer.Layer<never> = Layer.empty;
