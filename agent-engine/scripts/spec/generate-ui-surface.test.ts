import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockedPaths = vi.hoisted(() => ({
  repoRoot: '',
  generatedRoot: '',
}));

vi.mock('./utils', () => ({
  repoRoot: mockedPaths.repoRoot,
  generatedRoot: mockedPaths.generatedRoot,
  writeUtf8: async (filePath: string, content: string) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      content.endsWith('\n') ? content : `${content}\n`,
      'utf8',
    );
  },
}));

const tempDirs: string[] = [];

const createTempRepo = async (): Promise<string> => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-surface-spec-'));
  tempDirs.push(tempDir);
  return tempDir;
};

const writeFile = async (filePath: string, content: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
};

describe('generateUiSurfaceArtifact', () => {
  afterEach(async () => {
    vi.resetModules();
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('handles missing optional module directories without failing', async () => {
    const tempRepo = await createTempRepo();
    mockedPaths.repoRoot = tempRepo;
    mockedPaths.generatedRoot = path.join(tempRepo, 'docs/spec/generated');

    await writeFile(
      path.join(tempRepo, 'apps/web/src/routeTree.gen.ts'),
      `export interface FileRoutesByFullPath {
  '/': unknown;
  '/jobs': unknown;
}
`,
    );
    await writeFile(
      path.join(tempRepo, 'apps/web/src/pages/dashboard.tsx'),
      'export const Dashboard = () => null;\n',
    );

    const { generateUiSurfaceArtifact } = await import('./generate-ui-surface');
    const stats = await generateUiSurfaceArtifact();

    expect(stats).toEqual({
      routeCount: 2,
      moduleCount: 1,
    });

    const generated = await fs.readFile(
      path.join(mockedPaths.generatedRoot, 'ui-surface.md'),
      'utf8',
    );
    expect(generated).toContain('- UI modules: 1');
    expect(generated).toContain('`pages/dashboard`');
    expect(generated).not.toContain('`components/');
    expect(generated).not.toContain('## Feature Modules');
  });
});
