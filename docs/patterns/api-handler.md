# API Handler Pattern

Handlers compose: input -> use-case -> serializer -> protocol error mapping.

## Canonical Pipeline

```ts
return handleEffectWithProtocol(
  context.runtime,
  context.user,
  listRuns({ userId: context.user.id, limit: input.limit }).pipe(
    Effect.flatMap(serializeRunsEffect),
  ),
  errors,
  { span: 'api.runs.list' },
);
```

## Rules

1. Keep handler thin.
2. Use one primary use-case per handler.
3. Always provide a span name.
4. Let protocol-aware errors map to oRPC responses.
