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

const listFeatureModules = async (): Promise<readonly string[]> => {
  const featuresDir = path.join(repoRoot, 'apps/web/src/features');
  const entries = await fs.readdir(featuresDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
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
  features: readonly string[],
): string => {
  const lines: string[] = [];

  lines.push('# UI Surface (Generated)');
  lines.push('');
  lines.push(`- Routes: ${routes.length}`);
  lines.push(`- Feature modules: ${features.length}`);
  lines.push('');
  lines.push('## Routes');
  lines.push('');
  lines.push('| Path | Access |');
  lines.push('|---|---|');
  for (const routePath of routes) {
    lines.push(`| ${csvCell(routePath)} | ${classifyAccess(routePath)} |`);
  }

  lines.push('');
  lines.push('## Feature Modules');
  lines.push('');
  for (const feature of features) {
    lines.push(`- \`${feature}\``);
  }

  return lines.join('\n');
};

export type UiSurfaceStats = {
  readonly routeCount: number;
  readonly featureModuleCount: number;
};

export const generateUiSurfaceArtifact = async (): Promise<UiSurfaceStats> => {
  const routeTreePath = path.join(repoRoot, 'apps/web/src/routeTree.gen.ts');
  const routeTreeSource = await fs.readFile(routeTreePath, 'utf8');
  const routes = extractRoutePaths(routeTreeSource);
  const features = await listFeatureModules();

  await writeUtf8(
    path.join(generatedRoot, 'ui-surface.md'),
    formatUiSurfaceMarkdown(routes, features),
  );

  return {
    routeCount: routes.length,
    featureModuleCount: features.length,
  };
};
