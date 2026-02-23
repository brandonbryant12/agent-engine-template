import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..', '..', '..', '..');

const packageJsonPath = path.join(repoRoot, 'package.json');
const docsPath = path.join(repoRoot, 'docs/testing/invariants.md');

const extractInvariantFiles = (script: string): string[] => {
  const tokens = script.split(/\s+/).filter(Boolean);
  const fileTokens = tokens.filter(
    (token) =>
      token.endsWith('.test.ts') ||
      token.endsWith('.test.tsx') ||
      token.endsWith('.integration.test.ts') ||
      token.endsWith('.integration.test.tsx'),
  );

  return fileTokens;
};

describe('invariant docs sync', () => {
  it('lists every test file referenced by pnpm test:invariants', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const script = packageJson?.scripts?.['test:invariants'];

    expect(script, 'Missing test:invariants script in package.json').toBeTypeOf(
      'string',
    );

    const invariantFiles = extractInvariantFiles(script);
    expect(invariantFiles.length).toBeGreaterThan(0);

    const docs = fs.readFileSync(docsPath, 'utf-8');
    const missing = invariantFiles.filter((file) => !docs.includes(file));

    expect(
      missing,
      'Invariant docs must list every test:invariants file path.',
    ).toEqual([]);
  });
});
