# Release + Incident Response

- Status: utility skill (not a core workflow class)
- Source skill: [`release-incident-response`](../../../.agents/skills/release-incident-response/SKILL.md)
- Memory key: use the parent core workflow key (`Feature Delivery`, `Periodic Scans`, or `Self-Improvement`)

## What It Does

Manages release readiness, canary/rollback criteria, and incident triage/hotfix handling with post-incident guardrail hardening.

## Use With Core Workflows

- `Feature Delivery`
- `Periodic Scans`
- `Self-Improvement`

## Automation Entry Points

- No dedicated automation lane.

## Note

For active workflow classes and memory-key policy, use [`agent-engine/workflows/README.md`](../README.md).
