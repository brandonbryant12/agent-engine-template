import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..', '..', '..', '..', '..');

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.turbo',
  '.cache',
  'coverage',
]);

const ALLOWED_INSTANCEOF_CLASSES = new Set(['URL', 'Buffer', 'AbortSignal']);

const collectTestFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
      continue;
    }
    if (
      entry.name.endsWith('.test.ts') ||
      entry.name.endsWith('.test.tsx') ||
      entry.name.endsWith('.integration.test.ts') ||
      entry.name.endsWith('.integration.test.tsx')
    ) {
      files.push(fullPath);
    }
  }

  return files;
};

const classNameFromMatcherArg = (raw: string): string => {
  const trimmed = raw.trim();
  const lastDot = trimmed.lastIndexOf('.');
  return lastDot >= 0 ? trimmed.slice(lastDot + 1) : trimmed;
};

describe('error assertion invariants', () => {
  it('forbids toBeInstanceOf for tagged/backend errors outside allowlisted built-ins', () => {
    const roots = [
      path.join(repoRoot, 'packages'),
      path.join(repoRoot, 'apps'),
    ];
    const testFiles = roots.flatMap(collectTestFiles);
    const offenders: string[] = [];
    const matcher = /toBeInstanceOf\(\s*([A-Za-z0-9_$.]+)\s*\)/g;

    for (const file of testFiles) {
      const relativePath = path
        .relative(repoRoot, file)
        .split(path.sep)
        .join('/');
      if (relativePath.startsWith('apps/web/')) continue;
      if (relativePath.startsWith('packages/testing/')) continue;

      const source = fs.readFileSync(file, 'utf-8');
      let match: RegExpExecArray | null = null;

      while ((match = matcher.exec(source)) !== null) {
        const matcherArg = match[1];
        if (!matcherArg) continue;
        const className = classNameFromMatcherArg(matcherArg);
        if (ALLOWED_INSTANCEOF_CLASSES.has(className)) continue;

        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(`${relativePath}:${line} -> ${className}`);
      }
    }

    expect(
      offenders,
      'Use _tag + field assertions for tagged/backend errors. ' +
        'Allowlisted toBeInstanceOf classes: URL, Buffer, AbortSignal.',
    ).toEqual([]);
  });
});
