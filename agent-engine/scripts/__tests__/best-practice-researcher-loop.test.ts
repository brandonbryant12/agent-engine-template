import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('best-practice researcher loop wrapper', () => {
  it('bootstraps dependencies and validates workflow-memory runtime in fresh worktrees', async () => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'best-practice-researcher-loop.sh');
    const script = await readFile(scriptPath, 'utf8');

    expect(script).toContain('pnpm install --frozen-lockfile --prefer-offline');
    expect(script).toContain('npm_config_registry=https://registry.npmjs.org pnpm install --frozen-lockfile');
    expect(script).toContain('npm_config_registry=https://registry.npmjs.com pnpm install --frozen-lockfile');
    expect(script).toContain(
      "pnpm workflow-memory:retrieve --workflow 'Periodic Scans' --limit 1 --min-score 0 >/dev/null",
    );
  });
});
