---
name: debug-fix
description: Test-driven procedure for reproducing, narrowing, fixing, and validating regressions in Agent Engine Template.
---

# Agent Engine Template Debug + Fix

Use this when tests fail, behavior regresses, or root cause is unclear.

## 1) Reproduce Exactly

Run the smallest failing target first.

- AI use case test:
  - `pnpm --filter @repo/ai test -- --run src/{chat|tts}/use-cases/__tests__/{action}.test.ts`
- API router integration/workflow test:
  - `pnpm --filter @repo/api test -- --run src/server/router/__tests__/{file}.test.ts`
- Web feature test:
  - `pnpm --filter web test -- --run src/features/{domain}/__tests__/{file}.test.tsx`
- Invariant test:
  - `pnpm test:invariants`

If router/workflow tests require DB state, run `pnpm test:db:setup` before retrying.

## 2) Narrow by Evidence

Extract the first concrete signal and follow it to source.

- Effect failures:
  - assert/read error `_tag` first, not message text
  - map tag to error class in `packages/ai/src/{chat,tts}/use-cases/errors.ts` or `packages/db/src/errors.ts`
- Runtime missing service issues:
  - check test runtime layering in `packages/api/src/server/router/__tests__/helpers.ts`
  - verify new services are present in runtime/layer assembly
- API contract mismatches:
  - compare `packages/api/src/contracts/*.ts` with router handler input/output use
- Frontend query/mutation mismatches:
  - verify query keys come from `queryOptions().queryKey` and hook wrappers under `apps/web/src/features/*/hooks/`
- Ownership/auth regressions:
  - verify ownership checks in use case before write/delete and ownership-scoped repo queries

## 3) Apply Minimal Fix

Change one behavior at a time.

1. Edit the narrowest file that explains the failure.
2. Re-run only the failing test file.
3. If still failing, repeat narrowing with the new first failing assertion.

Do not mix refactors with a bug fix unless the failing test requires it.

## 4) Expand Validation

After the focused test passes, widen in order:

1. Same package tests (`pnpm --filter @repo/{ai|api|web} test`)
2. `pnpm typecheck`
3. `pnpm test:invariants` for backend changes
4. `pnpm test` for cross-package confidence

## Common Failure Patterns

| Symptom | Likely Cause | First File to Check |
|---|---|---|
| `*_NotFound` unexpectedly | Fixture/factory did not create owned record | test file + `@repo/testing` factory usage |
| missing service/layer at runtime | Runtime not provided updated layer | `packages/api/src/server/router/__tests__/helpers.ts`, runtime layer assembly |
| contract type mismatch | Contract and handler/use case drifted | `packages/api/src/contracts/*.ts` + `packages/api/src/server/router/*.ts` |
| invariant failure | banned pattern reintroduced | invariant test file + referenced source file |
| web cache invalidation misses | hardcoded query key or wrong helper | feature hook + query key helper |
| MSW test never intercepts | handler method/path mismatch | feature `__tests__/handlers.ts` |

## Output Contract

1. Failing test path and exact reproduce command
2. Root cause (one sentence) with file evidence
3. Minimal fix path
4. Validation ladder run and results

## Memory + Compounding

No standalone memory key for this support skill. Record the failure signature and fix in the parent core workflow event (`Feature Delivery`, `Architecture + ADR Guard`, `Periodic Scans`, or `Self-Improvement`).
