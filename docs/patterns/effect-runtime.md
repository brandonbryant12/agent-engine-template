# Effect Runtime Pattern

## Shared Runtime

Build one runtime at server startup with shared layers:
- `Db`
- `Policy`
- `Queue`
- `Storage`
- `AI`

Per-request context (current user, request id) is added at handler execution time.

## Rules

- Do not instantiate new runtimes inside handlers.
- Keep runtime layer graph deterministic.
- Inject test layers in integration tests.
