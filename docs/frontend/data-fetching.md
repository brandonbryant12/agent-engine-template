# Data Fetching

## Rules

1. Use typed oRPC clients from `@repo/api/client`.
2. Route loaders prefetch required data where useful.
3. Use React Query for cached request lifecycle.
4. Use SSE events to refresh run state.

## Query Defaults

Configure globally in `query-client.ts`.
