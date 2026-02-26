export type ToolAuthMode = 'public' | 'protected';
export type ToolExecutionContext = 'interactive-chat' | 'background-run';

export interface ToolDefinition {
  readonly id: 'weather.current';
  readonly contractVersion: '1.0.0';
  readonly authMode: ToolAuthMode;
  readonly rolePolicy: readonly string[];
  readonly egressPolicy: {
    readonly allowedHosts: readonly string[];
    readonly outboundFields: readonly string[];
  };
  readonly dataClassification: 'internal';
  readonly ownershipDomain: 'domain:api';
  readonly enabledContexts: readonly ToolExecutionContext[];
}

export const WEATHER_TOOL_DEFINITION: ToolDefinition = {
  id: 'weather.current',
  contractVersion: '1.0.0',
  authMode: 'protected',
  rolePolicy: ['user', 'admin'],
  egressPolicy: {
    allowedHosts: ['api.open-meteo.com'],
    outboundFields: ['latitude', 'longitude', 'current'],
  },
  dataClassification: 'internal',
  ownershipDomain: 'domain:api',
  enabledContexts: ['interactive-chat'],
};

const TOOL_REGISTRY = Object.freeze([WEATHER_TOOL_DEFINITION] as const);

export const listTools = (): readonly ToolDefinition[] => TOOL_REGISTRY;

export const getTool = (toolId: ToolDefinition['id']): ToolDefinition | null =>
  TOOL_REGISTRY.find((tool) => tool.id === toolId) ?? null;

export const isToolEnabledInContext = (
  tool: ToolDefinition,
  context: ToolExecutionContext,
): boolean => tool.enabledContexts.includes(context);
