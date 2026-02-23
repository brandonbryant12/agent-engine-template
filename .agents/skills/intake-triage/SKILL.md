---
name: intake-triage
description: Intake and scoping workflow for turning requests into clear slices, acceptance criteria, and risk flags before implementation.
---

# Template App Intake + Triage

Use this skill at the start of every feature, refactor, bugfix, or operational change.

## Objectives

- Convert requests into implementable scope with explicit acceptance criteria.
- Anchor scope to standards in [`docs/**/*.md`](../../../docs/) before coding (for example `agent-engine/workflows/README.md` and `docs/master-spec.md`).
- Surface risk and uncertainty early so downstream workflows are predictable.

## Intake Steps

1. Classify request type:
   - feature
   - bug
   - refactor
   - operational change
2. Read only relevant standards docs for the requested surface.
3. Define 1-3 vertical slices with user-visible outcomes.
4. Write acceptance criteria per slice:
   - behavior
   - edge cases
   - error semantics
   - observability/test evidence required
5. Mark explicit out-of-scope items.
6. Flag risks and required guardrails.

## Required Risk Flags

- authorization/ownership changes on existing resources
- user-editable structured data or prompt composition
- queue/worker state transitions
- streaming/real-time contract changes
- query invalidation/caching behavior
- package-boundary or architecture-layer changes
- schema migration/data backfill/release coupling

## Handoff Output Contract

Produce this before implementation starts:

1. Request summary (problem and expected outcome)
2. Vertical slices with acceptance criteria
3. Test intent by slice
4. Guardrails/docs likely to change
5. Open questions and assumptions
6. Memory event id after triage note is persisted

## Memory + Compounding

`Intake + Triage` is a utility skill. Record memory under the parent core workflow key:
- `Feature Delivery` for standard product/code delivery intake
- `Architecture + ADR Guard` for architecture-governed intake
- `Self-Improvement` for guardrail/process improvement intake

Use `pnpm workflow-memory:add-entry` per [`agent-engine/workflow-memory/README.md`](../../../agent-engine/workflow-memory/README.md) and include the event `id` in output.

## Definition Of Done

- Scope is clear enough to implement without hidden assumptions.
- Test intent exists before coding.
- Relevant docs are referenced explicitly.
- Top risks and ownership are explicit.
