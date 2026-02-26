import { ForbiddenError, UnauthorizedError, ValidationError } from '@repo/db/errors';
import { Effect, Schedule, Schema } from 'effect';
import {
  WeatherToolProviderError,
  WeatherToolRateLimitError,
  WeatherToolSchemaDriftError,
  WeatherToolTimeoutError,
} from '../errors';

export const WEATHER_TOOL_ID = 'weather.current' as const;
export const WEATHER_TOOL_CONTRACT_VERSION = '1.0.0' as const;
export const WEATHER_PROVIDER_HOST = 'api.open-meteo.com' as const;
const WEATHER_TIMEOUT_MS = 4_000;
const WEATHER_MAX_CONCURRENT_REQUESTS = 4;

let activeWeatherRequests = 0;

export const WeatherInputSchema = Schema.Struct({
  latitude: Schema.Number.pipe(Schema.greaterThanOrEqualTo(-90), Schema.lessThanOrEqualTo(90)),
  longitude: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(-180),
    Schema.lessThanOrEqualTo(180),
  ),
  units: Schema.optional(Schema.Literal('metric', 'imperial')),
});

export type WeatherInput = Schema.Schema.Type<typeof WeatherInputSchema>;

const CurrentWeatherSchema = Schema.Struct({
  temperature_2m: Schema.Number,
  apparent_temperature: Schema.Number,
  wind_speed_10m: Schema.Number,
  weather_code: Schema.Number,
  time: Schema.String.pipe(Schema.trimmed(), Schema.minLength(1)),
});

const WeatherProviderPayloadSchema = Schema.Struct({
  latitude: Schema.Number,
  longitude: Schema.Number,
  current: CurrentWeatherSchema,
});

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: 'clear',
  1: 'mainly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'depositing rime fog',
  51: 'light drizzle',
  53: 'moderate drizzle',
  55: 'dense drizzle',
  61: 'slight rain',
  63: 'moderate rain',
  65: 'heavy rain',
  71: 'slight snow',
  73: 'moderate snow',
  75: 'heavy snow',
  80: 'slight rain showers',
  81: 'moderate rain showers',
  82: 'violent rain showers',
  95: 'thunderstorm',
};

export interface WeatherToolResult {
  readonly summary: string;
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly condition: string;
  readonly temperature: {
    readonly value: number;
    readonly unit: 'C' | 'F';
  };
  readonly apparentTemperature: {
    readonly value: number;
    readonly unit: 'C' | 'F';
  };
  readonly windSpeed: {
    readonly value: number;
    readonly unit: 'km/h' | 'mph';
  };
  readonly observedAtIso: string;
}

const decodeWeatherInput = Schema.decodeUnknown(WeatherInputSchema);
const decodeProviderPayload = Schema.decodeUnknown(WeatherProviderPayloadSchema);

const toWeatherProviderUrl = (input: Required<WeatherInput>): URL => {
  const url = new URL(`https://${WEATHER_PROVIDER_HOST}/v1/forecast`);

  url.searchParams.set('latitude', String(input.latitude));
  url.searchParams.set('longitude', String(input.longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,wind_speed_10m,weather_code',
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('temperature_unit', input.units === 'imperial' ? 'fahrenheit' : 'celsius');
  url.searchParams.set('wind_speed_unit', input.units === 'imperial' ? 'mph' : 'kmh');

  return url;
};

const normalizeInput = (input: WeatherInput): Required<WeatherInput> => ({
  latitude: input.latitude,
  longitude: input.longitude,
  units: input.units ?? 'metric',
});

const withTimeout = async (
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: abortController.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const mapCodeToCondition = (code: number): string =>
  WEATHER_CODE_LABELS[Math.trunc(code)] ?? 'unknown';

const toResult = (
  payload: Schema.Schema.Type<typeof WeatherProviderPayloadSchema>,
  units: Required<WeatherInput>['units'],
): WeatherToolResult => {
  const temperatureUnit = units === 'imperial' ? 'F' : 'C';
  const windUnit = units === 'imperial' ? 'mph' : 'km/h';
  const condition = mapCodeToCondition(payload.current.weather_code);

  return {
    summary: `Current weather is ${condition} with temperature ${payload.current.temperature_2m} ${temperatureUnit}.`,
    location: {
      latitude: payload.latitude,
      longitude: payload.longitude,
    },
    condition,
    temperature: {
      value: payload.current.temperature_2m,
      unit: temperatureUnit,
    },
    apparentTemperature: {
      value: payload.current.apparent_temperature,
      unit: temperatureUnit,
    },
    windSpeed: {
      value: payload.current.wind_speed_10m,
      unit: windUnit,
    },
    observedAtIso: payload.current.time,
  };
};

const ensureAuthorized = (actorRole?: string | null) =>
  Effect.gen(function* () {
    if (!actorRole) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: 'Authentication required',
        }),
      );
    }

    if (actorRole !== 'user' && actorRole !== 'admin') {
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'Requires user or admin role',
        }),
      );
    }
  });

