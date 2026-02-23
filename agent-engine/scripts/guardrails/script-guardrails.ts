import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseSummaryMarker, SUMMARY_STALE_SENTINEL } from '../workflow-memory/summary-refresh';

const normalizePath = (value: string): string => value.split(path.sep).join('/');

export const ENTRY_SCRIPT_PATHS = [
  'agent-engine/scripts/skills/check-quality.ts',
  'agent-engine/scripts/workflows/generate-readme.ts',
  'agent-engine/scripts/workflow-memory/add-entry.ts',
  'agent-engine/scripts/workflow-memory/sync-git.ts',
  'agent-engine/scripts/workflow-memory/retrieve.ts',
  'agent-engine/scripts/workflow-memory/compact-memory.ts',
  'agent-engine/scripts/workflow-memory/bootstrap-coverage.ts',
  'agent-engine/scripts/workflow-memory/check-coverage.ts',
  'agent-engine/scripts/workflow-memory/replay-scenarios.ts',
  'agent-engine/scripts/guardrails/lint-scripts.ts',
] as const;

export const REQUIRED_PACKAGE_SCRIPTS: Record<string, string> = {
  'test:scripts': 'vitest run --config agent-engine/scripts/vitest.config.ts',
  'scripts:lint': 'pnpm exec tsx agent-engine/scripts/guardrails/lint-scripts.ts',
  'skills:check': 'pnpm exec tsx agent-engine/scripts/skills/check-quality.ts',
  'skills:check:strict': 'pnpm exec tsx agent-engine/scripts/skills/check-quality.ts --strict',
  'workflows:generate': 'pnpm exec tsx agent-engine/scripts/workflows/generate-readme.ts',
  'workflow-memory:add-entry': 'pnpm exec tsx agent-engine/scripts/workflow-memory/add-entry.ts',
  'workflow-memory:sync': 'pnpm exec tsx agent-engine/scripts/workflow-memory/sync-git.ts',
  'workflow-memory:retrieve': 'pnpm exec tsx agent-engine/scripts/workflow-memory/retrieve.ts',
  'workflow-memory:compact': 'pnpm exec tsx agent-engine/scripts/workflow-memory/compact-memory.ts',
  'workflow-memory:bootstrap':
    'pnpm exec tsx agent-engine/scripts/workflow-memory/bootstrap-coverage.ts',
  'workflow-memory:coverage': 'pnpm exec tsx agent-engine/scripts/workflow-memory/check-coverage.ts',
  'workflow-memory:coverage:strict':
    'pnpm exec tsx agent-engine/scripts/workflow-memory/check-coverage.ts --strict',
  'scenario:validate': 'pnpm exec tsx agent-engine/scripts/workflow-memory/replay-scenarios.ts',
  'scenario:validate:strict':
    'pnpm exec tsx agent-engine/scripts/workflow-memory/replay-scenarios.ts --strict',
};

