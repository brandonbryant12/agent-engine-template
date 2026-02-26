import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { invokeWeatherTool } from '../weather/adapter';

const fetchWeatherMock = vi.hoisted(() => vi.fn());

vi.mock('../weather/provider', () => ({
  fetchOpenMeteoCurrentWeather: (...args: unknown[]) =>
    fetchWeatherMock(...args),
}));

const TEST_USER = {
  id: 'user_test',
  role: 'user' as const,
} as const;

afterEach(() => {
  fetchWeatherMock.mockReset();
});

describe('invokeWeatherTool', () => {
  it('fails as UNAUTHORIZED before outbound provider call when user is missing', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        invokeWeatherTool({
          input: { latitude: 1, longitude: 2, locationLabel: 'Austin, TX' },
          executionContext: 'interactive-chat',
          user: null,
        }),
      ),
    );

    expect((error as { _tag?: string })._tag).toBe('UnauthorizedError');
    expect(fetchWeatherMock).not.toHaveBeenCalled();
  });

  it('fails preflight before outbound provider call when execution context is disabled', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        invokeWeatherTool({
          input: { latitude: 1, longitude: 2, locationLabel: 'Austin, TX' },
          executionContext: 'background-run',
          user: TEST_USER,
        }),
      ),
    );

    expect((error as { _tag?: string })._tag).toBe('ForbiddenError');
    expect(fetchWeatherMock).not.toHaveBeenCalled();
  });

  it('fails validation before outbound provider call for invalid input', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        invokeWeatherTool({
          input: { latitude: 999, longitude: 2, locationLabel: 'Austin, TX' },
          executionContext: 'interactive-chat',
          user: TEST_USER,
        }),
      ),
    );

    expect((error as { _tag?: string })._tag).toBe('ToolValidationError');
    expect(fetchWeatherMock).not.toHaveBeenCalled();
  });

  it('normalizes successful provider output with explicit units', async () => {
    fetchWeatherMock.mockReturnValue(
      Effect.succeed({
        observedAtIso: '2026-02-26T00:00:00Z',
        weatherSummary: 'Clear sky',
        temperatureC: 23.4,
        windSpeedKmh: 6.5,
        windDirectionDegrees: 131,
      }),
    );

    const output = await Effect.runPromise(
      invokeWeatherTool({
        input: { latitude: 30.2672, longitude: -97.7431, locationLabel: 'Austin, TX' },
        executionContext: 'interactive-chat',
        user: TEST_USER,
      }),
    );

    expect(output).toEqual({
      locationLabel: 'Austin, TX',
      observedAtIso: '2026-02-26T00:00:00Z',
      weatherSummary: 'Clear sky',
      temperature: { value: 23.4, unit: 'Celsius' },
      windSpeed: { value: 6.5, unit: 'km/h' },
      windDirection: { value: 131, unit: 'degrees' },
      source: 'open-meteo',
    });
  });
});
