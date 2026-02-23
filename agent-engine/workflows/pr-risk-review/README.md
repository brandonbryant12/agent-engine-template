# PR Risk Review

- Status: utility skill (not a core workflow class)
- Source skill: [`pr-risk-review`](../../../.agents/skills/pr-risk-review/SKILL.md)
- Memory key: use the parent core workflow key (`Feature Delivery`, `Architecture + ADR Guard`, or `Self-Improvement`)

## What It Does

Runs a findings-first pre-merge review focused on regressions, authorization/data safety, contract compatibility, and missing test evidence.

## Use With Core Workflows

- `Feature Delivery`
- `Architecture + ADR Guard`
- `Self-Improvement`

## Automation Entry Points

- No dedicated automation lane.

## Note

For active workflow classes and memory-key policy, use [`agent-engine/workflows/README.md`](../README.md).
