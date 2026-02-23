# Debug + Fix

- Status: utility skill (not a core workflow class)
- Source skill: [`debug-fix`](../../../.agents/skills/debug-fix/SKILL.md)
- Memory key: use the parent core workflow key (`Feature Delivery`, `Periodic Scans`, `Self-Improvement`, or `Architecture + ADR Guard`)

## What It Does

Runs a test-driven reproduce -> isolate -> fix -> validate loop to eliminate regressions and keep the fix verifiable.

## Use With Core Workflows

- `Feature Delivery`
- `Periodic Scans`
- `Self-Improvement`
- `Architecture + ADR Guard`

## Automation Entry Points

- [`ready-for-dev-executor`](../../automations/ready-for-dev-executor/ready-for-dev-executor.md)
- [`sanity-check`](../../automations/sanity-check/sanity-check.md)

## Note

For active workflow classes and memory-key policy, use [`agent-engine/workflows/README.md`](../README.md).
