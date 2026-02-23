---
name: docs-knowledge-drift
description: Docs/code drift workflow to keep architecture, patterns, testing, and workflow guidance aligned with repository reality.
---

# Agent Engine Template Docs + Knowledge Drift

Use this skill after behavior changes, during weekly scans, and before releases.

Primary anchors: `agent-engine/workflows/README.md`, `docs/README.md`, `docs/master-spec.md`.

## Drift Targets

- architecture and boundary docs
- backend and frontend pattern docs
- testing strategy docs and matrices
- workflow/skill documentation
- onboarding/setup instructions

## Drift Flow

1. Identify changed behavior and affected docs paths.
2. Verify docs still match current code semantics.
3. Update docs where behavior changed or guidance is ambiguous.
4. Remove stale guidance and dead links.
5. Confirm cross-doc consistency ([`AGENTS.md`](../../../AGENTS.md), [`CLAUDE.md`](../../../CLAUDE.md), [`agent-engine/workflows/README.md`](../../../agent-engine/workflows/README.md)).

## Output Contract

1. Critical doc drift (misleading or unsafe)
2. Important updates (behavior mismatch)
3. Quality improvements (clarity, examples, discoverability)
4. Follow-up docs backlog

Each item includes file evidence and confidence.

## Memory + Compounding

Record one event with workflow key `Docs + Knowledge Drift` using `pnpm workflow-memory:add-entry` per [`agent-engine/workflow-memory/README.md`](../../../agent-engine/workflow-memory/README.md). Include the event `id` in output.
