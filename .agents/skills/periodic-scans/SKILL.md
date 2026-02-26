---
name: periodic-scans
description: Continuous and periodic quality scan workflow for Agent Engine Template. Use when running daily/weekly/release audits for correctness, performance, security, testing, and docs drift.
---

# Agent Engine Template Periodic Scans

Use this skill to run recurring repo scans and produce a prioritized backlog.

## Scan Cadence

## Per PR (continuous)

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:invariants` for backend changes
- `pnpm --filter web build` for frontend-impacting changes
- verify changed contracts/handlers align in `packages/api/src/contracts/` and `packages/api/src/server/router/`

## Daily

- Re-run failed suites from CI and triage root cause.
- Scan for docs/code drift in recently changed areas (`docs/`, `packages/`, `apps/`).
- Check top flaky tests and quarantine only with owner + follow-up issue.
- Run `pnpm workflow-memory:coverage` and flag workflows that appear missing for the current month.

## Weekly

- Cross-facet audit:
  - architecture boundary violations (`packages/api/src/server/router/` -> `packages/ai/src/{chat,tts}/use-cases/`)
  - authz gaps for mutating operations (`packages/api/src/server/router/`, `apps/server/src/`)
  - query key/invalidation safety (`apps/web/src/query-client.ts`, `apps/web/src/clients/`, `apps/web/src/lib/`)
  - frontend loading/error-state regressions (`apps/web/src/pages/`, `apps/web/src/components/`, `apps/web/src/router.tsx`)
  - performance regressions in route-level bundles and hot paths (`apps/web`, `apps/worker/src`, `packages/ai/src`)
  - security/dependency hygiene drift (`package.json`, `pnpm-lock.yaml`, `packages/*/package.json`)
  - agent-run/eval findings classified with `capability:*` and `failure:*` tags from [`agent-engine/workflow-memory/taxonomy.md`](../../../agent-engine/workflow-memory/taxonomy.md)
- Review agent-authored merges for repeat mistakes and guardrail gaps.
- Run `pnpm workflow-memory:coverage:strict`; if a missing workflow was run, add the missing memory event immediately.
- Run `pnpm skills:check:strict` if any skill files changed that week.

## Monthly or Release Train

- Full project spirit audit and standards refresh.
- Review telemetry and incident data for missed classes of bugs.
- Reprioritize quality backlog and update skill/docs guardrails.

## Required Output

Produce findings in this order:

1. Critical risks
2. High-impact quick wins
3. Medium/low improvements
4. Workflow memory coverage snapshot (covered workflows, missing workflows, follow-ups)
5. Proposed guardrail changes (tests, lint, docs, skills)

For every finding include:

- severity
- impact
- effort
- confidence
- file evidence

## Guardrail Rule

If the same failure pattern appears in 2+ merges, convert it into at least one:

- invariant test
- lint rule
- explicit docs rule
- skill checklist update

## Memory + Compounding

After each scan cycle, record one event with workflow key `Periodic Scans` using `pnpm workflow-memory:add-entry` per [`agent-engine/workflow-memory/README.md`](../../../agent-engine/workflow-memory/README.md).
If the scan includes memory findings, apply `memory-form:*`, `memory-function:*`, and `memory-dynamics:*` tags from [`agent-engine/workflow-memory/taxonomy.md`](../../../agent-engine/workflow-memory/taxonomy.md).
Include the event `id` in output.
