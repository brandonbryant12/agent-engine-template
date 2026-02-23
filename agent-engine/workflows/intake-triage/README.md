# Intake + Triage

- Status: utility skill (not a core workflow class)
- Source skill: [`intake-triage`](../../../.agents/skills/intake-triage/SKILL.md)
- Memory key: use the parent core workflow key (`Feature Delivery`, `Architecture + ADR Guard`, or `Self-Improvement`)

## What It Does

Converts a request into scoped vertical slices, acceptance criteria, test intent, and risk flags before implementation starts.

## Use With Core Workflows

- `Feature Delivery`
- `Architecture + ADR Guard`
- `Self-Improvement`

## Automation Entry Points

- [`ready-for-dev-executor`](../../automations/ready-for-dev-executor/ready-for-dev-executor.md)
- [`sanity-check`](../../automations/sanity-check/sanity-check.md)

## Note

For active workflow classes and memory-key policy, use [`agent-engine/workflows/README.md`](../README.md).
