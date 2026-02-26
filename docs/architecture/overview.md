# Architecture Overview

## Runtime Model

- `apps/web`: React + TanStack Router + Query
- `apps/server`: Hono + oRPC API boundary
- `apps/worker`: background run processor
- shared packages: `api`, `auth`, `db`, `queue`, `ai`, `storage`

## Core Flow

1. User sends chat prompt from web.
2. Server streams assistant output for interactive chat.
3. User can queue background run for async processing.
4. Worker processes job and publishes SSE events.
5. Web updates run state in real time.

## Boundaries

- Contracts in `packages/api/src/contracts`
- Handler pipeline in `packages/api/src/server`
- Persistence in `packages/db` and `packages/queue`
- Auth in `packages/auth`
- AI tool authoring standard in `docs/architecture/ai-sdk-tooling-standard.md`
- Rate-limit identity derivation in `docs/architecture/rate-limit-identity.md`
