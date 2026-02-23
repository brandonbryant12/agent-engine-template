# Agent Engine Template - Agent Instructions

## Before Making Changes

Always search `docs/` before implementing. Use `docs/**/*.md` to find the relevant standard.

| Area | Docs |
|------|------|
| Architecture | [`docs/architecture/overview.md`](./docs/architecture/overview.md), [`docs/architecture/access-control.md`](./docs/architecture/access-control.md), [`docs/architecture/observability.md`](./docs/architecture/observability.md) |
| Backend patterns | [`docs/patterns/use-case.md`](./docs/patterns/use-case.md), [`docs/patterns/repository.md`](./docs/patterns/repository.md), [`docs/patterns/api-handler.md`](./docs/patterns/api-handler.md), [`docs/patterns/error-handling.md`](./docs/patterns/error-handling.md), [`docs/patterns/job-queue.md`](./docs/patterns/job-queue.md) |
| Frontend | [`docs/frontend/project-structure.md`](./docs/frontend/project-structure.md), [`docs/frontend/data-fetching.md`](./docs/frontend/data-fetching.md), [`docs/frontend/components.md`](./docs/frontend/components.md), [`docs/frontend/testing.md`](./docs/frontend/testing.md) |
| Testing | [`docs/testing/overview.md`](./docs/testing/overview.md), [`docs/testing/use-case-tests.md`](./docs/testing/use-case-tests.md), [`docs/testing/integration-tests.md`](./docs/testing/integration-tests.md), [`docs/testing/invariants.md`](./docs/testing/invariants.md) |

## Project Structure

```text
apps/
  server/          # Hono HTTP server
  web/             # React SPA (Vite + TanStack Router)
  worker/          # Background worker
packages/
  ai/              # AI provider integrations
  api/             # oRPC contracts/router/handlers
  auth/            # better-auth integration
  db/              # Drizzle schema + migrations
  queue/           # Queue abstraction and processors
  storage/         # Storage providers
  testing/         # Shared test utilities
  ui/              # Shared UI system
```

## Stack

- Monorepo: pnpm workspaces + Turborepo
- Backend: Effect TS + Hono + oRPC + Drizzle
- Frontend: React + TanStack Router/Query + Tailwind/Radix
- Auth: better-auth
- Testing: Vitest + Playwright

## Agent Engine

- Follow [`agent-engine/workflows/README.md`](./agent-engine/workflows/README.md)
- Use workflow memory in [`agent-engine/workflow-memory/`](./agent-engine/workflow-memory/)
- Canonical skills live in `.agents/skills/`
- Keep `.agent/skills`, `.claude/skills`, `.github/skills` as mirrors of `.agents/skills`

After skill changes:

```bash
agent-engine/scripts/sync-skills.sh
pnpm skills:check:strict
```

## Validation

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:invariants
pnpm build
pnpm scripts:lint
```

## Guardrails

- Keep API boundaries strict: contracts -> handlers -> use cases -> repos.
- Keep Effect errors typed and asserted by `_tag` in backend tests.
- Avoid hardcoded TanStack query keys; use exported key helpers.
- Keep router/query freshness rules explicit when preloading routes.
- Initialize telemetry in server/worker startup and shut down gracefully.

## Effect Layer Rules

- `Layer.succeed` for pure object literals only.
- `Layer.sync` for class/factory instantiation.
- `Layer.effect` when construction depends on other Effect services.

See [`docs/patterns/effect-runtime.md`](./docs/patterns/effect-runtime.md).
