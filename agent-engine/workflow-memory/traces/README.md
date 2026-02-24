# LLM Trace Capture for Prompt Optimization

This directory documents the trace capture infrastructure that enables future
GEPA/DSPy-style prompt optimization for automation playbooks.

## Why Traces?

The [GEPA (Reflective Prompt Evolution)](https://arxiv.org/abs/2507.19457) methodology
requires three ingredients to automatically optimize prompts:

1. **The current prompt/instructions** — the playbook `.md` file
2. **Input/output examples** — what was sent to the LLM and what it produced
3. **Feedback signals** — human ratings, AI self-evaluation, or metric scores

Without captured traces, you cannot build the optimization dataset. The
workflow-memory system already captures *what happened* (findings, follow-ups),
but not the *raw LLM interaction* that produced those results.

## Trace Storage: Separation of Concerns

**Trace data is NOT stored in git.** Traces contain full LLM context windows,
raw model outputs, and potentially sensitive data (API keys in context, PII,
proprietary code snippets). Committing them to git would be a security risk and
would bloat the repository.

Instead, traces use a two-layer storage model:

### Layer 1: Lightweight Reference in JSONL (git-tracked)

Workflow-memory events in the JSONL files store only a `traceRef` with metadata:

```json
{
  "traceRef": {
    "playbook": "best-practice-researcher",
    "playbookVersion": "abc123",
    "score": 0.78,
    "hasAiFeedback": true,
    "traceFilePath": "traces/data/2026-02-24-periodic-scans-best-practice.trace.json"
  }
}
```

This is safe to commit — it contains no sensitive payload data.

### Layer 2: Full Trace Payload in Local Files (gitignored)

The full trace data (input context, LLM output, feedback) is written to
`agent-engine/workflow-memory/traces/data/{event-id}.trace.json`. This directory
is in `.gitignore` and never committed.

The full trace file contains the complete schema:

```json
{
  "playbook": "best-practice-researcher",
  "playbookVersion": "abc123",
  "input": {
    "context": "Repository state, prior memory, etc.",
    "taskDescription": "The specific task given to the LLM"
  },
  "output": {
    "raw": "Full LLM response text",
    "structured": {
      "recommendations": [],
      "issuesOpened": []
    }
  },
  "evaluation": {
    "metrics": {
      "evidenceQuality": 0.8,
      "actionability": 0.7,
      "coherence": 0.9
    },
    "humanFeedback": null,
    "aiFeedback": {
      "strengths": ["Well-sourced recommendations"],
      "improvements": ["Could include more concrete code examples"],
      "overallAssessment": "Good research depth, moderate actionability"
    },
    "score": 0.78
  },
  "metadata": {
    "model": "gpt-5.3-codex",
    "temperature": null,
    "tokens": { "prompt": 12000, "completion": 3500 },
    "latencyMs": 45000,
    "timestamp": "2026-02-24T14:30:00.000Z"
  }
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `playbook` | Yes | Automation ID (e.g. `best-practice-researcher`) |
| `playbookVersion` | No | Git SHA or content hash of the `.md` playbook file |
| `input` | No | The context and task description sent to the LLM |
| `output` | No | Raw and/or structured LLM output |
| `evaluation` | No | Feedback signals (metrics, human, AI, score) |
| `metadata` | No | Model info, token counts, latency |

All fields except `playbook` are optional. Capture what you can — partial
traces are still valuable for optimization.

## Trace Capture Protocol

When trace capture is enabled for an automation, follow this protocol to capture
the LLM interaction data alongside the standard workflow-memory event.

### Step-by-step

1. **Before running**: Serialize the input context (task description, relevant
   memory, repo state summary) to a temporary JSON file at
   `agent-engine/workflow-memory/traces/tmp/trace-input.json`.
2. **After running**: Serialize the output (raw LLM response and any structured
   results) to `agent-engine/workflow-memory/traces/tmp/trace-output.json`.
3. **Self-evaluation** (optional): Review your own output and score it on
   relevant dimensions (evidence quality, actionability, coherence, relevance).
   Generate natural language feedback about strengths and improvements.
4. **Persist trace**: Add `--trace-*` flags to the `workflow-memory:add-entry`
   command:

```bash
pnpm workflow-memory:add-entry \
  ... \  # standard flags
  --trace-playbook <automation-id> \
  --trace-playbook-version "$(git log -1 --format=%H -- agent-engine/automations/<automation-id>/<automation-id>.md)" \
  --trace-input @agent-engine/workflow-memory/traces/tmp/trace-input.json \
  --trace-output @agent-engine/workflow-memory/traces/tmp/trace-output.json \
  --trace-model MODEL_NAME \
  --trace-tokens '{"prompt":N,"completion":N}' \
  --trace-latency MILLISECONDS \
  --trace-ai-feedback '{"strengths":[...],"improvements":[...],"overallAssessment":"..."}' \
  --trace-score SCORE
```

The `add-entry` script will automatically:
- Write the full trace payload to `traces/data/{event-id}.trace.json`
- Store only a lightweight `traceRef` in the JSONL event

5. **Cleanup**: Remove temporary trace JSON files after persisting.

The `traces/tmp/` directory is gitignored and used only for passing data between
automation steps. Never use `/tmp` — repo-local paths are safer and portable.

## Feedback Strategy: Independent Evaluation over Self-Evaluation

A key insight from the GEPA paper: **self-evaluation during a run is biased**.
The same model that produced the output rates its own work within the same
context window, leading to inflated scores and blind spots.

Instead, this system uses a two-tier feedback approach:

### Tier 1: Optional In-Run Self-Evaluation (Lightweight)

Automations *can* run a quick self-evaluation after their main task. This is
cheap and immediate but inherently biased. Useful as a rough signal but not
sufficient for optimization.

### Tier 2: Independent Trace Evaluator (Primary Feedback Source)

The [`trace-evaluator`](../../automations/trace-evaluator/trace-evaluator.md)
automation runs on a separate schedule and evaluates traces with **fresh
context**. It:

- Discovers traces that lack AI feedback
- Evaluates output quality across 10 dimensions (evidence quality/validity,
  actionability, coherence, relevance, completeness, accuracy, goal alignment,
  protocol compliance, boundary respect)
- Verifies citations and references are real
- Checks playbook alignment (blind evaluation first, then alignment check)
- Produces structured feedback with specific justifications for each score

This independent evaluation is the **natural language feedback** that GEPA uses
for reflective prompt mutation. It's what makes future optimization possible.

### Example Evaluation Output

```json
{
  "metrics": {
    "evidenceQuality": 0.85,
    "evidenceValidity": 0.9,
    "actionability": 0.6,
    "coherence": 0.9,
    "relevance": 0.95,
    "completeness": 0.7,
    "accuracy": 0.85,
    "goalAlignment": 0.8,
    "protocolCompliance": 0.9,
    "boundaryRespect": 1.0
  },
  "aiFeedback": {
    "strengths": [
      "All recommendations cite specific repo files",
      "Clear impact/effort/confidence ratings"
    ],
    "improvements": [
      "Recommendation #2 lacks a concrete code example",
      "Could cross-reference with existing open issues"
    ],
    "criticalIssues": [],
    "overallAssessment": "Strong research with good evidence. Actionability could improve with more implementation guidance."
  },
  "score": 0.82
}
```

## Capturing Traces via CLI

Use the existing `add-entry` command with trace flags:

```bash
pnpm workflow-memory:add-entry \
  --workflow "Periodic Scans" \
  --title "best-practice-researcher: meso scan" \
  --trigger "Scheduled random-walk run" \
  --finding "Found 3 recommendations" \
  --evidence "https://github.com/org/repo/issues/123" \
  --follow-up "Await evaluation" \
  --owner "@automation" \
  --status "open" \
  --trace-playbook best-practice-researcher \
  --trace-playbook-version abc123def \
  --trace-input @agent-engine/workflow-memory/traces/tmp/trace-input.json \
  --trace-output @agent-engine/workflow-memory/traces/tmp/trace-output.json \
  --trace-model gpt-5.3-codex \
  --trace-tokens '{"prompt":12000,"completion":3500}' \
  --trace-latency 45000 \
  --trace-ai-feedback '{"strengths":["Good evidence"],"improvements":["More examples"],"overallAssessment":"Solid","score":0.78}' \
  --trace-score 0.78
```

The `@` prefix for `--trace-input` and `--trace-output` reads JSON from a file
path, which is useful when the content is large.

## Roadmap: From Traces to Optimization

```
Phase 1 (this PR): Trace capture infrastructure
  └── Automations write trace refs to workflow-memory events
  └── Full trace data stored locally in gitignored traces/data/

Phase 2: Trace analysis tooling
  └── Scripts to extract, filter, and analyze traces
  └── Identify low-scoring runs and common failure patterns

Phase 3: GEPA/DSPy optimization pipeline
  └── Feed traces into DSPy optimizers
  └── Current playbook + (input, output, feedback) examples → improved playbook
  └── A/B test optimized vs. original playbooks

Phase 4: Continuous optimization loop
  └── Automated trace collection → periodic optimization runs
  └── Human review of proposed playbook changes
  └── Version tracking via playbookVersion field
```

## Integration with Workflow Memory

Traces use a two-layer storage model (see "Trace Storage" above). This means:

- Existing events without traces continue to work unchanged
- Trace references are queryable via the same retrieval tooling
- Index rows include `hasTrace: true` and `tracePlaybook` for filtering
- Full trace data is available locally for analysis/optimization
- Monthly summaries can reference trace quality trends

## References

- [GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning](https://arxiv.org/abs/2507.19457) (ICLR 2026 Oral)
- [DSPy: Programming—not Prompting—Foundation Models](https://arxiv.org/abs/2310.03714)
- [TextGrad: Automatic Differentiation via Text](https://arxiv.org/abs/2406.07496)
