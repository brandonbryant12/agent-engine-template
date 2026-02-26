# AI SDK Tooling Standard (v1)

This standard defines how AI tools are authored in this repository.

## Required Boundaries

- Contracts live in `packages/api/src/contracts`.
- Handlers stay protocol-focused in `packages/api/src/server/router`.
- Tool business logic stays in `packages/ai/src/chat/tools` adapters.
- Provider egress logic stays in provider modules (for example weather provider).

## Registry Contract

Tool registry metadata is required for each tool:

- `id`
- immutable `contractVersion`
- `authMode`
- `rolePolicy`
- `egressPolicy`
- `dataClassification`
- ownership domain label
- runtime enablement by execution context

Current reference entry: `weather.current@1.0.0` in
`packages/ai/src/chat/tools/registry.ts`.

## Adapter Contract

Tool adapters must:

- perform input validation and return typed errors
- enforce final authz gate (defense in depth with registry policy)
- short-circuit preflight denials before provider egress
- normalize provider payloads to strict internal shape
- fail closed on malformed/drifted provider payloads

## Invocation Lifecycle Contract

Canonical lifecycle states for UI:

- `idle`
- `validating`
- `running`
- `succeeded`
- `failed`
- `timed_out`
- `cancelled`
- `retrying`

UI mappings live in `apps/web/src/lib/weather-tool.ts`.

## Observability + Privacy Contract

Tool spans must include:

- `request.id`
- `enduser.id`
- `tool.id`
- `tool.version`
- terminal error tag when failed

Sensitive payload fields must not be logged. Tool errors expose stable `errorTag`
values for user remediation mapping without leaking provider payloads.
