## Input

```typescript
import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { projects } from "../schemas/projects";
import { requireOwnership } from "../shared/authorization";
import { getCurrentUser } from "../shared/context";

export const deleteProject = (projectId: string) =>
  Effect.gen(function* () {
    const user = yield* getCurrentUser;

    const project = yield* Effect.tryPromise(() =>
      db.query.projects.findFirst({ where: eq(projects.id, projectId) })
    );

    if (!project) {
      return yield* Effect.fail(new ProjectNotFoundError({ projectId }));
    }

    yield* requireOwnership(project.ownerId, user.id);

    yield* Effect.tryPromise(() =>
      db.delete(projects).where(eq(projects.id, projectId))
    );

    return { success: true };
  });
```

## Expected Findings

- No security issues expected
- Ownership check enforced before delete
- Current user derived from request context
- Query builder used instead of raw SQL

## Context

PR modifies `packages/domain/src/project/use-cases/delete-project.ts`.
This is a clean pass scenario for risk-review false-positive control.
