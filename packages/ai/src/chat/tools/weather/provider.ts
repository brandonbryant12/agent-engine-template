import { Schema, Effect } from 'effect';
import {
  ToolProviderError,
  ToolRateLimitError,
  ToolSchemaDriftError,
  ToolTimeoutError,
} from '../errors';

const OPEN_METEO_HOST = 'api.open-meteo.com';
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_TIMEOUT_MS = 4000;

const OpenMeteoResponseSchema = Schema.Struct({
  current: Schema.Struct({
    time: Schema.String,
    temperature_2m: Schema.Number,
    weather_code: Schema.Number,
    wind_speed_10m: Schema.Number,
    wind_direction_10m: Schema.Number,
  }),
});

type OpenMeteoResponse = Schema.Schema.Type<typeof OpenMeteoResponseSchema>;

const WEATHER_CODE_TO_SUMMARY: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Light rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  95: 'Thunderstorm',
};

const summarizeWeather = (code: number): string =>
  WEATHER_CODE_TO_SUMMARY[code] ?? 'Unknown weather conditions';

const decodeOpenMeteoResponse = (
  payload: unknown,
): Effect.Effect<OpenMeteoResponse, ToolSchemaDriftError> =>
  Effect.try({
    try: () => Schema.decodeUnknownSync(OpenMeteoResponseSchema)(payload),
    catch: () =>
      new ToolSchemaDriftError({
        message: 'Provider payload failed strict weather schema decoding',
      }),
  });

const withTimeout = (input: RequestInit): [RequestInit, () => void] => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, WEATHER_TIMEOUT_MS);

  return [{ ...input, signal: controller.signal }, () => clearTimeout(timeout)];
};

export interface OpenMeteoCurrentWeather {
  readonly observedAtIso: string;
  readonly weatherSummary: string;
  readonly temperatureC: number;
  readonly windSpeedKmh: number;
  readonly windDirectionDegrees: number;
}

export const fetchOpenMeteoCurrentWeather = ({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}): Effect.Effect<
  OpenMeteoCurrentWeather,
  ToolProviderError | ToolRateLimitError | ToolTimeoutError | ToolSchemaDriftError
> =>
  Effect.gen(function* () {
    const query = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      current:
        'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m',
      timezone: 'auto',
    });

    const url = `${OPEN_METEO_URL}?${query.toString()}`;

    const [requestInit, clearTimeoutHandle] = withTimeout({
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const response = yield* Effect.tryPromise({
      try: () => fetch(url, requestInit),
      catch: (error) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return new ToolTimeoutError({
            message: 'Open-Meteo request timed out',
            timeoutMs: WEATHER_TIMEOUT_MS,
          });
        }

        return new ToolProviderError({
          message: 'Open-Meteo request failed before receiving a response',
          provider: 'open-meteo',
        });
      },
    }).pipe(Effect.ensuring(Effect.sync(clearTimeoutHandle)));

    if (response.status === 429) {
      return yield* Effect.fail(
        new ToolRateLimitError({ message: 'Open-Meteo rate limit exceeded' }),
      );
    }

    if (!response.ok) {
      return yield* Effect.fail(
        new ToolProviderError({
          message: `Open-Meteo responded with ${response.status}`,
          provider: 'open-meteo',
        }),
      );
    }

    const hostname = new URL(response.url).hostname;
    if (hostname !== OPEN_METEO_HOST) {
      return yield* Effect.fail(
        new ToolProviderError({
          message: `Unexpected provider host ${hostname}`,
          provider: 'open-meteo',
        }),
      );
    }

    const payload = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () =>
        new ToolSchemaDriftError({
          message: 'Open-Meteo response was not valid JSON',
        }),
    });

    const decoded = yield* decodeOpenMeteoResponse(payload);

    return {
      observedAtIso: decoded.current.time,
      weatherSummary: summarizeWeather(decoded.current.weather_code),
      temperatureC: decoded.current.temperature_2m,
      windSpeedKmh: decoded.current.wind_speed_10m,
      windDirectionDegrees: decoded.current.wind_direction_10m,
    };
  });
