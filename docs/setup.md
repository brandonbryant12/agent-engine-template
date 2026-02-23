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

## Build-Script Policy Updates

When dependency changes introduce new install-time build scripts, refresh the
approved/ignored policy and commit the result:

```bash
pnpm install --no-frozen-lockfile
pnpm approve-builds
```

Commit updates to `pnpm-workspace.yaml` and `pnpm-lock.yaml` so clean checkouts
install deterministically without interactive build-script selection.

## Optional: Test Database

```bash
pnpm test:db:up
pnpm db:push:test
pnpm test
pnpm test:db:down
```
