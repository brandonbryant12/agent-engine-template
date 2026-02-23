# Job Queue Pattern

## Workflow

1. API enqueues `process-ai-run` jobs.
2. Worker claims pending jobs in FIFO order.
3. Worker updates status: `pending -> processing -> completed|failed`.
4. Worker periodically reaps stale `processing` jobs to `failed`.
5. Worker publishes SSE progress/completion events.

## Queue Safety Rules

- Claim atomically with `FOR UPDATE SKIP LOCKED`.
- Write terminal status on any failure path.
- `processNextJob` persists handler failures as `FAILED` jobs and returns the
  updated job row instead of surfacing handler failures in its error channel.
- Reap stale `processing` jobs on poll cadence and log checked/affected counts.
- Record timestamps for start/completion.
