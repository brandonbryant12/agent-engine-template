## Input

```typescript
import { db } from "../db";

export async function searchUsers(query: string) {
  const results = await db.execute(
    `SELECT * FROM users WHERE name LIKE '%${query}%' OR email LIKE '%${query}%'`
  );

  return results.rows;
}
```

## Expected Findings

- Raw string interpolation enables SQL injection
- Untrusted input concatenated directly into SQL
- Must use parameterized SQL or query-builder APIs

## Context

PR adds search to an admin surface.
The review skill should flag injection risk as high severity.
