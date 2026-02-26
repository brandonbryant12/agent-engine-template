# AI Tooling Pattern

This repository standardizes AI SDK tools with a registry-first contract.

## Registry Contract

Each tool entry must declare:

- `id`
- immutable `contractVersion`
- `authMode`
- `rolePolicy`
- `egressPolicy` (allowlisted hosts only)
- `dataClassification`
- `ownerDomain`
- enabled execution channels

Tool metadata is defined in `packages/ai/src/tools/registry.ts`.

## Adapter Contract

Tool adapters:

- contain no product business logic beyond the tool boundary
- validate and normalize input before network egress
- enforce authn/authz as final gate
- fail closed on provider schema drift
- map failures to typed `_tag` errors and stable remediation copy

Weather adapter reference implementation:

- `packages/ai/src/tools/weather.ts`
- `packages/ai/src/errors.ts` (`WeatherTool*Error` + remediation mapping)

## Runtime + Observability

Tool spans annotate:

- `tool.id`
- `tool.version`
- `tool.provider.host`

Preflight denials (`UnauthorizedError`, `ForbiddenError`, `ValidationError`) short-circuit before outbound requests.
