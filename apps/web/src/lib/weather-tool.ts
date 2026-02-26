export type ToolInvocationState =
  | 'idle'
  | 'validating'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'cancelled'
  | 'retrying';

export interface WeatherToolInput {
  latitude: string;
  longitude: string;
  locationLabel: string;
}

export interface WeatherToolState {
  status: ToolInvocationState;
  message: string;
  errorTag: string | null;
}

export const WEATHER_TOOL_INITIAL_STATE: WeatherToolState = {
  status: 'idle',
  message: 'Ready to invoke weather tool.',
  errorTag: null,
};

const REMEDIATION_BY_TAG: Record<string, string> = {
  ToolValidationError: 'Check latitude/longitude values and try again.',
  UnauthorizedError: 'Sign in again and retry.',
  ForbiddenError: 'Your role is not permitted for this tool.',
  ToolTimeoutError: 'Provider timed out. Retry shortly.',
  ToolRateLimitError: 'Provider rate limit reached. Retry in a minute.',
  ToolSchemaDriftError: 'Provider payload changed. Contact support.',
  ToolProviderError: 'Provider is unavailable. Try later.',
};

export const toWeatherToolRemediation = (errorTag: string | null): string => {
  if (!errorTag) return 'Retry when ready.';
  return REMEDIATION_BY_TAG[errorTag] ?? 'Try again or contact support.';
};

export const toWeatherToolStatusMessage = (
  state: ToolInvocationState,
): string => {
  if (state === 'idle') return 'Ready to invoke weather tool.';
  if (state === 'validating') return 'Validating weather tool input.';
  if (state === 'running') return 'Running weather tool.';
  if (state === 'succeeded') return 'Weather tool completed successfully.';
  if (state === 'failed') return 'Weather tool failed.';
  if (state === 'timed_out') return 'Weather tool timed out.';
  if (state === 'cancelled') return 'Weather tool invocation cancelled.';
  return 'Retrying weather tool.';
};

export const parseWeatherToolInput = (input: WeatherToolInput) => ({
  latitude: Number(input.latitude),
  longitude: Number(input.longitude),
  locationLabel: input.locationLabel,
});

export const toWeatherAnnouncement = (state: WeatherToolState): string => {
  if (state.status === 'failed' || state.status === 'timed_out') {
    return `${state.message} ${toWeatherToolRemediation(state.errorTag)}`;
  }
  return state.message;
};
