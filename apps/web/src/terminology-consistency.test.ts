import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routeSurfaceFiles = [
  'components/app-shell.tsx',
  'pages/dashboard.tsx',
  'pages/chat.tsx',
  'pages/jobs.tsx',
] as const;

const forbiddenTerms = ['Jobs', 'Job Queue', 'Background Run'] as const;

const quotedStringPattern = /(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g;

function extractQuotedStrings(source: string): string[] {
  const matches = source.match(quotedStringPattern) ?? [];
  return matches.map((quoted) => quoted.slice(1, -1));
}

describe('async work terminology consistency', () => {
  it('avoids mixed legacy terms in targeted route surfaces', () => {
    for (const relativeFile of routeSurfaceFiles) {
      const fullPath = path.resolve(__dirname, relativeFile);
      const source = readFileSync(fullPath, 'utf8');
      const quotedStrings = extractQuotedStrings(source);

      for (const forbiddenTerm of forbiddenTerms) {
        const offenders = quotedStrings.filter((value) =>
          value.includes(forbiddenTerm),
        );
        expect(
          offenders,
          `${relativeFile} contains legacy term "${forbiddenTerm}" in UI copy`,
        ).toHaveLength(0);
      }
    }
  });
});
