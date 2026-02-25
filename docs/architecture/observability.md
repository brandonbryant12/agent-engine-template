# Observability

## Span Naming

- API handlers: `api.{domain}.{action}`
- Queue operations: `queue.{action}`
- Serializers: `serialize.{entity}`

## Required Attributes

- `request.id` for API spans
- `enduser.id` for authenticated API spans
- `queue.job.id` for queue transitions

## Error Logging

Use protocol-aware logging levels from error classes:
- `silent`
- `warn`
- `error`
- `error-with-stack`

## Runtime Lifecycle Contract

Server and worker entrypoints must preserve telemetry lifecycle and graceful-shutdown semantics:
- Initialize telemetry at startup with `initTelemetry(...)`.
- Register `SIGINT` and `SIGTERM` handlers that execute graceful cleanup.
- Call `shutdownTelemetry()` during graceful shutdown.
- Exit with non-zero status when any graceful-shutdown cleanup step fails.

This contract is enforced by invariants in:
- `packages/testing/src/__tests__/telemetry-lifecycle.invariants.test.ts`
