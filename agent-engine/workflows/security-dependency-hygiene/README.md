# Security + Dependency Hygiene

- Status: utility skill (not a core workflow class)
- Source skill: [`security-dependency-hygiene`](../../../.agents/skills/security-dependency-hygiene/SKILL.md)
- Memory key: use the parent core workflow key (`Periodic Scans`, `Feature Delivery`, or `Self-Improvement`)

## What It Does

Audits auth/data safety, secret handling, and dependency/supply-chain risk for changed code and release readiness.

## Use With Core Workflows

- `Periodic Scans`
- `Feature Delivery`
- `Self-Improvement`

## Automation Entry Points

- No dedicated automation lane.

## Note

For active workflow classes and memory-key policy, use [`agent-engine/workflows/README.md`](../README.md).
