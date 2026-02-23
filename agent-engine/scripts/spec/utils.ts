import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(scriptDir, '../../..');
export const docsRoot = path.join(repoRoot, 'docs');
export const generatedRoot = path.join(docsRoot, 'spec/generated');

export const ensureDir = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
};

export const readUtf8 = async (filePath: string): Promise<string> => {
  return fs.readFile(filePath, 'utf8');
};

export const writeUtf8 = async (
  filePath: string,
  content: string,
): Promise<void> => {
  await ensureDir(path.dirname(filePath));
  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  await fs.writeFile(filePath, normalized, 'utf8');
};

export const sectionTag = (name: string) => ({
  begin: `<!-- BEGIN GENERATED:${name} -->`,
  end: `<!-- END GENERATED:${name} -->`,
});

export const replaceGeneratedSection = (
  source: string,
  sectionName: string,
  replacement: string,
): string => {
  const { begin, end } = sectionTag(sectionName);
  const start = source.indexOf(begin);
  const finish = source.indexOf(end);

  if (start === -1 || finish === -1 || finish < start) {
    throw new Error(
      `Unable to replace section "${sectionName}" because markers were not found in master spec.`,
    );
  }

  const before = source.slice(0, start + begin.length);
  const after = source.slice(finish);
  const body = `\n${replacement.trim()}\n`;
  return `${before}${body}${after}`;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const stableSortObject = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortObject(item)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  const sorted: Record<string, unknown> = {};
  for (const [key, nestedValue] of entries) {
    sorted[key] = stableSortObject(nestedValue);
  }
  return sorted as T;
};
