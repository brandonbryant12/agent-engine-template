import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('agent-engine researcher playbook', () => {
  it('requires runtime bootstrap and workflow-memory preflight before research logic', async () => {
    const playbookPath = path.join(
      process.cwd(),
      'agent-engine',
      'automations',
      'agent-engine-researcher',
      'agent-engine-researcher.md',
    );
    const playbook = await readFile(playbookPath, 'utf8');

    expect(playbook).toContain("pnpm install --frozen-lockfile --prefer-offline");
    expect(playbook).toContain("npm_config_registry=https://registry.npmjs.org pnpm install --frozen-lockfile");
    expect(playbook).toContain("npm_config_registry=https://registry.npmjs.com pnpm install --frozen-lockfile");
    expect(playbook).toContain(
      'pnpm workflow-memory:retrieve --workflow "Periodic Scans" --limit 1 --min-score 0',
    );
  });
});
