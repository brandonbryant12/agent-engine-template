import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ENTRY_SCRIPT_PATHS,
  REQUIRED_PACKAGE_SCRIPTS,
  checkScriptGuardrails,
} from '../guardrails/script-guardrails';
import { parseSummaryMarker, SUMMARY_STALE_SENTINEL } from '../workflow-memory/summary-refresh';

describe('script guardrails', () => {
  it('passes repository script guardrails', async () => {
    const issues = await checkScriptGuardrails();
    expect(issues).toEqual([]);
  });

  it('keeps required script command wiring in package.json', async () => {
    const rawPackage = await readFile(path.join(process.cwd(), 'package.json'), 'utf8');
    const parsed = JSON.parse(rawPackage) as { scripts?: Record<string, string> };

    for (const [scriptName, expectedCommand] of Object.entries(REQUIRED_PACKAGE_SCRIPTS)) {
      expect(parsed.scripts?.[scriptName]).toBe(expectedCommand);
    }
  });

  it('tracks all script entrypoints explicitly', async () => {
    const trackedEntries = new Set(ENTRY_SCRIPT_PATHS);

    // Guard against accidental duplicate entries in the tracked list.
    expect(trackedEntries.size).toBe(ENTRY_SCRIPT_PATHS.length);
  });

  it('keeps workflow-memory guardrail evidence on TypeScript entrypoints', async () => {
    const guardrailsPath = path.join(process.cwd(), 'agent-engine', 'workflow-memory', 'guardrails.md');
    const content = await readFile(guardrailsPath, 'utf8');

    expect(content).not.toContain('.mjs');
    expect(content).toContain('add-entry.ts');
    expect(content).toContain('check-coverage.ts');
    expect(content).toContain('check-quality.ts');
  });

  it('keeps monthly summaries fresh for months represented in index.json', async () => {
    const indexPath = path.join(process.cwd(), 'agent-engine', 'workflow-memory', 'index.json');
    const rawIndex = await readFile(indexPath, 'utf8');
    const rows = JSON.parse(rawIndex) as Array<{ month?: string }>;

    const monthCounts = new Map<string, number>();
    for (const row of rows) {
      const month = typeof row.month === 'string' ? row.month : '';
      if (!/^\d{4}-\d{2}$/.test(month)) continue;
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    }

    for (const [month, count] of monthCounts) {
      if (count <= 0) continue;
      const summaryPath = path.join(
        process.cwd(),
        'agent-engine',
        'workflow-memory',
        'summaries',
        `${month}.md`,
      );
      const summary = await readFile(summaryPath, 'utf8');
      const marker = parseSummaryMarker(summary);

      expect(summary).not.toContain(SUMMARY_STALE_SENTINEL);
      expect(marker).not.toBeNull();
      expect(marker?.month).toBe(month);
      expect(marker?.events).toBe(count);
    }
  });
});
