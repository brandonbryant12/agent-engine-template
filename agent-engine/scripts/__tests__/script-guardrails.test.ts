import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ENTRY_SCRIPT_PATHS,
  REQUIRED_PACKAGE_SCRIPTS,
  checkScriptGuardrails,
} from '../guardrails/script-guardrails';

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
});
