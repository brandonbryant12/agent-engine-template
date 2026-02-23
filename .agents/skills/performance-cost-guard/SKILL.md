---
name: performance-cost-guard
description: Performance and cost regression workflow for frontend bundles, backend hot paths, CI runtime, and AI/provider spend.
---

# Template App Performance + Cost Guard

Use this skill for performance-sensitive changes, weekly quality scans, and release readiness checks.

## Performance + Cost Surfaces

- route-level frontend bundles and load behavior in `apps/web/src/router.tsx` and `apps/web/src/features/`
- backend hot paths and job throughput in `packages/ai/src/{chat,tts}/use-cases/` and `apps/worker/src/`
- CI/test runtime and build time via `package.json` scripts and affected package test folders
- AI/provider usage patterns and token/call cost in `packages/ai/src/` and provider call sites

## Guard Flow

1. Establish baseline from recent known-good runs.
2. Compare current change impact:
   - `pnpm --filter web build` output for bundle drift
   - targeted timings for changed tests in `packages/*/src/**/__tests__/`
   - telemetry trend snapshots for hot use cases/jobs in `apps/server/src/` and `apps/worker/src/`
3. Flag regressions with practical thresholds and user impact.
4. Recommend fixes prioritized by impact-to-effort.
5. Record whether regression is blocked, accepted, or deferred.

## Output Contract

1. Blocking regressions
2. Non-blocking regressions
3. Optimization quick wins
4. Deferred opportunities with rationale

Include evidence source, confidence, and expected gain.

## Memory + Compounding

`Performance + Cost Guard` is a utility skill. Record memory under the parent core workflow key (`Periodic Scans`, `Feature Delivery`, or `Self-Improvement`) using `pnpm workflow-memory:add-entry` per [`agent-engine/workflow-memory/README.md`](../../../agent-engine/workflow-memory/README.md). Include the event `id` in output.
