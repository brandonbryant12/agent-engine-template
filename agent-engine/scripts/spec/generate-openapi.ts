import { appContract } from '../../../packages/api/src/contracts/index.ts';
import path from 'node:path';
import { JSONSchema, Schema } from 'effect';
import { generatedRoot, stableSortObject, writeUtf8 } from './utils';

type ContractOperation = {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly tags: readonly string[];
  readonly summary: string;
  readonly description: string;
  readonly streaming: boolean;
  readonly inputSchema?: unknown;
};

type OpenApiOperation = {
  readonly operationId: string;
  readonly tags?: readonly string[];
  readonly summary?: string;
  readonly description?: string;
  readonly requestBody?: {
    required: boolean;
    content: {
      'application/json': {
        schema: Record<string, unknown>;
      };
    };
  };
  readonly responses: Record<string, unknown>;
};

const METHOD_ORDER = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
] as const;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

const csvCell = (value: string): string => value.replaceAll('|', '\\|');

const isStreamingOutput = (outputSchema: unknown): boolean => {
  const schemaRecord = asRecord(outputSchema);
  if (!schemaRecord) return false;

  const standard = asRecord(schemaRecord['~standard']);
  if (!standard) return false;

  return Object.getOwnPropertySymbols(standard).some((symbol) =>
    String(symbol).includes('EVENT_ITERATOR'),
  );
};

const collectContractOperations = (
  node: unknown,
  pathSegments: readonly string[] = [],
  visited: WeakSet<object> = new WeakSet(),
): ContractOperation[] => {
  const nodeRecord = asRecord(node);
  if (!nodeRecord) return [];

  if (visited.has(nodeRecord)) return [];
  visited.add(nodeRecord);

  const operations: ContractOperation[] = [];
  const meta = asRecord(nodeRecord['~orpc']);
  const route = asRecord(meta?.route);

  if (route) {
    const method = typeof route.method === 'string' ? route.method : '';
    const routePath = typeof route.path === 'string' ? route.path : '';
    if (method && routePath) {
      const tags = Array.isArray(route.tags)
        ? route.tags.filter((tag): tag is string => typeof tag === 'string')
        : [];

      operations.push({
        operationId: pathSegments.join('.'),
        method: method.toUpperCase(),
        path: routePath,
        tags,
        summary: typeof route.summary === 'string' ? route.summary : '',
        description:
          typeof route.description === 'string' ? route.description : '',
        streaming: isStreamingOutput(meta?.outputSchema),
        inputSchema: meta?.inputSchema,
      });
    }
  }

  for (const [key, value] of Object.entries(nodeRecord)) {
    if (key === '~orpc') continue;
    operations.push(
      ...collectContractOperations(value, [...pathSegments, key], visited),
    );
  }

  return operations;
};

const toRequestBody = (
  method: string,
  inputSchema: unknown,
): OpenApiOperation['requestBody'] | undefined => {
  if (!BODY_METHODS.has(method)) {
    return undefined;
  }

  if (!Schema.isSchema(inputSchema)) {
    return undefined;
  }

  try {
    const schema = stableSortObject(JSONSchema.make(inputSchema));
    return {
      required: true,
      content: {
        'application/json': {
          schema,
        },
      },
    };
  } catch {
    return undefined;
  }
};

const toOpenApiOperation = (operation: ContractOperation): OpenApiOperation => {
  const responseContent = operation.streaming
    ? {
        content: {
          'text/event-stream': {
            schema: {
              type: 'string',
            },
          },
        },
      }
    : {};

  return {
    operationId: operation.operationId,
    tags: operation.tags.length > 0 ? operation.tags : undefined,
    summary: operation.summary || undefined,
    description: operation.description || undefined,
    requestBody: toRequestBody(operation.method, operation.inputSchema),
    responses: {
      '200': {
        description: 'Successful response',
        ...responseContent,
      },
    },
  };
};

const buildOpenApiDocument = (
  operations: readonly ContractOperation[],
): Record<string, unknown> => {
  const paths: Record<string, Record<string, OpenApiOperation>> = {};

  for (const operation of operations) {
    const routePath = operation.path;
    const method = operation.method.toLowerCase();
    if (!paths[routePath]) {
      paths[routePath] = {};
    }

    paths[routePath]![method] = toOpenApiOperation(operation);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Agent Engine Template API (Spec Snapshot)',
      version: '1.0.0',
      description:
        'Generated from oRPC contract metadata. Request schemas are included when Effect Standard Schemas are available.',
    },
    servers: [{ url: '/api' }],
    paths,
  };
};

const formatApiSummaryMarkdown = (
  operations: readonly ContractOperation[],
  tags: readonly string[],
): string => {
  const lines: string[] = [];

  lines.push('# API Contract Surface (Generated)');
  lines.push('');
  lines.push(`- Endpoints: ${operations.length}`);
  lines.push(`- Tags: ${tags.length > 0 ? tags.join(', ') : 'none'}`);
  lines.push('');
  lines.push(
    '| Method | Path | Operation ID | Tags | Streaming | Summary |',
    '|---|---|---|---|---|---|',
  );

  for (const op of operations) {
    lines.push(
      `| ${csvCell(op.method)} | ${csvCell(op.path)} | ${csvCell(
        op.operationId,
      )} | ${csvCell(op.tags.join(', '))} | ${op.streaming ? 'yes' : 'no'} | ${csvCell(op.summary)} |`,
    );
  }

  return lines.join('\n');
};

const sortOperations = (
  operations: readonly ContractOperation[],
): ContractOperation[] => {
  const methodRank = new Map(
    METHOD_ORDER.map((method, index) => [method.toUpperCase(), index]),
  );

  return [...operations].sort((a, b) => {
    const byPath = a.path.localeCompare(b.path);
    if (byPath !== 0) return byPath;

    const rankA = methodRank.get(a.method) ?? METHOD_ORDER.length;
    const rankB = methodRank.get(b.method) ?? METHOD_ORDER.length;
    if (rankA !== rankB) return rankA - rankB;

    return a.operationId.localeCompare(b.operationId);
  });
};

export type OpenApiStats = {
  readonly endpointCount: number;
  readonly tagCount: number;
};

export const generateOpenApiArtifacts = async (): Promise<OpenApiStats> => {
  const operations = sortOperations(collectContractOperations(appContract));
  const uniqueTags = [...new Set(operations.flatMap((operation) => operation.tags))]
    .filter((tag) => tag.length > 0)
    .sort((a, b) => a.localeCompare(b));
  const openapiDoc = stableSortObject(buildOpenApiDocument(operations));

  await writeUtf8(
    path.join(generatedRoot, 'openapi.json'),
    JSON.stringify(openapiDoc, null, 2),
  );
  await writeUtf8(
    path.join(generatedRoot, 'api-surface.md'),
    formatApiSummaryMarkdown(operations, uniqueTags),
  );

  return {
    endpointCount: operations.length,
    tagCount: uniqueTags.length,
  };
};
