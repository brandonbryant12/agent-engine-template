import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generatedRoot, repoRoot, writeUtf8 } from './utils';

type TableInfo = {
  readonly variableName: string;
  readonly tableName: string;
  readonly sourceFile: string;
};

type EnumInfo = {
  readonly variableName: string;
  readonly enumName: string;
  readonly values: readonly string[];
  readonly sourceFile: string;
};

const csvCell = (value: string): string => value.replaceAll('|', '\\|');

const TABLE_PATTERN = /export const (\w+) = pgTable\(\s*'([^']+)'/g;
const ENUM_PATTERN = /export const (\w+) = pgEnum\(\s*'([^']+)'\s*,\s*\[([\s\S]*?)\]\s*\)/g;
const ENUM_VALUE_PATTERN = /'([^']+)'/g;

const listSchemaFiles = async (): Promise<readonly string[]> => {
  const schemaDir = path.join(repoRoot, 'packages/db/src/schemas');
  const entries = await fs.readdir(schemaDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => path.join(schemaDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
};

const extractTables = (source: string, sourceFile: string): TableInfo[] => {
  const result: TableInfo[] = [];
  TABLE_PATTERN.lastIndex = 0;
  let match = TABLE_PATTERN.exec(source);
  while (match) {
    result.push({
      variableName: match[1]!,
      tableName: match[2]!,
      sourceFile,
    });
    match = TABLE_PATTERN.exec(source);
  }
  return result;
};

const extractEnums = (source: string, sourceFile: string): EnumInfo[] => {
  const result: EnumInfo[] = [];
  ENUM_PATTERN.lastIndex = 0;
  let match = ENUM_PATTERN.exec(source);
  while (match) {
    const values: string[] = [];
    ENUM_VALUE_PATTERN.lastIndex = 0;
    let valueMatch = ENUM_VALUE_PATTERN.exec(match[3] ?? '');
    while (valueMatch) {
      values.push(valueMatch[1]!);
      valueMatch = ENUM_VALUE_PATTERN.exec(match[3] ?? '');
    }

    result.push({
      variableName: match[1]!,
      enumName: match[2]!,
      values,
      sourceFile,
    });
    match = ENUM_PATTERN.exec(source);
  }
  return result;
};

const formatDataModelMarkdown = (
  tables: readonly TableInfo[],
  enums: readonly EnumInfo[],
): string => {
  const lines: string[] = [];
  lines.push('# Data Model Surface (Generated)');
  lines.push('');
  lines.push(`- Tables: ${tables.length}`);
  lines.push(`- Enums: ${enums.length}`);
  lines.push('');
  lines.push('## Tables');
  lines.push('');
  lines.push('| Table | Symbol | Source |');
  lines.push('|---|---|---|');

  for (const table of tables) {
    const sourcePath = path
      .relative(repoRoot, table.sourceFile)
      .replaceAll(path.sep, '/');
    lines.push(
      `| ${csvCell(table.tableName)} | \`${csvCell(table.variableName)}\` | \`${csvCell(sourcePath)}\` |`,
    );
  }

  lines.push('');
  lines.push('## Enums');
  lines.push('');
  lines.push('| Enum | Symbol | Values | Source |');
  lines.push('|---|---|---|---|');

  for (const item of enums) {
    const sourcePath = path
      .relative(repoRoot, item.sourceFile)
      .replaceAll(path.sep, '/');
    lines.push(
      `| ${csvCell(item.enumName)} | \`${csvCell(item.variableName)}\` | ${csvCell(item.values.join(', '))} | \`${csvCell(sourcePath)}\` |`,
    );
  }

  return lines.join('\n');
};

export type DataModelStats = {
  readonly tableCount: number;
  readonly enumCount: number;
};

export const generateDataModelArtifact = async (): Promise<DataModelStats> => {
  const schemaFiles = await listSchemaFiles();
  const tables: TableInfo[] = [];
  const enums: EnumInfo[] = [];

  for (const filePath of schemaFiles) {
    const source = await fs.readFile(filePath, 'utf8');
    tables.push(...extractTables(source, filePath));
    enums.push(...extractEnums(source, filePath));
  }

  tables.sort((a, b) => a.tableName.localeCompare(b.tableName));
  enums.sort((a, b) => a.enumName.localeCompare(b.enumName));

  await writeUtf8(
    path.join(generatedRoot, 'data-model.md'),
    formatDataModelMarkdown(tables, enums),
  );

  return {
    tableCount: tables.length,
    enumCount: enums.length,
  };
};
