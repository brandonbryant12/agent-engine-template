import { Button } from '@repo/ui/components/button';
import { useCallback, useEffect, useRef, useState } from 'react';
import { rawApiClient } from '@/clients/api-client';
import {
  WEATHER_TOOL_INITIAL_STATE,
  parseWeatherToolInput,
  toWeatherAnnouncement,
  toWeatherToolRemediation,
  toWeatherToolStatusMessage,
  type WeatherToolInput,
  type WeatherToolState,
} from '@/lib/weather-tool';

type WeatherToolResult = Awaited<
  ReturnType<typeof rawApiClient.chat.weatherCurrent>
>;

const extractWeatherErrorTag = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const errorCode =
    'code' in error && typeof error.code === 'string' ? error.code : null;
  const errorData =
    'data' in error && typeof error.data === 'object' && error.data
      ? (error.data as Record<string, unknown>)
      : null;
  const taggedData =
    errorData &&
    'errorTag' in errorData &&
    typeof errorData.errorTag === 'string'
      ? errorData.errorTag
      : null;

  if (taggedData) {
    return taggedData;
  }

  if (errorCode === 'UNAUTHORIZED') return 'UnauthorizedError';
  if (errorCode === 'FORBIDDEN') return 'ForbiddenError';
  return null;
};

export function WeatherToolPanel() {
  const [weatherInput, setWeatherInput] = useState<WeatherToolInput>({
    latitude: '30.2672',
    longitude: '-97.7431',
    locationLabel: 'Austin, TX',
  });
  const [weatherToolState, setWeatherToolState] = useState<WeatherToolState>(
    WEATHER_TOOL_INITIAL_STATE,
  );
  const [weatherToolResult, setWeatherToolResult] =
    useState<WeatherToolResult | null>(null);
  const weatherAbortRef = useRef<AbortController | null>(null);
  const invokeButtonRef = useRef<HTMLButtonElement | null>(null);

  const onInvokeWeatherTool = useCallback(async () => {
    if (
      weatherToolState.status === 'running' ||
      weatherToolState.status === 'validating' ||
      weatherToolState.status === 'retrying'
    ) {
      return;
    }

    const input = parseWeatherToolInput(weatherInput);
    setWeatherToolState({
      status: 'validating',
      message: toWeatherToolStatusMessage('validating'),
      errorTag: null,
    });

    const controller = new AbortController();
    weatherAbortRef.current = controller;

    setWeatherToolState({
      status: 'running',
      message: toWeatherToolStatusMessage('running'),
      errorTag: null,
    });

    try {
      const result = await rawApiClient.chat.weatherCurrent(input, {
        signal: controller.signal,
      });
      setWeatherToolResult(result);
      setWeatherToolState({
        status: 'succeeded',
        message: toWeatherToolStatusMessage('succeeded'),
        errorTag: null,
      });
    } catch (toolError) {
      const isAbortError =
        toolError instanceof Error && toolError.name === 'AbortError';
      const errorTag = isAbortError
        ? 'ToolTimeoutError'
        : extractWeatherErrorTag(toolError);
      const status =
        isAbortError || errorTag === 'ToolTimeoutError'
          ? 'timed_out'
          : 'failed';
      setWeatherToolState({
        status,
        message: toWeatherToolStatusMessage(status),
        errorTag,
      });
    } finally {
      weatherAbortRef.current = null;
      invokeButtonRef.current?.focus();
    }
  }, [weatherInput, weatherToolState.status]);

  const onCancelWeatherTool = useCallback(() => {
    if (!weatherAbortRef.current) {
      return;
    }

    weatherAbortRef.current.abort();
    weatherAbortRef.current = null;
    setWeatherToolState({
      status: 'cancelled',
      message: toWeatherToolStatusMessage('cancelled'),
      errorTag: null,
    });
    invokeButtonRef.current?.focus();
  }, []);

  const onRetryWeatherTool = useCallback(async () => {
    setWeatherToolState({
      status: 'retrying',
      message: toWeatherToolStatusMessage('retrying'),
      errorTag: null,
    });
    await onInvokeWeatherTool();
  }, [onInvokeWeatherTool]);

  useEffect(
    () => () => {
      weatherAbortRef.current?.abort();
    },
    [],
  );

  return (
    <section
      className="mb-3 rounded-xl border border-border/70 bg-background/70 p-3"
      aria-label="Weather tool demo"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Weather Tool (Demo)</p>
        <p className="text-xs text-muted-foreground">
          State: {weatherToolState.status}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
        <input
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          aria-label="Weather location label"
          value={weatherInput.locationLabel}
          onChange={(event) =>
            setWeatherInput((prev) => ({
              ...prev,
              locationLabel: event.target.value,
            }))
          }
        />
        <input
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          aria-label="Weather latitude"
          value={weatherInput.latitude}
          onChange={(event) =>
            setWeatherInput((prev) => ({
              ...prev,
              latitude: event.target.value,
            }))
          }
        />
        <input
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          aria-label="Weather longitude"
          value={weatherInput.longitude}
          onChange={(event) =>
            setWeatherInput((prev) => ({
              ...prev,
              longitude: event.target.value,
            }))
          }
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          ref={invokeButtonRef}
          size="sm"
          variant="outline"
          onClick={() => void onInvokeWeatherTool()}
          disabled={
            weatherToolState.status === 'running' ||
            weatherToolState.status === 'validating' ||
            weatherToolState.status === 'retrying'
          }
        >
          Invoke
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancelWeatherTool}
          disabled={weatherAbortRef.current === null}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void onRetryWeatherTool()}
          disabled={
            weatherToolState.status !== 'failed' &&
            weatherToolState.status !== 'timed_out' &&
            weatherToolState.status !== 'cancelled'
          }
        >
          Retry
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {toWeatherAnnouncement(weatherToolState)}
      </p>
      {(weatherToolState.status === 'failed' ||
        weatherToolState.status === 'timed_out') && (
        <p className="mt-1 text-xs text-destructive">
          {toWeatherToolRemediation(weatherToolState.errorTag)}
        </p>
      )}

      {weatherToolResult ? (
        <div className="mt-2 rounded-md border border-border/70 p-2 text-xs">
          <p>
            <strong>{weatherToolResult.locationLabel}</strong>:{' '}
            {weatherToolResult.weatherSummary}
          </p>
          <p>
            Temperature: {weatherToolResult.temperature.value}{' '}
            {weatherToolResult.temperature.unit}
          </p>
          <p>
            Wind speed: {weatherToolResult.windSpeed.value}{' '}
            {weatherToolResult.windSpeed.unit}
          </p>
          <p>
            Wind direction: {weatherToolResult.windDirection.value}{' '}
            {weatherToolResult.windDirection.unit}
          </p>
        </div>
      ) : null}
    </section>
  );
}
