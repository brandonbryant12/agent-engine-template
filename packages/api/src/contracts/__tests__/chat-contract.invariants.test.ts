import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveContractProcedures } from '@orpc/server';
import { describe, expect, it } from 'vitest';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { appContract } from '../index';

type ChatGeneralOperation = {
  requestBody?: {
    content?: Record<string, { schema?: unknown }>;
  };
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..', '..', '..', '..', '..');
const openApiSnapshotPath = path.join(repoRoot, 'docs/spec/generated/openapi.json');

const getChatInputSchema = async (): Promise<StandardSchemaV1> => {
  let schema: StandardSchemaV1 | undefined;

  await resolveContractProcedures(
    { path: [], router: appContract },
    ({ contract, path }) => {
      if (path.join('.') === 'chat.general') {
        const def = contract['~orpc'];
        schema = def.inputSchema as StandardSchemaV1 | undefined;
      }
    },
  );

  if (!schema) {
    throw new Error('chat.general input schema is missing from contract');
  }

  return schema;
};

const validate = async (
  schema: StandardSchemaV1,
  value: unknown,
): Promise<StandardSchemaV1.Result<unknown>> =>
  Promise.resolve(schema['~standard'].validate(value));

describe('chat contract invariants', () => {
  it('enforces bounded schema validation for chat messages input', async () => {
    const schema = await getChatInputSchema();

    const validInput = {
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello there' }],
        },
      ],
    };

    const valid = await validate(schema, validInput);
    expect(valid.issues).toBeUndefined();

    const emptyMessages = await validate(schema, { messages: [] });
    expect(emptyMessages.issues).toBeDefined();

    const invalidRole = await validate(schema, {
      messages: [{ id: 'msg_1', role: 'tool', parts: [{ type: 'text' }] }],
    });
    expect(invalidRole.issues).toBeDefined();

    const oversizedPayload = await validate(schema, {
      messages: Array.from({ length: 101 }, (_, index) => ({
        id: `msg_${index}`,
        role: 'user',
        parts: [{ type: 'text', text: 'x' }],
      })),
    });
    expect(oversizedPayload.issues).toBeDefined();

    const oversizedTextPart = await validate(schema, {
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          parts: [{ type: 'text', text: 'x'.repeat(8_001) }],
        },
      ],
    });
    expect(oversizedTextPart.issues).toBeDefined();
  });

  it('keeps chat request body coverage in generated OpenAPI snapshot', () => {
    const openApiDocument = JSON.parse(
      fs.readFileSync(openApiSnapshotPath, 'utf-8'),
    ) as {
      paths?: Record<string, { post?: ChatGeneralOperation }>;
    };

    const operation = openApiDocument.paths?.['/chat/general']?.post;
    const requestBodySchema =
      operation?.requestBody?.content?.['application/json']?.schema;

    expect(requestBodySchema).toBeDefined();
  });
});
