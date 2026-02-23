# Repository Operating Framework

This is the navigation layer for how repository governance works in Agent Engine Template.
It explains how standards docs, specs, skills, lint/invariants/tests, workflow memory,
and automation lanes fit into one operating system.

Start with [`agent-engine/README.md`](./README.md), then use this page for the detailed control map and linked source-of-truth docs.

## Terminology Contract

- `Workflow`: process contract + memory key (cataloged under `agent-engine/workflows/`).
- `Skill`: reusable execution method (canonical in `.agents/skills/*/SKILL.md`).
- `Automation`: runtime lane with trigger/policy/orchestration (`agent-engine/automations/*`).

Relationship rule:
- automation lanes may execute one or more workflows via one or more skills.
- they are not 1:1 aliases and should stay independently versioned.

## Why This Exists

The repo already has strong controls, but they are distributed across:

- `docs/`
- `.agents/skills/`
- `agent-engine/scripts/`
- invariant tests and lint rules
- `agent-engine/automations/`

This framework reduces orientation time by showing one coherent model.

## System Map

```mermaid
flowchart TD
  R[Request / Change Trigger] --> T[Intake + Triage]
  T --> S[Standards + Master Spec]
  S --> I[Implementation]
  I --> G[Quality Gates]
  G --> P[PR Risk Review / Test Surface Check]
  P --> M[Merge]
  M --> D[Docs Drift Check]
  D --> W[Workflow Memory Entry]
  W --> Q[Periodic Scans + Quality Closure]
  Q --> SI[Self-Improvement]
  SI --> S
```

## Control Planes

| Plane | Source Of Truth | Primary Enforcement | Evidence Artifact |
|---|---|---|---|
| Standards | [`docs/README.md`](../docs/README.md) and `docs/{architecture,patterns,frontend,testing}` | Type/lint/tests/manual review | Updated standards docs + passing gates |
| Product/system spec | [`docs/master-spec.md`](../docs/master-spec.md) + `docs/spec/generated/*` | `pnpm spec:generate`, `pnpm spec:check` | Generated snapshots + spec drift gate |
| Workflow catalog | `agent-engine/workflows/registry.json`, `agent-engine/workflows/*/README.md` | `pnpm workflows:generate`, docs review | Generated catalog + per-workflow pages |
| Skill system | `.agents/skills/*/SKILL.md` | `agent-engine/scripts/sync-skills.sh`, `pnpm skills:check:strict` | Canonical skills + synced mirrors |
| Static/dynamic guardrails | `tools/eslint/*`, invariant tests, package tests | `pnpm lint`, `pnpm test:invariants`, `pnpm test`, `pnpm typecheck`, `pnpm build` | CI/test logs + invariant pass/fail |
| Workflow memory | `agent-engine/workflow-memory/*` | `agent-engine/scripts/workflow-memory/*.ts`, coverage checks | JSONL events + index + summaries |
| Automation lanes | `agent-engine/automations/*/*.md` + `agent-engine/automations/*/*.toml` | Playbook contracts + lane-specific gate checklists | Issues/PRs + run summaries + memory events |

## Execution Model

1. Scope the work with `intake-triage`.
2. Align behavior with [`docs/master-spec.md`](../docs/master-spec.md) and standards docs.
3. Implement with the smallest relevant workflow skills.
4. Run gate ladder:
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:invariants`, `pnpm build`
and `pnpm spec:check` when behavior/spec surface changes.
5. Run pre-merge risk/coverage checks (`pr-risk-review`, `test-surface-steward` as needed).
6. Persist workflow memory entries for each workflow used.
7. Periodically run scan loops and self-improvement updates.

## Documentation Strategy (Recommended)

Keep docs layered to avoid duplication:

1. Framework map (this folder): how controls connect.
2. Standards docs (`docs/architecture`, `docs/patterns`, `docs/frontend`, `docs/testing`): what rules are.
3. Workflow/skills docs ([`agent-engine/workflows/`](./workflows/), `.agents/skills/*`): how work is executed.
4. Enforcement artifacts (`agent-engine/scripts/`, lint rules, invariants, CI): what is automatically checked.
5. Memory/automation docs (`agent-engine/workflow-memory`, `agent-engine/automations/`): how learnings compound and lanes operate.

When updating policy, prefer editing the deepest true source rather than repeating text in multiple places.

## Next Read

1. [`agent-engine/control-surfaces.md`](./control-surfaces.md)
2. [`agent-engine/workflows/README.md`](./workflows/README.md)
3. [`agent-engine/workflow-memory/README.md`](./workflow-memory/README.md)
4. [`agent-engine/automations/README.md`](./automations/README.md)
