# Enum Constants Pattern

Use exported constant objects for runtime checks and schema literals for validation.

Example:

```ts
export const JobStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
```