const ENTRY_DIRECTORIES = ['skills', 'workflow-memory', 'workflows', 'guardrails'] as const;
const RUN_SCRIPT_MAIN_RE = /^\s*runScript\(main\);\s*$/m;
const WORKFLOW_MEMORY_ROOT = normalizePath(path.join('agent-engine', 'workflow-memory'));
const WORKFLOW_MEMORY_SUMMARIES = normalizePath(path.join(WORKFLOW_MEMORY_ROOT, 'summaries'));
const MARKDOWN_LINK_RE = /\[[^\]]+]\(([^)]+)\)/g;
const INLINE_CODE_RE = /`([^`\r\n]+)`/g;
const ABSOLUTE_OR_SCHEME_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const EXTRA_MARKDOWN_FILES = ['AGENTS.md', 'CLAUDE.md'] as const;

export type ScriptGuardrailIssue = {
  code:
    | 'missing-package-script'
    | 'script-command-mismatch'
    | 'missing-entry-file'
    | 'missing-effect-runner-import'
    | 'missing-run-script-call'
    | 'untracked-entry-script'
    | 'legacy-mjs-script'
    | 'missing-vitest-project'
    | 'broken-markdown-reference'
    | 'stale-workflow-memory-summary';
  message: string;
  path?: string;
};

type MarkdownRef = {
  line: number;
  target: string;
  source: 'link' | 'code';
};

const readPackageJson = async (rootDir: string): Promise<Record<string, unknown>> => {
  const packagePath = path.join(rootDir, 'package.json');
  const raw = await fs.readFile(packagePath, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' ? parsed : {};
};

const collectEntryScripts = async (rootDir: string): Promise<string[]> => {
  const results: string[] = [];

  for (const entryDir of ENTRY_DIRECTORIES) {
    const absoluteDir = path.join(rootDir, 'agent-engine', 'scripts', entryDir);
    let entries;

    try {
      entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    } catch (error) {
      if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.ts')) {
        continue;
      }

      const repoPath = normalizePath(
        path.join('agent-engine', 'scripts', entryDir, entry.name),
      );
      const source = await fs.readFile(path.join(rootDir, repoPath), 'utf8');
      if (!RUN_SCRIPT_MAIN_RE.test(source)) {
        continue;
      }

      results.push(repoPath);
    }
  }

  return results.sort();
};

const collectLegacyMjsScripts = async (rootDir: string): Promise<string[]> => {
  const scriptRoot = path.join(rootDir, 'agent-engine', 'scripts');
  const results: string[] = [];

  const walk = async (directory: string): Promise<void> => {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.mjs')) {
        results.push(normalizePath(path.relative(rootDir, absolutePath)));
      }
    }
  };

  await walk(scriptRoot);

  return results.sort();
};

const readJsonArray = async (filePath: string): Promise<Record<string, unknown>[]> => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
};

const isPlaceholderPath = (value: string): boolean => {
  if (!value) return true;
  if (value.startsWith('#')) return true;
  if (ABSOLUTE_OR_SCHEME_RE.test(value)) return true;
  if (
    value.includes('*') ||
    value.includes('{') ||
    value.includes('}') ||
    value.includes('<') ||
    value.includes('>') ||
    value.includes('|') ||
    value.includes('$')
  ) {
    return true;
  }
  if (value.includes('YYYY') || value.includes('MM') || value.includes('DD')) {
    return true;
  }
  return false;
};

const normalizeReferenceTarget = (raw: string): string => {
  const withoutAnchor = raw.split('#')[0]?.split('?')[0] ?? '';
  return withoutAnchor.trim().replace(/^[<\s]+|[>\s]+$/g, '');
};

const looksLikePathCodeSpan = (raw: string): boolean => {
  const candidate = raw.trim().replace(/[.,;:]+$/g, '');
  if (!candidate.includes('/')) return false;
  if (candidate.includes(' ')) return false;
  if (candidate.startsWith('-')) return false;
  if (candidate.includes('://')) return false;
  return true;
};

const resolveReferenceCandidates = (
  sourcePath: string,
  target: string,
  source: 'link' | 'code',
): string[] => {
  const normalized = normalizeReferenceTarget(target);
  if (!normalized || isPlaceholderPath(normalized)) {
    return [];
  }

  if (normalized.startsWith('/')) {
    return [normalizePath(normalized.slice(1))];
  }

  if (normalized.startsWith('./') || normalized.startsWith('../')) {
    return [normalizePath(path.join(path.dirname(sourcePath), normalized))];
  }

  const rootRelative = normalizePath(normalized);
  if (source === 'code') {
    const localRelative = normalizePath(path.join(path.dirname(sourcePath), normalized));
    if (localRelative !== rootRelative) {
      return [rootRelative, localRelative];
    }
  }

  return [rootRelative];
};

const extractMarkdownReferences = (content: string, includeCodeSpans: boolean): MarkdownRef[] => {
  const refs: MarkdownRef[] = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const lineNumber = index + 1;

    let linkMatch: RegExpExecArray | null;
    MARKDOWN_LINK_RE.lastIndex = 0;
    while ((linkMatch = MARKDOWN_LINK_RE.exec(line)) !== null) {
      refs.push({
        line: lineNumber,
        target: linkMatch[1] ?? '',
        source: 'link',
      });
    }

    if (!includeCodeSpans) {
      continue;
    }

    let codeMatch: RegExpExecArray | null;
    INLINE_CODE_RE.lastIndex = 0;
    while ((codeMatch = INLINE_CODE_RE.exec(line)) !== null) {
      const token = (codeMatch[1] ?? '').trim().replace(/[.,;:]+$/g, '');
      if (!looksLikePathCodeSpan(token)) {
        continue;
      }
      refs.push({
        line: lineNumber,
        target: token,
        source: 'code',
      });
    }
  }

  return refs;
};

const collectWorkflowMemoryMarkdownFiles = async (rootDir: string): Promise<string[]> => {
  const absoluteDir = path.join(rootDir, WORKFLOW_MEMORY_ROOT);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => normalizePath(path.join(WORKFLOW_MEMORY_ROOT, entry.name)))
    .sort();
};

const checkMarkdownReferenceGuardrails = async (
  rootDir: string,
): Promise<ScriptGuardrailIssue[]> => {
  const issues: ScriptGuardrailIssue[] = [];
  const workflowMemoryFiles = await collectWorkflowMemoryMarkdownFiles(rootDir);
  const markdownFiles = [...workflowMemoryFiles, ...EXTRA_MARKDOWN_FILES];

  for (const repoPath of markdownFiles) {
    const absolutePath = path.join(rootDir, repoPath);
    let source: string;
    try {
      source = await fs.readFile(absolutePath, 'utf8');
    } catch (error) {
      if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        issues.push({
          code: 'broken-markdown-reference',
          path: repoPath,
          message: 'Markdown file referenced by guardrails is missing.',
        });
        continue;
      }
      throw error;
    }

    const includeCodeSpans = repoPath.startsWith(`${WORKFLOW_MEMORY_ROOT}/`);
    const refs = extractMarkdownReferences(source, includeCodeSpans);
    for (const ref of refs) {
      const candidates = resolveReferenceCandidates(repoPath, ref.target, ref.source);
      if (candidates.length === 0) {
        continue;
      }

      let found = false;
      for (const candidate of candidates) {
        if (await fileExists(path.join(rootDir, candidate))) {
          found = true;
          break;
        }
      }

      if (!found) {
        issues.push({
          code: 'broken-markdown-reference',
          path: repoPath,
          message: `Line ${ref.line}: unresolved ${ref.source} reference '${ref.target}' -> tried '${candidates.join(
            "', '",
          )}'.`,
        });
      }
    }
  }

  return issues;
};

