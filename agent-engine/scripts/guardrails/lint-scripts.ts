#!/usr/bin/env node

import { runScript } from '../lib/effect-script';
import { checkScriptGuardrails } from './script-guardrails';

async function main() {
  const issues = await checkScriptGuardrails();

  if (issues.length === 0) {
    console.log('Script lint guardrails passed.');
    return;
  }

  console.error(`Script lint guardrails failed with ${issues.length} issue(s):`);
  for (const issue of issues) {
    const location = issue.path ? `${issue.path}: ` : '';
    console.error(`- [${issue.code}] ${location}${issue.message}`);
  }

  process.exitCode = 1;
}

runScript(main);
