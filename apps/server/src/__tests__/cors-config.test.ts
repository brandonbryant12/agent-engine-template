import { describe, expect, it } from 'vitest';
import { buildCredentialedCorsOriginConfig } from '../cors-config';

describe('buildCredentialedCorsOriginConfig', () => {
  it('rejects wildcard CORS_ORIGINS when credentials are enabled', () => {
    expect(() =>
      buildCredentialedCorsOriginConfig({
        publicWebUrl: 'http://localhost:8085',
        corsOrigins: '*',
      }),
    ).toThrow('CORS_ORIGINS=* is not allowed for credentialed CORS');
  });

  it('includes PUBLIC_WEB_URL and normalizes extra origins', () => {
    expect(
      buildCredentialedCorsOriginConfig({
        publicWebUrl: 'http://localhost:8085/path',
        corsOrigins: 'https://app.example.com/home, http://localhost:4173',
      }),
    ).toEqual([
      'http://localhost:8085',
      'https://app.example.com',
      'http://localhost:4173',
    ]);
  });

  it('deduplicates and trims values', () => {
    expect(
      buildCredentialedCorsOriginConfig({
        publicWebUrl: 'http://localhost:8085',
        corsOrigins:
          ' http://localhost:8085 , http://localhost:8085 , http://localhost:4173 ',
      }),
    ).toEqual(['http://localhost:8085', 'http://localhost:4173']);
  });
});