const checkWorkflowMemorySummaryFreshness = async (
  rootDir: string,
): Promise<ScriptGuardrailIssue[]> => {
  const issues: ScriptGuardrailIssue[] = [];
  const indexPath = path.join(rootDir, WORKFLOW_MEMORY_ROOT, 'index.json');
  const indexRows = await readJsonArray(indexPath);

  const monthCounts = new Map<string, number>();
  for (const row of indexRows) {
    const month = typeof row.month === 'string' ? row.month : '';
    if (!/^\d{4}-\d{2}$/.test(month)) {
      continue;
    }
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }

  for (const [month, count] of monthCounts) {
    if (count <= 0) {
      continue;
    }

    const summaryRepoPath = normalizePath(path.join(WORKFLOW_MEMORY_SUMMARIES, `${month}.md`));
    const summaryPath = path.join(rootDir, summaryRepoPath);
    let content = '';

    try {
      content = await fs.readFile(summaryPath, 'utf8');
    } catch (error) {
      if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        issues.push({
          code: 'stale-workflow-memory-summary',
          path: summaryRepoPath,
          message: `Missing monthly summary for ${month}; expected deterministic summary regeneration.`,
        });
        continue;
      }
      throw error;
    }

    if (content.includes(SUMMARY_STALE_SENTINEL)) {
      issues.push({
        code: 'stale-workflow-memory-summary',
        path: summaryRepoPath,
        message: `Summary for ${month} still reports no events while index contains ${count} event(s).`,
      });
    }

    const marker = parseSummaryMarker(content);
    if (!marker) {
      issues.push({
        code: 'stale-workflow-memory-summary',
        path: summaryRepoPath,
        message: `Summary for ${month} is missing freshness marker; rerun workflow-memory summary regeneration.`,
      });
      continue;
    }

    if (marker.month !== month || marker.events !== count) {
      issues.push({
        code: 'stale-workflow-memory-summary',
        path: summaryRepoPath,
        message: `Summary freshness mismatch for ${month}; marker month/events=${marker.month}/${marker.events}, index events=${count}.`,
      });
    }
  }

  return issues;
};

