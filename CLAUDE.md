# Agent Engine Template - Claude Code Instructions

## Read Docs First

`docs/` is authoritative for architecture and coding standards.

Recommended order:

1. [`docs/architecture/overview.md`](./docs/architecture/overview.md)
2. [`docs/patterns/use-case.md`](./docs/patterns/use-case.md)
3. [`docs/patterns/api-handler.md`](./docs/patterns/api-handler.md)
4. [`docs/frontend/project-structure.md`](./docs/frontend/project-structure.md)
5. [`docs/testing/overview.md`](./docs/testing/overview.md)

## Architecture Summary

- Backend: Effect TS use cases + Hono + oRPC handlers
- Data: Drizzle + PostgreSQL
- Auth: better-auth
- Async: queue + worker
- Frontend: React + TanStack Router/Query
- UI: shared `@repo/ui` package

## Repository Layout

```text
apps/{server,web,worker}
packages/{ai,api,auth,db,queue,storage,testing,ui}
tools/{eslint,prettier,tailwind,typescript}
agent-engine/{workflows,automations,workflow-memory}
```

## Workflow + Skills

- Workflow catalog: [`agent-engine/workflows/README.md`](./agent-engine/workflows/README.md)
- Workflow memory: [`agent-engine/workflow-memory/README.md`](./agent-engine/workflow-memory/README.md)
- Skills: `.agents/skills/`

## Quality Gates

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:invariants
pnpm build
pnpm scripts:lint
```

## After Skill Changes

```bash
agent-engine/scripts/sync-skills.sh
pnpm skills:check:strict
```

## Non-Negotiables

- Keep use-case/business logic out of handlers and repos.
- Keep contract input/output types as source of truth for APIs.
- Keep backend failures modeled as typed Effect errors.
- Keep tests aligned with docs and invariants.
