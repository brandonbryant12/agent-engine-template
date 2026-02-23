---
name: code-simplifier
description: Simplifies recently modified code for clarity and maintainability while preserving exact behavior and enforcing Agent Engine Template docs/pattern guardrails.
---

# Code Simplifier

Use this skill after implementing or refactoring code when the goal is to improve readability, consistency, and maintainability without changing behavior.

## Standards To Anchor First

Before edits, load only docs relevant to the touched surface from [`docs/**/*.md`](../../../docs/).

- Backend/use cases/repos/runtime: [`docs/patterns/use-case.md`](../../../docs/patterns/use-case.md), [`docs/patterns/repository.md`](../../../docs/patterns/repository.md), [`docs/patterns/safety-primitives.md`](../../../docs/patterns/safety-primitives.md), [`docs/patterns/effect-runtime.md`](../../../docs/patterns/effect-runtime.md), [`docs/patterns/error-handling.md`](../../../docs/patterns/error-handling.md), [`docs/patterns/enum-constants.md`](../../../docs/patterns/enum-constants.md)
- API handlers/contracts: [`docs/patterns/api-handler.md`](../../../docs/patterns/api-handler.md)
- Frontend architecture/data/forms/styling/realtime: [`docs/frontend/project-structure.md`](../../../docs/frontend/project-structure.md), [`docs/frontend/components.md`](../../../docs/frontend/components.md), [`docs/frontend/data-fetching.md`](../../../docs/frontend/data-fetching.md), [`docs/frontend/mutations.md`](../../../docs/frontend/mutations.md), [`docs/frontend/forms.md`](../../../docs/frontend/forms.md), [`docs/frontend/error-handling.md`](../../../docs/frontend/error-handling.md), [`docs/frontend/styling.md`](../../../docs/frontend/styling.md), [`docs/frontend/real-time.md`](../../../docs/frontend/real-time.md)
- Testing expectations: [`docs/testing/overview.md`](../../../docs/testing/overview.md), [`docs/testing/use-case-tests.md`](../../../docs/testing/use-case-tests.md), [`docs/testing/integration-tests.md`](../../../docs/testing/integration-tests.md), [`docs/testing/job-workflow-tests.md`](../../../docs/testing/job-workflow-tests.md), [`docs/testing/invariants.md`](../../../docs/testing/invariants.md), [`docs/testing/live-tests.md`](../../../docs/testing/live-tests.md), [`docs/frontend/testing.md`](../../../docs/frontend/testing.md)
- Repo guardrails: [`AGENTS.md`](../../../AGENTS.md) and [`CLAUDE.md`](../../../CLAUDE.md)

If a simplification conflicts with standards docs, follow docs and keep the original code unchanged until the standard is clarified.

## Hard Constraints

1. Preserve exact runtime behavior and external contracts.
2. Limit scope to recently modified files/hunks unless the user asks for broader cleanup.
3. Prefer explicit, readable code over dense one-liners and nested ternaries.
4. Do not introduce unsafe casts at production boundaries.
5. Keep authz, sanitization, query key, retry, streaming-state, and telemetry guardrails intact.
6. Do not mix speculative architecture changes into simplification-only passes.
7. Run and pass baseline tests before simplification, then re-run the same tests after simplification.
8. If coverage is missing for simplified behavior, add only high-signal tests at the correct layer; no test slop.

## Simplification Flow

1. Identify recent changes with `git diff --name-only` (or provided file list).
2. Select the minimum relevant standards docs for those files.
3. Define the exact baseline test set for touched behavior and make sure it passes before edits.
4. Refine code for clarity:
   - reduce unnecessary nesting
   - remove redundant abstractions and dead branches
   - improve naming and local structure
   - keep component/use-case boundaries explicit
5. Re-run the same baseline tests to confirm unchanged behavior.
6. Evaluate test coverage for simplified paths; add minimal, meaningful tests only when gaps are real.
7. Expand validation only if the touched surface requires it.

## Coverage Gap Rules

- Add tests only when they protect behavior that could regress and is not already covered.
- Prefer the smallest useful test layer per [`docs/testing/overview.md`](../../../docs/testing/overview.md) (use-case, integration, invariant, frontend, e2e).
- Avoid snapshot churn tests, implementation-detail assertions, duplicate compile-time guarantees, or broad boilerplate cases.
- If a gap exists but a safe test cannot be added in scope, call it out explicitly in output.

## Validation Ladder

- Start targeted:
  - `pnpm --filter @repo/media test -- --run <file>`
  - `pnpm --filter @repo/api test -- --run <file>`
  - `pnpm --filter web test -- --run <file>`
- Then widen when applicable:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:invariants` for backend-impacting edits

## Output Contract

1. Files/hunks simplified
2. Standards docs used
3. Baseline tests run before edits + results
4. Same tests rerun after edits + results
5. Coverage gaps found and tests added (or explicit reason not added)
6. Behavior-preservation notes (what was intentionally unchanged)
7. Residual risks or follow-ups
8. Parent workflow memory evidence (workflow key + event `id`, or explicit defer reason + owner)

## Memory + Compounding

No standalone memory key for this support skill.

- Record simplification outcomes in the parent core workflow memory event (`Feature Delivery`, `Architecture + ADR Guard`, `Docs + Knowledge Drift`, `Self-Improvement`, or `Periodic Scans`) using `pnpm workflow-memory:add-entry`.
- Include the parent workflow + event `id` in final delivery notes.
- If memory logging is intentionally deferred, state the reason and who owns the follow-up.
