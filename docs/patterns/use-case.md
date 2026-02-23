# Use Case Pattern

Use-cases contain business behavior and authorization decisions.

## Rules

1. One behavior per use-case.
2. Depend on interfaces/services, not frameworks.
3. Return typed errors (never throw raw strings).
4. Keep IO in repository/provider layers.

## Example Shape

```ts
export const createRun = (input: CreateRunInput) =>
  Effect.gen(function* () {
    const queue = yield* Queue;
    const policy = yield* Policy;

    yield* policy.requireUser(input.user);

    return yield* queue.enqueue(
      JobType.PROCESS_AI_RUN,
      { prompt: input.prompt, userId: input.user.id },
      input.user.id,
    );
  });
```
