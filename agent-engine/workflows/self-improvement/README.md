# Self-Improvement

- Memory key: `Self-Improvement`
- Primary skill: [`self-improvement`](../../../.agents/skills/self-improvement/SKILL.md)

## What It Does

Converts repeated failures, review feedback, and scan findings into stronger guardrails across tests, lint, docs, skills, and automation.

## Trigger Skills

- `self-improvement` (primary)
- Common companions: `periodic-scans`, `quality-closure-loop`, `docs-knowledge-drift`

## Automation Entry Points

- [`agent-engine-researcher`](../../automations/agent-engine-researcher/agent-engine-researcher.md): produces candidate self-improvement issues.
- [`ready-for-dev-executor`](../../automations/ready-for-dev-executor/ready-for-dev-executor.md): implements approved self-improvement issues after a human adds `ready-for-dev`.
- [`sanity-check`](../../automations/sanity-check/sanity-check.md): periodically identifies and directly fixes bounded self-improvement guardrail issues.

## How It Works

1. Capture signals (CI failures, escaped defects, repeated review comments, scan findings, memory coverage gaps).
2. Classify root cause class (missing/ambiguous/unenforced/bypassed/noisy guardrails).
3. Patch the smallest effective prevention mechanism.
4. Validate fail-before/pass-after where possible.
5. Broadcast updates to shared instructions and sync skills when changed.
6. Persist a structured workflow-memory event.

## Outputs

- Root cause and guardrail patch summary.
- Validation evidence and broadcasted docs/skill updates.
- Memory entry with workflow `Self-Improvement`.
