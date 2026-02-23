# Agent Engine

This folder is a high-level map of the controls used to keep Agent Engine Template changes predictable and safe.
It sits above detailed standards docs and explains how specs, skills, gates, and learning loops work together.

## Terminology

- `Workflow`: process contract and outcome class (scope, intent, workflow-memory key).
- `Skill`: reusable execution method used to implement workflow steps or utility tasks.
- `Automation`: runtime lane that triggers one or more workflows/skills under lane-specific policy.

Not every workflow has an automation lane, and automation lanes are not 1:1 aliases for workflows.

## Core Controls

| Control | Purpose | Source Of Truth |
|---|---|---|
| Behavior specs | Define expected product behavior before implementation | [`docs/master-spec.md`](../docs/master-spec.md), [`docs/spec/generated/`](../docs/spec/generated/) |
| Engineering standards | Constrain architecture, backend, frontend, and tests | [`docs/architecture/`](../docs/architecture/), [`docs/patterns/`](../docs/patterns/), [`docs/frontend/`](../docs/frontend/), [`docs/testing/`](../docs/testing/) |
| Workflow catalog | Define core workflow classes, memory keys, and utility-skill mapping | [`agent-engine/workflows/README.md`](./workflows/README.md), [`agent-engine/workflows/registry.json`](./workflows/registry.json) |
| Skill system | Standardize reusable execution methods used by workflows | [`.agents/skills/`](../.agents/skills/) |
| Automation lanes | Capture scheduled lane playbooks and runtime wrappers | [`agent-engine/automations/`](./automations/) |
| Automated quality gates | Catch drift and regressions before merge | `pnpm spec:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:invariants`, `pnpm build` |
| Human review controls | Cover risks that automation cannot fully judge | PR review + `pr-risk-review`, `architecture-adr-guard` |
| Workflow memory | Persist findings and improve guardrails over time | [`agent-engine/workflow-memory/`](./workflow-memory/) |

## Delivery Loop

1. Intake and triage the request.
2. Align intended behavior with specs and standards.
3. Implement with the smallest relevant workflow skills.
4. Run required quality gates.
5. Review risk and merge with evidence.
6. Record workflow memory and feed periodic/self-improvement loops.

## Next Read

1. [`agent-engine/framework-map.md`](./framework-map.md)
2. [`agent-engine/control-surfaces.md`](./control-surfaces.md)
3. [`agent-engine/workflows/README.md`](./workflows/README.md)
4. [`agent-engine/automations/README.md`](./automations/README.md)
5. [`agent-engine/workflow-memory/README.md`](./workflow-memory/README.md)
