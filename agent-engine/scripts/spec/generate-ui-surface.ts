import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generatedRoot, repoRoot, writeUtf8 } from './utils';

const csvCell = (value: string): string => value.replaceAll('|', '\\|');

const extractRoutePaths = (source: string): string[] => {
  const blockStart = source.indexOf('export interface FileRoutesByFullPath {');
  if (blockStart === -1) return [];

  const blockEnd = source.indexOf('}', blockStart);
  if (blockEnd === -1) return [];

  const block = source.slice(blockStart, blockEnd);
  const matcher = /'([^']+)':/g;
  const routes = new Set<string>();

  let match = matcher.exec(block);
  while (match) {
    routes.add(match[1]!);
    match = matcher.exec(block);
  }

  return [...routes].sort((a, b) => a.localeCompare(b));
};

const MODULE_EXTENSIONS = new Set(['.ts', '.tsx']);

const shouldIncludeModuleFile = (entryName: string): boolean => {
  if (
    entryName.endsWith('.test.ts') ||
    entryName.endsWith('.test.tsx') ||
    entryName.endsWith('.spec.ts') ||
    entryName.endsWith('.spec.tsx') ||
    entryName.endsWith('.d.ts')
  ) {
    return false;
  }

  return MODULE_EXTENSIONS.has(path.extname(entryName));
};

const collectModulesFromDirectory = async (
  root: string,
  label: string,
  prefix = '',
): Promise<readonly string[]> => {
  let entries: fs.Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    throw error;
  }

  const modules: string[] = [];
  for (const entry of entries) {
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectModulesFromDirectory(fullPath, label, nextPrefix);
      modules.push(...nested);
      continue;
    }

    if (!entry.isFile() || !shouldIncludeModuleFile(entry.name)) {
      continue;
    }

    const modulePath = nextPrefix.replace(path.extname(nextPrefix), '');
    modules.push(`${label}/${modulePath}`.replaceAll(path.sep, '/'));
  }

  return modules;
};

const listUiModules = async (): Promise<readonly string[]> => {
  const webSrc = path.join(repoRoot, 'apps/web/src');
  const modules = await Promise.all([
    collectModulesFromDirectory(path.join(webSrc, 'pages'), 'pages'),
    collectModulesFromDirectory(path.join(webSrc, 'components'), 'components'),
    collectModulesFromDirectory(path.join(webSrc, 'lib'), 'lib'),
  ]);

  return modules
    .flat()
    .sort((a, b) => a.localeCompare(b));
};

const classifyAccess = (routePath: string): 'public' | 'protected' | 'shared' => {
  if (routePath === '/' || routePath === '/login' || routePath === '/register') {
    return 'public';
  }
  return 'protected';
};

const formatUiSurfaceMarkdown = (
  routes: readonly string[],
  modules: readonly string[],
): string => {
  const lines: string[] = [];

  lines.push('# UI Surface (Generated)');
  lines.push('');
  lines.push(`- Routes: ${routes.length}`);
  lines.push(`- UI modules: ${modules.length}`);
  lines.push('');
  lines.push('## Routes');
  lines.push('');
  lines.push('| Path | Access |');
  lines.push('|---|---|');
  for (const routePath of routes) {
    lines.push(`| ${csvCell(routePath)} | ${classifyAccess(routePath)} |`);
  }

  lines.push('');
  lines.push('## UI Modules');
  lines.push('');
  for (const modulePath of modules) {
    lines.push(`- \`${modulePath}\``);
  }

  return lines.join('\n');
};

export type UiSurfaceStats = {
  readonly routeCount: number;
  readonly moduleCount: number;
};

export const generateUiSurfaceArtifact = async (): Promise<UiSurfaceStats> => {
  const routeTreePath = path.join(repoRoot, 'apps/web/src/routeTree.gen.ts');
  const routeTreeSource = await fs.readFile(routeTreePath, 'utf8');
  const routes = extractRoutePaths(routeTreeSource);
  const modules = await listUiModules();

  await writeUtf8(
    path.join(generatedRoot, 'ui-surface.md'),
    formatUiSurfaceMarkdown(routes, modules),
  );

  return {
    routeCount: routes.length,
    moduleCount: modules.length,
  };
};
