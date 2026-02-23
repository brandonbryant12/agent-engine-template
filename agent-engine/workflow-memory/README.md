# Workflow Memory System

This directory is the durable workflow memory system for the repository.

## Layout

```text
agent-engine/workflow-memory/
  README.md
  index.json
  guardrails.md
  taxonomy.md
  events/
    YYYY-MM.jsonl
  summaries/
    YYYY-MM.md
```

## How This Fits The Repository Workflow

Workflow memory is not just a historical log. It is the persistence layer for
the agent-harness operating model described in
[`agent-engine/workflows/README.md`](../workflows/README.md)
and enforced in [`AGENTS.md`](../../AGENTS.md).

### 1) During delivery and review (write path)

Every core workflow run (for example Feature Delivery, Architecture + ADR
Guard, Periodic Scans, Docs + Knowledge Drift, and Self-Improvement) writes at
least one event using [`add-entry.ts`](../scripts/workflow-memory/add-entry.ts).
Utility skills do not use standalone workflow keys; they log under the parent
core workflow key.
This captures why decisions were made, what failed, and which follow-up actions
are required.

### 2) Before implementation (read path)

Agents retrieve workflow memory before coding and review to reuse prior signal
without loading excessive context:

- durable controls from [`guardrails.md`](./guardrails.md)
- canonical tagging rules from [`taxonomy.md`](./taxonomy.md)
- monthly compression from [`summaries/`](./summaries/)
- top-ranked matches from [`index.json`](./index.json) and [`events/`](./events/)

### 3) As a quality gate (coverage path)

[`pnpm workflow-memory:coverage:strict`](../../package.json) is used in periodic
quality loops to verify that workflows actually being run are represented in
memory. This catches process drift (missing workflow records) early.

### 4) As compounding input (improvement path)

Repeated patterns found in events and summaries are promoted into durable
controls across the repo:

- tests and invariants
- lint or script guardrails
- skill/playbook updates
- docs and architecture guidance

In short: `events` capture incidents, `index` makes them queryable,
`summaries` compress recurring signal, and `guardrails` preserve long-term
standards.

## Event Record (Source Of Truth)

- Store one JSON object per line in files under [`events/`](./events/) (for example, `events/YYYY-MM.jsonl`).
- Keep entries small and factual.
- Required fields:
  - `id`
  - `date` (`YYYY-MM-DD`)
  - `workflow`
  - `title`
  - `trigger`
  - `finding`
  - `evidence`
  - `followUp`
  - `owner`
  - `status`
- Optional fields:
  - `reflection` (what went well / what to repeat)
  - `feedback` (what to improve / what to avoid)
  - `importance` (0-1, higher = more critical or reusable)
  - `recency` (0-1, higher = more recent; override computed recency if needed)
  - `confidence` (0-1, higher = more reliable evidence)
  - `scan` (optional object for structured random-walk metadata):
    - `walkMode`
    - `scope`
    - `domain`
    - `signal`

For `workflow: "Periodic Scans"` entries tagged `best-practice-researcher`, `scan`
metadata is required and must be provided through
`--scan-walk-mode`, `--scan-scope`, `--scan-domain`, and `--scan-signal`.

## Index (Fast Retrieval)

[`index.json`](./index.json) is a compact lookup table for retrieval and ranking.

Each index row contains:

- `id`
- `date`
- `month`
- `workflow`
- `title`
- `severity`
- `status`
- `tags`
- `importance` (optional 0-1)
- `recency` (optional 0-1)
- `confidence` (optional 0-1)
- `scan` (optional object mirroring event `scan` metadata)
- `eventFile`

## Summaries (Human Compression)

[`summaries/YYYY-MM.md`](./summaries/) is the monthly rollup:

- top repeated patterns
- guardrails added
- open risks
- carry-over actions

Summary freshness is deterministic:

- `pnpm workflow-memory:add-entry` regenerates the summary for the event month.
- `pnpm workflow-memory:compact` regenerates summaries for all months present in active events.
- Each generated summary includes a freshness marker:
  - `<!-- workflow-memory-summary:month=YYYY-MM;events=<count> -->`
- `pnpm scripts:lint` fails when summary markers drift from `index.json` month counts.

## Guardrail Ledger

[`guardrails.md`](./guardrails.md) stores only durable controls that became standards (test, lint, docs rule, skill rule, automation).

Do not copy every incident here.

## Taxonomy

[`taxonomy.md`](./taxonomy.md) defines canonical tags for:

