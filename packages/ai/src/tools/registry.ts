import { type Tool, jsonSchema } from 'ai';
import { Effect, JSONSchema } from 'effect';
import { invokeWeatherTool, WeatherInputSchema } from './weather';

export interface ToolMetadata {
  readonly id: string;
  readonly contractVersion: string;
  readonly authMode: 'public' | 'protected';
  readonly rolePolicy: 'none' | 'user-or-admin' | 'admin-only';
  readonly egressPolicy: {
    readonly allowlistedHosts: readonly string[];
  };
  readonly dataClassification: 'public' | 'internal' | 'sensitive';
  readonly ownerDomain: 'api' | 'auth' | 'frontend' | 'observability' | 'docs-tooling';
  readonly enabledChannels: readonly string[];
}

export interface RegisteredTool {
  readonly metadata: ToolMetadata;
  readonly aiTool: (options: {
    readonly actorRole?: string | null;
  }) => Tool;
}

const weatherTool: RegisteredTool = {
  metadata: {
    id: 'weather.current',
    contractVersion: '1.0.0',
    authMode: 'protected',
    rolePolicy: 'user-or-admin',
    egressPolicy: {
      allowlistedHosts: ['api.open-meteo.com'],
    },
    dataClassification: 'sensitive',
    ownerDomain: 'api',
    enabledChannels: ['chat.general'],
  },
  aiTool: (options) =>
    ({
      description:
        'Fetch current weather for coordinates. Returns explicit units and normalized condition text.',
      inputSchema: jsonSchema(JSONSchema.make(WeatherInputSchema)),
      execute: async (input: unknown) =>
        Effect.runPromise(
          invokeWeatherTool(input, {
            actorRole: options.actorRole,
          }) as Effect.Effect<unknown, unknown, never>,
        ),
    }) as Tool,
};

const TOOL_REGISTRY = [weatherTool] as const;

export const listToolMetadata = (): readonly ToolMetadata[] =>
  TOOL_REGISTRY.map((entry) => entry.metadata);

export const resolveEnabledToolsForChannel = (
  channel: string,
  options: { readonly actorRole?: string | null } = {},
): Record<string, Tool> => {
  const enabled = TOOL_REGISTRY.filter((entry) =>
    entry.metadata.enabledChannels.includes(channel),
  );

  return Object.fromEntries(
    enabled.map((entry) => [entry.metadata.id, entry.aiTool(options)]),
  ) as Record<string, Tool>;
};
