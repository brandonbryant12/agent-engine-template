# Langfuse — LLM Observability

[Langfuse](https://langfuse.com) provides centralized observability for all LLM
traces produced by automation playbooks. It complements the local trace files
used by the workflow-memory / GEPA optimization pipeline.

## Quick Start

### 1. Start Langfuse

Langfuse runs as an optional Docker Compose profile — the core stack works
without it.

```bash
# Start everything including Langfuse
docker compose --profile langfuse up -d

# Or start Langfuse alongside the existing stack
docker compose --profile langfuse up -d langfuse langfuse-worker \
  langfuse-db langfuse-redis langfuse-clickhouse langfuse-minio
```

Langfuse UI: **http://localhost:3100**

### 2. Create an Account

On first visit, Langfuse shows a sign-up page. Create an account (all local,
nothing leaves your machine).

### 3. Create API Keys

1. Log in → **Settings** → **API Keys**
2. Create a new key pair
3. Copy the **Public Key** and **Secret Key**

### 4. Configure Environment

Add to your `.env` (or export in your shell):

```bash
LANGFUSE_HOST=http://localhost:3100
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

For Docker services that need to reach Langfuse internally, use
`LANGFUSE_HOST=http://langfuse:3000`.

### 5. Headless Init (Optional)

To auto-create an org, project, and user on first boot (no manual signup), set
these in `.env`:

```bash
LANGFUSE_INIT_ORG_NAME=my-org
LANGFUSE_INIT_PROJECT_NAME=agent-engine
LANGFUSE_INIT_PROJECT_PUBLIC_KEY=pk-lf-local
LANGFUSE_INIT_PROJECT_SECRET_KEY=sk-lf-local
LANGFUSE_INIT_USER_EMAIL=admin@local.dev
LANGFUSE_INIT_USER_NAME=admin
LANGFUSE_INIT_USER_PASSWORD=admin123
```

Then set `LANGFUSE_PUBLIC_KEY=pk-lf-local` and `LANGFUSE_SECRET_KEY=sk-lf-local`
to match.

## How Traces Flow

```
Automation Run
  ├── Local trace file (traces/data/*.trace.json)  — for GEPA optimization
  └── Langfuse API (send-trace.sh)                 — for dashboard/monitoring
        ├── Trace (name, input, output, metadata)
        ├── Generation span (model, tokens, latency)
        └── Score (overall quality rating)

Trace Evaluator (later)
  └── Langfuse Score annotation on original trace  — feedback loop
```

## What You See in the Dashboard

- **Traces list**: Every automation run with input/output, duration, scores
- **Generations**: LLM calls with model, token counts, cost estimates
- **Scores**: Quality ratings from the trace-evaluator, filterable by automation
- **Metrics**: Cost over time, latency percentiles, score distributions
- **Filter by tags**: Playbook name, version, run ID

## Sending Traces Manually

```bash
agent-engine/scripts/langfuse/send-trace.sh \
  --playbook best-practice-researcher \
  --run-id "run-20260224-001" \
  --model "gpt-5.3-codex" \
  --input '{"task":"scan for improvements"}' \
  --output '{"raw":"Found 3 recommendations..."}' \
  --score 0.82 \
  --tokens-prompt 12000 \
  --tokens-completion 3500 \
  --latency-ms 45000
```

## Connection to GEPA Optimization Roadmap

Langfuse serves **Phase 2** of the optimization roadmap (trace analysis tooling).
While local trace files are the primary input to DSPy/GEPA optimizers, Langfuse
provides the visual layer for:

- Identifying low-scoring automations that need optimization
- Tracking quality improvement after playbook updates
- Monitoring cost and latency trends across versions
- Comparing A/B test results between original and optimized playbooks

## Architecture

The Langfuse profile adds these services (all isolated from the core stack):

| Service | Purpose | Port |
|---------|---------|------|
| `langfuse` | Web UI + API | 3100 |
| `langfuse-worker` | Background processing | 3030 (internal) |
| `langfuse-db` | PostgreSQL for Langfuse | 5433 (internal) |
| `langfuse-redis` | Redis for Langfuse | 6380 (internal) |
| `langfuse-clickhouse` | Analytics storage | 8123 (internal) |
| `langfuse-minio` | Blob/event storage | 9092 (internal) |

All services use Docker Compose profiles — they don't start unless you
explicitly request the `langfuse` profile.

## Troubleshooting

- **Langfuse won't start**: Check `docker compose --profile langfuse logs langfuse` for errors
- **Can't reach UI**: Ensure port 3100 isn't in use; check `langfuse` container health
- **Traces not appearing**: Verify API keys match; check `send-trace.sh` stderr output
- **High disk usage**: ClickHouse stores analytics data; prune with `docker volume rm langfuse_clickhouse_data`
