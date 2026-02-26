import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readToolFailureRemediation,
} from '../../errors';
import { invokeWeatherTool } from '../weather';

const weatherPayload = {
  latitude: 40.7128,
  longitude: -74.006,
  current: {
    temperature_2m: 12.3,
    apparent_temperature: 10.2,
    wind_speed_10m: 15.8,
    weather_code: 3,
    time: '2026-02-26T08:00',
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('invokeWeatherTool', () => {
  it('short-circuits with UnauthorizedError before outbound egress', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(weatherPayload))),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await Effect.runPromise(
      Effect.flip(
        invokeWeatherTool({
          latitude: 40.7128,
          longitude: -74.006,
        }),
      ),
    ) as { _tag: string };

    expect(error._tag).toBe('UnauthorizedError');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('short-circuits with ForbiddenError before outbound egress', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(weatherPayload))),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await Effect.runPromise(
      Effect.flip(
        invokeWeatherTool(
          {
            latitude: 40.7128,
            longitude: -74.006,
          },
          { actorRole: 'viewer' },
        ),
      ),
    ) as { _tag: string };

    expect(error._tag).toBe('ForbiddenError');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('short-circuits validation failures before outbound egress', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(weatherPayload))),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await Effect.runPromise(
      Effect.flip(
        invokeWeatherTool(
          {
            latitude: 200,
            longitude: -74.006,
          },
          { actorRole: 'user' },
        ),
      ),
    ) as { _tag: string };

    expect(error._tag).toBe('ValidationError');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when provider payload drifts from expected schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              latitude: 40.7128,
              longitude: -74.006,
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    const error = await Effect.runPromise(
      Effect.flip(
        invokeWeatherTool(
          {
            latitude: 40.7128,
            longitude: -74.006,
          },
          { actorRole: 'user' },
        ),
      ),
    ) as { _tag: string };

    expect(error._tag).toBe('WeatherToolSchemaDriftError');
  });

  it('returns normalized weather result with explicit units', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(weatherPayload), { status: 200 }))),
    );

    const result = (await Effect.runPromise(
      invokeWeatherTool(
        {
          latitude: 40.7128,
          longitude: -74.006,
          units: 'imperial',
        },
        { actorRole: 'user' },
      ),
    )) as {
      condition: string;
      temperature: { unit: string };
      windSpeed: { unit: string };
      summary: string;
    };

    expect(result.condition).toBe('overcast');
    expect(result.temperature.unit).toBe('F');
    expect(result.windSpeed.unit).toBe('mph');
    expect(result.summary).toContain('temperature');
  });
});

describe('readToolFailureRemediation', () => {
  it('maps each tool failure tag to deterministic user remediation copy', () => {
    expect(readToolFailureRemediation('validation')).toEqual({
      title: 'Invalid weather request input',
      action: 'Edit the location values and try again.',
    });
    expect(readToolFailureRemediation('schemaDrift')).toEqual({
      title: 'Weather response format changed',
      action: 'Disable the provider until schema compatibility is restored.',
    });
  });
});
