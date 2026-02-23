import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ready-for-dev executor selection contract', () => {
  it('requires multi-issue bundling when actionable scope is small', async () => {
    const playbookPath = path.join(
      process.cwd(),
      'agent-engine',
      'automations',
      'ready-for-dev-executor',
      'ready-for-dev-executor.md',
    );
    const wrapperPath = path.join(
      process.cwd(),
      'agent-engine',
      'automations',
      'ready-for-dev-executor',
      'ready-for-dev-executor.toml',
    );
    const loopPath = path.join(process.cwd(), 'scripts', 'ready-for-dev-loop.sh');

    const [playbook, wrapper, loopScript] = await Promise.all([
      readFile(playbookPath, 'utf8'),
      readFile(wrapperPath, 'utf8'),
      readFile(loopPath, 'utf8'),
    ]);

    expect(playbook).toContain('scope_score <= 2.0');
    expect(playbook).toContain('Small-scope bundling is required, not optional');
    expect(wrapper).toContain('scope_score <= 2.0');
    expect(loopScript).toContain('scope_score <= 2.0');
  });

  it('keeps executor aligned to shared scope/domain contract', async () => {
    const contractPath = path.join(
      process.cwd(),
      'agent-engine',
      'automations',
      'contracts',
      'issue-scope-domain-contract.md',
    );
    const playbookPath = path.join(
      process.cwd(),
      'agent-engine',
      'automations',
      'ready-for-dev-executor',
      'ready-for-dev-executor.md',
    );
    const wrapperPath = path.join(
      process.cwd(),
      'agent-engine',
      'automations',
      'ready-for-dev-executor',
      'ready-for-dev-executor.toml',
    );
    const loopPath = path.join(process.cwd(), 'scripts', 'ready-for-dev-loop.sh');

    const [contract, playbook, wrapper, loopScript] = await Promise.all([
      readFile(contractPath, 'utf8'),
      readFile(playbookPath, 'utf8'),
      readFile(wrapperPath, 'utf8'),
      readFile(loopPath, 'utf8'),
    ]);

    expect(contract).toContain('scope:1');
    expect(contract).toContain('domain:api');
    expect(contract).toContain('Related ready-for-dev issues');
    expect(playbook).toContain('issue-scope-domain-contract.md');
    expect(playbook).toContain('domain:*');
    expect(playbook).toContain('issue-evaluator:planning:v1');
    expect(wrapper).toContain('issue-scope-domain-contract.md');
    expect(wrapper).toContain('domain:*');
    expect(loopScript).toContain('issue-scope-domain-contract.md');
    expect(loopScript).toContain('same-domain');
  });
});

describe('issue evaluator scope/domain contract', () => {
  it('requires scope/domain scoring and related-issue linking', async () => {
    const playbookPath = path.join(
      process.cwd(),
      'agent-engine',
      'automations',
      'issue-evaluator',
      'issue-evaluator.md',
    );
    const wrapperPath = path.join(
      process.cwd(),
      'agent-engine',
      'automations',
      'issue-evaluator',
      'issue-evaluator.toml',
    );
    const loopPath = path.join(process.cwd(), 'scripts', 'issue-evaluator-loop.sh');

    const [playbook, wrapper, loopScript] = await Promise.all([
      readFile(playbookPath, 'utf8'),
      readFile(wrapperPath, 'utf8'),
      readFile(loopPath, 'utf8'),
    ]);

    expect(playbook).toContain('issue-scope-domain-contract.md');
    expect(playbook).toContain('scope:1');
    expect(playbook).toContain('domain:api');
    expect(playbook).toContain('issue-evaluator:planning:v1');
    expect(playbook).toContain('Related ready-for-dev issues');
    expect(wrapper).toContain('issue-scope-domain-contract.md');
    expect(wrapper).toContain('scope:*');
    expect(wrapper).toContain('domain:*');
    expect(loopScript).toContain('issue-scope-domain-contract.md');
    expect(loopScript).toContain('scope:*');
    expect(loopScript).toContain('domain:*');
    expect(loopScript).toContain('issue-evaluator:planning:v1');
  });
});
