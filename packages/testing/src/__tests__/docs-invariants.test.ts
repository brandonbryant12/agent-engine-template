import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..', '..', '..', '..');

const packageJsonPath = path.join(repoRoot, 'package.json');
const docsPath = path.join(repoRoot, 'docs/testing/invariants.md');
const agentsInstructionsPath = path.join(repoRoot, 'AGENTS.md');
const claudeInstructionsPath = path.join(repoRoot, 'CLAUDE.md');

const REQUIRED_SAFETY_COMMANDS = [
  'pnpm scripts:lint',
  'agent-engine/scripts/sync-skills.sh',
  'pnpm skills:check:strict',
] as const;

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

  it('keeps AGENTS and CLAUDE safety-command contracts aligned', () => {
    const agents = fs.readFileSync(agentsInstructionsPath, 'utf-8');
    const claude = fs.readFileSync(claudeInstructionsPath, 'utf-8');

    const missingInAgents = REQUIRED_SAFETY_COMMANDS.filter(
      (command) => !agents.includes(command),
    );
    const missingInClaude = REQUIRED_SAFETY_COMMANDS.filter(
      (command) => !claude.includes(command),
    );

    expect(
      missingInAgents,
      'AGENTS.md must include all required safety commands.',
    ).toEqual([]);
    expect(
      missingInClaude,
      'CLAUDE.md must include all required safety commands.',
    ).toEqual([]);
  });
});
