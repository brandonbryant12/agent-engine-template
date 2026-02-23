# Agent Engine Template

`agent-engine-template` is a production-ready monorepo starter for building AI-powered apps with a built-in agent workflow system.

It combines a modern full-stack TypeScript architecture with Agent Engine conventions so teams can ship features, run automations, and keep workflow memory/audit trails in one place.

## Tech Stack

### Core Platform

- Monorepo: `pnpm` workspaces + `Turborepo`
- Language/runtime: TypeScript + Node.js
- Backend: Effect TS + Hono + oRPC
- Database: PostgreSQL + Drizzle ORM
- Queue/Workers: Redis-backed async job processing
- Auth: better-auth
- Frontend: React + Vite + TanStack Router + TanStack Query
- UI: Tailwind + Radix + shared component package
- Testing: Vitest + Playwright

### AI + Infra Packages

- `packages/ai`: LLM, chat, TTS, provider integrations
- `packages/api`: typed contracts, handlers, server router
- `packages/db`: schemas, migrations, typed DB access
- `packages/queue`: job queue interfaces and processors
- `packages/storage`: object storage abstraction/providers
- `packages/testing`: reusable test helpers and fixtures

## Agent Engine

Agent Engine provides a structured operating model for autonomous and assisted development work:

- Workflow definitions and routing in `agent-engine/workflows/`
- Automation playbooks in `agent-engine/automations/`
- Skill registry and sync process via `.agents/skills/`
- Workflow memory capture in `agent-engine/workflow-memory/`
- Tooling for quality/coverage/replay in `agent-engine/scripts/`

This gives you:

- repeatable implementation and review workflows
- explicit guardrails and standards enforcement
- historical memory of decisions, findings, and follow-ups
- a scalable foundation for multi-agent engineering operations

## Repository Layout

```text
apps/
  server/          # Hono API server
  web/             # React web app
  worker/          # background job worker
packages/
  ai/
  api/
  auth/
  db/
  queue/
  storage/
  testing/
  ui/
agent-engine/
  workflows/
  automations/
  workflow-memory/
tools/
  eslint/
  prettier/
  tailwind/
  typescript/
```

## Quick Start

```bash
corepack enable
pnpm install
pnpm env:copy-example
pnpm docker:up:minimal
pnpm db:push
pnpm dev
```

## Common Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:invariants
pnpm build
pnpm scripts:lint
pnpm spec:generate
pnpm skills:check:strict
```

## CI Contract

The canonical repository CI contract lives at
`.github/workflows/ci.yml`.

For every PR to `main`, CI pins Node (`22.10.0`), installs with
`pnpm install --frozen-lockfile`, and runs:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:invariants`
- `pnpm build`
- `pnpm scripts:lint`

## Ready-for-Dev Loop Runner

Continuously poll open issues labeled `ready-for-dev`, run one Codex
`ready-for-dev-executor` cycle when available, and sleep 5 minutes when idle.

```bash
pnpm ready-for-dev:loop
```

Behavior:
- Runs Codex in an external state directory (`~/.cache/...`) using throwaway git worktrees.
- Keeps the primary checkout clean by avoiding implementation work in the main repo directory.
- Writes per-run logs under `~/.cache/agent-engine-template/ready-for-dev-loop/logs`.

Optional environment overrides:
- `READY_FOR_DEV_POLL_SECONDS` (default `300`)
- `READY_FOR_DEV_STATE_DIR`
- `READY_FOR_DEV_LABEL` (default `ready-for-dev`)
- `READY_FOR_DEV_MODEL` (default `gpt-5.3-codex`)
- `READY_FOR_DEV_REMOTE_URL` (defaults to `origin` URL from the current repo)

## Using It As a Template

1. Create a new repo from this template.
2. Rename package/repo identifiers for your project.
3. Replace `docs/master-spec.md` with product-specific behavior.
4. Add or customize workflows/automations/skills under `agent-engine/`.
