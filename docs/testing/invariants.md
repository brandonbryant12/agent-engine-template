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
| `409` | `CONFLICT` |
| `502` | `SERVICE_UNAVAILABLE` |
| `422` | `UNPROCESSABLE_CONTENT` |

### Invariant Docs Sync
<!-- enforced-by: invariant-test -->

**File:** `packages/testing/src/__tests__/docs-invariants.test.ts`

| Rule | What It Prevents |
|---|---|
| All `pnpm test:invariants` files must appear in this doc | Invariant-doc drift and missing documentation |

## When to Update Invariants
<!-- enforced-by: manual-review -->

Update invariant tests when:
- Introducing a new safety primitive
- Banning a new raw pattern
- Changing error mapping behavior intentionally

Do not remove invariant assertions without replacing them with equivalent protection.
