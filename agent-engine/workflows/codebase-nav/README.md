# Codebase Navigation

- Status: utility skill (not a core workflow class)
- Source skill: [`codebase-nav`](../../../.agents/skills/codebase-nav/SKILL.md)
- Memory key: use the parent core workflow key (`Feature Delivery`, `Architecture + ADR Guard`, or `Docs + Knowledge Drift`)

## What It Does

Locates canonical files, contracts, and tests quickly before implementing or reviewing a change.

## Use With Core Workflows

- `Feature Delivery`
- `Architecture + ADR Guard`
- `Docs + Knowledge Drift`

## Automation Entry Points

- No dedicated automation lane.

## Note

For active workflow classes and memory-key policy, use [`agent-engine/workflows/README.md`](../README.md).
