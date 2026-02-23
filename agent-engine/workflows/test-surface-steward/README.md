# Test Surface Steward

- Status: utility skill (not a core workflow class)
- Source skill: [`test-surface-steward`](../../../.agents/skills/test-surface-steward/SKILL.md)
- Memory key: use the parent core workflow key (`Feature Delivery`, `Periodic Scans`, or `Self-Improvement`)

## What It Does

Keeps test depth balanced across use-case, integration, workflow, invariant, frontend, and e2e layers as behavior changes.

## Use With Core Workflows

- `Feature Delivery`
- `Periodic Scans`
- `Self-Improvement`

## Automation Entry Points

- No dedicated automation lane.

## Note

For active workflow classes and memory-key policy, use [`agent-engine/workflows/README.md`](../README.md).
