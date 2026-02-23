import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

type ProtectedOpenApiParityException = {
  operationId: string;
  status: number;
  reason: string;
};

type OpenApiOperation = {
  operationId?: unknown;
  responses?: Record<string, unknown>;
};

type OpenApiDocument = {
  paths?: Record<string, Record<string, OpenApiOperation>>;
};

type OperationMetadata = {
  path: string;
  method: string;
  responses: Record<string, unknown>;
};

const openApiCompatibilityExceptions: CompatibilityException[] = [];
const protectedOpenApiParityExceptions: ProtectedOpenApiParityException[] = [];

const exceptionReasons = new Map(
  openApiCompatibilityExceptions.map((exception) => [
    exception.key,
    exception.reason,
  ]),
);

const ORPC_ERROR_STATUS_FALLBACKS: Readonly<Record<string, number>> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  NOT_ACCEPTABLE: 406,
  TIMEOUT: 408,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..', '..', '..', '..', '..');
const openApiSnapshotPath = path.join(repoRoot, 'docs/spec/generated/openapi.json');
const routerDir = path.join(repoRoot, 'packages/api/src/server/router');

const buildExceptionKey = (
  path: string,
  location: string,
  kind: string,
): string => `${path}::${location}::${kind}`;

const buildParityExceptionKey = (
  operationId: string,
  status: number,
): string => `${operationId}::${status}`;

const parityExceptionReasons = new Map(
  protectedOpenApiParityExceptions.map((exception) => [
    buildParityExceptionKey(exception.operationId, exception.status),
    exception.reason,
  ]),
);

const fallbackErrorStatus = (code: string): number =>
  ORPC_ERROR_STATUS_FALLBACKS[code] ?? 500;

const collectExpectedErrorStatuses = (
  errorMap: Record<string, unknown>,
): readonly number[] => {
  const statuses = new Set<number>();

  for (const [code, config] of Object.entries(errorMap)) {
    const configRecord =
      typeof config === 'object' && config !== null
        ? (config as Record<string, unknown>)
        : {};
    const configuredStatus =
      typeof configRecord.status === 'number' &&
      Number.isInteger(configRecord.status)
        ? configRecord.status
        : undefined;
    const status = configuredStatus ?? fallbackErrorStatus(code);

    if (status >= 200 && status < 300) continue;
    statuses.add(status);
  }

  return [...statuses].sort((a, b) => a - b);
};

const collectProtectedOperationIds = (): Set<string> => {
  const protectedOperationIds = new Set<string>();
  const routerFiles = fs
    .readdirSync(routerDir)
    .filter((file) => file.endsWith('.ts'))
    .filter((file) => file !== 'index.ts')
    .sort();

  const protectedProcedurePattern =
    /protectedProcedure\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\.handler/g;

  for (const file of routerFiles) {
    const source = fs.readFileSync(path.join(routerDir, file), 'utf-8');
    let match: RegExpExecArray | null = null;

    while ((match = protectedProcedurePattern.exec(source)) !== null) {
      const namespace = match[1];
      const procedure = match[2];
      if (!namespace || !procedure) continue;
      protectedOperationIds.add(`${namespace}.${procedure}`);
    }
  }

  return protectedOperationIds;
};

const readOpenApiOperations = (): Map<string, OperationMetadata> => {
  const document = JSON.parse(
    fs.readFileSync(openApiSnapshotPath, 'utf-8'),
  ) as OpenApiDocument;
  const operations = new Map<string, OperationMetadata>();

  for (const [httpPath, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!operation || typeof operation !== 'object') continue;
      const operationId =
        typeof operation.operationId === 'string'
          ? operation.operationId
          : undefined;
      if (!operationId) continue;

      operations.set(operationId, {
        path: httpPath,
        method,
        responses: operation.responses ?? {},
      });
    }
  }

  return operations;
};

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

  it('keeps protected route error-response parity with contract error maps', async () => {
    const protectedOperationIds = collectProtectedOperationIds();
    const openApiOperations = readOpenApiOperations();
    const parityIssues: string[] = [];
    const usedExceptions = new Set<string>();

    await resolveContractProcedures(
      { path: [], router: appContract },
      ({ contract, path }) => {
        const operationId = path.join('.');
        if (!protectedOperationIds.has(operationId)) {
          return;
        }

        const def = contract['~orpc'];
        const expectedStatuses = collectExpectedErrorStatuses(def.errorMap);
        const openApiOperation = openApiOperations.get(operationId);

        if (!openApiOperation) {
          parityIssues.push(
            `- ${operationId}: missing operation in OpenAPI snapshot`,
          );
          return;
        }

        const responseStatuses = new Set(Object.keys(openApiOperation.responses));

        for (const status of expectedStatuses) {
          const statusKey = String(status);
          if (responseStatuses.has(statusKey)) {
            continue;
          }

          const exceptionKey = buildParityExceptionKey(operationId, status);
          const exceptionReason = parityExceptionReasons.get(exceptionKey);
          if (exceptionReason) {
            usedExceptions.add(exceptionKey);
            continue;
          }

          parityIssues.push(
            `- ${operationId} (${openApiOperation.method.toUpperCase()} ${openApiOperation.path}): missing error status ${statusKey}`,
          );
        }
      },
    );

    const staleExceptions = protectedOpenApiParityExceptions.filter(
      (exception) =>
        !usedExceptions.has(
          buildParityExceptionKey(exception.operationId, exception.status),
        ),
    );

    if (staleExceptions.length > 0) {
      parityIssues.push(
        ...staleExceptions.map(
          (exception) =>
            `- stale exception ${exception.operationId}::${exception.status} (${exception.reason})`,
        ),
      );
    }

    if (parityIssues.length > 0) {
      throw new Error(
        [
          'OpenAPI error-response parity guard failed for protected routes.',
          '',
          ...parityIssues,
          '',
          'If a missing status is a known tooling limitation, add a documented entry to protectedOpenApiParityExceptions in this test.',
        ].join('\n'),
      );
    }

    expect(parityIssues).toEqual([]);
  });
});
