# Agent Engine Template Master Specification

This document is the behavior source of truth for repositories created from this template.

## Purpose

Provide a clear, testable contract for:

- product behavior
- API boundaries
- background processing guarantees
- authentication/authorization expectations
- frontend interaction patterns

## Current Template Scope

The template ships with example features to demonstrate architecture patterns.

- authenticated AI chat workflow with threaded conversation state
- streaming assistant responses over a typed chat transport
- asynchronous run processing with worker callbacks and SSE progress events
- typed API contract flow (contract -> handler -> use case -> repo)

## Required Specs For New Projects

When bootstrapping a new product, replace this file with project-specific sections:

1. Domain model and entity definitions
2. User journeys and acceptance criteria
3. API contract behavior (inputs, outputs, errors)
4. Async jobs and retries
5. Authorization matrix
6. Observability and audit requirements

## Template Acceptance Criteria

Until replaced, this baseline should hold:

1. All mutating operations require authenticated user context.
2. Use cases own business logic and authorization checks.
3. Repositories are data access only.
4. Every async job has explicit status transitions and failure handling.
5. API errors map from typed Effect errors to stable protocol errors.
6. UI follows TanStack Router + Query patterns for chat, runs, and stream state.

## Quality Gates

Template changes must pass:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:invariants`
- `pnpm build`

## Generated Snapshot

The sections below are machine-generated from the current codebase and should be refreshed with:

```bash
pnpm spec:generate
```

### Snapshot Metadata

<!-- BEGIN GENERATED:snapshot-metadata -->
# Snapshot Metadata (Generated)

- Generated at: 2026-02-26T15:32:24.665Z
- Git branch: codex/ready-for-dev-75-202602261025
- Git commit: 3daab14

## Inventory

- API endpoints: 5
- API tags: 3
- Domains: 2
- Use cases: 5
- Database tables: 5
- Database enums: 1
- UI routes: 3
- UI modules: 10

## Generated Files

- `docs/spec/generated/openapi.json`
- `docs/spec/generated/api-surface.md`
- `docs/spec/generated/domain-surface.md`
- `docs/spec/generated/data-model.md`
- `docs/spec/generated/ui-surface.md`
<!-- END GENERATED:snapshot-metadata -->

### API Surface

<!-- BEGIN GENERATED:api-surface -->
# API Contract Surface (Generated)

- Endpoints: 5
- Tags: chat, events, runs

| Method | Path | Operation ID | Tags | Streaming | Summary |
|---|---|---|---|---|---|
| POST | /chat/general | chat.general | chat | yes |  |
| POST | /chat/tools/weather/current | chat.weatherCurrent | chat | no |  |
| GET | /events/ | events.subscribe | events | yes |  |
| GET | /runs/ | runs.list | runs | no | List runs |
| POST | /runs/ | runs.create | runs | no | Create run |
<!-- END GENERATED:api-surface -->

### Domain Surface

<!-- BEGIN GENERATED:domain-surface -->
# Domain Capability Surface (Generated)

- Domains: 2
- Exported use cases: 5

| Domain | Use Cases | API Endpoints |
|---|---|---|
| chat | 1 | 2 |
| tts | 4 | n/a |

## Use Cases by Domain

### chat

- `stream-general-chat`

### tts

- `errors`
- `list-voices`
- `list-voices-with-previews`
- `preview-voice`
<!-- END GENERATED:domain-surface -->

### Data Model Surface

<!-- BEGIN GENERATED:data-model -->
# Data Model Surface (Generated)

- Tables: 5
- Enums: 1

## Tables

| Table | Symbol | Source |
|---|---|---|
| account | `account` | `packages/db/src/schemas/auth.ts` |
| job | `job` | `packages/db/src/schemas/jobs.ts` |
| session | `session` | `packages/db/src/schemas/auth.ts` |
| user | `user` | `packages/db/src/schemas/auth.ts` |
| verification | `verification` | `packages/db/src/schemas/auth.ts` |

## Enums

| Enum | Symbol | Values | Source |
|---|---|---|---|
| job_status | `jobStatusEnum` | pending, processing, completed, failed | `packages/db/src/schemas/jobs.ts` |
<!-- END GENERATED:data-model -->

### UI Surface

<!-- BEGIN GENERATED:ui-surface -->
# UI Surface (Generated)

- Routes: 3
- UI modules: 10

## Routes

| Path | Access |
|---|---|
| / | public |
| /chat | protected |
| /jobs | protected |

## UI Modules

- `components/app-shell`
- `components/auth-gate`
- `components/logo`
- `components/weather-tool-panel`
- `lib/chat-utils`
- `lib/run-utils`
- `lib/weather-tool`
- `pages/chat`
- `pages/dashboard`
- `pages/jobs`
<!-- END GENERATED:ui-surface -->
