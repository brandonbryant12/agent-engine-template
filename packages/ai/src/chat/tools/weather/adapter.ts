import { ForbiddenError, UnauthorizedError } from '@repo/db/errors';
import { Effect, Schema } from 'effect';
import { WeatherToolInputSchema, type WeatherToolOutput } from '../contracts';
import { ToolValidationError, type ToolError } from '../errors';
import {
  getTool,
  isToolEnabledInContext,
  type ToolExecutionContext,
} from '../registry';
import {
  fetchOpenMeteoCurrentWeather,
  type OpenMeteoCurrentWeather,
} from './provider';

const WEATHER_TOOL_ID = 'weather.current' as const;

const decodeWeatherInput = (input: unknown) =>
  Effect.try({
    try: () => Schema.decodeUnknownSync(WeatherToolInputSchema)(input),
    catch: (error) =>
      new ToolValidationError({
        message: 'Weather tool input validation failed',
        issues: [
          error instanceof Error && error.message.length > 0
            ? error.message
            : 'Invalid weather tool input',
        ],
      }),
  });

const normalizeWeatherOutput = (
  locationLabel: string,
  provider: OpenMeteoCurrentWeather,
): WeatherToolOutput => ({
  locationLabel,
  observedAtIso: provider.observedAtIso,
  weatherSummary: provider.weatherSummary,
  temperature: {
    value: provider.temperatureC,
    unit: 'Celsius',
  },
  windSpeed: {
    value: provider.windSpeedKmh,
    unit: 'km/h',
  },
  windDirection: {
    value: provider.windDirectionDegrees,
    unit: 'degrees',
  },
  source: 'open-meteo',
});

export const invokeWeatherTool = ({
  input,
  executionContext,
  user,
}: {
  input: unknown;
  executionContext: ToolExecutionContext;
  user: { id: string; role: 'user' | 'admin' } | null;
}): Effect.Effect<
  WeatherToolOutput,
  ToolError | ForbiddenError | UnauthorizedError,
  never
> =>
  Effect.gen(function* () {
    const tool = getTool(WEATHER_TOOL_ID);
    if (!tool || !isToolEnabledInContext(tool, executionContext)) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'Weather tool is disabled for this execution context',
        }),
      );
    }

    if (!user) {
      return yield* Effect.fail(
        new UnauthorizedError({ message: 'Authentication required' }),
      );
    }

    if (tool.authMode === 'protected') {
      const isAllowedRole = tool.rolePolicy.includes(user.role);
      if (!isAllowedRole) {
        return yield* Effect.fail(
          new ForbiddenError({ message: 'Weather tool role policy denied' }),
        );
      }
    }

    const decodedInput = yield* decodeWeatherInput(input);

    const providerResult = yield* fetchOpenMeteoCurrentWeather({
      latitude: decodedInput.latitude,
      longitude: decodedInput.longitude,
    }).pipe(
      Effect.withSpan('tool.weather.providerCall', {
        attributes: {
          'tool.id': tool.id,
          'tool.version': tool.contractVersion,
          'tool.provider': 'open-meteo',
        },
      }),
    );

    return normalizeWeatherOutput(decodedInput.locationLabel, providerResult);
  }).pipe(
    Effect.withSpan('tool.weather.invoke', {
      attributes: {
        'tool.id': WEATHER_TOOL_ID,
        'tool.version': '1.0.0',
      },
    }),
  );
