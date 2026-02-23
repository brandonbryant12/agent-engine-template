# Job Queue Pattern

## Workflow

1. API enqueues `process-ai-run` jobs.
2. Worker claims pending jobs in FIFO order.
3. Worker updates status: `pending -> processing -> completed|failed`.
4. Worker publishes SSE progress/completion events.

## Queue Safety Rules

- Claim atomically with `FOR UPDATE SKIP LOCKED`.
- Write terminal status on any failure path.
- Record timestamps for start/completion.
