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
- Keep `Effect.runSync` calls at explicit transport/process boundaries only.

## Approved `Effect.runSync` Boundaries

- `packages/api/src/server/index.ts` inside oRPC `onError` interceptor.

`Effect.runSync` in worker or use-case internals is forbidden; compose and return `Effect` values instead.

## Layer Constructor Policy

- `Layer.succeed` is for pure object literals only.
- `Layer.sync` is for class/factory instantiation functions.
- `Layer.effect` is for constructors that depend on other Effect services.

## Guardrail Enforcement

- Invariant guard file:
  `packages/testing/src/__tests__/effect-layer-constructor.invariants.test.ts`
- Invocation path: `pnpm test:invariants` (wired in root `package.json`)
