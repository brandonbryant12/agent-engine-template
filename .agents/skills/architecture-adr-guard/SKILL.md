---
name: architecture-adr-guard
description: Architecture boundary and ADR guard workflow for validating design changes against documented system constraints.
---

# Agent Engine Template Architecture + ADR Guard

Use this skill when a change may cross package boundaries, layer rules, or core runtime patterns.

## Standards To Check

- [`docs/architecture/overview.md`](../../../docs/architecture/overview.md)
- [`docs/architecture/access-control.md`](../../../docs/architecture/access-control.md)
- [`docs/architecture/observability.md`](../../../docs/architecture/observability.md)
- [`docs/patterns/use-case.md`](../../../docs/patterns/use-case.md)
- [`docs/patterns/repository.md`](../../../docs/patterns/repository.md)
- [`docs/patterns/api-handler.md`](../../../docs/patterns/api-handler.md)
- [`docs/patterns/effect-runtime.md`](../../../docs/patterns/effect-runtime.md)

## High-Signal Files

- Contract boundaries: `packages/api/src/contracts/`
- Handler boundaries: `packages/api/src/server/router/`
- Use case boundaries: `packages/media/src/*/use-cases/`
- Repo boundaries and layering: `packages/media/src/*/repos/`
- Runtime/layer composition: `packages/api/src/server/runtime.ts`
- Telemetry lifecycle: `apps/server/src/server.ts`, `apps/worker/src/worker.ts`

## Guard Flow

1. Identify touched packages and layer boundaries.
2. Validate ownership rules and dependency direction.
3. Validate handler/use-case/repo separation.
4. Validate authn/authz placement and denial semantics.
5. Validate effect layer construction rules (`Layer.succeed/sync/effect`).
6. Validate observability expectations for changed use cases.

## Exception Protocol (ADR-lite)

If a change intentionally deviates from current standards:

1. Document the deviation in [`agent-engine/workflow-memory/guardrails.md`](../../../agent-engine/workflow-memory/guardrails.md).
2. Include:
   - context
   - decision
   - rationale
   - risks
   - sunset/reevaluation trigger
3. Add at least one enforcement follow-up (test, lint rule, docs rule, or skill update).

## Output Contract

Report in this order:

1. Blocking violations (must-fix)
2. Non-blocking risks
3. Approved deviations with rationale
4. Enforcement follow-ups

Each finding must include severity, file evidence, and suggested fix.

## Memory + Compounding

Record one event with workflow key `Architecture + ADR Guard` using `pnpm workflow-memory:add-entry` per [`agent-engine/workflow-memory/README.md`](../../../agent-engine/workflow-memory/README.md). Include the event `id` in output.