- memory form/function/dynamics
- agent capability axes and failure modes

Use canonical taxonomy tags whenever the event covers memory behavior or agent
run failures.

Tag standard:

- If tags include `memory` or `workflow-memory`, include at least one of each:
  - `memory-form:*`
  - `memory-function:*`
  - `memory-dynamics:*`
- If any `capability:*` or `failure:*` tags are present, include at least one
  from both groups.

## Retrieval Rule For Agents

Read in this order:

1. [`guardrails.md`](./guardrails.md)
2. [`taxonomy.md`](./taxonomy.md)
3. [`summaries/<current-month>.md`](./summaries/) (or latest available)
4. [`index.json`](./index.json) filtered to relevant workflow/tags
5. Top 3-5 matching events from [`events/`](./events/)

If the summary marker is missing or stale versus `index.json`, skip the summary and use `index.json` + `events/*.jsonl` directly.
Do not load full event history unless explicitly requested.

## Write Protocol

Preferred command:

```bash
pnpm workflow-memory:add-entry \
  --workflow "Feature Delivery" \
  --title "Example pattern" \
  --trigger "PR #123 review" \
  --finding "Missing ownership check on mutation path" \
  --evidence "packages/api/src/server/router/chat.ts:42" \
  --follow-up "add invariant + docs rule" \
  --reflection "Captured authz risk early in review" \
  --feedback "Add checklist item for ownership before merge" \
  --owner "@team" \
  --status "open" \
  --severity "high" \
  --tags authz,invariants \
  --capability instruction-following \
  --failure-mode incorrect-patch \
  --importance 0.8 \
  --recency 0.9 \
  --confidence 0.7
```

This appends an event to the current month and updates `index.json`.
It also regenerates `summaries/YYYY-MM.md` for the event month.

Periodic scan events can be logged with explicit random-walk metadata:

```bash
pnpm workflow-memory:add-entry \
  --workflow "Periodic Scans" \
  --title "best-practice-researcher: meso scan (api-contracts-orpc-hono)" \
  --trigger "Scheduled random-walk run" \
  --finding "Opened issue #123 after protocol contract drift check" \
  --evidence "https://github.com/<org>/<repo>/issues/123" \
  --follow-up "Await issue-evaluator label decision" \
  --owner "@automation" \
  --status "open" \
  --severity "medium" \
  --tags best-practice-researcher,periodic-scans \
  --scan-walk-mode weighted-random \
  --scan-scope meso \
  --scan-domain api-contracts-orpc-hono \
  --scan-signal 4
```

For automation runs, persist the append to git immediately:

```bash
pnpm workflow-memory:sync \
  --message "chore(workflow-memory): <automation-id> run memory"
```

`workflow-memory:sync` stages only append artifacts under `events/`, `index.json`,
and `summaries/`, creates a commit, and pushes with retry on non-fast-forward.
When concurrent memory writes collide, it auto-rebases and resolves
append-only conflicts for memory files.

## Scoring + Retrieval

Scoring uses a lightweight weighted sum:

- `score = 0.4 * importance + 0.3 * recency + 0.2 * tagMatch + 0.1 * confidence`
- If `recency` is omitted, retrieval computes a 90-day linear decay from `date`.

Retrieval helper:

```bash
pnpm workflow-memory:retrieve \
  --workflow "Self-Improvement" \
  --tags guardrail,docs \
  --limit 5 \
  --min-score 0.35
```

Sample output (truncated):

```json
{
  "query": {
    "workflow": "Self-Improvement",
    "tags": [
      "guardrail",
      "docs"
    ],
    "month": null,
    "minScore": 0.35,
    "limit": 5
  },
  "results": [
    {
      "id": "2026-02-21-self-improvement-workflow-memory-scoring-retrieval-helper",
      "date": "2026-02-21",
      "workflow": "Self-Improvement",
      "title": "Workflow memory scoring + retrieval helper",
      "tags": [
        "guardrail",
        "docs",
        "workflow-memory"
      ],
      "scan": {
        "walkMode": "weighted-random",
        "scope": "meso",
        "domain": "api-contracts-orpc-hono",
        "signal": "4"
      },
      "score": 0.86,
      "breakdown": {
        "importance": 0.8,
        "recency": 0.9,
        "tagMatch": 1,
        "confidence": 0.7
      },
      "eventFile": "events/2026-02.jsonl"
    }
  ]
}
```

Filter retrieval by structured random-walk metadata:

