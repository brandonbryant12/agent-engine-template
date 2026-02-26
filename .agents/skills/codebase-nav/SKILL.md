---
name: codebase-nav
description: Repository-specific navigation map for quickly locating chat surfaces, contracts, routes, tests, and integration points.
---

# Agent Engine Template Codebase Navigation

Use this when you need fast repo orientation before implementing, reviewing, or debugging.

## Surface Map

Primary product surfaces:

- `packages/ai/src/chat`
- `packages/ai/src/tts`
- `packages/api/src/contracts/{chat|events|runs}.ts`
- `packages/api/src/server/router/{chat|events|runs}.ts`
- `packages/db/src/schemas/{auth|jobs|brands|json|pagination|serialization}.ts`
- `apps/server/src`
- `apps/worker/src`
- `apps/web/src`

Backend layer paths:

- API contracts: `packages/api/src/contracts/`
- API routers + handlers: `packages/api/src/server/router/`
- API boundary runtime/helpers: `packages/api/src/server/`
- AI use cases + provider integrations: `packages/ai/src/`
- Queue producers/processors: `packages/queue/src/`
- DB schema + migrations: `packages/db/src/`, `packages/db/drizzle/`
- Shared test helpers/factories: `packages/testing/src/`

Frontend paths:

- Route tree + screens: `apps/web/src/router.tsx`, `apps/web/src/routeTree.gen.ts`, `apps/web/src/pages/`
- Shared UI + utilities: `apps/web/src/components/`, `apps/web/src/lib/`
- App shell/providers: `apps/web/src/main.tsx`

Cross-cutting paths:

- Query/API clients: `apps/web/src/clients/{api-client,auth-client}.ts`, `apps/web/src/query-client.ts`
- SSE client flows: `apps/web/src/pages/`, `apps/web/src/lib/` + `packages/api/src/contracts/events.ts`
- Invariants: `packages/api/src/server/__tests__/effect-handler.invariants.test.ts`, `packages/testing/src/__tests__/docs-invariants.test.ts`
- Docs source of truth: `docs/master-spec.md`, `docs/spec/generated/`

## Quick Lookup

1. Add or change an API operation:
   - `packages/api/src/contracts/*.ts` -> `packages/api/src/server/router/*.ts` -> router tests
2. Add or change a use case:
   - `packages/ai/src/{chat|tts}/use-cases/*.ts` -> use-case tests
3. Add run lifecycle behavior:
   - `packages/db/src/schemas/jobs.ts` -> `packages/queue/src/` -> `apps/worker/src/` -> SSE events in `packages/api/src/contracts/events.ts`
4. Add frontend data flow:
   - update route/view logic in `apps/web/src/router.tsx` -> supporting modules in `apps/web/src/pages/`, `apps/web/src/components/`, or `apps/web/src/lib/` -> tests
5. Fix invariant drift:
   - open invariant test file first, then follow the reported banned pattern path

## Navigation Flow

1. Identify the changed surface (web, api, ai, queue, worker, db).
2. Open corresponding layer files first from the surface map.
3. Confirm exact test targets before coding (`__tests__` and invariant files).
4. Use focused `rg` only after canonical paths are exhausted.

## Navigation Commands

Use fast path discovery before broad search:

```bash
rg --files packages/ai/src/{chat,tts}
rg --files packages/api/src/{contracts,server/router}
rg --files packages/db/src/{schemas,__tests__}
rg --files apps/web/src/{pages,components,lib,clients}
rg -n "createFileRoute\(|queryOptions\(|handleEffectWithProtocol\(" apps/web/src packages/api/src
```

## Output Contract

1. Paths checked (files/directories)
2. Exact edit/test target files selected
3. Any path ambiguity or missing canonical location

## Memory + Compounding

No standalone memory key for this support skill. Capture navigation findings in the parent core workflow event (`Feature Delivery`, `Architecture + ADR Guard`, `Docs + Knowledge Drift`, or `Periodic Scans`).
