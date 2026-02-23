# Quality Closure Loop

- Status: utility skill (not a core workflow class)
- Source skill: [`quality-closure-loop`](../../../.agents/skills/quality-closure-loop/SKILL.md)
- Memory key: use the parent core workflow key (`Periodic Scans`, `Feature Delivery`, `Docs + Knowledge Drift`, `Self-Improvement`, or `Architecture + ADR Guard`)

## What It Does

Orchestrates scan -> triage -> fixes -> recurrence prevention -> closure so recurring issues are fully resolved and guarded.

## Use With Core Workflows

- `Periodic Scans`
- `Feature Delivery`
- `Docs + Knowledge Drift`
- `Self-Improvement`
- `Architecture + ADR Guard`

## Automation Entry Points

- No dedicated automation lane.

## Note

For active workflow classes and memory-key policy, use [`agent-engine/workflows/README.md`](../README.md).
