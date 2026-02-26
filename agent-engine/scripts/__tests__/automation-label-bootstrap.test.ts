import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CODEX_AUTOMATION_LABEL_BOOTSTRAP =
  'gh label create codex-automation --color 5319E7 --description "Issue or PR created by Codex automation" --force';

describe('automation label bootstrap guardrails', () => {
  it('requires codex-automation bootstrap in research lane playbooks', async () => {
    const playbookPaths = [
      path.join(
        process.cwd(),
        'agent-engine',
        'automations',
        'best-practice-researcher',
        'best-practice-researcher.md',
      ),
      path.join(
        process.cwd(),
        'agent-engine',
        'automations',
        'agent-engine-researcher',
        'agent-engine-researcher.md',
      ),
      path.join(
        process.cwd(),
        'agent-engine',
        'automations',
        'product-vision-researcher',
        'product-vision-researcher.md',
      ),
      path.join(
        process.cwd(),
        'agent-engine',
        'automations',
        'product-owner-reviewer',
        'product-owner-reviewer.md',
      ),
    ];

    const playbooks = await Promise.all(playbookPaths.map((filePath) => readFile(filePath, 'utf8')));

    for (const playbook of playbooks) {
      expect(playbook).toContain(CODEX_AUTOMATION_LABEL_BOOTSTRAP);
      expect(playbook).not.toContain('codex-automation` when available');
    }
  });
});
