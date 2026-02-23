import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..', '..', '..', '..', '..');

const chatRouterPath = path.join(
  repoRoot,
  'packages/api/src/server/router/chat.ts',
);

const readChatRouter = () => fs.readFileSync(chatRouterPath, 'utf-8');

describe('chat handler invariants', () => {
  it('routes use stream handler pipeline helper for protocol + spans', () => {
    const source = readChatRouter();

    expect(source).toContain('handleEffectStreamWithProtocol');
  });

  it('routes do not call runtime.runPromise directly', () => {
    const source = readChatRouter();
    const forbidden = /context\.runtime\.runPromise/;

    expect(source).not.toMatch(forbidden);
  });

  it('routes declare api.chat spans for each handler', () => {
    const source = readChatRouter();
    const matches = source.match(/span:\s*'api\.chat\.[^']+'/g) ?? [];

    expect(matches).toHaveLength(1);
  });
});
