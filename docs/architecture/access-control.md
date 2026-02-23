# Access Control

## Policy Rules

- All mutating routes require authenticated users.
- User-scoped data must be queried by `createdBy`/owner identity.
- Background runs are visible only to the owning user.

## API Rules

- Public routes: sign-in/sign-up/session bootstrap only.
- Protected routes: chat streams, run create/list, SSE subscription.

## Failure Modes

- Unauthenticated -> `UNAUTHORIZED` (401)
- Authenticated but disallowed -> `FORBIDDEN` (403)
