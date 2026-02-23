---
name: release-incident-response
description: Release readiness, canary/rollback, and incident response workflow with post-incident guardrail hardening.
---

# Template App Release + Incident Response

Use this skill for release trains, hotfixes, and production incidents.

## Release Readiness Flow

1. Confirm release scope and risk profile.
2. Run required validation gates for affected surfaces:
   - backend/API: `pnpm --filter @repo/api test`, `pnpm --filter @repo/media test`
   - frontend: `pnpm --filter web test`, `pnpm --filter web build`
3. Verify migration/backfill and rollback compatibility across `packages/db/src/`, `apps/server/src/`, and `apps/worker/src/`.
4. Define canary checks and stop/rollback triggers.
5. Publish release notes with known risks.

## Incident Flow

1. Triage severity and user impact.
2. Stabilize first (rollback, feature flag, hotfix).
3. Identify root cause with evidence from changed files and failing tests in `packages/*/src/**/__tests__/` or `apps/web/src/**/__tests__/`.
4. Patch and validate in the narrowest layer first (`packages/media/src/*/use-cases/`, `packages/api/src/server/router/`, or `apps/web/src/features/`).
5. Run self-improvement loop to prevent recurrence.

## Rollback Triggers (Examples)

- repeated critical API failures
- auth/security regression
- queue/job failure spike with user-visible impact
- severe latency regression on core workflows

## Output Contract

1. Release decision (go/no-go)
2. Active risks and mitigations
3. Rollback plan and trigger thresholds
4. Incident postmortem summary (when applicable)
5. Required guardrail changes and owners

## Memory + Compounding

`Release + Incident Response` is a utility skill. Record memory under the parent core workflow key (`Feature Delivery`, `Periodic Scans`, or `Self-Improvement`) using `pnpm workflow-memory:add-entry` per [`agent-engine/workflow-memory/README.md`](../../../agent-engine/workflow-memory/README.md). Include the event `id` in output.
