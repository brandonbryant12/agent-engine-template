import { describe, expect, it, vi, afterEach } from 'vitest';
import { readWorkflowRegistry } from '../workflows/registry';

let missingPathSuffixes: string[] = [];

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    access: vi.fn(async (targetPath: Parameters<typeof actual.access>[0], mode?: Parameters<typeof actual.access>[1]) => {
      const normalizedPath = String(targetPath).replaceAll('\\', '/');
      if (missingPathSuffixes.some((suffix) => normalizedPath.endsWith(suffix))) {
        const error = new Error(`ENOENT: ${normalizedPath}`) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      }
      return actual.access(targetPath, mode);
    }),
  };
});

afterEach(() => {
  missingPathSuffixes = [];
});

describe('workflow registry validation', () => {
  it('fails when an automation lane toml wrapper is missing', async () => {
    missingPathSuffixes = ['agent-engine/automations/ready-for-dev-executor/ready-for-dev-executor.toml'];

    await expect(readWorkflowRegistry()).rejects.toThrow(
      'agent-engine/automations/ready-for-dev-executor/ready-for-dev-executor.toml',
    );
  });

  it('fails when an automation lane markdown playbook path is missing', async () => {
    missingPathSuffixes = ['agent-engine/automations/ready-for-dev-executor/ready-for-dev-executor.md'];

    await expect(readWorkflowRegistry()).rejects.toThrow(
      'agent-engine/automations/ready-for-dev-executor/ready-for-dev-executor.md',
    );
  });
});
