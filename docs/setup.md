# Setup Guide

## Prerequisites

- Node.js >= 22.10.0
- pnpm 10.x (via `corepack`)
- Docker (Postgres + Redis)

## Local Bootstrap

```bash
corepack enable
pnpm install
pnpm env:copy-example
pnpm docker:up:minimal
pnpm db:push
pnpm dev
```

## Quality Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Optional: Test Database

```bash
pnpm test:db:up
pnpm db:push:test
pnpm test
pnpm test:db:down
```
