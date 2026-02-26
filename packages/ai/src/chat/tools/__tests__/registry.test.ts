import { describe, expect, it } from 'vitest';
import {
  WEATHER_TOOL_DEFINITION,
  getTool,
  isToolEnabledInContext,
  listTools,
} from '../registry';

describe('tool registry', () => {
  it('exposes required governance metadata for weather tool', () => {
    expect(WEATHER_TOOL_DEFINITION).toMatchObject({
      id: 'weather.current',
      contractVersion: '1.0.0',
      authMode: 'protected',
      rolePolicy: ['user', 'admin'],
      dataClassification: 'internal',
      ownershipDomain: 'domain:api',
      egressPolicy: {
        allowedHosts: ['api.open-meteo.com'],
      },
    });
  });

  it('keeps immutable contract version and supports lookup', () => {
    const tool = getTool('weather.current');
    expect(tool?.contractVersion).toBe('1.0.0');
    expect(listTools().map((candidate) => candidate.id)).toEqual([
      'weather.current',
    ]);
  });

  it('supports runtime enable/disable checks by execution context', () => {
    expect(
      isToolEnabledInContext(WEATHER_TOOL_DEFINITION, 'interactive-chat'),
    ).toBe(true);
    expect(
      isToolEnabledInContext(WEATHER_TOOL_DEFINITION, 'background-run'),
    ).toBe(false);
  });
});
