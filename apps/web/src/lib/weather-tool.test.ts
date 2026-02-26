import { describe, expect, it } from 'vitest';
import {
  parseWeatherToolInput,
  toWeatherAnnouncement,
  toWeatherToolRemediation,
  toWeatherToolStatusMessage,
} from './weather-tool';

describe('weather tool helpers', () => {
  it('maps failure tags to stable remediation copy', () => {
    expect(toWeatherToolRemediation('ToolValidationError')).toBe(
      'Check latitude/longitude values and try again.',
    );
    expect(toWeatherToolRemediation('UnknownTag')).toBe(
      'Try again or contact support.',
    );
  });

  it('returns deterministic lifecycle status messages', () => {
    expect(toWeatherToolStatusMessage('idle')).toBe(
      'Ready to invoke weather tool.',
    );
    expect(toWeatherToolStatusMessage('retrying')).toBe('Retrying weather tool.');
  });

  it('builds live-region announcement for failure states', () => {
    expect(
      toWeatherAnnouncement({
        status: 'failed',
        message: 'Weather tool failed.',
        errorTag: 'ToolTimeoutError',
      }),
    ).toBe('Weather tool failed. Provider timed out. Retry shortly.');
  });

  it('parses numeric weather input fields', () => {
    expect(
      parseWeatherToolInput({
        latitude: '30.2672',
        longitude: '-97.7431',
        locationLabel: 'Austin, TX',
      }),
    ).toEqual({ latitude: 30.2672, longitude: -97.7431, locationLabel: 'Austin, TX' });
  });
});
