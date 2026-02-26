import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type RunSyncViolation = {
  filePath: string;
  line: number;
  column: number;
  snippet: string;
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..', '..', '..', '..');
const sourceRoots = [path.join(repoRoot, 'apps'), path.join(repoRoot, 'packages')];

const SKIPPED_DIR_NAMES = new Set([
  '.git',
  '.turbo',
  '.codex-worktrees',
  'coverage',
  'dist',
  'build',
  'node_modules',
]);

const RUNSYNC_ALLOWLIST = new Set([
  'packages/api/src/server/index.ts',
]);

const toPosixPath = (value: string): string => value.split(path.sep).join('/');

const toRelativePath = (filePath: string): string =>
  toPosixPath(path.relative(repoRoot, filePath));

const isRuntimeSourceFile = (filePath: string): boolean => {
  const normalized = toPosixPath(filePath);

  if (!/\.(ts|tsx)$/.test(normalized)) return false;
  if (normalized.includes('/__tests__/')) return false;
  if (normalized.includes('/testing/')) return false;
  if (normalized.includes('/test-utils/')) return false;
  if (/\.test\.[jt]sx?$/.test(normalized)) return false;
  if (/\.spec\.[jt]sx?$/.test(normalized)) return false;

  return true;
};

const collectRuntimeSourceFiles = (dirPath: string): string[] => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const nextPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (SKIPPED_DIR_NAMES.has(entry.name)) continue;
      files.push(...collectRuntimeSourceFiles(nextPath));
      continue;
    }

    if (entry.isFile() && isRuntimeSourceFile(nextPath)) {
      files.push(nextPath);
    }
  }

  return files;
};

const createViolation = (
  sourceFile: ts.SourceFile,
  filePath: string,
  node: ts.CallExpression,
): RunSyncViolation => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );

  return {
    filePath: toRelativePath(filePath),
    line: line + 1,
    column: character + 1,
    snippet: node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 160),
  };
};

const collectRunSyncViolations = (filePath: string): RunSyncViolation[] => {
  const relativePath = toRelativePath(filePath);
  if (RUNSYNC_ALLOWLIST.has(relativePath)) {
    return [];
  }

  const sourceText = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const violations: RunSyncViolation[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Effect' &&
      node.expression.name.text === 'runSync'
    ) {
      violations.push(createViolation(sourceFile, filePath, node));
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
};

const collectRepositoryViolations = (): RunSyncViolation[] =>
  sourceRoots
    .flatMap((root) => collectRuntimeSourceFiles(root))
    .flatMap((filePath) => collectRunSyncViolations(filePath))
    .sort((left, right) => {
      const byPath = left.filePath.localeCompare(right.filePath);
      if (byPath !== 0) return byPath;
      if (left.line !== right.line) return left.line - right.line;
      return left.column - right.column;
    });

const formatViolations = (violations: readonly RunSyncViolation[]): string =>
  violations
    .map(
      (violation) =>
        `${violation.filePath}:${violation.line}:${violation.column} disallowed Effect.runSync call\n  ${violation.snippet}`,
    )
    .join('\n');

describe('effect runtime runner boundary invariants', () => {
  it('forbids Effect.runSync in runtime internals outside explicit transport boundaries', () => {
    const violations = collectRepositoryViolations();
    expect(violations, formatViolations(violations)).toEqual([]);
  });
});
