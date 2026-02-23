import { getEventIteratorSchemaDetails } from '@orpc/contract';
import { resolveContractProcedures } from '@orpc/server';
import * as Schema from 'effect/Schema';
import * as AST from 'effect/SchemaAST';
import { describe, expect, it } from 'vitest';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { appContract } from '../index';

type CompatibilityIssue = {
  path: string;
  location: string;
  kind: string;
  detail: string;
};

type CompatibilityException = {
  key: string;
  reason: string;
};

const openApiCompatibilityExceptions: CompatibilityException[] = [];

const exceptionReasons = new Map(
  openApiCompatibilityExceptions.map((exception) => [
    exception.key,
    exception.reason,
  ]),
);

const buildExceptionKey = (
  path: string,
  location: string,
  kind: string,
): string => `${path}::${location}::${kind}`;

const collectSchemaIssues = (
  schema: unknown,
  path: string,
  location: string,
  issues: CompatibilityIssue[],
): void => {
  if (!schema) return;

  const eventIterator = getEventIteratorSchemaDetails(
    schema as unknown as StandardSchemaV1<unknown, unknown>,
  );
  if (eventIterator) {
    collectSchemaIssues(
      eventIterator.yields,
      path,
      `${location}.yields`,
      issues,
    );
    collectSchemaIssues(
      eventIterator.returns,
      path,
      `${location}.returns`,
      issues,
    );
    return;
  }

  if (!Schema.isSchema(schema)) return;

  const seen = new Set<AST.AST>();
  const foundKinds = new Set<string>();

  const record = (kind: string, detail: string) => {
    if (foundKinds.has(kind)) return;
    foundKinds.add(kind);
    issues.push({ path, location, kind, detail });
  };

  const visit = (node: AST.AST): void => {
    if (seen.has(node)) return;
    seen.add(node);

    if (AST.isUnknownKeyword(node)) {
      record('Unknown', 'Schema.Unknown is not OpenAPI compatible.');
    }
    if (AST.isAnyKeyword(node)) {
      record('Any', 'Schema.Any is not OpenAPI compatible.');
    }
    if (AST.isBigIntKeyword(node)) {
      record('BigInt', 'Schema.BigInt is not OpenAPI compatible.');
    }
    if (AST.isSymbolKeyword(node)) {
      record('Symbol', 'Schema.Symbol is not OpenAPI compatible.');
    }

    if (AST.isDeclaration(node)) {
      node.typeParameters.forEach(visit);
    } else if (AST.isTupleType(node)) {
      node.elements.forEach((element) => visit(element.type));
      node.rest.forEach((element) => visit(element.type));
    } else if (AST.isTypeLiteral(node)) {
      node.propertySignatures.forEach((signature) => visit(signature.type));
      node.indexSignatures.forEach((signature) => {
        visit(signature.parameter);
        visit(signature.type);
      });
    } else if (AST.isUnion(node)) {
      node.types.forEach(visit);
    } else if (AST.isSuspend(node)) {
      visit(node.f());
    } else if (AST.isRefinement(node)) {
      visit(node.from);
    } else if (AST.isTransformation(node)) {
      visit(node.from);
      visit(node.to);
    }
  };

  visit(schema.ast);
};

const formatIssues = (issues: CompatibilityIssue[]): string =>
  issues
    .map((issue) => {
      const exceptionKey = buildExceptionKey(
        issue.path,
        issue.location,
        issue.kind,
      );
      const exceptionReason = exceptionReasons.get(exceptionKey);
      const exceptionSuffix = exceptionReason
        ? ` (exception: ${exceptionReason})`
        : '';

      return `- ${issue.path} (${issue.location}): ${issue.kind} :: ${issue.detail}${exceptionSuffix}`;
    })
    .join('\n');

describe('OpenAPI compatibility guard', () => {
  it('rejects incompatible output/error schemas', async () => {
    const issues: CompatibilityIssue[] = [];

    await resolveContractProcedures(
      { path: [], router: appContract },
      ({ contract, path }) => {
        const def = contract['~orpc'];
        const pathLabel = path.join('.');

        collectSchemaIssues(def.outputSchema, pathLabel, 'output', issues);

        for (const [code, config] of Object.entries(def.errorMap)) {
          const errorConfig = config as { data?: unknown } | undefined;
          if (!errorConfig?.data) continue;
          collectSchemaIssues(
            errorConfig.data,
            pathLabel,
            `error.${code}.data`,
            issues,
          );
        }
      },
    );

    const actionable = issues.filter((issue) => {
      const key = buildExceptionKey(issue.path, issue.location, issue.kind);
      return !exceptionReasons.has(key);
    });

    if (actionable.length > 0) {
      throw new Error(
        [
          'OpenAPI compatibility guard failed for contract output/error schemas.',
          '',
          formatIssues(actionable),
          '',
          'If a violation is intentional, add a documented exception in this test file.',
        ].join('\n'),
      );
    }

    expect(actionable).toEqual([]);
  });
});
