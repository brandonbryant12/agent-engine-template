---
name: self-improvement
description: Self-improvement loop for AI-driven development in Template App. Use when turning regressions, scan results, and merge feedback into stronger docs, skills, tests, and automation.
---

# Template App Self-Improvement

Use this skill to continuously strengthen the AI development system, not just the code.

## Loop

1. Capture signals
2. Classify failure mode
3. Patch guardrails
4. Verify
5. Broadcast
6. Persist memory

Repeat every week and after notable incidents.

## 1) Capture Signals

Collect:

- failed CI runs and flaky tests
- post-merge defects and hotfixes
- repeated review comments
- periodic scan findings
- workflow-memory coverage gaps from `pnpm workflow-memory:coverage`

## 2) Classify Failure Mode

Tag each issue:

- missing standard
- ambiguous standard
- standard exists but was not enforced
- enforcement exists but was bypassed
- enforcement noisy or wrong

## 3) Patch Guardrails

Apply the lightest fix that prevents recurrence:

- add/adjust a test
- add/adjust lint rule
- tighten docs language in `docs/`
- add/update skill instructions in `.agents/skills/*`
- script repeated checks

## 4) Verify

- Run targeted tests and lint.
- Run repo-level validation for affected surfaces.
- Confirm the guardrail fails before the fix and passes after the fix where possible.
- For memory-system changes, run `pnpm workflow-memory:coverage:strict` after updates.
- For skill changes, run `pnpm skills:check:strict` and `agent-engine/scripts/sync-skills.sh`.
- When a failure is captured and a skill is patched, create a replayable scenario:
  1. Write a fixture file to `agent-engine/workflow-memory/scenarios/{id}.md` with `## Input` (exact code) and `## Expected Findings`.
  2. Use `workflow-memory:add-entry` with `--scenario-skill`, `--scenario-verdict`, and optional `--scenario-check`, `--scenario-pattern`, `--scenario-severity` flags.
  3. Run `pnpm scenario:validate:strict` to confirm the scenario is well-formed.

## 5) Broadcast

Update:

- [`AGENTS.md`](../../../AGENTS.md)
- [`CLAUDE.md`](../../../CLAUDE.md)
- [`agent-engine/workflows/README.md`](../../../agent-engine/workflows/README.md)

Also resync skill symlinks with `agent-engine/scripts/sync-skills.sh`.

## 6) Persist Memory

Record one structured memory event in `agent-engine/workflow-memory/events/YYYY-MM.jsonl` with `workflow: "Self-Improvement"` (prefer `pnpm workflow-memory:add-entry`):

- root cause class
- guardrail change shipped
- validation evidence
- what should be automated next
- taxonomy tags from [`agent-engine/workflow-memory/taxonomy.md`](../../../agent-engine/workflow-memory/taxonomy.md) when memory or agent-run diagnostics are involved

## Output Contract

1. Root cause class and evidence
2. Guardrail shipped (test/lint/docs/skill/script)
3. Validation evidence
4. Broadcasted instruction updates
5. Memory event id appended for this loop

## Definition of Done

A loop cycle is complete only when:

- The root cause is documented.
- A prevention mechanism exists.
- The prevention mechanism is validated.
- Shared instructions are updated.
- A memory entry is persisted.
