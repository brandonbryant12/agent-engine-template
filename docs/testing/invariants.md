# Invariant Tests

Invariant tests enforce non-negotiable architecture rules that must not regress.
<!-- enforced-by: invariant-test -->

## Command

```bash
pnpm test:invariants
```

Required for all agent-authored backend changes.

## Current Invariants

### API Chat Handler Invariants
<!-- enforced-by: invariant-test -->

**File:** `packages/api/src/server/__tests__/chat-handler.invariants.test.ts`

| Rule | What It Prevents |
|---|---|
| Chat handlers use protocol + span helpers | Missing telemetry spans or protocol shaping |
| Chat routes avoid direct `runtime.runPromise` | Bypassing shared handler pipeline |
| Chat handlers define `api.chat.*` spans | Missing or inconsistent tracing |

### API Router Handler Invariants
<!-- enforced-by: invariant-test -->

**File:** `packages/api/src/server/__tests__/router-handler.invariants.test.ts`

| Rule | What It Prevents |
|---|---|
| Every handler router file must be covered by explicit invariant rules | Missing coverage when routers are added/renamed |
| No direct `runtime.runPromise` calls in handler routers | Bypassing shared protocol pipeline |
| No `@repo/db/schema` imports in handler routers unless allowlisted | API-to-DB boundary drift |
| Effect-backed handlers must use standardized helper pipeline | Inconsistent protocol mapping and telemetry behavior |
| Handler spans must use `api.*` naming, or explicit SSE exemption rationale | Missing/implicit observability contracts |

### Error Assertion Invariants
<!-- enforced-by: invariant-test -->

**File:** `packages/api/src/server/__tests__/error-assertions.invariants.test.ts`

| Rule | What It Prevents |
|---|---|
| `toBeInstanceOf(...)` is forbidden for tagged/backend errors (except allowlisted built-ins) | Incorrect error assertions masking regressions |

### API Error Mapping Invariants
<!-- enforced-by: invariant-test -->

**File:** `packages/api/src/server/__tests__/effect-handler.invariants.test.ts`

| Status Code | Required Mapping |
|---|---|
| `400` | `BAD_REQUEST` |
| `401` | `UNAUTHORIZED` |
| `403` | `FORBIDDEN` |
| `404` | `NOT_FOUND` |
| `409` | `CONFLICT` |
| `413` | `PAYLOAD_TOO_LARGE` |
| `415` | `UNSUPPORTED_MEDIA_TYPE` |
| `422` | `UNPROCESSABLE_CONTENT` |
| `429` | `RATE_LIMITED` |
| `502` | `SERVICE_UNAVAILABLE` |
| `503` | `SERVICE_UNAVAILABLE` |
| `504` | `SERVICE_UNAVAILABLE` |

### Invariant Docs Sync
<!-- enforced-by: invariant-test -->

**File:** `packages/testing/src/__tests__/docs-invariants.test.ts`

| Rule | What It Prevents |
|---|---|
| All `pnpm test:invariants` files must appear in this doc | Invariant-doc drift and missing documentation |
| `AGENTS.md` and `CLAUDE.md` must both include required safety commands (`pnpm scripts:lint`, skill sync, and strict skill checks) | Instruction-surface drift where one agent path can bypass script/skill guardrails |

## When to Update Invariants
<!-- enforced-by: manual-review -->

Update invariant tests when:
- Introducing a new safety primitive
- Banning a new raw pattern
- Changing error mapping behavior intentionally

Do not remove invariant assertions without replacing them with equivalent protection.