```bash
pnpm workflow-memory:retrieve \
  --workflow "Periodic Scans" \
  --scan-scope meso \
  --scan-domain api-contracts-orpc-hono \
  --limit 8 \
  --min-score 0
```

## Coverage Audit

Use the coverage audit to spot sparse workflow memory before it drifts:

```bash
pnpm workflow-memory:coverage
```

Optional flags:

- `--month YYYY-MM` checks a specific month
- `--min N` requires at least `N` entries per workflow
- `--strict` exits non-zero when any workflow is below threshold

Weekly baseline:

```bash
pnpm workflow-memory:coverage:strict
```

If coverage reports a workflow as missing and that workflow was run, add the missing event immediately with [`agent-engine/scripts/workflow-memory/add-entry.ts`](../scripts/workflow-memory/add-entry.ts).

## Strict-Coverage Bootstrap (Fresh Repos)

For fresh repositories or new months with sparse history, initialize minimum
coverage before enforcing strict mode:

```bash
pnpm workflow-memory:bootstrap
```

Optional flags:

- `--month YYYY-MM` seeds a specific month
- `--min N` seeds up to `N` entries per core workflow
- `--owner @handle` sets event ownership
- `--dry-run` previews planned seeded entries without writing files

Bootstrap entries are explicitly marked as initialization records:

- `source: "bootstrap"`
- `isInitialization: true`
- tags include `initialization` and `seeded`

This keeps seeded coverage distinguishable from observed workflow execution in
future analytics and reviews.

## Replayable Scenarios

Scenarios are structured test cases that capture exact code input + expected agent findings. They are stored as companion fixtures alongside existing JSONL events. The current tooling validates scenario integrity (structure, fixture existence, secret scanning). LLM-based evaluation is a future follow-up.

### Scenario Schema

Events with scenarios include a `scenario` field (canonical metadata source):

```json
{
  "scenario": {
    "skill": "pr-risk-review",
    "check": "auth-bypass",
    "verdict": "fail",
    "pattern": "missing-ownership-check",
    "severity": "high"
  }
}
```

- `skill` (required) — target skill to test
- `verdict` (required) — `"pass"` or `"fail"` expected outcome
- `check` — specific check within the skill
- `pattern` — code pattern being tested
- `severity` — `"low"` | `"medium"` | `"high"` | `"critical"`

Index rows include `hasScenario: true` and `scenarioSkill` for fast filtering.

### Fixture Format

Fixture path is always derived from event ID under [`agent-engine/workflow-memory/scenarios/`](./scenarios/).

Fixtures contain only input and expected findings (no duplicated metadata):

```markdown
## Input

\`\`\`typescript
// The exact code snippet the agent should analyze
\`\`\`

## Expected Findings

- Finding 1
- Finding 2

## Context

Additional context about what the skill should do with this input.
```

### Creating Scenarios

```bash
# 1. Write the fixture file
# agent-engine/workflow-memory/scenarios/{id}.md

# 2. Create the event with scenario flags
pnpm workflow-memory:add-entry \
  --id my-scenario-id \
  --workflow "Self-Improvement" \
  --title "Scenario: description" \
  --trigger "Seed scenario for regression testing" \
  --finding "What the scenario tests" \
  --evidence "agent-engine/workflow-memory/scenarios/my-scenario-id.md" \
  --follow-up "Verify skill catches this pattern" \
  --owner "@agent" \
  --status "open" \
  --tags scenario,skill-name \
  --scenario-skill skill-name \
  --scenario-verdict fail \
  --scenario-check check-name \
  --scenario-pattern pattern-name \
  --scenario-severity high
```

### Validating Scenarios

```bash
# Validate all scenarios
pnpm scenario:validate

# Strict mode (exit 1 on failures)
pnpm scenario:validate:strict

# Filter by skill
pnpm scenario:validate --skill pr-risk-review

# JSON output
pnpm scenario:validate --json
```

### Retrieving Scenarios

```bash
# All events with scenarios
pnpm workflow-memory:retrieve --has-scenario

# Filter by target skill
pnpm workflow-memory:retrieve --scenario-skill pr-risk-review
```

## Compaction Policy

- Weekly: dedupe repeated entries and close resolved items.
- Monthly: roll up summary and convert recurring patterns into guardrails.
- Archive closed items older than 90 days if event volume grows significantly.

Compaction helper:

```bash
pnpm workflow-memory:compact --archive-closed --days 90
```
