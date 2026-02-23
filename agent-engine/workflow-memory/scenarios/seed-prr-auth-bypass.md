## Input

```typescript
import { eq } from "drizzle-orm";
import { db } from "../db";
import { projects } from "../schemas/projects";

export async function deleteProject(id: string) {
  await db.delete(projects).where(eq(projects.id, id));
  return { success: true };
}
```

## Expected Findings

- Missing ownership/authorization check before delete
- No role-based access control enforcement
- Destructive mutation path without caller verification

## Context

PR modifies `packages/api/src/server/router/projects.ts`.
The review skill should flag authorization bypass risk on mutations.
