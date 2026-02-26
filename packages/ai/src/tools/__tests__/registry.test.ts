import { describe, expect, it } from 'vitest';
import { listToolMetadata, resolveEnabledToolsForChannel } from '../registry';

describe('tool registry', () => {
  it('enforces required metadata contract fields', () => {
    const metadata = listToolMetadata();

    expect(metadata).toHaveLength(1);
    expect(metadata[0]).toEqual(
      expect.objectContaining({
        id: 'weather.current',
        contractVersion: '1.0.0',
        authMode: 'protected',
        rolePolicy: 'user-or-admin',
        egressPolicy: {
          allowlistedHosts: ['api.open-meteo.com'],
        },
        dataClassification: 'sensitive',
      }),
    );
  });

  it('enables tools only for configured execution channel', () => {
    expect(Object.keys(resolveEnabledToolsForChannel('chat.general'))).toEqual([
      'weather.current',
    ]);
    expect(Object.keys(resolveEnabledToolsForChannel('chat.other'))).toEqual([]);
  });
});