const normalizeResponsePayload = (payload: unknown) =>
  decodeProviderPayload(payload).pipe(
    Effect.mapError(
      () =>
        new WeatherToolSchemaDriftError({
          message: 'Unexpected weather provider payload shape',
        }),
    ),
  );

const invokeProvider = (input: Required<WeatherInput>) =>
  Effect.tryPromise({
    try: async () => {
      if (activeWeatherRequests >= WEATHER_MAX_CONCURRENT_REQUESTS) {
        throw new WeatherToolRateLimitError({
          message: 'Weather tool concurrency cap reached',
        });
      }

      activeWeatherRequests += 1;
      try {
        const url = toWeatherProviderUrl(input);
        if (url.hostname !== WEATHER_PROVIDER_HOST) {
          throw new WeatherToolProviderError({
            message: 'Weather provider host is not allowlisted',
          });
        }

        const response = await withTimeout(url, { method: 'GET' }, WEATHER_TIMEOUT_MS);

        if (response.status === 429) {
          throw new WeatherToolRateLimitError({
            message: 'Weather provider returned 429',
          });
        }
        if (!response.ok) {
          throw new WeatherToolProviderError({
            message: `Weather provider returned HTTP ${response.status}`,
          });
        }

        const payload = (await response.json()) as unknown;
        return payload;
      } finally {
        activeWeatherRequests = Math.max(0, activeWeatherRequests - 1);
      }
    },
    catch: (error) => {
      if (error instanceof WeatherToolRateLimitError) {
        return error;
      }
      if (error instanceof WeatherToolProviderError) {
        return error;
      }
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        return new WeatherToolTimeoutError({
          message: 'Weather provider request timed out',
        });
      }
      if (error instanceof Error && error.name === 'AbortError') {
        return new WeatherToolTimeoutError({
          message: 'Weather provider request timed out',
        });
      }

      return new WeatherToolProviderError({
        message: 'Weather provider request failed',
      });
    },
  }).pipe(
    Effect.retry({
      schedule: Schedule.intersect(
        Schedule.exponential('150 millis'),
        Schedule.recurs(1),
      ),
      while: (error) =>
        error._tag === 'WeatherToolTimeoutError' ||
        error._tag === 'WeatherToolProviderError',
    }),
  );

export const invokeWeatherTool = (
  rawInput: unknown,
  options?: { readonly actorRole?: string | null },
) =>
  Effect.gen(function* () {
    const validatedInput = yield* decodeWeatherInput(rawInput).pipe(
      Effect.mapError(
        () =>
          new ValidationError({
            field: 'weatherTool.input',
            message: 'Invalid latitude/longitude/units input',
          }),
      ),
    );
    const normalizedInput = normalizeInput(validatedInput);

    yield* ensureAuthorized(options?.actorRole);
    const payload = yield* invokeProvider(normalizedInput);
    const normalizedPayload = yield* normalizeResponsePayload(payload);

    return toResult(normalizedPayload, normalizedInput.units);
  }).pipe(
    Effect.withSpan('tool.weather.invoke', {
      attributes: {
        'tool.id': WEATHER_TOOL_ID,
        'tool.version': WEATHER_TOOL_CONTRACT_VERSION,
        'tool.provider.host': WEATHER_PROVIDER_HOST,
      },
    }),
  );
