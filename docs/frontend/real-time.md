# Real-Time Updates

SSE channel publishes run lifecycle events:
- `connected`
- `run_queued`
- `run_started`
- `run_progress`
- `run_completed`
- `run_failed`

Web clients reconcile these events into run state and keep UI in sync without polling.
