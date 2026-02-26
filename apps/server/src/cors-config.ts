const normalizeOrigin = (url: string): string => {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
};

export const buildCredentialedCorsOriginConfig = (input: {
  publicWebUrl: string;
  corsOrigins?: string;
}): string[] => {
  if (input.corsOrigins?.trim() === '*') {
    throw new Error(
      'CORS_ORIGINS=* is not allowed for credentialed CORS. Set explicit origins instead.',
    );
  }

  const origins = [input.publicWebUrl];
  if (input.corsOrigins) {
    origins.push(...input.corsOrigins.split(',').map((s) => s.trim()));
  }

  return [...new Set(origins.filter((origin) => origin.length > 0))].map(
    normalizeOrigin,
  );
};
