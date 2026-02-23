import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type LayerConstructor = 'succeed' | 'sync' | 'effect';

type PolicyViolation = {
  filePath: string;
  method: LayerConstructor;
  message: string;
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

const toPosixPath = (value: string): string => value.split(path.sep).join('/');

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

const toRelativePath = (filePath: string): string => toPosixPath(path.relative(repoRoot, filePath));

const isEffectBackedExpression = (
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
): boolean => /\bEffect\./.test(expression.getText(sourceFile));

const collectEffectBoundIdentifiers = (sourceFile: ts.SourceFile): Set<string> => {
  const names = new Set<string>();

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (isEffectBackedExpression(node.initializer, sourceFile)) {
        names.add(node.name.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return names;
};

const collectReturnedExpressions = (
  body: ts.ConciseBody,
): readonly ts.Expression[] => {
  if (!ts.isBlock(body)) return [body];

  const returns: ts.Expression[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isReturnStatement(node) && node.expression) {
      returns.push(node.expression);
    }

    ts.forEachChild(node, visit);
  };

  visit(body);
  return returns;
};

const expressionContainsCallOrNew = (node: ts.Node): boolean => {
  let found = false;

  const visit = (current: ts.Node): void => {
    if (found) return;

    if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
      found = true;
      return;
    }

    ts.forEachChild(current, visit);
  };

  visit(node);
  return found;
};

const isFactoryLikeFunction = (expression: ts.Expression): boolean => {
  if (!ts.isArrowFunction(expression) && !ts.isFunctionExpression(expression)) {
    return false;
  }

  const returns = collectReturnedExpressions(expression.body);
  if (returns.length === 0) return false;

  return returns.every((returnExpression) =>
    expressionContainsCallOrNew(returnExpression),
  );
};

const getLayerConstructorMethod = (
  expression: ts.LeftHandSideExpression,
): LayerConstructor | null => {
  if (!ts.isPropertyAccessExpression(expression)) return null;
  if (!ts.isIdentifier(expression.expression)) return null;
  if (expression.expression.text !== 'Layer') return null;

  if (expression.name.text === 'succeed') return 'succeed';
  if (expression.name.text === 'sync') return 'sync';
  if (expression.name.text === 'effect') return 'effect';

  return null;
};

const createViolation = (
  sourceFile: ts.SourceFile,
  filePath: string,
  method: LayerConstructor,
  node: ts.Node,
  message: string,
): PolicyViolation => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  const snippet = node
    .getText(sourceFile)
    .replace(/\s+/g, ' ')
    .slice(0, 160);

  return {
    filePath: toRelativePath(filePath),
    method,
    message,
    line: line + 1,
    column: character + 1,
    snippet,
  };
};

const evaluateLayerConstructorPolicy = (
  filePath: string,
  sourceText: string,
): PolicyViolation[] => {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const effectBoundIdentifiers = collectEffectBoundIdentifiers(sourceFile);
  const violations: PolicyViolation[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const method = getLayerConstructorMethod(node.expression);

      if (method) {
        const constructorArg = node.arguments[1];
        if (!constructorArg) {
          violations.push(
            createViolation(
              sourceFile,
              filePath,
              method,
              node,
              `Layer.${method} must include a constructor argument.`,
            ),
          );
        } else if (
          method === 'succeed' &&
          !ts.isObjectLiteralExpression(constructorArg)
        ) {
          violations.push(
            createViolation(
              sourceFile,
              filePath,
              method,
              constructorArg,
              'Layer.succeed requires a pure object literal as the service value.',
            ),
          );
        } else if (method === 'sync' && !isFactoryLikeFunction(constructorArg)) {
          violations.push(
            createViolation(
              sourceFile,
              filePath,
              method,
              constructorArg,
              'Layer.sync requires a factory/class function whose returned value is built via call/new.',
            ),
          );
        } else if (method === 'effect') {
          const directEffectExpression = isEffectBackedExpression(
            constructorArg,
            sourceFile,
          );
          const effectIdentifierReference =
            ts.isIdentifier(constructorArg) &&
            effectBoundIdentifiers.has(constructorArg.text);

          if (!directEffectExpression && !effectIdentifierReference) {
            violations.push(
              createViolation(
                sourceFile,
                filePath,
                method,
                constructorArg,
                'Layer.effect requires an Effect-backed constructor expression or an identifier bound to Effect.*.',
              ),
            );
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
};

const collectRepositoryViolations = (): PolicyViolation[] => {
  const files = sourceRoots.flatMap((root) => collectRuntimeSourceFiles(root));
  const violations = files.flatMap((filePath) =>
    evaluateLayerConstructorPolicy(filePath, fs.readFileSync(filePath, 'utf-8')),
  );

  return violations.sort((left, right) => {
    const pathComparison = left.filePath.localeCompare(right.filePath);
    if (pathComparison !== 0) return pathComparison;

    if (left.line !== right.line) return left.line - right.line;
    return left.column - right.column;
  });
};

const formatViolations = (violations: readonly PolicyViolation[]): string =>
  violations
    .map(
      (violation) =>
        `${violation.filePath}:${violation.line}:${violation.column} [Layer.${violation.method}] ${violation.message}\n  ${violation.snippet}`,
    )
    .join('\n');

describe('effect layer constructor policy invariants', () => {
  it('enforces layer constructor rules in non-test runtime source files', () => {
    const violations = collectRepositoryViolations();
    expect(violations, formatViolations(violations)).toEqual([]);
  });

  it('accepts canonical Layer.succeed/sync/effect patterns', () => {
    const fixture = `
      import { Effect, Layer } from 'effect';

      const makeService = Effect.gen(function* () {
        return { ping: () => Effect.void };
      });

      Layer.succeed(Service, { ping: () => Effect.void });
      Layer.sync(Service, () => new ServiceImpl());
      Layer.sync(Service, () => makeServiceFactory(config));
      Layer.effect(Service, Effect.gen(function* () { return {}; }));
      Layer.effect(Service, makeService);
    `;

    const violations = evaluateLayerConstructorPolicy(
      path.join(repoRoot, 'packages', 'example', 'src', 'runtime.ts'),
      fixture,
    );

    expect(violations).toEqual([]);
  });

  it('fails when Layer.succeed uses a non-object constructor value', () => {
    const fixture = `
      import { Layer } from 'effect';
      const service = createService();
      Layer.succeed(Service, service);
    `;

    const violations = evaluateLayerConstructorPolicy(
      path.join(repoRoot, 'packages', 'example', 'src', 'runtime.ts'),
      fixture,
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      method: 'succeed',
      message: expect.stringContaining('Layer.succeed requires a pure object literal'),
    });
  });

  it('fails when Layer.sync is not passed a factory/class function', () => {
    const fixture = `
      import { Layer } from 'effect';
      Layer.sync(Service, { ping: () => 'ok' });
    `;

    const violations = evaluateLayerConstructorPolicy(
      path.join(repoRoot, 'packages', 'example', 'src', 'runtime.ts'),
      fixture,
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      method: 'sync',
      message: expect.stringContaining('Layer.sync requires a factory/class function'),
    });
  });

  it('fails when Layer.effect is not Effect-backed', () => {
    const fixture = `
      import { Layer } from 'effect';
      const makeService = buildService();
      Layer.effect(Service, makeService);
    `;

    const violations = evaluateLayerConstructorPolicy(
      path.join(repoRoot, 'packages', 'example', 'src', 'runtime.ts'),
      fixture,
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      method: 'effect',
      message: expect.stringContaining('Layer.effect requires an Effect-backed constructor'),
    });
  });
});