const checkEntryFileContracts = async (
  rootDir: string,
  repoPath: string,
): Promise<ScriptGuardrailIssue[]> => {
  const issues: ScriptGuardrailIssue[] = [];
  const absolutePath = path.join(rootDir, repoPath);

  let source: string;
  try {
    source = await fs.readFile(absolutePath, 'utf8');
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      issues.push({
        code: 'missing-entry-file',
        path: repoPath,
        message: 'Expected script entry file is missing.',
      });
      return issues;
    }
    throw error;
  }

  if (!source.includes('effect-script')) {
    issues.push({
      code: 'missing-effect-runner-import',
      path: repoPath,
      message: 'Script entry must import the shared Effect runner.',
    });
  }

  if (!RUN_SCRIPT_MAIN_RE.test(source)) {
    issues.push({
      code: 'missing-run-script-call',
      path: repoPath,
      message: 'Script entry must terminate with runScript(main);',
    });
  }

  return issues;
};

export const checkScriptGuardrails = async (
  rootDir = process.cwd(),
): Promise<ScriptGuardrailIssue[]> => {
  const issues: ScriptGuardrailIssue[] = [];
  const packageJson = await readPackageJson(rootDir);
  const scripts =
    packageJson.scripts && typeof packageJson.scripts === 'object'
      ? (packageJson.scripts as Record<string, unknown>)
      : {};

  for (const [scriptName, expectedCommand] of Object.entries(REQUIRED_PACKAGE_SCRIPTS)) {
    const actual = scripts[scriptName];

    if (typeof actual !== 'string') {
      issues.push({
        code: 'missing-package-script',
        message: `Missing package.json script: ${scriptName}`,
      });
      continue;
    }

    if (actual !== expectedCommand) {
      issues.push({
        code: 'script-command-mismatch',
        message: `Expected package.json script '${scriptName}' to equal '${expectedCommand}', found '${actual}'.`,
      });
    }
  }

  for (const entryPath of ENTRY_SCRIPT_PATHS) {
    const entryIssues = await checkEntryFileContracts(rootDir, entryPath);
    issues.push(...entryIssues);
  }

  const trackedEntries = new Set<string>(ENTRY_SCRIPT_PATHS);
  const discoveredEntries = await collectEntryScripts(rootDir);
  for (const entryPath of discoveredEntries) {
    if (!trackedEntries.has(entryPath)) {
      issues.push({
        code: 'untracked-entry-script',
        path: entryPath,
        message:
          'Found a script entrypoint that is not covered by guardrails. Add it to ENTRY_SCRIPT_PATHS and package.json scripts.',
      });
    }
  }

  const legacyMjsScripts = await collectLegacyMjsScripts(rootDir);
  for (const legacyPath of legacyMjsScripts) {
    issues.push({
      code: 'legacy-mjs-script',
      path: legacyPath,
      message: 'Legacy .mjs script found under agent-engine/scripts; migrate to Effect TypeScript.',
    });
  }

  const markdownIssues = await checkMarkdownReferenceGuardrails(rootDir);
  issues.push(...markdownIssues);

  const summaryIssues = await checkWorkflowMemorySummaryFreshness(rootDir);
  issues.push(...summaryIssues);

  const rootVitestPath = path.join(rootDir, 'vitest.config.ts');
  const rootVitestSource = await fs.readFile(rootVitestPath, 'utf8');
  if (!rootVitestSource.includes('agent-engine/scripts/vitest.config.ts')) {
    issues.push({
      code: 'missing-vitest-project',
      path: 'vitest.config.ts',
      message:
        'Root vitest projects must include agent-engine/scripts/vitest.config.ts so scripts are covered by pnpm test.',
    });
  }

  return issues;
};
